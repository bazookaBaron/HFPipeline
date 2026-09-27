"use strict";
// fal.ai provider (long-form v2 plan Â§4): photoreal scene images and background removal.
//
//   generateImage({prompt, slotId, outDir, tier, seed})  -> {file, model, cost, prompt, cached, width, height, seed}
//   removeBackground({file, outDir})                       -> {file, model, cost, cached}
//
// Queue REST API: POST https://queue.fal.run/<model> (Authorization: Key <FAL_KEY>) -> {request_id,
// status_url, response_url}; poll status_url until COMPLETED, GET response_url, download the image.
// FAL_KEY comes from the process env or scripting-pipeline/.env (never logged). Results are cached by
// hash(model | prompt | seed | size) in the media cache (<cache>/_fal/<key>.json -> content-addressed file),
// and every paid call is written to the usage ledger with its $ cost (tools/gemini-usage.js reports it).
//
// Rules for generated images: generic scenes only. Never an identifiable real person, a real brand logo
// or a specific real event shown as documentary. Every use carries the "AI-generated image" credit and
// makes the package set alteredContent: true.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { readEnv, recordCost } = require("../ai/models");
const { store, DEFAULT_CACHE_DIR } = require("./cache");
const { sniffImage } = require("./image");

const QUEUE = "https://queue.fal.run";

// Prices verified on fal.ai model pages 2026-09-27: FLUX.1 [dev] $0.025/MP and FLUX.1 [schnell] $0.003/MP
// (billed rounding UP to the next whole megapixel), Seedream 4 $0.03 per image (any size up to 4096^2).
const MODELS = {
  "fal-ai/bytedance/seedream/v4/text-to-image": { unit: "image", price: 0.03, size: { width: 1920, height: 1080 } },
  "fal-ai/flux/dev": { unit: "mp", price: 0.025, size: { width: 1280, height: 720 }, extra: { num_inference_steps: 28, guidance_scale: 3.5 } },
  "fal-ai/flux/schnell": { unit: "mp", price: 0.003, size: { width: 1280, height: 720 }, extra: { num_inference_steps: 4 } },
  "fal-ai/flux-krea-lora": { unit: "mp", price: 0.035, size: { width: 1280, height: 720 } },
  // BiRefNet: fal lists it as compute-billed; ~$0.001/image in practice (plan Â§8). Logged as an estimate.
  "fal-ai/birefnet/v2": { unit: "image", price: 0.001 },
};

const DEFAULT_MODEL = "fal-ai/bytedance/seedream/v4/text-to-image";
const DEFAULT_FAST_MODEL = "fal-ai/flux/schnell";
const BG_MODEL = "fal-ai/birefnet/v2";

function setting(name) {
  return process.env[name] || readEnv()[name] || null;
}

function falKey() {
  return setting("FAL_KEY");
}

/** True when a FAL_KEY is configured (the resolver falls back to Gemini illustrations otherwise). */
function available() {
  return !!falKey() && setting("FAL_DISABLE") !== "1";
}

/** Model id for a tier: "quality" (scenes, heroes, thumbnails) or "draft"/"montage" (cheap filler). */
function modelForTier(tier) {
  const fast = tier === "draft" || tier === "montage" || tier === "fast";
  return fast ? setting("FAL_IMAGE_MODEL_FAST") || DEFAULT_FAST_MODEL : setting("FAL_IMAGE_MODEL") || DEFAULT_MODEL;
}

/** $ cost of one image of width x height on a model (fal rounds megapixels up). */
function costOf(model, width, height) {
  const m = MODELS[model];
  if (!m) return 0;
  if (m.unit === "image") return m.price;
  const mp = Math.max(1, Math.ceil(((width || 1024) * (height || 1024)) / 1e6));
  return Math.round(mp * m.price * 10000) / 10000;
}

// ---------------------------------------------------------------------------------------------
// photoreal prompt builder

const LIGHTS = {
  tense: "low-key light, hard shadows, overcast dusk",
  dread: "cold blue hour light, heavy overcast sky",
  hopeful: "warm golden-hour sunlight",
  calm: "soft diffused daylight",
  energetic: "bright midday sun, crisp contrast",
  playful: "bright even daylight",
  dramatic: "dramatic side light, deep shadows, high contrast",
};

const PHOTO_STYLE =
  "Documentary editorial photograph, photojournalism, shot on a full-frame camera with a 35mm lens at f/2.8, " +
  "natural realistic colour, fine film grain, true-to-life textures, shallow depth of field, 16:9 landscape, one clear main subject.";

