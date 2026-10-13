#!/usr/bin/env node
"use strict";

/**
 * generate-topics.js — real Gemini call producing a batch of distinct CS/tech-explainer
 * topics for a content calendar. Lives in orchestrator/ (not control-panel/, which is
 * intentionally zero-dependency) so it can reuse the @google/generative-ai + dotenv
 * dependencies already installed here for generate-video.js / generate-carousel.js.
 *
 * Usage:
 *   node generate-topics.js --count 30 [--avoid-file <path-to-json-array-of-strings>]
 *   node generate-topics.js --format long [--weeks 4] [--days mon,tue,thu,sat] [--start YYYY-MM-DD]
 *        [--count N] [--avoid-file <json array>] [--no-past]
 *     16:9 finance deep-dive calendar; stdout line is
 *     [{date, topic, category, angle, entities, region, whyNow?}, ...] (count defaults to weeks * days).
 *
 * Progress goes to stderr. On success, exactly one final JSON line on stdout:
 *   [{"topic": "...", "category": "..."}, ...]
 * On failure: non-zero exit, clear stderr message, no stdout JSON line.
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

function log(msg) {
  process.stderr.write(`[generate-topics] ${msg}\n`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args[key] = true;
    else { args[key] = next; i += 1; }
  }
  return args;
}

function loadApiKey() {
  if (process.env.GEMINI_API_KEY) {
    log("Using GEMINI_API_KEY already present in the environment.");
    return process.env.GEMINI_API_KEY;
  }
  const scriptingEnv = path.resolve(__dirname, "..", "scripting-pipeline", ".env");
  if (fs.existsSync(scriptingEnv)) {
    const parsed = dotenv.parse(fs.readFileSync(scriptingEnv));
    if (parsed.GEMINI_API_KEY) {
      log(`Loaded GEMINI_API_KEY from ${scriptingEnv} (value not logged).`);
      return parsed.GEMINI_API_KEY;
    }
  }
  return null;
}

function buildPrompt(count, avoidTopics) {
  const avoidBlock = avoidTopics.length
    ? `\n\nDo not repeat or closely rephrase any of these already-used topics:\n${avoidTopics.map((t) => `- ${t}`).join("\n")}`
    : "";
  return `Plan ${count} distinct topics for a CS/tech explainer calendar. Each topic becomes a 45–55 second vertical v3 video and may also become a carousel. Return exactly ${count} ideas that can each be explained clearly in that time.

For every topic, identify a concrete question, surprising tension, or tradeoff; a teachable technical mechanism that answers it; and a practical consequence for users, developers, or systems. The topic string should make the question or tension specific enough to guide a script. Prefer a single mechanism over a broad survey, listicle, or vague trend. Mix lenses: a plausible fix that fails under a specific condition; an everyday example that reveals an abstract mechanism; and the engineering choice behind a platform or company. Do not force every topic into a failure/redesign story. Avoid claims of guaranteed virality and precise numerical claims unless established and necessary.

Write each "topic" as a concise, beginner-friendly viewer question, usually 6-14 words, about ONE idea. Use everyday words a curious non-engineer knows. Avoid acronyms, named algorithms, protocol names, and stacked technical terms in the displayed title; keep the technical mechanism for the video script. Prefer "Why do websites slow down when too many people visit?" over "How Kubernetes schedules pods based on resource requests, limits, and node affinity". Prefer "How can your phone find a photo so quickly?" over a title about search indexes or data structures. Do NOT append a colon and an entire explanation to the title; the video script will explain the mechanism. Avoid absolute claims such as "never fails", "guarantees", or "without performance loss". Do not assert a company's private implementation or a single cause of complex behaviour as fact unless it is public and well established; phrase uncertain ideas as questions or choose a better-documented mechanism.

Balance the calendar across computer science fundamentals, software engineering, AI mechanisms, platforms/infrastructure, and the technology behind real companies or products. Use "company-tech" only when the topic names an actual company and a publicly documented engineering choice; tools/projects such as Git belong in a technical category. Company-tech topics must not become company news or promotion. Do not let AI or any one company/industry dominate. Vary categories and mechanisms as well as wording.

Use a short category tag such as "algorithms", "networking", "databases", "software-engineering", "ai", "platforms", or "company-tech". Do not copy titles from reference videos.${avoidBlock}

Return ONLY a JSON array of exactly ${count} objects, each shaped: {"topic": "...", "category": "..."}. No other text.`;
}

function cleanTopic(item) {
  if (!item || typeof item.topic !== "string") return null;
  const topic = item.topic.replace(/^\s*(?:\d+[.)]|[-*])\s*/, "").replace(/\s+/g, " ").trim();
  if (!topic) return null;
  const category = typeof item.category === "string" ? item.category.replace(/\s+/g, " ").trim() : "";
  return { topic, category: category || "uncategorized" };
}

