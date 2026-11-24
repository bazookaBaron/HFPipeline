// kind: clockDial (family: time) - a 12/24 h dial; coloured arcs mark intervals of the day, a hand sweeps through them; each interval gets an icon + label outside the dial.
// data: { hours:24 (or 12), marks:[{from:6, to:9, label:"Rush", what:"truck"}] (1..6, hours as numbers, may wrap midnight), cap:"", redIndex:0 (the red interval) }
// focus ids: "dial", "marks" (arcs + labels), "sweep" (the sweeping hand over the red interval)
import { P, F, ease, seg, clamp, lerp, ui, thing, lab, TAU } from "./_ptu.js";
export default {
  name: "clockDial", family: "time",
  doc: "Drawn dial with hour ticks and numerals, palette-tinted interval arcs with duration numerals, outside icons + labels with leaders and a sweeping hand that triggers each interval.",
  example: [{ hours: 24, marks: [{ from: 6, to: 9, label: "Morning rush", what: "truck" }, { from: 12, to: 14, label: "Lunch peak", what: "grainSack" }, { from: 17, to: 20, label: "Evening rush", what: "car" }], cap: "A day on the road", redIndex: 2 },
            { hours: 12, marks: [{ from: 3, to: 5, label: "Tide in", what: "waveBand" }, { from: 9, to: 11, label: "Tide out", what: "iceFloe" }], cap: "Two tides", redIndex: 0 }],
  build(d, K) {
    const H = d.hours === 12 ? 12 : 24, M = (d.marks || []).slice(0, 6).map(m => ({ ...m, from: +m.from, to: +m.to })), w = 1800, h = 940, cx = w / 2, cy = h / 2 + 30, R = 340, red = d.redIndex ?? 0, ang = hh => -Math.PI / 2 + (((hh % H) + H) % H) / H * TAU, span = m => ((m.to - m.from) % H + H) % H || H;
    const tints = [P.water, P.sand2, P.stone, P.water2, P.sand, P.stone2];
    return {
      w, h,
      focus: [{ id: "dial", x: cx - 560, y: 90, w: 1120, h: 820 }, { id: "marks", x: 120, y: 90, w: 1560, h: 820 }, { id: "sweep", x: cx - 600, y: 120, w: 1200, h: 760 }],
      draw(g, t, at) {
        const a0 = at.dial ?? 0, a1 = at.marks ?? a0 + 2.6, a2 = at.sweep ?? a1 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        const du = ease.out(seg(t, a0 - 0.3, a0 + 0.9)); g.save(); g.translate(cx, cy); g.scale(0.8 + 0.2 * du, 0.8 + 0.2 * du); g.globalAlpha *= Math.min(1, du * 2);
        ui.shadow(g, () => { g.beginPath(); g.arc(0, 0, R + 36, 0, TAU); }, 6, 14); g.beginPath(); g.arc(0, 0, R + 36, 0, TAU); ui.fill(g, P.stone2); ui.ink(g, 4, P.ink); g.beginPath(); g.arc(0, 0, R + 14, 0, TAU); ui.fill(g, P.paper); ui.ink(g, 2.5, P.ink2);
        // interval arcs (grow with the sweep), ticks, numerals
        const sw = H === 24 ? (t - (a2 + 0.4)) / 5 : (t - (a2 + 0.4)) / 4, hand = clamp(sw, 0, 1);
        M.forEach((m, i) => { const ta = a1 - 0.1 + i * 0.5, u = ease.io(seg(t, ta, ta + 0.8)), a_0 = ang(m.from), sp = span(m) / H * TAU, r0 = R - 90, r1 = R - 4; if (u <= 0) return; g.beginPath(); g.arc(0, 0, r1, a_0, a_0 + sp * u); g.arc(0, 0, r0, a_0 + sp * u, a_0, true); g.closePath(); ui.fill(g, i === red ? "#f1cbc6" : tints[i % tints.length]); ui.ink(g, i === red ? 4 : 2.5, i === red ? P.red : P.ink2); });
        for (let k = 0; k < H; k++) { const a = ang(k), long = k % (H === 24 ? 6 : 3) === 0; g.beginPath(); g.moveTo(Math.cos(a) * (R - (long ? 28 : 16)), Math.sin(a) * (R - (long ? 28 : 16)) ); g.lineTo(Math.cos(a) * (R + 10), Math.sin(a) * (R + 10)); ui.ink(g, long ? 4 : 2.5, P.ink); if (long || H === 12) ui.num(g, String(k === 0 && H === 12 ? 12 : k), Math.cos(a) * (R + 62), Math.sin(a) * (R + 62), { size: 34, color: P.ink2 }); }
        M.forEach((m, i) => { const u = seg(t, a1 + 0.5 + i * 0.5, a1 + 1.1 + i * 0.5); if (u <= 0) return; const am = ang(m.from) + span(m) / H * TAU / 2, rr = R - 45; ui.pop(g, u, Math.cos(am) * rr, Math.sin(am) * rr, () => ui.num(g, span(m) + "h", 0, 0, { size: 38, color: i === red ? P.red : P.ink })); });
        // hand
        if (t > a2 - 0.2) { const hu = seg(t, a2 - 0.2, a2 + 0.4), a = ang(H === 24 ? hand * H : hand * H) ; g.save(); g.globalAlpha *= hu; g.beginPath(); g.moveTo(-Math.cos(a) * 40, -Math.sin(a) * 40); g.lineTo(Math.cos(a) * (R - 10), Math.sin(a) * (R - 10)); ui.ink(g, 7, P.ink); g.restore(); }
        g.beginPath(); g.arc(0, 0, 18, 0, TAU); ui.fill(g, P.ink); g.beginPath(); g.arc(0, 0, 7, 0, TAU); ui.fill(g, P.paper); g.restore();
        // outside icons + labels with leaders
        M.forEach((m, i) => { const ta = a1 + 0.9 + i * 0.5, u = seg(t, ta, ta + 0.6); if (u <= 0) return; const am = ang(m.from) + span(m) / H * TAU / 2, side = Math.cos(am) >= 0 ? 1 : -1, ex = cx + Math.cos(am) * (R + 16), ey = cy + Math.sin(am) * (R + 16), lx = cx + side * (R + 300), ly = clamp(cy + Math.sin(am) * (R + 80), 190, h - 130), isRed = i === red;
          g.save(); g.beginPath(); g.moveTo(ex, ey); g.lineTo(lerp(ex, lx - side * 150, ease.io(u)), lerp(ey, ly, ease.io(u))); ui.ink(g, 2.5, isRed ? P.red : P.ink2); g.restore();
          if (u > 0.7) { const al = seg(t, ta + 0.4, ta + 0.8); g.save(); g.globalAlpha *= al; g.translate(lx, ly - 10); thing(g, m.what || "container", 3100 + i * 13, { s: 110, u: 1, t, red: isRed }); g.restore(); lab(g, m.label || "", lx, ly + 74, { maxW: 260, size: F.small, color: isRed ? P.redInk : P.ink2, alpha: al }); } });
      },
    };
  },
};