const PHOTO_RULES = [
  "Any people are anonymous: seen from behind, at a distance, in silhouette or out of focus; no recognisable face, no likeness of any real or famous person.",
  "No text of any kind: no letters, words, numbers, signage, captions, labels, logos, brand names, flags with emblems, watermarks or user-interface elements; signs and screens are blank or out of focus.",
  "Not an illustration, not a cartoon, not a painting, not a 3D render, not CGI; natural anatomy, correct hands.",
  "A generic, representative scene, not a record of a specific real news event.",
].join(" ");

// phrases that ask for exactly the things the rules forbid
const FORBIDDEN = [
  /\b(portrait|headshot|likeness|face) of\b/i,
  /\blogo\b/i,
];

/** Drop quoted strings and "reading ..." clauses (they would become lettering) and trailing noise. */
function cleanScene(s) {
  return String(s || "")
    .replace(/\s*(that\s+)?(says|reads|reading|saying|with the words?)\s*["â€œÂ«][^"â€œâ€Â«Â»]{0,80}["â€Â»]/gi, "")
    .replace(/\s*["â€œÂ«][^"â€œâ€Â«Â»]{0,80}["â€Â»]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;,\s]+$/, "");
}

/**
 * Photoreal prompt for a generic documentary scene.
 * @param {{scene?: string, intent?: string, mood?: string, era?: string, light?: string, framing?: string}} o
 */
function buildPhotoPrompt(o = {}) {
  const scene = cleanScene(o.scene || o.intent);
  if (!scene) throw new Error("photo prompt needs a scene");
  for (const re of FORBIDDEN) if (re.test(scene)) throw new Error(`scene asks for a forbidden subject (${re}): generic scenes only`);
  const light = o.light || LIGHTS[String(o.mood || "").toLowerCase()] || "natural available light";
  const era = o.era ? ` Era: ${o.era}.` : "";
  const framing = o.framing ? ` Framing: ${o.framing}.` : "";
  return `${PHOTO_STYLE}\nScene: ${scene}. Lighting: ${light}.${era}${framing}\n${PHOTO_RULES}`;
}

/** Vision rubric for the lite vet of a generated photo. */
function photoRubric(scene) {
  return (
    `A realistic documentary-style photograph of: ${cleanScene(scene)}. ` +
    "It fails (matches=false) if it looks like a cartoon, illustration, painting or 3D render; if any hand, face or body looks deformed or uncanny; " +
    "if it shows a recognisable famous person or a real brand logo; or if it does not show the scene. " +
    "Any letters, words, numbers or garbled pseudo-text anywhere count as heavyText."
  );
}

// ---------------------------------------------------------------------------------------------
// queue client

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function readJson(res, what) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    throw new Error(`fal ${what} ${res.status}: non-JSON reply`);
  }
  if (!res.ok) {
    const d = data && (data.detail || data.error || data.message);
    throw new Error(`fal ${what} ${res.status}: ${typeof d === "string" ? d : JSON.stringify(d || "").slice(0, 200)}`);
  }
  return data;
}

/**
 * Run one request through the fal queue and return its result JSON.
 * @param {string} model  e.g. "fal-ai/flux/dev"
 */
async function runQueue(model, input, { fetch: fetchImpl = globalThis.fetch, key = falKey(), pollMs = 1000, timeoutMs = 240000, log = () => {} } = {}) {
  if (!key) throw new Error("FAL_KEY not set (process env or scripting-pipeline/.env)");
  const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json" };
  let sub;
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(`${QUEUE}/${model}`, { method: "POST", headers, body: JSON.stringify(input) });
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      log(`  fal ${res.status}: retrying submit`);
      await sleep(pollMs * 2 * (attempt + 1));
      continue;
    }
    sub = await readJson(res, "submit");
    break;
  }
  const id = sub.request_id;
  if (!id) throw new Error("fal submit: no request_id");
  // subpath models (fal-ai/flux/dev) keep their status under the app id; prefer the URLs fal returns
  const app = model.split("/").slice(0, 2).join("/");
  const statusUrl = sub.status_url || `${QUEUE}/${app}/requests/${id}/status`;
  const resultUrl = sub.response_url || `${QUEUE}/${app}/requests/${id}`;
  const t0 = Date.now();
  for (;;) {
    const st = await readJson(await fetchImpl(statusUrl, { headers }), "status");
    if (st.status === "COMPLETED") {
      if (st.error) throw new Error(`fal ${model}: ${String(st.error).slice(0, 200)}`);
      break;
    }
    if (st.status && !/IN_QUEUE|IN_PROGRESS/.test(st.status)) throw new Error(`fal ${model}: status ${st.status}`);
    if (Date.now() - t0 > timeoutMs) throw new Error(`fal ${model}: timed out after ${Math.round(timeoutMs / 1000)} s`);
    await sleep(pollMs);
  }
  return readJson(await fetchImpl(resultUrl, { headers }), "result");
}

