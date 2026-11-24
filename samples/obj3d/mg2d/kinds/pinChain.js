// kind: pinChain (family: space) - a sequence of pins connected in order across a paper map, each with a mini-vignette card (SH illustration + step number + name).
// data: { region?, stops:[{ n:"Mine", ll:[lon,lat], what:"mountain" (SH generator or semantic word) }], cap, mode?:"ship|truck|train" (small traveller along the chain) }
// focus ids: "chain" (pins + vignettes land one by one in order), "last" (the final stop, red)
import { P, F, ease, seg, clamp, lerp, ui, rng, makeMap, drawMap, place, mkPath, smooth, bend, stroke, icon, vehicle, sd, PADM, fit, circ } from "./_srd.js";
import { placeBox, focusBox } from "./_srd2.js";
export default {
  name: "pinChain", family: "space",
  doc: "Ordered pins connected across a map, each with a small illustrated vignette card.",
  example: [
    { cap: "From ore to phone", region: [-10, -42, 150, 55], mode: "ship", stops: [{ n: "Lithium mine", ll: [-68.2, -23.4], what: "mountain" }, { n: "Refinery", ll: [117.5, 31], what: "refineryColumn" }, { n: "Cell factory", ll: [113.9, 22.6], what: "factory" }, { n: "Assembly", ll: [106.7, 10.8], what: "phone" }, { n: "Port", ll: [103.8, 1.3], what: "crane" }, { n: "Store", ll: [-0.1, 51.5], what: "city" }] },
    { cap: "Grain's long road", region: [-125, 20, -60, 52], mode: "train", stops: [{ n: "Farm", ll: [-97, 41], what: "grain" }, { n: "Elevator", ll: [-95, 43.5], what: "building" }, { n: "River barge", ll: [-90.2, 38.6], what: "tug" }, { n: "Gulf port", ll: [-90, 29.9], what: "crane" }] },
  ],
  build(d, K) {
    const r = K.rng, stops = d.stops.map(place), M = makeMap({ region: d.region, pts: stops.map(s => s.ll), rng: r, h: 720, w: 1400 }), PP = stops.map(s => M.f(s.ll)), CARD = PADM, w = M.w + CARD * 2, h = M.h + CARD * 2 + 70, mx = CARD, my = CARD;
    const CW = 262, CH = 214, taken = [], cards = stops.map((s, i) => { const b = placeBox(PP[i][0], PP[i][1], CW, CH, taken, M.w, M.h, PP, [120, 180, 250, 330, 420]); return { ...b, seed: sd(r) }; });
    const px = PP.map(p => [...p]), path = mkPath(px.length > 2 ? smooth(px, 14) : px), n = stops.length, cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(px[i][0] - px[i - 1][0], px[i][1] - px[i - 1][1]));
    const lb = [PP[n - 1][0] - 400, PP[n - 1][1] - 300, PP[n - 1][0] + 400, PP[n - 1][1] + 300], fb = focusBox([lb[0] + mx, lb[1] + my, lb[2] + mx, lb[3] + my], w, h, 1000, 640, 0);
    return {
      w, h, focus: [{ id: "chain", x: 0, y: 0, w, h }, { id: "last", ...fb }],
      draw(g, t, at) {
        const t0 = at.chain ?? 0, t1 = at.last ?? t0 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 }); g.save(); g.translate(mx, my); drawMap(g, M, t);
        const STEP = 0.5, tEnd = t0 + 0.3 + (n - 1) * STEP + 0.6;
        // the chain line draws through the pins in order; stops land as it reaches them
        const lu = clamp((t - (t0 - 0.2)) / (STEP * (n - 1) + 0.8), 0, 1), dist = lu * path.len; if (lu > 0) { const pts = path.upTo(lu); stroke(g, pts, 11, "rgba(251,248,241,.9)"); stroke(g, pts, 5, P.ink, [22, 14], -t * 20); }
        stops.forEach((s, i) => { const ti = t0 - 0.2 + i * STEP, u = seg(t, ti, ti + 0.5), red = i === n - 1; if (u <= 0) return; const c = cards[i], px0 = PP[i][0], py0 = PP[i][1];
          // leader from pin to card edge, then the card (settles in with a small bounce)
          const ex = clamp(px0, c.x - CW / 2 + 12, c.x + CW / 2 - 12), ey = clamp(py0, c.y - CH / 2 + 12, c.y + CH / 2 - 12); g.beginPath(); g.moveTo(px0, py0); g.lineTo(ex, ey); ui.ink(g, 2, "rgba(43,42,39,.5)");
          g.save(); g.translate(c.x, c.y); const k = ease.settle(u); g.scale(k, k); g.globalAlpha *= Math.min(1, u * 3); ui.card(g, -CW / 2, -CH / 2, CW, CH, { r: 12, rule: false }); icon(g, s.what ?? "container", 0, -14, 122, { seed: c.seed, t: t - ti, red });
          fit(g, s.n, 0, CH / 2 - 30, CW - 28, { size: F.small, color: red ? P.red : P.ink2, weight: 700 }); circ(g, -CW / 2 + 28, -CH / 2 + 28, 22, red ? P.red : P.ink, 0); ui.num(g, String(i + 1), -CW / 2 + 28, -CH / 2 + 29, { size: F.small, color: P.paper }); g.restore();
          ui.pin(g, px0, py0 - 2, red, 0.9 * ease.back(u)); if (red && t > t1 - 0.1) { g.beginPath(); g.arc(px0, py0, 40 * ease.out(seg(t, t1 - 0.1, t1 + 0.6)) * (1 + 0.08 * Math.sin(t * 5)), 0, 7); ui.ink(g, 4, P.red); } });
        if (lu >= 1 || t > tEnd) { const [x, y, a] = path.at(((t - tEnd) * 140) % path.len); vehicle(g, d.mode ?? "ship", x, y, a, 84, t, 5, false); }
        g.restore(); if (d.cap) ui.caption(g, d.cap, w / 2, h - 36, { size: F.cap, color: P.ink2, weight: 700 });
      },
    };
  },
};
