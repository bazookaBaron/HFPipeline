// SET COMPOSER: buildSet(spec, ctx) -> { group, subjects, proxies, framings, update(t), setFocus(name|null), light, info }
// spec is DATA (see sets.html). Ground -> signed land field s(x,z) (>0 land, ~ distance to shore) + elevation; place[] entries are solved at runtime:
// priorities (structures -> big land -> vessels -> linear -> vehicles/people -> props), "where" rules (land/water/shore/inland/hills/near X/on jetty/along road/lane...),
// collision avoidance on a spatial hash, terrain pads/corridors so everything has ground contact, density fill (instanced vegetation, rocks, shore foam).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GEN, Builder, MK, FOCUSMAP, LAND_H, rng, vnoise, fbm, smooth, clamp, treeParts, floeGeo, ribbonGeo, roadBuild, railBuild, pipelineBuild, fenceBuild, alongPath } from "./grammar3d.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z), D2R = Math.PI / 180;
const hashStr = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const NINT = new Set(["tankFarm", "people", "silo", "train", "plantation"]);
const PRI = { quay: 10, jetty: 10, pier: 10, breakwater: 12, town: 20, city: 20, plantation: 24, mountain: 22, checkpoint: 45, tanker: 30, containerShip: 30, bulkCarrier: 30, warship: 30, carrier: 30, tug: 32, icebreaker: 30, fishingBoat: 33, skiff: 34, ferry: 33, dredger: 33, buoy: 55,
  road: 40, rail: 41, pipeline: 42, fence: 44, truck: 50, car: 50, bus: 50, train: 50, people: 52, rocks: 56, trees: 60, floes: 58, icebergs: 58, watchtower: 38, gantryCrane: 26, containerYard: 22 };
const SHORE_DIR = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] };
const LIGHTS = { dawn: [100, 12, 0xffd9b8, 2.4, 1.0, 0xe8e2e4], morning: [118, 28, 0xfff0d8, 3.0, 1.15, 0xdfe4e8], noon: [150, 62, 0xfff6e8, 3.2, 1.1, 0xe3e9ee], afternoon: [215, 34, 0xffe9cc, 3.0, 1.1, 0xe4e4e4],
  evening: [250, 12, 0xffd2a8, 2.8, 0.95, 0xeadfd8], overcast: [130, 55, 0xf4f4f4, 1.3, 1.6, 0xe0e3e6] };

// ============================== ground ==============================
function makeGround(g) {
  const kind = g.kind ?? "coast", seed = g.seed ?? 1, size = g.size ?? 260, half = size / 2, relief = g.relief ?? 0.4, ang = (g.angle ?? 0) * D2R, ca = Math.cos(ang), sa = Math.sin(ang);
  const N1 = vnoise(seed * 7 + 1), N2 = vnoise(seed * 13 + 5), N3 = vnoise(seed * 29 + 9);
  const U = (x, z) => x * ca + z * sa, Vv = (x, z) => -x * sa + z * ca, W = (u, v) => [u * ca - v * sa, u * sa + v * ca];
  const defShore = { coast: "south", desert: "south", city: "south" }[kind];
  const shoreN = SHORE_DIR[g.shore === false ? "" : (g.shore ?? defShore)] ?? null, wig = (g.wiggle ?? 0.5) * 11;
  const coastS = shoreN && ((x, z) => { const d = x * shoreN[0] + z * shoreN[1], cl = half * (2 * (g.landFrac ?? 0.56) - 1); return cl - d + wig * (fbm(N1, x * 0.021 + 3, z * 0.021, 3) * 2 - 1) * 1.6; });
  const amp = ({ coast: 6, plain: 2.5, hills: 15, mountains: 44, desert: 5, island: 16, city: 1.2, river: 5, canal: 4, strait: 10, sea: 0, ice: 0 }[kind] ?? 4) * (relief / 0.5);
  let vorF = null; const lanes = []; let s, elev, pass = null, narrowU = g.narrowAt ?? 0, maxElev = amp, trench = null, ground = { kind };
  const cu = (u, a = 10, f = 0.012, k = 0) => a * (N2(u * f + k, 7.3) * 2 - 1);
  const mkLane = (off, dir, cA = 10) => { const pts = []; for (let u = -half - 4; u <= half + 4; u += 6) { const [x, z] = W(u, cu(u, cA) + off); pts.push([x, z]); } return { pts: dir > 0 ? pts : pts.slice().reverse(), dir }; };
  if (kind === "strait") { const Wd = g.width ?? 70, hw = u => Wd / 2 * (1 + 0.9 * smooth(Math.abs(u - narrowU) / 110)); s = (x, z) => { const u = U(x, z); return Math.abs(Vv(x, z) - cu(u, g.meander ?? 10)) - hw(u); };
    lanes.push(mkLane(-Wd * 0.16, 1, g.meander ?? 10), mkLane(Wd * 0.16, -1, g.meander ?? 10)); ground.laneW = Wd * 0.3; ground.hwAt = hw; }
  else if (kind === "ice") { const lw = g.laneW ?? 24, cs = g.plate ?? 32; const vh = (i, j, k) => { let n = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k + seed * 3, 1442695041); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
    vorF = (x, z) => { const px = x / cs, pz = z / cs, ix = Math.floor(px), iz = Math.floor(pz); let f1 = 1e9, f2 = 1e9, id = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const cx = ix + a + vh(ix + a, iz + b, 0) * 0.8 + 0.1, cz = iz + b + vh(ix + a, iz + b, 1) * 0.8 + 0.1, d = Math.hypot(px - cx, pz - cz) * cs; if (d < f1) { f2 = f1; f1 = d; id = vh(ix + a, iz + b, 2); } else if (d < f2) f2 = d; } return { e: (f2 - f1) / 2, id }; };
    s = (x, z) => { const u = U(x, z), lead = Math.abs(Vv(x, z) - cu(u, g.meander ?? 14)) - lw * 0.5 * (0.85 + 0.35 * N3(u * 0.03, 2)); return Math.min(lead, vorF(x, z).e - 1.2); }; lanes.push(mkLane(0, 1, g.meander ?? 14)); ground.laneW = lw * 0.6; }
  else if (kind === "sea") { const isl = []; const ni = g.islets ?? 0, r = rng(seed + 9); for (let i = 0; i < ni; i++) isl.push([(r() - 0.5) * size * 0.8, (r() - 0.5) * size * 0.8, R2(r, 5, 13)]);
    s = (x, z) => { let m = -60; for (const [ix, iz, ir] of isl) m = Math.max(m, ir - Math.hypot(x - ix, z - iz) + 4 * (N1(x * 0.1, z * 0.1) - 0.5)); return m; }; lanes.push(mkLane(0, 1, g.meander ?? 14)); ground.laneW = g.laneW ?? 30; ground.islets = isl; }
  else if (kind === "canal") { const U1 = half * 0.72, cw = g.width ?? 14, dry = g.construction ? (g.dryFrac ?? 0.55) : 0; trench = { cw, dry: dry * U1, U1 };
    s = (x, z) => { const u = U(x, z), v = Vv(x, z), basin = (U1 - Math.abs(u)) + 7 * (N1(v * 0.03, 2) - 0.5) * 2; const wet = Math.abs(u) > dry * U1 ? Math.abs(v - cu(u, 6, 0.02)) - cw / 2 : 99; return Math.min(basin, wet); };
    lanes.push(mkLane(0, 1, 6)); lanes[0].pts = lanes[0].pts.map(([x, z]) => [x, z]); ground.laneW = cw * 0.4; ground.canal = trench; }
  else if (kind === "river") { const rw = g.width ?? 13; s = (x, z) => { const u = U(x, z); return Math.abs(Vv(x, z) - cu(u, g.meander ?? 18, 0.016)) - rw / 2 * (0.8 + 0.5 * N3(u * 0.02, 1)); }; lanes.push(mkLane(0, 1, g.meander ?? 18)); lanes[0].pts = lanes[0].pts.map(([x, z], i, a) => { const u = -half - 4 + i * 6, [qx, qz] = W(u, cu(u, g.meander ?? 18, 0.016)); return [qx, qz]; }); ground.laneW = rw * 0.3; }
  else if (kind === "island") { const R0 = g.radius ?? size * 0.3; s = (x, z) => R0 * (1 + 0.38 * (fbm(N1, x * 0.016 + 5, z * 0.016, 3) * 2 - 1)) - Math.hypot(x, z) * (1 + 0.1 * Math.sin(Math.atan2(z, x) * 3 + seed));
    const sec = (g.islets ?? 2), r = rng(seed + 4), isl = []; for (let i = 0; i < sec; i++) isl.push([(r() - 0.5) * size * 0.8, (r() - 0.5) * size * 0.8, R2(r, 5, 11)]); const s0 = s; s = (x, z) => { let m = s0(x, z); for (const [ix, iz, ir] of isl) m = Math.max(m, ir - Math.hypot(x - ix, z - iz)); return m; }; ground.R0 = R0; }
  else { s = () => 120; if (kind === "mountains" && (g.pass ?? true)) pass = { c: u => cu(u, 24, 0.014), hw: g.passWidth ?? 15 }; }
  if (coastS && !["strait", "sea", "ice", "island", "canal"].includes(kind)) { const s0 = s; s = (x, z) => Math.min(s0(x, z), coastS(x, z)); }
  const nz = (x, z, f, o = 3) => fbm(N1, x * f, z * f, o);
  elev = (x, z, sv) => { let e = 0;
    switch (kind) { case "hills": e = amp * Math.pow(clamp((nz(x, z, 0.017, 4) - 0.28) / 0.45, 0, 1.3), 1.25); break;
      case "mountains": { const r = 1 - Math.abs(2 * fbm(N1, x * 0.009 + 11, z * 0.009, 5) - 1); e = amp * Math.pow(r, 1.7) * (0.6 + fbm(N2, x * 0.02, z * 0.02, 3)) * 1.5; if (pass) { const u = U(x, z), d = Math.abs(Vv(x, z) - pass.c(u)), fac = smooth(d / (pass.hw * 1.7)), vf = 26 * (1 - smooth(Math.abs(u) / (half * 0.55))); e = e * (0.05 + 0.95 * fac) + vf * (1 - fac); } break; }
      case "desert": { const w = (x * 0.8 + z * 0.6) * 0.1 + 3 * nz(x, z, 0.02, 2); e = amp * Math.pow(0.5 + 0.5 * Math.sin(w), 1.6) * (0.35 + 0.65 * N2(x * 0.025, z * 0.025)); break; }
      case "coast": e = amp * clamp(sv / 70, 0, 1) * (0.35 + nz(x, z, 0.02) * 1.2); break;
      case "island": e = amp * smooth(sv / 40) * (0.45 + nz(x, z, 0.03) * 0.9) + amp * 0.7 * smooth(sv / ((g.radius ?? size * 0.3) * 0.9)); break;
      case "strait": e = amp * smooth(sv / 50) * nz(x, z, 0.018) * 1.4; break;
      case "ice": e = vorF ? -0.1 + vorF(x, z).id * 0.38 : 0; break; case "sea": e = 0; break;
      default: e = amp * nz(x, z, 0.02) * smooth(sv / 20); }
    if (trench) { const u = U(x, z), d = Math.abs(Vv(x, z) - cu(u, 6, 0.02)); if (trench.dry > 0 && Math.abs(u) < trench.U1) { const f = smooth(1 - (d - trench.cw / 2 + 2) / 6) * smooth((trench.U1 - Math.abs(u)) / 8) * (Math.abs(u) < trench.dry ? 1 : smooth((trench.dry + 10 - Math.abs(u)) / 10)); e -= 0.95 * f * (d < trench.cw / 2 + 2 ? 1 : 0.5) * (d > trench.cw / 2 + 2 ? smooth(1 - (d - trench.cw / 2 - 2) / 5) : 1); }
      else if (trench.dry > 0) { /* spoil banks */ const bank = smooth(1 - Math.abs(d - trench.cw / 2 - 5) / 4); e += 0.9 * bank * (Math.abs(u) < trench.dry + 12 ? 1 : 0.3); } }
    return e; };
  const front = shoreN ? Math.atan2(shoreN[1], shoreN[0]) / D2R : (["strait", "canal", "river", "sea", "ice"].includes(kind) ? 90 + (g.angle ?? 0) : 90);
  return Object.assign(ground, { vor: vorF, kind, size, half, s, elev, lanes, pass, maxElev, shoreN, amp, front, cu, U, Vv, W, ang, seed, passFn: pass });
}
const R2 = (r, a, b) => a + (b - a) * r();

class Field {
  constructor(G) { this.G = G; this.pads = []; this.cors = []; this.carves = []; }
  s(x, z) { let s = this.G.s(x, z); for (const c of this.carves) s = c(x, z, s); return s; }
  surf(x, z, s) { const t = clamp((s + 0.8) / 2.4, 0, 1); let y = -1.6 + (LAND_H + 1.6) * smooth(t); if (s > 0) y += this.G.elev(x, z, s) * smooth(s / 5); return y; }
  y(x, z) { const s = this.s(x, z); let y = this.surf(x, z, s); if (s > 0.3) { y = this.mod(x, z, y); } return y; }
  mod(x, z, y) { for (const p of this.pads) { const dx = x - p.x, dz = z - p.z; if (dx * dx + dz * dz > p.R2) continue; let d;
      if (p.hw !== undefined) { const lx = dx * p.c + dz * p.sn, lz = -dx * p.sn + dz * p.c, ox = Math.max(0, Math.abs(lx) - p.hw), oz = Math.max(0, Math.abs(lz) - p.hd); d = Math.hypot(ox, oz); } else d = Math.max(0, Math.hypot(dx, dz) - p.r);
      const w = 1 - smooth(d / p.bl); if (w > 0) y += (p.h - y) * w; }
    for (const c of this.cors) { if (x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) continue; let bd = 1e9, by = 0; const P = c.pts, Y = c.ys;
      for (let i = 0; i < P.length - 1; i++) { if (Y[i] !== Y[i] || Y[i + 1] !== Y[i + 1]) continue; const ax = P[i][0], az = P[i][1], bx = P[i + 1][0] - ax, bz = P[i + 1][1] - az, l2 = bx * bx + bz * bz || 1; let u = ((x - ax) * bx + (z - az) * bz) / l2; u = u < 0 ? 0 : u > 1 ? 1 : u;
        const dd = Math.hypot(x - ax - bx * u, z - az - bz * u); if (dd < bd) { bd = dd; by = Y[i] + (Y[i + 1] - Y[i]) * u; } }
      if (bd < c.hw + c.bl) { const w = 1 - smooth((bd - c.hw) / c.bl); y += (by - y) * w; } }
    return y; }
}

