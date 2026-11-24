// kind: linkBoard (family: relations) - runtime successor of mg2d/board.js: pinned paper cards scattered far apart on the board with yarn strings between them; each card carries a generated SH illustration.
// Layout is solved from the data (snake over a jittered grid, seeded; the layout with the fewest strings crossing a third card wins).
// data: { items:[{ id:"a", cap:"Malacca", what:"tanker" (SH generator or word), sub?:"40% of trade", key?:true (red pin) }], links?:[["a","b",red?]] (default: the chain a-b-c...), cap? }
// focus ids: "c0".."c<n-1>" - card i arrives (and the string from card i-1 draws); the camera box covers card i and card i-1
import { P, F, ease, seg, clamp, lerp, ui, rng, icon, sd, fit, chip, circ } from "./_srd.js";
import { segDist } from "./_srd2.js";
const CW = 450, CH = 420, CELLW = 820, CELLH = 640, D = Math.PI / 180;
export default {
  name: "linkBoard", family: "relations",
  doc: "Pinned cards scattered far apart with yarn strings between them, SH illustrations on the cards.",
  example: [
    { items: [{ id: "a", cap: "Oil field", what: "pumpjack" }, { id: "b", cap: "Tanker", what: "tanker" }, { id: "c", cap: "Chokepoint", what: "lighthouse", key: true }, { id: "d", cap: "Refinery", what: "refineryColumn" }, { id: "e", cap: "Pump", what: "fuelPump" }] },
    { items: [{ id: "a", cap: "Chip fab", what: "chip" }, { id: "b", cap: "Container", what: "container" }, { id: "c", cap: "Port crane", what: "crane" }, { id: "d", cap: "Truck", what: "truck" }, { id: "e", cap: "Store", what: "city", key: true }, { id: "f", cap: "Phone", what: "phone" }], links: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e", true], ["e", "f"], ["a", "f"]] },
  ],
  build(d, K) {
    const r = K.rng, items = d.items, n = items.length, cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.5))), rows = Math.ceil(n / cols), idx = Object.fromEntries(items.map((c, i) => [c.id, i]));
    const links = (d.links ?? items.slice(1).map((c, i) => [items[i].id, c.id, !!c.key])).map(([a, b, red]) => ({ a: idx[a], b: idx[b], red: !!red }));
    const strPt = (A, B, u) => { const L = Math.hypot(B[0] - A[0], B[1] - A[1]), cx = (A[0] + B[0]) / 2, cy = (A[1] + B[1]) / 2 + L * 0.085, v = 1 - u; return [v * v * A[0] + 2 * v * u * cx + u * u * B[0], v * v * A[1] + 2 * v * u * cy + u * u * B[1]]; };
    let best = null; for (let tr = 0; tr < 40; tr++) { const q = rng(Math.floor(r() * 1e9) + tr), P0 = items.map((_, i) => { const row = Math.floor(i / cols), c0 = i % cols, col = row % 2 ? cols - 1 - c0 : c0; return { x: 160 + col * CELLW + CW / 2 + q.range(-110, 110), y: 130 + row * CELLH + CH / 2 + q.range(-70, 70), r: q.range(-5, 5) }; });
      let cross = 0; links.forEach(l => { for (let k = 1; k < 12; k++) { const p = strPt([P0[l.a].x, P0[l.a].y - CH / 2 + 40], [P0[l.b].x, P0[l.b].y - CH / 2 + 40], k / 12); P0.forEach((c, j) => { if (j !== l.a && j !== l.b && Math.abs(p[0] - c.x) < CW * 0.55 && Math.abs(p[1] - c.y) < CH * 0.55) cross++; }); } });
      if (!best || cross < best.cross) best = { P0, cross }; if (cross === 0) break; }
    const cards = items.map((c, i) => ({ ...c, ...best.P0[i], seed: sd(r) })), pin = c => { const a = c.r * D; return [c.x + Math.sin(a) * (CH / 2 - 40), c.y - Math.cos(a) * (CH / 2 - 40)]; };
    const w = cols * CELLW + 240, h = rows * CELLH + 260, bb = c => [c.x - CW / 2 - 30, c.y - CH / 2 - 40, c.x + CW / 2 + 30, c.y + CH / 2 + 30];
    const focus = cards.map((c, i) => { const a = bb(c), b = i ? bb(cards[i - 1]) : a, x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]), x1 = Math.max(a[2], b[2]), y1 = Math.max(a[3], b[3]), fw = Math.max(900, x1 - x0), fh = Math.max(640, y1 - y0); return { id: "c" + i, x: (x0 + x1) / 2 - fw / 2, y: (y0 + y1) / 2 - fh / 2, w: fw, h: fh }; });
    return {
      w, h, focus,
      draw(g, t, at) {
        const T = cards.map((_, i) => at["c" + i] ?? i * 2.6), landU = i => i === 0 ? 1 : seg(t, T[i] - 0.55, T[i] - 0.05);
        // yarn strings (drawn as the later card lands), under the cards
        links.forEach(l => { const ts = Math.max(T[l.a], T[l.b]) - 0.45, u = ease.io5(seg(t, ts, ts + 1.0)); if (u <= 0) return; const A = pin(cards[l.a]), B = pin(cards[l.b]), pts = []; for (let k = 0; k <= 40 * u; k++) pts.push(strPt(A, B, Math.min(u, k / 40)));
          const path = () => { g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); }; g.save(); g.lineCap = "round"; g.lineJoin = "round"; g.translate(5, 14); g.strokeStyle = "rgba(60,48,30,.08)"; for (const lw of [16, 10]) { g.lineWidth = lw; path(); g.stroke(); } g.restore();
          g.strokeStyle = l.red ? P.red : "#7b766c"; g.lineWidth = l.red ? 8 : 6; g.lineCap = "round"; path(); g.stroke(); g.strokeStyle = l.red ? "rgba(255,190,180,.55)" : "rgba(255,255,255,.35)"; g.lineWidth = 2; g.setLineDash([7, 9]); path(); g.stroke(); g.setLineDash([]); });
        cards.forEach((c, i) => { const u = landU(i); if (u <= 0) return; const e = ease.out(u); g.save(); g.translate(c.x, c.y); g.rotate(c.r * D); g.scale(lerp(1.14, 1, e), lerp(1.14, 1, e)); g.globalAlpha *= clamp(u * 2, 0, 1);
          ui.card(g, -CW / 2, -CH / 2, CW, CH, { r: 14, lift: 1.3 }); const bob = u >= 1 ? Math.sin(t * 1.3 + i) * 2 : 0; icon(g, c.what ?? "container", 0, -36 + bob, 270, { seed: c.seed, t: t - (T[i] - 0.5) });
          fit(g, c.cap, 0, CH / 2 - 44, CW - 56, { size: F.cap, color: c.key ? P.red : P.ink2, weight: 700 }); if (c.sub) { const q = ease.back(seg(t, T[i] + 0.2, T[i] + 0.7)); g.save(); g.translate(CW / 2 - 40, -CH / 2 + 70); g.scale(q, q); g.rotate(0.06); ui.tag(g, c.sub, -30, 0, { size: F.small }); g.restore(); }
          if (c.key) ui.pin(g, 0, -CH / 2 + 40, true, 1.15 * ease.back(seg(t, T[i] - 0.1, T[i] + 0.3))); else if (i % 2 === 0) ui.pin(g, 0, -CH / 2 + 40, false, 1.1 * ease.back(seg(t, T[i] - 0.1, T[i] + 0.3))); else ui.tape(g, 0, -CH / 2 + 6, 190, i % 4 === 1 ? -0.07 : 0.07, ease.io(seg(t, T[i], T[i] + 0.3)));
          g.restore(); });
        if (d.cap) { g.save(); ui.caption(g, d.cap, w / 2, h - 50, { size: F.cap, color: P.mid }); g.restore(); }
      },
    };
  },
};
