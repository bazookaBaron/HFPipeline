"use strict";

/**
 * Which Gemini model each task uses, plus a per-call usage ledger.
 *
 * Three text tiers, chosen by how much reasoning the task needs:
 *   lite     - short, mechanical, high-volume: search keywords, image vetting, style/promo picks
 *   standard - strict JSON with real structure: storyboards (incl. long-form chapter storyboards), carousels, topics, fact distilling,
 *              grounded research answers, script repairs
 *   pro      - the few calls where writing quality decides the video: long-form outline and
 *              chapter scripts
 * plus `image` for illustrations. Every tier can be overridden in scripting-pipeline/.env
 * (GEMINI_MODEL_LITE / GEMINI_MODEL / GEMINI_MODEL_PRO / GEMINI_IMAGE_MODEL) or the process env,
 * and any single task with GEMINI_MODEL_<TASK> (dots -> underscores, e.g. GEMINI_MODEL_MEDIA_VISION).
 *
 * The ledger (orchestrator/output/gemini-usage.jsonl, one line per call: task, model, tokens incl. the
 * implicitly cached input share `cachedIn`, grounded, batch, and the run / video / stage that made it) shows
 * where the money goes: node tools/gemini-usage.js. costOf(row) prices a row (PRICES; batch -50 %, cached input
 * at CACHED_FACTOR of the input price). The long-form budget guard (lib/longform/budget.js) reads it back.
 *
 * Cost mode (set by the budget guard): "tight" (>= 80 % of the run budget) moves the REPAIR tasks one tier down
 * (pro -> standard -> lite) and callers skip optional retries; "over" makes beforeCall() refuse every call.
 */

const fs = require("fs");
const path = require("path");

const ENV_PATH = path.join(__dirname, "..", "..", "..", "scripting-pipeline", ".env");
const LEDGER = path.join(__dirname, "..", "..", "output", "gemini-usage.jsonl");

const DEFAULTS = {
  lite: "gemini-3.5-flash-lite",
  standard: "gemini-3.6-flash",
  pro: "gemini-3.1-pro-preview",
  image: "gemini-3.1-flash-image",
};

const TASKS = {
  // lite
  "media.queries": "lite",
  "media.vision": "lite",
  "promo.pick": "lite",
  "style.choose": "lite",
  "research.plan": "lite",
  "longform.metadata": "lite",
  "longform.thumbnail": "lite",
  "longform.beats": "lite", // visual beat sheet: hints for sentences the rules cannot place (<= 1 call / video)
  "longform.sceneRewrite": "lite", // media gate: graphics-only rewrite of the scenes whose slot has no usable media
  // standard
  storyboard: "standard",
  carousel: "standard",
  topics: "standard",
  "research.grounded": "standard",
  "research.distil": "standard",
  "script.repair": "standard",
  "longform.storyboard": "standard", // first pass (batchable)
  "longform.storyboard.repair": "standard", // whole-chapter repair (structural problems only)
  "longform.storyboard.scene": "standard", // scene-level repair: only the failing scaffolds are re-sent
  "longform.edit": "standard",
  // pro
  "longform.outline": "pro",
  "longform.script": "pro",
  "longform.outline.repair": "pro",
  // image
  "media.illustration": "image",
};

let envCache = null;
function readEnv() {
  if (envCache) return envCache;
  envCache = {};
  if (fs.existsSync(ENV_PATH)) {
    fs.readFileSync(ENV_PATH, "utf-8").split(/\r?\n/).forEach((l) => {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) envCache[m[1]] = m[2].trim();
    });
  }
  return envCache;
}

function setting(name) {
  return process.env[name] || readEnv()[name] || null;
}

const TIER_VARS = { lite: "GEMINI_MODEL_LITE", standard: "GEMINI_MODEL", pro: "GEMINI_MODEL_PRO", image: "GEMINI_IMAGE_MODEL" };

function tierOf(task) {
  return TASKS[task] || "standard";
}

// ------------------------------------------------------------------------------------------ cost mode
/** repair / rewrite tasks that drop one tier when the budget is tight (never the first-pass writing) */
const REPAIR_TASKS = new Set(["script.repair", "longform.storyboard.repair", "longform.storyboard.scene", "longform.sceneRewrite", "longform.outline.repair", "longform.edit"]);
const DOWN = { pro: "standard", standard: "lite", lite: "lite", image: "image" };
let mode = "normal";
let guard = null;

