"use strict";

/**
 * BR (light brutalist product explainer, ref R7) templates. Geometry from
 * analysis/pacing-audit-20260924/design/R7/AUDIT.md §4 A1-A6 and §5.9 (1080 px space):
 *   header 40.5-1039.5 x 235.5-292.5 (brand + chapter title + counter; injected by brChrome below)
 *   tab chips y 306-345 (only while a scaffold names `tabs`)
 *   eyebrow cap-top ~385 (rect y 378), first window top 430.5, windows stacked with 40.5 px gaps,
 *   content never below y 1347 (crop marks at 1366.5, presenter feet 1363.5)
 *   mascot column 0-300 (L-M, content x 319.5-1020) / hidden full width (L-F, content x 60-1038)
 *
 *   brStack   T1/T2/T3: eyebrow? + keyword headline? + stacked window cards + right-aligned display line?
 *   brGrid    T7: same slots, a grid card (toolTiles / docGrid / appGrid) as the object; full width by default
 *   brMedia   T4: full-width media window 60-922.5 x 387-1089 + an overlay card 505.5-1045.5 x 1000.5-1347
 *             + display words at the bottom left
 *   brSummary T8: two-part summary, keyword headline over a window, twice
 *   brBand    T5: big lockup line + full-bleed pink band (591-1338) + one window on the band
 * Heights come from templates-generic preferred(); overflow is a compile error (never squeezed).
 */

const { preferred, place } = require("./templates-generic");

const BR = {
  col: { x: 319.5, w: 700.5 },
  full: { x: 60, w: 978 },
  eyebrowY: 378,
  top: 430.5,
  bottom: 1347,
  gap: 40.5,
  header: [40.5, 235.5, 999, 57],
  tabs: [60, 306, 960, 39],
};

const STRETCH = new Set(["nodes", "chips", "chart", "tree", "toolTiles", "docGrid", "appGrid"]);

function propsOf(f) {
  return (f && (f.props || f)) || {};
}

/** heights at width w with BR gaps; stretchable grids/diagrams absorb spare room (<= 1.35x) or shrink (<= 25%) */
function fitBR(fills, w, avail) {
  const list = (fills || []).map((f) => ({ ...f, h: f.h || preferred(f, w) }));
  const used = () => list.reduce((a, f) => a + f.h, 0) + Math.max(0, list.length - 1) * BR.gap;
  let slack = avail - used();
  const str = list.filter((f) => STRETCH.has(f.type) && !f.fixed && !f.h0);
  if (str.length && slack < 0) {
    const base = str.reduce((a, f) => a + f.h, 0);
    const cut = Math.min(-slack, base * 0.25);
    str.forEach((f) => (f.h = Math.floor(f.h - (cut * f.h) / base)));
    slack = avail - used();
  } else if (str.length && slack > 0) {
    const base = str.reduce((a, f) => a + f.h, 0);
    const grow = Math.min(slack, base * 0.35);
    str.forEach((f) => (f.h = Math.round(f.h + (grow * f.h) / base)));
    slack = avail - used();
  }
  return { list, slack };
}

function headlineFill(sc, s, key, type) {
  const f = s[key];
  const hp = { ...propsOf(f) };
  if (typeof f === "string") hp.lines = [f];
  if (!hp.lines && hp.text) hp.lines = [hp.text];
  return { id: (f && f.id) || `${sc.id}_${key}`, type, props: hp, anchor: f && f.anchor, enter: f && f.enter };
}

