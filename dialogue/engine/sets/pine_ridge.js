// pine_ridge (any pair; default dadu + meera): a rocky ridge top among tall pines, the pair on a fallen moss log at the edge, looking over a deep valley of layered pine
// ridges in drifting mist. Milky Way band across the sky, slow star field, a shooting star at most once a minute (period 57 s). Cool and lonely; one warm accent =
// a far cabin window across the valley. Key = starlight/moon rim from behind + cool face fill from the camera side.
import { THREE, PAL, rng, V3, sstep, nat, surv, bld } from "/core/world.js";
import { makeSky2, makeShootingStar, makeTerrainLOD, makeMist, makeRidgeStrip, makeWindows } from "/core/fx2.js";

export function terrainH(x, z) {
  const kz = sstep(-2.6, -42, z), side = sstep(16, 60, Math.abs(x)) * 0.8; const k = Math.max(kz, side);
  const r = Math.hypot(x, z); const amp = sstep(4, 22, r) * 0.55;
  const n = Math.sin(x * 0.37 + 1.1) * Math.cos(z * 0.29 - 0.7) + 0.5 * Math.sin(x * 0.81 + z * 0.67) + 0.25 * Math.sin(x * 1.9 - z * 1.4);
  return -75 * k + amp * n * 0.6 * (1 - 0.5 * k);
}
function groundColor(x, z, h, R, c) {
  const r = Math.hypot(x, z); const k = Math.max(sstep(-2.6, -42, z), sstep(16, 60, Math.abs(x)) * 0.8);
  c.set("#3B4552").lerp(new THREE.Color("#2B3B3C"), sstep(2.5, 9, r) * (0.5 + 0.5 * R())).lerp(new THREE.Color("#1A2631"), k * 0.9); c.multiplyScalar(1 + (R() - 0.5) * 0.22);
}
const ridgeH = (a, b, f1, f2, ph) => x => a + b * (0.5 + 0.5 * Math.sin(x * f1 + ph)) + 0.35 * b * Math.sin(x * f2 + ph * 2.1);