const COMMON_WORDS = new Set(["a", "an", "and", "are", "can", "do", "does", "for", "how", "in", "is", "of", "on", "the", "to", "what", "when", "why", "with", "work", "works", "actually", "really"]);

function topicWords(topic) {
  return new Set(topic.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z])[-–—]([a-z])/g, "$1 $2")
    .match(/[a-z0-9]+/g)?.map((word) => word.length > 4 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word)
    .filter((word) => !COMMON_WORDS.has(word)) || []);
}

function isNearDuplicate(a, b) {
  const left = topicWords(a);
  const right = topicWords(b);
  if (!left.size || !right.size) return a.toLowerCase() === b.toLowerCase();
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared >= 2 && shared / Math.min(left.size, right.size) >= 0.8 &&
    shared / Math.max(left.size, right.size) >= 0.6;
}

function appendUnique(raw, accepted, avoidTopics, count) {
  if (!Array.isArray(raw)) throw new Error("Gemini did not return a topic array");
  for (const item of raw) {
    if (accepted.length >= count) break;
    const cleaned = cleanTopic(item);
    if (!cleaned) continue;
    if ([...avoidTopics, ...accepted.map((entry) => entry.topic)].some((topic) => isNearDuplicate(cleaned.topic, topic))) continue;
    accepted.push(cleaned);
  }
}

async function collectTopics(count, avoidTopics, generateBatch, maxAttempts = 3) {
  const accepted = [];
  for (let attempt = 1; attempt <= maxAttempts && accepted.length < count; attempt++) {
    const remaining = count - accepted.length;
    const raw = await generateBatch(remaining, [...avoidTopics, ...accepted.map((entry) => entry.topic)]);
    appendUnique(raw, accepted, avoidTopics, count);
    if (accepted.length < count) log(`Batch ${attempt} yielded ${accepted.length}/${count} unique topics; requesting ${count - accepted.length} more.`);
  }
  if (accepted.length < count) throw new Error(`Only ${accepted.length}/${count} unique topics after ${maxAttempts} batches`);
  return accepted;
}

function extractJsonArray(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  return JSON.parse(candidate);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.format === "long") return mainLong(args);
  if (args.format !== undefined && args.format !== "short") throw new Error("--format must be 'short' or 'long'");
  const count = args.count === undefined ? 30 : Number(args.count);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("--count must be a positive integer");
  let avoidTopics = [];
  if (typeof args["avoid-file"] === "string" && fs.existsSync(args["avoid-file"])) {
    try {
      avoidTopics = JSON.parse(fs.readFileSync(args["avoid-file"], "utf-8"));
      if (!Array.isArray(avoidTopics)) avoidTopics = [];
      avoidTopics = avoidTopics.filter((topic) => typeof topic === "string" && topic.trim()).map((topic) => topic.trim());
    } catch {
      avoidTopics = [];
    }
  }

  const apiKey = loadApiKey();
  if (!apiKey) {
    process.stderr.write("Error: GEMINI_API_KEY not found (expected in scripting-pipeline/.env or the process environment)\n");
    process.exit(1);
    return;
  }

  const modelName = require("./lib/ai/models").modelFor("topics");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 16384,
      // Deliberately no responseSchema -- see orchestrator/lib/carousel/geminiCarousel.js's own
      // comment: a large flat per-item schema empirically made this model satisfice at a 1-item
      // array regardless of prompt wording. Plain JSON mime type + a clear prompt + our own
      // length check is the proven-reliable approach for a flat list like this one.
    },
  });

  log(`Calling Gemini (model=${modelName}) for a ${count}-topic calendar (avoiding ${avoidTopics.length} prior topics)...`);
  let cleaned;
  try {
    cleaned = await collectTopics(count, avoidTopics, async (remaining, excluded) => {
      const result = await model.generateContent(buildPrompt(remaining, excluded));
      return extractJsonArray(result.response.text());
    });
  } catch (err) {
    process.stderr.write(`Topic generation failed: ${err.message}\n`);
    process.exit(1);
    return;
  }

  log(`Returning ${cleaned.length} topics.`);
  process.stdout.write(JSON.stringify(cleaned) + "\n");
}

