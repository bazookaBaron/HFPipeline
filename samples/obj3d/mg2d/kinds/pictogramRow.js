// kind: pictogramRow (family: numbers) - rows of generated objects (isotype chart): one object = `each` units, the last object of a row is clipped to the fraction (ghost outline
// shows the whole), row labels left, value numerals at the end, unit key with a leader to the partial object of the red row.
// data: { rows: [{ label, value, object? }, ...] (2..8), object: "person" (default), each: 10 (units per object; auto), unit: "million people", cap: "...", redRow: (default = max), note: "a third of a person" (optional) }
// focus ids: "rows" (all rows), "key" (unit key + the red row's partial object)
import * as H from "./_h_numcmp.js";
export default {
  name: "pictogramRow", family: "numbers",
  doc: "Isotype rows of generated objects with a clipped partial last object, row labels, value numerals and a unit key.",
  example: [{ rows: [{ label: "Tokyo", value: 37 }, { label: "Delhi", value: 33 }, { label: "Shanghai", value: 29 }, { label: "Dhaka", value: 23 }, { label: "Cairo", value: 22 }], object: "person", each: 5, unit: "million people", cap: "Largest metro areas", redRow: 1, note: "growing fastest" },
            { rows: [{ label: "Truck", value: 62 }, { label: "Rail", value: 27 }, { label: "Ship", value: 9 }, { label: "Air", value: 2 }], object: "container", each: 6, unit: "% of freight", cap: "How goods move" }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { fmt, lab, sit, measure, ell, line, nice, hashSeed, ground, flag, tw } = H;
    const R = d.rows.slice(0, 8), n = R.length, maxV = Math.max(...R.map(r => r.value)), red = d.redRow ?? R.findIndex(r => r.value === maxV), each = d.each ?? nice(maxV / 9, 1).step, maxN = Math.ceil(maxV / each);
    const w = 1700, h = 220 + n * 96 + 200, rh = 96, lw = 330, px = 100 + lw, pw = w - px - 260, py = 160, whats = R.map(r => r.object ?? d.object ?? "person"), ms = whats.map(x => measure(x, 4));
    const S = whats.map((x, i) => Math.min(pw / maxN * 0.9 / (ms[i].w / 100), rh * 0.9 / (ms[i].h / 100), 150)), cw = i => pw / maxN, rowY = i => py + (i + 1) * rh - 10;
    const partial = R[red].value / each % 1, redN = Math.floor(R[red].value / each);
    return {
      w, h, focus: [{ id: "rows", x: 30, y: 90, w: w - 60, h: h - 150 }, { id: "key", x: px + redN * cw(red) - 560, y: py + red * rh - 170, w: 1100, h: 640 }],
      draw(g, t, at) {
        const t0 = at.rows ?? 0, t1 = at.key ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        const step = Math.min(0.3, 1.6 / n);
        R.forEach((r, i) => { const ts = t0 + 0.05 + i * step, Rd = i === red, y = rowY(i), cnt = r.value / each, full = Math.floor(cnt), fr = cnt - full, au = seg(t, ts, ts + 0.4); if (au <= 0) return;
          H.dash(g, 90, y + 2, w - 90, y + 2, ease.io(au), "rgba(120,108,85,.4)", 1.5, [3, 8]); lab(g, r.label, 100 + lw / 2 - 20, y - rh * 0.4, { maxW: lw - 20, color: Rd ? P.redInk : P.ink2, weight: Rd ? 800 : 600, alpha: au });
          const cwi = cw(i), sd = hashSeed(K.seed, 40 + i);
          for (let j = 0; j <= full; j++) { const last = j === full; if (last && fr < 0.04) break; const u = seg(t, ts + 0.1 + j * 0.06, ts + 0.1 + j * 0.06 + 0.35); if (u <= 0) continue; const x = px + (j + 0.5) * cwi;
            g.save(); g.translate(x, (1 - ease.out(u)) * -40); g.globalAlpha *= Math.min(1, u * 3); ell(g, 0, y + 1, cwi * 0.3, 6, 0.6);
            if (last) { g.save(); g.globalAlpha *= 0.22; sit(g, sd + j, whats[i], S[i], 0, y, { red: Rd, t }); g.restore(); g.save(); g.beginPath(); g.rect(-cwi / 2, y - rh, cwi * fr + 0, rh + 4); g.clip(); } sit(g, sd + j, whats[i], S[i], 0, y, { red: Rd, t }); if (last) g.restore(); g.restore(); }
          const vu = seg(t, ts + 0.3 + Math.min(full, 8) * 0.06, ts + 0.8 + Math.min(full, 8) * 0.06); if (vu > 0) ui.pop(g, vu, px + Math.min(full + 1, maxN + 0.3) * cwi + 70, y - rh * 0.4, () => ui.num(g, fmt(r.value), 0, 0, { size: F.num * 0.66, align: "left", color: Rd ? P.red : P.ink }), "back");
        });
        // key: object = each units (bottom left), leader to the red row's partial object
        const ku = seg(t, t1 - 0.2, t1 + 0.7), ky = h - 90; if (ku > 0) { g.save(); g.globalAlpha *= ku; ui.rr(g, 100, ky - 56, 660, 112, 14); ui.fill(g, P.paper2); ui.ink(g, 2, P.hair); sit(g, hashSeed(K.seed, 40), whats[0], 80, 170, ky + 34, { t }); ui.caption(g, "= " + fmt(each) + (d.unit ? " " + d.unit : ""), 230, ky, { size: F.small, align: "left", caps: false, spacing: 0, color: P.ink2 }); g.restore(); }
        const ls = seg(t, t1 + 0.3, t1 + 1.1); if (ls > 0 && partial > 0.04) { const x = px + (redN + partial * 0.5) * cw(red), y = rowY(red) - rh * 0.45; g.save(); ui.leader(g, x, y, x + 120, py + red * rh + rh + 120, ls, P.red); g.restore(); if (ls > 0.85 && d.note) flag(g, d.note, x + 120 + tw(d.note, F.small, 800, false) / 2 + 20, py + red * rh + rh + 120, { red: false }); }
        else if (ls > 0.5 && d.note) ui.pop(g, ls, w - 420, h - 90, () => flag(g, d.note, 0, 0));
      },
    };
  },
};
