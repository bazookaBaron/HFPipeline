// kind: groupedBars (family: numbers) - clustered bars: 2-3 series per category, value axis + grid, legend, value flags, and a gap bracket between the red series and a
// reference series in the last category.
// data: { categories: ["2019","2020",..], series: [{ name, values: [..] }, ...], unit: "TWh", cap: "...", note: "gap widens" (optional), redSeries: (index, default last) }
// focus ids: "bars" (chart), "gap" (bracket between red bar and reference bar in the last category)
import * as H from "./_h_numcmp.js";
export default {
  name: "groupedBars", family: "numbers",
  doc: "Clustered bars (2-3 series per category) with axis, legend, value flags and a gap bracket on the last category.",
  example: [{ categories: ["2019", "2020", "2021", "2022", "2023"], series: [{ name: "Europe", values: [61, 58, 63, 66, 64] }, { name: "North America", values: [72, 69, 77, 83, 88] }, { name: "Asia", values: [48, 55, 73, 98, 131] }], unit: "GW installed", cap: "Solar added each year", note: "Asia passes both", redSeries: 2 },
            { categories: ["Under 30", "30-50", "Over 50"], series: [{ name: "Employed", values: [64, 82, 71] }, { name: "Remote", values: [18, 34, 12] }], unit: "% of workers", cap: "Working pattern by age", redSeries: 1 }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { nice, fmt, lab, axisY, ground, groundTicks, key, flag, line, ell } = H;
    const cats = d.categories, nc = cats.length, ser = d.series.slice(0, 3), ns = ser.length, red = d.redSeries ?? ns - 1, maxV = Math.max(...ser.flatMap(s => s.values)), ax = nice(maxV, 4);
    const w = Math.max(1500, 300 + nc * ns * 120), h = 880, px = 190, pw = w - px - 90, py = 220, ph = 500, yb = py + ph, gw = pw / nc, bw = clamp(gw * 0.84 / ns, 34, 110), cols = [P.ink2, P.mid, P.stone2];
    const nonRed = ser.map((s, i) => i).filter(i => i !== red), colOf = s => s === red ? P.red : cols[nonRed.indexOf(s) % 3];
    const gc = c => gw * (c + 0.5), X = (c, s) => px + gc(c) + (s - (ns - 1) / 2) * bw * 1.04, Y = v => yb - v / ax.top * ph;
    const lc = nc - 1, refS = nonRed.slice().sort((a, b) => ser[b].values[lc] - ser[a].values[lc])[0] ?? 0;
    return {
      w, h, focus: [{ id: "bars", x: 20, y: 100, w: w - 40, h: h - 120 }, { id: "gap", x: clamp(X(lc, red) - 480, 20, w - 960), y: 160, w: 940, h: 640 }],
      draw(g, t, at) {
        const t0 = at.bars ?? 0, t1 = at.gap ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        const au = seg(t, t0 - 0.2, t0 + 0.7); axisY(g, px, px + pw, yb, ph, ax.top, ax.step, au); ground(g, px - 10, px + pw + 10, yb, au); H.groundTicks(g, px, px + pw, yb, au);
        if (d.unit) ui.caption(g, d.unit, px - 16, py - 70, { size: F.small, align: "left", color: P.mid, alpha: au });
        let lx = w - 80 - ser.reduce((a, s) => a + H.tw(s.name, F.small, 600) + 70, 0); ser.forEach((s, i) => { const lu = seg(t, t0 + 0.2 + i * 0.15, t0 + 0.6 + i * 0.15); lx += key(g, lx, py - 70, s.name, colOf(i), { a: lu }) + 14; });
        const total = nc * ns, step = Math.min(0.12, 1.5 / total);
        for (let c = 0; c < nc; c++) {
          for (let s = 0; s < ns; s++) {
            const ts = t0 + 0.15 + (c * ns + s) * step, u = seg(t, ts, ts + 0.55), v = ser[s].values[c], bh = (yb - Y(v)) * ease.back(u), R = s === red; if (u <= 0) continue;
            const x0 = X(c, s) - bw / 2; ell(g, X(c, s), yb + 3, bw * 0.6, 7, u * 0.7);
            g.save(); ui.shadow(g, () => ui.rr(g, x0, yb - bh, bw, bh, 6), 5, 8, 0.7); ui.rr(g, x0, yb - bh, bw, bh, 6); ui.fill(g, colOf(s)); g.save(); ui.rr(g, x0, yb - bh, bw, bh, 6); g.clip(); g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(x0, yb - bh, bw * 0.22, bh); g.fillStyle = "rgba(43,42,39,.14)"; g.fillRect(x0 + bw * 0.78, yb - bh, bw * 0.22, bh);
            if (nonRed.indexOf(s) === 2) ui.hatch(g, x0, yb - bh, bw, bh, 12, "rgba(43,42,39,.28)"); g.restore(); ui.rr(g, x0, yb - bh, bw, bh, 6); ui.ink(g, 3, R ? P.redInk : P.ink); g.restore();
            if (u > 0.7 && (R || nc * ns <= 12)) ui.num(g, fmt(v), X(c, s), yb - bh - 30, { size: F.small, color: R ? P.redInk : P.ink2, alpha: seg(u, 0.7, 1), weight: 800 });
          }
          lab(g, cats[c], gc(c) + px, yb + 60, { maxW: gw * 0.95, color: P.ink2, alpha: seg(t, t0 + 0.15 + c * ns * step, t0 + 0.6 + c * ns * step) });
        }
        const gu = seg(t, t1 - 0.1, t1 + 0.9), xr = X(lc, red), xf = X(lc, refS), ya = Y(ser[red].values[lc]), yr = Y(ser[refS].values[lc]), sd = xr > xf ? 1 : -1, dx = xr + sd * bw * 0.9;
        if (gu > 0) { H.dash(g, xf, yr, dx, yr, ease.io(seg(gu, 0, 0.5)), P.red, 2.5, [10, 7]);
          const k = ease.io(seg(gu, 0.3, 1)); g.beginPath(); g.moveTo(dx, yr); g.lineTo(dx, lerp(yr, ya, k)); ui.ink(g, 3, P.red); line(g, dx - 10, yr, dx + 10, yr, 3, P.red); if (k > 0.95) line(g, dx - 10, ya, dx + 10, ya, 3, P.red);
          const dv = ser[red].values[lc] - ser[refS].values[lc]; if (gu > 0.6) ui.pop(g, seg(gu, 0.6, 1), dx + sd * 90, (ya + yr) / 2, () => flag(g, (dv > 0 ? "+" : "") + fmt(dv), 0, 0, { red: true })); }
        if (d.note) { const lu = seg(t, t1 + 0.5, t1 + 1.3), nw = H.tw(d.note, F.small, 800, false) + 30, tx = clamp(dx - 160, nw / 2 + 40, w - nw / 2 - 40), ty = Math.max(150, ya - 130); ui.leader(g, dx, ya - 4, tx + nw / 2 * (dx > tx ? 1 : -1), ty, lu, P.ink); if (lu > 0.85) flag(g, d.note, tx, ty, { size: F.small }); }
      },
    };
  },
};
