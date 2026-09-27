"use strict";

/**
 * Gemini Batch API (half price, results within hours) for the long-form first passes: research, outline,
 * script and first-pass storyboards (make-longform --batch). Interactive stays the default.
 *
 *   const b = createBatcher({ apiKey, stateDir: "<out>/batch", log });
 *   const response = await b.submit({ model, request: <generateContent body>, task });
 *
 * - Requests issued within `windowMs` of each other (a stage's parallel calls) go into ONE batch job per model
 *   (inlined requests, POST models/<model>:batchGenerateContent), each tagged with a content key.
 * - The job name is written to <stateDir>/jobs/ before polling, every finished response to <stateDir>/results/:
 *   a killed run that is started again finds the pending job for the same request and polls it instead of
 *   paying twice, and a finished request is answered from disk (resumable).
 * - Polling backs off from pollMs[0] to pollMs[1]; a job that fails / expires / is cancelled rejects its callers
 *   (the caller falls back to an interactive call). Usage is recorded with batch: true (priced at 50 %).
 * The API key goes only in the x-goog-api-key header, never in a URL or a state file.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { recordUsage } = require("./models");

const API = "https://generativelanguage.googleapis.com/v1beta";
const DONE_OK = /SUCCEEDED$/;
const DONE_BAD = /(FAILED|CANCELLED|EXPIRED)$/;
/** tasks sent through the batch API under --batch (first passes only; repairs stay interactive) */
const BATCH_TASKS = ["research.plan", "research.grounded", "research.distil", "longform.outline", "longform.script", "longform.storyboard"];

function batchTasks() {
  const env = process.env.LF_BATCH_TASKS;
  return new Set(env ? env.split(/[\s,]+/).filter(Boolean) : BATCH_TASKS);
}

const requestKey = (model, request) => crypto.createHash("sha256").update(`${model}\u0000${JSON.stringify(request)}`).digest("hex").slice(0, 24);

/** the per-request responses of a finished batch operation, whatever envelope the API used */
function inlinedResponses(op) {
  const pick = (o) => o && o.inlinedResponses && (Array.isArray(o.inlinedResponses) ? o.inlinedResponses : o.inlinedResponses.inlinedResponses);
  return pick(op && op.response) || pick(op && op.output) || pick(op && op.metadata && op.metadata.output) || pick(op && op.dest) || pick(op && op.metadata && op.metadata.dest) || [];
}
function stateOf(op) {
  return String((op && ((op.metadata && op.metadata.state) || op.state)) || (op && op.done ? "BATCH_STATE_SUCCEEDED" : "BATCH_STATE_PENDING"));
}

/**
 * @param {{apiKey: string, stateDir: string, fetch?: Function, windowMs?: number, pollMs?: [number, number],
 *          maxWaitMs?: number, log?: Function, sleep?: Function, api?: string}} opts
 */
