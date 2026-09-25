#!/usr/bin/env node
"use strict";

/**
 * generate-video-v3.js -- the video pipeline (reference-parity DH style; v1/v2 retired to archive/).
 *
 *   storyboard.v3 (sentences + templated scaffolds + word-anchored events)
 *     -> voice per sentence (F5-TTS + WhisperX via voiceSynth; --reuse-voice skips unchanged text)
 *     -> speed solved so the delivered pace hits the reference band (--wpm, default 215; refs 176-221)
 *     -> ONE narration track: lead/tail trimmed, sentence gaps 0.2 s AFTER the tempo change
 *        (ref median 0.18-0.20 s), atempo applied BEFORE rendering so frames are exact
 *     -> compile scaffolds/events against final word times -> stage composition + captions
 *     -> hyperframes check -> render (final speed, no post speed-up) -> master to -14 LUFS
 *
 * Usage: node generate-video-v3.js --storyboard sb.json --out out.mp4 [--run-id id] [--wpm 215]
 *          [--tts-speed 1] [--captions true] [--mascot true] [--reuse-voice true] [--quality looks]
 * stdout: exactly one JSON line on success.
 */

const fs = require("fs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

const { synthesizeScene } = require("./lib/video/voiceSynth");
const { createVoiceService } = require("./lib/video/voiceService");
const { checkComposition, renderComposition, VIDEO_ENGINE_DIR } = require("./lib/video/hyperframesCli");
const { createRunMetrics } = require("./lib/video/runMetrics");
const { planNarration } = require("./lib/video/v3/timeline");
const { assembleNarration } = require("./lib/video/v3/narration");
const { compileStoryboard } = require("./lib/video/v3/compile");
const { buildStageComposition } = require("./lib/video/v3/composeStage");
const { masterVideo } = require("./lib/video/audioMaster");
const { generateStoryboard } = require("./lib/video/v3/storyboardGen");

const SENTENCE_GAP_FINAL = 0.2;

function log(msg) {
  process.stderr.write(`[generate-video-v3] ${msg}\n`);
}
function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const k = argv[i].slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith("--")) a[k] = true;
    else {
      a[k] = n;
      i++;
    }
  }
  return a;
}
const bool = (v, d) => (v === undefined ? d : String(v).toLowerCase() === "true");
function probe(file) {
  try {
    return Number(Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf-8", windowsHide: true }).trim()).toFixed(3));
  } catch (_) {
    return null;
  }
}
function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const c = spawn("ffmpeg", args, { windowsHide: true });
    let err = "";
    c.stderr.on("data", (d) => (err += d.toString()));
    c.on("error", reject);
    c.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-400)}`))));
  });
}

/** speed so that words / final duration = target wpm, with fixed final sentence gaps */
function solveSpeed(plan0, sentences, wpm) {
  const nWords = plan0.words.length;
  const speech = plan0.segments.reduce((a, s) => a + (s.trimEnd - s.trimStart), 0);
  const finalTotal = (nWords / wpm) * 60;
  const gaps = (sentences.length - 1) * SENTENCE_GAP_FINAL;
  const raw = speech / Math.max(1, finalTotal - gaps);
  return { speed: Math.min(2.0, Math.max(0.8, Number(raw.toFixed(4)))), speech, nWords };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let sbPath = typeof args.storyboard === "string" ? path.resolve(args.storyboard) : null;
  const topic = typeof args.topic === "string" ? args.topic : null;
  const outPath = typeof args.out === "string" ? path.resolve(args.out) : null;
  if ((!sbPath && !topic) || !outPath) {
    process.stderr.write("Error: --out and one of --storyboard / --topic are required\n");
    process.exit(1);
  }
  const runId = String(args["run-id"] || `v3-${path.basename(outPath, ".mp4")}`).replace(/[^a-zA-Z0-9_-]/g, "-");
  const wpm = Number(args.wpm || 215);
  const ttsSpeed = args["tts-speed"] !== undefined ? Number(args["tts-speed"]) : 1.0;
  const captionsOn = bool(args.captions, true);
  const mascotOn = bool(args.mascot, true);
  const reuseVoice = bool(args["reuse-voice"], false);
  const quality = typeof args.quality === "string" ? args.quality : "looks";
  // "worker" keeps F5/WhisperX loaded across sentences (Codex C1); "legacy" spawns per sentence.
  const voiceMode = args.voice === "legacy" ? "legacy" : "worker";
  // cloned voice from the control panel (both or neither)
  const refAudio = typeof args["ref-audio"] === "string" && typeof args["ref-text"] === "string" ? path.resolve(args["ref-audio"]) : null;
  const refText = refAudio ? args["ref-text"] : null;
  const accent = typeof args.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(args.accent) ? args.accent : "#4497ff";
  const lengthSeconds = Number(args["length-seconds"]) || 50;

  const metrics = createRunMetrics({ runId, metricsPath: `${outPath}.metrics.json`, config: { contract: "v3", storyboard: sbPath, wpm, ttsSpeed, captionsOn, mascotOn, quality } });
  const die = (stage, message, err) => {
    process.stderr.write(`${message}\n`);
    metrics.fail(stage, err || message);
    process.exit(1);
  };

  metrics.start("script");
  if (topic) {
    // --topic: Gemini storyboard with validation + bounded repair (lib/video/v3/storyboardGen.js);
    // --previous/--problems feed a failed render's gate results back into the repair loop.
    try {
      const readJson = (k) => (typeof args[k] === "string" ? JSON.parse(fs.readFileSync(path.resolve(args[k]), "utf-8")) : undefined);
      const gen = await generateStoryboard(topic, { log, lengthSeconds, previous: readJson("previous"), extraProblems: readJson("problems") });
      sbPath = `${outPath}.storyboard.json`;
      fs.writeFileSync(sbPath, JSON.stringify(gen.storyboard, null, 1));
      metrics.set("script", { topic, attempts: gen.attempts.length, storyboard: sbPath });
    } catch (err) {
      return die("script", `storyboard generation failed: ${err.message}`, err);
    }
  }
  const sb = JSON.parse(fs.readFileSync(sbPath, "utf-8"));
  if (sb.version !== "storyboard.v3") return die("script", `expected storyboard.v3, got ${sb.version}`);
  metrics.set("counts", { sentences: sb.sentences.length, scaffolds: sb.scaffolds.length, events: (sb.events || []).length });

  // ---- voice ----
  metrics.start("voice");
  const assetsDir = path.join(VIDEO_ENGINE_DIR, "assets", "generated", runId);
  fs.mkdirSync(assetsDir, { recursive: true });
  const clips = [];
  const svc = voiceMode === "worker" ? createVoiceService({ log }) : null;
  const synth = async (o) => {
    if (!svc) return synthesizeScene({ ...o, refAudio: refAudio || undefined, refText: refText || undefined, log });
    const req = { genText: o.genText, outAudio: o.outAudio, outTiming: o.outTiming, speed: o.speed };
    if (refAudio) Object.assign(req, { refAudio, refText });
    const r = await svc.synthesize(req);
    return { durationSeconds: r.durationSeconds };
  };
  for (let i = 0; i < sb.sentences.length; i++) {
    const s = sb.sentences[i];
    const audioPath = path.join(assetsDir, `s${i + 1}.wav`);
    const timingPath = path.join(assetsDir, `s${i + 1}.timing.json`);
    const textPath = path.join(assetsDir, `s${i + 1}.txt`);
    const key = JSON.stringify({ text: s.text, ttsSpeed, voice: refAudio || "default" });
    if (reuseVoice && fs.existsSync(audioPath) && fs.existsSync(timingPath) && fs.existsSync(textPath) && fs.readFileSync(textPath, "utf-8") === key) {
      clips.push({ audioPath, durationSeconds: probe(audioPath), words: JSON.parse(fs.readFileSync(timingPath, "utf-8")) });
      log(`reused voice for ${s.id}`);
      continue;
    }
    try {
      const res = await synth({ genText: s.text, outAudio: audioPath, outTiming: timingPath, speed: ttsSpeed });
      fs.writeFileSync(textPath, key, "utf-8");
      clips.push({ audioPath, durationSeconds: res.durationSeconds || probe(audioPath), words: JSON.parse(fs.readFileSync(timingPath, "utf-8")) });
    } catch (err) {
      if (svc) await svc.close().catch(() => {});
      return die("voice", `voice failed for ${s.id}: ${err.message}`, err);
    }
  }
  if (svc) await svc.close().catch(() => {});
  metrics.end({ ttsCalls: clips.length });

  // ---- narration timeline at final speed ----
  metrics.start("compose");
  let timeline, speed;
  const authoredWav = path.join(assetsDir, "narration-authored.wav");
  const narrationRel = `assets/generated/${runId}/narration.wav`;
  try {
    const plan0 = planNarration(sb.sentences, clips, { sentenceGap: 0 });
    const solved = solveSpeed(plan0, sb.sentences, wpm);
    speed = solved.speed;
    const plan = planNarration(sb.sentences, clips, { sentenceGap: SENTENCE_GAP_FINAL * speed });
    await assembleNarration({ segments: plan.segments, totalSeconds: plan.totalSeconds, outPath: authoredWav, log });
    await ffmpeg(["-y", "-v", "error", "-i", authoredWav, "-af", `atempo=${speed}`, "-ar", "24000", "-ac", "1", path.join(VIDEO_ENGINE_DIR, narrationRel)]);
    const k = 1 / speed;
    const r = (x) => Math.round(x * k * 1000) / 1000;
    timeline = {
      speed,
      words: plan.words.map((w) => ({ ...w, start: r(w.start), end: r(w.end) })),
      sentenceTimes: plan.sentenceTimes.map((t) => ({ ...t, start: r(t.start), end: r(t.end), speechStart: r(t.speechStart), speechEnd: r(t.speechEnd) })),
      totalSeconds: Math.max(r(plan.totalSeconds) + 0.6, (probe(path.join(VIDEO_ENGINE_DIR, narrationRel)) || 0) + 0.6),
    };
    timeline.totalSeconds = Math.round(timeline.totalSeconds * 1000) / 1000;
    metrics.set("duration", { authoredSpeechSeconds: Number(solved.speech.toFixed(3)), speed, finalSeconds: timeline.totalSeconds, words: solved.nWords, deliveredWpm: Number(((solved.nWords / timeline.totalSeconds) * 60).toFixed(1)) });
    log(`speed ${speed} -> ${timeline.totalSeconds}s for ${solved.nWords} words`);
  } catch (err) {
    return die("compose", `narration failed: ${err.message}`, err);
  }

  let spec;
  try {
    spec = compileStoryboard(sb, timeline, { mascot: mascotOn });
  } catch (err) {
    return die("compose", `compile failed: ${err.message}`, err);
  }
  const timelinePath = `${outPath}.timeline.json`;
  fs.writeFileSync(timelinePath, JSON.stringify({ runId, speed, timeline, spec }, null, 1));
  const compositionPath = path.join(VIDEO_ENGINE_DIR, "generated", `${runId}.html`);
  fs.mkdirSync(path.dirname(compositionPath), { recursive: true });
  fs.writeFileSync(compositionPath, buildStageComposition({ runId, totalDuration: timeline.totalSeconds, spec, narrationRelPath: narrationRel, words: timeline.words, profile: sb.profile || "DH", accent, captionsOn }), "utf-8");
  log(`composition -> ${compositionPath}`);

  // ---- check ----
  metrics.start("check");
  const check = await checkComposition(compositionPath, log).catch((err) => die("check", err.message, err));
  if (!check || check.code !== 0 || !check.result || check.result.ok !== true) {
    if (check && check.result) process.stderr.write(JSON.stringify(check.result, null, 2).slice(0, 6000) + "\n");
    return die("check", `hyperframes check failed`);
  }
  metrics.set("counts", { check: Object.fromEntries(["lint", "runtime", "layout", "motion", "contrast"].map((k) => [k, check.result[k] ? check.result[k].errorCount : null])) });

  // ---- render at final speed, then master ----
  metrics.start("render");
  const draftPath = path.join(path.dirname(outPath), `.${path.basename(outPath)}.draft-${runId}.mp4`);
  const rendered = await renderComposition({ compositionRelPath: `generated/${runId}.html`, outputPath: draftPath, quality }, log).catch((err) => die("render", err.message, err));
  if (!rendered || rendered.code !== 0 || !fs.existsSync(draftPath)) return die("render", "hyperframes render failed");

  metrics.start("post");
  let mastered;
  try {
    mastered = await masterVideo({ inputPath: draftPath, outputPath: outPath, speed: 1, log });
  } catch (err) {
    return die("post", `mastering failed: ${err.message}`, err);
  }
  try {
    fs.unlinkSync(draftPath);
  } catch (_) {}
  metrics.set("audio", mastered && mastered.stats ? mastered.stats : mastered);
  metrics.set("duration", { deliveredSeconds: probe(outPath) });
  metrics.succeed();
  process.stdout.write(JSON.stringify({ ok: true, outputPath: outPath, timelinePath, metricsPath: `${outPath}.metrics.json`, speed, scaffolds: spec.scaffolds.length, events: spec.events.length }) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Unhandled error: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});
