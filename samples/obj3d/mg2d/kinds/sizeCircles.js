// kind: sizeCircles (family: comparison) - proportional circles (AREA = value) standing on one ground line, a generated object inside each, labels + value numerals under them, a size key
// (dashed diameter + area note) and a red "x N" ratio bracket between the biggest and the smallest.
// data: { items: [{ label: "Sweden", value: 10.4, object: "tree" }, ...] (2..8; value > 0), unit: "million people", cap: "...", redIndex: (default largest), note: "(optional)" }
// focus ids: "circles" (all), "ratio" (red vs the smallest, with the multiple)
import * as H from "./_h_numcmp.js";
export default {
  name: "sizeCircles", family: "comparison",
  doc: "Area-proportional circles on a ground line with an object inside each, labels, values and a ratio bracket (red vs smallest).",
  example: [{ items: [{ label: "Tokyo", value: 37, object: "building" }, { label: "Lagos", value: 15, object: "truck" }, { label: "Paris", value: 11, object: "lighthouse" }, { label: "Oslo", value: 1.1, object: "tree" }], unit: "million people", cap: "City populations", redIndex: 0, note: "34 Oslos fit in Tokyo" },
            { items: [{ label: "Oil", value: 4000, object: "barrel" }, { label: "Coal", value: 8400, object: "rock" }, { label: "Wind", value: 2100, object: "tree" }], unit: "TWh", cap: "Output by fuel" }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { lab, sit, measure, line, flag, fmt, dash, ground, groundTicks, hashSeed, ell, tw } = H;
    const I = d.items.slice(0, 8), n = I.length, maxV = Math.max(...I.map(i => i.value)), minV = Math.min(...I.map(i => i.value)), red = d.redIndex ?? I.findIndex(i => i.value === maxV), gap = 46;
    const rr = I.map(i => Math.sqrt(i.value / maxV)), kk = Math.min(330, (1380 - gap * (n - 1)) / (2 * rr.reduce((a, b) => a + b, 0))), R = rr.map(r => r * kk), w = Math.max(1560, 2 * R.reduce((a, b) => a + b, 0) + gap * (n - 1) + 320);
    const h = 900, gy = 640, tot = 2 * R.reduce((a, b) => a + b, 0) + gap * (n - 1), xs = []; { let x = (w - tot) / 2; for (let i = 0; i < n; i++) { xs.push(x + R[i]); x += 2 * R[i] + gap; } }
    const smallest = I.reduce((b, it, i) => it.value < I[b].value ? i : b, 0), ms = I.map(it => measure(it.object, 4));
    return {
      w, h, focus: [{ id: "circles", x: 30, y: 90, w: w - 60, h: h - 110 }, { id: "ratio", x: clamp((xs[red] + xs[smallest]) / 2 - 600, 20, w - 1220), y: 90, w: 1200, h: h - 110 }],
      draw(g, t, at) {
        const t0 = at.circles ?? 0, t1 = at.ratio ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        const au = seg(t, t0 - 0.2, t0 + 0.8); ground(g, 70, w - 70, gy, au); groundTicks(g, 70, w - 70, gy, au);
        // size key: dashed reference diameter for the biggest + "area = value" caption (bottom)
        for (let i = 0; i < n; i++) { const ts = t0 + 0.2 + i * Math.min(0.35, 1.6 / n), u = seg(t, ts, ts + 0.7), R_ = i === red, r = R[i]; if (u <= 0) continue;
          ui.pop(g, u, xs[i], gy - r, () => { ell(g, 0, r + 4, r * 0.8, Math.max(6, r * 0.06), 0.8); g.beginPath(); g.arc(0, 0, r, 0, 7); ui.shadow(g, () => { g.beginPath(); g.arc(0, 0, r, 0, 7); }, 4, 8, 0.8); g.beginPath(); g.arc(0, 0, r, 0, 7);
            g.fillStyle = R_ ? "rgba(232,103,94,.28)" : i % 2 ? P.water : P.sand; g.fill(); g.save(); g.clip(); g.strokeStyle = R_ ? "rgba(142,26,19,.25)" : "rgba(43,42,39,.12)"; g.lineWidth = 2; for (let x = -r * 2; x < r * 2; x += 14) { g.beginPath(); g.moveTo(x, r); g.lineTo(x + r, -r); g.stroke(); } g.restore();
            g.beginPath(); g.arc(0, 0, r, 0, 7); ui.ink(g, R_ ? 5 : 3.5, R_ ? P.red : P.ink2); g.beginPath(); g.arc(0, 0, r - 12, 0, 7); ui.ink(g, 1.5, R_ ? "rgba(200,38,29,.4)" : P.hair);
            const s = Math.min(1.25 * r, 330) / (Math.max(ms[i].w, ms[i].h) / 100); g.save(); g.translate(0, ms[i].h * s / 200 * 0 + 0); sit(g, hashSeed(K.seed, 50 + i), I[i].object, s * 0.85, 0, ms[i].h * s * 0.85 / 200, { t, red: R_ }); g.restore(); }, "settle");
          const lu = seg(t, ts + 0.4, ts + 0.9); lab(g, I[i].label, xs[i], gy + 54, { maxW: Math.max(2 * r, 210), color: R_ ? P.redInk : P.ink2, weight: R_ ? 800 : 600, alpha: lu }); if (lu > 0) ui.num(g, fmt(I[i].value), xs[i], gy + 112, { size: F.num * 0.8, color: R_ ? P.red : P.ink, alpha: lu });
        }
        if (d.unit) ui.caption(g, d.unit + "  -  area shows the value", w / 2, gy + 190, { size: F.small, color: P.mid, alpha: au });
        // ratio bracket: dashed diameter lines across the red and smallest circles, flag in between
        const ra = seg(t, t1 - 0.1, t1 + 0.9); if (ra > 0 && smallest !== red) { const rs = R[smallest], rb = R[red], q = I[red].value / I[smallest].value, yT = gy - 2 * rb - 36;
          dash(g, xs[red] - rb, gy - rb, xs[red] + rb, gy - rb, ease.io(ra), P.red, 3, [10, 8]); line(g, xs[red], gy - rb - 12, xs[red], gy - rb + 12, 3, P.red);
          dash(g, xs[red], yT, xs[smallest], yT, ease.io(seg(ra, 0.2, 0.9)), P.red, 3, [4, 9]); line(g, xs[red], yT - 14, xs[red], yT + 14, 3, P.red); if (ra > 0.8) line(g, xs[smallest], yT - 14, xs[smallest], yT + 14, 3, P.red);
          dash(g, xs[smallest], yT, xs[smallest], gy - 2 * rs - 8, ease.io(seg(ra, 0.5, 1)), P.red, 2, [4, 8]);
          if (ra > 0.55) ui.pop(g, seg(ra, 0.55, 1), (xs[red] + xs[smallest]) / 2, yT - 4, () => flag(g, "x " + fmt(q, q < 10 ? 1 : 0), 0, 0, { red: true, size: F.cap }));
          if (d.note && ra > 0.8) ui.pop(g, seg(ra, 0.8, 1), clamp((xs[red] + xs[smallest]) / 2, tw(d.note, F.small, 800, false) / 2 + 60, w - tw(d.note, F.small, 800, false) / 2 - 60), yT - 72, () => flag(g, d.note, 0, 0)); }
      },
    };
  },
};
