// kind: beforeAfter (family: comparison) - ONE generated scene (sky, hills, sun/clouds, ground + object slots) shown in two states; a red divider wipes across from right to left
// revealing the "after" state over the same layout, with a count strip underneath (before -> after per object type).
// data: { items: [{ what: "tree", before: 14, after: 3, label: "Trees" }, { what: "building", before: 2, after: 9, label: "Buildings" }] (1..4 object types), beforeLabel: "1990", afterLabel: "2024", cap: "...", note: "(optional)" }
// focus ids: "before" (scene landing in its first state), "after" (the wipe + count strip)
import * as H from "./_h_numcmp.js";
export default {
  name: "beforeAfter", family: "comparison",
  doc: "One generated scene in two states with a red divider wipe revealing the after-state, plus a before->after count strip.",
  example: [{ items: [{ what: "tree", before: 16, after: 4, label: "Trees" }, { what: "building", before: 2, after: 8, label: "Buildings" }, { what: "car", before: 1, after: 6, label: "Cars" }], beforeLabel: "1990", afterLabel: "2024", cap: "The same valley", note: "forest traded for town" },
            { items: [{ what: "container", before: 3, after: 12, label: "Boxes" }, { what: "crane", before: 1, after: 3, label: "Cranes" }], beforeLabel: "2000", afterLabel: "2023", cap: "One quay, two decades" }],
  build(d, K) {
    const { ui, P, F, ease, seg, clamp, lerp, rng } = K, { lab, sit, measure, line, flag, fmt, hashSeed, ell, tw } = H, r = rng;
    const I = d.items.slice(0, 4), w = 1700, h = 920, sx = 90, sy = 100, sw = w - 180, sh = 560, gy = sy + sh - 110;
    // slots: each type gets a zone proportional to its max count; two depth rows (back smaller, higher)
    const tot = I.reduce((a, it) => a + Math.max(it.before, it.after), 0) || 1; let zx = sx + 40; const slots = [];
    I.forEach((it, ti) => { const mxn = Math.max(it.before, it.after), zw = (sw - 80) * Math.max(mxn, 1) / tot; const m = measure(it.what, 4); for (let i = 0; i < mxn; i++) { const row = i % 2, col = Math.floor(i / 2), cols = Math.ceil(mxn / 2), x = zx + (col + 0.5 + (row ? 0.3 : -0.1)) / cols * zw + r.range(-8, 8), y = gy + (row ? -26 : 34) + r.range(-6, 6), sc = row ? 0.8 : 1;
        slots.push({ ti, i, x, y, row, s: clamp(Math.min(zw / cols * 1.3, 170), 60, 170) * sc, seed: hashSeed(K.seed, 100 + ti * 40 + i) }); } zx += zw; });
    slots.sort((a, b) => a.y - b.y);
    const back = Array.from({ length: 3 }, (_, i) => ({ x: sx + sw * (0.12 + 0.38 * i) + r.range(-40, 40), s: r.range(380, 520), seed: hashSeed(K.seed, 7 + i) })), clouds = Array.from({ length: 3 }, (_, i) => ({ x: sx + sw * (0.15 + 0.33 * i), y: sy + 70 + r.range(0, 70), s: r.range(160, 230), sp: r.range(6, 14), seed: hashSeed(K.seed, 20 + i) }));
    const drawBackdrop = (g, t) => { g.save(); g.beginPath(); ui.rr(g, sx, sy, sw, sh, 16); g.clip(); const gr = g.createLinearGradient(0, sy, 0, sy + sh); gr.addColorStop(0, P.paper2); gr.addColorStop(1, P.sand); g.fillStyle = gr; g.fillRect(sx, sy, sw, sh);
      for (const c of clouds) { g.save(); g.translate(sx + ((c.x - sx + t * c.sp) % (sw + 300)) - 100, c.y); g.globalAlpha = 0.9; SHcloud(g, c); g.restore(); }
      for (const b of back) { g.save(); g.translate(b.x, gy - 40); g.globalAlpha = 0.9; SHhill(g, b); g.restore(); }
      g.fillStyle = P.sand2; g.fillRect(sx, gy + 40, sw, sh); g.beginPath(); g.moveTo(sx, gy + 40); g.lineTo(sx + sw, gy + 40); ui.ink(g, 3, P.ink2); g.restore(); };
    const SHcloud = (g, c) => H.obj(g, c.seed, "cloud", c.s, {}), SHhill = (g, b) => H.obj(g, b.seed, "hill", b.s, {});
    const drawState = (g, t, which, u) => { slots.forEach((s, k) => { const n = I[s.ti][which]; if (s.i >= n) return; const lu = u === undefined ? 1 : seg(u, (k / slots.length) * 0.8, (k / slots.length) * 0.8 + 0.3); if (lu <= 0) return;
        ui.pop(g, lu, s.x, s.y, () => { ell(g, 0, 3, s.s * 0.4, 6, 0.7); sit(g, s.seed, I[s.ti].what, s.s, 0, 0, { t }); }, "settle"); }); };
    return {
      w, h, focus: [{ id: "before", x: 40, y: 70, w: w - 80, h: 620 }, { id: "after", x: 40, y: 70, w: w - 80, h: h - 90 }],
      draw(g, t, at) {
        const t0 = at.before ?? 0, t1 = at.after ?? t0 + 2.6;
        ui.card(g, 0, 0, w, h, { r: 18 }); if (d.cap) ui.caption(g, d.cap, w / 2, 52, { size: F.small, color: P.mid });
        const wp = ease.io5(seg(t, t1 - 0.1, t1 + 1.9)), wx = lerp(sx + sw, sx, wp), au = seg(t, t0 - 0.1, t0 + 0.4);
        g.save(); g.globalAlpha = au; drawBackdrop(g, t); g.restore();
        g.save(); g.beginPath(); ui.rr(g, sx, sy, sw, sh, 16); g.clip(); drawState(g, t, "before", seg(t, t0 + 0.1, t0 + 1.8));
        // after state: re-paint the backdrop over the revealed strip, then the after objects
        if (wp > 0) { g.save(); g.beginPath(); g.rect(wx, sy, sx + sw - wx + 2, sh); g.clip(); drawBackdrop(g, t); drawState(g, t, "after", undefined); g.restore(); }
        g.restore();
        ui.rr(g, sx, sy, sw, sh, 16); ui.ink(g, 4, P.ink2);
        // state tags
        const tu = seg(t, t0 + 0.3, t0 + 0.9); if (tu > 0) ui.pop(g, tu, sx + 150, sy + 44, () => ui.tag(g, d.beforeLabel ?? "before", 0, 0, { color: P.ink })); const ta = seg(t, t1 + 0.9, t1 + 1.5); if (ta > 0) ui.pop(g, ta, sx + sw - 150, sy + 44, () => ui.tag(g, d.afterLabel ?? "after", 0, 0, { color: P.redInk }));
        // divider: red line + handle with arrows
        if (wp > 0 && wp < 0.999) { line(g, wx, sy - 8, wx, sy + sh + 8, 6, P.red); g.save(); g.translate(wx, sy + sh / 2); g.beginPath(); g.arc(0, 0, 34, 0, 7); ui.fill(g, P.paper); ui.ink(g, 5, P.red);
          for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 8, -12); g.lineTo(sd * 20, 0); g.lineTo(sd * 8, 12); ui.ink(g, 4, P.red); } g.restore(); }
        // count strip
        const sy2 = sy + sh + 60, cw = (w - 180) / I.length;
        I.forEach((it, i) => { const cu = seg(t, t0 + 1.0 + i * 0.2, t0 + 1.6 + i * 0.2), x = sx + cw * (i + 0.5); if (cu <= 0) return; const ch = Math.abs(it.after - it.before) === Math.max(...I.map(q => Math.abs(q.after - q.before)));
          g.save(); g.globalAlpha = cu; ui.rr(g, x - cw / 2 + 12, sy2, cw - 24, 150, 16); ui.fill(g, P.paper2); ui.ink(g, 2, P.hair); g.restore();
          const am = ease.out(seg(t, t1 + 0.3, t1 + 2.0)), v = Math.round(lerp(it.before, it.after, wp > 0 ? am : 0));
          g.save(); g.globalAlpha = cu; sit(g, hashSeed(K.seed, 300 + i), it.what, 84, x - cw / 2 + 90, sy2 + 120, { t }); lab(g, it.label ?? it.what, x - cw / 2 + 90, sy2 + 24, { maxW: 150, color: P.ink2, weight: 700, size: F.small });
          ui.num(g, String(v), x + 50, sy2 + 78, { size: F.num * 1.15, color: wp > 0.5 && ch ? P.red : P.ink }); ui.caption(g, (wp > 0.5 ? "was " : "now ") + (wp > 0.5 ? it.before : it.before), x + 50, sy2 + 126, { size: F.small, caps: false, spacing: 0, color: P.mid }); g.restore(); });
        if (d.note) { const nu = seg(t, t1 + 1.6, t1 + 2.3); if (nu > 0) ui.pop(g, nu, w / 2, sy + sh - 36, () => flag(g, d.note, 0, 0, { red: true })); }
      },
    };
  },
};
