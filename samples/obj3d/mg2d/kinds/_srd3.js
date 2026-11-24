// mg2d/kinds/_srd3.js - document-family helpers (paper sheets, greeked lines, sweeps, typing, barcode).
import { P, F, ease, seg, clamp, lerp, ui, rng, measure, wrap, circ } from "./_srd.js";
export { rng };
// greeked text rows (ink bars of seeded lengths) inside a paper sheet; u = reveal 0..1 row by row. returns bottom y
export function greek(g, x, y, w, rows, seed, u = 1, o = {}) { const r = rng(seed), gap = o.gap ?? 30; let yy = y; for (let i = 0; i < rows; i++) { const k = ease.out(clamp(u * rows - i, 0, 1)); const last = i === rows - 1, len = w * (last ? r.range(0.35, 0.7) : r.range(0.88, 1)); if (k > 0) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + len * k, yy); ui.ink(g, o.lw ?? 6, o.color ?? "rgba(43,42,39,.2)"); } yy += gap; } return yy; }
// paper sheet: card + subtle fold shadow + corner dog-ear
export function sheet(g, x, y, w, h, o = {}) { ui.card(g, x, y, w, h, { r: o.r ?? 8, rule: false, lift: o.lift ?? 1, fill: o.fill, fill2: o.fill2 }); if (o.ear !== false) { const c = Math.min(46, w * 0.08); g.save(); g.beginPath(); g.moveTo(x + w - c, y); g.lineTo(x + w, y + c); g.lineTo(x + w - c, y + c); g.closePath(); ui.fill(g, P.paper2); ui.ink(g, 2, "rgba(43,42,39,.35)"); g.restore(); } }
// highlight sweep behind a text span: u 0..1 left to right; red => red underline + faint red wash
export function sweep(g, x, y, w, h, u, red = false) { const k = ease.io(u); if (k <= 0) return; g.save(); g.beginPath(); g.rect(x, y, w * k, h); g.clip(); g.fillStyle = red ? "rgba(200,38,29,.16)" : "rgba(214,196,150,.55)"; ui.rr(g, x - 4, y, w + 8, h, 5); g.fill(); g.restore(); if (red) { g.beginPath(); g.moveTo(x, y + h + 2); g.lineTo(x + w * k, y + h + 2); ui.ink(g, 4, P.red); } }
// typing: the first n chars at speed cps starting at t0 (with caret while typing)
export const typed = (s, t, t0, cps = 20) => s.slice(0, clamp(Math.floor((t - t0) * cps), 0, s.length));
export const typing = (s, t, t0, cps = 20) => t >= t0 && (t - t0) * cps < s.length;
// seeded barcode bars
export function barcode(g, x, y, w, h, seed, u = 1) { const r = rng(seed); let xx = x; g.save(); g.fillStyle = P.ink; const lim = x + w * ease.io(u); while (xx < x + w) { const bw = r.pick([2, 2, 3, 4, 6]); if (xx < lim) g.fillRect(xx, y, Math.min(bw, lim - xx), h); xx += bw + r.pick([2, 3, 4, 5]); } g.restore(); }
// tick mark drawn progressively
export function tick(g, x, y, s, u, c = P.ink) { if (u <= 0) return; g.beginPath(); g.moveTo(x - s * 0.5, y); const k = u * 2; if (k <= 1) g.lineTo(lerp(x - s * 0.5, x - s * 0.15, k), lerp(y, y + s * 0.35, k)); else { g.lineTo(x - s * 0.15, y + s * 0.35); g.lineTo(lerp(x - s * 0.15, x + s * 0.6, k - 1), lerp(y + s * 0.35, y - s * 0.6, k - 1)); } ui.ink(g, 5, c); }
export { measure, wrap, circ };
