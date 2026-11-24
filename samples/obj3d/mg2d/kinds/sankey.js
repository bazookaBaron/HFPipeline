// kind: sankey (family: process) - flow ribbons split and merge between 2-3 columns of nodes; ribbon width = value, dots travel along the ribbons.
// data: { cols:[[{label, what?}...],[...],[...]] (2..3 columns, <=6 nodes each), links:[{from:"label", to:"label", v:30, red?:true}], unit:"%", cap:"" }
// focus ids: "inputs" (left column + its ribbons), "split" (middle), "outputs" (right column)
import { P, F, ease, seg, clamp, lerp, ui, thing, lab, dot, num } from "./_ptu.js";
export default {
  name: "sankey", family: "process",
  doc: "Sankey diagram generated from node labels and link values: columns of nodes, bezier ribbons whose thickness is the value, flow dots, one red ribbon.",
  example: [{ cols: [[{ label: "Oil", what: "barrel" }, { label: "Gas", what: "gasFlare" }, { label: "Coal", what: "rock" }], [{ label: "Power plants", what: "chimney" }, { label: "Vehicles", what: "truck" }, { label: "Industry", what: "factory" }], [{ label: "Homes", what: "house" }, { label: "Exports", what: "container" }, { label: "Lost heat", what: "cloud" }]],
    links: [{ from: "Oil", to: "Vehicles", v: 28, red: true }, { from: "Oil", to: "Industry", v: 10 }, { from: "Gas", to: "Power plants", v: 20 }, { from: "Gas", to: "Industry", v: 8 }, { from: "Coal", to: "Power plants", v: 16 }, { from: "Power plants", to: "Homes", v: 22 }, { from: "Power plants", to: "Lost heat", v: 14 }, { from: "Vehicles", to: "Lost heat", v: 18 }, { from: "Vehicles", to: "Exports", v: 10 }, { from: "Industry", to: "Exports", v: 18 }], unit: "%", cap: "Where energy goes" },
    { cols: [[{ label: "Salaries", what: "banknoteBundle" }, { label: "Tax", what: "stamp" }], [{ label: "Rent", what: "house" }, { label: "Food", what: "grainSack" }, { label: "Savings", what: "coinStack" }]],
      links: [{ from: "Salaries", to: "Rent", v: 40 }, { from: "Salaries", to: "Food", v: 25 }, { from: "Salaries", to: "Savings", v: 10, red: true }, { from: "Tax", to: "Food", v: 8 }, { from: "Tax", to: "Savings", v: 5 }], unit: "k", cap: "A household budget" }],
  build(d, K) {
    const cols = (d.cols || []).slice(0, 3).map(c => c.slice(0, 6).map(n => ({ ...n, in: 0, out: 0 }))), by = {}; cols.forEach((c, ci) => c.forEach(n => { n.ci = ci; by[n.label] = n; }));
    const links = (d.links || []).filter(l => by[l.from] && by[l.to] && by[l.to].ci > by[l.from].ci).map(l => ({ ...l, a: by[l.from], b: by[l.to] })); links.forEach(l => { l.a.out += l.v; l.b.in += l.v; }); cols.forEach(c => c.forEach(n => { n.val = Math.max(n.in, n.out, 1); }));
    const nC = cols.length, w = 1700, h = 900, cx = ci => 250 + ci * (w - 500) / Math.max(1, nC - 1), nw = 34, gapY = 26, availH = h - 260, tot = Math.max(...cols.map(c => c.reduce((s, n) => s + n.val, 0) + 0)), nmax = Math.max(...cols.map(c => c.length));
    const sc = Math.min((availH - (nmax - 1) * gapY) / tot, 14); cols.forEach((c, ci) => { const th = c.reduce((s, n) => s + n.val * sc, 0) + (c.length - 1) * gapY; let y = 150 + (availH - th) / 2; c.forEach(n => { n.x = cx(ci); n.y = y; n.h = n.val * sc; y += n.h + gapY; }); });
    cols.forEach(c => c.forEach(n => { let yo = n.y, yi = n.y; links.filter(l => l.a === n).sort((p, q) => p.b.y - q.b.y).forEach(l => { l.y0 = yo; l.th = l.v * sc; yo += l.th; }); links.filter(l => l.b === n).sort((p, q) => p.a.y - q.a.y).forEach(l => { l.y1 = yi; yi += l.v * sc; }); }));
    const bez = (l, k, off = 0) => { const x0 = l.a.x + nw, x1 = l.b.x, y0 = l.y0 + off, y1 = l.y1 + off, mx = (x0 + x1) / 2, b = 1 - k; return [b * b * b * x0 + 3 * b * b * k * mx + 3 * b * k * k * mx + k * k * k * x1, b * b * b * y0 + 3 * b * b * k * y0 + 3 * b * k * k * y1 + k * k * k * y1]; };
    const sx = clamp(nC === 2 ? 0 : 1, 0, 2), colX = ci => cx(ci);
    return {
      w, h,
      focus: [{ id: "inputs", x: 20, y: 40, w: Math.min(w - 40, nC === 2 ? 1000 : 900), h: h - 70 }, { id: "split", x: nC === 2 ? 350 : 380, y: 60, w: nC === 2 ? 1000 : 940, h: h - 90 }, { id: "outputs", x: w - (nC === 2 ? 1000 : 900) - 20, y: 40, w: nC === 2 ? 1000 : 900, h: h - 70 }],
      draw(g, t, at) {
        const a0 = at.inputs ?? 0, a1 = at.split ?? a0 + 2.6, a2 = at.outputs ?? a1 + 2.6; const ts = l => l.a.ci === 0 ? a0 : l.a.ci === 1 ? a1 : a2; ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        const col = ci => ci === 0 ? a0 : (ci === 1 && nC === 3) ? a1 : (nC === 2 ? a1 : a2);
        // ribbons (reveal left->right with a moving edge), red ribbon on top
        const order = links.slice().sort((p, q) => (p.red ? 1 : 0) - (q.red ? 1 : 0));
        for (const l of order) { const ta = (l.a.ci === 0 ? a0 : l.a.ci === 1 ? a1 : a2) - 0.1 + (links.indexOf(l) % 4) * 0.18, u = ease.io(seg(t, ta, ta + 0.9)); if (u <= 0) continue; const N = 28, steps = Math.max(2, Math.round(N * u));
          g.save(); g.beginPath(); for (let s = 0; s <= steps; s++) { const [x, y] = bez(l, u * s / steps); s ? g.lineTo(x, y) : g.moveTo(x, y); } for (let s = steps; s >= 0; s--) { const [x, y] = bez(l, u * s / steps, l.th); g.lineTo(x, y); } g.closePath(); g.fillStyle = l.red ? "rgba(200,38,29,.62)" : "rgba(139,134,123,.34)"; g.fill(); ui.ink(g, 2, l.red ? P.red : "rgba(43,42,39,.38)"); g.restore();
          if (u > 0.95) { const n = clamp(Math.round(l.th / 7), 1, 5); for (let k = 0; k < n; k++) { const q = ((t * 0.18 + k / n + (links.indexOf(l) * 0.13)) % 1), [x, y] = bez(l, q, l.th * ((k + 0.5) / n)); dot(g, x, y, 4.5, l.red ? P.redInk : P.ink2, false); } } }
        // nodes + labels
        cols.forEach((c, ci) => c.forEach((n, i) => { const ta = (ci === 0 ? a0 : ci === 1 && nC === 3 ? a1 : nC === 2 ? a1 : a2) - 0.2 + i * 0.25, u = seg(t, ta, ta + 0.5); if (u <= 0) return; const left = ci === 0, right = ci === nC - 1;
          g.save(); g.globalAlpha *= Math.min(1, u * 2); ui.rr(g, n.x, n.y, nw, n.h * ease.out(u), 6); ui.fill(g, P.ink2); ui.ink(g, 2.5, P.ink); g.restore();
          const tx = left ? n.x - 24 : right ? n.x + nw + 24 : n.x + nw / 2, al = left ? "right" : right ? "left" : "center", ty = n.y + n.h / 2;
          if (u > 0.5) { const ic = n.what ? 46 : 0; if (left || right) { if (n.what) { g.save(); g.translate(left ? tx - 170 - 14 : tx + 170 + 14 + 0, ty); g.restore(); } lab(g, n.label, left ? tx - (ic ? 58 : 0) : tx + (ic ? 58 : 0), ty - 20, { maxW: 200, size: F.small, align: al, n: 14 }); ui.num(g, num(n.val) + (d.unit || ""), left ? tx - (ic ? 58 : 0) : tx + (ic ? 58 : 0), ty + 26, { size: 34, align: al, color: P.ink2 });
              if (n.what) { g.save(); g.translate(left ? tx - 22 : tx + 22, ty); thing(g, n.what, 1700 + ci * 40 + i, { s: 64, u: 1, t }); g.restore(); } }
            else { ui.tag(g, n.label, n.x + nw / 2, n.y - 36, { size: F.small }); ui.num(g, num(n.val) + (d.unit || ""), n.x + nw / 2, n.y + n.h + 34, { size: 34, color: P.ink2 }); if (n.what) { g.save(); g.translate(n.x + nw / 2 + 80, ty); thing(g, n.what, 1700 + ci * 40 + i, { s: 66, u: 1, t }); g.restore(); } } } }));
      },
    };
  },
};
