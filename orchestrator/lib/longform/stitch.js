"use strict";

/**
 * Long-form stitch + final audio (plan §7 steps 9-10).
 *
 * Chapters are rendered separately (generate-video-v3.js, voice + SFX, NO music bed, each mastered).
 * Then:
 *   1. segment: every chapter is re-encoded ONCE with identical parameters (H.264 High yuv420p 30 fps
 *      CRF 18 GOP 60, AAC 48 kHz stereo 192k) and padded with its last frame + silence so the voice
 *      gap across each chapter join is ~0.9 s (pace.js chapterGap);
 *   2. concat demuxer, stream copy (identical params make this exact); durations are verified;
 *   3. music over the whole stitched audio (tools/sfx_mix.py with no cues, ducked under speech, +3 dB
 *      swells on the chapter cards): either a musicPlan.js plan (one library/procedural bed per section,
 *      switching only at section/scene boundaries with a bass drop-out, see tools/music_switch.py) or ONE
 *      continuous procedural bed (--music ambient|lofi|pulse);
 *   4. re-master the whole to -14 LUFS / TP <= -1 dBTP (lib/video/audioMaster.js).
 */

const fs = require("fs");
const path = require("path");
const { spawn, execFileSync, spawnSync } = require("child_process");
const { masterVideo } = require("../video/audioMaster");

const FPS = 30;
const VIDEO_ARGS = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", String(FPS), "-g", "60", "-bf", "2"];
const AUDIO_ARGS = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"];

