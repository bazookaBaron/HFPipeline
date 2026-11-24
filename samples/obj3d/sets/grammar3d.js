// 3D SET GRAMMAR: procedural part generators for the white-miniature film engine. Everything is built from primitives at runtime
// (kit.js is reused where good). Units: 1 unit ~ 20 m. Land top = LAND_H, water level = 0. A generator is GEN[what](E, p) -> item:
//   { g: Group (origin = footprint centre, base y=0, forward = +x unless fw:'z'), r: footprint radius, len, wid, dom:'land'|'water'|'any', pad, anchors?, anim?, ... }
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as K from "../kit.js";

export const LAND_H = 0.8;
export function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function vnoise(seed) {
  const h = (i, j) => { let n = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed + 1, 1442695041); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  return (x, y) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1); return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv; };
}
export const fbm = (f, x, y, o = 4) => { let a = 0.5, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * f(x, y); n += a; x *= 2.03; y *= 2.03; a *= 0.5; } return s / n; };
export const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const MK = (M, KM) => ({ w: M.WHITE, g: KM.grey, d: KM.dark, s: M.SAND, l: M.GREY, k: M.DARK });
export const FOCUSMAP = (M, KM, KMR) => new Map([[M.WHITE, KMR.white], [KM.grey, KMR.grey], [KM.dark, KMR.dark], [M.SAND, KMR.white], [M.GREY, KMR.grey], [M.DARK, KMR.dark]]);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function prep(geo) { const g = geo.index ? geo.toNonIndexed() : geo; if (g.attributes.uv) g.deleteAttribute("uv"); return g; }
// Builder: collects geometry per material key (w white, g grey, d dark, s sand, l light grey, k dark grey), merges to <=6 meshes
export class Builder {
  constructor() { this.g = {}; }
  add(k, geo, x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) { const g = prep(geo); _e.set(rx, ry, rz, "YXZ"); _q.setFromEuler(_e);
    _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz)); g.applyMatrix4(_m); (this.g[k] ??= []).push(g); return this; }
  addM(k, geo, m) { const g = prep(geo); g.applyMatrix4(m); (this.g[k] ??= []).push(g); return this; }
  box(k, w, h, d, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) { return this.add(k, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, ry, 1, 1, 1, rx, rz); }
  cyl(k, rt, rb, h, x = 0, y = 0, z = 0, seg = 14) { return this.add(k, new THREE.CylinderGeometry(rt, rb, h, seg), x, y + h / 2, z); }
  cone(k, r, h, x = 0, y = 0, z = 0, seg = 8, ry = 0) { return this.add(k, new THREE.ConeGeometry(r, h, seg), x, y + h / 2, z, ry); }
  sph(k, r, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, seg = 10) { return this.add(k, new THREE.SphereGeometry(r, seg, Math.max(6, seg - 3)), x, y, z, 0, sx, sy, sz); }
  limb(k, a, b, r, seg = 6) { const d = new THREE.Vector3().subVectors(b, a), len = d.length(); if (len < 1e-5) return this; _q.setFromUnitVectors(UP, d.normalize());
    _m.compose(a.clone().add(b).multiplyScalar(0.5), _q, _s.set(1, 1, 1)); return this.addM(k, new THREE.CylinderGeometry(r, r, len, seg), _m.clone()); }
  prism(k, w, h, d, x = 0, y = 0, z = 0, ry = 0) { const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return this.add(k, g, x, y, z, ry); }
  hip(k, w, h, d, x = 0, y = 0, z = 0, ry = 0) { return this.add(k, new THREE.ConeGeometry(0.7071, h, 4), x, y + h / 2, z, ry + Math.PI / 4, w, 1, d); }
  merge(o, x = 0, y = 0, z = 0, ry = 0, s = 1) { for (const k in o.g) for (const g of o.g[k]) { const c = g.clone(); _e.set(0, ry, 0); _q.setFromEuler(_e); _m.compose(_v.set(x, y, z), _q, _s.set(s, s, s)); c.applyMatrix4(_m); (this.g[k] ??= []).push(c); } return this; }
  group(mk) { const G = new THREE.Group(); for (const k in this.g) { if (!this.g[k].length) continue; const m = new THREE.Mesh(mergeGeometries(this.g[k], false), mk[k]); m.castShadow = m.receiveShadow = true; G.add(m); } return G; }
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const pickOf = (rnd, a) => a[Math.floor(rnd() * a.length) % a.length];
const R = (rnd, a, b) => a + (b - a) * rnd();
const shadowAll = g => { g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; }); return g; };

// ============================== buildings ==============================
function windowsRow(b, rnd, w, d, floors, fh, y0, k = "d") {   // dark window bands/dots on the 4 faces
  for (let f = 0; f < floors; f++) { const y = y0 + f * fh + fh * 0.35;
    for (const s of [-1, 1]) { const n = Math.max(1, Math.floor(w / 0.75)); for (let i = 0; i < n; i++) if (rnd() > 0.1) b.box(k, 0.26, fh * 0.42, 0.04, -w / 2 + (i + 0.5) * w / n, y, s * d / 2);
      const m = Math.max(1, Math.floor(d / 0.75)); for (let i = 0; i < m; i++) if (rnd() > 0.1) b.box(k, 0.04, fh * 0.42, 0.26, s * w / 2, y, -d / 2 + (i + 0.5) * d / m); } } }
function house(E, p = {}) { const { rnd, MK } = E, b = new Builder(); const w = p.w ?? R(rnd, 1.8, 3), d = p.d ?? R(rnd, 1.6, 2.6), fl = p.floors ?? (rnd() < 0.3 ? 2 : 1), fh = 0.8, h = fl * fh, roof = p.roof ?? pickOf(rnd, ["gable", "gable", "hip", "flat"]);
  b.box(rnd() < 0.2 ? "s" : "w", w, h, d); const rh = R(rnd, 0.55, 0.9);
  if (roof === "gable") b.prism("g", w + 0.2, rh, d + 0.2, 0, h, 0, rnd() < 0.5 ? 0 : Math.PI / 2 * 0); else if (roof === "hip") b.hip("g", w + 0.25, rh, d + 0.25, 0, h, 0);
  else { b.box("l", w + 0.12, 0.08, d + 0.12, 0, h, 0); b.box("w", w * 0.3, 0.2, d * 0.3, R(rnd, -w / 4, w / 4), h + 0.08, R(rnd, -d / 4, d / 4)); }
  windowsRow(b, rnd, w, d, fl, fh, 0.05); b.box("d", 0.32, 0.55, 0.05, R(rnd, -w / 4, w / 4), 0, d / 2); if (rnd() < 0.35) b.box("g", 0.22, 0.6, 0.22, w * 0.25, h + rh * 0.4, 0);
  return { g: b.group(MK), r: Math.hypot(w, d) / 2, w, d, h: h + rh, pad: true, dom: "land", kind: "building" }; }
function tower(E, p = {}) { const { rnd, MK } = E, b = new Builder(); const fl = p.floors ?? Math.round(R(rnd, 8, 26)), fh = 0.44, w = p.w ?? R(rnd, 2.2, 3.6), d = p.d ?? R(rnd, 2.2, 3.6), style = p.style ?? pickOf(rnd, ["slab", "step", "cyl", "step"]);
  const podH = 1.1; b.box("l", w * 1.5, podH, d * 1.5); b.box("d", w * 1.5 + 0.04, 0.12, d * 1.5 + 0.04, 0, podH * 0.45); const H = fl * fh; let y = podH;
  const bands = (ww, dd, f0, f1, yy) => { for (let f = f0; f < f1; f++) { b.box("g", ww + 0.05, fh * 0.32, dd + 0.05, 0, yy + (f - f0) * fh + fh * 0.4, 0); } };
  if (style === "cyl") { const r = Math.min(w, d) * 0.52; b.cyl("w", r, r, H, 0, y, 0, 18); for (let f = 0; f < fl; f++) b.cyl("g", r + 0.03, r + 0.03, fh * 0.3, 0, y + f * fh + fh * 0.4, 0, 18); b.cyl("l", r * 1.05, r * 1.05, 0.14, 0, y + H, 0, 18); b.cyl("g", 0.05, 0.05, 2.4, 0, y + H, 0, 6); }
  else { const tiers = style === "step" ? 3 : 1; let ww = w, dd = d, f0 = 0; for (let t = 0; t < tiers; t++) { const n = t === tiers - 1 ? fl - f0 : Math.round(fl / tiers * (t === 0 ? 1.4 : 0.8)); const nn = Math.max(1, Math.min(n, fl - f0));
      b.box("w", ww, nn * fh, dd, 0, y, 0); bands(ww, dd, 0, nn, y); y += nn * fh; f0 += nn; ww *= 0.72; dd *= 0.72; if (f0 >= fl) break; } b.box("l", ww * 1.1, 0.16, dd * 1.1, 0, y, 0);
    b.box("g", ww * 0.6, 0.35, dd * 0.6, 0, y + 0.16, 0); if (rnd() < 0.7) b.cyl("g", 0.045, 0.045, R(rnd, 1.2, 3), 0, y + 0.5, 0, 6); }
  return { g: b.group(MK), r: Math.hypot(w, d) * 0.9, w, d, h: H + podH + 2, pad: true, dom: "land", kind: "building" }; }
function midrise(E, p = {}) { return tower(E, { floors: Math.round(R(E.rnd, 3, 8)), style: "slab", w: R(E.rnd, 2, 3.4), d: R(E.rnd, 2, 3.4), ...p }); }
function shed(E, p = {}) { const { rnd, MK } = E, b = new Builder(), w = p.w ?? R(rnd, 2, 3.4), d = p.d ?? R(rnd, 1.4, 2.4), h = R(rnd, 0.7, 1);
  b.box(pickOf(rnd, ["w", "w", "l"]), w, h, d); b.box("g", w + 0.15, 0.08, d + 0.15, 0, h, 0, 0, 0, 0.0); b.prism("g", d + 0.15, 0.3, w + 0.15, 0, h + 0.08, 0, Math.PI / 2);
  b.box("d", 0.8, 0.6, 0.05, 0, 0, d / 2); if (rnd() < 0.5) b.box("g", 0.4, 0.5, 0.4, w / 2 + 0.25, 0, 0);
  return { g: b.group(MK), r: Math.hypot(w, d) / 2 + 0.2, w, d, h: h + 0.4, pad: true, dom: "land", kind: "building" }; }
function warehouse(E, p = {}) { const { rnd, MK } = E, b = new Builder(), L = p.len ?? R(rnd, 8, 14), W = p.wid ?? R(rnd, 4, 6), h = R(rnd, 1.4, 2);
  b.box("w", L, h, W); b.prism("g", W + 0.3, 0.7, L + 0.3, 0, h, 0, Math.PI / 2); b.box("l", L + 0.2, 0.1, 0.2, 0, h - 0.1, W / 2 + 0.1);
  const n = Math.max(2, Math.floor(L / 2.6)); for (let i = 0; i < n; i++) { const x = -L / 2 + (i + 0.5) * L / n; b.box("d", 1.5, 1.2, 0.06, x, 0.02, W / 2); b.box("g", 1.7, 0.1, 0.1, x, 1.25, W / 2 + 0.04); if (rnd() < 0.5) b.box("w", 1.6, 0.55, 1.0, x, 0, W / 2 + 0.6); }
  for (let i = 0; i < 3; i++) b.box("g", 0.6, 0.35, 0.6, R(rnd, -L / 3, L / 3), h + 0.55, R(rnd, -0.8, 0.8)); b.box("l", L + 2.4, 0.08, W + 2.4, 0, -0.02);
  return { g: b.group(MK), r: Math.hypot(L, W) / 2 + 1, len: L, wid: W, h: h + 1.2, pad: true, dom: "land", kind: "building", ang90: true }; }
