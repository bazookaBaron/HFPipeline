// kind: rangeBand (family: numbers) - an uncertainty range on a scale: several sources each give a point estimate (dot) or their own range (capped bar), then a hatched red
// band marks the consensus range (from-to) with edge handles and a bracket label. Works for any estimate (probabilities, dates, costs, sizes...).
// data: { min: 0, max: 1, ticks: [{ v: 0.5, label: "1/2" }, ...] (optional; auto nice ticks otherwise), unit: "" (appended to numeric labels), sources: [{ label: "Model A", value: 0.7, text: "0.70" } | { label, from, to, text }],
//         consensus: { from: 0.667, to: 0.8, label: "2/3 to 4/5" }, cap: "Odds of a landing by 2030", note: "most agree it is likelier than not" (optional) }
// focus ids: "sources" (the estimates), "band" (consensus band + bracket)
import * as H from "./_h_numcmp.js";
export default {
  name: "rangeBand", family: "numbers",
  doc: "Scale with several point/range estimates from different sources, then a hatched consensus band with edge handles and bracket label.",
  example: [{ min: 0, max: 1, ticks: [{ v: 0, label: "0" }, { v: 0.5, label: "1/2" }, { v: 2 / 3, label: "2/3" }, { v: 0.8, label: "4/5" }, { v: 1, label: "1" }], sources: [{ label: "Bank model", value: 0.7 }, { label: "Poll average", from: 0.6, to: 0.78 }, { label: "Analysts", value: 0.74 }, { label: "Markets", value: 0.67 }, { label: "Think tank", from: 0.55, to: 0.85 }], consensus: { from: 2 / 3, to: 0.8, label: "2/3 to 4/5" }, cap: "Chance it passes", note: "likelier than not" },
            { min: 2025, max: 2045, sources: [{ label: "Agency", value: 2031 }, { label: "Industry", from: 2028, to: 2034 }, { label: "Academics", from: 2032, to: 2040 }, { label: "Survey", value: 2035 }], consensus: { from: 2031, to: 2036, label: "2031 to 2036" }, cap: "First crewed landing" }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp } = K, { fmt, lab, line, flag, tw, nice, dash, ground, hashSeed, ell } = H;
    const mn = d.min, mx = d.max, S = d.sources.slice(0, 7), n = S.length, C = d.consensus, w = 1700, rh = 100, py = 230, ph = n * rh, yb = py + ph + 30, h = yb + 200, px = 470, pw = w - px - 130, X = v => px + (v - mn) / (mx - mn) * pw;
    const tk = d.ticks ?? (() => { const a = nice(mx - mn, 6), r = []; for (let v = Math.ceil(mn / a.step - 1e-9) * a.step; v <= mx + 1e-9; v += a.step) r.push({ v, label: fmt(+v.toFixed(6)) + (d.unit ?? "") }); return r; })();
    const txt = s => s.text ?? (s.value !== undefined ? fmt(s.value, (mx - mn) <= 2 ? 2 : undefined) + (d.unit ?? "") : fmt(s.from, (mx - mn) <= 2 ? 2 : undefined) + " to " + fmt(s.to, (mx - mn) <= 2 ? 2 : undefined));
    return {
      w, h, focus: [{ id: "sources", x: 30, y: 90, w: w - 60, h: h - 110 }, { id: "band", x: clamp(X((C.from + C.to) / 2) - 600, 20, w - 1220), y: 90, w: 1200, h: h - 110 }],
      draw(g, t, at) {
        const t0 = at.sources ?? 0, t1 = at.band ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        // scale: baseline + ticks + labels, vertical hair guides
        const au = seg(t, t0 - 0.2, t0 + 0.8); line(g, px, yb, lerp(px, px + pw, ease.io(au)), yb, 3, P.ink2);
        tk.forEach((k, i) => { const uu = seg(au, i / (tk.length + 1), 1); if (uu <= 0) return; g.save(); g.globalAlpha = uu; dash(g, X(k.v), py - 10, X(k.v), yb, 1, "rgba(120,108,85,.35)", 1.5, [3, 9]); line(g, X(k.v), yb, X(k.v), yb + 16, 3, P.ink2); ui.caption(g, k.label, X(k.v), yb + 56, { size: F.small, caps: false, spacing: 0, color: P.ink2 }); g.restore(); });
        // sources: dot or capped range per row, staggered
        S.forEach((s, i) => { const ts = t0 + 0.2 + i * 0.32, u = seg(t, ts, ts + 0.5), y = py + i * rh + rh / 2; if (u <= 0) return; g.save(); g.globalAlpha = Math.min(1, u * 2); dash(g, 100, y + rh / 2, w - 100, y + rh / 2, 1, "rgba(120,108,85,.25)", 1.5, [2, 8]);
          lab(g, s.label, 100 + 150, y, { maxW: 300, align: "left", color: P.ink2, weight: 600 }); g.restore();
          const isR = s.value === undefined; if (isR) { const x0 = X(s.from), x1 = lerp(X(s.from), X(s.to), ease.out(u)); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); ui.ink(g, 12, P.ink2); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); ui.ink(g, 5, P.mid); line(g, x0, y - 22, x0, y + 22, 4, P.ink); if (u > 0.95) line(g, X(s.to), y - 22, X(s.to), y + 22, 4, P.ink); }
          else ui.pop(g, u, X(s.value), y, () => { ell(g, 0, 22, 20, 5, 0.6); g.beginPath(); g.arc(0, 0, 17, 0, 7); ui.fill(g, P.ink); ui.ink(g, 4, P.paper); g.beginPath(); g.arc(0, 0, 17, 0, 7); ui.ink(g, 3, P.ink); }, "settle");
          if (u > 0.7) ui.caption(g, txt(s), isR ? X(s.to) + 30 : X(s.value) + 34, y, { size: F.small, align: "left", caps: false, spacing: 0, color: P.ink2, alpha: seg(u, 0.7, 1), weight: 700 }); });
        // consensus band: hatched red column from the top down to the axis, edge handles, bracket label
        const bu = ease.io(seg(t, t1 - 0.1, t1 + 0.9)), x0 = X(C.from), x1 = lerp(x0, X(C.to), bu), yt = py - 40;
        if (bu > 0) { g.save(); g.beginPath(); g.rect(x0, yt, x1 - x0, yb - yt); g.fillStyle = "rgba(200,38,29,.10)"; g.fill(); g.save(); g.clip(); g.strokeStyle = "rgba(200,38,29,.45)"; g.lineWidth = 2.5; for (let x = x0 - (yb - yt); x < x1 + 20; x += 18) { g.beginPath(); g.moveTo(x, yb); g.lineTo(x + (yb - yt), yt); g.stroke(); } g.restore();
          for (const x of [x0, x1]) line(g, x, yt, x, yb, 4, P.red); g.restore();
          // handles on the axis
          for (const x of [x0, x1]) { g.beginPath(); g.moveTo(x, yb + 4); g.lineTo(x - 14, yb + 30); g.lineTo(x + 14, yb + 30); g.closePath(); ui.fill(g, P.red); }
          // bracket with label above
          if (bu > 0.5) { const k = seg(bu, 0.5, 1); line(g, x0, yt - 16, lerp(x0, x1, k), yt - 16, 4, P.red); line(g, x0, yt - 16, x0, yt + 4, 4, P.red); if (k > 0.98) line(g, x1, yt - 16, x1, yt + 4, 4, P.red);
            ui.pop(g, k, (x0 + x1) / 2, yt - 66, () => flag(g, C.label ?? (fmt(C.from) + " to " + fmt(C.to)), 0, 0, { red: true })); } }
        if (d.note) { const nu = seg(t, t1 + 0.8, t1 + 1.5); if (nu > 0) { const nw = tw(d.note, F.small, 800, false) + 30, nx = clamp(X(C.to) + 70 + nw / 2, 400, w - nw / 2 - 40); ui.pop(g, nu, nx, py + ph * 0.5 + 0, () => flag(g, d.note, 0, 0)); } }
      },
    };
  },
};
