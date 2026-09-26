"use strict";

/**
 * LF (16:9 long-form editorial) templates -- plan §3, CENTRE-STAGE composition (user, 2026-09-26: "a
 * YouTube video is not a two-column website"). Grid: 12 columns at 1920x1080, margins 96, gutter 24,
 * column 122 (pitch 146): X(k) = 96 + 146k, S(n) = 146n - 24. Content band y 150-960 (chrome kicker /
 * progress at y 48-88; nothing critical below y 990 where the YouTube progress bar sits; the media
 * credit line is the one non-critical exception at y 1016-1042, bottom-left).
 *
 * Composition grammar (produced explainers: Vox, Johnny Harris, Wendover, PolyMatter, Economics Explained):
 *   - ONE hero on the frame's centre axis (x centre 960): a photo / map / chart / big number / compare /
 *     timeline. Photo heroes are a centred card (HERO.card 1152x648 16:9, HERO.photo 972x648 3:2),
 *     optically centred (top y 150, centre ~y 474, room below for a lower third) or full bleed.
 *     Consecutive scenes keep the eye at the centre.
 *   - Satellites orbit it in the LEFT / RIGHT rails (320 px): stat chips (callout), mini big-number
 *     cards (bigNumber card), portraits, photo-in-photo thumbnails, short labels. Over a photo hero
 *     they overlap its edge by 64 px (depth); beside a graphic hero they stand 36 px clear of it. They
 *     enter on words, max 2 per rail, balanced left/right (|L - R| <= 1).
 *   - Headline: top-centre (slots.title, lfText centred) or a centred lower third over the hero's
 *     bottom edge (slots.headline). Never a paragraph beside the picture: on-screen text is short.
 *   - Overlays (callouts / labels at [x%, y%] of the hero, optional `point` leader) and word-anchored
 *     annotation ops (highlight, arrow, zoomTo) ride the hero (plan §6 mix rule).
 *
 *   lfCold     full-bleed photo (bottom scrim) + centred kinetic headline + rails + overlays (cold open)
 *   lfStage    centred hero (photo | mapCard | chart) + left/right rails + top title or lower-third headline
 *   lfSplit    DEPRECATED alias of lfStage (photo -> hero, stack -> title + rails)
 *   lfFull     full-bleed photo/video + centred lower third (<= 1.5 s) + rails + overlays; frame credit
 *   lfChart    centred title + centred barChart|lineChart + rails (side -> rails) + mandatory source
 *   lfNumber   centred bigNumber (count-up) + rails (portrait, chips); backdrop = full bleed, centre scrim
 *   lfCompare  centred title + compareCols centred, VS chip on the centre line
 *   lfTimeline centred title + eraTimeline band across the centre
 *   lfMap      centred mapCard hero + rails
 *   lfHeadline headlineCard centred over a centred photo (collage) + rails
 *   lfChapter  centred poster: photo card on the axis, chapter number / title / promise / progress below
 *   lfJoke     centred art card + punchline plate over its bottom edge + sticker on its corner
 *   lfRecap    centred title + centred recapList (+ photo satellite)
 *   lfEnd      endScreen (subscribe CTA + two end-screen slot outlines, right 45 % kept free)
 *
 * Slot fills: { id?, type?, props, h?, w?, anchor?, enter?, at? }. Media fills reference the manifest
 * by props.slot (compile.js resolves slot -> src / credit / focal; missing -> the module's fallback).
 */

const X = (k) => 96 + 146 * k;
const S = (n) => 146 * n - 24;
const G = { W: 1920, H: 1080, top: 150, bottom: 960, gap: 30, cx: 960 };
/** centred hero sizes (photo / map heroes); under a top title they shrink to 594 px tall */
const HERO = { card: { w: 1152, h: 648 }, photo: { w: 972, h: 648 } };
const RAIL = { w: 320, overlap: 64, clear: 36, gap: 24, max: 2 };
const TITLE_Y = 112;

