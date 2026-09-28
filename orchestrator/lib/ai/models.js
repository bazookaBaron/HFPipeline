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
 * The ledger (orchestrator/output/gemini-usage.jsonl, one line per call: task, model, tokens,
 * grounded) shows where the money goes: node tools/gemini-usage.js
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
  "longform.montage": "lite", // cold-open montage lines for scripts without montageLines (<= 1 call / video)
  // standard
  storyboard: "standard",
  carousel: "standard",
  topics: "standard",
  "research.grounded": "standard",
  "research.distil": "standard",
  "script.repair": "standard",
  "longform.storyboard": "standard",
  // pro
  "longform.outline": "pro",
  "longform.script": "pro",
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

/** Model id for a task: per-task override, else the tier's setting, else the tier default. */
function modelFor(task) {
  const perTask = setting(`GEMINI_MODEL_${String(task || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`);
  if (perTask) return perTask;
  const tier = tierOf(task);
  return setting(TIER_VARS[tier]) || DEFAULTS[tier];
}

/** Append one call to the ledger; never throws (usage logging must not break a run). */
function recordUsage({ task, model, usage, grounded = false, ok = true }) {
  try {
    const u = usage || {};
    const row = {
      at: new Date().toISOString(),
      task: task || "unknown",
      model,
      in: u.promptTokenCount || 0,
      out: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0),
      thoughts: u.thoughtsTokenCount || 0,
      grounded: !!grounded,
      ok,
    };
    fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
    fs.appendFileSync(LEDGER, JSON.stringify(row) + "\n");
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
    const row = { at: new Date().toISOString(), task: task || "unknown", provider: provider || "other", model, cost: Math.round((Number(cost) || 0) * 10000) / 10000, units, cached: !!cached, ok };
    if (width) Object.assign(row, { width, height });
    fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
    fs.appendFileSync(LEDGER, JSON.stringify(row) + "\n");
  } catch (_) {
    /* ignore */
  }
}

module.exports = { modelFor, tierOf, recordUsage, recordCost, TASKS, DEFAULTS, LEDGER, readEnv };
