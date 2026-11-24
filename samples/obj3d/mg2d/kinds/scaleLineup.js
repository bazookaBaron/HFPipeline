// kind: scaleLineup (family: comparison) - generated objects standing side by side drawn to TRUE relative scale (their main dimension = size in `unit`) on a ground line with a scale bar,
// a dimension line + value flag along each object's main axis, magnifier bubbles for items too small to read, and a red "x N" ratio mark of the red item vs the smallest.
// data: { items: [{ label: "Tanker", size: 330, object: "tanker" }, ...] (2..8, size = real main dimension in any unit), unit: "m", cap: "...", redIndex: (default largest), note: "(optional)" }
// focus ids: "lineup" (everything on the ground line), "ratio" (the red item with its dimension vs the smallest + multiple)
import * as H from "./_h_numcmp.js";
export default {
  name: "scaleLineup", family: "comparison",
  doc: "Objects at true relative scale on a ground line with scale bar, per-object dimension lines, magnifier bubbles for tiny ones and a ratio mark.",
  example: [{ items: [{ label: "Person", size: 1.8, object: "person" }, { label: "Tug", size: 32, object: "tug" }, { label: "Tanker", size: 330, object: "tanker" }, { label: "Container ship", size: 400, object: "containerShip" }], unit: "m", cap: "How big is a ship?", redIndex: 3, note: "longer than four football pitches" },
            { items: [{ label: "Barrel", size: 0.9, object: "barrel" }, { label: "Pumpjack", size: 12, object: "pumpjack" }, { label: "Refinery column", size: 60, object: "refineryColumn" }], unit: "m", cap: "Oil kit by size" }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { lab, sit, measure, line, flag, nice, fmt, dash, ground, groundTicks, hashSeed, ell, tw } = H;
    const I = d.items.slice(0, 8), n = I.length, maxS = Math.max(...I.map(i => i.size)), red = d.redIndex ?? I.findIndex(i => i.size === maxS), ms = I.map(it => measure(it.object, 6)), gap = 70, tiny = I.map(i => i.size / maxS < 0.07);
    const uw = ms.map((m, i) => I[i].size * m.w / Math.max(m.w, m.h)), uh = ms.map((m, i) => I[i].size * m.h / Math.max(m.w, m.h)), nT = tiny.filter(Boolean).length, SLOT = 230;
    const k = Math.min((1300 - SLOT * nT - gap * (n - 1)) / (uw.reduce((a, b, i) => a + (tiny[i] ? 0 : b), 0) || 1), 440 / Math.max(...uh.filter((v, i) => !tiny[i])));
    const W_ = uw.map((v, i) => v * k), H_ = uh.map((v, i) => v * k), slot = W_.map((v, i) => tiny[i] ? SLOT : v), tot = slot.reduce((a, b) => a + b, 0) + gap * (n - 1), w = Math.max(1560, tot + 220), h = 900, gy = 700;
    const xs = []; { let x = (w - tot) / 2; for (let i = 0; i < n; i++) { xs.push(x + slot[i] / 2); x += slot[i] + gap; } }
    const smallest = I.reduce((b, it, i) => it.size < I[b].size ? i : b, 0), seedO = hashSeed(K.seed, 9), horiz = ms.map(m => m.w >= m.h), sb = nice(maxS, 4);
    return {
      w, h, focus: [{ id: "lineup", x: 30, y: 90, w: w - 60, h: h - 110 }, { id: "ratio", x: clamp(xs[red] - 520, 20, w - 1060), y: 90, w: 1040, h: h - 120 }],
      draw(g, t, at) {
        const t0 = at.lineup ?? 0, t1 = at.ratio ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        const au = seg(t, t0 - 0.2, t0 + 0.8); ground(g, 70, w - 60, gy, au); groundTicks(g, 70, w - 60, gy, au);
        // scale bar (bottom left): a nice round length in the unit, to the same scale as the objects
        { const L = sb.step * k * (sb.step * k > 60 ? 1 : 1), bu = ease.io(seg(t, t0 + 0.2, t0 + 1.0)), x0 = 90, y0 = gy + 150; if (L > 14) { line(g, x0, y0, lerp(x0, x0 + L, bu), y0, 4, P.ink); line(g, x0, y0 - 12, x0, y0 + 12, 4, P.ink); if (bu > 0.98) line(g, x0 + L, y0 - 12, x0 + L, y0 + 12, 4, P.ink); ui.caption(g, fmt(sb.step) + " " + (d.unit ?? ""), x0 + L + 20, y0, { size: F.small, align: "left", caps: false, spacing: 0, color: P.mid, alpha: bu }); } }
        for (let i = 0; i < n; i++) { const ts = t0 + 0.2 + i * Math.min(0.4, 1.6 / n), u = seg(t, ts, ts + 0.7), R_ = i === red; if (u <= 0) continue; const e = Math.min(1, ease.settle(u)), top = gy - H_[i], xl = xs[i] - W_[i] / 2, xr = xs[i] + W_[i] / 2;
          ui.pop(g, u, xs[i], gy, () => { ell(g, 0, 4, Math.max(10, W_[i] * 0.55), 6, 0.8); g.save(); g.scale(1, 0.5 + 0.5 * e); sit(g, hashSeed(seedO, i), I[i].object, Math.max(W_[i], H_[i]) / (Math.max(ms[i].w, ms[i].h) / 100), 0, 0, { red: R_, t }); g.restore(); }, "settle");
          // dimension line along the main axis (+ end ticks), flag with the value
          const du = ease.io(seg(u, 0.5, 1)), col = R_ ? P.red : P.ink2, lw = R_ ? 4 : 3;
          if (!tiny[i]) { if (horiz[i]) { const y = top - 26, xe = lerp(xl, xr, du); line(g, xl, y, xe, y, lw, col); line(g, xl, y - 11, xl, y + 11, lw, col); if (du > 0.98) line(g, xr, y - 11, xr, y + 11, lw, col); if (du > 0.6) ui.pop(g, seg(du, 0.6, 1), xs[i], y - 44, () => flag(g, fmt(I[i].size) + (d.unit ? " " + d.unit : ""), 0, 0, { red: R_ })); }
            else { const x = xr + 24, ye = lerp(gy, top, du); line(g, x, gy, x, ye, lw, col); line(g, x - 11, gy, x + 11, gy, lw, col); if (du > 0.98) line(g, x - 11, top, x + 11, top, lw, col); if (du > 0.6) ui.pop(g, seg(du, 0.6, 1), x + 10 + tw(fmt(I[i].size) + (d.unit ? " " + d.unit : ""), F.small, 800, false) / 2 + 24, (gy + top) / 2, () => flag(g, fmt(I[i].size) + (d.unit ? " " + d.unit : ""), 0, 0, { red: R_ })); } }
          else { // magnifier bubble: the object redrawn big, linked to the real-size speck by a dashed line
            const bu = ease.back(seg(u, 0.5, 1)), by = gy - 250, br = 100; dash(g, xs[i], gy - H_[i] - 4, xs[i], by + br, ease.io(seg(u, 0.5, 1)), P.mid, 2.5, [6, 7]); g.save(); g.translate(xs[i], by); g.scale(bu, bu); g.beginPath(); g.arc(0, 0, br, 0, 7); ui.shadow(g, () => { g.beginPath(); g.arc(0, 0, br, 0, 7); }, 4, 8); g.beginPath(); g.arc(0, 0, br, 0, 7); ui.fill(g, P.paper2); ui.ink(g, 4, col);
            g.save(); g.beginPath(); g.arc(0, 0, br - 4, 0, 7); g.clip(); const s2 = 150 / (Math.max(ms[i].w, ms[i].h) / 100); sit(g, hashSeed(seedO, i), I[i].object, s2, 0, ms[i].h * s2 / 200, { red: R_, t }); g.restore(); ui.num(g, fmt(I[i].size) + (d.unit ? " " + d.unit : ""), 0, br + 34, { size: F.small, color: col }); g.restore(); }
          lab(g, I[i].label, xs[i], gy + 54, { maxW: Math.max(200, slot[i] + gap - 10), color: R_ ? P.redInk : P.ink2, weight: R_ ? 800 : 600, alpha: seg(u, 0.3, 0.8) }); }
        // ratio: red item's extent vs the smallest, multiple flag, note
        const ra = seg(t, t1 - 0.1, t1 + 0.9); if (ra > 0 && smallest !== red) { const q = I[red].size / I[smallest].size, yb = gy + 110, xa = xs[red] - W_[red] / 2, xb = xs[red] + W_[red] / 2;
          line(g, xa, yb, lerp(xa, xb, ease.io(ra)), yb, 4, P.red); line(g, xa, yb - 12, xa, yb + 12, 4, P.red); if (ra > 0.98) line(g, xb, yb - 12, xb, yb + 12, 4, P.red);
          if (ra > 0.5) ui.pop(g, seg(ra, 0.5, 1), (xa + xb) / 2, yb + 4, () => { g.beginPath(); ui.rr(g, -190, -34, 380, 68, 34); ui.fill(g, P.paper); ui.ink(g, 3, P.red); ui.caption(g, "x " + fmt(q, q < 10 ? 1 : 0) + " the " + I[smallest].label, 0, 2, { size: F.small, color: P.redInk, weight: 800, caps: false, spacing: 0 }); });
          if (d.note && ra > 0.8) ui.pop(g, seg(ra, 0.8, 1), clamp(xs[red], tw(d.note, F.small, 800, false) / 2 + 60, w - tw(d.note, F.small, 800, false) / 2 - 60), 170, () => flag(g, d.note, 0, 0)); }
      },
    };
  },
};
