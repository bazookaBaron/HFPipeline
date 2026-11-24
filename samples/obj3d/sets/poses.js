// POSED MANNEQUIN (v3, builder B): a procedural jointed art mannequin, posed once at build time (no animation) and merged per material.
// posedPerson(M, o) -> THREE.Group. Standing height 1 unit, origin on the floor, facing +x, right side = +z (same convention as kit.js person
// after its +z build is turned to +x). Seated poses: origin = floor point under the seat centre (hip joint); feet reach forward to x ~ 0.3.
// M = { white, grey, dark } materials (the KM set); every part uses one of those three, so the focus swap (FOCUSMAP / setFocus) recolours it.
// o = { pose, build 0.8..1.5, hat none|cap|hard|peak, hair none|short|bun|long, coat bool, tie bool, skirt bool, prop, seed, seated?, height? }
//   seated:true turns an upper-body pose (applaud, raise_hand, phone, speak, point, look_down, stand_arms_crossed) into its seated version.
// userData: { pose, seatH (seated: seat-surface height to match a chair), hand: Vector3 (right-hand centre, local), head: Vector3, top }
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ---------- documented constants (figure units; multiply by the figure's scale; PERSON_M = suggested metres per unit in room scale) ----------
export const PERSON_M = 1.75;         // a 1-unit figure scaled by 1.75 in a 1 unit = 1 m room is a 1.75 m adult
export const SEAT_H = 0.245;          // chair seat-surface height that seated poses sit on (0.43 m at PERSON_M)
export const DESK_H = 0.415;          // desk / table top height that sit_type / sit_lean hands and elbows rest on (0.73 m)
export const DESK_EDGE = 0.17;        // desk front edge distance ahead of the seat centre (knees go under the desk)
export const DESK_X = 0.27;           // x of the typing hands (on the desk, ahead of the seat centre)
export const HANDSHAKE_GAP = 0.5;     // origin-to-origin distance of handshake_L / handshake_R placed facing each other: right hands meet exactly
export const EMBRACE_GAP = 0.2;       // same for embrace_L / embrace_R
export const POSES = ["stand", "stand_hips", "stand_arms_crossed", "phone", "point", "speak", "raise_hand", "applaud", "salute", "walk", "run", "carry",
  "sit", "sit_type", "sit_lean", "sit_listen", "handshake_L", "handshake_R", "embrace_L", "embrace_R", "kneel", "bow", "look_down"];
export const SEATED = new Set(["sit", "sit_type", "sit_lean", "sit_listen"]);
export const isSeated = o => SEATED.has(o.pose) || !!o.seated;
// partner position for pair poses: a figure at (x,z) with heading h (rotation.y) faces fwd = (cos h, -sin h); its partner stands at
export function partnerAt(x, z, h, gap = HANDSHAKE_GAP) { return { x: x + Math.cos(h) * gap, z: z - Math.sin(h) * gap, h: h + Math.PI }; }

// ---------- proportions ----------
const ANK = 0.035, SHIN = 0.235, THIGH = 0.245, SPINE = 0.27, UA = 0.17, FA = 0.15, HANDL = 0.034, FOOT = 0.085;
const V = (x, y, z) => new THREE.Vector3(x, y, z), X1 = V(1, 0, 0), Y1 = V(0, 1, 0), Z1 = V(0, 0, 1);
function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// cached unit geometries (non-indexed, no uv) -> cloned + transformed per part
const GC = {}; const cg = (k, f) => { if (!GC[k]) { let g = f(); g = g.index ? g.toNonIndexed() : g; g.deleteAttribute("uv"); GC[k] = g; } return GC[k]; };
const SPH = () => cg("s", () => new THREE.SphereGeometry(1, 11, 8));
const HEMI = () => cg("h", () => new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2));
const CYL = (rt = 1) => cg("c" + rt.toFixed(2), () => new THREE.CylinderGeometry(rt, 1, 1, 10, 1, false));
const BOX = () => cg("b", () => new THREE.BoxGeometry(1, 1, 1));
const _m = new THREE.Matrix4();

// basis: Y = up; Z = side hint orthogonalised; X = Y x Z (forward)
function basisUS(up, side) { const Y = up.clone().normalize(), Z = side.clone().addScaledVector(Y, -side.dot(Y)); if (Z.lengthSq() < 1e-8) Z.copy(Z1); Z.normalize(); return [new THREE.Vector3().crossVectors(Y, Z), Y, Z]; }
function basisUF(up, fwd) { const Y = up.clone().normalize(), Z = new THREE.Vector3().crossVectors(fwd, Y); if (Z.lengthSq() < 1e-8) Z.copy(Z1); Z.normalize(); return [new THREE.Vector3().crossVectors(Y, Z), Y, Z]; }

