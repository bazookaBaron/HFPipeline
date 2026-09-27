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
const { vetFactSources } = require("./sourceQuality");

const NUMBERS_POLICY = "only facts[].value may be spoken or shown";
const ENTITY_KINDS = ["person", "company", "place", "org", "product", "concept"];

const topicHash = (topic) => crypto.createHash("sha1").update(String(topic).trim().toLowerCase().replace(/\s+/g, " ")).digest("hex").slice(0, 16);

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; } }
function writeJson(p, v) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2)); }

/**
 * Hook research (LF v2 §1): four extra grounded questions feed the outline's hook skeleton.
 *   myth    - the common belief / misconception and the counter-intuitive fact (the irony) that overturns it
 *   stakes  - 3+ hard numbers from geographically distinct places (place + figure + year)
 *   quote   - verbatim on-the-record lines by named authorities, with the outlet that reported them
 *   counter - the strongest counter-view, so conclusions stay balanced
 * The general questions shrink to 6-8 so grounding stays at <= 12 calls per topic.
 */
const HOOK_KINDS = ["myth", "stakes", "quote", "counter"];
const MAX_QUESTIONS = 12;

function planPrompt(topic) {
  return `You plan research for an 8-12 minute YouTube deep-dive on finance, business, economics or geo-finance.
Topic: "${topic}"
Audience: curious viewers worldwide aged 18-35 with no finance background (a global channel).

Return JSON: {"angle": "<the one viewer question the video answers, <= 20 words>",
 "questions": ["..."],
 "hookQuestions": {"myth": "...", "stakes": "...", "quote": "...", "counter": "..."}}
"questions": 7 research questions (at least 6, at most 8). Together they must cover:
- the business model / economic mechanism (how money actually comes in and goes out);
- origin and history, with years;
- the 2-4 turning points and the decisions behind them;
- the hard numbers (revenue, debt, losses, market share, GDP ratios, interest rates, with years);
- the key people and institutions and what each did;
- the current state (latest year available);
- any official data series worth charting (World Bank / IMF / central banks / company filings).
"hookQuestions" (one searchable question each, for the video's opening):
- myth: what most people believe about this topic, and the counter-intuitive fact (the irony) that overturns it;
- stakes: hard numbers with years showing what is at stake in 3 or more DIFFERENT countries or regions of the world;
- quote: short verbatim on-the-record statements about this topic by named authorities (heads of state, finance ministers,
  central bankers, IMF/World Bank/OECD officials, CEOs, well-known economists);
- counter: the strongest case against the usual story (what defenders or critics argue), with figures.
Each question must be specific and searchable (name the entity, period and metric). No investment angle.`;
}

const KIND_ASK = {
  myth: `Also state plainly (1) the common belief or misconception most people hold about this, naming who documents it (a survey, a
well-known commentator, mainstream coverage), and (2) the most counter-intuitive, surprising fact that overturns or complicates
it, with its figure, year and source.`,
  stakes: `Give at least 4 hard numbers from geographically DIFFERENT places (different countries or world regions), one per place,
each with the place, the figure, its unit and the year, and who reported it. Choose figures a viewer anywhere can feel (people,
jobs, prices, savings, debt per person, share of the economy).`,
  quote: `Give 1-3 short (under 35 words) verbatim quotes. Copy each quote word for word inside double quotes, exactly as the source
reports it, then give the speaker, their role, the date and the outlet or official transcript that reported it. Use only
official transcripts, speeches, filings, parliamentary records or established news outlets. No paraphrases, no social-media
reposts, no quote sites, no quotes you cannot attribute. If you find no verifiable quote, say so.`,
  counter: `Give the strongest counter-arguments to the usual narrative and who makes them, with figures and years. Where the
evidence is mixed, say what each side's best number is.`,
};

function researchPrompt(topic, q, kind) {
  return `Research this question for a documentary-style explainer on "${topic}". Use Google Search.
Question: ${q}
Answer in 250-450 words of plain factual prose. Give exact figures with their units, currency and year
(e.g. "Rs 9,000 crore in 2012", "38% of GDP in 2023"). Say who reported each figure. Prefer primary sources (company filings and annual reports, regulators,
central banks, government statistics, IMF/World Bank) and established business press; do not rely on
forums, Q&A sites, slide/document dumps or personal blogs. Where sources disagree,
give both figures and say so. Do not speculate and do not give investment advice.${KIND_ASK[kind] ? `\n${KIND_ASK[kind]}` : ""}`;
}

