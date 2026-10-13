/* parking.js: ISO demo, dense parking lot, 30 s. Traffic around a 48-bay lot; a free bay (small, ground) -> hero car parks (small) -> a car leaves -> fill counter. */
window.SCENE = function () {
  const THEME = (window.THEME = Theme.get("teal")); Theme.apply(THEME);
  const root = document.getElementById("root"), W = +root.dataset.width, H = +root.dataset.height, DUR = +root.dataset.duration;
  const $ = (q) => document.querySelector(q);
  const tl = ISO.timeline();
  ISO.init(tl, { host: $("#iso"), labels: $("#labels"), W, H, dur: DUR });
  const t0 = performance.now();
  const L = WORLDS.parking(7, { dur: DUR, cars: 58, buses: 1, heroAt: -7, leaveAt: 4 });
  ISO.stats.genMs = +(performance.now() - t0).toFixed(1); ISO.stats.collisions = L.sim.collisions;
  const sim = L.sim, ev = sim.events, hero = L.lot.hero;
  const hEnter = (ev.find((e) => e.type === "enter" && e.id === hero) || { t: 11 }).t, hPark = (ev.find((e) => e.type === "park" && e.id === hero) || { t: 17 }).t;
  const leave = ev.filter((e) => e.type === "leave" && e.t > 3 && e.t < DUR - 5).sort((a, b) => Math.abs(a.t - 4) - Math.abs(b.t - 4))[0];
  ISO.stats.events = { hero, hEnter: +hEnter.toFixed(2), hPark: +hPark.toFixed(2), leave: leave && +leave.t.toFixed(2) };
  const K = 0.55, box = { x0: 40, y0: 40, x1: 1490, y1: H - 40 };
  const V = ISO.view(45, K), B = L.G.bounds, cs = [[B[0], B[1]], [B[2], B[1]], [B[2], B[3]], [B[0], B[3]]].map((p) => V.P(p[0], p[1], 0));
  const zf = Math.sqrt(1 - K * K), X0 = Math.min(...cs.map((p) => p[0])), X1 = Math.max(...cs.map((p) => p[0])), Y0 = Math.min(...cs.map((p) => p[1])) - 70 * zf, Y1 = Math.max(...cs.map((p) => p[1])) + 12 * zf;
  const S0 = Math.min((box.x1 - box.x0) / (X1 - X0), (box.y1 - box.y0) / (Y1 - Y0));
  ISO.cam({ az: 45, k: K, S: S0, fx: 0, fy: 0, fz: 0, sx: (box.x0 + box.x1) / 2 - S0 * (X0 + X1) / 2, sy: (box.y0 + box.y1) / 2 - S0 * (Y0 + Y1) / 2 });
  ISO.safe = { x0: 24, y0: 24, x1: 1520, y1: H - 24 };
  ISO.focusSafe = { x0: 60, y0: 230, x1: 1480, y1: 1030 };
  ISO.winLit = (t, p) => (((t / 9 - p) % 1) + 1) % 1 < 0.3;
  const lb = L.lotB, lc = [(lb.x0 + lb.x1) / 2, (lb.y0 + lb.y1) / 2, 0];
  const bayOn = Math.max(3.4, hEnter - 5);
  ISO.subjects.hero = WORLDS.subjectCar(sim, hero);
  if (leave) ISO.subjects.leaver = WORLDS.subjectCar(sim, leave.id);
  // camera
  ISO.camTo(0, { S: S0 * 1.03 }, { d: 3, ease: "sine.inOut" });
  ISO.camTo(2.6, { fx: lc[0], fy: lc[1], fz: 0, S: S0 * 1.75, sx: 770, sy: 560 }, { d: 3, ease: "power2.inOut" });
  ISO.orbit(hPark + 3, 52, { d: 5, ease: "sine.inOut" });
  ISO.home(DUR - 7, { d: 4, ease: "power2.inOut" });
  // beats (subject per beat)
  ISO.focus("bay", bayOn, hEnter - 0.5); ISO.label(null, "FREE SPOT", bayOn + 0.1, { out: hEnter - 0.5, dy: -26, sub: "bay" });
  ISO.focus("hero", hEnter + 2.1, hPark + 2.5); ISO.label(null, "YOUR CAR", hEnter + 2.2, { out: hPark - 0.2, dy: -26, sub: "hero" });
  ISO.label(null, "PARKED", hPark, { out: hPark + 2.5, dy: -26, fill: "marker", sub: "hero" });
  if (leave) { ISO.focus("leaver", leave.t + 0.3, leave.t + 3.3); ISO.label(null, "LEAVING", leave.t + 0.4, { out: leave.t + 3.3, dy: -26, sub: "leaver" }); }
  ISO.label([lb.x1, lb.y0, 2], (t) => `${sim.occ(t)} / ${L.lot.bays.length} PARKED`, DUR - 3.4, { out: DUR - 0.3, dy: -60 });
  // puppet
  const ph = 640, pcx = 1660, pfloor = 1045, wd = Math.round((318 * ph) / 620);
  const host = $("#pz"); Object.assign(host.style, { left: pcx - wd / 2 + "px", top: pfloor - ph + 12 + "px", width: wd + "px" });
  const P = Puppet.mount("#pz", { mode: "full", height: ph, id: "pzp", theme: { shadow: THEME.shadow } });
  [1.2, bayOn + 0.2, hEnter + 2.2, hPark].forEach((t) => { P.pointScreen(tl, t, "l"); P.pose(tl, t + 1.9, "stand", { d: 0.4 }); });
  P.pose(tl, DUR - 3.4, "present_left", { hold: 1.8 }); P.pose(tl, DUR - 1.4, "stand", { d: 0.4 });
  P.blinks(tl, DUR, { seed: 5 }); P.idle(tl, 0, DUR);
  tl.to({}, { duration: DUR }, 0);
  tl.seek(0);
  ISO.redraw();
  return tl;
};
