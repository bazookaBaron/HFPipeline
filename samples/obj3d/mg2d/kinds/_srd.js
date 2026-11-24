// mg2d/kinds/_srd.js - shared helpers for the SPACE / RELATIONS / DOCUMENTS kind families (not a kind itself).
// Geography is DATA, not an asset: public-domain Natural Earth 110m countries (data/ne_110m_admin_0_countries.geojson), fetched once and cached,
// projected here at runtime (equirectangular, cos(lat0) x-scale) and drawn as flat paper land with ink coastlines.
import { P, F, ease, seg, clamp, lerp, ui, rng } from "../core.js";
import { SH } from "../shapes.js";
export const TAU = Math.PI * 2, D2R = Math.PI / 180;

// ---------------- geo data (cached, top-level await) ----------------
let RAW = null;
{ const url = new URL("../../data/ne_110m_admin_0_countries.geojson", import.meta.url);
  try { if (typeof window === "undefined") { const fs = await import("node:fs"); RAW = JSON.parse(fs.readFileSync(url, "utf8")); } else RAW = await (await fetch(url)).json(); } catch (e) { console.warn("geo data unavailable", e); RAW = { features: [] }; } }
const ringArea = r => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return Math.abs(a) / 2; };
export const COUNTRIES = RAW.features.map(f => { const gm = f.geometry, polys = gm.type === "Polygon" ? [gm.coordinates] : gm.coordinates, rings = polys.map(p => p[0]), areas = rings.map(ringArea), mx = Math.max(...areas, 1e-9);
  let cx = 0, cy = 0, W = 0; rings.forEach((r, i) => { if (areas[i] < mx * 0.1) return; const b = bboxOf(r); cx += (b[0] + b[2]) / 2 * areas[i]; cy += (b[1] + b[3]) / 2 * areas[i]; W += areas[i]; });
  const main = rings.filter((r, i) => areas[i] >= mx * 0.1), mb = main.map(bboxOf).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  const p = f.properties; return { name: p.NAME, long: p.NAME_LONG, admin: p.ADMIN, iso: p.ADM0_A3 || p.ISO_A3, pop: p.POP_EST, rings, bbox: mb, c: [cx / W, cy / W], area: mx }; });
