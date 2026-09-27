"use strict";

/**
 * Deterministic storyboard auto-fixes (LONGFORM-V2-PLAN §9, cost): run on a chapter storyboard BEFORE any model
 * repair. Each fixer changes only what a validation rule flags; applyAutoFixes() keeps a round of fixes only when
 * re-validation is better (fewer problems, or it got past the pre-checks), else tries the fixers one by one.
 * Whatever code cannot fix (invented numbers, missing media, a scene that needs new content) goes to the model.
 *
 *   text       too many words for its box -> abbreviate / drop filler words / cut at a word; lfText titles that
 *              overflow in the layout audit shrink (size) and rebalance onto 2 lines first; "sub" paragraphs go;
 *              map / pin labels are cut to 14 characters
 *   overlap    satellites rebalanced across the rails (a 5th+ satellite is dropped), a lower-third headline next
 *              to a title goes, back-to-back push transitions become a hard cut, overlays that collide in the
 *              layout audit are nudged apart; map pins on the same spot / over the cap go, a second zoomTo in a
 *              scene goes, an event too close after a zoomTo is re-anchored later (or dropped); a highlight label a
 *              later zoom would push off the picture gets a hold that ends before the zoom
 *   cadence    beats/min over the band: drop the secondary events in the densest spots (merge); under the band
 *              or long holds: add emphasis beats in the widest gaps (split)
 *   variety    a hero that differs from the beat-sheet plan is swapped to the planned type when its content fits
 *              (barChart <-> lineChart, countryMap <-> worldMap); a scaffold that starts one sentence off a
 *              planned scene start is moved onto it
 *   numbers    string figures parsed, huge raw figures scaled (5500000000 -> 5.5 billion), long decimals rounded,
 *              long digit runs in labels compacted (1500000 -> 1.5M)
 *   misc       unused media intents dropped, count "op" without a timely count -> count "enter", a text highlight
 *              without props.highlight gets one from its title, an unannotated photo gets a highlight on its words
 */

const { compileStoryboard } = require("../video/v3/compile");
const { syntheticTimeline, PROFILES } = require("../video/v3/storyboardGen");

const TEXT = { title: 8, context: 8, callout: 6, promise: 10, deck: 12 };
const MAP_LABEL = 14;
const MAP_TYPES = new Set(["countryMap", "worldMap"]);

const clone = (x) => JSON.parse(JSON.stringify(x));
const words = (t) => String(t || "").split(/\s+/).filter(Boolean);
const modOf = (target) => String(target || "").split(".")[0];

// ------------------------------------------------------------------------------------------ text helpers
const ABBREV = [
  [/\bInternational Monetary Fund\b/gi, "IMF"],
  [/\bUnited States( of America)?\b/gi, "US"],
  [/\bUnited Kingdom\b/gi, "UK"],
  [/\bEuropean Union\b/gi, "EU"],
  [/\bPrime Minister\b/gi, "PM"],
  [/\bChief Executive( Officer)?\b/gi, "CEO"],
  [/\bgross domestic product\b/gi, "GDP"],
  [/\b(\d[\d.,]*)\s*(per ?cent|percent)\b/gi, "$1%"],
  [/\b(\d[\d.,]*)\s+million\b/gi, "$1M"],
  [/\b(\d[\d.,]*)\s+billion\b/gi, "$1B"],
  [/\b(\d[\d.,]*)\s+trillion\b/gi, "$1T"],
  [/\bversus\b/gi, "vs"],
  [/\bapproximately\b/gi, "about"],
  [/\band\b/g, "&"],
];
const FILLER = new Set(["a", "an", "the", "of", "that", "very", "really", "just", "which", "who", "is", "are", "was", "were", "its", "their", "has", "have", "had", "been", "some", "all"]);
const DANGLING = new Set(["and", "&", "of", "to", "the", "a", "an", "with", "for", "in", "on", "at", "by", "from", "as", "or", "but", "vs"]);

function abbreviate(t) {
  return ABBREV.reduce((s, [rx, rep]) => s.replace(rx, rep), String(t || "")).replace(/\s{2,}/g, " ").trim();
}
function dropFillers(t, keep = "") {
  const k = new Set(words(keep).map((w) => w.toLowerCase()));
  const ws = words(t);
  return ws.filter((w, i) => i === 0 || k.has(w.toLowerCase()) || !FILLER.has(w.toLowerCase().replace(/[^a-z]/g, ""))).join(" ");
}
function trimDangling(ws) {
  const out = ws.slice();
  while (out.length > 1 && DANGLING.has(out[out.length - 1].toLowerCase().replace(/[^a-z&]/g, ""))) out.pop();
  if (out.length) out[out.length - 1] = out[out.length - 1].replace(/[,;:\-–—]+$/, "");
  return out;
}

/** a label of at most `max` words: abbreviations, then filler words out, then cut at a word */
function shortenWords(text, max, keep = "") {
  let t = String(text || "").trim();
  if (words(t).length <= max) return t;
  t = abbreviate(t);
  if (words(t).length > max) t = dropFillers(t, keep);
  if (words(t).length > max) t = trimDangling(words(t).slice(0, max)).join(" ");
  return t;
}

