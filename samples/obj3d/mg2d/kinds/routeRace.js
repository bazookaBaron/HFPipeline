// kind: routeRace (family: space) - two (or three) routes between the same two places drawn on a paper map; vehicles race along each with
// running distance counters; lanes on the right show each route's counter, progress bar and the gap (the longer route is the red one).
// data: { from:{n,ll}, to:{n,ll}, region?, cap, unit:"km", routes:[{ n:"Suez Canal", via:[[lon,lat]...], km?:6000 (else measured), mode:"ship|train|truck", days?:"14 days", red?:true }] }
// focus ids: "race" (map + vehicles + counters), "result" (lanes, finish + the gap)
import { P, F, ease, seg, clamp, lerp, ui, rng, makeMap, drawMap, place, mkPath, smooth, bend, stroke, pinTag, vehicle, sd, pathKm, fmt, chip, PADM, icon, fit, measure } from "./_srd.js";
export default {
  name: "routeRace", family: "space",
  doc: "Two routes compared: vehicles race along each with running distance counters and a result lane showing the gap.",
  example: [
    { from: { n: "Shanghai", ll: [121.5, 31.2] }, to: { n: "Rotterdam", ll: [4.3, 51.9] }, cap: "Asia to Europe", unit: "km", region: [-20, -40, 130, 62],
      routes: [{ n: "Via Suez", via: [[103.8, 1.3], [80, 6], [58, 12.5], [43.3, 12.6], [32.5, 29.9], [12, 36], [-5.5, 36], [-9.5, 40]], mode: "ship", days: "34 days" }, { n: "Via the Cape", via: [[103.8, 1.3], [75, -8], [30, -34], [18.4, -35], [-17, 14], [-12, 36], [-9.5, 44]], mode: "ship", red: true, days: "44 days" }] },
    { from: { n: "Chongqing", ll: [106.5, 29.6] }, to: { n: "Duisburg", ll: [6.8, 51.4] }, cap: "Rail against sea", unit: "km", region: [0, 10, 125, 62],
      routes: [{ n: "Rail", via: [[87.6, 43.8], [71.4, 51.2], [37.6, 55.7], [21, 52.2]], mode: "train", days: "16 days" }, { n: "Sea", via: [[121.8, 30.5], [103.8, 1.3], [58, 12.5], [32.5, 29.9], [-5.5, 36], [4.3, 51.9]], mode: "ship", red: true, days: "36 days" }] },
  ],
  build(d, K) {
    const r = K.rng, A = place(d.from), B = place(d.to), routes = d.routes.map(q => ({ ...q, lls: [A.ll, ...(q.via ?? []), B.ll] })), M = makeMap({ region: d.region, pts: routes.flatMap(q => q.lls), rng: r, h: 700, w: 1100 });
    routes.forEach(q => { const px = q.lls.map(M.f); q.px = q.lls.length > 2 ? smooth(px, 12) : bend(px[0], px[1], 0.1); q.path = mkPath(q.px); q.km = q.km ?? Math.round(pathKm(q.lls) / 10) * 10; q.seed = sd(r); });
    const kmin = Math.min(...routes.map(q => q.km)), kmax = Math.max(...routes.map(q => q.km)); const anyRed = routes.some(q => q.red); routes.forEach(q => { if (!anyRed) q.red = q.km === kmax; });
    const CARD = PADM, LW = 600, w = CARD * 3 + M.w + LW, h = M.h + CARD * 2 + 70, mx = CARD, my = CARD, lx = mx + M.w + CARD, ph = (h - 70 - 2 * CARD) / routes.length;
    const pa = M.f(A.ll), pb = M.f(B.ll), unit = d.unit ?? "km";
    return {
      w, h, focus: [{ id: "race", x: 0, y: 0, w: CARD * 2 + M.w, h }, { id: "result", x: mx + M.w - 380, y: 0, w: LW + CARD * 2 + 380, h }],
      draw(g, t, at) {
        const t0 = at.race ?? 0, t1 = at.result ?? t0 + 2.6, TS = t0 + 0.3, BASE = 3.2; ui.card(g, 0, 0, w, h, { r: 18 });
        g.save(); g.translate(mx, my); drawMap(g, M, t);
        const prog = q => clamp((t - TS) / (BASE * q.km / kmin), 0, 1);
        routes.forEach((q, i) => { const p = prog(q), ru = ease.io(seg(t, t0 - 0.2 + i * 0.3, t0 + 0.6 + i * 0.3)); stroke(g, q.path.upTo(ru), 4.5, q.red ? P.redInk : P.ink2, [18, 13], -t * 16);
          if (p > 0) { const pts = q.path.upTo(p); stroke(g, pts, 11, "rgba(251,248,241,.92)"); stroke(g, pts, 6, q.red ? P.red : P.ink); const [x, y, a] = q.path.at(q.path.len * p); vehicle(g, q.mode, x, y, a, 104, t, q.seed, false);
            chip(g, fmt(q.km * p, 0) + " " + unit, x, y - 62, { red: q.red }); } });
        pinTag(g, A.n, pa[0], pa[1], pa[0] - 10, pa[1] + 58, ease.out(seg(t, t0 - 0.2, t0 + 0.3)), {}); pinTag(g, B.n, pb[0], pb[1], pb[0] - 10, pb[1] - 56, ease.out(seg(t, t0, t0 + 0.5)), {});
        g.restore();
        routes.forEach((q, i) => { const y0 = my + i * ph, p = prog(q), done = p >= 1; g.save(); g.translate(lx, y0); ui.card(g, 0, 0, LW, ph - 22, { r: 14, rule: false });
          fit(g, q.n, 34, 46, LW - 230, { size: F.cap, align: "left", color: q.red ? P.red : P.ink2, weight: 700 }); if (q.days) ui.caption(g, q.days, LW - 34, 46, { size: F.small, align: "right", color: P.mid });
          const s = fmt(q.km * p, 0); ui.num(g, s, 34, 118, { size: 72, align: "left", color: q.red ? P.red : P.ink }); ui.caption(g, unit, 34 + measure(s, 72, 800) + 14, 128, { size: F.small, align: "left", caps: false, color: P.mid });
          const bx0 = 34, bxm = LW - 70, bx1 = bx0 + (bxm - bx0) * q.km / kmax, by = ph - 22 - 52; g.beginPath(); g.moveTo(bx0, by); g.lineTo(bx1, by); ui.ink(g, 10, P.lite); g.beginPath(); g.moveTo(bx0, by); g.lineTo(lerp(bx0, bx1, p), by); ui.ink(g, 10, q.red ? P.red : P.ink2);
          for (let k = 0; k <= 10; k++) { const x = lerp(bx0, bx1, k / 10); g.beginPath(); g.moveTo(x, by + 12); g.lineTo(x, by + 22); ui.ink(g, 1.6, P.mid); }
          g.beginPath(); g.moveTo(bx1 + 8, by - 34); g.lineTo(bx1 + 8, by + 8); ui.ink(g, 3, P.ink); g.beginPath(); g.moveTo(bx1 + 8, by - 34); g.lineTo(bx1 + 40, by - 24); g.lineTo(bx1 + 8, by - 14); g.closePath(); ui.fill(g, done ? (q.red ? P.red : P.ink) : P.hair);
          icon(g, q.mode === "train" ? "locomotive" : q.mode === "truck" ? "truck" : "containerShip", lerp(bx0, bx1, p), by - 38, 96, { seed: q.seed, t }); g.restore(); });
        const gp = ease.back(seg(t, t1 - 0.1, t1 + 0.7)); if (gp > 0 && routes.length > 1) { const lg = routes.find(q => q.km === kmax), li = routes.indexOf(lg); g.save(); g.translate(lx + LW - 130, my + li * ph + ph - 22 - 110); g.scale(gp, gp); chip(g, "+" + fmt(kmax - kmin, 0) + " " + unit, 0, 0, { red: true, size: 34 }); g.restore(); }
        if (d.cap) ui.caption(g, d.cap, w / 2, h - 36, { size: F.cap, color: P.ink2, weight: 700 });
      },
    };
  },
};
