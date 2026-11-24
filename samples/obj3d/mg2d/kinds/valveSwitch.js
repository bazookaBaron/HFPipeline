// kind: valveSwitch (family: process) - a flow runs through a pipe; a (red) valve closes, upstream particles pile up, downstream stages starve and grey out.
// data: { flow:{label, what} (the source), valve:{label:"Valve"}, stages:[{label, what}] (2..4 downstream), cap:"", closedNote:"" (tag when shut), unit:"" }
// focus ids: "flow" (source + running pipe), "valve" (the closing valve), "after" (what stops downstream)
import { P, F, ease, seg, clamp, lerp, ui, thing, vig, lab, chans, dot, mk, TAU } from "./_ptu.js";
export default {
  name: "valveSwitch", family: "process",
  doc: "A pipe with flow particles, a drawn gate valve whose wheel turns and gate drops; particles then pile up before it and the downstream stage cards starve one by one.",
  example: [{ flow: { label: "Gas supply", what: "gasFlare" }, valve: { label: "Pipeline valve" }, stages: [{ label: "Power plants", what: "chimney" }, { label: "Factories", what: "factory" }, { label: "Homes", what: "house" }], cap: "Turn it off", closedNote: "day 1 of the cut" },
            { flow: { label: "Chip supply", what: "chip" }, valve: { label: "Export ban" }, stages: [{ label: "Assembly", what: "forklift" }, { label: "Phones", what: "phone" }], cap: "A ban at the source", closedNote: "" }],
  build(d, K) {
    const S = (d.stages || []).slice(0, 4), n = Math.max(1, S.length), w = 1800, h = 860, py = 380, VX = 650, X0 = 330, X1 = w - 140, sx = k => VX + 330 + k * ((X1 - VX - 330) / n), nDots = 22, L = X1 - X0, sd = Array.from({ length: nDots }, (_, i) => mk(900 + i * 3)());
    return {
      w, h,
      focus: [{ id: "flow", x: 20, y: 120, w: 1000, h: 620 }, { id: "valve", x: 250, y: 60, w: 900, h: 680 }, { id: "after", x: 640, y: 120, w: 1140, h: 700 }],
      draw(g, t, at) {
        const a0 = at.flow ?? 0, a1 = at.valve ?? a0 + 2.6, a2 = at.after ?? a1 + 2.6, tc = a1 + 0.9, close = ease.io(seg(t, a1 + 0.2, a1 + 1.3)); ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        const pipe = [[X0, py], [X1, py]]; chans(g, [{ pts: pipe, w: 46, u: ease.io(seg(t, a0 - 0.3, a0 + 0.8)), c: P.stone }], 0);
        vig(g, d.flow?.what || "barrel", 3, 170, py, 150, seg(t, a0 - 0.3, a0 + 0.3), t); if (t > a0 + 0.4) { const al = seg(t, a0 + 0.4, a0 + 0.8); lab(g, d.flow?.label || "source", 170, py + 130, { maxW: 240, alpha: al }); }
        // particles: loop along the pipe; after the valve closes, upstream ones queue at the valve, downstream ones run out
        if (t > a0 + 0.2) { const al = seg(t, a0 + 0.2, a0 + 0.8), v = 150, spacing = L / nDots; for (let i = 0; i < nDots; i++) { const ph = (i * spacing + sd[i] * 6), x = (tt) => X0 + ((ph + v * Math.max(0, tt - a0)) % L); let px = x(Math.min(t, tc)), vis = true;
            if (t > tc) { if (px < VX - 40) { const slot = VX - 54 - ((nDots - 1 - i) % 22) * 0 - (Math.floor(px / 1) * 0); px = Math.min(px + v * (t - tc), VX - 40 - (i % 9) * 15 - (Math.floor(i / 9) % 3) * 0); } else { px = px + v * (t - tc); if (px > X1) vis = false; } }
            if (vis) { const yy = py + (t > tc && px < VX - 40 ? Math.sin(i * 12.9) * 9 * seg(t, tc, tc + 1.5) - Math.floor(i / 9 % 3) * 0 : 0); g.save(); g.globalAlpha *= al; dot(g, px, yy, 6, P.ink2, false); g.restore(); } } }
        // the valve: body, bonnet, stem, rotating handwheel, gate window (red = the one focus)
        const vu = seg(t, a1 - 0.3, a1 + 0.3); ui.pop(g, vu, VX, py, () => { const rot = close * 6.4;
          ui.shadow(g, () => ui.rr(g, -70, -52, 140, 104, 20), 4, 8); ui.rr(g, -70, -52, 140, 104, 20); ui.fill(g, P.red2); ui.ink(g, 4, P.ink); for (const sx2 of [-1, 1]) { ui.rr(g, sx2 * 74 - 12, -64, 24, 128, 4); ui.fill(g, P.stone2); ui.ink(g, 3, P.ink); }
          ui.rr(g, -22, -150, 44, 100, 6); ui.fill(g, P.stone); ui.ink(g, 3, P.ink); ui.rr(g, -40, -170, 80, 28, 6); ui.fill(g, P.stone2); ui.ink(g, 3, P.ink);
          g.save(); g.translate(0, -190); g.beginPath(); g.ellipse(0, 0, 112, 26, 0, 0, TAU); ui.fill(g, P.paper2); ui.ink(g, 4, P.ink); for (let k = 0; k < 6; k++) { const a = rot + k * TAU / 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 112, Math.sin(a) * 26); ui.ink(g, 4, P.ink2); } g.restore();
          g.save(); ui.rr(g, -36, -36, 72, 72, 8); g.clip(); g.fillStyle = P.paper; g.fillRect(-40, -40, 80, 80); g.fillStyle = P.ink2; g.fillRect(-36, -40 + 76 * close - 80 + 40, 72, 80); g.restore(); ui.rr(g, -36, -36, 72, 72, 8); ui.ink(g, 3, P.ink); });
        if (t > a1 + 0.3) { const q = seg(t, a1 + 0.3, a1 + 0.9); ui.leader(g, VX + 50, py + 40, VX + 130, py + 160, q); if (q > 0.9) ui.tag(g, d.valve?.label || "valve", VX + 130 + 120, py + 160, { rot: 0.02 }); }
        if (d.closedNote && t > tc + 0.4) { const q = seg(t, tc + 0.4, tc + 1); ui.pop(g, q, VX - 180, py - 190, () => ui.tag(g, d.closedNote, 0, 0, { rot: -0.03 })); }
        // pile-up mark upstream (pressure bracket)
        if (t > tc + 0.8) { const q = seg(t, tc + 0.8, tc + 1.4); g.save(); g.globalAlpha *= q; g.beginPath(); g.moveTo(VX - 190, py + 60); g.lineTo(VX - 190, py + 78); g.lineTo(VX - 44, py + 78); g.lineTo(VX - 44, py + 60); ui.ink(g, 3, P.ink2); g.restore(); if (q > 0.5) ui.caption(g, "backs up", VX - 117, py + 112, { size: F.small, alpha: q }); }
        // downstream stages: cards that starve one by one
        S.forEach((s, k) => { const x = sx(k), ta = a2 - 0.2 + k * 0.5, u = seg(t, a0 + 0.5 + k * 0.2, a0 + 1.1 + k * 0.2), dead = ease.io(seg(t, ta + 0.3, ta + 0.9)), cy2 = py + 190; if (u <= 0) return;
          g.beginPath(); g.moveTo(x, py + 24); g.lineTo(x, cy2 - 100); ui.ink(g, 4, P.ink2); ui.pop(g, u, x, cy2 + 6, () => { ui.shadow(g, () => ui.rr(g, -128, -100, 256, 250, 14), 4, 8); ui.rr(g, -128, -100, 256, 250, 14); ui.fill(g, P.paper); ui.ink(g, 2.5, "rgba(43,42,39,.5)"); g.save(); g.translate(0, -8); thing(g, s.what || "container", 1500 + k * 5, { s: 128, u: 1, t }); g.restore(); lab(g, s.label || "", 0, 112, { maxW: 230, size: F.small });
            if (dead > 0) { g.save(); ui.rr(g, -128, -100, 256, 250, 14); g.clip(); g.globalAlpha *= dead * 0.85; g.fillStyle = "rgba(251,248,241,.78)"; g.fillRect(-130, -102, 260, 254); ui.hatch(g, -128, -100, 256, 250, 14, "rgba(43,42,39,.28)"); g.restore();
              g.save(); g.globalAlpha *= dead; g.beginPath(); g.moveTo(-34, -34); g.lineTo(34, 34); g.moveTo(34, -34); g.lineTo(-34, 34); ui.ink(g, 8, P.ink); g.restore(); } }); });
        // drained pipe segment: hatch band after the valve once it is shut
        if (t > tc) { const q = ease.io(seg(t, tc, tc + 1.2)); g.save(); g.globalAlpha *= q * 0.8; g.fillStyle = P.paper; g.fillRect(VX + 78, py - 17, (X1 - VX - 90) * Math.min(1, q), 34); g.restore(); }
      },
    };
  },
};
