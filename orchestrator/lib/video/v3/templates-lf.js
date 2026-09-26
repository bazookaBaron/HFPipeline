"use strict";

/**
 * LF (16:9 long-form editorial) templates -- plan §3. Every rect comes from the 12-column grid at
 * 1920x1080: margins 96, gutter 24, column 122 (pitch 146): X(k) = 96 + 146k, S(n) = 146n - 24.
 * Content band y 150-960 (chrome kicker/progress at y 48-88; nothing critical below y 990, where the
 * YouTube progress bar sits; the media credit line is the one non-critical exception at y 1016-1042).
 *
 * Density rule (plan §6): a scene is a motion-graphics layout with media as ONE layer in it. Photos
 * take `overlays` (callouts / lower thirds / labels at [x%, y%] of the photo, with an optional
 * `point` [x%, y%] the callout's leader draws to) and word-anchored annotation ops (highlight, arrow,
 * zoomTo). lfFull always carries a lower third within 1.5 s.
 *
 *   lfCold     full-bleed photo (paper scrim left) + kinetic headline + overlays     (cold open)
 *   lfSplit    photo card 7 cols + stack 5 cols (lfText / bigNumber / callout / chart); mirror: true
 *   lfFull     full-bleed photo/video + lower third (<= 1.5 s) + overlays; frame credit
 *   lfChart    title + barChart|lineChart 12 cols (8 with a side stack) + mandatory source
 *   lfNumber   bigNumber (count-up) over a scrimmed photo backdrop on the right (+ overlays)
 *   lfCompare  title + compareCols (2-3 columns with photos, stats and bars)
 *   lfTimeline title + eraTimeline (thumbnails, word-anchored ticks)
 *   lfMap      mapCard 8 cols (pins, flow arrows) + side stack 4 cols
 *   lfHeadline headlineCard (rebuilt, never a screenshot) over a photo card (collage)
 *   lfChapter  chapterCard (number, title, promise, progress) + photo card
 *   lfJoke     illustration/photo card 6 cols + punchline + sticker callout
 *   lfRecap    title + recapList (check off) + photo card
 *   lfEnd      endScreen (subscribe CTA + two end-screen slot outlines, right 45 % kept free)
 *
 * Slot fills: { id?, type?, props, h?, w?, anchor?, enter?, at? }. Media fills reference the manifest
 * by props.slot (compile.js resolves slot -> src / credit / focal; missing -> the module's fallback).
 */

const X = (k) => 96 + 146 * k;
const S = (n) => 146 * n - 24;
const G = { W: 1920, H: 1080, top: 150, bottom: 960, gap: 30 };

/** estimated content height (px) of an LF fill at width w */
function lfPreferred(fill, w) {
  const p = fill.props || {};
  const lines = (text, size, max) => Math.min(max, Math.max(1, Math.ceil((String(text || "").length * size * 0.53) / w)));
  switch (fill.type) {
    case "lfText": {
      const size = p.size || 72;
      return Math.round((p.eyebrow ? 37 : 0) + lines(p.title, size, p.maxLines || 3) * size * 1.06 + (p.sub ? 18 + lines(p.sub, p.subSize || 30, 3) * (p.subSize || 30) * 1.34 : 0) + 4);
    }
    case "bigNumber":
      return Math.round((p.eyebrow ? 40 : 0) + (p.size || 190) * 0.96 + (p.context ? 22 + lines(p.context, 32, 2) * 32 * 1.28 : 0) + ((p.bars || []).length ? 30 + p.bars.length * 50 : 0));
    case "callout":
      return p.value !== undefined && p.value !== "" ? 100 : 62;
    case "lowerThird":
      return p.sub ? 150 : 118;
    case "barChart":
    case "lineChart":
      return p.h || 520;
    case "recapList":
      return (p.items || []).length * 112;
    case "headlineCard":
      return 470;
    case "portraitCard":
      return 470;
    case "photo":
      return p.h || Math.round(w * 0.62);
    default:
      return p.h || 300;
  }
}

function mod(sc, fill, defType, rect, suffix, extra = {}) {
  const f = fill || {};
  return {
    id: f.id || `${sc.id}_${suffix}`,
    type: f.type || defType,
    rect: rect.map((v) => Math.round(v * 2) / 2),
    props: { ...(extra.props || {}), ...(f.props || {}) },
    enter: f.enter || extra.enter,
    at: f.at !== undefined ? f.at : extra.at,
    exit: f.exit,
    z: f.z !== undefined ? f.z : extra.z,
    anchor: f.anchor,
  };
}

