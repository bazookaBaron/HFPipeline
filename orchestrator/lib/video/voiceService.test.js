"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createVoiceService } = require("./voiceService");

const workerPath = path.resolve(__dirname, "..", "..", "..", "voice-pipeline", "tts_worker.py");
const pythonExe = process.env.TEST_PYTHON || "python";
const mockWorker = path.join(__dirname, "test-fixtures", "mockVoiceWorker.js");

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

test("silent worker times out, terminates its process, and close stays bounded", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "voice-stall-test-"));
  const pidFile = path.join(dir, "worker.pid");
  const service = createVoiceService({ pythonExe: process.execPath, workerPath: mockWorker,
    firstRequestTimeoutMs: 150, requestTimeoutMs: 150, shutdownTimeoutMs: 200 });
  try {
    const started = Date.now();
    await assert.rejects(service.synthesize({ genText: "hang", outAudio: pidFile,
      outTiming: path.join(dir, "timing.json") }), /timed out after 150ms/);
    await service.close();
    assert.ok(Date.now() - started < 4000, "a dead worker must not hold the job open");
    const pid = Number(fs.readFileSync(pidFile, "utf8"));
    let alive = true;
    for (let i = 0; i < 30 && alive; i++) {
      try { process.kill(pid, 0); }
      catch (error) { if (error.code === "ESRCH") alive = false; else throw error; }
      if (alive) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(alive, false, "the worker process must be gone after timeout");
  } finally {
    await service.close();
    if (fs.existsSync(pidFile)) {
      try { process.kill(Number(fs.readFileSync(pidFile, "utf8")), "SIGKILL"); }
      catch (error) { if (error.code !== "ESRCH") throw error; }
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("responding worker succeeds and shuts down normally", async () => {
  const service = createVoiceService({ pythonExe: process.execPath, workerPath: mockWorker,
    firstRequestTimeoutMs: 1000, requestTimeoutMs: 1000, shutdownTimeoutMs: 500 });
  try {
    const result = await service.synthesize({ genText: "ok", outAudio: "unused.wav", outTiming: "unused.json" });
    assert.equal(result.durationSeconds, 1);
  } finally {
    await service.close();
  }
});

test("timeout also cleans up a spawned worker child", { skip: process.platform !== "win32" }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "voice-tree-test-"));
  const pidFile = path.join(dir, "worker.pid");
  const service = createVoiceService({ pythonExe: process.execPath, workerPath: mockWorker,
    firstRequestTimeoutMs: 1000, shutdownTimeoutMs: 1000 });
  try {
    await assert.rejects(service.synthesize({ genText: "hang-child", outAudio: pidFile,
      outTiming: path.join(dir, "timing.json") }), /timed out/);
    await service.close();
    const pid = Number(fs.readFileSync(pidFile, "utf8"));
    let alive = true;
    for (let i = 0; i < 40 && alive; i++) {
      try { process.kill(pid, 0); }
      catch (error) { if (error.code === "ESRCH") alive = false; else throw error; }
      if (alive) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(alive, false, "a real worker descendant must not be orphaned");
  } finally {
    await service.close();
    if (fs.existsSync(pidFile)) {
      try { process.kill(Number(fs.readFileSync(pidFile, "utf8")), "SIGKILL"); }
      catch (error) { if (error.code !== "ESRCH") throw error; }
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
