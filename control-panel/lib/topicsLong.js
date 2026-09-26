"use strict";

/**
 * Long-form (16:9) topic calendar: finance deep-dives, 4 videos a week on fixed weekdays.
 * Topics come from a real Gemini call via `orchestrator/generate-topics.js --format long` (same
 * shelling-out pattern as lib/topics.js, which stays the 9:16 shorts calendar and is untouched).
 * Each scheduled item can start a real make-longform run (server.js reuses startPipelineRun
 * "longform"), be marked done / skipped, or be regenerated on its own date.
 *
 * data/topics-long.json      {generatedAt, days, schedule:[{id, date, topic, category, angle,
 *                             entities, region, whyNow, status, runId}]}
 * data/_topics-long-avoid.json  persistent avoid list: every long-form topic ever planned (capped)
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { newId, atomicWriteFileSync, readJsonSafe } = require("./util");

const DATA_DIR = path.join(__dirname, "..", "data");
const TOPICS_LONG_FILE = path.join(DATA_DIR, "topics-long.json");
const AVOID_FILE = path.join(DATA_DIR, "_topics-long-avoid.json");
const ORCHESTRATOR_DIR = path.resolve(__dirname, "..", "..", "orchestrator");
const GENERATE_TOPICS_ENTRY = path.join(ORCHESTRATOR_DIR, "generate-topics.js");
const DEFAULT_DAYS = ["mon", "tue", "thu", "sat"];
const AVOID_CAP = 200;
const STATUSES = ["planned", "running", "done", "skipped", "failed"];

function emptyCalendar() {
  return { generatedAt: null, days: DEFAULT_DAYS, schedule: [] };
}

function loadCalendar() {
  const data = readJsonSafe(TOPICS_LONG_FILE, null);
  if (!data || !Array.isArray(data.schedule)) return emptyCalendar();
  return data;
}

function saveCalendar(cal) {
  cal.schedule.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  atomicWriteFileSync(TOPICS_LONG_FILE, JSON.stringify(cal, null, 2));
  return cal;
}

function getItem(id) {
  return loadCalendar().schedule.find((t) => t.id === id) || null;
}

function updateItem(id, patch) {
  const cal = loadCalendar();
  const idx = cal.schedule.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  cal.schedule[idx] = { ...cal.schedule[idx], ...patch };
  saveCalendar(cal);
  return cal.schedule[idx];
}

function readAvoid() {
  const list = readJsonSafe(AVOID_FILE, []);
  return Array.isArray(list) ? list.filter((t) => typeof t === "string" && t.trim()) : [];
}

function rememberTopics(topics) {
  const merged = [...new Set([...readAvoid(), ...topics.filter(Boolean)])].slice(-AVOID_CAP);
  atomicWriteFileSync(AVOID_FILE, JSON.stringify(merged, null, 2));
}

function localIsoDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeDays(days) {
  const list = (Array.isArray(days) ? days : typeof days === "string" ? days.split(",") : [])
    .map((d) => String(d).trim().toLowerCase().slice(0, 3))
    .filter((d) => ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(d));
  return list.length ? [...new Set(list)] : DEFAULT_DAYS;
}

/** Runs the orchestrator CLI in long mode; resolves to its parsed JSON array. */
function runGenerateLongCli({ count, weeks, days, start, avoidTopics }, log) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(GENERATE_TOPICS_ENTRY)) {
      reject(new Error(`orchestrator/generate-topics.js not found at ${GENERATE_TOPICS_ENTRY}`));
      return;
    }
    fs.mkdirSync(DATA_DIR, { recursive: true });
    // per-call argument file: the persistent avoid list plus whatever this call must also avoid
    const argFile = path.join(DATA_DIR, `.topics-long-avoid.${process.pid}.${Date.now()}.json`);
    fs.writeFileSync(argFile, JSON.stringify(avoidTopics));
    const args = [GENERATE_TOPICS_ENTRY, "--format", "long", "--days", days.join(","), "--start", start, "--avoid-file", argFile];
    if (count) args.push("--count", String(count));
    else args.push("--weeks", String(weeks));
    const child = spawn("node", args, { cwd: ORCHESTRATOR_DIR, windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((line) => log(`[generate-topics] ${line}`)));
    const cleanup = () => fs.rm(argFile, { force: true }, () => {});
    child.on("error", (err) => { cleanup(); reject(err); });
    child.on("close", (code) => {
      cleanup();
      if (code !== 0) {
        reject(new Error(`generate-topics.js --format long exited with code ${code}`));
        return;
      }
      const lastLine = stdout.trim().split("\n").filter(Boolean).pop();
      try {
        const parsed = JSON.parse(lastLine);
        if (!Array.isArray(parsed)) throw new Error("not an array");
        resolve(parsed);
      } catch (e) {
        reject(new Error(`Could not parse generate-topics.js output: ${String(lastLine).slice(0, 200)}`));
      }
    });
  });
}

