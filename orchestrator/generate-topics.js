#!/usr/bin/env node
"use strict";

/**
 * generate-topics.js — real Gemini call producing a batch of distinct CS/tech-explainer
 * topics for a content calendar. Lives in orchestrator/ (not control-panel/, which is
 * intentionally zero-dependency) so it can reuse the @google/generative-ai + dotenv
 * dependencies already installed here for generate-video.js / generate-carousel.js.
 *
 * Usage:
 *   node generate-topics.js --count 30 [--avoid-file <path-to-json-array-of-strings>]
 *
 * Progress goes to stderr. On success, exactly one final JSON line on stdout:
 *   [{"topic": "...", "category": "..."}, ...]
 * On failure: non-zero exit, clear stderr message, no stdout JSON line.
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

function log(msg) {
  process.stderr.write(`[generate-topics] ${msg}\n`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args[key] = true;
    else { args[key] = next; i += 1; }
  }
  return args;
}

function loadApiKey() {
  if (process.env.GEMINI_API_KEY) {
    log("Using GEMINI_API_KEY already present in the environment.");
    return process.env.GEMINI_API_KEY;
  }
  const scriptingEnv = path.resolve(__dirname, "..", "scripting-pipeline", ".env");
  if (fs.existsSync(scriptingEnv)) {
    const parsed = dotenv.parse(fs.readFileSync(scriptingEnv));
    if (parsed.GEMINI_API_KEY) {
      log(`Loaded GEMINI_API_KEY from ${scriptingEnv} (value not logged).`);
      return parsed.GEMINI_API_KEY;
    }
  }
  return null;
}

function buildPrompt(count, avoidTopics) {
  const avoidBlock = avoidTopics.length
    ? `\n\nDo not repeat or closely rephrase any of these already-used topics:\n${avoidTopics.map((t) => `- ${t}`).join("\n")}`
    : "";
  return `Plan ${count} distinct topics for a CS/tech explainer calendar. Each topic becomes a 45–55 second vertical v3 video and may also become a carousel. Return exactly ${count} ideas that can each be explained clearly in that time.

For every topic, identify a concrete question, surprising tension, or tradeoff; a teachable technical mechanism that answers it; and a practical consequence for users, developers, or systems. The topic string should make the question or tension specific enough to guide a script. Prefer a single mechanism over a broad survey, listicle, or vague trend. Mix lenses: a plausible fix that fails under a specific condition; an everyday example that reveals an abstract mechanism; and the engineering choice behind a platform or company. Do not force every topic into a failure/redesign story. Avoid claims of guaranteed virality and precise numerical claims unless established and necessary.

Write each "topic" as a concise, viewer-facing question or tension, usually 6-14 words. Do NOT append a colon and an entire explanation to the title; the video script will explain the mechanism. A viewer should understand the stakes without already knowing three specialist acronyms. Avoid absolute claims such as "never fails", "guarantees", or "without performance loss". Do not assert a company's private implementation or a single cause of complex behaviour as fact unless it is public and well established; phrase uncertain ideas as questions or choose a better-documented mechanism.

Balance the calendar across computer science fundamentals, software engineering, AI mechanisms, platforms/infrastructure, and the technology behind real companies or products. Use "company-tech" only when the topic names an actual company and a publicly documented engineering choice; tools/projects such as Git belong in a technical category. Company-tech topics must not become company news or promotion. Do not let AI or any one company/industry dominate. Vary categories and mechanisms as well as wording.

Use a short category tag such as "algorithms", "networking", "databases", "software-engineering", "ai", "platforms", or "company-tech". Do not copy titles from reference videos.${avoidBlock}

Return ONLY a JSON array of exactly ${count} objects, each shaped: {"topic": "...", "category": "..."}. No other text.`;
}

function cleanTopic(item) {
  if (!item || typeof item.topic !== "string") return null;
  const topic = item.topic.replace(/^\s*(?:\d+[.)]|[-*])\s*/, "").replace(/\s+/g, " ").trim();
  if (!topic) return null;
  const category = typeof item.category === "string" ? item.category.replace(/\s+/g, " ").trim() : "";
  return { topic, category: category || "uncategorized" };
}

