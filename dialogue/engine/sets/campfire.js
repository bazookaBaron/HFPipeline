// campfire set (dadu + rohan by default): ported from spike1/world.js, content and RNG order unchanged. Pure data + the set's own life.
import { THREE, PAL, rng, V3, sstep, nat, surv } from "/core/world.js";
import { makeSky, makeEmbers, makeSmoke } from "/core/fx.js";

export function terrainH(x, z) {
  const r = Math.hypot(x, z); const amp = sstep(4.6, 14, r) * (0.35 + 0.9 * sstep(14, 45, r));
  const n = Math.sin(x * 0.31 + 1.3) * Math.cos(z * 0.27 - 0.4) + 0.5 * Math.sin(x * 0.73 + z * 0.61) + 0.25 * Math.sin(x * 1.7 - z * 1.3);
  return amp * n * 0.55;
}
function makeTerrain(R) {
  const S = 150, N = 75; const g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, terrainH(p.getX(i), p.getZ(i)));
  const ng = g.toNonIndexed(); const pos = ng.attributes.position; const col = new Float32Array(pos.count * 3);
  const dirt = new THREE.Color("#42352B"), grass = new THREE.Color("#35533F"), floor = new THREE.Color("#1D3033"), dirt2 = new THREE.Color("#3A2F27"), c = new THREE.Color();
  for (let f = 0; f < pos.count; f += 3) {
    const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3, cz = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3, r = Math.hypot(cx, cz);
    const j = (R() - 0.5) * 0.18;
    c.copy(dirt).lerp(dirt2, Math.min(1, r / 3.2)).lerp(grass, sstep(2.6, 4.8, r) * (0.6 + 0.4 * R())).lerp(floor, sstep(7, 18, r));
    c.multiplyScalar(1 + j);
    for (let k = 0; k < 3; k++) { col[(f + k) * 3] = c.r; col[(f + k) * 3 + 1] = c.g; col[(f + k) * 3 + 2] = c.b; }
  }
  ng.setAttribute("color", new THREE.BufferAttribute(col, 3)); ng.computeVertexNormals();
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }); const mesh = new THREE.Mesh(ng, m); mesh.receiveShadow = true; mesh.name = "terrain"; return mesh;
}

