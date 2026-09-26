#!/usr/bin/env node
"use strict";
/**
 * Summarise the Gemini usage ledger (orchestrator/output/gemini-usage.jsonl) by task and model.
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
const by = new Map();
rows.forEach((r) => {
  const k = `${r.task}\t${r.model}`;
  const a = by.get(k) || { calls: 0, grounded: 0, in: 0, out: 0 };
  a.calls++;
  a.grounded += r.grounded ? 1 : 0;
  a.in += r.in;
  a.out += r.out;
  by.set(k, a);
});
console.log("task".padEnd(22) + "model".padEnd(26) + "calls".padStart(6) + "grounded".padStart(9) + "in tok".padStart(11) + "out tok".padStart(10));
[...by.entries()].sort((a, b) => b[1].in + b[1].out - (a[1].in + a[1].out)).forEach(([k, a]) => {
  const [task, model] = k.split("\t");
  console.log(task.padEnd(22) + String(model).replace(/^models\//, "").padEnd(26) + String(a.calls).padStart(6) + String(a.grounded).padStart(9) + String(a.in).padStart(11) + String(a.out).padStart(10));
});
console.log(`${rows.length} calls since ${since || "the start of the ledger"}`);
