/* scene.js: "How a data centre serves your request", one persistent iso world, ~45 s. Shared by comp/ (1920x1080) and comp-reel/ (1080x1920). */
window.ISO_SCENE = function () {
  window.__timelines = window.__timelines || {};
  const THEME = (window.THEME = Theme.get("teal")); Theme.apply(THEME);
  const root = document.getElementById("root"), W = +root.dataset.width, H = +root.dataset.height, DUR = +root.dataset.duration, REEL = H > W;
  const tl = I.timeline();
  I.init(tl, { svg: document.getElementById("iso"), under: document.getElementById("iso-under"), over: document.getElementById("iso-over"), labels: document.getElementById("labels"), W, H, theme: THEME });
  const HOME = REEL ? { az: 45, k: 0.7, S: 2.05, fx: 0, fy: 10, fz: 40, sx: 540, sy: 700 } : { az: 45, k: 0.5, S: 2.2, fx: 0, fy: 10, fz: 30, sx: 770, sy: 580 };
  I.cam(HOME);
  I.safe = REEL ? { x0: 24, y0: 60, x1: W - 24, y1: 1320 } : { x0: 24, y0: 24, x1: 1490, y1: H - 24 }; // chips never enter the puppet zone

  // ---------- world ----------
  I.floor({ x: 0, y: 10, w: 470, d: 400, h: 14, r: 22 });
  const phone = I.box({ id: "phone", x: 40, y: 165, w: 40, d: 16, h: 66, r: 6, lip: 4 });
  const router = I.tower({ id: "router", x: -160, y: 40, w: 44, d: 44, h: 120, r: 5, band: 24 });
  const lb = I.box({ id: "lb", x: -40, y: -40, w: 96, d: 52, h: 26, r: 6, lip: 6 });
  const racks = [[60, -120], [110, -120], [160, -120], [60, -60], [160, -60]].map(([x, y], i) => I.rack({ id: "rack" + i, x, y, w: 38, d: 38, h: 92, r: 4, units: 6 }));
  const srv = I.stack({ id: "srv", x: 110, y: -60, w: 38, d: 38, lh: 23, n: 4, r: 4, tops: ["paper", "paper", "paper", "paper"] });
  const cpu = I.chip({ id: "cpu", x: 110, y: -60, w: 22, d: 22, h: 4, r: 2, pins: 4, pinLen: 5, parent: srv.layers[3] });
  const db = I.cyl({ id: "db", x: 150, y: 70, R: 34, h: 72, bands: [0.33, 0.66] });
  const L = {
    pr: I.link({ pts: [[40, 165], [-160, 165], [-160, 40]] }),
    rl: I.link({ pts: [[-160, 40], [-160, -40], [-40, -40]] }),
    ls: I.link({ pts: [[-40, -40], [20, -40], [20, -60], [110, -60]] }),
    lr: I.link({ pts: [[-40, -40], [20, -40], [20, -120], [160, -120]] }),
    sd: I.link({ pts: [[110, -60], [110, 10], [150, 10], [150, 70]] }),
  };

  // ---------- build sequence ----------
  const lab = (p, text, t, out, o) => I.label(p, text, t, Object.assign({ out }, o || {}));
  // floor is on screen from frame 0 (never an empty page)
  I.rise(phone, 0.9); lab(phone, "YOUR PHONE", 1.3, 6.2, { dx: REEL ? -40 : -260, dy: REEL ? -120 : -30 });
  I.extrude(router, 2.2, { d: 0.9 }); lab(router, "EDGE ROUTER", 2.7, 8.4, { dy: -90 });
  I.drawLink(L.pr, 3.3); I.flow(L.pr, 4.0, 2.6, { n: 3, laps: 1.6 });
  I.rise(lb, 5.0); lab(lb, "LOAD BALANCER", 5.4, 10.6, { dy: -110 });
  I.drawLink(L.rl, 6.0); I.flow(L.rl, 6.5, 2.6, { n: 3, laps: 1.6 });
  racks.forEach((r, i) => I.rise(r, 7.4 + i * 0.22, { d: 0.5 }));
  I.rise(srv, 8.5, { stagger: 0.07 });
  lab(srv, "SERVERS", 9.3, 13.2, { dy: -100 });
  I.drawLink(L.ls, 10.0); I.drawLink(L.lr, 10.2);
  I.flow(L.ls, 10.6, 3.0, { n: 4, laps: 2 });
  I.hi(srv.layers[3], 11.6, "marker");
  // zoom in on the one server, orbit a little, explode it into layers
  I.zoomTo([110, -60, 14 + 100], 13.0, { S: HOME.S * (REEL ? 2.0 : 1.75), d: 1.7, sx: REEL ? 540 : 780, sy: REEL ? 700 : 560 });
  I.orbit(13.0, 33, { d: 4.5 });
  I.hi(srv.layers[3], 14.6, null);
  I.explode(srv, 15.0, 30, { d: 0.9 });
  I.rise(cpu, 15.7, { from: 160, d: 0.5 });
  lab(srv.layers[0], "STORAGE", 16.0, 18.4, { dx: REEL ? -170 : -230, dy: -10 });
  lab(srv.layers[1], "MEMORY", 16.5, 18.6, { dx: REEL ? 170 : 230, dy: -10 });
  lab(srv.layers[2], "NETWORK", 17.0, 19.2, { dx: REEL ? -170 : -230, dy: -10 });
  I.hi(cpu, 19.4, "marker"); lab(cpu, "CPU RUNS YOUR CODE", 19.6, 22.6, { dy: -120, fill: "marker" });
  I.explode(srv, 22.8, 0, { d: 0.8 });
  I.hi(cpu, 23.0, null);
  I.home(23.6, { d: 1.9 });
  // database round trip
  I.extrude(db, 25.4, { d: 0.9 }); lab(db, "DATABASE", 25.8, 30.4, { dx: REEL ? 170 : 260, dy: REEL ? 150 : 170 });
  I.drawLink(L.sd, 26.4); I.flow(L.sd, 27.0, 2.2, { n: 3, laps: 1.4 }); I.flow(L.sd, 29.4, 2.0, { n: 3, laps: 1.3, dir: -1 });
  // response travels back to the phone
  I.flow(L.ls, 31.2, 1.8, { n: 3, laps: 1.2, dir: -1 });
  I.flow(L.rl, 32.8, 1.8, { n: 3, laps: 1.2, dir: -1 });
  I.flow(L.pr, 34.4, 1.8, { n: 3, laps: 1.2, dir: -1 });
  I.hi(phone, 36.0, "marker"); lab(phone, "PAGE LOADED", 36.1, 39.6, { dx: REEL ? -40 : -270, dy: REEL ? -120 : -30, fill: "marker" });
  // failure + failover
  I.hi(racks[4], 38.0, "alert"); lab(racks[4], "RACK DOWN", 38.2, 41.6, { dy: -95, fill: "alert" });
  I.flow(L.lr, 39.2, 2.8, { n: 4, laps: 1.8 });
  I.orbit(41.2, 50, { d: 3.4 });
  I.camTo(41.2, { S: HOME.S * 0.96 }, { d: 3.4, ease: "sine.inOut" });
  I.hi(racks[4], 42.4, null);

  // ---------- puppet (full body, sparse gestures tied to build steps) ----------
  const ph = REEL ? 600 : 640, pcx = REEL ? 800 : 1660, pfloor = REEL ? 1880 : 1045, wd = Math.round((318 * ph) / 620);
  const host = document.getElementById("pz"); Object.assign(host.style, { left: pcx - wd / 2 + "px", top: pfloor - ph + 12 + "px", width: wd + "px" });
  const P = Puppet.mount("#pz", { mode: "full", height: ph, id: "pzp", theme: { shadow: THEME.shadow } });
  const side = REEL ? "l" : "l";
  [1.2, 5.2, 9.4, 16.0, 25.8, 36.2, 38.4].forEach((t) => { P.pointScreen(tl, t, side); P.pose(tl, t + 1.7, "stand", { d: 0.4 }); });
  P.pose(tl, 42.0, "present_left", { hold: 1.6 }); P.pose(tl, 43.8, "stand", { d: 0.4 });
  P.blinks(tl, DUR, { seed: 7 }); P.idle(tl, 0, DUR);

  tl.to({}, { duration: DUR }, 0);
  tl.seek(0);
  I.redraw();
  return tl;
};