function factory(E, p = {}) { const { rnd, MK } = E, b = new Builder(), L = R(rnd, 9, 13), W = R(rnd, 5.5, 7.5), h = 2.1;
  b.box("w", L, h, W); const n = 5; for (let i = 0; i < n; i++) { b.prism("g", L / n, 0.75, W * 0.98, -L / 2 + (i + 0.5) * L / n, h, 0, 0); b.box("d", L / n * 0.55, 0.4, 0.05, -L / 2 + (i + 0.5) * L / n + 0.2, h + 0.22, W * 0.49); }
  b.box("l", 3.2, 2.8, 3, L / 2 + 1.6, 0, -W / 2 + 1.5); b.box("d", 3.24, 0.3, 3.04, L / 2 + 1.6, 1.4, -W / 2 + 1.5);
  const chim = []; for (let i = 0; i < 2; i++) { const x = -L / 2 + 1.5 + i * 1.8, z = -W / 2 - 1.2; b.cyl("l", 0.42, 0.62, 8.5 - i * 1.5, x, 0, z, 16); b.cyl("d", 0.46, 0.46, 0.25, x, 8.1 - i * 1.5, z, 16); chim.push(V(x, 8.6 - i * 1.5, z)); }
  b.cyl("g", 1.3, 1.3, 2.6, L / 2 - 1.5, 0, W / 2 + 1.8, 18); b.cyl("l", 1.2, 1.2, 0.2, L / 2 - 1.5, 2.6, W / 2 + 1.8, 18); for (let i = 0; i < 5; i++) b.cyl("d", 0.05, 0.05, 2.2, -L / 2 + 1 + i * 0.8, h, W / 2 + 0.02, 6);
  b.box("g", L - 1, 0.18, 0.18, 0, h + 0.1, W / 2 + 0.22); b.box("l", L + 3, 0.08, W + 4.5, 0, -0.02, -0.3);
  return { g: b.group(MK), r: Math.hypot(L, W) / 2 + 2, len: L, wid: W, h: 8.6, pad: true, dom: "land", kind: "building", smoke: chim, ang90: true }; }
function govHall(E, p = {}) { const { rnd, MK } = E, b = new Builder(), W = p.w ?? 9, D = 5.5, h = 2.6, n = 8;
  for (let i = 0; i < 4; i++) b.box("l", W + 3 - i * 0.5, 0.18, D + 3 - i * 0.5, 0, i * 0.18, 0); b.box("w", W, h, D, 0, 0.72, 0);
  for (let i = 0; i < n; i++) { const x = -W / 2 + 0.5 + i * (W - 1) / (n - 1); b.cyl("w", 0.19, 0.22, h, x, 0.72, D / 2 + 0.55, 12); b.box("l", 0.5, 0.1, 0.5, x, 0.72 + h, D / 2 + 0.55); b.box("l", 0.5, 0.1, 0.5, x, 0.72, D / 2 + 0.55); }
  b.box("l", W + 0.6, 0.28, 1.4, 0, 0.72 + h + 0.1, D / 2 + 0.5); b.prism("w", W + 0.7, 0.9, 1.5, 0, 0.72 + h + 0.38, D / 2 + 0.5, 0); b.add("w", new THREE.CylinderGeometry(0.01, 0.01, 0.01), 0, 0, 0);
  b.cyl("l", 1.7, 1.9, 0.9, 0, 0.72 + h, -0.6, 22); b.add("w", new THREE.SphereGeometry(1.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.72 + h + 0.9, -0.6); b.cyl("g", 0.04, 0.04, 1, 0, 0.72 + h + 2.4, -0.6, 6);
  for (const s of [-1, 1]) { b.box("w", 1.6, h * 0.85, D * 0.9, s * (W / 2 + 0.8), 0.72, 0); b.box("g", 1.8, 0.12, D, s * (W / 2 + 0.8), 0.72 + h * 0.85, 0); }
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) b.box("d", 0.3, 0.75, 0.04, -W / 2 + 0.9 + i * 1.5, 1.4 + (s > 0 ? 0 : 0), -D / 2 - 0.01 * s + (s > 0 ? 0 : 0)); b.box("l", W + 6, 0.06, D + 5, 0, -0.02);
  return { g: b.group(MK), r: Math.hypot(W, D) / 2 + 2.5, len: W + 4, wid: D + 3, h: 6, pad: true, dom: "land", kind: "building", ang90: true }; }

// ============================== industrial ==============================
function column(b, x, z, rad, h, rnd) { b.cyl("w", rad, rad, h, x, 0.1, z, 18); b.sph("w", rad, x, h + 0.1, z, 1, 0.5, 1, 12); b.cyl("l", rad + 0.18, rad + 0.18, 0.1, x, 0.1, z, 18);
  for (let y = 1.2; y < h; y += 1.4) { b.cyl("g", rad + 0.04, rad + 0.04, 0.08, x, y, z, 18); if (rnd() < 0.6) b.cyl("l", rad + 0.28, rad + 0.28, 0.07, x, y + 0.2, z, 18); }
  b.box("d", 0.1, h * 0.92, 0.1, x + rad + 0.02, 0.1, z, 0); b.cyl("g", 0.06, 0.06, 1, x, h + 0.5, z, 6); }
function pipeRackB(b, L, rnd, h = 1.5, x0 = 0, z0 = 0, npipes = 4) { const n = Math.max(2, Math.round(L / 3.2));
  for (let i = 0; i <= n; i++) { const x = x0 - L / 2 + i * L / n; for (const s of [-1, 1]) b.box("g", 0.12, h, 0.12, x, 0, z0 + s * 0.55); b.box("g", 0.14, 0.12, 1.3, x, h, z0); }
  b.box("g", L, 0.1, 0.1, x0, h + 0.1, z0 + 0.55); b.box("g", L, 0.1, 0.1, x0, h + 0.1, z0 - 0.55);
  for (let i = 0; i < npipes; i++) { const z = z0 - 0.45 + i * (0.9 / Math.max(1, npipes - 1)), r = 0.07 + rnd() * 0.07; b.cyl("w", r, r, L, x0, h + 0.28 + (i % 2) * 0.16, z, 8); const gm = new THREE.CylinderGeometry(r, r, L, 8); gm.rotateZ(Math.PI / 2); b.add(i % 2 ? "l" : "w", gm, x0, h + 0.28 + (i % 2) * 0.16, z); }
}
function pipeRack(E, p = {}) { const { rnd, MK } = E, b = new Builder(), L = p.len ?? R(rnd, 10, 22); pipeRackB(b, L, rnd, 1.5, 0, 0, 4);
  return { g: b.group(MK), r: L / 2, len: L, wid: 1.6, h: 2, dom: "land", kind: "linear", ang90: true }; }
function refinery(E, p = {}) { const { rnd, MK } = E, b = new Builder(), Rr = p.radius ?? 18, smoke = [];
  const nc = p.columns ?? 6, units = []; let tall = 0, tallH = 0; for (let i = 0; i < nc; i++) { const x = -Rr * 0.6 + (i % 3) * Rr * 0.34, z = -Rr * 0.5 + Math.floor(i / 3) * Rr * 0.4, hh = R(rnd, 5, 12), cb = new Builder(); column(cb, x, z, R(rnd, 0.55, 1.0), hh, rnd); units.push(cb.group(MK)); if (hh > tallH) { tallH = hh; tall = i; } }
  for (let i = 0; i < 3; i++) { const x = Rr * 0.5, z = -Rr * 0.5 + i * 2.6; b.box("w", 2.2, 2.4, 1.8, x, 0.1, z); b.cyl("l", 0.38, 0.5, 5.5, x + 0.6, 2.4, z, 12); smoke.push(V(x + 0.6, 8.1, z)); b.box("d", 0.5, 0.2, 1.84, x - 0.6, 1.0, z); }
  for (let i = 0; i < 4; i++) { const x = -Rr * 0.5 + i * 3.3, z = Rr * 0.55; const g = new THREE.CylinderGeometry(0.55, 0.55, 2.6, 12); g.rotateZ(Math.PI / 2); b.add("w", g, x, 1.25, z); b.box("g", 0.2, 0.9, 1.2, x - 0.8, 0.1, z); b.box("g", 0.2, 0.9, 1.2, x + 0.8, 0.1, z); b.cyl("l", 0.07, 0.07, 1.6, x, 1.4, z - 0.5, 6); }
  for (let i = 0; i < 3; i++) { const x = -Rr * 0.1 + i * 3.6, z = Rr * 0.05; b.sph("w", 1.5, x, 2.6, z, 1, 1, 1, 16); for (let k = 0; k < 4; k++) b.limb("g", V(x + Math.cos(k * 1.57 + 0.78) * 0.95, 2.1, z + Math.sin(k * 1.57 + 0.78) * 0.95), V(x + Math.cos(k * 1.57 + 0.78) * 1.1, 0.1, z + Math.sin(k * 1.57 + 0.78) * 1.1), 0.08); b.cyl("l", 1.6, 1.6, 0.1, x, 0.05, z, 14); }
  pipeRackB(b, Rr * 1.5, rnd, 1.6, 0, Rr * 0.28, 5); pipeRackB(b, Rr * 1.1, rnd, 1.4, -Rr * 0.2, -Rr * 0.2, 3);
  b.box("w", 4, 1.6, 2.6, -Rr * 0.7, 0.1, Rr * 0.62); b.box("d", 4.04, 0.35, 2.64, -Rr * 0.7, 0.9, Rr * 0.62); b.box("l", Rr * 2.1, 0.08, Rr * 1.9, 0, -0.02, 0);
  const GG = new THREE.Group(); GG.add(b.group(MK)); units.forEach(u => GG.add(u)); GG.userData.units = units; GG.userData.mainUnit = tall; return { g: GG, r: Rr * 1.05, h: 13, pad: true, dom: "land", kind: "industrial", smoke }; }
function tankFarm(E, p = {}) { const { rnd, MK } = E, b = new Builder(), n = p.n ?? 6, dia = p.dia ?? R(rnd, 5.5, 7.5), cols = Math.max(1, Math.round(Math.sqrt(n * 1.15))), rows = Math.ceil(n / cols), pitch = dia + 3.2, tanks = [], units = [];
  const W = cols * pitch, D = rows * pitch; let i = 0;
  for (let r = 0; r < rows && i < n; r++) for (let c = 0; c < cols && i < n; c++, i++) { const tb = new Builder(); const x = (c - (cols - 1) / 2) * pitch, z = (r - (rows - 1) / 2) * pitch, d = dia * R(rnd, 0.88, 1.05), h = d * R(rnd, 0.42, 0.55);
    tb.cyl("w", d / 2, d / 2, h, x, 0.12, z, 32); for (let k = 1; k < 4; k++) tb.cyl("g", d / 2 + 0.03, d / 2 + 0.03, 0.07, x, 0.12 + k * h / 4, z, 32); tb.cyl("l", d / 2 - 0.2, d / 2 - 0.2, 0.08, x, h + 0.12 - (rnd() < 0.5 ? 0.15 : 0.02), z, 32);
    tb.cyl("g", d / 2 + 0.05, d / 2 + 0.05, 0.08, x, h + 0.1, z, 32); tb.cyl("d", 0.18, 0.18, 0.1, x + d * 0.1, h + 0.2, z + d * 0.08, 8);
    const turns = 10; for (let k = 0; k < turns; k++) { const a0 = k / turns * 5.2, a1 = (k + 1) / turns * 5.2; tb.limb("d", V(x + Math.cos(a0) * (d / 2 + 0.1), 0.12 + h * k / turns, z + Math.sin(a0) * (d / 2 + 0.1)), V(x + Math.cos(a1) * (d / 2 + 0.1), 0.12 + h * (k + 1) / turns, z + Math.sin(a1) * (d / 2 + 0.1)), 0.04); }
    const s = d / 2 + 0.9; for (const [bx, bz, bw, bd] of [[0, -s, 2 * s, 0.22], [0, s, 2 * s, 0.22], [-s, 0, 0.22, 2 * s], [s, 0, 0.22, 2 * s]]) tb.box("l", bw, 0.42, bd, x + bx, 0.12, z + bz);
    tb.box("l", 2 * s, 0.1, 2 * s, x, 0.0, z); tb.box("g", 0.5, 0.3, 0.9, x + s * 0.7, 0.12, z - s * 0.6); tb.cyl("d", 0.09, 0.09, pitch - d, x + d / 2 + 0.4, 0.5, z + 0.2, 8); tanks.push(V(x, h + 0.2, z));  units.push(tb.group(MK)); }
  b.box("l", W + 2, 0.08, D + 2, 0, -0.02, 0); b.box("w", 2, 1, 1.4, -W / 2 - 0.4, 0.1, D / 2 + 1.0); pipeRackB(b, W, rnd, 0.6, 0, D / 2 + 1.3, 3);
  const GG = new THREE.Group(); GG.add(b.group(MK)); units.forEach(u => GG.add(u)); GG.userData.units = units; return { g: GG, r: Math.hypot(W, D) / 2 + 1.5, len: W + 2, wid: D + 2, h: dia * 0.5 + 0.5, pad: true, dom: "land", kind: "industrial", ang90: true }; }
