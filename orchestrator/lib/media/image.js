"use strict";
// Image helpers without native deps: header sniffing (size/type), dHash via ffmpeg
// (9x8 grey raw frame), and a downscaled JPEG for the vision check.

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

/** @returns {{type: "jpeg"|"png"|"webp"|"gif", ext: string, width: number, height: number}|null} */
function sniffImage(buf) {
  if (!buf || buf.length < 24) return null;
  // PNG
  if (buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") {
    return { type: "png", ext: "png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF
  if (buf.toString("ascii", 0, 3) === "GIF") return { type: "gif", ext: "gif", width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  // WEBP
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { type: "webp", ext: "webp", width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { type: "webp", ext: "webp", width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { type: "webp", ext: "webp", width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
    }
    return { type: "webp", ext: "webp", width: 0, height: 0 };
  }
  // JPEG: walk markers to the first SOFn
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { type: "jpeg", ext: "jpg", height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return { type: "jpeg", ext: "jpg", width: 0, height: 0 };
  }
  return null;
}

/** dHash of a 9x8 greyscale raster (72 bytes, row-major) -> 16 hex chars. */
function dhashFromGray(gray) {
  if (!gray || gray.length < 72) throw new Error("dhash needs a 9x8 grey raster");
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits = (bits << 1n) | (gray[y * 9 + x] > gray[y * 9 + x + 1] ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, "0");
}

function hamming(a, b) {
  let x = BigInt("0x" + a) ^ BigInt("0x" + b);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

const DUP_THRESHOLD = 10; // of 64 bits

function isDuplicate(hash, others, threshold = DUP_THRESHOLD) {
  return others.some((o) => o && hamming(hash, o) <= threshold);
}

function ffmpegBin() {
  return process.env.FFMPEG || "ffmpeg";
}

function runFfmpeg(args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegBin(), ["-hide_banner", "-loglevel", "error", ...args], { windowsHide: true });
    const out = [];
    const err = [];
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => err.push(d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`ffmpeg ${code}: ${Buffer.concat(err).toString().slice(0, 300)}`))));
    if (input) {
      p.stdin.on("error", () => {});
      p.stdin.end(input);
    } else p.stdin.end();
  });
}

// ffmpeg's image2pipe demuxer needs a hint for some formats; a temp file is the most robust input
async function withTemp(buf, ext, fn) {
  const f = path.join(os.tmpdir(), `hfmedia-${process.pid}-${Math.random().toString(36).slice(2)}.${ext || "img"}`);
  fs.writeFileSync(f, buf);
  try {
    return await fn(f);
  } finally {
    try {
      fs.unlinkSync(f);
    } catch (_) {}
  }
}

/** dHash of an encoded image (jpeg/png/webp/gif). */
async function dhash(buf) {
  const info = sniffImage(buf);
  return withTemp(buf, info ? info.ext : "img", async (f) => {
    const raw = await runFfmpeg(["-i", f, "-frames:v", "1", "-vf", "scale=9:8:flags=area,format=gray", "-f", "rawvideo", "pipe:1"]);
    return dhashFromGray(raw);
  });
}

/** Downscaled JPEG (long edge `max`) for the vision model. Transparent PNGs are flattened onto white. */
async function thumbJpeg(buf, max = 768) {
  const info = sniffImage(buf);
  return withTemp(buf, info ? info.ext : "img", (f) =>
    runFfmpeg([
      "-f", "lavfi", "-i", "color=white:s=16x16",
      "-i", f,
      "-filter_complex",
      `[1:v]scale='if(gt(iw,ih),min(${max},iw),-2)':'if(gt(iw,ih),-2,min(${max},ih))'[fg];[0:v][fg]scale2ref[bg][fg2];[bg][fg2]overlay=format=auto,format=yuvj420p`,
      "-frames:v", "1", "-q:v", "4", "-f", "image2", "-c:v", "mjpeg", "pipe:1",
    ])
  );
}

module.exports = { sniffImage, dhashFromGray, hamming, isDuplicate, dhash, thumbJpeg, DUP_THRESHOLD, runFfmpeg };
