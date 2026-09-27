"use strict";
// Video clips for media intents with kind "video" (LF plan §5).
//
//   acquire  : ffprobe the chosen rendition (remote reads are range requests, polite UA, spaced);
//              a short source (<= 45 s) is stream-copied whole; a long one is sampled at 6 points
//              (remote single-frame grabs), the best frame (vision, else brightness/activity) anchors
//              a 30 s stream-copied excerpt. Nothing is ever fully downloaded when it is long.
//   window   : frames sampled at 4 fps (32x18 grey) give luma + activity; ffmpeg scene detection gives
//              hard cuts; the window (4-12 s, intent.duration or 6 s) has no cut inside, no black or
//              fading frame, and the most motion (pickWindows, pure).
//   vetting  : 3 frames of the window go through the vision rubric (lib/media/vision.js, tier media.vision):
//              no burned subtitles / captions / title cards (heavyText), no logo bug (watermark), on intent.
//   output   : H.264 yuv420p mp4, 30 fps, no audio, CRF 20, +faststart, 1080 or 720 lines (aspect kept,
//              no upscale > 1.5x) + poster (first frame) and last-frame JPEGs.

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { USER_AGENT, sha } = require("./http");
const { dhash } = require("./image");
const { vet, verdictProblems } = require("./vision");

const MAX_BYTES = 200 * 1024 * 1024;
const MIN_SOURCE_DUR = 3;
const MIN_HEIGHT = 480; // card minimum; full-bleed prefers >= 720
const MAX_UPSCALE = 1.5;
const WHOLE_MAX_DUR = 45; // shorter sources are copied whole
const EXCERPT_LEN = 30;
const SAMPLE_FPS = 4;
const SW = 32;
const SH = 18;
const BLACK = 18; // mean luma (0-255) below which a frame may be black...
const BLACK_PEAK = 40; // ...when its bright end (98th percentile) is dark too: night shots with lights are not black
const GATE_LUMA = 10; // the window's first frame must clear the render media gate (mean luma >= 8)
const FADE = 0.7; // edge frame darker than 70 % of the window median = fading
const VIDEO_VERSION = 1; // processing-cache key
const LOGIC_VERSION = 2; // cached rejections from older selection logic are retried

const isRemote = (u) => /^https?:\/\//i.test(String(u));

// ------------------------------------------------------------------ process helpers
function run(bin, args, { maxBuffer = 256 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { windowsHide: true });
    const out = [];
    const err = [];
    let size = 0;
    p.stdout.on("data", (d) => {
      size += d.length;
      if (size <= maxBuffer) out.push(d);
    });
    p.stderr.on("data", (d) => err.push(d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve({ stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString() }) : reject(new Error(`${path.basename(bin)} ${code}: ${Buffer.concat(err).toString().slice(-300)}`))));
    p.stdin.end();
  });
}
const FF = () => process.env.FFMPEG || "ffmpeg";
const FP = () => process.env.FFPROBE || "ffprobe";
const netArgs = (input) => (isRemote(input) ? ["-user_agent", USER_AGENT, "-reconnect", "1", "-reconnect_streamed", "1", "-rw_timeout", "30000000"] : []);

// remote ffmpeg/ffprobe calls are serialised and spaced (each is a handful of range requests)
let remoteChain = Promise.resolve();
let lastRemote = 0;
const REMOTE_GAP = 600;
function remote(fn) {
  const next = remoteChain.then(async () => {
    const wait = lastRemote + REMOTE_GAP - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await fn();
    } finally {
      lastRemote = Date.now();
    }
  });
  remoteChain = next.catch(() => {});
  return next;
}
const maybeRemote = (input, fn) => (isRemote(input) ? remote(fn) : fn());

// ------------------------------------------------------------------ probing / sampling
async function probe(input) {
  const { stdout } = await maybeRemote(input, () =>
    run(FP(), ["-v", "error", ...netArgs(input), "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate,avg_frame_rate,codec_name:stream_tags=rotate:stream_side_data=rotation:format=duration,size,start_time", "-of", "json", input])
  );
  const j = JSON.parse(stdout.toString() || "{}");
  const s = (j.streams || [])[0];
  if (!s) throw new Error("no video stream");
  const rate = (r) => {
    const [a, b] = String(r || "0/1").split("/").map(Number);
    return b ? a / b : a || 0;
  };
  const rot = Math.abs(Number((s.tags && s.tags.rotate) || ((s.side_data_list || []).find((x) => x.rotation != null) || {}).rotation || 0)) % 180 === 90;
  return {
    width: rot ? s.height : s.width,
    height: rot ? s.width : s.height,
    fps: Math.round((rate(s.avg_frame_rate) || rate(s.r_frame_rate)) * 1000) / 1000,
    codec: s.codec_name,
    duration: Number((j.format || {}).duration) || 0,
    bytes: Number((j.format || {}).size) || 0,
  };
}

