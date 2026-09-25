"use strict";

/**
 * DC (dark chaptered, ref R5) templates -- SPEC.md 3.3 L11/L4, 4.3:
 *   chrome 204-237 (chapter label + 10-seg progress + hairline, injected by the compiler)
 *   stage frame 60-1020 x 267-840 (persists; its subheader changes on every sub-state)
 *   inside the stage: modules from y 330, x 84-996 (or a serif hero + kicker)
 *   info panel 469-1020 x 891-1127 beside the mascot (0-447 x 783-1377)
 * A sub-state is one scaffold: its stage content and panel hard-swap in 1 frame (R5 E18),
 * sub-states average ~2.6 s; `chapter` names the chapter the sub-state belongs to.
 */

const { fitBlock, place } = require("./templates-generic");

const STAGE = { x: 60, y: 267, w: 960, h: 573 };
const INNER = { x: 84, y: 330, w: 912, bottom: 824 };
const PANEL = [469, 891, 551, 236];

function sub(sc) {
  const s = sc.slots || {};
  const mods = [{ id: "dcstage", type: "dcStage", rect: [STAGE.x, STAGE.y, STAGE.w, STAGE.h], props: { sub: s.sub || "" }, enter: "none" }];
  if (s.hero) {
    const hp = s.hero.props || s.hero;
    mods.push({ id: s.hero.id || `${sc.id}_hero`, type: "dcHero", rect: [INNER.x - 6, 430, INNER.w, 330], props: hp, anchor: s.hero.anchor });
  }
  if (s.stage && s.stage.length) {
    const { list, slack } = fitBlock(s.stage, INNER.w, INNER.bottom - INNER.y);
    if (slack < -1) throw new Error(`sub-state ${sc.id}: stage content needs ${Math.round(INNER.bottom - INNER.y - slack)} px but the stage holds ${INNER.bottom - INNER.y} px`);
    mods.push(...place(sc, list, INNER.x, INNER.w, INNER.y, "down", "s").mods);
  }
  if (s.panel) {
    mods.push({ id: s.panel.id || `${sc.id}_panel`, type: s.panel.type || "panel", rect: PANEL, props: s.panel.props || {}, anchor: s.panel.anchor, enter: s.panel.enter || "none" });
  }
  return { layout: "column", modules: mods };
}

module.exports = { DC_TEMPLATES: { sub }, STAGE, INNER, PANEL };
