#!/usr/bin/env node
"use strict";

/**
 * generate-carousel.js — Piece 2: the orchestrator CLI.
 *
 * Real "topic in -> finished carousel out" flow:
 *   1. Call the real Gemini carousel-content generator (lib/carousel/geminiCarousel.js) for
 *      --topic, with bounded reject-and-repair validation (schema.js/validate.js).
 *   2. Write the resulting { slides: [...] } JSON to <out-dir>/content.json.
 *   3. Run carousel-engine/render.js against that content.json to produce numbered PNGs.
 *   4. Print exactly one final JSON line to stdout on success.
 *
 * Usage:
 *   node generate-carousel.js --topic "..." --accent "#6ea8fe" --handle "@example" \
 *     --run-id <id> --out-dir <dir>
 *
 * All progress/log output goes to stderr (mirrors voice-pipeline/synthesize.py's contract:
 * "last stdout line is the machine-readable result, on success only" — safe for a Node/child
 * process caller to parse without stdout noise corrupting it). On failure: non-zero exit, a
 * clear stderr message, and NO JSON line printed on stdout (no fabricated success).
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const { generateCarouselContent } = require("./lib/carousel/geminiCarousel");

const CAROUSEL_ENGINE_DIR = path.resolve(__dirname, "..", "carousel-engine");

function log(msg) {
  process.stderr.write(`[generate-carousel] ${msg}\n`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function runRender(contentPath, outDir) {
  return new Promise((resolve, reject) => {
    const renderJs = path.join(CAROUSEL_ENGINE_DIR, "render.js");
    if (!fs.existsSync(renderJs)) {
      reject(new Error(`carousel-engine/render.js not found at ${renderJs}`));
      return;
    }
    log(`Running: node render.js ${contentPath} ${outDir}  (cwd=${CAROUSEL_ENGINE_DIR})`);
    const child = spawn(process.execPath, ["render.js", contentPath, outDir], {
      cwd: CAROUSEL_ENGINE_DIR,
      windowsHide: true,
    });

    child.stdout.on("data", (d) => {
      String(d)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => process.stderr.write(`[render.js] ${line}\n`));
    });
    child.stderr.on("data", (d) => {
      String(d)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => process.stderr.write(`[render.js:err] ${line}\n`));
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`carousel-engine/render.js exited with code ${code}`));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const topic = typeof args.topic === "string" ? args.topic.trim() : "";
  const accentColor = typeof args.accent === "string" ? args.accent : undefined;
  const brandHandle = typeof args.handle === "string" ? args.handle : "@example";
  const runId = typeof args["run-id"] === "string" ? args["run-id"] : `run-${Date.now()}`;
  const outDir = typeof args["out-dir"] === "string" ? path.resolve(args["out-dir"]) : path.resolve(process.cwd(), "out", runId);

  if (!topic) {
    process.stderr.write("Error: --topic is required\n");
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  log(`Run ${runId}: topic="${topic}" accent=${accentColor || "(default)"} handle=${brandHandle}`);
  log("Step 1/3: generating carousel content via Gemini...");

  let payload;
  try {
    const result = await generateCarouselContent({ topic, brandHandle, accentColor, log });
    payload = result.payload;
    log(
      `Gemini generation succeeded. ${payload.slides.length} slides, kinds: ${payload.slides.map((s) => s.kind).join(", ")}. ` +
        `Repair attempts used: ${result.attempts}/2.`
    );
  } catch (err) {
    process.stderr.write(`Step 1 failed: ${err.message}\n`);
    process.exit(1);
    return;
  }

  const contentPath = path.join(outDir, "content.json");
  log(`Step 2/3: writing content.json -> ${contentPath}`);
  fs.writeFileSync(contentPath, JSON.stringify(payload, null, 2), "utf8");

  log("Step 3/3: rendering slides via carousel-engine/render.js...");
  try {
    await runRender(contentPath, outDir);
  } catch (err) {
    process.stderr.write(`Step 3 failed: ${err.message}\n`);
    process.exit(1);
    return;
  }

  const images = fs
    .readdirSync(outDir)
    .filter((name) => /\.png$/i.test(name))
    .sort();

  if (images.length !== payload.slides.length) {
    process.stderr.write(
      `Render completed but produced ${images.length} PNG(s), expected ${payload.slides.length}. Not reporting success.\n`
    );
    process.exit(1);
    return;
  }

  const finalResult = {
    ok: true,
    outDir,
    slideCount: payload.slides.length,
    images,
  };
  // Exactly one final JSON line on stdout, on success only.
  process.stdout.write(JSON.stringify(finalResult) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Unhandled error: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});
