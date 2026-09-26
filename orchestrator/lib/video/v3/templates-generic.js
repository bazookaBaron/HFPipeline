"use strict";

/**
 * Generic DH layout templates (topic-agnostic), built on the measured frame bands
 * (SPEC.md 3.1-3.3; R1/R2): HUD 235-305, section label cap-top 342, content column x 330-1020
 * beside the mascot or x 60-1020 full width, content bottom <= 1300, module gap 19.
 *
 *   stack  : label? + `top` modules stacked down from under the label + `bottom` modules stacked
 *            UP from y 1300 (R2: swappable slot above a persistent carrier). layout column|full.
 *   hero   : a hero word/number (+ kicker) with an optional stack below (R1 T3 / R2 slam moments)
 *   opener : two-line headline + optional stack, no HUD / mascot (R2 T6 title / outro)
 *
 * A module fill: { id?, type, props, h?, enter?, anchor?, exit? }. Heights default to the
 * module's content height (preferred()). Overlap or overflow is a compile error (never squeezed).
 */

const BAND = {
  labelTop: 336, // label rect top (cap-top 342)
  topWithLabel: 410,
  topNoLabel: 336,
  topFullNoLabel: 340,
  bottom: 1300,
  gap: 19,
  col: { x: 330, w: 690 },
  full: { x: 60, w: 960 },
};

