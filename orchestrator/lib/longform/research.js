"use strict";

/**
 * research.js (plan §4.1): topic -> dossier.json.
 *   1. plan    JSON call: angle + 8-12 research questions
 *   2. search  one Google-Search-grounded call per question (concurrency 3, retry/backoff);
 *              answer text is annotated with [S#] source markers from groundingSupports
 *   3. distil  JSON call over the annotated answers -> facts/timeline/entities/dataAsks/glossary;
 *              facts cite source ids only, which are mapped back to {title, url} here, so the
 *              model can never invent a URL
 * Cached per topic hash under cacheDir: plan.json, answers/q<N>.json, dossier.json.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { loadGeminiRest, pool } = require("./gemini");

const NUMBERS_POLICY = "only facts[].value may be spoken or shown";
const ENTITY_KINDS = ["person", "company", "place", "org", "product", "concept"];

const topicHash = (topic) => crypto.createHash("sha1").update(String(topic).trim().toLowerCase().replace(/\s+/g, " ")).digest("hex").slice(0, 16);

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; } }
function writeJson(p, v) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2)); }

function planPrompt(topic) {
  return `You plan research for an 8-12 minute YouTube deep-dive on finance, business, economics or geo-finance.
Topic: "${topic}"
Audience: curious Indian viewers aged 18-35 with no finance background.

Return JSON: {"angle": "<the one viewer question the video answers, <= 20 words>",
 "questions": ["..."]}
Write 10 research questions (at least 8, at most 12). Together they must cover:
- the business model / economic mechanism (how money actually comes in and goes out);
- origin and history, with years;
- the 2-4 turning points and the decisions behind them;
- the hard numbers (revenue, debt, losses, market share, GDP ratios, interest rates, with years);
- the key people and institutions and what each did;
- the current state (latest year available);
- counter-views, contested figures, and what defenders or critics say;
- any official data series worth charting (World Bank / IMF / RBI / company filings).
Each question must be specific and searchable (name the entity, period and metric). No investment angle.`;
}

function researchPrompt(topic, q) {
  return `Research this question for a documentary-style explainer on "${topic}". Use Google Search.
Question: ${q}
Answer in 250-450 words of plain factual prose. Give exact figures with their units, currency and year
(e.g. "Rs 9,000 crore in 2012", "38% of GDP in 2023"). Say who reported each figure. Where sources disagree,
give both figures and say so. Do not speculate and do not give investment advice.`;
}

/** Insert [S#] markers after each supported segment; returns {text, sources: [{sid, title, uri}]}. */
function annotate(ans, registry) {
  const localToGlobal = ans.chunks.map((c) => registry.add(c));
  let text = ans.text;
  const inserts = [];
  for (const s of ans.supports || []) {
    const seg = s.segment && s.segment.text;
    if (!seg) continue;
    const at = text.indexOf(seg);
    if (at < 0) continue;
    const sids = [...new Set((s.groundingChunkIndices || []).map((i) => localToGlobal[i]).filter(Boolean))];
    if (sids.length) inserts.push({ pos: at + seg.length, mark: ` [${sids.join(",")}]` });
  }
  inserts.sort((a, b) => b.pos - a.pos).forEach(({ pos, mark }) => { text = text.slice(0, pos) + mark + text.slice(pos); });
  return { text, sids: [...new Set(localToGlobal.filter(Boolean))] };
}

function makeRegistry() {
  const byUri = new Map();
  const list = [];
  return {
    add(c) {
      if (!c || !c.uri) return null;
      if (!byUri.has(c.uri)) { const sid = `S${list.length + 1}`; byUri.set(c.uri, sid); list.push({ sid, title: c.title || "", url: c.uri }); }
      return byUri.get(c.uri);
    },
    list,
  };
}

/** Grounding chunk URIs are redirect links; follow one hop (HEAD, no body) to record the publisher URL. */
async function resolveRedirect(url) {
  if (!/grounding-api-redirect|vertexaisearch/.test(url)) return url;
  try {
    const r = await fetch(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(15000) });
    const loc = r.headers.get("location");
    return loc && /^https?:/.test(loc) ? loc : url;
  } catch { return url; }
}

