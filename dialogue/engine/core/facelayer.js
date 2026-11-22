// Cartoon face layer v2 (STYLE-GUIDE section 3): flat faceted polygons that ride the Head bone and are wrapped onto the head surface.
//  eyes: sclera + iris + highlight, skin lids (upper/lower), lash line when closed; brows: thick tapered bars; mouth: smooth arc strip
//  with dark interior, teeth and tongue; emotion presets blended 0.35 s (brows lead 80 ms); lip-sync from words.json at 11 Hz.
// Everything is a pure function of t. No outlines, no gradients, palette colours.
import { THREE } from "./lib.js";
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ---------- mouth parameters ----------
// w width scale, o opening (cm), s smile(+)/frown(-), p opening roundness (low = rounder), flat = flat upper lip, tooth = show teeth, skew = one-sided
const MD = { w: 1, o: 0.2, s: 0, p: 0.8, flat: 0, tooth: 0, skew: 0 };
const VIS = { rest: { w: 1, o: 0.22 }, small: { w: 0.95, o: 0.9 }, A: { w: 1.0, o: 2.4, p: 0.7, tooth: 0.6 }, O: { w: 0.55, o: 2.1, p: 0.45 }, E: { w: 1.18, o: 1.1, s: 0.35, tooth: 0.8 }, MBP: { w: 0.95, o: 0.04 } };
export const EMO = {
  neutral:   { m: { w: 1, o: .2, s: .05 },                                        up: 0,   lo: 0,   tilt: 0,   br: 0,   bi: 0,    bL: 0, bR: 0,   roll: 0,    nod: 0 },
  warm:      { m: { w: 1.1, o: .25, s: .95 },                                     up: .05, lo: .35, tilt: 0,   br: .35, bi: .25,  bL: 0, bR: 0,   roll: .04,  nod: 0 },
  amused:    { m: { w: 1.15, o: 1.0, s: 1.0, flat: .4, tooth: 1, skew: .3 },      up: .08, lo: .5,  tilt: 0,   br: .5,  bi: 0,    bL: 0, bR: .45, roll: -.06, nod: -.02 },
  laugh:     { m: { w: 1.25, o: 2.6, s: 1.1, flat: .7, tooth: 1 },                up: .3,  lo: .9,  tilt: 0,   br: .55, bi: 0,    bL: 0, bR: 0,   roll: 0,    nod: -.07 },
  sad:       { m: { w: .9, o: .2, s: -.8 },                                       up: .45, lo: 0,   tilt: .9,  br: -.1, bi: 1.2,  bL: 0, bR: 0,   roll: .06,  nod: .1 },
  worried:   { m: { w: .85, o: .4, s: -.5 },                                      up: .18, lo: 0,   tilt: .5,  br: .35, bi: 1.1,  bL: 0, bR: 0,   roll: -.05, nod: .02 },
  surprised: { m: { w: .55, o: 2.1, s: 0, p: .45 },                               up: -.6, lo: 0,   tilt: 0,   br: 1.2, bi: 0,    bL: 0, bR: 0,   roll: 0,    nod: -.05 },
  thinking:  { m: { w: .8, o: .2, s: .1, skew: .8 },                              up: .22, lo: .1,  tilt: 0,   br: .15, bi: -.2,  bL: 0, bR: .9, roll: .08,  nod: -.02 },
  firm:      { m: { w: 1, o: .1, s: -.2 },                                        up: .2,  lo: .1,  tilt: -.7, br: -.1, bi: -1.3, bL: 0, bR: 0,   roll: 0,    nod: .03 },
  tender:    { m: { w: 1.05, o: .25, s: .6 },                                     up: .38, lo: .2,  tilt: .3,  br: .1,  bi: .6,   bL: 0, bR: 0,   roll: .06,  nod: .04 },
  // cloud episode (2026-11-10): blends of the same mouth / lid / brow parts
  curious:   { m: { w: .88, o: .55, s: .3, p: .6 },                               up: -.18, lo: .08, tilt: 0,  br: .75, bi: .25,  bL: 0, bR: 0,   roll: .08,  nod: -.03 },
  confused:  { m: { w: .85, o: .3, s: -.25, skew: .7 },                           up: .12, lo: .12, tilt: 0,   br: .05, bi: -.35, bL: .95, bR: -.2, roll: .12, nod: 0 },   // one brow up
  grin:      { m: { w: 1.32, o: 1.0, s: 1.25, flat: .65, tooth: 1 },             up: .1,  lo: .65, tilt: 0,   br: .4,  bi: .05,  bL: 0, bR: 0,   roll: .05,  nod: -.03 },
  proud:     { m: { w: 1.1, o: .2, s: .8 },                                       up: .3,  lo: .3,  tilt: 0,   br: .25, bi: -.1,  bL: 0, bR: 0,   roll: .03,  nod: -.09 },  // chin up
  dry:       { m: { w: .95, o: .15, s: .45, skew: .95 },                          up: .34, lo: .15, tilt: 0,   br: -.05, bi: -.2, bL: .85, bR: -.1, roll: .07, nod: .02 },   // one brow up + side smile
  impressed: { m: { w: .85, o: 1.4, s: .6, p: .55, tooth: .3 },                   up: -.35, lo: .15, tilt: 0,  br: 1.0, bi: .1,   bL: 0, bR: 0,   roll: 0,    nod: -.04 },  // surprised-light + smile
  relieved:  { m: { w: 1.1, o: .3, s: .8 },                                       up: .12, lo: .3,  tilt: 0,   br: .3,  bi: .4,   bL: 0, bR: 0,   roll: .04,  nod: .03 },
  firm_light:{ m: { w: 1, o: .15, s: .05 },                                       up: .1,  lo: .05, tilt: -.35, br: -.05, bi: -.65, bL: 0, bR: 0,  roll: 0,    nod: .015 },
};
export const EMO_NAMES = Object.keys(EMO);
const withMD = m => ({ ...MD, ...m });
const lerpEmo = (A, B, k) => { const o = { m: {} }; for (const key of ["up", "lo", "tilt", "br", "bi", "bL", "bR", "roll", "nod"]) o[key] = lerp(A[key], B[key], k); const a = withMD(A.m), b = withMD(B.m); for (const n of Object.keys(MD)) o.m[n] = lerp(a[n], b[n], k); return o; };
// timeline entries [t, preset] or [t, preset, weight] (weight blends the preset from neutral)
const emoOf = e => { const P = EMO[e[1]]; if (!P) throw new Error("unknown face preset " + e[1]); return e[2] == null || e[2] === 1 ? P : lerpEmo(EMO.neutral, P, e[2]); };
export function emoAt(timeline, t) { let i = 0; while (i + 1 < timeline.length && timeline[i + 1][0] <= t) i++; const cur = emoOf(timeline[i]), prev = emoOf(timeline[Math.max(0, i - 1)]); return lerpEmo(prev, cur, i === 0 ? 1 : sstep(0, 0.35, t - timeline[i][0])); }
export function presetAt(timeline, t) { let i = 0; while (i + 1 < timeline.length && timeline[i + 1][0] <= t) i++; return { name: timeline[i][1], w: timeline[i][2] ?? 1, since: timeline[i][0] }; }
export function emoDist(a, b) { let d = 0; for (const k of ["up", "lo", "tilt", "br", "bi", "bL", "bR"]) d += (a[k] - b[k]) ** 2; const ma = withMD(a.m), mb = withMD(b.m); for (const k of ["w", "o", "s", "skew"]) d += (ma[k] - mb[k]) ** 2; return Math.sqrt(d); }
export const emoPreset = (name, w = 1) => emoOf([0, name, w]);
export function emotionState(timeline, t) { const a = emoAt(timeline, t), b = emoAt(timeline, t + 0.08); return { ...a, br: b.br, bi: b.bi, bL: b.bL, bR: b.bR }; } // brows lead by 80 ms

