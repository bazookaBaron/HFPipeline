"use strict";

/**
 * Compile-time pass for the LF set-2 modules (video-engine/.../stage/modules-lf2.js), run after data-series
 * refs and maps are resolved:
 *   - barRace: a resolved map series ({values: {ISO3: v}, year}) becomes one frame of the top N countries by
 *     name (+ the highlighted country even when it ranks lower); resolved time series ({series: [{name,
 *     points}]}) become one frame per year. `highlight` may be an ISO3 code.
 *   - word-driven modules: when events drive a module (lfYearTimeline go, flowDiagram flow, pictogramGrid fill,
 *     barRace step, documentStamp stamp, flashBurst burst, photoStack show, quoteCard highlight), its
 *     automatic entrance sequence is switched off (props.auto = false) so the beats land on the words.
 */

const { load } = require("./geo");

const DRIVERS = {
  lfYearTimeline: ["go"],
  flowDiagram: ["flow"],
  pictogramGrid: ["fill"],
  barRace: ["step"],
  documentStamp: ["stamp"],
  flashBurst: ["burst"],
  photoStack: ["show"],
  quoteCard: ["highlight"],
};

function countryName(iso) {
  const k = String(iso || "").toUpperCase();
  const c = load("50m").countries[k] || load("110m").countries[k];
  return c ? c.n : null;
}

function raceFrames(p, where) {
  const top = Math.max(3, Math.min(10, Number(p.top) || 8));
  if (Array.isArray(p.frames) && p.frames.length) return { frames: p.frames, highlight: p.highlight };
  let hl = p.highlight;
  if (hl && /^[A-Z]{3}$/i.test(String(hl)) && countryName(hl)) hl = countryName(hl);
  if (p.values && typeof p.values === "object") {
    const all = Object.entries(p.values)
      .filter(([, v]) => Number.isFinite(Number(v)))
      .map(([iso, v]) => ({ iso: iso.toUpperCase(), name: countryName(iso) || iso.toUpperCase(), value: Number(v) }))
      .sort((a, b) => b.value - a.value);
    if (!all.length) throw new Error(`${where}: barRace series has no values`);
    let bars = all.slice(0, top);
    const want = p.highlight ? all.find((x) => x.iso === String(p.highlight).toUpperCase() || x.name === hl) : null;
    if (want && !bars.includes(want)) bars = bars.slice(0, top - 1).concat(want);
    return { frames: [{ label: String(p.year || ""), bars: bars.map((b) => ({ name: b.name, value: b.value })) }], highlight: hl };
  }
  if (Array.isArray(p.series) && p.series.length && p.series.every((s) => s && Array.isArray(s.points))) {
    const years = [...new Set(p.series.flatMap((s) => s.points.map((pt) => pt.x)))].sort((a, b) => a - b);
    const frames = years
      .map((yr) => ({
        label: String(yr),
        bars: p.series
          .map((s) => {
            const pt = s.points.find((q) => q.x === yr);
            return pt ? { name: s.name, value: pt.y } : null;
          })
          .filter(Boolean),
      }))
      .filter((f) => f.bars.length >= 2);
    // at most ~12 frames: keep an even sample incl. the first and last year
    const keep = frames.length <= 12 ? frames : frames.filter((_, i) => i % Math.ceil(frames.length / 12) === 0 || i === frames.length - 1);
    return { frames: keep, highlight: hl };
  }
  throw new Error(`${where}: barRace needs frames, a map series {series: "S#"} or several time series {series: ["S1","S2",...]}`);
}

