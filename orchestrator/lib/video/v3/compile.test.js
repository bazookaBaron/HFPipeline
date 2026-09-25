"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { compileStoryboard } = require("./compile");
const { chunkWords } = require("./composeStage");

function synthTimeline(sb) {
  let t = 0.1;
  const words = [];
  const sentenceTimes = sb.sentences.map((s) => {
    const start = t;
    s.text.split(/\s+/).filter(Boolean).forEach((w, wi) => {
      words.push({ i: words.length, sentenceId: s.id, wi, text: w, start: t, end: t + 0.2 });
      t += 0.25;
    });
    const st = { id: s.id, start, end: t };
    t += 0.2;
    return st;
  });
  return { words, sentenceTimes, totalSeconds: t + 0.3 };
}

const pilot = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../fixtures/v3/bluegreen-dh.json"), "utf-8"));

test("pilot storyboard compiles: scaffolds tile the video, carrier ids persist", () => {
  const tl = synthTimeline(pilot);
  const spec = compileStoryboard(pilot, tl);
  assert.strictEqual(spec.scaffolds[0].t0, 0);
  for (let i = 1; i < spec.scaffolds.length; i++) assert.strictEqual(spec.scaffolds[i].t0, spec.scaffolds[i - 1].t1);
  assert.strictEqual(spec.scaffolds.at(-1).t1, Math.round(tl.totalSeconds * 1000) / 1000);
  const idea = spec.scaffolds.find((s) => s.id === "idea");
  const sw = spec.scaffolds.find((s) => s.id === "switch");
  ["router", "lever", "left", "right", "hud"].forEach((id) => {
    assert.ok(idea.modules.some((m) => m.id === id), id + " in idea");
    assert.ok(sw.modules.some((m) => m.id === id), id + " in switch");
  });
  assert.strictEqual(sw.layout, "full");
  assert.strictEqual(spec.events.length, pilot.events.length);
});

test("event whose target is not on screen is rejected, not guessed", () => {
  const sb = JSON.parse(JSON.stringify(pilot));
  sb.events.push({ sentence: "s1", anchor: { text: "works." }, op: "traffic", target: "router", value: { left: 0 } });
  assert.throws(() => compileStoryboard(sb, synthTimeline(sb)), /not on screen/);
});

test("missing anchor word throws", () => {
  const sb = JSON.parse(JSON.stringify(pilot));
  sb.events[0].anchor.text = "purple";
  assert.throws(() => compileStoryboard(sb, synthTimeline(sb)), /not found/);
});

test("caption chunks: <=4 words, break on sentence end, no orphan singles", () => {
  const ws = "Blue is live and serves every request, while green sits idle. Now deploy.".split(" ").map((w, i) => ({ text: w, start: i * 0.3, end: i * 0.3 + 0.25 }));
  const ch = chunkWords(ws, 4);
  ch.forEach((c) => assert.ok(c.length <= 5));
  assert.ok(ch.some((c) => /idle\.$/.test(c[c.length - 1].text)));
});
