// kind: ledger (family: documents) - an open double-page ledger book: ruled pages with date / entry / debit / credit columns, rows written in one by one with a pen tick, column totals, and the balance (red, double-underlined).
// data: { entries:[{ d:"Mar 3", n:"Fuel", debit?:120000, credit?:0 }], cols?:["Date","Entry","Debit","Credit"], currency:"$", balanceLabel:"Balance", cap }
// focus ids: "entries" (rows land down the left then right page), "balance" (totals + red balance)
import { P, F, ease, seg, clamp, lerp, ui, rng, icon, sd, fit, chip, circ, fmt, measure } from "./_srd.js";
import { tick } from "./_srd3.js";
export default {
  name: "ledger", family: "documents",
  doc: "Open ledger book with columns, rows written in sequence, totals and a red balance.",
  example: [
    { cap: "The books after the closure", currency: "$", cols: ["Date", "Entry", "Debit", "Credit"], entries: [{ d: "Jan 4", n: "Freight income", credit: 820000 }, { d: "Jan 9", n: "Fuel", debit: 310000 }, { d: "Jan 15", n: "Port fees", debit: 74000 }, { d: "Jan 22", n: "Charter fee", credit: 450000 }, { d: "Feb 2", n: "Insurance", debit: 188000 }, { d: "Feb 8", n: "Crew wages", debit: 96000 }, { d: "Feb 17", n: "Detour fuel", debit: 410000 }, { d: "Feb 26", n: "Cargo claim", debit: 120000 }] },
    { cap: "Household month", currency: "", cols: ["Day", "Item", "Out", "In"], entries: [{ d: "1", n: "Salary", credit: 4200 }, { d: "3", n: "Rent", debit: 1400 }, { d: "9", n: "Groceries", debit: 380 }, { d: "14", n: "Energy", debit: 260 }, { d: "20", n: "Fuel", debit: 190 }] },
  ],
  build(d, K) {
    const r = K.rng, E = d.entries, n = E.length, cols = d.cols ?? ["Date", "Entry", "Debit", "Credit"], cur = d.currency ?? "", PW = 700, PH = 860, RH = 74, perPage = Math.max(4, Math.min(8, Math.ceil(n / 2))), w = 1640, h = 1000, bx = (w - PW * 2) / 2, by = 70;
    const dsum = E.reduce((a, q) => a + (q.debit ?? 0), 0), csum = E.reduce((a, q) => a + (q.credit ?? 0), 0), bal = csum - dsum, seed = sd(r), y0 = 190;
    const pos = i => { const pg = Math.floor(i / perPage), k = i % perPage; return { x: bx + pg * PW, y: by + y0 + k * RH, pg }; };
    const colx = [34, 150, 470, 590].map(v => v);   // date, entry, debit(right edge), credit(right edge)
    return {
      w, h, focus: [{ id: "entries", x: bx - 60, y: by - 20, w: PW * 2 + 120, h: PH + 60 }, { id: "balance", x: bx + PW - 600, y: by + PH - 560, w: 1200, h: 640 }],
      draw(g, t, at) {
        const t0 = at.entries ?? 0, t1 = at.balance ?? t0 + 2.6, ST = 0.4; ui.card(g, 0, 0, w, h, { r: 18, rule: false });
        // book: cover edge, stacked page edges, two pages with ruled lines and a centre gutter
        g.save(); ui.shadow(g, () => ui.rr(g, bx - 26, by - 18, PW * 2 + 52, PH + 50, 14), 8, 16); ui.rr(g, bx - 26, by - 18, PW * 2 + 52, PH + 50, 14); ui.fill(g, P.stone2); ui.ink(g, 4);
        for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(bx - 14, by + PH + 14 + k * 5); g.lineTo(bx + PW * 2 + 14, by + PH + 14 + k * 5); ui.ink(g, 1.5, "rgba(43,42,39,.25)"); } g.restore();
        for (let pg = 0; pg < 2; pg++) { const x = bx + pg * PW; g.save(); ui.rr(g, x, by, PW, PH, 6); const gr = g.createLinearGradient(x, 0, x + PW, 0); gr.addColorStop(pg ? 0 : 1, "#ece6d8"); gr.addColorStop(pg ? 0.18 : 0.82, "#fbf8f1"); gr.addColorStop(pg ? 1 : 0, "#fbf8f1"); g.fillStyle = gr; g.fill(); ui.ink(g, 2.5, "rgba(43,42,39,.4)");
          for (let k = 0; k < 10; k++) { const yy = by + y0 + k * RH + RH - 8; if (yy > by + PH - 40) break; g.beginPath(); g.moveTo(x + 24, yy); g.lineTo(x + PW - 24, yy); ui.ink(g, 1.6, "rgba(120,130,150,.3)"); }
          [colx[1] - 20, colx[2] + 20, colx[3] + 20].forEach(cx => { g.beginPath(); g.moveTo(x + cx, by + 120); g.lineTo(x + cx, by + PH - 34); ui.ink(g, 1.6, "rgba(200,38,29,.22)"); });
          cols.forEach((c, k) => { const u = seg(t, t0 - 0.3, t0 + 0.4); g.save(); g.globalAlpha *= u; ui.caption(g, c, x + (k < 2 ? colx[k] : colx[k] + 10), by + 144, { size: F.small, align: k < 2 ? "left" : "right", color: P.ink2, weight: 800 }); g.restore(); });
          g.beginPath(); g.moveTo(x + 24, by + 166); g.lineTo(x + PW - 24, by + 166); ui.ink(g, 3.5, P.ink2); g.restore(); }
        g.beginPath(); g.moveTo(bx + PW, by); g.lineTo(bx + PW, by + PH); ui.ink(g, 3, "rgba(43,42,39,.35)");
        // entries are written in one by one
        E.forEach((q, i) => { const ti = t0 + 0.1 + i * ST, u = ease.out(seg(t, ti, ti + 0.4)); if (u <= 0) return; const p = pos(i); g.save(); g.globalAlpha *= u; g.translate(0, (1 - u) * -10);
          ui.caption(g, q.d ?? "", p.x + colx[0], p.y, { size: F.small, align: "left", color: P.ink2, caps: false, spacing: 0, weight: 500 }); fit(g, q.n, p.x + colx[1], p.y, 270, { size: F.small, align: "left", color: P.ink, weight: 600, caps: false, spacing: 0 });
          if (q.debit) ui.caption(g, cur + fmt(q.debit), p.x + colx[2] + 10, p.y, { size: F.small, align: "right", color: P.ink, weight: 700, caps: false, spacing: 0 }); if (q.credit) ui.caption(g, cur + fmt(q.credit), p.x + colx[3] + 10, p.y, { size: F.small, align: "right", color: P.ink, weight: 700, caps: false, spacing: 0 });
          tick(g, p.x + PW - 52, p.y, 22, seg(t, ti + 0.2, ti + 0.6), P.ink2); g.restore(); });
        // totals (bottom of the right page) and the balance
        const tu = ease.out(seg(t, t1 - 0.2, t1 + 0.6)), px = bx + PW, ty = by + PH - 150; g.save(); g.globalAlpha *= tu; g.beginPath(); g.moveTo(px + 24, ty - 34); g.lineTo(px + PW - 24, ty - 34); ui.ink(g, 3.5, P.ink);
        ui.caption(g, "Totals", px + colx[0], ty, { size: F.small, align: "left", color: P.ink2, weight: 800 }); ui.caption(g, cur + fmt(dsum), px + colx[2] + 10, ty, { size: F.small, align: "right", color: P.ink, weight: 800, caps: false, spacing: 0 }); ui.caption(g, cur + fmt(csum), px + colx[3] + 10, ty, { size: F.small, align: "right", color: P.ink, weight: 800, caps: false, spacing: 0 }); g.restore();
        const bu = ease.out(seg(t, t1 + 0.4, t1 + 1.6)), cnt = bal * bu; g.save(); g.globalAlpha *= clamp(bu * 3, 0, 1); ui.caption(g, d.balanceLabel ?? "Balance", px + colx[0], ty + 84, { size: F.cap, align: "left", color: P.red, weight: 800 }); ui.num(g, (bal < 0 ? "−" : "") + cur + fmt(Math.abs(cnt), 0), px + PW - 40, ty + 88, { size: 66, align: "right", color: P.red });
        const du = ease.io(seg(t, t1 + 1.2, t1 + 1.9)); for (const dy of [118, 128]) { g.beginPath(); g.moveTo(px + PW - 40, ty + dy); g.lineTo(px + PW - 40 - 360 * du, ty + dy); ui.ink(g, dy === 118 ? 5 : 3, P.red); } g.restore();
        // a pen resting on the page, moving with the latest entry (secondary motion)
        const last = clamp(Math.floor((t - t0 - 0.1) / ST), 0, n - 1), lp = pos(last), pen = t < t1 ? 1 : 0; if (pen && t > t0) { g.save(); g.translate(lp.x + colx[2] + 120 + Math.sin(t * 7) * 3, lp.y + 12); g.rotate(-0.9); g.beginPath(); ui.rr(g, 0, -9, 210, 18, 9); ui.fill(g, P.ink2); ui.ink(g, 2.5); g.beginPath(); g.moveTo(0, -9); g.lineTo(-26, 0); g.lineTo(0, 9); g.closePath(); ui.fill(g, P.paper2); ui.ink(g, 2.5); g.restore(); }
        if (d.cap) ui.caption(g, d.cap, w / 2, h - 46, { size: F.cap, color: P.ink2, weight: 700 });
      },
    };
  },
};