function silo(E, p = {}) { const { rnd, MK } = E, b = new Builder(), n = p.n ?? 4, r = 1.2, h = R(rnd, 5, 7);
  for (let i = 0; i < n; i++) { const x = i * (2 * r + 0.15) - (n - 1) * (r + 0.07); b.cyl("w", r, r, h, x, 0.3, 0, 20); b.cone("l", r + 0.1, 0.8, x, 0.3 + h, 0, 20); b.cyl("g", 0.1, 0.1, 0.4, x, 0.3 + h + 0.8, 0, 6); for (let k = 1; k < 5; k++) b.cyl("g", r + 0.025, r + 0.025, 0.06, x, 0.3 + k * h / 5, 0, 20); }
  const Lx = n * (2 * r + 0.15); b.box("g", Lx, 0.35, 0.7, 0, 0.3 + h + 0.55, 0, 0); b.box("w", 2.6, 1.2, 2, -Lx / 2 - 1.6, 0.0, 2.2); b.prism("g", 2.9, 0.6, 2.2, -Lx / 2 - 1.6, 1.2, 2.2, Math.PI / 2); b.box("l", Lx + 5, 0.08, 6.5, -1, -0.02, 1);
  b.limb("g", V(-Lx / 2 - 1.6, 1.4, 2.2), V(-Lx / 2 + 0.3, 0.3 + h + 0.5, 0.2), 0.16);
  return { g: b.group(MK), r: Lx / 2 + 3, len: Lx + 5, wid: 6.5, h: h + 1.5, pad: true, dom: "land", kind: "industrial", ang90: true }; }
function flareStack(E, p = {}) { const { rnd, MK } = E, b = new Builder(), h = p.h ?? 15; b.cyl("l", 0.12, 0.3, h, 0, 0, 0, 10); b.cyl("w", 0.34, 0.34, 0.5, 0, h, 0, 10); b.cone("w", 0.3, 0.9, 0, h + 0.5, 0, 10);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; b.limb("g", V(Math.cos(a) * 6.5, 0.05, Math.sin(a) * 6.5), V(0, h * 0.8, 0), 0.025); b.box("g", 0.3, 0.3, 0.3, Math.cos(a) * 6.5, 0, Math.sin(a) * 6.5); }
  for (let y = 1.5; y < h; y += 2) b.cyl("g", 0.22, 0.22, 0.06, 0, y, 0, 10); b.cyl("w", 0.8, 0.8, 2.4, 3.2, 0, 1.2, 14); b.cyl("l", 0.9, 0.9, 0.1, 3.2, 2.4, 1.2, 14); b.box("l", 5, 0.08, 4.4, 1, -0.02, 0.5);
  return { g: b.group(MK), r: 5.5, h, pad: true, dom: "land", kind: "industrial", smoke: [V(0, h + 1.4, 0)], smokeScale: 0.7 }; }
function conveyor(E, p = {}) { const { rnd, MK } = E, b = new Builder(), L = p.len ?? 18, H = p.h ?? 3.2, ang = Math.atan2(H, L);
  const g = new THREE.BoxGeometry(Math.hypot(L, H), 0.55, 0.7); b.add("w", g, 0, H / 2 + 0.6, 0, 0, 1, 1, 1, 0, ang); b.add("d", new THREE.BoxGeometry(Math.hypot(L, H), 0.1, 0.5), 0, H / 2 + 0.9, 0, 0, 1, 1, 1, 0, ang);
  const n = Math.max(2, Math.round(L / 3)); for (let i = 0; i <= n; i++) { const x = -L / 2 + i * L / n, y = H * (i / n) + 0.35; b.box("g", 0.14, y, 0.14, x, 0, 0.32); b.box("g", 0.14, y, 0.14, x, 0, -0.32); }
  b.box("w", 2.4, 1.8, 2, L / 2 + 0.6, H - 0.4, 0); b.box("w", 2, 1.2, 1.6, -L / 2 - 1, 0, 0);
  return { g: b.group(MK), r: L / 2 + 1.5, len: L + 3, wid: 2.4, h: H + 2, pad: true, dom: "land", kind: "industrial", ang90: true }; }
function pumpStation(E, p = {}) { const { rnd, MK } = E, b = new Builder(); b.box("w", 2.6, 1.2, 1.8, 0, 0.05, 0); b.prism("g", 2, 0.45, 2.8, 0, 1.25, 0, Math.PI / 2); b.box("d", 0.5, 0.8, 0.05, 0, 0.05, 0.9);
  for (let i = 0; i < 2; i++) { b.cyl("w", 0.9, 0.9, 1.5, -2.2 + i * 1.9, 0.05, 2.6, 16); b.cyl("l", 0.95, 0.95, 0.07, -2.2 + i * 1.9, 1.5, 2.6, 16); } b.box("g", 1.0, 0.7, 0.8, 2.2, 0.05, 1.8); b.cyl("g", 0.18, 0.18, 0.5, 2.2, 0.7, 1.8, 8); b.cyl("l", 0.04, 0.04, 4, -1.6, 0.05, -1.6, 6);
  const f = 4.2; for (const [x, z, w, d] of [[0, f, 2 * f, 0.06], [0, -f, 2 * f, 0.06], [f, 0, 0.06, 2 * f], [-f, 0, 0.06, 2 * f]]) b.box("g", w, 0.5, d, x, 0.05, z); b.box("l", 2 * f + 0.6, 0.08, 2 * f + 0.6, 0, -0.02, 0);
  return { g: b.group(MK), r: 5.8, h: 4, pad: true, dom: "land", kind: "industrial", ang90: true }; }

// ============================== port ==============================
function containerYard(E, p = {}) { const { rnd, MK } = E, b = new Builder(), cols = p.cols ?? 10, rows = p.rows ?? 6, cl = 1.7, cw = 0.62, ch = 0.58, ks = ["w", "g", "l", "w", "s"];
  const pitchX = cl + 0.12, pitchZ = cw + 0.1, aisle = 1.4; let z = 0; const ZS = [];
  for (let r = 0; r < rows; r++) { if (r > 0 && r % 3 === 0) z += aisle; ZS.push(z); z += pitchZ; } const Dz = z, Wx = cols * pitchX;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) { if (rnd() < 0.08) continue; const tiers = rnd() < 0.2 ? 1 : 1 + Math.floor(rnd() * 3.99), k = pickOf(rnd, ks);
    for (let t = 0; t < tiers; t++) { b.box(t === 0 ? k : pickOf(rnd, ks), cl, ch, cw, -Wx / 2 + (c + 0.5) * pitchX, 0.04 + t * ch, ZS[r] - Dz / 2 + cw / 2); } }
  for (let c = 0; c < 3; c++) { const x = R(rnd, -Wx / 2, Wx / 2); b.box("d", 0.1, 1.5, 0.1, x, 0, -Dz / 2 - 0.5); }   // light masts
  b.cyl("g", 0.05, 0.05, 3.2, -Wx / 2 - 0.4, 0, -Dz / 2 - 0.6, 6); b.box("w", 0.6, 0.12, 0.3, -Wx / 2 - 0.4, 3.2, -Dz / 2 - 0.6); b.box("l", Wx + 1.6, 0.06, Dz + 1.6, 0, -0.02, 0);
  return { g: b.group(MK), r: Math.hypot(Wx, Dz) / 2 + 1, len: Wx + 1.6, wid: Dz + 1.6, h: 3, pad: true, dom: "land", kind: "yard", ang90: true }; }
function gantry(E, p = {}) { const g = K.gantryCrane(E.KM); const s = p.scale ?? R(E.rnd, 6.5, 8); g.scale.setScalar(s); shadowAll(g); const tr = g.userData.trolley;
  return { g, r: s * 0.32, len: s * 0.4, wid: s * 0.5, h: s * 0.95, dom: "land", kind: "crane", fw: "z", anim: t => { tr.position.z = 0.28 + Math.sin(t * 0.35 + (p.ph ?? 0)) * 0.25; }, scale: s }; }
function containerTruck(E, p = {}) { const { rnd, MK } = E, b = new Builder(), L = 2.6, t = p.type ?? pickOf(rnd, ["container", "container", "box", "tank", "flat"]); b.box("w", 0.7, 0.55, 0.62, L / 2 - 0.38, 0.14, 0); b.box("d", 0.05, 0.22, 0.56, L / 2 - 0.05, 0.38, 0); b.box("g", L, 0.1, 0.55, 0, 0.1, 0);
  const trailer = { container: () => b.box(pickOf(rnd, ["w", "g", "l"]), 1.75, 0.55, 0.62, -0.28, 0.2, 0), box: () => b.box("w", 1.75, 0.65, 0.64, -0.28, 0.2, 0), tank: () => { const g = new THREE.CylinderGeometry(0.3, 0.3, 1.7, 14); g.rotateZ(Math.PI / 2); b.add("w", g, -0.28, 0.58, 0); }, flat: () => { b.box("l", 1.75, 0.06, 0.62, -0.28, 0.2, 0); for (let i = 0; i < 3; i++) b.box("g", 0.5, 0.3, 0.5, -0.8 + i * 0.52, 0.26, 0); } }; trailer[t]();
  for (const x of [L / 2 - 0.4, -0.5, -0.9]) for (const s of [-1, 1]) b.add("d", new THREE.CylinderGeometry(0.11, 0.11, 0.1, 10), x, 0.11, s * 0.3, 0, 1, 1, 1, Math.PI / 2);
  return { g: b.group(MK), r: 1.3, len: 2.6, wid: 0.7, h: 1, dom: "land", kind: "vehicle" }; }
function carG(E, p = {}) { const g = K.car(E.KM, p.type ?? pickOf(E.rnd, ["hatch", "sedan", "van", "sedan"])); const s = p.scale ?? 1.25; g.scale.setScalar(s); shadowAll(g); return { g, r: 0.7 * s, len: 1.1 * s, wid: 0.55 * s, h: 0.6, dom: "land", kind: "vehicle" }; }
function busG(E, p = {}) { const g = K.car(E.KM, "bus"); g.scale.setScalar(1.1); shadowAll(g); return { g, r: 1.4, len: 2.4, wid: 0.6, h: 0.7, dom: "land", kind: "vehicle" }; }
function train(E, p = {}) { if (p.wagon === "hsr") return hsrTrain(E, p); const { rnd, MK } = E, b = new Builder(), n = p.n ?? 8, wt = p.wagon ?? pickOf(rnd, ["box", "tank", "container", "bulk"]), WL = 1.9, items = [];
  const loco = new Builder(); loco.box("w", 2.4, 0.75, 0.75, 0, 0.2, 0); loco.box("d", 0.8, 0.28, 0.77, 0.7, 0.62, 0); loco.box("g", 0.9, 0.3, 0.78, -0.7, 0.8, 0); loco.box("g", 2.5, 0.08, 0.8, 0, 0.18, 0); for (const x of [-0.8, 0.8]) for (const s of [-1, 1]) loco.add("d", new THREE.CylinderGeometry(0.13, 0.13, 0.08, 10), x, 0.13, s * 0.3, 0, 1, 1, 1, Math.PI / 2);
  const parts = [loco.group(MK)]; for (let i = 0; i < n; i++) { const w = new Builder(); w.box("g", WL, 0.07, 0.62, 0, 0.17, 0); for (const x of [-0.6, 0.6]) for (const s of [-1, 1]) w.add("d", new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), x, 0.12, s * 0.27, 0, 1, 1, 1, Math.PI / 2);
    if (wt === "box") { w.box(pickOf(rnd, ["w", "l", "g"]), WL - 0.1, 0.62, 0.7, 0, 0.22, 0); w.box("g", WL, 0.05, 0.74, 0, 0.84, 0); } else if (wt === "tank") { const g = new THREE.CylinderGeometry(0.33, 0.33, WL - 0.1, 14); g.rotateZ(Math.PI / 2); w.add("w", g, 0, 0.6, 0); w.box("d", 0.5, 0.08, 0.14, 0, 0.9, 0); }
    else if (wt === "container") { for (let c = 0; c < 2; c++) w.box(pickOf(rnd, ["w", "g", "l"]), 0.88, 0.5, 0.58, -0.47 + c * 0.94, 0.21, 0); } else { w.box("l", WL - 0.1, 0.5, 0.72, 0, 0.22, 0); w.cone("s", 0.3, 0.3, -0.4, 0.72, 0, 6); w.cone("s", 0.3, 0.28, 0.4, 0.72, 0, 6); }
    parts.push(w.group(MK)); }
  const G = new THREE.Group(); parts.forEach((q, i) => { q.position.x = -i * (WL + 0.12) + 0.6; G.add(q); }); const TL = n * (WL + 0.12) + 2.6;
  return { g: G, r: 1.2, len: TL, wid: 0.8, h: 1, dom: "land", kind: "train", cars: parts, spacing: WL + 0.12, trainLen: TL }; }
