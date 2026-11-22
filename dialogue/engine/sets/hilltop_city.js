// hilltop_city (Ben + Nora by default; any pair fits). Reference: dialogue/ref/hilltop_ref_valley_city.png.
// The pair sit on a fallen log at a ridge edge, facing OUT and DOWN over a deep valley: thousands of warm/white house lights scattered over terraced hillsides in organic
// clusters (dark forest gaps), a few roads with slow car streaks, then a far moonlit snow-capped range with haze at its base, deep navy sky with fine stars.
// Light: faint cool moonlight from behind (rim on shoulders, snow faces), a small warm bonfire low in front of the log (readable faces in close shots), faint cool face fill.
// Hero wide is from behind: the view dominates, the pair are silhouettes. Talking shots: torsos turned ~46 deg toward each other, camera behind-side 3/4.
import { THREE, PAL, rng, V3, sstep, nat, surv } from "/core/world.js";
import { makeSky2, makeTerrainLOD, makeRoadCars, makeWindows, makeMist, makeFireflies, makeCity } from "/core/fx2.js";
import { makeEmbers } from "/core/fx.js";

const FIRE = [0.0, 0.55]; // small bonfire low in front of the log
const vn = (x, z) => { const h = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }; const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz); return (h(xi, zi) * (1 - u) + h(xi + 1, zi) * u) * (1 - w) + (h(xi, zi + 1) * (1 - u) + h(xi + 1, zi + 1) * u) * w; };
const fbm2 = (x, z) => 0.5 * vn(x, z) + 0.25 * vn(x * 2.03 + 5, z * 2.03 + 9) + 0.125 * vn(x * 4.1 + 3, z * 4.1 + 1) + 0.0625 * vn(x * 8.3 + 7, z * 8.3 + 2);
export function terrainH(x, z) {
  const sS = Math.min(1, Math.max(0, (-1.6 - z) / 380)), slope = -135 * (1 - Math.pow(1 - sS, 1.8)), rise = 250 * sstep(-800, -1300, z) * (0.55 + 0.45 * Math.sin(x * 0.004 + 1.0));
  const side = 230 * sstep(240, 900, Math.abs(x)) * sstep(-200, -500, z);
  const r = Math.hypot(x, z); const near = sstep(5, 30, r) * 0.4 * Math.sin(x * 0.31 + 1.3) * Math.cos(z * 0.27 - 0.4);
  const far = sstep(80, 1100, r) * (9 * (fbm2(x * 0.012, z * 0.012) - 0.5) * 2 + 4 * Math.sin((slope + rise) * 0.5));
  return slope + Math.max(rise, side) + near + (z < -150 ? far : 0);
}
function groundColor(x, z, h, R, c) {
  const r = Math.hypot(x, z); const f = fbm2(x * 0.02, z * 0.02);
  c.set("#34503F").lerp(new THREE.Color("#1F3430"), sstep(5, 22, r)).lerp(new THREE.Color("#0C1524"), sstep(-1.6, -250, z)); // dark valley
  if (z < -120 && f > 0.55) c.lerp(new THREE.Color("#0C1E1F"), 0.7); c.multiplyScalar(1 + (R() - 0.5) * 0.2);
}
// far range: foothills + snow peaks, faceted, shaded by the moonlight direction, haze at the base (fog off, own haze)
function makeFarRange(scene, R, L) {
  const x0 = -7000, x1 = 7000, z0 = -1140, z1 = -4700, nx = 170, nz = 30; const H = (x, z) => { const t = sstep(-1100, -2600, z); const ridge = 1 - Math.abs(2 * fbm2(x * 0.0016 + 2, z * 0.0009) - 1); const chain = sstep(-3100, -3900, z) * sstep(-4650, -4250, z); const win = 0.55 + 0.45 * Math.sin(x * 0.00055 + 0.7); return 90 * t + 120 * t * fbm2(x * 0.002, z * 0.002) + (370 * Math.pow(ridge, 3.0) + 125 * fbm2(x * 0.004 + 9, z * 0.004)) * chain * win - 40; };
  const pos = [], col = []; const c = new THREE.Color(), rock = new THREE.Color("#1C2A4A"), snow = new THREE.Color("#A9C2E6").multiplyScalar(0.95), haze = new THREE.Color("#101B3A"), shade = new THREE.Color("#2C4170"); const Ld = V3(-0.75, 0.42, 0.5).normalize();
  const px = i => x0 + (x1 - x0) * i / nx, pz = j => z0 + (z1 - z0) * j / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const q = [[px(i), pz(j)], [px(i + 1), pz(j)], [px(i + 1), pz(j + 1)], [px(i), pz(j + 1)]].map(([x, z]) => [x, H(x, z), z]);
    for (const tri of [[0, 1, 2], [0, 2, 3]]) { const [a, b, d] = tri.map(k => q[k]); const e1 = V3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), e2 = V3(d[0] - a[0], d[1] - a[1], d[2] - a[2]); let n = e1.cross(e2).normalize(); if (n.y < 0) n.negate(); const hm = (a[1] + b[1] + d[1]) / 3, cz = (a[2] + b[2] + d[2]) / 3;
      const snowAmt = sstep(130, 230, hm + 40 * (vn(a[0] * 0.01, cz * 0.01) - 0.5)); const sh = Math.pow(Math.max(0, n.dot(Ld)), 0.8); c.copy(rock).lerp(snow, snowAmt); if (snowAmt > 0.4) { c.copy(shade).lerp(snow, sh); c.lerp(rock, 1 - snowAmt); } else c.multiplyScalar(0.55 + 0.7 * sh);
      for (const p of [a, b, d]) { const cc = c.clone().lerp(haze, (1 - sstep(0, 260, p[1])) * 0.92); pos.push(p[0], p[1], p[2]); col.push(cc.r, cc.g, cc.b); } } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })); m.frustumCulled = false; m.name = "farRange"; scene.add(m); return m;
}

