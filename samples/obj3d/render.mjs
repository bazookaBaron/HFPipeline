#!/usr/bin/env node
// samples/obj3d/render.mjs - driver for the miniature film page (film.html, or any samples/obj3d/<page>.html that exports window.renderAt / __info).
// Rebuilt 2026-11-22 from the 2026-11-15 version (puppeteer-core + static server + per-frame window.renderAt(t) -> jpg frames -> ffmpeg).
//
//   QS="ar=16x9&film=<film>[&channel=<ch>]" [VW=1920 VH=1080] [FROM=<s> TO=<s>] [GL=sw] node samples/obj3d/render.mjs <mode> film ...
//
//   shots  film                run every v3 gate (window.checkSizes) + photo coverage; writes out/<film>_169_gates.json and 24 shot stills out/<film>_169_sNN.jpg
//                              prints "V3 GATES PASS|FAIL: <paths>"; exit 0 either way (read the line / the json); video refuses to run on a failing or stale record
//   lines  film <film>         narration/subjects gate (LINE GATE PASS|FAIL), one still per line out/<film>_169_lineNN.jpg, rewrites lines.json `shows`,
//                              writes cues.json + beds.json (page-exported sound) and linecheck_169.json. Exit 1 on fail
//   still  film <t,t,..>       stills at the given times -> out/<film>_169_t<t>.jpg
//   sheet  film [shots|lines|auto [N]] [cols]   contact sheet (ffmpeg tile of the shot stills / line stills / N evenly spaced fresh stills) -> out/<film>_169_sheet[_lines|_auto].jpg
//   keys   film                camera key-list check only (delegates to keycheck.mjs; no solver, no frames)
//   video  film [fps=30]       frame-by-frame capture of window.renderAt(i/fps) -> out/frames_<film>_169/NNNNN.jpg -> ffmpeg x264 crf16 -> out/<film>_169.mp4
//                              env FROM / TO (seconds) render a range to out/<film>_169_from<frame>.mp4 (frames renumbered from 0); QS channel=<ch> suffixes every output _<ch>
//   bench  film                page load time + seconds per frame over 12 frames -> out/time_<film>_169_bench.json
//   (legacy) video|still|shots <page> ...   page name instead of `film` (e.g. malacca) for the old single-film pages
//
// Run heavy modes through the queue:  node runtime/jobq.js --kind snap|render --prio 1 -- "node samples/obj3d/render.mjs shots film"
// Output name = film id (QS film=<id>); `_169` when QS has ar=16x9 (the 16:9 films; 9:16 has no suffix).
import http from "http"; import fs from "fs"; import path from "path"; import cp from "child_process"; import { fileURLToPath } from "url"; import { createRequire } from "module";
const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(here, "../..");
const argv = process.argv.slice(2), [mode, plate, a3, a4] = argv;
const MODES = ["shots", "lines", "still", "sheet", "keys", "video", "bench"];
if (!mode || mode === "--help" || mode === "-h" || mode === "help") { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter(l => l.startsWith("//")).map(l => l.slice(3)).join("\n")); process.exit(mode ? 0 : 2); }
if (!MODES.includes(mode)) { console.error(`unknown mode "${mode}" (modes: ${MODES.join(" | ")}; --help)`); process.exit(2); }
const QS = process.env.QS || "", SUF = /(^|&)ar=16x9/.test(QS) ? "_169" : "";
const FILMQ = (QS.match(/(?:^|&)film=([^&]+)/) || [])[1];   // output name: the film id, so parallel films never overwrite each other's mp4 / frames / stills
const CHANQ = (QS.match(/(?:^|&)channel=([^&]+)/) || [])[1];   // channel variant (variants.py): outputs get _<channel> so they never overwrite the main film
const FILM = FILMQ ? decodeURIComponent(FILMQ) : null;
const NAME = (plate === "film" && FILM ? FILM : plate).replace(/[\\/]/g, "_") + (CHANQ ? "_" + decodeURIComponent(CHANQ) : "");
const OUT = path.join(here, "out"); fs.mkdirSync(OUT, { recursive: true });
const filmDir = f => path.join(here, "films", f), sh = (cmd, args) => cp.execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] }).toString();
if (!plate) { console.error(`mode ${mode} needs a page: "film" (with QS film=<id>) or a page name`); process.exit(2); }
if (plate === "film" && !FILM) { console.error('page "film" needs QS film=<id>, e.g.  QS="ar=16x9&film=trump_v4"'); process.exit(2); }

