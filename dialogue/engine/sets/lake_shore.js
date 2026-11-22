// lake_shore (any pair; default rohan + arjun): a pebble shore of a still mountain lake, the pair on an upturned log, a moored Raft beside them, pines on both banks and a far
// ridge. A low moon and the stars reflect in the water (water shader: gentle ripples, broken moon reflection, far treeline silhouette from the elevation profile).
// Life: ripples, fireflies (<= 12, the warm accent) at the reeds, a light mist drifting on the water, the raft bobbing. Cool key = moon rim + sky/lake face fill.
import { THREE, PAL, rng, V3, sstep, nat, surv } from "/core/world.js";
import { makeSky2, makeTerrainLOD, makeMist, makeWater, elevProfile, makeFireflies } from "/core/fx2.js";

const SHORE = -3.0;
export function terrainH(x, z) {
  const toWater = sstep(SHORE - 0.3, SHORE - 5.3, z); let base = 0.06 * (1 - toWater) + -2.6 * toWater;
  const bank = sstep(46, 78, Math.abs(x)) * 7.5, far = sstep(-335, -392, z) * 9;
  const r = Math.hypot(x, z); const n = Math.sin(x * 0.19 + 0.8) * Math.cos(z * 0.23 + 0.3) + 0.5 * Math.sin(x * 0.43 + z * 0.37);
  const mount = sstep(-400, -820, z) * 0.6 * (42 + 40 * (0.5 + 0.5 * Math.sin(x * 0.0065 + 1.2)) + 14 * Math.sin(x * 0.021 + 2.0) + 10 * Math.sin(x * 0.047 - z * 0.003));
  const hb = Math.max(base, bank * (0.6 + 0.4 * Math.sin(z * 0.02)), far);
  return hb + sstep(5, 26, r) * 0.35 * n * (toWater < 0.5 ? 1 : 0.2) + mount;
}
const treeH = (x, z) => ((Math.abs(x) > 52 && z > -330 && z < 14) || (z < -335 && z > -396)) ? 13 : 0;
function groundColor(x, z, h, R, c) {
  const toWater = sstep(SHORE, SHORE - 5, z); const bankk = Math.max(sstep(46, 78, Math.abs(x)), sstep(-335, -392, z)); const r = Math.hypot(x, z);
  c.set("#4B5461").lerp(new THREE.Color("#33424A"), sstep(0, 8, Math.hypot(x, z + 2)) * (0.4 + 0.6 * R())).lerp(new THREE.Color("#16222B"), toWater).lerp(new THREE.Color("#1E2C2D"), bankk * (1 - toWater * 0.0));
  if (h > 20) c.lerp(new THREE.Color("#1B2638"), sstep(20, 70, h)); c.multiplyScalar(1 + (R() - 0.5) * 0.2);
}