/** content height (px) a module needs at width w */
function preferred(fill, w) {
  const p = fill.props || {};
  const n = (a) => (Array.isArray(a) ? a.length : 0);
  switch (fill.type) {
    case "panel":
      return (p.title ? 54 : 0) + 12 + n(p.rows) * (p.pitch || 58) + 8;
    case "table":
      return 46 + n(p.rows) * 60;
    case "nodes":
      return p.h || 420;
    case "kpis":
      return (p.items || []).some((i) => i.bar !== undefined) ? 150 : 124;
    case "code":
      return 58 + n(p.lines) * 42 + 12;
    case "compare":
      return 66 + Math.max(n((p.left || {}).rows), n((p.right || {}).rows)) * 50 + 12;
    case "bars":
      return n(p.items) * 64 - 10;
    case "steps":
      return 84;
    case "chips":
      return p.h || (p.rows || 3) * 62;
    case "hero":
      return p.size ? Math.round(p.size * 1.02) : 122;
    case "headline":
      return n(p.lines) * (p.pitch || 123);
    case "banner":
      return 117;
    case "stat":
      return 110;
    case "chart":
      return 280;
    case "browser":
      return p.h || 560;
    case "console":
      return 50 + n(p.rows) * 44 + 18;
    case "pill":
      return 36;
    case "micro":
      return 26;
    case "label":
      return 50;
    case "users":
      return 209;
    case "option":
      return 86;
    case "stamp":
      return 150;
    case "timeline":
      return (p.ticks || []).some((t) => t.caption) ? 150 : 100;
    case "layers":
      return n(p.layers) * 84 - 12;
    case "tree":
      return p.h || 380;
    case "note":
      return 80;
    case "letters":
      return 260;
    case "slot":
      return p.h || 110;
    case "chapterTabs":
      return 56;
    case "media": {
      // window = 40.5 px header + body at the source aspect (default 16:9) + 3 px border
      const ar = Number(p.aspect) > 0 ? Number(p.aspect) : 16 / 9;
      return Math.round(((w || 690) - 3) / ar + (p.head || p.dot ? 40.5 : 0) + 3);
    }
    // ---- BR cards (lib/stage/modules-br.js, R7 §5): 39 px title bar + body + 3 px border ----
    case "decisionSheet":
      return 39 + (p.situation ? 86 : 0) + n(p.questions) * (p.compact ? 92 : 104) + 9;
    case "targetForm":
      return 39 + 12 + n(p.fields) * 78 + (p.status === false ? 0 : 69) + 9;
    case "writerWindow": {
      const cpl = Math.max(10, Math.floor(((w || 700) - 97) / 12.6));
      const lines = p.lines || Math.max(2, Math.ceil(String(p.text || "").length / cpl));
      return 39 + (n(p.vendors) ? 46 : 0) + lines * 39 + 13;
    }
    case "toolTiles":
      return Math.ceil(n(p.tiles) / (p.cols || 2)) * ((p.tileH || 150) + 18) - 18 + 8;
    case "appGrid":
      return Math.ceil(n(p.apps) / (p.cols || 3)) * ((p.tileH || 170) + 18) - 18 + 8;
    case "docGrid":
      return 12 + Math.ceil(n(p.docs) / (p.cols || 5)) * ((p.tileH || 122) + 16) - 16 + 6;
    case "raceBars":
      return 39 + 14 + n(p.rows) * 84 + 38 + 3;
    case "costBar":
      return 80;
    case "terminal":
      return 39 + 24 + (p.intro ? 40 : 0) + 70 + (p.comment ? 40 : 0) + 22;
    case "slamStamp":
      return p.h || 170;
    case "modelTile":
      return p.h || 250;
    case "pinkBand":
      return 747;
    case "eyebrow":
      return 30;
    case "keywordHeadline":
    case "displayLine":
      return (Array.isArray(p.lines) ? p.lines.length : 1) * Math.round((p.size || 56) * 1.12) + 4;
    // ---- BP cards (lib/stage/modules-bp.js, R6 §5) ----
    case "blueprint":
      return p.h || 600;
    case "featureRows":
      return n(p.items) * 150 + Math.max(0, n(p.items) - 1) * 21;
    case "costCards":
      return n(p.items) * 230 + Math.max(0, n(p.items) - 1) * 21;
    case "techCards": {
      const r = Math.ceil(n(p.items) / 2);
      return r * 340 + Math.max(0, r - 1) * 21;
    }
    case "displayHeadline":
      return n(p.lines) * Math.min(p.size || 111, 115) + 4;
    case "strikeStrips":
      return 2 * 156 + 21;
    case "verdictStamp":
      return p.sub || n(p.icons) ? 320 : 240;
    case "phone":
      return 675;
    case "reqList":
      return (p.eyebrow ? 58 : 16) + n(p.rows) * 78 - 14 + (p.total ? 120 : 18);
    case "dotGrid":
      return (p.eyebrow ? 60 : 22) + (p.rows || 5) * 34.5 + 22;
    case "hitCounter":
      return 200;
    case "vsCards":
      return 400;
    case "latencyBars":
      return (p.eyebrow ? 70 : 26) + n(p.bars) * 110 + (p.footer ? 58 : 0) + 20;
    case "logoGrid":
      return 58 + Math.ceil(n(p.tiles) / (p.cols || 6)) * 120;
    case "imageSlot":
      return p.h || 220;
    case "jargonCloud":
      return p.h || 720;
    default:
      return fill.h || 200;
  }
}

function place(sc, fills, x, w, y0, dir, where) {
  const out = [];
  let y = y0;
  (fills || []).forEach((f, i) => {
    const h = f.h || preferred(f, w);
    const mw = f.w || w;
    const mx = f.align === "right" ? x + w - mw : f.align === "center" ? x + (w - mw) / 2 : x;
    const top = dir === "down" ? y : y - h;
    out.push({ id: f.id || `${sc.id}_${where}${i}`, type: f.type, rect: [mx, top, mw, h], props: f.props || {}, enter: f.enter, at: f.at, exit: f.exit, z: f.z, anchor: f.anchor });
    y = dir === "down" ? y + h + (f.gapAfter !== undefined ? f.gapAfter : BAND.gap) : y - h - BAND.gap;
  });
  return { mods: out, edge: y };
}

function hudModule(entities, sc) {
  if (!entities.hud || sc.hud === false) return [];
  return [{ id: "hud", type: "hud", rect: [60, 235.5, 960, 69], props: entities.hud, enter: "fade" }];
}

