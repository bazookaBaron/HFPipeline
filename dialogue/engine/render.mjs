// DIALOGUE engine CLI. One command renders any set / rig / ratio / time.
//   node dialogue/engine/render.mjs still <set> <rig> <ratio> [t=3.4] [u=0.5] [pair=a,b|-] [out=name]   (rig: wide2|mcu_A|mcu_B|ots_A|ots_B|insert|seat_A|seat_B)
//   node dialogue/engine/render.mjs hero <set> [pair]       the 4 deliverable stills into out/<set>/
//   node dialogue/engine/render.mjs gate <set> [pair]       contact + penetration gate, 8 s @30 fps -> out/<set>/gate_<A>_<B>.txt
//   node dialogue/engine/render.mjs video <set> <ratio> [seconds=8] [pair]
//   node dialogue/engine/render.mjs bench <set> [pair]      s/frame
//   node dialogue/engine/render.mjs lineup                  out/cast_lineup.png
// Episodes (dialogue/episodes/<ep>/shots.json from dialogue/compiler/compile.mjs), 9:16:
//   node dialogue/engine/render.mjs epstill <ep> <t> [name]  one composited frame -> episodes/<ep>/out/<name>.png
//   node dialogue/engine/render.mjs epgate <ep>              engine-side gates -> episodes/<ep>/out/gates_engine.json (then node dialogue/compiler/gates.mjs <ep>)
//   node dialogue/engine/render.mjs sheet <ep>               contact sheet: every shot midpoint + CU gesture peaks -> episodes/<ep>/out/contact_9x16.png
//   node dialogue/engine/render.mjs epvideo <ep> [sec]       full 9:16 render, muxed with the episode audio, trimmed to the audio length -> episodes/<ep>/out/<ep>_9x16.mp4
// Run through the queue:  node runtime/jobq.js --kind render -- node dialogue/engine/render.mjs <job> ...   (env GL=sw for software GL)
import http from "http"; import fs from "fs"; import path from "path"; import cp from "child_process"; import { fileURLToPath } from "url"; import { createRequire } from "module";
const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(here, "../..");
const require = createRequire(path.join(REPO, "package.json")); const puppeteer = require("puppeteer-core");
const CHROME = "C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe";
const MOUNTS = { "/three/": path.join(REPO, "runtime/vendor/three/"), "/raw/": path.join(REPO, ".vendor-assets/dialogue/raw/"), "/spike1/": path.join(REPO, "dialogue/spike1/"), "/mg/": path.join(REPO, "dialogue/mg/"), "/episodes/": path.join(REPO, "dialogue/episodes/"), "/": here + "/" };
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".geojson": "application/json", ".png": "image/png", ".woff2": "font/woff2", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  if (u === "/three/jsm/curves/NURBSCurve.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end("export class NURBSCurve{constructor(){throw new Error(\"NURBS unsupported (stub)\")}}"); }
  for (const [pre, dir] of Object.entries(MOUNTS)) if (u.startsWith(pre)) { const f = path.join(dir, u.slice(pre.length)); if (path.relative(dir, f).startsWith("..")) break;
    if (fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }); return fs.createReadStream(f).pipe(res); } }
  if (!u.startsWith("/mg/") && !/^\/episodes\/[^/]+\/mg\.js$/.test(u)) console.log("  404", u); res.writeHead(404); res.end("nf");
});
await new Promise(r => server.listen(0, "127.0.0.1", r)); const port = server.address().port;
const [job, ...rest] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "shell", protocolTimeout: 3600000, args: (process.env.GL !== "sw" ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-webgl", "--no-sandbox", "--allow-file-access-from-files"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox", "--allow-file-access-from-files"]) });
const DISP = { dadu: "walter", rohan: "leo", arjun: "ben", meera: "nora" }; const dn = id => DISP[id] ?? id;
const DIMS = { "9x16": [1080, 1920], "16x9": [1920, 1080] };
const pages = {};
async function open(set, ratio, pair, extra = "") {
  const k = [set, ratio, pair ?? "", extra].join("|"); if (pages[k]) return pages[k]; const [w, h] = DIMS[ratio];
  const page = await browser.newPage(); await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  page.on("console", m => console.log(`  [${set} ${ratio}]`, m.text())); page.on("pageerror", e => console.log("  PAGEERROR", e.message));
  const t0 = Date.now(); await page.goto(`http://127.0.0.1:${port}/index.html?w=${w}&h=${h}&set=${set}${pair ? "&pair=" + pair : ""}${extra}`);
  await page.waitForFunction("window.__ready===true||window.__err", { timeout: 1200000, polling: 500 }); const err = await page.evaluate("window.__err"); if (err) throw new Error(err);
  await page.evaluate("document.fonts.ready.then(()=>1)"); console.log(`  page ready ${((Date.now() - t0) / 1000).toFixed(1)} s`); return (pages[k] = page);
}
const outDir = set => { const d = path.join(here, "out", set); fs.mkdirSync(d, { recursive: true }); return d; };
async function still(set, rig, ratio, { t = 3.4, u = 0.5, pair = null, out = null, caption = true, extra = "" } = {}) {
  const page = await open(set, ratio, pair, extra); const t0 = Date.now(); const name = out ?? `${rig}_${ratio}`; if (process.env.PRE) console.log("PRE ->", JSON.stringify(await page.evaluate(process.env.PRE)));
  await page.evaluate(s => window.frame(s), { t, shot: { rig }, u, layout: "full", mg: false, capT: caption ? undefined : -1 });
  const fr = await page.evaluate("window.framing()"); fr.cityFrac = await page.evaluate("window.cityFrac()"); const bad = []; const f2 = x => +x.toFixed(3);
  const inside = (b, m = 0.06) => b.x0 >= m && b.x1 <= 1 - m && b.y0 >= 0.02 && b.y1 <= 1 - 0.02;
  if (rig === "wide2") { if (!inside(fr.A)) bad.push("A not inside frame with 6% margin"); if (!inside(fr.B)) bad.push("B not inside frame with 6% margin"); if (ratio === "9x16") { if (fr.union.w < 0.55) bad.push("9x16 pair width " + f2(fr.union.w) + " < 0.55"); if (fr.peakY < 0.30 || fr.peakY > 0.40) bad.push("9x16 peaks at " + f2(fr.peakY) + " not in 0.30-0.40"); } else if (Math.abs(fr.union.cx - 0.5) > 0.15) bad.push("16x9 pair centre " + f2(fr.union.cx) + " off by > 0.15"); if (fr.cityFrac < (ratio === "9x16" ? 0.20 : 0.15)) bad.push("city lit-area fraction " + f2(fr.cityFrac) + " below " + (ratio === "9x16" ? 0.20 : 0.15)); }
  if (rig.startsWith("ots")) { if (fr.treeFrac > 0.25) bad.push("OTS tree fraction " + f2(fr.treeFrac) + " > 0.25"); if (fr.farFrac < 0.15) bad.push("OTS valley/peaks fraction " + f2(fr.farFrac) + " < 0.15"); }
  console.log("[framing]", name, JSON.stringify({ A: [f2(fr.A.x0), f2(fr.A.x1)], B: [f2(fr.B.x0), f2(fr.B.x1)], unionW: f2(fr.union.w), cx: f2(fr.union.cx), peakY: f2(fr.peakY), treeFrac: f2(fr.treeFrac), farFrac: f2(fr.farFrac), cityFrac: f2(fr.cityFrac) }), bad.length ? "FAIL: " + bad.join("; ") : "OK");
  const fname = bad.length && /^(hero|ots|wide)/.test(name) ? name + "_FAILED" : name; if (bad.length) { console.error("FRAMING FAIL", name, bad); process.exitCode = 1; }
  await page.screenshot({ path: path.join(outDir(set), fname + ".png"), type: "png" }); console.log(`[still] ${set}/${name} ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
async function hero(set, pair) {
  const info = await (await open(set, "9x16", pair)).evaluate("window.worldInfo()"); const aId = info.pair[0];
  await still(set, "wide2", "16x9", { t: 3.0, u: 0.5, pair, out: "hero_wide_16x9", caption: false });
  await still(set, "wide2", "9x16", { t: 3.0, u: 0.5, pair, out: "hero_wide_9x16", caption: false });
  await still(set, "mcu_A", "9x16", { t: 3.4, pair, out: `hero_mcu_${dn(aId)}_9x16` });
  await still(set, "ots_A", "16x9", { t: 3.4, pair, out: "hero_ots_16x9", caption: false });
}
async function gate(set, pair) {
  const page = await open(set, "9x16", pair, "&rigs=wide2"); const t0 = Date.now(); const rows = await page.evaluate(() => window.gateRun(8, 30)); const info = await page.evaluate("window.worldInfo()");
  const [ia, ib] = info.pair.map(dn); const TOL = 0.015; let worstSeat = 0, worstFoot = 0, worstPen = 0, fails = [];
  const lines = [`# contact + penetration gate, set ${set}, pair ${ia}(A) + ${ib}(B). min thigh/hip-to-seat gap and min foot-to-ground gap, metres (positive = air, negative = penetration), tolerance +-0.015 m, every frame 0..8 s @ 30 fps`, `# frame t ${ia}_seat ${ia}_foot ${ib}_seat ${ib}_foot samples(A/B) pen(A B)`];
  for (const [i, t, as, af, bs, bf, sa, sb, pa, pb, pan, pbn] of rows) {
    if (pa > TOL) fails.push(`frame ${i} ${ia} leg-in-seat penetration ${(pa * 100).toFixed(1)} cm (${pan} verts)`); if (pb > TOL) fails.push(`frame ${i} ${ib} leg-in-seat penetration ${(pb * 100).toFixed(1)} cm (${pbn} verts)`); worstPen = Math.max(worstPen, pa, pb);
    for (const [who, k, v] of [[ia, "seat", as], [ia, "foot", af], [ib, "seat", bs], [ib, "foot", bf]]) { if (!(Math.abs(v) <= TOL)) fails.push(`frame ${i} ${who} ${k} gap ${v}`); if (k === "seat") worstSeat = Math.max(worstSeat, Math.abs(v)); else worstFoot = Math.max(worstFoot, Math.abs(v)); }
    lines.push(`${i} ${t.toFixed(3)} ${as.toFixed(4)} ${af.toFixed(4)} ${bs.toFixed(4)} ${bf.toFixed(4)} ${sa}/${sb} pen ${pa.toFixed(4)} ${pb.toFixed(4)}`);
  }
  lines.push(`# seats ${JSON.stringify(info.seats)}`); lines.push(`# fit notes ${JSON.stringify(info.notes)}`);
  lines.push(`# worst leg/hip/foot penetration into seat volume ${(worstPen * 100).toFixed(2)} cm (tolerance 1.5 cm)`); lines.push(`# worst |seat gap| ${(worstSeat * 100).toFixed(2)} cm, worst |foot gap| ${(worstFoot * 100).toFixed(2)} cm over ${rows.length} frames`);
  lines.push(fails.length ? `# RESULT: FAIL (${fails.length} violations), first: ${fails[0]}` : "# RESULT: PASS");
  const f = path.join(outDir(set), `gate_${ia}_${ib}.txt`); fs.writeFileSync(f, lines.join("\n") + "\n"); console.log(lines.slice(-3).join("\n"), `\n[gate] ${set} ${ia}+${ib} ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${path.basename(f)}`);
  if (fails.length) { console.error("GATE FAILED:", fails.slice(0, 5)); process.exitCode = 1; }
}
async function video(set, ratio, sec = 8, pair = null) {
  const page = await open(set, ratio, pair); const file = path.join(outDir(set), `test_${sec}s_${ratio}.mp4`); const t0 = Date.now(); const N = Math.round(sec * 30);
  const ff = cp.spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", "30", "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "medium", "-r", "30", "-movflags", "+faststart", file], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < N; i++) { await page.evaluate(s => window.frame(s), { t: i / 30 }); const buf = await page.screenshot({ type: "jpeg", quality: 95 }); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r)); if (i % 30 === 0) console.log(`  frame ${i}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)} s`); }
  ff.stdin.end(); await new Promise(r => ff.on("close", r)); const s = (Date.now() - t0) / 1000; console.log(`[video] ${set} ${ratio} ${s.toFixed(0)} s render (${(s / sec).toFixed(1)} s per video second)`);
  const tf = path.join(outDir(set), "render_time.json"); const tj = fs.existsSync(tf) ? JSON.parse(fs.readFileSync(tf, "utf8")) : {}; tj[`video_${ratio}`] = { seconds: +s.toFixed(1), perVideoSecond: +(s / sec).toFixed(2), frames: N }; fs.writeFileSync(tf, JSON.stringify(tj, null, 1));
}
async function bench(set, pair) {
  const tf = path.join(outDir(set), "render_time.json"); const tj = fs.existsSync(tf) ? JSON.parse(fs.readFileSync(tf, "utf8")) : {};
  for (const ratio of ["9x16", "16x9"]) { const t0 = Date.now(); const page = await open(set, ratio, pair); const load = (Date.now() - t0) / 1000; await page.evaluate(s => window.frame(s), { t: 0 }); const t1 = Date.now(); for (let i = 0; i < 12; i++) { await page.evaluate(s => window.frame(s), { t: 1 + i / 30 }); await page.screenshot({ type: "jpeg", quality: 95 }); } const per = (Date.now() - t1) / 12000; tj[`bench_${ratio}`] = { pageLoadSeconds: +load.toFixed(1), secondsPerFrame: +per.toFixed(2) }; console.log(`[bench] ${set} ${ratio}: load ${load.toFixed(1)} s, ${per.toFixed(2)} s/frame`); }
  fs.writeFileSync(tf, JSON.stringify(tj, null, 1));
}
async function lineup() {
  const page = await browser.newPage(); await page.setViewport({ width: 800, height: 600 }); page.on("console", m => console.log("  [lineup]", m.text())); page.on("pageerror", e => console.log("  PAGEERROR", e.message));
  await page.goto(`http://127.0.0.1:${port}/lineup.html`); await page.waitForFunction("window.__ready===true||window.__err", { timeout: 300000, polling: 300 }); const err = await page.evaluate("window.__err"); if (err) throw new Error(err);
  const d = await page.evaluate("window.__png"); fs.mkdirSync(path.join(here, "out"), { recursive: true }); fs.writeFileSync(path.join(here, "out", "cast_lineup.png"), Buffer.from(d.split(",")[1], "base64")); console.log("wrote out/cast_lineup.png");
}
// ---------------- episodes ----------------
const epDir = ep => { const d = path.join(REPO, "dialogue/episodes", ep, "out"); fs.mkdirSync(d, { recursive: true }); return d; };
const epJSON = ep => JSON.parse(fs.readFileSync(path.join(REPO, "dialogue/episodes", ep, "shots.json"), "utf8"));
async function epPage(ep, extra = "") { const E = epJSON(ep); return open(E.set, E.ratio ?? "9x16", null, "&ep=" + ep + extra); }
async function epstill(ep, t, name) { const page = await epPage(ep); if (process.env.PRE) await page.evaluate(process.env.PRE); const t0 = Date.now(); await page.evaluate(s => window.frame(s), { t }); const last = await page.evaluate("window.__last"); last.metrics = await page.evaluate("(()=>{const f=window.framing();const r=x=>+x.toFixed(3);return {clip250:r(window.lumaClip()),A:[r(f.A.x0),r(f.A.x1)],B:{h:r(f.B.y1-f.B.y0),top:r(f.B.y0)}}})()"); const f = path.join(epDir(ep), (name ?? `t${t.toFixed(2)}`) + ".png"); await page.screenshot({ path: f, type: "png" }); const sec = (Date.now() - t0) / 1000; console.log(`[epstill] ${ep} t=${t} ${JSON.stringify(last)} ${sec.toFixed(2)} s -> ${path.basename(f)}`); return { f, sec, last }; }
async function epgate(ep) {
  const page = await epPage(ep, "&rigs=wide2"); const t0 = Date.now(); const g = await page.evaluate(() => window.epGate(0.25)); const caps = await page.evaluate(() => window.capCheck()); const lint = await page.evaluate(() => window.mgLint());
  const f = path.join(epDir(ep), "gates_engine.json"); fs.writeFileSync(f, JSON.stringify({ when: new Date().toISOString(), ...g, caps, lint }, null, 0)); console.log(`[epgate] ${ep} ${g.rows.length} samples, ${caps.length} captions, ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${path.basename(f)}`);
}
async function sheet(ep) {
  const E = epJSON(ep); const tiles = [];
  for (const s of E.shots) { const t = +((s.t0 + s.t1) / 2).toFixed(2); tiles.push({ t, s, tag: "mid" }); }
  for (const s of E.shots.filter(x => x.cu)) { const subj = s.subject; const gs = E.gestures.filter(g => g.actor === subj && g.t >= s.t0 && g.t < s.t1 && !/^lean/.test(g.kind)); const pts = gs.length ? gs.map(g => ({ t: +(g.t + Math.min(0.25, g.dur / 2)).toFixed(2), why: g.kind })) : E.emotion[subj].filter(e => e[0] >= s.t0 - 0.2 && e[0] < s.t1).map(e => ({ t: +Math.min(s.t1 - 0.05, e[0] + 0.55).toFixed(2), why: "face " + e[1] }));
    for (const p of pts) tiles.push({ t: p.t, s, tag: "peak " + p.why }); }
  const presetAt = (tl, t) => { let i = 0; while (i + 1 < tl.length && tl[i + 1][0] <= t) i++; return tl[i][1] + (tl[i][2] != null && tl[i][2] !== 1 ? "." + Math.round(tl[i][2] * 100) : ""); };
  const times = []; const dir = path.join(epDir(ep), "sheet"); fs.mkdirSync(dir, { recursive: true });
  for (const [i, x] of tiles.entries()) { const r = await epstill(ep, x.t, path.join("sheet", `tile_${String(i).padStart(2, "0")}`)); times.push(r.sec); const subj = x.s.subject ?? "B"; x.label = `#${x.s.n} t=${x.t.toFixed(2)} ${r.last.rig}${r.last.layout === "stack" ? " (stack)" : ""} ${x.s.move.type}${x.s.move.amt ? " " + Math.round(x.s.move.amt * 100) + "%" : ""} | ${subj === "A" ? "Walter" : "Leo"}: ${presetAt(E.emotion[subj], x.t)}${x.tag !== "mid" ? " | " + x.tag : ""}`; x.file = path.basename(r.f); }
  const cols = 6, tw = 300, th = Math.round(tw * 16 / 9); const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#0b0f14;font:600 13px/1.25 Geist,Arial,sans-serif;color:#EFE6D4}#g{display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:10px;padding:12px;width:${cols * tw + (cols - 1) * 10}px}.c img{width:${tw}px;height:${th}px;display:block}.c div{padding:4px 2px 0;height:34px}.h{padding:12px 12px 0;font-size:18px}</style><div class="h">${ep} 9:16 contact sheet: ${tiles.length} stills (22 shot midpoints + CU gesture/face peaks). Engine still, MG ${fs.existsSync(path.join(REPO, "dialogue/episodes", ep, "mg.js")) ? "on" : "absent (mg.js not written yet)"}.</div><div id="g">${tiles.map(x => `<div class="c"><img src="/episodes/${ep}/out/sheet/${x.file}"><div>${x.label}</div></div>`).join("")}</div>`;
  fs.writeFileSync(path.join(dir, "sheet.html"), html); const p = await browser.newPage(); await p.setViewport({ width: cols * tw + (cols - 1) * 10 + 24, height: 800 }); await p.goto(`http://127.0.0.1:${port}/episodes/${ep}/out/sheet/sheet.html`); await p.evaluate("Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>i.onload=r)))");
  const out = path.join(epDir(ep), "contact_9x16.png"); await p.screenshot({ path: out, fullPage: true }); const avg = times.reduce((a, b) => a + b, 0) / times.length;
  fs.writeFileSync(path.join(epDir(ep), "sheet_index.json"), JSON.stringify({ tiles: tiles.map(x => ({ label: x.label, file: x.file })), secondsPerStill: +avg.toFixed(2) }, null, 1)); console.log(`[sheet] ${tiles.length} tiles, ${avg.toFixed(2)} s per still -> ${path.relative(REPO, out)}`);
}
async function epvideo(ep, sec = null) {
  const E = epJSON(ep); const page = await epPage(ep); const audio = path.join(REPO, E.audio); const adur = +cp.execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", audio]).toString().trim();
  const dur = sec ?? adur; const N = Math.round(dur * 30); const silent = path.join(epDir(ep), `${ep}_9x16_silent.mp4`), file = path.join(epDir(ep), sec ? `${ep}_9x16_test${sec}s.mp4` : `${ep}_9x16.mp4`); const t0 = Date.now();
  const ff = cp.spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", "30", "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "medium", "-r", "30", silent], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < N; i++) { await page.evaluate(s => window.frame(s), { t: i / 30 }); const buf = await page.screenshot({ type: "jpeg", quality: 95 }); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r)); if (i % 60 === 0) console.log(`  frame ${i}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)} s`); }
  ff.stdin.end(); await new Promise(r => ff.on("close", r));
  cp.execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", String(Math.min(dur, adur)), "-movflags", "+faststart", file]); fs.unlinkSync(silent);
  if (process.env.KEEP_ASSETS !== "1") { const { clean } = createRequire(import.meta.url)(path.join(REPO, "runtime/cleanup_run.js")); clean(epDir(ep), false); }
  const s2 = (Date.now() - t0) / 1000; console.log(`[epvideo] ${ep} ${N} frames, ${s2.toFixed(0)} s (${(s2 / dur).toFixed(1)} s per video second) -> ${path.relative(REPO, file)}`);
}
try {
  if (job === "epstill") await epstill(rest[0], +rest[1], rest[2]);
  else if (job === "epgate") await epgate(rest[0]);
  else if (job === "epeval") { const page = await epPage(rest[0], "&rigs=wide2"); const code = fs.existsSync(rest[1]) ? fs.readFileSync(rest[1], "utf8") : rest[1]; console.log(JSON.stringify(await page.evaluate(code), null, 1)); }
  else if (job === "sheet") await sheet(rest[0]);
  else if (job === "rigstills") { // rigstills <ep> <t> <rig,rig,..> [u=0.5]: one browser, one still per rig (episodes/<ep>/out/rs_<rig>.png) + blown-white fraction (clip250) + rig table
    const [ep, t, rigs, u] = rest; const E = epJSON(ep); const set = E.set, ratio = E.ratio ?? "9x16"; const page = await epPage(ep, "&rigs=wide2"); const T = await page.evaluate("window.rigTable()"); const f = path.join(REPO, "dialogue/compiler", `rig_angles_${set}_${ratio}.json`); fs.writeFileSync(f, JSON.stringify(T, null, 1));
    for (const rig of rigs.split(",")) { await page.evaluate(s => window.frame(s), { t: +t, shot: { rig, move: { type: "hold" } }, u: u ? +u : 0.5, layout: "full", capT: -1 }); const clip = await page.evaluate("window.lumaClip(250)"); console.log(`[rigstills] ${rig} clip250 ${(clip * 100).toFixed(3)} %`); await page.screenshot({ path: path.join(epDir(ep), `rs_${rig}.png`), type: "png" }); } }
  else if (job === "rigdump") { const page = await open(rest[0] || "campfire", rest[1] || "9x16", null, "&rigs=wide2"); const T = await page.evaluate("window.rigTable()"); const f = path.join(REPO, "dialogue/compiler", `rig_angles_${rest[0] || "campfire"}_${rest[1] || "9x16"}.json`); fs.writeFileSync(f, JSON.stringify(T, null, 1)); console.log("[rigdump] ->", path.relative(REPO, f)); }
  else if (job === "epvideo") await epvideo(rest[0], rest[1] ? +rest[1] : null);
  else if (job === "still") { const [set, rig, ratio, t, u, pair, out] = rest; await still(set, rig, ratio, { t: t ? +t : 3.4, u: u ? +u : 0.5, pair: pair && pair !== "-" ? pair : null, out }); }
  else if (job === "hero") await hero(rest[0], rest[1]);
  else if (job === "gate") await gate(rest[0], rest[1]);
  else if (job === "video") await video(rest[0], rest[1], rest[2] ? +rest[2] : 8, rest[3] ?? null);
  else if (job === "bench") await bench(rest[0], rest[1]);
  else if (job === "lineup") await lineup();
  else if (job === "eval") { const [set, code, pair] = rest; const page = await open(set, "9x16", pair && pair !== "-" ? pair : null, "&rigs=wide2"); console.log(JSON.stringify(await page.evaluate(code), null, 1)); }
  else console.log("jobs: still | hero | gate | video | bench | lineup  (see header)");
} catch (e) { console.error("FAILED", e.stack || e); process.exitCode = 1; }
await browser.close(); server.close();
