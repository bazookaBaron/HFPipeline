"use strict";

/**
 * Long-form budget guard (LONGFORM-V2-PLAN §9): make-longform --budget-usd N stops a run cleanly instead of
 * silently re-spending.
 *
 * - Budget: --budget-usd N, else LF_BUDGET_USD, else LF_BUDGET_USD_PER_MIN (default $0.50/min: ~$6 for a 12-min
 *   video) x --minutes, floor $1.50. "off" / 0 disables the stop (spend is still tracked and reported).
 * - Spend is read back from the usage ledger (lib/ai/models.js: Gemini rows priced from their tokens incl. the
 *   cached-input share and the batch discount, fal.ai rows carry their $). Rows are matched by the video key (a
 *   hash of the --out dir) so a resumed run counts what the earlier invocations of the same video spent
 *   (LF_BUDGET_SCOPE=run counts only this invocation). The ledger is read incrementally (new bytes only).
 * - Every Gemini request asks the guard first (models.beforeCall):
 *     >= 80 %  "tight": repair tasks drop one model tier, optional retries / polish calls are skipped
 *     >= 100% "over": the call is refused with {budget, fatal}; make-longform stops with exit code 5 and a
 *              report; every finished artefact stays on disk, so the same command resumes (with a higher budget)
 * - finish() always writes final/cost.json (per stage, per task, cached share, batch share) and prints a
 *   per-stage summary.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const M = require("../ai/models");

const PER_MIN = 0.5;
const FLOOR = 1.5;
const TIGHT_AT = 0.8;

const round = (x, d = 4) => Math.round((Number(x) || 0) * 10 ** d) / 10 ** d;

/** default budget for a video of `minutes` (env overrides) */
function defaultBudget(minutes, env = process.env) {
  if (env.LF_BUDGET_USD !== undefined && env.LF_BUDGET_USD !== "") return parseBudget(env.LF_BUDGET_USD);
  const per = Number(env.LF_BUDGET_USD_PER_MIN);
  const rate = Number.isFinite(per) && per > 0 ? per : PER_MIN;
  return round(Math.max(FLOOR, rate * (Number(minutes) || 10)), 2);
}

/** "6" -> 6, "off" | "0" | "none" -> null (no stop) */
function parseBudget(v) {
  if (v === null || v === undefined) return undefined;
  if (/^(off|none|false|0+(\.0+)?)$/i.test(String(v).trim())) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`budget must be a dollar amount or "off" (got ${v})`);
  return n;
}

function resolveBudget(flag, minutes, env = process.env) {
  const f = parseBudget(flag);
  return f !== undefined ? f : defaultBudget(minutes, env);
}

const videoKey = (out) => crypto.createHash("sha256").update(path.resolve(out)).digest("hex").slice(0, 12);
const newRunId = () => `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomBytes(3).toString("hex")}`;

/**
 * Aggregate ledger rows: total $, per stage and per task, calls, tokens, cached share.
 * @param {object[]} rows
 */
function summarize(rows) {
  const blank = () => ({ usd: 0, calls: 0, geminiCalls: 0, pricedCalls: 0, batchCalls: 0, inTok: 0, cachedTok: 0, outTok: 0 });
  const add = (a, r) => {
    a.usd += M.costOf(r);
    a.calls++;
    if (r.cost != null) a.pricedCalls++;
    else {
      a.geminiCalls++;
      a.inTok += Number(r.in) || 0;
      a.cachedTok += Math.min(Number(r.in) || 0, Number(r.cachedIn) || 0);
      a.outTok += Number(r.out) || 0;
      if (r.batch) a.batchCalls++;
    }
  };
  const total = blank();
  const stages = {};
  const tasks = {};
  rows.forEach((r) => {
    add(total, r);
    add((stages[r.stage || "other"] = stages[r.stage || "other"] || blank()), r);
    add((tasks[r.task || "unknown"] = tasks[r.task || "unknown"] || blank()), r);
  });
  const fin = (a) => ({ ...a, usd: round(a.usd), cachedShare: a.inTok ? round(a.cachedTok / a.inTok, 3) : 0 });
  return {
    total: fin(total),
    stages: Object.fromEntries(Object.entries(stages).map(([k, v]) => [k, fin(v)])),
    tasks: Object.fromEntries(Object.entries(tasks).sort((a, b) => b[1].usd - a[1].usd).map(([k, v]) => [k, fin(v)])),
  };
}