async function download(url, fetchImpl) {
  if (/^data:/.test(url)) return Buffer.from(url.split(",")[1] || "", "base64");
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`fal download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function hashKey(parts) {
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

function seedFrom(s) {
  return parseInt(crypto.createHash("sha256").update(s).digest("hex").slice(0, 8), 16) % 2147483647;
}

function cacheIndex(cacheDir, key) {
  return path.join(cacheDir, "_fal", `${key}.json`);
}

function readCached(cacheDir, key) {
  const f = cacheIndex(cacheDir, key);
  if (!fs.existsSync(f)) return null;
  try {
    const rec = JSON.parse(fs.readFileSync(f, "utf8"));
    return rec.abs && fs.existsSync(rec.abs) ? rec : null;
  } catch (_) {
    return null;
  }
}

function writeCached(cacheDir, key, rec) {
  const f = cacheIndex(cacheDir, key);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(rec, null, 2));
}

function place(abs, outDir, name) {
  if (!outDir) return abs;
  fs.mkdirSync(outDir, { recursive: true });
  const dest = path.join(outDir, `${name}${path.extname(abs)}`);
  fs.copyFileSync(abs, dest);
  return dest;
}

/**
 * Generate one photoreal image.
 * `prompt` is a scene description wrapped by buildPhotoPrompt (pass `raw: true` to send it verbatim).
 * @param {{prompt: string, slotId?: string, outDir?: string, tier?: string, seed?: number, raw?: boolean,
 *          mood?: string, era?: string, size?: {width: number, height: number}, model?: string,
 *          cacheDir?: string, fetch?: Function, key?: string, log?: Function, pollMs?: number, task?: string, record?: Function}} o
 * @returns {Promise<{file: string, model: string, cost: number, prompt: string, cached: boolean, width: number, height: number, seed: number, sha: string}>}
 */
async function generateImage(o = {}) {
  const model = o.model || modelForTier(o.tier);
  const spec = MODELS[model] || { unit: "mp", price: 0.03, size: { width: 1280, height: 720 } };
  const size = o.size || spec.size || { width: 1280, height: 720 };
  const prompt = o.raw ? String(o.prompt || "") : buildPhotoPrompt({ scene: o.prompt, mood: o.mood, era: o.era, framing: o.framing });
  if (!prompt) throw new Error("generateImage needs a prompt");
  const seed = Number.isInteger(o.seed) ? o.seed : seedFrom(`${o.slotId || ""}|${prompt}`);
  const cacheDir = o.cacheDir || DEFAULT_CACHE_DIR;
  const key = hashKey(["img.v1", model, prompt, seed, size.width, size.height]);
  const name = o.slotId ? String(o.slotId).replace(/[^\w.-]+/g, "_") : key.slice(0, 12);
  const record = o.record || recordCost;
  const log = o.log || (() => {});

  const hit = readCached(cacheDir, key);
  if (hit) {
    record({ task: o.task || "media.photoreal", provider: "fal", model, cost: 0, cached: true, units: 1 });
    return { file: place(hit.abs, o.outDir, name), model, cost: 0, prompt, cached: true, width: hit.width, height: hit.height, seed, sha: hit.sha };
  }

  const fetchImpl = o.fetch || globalThis.fetch;
  const input = { prompt, image_size: size, num_images: 1, seed, enable_safety_checker: true, ...(spec.extra || {}) };
  if (/flux/.test(model)) input.output_format = "jpeg";
  let result;
  try {
    result = await runQueue(model, input, { fetch: fetchImpl, key: o.key || falKey(), pollMs: o.pollMs, log });
  } catch (err) {
    record({ task: o.task || "media.photoreal", provider: "fal", model, cost: 0, ok: false, units: 1 });
    throw err;
  }
  const img = (result.images || [])[0];
  if (!img || !img.url) throw new Error(`fal ${model}: no image in result`);
  if (Array.isArray(result.has_nsfw_concepts) && result.has_nsfw_concepts[0]) throw new Error(`fal ${model}: safety checker flagged the image`);
  const buf = await download(img.url, fetchImpl);
  const info = sniffImage(buf);
  if (!info) throw new Error(`fal ${model}: downloaded file is not an image`);
  const width = info.width || img.width || size.width;
  const height = info.height || img.height || size.height;
  const cost = costOf(model, width, height);
  record({ task: o.task || "media.photoreal", provider: "fal", model, cost, cached: false, units: 1, width, height });
  const s = store(cacheDir, buf, info.ext, { kind: "image", source: "generated", via: `fal:${model}`, model, prompt, seed, width, height, credit: "AI-generated image" });
  writeCached(cacheDir, key, { abs: s.abs, sha: s.sha, model, seed, width, height, cost, at: new Date().toISOString() });
  log(`  fal ${model}: ${width}x${height} $${cost}`);
  return { file: place(s.abs, o.outDir, name), model, cost, prompt, cached: false, width, height, seed, sha: s.sha };
}

/**
 * Cut the subject out of an image with fal BiRefNet (transparent PNG).
 * @param {{file: string, outDir?: string, name?: string, model?: string, variant?: string, cacheDir?: string, fetch?: Function, key?: string, pollMs?: number, record?: Function}} o
 * @returns {Promise<{file: string, model: string, cost: number, cached: boolean}>}
 */
async function removeBackground(o = {}) {
  if (!o.file || !fs.existsSync(o.file)) throw new Error(`removeBackground: no such file ${o.file}`);
  const model = o.model || BG_MODEL;
  const variant = o.variant || "Portrait";
  const buf = fs.readFileSync(o.file);
  const info = sniffImage(buf);
  const cacheDir = o.cacheDir || DEFAULT_CACHE_DIR;
  const key = hashKey(["bg.v1", model, variant, crypto.createHash("sha256").update(buf).digest("hex")]);
  const name = o.name || `${path.basename(o.file, path.extname(o.file))}.cutout`;
  const record = o.record || recordCost;
  const hit = readCached(cacheDir, key);
  if (hit) {
    record({ task: "media.cutout", provider: "fal", model, cost: 0, cached: true, units: 1 });
    return { file: place(hit.abs, o.outDir, name), model, cost: 0, cached: true };
  }
  const fetchImpl = o.fetch || globalThis.fetch;
  const mime = info ? `image/${info.type}` : "image/jpeg";
  const input = {
    image_url: `data:${mime};base64,${buf.toString("base64")}`,
    model: variant,
    operating_resolution: "2048x2048",
    output_format: "png",
    refine_foreground: true,
  };
  let result;
  try {
    result = await runQueue(model, input, { fetch: fetchImpl, key: o.key || falKey(), pollMs: o.pollMs });
  } catch (err) {
    record({ task: "media.cutout", provider: "fal", model, cost: 0, ok: false, units: 1 });
    throw err;
  }
  const img = result.image;
  if (!img || !img.url) throw new Error(`fal ${model}: no image in result`);
  const out = await download(img.url, fetchImpl);
  const cost = costOf(model);
  record({ task: "media.cutout", provider: "fal", model, cost, cached: false, units: 1 });
  const s = store(cacheDir, out, "png", { kind: "image", source: "cutout", via: `fal:${model}`, from: path.basename(o.file) });
  writeCached(cacheDir, key, { abs: s.abs, sha: s.sha, model, cost, at: new Date().toISOString() });
  return { file: place(s.abs, o.outDir, name), model, cost, cached: false };
}

/**
 * generateImage + lite vision vet (lettering, uncanny anatomy, cartoon look, off-topic), up to 2 retries
 * with new seeds. Without a Gemini client the first image is returned unvetted.
 * @returns {Promise<{file, model, cost, prompt, seed, verdict, attempts, totalCost}|null>}
 */
async function generateVetted(o = {}, { gemini = null, cacheDir, retries = 2, log = () => {} } = {}) {
  const { vet, verdictProblems } = require("./vision");
  const { thumbJpeg } = require("./image");
  const base = Number.isInteger(o.seed) ? o.seed : seedFrom(`${o.slotId || ""}|${o.prompt}`);
  let totalCost = 0;
  const rejects = [];
  for (let attempt = 0; attempt <= retries; attempt++) {
    const r = await generateImage({ ...o, seed: base + attempt * 7919, cacheDir: o.cacheDir || cacheDir });
    totalCost += r.cost;
    if (!gemini) return { ...r, verdict: null, attempts: attempt + 1, totalCost, rejects };
    const buf = fs.readFileSync(r.file);
    const thumb = await thumbJpeg(buf, 768);
    const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
    let verdict;
    try {
      [verdict] = await vet([{ hash, thumb }], { kind: "illustration", slot: o.slotId, intent: o.prompt }, photoRubric(o.prompt), { gemini, cacheDir: o.cacheDir || cacheDir });
    } catch (err) {
      rejects.push([`vision: ${err.message.slice(0, 80)}`]);
      continue;
    }
    const p = verdictProblems(verdict, "illustration");
    if (!p.length) return { ...r, verdict, attempts: attempt + 1, totalCost, rejects };
    rejects.push(p);
    log(`  [${o.slotId || "fal"}] generated image rejected: ${p.join(", ")}`);
  }
  return null;
}

module.exports = {
  generateImage,
  removeBackground,
  generateVetted,
  buildPhotoPrompt,
  photoRubric,
  cleanScene,
  runQueue,
  costOf,
  modelForTier,
  available,
  MODELS,
  DEFAULT_MODEL,
  DEFAULT_FAST_MODEL,
  BG_MODEL,
};
