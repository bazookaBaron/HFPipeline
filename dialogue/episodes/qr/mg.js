// qr MG: eight iso cards (STORYBOARD.md) built from mg/isokit. Cards 3-8 share ONE world (a mint island, the 25x25 QR lying flat on it, camera moves);
// cards 1 and 2 are their own iso worlds (camp sign, factory belt). Every card is a pure function of global episode time t. Word times come from
// shots.json at load time (W(line, word)). Engine contract (engine/mg-adapter.js): default export (mg, {ratio}) adds mg.beat()s; 9:16 uses 'float'.
// Text rule: every label/counter/glyph is >= 28 px at 1080 width (K.hud size 34 * px .85 = 28.9 px; digits/letters use raw px >= 40).
import { PAL, mix, rgba, tones, f1, pt, poly, line, add3, sub3, mul3, rng, createScene } from '../../mg/isokit/core.js';
import * as K from '../../mg/isokit/prims.js';
import { background } from '../../mg/isokit/stage.js';
import { ease, prog } from '../../mg/isokit/motion.js';
import { camRig, viewAt } from '../../mg/isokit/camera.js';

const E = await (await fetch(new URL('./shots.json', import.meta.url))).json();
const BE = await (await fetch(new URL('./mg.beats.json', import.meta.url))).json();
const win = n => { const c = BE.cues.find(x => x.name === n); if (!c) throw new Error('qr mg: no beat ' + n); return c; };
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const W = (line, word, nth = 0) => { const c = E.words.filter(w => w.line === line && norm(w.w) === norm(word)); if (!c[nth]) throw new Error(`qr mg: no word "${word}" #${nth} in line ${line}`); return c[nth].s; };
const pin01 = (t, a, d = .5) => ease.p3out(prog(t, a, a + d));
const io = (t, a, d) => ease.p2io(prog(t, a, a + d));
const hud = (sc, a, text, o = {}) => K.hud(sc, a, text, { size: 34, ...o });          // 34 * .85 = 28.9 px
const lerp = (a, b, k) => a + (b - a) * k;
const D2R = Math.PI / 180;

