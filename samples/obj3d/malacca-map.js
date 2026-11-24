// Malacca film 3D relief map (Natural Earth 110m, same slab look as suez-mg.js buildMap) with the routes of the script.
// Routes draw when their first line starts (times come from lines.json via malacca.html); red = current focus only.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { textPlane, smooth, pop } from "./suez-mg.js";
const rb = (w, h, d, r = 0.12) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));

// lon/lat waypoints (approximate shipping lanes / pipeline corridors)
export const ROUTES = {
  main: [[50.2, 26.6], [56.4, 26.4], [59.5, 23.5], [63, 18], [70, 11], [78, 6.5], [84, 6], [91, 6.3], [95.5, 6.2], [98.2, 4.6], [100.6, 2.7], [103.6, 1.2], [105.4, 2.4], [107.6, 6], [110.5, 11.5], [113.8, 17], [117.6, 21.8], [120.6, 25.6], [122.2, 30.2]],
  lombok: [[84, 6], [92, 0], [100, -7], [108, -10.2], [115.8, -8.9], [117.6, -5], [118.4, 0], [119.6, 6], [120.6, 13], [121, 20], [121.6, 25.6], [122.2, 30.2]],
  myanmar: [[84, 6], [88, 12], [91.5, 17.5], [93.6, 19.4], [95.5, 21.2], [97.6, 22.6], [100.2, 24.2], [102.7, 25.0]],
  gwadar: [[62.3, 25.1], [64.5, 27.5], [67.2, 30.2], [70.6, 32.6], [73.2, 34.6], [75.4, 36.8], [76.0, 39.4]],
  kra: [[91, 6.3], [95.6, 8.0], [98.4, 8.7], [99.4, 8.9], [100.4, 8.6], [103, 9.3], [107.6, 11.5], [110.5, 14], [113.8, 18], [117.6, 22], [120.6, 25.6], [122.2, 30.2]],
  arctic: [[122.2, 30.2], [127.5, 33.6], [133, 37.5], [140, 43], [145, 49], [156, 51.5], [164, 58], [172, 63], [179, 66], [178, 70.5], [165, 72.2], [150, 74.6], [135, 75.6], [118, 77.6], [100, 77.6], [82, 75.2], [70, 74.4], [55, 72.8], [42, 70.4], [33.5, 69.3]],
};
export const PINS = { malacca: [100.4, 3.0], singapore: [103.8, 1.3], andaman: [92.8, 11.7], gulf: [50.2, 26.6], china: [122.2, 30.2] };

