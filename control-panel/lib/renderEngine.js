"use strict";

/**
 * CS-explainer pipeline runner.
 *
 * Previously this always shelled out directly to `npx hyperframes render` against the fixed
 * video-engine/index.html (Phase 1's hardcoded composition), ignoring `config` entirely --
 * see PHASE6-REPORT.md for why: at the time, neither the orchestrator nor a real Gemini key
 * existed. Both now exist:
 *   - orchestrator/generate-video.js does the real "topic in -> finished CS-explainer video
 *     out" flow (real Gemini script generation against the real 23-component video-engine
 *     catalog, real per-scene F5-TTS + WhisperX narration synthesis, real narration-anchor ->
 *     timestamp resolution, real assembled HyperFrames composition, real `hyperframes check` +
 *     `render`).
 *   - scripting-pipeline/.env holds a real, live GEMINI_API_KEY the orchestrator reads.
 *
 * This file now spawns that orchestrator CLI for real, mapping this job's config (topic,
 * lengthSeconds, accentColor, brandHandle, ttsSpeed, captionsOn, sfxOn) onto its
 * --topic/--length-seconds/--accent/--handle/--tts-speed/--captions/--sfx args, and keeps the
 * same job-log-streaming/status-setting contract this module already had (real stdout/stderr
 * pumped into jobs.appendLog, status set from the child's real exit code AND its final JSON
 * line) -- mirrors lib/carouselEngine.js's own real orchestrator-spawning shape on the carousel
 * side. Function signature is unchanged so server.js/jobs.js don't need to change.
 *
 * accentColor/brandHandle/captionsOn/sfxOn are all real now too: generate-video.js overrides
 * the composition-root `--hf-brand` CSS variable every component already reads (accent),
 * assembles a persistent handle watermark and word-synced captions from the real per-scene
 * narration timing (handle/captions), and places a real synthesized whoosh
 * (video-engine/assets/sfx/whoosh.wav) at each scene boundary (sfx) -- see
 * orchestrator/lib/video/composeHtml.js.
 */

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const jobs = require("./jobs");
const voiceUpload = require("./voiceUpload");

const VIDEO_ENGINE_DIR = path.resolve(__dirname, "..", "..", "video-engine");
const ORCHESTRATOR_DIR = path.resolve(__dirname, "..", "..", "orchestrator");
const ORCHESTRATOR_ENTRY = path.join(ORCHESTRATOR_DIR, "generate-video.js");
const RENDERS_DIR = path.join(__dirname, "..", "data", "renders");

function videoEngineReady() {
  return (
    fs.existsSync(ORCHESTRATOR_ENTRY) &&
    fs.existsSync(path.join(VIDEO_ENGINE_DIR, "index.html")) &&
    fs.existsSync(path.join(ORCHESTRATOR_DIR, "node_modules"))
  );
}

/**
 * Kicks off a real `node generate-video.js` orchestrator run for the CS-explainer pipeline.
 * Resolves when the process exits; job log + status are pushed live via lib/jobs.js as the
 * process runs.
 */