/** a label of at most `max` characters, same order of moves */
function shortenChars(text, max) {
  let t = String(text || "").trim();
  if (t.length <= max) return t;
  t = abbreviate(t);
  if (t.length > max) t = dropFillers(t);
  if (t.length > max) {
    const ws = [];
    for (const w of words(t)) {
      if ((ws.concat(w).join(" ")).length > max) break;
      ws.push(w);
    }
    t = ws.length ? trimDangling(ws).join(" ") : t.slice(0, max);
  }
  return t;
}

/** keep props.highlight a phrase of its text after the text was shortened */
function syncHighlight(p, field) {
  if (!p.highlight || String(p[field] || "").includes(p.highlight)) return;
  const text = String(p[field] || "");
  const hw = words(p.highlight);
  for (let n = hw.length; n >= 1; n--) {
    for (let i = 0; i + n <= hw.length; i++) {
      const ph = hw.slice(i, i + n).join(" ");
      if (text.includes(ph)) return void (p.highlight = ph);
    }
  }
  const tw = words(text);
  p.highlight = tw.slice(-Math.min(2, tw.length)).join(" ");
}

// ------------------------------------------------------------------------------------------ storyboard walk
/** every slot fill: {sc, key, fill, list?, i?} (arrays keep their list + index for removal) */
function fills(sb) {
  const out = [];
  (sb.scaffolds || []).forEach((sc) =>
    Object.entries(sc.slots || {}).forEach(([key, v]) => {
      if (Array.isArray(v)) v.forEach((f, i) => f && typeof f === "object" && out.push({ sc, key, fill: f, list: v, i }));
      else if (v && typeof v === "object") out.push({ sc, key, fill: v });
    })
  );
  return out;
}

/** the module type a fill renders as (same inference as storyboardLF compositionProblems) */
function typeOf(sc, key, f) {
  if (f.type) return f.type;
  if (key === "overlays") return "callout";
  if (key === "headline" || key === "title" || key === "punchline") return sc.template === "lfStage" && key === "headline" ? "lowerThird" : sc.template === "lfHeadline" ? "headlineCard" : "lfText";
  if (key === "lowerThird") return "lowerThird";
  if (key === "card") return "chapterCard";
  if (key === "number") return "bigNumber";
  if (key === "chart") return "barChart";
  if (key === "map") return "countryMap";
  if (key === "hero" || key === "photo") return "photo";
  return "";
}

function removeModules(sb, ids) {
  const set = new Set(ids.filter(Boolean));
  if (!set.size) return;
  sb.events = (sb.events || []).filter((e) => !set.has(modOf(e.target)));
}

/** compile on the relaxed synthetic LF timeline; null when it does not compile */
function compiled(sb) {
  const tl = syntheticTimeline(sb, PROFILES.LF.syn);
  try {
    return { tl, spec: compileStoryboard(sb, tl, { mascot: false }) };
  } catch (_) {
    return null;
  }
}

/** sentence id -> scaffold id (from each scaffold's "from" up to the next one) */
function sentenceScaffold(sb) {
  const ids = (sb.sentences || []).map((s) => s.id);
  const starts = (sb.scaffolds || []).map((sc) => ({ id: sc.id, at: ids.indexOf(sc.from) })).filter((x) => x.at >= 0).sort((a, b) => a.at - b.at);
  const out = {};
  ids.forEach((sid, i) => {
    const s = starts.filter((x) => x.at <= i).pop();
    if (s) out[sid] = s.id;
  });
  return out;
}

const norm = (x) => String(x).toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
function anchorFor(sb, w) {
  const toks = String((sb.sentences.find((s) => s.id === w.sentenceId) || {}).text || "").split(/\s+/).filter(Boolean);
  const occurrence = toks.slice(0, w.wi + 1).filter((x) => norm(x) === norm(toks[w.wi])).length;
  return { text: toks[w.wi], occurrence };
}

