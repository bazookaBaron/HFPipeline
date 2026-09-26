#!/usr/bin/env node
"use strict";
// Dry run: compile a v3 storyboard against SYNTHETIC word timings (0.27 s/word, 0.2 s sentence gaps;
// LF: 0.36 s/word, 0.35 s gaps or the sentence's pauseAfter) and write a stage-preview fixture.
// Usage: node tools/v3-dryrun.js sb.json out.json [--media manifest.json] [--endcard]
// LF: the media manifest defaults to sb.mediaManifest (relative to the storyboard); no caption words.
const fs = require("fs");
const path = require("path");
const { compileStoryboard } = require("../lib/video/v3/compile");
const sbPath = process.argv[2];
let sb = JSON.parse(fs.readFileSync(sbPath, "utf-8"));
if (process.argv.includes("--endcard")) sb = require("../lib/video/v3/endcard").appendEndcard(sb);
const isLF = sb.profile === "LF";
const mi = process.argv.indexOf("--media");
const mediaPath = mi > 0 ? path.resolve(process.argv[mi + 1]) : typeof sb.mediaManifest === "string" ? path.resolve(path.dirname(sbPath), sb.mediaManifest) : null;
const media = mediaPath ? JSON.parse(fs.readFileSync(mediaPath, "utf-8")) : null;
const SYN = isLF ? { word: 0.36, gap: 0.35 } : { word: 0.27, gap: 0.2 };
let t = 0.15;
const words = [];
const sentenceTimes = sb.sentences.map((s) => {
  const toks = s.text.split(/\s+/).filter(Boolean);
  const start = t;
  toks.forEach((w, wi) => {
    words.push({ i: words.length, sentenceId: s.id, wi, text: w, start: +t.toFixed(3), end: +(t + SYN.word - 0.03).toFixed(3) });
    t += SYN.word;
  });
  const st = { id: s.id, start: +(start - 0.06).toFixed(3), end: +t.toFixed(3) };
  t += isLF && s.pauseAfter !== undefined ? Number(s.pauseAfter) : SYN.gap;
  return st;
});
const total = +(t + 0.3).toFixed(3);
const spec = compileStoryboard(sb, { sentenceTimes, words, totalSeconds: total }, { media });
fs.writeFileSync(process.argv[3], JSON.stringify({ duration: total, profile: sb.profile || "DH", spec, words: isLF ? [] : words }, null, 1));
console.log(JSON.stringify({ total, scaffolds: spec.scaffolds.map((s) => [s.id, s.t0, s.t1, s.layout]), events: spec.events.length }));