// ============================================================================================================================
// THE QR: 25x25, three 7x7 finder eyes (TL, TR, BL), 5x5 alignment near BR, timing dots, quiet zone of 2 modules. Seeded, not scannable.
const N = 25;
const FN = [...Array(N)].map(() => Array(N).fill(false)), G = [...Array(N)].map(() => Array(N).fill(0));
const ZZ = [];            // zigzag placement order: 2-wide columns from the bottom-right, up then down; function patterns skipped
(() => {
  const R = rng(20241107), set = (r, c, v) => { G[r][c] = v ? 1 : 0; FN[r][c] = true; };
  for (const [r0, c0] of [[0, 0], [0, 18], [18, 0]]) for (let dr = 0; dr < 7; dr++) for (let dc = 0; dc < 7; dc++) { const m = Math.max(Math.abs(dr - 3), Math.abs(dc - 3)); set(r0 + dr, c0 + dc, m === 3 || m <= 1); }
  for (let i = 0; i < 8; i++) { set(7, i, 0); set(i, 7, 0); set(7, N - 1 - i, 0); set(i, N - 8, 0); set(N - 8, i, 0); set(N - 1 - i, 7, 0); }
  for (let i = 8; i <= 16; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(18 + dr, 18 + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!FN[r][c]) G[r][c] = R() < .5 ? 1 : 0;
  for (let p = 0; p < 12; p++) { const up = p % 2 === 0; for (let k = 0; k < N; k++) { const r = up ? N - 1 - k : k; for (const c of [N - 1 - 2 * p, N - 2 - 2 * p]) if (c >= 0 && !FN[r][c]) ZZ.push({ r, c, p }); } }
  const bits = s => [...s].flatMap(ch => [...ch.charCodeAt(0).toString(2).padStart(8, '0')].map(Number));
  bits('map').forEach((b, i) => { G[ZZ[i].r][ZZ[i].c] = b; });                 // the first 24 placed modules spell "map"
  bits('m').forEach((b, i) => { G[0][8 + i] = b; });                           // top row, between the eyes: the same "m" (card 3)
})();
const isDark = (r, c) => r >= 0 && r < N && c >= 0 && c < N && G[r][c] === 1;
const BITE = [[26.6, 9.8, 3.0], [27.2, 12.8, 3.6], [26.6, 15.8, 2.9]];            // goat bite: right edge, middle, scalloped, clear of all eyes + the alignment square
const inBite = (r, c, s = 1) => s > 0 && BITE.some(([bc, br, rad]) => Math.hypot(c + .5 - bc, r + .5 - br) < rad * s);
const HOLE = []; for (let r = -2; r < 27; r++) for (let c = -2; c < 27; c++) if (inBite(r, c)) HOLE.push({ r, c });
HOLE.sort((a, b) => a.c - b.c || a.r - b.r);
const EYES = [[3.5, 3.5], [3.5, 21.5], [21.5, 3.5]];                              // [row, col] centres of the three finder eyes (module coords)
const eyeOf = (r, c) => EYES.findIndex(([er, ec]) => Math.abs(r + .5 - er) <= 3.5 && Math.abs(c + .5 - ec) <= 3.5);

const U = .2, ZB = .14;                                                           // module size (world), board top height
const flatMap = (th = 0, cx = 0, cy = 0, z = ZB) => { const ct = Math.cos(th), st = Math.sin(th); return (c, r, dz = 0) => { const dx = (c - 12.5) * U, dy = (r - 12.5) * U; return [cx + dx * ct - dy * st, cy + dx * st + dy * ct, z + dz]; }; };

// qr(): draws the code through any affine map(c, r, dz) -> world point (module-corner coords, dz = along the normal). o: skip(r,c), tint(r,c)->colour, lift(r,c)->dz,
// glow (tinted cells glow: emitters), edge (colour of the bite outline), thick (board thickness, flat only), depth, layer
function qr(sc, o) {
  const V = sc.V, map = o.map, LO = -2, HI = 27, skip = o.skip, tint = o.tint, lift = o.lift;
  const lat = dz => { const A = []; for (let r = LO; r <= HI; r++) { const row = []; for (let c = LO; c <= HI; c++) row.push(V.P(map(c, r, dz))); A.push(row); } return A; };
  const base = lat(0), L = (A, r, c) => A[r - LO][c - LO];
  const PQ = (A, r, c) => `M${pt(L(A, r, c))}L${pt(L(A, r, c + 1))}L${pt(L(A, r + 1, c + 1))}L${pt(L(A, r + 1, c))}Z`;
  const Q = (r, c, dz) => poly([V.P(map(c, r, dz)), V.P(map(c + 1, r, dz)), V.P(map(c + 1, r + 1, dz)), V.P(map(c, r + 1, dz))]);
  let cream = '', dark = '', all = '', edge = '', lifted = [], tinted = {};
  for (let r = LO; r < HI; r++) for (let c = LO; c < HI; c++) {
    if (skip && skip(r, c)) continue;
    all += PQ(base, r, c);
    const lf = lift ? lift(r, c) : 0, tc = tint ? tint(r, c) : null;
    if (lf) { lifted.push([r, c, lf, tc]); continue; }
    if (tc) { tinted[tc] = (tinted[tc] || '') + PQ(base, r, c); continue; }
    if (isDark(r, c)) dark += PQ(base, r, c); else cream += PQ(base, r, c);
  }
  if (skip && o.edge) for (let r = LO; r < HI; r++) for (let c = LO; c < HI; c++) if (skip(r, c)) {
    const nb = (rr, cc) => rr >= LO && rr < HI && cc >= LO && cc < HI && !skip(rr, cc);
    if (nb(r - 1, c)) edge += `M${pt(L(base, r, c))}L${pt(L(base, r, c + 1))}`; if (nb(r + 1, c)) edge += `M${pt(L(base, r + 1, c))}L${pt(L(base, r + 1, c + 1))}`;
    if (nb(r, c - 1)) edge += `M${pt(L(base, r, c))}L${pt(L(base, r + 1, c))}`; if (nb(r, c + 1)) edge += `M${pt(L(base, r, c + 1))}L${pt(L(base, r + 1, c + 1))}`;
  }
  const sd = mix(PAL.cream, PAL.shade, .55); let s = '';
  if (o.thick) for (const k of [1, .66, .33]) { const A = lat(-o.thick * k); let p = ''; for (let r = LO; r < HI; r++) for (let c = LO; c < HI; c++) if (!(skip && skip(r, c))) p += PQ(A, r, c); s += `<path d="${p}" fill="${sd}" stroke="${sd}" stroke-width="0.8" stroke-linejoin="round"/>`; }
  s += `<path d="${cream}" fill="${PAL.cream}" stroke="${PAL.cream}" stroke-width="0.7" stroke-linejoin="round"/><path d="${dark}" fill="${PAL.ink}" stroke="${PAL.ink}" stroke-width="0.7" stroke-linejoin="round"/>`;
  for (const [col, p] of Object.entries(tinted)) s += `<path d="${p}" fill="${col}" stroke="${col}" stroke-width="0.7" stroke-linejoin="round"${o.glow ? ' filter="url(#glow)"' : ''}/>`;
  for (const [r, c, lf, tc] of lifted) {
    const col = tc || (isDark(r, c) ? PAL.ink : PAL.cream), sdc = mix(col, PAL.shade, .45);
    s += `<path d="${Q(r, c, lf * .3)}" fill="${rgba(PAL.shade, .0)}"/>` + [.25, .5, .75].map(k => `<path d="${Q(r, c, lf * k)}" fill="${sdc}" stroke="${sdc}" stroke-width="0.8"/>`).join('') + `<path d="${Q(r, c, lf)}" fill="${col}" stroke="${rgba(PAL.cream, .5)}" stroke-width="0.8"${o.glow && tc ? ' filter="url(#glow)"' : ''}/>`;
  }
  if (edge) s += `<path d="${edge}" fill="none" stroke="${o.edge}" stroke-width="${f1((o.edgeW ?? 3.2) * V.px)}" stroke-linecap="round"/>`;
  sc.add(s, o.depth ?? 0, o.layer || 'floor');
  return { cellQuad: Q, centre: (r, c, dz = 0) => map(c + .5, r + .5, dz) };
}
// small shared drawing helpers
const tick = (sc, [x, y], col, a = 1, s = 34) => sc.add(`<path d="M${f1(x - s * .5)},${f1(y)}L${f1(x - s * .12)},${f1(y + s * .4)}L${f1(x + s * .6)},${f1(y - s * .5)}" fill="none" stroke="${rgba(col, a)}" stroke-width="${f1(7 * sc.V.px)}" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>`, 0, 'hud');
const gRing = (sc, c, r, col, a, o = {}) => { if (a <= .01 || r <= 0) return; const V = sc.V, p = V.P(c), rx = r * V.s, ry = rx * V.K;
  sc.add(`<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${rgba(col, (o.fillA ?? 0) * a)}" stroke="${rgba(PAL.shade, .5 * a)}" stroke-width="${f1(7 * V.px)}"/><ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(rx)}" ry="${f1(ry)}" fill="none" stroke="${rgba(col, a)}" stroke-width="${f1((o.w ?? 3.4) * V.px)}"${o.glow === false ? '' : ' filter="url(#glow)"'}${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`, o.depth ?? 5, 'fx'); };
function tent(sc, x, y, w, d, h, col) {
  const V = sc.V, T = tones(col), P = V.P; let o = K.shadowSvg(V, x + w / 2 + .25, y + d / 2 + .25, 0, Math.max(w, d) * .7, .25);
  o += `<path d="${poly([P(x, y + d, 0), P(x + w, y + d, 0), P(x + w / 2, y + d, h)])}" fill="${T.mid}"/><path d="${poly([P(x + w, y, 0), P(x + w, y + d, 0), P(x + w / 2, y + d, h), P(x + w / 2, y, h)])}" fill="${T.dark}"/>`;
  o += `<path d="${poly([P(x + w * .38, y + d, 0), P(x + w * .62, y + d, 0), P(x + w / 2, y + d, h * .55)])}" fill="${PAL.ink}"/><path d="${line([P(x, y + d, 0), P(x + w / 2, y + d, h), P(x + w, y, 0)].slice(0, 2))}" stroke="${rgba(PAL.cream, .5)}" stroke-width="${f1(1.4 * V.px)}"/>`;
  sc.add(o, V.dep(x + w / 2, y + d / 2, h * .3));
}
// shared island for cards 3-8
const IA = { x: -4.6, y: -4.3, w: 9.2, d: 8.6, r: 1, th: 1.1 };
function worldA(sc) {
  K.island(sc, { ...IA, seed: 5, tufts: 26, avoid: (x, y) => Math.hypot(x, y) < 4.4 });
  for (const [x, y, k, h] of [[-4.0, 3.3, 'cone', 1.5], [-3.3, 3.7, 'round', 1.1], [3.9, 3.4, 'cone', 1.3], [-4.0, -3.4, 'round', 1.0]]) K.tree(sc, { x, y, kind: k, h });
  tent(sc, 3.2, -3.9, 1.3, 1.0, .95, PAL.coral);
}
const BP = (z = ZB, k = 1) => [[-2.9 * k, -2.9 * k, z], [2.9 * k, -2.9 * k, z], [2.9 * k, 2.9 * k, z], [-2.9 * k, 2.9 * k, z]];
const txt = (sc, x, y, s, col, text, a = 1, str = 0) => sc.add(`<text x="${f1(x)}" y="${f1(y)}" text-anchor="middle" font-family="Geist Mono, monospace" font-weight="700" font-size="${s}" fill="${rgba(col, a)}"${str ? ` stroke="${rgba(PAL.ink, a)}" stroke-width="${str}" paint-order="stroke"` : ''}>${text}</text>`, 0, 'hud');
const bracket = (sc, [x, y], hw, hh, col, a = 1, arm = 26) => sc.add(`<path d="${[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => `M${f1(x + sx * hw)},${f1(y + sy * (hh - arm))}L${f1(x + sx * hw)},${f1(y + sy * hh)}L${f1(x + sx * (hw - arm))},${f1(y + sy * hh)}`).join('')}" fill="none" stroke="${rgba(col, a)}" stroke-width="${f1(5 * sc.V.px)}" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>`, 0, 'top');

// ============================================================================================================================
// CARD 1  THE BITE: camp sign on a post, QR on its face; the goat bite chomps (3 steps), crumbs fall; phone scans, cone goes mint, phone shows a map + pin
function card1() {
  const w1 = win('THE BITE'), at = w1.at, end = w1.end, tGoat = W(1, 'goat'), tQR = W(1, 'QR'), tStill = W(1, 'still'), tHow = W(1, 'How');
  const SY = .1, SZ = 2.65, CS = .1, map = (c, r, dz = 0) => [(c - 12.5) * CS, SY + dz, SZ - (r - 12.5) * CS];
  const IS = { x: -4.4, y: -3.2, w: 8.8, d: 6.8, r: 1, th: 1.1 }, steps = [tGoat, tGoat + .22, tGoat + .44], sv = [.55, .8, 1];
  const bs = t => t < steps[0] ? 0 : t < steps[1] ? sv[0] : t < steps[2] ? sv[1] : sv[2];
  const crumbs = HOLE.filter(h => isDark(h.r, h.c) && h.c >= 21).slice(0, 14).map((h, i) => { const k = sv.findIndex(s => inBite(h.r, h.c, s)); return { ...h, t0: steps[k], v: [.4 + .5 * ((i * 37) % 10) / 10, .5 + .5 * ((i * 53) % 10) / 10, 1.3 + .8 * ((i * 71) % 10) / 10] }; });
  const keys = [{ t: at, pts: [[-1.8, SY, 4.6], [1.8, SY, 1.1], [1.9, 2.7, 0]], zoom: 1.08 }, { t: tGoat + .75, pts: [[-1.7, SY, 4.5], [1.7, SY, 1.1], [1.9, 2.7, 0]], zoom: 1.0 }, { t: tHow - .15, pts: [[.2, SY, 3.45], [2.3, SY, 1.85]], zoom: 1.0 }];
  const PH = [1.8, 2.7];
  return { tag: 'THE BITE', at, end, seed: 3, keys, stills: [tGoat + .5, tQR + .5, tStill + .35, tStill + 1.0], draw(sc, t) {
    K.island(sc, { ...IS, seed: 3, tufts: 14, avoid: (x, y) => Math.abs(x) < 2 && y > -.5 && y < 3.2 });
    tent(sc, -3.4, -2.6, 1.5, 1.2, 1.15, PAL.coral); K.tree(sc, { x: 3.4, y: -2.2, kind: 'cone', h: 1.7 }); K.tree(sc, { x: 3.9, y: -1.6, kind: 'round', h: 1.1 }); K.tree(sc, { x: -3.5, y: 1.9, kind: 'round', h: 1.0 });
    const wood = tones('#C98A45');
    K.box(sc, { x: -.16, y: -.06, z: 0, w: .32, d: .3, h: 1.05, tones: tones('#8E5E2C') });
    K.box(sc, { x: -1.7, y: -.1, z: 1.0, w: 3.4, d: .2, h: 3.3, tones: wood });
    // bite: ember rim, 3 crunch steps
    const s = bs(t);
    const q = qr(sc, { map, skip: (r, c) => inBite(r, c, s), edge: PAL.ember, edgeW: 5.5, depth: 500, layer: 'world' });
    { let hq = ''; for (let r = -2; r < 27; r++) for (let c = -2; c < 27; c++) if (inBite(r, c, s)) hq += q.cellQuad(r, c, -.015); if (hq) sc.add(`<path d="${hq}" fill="#4A2E16" stroke="#4A2E16" stroke-width="0.8"/>`, 499.5, 'world'); }
    for (const cr of crumbs) { const tau = t - cr.t0; if (tau < 0) continue; const p0 = q.centre(cr.r, cr.c), g = 9, T1 = (cr.v[2] + Math.sqrt(cr.v[2] ** 2 + 2 * g * p0[2])) / g, x = p0[0] + cr.v[0] * Math.min(tau, T1 + .2), y = p0[1] + cr.v[1] * Math.min(tau, T1 + .2);
      let z; if (tau < T1) z = p0[2] + cr.v[2] * tau - g / 2 * tau * tau; else { const tb = tau - T1, vb = .3 * (g * T1 - cr.v[2]); z = Math.max(0, vb * tb - g / 2 * tb * tb); }
      K.box(sc, { x: x - .06, y: y - .06, z: Math.max(0, z), w: .12, d: .12, h: .12, color: PAL.ink, rimA: .9, depth: 600 + cr.r }); }
    // phone slides in at "QR code", scan line over the code, cone turns mint on "still works", screen flips to a map + pin
    const kIn = io(t, tQR - .35, .6), px = lerp(4.4, PH[0], kIn), flip = io(t, tStill + .05, .45), ok = t > tStill, col = ok ? PAL.mint : PAL.sky;
    const sweep = prog(t, tQR + .1, tStill), cone = pin01(t, tQR, .3);
    if (kIn > 0) {
      const ph = { x: px, y: PH[1], z: 0, s: 1.7 }, top = [px, PH[1] - .05, 1.75];
      if (cone > 0) { const V = sc.V, a = K_pt(sc, top), cs = [[0, 0], [25, 0], [25, 25], [0, 25]].map(([c, r]) => V.P(map(c, r, .02)));
        sc.add(`<path d="${poly([a, cs[0], cs[1]])}M${pt(a)}L${pt(cs[1])}L${pt(cs[2])}L${pt(a)}Z" fill="${rgba(col, .13 * cone)}"/><path d="M${pt(a)}L${pt(cs[0])}M${pt(a)}L${pt(cs[1])}M${pt(a)}L${pt(cs[2])}M${pt(a)}L${pt(cs[3])}" stroke="${rgba(col, .75 * cone)}" stroke-width="${f1(2.2 * V.px)}" filter="url(#glow)"/>`, 560, 'air');
        const rr = ok ? 25 : 25 * sweep; K.beam(sc, map(-1, rr, .03), map(26, rr, .03), { color: col, alpha: .95 * cone, w: 3.4, depth: 570, layer: 'air' }); }
      phone2(sc, ph, { flip, t, tStill });
      if (ok) hud(sc, sc.V.P([px, PH[1], 2.35]), 'MAP OPENED', { color: PAL.mint, dx: -20, dy: -8, alpha: pin01(t, tStill + .5, .3) });
    }
    K.cloud(sc, { x: 3.8, y: -3.4, z: 4.8, size: .8 });
  } };
}
const K_pt = (sc, p) => sc.V.P(p);
function phone2(sc, p, st) {
  const V = sc.V, s = p.s, w = .62 * s, d = .14 * s, h = 1.1 * s, B = { x: p.x - w / 2, y: p.y - d / 2, z: p.z, w, d, h, color: PAL.violet };
  let o = K.shadowSvg(V, p.x + .1 * s, p.y + .2 * s, p.z, .5 * s, .3) + K.boxSvg(V, B);
  const sx = Math.abs(Math.cos(Math.PI * st.flip)), uc = w / 2, f = (u, v) => K.facePt(V, B, 'left', uc + (u - uc) * sx, v), quad = (u0, v0, u1, v1) => poly([f(u0, v0), f(u1, v0), f(u1, v1), f(u0, v1)]);
  const u0 = .06 * s, u1 = w - .06 * s, v0 = .1 * s, v1 = h - .1 * s;
  if (st.flip < .5) {
    o += `<path d="${quad(u0, v0, u1, v1)}" fill="${PAL.ink}"/>`;
    const a = .09 * s, yy = lerp(v0 + .1 * s, v1 - .1 * s, (st.t * 1.3) % 1);
    for (const [cu, cv, du, dv] of [[u0 + .06 * s, v0 + .06 * s, 1, 1], [u1 - .06 * s, v0 + .06 * s, -1, 1], [u1 - .06 * s, v1 - .06 * s, -1, -1], [u0 + .06 * s, v1 - .06 * s, 1, -1]]) o += `<path d="${line([f(cu + du * a, cv), f(cu, cv), f(cu, cv + dv * a)])}" fill="none" stroke="${PAL.sky}" stroke-width="${f1(3 * V.px)}" stroke-linecap="round"/>`;
    o += `<path d="${line([f(u0 + .1 * s, yy), f(u1 - .1 * s, yy)])}" stroke="${PAL.sky}" stroke-width="${f1(2.4 * V.px)}"/>`;
  } else {
    o += `<path d="${quad(u0, v0, u1, v1)}" fill="${mix(PAL.sky, PAL.cream, .8)}"/><path d="${quad(u0, v0, u0 + .2 * s, v0 + .35 * s)}" fill="${PAL.mintLit}"/><path d="${quad(u1 - .22 * s, v1 - .4 * s, u1, v1)}" fill="${PAL.mintLit}"/>`;
    for (const [a, b, c, e] of [[u0, v0 + .5 * s, u1, v0 + .56 * s], [u0 + .27 * s, v0, u0 + .33 * s, v1], [u0, v1 - .3 * s, u1, v1 - .25 * s]]) o += `<path d="${quad(a, b, c, e)}" fill="${PAL.cream}"/>`;
  }
  sc.add(o, 580, 'air');
  if (st.flip >= .5) { const k = pin01(st.t, st.tStill + .4, .45), tip = [p.x - w / 2 + uc, p.y + d / 2 + .03, p.z + v0 + .52 * s + 1.1 * (1 - k)]; K.pin(sc, { p: tip, color: PAL.coral, size: .1 * s, streak: k < 1 ? 1 : 0 }); }
}

// ============================================================================================================================
// CARD 2  BUILT FOR DIRT: belt, car-part crates with QR labels on top; calendar flips to 1994; oil splat + scratches hit the label; scanner arch still reads it
function card2() {
  const w2 = win('BUILT FOR DIRT'), at = w2.at, end = w2.end, tFac = W(4, 'factories'), tJap = W(4, 'Japan'), t94 = W(4, '1994'), tOily = W(4, 'Oily'), tScr = W(4, 'scratched'), tLab = W(4, 'labels'), tClose = W(4, 'Close');
  const AX = 2.4, V0 = 1.0, dpos = t => { const tau = t - tFac; return V0 * (tau < 0 ? 0 : tau < .4 ? tau * tau / .8 : tau - .2); }, X0 = AX - dpos(14.5) - 0;
  const xB = t => X0 + dpos(t) + 0, crates = [{ off: 2.4, col: PAL.saffron, seed: 11 }, { off: 0, col: PAL.sky, seed: 12 }, { off: -2.4, col: PAL.violet, seed: 13 }];
  const IF = { x: -5.2, y: -3.0, w: 10.6, d: 6.0, r: 1, th: 1.1 };
  const keys = [{ t: at, pts: [[-4.2, -2.8, 0], [4.4, -2.8, 3.6], [-4.2, 1.6, 0], [4.4, 1.6, 0]], zoom: .88 }, { t: tOily - .55, pts: [[-.2, -1.3, 0], [3.7, -1.3, 3.3], [-.2, 1.3, 0], [3.7, 1.3, 0]], zoom: .98 }, { t: tClose - .1, pts: [[1.6, -1.2, 0], [4.5, -1.2, 2.8], [4.5, 1.3, 0]], zoom: .95 }];
  const hashQ = (seed) => { const R = rng(seed), g = []; for (let r = 0; r < 9; r++) { g.push([]); for (let c = 0; c < 9; c++) g[r].push(R() < .5 ? 1 : 0); }
    for (const [r0, c0] of [[0, 0], [0, 6], [6, 0]]) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { g[r0 + a][c0 + b] = (a === 1 && b === 1) ? 0 : 1; } return g; };
  return { tag: 'BUILT FOR DIRT', at, end, seed: 7, keys, box: { x: 26, y: 118, w: 920, h: 422 }, stills: [tFac + .7, t94 + .5, tOily + .55, tScr + .45, tLab + .9, tClose + .45], draw(sc, t) {
    const V = sc.V;
    K.island(sc, { ...IF, seed: 6, tufts: 16, avoid: (x, y) => Math.abs(y) < 1.3 });
    // factory wall + calendar
    const FB = { x: -4.4, y: -2.6, w: 5.2, d: 1.6, h: 2.7 };
    K.building(sc, { ...FB, color: PAL.violet, windows: false, roof: 'unit' });
    K.cyl(sc, { c: [-3.8, -2.0, 3.3], r: .22, h: .6, color: PAL.cream });
    const cu0 = 1.3, cu1 = 3.9, cv0 = .45, cv1 = 2.3, fp = (u, v) => K.facePt(V, FB, 'left', u, v), cq = (a, b, c, d) => poly([fp(a, b), fp(c, b), fp(c, d), fp(a, d)]);
    const yr = 1990 + Math.floor(4 * io(t, tJap + .1, t94 - tJap + .1) + .001), ph = Math.min(1, (t - tJap) / .7), flipK = t < tJap ? 0 : 1 - Math.abs(Math.cos(Math.PI * ((4 * io(t, tJap + .1, t94 - tJap + .1)) % 1))) * 0;
    const sq = t < tJap || t > t94 + .6 ? 1 : .55 + .45 * Math.abs(Math.cos(Math.PI * (4 * io(t, tJap + .1, t94 - tJap + .1)) % 1 * 1));
    let o = `<path d="${cq(cu0, cv0, cu1, cv1)}" fill="${PAL.cream}" stroke="${PAL.shade}" stroke-width="${f1(3 * V.px)}"/><path d="${cq(cu0, cv1 - .5, cu1, cv1)}" fill="${PAL.coral}"/>`;
    sc.add(o, V.dep(FB.x + FB.w / 2, FB.y + FB.d, 1.4) + .01, 'world');
    const hc = fp((cu0 + cu1) / 2, cv1 - .25), nc = fp((cu0 + cu1) / 2, (cv0 + cv1 - .5) / 2);
    sc.add(`<text transform="translate(${f1(hc[0])} ${f1(hc[1] + 9)}) skewY(28.8)" text-anchor="middle" font-family="Geist Mono, monospace" font-weight="700" font-size="30" fill="${PAL.cream}">JAPAN</text><g transform="translate(${f1(nc[0])} ${f1(nc[1])}) skewY(28.8) scale(1 ${f1(sq)})"><text x="0" y="16" text-anchor="middle" font-family="Geist Mono, monospace" font-weight="700" font-size="48" fill="${PAL.ink}">${yr}</text></g>`, V.dep(FB.x + FB.w / 2, FB.y + FB.d, 1.4) + .02, 'world');
    // belt (stripes move with the crates), end rollers
    K.box(sc, { x: -4.7, y: -.9, z: 0, w: 9.4, d: 1.8, h: .26, color: mix(PAL.road, PAL.violet, .35), rim: false, depth: -50 });
    let st = ''; const sp = .5, off = dpos(t) % sp; for (let x = -4.7 + off; x < 4.7; x += sp) st += `M${pt(V.P(x, -.86, .262))}L${pt(V.P(x, .86, .262))}`;
    sc.add(`<path d="${st}" stroke="${rgba(PAL.cream, .35)}" stroke-width="${f1(3 * V.px)}"/><path d="M${pt(V.P(-4.7, -.9, .262))}L${pt(V.P(4.7, -.9, .262))}M${pt(V.P(-4.7, .9, .262))}L${pt(V.P(4.7, .9, .262))}" stroke="${rgba(PAL.cream, .7)}" stroke-width="${f1(2.4 * V.px)}"/>`, -49, 'world');
    // scanner arch
    const crateTop = .26 + .9;
    const under = crates.some(cr => Math.abs(xB(t) + cr.off - AX) < .62 && t > (cr.off === 0 ? tLab - .1 : 0)), scanning = crates.some(cr => Math.abs(xB(t) + cr.off - AX) < .62), lampOk = scanning;
    for (const y of [-1.15, .95]) K.box(sc, { x: AX - .12, y, z: 0, w: .24, d: .2, h: 2.1, color: PAL.sky, depth: V.dep(AX, y, 1) });
    K.box(sc, { x: AX - .14, y: -1.15, z: 2.0, w: .28, d: 2.3, h: .22, color: PAL.sky, depth: V.dep(AX, 0, 2.1) });
    const lp = V.P(AX, 0, 2.35); sc.add(`<circle cx="${f1(lp[0])}" cy="${f1(lp[1])}" r="${f1(9 * V.px)}" fill="${lampOk ? PAL.mint : PAL.sky}" filter="url(#glow)"/>`, V.dep(AX, 0, 2.4) + 2, 'top');
    // crates
    for (const cr of crates) {
      const x = xB(t) + cr.off, vis = x > -4.3 && x < 4.6; if (!vis) continue;
      const B = { x: x - .55, y: -.55, z: .26, w: 1.1, d: 1.1, h: .9, color: cr.col };
      K.box(sc, { ...B, depth: V.dep(x, 0, .8) });
      const g = hashQ(cr.seed), top = (u, v) => K.facePt(V, B, 'top', u, v), cs = .78 / 9, ou = .16, ov = .16; let p = `<path d="${poly([top(ou - .05, ov - .05), top(ou + .83, ov - .05), top(ou + .83, ov + .83), top(ou - .05, ov + .83)])}" fill="${PAL.cream}"/>`, dk = '';
      const scr = cr.off === 0 && t > tScr, oil = cr.off === 0 ? pin01(t, tOily, .35) : 0;
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (g[r][c]) dk += poly([top(ou + c * cs, ov + r * cs), top(ou + (c + 1) * cs, ov + r * cs), top(ou + (c + 1) * cs, ov + (r + 1) * cs), top(ou + c * cs, ov + (r + 1) * cs)]);
      p += `<path d="${dk}" fill="${PAL.ink}"/>`;
      if (oil > 0) { const cx = ou + .39, cy = ov + .39, pts = []; for (let i = 0; i < 16; i++) { const an = i / 16 * Math.PI * 2, rr = (.27 + .09 * Math.sin(i * 2.3 + 1) + .05 * Math.cos(i * 4.1)) * oil; pts.push(top(cx + rr * Math.cos(an), cy + rr * Math.sin(an))); }
        p += `<path d="${poly(pts)}" fill="${mix(PAL.violet, PAL.shade, .72)}" stroke="${PAL.ember}" stroke-width="${f1(3 * V.px)}" stroke-linejoin="round"/>`; }
      if (cr.off === 0 && t > tScr - .05) for (const [a, b, c, d, t0] of [[.2, .22, .98, .66, tScr - .02], [.28, .78, .92, .26, tScr + .09]]) { const k = prog(t, t0, t0 + .11); if (k > 0) p += `<path d="${line([top(a, b), top(lerp(a, c, k), lerp(b, d, k))])}" stroke="${PAL.ember}" stroke-width="${f1(5 * V.px)}" stroke-linecap="round"/>`; }
      sc.add(p, V.dep(x, 0, 1.2) + .02, 'world');
      // gear icon on the +y face
      const gp = [], gc = [.55, .45], gf = (u, v) => K.facePt(V, B, 'left', u, v); for (let i = 0; i < 24; i++) { const an = i / 24 * Math.PI * 2, rr = (Math.floor(i / 2) % 2 ? .27 : .2); gp.push(gf(gc[0] + rr * Math.cos(an), gc[1] + rr * Math.sin(an) * 1)); }
      sc.add(`<path d="${poly(gp)}" fill="${mix(cr.col, PAL.cream, .75)}"/><path d="${poly(Array.from({ length: 14 }, (_, i) => gf(gc[0] + .09 * Math.cos(i / 14 * 6.283), gc[1] + .09 * Math.sin(i / 14 * 6.283))))}" fill="${mix(cr.col, PAL.shade, .45)}"/>`, V.dep(x, 0, 1.2) + .03, 'world');
    }
    // oil nozzle above the belt (drop falls onto the crate top)
    const nx = xB(14.5) + 0 - 1.22 + 0.0 + (xB(tOily) - xB(14.5) + 1.22) * 0;      // nozzle sits where crate B is at "Oily"
    const NX = xB(tOily) + .39 - .55 + .16 + .0;
    K.cyl(sc, { c: [NX - 1.4, 0, 3.4], r: .1, h: 2.8, axis: 'x', color: PAL.cream, depth: V.dep(NX, 0, 3.4) });
    K.box(sc, { x: NX - .07, y: -.07, z: 2.7, w: .14, d: .14, h: .35, color: PAL.cream, depth: V.dep(NX, 0, 3) });
    if (t > tOily - .4 && t < tOily + .05) { const k = prog(t, tOily - .4, tOily), z = lerp(2.65, 1.2, k * k), p = V.P(NX, 0, z); sc.add(`<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(7 * V.px)}" ry="${f1(10 * V.px)}" fill="${mix(PAL.violet, PAL.shade, .72)}" stroke="${PAL.ember}" stroke-width="${f1(2.4 * V.px)}"/>`, 900, 'top'); }
    // scan beam in the arch + readout
    if (scanning) { const sweep = (t * 2.4) % 1; K.beam(sc, [AX, -1.0, lerp(.3, 2.0, sweep)], [AX, 1.0, lerp(.3, 2.0, sweep)], { color: PAL.mint, alpha: .9, w: 3, depth: 900, layer: 'air' }); }
    const bAt = xB(t) + 0, bIn = Math.abs(bAt - AX) < .9 && t > tLab - .2;
    if (bIn) { hud(sc, V.P(AX, 0, 2.9), 'STILL READS', { color: PAL.mint, dx: -6, dy: -10, alpha: pin01(t, tLab + .1, .25) }); tick(sc, [V.P(AX, 0, 2.9)[0] + 185, V.P(AX, 0, 2.9)[1] - 10], PAL.mint, pin01(t, tLab + .3, .25)); }
    // the joke: a goat silhouette tile
    if (t > tClose) { const k = ease.expoOut(prog(t, tClose, tClose + .5)) * (1 + .12 * Math.sin(prog(t, tClose, tClose + .5) * Math.PI)), a = V.P(4.3, .2, 2.45), sz = 88 * k;
      sc.add(`<g transform="translate(${f1(a[0])} ${f1(a[1])}) scale(${f1(k)})"><rect x="-96" y="-96" width="192" height="192" rx="22" fill="${PAL.cream}" stroke="${PAL.saffron}" stroke-width="7"/><g transform="translate(-64 -58) scale(1.28)" fill="${PAL.ink}"><ellipse cx="45" cy="58" rx="27" ry="15"/><path d="M62 52L68 30L84 38L76 60Z"/><ellipse cx="80" cy="36" rx="12" ry="9"/><path d="M84 46L90 62L80 52Z"/><rect x="24" y="64" width="6" height="26"/><rect x="36" y="66" width="6" height="24"/><rect x="58" y="66" width="6" height="24"/><rect x="68" y="64" width="6" height="26"/><path d="M19 52L10 44L22 56Z"/></g><path d="M-8 -36Q-14 -66 -34 -78M-20 -36Q-30 -62 -46 -64" transform="translate(30 4) scale(.9)" fill="none" stroke="${PAL.ink}" stroke-width="6" stroke-linecap="round"/></g>`, 950, 'top');
      hud(sc, [Math.min(V.W - 175, a[0]), a[1] + 128], 'CLOSE ENOUGH', { color: PAL.saffron, alpha: pin01(t, tClose + .25, .3) }); void sz; }
    K.cloud(sc, { x: 4.6, y: -3, z: 4.4, size: .8 });
    void under; void nx; void ph; void flipK;
  } };
}

// ============================================================================================================================
// CARDS 3-8 share one world: the QR lies flat on a mint island, the camera moves between subjects
function board(sc, o = {}) { worldA(sc); const map = flatMap(o.th || 0); const q = qr(sc, { map, thick: .14, layer: 'floor', depth: 0, ...o }); return { map, q }; }
const screenOf = (sc, map, c, r, dz = 0) => sc.V.P(map(c, r, dz));

// CARD 3  SQUARE = BIT: 8 modules of the top row lift, flip to 1 / 0, pulse, fold into one letter tile "m"
function card3() {
  const w3 = win('SQUARE = BIT'), at = w3.at, end = w3.end, tTiny = W(6, 'tiny'), tYes = W(6, 'yes'), tDark = W(6, 'dark'), tLight = W(6, 'light'), tEight = W(6, 'eight'), tLet = W(6, 'letter');
  const map0 = flatMap(0), RP = i => [(i - 3.5) * .66, -3.2, 1.0], cell = i => map0(8 + i + .5, .5);
  const keys = [{ t: at, pts: BP(), zoom: 1 }, { t: tTiny - .15, pts: [[-2.4, -3.3, 0], [2.4, -3.3, 1.8], [-1.6, -2.4, 0], [1.8, -2.4, 0], [0, -1.8, 1.9]], zoom: .7 }, { t: tEight + .9, pts: [[-1.6, -3.3, 0], [1.6, -3.3, 1.6], [0, -1.4, 0]], zoom: .58 }];
  const lsT = i => tTiny + i * .07;
  return { tag: 'SQUARE = BIT', at, end, seed: 4, keys, box: { x: 40, y: 175, w: 892, h: 355 }, stills: [tTiny + .55, tYes + .6, tDark + .4, tLight + .4, tEight + .5, tLet + .3], draw(sc, t) {
    const lifted = i => t > lsT(i);
    board(sc, { skip: (r, c) => r === 0 && c >= 8 && c < 16 && lifted(c - 8) });
    const V = sc.V, fold = io(t, tEight + .45, .6);
    if (t > tEight - .05 && fold < 1) { const a = RP(0), b = RP(7); K.dim(sc, [a[0] - .3, a[1], .62], [b[0] + .3, b[1], .62], { k: prog(t, tEight, tEight + .4), color: PAL.sky, w: 3, layer: 'air' }); }
    for (let i = 0; i < 8; i++) {
      const k = ease.p3out(prog(t, lsT(i), lsT(i) + .7)); if (k <= 0 || fold >= 1) continue;
      const dk = G[0][8 + i] === 1, c0 = cell(i), rp = RP(i), p = [lerp(c0[0], rp[0], k), lerp(c0[1], rp[1], k), lerp(ZB, rp[2], k) + .35 * Math.sin(Math.PI * k)];
      const tf = tYes + i * .11, fk = prog(t, tf, tf + .34), sw = Math.max(.1, Math.abs(Math.cos(Math.PI * fk)));
      const bump = dk ? Math.sin(Math.PI * prog(t, tDark, tDark + .5)) : Math.sin(Math.PI * prog(t, tLight, tLight + .5));
      const sz = lerp(U * .96, .56, k) * (1 + .22 * bump), cx = lerp(p[0], 0, fold), cy = lerp(p[1], -1.8, fold), z = lerp(p[2], .8, fold) + 0;
      const col = dk ? PAL.ink : PAL.cream, B = { x: cx - sz * sw / 2, y: cy - sz / 2, z, w: sz * sw, d: sz, h: sz, color: col };
      K.box(sc, { ...B, rimA: .9, depth: V.dep(cx, cy, z + sz / 2) + 5 });
      if (fk > .5 && fold < .5) { const f = K.facePt(V, { ...B, w: sz * sw }, 'left', sz * sw / 2, sz / 2), fs = Math.max(40, sz * V.s * V.ZF * .66);
        sc.add(`<text transform="translate(${f1(f[0])} ${f1(f[1])}) skewY(28.8)" text-anchor="middle" font-family="Geist Mono, monospace" font-weight="700" font-size="${f1(fs)}" fill="${dk ? PAL.cream : PAL.ink}" dy="${f1(fs * .35)}">${dk ? 1 : 0}</text>`, V.dep(cx, cy, z + sz / 2) + 6, 'top'); }
      if (bump > .02) K.rings(sc, { p: [cx, cy, z], n: 1, r: .7, r0: .1, color: dk ? PAL.saffron : PAL.sky, phase: prog(t, dk ? tDark : tLight, (dk ? tDark : tLight) + .6), alpha: 1, w: 2.6, layer: 'fx' });
    }
    if (fold > 0) { const k = ease.expoOut(prog(t, tEight + .9, tEight + 1.35)) * 1, sz = .95 * Math.max(.2, k), z = .8, B = { x: -sz / 2, y: -1.8 - sz / 2, z, w: sz, d: sz, h: sz, color: PAL.saffron };
      K.box(sc, { ...B, depth: V.dep(0, -1.8, z + sz / 2) + 5 }); const f = K.facePt(V, B, 'left', sz / 2, sz / 2);
      if (k > .5) sc.add(`<text transform="translate(${f1(f[0])} ${f1(f[1])}) skewY(28.8)" text-anchor="middle" font-family="Geist Mono, monospace" font-weight="700" font-size="${f1(Math.max(40, sz * V.s * V.ZF * .8))}" fill="${PAL.ink}" dy="14">m</text>`, V.dep(0, -1.8, z + sz / 2) + 6, 'top'); }
    if (t > tEight + .1) hud(sc, [V.W / 2, V.H - 34], '8 SQUARES = 1 LETTER', { color: PAL.saffron, alpha: pin01(t, tEight + .1, .3) });
  } };
}

// CARD 4  THE ZIGZAG: m, a, p drop into the grid as lit 8-module blocks; a reading head snakes up/down 2-wide columns from the bottom-right corner
function card4() {
  const w4 = win('THE ZIGZAG'), at = w4.at, end = w4.end, tMap = W(7, 'map'), tZig = W(8, 'zigzag'), tCorner = W(8, 'corner');
  const dropT = i => tMap + Math.floor(i / 8) * .5 + (i % 8) * .03, DUR = .45, L4 = ZZ.filter(z => z.p < 4).length, head = t => Math.floor(ease.linear(prog(t, tZig + .1, tZig + 1.55)) * (L4 - 1));
  const keys = [{ t: at - .1, pts: BP(), zoom: 1 }, { t: tMap - .2, pts: BP(ZB, .93), zoom: 1.0 }, { t: tZig - .3, pts: [[0, 0, ZB], [2.9, 2.9, ZB], [2.9, -.6, ZB], [-.6, 2.9, ZB]], zoom: .62 }];
  const idx = new Map(ZZ.map((z, i) => [z.r * 100 + z.c, i]));
  return { tag: 'THE ZIGZAG', at, end, seed: 4, keys, box: { x: 26, y: 110, w: 920, h: 430 }, stills: [tMap + .75, tMap + 1.5, tZig + .9, tZig + 1.9, tCorner + .5], draw(sc, t) {
    const hi = t > tZig ? head(t) : -1;
    const { map, q } = board(sc, {
      skip: (r, c) => { const i = idx.get(r * 100 + c); return i !== undefined && i < 24 && t < dropT(i) + DUR; },
      tint: (r, c) => { const i = idx.get(r * 100 + c); if (i === undefined) return null; if (i < 24) return PAL.saffron; return i <= hi ? PAL.sky : null; } });
    const V = sc.V;
    for (let i = 0; i < 24; i++) { const k = prog(t, dropT(i), dropT(i) + DUR); if (k <= 0 || k >= 1) continue; const p = q.centre(ZZ[i].r, ZZ[i].c); K.box(sc, { x: p[0] - U * .48, y: p[1] - U * .48, z: ZB + 2.4 * (1 - k * k), w: U * .96, d: U * .96, h: .09, color: PAL.saffron, depth: 900 + i }); }
    if (t > tMap - .3 && t < tMap + 2.1) { const a = pin01(t, tMap - .3, .35) * (1 - prog(t, tMap + 1.7, tMap + 2.1)); hud(sc, V.P(0, -.4, 2.9 + .08 * Math.sin(t * 3)), 'map.camp/ab', { color: PAL.saffron, alpha: a }); }
    if (t > tZig) { const kk = pin01(t, tZig, .3), cp = i => q.centre(ZZ[Math.max(0, i)].r, ZZ[Math.max(0, i)].c, .03), h0 = Math.max(0, hi);
      if (h0 > 1) { const tr = []; for (let i = Math.max(0, h0 - 22); i <= h0; i++) tr.push(V.P(map(24 - 2 * ZZ[i].p, ZZ[i].r + .5, .03))); sc.add(`<path d="${line(tr)}" fill="none" stroke="${rgba(PAL.cream, .9)}" stroke-width="${f1(8 * V.px)}" stroke-linejoin="round" stroke-linecap="round" filter="url(#glow)"/>`, 950, 'fx'); }
      const hc = hi < 0 ? ZZ[0] : ZZ[h0]; sc.add(`<path d="${q.cellQuad(hc.r, hc.c, .05)}" fill="${PAL.mint}" stroke="${PAL.cream}" stroke-width="${f1(2.4 * V.px)}" filter="url(#glow2)" opacity="${kk.toFixed(2)}"/>` + `<circle cx="${f1(V.P(q.centre(hc.r, hc.c))[0])}" cy="${f1(V.P(q.centre(hc.r, hc.c))[1])}" r="${f1(17 * V.px)}" fill="none" stroke="${PAL.mint}" stroke-width="${f1(4 * V.px)}" filter="url(#glow)"/>`, 960, 'fx'); }
    if (t > tCorner) { const p = q.centre(ZZ[0].r, ZZ[0].c, .03); K.rings(sc, { p, n: 3, r: 1.3, r0: .1, color: PAL.mint, phase: (t - tCorner) * .9, alpha: pin01(t, tCorner, .2), w: 3, layer: 'fx' });
      hud(sc, V.P(p[0], p[1], .02), 'START', { color: PAL.mint, dx: 20, dy: 78, alpha: pin01(t, tCorner + .1, .3) }); }
  } };
}

// CARD 5  THREE EYES: finder eyes lift + glow coral, numbered; ring pulses; code turns 90 then 180 degrees while a viewfinder bracket re-locks on the eyes
function card5() {
  const w5 = win('THREE EYES'), at = w5.at, end = w5.end, tThree = W(9, 'three'), tBig = W(9, 'big'), tSq = W(9, 'squares'), tHere = W(10, 'here'), tSide = W(10, 'Sideways'), tUp = W(10, 'upside'), tFinds = W(10, 'finds');
  const rot1 = [tSide, tSide + .75], rot2 = [tUp, tUp + .85];
  const th = t => (io(t, rot1[0], rot1[1] - rot1[0]) + io(t, rot2[0], rot2[1] - rot2[0])) * Math.PI / 2;
  const keys = [{ t: at - .1, pts: BP(), zoom: 1 }];
  const open = t => Math.max(Math.sin(Math.PI * prog(t, rot1[0] - .1, rot1[1] + .25)), Math.sin(Math.PI * prog(t, rot2[0] - .1, rot2[1] + .25)));
  return { tag: 'THREE EYES', at, end, seed: 4, keys, stills: [tThree + .5, tBig + .9, tHere + .6, tSide + .5, tUp + .7, tFinds + .5], draw(sc, t) {
    const lk = io(t, tThree, .45), found = t > tFinds, V = sc.V, ang = th(t);
    const { map, q } = board(sc, { th: ang, glow: true, lift: (r, c) => eyeOf(r, c) >= 0 ? .16 * lk : 0, tint: (r, c) => eyeOf(r, c) >= 0 && isDark(r, c) && lk > .02 ? (found ? PAL.mint : PAL.coral) : null });
    const ctr = i => map(EYES[i][1], EYES[i][0], .16 * lk), sp = i => V.P(ctr(i));
    [tBig, tSq - .05, tSq + .28].forEach((tn, i) => { const a = pin01(t, tn, .3); if (a > 0) { const p = sp(i); sc.add(`<circle cx="${f1(p[0])}" cy="${f1(p[1] - 62)}" r="${f1(27 * a)}" fill="${PAL.ink}" stroke="${found ? PAL.mint : PAL.coral}" stroke-width="${f1(4 * V.px)}"/>`, 0, 'hud'); if (a > .6) txt(sc, p[0], p[1] - 62 + 14, 40, PAL.cream, i + 1); } });
    [0, 1, 2].forEach(i => { const ph = (t - (tHere + i * .16)) * .75; if (t > tHere + i * .16 && t < tHere + 1.8) K.rings(sc, { p: [...ctr(i).slice(0, 2), .2], n: 2, r: 1.9, r0: .3, color: PAL.coral, phase: ph, alpha: 1 - prog(t, tHere + 1.2, tHere + 1.8), w: 3.2, layer: 'fx' }); });
    if (t > tSide - .35) {
      const a = pin01(t, tSide - .35, .3), pad = 8 + 50 * open(t) + 120 * (1 - pin01(t, tSide - .35, .5)), col = found ? PAL.mint : PAL.sky, c3 = [0, 1, 2].map(sp);
      for (const p of c3) bracket(sc, p, 44 + pad, 36 + pad * .8, col, a);
      sc.add(`<path d="${poly(c3)}" fill="none" stroke="${rgba(col, .6 * a)}" stroke-width="${f1(2.4 * V.px)}" stroke-dasharray="7 9"/>`, 0, 'top');
      const locked = [rot1[1] + .25, rot2[1] + .25, tSide - .05].some(tl => t >= tl && t < tl + .9) && open(t) < .15;
      if (locked && !found) tick(sc, [V.W - 70, 110], PAL.sky, 1);
      if (found) { hud(sc, [V.W / 2, V.H - 34], 'FOUND', { color: PAL.mint, alpha: pin01(t, tFinds, .25) }); tick(sc, [V.W / 2 + 120, V.H - 40], PAL.mint, pin01(t, tFinds + .1, .25)); if (t < tFinds + .4) sc.add(`<rect x="0" y="0" width="${V.W}" height="${V.H}" fill="${rgba(PAL.mint, .22 * (1 - prog(t, tFinds, tFinds + .4)))}"/>`, 0, 'hud'); }
    }
  } };
}

// CARD 6  WHICH WAY UP: tilted code, four corner markers (3 coral on eyes, 1 empty dashed violet), the arrow from the empty corner turns the code upright
function card6() {
  const w6 = win('WHICH WAY UP'), at = w6.at, end = w6.end, tFour = W(11, 'four'), tEmpty = W(12, 'empty'), tWhich = W(12, 'which'), tUpW = W(12, 'up');
  const th0 = 110 * D2R, th = t => th0 * (1 - io(t, tWhich, .65)), ARR = [[21.5, 21.5], [3.5, 3.5]];
  const keys = [{ t: at - .1, pts: BP(), zoom: 1 }];
  return { tag: 'WHICH WAY UP', at, end, seed: 4, keys, stills: [tFour + .55, tEmpty + .35, tWhich + .5, tUpW + .25], draw(sc, t) {
    const a = th(t), V = sc.V, { map } = board(sc, { th: a }), C = [[3.5, 3.5], [3.5, 21.5], [21.5, 3.5], [21.5, 21.5]], ca = [0, 1, 2, 3].map(i => pin01(t, tFour + i * .12, .35));
    C.forEach(([r, c], i) => { const p = map(c, r, .02); if (i < 3) gRing(sc, p, 4.6 * U * ca[i] * 1.0, PAL.coral, ca[i], { w: 3.6, depth: 3 });
      else { gRing(sc, p, 4.6 * U * ca[i], PAL.violet, ca[i], { w: 3.6, dash: '10 9', fillA: .12, depth: 3 }); if (t > tEmpty) K.rings(sc, { p, n: 2, r: 1.6, r0: .3, color: PAL.violet, phase: (t - tEmpty) * .8, alpha: pin01(t, tEmpty, .2), w: 3, layer: 'fx' }); } });
    if (t > tEmpty + .9) { const k = ease.p3out(prog(t, tEmpty + .9, tWhich + .05)), p0 = map(ARR[0][1], ARR[0][0], .3), p1 = map(ARR[1][1], ARR[1][0], .3), tip = [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k), .3], A = V.P(p0), B = V.P(tip), ang = Math.atan2(B[1] - A[1], B[0] - A[0]), L = 26 * V.px * 1.6;
      sc.add(`<path d="M${pt(A)}L${pt(B)}" stroke="${rgba(PAL.ink, .7)}" stroke-width="${f1(15 * V.px)}" stroke-linecap="round"/><path d="M${pt(A)}L${pt(B)}" stroke="${PAL.cream}" stroke-width="${f1(9 * V.px)}" stroke-linecap="round"/><path d="M${f1(B[0] - L * Math.cos(ang - .45))},${f1(B[1] - L * Math.sin(ang - .45))}L${pt(B)}L${f1(B[0] - L * Math.cos(ang + .45))},${f1(B[1] - L * Math.sin(ang + .45))}Z" fill="${PAL.cream}" stroke="${PAL.cream}" stroke-width="${f1(5 * V.px)}" stroke-linejoin="round"/>`, 0, 'top');
      if (t > tWhich + .05) hud(sc, [Math.min(V.W - 70, Math.max(70, B[0] + 80)), Math.max(70, B[1] - 6)], 'UP', { color: PAL.cream, alpha: pin01(t, tWhich + .05, .25) }); }
  } };
}

