"use strict";

// Experimental desktop-web automation; uses an operator-signed-in browser profile.
const fs = require("fs");
const path = require("path");
const { atomicWriteFileSync } = require("./util");

const PROFILE = path.join(__dirname, "..", "data", "oauth", "instagram-browser");
let browser = null;
let busy = false;

async function getBrowser() {
  if (browser?.connected) return browser;
  const puppeteer = require(require.resolve("puppeteer", { paths: [path.join(__dirname, "..", "..", "carousel-engine")] }));
  const portFile = path.join(PROFILE, "DevToolsActivePort");
  if (fs.existsSync(portFile)) {
    const port = Number(fs.readFileSync(portFile, "utf8").split(/\r?\n/)[0]);
    if (port > 0 && port < 65536) {
      try {
        browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, timeout: 5000 });
        return browser;
      } catch { /* A stale Chrome profile port is safe to ignore. */ }
    }
  }
  browser = await puppeteer.launch({ headless: false, timeout: 20000, userDataDir: PROFILE, defaultViewport: { width: 1280, height: 900 }, args: ["--no-first-run"] });
  return browser;
}

async function connect() {
  const client = await getBrowser();
  const page = (await client.pages())[0] || await client.newPage();
  await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded", timeout: 45000 });
  return { opened: true, message: "Sign in to Instagram in the opened browser window. This local browser profile is reused for publishing." };
}

async function sessionStatus() {
  const client = await getBrowser();
  const pages = (await client.pages()).filter((candidate) => candidate.url().startsWith("https://www.instagram.com/"));
  if (!pages.length) {
    const page = await client.newPage();
    await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded", timeout: 45000 });
    pages.push(page);
  }
  for (const page of pages) {
    const status = await page.evaluate(() => {
      const signInVisible = Boolean(document.querySelector('input[name="username"],input[name="password"]'));
      const profile = [...document.querySelectorAll('a[href]')].find((link) => {
        const label = `${link.textContent || ""} ${link.getAttribute("aria-label") || ""}`.trim();
        return /\bprofile\b/i.test(label) && /^\/[A-Za-z0-9._]+\/$/.test(link.getAttribute("href") || "");
      });
      const username = profile?.getAttribute("href")?.slice(1, -1) || null;
      return { signedIn: !signInVisible && Boolean(username), username };
    });
    if (status.signedIn) return status;
  }
  return { signedIn: false, username: null };
}

async function localSessionId() {
  const client = await getBrowser();
  const page = (await client.pages()).find((candidate) => candidate.url().startsWith("https://www.instagram.com/")) || await client.newPage();
  if (!page.url().startsWith("https://www.instagram.com/")) await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded", timeout: 45000 });
  const cookie = (await page.cookies("https://www.instagram.com/" )).find((item) => item.name === "sessionid");
  if (!cookie?.value) throw Object.assign(new Error("The local Instagram browser session has expired; reconnect first"), { statusCode: 409 });
  return cookie.value;
}

async function clickLabel(page, label, timeout = 15000) {
  await page.waitForFunction((wanted) => [...document.querySelectorAll('[role="dialog"] button,[role="dialog"] [role="button"]')].some((el) => el.textContent.trim().toLowerCase() === wanted.toLowerCase()), { timeout }, label);
  const clicked = await page.evaluate((wanted) => {
    const el = [...document.querySelectorAll('[role="dialog"] button,[role="dialog"] [role="button"]')].find((item) => item.textContent.trim().toLowerCase() === wanted.toLowerCase());
    if (!el) return false;
    el.click();
    return true;
  }, label);
  if (!clicked) throw new Error(`Instagram's ${label} control was not found; its interface may have changed`);
}

async function openComposer(page) {
  await page.waitForFunction(() => [...document.querySelectorAll("a")].some((el) => el.textContent.trim().endsWith("Create")), { timeout: 15000 });
  await page.evaluate(() => [...document.querySelectorAll("a")].find((el) => el.textContent.trim().endsWith("Create")).click());
  await page.waitForFunction(() => [...document.querySelectorAll('a,[role="button"]')].some((el) => el.textContent.trim() === "PostPost"), { timeout: 10000 });
  await page.evaluate(() => [...document.querySelectorAll('a,[role="button"]')].find((el) => el.textContent.trim() === "PostPost").click());
}

async function selectPortraitCrop(page) {
  await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.innerText.startsWith("Crop"), { timeout: 30000 });
  const modal = await page.$('[role="dialog"] button');
  if (modal) await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find((el) => el.textContent.trim() === "OK")?.click());
  const opened = await page.evaluate(() => {
    const toggle = document.querySelector('button:has(svg[aria-label="Select crop"])');
    if (!toggle) return false;
    toggle.click();
    return true;
  });
  if (!opened) throw new Error("Instagram crop selector was not found; stopped before Share");
  await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] [role="button"]')].some((el) => el.textContent.trim().startsWith("9:16")), { timeout: 10000 });
  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] [role="button"]')].find((el) => el.textContent.trim().startsWith("9:16")).click());
  await page.waitForFunction(() => {
    const video = document.querySelector('[role="dialog"] video');
    if (!video) return false;
    const rect = video.getBoundingClientRect();
    return Math.abs(rect.width / rect.height - 9 / 16) < 0.02;
  }, { timeout: 10000 });
  const crop = await page.evaluate(() => {
    const video = document.querySelector('[role="dialog"] video');
    if (!video) return null;
    const rect = video.getBoundingClientRect();
    return { source: video.videoWidth / video.videoHeight, preview: rect.width / rect.height };
  });
  if (!crop || Math.abs(crop.source - 9 / 16) > 0.02 || Math.abs(crop.preview - 9 / 16) > 0.02) {
    throw new Error(`Instagram portrait crop was not verified: ${JSON.stringify(crop)}`);
  }
}

