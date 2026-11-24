// kind: layerStack (family: process) - flat slabs stack up one by one (each carries a generated icon), labels and a vertical ruler on the side.
// data: { layers:[{label, what, v?}] (3..7, bottom first), cap:"", redIndex:-1 (layer shown red, default top), unit:"" }
// focus ids: "base" (bottom layers), "stack" (whole stack), "top" (top layers + note)
import { P, F, ease, seg, clamp, lerp, ui, thing, lab, badge, num } from "./_ptu.js";
export default {
  name: "layerStack", family: "process",
  doc: "Isometric-ish slabs drop in and settle one on another with an icon on each top face, side labels with leaders, a measured vertical ruler and an optional red layer.",
  example: [{ layers: [{ label: "Hardware", what: "chip" }, { label: "Operating system", what: "laptop" }, { label: "Apps", what: "phone" }, { label: "Ads and data", what: "coinStack" }], cap: "The stack of a platform", redIndex: 3 },
            { layers: [{ label: "Bedrock", what: "rock" }, { label: "Aquifer", what: "waveBand" }, { label: "Soil", what: "hill" }, { label: "Farms", what: "palmTree" }, { label: "Cities", what: "building" }], cap: "What sits on the water", redIndex: 1 }],
  build(d, K) {
    const L = (d.layers || []).slice(0, 7), n = Math.max(2, L.length), pitch = clamp(660 / n, 108, 150), w = 1700, h = 300 + n * pitch + 160, cx = 640, bw = 560, bd = 150, th = 44, gy = h - 150, red = d.redIndex ?? n - 1;
    const yOf = i => gy - i * pitch;
    const slab = (g, x, y, i, isRed) => { const hw = bw / 2, hd = bd / 2; g.beginPath(); g.moveTo(x - hw, y); g.lineTo(x, y - hd); g.lineTo(x + hw, y); g.lineTo(x, y + hd); g.closePath(); ui.fill(g, isRed ? "#f1cbc6" : i % 2 ? P.stone : P.sand2); ui.ink(g, 3, isRed ? P.red : P.ink);
      g.beginPath(); g.moveTo(x - hw, y); g.lineTo(x - hw, y + th); g.lineTo(x, y + hd + th); g.lineTo(x, y + hd); g.closePath(); ui.fill(g, isRed ? P.red : P.stone2); ui.ink(g, 3, isRed ? P.red : P.ink);
      g.beginPath(); g.moveTo(x + hw, y); g.lineTo(x + hw, y + th); g.lineTo(x, y + hd + th); g.lineTo(x, y + hd); g.closePath(); ui.fill(g, isRed ? P.redInk : P.mid); ui.ink(g, 3, isRed ? P.red : P.ink);
      g.save(); g.beginPath(); g.moveTo(x - hw, y); g.lineTo(x, y - hd); g.lineTo(x + hw, y); g.lineTo(x, y + hd); g.closePath(); g.clip(); g.strokeStyle = "rgba(43,42,39,.10)"; g.lineWidth = 2; for (let k = -6; k < 7; k++) { g.beginPath(); g.moveTo(x + k * 40 - 200, y - hd); g.lineTo(x + k * 40 + 200, y + hd); g.stroke(); } g.restore(); };
    return {
      w, h,
      focus: [{ id: "base", x: 60, y: h - 520, w: 1400, h: 520 }, { id: "stack", x: 60, y: 100, w: 1500, h: h - 140 }, { id: "top", x: 60, y: 60, w: 1450, h: Math.min(h - 100, 600) }],
      draw(g, t, at) {
        const a0 = at.base ?? 0, a1 = at.stack ?? a0 + 2.6, a2 = at.top ?? a1 + 2.6, ta = i => i < Math.ceil(n / 2) ? a0 - 0.1 + i * 0.5 : a1 - 0.1 + (i - Math.ceil(n / 2)) * 0.5;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        g.save(); g.fillStyle = P.shadow2; g.beginPath(); g.ellipse(cx + 20, gy + th + 52, bw * 0.62, bd * 0.7, 0, 0, 7); g.fill(); g.restore();
        // vertical ruler at the left with a tick per layer
        const ru = ease.io(seg(t, a0 - 0.3, a0 + 0.8)); g.save(); g.beginPath(); g.moveTo(130, gy + 30); g.lineTo(130, lerp(gy + 30, yOf(n - 1) - 80, ru)); ui.ink(g, 2.5, P.ink2); for (let i = 0; i < n; i++) { if (yOf(i) < lerp(gy + 30, yOf(n - 1) - 80, ru)) continue; g.beginPath(); g.moveTo(130, yOf(i)); g.lineTo(150, yOf(i)); ui.ink(g, 2.5, P.ink2); } g.restore();
        for (let i = 0; i < n; i++) { const s = L[i] || {}, tt = ta(i), u = seg(t, tt, tt + 0.7); if (u <= 0) continue; const drop = (1 - ease.settle(u)) * -260, isRed = i === red && t > a2 - 0.2 || (i === red && red === n - 1), x = cx, y = yOf(i) + drop;
          g.save(); g.globalAlpha *= Math.min(1, u * 3); slab(g, x, y, i, i === red); g.save(); g.translate(x, y - 56); thing(g, s.what || "container", 2700 + i * 7, { s: 150, u: Math.min(1, u * 1.3), t, red: false }); g.restore(); g.restore();
          if (u > 0.8) { const lu = seg(t, tt + 0.5, tt + 1.1); g.save(); g.beginPath(); g.moveTo(x + bw / 2 + 10, y + 6); g.lineTo(lerp(x + bw / 2 + 10, 1060, ease.io(lu)), y + 6); g.setLineDash([8, 8]); ui.ink(g, 2, P.mid); g.restore(); if (lu > 0.7) { badge(g, i + 1, 1090, y + 6, { r: 22, red: i === red }); lab(g, s.label || "", 1135, y + 6, { align: "left", maxW: 400, size: F.cap, color: i === red ? P.redInk : P.ink2, alpha: seg(t, tt + 0.8, tt + 1.2) }); } } }
      },
    };
  },
};