export default {
  id: "hilltop_city", pair: ["arjun", "meera"], seed: 4021, terrainH, moonDir: V3(0.5, 0.52, 0.69), fog: ["#0F1A38", 30, 5200], camFar: 9000, bg: "#070D22",
  tints: { Green: "#29484A", DarkGreen: "#1B3440", Wood: "#7A6150", DarkWood: "#5A4638", LightWood: "#A08064", Rock: "#7D858C", Fire: "#F3BF63" },
  makeSky({ U, scene }) { makeSky2(U, scene, { top: "#050A1C", hor: "#14224A", glow: { c: "#2B4A86", a: 0.18, h: 0.12, dir: V3(0, 0, -1) }, stars: 1700, seed: 31, starBright: 0.6, radius: 8000 }); },
  lights: { key: { pos: V3(FIRE[0], 0.55, FIRE[1]), color: "#F4C58A", decay: 2, shadow: { size: 2048, near: 0.2, far: 10, bias: -0.0015, normalBias: 0.02, radius: 4 } }, rim: { color: "#9DB6D4", i: 1.5, shadow: { extent: 4.5 } }, hemi: { sky: 0x3d5088, ground: 0x2a3a4c, i: 1.6 }, face: { color: "#B8C8DC", i: 0.75 }, rimOTS: 2.4 },
  // log along x, both facing out over the valley (-z), turned ~46 deg toward each other
  seats: { A: { kind: "stone", x: -0.62, z: 0, yaw: Math.PI, back: -0.06, files: ["Rock_Moss_3", "Rock_Moss_6", "Rock_Moss_1", "Rock_Moss_5", "Rock_Moss_2", "Rock_Moss_4", "Rock_Moss_7"] }, B: { kind: "stone", x: 0.62, z: 0.03, yaw: Math.PI, back: -0.06, files: ["Rock_Moss_3", "Rock_Moss_6", "Rock_Moss_1", "Rock_Moss_5", "Rock_Moss_2", "Rock_Moss_4", "Rock_Moss_7"] } }, torsoTurn: 0.75, headYaw: 100,
  glanceTarget: V3(0.2, -4, -30), rig: { mcuPartner: 0.95, otsMM: [42, 38, 34], otsCam: [0.7, 2.4, 0.7] },
  wide2(ar) { const dof = { aperture: 0.0009, maxblur: 0.004 }; return ar < 1 ? { pos: V3(-0.8, 2.2, 3.6), tgt: V3(1.0, 0.8, -4.4), mm: 24, focusOn: V3(0, 1.0, 0), dof } : { pos: V3(-1.1, 2.3, 4.3), tgt: V3(1.3, 0.8, -4.4), mm: 25, focusOn: V3(0, 1.0, 0), dof }; },
  insert() { return { pos: V3(0.6, 1.4, -0.4), tgt: V3(0.0, -6, -110), mm: 45, focusOn: null }; },
  fg: {
    wide2: [[nat("Grass"), 0.2, 1.2, -0.9], [nat("Plant_2"), 0.22, 1.6, 1.0], [nat("Grass_2"), 0.2, 1.1, 0.5]],
    seat: [], ots: [[nat("Grass"), 0.2, 1.0, 0.05]], insert: [[nat("Grass_2"), 0.2, 1.2, -0.5], [nat("Plant_3"), 0.22, 1.5, 0.6]], mcu: [[nat("Plant_3"), 0.4, 1.1, 0.22], [nat("Grass"), 0.25, 0.9, -0.25]],
  },
  async build(ctx) {
    const { scene, R, U, normP, toonifyP, loadFBX, place, casters, key, TH, moonDir } = ctx; const scatter = (u, items, o) => ctx.scatter(u, items, o);
    scene.add(makeTerrainLOD({ H: TH, color: groundColor, R, rings: [{ half: 36, cell: 1.5 }, { half: 144, cell: 6 }, { half: 1152, cell: 24 }] }));
    makeFarRange(scene, R, moonDir);
    // ---- the valley: thousands of house lights on terraced slopes, in organic clusters, dark forest gaps ----
    const Rl = rng(612); const wins = [];
    // 9 clusters along slope contours: [cx, cz, rx, rz, n, houses]; near clusters get instanced house boxes with lit window quads, far ones stay points; dark forest between
    const CL = [[-90, -38, 70, 30, 360, 34], [85, -48, 80, 34, 380, 38], [-30, -95, 130, 40, 520, 40], [150, -130, 120, 40, 440, 30], [-170, -190, 150, 45, 560, 26], [40, -260, 170, 50, 700, 0], [-120, -380, 180, 55, 700, 0], [140, -520, 200, 60, 640, 0], [-20, -720, 220, 65, 520, 0]];
    const boxes = [], quads = [];
    for (const [cx, cz, rx, rz, n, nh] of CL) {
      let k = 0, tr = 0; while (k < n && tr++ < n * 40) { const a = Rl() * 6.283, rr = Math.sqrt(Rl()); const x = cx + Math.cos(a) * rr * rx, z = cz + Math.sin(a) * rr * rz; const h = TH(x, z); if (fbm2(x * 0.05, z * 0.05) < 0.3) continue; const ter = (h + 400) / 4.0; if (Math.abs(ter - Math.round(ter)) > 0.3) continue; wins.push(x, h + 1.6, z, Rl() < 0.3 ? 1 : 0); k++; }
      k = 0; tr = 0; while (k < nh && tr++ < nh * 60) { const a = Rl() * 6.283, rr = Math.sqrt(Rl()); const x = cx + Math.cos(a) * rr * rx, z = cz + Math.sin(a) * rr * rz; const h = TH(x, z); const ter = (h + 400) / 6.0; if (Math.abs(ter - Math.round(ter)) > 0.28) continue; const bw = 6 + Rl() * 4, bd = 6 + Rl() * 3, bh = 4.5 + Rl() * 3, yaw = (Rl() - 0.5) * 0.5; boxes.push([x, h - 0.4, z, bw, bh + 0.4, bd, yaw, 0.75 + Rl() * 0.5]);
        const cols = Math.max(1, Math.floor(bw / 2.7)), rows = Math.max(1, Math.floor(bh / 2.8)); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (Rl() < 0.3) continue; const u = (c + 0.5) / cols - 0.5; quads.push([x + Math.cos(yaw) * u * bw * 0.8 + Math.sin(yaw) * (bd / 2 + 0.06), h + 1.6 + r * 2.6, z - Math.sin(yaw) * u * bw * 0.8 + Math.cos(yaw) * (bd / 2 + 0.06), yaw, Rl() < 0.3 ? 1 : 0]); } k++; }
    }
    { const bg = new THREE.BoxGeometry(1, 1, 1); bg.translate(0, 0.5, 0); const im = new THREE.InstancedMesh(bg, new THREE.MeshLambertMaterial({ color: "#26365A", flatShading: true }), boxes.length); const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), col = new THREE.Color();
      boxes.forEach((b, i) => { Q.setFromEuler(new THREE.Euler(0, b[6], 0)); M.compose(new THREE.Vector3(b[0], b[1], b[2]), Q, new THREE.Vector3(b[3], b[4], b[5])); im.setMatrixAt(i, M); im.setColorAt(i, col.setScalar(b[7])); }); im.frustumCulled = false; scene.add(im);
      const qg = new THREE.PlaneGeometry(1, 1), qm = new THREE.MeshBasicMaterial({ color: "#FFFFFF", fog: false }), qi = new THREE.InstancedMesh(qg, qm, quads.length); const warm = new THREE.Color("#F6C46A").multiplyScalar(3.0), cool = new THREE.Color("#D6EEF0").multiplyScalar(2.8);
      quads.forEach((q, i) => { Q.setFromEuler(new THREE.Euler(0, q[3], 0)); M.compose(new THREE.Vector3(q[0], q[1], q[2]), Q, new THREE.Vector3(0.95, 1.15, 1)); qi.setMatrixAt(i, M); qi.setColorAt(i, q[4] ? cool : warm); }); qi.frustumCulled = false; qi.layers.enable(ctx.BLOOM_LAYER); scene.add(qi); }
    makeWindows(U, scene, wins, { warm: "#F3BF63", cool: "#C8E6E0", size: 4.4, pOn: 0.97, period: [60, 220], atten: 560, gain: 2 });
    // a few roads on the valley floor with slow car streaks
    makeRoadCars(U, scene, { pts: [[-700, -134, -330], [-300, -135, -380], [0, -135, -350], [320, -135, -420], [760, -135, -380]], width: 12, n: 14, speed: [9, 15], len: 16, seed: 5, color: "#0A1020" });
    makeRoadCars(U, scene, { pts: [[-120, -135, -250], [-60, -135, -450], [40, -135, -620], [90, -135, -860]], width: 10, n: 9, speed: [8, 12], len: 16, seed: 9, color: "#0A1020" });
    makeMist(U, scene, { y: -96, color: "#1B2C52", alpha: 0.16, speed: [1.0, 0.4], scale: 0.004, fade: [140, 520], center: [0, -520], size: 1700, seed: 6 });
    // ---- shelf dressing: grass, ferns, rocks, edge boulders, a few framing pines ----
    const cover = {}; const add = (f, x, z, h, extra = {}) => (cover[f] ??= []).push({ x, z, h, yaw: R() * 6.28, tint: 0.85 + R() * 0.3, ...extra });
    const ring = (n, r0, r1, f, ang = [0, 6.283]) => { for (let i = 0; i < n; i++) { const a = ang[0] + R() * (ang[1] - ang[0]), r = r0 + R() * (r1 - r0); f(Math.cos(a) * r, Math.sin(a) * r, i, a); } };
    ring(460, 1.2, 9, (x, z) => { if (z > -1.5 && !(Math.abs(x) < 1.6 && Math.abs(z) < 0.9)) add(R() < 0.5 ? "Grass" : "Grass_Short", x, z, 0.2 + R() * 0.28); });
    ring(90, 1.6, 9, (x, z) => { if (z > -1.5 && !(Math.abs(x) < 1.6 && Math.abs(z) < 0.9)) add(R() < 0.5 ? "Grass" : "Grass_2", x, z, 0.35 + R() * 0.35, { tint: 1.1 }); });
    ring(22, 3, 12, (x, z) => { if (z > -1.5 && z < 6) add(`Plant_${1 + Math.floor(R() * 5)}`, x, z, 0.4 + R() * 0.4); });
    ring(9, 2.5, 8, (x, z) => { if (z > -1.5 && z < 3 && Math.abs(x) > 1.9) add(`Rock_${1 + Math.floor(R() * 7)}`, x, z, 0.18 + R() * 0.3); });
    ring(8, 5, 14, (x, z) => { if (z > -1.5 && z < 1) add("Flowers", x, z, 0.3 + R() * 0.12); });
    for (const [x, z, h] of [[-1.4, -1.8, 0.35], [1.2, -1.9, 0.4], [3.6, -2.2, 0.7], [-3.6, -2.1, 0.6], [-6.4, -2.8, 0.9], [6.6, -2.6, 0.8]]) add(`Rock_Moss_${1 + Math.floor(R() * 7)}`, x, z, h, { y: TH(x, z) - 0.05 });
    for (let i = 0; i < 70; i++) add(R() < 0.5 ? "Grass" : "Grass_2", (R() - 0.5) * 14, -0.9 - R() * 0.7, 0.35 + R() * 0.3, { tint: 1.1 }); for (let i = 0; i < 60; i++) add(R() < 0.5 ? "Grass" : "Grass_Short", (R() < 0.5 ? -1 : 1) * (0.8 + R() * 1.4) + (R() - 0.5) * 0.6, 0.6 + R() * 1.4, 0.3 + R() * 0.3, { tint: 1.1 });
    for (const [f, items] of Object.entries(cover)) { if (/Grass|Plant/.test(f)) items.forEach(it => { it.h *= 0.4; }); }
    for (const [f, items] of Object.entries(cover)) await scatter(nat(f), items, { amp: /Grass|Plant|Flowers/.test(f) ? 0.05 : 0.03 });
    const trees = {}; for (let i = 0; i < 260; i++) { const x = (Rl() - 0.5) * 500, z = -8 - Rl() * 150; if (Math.abs(x) < 10 && z > -40) continue; (trees[`PineTree_${1 + Math.floor(Rl() * 5)}`] ??= []).push({ x, z, h: 7 + Rl() * 8, yaw: Rl() * 6.28, tint: 0.5 + Rl() * 0.25 }); }
    const addTree = (f, x, z, h, tint = 1) => (trees[f] ??= []).push({ x, z, h, yaw: R() * 6.28, tint });
    for (const [f, x, z, h] of [["PineTree_2", -7.5, -1.5, 11], ["PineTree_4", -11.5, 1.0, 13], ["PineTree_1", 8.2, -2.0, 11.5], ["PineTree_5", 12.5, 0.5, 13], ["PineTree_3", -16, -3, 12], ["PineTree_2", -2.4, -9.5, 7], ["PineTree_2", -13, -5, 12], ["PineTree_4", 13, -5.5, 12.5], ["PineTree_1", -16, -12, 11], ["PineTree_5", 17, -14, 12], ["PineTree_3", 22, -8, 13]]) addTree(f, x, z, h, 1.15);
    for (let i = 0; i < 40; i++) { const side = R() < 0.5 ? -1 : 1, x = side * (14 + R() * 70), z = 14 - R() * 40; if (z < -1.5) continue; addTree(`PineTree_${1 + Math.floor(R() * 5)}`, x, z, 8 + R() * 6, 0.75 + R() * 0.3); }
    for (const [f, items] of Object.entries(trees)) await scatter(nat(f), items, { amp: 0.09 });
    // ---- small bonfire low in front of the log (the warm source) ----
    const fire = normP(toonifyP(await loadFBX(surv("Bonfire_Fire")), "nat"), 0.2); fire.position.set(FIRE[0], 0.04, FIRE[1]); scene.add(fire);
    const flames = []; fire.traverse(o => { if (o.isMesh && /fire/i.test([].concat(o.material)[0].name)) flames.push(o); }); flames.forEach(f => { f.userData.s0 = f.scale.clone(); });
    makeEmbers(U, rng(91), scene); { const e = scene.getObjectByName("embers"); e.position.set(FIRE[0], 0, FIRE[1]); e.scale.setScalar(0.1); }
    makeFireflies(U, scene, { anchors: [[-3.2, 0.6, -2.2], [2.6, 0.8, -2.6], [4.6, 0.5, 0.6], [-5.0, 0.9, 1.0], [0.8, 1.1, -3.6], [-1.8, 0.5, -3.8]], color: "#E3D26A", size: 8, spread: [1.2, 0.3, 0.8], seed: 12 });
    return {
      update(t) { const f = 1 + 0.07 * Math.sin(t * 9 + 1.1) + 0.05 * Math.sin(t * 17 + 2.3) + 0.035 * Math.sin(t * 31 + 0.4); key.intensity = 4.2 * f; flames.forEach(m => m.scale.set(m.userData.s0.x * (0.98 + 0.03 * Math.sin(t * 7.1)), m.userData.s0.y * (1 + 0.08 * Math.sin(t * 11 + 1) + 0.05 * Math.sin(t * 19 + 2)), m.userData.s0.z * (0.98 + 0.03 * Math.cos(t * 6.3)))); },
    };
  },
};