/** vertical stack of fills centred in [y0, y1] at x/w; throws on overflow */
function stack(sc, fills, x, w, y0, y1, prefix, gap = G.gap) {
  const list = (fills || []).map((f) => ({ ...f, h: f.h || lfPreferred(f, w) }));
  const used = list.reduce((a, f) => a + f.h, 0) + Math.max(0, list.length - 1) * gap;
  if (used > y1 - y0 + 1) {
    throw new Error(`scaffold ${sc.id}: ${prefix} stack needs ${Math.round(used)} px but the band is ${Math.round(y1 - y0)} px (${list.map((f) => `${f.id || f.type} ${Math.round(f.h)}`).join(", ")}); drop a module, shorten text or set a smaller "h"`);
  }
  let y = y0 + Math.max(0, Math.round((y1 - y0 - used) / 2));
  return list.map((f, i) => {
    const m = mod(sc, f, f.type || "lfText", [x, y, f.w || w, f.h], `${prefix}${i}`);
    y += f.h + gap;
    return m;
  });
}

/** overlays placed in % of a host rect: callouts / lower thirds / labels; point -> leader target */
function overlays(sc, fills, host, prefix = "ov") {
  return (fills || []).map((f, i) => {
    const type = f.type || "callout";
    const w = f.w || (type === "lowerThird" ? 760 : 320);
    const h = f.h || lfPreferred({ type, props: f.props || {} }, w);
    let rect;
    if (Array.isArray(f.rect)) rect = f.rect;
    else {
      const at = f.at || [5, 5];
      rect = [host[0] + (at[0] / 100) * host[2], host[1] + (at[1] / 100) * host[3], w, h];
    }
    const props = { ...(f.props || {}) };
    if (Array.isArray(f.point)) props.to = [host[0] + (f.point[0] / 100) * host[2] - rect[0], host[1] + (f.point[1] / 100) * host[3] - rect[1]];
    const out = mod(sc, { ...f, props }, type, rect, `${prefix}${i}`, { z: 6 });
    if (out.at === undefined && !out.anchor && f.delay !== undefined) out.at = f.delay;
    return out;
  });
}

function photoMod(sc, fill, rect, suffix, extra) {
  return mod(sc, fill, "photo", rect, suffix, { props: extra });
}

// ---------------------------------------------------------------- templates
function lfCold(sc) {
  const s = sc.slots || {};
  const host = [0, 0, G.W, G.H];
  const mods = [photoMod(sc, s.photo, host, "photo", { card: false, scrim: "left", creditPos: "frame", backdrop: true })];
  const head = { type: "lfText", ...(s.headline || {}), props: { kinetic: true, size: 84, maxLines: 3, ...((s.headline || {}).props || {}) } };
  mods.push(...stack(sc, [head].concat(s.stack || []), X(0), S(6), G.top, G.bottom, "t"));
  mods.push(...overlays(sc, s.overlays, host));
  return { layout: "full", modules: mods };
}

function lfSplit(sc) {
  const s = sc.slots || {};
  const host = sc.mirror ? [X(5), G.top, S(7), G.bottom - G.top] : [X(0), G.top, S(7), G.bottom - G.top];
  const mods = [photoMod(sc, s.photo, host, "photo", {})];
  mods.push(...stack(sc, s.stack || [], sc.mirror ? X(0) : X(7), S(5), G.top, G.bottom, "s"));
  mods.push(...overlays(sc, s.overlays, host));
  return { layout: "full", modules: mods };
}

function lfFull(sc) {
  const s = sc.slots || {};
  const host = [0, 0, G.W, G.H];
  const mods = [photoMod(sc, s.photo, host, "photo", { card: false, creditPos: "frame", scrim: s.scrim, backdrop: true })];
  if (!s.lowerThird) throw new Error(`scaffold ${sc.id}: lfFull needs slots.lowerThird (graphics over the photo within 1.5 s)`);
  const lt = mod(sc, s.lowerThird, "lowerThird", [X(0), 806, S(7), (s.lowerThird.props || {}).sub ? 150 : 118], "lt", { at: 0.5 });
  if (lt.at > 1.5 && !lt.anchor) throw new Error(`scaffold ${sc.id}: the lower third must land within 1.5 s`);
  lt.rect[1] = 956 - lt.rect[3];
  mods.push(lt);
  mods.push(...overlays(sc, s.overlays, host));
  return { layout: "full", modules: mods };
}