// ---- modes that need no browser ----
if (mode === "keys") {
  if (!FILM) { console.error("keys needs QS film=<id>"); process.exit(2); }
  const r = cp.spawnSync(process.execPath, [path.join(here, "keycheck.mjs"), FILM, ...(SUF ? ["ar=16x9"] : ["square"])], { stdio: "inherit" }); process.exit(r.status ?? 1);
}
function tile(pattern, out, cols, count) {
  const rows = Math.ceil(count / cols); sh("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-start_number", "1", "-i", pattern, "-vf", `scale=640:-1,tile=${cols}x${rows}`, "-frames:v", "1", "-q:v", "3", out]); console.log("wrote", out, `(${count} tiles, ${cols}x${rows})`); }
if (mode === "sheet" && a3 !== "auto") {
  const kind = a3 === "lines" ? "lines" : "shots", cols = +(a4 || 4), base = `${NAME}${SUF}`;
  const files = fs.readdirSync(OUT).filter(f => f.startsWith(base + (kind === "lines" ? "_line" : "_s")) && /\.jpg$/.test(f) && (kind === "lines" ? /_line\d+\.jpg$/ : /_s\d+\.jpg$/).test(f)).sort();
  if (!files.length) { console.error(`no ${kind} stills for ${base} in out/ (run: render.mjs ${kind === "lines" ? "lines film " + FILM : "shots film"})`); process.exit(1); }
  // ffmpeg's sequence reader needs gap-free numbering: link into a temp dir
  const tmp = path.join(OUT, `_sheet_${base}`); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp);
  files.forEach((f, i) => fs.copyFileSync(path.join(OUT, f), path.join(tmp, String(i + 1).padStart(3, "0") + ".jpg")));
  tile(path.join(tmp, "%03d.jpg"), path.join(OUT, `${base}_sheet${kind === "lines" ? "_lines" : ""}.jpg`), cols, files.length); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(0);
}

// ---- static server: /three/ -> runtime/vendor/three, /data/ -> geo data, /post/ -> SimplexNoise shim, everything else -> samples/obj3d (films/, sets/, mg2d/, ...) ----
const MOUNTS = { "/three/": [path.join(REPO, "runtime/vendor/three/")],
  "/data/": [path.join(here, "data/"), path.join(REPO, "runtime/geo/"), path.join(REPO, ".vendor-assets/geo/"), path.join(REPO, ".vendor-assets/data/")],
  "/post/": [path.join(here, "post/"), path.join(REPO, "runtime/vendor/three/jsm/math/")], "/": [here + "/"] };
