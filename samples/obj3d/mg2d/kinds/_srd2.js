// mg2d/kinds/_srd2.js - more shared helpers for the space / relations / documents families (colour, boxes, placement, tidy tree).
import { clamp, lerp, ui, P, F, ease, seg } from "./_srd.js";
export const TAU = Math.PI * 2;
const hx3 = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
export const mixc = (a, b, t) => { const A = hx3(a), B = hx3(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, "0")).join(""); };
export const niceStepN = v => { const e = 10 ** Math.floor(Math.log10(v)), m = v / e; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * e; };
export const bboxPts = pts => pts.reduce((a, q) => [Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.max(a[2], q[0]), Math.max(a[3], q[1])], [1e9, 1e9, -1e9, -1e9]);
// focus box around a bbox, padded and clamped into [0,W]x[0,H] with a minimum size
export function focusBox(b, W, H, minW = 1000, minH = 620, pad = 150) { const w = Math.min(W, Math.max(minW, b[2] - b[0] + pad * 2)), h = Math.min(H, Math.max(minH, b[3] - b[1] + pad * 1.6)); return { x: clamp((b[0] + b[2]) / 2 - w / 2, 0, W - w), y: clamp((b[1] + b[3]) / 2 - h / 2, 0, H - h), w, h }; }
// greedy rect placement around an anchor: rings of radii x 16 angles, avoiding `taken` rects (pushed on success), bounds [0,W]x[0,H]. returns {x,y} centre
export function placeBox(ax, ay, bw, bh, taken, W, H, avoid = [], radii = [0, 70, 130, 200, 280, 360]) { let best = null; const hit = (a, b) => a.x < b.x + b.w + 10 && a.x + a.w + 10 > b.x && a.y < b.y + b.h + 10 && a.y + a.h + 10 > b.y;
  for (const rr of radii) for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, cx = ax + Math.cos(a) * (rr + bw * 0.5 * Math.abs(Math.cos(a)) + (rr ? 40 : 0)), cy = ay + Math.sin(a) * (rr + bh * 0.5 * Math.abs(Math.sin(a)) + (rr ? 40 : 0)); const bx = { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh }; let cost = rr * 0.4;
    if (bx.x < 10 || bx.y < 10 || bx.x + bw > W - 10 || bx.y + bh > H - 10) cost += 5000; for (const q of taken) if (hit(bx, q)) cost += 800; for (const p of avoid) if (p[0] > bx.x - 20 && p[0] < bx.x + bw + 20 && p[1] > bx.y - 20 && p[1] < bx.y + bh + 20) cost += 400; if (!best || cost < best.cost) best = { cost, x: cx, y: cy }; }
  taken.push({ x: best.x - bw / 2, y: best.y - bh / 2, w: bw, h: bh }); return best; }
// tidy layered tree layout: node {children:[]} -> assigns depth, y (leaf-spaced, parents centred). returns {nodes, maxDepth, leaves}
export function layoutTree(root) { const nodes = []; let leaf = 0, maxD = 0; (function go(n, d) { n._d = d; maxD = Math.max(maxD, d); nodes.push(n); const ch = n.children ?? []; if (!ch.length) { n._y = leaf++; return; } ch.forEach(c => go(c, d + 1)); n._y = (ch[0]._y + ch[ch.length - 1]._y) / 2; })(root, 0); return { nodes, maxD, leaves: leaf }; }
// ink progress line along a straight segment (u 0..1)
export function seg2(g, x0, y0, x1, y1, u, w = 3, c = P.ink, dash) { if (u <= 0) return; g.beginPath(); g.moveTo(x0, y0); g.lineTo(lerp(x0, x1, u), lerp(y0, y1, u)); if (dash) g.setLineDash(dash); ui.ink(g, w, c); g.setLineDash([]); }
