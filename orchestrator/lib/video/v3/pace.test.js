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

test("LF pace: wpm primary (160), syllable guard band 4.2-5.4, 0.35 s gaps, pauseAfter", () => {
  const { paceFor, sentenceGaps } = require("./pace");
  const lf = paceFor("LF");
  assert.strictEqual(paceFor("DH").sentenceGap, 0.2);
  assert.strictEqual(paceFor("DH").wpm, undefined); // shorts stay syllable-primary
  assert.strictEqual(lf.sentenceGap, 0.35);
  assert.strictEqual(lf.wpm, 160);
  assert.deepStrictEqual(lf.sylBand, [4.2, 5.4]);
  const gaps = sentenceGaps([{ id: "a" }, { id: "b", pauseAfter: 0.6 }, { id: "c" }], lf);
  assert.deepStrictEqual(gaps, [0.35, 0.6, 0]);
  const solve = (o) => solvePace({ ...o, sylPerS: lf.sylPerS, wpmRange: lf.wpmRange, wpm: lf.wpm, sylBand: lf.sylBand });
  // plain words (1.5 syl/word): 160 wpm lands at ~4.3 syl/s -- inside the band
  const plain = solve({ speech: 60, gaps: 5, nWords: 200, nSyllables: 300 });
  assert.ok(Math.abs(plain.wpm - 160) < 0.5, `wpm ${plain.wpm}`);
  assert.ok(plain.sylPerS >= 4.2 && plain.sylPerS <= 5.4, `syl/s ${plain.sylPerS}`);
  // jargon-heavy (2.0 syl/word): 160 wpm would be ~6 syl/s -> slowed to the 5.4 band edge
  const dense = solve({ speech: 60, gaps: 5, nWords: 200, nSyllables: 400 });
  assert.ok(Math.abs(dense.sylPerS - 5.4) < 0.02, `syl/s ${dense.sylPerS}`);
  assert.ok(dense.wpm >= 140 - 0.5 && dense.wpm < 160, `wpm ${dense.wpm}`);
  // very short words (1.1 syl/word, 3.1 syl/s at 160 wpm): 160 wpm would be < 4.2 syl/s -> sped up to the band edge, wpm capped at 175
  const tiny = solve({ speech: 60, gaps: 5, nWords: 200, nSyllables: 220 });
  assert.ok(tiny.wpm <= 175 + 0.5, `wpm ${tiny.wpm}`);
  assert.ok(tiny.sylPerS >= 4.2 - 0.02 || Math.abs(tiny.wpm - 175) < 0.5, `syl/s ${tiny.sylPerS} wpm ${tiny.wpm}`);
});
