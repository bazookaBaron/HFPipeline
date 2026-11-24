// kind: splitAvsB (family: comparison) - two illustrated sides (object on a pedestal + name tag) facing each other across a column of matched criteria rows; each row gets a hand-drawn
// tick, cross or short value per side, then a score row tallies the ticks (winner in red).
// v3: 3 seeded layout variants (data.layout 0..2 forces one; default = stage seed % 3):
//   0 "face-off" pedestals on top, criteria centred between the two mark columns
//   1 "table"    criteria as a left-aligned column, the two sides as table columns with small pedestals as column heads
//   2 "flanks"   the two pedestals flank the rows block left and right, criteria pills in the middle band
// data: { a: { label: "Rail", object: "trainWagon" }, b: { label: "Road", object: "truck" }, rows: [{ label: "Cheaper per tonne", a: true, b: false }, { label: "Speed", a: "80 km/h", b: "95 km/h" }, ...] (2..8; a/b = true | false | "text"),
//         cap: "...", win: "a" | "b" | "" (red side; default = more ticks), note: "rail wins on cost" (optional), layout? }
// focus ids: "sides" (the two illustrated heads), "rows" (matched rows + score)
import * as H from "./_h_numcmp.js";
const NV = 3;
export default {
  name: "splitAvsB", family: "comparison", variants: NV,
  doc: "Two illustrated sides with matched rows of hand-drawn ticks/crosses/values and a score tally (winner red); 3 seeded layouts (face-off, table, flanks).",
  example: [{ a: { label: "Rail", object: "locomotive" }, b: { label: "Road", object: "truck" }, rows: [{ label: "Cost per tonne", a: true, b: false }, { label: "Door to door", a: false, b: true }, { label: "Emissions", a: true, b: false }, { label: "Typical load", a: "1,500 t", b: "26 t" }, { label: "Weather proof", a: true, b: true }], cap: "Moving freight overland", note: "rail wins on cost and carbon" },
            { a: { label: "Own", object: "house" }, b: { label: "Rent", object: "building" }, rows: [{ label: "Builds equity", a: true, b: false }, { label: "Flexible to move", a: false, b: true }, { label: "Repairs paid by you", a: true, b: false }], cap: "A home decision", win: "a" }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { lab, sit, tick, cross, flag, hashSeed, ell } = H, V = d.layout ?? (Math.abs(K.seed | 0) % NV);
    const R = d.rows.slice(0, 8), n = R.length, rh = 88;
    const L = [{ w: 1700, top: 420, cA: 330, cB: 1370, cm: 850, lx: 850, la: "center", pw: 440, ph: 200, py: 160, os: 230, pxA: 330, pxB: 1370 },
               { w: 1700, top: 420, cA: 980, cB: 1410, cm: 1195, lx: 110, la: "left", pw: 330, ph: 170, py: 140, os: 170, pxA: 980, pxB: 1410 },
               { w: 1900, top: 200, cA: 650, cB: 1250, cm: 950, lx: 950, la: "center", pw: 330, ph: 190, py: 0, os: 190, pxA: 220, pxB: 1680 }][V];
    const { w, top, cA, cB, cm } = L, h = top + n * rh + 230, pyS = V === 2 ? top + (n * rh) / 2 - L.ph / 2 - 40 : L.py, bandX0 = V === 2 ? 440 : 60, bandX1 = V === 2 ? w - 440 : w - 60;
    const sc = side => R.reduce((a, r) => a + (r[side] === true ? 1 : 0), 0), sA = sc("a"), sB = sc("b"), win = d.win ?? (sA > sB ? "a" : sB > sA ? "b" : "");
    const focus = [[{ id: "sides", x: 30, y: 70, w: w - 60, h: 420 }, { id: "rows", x: 30, y: top - 60, w: w - 60, h: n * rh + 300 }],
                   [{ id: "sides", x: 760, y: 60, w: 900, h: 420 }, { id: "rows", x: 30, y: top - 60, w: w - 60, h: n * rh + 300 }],
                   [{ id: "sides", x: 0, y: pyS - 40, w, h: L.ph + 240 }, { id: "rows", x: 400, y: top - 80, w: w - 800, h: n * rh + 320 }]][V];
    return {
      w, h, focus, layout: V,
      draw(g, t, at) {
        const t0 = at.sides ?? 0, t1 = at.rows ?? t0 + 2.6;
        ui.base(g, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, V === 1 ? 110 : w / 2, V === 2 ? 70 : 56, { size: F.small, color: P.mid, align: V === 1 ? "left" : "center" });
        // pedestals with objects (settle in), name tags
        [[d.a, L.pxA, "a"], [d.b, L.pxB, "b"]].forEach(([s, cx, sd], k) => { const u = seg(t, t0 + 0.1 + k * 0.3, t0 + 0.8 + k * 0.3), W_ = win === sd, pw = L.pw, ph = L.ph, y0 = pyS, yb = y0 + ph * 0.7; ui.pop(g, u, cx, 0, () => { g.translate(-cx, 0);
          ui.shadow(g, () => ui.rr(g, cx - pw / 2, y0, pw, ph, 22), 8, 14); ui.rr(g, cx - pw / 2, y0, pw, ph, 22); ui.fill(g, P.paper2); ui.ink(g, 3, W_ ? P.red : P.ink2);
          g.save(); g.beginPath(); g.rect(cx - pw / 2, yb, pw, ph); g.clip(); ui.rr(g, cx - pw / 2, y0, pw, ph, 22); g.fillStyle = P.stone; g.fill(); g.restore(); ui.rr(g, cx - pw / 2, y0, pw, ph, 22); ui.ink(g, 3, W_ ? P.red : P.ink2); H.line(g, cx - pw / 2, yb, cx + pw / 2, yb, 2.5, P.ink2);
          ell(g, cx, yb, pw * 0.32, 12, 0.7); sit(g, hashSeed(K.seed, 3 + k), s.object, L.os, cx, yb, { t, red: false }); ui.tag(g, s.label, cx, y0 + ph + 32, { size: F.cap, color: W_ ? P.redInk : P.ink }); }, "settle"); });
        const vx = V === 1 ? cm : w / 2, vy = V === 0 ? 270 : V === 1 ? pyS + L.ph / 2 : pyS - 90, vu = ease.back(seg(t, t0 + 0.7, t0 + 1.2));
        if (vu > 0) { g.save(); g.translate(vx, vy); g.scale(vu, vu); g.beginPath(); g.arc(0, 0, V === 1 ? 40 : 54, 0, 7); ui.fill(g, P.ink); ui.ink(g, 3, P.ink); ui.caption(g, "vs", 0, 2, { size: F.cap, color: P.paper, weight: 800 }); g.restore(); }
        if (V === 1) { const hu = seg(t, t0 + 0.5, t0 + 1.1); g.save(); g.globalAlpha *= hu; for (const x of [cA, cB]) { g.beginPath(); g.moveTo(x - 190, top - 40); g.lineTo(x - 190, top + n * rh + 10); H.line(g, x - 190, top - 40, x - 190, top + n * rh + 10, 1.5, P.hair); } g.restore(); }
        // rows: stripe, label, marks per side
        R.forEach((r, i) => { const ts = t1 - 0.1 + i * 0.38, u = seg(t, ts, ts + 0.4), y = top + i * rh + rh / 2; const su = seg(t, t0 + 0.8 + i * 0.05, t0 + 1.3 + i * 0.05);
          if (su > 0) { g.save(); g.globalAlpha = su; ui.rr(g, bandX0, y - rh / 2 + 6, bandX1 - bandX0, rh - 12, 14); ui.fill(g, i % 2 ? "rgba(233,228,216,.35)" : "rgba(233,228,216,.7)"); g.restore(); }
          if (u <= 0) return; g.save(); g.globalAlpha = Math.min(1, u * 3); if (L.la === "left") { g.save(); g.translate(L.lx, y); ui.caption(g, String(i + 1).padStart(2, "0"), 0, 0, { size: F.small, color: P.mid, weight: 600, align: "left", spacing: 1 }); g.restore(); lab(g, r.label, L.lx + 70 + 260, y, { maxW: 520, color: P.ink2, weight: 700 }); } else lab(g, r.label, L.lx, y, { maxW: V === 2 ? 360 : 480, color: P.ink2, weight: 700 }); g.restore();
          [["a", cA], ["b", cB]].forEach(([sd, cx], k) => { const v = r[sd], uu = seg(t, ts + 0.15 + k * 0.15, ts + 0.6 + k * 0.15); if (uu <= 0) return;
            if (v === true) tick(g, cx, y, 54, uu, win === sd ? P.redInk : P.ink); else if (v === false) cross(g, cx, y, 46, uu, P.mid); else ui.pop(g, uu, cx, y, () => ui.num(g, String(v), 0, 0, { size: F.num * 0.62, color: win === sd ? P.redInk : P.ink })); }); });
        // score row (tallies are counts of ticks: 0 is a real result here, shown as a small axis numeral)
        const ss = seg(t, t1 + n * 0.38 + 0.2, t1 + n * 0.38 + 0.9), sy = top + n * rh + 90; if (ss > 0) { H.line(g, bandX0 + 20, sy - 56, lerp(bandX0 + 20, bandX1 - 20, ease.io(ss)), sy - 56, 3, P.ink2);
          [[sA, cA, "a"], [sB, cB, "b"]].forEach(([v, cx, sd]) => { const W_ = win === sd; ui.pop(g, ss, cx, sy, () => { g.beginPath(); g.arc(0, 0, 50, 0, 7); ui.fill(g, W_ ? P.red : P.paper); ui.ink(g, 4, W_ ? P.redInk : P.ink); ui.num(g, String(v), 0, 2, { size: F.num, color: W_ ? P.paper : P.ink, axis: v === 0 }); }); });
          ui.caption(g, "ticks", V === 1 ? L.lx : cm, sy, { size: F.small, color: P.mid, alpha: ss, align: V === 1 ? "left" : "center" }); }
        if (d.note && ss > 0.5) { const nu = seg(ss, 0.5, 1); ui.pop(g, nu, V === 1 ? L.lx + 300 : cm, sy + 66, () => flag(g, d.note, 0, 0)); }
      },
    };
  },
};
