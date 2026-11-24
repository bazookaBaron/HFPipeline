// mg2d/board.js - data-driven 2D link board (element MG, never typographic).
// Everything is solved at runtime from the spec: card layout (seeded, scattered far apart, strings never cross a card),
// ride order, camera legs (follow the string, dip out, push in), pull-back framing for ANY aspect (9:16 or 16:9).
//
//   import { makeBoard } from "./mg2d/board.js";
//   const B = makeBoard({ seed: 4, items: [{ id, cap, art, key, p }...], links: [[a, b, red?]...] (optional: default = ride chain) }, { W, H });
//   B.T            total duration (s);  B.arrive[id] card arrival time (s)  -> narration anchors / sfx cues
//   B.cues         [[t, sfxId, dB, pan]...] for audio/mix.py
//   B.draw(ctx, t) draws frame t (0..T) into a W x H Canvas2D
import { ART } from "./art.js";

export const PAL = { board: "#e6e1d5", board2: "#ddd7c9", dot: "rgba(90,80,62,.16)", paper: "#fffdf8", paper2: "#f6f2e9", ink: "#2b2a27", mid: "#8b867b",
  hair: "#d3cdbf", lite: "#e2ddd1", water: "#cfdee3", sand: "#f1ebdd", red: "#c8261d", yarn: "#7b766c", tape: "rgba(233,226,206,.82)" };
const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u), ease5 = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (6 * u - 15) + 10);
const lerp = (a, b, u) => a + (b - a) * u, clamp = (x, a, b) => Math.max(a, Math.min(b, x)), D = Math.PI / 180;
const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