// ------------------------------------------------------------------------------------------ fixers
/** text too long for its box (word limits, map labels, layout-audit overflow) */
function fixText(sb, ctx, problems, opts = {}) {
  const out = [];
  fills(sb).forEach(({ sc, key, fill }) => {
    const p = fill.props;
    if (!p || typeof p !== "object") return;
    const type = typeOf(sc, key, fill);
    const cut = (field, max) => {
      if (words(p[field]).length <= max) return;
      const before = p[field];
      p[field] = shortenWords(p[field], max, p.highlight);
      if (p[field] !== before) {
        syncHighlight(p, field);
        out.push(`${sc.id}.${key}: ${field} "${before}" -> "${p[field]}"`);
      }
    };
    if (type === "lfText") {
      cut("title", TEXT.title);
      if (p.sub) {
        delete p.sub;
        out.push(`${sc.id}.${key}: dropped the "sub" paragraph`);
      }
    }
    if (type === "bigNumber") cut("context", TEXT.context);
    if (type === "callout") cut("text", TEXT.callout);
    if (type === "lowerThird") {
      cut("title", TEXT.title);
      cut("sub", TEXT.title);
    }
    if (type === "chapterCard") cut("promise", TEXT.promise);
    if (type === "headlineCard") {
      cut("deck", TEXT.deck);
      if (String(p.headline || "").length > 90) {
        const before = p.headline;
        p.headline = shortenChars(p.headline, 90);
        syncHighlight(p, "headline");
        out.push(`${sc.id}.${key}: headline cut to ${p.headline.length} characters (was ${before.length})`);
      }
    }
    if (MAP_TYPES.has(type)) {
      [].concat(p.pins || [], p.arrows || []).forEach((x) => {
        if (x && String(x.label || "").length > MAP_LABEL) {
          const before = x.label;
          x.label = shortenChars(x.label, MAP_LABEL);
          out.push(`${sc.id}.${key}: map label "${before}" -> "${x.label}"`);
        }
      });
    }
  });
  // map labels on pin / arrow events
  const types = Object.fromEntries(fills(sb).map(({ sc, key, fill }) => [fill.id, typeOf(sc, key, fill)]));
  (sb.events || []).forEach((e) => {
    if ((e.op === "pin" || e.op === "arrow") && MAP_TYPES.has(types[modOf(e.target)]) && e.value && String(e.value.label || "").length > MAP_LABEL) {
      const before = e.value.label;
      e.value.label = shortenChars(e.value.label, MAP_LABEL);
      out.push(`${e.op} on ${e.target}: label "${before}" -> "${e.value.label}"`);
    }
  });
  // layout audit: text that runs out of its card / the frame / is clipped (measured in the real DOM)
  (opts.layout || []).forEach((lp) => {
    if (!/^text-(off-frame|outside-card|clipped)$/.test(lp.kind)) return;
    const id = String(lp.module || "").split(":")[0];
    const hit = fills(sb).find(({ fill }) => fill.id === id);
    if (!hit || !hit.fill.props) return;
    const p = hit.fill.props;
    const probe = String(lp.text || "").slice(0, 30);
    const field = Object.keys(p).find((k) => typeof p[k] === "string" && probe && p[k].startsWith(probe.slice(0, Math.min(probe.length, 12))));
    if (!field) return;
    const type = typeOf(hit.sc, hit.key, hit.fill);
    if (type === "lfText" && field === "title" && (Number(p.size) || 72) > 48) {
      const before = Number(p.size) || 72;
      p.size = Math.max(48, Math.round(before * 0.85));
      if (!p.maxLines) p.maxLines = 2;
      out.push(`${hit.sc.id}.${hit.key}: title size ${before} -> ${p.size} (2 lines) so "${probe}" fits`);
      return;
    }
    const len = String(p[field]).length;
    const over = Number(lp.over) || (lp.rect ? Math.max(0, lp.rect[2] - 1920, -lp.rect[0]) : 60);
    const max = Math.max(4, len - Math.ceil(over / 13) - 2);
    const before = p[field];
    p[field] = shortenChars(p[field], max);
    if (p[field] !== before) {
      syncHighlight(p, field);
      out.push(`${hit.sc.id}.${hit.key}: ${field} "${before}" -> "${p[field]}" (overflowed ${over} px)`);
    }
  });
  return out;
}

/** composition / overlap: rails, title + headline, transitions, colliding overlays */
function fixComposition(sb, ctx, problems, opts = {}) {
  const out = [];
  (sb.scaffolds || []).forEach((sc) => {
    const s = sc.slots || {};
    if (s.stack || s.side) {
      const moved = [].concat(s.stack || [], s.side || []);
      delete s.stack;
      delete s.side;
      s.right = [].concat(s.right || [], moved);
      out.push(`${sc.id}: side column moved into the rails`);
    }
    const L = [].concat(s.left || []);
    const R = [].concat(s.right || []);
    if (L.length > 2 || R.length > 2 || Math.abs(L.length - R.length) > 1) {
      const pool = L.concat(R);
      const dropped = pool.splice(4);
      removeModules(sb, dropped.map((f) => f && f.id));
      const nl = Math.ceil(pool.length / 2);
      s.left = pool.slice(0, nl);
      s.right = pool.slice(nl);
      if (!s.left.length) delete s.left;
      if (!s.right.length) delete s.right;
      out.push(`${sc.id}: satellites rebalanced (left ${L.length}, right ${R.length} -> ${[].concat(s.left || []).length}/${[].concat(s.right || []).length}${dropped.length ? `, dropped ${dropped.map((f) => f.id).join(", ")}` : ""})`);
    }
    if (s.title && s.headline && sc.template === "lfStage") {
      removeModules(sb, [s.headline.id]);
      delete s.headline;
      out.push(`${sc.id}: dropped the lower-third headline (a top-centre title is already there)`);
    }
  });
  let last = -9;
  (sb.scaffolds || []).forEach((sc, i) => {
    if (!sc.transition) return;
    if (i - last < 2) {
      delete sc.transition;
      out.push(`${sc.id}: second push transition in a row -> hard cut`);
      return;
    }
    last = i;
  });
  // overlays colliding in the layout audit: move the second one down (or up) by 18 % of the frame
  (opts.layout || []).filter((lp) => lp.kind === "card-overlap").forEach((lp) => {
    const ids = (lp.modules || []).map((m) => String(m).split(":")[0]);
    const ov = fills(sb).filter(({ key, fill }) => key === "overlays" && ids.includes(fill.id) && Array.isArray(fill.at));
    const f = ov[ov.length - 1];
    if (!f) return;
    const [x, y] = f.fill.at;
    const ny = y <= 50 ? Math.min(88, y + 18) : Math.max(8, y - 18);
    f.fill.at = [x, ny];
    if (Array.isArray(f.fill.point)) f.fill.point = [f.fill.point[0], Math.max(4, Math.min(96, f.fill.point[1] + (ny - y)))];
    out.push(`${f.sc.id}: overlay ${f.fill.id} nudged from y ${y}% to ${ny}% (overlapped ${ids.filter((i) => i !== f.fill.id).join(", ")})`);
  });
  return out;
}

