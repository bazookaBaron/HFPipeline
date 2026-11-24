// ================= STRING BOARD (hub + 4 satellites, pin-to-pin strings that never cross a card or each other) =================
export const CARDS = [
  { id: "eg", txt: "EVER GIVEN", x: 0, y: 9.5, w: 3.6, h: 2.3, t: 37.2, glyph: "eg" },
  { id: "tr", txt: "12% trade", x: -3.4, y: 15.5, w: 2.9, h: 2.1, t: 38.1, glyph: "pie" },
  { id: "sh", txt: "369 ships", x: 3.4, y: 15.5, w: 2.9, h: 2.1, t: 39.2, glyph: "ships" },
  { id: "oil", txt: "Oil", x: -3.4, y: 3.5, w: 2.9, h: 2.1, t: 40.3, glyph: "oil" },
  { id: "car", txt: "Car parts", x: 3.4, y: 3.5, w: 2.9, h: 2.1, t: 41.3, glyph: "car" }];
export const LINKS = [
  { a: "eg", b: "tr", pa: [-1.0, 10.65], pb: [-3.4, 14.45], red: true, t0: 38.7 },
  { a: "eg", b: "sh", pa: [1.0, 10.65], pb: [3.4, 14.45], red: false, t0: 39.8 },
  { a: "eg", b: "oil", pa: [-1.0, 8.35], pb: [-3.4, 4.55], red: false, t0: 40.9 },
  { a: "eg", b: "car", pa: [1.0, 8.35], pb: [3.4, 4.55], red: false, t0: 41.9 },
  { a: "tr", b: "sh", pa: [-1.95, 15.5], pb: [1.95, 15.5], red: false, t0: 42.5 }];
