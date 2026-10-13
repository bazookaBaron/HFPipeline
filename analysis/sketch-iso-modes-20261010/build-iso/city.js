/* city.js: ISO demo, dense city, 30 s. Wide busy city -> push to a district -> HQ tower (large subject) -> a bus (small) -> a car hidden behind a tower (x-ray) -> pull back. */
window.SCENE = function () {
  const THEME = (window.THEME = Theme.get("teal")); Theme.apply(THEME);
  const root = document.getElementById("root"), W = +root.dataset.width, H = +root.dataset.height, DUR = +root.dataset.duration;
  const $ = (q) => document.querySelector(q);
  const tl = ISO.timeline();
  ISO.init(tl, { host: $("#iso"), labels: $("#labels"), W, H, dur: DUR });
  const t0 = performance.now();
  const city = WORLDS.city(20261010, { blocksX: 5, blocksY: 4, cars: 84, buses: 4, dur: DUR, heroBlock: 9, park: 16, far: (b) => b.i === 0 || b.i === 4 });
  ISO.stats.genMs = +(performance.now() - t0).toFixed(1); ISO.stats.collisions = city.sim.collisions;
  const K = 0.62, box = { x0: 40, y0: 40, x1: 1490, y1: H - 40 };
  const V = ISO.view(45, K), B = city.G.bounds, cs = [[B[0], B[1]], [B[2], B[1]], [B[2], B[3]], [B[0], B[3]]].map((p) => V.P(p[0], p[1], 0));
  const zf = Math.sqrt(1 - K * K), X0 = Math.min(...cs.map((p) => p[0])), X1 = Math.max(...cs.map((p) => p[0])), Y0 = Math.min(...cs.map((p) => p[1])) - 200 * zf, Y1 = Math.max(...cs.map((p) => p[1])) + 12 * zf;
  const S0 = Math.min((box.x1 - box.x0) / (X1 - X0), (box.y1 - box.y0) / (Y1 - Y0));
  ISO.cam({ az: 45, k: K, S: S0, fx: 0, fy: 0, fz: 0, sx: (box.x0 + box.x1) / 2 - S0 * (X0 + X1) / 2, sy: (box.y0 + box.y1) / 2 - S0 * (Y0 + Y1) / 2 });
  ISO.safe = { x0: 24, y0: 24, x1: 1520, y1: H - 24 };            // chips stay left of the puppet; the WORLD is not clipped (it runs behind the puppet)
  ISO.focusSafe = { x0: 60, y0: 230, x1: 1480, y1: 1030 };        // subjects land here
  ISO.winLit = (t, p) => { const u = (((t / 9 - p) % 1) + 1) % 1; return u < 0.18 + 0.4 * Math.min(1, t / DUR); };
  const hero = city.hero, T = hero.o.tiers, top = T[T.length - 1], hc = [(top.x0 + top.x1) / 2, (top.y0 + top.y1) / 2, top.z1];
  // camera
  ISO.camTo(0, { S: S0 * 1.035, fy: -14 }, { d: 5, ease: "sine.inOut" });
  ISO.camTo(5.2, { fx: hc[0], fy: hc[1], fz: hc[2] * 0.45, S: S0 * 2.2, sx: 760, sy: 600 }, { d: 4.5, ease: "power2.inOut" });
  ISO.orbit(10.5, 37, { d: 6.5, ease: "sine.inOut" });
  ISO.camTo(16.5, { fx: hc[0] + 40, fy: hc[1] + 60, S: S0 * 1.9 }, { d: 3.5, ease: "sine.inOut" });
  ISO.home(20.5, { d: 4.5, ease: "power2.inOut" });
  // beats: each declares a subject (tier from the provider: HQ large, cars small)
  ISO.subjects.hq = WORLDS.subjectStatic(hero);
  ISO.focus("hq", 9.8, 15.6); ISO.label(null, "HEADQUARTERS", 9.9, { out: 15.6, dy: -26, fill: "marker", sub: "hq" });
  const near = (c) => { for (let t = 17.2; t <= 20; t += 0.4) { const p = city.sim.sample(c.id, t); if (Math.hypot(p[0] - hc[0] - 40, p[1] - hc[1] - 60) > 170) return false; } return true; };
  const veh = city.sim.cars.find((c) => c.kind === "bus" && near(c)) || city.sim.cars.find(near) || city.sim.cars[0];
  ISO.subjects.veh = WORLDS.subjectCar(city.sim, veh.id);
  ISO.focus("veh", 17.2, 20.2); ISO.label(null, veh.kind === "bus" ? "BUS LINE 12" : "RUSH HOUR", 17.3, { out: 20.2, dy: -26, sub: "veh" });
  // a car HIDDEN behind a tall building from this camera (az 37): the focus must x-ray the building
  const Vh = ISO.view(37, K), boxes = ISO.world.statics.filter((st) => st.o && st.o.tiers).map((st) => { const Tt = st.o.tiers, pts = []; Tt.forEach((q) => [q.z0, q.z1].forEach((z) => [[q.x0, q.y0], [q.x1, q.y0], [q.x1, q.y1], [q.x0, q.y1]].forEach(([x, y]) => pts.push(Vh.P(x, y, z))))); const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return { fp: st.fp, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }; });
  const cover = (c, t) => { const sj = WORLDS.subjectCar(city.sim, c.id)(t), pp = sj.pts3.map((q) => Vh.P(q[0], q[1], q[2])), xs = pp.map((p) => p[0]), ys = pp.map((p) => p[1]), b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], A = (b[2] - b[0]) * (b[3] - b[1]);
    let best = 0; boxes.forEach((o) => { if (!ISO.behind(sj.fp, o.fp, Vh)) return; const w = Math.min(b[2], o.bb[2]) - Math.max(b[0], o.bb[0]), h = Math.min(b[3], o.bb[3]) - Math.max(b[1], o.bb[1]); if (w > 0 && h > 0) best = Math.max(best, (w * h) / A); }); return best; };
  let hid = null, hidScore = -1;
  city.sim.cars.forEach((c) => { if (c.kind !== "car") return; let m = 1; for (let t = 22.2; t <= 25.8; t += 1) m = Math.min(m, cover(c, t)); if (m > hidScore) { hidScore = m; hid = c; } });
  ISO.stats.hiddenCar = { id: hid.id, minCover: +hidScore.toFixed(2) };
  ISO.subjects.hid = WORLDS.subjectCar(city.sim, hid.id);
  ISO.focus("hid", 22.2, 25.8); ISO.label(null, "THIS CAR", 22.3, { out: 25.8, dy: -26, sub: "hid" });
  ISO.label([0, 0, 40], "84 CARS · 1 CITY", 27, { out: 29.6, dy: -430 });
  // puppet
  const ph = 640, pcx = 1660, pfloor = 1045, wd = Math.round((318 * ph) / 620);
  const host = $("#pz"); Object.assign(host.style, { left: pcx - wd / 2 + "px", top: pfloor - ph + 12 + "px", width: wd + "px" });
  const P = Puppet.mount("#pz", { mode: "full", height: ph, id: "pzp", theme: { shadow: THEME.shadow } });
  [1.4, 9.9, 17.3, 22.3].forEach((t) => { P.pointScreen(tl, t, "l"); P.pose(tl, t + 1.9, "stand", { d: 0.4 }); });
  P.pose(tl, 27, "present_left", { hold: 1.8 }); P.pose(tl, 29, "stand", { d: 0.4 });
  P.blinks(tl, DUR, { seed: 11 }); P.idle(tl, 0, DUR);
  tl.to({}, { duration: DUR }, 0);
  tl.seek(0);
  ISO.redraw();
  return tl;
};