/** "normal" | "tight" | "over" (set by the budget guard) */
function costMode() {
  return mode;
}
function setCostMode(m) {
  mode = m === "tight" || m === "over" ? m : "normal";
}
/** the budget guard: {check(task) -> "normal"|"tight"|"over"} (null = no guard) */
function setSpendGuard(g) {
  guard = g || null;
  if (!guard) mode = "normal";
}

/**
 * Called by every Gemini client before a request (never for cache hits). With a guard over its budget it throws
 * an error flagged {budget: true, fatal: true}: callers treat it like a billing stop (not retried).
 */
function beforeCall(task) {
  if (!guard) return;
  const m = guard.check(task);
  if (m) setCostMode(m);
  if (mode === "over") {
    const err = new Error(`budget exhausted: ${task} not sent (${guard.describe ? guard.describe() : "over budget"})`);
    err.budget = true;
    err.fatal = true;
    throw err;
  }
}

/** Model id for a task: per-task override, else the tier's setting (one tier down for repairs in tight mode), else the tier default. */
function modelFor(task) {
  const perTask = setting(`GEMINI_MODEL_${String(task || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`);
  if (perTask) return perTask;
  let tier = tierOf(task);
  if (mode !== "normal" && REPAIR_TASKS.has(task)) tier = DOWN[tier];
  return setting(TIER_VARS[tier]) || DEFAULTS[tier];
}

// ------------------------------------------------------------------------------------------ thinking
/**
 * Thinking level per task (cost): low for repairs, rewrites, beats and search queries; the model default for the
 * first-pass writing (outline, the script's cold open, storyboards). Override any task with GEMINI_THINKING_<TASK>
 * (dots -> underscores): minimal | low | medium | high | <budget tokens> | default.
 * Cold-open A/B (LF v2 WS-F, Japan): model default = $0.19 (12.6k thinking tokens), 298 words, 5 gate problems, stakes
 * stops kept their causal links; "low" = $0.04 (0 thinking), 394 words, 9 problems, irony at ~75 s. So chapters
 * default to "low" (cheap, fine) and the hook keeps the model default.
 */
const THINKING_DEFAULTS = {
  "longform.script": "low",
  "longform.script.cold": "default",
  "longform.outline": "default",
  "longform.outline.repair": "low",
  "script.repair": "low",
  "longform.edit": "low",
  "longform.storyboard.repair": "low",
  "longform.storyboard.scene": "low",
  "longform.sceneRewrite": "low",
  "longform.beats": "low",
  "media.queries": "low",
};