function distilPrompt(topic, angle, blocks, sources) {
  return `You turn grounded research notes into a fact dossier for a YouTube explainer on "${topic}".
Angle: ${angle}

SOURCES (id: title):
${sources.map((s) => `${s.sid}: ${s.title}`).join("\n")}

RESEARCH NOTES (markers like [S3,S7] show which sources support the text right before them):
${blocks.join("\n\n")}

Return JSON exactly:
{"topic": "...", "angle": "...", "summary": "<3-4 plain sentences>",
 "facts": [{"id": "F1", "claim": "<one checkable sentence>", "value": <number or null>, "unit": "<unit>", "year": <year or null>, "sourceIds": ["S3"], "confidence": "high|medium|low"}],
 "timeline": [{"year": <year>, "event": "...", "factIds": ["F2"]}],
 "entities": [{"name": "...", "kind": "person|company|place|org|product|concept"}],
 "dataAsks": [{"metric": "...", "country": "<ISO3 or null>", "years": [<from>, <to>], "worldBankIndicator": "<code or null>"}],
 "glossary": [{"term": "...", "plain": "<explanation a 13-year-old understands, <= 14 words>"}]}

Rules:
- 30-50 facts. Only facts stated in the notes, each citing 1+ source ids that appear right after it. Never invent a source id.
- Numeric facts: "value" is the bare number as reported (9000, not "9,000"); "unit" carries currency and scale word, from:
  "INR crore", "INR lakh crore" (write value in lakh crore), "INR billion", "USD million", "USD billion", "EUR billion", "%", "% of GDP",
  "aircraft", "employees", "people", "litres per day", "years", or another plain count noun. Percentages: value 38, unit "%".
  Keep one figure per fact. If sources disagree, add both as separate facts and set confidence "low".
- confidence: high = 2+ sources agree; medium = one reputable source; low = contested or estimate.
- Non-numeric facts (events, decisions, causes) have value null.
- timeline: 8-15 dated events in order, each tied to fact ids.
- entities: every company, person, place, institution and product the video could show (5-25).
- dataAsks: series worth a chart. Use a real World Bank WDI indicator code when one fits (e.g. DT.DOD.DECT.GN.ZS external debt % of GNI,
  GC.DOD.TOTL.GD.ZS central government debt % of GDP, NY.GDP.MKTP.CD GDP US$, FP.CPI.TOTL.ZG inflation, BN.CAB.XOKA.GD.ZS current account % of GDP,
  FI.RES.TOTL.MO reserves in months of imports, DT.TDS.DECT.GN.ZS debt service % of GNI); otherwise worldBankIndicator null (company data).
- glossary: 6-14 finance/economics terms the script will likely need (e.g. "debt restructuring", "working capital", "current account deficit"),
  each with a plain, everyday explanation. Not generic words like "money".
- Neutral wording on countries and governments.`;
}

