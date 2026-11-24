// Shared helpers for the numbers + comparison families (pure functions; no stored art). Imported only by kinds in those two families.
import { SH } from "../shapes.js";
import { P, F, ui, ease, seg, clamp, lerp, rng, W_INK } from "../core.js";
export { P, F, ui, ease, seg, clamp, lerp, rng, W_INK, SH };

let _m = null;
const mctx = () => (_m = _m || document.createElement("canvas").getContext("2d"));
// text width at a size (uppercased small-caps style, letter spacing 2px like ui.caption/tag)
export function tw(text, size, weight = 600, caps = true, sp = 2) { const g = mctx(); g.font = `${weight} ${size}px ${F.family}`; const s = caps ? String(text).toUpperCase() : String(text); return g.measureText(s).width + sp * s.length; }
// wrap into lines <= maxW, shrinking the font toward F.small (never below) before wrapping a 3rd line
export function wrap(text, maxW, size = F.small, weight = 600, caps = true) {
  text = String(text ?? ""); let sz = size, lines = [];
  for (; ;) { lines = []; let cur = ""; for (const w of text.split(/\s+/)) { const t = cur ? cur + " " + w : w; if (cur && tw(t, sz, weight, caps) > maxW) { lines.push(cur); cur = w; } else cur = t; } lines.push(cur);
    if ((lines.length <= 2 && Math.max(...lines.map(l => tw(l, sz, weight, caps))) <= maxW * 1.04) || sz <= F.small) break; sz = Math.max(F.small, sz - 2); }
  return { lines, size: sz };
}
// multi-line caption centred on (x,y). returns { n, size, h }
export function lab(g, text, x, y, o = {}) {
  const w = wrap(text, o.maxW ?? 260, o.size ?? F.small, o.weight ?? 600, o.caps !== false), lh = w.size * 1.18, y0 = (o.base === "top" ? 0 : o.base === "bottom" ? -(w.lines.length - 1) * lh : -(w.lines.length - 1) * lh / 2);
  w.lines.forEach((l, i) => ui.caption(g, l, x, y + y0 + i * lh, { ...o, size: w.size, base: "middle" }));
  return { n: w.lines.length, size: w.size, h: w.lines.length * lh };
}
// number formatting
export function fmt(v, dec) { if (typeof v === "string") return v; const d = dec ?? (Math.abs(v) >= 100 || Number.isInteger(v) ? 0 : Math.abs(v) >= 10 ? 1 : 2); let s = Math.abs(v).toFixed(d); const [a, b] = s.split("."); s = a.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (b ? "." + b : ""); return (v < 0 ? "-" : "") + s; }
export function short(v) { const a = Math.abs(v); if (a >= 1e9) return fmt(v / 1e9, a >= 1e10 ? 0 : 1) + "B"; if (a >= 1e6) return fmt(v / 1e6, a >= 1e7 ? 0 : 1) + "M"; if (a >= 1e4) return fmt(v / 1e3, 0) + "K"; return fmt(v); }
export function nice(max, n = 5) { const raw = max / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p, s = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10; const step = s * p; return { step, top: Math.ceil(max / step - 1e-9) * step }; }
export const hashSeed = (a, i = 0) => (Math.imul((a | 0) + 7, 2654435761) ^ Math.imul(i + 13, 40503)) >>> 0;
// draw a generated object (SH generator name or semantic word) centred at (0,0), main dimension s
export function obj(g, seed, what, s, o = {}) {
  const r = rng(seed % 2147483000 + 1), oo = { s, u: o.u ?? 1, t: o.t ?? 0, red: !!o.red, ...(o.extra || {}) }; if (o.view) oo.view = o.view;
  if (typeof what === "string" && SH[what] && what !== "icon") return SH[what](g, r, oo); return SH.icon(g, r, { what: what || "container", ...oo });
}
// measured aspect of an object at s=100 (w,h) via an offscreen canvas (build time only)
const mcache = new Map();
export function measure(what, seed = 5) { const k = what + seed; if (mcache.has(k)) return mcache.get(k); let res = { w: 100, h: 100 };
  try { const c = document.createElement("canvas"); c.width = c.height = 600; const g = c.getContext("2d"); g.translate(300, 300); const a = obj(g, seed, what, 100, {}); if (a && a.w && a.h) res = { w: a.w, h: a.h }; } catch (e) { }
  mcache.set(k, res); return res; }
