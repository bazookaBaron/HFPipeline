// node runtime/shorts/shorts.js <projectDir> [--layout paper|gradient|blur] [--parts 1-3] [--grabs] [--title "Series title"]
//        [--video final.mp4] [--script script.txt] [--shots auto|none|<file>] [--offset 0] [--out <dir>] [--crf 19] [--force]
// Long-form -> YouTube Shorts series (README-shorts.md). The 16:9 film is NOT re-authored: each part is the film cut at the
// script's `#part` markers, scaled to 1080 wide and centred in a 1080x1920 canvas with a 'PART n' header and part dots.
//   1. script.txt `#part [title]` lines -> spoken-line index of each break; words.json -> exact times
//      (cut = after the hook line's last word, snapped to a shot/scene boundary in the gap, else a short tail; next part
//      starts just before its first word)
//   2. static layers (background/header/footer + the 'PART n+1 ->' teaser) = one HTML template -> PNG via headless Chrome
//   3. ffmpeg: cut + compose + teaser for the last 1.5 s, audio fades, two-pass loudnorm to -14 LUFS / -1.5 dBTP
//   -> <out>/part-NN.mp4, parts.json, parts.md (title + description suggestions, hook line). --grabs: one frame per layout.
const fs = require("fs"), path = require("path"), cp = require("child_process");
require("./heavy.js").selfQueue(module, "render");   // heavy: run inside a runtime/jobq.js slot (JOBQ=0 bypasses)
const P = path.resolve(process.argv[2] || ".");
const flag = (k) => process.argv.includes(k), opt = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const R = path.resolve(__dirname, ".."), FONTS = path.join(R, "vendor", "fonts");
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = path.resolve(P, opt("--out", "shorts")), LAY = path.join(OUT, "_layers");
const VIDEO = path.resolve(P, opt("--video", "final.mp4")), SCRIPT = path.resolve(P, opt("--script", "script.txt"));
const OFFSET = +opt("--offset", 0), CRF = opt("--crf", "19");
const W = 1080, H = 1920, VH = 608, VY = (H - VH) / 2;            // 16:9 at 1080 wide -> 1080x608, centred
const TEASE = 1.5, PART_MAX = 179;                                  // Shorts limit 3:00
const C = { cream: "#F4ECDD", navy: "#13223B", teal: "#1E7C83", saffron: "#F2A93B", coral: "#E5593F", mint: "#3FB68B", plum: "#7A4F9A" };
fs.mkdirSync(LAY, { recursive: true });
const run = (cmd, args, o = {}) => {
  const r = cp.spawnSync(cmd, args, Object.assign({ encoding: "utf8", maxBuffer: 1 << 28 }, o));
  if (r.status !== 0 && !o.ok) throw new Error(`${cmd} failed:\n${(r.stderr || "").slice(-2000)}`);
  return r;
};
const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const dur = (f) => +run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).stdout.trim();

// ---- 1. script + timings
const lines = [], breaks = [], chapters = [];
for (const raw of fs.readFileSync(SCRIPT, "utf8").split(/\r?\n/)) {
  const l = raw.trim();
  if (!l) continue;
  const m = l.match(/^#\s*(part|chapter)\b\s*:?\s*(.*)$/i);
  if (m) (m[1].toLowerCase() === "part" ? breaks : chapters).push({ at: lines.length, title: m[2].trim() });
  if (!l.startsWith("#")) lines.push(l.replace(/\s*\{\w+(?::[^}]*)?\}\s*/g, " ").trim());   // all script tags ({dry} {viz:..} {pause} ...)
}
if (!chapters.length && fs.existsSync(path.join(P, "chapters.json")))
  JSON.parse(fs.readFileSync(path.join(P, "chapters.json"), "utf8")).forEach((c) => chapters.push({ at: c.first_line, title: c.title }));
if (!breaks.length) throw new Error(`no #part markers in ${SCRIPT} (README-shorts.md)`);
const words = JSON.parse(fs.readFileSync(path.join(P, "words.json"), "utf8"));
const ls = {}, le = {};
words.forEach((w) => { if (!(w.line in ls)) ls[w.line] = w.s + OFFSET; le[w.line] = w.e + OFFSET; });
const VD = dur(VIDEO), lastEnd = Math.max(...Object.values(le));

