#!/usr/bin/env node
"use strict";

/**
 * make-video.js -- the one-click path: topic -> finished, gate-checked video. No human step.
 *
 *   node make-video.js --topic "How database indexes work" --out output/x.mp4 [--rounds 2]
 *
 * 1. generate-video-v3 --topic (Gemini storyboard, validated + repaired, voice, render, master)
 * 2. tools/v3_gates.py on the delivered mp4 (cadence, pace, loudness, frame geometry)
 * 3. if a storyboard gate fails: regenerate with the gate findings fed back (bounded rounds);
 *    audio/render gate failures are hard errors (never shipped silently).
 * stdout: one JSON line {ok, outputPath, gates, rounds}.
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function arg(name, def) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : def;
}
function run(cmd, args, logFile) {
  return new Promise((resolve) => {
    const out = fs.openSync(logFile, "a");
    const c = spawn(cmd, args, { cwd: __dirname, windowsHide: true, stdio: ["ignore", "pipe", out] });
    let stdout = "";
    c.stdout.on("data", (d) => (stdout += d.toString()));
    c.on("close", (code) => {
      fs.closeSync(out);
      resolve({ code, stdout });
    });
  });
}

async function main() {
  const topic = arg("topic");
  const outPath = path.resolve(arg("out", `output/${Date.now()}.mp4`));
  const rounds = Number(arg("rounds", 2));
  if (!topic) {
    process.stderr.write("--topic is required\n");
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const logFile = `${outPath}.log`;
  const runId = "v3-" + path.basename(outPath, ".mp4").replace(/[^a-zA-Z0-9_-]/g, "-");
  let previous = null;
  let problems = null;
  let gates = null;
  for (let r = 0; r <= rounds; r++) {
    const args = ["generate-video-v3.js", "--topic", topic, "--out", outPath, "--run-id", runId, "--reuse-voice", "true"];
    // pass-through options (control panel): voice profile, accent, target length
    ["ref-audio", "ref-text", "accent", "length-seconds", "profile"].forEach((k) => {
      if (arg(k) !== undefined) args.push("--" + k, arg(k));
    });
    if (previous) args.push("--previous", previous, "--problems", problems);
    const gen = await run(process.execPath, args, logFile);
    if (gen.code !== 0) {
      // a storyboard that fails on the REAL voice timing (compile/visual contract) is repairable:
      // feed the compiler's message back to the generator; anything else is a hard failure
      let failure = null;
      try {
        failure = JSON.parse(fs.readFileSync(`${outPath}.metrics.json`, "utf-8")).failure;
      } catch (_) {}
      const sbFile = `${outPath}.storyboard.json`;
      const repairable = failure && failure.stage === "compose" && /not on screen|anchor|scaffold|overflow|content (needs|runs)|unknown|layout audit/.test(failure.message || "");
      if (repairable && fs.existsSync(sbFile) && r < rounds) {
        previous = sbFile;
        problems = `${outPath}.problems.json`;
        fs.writeFileSync(problems, JSON.stringify([`on the real voice timing: ${failure.message}`]));
        continue;
      }
      process.stdout.write(JSON.stringify({ ok: false, stage: "generate", round: r, failure, log: logFile }) + "\n");
      process.exit(1);
    }
    const g = await run("python", ["tools/v3_gates.py", "--video", outPath, "--timeline", `${outPath}.timeline.json`, "--metrics", `${outPath}.metrics.json`], logFile);
    gates = JSON.parse(g.stdout);
    fs.writeFileSync(`${outPath}.gates.json`, JSON.stringify(gates, null, 1));
    if (gates.ok) {
      process.stdout.write(JSON.stringify({ ok: true, outputPath: outPath, rounds: r, gates: gates.gates.filter((x) => x.hard).map((x) => [x.name, x.value]) }) + "\n");
      return;
    }
    if (!gates.repair.every((x) => x === "storyboard") || r === rounds) break;
    // feed the measured failures back to the storyboard generator
    previous = `${outPath}.storyboard.json`;
    problems = `${outPath}.problems.json`;
    const msgs = gates.gates.filter((x) => x.hard && !x.ok).map((x) => `render gate ${x.name} = ${JSON.stringify(x.value)} (band ${JSON.stringify(x.band)}) on the real voice timing; fix the storyboard cadence accordingly`);
    fs.writeFileSync(problems, JSON.stringify(msgs));
  }
  process.stdout.write(JSON.stringify({ ok: false, stage: "gates", outputPath: outPath, repair: gates && gates.repair, failed: gates && gates.gates.filter((x) => x.hard && !x.ok) }) + "\n");
  process.exit(1);
}

main().catch((e) => {
  process.stderr.write(String(e.stack || e) + "\n");
  process.exit(1);
});
