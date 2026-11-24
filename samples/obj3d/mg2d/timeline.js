// mg2d/timeline.js - data-driven 2D paper-strip timeline (element MG, never typographic). Replaces the 3D bar timeline.
// One long paper strip (tape-measure ticks) on the warm board texture; each event is an illustrated card standing on the strip (alternating
// above/below) with a big year tab on the strip and a small caption on the card. The key event gets the red pin. A red progress line draws
// along the strip while the camera dollies from event to event, opens with a push-in and ends with a pull-back over the whole strip.
//
//   import { makeTimeline } from "./mg2d/timeline.js";
//   const TL = makeTimeline({ seed: 3, events: [{ id, year, cap, art, p, key }...], at: [0, 4.2, 8.1, ...], tail: 1.6 }, { W, H });
//   TL.T            total duration (s);   TL.arrive[id] event arrival (s);   TL.cues  [[t, sfxId, dB, pan]...]
//   TL.draw(ctx, t) draws frame t into a W x H Canvas2D;   TL.onScreen(t, id) -> { shown, area, inside, why };
//   TL.minCap(t)    smallest on-screen caption/year cap height (px) at t over events >= 50% in frame (Infinity if none);  TL.events = [{ id, year, t, x, y }]
//   spec: events[]; at[] = arrival time of each event (at[0] = 0, strictly increasing; default 4 s apart); tail = s after the last arrival before the pull-back (1.6);
//         spacing = world distance between events (1350); pull = pull-back seconds (2.4); blur = false disables travel motion blur.
import { ART } from "./art.js"; import { PAL, boardTexture } from "./board.js";
const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u), ease5 = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (6 * u - 15) + 10);
const lerp = (a, b, u) => a + (b - a) * u, clamp = (x, a, b) => Math.max(a, Math.min(b, x)), D = Math.PI / 180;
const back = u => { if (u <= 0) return 0; if (u >= 1) return 1; const k = u - 1; return 1 + 2.2 * k * k * k + 1.2 * k * k; };
const seg = (k, a, b) => clamp((k - a) / (b - a), 0, 1);
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

