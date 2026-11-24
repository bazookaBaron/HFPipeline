// mg2d/core.js - shared core for the runtime-generated 2D MG vocabulary (miniature v2).
// NOTHING PREBUILT: no images, no fixed drawings. Every kind is a generator: data (from the producer's mg.json) + seed -> layout + motion.
//
//   Kind module (mg2d/kinds/<name>.js):
//     export default { name, family, doc, example,          // example = data for the test harness
//       build(data, K) -> { w, h, focus: [{ id, x, y, w, h, cap? }], draw(g, t, at, K) } }
//       - local units = px at zoom 1. focus = camera stops in narration order; each id is narratable ([shows: mg:<beat>:<id>]).
//       - draw(g, t, at): t = beat time (s); at[id] = when focus id is narrated (s). Everything for focus id starts landing at at[id] - 0.2
//         and keeps landing sub-elements for ~1.5 s (density), then lives on with gentle secondary motion. Never blank before the first id.
//   K = toolkit passed to build/draw: { P (palette), F (fonts), rng, ease, ui (drawing helpers), sh (shape grammar, mg2d/shapes.js), seed }
//
//   Stage (one MG beat = 1..4 kinds on one large paper canvas, one travelling camera):
//     makeStage({ seed, parts: [{ kind, data }], at: { "<part>:<focus id>": t, ... }, dur, end }, { W, H })
//       -> { T, draw(g, t), onScreen(t, key), minCap(t), cues, keys }
import { SH } from "./shapes.js";
// generated geometry may pass through zero/negative sizes mid-reveal: clamp radii instead of throwing (canvas arc/arcTo/ellipse throw on r < 0)
{ const C = CanvasRenderingContext2D.prototype; if (!C.__mgSafe) { C.__mgSafe = true; const arc = C.arc, arcTo = C.arcTo, ell = C.ellipse;
  C.arc = function (x, y, r, a0, a1, ccw) { return arc.call(this, x, y, Math.max(0, r || 0), a0, a1, ccw); };
  C.arcTo = function (x1, y1, x2, y2, r) { return arcTo.call(this, x1, y1, x2, y2, Math.max(0, r || 0)); };
  C.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) { return ell.call(this, x, y, Math.max(0, rx || 0), Math.max(0, ry || 0), rot, a0, a1, ccw); }; } }

// ---------------- style tokens (one source of truth for the whole vocabulary) ----------------
export const P = {
  paper: "#fbf8f1", ground: "#f2ede2", paper2: "#f3eee3", board: "#e9e4d8", board2: "#e0dacb",
  ink: "#2b2a27", ink2: "#4a4843", mid: "#8b867b", hair: "#cfc8b8", lite: "#e2ddd1", fog: "#efeae0",
  water: "#cfdee3", water2: "#b9ccd3", sand: "#efe7d6", sand2: "#e3d8c2", stone: "#d8d3c8", stone2: "#c5bfb2",
  red: "#c8261d", red2: "#e8675e", redInk: "#8e1a13", shadow: "rgba(60,46,26,.16)", shadow2: "rgba(60,46,26,.08)",
};
export const F = { family: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif", cap: 32, small: 28, num: 64, big: 120 };   // cap px at zoom 1 (stage keeps >= 0.02*H on screen)
export const W_INK = { hair: 1.5, thin: 2.5, line: 3.5, bold: 5 };
// STYLE.cards: false (default since 2026-11-14) = MG is drawn straight on the paper ground, no rounded card/panel behind a kind.
// true = legacy Malacca look (every kind sits on a ui.card panel). A stage sets it from spec.cards (plan beat or plan.mgCards) on every frame.
export const STYLE = { cards: false };

// ---------------- maths / easing ----------------
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, u) => a + (b - a) * u;
export const ease = { io: u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u), io5: u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (6 * u - 15) + 10),
  out: u => u <= 0 ? 0 : u >= 1 ? 1 : 1 - (1 - u) ** 3, back: u => { if (u <= 0) return 0; if (u >= 1) return 1; const k = u - 1; return 1 + 2.2 * k * k * k + 1.2 * k * k; },
  settle: u => u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.exp(-6 * u) * Math.cos(9 * u) };     // lands, small damped bounce
export const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
export function rng(seed) { let s = (Math.floor(seed) % 2147483646) + 1; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  r.range = (a, b) => a + (b - a) * r(); r.int = (a, b) => Math.floor(a + (b - a + 1) * r()); r.pick = arr => arr[Math.floor(r() * arr.length)]; r.chance = p => r() < p; return r; }

// ---------------- drawing helpers (consistent ink, fills, shadows, captions) ----------------
const capLog = [], boxLog = [];
// regLog: containers (cards, papers, pills) drawn so far this frame, in draw order (reset by the stage at every frame). truncLog: texts that needed an ellipsis.
const regLog = [], truncLog = new Set(), WARNED = new Set();
export const resetRegions = () => { regLog.length = 0; };
const capText = (text, o) => { const t = unitKey(String(text ?? "")); return o.caps === false ? t : t.toUpperCase(); };
// innermost registered container whose rect holds the caption anchor (x, y) given in the local frame of transform m
function parentAt(m, x, y) { if (!regLog.length) return null; const X = m.a * x + m.c * y + m.e, Y = m.b * x + m.d * y + m.f; let best = null;
  for (const r of regLog) { const i = r.inv, qx = i.a * X + i.c * Y + i.e, qy = i.b * X + i.d * Y + i.f; if (qx < r.x - 0.5 || qx > r.x + r.w + 0.5 || qy < r.y - 0.5 || qy > r.y + r.h + 0.5) continue; if (!best || r.area <= best.area) best = r; } return best; }
// LOG: shared with shapes.js (cycle-safe: only read inside functions). on = record icon boxes (gate scratch renders only); depth > 0 while a shape draws itself.
export const LOG = { on: false, depth: 0, icons: [], comp: 1, seq: 0, moving: 0 };   // comp: scale compensation while the stage measures on a downsampled scratch canvas
// "= 1 errors and omissions" -> "= 1 error or omission" (unit keys never read plural after a single 1; "1 billion dollars" stays plural)
const NOSING = /^(news|series|species|gas|glass|bus|status|analysis|basis|crisis|process|business|access|press|class|mass|loss|less|its|this|us|plus|was|is|has|lens|chaos|ethics|physics|economics|politics|yes|pros)$/i, QTY = /^(thousand|million|billion|trillion|hundred|dozen|bn|mn|m|k|tn|lakh|crore)s?/i;
export function singular(w) { const m = /^([A-Za-z]+)(\W*)$/.exec(w); if (!m) return w; let [_, a, tail] = m; const up = a === a.toUpperCase() && a.length > 1;
  if (/^people$/i.test(a)) a = up ? "PERSON" : "person"; else if (/^men$/i.test(a)) a = up ? "MAN" : "man"; else if (/^women$/i.test(a)) a = up ? "WOMAN" : "woman"; else if (/^children$/i.test(a)) a = up ? "CHILD" : "child";
  else if (NOSING.test(a) || a.length < 4) return w; else if (/ies$/i.test(a)) a = a.slice(0, -3) + (up ? "Y" : "y"); else if (/(ches|shes|sses|xes|zes)$/i.test(a)) a = a.slice(0, -2); else if (/ss$/i.test(a)) return w; else if (/s$/i.test(a)) a = a.slice(0, -1); return a + tail; }
export function unitKey(text) { const m = /^(=\s*1(?:[.,]0+)?\s+)(.+)$/.exec(text); if (!m || QTY.test(m[2])) return text; let stop = false;
  return m[1] + m[2].split(" ").map(w => { if (stop) return w; if (/^(of|in|per|a|an|the|for|from|to|on|at|by|with|over|under)$/i.test(w)) { stop = true; return w; } if (/^and$/i.test(w)) return w === "AND" ? "OR" : "or"; return singular(w); }).join(" "); }   // boxLog: on-screen text boxes (overlap gate)   // per-draw caption registry (legibility gate): { px } on-screen cap heights
