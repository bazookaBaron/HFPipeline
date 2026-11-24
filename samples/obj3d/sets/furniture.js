// FURNITURE + PROP GRAMMAR (room scale, 1 unit = 1 m). Everything is built from primitives at runtime and seeded (E.rnd).
// FURN[what](E, p) -> item { g, r, len, wid, h, dom:"any", pad (clearance m), anchors:[{type, x, y, z, h, ...}], wall, faceAxis, kind }
//   local frame: origin = footprint centre (recentred from the real geometry), base y = 0, the USER of the item stands/sits on the -x side
//   and faces +x (desk, workbench, shelf, lectern speaker...). Seating that has its back to a wall (sofa, bench, bed, judge) also faces +x.
//   wall: 1 = the +x side goes against a wall (desk, shelf, counter back bar), -1 = the -x side goes against a wall (sofa, judge, jury).
//   faceAxis: local direction (rad) that should face a room's attractor (default 0 = +x).
//   anchors: seat (y = seat height), stand, podium, bench, screen; h = heading (rad) the figure faces: direction (cos h, sin h) in x,z.
// E = { M, KM, KMR, MK, rnd }. Materials by Builder key: w white, g grey, d dark, s sand, l light grey, k dark grey.
import * as THREE from "three";
import { Builder } from "./grammar3d.js";

export const SEAT_H = 0.46, DESK_H = 0.74, BAR_H = 1.05;
const V = (x, y, z) => new THREE.Vector3(x, y, z), TAU = Math.PI * 2, PI = Math.PI, HP = Math.PI / 2;
const R = (r, a, b) => a + (b - a) * r(), pick = (r, a) => a[Math.floor(r() * a.length) % a.length], chance = (r, p) => r() < p;
const put = (b, s, x, z, a = 0, y = 0) => b.merge(s, x, y, z, -a);   // place sub-builder s (built facing +x) facing heading a
const rot = (x, z, a) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];
const anc = (type, x, y, z, h, extra) => ({ type, x, y, z, h, ...(extra || {}) });
const xcyl = (r, len, seg = 12) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(HP); return g; };   // axis along x
const zcyl = (r, len, seg = 12) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(HP); return g; };   // axis along z

// recentre the builder on its x/z footprint, shift anchors with it, and package the item
function fin(E, b, o = {}) {
  const bb = new THREE.Box3(), tb = new THREE.Box3();
  for (const k in b.g) for (const g of b.g[k]) { g.computeBoundingBox(); tb.copy(g.boundingBox); bb.union(tb); }
  const cx = o.cx ?? (bb.min.x + bb.max.x) / 2, cz = o.cz ?? (bb.min.z + bb.max.z) / 2;
  if (Math.abs(cx) > 1e-4 || Math.abs(cz) > 1e-4) for (const k in b.g) for (const g of b.g[k]) g.translate(-cx, 0, -cz);
  const anchors = (o.anchors || []).map(a => ({ ...a, x: a.x - cx, z: a.z - cz }));
  const len = bb.max.x - bb.min.x, wid = bb.max.z - bb.min.z;
  const it = { g: b.group(E.MK), r: Math.hypot(len, wid) / 2, len, wid, h: bb.max.y, dom: "any", pad: o.pad ?? 0.5, anchors, wall: o.wall ?? -1, faceAxis: o.faceAxis ?? 0, kind: o.kind ?? "furniture", tall: bb.max.y > 1.7 };
  if (o.extra) Object.assign(it, o.extra);
  return it;
}

// ============================== small parts (all face +x: a screen's face looks toward -x, where the user is) ==============================
function legs4(b, k, L, W, h, r = 0.02, inset = 0.05) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(k, r, r * 0.85, h, sx * (L / 2 - inset), 0, sz * (W / 2 - inset), 8); }
function monitor(b, x, y, z, a = 0, s = 1, k = "k") { const m = new Builder();
  m.box("k", 0.18 * s, 0.012, 0.2 * s, 0.03, 0, 0); m.box("k", 0.03, 0.2 * s, 0.05, 0.05, 0.012, 0);
  m.box("w", 0.025, 0.32 * s, 0.54 * s, 0.025, 0.12 * s, 0); m.box(k === "k" ? "d" : k, 0.006, 0.28 * s, 0.5 * s, 0.01, 0.14 * s, 0); put(b, m, x, z, a, y); }
function laptop(b, x, y, z, a = 0) { const m = new Builder(); m.box("w", 0.23, 0.014, 0.33, 0, 0, 0); m.box("l", 0.11, 0.003, 0.28, -0.04, 0.014, 0);
  m.box("w", 0.012, 0.22, 0.33, 0.12, 0.01, 0, 0, 0, 0.32); m.box("d", 0.003, 0.19, 0.29, 0.112, 0.022, 0, 0, 0, 0.32); put(b, m, x, z, a, y); }
function papers(b, rnd, x, y, z, a = 0, n) { n = n ?? 1 + Math.floor(rnd() * 4); for (let i = 0; i < n; i++) { const [dx, dz] = rot(R(rnd, -0.01, 0.01), R(rnd, -0.01, 0.01), a);
  b.box(i === 0 && n > 2 ? "l" : "w", 0.297, 0.004, 0.21, x + dx, y + i * 0.004, z + dz, -a + R(rnd, -0.12, 0.12)); } }
function pile(b, rnd, x, y, z, a = 0, hgt = 0.12) { let yy = y; while (yy < y + hgt) { const t = R(rnd, 0.006, 0.03); b.box(pick(rnd, ["w", "w", "l", "s"]), 0.3, t, 0.22, x + R(rnd, -0.012, 0.012), yy, z + R(rnd, -0.012, 0.012), -a + R(rnd, -0.1, 0.1)); yy += t; } }
function mug(b, x, y, z, k = "w") { b.cyl(k, 0.04, 0.036, 0.095, x, y, z, 12); b.box(k, 0.03, 0.05, 0.012, x + 0.045, y + 0.025, z); }
function glass(b, x, y, z) { b.cyl("l", 0.033, 0.028, 0.11, x, y, z, 10); }
function carafe(b, x, y, z) { b.cyl("l", 0.06, 0.07, 0.2, x, y, z, 12); b.cyl("l", 0.03, 0.05, 0.06, x, y + 0.2, z, 10); }
function lamp(b, x, y, z, a = 0) { const m = new Builder(); m.cyl("k", 0.07, 0.08, 0.02, 0, 0, 0, 14); m.limb("k", V(0, 0.02, 0), V(0.08, 0.3, 0), 0.008, 5); m.limb("k", V(0.08, 0.3, 0), V(0.25, 0.36, 0), 0.008, 5);
  m.add("w", new THREE.ConeGeometry(0.07, 0.11, 14, 1, true), 0.27, 0.33, 0, 0, 1, 1, 1, 0, -0.5); m.add("w", new THREE.ConeGeometry(0.07, 0.11, 14), 0.27, 0.33, 0, 0, 1, 1, 1, 0, -0.5); put(b, m, x, z, a, y); }
function tableLamp(b, x, y, z) { b.cyl("w", 0.06, 0.08, 0.03, x, y, z, 14); b.cyl("k", 0.012, 0.012, 0.3, x, y + 0.03, z, 6); b.cyl("w", 0.11, 0.16, 0.2, x, y + 0.3, z, 18); }
function deskPhone(b, x, y, z, a = 0) { const m = new Builder(); m.box("k", 0.18, 0.05, 0.2, 0, 0, 0, 0, 0, 0.12); m.box("d", 0.05, 0.035, 0.2, 0.04, 0.05, 0); put(b, m, x, z, a, y); }
function keyboard(b, x, y, z, a = 0) { const m = new Builder(); m.box("l", 0.15, 0.018, 0.44, 0, 0, 0); m.box("w", 0.09, 0.012, 0.06, -0.01, 0, 0.3); put(b, m, x, z, a, y); }
function nameplate(b, x, y, z, a = 0) { const m = new Builder(); m.prism("w", 0.07, 0.07, 0.24, 0, 0, 0, 0); m.box("d", 0.003, 0.02, 0.16, -0.028, 0.025, 0, 0, 0, 0.45); put(b, m, x, z, a, y); }
function gooseMic(b, x, y, z, a = 0, len = 0.32) { const m = new Builder(); m.cyl("k", 0.04, 0.045, 0.02, 0, 0, 0, 12); m.limb("k", V(0, 0.02, 0), V(-0.04, len * 0.7, 0), 0.006, 5); m.limb("k", V(-0.04, len * 0.7, 0), V(-0.14, len, 0), 0.006, 5);
  m.add("d", xcyl(0.013, 0.05, 8), -0.16, len + 0.005, 0); put(b, m, x, z, a, y); }
function pen(b, x, y, z, a) { b.add("k", xcyl(0.004, 0.14, 5), x, y + 0.004, z, -a + 0.4); }
function binderRow(b, rnd, x0, y, z0, z1, depth, maxH) { let z = z0; while (z < z1 - 0.03) { const t = R(rnd, 0.03, 0.08), h = maxH * R(rnd, 0.7, 0.98); if (z + t > z1) break;
  if (chance(rnd, 0.1)) { z += t * 1.5; continue; } const lean = chance(rnd, 0.06) ? 0.18 : 0; b.box(pick(rnd, ["w", "w", "l", "s", "g"]), depth * R(rnd, 0.8, 0.95), h, t, x0, y, z + t / 2, 0, lean); z += t + 0.003; } }
function bottle(b, x, y, z, h = 0.28, k = "l") { b.cyl(k, 0.035, 0.035, h * 0.68, x, y, z, 10); b.cyl(k, 0.012, 0.03, h * 0.18, x, y + h * 0.68, z, 8); b.cyl(k, 0.012, 0.012, h * 0.14, x, y + h * 0.86, z, 6); }
function cushionBox(b, k, w, h, d, x, y, z, ry = 0) { b.add(k, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, ry); }

// ============================== chairs (sitter faces +x, seat centre at origin) ==============================
export function chairB(rnd, style = "office", o = {}) { const b = new Builder(); let sh = o.seat ?? SEAT_H; const k = o.k ?? "g";
  if (style === "office" || style === "exec" || style === "judge") { const bh = style === "office" ? 0.5 : style === "exec" ? 0.66 : 0.92;
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; b.limb("k", V(0, 0.08, 0), V(Math.cos(a) * 0.29, 0.045, Math.sin(a) * 0.29), 0.016, 5); b.sph("d", 0.026, Math.cos(a) * 0.29, 0.026, Math.sin(a) * 0.29, 1, 1, 1, 6); }
    b.cyl("k", 0.022, 0.03, sh - 0.14, 0, 0.07, 0, 8); b.box("k", 0.28, 0.04, 0.28, 0, sh - 0.12, 0);
    b.box(k, 0.48, 0.075, 0.48, 0.01, sh - 0.075, 0);
    b.box(k, 0.075, bh, 0.47, -0.26, sh + 0.05, 0, 0, 0, 0.1); if (style !== "office") b.box(k, 0.09, 0.05, 0.47, -0.3, sh + 0.05 + bh, 0, 0, 0, 0.1);
    if (o.arms !== false) for (const s of [-1, 1]) { b.box("k", 0.035, 0.2, 0.035, 0.0, sh - 0.02, s * 0.25); b.box(k, 0.26, 0.035, 0.07, 0.02, sh + 0.17, s * 0.255); } }
  else if (style === "stack" || style === "wood") { const kk = style === "wood" ? "w" : "k", kseat = style === "wood" ? "w" : k;
    for (const [x, z] of [[0.19, 0.19], [0.19, -0.19], [-0.19, 0.19], [-0.19, -0.19]]) b.cyl(kk, 0.013, 0.011, sh - 0.03, x, 0, z, 6);
    b.box(kseat, 0.44, 0.035, 0.44, 0, sh - 0.035, 0); for (const s of [-1, 1]) b.box(kk, 0.024, 0.46, 0.024, -0.2, sh, s * 0.19, 0, 0, 0.08);
    if (style === "wood") { b.box("w", 0.03, 0.08, 0.42, -0.23, sh + 0.37, 0, 0, 0, 0.08); for (let i = -1; i <= 1; i++) b.box("w", 0.018, 0.34, 0.03, -0.215, sh + 0.03, i * 0.1, 0, 0, 0.08); }
    else b.box(kseat, 0.03, 0.2, 0.42, -0.218, sh + 0.22, 0, 0, 0, 0.08); }
  else if (style === "arm") { sh = 0.5; b.box(k, 0.74, 0.38, 0.8, 0, 0.04, 0); b.box("l", 0.56, 0.08, 0.58, 0.06, 0.42, 0); b.box(k, 0.2, 0.5, 0.8, -0.28, 0.42, 0, 0, 0, 0.12);
    for (const s of [-1, 1]) b.box(k, 0.64, 0.24, 0.12, 0.04, 0.42, s * 0.34); for (const [x, z] of [[0.3, 0.33], [0.3, -0.33], [-0.3, 0.33], [-0.3, -0.33]]) b.cyl("d", 0.02, 0.015, 0.04, x, 0, z, 6); }
  else if (style === "stool") { sh = o.seat ?? 0.76; b.cyl(k, 0.18, 0.17, 0.05, 0, sh - 0.05, 0, 18); for (let i = 0; i < 4; i++) { const a = i * HP + PI / 4; b.limb("k", V(Math.cos(a) * 0.11, sh - 0.05, Math.sin(a) * 0.11), V(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2), 0.012, 5); }
    b.add("k", new THREE.TorusGeometry(0.155, 0.008, 5, 18), 0, sh * 0.35, 0, 0, 1, 1, 1, HP); }
  else if (style === "diner") { sh = 0.74; b.cyl("k", 0.03, 0.03, sh - 0.08, 0, 0, 0, 10); b.cyl("k", 0.18, 0.2, 0.02, 0, 0, 0, 16); b.cyl(k, 0.19, 0.19, 0.08, 0, sh - 0.08, 0, 18); }
  return { b, sh }; }