function createBatcher(opts = {}) {
  if (!opts.apiKey) throw new Error("batch: apiKey required");
  if (!opts.stateDir) throw new Error("batch: stateDir required (resume state)");
  const fetchImpl = opts.fetch || globalThis.fetch;
  const log = opts.log || (() => {});
  const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const windowMs = opts.windowMs ?? 2000;
  const [pollMin, pollMax] = opts.pollMs || [15000, 60000];
  const maxWaitMs = opts.maxWaitMs || 26 * 3600 * 1000;
  const api = opts.api || API;
  const jobsDir = path.join(opts.stateDir, "jobs");
  const resDir = path.join(opts.stateDir, "results");
  const headers = { "content-type": "application/json", "x-goog-api-key": opts.apiKey };

  const waiters = new Map(); // key -> [{resolve, reject}]
  const polling = new Map(); // job name -> Promise
  const queues = new Map(); // model -> {items: [{key, request, task}], timer}
  let seq = 0;

  const writeJson = (p, v) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(v));
  };
  const jobFile = (name) => path.join(jobsDir, `${String(name).replace(/[^A-Za-z0-9_-]+/g, "_")}.json`);
  const resultFile = (key) => path.join(resDir, `${key}.json`);

  function settle(key, err, value) {
    const list = waiters.get(key) || [];
    waiters.delete(key);
    list.forEach((w) => (err ? w.reject(err) : w.resolve(value)));
  }

  async function http(method, url, body) {
    const res = await fetchImpl(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    const txt = await res.text();
    if (!res.ok) {
      const err = new Error(`batch HTTP ${res.status}: ${txt.slice(0, 300)}`);
      if (/\b(401|402|403)\b/.test(String(res.status))) err.fatal = true;
      throw err;
    }
    return txt ? JSON.parse(txt) : {};
  }

  /** poll one job to its end; resolves / rejects every waiter on its keys */
  function poll(job) {
    if (polling.has(job.name)) return polling.get(job.name);
    const p = (async () => {
      const t0 = Date.now();
      let wait = pollMin;
      for (;;) {
        let op;
        try {
          op = await http("GET", `${api}/${job.name}`);
        } catch (err) {
          if (err.fatal) throw err;
          log(`  batch ${job.name}: poll failed (${String(err.message).slice(0, 120)}); retrying`);
          op = null;
        }
        const state = op ? stateOf(op) : "";
        if (op && (DONE_OK.test(state) || (op.done && !DONE_BAD.test(state) && !op.error))) {
          const rows = inlinedResponses(op);
          rows.forEach((r, i) => {
            const key = (r.metadata && r.metadata.key) || r.key || job.keys[i];
            if (!key) return;
            if (r.response) {
              recordUsage({ task: (job.tasks || {})[key] || "batch", model: job.model, usage: r.response.usageMetadata, grounded: !!(job.grounded || {})[key], batch: true });
              writeJson(resultFile(key), { response: r.response, job: job.name });
              settle(key, null, r.response);
            } else settle(key, new Error(`batch request failed: ${JSON.stringify(r.error || r.status || "no response").slice(0, 200)}`));
          });
          job.keys.forEach((k) => waiters.has(k) && settle(k, new Error(`batch ${job.name} returned no response for this request`)));
          fs.rmSync(jobFile(job.name), { force: true });
          log(`  batch ${job.name}: ${state.replace(/^\w+_STATE_/, "").toLowerCase()} (${rows.length} response(s))`);
          return;
        }
        if (op && (DONE_BAD.test(state) || op.error)) {
          fs.rmSync(jobFile(job.name), { force: true });
          const err = new Error(`batch ${job.name} ended ${state}${op.error ? `: ${JSON.stringify(op.error).slice(0, 200)}` : ""}`);
          err.batchFailed = true;
          job.keys.forEach((k) => settle(k, err));
          return;
        }
        if (Date.now() - t0 > maxWaitMs) {
          const err = new Error(`batch ${job.name}: still ${state} after ${Math.round(maxWaitMs / 60000)} min; re-run later to resume it`);
          err.batchPending = true;
          job.keys.forEach((k) => settle(k, err));
          return;
        }
        log(`  batch ${job.name}: ${state.replace(/^\w+_STATE_/, "").toLowerCase() || "unknown"}; next check in ${Math.round(wait / 1000)} s`);
        await sleep(wait);
        wait = Math.min(pollMax, Math.round(wait * 1.5));
      }
    })().catch((err) => {
      job.keys.forEach((k) => settle(k, err));
    }).finally(() => polling.delete(job.name));
    polling.set(job.name, p);
    return p;
  }

  async function flush(model) {
    const q = queues.get(model);
    queues.delete(model);
    if (!q || !q.items.length) return;
    const items = q.items;
    const body = {
      batch: {
        display_name: `lf-${Date.now()}-${++seq}`,
        input_config: { requests: { requests: items.map((it) => ({ request: it.request, metadata: { key: it.key } })) } },
      },
    };
    let op;
    try {
      op = await http("POST", `${api}/models/${encodeURIComponent(model)}:batchGenerateContent`, body);
    } catch (err) {
      items.forEach((it) => settle(it.key, err));
      return;
    }
    const name = op.name || (op.metadata && op.metadata.name);
    if (!name) {
      items.forEach((it) => settle(it.key, new Error("batch: create returned no job name")));
      return;
    }
    const job = {
      name,
      model,
      keys: items.map((it) => it.key),
      tasks: Object.fromEntries(items.map((it) => [it.key, it.task])),
      grounded: Object.fromEntries(items.map((it) => [it.key, !!it.grounded])),
      submittedAt: new Date().toISOString(),
    };
    writeJson(jobFile(name), job);
    log(`  batch ${name}: submitted ${items.length} request(s) on ${model} (50 % price; polling)`);
    poll(job);
  }

  function pendingJobFor(key) {
    if (!fs.existsSync(jobsDir)) return null;
    for (const f of fs.readdirSync(jobsDir)) {
      try {
        const job = JSON.parse(fs.readFileSync(path.join(jobsDir, f), "utf-8"));
        if ((job.keys || []).includes(key)) return job;
      } catch (_) {
        /* torn state file: ignore */
      }
    }
    return null;
  }

  /**
   * @param {{model: string, request: object, task?: string, grounded?: boolean}} r
   * @returns {Promise<object>} the GenerateContentResponse
   */
  function submit({ model, request, task, grounded }) {
    const key = requestKey(model, request);
    const done = resultFile(key);
    if (fs.existsSync(done)) {
      try {
        return Promise.resolve(JSON.parse(fs.readFileSync(done, "utf-8")).response);
      } catch (_) {
        /* unreadable: ask again */
      }
    }
    const p = new Promise((resolve, reject) => {
      const list = waiters.get(key) || [];
      list.push({ resolve, reject });
      waiters.set(key, list);
    });
    if ((waiters.get(key) || []).length > 1) return p; // the same request is already queued / in flight
    const job = pendingJobFor(key);
    if (job) {
      log(`  batch: resuming ${job.name} (submitted ${job.submittedAt})`);
      poll(job);
      return p;
    }
    const q = queues.get(model) || { items: [], timer: null };
    q.items.push({ key, request, task, grounded });
    if (!q.timer) q.timer = setTimeout(() => flush(model), windowMs);
    queues.set(model, q);
    return p;
  }

  return { submit, requestKey, flush: (m) => flush(m) };
}

module.exports = { createBatcher, requestKey, inlinedResponses, stateOf, BATCH_TASKS, batchTasks };
