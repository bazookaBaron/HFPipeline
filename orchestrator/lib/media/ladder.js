"use strict";
// Escalation ladder for a media slot the exact search could not fill (long-form v2 plan §3):
//   (a) the exact entity (resolve.js, unchanged)
//   (b) a related institution / place photo (the court, the organisation, the city)
//   (c) a generic generated scene with NO identifiable real person (fal.js when present, else the
//       Gemini illustration provider with a "generic scene, no people's faces" prompt)
//   (d) a designed name card (monogram, name, role, year, one-line context), rendered by the LF
//       media module; never the grey camera placeholder.
// This file holds the planning helpers (queries, scene, card text); resolve.js runs the stages.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const LADDER_VERSION = 1;
const PERSON_RE = /person|human|politician|judge|justice|businessman|businesswoman|official|economist|minister|president|founder|ceo|governor|chancellor|banker|investor|lawyer|senator|king|queen|leader/i;

const PERSON_WORD_RE = new RegExp("\\b(" + PERSON_RE.source + ")\\b", "i");

function isPersonSlot(intent, plan) {
  if (intent.kind === "portrait" || intent.person === true) return true;
  const cls = plan && plan.entityClass;
  // no model classification (offline keyword plan): judge by the intent words, erring towards "person"
  return cls ? PERSON_RE.test(String(cls)) : PERSON_WORD_RE.test(String(intent.intent || ""));
}

// deterministic related subjects: keyword -> the institution / place a picture of it stands in for
const RELATED_RULES = [
  [/\b(imf|international monetary fund)\b/i, "International Monetary Fund headquarters"],
  [/\bworld bank\b/i, "World Bank headquarters building"],
  [/\b(court|courtroom|judge|justice|ruling|lawsuit|litigation|verdict|trial)\b/i, "courthouse"],
  [/\b(parliament|congress|senate|lawmakers?|legislat\w*)\b/i, "parliament building"],
  [/\b(central bank|reserve bank|federal reserve)\b/i, "central bank building"],
  [/\b(stock|shares|traders?|exchange)\b/i, "stock exchange"],
  [/\b(banks?|banker)\b/i, "bank building"],
  [/\b(minister|president|government|official|politician|prime minister|cabinet|ministry)\b/i, "government palace"],
  [/\b(ceo|founder|company|businessman|businesswoman|executive|firm|hedge fund|fund)\b/i, "office tower"],
  [/\b(protest|strike|union|march)\b/i, "city square"],
];