function titleBlock(sc, s, w) {
  if (!s.title) return { mods: [], bottom: G.top - 10 };
  const f = { type: "lfText", ...s.title, props: { size: 56, maxLines: 2, ...((s.title || {}).props || {}) } };
  const h = f.h || lfPreferred(f, w);
  return { mods: [mod(sc, f, "lfText", [X(0), G.top - 10, w, h], "title")], bottom: G.top - 10 + h };
}

function lfChart(sc) {
  const s = sc.slots || {};
  const side = (s.side || []).length > 0;
  const w = side ? S(8) : S(12);
  const tb = titleBlock(sc, s, side ? S(8) : S(10));
  const y0 = tb.bottom + 34;
  const chart = mod(sc, s.chart, (s.chart && s.chart.type) || "barChart", [X(0), y0, w, G.bottom - y0], "chart");
  const mods = tb.mods.concat([chart]);
  if (side) mods.push(...stack(sc, s.side, X(8), S(4), G.top, G.bottom, "side"));
  return { layout: "full", modules: mods };
}

function lfNumber(sc) {
  const s = sc.slots || {};
  const mods = [];
  let host = null;
  if (s.backdrop) {
    host = [880, 0, 1040, G.H];
    mods.push(photoMod(sc, s.backdrop, host, "bg", { card: false, scrim: "left", creditPos: "frame", backdrop: true }));
  }
  const fills = [{ type: "bigNumber", ...(s.number || {}), props: { count: "enter", ...((s.number || {}).props || {}) } }].concat(s.stack || []);
  mods.push(...stack(sc, fills, X(0), host ? S(7) : S(8), G.top, G.bottom, "n", 36));
  if (!host && (s.side || []).length) mods.push(...stack(sc, s.side, X(8), S(4), G.top, G.bottom, "side"));
  if (host) mods.push(...overlays(sc, s.overlays, host));
  return { layout: "full", modules: mods };
}

function lfCompare(sc) {
  const s = sc.slots || {};
  const tb = titleBlock(sc, s, S(12));
  const y0 = tb.bottom + 34;
  return { layout: "full", modules: tb.mods.concat([mod(sc, s.compare, "compareCols", [X(0), y0, S(12), G.bottom - y0], "cmp")]) };
}

function lfTimeline(sc) {
  const s = sc.slots || {};
  const tb = titleBlock(sc, s, S(12));
  const y0 = tb.bottom + 44;
  return { layout: "full", modules: tb.mods.concat([mod(sc, s.timeline, "eraTimeline", [X(0), y0, S(12), G.bottom - y0], "tl")]) };
}

function lfMap(sc) {
  const s = sc.slots || {};
  const host = [X(0), G.top, S(8), G.bottom - G.top];
  const mods = [mod(sc, s.map, "mapCard", host, "map")];
  mods.push(...stack(sc, s.side || [], X(8), S(4), G.top, G.bottom, "side"));
  mods.push(...overlays(sc, s.overlays, host));
  return { layout: "full", modules: mods };
}

function lfHeadline(sc) {
  const s = sc.slots || {};
  const mods = [];
  if (s.photo) {
    const host = [X(6), G.top, S(6), 540];
    // the card overlaps the photo's bottom-left, so the photo credits to the frame line
    mods.push(photoMod(sc, s.photo, host, "photo", { creditPos: "frame" }));
    mods.push(mod(sc, s.headline, "headlineCard", [X(0), G.top + 330, S(8), 420], "news", { z: 2, props: { overlay: true } }));
    mods.push(...overlays(sc, s.overlays, host));
  } else {
    mods.push(mod(sc, s.headline, "headlineCard", [X(1), 200, S(10), 600], "news"));
  }
  return { layout: "full", modules: mods };
}

function lfChapter(sc, entities, sb) {
  const s = sc.slots || {};
  const ch = (sb && sb.chapter) || {};
  const props = { index: ch.index, count: ch.count, title: ch.title, ...((s.card || {}).props || {}) };
  const mods = [];
  if (s.photo) {
    mods.push(mod(sc, { ...(s.card || {}), props }, "chapterCard", [X(0), 110, S(7), 850], "card"));
    mods.push(photoMod(sc, s.photo, [X(7), 110, S(5), 850], "photo", {}));
    mods.push(...overlays(sc, s.overlays, [X(7), 110, S(5), 850]));
  } else mods.push(mod(sc, { ...(s.card || {}), props }, "chapterCard", [X(1), 110, S(10), 850], "card"));
  return { layout: "title", modules: mods };
}

