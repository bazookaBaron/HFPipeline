#!/usr/bin/env node
"use strict";
// Dry run: compile a v3 storyboard against SYNTHETIC word timings (0.27 s/word, 0.2 s sentence gaps)
// and write a stage-preview fixture. Usage: node tools/v3-dryrun.js sb.json out.json
const fs = require("fs");
const { compileStoryboard } = require("../lib/video/v3/compile");
const sb = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"));
let t = 0.15;
const words = [];
const sentenceTimes = sb.sentences.map((s) => {
  const toks = s.text.split(/\s+/).filter(Boolean);
  const start = t;
  toks.forEach((w, wi) => {
    words.push({ i: words.length, sentenceId: s.id, wi, text: w, start: +t.toFixed(3), end: +(t + 0.24).toFixed(3) });
    t += 0.27;
  });
  const st = { id: s.id, start: +(start - 0.06).toFixed(3), end: +t.toFixed(3) };
  t += 0.2;
  return st;
});
const total = +(t + 0.3).toFixed(3);
const spec = compileStoryboard(sb, { sentenceTimes, words, totalSeconds: total });
fs.writeFileSync(process.argv[3], JSON.stringify({ duration: total, profile: "DH", spec, words }, null, 1));
console.log(JSON.stringify({ total, scaffolds: spec.scaffolds.map((s) => [s.id, s.t0, s.t1, s.layout]), events: spec.events.length }));
