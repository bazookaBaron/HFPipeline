// kind: balanceScale (family: comparison) - a beam balance on a pillar and base: two chained pans, generated objects dropped in one by one (alternating sides) while the beam tips live
// from the cumulative weights (damped settle after the last drop), a tilt dial at the pivot, count/weight tags under the pans; the heavier side is red.
// data: { left: { label: "Rent", what: "house", n: 3, weight: 3 }, right: { label: "Savings", what: "coin", n: 9, weight: 1 }, cap: "...", note: "(optional)" }   (n = objects in the pan (1..12), weight = each object's weight, default 1)
// focus ids: "scale" (whole balance as it fills), "weights" (the two pans + totals after the tip)
import * as H from "./_h_numcmp.js";
export default {
  name: "balanceScale", family: "comparison",
  doc: "Beam balance with chained pans; objects drop in alternately, the beam tips live from cumulative weights and settles; heavier side red; tilt dial and tags.",
  example: [{ left: { label: "Export", what: "containerShip", n: 3, weight: 3 }, right: { label: "Import", what: "container", n: 7, weight: 1 }, cap: "Trade balance", note: "imports outweigh exports" },
            { left: { label: "Costs", what: "coin", n: 8, weight: 1 }, right: { label: "Benefits", what: "house", n: 4, weight: 3 }, cap: "Cost vs benefit" }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { lab, sit, measure, line, flag, fmt, hashSeed, ell, ground, tw } = H;
    const L = { n: 1, weight: 1, ...d.left }, Rr = { n: 1, weight: 1, ...d.right }, nl = clamp(L.n, 1, 12), nr = clamp(Rr.n, 1, 12), wL = nl * L.weight, wR = nr * Rr.weight, heavy = wL > wR ? "L" : wR > wL ? "R" : "";
    const w = 1600, h = 920, px = 800, py = 320, BL = 470, CH = 290, gyB = 840, panW = 340, MAXT = 11 * Math.PI / 180;
    const mL = measure(L.what, 5), mR = measure(Rr.what, 5);
    // drop schedule: alternate sides; each object has a weight ramp. total drop span ~2 s
    const order = []; for (let i = 0; i < Math.max(nl, nr); i++) { if (i < nl) order.push(["L", i]); if (i < nr) order.push(["R", i]); }
    const layout = (n, m) => { const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.4))), cw = (panW - 30) / cols, sz = Math.min(cw / (m.w / 100) * 0.95, 130 / (m.h / 100) * 1.0, 130); return { cols, cw, sz, hh: m.h * sz / 100 }; };
    const lL = layout(nl, mL), lR = layout(nr, mR);
    const pos = (side, i) => { const lay = side === "L" ? lL : lR, n = side === "L" ? nl : nr, row = Math.floor(i / lay.cols), c = i % lay.cols, inRow = Math.min(lay.cols, n - row * lay.cols); return { x: (c - (inRow - 1) / 2) * lay.cw, y: -row * lay.hh * 0.82 }; };
    return {
      w, h, focus: [{ id: "scale", x: 30, y: 80, w: w - 60, h: h - 100 }, { id: "weights", x: 100, y: 330, w: w - 200, h: 560 }],
      draw(g, t, at) {
        const t0 = at.scale ?? 0, t1 = at.weights ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        // cumulative weight at time t (each object ramps in as it lands)
        const dropT = k => t0 + 0.4 + k * Math.min(0.32, 2.2 / order.length); let cl = 0, cr = 0; order.forEach(([s, i], k) => { const u = ease.io(seg(t, dropT(k) + 0.25, dropT(k) + 0.6)); if (s === "L") cl += u * L.weight; else cr += u * Rr.weight; });
        const last = dropT(order.length - 1) + 0.6, tot = Math.max(cl, cr, 1e-6), target = Math.tanh(1.6 * (cl - cr) / Math.max(wL, wR, 1)) * MAXT, osc = t > last ? Math.exp(-(t - last) * 2.6) * Math.cos((t - last) * 7) : 1, ang = (t > last ? lerp(target * 0.0, target, 1) : target) * (t > last ? 1 : 1);
        const tilt = t > last ? target * (1 - Math.exp(-(t - last) * 0) * 0) + Math.sin((t - last) * 7.5) * Math.exp(-(t - last) * 2.2) * 0.02 * Math.sign(target || 1) : target;
        // base + pillar
        const bu = ease.back(seg(t, t0 - 0.2, t0 + 0.6)); g.save(); g.translate(px, 0); g.scale(bu, bu); ui.shadow(g, () => { ui.rr(g, -190, gyB - 36, 380, 36, 10); }, 6, 12);
        ui.rr(g, -190, gyB - 36, 380, 36, 10); ui.fill(g, P.ink2); ui.ink(g, 4, P.ink); g.beginPath(); g.moveTo(-34, gyB - 36); g.lineTo(-18, py + 30); g.lineTo(18, py + 30); g.lineTo(34, gyB - 36); g.closePath(); ui.fill(g, P.stone2); ui.ink(g, 4, P.ink2);
        for (let i = 0; i < 4; i++) { const y = gyB - 80 - i * 100; line(g, -26 + i * 2.5, y, 26 - i * 2.5, y, 2, P.mid); } g.restore();
        // beam + pans (rotate about pivot)
        const x1 = px - Math.cos(tilt) * BL, y1 = py - Math.sin(tilt) * BL * -1, x2 = px + Math.cos(tilt) * BL, y2 = py + Math.sin(tilt) * BL * -1;   // left end rises when tilt<0
        const yl = py + Math.sin(tilt) * BL * -1 * -1, yr = py - Math.sin(tilt) * BL * -1 * -1;
        const eL = [px - Math.cos(tilt) * BL, py + Math.sin(tilt) * BL], eR = [px + Math.cos(tilt) * BL, py - Math.sin(tilt) * BL];
        g.save(); g.translate(px, py); g.rotate(-tilt); ui.shadow(g, () => { ui.rr(g, -BL - 16, -14, 2 * BL + 32, 28, 14); }, 4, 8, bu);
        ui.rr(g, -BL - 16, -14, 2 * BL + 32, 28, 14); ui.fill(g, P.ink2); ui.ink(g, 4, P.ink); for (let i = -4; i <= 4; i++) { g.beginPath(); g.arc(i * BL / 4.4, 0, 4, 0, 7); ui.fill(g, P.mid); } g.restore();
        g.beginPath(); g.arc(px, py, 30, 0, 7); ui.fill(g, P.stone2); ui.ink(g, 4, P.ink); g.beginPath(); g.arc(px, py, 10, 0, 7); ui.fill(g, P.ink);
        // tilt dial (small arc under the pivot with a needle)
        { const r0 = 86, du = seg(t, t0 + 0.2, t0 + 0.9); g.save(); g.globalAlpha = du; g.beginPath(); g.arc(px, py + 10, r0, Math.PI * 0.25, Math.PI * 0.75); ui.ink(g, 3, P.mid); for (let i = -4; i <= 4; i++) { const a = Math.PI / 2 + i * 0.12; line(g, px + Math.cos(a) * (r0 - 8), py + 10 + Math.sin(a) * (r0 - 8), px + Math.cos(a) * (r0 + 6), py + 10 + Math.sin(a) * (r0 + 6), i === 0 ? 3 : 1.8, i === 0 ? P.ink : P.mid); }
          const na = Math.PI / 2 + tilt * 3.2; line(g, px, py + 10, px + Math.cos(na) * (r0 - 6), py + 10 + Math.sin(na) * (r0 - 6), 4, heavy ? P.red : P.ink); g.restore(); }
        // pans: chains from the beam end to the pan rim, pan bowl, objects
        const pan = (e, side, lay, m, what, n, col) => { const [ex, ey] = e, pu = ease.back(seg(t, t0 + 0.1, t0 + 0.8)), py2 = ey + CH; if (pu <= 0) return; const R_ = heavy === side;
          g.save(); g.globalAlpha = Math.min(1, pu * 2); line(g, ex, ey, ex - panW / 2 + 12, py2 - 6, 2.5, P.ink2); line(g, ex, ey, ex + panW / 2 - 12, py2 - 6, 2.5, P.ink2); g.beginPath(); g.arc(ex, ey, 9, 0, 7); ui.fill(g, P.paper); ui.ink(g, 3.5, P.ink); g.restore();
          g.save(); g.translate(ex, py2); ui.shadow(g, () => { g.beginPath(); g.ellipse(0, 6, panW / 2, 24, 0, 0, Math.PI); g.lineTo(panW / 2, 0); g.lineTo(-panW / 2, 0); g.closePath(); }, 4, 10); g.beginPath(); g.ellipse(0, 0, panW / 2, 22, 0, 0, Math.PI); g.lineTo(-panW / 2, 0); g.closePath(); ui.fill(g, P.stone2); ui.ink(g, 4, P.ink2);
          g.beginPath(); g.ellipse(0, 0, panW / 2, 14, 0, 0, 7); ui.fill(g, P.stone); ui.ink(g, 3, P.ink2); g.restore();
          // objects land: fall from above into place
          order.forEach(([s, i], k) => { if (s !== side) return; const u = seg(t, dropT(k), dropT(k) + 0.5); if (u <= 0) return; const q = pos(side, i), fy = (1 - ease.out(u)) * -420, sq = u < 1 ? 1 : 1 + Math.exp(-(t - dropT(k) - 0.5) * 9) * Math.sin((t - dropT(k) - 0.5) * 30) * 0.03; g.save(); g.translate(ex + q.x, py2 + q.y - 4 + fy); g.scale(1, sq); g.globalAlpha = Math.min(1, u * 4); sit(g, hashSeed(K.seed, 130 + i + (side === "R" ? 20 : 0)), what, lay.sz, 0, 0, { red: R_ && n === (side === "L" ? nl : nr) && false, t }); g.restore(); });
          // tag below: label + count/weight
          const lu = seg(t, t1 - 0.1, t1 + 0.6), tgy = py2 + 76; if (lu > 0) { ui.pop(g, lu, ex, tgy, () => ui.tag(g, side === "L" ? L.label : Rr.label, 0, 0, { color: R_ ? P.redInk : P.ink })); ui.pop(g, seg(t, t1 + 0.2, t1 + 0.8), ex, tgy + 76, () => flag(g, (side === "L" ? wL : wR) + (d.left.weight === undefined && d.right.weight === undefined ? " pcs" : ""), 0, 0, { red: R_ })); } };
        pan(eL, "L", lL, mL, L.what, nl); pan(eR, "R", lR, mR, Rr.what, nr);
        if (d.note) { const nu = seg(t, t1 + 0.7, t1 + 1.4); if (nu > 0) ui.pop(g, nu, px, 150, () => flag(g, d.note, 0, 0, { red: !!heavy })); }
      },
    };
  },
};
