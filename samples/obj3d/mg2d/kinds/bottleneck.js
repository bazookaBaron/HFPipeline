// kind: bottleneck (family: process) - many items funnel toward a narrow gap, the queue builds, a throughput meter counts what gets through.
// data: { what:"container", count:16 (items in the queue), gap:0.2 (gap width 0..1), rate:1.6 (items/s through the gap), perMin:96 (shown throughput), unit:"ships / day", queueLabel:"waiting", gapLabel:"one lane", cap:"" }
// focus ids: "queue", "gap", "meter"
import { P, F, ease, seg, clamp, lerp, ui, thing, lab, mk } from "./_ptu.js";
export default {
  name: "bottleneck", family: "process",
  doc: "A crowd of generated items funnels into a narrow gap one at a time; the queue shifts forward, a throughput counter ticks.",
  example: [{ what: "containerShip", count: 14, gap: 0.2, rate: 1.6, perMin: 96, unit: "ships / day", queueLabel: "ships waiting", gapLabel: "one lane", cap: "The canal" },
            { what: "truck", count: 22, gap: 0.14, rate: 2.2, perMin: 40, unit: "trucks / hour", queueLabel: "trucks waiting", gapLabel: "1 customs desk", cap: "Border crossing" }],
  build(d, K) {
    const N = clamp(Math.round(d.count ?? 14), 4, 26), w = 1700, h = 900, my = 420, gx = 820, gh = clamp((d.gap ?? 0.2) * 260, 36, 140), cell = 84, period = 1 / clamp(d.rate ?? 1.6, 0.5, 4), hx = x => lerp(gh + 14, 330, clamp((gx - x) / 640, 0, 1));
    const slots = []; for (let c = 0; slots.length < N + 4 && c < 40; c++) { const x = gx - 70 - c * cell * 0.9, nr = clamp(Math.floor(2 * (hx(x) - 8) / cell), 1, 1 + 2 * c); for (let r = 0; r < nr; r++) slots.push([x, my + (r - (nr - 1) / 2) * cell * 0.98 + (c % 2 ? 6 : -6)]); }
    const slot = e => { const i = Math.floor(e), f = e - i, a = slots[Math.min(i, slots.length - 1)], b = slots[Math.min(i + 1, slots.length - 1)]; return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]; };
    const seeds = Array.from({ length: N }, (_, i) => 40 + i * 13), jit = Array.from({ length: N }, (_, i) => { const r = mk(i + 3); return [r.range(-6, 6), r.range(-6, 6), r.range(-.15, .15)]; });
    const funnel = (g, u) => { const k = ease.io(u); for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(60, my + sg * 340); g.lineTo(lerp(60, gx, k), my + sg * lerp(340, gh, k)); g.lineTo(lerp(60, gx, k), my + sg * (gh + 30)); g.lineTo(60, my + sg * 370); g.closePath(); ui.fill(g, P.stone2); ui.ink(g, 3, P.ink); }
      if (k > 0.98) for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(gx, my + sg * gh); g.lineTo(gx + 560, my + sg * (gh + 6)); ui.ink(g, 5, P.ink); g.beginPath(); g.moveTo(gx, my + sg * (gh + 30)); g.lineTo(gx + 560, my + sg * (gh + 40)); ui.ink(g, 3, P.ink2); } };
    return {
      w, h,
      focus: [{ id: "queue", x: 20, y: 60, w: 1050, h: 700 }, { id: "gap", x: 520, y: 150, w: 1100, h: 600 }, { id: "meter", x: 620, y: 480, w: 1000, h: 400 }],
      draw(g, t, at) {
        const a0 = at.queue ?? 0, a1 = at.gap ?? a0 + 2.6, a2 = at.meter ?? a1 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 52, { size: F.small, color: P.mid });
        g.beginPath(); g.moveTo(60, my); g.lineTo(w - 60, my); g.setLineDash([4, 14]); ui.ink(g, 2, P.hair); g.setLineDash([]);
        funnel(g, seg(t, a0 - 0.3, a0 + 0.9));
        const rel = Math.max(0, (t - (a1 + 0.5)) / period);
        for (let i = N - 1; i >= 0; i--) { const ti = a0 - 0.1 + i * (1.3 / N), u = seg(t, ti, ti + 0.4); if (u <= 0) continue; const e = i - rel; let x, y; const j = jit[i];
          if (e >= 0) { [x, y] = slot(e); x += j[0] * (e > 0 ? 1 : 0.3); y += j[1] * (e > 0 ? 1 : 0.3) + Math.sin(t * 2 + i) * 1.5; } else { const q = -e; x = gx + q * 150; y = my + Math.sin(i * 2.1) * Math.min(60, q * 14) * (q > 1 ? 1 : 0); x = Math.min(x, w - 120 - (i % 4) * 8); }
          const drop = (1 - ease.out(u)) * -60; g.save(); g.translate(x, y + drop); g.rotate(j[2] * (e > 0 ? 1 : 0.2)); g.globalAlpha *= u; thing(g, d.what, seeds[i], { s: cell * 0.95, u: 1, t, red: i === 0 }); g.restore(); }
        if (t > a0 + 1.4) { const q = seg(t, a0 + 1.4, a0 + 2); ui.pop(g, q, 250, my - 400, () => ui.tag(g, `${N} ${d.queueLabel || "waiting"}`, 0, 0, { rot: -0.03 })); ui.leader(g, 250 + 130, my - 372, 520, my - 250, q * 0.9); }
        if (t > a1 - 0.1) { const q = seg(t, a1 - 0.1, a1 + 0.7), x = gx - 20; g.save(); g.globalAlpha *= q; g.beginPath(); g.moveTo(x, my - gh); g.lineTo(x, my + gh); ui.ink(g, 2.5, P.ink); for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(x - 12, my + sg * gh); g.lineTo(x + 12, my + sg * gh); ui.ink(g, 2.5, P.ink); } g.restore(); if (q > .6) ui.tag(g, d.gapLabel || "the gap", x + 150, my - gh - 90, { rot: 0.02 }); }
        const passed = Math.max(0, Math.min(N, Math.floor(rel))), my2 = h - 130, mx = 1130;
        if (t > a2 - 0.2) { const q = seg(t, a2 - 0.2, a2 + 0.5); ui.pop(g, q, mx, my2, () => { ui.shadow(g, () => ui.rr(g, -330, -100, 660, 200, 14), 4, 8); ui.rr(g, -330, -100, 660, 200, 14); ui.fill(g, P.paper); ui.ink(g, 2.5, P.ink2);
          ui.num(g, String(d.perMin ?? passed), -190, -10, { size: 96, color: P.red }); ui.caption(g, d.unit || "per hour", 20, -40, { size: F.small, align: "left", color: P.ink2 }); ui.caption(g, "through the gap", 20, 4, { size: F.small, align: "left" });
          for (let i = 0; i < 12; i++) { const x = -300 + i * 50, on = i < passed; g.beginPath(); g.moveTo(x, 60); g.lineTo(x, 84); ui.ink(g, on ? 5 : 2.5, on ? P.ink : P.hair); } ui.caption(g, `passed ${passed}`, 300, 72, { size: F.small, align: "right" }); }); }
      },
    };
  },
};
