// kind: dominoes (family: process) - a cause->effect chain: each domino carries a generated icon + step number and topples the next; the last one is the big effect.
// data: { chain:[{label, what}] (3..9), cap:"", redIndex:0 (the trigger, red; -1 none), note:"" (tag over the last domino) }
// focus ids: "start" (first third), "chain" (middle), "end" (last third, the effect)
import { P, F, ease, seg, clamp, lerp, ui, thing, lab, mk } from "./_ptu.js";
export default {
  name: "dominoes", family: "process",
  doc: "A row of labelled icon dominoes toppling one after another with dust puffs; the final domino is the oversized consequence.",
  example: [{ chain: [{ label: "Ship stuck", what: "containerShip" }, { label: "Canal blocked", what: "gateBarrier" }, { label: "Ports jam", what: "crane" }, { label: "Factories wait", what: "factory" }, { label: "Shelves empty", what: "pallet" }, { label: "Prices rise", what: "coinStack" }], cap: "One ship, six dominoes", redIndex: 0, note: "weeks later" },
            { chain: [{ label: "Dry spring", what: "sun" }, { label: "Low harvest", what: "grainSack" }, { label: "Bread costs more", what: "coin" }, { label: "Protests", what: "mannequin" }], cap: "From weather to unrest", redIndex: 0, note: "" }],
  build(d, K) {
    const C = (d.chain || []).slice(0, 9), n = Math.max(3, C.length), pitch = clamp(1500 / n, 150, 205), dw = 100, dh = 220, gy = 600, w = Math.max(1500, 140 + pitch * n + 260), h = 800, X = k => 130 + pitch * (k + 0.5), g1 = Math.ceil(n / 3), g2 = Math.ceil(2 * n / 3), red = d.redIndex ?? 0;
    const grp = k => k < g1 ? 0 : k < g2 ? 1 : 2, gs = [0, g1, g2], box = (a, b) => { const x0 = Math.max(0, X(a) - pitch), x1 = Math.min(w, X(b) + pitch * 1.6), cw = Math.max(1000, x1 - x0), cx = (x0 + x1) / 2; return { x: clamp(cx - cw / 2, 0, w - cw), y: 120, w: cw, h: 640 }; };
    const LAST = n - 1, big = k => k === LAST ? 1.28 : 1;
    return {
      w, h,
      focus: [{ id: "start", ...box(0, g1 - 1) }, { id: "chain", ...box(g1, g2 - 1) }, { id: "end", ...box(g2, LAST) }],
      draw(g, t, at) {
        const a = [at.start ?? 0, at.chain ?? 2.6, at.end ?? 5.2], tk = k => a[grp(k)] - 0.1 + (k - gs[grp(k)]) * 0.38;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        // ground: ruler line with ticks + soft shadow band
        const gu = ease.io(seg(t, a[0] - 0.4, a[0] + 0.6)); g.save(); g.beginPath(); g.moveTo(70, gy + 2); g.lineTo(lerp(70, w - 70, gu), gy + 2); ui.ink(g, 4, P.ink2); g.restore(); ui.ruler(g, 70, w - 70, gy + 22, Math.round((w - 140) / 40), gu, { w: 2, color: P.hair, major: 5 });
        for (let k = 0; k < n; k++) { const s = C[k] || {}, u = seg(t, a[0] - 0.3 + k * 0.08 * 0, tk(k) - 1.2), vis = k < g1 ? seg(t, a[0] - 0.3 + k * 0.15, a[0] + 0.3 + k * 0.15) : k < g2 ? seg(t, a[1] - 0.3 + (k - g1) * 0.15, a[1] + 0.3 + (k - g1) * 0.15) : seg(t, a[2] - 0.3 + (k - g2) * 0.15, a[2] + 0.3 + (k - g2) * 0.15);
          if (vis <= 0) continue; const th = ease.io(seg(t, tk(k), tk(k) + 0.6)) * (1.33 + 0.02 * ((k * 7) % 3)), z = big(k), W = dw * z, H = dh * z, isRed = k === red; const sc = ease.back(vis);
          g.save(); g.translate(X(k) + W / 2, gy); g.rotate(th); g.translate(-W / 2, 0); g.scale(1, sc);
          ui.shadow(g, () => ui.rr(g, -W / 2 + W / 2, -H, W, H, 10), 6, 6, th > 0.1 ? 0.3 : 0.8); g.translate(W / 2, 0);
          ui.rr(g, -W / 2, -H, W, H, 10); ui.fill(g, isRed ? "#f3d9d5" : P.paper); ui.ink(g, isRed ? 4 : 3, isRed ? P.red : P.ink);
          g.beginPath(); g.moveTo(-W / 2 + 10, -H * 0.42); g.lineTo(W / 2 - 10, -H * 0.42); ui.ink(g, 2, P.ink2);
          g.save(); g.translate(0, -H * 0.71); thing(g, s.what || "container", 500 + k * 5, { s: W * 0.78, u: 1, t, red: isRed }); g.restore();
          const pips = (k % 6) + 1; for (let q = 0; q < pips; q++) { const px = (-0.5 + (q % 3) * 0.5) * W * 0.5 + (pips === 1 ? 0 : 0), py = -H * (0.3 - Math.floor(q / 3) * 0.14); g.beginPath(); g.arc(px, py, W * 0.06, 0, 7); ui.fill(g, P.ink2); }
          g.restore();
          if (t > tk(k) + 0.45 && t < tk(k) + 1.1) { const q = seg(t, tk(k) + 0.45, tk(k) + 1.1), x = X(k) + W + dh * z * 0.5; g.save(); g.globalAlpha *= 1 - q; for (let i = 0; i < 5; i++) { const an = -0.2 - i * 0.55, rr = 14 + q * 42; g.beginPath(); g.moveTo(x + Math.cos(an) * rr * 0.6, gy + Math.sin(an) * rr * 0.6); g.lineTo(x + Math.cos(an) * rr, gy + Math.sin(an) * rr); ui.ink(g, 3, P.mid); } g.restore(); }
          if (vis > 0.4) { const lx = X(k); lab(g, s.label || "", lx, gy + 100, { maxW: pitch - 14, size: F.small, alpha: vis, color: isRed ? P.redInk : P.ink2 }); } }
        // push arrow at the trigger + effect tag
        if (t > a[0] + 0.3) { const q = seg(t, a[0] + 0.3, a[0] + 0.9); ui.arrow(g, [[X(0) - 150, gy - 120], [X(0) - 70, gy - 120]], q, { color: P.red, w: 6 }); }
        if (d.note && t > tk(LAST) + 0.5) { const q = seg(t, tk(LAST) + 0.5, tk(LAST) + 1.1); ui.pop(g, q, X(LAST) + 120, 230, () => ui.tag(g, d.note, 0, 0, { rot: 0.03 })); }
      },
    };
  },
};
