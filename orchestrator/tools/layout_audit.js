#!/usr/bin/env node
"use strict";

/**
 * Layout audit (hard gate): builds the compiled stage in headless Chrome, seeks the timeline to
 * probe times inside every scaffold and measures the real DOM for
 *   - text that runs outside the frame (spec.frame, default 1080x1920) or outside its own card,
 *   - node cards that overlap each other,
 *   - content cards that overlap each other,
 *   - text hidden under the mascot.
 * Caught the rebase pilot (window cards on top of each other) and the ratelimit outro (a 21-glyph
 * headline running off the frame), which `hyperframes check` passed.
 *
 *   node tools/layout_audit.js <fixture.json>      (fixture = stage-preview shape {duration, profile, spec})
 *   node tools/layout_audit.js --storyboard sb.json --timeline tl.json
 */

const fs = require("fs");
const path = require("path");
const VIDEO_ENGINE_DIR = path.resolve(__dirname, "..", "..", "video-engine");
const PUPPETEER_FROM = path.resolve(__dirname, "..", "..", "carousel-engine");

const LIBS = [
  "compositions/components/lib/text-fit.js",
  "compositions/components/lib/props.js",
  "compositions/components/lib/stage/core.js",
  "compositions/components/lib/stage/modules-dh.js",
  "compositions/components/lib/stage/modules-dh2.js",
  "compositions/components/lib/icons.js",
  "compositions/components/lib/stage/modules-dh3.js",
  "compositions/components/lib/stage/modules-dh4.js",
  "compositions/components/lib/stage/theme-lc.js",
  "compositions/components/lib/stage/profile-lc.js",
  "compositions/components/lib/stage/profile-dc.js",
  "compositions/components/lib/stage/modules-end.js",
  "compositions/components/lib/stage/modules-carousel.js",
  "compositions/components/lib/stage/modules-media.js",
  "compositions/components/lib/stage/modules-p2.js",
  "compositions/components/lib/stage/profile-br.js",
  "compositions/components/lib/stage/modules-br.js",
  "compositions/components/lib/stage/profile-bp.js",
  "compositions/components/lib/stage/modules-bp.js",
  "compositions/components/lib/stage/profile-lf.js",
  "compositions/components/lib/stage/modules-lf.js",
  "compositions/components/lib/stage/modules-chart.js",
  "compositions/components/lib/stage/modules-map.js",
];

