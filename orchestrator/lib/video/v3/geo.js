"use strict";

/**
 * Compile-time map resolver for the LF worldMap / countryMap modules (video-engine/.../stage/modules-map.js).
 *
 * The stage never loads geo data: the compiler projects every point, fits every view and ships only
 * the country paths a module can actually show. Geo assets: video-engine/assets/geo/world-{110m,50m}.json
 * (Natural Earth admin-0, public domain; build_geo.py), Natural Earth I projection, y down.
 * Map units = the 50m file's scale (5000 per projected radian); 110m paths carry k = 5 (scaled in the stage).
 *
 * Authoring (module props, all optional except countryMap.focus):
 *   focus: ["IND","PAK"]            fit the view to these countries (main landmass bbox) + padding
 *   view: "world" | {lon:[a,b], lat:[c,d]}   explicit view (default: world for worldMap)
 *   pad: 0.14                       padding fraction around the focus bbox
 *   highlight: [{iso, tone?, label?: true|"text"}]      shown from the start
 *   pins: [{iso | lonlat:[lon,lat] | city, label?, tone?}]
 *   arrows: [{from, to, label?, tone?, bend?}]           from/to = {iso|lonlat|city} or "PAK" / "city:Karachi"
 *   choropleth: {values: {ISO3: n}, unit?, source?, breaks?: [..4], title?} or {series: "S3"} (data.json)
 *   labels: false                   no country-name labels on highlighted countries
 *   intro: "world" | "region" | [ISO3]   establishing flight from a wide view into the view (props.introView)
 *   counters: [{at, value, prefix?, suffix?, label?}]   frosted counter cards pinned to a place
 *   routeMap: stops [{city|iso|lonlat, label?}] (2-5), legs? [{from, to, label?}] (1-based, default chained),
 *             mode? air|sea|land -> pins (stop: true) + arrows (route: true); view fits the stops unless focus
 * Every map ships a graticule (geo.grat) and each country's label point (c) for the focus lift.
 * Events (values resolved here): highlight {iso, tone?, label?}, pin {...point, label?}, arrow {from, to, label?},
 *   zoomTo {isos | view, dur?}, choropleth {values | series}, dim {iso}.
 */

const fs = require("fs");
const path = require("path");

const GEO_DIR = path.resolve(__dirname, "..", "..", "..", "..", "video-engine", "assets", "geo");
const UNITS = 5000;
const MAP_TYPES = new Set(["worldMap", "countryMap", "routeMap"]);
const cache = {};
function load(res) {
  if (!cache[res]) {
    const g = JSON.parse(fs.readFileSync(path.join(GEO_DIR, `world-${res}.json`), "utf-8"));
    g.k = UNITS / g.scale;
    cache[res] = g;
  }
  return cache[res];
}