function people(E, p = {}) { const { rnd, KM } = E, n = p.n ?? 3, G = new THREE.Group(), s = p.scale ?? 1.0, r0 = 0.6 + 0.35 * Math.sqrt(n);
  for (let i = 0; i < n; i++) { const q = K.person(KM, { hat: pickOf(rnd, ["hard", "none", "cap", "peak"]), build: R(rnd, 0.85, 1.25), pose: pickOf(rnd, ["side", "side", "hips", "phone", "salute"]) }); const a = rnd() * 6.28, d = Math.sqrt(rnd()) * r0; q.scale.setScalar(s * R(rnd, 0.92, 1.08));
    q.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); q.rotation.y = rnd() * 6.28; shadowAll(q); G.add(q); }
  return { g: G, r: r0 + 0.4, h: s, dom: "any", kind: "people" }; }

// ============================== vessels ==============================
const draftOf = (depth, L) => 0.5 * depth * L;
function vesselKit(fn, hw, depth, E, L, p = {}) { const g = fn(E.KM, p); g.scale.setScalar(L); shadowAll(g); return { g, r: L / 2, len: L, wid: 2 * hw * L, hw: hw * L, draft: draftOf(depth, L), dom: "water", kind: "vessel", h: L * 0.3, fw: "x" }; }
const hullGeo = (hw, depth, bow = 0.5) => { const sh = new THREE.Shape(); sh.moveTo(-0.5, -hw); sh.lineTo(0.22, -hw); sh.quadraticCurveTo(0.45, -hw * 0.9, bow, 0); sh.quadraticCurveTo(0.45, hw * 0.9, 0.22, hw); sh.lineTo(-0.5, hw); sh.lineTo(-0.5, -hw);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 10 }); g.rotateX(-Math.PI / 2); return g; };
const tankerV = (E, p = {}) => { const L = p.len ?? R(E.rnd, 14, 19); return vesselKit(K.tanker, 0.085, 0.085, E, L); };
const containerV = (E, p = {}) => { const L = p.len ?? R(E.rnd, 11, 16); return vesselKit((KM) => K.containerShip(KM, { rows: p.rows ?? clamp(Math.round(L * 0.75), 7, 12), seed: p.seed ?? Math.floor(E.rnd() * 999) }), 0.09, 0.1, E, L); };
const warshipV = (E, p = {}) => vesselKit(K.warship, 0.065, 0.08, E, p.len ?? R(E.rnd, 10, 13));
const flattopV = (E, p = {}) => vesselKit(K.flattop, 0.1, 0.07, E, p.len ?? 22);
const tugV = (E, p = {}) => vesselKit(K.tug, 0.17, 0.12, E, p.len ?? 4.2);
const dredgerV = (E, p = {}) => vesselKit(K.dredger, 0.14, 0.1, E, p.len ?? 11);
function bulkV(E, p = {}) { const { rnd, MK } = E, L = p.len ?? R(rnd, 10, 14), b = new Builder(); b.add("w", hullGeo(0.085, 0.09)); b.box("g", 0.98, 0.012, 0.175, -0.02, 0.012, 0); b.box("l", 0.7, 0.006, 0.15, 0.08, 0.09, 0);
  for (let i = 0; i < 5; i++) { const x = -0.15 + i * 0.12; b.box("g", 0.095, 0.03, 0.12, x, 0.092, 0); b.box("l", 0.098, 0.006, 0.124, x, 0.122, 0); if (i < 4) b.cyl("w", 0.006, 0.006, 0.14, x + 0.06, 0.092, 0.0, 6); }
  for (let i = 0; i < 4; i++) { const x = -0.09 + i * 0.12; b.limb("w", V(x, 0.092, 0.07), V(x, 0.22, 0.07), 0.006); b.limb("g", V(x, 0.22, 0.07), V(x + 0.08, 0.2, 0.15), 0.005); b.box("g", 0.01, 0.01, 0.02, x + 0.08, 0.19, 0.15); }
  b.add("w", new RoundedBox(0.12, 0.17, 0.14), -0.4, 0.09 + 0.085, 0); b.box("g", 0.122, 0.02, 0.142, -0.4, 0.21, 0); b.box("w", 0.06, 0.04, 0.16, -0.38, 0.265, 0); b.cyl("w", 0.014, 0.018, 0.07, -0.44, 0.27, 0, 10);
  const g = b.group(MK); g.scale.setScalar(L); return { g, r: L / 2, len: L, wid: 0.17 * L, hw: 0.085 * L, draft: draftOf(0.09, L), dom: "water", kind: "vessel", h: L * 0.3 }; }
function RoundedBox(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function icebreakerV(E, p = {}) { const { rnd, MK } = E, L = p.len ?? 12, b = new Builder(); b.add("w", hullGeo(0.1, 0.1, 0.52)); b.box("g", 0.98, 0.014, 0.205, -0.02, 0.014, 0); b.box("d", 0.5, 0.05, 0.208, 0.0, 0.0, 0); const g1 = new THREE.CylinderGeometry(0.01, 0.01, 0.2, 6);
  b.box("w", 0.28, 0.1, 0.18, 0.05, 0.1, 0); b.box("w", 0.16, 0.08, 0.16, 0.06, 0.2, 0); b.box("g", 0.164, 0.025, 0.164, 0.06, 0.235, 0); b.box("w", 0.06, 0.05, 0.26, 0.08, 0.23, 0); b.box("w", 0.1, 0.07, 0.1, 0.0, 0.28, 0);
  b.cyl("w", 0.025, 0.03, 0.1, -0.1, 0.2, 0, 10); b.cyl("d", 0.028, 0.028, 0.02, -0.1, 0.3, 0, 10); b.cyl("g", 0.005, 0.005, 0.14, 0.06, 0.28, 0, 6); b.box("l", 0.18, 0.006, 0.17, -0.34, 0.1, 0); b.cyl("d", 0.045, 0.045, 0.004, -0.34, 0.106, 0, 14);
  for (const s of [-1, 1]) { b.limb("g", V(0.27, 0.1, s * 0.06), V(0.27, 0.2, s * 0.03), 0.006); b.limb("g", V(0.27, 0.2, s * 0.03), V(0.35, 0.16, s * 0.02), 0.005); }
  b.box("w", 0.1, 0.08, 0.14, -0.22, 0.1, 0); b.limb("g", V(-0.22, 0.18, 0), V(-0.3, 0.3, 0), 0.006); const gg = b.group(MK); gg.scale.setScalar(L);
  return { g: gg, r: L / 2, len: L, wid: 0.2 * L, hw: 0.1 * L, draft: draftOf(0.1, L), dom: "water", kind: "vessel", h: L * 0.3, smoke: [V(-0.1 * L, 0.34 * L, 0)], smokeScale: 0.4 }; }
function fishingV(E, p = {}) { const { rnd, MK } = E, L = p.len ?? R(rnd, 3, 4.2), b = new Builder(); b.add("w", hullGeo(0.14, 0.12, 0.5)); b.box("g", 0.98, 0.014, 0.29, -0.02, 0.014, 0); b.box("w", 0.24, 0.17, 0.22, 0.12, 0.12, 0); b.box("d", 0.246, 0.05, 0.226, 0.12, 0.2, 0); b.box("g", 0.3, 0.02, 0.26, 0.12, 0.29, 0);
  b.cyl("g", 0.012, 0.012, 0.4, 0.2, 0.29, 0, 6); b.limb("g", V(0.2, 0.55, 0), V(-0.36, 0.35, 0), 0.006); b.limb("g", V(0.2, 0.55, 0), V(0.45, 0.14, 0), 0.006); const gg = new THREE.CylinderGeometry(0.06, 0.06, 0.25, 12); gg.rotateX(Math.PI / 2); b.add("l", gg, -0.28, 0.2, 0);
  for (let i = 0; i < 6; i++) b.sph("l", 0.02, -0.1 + i * 0.05, 0.14, (i % 2 ? 1 : -1) * 0.1, 1, 1, 1, 6); b.cyl("w", 0.02, 0.025, 0.1, 0.0, 0.2, 0, 8);
  const g = b.group(MK); g.scale.setScalar(L); return { g, r: L / 2, len: L, wid: 0.28 * L, hw: 0.14 * L, draft: draftOf(0.12, L), dom: "water", kind: "vessel", h: L * 0.5, bobby: 1.8 }; }
function skiffV(E, p = {}) { const { rnd, MK } = E, L = p.len ?? R(rnd, 1.6, 2.4), b = new Builder(); const sh = new THREE.Shape(); sh.moveTo(-0.5, -0.12); sh.lineTo(0.15, -0.14); sh.quadraticCurveTo(0.45, -0.1, 0.52, 0); sh.quadraticCurveTo(0.45, 0.1, 0.15, 0.14); sh.lineTo(-0.5, 0.12); sh.closePath();
  const g1 = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }); g1.rotateX(-Math.PI / 2); b.add("w", g1); b.box("g", 0.4, 0.04, 0.22, -0.1, 0.1, 0); b.box("d", 0.1, 0.12, 0.08, -0.5, 0.0, 0); if (rnd() < 0.5) { b.box("l", 0.3, 0.015, 0.26, 0.1, 0.26, 0); for (const s of [-1, 1]) b.cyl("g", 0.008, 0.008, 0.16, 0.0, 0.1, s * 0.11, 6); }
  const g = b.group(MK); g.scale.setScalar(L); return { g, r: L / 2, len: L, wid: 0.26 * L, hw: 0.13 * L, draft: draftOf(0.1, L), dom: "water", kind: "vessel", h: L * 0.3, bobby: 2.5 }; }
function ferryV(E, p = {}) { const { rnd, MK } = E, L = p.len ?? 6, b = new Builder(); b.add("w", hullGeo(0.13, 0.08, 0.5)); b.box("g", 0.98, 0.012, 0.27, -0.02, 0.012, 0); b.box("w", 0.7, 0.1, 0.22, -0.05, 0.08, 0); b.box("w", 0.5, 0.09, 0.2, -0.05, 0.18, 0); b.box("d", 0.72, 0.04, 0.224, -0.05, 0.11, 0); b.box("d", 0.52, 0.04, 0.204, -0.05, 0.21, 0); b.box("g", 0.58, 0.02, 0.24, -0.05, 0.27, 0); b.box("w", 0.18, 0.07, 0.16, 0.1, 0.29, 0); b.cyl("g", 0.02, 0.02, 0.07, -0.2, 0.29, 0, 8);
  const g = b.group(MK); g.scale.setScalar(L); return { g, r: L / 2, len: L, wid: 0.26 * L, hw: 0.13 * L, draft: draftOf(0.08, L), dom: "water", kind: "vessel", h: L * 0.4 }; }
