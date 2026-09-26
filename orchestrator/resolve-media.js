#!/usr/bin/env node
"use strict";
// CLI: node resolve-media.js --intents intents.json --out <dir> [--cache <dir>] [--concurrency 3] [--no-vision] [--offline]
// intents.json: [{slot, kind: photo|portrait|logo|video|map|illustration, entity?, intent, mood?, era?, minWidth?, size?, allowIllustration?}]
// (or {intents: [...]}). Writes <out>/media-manifest.json, credits.txt, media-report.json.

const fs = require("fs");
const path = require("path");
const { resolveMedia } = require("./lib/media/resolve");
const { createGemini } = require("./lib/media/gemini");
const { DEFAULT_CACHE_DIR } = require("./lib/media/cache");

function args(argv) {
  const a = { concurrency: 3 };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--intents") a.intents = argv[++i];
    else if (k === "--out") a.out = argv[++i];
    else if (k === "--cache") a.cache = argv[++i];
    else if (k === "--concurrency") a.concurrency = Number(argv[++i]);
    else if (k === "--no-vision") a.noVision = true;
    else if (k === "--offline") a.offline = true;
    else if (k === "-h" || k === "--help") a.help = true;
    else throw new Error(`unknown argument ${k}`);
  }
  return a;
}

async function main() {
  const a = args(process.argv);
  if (a.help || !a.intents || !a.out) {
    console.log("usage: node resolve-media.js --intents file.json --out dir [--cache dir] [--concurrency 3] [--no-vision] [--offline]");
    process.exit(a.help ? 0 : 2);
  }
  const raw = JSON.parse(fs.readFileSync(a.intents, "utf8"));
  const intents = Array.isArray(raw) ? raw : raw.intents;
  let gemini = null;
  if (!a.noVision || intents.some((i) => i.kind === "illustration")) {
    try {
      gemini = createGemini({ log: console.log });
    } catch (err) {
      console.warn(`gemini unavailable (${err.message}): keyword queries, no vision check, no illustrations`);
    }
  }
  const t0 = Date.now();
  const { manifest, report } = await resolveMedia(intents, {
    cacheDir: a.cache ? path.resolve(a.cache) : DEFAULT_CACHE_DIR,
    outDir: path.resolve(a.out),
    gemini,
    vision: !a.noVision,
    offline: a.offline,
    concurrency: a.concurrency,
    log: (m) => console.log(m),
  });
  console.log("");
  for (const [slot, e] of Object.entries(manifest)) {
    console.log(`${e.status.padEnd(12)} ${slot.padEnd(22)} ${e.status === "fallback" ? e.reason : `${e.file}  ${e.credit}`}`);
  }
  const c = report.counts;
  console.log(`\nok ${c.ok} · illustration ${c.illustration} · fallback ${c.fallback} · ${((Date.now() - t0) / 1000).toFixed(1)} s · http ${report.http.requests} req (${report.http.cacheHits} cache hits)`);
  console.log(`wrote ${path.join(path.resolve(a.out), "media-manifest.json")}`);
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