/** capitalised place after "in"/"at" ("... in Buenos Aires") */
function placeOf(text) {
  const m = String(text || "").match(/\b(?:in|at)\s+((?:[A-Z][\w.'-]+\s?){1,4})/);
  return m ? m[1].trim() : null;
}

function deterministicRelated(intent, plan) {
  const text = [intent.intent, intent.entity, plan && plan.entityClass].filter(Boolean).join(" ");
  const place = intent.place || placeOf(intent.intent);
  const out = [];
  for (const [re, what] of RELATED_RULES) {
    if (!re.test(text)) continue;
    out.push({ query: place ? `${what} ${place}` : what, label: place ? `${what}, ${place}` : what });
    if (out.length >= 2) break;
  }
  if (place && !out.some((x) => x.query === place)) out.push({ query: place, label: place });
  return out.slice(0, 2);
}

/** generic scene text: the intent without the person's name, and always "no people" */
function deterministicScene(intent, plan, related) {
  let s = String(intent.intent || "");
  if (intent.entity) s = s.split(intent.entity).join(" ");
  s = s.replace(/\b(U\.S\.|US|Judge|Justice|President|Minister|Mr\.?|Mrs\.?|Ms\.?|Dr\.?)\b/g, " ").replace(/\s+/g, " ").trim();
  const where = related && related[0] ? related[0].label : s;
  return `an empty ${where || "office interior"}, documentary photograph, no people`;
}

function buildRelatedPrompt(intent, plan) {
  return `A documentary video needs a picture for this slot, but no usable photo of the exact subject exists.
Slot: kind=${intent.kind}; subject=${intent.entity || "(none)"}; intent="${intent.intent}"; era=${intent.era || "?"}; subject class=${(plan && plan.entityClass) || "?"}.
Return JSON:
{"related":[{"query":"<Wikimedia Commons search phrase for a REAL related institution, building or place that is freely photographed (e.g. the courthouse where a judge sat, the organisation's headquarters, the city)>","wikidata":"<exact Wikidata label of that place/institution, or null>","label":"<short name>"}],
 "scene":"<one sentence: a GENERIC photoreal scene that fits the intent with NO identifiable person (empty rooms, buildings, objects, anonymous crowds seen from behind); no text, no logos>",
 "role":"<the subject's role in 2-5 words, e.g. 'U.S. District Judge'>",
 "context":"<one line (max 60 chars) of why the subject matters here>"}
At most 2 related entries, most specific first. Never suggest a photo of a different person.`;
}

function sha(s) {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 24);
}

function cleanList(list) {
  return (Array.isArray(list) ? list : [])
    .filter((x) => x && typeof x.query === "string" && x.query.trim())
    .slice(0, 2)
    .map((x) => ({ query: x.query.trim().slice(0, 90), wikidata: typeof x.wikidata === "string" && x.wikidata.trim() ? x.wikidata.trim() : null, label: String(x.label || x.query).trim().slice(0, 60) }));
}

/**
 * Related subjects + generic scene + card text for a slot. One lite model call (task media.queries),
 * cached in <cacheDir>/_related; deterministic without a model.
 * @returns {Promise<{related: {query, wikidata, label}[], scene: string, role: string|null, context: string|null, source: "model"|"rules"}>}
 */
async function planLadder(intent, plan, { gemini = null, cacheDir = null, log = () => {} } = {}) {
  const base = { related: deterministicRelated(intent, plan), role: null, context: null, source: "rules" };
  base.scene = deterministicScene(intent, plan, base.related);
  const key = sha(JSON.stringify({ v: LADDER_VERSION, kind: intent.kind, entity: intent.entity || null, intent: intent.intent, era: intent.era || null, cls: (plan && plan.entityClass) || null }));
  const file = cacheDir ? path.join(cacheDir, "_related", key + ".json") : null;
  if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  if (!gemini || !gemini.json) return base;
  let out = base;
  try {
    const raw = await gemini.json(buildRelatedPrompt(intent, plan), { temperature: 0, task: "media.queries" });
    const related = cleanList(raw && raw.related);
    out = {
      related: related.length ? related : base.related,
      scene: typeof raw.scene === "string" && raw.scene.trim() ? `${raw.scene.trim().replace(/[.\s]+$/, "")}, no people` : base.scene,
      role: typeof raw.role === "string" && raw.role.trim() ? raw.role.trim().slice(0, 40) : null,
      context: typeof raw.context === "string" && raw.context.trim() ? raw.context.trim().slice(0, 70) : null,
      source: "model",
    };
  } catch (err) {
    log(`  ladder: model failed (${err.message}); using rules`);
    return base;
  }
  if (file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(out, null, 2));
  }
  return out;
}

const SMALL = new Set(["of", "the", "and", "for", "de", "la", "del", "a", "an", "in", "on", "&"]);
function initials(name) {
  const words = String(name || "")
    .replace(/\(.*?\)/g, " ")
    .split(/[\s-]+/)
    .filter((w) => /[A-Za-zÀ-ɏ]/.test(w) && !SMALL.has(w.toLowerCase()));
  if (!words.length) return "?";
  // an acronym entity stays itself ("IMF")
  if (words.length === 1 && /^[A-Z]{2,4}$/.test(words[0])) return words[0];
  const pick = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return pick.map((w) => w.replace(/[^A-Za-zÀ-ɏ]/g, "").charAt(0).toUpperCase()).join("");
}

function titleCase(s) {
  return String(s || "").replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/**
 * Name card data for the LF media module (manifest status "namecard").
 * @param {object} intent the slot intent
 * @param {{entityClass?: string}} plan
 * @param {{label?: string, description?: string}|null} entity Wikidata entity when one was found
 * @param {{role?: string, context?: string}|null} lp planLadder output
 */
function nameCard(intent, plan, entity, lp) {
  const name = String((entity && entity.label) || intent.entity || intent.name || intent.intent || "").replace(/\s+/g, " ").trim().slice(0, 48);
  let role = (lp && lp.role) || null;
  if (!role && entity && entity.description) role = entity.description.replace(/\s*\(.*?\)\s*/g, " ").trim();
  if (!role && plan && plan.entityClass) role = plan.entityClass;
  role = role ? titleCase(role).slice(0, 44) : "";
  const year = intent.era ? String(intent.era).slice(0, 12) : "";
  let context = (lp && lp.context) || "";
  if (!context && intent.entity) {
    const rest = String(intent.intent || "").split(intent.entity).join("").replace(/\s+/g, " ").trim();
    if (rest.length > 12 && rest.length <= 70) context = rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return { name, initials: initials(name), role, year, context: String(context).slice(0, 70), person: isPersonSlot(intent, plan) };
}

module.exports = { planLadder, nameCard, initials, isPersonSlot, deterministicRelated, deterministicScene, buildRelatedPrompt, PERSON_RE, LADDER_VERSION };