/** vector maps and photo zooms: duplicate / excess pins and arrows, one zoomTo per scene, camera settle time, zoom labels */
function fixMapsAndZooms(sb, ctx, problems) {
  const out = [];
  const byId = {};
  fills(sb).forEach(({ sc, key, fill }) => fill.id && (byId[fill.id] = { sc, key, fill, type: typeOf(sc, key, fill) }));
  const where = sentenceScaffold(sb);
  const drop = new Set();
  Object.values(byId).filter((m) => MAP_TYPES.has(m.type)).forEach((m) => {
    const p = m.fill.props || {};
    const evs = (sb.events || []).map((e, i) => ({ e, i })).filter(({ e }) => modOf(e.target) === m.fill.id);
    const spot = (x) => JSON.stringify(x && (x.city ? String(x.city).toLowerCase() : x.lonlat || x.iso || x.at || null));
    const seen = new Set((p.pins || []).map(spot));
    evs.filter(({ e }) => e.op === "pin").forEach(({ e, i }) => {
      const k = spot(e.value || {});
      if (seen.has(k)) {
        drop.add(i);
        out.push(`map ${m.fill.id}: dropped a second pin on ${k}`);
      } else seen.add(k);
    });
    const cap = (op, list, max) => {
      const live = evs.filter(({ e, i }) => e.op === op && !drop.has(i));
      let n = list.length + live.length;
      for (let k = live.length - 1; k >= 0 && n > max; k--, n--) {
        drop.add(live[k].i);
        out.push(`map ${m.fill.id}: dropped ${op} "${(live[k].e.value || {}).label || live[k].e.anchor && live[k].e.anchor.text}" (max ${max})`);
      }
    };
    cap("pin", p.pins || [], 4);
    cap("arrow", p.arrows || [], 3);
  });
  // one zoomTo per module per scene
  const zoomSeen = new Set();
  (sb.events || []).forEach((e, i) => {
    if (e.op !== "zoomTo" || drop.has(i)) return;
    const m = byId[modOf(e.target)];
    if (!m || !MAP_TYPES.has(m.type)) return;
    const k = `${modOf(e.target)}|${where[e.sentence]}`;
    if (zoomSeen.has(k)) {
      drop.add(i);
      out.push(`map ${modOf(e.target)}: dropped a second zoomTo in scene ${where[e.sentence]}`);
    } else zoomSeen.add(k);
  });
  if (drop.size) sb.events = sb.events.filter((_, i) => !drop.has(i));
  // timing fixes need the compiled times (event i of the spec = event i of the storyboard)
  const c = compiled(sb);
  if (!c) return out;
  const { spec, tl } = c;
  const t = (i) => spec.events[i] && spec.events[i].t;
  const moved = new Set();
  sb.events.forEach((z, zi) => {
    if (z.op !== "zoomTo" || !MAP_TYPES.has((byId[modOf(z.target)] || {}).type)) return;
    sb.events.forEach((e, i) => {
      if (i === zi || moved.has(i) || modOf(e.target) !== modOf(z.target) || !(t(i) >= t(zi)) || t(i) - t(zi) >= 1.4) return;
      const sid = where[e.sentence];
      const w = tl.words.find((x) => x.start >= t(zi) + 1.5 && where[x.sentenceId] === sid);
      if (w) {
        e.sentence = w.sentenceId;
        e.anchor = anchorFor(sb, w);
        out.push(`map ${modOf(z.target)}: ${e.op} moved to "${w.text}" (${(w.start - t(zi)).toFixed(1)} s after the zoom)`);
      } else {
        e._drop = true;
        out.push(`map ${modOf(z.target)}: dropped ${e.op} ${(e.value || {}).label || ""} (no word >= 1.4 s after the zoom in this scene)`);
      }
      moved.add(i);
    });
  });
  sb.events = sb.events.filter((e) => !e._drop);
  // a highlight label on a photo that a later zoomTo pushes off the picture: end the highlight before the zoom
  if (problems.some((p) => /pushes the highlight label/.test(p))) {
    const c2 = compiled(sb);
    if (c2) {
      sb.events.forEach((z, zi) => {
        if (z.op !== "zoomTo" || (byId[modOf(z.target)] || {}).type !== "photo") return;
        sb.events.forEach((h, hi) => {
          if (h.op !== "highlight" || modOf(h.target) !== modOf(z.target) || !h.value || !h.value.label || h.value.hold) return;
          const th = c2.spec.events[hi].t;
          const tz = c2.spec.events[zi].t;
          if (!(th < tz) || where[h.sentence] !== where[z.sentence]) return;
          h.value.hold = Math.max(0.6, Math.round((tz - th - 0.2) * 10) / 10);
          out.push(`photo ${modOf(z.target)}: highlight "${h.value.label}" held ${h.value.hold} s so it ends before the zoom`);
        });
      });
    }
  }
  return out;
}

