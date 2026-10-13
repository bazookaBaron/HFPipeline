"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { inputFor, assetVersion, renderCover } = require("./publishPackage");

test("publish preparation rejects unfinished and incompatible assets", () => {
  assert.throws(() => inputFor({ status: "failed", result: { path: "x" } }, "instagram"), /Only completed/);
  assert.throws(() => inputFor({ status: "succeeded", result: { type: "image-set", path: "x" } }, "youtube"), /Only videos/);
});

test("carousel asset version ignores generated publish subfolders", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hf-publish-version-"));
  const source = path.join(dir, "content.json");
  fs.writeFileSync(source, "{}");
  fs.writeFileSync(path.join(dir, "slide-01-cover.png"), "first");
  const input = { asset: dir, source, kind: "image-set" };
  const before = assetVersion(input);
  fs.mkdirSync(path.join(dir, "publish", "instagram"), { recursive: true });
  assert.equal(assetVersion(input), before);
  fs.writeFileSync(path.join(dir, "slide-01-cover.png"), "changed slide");
  assert.notEqual(assetVersion(input), before);
});

test("cover generator produces platform-specific dimensions", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hf-publish-cover-"));
  const asset = path.join(dir, "sample.mp4");
  const made = spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=540x960:rate=2:duration=4", "-c:v", "mpeg4", "-y", asset], { timeout: 20000 });
  assert.equal(made.status, 0);
  const metadata = { title: "Why websites slow down when too many people visit", thumbnailText: "TOO MANY VISITORS" };
  for (const [platform, expected] of [["youtube", [1280, 720]], ["instagram", [1080, 1920]]]) {
    const { file } = await renderCover(metadata, platform, dir, asset);
    const png = fs.readFileSync(file);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], expected);
    console.log(`cover sample: ${file}`);
  }
});
