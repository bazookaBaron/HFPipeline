"use strict";
// Gemini multimodal vetting. Candidates are sent as downscaled JPEGs, several per call.
// Verdict rubric per image:
// {matches, confidence, watermark, heavyText, graphic, isScreenshot, focal: [x,y,w,h] fractions, depicts}

const fs = require("fs");
const path = require("path");
const { sha } = require("./http");

const MIN_CONFIDENCE = 0.6;
/** at most this many vision CALLS per media slot per run (cache hits are free); env LF_VISION_PER_SLOT */
const MAX_CALLS_PER_SLOT = 3;

/**
 * Metadata / size filters BEFORE any vision call (cheap, no tokens): a candidate whose known size cannot fill the
 * slot, or whose file title says it is another kind of picture (a logo, a locator map, a flag, a chart, a
 * signature...) when the slot wants a photo, is rejected without being sent to the model.
 */
const NOT_A_PHOTO = /\b(logo|wordmark|coat of arms|flag of|locator map|location map|map of|diagram|chart|graph|signature|icon|seal of|emblem|screenshot|infographic)\b/i;
function preVisionProblems(cand, intent) {
  if (!cand || typeof cand !== "object") return [];
  const p = [];
  if (Number(cand.width) > 0 && Number(cand.height) > 0 && !cand.vector && intent.kind !== "video") {
    const { qualityProblems } = require("./quality");
    p.push(...qualityProblems(cand, intent));
  }
  if (intent.kind === "photo" || intent.kind === "portrait") {
    const title = String(cand.title || cand.id || "");
    const m = title.match(NOT_A_PHOTO);
    if (m && !new RegExp(`\\b${m[1].replace(/\s+/g, "\\s+")}\\b`, "i").test(`${intent.intent} ${intent.entity || ""}`)) p.push(`title says "${m[1].toLowerCase()}"`);
  }
  return p;
}

/** vision calls per slot, per Gemini client (one client per media stage run) */
const callsBy = new WeakMap();
function visionCap() {
  const n = Number(process.env.LF_VISION_PER_SLOT);
  return Number.isFinite(n) && n > 0 ? n : MAX_CALLS_PER_SLOT;
}

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

/**
 * Static rules + answer schema FIRST (identical for every slot and video, so Gemini's implicit cache can reuse the
 * prefix), the slot's own wants and kind rules LAST; the images follow the text.
 */
const VISION_STATIC = `You vet candidate pictures for one media slot in a finance explainer video.
The wanted subject must be the main focus of the picture, not something small or incidental in the background.
Location: a picture cannot prove WHERE a generic scene is (a field, a harbour, banknotes on a table, a factory floor).
For such scenes judge only what is visible: accept a plausible match, and reject for location only when something
visible contradicts it (readable signs or landmarks from another country, a different currency, another airline).
Named people, buildings, logos and products still must plausibly be that exact subject.
Judge each image on its own.

Return JSON {"results": [one object per image, in order:
 {"i": image number,
  "depicts": what the picture actually shows (max 12 words),
  "matches": true only if it clearly shows what the slot wants (for a named subject: plausibly that exact subject, not a namesake or something merely related; see the slot rules below),
  "confidence": 0..1 how sure you are about "matches",
  "watermark": true if a visible watermark, stamp or photographer/site signature overlays the picture,
  "heavyText": see the slot rules below,
  "wrongEra": true if the picture is clearly from a different era than wanted,
  "incidental": true if the wanted subject is only small or incidental (background, edge) rather than the main focus,
  "graphic": true if gory, violent, injured/dead people or otherwise disturbing,
  "isScreenshot": true if it is a screenshot of a website, news page, app, TV broadcast or a scanned document,
  "focal": [x, y, w, h] the box around the main subject as fractions 0..1 of width/height
 }]}`;

function buildVisionPrompt(intent, rubric, n, subject) {
  const illu = intent.kind === "illustration";
  const kindRules = [
    intent.kind === "logo" ? `"matches": for a logo: the organisation's logo/wordmark itself.` : "",
    intent.kind === "portrait" ? `"matches": for a portrait: a photo of that person where the face is clearly visible.` : "",
    `"heavyText": ${illu ? "true if ANY legible letters, words, numbers or text-like marks appear anywhere in the image (even one short word such as IOU)" : `true if text covers a large part of the picture (${intent.kind === "logo" || intent.kind === "map" ? "the logo/map's own lettering does NOT count" : "signage that is part of the scene is fine if small"})`}.`,
  ].filter(Boolean);
  return `${VISION_STATIC}

======== THIS SLOT ========
Slot kind: ${intent.kind}${intent.entity ? `; subject: ${intent.entity}` : ""}
Wanted: ${intent.intent}${eraLine(intent)}${subjectLine(intent, subject)}
Rubric: ${rubric || intent.intent}
Slot rules:
${kindRules.map((r) => "- " + r).join("\n")}
There are ${n} images, labelled "Image #1" ... "Image #${n}".`;
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
  // metadata / size filters first: a failing candidate gets a rejecting verdict without a vision call
  items.forEach((it, i) => {
    if (cached[i]) return;
    const pre = preVisionProblems(it.cand, intent);
    if (pre.length) cached[i] = { i: i + 1, matches: false, confidence: 0, watermark: false, heavyText: false, graphic: false, isScreenshot: false, wrongEra: false, incidental: false, focal: [0, 0, 1, 1], depicts: `pre-filter: ${pre.join("; ")}`, preFiltered: true };
  });
  const todo = items.map((it, i) => i).filter((i) => !cached[i]);
  if (todo.length) {
    if (!gemini) throw new Error("vision vetting needs Gemini");
    // at most MAX_CALLS_PER_SLOT calls per slot and kind (a video slot that falls back to a still gets a fresh
    // budget for the still): past it the stage fails closed and the resolver ladder takes over
    const slotKey = `${intent.slot || `${intent.entity || ""}|${intent.intent}`}|${intent.kind}`;
    const calls = callsBy.get(gemini) || new Map();
    callsBy.set(gemini, calls);
    const used = calls.get(slotKey) || 0;
    if (used >= visionCap()) {
      const err = new Error(`vision cap: slot ${slotKey} already used ${used} vision call(s) (max ${visionCap()})`);
      err.visionCap = true;
      throw err;
    }
    calls.set(slotKey, used + 1);
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

module.exports = { vet, parseVerdicts, verdictProblems, buildVisionPrompt, normFocal, preVisionProblems, MIN_CONFIDENCE, MAX_CALLS_PER_SLOT, VISION_STATIC };
