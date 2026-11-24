// kind: hubSpoke (family: relations) - a hub with spokes to destinations: spoke width = volume, SH cargo rides each spoke, a running total counts up in the hub; the biggest spoke is the red one.
// data: { hub:{ n:"Singapore", what:"crane" }, spokes:[{ n:"Rotterdam", v:14, what:"container" }], unit:"m boxes", cap }
// focus ids: "hub" (hub token + total counter), "spokes" (spokes draw outward, largest first, with cargo + value chips), "top" (the biggest spoke zoomed)
import { P, F, ease, seg, clamp, lerp, ui, rng, icon, sd, fit, chip, circ, fmt, TAU, ribbon, stroke } from "./_srd.js";
import { token } from "./_srd2.js";
export default {
  name: "hubSpoke", family: "relations",
  doc: "Hub with volume-width spokes to destinations, cargo riding the spokes, a running total in the hub.",
  example: [
    { cap: "Where Singapore sends its boxes", hub: { n: "Singapore", what: "crane" }, unit: "m boxes", spokes: [{ n: "China", v: 14, what: "container" }, { n: "Europe", v: 9, what: "container" }, { n: "USA", v: 7, what: "container" }, { n: "India", v: 5, what: "container" }, { n: "Australia", v: 3, what: "container" }, { n: "Africa", v: 2, what: "container" }] },
    { cap: "Gas from one hub", hub: { n: "Hub", what: "gasFlare" }, unit: "bcm", spokes: [{ n: "North", v: 30, what: "pipe" }, { n: "East", v: 12, what: "pipe" }, { n: "South", v: 20, what: "pipe" }, { n: "West", v: 8, what: "pipe" }] },
  ],
  build(d, K) {
    const r = K.rng, S = d.spokes.slice().sort((a, b) => b.v - a.v), n = S.length, w = 1700, h = 960, cx = w / 2, cy = h / 2 - 20, rx = 640, ry = 320, HR = 112, DR = 62, vmax = S[0].v, total = S.reduce((a, b) => a + b.v, 0);
    const pos = S.map((s, i) => { const ang = -Math.PI / 2 + (i + 0.5) * TAU / n; return { s, ang, x: cx + rx * Math.cos(ang), y: cy + ry * Math.sin(ang), seed: sd(r), wd: 10 + 40 * (s.v / vmax) }; });
    const tp = pos[0], tb = { x: Math.min(tp.x, cx) - 260, y: Math.min(tp.y, cy) - 230, w: Math.abs(tp.x - cx) + 520, h: Math.abs(tp.y - cy) + 460 }, tw = Math.max(1000, tb.w), th = Math.max(680, tb.h);
    return {
      w, h, focus: [{ id: "hub", x: cx - 520, y: cy - 330, w: 1040, h: 660 }, { id: "spokes", x: 0, y: 0, w, h }, { id: "top", x: clamp(tb.x + tb.w / 2 - tw / 2, 0, w - tw), y: clamp(tb.y + tb.h / 2 - th / 2, 0, h - th), w: tw, h: th }],
      draw(g, t, at) {
        const t0 = at.hub ?? 0, t1 = at.spokes ?? t0 + 2.6, t2 = at.top ?? t1 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 });
        // soft rings around the hub (context) + tick ring
        for (const f of [0.35, 0.7]) { g.beginPath(); g.ellipse(cx, cy, rx * f, ry * f, 0, 0, TAU); g.setLineDash([4, 12]); ui.ink(g, 2, P.hair); g.setLineDash([]); }
        pos.forEach((p, i) => { const ts = t1 + 0.2 + i * 0.5, u = ease.io(seg(t, ts, ts + 0.9)); if (u <= 0) return; const dx = p.x - cx, dy = p.y - cy, Ld = Math.hypot(dx, dy), ux = dx / Ld, uy = dy / Ld, a0 = [cx + ux * (HR + 10), cy + uy * (HR + 10)], a1 = [p.x - ux * (DR + 34), p.y - uy * (DR + 34)], red = i === 0 && t > t2 - 0.3;
          ribbon(g, [a0, [lerp(a0[0], a1[0], u), lerp(a0[1], a1[1], u)]], p.wd, red ? P.red : "#b8b2a4", u > 0.98 ? p.wd * 0.8 + 18 : 0); if (u >= 1) { const n2 = p.wd > 34 ? 3 : p.wd > 22 ? 2 : 1; for (let k = 0; k < n2; k++) { const ph = (((t - ts) * 0.22 + k / n2) % 1) * 0.86 + 0.05, q = [lerp(a0[0], a1[0], ph), lerp(a0[1], a1[1], ph)]; icon(g, p.s.what ?? "container", q[0], q[1] - p.wd * 0.3, clamp(p.wd * 1.5, 72, 92), { seed: p.seed + k, t }); }
            const cu = ease.back(seg(t, ts + 0.9, ts + 1.4)); g.save(); g.translate((a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2); g.scale(cu, cu); chip(g, fmt(p.s.v) + (d.unit && i === 0 ? " " + d.unit : ""), 0, 0, { red: i === 0 && t > t2 - 0.3 }); g.restore(); } });
        pos.forEach((p, i) => { const ts = t1 + 0.2 + i * 0.5, u = seg(t, ts + 0.6, ts + 1.1); if (u <= 0) return; g.save(); g.globalAlpha *= clamp(u * 3, 0, 1); token(g, p.s.what, p.x, p.y, DR, { k: ease.settle(u), seed: p.seed, t }); fit(g, p.s.n, p.x, p.y + (Math.sin(p.ang) > 0 ? DR + 36 : -DR - 36), 260, { size: F.small, color: P.ink2, weight: 700 }); g.restore(); });
        // hub: token + running total of all spokes
        const hu = ease.settle(seg(t, t0 - 0.3, t0 + 0.6)), cnt = ease.out(seg(t, t1 + 0.3, t1 + 0.3 + n * 0.5 + 0.8)); token(g, d.hub.what ?? "crane", cx, cy, HR, { k: hu, red: false, sc: 1.3, t }); g.save(); g.beginPath(); g.arc(cx, cy, (HR + 16) * hu, 0, TAU); ui.ink(g, 3, P.ink2); g.restore();
        g.save(); g.globalAlpha *= seg(t, t0 + 0.3, t0 + 0.9); ui.tag(g, d.hub.n, cx, cy - HR - 52, { size: F.small }); ui.num(g, fmt(total * cnt, 0), cx, cy + HR + 66, { size: 76 }); ui.caption(g, d.unit ?? "total", cx, cy + HR + 122, { size: F.small, color: P.mid, caps: false, spacing: 0 }); g.restore();
        if (d.cap) ui.caption(g, d.cap, w / 2, h - 44, { size: F.cap, color: P.ink2, weight: 700 });
      },
    };
  },
};
