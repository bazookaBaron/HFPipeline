"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { NARRATIVE_GUIDE, narrativeProblems } = require("./narrativeGuide");
const { buildPrompt, validate } = require("./storyboardGen");

test("reference-derived guide allows distinct causal arcs and excludes the fixed CTA", () => {
  assert.match(NARRATIVE_GUIDE, /naive fix.*systems problem/i);
  assert.match(NARRATIVE_GUIDE, /worked example/i);
  assert.match(NARRATIVE_GUIDE, /company\/platform/i);
  assert.match(NARRATIVE_GUIDE, /fixed branded ending is appended separately/i);
  assert.match(NARRATIVE_GUIDE, /reducing risk/);
});

test("all active prompt profiles receive the spoken-story guide", () => {
  for (const profile of ["DH", "LC", "DC"]) {
    const prompt = buildPrompt("Why retries can charge twice", { profile, lengthSeconds: 50 });
    assert.match(prompt, /SPOKEN STORY/);
    assert.match(prompt, /one concrete/i);
    assert.match(prompt, /callback takeaway/i);
  }
});

test("high-confidence failures are rejected without enforcing one hook template", () => {
  assert.deepEqual(narrativeProblems([
    { id: "s1", text: "In this video we will discuss payment retries." },
    { id: "s2", text: "Follow for more videos." },
    { id: "s3", text: "Follow for more videos." },
  ]).length, 4);
  assert.deepEqual(narrativeProblems([
    { id: "s1", text: "What exactly is an AI harness?" },
    { id: "s2", text: "The model cannot open the repository by itself." },
  ]), []);
  assert.deepEqual(narrativeProblems([
    { id: "s1", text: "Let's design a file upload service." },
  ]), []);
  assert.ok(narrativeProblems([{ id: "s1", text: "This eliminates stale reads." }])
    .some((problem) => problem.includes("absolute outcome")));
});

test("existing storyboard fixtures do not acquire script-specific failures", () => {
  for (const name of ["cdn-dh", "oauth-lc", "k8s-dc"]) {
    const sb = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../fixtures/v3", `${name}.json`), "utf8"));
    assert.deepEqual(narrativeProblems(sb.sentences), [], name);
  }
});

test("the v3 validator applies narration checks without changing the storyboard schema", () => {
  const sb = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../fixtures/v3/cdn-dh.json"), "utf8"));
  sb.sentences[0].text = "In this video we will discuss content delivery networks.";
  assert.ok(validate(sb, { lengthSeconds: 45 }).some((problem) => problem.includes("generic throat-clearing")));
});
