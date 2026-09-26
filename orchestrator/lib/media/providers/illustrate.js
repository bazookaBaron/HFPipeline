"use strict";
// AI illustration (decision D2): concepts, analogies and comedic beats only.
// Never realistic real people or real news events, never presented as a photo.
// Credit is fixed: "Illustration: AI-generated".

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

/** @returns {Promise<{data: Buffer, mime: string, prompt: string, model: string}>} */
async function illustrate(gemini, intent) {
  if (!gemini || !gemini.image) throw new Error("illustration needs a Gemini client");
  const prompt = buildPrompt(intent);
  const img = await gemini.image(prompt, { aspectRatio: intent.aspectRatio || "16:9" });
  return { ...img, prompt, model: gemini.imageModel };
}

module.exports = { illustrate, buildPrompt, STYLE };