// ---------- lip-sync: words -> letter tokens -> visemes sampled at ~11 Hz, smoothed ----------
const VOW = { a: "A", e: "E", i: "E", o: "O", u: "O", y: "E" };
export function buildLipsync(words) {
  const ev = [];
  for (const w of words) {
    const letters = w.w.toLowerCase().replace(/[^a-z0-9]/g, ""); if (!letters) continue; const toks = [];
    for (const ch of letters) { if (VOW[ch]) toks.push({ v: VOW[ch], wt: 2 }); else if ("bmp".includes(ch)) toks.push({ v: "MBP", wt: 1 }); else if ("fvw".includes(ch)) toks.push({ v: ch === "w" ? "O" : "small", wt: 1 }); else if (/[0-9]/.test(ch)) toks.push({ v: "E", wt: 1.5 }); else if (!toks.length || toks[toks.length - 1].v !== "small") toks.push({ v: "small", wt: .6 }); }
    const tot = toks.reduce((a, b) => a + b.wt, 0); let t = w.s; const dur = (w.e - w.s) * 0.92;
    for (const k of toks) { const d = dur * k.wt / tot; ev.push({ s: t, e: t + d, v: k.v, amp: w.stress ? 1.0 : 0.7 }); t += d; }
  }
  const HZ = 11;
  const sample = k => { const t = k / HZ + 0.5 / HZ; const e = ev.find(x => t >= x.s && t < x.e); return e ? { v: e.v, amp: e.amp * (0.82 + 0.18 * Math.sin(k * 2.3)) } : { v: "rest", amp: 0 }; };
  return function lipAt(t) { const x = t * HZ - 0.5, k0 = Math.floor(x), f = sstep(0, 1, x - k0); const a = sample(k0), b = sample(k0 + 1); const w = { A: 0, O: 0, E: 0, MBP: 0, small: 0, rest: 0 }; w[a.v] += 1 - f; w[b.v] += f; return { w, speak: Math.min(1, (a.v === "rest" ? 0 : 1 - f) + (b.v === "rest" ? 0 : f)), amp: lerp(a.amp, b.amp, f) }; };
}
function mouthParams(st) {
  const m = withMD(st.m); const L = st.lip; if (!L || L.speak < 0.01) return { ...m, jaw: 0 };
  const v = { w: 0, o: 0, s: 0, p: 0, flat: 0, tooth: 0 }; for (const [n, wt] of Object.entries(L.w)) { if (wt <= 0) continue; const S = { ...MD, ...VIS[n] }; const open = n === "MBP" || n === "rest" ? 1 : 0.35 + 0.65 * L.amp; v.w += S.w * wt; v.o += S.o * wt * open; v.s += S.s * wt; v.p += S.p * wt; v.tooth += S.tooth * wt; }
  const k = L.speak; return { w: lerp(m.w, v.w * (0.5 + 0.5 * m.w), k), o: lerp(m.o, v.o, k), s: lerp(m.s, m.s * 0.55 + v.s, k), p: lerp(m.p, v.p, k), flat: m.flat * (1 - k), tooth: Math.max(m.tooth * (1 - k), v.tooth * k), skew: m.skew * (1 - k * 0.5), jaw: k * Math.min(1, v.o / 2.4) };
}