function lfJoke(sc) {
  const s = sc.slots || {};
  const host = sc.mirror ? [X(6), G.top, S(6), G.bottom - G.top] : [X(0), G.top, S(6), G.bottom - G.top];
  const mods = [photoMod(sc, s.art, host, "art", {})];
  const punch = { type: "lfText", ...(s.punchline || {}), props: { size: 66, maxLines: 4, ...((s.punchline || {}).props || {}) } };
  mods.push(...stack(sc, [punch].concat(s.stack || []), sc.mirror ? X(0) : X(6) + 40, S(6) - 40, G.top, G.bottom, "p"));
  if (s.tag) mods.push(mod(sc, s.tag, "callout", [host[0] + host[2] - 300, host[1] - 22, 320, 62], "tag", { z: 6, props: { rotate: -4, tone: "red" } }));
  mods.push(...overlays(sc, s.overlays, host));
  return { layout: "full", modules: mods };
}

function lfRecap(sc) {
  const s = sc.slots || {};
  const w = s.photo ? S(7) : S(10);
  const tb = titleBlock(sc, s, w);
  const y0 = tb.bottom + 40;
  const mods = tb.mods.concat([mod(sc, s.list, "recapList", [X(0), y0, w, G.bottom - y0], "list")]);
  if (s.photo) mods.push(photoMod(sc, s.photo, [X(7), G.top, S(5), G.bottom - G.top], "photo", {}));
  return { layout: "full", modules: mods };
}

function lfEnd(sc) {
  const s = sc.slots || {};
  return { layout: "title", modules: [mod(sc, s.end || { props: s.props }, "endScreen", [0, 0, G.W, G.H], "end", {})].map((m) => ({ ...m, id: (s.end && s.end.id) || "lfend" })) };
}

const NO_CHROME = new Set(["lfChapter", "lfEnd", "lfCold"]);

/**
 * LF chrome (plan §3): chapter kicker "CH 02 · TITLE" top-left + chapter progress segments top-right on
 * every topic scaffold (not on chapter cards / the cold open / the end screen), and the media credit
 * line bottom-left on every scaffold that shows a fetched image credited to the frame.
 * chapter = sb.chapter {index, count, title}; frameCredits[i] = credit text for scaffold i (or "").
 */
function lfChrome(sb, scaffolds, chromeEvents, BRAND, frameCredits) {
  const ch = sb.chapter || {};
  const head = { index: Number(ch.index) || 1, count: Number(ch.count) || 1, title: String(ch.title || sb.topic || "") };
  // the cold open (sb.chapter.index 0) precedes chapter 1: no kicker / progress, only credits
  const coldOpen = ch.index !== undefined && Number(ch.index) === 0;
  let creditShown = null;
  scaffolds.forEach((s, i) => {
    if (BRAND.has(s.template)) return;
    const chrome = [];
    if (!NO_CHROME.has(s.template) && !coldOpen) {
      chrome.push({ id: "lfhead", type: "lfHeader", rect: [96, 48, 1100, 40], props: head, enter: "none", at: 0 });
      chrome.push({ id: "lfprog", type: "lfProgress", rect: [1224, 48, 600, 40], props: { index: head.index, count: head.count }, enter: "fill", at: 0 });
    }
    const text = (frameCredits && frameCredits[i]) || "";
    if (text) {
      chrome.push({ id: "lfcredit", type: "lfCredit", rect: [96, 990, 1728, 52], props: { text: creditShown === null ? text : creditShown }, enter: "none", at: 0 });
      if (creditShown === null) creditShown = text;
      else chromeEvents.push({ t: s.t0, op: "credit", target: "lfcredit", value: { text } });
    }
    s.modules.unshift(...chrome);
  });
}

module.exports = {
  LF_TEMPLATES: { lfCold, lfSplit, lfFull, lfChart, lfNumber, lfCompare, lfTimeline, lfMap, lfHeadline, lfChapter, lfJoke, lfRecap, lfEnd },
  lfChrome,
  lfPreferred,
  LF_GRID: { X, S, ...G },
  NO_CHROME,
};
