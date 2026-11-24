// kind: tallyBoard (family: comparison) - a ruled sheet with one row per category: object icon + label, hand-drawn tally marks (four strokes + the diagonal strike per five, slight wobble, drawn
// stroke by stroke), a counting numeral at the end of the row and a TOTAL row. The red row is the one the narration points at.
// data: { items: [{ label, count, object? }, ...] (2..8), object: "person" (default icon), per: 1 (units per stroke; auto if the biggest count > 60), unit: "votes", cap: "...", redIndex: (default = largest), note: "(optional)" }
// focus ids: "board" (all rows tallying), "total" (red row + total)
import * as H from "./_h_numcmp.js";
export default {
  name: "tallyBoard", family: "comparison",
  doc: "Ruled sheet with hand-drawn tally strokes (groups of five with strike), counting numerals per category and a total row.",
  example: [{ items: [{ label: "Harbour", count: 23, object: "crane" }, { label: "Airport", count: 14, object: "plane" }, { label: "Rail yard", count: 31, object: "locomotive" }, { label: "Border post", count: 9, object: "gateBarrier" }], unit: "delays logged", cap: "Where delays happened", redIndex: 2, note: "rail yard: one in three" },
            { items: [{ label: "Yes", count: 52 }, { label: "No", count: 38 }, { label: "Undecided", count: 17 }], object: "person", unit: "votes", cap: "Show of hands", redIndex: 0 }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp, rng } = K, { lab, sit, measure, line, flag, fmt, hashSeed, tw } = H, r = rng;
    const I = d.items.slice(0, 8), n = I.length, maxC = Math.max(...I.map(i => i.count)), per = d.per ?? (maxC > 60 ? Math.ceil(maxC / 55) : 1), red = d.redIndex ?? I.findIndex(i => i.count === maxC), total = I.reduce((a, i) => a + i.count, 0);
    const strokesOf = c => Math.round(c / per), groupsMax = Math.ceil(strokesOf(maxC) / 5), sp = clamp(940 / (groupsMax * 6), 10, 24), gw = sp * 5.2, rh = clamp(560 / n, 78, 112);
    const w = 1700, top = 200, h = top + n * rh + 250, tx = 560, whats = I.map(i => i.object ?? d.object ?? "person"), ms = whats.map(x => measure(x, 4));
    // per-stroke jitter (seeded): x offset, angle, length
    const J = I.map(it => Array.from({ length: strokesOf(it.count) }, () => [r.range(-2.2, 2.2), r.range(-0.05, 0.05), r.range(0.88, 1.06)]));
    const strokeAt = (it, k) => { const grp = Math.floor(k / 5), j = k % 5, base = tx + grp * (gw + 30); return { grp, j, base }; };
    return {
      w, h, focus: [{ id: "board", x: 30, y: 90, w: w - 60, h: h - 110 }, { id: "total", x: 30, y: Math.max(70, top + red * rh - 120), w: w - 60, h: Math.max(560, top + n * rh + 230 - (top + red * rh - 120)) }],
      draw(g, t, at) {
        const t0 = at.board ?? 0, t1 = at.total ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        // ruled sheet: horizontal rules + margin line
        const ru = ease.io(seg(t, t0 - 0.2, t0 + 0.8)); for (let i = 0; i <= n; i++) line(g, 80, top + i * rh, lerp(80, w - 80, ru), top + i * rh, i === n ? 3 : 1.8, i === n ? P.ink2 : "rgba(86,120,150,.38)");
        line(g, 520, top - 20, 520, lerp(top - 20, top + n * rh + 20, ru), 2.5, "rgba(120,108,85,.55)");
        if (per > 1) ui.caption(g, "1 stroke = " + per, 540, top - 36, { size: F.small, align: "left", color: P.mid, alpha: ru });
        I.forEach((it, i) => { const Rd = i === red, ts = t0 + 0.15 + i * Math.min(0.5, 1.8 / n), y = top + i * rh + rh / 2, lu = seg(t, ts, ts + 0.5); if (lu <= 0) return;
          g.save(); g.globalAlpha = lu; sit(g, hashSeed(K.seed, 70 + i), whats[i], Math.min(rh * 0.72, 90) / (ms[i].h / 100), 150, y + rh * 0.28, { red: Rd, t }); lab(g, it.label, 215 + 0, y, { maxW: 270, align: "left", color: Rd ? P.redInk : P.ink2, weight: Rd ? 800 : 600 }); g.restore();
          // strokes: 18 ms apart each...; the red row's strokes are the focus colour
          const ns = strokesOf(it.count), dur = 1.5, tt = ts + 0.3, cnt = clamp((t - tt) / dur, 0, 1) * ns;
          for (let k = 0; k < ns; k++) { const su = clamp(cnt - k, 0, 1); if (su <= 0) break; const { grp, j, base } = strokeAt(it, k), [jx, ja, jl] = J[i][k], hh = rh * 0.6 * jl, y0 = y - hh / 2; g.beginPath();
            if (j < 4) { const x = base + j * sp + jx; g.moveTo(x + ja * hh, y0); g.lineTo(lerp(x + ja * hh, x - ja * hh, su), lerp(y0, y0 + hh, su)); } else { const xa = base - sp * 0.5, xb = base + 3 * sp + sp * 0.6; g.moveTo(xa, y0 + hh * 0.88); g.lineTo(lerp(xa, xb, su), lerp(y0 + hh * 0.88, y0 + hh * 0.12, su)); }
            ui.ink(g, Rd ? 6 : 5, Rd ? P.red : P.ink); }
          const nu = seg(t, tt + 0.3, tt + dur + 0.3), v = Math.round(it.count * ease.out(nu)); if (nu > 0) ui.num(g, String(v), w - 150, y, { size: F.num * 0.9, align: "right", color: Rd ? P.red : P.ink }); });
        // total row
        const tu = seg(t, t1 - 0.1, t1 + 0.9), ty = top + n * rh + 100; if (tu > 0) { const v = Math.round(total * ease.out(tu));
          g.save(); g.globalAlpha = Math.min(1, tu * 2); ui.caption(g, "total" + (d.unit ? " " + d.unit : ""), 215, ty, { size: F.small, align: "left", color: P.ink2, weight: 800 }); g.restore(); ui.pop(g, seg(tu, 0, 0.5), w - 220, ty, () => { H.flag(g, fmt(v), 0, 0, { size: F.num * 0.8 }); });
          line(g, 520, ty + 54, lerp(520, w - 80, ease.io(tu)), ty + 54, 3, P.ink2); line(g, 520, ty + 64, lerp(520, w - 80, ease.io(tu)), ty + 64, 3, P.ink2);
          const share = Math.round(I[red].count / total * 100); if (tu > 0.4) ui.pop(g, seg(tu, 0.4, 1), 700, ty, () => flag(g, I[red].label + ": " + share + "%", 0, 0, { red: true })); }
        if (d.note) { const nu = seg(t, t1 + 0.7, t1 + 1.4); if (nu > 0) ui.pop(g, nu, w / 2 + 120, ty0(top, n, rh) + 190, () => flag(g, d.note, 0, 0)); }
        function ty0(a, b, c) { return a + b * c; }
      },
    };
  },
};