function toItem(raw, date) {
  return {
    id: newId("lft"),
    date: date || raw.date,
    topic: raw.topic,
    category: raw.category || "uncategorized",
    angle: raw.angle || "",
    entities: Array.isArray(raw.entities) ? raw.entities : [],
    region: raw.region || "",
    whyNow: raw.whyNow || "",
    status: "planned",
    runId: null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * New `weeks`-week calendar from today on the chosen weekdays. Planned/skipped/failed items are
 * replaced; done and running items stay as history. Avoids the persistent long-form avoid list,
 * the current calendar and (inside the CLI) past make-longform outline titles.
 */
async function generateLongCalendar({ weeks = 4, days = DEFAULT_DAYS, start, log = () => {} } = {}) {
  const w = Math.min(12, Math.max(1, Math.round(Number(weeks) || 4)));
  const d = normalizeDays(days);
  const cal = loadCalendar();
  const kept = cal.schedule.filter((t) => t.status === "done" || t.status === "running");
  const avoidTopics = [...new Set([...readAvoid(), ...cal.schedule.map((t) => t.topic)])];
  log(`Requesting a ${w}-week long-form calendar (${w * d.length} topics on ${d.join("/")}) from Gemini...`);
  const raw = await runGenerateLongCli({ weeks: w, days: d, start: start || localIsoDate(), avoidTopics }, log);
  const fresh = raw.filter((r) => r && typeof r.topic === "string" && r.topic.trim()).map((r) => toItem(r));
  rememberTopics(fresh.map((t) => t.topic));
  const next = saveCalendar({ generatedAt: new Date().toISOString(), days: d, schedule: [...kept, ...fresh] });
  log(`Saved ${fresh.length} long-form topics.`);
  return next;
}

/** Replaces one item's topic (same date and slot), avoiding everything else already planned. */
async function regenerateItem(id, { log = () => {} } = {}) {
  const cal = loadCalendar();
  const current = cal.schedule.find((t) => t.id === id);
  if (!current) return null;
  if (current.status === "running") throw Object.assign(new Error("item is running; wait for it to finish"), { statusCode: 409 });
  const avoidTopics = [...new Set([...readAvoid(), ...cal.schedule.map((t) => t.topic)])];
  const raw = await runGenerateLongCli({ count: 1, days: normalizeDays(cal.days), start: current.date, avoidTopics }, log);
  const pick = raw.find((r) => r && typeof r.topic === "string" && r.topic.trim());
  if (!pick) throw new Error("generator returned no usable topic");
  const replacement = { ...toItem(pick, current.date), id: current.id };
  rememberTopics([replacement.topic]);
  return updateItem(id, replacement);
}

module.exports = {
  TOPICS_LONG_FILE, AVOID_FILE, STATUSES, DEFAULT_DAYS,
  loadCalendar, getItem, updateItem, generateLongCalendar, regenerateItem,
};