function brStack(sc) {
  const s = sc.slots || {};
  const full = sc.layout === "full";
  const { x, w } = full ? BR.full : BR.col;
  const mods = [];
  let y = BR.eyebrowY;
  if (s.eyebrow) {
    const ep = typeof s.eyebrow === "string" ? { text: s.eyebrow } : propsOf(s.eyebrow);
    mods.push({ id: s.eyebrow.id || `${sc.id}_eyebrow`, type: "eyebrow", rect: [x, y, w, 30], props: ep, anchor: s.eyebrow.anchor });
    y += 30 + 22;
  }
  if (s.headline) {
    const hf = headlineFill(sc, s, "headline", "keywordHeadline");
    const h = preferred(hf, w);
    mods.push({ ...hf, rect: [x, y, w, h] });
    y += h + 28;
  }
  y = Math.max(y, s.eyebrow || s.headline ? y : BR.top);
  let disp = null;
  let dh = 0;
  if (s.display) {
    disp = headlineFill(sc, s, "display", "displayLine");
    dh = preferred(disp, w);
  }
  const avail = BR.bottom - y - (disp ? dh + 26 : 0);
  const top = s.top || [];
  const { list, slack } = fitBR(top, w, avail);
  if (slack < -1) {
    const parts = list.map((f) => `${f.id || f.type} (${f.type}) ${Math.round(f.h)} px`).join(", ");
    throw new Error(`scaffold ${sc.id}: content needs ${Math.round(avail - slack)} px but the BR ${full ? "full-width" : "column"} band has ${Math.round(avail)} px (overflow ${Math.round(-slack)} px); modules: ${parts} + ${BR.gap} px gaps. Remove a module, drop rows/questions/fields, or use a smaller grid`);
  }
  const blk = place(sc, list.map((f) => ({ ...f, gapAfter: BR.gap })), x, w, y, "down", "m");
  let bottom = blk.edge - BR.gap;
  if (disp) {
    const dy = Math.max(bottom + 26, y);
    mods.push({ ...disp, rect: [x, dy, w, dh] });
    bottom = dy + dh;
  }
  if (bottom > BR.bottom + 1) throw new Error(`scaffold ${sc.id}: content runs to y ${Math.round(bottom)}, past the BR content bottom ${BR.bottom}`);
  return { layout: full ? "full" : "column", modules: mods.concat(blk.mods) };
}

function brGrid(sc) {
  return brStack({ ...sc, layout: sc.layout || "full" });
}

// T4: full-width media window + an overlapping overlay card + display words bottom-left
function brMedia(sc) {
  const s = sc.slots || {};
  const mods = [];
  const mf = s.media || {};
  const mp = propsOf(mf);
  const mw = 862.5;
  const mh = Math.min(702, preferred({ type: "media", props: mp }, mw));
  mods.push({ id: mf.id || `${sc.id}_media`, type: "media", rect: [60, 387, mw, mh], props: mp, anchor: mf.anchor, enter: mf.enter || "none" });
  const mediaBottom = 387 + mh;
  if (s.overlay) {
    const o = s.overlay;
    const oh = Math.min(346.5, o.h || preferred(o, 540));
    const oy = Math.min(1000.5, BR.bottom - oh);
    mods.push({ id: o.id || `${sc.id}_overlay`, type: o.type, rect: [505.5, oy, 540, oh], props: { ...(o.props || {}), overlay: true }, anchor: o.anchor, enter: o.enter, z: 5 });
  }
  if (s.display) {
    const d = headlineFill(sc, s, "display", "displayLine");
    d.props = { align: "left", ...d.props };
    const dw = s.overlay ? 420 : 960;
    const dh = preferred(d, dw);
    const dy = Math.max(mediaBottom + 22, 1110);
    if (dy + dh > BR.bottom + 1) throw new Error(`scaffold ${sc.id}: display words run to y ${Math.round(dy + dh)} under the media window`);
    mods.push({ ...d, rect: [60, dy, dw, dh] });
  }
  return { layout: "full", modules: mods };
}

// T8: "LLMs generate." over a writer window, "X decides." over a sheet (two parts, full width)
function brSummary(sc) {
  const s = sc.slots || {};
  const x = 60;
  const w = 960;
  const mods = [];
  let y = 390;
  ["a", "b"].forEach((k, i) => {
    const part = s[k] || {};
    if (part.headline) {
      const hf = { ...headlineFill(sc, part, "headline", "keywordHeadline"), id: (part.headline && part.headline.id) || `${sc.id}_${k}hl` };
      hf.props = { align: "left", ...hf.props };
      const h = preferred(hf, w);
      mods.push({ ...hf, rect: [x, y, w, h] });
      y += h + 22;
    }
    if (part.module) {
      const m = part.module;
      const h = m.h || preferred(m, w);
      mods.push({ id: m.id || `${sc.id}_${k}`, type: m.type, rect: [x, y, w, h], props: m.props || {}, anchor: m.anchor, enter: m.enter });
      y += h + (i === 0 ? 44 : 0);
    }
  });
  if (y > BR.bottom + 1) throw new Error(`scaffold ${sc.id}: the two-part summary runs to y ${Math.round(y)} (max ${BR.bottom}); use fewer lines/questions`);
  return { layout: "full", modules: mods };
}

