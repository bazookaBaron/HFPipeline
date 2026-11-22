// ISOKIT core: colourful iso MG kit for DIALOGUE (palette, colour maths, projection/camera, depth-sorted scene, SVG helpers).
// Pure string builders: no DOM, no clock, no randomness -> every frame is a pure function of its inputs (works in node and browser).
// Projection = hairline iso maths (MIT, (c) 2026 Lucas Marques; same formula as runtime/vendor/hairline/hl-geom.js proj()).
// It is an orthographic projection: rows r1=(c,-c,0), r2=(cK,cK,-ZF) are orthonormal, so a sphere projects to a circle of radius S*R
// and the unit view vector (towards the viewer) is D = r1 x r2 = (c*ZF, c*ZF, K). depth(p) = p.D (bigger = nearer = drawn later).

export const PAL = {
  bg0: '#100C30', bg1: '#1E1757', bg2: '#33268A',          // deep indigo background (edge -> centre)
  coral: '#FF6B6B', saffron: '#FFB547', sky: '#4CC9F0', violet: '#9B5DE5', cream: '#FFF4E0',
  mint: '#6FDDB8', mintLit: '#A6F0D2', teal: '#23A39A', tealDeep: '#17707A', soil: '#3A2F7A',
  shade: '#1A1245', ink: '#140F38', road: '#2C2A6B', panel: '#3B2F9E',
  ember: '#D65F2A',                                         // ONLY for "broken"
};
// ---- colour -------------------------------------------------------------------------------------------------------------------
const h2r = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
export const mix = (a, b, p) => { const A = h2r(a), B = h2r(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * p).toString(16).padStart(2, '0')).join(''); };
export const rgba = (hex, a) => { const [r, g, b] = h2r(hex); return `rgba(${r},${g},${b},${+a.toFixed(3)})`; };
// 3-tone shading: lit top, mid left (+y face), dark right (+x face); rim = thin highlight along the near top edges
export const tones = (base, o = {}) => ({ top: mix(base, PAL.cream, o.lit ?? .26), mid: base, dark: mix(base, PAL.shade, o.dark ?? .4), rim: mix(base, PAL.cream, .7) });
// ---- maths --------------------------------------------------------------------------------------------------------------------
export const clamp01 = x => Math.min(1, Math.max(0, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const f1 = v => (Math.round(v * 10) / 10).toString();
export const pt = p => f1(p[0]) + ',' + f1(p[1]);
export const poly = pts => 'M' + pts.map(pt).join('L') + 'Z';
export const line = pts => 'M' + pts.map(pt).join('L');
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len3 = a => Math.sqrt(dot3(a, a));
export const norm3 = a => mul3(a, 1 / (len3(a) || 1));
export function hull(ps) {   // monotone-chain convex hull of screen points
  const p = ps.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
// deterministic pseudo-random (LCG) for stars, tufts, window patterns
export const rng = seed => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

// ---- view: camera + projection ------------------------------------------------------------------------------------------------
// makeView({W,H,S,cam:{x,y,z,zoom},cx,cy,K}) -> {P(x,y,z)->[sx,sy], dep(p), s (px per unit), D, K, W, H, ...}
export function makeView(o) {
  const K = o.K ?? .55, ZF = Math.sqrt(1 - K * K), CA = Math.SQRT1_2, cam = { x: 0, y: 0, z: 0, zoom: 1, ...(o.cam || {}) }, s = o.S * cam.zoom;
  const raw = (x, y, z) => [s * (x - y) * CA, s * ((x + y) * CA * K - z * ZF)], o0 = raw(cam.x, cam.y, cam.z), cx = o.cx ?? o.W / 2, cy = o.cy ?? o.H / 2;
  const P = (x, y, z = 0) => { if (Array.isArray(x)) [x, y, z] = x; const q = raw(x, y, z); return [cx + q[0] - o0[0], cy + q[1] - o0[1]]; };
  const D = [CA * ZF, CA * ZF, K];
  return { P, s, K, ZF, D, W: o.W, H: o.H, px: o.px ?? 1, dep: (x, y, z = 0) => Array.isArray(x) ? dot3(x, D) : x * D[0] + y * D[1] + z * D[2], cam };
}
// fit: pick S + camera target so a set of world points (with optional world radius) fills the view box with margins
export function fitView({ W, H, pts, margin = [.08, .1, .08, .1], K = .55, zoom = 1, box }) {
  const v = makeView({ W, H, S: 1, K, cx: 0, cy: 0 }); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const q of pts) { const p = v.P(q[0], q[1], q[2]), r = q[3] || 0; x0 = Math.min(x0, p[0] - r); x1 = Math.max(x1, p[0] + r); y0 = Math.min(y0, p[1] - r); y1 = Math.max(y1, p[1] + r); }
  const bx = box || { x: W * margin[3], y: H * margin[0], w: W * (1 - margin[1] - margin[3]), h: H * (1 - margin[0] - margin[2]) };
  const S = Math.min(bx.w / (x1 - x0), bx.h / (y1 - y0)) * zoom, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  return makeView({ W, H, S, K, cx: bx.x + bx.w / 2 - mx * S, cy: bx.y + bx.h / 2 - my * S, px: o_px(W, H) });
}
const o_px = (W, H) => W < 1200 ? .85 : 1;   // stroke/text scale: the 9:16 card is ~1000 px wide but read on a phone, so strokes stay near full weight

// ---- scene: painter-sorted SVG fragments --------------------------------------------------------------------------------------
// Layers make translucent / ground things robust: 'ground' < 'floor' < 'world' (depth-sorted) < 'air' < 'fx' < 'hud'
const LAYERS = { sky: 0, ground: 1, floor: 2, world: 3, air: 4, fx: 5, top: 6, hud: 7 };
export function createScene(V) {
  const items = [], defs = []; let uid = 0;
  const sc = {
    V, defs,
    id: p => `${p || 'k'}${++uid}`,
    add(svg, depth = 0, layer = 'world') { items.push({ svg, depth, layer: LAYERS[layer] ?? 3, n: items.length }); return sc; },
    def(s) { defs.push(s); return sc; },
    svg() {
      items.sort((a, b) => a.layer - b.layer || a.depth - b.depth || a.n - b.n);
      return `<defs>${GLOBAL_DEFS}${defs.join('')}</defs>` + items.map(i => i.svg).join('');
    },
  };
  return sc;
}
// glow: ONLY for signal emitters (pulses, beams, emitter dots)
export const GLOBAL_DEFS = `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
  + `<filter id="glow2" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
export const P = (V, p) => V.P(p[0], p[1], p[2]);
