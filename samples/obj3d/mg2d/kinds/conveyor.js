// kind: conveyor (family: process) - items ride a belt through stations that transform them (item shape changes after each station).
// data: { input:"grainSack", stations:[{label, what (machine icon), out (item generator after this station)}] (1..5), cap:"", unit:"units", red: index of the red station (-1 none) }
// focus ids: "feed", "stations", "output"
import { P, F, ease, seg, clamp, lerp, ui, thing, vig, lab } from "./_ptu.js";
export default {
  name: "conveyor", family: "process",
  doc: "A belt carries generated items through gantry stations; after each station the item turns into the next thing. Output tally ticks.",
  example: [{ input: "grainSack", stations: [{ label: "Mill", what: "building", out: "pallet" }, { label: "Bakery", what: "chimney", out: "container" }, { label: "Truck", what: "truck", out: "coinStack" }], cap: "Wheat to money", unit: "loaves", red: 1 },
            { input: "barrel", stations: [{ label: "Refine", what: "refineryColumn", out: "fuelPump" }, { label: "Tax", what: "stamp", out: "banknoteBundle" }], cap: "Crude to cash", unit: "barrels", red: 0 }],
  build(d, K) {
    const S = (d.stations || []).slice(0, 5), n = Math.max(1, S.length), pitch = 430, x0 = 140, w = x0 + 220 + pitch * n + 360, h = 840, by = 600, bx1 = w - 170, L = bx1 - x0, gap = 150, v = 170, nIt = Math.floor((L + 130) / gap), SX = i => x0 + 360 + i * pitch;
    const what = k => k === 0 ? d.input : S[k - 1]?.out || d.input;
    return {
      w, h,
      focus: [{ id: "feed", x: 0, y: 130, w: Math.min(w, 1100), h: 700 }, { id: "stations", x: Math.max(0, w / 2 - 650), y: 80, w: Math.min(w, 1300), h: 760 }, { id: "output", x: Math.max(0, w - 1150), y: 130, w: Math.min(w, 1150), h: 700 }],
      draw(g, t, at) {
        const a0 = at.feed ?? 0, a1 = at.stations ?? a0 + 2.6, a2 = at.output ?? a1 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        const bu = ease.io(seg(t, a0 - 0.3, a0 + 0.8)); g.save(); ui.shadow(g, () => ui.rr(g, x0 - 20, by + 36, (L + 40) * bu, 56, 28), 0, 14); ui.rr(g, x0 - 20, by + 36, (L + 40) * bu, 56, 28); ui.fill(g, P.stone2); ui.ink(g, 3.5, P.ink); g.save(); ui.rr(g, x0 - 20, by + 36, (L + 40) * bu, 56, 28); g.clip();
        for (let x = x0 - 30 + ((t * v) % 28); x < x0 + L * bu + 20; x += 28) { g.beginPath(); g.moveTo(x, by + 40); g.lineTo(x, by + 88); ui.ink(g, 2.5, "rgba(43,42,39,.28)"); } g.restore();
        for (const x of [x0, bx1]) if (bu > 0.99) { g.beginPath(); g.arc(x, by + 64, 24, 0, 7); ui.fill(g, P.paper2); ui.ink(g, 3, P.ink); g.beginPath(); g.moveTo(x, by + 64); g.lineTo(x + Math.cos(t * 6) * 22, by + 64 + Math.sin(t * 6) * 22); ui.ink(g, 3, P.ink); } g.restore();
        for (let x = x0 + 60; x < x0 + L * bu; x += 160) { g.beginPath(); g.moveTo(x, by + 92); g.lineTo(x - 18, by + 150); g.moveTo(x, by + 92); g.lineTo(x + 18, by + 150); ui.ink(g, 4, P.ink2); }
        g.beginPath(); g.moveTo(x0 - 60, by + 150); g.lineTo(bx1 + 60, by + 150); ui.ink(g, 2, P.hair);
        S.forEach((s, i) => { const ta = a1 - 0.2 + i * 0.5, u = seg(t, ta, ta + 0.5), x = SX(i), red = i === (d.red ?? -1), c = red ? P.red : P.ink;
          if (u > 0) { g.save(); g.globalAlpha *= Math.min(1, u * 2); const hh = 190 * ease.out(u); for (const sx of [-1, 1]) { ui.rr(g, x + sx * 80 - 10, by + 40 - hh, 20, hh, 3); ui.fill(g, red ? "#e7b3ad" : P.stone); ui.ink(g, 3, c); } ui.rr(g, x - 110, by + 40 - hh - 24, 220, 34, 6); ui.fill(g, red ? P.red2 : P.stone2); ui.ink(g, 3, c); g.restore(); }
          vig(g, s.what, 300 + i, x, by - 215, 110, seg(t, ta + 0.2, ta + 0.8), t, { red }); if (u > 0.6) lab(g, s.label, x, by - 320, { maxW: 280, size: F.small, color: red ? P.redInk : P.ink2, alpha: seg(t, ta + 0.4, ta + 0.8) }); });
        const tt = Math.max(0, t - (a0 + 0.2)), fl = [];
        for (let j = 0; j < nIt; j++) { let s = v * tt - j * gap; if (s < 0) continue; s = s % (nIt * gap); const x = x0 + s; if (x > bx1 - 10) continue; const k = S.reduce((a, _, i) => a + (x > SX(i) ? 1 : 0), 0), nearI = S.findIndex((_, i) => Math.abs(x - SX(i)) < 60), sq = nearI >= 0 ? 1 - 0.22 * Math.cos((x - SX(nearI)) / 60 * Math.PI / 2) : 1;
          if (nearI >= 0 && Math.abs(x - SX(nearI)) < 10) fl.push(SX(nearI)); g.save(); g.translate(x, by + 30); g.scale(1 / sq * 0.9 + 0.1, sq); thing(g, what(k), 700 + j * 3 + k, { s: 96, u: 1, t }); g.restore(); }
        for (const x of fl) { g.beginPath(); g.moveTo(x - 30, by - 40); g.lineTo(x + 30, by - 40); ui.ink(g, 3, P.mid); }
        const done = Math.max(0, Math.floor((v * tt - L) / gap) + 1); if (t > a2 - 0.2) { const q = seg(t, a2 - 0.2, a2 + 0.5); ui.pop(g, q, bx1 + 20, by - 190, () => { ui.shadow(g, () => ui.rr(g, -120, -75, 240, 150, 12), 3, 6); ui.rr(g, -120, -75, 240, 150, 12); ui.fill(g, P.paper); ui.ink(g, 2.5, P.ink2); ui.num(g, String(done), 0, -14, { size: 72, color: P.red }); ui.caption(g, d.unit || "units", 0, 46, { size: F.small, color: P.ink2 }); }); }
      },
    };
  },
};