/** Natural Earth I (same polynomial as build_geo.py) -> map units, y down */
function project(lon, lat) {
  const lam = (lon * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const p2 = phi * phi;
  const p4 = p2 * p2;
  const x = lam * (0.8707 - 0.131979 * p2 - 0.013791 * p4 + 0.003971 * p2 * p4 * p4 - 0.001529 * p4 * p4 * p4);
  const y = phi * (1.007226 + 0.015085 * p2 - 0.044475 * p2 * p4 + 0.028874 * p4 * p4 - 0.005916 * p2 * p4 * p4);
  return [Math.round(x * UNITS * 10) / 10 + 0, Math.round(-y * UNITS * 10) / 10 + 0]; // + 0: no -0
}

// financial / capital cities a finance explainer pins most (lon, lat; public knowledge)
const CITIES = {
  karachi: [67.01, 24.86], lahore: [74.34, 31.55], islamabad: [73.05, 33.68], gwadar: [62.33, 25.13],
  mumbai: [72.88, 19.08], delhi: [77.21, 28.61], "new delhi": [77.21, 28.61], bengaluru: [77.59, 12.97], bangalore: [77.59, 12.97],
  chennai: [80.27, 13.08], kolkata: [88.36, 22.57], hyderabad: [78.49, 17.39], ahmedabad: [72.57, 23.02],
  beijing: [116.41, 39.9], shanghai: [121.47, 31.23], shenzhen: [114.06, 22.54], "hong kong": [114.17, 22.32], kashgar: [75.99, 39.47],
  colombo: [79.86, 6.93], hambantota: [81.12, 6.12], dhaka: [90.41, 23.81], kathmandu: [85.32, 27.72], male: [73.51, 4.18],
  singapore: [103.82, 1.35], tokyo: [139.69, 35.69], seoul: [126.98, 37.57], jakarta: [106.85, -6.21], bangkok: [100.5, 13.76],
  dubai: [55.27, 25.2], "abu dhabi": [54.37, 24.45], riyadh: [46.68, 24.71], doha: [51.53, 25.29], tehran: [51.39, 35.69],
  istanbul: [28.98, 41.01], moscow: [37.62, 55.76], london: [-0.13, 51.51], paris: [2.35, 48.86], frankfurt: [8.68, 50.11],
  zurich: [8.54, 47.38], brussels: [4.35, 50.85], athens: [23.73, 37.98], "new york": [-74.01, 40.71], washington: [-77.04, 38.91],
  "san francisco": [-122.42, 37.77], toronto: [-79.38, 43.65], "sao paulo": [-46.63, -23.55], "buenos aires": [-58.38, -34.6],
  lagos: [3.38, 6.52], nairobi: [36.82, -1.29], johannesburg: [28.05, -26.2], cairo: [31.24, 30.04], sydney: [151.21, -33.87],
};

const WORLD_LAT = [-57, 84]; // no Antarctica, no polar cap

function countryAt(iso, where) {
  const k = String(iso || "").toUpperCase();
  const c = load("50m").countries[k] || load("110m").countries[k];
  if (!c) throw new Error(`${where}: unknown country "${iso}" (ISO3, e.g. IND)`);
  return c;
}
const scaleBox = (b, k) => [b[0] * k, b[1] * k, b[2] * k, b[3] * k];

/** {iso} | {lonlat} | {city} | "PAK" | "city:Karachi" | [lon, lat] -> [x, y] map units */
function point(p, where) {
  if (Array.isArray(p) && p.length === 2) return project(Number(p[0]), Number(p[1]));
  if (typeof p === "string") p = /^city:/i.test(p) ? { city: p.slice(5) } : CITIES[p.toLowerCase()] ? { city: p } : { iso: p };
  if (!p || typeof p !== "object") throw new Error(`${where}: point needs iso, lonlat or city`);
  if (Array.isArray(p.lonlat)) return project(Number(p.lonlat[0]), Number(p.lonlat[1]));
  if (p.city) {
    const ll = CITIES[String(p.city).toLowerCase()];
    if (!ll) throw new Error(`${where}: unknown city "${p.city}" (give lonlat: [lon, lat])`);
    return project(ll[0], ll[1]);
  }
  if (p.iso) {
    const g = load("50m");
    const c = countryAt(p.iso, where);
    const k = g.countries[String(p.iso).toUpperCase()] ? g.k : load("110m").k;
    if (c.c) return [c.c[0] * k, c.c[1] * k];
    const b = scaleBox(c.b, k);
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  }
  throw new Error(`${where}: point needs iso, lonlat or city`);
}

function worldBox() {
  const g = load("50m");
  const e = g.extent;
  return [e[0] * g.k, project(0, WORLD_LAT[1])[1], e[2] * g.k, project(0, WORLD_LAT[0])[1]];
}

/** bbox -> [x, y, w, h] padded and grown to the rect's aspect */
function fitBox(b, aspect, pad) {
  let [x0, y0, x1, y1] = b;
  let w = Math.max(1, x1 - x0);
  let h = Math.max(1, y1 - y0);
  const px = w * pad;
  const py = h * pad;
  x0 -= px;
  x1 += px;
  y0 -= py;
  y1 += py;
  w = x1 - x0;
  h = y1 - y0;
  if (w / h < aspect) {
    const nw = h * aspect;
    x0 -= (nw - w) / 2;
    w = nw;
  } else {
    const nh = w / aspect;
    y0 -= (nh - h) / 2;
    h = nh;
  }
  const r = (v) => Math.round(v * 10) / 10;
  return [r(x0), r(y0), r(w), r(h)];
}

function viewOf(spec, aspect, pad, where, fallbackWorld) {
  if (spec && Array.isArray(spec.isos || spec.focus)) spec = spec.isos || spec.focus;
  if (Array.isArray(spec) && spec.length) {
    const bs = spec.map((iso) => {
      const g50 = load("50m");
      const k = g50.countries[String(iso).toUpperCase()] ? g50.k : load("110m").k;
      return scaleBox(countryAt(iso, where).b, k);
    });
    return fitBox([Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))], aspect, pad);
  }
  if (spec && typeof spec === "object" && Array.isArray(spec.lon) && Array.isArray(spec.lat)) {
    const a = project(spec.lon[0], spec.lat[1]);
    const b = project(spec.lon[1], spec.lat[0]);
    const c = project(0, spec.lat[1]);
    const d = project(0, spec.lat[0]);
    return fitBox([Math.min(a[0], b[0]), Math.min(a[1], c[1]), Math.max(a[0], b[0]), Math.max(b[1], d[1])], aspect, 0);
  }
  if (spec === "world" || fallbackWorld) return fitBox(worldBox(), aspect, 0.02);
  throw new Error(`${where}: needs focus (ISO3 list) or view`);
}

