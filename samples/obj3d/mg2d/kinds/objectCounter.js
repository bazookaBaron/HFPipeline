// kind: objectCounter (family: numbers) - EXEMPLAR for kind builders.
// A big rolling number beside a growing field of generated objects (each object = one unit of the key), a unit key, and a leader note.
// Everything is generated from data + seed (SH shape grammar); nothing is a stored drawing.
// data: { value: 23, unit: "million barrels", per: "a day", object: "barrel" (any SH generator or semantic word), each: 1 (value per object),
//         cap: "Oil through Malacca", note: "more than any other strait" (optional leader note), redIndex: 0 (which object is red, -1 none) }
// focus ids: "count" (number + objects), "key" (unit key + note)
import { rng as mkRng } from "../core.js";
export default {
  name: "objectCounter", family: "numbers",
  doc: "Big rolling number + a field of generated objects encoding the quantity, unit key and a leader note.",
  example: [{ value: 23, unit: "million barrels", per: "a day", object: "barrel", each: 1, cap: "Oil through the strait", note: "most of any strait", redIndex: 0 },
            { value: 369, unit: "ships", object: "containerShip", each: 9, cap: "Queue at Suez", note: "after six days", redIndex: 0 }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp, sh: SH } = K, r = K.rng, rng = mkRng;
    const n = Math.max(1, Math.round(d.value / (d.each || 1))), cols = Math.ceil(Math.sqrt(n * 1.6)), rows = Math.ceil(n / cols);
    const cell = clamp(560 / cols, 46, 120), FW = cols * cell, FH = rows * cell * 0.86;      // object field
    const NW = 520, w = NW + 120 + FW + 80, h = Math.max(FH, 420) + 260;
    const gen = SH[d.object] ? d.object : null;
    const jit = Array.from({ length: n }, () => [r.range(-0.12, 0.12), r.range(-0.1, 0.1), r.range(-0.08, 0.08), Math.floor(r() * 1e6)]);   // per-object variation (seeded)
    const fx = NW + 120, fy = (h - FH) / 2 - 30;
    const drawObj = (g, i, u, t) => { const [jx, jy, rot, sd] = jit[i]; const x = fx + (i % cols + 0.5 + jx) * cell, y = fy + (Math.floor(i / cols) + 0.5 + jy) * cell * 0.86;
      ui.pop(g, u, x, y, () => { g.rotate(rot); const o = { s: cell * 0.78, red: i === d.redIndex, u: 1, t, view: "side" };
        if (gen) SH[gen](g, rng(sd), o); else SH.icon(g, rng(sd), { what: d.object, s: cell * 0.78, red: i === d.redIndex }); }, "settle"); };
    return {
      w, h,
      focus: [{ id: "count", x: 0, y: 0, w: w, h: h - 120 }, { id: "key", x: 0, y: h - 260, w: w * 0.75, h: 260 }],
      draw(g, t, at) {
        const t0 = at.count ?? 0, t1 = at.key ?? t0 + 2.5;
        ui.base(g, w, h, { r: 18 });
        // ---- number: odometer roll from 0 to value, digits settle one by one (left to right)
        const u = ease.out(seg(t, t0, t0 + 1.6)), dec = (String(d.value).split(".")[1] || "").length, v = Math.abs(d.value) < 12 ? d.value : d.value * lerp(0.62, 1, u), s = dec ? v.toFixed(dec) : String(Math.round(v));   /* never reads 0 at its hold: small values land whole, big ones roll up from ~60% */   /* keep the value's own decimals: 4.8 must never read 5 */
        g.save(); g.translate(60, h / 2 - 60);
        ui.num(g, s, 0, 0, { size: F.big * 1.35, align: "left", color: P.ink });
        ui.caption(g, d.unit, 6, 110, { size: F.cap, align: "left", color: P.ink2, weight: 700 });
        if (d.per) ui.caption(g, d.per, 6, 156, { size: F.small, align: "left" });
        // underline that draws under the number as it lands
        g.beginPath(); g.moveTo(0, 60); g.lineTo(lerp(0, NW - 60, ease.io(seg(t, t0 + 0.4, t0 + 1.4))), 60); ui.ink(g, 4, P.red); g.restore();
        // ---- object field: lands in waves, row by row (density: a new object every ~1/n of 1.6 s), ground line + soft field shadow
        g.save(); g.beginPath(); g.moveTo(fx - 20, fy + FH + 18); g.lineTo(lerp(fx - 20, fx + FW + 20, ease.io(seg(t, t0 - 0.2, t0 + 0.5))), fy + FH + 18); ui.ink(g, 2, P.hair); g.restore();
        for (let i = 0; i < n; i++) { const ti = t0 - 0.1 + (i / n) * 1.6; if (t < ti) break; drawObj(g, i, seg(t, ti, ti + 0.45), t); }
        // ---- key: one object = each unit; leader note to the red object
        const kx = 60, ky = h - 150, ku = seg(t, t1 - 0.2, t1 + 0.5);
        ui.pop(g, ku, kx + 40, ky, () => { if (gen) SH[gen](g, rng(jit[0][3]), { s: 64, u: 1, t, view: "side" }); else SH.icon(g, rng(jit[0][3]), { what: d.object, s: 64 }); });
        if (ku > 0.3) ui.caption(g, `= ${d.each || 1} ${d.unit}`, kx + 100, ky, { size: F.cap, align: "left", color: P.ink2, alpha: seg(t, t1, t1 + 0.4) });
        if (d.note && d.redIndex >= 0) { const i = d.redIndex, x = fx + (i % cols + 0.5) * cell, y = fy + (Math.floor(i / cols) + 0.5) * cell * 0.86 - cell * 0.4;
          const lu = seg(t, t1 + 0.3, t1 + 1.1); ui.leader(g, x, y, x + 180, y - 120, lu, P.ink); if (lu > 0.8) ui.tag(g, d.note, x + 180 + 120, y - 120, { rot: -0.02 }); }
        if (d.cap) ui.caption(g, d.cap, w / 2, 46, { size: F.small, color: P.mid });
      },
    };
  },
};