function chairAt(b, rnd, style, x, z, a, o = {}) { const c = chairB(rnd, style, o); const j = o.jit ?? 0.1, aa = a + R(rnd, -j, j), back = R(rnd, 0, o.pull ?? 0.08);
  const px = x - Math.cos(aa) * back, pz = z - Math.sin(aa) * back; put(b, c.b, px, pz, aa, o.y ?? 0); return anc("seat", px, (o.y ?? 0) + c.sh, pz, aa); }

// ============================== tables ==============================
function setting(b, rnd, p, x, z, a, y = DESK_H) { // a = direction the sitter faces; things go 0.28 m in front of the seat edge
  const [fx, fz] = [Math.cos(a), Math.sin(a)], [sx, sz] = [-fz, fx], at = (f, s) => [x + fx * f + sx * s, z + fz * f + sz * s];
  if (chance(rnd, p.laptops ?? 0.3)) { const [lx, lz] = at(0.0, 0); laptop(b, lx, y, lz, a); }
  else if (chance(rnd, p.paper ?? 0.7)) { const [lx, lz] = at(0.02, R(rnd, -0.06, 0.06)); papers(b, rnd, lx, y, lz, a + HP); const [qx, qz] = at(0.02, 0.2); pen(b, qx, y, qz, a); }
  if (chance(rnd, p.glasses ?? 0.75)) { const [gx, gz] = at(0.2, 0.26); glass(b, gx, y, gz); }
  if (p.names) { const [nx, nz] = at(0.3, 0); nameplate(b, nx, y, nz, a + PI); }
  if (p.mics) { const [mx, mz] = at(0.24, -0.18); gooseMic(b, mx, y, mz, a + PI); } }
function table(E, p = {}) { const { rnd } = E, b = new Builder(), shape = p.shape ?? "rect", style = p.chair ?? "stack", anchors = [];
  const n = p.seats ?? 6, ends = p.ends ?? (n >= 8 && p.sides !== "one"), one = p.sides === "one", pitch = p.pitch ?? 0.74;
  const side = one ? n : Math.ceil((n - (ends ? 2 : 0)) / 2);
  const L = p.len ?? Math.max(1.2, side * pitch + (shape === "racetrack" ? 0.9 : 0.3)), W = p.wid ?? (one ? 0.8 : L > 3.6 ? 1.3 : 0.95), H = DESK_H, top = p.top ?? (shape === "racetrack" ? 0.06 : 0.045);
  const tk = p.topK ?? "w";
  if (shape === "racetrack") { b.box(tk, L - W, top, W, 0, H - top, 0); for (const s of [-1, 1]) b.cyl(tk, W / 2, W / 2, top, s * (L - W) / 2, H - top, 0, 32);
    b.box("l", L - W, 0.004, 0.16, 0, H, 0); for (let i = 0; i < Math.max(2, Math.round(L / 2.4)); i++) { const x = -(L - W) / 2 + i * (L - W) / Math.max(1, Math.round(L / 2.4) - 1); b.box("l", 0.5, H - top, W * 0.38, x, 0, 0); b.box("k", 0.7, 0.02, W * 0.5, x, 0, 0); } }
  else { b.box(tk, L, top, W, 0, H - top, 0); b.box("l", L - 0.12, 0.08, W - 0.12, 0, H - top - 0.08, 0);
    if (L > 2.8 && !p.legs4) for (const s of [-1, 1]) { b.box("l", 0.08, H - top - 0.08, W * 0.7, s * (L / 2 - 0.4), 0, 0); b.box("l", 0.12, 0.03, W * 0.8, s * (L / 2 - 0.4), 0, 0); }
    else legs4(b, "l", L, W, H - top, 0.022, 0.07); }
  const xs = i => -(side - 1) * pitch / 2 + i * pitch;
  for (let i = 0; i < side; i++) for (const s of one ? [-1] : [-1, 1]) { const z = s * (W / 2 + 0.3), a = s > 0 ? -HP : HP; anchors.push(chairAt(b, rnd, style, xs(i), z, a, p)); setting(b, rnd, p, xs(i), s * (W / 2 - 0.28), a); }
  if (ends) for (const s of [-1, 1]) { const x = s * (L / 2 + 0.3), a = s > 0 ? PI : 0; anchors.push(chairAt(b, rnd, style, x, 0, a, p)); setting(b, rnd, p, s * (L / 2 - 0.3), 0, a); }
  if (!one && L > 2) { const nc = Math.max(1, Math.round(L / 2.2)); for (let i = 0; i < nc; i++) { const x = -L / 2 + (i + 0.5) * L / nc; carafe(b, x, H, R(rnd, -0.05, 0.05)); if (chance(rnd, 0.5)) glass(b, x + 0.12, H, 0.06); } }
  if (p.spider) { b.cyl("k", 0.14, 0.16, 0.03, 0.4, H, 0, 3); }
  if (p.centre === "plant") { b.cyl("w", 0.14, 0.11, 0.08, 0, H, 0, 16); b.sph("l", 0.12, 0, H + 0.12, 0, 1.3, 0.5, 1.3, 10); }
  return fin(E, b, { anchors, pad: 0.6, faceAxis: one ? HP : 0, extra: { seatsOne: one } }); }
function roundTable(E, p = {}) { const { rnd } = E, b = new Builder(), n = p.seats ?? 5, Rt = p.radius ?? Math.max(0.45, n * 0.13), H = p.h ?? DESK_H, anchors = [];
  b.cyl("w", Rt, Rt, 0.04, 0, H - 0.04, 0, 36); b.cyl("l", 0.05, 0.06, H - 0.04, 0, 0, 0, 10); b.cyl("l", 0.3, 0.32, 0.03, 0, 0, 0, 20);
  const a0 = rnd() * TAU; for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU, x = Math.cos(a) * (Rt + 0.3), z = Math.sin(a) * (Rt + 0.3); anchors.push(chairAt(b, rnd, p.chair ?? "stack", x, z, a + PI, p));
    setting(b, rnd, { ...p, laptops: p.laptops ?? 0.1 }, Math.cos(a) * (Rt - 0.25), Math.sin(a) * (Rt - 0.25), a + PI, H); }
  if (p.centre !== false) { b.cyl("w", 0.09, 0.07, 0.07, 0, H, 0, 14); b.sph("l", 0.08, 0, H + 0.1, 0, 1.2, 0.6, 1.2, 8); }
  return fin(E, b, { anchors, pad: 0.6 }); }
function boardroomTable(E, p = {}) { return table(E, { shape: "racetrack", chair: "exec", ends: true, names: false, laptops: 0.4, spider: true, ...p }); }
function booth(E, p = {}) { const { rnd } = E, b = new Builder(), anchors = [], n = p.n ?? 1, Wb = 1.25, pitchX = 1.95;   // diner booths along z? no: along x, wall (back) on -z
  for (let i = 0; i < n; i++) { const x0 = (i - (n - 1) / 2) * pitchX;
    for (const s of [-1, 1]) { const bx = x0 + s * 0.68; b.box("l", 0.5, 0.44, Wb, bx, 0, 0); b.box("g", 0.48, 0.08, Wb - 0.04, bx, 0.44, 0);   // bench + cushion
      b.box("g", 0.12, 0.62, Wb - 0.04, bx + s * 0.2, 0.5, 0, 0, 0, s * -0.08); b.box("l", 0.18, 0.06, Wb, bx + s * 0.22, 1.13, 0);   // back + cap
      for (let k = -1; k <= 1; k += 2) b.box("l", 0.01, 0.5, 0.012, bx + s * 0.14, 0.56, k * 0.2);   // tufting seams
      for (const z of [-0.3, 0.3]) anchors.push(anc("seat", bx - s * 0.02, 0.52, z, s > 0 ? PI : 0)); }
    b.box("w", 0.76, 0.04, Wb - 0.1, x0, 0.72, -0.05); b.box("k", 0.06, 0.7, 0.06, x0, 0, -0.05); b.box("k", 0.5, 0.02, 0.4, x0, 0, -0.05);   // table on a post
    b.box("l", 0.76, 0.02, 0.03, x0, 0.735, Wb / 2 - 0.13);   // chrome edge
    // table top: napkin dispenser, sauce bottles, sugar, plates and mugs at each seat
    b.box("l", 0.1, 0.12, 0.06, x0, 0.76, -Wb / 2 + 0.16); bottle(b, x0 - 0.12, 0.76, -Wb / 2 + 0.15, 0.17, "w"); bottle(b, x0 + 0.12, 0.76, -Wb / 2 + 0.15, 0.17, "g");
    for (const sx of [-1, 1]) for (const z of [-0.3, 0.3]) { if (!chance(rnd, 0.75)) continue; const px = x0 + sx * 0.22; b.cyl("w", 0.11, 0.09, 0.015, px, 0.76, z, 18); if (chance(rnd, 0.6)) mug(b, px + sx * 0.03, 0.775, z + 0.13); }
    b.box("w", 0.05, 0.4, 0.3, x0, 1.2, -Wb / 2 + 0.03); b.box("l", 0.045, 0.3, 0.24, x0 + 0.002, 1.25, -Wb / 2 + 0.03);   // wall sconce / menu frame
  }
  return fin(E, b, { anchors, pad: 0.5, wall: 1, faceAxis: HP, extra: { wallAxis: -HP } }); }

// ============================== desks ==============================
function deskUnit(b, rnd, p, x, z, a, o = {}) {   // a desk + chair, sitter at the -x side of the desk (local), returns seat anchor
  const m = new Builder(), Wd = o.w ?? 1.4, Dd = o.d ?? 0.72, v = o.v ?? p.variant ?? pick(rnd, ["monitor", "monitor", "laptop", "papers", "dual"]);
  m.box("w", Dd, 0.035, Wd, 0, DESK_H - 0.035, 0); m.box("l", 0.02, 0.45, Wd - 0.1, Dd / 2 - 0.06, 0.26, 0);   // top + modesty panel
  for (const s of [-1, 1]) m.box("l", Dd - 0.04, DESK_H - 0.035, 0.03, 0, 0, s * (Wd / 2 - 0.02));
  if (o.ped !== false) { m.box("w", Dd * 0.75, 0.6, 0.4, 0, 0, Wd / 2 - 0.25); for (let i = 0; i < 3; i++) m.box("l", 0.006, 0.004, 0.16, -Dd * 0.375 - 0.003, 0.15 + i * 0.2, Wd / 2 - 0.25); }
  const Y = DESK_H; if (v === "monitor" || v === "dual" || v === "farm") { const n = v === "dual" ? 2 : 1; for (let i = 0; i < n; i++) monitor(m, Dd * 0.18, Y, (i - (n - 1) / 2) * 0.56, PI, v === "farm" ? 0.85 : 1); keyboard(m, -0.12, Y, 0, 0); }
  if (v === "laptop") laptop(m, -0.1, Y, 0, 0); if (v === "papers") { pile(m, rnd, 0.05, Y, -0.35, 0, 0.18); papers(m, rnd, -0.12, Y, 0.05, HP); }
  if (v === "lamp" || chance(rnd, o.lampP ?? 0.25)) lamp(m, Dd * 0.3, Y, -Wd / 2 + 0.18, PI * 0.9);
  if (chance(rnd, 0.5)) mug(m, -0.05, Y, Wd / 2 - 0.2); if (chance(rnd, o.phoneP ?? 0.4)) deskPhone(m, 0.05, Y, -Wd / 2 + 0.4, 0); if (chance(rnd, 0.45)) papers(m, rnd, 0.0, Y, Wd / 2 - 0.45, HP + 0.2);
  if (v === "farm") { m.box("k", 0.42, 0.42, 0.18, 0.05, 0, -Wd / 2 + 0.2); m.box("d", 0.004, 0.06, 0.1, -0.162, 0.3, -Wd / 2 + 0.2); }
  put(b, m, x, z, a); const [cx, cz] = rot(-Dd / 2 - 0.35, 0, a);
  return o.chair === false ? anc("stand", x + cx * 1.3, 0, z + cz * 1.3, a) : chairAt(b, rnd, o.style ?? p.chair ?? "office", x + cx, z + cz, a, { jit: 0.25, pull: 0.12 }); }
function desk(E, p = {}) { const b = new Builder(), a0 = deskUnit(b, E.rnd, p, 0, 0, 0, { v: p.variant, chair: p.chairs, style: p.chair }); return fin(E, b, { anchors: [a0], pad: 0.6, wall: 1 }); }
function deskRow(E, p = {}) { const { rnd } = E, b = new Builder(), n = p.n ?? 5, Wd = p.w ?? 1.2, anchors = [];   // one long row, all facing +x (call centres, troll farms)
  for (let i = 0; i < n; i++) { const z = (i - (n - 1) / 2) * Wd; anchors.push(deskUnit(b, rnd, p, 0, z, 0, { w: Wd, v: p.variant ?? "farm", ped: false, lampP: 0.05, phoneP: 0.6 })); }
  if (p.divider !== false) b.box("l", 0.04, 0.35, n * Wd, 0.37, DESK_H, 0);
  return fin(E, b, { anchors, pad: 0.55, wall: 1 }); }
