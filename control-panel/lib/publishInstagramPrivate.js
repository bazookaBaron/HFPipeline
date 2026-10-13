"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { atomicWriteFileSync } = require("./util");
const { localSessionId } = require("./publishInstagramBrowser");

const PYTHON = path.join(__dirname, "..", "..", ".venv", "Scripts", "python.exe");
const WORKER = path.join(__dirname, "instagram_private_worker.py");
const SETTINGS = path.join(__dirname, "..", "data", "oauth", "instagram-private", "settings.json");
let busy = false;

function runWorker(request) {
  if (!fs.existsSync(PYTHON)) throw Object.assign(new Error("Instagram private uploader is not installed in .venv"), { statusCode: 503 });
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [WORKER], { cwd: path.join(__dirname, ".."), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    const timer = setTimeout(() => child.kill(), request.mode === "publish" ? 240000 : 60000);
    child.stdout.on("data", (chunk) => { output += chunk.toString(); if (output.length > 50000) child.kill(); });
    // Do not include stderr in an error: HTTP failures may contain session data.
    child.stderr.resume();
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      const line = output.trim().split(/\r?\n/).at(-1);
      let result;
      try { result = JSON.parse(line); } catch { return reject(new Error("Instagram private uploader produced no valid response")); }
      if (code !== 0 || !result.ok) return reject(new Error(`Instagram private uploader failed (${result.errorClass || "unknown"}); no automatic retry`));
      resolve(result);
    });
    child.stdin.end(JSON.stringify(request));
  });
}

async function preflight(expectedAccount) {
  if (!/^[A-Za-z0-9._]+$/.test(expectedAccount || "")) throw Object.assign(new Error("Confirm the Instagram account"), { statusCode: 400 });
  const sessionId = fs.existsSync(SETTINGS) ? null : await localSessionId();
  return runWorker({ mode: "preflight", expectedAccount, sessionId, settingsPath: SETTINGS });
}

async function publish(record, file, caption, expectedAccount) {
  if (busy) throw Object.assign(new Error("An Instagram upload is already in progress"), { statusCode: 409 });
  if (!/^[A-Za-z0-9._]+$/.test(expectedAccount || "")) throw Object.assign(new Error("Confirm the Instagram account"), { statusCode: 400 });
  if (record.publication?.state === "complete") return record.publication;
  if (record.publication?.state === "share-unknown") throw Object.assign(new Error("Previous Instagram upload outcome is unknown; check the account before retrying"), { statusCode: 409 });
  busy = true;
  const markStage = (stage) => {
    record.publishAttempt = { stage, updatedAt: new Date().toISOString(), expectedAccount };
    atomicWriteFileSync(file, JSON.stringify(record, null, 2));
  };
  try {
    markStage("checking-private-session");
    await preflight(expectedAccount);
    record.publication = { state: "share-unknown", startedAt: new Date().toISOString(), method: "instagrapi" };
    markStage("uploading-reel");
    const result = await runWorker({ mode: "publish", expectedAccount, settingsPath: SETTINGS, videoPath: record.assetPath, caption });
    record.publication = { state: "complete", method: "instagrapi", account: result.username, mediaId: result.mediaId, code: result.code, url: result.url, publishedAt: new Date().toISOString() };
    markStage("reel-verified");
    return record.publication;
  } finally {
    busy = false;
  }
}

module.exports = { preflight, publish };
