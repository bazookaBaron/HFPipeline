// Code-built miniature kit (white world look): clean primitives, merged per material. Sizes are unit-normalised
// (person height 1, car/ship length 1) so the set scales them. No AI meshes.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const UP = new THREE.Vector3(0, 1, 0);
const ni = g => (g.index ? g.toNonIndexed() : g);
function at(g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  return ni(g).applyMatrix4(m); }
function limb(a, b, r) {   // capsule from point a to point b
  const d = new THREE.Vector3().subVectors(b, a), len = d.length(); const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, 10);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()); const mid = a.clone().add(b).multiplyScalar(0.5);
  return ni(g).applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1))); }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function group(parts) { const G = new THREE.Group();
  for (const [mat, geos] of parts) if (geos.length) { const g = mergeGeometries(geos.map(x => { x.deleteAttribute("uv"); return x; }), false);
    const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; G.add(m); }
  return G; }

// ---------------- person: faceless art mannequin. opts: build 0.8..1.5 (thin..fat), hat: none|cap|hard|peak, pose: side|phone|hips|salute
export function person(M, o = {}) {
  const b = o.build ?? 1, w = [], g = [];
  const hipY = 0.47, shY = 0.75, shX = 0.11 * Math.min(1.25, b);
  for (const s of [-1, 1]) {           // legs + feet
    w.push(limb(V(s * 0.055 * b, hipY - 0.02, 0), V(s * 0.055 * b, 0.27, 0.005), 0.05 * Math.min(b, 1.3)));
    w.push(limb(V(s * 0.055 * b, 0.27, 0.005), V(s * 0.055 * b, 0.05, 0), 0.042 * Math.min(b, 1.25)));
    w.push(at(new RoundedBoxGeometry(0.075, 0.04, 0.13, 2, 0.015), s * 0.055 * b, 0.02, 0.025)); }
  w.push(at(new THREE.SphereGeometry(0.1, 16, 12), 0, hipY, 0, 0, 0, 0, 1.15 * b, 0.65, 0.8 * Math.min(b, 1.3)));   // pelvis
  w.push(at(new THREE.CapsuleGeometry(0.085, 0.16, 6, 16), 0, 0.62, 0, 0, 0, 0, 1.25 * b, 1, 0.8 * b));          // torso
  if (b > 1.15) w.push(at(new THREE.SphereGeometry(0.1, 16, 12), 0, 0.56, 0.03 * b, 0, 0, 0, b, 0.95, 0.9 * b)); // belly
  w.push(at(new THREE.CylinderGeometry(0.028, 0.032, 0.05, 10), 0, 0.79, 0));
  const tilt = o.pose === "phone" ? 0.35 : 0, hy = 0.875, hz = o.pose === "phone" ? 0.025 : 0;
  w.push(at(new THREE.SphereGeometry(0.072, 18, 14), 0, hy, hz, tilt, 0, 0, 1, 1.12, 1));                      // head (no face)
  // arms
  for (const s of [-1, 1]) { const sh = V(s * shX * 1.05, shY, 0); let el, wr;
    if (o.pose === "phone") { el = V(s * (shX + 0.01), 0.6, 0.03); wr = V(s * 0.035, 0.66, 0.16); }
    else if (o.pose === "hips") { el = V(s * (shX + 0.11), 0.63, -0.02); wr = V(s * (shX + 0.01), 0.5, 0.02); }
    else if (o.pose === "salute" && s > 0) { el = V(shX + 0.12, 0.8, 0.06); wr = V(0.07, 0.9, 0.08); }
    else { el = V(s * (shX + 0.02), 0.6, 0); wr = V(s * (shX + 0.025), 0.45, 0.01); }
    w.push(limb(sh, el, 0.032 * Math.min(b, 1.3))); w.push(limb(el, wr, 0.027 * Math.min(b, 1.25)));
    w.push(at(new THREE.SphereGeometry(0.028, 10, 8), wr.x, wr.y - 0.015, wr.z)); }
  if (o.pose === "phone") g.push(at(new RoundedBoxGeometry(0.05, 0.008, 0.085, 1, 0.003), 0, 0.68, 0.17, -0.5));   // phone
  if (o.hat === "cap" || o.hat === "peak") { w.push(at(new THREE.CylinderGeometry(0.08, 0.075, o.hat === "peak" ? 0.06 : 0.04, 18), 0, hy + 0.06, hz));
    w.push(at(new THREE.CylinderGeometry(0.05, 0.05, 0.008, 14), 0, hy + 0.035, hz + 0.065, 0, 0, 0, 1.3, 1, 0.9)); }
  if (o.hat === "hard") { w.push(at(new THREE.SphereGeometry(0.083, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0, hy + 0.025, hz));
    w.push(at(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 20), 0, hy + 0.025, hz + 0.01)); }
  return group([[M.white, w], [M.grey, g]]); }