/** luma + activity (mean abs diff to the previous sample) at SAMPLE_FPS, 32x18 grey */
async function sampleFrames(file, fps = SAMPLE_FPS) {
  const { stdout } = await run(FF(), ["-hide_banner", "-loglevel", "error", "-i", file, "-an", "-sn", "-vf", `fps=${fps},scale=${SW}:${SH}:flags=area,format=gray`, "-f", "rawvideo", "pipe:1"]);
  const n = Math.floor(stdout.length / (SW * SH));
  const times = [];
  const luma = [];
  const peak = [];
  const diff = [];
  for (let i = 0; i < n; i++) {
    const f = stdout.subarray(i * SW * SH, (i + 1) * SW * SH);
    let sum = 0;
    let d = 0;
    for (let k = 0; k < f.length; k++) {
      sum += f[k];
      if (i) d += Math.abs(f[k] - stdout[(i - 1) * SW * SH + k]);
    }
    times.push(i / fps);
    luma.push(sum / f.length);
    peak.push(Array.from(f).sort((x, y) => x - y)[Math.floor(f.length * 0.98)]);
    diff.push(i ? d / f.length : 0);
  }
  if (n > 1) diff[0] = diff[1];
  return { times, luma, diff, peak };
}

/** hard cuts (ffmpeg scene score > threshold), seconds */
async function sceneCuts(file, threshold = 0.3) {
  const { stdout } = await run(FF(), ["-hide_banner", "-loglevel", "error", "-i", file, "-an", "-sn", "-vf", `scale=192:-2,select='gt(scene,${threshold})',metadata=print:file=-`, "-f", "null", "-"]);
  const cuts = [];
  for (const m of stdout.toString().matchAll(/pts_time:([0-9.]+)/g)) cuts.push(Number(m[1]));
  return cuts;
}

/** one frame as JPEG (long edge `w`) */
async function grabFrame(input, t, { w = 768 } = {}) {
  const { stdout } = await maybeRemote(input, () =>
    run(FF(), ["-hide_banner", "-loglevel", "error", ...(t > 0 ? ["-ss", t.toFixed(3)] : []), ...netArgs(input), "-i", input, "-frames:v", "1", "-an", "-vf", `scale='if(gt(iw,ih),min(${w},iw),-2)':'if(gt(iw,ih),-2,min(${w},ih))',format=yuvj420p`, "-q:v", "3", "-f", "image2", "-c:v", "mjpeg", "pipe:1"])
  );
  if (!stdout.length) throw new Error(`no frame at ${t}s`);
  return stdout;
}

async function lastFrame(file, { w } = {}) {
  const vf = w ? `reverse,scale=${w}:-2,format=yuvj420p` : "reverse,format=yuvj420p";
  const { stdout } = await run(FF(), ["-hide_banner", "-loglevel", "error", "-sseof", "-0.5", "-i", file, "-an", "-vf", vf, "-frames:v", "1", "-q:v", "2", "-f", "image2", "-c:v", "mjpeg", "pipe:1"]);
  if (!stdout.length) throw new Error("no last frame");
  return stdout;
}

