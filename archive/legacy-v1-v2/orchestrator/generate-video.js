#!/usr/bin/env node
"use strict";

/**
 * generate-video.js — Piece 2: the video orchestrator CLI.
 *
 * Real "topic in -> finished CS-explainer video out" flow:
 *   1. Plan scenes (count + target durations) from --length-seconds, then call the
 *      already-reconciled scripting-pipeline's generateScript() for a real Gemini call
 *      (reject-and-repair against the real 23-component video-engine catalog).
 *   2. Synthesize narration per scene via voice-pipeline/synthesize.py (real F5-TTS +
 *      WhisperX forced alignment), producing real audio + real word-level timestamps.
 *   3. Resolve each scene's narrationAnchors to real seconds from its own word timings,
 *      merge into that component's props alongside its REAL measured audio duration.
 *   4. Assemble a real top-level HyperFrames composition (video-engine/generated/<run-id>.html)
 *      sequencing scenes back-to-back by real audio duration, with per-scene <audio>.
 *   5. Validate with `hyperframes check` (0 errors required), then render with
 *      `hyperframes render` to a draft mp4.
 *   6. Real post-render speed-up (lib/video/speedUp.js): ffmpeg re-encodes the draft at
 *      --speed (default 1.8x, real user feedback that the 1.0x cut read as
 *      "explainer-slow") to the requested --out path.
 *
 * Usage:
 *   node generate-video.js --topic "..." --length-seconds 60 --accent "#6ea8fe" \
 *     --handle "@example" --tts-speed 1.0 --captions true --sfx false --speed 1.8 \
 *     --run-id <id> --out <mp4-path>
 *
 * All progress/log output goes to stderr (mirrors voice-pipeline/synthesize.py's and
 * generate-carousel.js's contract: "last/only stdout line is the machine-readable
 * result, on success only" -- safe for a Node/child-process caller, e.g.
 * control-panel/lib/renderEngine.js, to parse without stdout noise corrupting it). On
 * failure: non-zero exit, a clear stderr message, and NO JSON line printed on stdout.
 */

const fs = require("fs");
const path = require("path");

const { planScenes } = require("./lib/video/scenePlan");
const { generateVideoScript } = require("./lib/video/scriptGen");
const { synthesizeScene } = require("./lib/video/voiceSynth");
const { resolveAnchorTimings } = require("./lib/video/narrationSync");
const { buildComposition, deriveHudStates } = require("./lib/video/composeHtml");
const { checkComposition, renderComposition, VIDEO_ENGINE_DIR } = require("./lib/video/hyperframesCli");
const { speedUpVideo } = require("./lib/video/speedUp");
const { createRunMetrics } = require("./lib/video/runMetrics");
const { execFileSync } = require("child_process");

function log(msg) {
  process.stderr.write(`[generate-video] ${msg}\n`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function parseBool(v, dflt) {
  if (v === undefined) return dflt;
  if (typeof v === "boolean") return v;
  return String(v).trim().toLowerCase() === "true";
}

function probeDurationSeconds(file) {
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
      encoding: "utf-8",
      windowsHide: true,
    });
    return Number(Number(out.trim()).toFixed(3));
  } catch (_) {
    return null;
  }
}