// modules whose content scales with their box (they absorb spare height before centring)
const STRETCH = new Set(["nodes", "chips", "chart", "browser", "tree"]);
const STRETCH_MAX = 1.45;

/**
 * Spare height policy (refs R1/R2: content is one block, centroid ~45% H, gaps 19 px): first grow
 * stretchable modules (up to 1.45x), then centre the whole block in [topY, bottom].
 */
function fitBlock(fills, w, avail) {
  const list = (fills || []).map((f) => ({ ...f, h: f.h || preferred(f, w) }));
  const used = () => list.reduce((a, f) => a + f.h, 0) + Math.max(0, list.length - 1) * BAND.gap;
  let slack = avail - used();
  const str = list.filter((f) => STRETCH.has(f.type) && !f.fixed);
  if (slack < 0 && str.length) {
    // overflow: shrink stretchable modules (diagrams, grids, charts) by up to 30% before failing
    const base = str.reduce((a, f) => a + f.h, 0);
    const cut = Math.min(-slack, base * 0.3);
    str.forEach((f) => (f.h = Math.floor(f.h - (cut * f.h) / base)));
    slack = avail - used();
    return { list, slack };
  }
  if (slack > 0 && str.length) {
    const base = str.reduce((a, f) => a + f.h, 0);
    const grow = Math.min(slack, base * (STRETCH_MAX - 1));
    str.forEach((f) => (f.h = Math.round(f.h + (grow * f.h) / base)));
    slack = avail - used();
  }
  return { list, slack };
}

function stack(sc, entities) {
  const s = sc.slots || {};
  const full = sc.layout === "full";
  const { x, w } = full ? BAND.full : BAND.col;
  const mods = hudModule(entities, sc);
  if (s.label) mods.push({ id: s.label.id || `${sc.id}_label`, type: "label", rect: [60, BAND.labelTop, 960, 50], props: s.label.props || s.label, enter: s.label.enter, anchor: s.label.anchor });
  const topY = s.label ? BAND.topWithLabel : full ? BAND.topFullNoLabel : BAND.topNoLabel;
  if (!sc.pinBottom) {
    // one block: top modules then bottom modules, stretched then centred
    const all = (s.top || []).concat(s.bottom || []);
    const { list, slack } = fitBlock(all, w, BAND.bottom - topY);
    if (slack < -1) {
      const parts = list.map((f) => `${f.id || f.type} (${f.type}) ${Math.round(f.h)} px`).join(", ");
      throw new Error(`scaffold ${sc.id}: content needs ${Math.round(BAND.bottom - topY - slack)} px but the band is ${BAND.bottom - topY} px (overflow ${Math.round(-slack)} px); modules: ${parts} + ${BAND.gap} px gaps. Remove one module, drop rows/lines, or set a smaller "h" on a diagram`);
    }
    const blk = place(sc, list, x, w, topY + Math.max(0, Math.round(slack / 2)), "down", "m");
    return { layout: full ? "full" : "column", modules: mods.concat(blk.mods) };
  }
  const top = place(sc, s.top, x, w, topY, "down", "t");
  const bottom = place(sc, (s.bottom || []).slice().reverse(), x, w, BAND.bottom, "up", "b");
  const topEdge = top.edge - BAND.gap;
  const bottomEdge = bottom.edge + BAND.gap;
  if ((s.top || []).length && (s.bottom || []).length && topEdge > bottomEdge + 1) {
    throw new Error(`scaffold ${sc.id}: top stack ends at y ${Math.round(topEdge)} but bottom stack starts at y ${Math.round(bottomEdge)} (overlap ${Math.round(topEdge - bottomEdge)} px)`);
  }
  if ((s.top || []).length && !(s.bottom || []).length && topEdge > BAND.bottom + 1) {
    throw new Error(`scaffold ${sc.id}: content runs to y ${Math.round(topEdge)}, past the content bottom ${BAND.bottom}`);
  }
  if (bottomEdge < topY - 1 && !(s.top || []).length) {
    throw new Error(`scaffold ${sc.id}: bottom stack rises to y ${Math.round(bottomEdge)}, above the content top ${topY}`);
  }
  return { layout: full ? "full" : "column", modules: mods.concat(top.mods, bottom.mods.reverse()) };
}

