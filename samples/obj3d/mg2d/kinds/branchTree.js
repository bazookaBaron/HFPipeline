// kind: branchTree (family: process) - a decision/branching tree that grows level by level, left to right; one path is red.
// data: { root:{label, what, kids:[{label, what, red:bool, kids:[...]}]}, cap:"", note:"" (tag on the red leaf) }   (depth <= 4, <= 10 leaves)
// focus ids: "root" (trunk + first split), "tree" (everything), "path" (the red route to its leaf)
import { P, F, ease, seg, clamp, lerp, ui, thing, lab } from "./_ptu.js";
export default {
  name: "branchTree", family: "process",
  doc: "A tree of icon cards connected by growing curves, laid out from the data (leaf spacing, depth columns); the red path is traced last.",
  example: [{ root: { label: "Strait closed?", what: "gateBarrier", kids: [{ label: "Reroute", what: "containerShip", kids: [{ label: "+12 days", what: "clockFace", red: true }, { label: "+9% fuel", what: "barrel" }] }, { label: "Wait", what: "clockFace", kids: [{ label: "Stock runs out", what: "pallet" }, { label: "Prices rise", what: "coinStack" }] }, { label: "Airlift", what: "plane", kids: [{ label: "Costs 8x", what: "coinStack" }] }] }, cap: "What shippers can do", note: "chosen by most" },
            { root: { label: "Test result", what: "magnifier", kids: [{ label: "Positive", what: "shield", kids: [{ label: "Treat", what: "building", red: true }, { label: "Re-test", what: "magnifier" }] }, { label: "Negative", what: "documentPage" }] }, cap: "Decision tree", note: "" }],
  build(d, K) {
    const nodes = []; let leaf = 0; const walk = (n, depth, parent) => { const o = { ...n, depth, parent, i: nodes.length, kids: [] }; nodes.push(o); (n.kids || []).slice(0, 4).forEach(k => { if (nodes.length < 22) o.kids.push(walk(k, depth + 1, o)); }); if (!o.kids.length) o.leaf = leaf++; return o; };
    const root = walk(d.root || { label: "Start", what: "container", kids: [] }, 0, null), D = Math.max(...nodes.map(n => n.depth)), LP = clamp(880 / Math.max(1, leaf), 120, 175), cw = 290, ch = 108, colW = 390;
    const place = n => { n.y = n.kids.length ? (place(n.kids[0]), n.kids.forEach(place), (n.kids[0].y + n.kids[n.kids.length - 1].y) / 2) : n.leaf * LP; return n.y; }; place(root);
    const w = 160 + (D + 1) * colW + 120, h = Math.max(760, leaf * LP + 300), oy = (h - (leaf - 1) * LP) / 2, X = n => 100 + cw / 2 + n.depth * colW, Y = n => oy + n.y;
    // red path: from the node flagged red up to the root (else first leaf chain)
    let tip = nodes.find(n => n.red) || nodes.find(n => n.leaf === 0); const rp = new Set(); for (let q = tip; q; q = q.parent) rp.add(q);
    const tt = (n, a) => a + n.depth * 0.55 + (n.parent ? n.parent.kids.indexOf(n) * 0.14 : 0);
    return {
      w, h,
      focus: [{ id: "root", x: 0, y: 80, w: Math.min(w, 2 * colW + 380), h: h - 120 }, { id: "tree", x: 0, y: 60, w, h: h - 90 }, { id: "path", x: Math.max(0, w - (D + 1) * colW * 0.6 - 480), y: 80, w: Math.min(w, (D + 1) * colW * 0.6 + 480), h: h - 120 }],
      draw(g, t, at) {
        const a0 = at.root ?? 0, a1 = at.tree ?? a0 + 2.6, a2 = at.path ?? a1 + 2.6, A = n => n.depth <= 1 ? a0 : a1;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        // depth guide ticks
        for (let k = 0; k <= D; k++) { const x = 100 + cw / 2 + k * colW, u = seg(t, a0 - 0.2 + k * 0.4, a0 + 0.4 + k * 0.4); g.save(); g.globalAlpha *= u; g.beginPath(); g.moveTo(x, h - 70); g.lineTo(x, h - 50); ui.ink(g, 2.5, P.mid); g.restore(); if (u > 0.4) ui.caption(g, k === 0 ? "start" : "step " + k, x, h - 28, { size: F.small, color: P.mid, alpha: u }); }
        // edges first
        for (const n of nodes) if (n.parent) { const p = n.parent, ta = tt(n, A(n)) - 0.2, u = ease.io(seg(t, ta, ta + 0.6)), red = rp.has(n) && t > a2 - 0.1, ru = red ? ease.io(seg(t, a2 - 0.1 + (n.depth) * 0.25, a2 + 0.5 + n.depth * 0.25)) : 0;
          const x0 = X(p) + cw / 2, y0 = Y(p), x1 = X(n) - cw / 2, y1 = Y(n), mx = (x0 + x1) / 2; const part = (uu, c, lw) => { if (uu <= 0) return; g.save(); g.beginPath(); for (let s = 0; s <= 20 * uu; s++) { const k = s / 20, kk = Math.min(k, uu), b = 1 - kk; const x = b * b * b * x0 + 3 * b * b * kk * mx + 3 * b * kk * kk * mx + kk * kk * kk * x1, y = b * b * b * y0 + 3 * b * b * kk * y0 + 3 * b * kk * kk * y1 + kk * kk * kk * y1; s ? g.lineTo(x, y) : g.moveTo(x, y); } ui.ink(g, lw, c); g.restore(); };
          part(u, P.ink2, 4); part(ru, P.red, 7); }
        // nodes
        for (const n of nodes) { const ta = tt(n, A(n)), u = seg(t, ta, ta + 0.5), red = rp.has(n) && t > a2 + n.depth * 0.25; if (u <= 0) continue; const x = X(n), y = Y(n);
          ui.pop(g, u, x, y, () => { ui.shadow(g, () => ui.rr(g, -cw / 2, -ch / 2, cw, ch, 14), 4, 8); ui.rr(g, -cw / 2, -ch / 2, cw, ch, 14); ui.fill(g, red ? "#f6e1dd" : P.paper); ui.ink(g, red ? 4 : 2.5, red ? P.red : "rgba(43,42,39,.5)");
            g.save(); g.translate(-cw / 2 + 56, 0); thing(g, n.what || "container", 1200 + n.i * 7, { s: 76, u: Math.min(1, u * 1.2), t, red: false }); g.restore(); lab(g, n.label || "", 52, 0, { maxW: cw - 130, size: F.small, align: "center", color: red ? P.redInk : P.ink2 }); }); }
        if (d.note && t > a2 + D * 0.25 + 0.5) { const q = seg(t, a2 + D * 0.25 + 0.5, a2 + D * 0.25 + 1.1); ui.pop(g, q, X(tip) + 30, Y(tip) - ch / 2 - 56, () => ui.tag(g, d.note, 0, 0, { rot: -0.03 })); }
      },
    };
  },
};