export default {
  id: "campfire", pair: ["dadu", "rohan"], seed: 1109, terrainH, moonDir: V3(0.22, 0.52, -0.82), fog: ["#17242F", 5, 64], camFar: 400,
  makeSky({ U, scene, moonDir }) { makeSky(U, rng(31), scene, moonDir); },
  lights: { key: { pos: V3(0, 0.62, 0), color: "#F6C792", decay: 2, shadow: { size: 2048, near: 0.3, far: 9, bias: -0.0015, normalBias: 0.02, radius: 4 } }, rim: { color: PAL.moon, i: 2.0 }, hemi: { sky: 0x3d566e, ground: 0x1c2a36, i: 1.5 }, face: { color: "#C9D3DC", i: 0.8 }, rimOTS: 3.0 },
  seats: { A: { kind: "stump", x: -1.7, z: 0, yaw: Math.PI / 2 - 0.35 }, B: { kind: "log", x: 1.7, z: 0, yaw: -Math.PI / 2 + 0.35 } },
  rig: { otsSpan: 3.4 }, otsFX: { hideFlame: true, fireScale: 0.3 },
  wide2(ar) { const dof = { aperture: 0.0022, maxblur: 0.010 }; return ar < 1 ? { pos: V3(0.2, 1.45, 5.0), tgt: V3(0, 1.0, 0), mm: 22, focusOn: V3(0, 0.8, 0), dof } : { pos: V3(0.3, 1.2, 3.8), tgt: V3(0, 0.95, 0), mm: 26, focusOn: V3(0, 0.8, 0), dof }; },
  insert() { return { pos: V3(0.45, 0.95, 2.1), tgt: V3(0, 0.85, 0), mm: 50, focusOn: V3(0, 0.8, 0), dof: { aperture: 0.006, maxblur: 0.02 } }; },
  fg: {
    wide2: [[nat("Grass"), 0.7, 1.3, -1.0], [nat("Plant_2"), 0.75, 1.7, 1.15], [nat("Rock_3"), 0.3, 1.5, 0.35], [nat("Grass_2"), 0.55, 1.1, -0.35], [nat("Grass"), 0.6, 1.2, 0.8], [nat("Plant_4"), 0.6, 2.0, -1.5]],
    seat: [], ots: [[nat("Grass"), 0.55, 1.0, 0.0]], insert: [[nat("Rock_2"), 0.35, 0.8, -0.35], [nat("Grass_Short"), 0.4, 0.9, 0.3]], mcu: [[nat("Bush_2"), 1, 1.05, -0.2], [nat("Plant_3"), 1, 1.1, 0.22]],
  },
  async build(ctx) {
    const { scene, R, U, normP, toonifyP, loadFBX, place, casters, key, THREE: T, TH } = ctx; const terrainH = TH;
    const scatter = (u, items, o) => ctx.scatter(u, items, o);
    const tentGlow = { intensity: 0 };
    const base = 20, rr = rng(7), ph = [rr() * 6.28, rr() * 6.28, rr() * 6.28];
    const flick = tt => 1 + 0.07 * Math.sin(tt * 9 + ph[0]) + 0.05 * Math.sin(tt * 17 + ph[1]) + 0.035 * Math.sin(tt * 31 + ph[2]);
    const cK = new THREE.Color("#F6C792"), cE = new THREE.Color(PAL.ember);
  // terrain
  const terrain = makeTerrain(R); scene.add(terrain);
  // fire: logs + flames; pit rocks
  const fire = normP(toonifyP(await loadFBX(surv("Bonfire_Fire")), "nat"), 1.0); fire.scale.multiplyScalar(1); scene.add(fire);
  const flames = []; fire.traverse(o => { if (o.isMesh && /fire/i.test([].concat(o.material)[0].name)) flames.push(o); });
  flames.forEach(f => { f.userData.s0 = f.scale.clone(); });
  const pitRocks = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + R() * 0.2; const o = normP(toonifyP(await loadFBX(nat(`Rock_${1 + (i % 7)}`)), "nat"), 0.26 + R() * 0.12); o.position.set(Math.cos(a) * 0.78, 0, Math.sin(a) * 0.78); o.rotation.y = R() * 6.28; scene.add(o); casters.push(o); }
  // clearing props
  for (let i = 0; i < 4; i++) { const stack = [[-2.35, -1.1, 0.0], [-2.35, -1.38, 0.35], [-2.5, -1.24, 0.1], [-2.4, -1.25, 0.6]]; const [x, z, y] = [stack[i][0], stack[i][1], i === 3 ? 0.17 : 0]; await place(surv("WoodLog"), 0.17, x, z, 0.35 + i * 0.1, "nat", y); }
  await place(nat("Rock_3"), 0.16, 0.82, -0.98, 1.0); await place(nat("Rock_5"), 0.16, 1.12, -0.86, 2.0); await place(surv("Pot"), 0.28, 0.97, -0.92, 0.5, "nat", 0.15);
  const axe = await place(surv("Axe"), 0.85, -2.52, 0.62, 2.2); axe.rotation.z = 0.28; axe.position.y = 0.06;
  await place(surv("Backpack"), 0.5, 2.75, 0.75, -0.6); await place(surv("WaterBottle_1"), 0.26, 2.3, 0.9, 0.3);
  const tent = await place(surv("Tent"), 1.9, -5.0, -4.2, 0.95, "tent"); // tent glow inside the fabric
  // ground cover + trees (ring plan 10c)
  const ring = (n, r0, r1, f) => { for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, r = r0 + R() * (r1 - r0); f(Math.cos(a) * r, Math.sin(a) * r, i, a); } };
  const camGap = (x, z, rmax) => { const r = Math.hypot(x, z); return r < rmax && z > 1.5 && Math.abs(x) < 0.55 * z + 2.2; }; // keep the wide-camera wedge free of trunks
  const trees = { Pine: [], Common: [], Birch: [], Willow: [] }; const tcount = { r1: 0, r2: 0, r3: 0 };
  const addTree = (x, z, ringId, hb, pPine) => { if (camGap(x, z, 16)) return; const u = R(); const type = u < pPine ? "Pine" : u < pPine + (1 - pPine) * 0.6 ? "Common" : "Birch";
    trees[type].push({ n: 1 + Math.floor(R() * 5), x, z, yaw: R() * 6.28, h: hb * (type === "Pine" ? 1.0 : 0.82) * (0.85 + R() * 0.45), tint: 0.82 + R() * 0.3 }); tcount[ringId]++; };
  let guard = 0; while (tcount.r1 < 18 && guard++ < 999) { const a = R() * 6.28, r = 8 + R() * 4; addTree(Math.cos(a) * r, Math.sin(a) * r, "r1", 6.4, 0.45); }
  guard = 0; while (tcount.r2 < 40 && guard++ < 999) { const a = R() * 6.28, r = 12.5 + R() * 10; addTree(Math.cos(a) * r, Math.sin(a) * r, "r2", 8.2, 0.62); }
  guard = 0; while (tcount.r3 < 74 && guard++ < 999) { const a = R() * 6.28, r = 22.5 + R() * 27; addTree(Math.cos(a) * r, Math.sin(a) * r, "r3", 10.5, 0.7); }
  for (const [x, z, h, n] of [[0.9, -5.2, 6.8, 2], [3.9, -4.4, 6.2, 4], [-2.9, -5.9, 6.5, 3]]) (trees.Pine ??= []).push({ n, x, z, yaw: R() * 6.28, h, tint: 1.25 });
  const byFile = {}; for (const [type, arr] of Object.entries(trees)) for (const it of arr) { const f = type === "Pine" ? `PineTree_${it.n}` : type === "Common" ? `CommonTree_${it.n}` : type === "Birch" ? `BirchTree_${it.n}` : `Willow_${it.n}`; (byFile[f] ??= []).push(it); }
  for (const [f, items] of Object.entries(byFile)) await scatter(nat(f), items, { amp: 0.09 });
  // undergrowth
  const cover = { }; const add = (f, x, z, h, extra = {}) => (cover[f] ??= []).push({ x, z, h, yaw: R() * 6.28, tint: 0.85 + R() * 0.3, ...extra });
  ring(110, 2.8, 6.2, (x, z) => add(R() < 0.5 ? "Grass_Short" : "Grass", x, z, 0.22 + R() * 0.2));
  ring(14, 4, 6.5, (x, z) => add("Flowers", x, z, 0.3 + R() * 0.15));
  ring(10, 6.2, 10.5, (x, z) => { if (!camGap(x, z, 12)) add(["Bush_1", "Bush_2", "BushBerries_1", "BushBerries_2"][Math.floor(R() * 4)], x, z, 0.8 + R() * 0.5); });
  ring(26, 5.5, 11, (x, z) => add(`Plant_${1 + Math.floor(R() * 5)}`, x, z, 0.45 + R() * 0.45));
  ring(7, 5.5, 10.5, (x, z) => add(`Rock_Moss_${1 + Math.floor(R() * 7)}`, x, z, 0.5 + R() * 0.6, {}));
  ring(2, 6, 9, (x, z) => { if (!camGap(x, z, 12)) add("WoodLog_Moss", x, z, 0.45); }); ring(2, 6, 9, (x, z) => { if (!camGap(x, z, 12)) add("TreeStump", x, z, 0.5); });
  ring(90, 2.2, 4.6, (x, z) => { if (z > -0.8) add(R() < 0.5 ? "Grass" : "Grass_Short", x, z, 0.22 + R() * 0.28, { tint: 1.1 }); });
  ring(14, 2.6, 4.8, (x, z) => { if (z > 0) add(`Plant_${1 + Math.floor(R() * 5)}`, x, z, 0.4 + R() * 0.3); });
  ring(7, 2.8, 4.6, (x, z) => { if (z > 0.5) add(`Rock_${1 + Math.floor(R() * 7)}`, x, z, 0.22 + R() * 0.25); });
  ring(110, 6, 22, (x, z) => add(R() < 0.6 ? "Grass" : "Grass_2", x, z, 0.4 + R() * 0.4));
  ring(32, 11, 24, (x, z) => add(["Bush_1", "Bush_2", "BushBerries_1"][Math.floor(R() * 3)], x, z, 0.9 + R() * 0.7));
  ring(34, 11, 24, (x, z) => add(`Plant_${1 + Math.floor(R() * 5)}`, x, z, 0.5 + R() * 0.5));
  ring(8, 10, 22, (x, z) => add(`Rock_${1 + Math.floor(R() * 7)}`, x, z, 0.5 + R() * 0.9));
  for (const [f, items] of Object.entries(cover)) await scatter(nat(f), items, { amp: /Grass|Plant|Flowers/.test(f) ? 0.045 : 0.03 });
    makeEmbers(U, rng(91), scene); makeSmoke(U, rng(92), scene);
    return {
      onShot(rc) { flames.forEach(m => { m.visible = !rc.hideFlame; }); },
      update(t, shotFX) {
        const f = flick(t); key.intensity = base * f; key.color.copy(cK).lerp(cE, Math.max(0, 1 - f) * 1.2);
        const fl = 1 + 0.08 * Math.sin(t * 11 + 1) + 0.05 * Math.sin(t * 19 + 2) + 0.03 * Math.sin(t * 5.3);
        const fs_ = shotFX.fireScale; flames.forEach(m => { m.scale.set(m.userData.s0.x * fs_ * (0.98 + 0.03 * Math.sin(t * 7.1)), m.userData.s0.y * fs_ * fl, m.userData.s0.z * fs_ * (0.98 + 0.03 * Math.cos(t * 6.3))); });
        tentGlow.intensity = 6 * (0.93 + 0.07 * Math.sin(t * 1.7));
      },
    };
  },
};
