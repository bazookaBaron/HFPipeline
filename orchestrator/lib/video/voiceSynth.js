"use strict";

/**
 * Piece 2 step 2: shells out to voice-pipeline/synthesize.py's existing
 * full-synthesis mode (never its --trim-only mode, which belongs to the
 * carousel side's voice-clone upload feature -- synthesize.py itself is not
 * touched here). Contract (voice-pipeline/PHASE4-REPORT.md):
 *   - the LAST non-empty stdout line, on success only, is JSON
 *     {audioPath, timingPath, wordCount, durationSeconds}
 *   - all progress/log output goes to stderr
 *   - non-zero exit + "ERROR: ..." on stderr on any failure, no stdout JSON
 */

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const PYTHON_EXE = "C:\\Repos\\tts-venv\\Scripts\\python.exe";
const VOICE_PIPELINE_DIR = path.resolve(__dirname, "..", "..", "..", "voice-pipeline");
const SYNTHESIZE_SCRIPT = path.join(VOICE_PIPELINE_DIR, "synthesize.py");

/**
 * @param {object} opts
 * @param {string} opts.genText exact narration text for this scene
 * @param {string} opts.outAudio absolute output WAV path
 * @param {string} opts.outTiming absolute output word-timing JSON path
 * @param {number} [opts.speed] speech speed multiplier (--tts-speed passthrough)
 * @param {string} [opts.refAudio] path to a cloned-voice reference clip (control panel upload); falls back to F5-TTS's own built-in default reference voice when omitted
 * @param {string} [opts.refText] exact transcript of refAudio -- required by synthesize.py whenever refAudio is given
 * @param {(msg: string) => void} opts.log
 * @returns {Promise<{audioPath: string, timingPath: string, wordCount: number, durationSeconds: number}>}
 */
function synthesizeScene({ genText, outAudio, outTiming, speed, refAudio, refText, log }) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(SYNTHESIZE_SCRIPT)) {
      reject(new Error(`voice-pipeline/synthesize.py not found at ${SYNTHESIZE_SCRIPT}`));
      return;
    }
    fs.mkdirSync(path.dirname(outAudio), { recursive: true });
    fs.mkdirSync(path.dirname(outTiming), { recursive: true });

    const args = ["synthesize.py", "--gen-text", genText, "--out-audio", outAudio, "--out-timing", outTiming];
    if (speed !== undefined && speed !== null && !Number.isNaN(Number(speed))) {
      args.push("--speed", String(speed));
    }
    if (refAudio && refText) {
      args.push("--ref-audio", refAudio, "--ref-text", refText);
    }

    log(
      `$ ${PYTHON_EXE} synthesize.py --gen-text "<narration, ${genText.split(/\s+/).length} words>" ` +
        `--out-audio ${outAudio} --out-timing ${outTiming}` + (speed != null ? ` --speed ${speed}` : "")
    );

    const child = spawn(PYTHON_EXE, args, { cwd: VOICE_PIPELINE_DIR, windowsHide: true });

    let stdout = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d) => {
      String(d)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => log(`[synthesize.py] ${line}`));
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`synthesize.py exited with code ${code}`));
        return;
      }
      const lastLine = stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .pop();
      try {
        resolve(JSON.parse(lastLine));
      } catch (e) {
        reject(new Error(`Could not parse synthesize.py output: ${lastLine}`));
      }
    });
  });
}

module.exports = { synthesizeScene, VOICE_PIPELINE_DIR };
