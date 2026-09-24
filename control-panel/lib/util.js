"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,80}$/;

function newId(prefix) {
  const id = crypto.randomBytes(8).toString("hex");
  return prefix ? `${prefix}-${id}` : id;
}

function isSafeId(value) {
  return typeof value === "string" && SAFE_ID.test(value);
}

function assertSafeId(value, label) {
  if (!isSafeId(value)) {
    const err = new Error(`invalid ${label || "id"}`);
    err.statusCode = 400;
    throw err;
  }
  return value;
}

/** Atomic write: write to a temp file in the same directory, then rename. */
function atomicWriteFileSync(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, filePath);
}

function readJsonSafe(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    // Corrupt file: don't crash the server, fall back and let the next write heal it.
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

/** Ensures `target` resolves inside `root`, guarding path traversal on file-serving routes. */
function insidePath(target, root) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    const err = new Error("path is outside the allowed directory");
    err.statusCode = 400;
    throw err;
  }
  return resolvedTarget;
}

module.exports = { newId, isSafeId, assertSafeId, atomicWriteFileSync, readJsonSafe, nowIso, insidePath };