const MIME = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".geojson": "application/json", ".gltf": "model/gltf+json", ".bin": "application/octet-stream", ".f32": "application/octet-stream", ".glb": "model/gltf-binary", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
// film.html's importmap points three's SimplexNoise at /post/SimplexNoise.js (GTAOPass noise texture); the vendored three has no jsm/math, so serve a small shim when no real file exists
const SIMPLEX = `export class SimplexNoise{constructor(r=Math){this.grad3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];this.p=[];for(let i=0;i<256;i++)this.p[i]=Math.floor(r.random()*256);this.perm=[];for(let i=0;i<512;i++)this.perm[i]=this.p[i&255];}
dot(g,x,y){return g[0]*x+g[1]*y;} dot3(g,x,y,z){return g[0]*x+g[1]*y+g[2]*z;}
noise(xin,yin){const F2=.5*(Math.sqrt(3)-1),G2=(3-Math.sqrt(3))/6,s=(xin+yin)*F2,i=Math.floor(xin+s),j=Math.floor(yin+s),t=(i+j)*G2,x0=xin-(i-t),y0=yin-(j-t);let i1,j1;if(x0>y0){i1=1;j1=0}else{i1=0;j1=1}
const x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2,ii=i&255,jj=j&255,gi0=this.perm[ii+this.perm[jj]]%12,gi1=this.perm[ii+i1+this.perm[jj+j1]]%12,gi2=this.perm[ii+1+this.perm[jj+1]]%12;
let n0=0,n1=0,n2=0,t0=.5-x0*x0-y0*y0;if(t0>=0){t0*=t0;n0=t0*t0*this.dot(this.grad3[gi0],x0,y0)}let t1=.5-x1*x1-y1*y1;if(t1>=0){t1*=t1;n1=t1*t1*this.dot(this.grad3[gi1],x1,y1)}let t2=.5-x2*x2-y2*y2;if(t2>=0){t2*=t2;n2=t2*t2*this.dot(this.grad3[gi2],x2,y2)}return 70*(n0+n1+n2);}
noise3d(x,y,z){return this.noise(x+z*.37,y-z*.61);}}`;
const NURBS_STUB = 'export class NURBSCurve{constructor(){throw new Error("NURBS unsupported (stub)")}}';
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]), m = Object.keys(MOUNTS).sort((a, b) => b.length - a.length).find(k => u.startsWith(k));
  for (const dir of MOUNTS[m] || []) { const f = path.join(dir, u.slice(m.length)); if (path.relative(dir, f).startsWith("..")) continue;
    if (fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }); return fs.createReadStream(f).pipe(res); } }
  if (u === "/post/SimplexNoise.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(SIMPLEX); }
  if (u === "/three/jsm/curves/NURBSCurve.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(NURBS_STUB); }
  if (!/favicon/.test(u)) console.log("[page] 404", u); res.writeHead(404); res.end("nf");
});
await new Promise(r => server.listen(0, "127.0.0.1", r)); const port = server.address().port;
const puppeteer = createRequire(path.join(REPO, "package.json"))("puppeteer-core");
const CHROME = process.env.CHROME || "C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe";
if (!fs.existsSync(CHROME)) { console.error("chrome-headless-shell not found: " + CHROME + " (set CHROME=...)"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "shell", protocolTimeout: 3600000,
  args: process.env.GL === "sw" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] : ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-webgl", "--no-sandbox"] });
const page = await browser.newPage(); await page.setViewport({ width: +(process.env.VW || 1920), height: +(process.env.VH || 1080) });
page.on("console", m => console.log("[page]", m.text())); page.on("pageerror", e => console.log("PAGEERROR", e.message));
const quit = async code => { await browser.close().catch(() => {}); server.close(); process.exit(code); };
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/${plate}.html${QS ? "?" + QS : ""}`);
await page.waitForFunction("window.__ready===true||window.__err", { timeout: 900000, polling: 500 }).catch(async e => { console.log("PAGE NOT READY: " + e.message); await quit(1); });
const perr = await page.evaluate("window.__err || null"); if (perr) { console.log("PAGE ERROR: " + perr); await quit(1); }
const INFO = await page.evaluate("window.__info"); console.log("load", ((Date.now() - t0) / 1000).toFixed(1) + "s", JSON.stringify(INFO));
const shot = async (t, file) => { await page.evaluate(`window.renderAt(${t})`); const b64 = await page.evaluate(`document.querySelector("canvas").toDataURL("image/jpeg",0.95).split(",")[1]`); fs.writeFileSync(file, Buffer.from(b64, "base64")); };
// v3 gate record: shots mode writes out/<name>_gates.json; video mode of a PLAN.v3 film refuses to render unless that record passes and is newer
// than plan.json / lines.json / entities / photos / film.html (no render until every gate passes; films without PLAN.v3 are unchanged)
const GATEF = path.join(OUT, `${NAME}${SUF}_gates.json`), failPaths = (o, p = "") => { const out = []; if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (k === "pass" && v === false) out.push(p || "(root)"); else if (v && typeof v === "object" && !Array.isArray(v)) out.push(...failPaths(v, p ? p + "." + k : k)); } return out; };
const photoContentMissing = f => { try { const pj = JSON.parse(fs.readFileSync(path.join(filmDir(f), "photos.json"), "utf8")); return Object.entries(pj).filter(([, v]) => !/^ok\b/i.test(String(v?.contentCheck || ""))).map(([k]) => k); } catch { return []; } };

if (mode === "shots") {
  const cs = await page.evaluate("window.checkSizes ? window.checkSizes() : null"); console.log("figure height / frame per shot:", JSON.stringify(cs));
  if (cs && cs.v3) { const fails = failPaths(cs).concat(cs.solve && cs.solve.stillBad ? ["solve.stillBad"] : []);
    // photo coverage (photocheck.mjs, MINIATURE-LESSONS 16): enforced once the producer wrote films/<film>/entities.json; films without it only get a warning
    let pc = null; if (plate === "film" && FILM) { pc = (await import("./photocheck.mjs")).photoCoverage(FILM);
      console.log(`photo coverage: ${pc.cards} cards, ${pc.cardsPerMin}/min` + (pc.skipped ? " - WARNING: no entities.json, coverage not checked" : pc.pass ? " - PASS" : " - FAIL: " + pc.fails.join("; ")));
      const cm = pc.contentMissing || photoContentMissing(FILM); if (cm.length) { console.log("photo content check missing: " + cm.join(", ")); fails.push("photoContent"); }   // content filter: enforced for every film with photos.json
      if (!pc.skipped && !pc.pass) fails.push("photoCoverage"); }
    fs.writeFileSync(GATEF, JSON.stringify({ at: Date.now(), pass: !fails.length, fails, v3: cs.v3, photoCoverage: pc, speed: cs.speed, variety: cs.variety, maxFig: cs.maxFig, solve: cs.solve }, null, 1));
    console.log(fails.length ? "V3 GATES FAIL: " + fails.join(", ") : "V3 GATES PASS (enforced=" + cs.v3.enforced + ")"); }
  else console.log("no v3 gates on this plan (PLAN.v3 not set): record not written");
  const n = INFO.shots || 24, TT = INFO.T || 40, L = TT / n;
  for (let i = 0; i < n; i++) await shot((i + 0.5) * L, path.join(OUT, `${NAME}${SUF}_s${String(i + 1).padStart(2, "0")}.jpg`));
  console.log("wrote", n, "shot stills");
} else if (mode === "lines") {
  // narration-picture gate: each line's [shows:] subject must be readable >= 60% of its spoken span; still per line for review
  const filmId = a3 || FILM; if (!filmId) { console.error("lines needs a film id: render.mjs lines film <film>"); await quit(2); }
  const LF = path.join(filmDir(filmId), "lines.json"), LN = JSON.parse(fs.readFileSync(CHANQ ? path.join(filmDir(filmId), "variants", decodeURIComponent(CHANQ), "lines.json") : LF, "utf8")); const rep = []; let fails = 0;
  const PS = await page.evaluate("window.__lineSubjects || null");   // plan-driven pages (film.html) declare each line's subject; keep lines.json in sync
  if (PS && !CHANQ) { for (const l of LN) { const q = PS.find(x => x.n === l.n); if (q) l.shows = q.shows; } fs.writeFileSync(LF, JSON.stringify(LN, null, 1)); }
  else if (PS) for (const l of LN) { const q = PS.find(x => x.n === l.n); if (q) l.shows = q.shows; }
  const known = await page.evaluate("window.subjectNames ? window.subjectNames() : null"); if (!known) throw new Error("page has no subjects registry (subjects.js)");
  for (const l of LN) { const r = { n: l.n, text: l.text, shows: l.shows, start: l.start, end: l.end };
    if (!l.shows || !l.shows.length) { r.pass = false; r.why = "line declares no [shows:]"; }
    else { let ok = 0, k = 0; const why = {};
      for (let t = l.start; t <= l.end + 1e-6; t += 0.1, k++) { const m = await page.evaluate(`window.subjectsAt(${t}, ${JSON.stringify(l.shows)})`);
        if (l.shows.some(s => m[s] && m[s].shown)) ok++; else for (const s of l.shows) { const w = s + ":" + (m[s] ? m[s].why : "unknown subject"); why[w] = (why[w] || 0) + 1; } }
      r.shownFrac = +(ok / k).toFixed(2); r.pass = r.shownFrac >= 0.6; if (!r.pass) r.why = why;
      if (!r.pass) { const T = INFO.T, win = []; let w0 = null;   // where IS it on screen? -> re-anchor hint
        for (let t = 0; t <= T; t += 0.25) { const m = await page.evaluate(`window.subjectsAt(${t}, ${JSON.stringify(l.shows)})`), on = l.shows.some(s => m[s] && m[s].shown);
          if (on && w0 === null) w0 = t; if (!on && w0 !== null) { if (t - w0 >= 0.75) win.push([w0, t]); w0 = null; } }
        if (w0 !== null) win.push([w0, T]); r.shownAt = win; } }
    if (!r.pass) fails++; rep.push(r);
    await shot((l.start + l.end) / 2, path.join(OUT, `${NAME}${SUF}_line${String(l.n).padStart(2, "0")}.jpg`));
    console.log(`${r.pass ? "PASS" : "FAIL"} L${l.n} [${(l.shows || []).join("|")}] ${r.shownFrac ?? "-"} ${r.why ? JSON.stringify(r.why) : ""}${r.shownAt ? " shown at " + JSON.stringify(r.shownAt) : ""} | ${l.text}`); }
  if (!CHANQ) {   // exports belong to the main film: a channel variant never overwrites them
    const cues = await page.evaluate("window.__cues || null"); if (cues) fs.writeFileSync(path.join(filmDir(filmId), "cues.json"), JSON.stringify(cues));   // 16:9 films export their cues too
    const beds = await page.evaluate("window.__beds || null"); if (beds) fs.writeFileSync(path.join(filmDir(filmId), "beds.json"), JSON.stringify(beds));   // page-exported ambience beds (sound.json "beds": "page")
    fs.writeFileSync(path.join(filmDir(filmId), `linecheck${SUF}.json`), JSON.stringify({ pass: fails === 0, fails, lines: rep }, null, 1)); }
  console.log(fails ? `LINE GATE FAIL: ${fails} line(s) talk about something not on screen` : "LINE GATE PASS");
  if (fails) process.exitCode = 1;
} else if (mode === "still") {
  for (const t of (a3 || "0").split(",")) { const f = path.join(OUT, `${NAME}${SUF}_t${t}.jpg`); await shot(+t, f); console.log("wrote", f); }
} else if (mode === "sheet") {   // auto: N evenly spaced fresh stills (default 24) tiled
  const N = +(a4 || 24), T = INFO.T || 40, tmp = path.join(OUT, `_sheet_${NAME}${SUF}_auto`); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp);
  for (let i = 0; i < N; i++) await shot((i + 0.5) * T / N, path.join(tmp, String(i + 1).padStart(3, "0") + ".jpg"));
  tile(path.join(tmp, "%03d.jpg"), path.join(OUT, `${NAME}${SUF}_sheet_auto.jpg`), 4, N); fs.rmSync(tmp, { recursive: true, force: true });
} else if (mode === "bench") {
  const load = (Date.now() - t0) / 1000; await page.evaluate("window.renderAt(1)"); const b0 = Date.now(), tmpf = path.join(OUT, `_bench_${NAME}.jpg`);
  for (let i = 0; i < 12; i++) await shot(1 + i / 30, tmpf); fs.rmSync(tmpf, { force: true });
  const per = (Date.now() - b0) / 12000, T = INFO.T || 0, est = per * T * 30 / 3600;
  const rep = { pageLoadSeconds: +load.toFixed(1), secondsPerFrame: +per.toFixed(3), filmSeconds: T, estimatedRenderHours: +est.toFixed(2) };
  fs.writeFileSync(path.join(OUT, `time_${NAME}${SUF}_bench.json`), JSON.stringify(rep)); console.log("[bench]", JSON.stringify(rep));
} else {   // video
  if (plate === "film" && FILM) { const pj = JSON.parse(fs.readFileSync(path.join(filmDir(FILM), "plan.json"), "utf8"));
    if (pj.v3) { let g = null; try { g = JSON.parse(fs.readFileSync(GATEF, "utf8")); } catch (e) {}
      const newest = Math.max(...["plan.json", "lines.json", "entities.json", "photos_missing.txt", "photos.json", ...(CHANQ ? ["channels.json", `variants/${decodeURIComponent(CHANQ)}/lines.json`] : [])].map(f => path.join(filmDir(FILM), f)).filter(f => fs.existsSync(f)).map(f => fs.statSync(f).mtimeMs), fs.statSync(path.join(here, "film.html")).mtimeMs);
      if (!g || !g.pass || g.at < newest) { console.log("REFUSING TO RENDER: v3 gates " + (!g ? "never ran (run: render.mjs shots film)" : !g.pass ? "fail: " + g.fails.join(", ") : "are stale (plan/lines/film.html changed since)")); await quit(3); } } }
  const fps = +a3 || 30, T = JSON.parse(a4 || "{}").T || INFO.T || 7, n = Math.round(T * fps);
  // time range (env FROM / TO seconds, default = whole film): frames round(FROM*fps) .. round(TO*fps)-1, written as their own clip <name>_from<frame>.mp4
  const i0 = process.env.FROM ? Math.max(0, Math.round(+process.env.FROM * fps)) : 0, i1 = process.env.TO ? Math.min(n, Math.round(+process.env.TO * fps)) : n, RANGE = process.env.FROM || process.env.TO ? `_from${i0}` : "";
  const fd = path.join(OUT, "frames_" + NAME + SUF + RANGE); fs.rmSync(fd, { recursive: true, force: true }); fs.mkdirSync(fd);
  const r0 = Date.now();
  for (let i = i0; i < i1; i++) { await shot(i / fps, path.join(fd, String(i - i0).padStart(5, "0") + ".jpg")); if ((i - i0) % 300 === 0) console.log(`  frame ${i - i0}/${i1 - i0}  ${((Date.now() - r0) / 1000).toFixed(0)} s`); }
  const spf = (Date.now() - r0) / 1000 / (i1 - i0); console.log(`frames ${i1 - i0}${RANGE ? ` (${i0}..${i1 - 1} of ${n})` : ""}  ${spf.toFixed(3)} s/frame`);
  const mp4 = path.join(OUT, `${NAME}${SUF}${RANGE}.mp4`);
  cp.execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(fd, "%05d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", mp4]);
  console.log("wrote", mp4); fs.writeFileSync(path.join(OUT, `time_${NAME}${SUF}${RANGE}.json`), JSON.stringify({ frames: i1 - i0, s_per_frame: spf, ...(RANGE ? { from: i0, to: i1, total: n } : {}) }));
}
await quit(process.exitCode || 0);