function buoy(E, p = {}) { const { rnd, MK } = E, b = new Builder(); b.cyl("w", 0.35, 0.45, 0.5, 0, -0.1, 0, 12); b.cyl("g", 0.1, 0.1, 1, 0, 0.4, 0, 6); b.cone("w", 0.3, 0.4, 0, 1.4, 0, 8); b.sph("l", 0.12, 0, 1.85, 0);
  return { g: b.group(MK), r: 0.7, h: 2, dom: "water", kind: "buoy", bobby: 1 }; }

// ============================== nature ==============================
function mountain(E, p = {}) { const { rnd, MK } = E, b = new Builder(), Rr = p.radius ?? R(rnd, 14, 24), H = p.h ?? Rr * R(rnd, 0.9, 1.5), snow = p.snow ?? true;
  const peaks = 1 + Math.floor(rnd() * 3); for (let i = 0; i < peaks; i++) { const a = rnd() * 6.28, d = i ? Rr * R(rnd, 0.35, 0.6) : 0, rr = Rr * (i ? R(rnd, 0.5, 0.8) : 1), hh = H * (i ? R(rnd, 0.5, 0.85) : 1), x = Math.cos(a) * d, z = Math.sin(a) * d, seg = 6 + Math.floor(rnd() * 3), rot = rnd() * 3;
    const cg = new THREE.ConeGeometry(rr, hh, seg, 3); const pa = cg.attributes.position; for (let v = 0; v < pa.count; v++) { const y = pa.getY(v); if (y < hh / 2 - 0.01) { const j = 1 + (Math.sin(pa.getX(v) * 3.1 + pa.getZ(v) * 2.3 + i) * 0.5) * 0.28; pa.setX(v, pa.getX(v) * j); pa.setZ(v, pa.getZ(v) * j); } }
    b.add(pickOf(rnd, ["g", "l", "l"]), cg, x, hh / 2 - 0.6, z, rot);
    if (snow) { const f = 0.34; const cap = new THREE.ConeGeometry(rr * f * 1.04, hh * f * 1.02, seg, 1); b.add("w", cap, x, hh * (1 - f / 2) - 0.6 + hh * 0.005, z, rot); } }
  return { g: b.group(MK), r: Rr * 0.85, h: H, dom: "land", kind: "nature", noPad: true }; }
function rocks(E, p = {}) { const { rnd, MK } = E, b = new Builder(), n = p.n ?? 5, s = p.size ?? 1; for (let i = 0; i < n; i++) { const r = R(rnd, 0.35, 0.9) * s; b.add(pickOf(rnd, ["l", "g", "w"]), new THREE.IcosahedronGeometry(r, 0), R(rnd, -1.4, 1.4) * s, r * 0.4 - 0.05, R(rnd, -1.4, 1.4) * s, rnd() * 3, R(rnd, 0.8, 1.4), R(rnd, 0.5, 0.9), R(rnd, 0.8, 1.3)); }
  return { g: b.group(MK), r: 1.8 * s, h: s, dom: "any", kind: "nature", noPad: true }; }
export function treeParts(rnd, kind) {   // [key, geometry, [x,y,z]] parts in unit height ~ 1.8 (round) / 2.4 (pine)
  const parts = [];
  if (kind === "pine") { parts.push(["g", new THREE.CylinderGeometry(0.07, 0.1, 0.5, 5), 0, 0.25, 0]); for (let i = 0; i < 3; i++) parts.push(["w", new THREE.ConeGeometry(0.62 - i * 0.16, 0.9, 7), 0, 0.7 + i * 0.5, 0]); }
  else if (kind === "round") { parts.push(["g", new THREE.CylinderGeometry(0.08, 0.11, 0.7, 5), 0, 0.35, 0]); parts.push(["w", new THREE.IcosahedronGeometry(0.62, 0), 0, 1.05, 0]); parts.push(["l", new THREE.IcosahedronGeometry(0.4, 0), 0.25, 1.4, 0.1]); }
  else if (kind === "shrub") { parts.push(["w", new THREE.IcosahedronGeometry(0.4, 0), 0, 0.28, 0]); parts.push(["l", new THREE.IcosahedronGeometry(0.28, 0), 0.3, 0.2, 0.15]); }
  else if (kind === "palm") { const top = V(0.12, 2.3, 0); for (let i = 0; i < 4; i++) parts.push(["g", new THREE.CylinderGeometry(0.06 - i * 0.008, 0.07 - i * 0.008, 0.6, 5), 0.035 * i, 0.3 + i * 0.58, 0]);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28, g = new THREE.ConeGeometry(0.2, 1.05, 5); g.scale(1, 1, 0.42); g.translate(0, 0.55, 0); const q = new THREE.Quaternion().setFromUnitVectors(UP, V(Math.cos(a), -0.15 + (i % 2) * 0.35, Math.sin(a)).normalize()); g.applyQuaternion(q); g.translate(top.x, top.y - 0.05, top.z); parts.push(["w", g, 0, 0, 0]); } parts.push(["l", new THREE.IcosahedronGeometry(0.11, 0), top.x, top.y - 0.1, 0]); }
  else if (kind === "cypress") { parts.push(["w", new THREE.ConeGeometry(0.28, 1.8, 6), 0, 0.9, 0]); }
  return parts; }
export function floeGeo(rnd, r) { const n = 8 + Math.floor(rnd() * 4), sh = new THREE.Shape(); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = r * R(rnd, 0.62, 1.05); const x = Math.cos(a) * rr, z = Math.sin(a) * rr * 0.85; i ? sh.lineTo(x, z) : sh.moveTo(x, z); } sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.7, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.06, bevelSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, -0.4, 0); return g; }
function iceberg(E, p = {}) { const { rnd, MK } = E, b = new Builder(), r = p.r ?? R(rnd, 1.5, 4); const g1 = new THREE.IcosahedronGeometry(r, 1), pa = g1.attributes.position; for (let v = 0; v < pa.count; v++) { const k = 1 + 0.25 * Math.sin(pa.getX(v) * 2.1 + pa.getY(v) * 3.3 + pa.getZ(v) * 1.7); pa.setXYZ(v, pa.getX(v) * k, pa.getY(v) * k * 0.8, pa.getZ(v) * k); }
  b.add("w", g1, 0, r * 0.35, 0, rnd() * 3); b.add("l", new THREE.IcosahedronGeometry(r * 0.55, 0), r * 0.5, r * 0.2, r * 0.3); return { g: b.group(MK), r: r * 1.15, h: r * 1.2, dom: "water", kind: "nature", noPad: true }; }
function plantation(E, p = {}) { const { rnd, MK } = E, rows = p.rows ?? 14, cols = p.cols ?? 18, sp = p.spacing ?? 2.1, parts = treeParts(rnd, "palm"), byK = {}, G = new THREE.Group(), mats = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler();
  for (const [k, gg, px, py, pz] of parts) { let c = gg.clone(); if (c.index) c = c.toNonIndexed(); if (c.attributes.uv) c.deleteAttribute("uv"); c.translate(px, py, pz); (byK[k] ??= []).push(c); }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (rnd() < 0.03) continue; const x = (c - (cols - 1) / 2) * sp + R(rnd, -0.12, 0.12), z = (r - (rows - 1) / 2) * sp * 0.95 + (c % 2 ? sp * 0.3 : 0) + R(rnd, -0.12, 0.12), s = 0.95 * R(rnd, 0.85, 1.15); eu.set(0, rnd() * 6, 0); q.setFromEuler(eu); m4.compose(V(x, 0, z), q, V(s, s, s)); mats.push(m4.clone()); }
  for (const k in byK) { const im = new THREE.InstancedMesh(mergeGeometries(byK[k], false), MK[k], mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = im.receiveShadow = true; im.frustumCulled = false; G.add(im); }
  const W = cols * sp, D = rows * sp, b = new Builder(); b.box("s", W + 1, 0.05, D + 1, 0, -0.01, 0); for (let r = 3; r < rows; r += 4) b.box("l", W, 0.04, 0.5, 0, 0.03, (r - (rows - 1) / 2) * sp * 0.95 - sp * 0.5); G.add(b.group(MK));
  return { g: G, r: Math.hypot(W, D) / 2, len: W, wid: D, h: 3, pad: true, dom: "land", kind: "nature", ang90: true }; }

// ============================== props ==============================
function lighthouse(E, p = {}) { const { rnd, MK } = E, b = new Builder(), H = p.h ?? 13; b.cyl("l", 3.4, 3.8, 0.9, 0, 0, 0, 20);
  const seg = 5; for (let i = 0; i < seg; i++) { const y = 0.9 + i * H / seg, r0 = 1.7 - i * 0.12, r1 = 1.7 - (i + 1) * 0.12; b.add(i % 2 ? "g" : "w", new THREE.CylinderGeometry(r1, r0, H / seg, 20), 0, y + H / seg / 2, 0); }
  b.cyl("l", 1.5, 1.2, 0.2, 0, 0.9 + H, 0, 20); b.cyl("g", 1.3, 1.3, 0.12, 0, 1.1 + H, 0, 20); for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28; b.box("g", 0.05, 0.4, 0.05, Math.cos(a) * 1.3, 1.2 + H, Math.sin(a) * 1.3); } b.cyl("g", 1.3, 1.3, 0.04, 0, 1.55 + H, 0, 20);
  const lg = new THREE.CylinderGeometry(0.7, 0.7, 1.0, 14); b.add("l", lg, 0, 1.2 + H + 0.5, 0); b.cone("w", 0.95, 0.7, 0, 2.2 + H, 0, 14); b.cyl("g", 0.04, 0.04, 0.5, 0, 2.9 + H, 0, 6);
  b.box("w", 2.6, 1.2, 1.8, 3.6, 0.0, 1.8); b.prism("g", 1.9, 0.6, 2.8, 3.6, 1.2, 1.8, Math.PI / 2); b.box("d", 0.4, 0.55, 0.05, 3.6, 0, 2.72); b.box("w", 1.2, 0.8, 1.0, 5.4, 0, -0.4); b.cyl("g", 0.35, 0.35, 0.9, -3.4, 0, 1.4, 10);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), new THREE.MeshStandardMaterial({ color: 0xfff6dd, emissive: 0xfff2cc, emissiveIntensity: 1.2 })); lamp.position.set(0, 1.2 + H + 0.5, 0);
  const G = b.group(MK); G.add(lamp); return { g: G, r: 6, h: H + 3, pad: true, dom: "land", kind: "prop", anim: t => { lamp.material.emissiveIntensity = 0.5 + 0.9 * Math.max(0, Math.sin(t * 1.4)); } }; }
function radarMast(E, p = {}) { const { rnd, MK } = E, b = new Builder(), H = p.h ?? 11, rb = 1.15, rt = 0.35, N = 4;
  const leg = (i, y) => { const a = i / N * 6.283 + 0.785, r = rb + (rt - rb) * y / H; return V(Math.cos(a) * r, y, Math.sin(a) * r); };
  for (let i = 0; i < N; i++) b.limb("g", leg(i, 0), leg(i, H), 0.05, 5);
  for (let y = 0; y < H - 0.1; y += 1.4) for (let i = 0; i < N; i++) { b.limb("l", leg(i, y), leg((i + 1) % N, y), 0.025, 4); b.limb("l", leg(i, y), leg((i + 1) % N, Math.min(H, y + 1.4)), 0.02, 4); }
  b.cyl("l", 0.62, 0.62, 0.14, 0, H, 0, 14); const dish = new THREE.Group(), db = new Builder(); db.box("w", 2.6, 0.9, 0.12, 0, 0.45, 0); db.box("g", 0.3, 0.35, 0.35, 0, 0.0, 0); db.box("g", 0.12, 0.12, 0.4, 0, 0.82, 0.2); dish.add(db.group(MK)); dish.position.set(0, H + 0.2, 0);
  b.box("w", 2.4, 1.3, 1.8, 3, 0.05, 0.4); b.box("d", 0.5, 0.55, 0.04, 3, 0.05, 1.32); b.cyl("w", 1.0, 1.0, 0.3, -2.7, 0.0, -1.0, 12); b.sph("w", 1.0, -2.7, 0.3, -1.0, 1, 1, 1, 12);
  const f = 4.5; for (const [x, z, w, d] of [[0, f, 2 * f, 0.05], [0, -f, 2 * f, 0.05], [f, 0, 0.05, 2 * f], [-f, 0, 0.05, 2 * f]]) b.box("g", w, 0.6, d, x, 0.05, z); b.box("l", 2 * f + 0.4, 0.06, 2 * f + 0.4, 0, -0.02, 0);
  const G = b.group(MK); G.add(dish); return { g: G, r: 5.8, h: H + 1.4, pad: true, dom: "land", kind: "prop", anim: t => { dish.rotation.y = t * 0.9; } }; }
