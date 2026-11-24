// kind: splitFlapDate (family: time) - a split-flap board: every character cell flips through its alphabet down to the target; a generated context object waits below.
// data: { text:"14 JUN 2031" (digits/letters; spaces separate groups), groups:["DAY","MONTH","YEAR"] (optional group captions), what:"containerShip" (context object), label:"expected arrival", cap:"" }
// focus ids: "board" (the flap display), "context" (object + label)
import { P, F, ease, seg, clamp, lerp, ui, thing, lab, TAU } from "./_ptu.js";
const DIG = "0123456789", ALP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export default {
  name: "splitFlapDate", family: "time",
  doc: "Mechanical split-flap cells (hinge, axle pins, top/bottom halves, flap that falls through scaleY) cycling digits/letters to the target text with staggered timing; group captions; context vignette on a shelf.",
  example: [{ text: "14 JUN 2031", groups: ["DAY", "MONTH", "YEAR"], what: "containerShip", label: "expected arrival", cap: "The new date" },
            { text: "0 DAYS", groups: ["", "LEFT"], what: "clockFace", label: "until the deadline", cap: "Out of time" }],
  build(d, K) {
    const txt = String(d.text ?? "2031").toUpperCase().slice(0, 14), chars = [...txt], nCell = chars.filter(c => c !== " ").length, nGap = chars.filter(c => c === " ").length, cw = clamp((1500 - nGap * 70) / Math.max(1, nCell) - 14, 80, 140), ch = cw * 1.5, gap = 14, sp = 70;
    const totW = nCell * (cw + gap) + nGap * sp, w = Math.max(1700, totW + 360), h = 900, bx0 = (w - totW) / 2, by = 300;
    const cells = []; let x = bx0, gi = 0; chars.forEach(c => { if (c === " ") { x += sp; gi++; return; } cells.push({ c, x, gi, last: false }); x += cw + gap; }); if (cells.length) cells[cells.length - 1].last = true;
    const seqOf = c => DIG.includes(c) ? DIG : ALP.includes(c) ? ALP : null;
    const charAt = (c, k) => { const q = seqOf(c); if (!q) return c; const i = q.indexOf(c); return q[((i + k) % q.length + q.length) % q.length]; };
    const cell = (g, cx, cy, cur, nxt, f, red) => { const hw = cw / 2, hh = ch / 2, glyph = (ch2, c2) => ui.num(g, ch2, 0, ch * 0.03, { size: ch * 0.78, color: c2 ?? "#f4efe2", spacing: 0 });
      ui.shadow(g, () => ui.rr(g, cx - hw - 6, cy - hh - 6, cw + 12, ch + 12, 12), 3, 8); ui.rr(g, cx - hw - 6, cy - hh - 6, cw + 12, ch + 12, 12); ui.fill(g, P.ink); ui.ink(g, 2, "#000");
      const half = (top, chr, sy = 1, tint) => { g.save(); g.translate(cx, cy); ui.rr(g, -hw, top ? -hh : 1, cw, hh - 1, 7); g.clip(); g.fillStyle = tint ?? P.ink2; g.fillRect(-hw, top ? -hh : 0, cw, hh); g.save(); g.translate(0, 0); g.scale(1, 1); glyph(chr, red ? P.red2 : undefined); g.restore(); g.restore(); };
      half(true, nxt); half(false, f < 0.5 ? cur : cur);
      if (f > 0 && f < 1) { if (f < 0.5) { const k = 1 - f * 2; g.save(); g.translate(cx, cy); g.scale(1, Math.max(0.001, k)); g.translate(-cx, -cy); half(true, cur, 1, "#57544d"); g.restore(); } else { const k = (f - 0.5) * 2; g.save(); g.translate(cx, cy); g.scale(1, Math.max(0.001, k)); g.translate(-cx, -cy); half(false, nxt, 1, "#57544d"); g.restore(); } }
      g.beginPath(); g.moveTo(cx - hw, cy); g.lineTo(cx + hw, cy); ui.ink(g, 3, "#14130f"); for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * (hw + 1), cy, 4, 0, TAU); ui.fill(g, P.mid); } };
    return {
      w, h,
      focus: [{ id: "board", x: Math.max(0, bx0 - 160), y: by - 200, w: Math.min(w, totW + 320), h: 500 }, { id: "context", x: w / 2 - 560, y: 430, w: 1120, h: 440 }],
      draw(g, t, at) {
        const a0 = at.board ?? 0, a1 = at.context ?? a0 + 2.8; ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        // board frame: header strip + rail, with group captions
        const fu = ease.out(seg(t, a0 - 0.3, a0 + 0.6)); g.save(); g.globalAlpha *= Math.min(1, fu * 2); ui.shadow(g, () => ui.rr(g, bx0 - 50, by - ch / 2 - 60, totW + 100 - (cells.length ? 0 : 0), ch + 130, 22), 6, 14); ui.rr(g, bx0 - 50, by - ch / 2 - 60, totW + 100, ch + 130, 22); ui.fill(g, P.stone2); ui.ink(g, 4, P.ink); ui.rr(g, bx0 - 34, by - ch / 2 - 44, totW + 68, ch + 98, 14); ui.ink(g, 2, P.ink2); g.restore();
        if (d.groups) { let gx = {}; cells.forEach(c => { gx[c.gi] = gx[c.gi] || [c.x, c.x + cw]; gx[c.gi][1] = c.x + cw; }); Object.keys(gx).forEach(k => { const lbl = d.groups[+k]; if (lbl) ui.caption(g, lbl, (gx[k][0] + gx[k][1]) / 2, by + ch / 2 + 40, { size: F.small, color: P.ink2, alpha: seg(t, a0 + 0.4, a0 + 0.9), weight: 800 }); }); }
        cells.forEach((c, i) => { const ts = a0 + 0.2 + i * 0.13, steps = 8 + (i * 5) % 7, st = 0.085, k = (t - ts) / st; let cur, nxt, f; const q = seqOf(c.c); if (!q) { cur = nxt = c.c; f = 0; } else if (k < 0) { cur = nxt = charAt(c.c, -steps); f = 0; } else if (k >= steps) { cur = nxt = c.c; f = 0; } else { const s = Math.floor(k); f = k - s; cur = charAt(c.c, -steps + s); nxt = charAt(c.c, -steps + s + 1); }
          const done = k >= steps, bump = done ? Math.max(0, 1 - (k - steps) * 0.5) * Math.sin((k - steps) * 6) * 4 : 0; cell(g, c.x + cw / 2, by + bump, cur, nxt, f, c.last && done); });
        // context: object on a shelf with a leader + tag
        const cu = seg(t, a1 - 0.2, a1 + 0.6), sy = 720; g.beginPath(); g.moveTo(w / 2 - 520, sy + 60); g.lineTo(lerp(w / 2 - 520, w / 2 + 520, ease.io(cu)), sy + 60); ui.ink(g, 4, P.ink2);
        if (cu > 0) { ui.pop(g, cu, w / 2 - 200, sy - 60, () => thing(g, d.what || "container", 6, { s: 330, u: 1, t })); if (d.label && cu > 0.6) { const q = seg(t, a1 + 0.3, a1 + 0.9); ui.leader(g, w / 2 - 20, sy - 50, w / 2 + 160, sy - 130, q); if (q > 0.8) ui.tag(g, d.label, w / 2 + 160 + 150, sy - 130, { rot: 0.02 }); } }
      },
    };
  },
};
