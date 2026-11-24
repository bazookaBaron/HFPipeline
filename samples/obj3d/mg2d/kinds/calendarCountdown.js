// kind: calendarCountdown (family: time) - a wall calendar whose pages tear off one by one while a day counter counts down; torn pages pile up, a context object waits on a progress bar.
// data: { days:14, startDay:1 (date number on the first page), month:"MAR", label:"days to go", what:"containerShip" (context object), cap:"", tally:true }
// focus ids: "calendar" (page + the torn pile), "counter" (big countdown + context object + progress)
import { P, F, ease, seg, clamp, lerp, ui, thing, lab, mk, TAU } from "./_ptu.js";
export default {
  name: "calendarCountdown", family: "time",
  doc: "Wall calendar page with rings, pages tearing off at a pace solved from the day count, a growing pile of torn pages, tally marks, a red remaining-days counter and a context object creeping along a bar.",
  example: [{ days: 14, startDay: 1, month: "MAR", label: "days to go", what: "containerShip", cap: "Waiting on a deadline" },
            { days: 28, startDay: 3, month: "OCT", label: "days left", what: "ballot", cap: "Campaign countdown" }],
  build(d, K) {
    const D = clamp(Math.round(d.days ?? 14), 2, 60), w = 1700, h = 900, px = 470, py = 410, pw = 430, ph = 500, iv = clamp(3.8 / Math.min(D, 30), 0.11, 0.5), sd = Array.from({ length: D }, (_, i) => { const r = mk(i * 7 + 5); return [r.range(-22, 22), r.range(-16, 16), r.range(-0.5, 0.5), r.range(0.8, 1.2)]; });
    const page = (g, day, o = {}) => { g.save(); ui.shadow(g, () => ui.rr(g, -pw / 2, -ph / 2, pw, ph, 14), 6, 12, o.sh ?? 1); ui.rr(g, -pw / 2, -ph / 2, pw, ph, 14); ui.fill(g, P.paper); ui.ink(g, 3.5, P.ink); ui.rr(g, -pw / 2, -ph / 2, pw, 118, 14); ui.fill(g, o.red ? P.red : P.ink); g.beginPath(); g.rect(-pw / 2, -ph / 2 + 70, pw, 48); g.fillStyle = o.red ? P.red : P.ink; g.fill(); g.beginPath(); g.rect(-pw / 2, -ph / 2 + 118, pw, 2); g.fillStyle = P.ink; g.fill();
      ui.caption(g, d.month || "DAY", 0, -ph / 2 + 60, { size: 54, color: "#fff", weight: 800, spacing: 6 }); ui.num(g, String(day), 0, 20, { size: 240, color: P.ink }); for (const k of [-1, 0, 1]) { g.beginPath(); g.arc(k * 120, -ph / 2 + 4, 15, 0, TAU); ui.fill(g, P.paper2); ui.ink(g, 3, P.ink); } g.restore(); };
    return {
      w, h,
      focus: [{ id: "calendar", x: 20, y: 90, w: 1000, h: 790 }, { id: "counter", x: 760, y: 120, w: 920, h: 700 }],
      draw(g, t, at) {
        const a0 = at.calendar ?? 0, a1 = at.counter ?? a0 + 2.8; ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        const flipped = clamp(Math.floor((t - (a0 + 0.4)) / iv), 0, D), fr = clamp(((t - (a0 + 0.4)) / iv) % 1, 0, 1), flipping = t >= a0 + 0.4 && flipped < D;
        // floor + pile of torn pages (settled ones)
        g.beginPath(); g.moveTo(60, py + 330); g.lineTo(lerp(60, 960, ease.io(seg(t, a0 - 0.3, a0 + 0.6))), py + 330); ui.ink(g, 3, P.hair);
        for (let i = 0; i < flipped; i++) { const s = sd[i], x = 800 + s[0] * 2.2, y = py + 300 - Math.min(i, 24) * 3 + s[1]; g.save(); g.translate(x, y); g.rotate(s[2] * 0.5); g.scale(0.32 * s[3], 0.2 * s[3]); ui.rr(g, -pw / 2, -ph / 2, pw, ph, 14); ui.fill(g, i % 2 ? P.paper2 : P.paper); ui.ink(g, 8, P.ink2); g.restore(); }
        const u = seg(t, a0 - 0.2, a0 + 0.5);
        ui.pop(g, u, px, py, () => { const day = (d.startDay ?? 1) + Math.min(flipped, D - 1), last = flipped >= D - 1;
          if (flipped < D - 1) { g.save(); g.translate(8, 8); g.scale(0.985, 0.985); page(g, day + 1, { sh: 0.4 }); g.restore(); }
          // the torn page: hinges up at its top edge then falls away
          if (flipping && flipped < D) { const f = ease.io(fr), ang = -f * 1.4, fall = f * f * 520; g.save(); g.translate(0, -ph / 2); g.rotate(ang * 0.35); g.translate(f * 40, fall - 0 + ph / 2); g.globalAlpha *= 1 - Math.max(0, (f - 0.7) / 0.3); page(g, day, { red: last }); g.restore(); } else if (!flipping || flipped >= D) page(g, day, { red: last }); });
        // counter column
        const rem = D - flipped, cu = seg(t, a1 - 0.2, a1 + 0.6), show = t > a0 + 0.4;
        ui.pop(g, Math.max(cu, 0), 1260, 300, () => { ui.num(g, String(show ? rem : D), 0, 0, { size: F.big * 2, color: P.red }); lab(g, d.label || "days to go", 0, 130, { size: F.cap, maxW: 460, color: P.ink2 }); });
        // tally marks (groups of five) under the counter
        const tl = flipped, gx0 = 1010, gy0 = 520; for (let i = 0; i < Math.min(tl, 60); i++) { const gi = Math.floor(i / 5), k = i % 5, bx = gx0 + (gi % 6) * 105, by = gy0 + Math.floor(gi / 6) * 56; g.beginPath(); if (k < 4) { g.moveTo(bx + k * 14, by); g.lineTo(bx + k * 14, by + 40); } else { g.moveTo(bx - 8, by + 34); g.lineTo(bx + 56, by + 6); } ui.ink(g, 4, k === 4 ? P.ink : P.ink2); }
        // context object travelling along a progress bar
        const bx0 = 1000, bx1 = 1600, by = 700, prog = D > 0 ? flipped / D : 0; if (t > a1 - 0.1) { const q = seg(t, a1 - 0.1, a1 + 0.5); g.save(); g.globalAlpha *= q; g.beginPath(); g.moveTo(bx0, by); g.lineTo(bx1, by); ui.ink(g, 5, P.hair); g.beginPath(); g.moveTo(bx0, by); g.lineTo(lerp(bx0, bx1, prog), by); ui.ink(g, 6, P.ink); for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(lerp(bx0, bx1, k / 4), by - 8); g.lineTo(lerp(bx0, bx1, k / 4), by + 12); ui.ink(g, 2.5, P.ink2); }
          g.save(); g.translate(lerp(bx0, bx1, prog) , by - 62); thing(g, d.what || "container", 77, { s: 150, u: 1, t }); g.restore(); g.restore(); }
      },
    };
  },
};