export function buildMap(ctx, geo, O) {
  const { M } = ctx, G = new THREE.Group(); G.position.copy(O);
  const K = 0.42, LON0 = 95, LAT0 = 25, B = [30, 182, -16, 80];
  const px = (lon, lat) => new THREE.Vector2((lon - LON0) * K, (lat - LAT0) * K);
  const clip = (ring) => { let out = ring; const edges = [[0, B[0], 1], [0, B[1], -1], [1, B[2], 1], [1, B[3], -1]];
    for (const [ax, v, s] of edges) { const inp = out; out = []; if (!inp.length) break; const inside = pt => (pt[ax] - v) * s >= 0;
      for (let i = 0; i < inp.length; i++) { const a = inp[i], b = inp[(i + 1) % inp.length], ia = inside(a), ib = inside(b);
        const cut = () => { const t = (v - a[ax]) / (b[ax] - a[ax]); const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; q[ax] = v; return q; };
        if (ia) { out.push(a); if (!ib) out.push(cut()); } else if (ib) out.push(cut()); } }
    return out; };
  const cx = (B[0] + B[1]) / 2, cz = (B[2] + B[3]) / 2, Wm = (B[1] - B[0]) * K, Dm = (B[3] - B[2]) * K;
  const sea = new THREE.Mesh(rb(Wm + 1, 0.7, Dm + 1, 0.3), new THREE.MeshStandardMaterial({ color: 0xd2dee6, roughness: 0.55 }));
  sea.position.set((cx - LON0) * K, -0.35, -(cz - LAT0) * K); sea.receiveShadow = true; G.add(sea);
  const shades = [0xf3f1ec, 0xeceae5, 0xf6f4f0].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.88 })), buckets = [[], [], []];
  const CHINA = new THREE.MeshStandardMaterial({ color: 0xe3e1db, roughness: 0.88 }), cb = [];
  geo.features.forEach((f, fi) => { const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const isCN = (f.properties.ISO_A3 || f.properties.ADM0_A3) === "CHN", h = isCN ? 0.75 : 0.42 + ((fi * 37) % 11) / 11 * 0.14;
    for (const poly of polys) { const outer = clip(poly[0]); if (outer.length < 3) continue;
      const sh = new THREE.Shape(outer.map(q => px(q[0], q[1])));
      for (const r of poly.slice(1)) { const rc = clip(r); if (rc.length >= 3) sh.holes.push(new THREE.Path(rc.map(q => px(q[0], q[1])))); }
      let g; try { g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); } catch (e) { continue; }
      g.rotateX(-Math.PI / 2); (isCN ? cb : buckets[fi % 3]).push(g); } });
  buckets.forEach((b, i) => { if (!b.length) return; const m = new THREE.Mesh(mergeGeometries(b, false), shades[i]); m.castShadow = m.receiveShadow = true; G.add(m); });
  if (cb.length) { const m = new THREE.Mesh(mergeGeometries(cb, false), CHINA); m.castShadow = m.receiveShadow = true; G.add(m); }
  const P = (lon, lat, y = 0.95) => { const v = px(lon, lat); return new THREE.Vector3(v.x, y, -v.y); };
  // ----- route tubes with travelling pulses; overland legs (pipelines, roads) ride higher
  const CT = { value: 0 };
  const pulseMat = (base, hi, cnt) => { const m = new THREE.MeshStandardMaterial({ color: base, roughness: 0.45 }); m.onBeforeCompile = s => { s.uniforms.cT = CT;
    s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nvarying float vCU;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvCU = uv.x;");
    s.fragmentShader = s.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vCU; uniform float cT;")
      .replace("#include <color_fragment>", `#include <color_fragment>\nfloat ph = fract(vCU*${cnt}.0 - cT*0.5); float band = smoothstep(0.0,0.03,ph)*(1.0-smoothstep(0.03,0.1,ph));\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(${hi}), band*0.85);`); }; return m; };
  const RED = pulseMat(0xcf2219, "1.0,0.62,0.55", 18), GRY = pulseMat(0xb9b8b4, "0.98,0.98,0.97", 18);
  const SEGS = 360, RAD = 8, routes = {};
  const land = new Set(["gwadar"]);
  for (const [id, pts] of Object.entries(ROUTES)) {
    const y = id === "gwadar" ? 1.35 : id === "myanmar" ? 1.1 : 0.95;
    const curve = new THREE.CatmullRomCurve3(pts.map(q => P(q[0], q[1], y)), false, "centripetal");
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, SEGS, id === "kra" ? 0.16 : 0.14, RAD, false), GRY); m.castShadow = true; m.frustumCulled = false; m.geometry.setDrawRange(0, 0); G.add(m);
    const box = new THREE.Box3().setFromPoints(pts.map(q => P(q[0], q[1], y)));
    routes[id] = { id, curve, mesh: m, box, t0: null, dur: 3.0, land: land.has(id) };
  }
  // ----- pins + small signs (captions on elements only)
  const mkPin = (v, mat = M.WHITE) => { const pg = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.75, 14), mat); c.rotation.x = Math.PI; c.position.y = 0.38;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), mat); s.position.y = 0.85; c.castShadow = s.castShadow = true; pg.add(c, s); pg.position.copy(v); pg.position.y = 0.6; G.add(pg); return pg; };
  const mkSign = (txt, w, h, y, v, color) => { const sg = new THREE.Group(); const slab = new THREE.Mesh(rb(w, h, 0.14, 0.14), M.WHITE); slab.castShadow = true; slab.position.y = h / 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, y, 6), M.GREY); post.position.y = -y / 2;
    const tp = textPlane(ctx, txt, w * 0.94, h * 0.78, { color }); tp.position.set(0, h / 2, 0.075);
    sg.add(slab, post, tp); sg.position.copy(v); sg.position.y = y + 0.5; G.add(sg); sg.userData.tp = tp; return sg; };
  const pins = {}; for (const [id, [lo, la]] of Object.entries(PINS)) pins[id] = { pin: mkPin(P(lo, la, 0.5)), red: mkPin(P(lo, la, 0.5), M.RED), t0: null };
  // sign specs: [id, text, lon, lat, dx, dz, w] ; shown while their element is (or was) introduced
  const SIGNS = [["gulf", "GULF", 50.2, 26.6, -1.6, -1.6, 2.8], ["china", "CHINA", 122.2, 30.2, 1.8, -1.4, 3.2], ["malacca", "MALACCA", 100.4, 3.0, -3.4, 0.9, 4.0],
    ["singapore", "SINGAPORE", 103.8, 1.3, 2.6, 1.6, 4.6], ["lombok", "LOMBOK", 115.8, -8.9, 0, 1.9, 3.6], ["andaman", "ANDAMAN IS.", 92.8, 11.7, -3.6, 0.6, 4.8],
    ["myanmar", "KYAUKPHYU", 93.6, 19.4, -3.8, 0.8, 4.6], ["myanmar2", "KUNMING", 102.7, 25.0, 2.6, -1.0, 3.8], ["gwadar", "GWADAR", 62.3, 25.1, -1.4, 1.8, 3.6],
    ["gwadar2", "KASHGAR", 76.0, 39.4, 0, -1.8, 3.8], ["kra", "KRA", 99.4, 8.9, -2.4, -0.4, 2.4], ["arctic", "NORTHERN SEA ROUTE", 110, 77.6, 0, 1.9, 7.6]];
  const signs = SIGNS.map(([id, txt, lo, la, dx, dz, w]) => ({ id, s: mkSign(txt, w, 1.15, 1.3, P(lo, la, 0.5).add(new THREE.Vector3(dx, 0, dz))), t0: null }));
  // ----- per-film timing (from line times): introduce(id, t) sets when a route / pin / sign appears; focus(id) windows decide red
  const focusWin = {};   // id -> [[t0,t1]...]
  const intro = (id, t) => { if (routes[id] && routes[id].t0 === null) routes[id].t0 = t; if (pins[id] && pins[id].t0 === null) pins[id].t0 = t;
    for (const s of signs) if ((s.id === id || s.id === id + "2") && s.t0 === null) s.t0 = t + (s.id === id ? 0.3 : routes[id] ? routes[id].dur * 0.9 : 0.3); };
  const focusAt = (id, t) => (focusWin[id] || []).some(([a, b]) => t >= a - 0.3 && t <= b + 0.3);
  const signWin = {}; const setSignWin = (id, a, b) => (signWin[id] ??= []).push([a, b]);
  const camP = new THREE.Vector3(), wp = new THREE.Vector3();
  function update(t, camPos) {
    CT.value = t * 0.9;
    for (const r of Object.values(routes)) { const p = r.t0 === null ? 0 : smooth((t - r.t0) / r.dur); r.mesh.geometry.setDrawRange(0, Math.floor(p * SEGS) * RAD * 6); r.mesh.material = focusAt("route:" + r.id, t) ? RED : GRY; r.mesh.visible = p > 0; }
    for (const [id, p] of Object.entries(pins)) { const s = p.t0 === null ? 0 : Math.max(0.0001, pop((t - p.t0) / 0.45)), red = focusAt("pin:" + id, t);
      p.pin.scale.setScalar(s); p.red.scale.setScalar(s); p.pin.visible = s > 0.001 && !red; p.red.visible = s > 0.001 && red; }
    for (const s of signs) { const w = (signWin[s.id] || []).find(([a, b]) => t >= a && t <= b), on = s.t0 !== null && t >= s.t0 && !!w;
      const k = on ? Math.max(0.0001, pop((t - Math.max(s.t0, w[0])) / 0.45)) * Math.min(1, (w[1] - t) / 0.3) : 0; s.s.visible = k > 0.001;
      s.s.userData.tp.userData.win = on ? [Math.max(s.t0, w[0]), w[1]] : null;
      let sc = 1; if (camPos) { camP.copy(camPos).sub(G.position); s.s.getWorldPosition(wp); sc = Math.min(4.5, Math.max(1, camPos.distanceTo(wp) / 23)); s.s.lookAt(camPos); }
      s.s.scale.setScalar(Math.max(0.0001, k) * sc); }
  }
  // textPlane legibility windows: a sign's text counts from its intro onward (the gate checks it whenever on screen)
  const finalize = T => {};
  return { group: G, update, setSignWin, routes, pins, signs, intro, focusWin, finalize, P, K, size: [Wm, Dm], center: new THREE.Vector3((cx - LON0) * K, 0, -(cz - LAT0) * K) };
}