function cluster(E, p = {}) { const { rnd } = E, b = new Builder(), n = p.n ?? 3, Wd = p.w ?? 1.25, kind = p.kind ?? "newsroom", anchors = [];   // back-to-back pod
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) { const z = (i - (n - 1) / 2) * Wd, x = s * 0.42, a = s < 0 ? 0 : PI;
    const m = new Builder(); m.box("w", 0.8, 0.035, Wd, 0, DESK_H - 0.035, 0); m.box("l", 0.03, DESK_H - 0.035, Wd - 0.02, 0.38, 0, 0);
    if (kind === "trading") { for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) monitor(m, 0.3, DESK_H + 0.02 + r * 0.36, (c - 0.5) * 0.5, PI, 0.82); m.box("k", 0.2, 0.06, 0.4, -0.05, DESK_H, -0.32, 0, 0, 0.15); keyboard(m, -0.15, DESK_H, 0.05, 0); }
    else { monitor(m, 0.22, DESK_H, chance(rnd, 0.5) ? 0.12 : -0.12, PI, 1.05); if (chance(rnd, 0.5)) monitor(m, 0.24, DESK_H, chance(rnd, 0.5) ? -0.45 : 0.45, PI, 0.75); keyboard(m, -0.12, DESK_H, 0, 0); if (chance(rnd, 0.7)) pile(m, rnd, 0.1, DESK_H, Wd / 2 - 0.2, 0.1, R(rnd, 0.04, 0.2)); if (chance(rnd, 0.5)) mug(m, -0.2, DESK_H, -0.4); }
    if (chance(rnd, 0.4)) papers(m, rnd, -0.18, DESK_H, -Wd / 2 + 0.25, HP);
    put(b, m, x, z, a); anchors.push(chairAt(b, rnd, "office", x - s * 0.0 + (s < 0 ? -0.75 : 0.75), z, a, { jit: 0.3, pull: 0.15 })); }
  for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) legs4(b, "l", 0.02, 0.02, 0, 0.001);
  if (kind === "newsroom") b.box("l", 0.05, 0.4, n * Wd, 0, DESK_H, 0); else b.box("k", 0.14, 0.12, n * Wd, 0, DESK_H, 0);
  return fin(E, b, { anchors, pad: 0.55 }); }
function tradingDesk(E, p = {}) { return cluster(E, { kind: "trading", n: p.n ?? 4, w: 1.3, ...p }); }
function newsDesk(E, p = {}) { return cluster(E, { kind: "newsroom", ...p }); }

// ============================== speaking / courts / hearings ==============================
function podium(E, p = {}) { const { rnd } = E, b = new Builder(), anchors = [], riser = p.riser ?? 0, mics = p.mics ?? 2;
  if (riser) { b.box("w", 1.6, riser, 1.8, -0.3, 0, 0); b.box("l", 1.62, 0.03, 1.82, -0.3, riser - 0.03, 0); }
  const y = riser, m = new Builder(); m.box("w", 0.5, 1.02, 0.62, 0, 0, 0); m.box("l", 0.54, 0.05, 0.66, 0, 0, 0);
  m.box("w", 0.6, 0.05, 0.72, -0.02, 1.04, 0, 0, 0, 0.26); m.box("l", 0.52, 0.06, 0.64, 0, 0.98, 0);   // slanted top (top slopes toward the speaker at -x)
  m.add("l", xcyl(0.15, 0.02, 24), 0.256, 0.68, 0); m.add("w", xcyl(0.11, 0.025, 24), 0.262, 0.68, 0);   // seal on the front
  for (let i = 0; i < 2; i++) m.box("l", 0.006, 0.02, 0.5, 0.252, 0.25 + i * 0.03, 0);
  for (let i = 0; i < Math.min(mics, 2); i++) gooseMic(m, 0.18, 1.08, (i - 0.5) * 0.14, PI, 0.3);
  for (let i = 2; i < mics; i++) { const z = (rnd() - 0.5) * 0.5, hh = R(rnd, 0.08, 0.2); m.limb("k", V(0.22, 1.06, z), V(0.12, 1.12 + hh, z * 0.6), 0.008, 5); m.box(pick(rnd, ["k", "d", "l"]), 0.06, 0.05, 0.06, 0.1, 1.1 + hh, z * 0.6); m.add("d", xcyl(0.02, 0.07, 8), 0.06, 1.14 + hh, z * 0.6); }
  papers(m, rnd, -0.04, 1.08, 0, HP, 2); put(b, m, 0, 0, 0, y);
  anchors.push(anc("podium", -0.5, y, 0, 0));
  return fin(E, b, { anchors, pad: 0.7, kind: "podium" }); }
function judgeBench(E, p = {}) { const { rnd } = E, b = new Builder(), anchors = [], W = p.w ?? 3.4, P = 0.55;
  b.box("w", 2.2, P, W + 0.6, -0.4, 0, 0); b.box("l", 2.22, 0.04, W + 0.62, -0.4, P - 0.04, 0); b.box("l", 0.3, P * 0.5, 1.0, -0.4 + 1.25, 0, -W / 2 - 0.1);   // platform + step
  b.box("w", 0.12, 1.2, W, 0.55, P, 0); b.box("w", 0.7, 0.06, W + 0.1, 0.25, P + 1.2, 0); b.box("w", 0.6, 0.04, W - 0.2, 0.15, P + 0.74, 0);   // front panel, top, writing shelf
  const np = 4; for (let i = 0; i < np; i++) { const z = -W / 2 + (i + 0.5) * W / np; b.box("l", 0.02, 0.75, W / np - 0.16, 0.62, P + 0.22, z); b.box("w", 0.03, 0.64, W / np - 0.26, 0.625, P + 0.275, z); }   // raised panels
  b.box("w", 0.16, 0.08, W + 0.2, 0.6, P + 1.14, 0); b.box("l", 0.18, 0.12, W + 0.62, 0.68, 0, 0);   // cornice + plinth
  for (const s of [-1, 1]) b.box("w", 0.8, 1.2, 0.1, 0.15, P, s * W / 2);
  b.add("l", xcyl(0.26, 0.03, 30), 0.68, P + 0.65, 0); b.add("w", xcyl(0.2, 0.035, 30), 0.685, P + 0.65, 0);   // seal
  gooseMic(b, 0.3, P + 1.26, -0.35, PI, 0.3); b.cyl("k", 0.07, 0.07, 0.025, 0.25, P + 1.26, 0.35, 14); b.add("k", xcyl(0.02, 0.1, 8), 0.25, P + 1.32, 0.35); papers(b, rnd, 0.18, P + 1.26, 0.05, HP);
  anchors.push(chairAt(b, rnd, "judge", -0.4, 0, 0, { y: P, jit: 0.03, pull: 0 }));
  if (p.clerk !== false) { const cm = new Builder(); cm.box("w", 0.7, DESK_H + 0.2, 1.6, 0, 0, 0); cm.box("w", 0.8, 0.04, 1.7, 0, DESK_H + 0.2, 0); monitor(cm, 0.05, DESK_H + 0.24, -0.4, PI, 0.7); papers(cm, rnd, -0.15, DESK_H + 0.24, 0.3, HP); put(b, cm, 1.55, W / 2 - 0.4, 0);
    anchors.push(chairAt(b, rnd, "office", 1.55 - 0.7, W / 2 - 0.4, 0, { seat: 0.62 })); }
  return fin(E, b, { anchors, pad: 0.8, wall: -1, kind: "bench" }); }
function witnessBox(E, p = {}) { const { rnd } = E, b = new Builder(), anchors = [], P = 0.3, S = 1.3;
  b.box("w", S, P, S, 0, 0, 0); b.box("l", 0.4, P * 0.5, 0.8, -S / 2 - 0.2, 0, 0);
  b.box("w", 0.08, 0.95, S, S / 2 - 0.04, P, 0); b.box("w", 0.2, 0.05, S + 0.1, S / 2 - 0.06, P + 0.95, 0);
  for (const s of [-1, 1]) { b.box("w", S, 0.95, 0.08, 0, P, s * (S / 2 - 0.04)); b.box("w", S + 0.04, 0.05, 0.16, 0, P + 0.95, s * (S / 2 - 0.04)); }
  for (let i = 0; i < 2; i++) b.box("l", 0.02, 0.6, 0.45, S / 2 + 0.002, P + 0.18, (i - 0.5) * 0.6);
  gooseMic(b, S / 2 - 0.05, P + 1.0, 0.15, PI, 0.25); glass(b, S / 2 - 0.06, P + 1.0, -0.3);
  anchors.push(chairAt(b, rnd, "wood", -0.05, 0, 0, { y: P, jit: 0.05, pull: 0 }));
  return fin(E, b, { anchors, pad: 0.6, kind: "box" }); }
function juryBox(E, p = {}) { const { rnd } = E, b = new Builder(), anchors = [], n = p.perRow ?? 6, pitch = 0.66, Wj = n * pitch + 0.5;
  b.box("w", 2.1, 0.15, Wj, 0, 0, 0); b.box("w", 1.0, 0.3, Wj, -0.55, 0.15, 0); b.box("l", 1.02, 0.03, Wj + 0.02, -0.55, 0.42, 0);
  b.box("w", 0.08, 0.95, Wj, 1.0, 0.15, 0); b.box("w", 0.22, 0.05, Wj + 0.1, 0.98, 1.1, 0);
  for (let i = 0; i < Math.round(Wj / 0.8); i++) b.box("l", 0.02, 0.55, 0.6, 1.042, 0.35, -Wj / 2 + (i + 0.5) * Wj / Math.round(Wj / 0.8));
  for (const s of [-1, 1]) { b.box("w", 2.1, 0.95, 0.08, 0, 0.15, s * Wj / 2); b.box("w", 2.12, 0.05, 0.14, 0, 1.1, s * Wj / 2); }
  for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) anchors.push(chairAt(b, rnd, "wood", r ? -0.6 : 0.45, -((n - 1) * pitch) / 2 + i * pitch, 0, { y: r ? 0.45 : 0.15, jit: 0.06, pull: 0.04 }));
  return fin(E, b, { anchors, pad: 0.6, wall: -1, kind: "box" }); }
function pews(E, p = {}) { const { rnd } = E, b = new Builder(), anchors = [], rows = p.rows ?? 4, Lp = p.len ?? 4, pitch = 0.95, aisle = p.aisle ?? 0;   // rows step back toward -x
  for (let r = 0; r < rows; r++) { const x = -r * pitch; for (const part of aisle ? [-1, 1] : [0]) { const L = aisle ? (Lp - aisle) / 2 : Lp, zc = part * (aisle / 2 + L / 2);
    b.box("w", 0.42, 0.06, L, x, 0.4, zc); b.box("w", 0.06, 0.5, L, x - 0.22, 0.46, zc, 0, 0, 0.12); b.box("l", 0.08, 0.04, L + 0.02, x - 0.25, 0.94, zc);
    for (const s of [-1, 1]) b.box("w", 0.55, 0.92, 0.06, x - 0.05, 0, zc + s * L / 2); b.box("l", 0.3, 0.05, L - 0.1, x - 0.05, 0.1, zc);   // ends + kneeler
    const ns = Math.floor(L / 0.58); for (let i = 0; i < ns; i++) anchors.push(anc("seat", x + 0.02, 0.46, zc - (ns - 1) * 0.29 + i * 0.58, 0, { row: r })); } }
  if (p.bar) { const x = 0.75; b.box("w", 0.06, 0.85, Lp + 0.4, x, 0, 0); b.box("w", 0.12, 0.05, Lp + 0.5, x, 0.85, 0); for (let i = 0; i < Lp * 7; i++) b.box("l", 0.03, 0.85, 0.03, x, 0, -Lp / 2 + i / 7); }
  return fin(E, b, { anchors, pad: 0.4, kind: "bench" }); }