function hero(sc, entities) {
  const s = sc.slots || {};
  const full = sc.layout === "full";
  const { x, w } = full ? BAND.full : BAND.col;
  const mods = hudModule(entities, sc);
  const h = s.hero ? preferred({ type: "hero", props: s.hero.props || {} }, w) : 0;
  const y = s.label ? BAND.topWithLabel : 360;
  if (s.label) mods.push({ id: `${sc.id}_label`, type: "label", rect: [60, BAND.labelTop, 960, 50], props: s.label.props || s.label });
  if (s.hero) mods.push({ id: s.hero.id || `${sc.id}_hero`, type: "hero", rect: [x, y, w, h], props: { align: "right", ...(s.hero.props || {}) }, anchor: s.hero.anchor, enter: s.hero.enter });
  let yy = y + h + 24;
  if (s.kicker) {
    mods.push({ id: s.kicker.id || `${sc.id}_kicker`, type: "micro", rect: [x, yy, w, 26], props: { align: "right", ...(s.kicker.props || {}) }, anchor: s.kicker.anchor });
    yy += 26 + 40;
  }
  const rest = place(sc, s.top, x, w, yy, "down", "t");
  if (rest.edge - BAND.gap > BAND.bottom + 1) throw new Error(`scaffold ${sc.id}: hero content runs to y ${Math.round(rest.edge)}`);
  return { layout: full ? "full" : "column", modules: mods.concat(rest.mods) };
}

function opener(sc, entities) {
  const s = sc.slots || {};
  const { x, w } = BAND.full;
  const mods = [];
  let y = 340;
  if (s.eyebrow) {
    mods.push({ id: `${sc.id}_eyebrow`, type: "micro", rect: [x, 300, w, 26], props: s.eyebrow.props || s.eyebrow });
  }
  if (s.headline) {
    const hp = s.headline.props || {};
    const h = preferred({ type: "headline", props: hp }, w);
    mods.push({ id: s.headline.id || `${sc.id}_headline`, type: "headline", rect: [x, y, w, h], props: hp, anchor: s.headline.anchor });
    y += h + 30;
  }
  const rest = place(sc, s.top, x, w, y, "down", "t");
  if (rest.edge - BAND.gap > BAND.bottom + 1) throw new Error(`scaffold ${sc.id}: opener content runs to y ${Math.round(rest.edge)}`);
  if (s.footer) mods.push({ id: `${sc.id}_footer`, type: "micro", rect: [x, Math.min(1230, rest.edge + 20), w, 40], props: s.footer.props || s.footer });
  return { layout: "title", modules: mods.concat(rest.mods) };
}

/**
 * free: modules at explicit rects (slots.modules: [{ id?, type, rect:[x,y,w,h], props, enter?, anchor?, at?, exit?, z? }]).
 * Frame-agnostic (no 9:16 bands): used by landscape (16:9) storyboards until the LF templates exist.
 */
function free(sc) {
  const mods = ((sc.slots || {}).modules || []).map((f, i) => {
    if (!Array.isArray(f.rect) || f.rect.length !== 4) throw new Error(`scaffold ${sc.id}: free module ${i} needs rect [x, y, w, h]`);
    return { id: f.id || `${sc.id}_f${i}`, type: f.type, rect: f.rect, props: f.props || {}, enter: f.enter, at: f.at, exit: f.exit, z: f.z, anchor: f.anchor };
  });
  return { layout: sc.layout || "full", modules: mods };
}

module.exports = { GENERIC_TEMPLATES: { stack, hero, opener, free }, preferred, BAND, fitBlock, place };