// ---------- the layer ----------
export function makeFaceLayer(ch, { skin = "#9a7a66", browCol = null, beard = false, mouthDrop = 0.082, scale = 1 } = {}) {
  if (!browCol) { const bn = ch.cfg.faceParts.browsCarve ? ch.cfg.faceParts.browsCarve.fromMaterial : ch.cfg.faceParts.brows; browCol = ch.cfg.colors[bn] ?? "#2A1A10"; }
  const face = ch.face; const E = face.E.cl; const eyeY = (E[0].cy + E[1].cy) / 2;
  face.eyeMesh.visible = false; face.browMesh.visible = false; // the original black-square eyes / brows are replaced by the layer
  const sk = ch.heads.find(m => m.skeleton)?.skeleton ?? ch.skel; const headBone = ch.bones["Head"]; const bi = sk.bones.indexOf(headBone);
  const refMesh = ch.heads.find(m => m.isSkinnedMesh); const M = new THREE.Matrix4().multiplyMatrices(sk.boneInverses[bi], refMesh.bindMatrix);
  const TRI = []; for (const m of ch.heads) { if (!m.visible) continue; const g = m.geometry, p = g.attributes.position, ix = g.index ? g.index.array : null, n = ix ? ix.length : p.count; for (let i = 0; i < n; i += 3) { const a = ix ? ix[i] : i, b = ix ? ix[i + 1] : i + 1, c = ix ? ix[i + 2] : i + 2; TRI.push(p.getX(a), p.getY(a), p.getZ(a), p.getX(b), p.getY(b), p.getZ(b), p.getX(c), p.getY(c), p.getZ(c)); } }
  // spatial grid over the head triangles (xy cells of 1 cm) so the surface lookup is cheap per frame
  const CS = 0.01, grid = new Map(); const gk = (i, j) => i * 4096 + j + 2048 * 4096; for (let t = 0; t < TRI.length; t += 9) { const xs = [TRI[t], TRI[t + 3], TRI[t + 6]], ys = [TRI[t + 1], TRI[t + 4], TRI[t + 7]]; const i0 = Math.floor(Math.min(...xs) / CS), i1 = Math.floor(Math.max(...xs) / CS), j0 = Math.floor(Math.min(...ys) / CS), j1 = Math.floor(Math.max(...ys) / CS); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = gk(i, j); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(t); } }
  const zAt = (x, y) => { let z = -1; const l = grid.get(gk(Math.floor(x / CS), Math.floor(y / CS))); if (!l) return 0.15; for (const i of l) { const x0 = TRI[i], y0 = TRI[i + 1], x1 = TRI[i + 3], y1 = TRI[i + 4], x2 = TRI[i + 6], y2 = TRI[i + 7]; const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2); if (Math.abs(d) < 1e-12) continue; const l0 = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d, l1 = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d, l2 = 1 - l0 - l1; if (l0 < -1e-6 || l1 < -1e-6 || l2 < -1e-6) continue; const zz = l0 * TRI[i + 2] + l1 * TRI[i + 5] + l2 * TRI[i + 8]; if (zz > z) z = zz; } return z < 0 ? 0.15 : z; };
  const gm = ch.heads.find(x => x.material.gradientMap)?.material.gradientMap ?? null;
  const mkMat = (c, off) => { const m = new THREE.MeshToonMaterial({ color: c, polygonOffset: true, polygonOffsetFactor: -off, polygonOffsetUnits: -off }); m.flatShading = true; m.gradientMap = gm; return m; };
  class Batch { constructor(color, off, max = 1500) { this.n = 0; this.max = max; this.pos = new Float32Array(max * 3); this.g = new THREE.BufferGeometry(); this.g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3)); this.mesh = new THREE.Mesh(this.g, mkMat(color, off)); this.mesh.frustumCulled = false; this.mesh.castShadow = false; headBone.add(this.mesh); }
    reset() { this.n = 0; } v(x, y, lz) { const z = zAt(x, y) + 0.0022 + lz; const p = new THREE.Vector3(x, y, z).applyMatrix4(M); return p; }
    tri(a, b, c, lz = 0) { if (this.n + 3 > this.max) return; for (const q of [this.v(a[0], a[1], lz), this.v(b[0], b[1], lz), this.v(c[0], c[1], lz)]) { this.pos[this.n * 3] = q.x; this.pos[this.n * 3 + 1] = q.y; this.pos[this.n * 3 + 2] = q.z; this.n++; } }
    flush() { this.g.setDrawRange(0, this.n); this.g.attributes.position.needsUpdate = true; this.g.computeVertexNormals(); } }
  const B = { sclera: new Batch("#E9E2D2", 2, 200), iris: new Batch("#2A1B14", 3, 200), hi: new Batch("#F3ECDC", 4, 60), skin: new Batch(skin, 5, 400), lash: new Batch("#1D1310", 6, 200), brow: new Batch(browCol ?? "#2A1A10", 7, 200),
    mouth: new Batch("#2A1210", 2, 400), teeth: new Batch("#EFE6D4", 3, 200), tongue: new Batch("#B0645A", 3, 200) };
  const mouthTop = eyeY - mouthDrop;
  // beard follows the jaw (dadu)
  let bs = null; if (beard) { const hair = ch.heads.find(m => /Hair_White|Hair/.test(m.material.name) && m.name !== "BrowsCarved"); if (hair) { const p = hair.geometry.attributes.position, orig = p.array.slice(), idx = [], wts = []; for (let i = 0; i < p.count; i++) { const x = orig[i * 3], y = orig[i * 3 + 1], z = orig[i * 3 + 2]; if (Math.abs(x) < 0.09 && z > 0.0 && y < mouthTop - 0.02) { idx.push(i); wts.push(sstep(mouthTop - 0.02, mouthTop - 0.08, y)); } } bs = { p, orig, idx, wts }; } }
  const ell = (b, cx, cy, hw, hh, n, lz) => { for (let i = 0; i < n; i++) { const a0 = 2 * Math.PI * i / n, a1 = 2 * Math.PI * (i + 1) / n; b.tri([cx, cy], [cx + hw * Math.cos(a0), cy + hh * Math.sin(a0)], [cx + hw * Math.cos(a1), cy + hh * Math.sin(a1)], lz); } };
  const strip = (b, top, bot, lz) => { for (let j = 0; j < top.length - 1; j++) { b.tri(top[j], bot[j], top[j + 1], lz); b.tri(top[j + 1], bot[j], bot[j + 1], lz); } };
  return {
    eyeY, mouthTop,
    // st: {m:{...}, lip, up, lo, tilt, br, bi, bL, bR, blink, gx, gy}
    apply(st) {
      for (const b of Object.values(B)) b.reset();
      const up = st.up ?? 0, lo = st.lo ?? 0, tilt = st.tilt ?? 0, blink = st.blink ?? 0, widen = Math.max(0, -up);
      // ----- eyes -----
      for (let k = 0; k < 2; k++) {
        const c = E[k], side = c.cx >= 0 ? 1 : -1, cx = c.cx, cy = c.cy, hw = 0.0185 * scale, hh = 0.0125 * scale * (1 + widen * 0.5);
        ell(B.sclera, cx, cy, hw, hh, 10, 0);
        const iw = 0.0088 * scale, ih = 0.0098 * scale * (1 + widen * 0.15); const ix = cx + clamp((st.gx ?? 0) * 0.95, -(hw - iw) * 0.9, (hw - iw) * 0.9), iy = cy + clamp((st.gy ?? 0) * 0.9, -(hh - ih * 0.6) * 0.8, (hh - ih * 0.6) * 0.8);
        ell(B.iris, ix, iy, iw, ih, 8, 0.0004);
        const hx = ix - iw * 0.35, hy = iy + ih * 0.4, hs = 0.0028; B.hi.tri([hx - hs, hy - hs], [hx + hs, hy - hs], [hx + hs, hy + hs], 0.0008); B.hi.tri([hx - hs, hy - hs], [hx + hs, hy + hs], [hx - hs, hy + hs], 0.0008);
        // upper lid: rest cover .1 + preset + blink
        const cover = clamp(0.1 + Math.max(0, up) + blink * 1.0, 0, 1.08), yTop = cy + hh * 1.0 + 0.012;
        if (cover > 0.04) {
          const topP = [], botP = []; for (let j = 0; j < 7; j++) { const u = j / 3 - 1, x = cx + hw * 1.04 * u; const outer = side * u; const yb = (cy + hh) - cover * 2 * hh - 0.0035 * cover * (1 - u * u) * 0 - tilt * 0.0065 * outer * Math.min(1, cover * 3) + 0.0035 * (1 - u * u) * 0; topP.push([x, yTop]); botP.push([x, yb - 0.003 * (1 - u * u) * cover]); }
          strip(B.skin, topP, botP, 0.0012);
          if (cover > 0.42) { const lb = botP.map(p => [p[0], p[1] - 0.0034]); strip(B.lash, botP, lb, 0.0016); }
        }
        // lower lid pushes up (smile / squint)
        if (lo > 0.03) { const topP = [], botP = []; for (let j = 0; j < 7; j++) { const u = j / 3 - 1, x = cx + hw * 1.04 * u; topP.push([x, (cy - hh) + lo * hh * 1.5 * (1 - 0.45 * u * u)]); botP.push([x, cy - hh - 0.012]); } strip(B.skin, topP, botP, 0.0012); }
        // brow: thick tapered bar, rotated about its centre
        const raise = (st.br ?? 0) + (side > 0 ? (st.bL ?? 0) : (st.bR ?? 0)); const bx = cx - side * 0.002, by = cy + hh + 0.024 + raise * 0.016 + (widen * 0.004), th = -side * (st.bi ?? 0) * 0.4 + side * tilt * 0.12 * 0, L = 0.027 * scale, t = 0.0115 * scale;
        const pts = [[-L, -t * .5], [-L, t * .5], [-L * .3, t * .8], [L * .5, t * .7], [L, t * .1], [L, -t * .4], [L * .2, -t * .6]]; // inner end is at -x for side>0 ; mirror for side<0
        const cs = Math.cos(th), sn = Math.sin(th); const Q = pts.map(([x, y]) => { const xx = x * -side * -1 * (side > 0 ? 1 : -1); const x2 = (side > 0 ? x : -x); return [bx + x2 * cs - y * sn, by + x2 * sn + y * cs]; });
        for (let i = 0; i < Q.length; i++) B.brow.tri([bx, by], Q[i], Q[(i + 1) % Q.length], 0);
      }
      // ----- mouth: smooth arc strip, anchored at the upper lip (jaw drops) -----
      const m = mouthParams(st); const N = 13, cm = 0.0125 * scale, hwM = 3.0 * cm * m.w; const upP = [], loP = []; const t0 = 0.26;
      for (let i = 0; i < N; i++) {
        const u = -1 + 2 * i / (N - 1), x = u * hwM + m.skew * 0.005; const cc = (m.s * (u * u - 0.3) + m.skew * 0.5 * u) * cm * 0.8; const cu = cc * (1 - 0.7 * m.flat);
        const g = (t0 + m.o * Math.pow(Math.max(0, 1 - u * u), m.p)) * cm * 1.25; upP.push([x, mouthTop + cu]); loP.push([x, mouthTop + cc - g]);
      }
      strip(B.mouth, upP, loP, 0);
      const gC = m.o;
      if (m.tooth > 0.1 && gC > 0.8) { const tU = [], tL = []; for (let i = 2; i < N - 2; i++) { tU.push([upP[i][0] * 0.92, upP[i][1] - 0.0004]); tL.push([upP[i][0] * 0.92, upP[i][1] - Math.min(0.0055, (upP[i][1] - loP[i][1]) * 0.45) * m.tooth]); } strip(B.teeth, tU, tL, 0.0005); }
      if (gC > 1.4) { const tU = [], tL = []; for (let i = 3; i < N - 3; i++) { const h = (upP[i][1] - loP[i][1]); tU.push([upP[i][0] * 0.8, loP[i][1] + h * 0.42]); tL.push([upP[i][0] * 0.8, loP[i][1] + 0.0006]); } strip(B.tongue, tU, tL, 0.0005); }
      for (const b of Object.values(B)) b.flush();
      if (bs) { const jaw = m.jaw ?? 0; const a = bs.p.array; for (let j = 0; j < bs.idx.length; j++) { const i = bs.idx[j]; a[i * 3 + 1] = bs.orig[i * 3 + 1] - jaw * 0.012 * bs.wts[j]; } bs.p.needsUpdate = true; }
    },
  };
}
