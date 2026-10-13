"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");
const { insidePath, atomicWriteFileSync } = require("./util");

const REPO = path.resolve(__dirname, "..", "..");
const RENDERS = path.join(REPO, "control-panel", "data", "renders");
const ORCHESTRATOR = path.join(REPO, "orchestrator");
const COVER_VERSION = "reel-frame-cover.v3";
const pending = new Map();

function assetVersion(input) {
  const sourceStat = fs.statSync(input.source);
  const hash = crypto.createHash("sha256").update(`${COVER_VERSION}:${sourceStat.size}:${sourceStat.mtimeMs}`);
  const files = input.kind === "image-set" ? fs.readdirSync(input.asset).filter((name) => /^slide-\d+.*\.png$/i.test(name)).sort().map((name) => path.join(input.asset, name)) : [input.asset];
  for (const file of files) {
    const stat = fs.statSync(file);
    hash.update(`${path.basename(file)}:${stat.size}:${stat.mtimeMs};`);
  }
  return hash.digest("hex").slice(0, 16);
}

function inputFor(run, platform) {
  if (run.status !== "succeeded" || !run.result?.path) throw Object.assign(new Error("Only completed assets can be prepared for publishing"), { statusCode: 409 });
  if (!["youtube", "instagram"].includes(platform)) throw Object.assign(new Error("Unsupported platform"), { statusCode: 400 });
  if (platform === "youtube" && run.result.type !== "video") throw Object.assign(new Error("Only videos can be uploaded to YouTube"), { statusCode: 400 });
  const asset = insidePath(run.result.path, RENDERS);
  const source = run.result.type === "video" ? `${asset}.storyboard.json` : path.join(asset, "content.json");
  if (!fs.existsSync(asset) || !fs.existsSync(source)) throw Object.assign(new Error("Rendered asset or script is missing"), { statusCode: 404 });
  const outputDir = insidePath(run.result.type === "video" ? `${asset}.publish/${platform}` : path.join(asset, "publish", platform), RENDERS);
  return { asset, source, outputDir, kind: run.result.type };
}

function metadataFromWorker({ platform, source, topic }) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["make-publish-metadata.js", "--platform", platform, "--source", source, "--topic", topic], { cwd: ORCHESTRATOR, windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill(), 90000);
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("error", (err) => { clearTimeout(timeout); reject(err); });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(`Metadata generation failed: ${stderr.trim().slice(-500) || `exit ${code}`}`));
      try { resolve(JSON.parse(stdout.trim().split(/\r?\n/).pop())); }
      catch (_) { reject(new Error("Metadata generator did not return valid JSON")); }
    });
  });
}

function wrapTitle(value, width) {
  const words = String(value).trim().split(/\s+/);
  const lines = [];
  for (const word of words) {
    const current = lines.length - 1;
    if (current >= 0 && `${lines[current]} ${word}`.length <= width) lines[current] += ` ${word}`;
    else lines.push(word);
  }
  if (!lines.length || lines.length > 4 || lines.some((line) => line.length > width + 4)) {
    throw new Error("Thumbnail headline is too long; regenerate a shorter headline");
  }
  return lines;
}

