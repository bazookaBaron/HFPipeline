"use strict";

/**
 * Gemini carousel-content generator — Piece 1's runtime half. Own small wrapper around
 * @google/generative-ai (the same package scripting-pipeline/ uses), built fresh here rather
 * than importing from scripting-pipeline/ per the brief (a parallel agent owns that directory
 * for the video pipeline). Mirrors its real, working pattern
 * (scripting-pipeline/src/geminiClient.ts): `responseMimeType: "application/json"` +
 * `responseSchema`, model id overridable via env var.
 *
 * Implements the bounded reject-and-repair loop: generate -> validate (schema.js/validate.js)
 * -> if invalid and retries remain, send the concrete validation errors back to Gemini in the
 * same chat session and ask for a corrected full replacement -> re-validate. Bounded to
 * MAX_REPAIR_ATTEMPTS (2) repair turns, i.e. up to 3 total generation calls.
 *
 * NEVER logs process.env.GEMINI_API_KEY or any derivative of it.
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const { validateCarousel } = require("./validate");
const { buildInitialPrompt, buildRepairPrompt } = require("./promptBuilder");
const { mapCarousel } = require("./mapContent");

const MAX_REPAIR_ATTEMPTS = 2;

/** Loads GEMINI_API_KEY without ever exposing its value to the caller. The real key lives at
 * scripting-pipeline/.env (confirmed live against the real API per the task brief); we read it
 * read-only via dotenv rather than duplicating/copying the secret into this directory. Also
 * honors a local orchestrator/.env or an already-set process.env.GEMINI_API_KEY, in that order
 * of preference, for flexibility (e.g. CI providing it directly). */
function loadApiKey(log) {
  if (process.env.GEMINI_API_KEY) {
    log("Using GEMINI_API_KEY already present in the environment.");
    return process.env.GEMINI_API_KEY;
  }

  const localEnv = path.resolve(__dirname, "..", "..", ".env");
  const scriptingEnv = path.resolve(__dirname, "..", "..", "..", "scripting-pipeline", ".env");

  for (const envPath of [localEnv, scriptingEnv]) {
    if (fs.existsSync(envPath)) {
      const parsed = dotenv.parse(fs.readFileSync(envPath));
      if (parsed.GEMINI_API_KEY) {
        log(`Loaded GEMINI_API_KEY from ${envPath} (value not logged).`);
        return parsed.GEMINI_API_KEY;
      }
    }
  }
  return null;
}

/**
 * @param {object} opts
 * @param {string} opts.topic
 * @param {string} [opts.brandHandle]
 * @param {string} [opts.accentColor]
 * @param {(msg: string) => void} [opts.log] progress logger (defaults to console.error so
 *   stdout stays reserved for the final machine-readable result).
 * @returns {Promise<{ payload: object, raw: object, attempts: number, repairLog: Array<{attempt:number, errors:string[]}> }>}
 */
async function generateCarouselContent({ topic, brandHandle, accentColor, log = () => {} }) {
  if (!topic || !topic.trim()) throw new Error("topic is required");

  const apiKey = loadApiKey(log);
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY not found. Expected it in orchestrator/.env, scripting-pipeline/.env, or the process environment."
    );
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      // Deliberately NOT passing `responseSchema` here. Real testing proved this schema
      // (CAROUSEL_RESPONSE_SCHEMA in schema.js -- ~25 flat optional properties per slide item,
      // to cover all 10 slide kinds in one non-polymorphic shape) causes gemini-3.6-flash's
      // constrained decoding to satisfice at a 1-item array every single time, regardless of
      // prompt wording asking for 6-10 (or an exact count) -- confirmed by direct A/B test:
      // identical prompt, only difference is responseSchema presence, 1 slide vs. a correct
      // 8-slide response. `minItems`/`maxItems` on the schema also isn't supported (400 Bad
      // Request). Relying on responseMimeType + strong prompt instructions + the existing
      // WireCarouselSchema (zod) shape check plus semantic validation below as the real
      // reject-and-repair safety net -- which is exactly what this loop already does.
      maxOutputTokens: 32768,
    },
  });

  log(`Calling Gemini (model=${modelName}) for topic: "${topic}"`);
  const chat = model.startChat({ history: [] });

  /** Parses a Gemini response as JSON; on failure, returns null instead of throwing, so a
   * truncated/malformed response becomes a retryable validation issue like any other, rather
   * than an uncaught crash (this is the exact failure real testing hit before this fix). */
  function tryParse(result) {
    const text = result.response.text();
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (err) {
      return { ok: false, error: err, length: text.length };
    }
  }

  const initialPrompt = buildInitialPrompt({ topic, brandHandle: brandHandle || "@example" });
  let result = await chat.sendMessage(initialPrompt);
  let parsed = tryParse(result);

  const repairLog = [];
  let attempt = 0;
  let validation = parsed.ok
    ? validateCarousel(parsed.value)
    : { ok: false, errors: [`Response was not valid JSON (${parsed.error.message}, ${parsed.length} chars received) -- likely truncated. Reply with ONLY the complete, valid JSON object, no partial output.`] };
  let raw = parsed.ok ? parsed.value : null;

  while (!validation.ok && attempt < MAX_REPAIR_ATTEMPTS) {
    attempt += 1;
    log(`Validation failed (attempt ${attempt}/${MAX_REPAIR_ATTEMPTS} repair): ${validation.errors.length} issue(s):`);
    validation.errors.forEach((e) => log(`  - ${e}`));
    repairLog.push({ attempt, errors: validation.errors.slice() });

    const repairPrompt = buildRepairPrompt(validation.errors);
    result = await chat.sendMessage(repairPrompt);
    parsed = tryParse(result);
    if (!parsed.ok) {
      validation = { ok: false, errors: [`Response was not valid JSON (${parsed.error.message}, ${parsed.length} chars received) -- likely truncated. Reply with ONLY the complete, valid JSON object, no partial output.`] };
      raw = null;
      continue;
    }
    raw = parsed.value;
    validation = validateCarousel(raw);
  }

  if (!validation.ok) {
    const detail = validation.errors.map((e) => `  - ${e}`).join("\n");
    throw new Error(
      `Carousel content failed validation after ${attempt} repair attempt(s). Remaining issues:\n${detail}`
    );
  }

  log(`Validation passed after ${attempt} repair attempt(s).`);
  const payload = mapCarousel(raw, { brandHandle, accentColor });
  return { payload, raw, attempts: attempt, repairLog };
}

module.exports = { generateCarouselContent, MAX_REPAIR_ATTEMPTS };
