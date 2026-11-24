// kind: controlRing (family: relations) - a central chokepoint on a paper disc with concentric reach rings and actors placed around it; arrows of reach run from each actor to the centre
// (arrow width and closeness = strength). The centre (or the actor flagged red) is the one red element.
// data: { center:{ n:"Strait of Hormuz", what:"lighthouse" }, actors:[{ n:"Iran", what:"warship", v:70 (strength 0-100, optional), note?:"mines + missiles", red?:true }], rings?:["200 km","500 km"], cap }
// focus ids: "center" (the chokepoint + rings), "actors" (actors land around it one by one, arrows of reach draw), "reach" (strongest actor: width, value, moving cargo)
import { P, F, ease, seg, clamp, lerp, ui, rng, icon, sd, fit, chip, circ, mkPath, ribbon, stroke, fmt, TAU } from "./_srd.js";
import { token } from "./_srd2.js";
export default {
  name: "controlRing", family: "relations",
  doc: "Central chokepoint with concentric rings, actors around it and arrows of reach whose width is strength.",
  example: [
    { cap: "Who can close Hormuz", center: { n: "Hormuz", what: "lighthouse" }, rings: ["50 km", "300 km", "1,000 km"], actors: [{ n: "Iran", what: "warship", v: 90, note: "coast + mines" }, { n: "US Navy", what: "carrier", v: 75 }, { n: "Oman", what: "skiff", v: 35 }, { n: "Gulf states", what: "oilTank", v: 55 }, { n: "Insurers", what: "shield", v: 60 }, { n: "Pirates", what: "pirate", v: 15 }] },
    { cap: "Who controls the pass", center: { n: "Pass", what: "mountain" }, actors: [{ n: "Army", what: "warship", v: 60 }, { n: "Rail", what: "locomotive", v: 80 }, { n: "Road", what: "truck", v: 45 }, { n: "Toll", what: "coinStack", v: 30 }] },
  ],
  build(d, K) {
    const r = K.rng, A = d.actors, n = A.length, rx = 600, ry = 320, w = 1640, h = 960, cx = w / 2, cy = h / 2 - 20, vmax = Math.max(...A.map(a => a.v ?? 50)), CR = 108, AR = 66, anyRed = A.some(a => a.red);
    const pos = A.map((a, i) => { const ang = -Math.PI / 2 + (i + 0.5) * TAU / n, f = 1 - 0.34 * ((a.v ?? 50) / vmax); return { a, ang, x: cx + rx * f * Math.cos(ang), y: cy + ry * f * Math.sin(ang), seed: sd(r), v: a.v ?? 50 }; });
    const top = pos.reduce((a, b) => b.v > a.v ? b : a), tb = { x: Math.min(top.x, cx) - 240, y: Math.min(top.y, cy) - 220, w: Math.abs(top.x - cx) + 480, h: Math.abs(top.y - cy) + 440 };
    return {
      w, h, focus: [{ id: "center", x: cx - 520, y: cy - 330, w: 1040, h: 660 }, { id: "actors", x: 0, y: 0, w, h }, { id: "reach", x: clamp(tb.x, 0, w - Math.max(900, tb.w)), y: clamp(tb.y, 0, h - Math.max(620, tb.h)), w: Math.max(900, tb.w), h: Math.max(620, tb.h) }],
      draw(g, t, at) {
        const t0 = at.center ?? 0, t1 = at.actors ?? t0 + 2.6, t2 = at.reach ?? t1 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 });
        // concentric reach rings (dashed ellipses) + tick marks + optional labels
        const rings = d.rings ?? [], rf = [0.36, 0.66, 0.96]; rf.forEach((f, i) => { const u = ease.io(seg(t, t0 - 0.2 + i * 0.25, t0 + 0.8 + i * 0.25)); if (u <= 0) return; g.save(); g.beginPath(); g.ellipse(cx, cy, rx * f * 1.0, ry * f * 1.0, 0, -Math.PI / 2, -Math.PI / 2 + TAU * u); g.setLineDash([16, 12]); g.lineDashOffset = -t * 10 * (i % 2 ? -1 : 1); ui.ink(g, 2.5, i === 2 ? P.mid : P.hair); g.restore();
          if (rings[i] && u > 0.95) { g.save(); ui.tag(g, rings[i], cx + rx * f * 0.72, cy - ry * f * 0.72, { size: F.small, rot: 0.04 }); g.restore(); } });
        // arrows of reach (under tokens)
        pos.forEach((p, i) => { const ts = t1 + 0.35 + i * 0.5, u = ease.io(seg(t, ts + 0.25, ts + 1.0)); if (u <= 0) return; const dx = cx - p.x, dy = cy - p.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, a0 = [p.x + ux * (AR + 10), p.y + uy * (AR + 10)], a1 = [cx - ux * (CR + 40), cy - uy * (CR + 40)], wd = 8 + 22 * (p.v / vmax);
          const pts = [a0, [lerp(a0[0], a1[0], u), lerp(a0[1], a1[1], u)]]; const red = p.a.red; ribbon(g, pts, wd, red ? P.red : "#a49f93", u > 0.98 ? wd * 0.9 + 22 : 0); if (u >= 1) for (let k = 0; k < 2; k++) { const ph = ((t - ts) * 0.5 + k * 0.5) % 1; circ(g, lerp(a0[0], a1[0], ph), lerp(a0[1], a1[1], ph), 6, P.paper, 2.5); } });
        // actors land one by one
        pos.forEach((p, i) => { const ts = t1 + 0.35 + i * 0.5, u = seg(t, ts, ts + 0.5); if (u <= 0) return; const k = ease.settle(u), red = !!p.a.red; g.save(); g.globalAlpha *= clamp(u * 3, 0, 1); token(g, p.a.what, p.x, p.y, AR, { k, red, seed: p.seed, t });
          const ly = p.y + (Math.sin(p.ang) > 0 ? AR + 38 : -AR - 38); fit(g, p.a.n, p.x, ly, 250, { size: F.small, color: red ? P.red : P.ink2, weight: 700 }); if (p.a.v !== undefined) { const q = ease.back(seg(t, ts + 0.5, ts + 1.0)); g.save(); g.translate(p.x + (Math.cos(p.ang) >= 0 ? AR + 54 : -AR - 54), p.y); g.scale(q, q); chip(g, fmt(p.a.v), 0, 0, { red }); g.restore(); } g.restore(); });
        // the chokepoint: big token, pulsing ring (the red element unless an actor is flagged red)
        const cu = ease.settle(seg(t, t0 - 0.3, t0 + 0.6)), pul = 1 + 0.05 * Math.sin(t * 3); token(g, d.center.what ?? "lighthouse", cx, cy, CR, { k: cu, red: !anyRed, sc: 1.3, t }); g.save(); g.beginPath(); g.arc(cx, cy, (CR + 22) * pul * cu, 0, TAU); ui.ink(g, 3, anyRed ? P.mid : P.red); g.restore();
        if (d.center.n) { g.save(); g.globalAlpha *= seg(t, t0 + 0.3, t0 + 0.9); ui.tag(g, d.center.n, cx, cy + CR + 56, { size: F.small, color: anyRed ? P.ink : P.red }); g.restore(); }
        // reach focus: the strongest actor's note
        if (top.a.note && t > t2 - 0.2) { g.save(); g.globalAlpha *= seg(t, t2 - 0.1, t2 + 0.5); ui.tag(g, top.a.note, (top.x + cx) / 2, (top.y + cy) / 2 - 56, { size: F.small, rot: -0.02 }); g.restore(); }
        if (d.cap) ui.caption(g, d.cap, w / 2, h - 44, { size: F.cap, color: P.ink2, weight: 700 });
      },
    };
  },
};
