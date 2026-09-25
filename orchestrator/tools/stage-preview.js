#!/usr/bin/env node
"use strict";

/**
 * Stage preview: compile a stage spec (+ optional caption words) into a root composition and
 * snapshot it at given times, or run `hyperframes check` on it. No voice, no render.
 *
 *   node tools/stage-preview.js --spec fx.json --out dir --at 1,2.5 [--check] [--words w.json]
 *
 * spec file: { duration, profile?, accent?, spec: {scaffolds, events, mascot}, words?: [{text,start,end}] }
 */

const fs = require("fs");
const path = require("path");
const { buildStageComposition } = require("../lib/video/v3/composeStage");
const { checkComposition, snapshotComposition, VIDEO_ENGINE_DIR } = require("../lib/video/hyperframesCli");

function arg(name, def) {
  const i = process.argv.indexOf("--" + name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}

async function main() {
  const specPath = path.resolve(arg("spec"));
  const outDir = path.resolve(arg("out", path.join(path.dirname(specPath), "preview")));
  const fx = JSON.parse(fs.readFileSync(specPath, "utf-8"));
  const runId = "preview-" + path.basename(specPath, ".json").replace(/[^a-zA-Z0-9_-]/g, "-");
  const words = arg("words") ? JSON.parse(fs.readFileSync(path.resolve(arg("words")), "utf-8")) : fx.words || [];
  const html = buildStageComposition({ runId, totalDuration: fx.duration, spec: fx.spec, words, profile: fx.profile || "DH", accent: fx.accent || "#4497ff", captionsOn: words.length > 0, captionSkin: arg("caption-skin") || fx.captionSkin });
  const comp = path.join(VIDEO_ENGINE_DIR, "generated", runId + ".html");
  fs.mkdirSync(path.dirname(comp), { recursive: true });
  fs.writeFileSync(comp, html, "utf-8");
  const log = (m) => process.stderr.write(m + "\n");
  if (arg("check")) {
    const r = await checkComposition(comp, log);
    const res = r.result || {};
    const summary = Object.fromEntries(["lint", "runtime", "layout", "motion", "contrast"].map((k) => [k, res[k] ? res[k].errorCount : null]));
    console.log(JSON.stringify({ ok: res.ok, summary }, null, 1));
    if (!res.ok) fs.writeFileSync(path.join(outDir + "-check.json"), JSON.stringify(res, null, 1));
  }
  if (arg("at")) {
    const times = String(arg("at")).split(",").map(Number);
    const r = await snapshotComposition(comp, times, outDir, log);
    console.log(JSON.stringify({ code: r.code, files: r.files }, null, 1));
  }
}

main().catch((e) => {
  console.error(e.stack || e);
  process.exit(1);
});