// ---------------------------------------------------------------------------------------------
// Long-form (16:9) finance deep-dive calendar: `--format long`. Separate prompt, richer items
// ({topic, category, angle, entities, region, whyNow?}, plus a scheduled date), stricter safety
// cleaning, entity-aware near-duplicate filtering against the long-form avoid list and past
// make-longform outputs, soft category/region balance, and a 4-days-a-week schedule.
// The short (9:16) path above is untouched.
// ---------------------------------------------------------------------------------------------

const LONG_CATEGORIES = ["business-model", "collapse-turnaround", "country-economics", "sectors-commodities", "money-systems"];
const LONG_CATEGORY_ALIASES = [
  ["collapse-turnaround", /collapse|bankrupt|turnaround|crisis|failure|comeback|rescue|insolven/],
  ["country-economics", /country|sovereign|nation|debt|currency|trade|macro|econom|geo/],
  ["sectors-commodities", /sector|commodit|industry|oil|gold|metal|agri|energy/],
  ["money-systems", /money|system|bank|payment|tax|monetary|market|finance/],
  ["business-model", /business|company|brand|model|strategy|corporate/],
];
const LONG_DEFAULT_DAYS = ["mon", "tue", "thu", "sat"];
const WEEKDAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
// advice / sensational / defamatory framing is never allowed in a long-form title or hook
const LONG_BANNED = /\b(buy|sell|buying|selling|multibaggers?|best stocks?|stocks? to (?:buy|watch)|should you (?:buy|invest)|price targets?|get rich|guaranteed returns?|scams?|scammers?|fraudsters?|looted|looters?|thief|thieves|crooks?|shocking|exposed)\b/i;
// very broad entities that many unrelated topics share -- not used for entity-level dedup
const BROAD_ENTITIES = new Set(["india", "china", "us", "usa", "united states", "america", "europe", "european union", "eu", "world", "global", "uk", "united kingdom", "asia", "south asia", "rbi", "reserve bank of india", "imf", "international monetary fund", "world bank"]);
const ENTITY_GENERIC = new Set(["the", "of", "and", "ltd", "limited", "inc", "corp", "corporation", "company", "co", "group", "holdings", "industries", "airlines", "airline", "plc", "pvt", "private"]);

