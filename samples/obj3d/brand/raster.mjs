// Rasterise SVG / HTML files to PNG with headless Chrome. node brand/raster.mjs <in.svg|in.html> <out.png> <W> <H> [transparent]
import fs from "fs"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url"; import { createRequire } from "module";
const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(here, "../../..");
const require = createRequire(path.join(REPO, "paper-studio/package.json")); const puppeteer = require("puppeteer-core");
const CHROME = "C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe";
const jobs = []; const a = process.argv.slice(2); for (let i = 0; i + 3 < a.length + 1; i += 4) if (a[i]) jobs.push(a.slice(i, i + 4));
const b = await puppeteer.launch({ executablePath: CHROME, headless: "shell", args: ["--no-sandbox"] }); const p = await b.newPage();
for (const [src, out, W, H] of jobs) {
  await p.setViewport({ width: +W, height: +H }); await p.goto(pathToFileURL(path.resolve(src)).href); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: +W, height: +H } }); console.log("wrote", out); }
await b.close();