function watchtower(E, p = {}) { const { rnd, MK } = E, b = new Builder(), H = p.h ?? 4.2; for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.limb("g", V(sx * 0.9, 0, sz * 0.9), V(sx * 0.6, H, sz * 0.6), 0.07, 5);
  for (let y = 0.9; y < H; y += 1.2) { for (const s of [-1, 1]) { b.box("l", 1.6 - y * 0.08, 0.06, 0.05, 0, y, s * (0.88 - y * 0.07)); b.box("l", 0.05, 0.06, 1.6 - y * 0.08, s * (0.88 - y * 0.07), y, 0); } }
  b.box("w", 1.7, 0.9, 1.7, 0, H, 0); b.box("d", 1.74, 0.35, 1.74, 0, H + 0.3, 0); b.hip("g", 2.3, 0.7, 2.3, 0, H + 0.9, 0); b.box("g", 2, 0.08, 2, 0, H - 0.05, 0); b.box("l", 3.6, 0.05, 3.6, 0, -0.02, 0);
  return { g: b.group(MK), r: 1.9, h: H + 1.6, pad: true, dom: "land", kind: "prop" }; }
function helipad(E) { const { MK } = E, b = new Builder(); b.cyl("l", 3, 3, 0.1, 0, 0, 0, 24); b.cyl("w", 2.5, 2.5, 0.04, 0, 0.1, 0, 24); b.box("d", 0.2, 0.02, 1.3, -0.5, 0.14, 0); b.box("d", 0.2, 0.02, 1.3, 0.5, 0.14, 0); b.box("d", 1.2, 0.02, 0.2, 0, 0.14, 0);
  return { g: b.group(MK), r: 3.2, h: 0.2, pad: true, dom: "land", kind: "prop" }; }
function checkpoint(E, p = {}) { const { rnd, MK } = E, b = new Builder(), RW = p.roadW ?? 6, L = 12, anim = [];   // local x = road direction
  b.box("l", L, 0.04, RW + 4, 0, -0.02, 0); b.box("w", 3.2, 1.3, 1.1, 0, 0, 0); b.box("d", 3.24, 0.35, 1.14, 0, 0.6, 0); b.box("g", 4.2, 0.12, 5.5 + 0, 0, 2.55, 0); b.box("w", 4.2, 0.1, RW + 3.6, 0, 2.7, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl("g", 0.1, 0.1, 2.6, sx * 1.9, 0, sz * (RW / 2 + 1.4), 8); for (const sz of [-1, 1]) { b.cyl("g", 0.09, 0.09, 2.6, 0, 0, sz * (RW / 2 + 1.4), 8); b.box("w", 0.8, 1.1, 1.0, 0.4, 0, sz * 0.9 * 0 + sz * (RW / 2 + 0.35)); }
  const bars = new THREE.Group(); for (const sz of [-1, 1]) { const bb = new Builder(); bb.box("w", 0.15, 0.8, 0.15, 0, 0, 0); const arm = new Builder(); for (let i = 0; i < 6; i++) arm.box(i % 2 ? "w" : "d", 0.12, 0.1, RW / 2 * 0.85 / 6 * 2, 0, 0, 0 + 0 * i); bb.merge(arm, 0, 0, 0, 0, 1); const G = bb.group(MK); G.position.set(-3.2, 0, sz * (RW / 2 - 0.1)); bars.add(G);
    const ab = new Builder(); for (let i = 0; i < 6; i++) ab.box(i % 2 ? "w" : "d", 0.12, 0.1, RW / 2 * 0.85 / 6, 0, 0.8, -sz * (RW * 0.85 / 2 / 6) * (i + 0.5)); const AG = ab.group(MK); AG.position.set(-3.2, 0, sz * (RW / 2 - 0.1)); bars.add(AG); }
  for (const sz of [-1, 1]) for (let i = 0; i < 4; i++) b.box("l", 0.6, 0.4, 0.3, -5 + i * 0.9, 0, sz * (RW / 2 + 1.0));
  for (let i = 0; i < 8; i++) b.cone("d", 0.14, 0.4, -4.8 + i * 0.5, 0, (i % 2 ? 1 : -1) * (RW * 0.25) * 0, 6);
  for (const sz of [-1, 1]) { b.cyl("g", 0.04, 0.04, 4, 4.6, 0, sz * (RW / 2 + 2.2), 6); b.box("w", 0.9, 0.55, 0.03, 4.1, 3.3, sz * (RW / 2 + 2.2)); b.cyl("g", 0.05, 0.05, 3.2, 5.2, 0, sz * (RW / 2 + 2.2), 6); b.box("l", 0.35, 0.4, 0.04, 5.2, 2.6, sz * (RW / 2 + 2.1)); }
  const G = b.group(MK); G.add(bars); return { g: G, r: 7.2, len: L + 2, wid: RW + 5, h: 4, pad: true, dom: "land", kind: "prop", ang90: true }; }
function barrierG(E, p = {}) { const { MK } = E, b = new Builder(); b.box("w", 0.5, 0.9, 0.5, 0, 0, 0); for (let i = 0; i < 6; i++) b.box(i % 2 ? "w" : "d", 0.9, 0.12, 0.12, 0.45 + i * 0.9 * 0, 0.9, -0.0 + 0 * i); const G = b.group(MK); return { g: G, r: 1.2, h: 1, dom: "land", kind: "prop" }; }
function excavatorG(E, p = {}) { const g = K.excavator(E.KM), s = p.scale ?? 2.4; g.scale.setScalar(s); shadowAll(g); const arm = g.userData.arm;
  return { g, r: s * 0.6, len: s * 1.0, wid: s * 0.6, h: s * 0.7, dom: "land", kind: "machine", anim: t => { arm.rotation.z = -0.25 + Math.sin(t * 0.7 + (p.ph ?? 0)) * 0.3; g.rotation.x = 0; } }; }
function spoil(E, p = {}) { const { rnd, MK } = E, b = new Builder(), r = p.r ?? R(rnd, 3, 6); b.sph("s", r, 0, 0, 0, 1.3, 0.38, 1, 12); for (let i = 0; i < 3; i++) b.sph("s", r * 0.5, R(rnd, -r, r) * 0.8, 0, R(rnd, -r, r) * 0.8, 1.2, 0.4, 1, 8);
  return { g: b.group(MK), r: r * 1.25, h: r * 0.38, dom: "land", kind: "nature", noPad: true }; }
function hut(E, p = {}) { return shed(E, { w: R(E.rnd, 1.6, 2.4), d: R(E.rnd, 1.3, 1.8) }); }
function crateStack(E, p = {}) { const { rnd, MK } = E, b = new Builder(); for (let i = 0; i < 6; i++) b.box(pickOf(rnd, ["w", "g", "l"]), R(rnd, 0.6, 1.2), 0.5, 0.6, R(rnd, -1.5, 1.5), Math.floor(rnd() * 2) * 0.5, R(rnd, -1, 1), rnd() * 0.6); return { g: b.group(MK), r: 2, h: 1.1, dom: "land", kind: "prop", noPad: true }; }
// ---- added 2026-11-14 by film-china (see ENGINE-UPDATES.md): wind turbine, solar array, high-speed train (train wagon:"hsr"), drone, market stall, 19th-century mill ----
function windTurbine(E, p = {}) { const { rnd, MK } = E, b = new Builder(), H = p.h ?? R(rnd, 9, 11), Lb = p.blade ?? H * 0.48;   // tapered tower + nacelle; rotor turns (anim); faces +x
  b.cyl("l", 1.1, 1.1, 0.25, 0, 0, 0, 16); b.cyl("w", 0.16, 0.34, H, 0, 0.25, 0, 14); b.cyl("g", 0.36, 0.36, 0.12, 0, 0.25 + H * 0.05, 0, 14);
  b.box("w", 1.5, 0.5, 0.52, 0.15, H + 0.25, 0); b.box("g", 0.4, 0.06, 0.3, -0.45, H + 0.75, 0); b.box("d", 0.5, 0.04, 0.54, 0.25, H + 0.45, 0);
  const rot = new THREE.Group(), rb = new Builder(); rb.add("w", new THREE.SphereGeometry(0.26, 12, 8), 0, 0, 0, 0, 1.5, 1, 1);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const g = new THREE.BoxGeometry(0.06, Lb, 0.26); g.translate(0, Lb / 2 + 0.15, 0); const tip = new THREE.BoxGeometry(0.05, Lb * 0.2, 0.14); tip.translate(0, Lb * 0.95, 0);
    rb.add("w", g, 0, 0, 0, 0, 1, 1, 1, a, 0); rb.add("g", tip, 0, 0, 0, 0, 1, 1, 1, a, 0); }
  rot.add(rb.group(MK)); rot.position.set(0.98, H + 0.5, 0); const G = b.group(MK); G.add(rot); const ph = p.ph ?? rnd() * 6.28, sp = p.speed ?? R(rnd, 0.7, 1.0);
  return { g: G, r: 1.6, h: H + Lb + 0.5, pad: true, dom: "land", kind: "prop", anim: t => { rot.rotation.x = ph + t * sp; } }; }
function solarArray(E, p = {}) { const { rnd, MK } = E, b = new Builder(), rows = p.rows ?? 6, cols = p.cols ?? 9, pw = 1.5, pd = 1.0, gap = 0.55, tilt = 0.45;   // rows of tilted panels on legs
  for (let rI = 0; rI < rows; rI++) { const z = (rI - (rows - 1) / 2) * (pd + gap + 0.4);
    for (let c = 0; c < cols; c++) { const x = (c - (cols - 1) / 2) * (pw + 0.08); b.box("g", 0.06, 0.55, 0.06, x - pw * 0.35, 0, z + 0.25); b.box("g", 0.06, 0.25, 0.06, x - pw * 0.35, 0, z - 0.25); b.box("g", 0.06, 0.55, 0.06, x + pw * 0.35, 0, z + 0.25); b.box("g", 0.06, 0.25, 0.06, x + pw * 0.35, 0, z - 0.25);
      b.add("d", new THREE.BoxGeometry(pw, 0.05, pd), x, 0.52, z, 0, 1, 1, 1, tilt, 0); b.add("w", new THREE.BoxGeometry(pw + 0.04, 0.03, 0.04), x, 0.52 + Math.sin(tilt) * pd * 0.5 + 0.03, z + Math.cos(tilt) * pd * 0.5, 0, 1, 1, 1, tilt, 0);
      for (let k = 1; k < 4; k++) b.add("l", new THREE.BoxGeometry(0.02, 0.055, pd * 0.96), x - pw / 2 + k * pw / 4, 0.525, z, 0, 1, 1, 1, tilt, 0); } }
  const L = cols * (pw + 0.08), W = rows * (pd + gap + 0.4); if (p.inverter !== false) { b.box("w", 1.2, 0.9, 0.8, L / 2 + 1.3, 0, 0); b.box("d", 0.5, 0.4, 0.04, L / 2 + 1.3, 0.25, 0.41); }
  return { g: b.group(MK), r: Math.hypot(L + 3, W) / 2, len: L, wid: W, h: 1.2, pad: true, dom: "land", kind: "building" }; }
