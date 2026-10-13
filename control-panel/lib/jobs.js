"use strict";

/**
 * In-memory job-state registry + SSE fan-out. This is the "job-state object
 * that SSE polls" pattern from the old script-to-video-pipeline control
 * panel (src/pipeline/ui.py -> OperatorService), adapted to push real
 * Server-Sent Events instead of the client polling a GET endpoint.
 *
 * Each job holds a capped ring buffer of log lines so a browser tab that
 * connects after the job already produced output still gets the backlog,
 * plus a set of currently-connected SSE response streams to push new lines
 * to live.
 */

const MAX_LOG_LINES = 5000;

/** @type {Map<string, object>} */
const jobs = new Map();
let statusListener = null;

function onStatusChange(listener) {
  statusListener = listener;
}

function createJob(id, meta) {
  const job = {
    id,
    status: "queued", // queued -> running -> succeeded | failed
    startedAt: null,
    endedAt: null,
    logs: [],
    subscribers: new Set(),
    result: null,
    error: null,
    ...meta,
  };
  jobs.set(id, job);
  return job;
}

function getJob(id) {
  return jobs.get(id) || null;
}

function appendLog(id, stream, line) {
  const job = jobs.get(id);
  if (!job) return;
  const entry = { t: Date.now(), stream, line };
  job.logs.push(entry);
  if (job.logs.length > MAX_LOG_LINES) job.logs.shift();
  broadcast(job, "log", entry);
}

function setStatus(id, status, extra) {
  const job = jobs.get(id);
  if (!job) return;
  job.status = status;
  const TERMINAL = new Set(["succeeded", "failed", "stubbed"]);
  if (status === "running" && !job.startedAt) job.startedAt = Date.now();
  if (TERMINAL.has(status)) job.endedAt = Date.now();
  Object.assign(job, extra || {});
  if (statusListener) statusListener(job);
  broadcast(job, "status", { status, ...(extra || {}) });
  if (TERMINAL.has(status)) {
    // Give subscribers a beat to receive the final event, then close politely.
    setTimeout(() => {
      for (const res of job.subscribers) {
        try {
          res.end();
        } catch (_) {
          /* already closed */
        }
      }
      job.subscribers.clear();
    }, 250);
  }
}

function broadcast(job, event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of job.subscribers) {
    try {
      res.write(payload);
    } catch (_) {
      job.subscribers.delete(res);
    }
  }
}

/** Attach an HTTP response as an SSE subscriber; replays backlog immediately. */
function subscribe(id, res) {
  const job = jobs.get(id);
  if (!job) return false;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`retry: 1000\n\n`);
  for (const entry of job.logs) {
    res.write(`event: log\ndata: ${JSON.stringify(entry)}\n\n`);
  }
  res.write(`event: status\ndata: ${JSON.stringify({ status: job.status, result: job.result, error: job.error })}\n\n`);
  if (["succeeded", "failed", "stubbed"].includes(job.status)) {
    res.end();
    return true;
  }
  job.subscribers.add(res);
  res.on("close", () => job.subscribers.delete(res));
  return true;
}

module.exports = { createJob, getJob, appendLog, setStatus, subscribe, onStatusChange };
