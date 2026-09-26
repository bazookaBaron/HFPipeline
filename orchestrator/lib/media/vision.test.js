"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { parseVerdicts, verdictProblems, normFocal } = require("./vision");
const { parseQueryPlan, fallbackPlan } = require("./queries");
const { qualityProblems } = require("./quality");

test("rubric parsing: {results:[...]} keyed by i, missing items fail closed", () => {
  const v = parseVerdicts(
    {
      results: [
        { i: 2, matches: true, confidence: 0.9, watermark: false, heavyText: false, graphic: false, isScreenshot: false, focal: [0.1, 0.2, 0.5, 0.6], depicts: "A320 on tarmac" },
        { i: 1, matches: "true", confidence: "0.4", watermark: "false", focal: [10, 20, 50, 60] },
      ],
    },
    3
  );
  assert.strictEqual(v.length, 3);
  assert.strictEqual(v[0].matches, true);
  assert.strictEqual(v[0].confidence, 0.4);
  assert.deepStrictEqual(v[0].focal, [0.1, 0.2, 0.5, 0.6]); // percent -> fraction
  assert.deepStrictEqual(v[1].focal, [0.1, 0.2, 0.5, 0.6]);
  assert.strictEqual(v[2].missing, true);
  assert.strictEqual(v[2].matches, false);
});

test("rubric parsing: bare array and single object; focal clamped", () => {
  const v = parseVerdicts([{ matches: true, confidence: 1.4, focal: [0.8, 0.8, 0.5, 0.5] }, { matches: false }], 2);
  assert.strictEqual(v[0].confidence, 1);
  assert.deepStrictEqual(v[0].focal, [0.8, 0.8, 0.2, 0.2]);
  assert.strictEqual(parseVerdicts({ matches: true, confidence: 0.8 }, 1)[0].matches, true);
  assert.deepStrictEqual(normFocal("nope"), [0, 0, 1, 1]);
});

test("verdict problems: off-intent, low confidence, watermark, text (not for logos), screenshot, graphic", () => {
  const ok = { matches: true, confidence: 0.8, watermark: false, heavyText: false, graphic: false, isScreenshot: false };
  assert.deepStrictEqual(verdictProblems(ok, "photo"), []);
  assert.match(verdictProblems({ ...ok, matches: false, depicts: "a portrait" }, "photo")[0], /off-intent \(a portrait\)/);
  assert.match(verdictProblems({ ...ok, confidence: 0.5 }, "photo")[0], /low confidence/);
  assert.deepStrictEqual(verdictProblems({ ...ok, watermark: true, isScreenshot: true, graphic: true }, "photo"), ["watermark", "graphic content", "screenshot"]);
  assert.deepStrictEqual(verdictProblems({ ...ok, heavyText: true }, "photo"), ["heavy text"]);
  assert.deepStrictEqual(verdictProblems({ ...ok, heavyText: true }, "logo"), []);
});

test("query plan: sanitised, deduped, capped at 5, entity kept", () => {
  const p = parseQueryPlan(
    { queries: ['"Karachi port"', "Karachi Port", "Karachi container terminal", "a", "b", "c", "d"], rubric: "Shows cranes", nasaRelevant: "yes", wikidataSearch: "Port of Karachi" },
    { kind: "photo", intent: "Karachi port cranes" }
  );
  assert.deepStrictEqual(p.queries.slice(0, 2), ["Karachi port", "Karachi container terminal"]);
  assert.strictEqual(p.queries.length, 5);
  assert.strictEqual(p.nasaRelevant, false); // only literal true counts
  assert.strictEqual(p.wikidataSearch, "Port of Karachi");
  const fb = parseQueryPlan(null, { kind: "logo", entity: "Amul", intent: "Amul logo on a milk packet" });
  assert.strictEqual(fb.queries[0], "Amul logo");
  assert.match(fallbackPlan({ kind: "photo", intent: "Indian rupee banknotes close-up" }).queries[0], /Indian rupee banknotes/);
});

test("quality: min width by slot size, aspect sanity, upscale <= 1.5x", () => {
  const full = { kind: "photo", intent: "x" };
  assert.deepStrictEqual(qualityProblems({ width: 1920, height: 1280 }, full), []);
  assert.deepStrictEqual(qualityProblems({ width: 1280, height: 853 }, full), []);
  assert.ok(qualityProblems({ width: 1200, height: 759 }, full).some((p) => /width 1200 < 1280/.test(p)));
  assert.ok(qualityProblems({ width: 1920, height: 1920 }, full).some((p) => /aspect/.test(p)));
  assert.ok(qualityProblems({ width: 1920, height: 700 }, full).some((p) => /aspect|upscale/.test(p)));
  const card = { kind: "photo", size: "card", intent: "x" };
  assert.deepStrictEqual(qualityProblems({ width: 1024, height: 768 }, card), []);
  assert.ok(qualityProblems({ width: 700, height: 500 }, card).length);
  assert.deepStrictEqual(qualityProblems({ width: 600, height: 800 }, { kind: "portrait", intent: "x" }), []);
  assert.deepStrictEqual(qualityProblems({ width: 400, height: 120 }, { kind: "logo", intent: "x" }), []);
  assert.deepStrictEqual(qualityProblems({ width: 1920, height: 400, vector: true }, { kind: "logo", intent: "x" }), []);
  assert.ok(qualityProblems({ width: 1000, height: 700 }, { kind: "photo", intent: "x", minWidth: 1100, size: "card" }).length);
});

const { buildVisionPrompt } = require("./vision");

test("vision prompt: era default, entity-exact logo, main-focus, illustration text rule", () => {
  const p = buildVisionPrompt({ kind: "photo", intent: "Pakistani rupee banknotes" }, "r", 2);
  assert.match(p, /Era wanted: present day, unless/);
  assert.match(p, /main focus/);
  assert.match(buildVisionPrompt({ kind: "photo", intent: "x", era: "1990s" }, "r", 1), /Era wanted: 1990s/);
  const logo = buildVisionPrompt({ kind: "logo", entity: "Kingfisher Airlines", intent: "logo" }, "r", 1, { id: "Q744935", description: "airline based in India" });
  assert.match(logo, /mark of exactly Kingfisher Airlines \(airline based in India, Wikidata Q744935\)/);
  const ill = buildVisionPrompt({ kind: "illustration", intent: "x" }, "r", 1);
  assert.match(ill, /ANY legible letters/);
  assert.doesNotMatch(ill, /Era wanted/);
});

test("verdict problems: wrong era, incidental subject, text in illustration", () => {
  const ok = { matches: true, confidence: 0.9 };
  assert.deepStrictEqual(verdictProblems({ ...ok, wrongEra: true }, "photo"), ["wrong era"]);
  assert.deepStrictEqual(verdictProblems({ ...ok, incidental: true }, "photo"), ["subject incidental"]);
  assert.deepStrictEqual(verdictProblems({ ...ok, heavyText: true }, "illustration"), ["text in illustration"]);
  const v = parseVerdicts({ results: [{ i: 1, matches: true, confidence: 0.9, wrongEra: "true", incidental: true }] }, 1)[0];
  assert.strictEqual(v.wrongEra, true);
  assert.strictEqual(v.incidental, true);
});
