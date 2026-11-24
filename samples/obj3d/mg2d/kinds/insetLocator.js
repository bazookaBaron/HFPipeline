// kind: insetLocator (family: space) - a small locator globe (real land, orthographic) with a red box on the place, a dashed zoom cone, and the detail map it opens into.
// data: { place:{n,ll:[lon,lat]}, detail:[{n,ll}] (extra pins on the detail map), region?:[lon0,lat0,lon1,lat1] | ["Country"..] (detail extent), span:8 (degrees half-width), cap:"Strait of Hormuz", note }
// focus ids: "locator" (globe + box + cone), "detail" (the detail map with pins)
import { P, F, ease, seg, clamp, lerp, ui, rng, makeMap, drawMap, drawGlobe, place, pinTag, placeLabels, tagSize, sd, PADM, D2R, circ, fmt } from "./_srd.js";
export default {
  name: "insetLocator", family: "space",
  doc: "Locator globe with a red box zooming into a detail map with pins.",
  example: [
    { place: { n: "Hormuz", ll: [56.5, 26.6] }, span: 9, cap: "Strait of Hormuz", note: "a fifth of the world's oil", detail: [{ n: "Bandar Abbas", ll: [56.3, 27.2] }, { n: "Fujairah", ll: [56.35, 25.1] }, { n: "Muscat", ll: [58.4, 23.6] }] },
    { place: { n: "Panama Canal", ll: [-79.7, 9.1] }, span: 8, cap: "Panama Canal", note: "82 km, ocean to ocean", detail: [{ n: "Colon", ll: [-79.9, 9.36] }, { n: "Panama City", ll: [-79.5, 8.98] }] },
  ],
  build(d, K) {
    const r = K.rng, P0 = place(d.place), span = d.span ?? 8, extra = (d.detail ?? []).map(place), box = d.region ?? [P0.ll[0] - span, P0.ll[1] - span * 0.6, P0.ll[0] + span, P0.ll[1] + span * 0.6];
    const M = makeMap({ region: box, pts: [P0.ll, ...extra.map(e => e.ll)], rng: r, h: 640, w: 1060 }), CARD = PADM, GR = 250, GW = 640, w = CARD * 3 + GW + M.w + 90, h = M.h + CARD * 2 + 70, gx = CARD + GW / 2, gy = CARD + (h - 70 - CARD * 2) / 2, mx = CARD * 2 + GW + 90, my = CARD;
    const pa = M.f(P0.ll), PP = extra.map(e => M.f(e.ll)), lab = placeLabels([{ x: pa[0], y: pa[1], ...tagSize(P0.n), r: 24 }, ...extra.map((e, i) => ({ x: PP[i][0], y: PP[i][1], ...tagSize(e.n), r: 20 }))], M.w, M.h, [pa, ...PP]);
    const lon0 = P0.ll[0], lat0 = clamp(P0.ll[1] * 0.7, -50, 50);
    return {
      w, h, focus: [{ id: "locator", x: 0, y: 0, w: CARD * 2 + GW + 700, h }, { id: "detail", x: mx - 140, y: 0, w: M.w + 140 + CARD * 2, h }],
      draw(g, t, at) {
        const t0 = at.locator ?? 0, t1 = at.detail ?? t0 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 });
        g.save(); g.translate(gx, gy); const gu = ease.out(seg(t, t0 - 0.3, t0 + 0.6)); g.scale(0.9 + 0.1 * gu, 0.9 + 0.1 * gu); const pr = drawGlobe(g, GR, lon0 + Math.sin(t * 0.3) * 2, lat0);
        const q = pr(P0.ll), bs = clamp(GR * 2 * span * D2R * 0.55, 34, 120), bu = ease.back(seg(t, t0 + 0.5, t0 + 1.1)), pul = 1 + 0.06 * Math.sin(t * 4);
        g.save(); g.translate(q.x, q.y); g.scale(bu * pul, bu * pul); g.beginPath(); g.rect(-bs / 2, -bs * 0.34, bs, bs * 0.68); ui.fill(g, "rgba(200,38,29,.14)"); ui.ink(g, 5, P.red); circ(g, 0, 0, 5, P.red, 0); g.restore();
        g.setLineDash([3, 9]); g.beginPath(); g.arc(0, 0, GR + 26, 0, 7); ui.ink(g, 1.6, P.mid); g.setLineDash([]); g.restore();
        if (bu > 0.5) { g.save(); g.globalAlpha *= seg(t, t0 + 0.8, t0 + 1.4); ui.caption(g, fmt(Math.abs(P0.ll[1]), 1) + "°" + (P0.ll[1] >= 0 ? "N" : "S") + "  " + fmt(Math.abs(P0.ll[0]), 1) + "°" + (P0.ll[0] >= 0 ? "E" : "W"), gx, gy + GR + 66, { size: F.small, color: P.ink2, caps: false, spacing: 1 }); g.restore(); }
        const cu = ease.io(seg(t, t1 - 0.9, t1 + 0.1)); if (cu > 0) { const bx = gx + q.x + bs / 2; g.save(); g.setLineDash([14, 10]); g.lineDashOffset = -t * 20; for (const s of [-1, 1]) { const y0 = gy + q.y + s * bs * 0.34, y1 = s < 0 ? my + 6 : my + M.h - 6; g.beginPath(); g.moveTo(bx, y0); g.lineTo(lerp(bx, mx, cu), lerp(y0, y1, cu)); ui.ink(g, 3, P.red); } g.restore(); }
        const du = ease.out(seg(t, t1 - 0.3, t1 + 0.5)); g.save(); g.translate(mx, my); g.globalAlpha *= 0.35 + 0.65 * du; drawMap(g, M, t);
        pinTag(g, P0.n, pa[0], pa[1], lab[0].lx, lab[0].ly, ease.out(seg(t, t1 + 0.1, t1 + 0.6)), { red: true });
        extra.forEach((e, i) => pinTag(g, e.n, PP[i][0], PP[i][1], lab[i + 1].lx, lab[i + 1].ly, seg(t, t1 + 0.4 + i * 0.4, t1 + 0.9 + i * 0.4), {}));
        const ru = seg(t, t1 + 0.3, t1 + 1.1); if (ru > 0) { g.beginPath(); g.arc(pa[0], pa[1], 46 * ease.out(ru) * (1 + 0.1 * Math.sin(t * 4)), 0, 7); ui.ink(g, 4, P.red); }
        g.restore(); ui.rr(g, mx - 8, my - 8, M.w + 16, M.h + 16, 16); ui.ink(g, 2, "rgba(43,42,39,.25)");
        if (d.cap) ui.caption(g, d.cap, w / 2, h - 36, { size: F.cap, color: P.ink2, weight: 700 });
        if (d.note && t > t1 + 1) { g.save(); g.globalAlpha *= seg(t, t1 + 1, t1 + 1.6); ui.tag(g, d.note, mx + M.w - 340, my + M.h - 34, { size: F.small }); g.restore(); }
      },
    };
  },
};
