// shared helpers for the PROCESS + TIME kind families (no drawings, only small geometry/layout/text utilities)
import { P, F, W_INK, ease, seg, clamp, lerp, ui, rng as mk } from "../core.js"; import { SH } from "../shapes.js";
export { P, F, W_INK, ease, seg, clamp, lerp, ui, SH, mk };
export const TAU = Math.PI * 2;
// wrap words into lines of at most n characters
export function wrap(text, n = 14) { const out = []; let cur = ""; for (const w of String(text ?? "").split(/\s+/)) { if (cur && (cur + " " + w).length > n) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w; } if (cur) out.push(cur); return out.length ? out : [""]; }
// multi-line caption; font shrinks (never below F.small) when the longest line is wider than maxW. returns block height
export function lab(g, text, x, y, o = {}) { const size = o.size ?? F.small, maxW = o.maxW ?? 220, n = o.n ?? Math.max(6, Math.floor(maxW / (size * 0.62))), L = wrap(text, n), lh = size * 1.18, y0 = y - (L.length - 1) * lh / 2;
  L.forEach((s, i) => ui.caption(g, s, x, y0 + i * lh, { size, color: o.color ?? P.ink2, weight: o.weight ?? 700, align: o.align, spacing: 1.5, alpha: o.alpha, caps: o.caps })); return L.length * lh; }
// thing: any SH generator name, else semantic SH.icon word. o = { s, u, t, red, view ... }
export function thing(g, what, seed, o = {}) { const r = mk(seed); const f = typeof SH[what] === "function" && what !== "icon" ? SH[what] : null; return f ? f(g, r, { view: "side", ...o }) : SH.icon(g, r, { what, view: "side", ...o }); }
// vignette: soft ground shadow + pop-in scale + the thing. u in 0..1 = pop; q (default 1) = SH build reveal
export function vig(g, what, seed, x, y, s, u, t, o = {}) { if (u <= 0) return; ui.pop(g, u, x, y, () => thing(g, what, seed, { s, u: o.q ?? Math.min(1, u * 1.15), t, red: o.red })); }
// polyline helpers
export const plen = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
export function ppt(pts, u) { const L = plen(pts); let rem = clamp(u, 0, 1) * L; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (rem <= d || i === pts.length - 1) { const k = d ? Math.min(1, rem / d) : 0; return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k), Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])]; } rem -= d; } return [...pts[0], 0]; }
export function ppart(pts, u) { const L = plen(pts); let rem = clamp(u, 0, 1) * L; const out = [pts[0]]; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (rem >= d) { out.push(pts[i]); rem -= d; } else { const k = d ? rem / d : 0; out.push([lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]); break; } } return out; }
// rounded polyline stroke path (corner radius r)
export function rpath(g, pts, r = 30) { g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length - 1; i++) g.arcTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r); g.lineTo(...pts[pts.length - 1]); }
// outlined pipe/channel along pts, drawn up to u. c = inner colour
export function chan(g, pts, w, u = 1, c = P.stone, o = {}) { if (u <= 0) return; const q = u >= 1 ? pts : ppart(pts, u); if (q.length < 2) return; g.save(); rpath(g, q, o.r ?? 34); ui.ink(g, w + 7, P.ink); rpath(g, q, o.r ?? 34); ui.ink(g, w, c); if (o.shade !== false) { g.globalAlpha *= 0.55; rpath(g, q, o.r ?? 34); ui.ink(g, w * 0.3, "#fff"); } g.restore(); }
export function dot(g, x, y, r, c, ink = true) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = c; g.fill(); if (ink) ui.ink(g, 1.5, P.ink); }
export const num = (v) => { const a = Math.abs(v); return a >= 1e6 ? +(v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M" : a >= 1e4 ? Math.round(v / 1e3) + "k" : a >= 100 ? String(Math.round(v)) : String(+v.toFixed(1)); };
// faint grid-dot ground / measured baseline used by many kinds
export function baseline(g, x0, x1, y, u = 1, o = {}) { if (u <= 0) return; g.save(); g.beginPath(); g.moveTo(x0, y); g.lineTo(lerp(x0, x1, ease.io(u)), y); ui.ink(g, o.w ?? 2, o.color ?? P.hair); g.restore(); }
// numbered badge (step / index)
export function badge(g, n, x, y, o = {}) { const r = o.r ?? 24; g.save(); g.translate(x, y); ui.shadow(g, () => { g.beginPath(); g.arc(0, 0, r, 0, TAU); }, 2, 4); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = o.red ? P.red : P.ink; g.fill(); ui.caption(g, String(n), 0, 1, { size: r * 1.1, weight: 800, color: "#fff", caps: false, spacing: 0 }); g.restore(); }
// small paper card with an SH vignette + label under it. returns nothing. cell box centred at (x,y), width cw
export function vcard(g, o) { const { what, seed, x, y, cw, ch, u, t, label, red, s } = o; if (u <= 0) return; ui.pop(g, u, x, y, () => { ui.shadow(g, () => ui.rr(g, -cw / 2, -ch / 2, cw, ch, 12), 4, 8); ui.rr(g, -cw / 2, -ch / 2, cw, ch, 12); ui.fill(g, P.paper); ui.ink(g, red ? 3.5 : 2, red ? P.red : "rgba(43,42,39,.45)");
  g.save(); g.translate(0, label ? -ch * 0.1 : 0); thing(g, what, seed, { s: s ?? cw * 0.62, u: Math.min(1, u * 1.2), t, red }); g.restore(); if (label) lab(g, label, 0, ch * 0.34, { maxW: cw - 24, size: F.small, color: red ? P.redInk : P.ink2 }); }); }
export const clampN = (arr, a, b) => arr.slice(0, b);
export const at0 = (at, id, d = 0) => at?.[id] ?? d;
