"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  generateStoryboard, validate, sparseSceneIds, normalizeNodePositions,
} = require("./storyboardGen");

const fixturePath = path.join(__dirname, "../../../fixtures/v3/oauth-lc.json");
const fixture = () => JSON.parse(fs.readFileSync(fixturePath, "utf8"));

test("sparse LC scene is repaired by a small panel request while narration and events stay unchanged", async () => {
  const original = fixture();
  original.scaffolds[0].slots.top[0].h = 200;
  const problems = validate(original, { lengthSeconds: 45 });
  assert.deepEqual(sparseSceneIds(problems), ["sc1"]);
  const calls = [];
  const generate = async (prompt) => {
    calls.push(prompt);
    if (calls.length === 1) return structuredClone(original);
    assert.match(prompt, /Repair only the sparse visual scenes/);
    assert.ok(prompt.length < 4000, "panel repair should be much smaller than the full storyboard prompt");
    return { panels: [{ scaffoldId: "sc1", title: "SIGN IN FLOW", rows: [
      "Browser asks for access", "Provider checks identity", "Token returns to app",
    ] }] };
  };
  const result = await generateStoryboard(original.topic, {
    profile: "LC", lengthSeconds: 45, layoutAudit: false, generate, maxAttempts: 4,
  });
  assert.equal(calls.length, 2);
  assert.equal(result.attempts.length, 1);
  assert.deepEqual(result.storyboard.sentences, original.sentences);
  assert.deepEqual(result.storyboard.events, original.events);
  assert.equal(result.storyboard.scaffolds[0].slots.top.at(-1).props.rows.length, 3);
  assert.deepEqual(validate(result.storyboard, { lengthSeconds: 45 }), []);
});

test("mechanical node clamp leaves the narration untouched", () => {
  const sb = fixture();
  const before = structuredClone(sb.sentences);
  const node = sb.scaffolds[0].slots.top[0].props.nodes[0];
  node.x = 0.18;
  assert.equal(normalizeNodePositions(sb), 1);
  assert.equal(node.x, 0.2);
  assert.deepEqual(sb.sentences, before);
});

test("bad panel patch is rejected without weakening the density check", async () => {
  const sb = fixture();
  sb.scaffolds[0].slots.top[0].h = 200;
  const prompts = [];
  const invalid = async (prompt) => {
    prompts.push(prompt);
    if (prompts.length === 1) return structuredClone(sb);
    return { panels: [{ scaffoldId: "sc1", title: "x", rows: ["too few"] }] };
  };
  await assert.rejects(generateStoryboard(sb.topic, {
    profile: "LC", lengthSeconds: 45, layoutAudit: false, generate: invalid, maxAttempts: 1,
  }), /only \d+ px of content/);
  assert.equal(prompts.length, 3); // one full storyboard, two short patch attempts
});
