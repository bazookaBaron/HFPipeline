"use strict";

/**
 * 30-day topic calendar. Real Gemini call (via orchestrator/generate-topics.js -- kept out of
 * this dependency-free control-panel package, same shelling-out pattern renderEngine.js and
 * carouselEngine.js already use) produces a batch of distinct CS/tech-explainer topics, one
 * assigned per day starting today. Clicking any topic (server.js's POST /api/topics/:id/run)
 * kicks off BOTH a real cs-explainer video run and a real carousel run for it, through the
 * exact same startPipelineRun()/job/store machinery every other run already uses.
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { newId, atomicWriteFileSync, readJsonSafe } = require("./util");

const TOPICS_FILE = path.join(__dirname, "..", "data", "topics.json");
const ORCHESTRATOR_DIR = path.resolve(__dirname, "..", "..", "orchestrator");
const GENERATE_TOPICS_ENTRY = path.join(ORCHESTRATOR_DIR, "generate-topics.js");
const DEFAULT_COUNT = 30;

function listTopics() {
  return readJsonSafe(TOPICS_FILE, []);
}

function saveTopics(topics) {
  atomicWriteFileSync(TOPICS_FILE, JSON.stringify(topics, null, 2));
}

function getTopic(id) {
  return listTopics().find((t) => t.id === id) || null;
}

function updateTopic(id, patch) {
  const topics = listTopics();
  const idx = topics.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  topics[idx] = { ...topics[idx], ...patch };
  saveTopics(topics);
  return topics[idx];
}

function addDaysIso(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

function runGenerateTopicsCli(count, avoidTopics, log) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(GENERATE_TOPICS_ENTRY)) {
      reject(new Error(`orchestrator/generate-topics.js not found at ${GENERATE_TOPICS_ENTRY}`));
      return;
    }
    const tmpDir = path.join(__dirname, "..", "data");
    fs.mkdirSync(tmpDir, { recursive: true });
    const avoidFile = path.join(tmpDir, "_topics-avoid.json");
    fs.writeFileSync(avoidFile, JSON.stringify(avoidTopics));

    const args = [GENERATE_TOPICS_ENTRY, "--count", String(count), "--avoid-file", avoidFile];
    const child = spawn("node", args, { cwd: ORCHESTRATOR_DIR, windowsHide: true });

    let stdout = "";
    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => {
      String(d)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => log(`[generate-topics] ${line}`));
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`generate-topics.js exited with code ${code}`));
        return;
      }
      const lastLine = stdout.trim().split("\n").filter(Boolean).pop();
      try {
        resolve(JSON.parse(lastLine));
      } catch (e) {
        reject(new Error(`Could not parse generate-topics.js output: ${lastLine}`));
      }
    });
  });
}

/**
 * Calls Gemini for real (via the orchestrator CLI) and returns a fresh `count`-day topic
 * calendar, replacing whatever calendar currently exists. Recently-used topics are passed as
 * avoid-context so Gemini doesn't just repeat them.
 */
function mergeTopicCalendar(existing, raw, count) {
  const preserved = new Map(existing.filter((t) => t.videoRunId || t.carouselRunId || t.status === "done" || t.status === "running")
    .map((t) => [t.day, t]));
  let next = 0;
  return Array.from({ length: count }, (_, i) => {
    const day = i + 1;
    if (preserved.has(day)) return preserved.get(day);
    const item = raw[next++];
    const old = existing.find((t) => t.day === day);
    return {
      id: old?.id || newId("topic"),
      day,
      date: old?.date || addDaysIso(i),
      topic: item.topic,
      category: item.category || "uncategorized",
      status: "pending",
      videoRunId: null,
      carouselRunId: null,
      createdAt: old?.createdAt || new Date().toISOString(),
    };
  });
}

async function generateTopicCalendar({ count = DEFAULT_COUNT, log = () => {} } = {}) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 60) throw new Error("count must be 1-60");
  const existing = listTopics();
  const avoidTopics = existing.map((t) => t.topic).slice(-60);
  const preserved = existing.filter((t) => t.videoRunId || t.carouselRunId || t.status === "done" || t.status === "running");
  const needed = Math.max(0, count - preserved.filter((t) => t.day >= 1 && t.day <= count).length);
  if (!needed) {
    log("All calendar slots have existing work; nothing was replaced.");
    return existing;
  }

  log(`Requesting ${needed} beginner-friendly topics from Gemini...`);
  const raw = await runGenerateTopicsCli(needed, avoidTopics, log);
  const topics = mergeTopicCalendar(existing, raw, count);

  saveTopics(topics);
  log(`Saved ${topics.length} topics to the calendar.`);
  return topics;
}

module.exports = { listTopics, getTopic, updateTopic, mergeTopicCalendar, generateTopicCalendar, TOPICS_FILE };
