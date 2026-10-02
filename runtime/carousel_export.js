#!/usr/bin/env node
"use strict";
/* runtime/carousel_export.js <dir|index.html> [--sheet]
 * Headless Chrome screenshot of every .slide to <dir>/slide-N.png: rendered at 2x (2160x2700), then downscaled
 * to 1080x1350 with ffmpeg lanczos for crisp edges. Also prints text-size and overflow checks
 * (headline >= 64px, body >= 34px, content overflowing its slide). --sheet writes <dir>/sheet.jpg (contact sheet). */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function findPuppeteer() {
  try { return require("puppeteer-core"); } catch (e) {}
  const base = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx");
  if (fs.existsSync(base)) for (const d of fs.readdirSync(base)) {
    const p = path.join(base, d, "node_modules/puppeteer-core");
    if (fs.existsSync(p)) return require(p);
  }
  throw new Error("puppeteer-core not found (npx cache)");
}
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);

const args = process.argv.slice(2);
const target = path.resolve(args.find((a) => !a.startsWith("--")) || ".");
const html = target.endsWith(".html") ? target : path.join(target, "index.html");
const dir = path.dirname(html);

(async () => {
  const b = await findPuppeteer().launch({ executablePath: chrome, headless: "new", args: ["--allow-file-access-from-files", "--force-color-profile=srgb"] });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
  p.on("pageerror", (e) => console.log("PAGEERR", e.message));
  await p.goto("file:///" + html.split(path.sep).join("/"), { waitUntil: "networkidle0" });
  await p.evaluate(() => document.fonts.ready);
  const slides = await p.$$(".slide");
  const report = await p.evaluate(() => [...document.querySelectorAll(".slide")].map((s, i) => {
    const sb = s.getBoundingClientRect(); const issues = [];
    const h1 = s.querySelector(".h1"); const hs = h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0;
    if (hs < 64) issues.push("headline " + hs + "px");
    let minBody = 999;
    s.querySelectorAll("li span, .note, .sub, .qa .q, .qa .a, .rank .r span:last-child, .row > span:first-child, .check li span, .stat .lbl").forEach((e) => { minBody = Math.min(minBody, parseFloat(getComputedStyle(e).fontSize)); });
    if (minBody < 34) issues.push("body " + minBody + "px");
    s.querySelectorAll(".body > *, .card, .cta, .h1").forEach((e) => { const r = e.getBoundingClientRect(); if (r.bottom > sb.bottom - 40 || r.right > sb.right - 20 || e.scrollWidth > e.clientWidth + 2) issues.push("overflow " + (e.className || e.tagName) + " bottom=" + Math.round(r.bottom - sb.top)); });
    const body = s.querySelector(".body"); if (body && body.scrollHeight > body.clientHeight + 2) issues.push("body scroll " + body.scrollHeight + ">" + body.clientHeight);
    return { i: i + 1, headline: hs, minBody, issues };
  }));
  const tmp = path.join(dir, "_2x"); fs.mkdirSync(tmp, { recursive: true });
  for (let i = 0; i < slides.length; i++) {
    const big = path.join(tmp, `s${i + 1}.png`), out = path.join(dir, `slide-${i + 1}.png`);
    await slides[i].screenshot({ path: big });
    const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", big, "-vf", "scale=1080:1350:flags=lanczos", out]);
    if (r.status !== 0) throw new Error("ffmpeg downscale failed: " + r.stderr);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  await b.close();
  for (const r of report) console.log(`slide ${r.i}: headline ${r.headline}px, min body ${r.minBody}px`, r.issues.length ? "ISSUES: " + r.issues.join("; ") : "ok");
  if (args.includes("--sheet")) {
    const n = slides.length, cols = Math.min(4, n), rows = Math.ceil(n / cols);
    const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-framerate", "1", "-i", path.join(dir, "slide-%d.png"), "-vf", `scale=540:675,tile=${cols}x${rows}:padding=12:color=0x222222`, "-frames:v", "1", "-q:v", "3", path.join(dir, "sheet.jpg")]);
    if (r.status !== 0) console.log("sheet failed", String(r.stderr));
    else console.log("sheet:", path.join(dir, "sheet.jpg"));
  }
  console.log("wrote", slides.length, "PNGs to", dir);
})().catch((e) => { console.error(e.message); process.exit(1); });
