"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { planNarration, hostWindows, resolveEvents, findAnchorIndex } = require("./timeline");

const sentences = [
  { id: "s1", text: "Blue serves everyone." },
  { id: "s2", text: "Green, then green again." },
];
const clips = [
  // 1.1 s of TTS lead silence, like the measured F5 output
  { audioPath: "a.wav", durationSeconds: 2.6, words: [{ word: "Blue", start: 1.1, end: 1.4 }, { word: "serves", start: 1.45, end: 1.8 }, { word: "everyone.", start: 1.85, end: 2.4 }] },
  { audioPath: "b.wav", durationSeconds: 3.0, words: [{ word: "Green,", start: 0.8, end: 1.1 }, { word: "then", start: 1.2, end: 1.4 }, { word: "green", start: 1.5, end: 1.8 }, { word: "again.", start: 1.85, end: 2.3 }] },
];

test("trims lead silence, inserts the reference 200 ms gap, keeps word times consistent", () => {
  const p = planNarration(sentences, clips);
  assert.deepStrictEqual(p.segments[0], { audioPath: "a.wav", trimStart: 1.04, trimEnd: 2.48, at: 0 });
  assert.strictEqual(p.words[0].start, 0.06); // first word 60 ms into the video, not 1.1 s
  assert.strictEqual(p.segments[1].at, 1.64); // 1.44 s of sentence 1 + 0.2 s gap
  assert.strictEqual(p.words[3].start, 1.64 + 0.06);
  assert.strictEqual(p.words.length, 7);
  assert.ok(p.words.every((w, i) => w.i === i));
  // Sentence-gap silence between speech: last word of s1 ends 1.36, first of s2 starts 1.70
  assert.ok(Math.abs(p.words[3].start - p.words[2].end - 0.34) < 1e-9);
});

test("refuses to guess when aligned word count differs from text tokens", () => {
  const bad = [clips[0], { ...clips[1], words: clips[1].words.slice(0, 3) }];
  assert.throws(() => planNarration(sentences, bad), /refusing to guess/);
});

test("hosts tile the timeline and events bind to the right occurrence", () => {
  const p = planNarration(sentences, clips);
  const sb = {
    sentences,
    hosts: [{ id: "h1", fromSentence: "s1" }, { id: "h2", fromSentence: "s2" }],
    events: [
      { id: "e1", host: "h1", sentence: "s1", anchor: { text: "Blue", occurrence: 1 } },
      { id: "e2", host: "h2", sentence: "s2", anchor: { text: "green", occurrence: 2 } },
    ],
  };
  const wins = hostWindows(sb, p.sentenceTimes, p.totalSeconds);
  assert.strictEqual(wins[0].start, 0);
  assert.strictEqual(wins[0].end, wins[1].start);
  assert.strictEqual(wins[1].end, p.totalSeconds);
  const ev = resolveEvents(sb, p.words, wins);
  assert.strictEqual(ev[0].t, 0.06);
  assert.strictEqual(ev[1].word, "green"); // second occurrence, not "Green,"
  assert.strictEqual(ev[1].abs, p.words[5].start);
  assert.strictEqual(ev[1].t, Math.round((p.words[5].start - wins[1].start) * 1000) / 1000);
});

test("matcher is punctuation-insensitive and occurrence-aware", () => {
  assert.strictEqual(findAnchorIndex("It hits O(N).", { text: "O(N)" }), 2);
  assert.strictEqual(findAnchorIndex("Green, then green again.", { text: "green", occurrence: 2 }), 2);
});
