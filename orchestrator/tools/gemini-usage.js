#!/usr/bin/env node
"use strict";
/**
 * Summarise the usage ledger (orchestrator/output/gemini-usage.jsonl) by task and model:
 * Gemini calls with their tokens, the implicitly cached share of the input (usageMetadata.cachedContentTokenCount),
 * batch calls and an estimated $ (lib/ai/models.js PRICES), and priced provider calls (fal.ai images, cut-outs)
 * with their $ cost.
 *   node tools/gemini-usage.js [--since 2026-09-26] [--video <key>] [--run <id>] [--stage storyboards]
 * (video / run ids: final/cost.json of a long-form run)
 */
const fs = require("fs");
const { LEDGER, readLedger, costOf } = require("../lib/ai/models");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : "";
}

/** filter + aggregate (exported for tests) */
function usageReport(rows, f = {}) {
  const sel = rows.filter((r) => (!f.since || String(r.at || "") >= f.since) && (!f.video || r.video === f.video) && (!f.run || r.run === f.run) && (!f.stage || r.stage === f.stage));
  const gem = sel.filter((r) => r.cost == null);
  const priced = sel.filter((r) => r.cost != null);
  const by = new Map();
  gem.forEach((r) => {
    const k = `${r.task}\t${r.model}`;
    const a = by.get(k) || { task: r.task, model: String(r.model).replace(/^models\//, ""), calls: 0, grounded: 0, batch: 0, in: 0, cached: 0, out: 0, usd: 0 };
    a.calls++;
    a.grounded += r.grounded ? 1 : 0;
    a.batch += r.batch ? 1 : 0;
    a.in += r.in || 0;
    a.cached += Math.min(r.in || 0, r.cachedIn || 0);
    a.out += r.out || 0;
    a.usd += costOf(r);
    by.set(k, a);
  });
  const pb = new Map();
  priced.forEach((r) => {
    const k = `${r.provider || "other"}\t${r.task}\t${r.model}`;
    const a = pb.get(k) || { provider: r.provider || "other", task: r.task, model: r.model, calls: 0, cached: 0, failed: 0, cost: 0 };
    a.calls++;
    a.cached += r.cached ? 1 : 0;
    a.failed += r.ok === false ? 1 : 0;
    a.cost += Number(r.cost) || 0;
    pb.set(k, a);
  });
  const gemini = [...by.values()].sort((a, b) => b.usd - a.usd || b.in + b.out - (a.in + a.out));
  const inTok = gemini.reduce((x, a) => x + a.in, 0);
  const cachedTok = gemini.reduce((x, a) => x + a.cached, 0);
  return {
    gemini,
    priced: [...pb.values()].sort((a, b) => b.cost - a.cost),
    geminiCalls: gem.length,
    pricedCalls: priced.length,
    inTok,
    cachedTok,
    cachedShare: inTok ? cachedTok / inTok : 0,
    geminiUsd: gemini.reduce((x, a) => x + a.usd, 0),
    pricedUsd: priced.reduce((x, r) => x + (Number(r.cost) || 0), 0),
  };
}

function main() {
  const f = { since: arg("--since"), video: arg("--video"), run: arg("--run"), stage: arg("--stage") };
  if (!fs.existsSync(LEDGER)) {
    console.log("no usage recorded yet");
    return;
  }
  const rep = usageReport(readLedger(LEDGER), f);
  const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(0)}%` : "-");
  console.log("Gemini");
  console.log("task".padEnd(28) + "model".padEnd(26) + "calls".padStart(6) + "grounded".padStart(9) + "batch".padStart(6) + "in tok".padStart(11) + "cached".padStart(8) + "out tok".padStart(10) + "~$".padStart(9));
  rep.gemini.forEach((a) => {
    console.log(String(a.task).padEnd(28) + a.model.padEnd(26) + String(a.calls).padStart(6) + String(a.grounded).padStart(9) + String(a.batch).padStart(6) + String(a.in).padStart(11) + pct(a.cached, a.in).padStart(8) + String(a.out).padStart(10) + a.usd.toFixed(4).padStart(9));
  });
  const scope = [f.video && `video ${f.video}`, f.run && `run ${f.run}`, f.stage && `stage ${f.stage}`].filter(Boolean).join(", ");
  console.log(`${rep.geminiCalls} calls since ${f.since || "the start of the ledger"}${scope ? ` (${scope})` : ""}; cached input ${pct(rep.cachedTok, rep.inTok)} of ${rep.inTok} tokens; ~$${rep.geminiUsd.toFixed(4)}`);

  if (rep.priced.length) {
    console.log("\nPriced calls (fal.ai etc.)");
    console.log("provider".padEnd(9) + "task".padEnd(20) + "model".padEnd(44) + "calls".padStart(6) + "cached".padStart(7) + "failed".padStart(7) + "$".padStart(9));
    rep.priced.forEach((a) => {
      console.log(a.provider.padEnd(9) + String(a.task).padEnd(20) + String(a.model).padEnd(44) + String(a.calls).padStart(6) + String(a.cached).padStart(7) + String(a.failed).padStart(7) + a.cost.toFixed(4).padStart(9));
    });
    console.log(`$${rep.pricedUsd.toFixed(4)} total across ${rep.pricedCalls} priced calls`);
  }
  console.log(`\n~$${(rep.geminiUsd + rep.pricedUsd).toFixed(4)} total (Gemini estimated from lib/ai/models.js PRICES)`);
}

if (require.main === module) main();

module.exports = { usageReport };
