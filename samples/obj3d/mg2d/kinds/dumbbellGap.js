// kind: dumbbellGap (family: comparison) - the gap between two values per row on one shared scale: a filled dot (A), a hollow dot (B) and a thick bar between them with the gap value,
// rows sorted as given; the row with the biggest gap is red with a bracket + note.
// data: { rows: [{ label: "Women", a: 82, b: 100 }, ...] (2..10), aLabel: "Actual", bLabel: "Target", unit: "%", cap: "...", redRow: (default = largest gap), note: "(optional)" }
// focus ids: "rows" (all dumbbells), "gap" (the largest gap, bracketed)
import * as H from "./_h_numcmp.js";
export default {
  name: "dumbbellGap", family: "comparison",
  doc: "Per-row dumbbells (dot A, bar, hollow dot B) on a shared scale with gap numerals; the biggest gap row is red and bracketed.",
  example: [{ rows: [{ label: "Nordics", a: 91, b: 100 }, { label: "Germany", a: 83, b: 100 }, { label: "UK", a: 74, b: 100 }, { label: "Poland", a: 58, b: 100 }, { label: "Greece", a: 41, b: 100 }], aLabel: "Today", bLabel: "Target", unit: "%", cap: "Charging coverage vs. target", redRow: 4, note: "less than half there" },
            { rows: [{ label: "Engineers", a: 118, b: 131 }, { label: "Nurses", a: 64, b: 71 }, { label: "Teachers", a: 52, b: 54 }], aLabel: "Men", bLabel: "Women", unit: "k$", cap: "Pay gap by job" }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { lab, line, flag, fmt, nice, dash, ground, tw } = H;
    const R = d.rows.slice(0, 10), n = R.length, gaps = R.map(r => Math.abs(r.b - r.a)), red = d.redRow ?? gaps.indexOf(Math.max(...gaps)), all = R.flatMap(r => [r.a, r.b]), lo = Math.min(0, Math.min(...all)), hi = Math.max(...all), ax = nice(hi - lo, 5);
    const w = 1700, rh = clamp(600 / n, 64, 96), py = 250, h = py + n * rh + 190, px = 470, pw = w - px - 330, top = Math.ceil(hi / ax.step - 1e-9) * ax.step, X = v => px + (v - lo) / (top - lo) * pw, yb = py + n * rh + 20;
    const ticks = []; for (let v = Math.ceil(lo / ax.step - 1e-9) * ax.step; v <= top + 1e-9; v += ax.step) ticks.push(+v.toFixed(6));
    return {
      w, h, focus: [{ id: "rows", x: 30, y: 90, w: w - 60, h: h - 110 }, { id: "gap", x: clamp(X((R[red].a + R[red].b) / 2) - 560, 20, w - 1140), y: Math.max(70, py + red * rh - 260), w: 1120, h: 620 }],
      draw(g, t, at) {
        const t0 = at.rows ?? 0, t1 = at.gap ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        const au = seg(t, t0 - 0.2, t0 + 0.8); line(g, px, yb, lerp(px, px + pw, ease.io(au)), yb, 3, P.ink2);
        ticks.forEach((v, i) => { const uu = seg(au, i / (ticks.length + 1), 1); if (uu <= 0) return; g.save(); g.globalAlpha = uu; dash(g, X(v), py - 10, X(v), yb, 1, "rgba(120,108,85,.3)", 1.5, [3, 9]); line(g, X(v), yb, X(v), yb + 14, 3, P.ink2); ui.caption(g, fmt(v) + (d.unit && d.unit.length < 3 && i === ticks.length - 1 ? d.unit : ""), X(v), yb + 52, { size: F.small, caps: false, spacing: 0, color: P.mid }); g.restore(); });
        // legend: A dot, B hollow dot
        const lu = seg(t, t0 + 0.2, t0 + 0.8); g.save(); g.globalAlpha = lu; g.beginPath(); g.arc(px, 160, 13, 0, 7); ui.fill(g, P.ink); ui.caption(g, d.aLabel ?? "A", px + 28, 160, { size: F.small, align: "left", color: P.ink2 }); const ax2 = px + 60 + tw(d.aLabel ?? "A", F.small, 600) + 60; g.beginPath(); g.arc(ax2, 160, 13, 0, 7); ui.fill(g, P.paper); ui.ink(g, 5, P.ink); ui.caption(g, d.bLabel ?? "B", ax2 + 28, 160, { size: F.small, align: "left", color: P.ink2 }); g.restore();
        R.forEach((r, i) => { const Rd = i === red, ts = t0 + 0.3 + i * Math.min(0.4, 1.7 / n), u = seg(t, ts, ts + 0.8), y = py + i * rh + rh / 2; if (u <= 0) return;
          dash(g, 100, y + rh / 2, w - 100, y + rh / 2, 1, "rgba(120,108,85,.22)", 1.5, [2, 8]); lab(g, r.label, 100, y, { maxW: 340, align: "left", color: Rd ? P.redInk : P.ink2, weight: Rd ? 800 : 600, alpha: Math.min(1, u * 3) });
          const xA = X(r.a), xB = lerp(X(r.a), X(r.b), ease.out(seg(u, 0.25, 0.85)));
          ui.pop(g, seg(u, 0, 0.3), xA, y, () => { g.beginPath(); g.arc(0, 0, 18, 0, 7); ui.fill(g, Rd ? P.red : P.ink); ui.ink(g, 4, Rd ? P.redInk : P.ink); });
          g.beginPath(); g.moveTo(xA, y); g.lineTo(xB, y); ui.ink(g, 14, Rd ? P.redInk : P.ink2); g.beginPath(); g.moveTo(xA, y); g.lineTo(xB, y); ui.ink(g, 8, Rd ? P.red : P.stone2);
          if (u > 0.85) ui.pop(g, seg(u, 0.85, 1), X(r.b), y, () => { g.beginPath(); g.arc(0, 0, 18, 0, 7); ui.fill(g, P.paper); ui.ink(g, 6, Rd ? P.red : P.ink); });
          if (u > 0.9) ui.num(g, (r.b - r.a > 0 ? "+" : "") + fmt(r.b - r.a), Math.max(X(r.a), X(r.b)) + 46, y, { size: F.small * 1.15, align: "left", color: Rd ? P.red : P.ink, alpha: seg(u, 0.9, 1) }); });
        // bracket on the red row's gap + note
        const gu = seg(t, t1 - 0.1, t1 + 0.9), yr = py + red * rh + rh / 2; if (gu > 0) { const x0 = X(R[red].a), x1 = X(R[red].b), yt = yr - 56; line(g, x0, yt, lerp(x0, x1, ease.io(gu)), yt, 4, P.red); line(g, x0, yt - 12, x0, yt + 12, 4, P.red); if (gu > 0.95) line(g, x1, yt - 12, x1, yt + 12, 4, P.red);
          if (gu > 0.5) ui.pop(g, seg(gu, 0.5, 1), (x0 + x1) / 2, yt - 44, () => flag(g, "gap " + fmt(Math.abs(R[red].b - R[red].a)) + (d.unit && d.unit.length < 3 ? d.unit : ""), 0, 0, { red: true }));
          if (d.note) { const nu = seg(t, t1 + 0.6, t1 + 1.3); if (nu > 0) ui.pop(g, nu, clamp((x0 + x1) / 2, tw(d.note, F.small, 800, false) / 2 + 60, w - tw(d.note, F.small, 800, false) / 2 - 60), yr + 74, () => flag(g, d.note, 0, 0)); } }
      },
    };
  },
};