// CARD 7  SPARE SQUARES: bitten code; mint spare dots appear across the whole grid, threads link them to the bite, the hole rebuilds module by module
function card7() {
  const w7 = win('SPARE SQUARES'), at = w7.at, end = w7.end, tSpare = W(14, 'spare'), tExtra = W(14, 'Extra'), tLose = W(14, 'Lose'), tReb = W(14, 'rebuilds');
  const R = rng(777), dots = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!FN[r][c] && !inBite(r, c) && R() < .27) dots.push({ r, c, d: Math.hypot(r - 12, c - 12) });
  const threads = dots.filter((_, i) => i % 8 === 3), per = .8 / HOLE.length, tR = i => tReb + i * per, holeIdx = new Map(HOLE.map((h, i) => [h.r * 100 + h.c, i]));
  const keys = [{ t: at - .1, pts: BP(), zoom: 1 }];
  return { tag: 'SPARE SQUARES', at, end, seed: 4, keys, stills: [tSpare + .7, tExtra + .9, tLose + .5, tReb + .3, tReb + .6], draw(sc, t) {
    const V = sc.V, back = i => t >= tR(i), flash = i => 1 - prog(t, tR(i), tR(i) + .3);
    const { map, q } = board(sc, { skip: (r, c) => { const i = holeIdx.get(r * 100 + c); return i !== undefined && !back(i); }, edge: t < tReb + .9 ? PAL.ember : null, edgeW: 3.6 + (t > tLose && t < tReb ? 2 * Math.sin((t - tLose) * 9) ** 2 : 0),
      tint: (r, c) => { const i = holeIdx.get(r * 100 + c); return i !== undefined && back(i) && flash(i) > 0 ? (flash(i) > .5 ? PAL.mintLit : PAL.mint) : null; }, glow: true });
    // sockets: the missing dark modules as empty ember-dashed outlines
    if (t < tReb + .9) { let s = ''; HOLE.forEach((h, i) => { if (!back(i) && isDark(h.r, h.c)) s += q.cellQuad(h.r, h.c, .01); }); sc.add(`<path d="${s}" fill="${rgba(PAL.ink, .22)}" stroke="${PAL.ember}" stroke-width="${f1(1.6 * V.px)}" stroke-dasharray="4 4"/>`, 1, 'floor'); }
    const hc = map(25.2, 12.6, .05);
    const dotsA = dots.filter(d => t > tSpare + d.d * .045);
    let dsv = ''; for (const d of dotsA) { const p = V.P(map(d.c + .5, d.r + .5, .02)), k = pin01(t, tSpare + d.d * .045, .25); dsv += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(12 * V.px * k)}" fill="${PAL.mint}" stroke="${PAL.ink}" stroke-width="${f1(1.6 * V.px)}"/>`; }
    sc.add(dsv, 2, 'floor');
    threads.forEach((d, i) => { const k = ease.p3out(prog(t, tExtra + i * .09, tExtra + i * .09 + .8)); if (k <= 0) return; const a = map(d.c + .5, d.r + .5, .05), pts = []; for (let j = 0; j <= 14; j++) { const f = j / 14 * k, p = [lerp(a[0], hc[0], f), lerp(a[1], hc[1], f), .05 + .9 * Math.sin(Math.PI * f) * Math.min(1, Math.hypot(a[0] - hc[0], a[1] - hc[1]) / 3)]; pts.push(V.P(p)); }
      sc.add(`<path d="${line(pts)}" fill="none" stroke="${rgba(PAL.mint, .85)}" stroke-width="${f1(4 * V.px)}" stroke-linecap="round"/>`, 800, 'fx');
      if (t > tReb - .2 && t < tReb + 1.1) { const f = (((t - tReb) * 1.3 + i * .13) % 1 + 1) % 1, p = V.P([lerp(a[0], hc[0], f), lerp(a[1], hc[1], f), .05 + .9 * Math.sin(Math.PI * f) * Math.min(1, Math.hypot(a[0] - hc[0], a[1] - hc[1]) / 3)]); sc.add(`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(5 * V.px)}" fill="${PAL.cream}" filter="url(#glow)"/>`, 810, 'fx'); } });
    if (t > tLose && t < tReb) hud(sc, V.P(hc), 'BITE', { color: PAL.ember, dx: -60, dy: -92, alpha: pin01(t, tLose, .3) });
    if (t > tReb + .95) { tick(sc, [V.W - 70, 110], PAL.mint, pin01(t, tReb + .95, .2)); }
    if (t > tSpare) hud(sc, [V.W / 2, V.H - 34], 'EXTRA MATH', { color: PAL.mint, alpha: pin01(t, tSpare + .2, .3) * (1 - prog(t, tReb + 1.0, tReb + 1.2)) });
  } };
}