function mediaFiles(record) {
  if (fs.statSync(record.assetPath).isFile()) return [record.assetPath];
  const files = fs.readdirSync(record.assetPath).filter((name) => /^slide-\d+.*\.png$/i.test(name)).sort().map((name) => path.join(record.assetPath, name));
  if (files.length < 2 || files.length > 10) throw new Error("Instagram carousel must have 2–10 rendered slides");
  return files;
}

async function publish(record, file, caption, expectedAccount) {
  if (busy) throw Object.assign(new Error("An Instagram publish attempt is already in progress"), { statusCode: 409 });
  if (!expectedAccount || !/^[A-Za-z0-9._]+$/.test(expectedAccount)) throw Object.assign(new Error("Confirm the signed-in Instagram account before publishing"), { statusCode: 400 });
  if (record.publication?.state === "complete") return record.publication;
  if (record.publication?.state === "share-unknown") throw Object.assign(new Error("Previous Share outcome is unknown; check Instagram before retrying to prevent duplicates"), { statusCode: 409 });
  busy = true;
  let page;
  let shareClicked = false;
  const markStage = (stage) => {
    record.publishAttempt = { stage, updatedAt: new Date().toISOString(), expectedAccount };
    atomicWriteFileSync(file, JSON.stringify(record, null, 2));
  };
  try {
    markStage("opening-instagram");
    const client = await getBrowser();
    page = await client.newPage();
    await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded", timeout: 45000 });
    if (await page.$('input[name="username"],input[name="password"]')) throw Object.assign(new Error("Sign in via Connect Instagram first"), { statusCode: 409 });
    const session = await sessionStatus();
    if (session.username?.toLowerCase() !== expectedAccount.toLowerCase()) throw Object.assign(new Error(`Instagram is signed into @${session.username || "unknown"}, not @${expectedAccount}`), { statusCode: 409 });
    markStage("opening-composer");
    await openComposer(page);
    const isVideo = mediaFiles(record).length === 1;
    markStage("uploading-video");
    const input = await page.waitForSelector('input[type="file"]', { timeout: 15000 });
    await input.uploadFile(...mediaFiles(record));
    if (isVideo) {
      await selectPortraitCrop(page);
      markStage("portrait-crop-verified");
    }
    await clickLabel(page, "Next", 20000);
    if (isVideo) await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.innerText.startsWith("Edit"), { timeout: 20000 });
    await clickLabel(page, "Next", 20000);
    if (isVideo) await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.innerText.startsWith("New reel"), { timeout: 20000 });
    markStage("entering-caption");
    const editor = await page.waitForSelector('[role="dialog"] [contenteditable="true"][role="textbox"]', { timeout: 20000 });
    await editor.click();
    const normalizedCaption = caption.replace(/\s+/g, " ").trim();
    await page.keyboard.insertText(normalizedCaption);
    const typed = await page.evaluate((expected) => [...document.querySelectorAll('[role="dialog"] [contenteditable="true"]')].some((el) => (el.textContent || "").replace(/\s+/g, " ").trim() === expected), normalizedCaption);
    if (!typed) throw new Error("Instagram caption could not be verified before sharing");
    markStage("caption-verified");
    if (isVideo) {
      const reelComposer = await page.evaluate(() => /\breel\b/i.test(document.querySelector('[role="dialog"]')?.innerText || ""));
      if (!reelComposer) throw new Error("Instagram did not identify this video composer as a Reel; stopped before Share");
    }
    const accountInComposer = await page.evaluate((username) => (document.querySelector('[role="dialog"]')?.innerText || "").toLowerCase().includes(username.toLowerCase()), expectedAccount);
    if (!accountInComposer) throw new Error(`Instagram composer did not show @${expectedAccount}; stopped before Share`);
    await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button,[role="dialog"] [role="button"]')].some((el) => el.textContent.trim().toLowerCase() === "share"), { timeout: 15000 });
    record.publication = { state: "share-unknown", startedAt: new Date().toISOString() };
    markStage("share-requested");
    atomicWriteFileSync(file, JSON.stringify(record, null, 2));
    await clickLabel(page, "Share", 15000);
    shareClicked = true;
    await page.waitForFunction(() => /your (post|reel) has been shared|post shared|reel shared/i.test(document.body.innerText), { timeout: 120000 });
    record.publication = { state: "complete", publishedAt: new Date().toISOString(), method: "instagram-desktop-browser", message: "Instagram reported that the post was shared; permalink not independently verified" };
    markStage("instagram-confirmed-share");
    atomicWriteFileSync(file, JSON.stringify(record, null, 2));
    await page.close();
    return record.publication;
  } finally {
    if (!shareClicked && page && !page.isClosed()) await page.close().catch(() => {});
    busy = false;
  }
}

module.exports = { connect, sessionStatus, localSessionId, publish, mediaFiles };
