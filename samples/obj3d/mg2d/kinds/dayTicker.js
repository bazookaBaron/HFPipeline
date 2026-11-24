// kind: dayTicker (family: time) - a "DAY n" ticker advances while each day drops new items onto a growing pile; the newest day's items are red; a day-tick strip and a running total below.
// data: { days:12, perDay:3 (items added each day), what:"container", unit:"DAY", label:"boxes waiting", cap:"" , note:"" (tag on the pile at the end) }
// focus ids: "ticker" (day numeral + the pile starting), "pile" (the pile growing), "total" (total counter + day strip)
import { P, F, ease, seg, clamp, lerp, ui, thing, lab, mk, num } from "./_ptu.js";
export default {
  name: "dayTicker", family: "time",
  doc: "Big DAY n numeral that ticks up, items dropping each day into a pyramid pile solved from the counts, the newest day highlighted red, a strip of day ticks and a total counter.",
  example: [{ days: 12, perDay: 3, what: "containerShip", unit: "DAY", label: "ships waiting", cap: "Backlog at the canal", note: "36 and counting" },
            { days: 9, perDay: 4, what: "documentPage", unit: "DAY", label: "unread mails", cap: "Back from holiday", note: "" }],
  build(d, K) {
    const D = clamp(Math.round(d.days ?? 12), 2, 24), pd = clamp(Math.round(d.perDay ?? 3), 1, 6), N = D * pd, w = 1800, h = 940, base = 690, cols = Math.min(12, Math.max(4, Math.ceil(Math.sqrt(N * 2.2)))), cell = clamp(1000 / cols, 70, 130), px0 = 700;
    const pos = []; { let r = 0, placed = 0; while (placed < N) { const cap = Math.max(1, cols - r), cnt = Math.min(cap, N - placed); for (let i = 0; i < cnt; i++) pos.push([px0 + (i - (cnt - 1) / 2) * cell * 1.02 + (cols * cell) / 2, base - cell * 0.5 - r * cell * 0.78]); placed += cnt; r++; } }
    const sd = Array.from({ length: N }, (_, i) => { const r = mk(i * 5 + 2); return [r.range(-6, 6), r.range(-0.12, 0.12), Math.floor(r() * 1e6)]; });
    return {
      w, h,
      focus: [{ id: "ticker", x: 20, y: 90, w: 1100, h: 800 }, { id: "pile", x: 480, y: 120, w: 1250, h: 780 }, { id: "total", x: 300, y: 380, w: 1450, h: 520 }],
      draw(g, t, at) {
        const a0 = at.ticker ?? 0, a1 = at.pile ?? a0 + 2.6, a2 = at.total ?? a1 + 2.6, tEnd = a2 + 1.4, iv = clamp((tEnd - (a0 + 0.5)) / D, 0.1, 0.8); ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        const day = clamp(Math.floor((t - (a0 + 0.5)) / iv) + 1, 0, D), fr = clamp(((t - (a0 + 0.5)) / iv) % 1, 0, 1);
        // ground line + soft shadow under the pile
        g.beginPath(); g.moveTo(560, base + 4); g.lineTo(lerp(560, w - 70, ease.io(seg(t, a0 - 0.3, a0 + 0.7))), base + 4); ui.ink(g, 4, P.ink2); g.save(); g.fillStyle = P.shadow2; g.beginPath(); g.ellipse(px0 + cols * cell / 2, base + 14, cols * cell * 0.55, 14, 0, 0, 7); g.fill(); g.restore();
        // DAY numeral (rolls: old digit slides out as the new one slides in)
        const nu = seg(t, a0 - 0.2, a0 + 0.5); ui.pop(g, nu, 330, 300, () => { ui.caption(g, d.unit || "DAY", 0, -150, { size: F.cap * 1.4, color: P.ink2, spacing: 8, weight: 800 });
          g.save(); g.beginPath(); g.rect(-240, -110, 480, 230); g.clip(); const e = ease.out(fr); if (day > 1 && fr < 1) ui.num(g, String(day - 1), 0, e * 150, { size: F.big * 1.9, color: P.ink, alpha: 1 - e }); ui.num(g, String(Math.max(day, 1)), 0, day > 1 ? -150 * (1 - e) : 0, { size: F.big * 1.9, color: P.red }); g.restore();
          g.beginPath(); g.moveTo(-210, 140); g.lineTo(210, 140); ui.ink(g, 5, P.ink); });
        // items: each day's pd items drop in sequence
        for (let i = 0; i < N; i++) { const dd = Math.floor(i / pd), ti = a0 + 0.5 + dd * iv + (i % pd) * (iv / pd) * 0.7, u = seg(t, ti, ti + 0.45); if (u <= 0) continue; const [x, y] = pos[i], isNew = dd + 1 === day, drop = (1 - ease.settle(u)) * -320;
          g.save(); g.translate(x + sd[i][0], y + drop); g.rotate(sd[i][1] * (1 - u * 0.5)); g.globalAlpha *= Math.min(1, u * 4); thing(g, d.what || "container", sd[i][2], { s: cell * 0.98, u: 1, t, red: isNew && day < D + 1 && t < a2 + 3.2 && dd + 1 === day }); g.restore(); }
        // day strip: one tick per day, current one red, with running count
        const sx0 = 640, sx1 = w - 130, sy = base + 130; g.save(); g.beginPath(); g.moveTo(sx0, sy); g.lineTo(sx1, sy); ui.ink(g, 3, P.hair); g.restore(); for (let k = 0; k < D; k++) { const x = lerp(sx0 + 20, sx1 - 20, k / Math.max(1, D - 1)), on = k < day; g.beginPath(); g.moveTo(x, sy - (on ? 20 : 10)); g.lineTo(x, sy + (on ? 20 : 10)); ui.ink(g, on ? 5 : 2.5, on ? (k === day - 1 ? P.red : P.ink) : P.hair); if (k === 0 || k === D - 1 || k === day - 1 && on && D < 16) ui.num(g, String(k + 1), x, sy + 52, { size: 34, color: P.ink2 }); }
        // total counter
        const tu = seg(t, a2 - 0.2, a2 + 0.5), total = Math.min(N, day * pd); if (tu > 0) ui.pop(g, tu, w - 280, 250, () => { ui.num(g, String(total), 0, 0, { size: F.big * 1.3, color: P.red }); lab(g, d.label || "total", 0, 100, { maxW: 380, size: F.cap, color: P.ink2 }); });
        if (d.note && t > tEnd + 0.1) { const q = seg(t, tEnd + 0.1, tEnd + 0.7); ui.pop(g, q, px0 + cols * cell / 2, base - Math.min(N, N) / cols * cell * 0.8 - 160, () => ui.tag(g, d.note, 0, 0, { rot: -0.03 })); }
      },
    };
  },
};
