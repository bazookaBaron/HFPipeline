"use strict";
// Gemini multimodal vetting. Candidates are sent as downscaled JPEGs, several per call.
// Verdict rubric per image:
// {matches, confidence, watermark, heavyText, graphic, isScreenshot, focal: [x,y,w,h] fractions, depicts}

const fs = require("fs");
const path = require("path");
const { sha } = require("./http");

const MIN_CONFIDENCE = 0.6;

function eraLine(intent) {
  if (intent.kind === "illustration") return "";
  const era = intent.era ? String(intent.era) : "present day, unless the wanted description itself names an earlier period";
  return `\nEra wanted: ${era}. A picture clearly from a different era (e.g. a withdrawn or historic banknote, an old livery, a 1940s photo when the present is wanted) does NOT match.`;
}

function subjectLine(intent, subject) {
  if (!intent.entity) return "";
  const who = subject && subject.description ? `${intent.entity} (${subject.description}${subject.id ? `, Wikidata ${subject.id}` : ""})` : intent.entity;
  if (intent.kind === "logo") {
    return `\nThe logo must be the mark of exactly ${who}. A different company, product or brand sharing the name (e.g. a beer brand vs an airline of the same group) does NOT match; if you cannot tell which organisation the mark belongs to, set confidence below 0.6. It must be the logo artwork itself (a clean graphic or wordmark file); a photograph of a tail fin, sign, bottle or building that merely carries the logo does NOT match.`;
  }
  return `\nNamed subject: ${who}.`;
}

function buildVisionPrompt(intent, rubric, n, subject) {
  const illu = intent.kind === "illustration";
  return `You vet candidate pictures for one media slot in a finance explainer video.
Slot kind: ${intent.kind}${intent.entity ? `; subject: ${intent.entity}` : ""}
Wanted: ${intent.intent}${eraLine(intent)}${subjectLine(intent, subject)}
The wanted subject must be the main focus of the picture, not something small or incidental in the background.
Location: a picture cannot prove WHERE a generic scene is (a field, a harbour, banknotes on a table, a factory floor).
For such scenes judge only what is visible: accept a plausible match, and reject for location only when something
visible contradicts it (readable signs or landmarks from another country, a different currency, another airline).
Named people, buildings, logos and products still must plausibly be that exact subject.
Rubric: ${rubric || intent.intent}
There are ${n} images, labelled "Image #1" ... "Image #${n}". Judge each one on its own.

Return JSON {"results": [one object per image, in order:
 {"i": image number,
  "depicts": what the picture actually shows (max 12 words),
  "matches": true only if it clearly shows what the slot wants (for a named subject: plausibly that exact subject, not a namesake or something merely related${intent.kind === "logo" ? "; for a logo: the organisation's logo/wordmark itself" : ""}${intent.kind === "portrait" ? "; for a portrait: a photo of that person where the face is clearly visible" : ""}),
  "confidence": 0..1 how sure you are about "matches",
  "watermark": true if a visible watermark, stamp or photographer/site signature overlays the picture,
  "heavyText": ${illu ? "true if ANY legible letters, words, numbers or text-like marks appear anywhere in the image (even one short word such as IOU)" : `true if text covers a large part of the picture (${intent.kind === "logo" || intent.kind === "map" ? "the logo/map's own lettering does NOT count" : "signage that is part of the scene is fine if small"})`},
  "wrongEra": true if the picture is clearly from a different era than wanted,
  "incidental": true if the wanted subject is only small or incidental (background, edge) rather than the main focus,
  "graphic": true if gory, violent, injured/dead people or otherwise disturbing,
  "isScreenshot": true if it is a screenshot of a website, news page, app, TV broadcast or a scanned document,
  "focal": [x, y, w, h] the box around the main subject as fractions 0..1 of width/height
 }]}`;
}

const bool = (v) => v === true || v === "true";
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