// CARD 8  UP TO 30%: a coral bite grows while a meter fills to 30 %, flashes, rebuilds; then a logo tile drops onto the centre and a scan sweep still reads
function card8() {
  const w8 = win('UP TO 30%'), at = w8.at, end = w8.end, tHow = W(15, 'big'), tThirty = W(16, 'thirty'), tPct = W(16, 'percent'), tLogo = W(16, 'logo');
  const g = t => ease.p2io(prog(t, tHow, tThirty)), DATA = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!FN[r][c]) DATA.push({ r, c, m: ((c + .5 - 26.5) / 1.7) ** 2 + (r + .5 - 12.5) ** 2 });
  DATA.sort((a, b) => a.m - b.m); const DMGN = Math.round(.3 * DATA.length), RK = new Map(DATA.slice(0, DMGN).map((d, i) => [d.r * 100 + d.c, i])), inEll = (r, c, s) => { const i = RK.get(r * 100 + c); return i !== undefined && i < s * DMGN; };
  const rebuilt = t => t >= tPct, keys = [{ t: at - .1, pts: BP(), zoom: 1 }];
  return { tag: 'UP TO 30%', at, end, seed: 4, box: { x: 26, y: 84, w: 790, h: 456 }, keys, stills: [tHow + .6, tThirty - .25, tPct + .15, tLogo + .4, tLogo + .7], draw(sc, t) {
    const V = sc.V, s = g(t), dmg = !rebuilt(t) && s > 0, fl = t >= tPct ? 1 - prog(t, tPct, tPct + .45) : 0;
    const { map } = board(sc, { skip: (r, c) => dmg && inEll(r, c, s), edge: dmg ? PAL.coral : null, edgeW: 4.4, glow: true, tint: (r, c) => fl > .02 && inEll(r, c, 1) ? (fl > .5 ? PAL.mintLit : PAL.mint) : null });
    // meter
    const mx = V.W - 112, my0 = 120, mh = 330, pct = (rebuilt(t) ? 1 : Math.floor(s * DMGN) / DMGN) * DMGN / DATA.length * 100, a = pin01(t, tHow - .1, .3);
    sc.add(`<g opacity="${a.toFixed(2)}"><rect x="${mx}" y="${my0}" width="58" height="${mh}" rx="10" fill="${PAL.ink}" stroke="${rgba(PAL.cream, .8)}" stroke-width="3"/><rect x="${mx + 5}" y="${f1(my0 + mh - 5 - (mh - 10) * pct / 30 * .9)}" width="48" height="${f1((mh - 10) * pct / 30 * .9)}" rx="6" fill="${rebuilt(t) ? PAL.mint : PAL.coral}"${rebuilt(t) && fl > 0 ? ' filter="url(#glow)"' : ''}/><path d="M${mx - 8},${f1(my0 + mh - 5 - (mh - 10) * .9)}L${mx + 66},${f1(my0 + mh - 5 - (mh - 10) * .9)}" stroke="${PAL.cream}" stroke-width="3" stroke-dasharray="6 5"/></g>`, 0, 'hud');
    txt(sc, mx + 29, my0 - 18, 46, rebuilt(t) ? PAL.mint : PAL.coral, Math.round(pct) + '%', a, 5);
    if (t >= tPct) hud(sc, [V.W / 2 - 60, V.H - 34], 'STILL READS', { color: PAL.mint, alpha: pin01(t, tPct + .1, .25) * (1 - prog(t, tLogo + 1.0, tLogo + 1.2)) });
    // logo tile with a campfire
    if (t > tLogo - .5) { const k = prog(t, tLogo - .3, tLogo + .05), z = lerp(3.2, .2, k * k), c = map(12.5, 12.5, z), p = V.P(c), rr = 0.64 * V.s, bounce = k >= 1 ? 1 + .05 * Math.sin(prog(t, tLogo + .1, tLogo + .45) * 9) * (1 - prog(t, tLogo + .1, tLogo + .45)) : 1;
      if (k < 1) sc.add(`<ellipse cx="${f1(V.P(map(12.5, 12.5, ZB))[0])}" cy="${f1(V.P(map(12.5, 12.5, ZB))[1])}" rx="${f1(rr * k)}" ry="${f1(rr * k * V.K)}" fill="${rgba(PAL.shade, .4 * k)}"/>`, 990, 'top');
      sc.add(`<g transform="translate(${f1(p[0])} ${f1(p[1])}) scale(${f1(bounce)})"><ellipse cx="0" cy="${f1(rr * .18)}" rx="${f1(rr)}" ry="${f1(rr * V.K + 4)}" fill="${mix(PAL.violet, PAL.shade, .5)}"/><ellipse cx="0" cy="0" rx="${f1(rr)}" ry="${f1(rr * V.K + 4)}" fill="${PAL.cream}" stroke="${PAL.saffron}" stroke-width="5"/><g transform="translate(0 -4) scale(${f1(rr / 52)})"><path d="M0 -26C14 -12 18 -2 12 8C9 13 4 15 0 15C-6 15 -12 11 -11 3C-10 -4 -5 -6 -4 -14C-2 -10 0 -18 0 -26Z" fill="${PAL.saffron}" stroke="${PAL.coral}" stroke-width="3"/><path d="M0 -4C5 2 6 6 3 9C1 11 -2 11 -3 8C-4 4 -1 1 0 -4Z" fill="${PAL.cream}"/><path d="M-22 18L20 10M-18 10L22 18" stroke="${mix(PAL.saffron, PAL.shade, .5)}" stroke-width="7" stroke-linecap="round"/></g></g>`, 991, 'top');
      const sw = prog(t, tLogo + .15, tLogo + .7); if (sw > 0 && sw < 1) K.beam(sc, map(-2 + 29 * sw, -2, .1), map(-2 + 29 * sw, 27, .1), { color: PAL.mint, alpha: .95, w: 4, depth: 995, layer: 'fx' });
      if (t > tLogo + .7) { tick(sc, [V.W / 2 + 130, V.H - 40], PAL.mint, pin01(t, tLogo + .7, .2)); }
    }
  } };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// the layout switch re-frames the scene, so a card enters/leaves ON a shot cut when one is close
