#!/usr/bin/env node
"use strict";
/* runtime/carousel.js: slides JSON -> one static HTML page (every slide a 1080x1350 .slide), poster theme.
 *   node runtime/carousel.js <slides.json> [outDir]   -> <outDir>/index.html + <outDir>/fonts/
 * Schema: runtime/CAROUSEL.md. Export PNGs with runtime/carousel_export.js. Static: no JS, no animation.
 * Self-contained CSS in the reel's poster style (dot grid, paper cards, 6 px outlines, hard shadows, marker). */
const fs = require("fs");
const path = require("path");
const Theme = require("./theme");

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** [[word]] -> marker highlight, **word** -> bold ink */
const rich = (s) => esc(s).replace(/\[\[(.+?)\]\]/g, '<mark>$1</mark>').replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

const FONTS = `
@font-face{font-family:"Inter";src:url(fonts/inter-latin-500-normal.woff2);font-weight:500}
@font-face{font-family:"Inter";src:url(fonts/inter-latin-700-normal.woff2);font-weight:700}
@font-face{font-family:"Inter";src:url(fonts/inter-latin-800-normal.woff2);font-weight:800}
@font-face{font-family:"Inter";src:url(fonts/inter-latin-900-normal.woff2);font-weight:900}
@font-face{font-family:"Anton";src:url(fonts/anton-latin-400-normal.woff2)}
@font-face{font-family:"Mono";src:url(fonts/JetBrainsMono-Bold.woff2);font-weight:700}`;

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#222}
.slide{position:relative;width:1080px;height:1350px;overflow:hidden;background-color:var(--bg);color:var(--ink);font-family:Inter,sans-serif;font-weight:700;
  background-image:radial-gradient(circle,var(--dot) 3.2px,transparent 3.6px);background-size:36px 36px;background-position:18px 18px;display:flex;flex-direction:column;padding:60px 64px 56px}
