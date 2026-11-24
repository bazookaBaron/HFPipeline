// kind: cutaway (family: process) - an SH object scaled up, a hatched section window cut into it reveals labelled internal parts.
// data: { object:"building" (any SH generator / word), parts:[{label, what}] (3..6), cap:"", objectLabel:"", size:"" (scale-key text, e.g. "230 m") }
// focus ids: "object" (outer thing + section line), "section" (the cut-face with parts), "labels" (leader labels)
import { P, F, ease, seg, clamp, lerp, ui, thing, lab, TAU } from "./_ptu.js";
export default {
  name: "cutaway", family: "process",
  doc: "The generated object drawn large and ghosted; a dashed section line opens a hatched cut-face where small generated parts sit, each with a leader and label; scale key + dimension line.",
  example: [{ object: "refineryColumn", parts: [{ label: "Crude in", what: "barrel" }, { label: "Heating coil", what: "gasFlare" }, { label: "Trays", what: "pallet" }, { label: "Fuel out", what: "fuelPump" }], cap: "Inside a refinery column", objectLabel: "Distillation tower", size: "60 m" },
            { object: "tanker", parts: [{ label: "Cargo tanks", what: "oilTank" }, { label: "Pump room", what: "pipe" }, { label: "Engine", what: "chip" }, { label: "Crew", what: "mannequin" }, { label: "Bridge", what: "lighthouse" }], cap: "Inside a tanker", objectLabel: "Crude carrier", size: "330 m" }],
  build(d, K) {
    const Pt = (d.parts || []).slice(0, 6), n = Math.max(2, Pt.length), w = 1800, h = 940, cx = w / 2, cy = 500, S = 640, pw = 640, ph = 430, cols = n <= 3 ? n : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), cell = [pw / cols, ph / rows];
    const pos = i => [cx - pw / 2 + (i % cols + 0.5) * cell[0], cy - ph / 2 + (Math.floor(i / cols) + 0.5) * cell[1] + 10];
    return {
      w, h,
      focus: [{ id: "object", x: 250, y: 60, w: 1300, h: 820 }, { id: "section", x: 420, y: 230, w: 960, h: 560 }, { id: "labels", x: 150, y: 120, w: 1500, h: 760 }],
      draw(g, t, at) {
        const a0 = at.object ?? 0, a1 = at.section ?? a0 + 2.6, a2 = at.labels ?? a1 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        // ground + object (ghosted once the section opens)
        g.beginPath(); g.moveTo(cx - 700, cy + 330); g.lineTo(cx - 700 + 1400 * ease.io(seg(t, a0 - 0.3, a0 + 0.7)), cy + 330); ui.ink(g, 3, P.hair);
        const ou = seg(t, a0 - 0.2, a0 + 1.2), open = ease.io(seg(t, a1 - 0.1, a1 + 0.9));
        g.save(); g.translate(cx, cy); g.globalAlpha *= (1 - open * 0.55); thing(g, d.object, 3, { s: S * 1.18, u: ou, t }); g.restore();
        if (t > a0 + 0.8) { const q = seg(t, a0 + 0.8, a0 + 1.4); ui.pop(g, q, cx, 120, () => ui.tag(g, d.objectLabel || d.object, 0, 0)); ui.leader(g, cx, 150, cx - 90, cy - 200, q * 0.9); }
        // dimension line at the left + scale key
        if (d.size && t > a0 + 0.9) { const q = ease.io(seg(t, a0 + 0.9, a0 + 1.6)), x = cx - S * 0.78, y0 = cy - 300, y1 = cy + 300; g.save(); g.beginPath(); g.moveTo(x, lerp(y0 + 300, y0, q)); g.lineTo(x, lerp(y0 + 300, y1, q)); ui.ink(g, 2.5, P.ink2); for (const yy of [y0, y1]) { g.beginPath(); g.moveTo(x - 14, yy); g.lineTo(x + 14, yy); ui.ink(g, 2.5, P.ink2); } g.restore(); if (q > .8) ui.tag(g, d.size, x - 90, cy, { rot: -0.04 }); }
        // section window: dashed rectangle expands, hatch cut-face, parts pop in
        if (open > 0) { const pu = open; g.save(); g.translate(cx, cy + 10); g.scale(pu, pu); ui.shadow(g, () => ui.rr(g, -pw / 2 - 18, -ph / 2 - 18, pw + 36, ph + 36, 22), 6, 12); ui.rr(g, -pw / 2 - 18, -ph / 2 - 18, pw + 36, ph + 36, 22); ui.fill(g, P.paper); ui.ink(g, 4, P.ink);
          ui.rr(g, -pw / 2, -ph / 2, pw, ph, 12); ui.fill(g, P.sand); g.save(); ui.rr(g, -pw / 2, -ph / 2, pw, ph, 12); ui.hatch(g, -pw / 2, -ph / 2, pw, ph, 14, "rgba(139,134,123,.32)"); g.restore(); ui.rr(g, -pw / 2, -ph / 2, pw, ph, 12); ui.ink(g, 2, P.mid); g.restore();
          g.save(); g.translate(cx, cy + 10); g.setLineDash([16, 10]); g.beginPath(); g.moveTo(-pw / 2 - 150, -ph / 2 - 18); g.lineTo(-pw / 2 - 18, -ph / 2 - 18); g.moveTo(-pw / 2 - 150, ph / 2 + 18); g.lineTo(-pw / 2 - 18, ph / 2 + 18); ui.ink(g, 3, P.red); g.setLineDash([]); g.restore();
          if (open > 0.7) { ui.caption(g, "A", cx - pw / 2 - 170, cy - ph / 2 - 8, { size: F.cap, color: P.red, weight: 800 }); ui.caption(g, "A", cx - pw / 2 - 170, cy + ph / 2 + 28, { size: F.cap, color: P.red, weight: 800 }); }
          Pt.forEach((p, i) => { const ta = a1 + 0.6 + i * 0.45, u = seg(t, ta, ta + 0.5), [x, y] = pos(i); if (u <= 0) return; ui.pop(g, u, x, y - 16, () => { g.save(); thing(g, p.what || "container", 2100 + i * 9, { s: Math.min(cell[0], cell[1]) * 0.62, u: 1, t }); g.restore(); }); ui.caption(g, String(i + 1), x - cell[0] * 0.36, y - cell[1] * 0.36, { size: F.small, weight: 800, color: P.ink, caps: false, alpha: u }); }); }
        // labels + leaders to the outside margins
        Pt.forEach((p, i) => { const ta = a2 - 0.1 + i * 0.4, u = seg(t, ta, ta + 0.6), [x, y] = pos(i), left = x < cx || (n % 2 && i === (n - 1)) && false, side = x < cx ? -1 : 1, lx = cx + side * (pw / 2 + 330); if (u <= 0 || t < a1 + 0.9) return;
          const y2 = clamp(y + (i % cols === 1 && cols === 3 ? (Math.floor(i / cols) ? 90 : -90) : 0), cy - ph / 2 - 40, cy + ph / 2 + 60), ex = cx + side * (pw / 2 + 130);
          g.save(); g.beginPath(); g.moveTo(x + side * cell[0] * 0.3, y - 16); g.lineTo(x + side * cell[0] * 0.3 + (ex - x - side * cell[0] * 0.3) * ease.io(u), y2 + (y - 16 - y2) * 0 + 0 * u); g.lineTo(x + side * cell[0] * 0.3 + (ex - x - side * cell[0] * 0.3) * ease.io(u), y2); ui.ink(g, 2.5, P.ink2); g.restore();
          if (u > 0.7) { g.beginPath(); g.arc(x + side * cell[0] * 0.3, y - 16, 5, 0, TAU); ui.fill(g, P.ink); lab(g, `${i + 1}  ${p.label || ""}`, ex + side * 14, y2, { align: side < 0 ? "right" : "left", maxW: 300, size: F.small, alpha: seg(t, ta + 0.4, ta + 0.8) }); } });
      },
    };
  },
};