function resolveLF2(scaffolds, events) {
  const driven = new Set();
  (events || []).forEach((e) => driven.add(`${String(e.target || "").split(".")[0]}|${e.op}`));
  const done = new Set();
  scaffolds.forEach((s) =>
    s.modules.forEach((m) => {
      if (done.has(m.props)) return;
      if (m.type === "barRace") {
        const r = raceFrames(m.props || {}, `scaffold ${s.id} module ${m.id}`);
        m.props = { ...m.props, frames: r.frames, highlight: r.highlight };
        delete m.props.values;
        delete m.props.series;
      }
      const ops = DRIVERS[m.type];
      if (ops && ops.some((op) => driven.has(`${m.id}|${op}`)) && m.props.auto === undefined) m.props = { ...m.props, auto: false };
      done.add(m.props);
    })
  );
}

// ------------------------------------------------------------------------------------ prop schemas
const LINE_ICONS = ["bank", "govt", "people", "person", "factory", "globe", "coin", "card", "ship", "oil", "house", "chart", "doc", "plane", "wheat", "lock", "scale"];
const SOLID_ICONS = ["person", "coin", "house", "barrel", "car", "job", "wheat"];
const wc = (t) => String(t || "").split(/\s+/).filter(Boolean).length;
const norm = (t) => String(t || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const hasSlot = (x) => x && typeof x === "object" && typeof x.slot === "string" && x.slot.length > 0;

/** authoring checks for the set-2 modules (+ routeMap): [problem strings], empty when fine */
function lf2Problems(type, p, where) {
  const P = [];
  p = p || {};
  const need = (cond, msg) => !cond && P.push(`${where}: ${type} ${msg}`);
  switch (type) {
    case "quoteCard":
      need(typeof p.quote === "string" && wc(p.quote) >= 3 && wc(p.quote) <= 30, "needs quote (3-30 words, verbatim)");
      need(!!String(p.source || "").trim(), "needs source (who said it)");
      [].concat(p.highlight || []).forEach((h) => need(norm(p.quote).includes(norm(h)), `highlight "${h}" is not in the quote (copy it verbatim)`));
      break;
    case "lfYearTimeline": {
      const it = p.items || [];
      need(Array.isArray(it) && it.length >= 2 && it.length <= 8, "needs 2-8 items");
      it.forEach((x, i) => {
        need(Number.isFinite(Number(x && x.year)), `item ${i + 1} needs a numeric year`);
        need(String((x && x.label) || "").length > 0 && String(x.label).length <= 34, `item ${i + 1} label must be 1-34 characters`);
      });
      break;
    }
    case "flowDiagram": {
      const nodes = p.nodes || [];
      const ids = new Set(nodes.map((n) => n && n.id));
      need(nodes.length >= 2 && nodes.length <= 5, "needs 2-5 nodes");
      need(ids.size === nodes.length, "node ids must be unique");
      nodes.forEach((n, i) => {
        need(String((n && n.label) || "").length <= 18, `node ${i + 1} label is longer than 18 characters`);
        need(!n || !n.icon || LINE_ICONS.includes(n.icon), `node ${i + 1} icon must be one of ${LINE_ICONS.join("|")}`);
      });
      const fl = p.flows || [];
      need(fl.length >= 1 && fl.length <= 6, "needs 1-6 flows");
      fl.forEach((f, i) => need(f && ids.has(f.from) && ids.has(f.to) && f.from !== f.to, `flow ${i + 1} must join two different known node ids`));
      break;
    }
    case "pictogramGrid": {
      const total = Number(p.total === undefined ? 100 : p.total);
      need(Number.isFinite(total) && total >= 4 && total <= 100, "total must be 4-100");
      need(Number.isFinite(Number(p.filled)) && Number(p.filled) >= 0 && Number(p.filled) <= total, "filled must be 0..total");
      need(!p.icon || SOLID_ICONS.includes(p.icon), `icon must be one of ${SOLID_ICONS.join("|")}`);
      need(wc(p.label) >= 1 && wc(p.label) <= 8, "needs a label (1-8 words)");
      break;
    }
    case "barRace":
      need((Array.isArray(p.frames) && p.frames.length) || p.series || p.values, "needs frames or a data series ref");
      need(p.top === undefined || (Number(p.top) >= 3 && Number(p.top) <= 10), "top must be 3-10");
      break;
    case "splitScreen":
      need(hasSlot(p.left) && hasSlot(p.right), "needs left and right {slot, label}");
      [p.left, p.right].forEach((x, i) => x && need(wc(x.label) <= 4, `${i ? "right" : "left"} label is longer than 4 words`));
      break;
    case "photoStack":
      need(Array.isArray(p.items) && p.items.length >= 2 && p.items.length <= 3 && p.items.every(hasSlot), "needs 2-3 items with a slot");
      break;
    case "documentStamp":
      need(String(p.stamp || "").length >= 2 && String(p.stamp).length <= 12, "stamp must be 2-12 characters");
      need(!!String(p.title || "").trim(), "needs a title (the issuer)");
      need(!p.lines || (Array.isArray(p.lines) && p.lines.length <= 6), "takes at most 6 lines");
      break;
    case "flashBurst":
      need(Array.isArray(p.items) && p.items.length >= 3 && p.items.length <= 10 && p.items.every(hasSlot), "needs 3-10 items with a slot");
      need(!p.kicker || wc(p.kicker) <= 3, "kicker is at most 3 words");
      break;
    case "routeMap":
      need(Array.isArray(p.stops) && p.stops.length >= 2 && p.stops.length <= 5, "needs 2-5 stops");
      break;
    default:
  }
  return P;
}

/**
 * documentStamp honesty (the page is always an ILLUSTRATION): generic wording only. Any figure (digits) and any
 * official-sounding title / reference (ministry, decree, law no., court, central bank ...) must appear VERBATIM
 * in the dossier (claims, sources, timeline) -- never an invented decree number or letterhead.
 * dossierText = everything the research verified, as one string.
 */
const OFFICIAL = /\b(ministry|ministerio|minister|decree|decreto|resolution|resoluci[oó]n|law\s+no|ley\s+n|gazette|bolet[ií]n|department|treasury|court|tribunal|central\s+bank|banco\s+central|republic|rep[uú]blica|official)\b/i;
function docStampProblems(p, dossierText, where) {
  const P = [];
  const hay = String(dossierText || "").toLowerCase();
  const inDossier = (x) => hay.includes(String(x).toLowerCase().trim());
  const fields = [["title", p.title], ["ref", p.ref], ["date", p.date], ...((p.lines || []).map((l, i) => [`lines[${i}]`, l]))];
  fields.forEach(([k, v]) => {
    if (!v) return;
    const s = String(v);
    (s.match(/\d[\d,./-]*\d|\d/g) || []).forEach((num) => {
      const bare = num.replace(/[,./-]/g, "");
      if (!inDossier(num) && !(bare.length === 4 && inDossier(bare))) P.push(`${where}: documentStamp ${k} "${s.slice(0, 50)}" shows ${num}, which is not in the dossier; keep document text generic (no invented numbers)`);
    });
    if ((k === "title" || k === "ref") && OFFICIAL.test(s) && !inDossier(s)) P.push(`${where}: documentStamp ${k} "${s.slice(0, 50)}" reads like a real official letterhead / reference but is not in the dossier verbatim; use generic wording (e.g. "Debt notice") -- the page is an illustration`);
  });
  return P;
}
function dossierText(dossier) {
  const d = dossier || {};
  return [].concat((d.facts || []).map((f) => `${f.claim || ""} ${f.value ?? ""} ${f.year ?? ""} ${f.source || ""} ${f.quote || ""}`), (d.timeline || []).map((t) => `${t.year} ${t.event}`), (d.sources || []).map((s) => `${s.title || ""} ${s.publisher || ""}`), (d.quotes || []).map((q) => `${q.text || q.quote || ""} ${q.speaker || q.source || ""} ${q.date || ""}`)).join("\n");
}

module.exports = { resolveLF2, raceFrames, DRIVERS, lf2Problems, docStampProblems, dossierText, LINE_ICONS, SOLID_ICONS };