// ---------------- car: length 1. type: hatch|sedan|van|truck|bus
export function car(M, type = "hatch") {
  const w = [], g = [], d = [];
  const spec = { hatch: [1.0, 0.45, 0.58, 0.05], sedan: [1.15, 0.46, 0.55, 0.0], van: [1.15, 0.5, 0.95, 0.15], truck: [1.5, 0.52, 0.4, 0.45], bus: [2.2, 0.55, 1.1, 0] }[type] || [1, 0.45, 0.58, 0.05];
  const [L, Wd, cabL, off] = spec;
  if (type === "bus") { w.push(at(new RoundedBoxGeometry(L, 0.55, Wd, 3, 0.07), 0, 0.37, 0)); g.push(at(new THREE.BoxGeometry(L * 0.92, 0.14, Wd + 0.01), 0, 0.5, 0)); }
  else if (type === "truck") { w.push(at(new RoundedBoxGeometry(0.42, 0.42, Wd, 3, 0.05), L / 2 - 0.22, 0.33, 0)); g.push(at(new THREE.BoxGeometry(0.1, 0.16, Wd * 0.9), L / 2 - 0.02, 0.42, 0));
    w.push(at(new RoundedBoxGeometry(L - 0.5, 0.5, Wd + 0.02, 2, 0.03), -0.24, 0.39, 0)); }
  else { w.push(at(new RoundedBoxGeometry(L, 0.24, Wd, 3, 0.07), 0, 0.22, 0));
    const ch = type === "van" ? 0.26 : 0.19; g.push(at(new RoundedBoxGeometry(cabL, ch, Wd * 0.9, 3, 0.05), -off, 0.33 + ch / 2 - 0.02, 0));
    w.push(at(new RoundedBoxGeometry(cabL * 0.9, 0.035, Wd * 0.86, 2, 0.015), -off, 0.33 + ch - 0.015, 0)); }
  const wx = Math.min(L / 2 - 0.2, 0.35 + (L - 1) * 0.4);
  for (const x of type === "truck" ? [L / 2 - 0.2, -0.15, -0.55] : [wx, -wx]) for (const s of [-1, 1])
    d.push(at(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 16), x, 0.09, s * (Wd / 2 - 0.01), Math.PI / 2));
  return group([[M.white, w], [M.grey, g], [M.dark, d]]); }

