"use strict";
// Polite HTTP for the media resolver: descriptive User-Agent, <= 5 req/s overall,
// per-host minimum gaps (Openverse anonymous: 20/min burst, 200/day), exponential
// backoff on 429/5xx (Retry-After honoured), and a 24 h on-disk cache of JSON responses.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const USER_AGENT = "HFPipeline-media/0.1 (debopriyo.debnath1999@gmail.com)";
const DAY_MS = 24 * 3600 * 1000;

// minimum gap between two requests to the same host (ms)
const HOST_GAP = {
  "api.openverse.org": 3200, // anon burst 20/min
};
const GLOBAL_GAP = 200; // 5 req/s across every host

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createHttp(opts = {}) {
  const fetchImpl = opts.fetch || globalThis.fetch;
  const cacheDir = opts.cacheDir ? path.join(opts.cacheDir, "_api") : null;
  const ttlMs = opts.ttlMs == null ? DAY_MS : opts.ttlMs;
  const log = opts.log || (() => {});
  const offline = !!opts.offline;
  const stats = { requests: 0, cacheHits: 0, retries: 0, bytes: 0 };
  const hostCaps = { "api.openverse.org": opts.openverseCap == null ? 60 : opts.openverseCap };
  const hostCount = {};

  // serialised slot scheduler: every request reserves a start time
  let nextGlobal = 0;
  const nextHost = {};
  async function slot(host) {
    const now = Date.now();
    const at = Math.max(now, nextGlobal, nextHost[host] || 0);
    nextGlobal = at + GLOBAL_GAP;
    nextHost[host] = at + (HOST_GAP[host] || 0);
    if (at > now) await sleep(at - now);
  }

  async function request(url, { accept, method = "GET", body, headers = {} } = {}) {
    if (offline) throw new Error(`offline: ${url}`);
    const host = new URL(url).host;
    hostCount[host] = (hostCount[host] || 0) + 1;
    if (hostCaps[host] != null && hostCount[host] > hostCaps[host]) throw new Error(`per-run cap reached for ${host}`);
    let delay = 1000;
    for (let attempt = 0; ; attempt++) {
      await slot(host);
      stats.requests++;
      let res;
      try {
        res = await fetchImpl(url, { method, body, headers: { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT, Accept: accept || "*/*", ...headers } });
      } catch (err) {
        if (attempt >= 3) throw err;
        stats.retries++;
        await sleep(delay);
        delay *= 2;
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= 3) throw new Error(`HTTP ${res.status} for ${url}`);
        const ra = Number(res.headers && res.headers.get && res.headers.get("retry-after"));
        const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 60000) : delay;
        log(`  http ${res.status} ${host}: backing off ${wait} ms`);
        stats.retries++;
        await sleep(wait);
        delay *= 2;
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res;
    }
  }

  function cachePath(url) {
    return cacheDir ? path.join(cacheDir, sha(url).slice(0, 2), sha(url) + ".json") : null;
  }

  async function getJson(url) {
    const p = cachePath(url);
    if (p && fs.existsSync(p)) {
      const age = Date.now() - fs.statSync(p).mtimeMs;
      if (age < ttlMs || offline) {
        stats.cacheHits++;
        return JSON.parse(fs.readFileSync(p, "utf8"));
      }
    }
    const res = await request(url, { accept: "application/json" });
    const text = await res.text();
    const data = JSON.parse(text);
    if (p) {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, text);
    }
    return data;
  }

  // binary download, cached by URL under _dl/ (the resolver keeps only the chosen files in the store)
  async function getBuffer(url, { maxBytes = 40 * 1024 * 1024 } = {}) {
    const dl = cacheDir ? path.join(cacheDir, "..", "_dl", sha(url).slice(0, 2), sha(url)) : null;
    if (dl && fs.existsSync(dl)) {
      stats.cacheHits++;
      return fs.readFileSync(dl);
    }
    const res = await request(url);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new Error(`download too large (${buf.length} B): ${url}`);
    stats.bytes += buf.length;
    if (dl) {
      fs.mkdirSync(path.dirname(dl), { recursive: true });
      fs.writeFileSync(dl, buf);
    }
    return buf;
  }

  return { getJson, getBuffer, request, stats };
}

module.exports = { createHttp, USER_AGENT, sha };
