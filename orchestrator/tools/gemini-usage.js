#!/usr/bin/env node
"use strict";
/**
 * Summarise the usage ledger (orchestrator/output/gemini-usage.jsonl) by task and model:
 * Gemini calls with their tokens, and priced provider calls (fal.ai images, cut-outs) with their $ cost.
 *   node tools/gemini-usage.js [--since 2026-09-26]
 */
const fs = require("fs");
const { LEDGER } = require("../lib/ai/models");

const i = process.argv.indexOf("--since");
const since = i > 0 ? process.argv[i + 1] : "";
if (!fs.existsSync(LEDGER)) {
  console.log("no usage recorded yet");
  process.exit(0);
}
const rows = fs.readFileSync(LEDGER, "utf-8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)).filter((r) => !since || r.at >= since);
const gem = rows.filter((r) => r.cost == null);
const priced = rows.filter((r) => r.cost != null);

const by = new Map();
gem.forEach((r) => {
  const k = `${r.task}\t${r.model}`;
  const a = by.get(k) || { calls: 0, grounded: 0, in: 0, out: 0 };
  a.calls++;
  a.grounded += r.grounded ? 1 : 0;
  a.in += r.in || 0;
  a.out += r.out || 0;
  by.set(k, a);
});
console.log("Gemini");
console.log("task".padEnd(22) + "model".padEnd(26) + "calls".padStart(6) + "grounded".padStart(9) + "in tok".padStart(11) + "out tok".padStart(10));
[...by.entries()].sort((a, b) => b[1].in + b[1].out - (a[1].in + a[1].out)).forEach(([k, a]) => {
  const [task, model] = k.split("\t");
  console.log(task.padEnd(22) + String(model).replace(/^models\//, "").padEnd(26) + String(a.calls).padStart(6) + String(a.grounded).padStart(9) + String(a.in).padStart(11) + String(a.out).padStart(10));
});
console.log(`${gem.length} calls since ${since || "the start of the ledger"}`);

if (priced.length) {
  const pb = new Map();
  priced.forEach((r) => {
    const k = `${r.provider || "other"}\t${r.task}\t${r.model}`;
    const a = pb.get(k) || { calls: 0, cached: 0, failed: 0, cost: 0 };
    a.calls++;
    a.cached += r.cached ? 1 : 0;
    a.failed += r.ok === false ? 1 : 0;
    a.cost += Number(r.cost) || 0;
    pb.set(k, a);
  });
  console.log("\nPriced calls (fal.ai etc.)");
  console.log("provider".padEnd(9) + "task".padEnd(20) + "model".padEnd(44) + "calls".padStart(6) + "cached".padStart(7) + "failed".padStart(7) + "$".padStart(9));
  let total = 0;
  [...pb.entries()].sort((a, b) => b[1].cost - a[1].cost).forEach(([k, a]) => {
    const [prov, task, model] = k.split("\t");
    total += a.cost;
    console.log(prov.padEnd(9) + task.padEnd(20) + String(model).padEnd(44) + String(a.calls).padStart(6) + String(a.cached).padStart(7) + String(a.failed).padStart(7) + a.cost.toFixed(4).padStart(9));
  });
  console.log(`$${total.toFixed(4)} total across ${priced.length} priced calls`);
}
