"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { masterVideo } = require("./audioMaster");

test("masters a real MP4 and applies matching audio/video speed", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "audio-master-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const inputPath = path.join(dir, "input.mp4");
  const outputPath = path.join(dir, "output.mp4");
  const created = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=black:s=160x90:r=10:d=4",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=16000:duration=4",
    "-filter_complex", "[1:a]volume=0.05[a]", "-map", "0:v", "-map", "[a]",
    "-shortest", inputPath], { encoding: "utf8" });
  assert.equal(created.status, 0, created.stderr);
  const result = await masterVideo({ inputPath, outputPath, speed: 2 });
  assert.equal(result.code, 0);
  assert.ok(Math.abs(result.stats.integratedLufs + 17) < 1.5, JSON.stringify(result.stats));
  assert.ok(result.stats.loudnessRangeLu <= 2);
  assert.ok(result.stats.truePeakDbtp <= -1);
  assert.ok(result.stats.silenceBelowMinus60Pct >= 0);
  const probed = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", outputPath], { encoding: "utf8" });
  assert.equal(probed.status, 0, probed.stderr);
  assert.ok(Number(probed.stdout) > 1.8 && Number(probed.stdout) < 2.3, probed.stdout);
});
