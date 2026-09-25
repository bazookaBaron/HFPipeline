"use strict";

/**
 * v3 compiler: storyboard (sentences + templated scaffolds + word-anchored events) + the final
 * narration timeline -> the stage spec that lib/stage/core.js renders.
 *
 * storyboard.v3 = {
 *   version: "storyboard.v3", profile: "DH", topic,
 *   entities: { hud, users, router, lever, left, right },           // carrier props (persist)
 *   sentences: [{ id, text }],
 *   scaffolds: [{ id, template, from, slots }],                     // `from` = first sentence id
 *   events:    [{ sentence, anchor: {text, occurrence?}, op, target, value?, lead? }]
 * }
 * A slot fill may carry `anchor` ({text, occurrence?, sentence?}) to enter on that word instead
 * of at the scaffold cut. Scaffolds tile the video: each runs from its first sentence's onset
 * (the first from 0) to the next scaffold's onset (the last to the end).
 *
 * Throws on anything it would otherwise have to guess (unknown template, anchor not found,
 * event target not on screen at its time).
 */

const { findAnchorIndex } = require("../v2/timeline");
const { TEMPLATES } = require("./templates-dh");

// Seconds a beat fires before its word onset. Refs land visuals on the audible word or up to
// ~250 ms before it (SPEC 7.2, ASR bias verified); our word times are forced-aligned on our
// own audio, so a small lead keeps the visual from ever lagging the word.
const LEAD = { default: 0.05, traffic: 0.08, retype: 0.0, text: 0.05, strike: 0.0, surge: 0.1 };

function round(x) {
  return Math.round(x * 1000) / 1000;
}

function compileStoryboard(sb, timeline, opts = {}) {
  const { sentenceTimes, words, totalSeconds } = timeline;
  const sIndex = new Map(sb.sentences.map((s, i) => [s.id, i]));
  const tBy = new Map(sentenceTimes.map((t) => [t.id, t]));
  const wordsBy = new Map();
  words.forEach((w) => {
    if (!wordsBy.has(w.sentenceId)) wordsBy.set(w.sentenceId, []);
    wordsBy.get(w.sentenceId).push(w);
  });
  const textBy = new Map(sb.sentences.map((s) => [s.id, s.text]));

  function wordTime(sentenceId, anchor, where) {
    const idx = findAnchorIndex(textBy.get(sentenceId) || "", anchor);
    const ws = wordsBy.get(sentenceId) || [];
    if (idx < 0 || !ws[idx]) throw new Error(`${where}: anchor "${anchor.text}" not found in sentence ${sentenceId}`);
    return ws[idx];
  }

  // ---- scaffolds -> timed modules ----
  const scs = sb.scaffolds.map((sc, i) => {
    if (!TEMPLATES[sc.template]) throw new Error(`scaffold ${sc.id}: unknown template "${sc.template}"`);
    if (!tBy.has(sc.from)) throw new Error(`scaffold ${sc.id}: unknown sentence "${sc.from}"`);
    return { sc, i, t0: i === 0 ? 0 : tBy.get(sc.from).start };
  });
  for (let i = 1; i < scs.length; i++) {
    if (sIndex.get(scs[i].sc.from) <= sIndex.get(scs[i - 1].sc.from)) throw new Error(`scaffold ${scs[i].sc.id} starts before or with ${scs[i - 1].sc.id}`);
  }
  const scaffolds = scs.map((x, i) => {
    const t1 = i + 1 < scs.length ? scs[i + 1].t0 : totalSeconds;
    const built = TEMPLATES[x.sc.template](x.sc, sb.entities || {});
    const modules = built.modules.map((m) => {
      const fill = findFill(x.sc, m.id);
      let at = m.at || 0;
      if (fill && fill.anchor) {
        const sid = fill.anchor.sentence || x.sc.from;
        at = Math.max(0, wordTime(sid, fill.anchor, `scaffold ${x.sc.id} module ${m.id}`).start - (LEAD.default) - x.t0);
      }
      const out = { ...m, at: round(at) };
      delete out.anchor;
      return out;
    });
    return { id: x.sc.id, template: x.sc.template, t0: round(x.t0), t1: round(t1), layout: built.layout, modules };
  });

  // ---- events ----
  const events = (sb.events || []).map((ev, i) => {
    const w = wordTime(ev.sentence, ev.anchor, `event[${i}] ${ev.op}`);
    const lead = ev.lead !== undefined ? ev.lead : LEAD[ev.op] !== undefined ? LEAD[ev.op] : LEAD.default;
    const t = round(Math.max(0, w.start - lead));
    const modId = String(ev.target || "").split(".")[0];
    if (modId !== "mascot") {
      const live = scaffolds.find((s) => t >= s.t0 - 1e-6 && t < s.t1);
      if (!live || !live.modules.some((m) => m.id === modId)) throw new Error(`event[${i}] ${ev.op} -> "${ev.target}" at ${t}s: module not on screen (scaffold ${live ? live.id : "none"})`);
    }
    return { t, op: ev.op, target: ev.target, value: ev.value, word: w.text, wordIndex: w.i };
  });

  return {
    profile: sb.profile || "DH",
    mascot: opts.mascot === false ? null : { open: "assets/mascot/sb_open.png", blink: "assets/mascot/sb_blink.png" },
    scaffolds,
    events,
  };
}

function findFill(sc, moduleId) {
  const slots = sc.slots || {};
  for (const [name, fill] of Object.entries(slots)) {
    if (!fill || typeof fill !== "object") continue;
    if (fill.id === moduleId || `${sc.id}_${name}` === moduleId) return fill;
  }
  return null;
}

module.exports = { compileStoryboard, LEAD };