function dais(E, p = {}) { const { rnd } = E, b = new Builder(), anchors = [], n = p.seats ?? 11, Rr = p.radius ?? Math.max(5, n * 0.62), span = p.span ?? Math.min(2.2, n * 0.75 / Rr), P = 0.75;
  const cx = Rr;   // arc centre on +x: the dais is concave toward +x (the witness table)
  const seg = n * 2, at = (rad, th) => [cx + Math.cos(th) * rad, Math.sin(th) * rad];
  for (let i = 0; i < seg; i++) { const t0 = PI - span / 2 - 0.08 + (i + 0.5) / seg * (span + 0.16), segL = Rr * (span + 0.16) / seg * 1.04, ry = -(t0 + HP);
    const [px, pz] = at(Rr + 0.35, t0); b.add("w", new THREE.BoxGeometry(2.4, P, segL * 1.15), px, P / 2, pz, -t0);   // platform
    const [ex, ez] = at(Rr + 0.35 + 1.2, t0); b.add("l", new THREE.BoxGeometry(0.06, 0.03, segL * 1.15), ex, P, ez, -t0);
    const [fx, fz] = at(Rr - 0.62, t0); b.add("w", new THREE.BoxGeometry(0.1, 1.15, segL * 1.06), fx, P / 2 + 0.75 - 0.18, fz, -t0);   // desk front, rising from floor
    const [tx, tz] = at(Rr - 0.4, t0); b.add("w", new THREE.BoxGeometry(0.62, 0.05, segL * 1.06), tx, P + 0.74, tz, -t0);
    const [lx, lz] = at(Rr - 0.68, t0); b.add("l", new THREE.BoxGeometry(0.04, 0.6, segL * 0.9), lx, 0.55, lz, -t0); }
  for (let i = 0; i < n; i++) { const th = PI - span / 2 + (i + 0.5) / n * span, face = th + PI; const [sx, sz] = at(Rr + 0.15, th); anchors.push(chairAt(b, rnd, "exec", sx, sz, face, { y: P, jit: 0.08, pull: 0.05 }));
    const [nx, nz] = at(Rr - 0.52, th); nameplate(b, nx, P + 0.765, nz, th); const [mx, mz] = at(Rr - 0.42, th + 0.05); gooseMic(b, mx, P + 0.765, mz, face + PI, 0.28);
    const [qx, qz] = at(Rr - 0.32, th - 0.04); if (chance(rnd, 0.7)) papers(b, rnd, qx, P + 0.765, qz, th + HP); else laptop(b, qx, P + 0.765, qz, face);
    if (chance(rnd, 0.6)) { const [gx, gz] = at(Rr - 0.5, th - 0.08); glass(b, gx, P + 0.765, gz); } }
  if (p.staff !== false) for (let i = 0; i < n - 1; i++) { const th = PI - span / 2 + (i + 1) / n * span; const [sx, sz] = at(Rr + 1.2, th); anchors.push({ ...chairAt(b, rnd, "stack", sx, sz, th + PI, { y: P, jit: 0.15 }), staff: true }); }
  return fin(E, b, { anchors, pad: 0.8, wall: -1, kind: "dais", extra: { focusPt: [cx, 0] } }); }

// ============================== domestic / hospitality ==============================
function bed(E, p = {}) { const { rnd } = E, b = new Builder(), Wb = p.w ?? 1.7, Lb = 2.1;
  b.box("w", 0.1, 1.1, Wb + 0.1, -Lb / 2, 0, 0); b.box("l", 0.06, 0.6, Wb - 0.1, -Lb / 2 + 0.07, 0.45, 0);   // headboard
  b.box("w", Lb, 0.3, Wb, 0, 0.08, 0); for (const [x, z] of [[Lb / 2 - 0.06, Wb / 2 - 0.06], [Lb / 2 - 0.06, -Wb / 2 + 0.06]]) b.box("k", 0.06, 0.08, 0.06, x, 0, z);
  b.box("w", Lb - 0.1, 0.22, Wb - 0.06, 0.03, 0.38, 0); b.box("l", Lb * 0.62, 0.06, Wb + 0.02, Lb * 0.17, 0.56, 0); b.box("w", 0.35, 0.065, Wb + 0.04, Lb * 0.05, 0.58, 0);   // mattress, duvet, fold
  for (const s of [-1, 1]) { cushionBox(b, "w", 0.32, 0.13, Wb * 0.42, -Lb / 2 + 0.28, 0.6, s * Wb * 0.23, s * 0.05); }
  cushionBox(b, "l", 0.3, 0.08, Wb * 0.8, Lb / 2 - 0.25, 0.62, 0, 0);   // throw across the foot
  for (const s of [-1, 1]) { const z = s * (Wb / 2 + 0.3); b.box("w", 0.42, 0.5, 0.45, -Lb / 2 + 0.24, 0, z); b.box("l", 0.005, 0.002, 0.3, -Lb / 2 + 0.452, 0.36, z); tableLamp(b, -Lb / 2 + 0.24, 0.5, z);
    if (chance(rnd, 0.5)) { b.box("l", 0.12, 0.03, 0.18, -Lb / 2 + 0.3, 0.5, z + s * -0.1); } }
  if (p.bench !== false) { b.box("w", 0.45, 0.42, Wb * 0.8, Lb / 2 + 0.35, 0, 0); b.box("l", 0.43, 0.05, Wb * 0.78, Lb / 2 + 0.35, 0.42, 0); }
  return fin(E, b, { anchors: [anc("seat", 0.35, 0.56, Wb / 2 + 0.05, HP), anc("seat", Lb / 2 + 0.35, 0.47, 0.25, 0), anc("stand", Lb / 2 + 1.0, 0, -0.5, PI)], pad: 0.6, wall: -1 }); }
function sofa(E, p = {}) { const b = new Builder(), Ws = p.w ?? 2.1, n = Math.max(2, Math.round(Ws / 0.68)), k = p.k ?? "g";
  b.box(k, 0.9, 0.36, Ws, 0, 0.06, 0); for (const s of [-1, 1]) { b.box(k, 0.9, 0.62, 0.16, 0, 0.06, s * (Ws / 2 - 0.08)); }
  b.box(k, 0.22, 0.48, Ws - 0.3, -0.34, 0.42, 0, 0, 0, 0.1);
  for (let i = 0; i < n; i++) { const z = -(Ws - 0.32) / 2 + (i + 0.5) * (Ws - 0.32) / n; cushionBox(b, "l", 0.62, 0.11, (Ws - 0.32) / n - 0.02, 0.06, 0.42, z); cushionBox(b, "l", 0.14, 0.4, (Ws - 0.32) / n - 0.04, -0.22, 0.53, z, 0); }
  for (const [x, z] of [[0.4, Ws / 2 - 0.08], [0.4, -Ws / 2 + 0.08], [-0.4, Ws / 2 - 0.08], [-0.4, -Ws / 2 + 0.08]]) b.cyl("d", 0.025, 0.02, 0.06, x, 0, z, 6);
  const anchors = []; for (let i = 0; i < n; i++) anchors.push(anc("seat", 0.02, 0.5, -(Ws - 0.32) / 2 + (i + 0.5) * (Ws - 0.32) / n, 0));
  return fin(E, b, { anchors, pad: 0.5, wall: -1 }); }
function coffeeTable(E, p = {}) { const { rnd } = E, b = new Builder(), L = p.len ?? 1.1, W = p.wid ?? 0.6;
  b.box("w", L, 0.04, W, 0, 0.38, 0); b.box("l", L - 0.1, 0.02, W - 0.1, 0, 0.12, 0); legs4(b, "l", L, W, 0.38, 0.02, 0.05);
  for (let i = 0; i < 2; i++) b.box(pick(rnd, ["w", "l", "s"]), 0.28, 0.008, 0.21, -L * 0.2 + i * 0.03, 0.42 + i * 0.008, -0.05 + i * 0.02, R(rnd, -0.3, 0.3)); mug(b, L * 0.25, 0.42, 0.1); if (chance(rnd, 0.6)) mug(b, L * 0.32, 0.42, -0.12);
  return fin(E, b, { pad: 0.45 }); }
function counter(E, p = {}) { const { rnd } = E, b = new Builder(), L = p.len ?? 4, anchors = [], stools = p.stools ?? Math.floor(L / 0.65), back = p.back !== false;   // customers at -x facing +x
  b.box("w", 0.55, BAR_H - 0.05, L, 0, 0, 0); b.box("w", 0.7, 0.05, L + 0.1, -0.05, BAR_H - 0.05, 0); b.box("l", 0.04, 0.12, L, -0.29, 0.12, 0); b.box("l", 0.03, 0.03, L, -0.35, 0.28, 0);   // body, top, kick, foot rail
  for (let i = 0; i < Math.round(L / 0.6); i++) b.box("l", 0.01, BAR_H - 0.35, 0.012, -0.276, 0.3, -L / 2 + (i + 0.5) * L / Math.round(L / 0.6));
  for (let i = 0; i < stools; i++) { const z = -(stools - 1) * 0.65 / 2 + i * 0.65; anchors.push(chairAt(b, rnd, p.diner ? "diner" : "stool", -0.6, z, 0, { jit: 0.4, pull: 0.04 })); if (chance(rnd, 0.4)) { mug(b, -0.18, BAR_H, z + 0.1); } if (p.diner && chance(rnd, 0.5)) b.cyl("w", 0.11, 0.09, 0.015, -0.2, BAR_H, z - 0.05, 16); }
  if (p.diner) { for (let i = 0; i < 2; i++) { const z = L * (i ? 0.3 : -0.25); b.cyl("w", 0.14, 0.14, 0.02, 0.05, BAR_H, z, 18); b.add("l", new THREE.SphereGeometry(0.15, 16, 8, 0, TAU, 0, HP), 0.05, BAR_H + 0.02, z); } b.box("l", 0.25, 0.22, 0.35, 0.1, BAR_H, 0.1); }
  if (back) { b.box("w", 0.5, 0.9, L, 1.25, 0, 0); b.box("w", 0.55, 0.04, L, 1.25, 0.9, 0); for (let s = 0; s < 2; s++) { b.box("w", 0.25, 0.03, L, 1.4, 1.3 + s * 0.38, 0); for (let i = 0; i < L / 0.12; i++) if (chance(rnd, 0.7)) bottle(b, 1.4, 1.33 + s * 0.38, -L / 2 + 0.1 + i * 0.12, R(rnd, 0.2, 0.3), pick(rnd, ["l", "w", "g"])); }
    b.box("l", 0.02, 0.8, L, 1.52, 1.2, 0); if (p.diner) for (let i = 0; i < 2; i++) b.box("k", 0.4, 0.35, 0.45, 1.2, 0.94, -L / 2 + 0.5 + i * 0.6); anchors.push(anc("stand", 0.75, 0, R(rnd, -L / 4, L / 4), PI)); }
  return fin(E, b, { anchors, pad: 0.5, wall: 1 }); }
function stall(E, p = {}) { const { rnd } = E, b = new Builder(), L = p.len ?? 2.0, D = 0.85, goods = p.goods ?? pick(rnd, ["fruit", "boxes", "cloth", "fish"]);   // customer at -x
  b.box("w", D, 0.82, L, 0, 0, 0); b.box("l", D + 0.06, 0.04, L + 0.06, 0, 0.82, 0); for (let i = 0; i < 3; i++) b.box("l", 0.01, 0.6, 0.012, -D / 2 - 0.004, 0.12, -L / 2 + (i + 0.5) * L / 3);
  for (const [x, z] of [[-D / 2 - 0.15, -L / 2], [-D / 2 - 0.15, L / 2], [D / 2 + 0.6, -L / 2], [D / 2 + 0.6, L / 2]]) b.cyl("l", 0.025, 0.025, x < 0 ? 2.15 : 2.35, x, 0, z, 6);
  const nStr = 8; for (let i = 0; i < nStr; i++) { const z = -L / 2 - 0.1 + (i + 0.5) * (L + 0.2) / nStr; b.box(i % 2 ? "w" : "l", D + 1.05, 0.02, (L + 0.2) / nStr, 0.22, 2.25, z, 0, 0, -0.17); b.box(i % 2 ? "w" : "l", 0.02, 0.22, (L + 0.2) / nStr, -D / 2 - 0.3, 1.97, z); }
  const cr = Math.max(2, Math.round(L / 0.5)); for (let i = 0; i < cr; i++) { const z = -L / 2 + (i + 0.5) * L / cr; for (let r = 0; r < 2; r++) { const x = -0.18 + r * 0.38, y = 0.86 + r * 0.12;
    b.box("w", 0.36, 0.1, L / cr - 0.04, x, y, z, 0, 0, r ? 0 : 0.15); b.box("w", 0.36, 0.12, 0.02, x, y - 0.12 * r, z, 0);
    if (goods === "fruit") for (let k = 0; k < 6; k++) b.sph(pick(rnd, ["w", "s", "l"]), 0.045, x + R(rnd, -0.12, 0.12), y + 0.12, z + R(rnd, -0.15, 0.15), 1, 1, 1, 8);
    else if (goods === "fish") for (let k = 0; k < 3; k++) b.sph("l", 0.06, x + R(rnd, -0.1, 0.1), y + 0.12, z + R(rnd, -0.1, 0.1), 2.2, 0.35, 0.7, 8);
    else if (goods === "cloth") for (let k = 0; k < 3; k++) b.box(pick(rnd, ["w", "l", "s", "g"]), 0.3, 0.04, 0.18, x, y + 0.1 + k * 0.04, z);
    else if (goods === "phones") for (let k = 0; k < 3; k++) { const zz = z + (k - 1) * Math.min(0.13, (L / cr - 0.06) / 3);   // added 2026-11-15 (china_v4): handsets upright on little easels + boxed phones
      if (r) { b.box("d", 0.012, 0.15, 0.075, x - 0.02, y + 0.06, zz, 0, 0, -0.25); b.box("k", 0.04, 0.012, 0.05, x + 0.01, y + 0.06, zz); }
      else b.box(pick(rnd, ["w", "s", "l"]), 0.1, 0.05, 0.16, x + R(rnd, -0.06, 0.06), y + 0.06 + (k % 2) * 0.05, zz, 0, 0, 0.15); }
    else for (let k = 0; k < 2; k++) b.box(pick(rnd, ["s", "w"]), 0.14, 0.12, 0.16, x + R(rnd, -0.08, 0.08), y + 0.1, z + R(rnd, -0.1, 0.1)); } }
  b.cyl("k", 0.12, 0.12, 0.02, 0.2, 0.86, L / 2 - 0.2, 14); b.box("k", 0.08, 0.1, 0.08, 0.3, 0.86, L / 2 - 0.2);   // scale
  for (let i = 0; i < 3; i++) b.box(pick(rnd, ["w", "s"]), 0.5, 0.35, 0.4, D / 2 + 0.35, i === 2 ? 0.35 : 0, -L / 2 + 0.3 + (i % 2) * 0.45);
  return fin(E, b, { anchors: [anc("stand", D / 2 + 0.5, 0, 0.2, PI), anc("stand", -D / 2 - 0.5, 0, -0.3, 0)], pad: 0.7, kind: "stall" }); }

