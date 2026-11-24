// kind: waffleGrid (family: numbers) - a 10x10 unit grid that fills cell by cell (1 cell = 1% / 1 of total/100), colour per part, partial cells, legend with counts,
// big counted-up numeral for the red part and a context object.
// data: { parts: [{ label, value }, ...] (value out of `total`; red = redIndex), total: 100, unit: "of households", cap: "...", object: "house" (context object beside the legend), redIndex: 0, note: "up from 1 in 10" (optional) }
//       (shortcut: { value: 37, label: "have solar", ... } = one part + remainder)
// focus ids: "grid" (the waffle), "legend" (legend + big number + object)
import * as H from "./_h_numcmp.js";
export default {
  name: "waffleGrid", family: "numbers",
  doc: "10x10 unit grid filling cell by cell with coloured parts (partial cells), legend, counted-up big number and context object.",
  example: [{ parts: [{ label: "Own a car", value: 38 }, { label: "Use transit", value: 27 }, { label: "Walk or cycle", value: 20 }], total: 100, unit: "of commuters", cap: "How the city commutes", object: "car", redIndex: 0, note: "most still drive" },
            { value: 7.5, label: "Cannot pay a surprise bill", total: 100, unit: "of workers", cap: "Savings gap", object: "coin" }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { fmt, lab, sit, flag, ell, line, hashSeed, tw } = H, total = d.total ?? 100;
    const parts = (d.parts ?? [{ label: d.label ?? "", value: d.value }]).slice(0, 5), red = d.redIndex ?? 0, cols = [P.ink2, P.mid, P.stone2, P.water2];
    const w = 1600, h = 900, cs = 64, gp = 10, gx = 120, gy = 130, GW = 10 * cs + 9 * gp, nonRed = parts.map((p, i) => i).filter(i => i !== red), colOf = i => i === red ? P.red : cols[nonRed.indexOf(i) % cols.length];
    // per cell fill list: bottom-left row-major going up; each cell can carry up to 2 parts (partial)
    const cell = Array.from({ length: 100 }, () => []); { let pos = 0; parts.forEach((p, i) => { let v = p.value / total * 100; while (v > 1e-6 && pos < 100) { const ci = Math.floor(pos), room = ci + 1 - pos, take = Math.min(room, v); cell[ci].push({ part: i, from: pos - ci, to: pos - ci + take }); pos += take; v -= take; } }); }
    const cpos = i => { const r = Math.floor(i / 10), c = i % 10; return [gx + c * (cs + gp), gy + (9 - r) * (cs + gp)]; };
    const lx0 = gx + GW + 130;
    return {
      w, h, focus: [{ id: "grid", x: gx - 60, y: 90, w: GW + 120, h: GW + 120 }, { id: "legend", x: lx0 - 60, y: 100, w: w - lx0 - 20, h: 740 }],
      draw(g, t, at) {
        const t0 = at.grid ?? 0, t1 = at.legend ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        // empty cells appear as a wave from bottom-left, then fill
        for (let i = 0; i < 100; i++) { const [x, y] = cpos(i), r = Math.floor(i / 10), c = i % 10, ue = seg(t, t0 - 0.2 + (r + c) * 0.025, t0 + 0.3 + (r + c) * 0.025); if (ue <= 0) continue;
          const uf = seg(t, t0 + 0.3 + i / 100 * 1.6, t0 + 0.3 + i / 100 * 1.6 + 0.4);
          g.save(); g.translate(x + cs / 2, y + cs / 2); g.scale(ease.back(ue), ease.back(ue)); ui.rr(g, -cs / 2, -cs / 2, cs, cs, 9); ui.fill(g, P.paper2); ui.ink(g, 2, P.hair);
          if (uf > 0 && cell[i].length) { const sc = 0.55 + 0.45 * ease.back(uf); g.scale(sc, sc); g.globalAlpha = Math.min(1, uf * 3); for (const f of cell[i]) { g.save(); ui.rr(g, -cs / 2, -cs / 2, cs, cs, 9); g.clip(); g.fillStyle = colOf(f.part); g.fillRect(-cs / 2 + f.from * cs, -cs / 2, (f.to - f.from) * cs, cs); g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(-cs / 2 + f.from * cs, -cs / 2, (f.to - f.from) * cs, cs * 0.28); g.restore(); }
            ui.rr(g, -cs / 2, -cs / 2, cs, cs, 9); ui.ink(g, 2.5, cell[i].some(f => f.part === red) ? P.redInk : P.ink2); }
          g.restore(); }
        // row/column ticks for reading: 10-cell brackets
        const bu = ease.io(seg(t, t0 + 0.6, t0 + 1.4)); line(g, gx - 28, gy + GW, gx - 28, lerp(gy + GW, gy, bu), 2.5, P.ink2); line(g, gx - 36, gy + GW, gx - 20, gy + GW, 2.5, P.ink2); if (bu > 0.95) line(g, gx - 36, gy, gx - 20, gy, 2.5, P.ink2);
        ui.caption(g, "1 square = " + fmt(total / 100) + "%", gx + GW / 2, gy + GW + 54, { size: F.small, color: P.mid, alpha: bu });
        // legend + big number
        const lu = seg(t, t1 - 0.2, t1 + 0.6), val = parts[red].value, cu = ease.out(seg(t, t1 - 0.1, t1 + 1.4)), shown = val / total * 100 * cu;
        g.save(); g.globalAlpha = Math.min(1, seg(t, t0 + 1.2, t0 + 1.8) + lu); ui.num(g, fmt(shown, val / total * 100 % 1 ? 1 : 0) + "%", lx0, 215, { size: F.big * 1.15, align: "left", color: P.red }); g.restore();
        if (d.unit) ui.caption(g, d.unit, lx0 + 4, 300, { size: F.small, align: "left", color: P.mid, alpha: lu });
        parts.forEach((p, i) => { const ls = seg(t, t1 + i * 0.2, t1 + 0.5 + i * 0.2); if (ls <= 0) return; g.save(); g.globalAlpha = ls; g.translate(0, (1 - ease.out(ls)) * 18); const y = 380 + i * 82; ui.rr(g, lx0, y - 18, 36, 36, 8); ui.fill(g, colOf(i)); ui.ink(g, 2.5, i === red ? P.redInk : P.ink2);
          lab(g, p.label, lx0 + 56, y, { maxW: 380, base: "middle", color: i === red ? P.redInk : P.ink2, weight: i === red ? 800 : 600 }); ui.num(g, fmt(p.value / total * 100, p.value % 1 ? 1 : 0) + "%", lx0 + 500, y, { size: F.num * 0.62, align: "left", color: i === red ? P.red : P.ink }); g.restore(); });
        // context object on a ground strip + note
        const ou = seg(t, t1 + 0.5, t1 + 1.3), oy = 790; if (ou > 0) { H.ground(g, lx0, w - 80, oy, ou); H.groundTicks(g, lx0, w - 80, oy, ou); for (let k = 0; k < 3; k++) { const uu = seg(t, t1 + 0.5 + k * 0.25, t1 + 1.0 + k * 0.25); if (uu > 0) ui.pop(g, uu, lx0 + 130 + k * 210, oy, () => { ell(g, 0, 4, 80, 10, 0.7); sit(g, hashSeed(K.seed, 90 + k), d.object || "house", k === 1 ? 190 : 160, 0, 0, { red: k === 0 && false, t }); }, "settle"); } }
        if (d.note) { const nu = seg(t, t1 + 1.0, t1 + 1.6); if (nu > 0) ui.pop(g, nu, lx0 + 260, 650, () => flag(g, d.note, 0, 0)); }
      },
    };
  },
};
