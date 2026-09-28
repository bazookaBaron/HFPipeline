#!/usr/bin/env node
"use strict";

/**
 * make-longform.js -- one-click 16:9 long-form video (plan §7, P6).
 *
 *   node make-longform.js --topic "Why Kingfisher went bankrupt" [--minutes 10] [--out dir]
 *     [--from research|data|outline|script|storyboards|media|render|montage|stitch|master|gates|package|thumbnail]
 *     [--chapters "cold,1,3,recap"] [--no-render] [--offline] [--replay <dir>] [--music auto|ambient|lofi|pulse|off]
 *     [--quality looks] [--keep-going] [--montage on|off]
 *
 * Stages (each writes its artefact under --out and is skipped on a re-run when the artefact exists and
 * its content key still matches; --from <stage> redoes that stage and everything after it):
 *   research     dossier.json                    lib/longform/research.js (Gemini + Google Search)
 *   data         data.json (+ dossier facts D1..)  lib/longform/data.js (World Bank series for the dossier's dataAsks;
 *                                                 latest + peak become facts, full series feed charts/maps via
 *                                                 {series:"S1"} refs, lib/longform/DATA.md); key = hash(dataAsks)
 *   outline      outline.json                    lib/longform/outline.js
 *   script       script.json                     lib/longform/script.js (fixed narration from here on)
 *   storyboards  storyboards/<section>.json      lib/longform/storyboardLF.js, 3 sections in parallel;
 *                                                 key = sectionHash(sentences + chapter meta + prompt version)
 *   media        media/intents.json, media-manifest.json, credits.txt, media-report.json;
 *                chapters/<section>/storyboard.json (slots renamed by the cross-chapter merge)
 *                                                 all chapters' intents in ONE manifest (dedupe across chapters);
 *                                                 exact-intent cache hits first (lib/media/library.js), the rest
 *                                                 via lib/media/resolve.js; key = hash(merged intents)
 *   render       chapters/<section>/chapter.mp4 (+ .timeline.json, .metrics.json, gates.json, render.json)
 *                                                 generate-video-v3.js, 2 in parallel, voice serialized by a lock;
 *                                                 captions off, voice + SFX only (NO music bed: see master),
 *                                                 the end screen only on the recap; key = hash(storyboard + its
 *                                                 manifest entries + options); v3_gates.py per chapter; a chapter
 *                                                 failing storyboard gates is regenerated alone (<= 2 times, live only)
 *   montage      montage/montage.mp4, montage/montage.json (lib/longform/montage.js, --montage on by default):
 *                25-35 s trailer cold open BEFORE the cold-open chapter: chorus lines on text slams / photos,
 *                a beat run of chapter-moment punch-ins cut on the trailer bed's beat grid (whoosh per cut),
 *                an anchor line held 5-8 s, bass drop into the cold open; its own premixed audio (music -4 dB
 *                under the voice); key = hash(lines, bed, candidate moments, tools)
 *   stitch       stitch/seg-<section>.mp4, stitch/stitched.mp4, stitch/stitch.json
 *                                                 uniform re-encode + last-frame/silence pad (~0.9 s voice gap at
 *                                                 every chapter join), concat demuxer (stream copy), durations verified
 *   master       final/video.mp4, final/master.json
 *                                                 music (--music auto: final/music-plan.json, one free-library bed
 *                                                 per section switching at section/scene boundaries, procedural
 *                                                 fallback per mood -- lib/longform/musicPlan.js; ambient|lofi|pulse:
 *                                                 ONE procedural bed), ducked, +3 dB on chapter cards, then -14 LUFS /
 *                                                 TP <= -1 over the whole video
 *   gates        final/gates.json                loudness, frame size/fps, durations, captions, YouTube chapter rules,
 *                                                 per-chapter gate results aggregated
 *   package      final/captions.srt, description.md, credits.txt, metadata.json
 *   thumbnail    final/thumbnail-{a,b,c}.png (1280x720, < 2 MB), final/thumbnails.json; metadata.json gets a
 *                thumbnails field         lib/longform/thumbnail.js (hero photo from the manifest, 2-4 word title
 *                                                 via Gemini lite or deterministic, dossier stat, puppeteer render,
 *                                                 legibility/contrast/subject checks); key = hash(inputs); a failure
 *                                                 here is reported but never fails the run
 *
 * Progress: human lines "[lf] ..." plus one machine line per stage event on stdout:
 *   @@lf {"stage":"render","status":"start|progress|done|skip|fail","detail":"...", ...}
 * Exit codes: 0 ok, 1 failure, 3 finished with failing gates, 4 Gemini unavailable (402 credits depleted / auth).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");

const SL = require("./lib/longform/storyboardLF");
const PK = require("./lib/longform/package");
const ST = require("./lib/longform/stitch");
const MP = require("./lib/longform/musicPlan");
const { pool } = require("./lib/longform/gemini");
const { matchLibrary } = require("./lib/media/library");

const STAGES = ["research", "data", "outline", "script", "storyboards", "media", "render", "montage", "stitch", "master", "gates", "package", "thumbnail"];
const RENDER_VERSION = "lf-render.1";

// ------------------------------------------------------------------------------------ helpers
function parseArgs(argv) {
  const a = { minutes: 10, music: "auto", quality: "looks", sbParallel: 3, renderParallel: 2, montage: true };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const v = () => {
      const x = argv[++i];
      if (x === undefined) throw new Error(`${k} needs a value`);
      return x;
    };
    if (k === "--topic") a.topic = v();
    else if (k === "--minutes") a.minutes = Number(v());
    else if (k === "--out") a.out = v();
    else if (k === "--from") a.from = v();
    else if (k === "--chapters") a.chapters = v();
    else if (k === "--no-render") a.noRender = true;
    else if (k === "--offline") a.offline = true;
    else if (k === "--replay") a.replay = v();
    else if (k === "--music") a.music = v();
    else if (k === "--quality") a.quality = v();
    else if (k === "--keep-going") a.keepGoing = true;
    else if (k === "--montage") a.montage = !/^(off|false|no|0)$/i.test(v());
    else if (k === "--render-parallel") a.renderParallel = Number(v());
    else if (k === "--storyboard-parallel") a.sbParallel = Number(v());
    else if (k === "-h" || k === "--help") a.help = true;
    else throw new Error(`unknown argument ${k}`);
  }
  if (/^(off|false|none)$/i.test(a.music)) a.music = null;
  return a;
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));
const writeJson = (p, v) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 1));
};
const hash = (v) => crypto.createHash("sha256").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex").slice(0, 16);
const exists = (p) => fs.existsSync(p);

function emit(stage, status, extra = {}) {
  process.stdout.write(`@@lf ${JSON.stringify({ stage, status, ...extra })}\n`);
}
function log(m) {
  process.stdout.write(`[lf] ${m}\n`);
}

/** "cold,1,3,recap" -> section ids; empty -> all */
function selectSections(script, spec) {
  const all = script.sections.map((s) => s.id);
  if (!spec) return all;
  const want = new Set();
  String(spec)
    .split(/[\s,]+/)
    .filter(Boolean)
    .forEach((t) => {
      if (/^\d+$/.test(t)) want.add(`ch${Number(t)}`);
      else want.add(t);
    });
  const unknown = [...want].filter((x) => all.indexOf(x) < 0);
  if (unknown.length) throw new Error(`--chapters: unknown section(s) ${unknown.join(", ")} (have ${all.join(", ")})`);
  return all.filter((x) => want.has(x));
}

