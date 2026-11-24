// kind: dayNight (family: time) - a 24 h band (night / dawn / day / dusk tints), the sun and moon crossing above it, a red clock cursor, events as vignette cards at their hours.
// data: { events:[{time:6.5 (hours, 0-24), label, what}] (2..8), sunrise:6, sunset:18, cap:"" }
// focus ids: "dawn" (hours ~0-9), "midday" (~8-17), "night" (~15-24)
import { P, F, ease, seg, clamp, lerp, ui, thing, lab, vcard, dot, mk, TAU } from "./_ptu.js";
export default {
  name: "dayNight", family: "time",
  doc: "Day cycle band with stepped palette tints, hour ruler, stars, a travelling sun/moon arc, a red digital cursor and event cards on stems at their hours (two lanes so nothing collides).",
  example: [{ events: [{ time: 5.5, label: "Port wakes", what: "crane" }, { time: 9, label: "Ships dock", what: "containerShip" }, { time: 13, label: "Peak loading", what: "forklift" }, { time: 19, label: "Night shift", what: "truck" }, { time: 23.5, label: "Quiet", what: "lighthouse" }], sunrise: 6, sunset: 18, cap: "A day at the port" },
            { events: [{ time: 7, label: "Commute", what: "car" }, { time: 12, label: "Lunch", what: "grainSack" }, { time: 21, label: "Streaming", what: "laptop" }], sunrise: 6.5, sunset: 19, cap: "Network load" }],
  build(d, K) {
    const E = (d.events || []).slice(0, 8).map(e => ({ ...e, time: clamp(+e.time, 0, 24) })).sort((a, b) => a.time - b.time), sr = d.sunrise ?? 6, ss = d.sunset ?? 18, pxh = 74, X0 = 220, w = X0 * 2 + 24 * pxh, h = 1040, by = 470, bh = 96, HX = hh => X0 + hh * pxh, st = Array.from({ length: 46 }, (_, i) => { const r = mk(i * 3 + 1); return [r.range(0, 24), r.range(-210, 40), r.range(0.4, 1.2), r.range(0, 6)]; });
    const tint = hh => hh < sr - 1 || hh >= ss + 1 ? P.stone2 : hh < sr || hh >= ss ? P.sand2 : P.water;
    const hr = (t, a) => t < a[0] ? 0 : t < a[1] ? lerp(0, 8.5, (t - a[0]) / (a[1] - a[0])) : t < a[2] ? lerp(8.5, 16.5, (t - a[1]) / (a[2] - a[1])) : lerp(16.5, 24, clamp((t - a[2]) / 3.2, 0, 1));
    const fx = (k) => { const x0 = HX(k === 0 ? 0 : k === 1 ? 8 : 15) - 120, x1 = HX(k === 0 ? 9.5 : k === 1 ? 17 : 24) + 120; return { x: clamp(x0, 0, w - (x1 - x0)), y: 100, w: x1 - x0, h: 820 }; };
    return {
      w, h,
      focus: [{ id: "dawn", ...fx(0) }, { id: "midday", ...fx(1) }, { id: "night", ...fx(2) }],
      draw(g, t, at) {
        const a = [at.dawn ?? 0, at.midday ?? 2.6, at.night ?? 5.2], cur = hr(t, a); ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        // sky strip behind the arc (tint blocks per hour), stars at night
        const bu = ease.io(seg(t, a[0] - 0.4, a[0] + 0.8)); g.save(); g.beginPath(); g.rect(HX(0), by - 260, 24 * pxh * bu, 260); g.clip(); for (let k = 0; k < 24; k++) { g.fillStyle = tint(k + 0.5); g.globalAlpha = 0.32; g.fillRect(HX(k), by - 260, pxh + 1, 260); } g.globalAlpha = 1;
        for (const [sx, sy, sz, ph] of st) { const night = sx < sr || sx > ss; if (!night) continue; const tw = 0.5 + 0.5 * Math.sin(t * 2 + ph); g.globalAlpha = 0.35 + 0.5 * tw; g.fillStyle = P.ink2; g.beginPath(); g.arc(HX(sx), by + sy, sz * 2.2, 0, TAU); g.fill(); } g.restore();
        // band + ruler
        g.save(); ui.shadow(g, () => ui.rr(g, HX(0), by, 24 * pxh * bu, bh, 12), 0, 10); g.save(); ui.rr(g, HX(0), by, 24 * pxh * bu, bh, 12); g.clip(); for (let k = 0; k < 24; k++) { g.fillStyle = tint(k + 0.5); g.fillRect(HX(k), by, pxh + 1, bh); } g.restore(); ui.rr(g, HX(0), by, 24 * pxh * bu, bh, 12); ui.ink(g, 3.5, P.ink);
        for (let k = 0; k <= 24; k++) { if (HX(k) > HX(0) + 24 * pxh * bu + 1) break; g.beginPath(); g.moveTo(HX(k), by); g.lineTo(HX(k), by + (k % 6 === 0 ? 22 : 12)); ui.ink(g, 2.5, P.ink); if (k % 3 === 0) ui.num(g, String(k).padStart(2, "0"), HX(k), by + bh - 28, { size: 34, color: P.ink2 }); } g.restore();
        // sun / moon on a shallow arc across the sky above the band
        if (t > a[0] - 0.2) { const al = seg(t, a[0] - 0.2, a[0] + 0.5), day = cur >= sr && cur <= ss, p = day ? (cur - sr) / (ss - sr) : ((cur < sr ? cur + 24 : cur) - ss) / (24 - ss + sr), x = HX(cur), y = by - 70 - 120 * Math.sin(clamp(p, 0, 1) * Math.PI); g.save(); g.globalAlpha *= al; g.translate(x, y); if (day) thing(g, "sun", 55, { s: 130, u: 1, t }); else { g.beginPath(); g.arc(0, 0, 40, 0, TAU); ui.fill(g, P.paper); ui.ink(g, 3.5, P.ink); g.beginPath(); g.arc(14, -6, 34, 0, TAU); ui.fill(g, P.stone2); g.restore(); g.save(); g.globalAlpha *= al; g.translate(x, y); g.beginPath(); g.arc(0, 0, 40, 0, TAU); ui.ink(g, 3.5, P.ink); } g.restore(); }
        // red cursor + digital clock
        if (t > a[0] - 0.2) { const x = HX(cur), hh = Math.floor(cur), mm = Math.floor((cur % 1) * 60); g.save(); g.beginPath(); g.moveTo(x, by - 20); g.lineTo(x, by + bh + 28); ui.ink(g, 5, P.red); g.restore(); ui.pop(g, seg(t, a[0] - 0.2, a[0] + 0.4), x, by + bh + 64, () => ui.num(g, `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, 0, 0, { size: 52, color: P.red })); }
        // events: cards on stems in two lanes below the band, appear as the cursor passes
        E.forEach((e, i) => { const x = HX(e.time), lane = i % 2, u = seg(cur, e.time - 0.2, e.time + 0.6) * (t > a[0] ? 1 : 0), cy = by + bh + 270 + lane * 0; if (u <= 0) return; const y0 = by + bh + (lane ? 150 : 140), cardY = by + bh + (lane ? 400 : 290); g.beginPath(); g.moveTo(x, by + bh); g.lineTo(x, lerp(by + bh, cardY - 130, ease.io(u))); ui.ink(g, 3, P.ink2); dot(g, x, by + bh, 7, P.ink);
          vcard(g, { what: e.what || "container", seed: 4900 + i * 11, x, y: cardY, cw: 250, ch: 230, u, t, s: 130, label: e.label }); const hh = Math.floor(e.time), mm = Math.round((e.time % 1) * 60); ui.num(g, `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, x + 14, by + bh + 36 + (lane ? 0 : 0) + 0, { size: 0.001, color: P.ink }); });
      },
    };
  },
};