function harnessHtml(spec, duration, frame = { w: 1080, h: 1920 }) {
  const data = JSON.stringify({ spec, duration, frame }).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="UTF-8" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
${LIBS.map((s) => `<script src="${s}"></script>`).join("\n")}
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:${frame.w}px;height:${frame.h}px;overflow:hidden;background:#000}
#root{position:relative;width:${frame.w}px;height:${frame.h}px;overflow:hidden;font-family:Inter,ui-sans-serif,system-ui,sans-serif}</style>
</head><body><div id="root"></div><script>
window.__timelines = {};
var D = ${data};
var tl = gsap.timeline({ paused: true });
var res = HFStage.build({ root: document.getElementById("root"), tl: tl, spec: D.spec, duration: D.duration });
tl.set({}, {}, D.duration);
window.__audit = { tl: tl, problems: res.problems, frame: D.frame };
</script></body></html>`;
}

// in-page measurement at one time; returns raw findings
function probe(t) {
  const A = window.__audit;
  A.tl.seek(t, false);
  const root = document.getElementById("root");
  const R = (el) => el.getBoundingClientRect();
  function shown(el) {
    let a = 1;
    for (let n = el; n && n !== root; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden") return 0;
      a *= parseFloat(cs.opacity);
    }
    return a;
  }
  const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const out = [];
  const mods = [...root.querySelectorAll(".st-mod")].filter((m) => shown(m) > 0.5);
  const modName = (m) => m.getAttribute("data-module") + ":" + (m.className.match(/st-(\w+)/g) || [])[1];
  // text rects
  for (const m of mods) {
    const mr = R(m);
    const walker = document.createTreeWalker(m, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const txt = n.textContent.trim();
      if (!txt || shown(n.parentElement) < 0.5) continue;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      const r = rg.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const clip = [...function* () { for (let p = n.parentElement; p && p !== root; p = p.parentElement) yield p; }()].find((p) => {
        const o = getComputedStyle(p).overflow;
        return o === "hidden" || o === "clip";
      });
      const cr = clip ? R(clip) : null;
      // text clipped by an overflow:hidden ancestor that is smaller than the text = cut-off text
      if (cr && (r.right > cr.right + 2 || r.left < cr.left - 2) && clip !== root) out.push({ kind: "text-clipped", module: modName(m), text: txt.slice(0, 40), over: Math.round(Math.max(r.right - cr.right, cr.left - r.left)) });
      const FR = A.frame || { w: 1080, h: 1920 };
      if (r.left < -2 || r.right > FR.w + 2 || r.top < -2 || r.bottom > FR.h + 2) out.push({ kind: "text-off-frame", module: modName(m), text: txt.slice(0, 40), rect: [r.left, r.top, r.right, r.bottom].map(Math.round) });
      else if (r.left < mr.left - 24 || r.right > mr.right + 24) out.push({ kind: "text-outside-card", module: modName(m), text: txt.slice(0, 40), over: Math.round(Math.max(r.right - mr.right, mr.left - r.left)) });
    }
  }
  // node cards overlapping inside one diagram
  for (const m of mods) {
    const nodes = [...m.querySelectorAll(".st-node")].filter((n) => shown(n) > 0.3);
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = R(nodes[i]), b = R(nodes[j]);
        const ov = inter(a, b);
        if (ov > 64) out.push({ kind: "node-overlap", module: modName(m), nodes: [nodes[i].getAttribute("data-entity"), nodes[j].getAttribute("data-entity")], px: Math.round(ov) });
      }
  }
  // content cards overlapping each other (chrome layer excluded: HUD / headers sit on purpose)
  const content = mods.filter((m) => m.closest(".st-content"));
  for (let i = 0; i < content.length; i++)
    for (let j = i + 1; j < content.length; j++) {
      const a = R(content[i]), b = R(content[j]);
      const ov = inter(a, b);
      const small = Math.min(a.width * a.height, b.width * b.height) || 1;
      // a frame module (DC stage) holds its sub-state's card on purpose
      // connectors and stamps are drawn over other cards by design
      const frame = [content[i], content[j]].some((m) => ["st-dcStage", "st-connector", "st-stamp"].some((c) => m.classList.contains(c)) || m.classList.contains("st-slamStamp") || m.hasAttribute("data-overlay")); // BR: stamp slam, pink band plate, T4 overlay card
      if (!frame && ov / small > 0.04 && ov > 1500) out.push({ kind: "card-overlap", modules: [modName(content[i]), modName(content[j])], frac: +(ov / small).toFixed(2) });
    }
  // text covered by the mascot (inner 70% of its box, the art's opaque core)
  const masc = root.querySelector(".st-mascot");
  if (masc && shown(masc) > 0.5) {
    const b = R(masc);
    const core = { left: b.left + b.width * 0.15, right: b.right - b.width * 0.15, top: b.top + b.height * 0.1, bottom: b.bottom - b.height * 0.05 };
    for (const m of content) {
      const walker = document.createTreeWalker(m, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim() || shown(n.parentElement) < 0.5) continue;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        const r = rg.getBoundingClientRect();
        if (inter(r, core) > 0.2 * r.width * r.height && r.width * r.height > 50) out.push({ kind: "text-under-mascot", module: modName(m), text: n.textContent.trim().slice(0, 40) });
      }
    }
  }
  return out;
}

function probeTimes(spec, duration) {
  const ts = new Set();
  for (const s of spec.scaffolds || []) {
    const t0 = s.t0, t1 = Math.min(s.t1, duration);
    if (!(t1 > t0)) continue;
    ts.add(+Math.min(t0 + 0.6, (t0 + t1) / 2).toFixed(3));
    // a scene transition moves cards off-frame on purpose: probe before the exit starts
    const nxt = (spec.scaffolds || []).find((x) => Math.abs(x.t0 - s.t1) < 1e-4);
    const tail = nxt && nxt.transition && nxt.transition.out ? 0.55 : 0.12;
    ts.add(+Math.max(t0, t1 - tail).toFixed(3));
    for (const e of spec.events || []) if (e.t >= t0 && e.t < t1 - 0.5) ts.add(+Math.min(e.t + 0.45, t1 - tail).toFixed(3));
  }
  return [...ts].sort((a, b) => a - b);
}

async function launchBrowser() {
  const puppeteer = require(require.resolve("puppeteer", { paths: [PUPPETEER_FROM] }));
  return puppeteer.launch({ headless: true, args: ["--allow-file-access-from-files", "--force-device-scale-factor=1"] });
}

async function auditLayout({ spec, duration, log = () => {}, frame, times: forcedTimes, shots, browser: shared }) {
  // the viewport follows the compiled frame unless the caller forces one (carousel 1080x1350)
  frame = frame || spec.frame || { w: 1080, h: 1920 };
  const file = path.join(VIDEO_ENGINE_DIR, `.layout-audit-${process.pid}-${Date.now().toString(36)}.html`);
  fs.writeFileSync(file, harnessHtml(spec, duration, frame), "utf-8");
  const browser = shared || (await launchBrowser());
  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: frame.w, height: frame.h });
    await page.goto("file:///" + file.replace(/\\/g, "/"), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const buildProblems = await page.evaluate(() => (window.__audit ? window.__audit.problems : ["stage did not build"]));
    const times = forcedTimes || probeTimes(spec, duration);
    const found = [];
    for (const t of times) {
      const r = await page.evaluate(probe, t);
      r.forEach((x) => found.push({ t, ...x }));
    }
    // optional screenshots (carousel slides): seek, let fonts/images paint, capture the frame
    for (const sh of shots || []) {
      await page.evaluate((t) => { window.__audit.tl.seek(t, false); }, sh.t);
      await new Promise((r) => setTimeout(r, 120));
      await page.screenshot({ path: sh.path, clip: { x: 0, y: 0, width: frame.w, height: frame.h } });
    }
    // one line per distinct defect (first time seen)
    const seen = new Map();
    for (const f of found) {
      const key = JSON.stringify({ ...f, t: 0, over: 0, px: 0, frac: 0, rect: 0 });
      if (!seen.has(key)) seen.set(key, f);
    }
    const problems = [...seen.values()];
    log(`[layout] ${frame.w}x${frame.h}, ${times.length} probes, ${problems.length} defect(s)`);
    return { ok: problems.length === 0 && !buildProblems.length, problems, buildProblems, probes: times.length };
  } finally {
    if (shared) await page.close().catch(() => {});
    else await browser.close();
    fs.rmSync(file, { force: true });
  }
}

function describe(p) {
  const at = `at ${p.t.toFixed(2)} s`;
  if (p.kind === "node-overlap") return `${at}: diagram ${p.module} has cards ${p.nodes.join(" and ")} overlapping (${p.px} px2) -- spread the node x/y further apart or use fewer nodes`;
  if (p.kind === "card-overlap") return `${at}: cards ${p.modules.join(" and ")} overlap (${Math.round(p.frac * 100)}% of the smaller)`;
  if (p.kind === "text-off-frame") return `${at}: text "${p.text}" in ${p.module} runs off the frame -- shorten it`;
  if (p.kind === "text-outside-card") return `${at}: text "${p.text}" in ${p.module} spills ${p.over} px outside its card -- shorten it`;
  if (p.kind === "text-clipped") return `${at}: text "${p.text}" in ${p.module} is cut off by ${p.over} px -- shorten it`;
  if (p.kind === "text-under-mascot") return `${at}: text "${p.text}" in ${p.module} is hidden under the presenter`;
  return `${at}: ${JSON.stringify(p)}`;
}

module.exports = { auditLayout, describe, probeTimes, launchBrowser };

if (require.main === module) {
  (async () => {
    const a = process.argv.slice(2);
    let fx;
    if (a[0] === "--storyboard") {
      const { compileStoryboard } = require("../lib/video/v3/compile");
      const sb = JSON.parse(fs.readFileSync(a[1], "utf-8"));
      const tj = JSON.parse(fs.readFileSync(a[3], "utf-8"));
      const tl = tj.timeline || tj;
      fx = { duration: tl.totalSeconds, spec: compileStoryboard(sb, tl, { mascot: true }) };
    } else fx = JSON.parse(fs.readFileSync(a[0], "utf-8"));
    const r = await auditLayout({ spec: fx.spec, duration: fx.duration, log: (m) => process.stderr.write(m + "\n") });
    r.problems.forEach((p) => console.log(describe(p)));
    if (r.buildProblems.length) console.log("build:", r.buildProblems.join(" | "));
    process.exit(r.ok ? 0 : 2);
  })().catch((e) => {
    console.error(e.stack || e);
    process.exit(1);
  });
}
