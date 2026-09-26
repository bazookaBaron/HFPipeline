"use strict";

/**
 * v3 compiler: storyboard (sentences + templated scaffolds + word-anchored events) + the final
 * narration timeline -> the stage spec that lib/stage/core.js renders.
 *
 * storyboard.v3 = {
 *   version: "storyboard.v3", profile: "DH", topic,
 *   frame?: { w, h },                                              // output frame, default 1080x1920
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

const { findAnchorIndex } = require("./timeline");
const { buildMediaLayer } = require("./media");
const { TEMPLATES: DH_TEMPLATES } = require("./templates-dh");
const { GENERIC_TEMPLATES } = require("./templates-generic");
const { LC_TEMPLATES } = require("./templates-lc");
const { DC_TEMPLATES } = require("./templates-dc");
const { BR_TEMPLATES, brChrome } = require("./templates-br");
const { BP_TEMPLATES, bpChrome } = require("./templates-bp");
const { LF_TEMPLATES, lfChrome } = require("./templates-lf");
const { ENDCARD_TEMPLATES } = require("./endcard");
const BRAND = new Set(["endcard", "promo"]); // channel scenes after the topic: no topic chrome
const TEMPLATES = { ...DH_TEMPLATES, ...GENERIC_TEMPLATES, ...LC_TEMPLATES, ...DC_TEMPLATES, ...BR_TEMPLATES, ...BP_TEMPLATES, ...LF_TEMPLATES, ...ENDCARD_TEMPLATES };

// Seconds a beat fires before its word onset. Refs land visuals on the audible word or up to
// ~250 ms before it (SPEC 7.2, ASR bias verified); our word times are forced-aligned on our
// own audio, so a small lead keeps the visual from ever lagging the word.
const LEAD = { default: 0.05, traffic: 0.08, retype: 0.0, text: 0.05, strike: 0.0, surge: 0.1 };

function round(x) {
  return Math.round(x * 1000) / 1000;
}

// Output frame in px. 9:16 shorts are the default; the 16:9 long-form sets {w:1920, h:1080}.
const DEFAULT_FRAME = { w: 1080, h: 1920 };
function frameOf(sb) {
  const f = (sb && sb.frame) || {};
  const w = Number(f.w) || DEFAULT_FRAME.w;
  const h = Number(f.h) || DEFAULT_FRAME.h;
  return { w, h };
}

/**
 * LF media contract (opts.media = media-manifest.json from lib/media, {version, slots} or a bare slot map):
 *   slots[<id>] = { status: "ok"|"illustration"|"fallback", kind: "image"|"video", file (relative to
 *                   video-engine/, e.g. assets/media/cache/ab/<sha>.jpg), credit, focal: [x,y,w,h] fractions,
 *                   width, height, ... }
 * Any object inside a module's props that carries `slot: "<id>"` (the module itself, photoGrid items,
 * compareCols cols[].photo, eraTimeline ticks[].photo, ...) gets src / credit / focal / kind / mediaStatus
 * from its manifest entry. A missing slot, a fallback entry or no manifest at all -> `missing: true`, and the
 * module renders its typeset fallback state. Credits are drawn by the stage from the manifest, never
 * written by the storyboard author.
 */
function normalizeManifest(m) {
  if (!m || typeof m !== "object") return null;
  return m.slots && typeof m.slots === "object" ? m.slots : m;
}
function resolveSlots(v, slots, used) {
  if (Array.isArray(v)) return v.map((x) => resolveSlots(x, slots, used));
  if (!v || typeof v !== "object") return v;
  const out = {};
  for (const [k, x] of Object.entries(v)) out[k] = resolveSlots(x, slots, used);
  if (typeof v.slot === "string") {
    used.add(v.slot);
    const e = slots ? slots[v.slot] : null;
    if (!e || e.status === "fallback" || !e.file) {
      out.missing = true;
      out.mediaStatus = e ? e.status || "fallback" : "missing";
      delete out.src;
    } else {
      out.src = String(e.file).replace(/\\/g, "/");
      out.credit = v.credit || e.credit || "";
      if (!v.focal && Array.isArray(e.focal)) out.focal = e.focal;
      out.kind = v.kind || e.kind || "image";
      out.mediaStatus = e.status || "ok";
      if (e.width && e.height) out.mediaSize = [e.width, e.height];
      if (e.poster) out.poster = v.poster || e.poster;
    }
  }
  return out;
}
/** every (nested) media object with a real source, for the credit rules: [{obj, top}] */
function mediaObjects(props, top = true, acc = []) {
  if (Array.isArray(props)) props.forEach((x) => mediaObjects(x, false, acc));
  else if (props && typeof props === "object") {
    if (typeof props.src === "string" && !props.missing) acc.push({ obj: props, top });
    Object.entries(props).forEach(([k, x]) => k !== "src" && typeof x === "object" && mediaObjects(x, false, acc));
  }
  return acc;
}
const CREDIT_OWNERS = new Set(["photo", "mapCard"]); // modules that draw their own credit chip (creditPos inside)
const CHART_TYPES = new Set(["barChart", "lineChart"]);

