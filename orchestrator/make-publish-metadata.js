#!/usr/bin/env node
"use strict";

// One bounded metadata call, grounded in the already-rendered script/carousel.
// stdout is a single JSON object; errors go to stderr for the control panel.
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { modelFor, readEnv } = require("./lib/ai/models");

function argsOf(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) out[argv[i]?.slice(2)] = argv[i + 1];
  return out;
}

function sourceText(source) {
  const data = JSON.parse(fs.readFileSync(source, "utf8"));
  const lines = Array.isArray(data.sentences) ? data.sentences.map((s) => s.text) :
    Array.isArray(data.slides) ? data.slides.map((s) => [s.title, s.subtitle].filter(Boolean).join(". ")) : [];
  if (!lines.length) throw new Error("No script/slide text found for publishing metadata");
  return lines.join(" ").slice(0, 14000);
}

function validateMetadata(raw, platform) {
  const title = String(raw.title || "").trim();
  const description = String(raw.description || "").trim();
  const tags = Array.isArray(raw.tags) ? raw.tags.map((x) => String(x).trim().replace(/^#/, "")).filter(Boolean) : [];
  if (!title || title.length > 100 || !description || description.length > 2200 || tags.length < 3 || tags.length > 15) {
    throw new Error("Generated publishing metadata failed length/required-field validation");
  }
  if (/@example|placeholder|lorem ipsum/i.test(`${title} ${description} ${tags.join(" ")}`)) {
    throw new Error("Generated publishing metadata contains a placeholder");
  }
  return { platform, title, description, tags, thumbnailText: String(raw.thumbnailText || title).trim().slice(0, 60) };
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  if (!["youtube", "instagram"].includes(args.platform) || !args.source || !args.topic) {
    throw new Error("Usage: --platform youtube|instagram --source storyboard-or-carousel.json --topic TITLE");
  }
  const script = sourceText(args.source);
  const apiKey = process.env.GEMINI_API_KEY || readEnv().GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required to generate publishing metadata");
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: modelFor("longform.metadata"),
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: 1200 },
  });
  const prompt = `Create accurate ${args.platform} publishing copy for this already-rendered explainer. Use ONLY facts in the source text; no invented numbers or claims. Return JSON with keys title, description, tags (array of 3-15 plain words/short phrases), thumbnailText (2-6 words). Title <= 100 characters, description <= 2200. The title should be understandable by a curious beginner, not a jargon stack. Do not mention unverified sources or claim the video proves more than it says. Topic: ${args.topic}\nSource transcript/slide text: ${script}`;
  const response = await model.generateContent(prompt);
  const metadata = validateMetadata(JSON.parse(response.response.text()), args.platform);
  process.stdout.write(JSON.stringify(metadata) + "\n");
}

if (require.main === module) main().catch((err) => { process.stderr.write(`${err.message}\n`); process.exitCode = 1; });
module.exports = { sourceText, validateMetadata };