/** beats per minute: merge (drop secondary events in the densest spots) or split (add beats in the widest gaps) */
function fixCadence(sb, ctx, problems, opts = {}) {
  const out = [];
  const band = opts.band || [20, 37];
  // the LF mix check ("... is at the top", "only N ...") and the shared validator ("N visual beats/min on the
  // synthetic LF timeline (target 18-40)")
  const base = problems.map((p) => p.match(/^([\d.]+) visual beats\/min on the synthetic LF timeline \(target (\d+)-(\d+)\)/)).filter(Boolean);
  const high = problems.some((p) => /visual beats\/min is at the top/.test(p)) || base.some((m) => Number(m[1]) > Number(m[3]));
  const low = problems.some((p) => /^only [\d.]+ visual beats\/min/.test(p)) || base.some((m) => Number(m[1]) < Number(m[2]));
  // a hold the validator's single fillHolds pass left (an 11 s gap splits into two 5.5 s ones): fill again
  if (problems.some((p) => /^no visual change for|^a hold (of|without)/.test(p))) {
    const { fillHolds } = require("./storyboardLF");
    const n = fillHolds(sb);
    if (n) out.push(`added ${n} emphasis beat(s) in long holds`);
  }
  if (!high && !low) return out;
  const c = compiled(sb);
  if (!c) return out;
  const { spec, tl } = c;
  const total = tl.totalSeconds;
  const beatTimes = () => {
    const cc = compiled(sb);
    if (!cc) return null;
    const ts = [];
    cc.spec.scaffolds.forEach((s) => {
      ts.push(s.t0);
      s.modules.forEach((m) => {
        if (m.at) ts.push(s.t0 + m.at);
        ((m.props && m.props.lineAt) || []).forEach((la) => la > 0 && ts.push(s.t0 + (m.at || 0) + la));
      });
    });
    cc.spec.events.forEach((e) => ts.push(e.t));
    return { cc, set: new Set(ts.map((x) => Math.round(x * 100) / 100)) };
  };
  if (high) {
    const target = Math.floor(((band[1] - 1) * total) / 60);
    const SECONDARY = { dim: 0, undim: 0, tone: 1, unhighlight: 1, highlight: 2, reveal: 3 };
    let b = beatTimes();
    let guard = 0;
    while (b && b.set.size > target && guard++ < 60) {
      const times = [...b.set].sort((x, y) => x - y);
      const gap = (tt) => {
        const i = times.indexOf(Math.round(tt * 100) / 100);
        return Math.min(i > 0 ? times[i] - times[i - 1] : 99, i < times.length - 1 ? times[i + 1] - times[i] : 99);
      };
      const shared = (i) => b.cc.spec.events.some((e, j) => j !== i && Math.round(e.t * 100) === Math.round(b.cc.spec.events[i].t * 100));
      const cand = sb.events
        .map((e, i) => ({ e, i, t: b.cc.spec.events[i].t }))
        .filter(({ e, i }) => SECONDARY[e.op] !== undefined && !shared(i))
        .sort((x, y) => SECONDARY[x.e.op] - SECONDARY[y.e.op] || gap(x.t) - gap(y.t));
      if (!cand.length) break;
      const { e, i } = cand[0];
      sb.events.splice(i, 1);
      out.push(`dropped ${e.op} on ${e.target} at "${e.anchor && e.anchor.text}" (densest spot; beats/min over the band)`);
      b = beatTimes();
    }
  }
  if (low) {
    const target = Math.ceil(((band[0] + 1) * total) / 60);
    const { fillHolds } = require("./storyboardLF");
    let b = beatTimes();
    for (let gap = 4.5; b && b.set.size < target && gap >= 1.5; gap -= 0.5) {
      const n = fillHolds(sb, { minGap: gap, max: target - b.set.size });
      if (n) out.push(`added ${n} emphasis beat(s) in gaps over ${gap} s (beats/min under the band)`);
      b = beatTimes();
    }
  }
  void spec;
  return out;
}

