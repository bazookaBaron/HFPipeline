// Motion-graphics modules for the Suez film. Everything lives inside the miniature: same materials, same sun, same tilt-shift.
// Map (Natural Earth 110m relief), timeline (queue-size pillars), string board (link analysis), chapter numeral.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { person, car, ship, containerShip, tug, excavator, dredger } from "./kit.js";

export const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
export const pop = u => { if (u <= 0) return 0; if (u >= 1) return 1; const k = u - 1; return 1 + 2.4 * k * k * k + 1.4 * k * k; };   // easeOutBack
const rb = (w, h, d, r = 0.12) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));

// ---------- crisp canvas text on a lit plane (so it takes the world's light); registry feeds the legibility gate
export function textPlane(ctx, txt, w, h, o = {}) {
  const px = o.px ?? 1024, py = Math.round(px * h / w), cv = document.createElement("canvas"); cv.width = px; cv.height = py;
  const c = cv.getContext("2d"), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.05, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.receiveShadow = false; m.userData.txt = null;
  m.userData.set = s => { if (s === m.userData.txt) return; m.userData.txt = s;
    c.clearRect(0, 0, px, py); const fam = '"Segoe UI", Arial, sans-serif'; let fs = py * (o.fill ?? 0.8);
    c.font = `700 ${fs}px ${fam}`; const mw = c.measureText(s).width; if (mw > px * 0.94) { fs *= px * 0.94 / mw; c.font = `700 ${fs}px ${fam}`; }
    c.fillStyle = o.color ?? "#555"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(s, px / 2, py * 0.53);
    m.userData.cap = fs * 0.716 / py; tex.needsUpdate = true; };
  m.userData.set(txt); m.userData.win = o.win; ctx.texts.push(m); return m; }

// ---------- chapter numeral "6": stroke digit built from a tube, with a real counter (hole) the camera flies through
export function numeral(ctx, S = 1.1) {
  const g = new THREE.Group(), p = (x, y) => new THREE.Vector3(x, y, 0);
  const stroke = new THREE.CatmullRomCurve3([p(3.0, 10.0), p(0.8, 11.5), p(-1.8, 9.6), p(-3.0, 5.6), p(-3.0, 3.6), p(-1.9, 1.1), p(0.2, 0.55), p(2.4, 1.3), p(3.0, 3.6), p(2.2, 5.9), p(0, 6.6), p(-2.2, 5.9), p(-3.0, 3.6)], false, "centripetal");
  const m = new THREE.Mesh(new THREE.TubeGeometry(stroke, 160, 0.95, 16, false), ctx.M.WHITE); m.castShadow = m.receiveShadow = true; g.add(m);
  g.scale.setScalar(S); g.userData.holeY = 3.6 * S; return g; }

