"use strict";

/**
 * Simple JSON-file-backed run history store. No database — a single JSON
 * array on disk, rewritten atomically on every mutation. Good enough for a
 * local single-operator control panel; not meant to survive concurrent
 * writers.
 */

const path = require("path");
const { atomicWriteFileSync, readJsonSafe } = require("./util");

const DATA_DIR = path.join(__dirname, "..", "data");
const RUNS_FILE = path.join(DATA_DIR, "runs.json");

let cache = null;

function load() {
  if (cache) return cache;
  cache = readJsonSafe(RUNS_FILE, []);
  if (!Array.isArray(cache)) cache = [];
  return cache;
}

function persist() {
  atomicWriteFileSync(RUNS_FILE, JSON.stringify(cache, null, 2));
}

function listRuns() {
  return [...load()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

function getRun(id) {
  return load().find((r) => r.id === id) || null;
}

function createRun(run) {
  const runs = load();
  runs.push(run);
  persist();
  return run;
}

function updateRun(id, patch) {
  const runs = load();
  const idx = runs.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  runs[idx] = { ...runs[idx], ...patch };
  persist();
  return runs[idx];
}

module.exports = { listRuns, getRun, createRun, updateRun, RUNS_FILE, DATA_DIR };
