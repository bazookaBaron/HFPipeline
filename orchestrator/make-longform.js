#!/usr/bin/env node
"use strict";

/**
 * make-longform.js -- one-click 16:9 long-form video (plan §7, P6).
 *
 *   node make-longform.js --topic "Why Kingfisher went bankrupt" [--minutes 10] [--out dir]
 *     [--from research|data|outline|script|storyboards|media|render|stitch|master|gates|package|thumbnail]
 *     [--chapters "cold,1,3,recap"] [--no-render] [--offline] [--replay <dir>] [--music ambient|lofi|pulse|off]
 *     [--quality looks] [--keep-going]
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
 *   stitch       stitch/seg-<section>.mp4, stitch/stitched.mp4, stitch/stitch.json
 *                                                 uniform re-encode + last-frame/silence pad (~0.9 s voice gap at
 *                                                 every chapter join), concat demuxer (stream copy), durations verified
 *   master       final/video.mp4, final/master.json
 *                                                 ONE continuous music bed over the stitched audio (ducked, +3 dB on
 *                                                 chapter cards), then -14 LUFS / TP <= -1 over the whole video
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
const { pool } = require("./lib/longform/gemini");
const { matchLibrary } = require("./lib/media/library");

const STAGES = ["research", "data", "outline", "script", "storyboards", "media", "render", "stitch", "master", "gates", "package", "thumbnail"];
const RENDER_VERSION = "lf-render.1";

// ------------------------------------------------------------------------------------ helpers
function parseArgs(argv) {
  const a = { minutes: 10, music: "ambient", quality: "looks", sbParallel: 3, renderParallel: 2 };
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
  const KEYED = ["media", "render", "stitch", "master", "thumbnail"];
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
  const ctxFor = (id) => ({ section: sectionOf(id), meta: SL.chapterMeta(script, outline, id), dossier, outline, topic });

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
    const want = SL.sectionHash(sectionOf(id), SL.chapterMeta(script, outline, id));
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
    const { hasSeriesRef } = require("./lib/video/v3/series");
    for (const { id, sb } of chapters) {
      sb.mediaManifest = path.relative(path.join(P.chDir, id), manifestPath).split(path.sep).join("/");
      // chart / map series refs ({series: "S1"}) resolve at compile from data.json (lib/longform/DATA.md)
      if (hasSeriesRef(sb.scaffolds) || hasSeriesRef(sb.events)) sb.dataFile = path.relative(path.join(P.chDir, id), P.data).split(path.sep).join("/");
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
  await mediaStage(redo("media"));
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
    const opts = { music: false, captions: false, endcard, quality: a.quality, v: RENDER_VERSION, ...(sb.dataFile && exists(P.data) ? { data: hash(readJson(P.data).series) } : {}) };
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
      let tail = [];
      const logf = fs.createWriteStream(path.join(dir, "render.log"));
      c.stdout.on("data", (d) => (stdout += d.toString()));
      c.stderr.on("data", (d) => {
        logf.write(d);
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
        resolve({ code, stdout, tail });
      });
    });
    if (res.code !== 0) {
      // a layout / compile failure on the REAL timing is a storyboard problem: feed it back like a gate
      const lay = res.tail.filter((l) => /layout audit failed|compile failed/.test(l)).map((l) => l.replace(/^.*?(layout audit failed|compile failed)/, "$1"));
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

  // ---------------------------------------------------------------- stitch
  emit("stitch", "start");
  const timelines = sections.map((id) => readJson(path.join(P.chDir, id, "chapter.mp4.timeline.json")));
  const pads = ST.joinPads(timelines.map((t) => t.timeline), 0.9);
  const stitchJson = path.join(P.stitchDir, "stitch.json");
  const stitched = path.join(P.stitchDir, "stitched.mp4");
  const stitchKey = hash({ keys: sections.map((id) => renders[id].key), pads, v: 1 });
  let stitchInfo;
  if (!redo("stitch") && exists(stitched) && exists(stitchJson) && readJson(stitchJson).key === stitchKey) {
    stitchInfo = readJson(stitchJson);
    stageSkip("stitch", `reusing stitched.mp4 (${stitchInfo.duration.toFixed(2)} s)`);
  } else {
    fs.mkdirSync(P.stitchDir, { recursive: true });
    const segs = await pool(sections, 2, (id, i) => ST.makeSegment({ input: path.join(P.chDir, id, "chapter.mp4"), output: path.join(P.stitchDir, `seg-${id}.mp4`), pad: pads[i] }));
    const pr = await ST.concatSegments({ segments: segs.map((s) => s.output), output: stitched });
    const sum = segs.reduce((x, s) => x + s.duration, 0);
    let t = 0;
    const chapters = sections.map((id, i) => {
      const meta = SL.chapterMeta(script, outline, id);
      const c = { id, title: id === "cold" ? "Intro" : meta.kind === "recap" ? "Recap" : meta.title, index: meta.index, start: Number(t.toFixed(3)), duration: segs[i].duration, pad: segs[i].pad, chapterSeconds: renders[id].seconds };
      t += segs[i].duration;
      return c;
    });
    const drift = Math.abs(pr.duration - sum);
    stitchInfo = { key: stitchKey, duration: pr.duration, sumSegments: Number(sum.toFixed(3)), drift: Number(drift.toFixed(3)), video: pr.video, audio: pr.audio, chapters };
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
  sections.forEach((id, i) => {
    const st = stitchInfo.chapters[i].start;
    (timelines[i].spec.scaffolds || []).filter((s) => s.template === "lfChapter").forEach((s) => swell.push([Number((st + s.t0).toFixed(3)), Number((st + s.t1).toFixed(3))]));
  });
  const masterKey = hash({ stitchKey, music: a.music, swell });
  let master;
  if (!redo("master") && exists(video) && exists(masterJson) && readJson(masterJson).key === masterKey) {
    master = readJson(masterJson);
    stageSkip("master", "reusing final/video.mp4");
  } else {
    const r = await ST.musicAndMaster({ stitched, workDir: path.join(P.stitchDir, "audio"), output: video, music: a.music, swell, duration: stitchInfo.duration, log });
    master = { key: masterKey, music: a.music, swell, bed: r.bed, stats: r.stats };
    writeJson(masterJson, master);
    stageDone("master", `I ${r.stats.integratedLufs} LUFS, LRA ${r.stats.loudnessRangeLu} LU, TP ${r.stats.truePeakDbtp} dBTP`);
  }

  // ---------------------------------------------------------------- gates (whole video)
  emit("gates", "start");
  const fin = ST.probe(video);
  const cues = PK.buildCues(sections.map((id, i) => ({ start: stitchInfo.chapters[i].start, words: timelines[i].timeline.words })));
  const ytChapters = stitchInfo.chapters.map((c) => ({ id: c.id, title: c.title, start: c.start }));
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
  const usedManifest = Object.fromEntries(Object.entries(manifest.slots).filter(([k, e]) => usedSlots.has(k) && e.status !== "fallback"));
  const credits = require("./lib/media/resolve").creditsText(usedManifest);
  fs.writeFileSync(path.join(P.finalDir, "credits.txt"), credits);
  fs.writeFileSync(path.join(P.finalDir, "description.md"), PK.descriptionMd({ outline, dossier, chapters: ytChapters, credits, topic }));
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
