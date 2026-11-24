// kind: distanceRuler (family: space) - a paper ruler laid across a gap with ticks + labels, a red measured span and a big counting numeral.
// Distances under ~300 km are drawn as a generated schematic strait (two seeded coasts, SH landmarks and boats, to scale); longer ones on the real map (Natural Earth data).
// data: { a:{n,ll,what?:"lighthouse"}, b:{n,ll,what?:"building"}, km?:2.8 (else measured from the coordinates), unit:"km", region?, cap:"Narrowest point", note }
// focus ids: "ruler" (the map/strait with the ruler sliding in), "gap" (the red span + numeral)
import { P, F, ease, seg, clamp, lerp, ui, rng, makeMap, drawMap, place, haversine, pinTag, icon, sd, fmt, PADM, circ, TAU, scaleBar, tagSize, measure } from "./_srd.js";
import { niceStepN, mixc } from "./_srd2.js";
export default {
  name: "distanceRuler", family: "space",
  doc: "Ruler with ticks across a map or generated strait with a red measured span and a counting numeral.",
  example: [
    { a: { n: "Tarifa", ll: [-5.6, 36.0], what: "lighthouse" }, b: { n: "Tangier", ll: [-5.8, 35.76], what: "building" }, km: 14, cap: "Strait of Gibraltar", note: "narrowest crossing" },
    { a: { n: "Dover", ll: [1.32, 51.13], what: "lighthouse" }, b: { n: "Calais", ll: [1.85, 50.95], what: "crane" }, km: 34, cap: "Dover to Calais" },
    { a: { n: "Singapore", ll: [103.8, 1.3] }, b: { n: "Aden", ll: [45.0, 12.8] }, region: [30, -8, 115, 28], cap: "Straight line across the ocean" },
  ],
  build(d, K) {
    const r = K.rng, A = place(d.a), B = place(d.b), span = d.km ?? haversine(A.ll, B.ll), unit = d.unit ?? "km", schematic = d.schematic ?? span < 300, CARD = PADM, PW = 1300, PH = 640;
    let M = null, pa, pb, coast = null;
    if (!schematic) { M = makeMap({ region: d.region, pts: [A.ll, B.ll], rng: r, h: PH, w: PW }); pa = M.f(A.ll); pb = M.f(B.ll); if (pa[0] > pb[0]) [pa, pb] = [pb, pa]; }
    else { const ya = PH * r.range(0.36, 0.48), yb = ya + PH * r.range(-0.12, 0.16), gapPx = PW * 0.46; pa = [PW / 2 - gapPx / 2, ya]; pb = [PW / 2 + gapPx / 2, yb];
      const mk = (x0, dirx, yy) => { const ph = [r.range(0, 6), r.range(0, 6), r.range(0, 6)], am = [r.range(10, 30), r.range(6, 16), r.range(3, 8)]; const f = y => x0 + dirx * (am[0] * Math.sin(y / 96 + ph[0]) + am[1] * Math.sin(y / 41 + ph[1]) + am[2] * Math.sin(y / 17 + ph[2]));
        const off = x0 - f(yy) ; return y => f(y) + off; };
      coast = { L: mk(pa[0] - 6, -1, ya), R: mk(pb[0] + 6, 1, yb), seed: sd(r) }; }
    const pxKm = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) / span, major = niceStepN(span / 4), minor = major / 5, w = PW + CARD * 2, h = PH + CARD * 2 + 70, mx = CARD, my = CARD, ang = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]);
    const land = new Path2D(); if (schematic) { land.moveTo(0, -10); for (let y = -10; y <= PH + 10; y += 8) land.lineTo(coast.L(y), y); land.lineTo(0, PH + 10); land.closePath(); land.moveTo(PW, -10); for (let y = -10; y <= PH + 10; y += 8) land.lineTo(coast.R(y), y); land.lineTo(PW, PH + 10); land.closePath(); }
    const decor = schematic ? Array.from({ length: 9 }, () => { const left = r() < 0.5, y = r.range(40, PH - 40), x = left ? coast.L(y) - r.range(70, 400) : coast.R(y) + r.range(70, 400); return { x, y, what: r.pick(["tree", "palmTree", "hill", "tree"]), s: r.range(70, 130), seed: sd(r) }; }).filter(q => q.x > 20 && q.x < PW - 20 && Math.hypot(q.x - pa[0], q.y - pa[1]) > 120 && Math.hypot(q.x - pb[0], q.y - pb[1]) > 120).sort((a, b) => a.y - b.y) : [];
    const boats = schematic ? Array.from({ length: 2 }, () => ({ x: r.range(0.35, 0.65), y: r.range(0.55, 0.9) * PH, s: r.range(80, 100), seed: sd(r), sp: r.range(0.02, 0.04) })) : [];
    const mid = [(pa[0] + pb[0]) / 2 + mx, (pa[1] + pb[1]) / 2 + my];
    return {
      w, h, focus: [{ id: "ruler", x: 0, y: 0, w, h }, { id: "gap", x: clamp(mid[0] - 560, 0, w - 1120), y: clamp(mid[1] - 330, 0, h - 660), w: 1120, h: 660 }],
      draw(g, t, at) {
        const t0 = at.ruler ?? 0, t1 = at.gap ?? t0 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 }); g.save(); g.translate(mx, my);
        if (M) drawMap(g, M, t); else { g.save(); ui.rr(g, 0, 0, PW, PH, 12); g.clip(); g.fillStyle = P.water; g.fillRect(0, 0, PW, PH);
          g.strokeStyle = P.water2; g.lineWidth = 2.2; g.lineCap = "round"; for (let i = 0; i < 40; i++) { const x = (i * 331) % PW, y = (i * 173) % PH, dx = Math.sin(t * 0.5 + i) * 6; g.beginPath(); g.moveTo(x - 16 + dx, y); g.quadraticCurveTo(x - 8 + dx, y - 6, x + dx, y); g.quadraticCurveTo(x + 8 + dx, y + 6, x + 16 + dx, y); g.stroke(); }
          g.save(); g.translate(5, 8); g.fillStyle = P.shadow; g.fill(land); g.restore(); g.lineJoin = "round"; g.strokeStyle = P.ink; g.lineWidth = 5; g.stroke(land); g.fillStyle = P.paper; g.fill(land);
          decor.forEach(q => { icon(g, q.what, q.x, q.y, q.s, { seed: q.seed, t }); }); boats.forEach((b, i) => { const x = (((b.x + t * b.sp * (i ? -1 : 1)) % 1) + 1) % 1 * PW * 0.3 + PW * 0.35; icon(g, i ? "skiff" : "fishingBoat", x, b.y, b.s, { seed: b.seed, t, flip: !!i, view: "side" }); });
          g.restore(); ui.rr(g, 0, 0, PW, PH, 12); ui.ink(g, 3, P.ink2); scaleBar(g, { w: PW, pxKm, box: [0, 0, 0, 0] }, 36, PH - 52); }
        // end landmarks + pins
        for (const [p, q, nm, k] of [[A, pa, 0, 0], [B, pb, 1, 1]]) { const u = ease.out(seg(t, t0 - 0.2 + k * 0.3, t0 + 0.4 + k * 0.3)); if (schematic) { g.save(); g.globalAlpha *= u; icon(g, p.what ?? (k ? "building" : "lighthouse"), q[0] + (k ? 90 : -90), q[1] - 20, 130, { seed: 7 + k, t }); g.restore(); }
          pinTag(g, p.n, q[0], q[1], q[0] + (k ? 120 : -120), q[1] + 70, u, {}); }
        // the ruler: slides in, ticks reveal along its length
        const ru = ease.out(seg(t, t0 + 0.3, t0 + 1.3)), ext = 70, L = span * pxKm, rh = 68; g.save(); g.translate(pa[0], pa[1]); g.rotate(ang); g.translate(0, (1 - ru) * 80 + 0); g.globalAlpha *= ru;
        g.translate(0, -rh / 2 - 6); ui.shadow(g, () => ui.rr(g, -ext, 0, L + ext * 2, rh, 8), 4, 10); ui.rr(g, -ext, 0, L + ext * 2, rh, 8); g.fillStyle = mixc(P.sand, P.paper, 0.35); g.fill(); ui.ink(g, 3, P.ink);
        const tu = ease.io(seg(t, t0 + 0.6, t0 + 1.9)); for (let v = 0, i = 0; v <= span + 1e-6; v += minor, i++) { const x = v * pxKm; if (x > L * tu + 1) break; const mj = i % 5 === 0; g.beginPath(); g.moveTo(x, rh); g.lineTo(x, rh - (mj ? 30 : 16)); ui.ink(g, mj ? 3 : 1.8, P.ink2); if (mj) { g.save(); ui.caption(g, fmt(v), x, rh - 44, { size: F.small, color: P.ink2, caps: false, spacing: 0, weight: 700 }); g.restore(); } }
        g.restore();
        // red measured span + numeral (count up)
        const su = ease.io(seg(t, t1 - 0.2, t1 + 0.9)), nu = ease.out(seg(t, t1, t1 + 1.4));
        if (su > 0) { g.save(); g.translate(pa[0], pa[1]); g.rotate(ang); const e = L * su; g.translate(0, rh / 2 + 18); g.beginPath(); g.moveTo(0, 0); g.lineTo(e, 0); ui.ink(g, 8, P.red); for (const x of [0, e]) { g.beginPath(); g.moveTo(x, -18); g.lineTo(x, 18); ui.ink(g, 6, P.red); }
          g.beginPath(); g.moveTo(e, 0); g.lineTo(e - 22, -12); g.lineTo(e - 22, 12); g.closePath(); ui.fill(g, P.red); g.restore();
          const cx = (pa[0] + pb[0]) / 2, cy = (pa[1] + pb[1]) / 2 + 150, s = fmt(span * nu, span < 20 ? 1 : 0) + " " + unit, W2 = measure(s, 84, 800) + 60; g.save(); g.globalAlpha *= clamp(su * 2, 0, 1); g.translate(cx, cy); ui.shadow(g, () => ui.rr(g, -W2 / 2, -62, W2, 124, 16), 4, 10); ui.rr(g, -W2 / 2, -62, W2, 124, 16); ui.fill(g, P.paper); ui.ink(g, 3, P.red); ui.num(g, s, 0, 2, { size: 84, color: P.red }); g.restore(); }
        g.restore(); if (d.cap) ui.caption(g, d.cap, w / 2, h - 36, { size: F.cap, color: P.ink2, weight: 700 });
        if (d.note && t > t1 + 1) { g.save(); g.globalAlpha *= seg(t, t1 + 1, t1 + 1.6); ui.tag(g, d.note, w / 2, my + 56, { size: F.small }); g.restore(); }
      },
    };
  },
};