// ============================== spatial hash (collision) ==============================
class Occ { constructor() { this.m = new Map(); this.list = []; this.C = 6; }
  key(i, j) { return (i + 600) * 2048 + (j + 600); }
  add(x, z, r, id) { const c = { x, z, r, id }; this.list.push(c); const C = this.C; for (let i = Math.floor((x - r) / C); i <= Math.floor((x + r) / C); i++) for (let j = Math.floor((z - r) / C); j <= Math.floor((z + r) / C); j++) { const k = this.key(i, j); (this.m.get(k) ?? this.m.set(k, []).get(k)).push(c); } return c; }
  hit(x, z, r, gap = 0.5, ign) { const C = this.C; for (let i = Math.floor((x - r - gap) / C); i <= Math.floor((x + r + gap) / C); i++) for (let j = Math.floor((z - r - gap) / C); j <= Math.floor((z + r + gap) / C); j++) { const a = this.m.get(this.key(i, j)); if (!a) continue;
      for (const c of a) { if (ign && ign.has(c.id)) continue; const dx = x - c.x, dz = z - c.z, rr = r + c.r + gap; if (dx * dx + dz * dz < rr * rr) return c; } } return null; } }
const footprint = (it, x, z, h) => { const len = it.len ?? it.r * 2, wid = it.wid ?? it.r * 2; if (len < wid * 1.5) return [[x, z, it.rr ?? it.r]]; const rc = wid / 2 * 1.08 + 0.2, n = clamp(Math.ceil((len - wid) / (rc * 1.3)) + 1, 2, 9), out = [];
  for (let i = 0; i < n; i++) { const o = -(len - 2 * rc) / 2 + i * (len - 2 * rc) / (n - 1); out.push([x + Math.cos(h) * o, z + Math.sin(h) * o, rc]); } return out; };

// ============================== path finding (A*) ==============================
class Heap { constructor() { this.a = []; } push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; } get size() { return this.a.length; } }
function route(F, occ, size, a, b, o = {}) {
  const half = size / 2, cell = o.cell ?? 3.5, n = Math.ceil(size / cell) + 1, sl = o.slope ?? 3, wc = o.water ?? Infinity, hill = o.hill ?? 0, obsC = o.obs ?? 18, ign = o.ignore;
  const hh = new Float32Array(n * n), ws = new Uint8Array(n * n), ob = new Float32Array(n * n); let hmax = 1;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = -half + i * cell, z = -half + j * cell, s = F.s(x, z), y = F.y(x, z); hh[j * n + i] = y; ws[j * n + i] = s < 0.8 ? 1 : 0; hmax = Math.max(hmax, y); }
  for (const c of occ.list) { if (ign && ign.has(c.id)) continue; const r = c.r + 1.2; for (let j = Math.max(0, Math.floor((c.z - r + half) / cell)); j <= Math.min(n - 1, Math.ceil((c.z + r + half) / cell)); j++) for (let i = Math.max(0, Math.floor((c.x - r + half) / cell)); i <= Math.min(n - 1, Math.ceil((c.x + r + half) / cell)); i++) if (Math.hypot(-half + i * cell - c.x, -half + j * cell - c.z) < r) ob[j * n + i] = obsC; }
  const idx = (x, z) => [clamp(Math.round((x + half) / cell), 0, n - 1), clamp(Math.round((z + half) / cell), 0, n - 1)], [si, sj] = idx(a[0], a[1]), [ei, ej] = idx(b[0], b[1]);
  const G = new Float32Array(n * n).fill(1e9), prev = new Int32Array(n * n).fill(-1), closed = new Uint8Array(n * n), H = new Heap(); G[sj * n + si] = 0; H.push(0, sj * n + si);
  while (H.size) { const [, cur] = H.pop(); if (closed[cur]) continue; closed[cur] = 1; const ci = cur % n, cj = (cur / n) | 0; if (ci === ei && cj === ej) break;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue; const k = nj * n + ni; if (closed[k]) continue; if (ws[k] && wc === Infinity && !(Math.abs(ni - ei) <= 1 && Math.abs(nj - ej) <= 1)) continue;
      const st = Math.hypot(di, dj) * cell, c = st * (1 + sl * Math.abs(hh[k] - hh[cur]) / st * 4 + (ws[k] ? wc : 0) + ob[k] / 3 + hill * (1 - hh[k] / hmax)) + ob[k]; const g = G[cur] + c; if (g < G[k]) { G[k] = g; prev[k] = cur; H.push(g + Math.hypot(ni - ei, nj - ej) * cell, k); } } }
  if (prev[ej * n + ei] < 0 && !(si === ei && sj === ej)) { let vis = 0; for (let q = 0; q < n * n; q++) vis += closed[q]; if (false) console.log('ROUTE FAIL', si, sj, ei, ej, 'n', n, 'visited', vis, 'startWater', ws[sj * n + si], 'endWater', ws[ej * n + ei]); return null; }
  let pts = []; for (let k = ej * n + ei; k >= 0; k = prev[k]) pts.push([-half + (k % n) * cell, -half + ((k / n) | 0) * cell]); pts.reverse(); pts[0] = a.slice(); pts[pts.length - 1] = b.slice();
  for (let it = 0; it < 3; it++) { const q = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i], p1 = pts[i + 1]; q.push([p0[0] * 0.75 + p1[0] * 0.25, p0[1] * 0.75 + p1[1] * 0.25], [p0[0] * 0.25 + p1[0] * 0.75, p0[1] * 0.25 + p1[1] * 0.75]); } q.push(pts[pts.length - 1]); pts = q; }
  return resample(pts, o.step ?? 2.5); }
function resample(pts, step) { const out = [pts[0]]; let acc = 0; for (let i = 1; i < pts.length; i++) { let [x0, z0] = pts[i - 1]; const [x1, z1] = pts[i]; let l = Math.hypot(x1 - x0, z1 - z0); while (acc + l >= step) { const u = (step - acc) / l; x0 += (x1 - x0) * u; z0 += (z1 - z0) * u; out.push([x0, z0]); l = Math.hypot(x1 - x0, z1 - z0); acc = 0; } acc += l; } out.push(pts[pts.length - 1]); return out; }
const pathLen = pts => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; };
function pathAt(pts, cum, s, loop = true) { const L = cum[cum.length - 1]; if (loop) s = ((s % L) + L) % L; else s = clamp(s, 0, L); let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const u = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]), x = pts[lo][0] + (pts[hi][0] - pts[lo][0]) * u, z = pts[lo][1] + (pts[hi][1] - pts[lo][1]) * u; return { x, z, a: Math.atan2(pts[hi][1] - pts[lo][1], pts[hi][0] - pts[lo][0]), i: lo + u }; }

