// node samples/obj3d/keycheck.mjs <film> [ar=16x9] [square] [oldcam] -> PRE-RENDER camera check on the KEY LIST only (no solver, no frames): room/street speed caps, speed steps (jerk), min shot length, dissolves.
// Prints every failing frame-line as { line, t, r (ratio to cap), ang, lin, step }. Exit code 1 on fail. Loads the page in ?keys=1 mode (film.html stops right after the keys are built).
// 16:9 is the default; `square` selects 9:16. Run through the queue: node runtime/jobq.js --kind snap --prio 1 -- "node samples/obj3d/keycheck.mjs <film> ar=16x9"
import http from "http"; import fs from "fs"; import path from "path"; import { fileURLToPath } from "url"; import { createRequire } from "module";
const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(here, "../..");
const [film, ...rest] = process.argv.slice(2);
if (!film || film === "--help" || film === "-h") { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter(l => l.startsWith("//")).map(l => l.slice(3)).join("\n")); process.exit(film ? 0 : 2); }
const puppeteer = createRequire(path.join(REPO, "package.json"))("puppeteer-core");
const CHROME = process.env.CHROME || "C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe";
const MOUNTS = { "/three/": [path.join(REPO, "runtime/vendor/three/")], "/data/": [path.join(here, "data/"), path.join(REPO, "runtime/geo/")], "/post/": [path.join(here, "post/")], "/": [here + "/"] };
const MIME = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".json": "application/json", ".geojson": "application/json", ".png": "image/png", ".jpg": "image/jpeg" };
const SIMPLEX = "export class SimplexNoise{noise(x,y){return Math.sin(x*12.9898+y*78.233)*0.5}noise3d(x,y,z){return Math.sin(x*12.9898+y*78.233+z*37.719)*0.5}}";   // GTAO noise texture only; render.mjs serves the full shim
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split("?")[0]), m = Object.keys(MOUNTS).sort((a, b) => b.length - a.length).find(k => u.startsWith(k));
  for (const dir of MOUNTS[m]) { const f = path.join(dir, u.slice(m.length)); if (!path.relative(dir, f).startsWith("..") && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); return fs.createReadStream(f).pipe(res); } }
  if (u === "/post/SimplexNoise.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(SIMPLEX); } res.writeHead(404); res.end(); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const qs = ["film=" + film, "keys=1", ...(rest.includes("ar=16x9") || !rest.includes("square") ? ["ar=16x9"] : []), ...(rest.includes("oldcam") ? ["oldcam=1"] : [])].join("&");
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "shell", protocolTimeout: 900000, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-webgl", "--no-sandbox"] });
const page = await browser.newPage(); await page.setViewport({ width: 1920, height: 1080 }); page.on("pageerror", e => { if (!/keys-only/.test(e.message)) console.log("PAGEERROR", e.message); });
await page.goto(`http://127.0.0.1:${server.address().port}/film.html?${qs}`); await page.waitForFunction("window.__ready===true", { timeout: 900000 });
const rep = await page.evaluate("window.__keyReport"); console.log(JSON.stringify(rep, null, 1)); await browser.close(); server.close(); process.exit(rep && rep.pass ? 0 : 1);
