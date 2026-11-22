// One command: node dialogue/spike0/render.mjs [job ...]   (default: all jobs)
// Serves spike0 + three + raw assets on localhost, drives headless Chrome (software GL), writes PNGs to out/.
import http from "http"; import fs from "fs"; import path from "path"; import { fileURLToPath } from "url"; import { createRequire } from "module";
const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(here, "../..");
const require = createRequire(path.join(REPO, "package.json"));
const puppeteer = require("puppeteer-core");
const CHROME = "C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe";
const MOUNTS = { "/three/": path.join(REPO, "runtime/vendor/three/"), "/raw/": path.join(REPO, ".vendor-assets/dialogue/raw/"), "/": here + "/" };
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  // runtime/vendor/three lacks jsm/curves (FBXLoader imports NURBSCurve; unused by these meshes): serve a stub
  if (u === "/three/jsm/curves/NURBSCurve.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end("export class NURBSCurve{constructor(){throw new Error(\"NURBS unsupported (stub)\")}}"); }
  for (const [pre, dir] of Object.entries(MOUNTS)) if (u.startsWith(pre)) {
    const f = path.join(dir, u.slice(pre.length)); if (path.relative(dir, f).startsWith("..")) break;
    if (fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); return fs.createReadStream(f).pipe(res); }
  }
  console.log("  404", u); res.writeHead(404); res.end("nf");
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const ALL = ["bonemap", "face_test", "cast_sheet", "sit_strip", "props_sheet", "campfire_rough"];
const jobs = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "shell", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox", "--allow-file-access-from-files"] });
fs.mkdirSync(path.join(here, "out"), { recursive: true });
for (const job of jobs) {
  const t0 = Date.now();
  const page = await browser.newPage();
  page.on("console", m => console.log(`  [${job}]`, m.text()));
  page.on("pageerror", e => console.log(`  [${job}] PAGEERROR`, e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?job=${job}`);
  await page.waitForFunction("window.__done===true||window.__err", { timeout: 540000, polling: 500 });
  const err = await page.evaluate("window.__err"); if (err) { console.log(`[${job}] FAILED:`, err); await page.close(); continue; }
  const outs = await page.evaluate("window.__out");
  for (const [name, data] of Object.entries(outs)) if (data.startsWith("data:image/png")) { fs.writeFileSync(path.join(here, "out", name + ".png"), Buffer.from(data.split(",")[1], "base64")); console.log(`[${job}] wrote out/${name}.png`); }
  else if (data.startsWith("data:application/json")) { fs.writeFileSync(path.join(here, "cast", name + ".json"), decodeURIComponent(data.slice(data.indexOf(",") + 1))); console.log(`[${job}] wrote cast/${name}.json`); }
  console.log(`[${job}] ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await page.close();
}
await browser.close(); server.close();