export const ui = {
  rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); },
  ink(g, w = W_INK.line, c = P.ink) { g.strokeStyle = c; g.lineWidth = w; g.lineJoin = "round"; g.lineCap = "round"; g.stroke(); },
  fill(g, c) { g.fillStyle = c; g.fill(); },
  // soft contact shadow under a shape path (no canvas filters: slow). call before filling the shape.
  shadow(g, draw, dx = 6, dy = 12, a = 1) { g.save(); g.translate(dx, dy); g.globalAlpha *= a; g.fillStyle = P.shadow2; draw(); g.fill(); g.translate(-dx * 0.4, -dy * 0.5); g.fillStyle = P.shadow; draw(); g.fill(); g.restore(); },
  // paper card with layered shadow + inner rule (the base surface of most kinds)
  card(g, x, y, w, h, o = {}) { const r = o.r ?? 14; ui.shadow(g, () => ui.rr(g, x, y, w, h, r), 8, 16, o.lift ?? 1);
    ui.rr(g, x, y, w, h, r); const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, o.fill ?? P.paper); gr.addColorStop(1, o.fill2 ?? P.paper2); g.fillStyle = gr; g.fill();
    if (o.rule !== false) { ui.rr(g, x + 14, y + 14, w - 28, h - 28, Math.max(2, r - 6)); ui.ink(g, 1.5, "rgba(120,108,85,.22)"); } ui.region(g, x, y, w, h, { pad: o.pad ?? 12 }); },
  // base panel of a whole kind (0,0,w,h): drawn only in the legacy card look; in the default look the kind sits on the paper ground
  base(g, w, h, o = {}) { if (STYLE.cards) ui.card(g, 0, 0, w, h, o); },
  // row / side panels inside a kind (route rows, season rows, tug-of-war sides): legacy card look only; default = a faint ink underline
  panel(g, x, y, w, h, o = {}) { if (STYLE.cards) return ui.card(g, x, y, w, h, o); g.save(); g.beginPath(); g.moveTo(x + 10, y + h - 2); g.lineTo(x + w - 10, y + h - 2); ui.ink(g, 1.5, "rgba(120,108,85,.28)"); g.restore(); },
  // hatch fill inside the current path (uncertainty, shade, cut faces)
  hatch(g, x, y, w, h, gap = 10, c = "rgba(43,42,39,.35)", ang = -0.8) { g.save(); g.clip(); g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); const L = w + h;
    for (let d = -L; d < L; d += gap) { g.moveTo(x + d, y); g.lineTo(x + d + Math.cos(ang) * L * 2, y + Math.sin(-ang) * L * 2 * -1); } g.stroke(); g.restore(); },
  // container (card / paper / pill) registered for this frame: a caption anchored inside one is fitted to its inner width (wrap -> shrink -> ellipsis)
  // and the MG gate fails any caption whose box still leaves it. ui.card registers itself; kinds drawing their own paper call ui.region(g, x, y, w, h).
  region(g, x, y, w, h, o = {}) { const M = g.getTransform(), det = M.a * M.d - M.b * M.c; if (!(Math.abs(det) > 1e-9) || !(w > 0) || !(h > 0)) return;
    const inv = M.inverse(), pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => [M.a * px + M.c * py + M.e, M.b * px + M.d * py + M.f]), xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const r = { inv, x, y, w, h, pad: o.pad ?? 12, sx0: Math.min(...xs), sx1: Math.max(...xs), sy0: Math.min(...ys), sy1: Math.max(...ys) }; r.area = (r.sx1 - r.sx0) * (r.sy1 - r.sy0); regLog.push(r); },
  // the font px a caption of nominal size `want` is drawn at under the current transform (legibility floor: >= ~23.5 px cap on screen, grows up to 1.5x)
  capSize(g, want = F.cap) { const m = g.getTransform(), sc = (Math.hypot(m.b, m.d) || 1) * LOG.comp; return clamp(23.5 / (0.716 * sc), want, want * 1.5); },
  // layout of a caption without drawing it: { size, lines, lh, maxW, truncated }. Order: one line at the drawn size -> wrap to o.maxLines -> shrink to the
  // minimum size (never below the legibility floor the gate enforces) -> only then ellipsis (logged). maxW = min(o.maxW, inner width of the parent container).
  fitText(g, text, x, y, o = {}) { const m = g.getTransform(), sc = (Math.hypot(m.b, m.d) || 1) * LOG.comp, want = o.size ?? F.cap, floor = 23.5 / (0.716 * sc), size0 = clamp(floor, want, want * 1.5);
    const s = capText(text, o), sp = o.spacing ?? (o.caps === false ? 0 : 3), font = z => `${o.weight ?? 600} ${z}px ${F.family}`, al = o.align ?? "center", par = o.fit === false ? null : parentAt(m, x, y);
    let maxW = o.maxW ?? Infinity; if (par) { const R = par.inv.multiply(m); if (R.a > 0 && Math.abs(R.b) + Math.abs(R.c) < 0.02 * R.a) { const qx = R.a * x + R.c * y + R.e, lo = par.x + par.pad, hi = par.x + par.w - par.pad;
      const av = al === "center" ? 2 * Math.min(qx - lo, hi - qx) : al === "right" || al === "end" ? qx - lo : hi - qx; if (av > 0) maxW = Math.min(maxW, av / R.a); } }
    const lh = z => z * (o.lineH ?? 1.22), out = (z, lines, tr = false) => ({ size: z, lines, lh: lh(z), maxW, truncated: tr, par });
    g.save(); if ("letterSpacing" in g) g.letterSpacing = sp + "px"; const wOf = (z, t) => { g.font = font(z); return g.measureText(t).width; };
    try { if (!isFinite(maxW) || LOG.fit === false || wOf(size0, s) <= maxW) return out(size0, [s]);   // LOG.fit=false: debug switch (see the raw overflow)
      const nL = Math.max(1, o.maxLines ?? 1), minZ = Math.max(o.minSize ?? want * 0.72, Math.min(size0, floor * 0.955));
      const wrapAt = z => { const words = s.split(/\s+/), L = []; let cur = ""; for (const wd of words) { const t = cur ? cur + " " + wd : wd; if (cur && wOf(z, t) > maxW) { L.push(cur); cur = wd; } else cur = t; } if (cur) L.push(cur); return L; };
      for (let z = size0; ; z = Math.max(minZ, z * 0.94)) { if (wOf(z, s) <= maxW) return out(z, [s]); if (nL > 1) { const L = wrapAt(z); if (L.length <= nL && L.every(l => wOf(z, l) <= maxW)) return out(z, L); } if (z <= minZ) break; }
      // still too long at the minimum size: keep what fits on nL lines and end the last one with an ellipsis (logged once per text)
      const L = nL > 1 ? wrapAt(minZ) : [s], keep = L.slice(0, nL - 1); let last = L.slice(nL - 1).join(" ");
      while (last.length > 1 && wOf(minZ, last + "…") > maxW) last = last.slice(0, -1).replace(/[\s,;:.\-]+$/, ""); keep.push(last + "…");
      if (!WARNED.has(s)) { WARNED.add(s); console.warn(`[mg2d] text truncated to fit its card (${Math.round(maxW)} px): "${s}"`); } truncLog.add(s); return out(minZ, keep, true); }
    finally { g.restore(); } },
  // small-caps caption; registers its on-screen cap height for the legibility gate. size = font px at zoom 1
  //   fits itself into the card / paper it sits on (see fitText); o.maxW / o.maxLines / o.minSize / o.lineH / o.fit:false. Extra lines flow downward from y.
  //   returns the layout ({ size, lines, lh }) so a kind can place what follows.
  caption(g, text, x, y, o = {}) { const L = ui.fitText(g, text, x, y, o), size = L.size; g.save(); g.font = `${o.weight ?? 600} ${size}px ${F.family}`; g.fillStyle = o.color ?? P.mid; g.textAlign = o.align ?? "center"; g.textBaseline = o.base ?? "middle";
    const sp = o.spacing ?? (o.caps === false ? 0 : 3); if ("letterSpacing" in g) g.letterSpacing = sp + "px";
    if (o.alpha !== undefined) g.globalAlpha *= o.alpha; L.lines.forEach((s, i) => g.fillText(s, x, y + i * L.lh)); const m = g.getTransform(); if (LOG.moving > 0) { g.restore(); return L; }
    const par = L.par ? { x0: L.par.sx0, x1: L.par.sx1, y0: L.par.sy0, y1: L.par.sy1 } : null;
    L.lines.forEach((s, i) => { const ly = y + i * L.lh; capLog.push(0.716 * size * Math.hypot(m.b, m.d) * (g.globalAlpha > 0.5 ? 1 : 0) || 1e9);
      if (g.globalAlpha > 0.5) { const tw = g.measureText(s).width, al = g.textAlign, x0 = al === "center" ? x - tw / 2 : al === "right" || al === "end" ? x - tw : x, bl = g.textBaseline, y0 = bl === "middle" ? ly - size * 0.36 : bl === "top" ? ly : ly - size * 0.72;
        const pts = [[x0, y0], [x0 + tw, y0], [x0, y0 + size * 0.72], [x0 + tw, y0 + size * 0.72]].map(([px, py]) => [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f]);
        boxLog.push({ text: s, seq: LOG.seq++, own: LOG.depth > 0, num: !!o.__num, axis: !!o.axis, dress: !!o.dress, par, trunc: L.truncated, x0: Math.min(...pts.map(q => q[0])), x1: Math.max(...pts.map(q => q[0])), y0: Math.min(...pts.map(q => q[1])), y1: Math.max(...pts.map(q => q[1])) }); } });
    g.restore(); return L; },
  // numerals (tabular, ink, optionally red); also registered for legibility
  num(g, text, x, y, o = {}) { ui.caption(g, text, x, y, { __num: !(o.axis || o.digit), axis: o.axis, size: o.size ?? F.num, weight: o.weight ?? 800, color: o.color ?? P.ink, caps: false, spacing: o.spacing ?? 0, align: o.align, base: o.base, alpha: o.alpha }); },
  // paper tag with a string hole (labels on elements)
  tag(g, text, x, y, o = {}) { const size = o.size ?? F.small, zs = ui.capSize(g, size); g.save(); g.font = `700 ${zs}px ${F.family}`; if ("letterSpacing" in g) g.letterSpacing = "2px"; const w = g.measureText(capText(text, {})).width + 44, h = zs * 1.9; g.restore();   // sized at the drawn (legibility-grown) font, so the text never leaves the tag
    g.save(); g.translate(x, y); g.rotate(o.rot ?? 0); ui.shadow(g, () => ui.rr(g, -w / 2, -h / 2, w, h, 6), 3, 6); ui.rr(g, -w / 2, -h / 2, w, h, 6); ui.fill(g, o.fill ?? P.paper); ui.ink(g, 2, "rgba(43,42,39,.4)"); ui.region(g, -w / 2, -h / 2, w, h, { pad: 4 });
    g.beginPath(); g.arc(-w / 2 + 14, 0, 4, 0, 7); ui.fill(g, P.hair); ui.caption(g, text, 8, 1, { size, weight: 700, color: o.color ?? P.ink, spacing: 2 }); g.restore(); return [w, h]; },
  // leader line from a point to a label anchor, drawn progressively (u 0..1)
  leader(g, x0, y0, x1, y1, u = 1, c = P.ink) { if (u <= 0) return; g.save(); g.beginPath(); g.moveTo(x0, y0); const mx = x0 + (x1 - x0) * 0.25, my = y1; const k = ease.io(u);
    g.lineTo(lerp(x0, mx, Math.min(1, k * 2)), lerp(y0, my, Math.min(1, k * 2))); if (k > 0.5) g.lineTo(lerp(mx, x1, (k - 0.5) * 2), y1); ui.ink(g, 2, c); g.beginPath(); g.arc(x0, y0, 5, 0, 7); ui.fill(g, c); g.restore(); },
  // pin (red only when it is the focus)
  pin(g, x, y, red = false, s = 1) { g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = "rgba(0,0,0,.2)"; g.beginPath(); g.ellipse(6, 10, 13, 8, 0, 0, 7); g.fill(); const pg = g.createRadialGradient(-5, -6, 2, 0, 0, 16);
    pg.addColorStop(0, red ? P.red2 : "#6b6862"); pg.addColorStop(1, red ? P.red : P.ink); g.fillStyle = pg; g.beginPath(); g.arc(0, 0, 15, 0, 7); g.fill(); g.restore(); },
  // washi tape strip
  tape(g, x, y, w, rot = 0, a = 1) { g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha *= a; g.fillStyle = "rgba(233,226,206,.85)"; g.beginPath(); const h = 44; g.moveTo(-w / 2, -h / 2);
    for (let i = 0; i <= 8; i++) g.lineTo(-w / 2 + i * w / 8, -h / 2 + (i % 2 ? 3 : -2)); g.lineTo(w / 2, h / 2); for (let i = 8; i >= 0; i--) g.lineTo(-w / 2 + i * w / 8, h / 2 + (i % 2 ? -3 : 2)); g.closePath(); g.fill(); g.restore(); },
  // arrow along a polyline, drawn progressively; head appears at the tip
  arrow(g, pts, u = 1, o = {}) { if (u <= 0 || pts.length < 2) return; const segs = []; let L = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); L += d; }
    let rem = L * clamp(u, 0, 1); g.save(); g.beginPath(); g.moveTo(...pts[0]); let tip = pts[0], dir = [1, 0];
    for (let i = 1; i < pts.length && rem > 0; i++) { const d = segs[i - 1], k = Math.min(1, rem / d); tip = [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]; dir = [(pts[i][0] - pts[i - 1][0]) / d, (pts[i][1] - pts[i - 1][1]) / d]; g.lineTo(...tip); rem -= d; }
    if (o.dash) g.setLineDash(o.dash); ui.ink(g, o.w ?? W_INK.bold, o.color ?? P.ink); g.setLineDash([]); const hs = o.head ?? 16; g.beginPath(); g.moveTo(tip[0] + dir[0] * hs * 0.6, tip[1] + dir[1] * hs * 0.6);
    g.lineTo(tip[0] - dir[0] * hs + dir[1] * hs * 0.7, tip[1] - dir[1] * hs - dir[0] * hs * 0.7); g.lineTo(tip[0] - dir[0] * hs - dir[1] * hs * 0.7, tip[1] - dir[1] * hs + dir[0] * hs * 0.7); g.closePath(); ui.fill(g, o.color ?? P.ink); g.restore(); },
  // pop-in transform helper: draws f() scaled by an overshoot ease (u 0..1)
  pop(g, u, x, y, f, kind = "back") { const s = ease[kind](u); if (s <= 0.001) return; g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha *= Math.min(1, u * 3); const mo = s < 0.85; if (mo) LOG.moving++; try { f(); } finally { if (mo) LOG.moving--; } g.restore(); },   // text inside a pop that is still growing is in motion: not judged by the legibility/overlap gates
  // tick marks / ruler along x (scale, axis)
  ruler(g, x0, x1, y, n, u = 1, o = {}) { const k = ease.io(u); g.save(); g.beginPath(); g.moveTo(x0, y); g.lineTo(lerp(x0, x1, k), y); ui.ink(g, o.w ?? 2.5, o.color ?? P.ink2);
    for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n); if (x > lerp(x0, x1, k) + 0.5) break; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + (i % (o.major ?? 5) === 0 ? 16 : 8)); ui.ink(g, 2, o.color ?? P.ink2); } g.restore(); },
};