// ============================== storage / office fixtures ==============================
function shelf(E, p = {}) { const { rnd } = E, b = new Builder(), Wsh = p.w ?? 1.0, Hs = p.h ?? 2.0, D = 0.4, n = p.shelves ?? 5, fill = p.fill ?? "binders";
  for (const s of [-1, 1]) b.box("w", D, Hs, 0.03, 0, 0, s * (Wsh / 2 - 0.015)); b.box("w", 0.02, Hs, Wsh, D / 2 - 0.01, 0, 0);
  for (let i = 0; i <= n; i++) { const y = 0.06 + i * (Hs - 0.1) / n; b.box("w", D, 0.025, Wsh - 0.04, 0, y, 0);
    if (i < n) { const hh = (Hs - 0.1) / n - 0.06; if (fill === "boxes" || (fill === "mixed" && chance(rnd, 0.4))) { let z = -Wsh / 2 + 0.05; while (z < Wsh / 2 - 0.25) { const w = R(rnd, 0.22, 0.38); if (z + w > Wsh / 2 - 0.04) break; b.box(pick(rnd, ["s", "w", "l"]), D * 0.85, hh * R(rnd, 0.6, 0.95), w, -0.01, y + 0.025, z + w / 2); z += w + 0.02; } }
      else binderRow(b, rnd, -0.01, y + 0.025, -Wsh / 2 + 0.05, Wsh / 2 - 0.05, D, hh); } }
  return fin(E, b, { pad: 0.6, wall: 1 }); }
function filing(E, p = {}) { const b = new Builder(), n = p.n ?? 3, Hc = p.drawers === 2 ? 0.72 : 1.32, nd = p.drawers ?? 4;
  for (let i = 0; i < n; i++) { const z = (i - (n - 1) / 2) * 0.48; b.box("l", 0.62, Hc, 0.46, 0, 0, z);
    for (let d = 0; d < nd; d++) { const y = 0.03 + d * (Hc - 0.04) / nd; b.box("w", 0.01, (Hc - 0.04) / nd - 0.02, 0.43, -0.312, y + 0.01, z); b.box("k", 0.02, 0.015, 0.12, -0.322, y + (Hc - 0.04) / nd * 0.7, z); b.box("k", 0.005, 0.03, 0.06, -0.318, y + (Hc - 0.04) / nd * 0.8, z); } }
  if (E.rnd() < 0.6) { pile(b, E.rnd, 0, Hc, -0.2, 0, 0.1); } if (E.rnd() < 0.4) { b.cyl("w", 0.09, 0.07, 0.15, 0, Hc, 0.25, 12); b.sph("l", 0.11, 0, Hc + 0.22, 0.25, 1, 0.8, 1, 8); }
  return fin(E, b, { pad: 0.7, wall: 1 }); }
function serverRack(E, p = {}) { const { rnd } = E, b = new Builder(), n = p.n ?? 6;
  for (let i = 0; i < n; i++) { const z = (i - (n - 1) / 2) * 0.62; b.box("k", 1.05, 2.0, 0.6, 0, 0, z); b.box("d", 0.02, 1.86, 0.52, -0.53, 0.07, z);
    for (let u = 0; u < 20; u++) { const y = 0.12 + u * 0.088; if (chance(rnd, 0.82)) { b.box("l", 0.012, 0.07, 0.46, -0.54, y, z); if (chance(rnd, 0.5)) b.box("w", 0.006, 0.012, 0.03, -0.548, y + 0.03, z - 0.18 + R(rnd, 0, 0.1)); } }
    b.box("k", 1.07, 0.04, 0.62, 0, 2.0, z); }
  b.box("l", 0.4, 0.08, n * 0.62, 0.1, 2.25, 0); for (const s of [-1, 1]) b.box("l", 0.03, 0.25, 0.03, 0.1, 2.02, s * (n * 0.31 - 0.1));
  return fin(E, b, { pad: 0.9, wall: 1, kind: "rack" }); }
function whiteboard(E, p = {}) { const { rnd } = E, b = new Builder(), Wb = p.w ?? 1.8, Hb = 1.15, y0 = 0.85, wall = p.wallMount;
  if (!wall) { for (const s of [-1, 1]) { b.box("l", 0.04, y0 + Hb + 0.05, 0.04, 0.02, 0, s * (Wb / 2 + 0.03)); b.box("l", 0.5, 0.03, 0.04, 0.02, 0.06, s * (Wb / 2 + 0.03)); for (const x of [-0.22, 0.22]) b.sph("k", 0.025, x + 0.02, 0.025, s * (Wb / 2 + 0.03), 1, 1, 1, 6); } }
  b.box("l", 0.04, Hb + 0.04, Wb + 0.04, 0.02, y0 - 0.02, 0); b.box("w", 0.02, Hb, Wb, 0.0, y0, 0); b.box("l", 0.08, 0.02, Wb * 0.6, -0.03, y0 - 0.02, 0);
  for (let i = 0; i < 4; i++) b.box("d", 0.004, 0.012, R(rnd, 0.3, 0.7), -0.012, y0 + Hb - 0.15 - i * 0.12, -Wb / 2 + 0.2 + R(rnd, 0, 0.3));
  const nb = 4 + Math.floor(rnd() * 3); for (let i = 0; i < nb; i++) { const h = R(rnd, 0.1, 0.42); b.box(i === nb - 1 ? "g" : "d", 0.004, h, 0.07, -0.012, y0 + 0.12, 0.15 + i * 0.11); } b.box("d", 0.004, 0.008, 0.8, -0.012, y0 + 0.11, 0.42);
  return fin(E, b, { pad: 0.7, wall: 1 }); }
function partition(E, p = {}) { const { rnd } = E, b = new Builder(), L = p.len ?? 3.2, H = p.h ?? (p.glass ? 2.6 : 1.25), glassP = !!p.glass;
  if (glassP) { const n = Math.max(1, Math.round(L / 1.2)); b.box("g", 0.06, 0.06, L, 0, 0, 0); b.box("g", 0.06, 0.06, L, 0, H - 0.06, 0); for (let i = 0; i <= n; i++) b.box("g", 0.06, H, 0.05, 0, 0, -L / 2 + i * L / n);
    b.box("l", 0.012, 0.12, L, 0, 1.05, 0); b.box("l", 0.012, 0.03, L, 0, 1.25, 0); if (p.door) { b.box("w", 0.04, 2.05, 0.9, 0.25, 0, L / 2 - 0.6, 0.6); } }
  else { b.box("l", 0.06, H, L, 0, 0.04, 0); b.box("w", 0.075, 0.03, L + 0.02, 0, H + 0.04, 0); for (const s of [-1, 1]) b.box("w", 0.075, H + 0.04, 0.03, 0, 0, s * L / 2); for (let i = 0; i < Math.round(L / 1.6); i++) b.box("w", 0.28, 0.03, 0.05, 0, 0, -L / 2 + (i + 0.5) * L / Math.round(L / 1.6)); }
  return fin(E, b, { pad: 0.1, kind: "partition" }); }
function door(E, p = {}) { const b = new Builder(), Wd = p.w ?? 0.95, H = 2.1, open = p.open ?? 0.5;
  for (const s of [-1, 1]) b.box("l", 0.14, H + 0.08, 0.07, 0, 0, s * (Wd / 2 + 0.035)); b.box("l", 0.14, 0.08, Wd + 0.14, 0, H, 0);
  const m = new Builder(); m.box("w", 0.045, H - 0.02, Wd - 0.02, 0, 0, Wd / 2); m.box("l", 0.01, 0.7, Wd * 0.6, -0.027, 1.2, Wd / 2); m.box("l", 0.01, 0.7, Wd * 0.6, -0.027, 0.25, Wd / 2); m.sph("k", 0.03, -0.06, 1.0, Wd - 0.1, 1, 1, 1, 8);
  b.merge(m, 0, 0, -Wd / 2, open); return fin(E, b, { pad: 0.2, kind: "door" }); }
function windowF(E, p = {}) { const b = new Builder(), Ww = p.w ?? 1.4, Hw = p.h ?? 1.5, t = p.t ?? 0.2, nm = Math.max(1, Math.round(Ww / 0.7));   // frame insert for a wall opening (wall plane = local y/z)
  for (const s of [-1, 1]) b.box("l", t + 0.02, Hw, 0.06, 0, 0, s * (Ww / 2 - 0.03)); b.box("l", t + 0.02, 0.06, Ww, 0, Hw - 0.06, 0); b.box("w", t + 0.12, 0.05, Ww + 0.1, 0.04, -0.02, 0);
  for (let i = 1; i < nm; i++) b.box("l", 0.04, Hw, 0.035, 0, 0, -Ww / 2 + i * Ww / nm); b.box("l", 0.04, 0.035, Ww, 0, Hw * 0.62, 0);
  return fin(E, b, { pad: 0, kind: "window" }); }
function plant(E, p = {}) { const { rnd } = E, b = new Builder(), kind = p.kind ?? pick(rnd, ["ficus", "snake", "palm", "ficus"]), Hp = p.h ?? R(rnd, 1.0, 1.7);
  b.cyl("w", 0.22, 0.16, 0.42, 0, 0, 0, 18); b.cyl("w", 0.235, 0.235, 0.04, 0, 0.4, 0, 18); b.cyl("d", 0.2, 0.2, 0.02, 0, 0.4, 0, 16);
  if (kind === "snake") { for (let i = 0; i < 12; i++) { const a = i * 2.4, r0 = 0.03 + (i % 3) * 0.04, hh = R(rnd, 0.45, 0.9), lean = R(rnd, 0.05, 0.25); b.box("l", 0.012, hh, 0.07, Math.cos(a) * r0, 0.42, Math.sin(a) * r0, -a, Math.sin(a) * lean, -Math.cos(a) * lean); } }
  else if (kind === "palm") { b.limb("l", V(0, 0.4, 0), V(0.02, Hp, 0.01), 0.025, 6); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + rnd(), l = R(rnd, 0.45, 0.65); b.add("l", new THREE.BoxGeometry(l, 0.01, 0.12), 0.02 + Math.cos(a) * l * 0.45, Hp - 0.08, 0.01 + Math.sin(a) * l * 0.45, -a, 1, 1, 1, 0, -0.45); } }
  else { b.limb("g", V(0, 0.4, 0), V(0.03, Hp * 0.7, 0.02), 0.025, 6); const nc = 6; for (let i = 0; i < nc; i++) { const a = i / nc * TAU + rnd(), rr = R(rnd, 0.12, 0.28), y = Hp * R(rnd, 0.55, 0.95); b.sph("l", R(rnd, 0.15, 0.24), Math.cos(a) * rr, y, Math.sin(a) * rr, 1, 0.85, 1, 10); } b.sph("l", 0.22, 0.02, Hp, 0.02, 1, 0.8, 1, 10); }
  return fin(E, b, { pad: 0.25 }); }
function waterCooler(E, p = {}) { const b = new Builder(); b.box("w", 0.32, 0.95, 0.32, 0, 0, 0); b.box("l", 0.005, 0.12, 0.16, -0.163, 0.62, 0); b.box("k", 0.04, 0.04, 0.04, -0.17, 0.72, -0.05); b.box("g", 0.04, 0.04, 0.04, -0.17, 0.72, 0.05);
  b.cyl("l", 0.135, 0.135, 0.36, 0, 1.02, 0, 18); b.cyl("l", 0.06, 0.135, 0.07, 0, 0.95, 0, 18); b.cyl("l", 0.12, 0.12, 0.02, 0, 1.38, 0, 18); b.cyl("w", 0.05, 0.05, 0.08, 0.25, 0, 0.0, 10); for (let i = 0; i < 4; i++) b.cyl("w", 0.04, 0.035, 0.09, 0.25, 0.08 + i * 0.01, 0, 8);
  return fin(E, b, { pad: 0.3, wall: 1 }); }
function flag(E, p = {}) { const { rnd } = E, b = new Builder(), Hp = p.h ?? 2.5;
  b.cyl("w", 0.2, 0.24, 0.06, 0, 0, 0, 18); b.cyl("w", 0.06, 0.12, 0.12, 0, 0.06, 0, 14); b.cyl("l", 0.016, 0.016, Hp, 0, 0.1, 0, 8); b.sph("l", 0.04, 0, Hp + 0.12, 0, 1, 1.3, 1, 10);
  const fw = 0.95, fh = 0.62, nS = p.stripes ?? 7, ph = rnd() * 6; for (let i = 0; i < nS; i++) { const g = new THREE.BoxGeometry(fw, fh / nS, 0.006, 14, 1, 1), pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) { const x = pos.getX(k) + fw / 2; pos.setZ(k, pos.getZ(k) + Math.sin(x * 4.5 + ph) * 0.06 * (x / fw) + x * x * 0.05); pos.setY(k, pos.getY(k) - x * 0.18 * (x / fw)); }
    b.add(i % 2 ? "l" : "w", g, fw / 2 + 0.02, Hp - 0.05 - fh / nS * (i + 0.5), 0); }
  b.add("w", new THREE.BoxGeometry(fw * 0.4, fh * 0.55, 0.008), fw * 0.22 + 0.02, Hp - 0.05 - fh * 0.275, 0.004);
  return fin(E, b, { pad: 0.25, wall: -1 }); }
