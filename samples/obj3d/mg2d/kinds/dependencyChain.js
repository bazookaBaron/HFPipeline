// kind: dependencyChain (family: relations) - A depends on B depends on C: cards linked by "needs" arrows whose thickness is the load carried; each card has a load gauge that fills to its value;
// the weakest link (highest load, or weak:true) is red: it cracks and shakes and the arrows into it pulse.
// data: { chain:[{ n:"Chip plant", what:"chip", load:0.4 (0..1), note?:"60% from one supplier" }...], weak?:index, cap }
// focus ids: "chain" (cards land in order, arrows draw, gauges fill), "weak" (the weak link: cracks, load numeral, note)
import { P, F, ease, seg, clamp, lerp, ui, rng, icon, sd, fit, chip, circ, fmt, ribbon, stroke } from "./_srd.js";
export default {
  name: "dependencyChain", family: "relations",
  doc: "Cards chained by needs-arrows with load gauges; the most loaded link is red, cracks and shakes.",
  example: [
    { cap: "One thread holds the phone", chain: [{ n: "Phone maker", what: "phone", load: 0.35 }, { n: "Chip fab", what: "chip", load: 0.55 }, { n: "Rare gas", what: "gasFlare", load: 0.93, note: "one supplier" }, { n: "Shipping", what: "containerShip", load: 0.4 }] },
    { cap: "Bread and its supply line", chain: [{ n: "Bakery", what: "building", load: 0.3 }, { n: "Flour mill", what: "factory", load: 0.5 }, { n: "Grain port", what: "crane", load: 0.8 }, { n: "Wheat fields", what: "grainSack", load: 0.6 }, { n: "Fertiliser", what: "pipe", load: 0.7 }, { n: "Gas", what: "gasFlare", load: 0.45 }] },
  ],
  build(d, K) {
    const r = K.rng, C = d.chain, n = C.length, perRow = n <= 4 ? n : Math.ceil(n / 2), rows = Math.ceil(n / perRow), CW = 300, CH = 360, GX = 150, GY = 130, w = perRow * CW + (perRow - 1) * GX + 200, h = rows * CH + (rows - 1) * GY + 280;
    const weak = d.weak ?? C.reduce((a, b, i) => (b.load ?? 0) > (C[a].load ?? 0) ? i : a, 0);
    const pos = C.map((c, i) => { const row = Math.floor(i / perRow), c0 = i % perRow, col = row % 2 ? perRow - 1 - c0 : c0; return { x: 100 + col * (CW + GX) + CW / 2, y: 120 + row * (CH + GY) + CH / 2, seed: sd(r), row, col }; });
    const wb = pos[weak], fb = { x: clamp(wb.x - 560, 0, Math.max(0, w - 1120)), y: clamp(wb.y - 330, 0, Math.max(0, h - 660)), w: Math.min(1120, w), h: Math.min(660, h) };
    return {
      w, h, focus: [{ id: "chain", x: 0, y: 0, w, h }, { id: "weak", ...fb }],
      draw(g, t, at) {
        const t0 = at.chain ?? 0, t1 = at.weak ?? t0 + 2.6, ST = 0.55; ui.card(g, 0, 0, w, h, { r: 18 });
        // arrows between consecutive cards (A needs B): thickness = load of the card it leans on
        for (let i = 0; i < n - 1; i++) { const a = pos[i], b = pos[i + 1], ts = t0 + 0.3 + i * ST, u = ease.io(seg(t, ts + 0.3, ts + 0.85)); if (u <= 0) continue; const horiz = a.row === b.row, ld = C[i + 1].load ?? 0.5, wd = 6 + 22 * ld, x0 = horiz ? a.x + Math.sign(b.x - a.x) * (CW / 2 + 12) : a.x, y0 = horiz ? a.y : a.y + CH / 2 + 12, x1 = horiz ? b.x - Math.sign(b.x - a.x) * (CW / 2 + 12) : b.x, y1 = horiz ? b.y : b.y - CH / 2 - 12;
          const red = i + 1 === weak, pulse = red && t > t1 ? 1 + 0.12 * Math.sin(t * 6) : 1; ribbon(g, [[x0, y0], [lerp(x0, x1, u), lerp(y0, y1, u)]], wd * pulse, red && t > t1 - 0.2 ? P.red : "#a49f93", u > 0.98 ? wd * 0.8 + 18 : 0);
          if (u >= 1) { ui.caption(g, "needs", (x0 + x1) / 2, (y0 + y1) / 2 - wd / 2 - 24, { size: F.small, color: P.mid, caps: false, spacing: 0 }); } }
        C.forEach((c, i) => { const p = pos[i], ts = t0 - 0.2 + i * ST, u = seg(t, ts, ts + 0.5); if (u <= 0) return; const isW = i === weak, on = isW && t > t1 - 0.2, sh = on ? Math.sin(t * 42) * 3 * clamp(1 - (t - t1) / 1.6, 0.25, 1) : 0;
          g.save(); g.translate(p.x + sh, p.y); const k = ease.settle(u); g.scale(k, k); g.globalAlpha *= clamp(u * 3, 0, 1);
          ui.card(g, -CW / 2, -CH / 2, CW, CH, { r: 14, rule: false }); if (on) { g.save(); ui.rr(g, -CW / 2, -CH / 2, CW, CH, 14); ui.ink(g, 6, P.red); g.restore(); }
          icon(g, c.what ?? "container", 0, -78, 160, { seed: p.seed, t }); fit(g, c.n, 0, 40, CW - 40, { size: F.cap, color: on ? P.red : P.ink2, weight: 700 });
          // load gauge: fills to its value after the card lands
          const gu = ease.out(seg(t, ts + 0.4, ts + 1.4)), ld = (c.load ?? 0.5) * gu, gy = 104, gw = CW - 70; ui.rr(g, -gw / 2, gy, gw, 30, 15); ui.fill(g, P.lite); ui.ink(g, 2.5, P.ink2); g.save(); ui.rr(g, -gw / 2, gy, gw, 30, 15); g.clip(); g.fillStyle = on ? P.red : P.ink2; g.fillRect(-gw / 2, gy, gw * ld, 30); g.restore();
          for (let k2 = 1; k2 < 4; k2++) { g.beginPath(); g.moveTo(-gw / 2 + gw * k2 / 4, gy + 30); g.lineTo(-gw / 2 + gw * k2 / 4, gy + 40); ui.ink(g, 1.5, P.mid); }
          ui.caption(g, Math.round(ld * 100) + "% load", 0, gy + 74, { size: F.small, color: on ? P.red : P.ink2, caps: false, spacing: 0, weight: 700 });
          if (on) { const cu = ease.out(seg(t, t1, t1 + 0.7)); g.beginPath(); g.moveTo(-CW / 2 + 40, -CH / 2 + 30 + 0); g.lineTo(-CW / 2 + 70, -CH / 2 + 80); g.lineTo(-CW / 2 + 50, -CH / 2 + 120 * cu); g.lineTo(-CW / 2 + 90, -CH / 2 + 170 * cu); ui.ink(g, 4, P.red); g.beginPath(); g.moveTo(CW / 2 - 40, CH / 2 - 120); g.lineTo(CW / 2 - 76, CH / 2 - 120 - 60 * cu); g.lineTo(CW / 2 - 52, CH / 2 - 120 - 100 * cu); ui.ink(g, 4, P.red); }
          g.restore(); if (isW && c.note && t > t1 + 0.4) { g.save(); g.globalAlpha *= seg(t, t1 + 0.4, t1 + 1.0); ui.tag(g, c.note, p.x, p.y - CH / 2 - 44, { size: F.small, color: P.red }); g.restore(); } });
        if (d.cap) ui.caption(g, d.cap, w / 2, h - 50, { size: F.cap, color: P.ink2, weight: 700 });
      },
    };
  },
};
