// kind: stampedPermit (family: documents) - a permit form: header with seal, fields that fill in by typing, check boxes that tick, a signature that scribbles in, a barcode - then a rubber stamp comes down and lands (SH.stamp, the red element) with an ink splash and a small thud of the whole sheet.
// v3: 3 seeded layout variants (data.layout 0..2 forces one; default = stage seed % 3):
//   0 "form"        two field columns, check boxes in a row, stamp lands bottom-right
//   1 "slip"        narrow slip with a dark header band, one field column, checks listed down the side, stamp lands across the top-right corner
//   2 "certificate" wide landscape certificate with a double border, centred seal and title, three field columns, stamp lands bottom-centre
// data: { title:"Transit permit", no:"TP-2231", fields:[{ k:"Vessel", v:"MV Aurora" }...], checks:["Customs","Safety","Insurance"], sign:"A. Marlow" (drawn as a scribble), stamp:"APPROVED", cap, layout? }
// focus ids: "form" (fields type in, boxes tick, signature draws), "stamp" (the stamp slams down)
import { P, F, ease, seg, clamp, lerp, ui, rng, icon, sd, fit, chip, circ, measure, SH } from "./_srd.js";
import { sheet, typed, typing, tick, barcode } from "./_srd3.js";
const NV = 3;
export default {
  name: "stampedPermit", family: "documents", variants: NV,
  doc: "Permit form with typed fields, ticked boxes, a signature scribble and a slamming stamp; 3 seeded layouts (form, slip, certificate).",
  example: [
    { title: "Transit permit", no: "TP-2231", cap: "Cleared to pass", stamp: "APPROVED", sign: "A. Marlow", fields: [{ k: "Vessel", v: "MV Aurora" }, { k: "Flag", v: "Liberia" }, { k: "Cargo", v: "Crude oil, 280,000 t" }, { k: "Draft", v: "19.8 m" }, { k: "From", v: "Ras Tanura" }, { k: "To", v: "Rotterdam" }], checks: ["Customs", "Safety", "Insurance"] },
    { title: "Export licence", no: "EL-0917", stamp: "DENIED", sign: "R. Okafor", fields: [{ k: "Item", v: "Lithography tool" }, { k: "Buyer", v: "Fab 7" }, { k: "Value", v: "$140 million" }, { k: "Dest.", v: "Shenzhen" }], checks: ["Security review", "Origin check"] },
  ],
  build(d, K) {
    const r = K.rng, V = d.layout ?? (Math.abs(K.seed | 0) % NV), F0 = d.fields, nf = F0.length, CK = d.checks ?? [], seed = sd(r);
    const cols = [2, 1, 3][V], rows = Math.ceil(nf / cols), RH = [112, 104, 108][V], PW = [1180, 820, 1500][V], HT = [176, 190, 250][V];
    const checksSide = V === 1, PH = V === 1 ? Math.max(HT + 60 + rows * RH + 360, HT + 80 + CK.length * 70 + 360) : HT + 56 + rows * RH + (CK.length ? 110 : 20) + 330;
    const w = PW + 240, h = PH + 200, px = 120, py = 70;
    const sig = (() => { const q = rng(seed + 5), pts = []; let x = 0; for (let i = 0; i < 46; i++) { x += q.range(5, 11); pts.push([x, Math.sin(i * 0.9) * q.range(8, 24) + (i % 7 === 3 ? -22 : 0)]); } return pts; })();
    const colW = (V === 1 ? PW - 380 : (PW - 120) / cols), fx = i => 60 + (i % cols) * colW, fy = i => HT + 56 + Math.floor(i / cols) * RH;
    const stampAt = [[PW - 280, PH - 170], [PW - 190, HT + 40], [PW / 2 + 260, PH - 160]][V];
    const focus = [
      [{ id: "form", x: px - 60, y: py - 30, w: PW + 120, h: Math.min(PH + 60, 900) }, { id: "stamp", x: px + PW - 760, y: py + PH - 620, w: 900, h: 700 }],
      [{ id: "form", x: px - 60, y: py - 30, w: PW + 120, h: PH + 60 }, { id: "stamp", x: px + PW - 620, y: py - 30, w: 760, h: 640 }],
      [{ id: "form", x: px - 60, y: py - 30, w: PW + 120, h: PH + 60 }, { id: "stamp", x: px + PW / 2 - 300, y: py + PH - 620, w: 1000, h: 680 }]][V];
    return {
      w, h, focus, layout: V,
      draw(g, t, at) {
        const t0 = at.form ?? 0, t1 = at.stamp ?? t0 + 2.6, imp = t1 + 0.35, th = t > imp ? Math.exp(-(t - imp) * 9) * Math.sin((t - imp) * 55) * 4 : 0; ui.base(g, w, h, { r: 18, rule: false }); g.save(); g.translate(px + th * 0.4, py + th); sheet(g, 0, 0, PW, PH);
        // header
        if (V === 0) { circ(g, 90, 100, 52, P.paper2, 3.5); circ(g, 90, 100, 40, null, 1.6); icon(g, "shield", 90, 102, 62, { seed, t }); ui.caption(g, d.title, 170, 84, { size: F.big * 0.5, align: "left", color: P.ink, weight: 800 }); if (d.no) ui.caption(g, "No. " + d.no, 170, 136, { size: F.small, align: "left", color: P.mid, caps: false, spacing: 1 }); g.beginPath(); g.moveTo(50, HT); g.lineTo(PW - 50, HT); ui.ink(g, 4, P.ink2); }
        if (V === 1) { ui.rr(g, 24, 24, PW - 48, HT - 40, 10); ui.fill(g, P.ink2); circ(g, 96, HT / 2 + 2, 44, P.paper, 3); icon(g, "shield", 96, HT / 2 + 4, 54, { seed, t }); ui.caption(g, d.title, 166, HT / 2 - 18, { size: F.cap * 1.3, align: "left", color: P.paper, weight: 800 }); if (d.no) ui.caption(g, "No. " + d.no, 166, HT / 2 + 30, { size: F.small, align: "left", color: P.hair, caps: false, spacing: 1 }); }
        if (V === 2) { ui.rr(g, 22, 22, PW - 44, PH - 44, 6); ui.ink(g, 3, P.ink2); ui.rr(g, 34, 34, PW - 68, PH - 68, 4); ui.ink(g, 1.4, P.ink2); for (const [cx, cy] of [[34, 34], [PW - 34, 34], [34, PH - 34], [PW - 34, PH - 34]]) { circ(g, cx, cy, 12, P.paper, 2); circ(g, cx, cy, 5, P.ink2, 0); }
          circ(g, PW / 2, 96, 50, P.paper2, 3.5); circ(g, PW / 2, 96, 38, null, 1.6); icon(g, "shield", PW / 2, 98, 58, { seed, t }); ui.caption(g, d.title, PW / 2, 186, { size: F.big * 0.48, color: P.ink, weight: 800 }); if (d.no) ui.caption(g, "No. " + d.no, PW / 2, 228, { size: F.small, color: P.mid, caps: false, spacing: 1 }); g.beginPath(); g.moveTo(PW / 2 - 300, HT - 4); g.lineTo(PW / 2 + 300, HT - 4); ui.ink(g, 2.5, P.ink2); }
        // fields: label above, value typed on an underline
        const tt = t0 + 0.2; F0.forEach((f, i) => { const x = fx(i), y = fy(i), w2 = colW - 60, ts = tt + i * 0.55, lu = ease.io(seg(t, ts - 0.2, ts + 0.3));
          ui.caption(g, f.k, x, y, { size: F.small, align: "left", color: P.mid, weight: 700 }); g.beginPath(); g.moveTo(x, y + 62); g.lineTo(x + w2 * lu, y + 62); ui.ink(g, 2.5, P.ink2);
          const s = typed(f.v, t, ts, 22), caret = typing(f.v, t, ts, 22) && Math.floor(t * 4) % 2 === 0; ui.caption(g, s + (caret ? "│" : ""), x + 6, y + 36, { size: F.cap, align: "left", color: P.ink, weight: 600, caps: false, spacing: 0 }); });
        // check boxes tick one by one (a row, or a list down the right side of the slip)
        const tc = t0 + 0.2 + nf * 0.55; CK.forEach((c, i) => { const x = checksSide ? PW - 300 : 60 + i * ((PW - 120) / Math.max(1, CK.length)), y = checksSide ? HT + 60 + i * 70 : fy(0) + rows * RH + 24, ts = tc + i * 0.45;
          ui.rr(g, x, y, 44, 44, 6); ui.fill(g, P.paper); ui.ink(g, 3, P.ink2); tick(g, x + 22, y + 22, 36, seg(t, ts, ts + 0.35), P.ink); fit(g, c, x + 62, y + 24, checksSide ? 230 : (PW - 120) / Math.max(1, CK.length) - 80, { size: F.small, align: "left", color: P.ink2, weight: 700 }); });
        if (checksSide) { g.beginPath(); g.moveTo(PW - 330, HT + 30); g.lineTo(PW - 330, HT + 40 + Math.max(1, CK.length) * 70); ui.ink(g, 1.5, P.hair); }
        // signature line + scribble, barcode
        const sx0 = V === 2 ? 120 : 60; g.beginPath(); g.moveTo(sx0, PH - 100); g.lineTo(sx0 + 400, PH - 100); ui.ink(g, 2.5, P.ink2); ui.caption(g, "Signed", sx0, PH - 62, { size: F.small, align: "left", color: P.mid, weight: 700 }); const su = seg(t, tc + CK.length * 0.45 + 0.2, tc + CK.length * 0.45 + 1.4);
        if (su > 0) { g.save(); g.translate(sx0 + 30, PH - 128); g.beginPath(); const m = Math.floor(sig.length * su); sig.slice(0, Math.max(2, m)).forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); ui.ink(g, 3.5, "#2c3a66"); g.restore(); }
        barcode(g, V === 1 ? 60 : sx0 + 480, V === 1 ? PH - 200 : PH - 120, 200, 50, seed + 9, seg(t, t0, t0 + 1.5)); g.restore();
        // the stamp: tool descends, SH.stamp lands (red), splash dots
        const fall = clamp((t - (t1 - 0.4)) / 0.75, 0, 1), landed = t >= imp, stx = px + stampAt[0], sty = py + stampAt[1], rot = [-0.12, 0.16, -0.05][V];
        if (fall > 0 && !landed) { g.save(); g.translate(stx, sty - (1 - fall * fall) * 520); g.scale(1 + (1 - fall) * 0.35, 1 + (1 - fall) * 0.35); ui.shadow(g, () => ui.rr(g, -90, -110, 180, 120, 14), 18 * (1 - fall) + 4, 26 * (1 - fall) + 6); ui.rr(g, -90, -110, 180, 120, 14); ui.fill(g, P.ink2); ui.ink(g, 4); ui.rr(g, -32, -190, 64, 90, 26); ui.fill(g, P.ink); g.restore(); }
        if (landed) { const u = seg(t, imp, imp + 0.6); g.save(); g.translate(stx + th * 0.3, sty + th); g.rotate(rot); SH.stamp(g, rng(7), { s: V === 1 ? 260 : 300, u, red: true, text: d.stamp ?? "APPROVED" }); const sp = seg(t, imp, imp + 0.5), q = rng(31); for (let i = 0; i < 22; i++) { const a = q() * 6.283, rr = 150 + q() * 90 * sp; g.globalAlpha = (1 - sp) * 0.8; circ(g, Math.cos(a) * rr, Math.sin(a) * rr, 2 + q() * 5, P.red, 0); } g.restore(); }
        if (d.cap) ui.caption(g, d.cap, w / 2, h - 44, { size: F.cap, color: P.ink2, weight: 700 });
      },
    };
  },
};