export default {
  id: "lake_shore", pair: ["rohan", "arjun"], seed: 7741, terrainH, moonDir: V3(0.30, 0.118, -0.945), fog: ["#2C4262", 18, 1050], camFar: 4000, bg: "#0A1224",
  tints: { Green: "#26474B", DarkGreen: "#1A3441", Wood: "#7A6150", DarkWood: "#5A4638", LightWood: "#A08064", Rock: "#56606E", Fire: "#F3BF63" },
  makeSky({ U, scene, moonDir }) { makeSky2(U, scene, { top: "#0E1A33", hor: "#2C4262", glow: { c: "#6F8FAE", a: 0.22, h: 0.14, dir: moonDir }, stars: 1300, seed: 23, moon: { dir: moonDir, size: 0.032, col: "#D6E3EF", crescent: 0, glow: 1.4 } }); },
  lights: { rim: { color: "#A9C0DA", i: 2.0, shadow: { extent: 4.5 } }, hemi: { sky: 0x3a506f, ground: 0x1c2832, i: 1.6 }, face: { color: "#C4D4E4", i: 1.0 }, rimOTS: 2.8 },
  seats: { A: { x: -0.58, z: 0, yaw: Math.PI / 2 - 0.8 }, B: { x: 0.58, z: 0, yaw: -Math.PI / 2 + 0.8 }, shared: { style: "log", file: "WoodLog", length: 2.6 } },
  glanceTarget: V3(0.3, 0.35, 1.6), rig: { mcuPartner: 0.95, otsMM: [72, 62, 50], otsBack: 1.9 },
  wide2(ar) { const dof = { aperture: 0.0016, maxblur: 0.008 }; return ar < 1 ? { pos: V3(0.1, 1.1, 5.2), tgt: V3(0, 1.5, 0), mm: 23, focusOn: V3(0, 0.9, 0), dof } : { pos: V3(0.2, 0.95, 4.3), tgt: V3(0, 1.3, 0), mm: 27, focusOn: V3(0, 0.9, 0), dof }; },
  insert() { const c = V3(0.5, 0.75, 0.6); return { pos: c, tgt: c.clone().add(V3(0.30, 0.0, -0.945).multiplyScalar(50)), mm: 50, focusOn: null }; },
  fg: {
    wide2: [[nat("Grass"), 0.6, 1.3, -1.1], [nat("Rock_3"), 0.2, 1.5, 0.55], [nat("Plant_2"), 0.55, 1.8, 1.25], [nat("Grass_2"), 0.5, 1.1, -0.4], [nat("Rock_5"), 0.16, 1.2, 0.9]],
    seat: [], ots: [[nat("Grass"), 0.5, 1.0, 0.1]], insert: [[nat("Rock_2"), 0.18, 0.9, -0.45], [nat("Grass_Short"), 0.3, 0.9, 0.35]], mcu: [[nat("Plant_3"), 0.8, 1.1, 0.24], [nat("Grass"), 0.6, 0.9, -0.25]],
  },
  async build(ctx) {
    const { scene, R, U, normP, toonifyP, loadFBX, place, casters, TH, moonDir } = ctx; const scatter = (u, items, o) => ctx.scatter(u, items, o);
    scene.add(makeTerrainLOD({ H: TH, color: groundColor, R, rings: [{ half: 36, cell: 1.5 }, { half: 144, cell: 6 }, { half: 1152, cell: 24 }] }));
    const profile = elevProfile({ H: TH, treeH, eye: V3(0, 1.1, 0) });
    makeWater(U, scene, { y: 0, deep: "#0B1722", skyTop: "#0E1A33", skyHor: "#2C4262", bank: "#0A1420", fogCol: "#2C4262", fogNear: 18, fogFar: 1050, moonDir, moonCol: "#D6E3EF", moonSize: 0.032, profile, ripple: 1.0, starDensity: 0.987 });
    makeMist(U, scene, { y: 0.28, color: "#3B5068", alpha: 0.30, speed: [0.7, 0.2], scale: 0.013, fade: [14, 70], center: [0, -150], size: 800, seed: 4 });
    makeMist(U, scene, { y: 2.5, color: "#35495F", alpha: 0.32, speed: [0.5, 0.2], scale: 0.004, fade: [120, 320], center: [0, -380], size: 1400, seed: 5 });
    // raft moored at the shore (bobs a little), paddle on the pebbles
    const raft = await place(surv("Raft"), 0.5, 3.1, -3.95, 0.42, "nat", 0.0); raft.userData.y0 = raft.position.y; await place(surv("Raft_Paddle"), 1.5, 1.95, -2.55, 1.2, "nat", 0.08);
    // shore dressing: pebbles, reeds, rocks, flowers
    const cover = {}; const add = (f, x, z, h, extra = {}) => (cover[f] ??= []).push({ x, z, h, yaw: R() * 6.28, tint: 0.85 + R() * 0.3, ...extra });
    const ring = (n, x0, x1, z0, z1, f) => { for (let i = 0; i < n; i++) f(x0 + R() * (x1 - x0), z0 + R() * (z1 - z0), i); };
    ring(260, -9, 9, SHORE - 0.1, 1.2, (x, z) => { if (!(Math.abs(x) < 1.7 && z > -0.9)) add(`Rock_${1 + Math.floor(R() * 7)}`, x, z, 0.05 + R() * 0.12, { tint: 0.45 + R() * 0.3 }); });
    ring(26, -11, 11, SHORE + 0.3, -0.6, (x, z) => add(`Rock_${1 + Math.floor(R() * 7)}`, x, z, 0.18 + R() * 0.3, { tint: 0.5 + R() * 0.3 }));
    ring(80, -10, 12, SHORE - 0.8, SHORE + 0.9, (x, z) => { if (Math.abs(x - 3.1) > 1.8) add(R() < 0.5 ? "Grass" : "Grass_2", x, z, 0.7 + R() * 0.55, { tint: 1.05 }); });
    ring(80, -12, 12, 1.4, 11, (x, z) => add(R() < 0.5 ? "Grass" : "Grass_Short", x, z, 0.2 + R() * 0.3));
    ring(26, -12, 12, 1.0, 9, (x, z) => add(`Plant_${1 + Math.floor(R() * 5)}`, x, z, 0.4 + R() * 0.4));
    ring(9, -9, 9, 2, 8, (x, z) => add("Flowers", x, z, 0.3 + R() * 0.1));
    for (const [f, items] of Object.entries(cover)) await scatter(nat(f), items, { amp: /Grass|Plant|Flowers/.test(f) ? 0.05 : 0.0 });
    // pines on both banks, the far shore, and a few near the pair
    const trees = {}; const addTree = (f, x, z, h, tint = 1) => (trees[f] ??= []).push({ x, z, h, yaw: R() * 6.28, tint });
    for (const [f, x, z, h] of [["PineTree_2", -8.8, -1.6, 15], ["PineTree_4", -13.5, 2.5, 17], ["PineTree_1", 9.6, -2.4, 14.5], ["PineTree_5", 14, 1.5, 16.5], ["PineTree_3", -18, -6, 14], ["PineTree_2", 19, -8, 15]]) addTree(f, x, z, h, 1.18);
    for (let i = 0; i < 150; i++) { const side = R() < 0.5 ? -1 : 1, x = side * (50 + R() * 90), z = 12 - R() * (i < 80 ? 120 : 330); addTree(`PineTree_${1 + Math.floor(R() * 5)}`, x, z, (10 + R() * 8) * (z < -120 ? 1.4 : 1), 0.7 + R() * 0.3); }
    for (let i = 0; i < 160; i++) { const x = (R() - 0.5) * 620, z = -340 - R() * 50; addTree(`PineTree_${1 + Math.floor(R() * 5)}`, x, z, 13 + R() * 9, 0.65 + R() * 0.25); }
    for (const [f, items] of Object.entries(trees)) await scatter(nat(f), items, { amp: 0.06 });
    // fireflies at the reeds (<= 12)
    makeFireflies(U, scene, { anchors: [[-6.2, 0.9, SHORE + 0.2], [-4.6, 1.2, SHORE - 0.3], [-8.0, 0.7, SHORE + 0.6], [-2.4, 1.5, SHORE + 0.1], [-10, 1.1, SHORE + 0.4], [5.8, 1.0, SHORE + 0.2], [7.2, 1.4, SHORE - 0.1], [9.0, 0.8, SHORE + 0.5], [6.4, 1.8, -1.5], [-5.5, 1.6, -1.2], [11, 1.2, SHORE + 0.3], [-1.0, 1.9, -2.2]], color: "#E3D26A", size: 12, spread: [1.4, 0.4, 1.0], seed: 12 });
    return { update(t) { raft.position.y = raft.userData.y0 - 0.02 + 0.014 * Math.sin(t * 0.8) + 0.008 * Math.sin(t * 1.7 + 1); raft.rotation.z = 0.012 * Math.sin(t * 0.7 + 0.5); raft.rotation.x = 0.01 * Math.sin(t * 0.9 + 2); } };
  },
};
