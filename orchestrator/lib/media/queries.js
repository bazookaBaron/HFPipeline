"use strict";
// Intent -> concrete Commons/Openverse queries + a one-line vision rubric (Gemini JSON mode, temperature 0).
// Cached by sha256 of the intent. Without Gemini a deterministic plan is built from the intent text.

const fs = require("fs");
const path = require("path");
const { sha } = require("./http");

const PLAN_VERSION = 2;

function buildQueryPrompt(intent) {
  return `You write image search queries for Wikimedia Commons for a finance/business explainer video.
Media slot:
${JSON.stringify({ kind: intent.kind, entity: intent.entity || null, intent: intent.intent, mood: intent.mood || null, era: intent.era || null })}

Return JSON:
{
  "queries": [3 to 5 short Commons search strings: concrete nouns + proper names + place + era; 2-5 words each; no abstract words (no "crisis", "success", "concept"); most specific first; the last one broader],
  "wikidataSearch": the exact name to look up on Wikidata if the slot is about a named company, person, place, building, product or organisation, else null,
  "entityClass": 1-3 words for what that entity is (e.g. "airline", "central bank", "businessman", "port", "city"), else null,
  "rubric": one sentence a vision checker can apply: what the picture must clearly show to fit this slot, and what would make it wrong,
  "nasaRelevant": true only if NASA's image library could plausibly hold a fitting picture (space, Earth from orbit, aircraft/aviation research, rockets), else false
}
Rules: for kind "logo" include "<name> logo" as the first query; for kind "portrait" use the person's full name (+ a year if helpful); for kind "map" include "locator map" or "map".`;
}

function cleanQuery(q) {
  return String(q || "")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Normalise a model reply into a safe plan; always returns >= 1 query. */
function parseQueryPlan(raw, intent) {
  const r = raw && typeof raw === "object" ? raw : {};
  let queries = Array.isArray(r.queries) ? r.queries.map(cleanQuery).filter(Boolean) : [];
  queries = [...new Set(queries.map((q) => q.toLowerCase()))].map((l) => queries.find((q) => q.toLowerCase() === l)).slice(0, 5);
  const fb = fallbackPlan(intent);
  if (!queries.length) queries = fb.queries;
  const entityName = intent.entity || (typeof r.wikidataSearch === "string" && r.wikidataSearch.trim()) || null;
  return {
    v: PLAN_VERSION,
    queries,
    wikidataSearch: entityName,
    entityClass: typeof r.entityClass === "string" ? r.entityClass.trim().slice(0, 40) : null,
    rubric: typeof r.rubric === "string" && r.rubric.trim() ? r.rubric.trim().slice(0, 400) : fb.rubric,
    nasaRelevant: r.nasaRelevant === true,
  };
}

const STOP = new Set("a an the of on in at to for with and or from by its their his her showing shows photo image picture view".split(" "));

function fallbackPlan(intent) {
  const kw = String(intent.intent || "")
    .split(/[^A-Za-z0-9\-]+/)
    .filter((w) => w && !STOP.has(w.toLowerCase()));
  const queries = [];
  if (intent.entity) queries.push(intent.kind === "logo" ? `${intent.entity} logo` : intent.entity);
  if (kw.length) queries.push(kw.slice(0, 5).join(" "));
  if (kw.length > 2) queries.push(kw.slice(0, 3).join(" "));
  return {
    v: PLAN_VERSION,
    queries: queries.length ? [...new Set(queries)] : [String(intent.intent || "").slice(0, 60)],
    wikidataSearch: intent.entity || null,
    entityClass: null,
    rubric: `The picture clearly shows: ${intent.intent}.`,
    nasaRelevant: false,
  };
}

async function planQueries(intent, { gemini, cacheDir, log = () => {} } = {}) {
  const key = sha(JSON.stringify({ v: PLAN_VERSION, kind: intent.kind, entity: intent.entity || null, intent: intent.intent, mood: intent.mood || null, era: intent.era || null }));
  const file = cacheDir ? path.join(cacheDir, "_queries", key + ".json") : null;
  if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  let plan;
  if (!gemini) plan = fallbackPlan(intent);
  else {
    try {
      plan = parseQueryPlan(await gemini.json(buildQueryPrompt(intent), { temperature: 0 }), intent);
    } catch (err) {
      log(`  queries: model failed (${err.message}); using keyword plan`);
      return fallbackPlan(intent);
    }
  }
  if (file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(plan, null, 2));
  }
  return plan;
}

module.exports = { planQueries, buildQueryPrompt, parseQueryPlan, fallbackPlan };
