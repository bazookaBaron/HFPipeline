// node samples/obj3d/mg2d/render2d.mjs still|video <page> [times|fps] [query]   e.g. still board2d 1,3,5 ar=16x9
// Renders a samples/obj3d/<page>.html Canvas2D page (window.renderAt, __info.T). Output: out/<page>[_169]_t<t>.jpg / <page>[_169].mp4
import http from "http"; import fs from "fs"; import path from "path"; import cp from "child_process"; import { fileURLToPath } from "url"; import { createRequire } from "module";
const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), REPO = path.resolve(here, "../..");
const puppeteer = createRequire(path.join(REPO, "paper-studio/package.json"))("puppeteer-core");
const CHROME = "C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe";
const MIME = { ".js": "text/javascript", ".html": "text/html", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg" };
const server = http.createServer((req, res) => { const f = path.join(here, decodeURIComponent(req.url.split("?")[0]));
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(d); }); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const [mode, page, a3, qs = ""] = process.argv.slice(2), land = qs.includes("16x9"), W = land ? 1920 : 1080, H = land ? 1080 : 1920, tag = page + (land ? "_169" : "");
const b = await puppeteer.launch({ executablePath: CHROME, headless: "shell", args: ["--no-sandbox"] }); const p = await b.newPage(); await p.setViewport({ width: W, height: H });
p.on("pageerror", e => console.log("PAGEERROR", e.message)); p.on("console", m => console.log("[page]", m.text()));
await p.goto(`http://127.0.0.1:${server.address().port}/${page}.html?${qs}`); await p.waitForFunction("window.__ready===true", { timeout: 60000 });
const info = await p.evaluate("window.__info"); console.log("T", info.T);
const OUT = path.join(here, "out"); const shot = async (t, f) => { await p.evaluate(`window.renderAt(${t})`); const b64 = await p.evaluate(`document.querySelector("canvas").toDataURL("image/jpeg",0.94).split(",")[1]`); fs.writeFileSync(f, Buffer.from(b64, "base64")); };
if (mode === "still") { for (const t of (a3 === "auto" ? Array.from({ length: 12 }, (_, i) => +((i + 0.5) * info.T / 12).toFixed(2)) : a3.split(",").map(Number))) await shot(t, path.join(OUT, `${tag}_t${t}.jpg`)); console.log("stills done"); }
else { const fps = +a3 || 30, n = Math.round(info.T * fps), fd = path.join(OUT, "frames_" + tag); fs.rmSync(fd, { recursive: true, force: true }); fs.mkdirSync(fd);
  const t0 = Date.now(); for (let i = 0; i < n; i++) await shot(i / fps, path.join(fd, String(i).padStart(5, "0") + ".jpg"));
  console.log(`frames ${n} ${((Date.now() - t0) / 1000 / n).toFixed(3)} s/frame`);
  cp.execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(fd, "%05d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", path.join(OUT, tag + ".mp4")]);
  fs.rmSync(fd, { recursive: true, force: true }); console.log("wrote", path.join(OUT, tag + ".mp4")); }
await b.close(); server.close();
