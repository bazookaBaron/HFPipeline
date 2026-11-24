// node samples/set25d/render.mjs still <plate> [t] [cfgJSON] | video <plate> [fps] [cfgJSON]
import http from "http"; import fs from "fs"; import path from "path"; import cp from "child_process"; import { fileURLToPath } from "url"; import { createRequire } from "module";
const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(here, "../..");
const require = createRequire(path.join(REPO, "paper-studio/package.json")); const puppeteer = require("puppeteer-core");
const CHROME = "C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe";
const MOUNTS = { "/three/": path.join(REPO, "runtime/vendor/three/"), "/raw/": path.join(REPO, ".vendor-assets/dialogue/raw/"), "/": here + "/" };
const MIME = { ".js": "text/javascript", ".html": "text/html", ".png": "image/png", ".json": "application/json", ".gltf": "model/gltf+json", ".bin": "application/octet-stream", ".f32": "application/octet-stream" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  const m = Object.keys(MOUNTS).sort((a, b) => b.length - a.length).find(k => u.startsWith(k));
  const f = path.join(MOUNTS[m], u.slice(m.length));
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(d); });
});
await new Promise(r => server.listen(0, "127.0.0.1", r)); const port = server.address().port;
const [mode, plate, a3, a4] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "shell", protocolTimeout: 3600000,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-webgl", "--no-sandbox"] });
const page = await browser.newPage(); await page.setViewport({ width: 1920, height: 1080 });
page.on("console", m => console.log("[page]", m.text())); page.on("pageerror", e => console.log("PAGEERROR", e.message));
const cfg = (mode === "still" ? a4 : a4) || "{}";
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/index.html?plate=${plate}&cfg=${encodeURIComponent(cfg)}`);
await page.waitForFunction("window.__ready===true", { timeout: 300000 });
console.log("load", ((Date.now() - t0) / 1000).toFixed(1) + "s", JSON.stringify(await page.evaluate("window.__info")));
const OUT = path.join(here, "out"); fs.mkdirSync(OUT, { recursive: true });
const shot = async (t, file) => { await page.evaluate(`window.renderAt(${t})`); const b64 = await page.evaluate(`document.querySelector("canvas").toDataURL("image/jpeg",0.95).split(",")[1]`); fs.writeFileSync(file, Buffer.from(b64, "base64")); };
if (mode === "still") {
  for (const t of (a3 || "0").split(",")) { const f = path.join(OUT, `${plate}_t${t}.jpg`); await shot(+t, f); console.log("wrote", f); }
} else {
  const fps = +a3 || 30, T = JSON.parse(cfg).T || 8, n = Math.round(T * fps), fd = path.join(OUT, "frames_" + plate);
  fs.rmSync(fd, { recursive: true, force: true }); fs.mkdirSync(fd);
  const r0 = Date.now();
  for (let i = 0; i < n; i++) await shot(i / fps, path.join(fd, String(i).padStart(5, "0") + ".jpg"));
  const spf = (Date.now() - r0) / 1000 / n; console.log(`frames ${n}  ${spf.toFixed(3)} s/frame`);
  const mp4 = path.join(OUT, `${plate}.mp4`);
  cp.execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(fd, "%05d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", mp4]);
  console.log("wrote", mp4); fs.writeFileSync(path.join(OUT, "time.json"), JSON.stringify({ frames: n, s_per_frame: spf }));
}
await browser.close(); server.close();