function chooseGraphicFrame(assetPath) {
  const probe = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", assetPath], { encoding: "utf8", timeout: 10000, windowsHide: true });
  if (probe.status !== 0) throw new Error(`Could not inspect reel for thumbnail: ${probe.stderr}`);
  const info = JSON.parse(probe.stdout);
  const width = Number(info.streams?.[0]?.width);
  const height = Number(info.streams?.[0]?.height);
  const duration = Number(info.format?.duration);
  if (!width || !height || !duration) throw new Error("Reel geometry or duration is unavailable for thumbnail selection");
  const cropY = Math.round(height * 0.14);
  const cropH = Math.min(height - cropY, Math.round(height * 0.57));
  let best = null;
  for (const fraction of [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75]) {
    const time = Math.min(duration - 0.1, duration * fraction);
    const frame = spawnSync("ffmpeg", ["-v", "error", "-ss", time.toFixed(3), "-i", assetPath, "-vf", `crop=${width}:${cropH}:0:${cropY},scale=64:64`, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { timeout: 10000, windowsHide: true, maxBuffer: 200000 });
    if (frame.status !== 0 || frame.stdout.length !== 64 * 64 * 3) continue;
    let chroma = 0;
    let lit = 0;
    let edges = 0;
    for (let i = 0; i < frame.stdout.length; i += 3) {
      const r = frame.stdout[i], g = frame.stdout[i + 1], b = frame.stdout[i + 2];
      const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
      if (hi > 35) lit++;
      if (hi > 65 && hi - lo > 30) chroma++;
      if (i >= 3 && Math.abs(r - frame.stdout[i - 3]) + Math.abs(g - frame.stdout[i - 2]) + Math.abs(b - frame.stdout[i - 1]) > 100) edges++;
    }
    const score = 5 * chroma + lit + 0.4 * edges;
    if (!best || score > best.score) best = { time, width, height, cropY, cropH, score };
  }
  if (!best || best.score < 75) throw new Error("No frame with enough explanatory graphics was found for a thumbnail");
  return best;
}

async function renderCover(metadata, platform, outputDir, assetPath) {
  if (!assetPath || !fs.existsSync(assetPath)) throw new Error("A rendered reel is required for a graphic thumbnail");
  const picked = chooseGraphicFrame(assetPath);
  const landscape = platform === "youtube";
  const width = landscape ? 1280 : 1080;
  const height = landscape ? 720 : 1920;
  const file = path.join(outputDir, landscape ? "thumbnail.png" : "cover.png");
  fs.mkdirSync(outputDir, { recursive: true });
  const lines = wrapTitle(metadata.thumbnailText || metadata.title, landscape ? 16 : 17);
  lines.forEach((line, i) => fs.writeFileSync(path.join(outputDir, `headline-${i}.txt`), line, "utf8"));
  const graphicW = landscape ? 600 : 980;
  const graphicH = Math.round(graphicW * picked.cropH / picked.width);
  const graphicX = landscape ? 640 : 50;
  const graphicY = landscape ? Math.round((height - graphicH) / 2) : 625;
  const filters = [
    `drawbox=x=${graphicX - 9}:y=${graphicY - 9}:w=${graphicW + 18}:h=${graphicH + 18}:color=0x43d9eb:t=3`,
    `drawbox=x=72:y=${landscape ? 118 : 122}:w=${landscape ? 170 : 250}:h=9:color=0xffcd4b:t=fill`,
    `drawtext=text=TECH EXPLAINED:font=Arial:fontsize=${landscape ? 26 : 42}:fontcolor=0x56dded:x=72:y=${landscape ? 75 : 178}`,
  ];
  const fontSize = landscape ? 68 : lines.length <= 2 ? 100 : lines.length === 3 ? 80 : 64;
  const lineHeight = landscape ? 83 : lines.length <= 2 ? 120 : lines.length === 3 ? 95 : 75;
  const top = landscape ? 195 : 285;
  lines.forEach((_, i) => filters.push(`drawtext=textfile=headline-${i}.txt:font=Arial:fontsize=${fontSize}:fontcolor=white:x=72:y=${top + i * lineHeight}`));
  filters.push(`drawtext=text=THE SYSTEM IN ACTION:font=Arial:fontsize=${landscape ? 24 : 40}:fontcolor=0xffcd4b:x=72:y=${landscape ? 625 : 1645}`);
  await new Promise((resolve, reject) => {
    const graph = `[0:v]crop=${picked.width}:${picked.cropH}:0:${picked.cropY},scale=${graphicW}:${graphicH}[graphic];[1:v][graphic]overlay=${graphicX}:${graphicY}:shortest=1,${filters.join(",")}[out]`;
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", picked.time.toFixed(3), "-i", assetPath, "-f", "lavfi", "-i", `color=c=0x081320:s=${width}x${height}:d=0.1`, "-filter_complex", graph, "-map", "[out]", "-frames:v", "1", file], { cwd: outputDir, windowsHide: true });
    let error = "";
    const timeout = setTimeout(() => child.kill(), 20000);
    child.stderr.on("data", (data) => { error += data; });
    child.on("error", (err) => { clearTimeout(timeout); reject(err); });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0 && fs.existsSync(file)) resolve();
      else reject(new Error(`Thumbnail render failed: ${error.slice(-500) || `exit ${code}`}`));
    });
  });
  return { file, sourceTime: Number(picked.time.toFixed(3)), densityScore: Number(picked.score.toFixed(1)) };
}

async function prepare(run, platform) {
  const key = `${run.id}:${platform}`;
  if (pending.has(key)) return pending.get(key);
  const work = (async () => {
    const input = inputFor(run, platform);
    const version = assetVersion(input);
    const recordPath = path.join(input.outputDir, "package.json");
    let cached = null;
    if (fs.existsSync(recordPath)) {
      try {
        cached = JSON.parse(fs.readFileSync(recordPath, "utf8"));
        if (cached.assetVersion === version && fs.existsSync(cached.coverPath)) return cached;
      } catch (_) { /* regenerate an invalid cache */ }
    }
    fs.mkdirSync(input.outputDir, { recursive: true });
    const metadata = cached?.metadata || await metadataFromWorker({ platform, source: input.source, topic: run.topic });
    const cover = input.kind === "image-set" ? { file: path.join(input.asset, "slide-01-cover.png"), sourceTime: null } : await renderCover(metadata, platform, input.outputDir, input.asset);
    const coverPath = cover.file;
    if (!fs.existsSync(coverPath)) throw new Error("Publish cover/thumbnail was not produced");
    const record = { runId: run.id, platform, assetVersion: version, assetPath: input.asset, coverPath, coverSourceTime: cover.sourceTime, metadata, preparedAt: new Date().toISOString(), status: "prepared", publication: cached?.publication || null };
    atomicWriteFileSync(recordPath, JSON.stringify(record, null, 2));
    return record;
  })();
  pending.set(key, work);
  try { return await work; }
  finally { pending.delete(key); }
}

module.exports = { prepare, inputFor, assetVersion, renderCover, chooseGraphicFrame };
