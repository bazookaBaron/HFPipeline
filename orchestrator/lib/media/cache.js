"use strict";
// Content-addressed media store: <cacheDir>/<sha[0:2]>/<sha>.<ext> + <sha>.json sidecar.
// Default cacheDir is video-engine/assets/media/cache (git-ignored via its own .gitignore).

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const VIDEO_ENGINE = path.join(__dirname, "..", "..", "..", "video-engine");
const DEFAULT_CACHE_DIR = path.join(VIDEO_ENGINE, "assets", "media", "cache");

function ensureCacheDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const gi = path.join(dir, ".gitignore");
  if (!fs.existsSync(gi)) fs.writeFileSync(gi, "*\n!.gitignore\n");
}

/**
 * Store bytes + sidecar. Returns {sha, abs, file} where file is relative to video-engine/
 * (posix separators) when the cache lives inside it, else absolute.
 */
function store(cacheDir, buf, ext, sidecar) {
  ensureCacheDir(cacheDir);
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  const dir = path.join(cacheDir, sha.slice(0, 2));
  fs.mkdirSync(dir, { recursive: true });
  const abs = path.join(dir, `${sha}.${ext}`);
  if (!fs.existsSync(abs)) fs.writeFileSync(abs, buf);
  const side = path.join(dir, `${sha}.json`);
  const prev = fs.existsSync(side) ? JSON.parse(fs.readFileSync(side, "utf8")) : null;
  const rec = { sha256: sha, ...sidecar, fetchedAt: (prev && prev.fetchedAt) || sidecar.fetchedAt || new Date().toISOString() };
  fs.writeFileSync(side, JSON.stringify(rec, null, 2));
  return { sha, abs, file: relFile(abs), sidecar: rec };
}

function relFile(abs) {
  const rel = path.relative(VIDEO_ENGINE, abs);
  if (!rel.startsWith("..") && !path.isAbsolute(rel)) return rel.split(path.sep).join("/");
  return abs.split(path.sep).join("/");
}

module.exports = { store, ensureCacheDir, relFile, DEFAULT_CACHE_DIR, VIDEO_ENGINE };