/** variety: the planned hero type when the content fits; a scaffold one sentence off its planned start */
function fixVariety(sb, ctx, problems) {
  const out = [];
  const plan = ctx && ctx.plan;
  if (!Array.isArray(plan) || !plan.length) return out;
  const { sceneKind } = require("./storyboardLF");
  const ids = (sb.sentences || []).map((s) => s.id);
  const starts = new Set(plan.map((p) => p.from));
  // scaffolds off the plan: move one onto a planned start that no scaffold covers, when it stays in order
  const covered = new Set((sb.scaffolds || []).map((sc) => sc.from));
  const missing = plan.filter((p) => !covered.has(p.from));
  (sb.scaffolds || []).forEach((sc, k) => {
    if (starts.has(sc.from)) return;
    const at = ids.indexOf(sc.from);
    const lo = k > 0 ? ids.indexOf(sb.scaffolds[k - 1].from) : -1;
    const hi = k + 1 < sb.scaffolds.length ? ids.indexOf(sb.scaffolds[k + 1].from) : ids.length;
    const pick = missing.map((p) => ({ p, d: Math.abs(ids.indexOf(p.from) - at) })).filter(({ p }) => ids.indexOf(p.from) > lo && ids.indexOf(p.from) < hi && !covered.has(p.from)).sort((a, b) => a.d - b.d)[0];
    if (!pick || pick.d > 2) return;
    const to = pick.p.from;
    const toAt = ids.indexOf(to);
    // moving later: events on the sentences the scaffold no longer spans move to the new first sentence
    if (toAt > at) {
      const mods = new Set(fills({ scaffolds: [sc] }).map(({ fill }) => fill.id));
      const firstWord = String((sb.sentences[toAt] || {}).text || "").split(/\s+/)[0];
      (sb.events || []).forEach((e) => {
        const ei = ids.indexOf(e.sentence);
        if (ei >= at && ei < toAt && mods.has(modOf(e.target))) {
          e.sentence = to;
          e.anchor = { text: firstWord, occurrence: 1 };
        }
      });
    }
    out.push(`scaffold ${sc.id}: start moved ${sc.from} -> ${to} (the planned scene start)`);
    covered.delete(sc.from);
    covered.add(to);
    sc.from = to;
  });
  // hero type swaps within one template
  const byFrom = new Map((sb.scaffolds || []).map((sc) => [sc.from, sc]));
  plan.forEach((ps) => {
    const sc = byFrom.get(ps.from);
    if (!sc) return;
    const got = sceneKind(sc);
    if (got === ps.kind) return;
    const s = sc.slots || {};
    if (sc.template === "lfChart" && s.chart && ["barChart", "lineChart"].includes(ps.kind) && ["barChart", "lineChart"].includes(got)) {
      const p = s.chart.props || {};
      if (ps.kind === "lineChart" && Array.isArray(p.bars) && !p.series) {
        if (!p.bars.every((b) => /^(1[89]|20)\d\d$/.test(String(b.label)))) return; // a line needs a time axis
        p.points = p.bars.map((b) => ({ x: Number(b.label), y: Number(b.value) }));
        delete p.bars;
      } else if (ps.kind === "barChart" && Array.isArray(p.points) && !p.series) {
        if (p.points.length > 8) return;
        p.bars = p.points.map((q) => ({ label: String(q.x), value: Number(q.y) }));
        delete p.points;
      }
      s.chart.type = ps.kind;
      out.push(`scaffold ${sc.id}: chart ${got} -> ${ps.kind} (the planned type)`);
    } else if (sc.template === "lfMap" && s.map && MAP_TYPES.has(ps.kind) && MAP_TYPES.has(got)) {
      const p = (s.map.props = s.map.props || {});
      if (ps.kind === "countryMap" && !(Array.isArray(p.focus) && p.focus.length)) {
        const isos = [...new Set([].concat((p.highlight || []).map((h) => h && h.iso), (sb.events || []).filter((e) => modOf(e.target) === s.map.id && e.value && e.value.iso).map((e) => e.value.iso)).filter((x) => /^[A-Z]{3}$/.test(String(x))))].slice(0, 4);
        if (!isos.length) return;
        p.focus = isos;
      }
      if (ps.kind === "countryMap" && p.choropleth) return; // a choropleth is world-only
      s.map.type = ps.kind;
      out.push(`scaffold ${sc.id}: map ${got} -> ${ps.kind} (the planned type)`);
    }
  });
  return out;
}

const SCALE = [
  [1e12, "trillion"],
  [1e9, "billion"],
  [1e6, "million"],
];
const SCALE_IN = [
  [1e7, "crore"],
  [1e5, "lakh"],
];
const compact = (n) => {
  const a = Math.abs(n);
  const [d, s] = a >= 1e12 ? [1e12, "T"] : a >= 1e9 ? [1e9, "B"] : a >= 1e6 ? [1e6, "M"] : [1, ""];
  return `${Math.round((n / d) * 10) / 10}${s}`;
};

