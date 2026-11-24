// kind: particleFlow (family: process) - sources feed a manifold, a valve meters the trunk, particles stream to sinks; density = rate.
// data: { sources:[{label, rate, what}], sinks:[{label, share, what}], valve:0..1 (open fraction, default 1), valveLabel:"", cap:"", redSink:0 (index, -1 none), unit:"%" }
// focus ids: "sources", "valve", "sinks"
import { P, F, ease, seg, clamp, lerp, ui, vig, lab, chan, ppt, dot, num, mk, plen } from "./_ptu.js";
export default {
  name: "particleFlow", family: "process",
  doc: "Pipes/channels with particles flowing from sources through a valve to sinks; particle density encodes the rate, sink bins fill by share.",
  example: [{ sources: [{ label: "Wells", rate: 5, what: "pumpjack" }, { label: "Imports", rate: 3, what: "tanker" }, { label: "Stocks", rate: 1.5, what: "oilTank" }], sinks: [{ label: "Refineries", share: 55, what: "refineryColumn" }, { label: "Power", share: 30, what: "chimney" }, { label: "Road fuel", share: 15, what: "fuelPump" }], valve: 0.85, valveLabel: "Throttle", cap: "Where the crude goes", redSink: 0, unit: "%" },
            { sources: [{ label: "Rain", rate: 4, what: "cloud" }, { label: "River", rate: 2, what: "waveBand" }], sinks: [{ label: "Farms", share: 70, what: "palmTree" }, { label: "Cities", share: 30, what: "building" }], valve: 0.5, valveLabel: "Dam gate", cap: "Water budget", redSink: 1, unit: "%" }],
  build(d, K) {
    const S = (d.sources || []).slice(0, 5).map(s => ({ ...s, rate: Math.max(0.05, +s.rate || 1) })), D = (d.sinks || []).slice(0, 5).map(s => ({ ...s, share: Math.max(1, +s.share || 1) }));
    const sumR = S.reduce((a, s) => a + s.rate, 0), sumS = D.reduce((a, s) => a + s.share, 0), valve = clamp(d.valve ?? 1, 0.1, 1), redS = d.redSink ?? 0;
    const w = 1800, h = Math.max(760, 200 + Math.max(S.length, D.length) * 165), my = h / 2, ys = (n, i) => n === 1 ? my : lerp(180, h - 180, i / (n - 1)), VX = 1000, jx0 = 650, jx1 = 1190;
    const sp = S.map((s, i) => ({ pts: [[300, ys(S.length, i)], [jx0, ys(S.length, i)], [jx0, my], [VX - 80, my]], wd: 12 + 30 * s.rate / sumR, n: Math.round(clamp(s.rate / sumR * 30 + 3, 3, 24)) }));
    const dp = D.map((s, i) => ({ pts: [[VX + 80, my], [jx1, my], [jx1, ys(D.length, i)], [1330, ys(D.length, i)]], wd: 12 + 30 * s.share / sumS, n: Math.round(clamp(s.share / sumS * 30 * valve + 2, 2, 24)) }));
    const trunkA = [[jx0, my], [VX - 80, my]], trunkB = [[VX + 80, my], [jx1, my]], seeds = S.concat(D).map((_, i) => 100 + i * 17);
    const parts = (g, t, pts, n, t0, col, sp0, sd) => { if (t < t0) return; const rr = mk(sd), L = plen(pts); for (let i = 0; i < n; i++) { const o = rr(), u = ((t - t0) * sp0 * 140 / L + i / n + o * 0.03) % 1; const [x, y] = ppt(pts, u); dot(g, x + (rr() - .5) * 4, y + (rr() - .5) * 6, 5, col, false); } };
    return {
      w, h,
      focus: [{ id: "sources", x: 40, y: 40, w: 1000, h: h - 80 }, { id: "valve", x: 560, y: my - 330, w: 880, h: 660 }, { id: "sinks", x: 920, y: 40, w: 860, h: h - 80 }],
      draw(g, t, at) {
        const a0 = at.sources ?? 0, a1 = at.valve ?? a0 + 2.6, a2 = at.sinks ?? a1 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        S.forEach((s, i) => { const ta = a0 - 0.2 + i * 0.4, y = sp[i].pts[0][1]; vig(g, s.what, seeds[i], 170, y, 110, seg(t, ta, ta + 0.5), t);
          chan(g, sp[i].pts, sp[i].wd, ease.io(seg(t, ta + 0.2, ta + 1.2)), P.stone); if (t > ta + 0.9) { const al = seg(t, ta + 0.9, ta + 1.3); lab(g, s.label, 330, y - sp[i].wd / 2 - 34, { align: "left", maxW: 300, size: F.small, alpha: al }); ui.num(g, num(s.rate), 560, y - sp[i].wd / 2 - 34, { size: 40, color: P.ink2, align: "left", alpha: al }); }
          parts(g, t, sp[i].pts, sp[i].n, ta + 1.0, P.ink2, 1.0, seeds[i]); });
        const tv = a1 - 0.2; chan(g, trunkA, 52, ease.io(seg(t, tv, tv + 0.6)), P.stone); chan(g, trunkB, 52, ease.io(seg(t, tv + 0.4, tv + 1.2)), P.stone);
        parts(g, t, trunkA, 14, tv + 0.6, P.ink2, 0.9, 7); parts(g, t, trunkB, Math.round(clamp(18 * valve, 2, 20)), tv + 1.0, P.ink2, 0.9 * valve + 0.2, 8);
        vig(g, "valveWheel", 5, VX, my - 20, 190, seg(t, tv + 0.2, tv + 0.9), t);
        if (t > tv + 0.8) { const q = seg(t, tv + 0.8, tv + 1.4), x = VX, y = my + 130; ui.leader(g, x, my + 55, x + 60, y, q); if (q > .9) ui.tag(g, d.valveLabel || "valve", x + 60 + 110, y, { rot: -0.02 }); ui.num(g, Math.round(valve * 100) + "%", x - 70, my - 150, { size: 52, color: P.red, alpha: seg(t, tv + 1.0, tv + 1.5) }); ui.caption(g, "open", x - 70, my - 108, { size: F.small, alpha: seg(t, tv + 1.0, tv + 1.5) }); }
        D.forEach((s, i) => { const ta = a2 - 0.2 + i * 0.4, y = dp[i].pts[3][1], red = i === redS, col = red ? P.red : P.ink2, fill = ease.out(seg(t, ta + 1.2, ta + 5)) * (s.share / sumS) * 0.85 + 0.08 * seg(t, ta + 1.2, ta + 2);
          chan(g, dp[i].pts, dp[i].wd, ease.io(seg(t, ta, ta + 1.0)), red ? "#e7b3ad" : P.stone); parts(g, t, dp[i].pts, dp[i].n, ta + 0.9, col, 0.9, seeds[S.length + i]);
          if (t > ta + 0.9) { const ba = seg(t, ta + 0.9, ta + 1.4); g.save(); g.globalAlpha *= ba; ui.rr(g, 1345, y - 62, 90, 124, 8); ui.fill(g, P.paper2); g.save(); g.clip(); g.fillStyle = red ? P.red2 : P.water2; g.fillRect(1345, y + 62 - 124 * fill, 90, 124 * fill); g.restore(); ui.rr(g, 1345, y - 62, 90, 124, 8); ui.ink(g, 3, P.ink); for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(1345, y - 62 + k * 31); g.lineTo(1345 + (k % 2 ? 18 : 10), y - 62 + k * 31); ui.ink(g, 2, P.ink2); } g.restore(); }
          vig(g, s.what, seeds[S.length + i], 1540, y, 110, seg(t, ta + 1.1, ta + 1.7), t, { red }); if (t > ta + 1.2) { const al = seg(t, ta + 1.2, ta + 1.7); ui.num(g, Math.round(s.share / sumS * 100) + (d.unit || "%"), 1690, y - 14, { size: 46, color: red ? P.red : P.ink, alpha: al }); lab(g, s.label, 1690, y + 34, { maxW: 150, size: F.small, alpha: al }); } });
        for (let k = 0; k < 3 && t > tv + 1; k++) { const x = lerp(jx0 + 30, VX - 140, k / 2) + ((t * 40) % 20) - 10; g.beginPath(); g.moveTo(x - 6, my - 12); g.lineTo(x + 6, my); g.lineTo(x - 6, my + 12); ui.ink(g, 2.5, "#fff"); }
      },
    };
  },
};