function hsrTrain(E, p = {}) { const { rnd, MK } = E, n = p.n ?? 7, WL = 1.9, parts = [];   // streamlined power cars at both ends + smooth coaches with a window band and roof fairing
  const coach = () => { const w = new Builder(); w.box("w", WL - 0.06, 0.62, 0.66, 0, 0.16, 0); w.add("w", new THREE.CylinderGeometry(0.33, 0.33, WL - 0.06, 16), 0, 0.78, 0, 0, 0.32, 1, 1, 0, Math.PI / 2);
    w.box("d", WL - 0.3, 0.16, 0.67, 0, 0.52, 0); w.box("g", WL - 0.06, 0.05, 0.68, 0, 0.3, 0); w.box("d", WL - 0.2, 0.08, 0.5, 0, 0.08, 0); return w; };
  const nose = (dir) => { const w = coach(); const g = new THREE.SphereGeometry(0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2); g.rotateZ(-Math.PI / 2 * dir); w.add("w", g, dir * (WL / 2 - 0.03), 0.47, 0, 0, 3.4, 0.95, 1.0);
    w.add("d", new THREE.BoxGeometry(0.42, 0.04, 0.44), dir * (WL / 2 + 0.22), 0.7, 0, 0, 1, 1, 1, 0, -dir * 0.42); return w; };
  parts.push(nose(1).group(MK)); for (let i = 0; i < n - 2; i++) parts.push(coach().group(MK)); parts.push(nose(-1).group(MK));
  const G = new THREE.Group(); parts.forEach((q, i) => { q.position.x = -i * (WL + 0.06); G.add(q); }); const TL = n * (WL + 0.06) + 1.4;
  return { g: G, r: 1.2, len: TL, wid: 0.8, h: 1, dom: "land", kind: "train", cars: parts, spacing: WL + 0.06, trainLen: TL }; }
function drone(E, p = {}) { const { rnd, MK } = E, b = new Builder(), s = p.scale ?? 1, alt = p.alt ?? R(rnd, 2.2, 4.2);   // quadcopter hovering above its pad (bob + slow yaw); pad on the ground
  const g0 = new Builder(); g0.cyl("l", 0.3 * s, 0.3 * s, 0.03, 0, 0, 0, 16); g0.box("d", 0.26 * s, 0.01, 0.04 * s, 0, 0.035, 0);
  b.box("w", 0.34 * s, 0.12 * s, 0.22 * s, 0, 0, 0); b.box("d", 0.08 * s, 0.07 * s, 0.1 * s, 0.17 * s, -0.04 * s, 0);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { b.limb("g", V(0, 0.06 * s, 0), V(sx * 0.32 * s, 0.08 * s, sz * 0.32 * s), 0.025 * s, 5); b.cyl("g", 0.04 * s, 0.04 * s, 0.07 * s, sx * 0.32 * s, 0.06 * s, sz * 0.32 * s, 8); b.cyl("l", 0.17 * s, 0.17 * s, 0.012, sx * 0.32 * s, 0.14 * s, sz * 0.32 * s, 16);
    b.box("g", 0.02 * s, 0.12 * s, 0.02 * s, sx * 0.1 * s, -0.12 * s, sz * 0.08 * s); }
  const body = b.group(MK); body.position.y = alt; const G = g0.group(MK); G.add(body); const ph = p.ph ?? rnd() * 6.28;
  return { g: G, r: 0.7 * s, h: alt + 0.3, dom: "land", kind: "prop", noPad: true, anim: t => { body.position.y = alt + Math.sin(t * 1.3 + ph) * 0.18; body.rotation.y = ph + Math.sin(t * 0.25 + ph) * 0.6; } }; }
function stall(E, p = {}) { const { rnd, MK } = E, b = new Builder(), w = p.w ?? R(rnd, 1.3, 1.9), d = 1.0;   // market stall: counter, back shelf with boxes, striped awning
  b.box(pickOf(rnd, ["w", "l"]), w, 0.5, 0.45, 0, 0, 0.25); b.box("g", w + 0.04, 0.04, 0.5, 0, 0.5, 0.25); b.box("w", w, 0.95, 0.12, 0, 0, -0.45);
  for (let i = 0; i < 4; i++) b.box(pickOf(rnd, ["d", "g", "w"]), 0.18, 0.12, 0.1, -w / 2 + 0.25 + i * (w - 0.4) / 3, 0.52, 0.25);
  for (let i = 0; i < 3; i++) b.box(pickOf(rnd, ["g", "l", "d"]), w * 0.28, 0.16, 0.1, -w / 3 + i * w / 3, 0.6, -0.36);
  for (const x of [-w / 2, w / 2]) for (const z of [-0.48, 0.48]) b.box("g", 0.05, 1.25, 0.05, x, 0, z);
  const st = 5; for (let i = 0; i < st; i++) b.add(i % 2 ? "w" : "g", new THREE.BoxGeometry(w / st, 0.04, d + 0.3), -w / 2 + (i + 0.5) * w / st, 1.3, 0.08, 0, 1, 1, 1, -0.25, 0);
  return { g: b.group(MK), r: Math.hypot(w, d) / 2 + 0.15, w, d, h: 1.45, pad: true, dom: "land", kind: "building" }; }
function mill(E, p = {}) { const { rnd, MK } = E, b = new Builder(), L = p.len ?? R(rnd, 9, 12), W = 3.0, fl = p.floors ?? 4, fh = 0.75, H = fl * fh;   // 19th-c. textile mill: long multi-storey block, gable roof, stair/bell tower, chimney, waterwheel (turns)
  b.box("s", L, H, W); windowsRow(b, rnd, L, W, fl, fh, 0.05); b.prism("g", W + 0.25, 0.9, L + 0.25, 0, H, 0, Math.PI / 2); for (let i = 0; i < 6; i++) b.box("w", 0.3, 0.32, 0.4, -L / 2 + 1 + i * (L - 2) / 5, H + 0.25, W * 0.18);
  b.box("w", 1.4, H + 1.4, 1.4, -L / 2 + 0.2, 0, W / 2 + 0.3); b.box("g", 1.5, 0.12, 1.5, -L / 2 + 0.2, H + 1.4, W / 2 + 0.3); for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) b.box("w", 0.12, 0.8, 0.12, -L / 2 + 0.2 + x, H + 1.52, W / 2 + 0.3 + z);
  b.cone("g", 0.95, 1.1, -L / 2 + 0.2, H + 2.32, W / 2 + 0.3, 4, Math.PI / 4); b.cyl("s", 0.32, 0.5, H + 4.2, L / 2 + 1.3, 0, -W / 2 + 0.6, 12); b.cyl("d", 0.36, 0.36, 0.2, L / 2 + 1.3, H + 4.0, -W / 2 + 0.6, 12);
  b.box("w", 2.2, 1.2, 1.6, L / 2 + 1.2, 0, 0.6); b.prism("g", 1.8, 0.5, 2.3, L / 2 + 1.2, 1.2, 0.6, Math.PI / 2);
  const wh = new THREE.Group(), wb = new Builder(), Rw = 1.25; for (const zz of [-0.22, 0.22]) { const tor = new THREE.TorusGeometry(Rw, 0.06, 6, 24); wb.add("g", tor, 0, 0, zz); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; wb.add("w", new THREE.BoxGeometry(0.08, Rw * 2, 0.06), 0, 0, 0, 0, 1, 1, 1, 0, a); wb.add("l", new THREE.BoxGeometry(0.34, 0.06, 0.5), Math.cos(a) * Rw, Math.sin(a) * Rw, 0, 0, 1, 1, 1, 0, a); }
  wb.add("d", new THREE.CylinderGeometry(0.14, 0.14, 0.6, 10), 0, 0, 0, 0, 1, 1, 1, Math.PI / 2, 0); wh.add(wb.group(MK)); wh.position.set(-L * 0.12, Rw * 0.55, W / 2 + 0.4);
  const G = b.group(MK); G.add(wh); return { g: G, r: Math.hypot(L + 3, W + 2) / 2, len: L, wid: W, h: H + 4.4, pad: true, dom: "land", kind: "building", anim: t => { wh.rotation.z = -t * 0.6; } }; }

const siteGroup = (b, MK) => { const G = b.group(MK); G.traverse(m => { if (m.isMesh) m.userData.noFocus = true; }); return G; };   // ground slabs / plazas / tree rings: never turn red with the focus
// ---- tech / chips vocabulary (added 2026-11-14 for the Nvidia film; generic, seeded, data-driven) ----
function datacenter(E, p = {}) { const { rnd, MK } = E, b = new Builder(), L = p.len ?? R(rnd, 16, 22), W = p.wid ?? R(rnd, 7, 9), h = 1.7;   // long windowless hall, rooftop chiller grid, generator yard, substation
  b.box("w", L, h, W); b.box("l", L + 0.2, 0.12, W + 0.2, 0, h, 0); b.box("g", L * 0.96, 0.06, 0.3, 0, h * 0.62, W / 2 + 0.02);
  const fans = new THREE.Group(), cols = Math.floor(L / 1.6), rows = Math.max(2, Math.floor(W / 2.4));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const x = -L / 2 + (i + 0.5) * L / cols, z = -W / 2 + (j + 0.5) * W / rows; b.box("l", 1.25, 0.42, 1.25, x, h + 0.12, z); b.cyl("d", 0.48, 0.48, 0.05, x, h + 0.55, z, 16);
    const fb = new Builder(); fb.box("g", 0.86, 0.03, 0.12); fb.box("g", 0.12, 0.03, 0.86); const fg = fb.group(MK); fg.position.set(x, h + 0.6, z); fans.add(fg); }
  for (let i = 0; i < 4; i++) { const x = -L / 2 + 1.4 + i * 2.2; b.box("g", 1.8, 1.0, 1.0, x, 0, -W / 2 - 1.3); b.cyl("d", 0.12, 0.12, 0.7, x + 0.6, 1.0, -W / 2 - 1.3, 8); }   // diesel gensets
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const x = L / 2 + 1.6 + j * 1.6, z = -W / 2 + 1 + i * 2.2; b.box("d", 0.9, 0.8, 0.9, x, 0, z); b.cyl("g", 0.05, 0.05, 1.8, x, 0.8, z, 6); b.box("g", 1.2, 0.05, 0.05, x, 2.4, z); }   // substation
  const site = new Builder(); site.box("l", L + 6, 0.06, W + 5, 1.2, -0.03, -0.4); const G = b.group(MK); G.add(fans); G.add(siteGroup(site, MK)); shadowAll(fans);
  return { g: G, r: Math.hypot(L + 6, W + 5) / 2, len: L + 4, wid: W + 3, h: h + 0.8, pad: true, dom: "land", kind: "building", ang90: true, anim: t => { fans.children.forEach((f, i) => { f.rotation.y = t * (2.2 + (i % 3) * 0.3); }); } }; }
function campus(E, p = {}) { const { rnd, MK } = E, b = new Builder(), S = p.size ?? R(rnd, 18, 24), h = 2.4, tri = p.tri ?? 7;   // big low tech HQ: triangular footprint, glass band, triangle-pattern roof, plaza + trees ring
  const sh = new THREE.Shape(); for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 3; const x = Math.cos(a) * S * 0.58, z = Math.sin(a) * S * 0.58; k ? sh.lineTo(x, z) : sh.moveTo(x, z); } sh.closePath();
  const body = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); body.rotateX(Math.PI / 2); body.translate(0, h, 0); b.add("w", body);
  const band = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false }); band.rotateX(Math.PI / 2); band.scale(1.005, 1, 1.005); band.translate(0, h * 0.62, 0); b.add("d", band);
  for (let i = 0; i < tri; i++) for (let j = 0; j <= i; j++) { const u = (j - i / 2) * S * 0.95 / tri, v = -S * 0.29 + i * S * 0.86 / tri; if (rnd() < 0.15) continue; b.add(((i + j) % 2) ? "l" : "g", new THREE.ConeGeometry(S * 0.07, 0.6, 3), u, h + 0.3, v - S * 0.0, Math.PI, 1, 1, 1); }
  const site = new Builder(); site.cyl("l", S * 0.75, S * 0.75, 0.06, 0, -0.03, 0, 40); for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; site.cyl("g", 0.08, 0.08, 0.6, Math.cos(a) * S * 0.7, 0, Math.sin(a) * S * 0.7, 6); site.sph("l", 0.55, Math.cos(a) * S * 0.7, 1.0, Math.sin(a) * S * 0.7); }
  for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 3 + Math.PI / 3; site.box("l", S * 0.5, 0.05, 1.6, Math.cos(a) * S * 0.52, 0, Math.sin(a) * S * 0.52, -a + Math.PI / 2); }   // footpaths
  const Gc = b.group(MK); Gc.add(siteGroup(site, MK));
  return { g: Gc, r: S * 0.78, len: S * 1.5, wid: S * 1.5, h: h + 0.6, pad: true, dom: "land", kind: "building" }; }