function buildLongPrompt(count, avoidTopics, mix = {}) {
  const avoidBlock = avoidTopics.length
    ? `\n\nDo not repeat, closely rephrase, or re-cover the main subject of any of these already-used or already-planned long-form topics:\n${avoidTopics.map((t) => `- ${t}`).join("\n")}`
    : "";
  const mixBlock = Object.keys(mix).length
    ? `\n\nAlready planned per category (${LONG_CATEGORIES.map((c) => `${c}: ${mix[c] || 0}`).join(", ")}); favour the categories with the fewest.`
    : "";
  return `Plan ${count} distinct topics for a YouTube finance deep-research channel. Each topic becomes an 8-12 minute 16:9 documentary-style explainer split into chapters, told in very simple language with examples and light humour, for a GLOBAL English-speaking audience. Return exactly ${count} ideas.

The channel's style, from real titles: "Deep research on the business model of Amul", "Why Kingfisher went bankrupt", "What's the financial burden of Europe", "How Pakistan fell into a debt trap", "How should we research commodities before investing". Do not copy these; match their spirit: one clear question with a story behind it, researchable from public, reputable sources (annual reports, regulators, central banks, IMF/World Bank data, court records, major newspapers).

Categories (use exactly these tags, balanced across the calendar):
- "business-model": how a company (from any country) actually makes money: moat, unit economics, distribution.
- "collapse-turnaround": documented corporate collapses, bankruptcies or turnarounds and the mechanics behind them.
- "country-economics": sovereign and national economics: debt, currency, trade, budgets, bailouts, inflation.
- "sectors-commodities": how a sector or commodity works and how to research it, as education only, never advice.
- "money-systems": money systems explained: banking, payments, credit, taxes, central banks, market plumbing.

Audience mix: this is a global channel. About 75% of topics are international (the US, Europe, China, Japan, Latin America, the Middle East, Africa, global companies and world systems), spread across regions; at most about 25% are centred on India or South Asia. Pick stories a viewer anywhere would find interesting.

Rules:
- Neutral, factual framing. No sensational or defamatory wording: never call people or companies scammers, frauds, thieves or crooks; for a documented case use neutral terms such as "accounting scandal" or "insolvency" and stay within what courts, regulators or filings established.
- Never investment advice: no "buy", "sell", "best stocks", price targets, "should you invest" or return promises. Sector and commodity topics teach how something works or how to research it.
- Geopolitics: neutral and even-handed; explain the economics, never take a side or blame a nation or its people.
- Prefer one well-documented story over a broad survey. Avoid breaking news that cannot be researched properly yet.
- No two topics about the same main company, country or commodity.

For every topic return:
- "topic": the viewer-facing title, 5-12 words, a question or a plain statement, no colon-plus-subtitle.
- "category": one of the five tags above.
- "angle": a one-line hook question the video answers (e.g. "How does a cooperative owned by farmers outsell global giants?").
- "entities": 1-4 main named entities (companies, countries, institutions, commodities; people only when central and public), main subject first; used for image search.
- "region": "india", "south-asia" or "global".
- "whyNow": a short reason it is timely, or "" if evergreen.${avoidBlock}${mixBlock}

Return ONLY a JSON array of exactly ${count} objects shaped {"topic": "...", "category": "...", "angle": "...", "entities": ["..."], "region": "...", "whyNow": "..."}. No other text.`;
}

function normalizeLongCategory(value) {
  const c = typeof value === "string" ? value.toLowerCase().replace(/[_\s/]+/g, "-").trim() : "";
  if (LONG_CATEGORIES.includes(c)) return c;
  for (const [cat, re] of LONG_CATEGORY_ALIASES) if (re.test(c)) return cat;
  return null;
}

function oneLine(value, max) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function cleanLongTopic(item) {
  if (!item || typeof item.topic !== "string") return null;
  const topic = item.topic.replace(/^\s*(?:\d+[.)]|[-*])\s*/, "").replace(/\s+/g, " ").trim().replace(/^["']+|["']+$/g, "").trim();
  if (!topic || topic.length > 110) return null;
  const angle = oneLine(item.angle, 200);
  if (!angle) return null;
  if (LONG_BANNED.test(topic) || LONG_BANNED.test(angle)) return null;
  const category = normalizeLongCategory(item.category);
  if (!category) return null;
  const seen = new Set();
  const rawEntities = Array.isArray(item.entities) ? item.entities : typeof item.entities === "string" ? item.entities.split(/[,;]/) : [];
  const entities = rawEntities
    .map((e) => oneLine(e, 60))
    .filter((e) => e && !seen.has(e.toLowerCase()) && seen.add(e.toLowerCase()))
    .slice(0, 4);
  if (!entities.length) return null;
  const regionRaw = typeof item.region === "string" ? item.region.toLowerCase().trim() : "";
  const region = ["india", "south-asia", "global"].includes(regionRaw) ? regionRaw : "global";
  const out = { topic, category, angle, entities, region };
  const whyNow = oneLine(item.whyNow, 160);
  if (whyNow) out.whyNow = whyNow;
  return out;
}

function stem(word) {
  return word.length > 4 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

function normWords(text) {
  return (String(text).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’]s\b/g, "").match(/[a-z0-9]+/g) || []);
}