/** number formatting: parse string figures, scale huge raw values, round long decimals, compact digit runs */
function fixNumbers(sb) {
  const out = [];
  const parse = (v) => {
    if (typeof v === "number") return { n: v };
    const s = String(v || "").trim();
    const m = s.match(/^([^\d\-.]*)(-?[\d,]*\.?\d+)\s*(%|[a-zA-Z]+)?\s*$/);
    if (!m) return null;
    return { prefix: m[1].trim(), n: Number(m[2].replace(/,/g, "")), unit: m[3] || "" };
  };
  fills(sb).forEach(({ sc, key, fill }) => {
    const p = fill.props;
    if (!p) return;
    const type = typeOf(sc, key, fill);
    if (type === "bigNumber" && p.value !== undefined) {
      if (typeof p.value !== "number") {
        const r = parse(p.value);
        if (r && Number.isFinite(r.n)) {
          const before = p.value;
          p.value = r.n;
          if (r.prefix && !p.prefix) p.prefix = r.prefix;
          if (r.unit === "%" && !p.suffix) p.suffix = "%";
          else if (r.unit && !p.unit) p.unit = r.unit;
          out.push(`${sc.id}.${key}: value "${before}" -> ${p.value}`);
        }
      }
      const v = Number(p.value);
      if (Number.isFinite(v) && Math.abs(v) >= 1e6 && !p.unit) {
        const table = /₹|rs\.?/i.test(String(p.prefix || "")) ? SCALE_IN : SCALE;
        const [d, name] = table.find(([dd]) => Math.abs(v) >= dd) || [];
        if (d) {
          p.value = Math.round((v / d) * 100) / 100;
          p.unit = name;
          out.push(`${sc.id}.${key}: ${v} shown as ${p.value} ${name}`);
        }
      }
      if (Number.isFinite(Number(p.value)) && !Number.isInteger(Number(p.value))) {
        const dec = (String(p.value).split(".")[1] || "").length;
        if (dec > 2) {
          const before = p.value;
          p.value = Math.round(Number(p.value) * 100) / 100;
          out.push(`${sc.id}.${key}: ${before} rounded to ${p.value}`);
        }
      }
    }
    if (type === "barChart" && Array.isArray(p.bars))
      p.bars.forEach((b, i) => {
        if (b && typeof b.value === "string") {
          const r = parse(b.value);
          if (r && Number.isFinite(r.n)) {
            out.push(`${sc.id}.${key}: bar ${i + 1} value "${b.value}" -> ${r.n}`);
            b.value = r.n;
          }
        }
      });
    if (type === "lineChart" && Array.isArray(p.points))
      p.points.forEach((q, i) => {
        if (q && typeof q.y === "string") {
          const r = parse(q.y);
          if (r && Number.isFinite(r.n)) {
            out.push(`${sc.id}.${key}: point ${i + 1} y "${q.y}" -> ${r.n}`);
            q.y = r.n;
          }
        }
      });
    // long raw digit runs in short labels: 1500000000 -> 1.5B
    ["text", "value", "title", "label"].forEach((f) => {
      if (type === "bigNumber" && f === "value") return;
      if (typeof p[f] !== "string") return;
      const next = p[f].replace(/(?<![\d.,])\d{1,3}(?:,\d{3}){2,}(?![\d,])|(?<![\d.,])\d{7,}(?![\d,])/g, (m) => compact(Number(m.replace(/,/g, ""))));
      if (next !== p[f]) {
        out.push(`${sc.id}.${key}: ${f} "${p[f]}" -> "${next}"`);
        p[f] = next;
      }
    });
  });
  return out;
}