function bboxOf(r) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, y] of r) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; }
const ALIAS = { usa: "united states of america", us: "united states of america", "united states": "united states of america", america: "united states of america", uk: "united kingdom", britain: "united kingdom", uae: "united arab emirates", drc: "dem. rep. congo", congo: "congo", "south korea": "south korea", russia: "russia", czechia: "czechia", "ivory coast": "côte d'ivoire", burma: "myanmar", "hong kong": "china", taiwan: "taiwan" };
const CI = new Map(); COUNTRIES.forEach(c => { for (const k of [c.name, c.long, c.admin, c.iso]) if (k) CI.set(String(k).toLowerCase(), c); });
export const country = n => { const k = String(n ?? "").toLowerCase().trim(); return CI.get(ALIAS[k] ?? k) ?? null; };
// place: { n, ll:[lon,lat] } | { n, lon, lat } | "Country name"
export function place(p) { if (typeof p === "string") { const c = country(p); return { n: p, ll: c ? c.c : [0, 0] }; } if (p.ll) return p; if (p.lon !== undefined) return { ...p, ll: [p.lon, p.lat] }; const c = country(p.n); return { ...p, ll: c ? c.c : [0, 0] }; }
export const haversine = (a, b) => { const R = 6371, p1 = a[1] * D2R, p2 = b[1] * D2R, dp = p2 - p1, dl = (b[0] - a[0]) * D2R, h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
export const pathKm = lls => lls.reduce((s, p, i) => i ? s + haversine(lls[i - 1], p) : 0, 0);

// ---------------- text measuring / wrapping / formatting ----------------
const mc = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
export const measure = (text, size, weight = 600, spacing = 0) => { mc.font = `${weight} ${size}px ${F.family}`; return mc.measureText(text).width + spacing * text.length; };
export function wrap(text, maxW, size, weight = 600, spacing = 0) { const words = String(text).split(/\s+/), lines = []; let cur = ""; for (const w of words) { const t = cur ? cur + " " + w : w; if (cur && measure(t, size, weight, spacing) > maxW) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
export const fmt = (n, d) => { if (typeof n === "string") return n; const a = Math.abs(n), dd = d ?? (a >= 100 ? 0 : a >= 10 ? 1 : 1); const s = (+n).toFixed(dd); const [i, f] = s.split("."); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (f && +f ? "." + f : ""); };
// shrink-to-fit caption (long labels shrink, never below F.small)
export function fit(g, text, x, y, maxW, o = {}) { let size = o.size ?? F.cap; const sp = o.spacing ?? (o.caps === false ? 0 : 3), up = o.caps === false ? text : String(text).toUpperCase(); while (size > F.small && measure(up, size, o.weight ?? 600, sp) > maxW) size -= 2; ui.caption(g, text, x, y, { ...o, size }); }
// tag whose width is known up-front (for placement): returns {w,h}
export const tagSize = (text, size = F.small) => ({ w: measure(String(text).toUpperCase(), size, 700, 2) + 44, h: size * 1.9 });

// ---------------- timing ----------------
export const land = (t, t0, i, step = 0.45, dur = 0.5) => seg(t, t0 - 0.2 + i * step, t0 - 0.2 + i * step + dur);   // i-th sub-element of a focus lands every `step` s
export const sd = r => Math.floor(r() * 1e6);

// ---------------- icons (SH, seeded; never prebuilt) ----------------
export function icon(g, what, x, y, s, o = {}) { g.save(); g.translate(x, y); if (o.flip) g.scale(-1, 1); if (o.rot) g.rotate(o.rot); const r = rng(o.seed ?? 11); const base = { s, u: o.u ?? 1, t: o.t ?? 0, red: !!o.red, view: o.view ?? "side" };
  if (SH[what]) SH[what](g, r, { ...base, ...(o.p || {}) }); else SH.icon(g, r, { what, ...base, ...(o.p || {}) }); g.restore(); }

// ---------------- polylines ----------------
export function mkPath(pts) { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const len = cum[cum.length - 1] || 1;
  const at = d => { d = clamp(d, 0, len); let i = 1; while (i < cum.length - 1 && cum[i] < d) i++; const a = pts[i - 1], b = pts[i], seg0 = Math.max(1e-6, cum[i] - cum[i - 1]), u = (d - cum[i - 1]) / seg0; return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), Math.atan2(b[1] - a[1], b[0] - a[0])]; };
  const upTo = u => { const d = clamp(u, 0, 1) * len, out = [pts[0]]; for (let i = 1; i < pts.length; i++) { if (cum[i] <= d) out.push(pts[i]); else { const p = at(d); out.push([p[0], p[1]]); break; } } return out; };
  return { pts, cum, len, at, upTo }; }
export function smooth(pts, n = 10) { if (pts.length < 3) return pts; const out = []; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
  for (let k = 0; k < n; k++) { const u = k / n, u2 = u * u, u3 = u2 * u; out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3))); } } out.push(pts[pts.length - 1]); return out; }
