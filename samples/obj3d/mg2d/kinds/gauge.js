// kind: gauge (family: numbers) - a dial meter: bezel + screws, tick scale, coloured zone bands, a needle that sweeps with a damped overshoot and settles on the value,
// a digital readout window and zone labels; optional context object.
// data: { value: 72, min: 0, max: 100, unit: "% full", label: "Reservoir", zones: [{ to: 30, label: "Low" }, { to: 70, label: "Normal" }, { to: 100, label: "Critical" }] (zone `to` = upper bound; last should be max),
//         cap: "...", note: "highest since 2011" (optional), object: "oil" (optional small object under the dial) }
// focus ids: "dial" (the meter + needle), "zones" (zone bands + zone label for the value's zone, red)
import * as H from "./_h_numcmp.js";
export default {
  name: "gauge", family: "numbers",
  doc: "Dial meter with bezel, ticks, zone bands, damped needle swing, digital readout and zone labels.",
  example: [{ value: 82, min: 0, max: 100, unit: "% full", label: "Gas storage", zones: [{ to: 30, label: "Low" }, { to: 70, label: "Normal" }, { to: 100, label: "Full" }], cap: "European gas storage", note: "highest in a decade", object: "gas" },
            { value: 3.4, min: 0, max: 5, unit: "minutes", label: "Queue time", zones: [{ to: 1.5, label: "Quick" }, { to: 3, label: "Slow" }, { to: 5, label: "Jammed" }], cap: "Border queue", object: "truck" }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { fmt, lab, sit, line, flag, tw, hashSeed, ell } = H;
    const mn = d.min ?? 0, mx = d.max ?? 100, Z = (d.zones ?? [{ to: mx }]).map((z, i, a) => ({ ...z, from: i ? a[i - 1].to : mn })), val = d.value, zi = Z.findIndex(z => val <= z.to), zr = zi < 0 ? Z.length - 1 : zi;
    const w = 1500, h = 900, cx = 640, cy = 560, R = 390, A0 = Math.PI * 0.82, A1 = Math.PI * 2.18, ang = v => lerp(A0, A1, clamp((v - mn) / (mx - mn), 0, 1));
    const zc = i => i === zr ? P.red : [P.stone2, P.water2, P.sand2, P.stone][i % 4];
    return {
      w, h, focus: [{ id: "dial", x: 100, y: 120, w: 1080, h: 720 }, { id: "zones", x: 150, y: 120, w: 1200, h: 740 }],
      draw(g, t, at) {
        const t0 = at.dial ?? 0, t1 = at.zones ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        // housing: square plate + round bezel
        const bu = ease.back(seg(t, t0 - 0.2, t0 + 0.6)); g.save(); g.translate(cx, cy); g.scale(bu, bu);
        ui.shadow(g, () => { g.beginPath(); g.arc(0, 0, R + 70, 0, 7); }, 8, 16); g.beginPath(); g.arc(0, 0, R + 70, 0, 7); const gr = g.createRadialGradient(-80, -120, 40, 0, 0, R + 70); gr.addColorStop(0, "#77736a"); gr.addColorStop(1, P.ink2); g.fillStyle = gr; g.fill(); ui.ink(g, 4, P.ink);
        g.beginPath(); g.arc(0, 0, R + 36, 0, 7); ui.fill(g, P.paper); ui.ink(g, 3, P.ink); for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; g.beginPath(); g.arc(Math.cos(a) * (R + 52), Math.sin(a) * (R + 52), 7, 0, 7); ui.fill(g, P.mid); g.beginPath(); g.moveTo(Math.cos(a) * (R + 52) - 5, Math.sin(a) * (R + 52) - 2); g.lineTo(Math.cos(a) * (R + 52) + 5, Math.sin(a) * (R + 52) + 2); ui.ink(g, 1.5, P.ink); }
        g.restore();
        // zone bands (arcs), drawn in sequence; red = the zone containing the value
        const zu0 = seg(t, t0 + 0.2, t0 + 1.2), rIn = R - 78, rOut = R - 10;
        Z.forEach((z, i) => { const a0 = ang(z.from), a1 = ang(z.to), e = lerp(a0, a1, clamp(zu0 * Z.length - i, 0, 1)); if (e <= a0 + 0.001) return; const hot = i === zr && t > t1 - 0.3, pul = hot ? 8 * ease.back(seg(t, t1 - 0.2, t1 + 0.5)) : 0;
          g.beginPath(); g.arc(cx, cy, rOut + pul, a0 + 0.012, e - 0.012); g.arc(cx, cy, rIn, e - 0.012, a0 + 0.012, true); g.closePath(); ui.fill(g, zc(i)); ui.ink(g, 3, i === zr ? P.redInk : P.ink2); });
        // ticks + numerals
        const nT = 40, tu = seg(t, t0 + 0.4, t0 + 1.2); for (let i = 0; i <= nT * tu; i++) { const a = lerp(A0, A1, i / nT), mj = i % 5 === 0, r1 = rIn - 8, r2 = rIn - (mj ? 40 : 22); g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ui.ink(g, mj ? 4 : 2, P.ink); }
        for (let i = 0; i <= 8 * tu; i++) { const a = lerp(A0, A1, i / 8), v = lerp(mn, mx, i / 8), r = rIn - 76; ui.caption(g, fmt(v, mx - mn < 10 ? 1 : 0), cx + Math.cos(a) * r, cy + Math.sin(a) * r, { size: F.small, caps: false, spacing: 0, color: P.ink2, alpha: tu }); }
        // readout window under the hub
        const wu = ease.back(seg(t, t0 + 0.6, t0 + 1.2)); g.save(); g.translate(cx, cy + 150); g.scale(wu, wu); ui.rr(g, -140, -50, 280, 100, 12); ui.fill(g, P.ink); ui.ink(g, 4, P.ink2); ui.rr(g, -132, -42, 264, 84, 8); ui.fill(g, "#37352f");
        // needle: swings from min with damped overshoot
        const nu = seg(t, t0 + 0.5, t0 + 2.3), sw = ease.settle(nu), cur = lerp(mn, val, sw); ui.num(g, fmt(cur, mx - mn < 10 ? 1 : 0), 0, -4, { size: 64, color: P.paper }); if (d.unit) ui.caption(g, d.unit, 0, 30, { size: 20, color: P.hair, spacing: 2, alpha: 0 }); g.restore();
        if (d.unit) ui.caption(g, d.unit, cx, cy + 238, { size: F.small, color: P.ink2, alpha: wu });
        const na = ang(cur) + (nu > 0 && nu < 1 ? Math.sin(t * 40) * 0.004 * (1 - nu) : 0);
        g.save(); g.translate(cx, cy); g.rotate(na); ui.shadow(g, () => { g.beginPath(); g.moveTo(-40, -9); g.lineTo(R - 30, -2); g.lineTo(R - 30, 2); g.lineTo(-40, 9); g.closePath(); }, 4, 8, nu > 0 ? 1 : 0);
        if (nu > 0) { g.beginPath(); g.moveTo(-50, -10); g.lineTo(R - 20, -2.5); g.lineTo(R - 20, 2.5); g.lineTo(-50, 10); g.closePath(); ui.fill(g, P.red); ui.ink(g, 2.5, P.redInk); g.beginPath(); g.arc(-34, 0, 16, 0, 7); ui.fill(g, P.redInk); } g.restore();
        g.beginPath(); g.arc(cx, cy, 30, 0, 7); ui.fill(g, P.ink2); ui.ink(g, 4, P.ink); g.beginPath(); g.arc(cx, cy, 10, 0, 7); ui.fill(g, P.hair);
        // zone labels outside the dial (arrive at "zones"), the active zone red
        Z.forEach((z, i) => { if (!z.label) return; const zu = seg(t, t1 - 0.1 + i * 0.3, t1 + 0.45 + i * 0.3); if (zu <= 0) return; const a = ang((z.from + z.to) / 2), r = R + 130, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, R_ = i === zr;
          ui.pop(g, zu, x, y, () => ui.tag(g, z.label, 0, 0, { color: R_ ? P.redInk : P.ink, rot: Math.cos(a) * 0.04 })); line(g, cx + Math.cos(a) * (rOut + 14), cy + Math.sin(a) * (rOut + 14), cx + Math.cos(a) * (R + 78), cy + Math.sin(a) * (R + 78), 2, R_ ? P.red : P.mid); });
        // side column: label, note and the context object
        const sx = 1215, su = seg(t, t1, t1 + 0.7);
        if (d.label) lab(g, d.label, sx + 130, 250, { maxW: 280, color: P.ink2, weight: 700, alpha: seg(t, t0 + 1, t0 + 1.6) });
        if (d.object) { const ou = seg(t, t1 + 0.3, t1 + 1.1); if (ou > 0) { H.ground(g, sx - 20, sx + 280, 760, ou); ui.pop(g, ou, sx + 130, 760, () => { ell(g, 0, 4, 90, 10, 0.7); sit(g, hashSeed(K.seed, 5), d.object, 200, 0, 0, { t }); }, "settle"); } }
        if (d.note) { const nu2 = seg(t, t1 + 0.7, t1 + 1.4); if (nu2 > 0) ui.pop(g, nu2, sx + 130, 560, () => flag(g, d.note.length > 18 ? d.note.slice(0, d.note.lastIndexOf(" ", 18)) : d.note, 0, 0, { red: true })), nu2 > 0 && d.note.length > 18 && ui.pop(g, nu2, sx + 130, 630, () => flag(g, d.note.slice(d.note.lastIndexOf(" ", 18) + 1), 0, 0, { red: true })); }
      },
    };
  },
};
