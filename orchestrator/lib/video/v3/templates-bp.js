"use strict";

/**
 * BP (light blueprint, ref R6) templates -- geometry from analysis/.../design/R6/AUDIT.md §2:
 *   header bar 44-1038 x 236-291, tracker chips y 303-340.5 (both injected by the compiler, persist)
 *   note card 60-285 x 384-535.5 in the presenter column (injected; swaps per beat)
 *   content column x 301.5-1018.5 (717, fixed for the whole video), cards from y 402 to 1330,
 *   stack gap 21, 2-col split 348 + 21 + 348; blueprint host 301.5-1018.5 x 373.5-1339.5
 *   presenter 0-275 x ~848-1363.5, never hidden
 *
 *   bpScene : slots.top [1-3 modules] top-anchored at y 402; consecutive {half: true} fills share a
 *             row (phone + request list, two cards); stretchable modules absorb spare height.
 *   bpHost  : the persistent blueprint (module id "bp" unless slots.blueprint.id), graph props from
 *             entities.blueprint; the same id reappearing later RECALLS it with its accumulated state.
 * Every scaffold may carry `transition: {out, in}` (core TRANS_OUT / TRANS_IN kinds), `chapter`
 * (header chapter title) and `note: {kind, text}` (note card swap at the scaffold cut).
 */

const { preferred } = require("./templates-generic");

const BPB = { col: { x: 301.5, w: 717 }, top: 402, bottom: 1330, gap: 21, host: [301.5, 373.5, 717, 966] };
const HALF = (BPB.col.w - BPB.gap) / 2;
// modules whose drawing scales with their box: they absorb spare column height (R6 fills to ~1330)
const STRETCH = new Set(["blueprint", "techCards", "featureRows", "costCards", "jargonCloud", "nodes", "chips", "chart", "tree", "reqList", "dotGrid", "latencyBars", "vsCards"]);
const STRETCH_MAX = 1.35;

function withEntities(fill, entities) {
  if (fill && fill.type === "blueprint") return { ...fill, props: { ...((entities && entities.blueprint) || {}), ...(fill.props || {}) } };
  return fill;
}

function column(sc, fills, entities) {
  const rows = [];
  for (let i = 0; i < fills.length; i++) {
    const f = withEntities(fills[i], entities);
    if (f.half && fills[i + 1] && fills[i + 1].half) {
      rows.push([f, withEntities(fills[i + 1], entities)]);
      i++;
    } else rows.push([f]);
  }
  const hOf = (f, w) => f.h || preferred(f, w);
  const heights = rows.map((r) => Math.max(...r.map((f) => hOf(f, r.length === 2 ? HALF : BPB.col.w))));
  const avail = BPB.bottom - BPB.top;
  const used = () => heights.reduce((a, h) => a + h, 0) + BPB.gap * Math.max(0, rows.length - 1);
  let slack = avail - used();
  if (slack < -1) {
    const parts = rows.map((r, i) => `${r.map((f) => f.id || f.type).join(" + ")} ${Math.round(heights[i])} px`).join(", ");
    throw new Error(`scaffold ${sc.id}: content needs ${Math.round(used())} px but the BP column holds ${avail} px (y 402-1330; overflow ${Math.round(-slack)} px); rows: ${parts} + 21 px gaps. Drop a module, rows or items, or set a smaller "h"`);
  }
  const str = rows.map((r, i) => (r.some((f) => STRETCH.has(f.type) && !f.fixed && !f.h) ? i : -1)).filter((i) => i >= 0);
  if (slack > 0 && str.length) {
    const base = str.reduce((a, i) => a + heights[i], 0);
    const grow = Math.min(slack, base * (STRETCH_MAX - 1));
    str.forEach((i) => (heights[i] = Math.round(heights[i] + (grow * heights[i]) / base)));
    slack = avail - used();
  }
  const mods = [];
  let y = BPB.top;
  rows.forEach((r, ri) => {
    r.forEach((f, k) => {
      const w = r.length === 2 ? HALF : BPB.col.w;
      const x = r.length === 2 ? BPB.col.x + k * (HALF + BPB.gap) : BPB.col.x;
      // in a 2-col row a non-stretchable module keeps its own height (top-aligned)
      const h = r.length === 2 && !STRETCH.has(f.type) ? hOf(f, w) : heights[ri];
      mods.push({ id: f.id || `${sc.id}_m${ri}${k ? "b" : ""}`, type: f.type, rect: [x, Math.round(y * 2) / 2, w, h], props: f.props || {}, enter: f.enter, at: f.at, exit: f.exit, z: f.z, anchor: f.anchor });
    });
    y += heights[ri] + BPB.gap;
  });
  return mods;
}

