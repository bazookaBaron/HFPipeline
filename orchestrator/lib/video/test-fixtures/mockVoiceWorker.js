"use strict";

const fs = require("node:fs");
const { createInterface } = require("node:readline");
const { spawn } = require("node:child_process");

createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  if (request.op === "shutdown") {
    process.stdout.write(JSON.stringify({ id: request.id, ok: true, result: {} }) + "\n", () => process.exit(0));
    return;
  }
  if (request.genText === "hang") {
    fs.writeFileSync(request.outAudio, String(process.pid));
    return;
  }
  if (request.genText === "hang-child") {
    const worker = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"],
      { windowsHide: true, stdio: "ignore" });
    process.stderr.write(`[tts_worker] pid=${worker.pid}\n`);
    fs.writeFileSync(request.outAudio, String(worker.pid));
    return;
  }
  process.stdout.write(JSON.stringify({ id: request.id, ok: true, result: { durationSeconds: 1 } }) + "\n");
});