/** small rule fixes: unused intents, count "op", text highlights without a phrase, unannotated photos */
function fixMisc(sb, ctx, problems) {
  const out = [];
  const { referencedSlots } = require("./storyboardLF");
  const used = referencedSlots(sb);
  const before = (sb.mediaIntents || []).length;
  sb.mediaIntents = (sb.mediaIntents || []).filter((it) => it && used.has(it.slot));
  if (sb.mediaIntents.length < before) out.push(`dropped ${before - sb.mediaIntents.length} unused media intent(s)`);
  const byId = {};
  fills(sb).forEach(({ sc, key, fill }) => fill.id && (byId[fill.id] = { sc, key, fill, type: typeOf(sc, key, fill) }));
  // count "op" that shows 0 too long: count on entrance
  problems.filter((p) => /^bigNumber (\S+) \(count "op"\)/.test(p)).forEach((p) => {
    const id = p.match(/^bigNumber (\S+) /)[1];
    const m = byId[id];
    if (m && m.fill.props && m.fill.props.count === "op") {
      m.fill.props.count = "enter";
      out.push(`bigNumber ${id}: count "op" -> "enter"`);
    }
  });
  // a marker highlight on text needs the phrase it sweeps
  (sb.events || []).forEach((e) => {
    const m = byId[modOf(e.target)];
    if (e.op !== "highlight" || !m || !["lfText", "headlineCard"].includes(m.type)) return;
    const p = (m.fill.props = m.fill.props || {});
    if (p.highlight || (e.value && e.value.phrase)) return;
    const field = m.type === "headlineCard" ? "headline" : "title";
    const tw = words(p[field]);
    if (!tw.length) return;
    const aw = norm((e.anchor && e.anchor.text) || "");
    const i = tw.findIndex((w) => norm(w) === aw);
    p.highlight = i >= 0 ? tw.slice(i, i + 2).join(" ").replace(/[,.;:!?]+$/, "") : tw.slice(0, Math.min(2, tw.length)).join(" ").replace(/[,.;:!?]+$/, "");
    out.push(`${m.fill.id}: highlight phrase "${p.highlight}" from its ${field}`);
  });
  // a photo without any annotation: one highlight on a word of its scene (after its entrance)
  const unannotated = problems.map((p) => p.match(/^photo (\S+)\/(\S+) has no annotation/)).filter(Boolean);
  if (unannotated.length) {
    const c = compiled(sb);
    if (c) {
      unannotated.forEach(([, scId, modId]) => {
        const s = c.spec.scaffolds.find((x) => x.id === scId);
        const mod = s && s.modules.find((x) => x.id === modId);
        if (!s || !mod) return;
        const enter = s.t0 + (mod.at || 0);
        const inScene = c.tl.words.filter((w) => w.start >= enter + 0.4 && w.start < s.t1 - 0.3);
        const w = inScene[Math.floor(inScene.length / 2)];
        if (!w) return;
        sb.events.push({ sentence: w.sentenceId, anchor: anchorFor(sb, w), op: "highlight", target: modId, value: { box: [24, 26, 52, 48] } });
        out.push(`photo ${scId}/${modId}: highlight added on "${w.text}"`);
      });
    }
  }
  return out;
}

const FIXERS = [
  { name: "misc", fn: fixMisc },
  { name: "numbers", fn: fixNumbers },
  { name: "text", fn: fixText },
  { name: "composition", fn: fixComposition },
  { name: "maps", fn: fixMapsAndZooms },
  { name: "variety", fn: fixVariety },
  { name: "cadence", fn: fixCadence },
];

/**
 * Run the fixers on `sb` in place. Returns the fix descriptions (empty when nothing applied).
 * @param {object} sb
 * @param {object} ctx  the chapter context (plan for the variety fixer)
 * @param {string[]} problems  the current validation problems
 * @param {{layout?: object[], only?: string[], band?: [number, number]}} opts
 */
function autoFix(sb, ctx, problems, opts = {}) {
  const out = [];
  sb.events = sb.events || [];
  FIXERS.filter((f) => !opts.only || opts.only.includes(f.name)).forEach((f) => {
    try {
      out.push(...f.fn(sb, ctx, problems || [], opts).map((x) => `${f.name}: ${x}`));
    } catch (err) {
      out.push(`${f.name}: skipped (${err.message})`);
    }
  });
  return out.filter((x) => !/: skipped \(/.test(x) || opts.debug);
}

/** is validation `b` an improvement over `a` (fewer problems, or it got past the pre-checks to the mix report)? */
function better(b, a) {
  if (!b.problems.length) return true;
  if (!a.report && b.report) return true;
  if (a.report && !b.report) return false;
  return b.problems.length < a.problems.length;
}

/**
 * Deterministic fixes before any model repair: all fixers at once, kept when re-validation improves; else each
 * fixer alone (the helpful ones are kept). Up to `rounds` rounds.
 * @param {object} sb  storyboard (not mutated; the result carries the fixed copy)
 * @param {object} ctx
 * @param {{problems: string[], report: object, layout?: object[]}} v  its current validation
 * @param {(sb) => Promise<{problems, report, layout?}>} validate
 * @returns {Promise<{storyboard, validation, fixes: string[]}>}
 */
async function applyAutoFixes(sb, ctx, v, validate, opts = {}) {
  let cur = sb;
  let cv = v;
  const fixes = [];
  for (let round = 0; round < (opts.rounds || 3) && cv.problems.length; round++) {
    const cand = clone(cur);
    const f = autoFix(cand, ctx, cv.problems, { layout: cv.layout, band: opts.band });
    if (!f.length) break;
    const nv = await validate(cand);
    if (better(nv, cv)) {
      cur = cand;
      cv = nv;
      fixes.push(...f);
      continue;
    }
    // together they made it worse: keep the fixers that help on their own
    let progressed = false;
    for (const fx of FIXERS) {
      const one = clone(cur);
      const f1 = autoFix(one, ctx, cv.problems, { layout: cv.layout, band: opts.band, only: [fx.name] });
      if (!f1.length) continue;
      const v1 = await validate(one);
      if (better(v1, cv)) {
        cur = one;
        cv = v1;
        fixes.push(...f1);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return { storyboard: cur, validation: cv, fixes };
}

module.exports = { autoFix, applyAutoFixes, better, shortenWords, shortenChars, abbreviate, syncHighlight, fixText, fixComposition, fixMapsAndZooms, fixCadence, fixVariety, fixNumbers, fixMisc, FIXERS, fills, typeOf, sentenceScaffold, compact };
