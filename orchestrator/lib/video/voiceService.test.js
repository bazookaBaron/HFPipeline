"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createVoiceService } = require("./voiceService");

const workerPath = path.resolve(__dirname, "..", "..", "..", "voice-pipeline", "tts_worker.py");
const pythonExe = process.env.TEST_PYTHON || "python";

test("validates requests without starting a worker", async () => {
  const service = createVoiceService({ pythonExe, workerPath });
  await assert.rejects(service.synthesize({ genText: "hello" }), /outAudio/);
  await service.close();
});

test("worker returns structured errors and remains available until shutdown", async () => {
  const service = createVoiceService({ pythonExe, workerPath });
  await assert.rejects(service.synthesize({ genText: "x", outAudio: "a.wav", outTiming: "a.json", speed: -1 }), /speed must be positive/);
  await assert.rejects(service.synthesize({ genText: "x", outAudio: "a.wav", outTiming: "a.json", speed: 0 }), /speed must be positive/);
  await service.close();
  await assert.rejects(service.synthesize({ genText: "x", outAudio: "a.wav", outTiming: "a.json" }), /closed/);
});
