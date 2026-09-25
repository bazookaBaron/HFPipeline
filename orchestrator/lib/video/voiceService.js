"use strict";

/** Persistent JSON-lines client for voice-pipeline/tts_worker.py. */

const path = require("node:path");
const { spawn } = require("node:child_process");
const { createInterface } = require("node:readline");

const DEFAULT_PYTHON = "C:\\Repos\\tts-venv\\Scripts\\python.exe";
const WORKER_DIR = path.resolve(__dirname, "..", "..", "..", "voice-pipeline");
const WORKER_PATH = path.join(WORKER_DIR, "tts_worker.py");

function createVoiceService({ log = () => {}, pythonExe = DEFAULT_PYTHON, workerPath = WORKER_PATH } = {}) {
  let child;
  let nextId = 1;
  let closed = false;
  let closing;
  let stderrTail = "";
  const pending = new Map();

  function rejectAll(error) {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  }

  function start() {
    if (child) return;
    if (closed) throw new Error("Voice service is closed");
    child = spawn(pythonExe, [workerPath], { cwd: path.dirname(workerPath), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      let response;
      try { response = JSON.parse(line); }
      catch (error) {
        rejectAll(new Error(`Invalid voice-worker JSON: ${line.slice(0, 200)}`));
        child.kill();
        return;
      }
      const request = pending.get(response.id);
      if (!request) {
        log(`[voice-worker] unexpected response id ${response.id}`);
        return;
      }
      pending.delete(response.id);
      if (response.ok) request.resolve(response.result);
      else request.reject(new Error(response.error || "Voice worker request failed"));
    });
    createInterface({ input: child.stderr }).on("line", (line) => {
      stderrTail = `${stderrTail}\n${line}`.slice(-4000);
      log(`[voice-worker] ${line}`);
    });
    child.on("error", (error) => rejectAll(error));
    child.on("close", (code, signal) => {
      const detail = stderrTail.trim();
      rejectAll(new Error(`Voice worker exited (${code ?? signal})${detail ? `: ${detail}` : ""}`));
      child = null;
    });
  }

  function request(payload) {
    if (closed) return Promise.reject(new Error("Voice service is closed"));
    start();
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(`${JSON.stringify({ id, ...payload })}\n`, (error) => {
        if (error && pending.delete(id)) reject(error);
      });
    });
  }

  // Serialize model work: one shared GPU and an ordered response stream.
  let queue = Promise.resolve();
  function synthesize(opts) {
    if (!opts || !opts.genText || !opts.outAudio || !opts.outTiming) {
      return Promise.reject(new TypeError("genText, outAudio and outTiming are required"));
    }
    const job = queue.then(() => request({ op: "synthesize", ...opts }));
    queue = job.catch(() => {});
    return job;
  }

  async function close() {
    if (closing) return closing;
    closing = (async () => {
      await queue;
      if (!child) { closed = true; return; }
      const current = child;
      const exited = new Promise((resolve) => current.once("close", resolve));
      try { await request({ op: "shutdown" }); }
      finally {
        closed = true;
        current.stdin.end();
        let timer;
        await Promise.race([exited, new Promise((resolve) => {
          timer = setTimeout(() => { current.kill(); resolve(); }, 5000);
        })]);
        clearTimeout(timer);
      }
    })();
    return closing;
  }

  return { synthesize, close };
}

module.exports = { createVoiceService };
