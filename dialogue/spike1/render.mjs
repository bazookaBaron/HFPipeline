// DIALOGUE spike1 renderer. Usage: node dialogue/spike1/render.mjs <job> [...]
//   jobs: gate | stills [name,...] | video 9x16|16x9 | sheet 9x16|16x9 | all (gate + stills + both videos)
// Serves spike1 + three + raw assets on localhost, drives headless Chrome (software GL), puppeteer frame capture + ffmpeg. Deterministic.
import http from "http"; import fs from "fs"; import path from "path"; import cp from "child_process"; import { fileURLToPath } from "url"; import { createRequire } from "module";
const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(here, "../..");
const require = createRequire(path.join(REPO, "package.json")); const puppeteer = require("puppeteer-core");
const CHROME = "C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe";
const MOUNTS = { "/three/": path.join(REPO, "runtime/vendor/three/"), "/raw/": path.join(REPO, ".vendor-assets/dialogue/raw/"), "/": here + "/" };
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".geojson": "application/json", ".png": "image/png", ".woff2": "font/woff2", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  if (u === "/three/jsm/curves/NURBSCurve.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end("export class NURBSCurve{constructor(){throw new Error(\"NURBS unsupported (stub)\")}}"); }
  for (const [pre, dir] of Object.entries(MOUNTS)) if (u.startsWith(pre)) { const f = path.join(dir, u.slice(pre.length)); if (path.relative(dir, f).startsWith("..")) break;
    if (fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); return fs.createReadStream(f).pipe(res); } }
  console.log("  404", u); res.writeHead(404); res.end("nf");
});
await new Promise(r => server.listen(0, "127.0.0.1", r)); const port = server.address().port;
const [job, ...rest] = process.argv.slice(2); const OUT = path.join(here, "out"); fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "shell", protocolTimeout: 3600000, args: (process.env.GL !== "sw" ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-webgl", "--no-sandbox", "--allow-file-access-from-files"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox", "--allow-file-access-from-files"]) });
async function open(w, h) {
  const page = await browser.newPage(); await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  page.on("console", m => console.log(`  [${w}x${h}]`, m.text())); page.on("pageerror", e => console.log("  PAGEERROR", e.message));
  const t0 = Date.now(); await page.goto(`http://127.0.0.1:${port}/index.html?w=${w}&h=${h}`);
  await page.waitForFunction("window.__ready===true||window.__err", { timeout: 900000, polling: 500 }); const err = await page.evaluate("window.__err"); if (err) throw new Error(err);
  await page.evaluate("document.fonts.ready.then(()=>1)"); console.log(`  page ready ${((Date.now() - t0) / 1000).toFixed(1)} s`); return page;
}
const DIMS = { "9x16": [1080, 1920], "16x9": [1920, 1080] };
const shot = (page, file) => page.screenshot({ path: path.join(OUT, file), type: "png" });
const STILLS = { // name -> [aspect, spec]
  hero_wide_16x9: ["16x9", { t: 3.0, shot: { rig: "wide2" }, u: 0.5, layout: "full", mg: false, capT: -1 }],
  hero_wide_9x16: ["9x16", { t: 3.0, shot: { rig: "wide2" }, u: 0.5, layout: "full", mg: false, capT: -1 }],
  hero_mcu_dadu_9x16: ["9x16", { t: 3.4, shot: { rig: "mcu_A" }, u: 0.5, layout: "full", mg: false }],
  hero_stack_9x16: ["9x16", { t: 7.3, layout: "stack", rig: "ots_A", u: 0.8, mgT: 3.4 }],
  hero_split_16x9: ["16x9", { t: 7.3, layout: "split", u: 0.8, mgT: 3.4 }],
  // QA rig sheets (not deliverables)
  qa_mcu_B_9x16: ["9x16", { t: 6.8, shot: { rig: "mcu_B" }, u: 0.5, layout: "full", mg: false, capT: -1 }],
  qa_ots_B_9x16: ["9x16", { t: 6.8, shot: { rig: "ots_B" }, u: 0.5, layout: "full", mg: false, capT: -1 }],
  qa_seatA: ["16x9", { t: 3.0, shot: { rig: "seat_A" }, u: 0.5, layout: "full", mg: false, capT: -1 }],
  qa_seatB: ["16x9", { t: 3.0, shot: { rig: "seat_B" }, u: 0.5, layout: "full", mg: false, capT: -1 }],
  qa_stackB: ["9x16", { t: 7.3, layout: "stack", rig: "ots_B", u: 0.8, mgT: 3.4 }],
  qa_insert_9x16: ["9x16", { t: 4.0, shot: { rig: "insert_fire" }, u: 0.5, layout: "full", mg: false, capT: -1 }],
  qa_mcu_A_16x9: ["16x9", { t: 3.4, shot: { rig: "mcu_A" }, u: 0.5, layout: "full", mg: false }],
  qa_ots_B_16x9: ["16x9", { t: 6.8, shot: { rig: "ots_B" }, u: 0.5, layout: "full", mg: false, capT: -1 }],
};
const DELIV = ["hero_wide_16x9", "hero_wide_9x16", "hero_mcu_dadu_9x16", "hero_stack_9x16", "hero_split_16x9"];
const pages = {}; const getPage = async a => pages[a] ??= await open(...DIMS[a]);
async function stills(names) {
  for (const n of names) { let ent = STILLS[n]; const mt = /^t([0-9.]+)_(9x16|16x9)$/.exec(n); if (mt) ent = [mt[2], { t: +mt[1] }]; const [a, spec] = ent; const page = await getPage(a); const t0 = Date.now(); await page.evaluate(s => window.frame(s), spec); await shot(page, n + ".png"); console.log(`[still] ${n} ${((Date.now() - t0) / 1000).toFixed(1)} s`); }
}
async function gate() {
  const page = await getPage("9x16"); const t0 = Date.now(); const rows = await page.evaluate(() => window.gateRun(8, 30)); const info = await page.evaluate("window.worldInfo()");
  const TOL = 0.015; let worstSeat = 0, worstFoot = 0, worstPen = 0, fails = []; const lines = ["# contact gate: min thigh/hip-to-seat gap and min foot-to-ground gap, metres (positive = air, negative = penetration). tolerance +-0.015 m, every frame 0..8 s @30 fps",
    "# frame t dadu_seat dadu_foot rohan_seat rohan_foot  samples(dadu/rohan)"];
  for (const [i, t, ds, df, rs, rf, sd, sr, pd, pr, pdn, prn] of rows) { if (pd > TOL) fails.push(`frame ${i} dadu leg-in-seat penetration ${(pd * 100).toFixed(1)} cm (${pdn} verts)`); if (pr > TOL) fails.push(`frame ${i} rohan leg-in-seat penetration ${(pr * 100).toFixed(1)} cm (${prn} verts)`); worstPen = Math.max(worstPen, pd, pr); for (const [who, k, v] of [["dadu", "seat", ds], ["dadu", "foot", df], ["rohan", "seat", rs], ["rohan", "foot", rf]]) { if (!(Math.abs(v) <= TOL)) fails.push(`frame ${i} ${who} ${k} gap ${v}`); if (k === "seat") worstSeat = Math.max(worstSeat, Math.abs(v)); else worstFoot = Math.max(worstFoot, Math.abs(v)); }
    lines.push(`${i} ${t.toFixed(3)} ${ds.toFixed(4)} ${df.toFixed(4)} ${rs.toFixed(4)} ${rf.toFixed(4)} ${sd}/${sr} pen ${pd.toFixed(4)} ${pr.toFixed(4)}`); }
  lines.push(`# seats ${JSON.stringify(info.seats)}`); lines.push(`# debug ${JSON.stringify({ bb: info.bb, penAt: info.penAt, seatPos: info.seatPos, d: info.dY, r: info.rY })}`); lines.push(`# worst leg/hip/foot penetration into seat volume ${(worstPen * 100).toFixed(2)} cm (tolerance 1.5 cm)`); lines.push(`# worst |seat gap| ${(worstSeat * 100).toFixed(2)} cm, worst |foot gap| ${(worstFoot * 100).toFixed(2)} cm over ${rows.length} frames`);
  lines.push(fails.length ? `# RESULT: FAIL (${fails.length} violations), first: ${fails[0]}` : "# RESULT: PASS");
  fs.writeFileSync(path.join(OUT, "contact_gate.txt"), lines.join("\n") + "\n"); console.log(lines.slice(-3).join("\n"), `\n[gate] ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (fails.length) { console.error("CONTACT GATE FAILED:", fails.slice(0, 5)); process.exitCode = 1; }
}
async function video(a) {
  const [W, H] = DIMS[a]; const page = await getPage(a); const file = path.join(OUT, `test_8s_${a}.mp4`); const t0 = Date.now(); const N = 240;
  const ff = cp.spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", "30", "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "medium", "-r", "30", "-movflags", "+faststart", file], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < N; i++) {
    await page.evaluate(s => window.frame(s), { t: i / 30, gate: false }); const buf = await page.screenshot({ type: "jpeg", quality: 95 }); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
    if (i % 20 === 0) console.log(`  frame ${i}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end(); await new Promise(r => ff.on("close", r)); const sec = (Date.now() - t0) / 1000; console.log(`[video] ${a} ${sec.toFixed(0)} s render (${(sec / 8).toFixed(1)} s per video second)`);
  const tf = path.join(OUT, "render_time.json"); const tj = fs.existsSync(tf) ? JSON.parse(fs.readFileSync(tf, "utf8")) : {}; tj[a] = { seconds: +sec.toFixed(1), perVideoSecond: +(sec / 8).toFixed(2), frames: N }; fs.writeFileSync(tf, JSON.stringify(tj, null, 1));
}
try {
  if (job === "sheet") { const page = await browser.newPage(); await page.setViewport({ width: 800, height: 600 }); page.on("console", m => console.log("  [sheet]", m.text())); page.on("pageerror", e => console.log("  PAGEERROR", e.message)); await page.goto(`http://127.0.0.1:${port}/sheet.html`); await page.waitForFunction("window.__ready===true||window.__err", { timeout: 300000, polling: 300 }); const err = await page.evaluate("window.__err"); if (err) throw new Error(err); const d = await page.evaluate("window.__png"); fs.writeFileSync(path.join(OUT, "face_sheet.png"), Buffer.from(d.split(",")[1], "base64")); console.log("wrote face_sheet.png"); }
  else if (job === "probeface") { const page = await browser.newPage(); page.on("console", m => console.log("  ", m.text())); await page.goto(`http://127.0.0.1:${port}/sheet.html?m=/probe_face.js`); await page.waitForFunction("window.__pf||window.__err", { timeout: 120000 }); console.log(JSON.stringify(await page.evaluate("window.__pf"), null, 1)); }
  else if (job === "bench") { const page = await getPage("9x16"); console.log("GL:", await page.evaluate(() => { const c = document.createElement("canvas").getContext("webgl2"); const e = c.getExtension("WEBGL_debug_renderer_info"); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : "?"; })); await page.evaluate(s => window.frame(s), { t: 0 }); const t0 = Date.now(); for (let i = 0; i < 12; i++) { await page.evaluate(s => window.frame(s), { t: 1 + i / 30 }); await page.screenshot({ type: "jpeg", quality: 95 }); } console.log(`[bench] ${((Date.now() - t0) / 12000).toFixed(2)} s/frame (9x16 wide->mcu, full layout)`); }
  else if (job === "gate") await gate();
  else if (job === "stills") await stills(rest.length ? rest[0].split(",") : DELIV);
  else if (job === "video") await video(rest[0]);
  else if (job === "all") { await gate(); await stills(DELIV); await video("9x16"); await video("16x9"); }
  else console.log("jobs: gate | stills [names] | video 9x16|16x9 | all");
} catch (e) { console.error("FAILED", e.stack || e); process.exitCode = 1; }
await browser.close(); server.close();
