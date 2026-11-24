// Malacca film world: one white miniature set, three zones built at runtime from primitives (kit.js).
//   STRAIT  (origin)        Singapore Strait narrows (~2.8 km), Port of Singapore, city, Batam shore, tanker queue, westbound traffic,
//                           naval patrol + Changi carrier pier (east), "stuck" tanker (ch8 only)
//   MYANMAR (MY_O)          Kyaukphyu landfall: jetty + berthed tanker, tank farm, twin pipelines climbing inland
//   GWADAR  (GW_O)          hammerhead isthmus, quiet port (3 cranes, one ship), corridor road into the mountains
// Nothing here is timed by hand: windows (stuck ship, focus colours) are passed in from the line times by malacca.html.
import * as THREE from "three";
import { person, car, containerShip, tanker, warship, flattop, gantryCrane, oilTank, palm } from "./kit.js";

export const MY_O = new THREE.Vector3(0, 0, 900), GW_O = new THREE.Vector3(900, 0, 0);
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// shorelines of the strait (top view: x east, -z north). Narrowest at x = 0: 70 units (= the ~2.8 km Phillip Channel, scaled).
export const zN = x => -35 - 42 * smooth(Math.abs(x) / 230) - (x < -60 && x > -170 ? 0 : 0);
export const zS = x => 35 + (x < 0 ? 55 : 38) * smooth(Math.abs(x) / 230);
export const LAND_H = 0.8;