/** deterministic quantile breaks (4 inner breaks -> 5 classes), rounded to 2 significant digits */
function niceBreaks(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (v.length < 5) return [];
  const q = (f) => v[Math.min(v.length - 1, Math.floor(f * (v.length - 1)))];
  const sig = (x) => {
    if (x === 0) return 0;
    const m = Math.pow(10, Math.floor(Math.log10(Math.abs(x))) - 1);
    return Math.round(x / m) * m;
  };
  const out = [];
  [0.2, 0.4, 0.6, 0.8].forEach((f) => {
    const b = Number(sig(q(f)).toPrecision(6));
    if (!out.length || b > out[out.length - 1]) out.push(b);
  });
  return out;
}
const RAMP = ["#d3e1f2", "#a3bfe4", "#6f98d2", "#3f72bd", "#17468f"]; // light -> the LF accent blue, darker at the top
function fmtBreak(x) {
  return Math.abs(x) >= 1000 ? Math.round(x).toLocaleString("en-US") : String(Number(x.toPrecision(3)));
}
function choroplethOf(c, where) {
  if (!c || typeof c !== "object") return null;
  if (typeof c.series === "string") throw new Error(`${where}: choropleth series "${c.series}" was not resolved (compile needs opts.data = data.json)`);
  const values = {};
  Object.entries(c.values || {}).forEach(([k, v]) => Number.isFinite(Number(v)) && (values[k.toUpperCase()] = Number(v)));
  if (!Object.keys(values).length) throw new Error(`${where}: choropleth has no values`);
  const breaks = Array.isArray(c.breaks) && c.breaks.length ? c.breaks.map(Number) : niceBreaks(Object.values(values));
  const colors = RAMP.slice(RAMP.length - (breaks.length + 1));
  const cls = {};
  Object.entries(values).forEach(([k, v]) => {
    let i = 0;
    while (i < breaks.length && v >= breaks[i]) i++;
    cls[k] = i;
  });
  const labels = colors.map((_, i) => (i === 0 ? `< ${fmtBreak(breaks[0])}` : i === breaks.length ? `${fmtBreak(breaks[i - 1])}+` : `${fmtBreak(breaks[i - 1])}–${fmtBreak(breaks[i])}`));
  return { cls, colors, labels, title: c.title || "", unit: c.unit || "", source: c.source || "", year: c.year || null };
}

/** which countries a module needs: every country with a polygon meeting any of its views (+10 %) */
function pathsFor(views, keep) {
  const g50 = load("50m");
  const g110 = load("110m");
  const worldW = worldBox()[2] - worldBox()[0];
  const pick = {};
  views.forEach((v) => {
    const fine = v[2] < 0.35 * worldW;
    const g = fine ? g50 : g110;
    const mx = v[2] * 0.1;
    const my = v[3] * 0.1;
    Object.entries(g.countries).forEach(([iso, c]) => {
      if (iso === "ATA" && !(keep && keep.has("ATA"))) return; // Antarctica only when asked for
      const meets = (b) => !(b[2] < v[0] - mx || b[0] > v[0] + v[2] + mx || b[3] < v[1] - my || b[1] > v[1] + v[3] + my);
      if (!(c.P || [c.B]).some((pb) => meets(scaleBox(pb, g.k)))) return;
      if (fine || !pick[iso]) pick[iso] = { iso, n: c.n, d: c.d, k: g.k, res: fine ? "50m" : "110m", c: labelPoint(iso) };
    });
  });
  return Object.values(pick).sort((a, b) => (a.iso < b.iso ? -1 : 1));
}

