// kind: slopeChart (family: comparison) - two time points (two vertical axes) with one slope line per row; labels + values at both ends (collision-spread), lines draw left to right,
// the red row thickens with a change flag (+x / %) and an optional note.
// data: { rows: [{ label: "Solar", a: 3, b: 18 }, ...] (2..10), labels: ["2010", "2024"], unit: "% of power", cap: "...", redRow: (default = largest absolute change), note: "(optional)" }
// focus ids: "lines" (all slopes), "gap" (the red row with its change flag)
import * as H from "./_h_numcmp.js";
export default {
  name: "slopeChart", family: "comparison",
  doc: "Two-axis slope chart: one line per row from the first to the second time point, spread labels/values at both ends, red row with change flag.",
  example: [{ rows: [{ label: "Coal", a: 40, b: 22 }, { label: "Gas", a: 22, b: 25 }, { label: "Nuclear", a: 18, b: 14 }, { label: "Hydro", a: 12, b: 11 }, { label: "Wind", a: 5, b: 21 }, { label: "Solar", a: 3, b: 18 }], labels: ["2005", "2025"], unit: "% of power", cap: "Share of electricity", redRow: 4, note: "wind overtakes coal" },
            { rows: [{ label: "Rent", a: 28, b: 36 }, { label: "Food", a: 14, b: 16 }, { label: "Transport", a: 12, b: 11 }], labels: ["2015", "2024"], unit: "% of income", cap: "Where pay goes" }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { lab, line, flag, fmt, spread, dash, tw } = H;
    const R = d.rows.slice(0, 10), n = R.length, lbl = d.labels ?? ["before", "after"], all = R.flatMap(r => [r.a, r.b]), lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.08 || 1;
    const red = d.redRow ?? R.map((r, i) => i).sort((a, b) => Math.abs(R[b].b - R[b].a) - Math.abs(R[a].b - R[a].a))[0];
    const w = 1600, h = 900, xa = 600, xb = 1050, py = 220, ph = 560, Y = v => py + ph - (v - (lo - pad)) / (hi - lo + 2 * pad) * ph, gapMin = 48;
    const ya = spread(R.map(r => Y(r.a)), gapMin, py, py + ph), yb = spread(R.map(r => Y(r.b)), gapMin, py, py + ph);
    return {
      w, h, focus: [{ id: "lines", x: 30, y: 90, w: w - 60, h: h - 110 }, { id: "gap", x: 250, y: 130, w: 1100, h: h - 150 }],
      draw(g, t, at) {
        const t0 = at.lines ?? 0, t1 = at.gap ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        // axes + heads
        const au = ease.io(seg(t, t0 - 0.2, t0 + 0.7)); for (const [x, k] of [[xa, 0], [xb, 1]]) { H.line(g, x, py - 30, x, lerp(py - 30, py + ph + 20, au), 3, P.ink2); ui.pop(g, seg(t, t0 - 0.1 + k * 0.2, t0 + 0.5 + k * 0.2), x, py - 76, () => ui.tag(g, lbl[k], 0, 0, { color: k && false ? P.redInk : P.ink })); }
        for (let i = 0; i <= 4; i++) { const y = py + ph - i / 4 * ph; dash(g, xa, y, xb, y, au, "rgba(120,108,85,.25)", 1.5, [3, 9]); }
        if (d.unit) ui.caption(g, d.unit, (xa + xb) / 2, py + ph + 62, { size: F.small, color: P.mid, alpha: au });
        const order = R.map((r, i) => i).sort((a, b) => (a === red) - (b === red));
        for (const i of order) { const Rd = i === red, ts = Rd ? t1 - 0.2 : t0 + 0.2 + i * Math.min(0.28, 1.5 / n), u = seg(t, ts, ts + (Rd ? 0.4 : 0.6)), pop = Rd ? seg(t, t1 - 0.2, t1 + 0.7) : 0; if (u <= 0 && !(Rd && t > t0 + 0.2)) { if (!Rd) continue; }
          const uu = Rd ? Math.max(seg(t, t0 + 0.2 + i * 0.28, t0 + 0.8 + i * 0.28), u) : u, ea = ease.io(uu), x1 = lerp(xa, xb, ea), y1 = lerp(Y(R[i].a), Y(R[i].b), ea), col = Rd && pop > 0 ? P.red : P.ink2;
          g.save(); if (!Rd || pop <= 0) g.globalAlpha = Rd ? 1 : 0.9; g.beginPath(); g.moveTo(xa, Y(R[i].a)); g.lineTo(x1, y1); ui.ink(g, Rd && pop > 0 ? 4 + 4 * ease.out(pop) : 3.5, col); g.restore();
          ui.pop(g, seg(t, ts - 0.1, ts + 0.3), xa, Y(R[i].a), () => { g.beginPath(); g.arc(0, 0, Rd ? 12 : 9, 0, 7); ui.fill(g, Rd && pop > 0 ? P.red : P.paper); ui.ink(g, 4, Rd && pop > 0 ? P.redInk : P.ink); });
          if (uu > 0.95) ui.pop(g, seg(uu, 0.95, 1), xb, Y(R[i].b), () => { g.beginPath(); g.arc(0, 0, Rd ? 12 : 9, 0, 7); ui.fill(g, Rd && pop > 0 ? P.red : P.ink); ui.ink(g, 4, Rd && pop > 0 ? P.redInk : P.ink); });
          const lc = Rd ? P.redInk : P.ink2, la = seg(t, ts - 0.1, ts + 0.4);
          if (la > 0) { if (Math.abs(ya[i] - Y(R[i].a)) > 3) line(g, xa - 12, Y(R[i].a), xa - 36, ya[i], 1.8, P.mid);
            ui.num(g, fmt(R[i].a), xa - 40, ya[i], { size: F.small, align: "right", color: Rd ? P.red : P.ink, alpha: la }); lab(g, R[i].label, xa - 130, ya[i], { maxW: 380, align: "right", color: lc, weight: Rd ? 800 : 600, alpha: la }); }
          if (uu > 0.9) { const lb = seg(uu, 0.9, 1); if (Math.abs(yb[i] - Y(R[i].b)) > 3) line(g, xb + 12, Y(R[i].b), xb + 36, yb[i], 1.8, P.mid); ui.num(g, fmt(R[i].b), xb + 40, yb[i], { size: F.small, align: "left", color: Rd ? P.red : P.ink, alpha: lb }); lab(g, R[i].label, xb + 130, yb[i], { maxW: 380, align: "left", color: lc, weight: Rd ? 800 : 600, alpha: lb }); } }
        // change flag on the red line + note
        const cu = seg(t, t1 + 0.2, t1 + 1.0); if (cu > 0) { const dv = R[red].b - R[red].a, my = (Y(R[red].a) + Y(R[red].b)) / 2; ui.pop(g, cu, (xa + xb) / 2, my - 60, () => flag(g, (dv > 0 ? "+" : "") + fmt(dv) + (d.unit && d.unit.includes("%") ? " pts" : ""), 0, 0, { red: true, size: F.cap }));
          if (d.note) { const nu = seg(t, t1 + 0.7, t1 + 1.4); if (nu > 0) ui.pop(g, nu, (xa + xb) / 2, py + ph + 130 > h - 40 ? h - 60 : py + ph + 125, () => flag(g, d.note, 0, 0)); } }
      },
    };
  },
};