export function makeTimeline(spec, { W, H }) {
  const ev = spec.events, n = ev.length, CW = 700, CH = 620, SP = spec.spacing ?? 1350, CAP = 34, YEAR = 50, SH = 60 /* strip half height */, CYO = 465 /* card centre offset from strip */;
  const at = spec.at ?? ev.map((_, i) => i * 4); if (at.length < n || at[0] !== 0 || at.slice(0, n).some((v, i) => i && v <= at[i - 1])) throw new Error("timeline: spec.at must be [0, t1, ...] strictly increasing, one per event");
  const PULL = spec.pull ?? 2.4, END = 0.6, tail = spec.tail ?? 1.6;
  const E = ev.map((e, i) => ({ ...e, x: i * SP, side: i % 2 ? 1 : -1, y: (i % 2 ? 1 : -1) * CYO, t: at[i], r: (i % 2 ? 1 : -1) * 1.2 }));
  const byId = Object.fromEntries(E.map(e => [e.id, e])), arrive = Object.fromEntries(E.map(e => [e.id, e.t]));
  const legT = []; for (let i = 0; i < n - 1; i++) { const b = at[i + 1], tr = clamp(0.45 * (at[i + 1] - at[i]), 0.7, 1.4); legT.push({ a: b - tr, b }); }
  const PULL0 = at[n - 1] + tail, T = PULL0 + PULL + END;
  // zoom: card + strip fit the frame height comfortably (portrait: card fills the width)
  const ZH = Math.min(0.88 * H / (CYO + CH / 2 + SH), 0.84 * W / CW), spanX = (n - 1) * SP, ZF = Math.min(W / (spanX + CW + 420), H / ((CYO + CH / 2) * 2 * 1.04));
  const camY = e => e.side * (CYO + CH / 2 - SH) / 2;          // centre of [card far edge .. strip edge]
  const holdCam = (e, u) => ({ x: e.x + u * 14, y: camY(e), z: ZH * (1 + 0.05 * ease(u * 1.6)), r: e.r });
  function camAt(t) {
    if (t < legT[0].a) { const u = ease(t / Math.min(1.6, legT[0].a)), e = E[0]; return { x: e.x - 70 * (1 - u), y: camY(e) * lerp(0.6, 1, u), z: ZH * lerp(0.8, 1, u), r: e.r * u }; }
    for (let i = 0; i < n - 1; i++) { const { a, b } = legT[i], A = E[i], B = E[i + 1], nextA = i < n - 2 ? legT[i + 1].a : PULL0;
      if (t < b) { const e = ease5((t - a) / (b - a)), w = Math.sin(Math.PI * e); return { x: lerp(A.x + 14, B.x, e), y: lerp(camY(A), camY(B), ease(e)), z: lerp(ZH * 1.05, ZH, e) * (1 - 0.3 * w), r: lerp(A.r, B.r, e) }; }
      if (t < nextA) return holdCam(B, (t - b) / Math.max(0.01, nextA - b)); }
    const L = E[n - 1], c0 = holdCam(L, 1), u = ease5((t - PULL0) / PULL);
    return { x: lerp(c0.x, spanX / 2, u), y: lerp(c0.y, 0, u), z: Math.exp(lerp(Math.log(c0.z), Math.log(ZF), u)), r: lerp(c0.r, 0, u) };
  }
  // red progress along the strip
  const progX = t => { if (t < legT[0].a) return E[0].x; for (let i = 0; i < n - 1; i++) { const { a, b } = legT[i]; if (t < b) return lerp(E[i].x, E[i + 1].x, ease5((t - a) / (b - a))); } return E[n - 1].x; };

  const tex = boardTexture(); let pat = null; const x0s = -SP * 0.95, x1s = spanX + SP * 0.95;
  function drawStrip(g, t) {
    // paper ribbon with soft shadow
    g.save(); g.shadowColor = "rgba(70,55,30,.2)"; g.shadowBlur = 40; g.shadowOffsetY = 22; rr(g, x0s, -SH, x1s - x0s, SH * 2, 10); g.fillStyle = PAL.paper; g.fill(); g.restore();
    const gr = g.createLinearGradient(0, -SH, 0, SH); gr.addColorStop(0, PAL.paper); gr.addColorStop(1, PAL.paper2); rr(g, x0s, -SH, x1s - x0s, SH * 2, 10); g.fillStyle = gr; g.fill(); g.strokeStyle = PAL.ink; g.lineWidth = 4.5; g.lineJoin = "round"; g.stroke();
    // tape-measure ticks along both edges
    g.strokeStyle = "rgba(43,42,39,.5)"; g.lineWidth = 3; g.beginPath(); for (let x = Math.ceil(x0s / 54) * 54 + 54; x < x1s - 20; x += 54) { const long = Math.round(x / 54) % 5 === 0, l = long ? 26 : 13; g.moveTo(x, -SH + 2); g.lineTo(x, -SH + 2 + l); g.moveTo(x, SH - 2); g.lineTo(x, SH - 2 - l); } g.stroke();
    // centre groove the red line runs in
    g.strokeStyle = "rgba(139,134,123,.35)"; g.lineWidth = 12; g.lineCap = "round"; g.beginPath(); g.moveTo(E[0].x, 0); g.lineTo(E[n - 1].x, 0); g.stroke();
    const px = progX(t); if (px > E[0].x) { g.strokeStyle = PAL.red; g.lineWidth = 10; g.beginPath(); g.moveTo(E[0].x, 0); g.lineTo(px, 0); g.stroke(); g.strokeStyle = "rgba(255,190,180,.55)"; g.lineWidth = 3; g.setLineDash([7, 9]); g.beginPath(); g.moveTo(E[0].x, 0); g.lineTo(px, 0); g.stroke(); g.setLineDash([]); g.fillStyle = PAL.red; g.beginPath(); g.arc(px, 0, 13, 0, 7); g.fill(); g.strokeStyle = PAL.paper; g.lineWidth = 4; g.stroke(); }
  }
  function drawEvent(g, e, t, i) {
    const a0 = e.t - (i ? 0.7 : 0), u = clamp((t - a0) / 0.6, 0, 1); if (t < a0) return; const eu = ease(u), s = e.side, k = clamp((t - a0 - 0.2) / 1.5, 0, 1);
    // stem from tab to card edge (drawn first), then the card, then the pin on the card edge, then the year tab
    const stemTo = s * (CYO - CH / 2), stemFrom = s * SH; g.strokeStyle = e.key ? PAL.red : PAL.yarn; g.lineWidth = 7; g.lineCap = "round"; g.beginPath(); g.moveTo(e.x, stemFrom); g.lineTo(e.x, lerp(stemFrom, stemTo, eu)); g.stroke();
    g.save(); g.translate(e.x, e.y - s * (1 - eu) * 90); g.scale(lerp(0.9, 1, eu), lerp(0.9, 1, eu)); g.globalAlpha = eu;
    g.shadowColor = "rgba(70,55,30,.16)"; g.shadowBlur = 46; g.shadowOffsetY = 22; g.fillStyle = PAL.paper; rr(g, -CW / 2, -CH / 2, CW, CH, 14); g.fill(); g.shadowColor = "rgba(70,55,30,.22)"; g.shadowBlur = 6; g.shadowOffsetY = 3; g.fill(); g.shadowColor = "transparent";
    const gr = g.createLinearGradient(0, -CH / 2, 0, CH / 2); gr.addColorStop(0, PAL.paper); gr.addColorStop(1, PAL.paper2); g.fillStyle = gr; rr(g, -CW / 2, -CH / 2, CW, CH, 14); g.fill();
    g.strokeStyle = "rgba(120,108,85,.18)"; g.lineWidth = 2; rr(g, -CW / 2 + 16, -CH / 2 + 16, CW - 32, CH - 32, 8); g.stroke();
    g.save(); g.translate(0, -26); (ART[e.art] || ART.box)(g, k, e.p || {}, PAL); g.restore();
    g.fillStyle = PAL.mid; g.font = `600 ${CAP}px 'Segoe UI'`; g.textAlign = "center"; const cap = e.cap.toUpperCase(); if ("letterSpacing" in g) g.letterSpacing = (g.measureText(cap).width + cap.length * 6 > CW - 56 ? 2 : 6) + "px"; g.fillText(cap, 0, CH / 2 - 40); if ("letterSpacing" in g) g.letterSpacing = "0px";
    g.globalAlpha = 1; const pd = ease(clamp((t - a0 - 0.35) / 0.25, 0, 1)), ps = lerp(1.7, 1, pd); g.save(); g.translate(0, -s * CH / 2 + s * 0); g.scale(ps, ps);   // pin on the card edge facing the strip
    g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.ellipse(6, 10, 14, 8, 0, 0, 7); g.fill(); const pg = g.createRadialGradient(-5, -6, 2, 0, 0, 18); pg.addColorStop(0, e.key ? "#f06a5e" : "#6b6862"); pg.addColorStop(1, e.key ? PAL.red : PAL.ink); g.fillStyle = pg; g.beginPath(); g.arc(0, 0, e.key ? 19 : 15, 0, 7); g.fill(); g.restore();
    g.restore();
    // year tab on the strip
    const ty = clamp((t - e.t + 0.45) / 0.4, 0, 1), tb = back(ty); if (ty > 0) { g.save(); g.translate(e.x, 0); g.scale(tb, tb); rr(g, -112, -44, 224, 88, 16); g.fillStyle = PAL.paper; g.shadowColor = "rgba(70,55,30,.25)"; g.shadowBlur = 10; g.shadowOffsetY = 5; g.fill(); g.shadowColor = "transparent"; g.strokeStyle = PAL.ink; g.lineWidth = 4.5; g.stroke();
      g.fillStyle = PAL.ink; g.font = `700 ${YEAR}px 'Segoe UI'`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(e.year), 0, 3); g.textBaseline = "alphabetic"; g.restore(); }
  }
  function frame(g, t) {
    const cam = camAt(t); g.save(); g.translate(W / 2, H / 2); g.rotate(-cam.r * D); g.scale(cam.z, cam.z); g.translate(-cam.x, -cam.y);
    pat = pat || g.createPattern(tex, "repeat"); g.fillStyle = pat; g.fillRect(x0s - 4000, -4500, x1s - x0s + 8000, 9000);
    drawStrip(g, t); E.forEach((e, i) => drawEvent(g, e, t, i)); g.restore();
    const lg = g.createRadialGradient(W * 0.2, H * 0.1, 0, W * 0.2, H * 0.1, Math.hypot(W, H)); lg.addColorStop(0, "rgba(255,248,232,.16)"); lg.addColorStop(1, "rgba(255,248,232,0)"); g.fillStyle = lg; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(55,42,22,.2)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  const tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H; const tg = tmp.getContext("2d");
  function draw(g, t) {
    const a = camAt(t), b = camAt(t + 1 / 60), sp = Math.hypot(a.x - b.x, a.y - b.y) * a.z + Math.abs(Math.log(a.z / b.z)) * 900;
    if (sp < 6 || spec.blur === false) { frame(g, t); return; }
    const K = 4, span = 1 / 80; frame(g, t - span / 2); for (let i = 1; i < K; i++) { tg.clearRect(0, 0, W, H); frame(tg, t - span / 2 + span * i / (K - 1)); g.globalAlpha = 1 / (i + 1); g.drawImage(tmp, 0, 0); } g.globalAlpha = 1;
  }
  const cues = [[0.15, "ui.pop.soft", -8, 0]];
  E.slice(1).forEach(e => cues.push(e.key ? [e.t - 0.05, "ui.pin.drop", -6, 0] : [e.t - 0.1, "ui.pop.soft", -9, 0]));
  if (E[0].key) cues.push([0.45, "ui.pin.drop", -6, 0]);
  legT.forEach(L => cues.push([L.a + 0.05, "ui.line.draw", -12, 0])); cues.sort((p, q) => p[0] - q[0]);
  function onScreen(t, id) { const c = byId[id]; if (!c) return { shown: false, why: "unregistered" }; if (t < c.t - 0.3) return { shown: false, why: "hidden" };
    const cam = camAt(t), cr = Math.cos(-cam.r * D), sr = Math.sin(-cam.r * D); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const wx = c.x + sx * CW / 2 - cam.x, wy = c.y + sy * CH / 2 - cam.y, X = W / 2 + (wx * cr - wy * sr) * cam.z, Y = H / 2 + (wx * sr + wy * cr) * cam.z; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
    const full = (x1 - x0) * (y1 - y0), clip = Math.max(0, Math.min(W, x1) - Math.max(0, x0)) * Math.max(0, Math.min(H, y1) - Math.max(0, y0)), area = clip / (W * H), inside = clip / full;
    const shown = inside >= 0.5 && area >= 0.02; return { shown, area: +area.toFixed(3), inside: +inside.toFixed(2), why: shown ? undefined : area < 0.02 ? "small" : "cropped" }; }
  function minCap(t) { const z = camAt(t).z; let m = Infinity; for (const e of E) { const o = onScreen(t, e.id); if (o.inside >= 0.5) m = Math.min(m, 0.716 * Math.min(CAP, YEAR) * z); } return m; }
  return { T, arrive, cues, draw, onScreen, minCap, holdCap: 0.716 * CAP * ZH, events: E.map(e => ({ id: e.id, year: e.year, t: e.t, x: e.x, y: e.y })) };
}
