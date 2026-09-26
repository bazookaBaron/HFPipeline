"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { syllables, countSyllables, solvePace } = require("./pace");

test("syllable estimate", () => {
  assert.strictEqual(syllables("cache"), 1);
  assert.strictEqual(syllables("database"), 3);
  assert.strictEqual(syllables("logarithmic"), 4);
  assert.strictEqual(syllables("table"), 2);
  assert.strictEqual(countSyllables("Why binary search?"), 5);
});

test("jargon-heavy script slows to the reference syllable rate", () => {
  // 141 words, 275 syllables (1.95 syl/word), 44 s of speech at speed 1, 10 sentence gaps
  const p = solvePace({ speech: 44, gaps: 2, nWords: 141, nSyllables: 275 });
  assert.ok(Math.abs(p.sylPerS - 5.84) < 0.01, `syl/s ${p.sylPerS}`);
  assert.ok(p.wpm >= 170 && p.wpm <= 222, `wpm ${p.wpm}`);
});

test("wpm is clamped to the reference range", () => {
  // short words: hitting 5.84 syl/s would need ~245 wpm -> clamp to 222
  const fast = solvePace({ speech: 40, gaps: 2, nWords: 160, nSyllables: 200 });
  assert.ok(Math.abs(fast.wpm - 222) < 0.5, `wpm ${fast.wpm}`);
  // very long words: 5.84 syl/s would give < 170 wpm -> clamp to 170
  const slow = solvePace({ speech: 40, gaps: 2, nWords: 120, nSyllables: 300 });
  assert.ok(Math.abs(slow.wpm - 170) < 0.5, `wpm ${slow.wpm}`);
});

test("LF pace: relaxed syllable rate, 140-175 wpm, 0.35 s gaps, pauseAfter", () => {
  const { paceFor, sentenceGaps } = require("./pace");
  const lf = paceFor("LF");
  assert.strictEqual(paceFor("DH").sentenceGap, 0.2);
  assert.strictEqual(lf.sentenceGap, 0.35);
  const gaps = sentenceGaps([{ id: "a" }, { id: "b", pauseAfter: 0.6 }, { id: "c" }], lf);
  assert.deepStrictEqual(gaps, [0.35, 0.6, 0]);
  // 150 words, 225 syllables (1.5 syl/word), 40 s of speech at speed 1
  const p = solvePace({ speech: 40, gaps: 3.5, nWords: 150, nSyllables: 225, sylPerS: lf.sylPerS, wpmRange: lf.wpmRange });
  assert.ok(p.wpm >= 140 - 0.5 && p.wpm <= 175 + 0.5, `wpm ${p.wpm}`);
});