export function makeBoard(spec, { W, H }) {
  const R = rng(spec.seed || 7), n = spec.items.length, port = H > W;
  const CW = 700, CH = 620;                                   // card size in board units (art is drawn in this space)
  // ---- layout: rejection-sample positions on a board whose aspect matches the frame; ride order = spec order
  let BW = (port ? 2.9 : 4.6) * CW * Math.sqrt(n / 5), BH = BW * H / W;
  let best = null;
  for (let tries = 0; tries < 1200; tries++) {
    if (tries && tries % 150 === 0 && !best) { BW *= 1.1; BH = BW * H / W; }   // grow the board until the cards fit far apart
    const P = []; let ok = true;
    for (let i = 0; i < n && ok; i++) { let placed = false;
      for (let k = 0; k < 200 && !placed; k++) { const x = CW * 0.7 + R() * (BW - CW * 1.4), y = CH * 0.7 + R() * (BH - CH * 1.4);
        if (P.every(q => Math.hypot(q.x - x, q.y - y) > CW * 1.45)) { P.push({ x, y, r: (R() - 0.5) * 11 }); placed = true; } }
      ok = placed; }
    if (!ok) continue;
    // legs must not pass over a third card; prefer a layout whose ride legs are long and varied in direction
    const legs = []; for (let i = 0; i < n - 1; i++) legs.push([i, i + 1]); legs.push([n - 1, 0]);
    const sag = (A, B, u) => { const L = Math.hypot(B.x - A.x, B.y - A.y), cx = (A.x + B.x) / 2, cy = (A.y + B.y) / 2 + L * 0.085, v = 1 - u; return { x: v * v * A.x + 2 * v * u * cx + u * u * B.x, y: v * v * A.y + 2 * v * u * cy + u * u * B.y }; };
    const nearCard = (pt, q) => Math.abs(pt.x - q.x) < CW * 0.62 && Math.abs(pt.y - q.y) < CH * 0.62;   // the sagging string, sampled, must stay off every other card
    const clear = legs.every(([a, b]) => P.every((q, j) => j === a || j === b || ![...Array(25)].some((_, i) => nearCard(sag(P[a], P[b], i / 24), q))));
    if (!clear) continue;
    const score = legs.reduce((s, [a, b]) => s + Math.min(Math.hypot(P[a].x - P[b].x, P[a].y - P[b].y), CW * 3), 0);
    if (!best || score > best.score) best = { P, score };
    if (tries > 60 && best) break;
  }
  if (!best) throw new Error("board layout failed: too many items for the board");
  const cards = spec.items.map((it, i) => ({ ...it, ...best.P[i], w: CW, h: CH }));
  const byId = Object.fromEntries(cards.map(c => [c.id, c]));
  const links = (spec.links || cards.map((c, i) => [c.id, cards[(i + 1) % n].id, !!(c.key && i === 0)]));
  const pinOf = c => { const a = c.r * D, py = -c.h / 2 + 40; return { x: c.x - Math.sin(a) * py, y: c.y + Math.cos(a) * py }; };

  // ---- timing: open on card 0, ride each leg, hold, then pull back while the last string closes the loop
  const HOLD0 = spec.hold0 ?? 1.5, TRAV = spec.trav ?? 1.4, HOLD = spec.hold ?? 1.3, PULL = spec.pull ?? 2.0, END = spec.end ?? 0.6;
  const legT = []; for (let i = 0; i < n - 1; i++) { const a = HOLD0 + i * (TRAV + HOLD); legT.push({ a, b: a + TRAV }); }
  const PULL0 = legT[n - 2].b + HOLD, T = PULL0 + PULL + END; legT.push({ a: PULL0, b: PULL0 + PULL });
  const arrive = { [cards[0].id]: 0 }; for (let i = 1; i < n; i++) arrive[cards[i].id] = legT[i - 1].b;

  // camera zoom so a card fills the frame comfortably in either aspect
  const ZC = Math.min(0.84 * W / CW, 0.62 * H / CH), ZF = Math.min(W / (BW * 1.04), H / (BH * 1.04));
  const strPt = (A, B, u) => { const L = Math.hypot(B.x - A.x, B.y - A.y), cx = (A.x + B.x) / 2, cy = (A.y + B.y) / 2 + L * 0.085, v = 1 - u;
    return { x: v * v * A.x + 2 * v * u * cx + u * u * B.x, y: v * v * A.y + 2 * v * u * cy + u * u * B.y }; };
  function camAt(t) {
    const c0 = cards[0];
    if (t < legT[0].a) return { x: c0.x, y: c0.y, z: ZC * lerp(0.86, 1, ease(t / HOLD0)), r: c0.r * 0.55 };
    for (let i = 0; i < n - 1; i++) { const { a, b } = legT[i], A = cards[i], B = cards[i + 1], nextA = i < n - 2 ? legT[i + 1].a : PULL0;
      if (t < b) { const e = ease5((t - a) / (b - a)), w = Math.sin(Math.PI * e), p = strPt(pinOf(A), pinOf(B), e);
        return { x: lerp(lerp(A.x, B.x, e), p.x, 0.75 * w), y: lerp(lerp(A.y, B.y, e), p.y + CH * 0.3, 0.75 * w), z: ZC * (1 - 0.45 * w), r: lerp(A.r, B.r, e) * 0.55 }; }
      if (t < nextA) { const u = (t - b) / (nextA - b); return { x: B.x + u * 14, y: B.y, z: ZC * (1 + 0.05 * u), r: B.r * 0.55 }; } }
    const B = cards[n - 1], u = ease5((t - PULL0) / PULL);
    return { x: lerp(B.x + 14, BW / 2, u), y: lerp(B.y, BH / 2, u), z: Math.exp(lerp(Math.log(ZC * 1.05), Math.log(ZF), u)), r: lerp(B.r * 0.55, 0, u) };
  }

  // ---- static board texture: warm paper with grain + dot grid + soft light falloff (built once per board)
  const pad = CW * 2, tex = document.createElement("canvas"); const TS = 440; tex.width = tex.height = TS;   // 4 x 110 dot pitch, dots baked in
  { const x = tex.getContext("2d"), r2 = rng(99); x.fillStyle = PAL.board; x.fillRect(0, 0, TS, TS);
    for (let i = 0; i < 14000; i++) { x.fillStyle = `rgba(${r2() < .5 ? "255,255,255" : "110,98,78"},${0.03 + r2() * 0.06})`; x.fillRect(r2() * TS, r2() * TS, 1 + r2() * 1.6, 1 + r2() * 1.6); }
    for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(110,98,78,${0.025 + r2() * 0.03})`; x.lineWidth = 1; x.beginPath(); const a = r2() * TS, b = r2() * TS; x.moveTo(a, b); x.lineTo(a + (r2() - .5) * 120, b + (r2() - .5) * 30); x.stroke(); }
    x.fillStyle = PAL.dot; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(i * 110 + 55, j * 110 + 55, 2.6, 0, 7); x.fill(); } }
  let pat = null;

  function drawBoard(g, cam) {
    pat = pat || g.createPattern(tex, "repeat"); g.fillStyle = pat; g.fillRect(-pad, -pad, BW + 2 * pad, BH + 2 * pad);
  }
  function drawYarn(g, A, B, p, red) {
    if (p <= 0) return; const N = 70, m = Math.ceil(N * p), pts = []; for (let i = 0; i <= m; i++) pts.push(strPt(A, B, Math.min(p, i / N)));
    const path = () => { g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); };
    g.lineCap = "round"; g.lineJoin = "round";
    g.save(); g.translate(5, 14); g.strokeStyle = "rgba(60,48,30,.07)"; for (const lw of [16, 10]) { g.lineWidth = lw; path(); g.stroke(); } g.restore();   // soft shadow without canvas filters (slow)
    g.strokeStyle = red ? PAL.red : PAL.yarn; g.lineWidth = red ? 7 : 5; path(); g.stroke();
    g.strokeStyle = red ? "rgba(255,190,180,.55)" : "rgba(255,255,255,.35)"; g.lineWidth = red ? 2 : 1.6; g.setLineDash([7, 9]); path(); g.stroke(); g.setLineDash([]);   // twist highlight
  }
  function drawCard(g, c, t, idx) {
    const a0 = arrive[c.id] - (idx ? 0.6 : 0); if (t < a0) return; const u = idx ? clamp((t - a0) / 0.6, 0, 1) : 1, e = ease(u);
    g.save(); g.translate(c.x, c.y); g.rotate(c.r * D); g.scale(lerp(1.16, 1, e), lerp(1.16, 1, e)); g.globalAlpha = e;
    // layered shadow: soft ambient + tight contact (card lands on the board)
    g.shadowColor = "rgba(70,55,30,.16)"; g.shadowBlur = lerp(80, 46, e); g.shadowOffsetY = lerp(60, 22, e); g.fillStyle = PAL.paper; rr(g, -c.w / 2, -c.h / 2, c.w, c.h, 14); g.fill();
    g.shadowColor = "rgba(70,55,30,.22)"; g.shadowBlur = 6; g.shadowOffsetY = 3; g.fill(); g.shadowColor = "transparent";
    const gr = g.createLinearGradient(0, -c.h / 2, 0, c.h / 2); gr.addColorStop(0, PAL.paper); gr.addColorStop(1, PAL.paper2); g.fillStyle = gr; rr(g, -c.w / 2, -c.h / 2, c.w, c.h, 14); g.fill();
    g.strokeStyle = "rgba(120,108,85,.18)"; g.lineWidth = 2; rr(g, -c.w / 2 + 16, -c.h / 2 + 16, c.w - 32, c.h - 32, 8); g.stroke();
    const k = clamp((t - a0 - (idx ? 0.25 : 0)) / 1.5, 0, 1); g.save();   // art starts animating as the card lands, so it is never blank
    g.translate(0, -26); (ART[c.art] || ART.box)(g, k, c.p || {}, PAL); g.restore();
    g.fillStyle = PAL.mid; g.font = "600 28px 'Segoe UI'"; g.textAlign = "center"; if ("letterSpacing" in g) g.letterSpacing = "6px"; g.fillText(c.cap.toUpperCase(), 0, c.h / 2 - 40); if ("letterSpacing" in g) g.letterSpacing = "0px";
    g.globalAlpha = 1;
    if (c.key || idx % 2 === 0) { const pd = idx ? clamp((t - a0 - 0.38) / 0.22, 0, 1) : 1, ps = lerp(1.7, 1, ease(pd)); g.save(); g.translate(0, -c.h / 2 + 40); g.scale(ps, ps);   // pin
      g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.ellipse(7, 11, 15, 9, 0, 0, 7); g.fill(); const pg = g.createRadialGradient(-5, -6, 2, 0, 0, 18);
      pg.addColorStop(0, c.key ? "#f06a5e" : "#6b6862"); pg.addColorStop(1, c.key ? PAL.red : PAL.ink); g.fillStyle = pg; g.beginPath(); g.arc(0, 0, 17, 0, 7); g.fill(); g.restore(); }
    else { const pd = clamp((t - a0 - 0.3) / 0.3, 0, 1); g.save(); g.translate(0, -c.h / 2 + 4); g.rotate((c.r > 0 ? -1 : 1) * 4 * D); g.globalAlpha = ease(pd);   // washi tape
      g.fillStyle = PAL.tape; g.beginPath(); const tw = 190, th = 52; g.moveTo(-tw / 2, -th / 2); for (let i = 0; i <= 8; i++) g.lineTo(-tw / 2 + i * tw / 8, -th / 2 + (i % 2 ? 3 : -2));
      g.lineTo(tw / 2, th / 2); for (let i = 8; i >= 0; i--) g.lineTo(-tw / 2 + i * tw / 8, th / 2 + (i % 2 ? -3 : 2)); g.closePath(); g.fill(); g.restore(); }
    g.restore();
  }
  function frame(g, t) {
    const cam = camAt(t); g.save(); g.translate(W / 2, H / 2); g.rotate(-cam.r * D); g.scale(cam.z, cam.z); g.translate(-cam.x, -cam.y);
    drawBoard(g, cam);
    links.forEach(([a, b, red]) => { const ia = cards.indexOf(byId[a]), ib = cards.indexOf(byId[b]); let p;
      if (ib === ia + 1) { const L = legT[ia]; p = ease5(clamp((t - L.a) / (L.b - L.a) * 1.12, 0, 1)); }
      else if (ia === n - 1 && ib === 0) { const L = legT[n - 1]; p = ease(clamp((t - L.a) / (L.b - L.a), 0, 1)); }
      else p = clamp((t - Math.max(arrive[a], arrive[b])) / 0.8, 0, 1);
      drawYarn(g, pinOf(byId[a]), pinOf(byId[b]), p, red); });
    cards.forEach((c, i) => drawCard(g, c, t, i));
    g.restore();
    // warm key light from top-left + vignette (screen space)
    const lg = g.createRadialGradient(W * 0.2, H * 0.1, 0, W * 0.2, H * 0.1, Math.hypot(W, H)); lg.addColorStop(0, "rgba(255,248,232,.16)"); lg.addColorStop(1, "rgba(255,248,232,0)"); g.fillStyle = lg; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(55,42,22,.2)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  // camera motion blur on travel only: blend 3 sub-frames when the camera moves fast
  const tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H; const tg = tmp.getContext("2d");
  function draw(g, t) {
    const a = camAt(t), b = camAt(t + 1 / 60), sp = Math.hypot(a.x - b.x, a.y - b.y) * a.z + Math.abs(Math.log(a.z / b.z)) * 900;
    if (sp < 6 || spec.blur === false) { frame(g, t); return; }
    const K = 4, span = 1 / 80; frame(g, t - span / 2); for (let i = 1; i < K; i++) { tg.clearRect(0, 0, W, H); frame(tg, t - span / 2 + span * i / (K - 1)); g.globalAlpha = 1 / (i + 1); g.drawImage(tmp, 0, 0); } g.globalAlpha = 1;   // even shutter, no ghosting
  }
  const cues = [[0.15, "ui.pop.soft", -8, 0]];
  cards.slice(1).forEach(c => cues.push([arrive[c.id] - 0.1, "ui.pop.soft", c.key ? -5 : -9, 0]));
  legT.slice(0, -1).forEach(L => cues.push([L.a + 0.05, "ui.line.draw", -12, 0]));
  // for the narration-picture gate: is card <id> readable on screen at t? (arrived, >= 50% inside the frame, >= 2% of frame area)
  function onScreen(t, id) { const c = byId[id]; if (!c) return { shown: false, why: "unregistered" }; if (t < arrive[c.id] - 0.3) return { shown: false, why: "hidden" };
    const cam = camAt(t), cr = Math.cos(-cam.r * D), sr = Math.sin(-cam.r * D), a = c.r * D; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const lx = sx * c.w / 2, ly = sy * c.h / 2, wx = c.x + lx * Math.cos(a) - ly * Math.sin(a) - cam.x, wy = c.y + lx * Math.sin(a) + ly * Math.cos(a) - cam.y;
      const X = W / 2 + (wx * cr - wy * sr) * cam.z, Y = H / 2 + (wx * sr + wy * cr) * cam.z; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
    const full = (x1 - x0) * (y1 - y0), clip = Math.max(0, Math.min(W, x1) - Math.max(0, x0)) * Math.max(0, Math.min(H, y1) - Math.max(0, y0)), area = clip / (W * H), inside = clip / full;
    const shown = inside >= 0.5 && area >= 0.02; return { shown, area: +area.toFixed(3), inside: +inside.toFixed(2), why: shown ? undefined : area < 0.02 ? "small" : "cropped" }; }
  return { T, arrive, cues, draw, onScreen, cards, size: [BW, BH] };
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function segDist(A, B, P) { const dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy, u = Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / L2)); return Math.hypot(A.x + u * dx - P.x, A.y + u * dy - P.y); }