class Parts {
  constructor() { this.p = { w: [], g: [], d: [] }; }
  put(k, geo, c, B, sx, sy, sz) { _m.makeBasis(B[0].clone().multiplyScalar(sx), B[1].clone().multiplyScalar(sy), B[2].clone().multiplyScalar(sz)); _m.setPosition(c); this.p[k].push(geo.clone().applyMatrix4(_m)); }
  ell(k, c, B, rx, ry, rz) { this.put(k, SPH(), c, B, rx, ry, rz); }
  box(k, c, B, sx, sy, sz) { this.put(k, BOX(), c, B, sx, sy, sz); }
  // capsule-ish limb a->b, radii ra (at a) rb (at b), optional width factor along side vector
  limb(k, a, b, ra, rb = ra, side = Z1, wk = 1) { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); if (L < 1e-5) return;
    const B = basisUS(d, side.clone().lengthSq() > 0 && Math.abs(side.clone().normalize().dot(d.clone().normalize())) < 0.98 ? side : X1);
    const mid = a.clone().add(b).multiplyScalar(0.5), t = ra / rb; this.put(k, CYL(+t.toFixed(2)), mid, [B[0].clone().negate(), B[1].clone().negate(), B[2]], rb, L, rb * wk);
    this.put(k, SPH(), a, B, ra, ra, ra * wk); this.put(k, SPH(), b, B, rb, rb, rb * wk); }
  group(M) { const G = new THREE.Group();
    for (const k of ["w", "g", "d"]) { if (!this.p[k].length) continue; const mat = (k === "w" ? M.white : k === "g" ? M.grey : M.dark) || M.white || M.WHITE;
      const m = new THREE.Mesh(mergeGeometries(this.p[k], false), mat); m.castShadow = m.receiveShadow = true; G.add(m); }
    return G; }
}
// 2-bone IK: root a, target t, lengths l1 l2, pole direction -> joint position (target clamped to reach)
function ik(a, t, l1, l2, pole) { const d = new THREE.Vector3().subVectors(t, a); let D = d.length(); const dir = d.clone().normalize(); D = Math.min(D, (l1 + l2) * 0.999); D = Math.max(D, Math.abs(l1 - l2) + 1e-3);
  const x = (l1 * l1 - l2 * l2 + D * D) / (2 * D), h = Math.sqrt(Math.max(0, l1 * l1 - x * x)); const p = pole.clone().addScaledVector(dir, -pole.dot(dir)); if (p.lengthSq() < 1e-8) p.set(0, -1, 0); p.normalize();
  return { joint: a.clone().addScaledVector(dir, x).addScaledVector(p, h), end: a.clone().addScaledVector(dir, D) }; }

// ---------- pose table ----------
// lower bodies set pelvis + feet; upper bodies set arms (hand targets relative to the shoulder joint `s:[dx,dy,dz]` with z mirrored for the
// left arm, or absolute `a:[x,y,z]`), lean, head. j(x) = seeded jitter in [-x, x].
function lowerBody(kind, J) { const { j, rnd } = J, sw = 0.058 + j(0.012);
  switch (kind) {
    case "stand": return { pc: V(j(0.006), 0.522, 0), legs: { L: { at: [j(0.015), -sw], yaw: -0.18 + j(0.08) }, R: { at: [j(0.015) + 0.01, sw], yaw: 0.18 + j(0.08) } } };
    case "wide": return { pc: V(0, 0.515, 0), legs: { L: { at: [0, -0.085], yaw: -0.25 }, R: { at: [0.005, 0.085], yaw: 0.25 } } };
    case "walk": { const st = 0.15 + j(0.015); return { pc: V(0.0, 0.5, 0), twist: 0.1, legs: { L: { at: [st, -0.05], lift: -0.18, pole: [1, 0.2, 0] }, R: { at: [-st - 0.025, 0.05], lift: 0.55, pole: [1, 0, 0] } } }; }
    case "run": return { pc: V(0.05, 0.47, 0), twist: 0.18, legs: { L: { at: [0.14, -0.05], y: 0.19, lift: 0.25, pole: [1, 0.3, 0] }, R: { at: [-0.25, 0.05], lift: 1.05, pole: [1, 0, 0] } } };
    case "sit": { const kn = 0.07 + j(0.02), cross = J.cross; const s = { pc: V(-0.012, 0.302, 0), seated: true,
        legs: { L: { at: [0.25 + j(0.015), -kn], y: 0.045, yaw: -0.1, pole: [1, 0.35, -0.15] }, R: { at: [0.25 + j(0.015), kn], y: 0.045, yaw: 0.1, pole: [1, 0.35, 0.15] } } };
      if (cross) s.legs.R = { ankle: [0.29, 0.13, -0.035], foot: [0.9, -0.42, -0.12], pole: [1, 0.7, 0.25] };
      if (J.legsBack) { s.legs.L.at[0] = 0.17; s.legs.R.at && (s.legs.R.at[0] = 0.19); }
      return s; }
    case "kneel": return { pc: V(-0.04, 0.315, 0), legs: { L: { at: [0.2, -0.065], pole: [1, 0.4, 0] }, R: { ankle: [-0.26, 0.045, 0.07], foot: [-0.15, -0.6, 0], pole: [1, -0.2, 0], knee: [-0.035, 0.05, 0.07] } } };
    default: return lowerBody("stand", J); } }