function normFocal(f) {
  if (!Array.isArray(f) || f.length !== 4) return [0, 0, 1, 1];
  let [x, y, w, h] = f.map(Number);
  if (![x, y, w, h].every(Number.isFinite)) return [0, 0, 1, 1];
  // a model sometimes answers in percent or pixels-of-1000
  const scale = Math.max(x, y, w, h) > 1.5 ? (Math.max(x + w, y + h) > 100 ? 1000 : 100) : 1;
  [x, y, w, h] = [x, y, w, h].map((v) => v / scale);
  x = clamp01(x);
  y = clamp01(y);
  w = Math.max(0.05, Math.min(1 - x, w));
  h = Math.max(0.05, Math.min(1 - y, h));
  return [x, y, w, h].map((v) => Math.round(v * 1000) / 1000);
}

/** Normalise a model reply into exactly n verdicts (missing ones fail closed). */
function parseVerdicts(raw, n) {
  let arr = Array.isArray(raw) ? raw : raw && Array.isArray(raw.results) ? raw.results : raw && typeof raw === "object" ? [raw] : [];
  const out = [];
  for (let k = 0; k < n; k++) {
    const r = arr.find((x) => x && Number(x.i) === k + 1) || (arr.every((x) => x && x.i == null) ? arr[k] : null);
    if (!r) {
      out.push({ i: k + 1, matches: false, confidence: 0, watermark: false, heavyText: false, graphic: false, isScreenshot: false, wrongEra: false, incidental: false, focal: [0, 0, 1, 1], depicts: "", missing: true });
      continue;
    }
    out.push({
      i: k + 1,
      depicts: String(r.depicts || "").slice(0, 120),
      matches: bool(r.matches),
      confidence: clamp01(r.confidence),
      watermark: bool(r.watermark),
      heavyText: bool(r.heavyText),
      graphic: bool(r.graphic),
      isScreenshot: bool(r.isScreenshot),
      wrongEra: bool(r.wrongEra),
      incidental: bool(r.incidental),
      focal: normFocal(r.focal),
    });
  }
  return out;
}

/** Pass/fail for a verdict; returns the failure reasons. */
function verdictProblems(v, kind) {
  const p = [];
  if (!v.matches) p.push(`off-intent${v.depicts ? ` (${v.depicts})` : ""}`);
  else if (v.confidence < MIN_CONFIDENCE) p.push(`low confidence ${v.confidence}`);
  if (v.watermark) p.push("watermark");
  if (v.heavyText && kind !== "logo" && kind !== "map") p.push(kind === "illustration" ? "text in illustration" : "heavy text");
  if (v.graphic) p.push("graphic content");
  if (v.isScreenshot) p.push("screenshot");
  if (v.wrongEra && kind !== "illustration") p.push("wrong era");
  if (v.incidental && kind !== "illustration") p.push("subject incidental");
  return p;
}

/**
 * @param {{thumb: Buffer, hash: string}[]} items  downscaled JPEGs + content hashes (for the verdict cache)
 */
async function vet(items, intent, rubric, { gemini, cacheDir, subject } = {}) {
  if (!items.length) return [];
  const keys = items.map((it) => sha(`v5|${it.hash}|${intent.kind}|${intent.entity || ""}|${intent.era || ""}|${intent.intent}|${rubric}|${(subject && subject.id) || ""}`));
  const dir = cacheDir ? path.join(cacheDir, "_vision") : null;
  const cached = keys.map((k) => (dir && fs.existsSync(path.join(dir, k + ".json")) ? JSON.parse(fs.readFileSync(path.join(dir, k + ".json"), "utf8")) : null));
  const todo = items.map((it, i) => i).filter((i) => !cached[i]);
  if (todo.length) {
    if (!gemini) throw new Error("vision vetting needs Gemini");
    const raw = await gemini.json(buildVisionPrompt(intent, rubric, todo.length, subject), {
      images: todo.map((i, k) => ({ label: `Image #${k + 1}`, mime: "image/jpeg", data: items[i].thumb })),
      temperature: 0,
    });
    const verdicts = parseVerdicts(raw, todo.length);
    todo.forEach((i, k) => {
      cached[i] = { ...verdicts[k], i: i + 1 };
      if (dir && !verdicts[k].missing) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, keys[i] + ".json"), JSON.stringify(cached[i]));
      }
    });
  }
  return cached;
}

module.exports = { vet, parseVerdicts, verdictProblems, buildVisionPrompt, normFocal, MIN_CONFIDENCE };
