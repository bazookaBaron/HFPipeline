// kind: rankingSwap (family: comparison) - ranked rows (rank badge, label, bar, object at the bar head, value) that slide past each other to a new order when the second state is narrated,
// bars growing/shrinking and values counting; the red row keeps its colour so the eye follows it across the swap.
// data: { rows: [{ label, v1, v2, object? }, ...] (2..10), phases: ["2015", "2024"], unit: "million", object: "container" (default), cap: "...", redRow: (index; default the biggest climber), note: "(optional)" }
// focus ids: "before" (first ranking lands), "after" (rows swap to the second ranking)
import * as H from "./_h_numcmp.js";
export default {
  name: "rankingSwap", family: "comparison",
  doc: "Ranked rows with rank badges that slide to a new order (bars + counting values) between two phases; the red row is the one to follow.",
  example: [{ rows: [{ label: "Shanghai", v1: 36, v2: 49 }, { label: "Singapore", v1: 31, v2: 39 }, { label: "Shenzhen", v1: 24, v2: 30 }, { label: "Ningbo", v1: 20, v2: 35 }, { label: "Hong Kong", v1: 22, v2: 14 }, { label: "Busan", v1: 19, v2: 23 }], phases: ["2015", "2024"], unit: "million boxes", object: "container", cap: "Busiest container ports", redRow: 3, note: "Ningbo jumps three places" },
            { rows: [{ label: "Coal", v1: 40, v2: 22 }, { label: "Gas", v1: 22, v2: 25 }, { label: "Nuclear", v1: 18, v2: 14 }, { label: "Wind", v1: 5, v2: 21 }, { label: "Solar", v1: 3, v2: 18 }], phases: ["2005", "2025"], unit: "% of power", object: "power", cap: "Power mix", redRow: 3 }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { lab, sit, measure, line, flag, fmt, ell, hashSeed, ground, tw } = H;
    const R = d.rows.slice(0, 10), n = R.length, rh = clamp(640 / n, 66, 96), w = 1700, top = 200, h = top + n * rh + 160, x0 = 440, bw = 880, maxV = Math.max(...R.flatMap(r => [r.v1, r.v2]));
    const rank = key => R.map((r, i) => i).sort((a, b) => R[b][key] - R[a][key]), r1 = rank("v1"), r2 = rank("v2"), pos1 = [], pos2 = []; r1.forEach((i, k) => pos1[i] = k); r2.forEach((i, k) => pos2[i] = k);
    const red = d.redRow ?? R.map((r, i) => i).sort((a, b) => (pos1[b] - pos2[b]) - (pos1[a] - pos2[a]))[0], whats = R.map(r => r.object ?? d.object ?? "container"), ms = whats.map(x => measure(x, 4));
    const ph = d.phases ?? ["before", "after"];
    return {
      w, h, focus: [{ id: "before", x: 30, y: 70, w: w - 60, h: h - 90 }, { id: "after", x: 30, y: 70, w: w - 60, h: h - 90 }],
      draw(g, t, at) {
        const t0 = at.before ?? 0, t1 = at.after ?? t0 + 2.6, sw = ease.io5(seg(t, t1 - 0.1, t1 + 1.5));
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 52, { size: F.small, color: P.mid });
        // phase tags (top right): the active one is inked, the other faded; arrow between
        const pa = seg(t, t0, t0 + 0.5); g.save(); g.globalAlpha = pa; ui.tag(g, ph[0], w - 420, 130, { color: sw < 0.5 ? P.ink : P.mid }); line(g, w - 345, 130, w - 285, 130, 3, P.ink2); g.beginPath(); g.moveTo(w - 285, 130); g.lineTo(w - 300, 120); g.lineTo(w - 300, 140); g.closePath(); ui.fill(g, P.ink2); ui.tag(g, ph[1], w - 200, 130, { color: sw >= 0.5 ? P.redInk : P.mid }); g.restore();
        // column heads
        ui.caption(g, d.unit ?? "", x0, top - 40, { size: F.small, align: "left", color: P.mid, alpha: pa });
        // rows (stripes first, then rows ordered so the red row paints last)
        const order = R.map((r, i) => i).sort((a, b) => (a === red) - (b === red));
        for (let k = 0; k < n; k++) { const su = seg(t, t0 - 0.1 + k * 0.04, t0 + 0.4 + k * 0.04); if (su > 0) { g.save(); g.globalAlpha = su; ui.rr(g, 60, top + k * rh + 5, w - 120, rh - 10, 12); ui.fill(g, k % 2 ? "rgba(233,228,216,.35)" : "rgba(233,228,216,.7)"); g.restore(); } }
        for (const i of order) { const ts = t0 + 0.2 + pos1[i] * Math.min(0.3, 1.4 / n), gu = seg(t, ts, ts + 0.7), Rd = i === red; if (gu <= 0) continue;
          const row = lerp(pos1[i], pos2[i], sw), y = top + row * rh + rh / 2, dir = Math.sign(pos2[i] - pos1[i]), xo = Math.sin(Math.PI * sw) * -dir * 26 * (Rd ? 1.4 : 1), v = lerp(R[i].v1, R[i].v2, sw), L = v / maxV * bw * ease.back(gu), bh = rh * 0.52;
          g.save(); g.translate(xo, 0); g.globalAlpha = Math.min(1, gu * 3);
          // rank badge: number follows the live row
          const rk = Math.round(row) + 1; g.beginPath(); g.arc(120, y, rh * 0.36, 0, 7); ui.fill(g, Rd ? P.red : P.paper); ui.ink(g, 3, Rd ? P.redInk : P.ink2); ui.num(g, String(rk), 120, y + 2, { size: F.small * 1.1, color: Rd ? P.paper : P.ink });
          lab(g, R[i].label, 180, y, { maxW: 240, align: "left", color: Rd ? P.redInk : P.ink2, weight: Rd ? 800 : 600 });
          // bar with end cap + highlight; object at the head
          ui.shadow(g, () => ui.rr(g, x0, y - bh / 2, Math.max(8, L), bh, bh / 2), 3, 6, 0.8); ui.rr(g, x0, y - bh / 2, Math.max(8, L), bh, bh / 2); ui.fill(g, Rd ? P.red : i % 2 ? P.mid : P.ink2); ui.ink(g, 3, Rd ? P.redInk : P.ink);
          g.save(); ui.rr(g, x0, y - bh / 2, Math.max(8, L), bh, bh / 2); g.clip(); g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(x0, y - bh / 2, L, bh * 0.3); g.restore();
          const os = Math.min(rh * 0.9, 130) / (Math.max(ms[i].w, ms[i].h) / 100), ow = ms[i].w * os / 100; if (gu > 0.5) sit(g, hashSeed(K.seed, 60 + i), whats[i], os, x0 + L + ow / 2 + 14, y + rh * 0.38, { red: Rd, t });
          ui.num(g, fmt(v, v % 1 && v < 100 ? 1 : 0), x0 + L + ow + 40, y, { size: F.num * 0.62, align: "left", color: Rd ? P.red : P.ink, alpha: seg(gu, 0.5, 1) });
          g.restore(); }
        if (d.note) { const nu = seg(t, t1 + 1.3, t1 + 2.0); if (nu > 0) ui.pop(g, nu, w - 420, h - 70, () => flag(g, d.note, 0, 0, { red: true })); }
      },
    };
  },
};
