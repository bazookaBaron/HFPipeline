"use strict";

/**
 * DH (dark-HUD-persistent, refs R1/R2) layout templates. Every rect is [x, y, w, h] in
 * 1080x1920 px, measured on R2 (analysis/pacing-audit-20260924/design/R2/AUDIT.md "Layout
 * templates" + full-res frames 0.5 / 3.0 / 13.5 / 32.6 / 41.6 / 59.2 / 64.1 / 71.78 / 143.9).
 *
 * A template turns a scaffold's filled slots into modules. Carrier modules (hud, users,
 * router, lever, left/right env cards) use FIXED ids so consecutive scaffolds share the same
 * element (the carrier persists and mutates); slot modules get the id the storyboard gives
 * them, or "<scaffold>_<slot>".
 */

const COLUMN = { x: 330, w: 690 }; // content column beside the mascot (x 330-1020)
const FULL = { x: 60, w: 960 }; // mascot hidden (x 60-1020)

const R = {
  hud: [60, 235.5, 960, 69],
  labelCol: [60, 336, 960, 50], // cap-top 342, centred on the frame axis x=540
  // column carrier (T1)
  usersCol: [330, 571, 690, 209],
  routerCol: [330, 780, 690, 64],
  leverCol: [330, 844, 690, 106],
  leftCol: [330, 949.5, 334.5, 350.5],
  rightCol: [684, 949.5, 331.5, 350.5],
  // top slot (T1): below the label, above the router
  slotCol: [330, 420, 690, 340],
  slotColNoLabel: [330, 336, 690, 424],
  // full-width reframe (T2, 59.2 / 64.1)
  headlineFull: [60, 340, 960, 250],
  optionFull: [225, 610, 630, 86],
  usersFull: [94.5, 573, 891, 151],
  routerFull: [150, 724, 780, 120],
  leverFull: [60, 844, 960, 106],
  leftFull: [60, 950, 470, 350],
  rightFull: [550, 950, 470, 350],
  // chart scene (71.78)
  statTop: [330, 337, 267, 120],
  heroTopRight: [600, 330, 420, 130],
  chartCol: [330, 481, 690, 279],
  // title (T6 S1, 0.5)
  titleEyebrow: [60, 318, 960, 40],
  titleLeft: [60, 396, 469.5, 700.5],
  titleRight: [550.5, 396, 469.5, 700.5],
  titleFooter: [60, 1165, 960, 60],
  // problem (T0, 3.0)
  tagProblem: [708, 453, 144, 35],
  browserCol: [330, 501, 690, 699],
  // outro (T6 S17, 143.9)
  outroHeadline: [60, 340, 960, 280],
  outroLeft: [60, 618, 470, 388],
  outroRight: [550, 618, 470, 388],
  outroMicro: [60, 1098, 960, 40],
};

// lever knob anchors (% of lever width) = card centres, per layout
const LEVER_AT = {
  column: { leftAt: ((330 + 334.5 / 2 - 330) / 690) * 100, rightAt: ((684 + 331.5 / 2 - 330) / 690) * 100 },
  full: { leftAt: ((60 + 235 - 60) / 960) * 100, rightAt: ((550 + 235 - 60) / 960) * 100 },
};

function carrier(entities, layout, opts = {}) {
  const col = layout === "column";
  const mods = [];
  mods.push({ id: "hud", type: "hud", rect: R.hud, props: entities.hud || {}, enter: opts.hudEnter || "fade" });
  if (opts.users !== false && entities.users) {
    mods.push({ id: col ? "users" : "usersFull", type: "users", rect: col ? R.usersCol : R.usersFull, props: col ? entities.users : { ...entities.users, count: 11, pitch: 80, convergeY: 100 } });
  }
  // router/lever/cards keep one id across layouts (built once): the router flips 1-row <-> 2-row
  // from its rect height; lever anchors differ by <3 px between layouts, so one set is used.
  mods.push({ id: "router", type: "router", rect: col ? R.routerCol : R.routerFull, props: { ...(entities.router || {}), lever: "lever", leftCard: "left", rightCard: "right" } });
  mods.push({ id: "lever", type: "lever", rect: col ? R.leverCol : R.leverFull, props: { ...(entities.lever || {}), ...LEVER_AT.column } });
  mods.push({ id: "left", type: "envCard", rect: col ? R.leftCol : R.leftFull, props: entities.left || {} });
  mods.push({ id: "right", type: "envCard", rect: col ? R.rightCol : R.rightFull, props: entities.right || {} });
  return mods;
}