function poseSpec(pose, J) { const { j, rnd } = J, seat = J.seated;
  const hang = (side, out = 0.04) => ({ s: [0.012 + j(0.012), -0.325, side * (out + j(0.01))], pole: [-1, 0, side * 0.35] });
  const low = seat ? "sit" : "stand"; let S;
  switch (pose) {
    case "stand": { const v = Math.floor(rnd() * 3); S = { low, lean: 0.02, arms: { L: hang(-1), R: v === 2 ? { s: [0.13, -0.2, 0.0], pole: [-0.5, -1, 0.4] } : hang(1) } };
      if (v === 2) S.arms.L = { s: [0.13, -0.22, 0.02], pole: [-0.5, -1, -0.4] };   // hands loosely clasped in front
      break; }
    case "stand_hips": S = { low: "wide", lean: -0.02, arms: { L: { s: [0.0, -0.245, -0.035], pole: [-0.4, 0, -1] }, R: { s: [0.0, -0.245, 0.035], pole: [-0.4, 0, 1] } } }; break;
    case "stand_arms_crossed": S = { low: seat ? "sit" : "wide", lean: -0.03, arms: { L: { s: [0.12, -0.13, 0.17], pole: [0.3, -1, -0.6] }, R: { s: [0.14, -0.11, -0.17], pole: [0.3, -1, 0.6] } }, head: { pitch: -0.05 } }; break;
    case "phone": if (rnd() < 0.55 || J.prop === "phone_ear") S = { low, lean: 0.03, arms: { L: hang(-1), R: { s: [0.035, 0.125, -0.035], pole: [0.2, -1, 0.6] } }, head: { roll: 0.2, pitch: 0.1 }, phone: "ear" };
      else S = { low, lean: 0.07, arms: { L: { s: [0.17, -0.17, 0.08], pole: [-0.3, -1, -0.4] }, R: { s: [0.17, -0.165, -0.06], pole: [-0.3, -1, 0.4] } }, head: { pitch: 0.55 }, phone: "text" }; break;
    case "point": S = { low, lean: 0.03, arms: { L: hang(-1), R: { s: [0.6, 0.02, 0.0], pole: [0, -1, 0] } }, head: { yaw: 0 } }; break;
    case "speak": { const up = rnd() < 0.5; S = { low, lean: 0.04, arms: { L: up ? { s: [0.17, -0.2, 0.05], pole: [-0.4, -1, -0.5] } : hang(-1), R: { s: [0.2, -0.13 + j(0.03), 0.07], pole: [-0.3, -1, 0.6] } }, head: { pitch: -0.05, roll: j(0.1) }, openHand: true }; break; }
    case "raise_hand": S = { low, lean: 0.0, arms: { L: hang(-1), R: { s: [0.04, 0.4, 0.03], pole: [0, 0, 1] } }, head: { pitch: -0.15 } }; if (seat) S.arms.L = { s: [0.2, -0.24, 0.07], pole: [-0.3, -1, -0.4] }; break;
    case "applaud": S = { low, lean: 0.05, arms: { L: { s: [0.2, -0.13, 0.1], pole: [0, -0.6, -1] }, R: { s: [0.2, -0.13, -0.1], pole: [0, -0.6, 1] } }, head: { pitch: -0.08 }, clap: true }; break;
    case "salute": S = { low: seat ? "sit" : "stand", lean: -0.02, arms: { L: hang(-1, 0.025), R: { s: [0.08, 0.12, -0.065], pole: [0.25, 0.25, 1] } }, head: { pitch: -0.08 } }; break;
    case "walk": S = { low: "walk", lean: 0.05, arms: { L: { s: [-0.14, -0.3, -0.05], pole: [-1, 0, -0.2] }, R: { s: [0.14, -0.29, 0.045], pole: [-1, -0.3, 0.2] } }, head: { pitch: 0.05 } }; break;
    case "run": S = { low: "run", lean: 0.3, arms: { L: { s: [-0.1, -0.2, -0.04], pole: [-1, 0.6, 0] }, R: { s: [0.16, -0.12, -0.02], pole: [-1, -0.6, 0.2] } }, head: { pitch: -0.15 } }; break;
    case "carry": S = { low, lean: -0.05, arms: { L: { s: [0.19, -0.2, 0.0], pole: [-0.4, -1, -0.5] }, R: { s: [0.19, -0.2, 0.0], pole: [-0.4, -1, 0.5] } }, head: { pitch: 0.05 }, carryBox: true }; break;
    case "sit": S = { low: "sit", lean: 0.05, arms: { L: { a: [0.17, 0.355, -0.085], pole: [-1, -0.5, -0.2] }, R: { a: [0.17, 0.355, 0.085], pole: [-1, -0.5, 0.2] } } }; break;
    case "sit_listen": S = { low: "sit", lean: -0.03, arms: { L: { a: [0.15, 0.345, -0.025], pole: [-0.6, -1, -0.3] }, R: { a: [0.16, 0.35, 0.03], pole: [-0.6, -1, 0.3] } }, head: { pitch: -0.05 } }; break;
    case "sit_type": S = { low: "sit", lean: 0.14, legsBack: false, arms: { L: { a: [DESK_X, DESK_H + 0.018, -0.085], pole: [-0.6, -1, -0.3] }, R: { a: [DESK_X + 0.01, DESK_H + 0.018, 0.085], pole: [-0.6, -1, 0.3] } }, head: { pitch: 0.12 } }; break;
    case "sit_lean": S = { low: "sit", lean: 0.36, arms: { L: { a: [0.3, DESK_H + 0.022, 0.0], pole: [-1, -0.2, -0.6] }, R: { elbow: [0.25, DESK_H + 0.024, 0.11], chin: true } }, head: { pitch: 0.1, roll: 0.15 } }; break;
    case "handshake_L": case "handshake_R": { const R2 = pose === "handshake_R";
      S = { low, lean: 0.05, arms: { R: { a: [HANDSHAKE_GAP / 2, 0.55, 0.0], pole: [-0.3, -1, 0.5] }, L: R2 ? { a: [HANDSHAKE_GAP / 2 - 0.06, 0.575, -0.03], pole: [-0.2, -1, -0.6] } : hang(-1) }, head: { pitch: 0.05 }, exact: true }; break; }
    case "embrace_L": case "embrace_R": { const g = EMBRACE_GAP, over = pose === "embrace_L";
      S = { low, lean: 0.06, arms: over ? { L: { a: [g + 0.075, 0.74, -0.06], pole: [0, 0.4, -1] }, R: { a: [g + 0.075, 0.72, 0.065], pole: [0, 0.4, 1] } }
                                       : { L: { a: [g + 0.08, 0.6, -0.07], pole: [-0.2, -0.6, -1] }, R: { a: [g + 0.08, 0.6, 0.07], pole: [-0.2, -0.6, 1] } },
        head: { yaw: over ? 0.5 : -0.5, roll: over ? -0.3 : 0.3, side: over ? -0.04 : 0.04 }, exact: true }; break; }
    case "kneel": S = { low: "kneel", lean: 0.08, arms: { L: { a: [0.21, 0.31, -0.07], pole: [-1, 0, -0.4] }, R: hang(1) }, head: { pitch: 0.2 } }; break;
    case "bow": S = { low: "stand", lean: 0.62, pcx: -0.035, arms: { L: { s: [0.05, -0.32, -0.03], pole: [-1, 0, -0.2] }, R: { s: [0.05, -0.32, 0.03], pole: [-1, 0, 0.2] } }, head: { pitch: 0.35 } }; break;
    case "look_down": S = { low, lean: 0.07, arms: { L: { s: [0.12, -0.24, 0.07], pole: [-0.4, -1, -0.3] }, R: { s: [0.12, -0.24, -0.07], pole: [-0.4, -1, 0.3] } }, head: { pitch: 0.6 } }; break;
    default: S = poseSpec("stand", J); }
  if (seat && S.low === "stand") S.low = "sit";
  return S; }