const cuts = (E.shots || []).map(x => x.t0).filter(x => x > 0);
const snap = (t, lo, hi) => { const c = cuts.filter(x => x >= t - lo && x <= t + hi).sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0]; return c ?? t; };
export const CARDS = [card1(), card2(), card3(), card4(), card5(), card6(), card7(), card8()].map(c => ({ ...c, at: snap(c.at, .35, .05), end: snap(c.end, .4, .1) })).map(c => ({ ...c, stills: c.stills.filter(x => x > c.at + .3 && x < c.end - .35) }));
const NS = 'http://www.w3.org/2000/svg';
const tagHtml = fs => `position:absolute;left:${fs * 1.7}px;top:${fs * 1.4}px;display:flex;align-items:center;gap:${fs * .7}px;font:500 ${fs}px/1 'Geist Mono',monospace;letter-spacing:.14em;color:${rgba(PAL.cream, .92)};z-index:20;padding:${fs * .35}px ${fs * .6}px;margin:-${fs * .35}px 0 0 -${fs * .6}px;border-radius:${fs * .5}px;background:${PAL.bg0};box-shadow:0 0 0 1.5px ${rgba(PAL.cream, .16)}`; // (qr fix) tag above the world on an opaque pill
function mount(b, c, k) {
  const cardEl = b.media.closest('.mg-card'), content = b.media.parentNode, cw = b.W, ch = b.H;
  Object.assign(cardEl.style, { borderRadius: '22px', border: 'none', background: PAL.bg0, boxShadow: `0 30px 70px rgba(8,6,24,.6),0 0 0 1.5px ${rgba(PAL.cream, .16)}`, backdropFilter: 'none', webkitBackdropFilter: 'none' });
  for (const sel of ['.mg-rule', '.mg-grain']) cardEl.querySelectorAll(sel).forEach(e => (e.style.display = 'none'));
  content.querySelectorAll(':scope > .mg-vig, :scope > svg.mg-lines, :scope > .mg-meta, :scope > .mg-tag').forEach(e => (e.style.display = 'none'));
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', cw); svg.setAttribute('height', ch); svg.setAttribute('viewBox', `0 0 ${cw} ${ch}`); svg.style.cssText = 'position:absolute;left:0;top:0'; b.media.appendChild(svg);
  const tag = document.createElement('div'); tag.style.cssText = tagHtml(28); const sq = document.createElement('i'); sq.style.cssText = `display:block;width:14px;height:14px;background:${PAL.saffron};border-radius:3px`; const tx = document.createElement('span'); tag.append(sq, tx); content.appendChild(tag);
  const box = c.box || { x: 26, y: 84, w: cw - 52, h: ch - 84 - 20 }, rig = camRig({ W: cw, H: ch, box, keys: c.keys }), bg = background(cw, ch, c.seed);
  let last = -1;
  b.items.push({ upd: lt => { const t = c.at + lt; if (Math.abs(t - last) < 1e-4) return; last = t; const sc = createScene(viewAt(rig, t)); c.draw(sc, t); svg.innerHTML = (bg + sc.svg()).replace(/(id="|url\(#)([\w-]+)/g, `$1$2_${k}`); tx.textContent = typeof c.tag === 'function' ? c.tag(t) : c.tag; } });
}
export default function addCues(mg, { ratio } = {}) {
  const lay = ratio === '16x9' ? 'split' : 'float';
  for (const c of CARDS) mg.beat({ at: c.at, dur: c.end - c.at, layout: lay, side: 'top', exit: 'top' }, b => mount(b, c, CARDS.indexOf(c)));
}
