"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildPrompt, cleanTopic, isNearDuplicate, appendUnique, collectTopics } = require("../generate-topics");

test("prompt specifies the short video criteria and balanced coverage", () => {
  const prompt = buildPrompt(30, ["Why caches go stale"]);
  for (const phrase of ["45–55 second", "concrete question", "technical mechanism", "practical consequence", "6-14 words", "beginner-friendly", "everyday words", "ONE idea", "Do NOT append a colon", "computer science", "software engineering", "AI mechanisms", "platforms/infrastructure", "company", "Why caches go stale"]) {
    assert.ok(prompt.includes(phrase), phrase);
  }
});

test("cleaning keeps only the CLI contract fields and rejects unusable entries", () => {
  assert.deepEqual(cleanTopic({ topic: "  1. Why do caches   go stale? ", category: " databases  ", extra: true }),
    { topic: "Why do caches go stale?", category: "databases" });
  assert.deepEqual(cleanTopic({ topic: "What is backpressure?" }),
    { topic: "What is backpressure?", category: "uncategorized" });
  assert.equal(cleanTopic({ topic: 42 }), null);
  assert.equal(cleanTopic({ topic: "   " }), null);
});

test("duplicate checks cover punctuation, phrasing, and avoid history", () => {
  assert.equal(isNearDuplicate("Why do B-trees help databases?", "How B trees help databases"), true);
  assert.equal(isNearDuplicate("Why do caches go stale?", "Why do caches go stale!"), true);
  assert.equal(isNearDuplicate("How does TCP congestion control work?", "How does TCP handshake work?"), false);
  const accepted = [];
  appendUnique([
    { topic: "Why do B-trees help databases?", category: "databases" },
    { topic: "How B trees help databases", category: "databases" },
    { topic: "Why do caches go stale?", category: "platforms" },
    { topic: "How does TCP congestion control work?", category: "networking" },
    { topic: "", category: "none" },
  ], accepted, ["What makes caches go stale?"], 2);
  assert.deepEqual(accepted.map((item) => item.topic), ["Why do B-trees help databases?", "How does TCP congestion control work?"]);
});

test("short batches refill only remaining slots without persisting anything", async () => {
  const calls = [];
  const batches = [
    [{ topic: "Why do B-trees help databases?", category: "databases" }],
    [{ topic: "How B trees help databases", category: "databases" }, { topic: "How does TCP congestion control work?", category: "networking" }],
  ];
  const result = await collectTopics(2, [], async (remaining, excluded) => {
    calls.push({ remaining, excluded });
    return batches.shift();
  });
  assert.deepEqual(calls, [{ remaining: 2, excluded: [] }, { remaining: 1, excluded: ["Why do B-trees help databases?"] }]);
  assert.deepEqual(result, [
    { topic: "Why do B-trees help databases?", category: "databases" },
    { topic: "How does TCP congestion control work?", category: "networking" },
  ]);
  assert.deepEqual(Object.keys(result[0]), ["topic", "category"]);
});

test("exhausted short batches fail instead of returning a partial calendar", async () => {
  await assert.rejects(collectTopics(2, [], async () => [{ topic: "Same topic", category: "test" }]),
    /Only 1\/2 unique topics after 3 batches/);
  await assert.rejects(collectTopics(1, [], async () => ({ topic: "not an array" })),
    /did not return a topic array/);
});
