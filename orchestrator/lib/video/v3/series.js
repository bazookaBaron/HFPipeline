"use strict";

/**
 * Compile-time data-series resolver (orchestrator/lib/longform/DATA.md). opts.data = data.json from
 * lib/longform/data.js ({version, series: [{id, kind: "time"|"map", ...}]}).
 *
 * Any object inside module props or event values that carries `series: "<id>"` (or an array of ids for
 * a multi-line chart) is filled from data.json:
 *   time series -> points [{x: year, y}], unit, source, sourceUrl, decimals (author-set unit/decimals win;
 *                  the source line is always the data's). Optional on the ref: from / to (years), last: N.
 *                  ["S1","S2"] -> series: [{name: <country>, points}], sources joined.
 *                  On a barChart module (top level) the points become bars [{label: "2019", value}] (last 8).
 *   map series  -> values {ISO3: v}, unit, source (with the year), year  (choropleths, modules-map.js)
 * An unknown id, or a ref with no data.json at all, throws (the compiler never guesses a number).
 */

function seriesIndex(data) {
  if (!data) return null;
  const list = Array.isArray(data) ? data : data.series || [];
  return Object.fromEntries(list.map((s) => [s.id, s]));
}

function pick(s, ref, where) {
  let pts = (s.points || []).slice();
  if (ref.from !== undefined) pts = pts.filter((p) => p.x >= Number(ref.from));
  if (ref.to !== undefined) pts = pts.filter((p) => p.x <= Number(ref.to));
  if (ref.last !== undefined) pts = pts.slice(-Number(ref.last));
  if (!pts.length) throw new Error(`${where}: series ${s.id} has no points in the requested range`);
  return pts.map((p) => ({ x: p.x, y: p.y }));
}

function fill(ref, idx, where, moduleType) {
  const ids = Array.isArray(ref.series) ? ref.series : [ref.series];
  if (!idx) throw new Error(`${where}: references data series ${ids.join(", ")} but no data.json was given (compileStoryboard opts.data)`);
  const ss = ids.map((id) => {
    const s = idx[id];
    if (!s) throw new Error(`${where}: unknown data series "${id}" (data.json has ${Object.keys(idx).join(", ") || "none"})`);
    return s;
  });
  const out = { ...ref };
  delete out.series;
  delete out.from;
  delete out.to;
  delete out.last;
  const s0 = ss[0];
  if (s0.kind === "map") {
    if (ss.length > 1) throw new Error(`${where}: a map series ref takes one id`);
    out.values = { ...s0.values };
    out.year = s0.year;
  } else if (ss.length > 1) {
    out.series = ss.map((s) => ({ name: s.countryName || s.country, points: pick(s, ref, where) }));
  } else {
    out.points = pick(s0, ref, where);
    if (moduleType === "barChart" && !out.bars) {
      const last = ref.last !== undefined || ref.from !== undefined || ref.to !== undefined ? out.points : out.points.slice(-8);
      out.bars = last.map((p) => ({ label: String(p.x), value: p.y }));
      delete out.points;
    }
  }
  if (out.unit === undefined) out.unit = s0.unit;
  if (out.decimals === undefined && s0.decimals !== undefined) out.decimals = s0.decimals;
  out.source = [...new Set(ss.map((s) => s.source))].join("; ");
  out.sourceUrl = s0.sourceUrl;
  out.dataSeries = ids;
  return out;
}

/** deep-resolve a props / event value tree */
function resolveSeries(v, idx, where, moduleType, top = true) {
  if (Array.isArray(v)) return v.map((x) => resolveSeries(x, idx, where, moduleType, false));
  if (!v || typeof v !== "object") return v;
  const isRef = typeof v.series === "string" || (Array.isArray(v.series) && v.series.length && v.series.every((x) => typeof x === "string"));
  const base = {};
  for (const [k, x] of Object.entries(v)) base[k] = k === "series" && isRef ? x : resolveSeries(x, idx, where, moduleType, false);
  return isRef ? fill(base, idx, where, top ? moduleType : null) : base;
}

/** true when anything in the tree references a series (so compile can skip untouched modules) */
function hasSeriesRef(v) {
  if (Array.isArray(v)) return v.some(hasSeriesRef);
  if (!v || typeof v !== "object") return false;
  if (typeof v.series === "string" || (Array.isArray(v.series) && v.series.length && v.series.every((x) => typeof x === "string"))) return true;
  return Object.values(v).some(hasSeriesRef);
}

module.exports = { resolveSeries, seriesIndex, hasSeriesRef };
