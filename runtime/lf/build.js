// node runtime/lf/build.js chNN [projectDir]  -> <project>/chNN/index.html (self-contained composition folder).
// projectDir defaults to this file's dir when build.js was copied into a project, else the cwd.
// Project inputs: chapters.json ([{title, first_line}], chapter i = chNN), src/chNN.js (choreography),
// media.json, words.json (else timings are estimated from script.txt), optional project.json:
//   { "theme": "<id>", "prelude": ["src/_common.js", ...] }  — theme falls back to Theme.next(slug, { exclude: ["tomato"] }).
const fs = require("fs"), path = require("path");
const id = process.argv[2]; if (!/^ch\d\d$/.test(id || "")) throw new Error("usage: node build.js chNN [projectDir]");
const D = process.argv[3] ? path.resolve(process.argv[3]) : fs.existsSync(path.join(__dirname, "chapters.json")) ? __dirname : process.cwd();
let R = D; while (!fs.existsSync(path.join(R, "runtime", "theme.js"))) { const up = path.dirname(R); if (up === R) throw new Error("runtime/ not found above " + D); R = up; }
R = path.join(R, "runtime"); const Theme = require(path.join(R, "theme.js")), V = path.join(R, "vendor");
const rd = (f) => fs.readFileSync(path.join(D, f), "utf8"), has = (f) => fs.existsSync(path.join(D, f));
const PJ = has("project.json") ? JSON.parse(rd("project.json")) : {};
const CHS = JSON.parse(rd("chapters.json")), n = +id.slice(2); if (!CHS[n]) throw new Error("unknown chapter " + id + " (chapters.json has " + CHS.length + ")");
const c = { n, title: CHS[n].title, lines: [CHS[n].first_line, CHS[n + 1] ? CHS[n + 1].first_line - 1 : Infinity] };
const out = path.join(D, id); fs.mkdirSync(out, { recursive: true });
for (const f of ["theme.js", "verbs.js", "maps.js", "puppet.js"]) fs.copyFileSync(path.join(R, f), path.join(out, f));
fs.copyFileSync(path.join(R, "geo", "geo.js"), path.join(out, "geo.js"));
fs.copyFileSync(path.join(R, "lf", "lf-kit.js"), path.join(out, "lf-kit.js"));
fs.copyFileSync(path.join(V, "gsap", "gsap.min.js"), path.join(out, "gsap.min.js"));
fs.mkdirSync(path.join(out, "fonts"), { recursive: true });
for (const f of fs.readdirSync(path.join(V, "fonts"))) fs.copyFileSync(path.join(V, "fonts", f), path.join(out, "fonts", f));
const media = has("media.json") ? JSON.parse(rd("media.json")) : {}; fs.mkdirSync(path.join(out, "images"), { recursive: true });
const PRE = (PJ.prelude || []).map(rd).join("\n"), body = rd(path.join("src", id + ".js"));
const used = new Set(((PRE + body).match(/["'](\w+)["']/g) || []).map((s) => s.slice(1, -1)));
for (const k of Object.keys(media)) if (used.has(k) && has(media[k].file)) fs.copyFileSync(path.join(D, media[k].file), path.join(out, media[k].file));
let words, est = false;
if (has("words.json")) words = JSON.parse(rd("words.json"));
else { est = true; words = []; let t = 0.3; rd("script.txt").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#")).forEach((l, i) => { l.split(/\s+/).forEach((w) => { words.push({ w, s: +t.toFixed(3), e: +(t + 0.34).toFixed(3), line: i }); t += 0.4; }); t += 0.35; }); }
const mine = words.filter((w) => w.line >= c.lines[0] && w.line <= c.lines[1]); if (!mine.length) throw new Error(id + ": no words in lines " + c.lines);
const prev = words.filter((w) => w.line < c.lines[0]).pop(), LEAD = Math.min(3.0, prev ? mine[0].s - prev.e - 0.27 : 0.25); // window starts INSIDE the chapter pause (stitch.py/sfxmerge.py use the same LEAD)
const T0 = Math.max(0, mine[0].s - LEAD), END = mine[mine.length - 1].e + 0.3, DUR = +(END - T0).toFixed(3);
const local = mine.map((w) => ({ w: w.w, s: +(w.s - T0).toFixed(3), e: +(w.e - T0).toFixed(3), line: w.line }));
const th = PJ.theme ? Theme.get(PJ.theme) : Theme.next(path.basename(D), { exclude: ["tomato"] }), css = Theme.css(th);
const src = `const LO = ${c.lines[0]}, HI = ${Number.isFinite(c.lines[1]) ? c.lines[1] : 1e9}, CHN = ${c.n}, CHT = ${JSON.stringify(c.title)};\n${PRE}\n${body}`;
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
console.log(id, "theme", th.id, "DUR", DUR, "T0", T0.toFixed(2), est ? "(estimated words)" : "(real words)");