// ============================== buildSet ==============================
export function buildSet(spec, ctx) {
  const t0 = performance.now(), { M, KM, KMR } = ctx, mk = MK(M, KM), fmap = FOCUSMAP(M, KM, KMR), warns = [];
  const g = spec.ground ?? {}, G = makeGround(g), F = new Field(G), size = G.size, half = G.half, seedBase = hashStr(spec.id ?? "set") ^ Math.imul(g.seed ?? 1, 7919), rnd = rng(seedBase), occ = new Occ();
  const kind = G.kind, gridA = (G.ang) + rnd() * 0.0, group = new THREE.Group(); group.name = spec.id ?? "set";
  const SUBJ = {}, NAMES = {}, items = [], anims = [], proxies = [], smokes = [], lanesUsed = {}; let focusObj = null, idc = 0;
  const E = s => ({ M, KM, KMR, MK: mk, rnd: rng(s) });
  const key2m = new Map([[M.WHITE, "w"], [KM.grey, "g"], [KM.dark, "d"], [M.SAND, "s"], [M.GREY, "l"], [M.DARK, "k"]]);
  const addSubj = (name, o, rec) => { (SUBJ[name] ??= []).push(o); (NAMES[name.toLowerCase()] ??= []).push(rec); };
  const warn = m => { warns.push(m); };
  const bake = (b, grp, x = 0, y = 0, z = 0, ry = 0, s = 1) => { grp.updateMatrixWorld(true); const m0 = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V(s, s, s));
    grp.traverse(m => { if (!m.isMesh) return; const k = key2m.get(m.material); if (!k) return; const gg = m.geometry.clone(); gg.applyMatrix4(new THREE.Matrix4().multiplyMatrices(m0, m.matrixWorld)); (b.g[k] ??= []).push(gg.index ? gg.toNonIndexed() : gg); }); };
  const gradS = (x, z) => { const e = 0.8; return [(F.s(x + e, z) - F.s(x - e, z)) / (2 * e), (F.s(x, z + e) - F.s(x, z - e)) / (2 * e)]; };
  const inB = (x, z, m = 4) => Math.abs(x) < half - m && Math.abs(z) < half - m;

  // ---------- occupancy helpers ----------
  const hitFp = (it, x, z, h, gap = 0.5, ign) => { for (const [cx, cz, cr] of footprint(it, x, z, h)) { if (!inB(cx, cz, cr * 0.5)) return { edge: true }; const c = occ.hit(cx, cz, cr, gap, ign); if (c) return c; } return null; };
  const landOK = (it, x, z, h) => { const r = it.r, pts = [[0, 0]]; const L = (it.len ?? 2 * r) / 2 * 0.9, Wd = (it.wid ?? 2 * r) / 2 * 0.9; for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) pts.push([a * Math.min(L, r), b * Math.min(Wd, r)]);
    let mn = 1e9, mx = -1e9; const c = Math.cos(h), sn = Math.sin(h); for (const [a, b] of pts) { const px = x + a * c - b * sn, pz = z + a * sn + b * c, s = F.s(px, pz); if (s < (it.shoreOK ? 0.6 : 1.4)) return false; const y = F.y(px, pz); mn = Math.min(mn, y); mx = Math.max(mx, y); }
    return it.pad ? (mx - mn) <= 0.45 * r + 1.6 : (mx - mn) <= 0.9 * r + 1.0; };
  const waterOK = (it, x, z, h) => { const L = (it.len ?? 2 * it.r) / 2, hw = (it.hw ?? it.r * 0.3), c = Math.cos(h), sn = Math.sin(h); for (const [a, b] of [[0, 0], [L, 0], [-L, 0], [0, hw], [0, -hw]]) { if (F.s(x + a * c - b * sn, z + a * sn + b * c) > -(it.shoreOK ? 0.4 : 1.0)) return false; } return F.s(x, z) < -(hw + 0.6); };

  // ---------- shore finding ----------
  function shorePoints(count, test, tries = 900) { const out = []; for (let k = 0; k < tries && out.length < count; k++) { let x = (rnd() - 0.5) * (size - 20), z = (rnd() - 0.5) * (size - 20), s = F.s(x, z); if (Math.abs(s) > 40) continue;
      for (let it = 0; it < 8; it++) { const [gx, gz] = gradS(x, z), gl = Math.hypot(gx, gz); if (gl < 1e-3) break; x -= gx / gl * s / Math.max(0.6, gl); z -= gz / gl * s / Math.max(0.6, gl); s = F.s(x, z); } if (Math.abs(s) > 0.6) continue;
      const [gx, gz] = gradS(x, z), gl = Math.hypot(gx, gz); if (gl < 0.3) continue; const nw = [-gx / gl, -gz / gl]; const r = test(x, z, nw); if (r) out.push({ x, z, nw, ...r }); } return out; }

  // ---------- subject registration ----------
  function makeProxy(it, dyn) { const g2 = it.g; g2.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(g2), sz = bb.getSize(V(0, 0, 0)), c = bb.getCenter(V(0, 0, 0)); if (sz.y < 1.0 && Math.max(sz.x, sz.z) < 2.5) return null; const sc = g2.scale.x || 1;
    const inv = new THREE.Matrix4().copy(g2.matrixWorld).invert(), lc = c.clone().applyMatrix4(inv); const m = new THREE.Mesh(new THREE.BoxGeometry(sz.x / sc, sz.y / sc, sz.z / sc)); m.visible = false; m.position.copy(lc); g2.add(m);
    // sz is world-aligned extent; for rotated items it over-covers slightly (proxies only restrict the camera) -> use local bbox instead when rotated
    const hs = V(sz.x / sc / 2 + 0.5 / sc, sz.y / sc / 2 + 0.5 / sc, sz.z / sc / 2 + 0.5 / sc); proxies.push({ mesh: m, hs, dyn: !!dyn }); ctx.proxy?.(m, spec.id, hs, dyn); return m; }
  function commit(e, it, pose, name) {
    const x = pose.x, z = pose.z, h = pose.h ?? 0; let y;
    if (it.dom === "water") y = pose.y ?? -(it.draft ?? 0.4);
    else if (pose.y !== undefined) y = pose.y;
    else if (it.pad && !pose.noPad) { y = Math.max(F.y(x, z), LAND_H); const rect = it.ang90 && it.len;
      if (rect) { const hw = it.len / 2 + 0.8, hd = (it.wid ?? it.len) / 2 + 0.8; F.pads.push({ x, z, c: Math.cos(h), sn: Math.sin(h), hw, hd, h: y, bl: Math.max(2.5, Math.min(hw, hd) * 0.4), R2: (Math.hypot(hw, hd) + Math.max(2.5, Math.min(hw, hd) * 0.4)) ** 2 }); }
      else F.pads.push({ x, z, r: it.r + 0.4, h: y, bl: Math.max(2.5, it.r * 0.5), R2: (it.r + 0.4 + Math.max(2.5, it.r * 0.5)) ** 2 }); }
    else { let my = -1e9; for (const [cx, cz] of footprint(it, x, z, h)) my = Math.max(my, F.y(cx, cz)); y = Math.max(my, it.dom === "any" ? -0.3 : LAND_H * 0.9) - (it.sink ?? 0.04); if (it.dom === "land" && F.s(x, z) < 0.8) y = Math.max(y, LAND_H); }
    it.g.position.set(x, y, z); it.g.rotation.y = it.fw === "z" ? Math.PI / 2 - h : -h; it.g.updateMatrixWorld(true);
    if (it.kind !== "people" || true) for (const [cx, cz, cr] of footprint(it, x, z, h)) occ.add(cx, cz, cr * (it.pad ? 1.15 : 1), "i" + (++idc));
    group.add(it.g); const rec = { name, what: e.what, obj: it.g, x, z, y, h, r: it.r, it, e }; items.push(rec); addSubj(name, it.g, rec); it.g.userData.set = { name, what: e.what, r: it.r };
    if (it.anim) anims.push(t => it.anim(t)); if (it.dom === "water") { const v = { it, g: it.g, y0: y, h0: h, ph: rnd() * 6.28, bob: it.bobby ?? 1, lane: pose.lane, s0: pose.s0, spd: pose.speed ?? e.speed ?? 0, off: pose.off ?? 0 }; rec.ves = v; anims.push(t => animVessel(v, t)); if (v.spd >= 0.6) addWake(it); }
    if (it.smoke && ctx && (G.smoke !== false)) for (const p of it.smoke) smokes.push({ pos: it.g.localToWorld(p.clone()), sc: it.smokeScale ?? 1, ph: rnd(), obj: it.g, local: p, ves: it.dom === "water" ? rec : null });
    if (["radarMast", "flareStack", "gantryCrane", "watchtower"].includes(e.what)) { const sc = it.g.scale.x || 1, lm = new THREE.Mesh(new THREE.SphereGeometry(0.17 / sc, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff6dd, emissive: 0xfff2cc, emissiveIntensity: 1 })); lm.position.set(0, it.h / sc, 0); lm.userData.noFocus = true; it.g.add(lm); const ph = rnd() * 6; anims.push(t => { lm.material.emissiveIntensity = Math.sin(t * 2.2 + ph) > 0.55 ? 1.6 : 0.15; }); }
    makeProxy(it, it.dom === "water"); if (e.focus && !focusObj) { focusObj = rec; } return rec; }
  function addWake(it) { const L = it.len, wg = new THREE.BufferGeometry(); const hw = (it.hw ?? it.r * 0.3) / L, pos = [-0.5, 0, 0, -0.85, 0, -hw * 2.0, -0.85, 0, hw * 2.0, -0.5, 0, hw * 0.9, -0.5, 0, -hw * 0.9]; wg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); wg.setIndex([0, 2, 1, 3, 2, 0, 4, 0, 1]); wg.computeVertexNormals();
    const wm = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false })); wm.position.y = (it.draft / L) + 0.01; wm.renderOrder = 2; it.g.add(wm); }
  function animVessel(v, t) { const o = v.g; let { y0 } = v; const b = 0.05 * v.bob;
    if (v.lane) { const p = pathAt(v.lane.pts, v.lane.cum, v.s0 + v.spd * t); const nx = -Math.sin(p.a) * v.off, nz = Math.cos(p.a) * v.off; o.position.x = p.x + nx; o.position.z = p.z + nz; o.rotation.y = -p.a; }
    else if (v.spd) { o.position.x += 0; }
    o.position.y = y0 + Math.sin(t * 0.9 + v.ph) * b; o.rotation.x = Math.sin(t * 0.7 + v.ph) * 0.012 * v.bob; o.rotation.z = Math.sin(t * 0.6 + v.ph * 2) * 0.012 * v.bob; }

  // ---------- where-resolution ----------
  const SPECIALTOK = new Set(["road", "rail", "lane", "river", "canal", "channel", "strait", "pass", "valley"]);
  function analyze(w) { const toks = String(w ?? "").toLowerCase().replace(/[^a-z0-9_: ]/g, " ").split(/\s+/).filter(Boolean), W = { toks, has: t => toks.includes(t), ref: null, refName: null };
    for (const t of toks) if (NAMES[t]) { W.ref = NAMES[t]; W.refName = t; break; } return W; }
  const pathOf = rec => rec.pathInfo;
  function poseOnPath(it, P, e, W, k, n) {   // P: {pts, cum, ys, w} ; vehicles ride, others stand alongside
    const L = P.cum[P.cum.length - 1];
    for (let tries = 0; tries < 300; tries++) { const u = e.t !== undefined ? clamp(e.t + (k - (n - 1) / 2) * (e.spread ?? 0.0), 0.02, 0.98) * L : (0.06 + 0.88 * rnd()) * L, p = pathAt(P.pts, P.cum, u, false); let off = 0, h = p.a;
      if (it.kind === "vehicle" || it.kind === "train") { off = (rnd() < 0.5 ? -1 : 1) * (P.w ?? 3) * 0.2; if (off < 0) h += Math.PI; if (it.kind === "train") off = 0; if (e.formation === "queue" || W.has("queue")) { const u2 = ((e.start ?? 0.1) * L + k * (it.len * 1.25 + 0.6)); const q = pathAt(P.pts, P.cum, u2, false); off = (P.w ?? 3) * 0.2; return fin({ x: q.x - Math.sin(q.a) * off, z: q.z + Math.cos(q.a) * off, h: q.a, y: P.yAt(q.i) + 0.06, path: P, pu: u2, off }); } }
      else off = (rnd() < 0.5 ? -1 : 1) * (((P.w ?? 3) / 2) + it.r * (it.fw === "z" ? 0.8 : 0.8) + 0.5 + (e.gap ?? rnd() * 3));
      const x = p.x - Math.sin(p.a) * off, z = p.z + Math.cos(p.a) * off, ps = { x, z, h: it.kind === "vehicle" || it.kind === "train" ? h : p.a + (off > 0 ? Math.PI : 0) * 0 + (it.ang90 ? 0 : 0), path: P, pu: u, off };
      if (it.kind === "vehicle" || it.kind === "train") ps.y = P.yAt(p.i) + 0.06; const f = fin(ps); if (f) return f; } return null;
    function fin(ps) { if (it.kind !== "vehicle" && it.kind !== "train") { if (!landOK(it, ps.x, ps.z, ps.h) && !it.pathOK) return null; } if (hitFp(it, ps.x, ps.z, ps.h, 0.3, new Set(P.ownIds))) return null; return ps; } }
  function poseFromAnchor(it, ref, e, W, k, n) {
    const R0 = ref[Math.min(k % ref.length, ref.length - 1)], A = R0.anchors;
    if (it.dom === "water" && A?.berth) return A.berth(it);
    if (A?.deck && it.dom !== "water") { for (let tries = 0; tries < 60; tries++) { const p = A.deck(it, k, n); if (!p) break; if (!hitFp(it, p.x, p.z, p.h ?? 0, 0.15, A.ownIds ? new Set(A.ownIds) : undefined)) return p; } }
    if (A?.path && it.dom !== "water") return poseOnPath(it, A.path, e, W, k, n);
    if (A?.behind && !W.has("near")) { for (let tries = 0; tries < 200; tries++) { const p = A.behind(it, k, n, rnd); if (p && landOK(it, p.x, p.z, p.h) && !hitFp(it, p.x, p.z, p.h, 0.8, new Set(A.ownIds ?? []))) return p; } }
    // ring around the referenced subject
    for (let tries = 0; tries < 500; tries++) { const a = rnd() * 6.283, d = R0.r + it.r + 0.8 + rnd() * (e.gap ?? 14) * (1 + tries / 200), x = R0.x + Math.cos(a) * d, z = R0.z + Math.sin(a) * d, h = it.ang90 ? gridA + Math.floor(rnd() * 4) * Math.PI / 2 : rnd() * 6.28;
      if (it.dom === "water" ? waterOK(it, x, z, h) : landOK(it, x, z, h)) if (!hitFp(it, x, z, h, 0.8)) return { x, z, h }; } return null; }
  function poseInLane(it, e, W, k, n) { const lanes = G.lanes; if (!lanes.length) return null; const li = e.lane !== undefined ? e.lane : (W.has("west") || W.has("outbound") ? 1 : W.has("east") || W.has("inbound") ? 0 : 0), lane = lanes[Math.min(lanes.length - 1, li)];
    const cum = lane.cum ??= pathLen(lane.pts), Lp = cum[cum.length - 1], form = e.formation ?? (W.has("queue") ? "queue" : n > 1 ? "scatter" : "single");
    const Lobj = { pts: lane.pts, cum };
    for (let tries = 0; tries < 300; tries++) { let s, off; if (form === "queue" || form === "convoy") { const sp = it.len * (form === "queue" ? 1.32 : 1.9), s0 = (e.start ?? 0.12) * Lp; s = s0 + k * sp + (e.dir === -1 ? 0 : 0); off = (k % 2 ? 1 : -1) * (e.jitter ?? 0.5) * (form === "queue" ? 0.7 : 1.2) * (1 + (tries > 40 ? tries / 60 : 0)); }
      else { s = (0.1 + 0.8 * rnd()) * Lp; off = (rnd() - 0.5) * G.laneW * 0.8; }
      const p = pathAt(lane.pts, cum, s, false), x = p.x - Math.sin(p.a) * off, z = p.z + Math.cos(p.a) * off, hd = p.a; const lanePose = { x, z, h: hd, lane: Lobj, s0: s, off, speed: e.speed ?? (e.moving === false ? 0 : (form === "queue" ? 0.3 : 0.9)) * (lane.dir > 0 ? 1 : 1) };
      if (!waterOK(it, x, z, hd)) continue; if (hitFp(it, x, z, hd, 0.5)) continue; if (lane.dir < 0 && false) lanePose.h += Math.PI; return lanePose; } return null; }
  function regionPose(it, e, W, k, n) {
    const water = it.dom === "water", S = [], r = it.r, h0 = () => it.ang90 || it.pad ? gridA + Math.floor(rnd() * 4) * Math.PI / 2 : rnd() * 6.28; let hdef = null;
    const has = W.has, ref = W.ref ? W.ref[0] : null; let sumit = null;
    if (has("shore") || has("coast") || has("waterfront") || has("beach")) S.push((x, z, s) => water ? (-s > r * 0.6 + 1.5 && -s < r * 0.6 + 26) : (s > r * 0.7 + 1.2 && s < r * 0.7 + 8 + (e.band ?? 0)));
    if (has("anchorage")) S.push((x, z, s) => -s > 10 && -s < 60);
    if (has("offshore") || has("open")) S.push((x, z, s) => -s > 30);
    if (has("inland")) S.push((x, z, s) => s > (e.inlandMin ?? Math.max(24, size * 0.14)));
    if (has("hills") || has("hill") || has("highland")) S.push((x, z, s) => F.y(x, z) > LAND_H + G.maxElev * 0.38);
    if (has("slopes")) S.push((x, z, s) => F.y(x, z) > LAND_H + G.maxElev * 0.12 && F.y(x, z) < LAND_H + G.maxElev * 0.55);
    if (has("plain") || has("flat") || has("lowland")) S.push((x, z, s) => F.y(x, z) < LAND_H + 1.5);
    if (has("center") || has("centre")) S.push((x, z) => Math.hypot(x, z) < half * 0.32);
    if (has("edge") || has("outskirts")) S.push((x, z) => Math.hypot(x, z) > half * 0.5);
    if (has("near") && ref) { const R0 = ref; S.push((x, z) => { const d = Math.hypot(x - R0.x, z - R0.z); return d > R0.r + r && d < R0.r + r + (e.gap ?? 22); }); }
    if (has("summit") || has("peak")) { if (!G._summit) { let bx = 0, bz = 0, by = -9; for (let k2 = 0; k2 < 3000; k2++) { const x = (rnd() - 0.5) * size * 0.8, z = (rnd() - 0.5) * size * 0.8, y = F.y(x, z); if (y > by && F.s(x, z) > 6) { by = y; bx = x; bz = z; } } G._summit = [bx, bz]; } sumit = G._summit; }
    for (let tries = 0; tries < 900; tries++) { const relax = tries > 500; let x, z; if (sumit) { const d = rnd() * (6 + tries * 0.05), a = rnd() * 6.28; x = sumit[0] + Math.cos(a) * d; z = sumit[1] + Math.sin(a) * d; } else { x = (rnd() - 0.5) * (size - 12); z = (rnd() - 0.5) * (size - 12); }
      const s = F.s(x, z); if (water ? s > -1 : s < 1) continue; let ok = true; if (!relax) for (const f of S) if (!f(x, z, s)) { ok = false; break; } if (!ok) continue;
      let h = hdef ?? h0(); if (water) { const gr = gradS(x, z); h = Math.atan2(gr[1], gr[0]) + Math.PI / 2 + (rnd() < 0.5 ? 0 : Math.PI); if (e.heading !== undefined) h = e.heading * D2R; }
      else if (has("shore") && it.kind === "building") { const gr = gradS(x, z); h = Math.round((Math.atan2(gr[1], gr[0]) - gridA) / (Math.PI / 2)) * Math.PI / 2 + gridA; }
      if (e.heading !== undefined) h = e.heading * D2R;
      if (water ? !waterOK(it, x, z, h) : !landOK(it, x, z, h)) continue; if (hitFp(it, x, z, h, it.pad ? 1.0 : 0.5)) continue; return { x, z, h }; } return null; }
  function findPose(e, it, k, n, W) {
    if (e.at) { const p = { x: e.at[0], z: e.at[1], h: (e.heading ?? 0) * D2R }; return p; }
    const pathTok = W.has("road") ? SUBJ_PATH.road : W.has("rail") ? SUBJ_PATH.rail : null; if (pathTok && it.dom !== "water") { const p = poseOnPath(it, pathTok, e, W, k, n); if (p) return p; warn(e.what + ": road/rail not found, region fallback"); }
    if (it.dom === "water" && (W.has("lane") || W.has("queue") || W.has("strait") || W.has("channel") || W.has("canal") || W.has("river"))) { const p = poseInLane(it, e, W, k, n); if (p) return p; }
    if (W.ref) { const p = poseFromAnchor(it, W.ref, e, W, k, n); if (p) return p; warn(e.what + ": no free slot at " + W.refName + ", region fallback"); }
    return regionPose(it, e, W, k, n); }
  const SUBJ_PATH = {};

  // ============================== place entries ==============================
  const entries = (spec.place ?? []).map((e, i) => ({ ...e, _i: i })); entries.sort((a, b) => ((PRI[a.what] ?? 25) - (PRI[b.what] ?? 25)) || (a._i - b._i));
  const specials = {};
  const nameOf = e => e.name ?? e.what;
  function getEndpoint(ref, otherPt, allowIn) {
    if (Array.isArray(ref)) return ref; if (typeof ref === "string") {
      const m = ref.match(/^edge:(\w+)$/); if (m) { const d = SHORE_DIR[m[1]]; const dir = d ?? [0, 1]; for (let tries = 0; tries < 400; tries++) { const t = (rnd() - 0.5) * size * 0.7, x = dir[0] ? dir[0] * (half - 5) : t, z = dir[1] ? dir[1] * (half - 5) : t; if (F.s(x, z) > 6 && inB(x, z, 2)) return [x, z]; } }
      if (ref === "inland" || ref === "far") { let best = null, bs = -1e9; for (let k = 0; k < 600; k++) { const x = (rnd() - 0.5) * (size - 20), z = (rnd() - 0.5) * (size - 20), s = F.s(x, z); if (s < 14) continue; const d = otherPt ? Math.hypot(x - otherPt[0], z - otherPt[1]) : 0, sc = d + (e_overHills ? F.y(x, z) * 2.2 : 0); if (sc > bs && !occ.hit(x, z, 3, 1)) { bs = sc; best = [x, z]; } } return best; }
      if (ref === "center") return [0, 0]; const rs = NAMES[ref.toLowerCase()]; if (rs) { const r0 = rs[0]; if (r0.anchors?.root) return r0.anchors.root; return [r0.x, r0.z]; } } return null; }
  let e_overHills = false;
  const ownIdsFor = refs => { const ids = []; for (const r of refs) { const rs = typeof r === "string" ? NAMES[r.toLowerCase()] : null; if (rs) for (const q of rs) for (const c of occ.list) if (Math.hypot(c.x - q.x, c.z - q.z) < q.r + 4) ids.push(c.id); } return new Set(ids); };
  function registerPath(name, pts, ys, w, bridges, e, kind) { const cum = pathLen(pts), P = { pts, cum, ys, w, bridges, ownIds: [], yAt: i => { const a = Math.max(0, Math.min(ys.length - 1, Math.floor(i))), b2 = Math.min(ys.length - 1, a + 1), u = i - a; const ya = ys[a] === ys[a] ? ys[a] : 1, yb = ys[b2] === ys[b2] ? ys[b2] : 1; return ya + (yb - ya) * u; } };
    for (let i = 0; i < pts.length; i += 1) if (!bridges[i]) P.ownIds.push(occ.add(pts[i][0], pts[i][1], w / 2 + 0.4, "p" + name + i).id); if (!e.auto) SUBJ_PATH[kind] = P; return P; }
  function buildLinear(e, kind) {   // road / rail
    const A = getEndpoint(e.from ?? "edge:west", null), B = getEndpoint(e.to ?? "edge:east", A); if (!A || !B) { warn(kind + ": endpoints unresolved"); return; }
    const ign = ownIdsFor([e.from, e.to].filter(x => typeof x === "string")); const w = e.width ?? (kind === "road" ? 3.2 : 1.5);
    let pts = route(F, occ, size, A, B, { slope: kind === "rail" ? 6 : 3.2, water: e.bridge === false ? Infinity : (kind === "rail" ? 9 : 5), ignore: ign, hill: e.hill ?? 0, step: 2.4 }); if (!pts) { warn(kind + ": no route"); return; }
    const raw = pts.map(p => F.y(p[0], p[1])), bridges = pts.map(p => F.s(p[0], p[1]) < 0.9), yb = bridges.slice(); for (let i = 0; i < pts.length; i++) if (bridges[i]) for (let d = -3; d <= 3; d++) if (pts[i + d]) yb[i + d] = true;
    let ys = raw.map((y, i) => yb[i] ? NaN : Math.max(y, LAND_H)); // smooth land heights along the path, interpolate across bridges
    const sm = ys.slice(); for (let it = 0; it < 5; it++) for (let i = 1; i < ys.length - 1; i++) { const a = sm[i - 1], b = sm[i + 1], c = sm[i]; if (a === a && b === b && c === c) sm[i] = c * 0.5 + (a + b) * 0.25; } ys = sm;
    for (let i = 0; i < ys.length; i++) if (ys[i] !== ys[i]) { let a = i, b = i; while (a >= 0 && ys[a] !== ys[a]) a--; while (b < ys.length && ys[b] !== ys[b]) b++; const ya = a >= 0 ? ys[a] : ys[b], yb2 = b < ys.length ? ys[b] : ys[a], u = (i - a) / Math.max(1, b - a); ys[i] = (ya + (yb2 - ya) * u) + (kind === "road" ? 0.9 : 0.6) * Math.sin(Math.PI * clamp(u, 0, 1)); ys[i] = { v: ys[i] }.v; yb[i] = true; }
    const corYs = ys.map((y, i) => yb[i] ? NaN : y); F.cors.push({ pts, ys: corYs, hw: w / 2 + 0.5, bl: 4.5, x0: Math.min(...pts.map(p => p[0])) - 12, x1: Math.max(...pts.map(p => p[0])) + 12, z0: Math.min(...pts.map(p => p[1])) - 12, z1: Math.max(...pts.map(p => p[1])) + 12 });
    pending.push(() => { const b = new Builder(); const P = SUBJ_PATH[kind] ?? null; if (kind === "road") roadBuild(b, pts, ys.map((y, i) => y), w, yb); else railBuild(b, pts, ys); const grp = b.group(mk); grp.name = kind; group.add(grp); });
    const P = registerPath(nameOf(e), pts, ys, w, yb, e, kind); const rec = { name: nameOf(e), what: kind, obj: null, x: pts[Math.floor(pts.length / 2)][0], z: pts[Math.floor(pts.length / 2)][1], r: 3, anchors: { path: P } };
    const holder = { name: nameOf(e), rec }; roadsRec.push({ e, kind, pts, ys, w, yb, rec });
    return rec; }
  const pending = [], roadsRec = [], post = [];

  const doQuay = e => { const L = e.len ?? 90, D = 7, K = 5; let best = null;
    const cands = shorePoints(K, (x, z, nw) => { if (!inB(x, z, L / 2 + 14) ) return null; const t = [-nw[1], nw[0]]; let okc = 1; for (const tt of [-L / 2, L / 2]) { const px = x + t[0] * tt, pz = z + t[1] * tt; if (!inB(px, pz, 10)) return null; }
      for (const tt of [-L / 2, -L / 4, 0, L / 4, L / 2]) { const px = x + t[0] * tt, pz = z + t[1] * tt; if (occ.hit(px, pz, 6, 1) || occ.hit(px + nw[0] * 8, pz + nw[1] * 8, 6, 1) || occ.hit(px - nw[0] * 8, pz - nw[1] * 8, 6, 1)) return null; }
      return { score: rnd() }; }, 1200);
    if (!cands.length) { warn("quay: no shore"); return; } const c = cands.sort((a, b) => a.score - b.score)[0], nw = c.nw, tv = [-nw[1], nw[0]], C = { x: c.x, z: c.z };
    F.carves.push((x, z, s) => { const dx = x - C.x, dz = z - C.z, nn = dx * nw[0] + dz * nw[1], tt = dx * tv[0] + dz * tv[1], w = (1 - smooth((Math.abs(tt) - L / 2) / 9)) * (1 - smooth((Math.abs(nn) - 14) / 10)); return w > 0 ? s + (-nn - s) * w : s; });
    F.pads.push({ x: C.x - nw[0] * 7, z: C.z - nw[1] * 7, c: Math.cos(Math.atan2(tv[1], tv[0])), sn: Math.sin(Math.atan2(tv[1], tv[0])), hw: L / 2 + 5, hd: 9, h: LAND_H, bl: 5, R2: (L / 2 + 5 + 9 + 5) ** 2 });
    const b = new Builder(), top = LAND_H + 0.14, ctr = V(C.x - nw[0] * 0.5, 0, C.z - nw[1] * 0.5), h = Math.atan2(tv[1], tv[0]);
    const lb = new Builder(); lb.box("l", L, top + 1.2, D, 0, -1.2, 0); lb.box("w", L, 0.06, 0.3, 0, top, D / 2 - 0.2); lb.box("d", L, 1.0, 0.1, 0, -0.2, D / 2 + 0.03); lb.box("g", L, 0.1, 0.12, 0, top, -D / 2 + 0.3);
    for (let i = 0; i <= L / 5; i++) { const x = -L / 2 + i * 5 + 1; lb.cyl("d", 0.18, 0.18, 1.1, x, -0.4, D / 2 + 0.22, 8); } for (let i = 0; i <= L / 6; i++) { const x = -L / 2 + 3 + i * 6; lb.cyl("g", 0.16, 0.2, 0.28, x, top, D / 2 - 0.55, 8); }
    for (const zz of [0.0, 2.5]) lb.box("d", L - 2, 0.04, 0.12, 0, top, zz - 0.0 + 0.3);
    for (let i = 0; i < L / 15; i++) { const x = -L / 2 + 6 + i * 14; lb.cyl("g", 0.05, 0.05, 2.4, x, top, -1.2, 6); lb.box("w", 0.45, 0.1, 0.25, x + 0.15, top + 2.4, -1.2); }
    const grp = lb.group(mk); grp.position.set(ctr.x, 0, ctr.z); grp.rotation.y = -h; group.add(grp);
    for (let i = -Math.floor(L / 8); i <= Math.floor(L / 8); i++) occ.add(C.x + tv[0] * i * 8, C.z + tv[1] * i * 8, 4.6, "q" + idc++);
    const used = []; const rec = { name: nameOf(e), what: "quay", obj: grp, x: ctr.x, z: ctr.z, r: L / 2, anchors: {}, quay: { C, nw, tv, L } }; rec.anchors.root = [C.x - nw[0] * 6, C.z - nw[1] * 6];
    rec.anchors.berth = it => { const hwid = it.hw ?? it.wid / 2, off = D / 2 - 0.5 + 0.9 + hwid + 0.15, len = it.len; let start = -L / 2 + 2 + (e.berthOffset ?? 0); const sorted = used.slice().sort((a, b) => a[0] - b[0]);
      for (const [a, b2] of sorted) if (start + len > a - 1.2 && start < b2 + 1.2) start = b2 + 1.2; if (start + len > L / 2 + len * 0.15) return null; used.push([start, start + len]); const tt = start + len / 2, X = ctr.x + nw[0] * off + tv[0] * tt, Z = ctr.z + nw[1] * off + tv[1] * tt; return { x: X, z: Z, h: h + (e.flip ? Math.PI : 0), berthed: true, y: undefined }; };
    const cr = []; rec.anchors.deck = (it, k, n) => { const pick = it.fw === "z"; if (pick) { const sp = Math.max(it.scale * 1.8, (L - 10) / Math.max(n, 1)), t0 = -L / 2 + 8 + (cr.length) * sp; if (t0 > L / 2 - 4) return null; cr.push(t0); return { x: ctr.x + nw[0] * 0.2 + tv[0] * t0, z: ctr.z + nw[1] * 0.2 + tv[1] * t0, h: Math.atan2(nw[1], nw[0]), y: top, noPad: true }; }
      const tt = (rnd() - 0.5) * (L - 8), nn = D / 2 - 1.0 - rnd() * 2.0; return { x: ctr.x + nw[0] * nn + tv[0] * tt, z: ctr.z + nw[1] * nn + tv[1] * tt, h: rnd() * 6.28, y: top, noPad: true }; };
    rec.anchors.behind = (it, k, n, r) => { const tt = (r() - 0.5) * (L - it.r), nn = D / 2 + 3 + it.r + r() * 20; return { x: ctr.x - nw[0] * nn + tv[0] * tt, z: ctr.z - nw[1] * nn + tv[1] * tt, h: h + (it.ang90 ? 0 : 0) + (r() < 0.5 ? 0 : Math.PI) }; };
    rec.anchors.ownIds = []; addSubj(rec.name, grp, rec); items.push(rec); if (e.focus) focusObj = rec; return rec; };
  const doJetty = e => { const Ljet = e.len ?? 42, wd = e.width ?? 4.2, head = e.head ?? (e.what === "pier" ? 0 : 16), tail = head ? 6 : 0; let ref = null; const W = analyze(e.where); const rc = W.ref ? W.ref[0] : null;
    const cands = shorePoints(18, (x, z, nw) => { if (!inB(x + nw[0] * Ljet, z + nw[1] * Ljet, 12)) return null; for (let d = 4; d <= Ljet + 8; d += 3) for (const sd of [-wd, 0, wd]) { const px = x + nw[0] * d - nw[1] * sd, pz = z + nw[1] * d + nw[0] * sd; if (F.s(px, pz) > -2.2 || occ.hit(px, pz, 3, 1)) return null; }
      if (head) for (const sd of [-head / 2 - 9, head / 2 + 9]) { const px = x + nw[0] * Ljet - nw[1] * sd, pz = z + nw[1] * Ljet + nw[0] * sd; if (F.s(px, pz) > -3 || occ.hit(px, pz, 4, 1)) return null; } if (F.s(x - nw[0] * 7, z - nw[1] * 7) < 2) return null; return { score: rc ? Math.hypot(x - rc.x, z - rc.z) : rnd() }; }, 1800);
    if (!cands.length) { warn(e.what + ": no shore point"); return; } const c = cands.sort((a, b) => a.score - b.score)[0], nw = c.nw, tv = [-nw[1], nw[0]], h = Math.atan2(nw[1], nw[0]);
    const b = new Builder(), top = 0.98, deckT = 0.28; b.box("l", Ljet + 3, deckT, wd, (Ljet + 3) / 2 - 3, top - deckT, 0); b.box("w", Ljet + 3, 0.05, 0.14, (Ljet + 3) / 2 - 3, top, wd / 2 - 0.15); b.box("w", Ljet + 3, 0.05, 0.14, (Ljet + 3) / 2 - 3, top, -wd / 2 + 0.15);
    for (let x = -1; x <= Ljet; x += 2.6) for (const s of [-1, 1]) { b.cyl("d", 0.2, 0.2, 2.2, x, -1.3, s * (wd / 2 - 0.3), 8); b.box("g", 0.1, 0.5, 0.1, x, top, s * (wd / 2 - 0.08)); } for (let x = -1; x <= Ljet; x += 2.6) b.box("g", 0.12, 0.12, wd - 0.2, x, top - deckT - 0.1, 0);
    for (const s of [-1, 1]) for (let x = 0; x < Ljet; x += 2.6) b.box("g", 2.6, 0.06, 0.06, x + 1.3, top + 0.42, s * (wd / 2 - 0.08));
    const ox = Ljet + (head ? 0 : 0); if (head) { b.box("l", 5, deckT, head, ox + 1.5, top - deckT, 0); for (let z = -head / 2 + 1; z <= head / 2; z += 2.6) for (const s of [0, 4]) b.cyl("d", 0.22, 0.22, 2.2, ox - 0.5 + s, -1.3, z, 8);
      for (const z of [-head / 2 - 3, head / 2 + 3]) { for (let i = 0; i < 3; i++) b.cyl("d", 0.5, 0.55, 2.6, ox + 1.5 + (i - 1) * 0.35, -1.5, z + (i % 2) * 0.3, 8); b.box("g", 0.3, 0.1, Math.abs(z) - head / 2 + 0.3, ox + 1.5, top + 0.0, Math.sign(z) * (head / 2 + (Math.abs(z) - head / 2) / 2)); }
      for (const z of [-head / 2 + 1, head / 2 - 1]) b.cyl("g", 0.28, 0.32, 0.45, ox + 3.2, top, z, 8); b.box("w", 1.6, 1.1, 1.3, ox + 0.4, top, 0); b.box("d", 1.64, 0.3, 1.34, ox + 0.4, top + 0.6, 0); b.hip("g", 2, 0.5, 1.7, ox + 0.4, top + 1.1, 0);
      for (const z of [-1.8, 1.8]) { b.limb("w", V(ox + 2.6, top + 0.1, z), V(ox + 3.2, top + 1.4, z), 0.09); b.limb("w", V(ox + 3.2, top + 1.4, z), V(ox + 4.8, top + 0.7, z), 0.08); b.box("g", 0.3, 0.3, 0.3, ox + 4.8, top + 0.55, z); }
      b.box("l", 3.6, 0.2, 0.4, ox - 2, top + 0.0, 0); }
    for (let i = 0; i < 3; i++) { const pr = 0.16 - i * 0.02; const gm = new THREE.CylinderGeometry(pr, pr, Ljet - 2, 8); gm.rotateZ(Math.PI / 2); b.add(i % 2 ? "l" : "w", gm, (Ljet - 2) / 2, top + 0.4, -wd / 2 * 0.0 + (i - 1) * 0.45); } for (let x = 1; x < Ljet; x += 4) b.box("g", 0.2, 0.3, 1.5, x, top, 0);
    for (let x = 4; x < Ljet; x += 10) { b.cyl("g", 0.04, 0.04, 2.4, x, top, wd / 2 - 0.1, 6); b.box("w", 0.4, 0.1, 0.3, x, top + 2.4, wd / 2 - 0.1); }
    const grp = b.group(mk); grp.position.set(c.x - nw[0] * 3, 0, c.z - nw[1] * 3); grp.rotation.y = -h; group.add(grp); F.pads.push({ x: c.x - nw[0] * 3, z: c.z - nw[1] * 3, r: 5, h: LAND_H, bl: 4, R2: 81 });
    for (let d = -3; d <= Ljet + 3; d += 3) occ.add(c.x + nw[0] * d, c.z + nw[1] * d, wd / 2 + 1.3, "j" + idc++); if (head) for (let z = -head / 2 - 3; z <= head / 2 + 3; z += 3) occ.add(c.x + nw[0] * (Ljet + 1.5) - nw[1] * z, c.z + nw[1] * (Ljet + 1.5) + nw[0] * z, 3.2, "j" + idc++);
    const rec = { name: nameOf(e), what: e.what, obj: grp, x: c.x + nw[0] * Ljet / 2, z: c.z + nw[1] * Ljet / 2, r: Ljet / 2, len: Ljet, wid: wd, h, anchors: { root: [c.x - nw[0] * 6, c.z - nw[1] * 6] }, jetty: { c, nw, tv } }; const usedB = [];
    const berthSlots = (it) => { if (head) { const sides = [-1, 1]; for (let tries = 0; tries < 2; tries++) { const sd = sides[(usedB.length + tries) % 2], hwid = it.hw ?? it.wid / 2, off = head / 2 + 0.9 + hwid + 0.3, len = it.len, key = sd; let start = Ljet - len * 0.2 + 1.5 - len * 0.5 + (usedB.filter(q => q[0] === sd).length) * (len * 1.1);
        const px = c.x + nw[0] * start - nw[1] * sd * off * -1, pz = c.z + nw[1] * start + nw[0] * sd * off * -1; usedB.push([sd]); return { x: px, z: pz, h: h, berthed: true }; } return null; }
      const sd = usedB.length % 2 ? 1 : -1, hwid = it.hw ?? it.wid / 2, off = wd / 2 + 0.9 + hwid, start = Ljet - it.len / 2 - 1 - Math.floor(usedB.length / 2) * (it.len * 1.1); usedB.push([sd]); return { x: c.x + nw[0] * start + tv[0] * off * sd, z: c.z + nw[1] * start + tv[1] * off * sd, h, berthed: true }; };
    rec.anchors.berth = berthSlots; const deckList = []; rec.anchors.deck = (it, k, n) => { const d = 4 + rnd() * (Ljet - 4), s = (rnd() - 0.5) * (wd - 1.4); return { x: c.x + nw[0] * d + tv[0] * s, z: c.z + nw[1] * d + tv[1] * s, h: rnd() * 6.28, y: top + 0.02, noPad: true }; }; rec.anchors.ownIds = [];
    const ids = occ.list.filter(q => String(q.id).startsWith("j")).map(q => q.id); rec.anchors.ownIds = ids; addSubj(rec.name, grp, rec); items.push(rec); if (e.focus) focusObj = rec; return rec; };
  const doBreakwater = e => { const Lb = e.len ?? 60; const cands = shorePoints(10, (x, z, nw) => { for (let d = 3; d <= Lb; d += 4) if (F.s(x + nw[0] * d, z + nw[1] * d) > -2 || !inB(x + nw[0] * d, z + nw[1] * d, 8) || occ.hit(x + nw[0] * d, z + nw[1] * d, 3, 1)) return null; return { score: rnd() }; }, 900); if (!cands.length) { warn("breakwater: no shore"); return; }
    const c = cands[0], nw = c.nw, tv = [-nw[1], nw[0]], b = new Builder(), r2 = rng(seedBase + 77), bend = (e.bend ?? 0.25) * (r2() < 0.5 ? -1 : 1);
    for (let d = -2; d <= Lb; d += 0.7) { const u = d / Lb, off = bend * Lb * 0.5 * u * u, x = c.x + nw[0] * d + tv[0] * off, z = c.z + nw[1] * d + tv[1] * off; for (let k = 0; k < 2; k++) { const rr = 0.32 + r2() * 0.28; b.add(["l", "g", "w"][Math.floor(r2() * 3)], new THREE.IcosahedronGeometry(rr, 0), x + (r2() - 0.5) * 1.1, 0.1 + k * 0.4, z + (r2() - 0.5) * 1.1, r2() * 3, 1.2, 0.8 + r2() * 0.3, 1.1); } }
    for (let d = 6; d <= Lb; d += 3.0) { const u = d / Lb, off = bend * Lb * 0.5 * u * u, x = c.x + nw[0] * d + tv[0] * off, z = c.z + nw[1] * d + tv[1] * off; b.box("l", 1.8, 0.35, 1.6, x, 0.55, z, -Math.atan2(nw[1], nw[0]) + 0.0); occ.add(x, z, 2.2, "bw" + idc++); }
    const grp = b.group(mk); group.add(grp); const rec = { name: nameOf(e), what: "breakwater", obj: grp, x: c.x + nw[0] * Lb / 2, z: c.z + nw[1] * Lb / 2, r: Lb / 2, anchors: {} }; addSubj(rec.name, grp, rec); items.push(rec); };
  const doPipeline = e => { e_overHills = (e.over === "hills") || (e.over === "ridge"); const A = getEndpoint(e.from, null), B = getEndpoint(e.to, A); if (!A || !B) { warn("pipeline: endpoints unresolved " + e.from + "->" + e.to); return; }
    const ign = ownIdsFor([e.from, e.to].filter(x => typeof x === "string")); let pts = route(F, occ, size, A, B, { slope: 1.4, hill: e_overHills ? 1.6 : 0, ignore: ign, step: 2.0, obs: 24 }); if (!pts) { warn("pipeline: no route " + JSON.stringify(A.map(Math.round)) + "->" + JSON.stringify(B.map(Math.round)) + " s=" + F.s(A[0], A[1]).toFixed(1) + "," + F.s(B[0], B[1]).toFixed(1)); return; }
    const gy = pts.map(p => Math.max(F.y(p[0], p[1]), LAND_H)), sm = gy.slice(); for (let it = 0; it < 8; it++) for (let i = 1; i < sm.length - 1; i++) sm[i] = sm[i] * 0.5 + (sm[i - 1] + sm[i + 1]) * 0.25; const nP = e.pipes ?? 2, r = e.radius ?? 0.3, hs = sm.map(y => y + 1.0 + r);
    const b = new Builder(); pipelineBuild(b, pts, hs, gy, rnd, nP, r); const grp = b.group(mk); grp.name = "pipeline"; group.add(grp);
    for (let i = 0; i < pts.length; i++) occ.add(pts[i][0], pts[i][1], 1.5 + nP * 0.4, "pl" + idc++); const mid = pts[pts.length >> 1]; const rec = { name: nameOf(e), what: "pipeline", obj: grp, x: mid[0], z: mid[1], r: 3, anchors: { path: { pts, cum: pathLen(pts), ys: gy, w: 3, ownIds: [], yAt: i => gy[Math.min(gy.length - 1, Math.floor(i))] } } }; addSubj(rec.name, grp, rec); items.push(rec); };
  const doFence = e => { const A = getEndpoint(e.from), B = getEndpoint(e.to, A); if (!A || !B) { warn("fence: endpoints"); return; } const pts = route(F, occ, size, A, B, { slope: 1, step: 1.5, obs: 8, ignore: ownIdsFor([e.from, e.to].filter(x => typeof x === "string")) }); if (!pts) return;
    const ys = pts.map(p => Math.max(F.y(p[0], p[1]), LAND_H) - 0.05), b = new Builder(); fenceBuild(b, pts, ys, e.h ?? 0.8, 1.5); const grp = b.group(mk); group.add(grp); const mid = pts[pts.length >> 1]; const rec = { name: nameOf(e), what: "fence", obj: grp, x: mid[0], z: mid[1], r: 2, anchors: {} }; addSubj(rec.name, grp, rec); items.push(rec); };
  // district: town / city
  const doDistrict = (e, city) => { const n = e.n ?? (city ? 80 : 40), cellW = city ? 5.4 : 4.4, Rr = Math.sqrt(n * cellW * cellW / Math.PI) * 1.18, W = analyze(e.where), e2 = { ...e }; let best = null; const it0 = { r: Rr, pad: true, dom: "land", kind: "district", len: 2 * Rr, wid: 2 * Rr };
    for (let tries = 0; tries < 700 && !best; tries++) { let x, z; if (W.ref && tries < 600) { const R0 = W.ref[0], a = rnd() * 6.28, d = R0.r + Rr + 3 + rnd() * 22; x = R0.x + Math.cos(a) * d; z = R0.z + Math.sin(a) * d; } else { x = (rnd() - 0.5) * (size - 20); z = (rnd() - 0.5) * (size - 20); }
      if (!inB(x, z, Rr + 3)) continue; let okc = 0, tot = 0; for (let a = 0; a < 6.28; a += 0.5) for (const f of [0.5, 1.0]) { tot++; if (F.s(x + Math.cos(a) * Rr * f, z + Math.sin(a) * Rr * f) > 1.2) okc++; } if (okc / tot < (e.landMin ?? 0.92)) continue;
      if (W.has("shore") || W.has("waterfront")) { const s = F.s(x, z); if (s > Rr + 6 || s < Rr * 0.5) continue; } if (W.has("inland") && F.s(x, z) < Rr + 20) continue; if (W.has("center") && Math.hypot(x, z) > half * 0.3) continue;
      if (occ.hit(x, z, Rr, 1.5)) continue; let mn = 1e9, mx = -1e9; for (let a = 0; a < 6.28; a += 0.8) { const y = F.y(x + Math.cos(a) * Rr * 0.8, z + Math.sin(a) * Rr * 0.8); mn = Math.min(mn, y); mx = Math.max(mx, y); } if (mx - mn > 2.4 + Rr * 0.1) continue; best = { x, z }; }
    if (!best) { warn((city ? "city" : "town") + ": no site"); return; } const { x: cx, z: cz } = best, y0 = Math.max(F.y(cx, cz), LAND_H); F.pads.push({ x: cx, z: cz, r: Rr * 1.0, h: y0, bl: Rr * 0.25 + 3, R2: (Rr * 1.25 + 3) ** 2 }); occ.add(cx, cz, Rr, "d" + idc++);
    const b = new Builder(), r2 = rng(seedBase + 31 + cx * 3 | 0), ga = G.ang; const c = Math.cos(ga), sn = Math.sin(ga); const nI = Math.ceil(Rr / cellW) + 1; const cells = [];
    const street = (x0, z0, x1, z1, w) => { const L = Math.hypot(x1 - x0, z1 - z0); b.box("l", L, 0.05, w, (x0 + x1) / 2, y0 - 0.01, (z0 + z1) / 2, -Math.atan2(z1 - z0, x1 - x0)); };
    const blk = city ? 2 : 3; const road = (i, j) => (i % blk === 0), roadj = j => (j % blk === 0), WLoc = (i, j) => [cx + (i * c - j * sn) * cellW, cz + (i * sn + j * c) * cellW];
    for (let i = -nI; i <= nI; i++) for (let j = -nI; j <= nI; j++) { const [px, pz] = WLoc(i + 0.5, j + 0.5), d = Math.hypot(px - cx, pz - cz); if (d > Rr) continue; if (F.s(px, pz) < 1.6) continue; if (road(i, 0) && false) continue;
      const rr = d / Rr, E2 = { M, KM, KMR, MK: mk, rnd: rng(Math.floor(px * 131 + pz * 17 + i * 977 + j * 31) ^ seedBase) }; let it = null; const q = r2();
      if (q < (city ? 0.05 : 0.07)) { for (let k = 0; k < (city ? 2 : 3); k++) { const tp = treeParts(r2, q < 0.025 ? "pine" : "round"), s = (1.5 + r2()) * 0.6; for (const [k2, gg, tx, ty, tz] of tp) b.add(k2, gg.clone(), px + (r2() - 0.5) * 3 + tx * s, y0 + ty * s, pz + (r2() - 0.5) * 3 + tz * s, 0, s, s, s); } continue; }
      if (city) { const fl = rr < 0.25 ? 14 + Math.floor(r2() * 16) : rr < 0.55 ? 6 + Math.floor(r2() * 9) : 2 + Math.floor(r2() * 5); it = GEN.tower(E2, { floors: fl, w: 2.2 + r2() * 1.1, d: 2.2 + r2() * 1.1, style: rr > 0.55 ? "slab" : undefined }); if (rr > 0.78 && r2() < 0.4) it = GEN.warehouse(E2, { len: 4 + r2() * 2, wid: 3.4 }); }
      else { it = r2() < (rr < 0.35 ? 0.35 : 0.1) ? GEN.midrise(E2, { floors: 2 + Math.floor(r2() * 3) }) : r2() < 0.12 ? GEN.shed(E2) : GEN.house(E2); }
      const ry = -(ga + (r2() < 0.5 ? 0 : Math.PI)); bake(b, it.g, px + (r2() - 0.5) * 0.3, y0, pz + (r2() - 0.5) * 0.3, ry, 1); cells.push([px, pz]); }
    const sw = city ? 2.0 : 1.5, seg = (a, b2) => { const mx = (a[0] + b2[0]) / 2, mz = (a[1] + b2[1]) / 2; if (Math.hypot(mx - cx, mz - cz) > Rr * 0.98 || F.s(mx, mz) < 1.5) return; street(a[0], a[1], b2[0], b2[1], sw); };
    for (let i = -nI; i <= nI; i++) if (i % blk === 0) for (let j = -nI; j < nI; j++) { seg(WLoc(i, j), WLoc(i, j + 1)); seg(WLoc(j, i), WLoc(j + 1, i)); }
    // clip streets: draw as short segments only inside the circle (cheap approach: cover overshoot with land colour is not possible), so rebuild streets per cell edge
    b.g.l = (b.g.l ?? []);
    const car = GEN.car(E({ ...e, a: 1 }.a + seedBase), { type: "sedan", scale: 1.1 }); for (let k = 0; k < Math.floor(n * (city ? 0.5 : 0.25)); k++) { const i = Math.floor((r2() - 0.5) * 2 * nI), vert = r2() < 0.5, t = (r2() - 0.5) * 2 * nI; const [px, pz] = vert ? WLoc(Math.round(i / blk) * blk, t) : WLoc(t, Math.round(i / blk) * blk); if (Math.hypot(px - cx, pz - cz) > Rr * 0.97 || F.s(px, pz) < 2) continue;
      const cc = GEN.car(E(seedBase + k * 17), { scale: 1.0 }); bake(b, cc.g, px + (vert ? 0.4 : 0), y0 + 0.04, pz + (vert ? 0 : 0.4), -(ga + (vert ? Math.PI / 2 : 0) + (r2() < 0.5 ? 0 : Math.PI)), 1); }
    const grp = b.group(mk); grp.name = e.what; group.add(grp); const rec = { name: nameOf(e), what: e.what, obj: grp, x: cx, z: cz, y: y0, r: Rr, anchors: {}, it: { kind: "building", h: city ? 12 : 3, r: Rr } }; addSubj(rec.name, grp, rec); items.push(rec); if (e.focus) focusObj = rec;
    const bb = new THREE.Box3().setFromObject(grp); const pm = new THREE.Mesh(new THREE.BoxGeometry(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z)); pm.visible = false; pm.position.copy(bb.getCenter(V(0, 0, 0))); group.add(pm); const hs = V((bb.max.x - bb.min.x) / 2 + 0.5, (bb.max.y - bb.min.y) / 2 + 0.5, (bb.max.z - bb.min.z) / 2 + 0.5); proxies.push({ mesh: pm, hs, dyn: false }); ctx.proxy?.(pm, spec.id, hs, false); };
  const trees = [], instQ = {}; const addInst = (type, x, y, z, ry, s) => { (instQ[type] ??= []).push([x, y, z, ry, (type === "rock" || type === "tuft") ? s : s * 0.6]); };
  const doTrees = e => { const n = e.n ?? 40, W = analyze(e.where), type = e.kind ?? e.type ?? "round"; let got = 0; const ref = W.ref ? W.ref[0] : null;
    for (let tries = 0; tries < n * 40 && got < n; tries++) { let x, z; if (ref) { const a = rnd() * 6.28, d = ref.r + 2 + rnd() * (e.gap ?? 14); x = ref.x + Math.cos(a) * d; z = ref.z + Math.sin(a) * d; } else { x = (rnd() - 0.5) * (size - 10); z = (rnd() - 0.5) * (size - 10); } const s = F.s(x, z); if (s < 2.2) continue;
      if (W.has("shore") && s > 14) continue; if (W.has("inland") && s < 28) continue; if (W.has("hills") && F.y(x, z) < LAND_H + G.maxElev * 0.35) continue; if (occ.hit(x, z, 0.6, 0.2)) continue; addInst(type, x, F.y(x, z) - 0.05, z, rnd() * 6.28, (e.scale ?? 1) * (0.85 + rnd() * 0.4)); got++; } };
  const doFloes = e => { const n = e.n ?? 120, b = new Builder(), r2 = rng(seedBase + 5); let got = 0; const laneClear = (x, z) => { for (const ln of G.lanes) { for (let i = 0; i < ln.pts.length; i += 1) if (Math.hypot(ln.pts[i][0] - x, ln.pts[i][1] - z) < (e.laneW ?? G.laneW ?? 24) * 0.8) return false; } return true; };
    for (let tries = 0; tries < n * 12 && got < n; tries++) { const x = (r2() - 0.5) * (size - 8), z = (r2() - 0.5) * (size - 8), r = 1.6 + Math.pow(r2(), 2.2) * (e.maxR ?? 11); if (!laneClear(x, z)) continue; if (occ.hit(x, z, r * 0.95, 0.2)) continue; b.add(r2() < 0.7 ? "w" : "l", floeGeo(r2, r), x, 0.0, z, r2() * 6.28, 1, 1, 1, (r2() - 0.5) * 0.03, (r2() - 0.5) * 0.03); occ.add(x, z, r * 0.95, "f" + idc++); got++; }
    const grp = b.group(mk); group.add(grp); const rec = { name: nameOf(e), what: "floes", obj: grp, x: 0, z: 0, r: half, anchors: {} }; addSubj(rec.name, grp, rec); };

  const hereGen = { quay: doQuay, jetty: doJetty, pier: doJetty, breakwater: doBreakwater, pipeline: doPipeline, fence: doFence, town: e => doDistrict(e, false), city: e => doDistrict(e, true), trees: doTrees, floes: doFloes, road: e => buildLinear(e, "road"), rail: e => buildLinear(e, "rail") };

  // ---- run the placement queue
  const runEntry = e => { const nm = nameOf(e); if (hereGen[e.what]) { const n0 = items.length; hereGen[e.what](e); if (e.focus && items.length > n0) focusObj = items[items.length - 1]; return; }
    const gen = GEN[e.what]; if (!gen) { warn("unknown what: " + e.what); return; } const W = analyze(e.where), count = e.count ?? (NINT.has(e.what) ? 1 : (e.n ?? 1)); let placed = 0; const recs = [];
    for (let k = 0; k < count; k++) { const it = gen(E(seedBase + hashStr(nm) + k * 977 + (e._i * 31)), e); it.rr = it.rr ?? it.r; const pose = findPose(e, it, k, count, W); if (!pose) { warn(`${e.what}#${k}: no valid place for "${e.where ?? ""}"`); continue; }
      if (e.focus && count > 1 && k !== (e.focusIndex ?? Math.min(1, count - 1))) { const rec = commit({ ...e, focus: false }, it, pose, nm); recs.push(rec); placed++; continue; }
      const rec = commit(e, it, pose, nm); if (pose.path) rec.pathRide = { path: pose.path, u: pose.pu, off: pose.off ?? 0, spd: e.speed ?? (e.moving === false ? 0 : 1.3), it }; recs.push(rec); placed++;
      if (it.kind === "train" && pose.path) rec.pathRide.train = true; }
    if (e.focus && recs.length && !focusObj) focusObj = recs[Math.min(recs.length - 1, e.focusIndex ?? Math.min(1, count - 1))];
    if (e.focus && count > 1 && recs.length > 1) { focusObj = recs[Math.min(recs.length - 1, e.focusIndex ?? Math.min(1, count - 1))]; } };
  for (const e of entries) runEntry(e);

  // ---- auto land use: hamlets, fields (stripes / orchards), rural lanes -> background is never a blank white plane
  const autoLand = () => { const kinds = ["coast", "plain", "river", "canal", "strait", "hills", "city", "island", "desert"]; if (spec.autoLand === false || !kinds.includes(kind)) return; const d = spec.density ?? 0.7, rr = rng(seedBase + 777), centres = [];
    const nH = Math.round(d * (size / 52) * ({ desert: 0.5, hills: 0.8, island: 0.5 }[kind] ?? 1));
    for (let k = 0; k < nH; k++) { const n0 = items.length; doDistrict({ what: "town", n: 7 + Math.floor(rr() * 10), landMin: 0.86, name: "hamlet", where: "" }, false); if (items.length > n0) { const r0 = items[items.length - 1]; centres.push([r0.x, r0.z, r0.r]); } }
    const fb = new Builder(), nF = Math.round(d * size / 14 * ({ desert: 0.3, hills: 0.5, island: 0.4, city: 0.5 }[kind] ?? 1)); let nf = 0;
    for (let tries = 0; tries < nF * 25 && nf < nF; tries++) { const x = (rr() - 0.5) * (size - 30), z = (rr() - 0.5) * (size - 30), w = 12 + rr() * 16, hh = 8 + rr() * 9, h = gridA + (rr() < 0.5 ? 0 : Math.PI / 2), c = Math.cos(h), sn = Math.sin(h);
      let ok = true, mn = 1e9, mx = -1e9; for (const [a, b2] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const px = x + (a * w / 2) * c - (b2 * hh / 2) * sn, pz = z + (a * w / 2) * sn + (b2 * hh / 2) * c; if (F.s(px, pz) < 4 || !inB(px, pz, 6)) { ok = false; break; } const y = F.y(px, pz); mn = Math.min(mn, y); mx = Math.max(mx, y); }
      if (!ok || mx - mn > 0.9) continue; const it = { len: w, wid: hh, r: Math.hypot(w, hh) / 2 }; if (hitFp(it, x, z, h, 0.8)) continue; const y0 = Math.max(F.y(x, z), LAND_H); F.pads.push({ x, z, c, sn, hw: w / 2 + 0.3, hd: hh / 2 + 0.3, h: y0, bl: 3.5, R2: (Math.hypot(w, hh) / 2 + 4) ** 2 });
      for (const [cx2, cz2, cr2] of footprint(it, x, z, h)) occ.add(cx2, cz2, cr2, "fld" + idc++); nf++; const kindF = rr(); const loc = new Builder();
      loc.box(rr() < 0.5 ? "s" : "l", w, 0.07, hh, 0, 0, 0); if (kindF < 0.55) { const ns = Math.floor(hh / 1.2); for (let q = 0; q < ns; q++) loc.box(q % 2 ? "l" : "w", w * 0.96, 0.05, 0.55, 0, 0.07, -hh / 2 + (q + 0.5) * hh / ns); }
      else if (kindF < 0.8) { for (let a = 0; a < w - 1.5; a += 1.6) for (let b2 = 0; b2 < hh - 1.2; b2 += 1.4) loc.sph("w", 0.34, -w / 2 + 1 + a, 0.34, -hh / 2 + 0.8 + b2, 1, 0.9, 1, 6); }
      else { loc.box("w", w * 0.9, 0.04, hh * 0.9, 0, 0.07, 0); loc.box("g", w * 0.9, 0.04, 0.12, 0, 0.1, 0); loc.box("g", 0.12, 0.04, hh * 0.9, 0, 0.1, 0); }
      fb.merge(loc, x, y0, z, -h, 1); }
    if (nf) { const grp = fb.group(mk); grp.name = "fields"; group.add(grp); addSubj("fields", grp, { name: "fields", what: "fields", obj: grp, x: 0, z: 0, r: half, anchors: {} }); }
    for (let i = 0; i + 1 < centres.length && i < 4; i++) buildLinear({ what: "road", from: [centres[i][0], centres[i][1]], to: [centres[i + 1][0], centres[i + 1][1]], width: 2.0, name: "lane", auto: true, bridge: true }, "road"); };
  autoLand();
  const autoLife = () => { if (spec.autoLife === false) return; const d = spec.density ?? 0.7; let wn = 0; for (let k = 0; k < 200; k++) if (F.s((fr0() - 0.5) * size, (fr0() - 0.5) * size) < -4) wn++; wn /= 200;
    if (wn > 0.08 && kind !== "ice") { runEntry({ what: "skiff", n: Math.round(d * 3 + wn * 4), where: "shore", name: "skiffAuto" }); runEntry({ what: "fishingBoat", n: Math.max(1, Math.round(d * 1.5)), where: "anchorage", name: "fishAuto" }); runEntry({ what: "buoy", n: 4, where: "anchorage", name: "buoyAuto" }); }
    const P = SUBJ_PATH.road; if (P) { const L = P.cum[P.cum.length - 1]; runEntry({ what: "car", n: Math.min(14, Math.round(L / 26)), where: "road", name: "trafficAuto" }); } };
  const fr0 = rng(seedBase + 4321); autoLife();
  for (const f of pending) f();
  // path riders (trucks, trains)
  for (const r of items) if (r.pathRide) { const pr = r.pathRide, P = pr.path, L = P.cum[P.cum.length - 1], o = r.obj, it = pr.it, flip = pr.off < 0 ? Math.PI : 0, dirn = pr.off < 0 ? -1 : 1;
    if (it.kind === "train") continue; anims.push(t => { const s = pr.u + dirn * pr.spd * t, p = pathAt(P.pts, P.cum, s, true), nx = -Math.sin(p.a) * pr.off, nz = Math.cos(p.a) * pr.off; o.position.x = p.x + nx; o.position.z = p.z + nz; o.position.y = P.yAt(p.i) + 0.06; o.rotation.y = -(p.a + flip); }); }
  // trains: rebuild as independent car objects in scene space
  for (const r of items) if (r.pathRide && r.it.kind === "train") { const it = r.it, pr = r.pathRide, P = pr.path; const cars = it.cars; cars.forEach(c => { c.position.set(0, 0, 0); group.add(c); }); r.obj.visible = false;
    anims.push(t => { const s0 = pr.u + pr.spd * t * 0.6; cars.forEach((car, i) => { const p = pathAt(P.pts, P.cum, s0 - i * it.spacing, true); car.position.set(p.x, P.yAt(p.i) + 0.06, p.z); car.rotation.y = -p.a; }); }); r.obj = cars[0]; SUBJ[r.name] = SUBJ[r.name].filter(o => o !== r.it.g).concat(cars); }

  // ============================== terrain, water, slab ==============================
  const EXT = size * 1.7, eh = EXT / 2, cell = EXT / Math.round(EXT / (kind === "mountains" ? 3.2 : 2.2)), NN = Math.round(EXT / cell), fogC = new THREE.Color(0xdfe4e8), N1v = NN + 1; const hArr = new Float32Array(N1v * N1v), sArr = new Float32Array(N1v * N1v);
  for (let j = 0; j < N1v; j++) for (let i = 0; i < N1v; i++) { const x = -eh + i * cell, z = -eh + j * cell, s = F.s(x, z); sArr[j * N1v + i] = s; let y = F.surf(x, z, s); if (s > 0.3) y = F.mod(x, z, y); hArr[j * N1v + i] = y; }
  const tPos = [], tCol = [], tIdx = [], C = new THREE.Color(), cLand = new THREE.Color(kind === "desert" ? 0xf0e8d6 : 0xf2f0ea), cRock = new THREE.Color(0xc4c1ba), cSnow = new THREE.Color(0xffffff), cSand = new THREE.Color(0xf0e9d8), cSlope = new THREE.Color(0xdad8d1), tN = vnoise(seedBase & 0xffff);
  for (let j = 0; j < N1v; j++) for (let i = 0; i < N1v; i++) { const k = j * N1v + i, x = -eh + i * cell, z = -eh + j * cell, y = hArr[k]; tPos.push(x, y, z);
    const hx = (hArr[j * N1v + Math.min(N1v - 1, i + 1)] - hArr[j * N1v + Math.max(0, i - 1)]) / (2 * cell), hz = (hArr[Math.min(N1v - 1, j + 1) * N1v + i] - hArr[Math.max(0, j - 1) * N1v + i]) / (2 * cell), sl = Math.hypot(hx, hz), s = sArr[k];
    C.copy(cLand); const v = (tN(x * 0.09, z * 0.09) - 0.5) * 0.04 + (tN(x * 0.017 + 9, z * 0.017) - 0.5) * 0.07; C.offsetHSL(0, 0, v); if (kind !== "desert" && s < 3.5 && y > 0) C.lerp(cSand, 0.55 * (1 - s / 3.5)); if (kind === "mountains" || kind === "hills" || kind === "island") C.lerp(cSlope, clamp((sl - 0.35) * 1.3, 0, 0.7));
    if (kind === "mountains") { const sn = LAND_H + G.maxElev * 0.3; C.lerp(cRock, clamp((y - 3) / 10, 0, 0.9)); C.lerp(new THREE.Color(0xa7a49d), clamp((sl - 0.5) * 1.5, 0, 0.8)); if (y > sn) C.lerp(cSnow, clamp((y - sn) / 3, 0, 1) * (1 - clamp((sl - 1.2) * 1.0, 0, 0.6))); }
    if (kind === "desert") C.lerp(new THREE.Color(0xe7dcc2), clamp(sl * 1.4, 0, 0.6)); if (kind === "ice" && G.vor) { C.set(0xf5f8fb); C.offsetHSL(0, 0, (G.vor(x, z).id - 0.5) * 0.035 - clamp(1 - s / 3, 0, 1) * 0.04); } if (y < 0.05) C.set(0xbcc9cf); C.lerp(fogC, smooth((Math.max(Math.abs(x), Math.abs(z)) - eh * 0.7) / (eh * 0.3))); tCol.push(C.r, C.g, C.b); }
  for (let j = 0; j < NN; j++) for (let i = 0; i < NN; i++) { const a = j * N1v + i, b = a + 1, c = a + N1v, d = c + 1; tIdx.push(a, c, b, b, c, d); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.Float32BufferAttribute(tPos, 3)); tg.setAttribute("color", new THREE.Float32BufferAttribute(tCol, 3)); tg.setIndex(tIdx); tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: kind === "mountains" })); terrain.receiveShadow = true; terrain.castShadow = true; terrain.name = "terrain"; group.add(terrain);
  // sea (colour by depth, gentle waves)
  const seaX = q => -eh + q * cell, wc = [], wDeep = new THREE.Color(kind === "ice" ? 0x7f9bad : 0xc6d9e3), wSh = new THREE.Color(kind === "ice" ? 0xaec5d3 : 0xeaf3f6), seaPos = [], wIdx = [];
  for (let j = 0; j < N1v; j++) for (let i = 0; i < N1v; i++) { const k = j * N1v + i, dep = -hArr[k], f = smooth(1 - dep / 2.6); C.copy(wDeep).lerp(wSh, f * 0.9); C.lerp(fogC, smooth((Math.max(Math.abs(seaX(i)), Math.abs(seaX(j))) - eh * 0.7) / (eh * 0.3))); wc.push(C.r, C.g, C.b); seaPos.push(-eh + i * cell, 0, -eh + j * cell); }
  for (let j = 0; j < NN; j++) for (let i = 0; i < NN; i++) { const a = j * N1v + i, b = a + 1, c = a + N1v, d = c + 1; wIdx.push(a, c, b, b, c, d); }
  const wg = new THREE.BufferGeometry(); wg.setAttribute("position", new THREE.Float32BufferAttribute(seaPos, 3)); wg.setAttribute("color", new THREE.Float32BufferAttribute(wc, 3)); wg.setIndex(wIdx); wg.computeVertexNormals();
  const sea = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, flatShading: true })); sea.receiveShadow = true; sea.name = "sea"; group.add(sea); const wBase = Float32Array.from(seaPos); let waveAmp = g.waves ?? 0.05;
  // diorama edge: skirts (cross-section of land + water) so the set reads as a cut model
  const skirt = () => { const P = [], Cc = [], I = []; const cw = new THREE.Color(0xbdd0da), cwb = new THREE.Color(0xa9bcc6), cl = new THREE.Color(0xe9e6df), cl2 = new THREE.Color(0xcfcbc2); let vi = 0;
    const edge = (fx, fz) => { for (let k = 0; k < NN; k++) { const p0 = fx(k), p1 = fx(k + 1), h0 = Math.max(hArr[p0[2]], 0), h1 = Math.max(hArr[p1[2]], 0), land0 = hArr[p0[2]] > 0.05, land1 = hArr[p1[2]] > 0.05; const bot = -3.2;
      P.push(p0[0], h0, p0[1], p1[0], h1, p1[1], p1[0], bot, p1[1], p0[0], bot, p0[1]); const ct0 = land0 ? cl : cw, ct1 = land1 ? cl : cw, cb0 = land0 ? cl2 : cwb, cb1 = land1 ? cl2 : cwb; Cc.push(ct0.r, ct0.g, ct0.b, ct1.r, ct1.g, ct1.b, cb1.r, cb1.g, cb1.b, cb0.r, cb0.g, cb0.b); I.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4; } };
    edge(k => [-eh + k * cell, -eh, 0 * N1v + k]); edge(k => [-eh + k * cell, eh, NN * N1v + k]); edge(k => [-eh, -eh + k * cell, k * N1v]); edge(k => [eh, -eh + k * cell, k * N1v + NN]);
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); sg.setAttribute("color", new THREE.Float32BufferAttribute(Cc, 3)); sg.setIndex(I); sg.computeVertexNormals(); const m = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })); m.receiveShadow = true; m.name = "slab"; group.add(m); };
  if (g.edge === true) skirt();

  // ============================== fill (instanced) ==============================
  const dens = spec.density ?? 0.7, fr = rng(seedBase + 555); const sampleLand = () => { let n = 0; for (let k = 0; k < 400; k++) if (F.s((fr() - 0.5) * size, (fr() - 0.5) * size) > 2) n++; return n / 400; }; const landFrac = sampleLand();
  const fillTrees = (type, count, pred, sc = [1, 1.5]) => { let got = 0; for (let tries = 0; tries < count * 12 && got < count; tries++) { const x = (fr() - 0.5) * (EXT - 4), z = (fr() - 0.5) * (EXT - 4), s = F.s(x, z); if (s < 2.0) continue; const y = F.y(x, z); if (!pred(x, z, s, y)) continue; if (occ.hit(x, z, 0.5, 0.15)) continue; addInst(type, x, y - 0.04, z, fr() * 6.28, sc[0] + fr() * (sc[1] - sc[0])); got++; } };
  const forest = (x, z, f = 0.035, th = 0.46) => clamp((tN(x * f + 40, z * f) - th) * 4, 0, 1) > fr();
  if (spec.fill !== false) { const A = size * size * landFrac * 1.9;
    if (["coast", "plain", "river", "canal", "strait", "city", "hills", "island"].includes(kind)) { fillTrees("round", Math.floor(A * 0.011 * dens), (x, z, s, y) => forest(x, z, 0.035, 0.42) && y < LAND_H + G.maxElev * 0.75 && s > 3, [0.95, 1.5]); fillTrees("shrub", Math.floor(A * 0.006 * dens), (x, z, s, y) => forest(x, z, 0.05, 0.4) || fr() < 0.05, [0.7, 1.2]); }
    if (kind === "hills" || kind === "mountains") fillTrees("pine", Math.floor(A * (kind === "mountains" ? 0.0075 : 0.009) * dens), (x, z, s, y) => forest(x, z, 0.03, 0.4) && y < LAND_H + G.maxElev * (kind === "mountains" ? 0.45 : 0.8), [1.1, 1.9]);
    if (kind === "island") fillTrees("palm", Math.floor(A * 0.004 * dens), (x, z, s, y) => forest(x, z, 0.04, 0.42) && y < LAND_H + 5, [1.1, 1.7]);
    if (kind === "coast" || kind === "desert" || kind === "river") fillTrees("palm", Math.floor(A * (kind === "desert" ? 0.0006 : 0.0015) * dens), (x, z, s, y) => (kind === "desert" ? s > 3 && s < 30 && forest(x, z, 0.06, 0.62) : s < 40 && forest(x, z, 0.05, 0.5)), [1.1, 1.7]);
    if (kind === "desert") fillTrees("shrub", Math.floor(A * 0.0032 * dens), (x, z, s, y) => forest(x, z, 0.04, 0.5) || fr() < 0.05, [0.7, 1.3]);
    if (kind === "mountains" || kind === "hills" || kind === "desert") fillTrees("rock", Math.floor(A * (kind === "mountains" ? 0.0044 : 0.0026) * dens), () => true, [0.9, 2.4]);
    if (kind !== "ice" && kind !== "sea") fillTrees("tuft", Math.floor(A * 0.016 * dens), (x, z, s, y) => s > 2.4 && fr() < 0.35 + 0.65 * clamp((tN(x * 0.05 + 3, z * 0.05) - 0.4) * 3, 0, 1), [0.8, 1.5]);
    { const nshore = Math.floor(size * 0.35 * dens); for (let k = 0; k < nshore; k++) { const x = (fr() - 0.5) * (size - 6), z = (fr() - 0.5) * (size - 6), s = F.s(x, z); if (s < -2 || s > 1.2 || kind === "ice") continue; if (occ.hit(x, z, 0.6, 0.2)) continue; addInst("rock", x, Math.max(F.y(x, z), -0.1) - 0.1, z, fr() * 6.28, 0.5 + fr() * 1.0); } }
    if (kind === "ice" || (spec.icebergs ?? 0)) { /* icebergs handled via place */ } }
  const instGroup = new THREE.Group(); instGroup.name = "vegetation"; const rpt = rng(seedBase + 8), dm = new THREE.Matrix4(), dq = new THREE.Quaternion(), de = new THREE.Euler();
  for (const [type, arr] of Object.entries(instQ)) { if (!arr.length) continue; const parts = type === "tuft" ? [["l", new THREE.ConeGeometry(0.1, 0.38, 4), 0, 0.19, 0], ["l", new THREE.ConeGeometry(0.08, 0.3, 4), 0.18, 0.15, 0.1], ["l", new THREE.ConeGeometry(0.08, 0.3, 4), -0.12, 0.15, 0.14]] : type === "rock" ? [["l", new THREE.IcosahedronGeometry(0.55, 0), 0, 0.15, 0], ["g", new THREE.IcosahedronGeometry(0.32, 0), 0.5, 0.05, 0.2]] : treeParts(rpt, type), byK = {};
    for (const [k, gg, px, py, pz] of parts) { const c = gg.clone().toNonIndexed(); if (c.attributes.uv) c.deleteAttribute("uv"); c.translate(px, py, pz); (byK[k] ??= []).push(c); }
    for (const k in byK) { const geo = mergeGeometries(byK[k], false), im = new THREE.InstancedMesh(geo, mk[k], arr.length); arr.forEach(([x, y, z, ry, s], i) => { de.set(0, ry, 0); dq.setFromEuler(de); dm.compose(V(x, y, z), dq, V(s, s * (type === "rock" ? 0.75 : 1), s)); im.setMatrixAt(i, dm); }); im.castShadow = im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; instGroup.add(im); } }
  group.add(instGroup);

  // ============================== ambient ==============================
  const amb = new Set([...(spec.ambient ?? []), "waves", "smoke", "birds"]);
  const smokeMat = i => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.6, depthWrite: false });
  const puffs = []; if (amb.has("smoke")) for (const sm of smokes.slice(0, 14)) for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 * sm.sc, 1), smokeMat()); m.castShadow = false; group.add(m); puffs.push({ m, sm, k }); }
  const birds = []; if (amb.has("birds")) { const BM = new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: 0.7, side: THREE.DoubleSide, flatShading: true }), wingG = new THREE.BufferGeometry(); wingG.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -0.08, 0, 0, 0.1, 0.3, 0, 0], 3)); wingG.computeVertexNormals();
    const nb = spec.birds ?? 10, rb = rng(seedBase + 99); for (let k = 0; k < nb; k++) { const b = new THREE.Group(), body = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 5), BM); body.rotation.x = Math.PI / 2; b.add(body); const wl = new THREE.Mesh(wingG, BM), wr = new THREE.Mesh(wingG, BM); wr.scale.x = -1; b.add(wl, wr); b.scale.setScalar(2.6);
      b.userData = { wl, wr, cx: (rb() - 0.5) * size * 0.5, cz: (rb() - 0.5) * size * 0.5, r: 10 + rb() * 22, h: 8 + rb() * 8, ph: rb() * 6.28, sp: 0.12 + rb() * 0.08, f: 7 + rb() * 3 }; group.add(b); birds.push(b); } }
  const update = t => {
    if (amb.has("waves") && waveAmp > 0) { const p = wg.attributes.position; for (let i = 0; i < p.count; i++) { const x = wBase[i * 3], z = wBase[i * 3 + 2], dep = -hArr[i], a = smooth(dep / 1.5) * waveAmp; p.setY(i, a * (Math.sin(x * 0.31 + z * 0.12 + t * 1.2) + Math.sin(z * 0.47 - x * 0.21 - t * 0.9) * 0.8 + Math.sin(x * 0.83 + z * 0.67 + t * 1.7) * 0.4)); } p.needsUpdate = true; wg.computeVertexNormals(); }
    for (const f of anims) f(t);
    for (const { m, sm, k } of puffs) { const u = ((t * 0.1 + k / 5 + sm.ph) % 1 + 1) % 1; let base = sm.pos; if (sm.ves) base = sm.obj.localToWorld(sm.local.clone()); m.position.set(base.x + u * 6 * sm.sc + 0, base.y + u * 6.5 * sm.sc, base.z + u * 2.2 * sm.sc); const s = 0.5 + u * 2.4; m.scale.setScalar(s); m.material.opacity = 0.62 * (1 - u) * smooth(u * 8); }
    for (const b of birds) { const u = b.userData, a = u.ph + t * u.sp; b.position.set(u.cx + Math.cos(a) * u.r * 1.6, u.h + Math.sin(t * 0.8 + u.ph) * 0.4, u.cz + Math.sin(a) * u.r * 0.8); b.lookAt(u.cx + Math.cos(a + 0.1) * u.r * 1.6, b.position.y, u.cz + Math.sin(a + 0.1) * u.r * 0.8); const f = Math.sin(t * u.f + u.ph) * 0.9; u.wl.rotation.z = f; u.wr.rotation.z = -f; } };
  update(0); group.updateMatrixWorld(true);

  // ============================== focus ==============================
  let focusCur = [];
  const meshesOf = o => { const ms = []; o.traverse(m => { if (m.isMesh && !m.userData.noFocus && m.material && (fmap.has(m.material) || m.userData.m0)) ms.push(m); }); return ms; };
  const setFocus = (name, idx = 0) => { for (const m of focusCur) if (m.userData.m0) m.material = m.userData.m0; focusCur = []; if (name == null) return; let objs = name === "focus" ? (focusObj ? [focusObj.obj] : []) : (typeof name === "string" ? ((SUBJ[name] ?? []).slice(idx, idx + 1)) : [].concat(name));
    objs = objs.map(o => o.userData.units ? o.userData.units[o.userData.mainUnit ?? 0] : o);
    for (const o of objs) for (const m of meshesOf(o)) { if (m.userData.noFocus) continue; /* site slabs, plazas, tree rings stay white: only the subject itself turns red */ m.userData.m0 ??= m.material; const r = fmap.get(m.userData.m0); if (r) { m.material = r; focusCur.push(m); } } };
  if (spec.focusDefault !== false && focusObj) setFocus("focus");

  // ============================== subjects (public), framings ==============================
  const subjects = SUBJ; if (focusObj) subjects.focus = [focusObj.obj];
  const bboxOf = o => new THREE.Box3().setFromObject(o);
  const mainItems = items.filter(r => r.obj && !["road", "rail", "fence", "floes", "breakwater"].includes(r.what) && r.what !== "people" && r.what !== "trees");
  const U0 = new THREE.Box3(); for (const r of mainItems) { const b = bboxOf(r.obj); if (isFinite(b.min.x) && r.what !== "mountain") U0.union(b); } if (U0.isEmpty()) U0.set(V(-30, 0, -30), V(30, 8, 30)); const frameBox = U0.clone().expandByScalar(4);
  const focusTarget = focusObj ? (focusObj.obj.userData.units ? focusObj.obj.userData.units[focusObj.obj.userData.mainUnit ?? 0] : focusObj.obj) : null; const focusBox = focusObj ? bboxOf(focusTarget) : mainItems.length ? bboxOf(mainItems.reduce((a, b) => (b.r > a.r ? b : a)).obj) : U0.clone();
  const fo = focusBox.getCenter(V(0, 0, 0)), fsz = focusBox.getSize(V(0, 0, 0)); const FOV = 40, tanV = Math.tan(FOV / 2 * D2R), ASP = 16 / 9, tanH = tanV * ASP;
  const dirOf = (az, el) => V(Math.cos(el * D2R) * Math.cos(az * D2R), Math.sin(el * D2R), Math.cos(el * D2R) * Math.sin(az * D2R));
  const fitD = (box, az, el, margin = 1.1, asp = ASP) => { const dv = dirOf(az, el), f = dv.clone().negate(), right = V().crossVectors(f, V(0, 1, 0)).normalize(), upv = V().crossVectors(right, f).normalize(), c0 = box.getCenter(V(0, 0, 0)); let d = 1;
    for (let i = 0; i < 8; i++) { const c = V(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(c0), x = Math.abs(c.dot(right)), y = Math.abs(c.dot(upv)), z = c.dot(f); d = Math.max(d, x / (tanV * asp) - z, y / tanV - z); } return d * margin + 0.5; };
  const proxyMeshes = proxies.map(p => p.mesh); const ray = new THREE.Raycaster(), tmpP = V(0, 0, 0); const fo2 = V(0, 0, 0);
  const clearOf = (pos, look, ignoreObjs, los = true) => { if (pos.y < F.y(pos.x, pos.z) + 0.9 || pos.y < 0.9) return false; if (Math.abs(pos.x) > half * 6 || Math.abs(pos.z) > half * 6) return false;
    for (const p of proxies) { p.mesh.updateMatrixWorld(true); tmpP.copy(pos).applyMatrix4(new THREE.Matrix4().copy(p.mesh.matrixWorld).invert()); const cl = 2.0 / (p.mesh.parent?.scale?.x || 1); if (Math.abs(tmpP.x) <= p.hs.x + cl && Math.abs(tmpP.y) <= p.hs.y + cl && Math.abs(tmpP.z) <= p.hs.z + cl) return false; }
    if (!los) return !terrBlocked(pos, look); const dir = V().subVectors(look, pos), dl = dir.length(); ray.set(pos, dir.normalize()); ray.far = Math.max(0.01, dl - 0.5); const holder = new Set(ignoreObjs ?? []); const hits = ray.intersectObjects(proxyMeshes, false).filter(h => { for (let p = h.object; p; p = p.parent) if (holder.has(p)) return false; return true; }); if (hits.length) return false;
    const ph = F.y(pos.x, pos.z); const n = 12; for (let i = 1; i <= n; i++) { const q = pos.clone().lerp(look, i / n * 0.9); if (q.y < F.y(q.x, q.z) + 0.15 && q.y < 60) return false; } return true; };
  const terrBlocked = (pos, tg) => { for (let i = 1; i <= 14; i++) { const q = pos.clone().lerp(tg, i / 14 * 0.97); if (q.y < F.y(q.x, q.z) + 0.25) return true; } return false; };
  const ringOK = (pos, look, d) => { let bad = 0; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, tg = V(look.x + Math.cos(a) * d * 0.28, 0, look.z + Math.sin(a) * d * 0.28); tg.y = Math.max(F.y(tg.x, tg.z), 0) + 0.3; if (terrBlocked(pos, tg)) bad++; } return bad <= 1; };
  const treeNear = (pos, look) => { const T = [...(instQ.round ?? []), ...(instQ.pine ?? []), ...(instQ.palm ?? [])]; for (let i = 1; i <= 16; i++) { const q = pos.clone().lerp(look, i / 16 * 0.85); for (const [x, y, z, , sc] of T) if (Math.abs(x - q.x) < 1.6 * sc && Math.abs(z - q.z) < 1.6 * sc && q.y < y + 2.4 * sc) return true; } return false; };
  const solve = (name, look, az, el, d, ign = [], note, los = true) => { for (const dm of [1, 1.3, 1.7, 2.3, 3]) for (const lift of [0, 4, 8, 14, 22, 34, 48, 64]) for (const da of [0, 12, -12, 25, -25, 40, -40, 60, -60, 90, -90]) { const a2 = az + da, e2 = Math.min(86, el + lift * 0.9), dd = d * dm, pos = look.clone().addScaledVector(dirOf(a2, e2), dd);
      if (clearOf(pos, look, ign, los) && (!los || ringOK(pos, look, dd))) return { name, look: look.clone(), az: a2, el: e2, d: dd, note: dm > 1 ? note + " (pulled back)" : note }; }
    return { name, look: look.clone(), az, el: Math.min(80, el + 22), d: d * 1.15, note: "unverified" }; };
  const A0 = G.front, ign0 = focusObj ? [focusObj.obj] : [];
  const framings = [];
  const slabBox = new THREE.Box3(V(-half * 0.92, -0.5, -half * 0.92), V(half * 0.92, Math.max(6, G.maxElev * 0.5), half * 0.92)); slabBox.min.multiplyScalar(0.7).setY(-0.5); slabBox.max.multiplyScalar(0.7); const wideEl = 28, wideA = A0, wb = slabBox; framings.push(solve("wide", wb.getCenter(V(0, 0, 0)).setY(Math.max(0.5, F.y(0, 0) + 1)), wideA, wideEl, fitD(wb, wideA, wideEl, 1.08), [], "establishing, whole set", false));
  const fd = Math.max(fitD(focusBox.clone().expandByScalar(1.2), A0 + 90, 8, 1.4), 14); framings.push(solve("lateralLow", fo, A0 + 90, 8, fd * 1.0, ign0, "low lateral on focus"));
  framings.push(solve("topDown", wb.getCenter(V(0, 0, 0)).setY(0), A0, 66, fitD(wb, A0, 66, 1.0), [], "top-down map view", false));
  framings.push(solve("threeQuarter", fo, A0 + 38, 22, Math.max(fitD(focusBox.clone().expandByScalar(2.2), A0 + 38, 22, 1.2), 16), ign0, "three-quarter close on focus"));
  framings.push(solve("highOblique", U0.getCenter(V(0, 0, 0)).setY(1), A0 + 55, 46, fitD(U0.clone().expandByScalar(Math.max(10, size * 0.12)), A0 + 55, 46, 1.05), [], "high oblique, whole set", false));
  framings.push(solve("orbitBack", fo, A0 + 150, 25, Math.max(fitD(focusBox.clone().expandByScalar(3), A0 + 150, 25, 1.25), 20), ign0, "reverse angle on focus"));
  // detail: second-largest item or focus upper part
  { const others = mainItems.filter(r => r !== focusObj && r.r > 1.8 && r.what !== "quay").sort((a, b) => b.r - a.r), tgt = others[Math.min(1, others.length - 1)] ?? focusObj; if (tgt) { const bb = bboxOf(tgt.obj), cc = bb.getCenter(V(0, 0, 0)); cc.y = bb.min.y + (bb.max.y - bb.min.y) * 0.55; framings.push(solve("detail", cc, A0 - 40, 20, Math.max(fitD(bb.clone().expandByScalar(1.0), A0 - 40, 20, 1.3), 12), [tgt.obj], "close on secondary subject")); } }
  // over the shoulder of a small figure
  { const E2 = { M, KM, KMR, MK: mk, rnd: rng(seedBase + 4242) }; const fig = GEN.people(E2, { n: 1, scale: 1.1 }); let spot = null; const fa = focusObj;
    const decks = items.filter(r => r.anchors?.deck && r.what !== "quay").concat(items.filter(r => r.what === "quay")); const tryPts = [];
    for (let tries = 0; tries < 1800 && !spot; tries++) { let x, z, y; if (tries < 300 && decks.length) { const dk = decks[tries % decks.length], p = dk.anchors.deck({ r: 0.5, len: 1, wid: 1, kind: "people" }, 0, 1); x = p.x; z = p.z; y = p.y; } else { const a = rnd() * 6.28, dd = 8 + rnd() * 18 + tries * 0.03; x = fo.x + Math.cos(a) * dd; z = fo.z + Math.sin(a) * dd; if (F.s(x, z) < 2.5 || !inB(x, z, 4)) continue; y = Math.max(F.y(x, z), LAND_H); }
      const fr0 = Math.max(fsz.x, fsz.z) / 2; if (Math.hypot(x - fo.x, z - fo.z) < Math.max(7, fr0 * 1.2 + 5) || Math.hypot(x - fo.x, z - fo.z) > Math.max(40, fr0 * 2.5 + 20) || occ.hit(x, z, 0.5, 0.2, new Set(decks.flatMap(q => q.anchors.ownIds ?? [])))) continue; const back = V(x - fo.x, 0, z - fo.z).normalize(), side = V(-back.z, 0, back.x), cam = V(x, (y ?? LAND_H), z).addScaledVector(back, 6.6).addScaledVector(side, 1.0); cam.y += Math.max(2.4, fsz.y * 0.32);
      const look = fo.clone(); look.y = Math.max(look.y * 0.9, fo.y); if (clearOf(cam, look, [...ign0, ...(fa ? [fa.obj] : [])]) && !treeNear(cam, look)) spot = { x, z, y: y ?? LAND_H, cam, look, back }; }
    if (spot) { fig.g.position.set(spot.x, spot.y, spot.z); fig.g.rotation.y = Math.atan2(-(fo.z - spot.z), fo.x - spot.x) + 0; fig.g.updateMatrixWorld(true); group.add(fig.g); (subjects.observer ??= []).push(fig.g); const dv = V().subVectors(spot.cam, spot.look), dl = dv.length(); framings.push({ name: "overShoulder", look: spot.look, az: Math.atan2(dv.z, dv.x) / D2R, el: Math.asin(dv.y / dl) / D2R, d: dl, note: "behind a small figure (" + (1.1 / (2 * 6.6 * tanV) * 100).toFixed(0) + "% frame height)", exact: true }); } }
  // push-through between two objects
  { const cand = mainItems.filter(r => r.r > 2 && r.what !== "quay" && !r.what.startsWith("town")).sort((a, b) => b.r - a.r); let A = focusObj ?? cand[0], Bq = null, bd = 1e9; for (const r of cand) { if (r === A) continue; const d = Math.hypot(r.x - A.x, r.z - A.z); if (d > A.r + r.r + 3 && d < bd) { bd = d; Bq = r; } }
    if (A && Bq) { const M2 = V((A.x + Bq.x) / 2, 0, (A.z + Bq.z) / 2), ab = V(Bq.x - A.x, 0, Bq.z - A.z).normalize(), perp = V(-ab.z, 0, ab.x); M2.y = Math.max(F.y(M2.x, M2.z), 0.5) + 1.2; const gap = Math.hypot(Bq.x - A.x, Bq.z - A.z); const cand2 = [];
      for (const sgn of [1, -1]) { const dist = Math.max(10, gap * 0.9); const cam = M2.clone().addScaledVector(perp, sgn * dist); cam.y = M2.y + dist * 0.12 + 1.2; if (clearOf(cam, M2, [A.obj, Bq.obj])) { const dv = V().subVectors(cam, M2), dl = dv.length(); cand2.push({ name: "pushThrough", look: M2.clone(), az: Math.atan2(dv.z, dv.x) / D2R, el: Math.asin(dv.y / dl) / D2R, d: dl, note: `through the gap between ${A.name} and ${Bq.name}`, exact: true }); } }
      if (cand2.length) framings.push(cand2[0]); else framings.push(solve("pushThrough", M2, Math.atan2(perp.z, perp.x) / D2R, 7, Math.max(10, gap * 0.9), [A.obj, Bq.obj], "gap between two subjects")); } }
  // along a linear feature (jetty, road, rail, lane)
  { let path = null; const pr = SUBJ_PATH.road ?? SUBJ_PATH.rail; if (pr) path = pr; else { const jt = items.find(r => r.jetty); if (jt) { const { c, nw } = jt.jetty; const pts = [[c.x - nw[0] * 8, c.z - nw[1] * 8], [c.x + nw[0] * jt.len, c.z + nw[1] * jt.len]]; path = { pts, cum: pathLen(pts), yAt: () => 1 }; } else if (G.lanes[0]) { const ln = G.lanes[0], cum = ln.cum ??= pathLen(ln.pts); path = { pts: ln.pts, cum, yAt: () => 0.4 }; } }
    if (path) { const L = path.cum[path.cum.length - 1]; for (const [u0, u1] of [[0.14, 0.62], [0.86, 0.38], [0.3, 0.8]]) { const a = pathAt(path.pts, path.cum, u0 * L, false), b = pathAt(path.pts, path.cum, u1 * L, false), look = V(b.x, path.yAt(b.i) + 1.0, b.z), pos = V(a.x - Math.cos(b.a - a.a) * 0, path.yAt(a.i) + 3.0, a.z);
        const dv = V().subVectors(pos, look), dl = dv.length(); if (clearOf(pos, look, [])) { framings.push({ name: "alongAxis", look, az: Math.atan2(dv.z, dv.x) / D2R, el: Math.asin(dv.y / dl) / D2R, d: dl, note: "low, down the main road/jetty/lane", exact: true }); break; } } } }
  for (const f of framings) { f.look = f.look.clone(); }
  // lighting recipe
  const lp = LIGHTS[spec.light?.time ?? "morning"] ?? LIGHTS.morning, light = { sunAz: (spec.light?.az ?? lp[0]), sunEl: (spec.light?.el ?? lp[1]), sunColor: lp[2], sunIntensity: spec.light?.sun ?? lp[3], hemiIntensity: spec.light?.hemi ?? lp[4], sky: lp[5], fog: [size * 0.9, size * 2.8], tiltAmt: 2.4 };
  // stats
  let tris = 0, meshes = 0; group.traverse(m => { if (m.isMesh && m.visible) { meshes++; const gg = m.geometry, c = (gg.index ? gg.index.count : gg.attributes.position.count) / 3; tris += c * (m.isInstancedMesh ? m.count : 1); } });
  const info = { ext: EXT, id: spec.id, ms: Math.round(performance.now() - t0), tris: Math.round(tris), drawCalls: meshes, items: items.length, warns, ground: G.kind, size };
  return { group, subjects, proxies, framings, update, setFocus, light, info, field: F, ground: G, items, focus: focusObj };
}
