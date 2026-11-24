// kind: receipt (family: documents) - an itemised cost receipt printing out of a printer slot: item lines print one by one (name, dotted leader, amount) with a running total ticking up,
// zigzag tear edge, barcode, and a side column of proportion bars (annotation) tying every line to its share of the total. The total line is the red one.
// data: { items:[{ n:"Extra fuel", v:410000, qty?:"12 days" }], currency:"$", head:"Cost of the detour", total?:"TOTAL", cap }
// focus ids: "items" (the lines print with their share bars), "total" (the total line underlines in red, barcode prints)
import { P, F, ease, seg, clamp, lerp, ui, rng, icon, sd, fit, chip, circ, fmt, measure } from "./_srd.js";
import { barcode } from "./_srd3.js";
export default {
  name: "receipt", family: "documents",
  doc: "Itemised cost receipt printing from a slot with running total, share bars and a red total line.",
  example: [
    { head: "Cost of the detour", currency: "$", cap: "What going around the Cape costs", items: [{ n: "Extra fuel", v: 410000, qty: "+3,500 nm" }, { n: "Crew + days", v: 96000, qty: "10 days" }, { n: "Insurance", v: 45000 }, { n: "Late penalty", v: 120000 }, { n: "Cargo spoilage", v: 38000 }] },
    { head: "One chip, one price", currency: "$", items: [{ n: "Silicon", v: 4 }, { n: "Design licence", v: 11 }, { n: "Fab time", v: 23 }, { n: "Packaging", v: 6 }, { n: "Freight", v: 3 }, { n: "Margin", v: 18 }], cap: "Where the money goes" },
  ],
  build(d, K) {
    const r = K.rng, I = d.items, n = I.length, RW = 560, RH0 = 220, ROW = 84, RHt = RH0 + n * ROW + 250, w = 1560, h = RHt + 200, rx = 140, ry = 150, total = I.reduce((a, b) => a + b.v, 0), cur = d.currency ?? "$", seed = sd(r), vmax = Math.max(...I.map(q => q.v));
    const colX = rx + RW + 110, barW = 560;
    return {
      w, h, focus: [{ id: "items", x: rx - 140, y: 0, w: 1360, h: Math.min(h, 880) }, { id: "total", x: rx - 140, y: Math.max(0, h - 820), w: 1360, h: 780 }],
      draw(g, t, at) {
        const t0 = at.items ?? 0, t1 = at.total ?? t0 + 2.6, ST = 0.5; ui.card(g, 0, 0, w, h, { r: 18, rule: false });
        // printer body (slot + status light) - the paper comes out of the slot
        g.save(); ui.shadow(g, () => ui.rr(g, rx - 50, 40, RW + 100, 110, 22), 5, 12); ui.rr(g, rx - 50, 40, RW + 100, 110, 22); ui.fill(g, P.stone); ui.ink(g, 4); ui.rr(g, rx - 12, 108, RW + 24, 20, 8); ui.fill(g, P.ink); circ(g, rx + RW + 18, 76, 9, t < t1 + 1.8 ? P.mid : P.hair, 2); ui.caption(g, "", rx, 76, {}); g.restore();
        const printed = clamp((t - (t0 - 0.2)) / ST, 0, n + 1.2), tp = clamp((t - (t1 - 0.2)) / 1.4, 0, 1), len = RH0 - 40 + Math.min(printed, n) * ROW + (printed > n ? 250 * ease.out(tp) * 0 + Math.min(1, (printed - n)) * 40 : 0) + (tp > 0 ? 210 * ease.out(tp) : 0);
        // the paper: clipped to the printed length below the slot; slight jitter while printing
        const jit = t < t1 + 1.6 ? Math.sin(t * 60) * 0.6 : 0; g.save(); g.translate(rx + jit, ry); g.beginPath(); g.rect(-20, 0, RW + 40, len + 30); g.clip();
        ui.shadow(g, () => { g.beginPath(); g.rect(0, 0, RW, len); }, 6, 12); g.beginPath(); g.rect(0, 0, RW, len); ui.fill(g, "#fdfbf6"); ui.ink(g, 2.5, "rgba(43,42,39,.4)");
        // header
        ui.caption(g, d.head ?? "Receipt", RW / 2, 54, { size: F.cap, color: P.ink, weight: 800 }); g.beginPath(); g.setLineDash([8, 8]); g.moveTo(30, 104); g.lineTo(RW - 30, 104); ui.ink(g, 2, P.mid); g.setLineDash([]);
        let run = 0; I.forEach((q, i) => { const ti = t0 - 0.2 + i * ST, u = ease.out(seg(t, ti, ti + 0.4)); if (u <= 0) return; run += q.v; const y = RH0 - 70 + i * ROW; g.save(); g.globalAlpha *= u; g.translate(0, (1 - u) * -16);
          fit(g, q.n, 30, y, 250, { size: F.small, align: "left", color: P.ink, weight: 600, caps: false, spacing: 0 }); if (q.qty) ui.caption(g, q.qty, 30, y + 30, { size: 22, align: "left", color: P.mid, caps: false, spacing: 0, weight: 500 });
          const s = cur + fmt(q.v); g.beginPath(); g.setLineDash([2, 8]); g.moveTo(300, y + 8); g.lineTo(RW - 40 - measure(s, F.small, 700) - 12, y + 8); ui.ink(g, 2, P.mid); g.setLineDash([]); ui.caption(g, s, RW - 30, y, { size: F.small, align: "right", color: P.ink, weight: 700, caps: false, spacing: 0 }); g.restore(); });
        // running total + final total
        const sofar = I.reduce((a, q, i) => a + (t > t0 - 0.2 + i * ST + 0.3 ? q.v : 0), 0), ty = RH0 - 70 + n * ROW + 18; g.beginPath(); g.moveTo(30, ty - 28); g.lineTo(RW - 30, ty - 28); ui.ink(g, 4, P.ink);
        ui.caption(g, d.total ?? "Total", 30, ty + 26, { size: F.cap, align: "left", color: P.ink, weight: 800 }); ui.num(g, cur + fmt(sofar), RW - 30, ty + 30, { size: 60, align: "right", color: tp > 0 ? P.red : P.ink });
        const du = ease.io(seg(t, t1, t1 + 0.7)); if (du > 0) for (const dy of [62, 72]) { g.beginPath(); g.moveTo(RW - 30, ty + dy); g.lineTo(RW - 30 - 400 * du, ty + dy); ui.ink(g, dy === 62 ? 5 : 3, P.red); }
        barcode(g, 70, ty + 110, RW - 140, 70, seed, seg(t, t1 + 0.4, t1 + 1.6)); g.restore();
        // torn zigzag end of the paper
        g.save(); g.translate(rx, ry + len); g.beginPath(); g.moveTo(0, -1); for (let x = 0; x <= RW; x += 20) { g.lineTo(x, (x / 20) % 2 ? 14 : 0); } g.lineTo(RW, -1); g.closePath(); ui.fill(g, "#fdfbf6"); g.restore();
        // proportion bars aligned to each printed row (annotation layer) + coin stack that grows with the total
        I.forEach((q, i) => { const ti = t0 + 0.1 + i * ST, u = ease.out(seg(t, ti, ti + 0.7)); if (u <= 0) return; const y = ry + RH0 - 70 + i * ROW + 8, bw = (q.v / vmax) * (barW - 130) * u, big = q.v === vmax; g.save(); g.beginPath(); g.moveTo(rx + RW + 20, y); g.lineTo(colX - 10, y); g.setLineDash([3, 7]); ui.ink(g, 1.6, P.hair); g.setLineDash([]); ui.rr(g, colX, y - 22, Math.max(4, bw), 44, 8); ui.fill(g, big && t > t1 ? P.ink2 : "#b8b2a4"); ui.ink(g, 2.5, P.ink);
          ui.caption(g, Math.round(q.v / total * 100) + "%", colX + Math.max(4, bw) + 16, y, { size: F.small, align: "left", color: P.ink2, caps: false, spacing: 0, weight: 700 }); g.restore(); });
        icon(g, "coinStack", colX + 240, ry + 40, 240, { seed, t, red: false }); if (d.cap) ui.caption(g, d.cap, colX + 240, h - 50, { size: F.cap, color: P.ink2, weight: 700 });
      },
    };
  },
};