// ---------------- ship: length 1. type: cable|cargo
export function ship(M, type = "cable") {
  const w = [], g = [], d = [];
  const sh = new THREE.Shape(); sh.moveTo(-0.5, -0.09); sh.lineTo(0.22, -0.09); sh.quadraticCurveTo(0.45, -0.08, 0.5, 0); sh.quadraticCurveTo(0.45, 0.08, 0.22, 0.09); sh.lineTo(-0.5, 0.09); sh.lineTo(-0.5, -0.09);
  const hull = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 10 });
  hull.rotateX(-Math.PI / 2); w.push(ni(hull));                                   // hull, deck at y=0.1
  g.push(at(new THREE.BoxGeometry(0.98, 0.012, 0.185), -0.02, 0.012, 0));          // waterline band
  if (type === "cable") {
    w.push(at(new RoundedBoxGeometry(0.26, 0.08, 0.14, 2, 0.01), 0.22, 0.15, 0)); w.push(at(new RoundedBoxGeometry(0.2, 0.07, 0.12, 2, 0.01), 0.24, 0.225, 0));
    w.push(at(new RoundedBoxGeometry(0.13, 0.05, 0.1, 2, 0.01), 0.27, 0.285, 0)); g.push(at(new THREE.BoxGeometry(0.135, 0.018, 0.102), 0.275, 0.29, 0));   // bridge windows
    w.push(at(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6), 0.26, 0.38, 0)); w.push(at(new THREE.BoxGeometry(0.004, 0.004, 0.08), 0.26, 0.43, 0));
    w.push(at(new THREE.CylinderGeometry(0.025, 0.03, 0.08, 12), 0.1, 0.16, 0));  // funnel
    w.push(at(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 24), -0.18, 0.17, 0, Math.PI / 2));   // cable drum
    w.push(at(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 24), -0.18, 0.17, 0.06, Math.PI / 2)); w.push(at(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 24), -0.18, 0.17, -0.06, Math.PI / 2));
    for (const s of [-1, 1]) w.push(at(new THREE.BoxGeometry(0.014, 0.17, 0.014), -0.46, 0.18, s * 0.07, 0, 0, 0.35));          // A-frame
    w.push(at(new THREE.BoxGeometry(0.014, 0.014, 0.16), -0.49, 0.26, 0)); }
  else { w.push(at(new RoundedBoxGeometry(0.12, 0.13, 0.15, 2, 0.01), -0.4, 0.17, 0)); g.push(at(new THREE.BoxGeometry(0.122, 0.02, 0.152), -0.4, 0.21, 0));
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) (i + j) % 3 ? w.push(at(new THREE.BoxGeometry(0.11, 0.05, 0.065), -0.2 + i * 0.12, 0.13 + j * 0.05, (i % 2 ? 1 : -1) * 0.04)) : g.push(at(new THREE.BoxGeometry(0.11, 0.05, 0.065), -0.2 + i * 0.12, 0.13 + j * 0.05, 0.04)); }
  return group([[M.white, w], [M.grey, g], [M.dark, d]]); }

// ================= additions for the Suez film (existing exports above are untouched) =================
const placeQ = (g, p, q, s = 1) => ni(g).applyMatrix4(new THREE.Matrix4().compose(p, q, new THREE.Vector3(s, s, s)));
const hullShape = (hw, bow = 0.5) => { const sh = new THREE.Shape(); sh.moveTo(-0.5, -hw); sh.lineTo(0.22, -hw); sh.quadraticCurveTo(0.45, -hw * 0.9, bow, 0); sh.quadraticCurveTo(0.45, hw * 0.9, 0.22, hw); sh.lineTo(-0.5, hw); sh.lineTo(-0.5, -hw); return sh; };
const hullGeo = (hw, depth) => { const g = new THREE.ExtrudeGeometry(hullShape(hw), { depth, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 10 }); g.rotateX(-Math.PI / 2); return ni(g); };
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };

// container ship, length 1 (bridge aft at -x, bow +x): rows of stacked containers, alternating M.white / M.grey
export function containerShip(M, o = {}) {
  const w = [], g = [], d = [], rows = o.rows ?? 11, cols = 3, step = 0.054, x0 = -0.2;
  w.push(hullGeo(0.09, 0.1)); g.push(at(new THREE.BoxGeometry(0.98, 0.012, 0.185), -0.02, 0.012, 0));
  w.push(at(new RoundedBoxGeometry(0.1, 0.2, 0.15, 2, 0.01), -0.37, 0.2, 0)); g.push(at(new THREE.BoxGeometry(0.102, 0.022, 0.152), -0.37, 0.27, 0));
  w.push(at(new THREE.CylinderGeometry(0.018, 0.022, 0.07, 10), -0.4, 0.34, 0));
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const tiers = 2 + Math.floor(hash(i, j + (o.seed ?? 0)) * 3.2) - (i > rows - 3 ? 1 : 0);
    for (let k = 0; k < Math.max(1, tiers); k++) { const m = (i + j * 2 + k) % 3 === 0 ? g : w;
      m.push(at(new THREE.BoxGeometry(step * 0.92, 0.0245, 0.054), x0 + i * step, 0.1 + 0.0135 + k * 0.026, (j - 1) * 0.0575)); } }
  return group([[M.white, w], [M.grey, g], [M.dark, d]]); }

