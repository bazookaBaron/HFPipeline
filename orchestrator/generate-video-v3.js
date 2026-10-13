#!/usr/bin/env node
"use strict";

/**
 * generate-video-v3.js -- the video pipeline (reference-parity DH style; v1/v2 retired to archive/).
 *
 *   storyboard.v3 (sentences + templated scaffolds + word-anchored events)
 *     -> voice per sentence (F5-TTS + WhisperX via voiceSynth; --reuse-voice skips unchanged text)
 *     -> speed solved for the reference syllable rate (5.84 syl/s, lib/video/v3/pace.js); --wpm N forces a fixed words/min
 *     -> ONE narration track: lead/tail trimmed, sentence gaps 0.2 s AFTER the tempo change
 *        (ref median 0.18-0.20 s), atempo applied BEFORE rendering so frames are exact
 *     -> compile scaffolds/events against final word times -> stage composition + captions
 *     -> hyperframes check -> render (final speed, no post speed-up) -> master to -14 LUFS
 *
 * Usage: node generate-video-v3.js --storyboard sb.json --out out.mp4 [--run-id id] [--wpm 215]
 *          [--tts-speed 1] [--captions true] [--mascot true] [--reuse-voice true] [--quality looks]
 *          [--music false|lofi|ambient|pulse]   (synthesized, ducked background bed; default false, LF: ambient)
 *          [--media media-manifest.json]        (LF: slot -> local file + credit; default sb.mediaManifest beside the storyboard)
 *          [--data data.json]                   (data series for {series:"S1"} refs, lib/longform/DATA.md; default sb.dataFile beside the storyboard)
 *          [--voice-lock <dir>]                 (serialize the TTS stage across parallel renders, e.g. make-longform.js chapters)
 * LF (16:9 long-form) differs: relaxed pace (lib/video/v3/pace.js), captions off, music bed on with a swell on
 * chapter cards, lower SFX density, no presenter, the lfEnd ending (brand.json "longform").
 * The output frame is the storyboard's `frame` ({w, h}, default 1080x1920; see lib/video/v3/compile.js).
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
const { mixSfx } = require("./lib/video/v3/sfx");
const { appendEndcard, stripEndcard, captionWords } = require("./lib/video/v3/endcard");
const { pickPromo } = require("./lib/video/v3/promo");
const { masterVideo } = require("./lib/video/audioMaster");
const { generateStoryboard } = require("./lib/video/v3/storyboardGen");

const SENTENCE_GAP_FINAL = 0.2; // shorts; per-profile gaps come from lib/video/v3/pace.js

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
const { countSyllables, solvePace, paceFor, sentenceGaps } = require("./lib/video/v3/pace");

function solveSpeed(plan0, sentences, wpm, gapsTotal) {
  const nWords = plan0.words.length;
  const speech = plan0.segments.reduce((a, s) => a + (s.trimEnd - s.trimStart), 0);
  const finalTotal = (nWords / wpm) * 60;
  const gaps = gapsTotal !== undefined ? gapsTotal : (sentences.length - 1) * SENTENCE_GAP_FINAL;
  const raw = speech / Math.max(1, finalTotal - gaps);
  return { speed: Math.min(2.0, Math.max(0.8, Number(raw.toFixed(4)))), speech, nWords };
}

/** mkdir-based cross-process lock (a dead holder's lock is taken over); returns release() */
async function acquireLock(dir, log) {
  const owner = path.join(dir, "owner.json");
  let waited = false;
  for (;;) {
    try {
      fs.mkdirSync(dir);
      fs.writeFileSync(owner, JSON.stringify({ pid: process.pid, at: Date.now() }));
      const release = () => {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch (_) {}
      };
      process.on("exit", release);
      if (waited) log("voice lock acquired");
      return release;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      let stale = false;
      try {
        const o = JSON.parse(fs.readFileSync(owner, "utf-8"));
        try {
          process.kill(o.pid, 0);
        } catch (_) {
          stale = true;
        }
      } catch (_) {
        stale = fs.existsSync(dir) && Date.now() - fs.statSync(dir).mtimeMs > 10000;
      }
      if (stale) {
        fs.rmSync(dir, { recursive: true, force: true });
        continue;
      }
      if (!waited) log("waiting for the voice lock (another chapter is synthesizing)");
      waited = true;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
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
  let captionsOn = bool(args.captions, true);
  const mascotOn = bool(args.mascot, true);
  const reuseVoice = bool(args["reuse-voice"], false);
  const quality = typeof args.quality === "string" ? args.quality : "looks";
  // "worker" keeps F5/WhisperX loaded across sentences (Codex C1); "legacy" spawns per sentence.
  const voiceMode = args.voice === "legacy" ? "legacy" : "worker";
  // cloned voice from the control panel (both or neither)
  // default: the consent-confirmed "narrator" clone (voice-pipeline/voices/narrator, copied from
  // script-to-video-pipeline); --voice-profile stock uses F5's built-in example voice instead
  let refAudio = typeof args["ref-audio"] === "string" && typeof args["ref-text"] === "string" ? path.resolve(args["ref-audio"]) : null;
  let refText = refAudio ? args["ref-text"] : null;
  if (!refAudio && args["voice-profile"] !== "stock") {
    const dir = path.resolve(__dirname, "..", "voice-pipeline", "voices", typeof args["voice-profile"] === "string" ? args["voice-profile"] : "narrator");
    const prof = fs.existsSync(path.join(dir, "profile.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "profile.json"), "utf-8")) : null;
    if (prof && prof.status === "active" && prof.consent_confirmed && fs.existsSync(path.join(dir, prof.reference_audio))) {
      refAudio = path.join(dir, prof.reference_audio);
      refText = prof.reference_text;
    }
  }
  log(`voice: ${refAudio ? "cloned " + path.basename(path.dirname(refAudio)) + "/" + path.basename(refAudio) : "F5 stock example"}`);
  const accent = typeof args.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(args.accent) ? args.accent : "#4497ff";
  const lengthSeconds = Number(args["length-seconds"]) || 45;

  const metrics = createRunMetrics({ runId, metricsPath: `${outPath}.metrics.json`, config: { contract: "v3", storyboard: sbPath, wpm, ttsSpeed, captionsOn, mascotOn, quality } });
  const die = (stage, message, err) => {
    process.stderr.write(`${message}\n`);
    metrics.fail(stage, err || message);
    process.exit(1);
  };

  metrics.start("script");
  log("stage: storyboard");
  if (topic) {
    // --topic: Gemini storyboard with validation + bounded repair (lib/video/v3/storyboardGen.js);
    // --previous/--problems feed a failed render's gate results back into the repair loop.
    try {
      const readJson = (k) => (typeof args[k] === "string" ? JSON.parse(fs.readFileSync(path.resolve(args[k]), "utf-8")) : undefined);
      const prev = readJson("previous");
      const profile = prev ? prev.profile : typeof args.profile === "string" ? args.profile : "auto";
      const gen = await generateStoryboard(topic, { log, lengthSeconds, profile, previous: prev, extraProblems: readJson("problems") });
      sbPath = `${outPath}.storyboard.json`;
      fs.writeFileSync(sbPath, JSON.stringify(gen.storyboard, null, 1));
      fs.rmSync(`${sbPath}.promo.json`, { force: true }); // a new storyboard gets a new promo pick
      metrics.set("script", { topic, attempts: gen.attempts.length, storyboard: sbPath });
    } catch (err) {
      if (err.last) fs.writeFileSync(`${outPath}.storyboard.failed.json`, JSON.stringify(err.last, null, 1));
      return die("script", `storyboard generation failed: ${err.message}`, err);
    }
  }
  // the fixed channel ending (brand.json) rides after the topic; the saved storyboard stays topic-only
  const sbTopic = stripEndcard(JSON.parse(fs.readFileSync(sbPath, "utf-8")));
  // topic-matched vloombox.in promo scene (our own screen recordings) before the follow card
  let promo = null;
  if (bool(args.endcard, true) && bool(args.promo, false) && sbTopic.profile !== "LF") {
    let gen = null;
    try {
      gen = require("./lib/video/v3/storyboardGen").loadGemini("promo.pick");
    } catch (_) {
      gen = null;
    }
    // the pick is saved beside the storyboard so a re-render (e.g. with a music bed) says the same line
    const promoPath = `${sbPath}.promo.json`;
    if (fs.existsSync(promoPath)) {
      try {
        promo = JSON.parse(fs.readFileSync(promoPath, "utf-8"));
      } catch (_) {
        promo = null;
      }
    }
    if (!promo) {
      promo = await pickPromo(topic || sbTopic.topic || "", { generate: gen, log }).catch((err) => {
        log(`promo skipped: ${err.message}`);
        return null;
      });
      if (promo) fs.writeFileSync(promoPath, JSON.stringify(promo, null, 1));
    }
    if (promo) log(`promo: ${promo.clipId} -- "${promo.line}"`);
  }
  const sb = bool(args.endcard, true) ? appendEndcard(sbTopic, undefined, promo) : sbTopic;
  if (sb.version !== "storyboard.v3") return die("script", `expected storyboard.v3, got ${sb.version}`);
  // storyboard frame (sb.frame, default 1080x1920) rides in the compiled spec; landscape (16:9
  // long-form) has no presenter, so the mascot is off there whatever --mascot says
  const landscape = !!(sb.frame && Number(sb.frame.w) > Number(sb.frame.h));
  if (landscape && mascotOn) log("landscape frame: presenter off");
  const isLF = sb.profile === "LF";
  // LF: burned-in captions off by default (the SRT is uploaded instead, plan D7)
  if (isLF && args.captions === undefined) captionsOn = false;
  // LF media manifest (lib/media): --media, else sb.mediaManifest relative to the storyboard file
  let mediaManifest = null;
  {
    const mp = typeof args.media === "string" ? path.resolve(args.media) : typeof sbTopic.mediaManifest === "string" ? path.resolve(path.dirname(sbPath), sbTopic.mediaManifest) : null;
    if (mp) {
      if (!fs.existsSync(mp)) return die("script", `media manifest not found: ${mp}`);
      mediaManifest = JSON.parse(fs.readFileSync(mp, "utf-8"));
      log(`media manifest: ${mp}`);
    }
  }
  // data series (lib/longform/data.js): --data, else sb.dataFile relative to the storyboard file
  let dataSeries = null;
  {
    const dp = typeof args.data === "string" ? path.resolve(args.data) : typeof sbTopic.dataFile === "string" ? path.resolve(path.dirname(sbPath), sbTopic.dataFile) : null;
    if (dp) {
      if (!fs.existsSync(dp)) return die("script", `data file not found: ${dp}`);
      dataSeries = JSON.parse(fs.readFileSync(dp, "utf-8"));
      log(`data series: ${dp}`);
    }
  }
  const pace = paceFor(sb.profile);
  const gapsFinal = sentenceGaps(sb.sentences, pace);
  const gapsTotal = gapsFinal.reduce((a, g) => a + g, 0);
  metrics.set("counts", { sentences: sb.sentences.length, scaffolds: sb.scaffolds.length, events: (sb.events || []).length });

  // ---- voice ----
  metrics.start("voice");
  log(`stage: voice synthesis (${sb.sentences.length} sentences)`);
  // --voice-lock: one F5 worker at a time across parallel chapter renders (make-longform.js)
  const releaseVoice = typeof args["voice-lock"] === "string" ? await acquireLock(path.resolve(args["voice-lock"]), log) : () => {};
  const assetsDir = path.join(VIDEO_ENGINE_DIR, "assets", "generated", runId);
  fs.mkdirSync(assetsDir, { recursive: true });
  const clips = [];
  const svc = voiceMode === "worker" ? createVoiceService({ log }) : null;
  const voiceStageTimer = svc ? setTimeout(() => svc.abort(new Error("Voice stage exceeded 8 minutes; worker terminated")), 8 * 60 * 1000) : null;
  const synth = async (o) => {
    if (!svc) return synthesizeScene({ ...o, refAudio: refAudio || undefined, refText: refText || undefined, log });
    const req = { genText: o.genText, outAudio: o.outAudio, outTiming: o.outTiming, speed: o.speed };
    if (refAudio) Object.assign(req, { refAudio, refText });
    const r = await svc.synthesize(req);
    return { durationSeconds: r.durationSeconds };
  };
  for (let i = 0; i < sb.sentences.length; i++) {
    const s = sb.sentences[i];
    log(`voice sentence ${i + 1}/${sb.sentences.length}: ${s.id}`);
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
      log(`voice sentence ${i + 1}/${sb.sentences.length} complete`);
    } catch (err) {
      if (voiceStageTimer) clearTimeout(voiceStageTimer);
      if (svc) await svc.close().catch(() => {});
      releaseVoice();
      return die("voice", `voice failed for ${s.id}: ${err.message}`, err);
    }
  }
  if (voiceStageTimer) clearTimeout(voiceStageTimer);
  if (svc) await svc.close().catch(() => {});
  releaseVoice();
  metrics.end({ ttsCalls: clips.length });

  // ---- narration timeline at final speed ----
  metrics.start("compose");
  log("stage: compose and layout");
  let timeline, speed;
  const authoredWav = path.join(assetsDir, "narration-authored.wav");
  const narrationRel = `assets/generated/${runId}/narration.wav`;
  try {
    const plan0 = planNarration(sb.sentences, clips, { sentenceGap: 0 });
    // pace: the reference syllable rate (lib/video/v3/pace.js), wpm clamped to the reference range;
    // an explicit --wpm keeps the old fixed words/min solve
    let solved;
    if (args.wpm) solved = solveSpeed(plan0, sb.sentences, wpm, gapsTotal);
    else {
      const speech = plan0.segments.reduce((a, s) => a + (s.trimEnd - s.trimStart), 0);
      const nSyllables = sb.sentences.reduce((a, s) => a + countSyllables(s.text), 0);
      const p = solvePace({ speech, gaps: gapsTotal, nWords: plan0.words.length, nSyllables, sylPerS: pace.sylPerS, wpmRange: pace.wpmRange, wpm: pace.wpm, sylBand: pace.sylBand });
      solved = { speed: p.speed, speech, nWords: plan0.words.length };
      log(`pace: ${nSyllables} syllables -> ${p.sylPerS.toFixed(2)} syl/s, ${p.wpm.toFixed(0)} wpm (target ${pace.wpm ? `${pace.wpm} wpm, syl band ${pace.sylBand.join("-")}` : `${pace.sylPerS} syl/s`}, ${pace.wpmRange.join("-")} wpm)`);
    }
    speed = solved.speed;
    const plan = planNarration(sb.sentences, clips, { gaps: gapsFinal.map((g) => g * speed) });
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
    spec = compileStoryboard(sb, timeline, { mascot: mascotOn && !landscape, presenter: typeof args.presenter === "string" ? args.presenter : undefined, media: mediaManifest, data: dataSeries });
  } catch (err) {
    return die("compose", `compile failed: ${err.message}`, err);
  }
  // layout gate on the REAL timing (hard): overlaps / overflow / renderer build errors
  try {
    const { auditLayout, describe } = require("./tools/layout_audit");
    const la = await auditLayout({ spec, duration: timeline.totalSeconds, log });
    const bad = la.problems.map((p) => "layout " + describe(p)).concat(la.buildProblems.map((p) => "renderer: " + p));
    if (bad.length) return die("compose", `layout audit failed: ${bad.join(" | ")}`);
  } catch (err) {
    if (/layout audit failed/.test(err.message)) throw err;
    log(`layout audit skipped: ${err.message}`);
  }
  // ---- media gate (hard): sources local, no black first frames, aspect within 2% ----
  {
    const mp = require("./lib/video/v3/media").checkMedia(spec.media, VIDEO_ENGINE_DIR);
    if (mp.length) return die("compose", `media check failed: ${mp.join(" | ")}`);
  }
  // ---- SFX: synthesized cues on every visual change, mixed under the voice (tools/sfx_mix.py) ----
  // --music <lofi|ambient|pulse>: optional synthesized bed (tools/music_bed.py), ducked under the voice; default off
  let audioRel = narrationRel;
  const sfxOn = bool(args.sfx, true);
  // LF: the soft synthesized bed is ON by default (plan §0), "ambient" unless --music says otherwise
  const music = args.music === undefined && isLF ? "ambient" : args.music === true ? "lofi" : typeof args.music === "string" && !/^(false|off|none|)$/i.test(args.music) ? args.music.toLowerCase() : null;
  // LF: the bed swells +3 dB under chapter cards
  const swell = isLF ? spec.scaffolds.filter((s) => s.template === "lfChapter").map((s) => [s.t0, s.t1]) : [];
  if (sfxOn || music) {
    try {
      const mixRel = narrationRel.replace(/narration\.wav$/, "narration-sfx.wav");
      const musicStemWav = music ? path.join(VIDEO_ENGINE_DIR, narrationRel.replace(/narration\.wav$/, "music-bed.wav")) : undefined;
      const sfx = mixSfx({ spec, duration: timeline.totalSeconds, narrationWav: path.join(VIDEO_ENGINE_DIR, narrationRel), outWav: path.join(VIDEO_ENGINE_DIR, mixRel), sfx: sfxOn, music, musicStemWav, swell, log });
      metrics.set("sfx", { cues: sfx.cues.length });
      if (music) metrics.set("music", { preset: music, bedDb: sfx.bedDb, duckDb: sfx.duckDb, monoLossDb: sfx.monoLossDb, stem: musicStemWav });
      audioRel = mixRel;
    } catch (err) {
      return die("compose", err.message, err);
    }
  }
  const timelinePath = `${outPath}.timeline.json`;
  fs.writeFileSync(timelinePath, JSON.stringify({ runId, speed, timeline, spec }, null, 1));
  const compositionPath = path.join(VIDEO_ENGINE_DIR, "generated", `${runId}.html`);
  fs.mkdirSync(path.dirname(compositionPath), { recursive: true });
  fs.writeFileSync(compositionPath, buildStageComposition({ runId, totalDuration: timeline.totalSeconds, spec, narrationRelPath: audioRel, words: captionWords(timeline.words), profile: sb.profile || "DH", accent, captionsOn, captionSkin: typeof args["caption-skin"] === "string" ? args["caption-skin"] : sb.captionSkin }), "utf-8");
  log(`composition -> ${compositionPath}`);

  // ---- check ----
  metrics.start("check");
  log("stage: hyperframes check");
  const check = await checkComposition(compositionPath, log).catch((err) => die("check", err.message, err));
  if (!check || check.code !== 0 || !check.result || check.result.ok !== true) {
    if (check && check.result) process.stderr.write(JSON.stringify(check.result, null, 2).slice(0, 6000) + "\n");
    return die("check", `hyperframes check failed`);
  }
  metrics.set("counts", { check: Object.fromEntries(["lint", "runtime", "layout", "motion", "contrast"].map((k) => [k, check.result[k] ? check.result[k].errorCount : null])) });

  // ---- render at final speed, then master ----
  metrics.start("render");
  log("stage: render");
  const draftPath = path.join(path.dirname(outPath), `.${path.basename(outPath)}.draft-${runId}.mp4`);
  const rendered = await renderComposition({ compositionRelPath: `generated/${runId}.html`, outputPath: draftPath, quality }, log).catch((err) => die("render", err.message, err));
  if (!rendered || rendered.code !== 0 || !fs.existsSync(draftPath)) return die("render", "hyperframes render failed");

  metrics.start("post");
  log("stage: audio/video master");
  let mastered;
  try {
    mastered = await masterVideo({ inputPath: draftPath, outputPath: outPath, speed: 1, log });
    // AAC can overshoot the limiter target; re-master with more headroom until TP <= -1 dBTP (refs -0.5..-1.1)
    for (const req of [-2.5, -3.5]) {
      const tp = mastered && mastered.stats ? mastered.stats.truePeakDbtp : null;
      if (tp === null || tp === undefined || tp <= -1.0) break;
      log(`true peak ${tp} dBTP > -1.0: re-mastering with TP request ${req}`);
      mastered = await masterVideo({ inputPath: draftPath, outputPath: outPath, speed: 1, log, peakRequest: req });
    }
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
