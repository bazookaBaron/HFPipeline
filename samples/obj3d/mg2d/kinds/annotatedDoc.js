// kind: annotatedDoc (family: documents) - a generated document page (header block, greeked body, a few real lines) with highlight sweeps over the key passages and margin notes on tags with leader lines.
// v3: 3 seeded layout variants (data.layout 0..2 forces one; default = stage seed % 3):
//   0 "margin"   page left, margin notes on dashed leaders to the right
//   1 "loupe"    page right, notes on the left, and a magnifier inset that enlarges the key passage (the red line) beside the page
//   2 "exhibit"  a stack of two sheets with an exhibit tab, numbered markers at the passages and a numbered note column
// data: { head:"Charter party", ref?:"No. 4417", body:[{ t:"Passage text (real, shown at readable size)", hi?:1|2 (1 = sand sweep, 2 = the red key passage), note?:"margin note" }...], cap, layout? }
// Greeked filler rows are generated between the passages. focus ids: "doc" (page builds, passages appear, sweeps run), "note" (key passage sweeps red + margin notes land)
import { P, F, ease, seg, clamp, lerp, ui, rng, icon, sd, fit, chip, circ, measure, wrap } from "./_srd.js";
import { greek, sheet, sweep, barcode } from "./_srd3.js";
const NV = 3;
export default {
  name: "annotatedDoc", family: "documents", variants: NV,
  doc: "Document page with real key passages, highlight sweeps and margin notes; 3 seeded layouts (margin notes, magnifier loupe, numbered exhibit).",
  example: [
    { head: "Charter party", ref: "No. 4417", cap: "The clause that matters", body: [{ t: "The vessel shall proceed with utmost despatch to the loading port.", hi: 1, note: "no fixed date" }, { t: "Demurrage accrues at 38,000 USD per day after laytime expires.", hi: 2, note: "the cost driver" }, { t: "Force majeure excuses delay only if notice is given within 48 hours.", hi: 1, note: "48 h window" }] },
    { head: "Supply agreement", ref: "Rev. B", cap: "Fine print", body: [{ t: "Prices are indexed to the monthly spot average.", hi: 1 }, { t: "Supplier may reduce volume by up to 30 percent without penalty.", hi: 2, note: "30% escape hatch" }] },
  ],
  build(d, K) {
    const r = K.rng, V = d.layout ?? (Math.abs(K.seed | 0) % NV), PW = 700, PH = 860, pad = 56, tw = PW - pad * 2, SZ = 34, LH = 48, B = d.body;
    const w = [1560, 1640, 1640][V], h = 1060, px = [130, 860, 150][V], py = 50, seedS = sd(r);
    const rows = []; let y = 250; B.forEach((b, i) => { const filler = i === 0 ? 2 : 3; rows.push({ kind: "g", y, n: filler, seed: sd(r) }); y += filler * 30 + 26; const lines = wrap(b.t, tw - 12, SZ, 500); rows.push({ kind: "p", y, lines, b, i }); y += lines.length * LH + 30; });
    rows.push({ kind: "g", y, n: Math.max(2, Math.floor((PH - 60 - y) / 30)), seed: sd(r) });
    const passages = rows.filter(q => q.kind === "p"), key = passages.find(q => q.b.hi === 2) ?? passages[passages.length - 1], noted = passages.filter(q => q.b.note);
    const nx = [px + PW + 90, 90, px + PW + 150][V], noteY = q => py + q.y + (q.lines.length * LH) / 2;
    // exhibit: numbered note column, evenly spaced; loupe: inset circle left-below the notes
    const colY = (j, n) => py + 260 + j * Math.min(170, 520 / Math.max(1, n - 1 || 1));
    const LX = 470, LY = 780, LR = 180;
    const focus = [
      [{ id: "doc", x: px - 80, y: py - 20, w: PW + 160, h: PH + 40 }, { id: "note", x: px + 40, y: clamp(py + key.y - 300, 0, h - 700), w: PW + 640, h: 700 }],
      [{ id: "doc", x: px - 80, y: py - 20, w: PW + 160, h: PH + 40 }, { id: "note", x: 40, y: clamp(py + key.y - 340, 0, h - 760), w: px + PW - 80, h: 760 }],
      [{ id: "doc", x: px - 90, y: py - 30, w: PW + 200, h: PH + 60 }, { id: "note", x: px + 100, y: 120, w: w - px - 140, h: 820 }]][V];
    return {
      w, h, focus, layout: V,
      draw(g, t, at) {
        const t0 = at.doc ?? 0, t1 = at.note ?? t0 + 2.6; ui.base(g, w, h, { r: 18, rule: false });
        if (V === 2) { const su = ease.out(seg(t, t0 - 0.4, t0 + 0.2)); g.save(); g.globalAlpha *= su; g.translate(px + 34, py + 26); g.rotate(0.03); sheet(g, 0, 0, PW, PH); greek(g, pad, 120, tw, 18, seedS, 1); g.restore(); }
        g.save(); g.translate(px, py); if (V === 2) g.rotate(-0.012); sheet(g, 0, 0, PW, PH);
        const hu = ease.out(seg(t, t0 - 0.3, t0 + 0.5)); g.save(); g.globalAlpha *= hu; circ(g, pad + 40, 120, 40, P.paper2, 3); circ(g, pad + 40, 120, 28, null, 1.6); g.beginPath(); g.moveTo(pad + 22, 120); g.lineTo(pad + 58, 120); ui.ink(g, 3, P.ink2); g.beginPath(); g.moveTo(pad + 40, 102); g.lineTo(pad + 40, 138); ui.ink(g, 3, P.ink2);
        ui.caption(g, d.head, pad + 110, 104, { size: F.cap, align: "left", color: P.ink, weight: 800 }); if (d.ref) ui.caption(g, d.ref, pad + 110, 146, { size: F.small, align: "left", color: P.mid, caps: false, spacing: 1 }); g.beginPath(); g.moveTo(pad, 190); g.lineTo(PW - pad, 190); ui.ink(g, 3, P.ink2); g.restore();
        if (V === 2) { const eu = ease.back(seg(t, t0 + 0.2, t0 + 0.7)); g.save(); g.translate(PW - 30, 70); g.rotate(0.06); g.scale(eu, eu); ui.rr(g, -70, -30, 140, 60, 8); ui.fill(g, P.red); ui.ink(g, 2.5, P.redInk); ui.caption(g, "Exhibit", 0, 1, { size: F.small, color: P.paper, weight: 800 }); g.restore(); }
        rows.forEach((q, i) => { if (q.kind === "g") { const u = seg(t, t0 + i * 0.1, t0 + 0.9 + i * 0.1); greek(g, pad, q.y, tw, q.n, q.seed, u); return; } const pu = ease.out(seg(t, t0 + 0.3 + q.i * 0.45, t0 + 0.9 + q.i * 0.45)); if (pu <= 0) return; const isKey = q === key, sw = seg(t, (isKey ? t1 : t0 + 0.9 + q.i * 0.5), (isKey ? t1 + 0.9 : t0 + 1.6 + q.i * 0.5));
          q.lines.forEach((ln, li) => { const ly = q.y + li * LH, lw = measure(ln, SZ, 500); if (q.b.hi) sweep(g, pad - 4, ly - 12, Math.min(lw + 8, tw), 32, q.b.hi === 2 && !isKey ? 0 : sw, isKey && t > t1 - 0.3); g.save(); g.globalAlpha *= pu; ui.caption(g, ln, pad, ly + 4, { size: SZ, align: "left", color: P.ink, weight: 500, caps: false, spacing: 0 }); g.restore(); });
          if (V === 2 && q.b.note) { const j = noted.indexOf(q), mu = ease.back(seg(t, t0 + 0.6 + q.i * 0.45, t0 + 1.1 + q.i * 0.45)); g.save(); g.translate(pad - 30, q.y + 4); g.scale(mu, mu); g.beginPath(); g.arc(0, 0, 21, 0, 7); ui.fill(g, isKey ? P.red : P.paper); ui.ink(g, 2.2, isKey ? P.redInk : P.ink2); ui.caption(g, String(j + 1), 0, 1, { size: F.small, color: isKey ? P.paper : P.ink, weight: 800, spacing: 0 }); g.restore(); } });
        g.beginPath(); g.moveTo(pad, PH - 56); g.lineTo(pad + 240, PH - 56); ui.ink(g, 2, P.ink2); barcode(g, PW - pad - 200, PH - 84, 200, 36, 33, seg(t, t0, t0 + 1.2)); g.restore();
        // notes
        noted.forEach((q, j) => { const isKey = q === key, ts = isKey ? t1 + 0.5 : t0 + 1.6 + q.i * 0.5, u = seg(t, ts, ts + 0.6); if (u <= 0) return; const lu = ease.io(u);
          if (V === 0) { const ay = py + q.y + 10, by = noteY(q); g.save(); g.beginPath(); g.moveTo(px + PW - pad + 8, ay); g.lineTo(lerp(px + PW - pad + 8, nx + 20, lu), lerp(ay, by, lu)); g.setLineDash([10, 8]); ui.ink(g, 2.5, isKey ? P.red : P.mid); g.setLineDash([]); g.restore();
            if (u > 0.6) { const k = ease.back(seg(t, ts + 0.3, ts + 0.8)); g.save(); g.translate(nx + 30, by); g.scale(k, k); chip(g, q.b.note, 0, 0, { red: isKey, size: F.cap }); g.restore(); } }
          if (V === 1) { const ay = py + q.y + 10, by = noteY(q) - 40, ex = nx + 30 + measure(q.b.note, F.cap, 700) + 60; g.save(); g.beginPath(); g.moveTo(px + pad - 14, ay); g.lineTo(lerp(px + pad - 14, ex, lu), lerp(ay, by, lu)); g.setLineDash([10, 8]); ui.ink(g, 2.5, isKey ? P.red : P.mid); g.setLineDash([]); g.restore();
            if (u > 0.6) { const k = ease.back(seg(t, ts + 0.3, ts + 0.8)), cw = measure(q.b.note, F.cap, 700) + 60; g.save(); g.translate(nx + cw / 2, by); g.scale(k, k); chip(g, q.b.note, 0, 0, { red: isKey, size: F.cap }); g.restore(); } }
          if (V === 2) { const cy = colY(j, noted.length), k = ease.back(seg(t, ts, ts + 0.5)); g.save(); g.translate(nx, cy); g.scale(k, k); g.beginPath(); g.arc(0, 0, 24, 0, 7); ui.fill(g, isKey ? P.red : P.paper); ui.ink(g, 2.4, isKey ? P.redInk : P.ink2); ui.caption(g, String(j + 1), 0, 1, { size: F.small, color: isKey ? P.paper : P.ink, weight: 800, spacing: 0 }); g.restore();
            g.save(); g.globalAlpha *= seg(t, ts + 0.2, ts + 0.6); fit(g, q.b.note, nx + 50 + 230, cy, 460, { size: F.cap, color: isKey ? P.redInk : P.ink, weight: 700, align: "left" }); g.beginPath(); g.moveTo(nx + 40, cy + 40); g.lineTo(nx + 40 + 420 * lu, cy + 40); ui.ink(g, 1.5, P.hair); g.restore(); } });
        // loupe: the key passage enlarged under a magnifier, on a leader from the page
        if (V === 1) { const u = ease.out(seg(t, t1 + 0.1, t1 + 0.8)); if (u > 0) { const kx = px + pad, ky = py + key.y - 12, kh = key.lines.length * LH + 20; g.save(); g.globalAlpha *= u;
          g.beginPath(); g.moveTo(kx - 6, ky + kh / 2); g.lineTo(LX + LR * 0.7, LY - LR * 0.7); ui.ink(g, 2, P.mid); ui.rr(g, kx - 10, ky, Math.min(tw, measure(key.lines[0], SZ, 500)) + 20, kh, 8); ui.ink(g, 3, P.red);
          ui.shadow(g, () => { g.beginPath(); g.arc(LX, LY, LR, 0, 7); }, 8, 14); g.beginPath(); g.arc(LX, LY, LR, 0, 7); ui.fill(g, "#fffdf8"); g.save(); g.beginPath(); g.arc(LX, LY, LR - 8, 0, 7); g.clip();
          g.translate(LX - LR + 24, LY - (key.lines.length * 46) / 2 + 20); key.lines.forEach((ln, li) => { const ws = ln.split(" "); let s0 = ""; for (const wd of ws) { if (measure(s0 + " " + wd, 40, 600) > LR * 2 - 60) break; s0 = s0 ? s0 + " " + wd : wd; } if (li < 3) ui.caption(g, s0, 0, li * 46, { size: 40, align: "left", color: P.ink, weight: 600, caps: false, spacing: 0 }); });
          g.restore(); g.beginPath(); g.arc(LX, LY, LR, 0, 7); ui.ink(g, 10, P.ink2); g.beginPath(); g.arc(LX, LY, LR - 6, -2.4, -1.6); ui.ink(g, 4, "rgba(255,255,255,.8)");
          g.save(); g.translate(LX + LR * 0.72, LY + LR * 0.72); g.rotate(-0.78); ui.rr(g, -18, 0, 36, 150, 14); ui.fill(g, P.ink2); ui.ink(g, 2.5, P.ink); g.restore(); g.restore(); } }
        if (d.cap) ui.caption(g, d.cap, V === 1 ? px + PW / 2 : w / 2 + 120, h - 40, { size: F.cap, color: P.ink2, weight: 700 });
      },
    };
  },
};
