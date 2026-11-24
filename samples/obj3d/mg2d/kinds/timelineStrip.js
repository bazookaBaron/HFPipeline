// kind: timelineStrip (family: time) - a long paper strip with year ticks; events are SH vignette cards alternating above/below; a red progress line travels along.
// data: { events:[{year, label, what}] (2..9), from:(default min year), to:(default max year), cap:"", unit:"" (suffix after the year numerals) }
// focus ids: "start", "middle", "end" (thirds of the events, left to right)
import { P, F, ease, seg, clamp, lerp, ui, lab, vcard, dot, num } from "./_ptu.js";
export default {
  name: "timelineStrip", family: "time",
  doc: "Paper strip with auto-chosen year ticks; events placed by year (spacing solved so cards never collide), stems to vignette cards above/below, red progress line with a pin that advances.",
  example: [{ events: [{ year: 1859, label: "Digging starts", what: "crane" }, { year: 1869, label: "Canal opens", what: "containerShip" }, { year: 1956, label: "Nationalised", what: "banknoteBundle" }, { year: 1967, label: "Closed 8 years", what: "gateBarrier" }, { year: 2021, label: "Ship stuck", what: "tug" }], cap: "A canal across time" },
            { events: [{ year: 1990, label: "First web page", what: "laptop" }, { year: 2007, label: "Smartphone", what: "phone" }, { year: 2022, label: "AI chatbots", what: "chip" }], cap: "Three jumps", unit: "" }],
  build(d, K) {
    const E = (d.events || []).slice(0, 9).map(e => ({ ...e, year: +e.year })).sort((a, b) => a.year - b.year), n = Math.max(2, E.length), y0 = d.from ?? Math.min(...E.map(e => e.year)), y1 = d.to ?? Math.max(...E.map(e => e.year)), span = Math.max(1, y1 - y0);
    let ppy = 1400 / span; for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) { const need = (j - i) === 1 ? 170 : (j - i) === 2 ? 330 : 0; if (need && E[j].year > E[i].year) ppy = Math.max(ppy, need / (E[j].year - E[i].year)); }
    const X0 = 280, w = Math.max(1700, X0 * 2 + span * ppy), h = 860, sy = 460, XY = yr => X0 + (yr - y0) * ppy, steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000], step = steps.find(s => span / s <= 18 && s * ppy >= 95) ?? 1000;
    const third = k => { const a = Math.floor(k * n / 3), b = Math.max(a, Math.ceil((k + 1) * n / 3) - 1), x0 = XY(E[a].year) - 330, x1 = XY(E[b].year) + 330, cw = Math.max(1000, x1 - x0), cx = (x0 + x1) / 2; return { x: clamp(cx - cw / 2, 0, w - cw), y: 120, w: Math.min(cw, w), h: 700 }; };
    const grp = i => Math.min(2, Math.floor(i * 3 / n));
    return {
      w, h,
      focus: [{ id: "start", ...third(0) }, { id: "middle", ...third(1) }, { id: "end", ...third(2) }],
      draw(g, t, at) {
        const a = [at.start ?? 0, at.middle ?? 2.6, at.end ?? 5.2], tk = i => a[grp(i)] - 0.1 + (i - E.findIndex((_, q) => grp(q) === grp(i))) * 0.55; ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, Math.min(w / 2, 900), 56, { size: F.small, color: P.mid });
        // strip: stone band with year ticks and numerals inside, drawn left to right
        const su = ease.io(seg(t, a[0] - 0.4, a[0] + 0.9)), sx1 = lerp(X0 - 150, w - X0 + 150, su); g.save(); ui.shadow(g, () => ui.rr(g, X0 - 150, sy - 38, sx1 - X0 + 150, 76, 10), 0, 10); ui.rr(g, X0 - 150, sy - 38, sx1 - X0 + 150, 76, 10); ui.fill(g, P.sand2); ui.ink(g, 3.5, P.ink); g.save(); ui.rr(g, X0 - 150, sy - 38, sx1 - X0 + 150, 76, 10); g.clip();
        for (let yr = Math.ceil(y0 / step) * step - step; yr <= y1 + step; yr += step) { const x = XY(yr); if (x > sx1 + 5 || x < X0 - 150) continue; g.beginPath(); g.moveTo(x, sy - 38); g.lineTo(x, sy - 20); g.moveTo(x, sy + 38); g.lineTo(x, sy + 20); ui.ink(g, 2.5, P.ink2); ui.caption(g, String(yr), x, sy + 1, { size: F.small, caps: false, spacing: 0, color: P.ink2, weight: 700 });
          for (let m = 1; m < 5; m++) { const xm = x + step * ppy * m / 5; g.beginPath(); g.moveTo(xm, sy - 38); g.lineTo(xm, sy - 30); ui.ink(g, 1.5, P.mid); } } g.restore(); g.restore();
        // playhead: red line grows along the strip to each event; pin at its head
        let hx = XY(E[0].year) - 90; for (let i = 0; i < n; i++) if (t >= tk(i) - 0.35) { const nx = i + 1 < n ? tk(i + 1) : 1e9; hx = XY(E[i].year) + (i + 1 < n ? (XY(E[i + 1].year) - XY(E[i].year)) * ease.io(seg(t, nx - 0.6, nx)) : 0); }
        if (t > a[0] - 0.3) { g.save(); g.beginPath(); g.moveTo(X0 - 140, sy + 50); g.lineTo(Math.max(X0 - 140, hx), sy + 50); ui.ink(g, 7, P.red); g.restore(); const q = seg(t, a[0] - 0.3, a[0] + 0.2); g.save(); g.translate(hx, sy + 50 - (1 - q) * 60); g.globalAlpha *= q; g.beginPath(); g.moveTo(0, 0); g.lineTo(-16, -30); g.lineTo(16, -30); g.closePath(); ui.fill(g, P.red); ui.ink(g, 2.5, P.redInk); g.restore(); }
        E.forEach((e, i) => { const x = XY(e.year), up = i % 2 === 0, ta = tk(i), u = seg(t, ta, ta + 0.55), cy = sy + (up ? -250 : 250), isRed = i === (d.redIndex ?? n - 1) && false; if (u <= 0) return;
          const q = ease.io(seg(t, ta - 0.1, ta + 0.4)); g.beginPath(); g.moveTo(x, sy + (up ? -38 : 38)); g.lineTo(x, lerp(sy + (up ? -38 : 38), cy + (up ? 132 : -132), q)); ui.ink(g, 3, P.ink2); dot(g, x, sy + (up ? -38 : 38), 8, P.ink);
          vcard(g, { what: e.what || "container", seed: 4000 + i * 11, x, y: cy, cw: 290, ch: 262, u, t, s: 160, label: e.label });
          ui.num(g, String(e.year) + (d.unit || ""), x + 16, sy + (up ? -66 : 66), { size: 40, align: "left", color: i === n - 1 ? P.red : P.ink, alpha: u }); });
      },
    };
  },
};