function fab(E, p = {}) { const { rnd, MK } = E, b = new Builder(), L = p.len ?? R(rnd, 15, 19), W = p.wid ?? R(rnd, 9, 11), h = 3.0;   // chip fab: tall clean-room block, stepped utility roof, exhaust stacks, gas tanks, link bridge to an office block
  b.box("w", L, h, W); b.box("l", L * 0.7, 0.9, W * 0.8, -L * 0.1, h, 0); for (let i = 0; i < 6; i++) b.box("g", 1.0, 0.5, 1.0, -L * 0.4 + i * L * 0.13, h + 0.9, W * 0.25);
  for (let i = 0; i < 4; i++) { const x = L * 0.25 + (i % 2) * 1.4, z = -W * 0.3 + Math.floor(i / 2) * 1.6; b.cyl("l", 0.3, 0.36, 3.2, x, h, z, 12); b.cyl("d", 0.33, 0.33, 0.15, x, h + 3.1, z, 12); }
  for (let i = 0; i < 3; i++) b.cyl("l", 0.65, 0.65, 3.6, -L / 2 - 1.4, 0, -W / 2 + 1.2 + i * 1.7, 14), b.sph("l", 0.65, -L / 2 - 1.4, 3.6, -W / 2 + 1.2 + i * 1.7);
  b.box("w", 5, 2.2, 3.4, L / 2 + 4.2, 0, W / 2 - 2.2); windowsRow(b, rnd, 5, 3.4, 3, 0.7, 0.1); b.box("l", 3.4, 0.6, 0.9, L / 2 + 1.7, 1.4, W / 2 - 2.2);
  b.box("g", L + 0.1, 0.1, W + 0.1, 0, h * 0.5, 0); const site = new Builder(); site.box("l", L + 10, 0.06, W + 5, 1.5, -0.03, 0); const Gf = b.group(MK); Gf.add(siteGroup(site, MK));
  return { g: Gf, r: Math.hypot(L + 10, W + 5) / 2, len: L + 8, wid: W + 3, h: h + 3.4, pad: true, dom: "land", kind: "building", ang90: true }; }
function cargoJet(E, p = {}) { const { MK } = E, b = new Builder(), L = p.len ?? 9, s = L / 9;   // parked wide-body freighter on a stand, nose door, wings with 4 engines
  b.add("w", new THREE.CylinderGeometry(0.55 * s, 0.55 * s, L * 0.78, 16), 0, 1.1 * s, 0, 0, 1, 1, 1, 0, Math.PI / 2); b.add("w", new THREE.SphereGeometry(0.55 * s, 14, 10), L * 0.39, 1.1 * s, 0, 0, 1.6, 1, 1);
  b.add("w", new THREE.ConeGeometry(0.55 * s, L * 0.22, 14), -L * 0.5, 1.25 * s, 0, 0, 1, 1, 1, 0, Math.PI / 2); b.box("d", 0.25 * s, 0.12 * s, 0.9 * s, L * 0.45, 1.25 * s, 0);
  for (const sd of [-1, 1]) { b.add("l", new THREE.BoxGeometry(1.7 * s, 0.1 * s, 4.6 * s), 0.1 * L, 0.9 * s, sd * 2.6 * s, sd * -0.32); for (const e of [1.6, 3.2]) b.cyl("g", 0.22 * s, 0.22 * s, 0.9 * s, 0.1 * L + 0.75 * s - e * 0.25 * s, 0.4 * s, sd * e * s, 10);
    b.add("l", new THREE.BoxGeometry(0.8 * s, 0.07 * s, 1.6 * s), -L * 0.5, 1.4 * s, sd * 0.9 * s, sd * -0.3); }
  b.add("l", new THREE.BoxGeometry(1.2 * s, 1.3 * s, 0.08 * s), -L * 0.52, 1.95 * s, 0, 0, 1, 1, 1, 0, 0.35); for (const x of [0.36, -0.05, 0.05]) b.cyl("d", 0.1 * s, 0.1 * s, 0.55 * s, x * L, 0, x > 0.2 ? 0 : (x < 0 ? -0.5 : 0.5) * s, 8);
  return { g: b.group(MK), r: L * 0.6, len: L, wid: 5.4 * s, h: 2.6 * s, pad: true, dom: "land", kind: "vehicle" }; }

export const GEN = { datacenter, campus, fab, cargoJet, house, tower, midrise, shed, warehouse, factory, govHall, refinery, tankFarm, pipeRack, silo, flareStack, conveyor, pumpStation, containerYard, gantryCrane: gantry,
  truck: containerTruck, car: carG, bus: busG, train, people, tanker: tankerV, containerShip: containerV, warship: warshipV, carrier: flattopV, tug: tugV, dredger: dredgerV, bulkCarrier: bulkV, icebreaker: icebreakerV,
  fishingBoat: fishingV, skiff: skiffV, ferry: ferryV, buoy, mountain, rocks, iceberg, plantation, lighthouse, radarMast, watchtower, helipad, checkpoint, barrier: barrierG, excavator: excavatorG, spoil, hut, crates: crateStack,
  windTurbine, solarArray, drone, stall, mill };

// ============================== path-based parts (composer passes polylines with y) ==============================
export function ribbonGeo(pts, ys, w, yoff = 0.0) {   // flat strip along polyline (x,z) pairs, per-point y
  const pos = [], idx = []; const n = pts.length; for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], c = pts[Math.min(n - 1, i + 1)]; let tx = c[0] - a[0], tz = c[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const nx = -tz * w / 2, nz = tx * w / 2, y = ys[i] + yoff; pos.push(pts[i][0] + nx, y, pts[i][1] + nz, pts[i][0] - nx, y, pts[i][1] - nz); if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const na = g.attributes.normal; for (let i = 0; i < na.count; i++) if (na.getY(i) < 0) na.setXYZ(i, -na.getX(i), -na.getY(i), -na.getZ(i));
  return g; }
export function alongPath(pts, step, fn) { let acc = 0, next = step * 0.5; for (let i = 1; i < pts.length; i++) { const dx = pts[i][0] - pts[i - 1][0], dz = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dz); while (acc + l >= next) { const u = (next - acc) / l; fn(pts[i - 1][0] + dx * u, pts[i - 1][1] + dz * u, Math.atan2(dz, dx), i - 1 + u); next += step; } acc += l; } }
export function roadBuild(b, pts, ys, w, bridgeFlags) {   // asphalt ribbon + edge lines + dashes + kerb; bridges get deck, piers, rails
  const segs = []; let cur = null; for (let i = 0; i < pts.length; i++) { const br = bridgeFlags[i]; if (!cur || cur.br !== br) { if (cur) cur.e = i; cur = { br, s: Math.max(0, i - 1), e: pts.length - 1 }; segs.push(cur); } } if (cur) cur.e = pts.length - 1;
  for (const sg of segs) { const P = pts.slice(sg.s, sg.e + 1), Y = ys.slice(sg.s, sg.e + 1); if (P.length < 2) continue; if (!sg.br) { b.add("l", ribbonGeo(P, Y, w, 0.04)); b.add("w", ribbonGeo(P, Y, w * 0.9, 0.055)); b.add("l", ribbonGeo(P, Y, w * 0.86, 0.065)); }
    else { b.add("k", ribbonGeo(P, Y, w, 0.04)); for (const s of [-1, 1]) { const A = P.map((q, i) => { const a = P[Math.max(0, i - 1)], c = P[Math.min(P.length - 1, i + 1)]; let tx = c[0] - a[0], tz = c[1] - a[1]; const l = Math.hypot(tx, tz) || 1; return [q[0] - tz / l * s * (w / 2 + 0.05), q[1] + tx / l * s * (w / 2 + 0.05)]; });
        b.add("w", ribbonGeo(A, Y, 0.16, 0.0)); b.add("g", ribbonGeo(A, Y.map(y => y + 0.35), 0.1, 0)); for (let i = 0; i < A.length; i += 2) b.box("g", 0.08, 0.35, 0.08, A[i][0], Y[i] + 0.04, A[i][1]); }
      b.add("g", ribbonGeo(P, Y.map(y => y - 0.3), w + 0.3, 0)); alongPath(P, 7, (x, z, a, u) => { const y = Y[Math.min(Y.length - 1, Math.floor(u))]; b.cyl("g", 0.38, 0.38, y + 1.6, x, -1.5, z, 10); b.box("l", w + 0.5, 0.2, 0.7, x, y - 0.2, z, -a); }); } }
  alongPath(pts, 3.0, (x, z, a, u) => { const i = Math.min(pts.length - 1, Math.floor(u)); if (bridgeFlags[i]) { b.box("w", 1.0, 0.012, 0.09, x, ys[i] + 0.06, z, -a); return; } b.box("w", 1.0, 0.012, 0.09, x, ys[i] + 0.07, z, -a); }); }
export function railBuild(b, pts, ys) { alongPath(pts, 0.55, (x, z, a, u) => { const i = Math.min(ys.length - 1, Math.floor(u)); b.box("g", 0.16, 0.06, 1.15, x, ys[i] + 0.02, z, -a); });
  for (const s of [-1, 1]) { const A = pts.map((q, i) => { const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)]; let tx = c[0] - a[0], tz = c[1] - a[1]; const l = Math.hypot(tx, tz) || 1; return [q[0] - tz / l * s * 0.34, q[1] + tx / l * s * 0.34]; }); b.add("d", ribbonGeo(A, ys, 0.09, 0.1)); }
  b.add("l", ribbonGeo(pts, ys, 1.5, 0.0)); }
export function pipelineBuild(b, pts, hs, ground, rnd, n = 2, r = 0.34) {   // n parallel pipes on trestles: hs = pipe-centre height per point, ground = terrain y per point
  const off = n === 1 ? [0] : n === 2 ? [-0.6, 0.6] : [-1.0, 0, 1.0];
  off.forEach((o, k) => { const P = pts.map((q, i) => { const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)]; let tx = c[0] - a[0], tz = c[1] - a[1]; const l = Math.hypot(tx, tz) || 1; return V(q[0] - tz / l * o, hs[i], q[1] + tx / l * o); });
    for (let i = 0; i < P.length - 1; i++) b.limb(k % 2 ? "l" : "w", P[i], P[i + 1], r, 8); for (let i = 0; i < P.length; i += 9) b.sph("l", r * 1.25, P[i].x, P[i].y, P[i].z, 1, 1, 1, 8); });
  alongPath(pts, 5.5, (x, z, a, u) => { const i = Math.min(pts.length - 1, Math.floor(u)), g0 = ground[i], hh = hs[i] - r - g0, wd = (off.length - 1) * 1.2 + 1.0;
    if (hh > 0.05) { for (const o of [-wd / 2, wd / 2]) b.box("g", 0.16, hh, 0.16, x - Math.sin(a) * 0 + (-Math.sin(a)) * o * 0 + (Math.cos(a + Math.PI / 2)) * o, g0, z + Math.sin(a + Math.PI / 2) * o); b.box("l", 0.2, 0.12, wd + 0.5, x, hs[i] - r - 0.1, z, -a); } else b.box("g", 0.3, 0.16, wd, x, g0, z, -a); });
  alongPath(pts, 38, (x, z, a, u) => { const i = Math.min(pts.length - 1, Math.floor(u)); b.box("w", 1.1, 0.55, 1.1, x, hs[i] + r, z, -a); b.cyl("d", 0.12, 0.12, 0.5, x, hs[i] + r + 0.55, z, 8); }); }
export function fenceBuild(b, pts, ys, h = 0.7, gap = 1.6) { alongPath(pts, gap, (x, z, a, u) => { const i = Math.min(ys.length - 1, Math.floor(u)); b.box("g", 0.07, h, 0.07, x, ys[i], z); }); for (let i = 0; i < pts.length - 1; i++) { const a = V(pts[i][0], ys[i] + h * 0.85, pts[i][1]), c = V(pts[i + 1][0], ys[i + 1] + h * 0.85, pts[i + 1][1]); b.limb("l", a, c, 0.03, 4); b.limb("l", a.clone().setY(a.y - h * 0.4), c.clone().setY(c.y - h * 0.4), 0.025, 4); } }
