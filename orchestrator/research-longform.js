#!/usr/bin/env node
"use strict";

/**
 * Long-form (16:9) research -> outline -> chapter script.
 *
 *   node research-longform.js --topic "Why Kingfisher Airlines went bankrupt" [--minutes 10] [--out dir] [--force]
 *     [--cache dir] [--from research|outline|script]
 *
 * Writes <out>/dossier.json, outline.json, script.json and script.md. Resumable: an existing
 * artefact is reused unless --force (everything) or --from <stage> (that stage and later).
 * Research is also cached by topic hash under --cache (default output/lf/.cache).
 */

const fs = require("fs");
const path = require("path");
const { loadGeminiRest } = require("./lib/longform/gemini");
const { research } = require("./lib/longform/research");
const { makeOutline } = require("./lib/longform/outline");
const { writeScript, scriptMarkdown } = require("./lib/longform/script");

function args(argv) {
  const a = { minutes: 10 };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === "--topic") a.topic = v();
    else if (k === "--minutes") a.minutes = Number(v());
    else if (k === "--out") a.out = v();
    else if (k === "--cache") a.cache = v();
    else if (k === "--from") a.from = v();
    else if (k === "--force") a.force = true;
    else if (k === "-h" || k === "--help") a.help = true;
    else throw new Error(`unknown argument ${k}`);
  }
  return a;
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2));

async function main() {
  const a = args(process.argv);
  if (a.help || !a.topic) {
    console.log('usage: node research-longform.js --topic "..." [--minutes 10] [--out dir] [--force] [--from research|outline|script] [--cache dir]');
    process.exit(a.help ? 0 : 2);
  }
  if (!(a.minutes >= 2 && a.minutes <= 20)) throw new Error("--minutes must be 2-20");
  const out = path.resolve(a.out || path.join(__dirname, "output", "lf", slug(a.topic)));
  const cacheDir = path.resolve(a.cache || path.join(__dirname, "output", "lf", ".cache"));
  fs.mkdirSync(out, { recursive: true });
  const stages = ["research", "outline", "script"];
  const redoFrom = a.force ? 0 : a.from ? stages.indexOf(a.from) : stages.length;
  if (redoFrom < 0) throw new Error(`--from must be one of ${stages.join(", ")}`);
  const redo = (s) => stages.indexOf(s) >= redoFrom;
  const log = (m) => console.log(`[lf] ${m}`);
  const gemini = loadGeminiRest({ log });
  log(`topic: ${a.topic} | ${a.minutes} min | out ${out} | model ${gemini.model}`);

  const P = { dossier: path.join(out, "dossier.json"), outline: path.join(out, "outline.json"), script: path.join(out, "script.json"), md: path.join(out, "script.md") };

  let dossier;
  if (!redo("research") && fs.existsSync(P.dossier)) { dossier = readJson(P.dossier); log("research: reusing dossier.json"); }
  else {
    dossier = await research(a.topic, { cacheDir, force: redo("research") && (a.force || a.from === "research"), log, gemini });
    writeJson(P.dossier, dossier);
  }
  log(`dossier: ${dossier.facts.length} facts, ${dossier.timeline.length} timeline, ${dossier.entities.length} entities, ${dossier.glossary.length} glossary, ${dossier.sources.length} sources`);

  let outline;
  const outlineStale = fs.existsSync(P.outline) && readJson(P.outline).budget?.minutes !== a.minutes;
  if (!redo("outline") && fs.existsSync(P.outline) && !outlineStale) { outline = readJson(P.outline); log("outline: reusing outline.json"); }
  else {
    outline = await makeOutline(dossier, { minutes: a.minutes, gemini, log });
    writeJson(P.outline, outline);
  }
  log(`outline: "${outline.title}" - ${outline.chapters.length} chapters, budget ${outline.budget.total} words${outline.problems.length ? `, ${outline.problems.length} open problem(s)` : ""}`);

  let script;
  if (!redo("script") && !redo("outline") && fs.existsSync(P.script) && !outlineStale) { script = readJson(P.script); log("script: reusing script.json"); }
  else {
    script = await writeScript(dossier, outline, { gemini, log });
    writeJson(P.script, script);
  }
  fs.writeFileSync(P.md, scriptMarkdown(script, dossier));
  const s = script.stats;
  log(`script: ${s.words} words (~${s.estMinutes} min at ${s.wpm} wpm), max FK ${s.fkMax}, open problems ${s.problems}, repair history ${JSON.stringify(s.repairHistory)}`);
  script.sections.forEach((x) => log(`  ${x.id.padEnd(6)} ${String(x.stats.words).padStart(4)} w  FK ${x.stats.fk.toFixed(1).padStart(4)}  ${x.problems.length ? `${x.problems.length} problem(s)` : "ok"}`));
  log(`wrote ${P.md}`);
  if (s.problems) process.exitCode = 3;
}

main().catch((err) => { console.error(`[lf] failed: ${err.message}`); process.exit(1); });
