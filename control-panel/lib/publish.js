"use strict";

const fs = require("fs");
const path = require("path");
const { atomicWriteFileSync } = require("./util");
const oauthYoutube = require("./oauthYoutube");
const { inputFor, assetVersion } = require("./publishPackage");

function preparedFor(run, platform) {
  const input = inputFor(run, platform);
  const file = path.join(input.outputDir, "package.json");
  if (!fs.existsSync(file)) throw Object.assign(new Error(`Prepare the ${platform} post first`), { statusCode: 409 });
  const record = JSON.parse(fs.readFileSync(file, "utf8"));
  if (record.runId !== run.id || record.platform !== platform || record.assetPath !== input.asset || !fs.existsSync(record.coverPath)) throw Object.assign(new Error("Prepared package does not match this run"), { statusCode: 409 });
  if (record.assetVersion !== assetVersion(input)) throw Object.assign(new Error("The rendered asset changed after preparation; prepare it again before publishing"), { statusCode: 409 });
  return { record, file, input };
}

function safeReview(record, review) {
  const title = String(review?.title || record.metadata.title || "").trim();
  const description = [String(review?.caption || record.metadata.description || "").trim(), String(review?.hashtags || "").trim()].filter(Boolean).join("\n\n");
  if (!title || title.length > 100 || !description || description.length > 5000) throw Object.assign(new Error("Review title/description is missing or exceeds YouTube limits"), { statusCode: 400 });
  return { title, description, tags: record.metadata.tags || [] };
}

async function googleError(response, stage) {
  const body = await response.text();
  const err = new Error(`YouTube ${stage} failed (${response.status}): ${body.slice(0, 350)}`);
  err.statusCode = 502;
  throw err;
}

async function uploadYoutubeVideo(record, metadata, token, request = fetch) {
  const size = fs.statSync(record.assetPath).size;
  const body = { snippet: { ...metadata, categoryId: "28" }, status: { privacyStatus: "private", selfDeclaredMadeForKids: false } };
  const start = await request("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Length": String(size), "X-Upload-Content-Type": "video/mp4" }, body: JSON.stringify(body) });
  if (!start.ok) await googleError(start, "session start");
  const uploadUrl = start.headers.get("location");
  if (!uploadUrl || !uploadUrl.startsWith("https://www.googleapis.com/")) throw new Error("YouTube did not return a valid upload session");
  let offset = 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    const result = await request(uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "video/mp4", "Content-Length": String(size - offset), "Content-Range": `bytes ${offset}-${size - 1}/${size}` }, body: fs.createReadStream(record.assetPath, { start: offset }), duplex: "half" });
    if (result.status === 308) {
      const range = result.headers.get("range");
      const match = /^bytes=0-(\d+)$/.exec(range || "");
      const next = match ? Number(match[1]) + 1 : 0;
      if (next <= offset || next >= size) throw new Error("YouTube resumable upload made no progress; check the channel before retrying");
      offset = next;
      continue;
    }
    if (!result.ok) await googleError(result, "video upload");
    const uploaded = await result.json();
    if (!uploaded.id) throw new Error("YouTube upload response did not include a video ID; check the channel before retrying");
    return uploaded.id;
  }
  throw new Error("YouTube resumable upload exceeded the progress limit; check the channel before retrying");
}

async function uploadYoutubeThumbnail(record, videoId, token, request = fetch) {
  const buffer = fs.readFileSync(record.coverPath);
  const result = await request(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/png", "Content-Length": String(buffer.length) }, body: buffer });
  if (!result.ok) await googleError(result, "thumbnail upload");
}

async function publishYoutube(run, review, request = fetch) {
  const { record, file } = preparedFor(run, "youtube");
  if (record.publication?.state === "complete") return record.publication;
  if (record.publication?.state === "uploading-unknown") throw Object.assign(new Error("Previous upload outcome is unknown; check YouTube Studio before retrying to avoid duplicates"), { statusCode: 409 });
  const metadata = safeReview(record, review);
  const token = await oauthYoutube.accessToken();
  if (!record.publication?.videoId) {
    record.publication = { state: "uploading-unknown", startedAt: new Date().toISOString() };
    atomicWriteFileSync(file, JSON.stringify(record, null, 2));
    const videoId = await uploadYoutubeVideo(record, metadata, token, request);
    record.publication = { state: "video-uploaded", videoId, url: `https://www.youtube.com/watch?v=${videoId}`, privacy: "private", thumbnailDone: false, uploadedAt: new Date().toISOString() };
    atomicWriteFileSync(file, JSON.stringify(record, null, 2));
  }
  // The user requested the video itself with its description/tags, without a custom thumbnail.
  record.publication = { ...record.publication, state: "complete", thumbnailDone: false };
  atomicWriteFileSync(file, JSON.stringify(record, null, 2));
  return record.publication;
}

function rearmInstagram(run) {
  const { record, file } = preparedFor(run, "instagram");
  if (record.publication?.state !== "share-unknown") throw Object.assign(new Error("Only an uncertain Instagram share can be re-armed"), { statusCode: 409 });
  record.publication = null;
  atomicWriteFileSync(file, JSON.stringify(record, null, 2));
  return { rearmed: true };
}

function instagramPublishStatus(run) {
  const { record } = preparedFor(run, "instagram");
  return { stage: record.publishAttempt?.stage || "prepared", updatedAt: record.publishAttempt?.updatedAt || null, publication: record.publication || null };
}

async function publishInstagram(run, review, expectedAccount) {
  const { record, file } = preparedFor(run, "instagram");
  const caption = [String(review?.caption || record.metadata.description || "").trim(), String(review?.hashtags || "").trim()].filter(Boolean).join("\n\n");
  if (!caption || caption.length > 2200) throw Object.assign(new Error("Instagram caption is missing or exceeds 2200 characters"), { statusCode: 400 });
  if (fs.statSync(record.assetPath).isFile()) return require("./publishInstagramPrivate").publish(record, file, caption, expectedAccount);
  return require("./publishInstagramBrowser").publish(record, file, caption, expectedAccount);
}

module.exports = { preparedFor, safeReview, uploadYoutubeVideo, uploadYoutubeThumbnail, publishYoutube, publishInstagram, rearmInstagram, instagramPublishStatus };
