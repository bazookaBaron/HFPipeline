// kind: seasonBand (family: space) - a 12-month band per item showing open / closed seasons (closed = hatched stone with an ice floe), a red cursor sweeping through the year,
// and optionally a small route map beside it whose line turns solid (open) or dashed with ice (closed) as the cursor moves.
// data: { items:[{ n:"Northern Sea Route", what:"icebreaker", open:[[7,10]] (month ranges 1-12, may wrap e.g. [11,2]) }], now:8 (month the cursor stops at, 1-12),
//   map?:{ region?, route:[[lon,lat]...], from?:"Murmansk", to?:"Yokohama" }, cap:"When the route is open", closedWhat:"iceFloe" }
// focus ids: "band" (the rows fill in), "now" (the cursor reaches `now`: state chips + map route)
import { P, F, ease, seg, clamp, lerp, ui, rng, makeMap, drawMap, place, mkPath, smooth, bend, stroke, icon, sd, fmt, PADM, fit, circ, vehicle, measure } from "./_srd.js";
import { mixc } from "./_srd2.js";
const MON = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"], MONL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const isOpen = (it, m) => it.open.some(([a, b]) => a <= b ? m >= a && m <= b : m >= a || m <= b);   // m = 1..12 (integer month)
export default {
  name: "seasonBand", family: "space",
  doc: "12-month open/closed bands with a sweeping cursor and an optional route map that opens and closes with the season.",
  example: [
    { cap: "When the Arctic route is open", now: 8, closedWhat: "iceFloe", items: [{ n: "Northern Sea Route", what: "icebreaker", open: [[7, 10]] }, { n: "Suez Canal", what: "containerShip", open: [[1, 12]] }, { n: "Baltic ports", what: "tug", open: [[4, 12]] }],
      map: { route: [[33, 69], [60, 73], [100, 77], [140, 74], [170, 66], [141, 40]], from: "Murmansk", to: "Yokohama" } },
    { cap: "Monsoon shipping", now: 7, items: [{ n: "Small ports", what: "fishingBoat", open: [[10, 5]] }, { n: "Big ports", what: "crane", open: [[1, 12]] }] },
  ],
  build(d, K) {
    const r = K.rng, items = d.items, n = items.length, CARD = PADM, hasMap = !!d.map, RH = 150, BW = 1180, LW = 330, CW = (BW - LW - 40) / 12, hh = 84 + n * RH + 40, MW = hasMap ? 640 : 0;
    const w = CARD * 2 + BW + (hasMap ? MW + CARD : 0), h = Math.max(hh, hasMap ? 560 : 0) + CARD * 2 + 80, bx = CARD + (hasMap ? MW + CARD : 0), by = CARD + 20, now = d.now ?? 7;
    let M = null, route = null; if (hasMap) { const rt = d.map.route.map(p => p), M0 = makeMap({ region: d.map.region, pts: rt, rng: r, w: MW, h: Math.min(560, h - CARD * 2 - 80) }); M = M0; route = mkPath(rt.length > 2 ? smooth(rt.map(M.f), 12) : bend(M.f(rt[0]), M.f(rt[1]), 0.1)); route.seed = sd(r); }
    const ice = route ? Array.from({ length: 4 }, (_, i) => route.at(route.len * (0.3 + 0.15 * i))) : [];
    const cellX = m => bx + LW + 20 + (m - 1) * CW;
    return {
      w, h, focus: [{ id: "band", x: bx - 40, y: 0, w: BW + 80, h }, { id: "now", x: hasMap ? 0 : bx - 40, y: 0, w: hasMap ? w : BW + 80, h }],
      draw(g, t, at) {
        const t0 = at.band ?? 0, t1 = at.now ?? t0 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 });
        // month header
        MON.forEach((m, i) => { const u = seg(t, t0 - 0.2 + i * 0.04, t0 + 0.3 + i * 0.04); g.save(); g.globalAlpha *= u; ui.caption(g, m, cellX(i + 1) + CW / 2 - 3, by + 24, { size: F.small, color: P.mid, weight: 700 }); g.restore(); });
        const sweep = t < t1 - 0.2 ? 1 + (now - 1) * 0 : 1, cu = ease.io(seg(t, t1 - 0.3, t1 + 1.8)), curM = lerp(1, now + 0.5, cu), curX = bx + LW + 20 + (curM - 1) * CW;
        items.forEach((it, i) => { const y = by + 64 + i * RH, ru = ease.out(seg(t, t0 + i * 0.35, t0 + 0.6 + i * 0.35)); g.save(); g.globalAlpha *= ru; g.translate(0, (1 - ru) * 20);
          ui.card(g, bx - 8, y, BW - 8, RH - 20, { r: 12, rule: false }); icon(g, it.what ?? "container", bx + 62, y + (RH - 20) / 2, 96, { seed: 5 + i, t }); fit(g, it.n, bx + 128, y + (RH - 20) / 2, LW - 150, { size: F.small, align: "left", color: P.ink, weight: 700 });
          for (let m = 1; m <= 12; m++) { const x = cellX(m), op = isOpen(it, m), cell = ease.out(seg(t, t0 + 0.2 + i * 0.35 + m * 0.045, t0 + 0.6 + i * 0.35 + m * 0.045)); g.save(); g.globalAlpha *= cell; ui.rr(g, x, y + 16, CW - 4, RH - 52, 8);
            if (op) { ui.fill(g, P.paper); ui.ink(g, 2.5, P.ink2); g.beginPath(); g.moveTo(x + CW * 0.25, y + RH / 2 - 6); g.lineTo(x + CW * 0.43, y + RH / 2 + 8); g.lineTo(x + CW * 0.75, y + RH / 2 - 22); ui.ink(g, 4, P.ink); }
            else { ui.fill(g, P.stone); g.save(); ui.rr(g, x, y + 16, CW - 4, RH - 52, 8); ui.hatch(g, x, y + 16, CW, RH - 52, 11, "rgba(43,42,39,.28)"); g.restore(); ui.rr(g, x, y + 16, CW - 4, RH - 52, 8); ui.ink(g, 2.5, P.mid);
              if (!isOpen(it, m - 1 < 1 ? 12 : m - 1)) { /* continuing closed run */ } else icon(g, d.closedWhat ?? "iceFloe", x + CW / 2, y + RH / 2 - 8, CW * 1.4, { seed: 9, t }); } g.restore(); }
          g.restore(); });
        // cursor (the red element): vertical line sweeping through the year + month name + state chips
        const cm = clamp(Math.floor(curM), 1, 12); if (cu > 0.01 || t > t0 + 1) { g.save(); g.globalAlpha *= clamp((t - t0 - 0.8) * 2, 0, 1); g.beginPath(); g.moveTo(curX, by + 44); g.lineTo(curX, by + 64 + n * RH); ui.ink(g, 5, P.red); circ(g, curX, by + 44, 9, P.red, 0);
          ui.tag(g, MONL[cm - 1], curX, by + 64 + n * RH + 34, { size: F.small, color: P.red }); g.restore(); }
        if (cu > 0.4) items.forEach((it, i) => { const y = by + 64 + i * RH, op = isOpen(it, cm), cc = ease.back(seg(t, t1 + 0.5, t1 + 1.0)) ; g.save(); g.translate(bx + BW - 60, y + (RH - 20) / 2); g.scale(cc, cc); ui.rr(g, -64, -24, 128, 48, 24); ui.fill(g, P.paper); ui.ink(g, 3, op ? P.ink : P.mid); ui.caption(g, op ? "open" : "closed", 0, 2, { size: F.small, color: op ? P.ink : P.mid, weight: 800 }); g.restore(); });
        // map: route follows the first item's state at the cursor month
        if (hasMap) { g.save(); g.translate(CARD, CARD + 20); drawMap(g, M, t, { compass: false, scale: false }); const op = isOpen(items[0], cm), ru = ease.io(seg(t, t0 + 0.2, t0 + 1.5));
          stroke(g, route.upTo(ru), 11, "rgba(251,248,241,.9)"); if (op) stroke(g, route.upTo(ru), 6, P.ink2); else { stroke(g, route.upTo(ru), 5, P.mid, [10, 16], 0); ice.forEach((q, i) => icon(g, "iceFloe", q[0], q[1], 84, { seed: 20 + i, t })); }
          if (op && ru > 0.9) { const [x, y, a] = route.at(((t * 90) % route.len)); vehicle(g, "ship", x, y, a, 100, t, route.seed, false); }
          [d.map.from, d.map.to].forEach((nm, k) => { if (nm) { const p = route.at(k ? route.len : 0); ui.pin(g, p[0], p[1] - 2, k === 1 && false, 0.9); ui.tag(g, nm, p[0] + (k ? -10 : 10), p[1] - 56, { size: F.small }); } }); g.restore(); }
        if (d.cap) ui.caption(g, d.cap, w / 2, h - 36, { size: F.cap, color: P.ink2, weight: 700 });
      },
    };
  },
};