/** plan -> [{q, kind}] (general first, then the hook questions), capped at MAX_QUESTIONS. */
function planQuestions(plan) {
  const general = (plan.questions || []).filter(Boolean).map((q) => ({ q: String(q), kind: "general" }));
  const hook = HOOK_KINDS.map((k) => ({ q: plan.hookQuestions && plan.hookQuestions[k] ? String(plan.hookQuestions[k]) : "", kind: k })).filter((x) => x.q);
  return [...general.slice(0, MAX_QUESTIONS - hook.length), ...hook];
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
  "INR billion" (convert crore: 9,000 crore = 90 billion), "INR trillion", "USD million", "USD billion", "EUR billion", "%", "% of GDP",
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
- Neutral wording on countries and governments.

Also return, in the same JSON object, material for the video's opening hook:
 "hook": {"belief": {"text": "<what most people think about this, plain words, <= 20 words>", "factIds": ["F.."]},
          "irony": {"text": "<the counter-intuitive fact that overturns or complicates the belief, <= 25 words>", "factIds": ["F.."]},
          "stakes": [{"place": "<country or region>", "factId": "F.."}],
          "counterView": ["F.."]},
 "quotes": [{"id": "Q1", "text": "<the quote, copied EXACTLY as it appears in the notes, without the quotation marks>", "speaker": "<name>",
             "role": "<role at the time>", "year": <year or null>, "sourceIds": ["S4"]}]
- hook.stakes: 3-4 entries from DIFFERENT countries/regions, each pointing to a numeric fact (with a year where possible).
- hook.counterView: fact ids that carry the strongest counter-argument (add those facts if needed).
- quotes: 0-3 quotes that appear verbatim in the notes inside quotation marks, attributed to a named person, citing the source
  ids right after them. Never polish, shorten mid-sentence, merge or translate a quote; if unsure, leave it out.`;
}

const normQuote = (s) => String(s || "").toLowerCase().replace(/[‘’‛`´]/g, "'").replace(/[“”„"«»]/g, "").replace(/[–—]/g, "-").replace(/\s+/g, " ").replace(/^[\s'.,;:-]+|[\s'.,;:-]+$/g, "").trim();

/**
 * Quotes survive only when (a) the text appears verbatim in the grounded research notes (when the notes are given),
 * (b) a speaker is named and (c) at least one cited source is non-UGC. Returns [{id, text, speaker, role, year, sources}].
 */
function finalizeQuotes(rawQuotes, bySid, notesText) {
  const notes = notesText ? normQuote(notesText) : null;
  const out = [];
  (rawQuotes || []).forEach((q, i) => {
    if (!q || !q.text || !q.speaker) return;
    const text = String(q.text).replace(/^["“”'\s]+|["“”'\s]+$/g, "").replace(/\s+/g, " ").trim();
    if (text.split(" ").length < 4) return;
    if (notes && !notes.includes(normQuote(text))) return; // not verbatim in the grounded notes
    const cited = [...new Set(q.sourceIds || q.sources || [])].map((sid) => bySid[sid]).filter(Boolean).map((s) => ({ title: s.title, url: s.url }));
    const vet = vetFactSources(cited, true);
    if (!vet.keep) return; // needs a non-UGC source
    const year = q.year ? Number(String(q.year).match(/\d{4}/)?.[0]) || null : null;
    out.push({ id: `Q${out.length + 1}`, text, speaker: String(q.speaker).trim(), ...(q.role ? { role: String(q.role).trim() } : {}), ...(year ? { year } : {}), sources: vet.sources, rawId: q.id || `Q${i + 1}` });
  });
  return out.map(({ rawId, ...q }) => q);
}

/** Hook material: fact ids filtered to kept facts; stakes need a numeric fact and distinct places. */
function finalizeHook(rawHook, facts) {
  const byId = Object.fromEntries(facts.map((f) => [f.id, f]));
  const h = rawHook || {};
  const ids = (xs) => [...new Set((xs || []).map(String))].filter((x) => byId[x]);
  const part = (p) => (p && p.text ? { text: String(p.text).trim(), factIds: ids(p.factIds) } : null);
  const places = new Set();
  const stakes = [];
  (h.stakes || []).forEach((s) => {
    if (!s || !s.place || !byId[s.factId] || byId[s.factId].value === undefined) return;
    const key = String(s.place).toLowerCase().trim();
    if (places.has(key)) return;
    places.add(key);
    stakes.push({ place: String(s.place).trim(), factId: String(s.factId) });
  });
  return { belief: part(h.belief), irony: part(h.irony), stakes, counterView: ids(h.counterView) };
}

/** Normalise and validate the distilled dossier; source ids -> [{title, url}]. */
function finalizeDossier(raw, topic, angle, sources, notesText = null) {
  const bySid = Object.fromEntries(sources.map((s) => [s.sid, s]));
  const facts = [];
  const seen = new Set();
  (raw.facts || []).forEach((f, i) => {
    let id = String(f.id || `F${i + 1}`);
    if (seen.has(id)) id = `F${i + 1}x`;
    seen.add(id);
    const cited = [...new Set(f.sourceIds || f.sources || [])].map((sid) => bySid[typeof sid === "string" ? sid : sid && sid.sid]).filter(Boolean).map((s) => ({ title: s.title, url: s.url }));
    if (!cited.length) return; // unsourced: dropped
    let value = f.value === null || f.value === undefined || f.value === "" ? null : Number(String(f.value).replace(/,/g, ""));
    if (!Number.isFinite(value)) value = null;
    // source quality (sourceQuality.js): a figure needs a non-UGC source; UGC-only claims go low
    const vet = vetFactSources(cited, value !== null);
    if (!vet.keep) return;
    const srcs = vet.sources;
    const year = f.year ? Number(String(f.year).match(/\d{4}/)?.[0]) || null : null;
    let confidence = ["high", "medium", "low"].includes(f.confidence) ? f.confidence : "medium";
    if (confidence === "high" && srcs.length < 2) confidence = "medium";
    if (vet.ugcOnly) confidence = "low";
    // global audience: lakh / crore amounts become billion / trillion (1 crore = 1e7, 1 lakh crore = 1e12)
    let unit = String(f.unit || "").trim();
    const scale = unit.toLowerCase().split(/[^a-z]+/);
    if (value !== null && scale.includes("lakh") && scale.includes("crore")) unit = unit.replace(/lakh[^a-z]*crore/i, "trillion");
    else if (value !== null && (scale.includes("crore") || scale.includes("crores"))) {
      value = Math.round((value / 100) * 1000) / 1000;
      unit = unit.replace(/crores?/i, "billion");
    } else if (value !== null && (scale.includes("lakh") || scale.includes("lakhs"))) {
      value = Math.round((value / 10) * 1000) / 1000;
      unit = unit.replace(/lakhs?/i, "million");
    }
    facts.push({ id, claim: String(f.claim || "").trim(), ...(value !== null ? { value, unit } : {}), ...(year ? { year } : {}), sources: srcs, confidence });
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
    hook: finalizeHook(raw.hook, facts),
    quotes: finalizeQuotes(raw.quotes, bySid, notesText),
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
    plan = await g.json(planPrompt(topic), { temperature: 0.4, task: "research.plan" });
    const qs = planQuestions(plan);
    plan.questions = qs.map((x) => x.q);
    plan.kinds = qs.map((x) => x.kind);
    if (plan.questions.length < 8) throw new Error(`research plan has ${plan.questions.length} questions (need 8-12)`);
    writeJson(path.join(dir, "plan.json"), plan);
  }
  const kinds = plan.kinds || plan.questions.map(() => "general");
  log(`research: ${plan.questions.length} questions (${kinds.filter((k) => k !== "general").join(", ") || "no hook questions"}), angle: ${plan.angle}`);

  const answers = await pool(plan.questions, opts.concurrency || 3, async (q, i) => {
    const p = path.join(dir, "answers", `q${String(i + 1).padStart(2, "0")}.json`);
    const cached = !opts.force && readJson(p);
    if (cached && cached.question === q) return cached;
    log(`research: [${i + 1}/${plan.questions.length}] ${kinds[i] !== "general" ? `(${kinds[i]}) ` : ""}${q.slice(0, 90)}`);
    const a = await g.grounded(researchPrompt(topic, q, kinds[i]));
    a.chunks = await pool(a.chunks, 4, async (c) => ({ ...c, uri: await resolveRedirect(c.uri) }));
    const rec = { question: q, kind: kinds[i], ...a };
    writeJson(p, rec);
    return rec;
  });

  const reg = makeRegistry();
  const blocks = answers.map((a, i) => {
    const { text } = annotate(a, reg);
    return `Q${i + 1}${a.kind && a.kind !== "general" ? ` (${a.kind})` : ""}. ${a.question}\n${text}`;
  });
  log(`research: distilling ${reg.list.length} sources`);
  const raw = await g.json(distilPrompt(topic, plan.angle, blocks, reg.list), { temperature: 0.2, task: "research.distil" });
  const dossier = finalizeDossier(raw, topic, plan.angle, reg.list, answers.map((a) => a.text).join("\n"));
  log(`research: hook material: belief ${dossier.hook.belief ? "yes" : "no"}, irony ${dossier.hook.irony ? "yes" : "no"}, ${dossier.hook.stakes.length} stakes, ${dossier.hook.counterView.length} counter-view facts, ${dossier.quotes.length} verbatim quote(s)`);
  dossier.research = { questions: plan.questions, kinds, searchQueries: [...new Set(answers.flatMap((a) => a.queries || []))], model: g.model, at: new Date().toISOString() };
  if (dossier.facts.length < 12) throw new Error(`dossier has only ${dossier.facts.length} sourced facts`);
  writeJson(dossierPath, dossier);
  return dossier;
}

module.exports = { research, topicHash, finalizeDossier, finalizeQuotes, finalizeHook, planQuestions, planPrompt, researchPrompt, annotate, makeRegistry, normQuote, NUMBERS_POLICY, HOOK_KINDS };