/** {thinkingLevel} | {thinkingBudget} | null (send nothing: the model's default) */
function thinkingConfigFor(task, env = {}, override) {
  const key = `GEMINI_THINKING_${String(task).toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
  const v = String(override ?? process.env[key] ?? env[key] ?? readEnv()[key] ?? THINKING_DEFAULTS[task] ?? "default").trim().toLowerCase();
  if (!v || v === "default") return null;
  if (/^\d+$/.test(v)) return { thinkingBudget: Number(v) };
  if (["minimal", "low", "medium", "high"].includes(v)) return { thinkingLevel: v };
  return null;
}

// ------------------------------------------------------------------------------------------ ledger
/** who made a call: the long-form run sets these (make-longform), children inherit them through the env */
function setRunContext({ run, video, stage } = {}) {
  if (run !== undefined) process.env.LF_RUN_ID = run || "";
  if (video !== undefined) process.env.LF_VIDEO_ID = video || "";
  if (stage !== undefined) process.env.LF_STAGE = stage || "";
}
function runContext() {
  const c = {};
  if (process.env.LF_RUN_ID) c.run = process.env.LF_RUN_ID;
  if (process.env.LF_VIDEO_ID) c.video = process.env.LF_VIDEO_ID;
  if (process.env.LF_STAGE) c.stage = process.env.LF_STAGE;
  return c;
}

let ledgerPath = LEDGER;
/** tests point the ledger at a temp file */
function setLedger(p) {
  ledgerPath = p || LEDGER;
}
function ledgerFile() {
  return ledgerPath;
}

function append(row) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.appendFileSync(ledgerPath, JSON.stringify(row) + "\n");
}

/** Append one call to the ledger; never throws (usage logging must not break a run). */
function recordUsage({ task, model, usage, grounded = false, ok = true, batch = false }) {
  try {
    const u = usage || {};
    const row = {
      at: new Date().toISOString(),
      task: task || "unknown",
      model,
      in: u.promptTokenCount || 0,
      cachedIn: u.cachedContentTokenCount || 0,
      out: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0),
      thoughts: u.thoughtsTokenCount || 0,
      grounded: !!grounded,
      ok,
      ...(batch ? { batch: true } : {}),
      ...runContext(),
    };
    append(row);
  } catch (_) {
    /* ignore */
  }
}

/**
 * Append a priced (non-token) call to the same ledger, e.g. a fal.ai image: {provider, model, cost ($), units}.
 * Cached reuses are logged with cost 0 and cached: true. Never throws.
 */
function recordCost({ task, provider, model, cost = 0, units = 1, cached = false, ok = true, width, height }) {
  try {
    const row = { at: new Date().toISOString(), task: task || "unknown", provider: provider || "other", model, cost: Math.round((Number(cost) || 0) * 10000) / 10000, units, cached: !!cached, ok, ...runContext() };
    if (width) Object.assign(row, { width, height });
    append(row);
  } catch (_) {
    /* ignore */
  }
}

// ------------------------------------------------------------------------------------------ pricing
/** $ per 1M tokens (input / output incl. thinking); image models per image. Unknown ids price by their tier name. */
const PRICES = {
  "gemini-3.5-flash-lite": { in: 0.3, out: 2.5 },
  "gemini-3.6-flash": { in: 0.75, out: 3.75 },
  "gemini-3.1-pro-preview": { in: 2, out: 12 },
  "gemini-3.1-flash-image": { perCall: 0.067 },
};
/** implicit-cache hits are billed at this share of the input price; the Batch API at half price */
const CACHED_FACTOR = Number(process.env.GEMINI_CACHED_PRICE_FACTOR || 0.1);
const BATCH_FACTOR = 0.5;

function priceOf(model) {
  const id = String(model || "").replace(/^models\//, "");
  if (PRICES[id]) return PRICES[id];
  if (/image/.test(id)) return PRICES[DEFAULTS.image];
  if (/lite/.test(id)) return PRICES[DEFAULTS.lite];
  if (/pro/.test(id)) return PRICES[DEFAULTS.pro];
  return PRICES[DEFAULTS.standard];
}

/** $ for one ledger row: priced rows carry their cost, Gemini rows are priced from their tokens */
function costOf(row) {
  if (!row) return 0;
  if (row.cost != null) return Number(row.cost) || 0;
  const p = priceOf(row.model);
  if (p.perCall) return p.perCall * (row.batch ? BATCH_FACTOR : 1);
  const inTok = Number(row.in) || 0;
  const cached = Math.min(inTok, Number(row.cachedIn) || 0);
  const usd = ((inTok - cached) * p.in + cached * p.in * CACHED_FACTOR + (Number(row.out) || 0) * p.out) / 1e6;
  return usd * (row.batch ? BATCH_FACTOR : 1);
}

/** Parse ledger text (JSONL); malformed or partial lines are skipped, never fatal. */
function parseLedger(text) {
  const rows = [];
  String(text || "")
    .split(/\r?\n/)
    .forEach((l) => {
      if (!l.trim()) return;
      try {
        const r = JSON.parse(l);
        if (r && typeof r === "object" && !Array.isArray(r)) rows.push(r);
      } catch (_) {
        /* a torn line (concurrent append, crash): skip */
      }
    });
  return rows;
}

function readLedger(file = ledgerPath) {
  try {
    return parseLedger(fs.readFileSync(file, "utf-8"));
  } catch (_) {
    return [];
  }
}

module.exports = {
  modelFor,
  tierOf,
  recordUsage,
  recordCost,
  TASKS,
  DEFAULTS,
  LEDGER,
  readEnv,
  THINKING_DEFAULTS,
  thinkingConfigFor,
  REPAIR_TASKS,
  costMode,
  setCostMode,
  setSpendGuard,
  beforeCall,
  setRunContext,
  runContext,
  setLedger,
  ledgerFile,
  PRICES,
  CACHED_FACTOR,
  BATCH_FACTOR,
  priceOf,
  costOf,
  parseLedger,
  readLedger,
};