/**
 * LF credit plan: `inside` chips (photo / mapCard, rect in frame px for the credits gate) and the
 * per-scaffold frame credit line (every other fetched image on screen: backdrops, full-bleed, grids,
 * thumbnails, portraits). Throws when a cached (fetched) image has no credit.
 */
function lfCredits(scaffolds) {
  const credits = [];
  const frameText = [];
  scaffolds.forEach((s, si) => {
    const frame = [];
    s.modules.forEach((m) => {
      if (CHART_TYPES.has(m.type) && !(m.props && m.props.source)) throw new Error(`scaffold ${s.id}: chart ${m.id} has no source line (props.source is mandatory)`);
      mediaObjects(m.props || {}).forEach(({ obj, top }) => {
        const fetched = /(^|\/)assets\/media\/cache\//.test(obj.src);
        if (fetched && !String(obj.credit || "").trim()) throw new Error(`scaffold ${s.id}: module ${m.id} shows fetched media ${obj.src} without a credit (the media manifest must carry one)`);
        if (!obj.credit) return;
        const pos = obj.creditPos || "inside";
        if (top && CREDIT_OWNERS.has(m.type) && pos === "inside") {
          const b = obj.card === false ? 0 : 3;
          const tw = Math.min(m.rect[2] - 2 * b - 24, String(obj.credit).length * 9 + 18);
          credits.push({ module: m.id, where: "inside", text: obj.credit, t0: round(s.t0 + (m.at || 0)), t1: s.t1, rect: [m.rect[0] + b + 12, m.rect[1] + m.rect[3] - b - 12 - 26, Math.round(tw), 26] });
        } else if (pos !== "none" && frame.indexOf(obj.credit) < 0) frame.push(obj.credit);
      });
    });
    const text = frame.join("   |   ");
    frameText.push(text);
    if (text) credits.push({ module: "lfcredit", where: "frame", text, t0: s.t0, t1: s.t1, rect: [96, 1016, Math.min(1728, text.length * 9 + 18), 26] });
  });
  // one entry per continuous run (a photo that persists across scaffolds)
  const merged = [];
  credits.forEach((c) => {
    const last = merged.find((x) => x.module === c.module && x.text === c.text && Math.abs(x.t1 - c.t0) < 1e-6);
    if (last) last.t1 = c.t1;
    else merged.push({ ...c });
  });
  return { credits: merged, frameText };
}

