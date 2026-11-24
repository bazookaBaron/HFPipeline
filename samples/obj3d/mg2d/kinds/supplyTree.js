// kind: supplyTree (family: relations) - a supply chain tree growing left to right, from a raw material to intermediates to products; node cards carry SH illustrations; branch ribbons are as wide as the share they carry.
// data: { root:{ n:"Crude oil", what:"barrel", children:[{ n:"Refinery", what:"refineryColumn", share:100, children:[{ n:"Petrol", what:"fuelPump", share:45 }, { n:"Plastics", what:"container", share:25, red?:true }] }] }, cap }
// focus ids: "raw" (the first two columns), "chain" (middle columns, branches widen), "products" (the last two columns, the red node)
import { P, F, ease, seg, clamp, lerp, ui, rng, icon, sd, fit, chip, circ, fmt, TAU } from "./_srd.js";
import { layoutTree } from "./_srd2.js";
export default {
  name: "supplyTree", family: "relations",
  doc: "Tree from raw material to products with illustrated nodes and share-width branches.",
  example: [
    { cap: "Where a barrel goes", root: { n: "Crude oil", what: "barrel", children: [{ n: "Refinery", what: "refineryColumn", share: 100, children: [{ n: "Petrol", what: "fuelPump", share: 46 }, { n: "Diesel", what: "truck", share: 28 }, { n: "Jet fuel", what: "plane", share: 10 }, { n: "Plastics", what: "container", share: 16, red: true }] }] } },
    { cap: "From wheat to dinner", root: { n: "Wheat", what: "grainSack", children: [{ n: "Mill", what: "factory", share: 80, children: [{ n: "Bread", what: "pallet", share: 55 }, { n: "Pasta", what: "container", share: 25 }] }, { n: "Feed", what: "tractor", share: 20 }] } },
  ],
  build(d, K) {
    const r = K.rng, root = JSON.parse(JSON.stringify(d.root)), { nodes, maxD, leaves } = layoutTree(root), NW = 260, NH = 190, GX = 230, GY = 58, w = (maxD + 1) * NW + maxD * GX + 200, h = Math.max(leaves * (NH + GY) - GY + 290, 740);
    nodes.forEach(nd => { nd.x = 100 + nd._d * (NW + GX) + NW / 2; nd.y = 150 + (h - 290 - (leaves * (NH + GY) - GY)) / 2 + nd._y * (NH + GY) + NH / 2; nd.seed = sd(r); nd.share = nd.share ?? 100; });
    const edges = []; nodes.forEach(p => (p.children ?? []).forEach(c => edges.push({ p, c })));
    const vmax = 100, red = nodes.find(q => q.red) ?? nodes.filter(q => !(q.children?.length)).reduce((a, b) => b.share > a.share ? b : a);
    const colBox = (d0, d1) => { const x0 = 100 + d0 * (NW + GX) - 40, x1 = 100 + d1 * (NW + GX) + NW + 40, fw = Math.max(900, x1 - x0); return { x: clamp((x0 + x1) / 2 - fw / 2, 0, Math.max(0, w - fw)), y: 0, w: Math.min(fw, w), h }; };
    const f0 = colBox(0, Math.min(1, maxD)), f2 = colBox(Math.max(0, maxD - 1), maxD), f1 = maxD >= 3 ? colBox(1, maxD - 1) : colBox(0, maxD);
    const TNode = nd => nd._d, ST = 0.5;
    return {
      w, h, focus: [{ id: "raw", ...f0 }, { id: "chain", ...f1 }, { id: "products", ...f2 }],
      draw(g, t, at) {
        const T0 = at.raw ?? 0, T1 = at.chain ?? T0 + 2.6, T2 = at.products ?? T1 + 2.6, tNode = nd => nd._d === 0 ? T0 - 0.2 : nd._d <= 1 ? T0 + 0.3 + (nd._y - 0) * 0.15 : nd._d === maxD && maxD > 1 ? T2 - 0.2 + (nd._y % 6) * 0.35 : T1 - 0.2 + (nd._y % 6) * 0.35;
        ui.card(g, 0, 0, w, h, { r: 18 });
        edges.forEach(({ p, c }) => { const ts = tNode(c) - 0.2, u = ease.io(seg(t, ts, ts + 0.8)); if (u <= 0) return; const x0 = p.x + NW / 2, x1 = c.x - NW / 2 - 14, y0 = p.y, y1 = c.y, wd = 8 + 38 * (c.share / vmax), mid = (x0 + x1) / 2; const isR = c === red || (red && isAnc(c, red));
          const pts = []; for (let k = 0; k <= 36; k++) { const s = k / 36 * u, X = lerp(x0, x1, s), e = ease.io(s), Y = lerp(y0, y1, e); pts.push([X, Y]); }
          g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); ui.ink(g, wd + 5, P.ink); g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); ui.ink(g, wd, isR && t > T2 - 0.3 ? P.red : "#b8b2a4");
          if (u >= 1) { g.save(); g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.setLineDash([wd * 0.5, wd * 1.2]); g.lineDashOffset = -t * 36; ui.ink(g, Math.max(3, wd * 0.2), "rgba(251,248,241,.85)"); g.restore(); const q = pts[Math.floor(pts.length * 0.55)]; const cu = ease.back(seg(t, ts + 0.8, ts + 1.2)); g.save(); g.translate(q[0], q[1] - wd / 2 - 34); g.scale(cu, cu); chip(g, fmt(c.share) + "%", 0, 0, { red: c === red && t > T2 - 0.3 }); g.restore(); } });
        nodes.forEach(nd => { const ts = tNode(nd), u = seg(t, ts, ts + 0.5); if (u <= 0) return; const isR = nd === red && t > T2 - 0.2; g.save(); g.translate(nd.x, nd.y); const k = ease.settle(u); g.scale(k, k); g.globalAlpha *= clamp(u * 3, 0, 1);
          ui.card(g, -NW / 2, -NH / 2, NW, NH, { r: 12, rule: false }); if (isR) { ui.rr(g, -NW / 2, -NH / 2, NW, NH, 12); ui.ink(g, 5, P.red); } icon(g, nd.what ?? "container", 0, -30, 108, { seed: nd.seed, t: t - ts });
          fit(g, nd.n, 0, NH / 2 - 32, NW - 30, { size: F.small, color: isR ? P.red : P.ink2, weight: 700 }); g.restore(); });
        if (d.cap) ui.caption(g, d.cap, w / 2, h - 50, { size: F.cap, color: P.ink2, weight: 700 });
        function isAnc(a, b) { return (a.children ?? []).some(q => q === b || isAnc(q, b)); }
      },
    };
  },
};
