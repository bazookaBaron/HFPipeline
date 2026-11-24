// kind: areaStream (family: numbers) - stacked areas over time: smooth layered streams revealed by a sweeping edge, grid + axis, layer labels with leaders on the right,
// total tag, and a red layer callout (start -> end).
// data: { labels: ["2000","2005",...], layers: [{ name, values: [..] }, ...], unit: "TWh", cap: "...", redLayer: (index, default last), note: "9x in 25 years" (optional) }
// focus ids: "stack" (chart), "layer" (red layer callout)
import * as H from "./_h_numcmp.js";
export default {
  name: "areaStream", family: "numbers",
  doc: "Stacked smooth areas that sweep in over time, with layer labels, total tag and a red-layer callout.",
  example: [{ labels: ["2000", "2005", "2010", "2015", "2020", "2025"], layers: [{ name: "Coal", values: [40, 42, 40, 36, 28, 20] }, { name: "Gas", values: [18, 22, 24, 26, 27, 26] }, { name: "Nuclear", values: [18, 18, 16, 15, 14, 14] }, { name: "Renewables", values: [4, 7, 12, 22, 36, 55] }], unit: "TWh x100", cap: "Where electricity comes from", redLayer: 3, note: "x14 in 25 years" },
            { labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], layers: [{ name: "Email", values: [30, 34, 31, 29, 26, 8, 6] }, { name: "Calls", values: [12, 14, 15, 14, 12, 3, 2] }, { name: "Chat", values: [8, 12, 16, 22, 30, 36, 40] }], unit: "min per hour", cap: "Time sinks across the week" }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { nice, fmt, axisY, ground, smooth, flag, line, dash } = H;
    const L = d.layers.slice(0, 6), nl = L.length, n = d.labels.length, red = d.redLayer ?? nl - 1, w = 1700, h = 900, px = 190, pw = 1000, py = 230, ph = 470, yb = py + ph;
    const tot = Array.from({ length: n }, (_, i) => L.reduce((a, l) => a + l.values[i], 0)), ax = nice(Math.max(...tot), 4), X = i => px + i / (n - 1) * pw, Y = v => yb - v / ax.top * ph;
    const cum = L.map((l, k) => l.values.map((v, i) => L.slice(0, k + 1).reduce((a, q) => a + q.values[i], 0))), lowc = k => k ? cum[k - 1] : new Array(n).fill(0);
    const tintOf = k => k === red ? P.red : [P.stone2, P.water2, P.sand2, P.stone, P.water, P.sand][k % 6];
    return {
      w, h, focus: [{ id: "stack", x: 20, y: 120, w: w - 40, h: h - 140 }, { id: "layer", x: px - 40, y: 160, w: pw + 80, h: 680 }],
      draw(g, t, at) {
        const t0 = at.stack ?? 0, t1 = at.layer ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        const au = seg(t, t0 - 0.2, t0 + 0.7); axisY(g, px, px + pw, yb, ph, ax.top, ax.step, au); ground(g, px - 10, px + pw + 10, yb, au); if (d.unit) ui.caption(g, d.unit, px - 16, py - 60, { size: F.small, align: "left", color: P.mid, alpha: au });
        for (let i = 0; i < n; i++) { line(g, X(i), yb, X(i), yb + 12, 2, P.ink2); ui.caption(g, d.labels[i], X(i), yb + 50, { size: F.small, caps: false, spacing: 0, color: P.mid, alpha: au }); }
        const u = ease.io5(seg(t, t0 + 0.1, t0 + 2.1)), xe = px + u * pw;
        L.forEach((l, k) => { const up = cum[k].map((v, i) => [X(i), Y(v)]), lo = lowc(k).map((v, i) => [X(i), Y(v)]).reverse(), R = k === red, hot = R && t > t1 - 0.2;
          g.save(); g.beginPath(); g.rect(px - 4, 0, xe - px + 4, h); g.clip(); g.beginPath(); smooth(g, up); g.lineTo(...lo[0]); smooth(g, lo, false); g.closePath(); g.fillStyle = tintOf(k); g.fill();
          g.save(); g.clip(); g.strokeStyle = "rgba(43,42,39,.16)"; g.lineWidth = 2; for (let x = px - 400; x < px + pw + 400; x += 16 + (k % 3) * 3) { g.beginPath(); g.moveTo(x, yb); g.lineTo(x + ph * 0.7, yb - ph); g.stroke(); } g.restore();
          g.beginPath(); smooth(g, up); ui.ink(g, hot ? 6 : 3.5, R ? P.redInk : P.ink); g.restore(); });
        const ys = H.spread(L.map((l, k) => Y((lowc(k)[n - 1] + cum[k][n - 1]) / 2)), 62, py - 20, yb - 10);
        L.forEach((l, k) => { const lu = seg(t, t0 + 1.8 + k * 0.18, t0 + 2.4 + k * 0.18); if (lu <= 0) return; const R = k === red, ex = px + pw + 30, ey = Y((lowc(k)[n - 1] + cum[k][n - 1]) / 2);
          g.globalAlpha = lu; ui.rr(g, ex + 60, ys[k] - 20, 28, 28, 6); ui.fill(g, tintOf(k)); ui.ink(g, 2, R ? P.redInk : P.ink2); line(g, ex - 28, ey, ex + 50, ys[k] - 6, 2, P.mid); ui.caption(g, l.name, ex + 100, ys[k] - 5, { size: F.small, align: "left", color: R ? P.redInk : P.ink2, weight: R ? 800 : 600 }); g.globalAlpha = 1; });
        if (u > 0.98) ui.pop(g, seg(t, t0 + 2.1, t0 + 2.6), X(n - 1) - 10, Y(tot[n - 1]) - 50, () => flag(g, fmt(tot[n - 1]), 0, 0));
        const cu = seg(t, t1 - 0.1, t1 + 1.2); if (cu > 0) { const a = L[red].values[0], b = L[red].values[n - 1], xs = X(0) + 16, xt = X(n - 1) - 16, mid = k => Y((lowc(red)[k] + cum[red][k]) / 2);
          dash(g, xs, mid(0), xt, mid(n - 1), ease.io(cu), P.redInk, 3, [4, 10]); ui.pop(g, seg(cu, 0.2, 0.6), xs + 70, mid(0) - 40, () => flag(g, fmt(a), 0, 0, { size: F.small })); ui.pop(g, seg(cu, 0.6, 1), xt - 70, mid(n - 1) - 40, () => flag(g, fmt(b), 0, 0, { red: true }));
          if (d.note && cu > 0.8) { const nw = H.tw(d.note, F.small, 800, false) + 30, mx = (xs + xt) / 2; ui.leader(g, mx, (mid(0) + mid(n - 1)) / 2 + 4, mx + 80, py - 20, seg(cu, 0.8, 1), P.ink); if (cu > 0.97) flag(g, d.note, mx + 80 + nw / 2 + 20, py - 20); } }
      },
    };
  },
};
