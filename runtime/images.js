#!/usr/bin/env node
"use strict";
// runtime/images.js <dir> <slots.json> [--no-vision] [--offline]
// Photoreal-only image resolver for hand-authored long-form videos.
//   slots.json: [{id, query, entity?, kind:'photo', person?:true}]
//   order: 1) licensed real photo (Wikidata/Commons/Openverse/NASA, licence-checked, Gemini-lite vetted)
//          2) a related real place photo, 3) fal photoreal generic scene (Seedream; never a real person/logo)
//          4) people with no usable photo get a name card (never fal)
//   NEVER illustrations (allowIllustration:false; the illustrate provider is stubbed out).
// Writes <dir>/images/<id>.<ext> and <dir>/media.json: {id: {file, credit, licence, grain, kind, ...}}.
// grain:true when the real photo is soft: short side < 900 px, or measured blur (Laplacian variance) / the vet says blurry.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const M = path.join(ROOT, "orchestrator/lib/media");
const { resolveMedia } = require(path.join(M, "resolve"));
const { createGemini } = require(path.join(M, "gemini"));
const { DEFAULT_CACHE_DIR } = require(path.join(M, "cache"));

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const [dir, slotsFile] = argv.filter((a) => !a.startsWith("--")).map((p) => path.resolve(p));
if (!dir || !slotsFile) { console.log("usage: node runtime/images.js <dir> <slots.json> [--no-vision] [--offline]"); process.exit(2); }

async function sharpness(file) {
  // variance of a Laplacian on a <=1000px greyscale (ffmpeg decode); < ~40 is visibly soft
  const { spawnSync } = require("child_process");
  const probe = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", "scale='min(1000,iw)':-2,format=gray", "-frames:v", "1", "-f", "rawvideo", "-"], { maxBuffer: 1 << 28 });
  const pr = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]);
  if (probe.status !== 0) return null;
  const data = probe.stdout; const [iw, ih] = String(pr.stdout).trim().split(",").map(Number);
  const w = Math.min(1000, iw); const h = Math.round(data.length / w); if (h * w !== data.length && Math.abs(h * w - data.length) > w) return null;
  let s = 0, s2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, v = 4 * data[i] - data[i - 1] - data[i + 1] - data[i - w] - data[i + w];
    s += v; s2 += v * v; n++;
  }
  return { lapVar: s2 / n - (s / n) ** 2 };
}

if (flags.has("--sharp")) { sharpness(path.resolve(argv.filter((a) => !a.startsWith("--"))[2])).then((r) => { console.log(r); process.exit(0); }); }
(async () => {
  if (flags.has("--sharp")) return;
  const slots = JSON.parse(fs.readFileSync(slotsFile, "utf8"));
  const intents = slots.map((s) => ({
    slot: s.id, kind: s.person ? "portrait" : "photo", intent: s.query, ...(s.entity ? { entity: s.entity } : {}),
    allowIllustration: false, ...(s.person ? { person: true } : {}), ...(s.era ? { era: s.era } : {}),
  }));
  let gemini = null;
  if (!flags.has("--no-vision")) { try { gemini = createGemini({ log: () => {} }); } catch (e) { console.warn("gemini unavailable:", e.message); } }
  // hard rule: no illustrations, ever
  const noIllustrate = { illustrate: { illustrate: async () => { throw new Error("illustrations disabled"); } } };
  const direct = slots.filter((x) => x.generate); // generic scenes: straight to fal photoreal (no real person/logo)
  const { manifest } = await resolveMedia(intents.filter((i) => !direct.some((d) => d.id === i.slot)), {
    cacheDir: DEFAULT_CACHE_DIR, outDir: path.join(dir, "_resolve"), gemini, vision: !!gemini, offline: flags.has("--offline"),
    concurrency: 3, providers: noIllustrate, log: (m) => console.log(m),
  });
  fs.mkdirSync(path.join(dir, "images"), { recursive: true });
  const out = {};
  for (const s of slots) {
    let e = manifest[s.id];
    if (s.generate) {
      const fal = require(path.join(M, "fal"));
      const r = await fal.generateImage({ prompt: s.query, slotId: s.id, cacheDir: DEFAULT_CACHE_DIR, log: () => {} });
      e = { status: "generated", file: path.relative(path.join(ROOT, "video-engine"), r.file), credit: "AI-generated image", licence: "AI-generated", width: r.width, height: r.height, source: "fal", cost: r.cost };
    }
    if (!e || e.status === "fallback") { out[s.id] = { file: null, credit: null, licence: null, grain: false, kind: "none", reason: e && e.reason }; continue; }
    if (e.status === "namecard") { out[s.id] = { file: null, credit: null, licence: null, grain: false, kind: "namecard", namecard: e.namecard }; continue; }
    const src = path.join(ROOT, "video-engine", e.file); const ext = path.extname(src) || ".jpg";
    const dst = path.join(dir, "images", s.id + ext); fs.copyFileSync(src, dst);
    const generated = e.status === "generated" || /^AI/i.test(e.credit || "") || e.source === "illustration";
    let grain = false, why = null;
    if (!generated) {
      const short = Math.min(e.width || 0, e.height || 0);
      const sh = await sharpness(dst);
      if (short && short < 900) { grain = true; why = `short side ${short}px`; }
      else if (sh && sh.lapVar < 40) { grain = true; why = `soft (laplacian var ${sh.lapVar.toFixed(0)})`; }
      else if (e.vision && /blur|noisy|grain/i.test(String(e.vision.depicts || ""))) { grain = true; why = "vision: blurry"; }
    }
    out[s.id] = { file: path.relative(dir, dst).split(path.sep).join("/"), credit: e.credit || "AI-generated image", licence: e.licence || "AI-generated", grain, kind: generated ? "generated" : "photo",
      width: e.width, height: e.height, source: e.source, pageUrl: e.pageUrl || null, depicts: e.depicts || null, ...(why ? { grainWhy: why } : {}) };
  }
  fs.writeFileSync(path.join(dir, "media.json"), JSON.stringify(out, null, 2));
  for (const [k, v] of Object.entries(out)) console.log(k.padEnd(16), v.kind.padEnd(9), v.file || "-", "grain=" + v.grain, v.credit || "", v.grainWhy ? `(${v.grainWhy})` : "");
})().catch((e) => { console.error(e); process.exit(1); });
