// kind: elevationProfile (family: space) - a terrain cross-section along a route: ink profile drawn left to right with strata, SH mountains in the far distance, altitude gridlines + labels,
// a vehicle riding the profile with a live altitude chip, and flagged peaks (the highest is red).
// data: { points:[{ km:0, alt:50, n?:"Pass" }...] (control points along the route), unit:"m", kmUnit:"km", vehicle:"truck|train", route:"Karakoram Highway", cap }
// focus ids: "profile" (the whole cross-section draws), "peak" (zoom on the highest point: flag, altitude, climb)
import { P, F, ease, seg, clamp, lerp, ui, rng, smooth, mkPath, icon, sd, fmt, PADM, measure, circ } from "./_srd.js";
import { mixc, niceStepN } from "./_srd2.js";
export default {
  name: "elevationProfile", family: "space",
  doc: "Terrain cross-section along a route with altitude labels, far mountains, a riding vehicle and a red highest peak.",
  example: [
    { route: "Karakoram Highway", cap: "Pakistan to China by road", unit: "m", vehicle: "truck", points: [{ km: 0, alt: 500, n: "Islamabad" }, { km: 150, alt: 1200 }, { km: 330, alt: 1500, n: "Besham" }, { km: 520, alt: 2300 }, { km: 700, alt: 2450, n: "Gilgit" }, { km: 850, alt: 2600 }, { km: 1000, alt: 4693, n: "Khunjerab Pass" }, { km: 1150, alt: 3200, n: "Tashkurgan" }, { km: 1300, alt: 1300 }] },
    { route: "Alps rail tunnel", cap: "Under the Alps", unit: "m", vehicle: "train", points: [{ km: 0, alt: 270, n: "Zurich" }, { km: 40, alt: 440 }, { km: 90, alt: 1100, n: "Erstfeld" }, { km: 120, alt: 549, n: "Tunnel" }, { km: 150, alt: 1000 }, { km: 190, alt: 230, n: "Lugano" }] },
  ],
  build(d, K) {
    const r = K.rng, pts0 = d.points.slice().sort((a, b) => a.km - b.km), CARD = PADM, PW = 1440, PH = 700, ml = 130, mr = 50, mt = 110, mb = 100, pw = PW - ml - mr, ph = PH - mt - mb, w = PW + CARD * 2, h = PH + CARD * 2 + 70, mx = CARD, my = CARD;
    const k0 = pts0[0].km, k1 = pts0[pts0.length - 1].km, amax = Math.max(...pts0.map(p => p.alt)), amin = Math.min(0, ...pts0.map(p => p.alt)), gs = niceStepN((amax - amin) / 4), aTop = Math.ceil(amax * 1.08 / gs) * gs;
    const X = km => ml + (km - k0) / (k1 - k0) * pw, Y = a => mt + ph - (a - amin) / (aTop - amin) * ph;
    const ctrl = pts0.map(p => [X(p.km), Y(p.alt)]), dense = smooth(ctrl, 14), ph1 = r.range(0, 6), ph2 = r.range(0, 6), amp = (aTop - amin) * 0.01 * ph / (aTop - amin);
    const prof = dense.map(([x, y], i) => [x, y + Math.sin(x * 0.09 + ph1) * amp * 1.4 + Math.sin(x * 0.31 + ph2) * amp * 0.7 * (i % 7 ? 1 : 0.4)]), path = mkPath(prof), hi = pts0.reduce((a, b) => b.alt > a.alt ? b : a), peakPx = [X(hi.km), Y(hi.alt)];
    const far = [0.18, 0.5, 0.82].map((u, i) => ({ x: ml + pw * (u + r.range(-0.04, 0.04)), s: pw * r.range(0.45, 0.62), seed: sd(r) })), flags = pts0.filter(p => p.n || p === hi);
    const yAt = x => { const i = prof.findIndex(q => q[0] >= x); if (i <= 0) return prof[0][1]; const a = prof[i - 1], b = prof[i], u = (x - a[0]) / Math.max(1e-6, b[0] - a[0]); return lerp(a[1], b[1], u); };
    const fb = { x: clamp(peakPx[0] + mx - 560, 0, w - 1120), y: 0, w: 1120, h: h - 0 };
    return {
      w, h, focus: [{ id: "profile", x: 0, y: 0, w, h }, { id: "peak", x: fb.x, y: clamp(peakPx[1] + my - 360, 0, h - 720), w: 1120, h: 720 }],
      draw(g, t, at) {
        const t0 = at.profile ?? 0, t1 = at.peak ?? t0 + 2.6; ui.card(g, 0, 0, w, h, { r: 18 }); g.save(); g.translate(mx, my);
        // gridlines + altitude labels
        for (let a = Math.ceil(amin / gs) * gs; a <= aTop + 1e-6; a += gs) { const y = Y(a); g.beginPath(); g.moveTo(ml, y); g.lineTo(PW - mr, y); ui.ink(g, 1.5, P.lite); ui.caption(g, fmt(a), ml - 16, y, { size: F.small, align: "right", color: P.mid, caps: false, spacing: 0 }); }
        ui.caption(g, d.unit ?? "m", ml - 16, mt - 44, { size: F.small, align: "right", color: P.ink2, caps: false, spacing: 0, weight: 700 });
        const ku = niceStepN((k1 - k0) / 6); g.beginPath(); g.moveTo(ml, PH - mb); g.lineTo(PW - mr, PH - mb); ui.ink(g, 3, P.ink2); for (let k = Math.ceil(k0 / ku) * ku; k <= k1 + 1e-6; k += ku) { const x = X(k); g.beginPath(); g.moveTo(x, PH - mb); g.lineTo(x, PH - mb + 14); ui.ink(g, 2, P.ink2); ui.caption(g, fmt(k), x, PH - mb + 44, { size: F.small, color: P.ink2, caps: false, spacing: 0 }); }
        ui.caption(g, d.kmUnit ?? "km", PW - mr, PH - mb + 82, { size: F.small, align: "right", color: P.mid, caps: false, spacing: 0, weight: 700 });
        // the profile reveals left to right with the vehicle at its edge
        const u = ease.io(seg(t, t0 - 0.1, t0 + 2.3)), xe = ml + pw * u; g.save(); g.beginPath(); g.rect(0, 0, xe + 4, PH); g.clip();
        far.forEach(f => { g.save(); g.globalAlpha = 0.55; icon(g, "mountain", f.x, PH - mb - 150, f.s, { seed: f.seed, t }); g.restore(); });
        g.beginPath(); g.moveTo(prof[0][0], PH - mb); prof.forEach(q => g.lineTo(q[0], q[1])); g.lineTo(prof[prof.length - 1][0], PH - mb); g.closePath(); ui.shadow(g, () => { g.beginPath(); g.moveTo(prof[0][0], PH - mb); prof.forEach(q => g.lineTo(q[0], q[1])); g.lineTo(prof[prof.length - 1][0], PH - mb); g.closePath(); }, 0, 8);
        g.fillStyle = mixc(P.sand, P.stone, 0.4); g.fill(); g.save(); g.clip(); for (let k = 1; k <= 4; k++) { g.beginPath(); prof.forEach((q, i) => i ? g.lineTo(q[0], q[1] + k * 46 + Math.sin(q[0] * 0.02 + k) * 6) : g.moveTo(q[0], q[1] + k * 46)); ui.ink(g, 1.6, k % 2 ? "rgba(139,134,123,.45)" : "rgba(139,134,123,.28)"); }
        g.restore(); g.beginPath(); prof.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); ui.ink(g, 6, P.ink); g.restore();
        // sea level / zero line + vehicle riding the edge
        if (u > 0.01 && u < 1.0) { const x = xe, y = yAt(x), ahead = yAt(x + 14), ang = Math.atan2(ahead - y, 14); icon(g, d.vehicle ?? "truck", x, y - 34, 104, { seed: 3, t, rot: clamp(ang, -0.5, 0.5) }); }
        const alt = amin + (aTop - amin) * (PH - mb - yAt(Math.min(xe, PW - mr - 1)) ) / ph; const cu = ease.out(seg(t, t0, t0 + 0.4)) * (1 - ease.io(seg(t, t0 + 2.3, t0 + 2.8)));
        if (cu > 0.02) { g.save(); g.globalAlpha *= cu; const yy = yAt(Math.min(xe, PW - mr - 1)) - 120; ui.tag(g, fmt(alt, 0) + " " + (d.unit ?? "m"), clamp(xe, ml + 110, PW - mr - 110), yy, { size: F.small }); g.restore(); }
        // flagged points: pole + tag + altitude numeral (land as the line passes them)
        flags.forEach((p, i) => { const x = X(p.km), y = yAt(x), red = p === hi, pu = ease.back(seg(t, (red ? t1 - 0.1 : t0 + 0.2 + (x - ml) / pw * 2.3), (red ? t1 + 0.5 : t0 + 0.7 + (x - ml) / pw * 2.3))); if (pu <= 0 || x > xe) return; g.save(); g.translate(x, y); g.scale(1, pu);
          g.beginPath(); g.moveTo(0, 0); g.lineTo(0, red ? -150 : -90); ui.ink(g, red ? 4 : 2.5, red ? P.red : P.ink2); circ(g, 0, 0, 7, red ? P.red : P.ink, 0); g.restore();
          if (pu > 0.7) { if (p.n) ui.tag(g, p.n, x, y - (red ? 190 : 126), { size: F.small, color: red ? P.red : P.ink }); ui.caption(g, fmt(p.alt) + " " + (d.unit ?? "m"), x, y - (red ? 244 : 170) + (p.n ? 0 : 38), { size: red ? F.cap : F.small, color: red ? P.red : P.ink2, caps: false, spacing: 0, weight: 800 }); } });
        g.restore(); if (d.cap) ui.caption(g, d.cap, w / 2, h - 36, { size: F.cap, color: P.ink2, weight: 700 });
        if (d.route) { g.save(); g.globalAlpha *= seg(t, t0, t0 + 0.6); ui.tag(g, d.route, mx + ml + 190, my + 54, { size: F.small }); g.restore(); }
      },
    };
  },
};
