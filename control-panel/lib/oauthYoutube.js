"use strict";

/**
 * YouTube "reconnect" flow -- SHAPE ONLY, no real Google OAuth.
 *
 * The full brief flags that unverified-app refresh tokens for this kind of
 * OAuth expire periodically, and the old repo had to bolt a reconnect flow on
 * after the fact. This module builds the real click -> redirect -> consent ->
 * callback -> "reconnected" shape now, with the actual Google token exchange
 * replaced by a single, clearly-marked placeholder function
 * (`exchangeCodeForToken`). Dropping in real client credentials later means
 * replacing that one function's body -- no redesign of the flow, storage
 * shape, or UI.
 *
 * Token state persists to data/oauth/youtube.json (JSON file, not a real
 * token store -- fine for a local single-operator control panel).
 */

const path = require("path");
const crypto = require("crypto");
const { atomicWriteFileSync, readJsonSafe } = require("./util");

const TOKEN_FILE = path.join(__dirname, "..", "data", "oauth", "youtube.json");
const PENDING_STATES = new Set();

// Demo TTL so the "reconnect required" UI path is actually observable without
// waiting on a real unverified-app refresh-token expiry window (which is
// usually 7 days). Swap for the provider's real `expires_in` once wired.
const STUB_TOKEN_TTL_MS = 5 * 60 * 1000;

function readToken() {
  return readJsonSafe(TOKEN_FILE, { connected: false, stub: true });
}

function writeToken(value) {
  atomicWriteFileSync(TOKEN_FILE, JSON.stringify(value, null, 2));
}

function status() {
  const token = readToken();
  if (!token.connected) return { connected: false, stub: true };
  const expired = token.expiresAt && Date.now() > new Date(token.expiresAt).getTime();
  return { ...token, expired };
}

/** Step 1: user clicks "Connect/Reconnect YouTube". Returns where to redirect them. */
function beginConnect() {
  const state = crypto.randomBytes(16).toString("hex");
  PENDING_STATES.add(state);
  // Real implementation would build the Google OAuth consent URL here with
  // client_id/redirect_uri/scope/state. We redirect to our own stub consent
  // page instead, clearly labeled as a placeholder.
  return `/oauth/youtube/consent?state=${state}`;
}

/**
 * PLACEHOLDER -- real Google OAuth code<->token exchange goes here in Phase 7.
 * Currently just fabricates a token record so the rest of the flow (storage,
 * status display, expiry, reconnect-on-expiry) is exercised end-to-end.
 */
function exchangeCodeForToken(/* code */) {
  return {
    connected: true,
    stub: true,
    accessToken: `stub_access_${crypto.randomBytes(6).toString("hex")}`,
    connectedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + STUB_TOKEN_TTL_MS).toISOString(),
  };
}

/** Step 3: consent page posts back here with the state + a fake "code". */
function handleCallback(state, code) {
  if (!state || !PENDING_STATES.has(state)) {
    const err = new Error("unknown or expired OAuth state");
    err.statusCode = 400;
    throw err;
  }
  PENDING_STATES.delete(state);
  const token = exchangeCodeForToken(code);
  writeToken(token);
  return token;
}

/** Test-only helper so the "expired -> reconnect" UI path can be demonstrated on demand. */
function forceExpireForTesting() {
  const token = readToken();
  if (!token.connected) return status();
  token.expiresAt = new Date(Date.now() - 1000).toISOString();
  writeToken(token);
  return status();
}

module.exports = { status, beginConnect, handleCallback, forceExpireForTesting, isPendingState: (s) => PENDING_STATES.has(s) };
