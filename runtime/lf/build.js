// node build.js chNN  -> chNN/index.html (self-contained composition folder). Reads src/chNN.js (choreography).
const fs = require("fs"), path = require("path");
const D = __dirname, R = path.join(D, "..", "..", "..", "runtime"), Theme = require(path.join(R, "theme.js"));
const CH = { ch00: { lines: [0, 5], n: 0, title: "Cold open" }, ch01: { lines: [6, 13], n: 1, title: "What is a swing power" }, ch02: { lines: [14, 23], n: 2, title: "Where it started" } };
const id = process.argv[2], c = CH[id]; if (!c) throw new Error("unknown chapter");
const out = path.join(D, id); fs.mkdirSync(out, { recursive: true });
for (const f of ["theme.js", "verbs.js", "maps.js", "puppet.js"]) fs.copyFileSync(path.join(R, f), path.join(out, f));
fs.copyFileSync(path.join(R, "geo", "geo.js"), path.join(out, "geo.js"));
fs.copyFileSync(path.join(D, "lf-kit.js"), path.join(out, "lf-kit.js"));
fs.copyFileSync(path.join(D, "..", "..", "maps-demo", "gsap.min.js"), path.join(out, "gsap.min.js"));
const fonts = path.join(D, "..", "..", "components-demo", "wide", "fonts"); fs.mkdirSync(path.join(out, "fonts"), { recursive: true });
for (const f of fs.readdirSync(fonts)) fs.copyFileSync(path.join(fonts, f), path.join(out, "fonts", f));
const media = JSON.parse(fs.readFileSync(path.join(D, "media.json"), "utf8")); fs.mkdirSync(path.join(out, "images"), { recursive: true });
const used = new Set((fs.readFileSync(path.join(D, "src", id + ".js"), "utf8").match(/["'](\w+)["']/g) || []).map((s) => s.slice(1, -1)));
for (const k of Object.keys(media)) if (used.has(k) && k !== "nehru") fs.copyFileSync(path.join(D, media[k].file), path.join(out, media[k].file));
let words, est = false;
if (fs.existsSync(path.join(D, "words.json"))) words = JSON.parse(fs.readFileSync(path.join(D, "words.json"), "utf8"));
else { est = true; words = []; let t = 0.3; fs.readFileSync(path.join(D, "script.txt"), "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#")).forEach((l, i) => { l.split(/\s+/).forEach((w) => { words.push({ w, s: +t.toFixed(3), e: +(t + 0.34).toFixed(3), line: i }); t += 0.4; }); t += 0.35; }); }
const mine = words.filter((w) => w.line >= c.lines[0] && w.line <= c.lines[1]);
const prev = words.filter((w) => w.line < c.lines[0]).pop(), LEAD = Math.min(3.0, prev ? mine[0].s - prev.e - 0.27 : 0.25); // window starts INSIDE the chapter pause (stitch.py/sfxmerge.py use the same LEAD)
const T0 = Math.max(0, mine[0].s - LEAD), END = mine[mine.length - 1].e + 0.3, DUR = +(END - T0).toFixed(3);
const local = mine.map((w) => ({ w: w.w, s: +(w.s - T0).toFixed(3), e: +(w.e - T0).toFixed(3), line: w.line }));
const th = Theme.get("tomato"), css = Theme.css(th);
const src = fs.readFileSync(path.join(D, "src", id + ".js"), "utf8");
const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=1920, height=1080"/>
<script src="gsap.min.js"></script><script src="theme.js"></script><script src="verbs.js"></script><script src="geo.js"></script><script src="maps.js"></script><script src="puppet.js"></script><script src="lf-kit.js"></script>
<style>
@font-face{font-family:"Anton";src:url(fonts/anton-latin-400-normal.woff2)}
@font-face{font-family:"Inter";font-weight:500;src:url(fonts/inter-latin-500-normal.woff2)}
@font-face{font-family:"Inter";font-weight:700;src:url(fonts/inter-latin-700-normal.woff2)}
@font-face{font-family:"Inter";font-weight:800;src:url(fonts/inter-latin-800-normal.woff2)}
@font-face{font-family:"Inter";font-weight:900;src:url(fonts/inter-latin-900-normal.woff2)}
:root{${css}}
html,body{margin:0;background:var(--bg)}
#root{position:relative;width:1920px;height:1080px;overflow:hidden;font-family:Inter,sans-serif;background:var(--bg)}
</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-width="1920" data-height="1080" data-duration="${DUR}"></div>
<script>
window.__timelines = window.__timelines || {};
const THEME = ${JSON.stringify(th)}, MEDIA = ${JSON.stringify(media)}, DUR = ${DUR}, T0 = ${T0.toFixed(3)};
const WORDS = ${JSON.stringify(local)};
const tl = gsap.timeline({ paused: true });
LF.init(tl);
${src}
tl.to({}, { duration: DUR }, 0);
window.__timelines["main"] = tl;
</script></body></html>`;
fs.writeFileSync(path.join(out, "index.html"), html);
console.log(id, "DUR", DUR, "T0", T0.toFixed(2), est ? "(estimated words)" : "(real words)");
