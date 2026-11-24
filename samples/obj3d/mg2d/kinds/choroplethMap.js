// kind: choroplethMap (family: space) - countries shaded in palette steps by value (real borders from data, projected at runtime), a stepped legend with country counts, a red highlight + callout.
// data: { items:[{ n:"Brazil", v:12.4 }...] (or values:{ Brazil:12.4 }), region?:["Brazil","Peru"] | [lon0,lat0,lon1,lat1] (default world), unit:"% of GDP", steps:5, highlight?:"Brazil" (default the max), cap:"Share of exports" }
// focus ids: "map" (countries fill west to east), "legend" (stepped legend + the highlighted country callout)
import { P, F, ease, seg, clamp, lerp, ui, makeMap, drawMap, country, fmt, tagSize, PADM, measure, circ } from "./_srd.js";
import { mixc, niceStepN } from "./_srd2.js";
export default {
  name: "choroplethMap", family: "space",
  doc: "Countries shaded by value in stepped paper tones with a legend and a highlighted country.",
  example: [
    { cap: "Share of oil exports", unit: "% of exports", highlight: "Saudi Arabia", region: [-20, -36, 150, 62], items: [{ n: "Saudi Arabia", v: 78 }, { n: "Iraq", v: 99 }, { n: "Kuwait", v: 90 }, { n: "Iran", v: 52 }, { n: "Russia", v: 46 }, { n: "Nigeria", v: 86 }, { n: "Angola", v: 94 }, { n: "Algeria", v: 82 }, { n: "Libya", v: 95 }, { n: "Kazakhstan", v: 58 }, { n: "Norway", v: 61 }, { n: "Canada", v: 17 }, { n: "United Arab Emirates", v: 32 }, { n: "Egypt", v: 12 }, { n: "India", v: 8 }, { n: "China", v: 2 }, { n: "Germany", v: 1 }, { n: "France", v: 2 }, { n: "Turkey", v: 3 }, { n: "Oman", v: 70 }, { n: "Qatar", v: 62 }, { n: "Venezuela", v: 88 }] },
    { cap: "Rice eaten per person", unit: "kg a year", steps: 4, items: [{ n: "Bangladesh", v: 170 }, { n: "Vietnam", v: 140 }, { n: "Indonesia", v: 135 }, { n: "Thailand", v: 100 }, { n: "India", v: 70 }, { n: "China", v: 75 }, { n: "Japan", v: 50 }, { n: "Nigeria", v: 38 }, { n: "Brazil", v: 40 }, { n: "United States of America", v: 11 }, { n: "Russia", v: 7 }, { n: "Germany", v: 6 }, { n: "Philippines", v: 120 }, { n: "Myanmar", v: 155 }, { n: "Egypt", v: 45 }, { n: "Peru", v: 50 }, { n: "Madagascar", v: 110 }] },
  ],
  build(d, K) {
    const r = K.rng, items = (d.items ?? Object.entries(d.values ?? {}).map(([n, v]) => ({ n, v }))).map(q => ({ ...q, c: country(q.n) })).filter(q => q.c), steps = d.steps ?? 5;
    const vals = items.map(q => q.v), lo = Math.min(...vals), hi = Math.max(...vals), st = niceStepN((hi - lo) / steps) || 1, base = Math.floor(lo / st) * st, nstep = Math.max(1, Math.ceil((hi - base) / st - 1e-9)), edges = Array.from({ length: nstep + 1 }, (_, i) => base + i * st);
    const stepOf = v => clamp(Math.floor((v - base) / st - 1e-9), 0, nstep - 1), col = k => mixc(P.sand, P.ink2, 0.06 + 0.82 * (nstep === 1 ? 0.5 : k / (nstep - 1))), top = items.find(q => q.n === d.highlight) ?? items.reduce((a, b) => b.v > a.v ? b : a);
    const M = makeMap({ region: d.region ?? [-175, -52, 180, 78], pts: [], rng: r, h: 640, w: 1380, each: true }), CARD = PADM, LH = 190, w = M.w + CARD * 2, h = M.h + CARD * 2 + LH, mx = CARD, my = CARD;
    const byIso = new Map(items.map(q => [q.c.iso, q])), cells = M.each.map(e => ({ ...e, it: byIso.get(e.c.iso) })).filter(e => e.it), counts = Array.from({ length: nstep }, () => 0); items.forEach(q => counts[stepOf(q.v)]++);
    const tc = cells.find(e => e.it === top), order = cells.slice().sort((a, b) => a.x - b.x);
    return {
      w, h, focus: [{ id: "map", x: 0, y: 0, w, h: h - LH + 20 }, { id: "legend", x: 0, y: h - LH - 400, w, h: LH + 400 }],
      draw(g, t, at) {
        const t0 = at.map ?? 0, t1 = at.legend ?? t0 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 });
        g.save(); g.translate(mx, my); drawMap(g, M, t, { land: P.fog, landFx: g => { order.forEach((e, i) => { const k = ease.out(seg(t, t0 - 0.2 + (e.x / M.w) * 1.5, t0 + 0.3 + (e.x / M.w) * 1.5)); if (k <= 0) return; g.save(); g.globalAlpha = k; g.fillStyle = e.it === top && t > t1 - 0.2 ? mixc(col(stepOf(e.it.v)), P.red, ease.io(seg(t, t1 - 0.2, t1 + 0.4))) : col(stepOf(e.it.v)); g.fill(e.path); g.strokeStyle = P.paper; g.lineWidth = 1.8; g.stroke(e.path); g.restore(); });
          if (tc && t > t1 - 0.2) { g.save(); g.globalAlpha = ease.io(seg(t, t1 - 0.2, t1 + 0.4)); g.strokeStyle = P.red; g.lineWidth = 5; g.lineJoin = "round"; g.stroke(tc.path); g.restore(); } } });
        if (tc) { const u = seg(t, t1 + 0.2, t1 + 1.0), ax = tc.x, ay = tc.y, tx = clamp(ax + 160, 260, M.w - 260), ty = clamp(ay - 150, 80, M.h - 110); if (u > 0) { ui.leader(g, ax, ay, tx - 20, ty, u, P.red); if (u > 0.7) { ui.tag(g, top.n, tx + 60, ty - 28, { size: F.small, color: P.red }); ui.num(g, fmt(top.v) + (d.unit ? "" : ""), tx + 60, ty + 36, { size: 64, color: P.red }); } } }
        g.restore();
        // legend: stepped swatches with the number of countries in each step (little bars) + unit
        const ly = h - LH + 46, sw = Math.min(170, (w - 2 * CARD - 240) / nstep), lx0 = (w - sw * nstep) / 2;
        for (let i = 0; i < nstep; i++) { const u = ease.out(seg(t, t1 - 0.3 + i * 0.25, t1 + 0.3 + i * 0.25)); if (u <= 0) continue; g.save(); g.globalAlpha = u; const x = lx0 + i * sw; ui.rr(g, x, ly, sw - 8, 40, 6); ui.fill(g, col(i)); ui.ink(g, 2.5, P.ink);
          const bh = counts[i] / Math.max(...counts) * 56 * u; g.fillStyle = "rgba(43,42,39,.22)"; g.fillRect(x + 6, ly - 14 - bh, sw - 20, bh); ui.caption(g, fmt(edges[i]) + "–" + fmt(edges[i + 1]), x + (sw - 8) / 2, ly + 78, { size: F.small, color: P.ink2, caps: false, spacing: 0 }); g.restore(); }
        ui.caption(g, (d.unit ?? "") , w / 2, h - 34, { size: F.small, color: P.mid }); if (d.cap) ui.caption(g, d.cap, CARD + 10, h - LH + 8, { size: F.cap, color: P.ink2, weight: 700, align: "left" });
      },
    };
  },
};