function tvCamera(E, p = {}) { const { rnd } = E, b = new Builder(), Hh = p.h ?? 1.35;
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; b.limb("k", V(0, Hh - 0.12, 0), V(Math.cos(a) * 0.42, 0.0, Math.sin(a) * 0.42), 0.014, 5); b.limb("l", V(Math.cos(a) * 0.15, 0.3, Math.sin(a) * 0.15), V(0, 0.32, 0), 0.008, 4); }
  b.cyl("k", 0.06, 0.07, 0.1, 0, Hh - 0.13, 0, 10); b.box("k", 0.16, 0.06, 0.14, 0, Hh - 0.04, 0);
  b.box("w", 0.42, 0.22, 0.16, 0.0, Hh + 0.02, 0); b.add("k", xcyl(0.06, 0.22, 14), 0.3, Hh + 0.12, 0); b.add("d", xcyl(0.07, 0.03, 14), 0.42, Hh + 0.12, 0);
  b.box("k", 0.14, 0.09, 0.06, -0.12, Hh + 0.24, -0.11); b.box("l", 0.3, 0.025, 0.04, 0, Hh + 0.26, 0); b.limb("k", V(-0.08, Hh - 0.02, 0.06), V(-0.55, Hh - 0.25, 0.25), 0.012, 5);
  if (chance(rnd, 0.6)) b.box("w", 0.06, 0.05, 0.08, 0.05, Hh + 0.24, 0.0);
  return fin(E, b, { anchors: [anc("stand", -0.62, 0, 0.12, 0)], pad: 0.5, kind: "camera" }); }
function stage(E, p = {}) { const { rnd } = E, b = new Builder(), Ws = p.w ?? 7, Ds = p.d ?? 4, Hs = p.h ?? 0.8, truss = p.truss !== false, anchors = [];   // audience at +x
  b.box("w", Ds, Hs, Ws, 0, 0, 0); b.box("l", 0.03, Hs - 0.06, Ws, Ds / 2 + 0.005, 0.03, 0); b.box("l", Ds + 0.04, 0.04, Ws + 0.04, 0, Hs - 0.04, 0);
  for (let i = 0; i < Math.round(Ws / 1.2); i++) b.box("w", 0.012, Hs - 0.1, 0.02, Ds / 2 + 0.02, 0.05, -Ws / 2 + (i + 0.5) * Ws / Math.round(Ws / 1.2));
  for (let s = 0; s < 3; s++) b.box("w", 0.3, Hs * (s + 1) / 4, 1.0, Ds / 2 - 0.4 - s * 0.3 + 0.0, 0, Ws / 2 + 0.5);
  b.box("l", 0.15, 3.2, Ws * 0.82, -Ds / 2 + 0.2, Hs, 0); b.box("w", 0.06, 2.6, Ws * 0.74, -Ds / 2 + 0.3, Hs + 0.3, 0);   // backdrop
  for (let i = 0; i < 5; i++) b.box("l", 0.01, 0.06, Ws * 0.5, -Ds / 2 + 0.335, Hs + 1.2 + i * 0.25, 0);
  if (truss) { const TH = Hs + 4.2, tower = (z) => { for (const [dx, dz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) b.box("l", 0.04, TH, 0.04, Ds / 2 - 0.3 + dx, 0, z + dz);
      for (let y = 0.4; y < TH; y += 0.5) { b.box("l", 0.3, 0.025, 0.025, Ds / 2 - 0.3, y, z - 0.15); b.box("l", 0.3, 0.025, 0.025, Ds / 2 - 0.3, y, z + 0.15); b.limb("l", V(Ds / 2 - 0.45, y, z - 0.15), V(Ds / 2 - 0.15, y + 0.5, z - 0.15), 0.01, 4); } b.box("k", 0.5, 0.05, 0.5, Ds / 2 - 0.3, 0, z); };
    tower(-Ws / 2 - 0.3); tower(Ws / 2 + 0.3);
    for (const dy of [0, 0.3]) for (const dx of [-0.15, 0.15]) b.box("l", 0.04, 0.04, Ws + 0.9, Ds / 2 - 0.3 + dx, TH - 0.3 + dy, 0);
    for (let z = -Ws / 2; z <= Ws / 2 + 0.01; z += 0.5) b.limb("l", V(Ds / 2 - 0.45, TH - 0.3, z), V(Ds / 2 - 0.15, TH, z + 0.25), 0.01, 4);
    const nl = Math.round(Ws / 0.9); for (let i = 0; i < nl; i++) { const z = -Ws / 2 + (i + 0.5) * Ws / nl; b.box("k", 0.04, 0.12, 0.04, Ds / 2 - 0.3, TH - 0.45, z); b.add("k", new THREE.CylinderGeometry(0.09, 0.07, 0.24, 10), Ds / 2 - 0.25, TH - 0.6, z, 0, 1, 1, 1, 0, 0.7); } }
  for (const s of [-1, 1]) { b.box("k", 0.6, 1.0, 0.6, Ds / 2 - 0.5, Hs, s * (Ws / 2 - 0.5)); b.box("k", 0.55, 0.7, 0.55, Ds / 2 - 0.5, Hs + 1.0, s * (Ws / 2 - 0.5)); for (let k = 0; k < 2; k++) b.add("d", xcyl(0.15, 0.02, 14), Ds / 2 - 0.19, Hs + 0.35 + k * 1.0, s * (Ws / 2 - 0.5)); }
  anchors.push(anc("podium", 0.0, Hs, 0, 0)); for (let i = 0; i < 4; i++) anchors.push(anc("stand", -0.9, Hs, (i < 2 ? -1 : 1) * (1.1 + (i % 2) * 0.7), 0.1 * (i < 2 ? 1 : -1)));
  return fin(E, b, { anchors, pad: 1.0, wall: -1, kind: "stage", extra: { deck: Hs } }); }
function ropePosts(E, p = {}) { const b = new Builder(), L = p.len ?? 4, gap = p.gap ?? 1.4, n = Math.max(2, Math.round(L / gap) + 1), metal = p.metal;   // line along z
  if (metal) { const np = Math.max(1, Math.round(L / 2.2)); for (let i = 0; i < np; i++) { const z = -L / 2 + (i + 0.5) * L / np, pl = L / np - 0.06;
      b.box("l", 0.035, 0.035, pl, 0, 1.08, z); b.box("l", 0.035, 0.035, pl, 0, 0.15, z); for (const s of [-1, 1]) { b.box("l", 0.035, 1.1, 0.035, 0, 0.1, z + s * pl / 2); b.box("l", 0.55, 0.03, 0.04, 0, 0, z + s * pl / 2); }
      for (let k = 1; k < pl / 0.13; k++) b.box("l", 0.015, 0.93, 0.015, 0, 0.15, z - pl / 2 + k * 0.13); } return fin(E, b, { pad: 0.2, kind: "barrier" }); }
  for (let i = 0; i < n; i++) { const z = -L / 2 + i * L / (n - 1); b.cyl("k", 0.15, 0.16, 0.03, 0, 0, z, 16); b.cyl("l", 0.025, 0.025, 0.95, 0, 0.03, z, 8); b.sph("l", 0.04, 0, 1.0, z, 1, 1, 1, 10);
    if (i < n - 1) { const z1 = -L / 2 + (i + 1) * L / (n - 1), seg = 6; for (let k = 0; k < seg; k++) { const u0 = k / seg, u1 = (k + 1) / seg, y = u => 0.93 - Math.sin(u * PI) * 0.16; b.limb("d", V(0, y(u0), z + (z1 - z) * u0), V(0, y(u1), z + (z1 - z) * u1), 0.014, 5); } } }
  return fin(E, b, { pad: 0.2, kind: "barrier" }); }
function crates(E, p = {}) { const { rnd } = E, b = new Builder(), kind = p.kind ?? pick(rnd, ["card", "crate", "card"]), nx = p.nx ?? 2, nz = p.nz ?? 2, maxT = p.tiers ?? 3;
  const pallet = p.pallet ?? true, s = kind === "crate" ? 0.55 : 0.42; if (pallet) { b.box("l", nx * s + 0.06, 0.03, nz * s + 0.06, 0, 0.11, 0); for (const z of [-1, 0, 1]) b.box("l", nx * s + 0.06, 0.09, 0.1, 0, 0.02, z * (nz * s / 2 - 0.02)); b.box("l", nx * s + 0.06, 0.02, nz * s + 0.06, 0, 0, 0); }
  const y0 = pallet ? 0.14 : 0; for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const tiers = 1 + Math.floor(rnd() * maxT); for (let t = 0; t < tiers; t++) { const x = (i - (nx - 1) / 2) * s, z = (j - (nz - 1) / 2) * s, y = y0 + t * s * 0.82, jit = R(rnd, -0.03, 0.03);
      if (kind === "crate") { b.box("w", s - 0.02, s * 0.8, s - 0.02, x, y, z, jit); for (const yy of [0.1, 0.45]) b.box("l", s, 0.06, s, x, y + s * 0.8 * yy, z, jit); }
      else { b.box("s", s - 0.02, s * 0.8, s - 0.02, x, y, z, jit); b.box("l", 0.08, 0.004, s - 0.01, x, y + s * 0.8, z, jit); } } }
  return fin(E, b, { pad: 0.35 }); }
function docPile(E, p = {}) { const { rnd } = E, b = new Builder(), n = p.n ?? 4; for (let i = 0; i < n; i++) pile(b, rnd, (i % 2) * 0.34, 0, Math.floor(i / 2) * 0.26, R(rnd, -0.2, 0.2), R(rnd, 0.1, 0.5));
  if (chance(rnd, 0.6)) for (let i = 0; i < 4; i++) b.box(pick(rnd, ["g", "l", "w"]), 0.3, 0.32, 0.06, 0.8, 0, -0.1 + i * 0.07, 0, 0, i === 3 ? 0.25 : 0);
  return fin(E, b, { pad: 0.2 }); }

// ============================== work: lab, workshop, factory, mill ==============================
function labBench(E, p = {}) { const { rnd } = E, b = new Builder(), L = p.len ?? 2.6, D = 0.8, H = 0.9, anchors = [];   // long along z, user at -x
  b.box("w", D - 0.05, H - 0.05, L, 0.02, 0, 0); b.box("l", D + 0.02, 0.05, L + 0.04, 0, H - 0.05, 0); for (let i = 0; i < Math.round(L / 0.6); i++) { const z = -L / 2 + (i + 0.5) * L / Math.round(L / 0.6); b.box("l", 0.006, H - 0.2, 0.005, -D / 2 + 0.045, 0.1, z - L / Math.round(L / 0.6) / 2 + 0.01); b.box("k", 0.01, 0.1, 0.015, -D / 2 + 0.04, H - 0.25, z + 0.2); }
  for (const s of [-1, 1]) b.box("l", 0.04, 0.55, 0.04, D / 2 - 0.1, H, s * (L / 2 - 0.1)); b.box("w", 0.28, 0.025, L, D / 2 - 0.14, H + 0.55, 0);   // reagent shelf
  for (let z = -L / 2 + 0.12; z < L / 2 - 0.1; z += 0.1) if (chance(rnd, 0.75)) bottle(b, D / 2 - 0.14, H + 0.575, z, R(rnd, 0.14, 0.24), pick(rnd, ["l", "w", "g"]));
  // instruments: microscope, beakers, flask, tube rack, sink
  const mz = R(rnd, -L / 4, L / 4); b.box("k", 0.2, 0.03, 0.16, 0, H, mz); b.limb("k", V(0.06, H + 0.03, mz), V(0.07, H + 0.3, mz), 0.025, 8); b.limb("k", V(0.07, H + 0.3, mz), V(-0.02, H + 0.38, mz), 0.02, 8); b.box("k", 0.1, 0.02, 0.1, -0.02, H + 0.14, mz); b.cyl("d", 0.018, 0.018, 0.1, -0.03, H + 0.18, mz, 8);
  for (let i = 0; i < 3; i++) { const z = mz + 0.4 + i * 0.12; if (z > L / 2 - 0.1) break; b.cyl("l", 0.04, 0.04, R(rnd, 0.08, 0.14), 0.12, H, z, 12); }
  { const z = mz - 0.45; if (z > -L / 2 + 0.1) { b.sph("l", 0.07, 0.1, H + 0.07, z, 1, 1, 1, 12); b.cyl("l", 0.018, 0.022, 0.1, 0.1, H + 0.12, z, 8); } }
  { const z = L / 2 - 0.3; b.box("w", 0.1, 0.06, 0.32, -0.05, H, z); for (let i = 0; i < 7; i++) b.cyl("l", 0.008, 0.008, 0.13, -0.05, H + 0.01, z - 0.13 + i * 0.043, 6); }
  { const z = -L / 2 + 0.32; b.box("d", 0.4, 0.01, 0.4, 0.02, H, z); b.limb("l", V(0.24, H, z), V(0.24, H + 0.3, z), 0.012, 6); b.limb("l", V(0.24, H + 0.3, z), V(0.1, H + 0.3, z), 0.01, 6); }
  const ns = Math.max(1, Math.floor(L / 1.2)); for (let i = 0; i < ns; i++) { const z = -L / 2 + (i + 0.5) * L / ns; anchors.push(chance(rnd, 0.5) ? chairAt(b, rnd, "stool", -D / 2 - 0.3, z, 0, { seat: 0.66, jit: 0.4 }) : anc("stand", -D / 2 - 0.35, 0, z, 0)); }
  return fin(E, b, { anchors, pad: 0.6, wall: 1 }); }