function labelPoint(iso) {
  try {
    return point({ iso }, "label");
  } catch (_) {
    return null;
  }
}
function normHighlight(h, where) {
  const x = typeof h === "string" ? { iso: h } : { ...h };
  countryAt(x.iso, where);
  x.iso = String(x.iso).toUpperCase();
  const lab = x.label === undefined ? null : x.label;
  if (lab) x.label = { text: lab === true ? countryAt(x.iso, where).n : String(lab), at: labelPoint(x.iso) };
  else delete x.label;
  return x;
}
function normPin(p, where) {
  const at = point(p, where);
  return { at, label: p.label || (p.city ? p.city.replace(/\b\w/g, (m) => m.toUpperCase()) : ""), tone: p.tone || "red" };
}
function normArrow(a, where) {
  if (!a || a.from === undefined || a.to === undefined) throw new Error(`${where}: arrow needs from and to`);
  return { from: point(a.from, `${where} from`), to: point(a.to, `${where} to`), label: a.label || "", tone: a.tone || "blue", bend: a.bend === undefined ? 0.22 : Number(a.bend) };
}

/**
 * Faint graticule (every 20 degrees, lat -60..80) as one path in map units, sampled every 2 degrees so the
 * Natural Earth curvature shows. Shipped once per map module (props.geo.grat).
 */
let GRAT = null;
function graticule() {
  if (GRAT) return GRAT;
  const r = (v) => Math.round(v);
  const parts = [];
  for (let lon = -180; lon <= 180; lon += 20) {
    const pts = [];
    for (let lat = -60; lat <= 80; lat += 2) pts.push(project(lon, lat));
    parts.push("M" + pts.map((p) => `${r(p[0])} ${r(p[1])}`).join("L"));
  }
  for (let lat = -60; lat <= 80; lat += 20) {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 2) pts.push(project(lon, lat));
    parts.push("M" + pts.map((p) => `${r(p[0])} ${r(p[1])}`).join("L"));
  }
  GRAT = parts.join("");
  return GRAT;
}

/** view [x, y, w, h] fitted around projected points (routes), grown to the rect aspect */
function pointsView(pts, aspect, pad) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  // never tighter than ~6 degrees of longitude (a city-to-city hop still shows its coastline)
  const minW = 6 * (UNITS * Math.PI / 180) * 0.87;
  if (b[2] - b[0] < minW) {
    const m = (b[0] + b[2]) / 2;
    b[0] = m - minW / 2;
    b[2] = m + minW / 2;
  }
  return fitBox(b, aspect, pad);
}

/** routeMap stops -> pins + chained legs (arrows flagged `route`) */
function normRoute(p, where) {
  const stops = (p.stops || []).map((s, i) => {
    const x = typeof s === "string" ? { city: s } : s;
    return { at: point(x, `${where} stop ${i + 1}`), label: x.label !== undefined ? String(x.label) : x.city ? String(x.city).replace(/\b\w/g, (m) => m.toUpperCase()) : "", tone: x.tone || p.tone || "blue" };
  });
  if (stops.length < 2) throw new Error(`${where}: routeMap needs 2-5 stops`);
  if (stops.length > 5) throw new Error(`${where}: routeMap takes at most 5 stops (got ${stops.length})`);
  const legs = (p.legs && p.legs.length ? p.legs : stops.slice(1).map((_, i) => ({ from: i + 1, to: i + 2 }))).map((l, i) => {
    const a = stops[Number(l.from) - 1];
    const b = stops[Number(l.to) - 1];
    if (!a || !b) throw new Error(`${where}: leg ${i + 1} names a stop that does not exist (stops are 1-based)`);
    return { from: a.at, to: b.at, label: l.label || "", tone: l.tone || p.tone || "blue", bend: l.bend === undefined ? (p.mode === "land" ? 0.08 : 0.24) : Number(l.bend), route: true };
  });
  return { stops, legs };
}

/** frosted counter cards pinned to a place: {at: iso|city|lonlat, value, prefix?, suffix?, decimals?, label?} */
function normCounter(k, where) {
  const x = k || {};
  const at = point(x.at !== undefined ? x.at : x, `${where} counter`);
  const value = Number(x.value);
  if (!Number.isFinite(value)) throw new Error(`${where}: counter needs a numeric value`);
  return { at, value, prefix: x.prefix || "", suffix: x.suffix || "", decimals: Number(x.decimals) || 0, label: x.label || "", tone: x.tone || "blue", from: x.from === undefined ? 0 : Number(x.from) };
}

/**
 * Resolve every map module (props) and the events that target it, in place on the compiled spec.
 * scaffolds: compiled scaffolds (modules with rect/props); events: compiled events [{t, op, target, value}].
 */
