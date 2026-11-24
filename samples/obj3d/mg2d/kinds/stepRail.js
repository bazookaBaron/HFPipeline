// kind: stepRail (family: process) - process steps along a rail; a marker travels through, each step is an SH vignette on a card.
// data: { steps:[{label, what}] (2..8), cap:"", note:"" (tag on the last step) }
// focus ids: "begin" (first half of the rail), "finish" (second half)
import { P, F, ease, seg, clamp, lerp, ui, lab, vcard, badge } from "./_ptu.js";
export default {
  name: "stepRail", family: "process",
  doc: "A numbered rail with a travelling red marker; each step is a generated vignette on a paper card with a label underneath.",
  example: [{ steps: [{ label: "Order placed", what: "phone" }, { label: "Picked in warehouse", what: "pallet" }, { label: "Loaded on truck", what: "truck" }, { label: "Port crane", what: "crane" }, { label: "Ocean leg", what: "containerShip" }, { label: "Customs stamp", what: "stamp" }], cap: "From click to doorstep", note: "weeks, not days" },
            { steps: [{ label: "Idea", what: "laptop" }, { label: "Law drafted", what: "documentPage" }, { label: "Vote", what: "podium" }, { label: "Signed", what: "stamp" }], cap: "How a bill moves", note: "" }],
  build(d, K) {
    const st = (d.steps || []).slice(0, 8), n = Math.max(2, st.length), half = Math.ceil(n / 2), pitch = clamp(1500 / n, 200, 300), w = Math.max(1500, pitch * n + 160), h = 760, ry = 560, X = i => 80 + pitch * (i + 0.5) + (w - 160 - pitch * n) / 2;
    const bx0 = 20, bx1 = Math.min(w - 20, X(half - 1) + pitch * 0.7), fx0 = Math.max(20, X(half) - pitch * 0.7);
    return {
      w, h,
      focus: [{ id: "begin", x: bx0, y: 80, w: bx1 - bx0, h: h - 130 }, { id: "finish", x: fx0, y: 80, w: w - 20 - fx0, h: h - 130 }],
      draw(g, t, at) {
        const a0 = at.begin ?? 0, a1 = at.finish ?? a0 + 2.8, tk = i => i < half ? a0 - 0.1 + i * 0.5 : a1 - 0.1 + (i - half) * 0.5;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        let mx = X(0) - pitch * 0.45; for (let i = 0; i < n; i++) if (t >= tk(i) - 0.25) { const nx = i + 1 < n ? tk(i + 1) : 1e9; mx = X(i) + (i + 1 < n ? (X(i + 1) - X(i)) * ease.io(seg(t, nx - 0.5, nx)) : 0); }
        const rx0 = X(0) - pitch * 0.45, rx1 = X(n - 1) + pitch * 0.45;
        for (let x = rx0; x <= rx1; x += 26) { g.beginPath(); g.moveTo(x, ry - 16); g.lineTo(x, ry + 24); ui.ink(g, 5, P.hair); }
        for (const dy of [0, 16]) { g.beginPath(); g.moveTo(rx0, ry + dy); g.lineTo(rx1, ry + dy); ui.ink(g, 4, P.ink); }
        g.beginPath(); g.moveTo(rx0, ry + 8); g.lineTo(Math.max(rx0, mx), ry + 8); ui.ink(g, 7, P.ink2);
        for (let i = 0; i < n; i++) { const ta = tk(i), x = X(i), u = seg(t, ta, ta + 0.5), s = st[i] || {};
          if (t > ta - 0.2) { g.beginPath(); g.moveTo(x, ry - 70); g.lineTo(x, ry - 22); ui.ink(g, 3, P.ink2); }
          vcard(g, { what: s.what || "container", seed: 60 + i * 11, x, y: ry - 230, cw: pitch * 0.82, ch: 250, u, t, s: pitch * 0.55 });
          badge(g, i + 1, x, ry - 20, { r: 22 }); if (u > 0.3) lab(g, s.label || "", x, ry + 92, { maxW: pitch - 20, size: F.small, alpha: seg(t, ta + 0.2, ta + 0.6) }); }
        if (t > a0 - 0.4) { const q = seg(t, a0 - 0.4, a0 + 0.1); g.save(); g.translate(mx, ry - 34 - (1 - q) * 80 + Math.sin(t * 6) * 3); g.globalAlpha *= q; ui.pin(g, 0, 0, true, 1.5); g.restore(); }
        if (d.note && t > tk(n - 1) + 0.6) { const q = seg(t, tk(n - 1) + 0.6, tk(n - 1) + 1.2); ui.pop(g, q, X(n - 1) - 40, 150, () => ui.tag(g, d.note, 0, 0, { rot: -0.03 })); }
      },
    };
  },
};
