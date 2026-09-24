"use strict";

/**
 * Assembles the continuous narration WAV from planNarration() segments with one ffmpeg pass:
 * each clip is cut to [trimStart, trimEnd] with 5 ms fades (no clicks at the cut), then placed
 * at its `at` offset with adelay. Silence between sentences is exactly the planned gap, so the
 * audio and the word timeline come from the same numbers.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function assembleNarration({ segments, totalSeconds, outPath, log }) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const args = ["-y", "-v", "error"];
    segments.forEach((s) => args.push("-i", s.audioPath));
    const parts = segments.map((s, i) => {
      const len = Math.max(0.02, s.trimEnd - s.trimStart);
      const delayMs = Math.round(s.at * 1000);
      return (
        `[${i}:a]aformat=sample_rates=24000:channel_layouts=mono,atrim=start=${s.trimStart}:end=${s.trimEnd},asetpts=PTS-STARTPTS,` +
        `afade=t=in:d=0.005,afade=t=out:st=${(len - 0.005).toFixed(3)}:d=0.005,adelay=${delayMs}:all=1[a${i}]`
      );
    });
    const mix = segments.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${segments.length}:normalize=0:dropout_transition=0,atrim=end=${totalSeconds}[out]`;
    args.push("-filter_complex", parts.join(";") + ";" + mix, "-map", "[out]", "-ar", "24000", "-ac", "1", outPath);
    log && log(`$ ffmpeg (assemble narration: ${segments.length} segments -> ${outPath})`);
    const child = spawn("ffmpeg", args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve({ outPath }) : reject(new Error(`narration assembly failed (${code}): ${stderr.slice(-2000)}`))));
  });
}

module.exports = { assembleNarration };