// ================= MAP =================
export function buildMap(ctx, geo, O) {
  const { M } = ctx, G = new THREE.Group(); G.position.copy(O);
  const K = 0.3, LON0 = 50, LAT0 = 12, B = [-25, 135, -42, 70], W = (B[1] - B[0]) * K, D = (B[3] - B[2]) * K;
  const px = (lon, lat) => new THREE.Vector2((lon - LON0) * K, (lat - LAT0) * K);
  const clip = (ring) => { let out = ring; const edges = [[0, B[0], 1], [0, B[1], -1], [1, B[2], 1], [1, B[3], -1]];
    for (const [ax, v, s] of edges) { const inp = out; out = []; if (!inp.length) break;
      const inside = pt => (pt[ax] - v) * s >= 0;
      for (let i = 0; i < inp.length; i++) { const a = inp[i], b = inp[(i + 1) % inp.length], ia = inside(a), ib = inside(b);
        const cut = () => { const t = (v - a[ax]) / (b[ax] - a[ax]); const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; q[ax] = v; return q; };
        if (ia) { out.push(a); if (!ib) out.push(cut()); } else if (ib) out.push(cut()); } }
    return out; };
  // sea slab + land extrusions (3 white shades -> country borders read without lines)
  const cx = (B[0] + B[1]) / 2, cz = (B[2] + B[3]) / 2;
  const sea = new THREE.Mesh(rb(W + 0.8, 0.7, D + 0.8, 0.25), new THREE.MeshStandardMaterial({ color: 0xdde8ee, roughness: 0.55 }));
  sea.position.set((cx - LON0) * K, -0.35, -(cz - LAT0) * K); sea.receiveShadow = true; G.add(sea);
  const shades = [0xf3f1ec, 0xeceae5, 0xf6f4f0].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.88 })), buckets = [[], [], []];
  geo.features.forEach((f, fi) => { const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const h = 0.42 + ((fi * 37) % 11) / 11 * 0.14;
    for (const poly of polys) { const rings = poly.map(r => clip(r)).filter(r => r.length >= 3); if (!rings.length) continue;
      const outer = clip(poly[0]); if (outer.length < 3) continue;
      const sh = new THREE.Shape(outer.map(q => px(q[0], q[1])));
      for (const r of poly.slice(1)) { const rc = clip(r); if (rc.length >= 3) sh.holes.push(new THREE.Path(rc.map(q => px(q[0], q[1])))); }
      let g; try { g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); } catch (e) { continue; }
      g.rotateX(-Math.PI / 2); buckets[fi % 3].push(g); } });
  buckets.forEach((b, i) => { if (!b.length) return; const m = new THREE.Mesh(mergeGeometries(b, false), shades[i]); m.castShadow = m.receiveShadow = true; G.add(m); });
  // ----- routes
  const P = (lon, lat, y = 0.95) => { const v = px(lon, lat); return new THREE.Vector3(v.x, y, -v.y); };
  const mainPts = [[121.8, 31.0], [121, 25], [117, 20.5], [112, 14], [108, 7.5], [104.3, 1.6], [100, 3.5], [95, 6], [88, 6], [80, 6.3], [70, 9], [58, 12], [50, 12.6], [43.6, 12.8], [41, 16], [38, 21], [35, 26.5], [32.6, 29.8]];
  const detPts = [[50, 12.6], [54, 5], [53, -6], [47, -18], [39, -27], [28, -34.5], [19, -36.5], [12, -31], [8, -18], [6, -5], [2, 2], [-8, 6], [-17, 14], [-20, 24], [-16, 34], [-11, 41], [-5, 47], [1, 51], [4.5, 52]];
  const MR = new THREE.CatmullRomCurve3(mainPts.map(q => P(...q)), false, "centripetal"), DR = new THREE.CatmullRomCurve3(detPts.map(q => P(...q)), false, "centripetal");
  const CT = { value: 0 };
  const pulseMat = (base, hi, cnt) => { const m = new THREE.MeshStandardMaterial({ color: base, roughness: 0.45 }); m.onBeforeCompile = s => { s.uniforms.cT = CT;
    s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nvarying float vCU;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvCU = uv.x;");
    s.fragmentShader = s.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vCU; uniform float cT;")
      .replace("#include <color_fragment>", `#include <color_fragment>\nfloat ph = fract(vCU*${cnt}.0 - cT*0.5); float band = smoothstep(0.0,0.03,ph)*(1.0-smoothstep(0.03,0.1,ph));\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(${hi}), band*0.85);`); }; return m; };
  const SEGS = 420, RAD = 8;
  const mkTube = (curve, mat, r) => { const m = new THREE.Mesh(new THREE.TubeGeometry(curve, SEGS, r, RAD, false), mat); m.castShadow = true; m.frustumCulled = false; G.add(m); return m; };
  const mainTube = mkTube(MR, pulseMat(0xcf2219, "1.0,0.62,0.55", 16), 0.13), detTube = mkTube(DR, pulseMat(0xc4c3bf, "0.98,0.98,0.97", 22), 0.11);
  mainTube.geometry.setDrawRange(0, 0); detTube.geometry.setDrawRange(0, 0);
  const mark = new THREE.MeshStandardMaterial({ color: 0xdadad6, roughness: 0.8 });
  // pins + signs
  const mkPin = (v, mat = M.WHITE) => { const pg = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 14), mat); c.rotation.x = Math.PI; c.position.y = 0.35;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), mat); s.position.y = 0.8; c.castShadow = s.castShadow = true; pg.add(c, s); pg.position.copy(v); pg.position.y = 0.5; G.add(pg); return pg; };
  const mkSign = (txt, w, h, y, v, win, color) => { const sg = new THREE.Group(); const slab = new THREE.Mesh(rb(w, h, 0.14, 0.14), M.WHITE); slab.castShadow = true; slab.position.y = h / 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, y, 6), M.GREY); post.position.y = -y / 2 + 0.0; post.position.y = -y / 2;
    const tp = textPlane(ctx, txt, w * 0.94, h * 0.78, { win, color }); tp.position.set(0, h / 2, 0.075);
    slab.position.y = h / 2; sg.add(slab, post, tp); sg.position.copy(v); sg.position.y = y + 0.5; G.add(sg); sg.userData.tp = tp; return sg; };
  const shanghai = P(121.8, 31, 0.5), suez = P(32.6, 29.8, 0.5), rott = P(4.5, 52, 0.5);
  const pinA = mkPin(shanghai), pinE = mkPin(rott);
  const signA = mkSign("ASIA", 3.1, 1.0, 1.5, shanghai.clone().add(new THREE.Vector3(0.6, 0, 1.5)), [8, 11]);
  const signE = mkSign("EUROPE", 3.9, 1.0, 1.5, rott.clone().add(new THREE.Vector3(1.4, 0, 1.6)), [13.8, 15]);
  const signS = mkSign("SUEZ", 3.1, 1.0, 1.6, suez.clone().add(new THREE.Vector3(-0.6, 0, 1.7)), [10.9, 12.5]);
  const km = mkSign("+6,000 km", 4.6, 1.15, 1.5, P(50, 12.6, 0.5), [12.3, 15]);
  const days = mkSign("+10 days", 3.9, 1.0, 1.5, P(23, -26, 0.5).add(new THREE.Vector3(-1.2, 0, 0.5)), [13.3, 15]);
  // barrier across the blocked lane at Suez (white bar with posts; the red route is the focus)
  const bar = new THREE.Group(); { const b = new THREE.Mesh(rb(2.0, 0.45, 0.16, 0.08), M.WHITE); b.position.y = 0.95; b.castShadow = true; bar.add(b);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 8), M.GREY); p.position.set(s * 0.95, 0.6, 0); p.castShadow = true; bar.add(p); } }
  { const sp = MR.getPointAt(0.995); bar.position.set(sp.x, 0, sp.z); bar.lookAt(sp.x - 1, 0, sp.z - 1.3); G.add(bar); }
  const [t0r, t1r] = [8.2, 10.9], [t0d, t1d] = [12.1, 14.8];
  const prog = t => smooth((t - t0r) / (t1r - t0r)), progD = t => smooth((t - t0d) / (t1d - t0d));
  function update(t) {
    const p = prog(t), q = progD(t);
    mainTube.geometry.setDrawRange(0, Math.floor(p * SEGS) * RAD * 6); detTube.geometry.setDrawRange(0, Math.floor(q * SEGS) * RAD * 6);
    CT.value = Math.min(t, 10.9) * 0.9 + (t > 12.1 ? (t - 12.1) * 0.9 : 0);
    const ps = (g, t0) => g.scale.setScalar(Math.max(0.0001, pop((t - t0) / 0.45)));
    ps(pinA, 8.0); ps(signA, 8.3); ps(bar, 10.9); ps(signS, 11.0); ps(pinE, 14.3); ps(signE, 14.4); ps(days, 13.3);
    signA.visible = t < 11.6;   // sign steps away once the route has left Asia
    // distance counter rides the detour head
    const hp = DR.getPointAt(Math.min(1, Math.max(0, q))); km.position.set(hp.x, 1.9, hp.z + 0.6); ps(km, 12.2);
    km.userData.tp.userData.set("+" + Math.round(6000 * q / 10) * 10 >= 0 ? "+" + (Math.round(6000 * q / 10) * 10).toLocaleString("en-US") + " km" : "");
  }
  const head = t => MR.getPointAt(Math.min(1, Math.max(0, prog(t)))), headD = t => DR.getPointAt(Math.min(1, Math.max(0, progD(t))));
  return { group: G, update, MR, DR, prog, progD, head, headD, P, W, D };
}

