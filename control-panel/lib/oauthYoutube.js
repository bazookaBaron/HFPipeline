"use strict";

const path = require("path");
const crypto = require("crypto");
const { atomicWriteFileSync, readJsonSafe } = require("./util");

const TOKEN_FILE = path.join(__dirname, "..", "data", "oauth", "youtube.json");
const pending = new Map();
const redirectUri = () => process.env.YOUTUBE_REDIRECT_URI || `http://127.0.0.1:${process.env.PORT || 4600}/api/oauth/youtube/callback`;

function config() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw Object.assign(new Error("Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET locally before connecting YouTube"), { statusCode: 409 });
  return { clientId, clientSecret };
}

function readToken() {
  const record = readJsonSafe(TOKEN_FILE, null);
  return record && !record.stub ? record : null;
}

function status() {
  const token = readToken();
  return { configured: Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET), connected: Boolean(token?.refreshToken), expired: Boolean(token && Date.now() >= token.expiresAt), connectedAt: token?.connectedAt || null, expiresAt: token?.expiresAt ? new Date(token.expiresAt).toISOString() : null };
}

function beginConnect() {
  const { clientId } = config();
  const state = crypto.randomBytes(24).toString("hex");
  pending.set(state, Date.now() + 10 * 60_000);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  for (const [key, value] of Object.entries({ client_id: clientId, redirect_uri: redirectUri(), response_type: "code", scope: "https://www.googleapis.com/auth/youtube.upload", access_type: "offline", prompt: "consent", state })) url.searchParams.set(key, value);
  return url.toString();
}

async function tokenRequest(fields) {
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields) });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw Object.assign(new Error(`YouTube OAuth failed: ${body.error || response.status}`), { statusCode: 502 });
  return body;
}

async function handleCallback(state, code) {
  const expiry = pending.get(state);
  pending.delete(state);
  if (!state || !expiry || expiry < Date.now() || !code) throw Object.assign(new Error("Unknown or expired YouTube OAuth state"), { statusCode: 400 });
  const { clientId, clientSecret } = config();
  const data = await tokenRequest({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri(), grant_type: "authorization_code" });
  if (!data.refresh_token) throw Object.assign(new Error("Google did not return a refresh token; reconnect with consent"), { statusCode: 502 });
  const record = { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000, connectedAt: new Date().toISOString() };
  atomicWriteFileSync(TOKEN_FILE, JSON.stringify(record));
  return status();
}

async function accessToken() {
  const token = readToken();
  if (!token?.refreshToken) throw Object.assign(new Error("Connect YouTube before publishing"), { statusCode: 409 });
  if (token.accessToken && token.expiresAt > Date.now() + 60_000) return token.accessToken;
  const { clientId, clientSecret } = config();
  const data = await tokenRequest({ refresh_token: token.refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" });
  atomicWriteFileSync(TOKEN_FILE, JSON.stringify({ ...token, accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 }));
  return data.access_token;
}

module.exports = { status, beginConnect, handleCallback, accessToken };
