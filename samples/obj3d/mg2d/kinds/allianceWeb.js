// kind: allianceWeb (family: relations) - actors as SH tokens laid out by a seeded force simulation, joined by typed links: ally (solid), rival (zigzag), trade (double line + cargo), dependent (arrow).
// The link flagged red (or the first rival) is the one red element. A legend lists the link types in use.
// data: { actors:[{ id:"us", n:"USA", what:"warship" }], links:[{ a:"us", b:"jp", type:"ally|rival|trade|dependent", label?:"2% of GDP", red?:true }], cap }
// focus ids: "web" (tokens, then links, land one by one), "key" (the red link and its two actors)
import { P, F, ease, seg, clamp, lerp, ui, rng, icon, sd, fit, chip, circ, stroke, TAU } from "./_srd.js";
import { token } from "./_srd2.js";
const TYPES = { ally: "ally", rival: "rival", trade: "trade", dependent: "depends on" };
export default {
  name: "allianceWeb", family: "relations",
  doc: "Actors as tokens in a force-laid web with typed links: ally, rival, trade, dependent.",
  example: [
    { cap: "Who stands with whom", actors: [{ id: "us", n: "USA", what: "warship" }, { id: "jp", n: "Japan", what: "chip" }, { id: "cn", n: "China", what: "factory" }, { id: "tw", n: "Taiwan", what: "chip" }, { id: "ph", n: "Philippines", what: "fishingBoat" }, { id: "au", n: "Australia", what: "mountain" }, { id: "ru", n: "Russia", what: "gasFlare" }],
      links: [{ a: "us", b: "jp", type: "ally" }, { a: "us", b: "ph", type: "ally" }, { a: "us", b: "au", type: "ally" }, { a: "us", b: "cn", type: "rival" }, { a: "cn", b: "tw", type: "rival", red: true, label: "the strait" }, { a: "cn", b: "ru", type: "trade" }, { a: "jp", b: "tw", type: "trade" }, { a: "au", b: "cn", type: "dependent" }] },
    { cap: "Gas web", actors: [{ id: "a", n: "Russia", what: "gasFlare" }, { id: "b", n: "Germany", what: "factory" }, { id: "c", n: "Norway", what: "pumpjack" }, { id: "d", n: "Turkey", what: "pipe" }], links: [{ a: "a", b: "b", type: "dependent", red: true }, { a: "c", b: "b", type: "trade" }, { a: "a", b: "d", type: "trade" }, { a: "b", b: "d", type: "ally" }] },
  ],
  build(d, K) {
    const r = K.rng, A = d.actors, n = A.length, idx = Object.fromEntries(A.map((a, i) => [a.id, i])), L = d.links.map(l => ({ ...l, i: idx[l.a], j: idx[l.b] })), w = 1700, h = 980, AR = 64, cx = w / 2, cy = (h - 90) / 2;
    if (!L.some(l => l.red)) { const q = L.find(l => l.type === "rival") ?? L[0]; if (q) q.red = true; }
    let pts = A.map((_, i) => ({ x: cx + 380 * Math.cos(i / n * TAU + r.range(-0.3, 0.3)), y: cy + 230 * Math.sin(i / n * TAU + r.range(-0.3, 0.3)), vx: 0, vy: 0 }));
    for (let it = 0; it < 500; it++) { const k = 1 - it / 500; for (let i = 0; i < n; i++) { let fx = (cx - pts[i].x) * 0.004, fy = (cy - pts[i].y) * 0.006; for (let j = 0; j < n; j++) if (j !== i) { const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d2 = Math.max(400, dx * dx + dy * dy), f = 1.4e5 / d2, dd = Math.sqrt(d2); fx += dx / dd * f * 0.05; fy += dy / dd * f * 0.05; }
        L.forEach(l => { if (l.i === i || l.j === i) { const o = pts[l.i === i ? l.j : l.i], dx = o.x - pts[i].x, dy = o.y - pts[i].y, dd = Math.hypot(dx, dy) || 1, f = (dd - 340) * 0.012; fx += dx / dd * f; fy += dy / dd * f; } }); pts[i].vx = (pts[i].vx + fx) * 0.8; pts[i].vy = (pts[i].vy + fy) * 0.8; }
      pts.forEach(p => { p.x = clamp(p.x + p.vx * k, AR + 120, w - AR - 120); p.y = clamp(p.y + p.vy * k, AR + 70, h - 90 - AR - 40); }); }
    const seeds = A.map(() => sd(r)), key = L.find(l => l.red), kb = key ? [Math.min(pts[key.i].x, pts[key.j].x) - 260, Math.min(pts[key.i].y, pts[key.j].y) - 230, Math.max(pts[key.i].x, pts[key.j].x) + 260, Math.max(pts[key.i].y, pts[key.j].y) + 230] : [0, 0, w, h];
    const kw = Math.max(1000, kb[2] - kb[0]), kh = Math.max(660, kb[3] - kb[1]), used = [...new Set(L.map(l => l.type))];
    return {
      w, h, focus: [{ id: "web", x: 0, y: 0, w, h }, { id: "key", x: clamp((kb[0] + kb[2]) / 2 - kw / 2, 0, w - kw), y: clamp((kb[1] + kb[3]) / 2 - kh / 2, 0, h - kh), w: kw, h: kh }],
      draw(g, t, at) {
        const t0 = at.web ?? 0, t1 = at.key ?? t0 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 }); const NT = 0.3, LT = t0 + 0.2 + n * NT * 0.8;
        // links first (under tokens)
        L.forEach((l, k) => { const ts = LT + k * 0.38, u = ease.io(seg(t, ts, ts + 0.8)), keyOn = l.red ? 1 : 0; if (u <= 0) return; const a = pts[l.i], b = pts[l.j], dx = b.x - a.x, dy = b.y - a.y, D = Math.hypot(dx, dy), ux = dx / D, uy = dy / D, nx = -uy, ny = ux, s0 = AR + 8, s1 = D - AR - 8, e = lerp(s0, s1, u), col = l.red ? P.red : P.ink;
          const P2 = (s, o = 0) => [a.x + ux * s + nx * o, a.y + uy * s + ny * o];
          if (l.type === "ally") stroke(g, [P2(s0), P2(e)], 7, col); else if (l.type === "rival") { const z = []; for (let s = s0; s <= e; s += 22) z.push(P2(s, ((s - s0) / 22 % 2 ? 1 : -1) * 15)); stroke(g, z, 4.5, col); }
          else if (l.type === "trade") { stroke(g, [P2(s0, -7), P2(e, -7)], 4, col); stroke(g, [P2(s0, 7), P2(e, 7)], 4, col); if (u >= 1) { const ph = ((t - ts) * 0.22) % 1, q = P2(lerp(s0, s1, ph)); icon(g, "container", q[0], q[1] - 24, 62, { seed: 4, t }); } }
          else { stroke(g, [P2(s0), P2(e)], 8, col); if (u > 0.95) { const q = P2(s1), hs = 26; g.beginPath(); g.moveTo(q[0] + ux * 6, q[1] + uy * 6); g.lineTo(q[0] - ux * hs + nx * hs * 0.7, q[1] - uy * hs + ny * hs * 0.7); g.lineTo(q[0] - ux * hs - nx * hs * 0.7, q[1] - uy * hs - ny * hs * 0.7); g.closePath(); ui.fill(g, col); } }
          if (l.label && u >= 1) { const q = P2(D / 2); const cu = ease.back(seg(t, ts + 0.8, ts + 1.2)); g.save(); g.translate(q[0], q[1]); g.scale(cu, cu); chip(g, l.label, 0, 0, { red: l.red }); g.restore(); } if (keyOn && t > t1 - 0.2 && u >= 1) { const q = P2(D / 2), pr = seg(t, t1 - 0.2, t1 + 0.6); g.beginPath(); g.arc(q[0], q[1], 40 * ease.out(pr) * (1 + 0.1 * Math.sin(t * 5)), 0, TAU); ui.ink(g, 3.5, P.red); } });
        A.forEach((a, i) => { const ts = t0 - 0.2 + i * NT, u = seg(t, ts, ts + 0.5); if (u <= 0) return; g.save(); g.globalAlpha *= clamp(u * 3, 0, 1); token(g, a.what, pts[i].x, pts[i].y, AR, { k: ease.settle(u), seed: seeds[i], t }); fit(g, a.n, pts[i].x, pts[i].y + AR + 36, 240, { size: F.small, color: P.ink2, weight: 700 }); g.restore(); });
        // legend: only the link types in use
        const lg = used.length, lx0 = w / 2 - lg * 170, ly = h - 62; used.forEach((ty, i) => { const x = lx0 + i * 340 + 40, u = seg(t, LT + i * 0.2, LT + 0.5 + i * 0.2); g.save(); g.globalAlpha *= u; if (ty === "ally") stroke(g, [[x, ly], [x + 90, ly]], 6, P.ink); else if (ty === "rival") stroke(g, Array.from({ length: 9 }, (_, k) => [x + k * 11, ly + (k % 2 ? 11 : -11)]), 4, P.ink); else if (ty === "trade") { stroke(g, [[x, ly - 6], [x + 90, ly - 6]], 4, P.ink); stroke(g, [[x, ly + 6], [x + 90, ly + 6]], 4, P.ink); } else { stroke(g, [[x, ly], [x + 76, ly]], 7, P.ink); g.beginPath(); g.moveTo(x + 94, ly); g.lineTo(x + 70, ly - 13); g.lineTo(x + 70, ly + 13); g.closePath(); ui.fill(g, P.ink); }
          ui.caption(g, TYPES[ty], x + 112, ly, { size: F.small, align: "left", color: P.ink2, weight: 700 }); g.restore(); });
        if (d.cap) ui.caption(g, d.cap, 70, 56, { size: F.small, align: "left", color: P.mid });
      },
    };
  },
};
