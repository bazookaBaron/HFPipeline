// kind: tugOfWar (family: relations) - two sides pull a rope over a ground marker: figures (SH mannequins, count and lean = force) on each end, a banner with each side's SH icon and force numeral,
// a red marker on the rope that slides toward the stronger side over a ground scale. data: { left:{ n:"Importers", what:"container", force:70 }, right:{ n:"Exporters", what:"oilTank", force:55 }, unit:"index", cap, note }
// focus ids: "sides" (both teams land, rope tightens, force numerals count), "marker" (the marker slides to the stronger side + the offset scale)
import { P, F, ease, seg, clamp, lerp, ui, rng, icon, sd, fit, chip, circ, fmt, TAU, stroke } from "./_srd.js";
export default {
  name: "tugOfWar", family: "relations",
  doc: "Two teams pulling a rope; a red marker slides toward the stronger side along a ground scale.",
  example: [
    { cap: "Who pulls harder on price", unit: "index", left: { n: "Buyers", what: "container", force: 62 }, right: { n: "Producers", what: "oilTank", force: 81 }, note: "producers win by 19" },
    { cap: "Rail against road", left: { n: "Rail", what: "trainWagon", force: 40 }, right: { n: "Road", what: "truck", force: 40 } },
  ],
  build(d, K) {
    const r = K.rng, w = 1700, h = 900, gy = 640, cx = w / 2, L = d.left, R = d.right, fl = L.force, fr = R.force, tot = fl + fr || 1, off = clamp((fr - fl) / tot, -1, 1) * 330;
    const nL = clamp(Math.round(fl / Math.max(fl, fr) * 5), 1, 6), nR = clamp(Math.round(fr / Math.max(fl, fr) * 5), 1, 6), seed = sd(r);
    const team = (n, side) => Array.from({ length: n }, (_, i) => ({ x: cx + side * (250 + i * 128), lean: 0.1 + 0.03 * i, sd: sd(r), ph: r() * 6 }));
    const TL = team(nL, -1), TR = team(nR, 1);
    return {
      w, h, focus: [{ id: "sides", x: 0, y: 40, w, h: h - 60 }, { id: "marker", x: cx - 560, y: 160, w: 1120, h: 640 }],
      draw(g, t, at) {
        const t0 = at.sides ?? 0, t1 = at.marker ?? t0 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 });
        // ground: line with tick scale (annotation), centre line, soft ground band
        g.beginPath(); g.moveTo(80, gy); g.lineTo(w - 80, gy); ui.ink(g, 5, P.ink); g.fillStyle = P.fog; g.fillRect(80, gy, w - 160, 150); g.save(); g.beginPath(); g.rect(80, gy, w - 160, 150); g.clip(); ui.hatch(g, 80, gy, w - 160, 150, 16, "rgba(139,134,123,.18)"); g.restore();
        for (let k = -10; k <= 10; k++) { const x = cx + k * 66, mj = k % 5 === 0; g.beginPath(); g.moveTo(x, gy); g.lineTo(x, gy + (mj ? 30 : 16)); ui.ink(g, mj ? 3 : 1.8, P.ink2); }
        g.beginPath(); g.setLineDash([10, 10]); g.moveTo(cx, gy - 330); g.lineTo(cx, gy + 6); ui.ink(g, 2.5, P.mid); g.setLineDash([]);
        // teams
        const tu = i => ease.settle(seg(t, t0 - 0.2 + i * 0.3, t0 + 0.4 + i * 0.3)), pull = ease.io(seg(t, t0 + 0.8, t0 + 1.8)), shake = Math.sin(t * 9) * 1.2 * pull;
        [[TL, -1, L], [TR, 1, R]].forEach(([tm, sg, side]) => tm.forEach((q, i) => { const u = tu(i); if (u <= 0) return; g.save(); g.translate(q.x + sg * (1 - u) * 80 + sg * shake, gy + 4); g.rotate(sg * (q.lean * (0.4 + 0.6 * pull) + Math.sin(t * 3 + q.ph) * 0.01)); if (sg < 0) g.scale(-1, 1); g.globalAlpha *= clamp(u * 3, 0, 1); icon(g, "mannequin", 0, -150, 300, { seed: q.sd, t, p: { pose: "walk" } }); g.restore(); }));
        // rope: sags then tightens as the teams pull, runs between the two inner hands over the marker
        const xl = TL[0].x + 30, xr = TR[0].x - 30, ry = gy - 168, sag = (1 - pull) * 46 + 6, ru = ease.io(seg(t, t0 + 0.3, t0 + 1.0)); g.save(); g.lineCap = "round";
        for (const [lw, c] of [[13, P.ink], [8, "#b69d6c"]]) { g.beginPath(); g.moveTo(xl, ry); const e = lerp(xl, xr, ru); for (let x = xl; x <= e; x += 12) g.lineTo(x, ry + Math.sin((x - xl) / (xr - xl) * Math.PI) * sag); g.lineWidth = lw; g.strokeStyle = c; g.stroke(); } g.restore();
        // red marker ribbon on the rope slides to the stronger side (after the second focus)
        const mu = ease.settle(seg(t, t1 - 0.1, t1 + 1.3)), mx = cx + off * mu, my = ry + Math.sin((mx - xl) / (xr - xl) * Math.PI) * sag; g.save(); g.translate(mx, my); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 74); ui.ink(g, 4, P.ink); g.beginPath(); g.moveTo(0, 74); g.lineTo(46, 94); g.lineTo(0, 114); g.closePath(); ui.fill(g, P.red); ui.ink(g, 3, P.ink); circ(g, 0, 0, 12, P.red, 3); g.restore();
        if (mu > 0.05) { g.beginPath(); g.moveTo(cx, gy + 66); g.lineTo(cx + off * mu, gy + 66); ui.ink(g, 7, P.red); g.beginPath(); g.moveTo(cx + off * mu, gy + 66); g.lineTo(cx + off * mu - Math.sign(off || 1) * 20, gy + 54); g.lineTo(cx + off * mu - Math.sign(off || 1) * 20, gy + 78); g.closePath(); ui.fill(g, P.red); if (mu > 0.5 && Math.abs(off) > 5) chip(g, (fr > fl ? "+" : "−") + fmt(Math.abs(fr - fl)) + (d.unit ? " " + d.unit : ""), cx + off * mu / 2, gy + 118, { red: true }); }
        // banners with icon + force numeral for each side
        [[L, -1, fl], [R, 1, fr]].forEach(([s, sg, f], k) => { const u = ease.out(seg(t, t0 + 0.1 + k * 0.15, t0 + 0.7 + k * 0.15)), bx = cx + sg * 560; g.save(); g.globalAlpha *= u; g.translate(bx, 250 + (1 - u) * -40); ui.card(g, -250, -150, 500, 300, { r: 14, rule: false }); icon(g, s.what ?? "container", 0, -52, 126, { seed: 9 + k, t });
          fit(g, s.n, 0, 36, 440, { size: F.cap, color: P.ink2, weight: 700 }); const cu = ease.out(seg(t, t0 + 0.6, t0 + 1.9)); ui.num(g, fmt(f * cu, 0), 0, 100, { size: 76, color: P.ink }); g.restore(); });
        if (d.cap) ui.caption(g, d.cap, w / 2, h - 44, { size: F.cap, color: P.ink2, weight: 700 }); if (d.note && t > t1 + 1) { g.save(); g.globalAlpha *= seg(t, t1 + 1, t1 + 1.6); ui.tag(g, d.note, cx, 180, { size: F.small }); g.restore(); }
      },
    };
  },
};
