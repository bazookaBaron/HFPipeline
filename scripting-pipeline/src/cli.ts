import "dotenv/config";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
import { generateScript, ScriptGenerationError } from "./pipeline.js";
import { createGeminiGenerateFn } from "./geminiClient.js";
import { ComponentHistory } from "./history.js";
import { NARRATIVE_ARC_VALIDATION_CONFIG } from "./types.js";
import { planArcScenes } from "./arcScenePlanner.js";
import type { GenerationInput } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = join(__dirname, "..", "history.json");

function parseArgs(): { topic: string; topicCategory: string; lengthSeconds: number } {
  const args = process.argv.slice(2);
  const topicIdx = args.indexOf("--topic");
  const categoryIdx = args.indexOf("--category");
  const lengthIdx = args.indexOf("--length-seconds");
  const topic = topicIdx >= 0 ? args[topicIdx + 1] : undefined;
  const topicCategory = categoryIdx >= 0 ? args[categoryIdx + 1] : "cs-fundamentals";
  const lengthSeconds = lengthIdx >= 0 ? Number(args[lengthIdx + 1]) : 120;
  if (!topic) {
    console.error(
      'Usage: npm run generate -- --topic "How DNS resolution works" [--category cs-fundamentals] [--length-seconds 120]'
    );
    process.exit(1);
  }
  return { topic, topicCategory: topicCategory ?? "cs-fundamentals", lengthSeconds: lengthSeconds || 120 };
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log(
      "GEMINI_API_KEY is not set in the environment (checked process.env and .env). " +
        "No real Gemini call will be made. Set GEMINI_API_KEY and re-run `npm run generate -- --topic \"...\"` " +
        "to exercise the real API + reject-and-repair loop end to end. " +
        "In the meantime, `npm test` exercises the full validation/reject-repair logic against fixtures."
    );
    process.exit(0);
  }

  const { topic, topicCategory, lengthSeconds } = parseArgs();

  const scenes = planArcScenes(lengthSeconds);

  const input: GenerationInput = {
    topic,
    topicCategory,
    audienceNote: "Viewers are developers watching a fast-paced vertical short; assume basic programming literacy.",
    scenes,
  };

  const generate = createGeminiGenerateFn({
    apiKey,
    model: process.env.GEMINI_MODEL,
  });
  const history = new ComponentHistory(HISTORY_PATH);

  console.log(
    `Generating script for topic: "${topic}" (category: ${topicCategory}, ${scenes.length} scenes, ` +
      `~${lengthSeconds}s target, narrative-arc validation)`
  );

  try {
    const { script, attempts } = await generateScript(input, generate, history, NARRATIVE_ARC_VALIDATION_CONFIG);
    console.log(`Succeeded after ${attempts.length} attempt(s).`);
    attempts.forEach((a) => {
      console.log(
        `  attempt ${a.attempt}: schemaValid=${a.schemaValid}, structuralIssues=${a.issues.length}` +
          (a.issues.length ? ` -> ${a.issues.map((i) => i.check).join(", ")}` : "")
      );
    });

    const outDir = join(__dirname, "..", "output");
    const outPath = join(outDir, `${topicCategory}-${Date.now()}.json`);
    try {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(outPath, JSON.stringify(script, null, 2) + "\n", "utf-8");
      console.log(`Wrote accepted script to ${outPath}`);
    } catch (e) {
      console.warn(`Could not write output file: ${(e as Error).message}`);
    }

    console.log(JSON.stringify(script, null, 2));
  } catch (err) {
    if (err instanceof ScriptGenerationError) {
      console.error(err.message);
      console.error(`\nFull attempt log:\n${JSON.stringify(err.attempts, null, 2)}`);
      process.exit(1);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
