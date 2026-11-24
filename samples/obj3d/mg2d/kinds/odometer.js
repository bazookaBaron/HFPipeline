// kind: odometer (family: numbers) - a rolling multi-digit counter built as a mechanical drum odometer (housing, windows, scrolling digit drums,
// carry-over rolling, gears), a unit plate and a context object that the number counts.
// data: { value: 48213, from: 0, unit: "containers", per: "a day", object: "container" (SH name or word), cap: "Moved through the port", note: "more than last year" (optional leader note),
//         decimals: 0 }
// focus ids: "count" (the odometer), "unit" (unit plate + context object + note)
const gearPath = (g, n, r1, r2) => { g.beginPath(); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, da = Math.PI * 2 / n; for (const [k, rr] of [[0.0, r1], [0.18, r2], [0.5, r2], [0.68, r1]]) { const aa = a + k * da; g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } } g.closePath(); };
export default {
  name: "odometer", family: "numbers",
  doc: "Rolling multi-digit mechanical drum counter (carry-over rolling digits, gears) with unit plate and a context object.",
  example: [{ value: 48213, unit: "containers", per: "a day", object: "container", cap: "Moved through the port", note: "a record for the quay" },
            { value: 1860000, unit: "barrels", per: "a day", object: "barrel", cap: "Output of one field", note: "cut by a fifth in a year" },
            { value: 3.9, unit: "billion people", object: "people", cap: "Online worldwide", decimals: 1 }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp, sh, rng } = K, r = rng, { obj, fmt, lab, flag, ell, line, hashSeed } = K.H, dec = d.decimals ?? 0;
    const val = d.value, from = d.from ?? 0, digs = String(Math.round(val * Math.pow(10, dec))).length + (dec ? 0 : 0), n = Math.max(3, digs);
    const dw = clamp(980 / n, 74, 150), dh = dw * 1.5, gapG = 22, groups = Math.floor((n - 1) / 3) - (dec ? 0 : 0);
    const HW = n * dw + groups * gapG + 130, w = Math.max(1560, HW + 560), h = 860, hx = 70, hy = 150;
    const seed = hashSeed(K.seed, 11), seedO = hashSeed(K.seed, 12), gears = [{ x: 20, y: dh + 130, r: 58, n: 12, dir: 1 }, { x: HW - 40, y: dh + 150, r: 78, n: 16, dir: -1 }, { x: HW * 0.5, y: dh + 175, r: 44, n: 10, dir: 1 }];
    const sc = Array.from({ length: n }, () => r.range(-1, 1));
    // value at time -> per-digit position with carry rolling in the last 12% of the lower digit
    const digitPos = (v, k) => { const p = v / Math.pow(10, k), fl = Math.floor(p), fr = p - fl; return (k === 0 && dec === 0 && false) ? p : fl + (k === 0 ? fr : ease.io(clamp((fr - 0.86) / 0.14, 0, 1))) ; };
    return {
      w, h, focus: [{ id: "count", x: 20, y: 70, w: HW + 80, h: h - 150 }, { id: "unit", x: HW * 0.1, y: 300, w: w - HW * 0.1 - 40, h: h - 330 }],
      draw(g, t, at) {
        const t0 = at.count ?? 0, t1 = at.unit ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 54, { size: F.small, color: P.mid });
        const roll = ease.out(seg(t, t0 - 0.1, t0 + 2.0)), v = lerp(from, val, roll) * Math.pow(10, dec);
        // ---- housing: dark cast case with bezel, screws, glass sheen
        g.save(); g.translate(hx, hy);
        ui.shadow(g, () => ui.rr(g, 0, 0, HW, dh + 90, 26), 10, 20); ui.rr(g, 0, 0, HW, dh + 90, 26); ui.fill(g, P.ink2); ui.ink(g, 4, P.ink);
        ui.rr(g, 16, 16, HW - 32, dh + 58, 18); ui.fill(g, P.ink); for (const [sx, sy] of [[34, 34], [HW - 34, 34], [34, dh + 56], [HW - 34, dh + 56]]) { g.beginPath(); g.arc(sx, sy, 7, 0, 7); ui.fill(g, P.mid); g.beginPath(); g.moveTo(sx - 5, sy - 2); g.lineTo(sx + 5, sy + 2); ui.ink(g, 1.5, P.ink); }
        // ---- drums
        let x = 65; const winY = 38;
        for (let i = 0; i < n; i++) {
          const k = n - 1 - i; if (i > 0 && (n - i) % 3 === 0) { g.beginPath(); g.arc(x - gapG / 2 + 2, winY + dh - 10, 5.5, 0, 7); ui.fill(g, P.hair); x += gapG; }
          const pos = digitPos(v, k), fl = Math.floor(pos), fr = pos - fl, dg = fl % 10, wob = Math.sin(t * 9 + sc[i] * 5) * (1 - roll) * 1.4;
          g.save(); g.translate(x, winY); ui.rr(g, 0, 0, dw - 8, dh, 8); ui.fill(g, P.paper); g.save(); ui.rr(g, 0, 0, dw - 8, dh, 8); g.clip();
          for (const off of [-1, 0, 1, 2]) { const val10 = ((dg + off) % 10 + 10) % 10, yy = dh / 2 + (off - fr) * dh * 0.95 + wob;
            ui.num(g, String(val10), (dw - 8) / 2, yy, { size: dh * 0.62, color: P.ink, weight: 800, align: "center" }); }
          const gr = g.createLinearGradient(0, 0, 0, dh); gr.addColorStop(0, "rgba(43,42,39,.42)"); gr.addColorStop(0.28, "rgba(43,42,39,0)"); gr.addColorStop(0.72, "rgba(43,42,39,0)"); gr.addColorStop(1, "rgba(43,42,39,.42)"); g.fillStyle = gr; g.fillRect(0, 0, dw, dh);
          g.fillStyle = "rgba(255,255,255,.26)"; g.fillRect(0, 0, 7, dh); g.restore(); ui.rr(g, 0, 0, dw - 8, dh, 8); ui.ink(g, 3, P.ink2); g.restore();
          x += dw;
        }
        // red reading line across the windows (the one red element), draws in
        const ru = ease.io(seg(t, t0 - 0.1, t0 + 0.6)); g.beginPath(); g.moveTo(40, winY + dh / 2); g.lineTo(lerp(40, HW - 40, ru), winY + dh / 2); ui.ink(g, 3.5, P.red);
        // unit plate beneath
        const pu = ease.back(seg(t, t0 + 0.3, t0 + 0.9)); g.save(); g.translate(HW / 2, dh + 62); g.scale(pu, pu); ui.rr(g, -HW * 0.3, -22, HW * 0.6, 44, 8); ui.fill(g, P.mid); ui.ink(g, 2, P.ink);
        ui.caption(g, d.unit + (d.per ? " " + d.per : ""), 0, 2, { size: F.small, color: P.paper, weight: 700 }); g.restore(); g.restore();
        // ---- gears (secondary motion, driven by the roll)
        for (const G of gears) { const gu = ease.back(seg(t, t0 + 0.2, t0 + 0.8)); g.save(); g.translate(hx + G.x, hy + G.y); g.scale(gu, gu); g.rotate(G.dir * (roll * 9 + t * 0.4) + G.n); gearPath(g, G.n, G.r, G.r * 0.84); ui.fill(g, P.stone2); ui.ink(g, 3, P.ink2); g.beginPath(); g.arc(0, 0, G.r * 0.26, 0, 7); ui.fill(g, P.paper); ui.ink(g, 2.5, P.ink2);
          for (let s = 0; s < 4; s++) { const a = s * Math.PI / 2; g.beginPath(); g.moveTo(Math.cos(a) * G.r * 0.3, Math.sin(a) * G.r * 0.3); g.lineTo(Math.cos(a) * G.r * 0.7, Math.sin(a) * G.r * 0.7); ui.ink(g, 5, P.stone); } g.restore(); }
        // ---- context object: the thing being counted, sitting on a ground line to the right
        const ox = HW + 190, oy = hy + 330, ou = seg(t, t1 - 0.2, t1 + 0.7);
        const gu = seg(t, t1 - 0.3, t1 + 0.5); K.H.ground(g, ox - 250, ox + 270, oy + 130, gu); K.H.groundTicks(g, ox - 250, ox + 270, oy + 130, gu);
        for (let i = 0; i < 3; i++) { const u = seg(t, t1 + i * 0.35, t1 + i * 0.35 + 0.55); if (u <= 0) continue; ui.pop(g, u, ox - 120 + i * 120 + (i === 2 ? 20 : 0), oy + 70 - (i === 1 ? 0 : 0), () => { ell(g, 0, 50, 62, 12, 0.7); obj(g, hashSeed(seedO, i), d.object, i === 1 ? 150 : 128, { t, red: false }); }, "settle"); }
        // x1 ... ratio mark: bracket with small count flag
        if (ou > 0.4) { const bu = ease.io(seg(t, t1 + 0.9, t1 + 1.5)); g.beginPath(); g.moveTo(ox - 220, oy + 170); g.lineTo(lerp(ox - 220, ox + 250, bu), oy + 170); ui.ink(g, 2.5, P.ink2); line(g, ox - 220, oy + 160, ox - 220, oy + 180); if (bu > .98) line(g, ox + 250, oy + 160, ox + 250, oy + 180);
          if (bu > 0.5) ui.caption(g, d.object ? "each one counts" : "", ox + 15, oy + 210, { size: F.small, color: P.mid, alpha: seg(t, t1 + 1.1, t1 + 1.5) }); }
        // note: leader from the red reading line to a paper tag
        if (d.note) { const lu = seg(t, t1 + 0.5, t1 + 1.3); ui.leader(g, hx + HW - 70, hy + winY + dh / 2, hx + HW + 90, hy - 40, lu, P.ink); if (lu > 0.8) K.H.flag(g, d.note, hx + HW + 120 + 20, hy - 70, { size: F.small }); }
      },
    };
  },
};