/** estimated content height (px) of an LF fill at width w */
function lfPreferred(fill, w) {
  const p = fill.props || {};
  const lines = (text, size, max, width = w) => Math.min(max, Math.max(1, Math.ceil((String(text || "").length * size * 0.53) / width)));
  switch (fill.type) {
    case "lfText": {
      const size = p.size || 72;
      const iw = p.plate ? w - 72 : w;
      return Math.round((p.plate ? 48 : 0) + (p.eyebrow ? (p.plate ? 31 : 37) : 0) + lines(p.title, size, p.maxLines || 3, iw) * size * 1.06 + (p.sub ? 18 + lines(p.sub, p.subSize || 30, 3, iw) * (p.subSize || 30) * 1.34 : 0) + 4);
    }
    case "bigNumber": {
      if (p.card) return Math.round(36 + (p.eyebrow ? 8 + 22 * lines(p.eyebrow, 17, 2, (w - 52) * 0.8) : 0) + (p.size || 84) * 0.96 + (p.context ? 10 + lines(p.context, 24, 2, w - 52) * 24 * 1.28 : 0) + ((p.bars || []).length ? 14 + p.bars.length * 50 : 0) + 6);
      return Math.round((p.eyebrow ? 40 : 0) + (p.size || 190) * 0.96 + (p.context ? 22 + lines(p.context, 32, 2) * 32 * 1.28 : 0) + ((p.bars || []).length ? 30 + p.bars.length * 50 : 0));
    }
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
      return w > 400 ? 300 : 430;
    case "photo":
    case "mapCard":
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
  const list = (fills || []).map((f) => ({ ...f, h: f.h || lfPreferred(f, f.w || w) }));
  const used = list.reduce((a, f) => a + f.h, 0) + Math.max(0, list.length - 1) * gap;
  if (used > y1 - y0 + 1) {
    throw new Error(`scaffold ${sc.id}: ${prefix} stack needs ${Math.round(used)} px but the band is ${Math.round(y1 - y0)} px (${list.map((f) => `${f.id || f.type} ${Math.round(f.h)}`).join(", ")}); drop a module, shorten text or set a smaller "h"`);
  }
  let y = y0 + Math.max(0, Math.round((y1 - y0 - used) / 2));
  return list.map((f, i) => {
    const fw = Math.min(f.w || w, w);
    const m = mod(sc, f, f.type || "lfText", [x + (w - fw) / 2, y, fw, f.h], `${prefix}${i}`);
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
    if (Array.isArray(f.rect)) rect = f.rect.slice();
    else {
      const at = f.at || [5, 5];
      rect = [host[0] + (at[0] / 100) * host[2], host[1] + (at[1] / 100) * host[3], w, h];
      // an edge chip may hang off the hero, never off the title-safe frame
      rect[0] = Math.max(96, Math.min(G.W - 96 - w, rect[0]));
      rect[1] = Math.max(G.top - 40, Math.min(G.bottom - h, rect[1]));
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

// ---------------------------------------------------------------- centre-stage geometry
/** centred hero rect: size card | photo | full; `titled` = a top-centre title sits above it */
function heroRect(size, titled) {
  if (size === "full") return [0, 0, G.W, G.H];
  const b = HERO[size] || HERO.card;
  const k = titled ? 594 / 648 : 1;
  const w = Math.round(b.w * k);
  const h = Math.round(b.h * k);
  return [G.cx - w / 2, titled ? 236 : G.top, w, h];
}

/** satellite defaults for a rail: mini cards, drawn over the hero's edge on purpose */
function satellite(f) {
  const type = f.type || "callout";
  const base = type === "bigNumber" ? { card: true, size: 84, count: "enter" } : type === "lfText" ? { plate: true, size: 34, maxLines: 2 } : type === "photo" ? { creditPos: "frame" } : {};
  return { ...f, type, props: { ...base, ...(f.props || {}), overlay: true }, z: f.z !== undefined ? f.z : 5 };
}

/**
 * Left / right rails overlapping the edges of (photo hero, overlap > 0) or standing clear of (graphic
 * hero, overlap < 0) the centred hero. s.left / s.right = [fills]; legacy `extra` fills (old side /
 * stack slots) fill the emptier rail, right first.
 */
function railMods(sc, s, host, { overlap = RAIL.overlap, band, extra = [] } = {}) {
  const left = [].concat(s.left || []);
  const right = [].concat(s.right || []);
  extra.forEach((f) => (right.length <= left.length ? right : left).push(f));
  if (!left.length && !right.length) return [];
  const full = host[2] >= G.W;
  const lx = full ? 96 : Math.max(96, host[0] + overlap - RAIL.w);
  const rx = full ? G.W - 96 - RAIL.w : Math.min(G.W - 96 - RAIL.w, host[0] + host[2] - overlap);
  const [y0, y1] = band || (full ? [G.top, G.bottom - 60] : [host[1], host[1] + host[3]]);
  for (const [name, list] of [["left", left], ["right", right]]) if (list.length > RAIL.max) throw new Error(`scaffold ${sc.id}: the ${name} rail holds at most ${RAIL.max} satellites (got ${list.length}); move one to the other rail or drop it`);
  return stack(sc, left.map(satellite), lx, RAIL.w, y0, y1, "l", RAIL.gap).concat(stack(sc, right.map(satellite), rx, RAIL.w, y0, y1, "r", RAIL.gap));
}

/** top-centre kicker + headline (lfText centred, one line by default) */
function topTitle(sc, f0, w = S(10)) {
  const f = { type: "lfText", ...f0, props: { size: 52, maxLines: 1, align: "center", ...((f0 || {}).props || {}) } };
  const h = f.h || lfPreferred(f, w);
  return { mods: [mod(sc, f, "lfText", [G.cx - w / 2, TITLE_Y, w, h], "title")], bottom: TITLE_Y + h };
}

/** lower-third headline centred on the axis, riding over the hero's bottom edge (full bleed: y 956 - h) */
function centredLT(sc, f0, host, extra = {}) {
  const p = (f0 && f0.props) || {};
  const est = Math.max(String(p.title || "").length * 24.4, String(p.sub || "").length * 13.3, String(p.tag || "").length * 11.5) + 110;
  const w = f0.w || Math.max(560, Math.min(960, Math.round(est)));
  const h = p.sub ? 150 : 118;
  const full = host[2] >= G.W;
  const y = full ? 956 - h : Math.min(956 - h, host[1] + host[3] - Math.round(h * 0.45));
  return mod(sc, f0, "lowerThird", [G.cx - w / 2, y, w, h], "lt", { z: 6, ...extra });
}

/** graphic hero width with / without rails (rails stand RAIL.clear px clear of it) */
function graphicW(railed) {
  return railed ? G.W - 2 * (96 + RAIL.w + RAIL.clear) : S(10);
}

// ---------------------------------------------------------------- templates
function lfCold(sc) {
  const s = sc.slots || {};
  const host = [0, 0, G.W, G.H];
  const mods = [photoMod(sc, s.photo || s.hero, host, "photo", { card: false, scrim: s.scrim || "bottom", creditPos: "frame", backdrop: true })];
  const railed = (s.left || []).length + (s.right || []).length + (s.stack || []).length > 0;
  const w = railed ? 1120 : S(10);
  const head = { type: "lfText", ...(s.headline || {}), props: { kinetic: true, size: 84, maxLines: 2, align: "center", ...((s.headline || {}).props || {}) } };
  mods.push(...stack(sc, [head], G.cx - w / 2, w, 600, 940, "t"));
  mods.push(...railMods(sc, s, host, { band: [G.top, 580], extra: s.stack || [] }));
  mods.push(...overlays(sc, s.overlays, host));
  return { layout: "full", modules: mods };
}

function lfStage(sc) {
  const s = sc.slots || {};
  const heroFill = s.hero || s.photo;
  if (!heroFill) throw new Error(`scaffold ${sc.id}: lfStage needs slots.hero (the centred photo / map / chart)`);
  const type = heroFill.type || "photo";
  const size = s.size || "card";
  const tb = s.title ? topTitle(sc, s.title) : null;
  const host = heroRect(size, !!tb);
  const mods = tb ? tb.mods.slice() : [];
  const graphic = type === "barChart" || type === "lineChart";
  if (type === "photo") mods.push(photoMod(sc, heroFill, host, "hero", size === "full" ? { card: false, creditPos: "frame", scrim: s.scrim, backdrop: true } : { creditPos: "frame" }));
  else mods.push(mod(sc, heroFill, type, host, "hero", type === "mapCard" ? { props: { creditPos: "frame" } } : {}));
  mods.push(...railMods(sc, s, host, { overlap: graphic ? -RAIL.clear : type === "mapCard" ? 40 : RAIL.overlap }));
  if (s.headline) mods.push(centredLT(sc, s.headline, host));
  mods.push(...overlays(sc, s.overlays, host));
  return { layout: "full", modules: mods };
}

/** DEPRECATED (the two-column split): kept so old storyboards still compile; lays out as lfStage */
function lfSplit(sc) {
  const s = sc.slots || {};
  const list = s.stack || [];
  const text = list.find((f) => (f.type || "lfText") === "lfText");
  const others = list.filter((f) => f !== text);
  const left = [];
  const right = [];
  others.forEach((f, i) => ((i % 2 === 0) !== !!sc.mirror ? left : right).push(f));
  const tp = (text && text.props) || {};
  const title = text ? { ...text, props: { eyebrow: tp.eyebrow, title: tp.title, highlight: tp.highlight } } : undefined;
  return lfStage({ ...sc, slots: { hero: s.photo, left, right, title, overlays: s.overlays } });
}

function lfFull(sc) {
  const s = sc.slots || {};
  const host = [0, 0, G.W, G.H];
  const mods = [photoMod(sc, s.photo || s.hero, host, "photo", { card: false, creditPos: "frame", scrim: s.scrim, backdrop: true })];
  if (!s.lowerThird) throw new Error(`scaffold ${sc.id}: lfFull needs slots.lowerThird (graphics over the photo within 1.5 s)`);
  const lt = centredLT(sc, s.lowerThird, host, { at: 0.5 });
  if (lt.at > 1.5 && !lt.anchor) throw new Error(`scaffold ${sc.id}: the lower third must land within 1.5 s`);
  mods.push(lt);
  mods.push(...railMods(sc, s, host, { band: [G.top, lt.rect[1] - 30] }));
  mods.push(...overlays(sc, s.overlays, host));
  return { layout: "full", modules: mods };
}

function titleBlock(sc, s, w = S(10)) {
  if (!s.title) return { mods: [], bottom: G.top - 10 };
  return topTitle(sc, { ...s.title, props: { maxLines: 2, ...((s.title || {}).props || {}) } }, w);
}

function lfChart(sc) {
  const s = sc.slots || {};
  const railed = (s.left || []).length + (s.right || []).length + (s.side || []).length > 0;
  const w = graphicW(railed);
  const tb = titleBlock(sc, s);
  const y0 = tb.bottom + 34;
  const host = [G.cx - w / 2, y0, w, G.bottom - y0];
  const mods = tb.mods.concat([mod(sc, s.chart, (s.chart && s.chart.type) || "barChart", host, "chart")]);
  mods.push(...railMods(sc, s, host, { overlap: -RAIL.clear, extra: s.side || [] }));
  return { layout: "full", modules: mods };
}

function lfNumber(sc) {
  const s = sc.slots || {};
  const mods = [];
  const frame = [0, 0, G.W, G.H];
  if (s.backdrop) mods.push(photoMod(sc, s.backdrop, frame, "bg", { card: false, scrim: "center", creditPos: "frame", backdrop: true }));
  const railed = (s.left || []).length + (s.right || []).length + (s.side || []).length > 0;
  const w = railed ? graphicW(true) : S(8);
  const np = { count: "enter", align: "center", size: 220, ...((s.number || {}).props || {}) };
  const fills = [{ type: "bigNumber", ...(s.number || {}), props: np }].concat((s.stack || []).map((f) => ({ ...f, props: { align: "center", ...(f.props || {}) } })));
  // optically centred (band centre y 525, a little above the frame centre)
  const num = stack(sc, fills, G.cx - w / 2, w, G.top, 900, "n", 36);
  mods.push(...num);
  const top = num[0].rect[1];
  const bot = num[num.length - 1].rect[1] + num[num.length - 1].rect[3];
  const mid = (top + bot) / 2;
  // the satellites orbit the FIGURE (its estimated ink width), not the whole text column
  const txt = `${np.prefix || ""}${Number(np.value || 0).toLocaleString("en-US", { maximumFractionDigits: np.decimals || 0 })}${np.suffix || ""}`;
  const ink = Math.max(txt.length * np.size * 0.6 + (np.unit ? String(np.unit).length * np.size * 0.165 + np.size * 0.2 : 0), String(np.context || "").length * 17, 480);
  const iw = Math.min(w, Math.round(ink + 96));
  mods.push(...railMods(sc, s, [G.cx - iw / 2, top, iw, bot - top], { overlap: -48, band: [Math.max(G.top, mid - 330), Math.min(G.bottom, mid + 330)], extra: s.side || [] }));
  mods.push(...overlays(sc, s.overlays, frame));
  return { layout: "full", modules: mods };
}

function lfCompare(sc) {
  const s = sc.slots || {};
  const tb = titleBlock(sc, s);
  const y0 = tb.bottom + 40;
  const w = S(10);
  return { layout: "full", modules: tb.mods.concat([mod(sc, s.compare, "compareCols", [G.cx - w / 2, y0, w, G.bottom - y0], "cmp")]) };
}

function lfTimeline(sc) {
  const s = sc.slots || {};
  const tb = titleBlock(sc, s);
  const y0 = tb.bottom + 44;
  return { layout: "full", modules: tb.mods.concat([mod(sc, s.timeline, "eraTimeline", [X(0), y0, S(12), G.bottom - y0], "tl")]) };
}

function lfMap(sc) {
  const s = sc.slots || {};
  return lfStage({ ...sc, slots: { ...s, hero: { type: "mapCard", ...(s.map || {}) }, photo: undefined, left: s.left, right: [].concat(s.right || [], s.side || []) } });
}

function lfHeadline(sc) {
  const s = sc.slots || {};
  const mods = [];
  if (s.photo) {
    const host = [G.cx - 480, G.top, 960, 540];
    // the card overlaps the photo's bottom edge, so the photo credits to the frame line
    mods.push(photoMod(sc, s.photo, host, "photo", { creditPos: "frame" }));
    mods.push(mod(sc, s.headline, "headlineCard", [G.cx - 576, 600, 1152, 360], "news", { z: 2, props: { overlay: true } }));
    mods.push(...railMods(sc, s, host, { band: [G.top, 570] }));
    mods.push(...overlays(sc, s.overlays, host));
  } else {
    const host = [G.cx - S(10) / 2, 200, S(10), 600];
    mods.push(mod(sc, s.headline, "headlineCard", host, "news"));
    mods.push(...railMods(sc, s, host));
  }
  return { layout: "full", modules: mods };
}

function lfChapter(sc, entities, sb) {
  const s = sc.slots || {};
  const ch = (sb && sb.chapter) || {};
  const props = { index: ch.index, count: ch.count, title: ch.title, align: "center", ...((s.card || {}).props || {}) };
  const mods = [];
  if (s.photo) {
    const host = [G.cx - 352, 118, 704, 396];
    mods.push(photoMod(sc, s.photo, host, "photo", { creditPos: "frame" }));
    mods.push(mod(sc, { ...(s.card || {}), props }, "chapterCard", [X(0), 530, S(12), 430], "card"));
    mods.push(...overlays(sc, s.overlays, host));
  } else mods.push(mod(sc, { ...(s.card || {}), props }, "chapterCard", [G.cx - S(10) / 2, 110, S(10), 850], "card"));
  return { layout: "title", modules: mods };
}

function lfJoke(sc) {
  const s = sc.slots || {};
  const host = heroRect("card", false);
  const mods = [photoMod(sc, s.art, host, "art", { creditPos: "frame" })];
  const punch = { type: "lfText", ...(s.punchline || {}), props: { size: 52, maxLines: 2, plate: true, ...((s.punchline || {}).props || {}) } };
  const w = punch.w || 1100;
  const h = punch.h || lfPreferred(punch, w);
  mods.push(mod(sc, punch, "lfText", [G.cx - w / 2, Math.min(956 - h, host[1] + host[3] - 70), w, h], "p0", { z: 6 }));
  if (s.tag) mods.push(mod(sc, s.tag, "callout", [host[0] + host[2] - 280, host[1] - 22, 320, 62], "tag", { z: 6, props: { rotate: -4, tone: "red" } }));
  mods.push(...railMods(sc, s, host, { band: [host[1] + 60, host[1] + host[3] - 90], extra: s.stack || [] }));
  mods.push(...overlays(sc, s.overlays, host));
  return { layout: "full", modules: mods };
}

function lfRecap(sc) {
  const s = sc.slots || {};
  const railed = !!s.photo || (s.left || []).length + (s.right || []).length > 0;
  const w = railed ? graphicW(true) : S(8);
  const tb = titleBlock(sc, s);
  const y0 = tb.bottom + 40;
  const host = [G.cx - w / 2, y0, w, G.bottom - y0];
  const mods = tb.mods.concat([mod(sc, s.list, "recapList", host, "list")]);
  mods.push(...railMods(sc, s, host, { overlap: -RAIL.clear, extra: s.photo ? [{ type: "photo", h: 220, ...s.photo }] : [] }));
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
  LF_TEMPLATES: { lfCold, lfStage, lfSplit, lfFull, lfChart, lfNumber, lfCompare, lfTimeline, lfMap, lfHeadline, lfChapter, lfJoke, lfRecap, lfEnd },
  lfChrome,
  lfPreferred,
  LF_GRID: { X, S, ...G, HERO, RAIL },
  NO_CHROME,
};
