"use strict";

/**
 * LC (light scene-cut, refs R3/R4) templates. Geometry from SPEC.md 3.1-3.3 / 4.2 (R4 canonical):
 *   header 224-279 (kicker + counter + rule, injected by the compiler, persists)
 *   title cap-top 301, subtitle y 471 (fixed), content column x 320-1010 from y 549 (top-anchored),
 *   content bottom <= 1265, footnote dash at (320,1299) + text 1326, mascot column 36-296 (never hidden).
 * Every scene is rebuilt from empty after a hard cut (R3/R4 append-only grammar): module ids are
 * per scene, so nothing persists except the header and the mascot.
 */

const { preferred, fitBlock, place } = require("./templates-generic");

const LCB = { col: { x: 320, w: 690 }, top: 549, bottom: 1265, gap: 30 };

function scene(sc) {
  const s = sc.slots || {};
  const mods = [];
  mods.push({ id: `${sc.id}_title`, type: "lcTitle", rect: [70, 281, 940, 240], props: { title: (s.title && (s.title.props || s.title).text) || s.title || "", subtitle: (s.subtitle && (s.subtitle.props || s.subtitle).text) || s.subtitle || "" } });
  let y = LCB.top;
  if (s.display) {
    const dp = s.display.props || s.display;
    mods.push({ id: s.display.id || `${sc.id}_display`, type: "lcDisplay", rect: [LCB.col.x, y, LCB.col.w, 110], props: dp, anchor: s.display.anchor });
    y += 110 + LCB.gap;
  }
  const avail = LCB.bottom - y;
  const top = (s.top || []).map((f) => ({ ...f, at: f.at !== undefined ? f.at : 0.05 })); // R4: content group +33-67 ms after the title
  const { list, slack } = fitBlock(top, LCB.col.w, avail);
  if (slack < -1) throw new Error(`scene ${sc.id}: content needs ${Math.round(avail - slack)} px but only ${avail} px fit under the title (overflow ${Math.round(-slack)} px)`);
  const blk = place(sc, list, LCB.col.x, LCB.col.w, y, "down", "m");
  if (s.footnote) {
    const fp = s.footnote.props || s.footnote;
    mods.push({ id: s.footnote.id || `${sc.id}_foot`, type: "lcFoot", rect: [LCB.col.x, 1299, LCB.col.w, 70], props: fp, anchor: s.footnote.anchor });
  }
  return { layout: "column", modules: mods.concat(blk.mods) };
}

// LC opener / closer: title + subtitle + a visual, same frame grammar (R3 S01: full answer by 1.5 s)
function lcOpener(sc) {
  return scene(sc);
}

module.exports = { LC_TEMPLATES: { scene, lcOpener }, LCB };
