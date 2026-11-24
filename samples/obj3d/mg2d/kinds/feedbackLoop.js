// kind: feedbackLoop (family: process) - stages on a ring joined by arrows; a red pulse circulates, each lap is counted, the centre names the loop.
// data: { stages:[{label, what}] (3..6), cap:"", loopLabel:"reinforcing", sign:"+" , laps: "lap" (counter word) }
// focus ids: "stages", "pulse" (arrows + circulating pulse), "centre"
import { P, F, ease, seg, clamp, lerp, ui, thing, lab, ppt, dot, TAU } from "./_ptu.js";
export default {
  name: "feedbackLoop", family: "process",
  doc: "A closed loop of generated stage cards on an ellipse with drawn arrows; a pulse laps the ring and each stage bumps as it passes; centre badge names the loop type.",
  example: [{ stages: [{ label: "More users", what: "phone" }, { label: "More content", what: "documentPage" }, { label: "More ad money", what: "coinStack" }, { label: "Better product", what: "laptop" }], cap: "Why platforms snowball", loopLabel: "reinforcing", sign: "+" },
            { stages: [{ label: "Price spikes", what: "coinStack" }, { label: "Demand drops", what: "people" }, { label: "Stock builds", what: "pallet" }, { label: "Price falls", what: "gaugeDial" }, { label: "Demand returns", what: "truck" }], cap: "A market that corrects", loopLabel: "balancing", sign: "-" }],
  build(d, K) {
    const S = (d.stages || []).slice(0, 6), n = Math.max(3, S.length), w = 1700, h = 960, cx = w / 2, cy = h / 2 + 20, rx = 590, ry = 300, cw = 250, ch = 190;
    const ang = i => -Math.PI / 2 + i * TAU / n, P0 = th => [cx + rx * Math.cos(th), cy + ry * Math.sin(th)];
    const arc = i => { const a0 = ang(i) + 0.30 + (n < 5 ? 0.06 : 0), a1 = ang(i + 1) - 0.30 - (n < 5 ? 0.06 : 0); return Array.from({ length: 14 }, (_, k) => P0(lerp(a0, a1, k / 13))); };
    const ring = Array.from({ length: 90 }, (_, k) => P0(-Math.PI / 2 + k * TAU / 90)).concat([P0(-Math.PI / 2)]);
    return {
      w, h,
      focus: [{ id: "stages", x: 40, y: 40, w: w - 80, h: h - 80 }, { id: "pulse", x: 240, y: 160, w: 1220, h: 640 }, { id: "centre", x: 520, y: 330, w: 660, h: 420 }],
      draw(g, t, at) {
        const a0 = at.stages ?? 0, a1 = at.pulse ?? a0 + 2.6, a2 = at.centre ?? a1 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        // faint orbit guide + dash ring
        g.save(); g.globalAlpha *= seg(t, a0 - 0.3, a0 + 0.5); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.setLineDash([3, 14]); ui.ink(g, 2, P.hair); g.restore();
        // pulse position: starts at a1, one lap per 7 s
        const tp = Math.max(0, t - a1 - 0.4), lap = tp / 7, pth = -Math.PI / 2 + lap * TAU, bump = i => { if (t < a1) return 0; let dlt = ((pth - ang(i)) % TAU + TAU) % TAU; dlt = Math.min(dlt, TAU - dlt); return Math.exp(-dlt * dlt * 28); };
        for (let i = 0; i < n; i++) { const s = S[i] || {}, ta = a0 - 0.2 + i * 0.5, u = seg(t, ta, ta + 0.5), [x, y] = P0(ang(i)), b = bump(i); if (u <= 0) continue;
          ui.pop(g, u, x, y, () => { g.scale(1 + 0.08 * b, 1 + 0.08 * b); ui.shadow(g, () => ui.rr(g, -cw / 2, -ch / 2, cw, ch, 16), 5, 9); ui.rr(g, -cw / 2, -ch / 2, cw, ch, 16); ui.fill(g, P.paper); ui.ink(g, 2.5 + 2 * b, b > 0.5 ? P.red : "rgba(43,42,39,.5)");
            g.save(); g.translate(0, -26); thing(g, s.what || "container", 900 + i * 7, { s: 98, u: Math.min(1, u * 1.2), t, red: false }); g.restore(); lab(g, s.label || "", 0, 66, { maxW: cw - 24, size: F.small }); });
          if (u > 0.5) { ui.caption(g, String(i + 1), x - cw / 2 + 24, y - ch / 2 + 26, { size: F.small, weight: 800, color: P.mid, caps: false, alpha: u }); } }
        // arrows between stages
        for (let i = 0; i < n; i++) { const ta = a1 - 0.3 + i * 0.4; ui.arrow(g, arc(i), ease.io(seg(t, ta, ta + 0.7)), { w: 5, color: P.ink2, head: 16 }); }
        // pulse + tail
        if (t > a1 + 0.3) { const al = seg(t, a1 + 0.3, a1 + 0.8); for (let k = 7; k >= 0; k--) { const th = pth - k * 0.045, [x, y] = P0(th); g.save(); g.globalAlpha *= al * (1 - k / 8) * 0.8; dot(g, x, y, 14 - k * 1.2, P.red, k === 0); g.restore(); } }
        // centre: loop name, sign badge, circular arrow, lap counter
        if (t > a2 - 0.2) { const q = seg(t, a2 - 0.2, a2 + 0.6); ui.pop(g, q, cx, cy, () => {
          g.beginPath(); g.arc(0, -54, 62, 0, TAU); ui.fill(g, P.paper2); ui.ink(g, 3, P.ink); ui.caption(g, d.sign ?? "+", 0, -52, { size: 78, weight: 800, color: P.red, caps: false, spacing: 0 });
          g.beginPath(); g.arc(0, -54, 84, -2.5 + t * 0.6, 0.9 + t * 0.6); ui.ink(g, 4, P.ink2); lab(g, d.loopLabel || "loop", 0, 58, { size: F.cap, maxW: 400, color: P.ink });
          ui.caption(g, `${d.laps || "lap"} ${Math.floor(lap) + 1}`, 0, 112, { size: F.small, color: P.mid }); }); }
      },
    };
  },
};
