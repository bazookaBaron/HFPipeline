// kind: vennOverlap (family: comparison) - 2 or 3 overlapping sets drawn as soft tinted discs; generated objects are placed (solved at build time, farthest-point inside each exact region) into
// the set(s) they belong to; the all-sets overlap region is tinted and outlined red, set name tags with counts, optional item captions.
// data: { sets: [{ label: "Rail" }, { label: "Road" }, { label: "Sea" }] (2..3), items: [{ what: "container", in: [0, 1], label?: "Boxes" }, ...] (in = indices of the sets the item belongs to), cap: "...", note: "(optional)" }
// focus ids: "sets" (the discs + items landing), "overlap" (the all-sets region + its items)
import * as H from "./_h_numcmp.js";
export default {
  name: "vennOverlap", family: "comparison",
  doc: "2-3 overlapping tinted sets with generated objects solved into exact regions; the common overlap is red-outlined; name tags with counts.",
  example: [{ sets: [{ label: "Sells online" }, { label: "Sells in stores" }], items: [{ what: "laptop", in: [0] }, { what: "phone", in: [0] }, { what: "chip", in: [0] }, { what: "building", in: [1] }, { what: "pallet", in: [1] }, { what: "truck", in: [0, 1] }, { what: "container", in: [0, 1] }], cap: "Who sells where", note: "two in three do both" },
            { sets: [{ label: "Oil" }, { label: "Gas" }, { label: "Coal" }], items: [{ what: "barrel", in: [0] }, { what: "pumpjack", in: [0] }, { what: "gasFlare", in: [1] }, { what: "pipe", in: [1] }, { what: "rock", in: [2] }, { what: "chimney", in: [2] }, { what: "refineryColumn", in: [0, 1] }, { what: "power", in: [1, 2] }, { what: "factory", in: [0, 2] }, { what: "building", in: [0, 1, 2] }], cap: "Fossil mix", note: "one plant burns all three" }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp, rng } = K, { lab, sit, measure, line, flag, hashSeed, tw, ell } = H;
    const S = d.sets.slice(0, 3), ns = S.length, w = 1600, h = 900, cx = w / 2, cy = 480, Rc = ns === 2 ? 285 : 245;
    const C = ns === 2 ? [[cx - Rc * 0.58, cy], [cx + Rc * 0.58, cy]] : [[cx - Rc * 0.6, cy + Rc * 0.38], [cx + Rc * 0.6, cy + Rc * 0.38], [cx, cy - Rc * 0.62]];
    const mem = (x, y) => C.map(([a, b]) => Math.hypot(x - a, y - b) < Rc - 6), depth = (x, y, sig) => Math.min(...C.map(([a, b], i) => { const dd = Math.hypot(x - a, y - b); return sig.includes(i) ? Rc - dd : dd - Rc; }));
    const items = d.items.map((it, i) => ({ ...it, in: (it.in ?? [0]).filter(k => k < ns).sort() })); const placed = [];
    // candidate grid points per exact signature; greedy farthest-point placement, preferring deep points
    const cands = new Map(); for (let x = cx - Rc * 2; x <= cx + Rc * 2; x += 14) for (let y = cy - Rc * 1.4; y <= cy + Rc * 1.4; y += 14) { const m = mem(x, y), sig = m.map((v, i) => v ? i : -1).filter(i => i >= 0); if (!sig.length) continue; const key = sig.join(","); if (!cands.has(key)) cands.set(key, []); cands.get(key).push([x, y, depth(x, y, sig)]); }
    items.forEach((it, i) => { const list = (cands.get(it.in.join(",")) || []).filter(p => p[2] > 52), pool = list.length ? list : (cands.get(it.in.join(",")) || []); let best = null, bs = -1; for (const p of pool) { const dmin = placed.length ? Math.min(...placed.map(q => Math.hypot(p[0] - q.x, p[1] - q.y))) : 200; const sc = Math.min(dmin, 190) + p[2] * 0.6; if (sc > bs) { bs = sc; best = p; } } if (!best) best = [cx, cy, 0]; placed.push({ x: best[0], y: best[1], i }); });
    const cnt = S.map((s, k) => items.filter(it => it.in.includes(k)).length), all = S.map((s, k) => k), isAll = it => it.in.length === ns, ms = items.map(it => measure(it.what, 4)), isz = ns === 2 ? 118 : 102;
    const tagPos = ns === 2 ? [[cx - Rc * 1.2, cy - Rc - 10], [cx + Rc * 1.2, cy - Rc - 10]] : [[cx - Rc * 1.35, cy + Rc * 1.0], [cx + Rc * 1.35, cy + Rc * 1.0], [cx, cy - Rc * 1.68]];
    const lensClip = (g) => { g.beginPath(); g.rect(0, 0, w, h); g.clip(); C.forEach(([a, b]) => { g.beginPath(); g.arc(a, b, Rc, 0, 7); g.clip(); }); };
    return {
      w, h, focus: [{ id: "sets", x: 30, y: 60, w: w - 60, h: h - 80 }, { id: "overlap", x: cx - 560, y: cy - 400, w: 1120, h: 700 }],
      draw(g, t, at) {
        const t0 = at.sets ?? 0, t1 = at.overlap ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 56, { size: F.small, color: P.mid });
        // discs
        const tints = ["rgba(185,204,211,.55)", "rgba(227,216,194,.7)", "rgba(197,191,178,.5)"];
        S.forEach((s, k) => { const u = ease.back(seg(t, t0 - 0.1 + k * 0.25, t0 + 0.6 + k * 0.25)); if (u <= 0) return; g.save(); g.translate(C[k][0], C[k][1]); g.scale(u, u); ui.shadow(g, () => { g.beginPath(); g.arc(0, 0, Rc, 0, 7); }, 6, 12, 0.7); g.beginPath(); g.arc(0, 0, Rc, 0, 7); g.fillStyle = tints[k]; g.fill(); g.save(); g.clip(); g.strokeStyle = "rgba(43,42,39,.08)"; g.lineWidth = 2; for (let x = -Rc * 2; x < Rc * 2; x += 14 + k * 3) { g.beginPath(); g.moveTo(x, Rc); g.lineTo(x + Rc, -Rc); g.stroke(); } g.restore(); g.beginPath(); g.arc(0, 0, Rc, 0, 7); ui.ink(g, 4, P.ink2); g.restore(); });
        // the all-sets overlap: red tint + red outline, appears at "overlap"
        const ou = seg(t, t1 - 0.2, t1 + 0.8); if (ou > 0) { g.save(); lensClip(g); g.globalAlpha = ease.io(ou); g.fillStyle = "rgba(200,38,29,.14)"; g.fillRect(0, 0, w, h); g.restore();
          C.forEach(([a, b], k) => { g.save(); C.forEach(([a2, b2], k2) => { if (k2 !== k) { g.beginPath(); g.arc(a2, b2, Rc, 0, 7); g.clip(); } }); g.globalAlpha = ease.io(ou); g.beginPath(); g.arc(a, b, Rc, 0, 7); ui.ink(g, 7, P.red); g.restore(); }); }
        // items: land in order (alternating sets), settle; items in every set get red only via the region tint
        items.forEach((it, i) => { const ts = t0 + 0.5 + (isAll(it) ? 0 : i * Math.min(0.28, 1.6 / items.length)) + (isAll(it) ? 1.9 + Math.min(1.2, items.length * 0.2) - 1.2 : 0) , u = seg(t, isAll(it) ? t1 + 0.1 : ts, (isAll(it) ? t1 + 0.1 : ts) + 0.6); if (u <= 0) return; const p = placed[i];
          ui.pop(g, u, p.x, p.y, () => { ell(g, 0, isz * 0.32, isz * 0.42, 6, 0.7); sit(g, hashSeed(K.seed, 150 + i), it.what, isz, 0, isz * Math.max(ms[i].h / Math.max(ms[i].w, ms[i].h), 0.3) / 2 + 6, { t }); }, "settle");
          if (it.label && u > 0.6) ui.caption(g, it.label, p.x, p.y + isz * 0.55, { size: F.small, caps: false, spacing: 0, color: P.ink2, alpha: seg(u, 0.6, 1) }); });
        // set tags with counts
        S.forEach((s, k) => { const u = seg(t, t0 + 0.5 + k * 0.25, t0 + 1.0 + k * 0.25); if (u > 0) ui.pop(g, u, tagPos[k][0], tagPos[k][1], () => { ui.tag(g, s.label, 0, 0, { color: P.ink }); ui.num(g, String(cnt[k]), (tw(s.label, F.small, 700) + 44) / 2 + 40, 0, { size: F.num * 0.7, color: P.ink2 }); }); });
        if (d.note) { const nu = seg(t, t1 + 0.9, t1 + 1.6); if (nu > 0) ui.pop(g, nu, cx, h - 70, () => flag(g, d.note, 0, 0, { red: true })); }
      },
    };
  },
};