/** Normalise and validate the distilled dossier; source ids -> [{title, url}]. */
function finalizeDossier(raw, topic, angle, sources) {
  const bySid = Object.fromEntries(sources.map((s) => [s.sid, s]));
  const facts = [];
  const seen = new Set();
  (raw.facts || []).forEach((f, i) => {
    let id = String(f.id || `F${i + 1}`);
    if (seen.has(id)) id = `F${i + 1}x`;
    seen.add(id);
    const srcs = [...new Set(f.sourceIds || f.sources || [])].map((sid) => bySid[typeof sid === "string" ? sid : sid && sid.sid]).filter(Boolean).map((s) => ({ title: s.title, url: s.url }));
    if (!srcs.length) return; // unsourced: dropped
    let value = f.value === null || f.value === undefined || f.value === "" ? null : Number(String(f.value).replace(/,/g, ""));
    if (!Number.isFinite(value)) value = null;
    const year = f.year ? Number(String(f.year).match(/\d{4}/)?.[0]) || null : null;
    let confidence = ["high", "medium", "low"].includes(f.confidence) ? f.confidence : "medium";
    if (confidence === "high" && srcs.length < 2) confidence = "medium";
    facts.push({ id, claim: String(f.claim || "").trim(), ...(value !== null ? { value, unit: String(f.unit || "").trim() } : {}), ...(year ? { year } : {}), sources: srcs, confidence });
  });
  const ids = new Set(facts.map((f) => f.id));
  const timeline = (raw.timeline || []).map((t) => ({ year: Number(String(t.year).match(/\d{4}/)?.[0]) || null, event: String(t.event || ""), factIds: (t.factIds || []).filter((x) => ids.has(x)) }))
    .filter((t) => t.year && t.event).sort((a, b) => a.year - b.year);
  const entities = (raw.entities || []).filter((e) => e && e.name).map((e) => ({ name: String(e.name), kind: ENTITY_KINDS.includes(e.kind) ? e.kind : "concept", ...(e.wikidata ? { wikidata: e.wikidata } : {}) }));
  const dataAsks = (raw.dataAsks || []).filter((d) => d && d.metric).map((d) => ({
    metric: String(d.metric), ...(d.country ? { country: String(d.country) } : {}),
    years: Array.isArray(d.years) ? d.years.map(Number).filter(Number.isFinite).slice(0, 2) : [],
    ...(d.worldBankIndicator && /^[A-Z]{2}\.[A-Z0-9.]+$/.test(d.worldBankIndicator) ? { worldBankIndicator: d.worldBankIndicator } : {}),
  }));
  const glossary = (raw.glossary || []).filter((g) => g && g.term && g.plain).map((g) => ({ term: String(g.term).trim(), plain: String(g.plain).trim() }));
  return {
    topic, angle: raw.angle || angle, summary: raw.summary || "",
    facts, timeline, entities, dataAsks, glossary,
    sources: sources.map((s) => ({ id: s.sid, title: s.title, url: s.url })),
    numbersPolicy: NUMBERS_POLICY,
  };
}

/**
 * @param {string} topic
 * @param {{cacheDir: string, force?: boolean, log?: Function, gemini?: object, concurrency?: number}} opts
 */
async function research(topic, opts = {}) {
  const log = opts.log || (() => {});
  const dir = path.join(opts.cacheDir || path.join(process.cwd(), ".lf-cache"), topicHash(topic));
  const dossierPath = path.join(dir, "dossier.json");
  if (!opts.force && fs.existsSync(dossierPath)) { log(`research: cached dossier ${dossierPath}`); return readJson(dossierPath); }
  const g = opts.gemini || loadGeminiRest({ log });

  let plan = !opts.force && readJson(path.join(dir, "plan.json"));
  if (!plan) {
    log("research: planning questions");
    plan = await g.json(planPrompt(topic), { temperature: 0.4 });
    plan.questions = (plan.questions || []).filter(Boolean).slice(0, 12);
    if (plan.questions.length < 8) throw new Error(`research plan has ${plan.questions.length} questions (need 8-12)`);
    writeJson(path.join(dir, "plan.json"), plan);
  }
  log(`research: ${plan.questions.length} questions, angle: ${plan.angle}`);

  const answers = await pool(plan.questions, opts.concurrency || 3, async (q, i) => {
    const p = path.join(dir, "answers", `q${String(i + 1).padStart(2, "0")}.json`);
    const cached = !opts.force && readJson(p);
    if (cached && cached.question === q) return cached;
    log(`research: [${i + 1}/${plan.questions.length}] ${q.slice(0, 90)}`);
    const a = await g.grounded(researchPrompt(topic, q));
    a.chunks = await pool(a.chunks, 4, async (c) => ({ ...c, uri: await resolveRedirect(c.uri) }));
    const rec = { question: q, ...a };
    writeJson(p, rec);
    return rec;
  });

  const reg = makeRegistry();
  const blocks = answers.map((a, i) => {
    const { text } = annotate(a, reg);
    return `Q${i + 1}. ${a.question}\n${text}`;
  });
  log(`research: distilling ${reg.list.length} sources`);
  const raw = await g.json(distilPrompt(topic, plan.angle, blocks, reg.list), { temperature: 0.2 });
  const dossier = finalizeDossier(raw, topic, plan.angle, reg.list);
  dossier.research = { questions: plan.questions, searchQueries: [...new Set(answers.flatMap((a) => a.queries || []))], model: g.model, at: new Date().toISOString() };
  if (dossier.facts.length < 12) throw new Error(`dossier has only ${dossier.facts.length} sourced facts`);
  writeJson(dossierPath, dossier);
  return dossier;
}

module.exports = { research, topicHash, finalizeDossier, annotate, makeRegistry, NUMBERS_POLICY };