// shot boundaries: from the shot list when final.mp4 was rendered from it (Doc2D), else ffmpeg scene detection per gap
function shotTimes() {
  const mode = opt("--shots", "auto");
  if (mode === "none") return null;
  const f = path.resolve(P, mode === "auto" ? "shots.txt" : mode);
  if (!fs.existsSync(f) || (mode === "auto" && fs.statSync(f).mtimeMs > fs.statSync(VIDEO).mtimeMs)) return null;
  const byLine = {};
  words.forEach((w) => (byLine[w.line] = byLine[w.line] || []).push(w));
  const ref = (r) => {   // L5, L5$, L5.word, each with optional +x / -x
    const m = r.match(/^L(\d+)(\$|\.([\w'-]+))?([+-][\d.]+)?$/);
    if (!m || !byLine[m[1]]) return null;
    const ws = byLine[m[1]], k = m[3] && m[3].toLowerCase();
    const base = m[2] === "$" ? ws[ws.length - 1].e : k ? (ws.find((w) => w.w.toLowerCase().replace(/[^\w'-]/g, "") === k) || ws[0]).s : ws[0].s;
    return base + OFFSET + (m[4] ? +m[4] : 0);
  };
  return fs.readFileSync(f, "utf8").split(/\r?\n/).map((l) => l.match(/^shot\s+(\S+)/)).filter(Boolean).map((m) => ref(m[1])).filter((t) => t != null);
}
const SHOTS = shotTimes();
function sceneCuts(a, b) {
  const r = run("ffmpeg", ["-hide_banner", "-ss", a.toFixed(3), "-t", (b - a).toFixed(3), "-i", VIDEO, "-an", "-vf",
    "scale=320:-2,select='gt(scene,0.22)',showinfo", "-f", "null", "-"], { ok: true });
  return [...(r.stderr || "").matchAll(/pts_time:([\d.]+)/g)].map((m) => a + +m[1]);
}

const cuts = breaks.map((b) => {
  const we = le[b.at - 1], ns = ls[b.at];
  if (we == null || ns == null) throw new Error(`#part before spoken line ${b.at}: no word timings`);
  const lo = we + 0.12, hi = Math.max(lo + 0.2, ns + 0.25);
  const cand = (SHOTS ? SHOTS.filter((t) => t >= lo && t <= hi) : sceneCuts(we, hi + 0.3).filter((t) => t >= lo && t <= hi));
  const tail = we + Math.min(0.7, Math.max(0.15, 0.6 * (ns - we)));
  const end = cand.length ? cand.reduce((x, y) => (Math.abs(y - we - 0.5) < Math.abs(x - we - 0.5) ? y : x)) : tail;
  return { end, next: Math.max(end, ns - 0.45), snapped: cand.length ? (SHOTS ? "shot" : "scene") : "word", we, ns };
});
const parts = [];
for (let i = 0; i <= breaks.length; i++) {
  const a = i ? cuts[i - 1].next : 0, b = i < breaks.length ? cuts[i].end : Math.min(VD, lastEnd + 1.2);
  const first = i ? breaks[i - 1].at : 0, last = (i < breaks.length ? breaks[i].at : lines.length) - 1;
  const ch = chapters.filter((c) => c.at <= first).pop();
  const sents = lines[last].split(/(?<=[.!?])\s+/).filter(Boolean);
  parts.push({ n: i + 1, start: +a.toFixed(3), end: +b.toFixed(3), dur: +(b - a).toFixed(2), snap: i < breaks.length ? cuts[i].snapped : "end",
    lines: [first, last], title: (i ? breaks[i - 1].title : "") || (ch ? ch.title.replace(/^chapter\s*\d+\s*:\s*/i, "") : "") || "",
    recap: lines[first], hook: sents[sents.length - 1] });
}
const N = parts.length;
const SERIES = opt("--title") || lines[0].replace(/[,.]?\s*explained\.?$/i, "").replace(/[.!?]$/, "");
parts.forEach((p) => { if (!p.title) p.title = p.n === 1 ? "Cold open" : `Part ${p.n}`; });
const bad = parts.filter((p) => p.dur > PART_MAX || p.dur < 30);
bad.forEach((p) => console.warn(`WARN part ${p.n} is ${p.dur}s (Shorts: <= ${PART_MAX}s; script rule 60-170 s)`));
if (bad.some((p) => p.dur > PART_MAX) && !flag("--force")) throw new Error("part over the 3-minute Shorts limit (fix the #part markers or pass --force)");

// ---- 2. static layers (HTML -> PNG)
const font = (fam, w, f) => `@font-face{font-family:'${fam}';font-weight:${w};src:url('${"file:///" + path.join(FONTS, f).split(path.sep).join("/")}')}`;
const FONTCSS = font("Oswald", 500, "oswald-latin-500-normal.woff2") + font("Oswald", 600, "oswald-latin-600-normal.woff2") +
  font("Oswald", 700, "oswald-latin-700-normal.woff2") + font("Plex", 400, "ibm-plex-mono-latin-400-normal.woff2") +
  font("Plex", 600, "ibm-plex-mono-latin-600-normal.woff2");
const THEMES = {
  paper: { ink: C.navy, sub: C.teal, num: C.coral, dot: C.navy, accent: C.saffron, opaque: true,
    bg: `background:${C.cream};`, extra: `<div class="grain"></div><div class="vig"></div>` },
  gradient: { ink: C.cream, sub: C.saffron, num: C.saffron, dot: C.cream, accent: C.saffron, opaque: true,
    bg: `background:radial-gradient(120% 60% at 15% 0%, ${C.plum}cc 0%, transparent 60%),radial-gradient(120% 70% at 100% 100%, ${C.teal} 0%, transparent 65%),linear-gradient(170deg, ${C.navy} 0%, #1a3350 55%, ${C.navy} 100%);`,
    extra: `<div class="grain soft"></div>` },
  blur: { ink: C.cream, sub: C.saffron, num: C.saffron, dot: C.cream, accent: C.saffron, opaque: false,
    bg: `background:linear-gradient(180deg, ${C.navy}e6 0%, ${C.navy}66 ${VY - 40}px, transparent ${VY}px, transparent ${VY + VH}px, ${C.navy}66 ${VY + VH + 40}px, ${C.navy}e6 100%);`, extra: "" },
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
function layerHTML(theme, n, kind) {
  const T = THEMES[theme], last = n === N;
  const dots = Array.from({ length: N }, (_, i) => `<i class="${i + 1 < n ? "past" : i + 1 === n ? "cur" : ""}"></i>`).join("");
  const base = `<!doctype html><html><head><meta charset="utf-8"><style>${FONTCSS}
  *{margin:0;padding:0;box-sizing:border-box} html,body{width:${W}px;height:${H}px;overflow:hidden;background:transparent}
  .stage{position:absolute;inset:0;${kind === "tease" ? "" : T.bg}}
  .grain{position:absolute;inset:0;opacity:.22;mix-blend-mode:multiply;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .35  0 0 0 0 .27  0 0 0 0 .18  0 0 0 .9 0'/></filter><rect width='400' height='400' filter='url(%23n)'/></svg>")}
  .grain.soft{opacity:.12;mix-blend-mode:screen}
  .vig{position:absolute;inset:0;background:radial-gradient(90% 70% at 50% 50%, transparent 55%, rgba(122,79,58,.18) 100%)}
  .frame{position:absolute;left:0;top:${VY}px;width:${W}px;height:${VH}px;box-shadow:0 24px 60px rgba(19,34,59,.38),0 0 0 3px ${T.ink}22}
  .head{position:absolute;left:0;right:0;top:0;height:${VY}px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:54px;color:${T.ink}}
  .kick{font:600 30px/1 Plex;letter-spacing:.32em;text-transform:uppercase;color:${T.sub};margin-bottom:18px;max-width:960px;text-align:center}
  .part{font:700 210px/.86 Oswald;letter-spacing:.02em;text-transform:uppercase;display:flex;align-items:baseline;gap:26px;${theme === "blur" ? "text-shadow:0 6px 30px rgba(0,0,0,.45);" : ""}}
  .part b{color:${T.num};font-weight:700} .part small{font:500 52px/1 Plex;opacity:.55;letter-spacing:0}
  .bar{width:120px;height:8px;background:${T.accent};border-radius:4px;margin:26px 0 24px}
  .dots{display:flex;gap:16px} .dots i{width:22px;height:22px;border-radius:50%;border:3px solid ${T.dot};opacity:.55}
  .dots i.past{background:${T.dot};opacity:.35} .dots i.cur{background:${T.accent};border-color:${T.accent};opacity:1;transform:scale(1.25)}
  .foot{position:absolute;left:0;right:0;top:${VY + VH + 70}px;display:flex;flex-direction:column;align-items:center;gap:96px;color:${T.ink}}
  .next{font:600 46px/1 Oswald;letter-spacing:.14em;text-transform:uppercase;opacity:.78}
  .next span{color:${T.num}} .full{font:400 26px/1 Plex;letter-spacing:.2em;text-transform:uppercase;opacity:.6}
  .tease{position:absolute;left:50%;top:${VY + VH + 44}px;transform:translateX(-50%);background:${C.saffron};color:${C.navy};
    font:700 84px/1 Oswald;letter-spacing:.06em;text-transform:uppercase;padding:22px 54px 26px;border-radius:999px;white-space:nowrap;
    box-shadow:0 18px 50px rgba(19,34,59,.45),0 0 0 6px ${C.navy}}
  .tease.end{font-size:56px;background:${C.coral};color:${C.cream}}
  </style></head><body><div class="stage">`;
  if (kind === "tease")
    return base + (last ? `<div class="tease end">Full video on the channel</div>` : `<div class="tease">Part ${n + 1} &rarr;</div>`) + `</div></body></html>`;
  return base + T.extra + (T.opaque ? `<div class="frame"></div>` : "") +
    `<div class="head"><div class="kick">${esc(SERIES)}</div><div class="part">Part <b>${n}</b><small>/${N}</small></div><div class="bar"></div><div class="dots">${dots}</div></div>` +
    `<div class="foot">${last ? `<div class="next">The <span>end</span> of the series</div>` : `<div class="next">Part ${n + 1} <span>&rarr;</span></div>`}<div class="full">Full video on the channel</div></div>` +
    `</div></body></html>`;
}
function png(theme, n, kind) {
  const base = path.join(LAY, `${theme}-${kind}-${String(n).padStart(2, "0")}`), html = base + ".html", out = base + ".png";
  const src = layerHTML(theme, n, kind);
  if (fs.existsSync(out) && fs.existsSync(html) && fs.readFileSync(html, "utf8") === src) return out;
  fs.writeFileSync(html, src);
  run(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--default-background-color=00000000",
    `--window-size=${W},${H}`, "--virtual-time-budget=1500", `--screenshot=${out}`, "file:///" + html.split(path.sep).join("/")]);
  if (!fs.existsSync(out)) throw new Error("chrome screenshot failed: " + out);
  return out;
}

// ---- 3. compose
function graph(theme, D) {
  const vid = theme === "blur"
    ? `[0:v]setpts=PTS-STARTPTS,split[a][b];[a]scale=-2:480,crop=270:480,boxblur=12:2,scale=${W}:${H},eq=brightness=-0.12:saturation=0.75[bg];[b]scale=${W}:${VH}[fg];[bg][fg]overlay=0:${VY}[v0];[v0][1:v]overlay=0:0[v1]`
    : `[0:v]setpts=PTS-STARTPTS,scale=${W}:${VH}[fg];[1:v]setpts=PTS-STARTPTS[bg];[bg][fg]overlay=0:${VY}:eof_action=pass[v1]`;
  const t0 = Math.max(0, D - TEASE).toFixed(3);
  return `${vid};[2:v]format=rgba,fade=t=in:st=${t0}:d=${D - TEASE > 0 ? 0.3 : 0.01}:alpha=1[tz];[v1][tz]overlay=0:0:enable='gte(t,${t0})',fps=30,format=yuv420p[v]`;
}
function afilter(p) {
  return `${p.n > 1 ? "afade=t=in:st=0:d=0.06," : ""}afade=t=out:st=${(p.dur - 0.35).toFixed(3)}:d=0.35`;
}
function renderPart(p, theme) {
  const out = path.join(OUT, `part-${String(p.n).padStart(2, "0")}.mp4`);
  const bg = png(theme, p.n, "layer"), tz = png(theme, p.n, "tease");
  const cut = ["-ss", p.start.toFixed(3), "-t", p.dur.toFixed(3), "-i", VIDEO];
  const meas = run("ffmpeg", ["-hide_banner", ...cut, "-vn", "-af", `${afilter(p)},loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json`, "-f", "null", "-"]).stderr;
  const j = JSON.parse(meas.slice(meas.lastIndexOf("{"), meas.lastIndexOf("}") + 1));
  const ln = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...cut, "-framerate", "30", "-loop", "1", "-i", bg, "-framerate", "30", "-loop", "1", "-i", tz,
    "-filter_complex", `${graph(theme, p.dur)};[0:a]${afilter(p)},${ln},aresample=48000[a]`, "-map", "[v]", "-map", "[a]", "-t", p.dur.toFixed(3),
    "-c:v", "libx264", "-preset", "medium", "-crf", CRF, "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out]);
  return out;
}
function grab(theme, p, at, out) {
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", (p.start + at).toFixed(3), "-t", "0.5", "-i", VIDEO,
    "-framerate", "30", "-loop", "1", "-i", png(theme, p.n, "layer"), "-framerate", "30", "-loop", "1", "-i", png(theme, p.n, "tease"),
    "-filter_complex", graph(theme, p.dur - at), "-map", "[v]", "-t", "0.45", "-update", "1", "-q:v", "3", out]);  // last frame: overlays settled
}

const sel = (() => { const s = opt("--parts"); if (!s) return parts; const [a, b] = s.split("-").map(Number); return parts.filter((p) => p.n >= a && p.n <= (b || a)); })();
const theme = opt("--layout", "paper");
if (!THEMES[theme]) throw new Error("--layout paper|gradient|blur");
console.log(`${SERIES}: ${N} parts from ${path.relative(P, VIDEO)} (${fmt(VD)}), shots: ${SHOTS ? "shot list" : "scene detect"}`);
parts.forEach((p) => console.log(`  part ${String(p.n).padStart(2)}  ${fmt(p.start)}-${fmt(p.end)}  ${p.dur.toFixed(1)}s  [${p.snap}]  hook: ${p.hook}`));
if (flag("--grabs")) {
  const p = sel[0];
  for (const t of Object.keys(THEMES)) {
    grab(t, p, Math.min(8, p.dur / 2), path.join(OUT, `layout-${t}.jpg`));
    grab(t, p, p.dur - 0.6, path.join(OUT, `layout-${t}-tease.jpg`));
  }
  console.log("grabs:", path.join(OUT, "layout-*.jpg"));
}
if (!flag("--grabs-only")) for (const p of sel) {
  const t0 = Date.now(), f = renderPart(p, theme);
  p.file = path.relative(P, f).split(path.sep).join("/");
  console.log(`  wrote ${p.file} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

// ---- part list
const list = parts.map((p) => ({
  n: p.n, file: `shorts/part-${String(p.n).padStart(2, "0")}.mp4`, start: p.start, end: p.end, dur: p.dur, snap: p.snap,
  title: `${SERIES}: ${p.title} (Part ${p.n}/${N})`.slice(0, 100),
  description: `Part ${p.n} of ${N}. ${p.recap}${p.n < N ? ` Part ${p.n + 1} is next.` : ""} Full video on the channel.\n#shorts`,
  recap: p.recap, hook: p.hook, lines: p.lines,
}));
fs.writeFileSync(path.join(OUT, "parts.json"), JSON.stringify({ series: SERIES, video: path.relative(P, VIDEO), layout: theme, parts: list }, null, 1));
fs.writeFileSync(path.join(OUT, "parts.md"), `# ${SERIES} — Shorts series (${N} parts)\n\n` + list.map((p) =>
  `## Part ${p.n} · ${fmt(p.start)}–${fmt(p.end)} (${p.dur.toFixed(0)} s)\n**Title:** ${p.title}\n\n**Description:** ${p.description.replace(/\n/g, " ")}\n\n**Hook (last line):** ${p.hook}\n`).join("\n"));
console.log("part list:", path.join(OUT, "parts.md"));
if (process.env.KEEP_ASSETS !== "1" && !flag("--grabs-only")) require("../cleanup_run.js").clean(OUT, false);