export function bend(a, b, k = 0.18, n = 36) { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], cx = mx - dy * k, cy = my + dx * k, out = []; for (let i = 0; i <= n; i++) { const u = i / n, v = 1 - u; out.push([v * v * a[0] + 2 * u * v * cx + u * u * b[0], v * v * a[1] + 2 * u * v * cy + u * u * b[1]]); } return out; }
export function stroke(g, pts, w, c, dash, off = 0) { if (pts.length < 2) return; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); if (dash) { g.setLineDash(dash); g.lineDashOffset = off; } ui.ink(g, w, c); g.setLineDash([]); g.lineDashOffset = 0; }
// outlined ribbon (ink edge + colour core), optionally with an arrow head at the end
export function ribbon(g, pts, w, c, head = 0, o = {}) { if (pts.length < 2) return; stroke(g, pts, w + 5, P.ink); stroke(g, pts, w, c);
  if (head) { const n = pts.length, a = pts[n - 1], b = pts[Math.max(0, n - 4)], ang = Math.atan2(a[1] - b[1], a[0] - b[0]), hl = head, hw = w * 0.9 + 14; g.save(); g.translate(a[0], a[1]); g.rotate(ang); g.beginPath(); g.moveTo(hl, 0); g.lineTo(-2, -hw); g.lineTo(-2, hw); g.closePath(); ui.fill(g, c); ui.ink(g, 3.5, P.ink); g.restore(); } }

// ---------------- map ----------------
function regionBox(spec, pts) {
  const bs = [];
  if (Array.isArray(spec) && spec.length === 4 && typeof spec[0] === "number") bs.push(spec);
  else if (spec && spec.box) bs.push(spec.box);
  else for (const n of [].concat(spec ?? [])) { const c = country(n); if (c) bs.push(c.bbox); }
  for (const p of pts ?? []) bs.push([p[0], p[1], p[0], p[1]]);
  if (!bs.length) bs.push([-170, -58, 180, 80]);
  const b = bs.reduce((a, c) => [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[2]), Math.max(a[3], c[3])]);
  const explicit = (Array.isArray(spec) && typeof spec[0] === "number") || (spec && spec.box), px = explicit ? 0 : 0.14;
  const dx = Math.max(b[2] - b[0], 3), dy = Math.max(b[3] - b[1], 3); const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; return [cx - dx / 2 * (1 + 2 * px), cy - dy / 2 * (1 + 2 * px), cx + dx / 2 * (1 + 2 * px), cy + dy / 2 * (1 + 2 * px)];
}
function fitAspect(box, aspect) { const cy = (box[1] + box[3]) / 2, kx = Math.cos(clamp(cy, -70, 70) * D2R); let dlon = box[2] - box[0], dlat = box[3] - box[1]; const cur = dlon * kx / dlat; const cx = (box[0] + box[2]) / 2;
  if (cur < aspect) dlon = aspect * dlat / kx; else dlat = dlon * kx / aspect; return [cx - dlon / 2, cy - dlat / 2, cx + dlon / 2, cy + dlat / 2]; }
