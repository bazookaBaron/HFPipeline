// kind: shareRing (family: numbers) - a donut / share ring that sweeps round slice by slice, a generated object in the hole, a % tick ring around it,
// labelled slices with leaders. The red slice pulls out of the ring.
// data: { slices: [{ label, value }, ...] (2..7), object: "oil" (any SH name or word, drawn in the centre), unit: "of world oil" (small caption under the centre object), cap: "...",
//         redIndex: (default = largest), note: "one slice in five" (optional tag on the red slice) }
// focus ids: "ring" (whole ring + labels), "slice" (the red slice pulled out, with label)
import * as H from "./_h_numcmp.js";
export default {
  name: "shareRing", family: "numbers",
  doc: "Donut/share ring sweeping in slice by slice with % tick ring, centre object, labelled slices and a pulled-out red slice.",
  example: [{ slices: [{ label: "Middle East", value: 31 }, { label: "North America", value: 24 }, { label: "Russia", value: 13 }, { label: "Asia", value: 9 }, { label: "Other", value: 23 }], object: "oil", unit: "of world supply", cap: "Who pumps the crude", redIndex: 0, note: "nearly a third" },
            { slices: [{ label: "Paid", value: 46 }, { label: "Free", value: 38 }, { label: "Trial", value: 16 }], object: "phone", cap: "App users by plan", redIndex: 1 }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { fmt, lab, sit, measure, obj, flag, line, hashSeed, spread, tints } = H;
    const S = d.slices.slice(0, 7), n = S.length, tot = S.reduce((a, s) => a + s.value, 0), red = d.redIndex ?? S.findIndex(s => s.value === Math.max(...S.map(q => q.value)));
    const w = 1700, h = 900, cx = w / 2, cy = 470, R = 290, r0 = 172, GAP = 0.022, TAU = Math.PI * 2;
    let a0 = -Math.PI / 2; const A = S.map((s, i) => { const span = s.value / tot * TAU, o = { a0, a1: a0 + span, mid: a0 + span / 2, pct: s.value / tot * 100 }; a0 += span; return o; });
    const cols = [P.stone2, P.water2, P.sand2, P.hair, P.stone, P.water], colOf = i => i === red ? P.red : cols[(i - (i > red ? 1 : 0)) % cols.length];
    const lx = i => cx + Math.sign(Math.cos(A[i].mid) || 1) * (R + 120);
    const ysL = {}; for (const sd of [-1, 1]) { const ids = A.map((a, i) => i).filter(i => Math.sign(Math.cos(A[i].mid) || 1) === sd), ys = spread(ids.map(i => cy + Math.sin(A[i].mid) * (R + 40)), 110, 160, h - 110); ids.forEach((i, k) => ysL[i] = ys[k]); }
    const arc = (g, a0, a1, ro, ri, ox = 0, oy = 0) => { g.beginPath(); g.arc(cx + ox, cy + oy, ro, a0, a1); g.arc(cx + ox, cy + oy, ri, a1, a0, true); g.closePath(); };
    return {
      w, h, focus: [{ id: "ring", x: 20, y: 90, w: w - 40, h: h - 110 }, { id: "slice", x: clamp(cx + Math.cos(A[red].mid) * R * 0.6 - 480, 20, w - 980), y: clamp(cy + Math.sin(A[red].mid) * R * 0.6 - 330, 60, h - 700), w: 960, h: 660 }],
      draw(g, t, at) {
        const t0 = at.ring ?? 0, t1 = at.slice ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        // tick ring: 100 ticks, majors every 25, drawn around
        const tu = ease.io(seg(t, t0 - 0.2, t0 + 0.9)); for (let i = 0; i < 100 * tu; i++) { const a = -Math.PI / 2 + i / 100 * TAU, mj = i % 25 === 0, mn = i % 5 === 0, ro = R + 16, ri = R + 16 + (mj ? 26 : mn ? 16 : 8); g.beginPath(); g.moveTo(cx + Math.cos(a) * ro, cy + Math.sin(a) * ro); g.lineTo(cx + Math.cos(a) * ri, cy + Math.sin(a) * ri); ui.ink(g, mj ? 3 : 1.8, mj ? P.ink : P.mid); }
        // soft ring shadow + hole
        ui.shadow(g, () => { g.beginPath(); g.arc(cx, cy, R, 0, 7); }, 6, 14, tu);
        const sweep = ease.io5(seg(t, t0 + 0.1, t0 + 2.0)) * TAU - Math.PI / 2, ex = ease.back(seg(t, t1 - 0.1, t1 + 0.6));
        for (let i = 0; i < n; i++) { const a = A[i]; if (sweep <= a.a0 + GAP) continue; const e = Math.min(a.a1 - GAP, sweep), R_ = i === red, off = R_ ? ex * 30 : 0, ox = Math.cos(a.mid) * off, oy = Math.sin(a.mid) * off;
          g.save(); arc(g, a.a0 + GAP, e, R, r0, ox, oy); ui.fill(g, colOf(i)); g.save(); g.clip(); const gr = g.createRadialGradient(cx + ox, cy + oy, r0, cx + ox, cy + oy, R); gr.addColorStop(0, "rgba(43,42,39,.16)"); gr.addColorStop(0.25, "rgba(43,42,39,0)"); gr.addColorStop(1, "rgba(255,255,255,.12)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
          if (!R_) { g.strokeStyle = "rgba(43,42,39,.15)"; g.lineWidth = 2; for (let x = -h; x < w + h; x += 18) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); } } g.restore(); arc(g, a.a0 + GAP, e, R, r0, ox, oy); ui.ink(g, 3.5, R_ ? P.redInk : P.ink); g.restore(); }
        // centre disc + object
        const cu = ease.back(seg(t, t0 + 0.3, t0 + 1.0)); g.save(); g.translate(cx, cy); g.scale(cu, cu); g.beginPath(); g.arc(0, 0, r0 - 16, 0, 7); ui.shadow(g, () => { g.beginPath(); g.arc(0, 0, r0 - 16, 0, 7); }, 3, 8); g.beginPath(); g.arc(0, 0, r0 - 16, 0, 7); ui.fill(g, P.paper2); ui.ink(g, 3, P.ink2);
        g.beginPath(); g.arc(0, 0, r0 - 38, 0, 7); ui.ink(g, 1.5, P.hair); g.translate(0, Math.sin(t * 1.6) * 3 - (d.unit ? 14 : 0)); const m = measure(d.object || "container", 4), s = Math.min((r0 - 70) * 1.9 / (Math.max(m.w, m.h) / 100) / 1.9 * 1.9, 220); sit(g, hashSeed(K.seed, 77), d.object || "container", Math.min(s, 200), 0, m.h * Math.min(s, 200) / 200, { t }); g.restore();
        if (d.unit) ui.caption(g, d.unit, cx, cy + r0 - 70, { size: F.small, color: P.mid, alpha: cu });
        // labels
        for (let i = 0; i < n; i++) { const a = A[i], ls = seg(t, t0 + 1.4 + i * 0.22, t0 + 2.0 + i * 0.22), R_ = i === red, sd = Math.sign(Math.cos(a.mid) || 1), off = R_ ? ex * 30 : 0, px = cx + Math.cos(a.mid) * (R + off), py = cy + Math.sin(a.mid) * (R + off), x1 = lx(i), y1 = ysL[i]; if (ls <= 0) continue;
          g.save(); g.globalAlpha = Math.min(1, ls * 2); ui.leader(g, px, py, x1 - sd * 10, y1, ls, R_ ? P.red : P.ink); g.restore();
          if (ls > 0.7) { const al = seg(ls, 0.7, 1); lab(g, S[i].label, x1 + sd * 6, y1 - 22, { maxW: 300, color: R_ ? P.redInk : P.ink2, alpha: al, weight: R_ ? 800 : 600, base: "middle" }); ui.num(g, fmt(a.pct, a.pct < 10 ? 1 : 0) + "%", x1 + sd * 6, y1 + 30, { size: F.num * 0.85, color: R_ ? P.red : P.ink, alpha: al }); } }
        if (d.note) { const nu = seg(t, t1 + 0.6, t1 + 1.3); if (nu > 0) ui.pop(g, nu, cx + Math.cos(A[red].mid) * (R + 30 + 30) * 0.74 * 0 + clamp(cx + Math.cos(A[red].mid) * (R * 0.5), 360, w - 360), clamp(cy + Math.sin(A[red].mid) * (R + 100), 150, h - 70) + (Math.sin(A[red].mid) > 0 ? 70 : -70), () => flag(g, d.note, 0, 0, { red: false })); }
      },
    };
  },
};