function compileStoryboard(sb, timeline, opts = {}) {
  const { sentenceTimes, words, totalSeconds } = timeline;
  const isLF = (sb.profile || "DH") === "LF";
  const mediaSlots = normalizeManifest(opts.media);
  const usedSlots = new Set();
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
    const built = TEMPLATES[x.sc.template](x.sc, sb.entities || {}, sb);
    if (isLF) built.modules.forEach((m) => (m.props = resolveSlots(m.props || {}, mediaSlots, usedSlots)));
    const modules = built.modules.map((m) => {
      const fill = findFill(x.sc, m.id);
      const anchor = m.anchor || (fill && fill.anchor);
      let at = m.at || 0;
      if (anchor) {
        const sid = anchor.sentence || x.sc.from;
        at = Math.max(0, wordTime(sid, anchor, `scaffold ${x.sc.id} module ${m.id}`).start - LEAD.default - x.t0);
        if (at >= t1 - x.t0) throw new Error(`scaffold ${x.sc.id} module ${m.id}: anchor "${anchor.text}" falls after the scaffold ends`);
      }
      const out = { ...m, at: round(at) };
      delete out.anchor;
      // headline lines: explicit props.lineAnchors, else (opener) line 2 lands on the word at
      // ~45% of the scaffold's first sentence -- the hook gets 2 beats (R2 title: word-timed tints)
      if (m.type === "headline" && Array.isArray(m.props.lines) && m.props.lines.length > 1 && !m.props.lineAt) {
        const la = m.props.lineAnchors;
        const base = x.t0 + out.at;
        let lineAt = null;
        if (Array.isArray(la)) {
          lineAt = la.map((an, li) => (an ? round(Math.max(0, wordTime(an.sentence || x.sc.from, an, `headline ${m.id} line ${li + 1}`).start - LEAD.default - base)) : li * 0.1));
        } else if (built.layout === "title") {
          const ws = wordsBy.get(x.sc.from) || [];
          const w = ws[Math.min(ws.length - 1, Math.max(1, Math.round(ws.length * 0.45)))];
          if (w && w.start - base > 0.4) lineAt = [0, round(w.start - LEAD.default - base)];
        }
        if (lineAt) out.props = { ...m.props, lineAt };
      }
      return out;
    });
    const out = { id: x.sc.id, template: x.sc.template, t0: round(x.t0), t1: round(t1), layout: built.layout, modules };
    if (built.noPresenter) out.noPresenter = true; // e.g. the promo footage window spans the presenter's corner
    if (x.sc.transition) out.transition = x.sc.transition; // {out, in} scene transition into this scaffold (core TRANS_*)
    return out;
  });

  // ---- LC chrome: persistent header (kicker + "NN - NN" scene counter stepping on every cut) ----
  const chromeEvents = [];
  if ((sb.profile || "DH") === "LC") {
    // the channel endcard is not a topic scene: no header, not counted
    const total = String(scaffolds.filter((s) => !BRAND.has(s.template)).length).padStart(2, "0");
    const kicker = (sb.entities && sb.entities.kicker) || String(sb.topic || "").toUpperCase().replace(/\s+/g, " ").slice(0, 34);
    scaffolds.forEach((s, i) => {
      if (BRAND.has(s.template)) return;
      s.modules.unshift({ id: "lchead", type: "lcHeader", rect: [70, 224, 938, 55], props: { kicker, counter: `01 — ${total}` }, enter: "none", at: 0 });
      if (i > 0) chromeEvents.push({ t: s.t0, op: "counter", target: "lchead", value: { text: `${String(i + 1).padStart(2, "0")} — ${total}` } });
    });
  }

  // ---- DC chrome: chapter label + 10-seg progress (1-frame swap with the content, R5) and the
  // stage subheader switching on every sub-state ----
  if ((sb.profile || "DH") === "DC") {
    let chapter = null;
    let idx = 0;
    scaffolds.forEach((s, i) => {
      const src = sb.scaffolds[i];
      if (BRAND.has(s.template)) return;
      const name = String(src.chapter || chapter || "").toUpperCase();
      if (name !== chapter) {
        chapter = name;
        idx = Math.min(10, idx + 1);
        if (i > 0) chromeEvents.push({ t: s.t0, op: "chapter", target: "dcchrome", value: { label: name, index: idx } });
      }
      s.modules.unshift({ id: "dcchrome", type: "dcChrome", rect: [60, 204, 960, 40], props: { label: String(sb.scaffolds[0].chapter || "").toUpperCase(), index: 1 }, enter: "none", at: 0 });
      if (i > 0) chromeEvents.push({ t: s.t0, op: "sub", target: "dcstage", value: { text: (src.slots && src.slots.sub) || "" } });
    });
  }

  // ---- BR chrome (R7): brand header (chapter title + running counter) + tab chips (templates-br.js) ----
  if ((sb.profile || "DH") === "BR") brChrome(sb, scaffolds, chromeEvents, BRAND);
  // ---- BP chrome (R6): segmented header + component tracker + note card (templates-bp.js) ----
  if ((sb.profile || "DH") === "BP") bpChrome(sb, scaffolds, chromeEvents, BRAND);
  // ---- LF chrome (plan §3): chapter kicker + progress, media credit line (templates-lf.js) ----
  let lf = null;
  if (isLF) {
    lf = lfCredits(scaffolds);
    lfChrome(sb, scaffolds, chromeEvents, BRAND, lf.frameText);
  }

  // ---- events ----
  const events = (sb.events || []).map((ev, i) => {
    const w = wordTime(ev.sentence, ev.anchor, `event[${i}] ${ev.op}`);
    const lead = ev.lead !== undefined ? ev.lead : LEAD[ev.op] !== undefined ? LEAD[ev.op] : LEAD.default;
    // never before its own sentence's onset: the sentence may start a new scaffold, and the
    // pre-speech pad shrinks with the tempo change (0.06 s authored -> 0.034 s at 1.78x)
    const sStart = tBy.get(ev.sentence) ? tBy.get(ev.sentence).start : 0;
    const t = round(Math.max(0, sStart, w.start - lead));
    const modId = String(ev.target || "").split(".")[0];
    if (modId !== "mascot") {
      const live = scaffolds.find((s) => t >= s.t0 - 1e-6 && t < s.t1);
      if (!live || !live.modules.some((m) => m.id === modId)) throw new Error(`event[${i}] ${ev.op} -> "${ev.target}" at ${t}s: module not on screen (scaffold ${live ? live.id : "none"})`);
    }
    return { t, op: ev.op, target: ev.target, value: ev.value, word: w.text, wordIndex: w.i };
  });

  events.push(...chromeEvents);
  // root-level timed <video> trims for media windows (lib/video/v3/media.js)
  const media = buildMediaLayer({ scaffolds, events, sbScaffolds: sb.scaffolds, wordTime });
  const out = {
    profile: sb.profile || "DH",
    frame: frameOf(sb),
    // LF never shows a presenter (plan §3)
    mascot: opts.mascot === false || isLF ? null : presenterSpec(words, opts.presenter),
    scaffolds,
    events,
    media,
  };
  if (isLF) {
    out.credits = lf.credits; // [{module, where: inside|frame, text, t0, t1, rect}] -> v3_gates credits_visible
    out.mediaSlots = [...usedSlots];
    // LF footage plays UNDER the stage (the stage turns transparent, a root plate draws the paper), so
    // lower thirds, callouts and annotations stay on top of the video (composeStage.js)
    if (media.length) out.underlay = true;
  }
  return out;
}