function workbench(E, p = {}) { const { rnd } = E, b = new Builder(), L = p.len ?? 1.9, D = 0.75, H = 0.9;
  b.box("s", D, 0.06, L, 0, H - 0.06, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box("l", 0.06, H - 0.06, 0.06, sx * (D / 2 - 0.05), 0, sz * (L / 2 - 0.05)); b.box("l", D - 0.1, 0.03, L - 0.1, 0, 0.18, 0);
  b.box("w", 0.03, 1.0, L, D / 2 - 0.02, H, 0); for (let y = 0.12; y < 0.95; y += 0.08) for (let z = -L / 2 + 0.06; z < L / 2; z += 0.08) if (chance(rnd, 0.25)) b.box("l", 0.004, 0.01, 0.01, D / 2 - 0.04, H + y, z);   // pegboard
  for (let i = 0; i < 7; i++) { const z = -L / 2 + 0.2 + i * (L - 0.4) / 6, y = H + 0.35 + (i % 2) * 0.28, t = i % 3; if (t === 0) { b.limb("d", V(D / 2 - 0.05, y + 0.2, z), V(D / 2 - 0.05, y - 0.08, z), 0.01, 5); b.box("k", 0.04, 0.04, 0.12, D / 2 - 0.06, y + 0.18, z); }
    else if (t === 1) { b.limb("k", V(D / 2 - 0.05, y + 0.15, z), V(D / 2 - 0.05, y - 0.1, z + 0.02), 0.009, 5); b.add("k", new THREE.TorusGeometry(0.025, 0.008, 5, 10), D / 2 - 0.05, y + 0.17, z, 0, 1, 1, 1, 0, 0); }
    else b.box("l", 0.01, 0.28, 0.1, D / 2 - 0.05, y - 0.12, z); }
  b.box("k", 0.16, 0.1, 0.14, -D / 2 + 0.1, H, -L / 2 + 0.15); b.box("k", 0.06, 0.08, 0.2, -D / 2 + 0.02, H + 0.06, -L / 2 + 0.15);   // vise
  b.box("g", 0.22, 0.16, 0.42, 0.12, H, L / 2 - 0.32); b.box("k", 0.04, 0.03, 0.2, 0.12, H + 0.16, L / 2 - 0.32);   // toolbox
  for (let i = 0; i < 4; i++) b.box(pick(rnd, ["l", "k", "w"]), R(rnd, 0.05, 0.12), R(rnd, 0.02, 0.06), R(rnd, 0.05, 0.15), R(rnd, -0.2, 0.15), H, R(rnd, -0.3, 0.3), rnd() * 3);
  b.box("w", D - 0.15, 0.25, 0.5, 0, 0.21, -L / 4); return fin(E, b, { anchors: [anc("stand", -D / 2 - 0.35, 0, R(rnd, -0.3, 0.3), 0)], pad: 0.6, wall: 1 }); }
function machineTool(E, p = {}) { const { rnd } = E, b = new Builder(), type = p.type ?? pick(rnd, ["lathe", "mill", "lathe"]);
  if (type === "mill") { b.box("w", 0.9, 0.9, 0.8, 0.15, 0, 0); b.box("w", 0.55, 1.2, 0.55, 0.3, 0.9, 0); b.box("w", 0.7, 0.42, 0.45, 0.05, 1.6, 0); b.cyl("k", 0.08, 0.08, 0.25, -0.15, 1.38, 0, 12);
    b.box("k", 0.55, 0.1, 1.1, -0.05, 0.92, 0); b.box("l", 0.4, 0.06, 0.25, -0.05, 1.02, 0); b.add("k", xcyl(0.05, 0.08, 10), -0.4, 0.97, 0.45); b.box("g", 0.1, 0.25, 0.3, 0.45, 1.25, -0.28); b.box("d", 0.01, 0.15, 0.2, 0.395, 1.3, -0.28); }
  else { const L = 2.0; for (const z of [-L / 2 + 0.25, L / 2 - 0.25]) b.box("w", 0.55, 0.85, 0.45, 0, 0, z); b.box("l", 0.65, 0.05, L, 0, 0.82, 0); b.box("k", 0.32, 0.2, L - 0.2, 0.05, 0.87, 0);
    b.box("w", 0.55, 0.48, 0.5, 0.05, 1.07, -L / 2 + 0.35); b.add("d", zcyl(0.13, 0.12, 18), 0.0, 1.27, -L / 2 + 0.66); for (let i = 0; i < 3; i++) b.box("k", 0.03, 0.06, 0.04, 0.0, 1.38 - i * 0.1, -L / 2 + 0.7);
    b.box("w", 0.28, 0.3, 0.3, 0.05, 1.07, L / 2 - 0.35); b.add("k", zcyl(0.04, 0.3, 10), 0.05, 1.26, L / 2 - 0.62); b.box("g", 0.4, 0.12, 0.3, -0.05, 1.07, 0.1); b.box("k", 0.1, 0.12, 0.1, 0.0, 1.19, 0.1);
    b.box("l", 0.04, 0.5, 0.6, 0.33, 1.07, -L / 2 + 0.4, 0, 0, -0.2); b.add("k", xcyl(0.06, 0.06, 10), -0.25, 1.05, 0.1); b.box("l", 0.6, 0.03, L * 0.7, 0, 0.83, 0); }
  b.box("l", 1.0, 0.012, 1.2, -0.8, 0, 0); return fin(E, b, { anchors: [anc("stand", -0.65, 0, 0.0, 0)], pad: 0.6, wall: 1, kind: "machine" }); }
function assemblyLine(E, p = {}) { const { rnd } = E, b = new Builder(), L = p.len ?? 10, H = 0.85, Wb = 0.65, st = p.stations ?? Math.max(2, Math.floor(L / 2.2)), prod = p.product ?? pick(rnd, ["box", "part", "box"]), anchors = [];   // along z, workers both sides
  b.box("d", Wb - 0.08, 0.02, L, 0, H - 0.02, 0); for (const s of [-1, 1]) { b.box("l", 0.04, 0.12, L, s * Wb / 2, H - 0.08, 0); b.box("w", 0.03, 0.03, L, s * (Wb / 2 + 0.03), H + 0.06, 0); }
  for (let z = -L / 2; z <= L / 2 + 0.01; z += 0.25) b.add("k", xcyl(0.03, Wb - 0.06, 8), 0, H - 0.05, z);
  for (let z = -L / 2 + 0.2; z <= L / 2; z += 1.5) { for (const s of [-1, 1]) b.box("l", 0.05, H - 0.1, 0.05, s * (Wb / 2 - 0.05), 0, z); b.box("l", Wb, 0.04, 0.05, 0, 0.25, z); }
  for (const s of [-1, 1]) b.box("w", 0.8, 0.95, Wb + 0.25, 0, 0, s * (L / 2 + 0.4)); b.box("k", 0.5, 0.3, 0.3, 0.1, 0.95, L / 2 + 0.4);   // drive / end units
  for (let z = -L / 2 + 0.45; z < L / 2 - 0.2; z += 0.95) { if (prod === "box") { b.box("s", 0.38, 0.26, 0.32, R(rnd, -0.03, 0.03), H, z); b.box("l", 0.08, 0.004, 0.32, 0, H + 0.26, z); } else { b.box("w", 0.42, 0.06, 0.5, 0, H, z); b.box("w", 0.3, 0.12, 0.12, 0, H + 0.06, z - 0.1); b.cyl("l", 0.06, 0.06, 0.1, 0.0, H + 0.06, z + 0.12, 10); } }
  for (let i = 0; i < st; i++) { const z = -L / 2 + (i + 0.5) * L / st, s = i % 2 ? 1 : -1;
    for (const ss of [-1, 1]) b.box("l", 0.06, 2.3, 0.06, ss * (Wb / 2 + 0.35), 0, z - 0.6); b.box("l", Wb + 0.8, 0.08, 0.08, 0, 2.3, z - 0.6); b.box("l", 0.1, 0.08, 1.2, s * 0.1, 2.24, z);   // gantry
    b.limb("k", V(s * 0.1, 2.24, z), V(s * 0.1, 1.55, z), 0.008, 4); b.box("k", 0.12, 0.2, 0.1, s * 0.1, 1.35, z); b.cyl("k", 0.025, 0.02, 0.15, s * 0.1, 1.2, z, 8);   // hanging tool
    b.add("w", new THREE.CylinderGeometry(0.16, 0.24, 0.12, 16, 1, true), -s * 0.15, 1.95, z); b.add("w", new THREE.CylinderGeometry(0.16, 0.24, 0.12, 16), -s * 0.15, 1.95, z);   // lamp shade
    const rx = s * (Wb / 2 + 1.25); b.box("w", 0.5, 1.1, 0.9, rx, 0, z); for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) b.box(pick(rnd, ["l", "s", "g"]), 0.2, 0.16, 0.38, rx - s * 0.18, 0.18 + r * 0.33, z - 0.22 + c * 0.44);   // parts rack
    b.box("l", 0.8, 0.012, 1.0, s * (Wb / 2 + 0.55), 0, z);   // floor mat
    anchors.push(anc("stand", s * (Wb / 2 + 0.45), 0, z + R(rnd, -0.15, 0.15), s > 0 ? PI : 0, { work: true })); }
  return fin(E, b, { anchors, pad: 0.6, kind: "line" }); }
function spinningFrame(E, p = {}) { const { rnd } = E, b = new Builder(), L = p.len ?? 6, D = 0.75, shaftY = p.shaftY ?? 3.4, anchors = [];   // 1790s water/throstle frame, along z
  for (let z = -L / 2; z <= L / 2 + 0.01; z += L / Math.round(L / 1.5)) { b.box("w", D, 0.08, 0.08, 0, 0.05, z); for (const s of [-1, 1]) b.limb("w", V(s * D / 2, 0.05, z), V(s * 0.12, 1.55, z), 0.035, 6); b.box("w", 0.3, 0.08, 0.08, 0, 1.5, z); }
  for (const s of [-1, 1]) { for (const y of [0.32, 0.62]) b.box("w", 0.05, 0.05, L, s * (D / 2 - 0.05) * (1 - y / 1.6), y, 0);
    const xr = s * 0.28; b.box("l", 0.1, 0.03, L, xr, 0.66, 0);   // spindle rail
    for (let z = -L / 2 + 0.06; z < L / 2 - 0.04; z += 0.11) { b.cyl("k", 0.007, 0.007, 0.3, xr, 0.6, z, 5); b.cyl("w", 0.024, 0.02, 0.11, xr, 0.71, z, 8); if (chance(rnd, 0.25)) b.cyl("w", 0.028, 0.028, 0.04, xr, 0.74, z, 8); }
    b.add("k", zcyl(0.02, L, 8), s * 0.22, 1.08, 0); b.add("k", zcyl(0.018, L, 8), s * 0.2, 1.13, 0); b.add("l", zcyl(0.015, L, 6), s * 0.28, 0.98, 0);   // drafting rollers, thread board
    for (let z = -L / 2 + 0.11; z < L / 2 - 0.08; z += 0.22) b.cyl("w", 0.04, 0.04, 0.17, s * 0.1, 1.32, z, 10);   // roving bobbins in the creel
    for (let z = -L / 2 + 0.06; z < L / 2 - 0.04; z += 0.11) b.limb("l", V(s * 0.21, 1.1, z), V(s * 0.28, 0.82, z), 0.0025, 3); }
  b.box("w", D + 0.1, 1.35, 0.7, 0, 0, L / 2 + 0.4); for (let i = 0; i < 3; i++) b.add("k", xcyl(0.18 - i * 0.04, 0.05, 20), D / 2 + 0.07, 0.45 + i * 0.32, L / 2 + 0.25 + i * 0.12);   // headstock + gears
  b.add("k", xcyl(0.3, 0.1, 24), 0, 1.55, L / 2 + 0.4); b.box("l", 0.08, shaftY - 1.6, 0.01, 0.02, 1.55, L / 2 + 0.12, 0, 0, 0.04); b.box("l", 0.08, shaftY - 1.6, 0.01, -0.02, 1.55, L / 2 + 0.68, 0, 0, -0.04);   // pulley + belt to the line shaft
  b.add("k", xcyl(0.36, 0.1, 24), 0, shaftY, L / 2 + 0.4);
  const nw = p.workers ?? Math.max(2, Math.round(L / 2)); for (let i = 0; i < nw; i++) { const s = i % 2 ? 1 : -1, z = -L / 2 + (i + 0.5) * L / nw; anchors.push(anc("stand", s * (D / 2 + 0.38), 0, z, s > 0 ? PI : 0, { work: true })); }
  b.box("w", 0.5, 0.3, 0.45, -D / 2 - 0.5, 0, -L / 2 + 0.6); for (let k = 0; k < 6; k++) b.cyl("w", 0.035, 0.035, 0.1, -D / 2 - 0.5 + R(rnd, -0.15, 0.15), 0.3, -L / 2 + 0.6 + R(rnd, -0.15, 0.15), 8);   // bobbin basket
  return fin(E, b, { anchors, pad: 0.7, kind: "machine" }); }