// T5: lockup line on the plate + full-bleed pink band + one window on the band
function brBand(sc) {
  const s = sc.slots || {};
  const mods = [];
  if (s.lockup) {
    const hf = headlineFill(sc, s, "lockup", "keywordHeadline");
    hf.props = { size: 80, ...hf.props };
    mods.push({ ...hf, rect: [60, 430, 960, preferred(hf, 960)] });
  }
  mods.push({ id: `${sc.id}_band`, type: "pinkBand", rect: [0, 591, 1080, 747], props: {}, enter: "none" });
  const top = (s.top || []).slice(0, 1);
  top.forEach((m) => {
    const h = Math.min(660, m.h || preferred(m, 954));
    mods.push({ id: m.id || `${sc.id}_card`, type: m.type, rect: [63, 630 + Math.max(0, Math.round((660 - h) / 2)), 954, h], props: m.props || {}, anchor: m.anchor, enter: m.enter });
  });
  return { layout: "full", modules: mods };
}

/**
 * BR chrome, called by compile.js after the scaffolds are timed: the brand header on every topic
 * scaffold (title = the scaffold's `chapter`, 1-f swap on a chapter change; counter = a running tally
 * driven by `tick` events when entities.counter is set, else it counts scenes), and tab chips while
 * a scaffold names `tabs: {items, active}` (activate on change, 1 f at the cut).
 */
function brChrome(sb, scaffolds, chromeEvents, BRAND) {
  const ent = sb.entities || {};
  const counter = ent.counter || null;
  const brand = String(ent.brand || "vloombox").slice(0, 14);
  const title0 = String((sb.scaffolds[0] && sb.scaffolds[0].chapter) || ent.chapter || sb.topic || "").toUpperCase();
  let chapter = null;
  let prevTabs = null;
  let seenTabs = false;
  let n = 0;
  scaffolds.forEach((s, i) => {
    if (BRAND.has(s.template)) return;
    const src = sb.scaffolds[i] || {};
    const name = String(src.chapter || chapter || title0).toUpperCase();
    s.modules.unshift({
      id: "brhead",
      type: "brHeader",
      rect: BR.header,
      props: { brand, title: title0, label: counter ? counter.label || "DECISIONS" : "SCENE", value: counter ? Number(counter.value) || 0 : 1, pad: counter ? counter.pad || 4 : 2 },
      enter: "none",
      at: 0,
    });
    if (i > 0 && name !== chapter) chromeEvents.push({ t: s.t0, op: "title", target: "brhead", value: { text: name } });
    chapter = name;
    if (!counter && n > 0) chromeEvents.push({ t: s.t0, op: "tick", target: "brhead", value: { by: 1 } });
    n++;
    const tabs = src.tabs;
    if (tabs && Array.isArray(tabs.items) && tabs.items.length) {
      s.modules.splice(1, 0, { id: "brtabs", type: "tabChips", rect: BR.tabs, props: { items: tabs.items, active: tabs.active || 1 }, enter: "none", at: 0 });
      if (seenTabs && (!prevTabs || (prevTabs.active || 1) !== (tabs.active || 1))) chromeEvents.push({ t: s.t0, op: "activate", target: "brtabs", value: { step: tabs.active || 1 } });
      prevTabs = tabs;
      seenTabs = true;
    } else prevTabs = null;
  });
}

module.exports = { BR_TEMPLATES: { brStack, brGrid, brMedia, brSummary, brBand }, BR, brChrome };
