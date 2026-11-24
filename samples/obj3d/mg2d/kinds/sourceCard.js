// kind: sourceCard (family: documents) - a footnote card: the figure with a footnote marker on the left; on the right the source document (SH.documentPage) with a highlight sweep on the line the number comes from and a magnifier;
// a dashed leader runs from the marker to a citation card (publisher, title, year, page). data: { value:"23 million", unit:"barrels a day", source:{ pub:"US EIA", title:"World Oil Transit Chokepoints", year:"2023", page:"p. 4", where?:"Table 1" }, cap }
// focus ids: "number" (the figure + footnote marker), "source" (document, sweep, magnifier, citation)
import { P, F, ease, seg, clamp, lerp, ui, rng, icon, sd, fit, chip, circ, measure, wrap } from "./_srd.js";
import { sweep, barcode } from "./_srd3.js";
export default {
  name: "sourceCard", family: "documents",
  doc: "Figure with a footnote marker linked to a source document with a sweep, magnifier and citation card.",
  example: [
    { value: "23 million", unit: "barrels a day", cap: "Where the number comes from", source: { pub: "US EIA", title: "World Oil Transit Chokepoints", year: "2023", page: "p. 4", where: "Table 1" } },
    { value: "70%", unit: "of leading chips", cap: "Source", source: { pub: "Industry association", title: "Global Semiconductor Report", year: "2022", page: "p. 31" } },
  ],
  build(d, K) {
    const r = K.rng, w = 1760, h = 900, S = d.source, seed = sd(r), nx = 90, ny = 120, NW = 640, NH = 560, dx = 840, dy = 70, DW = 440, DH = 600, cx = 1330, cy = 250, CWd = 380;
    const cite = [["Publisher", S.pub], ["Title", S.title], ["Year", String(S.year)], ["Page", S.page + (S.where ? ", " + S.where : "")]].filter(q => q[1]);
    const tl = wrap(d.value, 560, 150, 800).length;
    return {
      w, h, focus: [{ id: "number", x: nx - 60, y: ny - 60, w: NW + 220, h: NH + 140 }, { id: "source", x: dx - 40, y: 20, w: w - dx - 20, h: 820 }],
      draw(g, t, at) {
        const t0 = at.number ?? 0, t1 = at.source ?? t0 + 2.6; ui.card(g, 0, 0, w, h, { r: 18, rule: false });
        // figure card
        const nu = ease.out(seg(t, t0 - 0.3, t0 + 0.6)); g.save(); g.translate(nx, ny + (1 - nu) * 30); g.globalAlpha *= nu; ui.card(g, 0, 0, NW, NH, { r: 14 });
        const cnt = ease.out(seg(t, t0, t0 + 1.3)), m = /^([^\d]*)([\d.,]+)(.*)$/.exec(d.value), vs = m ? m[1] + (m[2].includes(".") ? (+m[2].replace(/,/g, "") * cnt).toFixed(1) : Math.round(+m[2].replace(/,/g, "") * cnt).toLocaleString("en-US")) + m[3] : d.value;
        fit(g, vs, 54, 220, NW - 160, { size: 130, align: "left", color: P.ink, weight: 800, caps: false, spacing: 0 }); ui.caption(g, d.unit ?? "", 58, 330, { size: F.cap, align: "left", color: P.ink2, caps: false, spacing: 0, weight: 600 });
        // footnote marker: superscript-like numbered disc next to the figure
        const mu = ease.back(seg(t, t0 + 0.9, t0 + 1.5)); g.save(); g.translate(NW - 76, 130); g.scale(mu, mu); circ(g, 0, 0, 34, P.paper, 4, P.ink); ui.num(g, "1", 0, 2, { size: 40 }); g.restore();
        g.beginPath(); g.moveTo(54, 430); g.lineTo(NW - 54, 430); ui.ink(g, 2.5, "rgba(43,42,39,.35)"); const fu = seg(t, t0 + 1.2, t0 + 1.8); g.save(); g.globalAlpha *= fu; circ(g, 70, 480, 22, P.paper, 3, P.ink); ui.num(g, "1", 70, 481, { size: 26 }); ui.caption(g, S.pub + ", " + S.year, 110, 481, { size: F.small, align: "left", color: P.ink2, caps: false, spacing: 0, weight: 500 }); g.restore(); g.restore();
        // dashed leader from the marker to the citation card (draws at the second focus)
        const lu = ease.io(seg(t, t1 - 0.5, t1 + 0.7)); if (lu > 0) { const x0 = nx + NW - 76 + 36, y0 = ny + 130, x1 = cx - 16, y1 = cy + 54; g.save(); g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(x0 + 120, y0 - 120, x1 - 160, y1 - 160, lerp(x0, x1, lu), lerp(y0, y1, lu)); g.setLineDash([14, 10]); g.lineDashOffset = -t * 20; ui.ink(g, 3, P.mid); g.restore(); }
        // source document: page thumbnail with a sweep on one line + magnifier
        const du = ease.out(seg(t, t1 - 0.4, t1 + 0.6)); g.save(); g.translate(dx, dy + (1 - du) * 30); g.globalAlpha *= 0.4 + 0.6 * du; icon(g, "documentPage", DW / 2, DH / 2, DH, { seed, t });
        const sy = DH * 0.58, su = seg(t, t1 + 0.4, t1 + 1.4); sweep(g, DW * 0.13, sy - 10, DW * 0.68, 26, su, true); const mu2 = ease.back(seg(t, t1 + 0.8, t1 + 1.4)); g.save(); g.translate(DW * 0.62 + Math.sin(t * 1.6) * 3, sy + 40); g.scale(mu2, mu2); icon(g, "magnifier", 0, 0, 200, { seed: 5, t }); g.restore(); g.restore();
        // citation card
        const cu = ease.out(seg(t, t1 + 0.2, t1 + 1.0)); g.save(); g.translate(cx, cy + (1 - cu) * 30); g.globalAlpha *= cu; ui.card(g, 0, 0, CWd, 400, { r: 12, rule: false }); g.fillStyle = P.red; g.fillRect(0, 20, 8, 360);
        cite.forEach(([k, v], i) => { const y = 70 + i * 88, ku = seg(t, t1 + 0.5 + i * 0.25, t1 + 0.9 + i * 0.25); g.save(); g.globalAlpha *= ku; ui.caption(g, k, 36, y - 22, { size: 24, align: "left", color: P.mid, weight: 700 }); fit(g, v, 36, y + 14, CWd - 70, { size: F.small, align: "left", color: P.ink, weight: 600, caps: false, spacing: 0 }); g.restore(); });
        g.restore(); if (d.cap) ui.caption(g, d.cap, nx + NW / 2, h - 60, { size: F.cap, color: P.ink2, weight: 700 });
      },
    };
  },
};