function bpScene(sc, entities) {
  const s = sc.slots || {};
  return { layout: "column", modules: column(sc, s.top || [], entities) };
}

function bpHost(sc, entities) {
  const s = sc.slots || {};
  const b = s.blueprint || {};
  const id = b.id || "bp";
  const props = { ...((entities && entities.blueprint) || {}), ...(b.props || {}) };
  return { layout: "column", modules: [{ id, type: "blueprint", rect: BPB.host.slice(), props, enter: b.enter, anchor: b.anchor }] };
}

/**
 * BP chrome (R6 §2, §5.1-5.3), mirroring the LC/DC insertion: on every topic scaffold (BRAND scenes
 * skipped) the segmented header "bphead", the component tracker "tracker" (when
 * entities.tracker lists components) and the note card "bpnote" persist with the same ids.
 *   - chapter: scaffold.chapter (string) -> "NN TITLE", 1-f swap at the cut when it changes
 *   - note:    scaffold.note | slots.note {kind, text} -> note swap at the cut (mid-scene swaps are
 *              ordinary events {op:"note", target:"bpnote"})
 *   - users counter / tracker lights are ordinary word-anchored events on "bphead" / "tracker"
 */
function bpChrome(sb, scaffolds, chromeEvents, BRAND) {
  const ent = sb.entities || {};
  const noteOf = (src) => (src && (src.note || (src.slots && src.slots.note))) || null;
  let chapter = null;
  let n = 0;
  let first = null;
  let firstNote = null;
  scaffolds.forEach((s, i) => {
    const src = sb.scaffolds[i] || {};
    if (BRAND.has(s.template)) return;
    const name = src.chapter ? String(src.chapter).toUpperCase() : chapter;
    if (name && name !== chapter) {
      n += 1;
      chapter = name;
      if (first === null) first = { n, title: name };
      else chromeEvents.push({ t: s.t0, op: "chapter", target: "bphead", value: { n, title: name } });
    }
    const note = noteOf(src);
    if (note) {
      if (!firstNote) firstNote = note;
      else chromeEvents.push({ t: s.t0, op: "note", target: "bpnote", value: { kind: note.kind, text: note.text } });
    }
  });
  const brand = String(ent.brand || sb.topic || "").toUpperCase().slice(0, 24);
  const header = { brand, chapter: first || "", users: Number(ent.users) || 0, label: ent.usersLabel || "USERS" };
  const tracker = Array.isArray(ent.tracker) && ent.tracker.length ? { items: ent.tracker.slice(0, 9) } : null;
  scaffolds.forEach((s) => {
    if (BRAND.has(s.template)) return;
    const chrome = [{ id: "bphead", type: "bpHeader", rect: [44, 236, 994, 55], props: header, enter: "none", at: 0 }];
    if (tracker) chrome.push({ id: "tracker", type: "tracker", rect: [44, 303, 994, 37.5], props: tracker, enter: "none", at: 0 });
    chrome.push({ id: "bpnote", type: "noteCard", rect: [60, 384, 225, 151.5], props: firstNote || { kind: "rule", text: "" }, enter: "none", at: 0 });
    s.modules.unshift(...chrome);
  });
}

module.exports = { BP_TEMPLATES: { bpScene, bpHost }, bpChrome, BPB, HALF };
