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
  return `You are planning a ${count}-day content calendar for a CS/tech-explainer social media account (short vertical videos + swipeable carousel posts). Generate exactly ${count} distinct, specific, interesting topics suitable for a 30-90 second explainer or a 6-10 slide carousel -- real computer science / software engineering concepts, not generic listicle fluff.

Good examples: "why hash tables need good hash functions", "how TCP handshakes actually work", "the CAP theorem in 60 seconds", "why B-trees beat binary trees for databases".

Each topic needs a short "category" tag (e.g. "algorithms", "networking", "databases", "distributed-systems", "security", "web", "systems-design", "data-structures", "devops", "languages").

Cover a genuinely varied mix of categories across the ${count} topics -- don't cluster on one area.${avoidBlock}

Return ONLY a JSON array of exactly ${count} objects, each shaped: {"topic": "...", "category": "..."}. No other text.`;
}

function extractJsonArray(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  return JSON.parse(candidate);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const count = Number(args.count) || 30;
  let avoidTopics = [];
  if (typeof args["avoid-file"] === "string" && fs.existsSync(args["avoid-file"])) {
    try {
      avoidTopics = JSON.parse(fs.readFileSync(args["avoid-file"], "utf-8"));
      if (!Array.isArray(avoidTopics)) avoidTopics = [];
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

  const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";
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
  let raw;
  try {
    const result = await model.generateContent(buildPrompt(count, avoidTopics));
    raw = extractJsonArray(result.response.text());
  } catch (err) {
    process.stderr.write(`Gemini call failed: ${err.message}\n`);
    process.exit(1);
    return;
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    process.stderr.write(`Gemini did not return a usable topic array (got ${Array.isArray(raw) ? raw.length : typeof raw} items)\n`);
    process.exit(1);
    return;
  }
  if (raw.length < count) {
    log(`Warning: requested ${count} topics, Gemini returned ${raw.length}. Using what came back.`);
  }

  const cleaned = raw
    .slice(0, count)
    .map((item) => ({ topic: String((item && item.topic) || "").trim(), category: String((item && item.category) || "uncategorized").trim() }))
    .filter((t) => t.topic.length > 0);

  log(`Returning ${cleaned.length} topics.`);
  process.stdout.write(JSON.stringify(cleaned) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Unhandled error: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});
