// kind: lineEvent (family: numbers) - a line chart that draws itself left to right (soft area under it, head dot with live value), then annotated events land as
// vertical drop-lines with markers and tag labels.
// data: { values: [..], labels: ["2015", ...] (one per value, "" to skip), events: [{ at: index (can be fractional), label: "Pandemic" }], unit: "$ per barrel", cap: "...", redEvent: (index into events, default last) }
// focus ids: "line" (the chart as it draws), "events" (the annotations)
import * as H from "./_h_numcmp.js";
export default {
  name: "lineEvent", family: "numbers",
  doc: "Self-drawing line chart with area, head value dot and annotated event drop-lines/tags.",
  example: [{ values: [64, 59, 52, 31, 40, 52, 55, 38, 67, 95, 78, 82], labels: ["2014", "", "2016", "", "2018", "", "2020", "", "2022", "", "2024", ""], events: [{ at: 3, label: "Price war" }, { at: 7, label: "Pandemic" }, { at: 9, label: "Invasion" }], unit: "$ per barrel", cap: "Crude oil price", redEvent: 1 },
            { values: [3.1, 3.4, 3.6, 4.0, 4.3, 3.9, 5.2, 6.1, 6.0, 5.4], labels: ["Q1", "Q2", "Q3", "Q4", "Q1", "Q2", "Q3", "Q4", "Q1", "Q2"], events: [{ at: 4.5, label: "New tariff" }, { at: 7, label: "Port strike" }], unit: "index", cap: "Freight cost index" }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { nice, fmt, axisY, ground, smooth, flag, line } = H;
    const V = d.values, n = V.length, w = 1600, h = 900, px = 190, pw = w - px - 110, py = 280, ph = 460, yb = py + ph, hi = Math.max(...V), ax = nice(hi, 4);
    const X = i => px + i / (n - 1) * pw, Y = v => yb - v / ax.top * ph, pts = V.map((v, i) => [X(i), Y(v)]);
    const ev = (d.events || []).map(e => { const f = clamp(e.at, 0, n - 1), i0 = Math.floor(f), i1 = Math.min(n - 1, i0 + 1), v = lerp(V[i0], V[i1], f - i0); return { ...e, x: X(f), y: Y(v), f, v, tw: H.tw(e.label, F.small, 700) + 60 }; }), redE = d.redEvent ?? ev.length - 1;
    const lv = []; ev.forEach((e, i) => { lv[i] = 0; for (let j = 0; j < i; j++) if (Math.abs(ev[j].x - e.x) < (e.tw + ev[j].tw) / 2 + 20 && lv[j] === lv[i]) lv[i]++; });
    const evTop = i => py - 50 - lv[i] * 76;
    return {
      w, h, focus: [{ id: "line", x: 20, y: 120, w: w - 40, h: h - 140 }, { id: "events", x: 140, y: 100, w: w - 280, h: h - 140 }],
      draw(g, t, at) {
        const t0 = at.line ?? 0, t1 = at.events ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        const au = seg(t, t0 - 0.2, t0 + 0.7); axisY(g, px, px + pw, yb, ph, ax.top, ax.step, au); ground(g, px - 10, px + pw + 10, yb, au);
        if (d.unit) ui.caption(g, d.unit, px - 16, py - 60 + 20, { size: F.small, align: "left", color: P.mid, alpha: au });
        for (let i = 0; i < n; i++) if (d.labels?.[i]) { line(g, X(i), yb, X(i), yb + 12, 2, P.ink2); ui.caption(g, d.labels[i], X(i), yb + 50, { size: F.small, caps: false, spacing: 0, color: P.mid, alpha: au }); }
        const u = ease.io5(seg(t, t0 + 0.1, t0 + 2.0)), hxp = px + u * pw;
        g.save(); g.beginPath(); g.rect(px - 20, 0, hxp - px + 20, h); g.clip();
        g.beginPath(); smooth(g, pts); g.lineTo(X(n - 1), yb); g.lineTo(X(0), yb); g.closePath(); const gr = g.createLinearGradient(0, py, 0, yb); gr.addColorStop(0, "rgba(185,204,211,.7)"); gr.addColorStop(1, "rgba(185,204,211,.08)"); g.fillStyle = gr; g.fill();
        g.beginPath(); smooth(g, pts); ui.ink(g, 6, P.ink); for (let i = 0; i < n; i++) { g.beginPath(); g.arc(X(i), pts[i][1], 4.5, 0, 7); ui.fill(g, P.ink); } g.restore();
        const fi = u * (n - 1), i0 = Math.min(n - 2, Math.floor(fi)), hv = lerp(V[i0], V[i0 + 1], fi - i0), hy = Y(hv);
        if (u > 0.01 && t < t1 - 0.3) { g.beginPath(); g.arc(hxp, hy, 11, 0, 7); ui.fill(g, P.paper); ui.ink(g, 5, P.ink); flag(g, fmt(hv, hi < 20 ? 1 : 0), hxp, hy - 56); }
        ev.forEach((e, i) => { const ts = t1 - 0.1 + i * 0.5, eu = seg(t, ts, ts + 0.55), R = i === redE; if (eu <= 0) return; const ty = evTop(i);
          H.dash(g, e.x, e.y, e.x, ty + 36, ease.io(eu), R ? P.red : P.mid, R ? 3.5 : 2.5, [10, 7]); ui.pop(g, seg(t, ts + 0.1, ts + 0.5), e.x, e.y, () => { g.beginPath(); g.arc(0, 0, 14, 0, 7); ui.fill(g, R ? P.red : P.paper); ui.ink(g, 4, R ? P.redInk : P.ink); });
          if (eu > 0.5) ui.pop(g, seg(eu, 0.5, 1), clamp(e.x, e.tw / 2 + 30, w - e.tw / 2 - 30), ty, () => ui.tag(g, e.label, 0, 0, { color: R ? P.redInk : P.ink, fill: P.paper })); });
      },
    };
  },
};
