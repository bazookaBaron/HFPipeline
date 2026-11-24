// kind: zoomThrough (family: space) - three nested frames, globe -> region -> place, joined by dashed zoom cones: an orthographic globe with a red box, a regional paper map with a red box,
// and a generated close-up of the place (coast, quay, SH landmark, boats) with scale bars on every level.
// data: { target:{ n:"Port of Rotterdam", ll:[4.4,51.9], what:"crane" }, regionSpan:9 (degrees half-width), region?:[box], names:["Earth","Europe","Port"] (small level captions), cap, note }
// focus ids: "globe" (globe + region frames), "region" (region + place frames), "place" (the place close-up with its scale)
import { P, F, ease, seg, clamp, lerp, ui, rng, makeMap, drawMap, drawGlobe, place, pinTag, icon, sd, fmt, PADM, D2R, circ, TAU, mkPath, tagSize } from "./_srd.js";
import { niceStepN } from "./_srd2.js";
export default {
  name: "zoomThrough", family: "space",
  doc: "Globe, region and place frames nested with dashed zoom cones and scale bars on each level.",
  example: [
    { target: { n: "Port of Rotterdam", ll: [4.1, 51.95], what: "crane" }, regionSpan: 9, names: ["Earth", "Europe", "The port"], cap: "Europe's biggest port", note: "13,000 ships a year" },
    { target: { n: "Hormuz", ll: [56.4, 26.6], what: "tanker" }, regionSpan: 7, names: ["Earth", "The Gulf", "The strait"], cap: "Zooming into the strait" },
  ],
  build(d, K) {
    const r = K.rng, T0 = place(d.target), sp = d.regionSpan ?? 9, M = makeMap({ region: d.region ?? [T0.ll[0] - sp, T0.ll[1] - sp * 0.62, T0.ll[0] + sp, T0.ll[1] + sp * 0.62], pts: [T0.ll], rng: r, w: 660, h: 500 }), CARD = PADM, FW = 660, FH = 500, GR = 190, GW = 440;
    const ax = CARD + 20, bx = ax + GW + 120, cx = bx + FW + 120, w = cx + FW + CARD + 20, h = FH + CARD * 2 + 100, fy = CARD + 40, gcx = ax + GW / 2, gcy = fy + FH / 2, names = d.names ?? ["Earth", "Region", "Place"];
    const lon0 = T0.ll[0], lat0 = clamp(T0.ll[1] * 0.7, -50, 50), pa = M.f(T0.ll), seed = sd(r), bw = clamp(M.w * 0.18, 90, 150), bh = bw * 0.75;
    // close-up (generated): coast as seeded wavy diagonal band, quay polygon, landmark, boats, scale
    const ph = [r.range(0, 6), r.range(0, 6)], coast = x => FH * 0.62 + Math.sin(x / 90 + ph[0]) * 26 + Math.sin(x / 33 + ph[1]) * 8 - x * 0.12, land = new Path2D(); land.moveTo(0, FH + 10); for (let x = 0; x <= FW; x += 8) land.lineTo(x, coast(x)); land.lineTo(FW, FH + 10); land.closePath();
    const kmBar = niceStepN(0.2 * FW / 60), quay = { x: FW * 0.42, y: coast(FW * 0.42) };
    const trees = Array.from({ length: 5 }, () => { const x = r.range(40, FW - 40), y = coast(x) + r.range(70, 150); return { x, y, s: r.range(60, 90), seed: sd(r), w: r() < 0.5 ? "tree" : "palmTree" }; }).filter(q => q.y < FH - 20);
    const boats = Array.from({ length: 2 }, (_, i) => ({ y: r.range(0.18, 0.4) * FH, s: r.range(80, 100), seed: sd(r), k: i }));
    const frame = (g, x, y, ttl, u) => { g.save(); g.globalAlpha *= clamp(u * 2, 0, 1); g.translate(x, y); ui.shadow(g, () => ui.rr(g, -14, -14, FW + 28, FH + 28, 18), 6, 12); g.restore(); };
    return {
      w, h, focus: [{ id: "globe", x: 0, y: 0, w: bx + FW + CARD, h }, { id: "region", x: bx - 110, y: 0, w: FW * 2 + 360, h }, { id: "place", x: cx - 140, y: 0, w: FW + 280, h }],
      draw(g, t, at) {
        const t0 = at.globe ?? 0, t1 = at.region ?? t0 + 2.6, t2 = at.place ?? t1 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 });
        const lab = (x, y, s, u) => { g.save(); g.globalAlpha *= clamp(u * 2, 0, 1); ui.caption(g, s, x, y, { size: F.small, color: P.mid, weight: 700 }); g.restore(); };
        // level 1: globe
        const u0 = ease.out(seg(t, t0 - 0.3, t0 + 0.6)); g.save(); g.translate(gcx, gcy); g.scale(0.9 + 0.1 * u0, 0.9 + 0.1 * u0); const pr = drawGlobe(g, GR, lon0 + Math.sin(t * 0.3) * 2, lat0), q = pr(T0.ll), s1 = ease.back(seg(t, t0 + 0.4, t0 + 1.0)), gbs = 44;
        g.save(); g.translate(q.x, q.y); g.scale(s1, s1); g.beginPath(); g.rect(-gbs / 2, -gbs * 0.34, gbs, gbs * 0.68); ui.fill(g, "rgba(200,38,29,.15)"); ui.ink(g, 4, P.red); g.restore(); g.restore();
        lab(gcx, fy + FH + 34, names[0] + " · 12,700 km", u0);
        // level 2: region map
        const u1 = ease.out(seg(t, t0 + 0.9, t0 + 1.7)), cone1 = ease.io(seg(t, t0 + 0.9, t0 + 1.7)); const bxL = gcx + q.x + gbs / 2, byL = gcy + q.y;
        if (cone1 > 0) { g.save(); g.setLineDash([12, 9]); g.lineDashOffset = -t * 18; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(bxL, byL + s * gbs * 0.34); g.lineTo(lerp(bxL, bx, cone1), lerp(byL + s * gbs * 0.34, s < 0 ? fy : fy + FH, cone1)); ui.ink(g, 3, P.red); } g.restore(); }
        g.save(); g.translate(bx, fy); g.globalAlpha *= 0.3 + 0.7 * u1; drawMap(g, M, t, { compass: false }); pinTag(g, T0.n, pa[0], pa[1], pa[0], pa[1] - 62, ease.out(seg(t, t1 - 0.1, t1 + 0.5)), { red: true });
        const s2 = ease.back(seg(t, t1 + 0.3, t1 + 0.9)); g.save(); g.translate(pa[0], pa[1]); g.scale(s2, s2); g.beginPath(); g.rect(-bw / 2, -bh / 2, bw, bh); ui.fill(g, "rgba(200,38,29,.12)"); ui.ink(g, 4, P.red); g.restore(); g.restore();
        lab(bx + FW / 2, fy + FH + 34, names[1], u1);
        // level 3: the place close-up
        const u2 = ease.out(seg(t, t1 + 0.9, t1 + 1.7)), cone2 = ease.io(seg(t, t1 + 0.9, t1 + 1.7)), bxR = bx + pa[0] + bw / 2, byR = fy + pa[1];
        if (cone2 > 0) { g.save(); g.setLineDash([12, 9]); g.lineDashOffset = -t * 18; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(bxR, byR + s * bh / 2); g.lineTo(lerp(bxR, cx, cone2), lerp(byR + s * bh / 2, s < 0 ? fy : fy + FH, cone2)); ui.ink(g, 3, P.red); } g.restore(); }
        g.save(); g.translate(cx, fy); g.globalAlpha *= 0.3 + 0.7 * u2; ui.rr(g, 0, 0, FW, FH, 12); g.save(); g.clip(); g.fillStyle = P.water; g.fillRect(0, 0, FW, FH);
        g.strokeStyle = P.water2; g.lineWidth = 2.2; g.lineCap = "round"; for (let i = 0; i < 16; i++) { const x = (i * 211) % FW, y = (i * 97) % (FH * 0.55), dx = Math.sin(t * 0.5 + i) * 6; g.beginPath(); g.moveTo(x - 16 + dx, y); g.quadraticCurveTo(x - 8 + dx, y - 6, x + dx, y); g.quadraticCurveTo(x + 8 + dx, y + 6, x + 16 + dx, y); g.stroke(); }
        g.save(); g.translate(5, 8); g.fillStyle = P.shadow; g.fill(land); g.restore(); g.lineJoin = "round"; g.strokeStyle = P.ink; g.lineWidth = 5; g.stroke(land); g.fillStyle = P.paper; g.fill(land);
        // quay: a paper pier into the water, landmark on it
        g.beginPath(); g.rect(quay.x - 30, quay.y - 90, 60, 100); ui.fill(g, P.stone); ui.ink(g, 3);
        trees.forEach(q => icon(g, q.w, q.x, q.y, q.s, { seed: q.seed, t })); boats.forEach(b => { const x = ((t * 14 * (b.k ? -1 : 1) + b.k * 260 + 80) % (FW + 200) + FW + 200) % (FW + 200) - 100; icon(g, b.k ? "tug" : "tanker", x, b.y, b.s, { seed: b.seed, t, flip: !!b.k }); });
        const s3 = ease.back(seg(t, t2 - 0.1, t2 + 0.6)); g.save(); g.translate(quay.x, quay.y - 64); g.scale(s3, s3); icon(g, T0.what ?? "crane", 0, -50, 170, { seed: seed, t }); g.restore();
        g.restore(); ui.rr(g, 0, 0, FW, FH, 12); ui.ink(g, 3, P.ink2);
        const sb = ease.out(seg(t, t2 + 0.2, t2 + 0.8)); g.save(); g.globalAlpha *= sb; g.translate(30, FH - 52); for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? P.paper : P.ink; g.fillRect(i * 50, -6, 50, 12); } g.beginPath(); g.rect(0, -6, 200, 12); ui.ink(g, 2, P.ink); ui.caption(g, fmt(kmBar) + " km", 220, 0, { size: F.small, align: "left", color: P.ink2, caps: false, spacing: 0 }); g.restore();
        if (s3 > 0.5) { pinTag(g, T0.n, quay.x, quay.y - 4, quay.x + 10, quay.y + 66, s3, { red: true }); }
        g.restore(); lab(cx + FW / 2, fy + FH + 34, names[2], u2);
        if (d.cap) ui.caption(g, d.cap, w / 2, h - 34, { size: F.cap, color: P.ink2, weight: 700 }); if (d.note && t > t2 + 0.6) { g.save(); g.globalAlpha *= seg(t, t2 + 0.6, t2 + 1.2); ui.tag(g, d.note, cx + FW - 150, fy + 52, { size: F.small }); g.restore(); }
      },
    };
  },
};
