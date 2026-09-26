"use strict";
// Minimal Gemini REST client for the resolver: JSON-mode text (optionally with images)
// and image generation. Key loading follows loadGemini() in lib/video/v3/storyboardGen.js.

const fs = require("fs");
const path = require("path");

const API = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image"; // verified with the key 2026-09-26 (1376x768 at 16:9)
const { modelFor, recordUsage } = require("../ai/models");

function readEnv() {
  const envPath = path.join(__dirname, "..", "..", "..", "scripting-pipeline", ".env");
  const env = {};
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, "utf-8").split(/\r?\n/).forEach((l) => {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    });
  }
  return env;
}

function extractJson(text) {
  const t = String(text || "").trim();
  try {
    return JSON.parse(t);
  } catch (_) {
    const m = t.match(/[\[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]);
    throw new Error(`model returned non-JSON: ${t.slice(0, 120)}`);
  }
}

/**
 * @param {{apiKey?: string, model?: string, imageModel?: string, fetch?: Function, log?: Function}} [opts]
 * @returns {{json: (prompt: string, o?: {images?: {mime: string, data: Buffer}[], temperature?: number}) => Promise<any>,
 *           image: (prompt: string, o?: {aspectRatio?: string}) => Promise<{mime: string, data: Buffer}>, model: string, imageModel: string}}
 */
function createGemini(opts = {}) {
  const env = readEnv();
  const apiKey = opts.apiKey || process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set (process env or scripting-pipeline/.env)");
  // task -> model tier (lib/ai/models.js): keywords and vetting run on the lite tier
  const pick = (task) => opts.model || modelFor(task);
  const model = pick("media.queries");
  const imageModel = opts.imageModel || modelFor("media.illustration") || DEFAULT_IMAGE_MODEL;
  const fetchImpl = opts.fetch || globalThis.fetch;
  const log = opts.log || (() => {});

  async function call(m, body, task) {
    let delay = 2000;
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(`${API}/${m}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
      });
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        log(`  gemini ${res.status}: retry in ${delay} ms`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(`gemini ${m} ${res.status}: ${(data.error && data.error.message) || "error"}`);
      recordUsage({ task, model: m, usage: data.usageMetadata });
      return data;
    }
  }

  // JSON mode occasionally returns a malformed document: retry once before giving up
  async function json(prompt, o = {}) {
    try {
      return await jsonOnce(prompt, o);
    } catch (err) {
      if (!/non-JSON|JSON at position|Unexpected token|Expected/.test(err.message)) throw err;
      log(`  gemini: bad JSON (${err.message.slice(0, 60)}); retrying once`);
      return jsonOnce(prompt, o);
    }
  }

  async function jsonOnce(prompt, o = {}) {
    const parts = [{ text: prompt }];
    for (const img of o.images || []) {
      if (img.label) parts.push({ text: img.label });
      parts.push({ inlineData: { mimeType: img.mime || "image/jpeg", data: Buffer.from(img.data).toString("base64") } });
    }
    const task = o.task || (o.images && o.images.length ? "media.vision" : "media.queries");
    const data = await call(o.model || pick(task), {
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: o.temperature == null ? 0 : o.temperature },
    }, task);
    const text = ((data.candidates || [])[0]?.content?.parts || []).map((p) => p.text || "").join("");
    return extractJson(text);
  }

  async function image(prompt, o = {}) {
    const data = await call(o.model || imageModel, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: o.aspectRatio || "16:9" } },
    }, "media.illustration");
    for (const p of (data.candidates || [])[0]?.content?.parts || []) {
      if (p.inlineData && p.inlineData.data) return { mime: p.inlineData.mimeType, data: Buffer.from(p.inlineData.data, "base64") };
    }
    throw new Error("image model returned no image");
  }

  return { json, image, model, imageModel };
}

module.exports = { createGemini, extractJson, DEFAULT_IMAGE_MODEL };
