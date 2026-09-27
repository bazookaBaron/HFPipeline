"use strict";
// Generated stand-in images (decision D2, long-form v2 plan §4).
//
// Default: a photoreal documentary-style scene from fal.ai (lib/media/fal.js), used when FAL_KEY is set.
// Fallback (no FAL_KEY, or MEDIA_GENERATOR=gemini): the flat Gemini editorial illustration.
// Either way: generic scenes, concepts and analogies only; never a real person, a real logo or a real
// news event shown as documentary. Credits: "AI-generated image" (fal) / "Illustration: AI-generated" (Gemini).

const fal = require("../fal");

const STYLE = [
  "Clean flat editorial vector illustration for a light, friendly finance explainer video.",
  "Style: modern flat vector, simple geometric shapes, uniform dark navy (#141a2e) outlines, flat fills, at most one flat shadow tone per colour,",
  "no gradients, no texture, no photorealism, no 3D render, no photograph look.",
  "Palette: navy #141a2e, teal #14b8a6, coral #f26d4f, mustard #f2b33d, soft grey #c9ccd3, on an off-white paper background #F7F6F1 (flat, plain, nothing else in the background).",
  "Composition: one clear central subject with generous empty margins (at least 10% on every side), readable at a glance, 16:9 landscape.",
  "NO TEXT OF ANY KIND: no letters, no words, no numbers, no abbreviations (not even IOU, $, % or a currency sign), no captions, labels, signs, logos, brand marks, flags or watermarks anywhere in the image.",
  "Documents, notes, bills and screens are drawn as blank shapes or with abstract squiggle lines only, never with legible characters.",
  "If people appear they are generic, anonymous cartoon figures (simple rounded faces), never a likeness of any real person.",
].join(" ");

function buildPrompt(intent) {
  const concept = String(intent.intent || "").replace(/\s+/g, " ").trim();
  const mood = intent.mood ? ` Mood: ${intent.mood}.` : "";
  return `${STYLE}\n\nDepict this concept as a visual metaphor: ${concept}.${mood}\nDo not depict any real, named person, company logo or real news event; use generic objects and anonymous characters instead.\nFinal check: the image contains no letters, no words, no numbers, no text of any kind.`;
}

/** Which generator the resolver uses: "fal" (photoreal) when a key is set, else "gemini". */
function generator() {
  const pref = String(process.env.MEDIA_GENERATOR || "").toLowerCase();
  if (pref === "gemini") return "gemini";
  return fal.available() ? "fal" : "gemini";
}

/**
 * @param {object|null} gemini  lib/media/gemini.js client (Gemini path only)
 * @param {object} intent       {slot, intent, mood?, era?, tier?}
 * @param {{attempt?: number, cacheDir?: string, log?: Function}} [o]
 * @returns {Promise<{data: Buffer, mime: string, prompt: string, model: string, provider: "fal"|"gemini", cost?: number}>}
 */
async function illustrate(gemini, intent, o = {}) {
  if (generator() === "fal") {
    const fs = require("fs");
    const r = await fal.generateImage({
      prompt: intent.intent,
      mood: intent.mood,
      era: intent.era,
      slotId: intent.slot,
      tier: intent.tier || "quality",
      cacheDir: o.cacheDir,
      log: o.log,
      ...(o.attempt ? { seed: seedFor(intent, o.attempt) } : {}),
    });
    return { data: fs.readFileSync(r.file), mime: r.file.endsWith(".png") ? "image/png" : "image/jpeg", prompt: r.prompt, model: r.model, provider: "fal", cost: r.cost };
  }
  if (!gemini || !gemini.image) throw new Error("illustration needs a Gemini client (or FAL_KEY for photoreal images)");
  const prompt = buildPrompt(intent);
  const img = await gemini.image(prompt, { aspectRatio: intent.aspectRatio || "16:9" });
  return { ...img, prompt, model: gemini.imageModel, provider: "gemini" };
}

// retries need a new seed; attempt 0 keeps fal's deterministic default (slot + prompt) so re-runs hit the cache
function seedFor(intent, attempt) {
  let h = 2166136261;
  for (const ch of `${intent.slot}|${intent.intent}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return (h + attempt * 7919) % 2147483647;
}

module.exports = { illustrate, buildPrompt, generator, STYLE };