function ff(args, log) {
  return new Promise((resolve, reject) => {
    if (log) log(`ffmpeg ${args.join(" ").slice(0, 300)}`);
    const c = spawn("ffmpeg", args, { windowsHide: true });
    let err = "";
    c.stderr.on("data", (d) => (err += d.toString()));
    c.on("error", reject);
    c.on("close", (code) => (code === 0 ? resolve(err) : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-600)}`))));
  });
}

/** {duration, video: {w, h, fps, frames, duration}, audio: {rate, channels, duration}} */
function probe(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate,nb_frames,duration,sample_rate,channels", "-of", "json", file], { encoding: "utf-8", windowsHide: true });
  const j = JSON.parse(out);
  const v = (j.streams || []).find((s) => s.codec_type === "video") || {};
  const a = (j.streams || []).find((s) => s.codec_type === "audio") || {};
  const [n, d] = String(v.r_frame_rate || "0/1").split("/").map(Number);
  return {
    duration: Number(j.format && j.format.duration),
    video: { w: v.width, h: v.height, fps: d ? n / d : 0, frames: Number(v.nb_frames) || null, duration: Number(v.duration) },
    audio: { rate: Number(a.sample_rate), channels: a.channels, duration: Number(a.duration) },
  };
}

/**
 * Pad after chapter i so the voice gap across the join is `gap` s: tail silence of chapter i
 * (total - last word end) + pad + lead-in of chapter i+1 (first word start).
 */
function joinPads(timelines, gap = 0.9) {
  return timelines.map((tl, i) => {
    if (i === timelines.length - 1) return 0;
    const words = tl.words || [];
    const tail = tl.totalSeconds - (words.length ? words[words.length - 1].end : 0);
    const nw = timelines[i + 1].words || [];
    const lead = nw.length ? nw[0].start : 0;
    return Math.max(0, Math.round((gap - tail - lead) * FPS) / FPS);
  });
}

/** chapter mp4 -> uniform segment (frame-exact length = video frames + pad) */
async function makeSegment({ input, output, pad = 0, log }) {
  const p = probe(input);
  const vdur = p.video.frames ? p.video.frames / FPS : p.video.duration || p.duration;
  const frames = Math.round((vdur + pad) * FPS);
  const T = frames / FPS;
  const vf = `fps=${FPS},tpad=stop_mode=clone:stop_duration=${(pad + 0.5).toFixed(3)},format=yuv420p`;
  const af = `aresample=48000,apad=whole_dur=${T.toFixed(4)},atrim=0:${T.toFixed(4)},asetpts=N/SR/TB`;
  await ff(["-y", "-v", "error", "-i", input, "-vf", vf, "-af", af, "-frames:v", String(frames), ...VIDEO_ARGS, ...AUDIO_ARGS, "-t", T.toFixed(4), "-movflags", "+faststart", output], log);
  return { output, frames, duration: T, pad };
}

/** concat demuxer, stream copy; returns the probe of the result */
async function concatSegments({ segments, output, log }) {
  const list = output + ".concat.txt";
  fs.writeFileSync(list, segments.map((s) => `file '${path.resolve(s).replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  await ff(["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", output], log);
  return probe(output);
}

/**
 * Lay one continuous bed over the stitched audio and master the whole.
 * @returns {{stats, bed}} master stats (integratedLufs, loudnessRangeLu, truePeakDbtp, ...)
 */
async function musicAndMaster({ stitched, workDir, output, music = "ambient", plan = null, swell = [], duration, head = 0, log = () => {}, python = process.env.SFX_PYTHON || "python" }) {
  fs.mkdirSync(workDir, { recursive: true });
  const fullWav = path.join(workDir, "stitched-audio.wav");
  await ff(["-y", "-v", "error", "-i", stitched, "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", fullWav], log);
  // head > 0: the first `head` s (the cold-open montage, lib/longform/montage.js) carry their own premixed
  // trailer bed; the section music is laid on the rest only (plan / swell times are relative to `head`)
  let voiceWav = fullWav;
  let headWav = null;
  if (head > 0) {
    headWav = path.join(workDir, "head-audio.wav");
    voiceWav = path.join(workDir, "body-audio.wav");
    await ff(["-y", "-v", "error", "-i", fullWav, "-af", `atrim=end=${head.toFixed(4)},asetpts=PTS-STARTPTS`, "-c:a", "pcm_s16le", headWav], log);
    await ff(["-y", "-v", "error", "-i", fullWav, "-af", `atrim=start=${head.toFixed(4)},asetpts=PTS-STARTPTS`, "-c:a", "pcm_s16le", voiceWav], log);
    duration -= head;
  }
  let mixWav = voiceWav;
  let bed = null;
  if (music || plan) {
    const cues = path.join(workDir, "no-cues.json");
    fs.writeFileSync(cues, JSON.stringify({ cues: [] }));
    mixWav = path.join(workDir, "stitched-mix.wav");
    const args = [path.join(__dirname, "..", "..", "tools", "sfx_mix.py"), cues, voiceWav, mixWav, "--duration", String(duration), "--music-stem", path.join(workDir, "music-bed.wav")];
    if (plan) {
      const planFile = path.join(workDir, "music-plan.json");
      fs.writeFileSync(planFile, JSON.stringify(plan, null, 1));
      args.push("--music-plan", planFile);
    } else args.push("--music", music);
    if (swell.length) args.push("--swell", JSON.stringify(swell));
    const r = spawnSync(python, args, { encoding: "utf-8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`music bed failed: ${(r.stderr || "").slice(-600)}`);
    bed = JSON.parse(String(r.stdout).trim().split(/\r?\n/).pop());
    if (plan) log(`music: ${plan.segments.length} bed(s) (${plan.segments.filter((x) => x.source === "library").length} library), switches at ${plan.transitions.map((t) => t.toFixed(1)).join(", ") || "-"} s, ${swell.length} chapter swell(s)`);
    else log(`music: "${music}" bed ${bed.bedDb} dB under the voice, ducked ${bed.duckDb} dB, ${swell.length} chapter swell(s)`);
  }
  if (headWav) {
    const joined = path.join(workDir, "stitched-mix-full.wav");
    await ff(["-y", "-v", "error", "-i", headWav, "-i", mixWav, "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[a]", "-map", "[a]", "-c:a", "pcm_s16le", joined], log);
    mixWav = joined;
    duration += head;
  }
  const premaster = path.join(workDir, "premaster.mp4");
  await ff(["-y", "-v", "error", "-i", stitched, "-i", mixWav, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-t", String(duration), "-movflags", "+faststart", premaster], log);
  let mastered = await masterVideo({ inputPath: premaster, outputPath: output, speed: 1, log });
  for (const req of [-2.5, -3.5]) {
    const tp = mastered && mastered.stats ? mastered.stats.truePeakDbtp : null;
    if (tp === null || tp === undefined || tp <= -1.0) break;
    log(`true peak ${tp} dBTP > -1.0: re-mastering with TP request ${req}`);
    mastered = await masterVideo({ inputPath: premaster, outputPath: output, speed: 1, log, peakRequest: req });
  }
  return { stats: mastered.stats, bed };
}

module.exports = { probe, joinPads, makeSegment, concatSegments, musicAndMaster, FPS, VIDEO_ARGS, AUDIO_ARGS };