const ctxHit = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
// makeMap({region, pts:[ll...], w, h, each:true}) -> M. Local coords: map surface spans (0,0)-(w,h).
export function makeMap(o) {
  const box0 = regionBox(o.region, o.pts), cy = (box0[1] + box0[3]) / 2, kx = Math.cos(clamp(cy, -70, 70) * D2R), asp0 = (box0[2] - box0[0]) * kx / (box0[3] - box0[1]);
  const H = o.h ?? 740, W = o.w ?? clamp(H * asp0, 900, 1400), box = fitAspect(box0, W / H), kx2 = Math.cos(clamp((box[1] + box[3]) / 2, -70, 70) * D2R), s = H / (box[3] - box[1]);
  const f = ll => [(ll[0] - box[0]) * kx2 * s, (box[3] - ll[1]) * s], inv = (x, y) => [box[0] + x / (kx2 * s), box[3] - y / s];
  const pad = 40 / (kx2 * s), all = new Path2D(), each = [];
  for (const c of COUNTRIES) { if (c.name === "Antarctica" && box[1] > -60) continue; const p = new Path2D(); let any = false;
    for (const r of c.rings) { const b = bboxOf(r); if (b[2] < box[0] - pad || b[0] > box[2] + pad || b[3] < box[1] - pad || b[1] > box[3] + pad) continue; any = true;
      r.forEach((q, i) => { const [x, y] = f(q); i ? p.lineTo(x, y) : p.moveTo(x, y); }); p.closePath(); }
    if (any) { all.addPath(p); if (o.each) { const [x, y] = f(c.c); each.push({ c, path: p, x, y }); } } }
  const r = o.rng ?? rng(5), waves = Array.from({ length: 26 }, () => [r() * W, r() * H, r.range(0.6, 1.2), r() * 6]).filter(w => !ctxHit.isPointInPath(all, w[0], w[1]));
  const kmPx = s * kx2 / 111.2 * (1 / kx2), pxKm = s / 111.2;   // px per km (lat direction; x is cos-scaled so equal)
  return { w: W, h: H, box, f, inv, all, each, waves, s, pxKm, hit: (x, y) => ctxHit.isPointInPath(all, x, y), kx: kx2 };
}
const niceStep = v => { const e = 10 ** Math.floor(Math.log10(v)), m = v / e; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * e; };
// draws the base map surface (water, graticule, land with shadow + ink coast + borders, edge ticks, scale bar, compass). Local origin = map top-left.
export function drawMap(g, M, t, o = {}) {
  const { w, h } = M; g.save(); ui.rr(g, 0, 0, w, h, 12); g.clip(); g.fillStyle = o.water ?? P.water; g.fillRect(0, 0, w, h);
  // graticule
  const span = Math.max(M.box[2] - M.box[0], M.box[3] - M.box[1]), gs = niceStep(span / 7); g.save(); g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 1.5; g.setLineDash([2, 9]); g.lineCap = "round"; g.beginPath();
  for (let lo = Math.ceil(M.box[0] / gs) * gs; lo < M.box[2]; lo += gs) { const [x] = M.f([lo, 0]); g.moveTo(x, 0); g.lineTo(x, h); }
  for (let la = Math.ceil(M.box[1] / gs) * gs; la < M.box[3]; la += gs) { const [, y] = M.f([0, la]); g.moveTo(0, y); g.lineTo(w, y); } g.stroke(); g.restore();
  // drifting wave marks (secondary motion)
  g.save(); g.strokeStyle = P.water2; g.lineWidth = 2.2; g.lineCap = "round"; for (const [x, y, k, ph] of M.waves) { const dx = Math.sin(t * 0.5 + ph) * 6, a = clamp(0.5 + 0.5 * Math.sin(t * 0.9 + ph), 0.25, 1); g.globalAlpha = a * 0.8; g.beginPath(); g.moveTo(x - 16 * k + dx, y); g.quadraticCurveTo(x - 8 * k + dx, y - 6 * k, x + dx, y); g.quadraticCurveTo(x + 8 * k + dx, y + 6 * k, x + 16 * k + dx, y); g.stroke(); } g.restore();
  // land: soft shadow, ink coast (stroke under fill leaves only the outer half), paper fill, hair borders
  g.save(); g.translate(5, 8); g.fillStyle = P.shadow; g.fill(M.all); g.restore();
  g.lineJoin = "round"; g.strokeStyle = P.ink; g.lineWidth = 5; g.stroke(M.all); g.fillStyle = o.land ?? P.paper; g.fill(M.all); g.strokeStyle = P.hair; g.lineWidth = 1.6; g.stroke(M.all);
  if (o.landFx) o.landFx(g);
  g.restore(); ui.rr(g, 0, 0, w, h, 12); ui.ink(g, 3, P.ink2);
  // edge ticks
  g.save(); g.beginPath(); for (let i = 1; i < 30; i++) { const x = w * i / 30, l = i % 5 === 0 ? 14 : 7; g.moveTo(x, 0); g.lineTo(x, l); g.moveTo(x, h); g.lineTo(x, h - l); } for (let i = 1; i < 17; i++) { const y = h * i / 17, l = i % 4 === 0 ? 14 : 7; g.moveTo(0, y); g.lineTo(l, y); g.moveTo(w, y); g.lineTo(w - l, y); } ui.ink(g, 1.6, P.ink2); g.restore();
  if (o.scale !== false) scaleBar(g, M, 36, h - 52); if (o.compass !== false) compass(g, w - 70, 78);
}
export function scaleBar(g, M, x, y) { const km = niceStep(M.w * 0.16 / M.pxKm), L = km * M.pxKm; g.save(); g.translate(x, y); ui.rr(g, -14, -34, L + 130 + 28, 68, 10); g.fillStyle = "rgba(251,248,241,.9)"; g.fill(); ui.ink(g, 1.5, "rgba(43,42,39,.35)");
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? P.paper : P.ink; g.fillRect(i * L / 4, -6, L / 4, 12); } g.beginPath(); g.rect(0, -6, L, 12); ui.ink(g, 2, P.ink);
  ui.caption(g, fmt(km) + " km", L + 14, 0, { size: F.small, align: "left", color: P.ink2, caps: false, spacing: 0 }); g.restore(); }