// ---------------- runtime paper texture (seeded; never an image file) ----------------
const texCache = new Map();
export function paperTexture(seed = 99, base = P.board, grid = true) { const key = seed + base + grid; if (texCache.has(key)) return texCache.get(key);
  const TS = 512, c = document.createElement("canvas"); c.width = c.height = TS; const x = c.getContext("2d"), r = rng(seed); x.fillStyle = base; x.fillRect(0, 0, TS, TS);
  for (let i = 0; i < 18000; i++) { x.fillStyle = `rgba(${r() < .5 ? "255,255,255" : "110,98,78"},${0.025 + r() * 0.055})`; x.fillRect(r() * TS, r() * TS, 1 + r() * 1.6, 1 + r() * 1.6); }
  for (let i = 0; i < 60; i++) { x.strokeStyle = `rgba(110,98,78,${0.02 + r() * 0.03})`; x.lineWidth = 1; x.beginPath(); const a = r() * TS, b = r() * TS; x.moveTo(a, b); x.bezierCurveTo(a + 40, b + (r() - .5) * 20, a + 80, b + (r() - .5) * 20, a + 130 * r(), b + (r() - .5) * 30); x.stroke(); }
  if (grid) x.fillStyle = "rgba(90,80,62,.12)"; if (grid) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(i * 128 + 64, j * 128 + 64, 2.4, 0, 7); x.fill(); }   // faint dot grid (board)
  texCache.set(key, c); return c; }

export const K0 = { P, F, W_INK, ease, seg, clamp, lerp, ui, sh: SH };

// ---------------- stage: lays out 1..4 kinds on one paper canvas and flies a camera through their focus points ----------------
// makeStage(spec, { W, H }) spec (additive; old calls behave as before plus the v3 composition):
//   registry, seed, parts: [{ kind, data, id?, role?: "primary"|"secondary"|"annotation" }], at: { "<part>:<focus id>": t }, dur, end, cards
//   compose (default true): v3 composition solver - aligned layout (primary + secondaries beside it + annotation strip below), every hold framed so
//            content fills ~65-80% of the safe frame, balanced, and no caption straddles the frame edge (crop solver); dress layer + paper ground detail.
//            compose:false = the v2 layout/camera exactly.
//   dress (default true with compose): false | { header, markers, ruler, marks, foot } - generated secondary detail around every kind:
//            figure header + rule (+ "Source: ..." from data.source/src), numbered focus markers on leaders, scale ticks, crop marks.
//   fig: number shown in the header ("FIG. <fig>"), default = part index.
//   bridge: { from: "poster"|"tabletop"|"match", rect: [x, y, w, h] (screen px of the world object the sheet comes from), dur: 0.6 }
//            the first `dur` s render the stage as a paper sheet transforming from rect to the full frame; outside the sheet stays transparent
//            (film.html draws the world underneath).
// returns { T, draw(g, t), onScreen(t, key), minCap(t), textOverlaps(t), check(), measureAt(t), cues, keys, stops, size, views() }
//   check() -> { pass, fails: [..], holds: [{ key, t, at, fill, elements, crop, iconLabel, values }], open: { t, fill, elements }, summary }
export const GATE = { fillMin: 0.5, fillLo: 0.64, fillHi: 0.86, elemMin: 2, openT: 0.4, openFill: 0.06, cropVis: 0.3, overflowTol: 2 };   // overflowTol: screen px a text box may pass its card edge
const BAD_TXT = /\b(NaN|undefined|null|Infinity)\b/i, ZERO_TXT = /^[^\d]{0,3}0+(?:[.,]0+)?\s*[%a-z]{0,3}$/i;
const PLURAL_KEY = /^=\s*1(?:[.,]0+)?\s+(?!(thousand|million|billion|trillion|hundred|dozen)s?\b)([a-z]{3,})s\b/i;
export function badValue(text, zeroOK = false) { const s = String(text).trim(); if (!s) return null; if (BAD_TXT.test(s)) return "nan";
  if (!zeroOK && ZERO_TXT.test(s) && /0/.test(s)) return "zero"; const m = PLURAL_KEY.exec(s); if (m && !NOSING.test(m[2] + "s")) return "plural-key"; return null; }