.slide + .slide{margin-top:24px}
.top{display:flex;justify-content:space-between;align-items:center;height:64px;flex:none}
.pill{background:var(--paper);border:5px solid var(--ink);border-radius:999px;box-shadow:6px 6px 0 var(--shadow);padding:8px 26px;font-family:Mono,monospace;font-weight:700;font-size:30px;line-height:1}
.brand{font-family:Mono,monospace;font-weight:700;font-size:30px}
.h1{font-family:Anton,sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:.005em;line-height:1.02;font-size:104px;margin:34px 0 0}
.cover .h1{font-size:122px;line-height:1.0;margin-top:40px}
.h1 mark,.sub mark,.note mark,li mark{background:linear-gradient(transparent 8%,var(--marker) 8%,var(--marker) 94%,transparent 94%);color:var(--ink);padding:0 10px;margin:0 -4px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.sub{font-size:44px;font-weight:800;line-height:1.2;margin-top:30px}
.body{flex:1;display:flex;flex-direction:column;gap:30px;margin-top:34px;min-height:0}
.body>.card{flex:1;display:flex;flex-direction:column;justify-content:center}
.body>.card.stat{flex-direction:row;justify-content:flex-start}
.body>.note.card,.body>.cta{flex:none}
.card{background:var(--paper);border:6px solid var(--ink);border-radius:26px;box-shadow:10px 10px 0 var(--shadow);padding:26px 32px}
.card.ink{background:var(--ink);color:var(--paper)}
ul.bul{list-style:none;display:flex;flex-direction:column;gap:26px}
ul.bul li{display:flex;gap:22px;align-items:flex-start;font-size:46px;font-weight:700;line-height:1.2}
ul.bul li i{flex:none;width:60px;height:60px;border-radius:15px;background:var(--ink);color:var(--paper);font-style:normal;font-family:Mono,monospace;font-size:34px;display:flex;align-items:center;justify-content:center;margin-top:1px}
b{font-weight:900}
.src{font-family:Mono,monospace;font-weight:700;font-size:28px;line-height:1.2;margin-top:auto;padding-top:6px;display:flex;gap:12px;align-items:center}
.src:before{content:"";width:34px;height:6px;background:var(--ink);flex:none}
.note{font-size:46px;font-weight:800;line-height:1.22}
.note.card{background:var(--ink);color:var(--paper);box-shadow:10px 10px 0 var(--shadow)}
.note.card mark{color:var(--ink)}
/* stat */
.stat{display:flex;align-items:center;gap:30px}
.stat .num{font-family:Anton,sans-serif;font-size:190px;line-height:.95;white-space:nowrap}
.stat .lbl{font-size:42px;font-weight:800;line-height:1.18}
.stat .lbl small{display:block;font-size:32px;font-weight:700;opacity:.75;margin-top:6px}
/* bars */
.sent{font-family:Mono,monospace;font-weight:700;font-size:46px;margin-bottom:26px;line-height:1.2}
.sent u{text-decoration:none;display:inline-block;min-width:120px;border-bottom:6px solid var(--ink);text-align:center}
.bars{display:flex;flex-direction:column;gap:24px}
.row{display:grid;grid-template-columns:160px 1fr 130px;align-items:center;gap:20px;font-size:46px;font-weight:800}
.row .tr{height:64px;border:5px solid var(--ink);border-radius:12px;background:#fff;overflow:hidden}
.row .fl{height:100%;background:var(--marker);border-right:5px solid var(--ink)}
.row .v{font-family:Mono,monospace;text-align:right}
.row.top .fl{background:var(--shadow)}
.cap{font-family:Mono,monospace;font-size:30px;font-weight:700;opacity:.8;margin-top:22px}
/* chunks */
.chunks{display:flex;gap:14px;justify-content:center;flex-wrap:nowrap}
.chunks div{border:5px solid var(--ink);border-radius:16px;padding:16px 26px;font-family:Mono,monospace;font-size:64px;background:#fff;text-align:center;line-height:1.05}
.chunks.ids div{background:var(--ink);color:var(--paper);font-size:56px}
.chunks.c0 div:nth-child(1){background:#FFE1A8}.chunks.c0 div:nth-child(2){background:#BFE3FF}.chunks.c0 div:nth-child(3){background:#F8C6DA}
.arrow{text-align:center;font-family:Mono,monospace;font-size:36px;margin:18px 0}
/* flow */
.flow{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;justify-content:space-between}
.flow .n{border:5px solid var(--ink);border-radius:18px;background:#fff;padding:22px 16px;font-size:36px;font-weight:900;text-align:center;text-transform:uppercase;line-height:1.05;box-shadow:5px 5px 0 var(--shadow)}
.flow .n.hot{background:var(--marker)}
.flow .ar{font-family:Mono,monospace;font-size:40px;flex:none}
.loop{font-family:Mono,monospace;font-size:34px;margin-top:24px;text-align:center}
/* qa / rank */
.qa{display:flex;flex-direction:column;gap:20px}
.qa .q,.qa .a{border:5px solid var(--ink);border-radius:18px;padding:20px 26px;font-size:44px;font-weight:800;line-height:1.2}
.qa .q{background:#fff;margin-right:90px}
.qa .a{background:var(--marker);margin-left:90px}
.qa .a:after{content:" \\2713";font-family:Mono,monospace}
.rank{display:flex;flex-direction:column;gap:22px}
.rank .r{display:flex;align-items:center;gap:22px;border:5px solid var(--ink);border-radius:18px;padding:20px 26px;background:#fff;font-size:44px;font-weight:800;line-height:1.15}
.rank .r .m{flex:none;width:68px;height:68px;border-radius:50%;border:5px solid var(--ink);display:flex;align-items:center;justify-content:center;font-family:Anton,sans-serif;font-size:42px;background:var(--marker)}
.rank .r:nth-child(2) .m{background:#E4E4E4}.rank .r:nth-child(3) .m{background:#E9B98A}
/* cover art + swipe */
.swipe{margin-top:auto;display:flex;justify-content:flex-end}
.swipe .pill{font-size:44px;padding:14px 38px}
.art{margin-top:40px;transform:rotate(-2deg);margin-right:50px}
.art .card{padding:20px 28px}
.art .row{font-size:38px}.art .row .tr{height:44px}.art .bars{gap:12px}.art .sent{font-size:40px;margin-bottom:16px}
/* recap */
.check{list-style:none;display:flex;flex-direction:column;gap:30px}
.check li{display:flex;gap:22px;align-items:center;font-size:46px;font-weight:800;line-height:1.15}
.check li i{flex:none;width:60px;height:60px;border:5px solid var(--ink);border-radius:14px;background:var(--marker);font-style:normal;font-family:Mono,monospace;font-size:44px;display:flex;align-items:center;justify-content:center;box-shadow:4px 4px 0 var(--ink)}
.cta{margin-top:0;background:var(--ink);color:var(--paper);border-radius:26px;border:6px solid var(--ink);box-shadow:10px 10px 0 var(--shadow);padding:26px 32px;text-align:center}
.cta .f{font-family:Anton,sans-serif;font-size:84px;text-transform:uppercase;line-height:1}
.cta .f mark{background:var(--marker);color:var(--ink);padding:0 14px}
.cta .u{font-family:Mono,monospace;font-size:36px;margin-top:16px;line-height:1.25}
`;

function visual(v) {
  if (!v) return "";
  switch (v.type) {
    case "stat":
      return `<div class="card stat"><div class="num">${esc(v.value)}</div><div class="lbl">${rich(v.label)}${v.small ? `<small>${esc(v.small)}</small>` : ""}</div></div>`;
    case "bars": {
      const max = Math.max(...v.rows.map((r) => r.pct));
      return `<div class="card">${v.sentence ? `<div class="sent">${esc(v.sentence).replace("___", "<u>&nbsp;</u>")}</div>` : ""}<div class="bars">${v.rows.map((r, i) =>
        `<div class="row${r.pct === max ? " top" : ""}"><span>${esc(r.label)}</span><div class="tr"><div class="fl" style="width:${Math.max(3, r.pct)}%"></div></div><span class="v">${esc(r.value || r.pct + "%")}</span></div>`).join("")}</div>${v.caption ? `<div class="cap">${esc(v.caption)}</div>` : ""}</div>`;
    }
    case "chunks":
      return `<div class="card"><div class="chunks c0">${v.parts.map((p) => `<div>${esc(p)}</div>`).join("")}</div><div class="arrow">↓ ${esc(v.arrow || "turned into numbers")}</div><div class="chunks ids">${v.ids.map((p) => `<div>${esc(p)}</div>`).join("")}</div>${v.caption ? `<div class="cap" style="text-align:center">${esc(v.caption)}</div>` : ""}</div>`;
    case "flow":
      return `<div class="card"><div class="flow">${v.nodes.map((n, i) => `${i ? '<span class="ar">→</span>' : ""}<div class="n${v.hot === i ? " hot" : ""}">${esc(n)}</div>`).join("")}</div>${v.loop ? `<div class="loop">↻ ${esc(v.loop)}</div>` : ""}</div>`;
    case "qa":
      return `<div class="card"><div class="qa">${v.pairs.map((p) => `<div class="q">${esc(p[0])}</div><div class="a">${esc(p[1])}</div>`).join("")}</div>${v.caption ? `<div class="cap">${esc(v.caption)}</div>` : ""}</div>`;
    case "rank":
      return `<div class="card"><div class="rank">${v.items.map((t, i) => `<div class="r"><span class="m">${i + 1}</span><span>${rich(t)}</span></div>`).join("")}</div>${v.caption ? `<div class="cap">${esc(v.caption)}</div>` : ""}</div>`;
    default:
      throw new Error("unknown visual type " + v.type);
  }
}

function top(i, total, s, brand) {
  return `<div class="top"><div class="pill">${s.kicker ? esc(s.kicker) : String(i + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0")}</div><div class="brand">${esc(brand)}</div></div>`;
}

function slideHtml(s, i, total, brand) {
  if (s.type === "cover") {
    return `<section class="slide cover">${top(i, total, { kicker: s.kicker }, brand)}<h1 class="h1">${rich(s.title)}</h1>${s.sub ? `<div class="sub">${rich(s.sub)}</div>` : ""}${s.art ? `<div class="art">${visual(s.art)}</div>` : ""}<div class="swipe"><div class="pill">${esc(s.swipe || "swipe →")}</div></div></section>`;
  }
  if (s.type === "recap") {
    return `<section class="slide recap">${top(i, total, { kicker: s.kicker || "RECAP" }, brand)}<h1 class="h1">${rich(s.title || "[[Recap]]")}</h1><div class="body"><div class="card"><ul class="check">${s.items.map((t) => `<li><i>✓</i><span>${rich(t)}</span></li>`).join("")}</ul></div><div class="cta"><div class="f">${rich(s.cta || "[[Follow]] for more")}</div><div class="u">${esc(s.site || "vloombox.in — daily tech jobs, referrals & more")}</div></div></div></section>`;
  }
  const kick = s.kicker ? s.kicker : String(i + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0");
  const vs = (s.visuals || (s.visual ? [s.visual] : [])).map(visual).join("");
  const bul = s.bullets && s.bullets.length ? `<ul class="bul">${s.bullets.map((b, k) => `<li><i>${k + 1}</i><span>${rich(b)}</span></li>`).join("")}</ul>` : "";
  const bulOut = s.bulletsInCard === false ? bul : bul ? `<div class="card">${bul}</div>` : "";
  const order = s.bulletsFirst ? bulOut + vs : vs + bulOut;
  return `<section class="slide content">${top(i, total, { kicker: kick }, brand)}<h1 class="h1">${rich(s.title)}</h1><div class="body">${order}${s.note ? `<div class="note card">${rich(s.note)}</div>` : ""}${s.source ? `<div class="src">${esc(s.source)}</div>` : ""}</div></section>`;
}

function render(spec, outDir) {
  const theme = spec.theme ? Theme.get(spec.theme) : Theme.next(spec.slug || spec.topic || "carousel");
  const slides = spec.slides;
  const brand = spec.brand || "vloombox.in";
  if (!slides || slides.length < 2) throw new Error("slides[] required");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(spec.topic || "carousel")}</title><style>${FONTS}\n:root{${Theme.css(theme)}}\n${CSS}</style></head><body>\n${slides.map((s, i) => slideHtml(s, i, slides.length, brand)).join("\n")}\n</body></html>`;
  if (outDir) {
    fs.mkdirSync(path.join(outDir, "fonts"), { recursive: true });
    const src = path.join(__dirname, "assets/fonts");
    for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(outDir, "fonts", f));
    fs.writeFileSync(path.join(outDir, "index.html"), html);
  }
  return html;
}

module.exports = { render, rich };
if (require.main === module) {
  const [specFile, outDir] = process.argv.slice(2);
  if (!specFile) { console.log("usage: node runtime/carousel.js <slides.json> [outDir]"); process.exit(2); }
  const spec = JSON.parse(fs.readFileSync(specFile, "utf8"));
  const out = path.resolve(outDir || path.dirname(specFile));
  render(spec, out);
  console.log("wrote", path.join(out, "index.html"), spec.slides.length, "slides");
}
