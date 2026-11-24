// kind: explodedView (family: process) - an assembled object separates along a dashed axis into labelled parts, then the red part is pulled out.
// data: { object:"phone" (the assembled thing, optional), parts:[{label, what}] (3..6), cap:"", focusPart:0 (index pulled out in red; -1 none) }
// focus ids: "assembled", "parts" (separated along the axis), "labels"
import { P, F, ease, seg, clamp, lerp, ui, thing, lab, badge, TAU } from "./_ptu.js";
export default {
  name: "explodedView", family: "process",
  doc: "Assembled object ghost + generated parts that slide apart along a dashed assembly axis with leaders, numbered badges and labels; one part drifts out in red.",
  example: [{ object: "phone", parts: [{ label: "Screen glass", what: "documentPage" }, { label: "Chip", what: "chip" }, { label: "Battery", what: "barrel" }, { label: "Case", what: "container" }], cap: "What is inside one phone", focusPart: 1 },
            { object: "car", parts: [{ label: "Engine", what: "pumpjack" }, { label: "Wheels", what: "anchor" }, { label: "Chips", what: "chip" }, { label: "Body", what: "truck" }, { label: "Fuel tank", what: "oilTank" }], cap: "A car in five parts", focusPart: 2 }],
  build(d, K) {
    const Pt = (d.parts || []).slice(0, 6), n = Math.max(2, Pt.length), w = 1800, h = Math.max(940, 280 + n * 150), cx = w / 2, cy = h / 2 + 20, dy = clamp(640 / (n - 1), 100, 190), dx = 70, sz = clamp(420 / n + 40, 120, 210), fp = d.focusPart ?? 0;
    const fin = i => [cx + (i - (n - 1) / 2) * dx, cy + (i - (n - 1) / 2) * dy], asm = i => [cx + (i - (n - 1) / 2) * 6, cy + (i - (n - 1) / 2) * 8];
    return {
      w, h,
      focus: [{ id: "assembled", x: 450, y: cy - 330, w: 900, h: 660 }, { id: "parts", x: 250, y: 100, w: 1300, h: h - 160 }, { id: "labels", x: 100, y: 120, w: 1600, h: h - 200 }],
      draw(g, t, at) {
        const a0 = at.assembled ?? 0, a1 = at.parts ?? a0 + 2.6, a2 = at.labels ?? a1 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        const ex = ease.io5(seg(t, a1 - 0.1, a1 + 1.4)), ghost = 1 - ex * 0.8;
        // floor ellipse + soft shadow
        g.save(); g.globalAlpha *= seg(t, a0 - 0.3, a0 + 0.5); g.fillStyle = P.shadow2; g.beginPath(); g.ellipse(cx, cy + 40 + n * dy * 0.45, 380, 60, 0, 0, TAU); g.fill(); g.restore();
        // assembled ghost
        if (d.object) { g.save(); g.translate(cx, cy); g.globalAlpha *= ghost; thing(g, d.object, 11, { s: 520, u: seg(t, a0 - 0.2, a0 + 1.0), t }); g.restore(); }
        // dashed axis through all parts
        const axu = ease.io(seg(t, a1 + 0.1, a1 + 1.0)); if (axu > 0) { const p0 = fin(0), p1 = fin(n - 1), ox = (p0[0] - p1[0]) * 0.25, oy = (p0[1] - p1[1]) * 0.25; g.save(); g.setLineDash([14, 12]); g.beginPath(); g.moveTo(p0[0] + ox, p0[1] + oy); g.lineTo(lerp(p0[0] + ox, p1[0] - ox, axu), lerp(p0[1] + oy, p1[1] - oy, axu)); ui.ink(g, 2.5, P.mid); g.restore(); }
        // parts: assembled offsets -> exploded positions; the focus part drifts further out sideways
        for (let i = n - 1; i >= 0; i--) { const p = Pt[i] || {}, [x0, y0] = asm(i), [x1, y1] = fin(i), sideOut = i === fp ? seg(t, a2 + 0.1, a2 + 1.0) : 0, x = lerp(x0, x1, ex) + ease.io(sideOut) * 150, y = lerp(y0, y1, ex), u = seg(t, a1 + 0.1 + i * 0.12, a1 + 0.8 + i * 0.12); if (u <= 0) continue;
          g.save(); g.translate(x, y); g.globalAlpha *= Math.min(1, u * 2); ui.shadow(g, () => ui.rr(g, -sz * 0.75, -sz * 0.32, sz * 1.5, sz * 0.64, 20), 4, 10, ex); thing(g, p.what || "container", 2400 + i * 11, { s: sz, u: Math.min(1, u * 1.2), t, red: i === fp && sideOut > 0.3 }); g.restore(); }
        // leaders + badges + labels (alternating sides)
        Pt.forEach((p, i) => { const ta = a2 - 0.1 + i * 0.4, u = seg(t, ta, ta + 0.6); if (u <= 0) return; const [x, y] = fin(i), side = i % 2 ? 1 : -1, sOut = i === fp ? ease.io(seg(t, a2 + 0.1, a2 + 1.0)) * 150 : 0, x0 = x + sOut + side * sz * 0.8, lx = cx + side * 560;
          g.save(); g.beginPath(); g.moveTo(x0, y); g.lineTo(lerp(x0, lx, ease.io(u)), y); ui.ink(g, 2.5, i === fp ? P.red : P.ink2); g.restore(); if (u > 0.7) { badge(g, i + 1, lx + side * 34, y, { r: 22, red: i === fp }); lab(g, p.label || "", lx + side * 70, y, { align: side < 0 ? "right" : "left", maxW: 260, size: F.small, color: i === fp ? P.redInk : P.ink2, alpha: seg(t, ta + 0.4, ta + 0.8) }); } });
      },
    };
  },
};
