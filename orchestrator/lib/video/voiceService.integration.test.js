"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createVoiceService } = require("./voiceService");

test("persistent client speaks to real F5/WhisperX worker", { skip: process.env.VOICE_INTEGRATION !== "1" }, async () => {
  const output = path.resolve(__dirname, "..", "..", "..", "analysis", "voice-ab");
  const audioPath = path.join(output, "service-integration.wav");
  const timingPath = path.join(output, "service-integration.json");
  const service = createVoiceService();
  try {
    const result = await service.synthesize({ genText: "A hash collision slows lookup.",
      outAudio: audioPath, outTiming: timingPath, speed: 1, trim: true });
    assert.equal(result.words.length, 5);
    assert.deepEqual(result.words.map((word) => word.i), [0, 1, 2, 3, 4]);
    assert.ok(result.leadTrimSeconds >= 0);
    assert.ok(fs.statSync(audioPath).size > 1000);
    assert.equal(JSON.parse(fs.readFileSync(timingPath, "utf8")).length, 5);
  } finally {
    await service.close();
  }
});
