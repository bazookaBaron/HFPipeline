"use strict";

/**
 * Gemini REST access for long-form research and scripting.
 *
 * Same key/model source as loadGemini() in lib/video/v3/storyboardGen.js (process env, else
 * scripting-pipeline/.env; model GEMINI_MODEL, default "gemini-3.6-flash"), but over plain fetch so
 * one helper covers both Google Search grounded free-text calls and JSON-mode calls (the two modes
 * are not combined in one request). The API key is sent only as the x-goog-api-key header and is
 * never logged or put in a URL.
 */

const fs = require("fs");
const path = require("path");

const ENV_PATH = path.join(__dirname, "..", "..", "..", "scripting-pipeline", ".env");
const API = "https://generativelanguage.googleapis.com/v1beta/models";
const { modelFor, recordUsage, beforeCall, thinkingConfigFor, THINKING_DEFAULTS } = require("../ai/models");

function readEnv() {
  const env = {};
  if (fs.existsSync(ENV_PATH)) {
    fs.readFileSync(ENV_PATH, "utf-8").split(/\r?\n/).forEach((l) => {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    });
  }
  return env;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FATAL = /\b(400|401|402|403|404)\b|API key not valid|PERMISSION_DENIED|credits are depleted/i;

/**
 * opts.batch: true (or a batcher from lib/ai/batch.js) sends the first-pass tasks (BATCH_TASKS: research,
 * outline, script, first-pass storyboards) through the Gemini Batch API at half price; repairs stay interactive.
 * A failed batch falls back to an interactive call. opts.batchDir holds the resume state (job names, results).
 * @returns {{grounded:(text:string)=>Promise<{text:string, queries:string[], chunks:{uri:string,title:string}[], supports:object[]}>,
 *            json:(prompt:string, opts?:{temperature?:number})=>Promise<object>, model:string}}
 */
function loadGeminiRest(opts = {}) {
  const env = readEnv();
  const apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set (process env or scripting-pipeline/.env)");
  // per-call task -> model tier (lib/ai/models.js); opts.model pins one model for every call
  const pick = (task) => opts.model || modelFor(task);
  const model = pick("research.grounded");
  const log = opts.log || (() => {});
  const maxAttempts = opts.maxAttempts || 5;
  const timeoutMs = opts.timeoutMs || 240000;
  const fetchImpl = opts.fetch || globalThis.fetch;
  let batcher = null;
  let batchSet = null;
  if (opts.batch) {
    const B = require("../ai/batch");
    batcher = typeof opts.batch === "object" ? opts.batch : B.createBatcher({ apiKey, stateDir: opts.batchDir || path.join(__dirname, "..", "..", "output", "batch"), log, fetch: opts.fetch });
    batchSet = B.batchTasks();
  }

  async function call(body, label, task, o = {}) {
    const m = pick(task);
    beforeCall(task); // budget guard: throws {budget, fatal} when the run is over its budget
    if (batcher && batchSet.has(task) && !o.interactive) {
      try {
        const data = await batcher.submit({ model: m, request: body, task, grounded: !!body.tools });
        const cand = (data.candidates || [])[0];
        if (cand && cand.content) return cand;
        log(`  gemini ${label}: batch returned an empty candidate (finishReason ${cand && cand.finishReason}); asking interactively`);
      } catch (err) {
        if (err.fatal) throw err;
        log(`  gemini ${label}: batch failed (${String(err.message).slice(0, 160)}); asking interactively`);
      }
    }
    let lastErr;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetchImpl(`${API}/${encodeURIComponent(m)}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const txt = await res.text();
        if (!res.ok) {
          const msg = `HTTP ${res.status}: ${txt.slice(0, 300)}`;
          if (res.status !== 429 && FATAL.test(String(res.status))) throw Object.assign(new Error(msg), { fatal: true });
          throw new Error(msg);
        }
        const data = JSON.parse(txt);
        recordUsage({ task, model: m, usage: data.usageMetadata, grounded: !!body.tools });
        const cand = (data.candidates || [])[0];
        if (!cand || !cand.content) throw new Error(`empty candidate (finishReason ${cand && cand.finishReason})`);
        return cand;
      } catch (err) {
        lastErr = err;
        if (err.fatal) throw err;
        const wait = Math.min(60000, 2000 * 2 ** i) + Math.floor(Math.random() * 1000);
        log(`  gemini ${label} attempt ${i + 1}/${maxAttempts} failed (${String(err.message).slice(0, 160)}); retry in ${Math.round(wait / 1000)} s`);
        if (i < maxAttempts - 1) await sleep(wait);
      }
    }
    throw lastErr;
  }

  const partsText = (cand) => (cand.content.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join("");

  async function grounded(text, o = {}) {
    const cand = await call({ contents: [{ parts: [{ text }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.3 } }, "grounded", o.task || "research.grounded");
    const gm = cand.groundingMetadata || {};
    return {
      text: partsText(cand),
      queries: gm.webSearchQueries || [],
      chunks: (gm.groundingChunks || []).map((c) => ({ uri: (c.web || {}).uri || "", title: (c.web || {}).title || "" })),
      supports: gm.groundingSupports || [],
    };
  }

  let thinkingUnsupported = false;
  async function json(prompt, o = {}) {
    let lastErr;
    const task = o.task || opts.task || "research.distil";
    for (let i = 0; i < 3; i++) {
      const thinkingConfig = thinkingUnsupported ? null : thinkingConfigFor(o.thinkingTask || task, env, o.thinking);
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: o.temperature ?? 0.7, ...(thinkingConfig ? { thinkingConfig } : {}) },
      };
      let cand;
      try {
        // a re-ask after unparseable JSON never goes back to the batch (the same request would get the same answer)
        cand = await call(body, "json", task, { interactive: i > 0 });
      } catch (err) {
        // a model that rejects the thinking knob still gets the call, at its default thinking
        if (thinkingConfig && /\b400\b/.test(err.message) && /thinking/i.test(err.message)) {
          log(`  gemini: ${task} model rejects thinkingConfig; using its default`);
          thinkingUnsupported = true;
          i--;
          continue;
        }
        throw err;
      }
      const t = partsText(cand);
      try {
        return JSON.parse(t);
      } catch (err) {
        lastErr = new Error(`model returned invalid JSON: ${err.message}`);
        log(`  gemini json parse failed (${t.length} chars); asking again`);
      }
    }
    throw lastErr;
  }

  return { grounded, json, model };
}

/**
 * Thinking knob per task (cost): GEMINI_THINKING_<TASK> (dots -> underscores, e.g. GEMINI_THINKING_LONGFORM_SCRIPT)
 * in the process env or scripting-pipeline/.env, else THINKING_DEFAULTS (lib/ai/models.js: low for repairs,
 * rewrites, beats and queries; the model default for the outline and the cold open). Values: minimal | low | medium |
 * high (Gemini 3 thinkingLevel), a number (thinkingBudget tokens), or "default" (send nothing: the model's own default).
 * A caller may pass o.thinkingTask to look up a finer key (script.js uses "longform.script.cold" for the hook).
 */

/** Run async fn over items with at most `n` in flight; preserves order. */
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

module.exports = { loadGeminiRest, pool, readEnv, thinkingConfigFor, THINKING_DEFAULTS };
