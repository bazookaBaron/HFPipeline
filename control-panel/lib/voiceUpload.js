"use strict";

/**
 * Voice-clone reference-upload handling.
 *
 * Checked voice-pipeline/ directly (per the brief: "check for it, don't wait
 * if it's not there yet") before writing this. Findings as of this file's
 * writing:
 *   - voice-pipeline/synthesize.py has an internal `trim_reference_clip()`
 *     helper that auto-trims a reference clip to MAX_REF_SECONDS=12.0s via
 *     ffmpeg -- but it only runs as a side effect of a full F5-TTS + WhisperX
 *     synthesis call (`python synthesize.py --gen-text ... --ref-audio ...`),
 *     which loads the F5-TTS model onto the GPU and is much heavier than a
 *     "trim this upload" action should be.
 *   - There is no standalone trim-only CLI/entrypoint exposed by
 *     voice-pipeline that this control panel can call for a lightweight
 *     "trim on upload" preview.
 *
 * Per the brief's fallback instruction, this is therefore wired as an
 * explicit "not yet wired" stub: we accept and store the upload, probe its
 * duration for display, and tell the operator plainly that trimming will
 * happen once voice-pipeline exposes a standalone trim utility (or once the
 * control panel calls synthesize.py's full pipeline directly, which is a
 * product decision for Phase 7, not something to silently do here).
 */

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { newId, atomicWriteFileSync, readJsonSafe } = require("./util");

const VOICE_PIPELINE_DIR = path.resolve(__dirname, "..", "..", "voice-pipeline");
const UPLOADS_DIR = path.join(__dirname, "..", "data", "uploads");
const STATE_FILE = path.join(__dirname, "..", "data", "uploads", "_last-upload.json");
const PROFILE_FILE = path.join(__dirname, "..", "data", "voice-profile.json");
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const PYTHON = "C:\\Repos\\tts-venv\\Scripts\\python.exe";
const SYNTHESIZE_PY = path.join(VOICE_PIPELINE_DIR, "synthesize.py");

/** voice-pipeline/synthesize.py now really does expose `--trim-only` (a Phase 6 follow-up
 * added it after this module was first written as an honest stub) -- wired for real below. */
function hasStandaloneTrimUtility() {
  return fs.existsSync(SYNTHESIZE_PY);
}

/** Runs `synthesize.py --trim-only` for real and returns the trimmed clip's path + duration.
 * Only meaningful when the source clip is over the 12s target -- callers skip this for
 * already-short clips since trimming them would be a no-op. */
function runTrimOnly(refAudioPath, outPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [SYNTHESIZE_PY, "--trim-only", "--ref-audio", refAudioPath, "--out-audio", outPath], {
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`synthesize.py --trim-only exited ${code}: ${stderr.trim().slice(-500)}`));
        return;
      }
      const lines = stdout.trim().split("\n").filter(Boolean);
      const last = lines[lines.length - 1] || "{}";
      try {
        resolve(JSON.parse(last));
      } catch {
        reject(new Error(`could not parse synthesize.py --trim-only output: ${last}`));
      }
    });
  });
}

function probeDurationSeconds(filePath) {
  return new Promise((resolve) => {
    const ffprobe = spawn(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
      { shell: true, windowsHide: true }
    );
    let out = "";
    ffprobe.stdout.on("data", (d) => (out += d.toString()));
    ffprobe.on("error", () => resolve(null));
    ffprobe.on("close", () => {
      const value = parseFloat(out.trim());
      resolve(Number.isFinite(value) ? value : null);
    });
  });
}

async function handleUpload(filename, buffer, refText) {
  if (!buffer || !buffer.length) {
    const err = new Error("upload is empty");
    err.statusCode = 400;
    throw err;
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    const err = new Error(`upload too large; limit is ${MAX_UPLOAD_BYTES} bytes`);
    err.statusCode = 400;
    throw err;
  }
  const ext = path.extname(filename || "").toLowerCase();
  if (![".wav", ".mp3", ".m4a"].includes(ext)) {
    const err = new Error("choose a .wav, .mp3, or .m4a reference clip");
    err.statusCode = 400;
    throw err;
  }
  const cleanRefText = typeof refText === "string" ? refText.trim() : "";
  if (!cleanRefText) {
    const err = new Error(
      "a reference transcript is required: F5-TTS needs the exact words spoken in the clip to clone the voice correctly"
    );
    err.statusCode = 400;
    throw err;
  }

  const uploadId = newId("voice");
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const storedPath = path.join(UPLOADS_DIR, `${uploadId}${ext}`);
  fs.writeFileSync(storedPath, buffer);

  const durationSeconds = await probeDurationSeconds(storedPath);
  const trimUtilityAvailable = hasStandaloneTrimUtility();
  const needsTrim = durationSeconds != null ? durationSeconds > 12 : false;

  let activeAudioPath = storedPath;
  let trimStatus = "not_needed";
  let trimMessage = "Clip is already at or under 12s; used as-is.";

  if (needsTrim && trimUtilityAvailable) {
    const trimmedPath = path.join(UPLOADS_DIR, `${uploadId}.trimmed.wav`);
    try {
      const trimResult = await runTrimOnly(storedPath, trimmedPath);
      activeAudioPath = trimResult.outputPath || trimmedPath;
      trimStatus = "trimmed";
      trimMessage = `Trimmed from ${trimResult.originalDurationSeconds ?? durationSeconds}s to ${trimResult.outputDurationSeconds ?? "~12"}s via synthesize.py --trim-only.`;
    } catch (e) {
      trimStatus = "trim_failed";
      trimMessage = `Auto-trim failed (${e.message}); using the untrimmed clip. F5-TTS may mispace with references over 12s.`;
    }
  } else if (needsTrim && !trimUtilityAvailable) {
    trimStatus = "not_yet_wired";
    trimMessage = "Clip is over 12s but the trim utility isn't available; using the untrimmed clip as-is.";
  }

  const record = {
    uploadId,
    filename,
    storedPath,
    activeAudioPath,
    refText: cleanRefText,
    bytes: buffer.length,
    durationSeconds,
    targetMaxSeconds: 12,
    needsTrim,
    trimUtilityAvailable,
    trimStatus,
    trimMessage,
    uploadedAt: new Date().toISOString(),
  };
  atomicWriteFileSync(STATE_FILE, JSON.stringify(record, null, 2));

  // This becomes the active voice profile every subsequent video-generation
  // job uses, until replaced by a new upload.
  atomicWriteFileSync(
    PROFILE_FILE,
    JSON.stringify({ refAudioPath: activeAudioPath, refText: cleanRefText, uploadId, setAt: record.uploadedAt }, null, 2)
  );

  return record;
}

function lastUpload() {
  return readJsonSafe(STATE_FILE, null);
}

/** The voice profile every new video-generation job should clone -- null if the operator has
 * never uploaded a reference clip, in which case the orchestrator falls back to F5-TTS's own
 * built-in default reference voice. */
function activeVoiceProfile() {
  return readJsonSafe(PROFILE_FILE, null);
}

module.exports = {
  handleUpload,
  lastUpload,
  activeVoiceProfile,
  hasStandaloneTrimUtility,
  VOICE_PIPELINE_DIR,
  MAX_UPLOAD_BYTES,
};