export function makeStage(spec, { W, H }) {
  const SEED = spec.seed ?? 7, R = rng(SEED), K = { ...K0, rng: R, seed: SEED }, KINDS = spec.registry, COMPOSE = spec.compose !== false;
  const DRESS = COMPOSE && spec.dress !== false ? { header: true, pips: true, markers: false, ruler: true, marks: true, foot: true, ...(typeof spec.dress === "object" ? spec.dress : {}) } : null;
  const parts = spec.parts.map((p, i) => { const mod = KINDS[p.kind]; if (!mod) throw new Error("unknown MG kind " + p.kind); const data = SH.people ? SH.people(p.data) : p.data;
    const b = mod.build(data, { ...K, rng: rng(SEED * 31 + i * 977) }); return { ...p, data, id: p.id ?? p.kind + i, mod, b, s: 1, r: 0, n: i + 1 }; });
  const M = DRESS ? 170 : 60;   // world margin reserved around a part for its dress
  if (!COMPOSE) { let cx = 0; const GAP = 520; parts.forEach((p, i) => { p.x = cx; p.y = (i % 2 ? 1 : -1) * R.range(80, 260) * (parts.length > 1 ? 1 : 0); p.r = R.range(-1.2, 1.2) * (parts.length > 1 ? 1 : 0); cx += p.b.w + GAP + R.range(0, 260); }); }
  else { // aligned composition: primary at the origin, secondaries beside it (top / centre / bottom aligned, seeded), annotation parts as a strip under the primary
    const prim = parts.find(p => p.role === "primary") ?? parts[0], ph = prim.b.h, pw = prim.b.w, align = R.pick(["top", "mid", "bot"]);
    parts.forEach(p => { if (p !== prim) p.s = Math.min(1, (p.role === "annotation" ? 0.55 : 0.9) * ph / p.b.h, (p.role === "annotation" ? 1 : 1.3) * pw / p.b.w); });
    prim.x = 0; prim.y = 0; let cx = pw + M * 2 + R.range(60, 180), ax = 0;
    parts.filter(p => p !== prim && p.role !== "annotation").forEach(p => { const h = p.b.h * p.s; p.x = cx; p.y = align === "top" ? 0 : align === "bot" ? ph - h : (ph - h) / 2; cx += p.b.w * p.s + M * 2 + R.range(60, 180); });
    parts.filter(p => p.role === "annotation").forEach(p => { p.x = ax; p.y = ph + M * 2; ax += p.b.w * p.s + M * 2; }); }
  const toWorld = (p, x, y) => { const a = p.r * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [p.x + p.s * (x * c - y * s), p.y + p.s * (x * s + y * c)]; };
  const wbox = (p, x, y, w, h) => { const q = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([a, b]) => toWorld(p, a, b)); return { x0: Math.min(...q.map(v => v[0])), x1: Math.max(...q.map(v => v[0])), y0: Math.min(...q.map(v => v[1])), y1: Math.max(...q.map(v => v[1])) }; };
  const BW = Math.max(...parts.map(p => p.x + p.b.w * p.s)) - Math.min(...parts.map(p => p.x)), BH = Math.max(...parts.map(p => p.b.h * p.s + Math.abs(p.y) * 2));
  // focus stops in narration order (keys "part:id" with times from spec.at; unlisted foci get spread over the part's window)
  const stops = []; parts.forEach(p => p.b.focus.forEach(f => { const key = p.id + ":" + f.id; stops.push({ key, p, f, t: spec.at?.[key] }); }));
  { let last = 0; stops.forEach((s, i) => { if (s.t === undefined) { const nx = stops.slice(i + 1).find(q => q.t !== undefined); s.t = nx ? lerp(last, nx.t, 0.5) : last + 2.2; } last = s.t; }); }
  stops.sort((a, b) => a.t - b.t); stops.forEach((s, i) => { s.next = stops[i + 1]?.t; });
  const at = {}; for (const p of parts) at[p.id] = {}; for (const s of stops) at[s.p.id][s.f.id] = s.t;
  const lastT = stops[stops.length - 1].t, T = spec.dur ?? lastT + 3.2;

  // ---- dress (generated secondary detail per part, in part-local units; meaningful text only: figure no., source, focus order) ----
  parts.forEach(p => { if (!DRESS) return; const b = p.b, d = p.data || {}, fo = b.focus, src = d.source ?? d.src ?? null;
    let mk = []; if (DRESS.markers && fo.length >= 2) { mk = fo.map((f, j) => ({ j, id: f.id, y: clamp(f.y + Math.min(f.h * 0.5, 70), 30, b.h - 30), fx: f.x })).sort((a, c) => a.y - c.y);
      for (let i = 1; i < mk.length; i++) mk[i].y = Math.max(mk[i].y, mk[i - 1].y + 84); }
    p.dress = { fig: spec.fig ?? p.n, src: DRESS.foot && src && typeof src !== "object" ? String(src) : null, mk, pips: DRESS.pips && fo.length >= 2 ? fo.map(f => f.id) : null, header: DRESS.header, ruler: DRESS.ruler, marks: DRESS.marks }; });
  const capSize = (g, want) => { const m = g.getTransform(), sc = (Math.hypot(m.b, m.d) || 1) * LOG.comp; return clamp(23.5 / (0.716 * sc), want, want * 1.5); };
  function drawDress(g, p, t) { const D = p.dress, b = p.b; if (!D) return; const u0 = ease.out(seg(t, -0.15, 0.35)), k = ease.io(seg(t, 0, 0.55)); if (u0 <= 0) return; g.save();
    const hid = stops.reduce((a, s) => s.p === p && s.hideDress ? Math.max(a, seg(t, s.t - 0.7, s.t - 0.2) * (1 - seg(t, (s.next ?? T) - 0.6, (s.next ?? T) - 0.1))) : a, 0), hk = 1 - hid;   // a stop whose frame would cut the header lets it fade out
    if (D.marks) { g.globalAlpha = u0 * 0.55; const L = 34, e = 44; for (const [x, y, sx, sy] of [[-e, -e, 1, 1], [b.w + e, -e, -1, 1], [-e, b.h + e, 1, -1], [b.w + e, b.h + e, -1, -1]]) { g.beginPath(); g.moveTo(x, y + sy * L); g.lineTo(x, y); g.lineTo(x + sx * L, y); ui.ink(g, 2, P.ink2); } g.globalAlpha = 1; }
    if (D.header && hk > 0.01) { const lab = "FIG. " + D.fig; g.save(); g.globalAlpha = u0 * hk; ui.caption(g, lab, 0, -78, { size: F.small, align: "left", color: P.ink2, weight: 800, spacing: 3, dress: true }); g.restore();
      const sz = capSize(g, F.small); g.save(); g.font = `800 ${sz}px ${F.family}`; if ("letterSpacing" in g) g.letterSpacing = "3px"; const lw = g.measureText(lab).width; g.restore();
      const rad = Math.max(22, sz * 0.62), np = D.pips ? D.pips.length : 0, pw = np ? np * (rad * 2 + 14) + 18 : 0, x0 = lw + 26, x1 = b.w - pw; if (x1 > x0) { g.beginPath(); g.moveTo(x0, -78); g.lineTo(lerp(x0, x1, k), -78); ui.ink(g, 2, "rgba(43,42,39,.35)"); }
      if (np) { const A = at[p.id], cur = D.pips.reduce((c, id, j) => (A[id] ?? 1e9) <= t + 0.05 ? j : c, -1); D.pips.forEach((id, j) => { const x = b.w - (np - 1 - j) * (rad * 2 + 14) - rad, done = j <= cur, red = j === cur;
        ui.pop(g, seg(t, -0.1 + j * 0.08, 0.3 + j * 0.08) * hk, x, -78, () => { g.beginPath(); g.arc(0, 0, rad, 0, 7); ui.fill(g, red ? P.red : P.paper); ui.ink(g, 2.2, red ? P.redInk : done ? P.ink2 : P.hair); ui.caption(g, String(j + 1), 0, 1, { size: F.small, color: red ? P.paper : P.ink, weight: 800, spacing: 0, alpha: done ? 1 : 0.42, dress: true }); }); }); } }
    if (D.ruler) { g.save(); g.globalAlpha = 0.7; ui.ruler(g, 0, b.w, b.h + 58, Math.max(4, Math.round(b.w / 40)), k, { w: 2, color: P.stone2, major: 5 }); g.restore(); }
    if (D.src) { g.save(); g.globalAlpha = u0; ui.caption(g, "Source: " + D.src, 0, b.h + 112, { size: F.small, align: "left", color: P.mid, weight: 600, caps: false, spacing: 0 }); g.restore(); }
    if (D.mk.length) { const A = at[p.id]; let cur = -1; D.mk.forEach(m => { if ((A[m.id] ?? 1e9) <= t + 0.05 && (cur < 0 || A[m.id] >= A[D.mk[cur].id])) cur = D.mk.indexOf(m); });
      D.mk.forEach((m, i) => { const ta = A[m.id] ?? 0, u = seg(t, ta - 0.25, ta + 0.2); if (u <= 0) return; const red = i === cur, x = -86, sz = capSize(g, F.small), rad = Math.max(24, sz * 0.62);
        const lx1 = Math.max(x + rad + 6, m.fx - 10); if (lx1 > x + rad + 14) { g.save(); g.setLineDash([6, 7]); g.beginPath(); g.moveTo(x + rad + 4, m.y); g.lineTo(lerp(x + rad + 4, lx1, ease.io(u)), m.y); ui.ink(g, 2, red ? P.red : "rgba(43,42,39,.4)"); g.setLineDash([]); g.restore(); }
        ui.pop(g, u, x, m.y, () => { g.beginPath(); g.arc(0, 0, rad, 0, 7); ui.fill(g, red ? P.red : P.paper); ui.ink(g, 2.5, red ? P.redInk : P.ink2); ui.caption(g, String(m.j + 1), 0, 1, { size: F.small, color: red ? P.paper : P.ink, weight: 800, spacing: 0 }); }); }); }
    g.restore(); }

  // ---- paper ground detail (seeded; tasteful, faint): graph-paper section, one fold crease each way, pencil construction lines, registration crosshairs ----
  const GD = (() => { if (!COMPOSE) return null; const r = rng(SEED * 7 + 3), prim = parts.find(p => p.role === "primary") ?? parts[0], b = prim.b, X0 = Math.min(...parts.map(p => p.x)) - M, X1 = Math.max(...parts.map(p => p.x + p.b.w * p.s)) + M;
    const Y0 = Math.min(...parts.map(p => p.y)) - M, Y1 = Math.max(...parts.map(p => p.y + p.b.h * p.s)) + M, right = r.chance(0.5), top = r.chance(0.5);
    const pw = b.w * r.range(0.38, 0.55), phh = b.h * r.range(0.42, 0.6), patch = { x: right ? b.w * r.range(0.55, 0.75) : -b.w * r.range(0.05, 0.2), y: top ? -r.range(60, 160) : b.h - phh + r.range(60, 160), w: pw, h: phh };
    return { patch, cx: lerp(X0, X1, r.range(0.3, 0.7)), cy: lerp(Y0, Y1, r.range(0.25, 0.75)), X0, X1, Y0, Y1, b, cross: [[right ? -110 : b.w + 110, top ? b.h + 110 : -110], [r.chance(0.5) ? -110 : b.w + 110, r.range(0.3, 0.7) * b.h]], gap: r.pick([32, 40, 48]) }; })();
  function drawGround(g) { const G = GD; if (!G) return; g.save(); const { patch: q } = G;
    g.save(); g.beginPath(); g.rect(q.x, q.y, q.w, q.h); g.clip(); g.beginPath(); for (let x = q.x - (q.x % G.gap); x <= q.x + q.w; x += G.gap) { g.moveTo(x, q.y); g.lineTo(x, q.y + q.h); } for (let y = q.y - (q.y % G.gap); y <= q.y + q.h; y += G.gap) { g.moveTo(q.x, y); g.lineTo(q.x + q.w, y); }
    ui.ink(g, 1.2, "rgba(110,120,128,.10)"); g.beginPath(); for (let x = q.x - (q.x % (G.gap * 5)); x <= q.x + q.w; x += G.gap * 5) { g.moveTo(x, q.y); g.lineTo(x, q.y + q.h); } ui.ink(g, 1.6, "rgba(110,120,128,.12)"); g.restore();
    const crease = (x0, y0, x1, y1, dx, dy) => { g.beginPath(); g.moveTo(x0 + dx, y0 + dy); g.lineTo(x1 + dx, y1 + dy); ui.ink(g, 3, "rgba(110,98,78,.07)"); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); ui.ink(g, 1.6, "rgba(255,255,255,.55)"); };
    crease(G.cx, G.Y0 - 3000, G.cx, G.Y1 + 3000, 2, 0); crease(G.X0 - 4000, G.cy, G.X1 + 4000, G.cy, 0, 2);
    g.beginPath(); for (const y of [-26, G.b.h + 26]) { g.moveTo(G.X0 - 700, y); g.lineTo(G.X1 + 700, y); } for (const x of [-26, G.b.w + 26]) { g.moveTo(x, G.Y0 - 500); g.lineTo(x, G.Y1 + 500); } ui.ink(g, 1.2, "rgba(80,78,72,.09)");
    for (const [x, y] of G.cross) { g.beginPath(); g.arc(x, y, 15, 0, 7); g.moveTo(x - 26, y); g.lineTo(x + 26, y); g.moveTo(x, y - 26); g.lineTo(x, y + 26); ui.ink(g, 1.4, "rgba(80,78,72,.22)"); }
    g.restore(); }

  // ---- render ----
  const CARDS = !!spec.cards;
  const tex = CARDS ? paperTexture(SEED * 13 + 5) : paperTexture(SEED * 13 + 5, P.ground, false); let pat = null;
  function frame(g, t, c, o = {}) { STYLE.cards = CARDS; regLog.length = 0; g.save(); if (o.scale) g.scale(o.scale, o.scale); g.translate(W / 2, H / 2); g.rotate(-c.r * Math.PI / 180); g.scale(c.z, c.z); g.translate(-c.x, -c.y);
    if (o.ground !== false) { pat = pat || g.createPattern(tex, "repeat"); g.fillStyle = pat; g.fillRect(c.x - W / c.z, c.y - H / c.z, 2 * W / c.z, 2 * H / c.z); drawGround(g); }
    for (const p of parts) { g.save(); g.translate(p.x, p.y); g.rotate(p.r * Math.PI / 180); if (p.s !== 1) g.scale(p.s, p.s); if (o.dress !== false) drawDress(g, p, t); p.b.draw(g, t, at[p.id], K); g.restore(); }
    g.restore(); if (o.post === false) return;
    const lg = g.createRadialGradient(W * 0.2, H * 0.1, 0, W * 0.2, H * 0.1, Math.hypot(W, H)); lg.addColorStop(0, "rgba(255,248,232,.14)"); lg.addColorStop(1, "rgba(255,248,232,0)"); g.fillStyle = lg; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.38, W / 2, H / 2, Math.hypot(W, H) * 0.6); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(55,42,22,.18)"); g.fillStyle = vg; g.fillRect(0, 0, W, H); }

  // ---- measurement on a downsampled, content-only scratch render (no ground): ink grid -> fill ratio + element groups; text + icon boxes ----
  const DS = 8, sw = Math.ceil(W / DS), shh = Math.ceil(H / DS), small = document.createElement("canvas"); small.width = sw; small.height = shh; const smg = small.getContext("2d", { willReadFrequently: true });
  const SA = { x0: W * 0.05, y0: H * 0.07, x1: W * 0.95, y1: H * 0.93 }, CELL = 4;
  const tmpSc = document.createElement("canvas"); tmpSc.width = sw; tmpSc.height = shh; const tmpS = tmpSc.getContext("2d");
  function measure(c, t, withText = true) { smg.setTransform(1, 0, 0, 1, 0, 0); smg.clearRect(0, 0, sw, shh); capLog.length = 0; boxLog.length = 0; LOG.icons.length = 0; LOG.on = true; LOG.comp = DS;
    try { frame(smg, t, c, { scale: 1 / DS, ground: false, post: false, dress: false }); } finally { LOG.on = false; LOG.comp = 1; }   // fill + elements judge the kinds' own content, never the dress
    if (withText) { LOG.on = true; LOG.comp = DS; try { tmpS.setTransform(1, 0, 0, 1, 0, 0); tmpS.clearRect(0, 0, sw, shh); boxLog.length = 0; LOG.icons.length = 0; frame(tmpS, t, c, { scale: 1 / DS, ground: false, post: false }); } finally { LOG.on = false; LOG.comp = 1; } }
    const px = smg.getImageData(0, 0, sw, shh).data, gw = Math.ceil(sw / CELL), gh = Math.ceil(shh / CELL), occ = new Uint8Array(gw * gh);
    for (let y = 0; y < shh; y++) for (let x = 0; x < sw; x++) if (px[(y * sw + x) * 4 + 3] > 18) occ[((y / CELL) | 0) * gw + ((x / CELL) | 0)]++;
    for (let i = 0; i < occ.length; i++) occ[i] = occ[i] >= 2 ? 1 : 0;
    const dil = new Uint8Array(gw * gh); for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (occ[y * gw + x]) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const X = x + i, Y = y + j; if (X >= 0 && Y >= 0 && X < gw && Y < gh) dil[Y * gw + X] = 1; }
    const cpx = CELL * DS, xs = [], ys = []; for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (occ[y * gw + x]) { xs.push(x); ys.push(y); }
    let ink = null, fill = 0, density = 0; if (xs.length) { xs.sort((p, q) => p - q); ys.sort((p, q) => p - q); const qt = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];   // trimmed ink extent (2..98%)
      ink = { x0: qt(xs, 0.02) * cpx, x1: (qt(xs, 0.98) + 1) * cpx, y0: qt(ys, 0.02) * cpx, y1: (qt(ys, 0.98) + 1) * cpx };
      fill = Math.max(0, Math.min(SA.x1, ink.x1) - Math.max(SA.x0, ink.x0)) * Math.max(0, Math.min(SA.y1, ink.y1) - Math.max(SA.y0, ink.y0)) / ((SA.x1 - SA.x0) * (SA.y1 - SA.y0));
      let n = 0, f = 0; for (let y = ink.y0 / cpx; y < ink.y1 / cpx; y++) for (let x = ink.x0 / cpx; x < ink.x1 / cpx; x++) { n++; if (dil[y * gw + x]) f++; } density = n ? f / n : 0; }
    const lab = new Int32Array(gw * gh); let comps = 0; for (let i0 = 0; i0 < gw * gh; i0++) { if (!dil[i0] || lab[i0]) continue; const st = [i0]; lab[i0] = -1; let sz = 0;
      while (st.length) { const i = st.pop(), x = i % gw, y = (i / gw) | 0; sz++; for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const X = x + k, Y = y + j, q = Y * gw + X; if (X >= 0 && Y >= 0 && X < gw && Y < gh && dil[q] && !lab[q]) { lab[q] = -1; st.push(q); } } }
      if (sz >= 6) comps++; }
    const sc = b => ({ ...b, x0: b.x0 * DS, x1: b.x1 * DS, y0: b.y0 * DS, y1: b.y1 * DS, par: b.par ? { x0: b.par.x0 * DS, x1: b.par.x1 * DS, y0: b.par.y0 * DS, y1: b.par.y1 * DS } : null }), texts = boxLog.map(sc), icons = LOG.icons.map(sc); capLog.length = 0; boxLog.length = 0;
    // elements: distinct visual units = max(ink islands, clusters of labels/icons whose boxes lie > 48 px apart)
    const U = [...texts, ...icons].filter(b => vis(b) > 0.5), par = U.map((_, i) => i), fd = i => par[i] === i ? i : (par[i] = fd(par[i])), G0 = 48;
    for (let i = 0; i < U.length; i++) for (let j = i + 1; j < U.length; j++) { const A = U[i], B = U[j]; if (A.x0 - G0 < B.x1 && B.x0 - G0 < A.x1 && A.y0 - G0 < B.y1 && B.y0 - G0 < A.y1) par[fd(i)] = fd(j); }
    const clusters = new Set(U.map((_, i) => fd(i))).size;
    return { grid: { occ, gw, gh, cpx }, fill, density: +density.toFixed(3), elements: Math.max(comps, clusters), ink, texts, icons }; }
  const project = (c, wx, wy) => { const a = -c.r * Math.PI / 180, dx = wx - c.x, dy = wy - c.y; return [W / 2 + (dx * Math.cos(a) - dy * Math.sin(a)) * c.z, H / 2 + (dx * Math.sin(a) + dy * Math.cos(a)) * c.z]; };
  const unproject = (c, X, Y) => { const a = c.r * Math.PI / 180, dx = (X - W / 2) / c.z, dy = (Y - H / 2) / c.z; return [c.x + dx * Math.cos(a) - dy * Math.sin(a), c.y + dx * Math.sin(a) + dy * Math.cos(a)]; };
  const vis = (b, x0 = 0, y0 = 0, x1 = W, y1 = H) => { const a = Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0)); return Math.max(0, Math.min(x1, b.x1) - Math.max(x0, b.x0)) * Math.max(0, Math.min(y1, b.y1) - Math.max(y0, b.y0)) / a; };

  // ---- composition solver: one camera view per stop (lazy: computed on first draw/check, so key-learning stages cost nothing) ----
  const ZMAX = 2.6, fitBox = (bx, k = 1) => ({ x: (bx.x0 + bx.x1) / 2, y: (bx.y0 + bx.y1) / 2, z: Math.min(k * (SA.x1 - SA.x0) / Math.max(1, bx.x1 - bx.x0), k * (SA.y1 - SA.y0) / Math.max(1, bx.y1 - bx.y0), ZMAX), r: 0 });
  const zoomFor = f => Math.min(0.78 * W / f.w, 0.66 * H / f.h, 2.2);
  const viewV2 = s => { const [x, y] = toWorld(s.p, s.f.x + s.f.w / 2, s.f.y + s.f.h / 2); return { x, y, z: zoomFor({ w: s.f.w * s.p.s, h: s.f.h * s.p.s }), r: s.p.r * 0.6 }; };
  function keepIn(c, fb) { let z = Math.min(c.z, (SA.x1 - SA.x0) / Math.max(1, fb.x1 - fb.x0), (SA.y1 - SA.y0) / Math.max(1, fb.y1 - fb.y0), ZMAX); let { x, y } = c; const q = { x, y, z, r: 0 };
    const [a0, b0] = project(q, fb.x0, fb.y0), [a1, b1] = project(q, fb.x1, fb.y1); if (a0 < SA.x0) x -= (SA.x0 - a0) / z; else if (a1 > SA.x1) x += (a1 - SA.x1) / z; if (b0 < SA.y0) y -= (SA.y0 - b0) / z; else if (b1 > SA.y1) y += (b1 - SA.y1) / z; return { x, y, z, r: 0 }; }
  const CF = { x0: W * 0.025 + 14, y0: H * 0.025, x1: W * 0.975 - 14, y1: H * 0.975 };   // crop frame: what stays visible through the 4% hold push-in
  const straddles = b => !b.axis && vis(b) > 0 && !(b.x0 >= CF.x0 && b.x1 <= CF.x1 && b.y0 >= CF.y0 && b.y1 <= CF.y1);   // any caption that shows at all must sit fully inside the crop frame
  let VIEWS = null, solveLog = [];
  const CAPMIN = 22.4, halfC = document.createElement("canvas"); halfC.width = Math.ceil(W / 2); halfC.height = Math.ceil(H / 2); const hg = halfC.getContext("2d");
  function legible(c, t) { capLog.length = 0; boxLog.length = 0; LOG.comp = 2; try { hg.setTransform(1, 0, 0, 1, 0, 0); frame(hg, t, c, { scale: 0.5, post: false, ground: false }); } finally { LOG.comp = 1; }   // half-res scratch: same caption sizes (scale-compensated), 4x fewer pixels
    for (let i = 0; i < capLog.length; i++) capLog[i] *= 2; for (const b of boxLog) { b.x0 *= 2; b.x1 *= 2; b.y0 *= 2; b.y1 *= 2; }
    const cap = capLog.length ? Math.min(...capLog) : Infinity, ov = boxOverlaps(); capLog.length = 0; boxLog.length = 0; return { ok: cap >= CAPMIN && !ov.length, cap, ov }; }
  function solveStop(s, i) { const fb = wbox(s.p, s.f.x, s.f.y, s.f.w, s.f.h), D = s.p.dress; let cb = { ...fb };
    if (D?.mk.length) cb.x0 = Math.min(cb.x0, s.p.x - 120 * s.p.s);
    if (D?.header && s.f.y < 120) cb.y0 = Math.min(cb.y0, s.p.y - 104 * s.p.s);   // a stop at the top of a figure takes its header along
    const nt = stops[i + 1]?.t ?? T, th = Math.max(s.t + 0.3, Math.min(s.t + 1.25, nt - 0.3));
    { // tight focus box: the ink actually inside the declared focus box (kinds declare generous boxes with blank margins)
      const c0 = fitBox(fb, 0.96), m0 = measure(c0, th), { occ, gw, gh, cpx } = m0.grid, [A0, B0] = project(c0, fb.x0, fb.y0), [A1, B1] = project(c0, fb.x1, fb.y1); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { if (!occ[y * gw + x]) continue; const X = (x + 0.5) * cpx, Y = (y + 0.5) * cpx; if (X < A0 || X > A1 || Y < B0 || Y > B1) continue; x0 = Math.min(x0, X - cpx / 2); x1 = Math.max(x1, X + cpx / 2); y0 = Math.min(y0, Y - cpx / 2); y1 = Math.max(y1, Y + cpx / 2); }
      if (x1 > x0 && (x1 - x0) * (y1 - y0) > 0.05 * (A1 - A0) * (B1 - B0)) { const [wx0, wy0] = unproject(c0, x0, y0), [wx1, wy1] = unproject(c0, x1, y1), mx = (wx1 - wx0) * 0.03, my = (wy1 - wy0) * 0.03;
        const tb = { x0: Math.max(fb.x0, wx0 - mx), y0: Math.max(fb.y0, wy0 - my), x1: Math.min(fb.x1, wx1 + mx), y1: Math.min(fb.y1, wy1 + my) };
        cb = { x0: cb.x0 < fb.x0 ? Math.min(cb.x0, tb.x0) : tb.x0, y0: cb.y0 < fb.y0 ? Math.min(cb.y0, tb.y0) : tb.y0, x1: tb.x1, y1: cb.y1 > fb.y1 ? Math.max(cb.y1, tb.y1) : tb.y1 }; Object.assign(fb, tb); } }
    const strOf = m => m.texts.filter(straddles);
    const fixCrop = (c, str, allowOut = true) => { // include the cut captions if that costs <= 22% zoom, else pan them fully out of frame, else zoom out a little
      let ub = { ...cb }; for (const b of str) { const [x0, y0] = unproject(c, b.x0, b.y0), [x1, y1] = unproject(c, b.x1, b.y1); ub = { x0: Math.min(ub.x0, x0, x1), y0: Math.min(ub.y0, y0, y1), x1: Math.max(ub.x1, x0, x1), y1: Math.max(ub.y1, y0, y1) }; }
      const c2 = fitBox(ub, 0.95); if (allowOut && c2.z >= c.z * 0.78) { cb = ub; return keepIn(c2, fb); }
      let dx = 0, dy = 0; for (const b of str) { if (b.x0 < CF.x0) dx = Math.max(dx, b.x1 + 40); if (b.x1 > CF.x1) dx = Math.min(dx, b.x0 - W - 40); if (b.y0 < CF.y0) dy = Math.max(dy, b.y1 + 30); if (b.y1 > CF.y1) dy = Math.min(dy, b.y0 - H - 30); }   // push fully past the frame edge (the push-in drift must not bring it back)
      const c3 = { ...c, x: c.x + dx / c.z, y: c.y + dy / c.z }, k3 = keepIn(c3, fb); if (Math.abs(k3.x - c3.x) + Math.abs(k3.y - c3.y) < 1) return c3;
      let ix = 0, iy = 0; for (const b of str) { if (b.x0 < CF.x0) ix = Math.min(ix, b.x0 - CF.x0 - 6); if (b.x1 > CF.x1) ix = Math.max(ix, b.x1 - CF.x1 + 6); if (b.y0 < CF.y0) iy = Math.min(iy, b.y0 - CF.y0 - 6); if (b.y1 > CF.y1) iy = Math.max(iy, b.y1 - CF.y1 + 6); }   // or pull them fully in
      const c5 = { ...c, x: c.x + ix / c.z, y: c.y + iy / c.z }, k5 = keepIn(c5, fb); if (Math.abs(k5.x - c5.x) + Math.abs(k5.y - c5.y) < 1) return c5; return allowOut ? { ...c, z: c.z * 0.9 } : c; };
    const c00 = keepIn(fitBox(cb, 0.94), fb), zLo = c00.z * 0.75; let c = c00, m = null, it = 0; const log = [];
    for (; it < 8; it++) { m = measure(c, th); log.push(+m.fill.toFixed(2));
      const str = strOf(m); if (str.length) { c = fixCrop(c, str); continue; }
      if (m.fill < GATE.fillLo && m.ink) { const zf = keepIn({ ...c, z: 99 }, fb).z; if (c.z < zf - 1e-3) { const [ix, iy] = unproject(c, (m.ink.x0 + m.ink.x1) / 2, (m.ink.y0 + m.ink.y1) / 2);
        const cand = keepIn({ x: lerp(c.x, ix, 0.6), y: lerp(c.y, iy, 0.6), z: Math.min(zf, c.z * Math.min(1.3, Math.sqrt(0.72 / Math.max(0.05, m.fill)))), r: 0 }, fb);
        if (!strOf(measure(cand, th)).length) { c = cand; continue; } const half = keepIn({ x: (c.x + cand.x) / 2, y: (c.y + cand.y) / 2, z: Math.sqrt(c.z * cand.z), r: 0 }, fb); if (half.z > c.z * 1.03 && !strOf(measure(half, th)).length) { c = half; continue; } } }
      if (m.fill > GATE.fillHi && c.z * 0.92 > zLo) { c = keepIn({ ...c, z: c.z * 0.92 }, fb); continue; }
      if (m.ink) { const icx = (m.ink.x0 + m.ink.x1) / 2, icy = (m.ink.y0 + m.ink.y1) / 2; if (Math.abs(icx - W / 2) > 0.05 * W || Math.abs(icy - H / 2) > 0.06 * H) { const [ix, iy] = unproject(c, icx, icy), c4 = keepIn({ ...c, x: lerp(c.x, ix, 0.7), y: lerp(c.y, iy, 0.7) }, fb);
        if (Math.abs(c4.x - c.x) + Math.abs(c4.y - c.y) > 2 / c.z && !strOf(measure(c4, th)).length) { c = c4; continue; } } }
      break; }
    const th2 = Math.max(th, Math.min(s.t + 2.6, nt - 0.2));   // legibility is checked late in the hold too (labels that land after th)
    for (let k = 0; k < 6; k++) { const l1 = legible(c, th), l2 = th2 > th + 0.05 ? legible(c, th2) : l1, lg = l1.ok ? l2 : l1; if (l1.ok && l2.ok) break; const z2 = keepIn({ ...c, z: c.z * (lg.cap < CAPMIN ? Math.min(1.3, CAPMIN / lg.cap * 1.03) : 1.08) }, fb); if (z2.z <= c.z * 1.001) break; c = z2; }   // legibility (>= 21.6 px caps, no text overlaps) beats framing
    for (let k = 0; k < 6; k++) { const str = strOf(measure(c, th)); if (!str.length) break; const a = fixCrop(c, str, true); if (legible(a, th).ok) { c = a; continue; } const b = fixCrop(c, str, false); if (b === c) break; c = b; }
    { const str = strOf(measure(c, th)); if (str.length && str.every(b => b.dress)) s.hideDress = true; }   // only the figure header is cut: it yields during this stop
    if (!legible(c, th2).ok) { for (let k = 0; k < 4; k++) { const lg = legible(c, th2); if (lg.ok) break; const z2 = keepIn({ ...c, z: c.z * (lg.cap < CAPMIN ? Math.min(1.3, CAPMIN / lg.cap * 1.03) : 1.08) }, fb); if (z2.z <= c.z * 1.001) break; c = z2; } }   // crop-clean when it can be, never at the cost of legibility
    solveLog.push({ key: s.key, it, fill: log }); s.tb = { ...fb }; return c; }
  function views() { if (!VIEWS) VIEWS = COMPOSE ? stops.map(solveStop) : stops.map(viewV2); return VIEWS; }

  // ---- camera keys: arrive at each stop by its time, hold with a slow push-in, travel time scales with the gap; closing pull-back ----
  let KEYS = null;
  function buildKeys() { const V = views(), keys = []; let lastHold = null, push = COMPOSE ? 1.04 : 1.06;
    const X0 = Math.min(...parts.map(p => p.x)) - (COMPOSE ? M : 0), X1 = Math.max(...parts.map(p => p.x + p.b.w * p.s)) + (COMPOSE ? M : 0), Y0 = Math.min(...parts.map(p => p.y)) - (COMPOSE ? M : 0), Y1 = Math.max(...parts.map(p => p.y + p.b.h * p.s)) + (COMPOSE ? M : 0);
    const overview = COMPOSE ? { x: (X0 + X1) / 2, y: (Y0 + Y1) / 2, z: Math.min(W / ((X1 - X0) * 1.04), H / ((Y1 - Y0) * 1.06)), r: 0 } : { x: X1 / 2, y: (Y0 + Y1) / 2, z: Math.min(W / (X1 * 1.08), H / ((Y1 - Y0) * 1.12)), r: 0 };
    stops.forEach((s, i) => { const v = V[i]; const tr = i ? clamp(0.42 * (s.t - stops[i - 1].t), 0.6, 1.3) : 0;
      if (i && lastHold) keys.push({ t: Math.max(keys[keys.length - 1].t + 0.05, s.t - tr), ...lastHold });
      keys.push({ t: s.t, ...v }); const nt = i < stops.length - 1 ? stops[i + 1].t - clamp(0.42 * (stops[i + 1].t - s.t), 0.6, 1.3) : T - (spec.end ?? 1.2);
      lastHold = { x: v.x + 12 / Math.max(0.5, v.z), y: v.y, z: v.z * push, r: v.r }; keys.push({ t: Math.max(s.t + 0.2, nt), ...lastHold }); });
    if (spec.end !== 0) keys.push({ t: T, ...overview });
    keys.sort((a, b) => a.t - b.t); KEYS = keys; }
  function camAt(t) { if (!KEYS) buildKeys(); const keys = KEYS; if (t <= keys[0].t) return keys[0]; for (let i = 0; i < keys.length - 1; i++) { const a = keys[i], b = keys[i + 1]; if (t <= b.t) { const u = ease.io5((t - a.t) / Math.max(1e-3, b.t - a.t));
    return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), u)), r: lerp(a.r, b.r, u) }; } } return keys[keys.length - 1]; }

  // ---- draw (with motion blur while the camera travels) + optional world->paper bridge ----
  const tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H; const tg = tmp.getContext("2d"); let bcan = null;
  function drawMain(g, t) { const a = camAt(t), b = camAt(t + 1 / 60), sp = Math.hypot(a.x - b.x, a.y - b.y) * a.z + Math.abs(Math.log(a.z / b.z)) * 900;
    if (sp < 6) { capLog.length = 0; frame(g, t, a); return; }
    const N = clamp(Math.ceil(sp / 3) + 1, 3, 12), span = 1 / 60; capLog.length = 0; frame(g, t - span / 2, camAt(t - span / 2));
    for (let i = 1; i < N; i++) { const ti = t - span / 2 + span * i / (N - 1); tg.clearRect(0, 0, W, H); frame(tg, ti, camAt(ti)); g.globalAlpha = 1 / (i + 1); g.drawImage(tmp, 0, 0); } g.globalAlpha = 1; }
  const BR = spec.bridge ? { from: spec.bridge.from ?? "poster", rect: spec.bridge.rect ?? [W * 0.4, H * 0.4, W * 0.2, H * 0.2], dur: spec.bridge.dur ?? 0.6 } : null;
  function drawBridge(g, t) { if (!bcan) { bcan = document.createElement("canvas"); bcan.width = W; bcan.height = H; } const bg = bcan.getContext("2d"); bg.clearRect(0, 0, W, H); drawMain(bg, t);
    const u = ease.io5(clamp(t / BR.dur, 0, 1)), [rx, ry, rw, rh] = BR.rect; g.save();   // outside the sheet: whatever the caller drew (the world) stays
    if (BR.from === "match") { const cx = rx + rw / 2, cy = ry + rh / 2, r0 = Math.min(rw, rh) / 2, r1 = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 4, rad = lerp(r0, r1, u * u * (1.2 - 0.2 * u));
      g.beginPath(); g.arc(cx, cy, rad, 0, 7); g.save(); g.clip(); g.drawImage(bcan, 0, 0); g.restore(); g.globalAlpha = 1 - u; g.beginPath(); g.arc(cx, cy, rad, 0, 7); g.lineWidth = 10 * (1 - u) + 2; g.strokeStyle = P.red; g.stroke(); g.restore(); return; }
    const x = lerp(rx, 0, u), y = lerp(ry, 0, u), w = lerp(rw, W, u), h = lerp(rh, H, u), border = (1 - u) * 14;
    g.fillStyle = `rgba(40,30,15,${0.28 * (1 - u)})`;
    if (BR.from === "tabletop") { // the sheet lies flat on a table (trapezoid, far edge narrower) and lifts up to face the camera
      const N = 48, top = lerp(0.62, 1, u); g.fillRect(x + 10, y + 16, w, h); for (let k = 0; k < N; k++) { const v0 = k / N, v1 = (k + 1) / N, s0 = lerp(top, 1, v0), yy = y + h * (1 - Math.pow(1 - v0, lerp(1.6, 1, u))), yy1 = y + h * (1 - Math.pow(1 - v1, lerp(1.6, 1, u)));
        const ww = w * s0; g.drawImage(bcan, 0, H * v0, W, H * (v1 - v0) + 1, x + (w - ww) / 2, yy, ww, yy1 - yy + 1); } }
    else { g.fillRect(x + 8 * (1 - u), y + 14 * (1 - u), w, h); g.fillStyle = P.paper; g.fillRect(x - border, y - border, w + border * 2, h + border * 2); g.drawImage(bcan, x, y, w, h); }
    g.restore(); }
  function draw(g, t) { if (BR && t < BR.dur) return drawBridge(g, t); drawMain(g, t); }

  function onScreen(t, key) { const s = stops.find(q => q.key === key); if (!s) return { shown: false, why: "unregistered" }; if (t < s.t - 0.3) return { shown: false, why: "hidden" };
    const c = camAt(t), tb = s.tb; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;   // tb: the solver's tight content box (declared boxes carry blank margins)
    for (const [sx, sy] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const [wx, wy] = tb ? [lerp(tb.x0, tb.x1, sx), lerp(tb.y0, tb.y1, sy)] : toWorld(s.p, s.f.x + sx * s.f.w, s.f.y + sy * s.f.h), [X, Y] = project(c, wx, wy); x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
    const full = (x1 - x0) * (y1 - y0), clip = Math.max(0, Math.min(W, x1) - Math.max(0, x0)) * Math.max(0, Math.min(H, y1) - Math.max(0, y0)), area = clip / (W * H), inside = clip / full;
    const shown = inside >= 0.5 && area >= 0.02; return { shown, area: +area.toFixed(3), inside: +inside.toFixed(2), why: shown ? undefined : area < 0.02 ? "small" : "cropped" }; }
  // smallest caption cap (px) actually drawn at t (scratch render); ignores captions faded below 50%
  const scratch = document.createElement("canvas"); scratch.width = W; scratch.height = H; const sg = scratch.getContext("2d");
  function minCap(t) { const c = camAt(t); capLog.length = 0; boxLog.length = 0; frame(sg, t, c); return capLog.length ? Math.min(...capLog) : Infinity; }
  // text collisions on screen at t: pairs of different captions whose boxes overlap > 12% of the smaller one (both inside the frame)
  function textOverlaps(t) { minCap(t); return boxOverlaps(); }
  function boxOverlaps() { const B = boxLog.filter(b => b.x1 > 0 && b.x0 < W && b.y1 > 0 && b.y0 < H), out = [];
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) { const a = B[i], c = B[j]; if (a.text === c.text) continue;
      const ix = Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0), iy = Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0); if (ix <= 0 || iy <= 0) continue;
      const sm = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (c.x1 - c.x0) * (c.y1 - c.y0)); if (ix * iy > 0.12 * sm) out.push([a.text, c.text]); }
    return out; }
  // ---- stage-level gates (film.html can call st.check() per beat): crop, icon over label, meaningful values, fill, elements, no empty open ----
  const zeroOK = parts.some(p => /(:\s*0\s*[,}\]])|(:\s*"0")/.test(JSON.stringify(p.data ?? {})));
  function inspect(t, s) { const c = camAt(t), m = measure(c, t), crop = [], iconLabel = [], values = [], overflow = [];
    for (const b of m.texts) { const v = vis(b); if (!b.axis && v > GATE.cropVis && v < 0.98) crop.push(b.text);
      const P0 = b.par, tol = GATE.overflowTol; if (P0 && v > 0.5 && (b.x0 < P0.x0 - tol || b.x1 > P0.x1 + tol || b.y0 < P0.y0 - tol || b.y1 > P0.y1 + tol)) overflow.push(`"${b.text}" leaves its card by ${Math.round(Math.max(P0.x0 - b.x0, b.x1 - P0.x1, P0.y0 - b.y0, b.y1 - P0.y1))} px`);   /* text box past its card / paper edge */   /* tick labels of a continuous scale (axis:true) may run off the edge */ const bv = badValue(b.text, zeroOK || !b.num); if (bv && v > 0.5) values.push(bv + ":" + b.text); }
    if (s) { const fb = s.tb ?? wbox(s.p, s.f.x, s.f.y, s.f.w, s.f.h), [a0, b0] = project(c, fb.x0, fb.y0), [a1, b1] = project(c, fb.x1, fb.y1), fv = vis({ x0: a0, y0: b0, x1: a1, y1: b1 }); if (fv < 0.97) crop.push(`focus ${s.key} ${(fv * 100).toFixed(0)}% visible`); }
    for (const ic of m.icons) { const w = ic.x1 - ic.x0, h = ic.y1 - ic.y0; if (w > H * 0.26 || h > H * 0.26 || w < 14) continue; const sx = w * 0.1, sy = h * 0.1, I = { x0: ic.x0 + sx, x1: ic.x1 - sx, y0: ic.y0 + sy, y1: ic.y1 - sy };
      for (const b of m.texts) { if (b.own || (b.seq ?? 0) > (ic.seq ?? 0)) continue; const ix = Math.min(I.x1, b.x1) - Math.max(I.x0, b.x0), iy = Math.min(I.y1, b.y1) - Math.max(I.y0, b.y0); if (ix > 0 && iy > 0 && ix * iy > 0.3 * (b.x1 - b.x0) * (b.y1 - b.y0)) iconLabel.push(`${ic.name}/${b.text}`); } }
    return { t: +t.toFixed(2), fill: +m.fill.toFixed(3), density: m.density, elements: m.elements, crop: [...new Set(crop)], iconLabel: [...new Set(iconLabel)], values: [...new Set(values)], overflow: [...new Set(overflow)] }; }
  function check() { const holds = [], fails = []; truncLog.clear();
    stops.forEach((s, i) => { const nt = stops[i + 1]?.t ?? T, tA = s.t + 0.35, tB = Math.max(tA, Math.min(s.t + 1.25, nt - 0.3));
      for (const [tt, tag] of [[tA, "start"], [tB, "mid"]]) { const r = { key: s.key, at: tag, ...inspect(tt, s) }; holds.push(r);
        if (r.crop.length) fails.push(`crop ${s.key}@${r.t}: ${r.crop.slice(0, 2).join(" | ")}`); if (r.overflow.length) fails.push(`text-overflow ${s.key}@${r.t}: ${r.overflow.slice(0, 2).join(" | ")}`); if (r.iconLabel.length) fails.push(`icon-over-label ${s.key}@${r.t}: ${r.iconLabel[0]}`); if (r.values.length) fails.push(`value ${s.key}@${r.t}: ${r.values[0]}`);
        if (tag === "mid" && r.fill < GATE.fillMin) fails.push(`fill ${s.key}@${r.t}: ${r.fill}`); if (tag === "mid" && r.elements < GATE.elemMin) fails.push(`elements ${s.key}@${r.t}: ${r.elements}`); }
      if (i) { const r = inspect(s.t - 0.06, null); if (r.crop.length) fails.push(`travel-crop ${s.key}@${r.t}: ${r.crop[0]}`); } });
    const o = inspect(stops[0].t + GATE.openT, null), open = { t: o.t, fill: o.fill, elements: o.elements }; if (o.fill < GATE.openFill || o.elements < 1) fails.push(`empty-open @${o.t}: fill ${o.fill}`);
    if (o.overflow.length) fails.push(`text-overflow open@${o.t}: ${o.overflow.slice(0, 2).join(" | ")}`);
    const warns = [...truncLog].map(s => `truncated: "${s}"`);   // ellipsis was the last resort (logged, not a fail): shorten the producer's text
    const mids = holds.filter(h => h.at === "mid"), summary = { minFill: Math.min(...mids.map(h => h.fill)), meanFill: +(mids.reduce((a, h) => a + h.fill, 0) / mids.length).toFixed(3), minElements: Math.min(...mids.map(h => h.elements)), openFill: open.fill, fails: fails.length };
    return { pass: !fails.length, fails, warns, holds, open, summary, solve: solveLog }; }
  const cues = []; stops.forEach((s, i) => { const fb = wbox(s.p, s.f.x, s.f.y, s.f.w, s.f.h); cues.push([s.t - 0.05, i ? "ui.pop.soft" : "ui.card.slide", i ? -9 : -7, clamp(((fb.x0 + fb.x1) / 2 - BW / 2) / Math.max(1, BW), -0.4, 0.4)]); if (i) cues.push([s.t - clamp(0.42 * (s.t - stops[i - 1].t), 0.6, 1.3), "ui.whoosh.soft", -16, 0]); });
  if (BR) cues.unshift([0, "ui.whoosh.soft", -14, 0]);
  return { T, draw, onScreen, minCap, textOverlaps, check, measureAt: t => inspect(t, null), cues, keys: stops.map(s => s.key), stops: stops.map(s => ({ key: s.key, t: s.t })), size: [BW, BH], views, bridge: BR };
}
