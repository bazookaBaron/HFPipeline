// kind: ganttBars (family: time) - tasks as bars over a time axis; labelled rows with icons, dependency elbows, a moving "today" line, one red critical bar.
// data: { tasks:[{label, start, end, what}] (2..9), from:(default min start), to:(default max end), unit:"wk", cap:"", redIndex:0 (critical bar) }
// focus ids: "axis" (header + first rows), "bars" (whole chart), "end" (last rows + finish)
import { P, F, ease, seg, clamp, lerp, ui, thing, lab, num } from "./_ptu.js";
export default {
  name: "ganttBars", family: "time",
  doc: "Gantt chart generated from start/end values: axis ticks with numerals, tinted hatched bars growing left to right, icon+label rows, elbow dependencies, a sweeping today line, duration numerals.",
  example: [{ tasks: [{ label: "Design", start: 0, end: 3, what: "laptop" }, { label: "Permits", start: 2, end: 8, what: "documentPage" }, { label: "Build", start: 6, end: 16, what: "crane" }, { label: "Fit-out", start: 14, end: 20, what: "forklift" }, { label: "Open", start: 20, end: 21, what: "building" }], unit: "wk", cap: "Why a project slips", redIndex: 1 },
            { tasks: [{ label: "Order chips", start: 0, end: 4, what: "chip" }, { label: "Ship them", start: 4, end: 10, what: "containerShip" }, { label: "Assemble", start: 10, end: 13, what: "phone" }], unit: "wk", cap: "Supply chain", redIndex: 1 }],
  build(d, K) {
    const T = (d.tasks || []).slice(0, 9).map(t => ({ ...t, start: +t.start, end: +t.end })), n = Math.max(2, T.length), t0 = d.from ?? Math.min(...T.map(t => t.start)), t1 = d.to ?? Math.max(...T.map(t => t.end)), span = Math.max(1, t1 - t0);
    const w = 1800, pitch = clamp(660 / n, 78, 110), top = 230, h = top + n * pitch + 130, cx0 = 520, cx1 = w - 120, TX = v => lerp(cx0, cx1, (v - t0) / span), bh = Math.min(46, pitch * 0.55), red = d.redIndex ?? 0, steps = [1, 2, 5, 10, 20, 50, 100], step = steps.find(s => span / s <= 14) ?? 100;
    const grp = i => Math.min(2, Math.floor(i * 3 / n)), tints = [P.water2, P.sand2, P.stone2];
    return {
      w, h,
      focus: [{ id: "axis", x: 20, y: 80, w: 1300, h: Math.min(h - 100, top + pitch * Math.ceil(n / 3) + 120) }, { id: "bars", x: 20, y: 80, w: 1740, h: h - 100 }, { id: "end", x: 400, y: Math.max(80, h - (pitch * Math.ceil(n / 2) + 330)), w: 1360, h: Math.min(h - 100, pitch * Math.ceil(n / 2) + 330) }],
      draw(g, t, at) {
        const a = [at.axis ?? 0, at.bars ?? 2.6, at.end ?? 5.2], tk = i => a[grp(i)] - 0.1 + (i - T.findIndex((_, q) => grp(q) === grp(i))) * 0.35; ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        // axis
        const au = ease.io(seg(t, a[0] - 0.3, a[0] + 0.7)); g.save(); g.beginPath(); g.moveTo(cx0, top - 40); g.lineTo(lerp(cx0, cx1, au), top - 40); ui.ink(g, 3.5, P.ink); for (let v = Math.ceil(t0 / step) * step; v <= t1; v += step) { const x = TX(v); if (x > lerp(cx0, cx1, au) + 1) break; g.beginPath(); g.moveTo(x, top - 40); g.lineTo(x, top - 28); ui.ink(g, 2.5, P.ink); g.beginPath(); g.moveTo(x, top - 28); g.lineTo(x, h - 120); g.setLineDash([3, 12]); ui.ink(g, 1.5, P.hair); g.setLineDash([]); ui.num(g, String(v), x, top - 74, { size: 34, color: P.ink2 }); } g.restore(); ui.caption(g, d.unit || "", cx0 - 90, top - 74, { size: F.small, color: P.mid });
        // rows
        T.forEach((task, i) => { const ta = tk(i), u = seg(t, ta, ta + 0.5), y = top + i * pitch + pitch / 2, isRed = i === red; if (u <= 0) return;
          g.save(); g.globalAlpha *= u; if (i % 2 === 0) { g.fillStyle = "rgba(226,221,209,.35)"; g.fillRect(40, y - pitch / 2, w - 80, pitch); } g.restore();
          g.save(); g.globalAlpha *= u; g.translate(86, y); thing(g, task.what || "container", 4300 + i * 7, { s: Math.min(78, pitch * 0.85), u: 1, t }); g.restore(); lab(g, task.label || "", 140, y, { align: "left", maxW: 330, size: F.small, alpha: u, color: isRed ? P.redInk : P.ink2 });
          const bu = ease.io(seg(t, ta + 0.2, ta + 0.9)), x0 = TX(task.start), x1 = TX(task.end), bw = Math.max(14, (x1 - x0)) * bu; if (bu > 0) { g.save(); ui.shadow(g, () => ui.rr(g, x0, y - bh / 2, bw, bh, 9), 2, 5); ui.rr(g, x0, y - bh / 2, bw, bh, 9); ui.fill(g, isRed ? P.red : tints[i % 3]); ui.ink(g, 3, isRed ? P.redInk : P.ink); ui.rr(g, x0, y - bh / 2, bw, bh, 9); ui.hatch(g, x0, y - bh / 2, bw, bh, 12, isRed ? "rgba(255,255,255,.28)" : "rgba(43,42,39,.22)"); g.restore(); }
          if (bu > 0.95) ui.num(g, num(task.end - task.start) + (d.unit ? " " + d.unit : ""), x1 + 14, y, { size: 34, align: "left", color: isRed ? P.red : P.ink2, alpha: seg(t, ta + 0.8, ta + 1.1) });
          if (i > 0 && bu > 0.5) { const p = T[i - 1], px = TX(p.end), py = y - pitch, q = seg(t, ta + 0.5, ta + 1.0); ui.arrow(g, [[px, py + bh / 2 + 2], [px, y - bh / 2 - 12 - (x0 < px ? 0 : 0)], [Math.max(px, x0 - 2), y - bh / 2 - 12]].filter((_, k, arr) => k < 2 || x0 > px + 6), q, { w: 3, color: P.ink2, head: 11 }); } });
        // today line sweeps across once the bars are in
        const tu = seg(t, a[1] + 0.6, a[2] + 3.0); if (tu > 0) { const x = lerp(cx0, cx1, ease.io(tu)); g.save(); g.setLineDash([12, 8]); g.beginPath(); g.moveTo(x, top - 34); g.lineTo(x, h - 110); ui.ink(g, 4, P.red); g.restore(); g.beginPath(); g.moveTo(x - 14, top - 40); g.lineTo(x + 14, top - 40); g.lineTo(x, top - 18); g.closePath(); ui.fill(g, P.red); }
      },
    };
  },
};
