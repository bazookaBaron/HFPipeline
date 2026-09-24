#!/usr/bin/env node
"use strict";

/**
 * generate-video-v2.js -- storyboard v2 path (v1 `generate-video.js` is untouched).
 *
 *   storyboard (validated: hosts tile sentences, typed events with word anchors)
 *     -> voice per sentence (F5-TTS + WhisperX, existing voiceSynth)
 *     -> ONE continuous narration timeline (lead silence trimmed, 200 ms sentence gaps)
 *     -> each host mounted once for its whole window, events at their spoken words
 *     -> hyperframes check -> render -> post speed -> <out>.mp4 (+ .timeline.json, .metrics.json)
 *
 * Usage:
 *   node generate-video-v2.js --storyboard sb.json --out out.mp4 [--run-id id] [--speed 1.8]
 *     [--tts-speed 1] [--captions true] [--sfx true] [--mascot true] [--handle @x] [--accent #hex]
 * Same stdout contract as v1: exactly one JSON line on success, nothing on failure.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { synthesizeScene } = require("./lib/video/voiceSynth");
const { buildComposition } = require("./lib/video/composeHtml");
const { checkComposition, renderComposition, VIDEO_ENGINE_DIR } = require("./lib/video/hyperframesCli");
const { speedUpVideo } = require("./lib/video/speedUp");
const { createRunMetrics } = require("./lib/video/runMetrics");
const { planNarration, hostWindows, resolveEvents } = require("./lib/video/v2/timeline");
const { assembleNarration } = require("./lib/video/v2/narration");

// Event ops that get an SFX cue (state changes and arrivals); decorative emphasis does not.
const SFX_OPS = new Set(["reveal", "state", "health", "badge", "traffic", "strike", "draw", "count"]);

function log(msg) {
  process.stderr.write(`[generate-video-v2] ${msg}\n`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

const bool = (v, d) => (v === undefined ? d : String(v).toLowerCase() === "true");

function probeDurationSeconds(file) {
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf-8", windowsHide: true });
    return Number(Number(out.trim()).toFixed(3));
  } catch (_) {
    return null;
  }
}

async function loadValidator() {
  const dist = path.resolve(__dirname, "..", "scripting-pipeline", "dist", "src");
  const sb = await import(require("url").pathToFileURL(path.join(dist, "v2", "storyboard.js")).href);
  const cat = await import(require("url").pathToFileURL(path.join(dist, "componentCatalog.js")).href);
  return { validateStoryboard: sb.validateStoryboard, catalog: cat.loadComponentCatalog() };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sbPath = typeof args.storyboard === "string" ? path.resolve(args.storyboard) : null;
  const outPath = typeof args.out === "string" ? path.resolve(args.out) : null;
  if (!sbPath || !outPath) {
    process.stderr.write("Error: --storyboard and --out are required\n");
    process.exit(1);
  }
  const runId = String(args["run-id"] || `v2-${path.basename(outPath, ".mp4")}`).replace(/[^a-zA-Z0-9_-]/g, "-");
  const rawSpeed = args.speed !== undefined ? Number(args.speed) : 1.8;
  const speed = isFinite(rawSpeed) && rawSpeed > 0 ? Math.min(2.0, Math.max(0.5, rawSpeed)) : 1.8;
  const ttsSpeed = args["tts-speed"] !== undefined ? Number(args["tts-speed"]) : 1.0;
  const captionsOn = bool(args.captions, true);
  const sfxOn = bool(args.sfx, true);
  const mascotOn = bool(args.mascot, true);
  const brandHandle = typeof args.handle === "string" ? args.handle : "";
  const accentColor = typeof args.accent === "string" ? args.accent : "#6ea8fe";

  const metrics = createRunMetrics({ runId, metricsPath: `${outPath}.metrics.json`, config: { contract: "v2", storyboard: sbPath, speed, ttsSpeed, captionsOn, sfxOn, mascotOn } });
  const die = (stage, message, err) => {
    process.stderr.write(`${message}\n`);
    metrics.fail(stage, err || message);
    process.exit(1);
  };

  // ---- 1. storyboard ----
  metrics.start("script");
  let storyboard;
  try {
    const { validateStoryboard, catalog } = await loadValidator();
    const { storyboard: sb, issues } = validateStoryboard(JSON.parse(fs.readFileSync(sbPath, "utf-8")), catalog);
    issues.forEach((i) => log(`storyboard ${i.severity}: [${i.check}] ${i.ref || ""} ${i.message}`));
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length || !sb) return die("script", `storyboard invalid: ${errors.length} error(s)`);
    storyboard = sb;
    metrics.set("counts", { sentences: sb.sentences.length, hosts: sb.hosts.length, events: sb.events.length, warnings: issues.length });
  } catch (err) {
    return die("script", `storyboard load failed: ${err.message}`, err);
  }

  // ---- 2. voice per sentence ----
  metrics.start("voice");
  const assetsDir = path.join(VIDEO_ENGINE_DIR, "assets", "generated", runId);
  fs.mkdirSync(assetsDir, { recursive: true });
  const clips = [];
  for (let i = 0; i < storyboard.sentences.length; i++) {
    const s = storyboard.sentences[i];
    const audioPath = path.join(assetsDir, `s${i + 1}.wav`);
    const timingPath = path.join(assetsDir, `s${i + 1}.timing.json`);
    try {
      const synth = await synthesizeScene({ genText: s.text, outAudio: audioPath, outTiming: timingPath, speed: ttsSpeed, log });
      clips.push({ audioPath, durationSeconds: synth.durationSeconds, words: JSON.parse(fs.readFileSync(timingPath, "utf-8")) });
    } catch (err) {
      return die("voice", `voice failed for ${s.id}: ${err.message}`, err);
    }
  }
  metrics.end({ ttsCalls: clips.length });

  // ---- 3. timeline ----
  metrics.start("compose");
  let plan, windows, events;
  try {
    plan = planNarration(storyboard.sentences, clips);
    windows = hostWindows(storyboard, plan.sentenceTimes, plan.totalSeconds);
    events = resolveEvents(storyboard, plan.words, windows);
  } catch (err) {
    return die("compose", `timeline failed: ${err.message}`, err);
  }
  const narrationRel = `assets/generated/${runId}/narration.wav`;
  try {
    await assembleNarration({ segments: plan.segments, totalSeconds: plan.totalSeconds, outPath: path.join(VIDEO_ENGINE_DIR, narrationRel), log });
  } catch (err) {
    return die("voice", err.message, err);
  }
  metrics.set("duration", { authoredAudioSeconds: plan.totalSeconds, expectedFinalSeconds: Number((plan.totalSeconds / speed).toFixed(3)) });

  const scenes = storyboard.hosts.map((h) => {
    const w = windows.find((x) => x.id === h.id);
    const hostEvents = events.filter((e) => e.host === h.id);
    return {
      componentType: h.component,
      start: w.start,
      durationSeconds: w.duration,
      audioRelPath: "",
      props: {
        ...h.props,
        duration: w.duration,
        timeScale: speed,
        events: JSON.stringify(hostEvents.map((e) => ({ id: e.id, t: e.t, op: e.op, target: e.target || null, value: e.value }))),
      },
      words: plan.words.filter((x) => x.start >= w.start && x.start < w.end).map((x) => ({ word: x.text, start: x.start - w.start, end: x.end - w.start })),
      // Caption emphasis = the words the storyboard made visual (event anchors).
      narrationAnchors: hostEvents.map((e) => ({ anchorText: e.anchor.text, propPath: "" })),
      sfxCueTimes: hostEvents.filter((e) => SFX_OPS.has(e.op)).map((e) => e.t),
    };
  });

  const timelinePath = `${outPath}.timeline.json`;
  fs.writeFileSync(timelinePath, JSON.stringify({ runId, speed, plan, windows, events: events.map(({ id, host, sentence, op, target, value, abs, t, wordIndex, word }) => ({ id, host, sentence, op, target, value, abs, t, wordIndex, word })) }, null, 1));

  const compositionPath = path.join(VIDEO_ENGINE_DIR, "generated", `${runId}.html`);
  fs.mkdirSync(path.dirname(compositionPath), { recursive: true });
  fs.writeFileSync(
    compositionPath,
    buildComposition({ runId, scenes, accentColor, brandHandle, captionsOn, sfxOn, mascotOn, hudStates: [], theme: "dark", topicCategory: "", narrationRelPath: narrationRel }),
    "utf-8"
  );
  log(`composition -> ${compositionPath}; timeline -> ${timelinePath}`);

  // ---- 4. check ----
  metrics.start("check");
  let check;
  try {
    check = await checkComposition(compositionPath, log);
  } catch (err) {
    return die("check", `hyperframes check invocation failed: ${err.message}`, err);
  }
  if (check.code !== 0 || !check.result || check.result.ok !== true) {
    if (check.result) process.stderr.write(JSON.stringify(check.result, null, 2) + "\n");
    return die("check", `hyperframes check failed (exit ${check.code})`);
  }
  metrics.set("counts", { check: Object.fromEntries(["lint", "runtime", "layout", "motion", "contrast"].map((k) => [k, check.result[k] ? check.result[k].errorCount : null])) });

  // ---- 5. render + post speed ----
  metrics.start("render");
  const draftPath = path.join(path.dirname(outPath), `.${path.basename(outPath)}.draft-${runId}.mp4`);
  const rendered = await renderComposition({ compositionRelPath: `generated/${runId}.html`, outputPath: draftPath, quality: "draft" }, log).catch((err) => die("render", err.message, err));
  if (!rendered || rendered.code !== 0 || !fs.existsSync(draftPath)) return die("render", `hyperframes render failed`);
  metrics.set("duration", { draftSeconds: probeDurationSeconds(draftPath) });

  metrics.start("post");
  const sped = await speedUpVideo({ inputPath: draftPath, outputPath: outPath, speed }, log).catch((err) => die("post", err.message, err));
  if (!sped || sped.code !== 0 || !fs.existsSync(outPath)) return die("post", "ffmpeg speed pass failed");
  try {
    fs.unlinkSync(draftPath);
  } catch (_) {}
  metrics.set("duration", { finalSeconds: probeDurationSeconds(outPath) });
  metrics.succeed();
  process.stdout.write(JSON.stringify({ ok: true, outputPath: outPath, timelinePath, metricsPath: `${outPath}.metrics.json`, hosts: scenes.length, events: events.length }) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Unhandled error: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});