function runCsExplainerRender(jobId, config) {
  const job = jobs.getJob(jobId);
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const outputPath = path.join(RENDERS_DIR, `${jobId}.mp4`);

  if (!videoEngineReady()) {
    jobs.appendLog(
      jobId,
      "stderr",
      `orchestrator or video-engine not fully present yet (checked ${ORCHESTRATOR_ENTRY} and ${VIDEO_ENGINE_DIR}).`
    );
    jobs.setStatus(jobId, "failed", { error: "orchestrator/video-engine missing" });
    return Promise.resolve({ ok: false });
  }

  const topic = (config && config.topic ? String(config.topic) : "").trim();
  if (!topic) {
    jobs.appendLog(jobId, "meta", "No topic provided in config -- cannot generate a real script.");
    jobs.setStatus(jobId, "failed", { error: "config.topic is required for video generation" });
    return Promise.resolve({ ok: false });
  }

  const lengthSeconds = Number(config && config.lengthSeconds) || 60;
  const accentColor = (config && config.accentColor) || undefined;
  const brandHandle = (config && config.brandHandle) || undefined;
  const ttsSpeed = Number(config && config.ttsSpeed) || 1.0;
  const captionsOn = config ? !!config.captionsOn : true;
  // Default true (was false) -- real user feedback: every animation should carry SFX. Still
  // overridable via an explicit config.sfxOn === false from the control-panel UI.
  const sfxOn = config && config.sfxOn !== undefined ? !!config.sfxOn : true;

  const args = [
    "generate-video.js",
    "--topic",
    topic,
    "--length-seconds",
    String(lengthSeconds),
    "--tts-speed",
    String(ttsSpeed),
    "--captions",
    String(captionsOn),
    "--sfx",
    String(sfxOn),
    "--run-id",
    jobId,
    "--out",
    outputPath,
  ];
  if (accentColor) args.push("--accent", accentColor);
  if (brandHandle) args.push("--handle", brandHandle);

  const voiceProfile = voiceUpload.activeVoiceProfile();
  if (voiceProfile && voiceProfile.refAudioPath && voiceProfile.refText && fs.existsSync(voiceProfile.refAudioPath)) {
    args.push("--ref-audio", voiceProfile.refAudioPath, "--ref-text", voiceProfile.refText);
    jobs.appendLog(jobId, "meta", `Using your cloned voice profile (uploaded ${voiceProfile.setAt}) for narration.`);
  } else {
    jobs.appendLog(jobId, "meta", "No voice profile uploaded yet -- using F5-TTS's built-in default reference voice.");
  }

  jobs.appendLog(
    jobId,
    "meta",
    `$ node generate-video.js --topic "${topic}" --length-seconds ${lengthSeconds} --tts-speed ${ttsSpeed} ` +
      `--captions ${captionsOn} --sfx ${sfxOn} --run-id ${jobId} --out ${outputPath}` +
      (accentColor ? ` --accent ${accentColor}` : "") +
      (brandHandle ? ` --handle ${brandHandle}` : "")
  );
  jobs.appendLog(jobId, "meta", `cwd: ${ORCHESTRATOR_DIR}`);
  jobs.setStatus(jobId, "running");

  return new Promise((resolve) => {
    // No `shell: true` here (unlike the npx-based hyperframes calls inside the
    // orchestrator itself): `node` is a real executable Windows can launch
    // directly, and going through cmd.exe would re-tokenize this argv on
    // whitespace, corrupting a multi-word --topic (confirmed empirically --
    // shell:true silently truncated "what a hash table collision is" down to
    // just "what"). Passing an args array without a shell preserves each
    // element as a single argv entry, exactly as intended.
    const child = spawn("node", args, {
      cwd: ORCHESTRATOR_DIR,
      windowsHide: true,
    });

    job.child = child;

    let stdoutTail = ""; // last non-empty stdout line seen so far -- the orchestrator's
    // contract is exactly one final JSON line on stdout, on success only.
    const pump = (stream, name) => {
      let buffer = "";
      stream.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).replace(/\r$/, "");
          buffer = buffer.slice(idx + 1);
          if (line.length) {
            jobs.appendLog(jobId, name, line);
            if (name === "stdout") stdoutTail = line;
          }
        }
      });
      stream.on("end", () => {
        if (buffer.trim().length) jobs.appendLog(jobId, name, buffer.trim());
      });
    };
    pump(child.stdout, "stdout");
    pump(child.stderr, "stderr");

    child.on("error", (err) => {
      jobs.appendLog(jobId, "stderr", `Failed to spawn orchestrator: ${err.message}`);
      jobs.setStatus(jobId, "failed", { error: err.message });
      resolve({ ok: false });
    });

    child.on("close", (code) => {
      if (code !== 0) {
        jobs.appendLog(jobId, "meta", `Orchestrator exited with code ${code}`);
        jobs.setStatus(jobId, "failed", { error: `orchestrator exited with code ${code}` });
        resolve({ ok: false, code });
        return;
      }

      // Cross-check the child's own final JSON line against reality, per the same
      // "real exit code AND final JSON line" contract voice-pipeline/synthesize.py uses.
      let finalJson = null;
      try {
        finalJson = JSON.parse(stdoutTail);
      } catch (_) {
        finalJson = null;
      }

      if (!finalJson || finalJson.ok !== true || !fs.existsSync(outputPath)) {
        jobs.appendLog(
          jobId,
          "meta",
          `Orchestrator exited 0 but did not report a valid success result (parsed: ` +
            `${finalJson ? JSON.stringify(finalJson) : "none"}, output exists: ${fs.existsSync(outputPath)}).`
        );
        jobs.setStatus(jobId, "failed", { error: "orchestrator did not report a valid success result" });
        resolve({ ok: false });
        return;
      }

      const stat = fs.statSync(outputPath);
      jobs.appendLog(jobId, "meta", `Render exited 0. Output: ${outputPath} (${stat.size} bytes)`);
      jobs.setStatus(jobId, "succeeded", {
        result: {
          type: "video",
          path: outputPath,
          bytes: stat.size,
          mediaUrl: `/media/${jobId}.mp4`,
          scenes: finalJson.scenes,
        },
      });
      resolve({ ok: true, outputPath, bytes: stat.size });
    });
  });
}

module.exports = { runCsExplainerRender, videoEngineReady, VIDEO_ENGINE_DIR, RENDERS_DIR };