function resolveMaps(scaffolds, events) {
  const mods = {};
  scaffolds.forEach((s) =>
    s.modules.forEach((m) => {
      if (!MAP_TYPES.has(m.type)) return;
      (mods[m.id] = mods[m.id] || []).push(m);
    })
  );
  Object.entries(mods).forEach(([id, list]) => {
    const m0 = list[0];
    const aspect = m0.rect[2] / m0.rect[3];
    const views = [];
    list.forEach((m) => {
      const p = m.props || {};
      if (p.geo) return; // already resolved (a module persisting across scaffolds shares the object)
      const where = `map ${id}`;
      const pad = p.pad === undefined ? 0.14 : Number(p.pad);
      const route = m.type === "routeMap" ? normRoute(p, where) : null;
      const view =
        p.view !== undefined && p.view !== "world"
          ? viewOf(p.view, aspect, 0, where)
          : route && !(p.focus || []).length && p.view !== "world"
            ? pointsView(route.stops.map((s) => s.at), aspect, p.pad === undefined ? 0.22 : pad)
            : viewOf(p.focus, aspect, pad, where, m.type !== "countryMap" || p.view === "world");
      views.push(view);
      // establishing shot: the camera opens wide (world / the region around the view / given countries) and flies in
      let introView = null;
      if (p.intro) {
        if (p.intro === "world") introView = viewOf("world", aspect, 0, where);
        else if (p.intro === "region") {
          const k = 3.2;
          const cx = view[0] + view[2] / 2;
          const cy = view[1] + view[3] / 2;
          introView = [cx - (view[2] * k) / 2, cy - (view[3] * k) / 2, view[2] * k, view[3] * k].map((v) => Math.round(v * 10) / 10);
        } else introView = viewOf([].concat(p.intro), aspect, pad, where);
        views.push(introView);
      }
      const hl = (p.highlight || []).map((h) => normHighlight(h, where));
      if (m.type === "countryMap" && p.labels !== false) (p.focus || []).forEach((iso) => hl.find((h) => h.iso === String(iso).toUpperCase()) || hl.push(normHighlight({ iso, tone: "none", label: true }, where)));
      hl.forEach((h) => p.labels !== false && m.type === "countryMap" && !h.label && h.tone !== "none" && (h.label = normHighlight({ iso: h.iso, label: true }, where).label));
      m.props = {
        ...p,
        view,
        highlight: hl,
        pins: (p.pins || []).map((x) => normPin(x, where)).concat(route ? route.stops.map((s) => ({ ...s, stop: true })) : []),
        arrows: (p.arrows || []).map((x) => normArrow(x, where)).concat(route ? route.legs : []),
        choropleth: p.choropleth ? choroplethOf(p.choropleth, where) : null,
        counters: (p.counters || []).map((x) => normCounter(x, where)),
        introView,
      };
      if (route) m.props.auto = p.auto !== false && !(events || []).some((e) => e.op === "leg" && String(e.target || "").split(".")[0] === id);
      delete m.props.pad;
      delete m.props.stops;
      delete m.props.legs;
      delete m.props.intro;
    });
    (events || [])
      .filter((e) => String(e.target || "").split(".")[0] === id)
      .forEach((e, i) => {
        const where = `map ${id} event ${e.op}`;
        const v = e.value || {};
        if (e.op === "zoomTo") {
          const pad = v.pad === undefined ? 0.14 : Number(v.pad);
          const view = v.view ? viewOf(v.view === "world" ? "world" : v.view, aspect, pad, where) : viewOf(v.isos || v.focus || v.iso ? [].concat(v.isos || v.focus || v.iso) : null, aspect, pad, where);
          e.value = { view, dur: v.dur === undefined ? 1.2 : Number(v.dur) };
          views.push(view);
        } else if (e.op === "highlight" || e.op === "dim") e.value = normHighlight(v, where);
        else if (e.op === "pin") e.value = normPin(v, where);
        else if (e.op === "arrow") e.value = normArrow(v, where);
        else if (e.op === "choropleth") e.value = choroplethOf(v, where);
        else if (e.op === "counter") e.value = normCounter(v, where);
        else if (e.op === "leg") e.value = { i: Number(v.i) || 1 };
      });
    const keep = new Set(list.flatMap((m) => [].concat(m.props.focus || [], (m.props.highlight || []).map((h) => h.iso))).map((x) => String(x).toUpperCase()));
    const countries = pathsFor(views, keep);
    list.forEach((m) => {
      if (!m.props.geo) m.props.geo = { units: UNITS, countries, grat: graticule() };
    });
    // the same geo object for every appearance (the stage builds a module once)
    const shared = list[0].props.geo;
    list.forEach((m) => (m.props.geo = shared));
  });
}

module.exports = { resolveMaps, project, point, viewOf, fitBox, niceBreaks, choroplethOf, pathsFor, worldBox, CITIES, MAP_TYPES, UNITS, GEO_DIR, load };
