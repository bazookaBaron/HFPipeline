// kind: orgChart (family: relations) - a hierarchy of who controls what: top-down cards (SH icon + name) joined by elbow connectors that draw from parent to child, with stake tags (51%) on the connectors.
// The node flagged red (and the connectors on its path from the root) is the one red element. data: { root:{ n:"Holding", what:"building", children:[{ n:"Port co", what:"crane", stake:"51%", red?:true, children:[...] }] }, cap }
// focus ids: "top" (root + first level), "levels" (the lower levels land row by row), "key" (the red node, its parent and stake)
import { P, F, ease, seg, clamp, lerp, ui, rng, icon, sd, fit, chip, circ, fmt, stroke } from "./_srd.js";
import { layoutTree } from "./_srd2.js";
export default {
  name: "orgChart", family: "relations",
  doc: "Top-down ownership/control hierarchy with elbow connectors, stake tags and a red key node.",
  example: [
    { cap: "Who really controls the port", root: { n: "State fund", what: "government", children: [{ n: "Port holding", what: "crane", stake: "100%", children: [{ n: "Terminal A", what: "container", stake: "51%", red: true }, { n: "Terminal B", what: "containerShip", stake: "30%" }] }, { n: "Rail co", what: "locomotive", stake: "70%", children: [{ n: "Depot", what: "trainWagon", stake: "100%" }] }, { n: "Energy arm", what: "pumpjack", stake: "40%" }] } },
    { cap: "Chip empire", root: { n: "Parent", what: "building", children: [{ n: "Fab", what: "chip", stake: "80%", red: true }, { n: "Design", what: "laptop", stake: "100%" }] } },
  ],
  build(d, K) {
    const r = K.rng, root = JSON.parse(JSON.stringify(d.root)), { nodes, maxD, leaves } = layoutTree(root), NW = 270, NH = 190, GX = 40, GY = 150, w = Math.max(leaves * (NW + GX) - GX + 240, 1100), h = (maxD + 1) * NH + maxD * GY + 270;
    const x0 = (w - (leaves * (NW + GX) - GX)) / 2; nodes.forEach(nd => { nd.x = x0 + nd._y * (NW + GX) + NW / 2; nd.y = 130 + nd._d * (NH + GY) + NH / 2; nd.seed = sd(r); });
    const key = nodes.find(q => q.red) ?? nodes[nodes.length - 1], par = nodes.find(p => (p.children ?? []).includes(key)) ?? key, anc = new Set(); (function path(n) { if (n === key) { anc.add(n); return true; } for (const c of n.children ?? []) if (path(c)) { anc.add(n); return true; } return false; })(root);
    const win = (ds, de) => { const q = nodes.filter(nd => nd._d >= ds && nd._d <= de), xa = Math.min(...q.map(a => a.x)) - NW / 2 - 60, xb = Math.max(...q.map(a => a.x)) + NW / 2 + 60, fw = clamp(xb - xa, 1000, w), ya = 130 + ds * (NH + GY) - 50, yb = 130 + de * (NH + GY) + NH + 50, fh = Math.max(680, yb - ya); return { x: clamp((xa + xb) / 2 - fw / 2, 0, Math.max(0, w - fw)), y: clamp((ya + yb) / 2 - fh / 2, 0, Math.max(0, h - fh)), w: Math.min(fw, w), h: Math.min(fh, h) }; };
    const fk = (() => { const xa = Math.min(key.x, par.x) - NW / 2 - 120, xb = Math.max(key.x, par.x) + NW / 2 + 120, fw = Math.max(1000, xb - xa), ya = par.y - NH / 2 - 60, yb = key.y + NH / 2 + 60, fh = Math.max(680, yb - ya); return { x: clamp((xa + xb) / 2 - fw / 2, 0, Math.max(0, w - fw)), y: clamp((ya + yb) / 2 - fh / 2, 0, Math.max(0, h - fh)), w: Math.min(fw, w), h: Math.min(fh, h) }; })();
    return {
      w, h, focus: [{ id: "top", ...win(0, Math.min(1, maxD)) }, { id: "levels", ...win(Math.min(1, maxD), maxD) }, { id: "key", ...fk }],
      draw(g, t, at) {
        const T0 = at.top ?? 0, T1 = at.levels ?? T0 + 2.6, T2 = at.key ?? T1 + 2.6, tN = nd => nd._d === 0 ? T0 - 0.2 : nd._d === 1 ? T0 + 0.4 + (nd._y % 5) * 0.4 : T1 - 0.2 + (nd._d - 2) * 0.7 + (nd._y % 5) * 0.4; ui.card(g, 0, 0, w, h, { r: 18 });
        nodes.forEach(nd => (nd.children ?? []).forEach(c => { const ts = tN(c) - 0.35, u = ease.io(seg(t, ts, ts + 0.8)); if (u <= 0) return; const ax = nd.x, ay = nd.y + NH / 2, bx = c.x, by = c.y - NH / 2, my = (ay + by) / 2, red = anc.has(c) && t > T2 - 0.3; const pts = [[ax, ay], [ax, my], [bx, my], [bx, by - 4]]; let L = 0; const seglen = []; for (let i = 1; i < 4; i++) { const q = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seglen.push(q); L += q; } let rem = L * u; g.beginPath(); g.moveTo(...pts[0]);
          for (let i = 1; i < 4 && rem > 0; i++) { const k = Math.min(1, rem / seglen[i - 1]); g.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)); rem -= seglen[i - 1]; } ui.ink(g, red ? 7 : 5, red ? P.red : P.ink2);
          if (u >= 1 && c.stake) { const cu = ease.back(seg(t, ts + 0.8, ts + 1.2)); g.save(); g.translate(bx, by - 46); g.scale(cu, cu); chip(g, String(c.stake), 0, 0, { red: c === key && t > T2 - 0.3 }); g.restore(); } }));
        nodes.forEach(nd => { const ts = tN(nd), u = seg(t, ts, ts + 0.5); if (u <= 0) return; const isK = nd === key && t > T2 - 0.2; g.save(); g.translate(nd.x, nd.y); const k = ease.settle(u); g.scale(k, k); g.globalAlpha *= clamp(u * 3, 0, 1);
          ui.card(g, -NW / 2, -NH / 2, NW, NH, { r: 12, rule: false }); if (isK) { ui.rr(g, -NW / 2, -NH / 2, NW, NH, 12); ui.ink(g, 6, P.red); } icon(g, nd.what ?? "building", 0, -28, 104, { seed: nd.seed, t: t - ts }); fit(g, nd.n, 0, NH / 2 - 32, NW - 28, { size: F.small, color: isK ? P.red : P.ink2, weight: 700 }); g.restore(); });
        if (d.cap) ui.caption(g, d.cap, w / 2, h - 46, { size: F.cap, color: P.ink2, weight: 700 });
      },
    };
  },
};
