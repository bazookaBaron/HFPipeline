/* Sketch geometry: expands scene elements (board px) into draw ops for p5.brush + reveal geometry.
 * Pure + deterministic (seeded mulberry32). Shared by bake.js; no DOM. */
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const r2 = (n) => Math.round(n * 100) / 100;

// Catmull-Rom through control points -> dense polyline (step px)
function smooth(pts, step = 5, closed = false) {
  if (pts.length < 3) return densify(pts, step);
  const P = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  const out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(2, Math.ceil(L / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(closed ? P[P.length - 2] : pts[pts.length - 1]);
  return out;
}
function densify(pts, step = 5) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const plen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
const pathD = (pts) => "M" + pts.map((p) => r2(p[0]) + " " + r2(p[1])).join("L");
// hand wobble: perpendicular low-frequency offset, seeded
function wobble(pts, amp, rnd) {
  if (!amp) return pts;
  const ph1 = rnd() * 6.28, ph2 = rnd() * 6.28, L = plen(pts); let s = 0;
  return pts.map((p, i) => {
    if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
    const u = s / (L || 1), o = amp * (Math.sin(u * 6.28 * 1.3 + ph1) * 0.6 + Math.sin(u * 6.28 * 3.1 + ph2) * 0.4);
    return [p[0] - dy / m * o, p[1] + dx / m * o];
  });
}
function ellipse(cx, cy, rx, ry, a0, sweep, irr, rnd, step = 5) {
  const n = Math.max(24, Math.ceil(Math.abs(sweep) * Math.max(rx, ry) / step)), k1 = rnd() * 6.28, k2 = rnd() * 6.28, out = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + sweep * i / n, f = 1 + irr * (0.06 * Math.sin(2 * t + k1) + 0.03 * Math.sin(3 * t + k2)) + irr * 0.04 * (i / n);
    out.push([cx + Math.cos(t) * rx * f, cy + Math.sin(t) * ry * f]);
  }
  return out;
}
// pressure profile: taper in/out
const press = (pts, a = 0.75, b = 0.8) => pts.map((p, i) => { const u = i / (pts.length - 1 || 1); return [r2(p[0]), r2(p[1]), r2(Math.min(1, a + (1 - a) * Math.min(1, u * 6)) * Math.min(1, b + (1 - b) * Math.min(1, (1 - u) * 6)))]; });

/* expand(el, theme) -> { ops:[...], reveal:{...}, color } */
function expand(el, T) {
  const rnd = mulberry((el.seed || 1) * 9973 + 17), color = T[el.colorToken || "ink"];
  const brush = el.brush || "pen", weight = el.weight || 1, W = el.revealW || 0; // W: reveal mask width override
  const strokes = []; // polylines in draw order
  const g = el;
  switch (el.kind) {
    case "line": strokes.push(wobble(densify([g.a, g.b]), g.wob ?? 2, rnd)); break;
    case "spline": strokes.push(wobble(smooth(g.pts, 5, g.closed), g.wob ?? 1.5, rnd)); break;
    case "polygon": strokes.push(wobble(densify([...g.pts, g.pts[0], lerp(g.pts[0], g.pts[1], 0.06)]), g.wob ?? 2, rnd)); break;
    case "rect": {
      const { x, y, w, h } = g, j = () => (rnd() - 0.5) * 6;
      const c = [[x + j(), y + j()], [x + w + j(), y + j()], [x + w + j(), y + h + j()], [x + j(), y + h + j()]];
      strokes.push(wobble(densify([[c[0][0] - 8, c[0][1] + 2], c[1], c[2], c[3], c[0], [c[0][0] + 14, c[0][1] - 3]]), g.wob ?? 2.2, rnd)); break;
    }
    case "circle": { const a0 = g.a0 ?? -2.2; strokes.push(ellipse(g.cx, g.cy, g.r, g.ry || g.r, a0, 6.28 + (g.over ?? 0.35), g.irr ?? 1, rnd)); break; }
    case "ring": { const a0 = g.a0 ?? -2.6; strokes.push(ellipse(g.cx, g.cy, g.rx, g.ry, a0, 6.28 + 0.6, 1.6, rnd)); break; }
    case "underline": { const p = []; for (let i = 0; i <= 8; i++) p.push([g.x1 + (g.x2 - g.x1) * i / 8, g.y + Math.sin(i * 1.7 + rnd()) * (g.wave ?? 3)]); strokes.push(smooth(p, 5)); break; }
    case "cross": { const { cx, cy, s } = g; strokes.push(wobble(densify([[cx - s, cy - s], [cx + s, cy + s * 1.05]]), 2, rnd)); strokes.push(wobble(densify([[cx + s * 1.02, cy - s * 0.95], [cx - s * 0.98, cy + s]]), 2, rnd)); break; }
    case "arrow": {
      const shaft = wobble(smooth(g.pts, 5), g.wob ?? 1.5, rnd); strokes.push(shaft);
      const e = shaft[shaft.length - 1], q = shaft[Math.max(0, shaft.length - 6)], ang = Math.atan2(e[1] - q[1], e[0] - q[0]), hs = g.head || 30;
      const L = [e[0] - Math.cos(ang - 0.5) * hs, e[1] - Math.sin(ang - 0.5) * hs], R = [e[0] - Math.cos(ang + 0.5) * hs, e[1] - Math.sin(ang + 0.5) * hs];
      strokes.push(densify([L, e, R])); break;
    }
  }
  const bw = el.bw || 6; // nominal visible ink width in board px (for reveal mask)
  if (el.kind === "hatch") {
    const xs = g.pts.map((p) => p[0]), ys = g.pts.map((p) => p[1]);
    return { color, ops: [{ op: "hatch", brush: brush, color, weight, dist: g.dist || 14, angle: g.angle ?? 45, pts: g.pts }],
      reveal: { type: "wipe", angle: (g.angle ?? 45) + 90, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)] } };
  }
  if (el.kind === "wash") {
    const pts = g.pts ? densify([...g.pts, g.pts[0]], 24).slice(0, -1) : ellipse(g.cx, g.cy, g.r, g.ry || g.r, 0, 6.28, 1, rnd, 12).slice(0, -1);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const r = Math.max(...pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy))) * 1.25;
    return { color, ops: [{ op: "wash", color, opacity: g.opacity ?? 150, bleed: g.bleed ?? 0.05, tex: g.tex ?? 0.35, pts: pts.map((p) => [r2(p[0]), r2(p[1])]) }],
      reveal: { type: "bloom", cx: r2(cx), cy: r2(cy), r: r2(r) } };
  }
  return {
    color,
    ops: strokes.map((s) => ({ op: "stroke", brush, color, weight, pts: press(s, el.pin ?? 0.7, el.pout ?? 0.75) })),
    reveal: { type: "stroke", w: W || Math.round(bw * 2.2 + (el.kind === "ring" || el.kind === "circle" ? 6 : 0)), strokes: strokes.map((s) => ({ d: pathD(s), len: r2(plen(s)) })) },
  };
}
function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
module.exports = { expand, smooth, densify, plen, pathD, mulberry };
