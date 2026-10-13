"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { safeReview, uploadYoutubeVideo, uploadYoutubeThumbnail } = require("./publish");
const { mediaFiles } = require("./publishInstagramBrowser");

test("review metadata respects edits and platform limits", () => {
  const record = { metadata: { title: "Original", description: "Original text", tags: ["tech"] } };
  assert.deepEqual(safeReview(record, { title: "New", caption: "Body", hashtags: "#topic" }), { title: "New", description: "Body\n\n#topic", tags: ["tech"] });
  assert.throws(() => safeReview(record, { title: "x".repeat(101) }), /limits/);
});

test("YouTube uploader starts resumable session, uploads bytes, and sends thumbnail", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hf-youtube-upload-"));
  const video = path.join(dir, "clip.mp4");
  const cover = path.join(dir, "cover.png");
  fs.writeFileSync(video, Buffer.from("test bytes"));
  fs.writeFileSync(cover, Buffer.from("fake png"));
  const requests = [];
  const fake = async (url, options) => {
    requests.push({ url, options });
    if (requests.length === 1) return { ok: true, headers: new Headers({ location: "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=test" }) };
    if (requests.length === 2) return { ok: true, json: async () => ({ id: "abc123" }) };
    return { ok: true };
  };
  const record = { assetPath: video, coverPath: cover };
  const id = await uploadYoutubeVideo(record, { title: "Test", description: "Test", tags: [] }, "token", fake);
  await uploadYoutubeThumbnail(record, id, "token", fake);
  assert.equal(id, "abc123");
  assert.equal(JSON.parse(requests[0].options.body).status.privacyStatus, "private");
  assert.equal(requests[1].options.headers["Content-Length"], "10");
  assert.match(requests[2].url, /videoId=abc123/);
});

test("YouTube uploader resumes from an acknowledged partial range", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hf-youtube-resume-"));
  const video = path.join(dir, "clip.mp4");
  fs.writeFileSync(video, Buffer.from("abcdefghij"));
  const requests = [];
  const fake = async (url, options) => {
    requests.push({ url, options });
    if (requests.length === 1) return { ok: true, headers: new Headers({ location: "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=resume" }) };
    if (requests.length === 2) return { status: 308, ok: false, headers: new Headers({ range: "bytes=0-4" }) };
    return { status: 200, ok: true, json: async () => ({ id: "resumed" }) };
  };
  assert.equal(await uploadYoutubeVideo({ assetPath: video }, { title: "X", description: "Y", tags: [] }, "token", fake), "resumed");
  assert.equal(requests[2].options.headers["Content-Range"], "bytes 5-9/10");
});

test("Instagram browser media list uses only numbered slides", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hf-ig-slides-"));
  fs.writeFileSync(path.join(dir, "slide-02-body.png"), "x");
  fs.writeFileSync(path.join(dir, "slide-01-cover.png"), "x");
  fs.writeFileSync(path.join(dir, "unrelated.png"), "x");
  assert.deepEqual(mediaFiles({ assetPath: dir }).map((file) => path.basename(file)), ["slide-01-cover.png", "slide-02-body.png"]);
});
