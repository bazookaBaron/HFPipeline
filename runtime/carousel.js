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
/* ---- v2 slides (point / paper / repo / rate / board / takeaway / end): ONE paper panel per slide, sentences not fragments ---- */
.v2 .h1{font-size:86px;line-height:1.0;margin-top:30px}
.v2 .h1.long{font-size:74px}
.panel{flex:0 1 auto;min-height:0;margin-top:34px;background:var(--paper);border:5px solid var(--ink);border-radius:24px;box-shadow:9px 9px 0 var(--shadow);padding:34px 38px 32px;display:flex;flex-direction:column;gap:26px}
.panel.grow{flex:1}
.v2:not(.end) .h1{margin-bottom:34px}
.v2:not(.end) .panel:not(.grow){margin-top:auto;margin-bottom:auto}
.v2 .panel.grow{margin-top:0}
.pb{font-size:41px;font-weight:500;line-height:1.36}
.panel .row{grid-template-columns:270px 1fr 150px;font-size:40px}
.panel .flow .n{font-size:34px;padding:26px 16px}
.why.flat{margin-top:6px}
.pb b{font-weight:800}
.pb mark,.why mark,.vd mark{background:linear-gradient(transparent 10%,var(--marker) 10%,var(--marker) 92%,transparent 92%);color:var(--ink);padding:0 6px}
.panel.grow .why{margin-top:auto}
.why{display:flex;gap:20px;align-items:flex-start;font-size:35px;font-weight:700;line-height:1.3;padding-top:24px;border-top:4px solid var(--ink)}
.why i{flex:none;font-style:normal;font-family:Mono,monospace;font-size:24px;background:var(--marker);border:4px solid var(--ink);border-radius:10px;padding:7px 12px;margin-top:2px;line-height:1.1;text-align:center}
.fig{flex:1;min-height:330px;display:flex;flex-direction:column;gap:10px}
.fig .im{flex:1;min-height:0;border:4px solid var(--ink);border-radius:16px;background:#fff;overflow:hidden;display:flex;align-items:center;justify-content:center}
.fig .im img{width:100%;height:100%;object-fit:contain;display:block}
.fig.cover .im img{object-fit:cover}
.credit{font-family:Mono,monospace;font-size:23px;line-height:1.25;opacity:.75}
.v2 .src{margin-top:18px;font-size:25px}
.panel .card{box-shadow:none;border-width:4px;padding:22px 26px}
/* cover image (polaroid) + badge */
.badge{display:inline-block;margin-top:34px;background:var(--ink);color:var(--paper);font-family:Mono,monospace;font-size:30px;padding:10px 20px;border-radius:12px;align-self:flex-start}
.polar{margin:38px 30px 0;flex:1;min-height:0;background:#fff;border:5px solid var(--ink);border-radius:10px;padding:18px 18px 54px;box-shadow:12px 12px 0 var(--shadow);transform:rotate(-2.2deg);display:flex;flex-direction:column;position:relative}
.polar img{flex:1;min-height:0;width:100%;object-fit:cover;object-position:top;border:3px solid var(--ink)}
.polar .credit{position:absolute;left:22px;right:22px;bottom:14px;font-size:22px}
.cover .swipe{margin-top:30px}
.swipe .save{background:var(--marker)}
/* paper + repo meta */
.meta{display:flex;flex-direction:column;gap:10px;border:4px solid var(--ink);border-radius:16px;background:#fff;padding:20px 24px}
.meta .t{font-size:34px;font-weight:800;line-height:1.2}
.meta .s{font-family:Mono,monospace;font-size:25px;line-height:1.3;opacity:.85}
.meta .rn{font-size:44px;font-weight:500;line-height:1.1}.meta .rn b{font-weight:900}
.stats{display:flex;gap:14px;flex-wrap:wrap}
.stats span{font-family:Mono,monospace;font-size:27px;border:3px solid var(--ink);border-radius:999px;padding:6px 16px;background:var(--paper)}
.stats span.hot{background:var(--marker)}
.get{background:var(--ink);color:var(--paper);border-radius:14px;padding:16px 22px;font-family:Mono,monospace;font-size:27px;line-height:1.35;white-space:pre-wrap;word-break:break-all}
.get:before{content:"GET IT  ";color:var(--marker)}
/* rate */
.rh{display:flex;align-items:center;gap:26px}
.rk{flex:none;width:92px;height:92px;border-radius:50%;border:5px solid var(--ink);background:#fff;display:flex;align-items:center;justify-content:center;font-family:Anton,sans-serif;font-size:52px}
.rn2{flex:1;font-family:Anton,sans-serif;text-transform:uppercase;font-size:72px;line-height:1}
.rs{flex:none;text-align:right;font-family:Anton,sans-serif;font-size:104px;line-height:.9}
.rs small{font-size:40px;opacity:.6}
.stars{display:flex;gap:6px}
.best{font-size:36px;font-weight:700;line-height:1.3}
.pc{list-style:none;display:flex;flex-direction:column;gap:16px}
.pc li{display:flex;gap:18px;align-items:flex-start;font-size:35px;font-weight:600;line-height:1.3}
.pc li i{flex:none;width:46px;height:46px;border:4px solid var(--ink);border-radius:10px;font-style:normal;font-family:Mono,monospace;font-size:30px;display:flex;align-items:center;justify-content:center;margin-top:1px}
.pc li.y i{background:var(--marker)}.pc li.n i{background:var(--alert);color:#fff}
.vd{margin-top:auto;font-size:35px;font-weight:800;line-height:1.3;padding-top:22px;border-top:4px solid var(--ink)}
.pick .panel{border-width:6px}
.pick .rk{background:var(--marker)}
.srow{display:flex;align-items:center;justify-content:space-between;gap:20px}
.crit{display:flex;flex-direction:column;gap:12px;border:4px solid var(--ink);border-radius:16px;background:#fff;padding:18px 22px}
.cr{display:grid;grid-template-columns:300px 1fr 70px;align-items:center;gap:16px;font-size:34px;font-weight:700}
.cr .tr{height:30px;border:3px solid var(--ink);border-radius:8px;background:var(--paper);overflow:hidden}
.cr .fl{height:100%;background:var(--pale);border-right:3px solid var(--ink)}
.pick .cr .fl{background:var(--marker)}
.cr .v{font-family:Mono,monospace;font-size:30px;text-align:right}
.stamp{transform:rotate(4deg);background:var(--alert);color:#fff;border:5px solid var(--ink);border-radius:14px;padding:8px 18px;font-family:Anton,sans-serif;font-size:38px;line-height:1;text-align:center;box-shadow:5px 5px 0 var(--ink)}
.stamp small{display:block;font-family:Mono,monospace;font-size:22px;margin-top:6px}
/* board */
.brd{display:flex;flex-direction:column;gap:20px}
.br{display:grid;grid-template-columns:300px 1fr 110px;align-items:center;gap:20px;font-size:38px;font-weight:800}
.br .tr{height:54px;border:4px solid var(--ink);border-radius:12px;background:#fff;overflow:hidden}
.br .fl{height:100%;background:var(--pale);border-right:4px solid var(--ink)}
.br.p .fl{background:var(--marker)}
.br.p{font-weight:900}
.br .v{font-family:Anton,sans-serif;font-weight:400;font-size:46px;text-align:right}
.bn{font-family:Mono,monospace;font-size:24px;opacity:.75;margin-top:-8px}
/* end */
.end .h1{font-size:110px}
.end .sub{font-weight:600}
.end .panel{margin-top:40px}
.end .meta .s{font-size:30px}
.endbar{margin-top:auto;background:var(--ink);color:var(--paper);border-radius:24px;border:5px solid var(--ink);box-shadow:9px 9px 0 var(--shadow);padding:30px 34px;display:flex;flex-direction:column;gap:14px}
.endbar .hd{font-family:Anton,sans-serif;font-size:72px;line-height:1;text-transform:uppercase}
.endbar .hd mark{background:var(--marker);color:var(--ink);padding:0 12px}
.endbar .u{font-family:Mono,monospace;font-size:32px;line-height:1.3}
`;

function visual(v) {
  if (!v) return "";
  switch (v.type) {
    case "html": return v.html;
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

/* --- v2 helpers --- */
const STAR = "M12 2l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 18.1 5.6 21.6 7 14.5 1.7 9.5l7.2-.9z";
function stars(score, size = 46) {
  let h = "";
  for (let k = 0; k < 5; k++) {
    const f = Math.max(0, Math.min(1, score - k)), id = "g" + Math.random().toString(36).slice(2, 8);
    h += `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><defs><linearGradient id="${id}"><stop offset="${f}" stop-color="var(--ink)"/><stop offset="${f}" stop-color="#fff"/></linearGradient></defs><path d="${STAR}" fill="url(#${id})" stroke="var(--ink)" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  }
  return `<div class="stars">${h}</div>`;
}
const fig = (im) => im ? `<div class="fig${im.fit === "cover" ? " cover" : ""}"><div class="im"><img src="${esc(im.src)}"></div>${im.credit ? `<div class="credit">${esc(im.credit)}</div>` : ""}</div>` : "";
const why = (w, label) => w ? `<div class="why"><i>${esc(label || "WHY IT\nMATTERS").replace("\n", "<br>")}</i><span>${rich(w)}</span></div>` : "";
const pb = (t) => t ? `<div class="pb">${rich(t)}</div>` : "";
const src = (s) => s ? `<div class="src">${esc(s)}</div>` : "";
const h1 = (t) => `<h1 class="h1${String(t).replace(/\[\[|\]\]|\*\*/g, "").length > 46 ? " long" : ""}">${rich(t)}</h1>`;

function slideV2(s, i, total, brand) {
  const T = top(i, total, s, brand);
  switch (s.type) {
    case "point": // claim headline -> 2-3 sentences -> one visual or image -> why it matters
      return `<section class="slide v2 point">${T}${h1(s.title)}<div class="panel${s.image ? " grow" : ""}">${pb(s.body)}${s.visual ? visual(s.visual) : ""}${fig(s.image)}${why(s.why, s.whyLabel)}</div>${src(s.source)}</section>`;
    case "paper": { // research paper card: real figure + title/org/link + context
      const p = s.paper || {};
      const meta = `<div class="meta"><div class="t">${esc(p.title)}</div><div class="s">${esc([p.org, p.date, p.votes].filter(Boolean).join(" · "))}</div><div class="s">${esc(p.link)}</div></div>`;
      return `<section class="slide v2 paper">${T}${h1(s.title)}<div class="panel grow">${fig(s.image)}${meta}${pb(s.body)}${why(s.why, s.whyLabel)}</div>${src(s.source)}</section>`;
    }
    case "repo": { // GitHub repo card: real screenshot + stars + install command
      const r = s.repo || {}, [o, n] = String(r.name || "/").split("/");
      const st = [r.stars && `★ ${r.stars}`, r.week && `+${String(r.week).replace(/^\+/, "")} this week`, r.lang, r.license].filter(Boolean);
      const meta = `<div class="meta"><div class="rn">${esc(o)}/<b>${esc(n)}</b></div>${r.desc ? `<div class="s">${esc(r.desc)}</div>` : ""}<div class="stats">${st.map((x, k) => `<span${k === 1 ? ' class="hot"' : ""}>${esc(x)}</span>`).join("")}</div></div>`;
      return `<section class="slide v2 repo">${T}${h1(s.title)}<div class="panel grow">${fig(s.image)}${meta}${pb(s.body)}${s.get ? `<div class="get">${esc(s.get)}</div>` : ""}${why(s.why, s.whyLabel)}</div>${src(s.source)}</section>`;
    }
    case "rate": { // one platform rated: score + stars + best-for + pros/cons + verdict; pick:true = our pick
      const pc = [...(s.pros || []).map((t) => `<li class="y"><i>✓</i><span>${rich(t)}</span></li>`), ...(s.cons || []).map((t) => `<li class="n"><i>✕</i><span>${rich(t)}</span></li>`)].join("");
      const stamp = s.pick ? `<div class="stamp">${esc(s.stamp || "OUR PICK")}${s.disclose === false ? "" : `<small>${esc(s.disclose || "we built it")}</small>`}</div>` : "";
      const crit = s.criteria ? `<div class="crit">${s.criteria.map((c) => `<div class="cr"><span>${esc(c.label)}</span><div class="tr"><div class="fl" style="width:${(Number(c.score) / 5) * 100}%"></div></div><span class="v">${esc(c.score)}</span></div>`).join("")}</div>` : "";
      return `<section class="slide v2 rate${s.pick ? " pick" : ""}">${T}${h1(s.title)}<div class="panel grow"><div class="rh"><div class="rk">${esc(s.rank || "")}</div><div class="rn2">${esc(s.name)}</div><div class="rs">${esc(s.score)}<small>/5</small></div></div><div class="srow">${stars(Number(s.score))}${stamp}</div>${crit}${s.best ? `<div class="best">Best for: ${rich(s.best)}</div>` : ""}<ul class="pc">${pc}</ul>${s.verdict ? `<div class="vd">${rich(s.verdict)}</div>` : ""}</div>${src(s.source)}</section>`;
    }
    case "board": { // scoreboard of all rated items, pick row highlighted
      const rows = s.rows.map((r) => `<div class="br${r.pick ? " p" : ""}"><span>${esc(r.name)}</span><div class="tr"><div class="fl" style="width:${(Number(r.score) / 5) * 100}%"></div></div><span class="v">${esc(r.score)}</span></div>${r.note ? `<div class="bn">${esc(r.note)}</div>` : ""}`).join("");
      const bar = s.cta ? `<div class="endbar" style="margin-top:30px"><div class="hd">${rich(s.cta)}</div><div class="u">${esc(s.site || "vloombox.in — 14,000+ live tech jobs, refreshed all day")}</div></div>` : "";
      return `<section class="slide v2 board">${T}${h1(s.title)}<div class="panel" style="flex:${s.cta ? "none" : 1}">${pb(s.body)}<div class="brd">${rows}</div>${why(s.why, s.whyLabel || "HOW TO\nUSE")}</div>${bar}${src(s.source)}</section>`;
    }
    case "takeaway": // the save slide: things to DO
      return `<section class="slide v2 takeaway">${T}${h1(s.title)}<div class="panel">${pb(s.body)}<ul class="check">${s.items.map((t) => `<li><i>✓</i><span>${rich(t)}</span></li>`).join("")}</ul>${why(s.why, s.whyLabel)}</div>${src(s.source)}</section>`;
    case "end": // CTA: one action with a reason
      const box = s.link || s.items ? `<div class="panel">${s.link ? `<div class="meta"><div class="t">${esc(s.linkLabel || "Read it yourself")}</div><div class="s">${esc(s.link)}</div></div>` : ""}${s.items ? `<ul class="check">${s.items.map((t) => `<li><i>✓</i><span>${rich(t)}</span></li>`).join("")}</ul>` : ""}</div>` : "";
      return `<section class="slide v2 end">${T}${h1(s.title || "[[Save]] this")}${s.sub ? `<div class="sub">${rich(s.sub)}</div>` : ""}${box}<div class="endbar"><div class="hd">${rich(s.cta || "[[Follow]] @vloombox")}</div><div class="u">${esc(s.site || "vloombox.in — 14,000+ live tech jobs, refreshed all day")}</div></div></section>`;
  }
  return null;
}

function top(i, total, s, brand) {
  return `<div class="top"><div class="pill">${s.kicker ? esc(s.kicker) : String(i + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0")}</div><div class="brand">${esc(brand)}</div></div>`;
}

function slideHtml(s, i, total, brand) {
  if (s.type === "cover") {
    const img = s.image ? `<div class="polar"><img src="${esc(s.image.src)}">${s.image.credit ? `<div class="credit">${esc(s.image.credit)}</div>` : ""}</div>` : "";
    return `<section class="slide cover">${top(i, total, { kicker: s.kicker }, brand)}${s.badge ? `<div class="badge">${esc(s.badge)}</div>` : ""}<h1 class="h1"${s.badge ? ' style="margin-top:22px"' : ""}>${rich(s.title)}</h1>${s.sub ? `<div class="sub">${rich(s.sub)}</div>` : ""}${s.art ? `<div class="art">${visual(s.art)}</div>` : ""}${img}<div class="swipe"><div class="pill${s.save ? " save" : ""}">${esc(s.swipe || (s.save ? "save this · swipe →" : "swipe →"))}</div></div></section>`;
  }
  const v2 = slideV2(s, i, total, brand);
  if (v2) return v2;
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
  const { E, W } = require("./carousel_lint").lint(spec, path.dirname(path.resolve(specFile)));
  W.forEach((w) => console.log("WARN ", w)); E.forEach((e) => console.log("ERROR", e));
  if (E.length) { console.log(`lint: ${E.length} error(s): fix slides.json before export`); process.exitCode = 1; }
}