// ================= TIMELINE =================
export const TL = { days: [23, 24, 25, 26, 27, 28, 29], queue: [12, 74, 142, 230, 298, 350, 369], tArr: [29.4, 30.4, 31.3, 32.1, 32.8, 33.4, 33.95], x: i => 52 - 8 * i, h: i => 1.6 + TL.queue[i] * 0.026 };
export function buildTimeline(ctx, O) {
  const { M } = ctx, G = new THREE.Group(); G.position.copy(O);
  const plinth = new THREE.Mesh(rb(62, 0.9, 6.6, 0.2), M.WHITE); plinth.position.set(28, 0.45, 0); plinth.castShadow = plinth.receiveShadow = true; G.add(plinth);
  const pil = [], items = [], nums = [];
  const mkItem = (i) => { let o, s;
    switch (i) { case 0: o = containerShip(ctx.KM, { seed: 3 }); s = 3.9; o.rotation.y = 0.82; break; case 1: o = tug(ctx.KM); s = 2.8; break;
      case 2: o = excavator(ctx.KM); s = 2.4; o.rotation.y = -0.6; break; case 3: o = dredger(ctx.KM); s = 3.8; break;
      case 4: o = new THREE.Group(); for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(rb(1.3, 0.75, 0.75, 0.06), k === 1 ? M.GREY : M.WHITE); c.position.set(k * 0.15 - 0.1, 0.4 + k * 0.78, 0); c.rotation.y = k * 0.2; c.castShadow = true; o.add(c); } s = 1; break;
      case 5: o = containerShip(ctx.KM, { seed: 9 }); s = 3.9; break;
      default: o = containerShip(ctx.KMR ? ctx.KM : ctx.KM, { seed: 1 }); s = 3.9; }
    o.userData.s = s; return o; };
  for (let i = 0; i < 7; i++) { const x = TL.x(i), h = TL.h(i);
    const pg = new THREE.BoxGeometry(4, 1, 4); pg.translate(0, 0.5, 0);
    const p = new THREE.Mesh(pg, i === 6 ? M.RED : M.WHITE); p.position.set(x, 0.9, 0); p.castShadow = p.receiveShadow = true; G.add(p); pil.push(p);
    const it = mkItem(i); G.add(it); items.push(it);
    const lab = textPlane(ctx, "MAR " + TL.days[i], 3.0, 0.62, { win: [TL.tArr[i] - 0.9, TL.tArr[i] + 1.2], fill: 0.86 }); lab.position.set(x, 0.42, -3.31); lab.rotation.y = Math.PI; G.add(lab);
    const nt = textPlane(ctx, "0", 3.0, 1.15, { win: [TL.tArr[i] - 0.3, TL.tArr[i] + 1.2], color: i === 6 ? "#fff" : "#555", fill: 0.9 }); nt.rotation.y = Math.PI; G.add(nt); nums.push(nt);
    const nb = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.06), M.DARK); nb.position.set(x, 0.55, -3.33); G.add(nb); }
  // header sign: what the pillars count
  const hdr = new THREE.Group(); { const sl = new THREE.Mesh(rb(5.0, 1.2, 0.18, 0.12), M.WHITE); sl.position.y = 0.6; sl.castShadow = true; hdr.add(sl);
    const tp = textPlane(ctx, "SHIPS WAITING", 4.7, 0.9, { win: [28.4, 31], fill: 0.8 }); tp.position.set(0, 0.6, -0.1); tp.rotation.y = Math.PI; hdr.add(tp);
    for (const s of [-1, 1]) { const pp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6), M.GREY); pp.position.set(s * 2.0, -0.5, 0); hdr.add(pp); } }
  hdr.position.set(60, 1.9, -1.6); G.add(hdr);
  // FREED banner on the red pillar
  const fr = new THREE.Group(); { const sl = new THREE.Mesh(rb(3.7, 1.15, 0.22, 0.14), M.WHITE); sl.castShadow = true; fr.add(sl);
    const tp = textPlane(ctx, "FREED", 3.4, 0.95, { win: [34.3, 36], color: "#cf2219", fill: 0.85 }); tp.position.set(0, 0, -0.12); tp.rotation.y = Math.PI; fr.add(tp); }
  G.add(fr);
  const rise = (t, i) => { const u = (t - (TL.tArr[i] - 0.5)) / 0.75; return u <= 0 ? 0 : pop(u); };
  function update(t) {
    for (let i = 0; i < 7; i++) { const x = TL.x(i), h = TL.h(i), r = rise(t, i), rc = Math.min(1, Math.max(0, r)), p = pil[i];
      p.scale.y = Math.max(0.001, h * r); p.visible = r > 0.001;
      const topY = 0.9 + h * Math.max(0, r), it = items[i], s = it.userData.s, ip = pop((t - (TL.tArr[i] + 0.1)) / 0.45);
      it.visible = ip > 0.01; it.scale.setScalar(Math.max(0.001, s * ip)); it.position.set(x, topY + (i === 4 ? 0 : 0.02), 0);
      const nt = nums[i]; nt.visible = r > 0.35; const val = Math.round(TL.queue[i] * smooth((t - (TL.tArr[i] - 0.4)) / 0.9)); nt.userData.set(String(val));
      nt.position.set(x, 0.9 + h * Math.max(0.5, rc) - 1.0, -2.06); }
    const hi = TL.h(6), r6 = rise(t, 6); fr.visible = t > TL.tArr[6] + 0.2; fr.scale.setScalar(Math.max(0.001, pop((t - (TL.tArr[6] + 0.2)) / 0.45)));
    fr.position.set(TL.x(6), 0.9 + hi * 0.45, -2.16);
    items[2].userData.arm?.rotation && (items[2].userData.arm.rotation.z = -0.5 + Math.sin(t * 3) * 0.2);
  }
  // occluders for the camera checker (final pillar size)
  const occ = pil.map((p, i) => ({ c: new THREE.Vector3(O.x + TL.x(i), 0.9 + TL.h(i) / 2, O.z), hs: new THREE.Vector3(2, TL.h(i) / 2, 2) }));
  return { group: G, update, occ };
}