// ---- presenters: "guy" (default channel character) and the original robot ----
// All five sprites share one canvas (701x1112, feet on the bottom edge) and differ only on the
// face screen; `face` gives the eye / mouth regions (fractions of the canvas: x, y, w, h) so the
// stage can layer eye and mouth states independently. `talk` = narration word intervals that
// drive the mouth flap. The old SpongeBob placeholder (assets/mascot/sb_*.png) stays on disk.
const PRESENTERS = {
  robot: {
    open: "assets/mascot/presenter/open.png",
    blink: "assets/mascot/presenter/blink.png",
    talk2: "assets/mascot/presenter/talk2.png",
    glance: "assets/mascot/presenter/glance.png",
    talkSprite: "assets/mascot/presenter/talk.png",
    aspect: 0.6304,
    face: { eyes: [0.3345, 0.2262, 0.3576, 0.1061], mouth: [0.4505, 0.3323, 0.1418, 0.0706] },
  },
  // the channel character (Charcters/main_character_2.svg -> assets/mascot/guy/source/build_guy.py):
  // same face contract plus `arm` (raised forearm + hand) that swings about the elbow on speech beats
  guy: (() => {
    const m = require("../../../../video-engine/assets/mascot/guy/presenter.json");
    return {
      open: "assets/mascot/guy/open.png",
      blink: "assets/mascot/guy/blink.png",
      talk2: "assets/mascot/guy/talk2.png",
      glance: "assets/mascot/guy/glance.png",
      talkSprite: "assets/mascot/guy/talk.png",
      arm: "assets/mascot/guy/arm.png",
      armPivot: m.armPivot,
      aspect: m.aspect,
      face: { eyes: m.eyes, mouth: m.mouth },
    };
  })(),
};
const DEFAULT_PRESENTER = "guy";

function presenterSpec(words, name) {
  const talk = (words || [])
    .filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start)
    .map((w) => [round(w.start), round(w.end)]);
  // `talk` doubles as the open-mouth sprite path and the word intervals: the sprite lives in
  // talkSprite so the interval list keeps the documented name.
  const key = name || process.env.HF_PRESENTER || DEFAULT_PRESENTER;
  if (!PRESENTERS[key]) throw new Error(`unknown presenter "${key}" (have ${Object.keys(PRESENTERS).join(", ")})`);
  return { ...PRESENTERS[key], talk };
}

function findFill(sc, moduleId) {
  const slots = sc.slots || {};
  for (const [name, fill] of Object.entries(slots)) {
    if (!fill || typeof fill !== "object") continue;
    if (fill.id === moduleId || `${sc.id}_${name}` === moduleId) return fill;
  }
  return null;
}

module.exports = { compileStoryboard, LEAD, TEMPLATES, DEFAULT_FRAME, frameOf, normalizeManifest, resolveSlots };
