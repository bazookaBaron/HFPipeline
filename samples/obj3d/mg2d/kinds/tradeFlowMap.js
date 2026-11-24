// kind: tradeFlowMap (family: space) - curved flow ribbons between places, width = volume, with chevrons flowing along them, SH cargo icons riding them and value chips.
// data: { region?, nodes:[{n,ll}], flows:[{ from, to, v:12, what:"oil|container|grain|chip...", red?:true }], unit:"mb/d", cap }  (largest flow is red unless a flow has red:true)
// focus ids: "flows" (all flows draw, largest first), "top" (zoom on the largest flow: width, icons and value)
import { P, F, ease, seg, clamp, lerp, ui, rng, makeMap, drawMap, place, mkPath, bend, stroke, ribbon, pinTag, placeLabels, tagSize, icon, sd, fmt, chip, PADM } from "./_srd.js";
import { bboxPts, focusBox, mixc } from "./_srd2.js";
export default {
  name: "tradeFlowMap", family: "space",
  doc: "Curved flow ribbons of varying width between places with moving chevrons, cargo icons and value chips.",
  example: [
    { cap: "Oil leaving the Gulf", unit: "mb/d", region: [28, -10, 140, 50], nodes: [{ n: "Gulf", ll: [51, 26] }, { n: "China", ll: [112, 32] }, { n: "India", ll: [78, 22] }, { n: "Japan", ll: [137, 36] }, { n: "Europe", ll: [30, 46] }, { n: "S. Korea", ll: [127.8, 36.4] }],
      flows: [{ from: "Gulf", to: "China", v: 5.4, what: "oil" }, { from: "Gulf", to: "India", v: 4.1, what: "oil" }, { from: "Gulf", to: "Japan", v: 2.9, what: "oil" }, { from: "Gulf", to: "Europe", v: 1.6, what: "oil" }, { from: "Gulf", to: "S. Korea", v: 2.2, what: "oil" }] },
    { cap: "Where the chips go", unit: "$bn", region: [-130, 5, 150, 62], nodes: [{ n: "Taiwan", ll: [121, 24] }, { n: "USA", ll: [-98, 39] }, { n: "Europe", ll: [10, 49] }, { n: "China", ll: [105, 34] }], flows: [{ from: "Taiwan", to: "USA", v: 62, what: "chip" }, { from: "Taiwan", to: "China", v: 95, what: "chip" }, { from: "Taiwan", to: "Europe", v: 28, what: "chip" }] },
  ],
  build(d, K) {
    const r = K.rng, nodes = d.nodes.map(place), idx = Object.fromEntries(nodes.map((n, i) => [n.n, i])), fi = v => typeof v === "number" ? v : idx[v] ?? 0, M = makeMap({ region: d.region, pts: nodes.map(n => n.ll), rng: r, h: 700, w: 1400 });
    const NP = nodes.map(n => M.f(n.ll)), vmax = Math.max(...d.flows.map(f => f.v)), anyRed = d.flows.some(f => f.red);
    const flows = d.flows.map((f, i) => ({ ...f, a: NP[fi(f.from)], b: NP[fi(f.to)], seed: sd(r), i })).sort((a, b) => b.v - a.v);
    const sign = new Map(); flows.forEach((f, i) => { f.wd = 12 + 36 * (f.v / vmax); f.k = (0.16 + 0.08 * ((i * 7) % 3)) * (i % 2 ? -1 : 1); f.red = anyRed ? !!f.red : i === 0; f.path = mkPath(bend(f.a, f.b, f.k, 44)); f.head = f.wd * 0.9 + 22; });
    const lab = placeLabels(nodes.map((n, i) => ({ x: NP[i][0], y: NP[i][1], ...tagSize(n.n), r: 26 })), M.w, M.h, NP), CARD = PADM, w = M.w + CARD * 2, h = M.h + CARD * 2 + 70, mx = CARD, my = CARD, tf = flows[0], tb = bboxPts(tf.path.pts);
    const fb = focusBox([tb[0] + mx, tb[1] + my, tb[2] + mx, tb[3] + my], w, h, 1000, 640, 200);
    return {
      w, h, focus: [{ id: "flows", x: 0, y: 0, w, h }, { id: "top", ...fb }],
      draw(g, t, at) {
        const t0 = at.flows ?? 0, t1 = at.top ?? t0 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 }); g.save(); g.translate(mx, my); drawMap(g, M, t);
        nodes.forEach((n, i) => pinTag(g, n.n, NP[i][0], NP[i][1], lab[i].lx, lab[i].ly, ease.out(seg(t, t0 - 0.2 + i * 0.12, t0 + 0.3 + i * 0.12)), {}));
        flows.forEach((f, i) => { const ts = t0 + 0.2 + i * 0.55, u = ease.io(seg(t, ts, ts + 1.0)); if (u <= 0) return; const pts = f.path.upTo(u), col = f.red ? P.red : mixc(P.stone2, P.ink2, 0.35);
          ribbon(g, pts, f.wd, col, u > 0.98 ? f.head : 0); stroke(g, pts, Math.max(3, f.wd * 0.22), "rgba(251,248,241,.8)", [f.wd * 0.5, f.wd * 1.1], -t * 40);
          if (u >= 1) { const n = f.wd > 30 ? 3 : f.wd > 20 ? 2 : 1; for (let k = 0; k < n; k++) { const ph = ((t - ts) * 0.16 + k / n) % 1, [x, y] = f.path.at(f.path.len * ph * 0.9); icon(g, f.what ?? "container", x, y - f.wd * 0.9, clamp(f.wd * 2.0, 70, 120), { seed: f.seed + k, t }); }
            const q = f.path.at(f.path.len * 0.5); const cu = ease.back(seg(t, ts + 1.0, ts + 1.5)); g.save(); g.translate(q[0], q[1] - f.wd - 56); g.scale(cu, cu); chip(g, fmt(f.v) + (d.unit ? " " + d.unit : ""), 0, 0, { red: f.red }); g.restore(); } });
        // the top flow: bracket showing its width = the volume scale
        const tu = seg(t, t1, t1 + 0.8); if (tu > 0) { const q = tf.path.at(tf.path.len * 0.28), ang = q[2] + Math.PI / 2, hw = tf.wd / 2 + 10, dx = Math.cos(ang) * hw, dy = Math.sin(ang) * hw; g.save(); g.globalAlpha *= tu; g.beginPath(); g.moveTo(q[0] - dx, q[1] - dy); g.lineTo(q[0] + dx, q[1] + dy); ui.ink(g, 3, P.ink); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(q[0] + s * dx - Math.cos(q[2]) * 10, q[1] + s * dy - Math.sin(q[2]) * 10); g.lineTo(q[0] + s * dx + Math.cos(q[2]) * 10, q[1] + s * dy + Math.sin(q[2]) * 10); ui.ink(g, 3, P.ink); } g.restore(); }
        g.restore(); if (d.cap) ui.caption(g, d.cap, w / 2, h - 36, { size: F.cap, color: P.ink2, weight: 700 });
      },
    };
  },
};
