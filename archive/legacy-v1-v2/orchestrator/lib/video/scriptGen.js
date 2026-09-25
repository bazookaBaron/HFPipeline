"use strict";

/**
 * Piece 2 step 1 (the real Gemini call) -- wraps the already-reconciled
 * scripting-pipeline (src/componentCatalog.ts, promptBuilder.ts, pipeline.ts,
 * types.ts, validation.ts, geminiClient.ts; 32/32 tests passing) rather than
 * re-deriving any of that logic here.
 *
 * scripting-pipeline is an ESM package ("type": "module", compiled to
 * dist/src/*.js). This orchestrator is CommonJS, so we load the compiled
 * output via dynamic import() (pathToFileURL'd so Windows backslash paths
 * resolve correctly under the ESM loader) rather than require(). We do NOT
 * import from scripting-pipeline/src -- only from its build output, per the
 * "don't touch scripting-pipeline/" boundary; `npm run build` there is a
 * read-only compile step, not a source edit.
 */

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const dotenv = require("dotenv");

const SCRIPTING_PIPELINE_DIR = path.resolve(__dirname, "..", "..", "..", "scripting-pipeline");
const DIST_DIR = path.join(SCRIPTING_PIPELINE_DIR, "dist", "src");
const HISTORY_PATH = path.join(SCRIPTING_PIPELINE_DIR, "history.json");

/**
 * Loads GEMINI_API_KEY without ever logging its value. Same lookup order
 * the carousel side's orchestrator/lib/carousel/geminiCarousel.js uses:
 * process.env, then a local orchestrator/.env, then the real, live key at
 * scripting-pipeline/.env.
 */
function loadApiKey(log) {
  if (process.env.GEMINI_API_KEY) {
    log("Using GEMINI_API_KEY already present in the environment.");
    return process.env.GEMINI_API_KEY;
  }

  const localEnv = path.resolve(__dirname, "..", "..", ".env");
  const scriptingEnv = path.join(SCRIPTING_PIPELINE_DIR, ".env");

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

async function importDist() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(
      `scripting-pipeline is not built: ${DIST_DIR} does not exist. Run "npm run build" in scripting-pipeline/ first.`
    );
  }
  const toUrl = (name) => pathToFileURL(path.join(DIST_DIR, name)).href;
  const [pipelineMod, geminiClientMod, historyMod] = await Promise.all([
    import(toUrl("pipeline.js")),
    import(toUrl("geminiClient.js")),
    import(toUrl("history.js")),
  ]);
  return { pipelineMod, geminiClientMod, historyMod };
}

/**
 * Runs the real reject-and-repair Gemini scripting pipeline for a topic +
 * scene plan. Returns the accepted internal Script (scripting-pipeline's
 * types.ts `Script` shape: { topic, topicCategory, scenes: [{ sceneId,
 * componentType, durationSeconds, narration, props, narrationAnchors }] })
 * plus the attempt log for progress reporting.
 *
 * @param {object} opts
 * @param {string} opts.topic
 * @param {{sceneId: string, targetDurationSeconds: number, beat: string}[]} opts.scenePlan
 * @param {(msg: string) => void} opts.log
 */
async function generateVideoScript({ topic, scenePlan, log }) {
  const apiKey = loadApiKey(log);
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY not found. Expected it in orchestrator/.env, scripting-pipeline/.env, or the process environment."
    );
  }

  const { pipelineMod, geminiClientMod, historyMod } = await importDist();

  const generate = geminiClientMod.createGeminiGenerateFn({
    apiKey,
    model: process.env.GEMINI_MODEL,
  });
  const history = new historyMod.ComponentHistory(HISTORY_PATH);

  const input = {
    topic,
    topicCategory: "cs-fundamentals",
    audienceNote:
      "Viewers are developers watching a fast-paced vertical short; assume basic programming literacy.",
    scenes: scenePlan,
  };

  log(`Calling Gemini (scripting-pipeline) for topic: "${topic}" (${scenePlan.length} scene(s) requested)`);

  const { script, attempts } = await pipelineMod.generateScript(input, generate, history);

  log(`Script accepted after ${attempts.length} attempt(s).`);
  attempts.forEach((a) => {
    log(
      `  attempt ${a.attempt}: schemaValid=${a.schemaValid}, structuralIssues=${a.issues.length}` +
        (a.issues.length ? ` -> ${a.issues.map((i) => i.check).join(", ")}` : "")
    );
  });

  return { script, attempts };
}

module.exports = { generateVideoScript };
