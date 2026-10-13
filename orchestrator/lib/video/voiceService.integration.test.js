"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createVoiceService } = require("./voiceService");

test("persistent client speaks to real F5/WhisperX worker", { skip: process.env.VOICE_INTEGRATION !== "1" }, async () => {
  const output = process.env.VOICE_TEST_OUTPUT || path.resolve(__dirname, "..", "..", "..", "analysis", "voice-ab");
  fs.mkdirSync(output, { recursive: true });
  const audioPath = path.join(output, "service-integration.wav");
  const timingPath = path.join(output, "service-integration.json");
  const storyboard = process.env.VOICE_TEST_STORYBOARD ? JSON.parse(fs.readFileSync(process.env.VOICE_TEST_STORYBOARD, "utf8")) : null;
  const genText = storyboard ? storyboard.sentences[0].text : "A hash collision slows lookup.";
  const profilePath = process.env.VOICE_TEST_PROFILE;
  const profile = profilePath ? JSON.parse(fs.readFileSync(profilePath, "utf8")) : null;
  const reference = profile ? { refAudio: path.resolve(path.dirname(profilePath), profile.reference_audio), refText: profile.reference_text } : {};
  const firstRequestTimeoutMs = Number(process.env.VOICE_TEST_TIMEOUT_MS || 180000);
  const service = createVoiceService({ firstRequestTimeoutMs, log: (line) => {
    if (/^\[voice-worker\]/.test(line)) process.stderr.write(`${line}\n`);
  } });
  try {
    const result = await service.synthesize({ genText, ...reference,
      outAudio: audioPath, outTiming: timingPath, speed: 1, trim: true });
    const wordCount = genText.split(/\s+/).length;
    assert.equal(result.words.length, wordCount);
    assert.deepEqual(result.words.map((word) => word.i), Array.from({ length: wordCount }, (_, i) => i));
    assert.ok(result.leadTrimSeconds >= 0);
    assert.ok(fs.statSync(audioPath).size > 1000);
    assert.equal(JSON.parse(fs.readFileSync(timingPath, "utf8")).length, wordCount);
  } finally {
    await service.close();
  }
});
