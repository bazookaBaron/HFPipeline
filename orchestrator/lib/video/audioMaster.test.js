"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { masterVideo, _test } = require("./audioMaster");

test("speed 1 keeps timestamps and samples unchanged before mastering", () => {
  assert.deepEqual(_test.speedFilters(1), { video: "null", audio: "anull" });
  assert.deepEqual(_test.speedFilters(1.8), { video: "setpts=PTS/1.8", audio: "atempo=1.8" });
  assert.throws(() => _test.speedFilters(2.1), RangeError);
});

test("parses ffmpeg loudnorm JSON", () => {
  const report = 'noise\n{ "input_i" : "-19.00", "input_tp" : "-2.00", "input_lra" : "2.80", "input_thresh" : "-29.00", "target_offset" : "-0.10" }';
  assert.equal(_test.parseLoudnorm(report).input_lra, "2.80");
  assert.throws(() => _test.parseLoudnorm("noise"));
});

test("parses ebur128 summary", () => {
  const report = '[Parsed_ebur128_0] Summary:\n  Integrated loudness:\n    I:         -17.1 LUFS\n  Loudness range:\n    LRA:         1.8 LU\n  True peak:\n    Peak:       -1.2 dBFS\n';
  assert.deepEqual(_test.parseEbur128(report), {
    integratedLufs: -17.1, loudnessRangeLu: 1.8, truePeakDbtp: -1.2
  });
});

test("refuses an in-place output", async () => {
  await assert.rejects(masterVideo({ inputPath: "a.mp4", outputPath: "a.mp4" }), /must differ/);
});