function slotModule(sc, name, fill, rect) {
  if (!fill) return null;
  return { id: fill.id || `${sc.id}_${name}`, type: fill.type, rect: fill.rect || rect, props: fill.props || {}, enter: fill.enter, at: fill.at, exit: fill.exit, z: fill.z };
}

/** template(sc, entities) -> {layout, modules} */
const TEMPLATES = {
  // T6 S1: eyebrow + two tall env cards + tracked footer word; no HUD, no mascot
  title(sc) {
    const s = sc.slots || {};
    return {
      layout: "title",
      modules: [
        slotModule(sc, "eyebrow", s.eyebrow && { type: "micro", ...s.eyebrow }, R.titleEyebrow),
        slotModule(sc, "left", s.left && { type: "titleCard", id: "titleLeft", ...s.left }, R.titleLeft),
        slotModule(sc, "right", s.right && { type: "titleCard", id: "titleRight", ...s.right }, R.titleRight),
        slotModule(sc, "footer", s.footer && { type: "micro", ...s.footer }, R.titleFooter),
      ].filter(Boolean),
    };
  },
  // T0: label + browser (+ amber tag); mascot on, HUD off
  problem(sc) {
    const s = sc.slots || {};
    return {
      layout: "column",
      modules: [
        slotModule(sc, "label", s.label && { type: "label", ...s.label }, R.labelCol),
        slotModule(sc, "tag", s.tag && { type: "pill", ...s.tag }, R.tagProblem),
        slotModule(sc, "main", s.main && { type: "browser", ...s.main }, R.browserCol),
      ].filter(Boolean),
    };
  },
  // T1: HUD + label + swappable top slot + carrier (users row only when the slot is empty)
  carrier(sc, entities) {
    const s = sc.slots || {};
    const hasSlot = !!s.slot;
    const mods = carrier(entities, "column", { users: !hasSlot && s.users !== false });
    if (s.label) mods.push(slotModule(sc, "label", { type: "label", ...s.label }, R.labelCol));
    if (hasSlot) mods.push(slotModule(sc, "slot", s.slot, s.label ? R.slotCol : R.slotColNoLabel));
    (s.extra || []).forEach((x, i) => mods.push(slotModule(sc, "x" + i, x, x.rect)));
    return { layout: "column", modules: mods };
  },
  // chart scene (71.78): stat box + hero number + chart over the carrier
  alarm(sc, entities) {
    const s = sc.slots || {};
    const mods = carrier(entities, "column", { users: false });
    if (s.stat) mods.push(slotModule(sc, "stat", { type: "stat", ...s.stat }, R.statTop));
    if (s.hero) mods.push(slotModule(sc, "hero", { type: "hero", ...s.hero }, R.heroTopRight));
    if (s.chart) mods.push(slotModule(sc, "chart", { type: "chart", ...s.chart }, R.chartCol));
    return { layout: "column", modules: mods };
  },
  // T2: full-width reframe; mascot exits, carrier relayouts, headline / option row / users on top
  reframe(sc, entities) {
    const s = sc.slots || {};
    const mods = carrier(entities, "full", { users: !!s.users });
    if (s.headline) mods.push(slotModule(sc, "headline", { type: "headline", ...s.headline }, R.headlineFull));
    if (s.option) mods.push(slotModule(sc, "option", { type: "option", ...s.option }, R.optionFull));
    if (s.stat) mods.push(slotModule(sc, "stat", { type: "stat", ...s.stat }, s.stat.rect || [390, 334, 300, 104]));
    return { layout: "full", modules: mods };
  },
  // T6 S17: two-line coloured headline + both cards + micro caption; no HUD, no mascot
  outro(sc, entities) {
    const s = sc.slots || {};
    return {
      layout: "title",
      modules: [
        slotModule(sc, "headline", s.headline && { type: "headline", ...s.headline }, R.outroHeadline),
        { id: "outroLeft", type: "envCard", rect: R.outroLeft, props: { ...(entities.left || {}), ...(s.leftProps || {}) } },
        { id: "outroRight", type: "envCard", rect: R.outroRight, props: { ...(entities.right || {}), ...(s.rightProps || {}) } },
        slotModule(sc, "micro", s.micro && { type: "micro", ...s.micro }, R.outroMicro),
      ].filter(Boolean),
    };
  },
};

module.exports = { TEMPLATES, R, LEVER_AT, COLUMN, FULL };
