"use strict";

/**
 * Piece 2 step 6: real post-render speed-up. Real user feedback: the delivered
 * blue-green-deployment-v2.mp4 read as "explainer-slow" against fast-paced reference
 * shorts -- the highest-leverage single knob for that isn't more animation density, it's
 * literally playing the finished cut faster. Runs AFTER `hyperframes render` produces a
 * real draft file, as a real ffmpeg pass over the actual rendered frames + mixed audio --
 * never a render-time trick (HyperFrames' own timeline duration/timing stays exactly what
 * the real TTS-measured scene durations produced; only the finished MP4 plays back faster).
 *
 * ffmpeg's `atempo` filter is only valid for a single instance across 0.5-2.0x -- 1.8 fits
 * in one instance, so no chaining is needed. `setpts=PTS/speed` is the matching video-side
 * speed-up (smaller PTS interval = faster playback).
 */

const { spawn } = require("child_process");

/**
 * @param {object} opts
 * @param {string} opts.inputPath real rendered draft mp4 (video+audio already muxed)
 * @param {string} opts.outputPath final sped-up mp4 to write
 * @param {number} opts.speed playback speed multiplier, e.g. 1.8 (must be in (0.5, 2.0] for
 *   a single atempo pass -- see file header comment)
 * @returns {Promise<{code: number, stderr: string}>}
 */
function speedUpVideo({ inputPath, outputPath, speed }, log) {
  return new Promise((resolve, reject) => {
    const filter = `[0:v]setpts=PTS/${speed}[v];[0:a]atempo=${speed}[a]`;
    const args = ["-y", "-i", inputPath, "-filter_complex", filter, "-map", "[v]", "-map", "[a]", outputPath];
    log(`$ ffmpeg ${args.join(" ")}`);
    const child = spawn("ffmpeg", args, { windowsHide: true });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stderr }));
  });
}

module.exports = { speedUpVideo };