// ================= STRING BOARD =================
export const CARDS = [
  { id: "eg", txt: "EVER GIVEN", x: 0, y: 9.8, w: 3.9, h: 2.3, t: 36.15, glyph: "eg" },
  { id: "tr", txt: "12% trade", x: -2.1, y: 14.8, w: 3.4, h: 2.2, t: 36.85, glyph: "pie", str: "red" },
  { id: "sh", txt: "369 ships", x: 2.1, y: 14.8, w: 3.4, h: 2.2, t: 37.55, glyph: "ships" },
  { id: "oil", txt: "Oil", x: -4.0, y: 9.8, w: 3.4, h: 2.2, t: 38.15, glyph: "oil" },
  { id: "car", txt: "Car parts", x: 4.0, y: 9.8, w: 3.4, h: 2.2, t: 38.75, glyph: "car" },
  { id: "cof", txt: "Coffee", x: -2.1, y: 5.0, w: 3.4, h: 2.2, t: 39.35, glyph: "coffee" },
  { id: "fur", txt: "Furniture", x: 2.1, y: 5.0, w: 3.4, h: 2.2, t: 39.95, glyph: "chair" },
  { id: "liv", txt: "Livestock", x: 0, y: 1.5, w: 3.4, h: 2.2, t: 40.55, glyph: "sheep" }];