const PZ = 0.52;
export function buildBoard(ctx, O) {
  const { M } = ctx, G = new THREE.Group(); G.position.copy(O);
  const base = new THREE.Mesh(rb(34, 0.7, 26, 0.3), M.WHITE); base.position.set(0, -0.35, 6); base.receiveShadow = true; G.add(base);
  const panel = new THREE.Mesh(rb(11.6, 18.6, 0.6, 0.35), new THREE.MeshStandardMaterial({ color: 0xe6e4df, roughness: 0.9 })); panel.position.set(0, 9.3, -0.3); panel.receiveShadow = true; G.add(panel);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 10, 8), M.GREY); leg.position.set(s * 4.2, 5, -3.2); leg.rotation.x = 0.38; G.add(leg); }
  const glyphOf = (g) => { const o = new THREE.Group(), add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); o.add(m); return m; };
    if (g === "eg") { const s = ship(ctx.KMR, "cargo"); s.scale.setScalar(2.4); s.position.y = -0.3; o.add(s); }
    else if (g === "pie") { add(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 32), M.WHITE, 0, 0, 0).rotation.x = Math.PI / 2; const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.absarc(0, 0, 0.5, 0, Math.PI * 2 * 0.12 + 0.6, false); sh.lineTo(0, 0);
      const w = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.26, bevelEnabled: false }), M.DARK); o.add(w); w.scale.setScalar(1.08); }
    else if (g === "ships") { for (let k = 0; k < 3; k++) { const s = ship(ctx.KM, "cargo"); s.scale.setScalar(0.95); s.position.set(-0.4 + k * 0.4, -0.35 + k * 0.28, 0); o.add(s); } }
    else if (g === "oil") { add(new THREE.SphereGeometry(0.34, 20, 14), M.DARK, 0, -0.12, 0); add(new THREE.ConeGeometry(0.27, 0.56, 20), M.DARK, 0, 0.24, 0); }
    else if (g === "car") { const c = car(ctx.KM, "sedan"); c.scale.setScalar(1.5); c.position.set(0, -0.3, 0); o.add(c); }
    o.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } }); return o; };
  const cards = CARDS.map(c => { const g = new THREE.Group(); const slab = new THREE.Mesh(rb(c.w, c.h, 0.28, 0.2), M.WHITE); slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
    if (c.id === "eg") { const t = 0.14; for (const [w, h, x, y] of [[c.w + 0.3, t, 0, (c.h + 0.16) / 2], [c.w + 0.3, t, 0, -(c.h + 0.16) / 2], [t, c.h + 0.3, (c.w + 0.16) / 2, 0], [t, c.h + 0.3, -(c.w + 0.16) / 2, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), M.RED); b.position.set(x, y, 0); g.add(b); } }
    const tp = textPlane(ctx, c.txt, c.w * 0.96, c.h * 0.3, { win: [c.t + 0.4, 44], color: c.id === "eg" ? "#cf2219" : "#555", fill: 0.82 }); tp.position.set(0, -c.h * 0.3, 0.145); g.add(tp);
    const gl = glyphOf(c.glyph); gl.position.set(0, c.h * 0.17, 0.3); g.add(gl); G.add(g); return g; });
  const bymat = {}; const matOf = red => bymat[red] ??= new THREE.MeshStandardMaterial({ color: red ? 0xcf2219 : 0xaaa9a5, roughness: 0.6 });
  const NS = 14, cg = new THREE.CylinderGeometry(1, 1, 1, 5), Y = new THREE.Vector3(0, 1, 0);
  const strings = LINKS.map(l => { const ca = CARDS.find(c => c.id === l.a), cb = CARDS.find(c => c.id === l.b);
    const segs = Array.from({ length: NS }, () => { const m = new THREE.Mesh(cg, matOf(l.red)); m.castShadow = false; G.add(m); return m; });
    l.nubs = []; for (const p of [l.pa, l.pb]) { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.34, 8), M.GREY); n.rotation.x = Math.PI / 2; n.position.set(p[0], p[1], 0.36); G.add(n); l.nubs.push(n); }
    return { l, ca, cb, segs }; });
  const strPts = (s, t) => { const u = (t - s.l.t0) / 0.5, sag = (1 - smooth(u)) * 0.9, A = new THREE.Vector3(s.l.pa[0], s.l.pa[1], PZ), B = new THREE.Vector3(s.l.pb[0], s.l.pb[1], PZ), pts = [];
    for (let k = 0; k <= NS; k++) { const f = k / NS, p = A.clone().lerp(B, f); p.y -= sag * Math.sin(Math.PI * f); pts.push(p); } return pts; };
  const strVis = (s, t) => t > s.l.t0 && t > s.cb.t + 0.3 && t > s.ca.t + 0.3;
  function update(t) {
    CARDS.forEach((c, i) => { const g = cards[i], u = (t - c.t) / 0.5; g.visible = u > 0; const drop = u <= 0 ? 8 : (1 - smooth(Math.min(1, u))) * 7, settle = u <= 1 ? 0 : Math.max(0, Math.sin((u - 1) * 14) * 0.15 * Math.exp(-(u - 1) * 5));
      g.position.set(c.x, c.y + drop + settle, 0.3); });
    strings.forEach(s => { const vis = strVis(s, t), pts = strPts(s, t); s.l.nubs.forEach(n => n.visible = vis);
      s.segs.forEach((m, k) => { m.visible = vis; if (!vis) return; const a = pts[k], b = pts[k + 1], d = b.clone().sub(a), len = d.length(); m.position.copy(a).add(b).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(Y, d.clone().normalize()); const r = s.l.red ? 0.07 : 0.05; m.scale.set(r, len * 1.02, r); }); }); }
  // layout data for the overlap gate (world coordinates)
  const rects = t => CARDS.map(c => ({ id: c.id, vis: t > c.t + 0.6, cx: O.x + c.x, cy: c.y, cz: O.z + 0.44, w: c.w, h: c.h }));
  const strs = t => strings.map(s => ({ a: s.l.a, b: s.l.b, vis: strVis(s, t) && t > s.l.t0 + 0.6, pts: strPts(s, t).map(p => p.clone().add(O)) }));
  return { group: G, update, cards, rects, strs, occ: [{ c: new THREE.Vector3(O.x, 9.3, O.z - 0.3), hs: new THREE.Vector3(5.8, 9.3, 0.4) }] };
}
