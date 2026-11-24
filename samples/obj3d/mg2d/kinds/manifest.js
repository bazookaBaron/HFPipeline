// kind: manifest (family: documents) - a ship's manifest on a clipboard: ship drawing at the head, table of cargo lines (SH icon, description, quantity, tick) that land one by one, and a total bar (the red total).
// data: { vessel:"MV Aurora", route:"Rotterdam to Singapore", lines:[{ what:"oil", n:"Crude oil", q:"280,000 t" }], total:"412,000 t", totalLabel:"Total cargo", ship:"containerShip" (SH generator), cap }
// focus ids: "lines" (the cargo lines land with icons + ticks), "total" (total bar + stamp-like underline)
import { P, F, ease, seg, clamp, lerp, ui, rng, icon, sd, fit, chip, circ, measure } from "./_srd.js";
import { tick } from "./_srd3.js";
export default {
  name: "manifest", family: "documents",
  doc: "Ship manifest on a clipboard: cargo lines with SH icons, quantities, ticks and a red total.",
  example: [
    { vessel: "MV Aurora", route: "Rotterdam to Singapore", ship: "containerShip", cap: "What is on board", lines: [{ what: "container", n: "Containers", q: "9,400 TEU" }, { what: "chip", n: "Electronics", q: "1,200 t" }, { what: "car", n: "Cars", q: "640 units" }, { what: "grain", n: "Grain", q: "8,000 t" }, { what: "pipe", n: "Steel pipe", q: "2,100 t" }], total: "21,300 t", totalLabel: "Total cargo" },
    { vessel: "MT Meridian", route: "Ras Tanura to Ningbo", ship: "tanker", lines: [{ what: "oil", n: "Crude oil", q: "280,000 t" }, { what: "fuel", n: "Bunker fuel", q: "3,200 t" }, { what: "food", n: "Ship stores", q: "18 t" }], total: "283,218 t" },
  ],
  build(d, K) {
    const r = K.rng, L = d.lines, n = L.length, RW = 1180, ROW = 96, SH0 = 330, PH = SH0 + n * ROW + 200, w = RW + 280, h = PH + 220, bx = 140, by = 100, seed = sd(r);
    return {
      w, h, focus: [{ id: "lines", x: bx - 50, y: by - 40, w: RW + 100, h: Math.min(PH + 40, 880) }, { id: "total", x: bx - 50, y: by + PH - 640, w: RW + 100, h: 700 }],
      draw(g, t, at) {
        const t0 = at.lines ?? 0, t1 = at.total ?? t0 + 2.6, ST = 0.5; ui.card(g, 0, 0, w, h, { r: 18, rule: false });
        // clipboard: board + paper + metal clip
        g.save(); g.translate(bx, by); ui.shadow(g, () => ui.rr(g, -30, -30, RW + 60, PH + 60, 20), 8, 18); ui.rr(g, -30, -30, RW + 60, PH + 60, 20); ui.fill(g, "#b39a73"); ui.ink(g, 4); ui.rr(g, 0, 0, RW, PH, 6); ui.fill(g, "#fdfbf6"); ui.ink(g, 2.5, "rgba(43,42,39,.4)");
        ui.rr(g, RW / 2 - 130, -52, 260, 76, 14); ui.fill(g, P.stone2); ui.ink(g, 4); ui.rr(g, RW / 2 - 90, -24, 180, 22, 8); ui.fill(g, P.ink2);
        // header: ship drawing + vessel / route
        const hu = ease.out(seg(t, t0 - 0.3, t0 + 0.6)); g.save(); g.globalAlpha *= hu; icon(g, d.ship ?? "containerShip", RW - 330, 130, 520, { seed, t }); ui.caption(g, d.vessel, 50, 80, { size: F.big * 0.55, align: "left", color: P.ink, weight: 800 }); ui.caption(g, d.route ?? "", 50, 142, { size: F.cap, align: "left", color: P.ink2, caps: false, spacing: 0, weight: 500 });
        ui.caption(g, "Cargo manifest", 50, 200, { size: F.small, align: "left", color: P.mid, weight: 700 }); g.restore(); g.beginPath(); g.moveTo(40, SH0 - 60); g.lineTo(RW - 40, SH0 - 60); ui.ink(g, 4, P.ink2);
        [["Item", 150], ["Quantity", RW - 280]].forEach(([c, x]) => ui.caption(g, c, x, SH0 - 24, { size: F.small, align: "left", color: P.mid, weight: 700 }));
        L.forEach((q, i) => { const ts = t0 + 0.1 + i * ST, u = ease.out(seg(t, ts, ts + 0.45)); if (u <= 0) return; const y = SH0 + i * ROW + 28; g.save(); g.globalAlpha *= u; g.translate((1 - u) * 60, 0);
          if (i % 2 === 0) { g.fillStyle = "rgba(226,221,209,.4)"; g.fillRect(30, y - 44, RW - 60, ROW - 6); } icon(g, q.what ?? "container", 92, y, 86, { seed: sd(r) % 97 + i, t }); fit(g, q.n, 150, y, 560, { size: F.cap, align: "left", color: P.ink, weight: 600, caps: false, spacing: 0 });
          ui.caption(g, q.q, RW - 280, y, { size: F.cap, align: "left", color: P.ink2, weight: 700, caps: false, spacing: 0 }); tick(g, RW - 80, y, 34, seg(t, ts + 0.3, ts + 0.7), P.ink2); g.beginPath(); g.moveTo(40, y + 46); g.lineTo(RW - 40, y + 46); ui.ink(g, 1.5, "rgba(43,42,39,.15)"); g.restore(); });
        // total bar (red): wipes in, double rule
        const tu = ease.out(seg(t, t1 - 0.2, t1 + 0.7)), ty = SH0 + n * ROW + 50; g.save(); g.globalAlpha *= clamp(tu * 2, 0, 1); g.beginPath(); g.moveTo(40, ty - 20); g.lineTo(RW - 40, ty - 20); ui.ink(g, 4, P.ink);
        ui.caption(g, d.totalLabel ?? "Total", 60, ty + 40, { size: F.cap, align: "left", color: P.ink, weight: 800 }); ui.num(g, d.total ?? "", RW - 60, ty + 44, { size: 72, align: "right", color: P.red }); const du = ease.io(seg(t, t1 + 0.3, t1 + 1.0)); for (const dy of [86, 96]) { g.beginPath(); g.moveTo(RW - 60, ty + dy); g.lineTo(RW - 60 - 460 * du, ty + dy); ui.ink(g, dy === 86 ? 5 : 3, P.red); } g.restore(); g.restore();
        if (d.cap) ui.caption(g, d.cap, w / 2, h - 46, { size: F.cap, color: P.ink2, weight: 700 });
      },
    };
  },
};