export function buildWorld(ctx) {
  const { M, KM, KMR, figs, proxy } = ctx;
  const G = { strait: new THREE.Group(), myanmar: new THREE.Group(), gwadar: new THREE.Group() };
  const add = (o, g, sh = true) => { o.traverse?.(m => { if (m.isMesh) { m.castShadow = sh; m.receiveShadow = true; } }); g.add(o); return o; };
  const box = (g, region, w, h, d, x, y, z, m = M.WHITE, occ = true) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); add(o, g);
    if (occ && h > 1.2) proxy(o, region, new THREE.Vector3(w / 2 + 0.5, h / 2 + 0.5, d / 2 + 0.5)); return o; };
  const shipProxy = (s, region, L, hgt = 0.24, wd = 0.2) => { const pr = new THREE.Mesh(new THREE.BoxGeometry(1, hgt, wd)); pr.position.y = hgt / 2 - 0.02; pr.visible = false; s.add(pr);
    proxy(pr, region, new THREE.Vector3(0.5 + 0.5 / L, hgt / 2 + 0.5 / L, wd / 2 + 0.5 / L), true); return pr; };
  const seaMat = new THREE.MeshStandardMaterial({ color: 0xcddbe3, roughness: 0.25, flatShading: true });
  const bedMat = new THREE.MeshStandardMaterial({ color: 0xbfcfd8, roughness: 0.6 });
  const waveSets = [];
  const sea = (g, w, d, sx, sz, cx = 0, cz = 0) => { const geo = new THREE.PlaneGeometry(w, d, sx, sz); geo.rotateX(-Math.PI / 2); const m = new THREE.Mesh(geo, seaMat); m.position.set(cx, 0, cz); m.receiveShadow = true; g.add(m);
    waveSets.push({ geo, base: geo.attributes.position.array.slice() }); return m; };
  const landShape = (pts, g, region, h = LAND_H, mat = M.WHITE) => { const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1])));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: true, bevelSize: 0.35, bevelThickness: 0.3, bevelSegments: 2, curveSegments: 4 }); geo.rotateX(-Math.PI / 2); geo.translate(0, -0.3, 0);
    const m = new THREE.Mesh(geo, mat); add(m, g, false); m.castShadow = false; return m; };
  const hill = (g, x, z, r, hy, mat = M.WHITE) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat); m.scale.y = hy / r; m.position.set(x, LAND_H - 0.05, z); add(m, g, true); return m; };
  const tree = (g, x, z, s) => { const p = palm(KM); p.scale.setScalar(s); p.position.set(x, LAND_H, z); p.rotation.y = rnd() * 6; add(p, g); };
  const out = { G, waveSets };

  // ======================= STRAIT =======================
  const S = G.strait;
  sea(S, 760, 420, 190, 105, 0, 0);
  { const bed = new THREE.Mesh(new THREE.BoxGeometry(760, 1, 420), bedMat); bed.position.y = -1.6; S.add(bed); }
  const X0 = -380, X1 = 380, ST = 8;
  const north = [], south = [];
  for (let x = X0; x <= X1; x += ST) north.push([x, Math.min(zN(x), x > -170 && x < -60 ? -42 : 1e9)]);
  for (let x = X1; x >= X0; x -= ST) south.push([x, zS(x)]);
  landShape([[X0, -230], [X1, -230], ...north.slice().reverse()], S, "strait");
  landShape([...south, [X0, 230], [X1, 230]], S, "strait");
  // port of Singapore: straight quay x -170..-60 at z -42, gantry cranes, container yard, docked container ships
  const cranes = [];
  for (let i = 0; i < 9; i++) { const c = gantryCrane(KM); c.scale.setScalar(10); c.position.set(-160 + i * 12, LAND_H, -44); add(c, S); cranes.push(c);
    const pr = new THREE.Mesh(new THREE.BoxGeometry(3.4, 6.4, 4.4)); pr.position.set(c.position.x, 3.2 + LAND_H, -44); pr.visible = false; S.add(pr); proxy(pr, "strait", new THREE.Vector3(2.2, 3.7, 2.7)); }
  const yard = new THREE.Group(); S.add(yard);
  for (let x = -166; x < -62; x += 3.4) for (let z = -52; z > -78; z -= 2.3) { if (rnd() < 0.12) continue; const tiers = 1 + Math.floor(rnd() * 4);
    for (let k = 0; k < tiers; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.9, 1.9), (Math.floor(x / 3.4) + k) % 3 === 0 ? M.GREY : M.WHITE); m.position.set(x, LAND_H + 0.45 + k * 0.92, z); add(m, yard); } }
  const docked = [];
  for (const [x, rows] of [[-140, 12], [-96, 10]]) { const s = containerShip(KM, { rows, seed: x }); s.scale.setScalar(15); s.position.set(x, -0.8, -36.6); add(s, S); shipProxy(s, "strait", 15); docked.push(s); }
  const portGroup = [...cranes, yard, ...docked];
  // city: towers behind the port and around the narrows (scenery)
  for (let i = 0; i < 160; i++) { const x = -60 + rnd() * 250, z = zN(x) - 14 - rnd() * 60; if (z > -50 || (x > 128 && x < 215)) continue; const h = 1.5 + rnd() * rnd() * 16, w = 3 + rnd() * 2.5, d = 3 + rnd() * 2.5;
    box(S, "strait", w, h, d, x, LAND_H, z); if (h > 7 && rnd() < 0.5) box(S, "strait", w * 0.6, h * 0.15, d * 0.6, x, LAND_H + h, z, M.GREY, false); }
  for (let i = 0; i < 70; i++) { const x = -360 + rnd() * 180, z = zN(x) - 12 - rnd() * 60; box(S, "strait", 2.5 + rnd() * 2, 1 + rnd() * 3, 2.5 + rnd() * 2, x, LAND_H, z); }
  // Batam / south shore: low hills, small town, palms
  for (let i = 0; i < 40; i++) { const x = -360 + rnd() * 720, z = zS(x) + 18 + rnd() * 80; hill(S, x, z, 8 + rnd() * 16, 1.5 + rnd() * 4, rnd() < 0.5 ? M.SAND : M.WHITE); }
  for (let i = 0; i < 90; i++) { const x = -200 + rnd() * 400, z = zS(x) + 6 + rnd() * 26; if (rnd() < 0.5) tree(S, x, z, 3 + rnd() * 1.5); else box(S, "strait", 2 + rnd() * 2, 0.8 + rnd() * 1.8, 2 + rnd() * 2, x, LAND_H, z); }
  // tanker queue (eastbound lane z = +7): index 1 is the focus tanker (red, swapped by focus())
  const queue = [], qx0 = [];
  for (let k = 0; k < 13; k++) { const s = tanker(KM); s.scale.setScalar(17); const x = -40 - k * 20; s.position.set(x, -0.55, 7 + (k % 2 ? 1.2 : -0.6)); add(s, S); shipProxy(s, "strait", 17, 0.3); queue.push(s); qx0.push(x); }
  const focusTanker = queue[1]; const tankerRed = tanker(KMR); tankerRed.scale.setScalar(17); add(tankerRed, S); tankerRed.visible = false;
  // westbound traffic (lane z = -15), container ships drifting west, wrapping far out in the fog
  const west = []; for (let k = 0; k < 6; k++) { const s = containerShip(KM, { rows: 9 + (k % 3), seed: 40 + k }); s.scale.setScalar(13); s.rotation.y = Math.PI; add(s, S); shipProxy(s, "strait", 13); west.push({ s, x0: 300 - k * 115 }); }
  // naval patrol (east): three warships + Changi pier with a carrier alongside
  const patrol = []; for (const [x, z, ry] of [[140, -8, 0.15], [168, 12, -0.1], [196, -2, 0.05]]) { const s = warship(KM); s.scale.setScalar(15); s.position.set(x, -0.5, z); s.rotation.y = ry; add(s, S); shipProxy(s, "strait", 15, 0.34, 0.14); patrol.push({ s, x, z, ry }); }
  const pierZ0 = zN(178) + 2; box(S, "strait", 5, 0.5, 30, 172, LAND_H - 0.55, pierZ0 + 13, M.GREY, false);
  const carrier = flattop(KM); carrier.scale.setScalar(26); carrier.position.set(186, -0.6, pierZ0 + 14); carrier.rotation.y = -Math.PI / 2; add(carrier, S); shipProxy(carrier, "strait", 26, 0.2, 0.24);
  const navalBase = []; for (let i = 0; i < 5; i++) navalBase.push(box(S, "strait", 7.5, 1.4, 5, 146 + i * 9.5, LAND_H, pierZ0 - 9, M.GREY));   // naval base sheds (grey, low, in a row by the pier)
  for (let i = 0; i < 3; i++) navalBase.push(box(S, "strait", 2, 4.5, 2, 150 + i * 16, LAND_H, pierZ0 - 17, M.WHITE));   // signal masts
  // "stuck" tanker (ch8 window only, red): swings across the narrows
  const stuck = tanker(KMR); stuck.scale.setScalar(19); stuck.position.set(10, -0.55, 4); add(stuck, S); stuck.visible = false; const stuckProxy = shipProxy(stuck, "strait", 19, 0.3);
  // dock workers (tiny mannequins) on the port quay
  for (const [x, z, ry] of [[-118, -40.6, 0.4], [-116.5, -40.9, 2.6], [-80, -40.8, 1.2]]) { const p = person(KM, { hat: "hard" }); p.scale.setScalar(0.85); p.position.set(x, LAND_H, z); p.rotation.y = ry; add(p, S); figs.push(p); }
  for (const [x, z, t] of [[-130, -47, "truck"], [-104, -47.5, "truck"], [-72, -48, "van"]]) { const c = car(KM, t); c.scale.setScalar(2.2); c.position.set(x, LAND_H, z); add(c, S); }
  // birds
  const BIRD = new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: 0.7, side: THREE.DoubleSide, flatShading: true });
  const wingG = new THREE.BufferGeometry(); wingG.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -0.08, 0, 0, 0.1, 0.3, 0, 0], 3)); wingG.computeVertexNormals();
  const birds = []; for (let k = 0; k < 18; k++) { const b = new THREE.Group(); const body = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 5), BIRD); body.rotation.x = Math.PI / 2; b.add(body);
    const wl = new THREE.Mesh(wingG, BIRD), wr = new THREE.Mesh(wingG, BIRD); wr.scale.x = -1; b.add(wl, wr); b.scale.setScalar(3.2);
    b.userData = { wl, wr, cx: [-60, 20, -150][k % 3], cz: [-10, 14, -20][k % 3], r: 8 + rnd() * 14, h: 9 + rnd() * 6, ph: rnd() * 6.28, sp: 0.15 + rnd() * 0.08, f: 7 + rnd() * 3 }; S.add(b); birds.push(b); }

  // ======================= MYANMAR (Kyaukphyu) =======================
  const Y = G.myanmar; Y.position.copy(MY_O);
  sea(Y, 420, 300, 105, 75, 0, 60);
  { const bed = new THREE.Mesh(new THREE.BoxGeometry(420, 1, 300), bedMat); bed.position.set(0, -1.6, 60); Y.add(bed); }
  const coast = []; for (let x = -210; x <= 210; x += 10) coast.push([x, 4 + Math.sin(x * 0.03) * 5 + (x > 40 ? (x - 40) * 0.12 : 0)]);
  landShape([[-210, -200], [210, -200], ...coast.slice().reverse()], Y, "myanmar");
  const nearPipe = (x, z, r) => [[30, -20], [60, -36], [92, -58], [120, -88], [150, -122], [185, -160], [215, -196]].some(([px, pz]) => Math.hypot(px - x, pz - z) < r + 14);
  for (let i = 0; i < 60 && Y.children.length < 400; i++) { const x = -200 + rnd() * 400, z = -40 - rnd() * 150, rr = 10 + rnd() * 18; if (nearPipe(x, z, rr) || (x > -60 && x < 40 && z > -60)) continue;
    hill(Y, x, z, rr, 2 + rnd() * 4 + Math.max(0, -z - 80) * 0.04, rnd() < 0.4 ? M.SAND : M.WHITE); }
  for (let i = 0; i < 70; i++) { const x = -190 + rnd() * 380, z = -6 - rnd() * 40; if (x > -40 && x < 60 && z > -42) continue; tree(Y, x, z, 3 + rnd() * 1.5); }
  // jetty + berthed tanker
  box(Y, "myanmar", 4, 0.5, 46, -30, LAND_H - 0.55, 28, M.GREY, false); box(Y, "myanmar", 18, 0.5, 5, -30, LAND_H - 0.55, 50, M.GREY, false);
  const myTanker = tanker(KM), myTankerR = tanker(KMR); for (const t of [myTanker, myTankerR]) { t.scale.setScalar(19); t.position.set(-30, -0.55, 58); add(t, Y); } myTankerR.visible = false; shipProxy(myTanker, "myanmar", 19, 0.3);
  // tank farm
  const tanks = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const t = oilTank(KM); t.scale.setScalar(9); t.position.set(-5 + i * 12, LAND_H, -8 - j * 12); add(t, Y); tanks.push(t);
    const pr = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 3.8, 12)); pr.position.set(t.position.x, LAND_H + 1.9, t.position.z); pr.visible = false; Y.add(pr); proxy(pr, "myanmar", new THREE.Vector3(5, 2.5, 5)); }
  // twin pipelines: tubes from the farm over the hills to the horizon (north-east)
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0xd9d8d4, roughness: 0.6 }), pipeRed = M.RED;
  const pipePts = [[30, -20], [60, -36], [92, -58], [120, -88], [150, -122], [185, -160], [215, -196]];
  const hY = (x, z) => LAND_H + 0.6 + Math.max(0, (-z - 30) * 0.035);   // pipes ride on gentle trestles above the slope
  const pipes = [0, 1].map(o => { const c = new THREE.CatmullRomCurve3(pipePts.map(([x, z]) => new THREE.Vector3(x + o * 1.6, hY(x, z), z - o * 1.2)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(c, 160, 0.42, 10), pipeMat); add(m, Y); return m; });
  for (let i = 0; i < 26; i++) { const p = pipes[0].geometry.parameters.path.getPointAt(i / 26); box(Y, "myanmar", 0.3, p.y - LAND_H, 3, p.x + 0.8, LAND_H, p.z - 0.6, M.GREY, false); }
  { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-30, LAND_H + 0.4, 46), new THREE.Vector3(-28, LAND_H + 0.4, 6), new THREE.Vector3(-8, LAND_H + 0.4, -4)]), 40, 0.3, 8), pipeMat); add(m, Y); }
  for (const [x, z, ry] of [[-29, 44, 0.3], [-31.2, 40, 2.1]]) { const p = person(KM, { hat: "hard" }); p.scale.setScalar(0.85); p.position.set(x, LAND_H, z); p.rotation.y = ry; add(p, Y); figs.push(p); }

  // ======================= GWADAR =======================
  const W = G.gwadar; W.position.copy(GW_O);
  sea(W, 420, 320, 105, 80, 0, 40);
  { const bed = new THREE.Mesh(new THREE.BoxGeometry(420, 1, 320), bedMat); bed.position.set(0, -1.6, 40); W.add(bed); }
  const mainland = []; for (let x = -210; x <= 210; x += 10) mainland.push([x, -30 + Math.sin(x * 0.02) * 6]);
  landShape([[-210, -200], [210, -200], ...mainland.slice().reverse()], W, "gwadar", LAND_H, M.SAND);
  landShape([[-7, -32], [7, -32], [9, 40], [-9, 40]], W, "gwadar", LAND_H * 0.7, M.SAND);                 // the isthmus
  { const head = new THREE.Mesh(new THREE.CylinderGeometry(30, 34, 9, 9), M.WHITE); head.scale.z = 0.5; head.position.set(-4, 3.5, 56); add(head, W);
    const pr = new THREE.Mesh(new THREE.BoxGeometry(60, 9, 30)); pr.position.copy(head.position); pr.visible = false; W.add(pr); proxy(pr, "gwadar", new THREE.Vector3(32, 5, 17)); }   // hammerhead mesa
  for (let i = 0; i < 26; i++) { const x = -200 + rnd() * 400, z = -80 - rnd() * 120; const m = new THREE.Mesh(new THREE.ConeGeometry(14 + rnd() * 22, 12 + rnd() * 26, 5), rnd() < 0.5 ? M.WHITE : M.SAND); m.position.set(x, LAND_H + m.geometry.parameters.height / 2 - 1, z); m.rotation.y = rnd() * 3; add(m, W); }
  // port on the east side of the isthmus: quay, 3 cranes, one ship, empty berths
  box(W, "gwadar", 60, 0.6, 12, 40, LAND_H - 0.6, -24, M.WHITE, false);
  const gwCranes = []; for (let i = 0; i < 3; i++) { const c = gantryCrane(KM); c.scale.setScalar(10); c.position.set(20 + i * 14, LAND_H, -26); add(c, W); gwCranes.push(c);
    const pr = new THREE.Mesh(new THREE.BoxGeometry(3.4, 6.4, 4.4)); pr.position.set(c.position.x, 3.2 + LAND_H, -26); pr.visible = false; W.add(pr); proxy(pr, "gwadar", new THREE.Vector3(2.2, 3.7, 2.7)); }
  const gwShip = containerShip(KM, { rows: 8, seed: 77 }); gwShip.scale.setScalar(13); gwShip.position.set(24, -0.7, -14.5); add(gwShip, W); shipProxy(gwShip, "gwadar", 13);
  // corridor road: from the port north into the mountains (red when it is the focus)
  const roadPts = [[40, -32], [44, -60], [30, -95], [48, -130], [36, -170], [52, -210]].map(([x, z]) => new THREE.Vector3(x, LAND_H + 0.06, z));
  const roadCurve = new THREE.CatmullRomCurve3(roadPts); const roadGeo = (() => { const N = 120, pos = [], idx = []; for (let i = 0; i <= N; i++) { const p = roadCurve.getPointAt(i / N), tg = roadCurve.getTangentAt(i / N), n = new THREE.Vector3(-tg.z, 0, tg.x).normalize().multiplyScalar(2.2);
      pos.push(p.x + n.x, p.y, p.z + n.z, p.x - n.x, p.y, p.z - n.z); if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i); } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; })();
  const roadMat = new THREE.MeshStandardMaterial({ color: 0xc9c8c4, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }); const road = new THREE.Mesh(roadGeo, roadMat); road.receiveShadow = true; W.add(road);
  const trucks = []; for (let k = 0; k < 3; k++) { const c = car(KM, "truck"); c.scale.setScalar(2.4); add(c, W); trucks.push({ c, u0: k / 3 }); }
  for (const [x, z, ry] of [[30, -24.5, 1.0], [52, -24.8, 2.8]]) { const p = person(KM, { hat: "hard" }); p.scale.setScalar(0.85); p.position.set(x, LAND_H, z); p.rotation.y = ry; add(p, W); figs.push(p); }

  // ======================= dynamics =======================
  const dyn = [...queue, tankerRed, ...west.map(w => w.s), ...patrol.map(p => p.s), stuck];
  // win = { stuck: [t0, t1, swing0, swing1], focus: name -> [[t0,t1]...] } from malacca.html (line times)
  out.update = (t, win, light = false) => {
    if (!light) for (const ws of waveSets) { const p = ws.geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = ws.base[i * 3], z = ws.base[i * 3 + 2];
      p.setY(i, Math.sin(x * 0.35 + t * 1.3) * 0.12 + Math.sin(z * 0.6 + x * 0.17 - t * 0.9) * 0.1); } p.needsUpdate = true; ws.geo.computeVertexNormals(); }
    const creep = t * 0.35; queue.forEach((s, k) => { s.position.x = qx0[k] + creep; });
    const inStuck = win && win.stuck && t >= win.stuck[0] && t <= win.stuck[1];
    const focusOn = n => win && win.focus[n] && win.focus[n].some(([a, b]) => t >= a - 0.4 && t <= b + 0.4);
    // focus tanker: red unless ch8 (the imagined stuck ship is the focus then)
    const red = !inStuck; tankerRed.visible = red; focusTanker.visible = !red; tankerRed.position.copy(focusTanker.position); tankerRed.rotation.copy(focusTanker.rotation);
    stuck.visible = !!inStuck; if (inStuck) { const u = smooth((t - win.stuck[2]) / (win.stuck[3] - win.stuck[2])); stuck.rotation.y = 0.08 + u * 1.05; stuck.position.x = 10 + u * 3; }
    if (inStuck) queue.forEach((s, k) => { s.position.x = Math.min(s.position.x, -18 - k * 24); });   // the queue piles up behind it
    for (const w of west) { let x = w.x0 - t * 1.1; x = ((x + 340) % 680 + 680) % 680 - 340; w.s.position.set(x, -0.7, -15 + (w.x0 % 3)); }
    patrol.forEach((p, i) => { p.s.position.set(p.x + Math.sin(t * 0.05 + i) * 6, -0.5, p.z + Math.sin(t * 0.07 + i * 2) * 1.5); });
    cranes.forEach((c, i) => { c.userData.trolley.position.z = 0.35 + Math.sin(t * 0.4 + i * 1.3) * 0.25; });
    gwCranes.forEach((c, i) => { c.userData.trolley.position.z = 0.1; });
    for (const b of birds) { const u = b.userData, a = u.ph + t * u.sp; b.position.set(u.cx + Math.cos(a) * u.r * 1.8, u.h + Math.sin(t * 0.8 + u.ph) * 0.4, u.cz + Math.sin(a) * u.r * 0.7);
      b.lookAt(u.cx + Math.cos(a + 0.1) * u.r * 1.8, b.position.y, u.cz + Math.sin(a + 0.1) * u.r * 0.7); const f = Math.sin(t * u.f + u.ph) * 0.9; u.wl.rotation.z = f; u.wr.rotation.z = -f; }
    trucks.forEach(({ c, u0 }) => { const u = (u0 + t * 0.004) % 1, p = roadCurve.getPointAt(u), tg = roadCurve.getTangentAt(u); c.position.set(p.x, LAND_H, p.z); c.rotation.y = Math.atan2(-tg.z, tg.x); });
    // focus colours (red only on the current focus)
    const pr = focusOn("pipeline"); pipes.forEach(m => m.material = pr ? pipeRed : pipeMat);
    const lf = focusOn("landfall"); myTankerR.visible = lf; myTanker.visible = !lf;
    road.material = focusOn("gwadar") ? pipeRed : roadMat;
    for (const o of dyn) o.updateMatrixWorld(true);
  };
  Object.assign(out, { navalBase, queue, focusTanker, tankerRed, stuck, stuckProxy, portGroup, cranes, docked, patrol: patrol.map(p => p.s), carrier, myTanker, myTankerR, tanks, pipes, gwCranes, gwShip, road, roadCurve, west: west.map(w => w.s) });
  return out;
}