/** Distinctive words of an entity ("Kingfisher Airlines Ltd" -> ["kingfisher"]); null for broad ones. */
function entityCore(entity) {
  const words = normWords(entity);
  if (!words.length || BROAD_ENTITIES.has(words.join(" "))) return null;
  const core = words.filter((w) => !ENTITY_GENERIC.has(w)).map(stem);
  return core.length ? core : null;
}

function mentionsEntity(text, entity) {
  const core = entityCore(entity);
  if (!core) return false;
  const words = new Set(normWords(text).map(stem));
  return core.every((w) => words.has(w));
}

/** Long-form duplicate: near-duplicate wording, or the same main (non-broad) subject. */
function isLongDuplicate(candidate, avoidTopics, accepted = []) {
  const main = candidate.entities[0];
  const mainCore = entityCore(main);
  for (const prior of avoidTopics) {
    if (isNearDuplicate(candidate.topic, prior) || mentionsEntity(prior, main)) return true;
  }
  for (const other of accepted) {
    if (isNearDuplicate(candidate.topic, other.topic) || mentionsEntity(other.topic, main) || mentionsEntity(candidate.topic, other.entities[0])) return true;
    const otherCore = entityCore(other.entities[0]);
    // same main subject: one entity's distinctive words contain the other's ("Amul" vs "Amul Dairy")
    if (mainCore && otherCore && (mainCore.every((w) => otherCore.includes(w)) || otherCore.every((w) => mainCore.includes(w)))) return true;
  }
  return false;
}

function longCaps(count) {
  return {
    category: Math.ceil(count / LONG_CATEGORIES.length) + 1,
    // global channel: India/South Asia at most ~30%, international at least ~70%
    local: Math.max(1, Math.ceil(count * 0.3)),
    global: Math.max(1, Math.ceil(count * 0.9)),
  };
}

function appendUniqueLong(raw, accepted, avoidTopics, count, { enforceBalance = true } = {}) {
  if (!Array.isArray(raw)) throw new Error("Gemini did not return a topic array");
  const caps = longCaps(count);
  for (const item of raw) {
    if (accepted.length >= count) break;
    const cleaned = cleanLongTopic(item);
    if (!cleaned) continue;
    if (isLongDuplicate(cleaned, avoidTopics, accepted)) continue;
    if (enforceBalance) {
      if (accepted.filter((a) => a.category === cleaned.category).length >= caps.category) continue;
      const local = cleaned.region !== "global";
      if (accepted.filter((a) => (a.region !== "global") === local).length >= (local ? caps.local : caps.global)) continue;
    }
    accepted.push(cleaned);
  }
}

async function collectLongTopics(count, avoidTopics, generateBatch, maxAttempts = 3) {
  const accepted = [];
  for (let attempt = 1; attempt <= maxAttempts && accepted.length < count; attempt++) {
    const remaining = count - accepted.length;
    const mix = {};
    for (const a of accepted) mix[a.category] = (mix[a.category] || 0) + 1;
    const raw = await generateBatch(remaining, [...avoidTopics, ...accepted.map((entry) => entry.topic)], mix);
    // balance is a preference: the last attempt relaxes it rather than failing the calendar
    appendUniqueLong(raw, accepted, avoidTopics, count, { enforceBalance: attempt < maxAttempts });
    if (accepted.length < count) log(`Long batch ${attempt} yielded ${accepted.length}/${count} usable topics; requesting ${count - accepted.length} more.`);
  }
  if (accepted.length < count) throw new Error(`Only ${accepted.length}/${count} unique long-form topics after ${maxAttempts} batches`);
  return accepted;
}

function parseDays(value) {
  const list = (Array.isArray(value) ? value : typeof value === "string" && value.trim() ? value.split(",") : LONG_DEFAULT_DAYS)
    .map((d) => String(d).trim().toLowerCase().slice(0, 3))
    .filter((d) => d in WEEKDAY_INDEX);
  const unique = [...new Set(list)].sort((a, b) => ((WEEKDAY_INDEX[a] + 6) % 7) - ((WEEKDAY_INDEX[b] + 6) % 7));
  if (!unique.length) throw new Error("--days must list weekdays like mon,tue,thu,sat");
  return unique;
}

function localIsoDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `count` publish dates on the chosen weekdays, starting at `start` (YYYY-MM-DD, inclusive). */
function scheduleDates(count, { days = LONG_DEFAULT_DAYS, start = localIsoDate() } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || Number.isNaN(Date.parse(`${start}T00:00:00Z`))) throw new Error(`start must be YYYY-MM-DD, got ${start}`);
  const wanted = new Set(parseDays(days).map((d) => WEEKDAY_INDEX[d]));
  const cursor = new Date(`${start}T00:00:00Z`);
  const out = [];
  while (out.length < count) {
    if (wanted.has(cursor.getUTCDay())) out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** Topics/titles of past make-longform runs (any `<dir>/<run>/outline.json`). */
function loadPastLongformTitles(dirs) {
  const titles = [];
  for (const dir of dirs) {
    let runs = [];
    try { runs = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()); } catch { continue; }
    for (const run of runs) {
      try {
        const outline = JSON.parse(fs.readFileSync(path.join(dir, run.name, "outline.json"), "utf-8"));
        for (const t of [outline.topic, outline.title]) if (typeof t === "string" && t.trim()) titles.push(t.trim());
      } catch { /* not a long-form run */ }
    }
  }
  return [...new Set(titles)];
}

const DEFAULT_PAST_LF_DIRS = [
  path.resolve(__dirname, "..", "out", "lf"),
  path.resolve(__dirname, "..", "control-panel", "data", "renders"),
];

function readAvoidFile(file) {
  if (typeof file !== "string" || !fs.existsSync(file)) return [];
  try {
    const list = JSON.parse(fs.readFileSync(file, "utf-8"));
    return Array.isArray(list) ? list.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim()) : [];
  } catch {
    return [];
  }
}

async function mainLong(args) {
  const weeks = args.weeks === undefined ? 4 : Number(args.weeks);
  if (!Number.isSafeInteger(weeks) || weeks < 1 || weeks > 12) throw new Error("--weeks must be an integer 1-12");
  const days = parseDays(args.days);
  const count = args.count === undefined ? weeks * days.length : Number(args.count);
  if (!Number.isSafeInteger(count) || count < 1 || count > 60) throw new Error("--count must be an integer 1-60");
  const start = typeof args.start === "string" ? args.start : localIsoDate();
  const avoidTopics = [...new Set([...readAvoidFile(args["avoid-file"]), ...(args["no-past"] ? [] : loadPastLongformTitles(DEFAULT_PAST_LF_DIRS))])];

  const apiKey = loadApiKey();
  if (!apiKey) {
    process.stderr.write("Error: GEMINI_API_KEY not found (expected in scripting-pipeline/.env or the process environment)\n");
    process.exit(1);
    return;
  }
  const modelName = require("./lib/ai/models").modelFor("topics");
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: modelName,
    // no responseSchema, same reason as the short path above
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: 16384 },
  });

  log(`Calling Gemini (model=${modelName}) for a ${count}-topic long-form calendar on ${days.join("/")} (avoiding ${avoidTopics.length} prior topics)...`);
  let topics;
  try {
    topics = await collectLongTopics(count, avoidTopics, async (remaining, excluded, mix) => {
      const result = await model.generateContent(buildLongPrompt(remaining, excluded, mix));
      return extractJsonArray(result.response.text());
    });
  } catch (err) {
    process.stderr.write(`Topic generation failed: ${err.message}\n`);
    process.exit(1);
    return;
  }
  const dates = scheduleDates(topics.length, { days, start });
  const out = topics.map((t, i) => ({ date: dates[i], ...t }));
  log(`Returning ${out.length} long-form topics (${dates[0]} .. ${dates[dates.length - 1]}).`);
  process.stdout.write(JSON.stringify(out) + "\n");
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`Unhandled error: ${err && err.stack ? err.stack : err}\n`);
    process.exit(1);
  });
}

module.exports = {
  buildPrompt, cleanTopic, isNearDuplicate, appendUnique, collectTopics,
  // long-form (16:9) finance calendar
  LONG_CATEGORIES, LONG_DEFAULT_DAYS, buildLongPrompt, cleanLongTopic, isLongDuplicate, appendUniqueLong,
  collectLongTopics, scheduleDates, parseDays, localIsoDate, loadPastLongformTitles,
};
