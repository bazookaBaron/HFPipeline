// kind: contractClauses (family: documents) - clauses as paper strips that unfold one by one (accordion folds), each with a number badge and readable clause text; the key clause gets a red margin bar, a highlight sweep on the key phrase and a magnifier; a signature line + seal close the stack.
// data: { clauses:[{ no:"4.2", t:"clause text (<= ~140 chars)", key?:true, em?:"phrase to underline" }], cap }
// focus ids: "clauses" (strips unfold in order), "key" (the key clause: red bar, sweep, magnifier)
import { P, F, ease, seg, clamp, lerp, ui, rng, icon, sd, fit, chip, circ, measure, wrap } from "./_srd.js";
import { sweep } from "./_srd3.js";
export default {
  name: "contractClauses", family: "documents",
  doc: "Clause strips unfolding like an accordion; the key clause gets a red bar, a sweep and a magnifier.",
  example: [
    { cap: "The small print", clauses: [{ no: "1.1", t: "The Buyer shall take delivery of the cargo at the port of discharge." }, { no: "4.2", t: "The Seller may suspend all shipments without liability if the strait is closed to commercial traffic.", key: true, em: "without liability" }, { no: "7.5", t: "Any dispute shall be settled by arbitration in London." }, { no: "9.0", t: "This contract is governed by English law." }] },
    { cap: "Fine print on delivery", clauses: [{ no: "2", t: "Delivery dates are estimates and not guaranteed." }, { no: "3", t: "Late delivery gives no right to cancel.", key: true, em: "no right to cancel" }, { no: "5", t: "Prices may change with the fuel index." }] },
  ],
  build(d, K) {
    const r = K.rng, C = d.clauses, n = C.length, CW = 1160, SZ = 30, LH = 42, tw = CW - 260, pad = 150, GAP = 22;
    const lay = C.map(c => { const lines = wrap(c.t, tw, SZ, 500); return { c, lines, H: Math.max(112, lines.length * LH + 56) }; }); let y = 120; lay.forEach(q => { q.y = y; y += q.H + GAP; });
    const w = CW + 260, h = y + 270, ox = 130, key = lay.find(q => q.c.key) ?? lay[lay.length - 1];
    return {
      w, h, focus: [{ id: "clauses", x: ox - 60, y: 40, w: CW + 120, h: Math.min(h - 60, 900) }, { id: "key", x: ox - 60, y: clamp(key.y + key.H / 2 - 350, 0, h - 700), w: CW + 160, h: 700 }],
      draw(g, t, at) {
        const t0 = at.clauses ?? 0, t1 = at.key ?? t0 + 2.6, ST = 0.7; ui.card(g, 0, 0, w, h, { r: 18, rule: false });
        lay.forEach((q, i) => { const isKey = q === key, ts = t0 - 0.2 + i * ST, u = i === 0 ? ease.io(seg(t, ts, ts + 0.8)) : ease.io(seg(t, ts, ts + 0.8)); if (u <= 0.001) return; const hh = q.H * u; g.save(); g.translate(ox, q.y);
          // folded strip: clip to the unfolded height; three panels with alternating shade + crease lines (accordion)
          g.save(); ui.shadow(g, () => ui.rr(g, 0, 0, CW, hh, 8), 6, 12, 0.9); ui.rr(g, 0, 0, CW, hh, 8); g.fillStyle = "#fdfbf6"; g.fill(); g.clip();
          for (let k = 0; k < 3; k++) { const y0 = q.H * k / 3 * u; if (u < 0.999) { g.fillStyle = k % 2 ? "rgba(60,46,26,.10)" : "rgba(255,255,255,.35)"; g.fillRect(0, y0, CW, q.H / 3 * u); g.beginPath(); g.moveTo(0, y0); g.lineTo(CW, y0); ui.ink(g, 2, "rgba(43,42,39,.25)"); } }
          if (u > 0.55) { const ca = clamp((u - 0.55) * 3, 0, 1); g.globalAlpha *= ca;
            // number badge, text, key phrase sweep
            circ(g, 70, q.H / 2, 40, isKey && t > t1 - 0.2 ? P.red : P.ink, 0); ui.caption(g, q.c.no, 70, q.H / 2 + 2, { size: F.small, color: P.paper, weight: 800, caps: false, spacing: 0 });
            q.lines.forEach((ln, li) => { const ly = 28 + li * LH + 20, ll = measure(ln, SZ, 500); if (isKey && q.c.em) { const idx = ln.toLowerCase().indexOf(q.c.em.toLowerCase()); if (idx >= 0) { const x0 = pad + measure(ln.slice(0, idx), SZ, 500), x1 = measure(ln.slice(0, idx + q.c.em.length), SZ, 500); sweep(g, x0 - 4, ly - 20, x1 - measure(ln.slice(0, idx), SZ, 500) + 8, 38, seg(t, t1, t1 + 1.1), true); } }
              ui.caption(g, ln, pad, ly, { size: SZ, align: "left", color: P.ink, weight: 500, caps: false, spacing: 0 }); });
            if (isKey && t > t1 - 0.3) { const ku = ease.out(seg(t, t1 - 0.3, t1 + 0.4)); g.fillStyle = P.red; g.fillRect(0, 0, 14 * ku, q.H); } }
          g.restore(); g.restore();
          if (isKey && t > t1 + 0.4) { const mu = ease.back(seg(t, t1 + 0.4, t1 + 1.0)); g.save(); g.translate(ox + CW - 70, q.y + q.H - 10 + Math.sin(t * 2) * 4); g.scale(mu, mu); icon(g, "magnifier", 0, 0, 150, { seed: 5, t }); g.restore(); } });
        // closing: signature line + seal
        const lastT = t0 + n * ST, cu = ease.out(seg(t, lastT, lastT + 0.8)), sy = lay[n - 1].y + lay[n - 1].H + 90; g.save(); g.globalAlpha *= cu; g.translate(ox, 0); g.beginPath(); g.moveTo(40, sy); g.lineTo(520, sy); ui.ink(g, 2.5, P.ink2); g.beginPath(); g.moveTo(CW - 520, sy); g.lineTo(CW - 40, sy); ui.ink(g, 2.5, P.ink2); icon(g, "stamp", CW / 2, sy - 12, 150, { seed: 3, t, red: false }); g.restore();
        if (d.cap) ui.caption(g, d.cap, w / 2, h - 46, { size: F.cap, color: P.ink2, weight: 700 });
      },
    };
  },
};
