// kind: eraBands (family: time) - eras as palette-tinted bands across a time axis (width ~ duration), each with an icon, label and year range; one red-striped era.
// data: { eras:[{label, from, to, what}] (2..7), cap:"", redIndex:-1 (red-striped era), unit:"" (suffix on years) }
// focus ids: "first", "middle", "last" (thirds of the eras)
import { P, F, ease, seg, clamp, lerp, ui, thing, lab, num, dot } from "./_ptu.js";
export default {
  name: "eraBands", family: "time",
  doc: "Bands coloured in with a sweeping brush edge, widths solved from durations (with a minimum), hatched alternate eras, icon + label + year range per era, boundary ticks on an axis and a pin that rides along it.",
  example: [{ eras: [{ label: "Sail", from: 1600, to: 1830, what: "fishingBoat" }, { label: "Steam", from: 1830, to: 1950, what: "locomotive" }, { label: "Container", from: 1956, to: 2000, what: "container" }, { label: "Mega ships", from: 2000, to: 2024, what: "containerShip" }], cap: "Four eras of shipping", redIndex: 2 },
            { eras: [{ label: "Print", from: 1450, to: 1900, what: "documentPage" }, { label: "Radio and TV", from: 1900, to: 1995, what: "phone" }, { label: "Web", from: 1995, to: 2024, what: "laptop" }], cap: "How news travelled", redIndex: 2 }],
  build(d, K) {
    const E = (d.eras || []).slice(0, 7).map(e => ({ ...e, from: +e.from, to: +e.to })), n = Math.max(2, E.length), dur = E.map(e => Math.max(1, e.to - e.from)), tot = dur.reduce((a, b) => a + b, 0), minW = 330, avail = Math.max(1500, n * 400), bw = dur.map(v => Math.max(minW, v / tot * avail));
    const X0 = 140, xs = []; let acc = X0; bw.forEach(b => { xs.push(acc); acc += b; }); const w = acc + 140, h = 860, by = 230, bh = 430, red = d.redIndex ?? -1, tints = [P.water, P.sand2, P.stone, P.sand, P.water2, P.stone2, P.fog], axisY = by + bh + 110;
    const grp = i => Math.min(2, Math.floor(i * 3 / n)), third = k => { const a = Math.floor(k * n / 3), b = Math.max(a, Math.ceil((k + 1) * n / 3) - 1), x0 = xs[a] - 60, x1 = xs[b] + bw[b] + 60, cw = Math.max(1000, Math.min(w, x1 - x0)), cx = (x0 + x1) / 2; return { x: clamp(cx - cw / 2, 0, w - cw), y: 150, w: cw, h: 680 }; };
    return {
      w, h,
      focus: [{ id: "first", ...third(0) }, { id: "middle", ...third(1) }, { id: "last", ...third(2) }],
      draw(g, t, at) {
        const a = [at.first ?? 0, at.middle ?? 2.6, at.last ?? 5.2], tk = i => a[grp(i)] - 0.1 + (i - E.findIndex((_, q) => grp(q) === grp(i))) * 0.55; ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, Math.min(w / 2, 900), 56, { size: F.small, color: P.mid });
        // axis
        const au = ease.io(seg(t, a[0] - 0.3, a[0] + 0.8)); g.save(); g.beginPath(); g.moveTo(X0, axisY); g.lineTo(lerp(X0, w - 140, au), axisY); ui.ink(g, 4, P.ink); g.restore();
        let head = X0; E.forEach((e, i) => { const ta = tk(i), u = ease.io(seg(t, ta, ta + 0.8)), x = xs[i], bwid = bw[i], red_ = i === red; if (u <= 0) return; head = Math.max(head, x + bwid * u);
          g.save(); ui.rr(g, x, by, bwid * u, bh, 10); ui.fill(g, tints[i % tints.length]); g.save(); ui.rr(g, x, by, bwid * u, bh, 10); if (i % 2) ui.hatch(g, x, by, bwid * u, bh, 16, "rgba(43,42,39,.13)"); g.restore(); ui.rr(g, x, by, bwid * u, bh, 10); ui.ink(g, 3, P.ink);
          if (red_) { g.save(); g.fillStyle = P.red; g.fillRect(x + 3, by + 3, Math.max(0, bwid * u - 6), 18); g.restore(); } g.restore();
          if (u > 0.85) { const al = seg(t, ta + 0.6, ta + 1.1); g.save(); g.globalAlpha *= al; g.translate(x + bwid / 2, by + bh * 0.46); thing(g, e.what || "container", 4600 + i * 7, { s: Math.min(210, bwid * 0.62), u: 1, t, red: false }); g.restore(); lab(g, e.label || "", x + bwid / 2, by + 70, { maxW: bwid - 30, size: F.cap, alpha: al, color: red_ ? P.redInk : P.ink });
            ui.num(g, `${e.from}${d.unit || ""}`, x + 14, by + bh + 36, { size: 34, align: "left", alpha: al, color: P.ink2 }); if (i === n - 1) ui.num(g, `${e.to}${d.unit || ""}`, x + bwid - 14, by + bh + 36, { size: 34, align: "right", alpha: al, color: P.ink2 }); }
          g.beginPath(); g.moveTo(x, by + bh); g.lineTo(x, axisY + 14); ui.ink(g, 3, P.ink); });
        // pin riding the axis at the colouring edge
        if (t > a[0] - 0.2) { const q = seg(t, a[0] - 0.2, a[0] + 0.3); g.save(); g.translate(Math.min(head, w - 140), axisY - 40 + Math.sin(t * 5) * 2); g.globalAlpha *= q; ui.pin(g, 0, 0, true, 1.3); g.restore(); }
      },
    };
  },
};
