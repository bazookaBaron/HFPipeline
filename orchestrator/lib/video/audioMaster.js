"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

const TARGET = Object.freeze({ I: -14, LRA: 1.5, TP: -1 });

function speedFilters(speed) {
  if (!Number.isFinite(speed) || speed < 0.5 || speed > 2) {
    throw new RangeError("speed must be between 0.5 and 2");
  }
  return speed === 1 ? { video: "null", audio: "anull" } :
    { video: `setpts=PTS/${speed}`, audio: `atempo=${speed}` };
}

function parseLoudnorm(stderr) {
  const matches = [...stderr.matchAll(/\{\s*"input_i"\s*:[\s\S]*?\}/g)];
  if (!matches.length) throw new Error("ffmpeg did not report loudnorm measurements");
  const value = JSON.parse(matches.at(-1)[0]);
  for (const key of ["input_i", "input_tp", "input_lra", "input_thresh", "target_offset"]) {
    if (!Number.isFinite(Number(value[key]))) throw new Error(`invalid loudnorm ${key}`);
  }
  return value;
}

function parseEbur128(stderr) {
  const summaries = [...stderr.matchAll(/Summary:\s*\n([\s\S]*?)(?=\n\s*\[|$)/g)];
  if (!summaries.length) throw new Error("ffmpeg did not report ebur128 summary");
  const summary = summaries.at(-1)[1];
  const integratedLufs = Number(summary.match(/Integrated loudness:[\s\S]*?I:\s*([-+\d.]+) LUFS/)?.[1]);
  const loudnessRangeLu = Number(summary.match(/Loudness range:[\s\S]*?LRA:\s*([-+\d.]+) LU/)?.[1]);
  const truePeakDbtp = Number(summary.match(/True peak:[\s\S]*?Peak:\s*([-+\d.]+) dBFS/)?.[1]);
  if (![integratedLufs, loudnessRangeLu, truePeakDbtp].every(Number.isFinite)) {
    throw new Error("incomplete ebur128 summary");
  }
  return { integratedLufs, loudnessRangeLu, truePeakDbtp };
}

function run(args, log) {
  log?.(`ffmpeg ${args.join(" ")}`);
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", code => resolve({ code, stderr }));
  });
}

function assertSuccess(result, stage) {
  if (result.code !== 0) throw new Error(`${stage} failed (${result.code}): ${result.stderr.slice(-3000)}`);
}

async function silencePercentage(filePath, log) {
  const args = ["-v", "error", "-i", filePath, "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"];
  log?.(`ffmpeg ${args.join(" ")}`);
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { windowsHide: true });
    let pending = Buffer.alloc(0);
    let low = 0, total = 0;
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    child.stdout.on("data", chunk => {
      const data = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      const frameBytes = 320 * 4;
      const end = Math.floor(data.length / frameBytes) * frameBytes;
      for (let offset = 0; offset < end; offset += frameBytes) {
        let sum = 0;
        for (let i = 0; i < 320; i++) {
          const sample = data.readFloatLE(offset + i * 4);
          sum += sample * sample;
        }
        if (sum / 320 < 1e-6) low++;
        total++;
      }
      pending = Buffer.from(data.subarray(end));
    });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(total ? 100 * low / total : 0) : reject(new Error(`silence measurement failed (${code}): ${stderr}`)));
  });
}

/** Speed the finished mix, master to -14 LUFS / <=1.5 LU / -1 dBTP, and measure output. */
async function masterVideo({ inputPath, outputPath, speed = 1, log = () => {}, peakRequest: peakOverride }) {
  if (!inputPath || !outputPath) throw new TypeError("inputPath and outputPath are required");
  if (path.resolve(inputPath).toLowerCase() === path.resolve(outputPath).toLowerCase()) {
    throw new Error("inputPath and outputPath must differ");
  }
  const filters = speedFilters(speed);
  // A stricter loudnorm LRA request leaves room for AAC's post-encode variance.
  const lraRequest = 1;
  // Compress peaks before normalization; loudnorm alone cannot reduce this mix's LRA enough.
  const audioChain = `${filters.audio},acompressor=threshold=0.05:ratio=3:attack=5:release=100`;
  // Allow headroom for AAC's post-encode true-peak overshoot.
  const peakRequest = peakOverride !== undefined ? peakOverride : -1.5;
  const first = await run(["-hide_banner", "-i", inputPath, "-filter_complex",
    `[0:a]${audioChain},loudnorm=I=-14:LRA=${lraRequest}:TP=${peakRequest}:print_format=json[a]`, "-map", "[a]", "-f", "null", "-"], log);
  assertSuccess(first, "loudnorm analysis");
  const measured = parseLoudnorm(first.stderr);
  const videoFilter = speed === 1 ? "" : `[0:v]${filters.video}[v];`;
  const secondFilter = `${videoFilter}[0:a]${audioChain},loudnorm=I=-14:LRA=${lraRequest}:TP=${peakRequest}:measured_I=${measured.input_i}:measured_LRA=${measured.input_lra}:measured_TP=${measured.input_tp}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=json[a]`;
  const videoArgs = speed === 1 ? ["-map", "0:v:0", "-c:v", "copy"] :
    ["-map", "[v]", "-c:v", "libx264", "-crf", "18", "-preset", "medium"];
  const second = await run(["-hide_banner", "-y", "-i", inputPath, "-filter_complex", secondFilter,
    ...videoArgs, "-map", "[a]", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", outputPath], log);
  assertSuccess(second, "master encode");
  const measurement = await run(["-hide_banner", "-nostats", "-i", outputPath, "-map", "0:a:0",
    "-af", "ebur128=peak=true", "-f", "null", "-"], log);
  assertSuccess(measurement, "ebur128 measurement");
  const stats = { ...parseEbur128(measurement.stderr), silenceBelowMinus60Pct: await silencePercentage(outputPath, log), speed, target: TARGET };
  return { code: 0, stats };
}

module.exports = { masterVideo, _test: { speedFilters, parseLoudnorm, parseEbur128, silencePercentage } };