// ------------------------------------------------------------------ window picking (pure)
const median = (a) => {
  const s = a.slice().sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/**
 * Candidate trim windows, best first, non-overlapping.
 * @param {{duration: number, times: number[], luma: number[], diff: number[], cuts: number[]}} a
 * @param {{len?: number, minLen?: number, step?: number, max?: number, prefer?: number}} o
 * @returns {{start: number, end: number, len: number, score: number, activity: number}[]}
 */
function pickWindows(a, o = {}) {
  const D = a.duration;
  const want = Math.max(4, Math.min(12, Number(o.len) || 6));
  const minLen = o.minLen || MIN_SOURCE_DUR;
  const step = o.step || 0.25;
  const max = o.max || 3;
  const lens = [];
  for (let L = Math.min(want, D - 0.1); L >= minLen - 1e-6; L -= 1) lens.push(Math.round(L * 100) / 100);
  if (!lens.length && D >= minLen) lens.push(Math.round((D - 0.05) * 100) / 100);
  for (const L of lens) {
    const wins = [];
    for (let s = 0; s + L <= D + 1e-6; s += step) {
      const e = s + L;
      if ((a.cuts || []).some((c) => c > s + 0.04 && c < e - 0.04)) continue;
      const idx = [];
      a.times.forEach((t, i) => t >= s - 1e-6 && t <= e + 1e-6 && idx.push(i));
      if (idx.length < 2) continue;
      const lum = idx.map((i) => a.luma[i]);
      const pk = idx.map((i) => (a.peak ? a.peak[i] : 0));
      if (lum.some((l, k) => l < BLACK && pk[k] < BLACK_PEAK)) continue; // a black frame
      if (lum[0] < GATE_LUMA) continue;
      const med = median(lum);
      const medPk = median(pk);
      const fading = (k) => lum[k] < FADE * med && (!a.peak || pk[k] < FADE * medPk);
      if (fading(0) || fading(lum.length - 1)) continue;
      // a cut right at the window start makes the first sample's diff a spike: skip it
      const act = idx.slice(1).reduce((x, i) => x + a.diff[i], 0) / Math.max(1, idx.length - 1);
      let score = Math.min(act, 12);
      if (act < 0.15) score -= 1; // frozen / still image
      if (act > 25) score -= 3; // flicker / shaky
      score -= 0.4 * Math.abs(med - 128) / 128; // well exposed
      if (o.prefer != null) score -= (1.5 * Math.abs(s + L / 2 - o.prefer)) / Math.max(L, 1);
      else score -= (0.3 * Math.abs(s + L / 2 - D / 2)) / Math.max(D, 1);
      wins.push({ start: Math.round(s * 1000) / 1000, end: Math.round(e * 1000) / 1000, len: L, score: Math.round(score * 1000) / 1000, activity: Math.round(act * 100) / 100 });
    }
    wins.sort((x, y) => y.score - x.score);
    const out = [];
    for (const w of wins) {
      if (out.every((o2) => Math.min(o2.end, w.end) - Math.max(o2.start, w.start) <= 0.25 * L)) out.push(w);
      if (out.length >= max) break;
    }
    if (out.length) return out;
  }
  return [];
}

/** output height: 1080 when reachable with <= 1.5x upscale, else 720, else null (too small) */
function targetSize(w, h) {
  if (!w || !h) return null;
  const aspect = w / h;
  let H = h * MAX_UPSCALE >= 1080 ? 1080 : h >= MIN_HEIGHT ? 720 : null;
  if (!H) return null;
  // very wide / tall sources: keep the long edge within 1920 (landscape) or 1080 tall (portrait)
  // 854x480-style sources are 16:9 with rounding: snap so the frame is exactly 1280x720 / 1920x1080
  let W = Math.abs(aspect - 16 / 9) < 0.01 ? Math.round((H * 16) / 9) : Math.round((H * aspect) / 2) * 2;
  if (W > 1920 * 1.34) {
    W = 1920;
    H = Math.round(W / aspect / 2) * 2;
  }
  return { width: W, height: H };
}

// ------------------------------------------------------------------ acquire / transcode
async function excerpt(input, start, len, outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const tmp = outFile + ".part.mkv";
  await maybeRemote(input, () =>
    run(FF(), ["-hide_banner", "-loglevel", "error", "-y", ...(start > 0 ? ["-ss", start.toFixed(3)] : []), ...netArgs(input), "-i", input, "-t", len.toFixed(3), "-map", "0:v:0", "-c", "copy", "-an", "-sn", "-dn", "-avoid_negative_ts", "make_zero", "-fs", String(MAX_BYTES), tmp])
  );
  const size = fs.statSync(tmp).size;
  if (size >= MAX_BYTES - 1024 * 1024) {
    fs.unlinkSync(tmp);
    throw new Error(`excerpt hit the ${MAX_BYTES >> 20} MB cap`);
  }
  fs.renameSync(tmp, outFile);
  return outFile;
}

async function transcode(src, start, len, outFile, size) {
  const vf = `scale=${size.width}:${size.height}:flags=lanczos,fps=30,setsar=1,format=yuv420p`;
  await run(FF(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", start.toFixed(3), "-i", src, "-t", len.toFixed(3),
    "-map", "0:v:0", "-an", "-sn", "-dn", "-vf", vf,
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-map_metadata", "-1", outFile,
  ]);
  return outFile;
}

function workDir(cacheDir) {
  const d = path.join(cacheDir, "_video");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

const FRAME_RUBRIC = "These are frames sampled from ONE video clip. Mark heavyText true if burned-in subtitles, captions, a title card or on-screen lower-third text appear; mark watermark true for any TV channel logo/bug, stock-footage watermark or uploader overlay.";

function videoVerdictOk(verdicts, kind = "video") {
  const hard = verdicts.flatMap((v) => verdictProblems(v, kind).filter((p) => !/^off-intent|^low confidence|^subject incidental/.test(p)));
  const matching = verdicts.filter((v) => v.matches && v.confidence >= 0.6 && !v.incidental).length;
  const problems = [...new Set(hard)];
  if (matching < Math.ceil((verdicts.length * 2) / 3)) problems.push(`off-intent in ${verdicts.length - matching}/${verdicts.length} frames${verdicts[1] && verdicts[1].depicts ? ` (${verdicts[1].depicts})` : ""}`);
  return problems;
}

/**
 * Turn one candidate into a trimmed, vetted clip.
 * @param {object} cand  {fileUrl (rendition; URL or local path), id, ...}
 * @param {object} intent {kind: "video", intent, duration?, size?}
 * @param {{cacheDir, gemini?, useVision?, log?, rubric?, subject?}} ctx
 * @returns {Promise<{ok: true, mp4: Buffer, poster: Buffer, last: Buffer, hash, verdict, meta} | {ok: false, why: string[]}>}
 */
async function processVideo(cand, intent, ctx) {
  const log = ctx.log || (() => {});
  const url = cand.fileUrl;
  const len = Math.max(4, Math.min(12, Number(intent.duration) || 6));
  const wd = workDir(ctx.cacheDir);
  const key = sha(`v${VIDEO_VERSION}|${url}|${len}|${ctx.useVision ? `${intent.intent}|${intent.era || ""}|${ctx.rubric || ""}` : "novision"}`);
  const idxFile = path.join(wd, `${key}.json`);
  if (fs.existsSync(idxFile)) {
    const rec = JSON.parse(fs.readFileSync(idxFile, "utf8"));
    if (!rec.ok && rec.logic === LOGIC_VERSION) return rec;
    const f = (x) => path.join(wd, x);
    if (rec.ok && [rec.mp4, rec.poster, rec.last].every((x) => fs.existsSync(f(x)))) {
      return { ...rec, mp4: fs.readFileSync(f(rec.mp4)), poster: fs.readFileSync(f(rec.poster)), last: fs.readFileSync(f(rec.last)) };
    }
  }
  const remember = (rec, files) => {
    const disk = { ...rec };
    if (files) {
      for (const [k, buf] of Object.entries(files)) {
        const name = `${key}.${k}.${k === "mp4" ? "mp4" : "jpg"}`;
        fs.writeFileSync(path.join(wd, name), buf);
        disk[k] = name;
      }
    }
    fs.writeFileSync(idxFile, JSON.stringify(disk, null, 2));
    return files ? { ...rec, ...files } : rec;
  };
  const fail = (why) => remember({ ok: false, why: [].concat(why), logic: LOGIC_VERSION });

  // 1) probe the rendition
  let info;
  try {
    info = await probe(url);
  } catch (err) {
    return { ok: false, why: [`probe: ${err.message.slice(0, 120)}`] }; // network errors are not cached
  }
  if (info.duration && info.duration < MIN_SOURCE_DUR) return fail(`duration ${info.duration.toFixed(1)} s < ${MIN_SOURCE_DUR} s`);
  const size = targetSize(info.width, info.height);
  if (!size) return fail(`resolution ${info.width}x${info.height} < ${MIN_HEIGHT}p`);

  // 2) acquire a local source (whole short clip, or a 30 s excerpt around the best sampled frame)
  let local;
  let excerptStart = 0;
  let prefer = null;
  try {
    const D = info.duration || WHOLE_MAX_DUR;
    if (D <= WHOLE_MAX_DUR) {
      local = await excerpt(url, 0, D + 1, path.join(wd, `${key}.src.mkv`));
    } else {
      const K = 6;
      const pts = Array.from({ length: K }, (_, k) => Math.round((D * (0.06 + (0.88 * (k + 0.5)) / K)) * 100) / 100);
      const frames = [];
      for (const t of pts) {
        try {
          frames.push({ t, jpg: await grabFrame(url, t, { w: 768 }) });
        } catch (err) {
          log(`  [video] sample ${t}s failed: ${err.message.slice(0, 80)}`);
        }
      }
      if (!frames.length) return { ok: false, why: ["could not sample frames"] };
      let best = frames[Math.floor(frames.length / 2)];
      if (ctx.useVision && ctx.gemini) {
        const items = [];
        for (const f of frames) items.push({ thumb: f.jpg, hash: sha(f.jpg).slice(0, 16) });
        const vs = await vet(items, intent, `${ctx.rubric || intent.intent} ${FRAME_RUBRIC}`, { gemini: ctx.gemini, cacheDir: ctx.cacheDir, subject: ctx.subject });
        const ok = frames.map((f, k) => ({ f, v: vs[k] })).filter((x) => !verdictProblems(x.v, "video").length).sort((a, b) => b.v.confidence - a.v.confidence);
        if (!ok.length) return fail(`no sampled frame passes vision (${vs.map((v) => verdictProblems(v, "video")[0] || "ok").slice(0, 3).join("; ")})`);
        best = ok[0].f;
      }
      excerptStart = Math.max(0, Math.min(D - EXCERPT_LEN, best.t - EXCERPT_LEN / 2));
      prefer = best.t - excerptStart;
      local = await excerpt(url, excerptStart, EXCERPT_LEN, path.join(wd, `${key}.src.mkv`));
    }
  } catch (err) {
    return { ok: false, why: [`acquire: ${err.message.slice(0, 160)}`] };
  }

  try {
    // 3) analyse and pick windows
    const li = await probe(local);
    const s = await sampleFrames(local);
    const cuts = await sceneCuts(local);
    const duration = li.duration || s.times.length / SAMPLE_FPS;
    const wins = pickWindows({ duration, ...s, cuts }, { len, prefer });
    if (!wins.length) return fail(`no clean ${MIN_SOURCE_DUR}-${len} s window (cuts ${cuts.length}, black/fades)`);

    // 4) vet 3 frames of each window (best first) until one passes
    let chosen = null;
    let verdict = null;
    const rejects = [];
    for (const w of wins) {
      const ts = [0.15, 0.5, 0.85].map((f) => w.start + f * w.len);
      const frames = [];
      for (const t of ts) frames.push(await grabFrame(local, t, { w: 768 }));
      const hashes = [];
      for (const f of frames) hashes.push(await dhash(f));
      if (ctx.useVision && ctx.gemini) {
        const vs = await vet(frames.map((f, k) => ({ thumb: f, hash: hashes[k] })), intent, `${ctx.rubric || intent.intent} ${FRAME_RUBRIC}`, { gemini: ctx.gemini, cacheDir: ctx.cacheDir, subject: ctx.subject });
        const p = videoVerdictOk(vs);
        if (p.length) {
          rejects.push(`${w.start}-${w.end}s: ${p.join(", ")}`);
          continue;
        }
        verdict = { ...vs[1], confidence: Math.min(...vs.filter((v) => v.matches).map((v) => v.confidence)), frames: vs.map((v) => ({ matches: v.matches, confidence: v.confidence, depicts: v.depicts })) };
      } else {
        verdict = { matches: true, confidence: 0.5, focal: [0, 0, 1, 1], depicts: "", unvetted: true };
      }
      chosen = w;
      break;
    }
    if (!chosen) return fail(rejects.length ? rejects : ["no window passed"]);

    // 5) transcode + poster + last frame
    const out = path.join(wd, `${key}.tmp.mp4`);
    await transcode(local, chosen.start, chosen.len, out, targetSize(li.width || info.width, li.height || info.height) || size);
    const oi = await probe(out);
    const mp4 = fs.readFileSync(out);
    const poster = await grabFrame(out, 0, { w: 1920 });
    const last = await lastFrame(out);
    const hash = await dhash(poster);
    fs.unlinkSync(out);
    const meta = {
      width: oi.width,
      height: oi.height,
      fps: oi.fps,
      clipDur: Math.round(oi.duration * 1000) / 1000,
      trimIn: Math.round((excerptStart + chosen.start) * 1000) / 1000,
      trimOut: Math.round((excerptStart + chosen.start + chosen.len) * 1000) / 1000,
      trimApprox: excerptStart > 0, // stream-copied excerpts start on the preceding keyframe
      sourceDuration: info.duration,
      sourceWidth: info.width,
      sourceHeight: info.height,
      window: chosen,
      windowsTried: rejects,
      cuts: cuts.length,
    };
    log(`  [video] ${cand.id}: ${meta.trimIn}-${meta.trimOut}s -> ${oi.width}x${oi.height} ${meta.clipDur}s`);
    return remember({ ok: true, hash, verdict, meta }, { mp4, poster, last });
  } catch (err) {
    return { ok: false, why: [`process: ${err.message.slice(0, 160)}`] };
  } finally {
    try {
      fs.unlinkSync(local); // the excerpt is only a working copy
    } catch (_) {}
  }
}

module.exports = {
  processVideo,
  pickWindows,
  targetSize,
  probe,
  sampleFrames,
  sceneCuts,
  grabFrame,
  lastFrame,
  transcode,
  excerpt,
  videoVerdictOk,
  isRemote,
  MAX_BYTES,
  MIN_HEIGHT,
  MIN_SOURCE_DUR,
  FRAME_RUBRIC,
};
