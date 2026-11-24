// kind: quoteCard (family: documents) - a small attributed quote. The words appear one by one, a key phrase is underlined in red, and the attribution lands with name, role and date.
// v3: 4 seeded layout variants so repeated quotes never look identical (data.layout 0..3 forces one; default = stage seed % 4):
//   0 "podium"     words beside a podium with microphone (SH.podium) whose sound arcs pulse
//   1 "pull"       big pull-quote across the sheet, a red margin bar, speaker pictogram (SH.speaker) beside the attribution
//   2 "clipping"   the quote printed on a taped newspaper clipping, the speaker (SH.figure) standing beside it with a dashed speech leader
//   3 "transcript" numbered transcript lines with a speaker label, a live waveform panel and a microphone, attribution under the waveform
// data: { quote:"We cannot guarantee a safe passage.", em?:"cannot guarantee", by:"Port authority spokesperson", role?:"Harbour master's office", when?:"12 March 2024", cap?, layout? }
// focus ids: "quote" (the card + words), "by" (speaker + attribution)
import { P, F, ease, seg, clamp, lerp, ui, rng, icon, sd, fit, chip, circ, measure, wrap } from "./_srd.js";
import { sweep, sheet, greek } from "./_srd3.js";
const NV = 4;
export default {
  name: "quoteCard", family: "documents", variants: NV,
  doc: "Attributed quote, words revealing, key phrase red-underlined, no faces; 4 seeded layouts (podium, pull-quote, clipping, transcript).",
  example: [
    { quote: "We cannot guarantee safe passage for any vessel through the strait this week.", em: "cannot guarantee safe passage", by: "Port authority spokesperson", role: "Harbour master's office", when: "12 March 2024" },
    { quote: "Every chip we ship depends on one narrow stretch of water.", em: "one narrow stretch of water", by: "Supply chain director", role: "Semiconductor maker", when: "Annual report" },
  ],
  build(d, K) {
    const r = K.rng, seed = sd(r), V = d.layout ?? (Math.abs(K.seed | 0) % NV);
    const cfg = [{ w: 1280, h: 640, QS: 38, LH: 58, tx: 470, tw: 720 }, { w: 1500, h: 780, QS: 46, LH: 68, tx: 200, tw: 1160 }, { w: 1600, h: 860, QS: 36, LH: 54, tx: 150, tw: 740 }, { w: 1640, h: 780, QS: 36, LH: 64, tx: 430, tw: 640 }][V];
    const { w, h, QS, LH: LHt, tx, tw } = cfg, lines = wrap(d.quote, tw, QS, 600);
    const words = []; lines.forEach((ln, li) => { let x = 0; ln.split(" ").forEach(wd => { const ww = measure(wd, QS, 600); words.push({ wd, li, x, ww }); x += ww + measure(" ", QS, 600); }); });
    const emIdx = (() => { if (!d.em) return null; const em = d.em.toLowerCase().split(" "), ws = words.map(q => q.wd.toLowerCase().replace(/[.,!?;:]/g, "")); for (let i = 0; i + em.length <= ws.length; i++) if (em.every((e, k) => ws[i + k] === e.replace(/[.,!?;:]/g, ""))) return [i, i + em.length - 1]; return null; })();
    const qy = [210 - (lines.length * LHt) / 2 + 36, 170, 250, 200][V], NL = lines.length, wave = Array.from({ length: 46 }, () => [r.range(0.25, 1), r.range(0, 6.28), r.range(1.5, 3.5)]);
    const surname = String(d.by).replace(/\(.*?\)/g, "").trim().split(" ").filter(x => /^[A-Z]/.test(x) && !/^(Jr|Sr)\.?$/.test(x)).pop() ?? "Speaker";
    const mk = (g, x, y, s, a = 0.16) => { g.save(); g.translate(x, y); g.scale(s, s); g.beginPath(); g.arc(0, 0, 18, 0, 7); g.moveTo(18, 0); g.quadraticCurveTo(14, 38, -16, 54); g.quadraticCurveTo(0, 30, -2, 16); g.closePath(); ui.fill(g, `rgba(43,42,39,${a})`); g.restore(); };
    const drawWords = (g, t, t0, x0, y0) => { words.forEach((q, i) => { const ts = t0 + 0.2 + i * 0.13, u = ease.out(seg(t, ts, ts + 0.35)); if (u <= 0) return; g.save(); g.globalAlpha *= u; g.translate(0, (1 - u) * 14); ui.caption(g, q.wd, x0 + q.x, y0 + q.li * LHt + 36, { size: QS, align: "left", color: P.ink, weight: 600, caps: false, spacing: 0 }); g.restore(); });
      if (emIdx) { const ts = t0 + 0.2 + words.length * 0.13 + 0.1, u = seg(t, ts, ts + 0.9); for (let li = 0; li < NL; li++) { const ws = words.filter((q, i) => q.li === li && i >= emIdx[0] && i <= emIdx[1]); if (!ws.length) continue; const a = ws[0].x, b = ws[ws.length - 1].x + ws[ws.length - 1].ww; sweep(g, x0 + a - 4, y0 + li * LHt + 8, b - a + 8, QS * 1.42, u, true); } } };
    const attrib = (g, t, t1, x, y, rule = 260) => { const au = ease.io(seg(t, t1 - 0.2, t1 + 0.7)); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rule * au, y); ui.ink(g, 4, P.ink);
      g.save(); g.globalAlpha *= seg(t, t1 + 0.2, t1 + 0.8); ui.caption(g, d.by, x, y + 46, { size: F.cap, align: "left", color: P.ink, weight: 800 }); if (d.role) ui.caption(g, d.role, x, y + 90, { size: F.small, align: "left", color: P.ink2, caps: false, spacing: 0, weight: 500 }); g.restore(); };
    const when = (g, t, t1, x, y, rot = 0.03) => { if (!d.when) return; const wu = ease.back(seg(t, t1 + 0.5, t1 + 1.0)); g.save(); g.translate(x, y); g.scale(wu, wu); g.rotate(rot); ui.tag(g, d.when, 0, 0, { size: F.small }); g.restore(); };
    const ay = qy + NL * LHt + 70;
    const focus = [
      [{ id: "quote", x: 0, y: 0, w, h }, { id: "by", x: 20, y: 120, w: w - 20, h: 520 }],
      [{ id: "quote", x: 0, y: 0, w, h }, { id: "by", x: 80, y: ay - 160, w: w - 80, h: h - ay + 160 }],
      [{ id: "quote", x: 40, y: 40, w: 1040, h: 760 }, { id: "by", x: 600, y: 60, w: 1000, h: 780 }],
      [{ id: "quote", x: 0, y: 0, w: 1180, h }, { id: "by", x: 600, y: 60, w: w - 600, h: h - 60 }]][V];
    return {
      w, h, focus, layout: V,
      draw(g, t, at) {
        const t0 = at.quote ?? 0, t1 = at.by ?? t0 + 2.6; ui.base(g, w, h, { r: 18 }); const pu = ease.out(seg(t, t0 - 0.3, t0 + 0.6));
        if (V === 0) { g.save(); g.globalAlpha *= pu; icon(g, "podium", 230, 360, 470, { seed, t }); for (let k = 0; k < 3; k++) { const ph = ((t * 0.8 + k / 3) % 1), a = (1 - ph) * 0.7; g.save(); g.globalAlpha *= a * pu; g.beginPath(); g.arc(300, 150, 34 + ph * 90, -0.8, 0.8); ui.ink(g, 3.5, P.ink2); g.restore(); } g.restore();
          const qu = ease.out(seg(t, t0, t0 + 0.6)); g.save(); g.globalAlpha *= qu; mk(g, tx - 56, qy - 12, 1.4); mk(g, tx - 14, qy - 12, 1.4); g.restore();
          drawWords(g, t, t0, tx, qy); attrib(g, t, t1, tx, ay); when(g, t, t1, w - 210, 70); if (d.cap) ui.caption(g, d.cap, w / 2, h - 40, { size: F.small, color: P.mid }); return; }
        if (V === 1) { const qu = ease.out(seg(t, t0 - 0.2, t0 + 0.5)); g.save(); g.globalAlpha *= qu; mk(g, 120, 120, 2.6, 0.13); mk(g, 200, 120, 2.6, 0.13); g.restore();
          const bu = ease.io(seg(t, t0, t0 + 0.4 + NL * 0.4)); g.beginPath(); g.moveTo(150, qy + 4); g.lineTo(150, qy + 4 + (NL * LHt + 20) * bu); ui.ink(g, 7, P.red);
          if (d.cap) ui.caption(g, d.cap, tx, 70, { size: F.small, align: "left", color: P.mid, weight: 700, alpha: qu }); drawWords(g, t, t0, tx, qy);
          const su = seg(t, t1 - 0.3, t1 + 0.5); ui.pop(g, su, 300, ay + 70, () => icon(g, "speaker", 0, 0, 230, { seed, t }), "settle"); attrib(g, t, t1, 470, ay); when(g, t, t1, w - 230, ay + 56, -0.02);
          g.save(); g.globalAlpha *= pu * 0.6; g.setLineDash([3, 10]); g.beginPath(); g.moveTo(tx, ay - 40); g.lineTo(w - 120, ay - 40); ui.ink(g, 2, P.mid); g.setLineDash([]); g.restore(); return; }
        if (V === 2) { g.save(); g.translate(90, 90); g.rotate(-0.022); const cu = ease.out(seg(t, t0 - 0.35, t0 + 0.35)); g.globalAlpha *= cu; g.translate(0, (1 - cu) * 30);
          sheet(g, 0, 0, 940, 680); ui.tape(g, 120, 4, 150, -0.12, 0.95); ui.tape(g, 820, 8, 150, 0.1, 0.95);
          ui.caption(g, d.when ?? "Report", 60, 70, { size: F.small, align: "left", color: P.mid, weight: 700 }); g.beginPath(); g.moveTo(60, 104); g.lineTo(880, 104); ui.ink(g, 3, P.ink2); g.beginPath(); g.moveTo(60, 112); g.lineTo(880, 112); ui.ink(g, 1.2, P.ink2);
          drawWords(g, t, t0, 60, 140); greek(g, 60, 160 + NL * LHt + 30, 820, Math.max(2, Math.min(6, Math.floor((600 - NL * LHt - 190) / 30))), seed, seg(t, t0, t0 + 1.2)); g.restore();
          const fu = seg(t, t1 - 0.3, t1 + 0.4), fx = 1300, fy = 620; ui.pop(g, fu, fx, fy, () => icon(g, "figure", 0, 0, 380, { seed, t, p: { arm: "gesture" } }), "settle");
          const lu = seg(t, t1, t1 + 0.7); if (lu > 0) { g.save(); g.setLineDash([9, 9]); g.beginPath(); g.moveTo(fx - 60, fy - 300); g.quadraticCurveTo(fx - 160, fy - 420, lerp(fx - 160, 1030, ease.io(lu)), lerp(fy - 420, 300, ease.io(lu))); ui.ink(g, 3, P.red); g.setLineDash([]); g.restore(); }
          g.save(); g.globalAlpha *= seg(t, t1 + 0.2, t1 + 0.8); fit(g, d.by, fx, fy + 240, 560, { size: F.cap, color: P.ink, weight: 800 }); if (d.role) fit(g, d.role, fx, fy + 284, 560, { size: F.small, color: P.ink2, weight: 500, caps: false }); g.restore();
          if (d.cap) ui.caption(g, d.cap, 560, h - 40, { size: F.small, color: P.mid }); return; }
        // V3 transcript
        g.save(); g.globalAlpha *= pu; ui.caption(g, "Transcript", 110, 90, { size: F.small, align: "left", color: P.ink2, weight: 800 }); if (d.when) chip(g, d.when, 420 + measure(d.when, F.small, 700) / 2 + 30, 90, {}); g.beginPath(); g.moveTo(110, 130); g.lineTo(1120, 130); ui.ink(g, 2.5, P.ink2); g.restore();
        for (let li = 0; li < Math.max(NL + 2, 5); li++) { const y = qy + li * LHt + 36, u = seg(t, t0 - 0.2 + li * 0.08, t0 + 0.3 + li * 0.08); if (u <= 0) continue; g.save(); g.globalAlpha *= u; ui.caption(g, String(li + 1).padStart(2, "0"), 120, y, { size: F.small, align: "left", color: P.mid, weight: 600, spacing: 1 });
          if (li >= NL) greek(g, tx, y - 10, 520 - (li - NL) * 140, 1, seed + li, 1); g.restore(); }
        ui.caption(g, surname + ":", 190, qy + 36, { size: F.small, align: "left", color: P.redInk, weight: 800, alpha: pu }); drawWords(g, t, t0, tx, qy);
        const wx = 1210, wy = 330, wu = seg(t, t1 - 0.4, t1 + 0.3); if (wu > 0) { g.save(); g.globalAlpha *= wu; g.beginPath(); g.moveTo(wx - 20, wy); g.lineTo(wx + 400, wy); ui.ink(g, 1.5, P.hair);
          wave.forEach(([a, ph, f], k) => { const x = wx + k * 8.6, amp = (14 + 70 * a) * (0.55 + 0.45 * Math.abs(Math.sin(t * f + ph))) * wu; g.beginPath(); g.moveTo(x, wy - amp); g.lineTo(x, wy + amp); ui.ink(g, 4, k > 18 && k < 30 ? P.red : P.ink2); });
          ui.ruler(g, wx - 20, wx + 400, wy + 120, 21, wu, { w: 2, color: P.stone2, major: 5 }); g.restore();
          ui.pop(g, wu, wx - 110, wy - 10, () => { circ(g, 0, -40, 30, P.ink2, 3); for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(-22, -40 + k * 9); g.lineTo(22, -40 + k * 9); ui.ink(g, 1.4, "rgba(255,255,255,.45)"); } g.beginPath(); g.moveTo(0, -10); g.lineTo(0, 70); ui.ink(g, 5, P.ink2); g.beginPath(); g.moveTo(-36, 74); g.lineTo(36, 74); ui.ink(g, 6, P.ink2); }); }
        attrib(g, t, t1, 1190, 520, 300); if (d.cap) ui.caption(g, d.cap, 110, h - 50, { size: F.small, align: "left", color: P.mid });
      },
    };
  },
};
