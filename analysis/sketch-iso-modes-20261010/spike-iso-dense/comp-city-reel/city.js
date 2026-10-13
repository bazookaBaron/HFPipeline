/* city.js: dense iso city, ~40 s. Wide busy city -> push into a district -> one tower highlighted (marker) + chip -> pull back.
 * Shared by comp-city/ (1920x1080) and comp-city-reel/ (1080x1920). */
window.SCENE = function () {
  const THEME = (window.THEME = Theme.get("teal")); Theme.apply(THEME);
  const root = document.getElementById("root"), W = +root.dataset.width, H = +root.dataset.height, DUR = +root.dataset.duration, REEL = H > W;
  const $ = (q) => document.querySelector(q);
  const tl = WK.timeline();
  WK.init(tl, { host: $("#wk"), over: $("#wk-over"), labels: $("#labels"), W, H, dur: DUR });
  const t0 = performance.now();
  const city = WORLDS.city(20261010, { blocksX: 5, blocksY: 4, cars: 84, buses: 4, dur: DUR, heroBlock: 9, park: 16, far: (b) => b.i === 0 || b.i === 4 });
  WK.stats.genMs = +(performance.now() - t0).toFixed(1); WK.stats.collisions = city.sim.collisions;
  const K = REEL ? 0.7 : 0.62;
  // fit the whole platform (+ tall towers) into the content box (puppet zone kept clear)
  const box = REEL ? { x0: 30, y0: 90, x1: W - 30, y1: 1330 } : { x0: 40, y0: 40, x1: 1490, y1: H - 40 };
  const V = WK.view(45, K), B = city.G.bounds, cs = [[B[0], B[1]], [B[2], B[1]], [B[2], B[3]], [B[0], B[3]]].map((p) => V.P(p[0], p[1], 0));
  const zf = Math.sqrt(1 - K * K), X0 = Math.min(...cs.map((p) => p[0])), X1 = Math.max(...cs.map((p) => p[0])), Y0 = Math.min(...cs.map((p) => p[1])) - 200 * zf, Y1 = Math.max(...cs.map((p) => p[1])) + 12 * zf;
  const S0 = Math.min((box.x1 - box.x0) / (X1 - X0), (box.y1 - box.y0) / (Y1 - Y0)) * (REEL ? 1.45 : 1); // reel: fill the board zone (platform sides crop)
  const HOME = { az: 45, k: K, S: S0, fx: 0, fy: 0, fz: 0, sx: (box.x0 + box.x1) / 2 - S0 * (X0 + X1) / 2, sy: (box.y0 + box.y1) / 2 - S0 * (Y0 + Y1) / 2 };
  WK.cam(HOME);
  // keep the world out of the puppet zone (LF: right 360 px, reel: bottom 560 px)
  $("#wk").style.clipPath = REEL ? "inset(0 0 560px 0)" : "inset(0 360px 0 0)";
  WK.safe = REEL ? { x0: 24, y0: 60, x1: W - 24, y1: 1360 } : { x0: 24, y0: 24, x1: 1520, y1: H - 24 };
  // window lights: diagonal bands of lit windows sweep the city (period 9 s) and the lit share grows over the video
  WK.winLit = (t, p) => { const u = (((t / 9 - p) % 1) + 1) % 1; return u < 0.18 + 0.4 * Math.min(1, t / DUR) ; };
  const hero = city.hero, T = hero.o.tiers, top = T[T.length - 1], hc = [(top.x0 + top.x1) / 2, (top.y0 + top.y1) / 2, top.z1];
  WK.hiFn = () => false; // marker comes only from the focused subject
  WK.focusSafe = REEL ? { x0: 60, y0: 300, x1: 1020, y1: 1320, minFrac: 0.08 } : { x0: 60, y0: 230, x1: 1480, y1: 1030, minFrac: 0.06 };
  // ---------- camera ----------
  WK.camTo(0, { S: S0 * 1.035, fy: -14 }, { d: 7, ease: "sine.inOut" });
  WK.camTo(7.2, { fx: hc[0], fy: hc[1], fz: hc[2] * 0.45, S: S0 * (REEL ? 2.5 : 2.35), sx: REEL ? 540 : 760, sy: REEL ? 760 : 600 }, { d: 6.5, ease: "power2.inOut" });
  WK.orbit(14.5, 37, { d: 8, ease: "sine.inOut" });
  WK.camTo(21.5, { fx: hc[0] + 40, fy: hc[1] + 60, S: S0 * (REEL ? 2.1 : 1.95) }, { d: 5, ease: "sine.inOut" });
  WK.home(26.5, { d: 6.5, ease: "power2.inOut" });
  WK.camTo(33, { S: S0 * 1.03, fy: 10 }, { d: 7, ease: "sine.inOut" });
  // ---------- beats: each declares a subject; WK.focus frames it, x-rays what covers it, marks it ----------
  WK.subjects.hq = WORLDS.subjectStatic(hero);
  WK.focus("hq", 15.2, 21.4); WK.label(null, "HEADQUARTERS", 15.3, { out: 21.4, dy: -26, fill: "marker", sub: "hq" });
  const near = (c) => { for (let t = 23.4; t <= 26.8; t += 0.4) { const p = city.sim.sample(c.id, t); if (Math.hypot(p[0] - hc[0] - 40, p[1] - hc[1] - 60) > 170) return false; } return true; };
  const veh = city.sim.cars.find((c) => c.kind === "bus" && near(c)) || city.sim.cars.find(near) || city.sim.cars[0];
  WK.subjects.veh = WORLDS.subjectCar(city.sim, veh.id);
  WK.focus("veh", 23.4, 26.8); WK.label(null, veh.kind === "bus" ? "BUS LINE 12" : "RUSH HOUR", 23.5, { out: 26.8, dy: -26, sub: "veh" });
  // a car that is HIDDEN behind a tall building from this camera (az 37 after the orbit): the focus must x-ray the building
  const Vh = WK.view(37, K), boxes = WK.world.statics.filter((st) => st.o && st.o.tiers).map((st) => { const T = st.o.tiers, pts = []; T.forEach((q) => [q.z0, q.z1].forEach((z) => [[q.x0, q.y0], [q.x1, q.y0], [q.x1, q.y1], [q.x0, q.y1]].forEach(([x, y]) => pts.push(Vh.P(x, y, z))))); const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return { fp: st.fp, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }; });
  const cover = (c, t) => { const sj = WORLDS.subjectCar(city.sim, c.id)(t), pp = sj.pts3.map((q) => Vh.P(q[0], q[1], q[2])), xs = pp.map((p) => p[0]), ys = pp.map((p) => p[1]), b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], A = (b[2] - b[0]) * (b[3] - b[1]);
    let best = 0; boxes.forEach((o) => { if (!WK.behind(sj.fp, o.fp, Vh)) return; const w = Math.min(b[2], o.bb[2]) - Math.max(b[0], o.bb[0]), h = Math.min(b[3], o.bb[3]) - Math.max(b[1], o.bb[1]); if (w > 0 && h > 0) best = Math.max(best, (w * h) / A); }); return best; };
  let hid = null, hidScore = -1;
  city.sim.cars.forEach((c) => { if (c.kind !== "car") return; let m = 1; for (let t = 29.4; t <= 33.4; t += 1) m = Math.min(m, cover(c, t)); if (m > hidScore) { hidScore = m; hid = c; } });
  WK.stats.hiddenCar = { id: hid.id, minCover: +hidScore.toFixed(2) };
  WK.subjects.hid = WORLDS.subjectCar(city.sim, hid.id);
  WK.focus("hid", 29.4, 33.4); WK.label(null, "THIS CAR", 29.5, { out: 33.4, dy: -26, sub: "hid" });
  WK.label([0, 0, 40], "84 CARS · 1 CITY", 35.2, { out: 39.4, dy: REEL ? -520 : -430 });
  if (/noxray/.test(location.search)) WK.noXray = true;
  // ---------- puppet ----------
  const ph = REEL ? 560 : 640, pcx = REEL ? 820 : 1660, pfloor = REEL ? 1880 : 1045, wd = Math.round((318 * ph) / 620);
  const host = $("#pz"); Object.assign(host.style, { left: pcx - wd / 2 + "px", top: pfloor - ph + 12 + "px", width: wd + "px" });
  const P = Puppet.mount("#pz", { mode: "full", height: ph, id: "pzp", theme: { shadow: THEME.shadow } });
  [1.4, 15.4, 23.5, 29.5].forEach((t) => { P.pointScreen(tl, t, "l"); P.pose(tl, t + 1.9, "stand", { d: 0.4 }); });
  P.pose(tl, 35.2, "present_left", { hold: 1.8 }); P.pose(tl, 37.4, "stand", { d: 0.4 });
  P.blinks(tl, DUR, { seed: 11 }); P.idle(tl, 0, DUR);
  tl.to({}, { duration: DUR }, 0);
  tl.seek(0);
  WK.redraw();
  return tl;
};
