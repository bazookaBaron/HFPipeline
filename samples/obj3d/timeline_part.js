// ================= TIMELINE: a compact, readable bar chart (camera on the +z side; day 23 left -> day 29 right) =================
export const TL = { days: [23, 24, 25, 26, 27, 28, 29], queue: [12, 74, 142, 230, 298, 350, 369], tArr: [0, 1, 2, 3, 4, 5, 6].map(i => 28.4 + 0.9 * i), x: i => 6 + 2.5 * i, h: i => 1.6 + TL.queue[i] * 0.026 };
export const PL = 1.5;
export function buildTimeline(ctx, O) {
  const { M } = ctx, G = new THREE.Group(); G.position.copy(O);
  const plinth = new THREE.Mesh(rb(21, PL, 4.6, 0.2), M.WHITE); plinth.position.set(13.5, PL / 2, 0); plinth.castShadow = plinth.receiveShadow = true; G.add(plinth);
  const pil = [], items = [], nums = [];
  const mkItem = (i) => { let o, s;
    switch (i) { case 0: o = containerShip(ctx.KM, { seed: 3, rows: 8 }); s = 2.3; o.rotation.y = 0.9; break; case 1: o = tug(ctx.KM); s = 1.9; break;
      case 2: o = excavator(ctx.KM); s = 1.5; o.rotation.y = -0.6; break; case 3: o = dredger(ctx.KM); s = 2.3; break;
      case 4: o = new THREE.Group(); for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(rb(0.9, 0.5, 0.5, 0.05), k === 1 ? M.GREY : M.WHITE); c.position.set(k * 0.08 - 0.05, 0.27 + k * 0.52, 0); c.castShadow = true; o.add(c); } s = 1; break;
      case 5: o = containerShip(ctx.KM, { seed: 9, rows: 8 }); s = 2.3; break;
      default: o = containerShip(ctx.KM, { seed: 1, rows: 8 }); s = 2.3; }
    o.userData.s = s; return o; };
  for (let i = 0; i < 7; i++) { const x = TL.x(i);
    const pg = new THREE.BoxGeometry(1.9, 1, 1.9); pg.translate(0, 0.5, 0);
    const p = new THREE.Mesh(pg, i === 6 ? M.RED : M.WHITE); p.position.set(x, PL, 0); p.castShadow = p.receiveShadow = true; G.add(p); pil.push(p);
    const it = mkItem(i); G.add(it); items.push(it);
    const lab = textPlane(ctx, String(TL.days[i]), 2.0, 1.2, { win: [TL.tArr[i] - 0.6, 37.0], fill: 0.88 }); lab.position.set(x, 0.75, 2.31); G.add(lab);
    const nt = textPlane(ctx, "0", 1.8, 0.95, { win: [TL.tArr[i] + 0.1, 37.0], color: i === 6 ? "#fff" : "#555", fill: 0.9 }); G.add(nt); nums.push(nt); }
  // banner on two posts behind the bars: what the bars count
  const hdr = new THREE.Group(); { const sl = new THREE.Mesh(rb(16.5, 1.9, 0.2, 0.14), M.WHITE); sl.castShadow = true; hdr.add(sl);
    const tp = textPlane(ctx, "SHIPS WAITING  /  MARCH", 15.8, 1.5, { win: [34.6, 37.0], fill: 0.8 }); tp.position.set(0, 0, 0.11); hdr.add(tp);
    for (const s of [-1, 1]) { const pp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 15, 8), M.GREY); pp.position.set(s * 8.4, -7.5, 0); pp.castShadow = true; hdr.add(pp); } }
  hdr.position.set(13.5, 15.2, -2.2); G.add(hdr);
  const fr = new THREE.Group(); { const sl = new THREE.Mesh(rb(2.6, 0.9, 0.2, 0.12), M.WHITE); sl.castShadow = true; fr.add(sl);
    const tp = textPlane(ctx, "FREED", 2.4, 0.76, { win: [TL.tArr[6] + 0.5, 37.0], color: "#cf2219", fill: 0.85 }); tp.position.set(0, 0, 0.11); fr.add(tp); }
  G.add(fr);
  const rise = (t, i) => { const u = (t - (TL.tArr[i] - 0.5)) / 0.6; return u <= 0 ? 0 : pop(u); }, prog01 = (t, i) => smooth((t - (TL.tArr[i] - 0.5)) / 0.6);
  function update(t) {
    for (let i = 0; i < 7; i++) { const x = TL.x(i), h = TL.h(i), r = rise(t, i), rc = Math.min(1, Math.max(0, r)), p = pil[i];
      p.scale.y = Math.max(0.001, h * r); p.visible = r > 0.001;
      const topY = PL + h * Math.max(0, r), it = items[i], s = it.userData.s, ip = pop((t - (TL.tArr[i] + 0.15)) / 0.45);
      it.visible = ip > 0.01; it.scale.setScalar(Math.max(0.001, s * ip)); it.position.set(x, topY, 0);
      const nt = nums[i]; nt.visible = r > 0.05; nt.userData.set(String(Math.round(TL.queue[i] * prog01(t, i)))); nt.position.set(x, PL + Math.max(0.6, h * rc) - 0.75, 0.96); }
    const hi = TL.h(6); fr.visible = t > TL.tArr[6] + 0.3; fr.scale.setScalar(Math.max(0.001, pop((t - (TL.tArr[6] + 0.3)) / 0.45))); fr.position.set(TL.x(6), PL + hi * 0.5, 1.05 + 0.0);
    items[2].userData.arm.rotation.z = -0.5 + Math.sin(t * 3) * 0.2;
  }
  const occ = pil.map((p, i) => ({ c: new THREE.Vector3(O.x + TL.x(i), PL + TL.h(i) / 2, O.z), hs: new THREE.Vector3(1.0, TL.h(i) / 2, 1.0) }));
  return { group: G, update, occ };
}