export function buildBoard(ctx, O) {
  const { M } = ctx, G = new THREE.Group(); G.position.copy(O);
  const base = new THREE.Mesh(rb(34, 0.7, 26, 0.3), M.WHITE); base.position.set(0, -0.35, 6); base.receiveShadow = true; G.add(base);
  const panel = new THREE.Mesh(rb(13.4, 18.4, 0.6, 0.35), M.WHITE); panel.position.set(0, 9.2, -0.3); panel.castShadow = panel.receiveShadow = true; G.add(panel);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 10, 8), M.GREY); leg.position.set(s * 4.5, 5, -3.2); leg.rotation.x = 0.38; leg.castShadow = true; G.add(leg); }
  const glyphOf = (g) => { const o = new THREE.Group(), add = (geo, mat, x = 0, y = 0, z = 0, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; o.add(m); return m; };
    if (g === "eg") { const s = ship(ctx.KMR, "cargo"); s.scale.setScalar(2.6); s.position.y = -0.35; o.add(s); s.traverse(m => m.isMesh && (m.castShadow = true)); }
    else if (g === "pie") { add(new THREE.CylinderGeometry(0.62, 0.62, 0.18, 32), M.WHITE, 0, 0.05, 0, Math.PI / 2); const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.absarc(0, 0, 0.62, 0, Math.PI * 2 * 0.12 * 1.0 + 0.6, false); sh.lineTo(0, 0);
      const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false }); const w = new THREE.Mesh(eg, M.DARK); w.castShadow = true; w.position.set(0, 0.05, 0.09); o.add(w); w.scale.setScalar(1.07); }
    else if (g === "ships") { for (let k = 0; k < 3; k++) { const s = ship(ctx.KM, "cargo"); s.scale.setScalar(1.05); s.position.set(-0.45 + k * 0.45, -0.5 + k * 0.3, 0); s.rotation.y = 0; o.add(s); s.traverse(m => m.isMesh && (m.castShadow = true)); } }
    else if (g === "oil") { add(new THREE.SphereGeometry(0.42, 20, 14), M.DARK, 0, -0.15, 0); add(new THREE.ConeGeometry(0.34, 0.7, 20), M.DARK, 0, 0.3, 0); }
    else if (g === "car") { const c = car(ctx.KM, "sedan"); c.scale.setScalar(1.7); c.position.set(0, -0.35, 0); o.add(c); c.traverse(m => m.isMesh && (m.castShadow = true)); }
    else if (g === "coffee") { add(new THREE.CylinderGeometry(0.34, 0.26, 0.5, 20), M.WHITE, 0, 0.05, 0); add(new THREE.TorusGeometry(0.17, 0.05, 8, 16), M.WHITE, 0.4, 0.05, 0, 0).rotation.z = 0; add(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 28), M.DARK, 0, -0.23, 0); }
    else if (g === "chair") { add(new THREE.BoxGeometry(0.7, 0.1, 0.7), M.WHITE, 0, -0.05, 0); add(new THREE.BoxGeometry(0.7, 0.7, 0.1), M.WHITE, 0, 0.3, -0.3); for (const [x, z] of [[-.28, -.28], [.28, -.28], [-.28, .28], [.28, .28]]) add(new THREE.BoxGeometry(0.08, 0.5, 0.08), M.DARK, x, -0.35, z); }
    else if (g === "sheep") { add(new THREE.SphereGeometry(0.4, 16, 12), M.WHITE, 0, 0, 0).scale.set(1.3, 0.9, 0.9); add(new THREE.SphereGeometry(0.17, 12, 10), M.DARK, 0.58, 0.08, 0); for (const [x, z] of [[-.3, -.15], [.3, -.15], [-.3, .15], [.3, .15]]) add(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), M.DARK, x, -0.4, z); }
    return o; };
  const cards = CARDS.map(c => { const g = new THREE.Group(); const slab = new THREE.Mesh(rb(c.w, c.h, 0.28, 0.2), M.WHITE); slab.castShadow = slab.receiveShadow = true; g.add(slab);
    if (c.id === "eg") { const fm = new THREE.Group(); const t = 0.14; for (const [w, h, x, y] of [[c.w + 0.3, t, 0, (c.h + 0.16) / 2], [c.w + 0.3, t, 0, -(c.h + 0.16) / 2], [t, c.h + 0.3, (c.w + 0.16) / 2, 0], [t, c.h + 0.3, -(c.w + 0.16) / 2, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), M.RED); b.position.set(x, y, 0); fm.add(b); } g.add(fm); }
    const tp = textPlane(ctx, c.txt, c.w * 0.94, c.h * 0.36, { win: [c.t + 0.2, 44], color: c.id === "eg" ? "#cf2219" : "#555", fill: 0.78 }); tp.position.set(0, -c.h * 0.29, 0.145); g.add(tp);
    const gl = glyphOf(c.glyph); gl.position.set(0, c.h * 0.12, 0.34); g.add(gl);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8), M.GREY); pin.rotation.x = Math.PI / 2; pin.position.set(0, c.h / 2 - 0.12, 0.3); g.add(pin);
    G.add(g); return g; });
  // strings: chains of thin cylinders; sag shrinks to zero as they pull taut
  const pinPos = c => new THREE.Vector3(c.x, c.y + c.h / 2 - 0.12, 0.62);
  const links = [["eg", "tr", 0xcf2219, 36.95], ["eg", "sh", 0xbdbcb8, 37.7], ["eg", "oil", 0xbdbcb8, 38.3], ["eg", "car", 0xbdbcb8, 38.9], ["eg", "cof", 0xbdbcb8, 39.5], ["eg", "fur", 0xbdbcb8, 40.1], ["eg", "liv", 0xbdbcb8, 40.7], ["tr", "sh", 0xbdbcb8, 41.4]];
  const NS = 14, cg = new THREE.CylinderGeometry(1, 1, 1, 5); const bymat = {};
  const strings = links.map(([a, b, col, t0]) => { const ca = CARDS.find(c => c.id === a), cb = CARDS.find(c => c.id === b); const key = col; bymat[key] ??= new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 });
    const segs = Array.from({ length: NS }, () => { const m = new THREE.Mesh(cg, bymat[key]); m.castShadow = true; G.add(m); return m; });
    return { ca, cb, t0, segs, red: col === 0xcf2219 }; });
  const Y = new THREE.Vector3(0, 1, 0);
  function layStr(s, t) { const u = (t - s.t0) / 0.45, vis = u > 0 && t > s.cb.t - 0.05; const tau = smooth(u), sag = (1 - pop(Math.min(1, Math.max(0, u)))) * 0 + (1 - tau) * 1.1;
    const A = pinPos(s.ca), B = pinPos(s.cb); const pts = []; for (let k = 0; k <= NS; k++) { const f = k / NS; const p = A.clone().lerp(B, f); p.y -= sag * Math.sin(Math.PI * f); p.z += 0.0; pts.push(p); }
    s.segs.forEach((m, k) => { m.visible = vis; if (!vis) return; const a = pts[k], b = pts[k + 1], d = b.clone().sub(a), len = d.length(); m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(Y, d.clone().normalize()); const r = s.red ? 0.07 : 0.05; m.scale.set(r, len * 1.02, r); }); }
  function update(t) {
    CARDS.forEach((c, i) => { const g = cards[i], u = (t - c.t) / 0.5; g.visible = u > 0; const d = u <= 0 ? 8 : (1 - Math.min(1, u)) * 7 + (u > 1 ? 0 : 0);
      const settle = u <= 1 ? 0 : Math.max(0, Math.sin((u - 1) * 14) * 0.18 * Math.exp(-(u - 1) * 5));
      g.position.set(c.x, c.y + d * (1 - smooth(Math.min(1, u))) * (u < 1 ? 1 : 0) + settle, 0.3); const sc = 1; g.scale.setScalar(sc); });
    strings.forEach(s => layStr(s, t)); }
  return { group: G, update, cards, occ: [{ c: new THREE.Vector3(O.x, 9.2, O.z - 0.3), hs: new THREE.Vector3(6.9, 9.3, 0.4) }] };
}
