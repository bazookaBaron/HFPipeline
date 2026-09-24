"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createRunMetrics } = require("./runMetrics");

function fakeClock(steps) {
  let i = 0;
  return () => steps[Math.min(i++, steps.length - 1)];
}

test("records stage wall times and success", () => {
  const p = path.join(os.tmpdir(), `rm-${process.pid}-a.json`);
  const m = createRunMetrics({ runId: "r1", metricsPath: p, config: { lengthSeconds: 45 }, now: fakeClock([0, 10, 50, 50, 90, 100]) });
  m.start("script");
  m.start("voice"); // implicitly closes "script"
  m.end({ scenes: 3 });
  m.set("duration", { requestedSeconds: 45, finalSeconds: 44.2 });
  m.succeed();
  const saved = JSON.parse(fs.readFileSync(p, "utf-8"));
  assert.deepStrictEqual(saved.stages.map((s) => [s.stage, s.wallMs]), [["script", 40], ["voice", 40]]);
  assert.strictEqual(saved.stages[1].scenes, 3);
  assert.strictEqual(saved.outcome, "succeeded");
  assert.strictEqual(saved.duration.finalSeconds, 44.2);
  fs.unlinkSync(p);
});

test("failure records stage and class", () => {
  const p = path.join(os.tmpdir(), `rm-${process.pid}-b.json`);
  const m = createRunMetrics({ runId: "r2", metricsPath: p, config: {}, now: fakeClock([0, 5, 20, 20]) });
  m.start("check");
  m.fail("check", new Error("layout errors"));
  const saved = JSON.parse(fs.readFileSync(p, "utf-8"));
  assert.strictEqual(saved.outcome, "failed");
  assert.deepStrictEqual(saved.failure, { stage: "check", class: "component/layout", message: "layout errors" });
  assert.strictEqual(saved.stages[0].failed, true);
  fs.unlinkSync(p);
});