/**
 * @param {{budgetUsd: number|null, video: string, run: string, scope?: "video"|"run", ledger?: string, log?: Function, tightAt?: number}} o
 */
function createGuard(o) {
  const ledger = o.ledger || M.ledgerFile();
  const log = o.log || (() => {});
  const scope = o.scope === "run" ? "run" : "video";
  const tightAt = o.tightAt || TIGHT_AT;
  let offset = 0;
  let tail = "";
  const rows = [];
  let level = "normal";
  let stopped = null;

  /** read only the bytes appended since the last refresh; a torn last line waits for the next read */
  function refresh() {
    let fd;
    try {
      const size = fs.statSync(ledger).size;
      if (size < offset) {
        offset = 0; // rotated / truncated: start over
        tail = "";
        rows.length = 0;
      }
      if (size === offset) return;
      fd = fs.openSync(ledger, "r");
      const buf = Buffer.alloc(size - offset);
      fs.readSync(fd, buf, 0, buf.length, offset);
      offset = size;
      const text = tail + buf.toString("utf-8");
      const cut = text.lastIndexOf("\n");
      tail = cut < 0 ? text : text.slice(cut + 1);
      M.parseLedger(cut < 0 ? "" : text.slice(0, cut)).forEach((r) => (r.video === o.video || (o.run && r.run === o.run)) && rows.push(r));
    } catch (_) {
      /* no ledger yet */
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  }

  const mine = () => rows.filter((r) => (scope === "run" ? r.run === o.run : r.video === o.video));
  const spent = () => {
    refresh();
    return round(mine().reduce((a, r) => a + M.costOf(r), 0));
  };

  function levelFor(usd) {
    if (o.budgetUsd === null || o.budgetUsd === undefined) return "normal";
    if (usd >= o.budgetUsd) return "over";
    if (usd >= tightAt * o.budgetUsd) return "tight";
    return "normal";
  }

  const describe = () => `$${spent().toFixed(2)} of $${o.budgetUsd == null ? "∞" : Number(o.budgetUsd).toFixed(2)} spent`;

  /** the level for the next call; logs each change once; records where the run stopped */
  function check(task) {
    const usd = spent();
    const next = levelFor(usd);
    if (next !== level) {
      if (next === "tight") log(`budget: ${describe()} (>= ${Math.round(tightAt * 100)} %): repairs move to cheaper tiers, optional retries are skipped`);
      if (next === "over") log(`budget: ${describe()}: stopping before ${task || "the next call"} (resumable)`);
      level = next;
    }
    if (level === "over" && !stopped) stopped = { task: task || null, stage: process.env.LF_STAGE || null, spentUsd: usd, at: new Date().toISOString() };
    return level;
  }

  return {
    check,
    describe,
    spent,
    level: () => level,
    stopped: () => stopped,
    rows: () => (refresh(), mine().slice()),
    allRows: () => (refresh(), rows.slice()),
    budgetUsd: o.budgetUsd,
    scope,
    video: o.video,
    run: o.run,
  };
}

// ------------------------------------------------------------------------------------------ run wiring
let current = null;

/**
 * Start tracking a long-form run: run / video ids go into the env (children inherit them) and every ledger row.
 * @param {{out: string, minutes: number, flag?: string|number, log?: Function, ledger?: string, scope?: string}} o
 */
function start(o) {
  const budgetUsd = resolveBudget(o.flag, o.minutes);
  const video = videoKey(o.out);
  const run = newRunId();
  M.setRunContext({ run, video, stage: "" });
  const guard = createGuard({ budgetUsd, video, run, scope: o.scope || process.env.LF_BUDGET_SCOPE, ledger: o.ledger, log: o.log });
  guard.check("start");
  M.setSpendGuard(guard);
  current = { guard, out: o.out, minutes: o.minutes, log: o.log || (() => {}), startedAt: new Date().toISOString() };
  (o.log || (() => {}))(`budget: ${budgetUsd == null ? "no limit" : `$${budgetUsd.toFixed(2)}`} for this video (${guard.scope} scope; ${guard.describe()} so far)`);
  return guard;
}

/** the stage later ledger rows are attributed to */
function stage(name) {
  M.setRunContext({ stage: name });
}

/** false once the budget is tight: skip optional retries / polish calls */
function optional() {
  return M.costMode() === "normal";
}

function stopped() {
  return current ? current.guard.stopped() : null;
}

/** cost.json content for the current run */
function report(status) {
  const g = current.guard;
  const all = summarize(g.rows());
  const thisRun = summarize(g.allRows().filter((r) => r.run === g.run));
  const st = g.stopped();
  return {
    version: "lf-cost.v1",
    status,
    video: g.video,
    run: g.run,
    scope: g.scope,
    budgetUsd: g.budgetUsd,
    spentUsd: all.total.usd,
    thisRunUsd: thisRun.total.usd,
    level: g.level(),
    cachedShare: all.total.cachedShare,
    batchCalls: all.total.batchCalls,
    minutes: current.minutes,
    perMinuteUsd: current.minutes ? round(all.total.usd / current.minutes) : null,
    stages: all.stages,
    tasks: all.tasks,
    thisRun: { usd: thisRun.total.usd, stages: Object.fromEntries(Object.entries(thisRun.stages).map(([k, v]) => [k, v.usd])) },
    ...(st ? { stoppedAt: st, resume: `node orchestrator/make-longform.js --out "${current.out}" --budget-usd ${Math.ceil((g.budgetUsd || 0) * 1.5 * 100) / 100}` } : {}),
    startedAt: current.startedAt,
    finishedAt: new Date().toISOString(),
  };
}

/** per-stage lines for the terminal */
function summaryLines(rep) {
  const L = [];
  L.push(`cost: $${rep.spentUsd.toFixed(4)}${rep.budgetUsd != null ? ` of $${rep.budgetUsd.toFixed(2)}` : ""} (this invocation $${rep.thisRunUsd.toFixed(4)}), cached input ${(rep.cachedShare * 100).toFixed(1)} %${rep.batchCalls ? `, ${rep.batchCalls} batch call(s)` : ""}`);
  L.push(`  ${"stage".padEnd(13)}${"$".padStart(9)}${"calls".padStart(7)}${"in tok".padStart(11)}${"cached".padStart(8)}${"out tok".padStart(10)}`);
  Object.entries(rep.stages)
    .sort((a, b) => b[1].usd - a[1].usd)
    .forEach(([k, v]) => L.push(`  ${k.padEnd(13)}${v.usd.toFixed(4).padStart(9)}${String(v.calls).padStart(7)}${String(v.inTok).padStart(11)}${`${(v.cachedShare * 100).toFixed(0)}%`.padStart(8)}${String(v.outTok).padStart(10)}`));
  return L;
}

/**
 * Write <out>/final/cost.json and print the per-stage summary. Never throws. Returns the report.
 * @param {"ok"|"gates-failed"|"budget-stop"|"failed"} status
 */
function finish(status) {
  if (!current) return null;
  try {
    const rep = report(status);
    const f = path.join(current.out, "final", "cost.json");
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(rep, null, 1));
    summaryLines(rep).forEach((l) => current.log(l));
    if (rep.stoppedAt) current.log(`budget stop in ${rep.stoppedAt.stage || "?"} before ${rep.stoppedAt.task || "?"}; finished artefacts are kept. Resume: ${rep.resume}`);
    return rep;
  } catch (err) {
    current.log(`cost report failed: ${err.message}`);
    return null;
  }
}

/** tests: forget the current run */
function reset() {
  current = null;
  M.setSpendGuard(null);
  M.setRunContext({ run: "", video: "", stage: "" });
}

module.exports = { defaultBudget, parseBudget, resolveBudget, videoKey, summarize, createGuard, start, stage, optional, stopped, report, summaryLines, finish, reset, PER_MIN, FLOOR, TIGHT_AT };
