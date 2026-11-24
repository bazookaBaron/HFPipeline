// kind: illustratedBars (family: numbers) - a bar chart whose bars are STACKS of generated objects (one object = `each` units, partial top object clipped), with a
// value axis, gridlines, value flags, category labels and a unit key. The tallest (or chosen) bar is the red one.
// data: { items: [{ label, value, object? }], object: "container" (default object for every bar), each: 50 (units per object; auto if omitted), unit: "million tonnes",
//         cap: "Cargo by port", note: "double the next port" (leader note on the red bar), redIndex: (default = max) }
// focus ids: "bars" (whole chart), "peak" (red bar + note)
import * as H from "./_h_numcmp.js";
export default {
  name: "illustratedBars", family: "numbers",
  doc: "Bar chart where each bar is a stack of generated objects (partial top object), with value axis, flags and unit key.",
  example: [{ items: [{ label: "Singapore", value: 37 }, { label: "Shanghai", value: 47 }, { label: "Ningbo", value: 33 }, { label: "Shenzhen", value: 30 }, { label: "Busan", value: 23 }, { label: "Rotterdam", value: 15 }],
              object: "container", unit: "million boxes", cap: "Container throughput by port", note: "Shanghai alone beats Europe's top three" },
            { items: [{ label: "2019", value: 120 }, { label: "2020", value: 85 }, { label: "2021", value: 140 }, { label: "2022", value: 190 }, { label: "2023", value: 260 }],
              object: "coin", each: 40, unit: "billion $", cap: "Chip investment per year", note: "triple in four years", redIndex: 4 },
            { items: [{ label: "Oil", value: 4400 }, { label: "Gas", value: 3300 }, { label: "Coal", value: 8300 }, { label: "Wind", value: 2100 }], object: "tree", each: 1000, unit: "TWh", cap: "Power by source" }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { sit, measure, lab, flag, fmt, nice, hashSeed, axisY, line, ground, groundTicks, ell, key } = H;
    const items = d.items.slice(0, 12), n = items.length, maxV = Math.max(...items.map(i => i.value)), red = d.redIndex ?? items.findIndex(i => i.value === maxV);
    const each = d.each ?? nice(maxV / 7, 1).step, maxN = Math.ceil(maxV / each), ax = nice(maxV, 4);
    const w = Math.max(1500, 260 + n * 170), h = 880, px = 190, pw = w - px - 80, py = 190, ph = 520, yb = py + ph, slot = pw / n;
    const whats = items.map(i => i.object ?? d.object ?? "container"), ms = whats.map(x => measure(x, 3));
    const S = whats.map((x, i) => Math.min(slot * 0.82 / (ms[i].w / 100), ph * 0.96 / (maxN * (ms[i].h / 100) * 1.05), 170)), seeds = items.map((_, i) => hashSeed(K.seed, 30 + i));
    const bx = i => px + slot * (i + 0.5), cellH = i => ms[i].h * S[i] / 100 * 1.05;
    const barTop = i => yb - items[i].value / each * cellH(i);
    return {
      w, h, focus: [{ id: "bars", x: 20, y: 90, w: w - 40, h: h - 110 }, { id: "peak", x: clamp(bx(red) - 460, 20, w - 940), y: 120, w: 920, h: 700 }],
      draw(g, t, at) {
        const t0 = at.bars ?? 0, t1 = at.peak ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        const au = seg(t, t0 - 0.2, t0 + 0.7); axisY(g, px, px + pw, yb, ph, ax.top, ax.step, au); ground(g, px - 10, px + pw + 10, yb, au); groundTicks(g, px, px + pw, yb, au);
        if (d.unit) ui.caption(g, d.unit, px - 16, py - 56, { size: F.small, align: "left", color: P.mid, alpha: au });
        const step = Math.min(0.32, 1.5 / n);
        for (let i = 0; i < n; i++) {
          const ts = t0 + 0.1 + i * step, cnt = items[i].value / each, full = Math.floor(cnt), fr = cnt - full, cH = cellH(i), R = i === red;
          g.save(); g.translate(bx(i), 0); ell(g, 0, yb + 2, slot * 0.4, 8, seg(t, ts, ts + 0.3) * 0.8);
          for (let j = 0; j <= full; j++) { const last = j === full; if (last && fr < 0.04) break; const u = seg(t, ts + j * 0.07, ts + j * 0.07 + 0.35); if (u <= 0) continue; const f = last ? fr : 1;
            g.save(); g.translate(0, (1 - ease.out(u)) * -50); g.globalAlpha *= Math.min(1, u * 3);
            if (last) { g.beginPath(); g.rect(-slot, yb - j * cH - cH * f - 2, slot * 2, cH * f + 2); g.clip(); }
            sit(g, seeds[i] + j * 7, whats[i], S[i], 0, yb - j * cH, { red: R, t }); g.restore(); }
          // value flag riding on the top of the stack + category label
          const fu = seg(t, ts + Math.min(full, 6) * 0.07 + 0.2, ts + Math.min(full, 6) * 0.07 + 0.6), top = barTop(i);
          if (fu > 0) ui.pop(g, fu, 0, top - 40, () => H.flag(g, fmt(items[i].value), 0, 0, { red: R }));
          g.restore();
          lab(g, items[i].label, bx(i), yb + 62, { maxW: slot * 0.95, color: R ? P.redInk : P.ink2, alpha: seg(t, ts, ts + 0.4) });
        }
        // unit key: one object = each units
        const ku = seg(t, t0 + 1.0, t0 + 1.6); if (ku > 0) { g.save(); g.globalAlpha *= ku; const kx = w - 90 - H.tw("= " + fmt(each) + (d.unit ? " " + d.unit : ""), F.small, 600, false) - 70, ky = py - 40; ui.rr(g, kx - 30, ky - 50, w - 40 - kx - 10 + 10, 100, 12); ui.fill(g, P.paper2); ui.ink(g, 2, P.hair);
          sit(g, seeds[0], whats[0], 64, kx + 24, ky + 28, { t }); ui.caption(g, "= " + fmt(each) + (d.unit ? " " + d.unit : ""), kx + 70, ky, { size: F.small, align: "left", caps: false, spacing: 0, color: P.ink2 }); g.restore(); }
        // peak: leader from the red stack to the note; dimension bracket from ground to top
        const pu = seg(t, t1 - 0.1, t1 + 0.8), top = barTop(red), x = bx(red) + slot * 0.46;
        if (pu > 0) { g.save(); g.setLineDash([]); line(g, x, yb, x, lerp(yb, top, ease.io(pu)), 3, P.red); if (pu > 0.9) { line(g, x - 10, top, x + 10, top, 3, P.red); line(g, x - 10, yb, x + 10, yb, 3, P.red); } g.restore(); }
        if (d.note) { const lu = seg(t, t1 + 0.4, t1 + 1.2), tx = clamp(bx(red) + 200, 300, w - 300), ty = Math.max(150, top - 70); ui.leader(g, x + 10, (top + yb) / 2 - 20, tx - 30, ty + 60, lu, P.ink); if (lu > 0.85) { const f = lab; H.flag(g, d.note, tx + 40, ty + 60, { size: F.small }); } }
      },
    };
  },
};