// ---------- builder ----------
export function posedPerson(M, o = {}) {
  const pose = POSES.includes(o.pose) ? o.pose : "stand", rnd = rng((o.seed ?? 1) * 7919 + 13), b = Math.max(0.8, Math.min(1.5, o.build ?? 1));
  const seat = SEATED.has(pose) || !!o.seated;
  const J = { rnd, j: x => (rnd() * 2 - 1) * x, seated: seat, prop: o.prop, cross: false, legsBack: false };
  const S = poseSpec(pose, J);
  if (S.low === "sit" && (pose === "sit_listen" || pose === "sit") && rnd() < 0.35 && !o.skirtDown) J.cross = true;
  const exact = !!S.exact || pose === "sit_type" || pose === "applaud"; const jit = exact ? 0.003 : 0.016;
  const LB = lowerBody(S.low, J), P = new Parts();
  const bw = b, wk = 0.85 + 0.15 * bw, shw = 0.097 * Math.min(1.25, 0.88 + 0.12 * bw), hhw = 0.05 * Math.min(1.25, bw * 0.9 + 0.1);
  // wardrobe
  const coat = !!o.coat, longCoat = coat && (o.longCoat ?? rnd() < 0.3), suit = coat && (o.suit ?? rnd() < 0.7), skirt = !!o.skirt;
  const top = coat ? "g" : "w", legK = suit && !skirt ? "g" : "w";
  // ----- torso -----
  const lean = (S.lean ?? 0) + J.j(exact ? 0.01 : 0.04), tw = LB.twist ?? 0;
  const pc = LB.pc.clone(); if (S.pcx) pc.x += S.pcx;
  const u = V(Math.sin(lean), Math.cos(lean), 0), wv = V(Math.sin(tw), 0, Math.cos(tw)), TB = basisUS(u, wv), fw = TB[0], sd = TB[2];
  const pt = k => pc.clone().addScaledVector(u, k);
  const sc = pt(SPINE), shL = sc.clone().addScaledVector(sd, -shw).addScaledVector(u, -0.022), shR = sc.clone().addScaledVector(sd, shw).addScaledVector(u, -0.022);
  const PB = basisUS(Y1, Z1);  // pelvis stays level (no twist on the hips)
  P.ell(legK === "g" ? "g" : top === "g" && longCoat ? "g" : "w", pc, PB, 0.078, 0.072, 0.104 * bw);                  // pelvis
  P.ell(top, pt(0.1), TB, 0.068 * Math.min(1.35, b * 0.95 + 0.05), 0.095, 0.098 * wk);                                     // abdomen
  if (b > 1.18) P.ell(top, pt(0.085).addScaledVector(fw, 0.025 * b), TB, 0.075 * b, 0.085, 0.1 * b);                         // belly
  P.ell(top, pt(0.2), TB, 0.074, 0.098, 0.122 * wk);                                                                        // chest
  for (const s of [-1, 1]) P.ell(top, (s < 0 ? shL : shR).clone().addScaledVector(u, 0.006), TB, 0.04, 0.034, 0.04);        // deltoids
  if (coat) { P.box("w", pt(0.235).addScaledVector(fw, 0.066), TB, 0.012, 0.075, 0.034);                                   // shirt V
    if (!seat || true) { const hemTop = pt(0.035), hemLen = longCoat ? (seat ? 0.12 : 0.27) : 0.115, hd = u.clone().negate();
      const hb = basisUS(seat && longCoat ? V(0.55, -0.8, 0) : hd.clone().negate(), sd); const hc = hemTop.clone().addScaledVector(seat && longCoat ? V(0.55, -0.8, 0).normalize() : hd, hemLen / 2);
      P.put("g", CYL(0.78), hc, [hb[0], hb[1], hb[2]], 0.112 * bw * (longCoat ? 1.08 : 1), hemLen, 0.118 * bw * (longCoat ? 1.15 : 1)); }
    P.box("g", pt(0.245).addScaledVector(fw, 0.06).addScaledVector(sd, -0.025), basisUS(u.clone().applyAxisAngle(fw, -0.25), sd), 0.014, 0.08, 0.016);   // lapels
    P.box("g", pt(0.245).addScaledVector(fw, 0.06).addScaledVector(sd, 0.025), basisUS(u.clone().applyAxisAngle(fw, 0.25), sd), 0.014, 0.08, 0.016); }
  if (o.tie) P.box("d", pt(0.2).addScaledVector(fw, coat ? 0.074 : 0.072), TB, 0.008, 0.13, 0.02);
  if (skirt && !seat) { const ws = pt(-0.01); const L = 0.25, c = ws.clone().add(V(0, -L / 2, 0)); P.put(top === "g" ? "g" : "g", CYL(0.72), c, basisUS(Y1, Z1), 0.135 * bw, L, 0.14 * bw * (S.low === "walk" || S.low === "run" ? 1.25 : 1)); }
  // ----- neck + head -----
  const H = S.head ?? {}, hp = (H.pitch ?? 0) + J.j(exact ? 0.03 : 0.12) + lean * 0.4, hy = (H.yaw ?? 0) + J.j(exact ? 0.05 : 0.3), hr = (H.roll ?? 0) + J.j(0.08);
  const nb = pt(SPINE + 0.005); const hu = V(Math.sin(hp) * Math.cos(hy), Math.cos(hp), Math.sin(hp) * Math.sin(hy) + Math.sin(hr)).normalize();
  const hf = V(Math.cos(hy), 0, -Math.sin(hy)); const HB = basisUF(hu, hf); const hcen = nb.clone().addScaledVector(hu, 0.083); if (H.side) hcen.addScaledVector(sd, H.side);
  P.limb("w", nb.clone().addScaledVector(u, -0.02), nb.clone().addScaledVector(hu, 0.03), 0.024, 0.022);
  P.ell("w", hcen, HB, 0.058, 0.074, 0.056);
  P.ell("w", hcen.clone().addScaledVector(hu, -0.035).addScaledVector(HB[0], 0.022), HB, 0.04, 0.035, 0.04);             // jaw mass (faceless)
  const hair = o.hair ?? "none", hat = o.hat ?? "none";
  if (hair !== "none" && hat !== "hard") { const back = HB[1].clone().applyAxisAngle(HB[2], 0.45); const hB = basisUS(back, HB[2]);
    P.put("d", HEMI(), hcen.clone().addScaledVector(HB[1], 0.004).addScaledVector(HB[0], -0.004), hB, 0.0615, 0.074, 0.06);
    if (hair === "bun") P.ell("d", hcen.clone().addScaledVector(HB[0], -0.058).addScaledVector(HB[1], 0.03), HB, 0.027, 0.027, 0.027);
    if (hair === "long") P.ell("d", hcen.clone().addScaledVector(HB[0], -0.04).addScaledVector(HB[1], -0.045), basisUS(Y1, HB[2]), 0.032, 0.085, 0.062); }
  const crown = hcen.clone().addScaledVector(HB[1], 0.06);
  if (hat === "cap") { P.put("g", CYL(0.92), crown.clone().addScaledVector(HB[1], 0.0), HB, 0.062, 0.04, 0.06); P.box("g", crown.clone().addScaledVector(HB[0], 0.06).addScaledVector(HB[1], -0.016), HB, 0.06, 0.006, 0.07); }
  if (hat === "peak") { P.put("d", CYL(1.15), crown.clone().addScaledVector(HB[1], 0.008), HB, 0.062, 0.05, 0.062); P.box("d", crown.clone().addScaledVector(HB[0], 0.058).addScaledVector(HB[1], -0.016), basisUS(HB[1].clone().applyAxisAngle(HB[2], -0.3), HB[2]), 0.045, 0.006, 0.07);
    P.put("w", CYL(1), crown.clone().addScaledVector(HB[1], -0.012), HB, 0.064, 0.01, 0.064); }
  if (hat === "hard") { P.put("w", HEMI(), hcen.clone().addScaledVector(HB[1], 0.022), HB, 0.072, 0.07, 0.068); P.put("w", CYL(1), hcen.clone().addScaledVector(HB[1], 0.024).addScaledVector(HB[0], 0.012), HB, 0.088, 0.006, 0.078);
    P.box("w", hcen.clone().addScaledVector(HB[1], 0.07), HB, 0.08, 0.012, 0.014); }
  // ----- legs -----
  const legR = 0.047 * (0.8 + 0.2 * Math.min(bw, 1.35)), shinR = 0.036 * (0.85 + 0.15 * Math.min(bw, 1.3));
  const skinnyLeg = skirt ? 0.82 : 1;
  for (const [nm, s] of [["L", -1], ["R", 1]]) { const Ls = LB.legs[nm], hip = pc.clone().add(V(0, -0.02, s * hhw));
    let ankle, fdir; if (Ls.ankle) { ankle = V(...Ls.ankle); fdir = V(...(Ls.foot || [1, 0, 0])).normalize(); }
    else { const lift = Ls.lift ?? 0, yaw = Ls.yaw ?? 0, tx = Ls.at[0] + FOOT, tz = Ls.at[1];
      fdir = V(Math.cos(lift), -Math.sin(lift), 0).applyAxisAngle(Y1, -yaw * 1);
      ankle = Ls.y != null ? V(Ls.at[0], Ls.y, tz) : V(tx - FOOT * Math.cos(lift), ANK + FOOT * Math.max(0, Math.sin(lift)), tz); }
    let knee; if (Ls.knee) knee = V(...Ls.knee); else knee = ik(hip, ankle, THIGH, SHIN, V(...(Ls.pole || [1, 0.1, 0]))).joint;
    if (!Ls.knee) { const r = ik(hip, ankle, THIGH, SHIN, V(...(Ls.pole || [1, 0.1, 0]))); ankle = r.end; }
    P.limb(legK, hip, knee, legR * skinnyLeg, legR * 0.8 * skinnyLeg, sd);
    P.limb(legK, knee, ankle, shinR * skinnyLeg, shinR * 0.72 * skinnyLeg, sd);
    const sole = V(0, -1, 0).addScaledVector(fdir, -fdir.y).normalize();   // perpendicular to the foot, pointing down
    const fs = basisUF(sole.clone().negate(), fdir); const shoeK = "d";
    P.limb(shoeK, ankle.clone().addScaledVector(fdir, -0.018).addScaledVector(sole, 0.012), ankle.clone().addScaledVector(fdir, 0.07).addScaledVector(sole, 0.019), 0.021, 0.019, fs[2], 1.25);
    if (skirt && seat) P.limb("g", hip.clone().add(V(0.02, 0.02, 0)), knee.clone().add(V(0, 0.018, 0)), legR * 1.25, legR * 1.15, sd);
    if (seat && longCoat && !skirt) P.limb("g", hip.clone().add(V(0.03, 0.025, 0)), hip.clone().lerp(knee, 0.75).add(V(0, 0.02, 0)), legR * 1.18, legR * 1.12, sd); }
  // ----- arms -----
  const armR = 0.03 * (0.85 + 0.15 * Math.min(bw, 1.4)), foreR = 0.025 * (0.85 + 0.15 * Math.min(bw, 1.35)); const out = { hands: {} };
  const sleeve = top;
  for (const [nm, s] of [["L", -1], ["R", 1]]) { const A = S.arms[nm], sh = s < 0 ? shL : shR; let el, wr, hc;
    if (A.elbow) { el = V(...A.elbow); const chin = hcen.clone().addScaledVector(hu, -0.07).addScaledVector(HB[0], 0.05);
      const d = chin.clone().sub(el).normalize(); wr = el.clone().addScaledVector(d, FA); hc = wr.clone().addScaledVector(d, HANDL); }
    else { const tgt = A.a ? V(...A.a) : sh.clone().add(V(A.s[0], A.s[1], A.s[2] * (A.a ? 1 : 1) * (s < 0 ? -1 : 1) * 1)); if (!A.a && s < 0) tgt.z = sh.z - A.s[2];
      if (!A.a && s > 0) tgt.z = sh.z + A.s[2];
      tgt.x += J.j(jit); tgt.y += J.j(jit); tgt.z += J.j(jit * 0.6);
      const pole = V(...A.pole); const r = ik(sh, tgt, UA, FA + HANDL, pole); el = r.joint; hc = r.end; const d = hc.clone().sub(el).normalize(); wr = el.clone().addScaledVector(d, FA); }
    P.limb(sleeve, sh, el, armR, armR * 0.88, fw); P.limb(sleeve, el, wr, foreR, foreR * 0.85, fw);
    if (coat) P.limb("w", wr.clone().addScaledVector(wr.clone().sub(el).normalize(), -0.01), wr.clone().addScaledVector(wr.clone().sub(el).normalize(), 0.006), foreR * 0.86, foreR * 0.8, fw);   // cuff
    const hd = hc.clone().sub(wr).normalize(); const hB = basisUS(hd, s > 0 ? V(0, 0, 1) : V(0, 0, -1));
    P.ell("w", hc.clone().addScaledVector(hd, -0.006), hB, 0.03, 0.038, 0.017); if (S.openHand && s > 0) P.ell("w", hc.clone().addScaledVector(hd, 0.03), hB, 0.012, 0.012, 0.012);
    out.hands[nm] = { hc, wr, el, hd }; }
  // ----- props (right hand) -----
  const RH = out.hands.R, LH = out.hands.L, prop = S.carryBox ? "box" : (S.phone ? "phone" : o.prop);
  const fb = basisUS(RH.hd, fw);
  if (prop === "phone") { if (S.phone === "text") { const c = RH.hc.clone().lerp(LH.hc, 0.5).add(V(0.012, 0.01, 0)); P.box("d", c, basisUS(V(-0.5, 1, 0), Z1), 0.075, 0.008, 0.04); }
    else P.box("d", RH.hc.clone().addScaledVector(fw, -0.004).add(V(0, 0.02, -0.01)), basisUS(V(0.3, 1, 0), Z1), 0.03, 0.075, 0.01); }
  else if (prop === "papers") { const c = RH.hc.clone().add(V(0.015, 0.005, -0.02)); P.box("w", c, basisUS(V(-0.6, 1, 0), Z1), 0.1, 0.006, 0.075); P.box("g", c.clone().add(V(0.003, -0.006, 0.004)), basisUS(V(-0.6, 1, 0), Z1), 0.1, 0.004, 0.075); }
  else if (prop === "box") { const c = RH.hc.clone().lerp(LH.hc, 0.5).add(V(0.02, 0.035, 0)); P.box("g", c, basisUS(Y1, Z1), 0.15, 0.13, Math.max(0.16, Math.abs(RH.hc.z - LH.hc.z) - 0.02)); P.box("w", c.clone().add(V(0, 0.066, 0)), basisUS(Y1, Z1), 0.152, 0.005, 0.05); }
  else if (prop === "briefcase") { const c = RH.hc.clone().add(V(0, -0.075, 0.0)); P.box("d", c, basisUS(Y1, X1), 0.12, 0.09, 0.028); P.box("d", RH.hc.clone().add(V(0, -0.025, 0)), basisUS(Y1, X1), 0.035, 0.012, 0.01); }
  else if (prop === "gavel") { const t = RH.hc.clone().addScaledVector(RH.hd, 0.06); P.limb("d", RH.hc, t, 0.007, 0.007); P.limb("d", t.clone().addScaledVector(fw, -0.025), t.clone().addScaledVector(fw, 0.025), 0.016, 0.016); }
  else if (prop === "mic") { const t = RH.hc.clone().add(V(0.005, 0.06, -0.01)); P.limb("d", RH.hc.clone().add(V(0, -0.02, 0)), t, 0.008, 0.01); P.ell("d", t, basisUS(Y1, Z1), 0.017, 0.017, 0.017); }
  else if (prop === "cup") P.put("w", CYL(1.15), RH.hc.clone().add(V(0.01, 0.022, 0)), basisUS(Y1, Z1), 0.017, 0.045, 0.017);
  else if (prop === "laptop") { if (seat) { const c = V(DESK_X + 0.02, DESK_H + 0.006, 0); P.box("g", c, basisUS(Y1, Z1), 0.11, 0.01, 0.16); P.box("d", c.clone().add(V(0.065, 0.05, 0)), basisUS(V(-0.3, 1, 0), Z1), 0.008, 0.1, 0.16); }
    else P.box("g", RH.hc.clone().add(V(0.0, 0.03, -0.035)), basisUS(Y1, X1), 0.15, 0.11, 0.012); }
  else if (prop === "sign") { const t = RH.hc.clone().add(V(0.01, 0.38, 0)); P.limb("g", RH.hc.clone().add(V(0, -0.04, 0)), t, 0.008, 0.008); P.box("w", t.clone().add(V(0, 0.07, 0)), basisUS(Y1, Z1), 0.012, 0.16, 0.26); P.box("d", t.clone().add(V(0.007, 0.07, 0)), basisUS(Y1, Z1), 0.002, 0.11, 0.2); }
  else if (prop === "camera") { const c = shR.clone().add(V(0.05, 0.075, -0.01)); P.box("d", c, basisUS(Y1, Z1), 0.16, 0.08, 0.06); P.put("d", CYL(1), c.clone().add(V(0.105, 0.0, 0)), basisUS(X1, Z1), 0.03, 0.06, 0.03); P.box("g", c.clone().add(V(-0.02, 0.05, 0)), basisUS(Y1, Z1), 0.06, 0.02, 0.02); }
  else if (prop === "photo") { const c = hcen.clone().addScaledVector(HB[0], 0.085).add(V(0, -0.005, 0)); P.box("d", c, basisUS(Y1, Z1), 0.035, 0.05, 0.08); P.put("d", CYL(1), c.clone().add(V(0.035, 0, 0)), basisUS(X1, Z1), 0.022, 0.04, 0.022); }
  const G = P.group(M); G.userData = { pose, hand: RH.hc.clone(), handL: LH.hc.clone(), head: hcen.clone(), top: crown.y + (hat !== "none" ? 0.04 : 0) };
  if (seat) G.userData.seatH = SEAT_H;
  return G; }

// props that change the arms: for a TV camera or photo camera the arms must hold it; posedPerson handles "carry" (box) itself.
export function propPose(prop, pose) { if (prop === "camera" || prop === "photo") return "stand"; return pose; }