class Fatal extends Error {}
const isBilling = (err) => SL.isFatal(err) || /\bHTTP 40[123]\b|credits are depleted/i.test(String(err && err.message));

function billingMessage(stage, err, out) {
  return `Gemini is unavailable (${String(err.message).slice(0, 200)}). This is not retried: HTTP 402 means the prepaid credits are depleted (top up billing at https://aistudio.google.com), 401/403 means the key is invalid. Nothing after "${stage}" ran. Re-run with: node orchestrator/make-longform.js --out "${out}" --from ${stage}`;
}

// ------------------------------------------------------------------------------------ main
async function main() {
  const a = parseArgs(process.argv);
  if (a.help) {
    console.log(fs.readFileSync(__filename, "utf-8").split("\n").slice(4, 12).join("\n"));
    return;
  }
  if (!(a.minutes >= 2 && a.minutes <= 20)) throw new Error("--minutes must be 2-20 (3 = cold open + 3 short chapters + recap)");
  if (a.from && STAGES.indexOf(a.from) < 0) throw new Error(`--from must be one of ${STAGES.join(", ")}`);
  const out = path.resolve(a.out || path.join(__dirname, "output", "lf", slug(a.topic || "longform")));
  fs.mkdirSync(out, { recursive: true });
  const P = {
    dossier: path.join(out, "dossier.json"),
    data: path.join(out, "data.json"),
    outline: path.join(out, "outline.json"),
    script: path.join(out, "script.json"),
    sbDir: path.join(out, "storyboards"),
    mediaDir: path.join(out, "media"),
    chDir: path.join(out, "chapters"),
    stitchDir: path.join(out, "stitch"),
    finalDir: path.join(out, "final"),
  };
  // --from X redoes X and every later stage. Content-keyed stages (media, render, stitch, master)
  // already rebuild when their inputs change, so they are only FORCED when --from names one of them
  // (or an earlier keyed stage): "--from storyboards" re-renders only chapters whose storyboard changed.
  const KEYED = ["media", "render", "montage", "stitch", "master", "thumbnail"];
  const redo = (stage) => {
    if (!a.from || STAGES.indexOf(stage) < STAGES.indexOf(a.from)) return false;
    return KEYED.indexOf(stage) < 0 || KEYED.indexOf(a.from) >= 0 || STAGES.indexOf(a.from) > STAGES.indexOf("master");
  };
  const cacheDir = path.join(__dirname, "output", "lf", ".cache");
  let geminiRest = null;
  const gemini = () => {
    if (a.offline) throw new Fatal("--offline: this stage needs Gemini and has no saved artefact");
    if (!geminiRest) geminiRest = require("./lib/longform/gemini").loadGeminiRest({ log: (m) => log(m) });
    return geminiRest;
  };
  const run = { out, stages: {} };
  const stageDone = (s, detail, extra) => {
    run.stages[s] = { status: "done", detail, ...(extra || {}) };
    emit(s, "done", { detail, ...(extra || {}) });
  };
  const stageSkip = (s, detail) => {
    run.stages[s] = { status: "skip", detail };
    emit(s, "skip", { detail });
    log(`${s}: ${detail}`);
  };

  // ---------------------------------------------------------------- research / outline / script
  let topic = a.topic;
  if (!topic && exists(P.script)) topic = readJson(P.script).topic;
  if (!topic && exists(P.dossier)) topic = readJson(P.dossier).topic;
  if (!topic) throw new Error("--topic is required (or an --out dir that already has script.json)");
  log(`topic: ${topic} | ${a.minutes} min | out ${out}${a.offline ? " | OFFLINE" : ""}${a.replay ? ` | replay ${a.replay}` : ""}`);

  let dossier, outline, script;
  emit("research", "start");
  if (exists(P.dossier) && !redo("research")) {
    dossier = readJson(P.dossier);
    stageSkip("research", `reusing dossier.json (${dossier.facts.length} facts)`);
  } else {
    const { research } = require("./lib/longform/research");
    try {
      dossier = await research(topic, { cacheDir, force: redo("research"), log, gemini: gemini() });
    } catch (err) {
      if (isBilling(err)) throw new Fatal(billingMessage("research", err, out));
      throw err;
    }
    writeJson(P.dossier, dossier);
    stageDone("research", `${dossier.facts.length} facts, ${dossier.sources.length} sources`);
  }
  // ---------------------------------------------------------------- data (World Bank series)
  emit("data", "start");
  {
    const DATA = require("./lib/longform/data");
    const dataKey = hash({ asks: dossier.dataAsks || [], v: 1 });
    let data = exists(P.data) ? readJson(P.data) : null;
    if (data && data.key === dataKey && !redo("data")) stageSkip("data", `reusing data.json (${data.series.length} series)`);
    else {
      try {
        data = await DATA.buildData(dossier, { log, offline: !!a.offline });
      } catch (err) {
        // real data is an enhancement: a failed fetch never stops the video
        log(`data: unavailable (${String(err.message).slice(0, 160)}); continuing without data series`);
        data = { version: "data.v1", series: [], skipped: [], error: String(err.message).slice(0, 300) };
      }
      data.key = dataKey;
      writeJson(P.data, data);
      stageDone("data", `${data.series.length} series, ${(data.skipped || []).length} skipped`);
    }
    // idempotent: D* facts (latest + peak per series) replace any earlier ones
    const merged = DATA.mergeDataFacts(dossier, data);
    if (JSON.stringify(merged) !== JSON.stringify(dossier)) {
      dossier = merged;
      writeJson(P.dossier, dossier);
    }
  }
  emit("outline", "start");
  const outlineStale = exists(P.outline) && (readJson(P.outline).budget || {}).minutes !== a.minutes;
  if (exists(P.outline) && !redo("outline") && !outlineStale) {
    outline = readJson(P.outline);
    stageSkip("outline", `reusing outline.json (${outline.chapters.length} chapters)`);
  } else {
    if (outlineStale) log(`outline was planned for ${(readJson(P.outline).budget || {}).minutes} min; re-outlining for ${a.minutes}`);
    const { makeOutline } = require("./lib/longform/outline");
    try {
      outline = await makeOutline(dossier, { minutes: a.minutes, gemini: gemini(), log });
    } catch (err) {
      if (isBilling(err)) throw new Fatal(billingMessage("outline", err, out));
      throw err;
    }
    writeJson(P.outline, outline);
    stageDone("outline", `${outline.chapters.length} chapters`);
  }
  emit("script", "start");
  if (exists(P.script) && !redo("script") && !redo("outline") && !outlineStale) {
    script = readJson(P.script);
    stageSkip("script", `reusing script.json (${script.stats ? script.stats.words : "?"} words)`);
  } else {
    const { writeScript } = require("./lib/longform/script");
    try {
      script = await writeScript(dossier, outline, { gemini: gemini(), log });
    } catch (err) {
      if (isBilling(err)) throw new Fatal(billingMessage("script", err, out));
      throw err;
    }
    writeJson(P.script, script);
    stageDone("script", `${script.stats.words} words`);
  }

  const sections = selectSections(script, a.chapters);
  const partial = sections.length !== script.sections.length;
  const lastSection = script.sections[script.sections.length - 1].id;
  const sectionOf = (id) => script.sections.find((s) => s.id === id);
  log(`sections: ${sections.join(", ")}${partial ? " (subset)" : ""}`);

  // ---------------------------------------------------------------- visual beat sheet (plan §6.1)
  // which visual each scene shows (maps / graphics / media / cards, variety rules); cached by content key,
  // at most one lite Gemini call per video. storyboards get their section's scenes as a fixed SCENE PLAN.
  const beatsPath = path.join(out, "beats.json");
  let beats = null;
  {
    const BS = require("./lib/longform/beatSheet");
    const bctx = { dossier, data: exists(P.data) ? readJson(P.data) : null, log };
    const prevBeats = exists(beatsPath) ? readJson(beatsPath) : null;
    const fresh = await BS.buildBeatSheet(script, bctx); // deterministic (no model call without ctx.gemini)
    if (prevBeats && prevBeats.key === fresh.key && !redo("script")) beats = prevBeats;
    else {
      beats = a.offline ? fresh : await BS.buildBeatSheet(script, { ...bctx, gemini: (() => { try { return gemini(); } catch (_) { return null; } })() });
      writeJson(beatsPath, beats);
    }
    const bp = BS.planProblems(beats);
    log(`beat sheet: ${beats.stats.contentScenes} scenes, mix ${JSON.stringify(beats.stats.byCategory)}${bp.length ? `; notes: ${bp.join("; ")}` : ""}`);
  }
  const planFor = (id) => (beats && beats.sections[id] ? beats.sections[id].scenes : null);

  // ---------------------------------------------------------------- storyboards
  const replayGen = (id) => {
    if (!a.replay) return null;
    const dir = path.resolve(a.replay);
    const first = path.join(dir, `${id}.response.json`);
    if (!exists(first)) return null;
    return async (_prompt, info) => {
      const n = (info && info.attempt) || 1;
      const f = path.join(dir, `${id}.response.${n}.json`);
      return readJson(exists(f) && n > 1 ? f : first);
    };
  };
  const generatorFor = (id) => {
    const r = replayGen(id);
    if (r) return { generate: r, kind: "replay" };
    if (a.offline) return null;
    return { generate: SL.liveGenerate({ log }), kind: "live" };
  };
  const sbPath = (id) => path.join(P.sbDir, `${id}.json`);
  // data: the World Bank series (data.json); storyboardLF lists them and embeds the ones a chapter uses (sb.data)
  const ctxFor = (id) => ({ section: sectionOf(id), meta: SL.chapterMeta(script, outline, id), dossier, outline, topic, data: exists(P.data) ? readJson(P.data) : null, plan: planFor(id) });

  async function makeStoryboard(id, extraProblems, previous) {
    const ctx = ctxFor(id);
    const g = generatorFor(id);
    if (!g) throw new Fatal(`storyboard ${id}: no saved storyboard, no --replay response, and --offline forbids Gemini`);
    emit("storyboards", "progress", { section: id, detail: `${g.kind} generation` });
    try {
      const r = await SL.generateChapterStoryboard(ctx, { generate: g.generate, log, extraProblems, previous });
      writeJson(sbPath(id), r.storyboard);
      log(`storyboard ${id}: ok after ${r.attempts.length} attempt(s) (${g.kind}); media ${r.storyboard.lfMeta.report.mediaSharePct}%, ${r.storyboard.scaffolds.length} scaffolds`);
      return r.storyboard;
    } catch (err) {
      if (err.last) writeJson(path.join(P.sbDir, `${id}.failed.json`), { storyboard: err.last, attempts: err.attempts });
      if (err.fatal || isBilling(err)) throw new Fatal(billingMessage("storyboards", err, out));
      throw err;
    }
  }

  emit("storyboards", "start", { sections });
  const storyboards = {};
  const todo = [];
  for (const id of sections) {
    const want = SL.sectionHash(sectionOf(id), SL.chapterMeta(script, outline, id), SL.planKey(planFor(id)));
    if (!redo("storyboards") && exists(sbPath(id)) && (readJson(sbPath(id)).lfMeta || {}).hash === want) storyboards[id] = readJson(sbPath(id));
    else todo.push(id);
  }
  if (todo.length) {
    const errors = [];
    await pool(todo, a.sbParallel, async (id) => {
      try {
        storyboards[id] = await makeStoryboard(id);
      } catch (err) {
        if (err instanceof Fatal) throw err;
        errors.push(`${id}: ${err.message}`);
      }
    });
    if (errors.length) {
      emit("storyboards", "fail", { detail: errors.join(" | ") });
      throw new Error(`storyboards failed: ${errors.join(" | ")}`);
    }
    stageDone("storyboards", `${todo.length} generated, ${sections.length - todo.length} reused`);
  } else stageSkip("storyboards", `reusing ${sections.length} storyboard(s)`);

  // ---------------------------------------------------------------- media
  const manifestPath = path.join(P.mediaDir, "media-manifest.json");
  const chSbPath = (id) => path.join(P.chDir, id, "storyboard.json");
  async function mediaStage(force) {
    emit("media", "start");
    const chapters = sections.map((id) => ({ id, sb: JSON.parse(JSON.stringify(storyboards[id])) }));
    const { intents, renames } = SL.mergeIntents(chapters);
    const key = hash({ intents, v: 1 });
    const keyPath = path.join(P.mediaDir, "media.key");
    for (const { id, sb } of chapters) {
      sb.mediaManifest = path.relative(path.join(P.chDir, id), manifestPath).split(path.sep).join("/");
      writeJson(chSbPath(id), sb);
    }
    writeJson(path.join(P.mediaDir, "intents.json"), intents);
    if (!force && exists(manifestPath) && exists(keyPath) && fs.readFileSync(keyPath, "utf-8") === key) {
      stageSkip("media", `reusing media-manifest.json (${intents.length} slots)`);
      return;
    }
    const lib = matchLibrary(intents);
    log(`media: ${intents.length} slot(s) across ${chapters.length} section(s) (${Object.keys(renames).length ? `renamed ${JSON.stringify(renames)}` : "no slot clashes"}); ${Object.keys(lib.hits).length} from the local library, ${lib.rest.length} to resolve`);
    let resolved = {};
    let report = { library: Object.keys(lib.hits) };
    if (lib.rest.length) {
      const { resolveMedia } = require("./lib/media/resolve");
      let g = null;
      let billing = null;
      if (!a.offline) {
        try {
          const raw = require("./lib/media/gemini").createGemini({ log });
          // a 402/401/403 inside the resolver would silently degrade every slot: trap it and stop the run
          const trap = (fn) => async (...x) => {
            try {
              return await fn(...x);
            } catch (err) {
              if (isBilling(err)) billing = billing || err;
              throw err;
            }
          };
          g = { ...raw, json: trap(raw.json), image: trap(raw.image) };
        } catch (err) {
          log(`media: Gemini unavailable (${err.message}); keyword queries only, no vision vetting, no illustrations`);
        }
      }
      const r = await resolveMedia(lib.rest, { gemini: g, offline: !!a.offline, log: (m) => log(`media ${m}`) });
      if (billing) throw new Fatal(billingMessage("media", billing, out));
      resolved = r.manifest;
      report = { ...report, resolver: r.report };
    }
    const slots = {};
    for (const it of intents) slots[it.slot] = lib.hits[it.slot] || resolved[it.slot] || { status: "fallback", kind: it.kind, reason: "not resolved" };
    const { creditsText } = require("./lib/media/resolve");
    writeJson(manifestPath, { version: "media-manifest.v1", slots });
    fs.writeFileSync(path.join(P.mediaDir, "credits.txt"), creditsText(slots));
    writeJson(path.join(P.mediaDir, "media-report.json"), report);
    fs.writeFileSync(keyPath, key);
    const counts = Object.values(slots).reduce((c, e) => ((c[e.status] = (c[e.status] || 0) + 1), c), {});
    stageDone("media", `${intents.length} slots: ${JSON.stringify(counts)}`, { counts });
  }
  // media gate (plan §3): a scene whose slot has no usable media (after the resolver ladder) is rewritten
  // graphics-only on the cheap tier -- only those scaffolds; the rest of the chapter storyboard stays
  async function mediaGateStage() {
    const gen = a.offline ? null : SL.liveSceneGenerate({ log });
    const g = await SL.mediaGate({ sections, storyboards, manifest: readJson(manifestPath), ctxFor, generate: gen, log, onChange: (id, sb) => writeJson(sbPath(id), sb) });
    if (g.changed.length) await mediaStage(false);
    if (g.failed.length) log(`media gate: ${g.failed.map((f) => `${f.id} (${f.slots.join(",")})`).join("; ")} still reference unusable media; the render gate will fail them`);
    run.mediaGate = g;
  }
  await mediaStage(redo("media"));
  await mediaGateStage();
  if (a.noRender) {
    log("--no-render: stopping after the media stage");
    writeJson(path.join(out, "run.json"), run);
    return 0;
  }

  // ---------------------------------------------------------------- render (+ per-chapter gates)
  const renderOne = async (id) => {
    const dir = path.join(P.chDir, id);
    const sb = readJson(chSbPath(id));
    const manifest = readJson(manifestPath);
    const used = [...SL.referencedSlots(sb)].sort().map((s) => [s, manifest.slots[s] || null]);
    const endcard = id === lastSection;
    const opts = { music: false, captions: false, endcard, quality: a.quality, v: RENDER_VERSION };
    const { lfMeta, ...sbKey } = sb; // lfMeta (attempt stats) never changes the picture
    const key = hash({ sb: sbKey, used, opts });
    const mp4 = path.join(dir, "chapter.mp4");
    const rj = path.join(dir, "render.json");
    if (!redo("render") && exists(mp4) && exists(rj) && readJson(rj).key === key && readJson(rj).ok) {
      emit("render", "progress", { section: id, detail: "reused" });
      return readJson(rj);
    }
    emit("render", "progress", { section: id, detail: "rendering" });
    const args = [path.join(__dirname, "generate-video-v3.js"), "--storyboard", chSbPath(id), "--out", mp4, "--run-id", `lf-${slug(topic).slice(0, 24)}-${id}`, "--media", manifestPath, "--music", "false", "--captions", "false", "--endcard", String(endcard), "--reuse-voice", "true", "--quality", a.quality, "--voice-lock", path.join(out, ".voice.lock")];
    const t0 = Date.now();
    const res = await new Promise((resolve) => {
      const c = spawn(process.execPath, args, { windowsHide: true });
      let stdout = "";
      let stderr = "";
      let tail = [];
      const logf = fs.createWriteStream(path.join(dir, "render.log"));
      c.stdout.on("data", (d) => (stdout += d.toString()));
      c.stderr.on("data", (d) => {
        logf.write(d);
        stderr += d.toString();
        String(d)
          .split(/\r?\n/)
          .filter(Boolean)
          .forEach((l) => {
            tail.push(l);
            if (tail.length > 40) tail.shift();
            if (!/hyperframes:std|errorCount/.test(l) && /\] (pace|speed|voice:|layout|composition|true peak|music|waiting for the voice lock)|failed|error/i.test(l)) log(`  [${id}] ${l.replace(/^\[generate-video-v3\] /, "")}`);
          });
      });
      c.on("close", (code) => {
        logf.end();
        resolve({ code, stdout, stderr, tail });
      });
    });
    if (res.code !== 0) {
      // a layout / compile failure on the REAL timing is a storyboard problem: feed it back like a gate
      const lay = res.tail.filter((l) => /layout audit failed|compile failed/.test(l)).map((l) => l.replace(/^.*?(layout audit failed|compile failed)/, "$1"));
      // hyperframes check errors (text hidden / overflowing) are layout problems too: name the texts
      if (res.tail.some((l) => /hyperframes check failed/.test(l))) {
        const out = String(res.stdout || "") + String(res.stderr || "");
        const texts = [...out.matchAll(/"severity":\s*"error"[\s\S]*?"message":\s*"([^"]+)"[\s\S]*?"text":\s*"([^"]*)"/g)].map((m) => `${m[1]} ("${m[2]}")`);
        lay.push(`composition check failed: ${[...new Set(texts)].slice(0, 4).join("; ") || "see render.log"} -- shorten or move that text`);
      }
      const r = { id, key, ok: false, error: `generate-video-v3 exit ${res.code}: ${res.tail.slice(-4).join(" | ")}`, repair: lay.length ? ["storyboard"] : [], gateFails: lay };
      writeJson(rj, r);
      return r;
    }
    const g = spawnSync(process.env.SFX_PYTHON || "python", [path.join(__dirname, "tools", "v3_gates.py"), "--video", mp4, "--timeline", `${mp4}.timeline.json`, "--metrics", `${mp4}.metrics.json`], { encoding: "utf-8", windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
    let gates;
    try {
      gates = JSON.parse(g.stdout);
    } catch (_) {
      gates = { ok: false, gates: [], repair: ["render"], error: (g.stderr || "").slice(-400) };
    }
    writeJson(path.join(dir, "gates.json"), gates);
    const fails = (gates.gates || []).filter((x) => x.hard && !x.ok).map((x) => `${x.name}=${JSON.stringify(x.value)}`);
    const r = { id, key, ok: true, gatesOk: !!gates.ok, gateFails: fails, repair: gates.repair || [], seconds: ST.probe(mp4).duration, wallS: Math.round((Date.now() - t0) / 1000) };
    writeJson(rj, r);
    log(`render ${id}: ${r.seconds.toFixed(2)} s in ${r.wallS} s wall; gates ${gates.ok ? "PASS" : `FAIL (${fails.join(", ")})`}`);
    return r;
  };

  emit("render", "start", { sections });
  let renders = {};
  for (let round = 0; round < 3; round++) {
    const pending = sections.filter((id) => !renders[id] || !renders[id].ok || !renders[id].gatesOk);
    if (!pending.length) break;
    await pool(pending, a.renderParallel, async (id) => {
      renders[id] = await renderOne(id);
    });
    const failed = sections.filter((id) => !renders[id].ok || !renders[id].gatesOk);
    const repairable = failed.filter((id) => (renders[id].repair || []).includes("storyboard") && generatorFor(id) && generatorFor(id).kind === "live");
    if (!failed.length || round === 2 || !repairable.length) break;
    // failure policy (plan §7): regenerate only the failing chapter's storyboard, twice at most
    for (const id of repairable) {
      log(`render ${id}: storyboard gates failed (${renders[id].gateFails.join(", ")}); regenerating that chapter (round ${round + 1}/2)`);
      storyboards[id] = await makeStoryboard(id, renders[id].gateFails.map((f) => `rendered chapter (real voice timing) failed: ${f}`), storyboards[id]);
    }
    await mediaStage(false);
    await mediaGateStage();
  }
  const bad = sections.filter((id) => !renders[id].ok || !renders[id].gatesOk);
  if (bad.length) {
    const detail = bad.map((id) => `${id}: ${renders[id].error || (renders[id].gateFails || []).join(", ")}`).join(" | ");
    emit("render", "fail", { detail });
    if (!a.keepGoing || bad.some((id) => !renders[id].ok)) {
      writeJson(path.join(out, "run.json"), { ...run, renders });
      throw new Error(`chapter render/gates failed: ${detail}`);
    }
    log(`--keep-going: continuing past failing chapter gates (${detail})`);
  }
  stageDone("render", `${sections.length} chapter(s)`, { chapters: sections.map((id) => ({ id, seconds: renders[id].seconds, gatesOk: renders[id].gatesOk })) });

  const timelines = sections.map((id) => readJson(path.join(P.chDir, id, "chapter.mp4.timeline.json")));

  // ---------------------------------------------------------------- montage (cold-open trailer, plan section 2)
  // only in front of the cold open; a failure is reported (hard gate) but never stops the video
  let montage = null;
  let montageError = null;
  emit("montage", "start");
  if (!a.montage) stageSkip("montage", "--montage off");
  else if (sections[0] !== "cold") stageSkip("montage", "no cold open in this run (--chapters)");
  else {
    try {
      const MT = require("./lib/longform/montage");
      const chs = sections.map((id, i) => ({ id, mp4: path.join(P.chDir, id, "chapter.mp4"), timeline: timelines[i] }));
      let liteGemini = null;
      if (!a.offline) {
        try {
          liteGemini = gemini();
        } catch (_) {
          liteGemini = null;
        }
      }
      montage = await MT.buildMontage({ out, script, dossier, chapters: chs, manifest: readJson(manifestPath), usedSlots: new Set(timelines.flatMap((t) => t.spec.mediaSlots || [])), index: MP.loadIndex(), MP, gemini: liteGemini, lockDir: path.join(out, ".voice.lock"), force: redo("montage"), log, videoId: slug(topic) });
      if (montage.reused) stageSkip("montage", `reusing montage.mp4 (${montage.duration.toFixed(2)} s)`);
      else stageDone("montage", `${montage.duration.toFixed(2)} s, ${montage.plan.cuts} cuts, lines ${montage.linesSource}, music ${montage.music.source}${montage.problems.length ? `; problems: ${montage.problems.join("; ")}` : ""}`);
    } catch (err) {
      montageError = String(err.message).slice(0, 400);
      emit("montage", "fail", { detail: montageError });
      log(`montage: failed (${montageError}); the video continues without it`);
      montage = null;
    }
  }

  // ---------------------------------------------------------------- stitch
  emit("stitch", "start");
  const pads = ST.joinPads(timelines.map((t) => t.timeline), 0.9);
  const stitchJson = path.join(P.stitchDir, "stitch.json");
  const stitched = path.join(P.stitchDir, "stitched.mp4");
  const stitchKey = hash({ keys: sections.map((id) => renders[id].key), pads, montage: montage ? montage.key : null, v: 1 });
  let stitchInfo;
  if (!redo("stitch") && exists(stitched) && exists(stitchJson) && readJson(stitchJson).key === stitchKey) {
    stitchInfo = readJson(stitchJson);
    stageSkip("stitch", `reusing stitched.mp4 (${stitchInfo.duration.toFixed(2)} s)`);
  } else {
    fs.mkdirSync(P.stitchDir, { recursive: true });
    const segs = await pool(sections, 2, (id, i) => ST.makeSegment({ input: path.join(P.chDir, id, "chapter.mp4"), output: path.join(P.stitchDir, `seg-${id}.mp4`), pad: pads[i] }));
    // the montage segment (if any) goes first; chapter starts shift by its length
    const mseg = montage ? await ST.makeSegment({ input: montage.file, output: path.join(P.stitchDir, "seg-montage.mp4"), pad: 0 }) : null;
    const pr = await ST.concatSegments({ segments: [...(mseg ? [mseg.output] : []), ...segs.map((s) => s.output)], output: stitched });
    const sum = segs.reduce((x, s) => x + s.duration, 0) + (mseg ? mseg.duration : 0);
    let t = mseg ? mseg.duration : 0;
    const chapters = sections.map((id, i) => {
      const meta = SL.chapterMeta(script, outline, id);
      const c = { id, title: id === "cold" ? "Intro" : meta.kind === "recap" ? "Recap" : meta.title, index: meta.index, start: Number(t.toFixed(3)), duration: segs[i].duration, pad: segs[i].pad, chapterSeconds: renders[id].seconds };
      t += segs[i].duration;
      return c;
    });
    const drift = Math.abs(pr.duration - sum);
    stitchInfo = { key: stitchKey, duration: pr.duration, sumSegments: Number(sum.toFixed(3)), drift: Number(drift.toFixed(3)), video: pr.video, audio: pr.audio, montage: mseg ? { duration: mseg.duration, key: montage.key } : null, chapters };
    writeJson(stitchJson, stitchInfo);
    if (drift > 0.1) throw new Error(`stitch duration ${pr.duration.toFixed(3)} s differs from the segments' sum ${sum.toFixed(3)} s by ${drift.toFixed(3)} s`);
    stageDone("stitch", `${chapters.length} chapter(s), ${pr.duration.toFixed(2)} s (segments sum ${sum.toFixed(2)} s, pads ${pads.map((p) => p.toFixed(2)).join("/")})`);
  }

  // ---------------------------------------------------------------- master (one music bed + -14 LUFS)
  emit("master", "start");
  fs.mkdirSync(P.finalDir, { recursive: true });
  const video = path.join(P.finalDir, "video.mp4");
  const masterJson = path.join(P.finalDir, "master.json");
  const swell = [];
  // montage head: section music + swells are planned on the chapters only (times relative to the head)
  const mHead = stitchInfo.montage ? stitchInfo.montage.duration : 0;
  sections.forEach((id, i) => {
    const st = stitchInfo.chapters[i].start - mHead;
    (timelines[i].spec.scaffolds || []).filter((s) => s.template === "lfChapter").forEach((s) => swell.push([Number((st + s.t0).toFixed(3)), Number((st + s.t1).toFixed(3))]));
  });
  // music plan (v2 plan section 5): one free-library bed per section, procedural fallback per mood
  let musicPlan = null;
  if (a.music === "auto") {
    const planJson = path.join(P.finalDir, "music-plan.json");
    const tags = MP.sectionTags(sections.map((id) => (script.sections || []).find((x) => x.id === id) || { id }));
    const ix = MP.refreshIndex({ log });
    if (ix.error) log(`music library: ${ix.error}`);
    const index = MP.loadIndex();
    const planKey = hash({ stitchKey, tags, lib: index.tracks.map((t) => [t.id, t.hash, t.credit]), v: 1 });
    const prev = exists(planJson) ? readJson(planJson) : null;
    if (prev && prev.key === planKey && prev.segments.every((x) => x.source !== "library" || exists(x.track.path))) musicPlan = prev;
    else {
      musicPlan = { key: planKey, ...MP.planMusic({ index, chapters: MP.chaptersFromStitch(stitchInfo.chapters.map((c) => ({ ...c, start: Number((c.start - mHead).toFixed(3)) })), timelines), tags, history: MP.readHistory(), videoId: slug(topic) }) };
      writeJson(planJson, musicPlan);
    }
    log(`music plan (${index.tracks.length} library track(s)${index.problems.length ? `; ${index.problems.length} skipped: ${index.problems.slice(0, 3).join("; ")}` : ""}):\n${MP.timelineText(musicPlan)}`);
    MP.planProblems(musicPlan, stitchInfo.duration - mHead).forEach((p) => log(`music plan problem: ${p}`));
  }
  const masterKey = hash({ stitchKey, music: a.music, swell, plan: musicPlan && musicPlan.key, head: mHead });
  let master;
  if (!redo("master") && exists(video) && exists(masterJson) && readJson(masterJson).key === masterKey) {
    master = readJson(masterJson);
    stageSkip("master", "reusing final/video.mp4");
  } else {
    const r = await ST.musicAndMaster({ stitched, workDir: path.join(P.stitchDir, "audio"), output: video, music: musicPlan ? null : a.music, plan: musicPlan, swell, duration: stitchInfo.duration, head: mHead, log });
    const mCredits = montage && stitchInfo.montage ? montage.musicCredits || [] : [];
    master = { key: masterKey, music: a.music, swell, head: mHead, bed: r.bed, stats: r.stats, musicCredits: [...new Set([...mCredits, ...(musicPlan ? musicPlan.credits : [])])] };
    if (musicPlan) MP.recordUsage(musicPlan, slug(topic));
    writeJson(masterJson, master);
    stageDone("master", `I ${r.stats.integratedLufs} LUFS, LRA ${r.stats.loudnessRangeLu} LU, TP ${r.stats.truePeakDbtp} dBTP`);
  }

  // ---------------------------------------------------------------- gates (whole video)
  emit("gates", "start");
  const fin = ST.probe(video);
  // captions: the montage's narrated lines first (montage time = video time), then every chapter at its
  // (montage-shifted) start; YouTube chapters: "Intro" stays at 0:00 and covers the montage too
  const cueChapters = sections.map((id, i) => ({ start: stitchInfo.chapters[i].start, words: timelines[i].timeline.words }));
  if (stitchInfo.montage && montage) cueChapters.unshift(montage.captionChapter);
  const cues = PK.buildCues(cueChapters);
  const ytChapters = stitchInfo.chapters.map((c, i) => ({ id: c.id, title: c.title, start: i === 0 ? 0 : c.start }));
  const gates = [];
  const gate = (name, ok, value, band, hard = true) => gates.push({ name, ok: !!ok, value, band, hard });
  const s = master.stats || {};
  gate("integrated_lufs", s.integratedLufs >= -14.4 && s.integratedLufs <= -13.8, s.integratedLufs, [-14.4, -13.8]);
  gate("true_peak_dbtp", s.truePeakDbtp <= -0.9, s.truePeakDbtp, "<= -0.9");
  gate("loudness_range_lu", s.loudnessRangeLu <= 3.0, s.loudnessRangeLu, "<= 3.0 (whole video, music swells)", false);
  gate("frame_size", fin.video.w === 1920 && fin.video.h === 1080, `${fin.video.w}x${fin.video.h}`, "1920x1080");
  gate("fps", Math.abs(fin.video.fps - 30) < 0.01, fin.video.fps, 30);
  gate("duration_matches_stitch", Math.abs(fin.duration - stitchInfo.duration) <= 0.15, { final: fin.duration, stitched: stitchInfo.duration }, "|final - stitched| <= 0.15 s");
  gate("stitch_drift_s", stitchInfo.drift <= 0.1, stitchInfo.drift, "<= 0.1");
  const cp = PK.cueProblems(cues, fin.duration);
  gate("captions", !cp.length && cues.length > 0, cp.length ? cp.slice(0, 5) : `${cues.length} cues`, "ordered, non-overlapping, inside the video");
  const chp = PK.chapterRules(ytChapters, fin.duration);
  gate("youtube_chapters", !chp.length, chp.length ? chp : ytChapters.map((c) => `${PK.ytTime(c.start)} ${c.title}`), "first at 0:00, >= 3 chapters, each >= 10 s", !partial);
  const chGates = sections.map((id) => {
    const gj = readJson(path.join(P.chDir, id, "gates.json"));
    return { id, ok: gj.ok, fails: (gj.gates || []).filter((g) => g.hard && !g.ok).map((g) => g.name), values: Object.fromEntries((gj.gates || []).map((g) => [g.name, g.value])) };
  });
  if (a.montage && sections[0] === "cold") {
    const MT = require("./lib/longform/montage");
    if (!montage || !stitchInfo.montage) gate("montage", false, montageError || "montage missing from the stitch", "built and stitched (--montage off to skip)");
    else {
      const md = stitchInfo.montage.duration;
      gate("montage_duration_s", md >= MT.BAND.minSeconds && md <= MT.BAND.maxSeconds, md, `${MT.BAND.minSeconds}-${MT.BAND.maxSeconds}`);
      gate("montage_cuts", montage.plan.cuts >= MT.BAND.minCuts, montage.plan.cuts, `>= ${MT.BAND.minCuts}`);
      gate("montage_plan", !montage.problems.length, montage.problems.length ? montage.problems : "ok", "beat-run shot lengths, anchor hold, no blank / sourceless shots");
      // loudness: the montage region vs the rest of the MASTERED video (music under the voice sits a little hotter)
      const lm = MT.integratedLufs(video, { ss: 0, t: md });
      const lr = MT.integratedLufs(video, { ss: md });
      const delta = lm.I !== null && lr.I !== null ? Number((lm.I - lr.I).toFixed(2)) : null;
      gate("montage_loudness_delta_lu", delta !== null && delta >= -1.5 && delta <= 2.5, { montage: lm.I, rest: lr.I, delta }, "-1.5..+2.5 LU vs the rest");
      gate("montage_captions", cues.some((c) => c.start < md), `${cues.filter((c) => c.start < md).length} cue(s) in the montage`, ">= 1 cue for the narrated lines");
    }
  }
  gate("chapter_gates", chGates.every((c) => c.ok), chGates.map((c) => `${c.id}: ${c.ok ? "pass" : "FAIL " + c.fails.join(",")}`), "every chapter passes v3_gates.py (LF band)");
  const gatesOut = { ok: gates.every((g) => !g.hard || g.ok), partial, gates, chapters: chGates };
  writeJson(path.join(P.finalDir, "gates.json"), gatesOut);
  gates.forEach((g) => log(`  gate ${g.ok ? "ok  " : g.hard ? "FAIL" : "warn"} ${g.name}: ${JSON.stringify(g.value)}`));
  if (gatesOut.ok) stageDone("gates", `all hard gates pass${partial ? " (subset: chapter rules soft)" : ""}`);
  else emit("gates", "fail", { detail: gates.filter((g) => g.hard && !g.ok).map((g) => g.name).join(", ") });

  // ---------------------------------------------------------------- package
  emit("package", "start");
  fs.writeFileSync(path.join(P.finalDir, "captions.srt"), PK.srt(cues));
  const manifest = readJson(manifestPath);
  const usedSlots = new Set(timelines.flatMap((t) => t.spec.mediaSlots || []));
  const usedManifest = Object.fromEntries(Object.entries(manifest.slots).filter(([k, e]) => usedSlots.has(k) && e.status !== "fallback" && e.status !== "namecard"));
  const credits = require("./lib/media/resolve").creditsText(usedManifest);
  const musicCredits = master.musicCredits || [];
  fs.writeFileSync(path.join(P.finalDir, "credits.txt"), credits + (musicCredits.length ? `\n\nMusic\n\n${musicCredits.join("\n")}\n` : ""));
  fs.writeFileSync(path.join(P.finalDir, "description.md"), PK.descriptionMd({ outline, dossier, chapters: ytChapters, credits, music: musicCredits, topic }));
  let titles = PK.titleOptions(outline, topic);
  let titleSource = "deterministic";
  if (!a.offline) {
    try {
      const r = await gemini().json(`Write 3 YouTube title options (each <= 70 characters, curiosity-led, no clickbait lies, no ALL CAPS, no emojis) for a ${Math.round(fin.duration / 60)}-minute explainer. Working title: "${outline.title}". Topic: ${topic}. Angle: ${dossier.angle || ""}. Return JSON {"titles": [string, string, string]}.`, { task: "longform.metadata", temperature: 0.8 });
      if (r && Array.isArray(r.titles) && r.titles.length >= 3) {
        titles = r.titles.slice(0, 3).map(String);
        titleSource = "gemini";
      }
    } catch (err) {
      log(`metadata: titles from Gemini unavailable (${String(err.message).slice(0, 120)}); using deterministic variants`);
    }
  }
  while (titles.length < 3) titles.push(`${topic} (explained)`);
  const metadata = {
    topic,
    titles: titles.slice(0, 3),
    titleSource,
    tags: PK.tagsFor(dossier, topic),
    ...PK.alteredContent(usedManifest), // YouTube synthetic-content disclosure (AI-generated images on screen)
    durationSeconds: Number(fin.duration.toFixed(3)),
    frame: `${fin.video.w}x${fin.video.h}@${fin.video.fps}`,
    chapters: ytChapters.map((c) => ({ ...c, timestamp: PK.ytTime(c.start) })),
    partial,
    gatesOk: gatesOut.ok,
    loudness: master.stats,
    files: { video: "video.mp4", captions: "captions.srt", description: "description.md", credits: "credits.txt" },
    generatedAt: new Date().toISOString(),
  };
  writeJson(path.join(P.finalDir, "metadata.json"), metadata);
  stageDone("package", `final/ video.mp4 (${fin.duration.toFixed(1)} s), captions.srt (${cues.length} cues), description.md, credits.txt, metadata.json`, { video, description: path.join(P.finalDir, "description.md"), dir: P.finalDir });

  // ---------------------------------------------------------------- thumbnail (3 variants, never fails the run)
  emit("thumbnail", "start");
  try {
    const TH = require("./lib/longform/thumbnail");
    const thumbsJson = path.join(P.finalDir, "thumbnails.json");
    const thumbKey = hash({ v: TH.VERSION, manifest: usedManifest, title: outline.title, angle: dossier.angle, facts: (dossier.facts || []).map((f) => [f.id, f.value, f.unit, f.confidence]), offline: !!a.offline });
    let thumbs = exists(thumbsJson) ? readJson(thumbsJson) : null;
    const have = thumbs && thumbs.key === thumbKey && (thumbs.variants || []).every((v) => exists(path.join(P.finalDir, v.file)));
    if (have && !redo("thumbnail")) stageSkip("thumbnail", `reusing ${thumbs.variants.map((v) => v.file).join(", ")}`);
    else {
      const mediaReport = path.join(P.mediaDir, "media-report.json");
      const ask = a.offline ? null : (prompt) => gemini().json(prompt, { task: "longform.thumbnail", temperature: 0.7 });
      thumbs = await TH.makeThumbnails({ finalDir: P.finalDir, workDir: path.join(out, "thumbnail"), manifest: { slots: usedManifest }, intents: exists(path.join(P.mediaDir, "intents.json")) ? readJson(path.join(P.mediaDir, "intents.json")) : [], report: exists(mediaReport) ? readJson(mediaReport) : {}, outline, dossier, topic, ask, log });
      thumbs = { key: thumbKey, ...thumbs };
      writeJson(thumbsJson, thumbs);
      stageDone("thumbnail", `${thumbs.variants.map((v) => `${v.file}${v.ok ? "" : " (check fail)"}`).join(", ")}; "${thumbs.title.text}"`, { files: thumbs.variants.map((v) => path.join(P.finalDir, v.file)) });
    }
    metadata.thumbnails = TH.metadataField(thumbs);
    metadata.files.thumbnails = thumbs.variants.map((v) => v.file);
    writeJson(path.join(P.finalDir, "metadata.json"), metadata);
    // thumbnails v2: the licensed face photo needs its credit line too (credits.txt + description.md)
    for (const f of ["credits.txt", "description.md"]) {
      const fp = path.join(P.finalDir, f);
      const add = (thumbs.credits || []).filter((l) => exists(fp) && !fs.readFileSync(fp, "utf-8").includes(l));
      if (add.length) fs.appendFileSync(fp, `\n${add.map((l) => (f.endsWith(".md") ? `- ${l}` : l)).join("\n")}\n`);
    }
  } catch (err) {
    emit("thumbnail", "fail", { detail: String(err.message).slice(0, 300) });
    log(`thumbnail: failed (${String(err.message).slice(0, 300)}); the video package is unaffected`);
  }
  writeJson(path.join(out, "run.json"), { ...run, renders, gatesOk: gatesOut.ok, finishedAt: new Date().toISOString() });
  log(`done: ${video}`);
  return gatesOut.ok ? 0 : 3;
}

main()
  .then((code) => process.exit(code || 0))
  .catch((err) => {
    if (err instanceof Fatal) {
      emit("run", "fail", { fatal: true, detail: err.message });
      process.stderr.write(`[lf] FATAL: ${err.message}\n`);
      process.exit(4);
    }
    emit("run", "fail", { detail: String(err.message).slice(0, 400) });
    process.stderr.write(`[lf] failed: ${err && err.stack ? err.stack : err}\n`);
    process.exit(1);
  });
