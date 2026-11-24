// kind: thermoScale (family: numbers) - a vertical thermometer / level scale: glass tube + bulb, red liquid that rises to the value, tick scale with numerals,
// marker lines (thresholds) across to labelled tags, a live readout and an optional context object.
// data: { value: 41, min: -20, max: 60, unit: "°C", markers: [{ at: 0, label: "Freezing" }, { at: 35, label: "Heat stress" }, ...], cap: "...", object: "building" (optional), note: "hottest on record" (optional) }
// focus ids: "tube" (tube + scale + rising liquid), "markers" (threshold lines + tags + note)
import * as H from "./_h_numcmp.js";
export default {
  name: "thermoScale", family: "numbers",
  doc: "Vertical thermometer/level scale with rising red liquid, tick numerals, threshold marker lines with tags and a live readout.",
  example: [{ value: 41, min: -20, max: 60, unit: "°C", markers: [{ at: 0, label: "Freezing" }, { at: 27, label: "Comfortable" }, { at: 35, label: "Heat stress" }, { at: 50, label: "Lethal in hours" }], cap: "Street temperature, July", note: "7 above the old record", object: "building" },
            { value: 7.2, min: 0, max: 10, unit: "m", markers: [{ at: 3, label: "Flood stage" }, { at: 6, label: "Levee top" }], cap: "River level", object: "bridge" }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { fmt, lab, sit, line, flag, tw, nice, hashSeed, ell, ground, dash } = H;
    const mn = d.min ?? 0, mx = d.max ?? 100, val = d.value, w = 1600, h = 920, tx = 520, ty0 = 150, TH = 560, yb = ty0 + TH, bulbR = 74, tubeW = 64, Y = v => yb - clamp((v - mn) / (mx - mn), 0, 1) * TH, ax = nice(mx - mn, 8), M = (d.markers ?? []).slice(0, 6);
    const ticks = []; for (let v = Math.ceil(mn / ax.step - 1e-9) * ax.step; v <= mx + 1e-9; v += ax.step) ticks.push(+v.toFixed(6));
    const mtags = M.map(m => ({ ...m, y: Y(m.at) })); { const ys = H.spread(mtags.map(m => m.y), 78, ty0 + 10, yb); mtags.forEach((m, i) => m.ty = ys[i]); }
    const hot = M.length ? M.map((m, i) => i).filter(i => M[i].at <= val).pop() : -1;
    return {
      w, h, focus: [{ id: "tube", x: 150, y: 90, w: 900, h: 800 }, { id: "markers", x: 380, y: 100, w: 1160, h: 780 }],
      draw(g, t, at) {
        const t0 = at.tube ?? 0, t1 = at.markers ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        // glass: tube + bulb (one path), highlight, inner scale
        const gu = ease.back(seg(t, t0 - 0.2, t0 + 0.6)); g.save(); g.translate(tx, 0); g.scale(gu, gu); g.translate(0, (1 - gu) * 60);
        const glass = () => { g.beginPath(); g.moveTo(-tubeW / 2, ty0 + tubeW / 2); g.arc(0, ty0 + tubeW / 2, tubeW / 2, Math.PI, 0); g.lineTo(tubeW / 2, yb + 20); g.arc(0, yb + bulbR - 8, bulbR, -Math.acos((tubeW / 2) / bulbR) - Math.PI / 2 + Math.PI / 2 - 0.0 + 0, Math.PI * 2 + 0, false); g.closePath(); };
        const gp = () => { g.beginPath(); g.moveTo(-tubeW / 2, ty0 + tubeW / 2); g.arc(0, ty0 + tubeW / 2, tubeW / 2, Math.PI, 0); const a = Math.asin((tubeW / 2) / bulbR), by = yb + bulbR + 4; g.lineTo(tubeW / 2, by - Math.cos(a) * bulbR); g.arc(0, by, bulbR, -Math.PI / 2 + a, -Math.PI / 2 - a + Math.PI * 2, false); g.closePath(); };
        ui.shadow(g, gp, 10, 16); gp(); ui.fill(g, "rgba(207,222,227,.55)"); ui.ink(g, 4.5, P.ink);
        // liquid: rises with a damped settle; bulb always full
        const lu = ease.settle(seg(t, t0 + 0.5, t0 + 2.2)), top = lerp(yb, Y(val), lu), by = yb + bulbR + 4; g.save(); gp(); g.clip();
        g.beginPath(); g.rect(-tubeW / 2 + 12, Math.min(top, yb + 6), tubeW - 24, yb + 6 - Math.min(top, yb + 6) + 10); g.arc(0, by, bulbR - 12, 0, 7); g.fillStyle = P.red; g.fill();
        g.fillStyle = "rgba(255,255,255,.28)"; g.fillRect(-tubeW / 2 + 16, Math.min(top, yb), 8, yb - Math.min(top, yb)); g.beginPath(); g.arc(-22, by - 14, 14, 0, 7); g.fill(); g.restore();
        gp(); ui.ink(g, 4.5, P.ink); g.beginPath(); g.moveTo(-tubeW / 2 + 8, ty0 + 20); g.lineTo(-tubeW / 2 + 8, yb - 10); ui.ink(g, 3, "rgba(255,255,255,.8)"); g.restore();
        // scale: ticks + numerals to the right of the tube
        const su = seg(t, t0 + 0.2, t0 + 1.1); ticks.forEach((v, i) => { const uu = seg(su, i / (ticks.length + 1), 1); if (uu <= 0) return; g.save(); g.globalAlpha = uu; line(g, tx + 52, Y(v), tx + 86, Y(v), 3, P.ink); for (let k = 1; k < 5; k++) { const v2 = v + ax.step * k / 5; if (v2 <= mx + 1e-9) line(g, tx + 52, Y(v2), tx + 70, Y(v2), 1.8, P.mid); }
          ui.caption(g, fmt(v), tx + 100, Y(v), { size: F.small, align: "left", caps: false, spacing: 0, color: P.ink2 }); g.restore(); });
        // live readout riding the liquid top (left)
        const cur = lerp(mn, val, lu); if (lu > 0.02) { g.save(); line(g, tx - 40, top, tx - 150, top, 3, P.red); g.restore(); ui.num(g, fmt(cur, mx - mn < 20 ? 1 : 0), tx - 170, top - 6, { size: F.num, align: "right", color: P.red }); if (d.unit) ui.caption(g, d.unit, tx - 170, top + 42, { size: F.small, align: "right", color: P.mid, caps: false, spacing: 0 }); }
        // markers: dashed line out to the right + tag; the reached one is highlighted
        mtags.forEach((m, i) => { const ms = seg(t, t1 - 0.1 + i * 0.4, t1 + 0.5 + i * 0.4); if (ms <= 0) return; const R_ = i === hot, x0 = tx + 160, x1 = 960;
          dash(g, x0, m.y, x1, m.y, ease.io(ms), R_ ? P.red : P.mid, R_ ? 3.5 : 2.5, [10, 7]); if (ms > 0.5) { const k = seg(ms, 0.5, 1); ui.pop(g, k, 1040, m.ty, () => ui.tag(g, m.label, 0, 0, { color: R_ ? P.redInk : P.ink, rot: 0.01 })); if (Math.abs(m.ty - m.y) > 3) line(g, x1, m.y, 960 + 24, m.ty, 2, P.mid); } g.beginPath(); g.arc(tx + 36, m.y, 7, 0, 7); ui.fill(g, R_ ? P.red : P.paper); ui.ink(g, 3, R_ ? P.redInk : P.ink); });
        // object + note
        if (d.object) { const ou = seg(t, t1 + 0.4, t1 + 1.2); if (ou > 0) { ground(g, 1180, 1520, 800, ou); ui.pop(g, ou, 1350, 800, () => { ell(g, 0, 4, 100, 11, 0.7); sit(g, hashSeed(K.seed, 8), d.object, 250, 0, 0, { t }); }, "settle"); } }
        if (d.note) { const nu = seg(t, t1 + 0.9, t1 + 1.6); if (nu > 0) ui.pop(g, nu, 1350, 230, () => flag(g, d.note, 0, 0, { red: true })); }
      },
    };
  },
};