// ============================== transit / public ==============================
function beamSeats(E, p = {}) { const { rnd } = E, b = new Builder(), n = p.n ?? 5, two = p.double ?? false, anchors = [];   // airport beam seating along z, faces +x (second row back-to-back)
  for (const side of two ? [1, -1] : [1]) { const off = two ? -side * 0.34 : 0; b.box("k", 0.08, 0.06, n * 0.6 + 0.1, off, 0.3, 0); for (let i = 0; i < 2; i++) { const z = (i ? 1 : -1) * (n * 0.3 - 0.25); b.box("k", 0.06, 0.32, 0.06, off, 0, z); b.box("k", 0.5, 0.03, 0.08, off, 0, z); }
    for (let i = 0; i < n; i++) { const z = -(n - 1) * 0.3 + i * 0.6, a = side > 0 ? 0 : PI; const m = new Builder(); m.box("g", 0.46, 0.06, 0.5, 0.02, 0.4, 0); m.box("g", 0.06, 0.45, 0.5, -0.22, 0.46, 0, 0, 0, 0.12); m.box("k", 0.3, 0.03, 0.04, 0.0, 0.62, 0.27); put(b, m, off, z, a); anchors.push(anc("seat", off + Math.cos(a) * 0.03, 0.46, z, a)); } }
  if (chance(rnd, 0.5)) b.box("g", 0.35, 0.45, 0.22, two ? 0.45 : 0.55, 0, R(rnd, -n * 0.25, n * 0.25));   // a carry-on
  return fin(E, b, { anchors, pad: 0.7 }); }
function gateDesk(E, p = {}) { const { rnd } = E, b = new Builder(), L = p.len ?? 2.6;   // agent behind at +x facing -x (passengers at -x)
  b.box("w", 0.65, BAR_H, L, 0, 0, 0); b.box("w", 0.8, 0.04, L + 0.1, -0.05, BAR_H, 0); b.box("l", 0.02, 0.3, L - 0.2, -0.33, 0.5, 0); for (let i = 0; i < 2; i++) monitor(b, -0.05, BAR_H + 0.04, -L / 4 + i * L / 2, 0, 0.75);
  b.box("k", 0.3, 0.25, 0.4, 0.05, BAR_H + 0.04, 0.05); for (const s of [-1, 1]) b.box("l", 0.06, 2.4, 0.06, 0.6, 0, s * 0.9); b.box("d", 0.08, 0.7, 2.2, 0.6, 2.35, 0); for (let i = 0; i < 3; i++) b.box("w", 0.004, 0.08, R(rnd, 0.6, 1.6), 0.555, 2.5 + i * 0.17, 0, 0);
  return fin(E, b, { anchors: [anc("stand", 0.6, 0, -0.5, PI), anc("stand", 0.6, 0, 0.6, PI)], pad: 0.8, wall: -1, faceAxis: PI }); }
function screenWall(E, p = {}) { const b = new Builder(), nx = p.nx ?? 3, ny = p.ny ?? 2, sw = 1.2, sh = 0.7;   // wall of TVs (newsroom), on the wall: front -x
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const z = (i - (nx - 1) / 2) * (sw + 0.04), y = 1.5 + j * (sh + 0.04); b.box("k", 0.06, sh, sw, 0, y, z); b.box("d", 0.01, sh - 0.05, sw - 0.05, -0.032, y + 0.025, z); }
  b.box("l", 0.1, 0.1, nx * (sw + 0.04), 0.02, 1.38, 0); return fin(E, b, { pad: 0.2, wall: 1, kind: "screen", anchors: [anc("screen", -0.04, 1.5 + ny * sh / 2, 0, PI)] }); }
function chairsRows(E, p = {}) { const { rnd } = E, b = new Builder(), rows = p.rows ?? 4, cols = p.cols ?? 8, aisle = p.aisle ?? 1.0, anchors = [], style = p.chair ?? "stack";   // audience rows, face +x, rows step back to -x
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const zc = (c - (cols - 1) / 2) * 0.58 + (aisle && c >= cols / 2 ? aisle / 2 : -aisle / 2) * (aisle ? 1 : 0), x = -r * 0.95; anchors.push({ ...chairAt(b, rnd, style, x, zc, 0, { jit: 0.06, pull: 0.03 }), row: r }); }
  return fin(E, b, { anchors, pad: 0.6, kind: "seats" }); }

// ============================== street props (built in metres; street scale scales the whole set) ==============================
function lampPost(E, p = {}) { const b = new Builder(), H = p.h ?? 5.2; b.cyl("k", 0.14, 0.18, 0.5, 0, 0, 0, 12); b.cyl("k", 0.06, 0.09, H, 0, 0.5, 0, 10); b.limb("k", V(0, H + 0.4, 0), V(0.9, H + 0.55, 0), 0.04, 6);
  b.box("w", 0.5, 0.14, 0.26, 1.05, H + 0.42, 0); b.box("l", 0.44, 0.02, 0.2, 1.05, H + 0.4, 0); if (p.banner) { b.box("w", 0.02, 1.0, 0.45, 0.1, H - 1.6, 0.26); b.box("l", 0.03, 0.03, 0.5, 0.1, H - 0.6, 0.26); }
  return fin(E, b, { pad: 0.4, cx: 0, cz: 0, kind: "lamp" }); }
function bench(E, p = {}) { const b = new Builder(), L = p.len ?? 1.8; for (const s of [-1, 1]) { b.box("k", 0.5, 0.42, 0.06, 0, 0, s * (L / 2 - 0.15)); b.box("k", 0.06, 0.45, 0.06, -0.23, 0.42, s * (L / 2 - 0.15), 0, 0, 0.15); }
  for (let i = 0; i < 4; i++) b.box("s", 0.1, 0.035, L, -0.18 + i * 0.12, 0.42, 0); for (let i = 0; i < 3; i++) b.box("s", 0.035, 0.1, L, -0.26 - i * 0.025, 0.52 + i * 0.12, 0, 0, 0, 0.15);
  return fin(E, b, { anchors: [anc("seat", 0.02, 0.46, -L / 4, 0), anc("seat", 0.02, 0.46, L / 4, 0)], pad: 0.3, wall: -1 }); }
function bollard(E, p = {}) { const b = new Builder(); b.cyl("k", 0.1, 0.12, 0.9, 0, 0, 0, 10); b.sph("k", 0.1, 0, 0.9, 0, 1, 0.6, 1, 10); b.cyl("l", 0.11, 0.11, 0.05, 0, 0.7, 0, 10); return fin(E, b, { pad: 0.1, cx: 0, cz: 0 }); }
function tree(E, p = {}) { const { rnd } = E, b = new Builder(), H = p.h ?? R(rnd, 5, 7.5);
  if (p.planter !== false) { b.box("w", 1.6, 0.45, 1.6, 0, 0, 0); b.box("d", 1.4, 0.02, 1.4, 0, 0.44, 0); }
  b.limb("l", V(0, 0.4, 0), V(0.1, H * 0.55, 0.05), 0.12, 7); for (let i = 0; i < 3; i++) { const a = i * 2.1 + rnd(); b.limb("l", V(0.1, H * 0.5, 0.05), V(Math.cos(a) * 0.9, H * 0.72, Math.sin(a) * 0.9), 0.06, 6); }
  const nc = 7; for (let i = 0; i < nc; i++) { const a = i / nc * TAU + rnd(), rr = R(rnd, 0.6, 1.3), y = H * R(rnd, 0.68, 0.9); b.sph("w", R(rnd, 0.9, 1.4), Math.cos(a) * rr, y, Math.sin(a) * rr, 1, 0.85, 1, 12); } b.sph("w", 1.4, 0, H * 0.92, 0, 1, 0.8, 1, 12);
  return fin(E, b, { pad: 0.3, cx: 0, cz: 0, kind: "tree" }); }
function newsVan(E, p = {}) { const b = new Builder(); b.box("w", 5.4, 1.9, 2.0, 0, 0.35, 0); b.box("w", 1.3, 1.2, 2.0, 3.25, 0.35, 0); b.box("d", 0.05, 0.6, 1.8, 3.92, 0.9, 0, 0, 0, -0.35); b.box("d", 1.0, 0.5, 2.02, 3.3, 1.0, 0);
  for (const x of [-1.8, 2.9]) for (const s of [-1, 1]) b.add("k", zcyl(0.38, 0.28, 16), x, 0.38, s * 0.9); b.box("l", 3.6, 0.04, 1.9, -0.6, 2.25, 0); b.cyl("l", 0.08, 0.06, 3.2, -1.6, 2.25, 0, 8);
  b.add("w", new THREE.SphereGeometry(0.75, 18, 8, 0, TAU, 0, 0.9), -1.6, 5.2, 0, 0, 1, 1, 1, 0, -1.2); b.box("l", 1.4, 0.3, 0.02, 0, 1.3, 1.011); return fin(E, b, { pad: 0.6, kind: "vehicle" }); }
function carProp(E, p = {}) { const { rnd } = E, b = new Builder(), L = p.len ?? R(rnd, 4.2, 4.8), W = 1.8, type = p.type ?? pick(rnd, ["sedan", "sedan", "hatch", "suv"]);
  const ch = type === "suv" ? 0.85 : 0.7; b.box(pick(rnd, ["w", "w", "l", "g"]), L, ch, W, 0, 0.3, 0); const cab = type === "hatch" ? 0.55 : 0.48, cl = L * cab;
  b.box("w", cl, 0.55, W - 0.12, type === "hatch" ? -L * 0.12 : -L * 0.05, 0.3 + ch, 0); b.box("d", cl + 0.02, 0.36, W - 0.1, type === "hatch" ? -L * 0.12 : -L * 0.05, 0.38 + ch, 0);
  for (const x of [L / 2 - 0.8, -L / 2 + 0.75]) for (const s of [-1, 1]) b.add("k", zcyl(0.33, 0.24, 16), x, 0.33, s * (W / 2 - 0.1));
  b.box("l", 0.05, 0.12, W - 0.3, L / 2 + 0.01, 0.55, 0); b.box("l", 0.05, 0.12, W - 0.3, -L / 2 - 0.01, 0.55, 0); return fin(E, b, { pad: 0.5, kind: "vehicle" }); }
function busStop(E, p = {}) { const b = new Builder(); for (const z of [-1.5, 1.5]) b.box("k", 0.08, 2.5, 0.08, -0.6, 0, z); b.box("l", 1.4, 0.08, 3.4, -0.1, 2.5, 0); b.box("l", 0.03, 1.8, 3.0, -0.62, 0.4, 0); b.box("w", 0.06, 1.6, 1.1, -0.3, 0.6, 1.75);
  b.box("k", 0.4, 0.06, 2.4, -0.4, 0.45, 0); return fin(E, b, { anchors: [anc("seat", -0.35, 0.48, -0.5, 0), anc("seat", -0.35, 0.48, 0.5, 0)], pad: 0.5, wall: -1 }); }
function jet(E, p = {}) { const b = new Builder(), L = p.len ?? 22;   // nose section of an airliner (seen through the gate windows), along x
  const g = new THREE.CylinderGeometry(1.9, 1.9, L, 28); g.rotateZ(HP); b.add("w", g, -L / 2, 2.8, 0); b.add("w", new THREE.SphereGeometry(1.9, 28, 16, 0, TAU, 0, HP), 0, 2.8, 0, 0, 1, 1, 1, 0, -HP); b.add("w", new THREE.SphereGeometry(1.9, 28, 16), 0, 2.8, 0, 0, 1.2, 1, 1);
  b.box("d", 0.6, 0.35, 2.2, 1.5, 3.55, 0, 0, 0, -0.5); for (let i = 0; i < 16; i++) for (const s of [-1, 1]) b.box("d", 0.25, 0.35, 0.02, -3 - i * 0.95, 3.2, s * 1.89);
  b.box("w", 6, 0.35, 16, -L + 4, 2.0, 0, 0, 0, 0); for (const s of [-1, 1]) b.add("l", xcyl(0.8, 2.6, 18), -L + 6, 1.5, s * 5); b.box("k", 0.2, 1.0, 0.2, -1.5, 0, 0); b.add("k", zcyl(0.35, 0.3, 14), -1.5, 0.35, 0);
  return fin(E, b, { pad: 1, kind: "vehicle" }); }

export const FURN = { table, roundTable, boardroomTable, booth, chair: (E, p = {}) => { const b = new Builder(), a = chairAt(b, E.rnd, p.style ?? "office", 0, 0, 0, { jit: 0, pull: 0 }); return fin(E, b, { anchors: [a], pad: 0.3 }); },
  desk, deskRow, newsDesk, tradingDesk, cluster, podium, lectern: podium, judgeBench, witnessBox, juryBox, pews, gallery: pews, dais, hearingDais: dais, bed, sofa, coffeeTable, counter, bar: counter, stall, marketStall: stall,
  shelf, rack: shelf, filing, serverRack, whiteboard, partition, door, window: windowF, plant, waterCooler, flag, tvCamera, camera: tvCamera, stage, ropePosts, barrier: (E, p = {}) => ropePosts(E, { metal: true, ...p }),
  crates, boxes: crates, docPile, labBench, workbench, machineTool, assemblyLine, conveyorLine: assemblyLine, spinningFrame, beamSeats, gateDesk, screenWall, chairsRows,
  lampPost, bench, bollard, tree, newsVan, car: carProp, busStop, jet,
  witnessTable: (E, p = {}) => table(E, { sides: "one", names: true, mics: true, laptops: 0.1, seats: p.seats ?? 3, len: p.len ?? Math.max(2.4, (p.seats ?? 3) * 0.9), ...p }) };