export function compass(g, x, y) { g.save(); g.translate(x, y); circ(g, 0, 0, 38, "rgba(251,248,241,.88)", 2.5); circ(g, 0, 0, 30, null, 1.2); g.beginPath(); g.moveTo(0, -44); g.lineTo(9, 0); g.lineTo(0, 10); g.lineTo(-9, 0); g.closePath(); ui.fill(g, P.ink); g.beginPath(); g.moveTo(0, 44); g.lineTo(7, 4); g.lineTo(-7, 4); g.closePath(); ui.fill(g, P.stone2); g.beginPath(); g.moveTo(0, 44); g.lineTo(7, 4); g.lineTo(-7, 4); g.closePath(); ui.ink(g, 1.5); g.restore(); }
export function circ(g, x, y, r, f, lw = 2.5, c = P.ink) { g.beginPath(); g.arc(x, y, r, 0, TAU); if (f) { g.fillStyle = f; g.fill(); } if (lw) ui.ink(g, lw, c); }
// a framed map "panel" (card + map surface inset 24px). Returns inner offset.
export const PADM = 26;

// label placement: greedy, 8 candidate positions around anchors, avoiding earlier labels and all anchor points. items [{x,y,w,h,r}] -> [{lx,ly}] (centres)
export function placeLabels(items, W, H, pins = items.map(i => [i.x, i.y])) {
  const placed = [], out = [];
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  items.forEach((it, i) => { const r = it.r ?? 22, cands = [[1, 0], [-1, 0], [0, -1], [0, 1], [0.8, -0.8], [-0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]; let best = null;
    for (const [cx, cy] of cands) { const lx = it.x + cx * (r + it.w / 2 + 6) * (cx ? 1 : 0) + (cy ? 0 : 0), ly = it.y + cy * (r + it.h / 2 + 6) * (cy ? 1 : 0);
      const box = { x: lx - it.w / 2, y: ly - it.h / 2, w: it.w, h: it.h }; let cost = 0;
      if (box.x < 8 || box.y < 8 || box.x + box.w > W - 8 || box.y + box.h > H - 8) cost += 1000; for (const p of placed) if (hit(box, p)) cost += 100;
      pins.forEach((q, j) => { if (j !== i && q[0] > box.x - 12 && q[0] < box.x + box.w + 12 && q[1] > box.y - 12 && q[1] < box.y + box.h + 12) cost += 60; }); cost += (cx === 0 ? 3 : 0) + (cy !== 0 && cx !== 0 ? 2 : 0);
      if (!best || cost < best.cost) best = { cost, lx, ly, box }; }
    placed.push(best.box); out.push({ lx: best.lx, ly: best.ly }); }); return out; }

// pin + tag drawn at map point (x,y) with the tag centred at (lx,ly) and a hair leader; u = reveal 0..1
export function pinTag(g, text, x, y, lx, ly, u, o = {}) { if (u <= 0) return; const k = ease.back(u); g.save(); g.globalAlpha *= Math.min(1, u * 3);
  g.beginPath(); g.moveTo(x, y); g.lineTo(lx, ly); ui.ink(g, 1.6, "rgba(43,42,39,.45)"); g.translate(x, y); g.scale(k, k); g.translate(-x, -y); ui.pin(g, x, y - 2, !!o.red, o.s ?? 0.8); g.restore();
  if (text) { g.save(); g.globalAlpha *= clamp(u * 2 - 0.4, 0, 1); ui.tag(g, text, lx, ly, { size: o.size ?? F.small, color: o.red ? P.red : P.ink, rot: o.rot ?? 0 }); g.restore(); } }

// orthographic globe with real land (for locator frames). Local origin = centre. Returns proj(ll)->{x,y,vis}
export function drawGlobe(g, R, lon0, lat0, o = {}) {
  const p0 = lat0 * D2R, proj = ll => { const l = (ll[0] - lon0) * D2R, p = ll[1] * D2R, z = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
    return { x: R * Math.cos(p) * Math.sin(l), y: -R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)), z, vis: z > 0 }; };
  if (g) { g.save(); g.beginPath(); g.arc(0, 0, R, 0, TAU); ui.shadow(g, () => { g.beginPath(); g.arc(0, 0, R, 0, TAU); }, 10, 18); g.fillStyle = P.water; g.fill(); g.save(); g.clip();
    g.strokeStyle = "rgba(255,255,255,.65)"; g.lineWidth = 1.4; for (let lo = -180; lo < 180; lo += 30) { g.beginPath(); let on = false; for (let la = -80; la <= 80; la += 4) { const q = proj([lo, la]); if (q.vis) { on ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); on = true; } else on = false; } g.stroke(); }
    for (let la = -60; la <= 60; la += 30) { g.beginPath(); let on = false; for (let lo = -180; lo <= 180; lo += 4) { const q = proj([lo, la]); if (q.vis) { on ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); on = true; } else on = false; } g.stroke(); }
    g.beginPath(); for (const c of COUNTRIES) { if (c.name === "Antarctica") continue; for (const r of c.rings) { const q = r.map(proj); if (!q.some(a => a.vis)) continue; q.forEach((a, i) => { let x = a.x, y = a.y; if (!a.vis) { const m = Math.hypot(x, y) || 1; x = x / m * R; y = y / m * R; } i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); } }
    g.fillStyle = P.paper; g.fill(); g.lineWidth = 1.4; g.strokeStyle = P.ink2; g.stroke(); g.fillStyle = "rgba(43,42,39,.10)"; g.beginPath(); g.arc(R * 0.42, R * 0.3, R * 1.02, 0, TAU); g.arc(0, 0, R, 0, TAU, true); g.fill("evenodd"); g.restore(); g.beginPath(); g.arc(0, 0, R, 0, TAU); ui.ink(g, 4, P.ink); g.restore(); }
  return proj; }

// compact pill / chip with an icon and a small number (cargo marks etc.)
export function chip(g, text, x, y, o = {}) { const size = o.size ?? F.small, w = measure(text, size, 700) + 34, h = size * 1.7; g.save(); g.translate(x, y); ui.shadow(g, () => ui.rr(g, -w / 2, -h / 2, w, h, h / 2), 3, 6); ui.rr(g, -w / 2, -h / 2, w, h, h / 2); ui.fill(g, o.fill ?? P.paper); ui.ink(g, 2, o.red ? P.red : "rgba(43,42,39,.5)");
  ui.caption(g, text, 0, 1, { size, weight: 700, color: o.red ? P.red : P.ink, caps: o.caps ?? false, spacing: 0 }); g.restore(); return [w, h]; }
export { P, F, ease, seg, clamp, lerp, ui, rng, SH };