// tug, length 1 (bow +x)
export function tug(M) {
  const w = [], g = [], d = [];
  w.push(hullGeo(0.17, 0.12)); g.push(at(new THREE.BoxGeometry(0.98, 0.012, 0.35), -0.02, 0.016, 0));
  w.push(at(new RoundedBoxGeometry(0.36, 0.17, 0.3, 2, 0.03), -0.1, 0.205, 0)); w.push(at(new RoundedBoxGeometry(0.24, 0.12, 0.24, 2, 0.03), -0.1, 0.35, 0));
  g.push(at(new THREE.BoxGeometry(0.245, 0.04, 0.245), -0.1, 0.355, 0)); w.push(at(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 12), -0.22, 0.46, 0));
  d.push(at(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 14), 0.5, 0.07, 0, Math.PI / 2)); d.push(at(new THREE.BoxGeometry(0.035, 0.045, 0.34), -0.5, 0.06, 0));
  w.push(at(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 8), 0.2, 0.2, 0, Math.PI / 2, 0, 0));   // towing bitt
  return group([[M.white, w], [M.grey, g], [M.dark, d]]); }

// excavator, ~1 long (tracks along x, arm reaches +x). userData.arm = pivot group (rotate .z to dig)
export function excavator(M) {
  const w = [], g = [], d = [];
  for (const s of [-1, 1]) { d.push(at(new RoundedBoxGeometry(0.74, 0.13, 0.15, 2, 0.04), 0, 0.065, s * 0.21)); }
  w.push(at(new RoundedBoxGeometry(0.52, 0.12, 0.44, 2, 0.03), 0, 0.19, 0)); w.push(at(new RoundedBoxGeometry(0.18, 0.15, 0.4, 2, 0.04), -0.26, 0.26, 0));
  w.push(at(new RoundedBoxGeometry(0.22, 0.2, 0.2, 2, 0.03), 0.08, 0.35, -0.1)); g.push(at(new THREE.BoxGeometry(0.1, 0.1, 0.205), 0.15, 0.36, -0.1));
  const G = group([[M.white, w], [M.grey, g], [M.dark, d]]);
  const arm = group([[M.white, [limb(V(0, 0, 0), V(0.34, 0.26, 0), 0.034), limb(V(0.34, 0.26, 0), V(0.62, -0.02, 0), 0.028)]],
    [M.grey, [at(new RoundedBoxGeometry(0.14, 0.1, 0.19, 2, 0.02), 0.68, -0.07, 0, 0, 0, -0.5)]]]);
  arm.position.set(0.18, 0.3, 0.1); G.add(arm); G.userData.arm = arm; return G; }

// palm tree, height 1
export function palm(M) {
  const w = [], top = V(0.06, 0.88, 0); const pts = [V(0, 0, 0), V(0.01, 0.3, 0), V(0.04, 0.6, 0), top];
  for (let i = 0; i < 3; i++) w.push(limb(pts[i], pts[i + 1], 0.028 - i * 0.004));
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, dir = V(Math.cos(a), -0.45, Math.sin(a)).normalize();
    w.push(placeQ(new THREE.ConeGeometry(0.035, 0.42, 5).scale(1, 1, 0.25), top.clone().addScaledVector(dir, 0.18), new THREE.Quaternion().setFromUnitVectors(UP, dir))); }
  w.push(at(new THREE.SphereGeometry(0.04, 8, 6), top.x, top.y - 0.01, 0));
  return group([[M.white, w]]); }

// dredger, length 1 (cutter ladder + head forward +x)
export function dredger(M) {
  const w = [], g = [], d = [];
  w.push(hullGeo(0.14, 0.1)); g.push(at(new THREE.BoxGeometry(0.98, 0.012, 0.29), -0.02, 0.012, 0));
  w.push(at(new RoundedBoxGeometry(0.2, 0.2, 0.24, 2, 0.02), -0.28, 0.2, 0)); g.push(at(new THREE.BoxGeometry(0.202, 0.03, 0.242), -0.28, 0.27, 0));
  w.push(at(new THREE.CylinderGeometry(0.03, 0.035, 0.12, 10), -0.4, 0.3, 0));
  for (const s of [-1, 1]) w.push(limb(V(0.05, 0.1, s * 0.07), V(0.2, 0.38, s * 0.02), 0.012));
  w.push(limb(V(0.2, 0.38, 0), V(0.62, 0.02, 0), 0.016)); d.push(limb(V(0.1, 0.12, 0.08), V(0.62, 0.02, 0.08), 0.018));
  w.push(at(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12), 0.66, -0.01, 0, Math.PI / 2)); g.push(at(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 12), 0.66, -0.01, 0.055, Math.PI / 2));
  g.push(at(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 12), 0.66, -0.01, -0.055, Math.PI / 2));
  return group([[M.white, w], [M.grey, g], [M.dark, d]]); }