const COMMON_WORDS = new Set(["a", "an", "and", "are", "can", "do", "does", "for", "how", "in", "is", "of", "on", "the", "to", "what", "when", "why", "with", "work", "works", "actually", "really"]);

function topicWords(topic) {
  return new Set(topic.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z])[-–—]([a-z])/g, "$1 $2")
    .match(/[a-z0-9]+/g)?.map((word) => word.length > 4 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word)
    .filter((word) => !COMMON_WORDS.has(word)) || []);
}

function isNearDuplicate(a, b) {
  const left = topicWords(a);
  const right = topicWords(b);
  if (!left.size || !right.size) return a.toLowerCase() === b.toLowerCase();
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared >= 2 && shared / Math.min(left.size, right.size) >= 0.8 &&
    shared / Math.max(left.size, right.size) >= 0.6;
}

function appendUnique(raw, accepted, avoidTopics, count) {
  if (!Array.isArray(raw)) throw new Error("Gemini did not return a topic array");
  for (const item of raw) {
    if (accepted.length >= count) break;
    const cleaned = cleanTopic(item);
    if (!cleaned) continue;
    if ([...avoidTopics, ...accepted.map((entry) => entry.topic)].some((topic) => isNearDuplicate(cleaned.topic, topic))) continue;
    accepted.push(cleaned);
  }
}

async function collectTopics(count, avoidTopics, generateBatch, maxAttempts = 3) {
  const accepted = [];
  for (let attempt = 1; attempt <= maxAttempts && accepted.length < count; attempt++) {
    const remaining = count - accepted.length;
    const raw = await generateBatch(remaining, [...avoidTopics, ...accepted.map((entry) => entry.topic)]);
    appendUnique(raw, accepted, avoidTopics, count);
    if (accepted.length < count) log(`Batch ${attempt} yielded ${accepted.length}/${count} unique topics; requesting ${count - accepted.length} more.`);
  }
  if (accepted.length < count) throw new Error(`Only ${accepted.length}/${count} unique topics after ${maxAttempts} batches`);
  return accepted;
}

function extractJsonArray(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  return JSON.parse(candidate);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const count = args.count === undefined ? 30 : Number(args.count);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("--count must be a positive integer");
  let avoidTopics = [];
  if (typeof args["avoid-file"] === "string" && fs.existsSync(args["avoid-file"])) {
    try {
      avoidTopics = JSON.parse(fs.readFileSync(args["avoid-file"], "utf-8"));
      if (!Array.isArray(avoidTopics)) avoidTopics = [];
      avoidTopics = avoidTopics.filter((topic) => typeof topic === "string" && topic.trim()).map((topic) => topic.trim());
    } catch {
      avoidTopics = [];
    }
  }

  const apiKey = loadApiKey();
  if (!apiKey) {
    process.stderr.write("Error: GEMINI_API_KEY not found (expected in scripting-pipeline/.env or the process environment)\n");
    process.exit(1);
    return;
  }

  const modelName = require("./lib/ai/models").modelFor("topics");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 16384,
      // Deliberately no responseSchema -- see orchestrator/lib/carousel/geminiCarousel.js's own
      // comment: a large flat per-item schema empirically made this model satisfice at a 1-item
      // array regardless of prompt wording. Plain JSON mime type + a clear prompt + our own
      // length check is the proven-reliable approach for a flat list like this one.
    },
  });

  log(`Calling Gemini (model=${modelName}) for a ${count}-topic calendar (avoiding ${avoidTopics.length} prior topics)...`);
  let cleaned;
  try {
    cleaned = await collectTopics(count, avoidTopics, async (remaining, excluded) => {
      const result = await model.generateContent(buildPrompt(remaining, excluded));
      return extractJsonArray(result.response.text());
    });
  } catch (err) {
    process.stderr.write(`Topic generation failed: ${err.message}\n`);
    process.exit(1);
    return;
  }

  log(`Returning ${cleaned.length} topics.`);
  process.stdout.write(JSON.stringify(cleaned) + "\n");
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`Unhandled error: ${err && err.stack ? err.stack : err}\n`);
    process.exit(1);
  });
}

module.exports = { buildPrompt, cleanTopic, isNearDuplicate, appendUnique, collectTopics };