// staged reveal: element i of a sequence starting at t0
export const stg = (t, t0, i, step = 0.12, dur = 0.5) => seg(t, t0 + i * step, t0 + i * step + dur);
// the common card + caption
export function base(g, w, h, cap, r = 18) { ui.card(g, 0, 0, w, h, { r }); if (cap) ui.caption(g, cap, w / 2, 50, { size: F.small, color: P.mid }); }
// dashed line
export function dash(g, x0, y0, x1, y1, u = 1, c = P.hair, w = 2, d = [8, 8]) { if (u <= 0) return; g.save(); g.setLineDash(d); g.beginPath(); g.moveTo(x0, y0); g.lineTo(lerp(x0, x1, u), lerp(y0, y1, u)); ui.ink(g, w, c); g.restore(); }
export function line(g, x0, y0, x1, y1, w = 2, c = P.ink2) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); ui.ink(g, w, c); }
// ground strip: soft paper shadow band + ink line, drawn left to right by u
export function ground(g, x0, x1, y, u = 1, c = P.ink2) { if (u <= 0) return; const xe = lerp(x0, x1, ease.io(u)); g.save(); g.fillStyle = P.shadow2; g.fillRect(x0, y + 3, xe - x0, 14); g.restore(); line(g, x0, y, xe, y, 3, c); }
// small hatched ground ticks under a line (context detail)
export function groundTicks(g, x0, x1, y, u = 1, gap = 22) { const xe = lerp(x0, x1, ease.io(u)); g.save(); g.beginPath(); for (let x = x0 + 8; x < xe; x += gap) { g.moveTo(x, y + 6); g.lineTo(x - 9, y + 20); } ui.ink(g, 1.5, P.hair); g.restore(); }
export function ell(g, x, y, rx, ry, a = 1) { g.save(); g.globalAlpha *= a; g.fillStyle = P.shadow; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); g.restore(); }
// monotone-ish smooth path through points (catmull-rom -> bezier)
export function smooth(g, pts, move = true) { if (move) g.moveTo(pts[0][0], pts[0][1]); for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)], k = 0.18;
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]); } }
// partial reveal of a polyline of points: returns the points up to fraction u (with an interpolated last point)
export function partial(pts, u) { if (u >= 1) return pts.slice(); const L = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0); let rem = L * u; const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (rem >= d) { out.push(pts[i]); rem -= d; } else { const k = d ? rem / d : 0; out.push([lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]); break; } } return out; }
// separate label y positions so they keep >= gap apart (sorted spreading)
export function spread(ys, gap, lo, hi) { const idx = ys.map((y, i) => i).sort((a, b) => ys[a] - ys[b]), out = ys.slice(); for (let p = 0; p < 40; p++) { for (let k = 1; k < idx.length; k++) { const a = idx[k - 1], b = idx[k], d = out[b] - out[a]; if (d < gap) { const m = (gap - d) / 2; out[a] -= m; out[b] += m; } } idx.forEach(i => out[i] = clamp(out[i], lo, hi)); } return out; }
export const tints = [P.stone2, P.water2, P.sand2, P.hair, P.stone, P.water, P.sand, P.lite];
// simple tick/cross glyphs drawn by strokes, progress u
export function tick(g, x, y, s, u, c = P.ink) { if (u <= 0) return; const a = [x - s * .5, y + s * .02], b = [x - s * .12, y + s * .42], d = [x + s * .55, y - s * .42]; const pts = [a, b, d]; const p = partial(pts, ease.out(u)); g.beginPath(); g.moveTo(...p[0]); p.slice(1).forEach(q => g.lineTo(...q)); ui.ink(g, 7, c); }
export function cross(g, x, y, s, u, c = P.mid) { if (u <= 0) return; const k = ease.out(u); g.beginPath(); g.moveTo(x - s * .4, y - s * .4); g.lineTo(lerp(x - s * .4, x + s * .4, Math.min(1, k * 2)), lerp(y - s * .4, y + s * .4, Math.min(1, k * 2)));
  if (k > .5) { g.moveTo(x + s * .4, y - s * .4); g.lineTo(lerp(x + s * .4, x - s * .4, (k - .5) * 2), lerp(y - s * .4, y + s * .4, (k - .5) * 2)); } ui.ink(g, 7, c); }
// numeral pill with small shadow (value flags)
export function flag(g, text, x, y, o = {}) { const size = o.size ?? F.small; g.save(); g.font = `800 ${size}px ${F.family}`; const w = g.measureText(text).width + 30, h = size * 1.6; g.restore(); g.save(); g.translate(x, y);
  ui.shadow(g, () => ui.rr(g, -w / 2, -h / 2, w, h, h / 2), 3, 6); ui.rr(g, -w / 2, -h / 2, w, h, h / 2); ui.fill(g, o.fill ?? P.paper); ui.ink(g, o.red ? 3 : 2, o.red ? P.red : "rgba(43,42,39,.45)"); ui.num(g, text, 0, 1, { size, color: o.red ? P.red : P.ink }); g.restore(); return [w, h]; }