function sanitizeRunId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, "-");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const topic = typeof args.topic === "string" ? args.topic.trim() : "";
  const lengthSeconds = Number(args["length-seconds"]) || 45;
  const accentColor = typeof args.accent === "string" ? args.accent : "#6ea8fe";
  const brandHandle = typeof args.handle === "string" ? args.handle : "@example";
  const ttsSpeed = args["tts-speed"] !== undefined ? Number(args["tts-speed"]) : 1.0;
  const captionsOn = parseBool(args.captions, true);
  // Default true (was false) -- real user feedback: every animation should carry SFX. Still
  // overridable with --sfx false.
  const sfxOn = parseBool(args.sfx, true);
  const mascotOn = parseBool(args.mascot, true);
  const theme = String(args.theme || "dark").trim().toLowerCase() === "light" ? "light" : "dark";
  // Default 1.8x -- real user feedback: the delivered cut read as "explainer-slow" next to
  // fast-paced reference shorts. Clamped to ffmpeg atempo's real single-instance range
  // (0.5-2.0x) since speedUp.js never chains multiple atempo passes.
  const rawSpeed = args.speed !== undefined ? Number(args.speed) : 1.8;
  const speed = isFinite(rawSpeed) && rawSpeed > 0 ? Math.min(2.0, Math.max(0.5, rawSpeed)) : 1.8;
  const refAudio = typeof args["ref-audio"] === "string" ? args["ref-audio"] : undefined;
  const refText = typeof args["ref-text"] === "string" ? args["ref-text"] : undefined;
  const runId = sanitizeRunId(typeof args["run-id"] === "string" ? args["run-id"] : `run-${Date.now()}`);
  const outPath = typeof args.out === "string" ? path.resolve(args.out) : null;

  if (!topic) {
    process.stderr.write("Error: --topic is required\n");
    process.exit(1);
    return;
  }
  if (!outPath) {
    process.stderr.write("Error: --out is required (output mp4 path)\n");
    process.exit(1);
    return;
  }

  const metrics = createRunMetrics({
    runId,
    metricsPath: `${outPath}.metrics.json`,
    config: { topic, lengthSeconds, ttsSpeed, speed, captionsOn, sfxOn, mascotOn, theme, clonedVoice: Boolean(refAudio) },
  });
  // Every failure exit records its stage + failure class before exiting non-zero.
  function die(stage, message, err) {
    process.stderr.write(message.endsWith("\n") ? message : `${message}\n`);
    metrics.fail(stage, err || message);
    process.exit(1);
  }

  log(
    `Run ${runId}: topic="${topic}" lengthSeconds=${lengthSeconds} accent=${accentColor} ` +
      `handle=${brandHandle} ttsSpeed=${ttsSpeed} captions=${captionsOn} sfx=${sfxOn} mascot=${mascotOn} ` +
      `theme=${theme} voice=${refAudio ? "cloned (" + refAudio + ")" : "default F5-TTS reference"}`
  );
  log(
    "Video-quality redesign chrome: persistent mascot (assets/mascot/spongebob.svg) + a status " +
      "HUD bar are now mounted at the composition root alongside bordered, word-emphasized " +
      "captions (emphasis words come from the same real narrationAnchors already used for " +
      "component timing). --hf-brand overrides accent for every component via CSS inheritance. " +
      "sfx places a real synthesized whoosh at each scene boundary. HUD status now runs a real " +
      "state machine derived from the real 7-stage narrative arc (see deriveHudStates in " +
      "composeHtml.js) -- OK during hook/naive, DEGRADED during breaks/complication, DEPLOYING " +
      "during mechanism/refinement, STABLE at the recap."
  );

  // ---- Step 1: plan scenes + real Gemini call ----
  metrics.start("script");
  const scenePlan = planScenes(lengthSeconds);
  log(
    `Step 1/6: planned ${scenePlan.length} scene(s): ` +
      scenePlan.map((s) => `${s.sceneId}(~${s.targetDurationSeconds}s)`).join(", ")
  );

  let script;
  try {
    const result = await generateVideoScript({ topic, scenePlan, log });
    script = result.script;
    metrics.set("counts", { geminiAttempts: result.attempts ? result.attempts.length : null });
  } catch (err) {
    return die("script", `Step 1 (script generation) failed: ${err.message}`, err);
  }
  const plannedSeconds = scenePlan.reduce((sum, s) => sum + s.targetDurationSeconds, 0);
  metrics.set("duration", { requestedSeconds: lengthSeconds, plannedSeconds, plannedScenes: scenePlan.length });
  metrics.set("counts", {
    scenes: script.scenes.length,
    words: script.scenes.reduce((n, s) => n + s.narration.split(/\s+/).filter(Boolean).length, 0),
  });
  metrics.start("voice");
  log(
    `Gemini returned ${script.scenes.length} scene(s): ` +
      script.scenes.map((s) => `${s.sceneId}=${s.componentType}`).join(", ")
  );

  // ---- Step 2+3: synthesize narration per scene, resolve anchors to real timestamps ----
  const assetsDir = path.join(VIDEO_ENGINE_DIR, "assets", "generated", runId);
  fs.mkdirSync(assetsDir, { recursive: true });

  const composedScenes = [];
  let cumulativeStart = 0;

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const audioPath = path.join(assetsDir, `scene-${i + 1}.wav`);
    const timingPath = path.join(assetsDir, `scene-${i + 1}.timing.json`);

    log(
      `Step 2/6: synthesizing narration for ${scene.sceneId} ` +
        `(${scene.narration.split(/\s+/).filter(Boolean).length} words, componentType=${scene.componentType})...`
    );
    let synth;
    try {
      synth = await synthesizeScene({
        genText: scene.narration,
        outAudio: audioPath,
        outTiming: timingPath,
        speed: ttsSpeed,
        refAudio,
        refText,
        log,
      });
    } catch (err) {
      return die("voice", `Step 2 (narration synthesis) failed for ${scene.sceneId}: ${err.message}`, err);
    }
    log(`  ${scene.sceneId}: real durationSeconds=${synth.durationSeconds}, wordCount=${synth.wordCount}`);

    let wordTimings = [];
    try {
      wordTimings = JSON.parse(fs.readFileSync(timingPath, "utf-8"));
    } catch (err) {
      return die("voice", `Could not read/parse timing JSON for ${scene.sceneId}: ${err.message}`, err);
    }

    const timingProps = resolveAnchorTimings(scene, wordTimings, synth.durationSeconds);
    log(
      `  Step 3/6: resolved ${Object.keys(timingProps).length} narration anchor(s) for ${scene.sceneId}: ` +
        `${JSON.stringify(timingProps)}`
    );

    const mergedProps = {
      ...scene.props,
      ...timingProps,
      duration: synth.durationSeconds,
    };

    composedScenes.push({
      componentType: scene.componentType,
      durationSeconds: synth.durationSeconds,
      start: Number(cumulativeStart.toFixed(3)),
      props: mergedProps,
      audioRelPath: `assets/generated/${runId}/scene-${i + 1}.wav`,
      words: wordTimings,
      narrationAnchors: scene.narrationAnchors,
      sceneHeadline: scene.sceneHeadline,
      sceneSubtitle: scene.sceneSubtitle,
    });

    cumulativeStart += synth.durationSeconds;
  }

  const totalDuration = cumulativeStart;
  const leadSilences = composedScenes.map((s) => (s.words.length ? s.words[0].start : null));
  metrics.set("duration", { authoredAudioSeconds: Number(totalDuration.toFixed(3)) });
  metrics.set("counts", { sceneLeadSilenceSeconds: leadSilences });
  metrics.end({ ttsCalls: composedScenes.length });
  metrics.start("compose");
  log(
    `All ${composedScenes.length} scene(s) synthesized. Total real audio duration: ${totalDuration.toFixed(2)}s ` +
      `(requested --length-seconds ${lengthSeconds}).`
  );

  // Real HUD state machine, derived from the real narrative arc (scenePlan's beat text) and
  // the real (TTS-measured) scene start times -- replaces the old single static label.
  const hudStates = deriveHudStates(scenePlan, composedScenes, brandHandle);
  log(`HUD state machine: ${hudStates.length} transition(s): ${JSON.stringify(hudStates)}`);

  // ---- Step 4: assemble composition ----
  const generatedDir = path.join(VIDEO_ENGINE_DIR, "generated");
  fs.mkdirSync(generatedDir, { recursive: true });
  const compositionPath = path.join(generatedDir, `${runId}.html`);
  const compositionRelPath = `generated/${runId}.html`;

  // hudStates isn't populated yet -- Phase 7 (deeper script generation) will have Gemini
  // author a real state-machine tied to the narrative arc. Until then composeHtml.js's own
  // fallback shows one honest static label (brandHandle) rather than fabricating fake
  // narrative-tied status transitions that don't correspond to anything in the actual story.
  const html = buildComposition({
    runId,
    scenes: composedScenes,
    accentColor,
    brandHandle,
    captionsOn,
    sfxOn,
    mascotOn,
    hudStates,
    theme,
    topicCategory: script.topicCategory,
  });
  fs.writeFileSync(compositionPath, html, "utf-8");
  log(`Step 4/6: wrote composition -> ${compositionPath}`);
  metrics.start("check");

  // ---- Step 5: validate then render ----
  log("Step 5/6: validating composition with `hyperframes check` (temporarily standing in for video-engine/index.html)...");
  let checkOutcome;
  try {
    checkOutcome = await checkComposition(compositionPath, log);
  } catch (err) {
    return die("check", `hyperframes check invocation failed: ${err.message}`, err);
  }
  const { code: checkCode, result: checkResult } = checkOutcome;

  if (checkCode !== 0 || !checkResult || checkResult.ok !== true) {
    if (checkResult) process.stderr.write(JSON.stringify(checkResult, null, 2) + "\n");
    return die("check", `hyperframes check failed (exit ${checkCode}). This is a real bug in the assembled composition.`);
  }

  const sections = ["lint", "runtime", "layout", "motion", "contrast"];
  const errorSummary = sections.map((k) => `${k}=${checkResult[k] ? checkResult[k].errorCount : "?"}`).join(", ");
  log(`hyperframes check passed: 0 errors (${errorSummary}).`);
  metrics.start("render");

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const draftPath = path.join(path.dirname(outPath), `.${path.basename(outPath)}.draft-${runId}.mp4`);

  log(`Rendering -> ${draftPath} (composition=${compositionRelPath}, quality=draft)...`);
  let renderOutcome;
  try {
    renderOutcome = await renderComposition({ compositionRelPath, outputPath: draftPath, quality: "draft" }, log);
  } catch (err) {
    return die("render", `hyperframes render invocation failed: ${err.message}`, err);
  }

  if (renderOutcome.code !== 0 || !fs.existsSync(draftPath)) {
    return die("render", `hyperframes render failed (exit ${renderOutcome.code}) or output missing at ${draftPath}`);
  }

  // ---- Step 6: real post-render speed-up (see lib/video/speedUp.js header) ----
  metrics.set("duration", { draftSeconds: probeDurationSeconds(draftPath) });
  metrics.start("post");
  log(`Step 6/6: speeding up ${speed}x -> ${outPath} (real ffmpeg pass over the rendered draft)...`);
  let speedOutcome;
  try {
    speedOutcome = await speedUpVideo({ inputPath: draftPath, outputPath: outPath, speed }, log);
  } catch (err) {
    return die("post", `ffmpeg speed-up invocation failed: ${err.message}`, err);
  }
  if (speedOutcome.code !== 0 || !fs.existsSync(outPath)) {
    process.stderr.write(speedOutcome.stderr.slice(-4000) + "\n");
    return die("post", `ffmpeg speed-up failed (exit ${speedOutcome.code}) or output missing at ${outPath}`);
  }
  try {
    fs.unlinkSync(draftPath);
  } catch (e) {
    log(`Could not remove draft file ${draftPath}: ${e.message}`);
  }

  const stat = fs.statSync(outPath);
  log(`Render complete: ${outPath} (${stat.size} bytes, ${speed}x speed)`);

  const finalSeconds = probeDurationSeconds(outPath);
  metrics.set("duration", {
    finalSeconds,
    finalVsRequestedRatio: finalSeconds ? Number((finalSeconds / lengthSeconds).toFixed(3)) : null,
  });
  metrics.succeed();
  log(
    `Metrics: ${outPath}.metrics.json (` +
      metrics.data.stages.map((s) => `${s.stage}=${(s.wallMs / 1000).toFixed(1)}s`).join(", ") +
      ")"
  );

  const finalResult = {
    ok: true,
    outputPath: outPath,
    scenes: script.scenes.length,
    topic,
    speed,
    metricsPath: `${outPath}.metrics.json`,
  };
  // Exactly one final JSON line on stdout, on success only.
  process.stdout.write(JSON.stringify(finalResult) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Unhandled error: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});
