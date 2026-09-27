"use strict";

/**
 * LF templates, set 2 (LONGFORM-V2-PLAN §6 visual variety) for the modules in
 * video-engine/.../stage/modules-lf2.js. Same centre-stage grammar as templates-lf.js (one hero on the
 * centre axis, optional top-centre title, satellites in the left / right rails); registered through
 * templates-lf.js (LF_TEMPLATES), which hands its layout helpers in (no circular require).
 *
 *   lfQuote    centred quoteCard (typeset quote, marker swipes, source) + rails
 *   lfFeature  a graphic hero: timeline | flowDiagram | pictogramGrid | barRace | documentStamp | photoStack,
 *              optional top-centre title, rails
 *   lfDuo      splitScreen, full bleed (two media halves, slanted divider, labels, VS)
 *   lfFlash    flashBurst, full bleed (6-10 quick frames, a kicker word on the last)
 * Route maps ride the existing lfMap / lfStage heroes (map.type "routeMap").
 */

const FEATURE = {
  timeline: { w: 1728, h: 720 },
  flowDiagram: { w: 1728, h: 640 },
  pictogramGrid: { w: 1520, h: 600 },
  barRace: { w: 1440, h: 660 },
  documentStamp: { w: 1060, h: 700 },
  photoStack: { w: 1640, h: 700 },
};
const FEATURE_TYPES = Object.keys(FEATURE);

module.exports = function lf2Templates(h) {
  const { G, mod, railMods, topTitle, overlays } = h;

  /** centred hero box under an optional title; railed heroes narrow to leave the rails clear */
  function heroBox(sc, size, railed, s) {
    const tb = s.title ? topTitle(sc, { ...s.title, props: { maxLines: 1, ...((s.title || {}).props || {}) } }) : null;
    const top = tb ? tb.bottom + 34 : G.top + 10;
    const maxW = railed ? G.W - 2 * (96 + 320 + 36) : G.W - 192;
    const w = Math.min(size.w, maxW);
    const hh = Math.min(size.h, G.bottom - top);
    const y = tb ? top : Math.round(G.top + (G.bottom - G.top - hh) / 2);
    return { tb, rect: [G.cx - w / 2, y, w, hh] };
  }

  function lfQuote(sc) {
    const s = sc.slots || {};
    if (!s.quote) throw new Error(`scaffold ${sc.id}: lfQuote needs slots.quote (props quoteCard)`);
    const railed = (s.left || []).length + (s.right || []).length > 0;
    const { rect } = heroBox(sc, { w: 1480, h: 640 }, railed, {});
    const mods = [mod(sc, s.quote, "quoteCard", rect, "quote")];
    mods.push(...railMods(sc, s, rect, { overlap: -36 }));
    mods.push(...overlays(sc, s.overlays, rect));
    return { layout: "full", modules: mods };
  }

  function lfFeature(sc) {
    const s = sc.slots || {};
    const hero = s.hero;
    if (!hero || !FEATURE[hero.type]) throw new Error(`scaffold ${sc.id}: lfFeature needs slots.hero {type: ${FEATURE_TYPES.join("|")}, props}`);
    const railed = (s.left || []).length + (s.right || []).length > 0;
    const { tb, rect } = heroBox(sc, FEATURE[hero.type], railed, s);
    const mods = tb ? tb.mods.slice() : [];
    mods.push(mod(sc, hero, hero.type, rect, "hero"));
    mods.push(...railMods(sc, s, rect, { overlap: hero.type === "documentStamp" || hero.type === "photoStack" ? 24 : -36 }));
    mods.push(...overlays(sc, s.overlays, rect));
    return { layout: "full", modules: mods };
  }

  function lfDuo(sc) {
    const s = sc.slots || {};
    if (!s.split) throw new Error(`scaffold ${sc.id}: lfDuo needs slots.split (props splitScreen)`);
    const host = [0, 0, G.W, G.H];
    const mods = [mod(sc, s.split, "splitScreen", host, "split", { props: { overlay: true } })];
    mods.push(...overlays(sc, s.overlays, host));
    return { layout: "full", modules: mods };
  }

  function lfFlash(sc) {
    const s = sc.slots || {};
    if (!s.burst) throw new Error(`scaffold ${sc.id}: lfFlash needs slots.burst (props flashBurst)`);
    // each quick frame credits its own picture on the frame (the frame credit line would list them all at once)
    const props = { ...(s.burst.props || {}), items: ((s.burst.props || {}).items || []).map((it) => (it && typeof it === "object" ? { ...it, creditPos: "none" } : it)) };
    return { layout: "full", modules: [mod(sc, { ...s.burst, props }, "flashBurst", [0, 0, G.W, G.H], "burst")] };
  }

  return { lfQuote, lfFeature, lfDuo, lfFlash };
};
module.exports.FEATURE_TYPES = FEATURE_TYPES;