export default {
  id: "pine_ridge", pair: ["dadu", "meera"], seed: 5517, terrainH, moonDir: V3(-0.3, 0.46, -0.83), fog: ["#3A5272", 18, 1150], camFar: 4000, bg: "#0C1326",
  tints: { Green: "#27464A", DarkGreen: "#1B3541", Wood: "#7A6150", DarkWood: "#5A4638", Rock: "#4C5866", Fire: "#F3BF63" },
  makeSky({ U, scene }) {
    makeSky2(U, scene, { top: "#0C1530", hor: "#3A5272", glow: { c: "#4A6C8E", a: 0.20, h: 0.16, dir: V3(0, 0, -1) }, stars: 1700, seed: 17, starBright: 1.0, milky: { n: V3(0.503, -0.606, -0.618), a: 1.15, c1: "#9CB8DC", c2: "#B79BC4", starFrac: 0.5, w: 0.085 } });
    makeShootingStar(U, scene, { period: 57, phase: 51.8, from: V3(-0.55, 0.62, -0.55), to: V3(0.05, 0.34, -0.94) });
  },
  lights: { rim: { color: "#9DB6D2", i: 1.9, shadow: { extent: 4.5 } }, hemi: { sky: 0x3b4f72, ground: 0x1a2432, i: 1.7 }, face: { color: "#C6D4E4", i: 1.0 }, rimOTS: 2.8 },
  seats: { A: { x: -0.58, z: 0, yaw: Math.PI / 2 - 0.8 }, B: { x: 0.58, z: 0, yaw: -Math.PI / 2 + 0.8 }, shared: { style: "log", file: "WoodLog_Moss", length: 2.5, dz: 0 } },
  glanceTarget: V3(0.3, 0.35, 1.6), rig: { mcuPartner: 0.95, otsMM: [72, 62, 50], otsBack: 1.9 },
  wide2(ar) { const dof = { aperture: 0.0016, maxblur: 0.008 }; return ar < 1 ? { pos: V3(0.1, 1.15, 5.4), tgt: V3(0, 1.6, 0), mm: 23, focusOn: V3(0, 0.9, 0), dof } : { pos: V3(0.3, 1.1, 4.3), tgt: V3(0, 1.5, 0), mm: 27, focusOn: V3(0, 0.9, 0), dof }; },
  insert() { return { pos: V3(1.2, 1.5, -0.5), tgt: V3(-0.4, 1.1, -200), mm: 42, focusOn: null }; },
  fg: {
    wide2: [[nat("Rock_Moss_2"), 0.38, 1.4, -1.15], [nat("Plant_2"), 0.6, 1.8, 1.2], [nat("Rock_4"), 0.3, 1.55, 0.55], [nat("Grass_2"), 0.45, 1.1, -0.35], [nat("Plant_4"), 0.5, 2.0, -1.55]],
    seat: [], ots: [[nat("Rock_Moss_3"), 0.4, 1.1, 0.4]], insert: [[nat("Rock_2"), 0.4, 1.0, -0.5], [nat("Plant_3"), 0.5, 1.6, 0.5]], mcu: [[nat("Rock_Moss_5"), 0.8, 1.0, 0.24], [nat("Plant_3"), 0.7, 1.1, -0.25]],
  },
  async build(ctx) {
    const { scene, R, U, normP, toonifyP, loadFBX, place, casters, TH } = ctx; const scatter = (u, items, o) => ctx.scatter(u, items, o);
    scene.add(makeTerrainLOD({ H: TH, color: groundColor, R, rings: [{ half: 36, cell: 1.5 }, { half: 144, cell: 6 }, { half: 1152, cell: 24 }] }));
    // layered ridges (strip silhouettes) with pines along the crest; fog supplies the atmospheric steps
    const layers = [{ z: -170, a: 4, b: 16, c: "#101A2B", n: 70, h: 15, ph: 0.4 }, { z: -300, a: 14, b: 26, c: "#142034", n: 90, h: 24, ph: 1.7 }, { z: -480, a: 24, b: 34, c: "#18263C", n: 110, h: 34, ph: 3.1 }, { z: -720, a: 36, b: 50, c: "#1C2C44", n: 120, h: 50, ph: 4.4 }];
    const rr = rng(2024); const crestPines = {};
    layers.forEach((L, i) => { const hp = ridgeH(L.a, L.b, 0.011 + i * 0.002, 0.037 + i * 0.006, L.ph); L.hp = hp; makeRidgeStrip(scene, { z: L.z, hp, x0: -1300, x1: 1300, step: 26, color: L.c, R: rr });
      for (let k = 0; k < L.n * 2; k++) { const x = -1250 + rr() * 2500; const f = `PineTree_${1 + Math.floor(rr() * 5)}`; (crestPines[f] ??= []).push({ x, z: L.z + (rr() - 0.5) * 18, y: hp(x) - 1.0, h: L.h * (0.55 + 0.6 * rr()), yaw: rr() * 6.28, tint: 0.9 + 0.3 * rr() }); } });
    for (const [f, items] of Object.entries(crestPines)) await scatter(nat(f), items, { amp: 0.0 });
    // far cabin on the second ridge with one warm lit window (the warm accent)
    { const cz = -300, cx = -170; const cab = await ctx.loadFBX(bld("1Story_GableRoof_Mat")); const o = normP(cab, 8.5); o.traverse(m => { if (m.isMesh) { const ms = [].concat(m.material).map(mm => { const t = new THREE.MeshLambertMaterial({ color: new THREE.Color("#1C2638"), flatShading: true }); return t; }); m.material = Array.isArray(m.material) ? ms : ms[0]; } }); o.position.set(cx, layers[1].hp(cx) - 0.5, cz + 6); o.rotation.y = 0.15; scene.add(o);
      makeWindows(U, scene, [cx - 1.2, layers[1].hp(cx) + 2.6, cz + 12, 0, cx + 1.1, layers[1].hp(cx) + 2.6, cz + 12, 0], { size: 4.2, pOn: 1.0, period: [99999, 99999] }); }
    // mist: a sea of valley fog below eye level, two drifting layers
    makeMist(U, scene, { y: -4, color: "#4A607E", alpha: 0.62, speed: [1.6, 0.5], scale: 0.009, fade: [14, 70], center: [0, -330], size: 1500, seed: 1 });
    makeMist(U, scene, { y: -14, color: "#3E5472", alpha: 0.6, speed: [-1.1, 0.7], scale: 0.006, fade: [12, 60], center: [0, -300], size: 1500, seed: 2 });
    makeMist(U, scene, { y: 3.5, color: "#3A4E68", alpha: 0.32, speed: [0.9, 0.3], scale: 0.004, fade: [90, 240], center: [0, -420], size: 1900, seed: 3 });
    // ridge-top dressing: boulders, ferns, grass, moss
    const cover = {}; const add = (f, x, z, h, extra = {}) => (cover[f] ??= []).push({ x, z, h, yaw: R() * 6.28, tint: 0.85 + R() * 0.3, ...extra });
    const ring = (n, r0, r1, f) => { for (let i = 0; i < n; i++) { const a = R() * 6.283, r = r0 + R() * (r1 - r0); f(Math.cos(a) * r, Math.sin(a) * r, i, a); } };
    ring(26, 3.5, 11, (x, z) => { if (z > -2.6 && Math.abs(z) < 7 && !(Math.abs(x) < 2 && z < 1.6)) add(`Rock_${1 + Math.floor(R() * 7)}`, x, z, 0.35 + R() * 0.8); });
    ring(14, 4, 12, (x, z) => { if (z > -2.6) add(`Rock_Moss_${1 + Math.floor(R() * 7)}`, x, z, 0.5 + R() * 0.9); });
    ring(70, 2.4, 13, (x, z) => { if (z > -2.7 && !(Math.abs(x) < 1.8 && z > -0.7 && z < 1.3)) add(R() < 0.5 ? "Grass" : "Grass_Short", x, z, 0.18 + R() * 0.26); });
    ring(34, 3, 13, (x, z) => { if (z > -2.7) add(`Plant_${1 + Math.floor(R() * 5)}`, x, z, 0.35 + R() * 0.45); });
    ring(8, 4, 10, (x, z) => { if (z > -2.7) add(["Bush_1", "Bush_2"][Math.floor(R() * 2)], x, z, 0.7 + R() * 0.5); });
    for (const [x, z, h] of [[-1.3, -2.8, 0.6], [0.9, -3.2, 0.9], [2.6, -3.6, 1.1], [-3.2, -3.4, 1.0], [-5.8, -4.2, 1.4], [5.9, -4.8, 1.3], [-8.5, -6.5, 1.9], [8.8, -7.5, 2.1]]) add(`Rock_Moss_${1 + Math.floor(R() * 7)}`, x, z, h, { y: TH(x, z) - 0.06 });
    ring(40, 4, 12, (x, z) => { if (z < -2.7 && z > -30) add(R() < 0.6 ? "Grass_2" : "Plant_2", x, z, 0.5 + R() * 0.5); });
    for (const [f, items] of Object.entries(cover)) await scatter(nat(f), items, { amp: /Grass|Plant/.test(f) ? 0.05 : 0.02 });
    // tall pines: left and right of the pair on the ridge, more down the slopes
    const trees = {}; const addTree = (f, x, z, h, tint = 1) => (trees[f] ??= []).push({ x, z, h, yaw: R() * 6.28, tint });
    for (const [f, x, z, h] of [["PineTree_2", -10.5, -1.5, 12], ["PineTree_4", -14.5, -4.5, 17.5], ["PineTree_1", 11, -2, 13], ["PineTree_5", 13.0, -4.5, 18], ["PineTree_3", -4.8, -7.0, 11], ["PineTree_2", 5.6, -8.4, 12]]) addTree(f, x, z, h, 1.18);
    for (let i = 0; i < 70; i++) { const x = (R() - 0.5) * 150, z = -6 - R() * 60; if (Math.abs(x) < 2.5 && z > -16) continue; addTree(`PineTree_${1 + Math.floor(R() * 5)}`, x, z, 8 + R() * 9, 0.7 + R() * 0.3); }
    for (let i = 0; i < 40; i++) { const side = R() < 0.5 ? -1 : 1, x = side * (16 + R() * 60), z = 12 - R() * 70; addTree(`PineTree_${1 + Math.floor(R() * 5)}`, x, z, 9 + R() * 8, 0.75 + R() * 0.3); }
    for (const [f, items] of Object.entries(trees)) await scatter(nat(f), items, { amp: 0.09 });
    return {};
  },
};
