// Brand stills from the film engine without touching films/: brand/plans/<id>/ is served as /films/<id>/.
// node samples/obj3d/brand/snap.mjs <planId> <t1,t2,...> [W] [H]   -> out/brand/work/<planId>_t<t>.png
import http from "http"; import fs from "fs"; import path from "path"; import { fileURLToPath } from "url"; import { createRequire } from "module";
const brand = path.dirname(fileURLToPath(import.meta.url)), here = path.resolve(brand, ".."), REPO = path.resolve(here, "../..");
const require = createRequire(path.join(REPO, "paper-studio/package.json")); const puppeteer = require("puppeteer-core");
const CHROME = "C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe";
const [id, ts, W = "2560", H = "1440"] = process.argv.slice(2);
const MOUNTS = { "/three/": path.join(REPO, "runtime/vendor/three/"), [`/films/${id}/`]: path.join(brand, "plans", id) + "/", "/": here + "/" };
const MIME = { ".js": "text/javascript", ".html": "text/html", ".png": "image/png", ".json": "application/json", ".glb": "model/gltf-binary", ".geojson": "application/json" };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split("?")[0]);
  const m = Object.keys(MOUNTS).sort((a, b) => b.length - a.length).find(k => u.startsWith(k)); const f = path.join(MOUNTS[m], u.slice(m.length));
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(d); }); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const b = await puppeteer.launch({ executablePath: CHROME, headless: "shell", protocolTimeout: 3600000, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-webgl", "--no-sandbox"] });
const p = await b.newPage(); await p.setViewport({ width: +W, height: +H });
p.on("pageerror", e => console.log("PAGEERROR", e.message)); p.on("console", m => { const t = m.text(); if (/error|fail|warn/i.test(t)) console.log("[page]", t.slice(0, 300)); });
await p.goto(`http://127.0.0.1:${server.address().port}/film.html?film=${id}&ar=16x9`); await p.waitForFunction("window.__ready===true", { timeout: 600000 });
const OUT = path.resolve(here, "out/brand/work"); fs.mkdirSync(OUT, { recursive: true });
for (const t of ts.split(",")) { await p.evaluate(`window.renderAt(${t})`); const b64 = await p.evaluate(`document.querySelector("canvas").toDataURL("image/png").split(",")[1]`);
  const f = path.join(OUT, `${id}_t${t}.png`); fs.writeFileSync(f, Buffer.from(b64, "base64")); console.log("wrote", f); }
await b.close(); server.close();
