"use strict";

/** Persistent JSON-lines client for voice-pipeline/tts_worker.py. */

const path = require("node:path");
const { spawn } = require("node:child_process");
const { createInterface } = require("node:readline");

const DEFAULT_PYTHON = "C:\\Repos\\tts-venv\\Scripts\\python.exe";
const WORKER_DIR = path.resolve(__dirname, "..", "..", "..", "voice-pipeline");
const WORKER_PATH = path.join(WORKER_DIR, "tts_worker.py");

function createVoiceService({ log = () => {}, pythonExe = DEFAULT_PYTHON, workerPath = WORKER_PATH,
  firstRequestTimeoutMs = 180000, requestTimeoutMs = 90000, shutdownTimeoutMs = 5000 } = {}) {
  let child;
  let nextId = 1;
  let synthesisCount = 0;
  let closed = false;
  let closing;
  let termination;
  let stderrTail = "";
  let actualWorkerPid = null;
  const pending = new Map();

  function rejectAll(error) {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    pending.clear();
  }

  function terminateTree(current) {
    if (!current || !current.pid || current.exitCode !== null) return Promise.resolve();
    if (process.platform !== "win32") {
      current.kill("SIGKILL");
      return Promise.resolve();
    }
    // Windows venv python.exe is a launcher with a real Python child. Killing
    // only the launcher leaves that child burning CPU, so target its exact tree.
    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(current.pid), "/T", "/F"],
        { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      let settled = false;
      const fallback = (message) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        log(`[voice-worker] ${message}`);
        current.kill("SIGKILL");
        stopActualWorker().then(resolve);
      };
      const timer = setTimeout(() => {
        killer.kill("SIGKILL");
        fallback("taskkill timed out");
      }, 5000);
      killer.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-500); });
      killer.once("error", (error) => fallback(`taskkill failed: ${error.message}`));
      killer.once("close", (code) => {
        if (code !== 0) return fallback(`taskkill failed (${code}): ${stderr.trim()}`);
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      });
    });
  }

  function stopActualWorker() {
    if (!actualWorkerPid || actualWorkerPid === child?.pid) return Promise.resolve();
    const pid = actualWorkerPid;
    return new Promise((resolve) => {
      const stopper = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        `Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`],
      { windowsHide: true, stdio: "ignore" });
      const timer = setTimeout(() => { stopper.kill("SIGKILL"); resolve(); }, 5000);
      const done = () => { clearTimeout(timer); resolve(); };
      stopper.once("error", done);
      stopper.once("close", done);
    });
  }

  function abortWorker(error) {
    if (closed) return;
    closed = true;
    rejectAll(error);
    if (child && !termination) termination = terminateTree(child);
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
        abortWorker(new Error(`Invalid voice-worker JSON: ${line.slice(0, 200)}`));
        return;
      }
      const request = pending.get(response.id);
      if (!request) {
        log(`[voice-worker] unexpected response id ${response.id}`);
        return;
      }
      pending.delete(response.id);
      clearTimeout(request.timer);
      if (response.ok) request.resolve(response.result);
      else request.reject(new Error(response.error || "Voice worker request failed"));
    });
    createInterface({ input: child.stderr }).on("line", (line) => {
      const pidMatch = /^\[tts_worker\] pid=(\d+)$/.exec(line);
      if (pidMatch) actualWorkerPid = Number(pidMatch[1]);
      stderrTail = `${stderrTail}\n${line}`.slice(-4000);
      log(`[voice-worker] ${line}`);
    });
    child.on("error", (error) => abortWorker(error));
    child.on("close", (code, signal) => {
      const detail = stderrTail.trim();
      rejectAll(new Error(`Voice worker exited (${code ?? signal})${detail ? `: ${detail}` : ""}`));
      child = null;
      closed = true;
    });
  }

  function request(payload, timeoutMs) {
    if (closed) return Promise.reject(new Error("Voice service is closed"));
    start();
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const detail = stderrTail.trim().split("\n").pop() || "no worker output";
        abortWorker(new Error(`Voice worker timed out after ${timeoutMs}ms during ${payload.op}: ${detail}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ id, ...payload })}\n`, (error) => {
        if (error) abortWorker(error);
      });
    });
  }

  // Serialize model work: one shared GPU and an ordered response stream.
  let queue = Promise.resolve();
  function synthesize(opts) {
    if (!opts || !opts.genText || !opts.outAudio || !opts.outTiming) {
      return Promise.reject(new TypeError("genText, outAudio and outTiming are required"));
    }
    const job = queue.then(() => {
      const timeoutMs = synthesisCount++ === 0 ? firstRequestTimeoutMs : requestTimeoutMs;
      return request({ op: "synthesize", ...opts,
        watchdogMs: Math.max(100, timeoutMs - 5000) }, timeoutMs);
    });
    queue = job.catch(() => {});
    return job;
  }

  async function close() {
    if (closing) return closing;
    closing = (async () => {
      await queue;
      if (!child) { closed = true; if (termination) await termination; return; }
      const current = child;
      const exited = new Promise((resolve) => {
        if (current.exitCode !== null || current.signalCode !== null) resolve(true);
        else current.once("close", () => resolve(true));
      });
      if (!closed) {
        try { await request({ op: "shutdown" }, shutdownTimeoutMs); }
        catch (error) { log(`[voice-worker] shutdown: ${error.message}`); }
      }
      closed = true;
      try { current.stdin.end(); } catch (_) { /* worker already exited */ }
      const didExit = await Promise.race([exited, new Promise((resolve) => setTimeout(() => resolve(false), shutdownTimeoutMs))]);
      if (!didExit && !termination) termination = terminateTree(current);
      if (termination) await termination;
    })();
    return closing;
  }

  return { synthesize, close, abort: abortWorker };
}

module.exports = { createVoiceService };
