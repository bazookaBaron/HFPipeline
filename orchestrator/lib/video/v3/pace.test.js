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
