// touch MG: nine iso cards (STORYBOARD.md) built from mg/isokit. Cards 1 and 3-9 share ONE world (a phone lying flat on a mint island,
// the touch grid under its glass, camera moves); card 2 is its own world (three test circuits). Every card is a pure function of global
// episode time t. Word times come from shots.json at load time (W(line, word)). Engine contract (engine/mg-adapter.js): default export
// (mg, {ratio}) adds mg.beat()s; 9:16 uses 'float'. Text rule: every label is >= 28 px at 1080 width (hud size 34 * px .85 = 28.9 px).
import { PAL, mix, rgba, tones, f1, pt, poly, line, add3, sub3, mul3, rng, createScene } from '../../mg/isokit/core.js';
import * as K from '../../mg/isokit/prims.js';
import { background } from '../../mg/isokit/stage.js';
import { ease, prog } from '../../mg/isokit/motion.js';
import { camRig, viewAt } from '../../mg/isokit/camera.js';

const E = await (await fetch(new URL('./shots.json', import.meta.url))).json();
const BE = await (await fetch(new URL('./mg.beats.json', import.meta.url))).json();
const win = n => { const c = BE.cues.find(x => x.name === n); if (!c) throw new Error('touch mg: no beat ' + n); return c; };
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const W = (line, word, nth = 0) => { const c = E.words.filter(w => w.line === line && norm(w.w) === norm(word)); if (!c[nth]) throw new Error(`touch mg: no word "${word}" #${nth} in line ${line}`); return c[nth].s; };
const pin01 = (t, a, d = .5) => ease.p3out(prog(t, a, a + d));
const io = (t, a, d) => ease.p2io(prog(t, a, a + d));
const bell = (t, a, d) => Math.sin(Math.PI * prog(t, a, a + d));
const hud = (sc, a, text, o = {}) => K.hud(sc, a, text, { size: 34, ...o });          // 34 * .85 = 28.9 px
const lerp = (a, b, k) => a + (b - a) * k;
const PEACH = mix(PAL.coral, PAL.cream, .58), KNIT = PAL.violet;

// ============================================================================================================================
// THE PHONE WORLD: phone lying flat (screen up) on a mint island; touch grid = 6 columns (violet, along y) x 10 rows (sky, along x)
const PH = { x: -1.7, y: -2.9, w: 3.4, d: 5.8, h: .26 }, ZT = PH.h, ZG = ZT + .012;
const CX = [...Array(6)].map((_, i) => -1.25 + i * .5), RY = [...Array(10)].map((_, j) => -2.25 + j * .5);
const XS = [], idxOf = (i, j) => j * 6 + i; for (let j = 0; j < 10; j++) for (let i = 0; i < 6; i++) XS.push({ i, j, x: CX[i], y: RY[j] });
const IA = { x: -4.3, y: -4.5, w: 8.6, d: 9.0, r: 1, th: 1.1 };
const PHP = (z = 0, k = 1) => [[PH.x * k, PH.y * k, z], [-PH.x * k, PH.y * k, z], [-PH.x * k, -PH.y * k, z], [PH.x * k, -PH.y * k, z]];
const near = (x, y, n = 4) => XS.map(c => ({ ...c, dd: Math.hypot(c.x - x, c.y - y) })).sort((a, b) => a.dd - b.dd).slice(0, n);

function tent(sc, x, y, w, d, h, col) {
  const V = sc.V, T = tones(col), P = V.P; let o = K.shadowSvg(V, x + w / 2 + .25, y + d / 2 + .25, 0, Math.max(w, d) * .7, .25);
  o += `<path d="${poly([P(x, y + d, 0), P(x + w, y + d, 0), P(x + w / 2, y + d, h)])}" fill="${T.mid}"/><path d="${poly([P(x + w, y, 0), P(x + w, y + d, 0), P(x + w / 2, y + d, h), P(x + w / 2, y, h)])}" fill="${T.dark}"/>`;
  o += `<path d="${poly([P(x + w * .38, y + d, 0), P(x + w * .62, y + d, 0), P(x + w / 2, y + d, h * .55)])}" fill="${PAL.ink}"/>`;
  sc.add(o, V.dep(x + w / 2, y + d / 2, h * .3));
}
const rr = (x, y, w, d, r, n = 6) => { const p = []; for (const [cx, cy, a0] of [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + d - r, 0], [x + r, y + d - r, Math.PI / 2], [x + r, y + r, Math.PI]]) for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; };
// o: lit (0..1 screen light), lift (glass lift 0..1), grid (0..1 alpha), rowsK(j), colsK(i), puck(c)->{h,col} | null, snow (t), blink(c)->0..1
function phoneWorld(sc, t, o = {}) {
  const V = sc.V, R = rng(31);
  K.island(sc, { ...IA, seed: 9, tufts: 24, avoid: (x, y) => Math.abs(x) < 2.2 && Math.abs(y) < 3.4, top: o.snow != null ? mix(PAL.mint, PAL.cream, .35) : undefined });
  for (const [x, y, k, h] of [[-3.6, 3.7, 'cone', 1.5], [-2.8, 4.0, 'round', 1.0], [3.4, 3.6, 'cone', 1.3], [-3.7, -3.7, 'round', 1.0], [3.5, -2.2, 'cone', 1.1]]) K.tree(sc, { x, y, kind: k, h });
  tent(sc, 2.6, -4.1, 1.2, .95, .9, PAL.coral);
  if (o.snow != null) { let s = ''; for (let i = 0; i < 40; i++) { const x = IA.x + .6 + R() * (IA.w - 1.2), y = IA.y + .6 + R() * (IA.d - 1.2); if (Math.abs(x) < 2 && Math.abs(y) < 3.2) continue; const p = V.P(x, y, .005); s += `<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(.14 * V.s)}" ry="${f1(.14 * V.s * V.K)}" fill="${rgba(PAL.cream, .85)}"/>`; } sc.add(s, -1, 'floor'); }
  K.shadow(sc, .25, .35, 0, 3.3, .28);
  K.slab(sc, { ...PH, r: .38, color: PAL.violet, depth: -50, layer: 'floor' });
  const scr = rr(PH.x + .14, PH.y + .3, PH.w - .28, PH.d - .6, .18).map(q => V.P(q[0], q[1], ZT + .002)), lit = o.lit ?? 0;
  sc.add(`<path d="${poly(scr)}" fill="${lit > 0 ? mix(PAL.ink, PAL.sky, .55 * lit) : PAL.ink}"${lit > .05 ? ` filter="url(#glow)" opacity="${(.85 + .15 * lit).toFixed(2)}"` : ''}/>`, -40, 'floor');
  const sp = V.P(0, PH.y + .17, ZT + .003); sc.add(`<ellipse cx="${f1(sp[0])}" cy="${f1(sp[1])}" rx="${f1(.25 * V.s)}" ry="${f1(.05 * V.s)}" fill="${rgba(PAL.cream, .25)}"/>`, -39, 'floor');
  const ga = o.grid ?? 0;
  if (ga > 0) {
    let s = ''; const w = f1(4.6 * V.px), x0 = -1.5, x1 = 1.5, y0 = -2.5, y1 = 2.5;
    RY.forEach((y, j) => { const k = o.rowsK ? o.rowsK(j) : 1; if (k > 0) s += `<path d="M${pt(V.P(x0, y, ZG))}L${pt(V.P(lerp(x0, x1, k), y, ZG))}" stroke="${rgba(PAL.sky, .9 * ga)}" stroke-width="${w}" stroke-linecap="round"/>`; });
    CX.forEach((x, i) => { const k = o.colsK ? o.colsK(i) : 1; if (k > 0) s += `<path d="M${pt(V.P(x, y0, ZG + .004))}L${pt(V.P(x, lerp(y0, y1, k), ZG + .004))}" stroke="${rgba(PAL.violet, .95 * ga)}" stroke-width="${w}" stroke-linecap="round"/>`; });
    sc.add(s, -30, 'floor');
    if (o.blink) { let b = ''; for (const c of XS) { const k = o.blink(c); if (k > .02) { const p = V.P(c.x, c.y, ZG); b += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(7 * V.px)}" fill="${rgba(PAL.cream, k)}"/>`; } } if (b) sc.add(`<g filter="url(#glow)">${b}</g>`, -29, 'floor'); }
  }
  if (o.puck) {   // charge pucks: one glow group, painter-sorted inside (they are emitters: the charge)
    const ps = XS.map(c => ({ c, q: o.puck(c) })).filter(e => e.q && e.q.h > .004).sort((a, b) => V.dep(a.c.x, a.c.y, 0) - V.dep(b.c.x, b.c.y, 0));
    if (ps.length) sc.add(`<g filter="url(#glow)">${ps.map(({ c, q }) => K.cylSvg(V, { c: [c.x, c.y, ZG + q.h], r: q.r ?? .062, h: q.h, color: q.col || PAL.saffron, lit: .45, dark: .2 })).join('')}</g>`, -20, 'floor');
  }
  const lift = o.lift ?? 0, gz = ZT + .05 + 1.5 * lift;   // the glass: see-through sheet with a cream rim (lifts off for the exploded view)
  const gp = rr(PH.x + .05, PH.y + .05, PH.w - .1, PH.d - .1, .34).map(q => V.P(q[0], q[1], gz));
  sc.add(`<path d="${poly(gp)}" fill="${rgba(PAL.sky, .09 + .06 * lift)}" stroke="${rgba(PAL.cream, .55)}" stroke-width="${f1(2 * V.px)}"/>`, lift > .02 ? 50 : -10, lift > .02 ? 'air' : 'floor');
  if (o.snow != null) { let s = ''; const S = rng(77); for (let i = 0; i < 46; i++) { const x = -4 + S() * 8, y = -4 + S() * 8, sp = .5 + S() * .5, z = 6 - ((o.snow * sp + S() * 6) % 6); const p = V.P(x + .15 * Math.sin(o.snow + i), y, z); s += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1((2.4 + 2 * S()) * V.px)}" fill="${rgba(PAL.cream, .9)}"/>`; } sc.add(s, 0, 'top'); }
}
// finger / glove: a cylinder coming down from above the card (tip at z); water = fill level from the tip; ghost = dashed outline only
function finger(sc, s) {
  const V = sc.V, L = s.L ?? 7, r = (s.r ?? .42) * (s.squash ?? 1), [x, y] = s, z = s.z, col = s.glove ? KNIT : PEACH, a = s.alpha ?? 1;
  const sh = Math.max(0, 1 - (z - ZT) / 3.5); if (sh > 0) K.shadow(sc, x + .12, y + .16, ZT + .06, r * (1.1 + .5 * (1 - sh)), .3 * sh * a);
  if (s.ghost) { const ring = zz => Array.from({ length: 36 }, (_, i) => V.P(x + r * Math.cos(i / 36 * 6.283), y + r * Math.sin(i / 36 * 6.283), zz)); const b = ring(z), tp = ring(z + 2.6);
    sc.add(`<path d="${poly(b)}M${pt(V.P(x - r * .7071, y + r * .7071, z))}L${pt(V.P(x - r * .7071, y + r * .7071, z + 2.6))}M${pt(V.P(x + r * .7071, y - r * .7071, z))}L${pt(V.P(x + r * .7071, y - r * .7071, z + 2.6))}" fill="none" stroke="${rgba(PAL.violet, .75 * a)}" stroke-width="${f1(3 * V.px)}" stroke-dasharray="${f1(10 * V.px)} ${f1(8 * V.px)}"/>`, 60, 'air'); return; }
  let o = K.cylSvg(V, { c: [x, y, z + L], r, h: L, color: col });
  if (s.water) { const wl = Math.min(L, s.water); o += K.cylSvg(V, { c: [x, y, z + wl], r: r * .99, h: wl, tones: { top: rgba(PAL.sky, .55), mid: mix(PAL.sky, col, .35), dark: mix(PAL.sky, PAL.shade, .3) }, rim: false });
    const R = rng(5); for (let i = 0; i < 7; i++) { const zz = z + .15 + ((R() * wl + (s.t || 0) * .25) % Math.max(.2, wl - .2)), p = V.P(x - r * .5 + R() * r, y + r * .6, zz), g = 3.4 * V.px; o += `<rect x="${f1(p[0] - g)}" y="${f1(p[1] - g)}" width="${f1(2 * g)}" height="${f1(2 * g)}" fill="${rgba(PAL.cream, .9)}" transform="rotate(45 ${f1(p[0])} ${f1(p[1])})"/>`; } }
  if (s.glove) for (let k = 1; k <= 6; k++) { const zz = z + k * .32, e = Array.from({ length: 19 }, (_, i) => { const a = Math.PI * .25 + i / 18 * Math.PI; return V.P(x + r * Math.cos(a), y + r * Math.sin(a), zz); }); o += `<path d="${line(e)}" fill="none" stroke="${rgba(mix(KNIT, PAL.cream, .45), .8)}" stroke-width="${f1(2.6 * V.px)}" stroke-dasharray="${f1(5 * V.px)} ${f1(4 * V.px)}"/>`; }
  sc.add(`<g opacity="${a.toFixed(2)}">${o}</g>`, 60, 'air');
}
// hot dog: coral sausage on a saffron bun, lying along x; z = bun bottom
function hotdog(sc, s) {
  const V = sc.V, [x, y] = s, z = s.z, Lh = 1.5, r = .2, a = s.alpha ?? 1;
  const bun = K.slabSvg(V, { x: x - Lh / 2 - .08, y: y - .27, z, w: Lh + .16, d: .54, h: .2, r: .22, color: mix(PAL.saffron, PAL.cream, .2) });
  const sau = K.cylSvg(V, { c: [x + Lh / 2, y, z + .2 + r * .8], r, h: Lh, axis: 'x', color: PAL.coral });
  const sh = Math.max(0, 1 - (z - ZT) / 3); if (sh > 0) K.shadow(sc, x + .15, y + .2, ZT + .06, .7, .28 * sh);
  sc.add(`<g opacity="${a.toFixed(2)}">${bun}${sau}</g>`, 61, 'air');
}
const tick = (sc, [x, y], col, a = 1, s = 34) => sc.add(`<path d="M${f1(x - s * .5)},${f1(y)}L${f1(x - s * .12)},${f1(y + s * .4)}L${f1(x + s * .6)},${f1(y - s * .5)}" fill="none" stroke="${rgba(col, a)}" stroke-width="${f1(7 * sc.V.px)}" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>`, 0, 'hud');
const cross = (sc, [x, y], col, a = 1, s = 26) => sc.add(`<path d="M${f1(x - s)},${f1(y - s)}L${f1(x + s)},${f1(y + s)}M${f1(x + s)},${f1(y - s)}L${f1(x - s)},${f1(y + s)}" stroke="${rgba(col, a)}" stroke-width="${f1(7 * sc.V.px)}" stroke-linecap="round"/>`, 0, 'hud');
const crosshair = (sc, p, col, a = 1, s = 30) => { const [x, y] = sc.V.P(p); sc.add(`<g opacity="${a.toFixed(2)}" filter="url(#glow)"><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s * .62)}" fill="none" stroke="${col}" stroke-width="${f1(4 * sc.V.px)}"/><path d="M${f1(x - s * 1.25)},${f1(y)}H${f1(x - s * .3)}M${f1(x + s * .3)},${f1(y)}H${f1(x + s * 1.25)}M${f1(x)},${f1(y - s * 1.25)}V${f1(y - s * .3)}M${f1(x)},${f1(y + s * .3)}V${f1(y + s * 1.25)}" stroke="${col}" stroke-width="${f1(4 * sc.V.px)}" stroke-linecap="round"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(4.5 * sc.V.px)}" fill="${col}"/></g>`, 0, 'top'); };
const ripple = (sc, p, t, t0, col = PAL.sky, n = 3) => { if (t < t0 || t > t0 + 1.6) return; K.rings(sc, { p, n, r: 1.5, r0: .2, color: col, phase: (t - t0) * .8, alpha: 1 - prog(t, t0 + 1.1, t0 + 1.6), w: 3.2, layer: 'fx' }); };
const full = () => ({ h: .09 });

// ============================================================================================================================
// CARD 1  GLOVE vs HOT DOG: the glove presses the dark glass -> nothing; the hot dog touches it -> ripples + the screen lights
function card1() {
  const w = win('GLOVE vs HOT DOG'), at = w.at, end = w.end, tG = W(1, 'gloves'), tH = W(1, 'hot');
  const keys = [{ t: at, pts: [...PHP(0, 1.15), [0, 0, 2.2]], zoom: .95 }, { t: tH - .2, pts: [...PHP(0, .95), [0, 0, 1.6]], zoom: 1.05 }];
  return { tag: 'GLOVE vs HOT DOG', at, end, seed: 11, keys, stills: [tG + .45, tH + .2, tH + .6], draw(sc, t) {
    const V = sc.V, lit = pin01(t, tH + .15, .35), gz = ZT + 3.6 * (1 - io(t, tG - .1, .35)) + 3.6 * io(t, tG + .75, .4);
    phoneWorld(sc, t, { lit });
    if (t < tG + 1.2) finger(sc, Object.assign([-.4, -.6], { z: gz, glove: true }));
    if (t > tG + .25 && t < tG + .95) { const a = bell(t, tG + .25, .7); cross(sc, V.P(-.4, -.6, ZT + .2), PAL.ember, a); hud(sc, V.P(-.4, -.6, ZT), 'NOTHING', { color: PAL.ember, dy: 70, alpha: a }); }
    const hz = ZT + .02 + 3.2 * (1 - io(t, tH - .2, .35)), hx = .3 + 1.6 * (1 - io(t, tH - .2, .35));
    if (t > tH - .25) hotdog(sc, Object.assign([hx, .5], { z: hz }));
    ripple(sc, [.3, .5, ZT + .06], t, tH + .15);
    if (t > tH + .2) hud(sc, V.P(.3, .5, ZT), 'TAP!', { color: PAL.mint, dy: 76, alpha: pin01(t, tH + .2, .25) });
  } };
}

// CARD 2  SALTY WATER: three circuits (battery -> wire -> object -> bulb); finger + hot dog fill with salty water and pass the charge; wool blocks it
function card2() {
  const w = win('SALTY WATER'), at = w.at, end = w.end, tS = W(4, 'salty'), tH = W(4, 'hot'), tC = W(4, 'carries');
  const XS3 = [-3.4, 0, 3.4], OBJ = ['FINGER', 'HOT DOG', 'WOOL'], IB = { x: -5.4, y: -2.2, w: 10.8, d: 4.6, r: 1, th: 1 };
  const path = X => [[X - 1.1, -1.1], [X - 1.1, .55], [X, .55], [X + 1.1, .55], [X + 1.1, -1.1], [X - 1.1, -1.1]];
  const along = (ps, f) => { const seg = ps.slice(1).map((p, i) => Math.hypot(p[0] - ps[i][0], p[1] - ps[i][1])), T = seg.reduce((a, b) => a + b); let d = f * T; for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const k = d / seg[i]; return [lerp(ps[i][0], ps[i + 1][0], k), lerp(ps[i][1], ps[i + 1][1], k)]; } d -= seg[i]; } return ps[ps.length - 1]; };
  const keys = [{ t: at, pts: [[-5, -1.6, 0], [5, 1.8, 0], [-5, 1.8, 0], [5, -1.6, 0], [0, 0, 2]], zoom: 1 }];
  return { tag: 'SALTY WATER', at, end, seed: 12, keys, box: { x: 26, y: 96, w: 920, h: 380 }, stills: [tS + .8, tH + .6, tC + .7, tC + 1.2], draw(sc, t) {
    const V = sc.V; K.island(sc, { ...IB, seed: 3, tufts: 18 });
    const flow = pin01(t, tC, .3);
    XS3.forEach((X, k) => {
      const ps = path(X); sc.add(`<path d="${line(ps.map(p => V.P(p[0], p[1], .03)))}" fill="none" stroke="${mix(PAL.ink, PAL.cream, .25)}" stroke-width="${f1(5 * V.px)}" stroke-linejoin="round"/>`, -5, 'floor');
      K.box(sc, { x: X - 1.38, y: -1.35, w: .56, d: .5, h: .42, color: PAL.saffron }); const bt = V.P(X - 1.1, -1.1, .42); sc.add(`<text x="${f1(bt[0])}" y="${f1(bt[1] + 3)}" text-anchor="middle" font-family="Geist Mono, monospace" font-weight="700" font-size="40" fill="${PAL.ink}">+</text>`, 0, 'top');
      const water = k === 0 ? 1.15 * io(t, tS, .7) : k === 1 ? .42 * io(t, tH, .6) : 0;
      if (k === 0) finger(sc, Object.assign([X, .55], { z: .02, r: .36, L: 1.35, water, t }));
      if (k === 1) { hotdog(sc, Object.assign([X, .55], { z: .02 })); if (water > .02) { const p = V.P(X - .55, .55, .42), q = V.P(X + .75, .55, .42); sc.add(`<path d="M${pt(p)}L${pt(q)}" stroke="${rgba(PAL.sky, .8)}" stroke-width="${f1(9 * V.px * water / .42)}" stroke-linecap="round"/>`, 70, 'air'); } }
      if (k === 2) { K.slab(sc, { x: X - .45, y: .2, z: .02, w: .9, d: .7, h: .75, r: .25, color: KNIT }); for (let s = 1; s <= 3; s++) { const a = V.P(X - .45, .9, .02 + s * .19), b = V.P(X + .45, .9, .02 + s * .19); sc.add(`<path d="M${pt(a)}L${pt(b)}" stroke="${rgba(mix(KNIT, PAL.cream, .5), .85)}" stroke-width="${f1(2.6 * V.px)}" stroke-dasharray="${f1(5 * V.px)} ${f1(4 * V.px)}"/>`, 80, 'air'); } }
      const on = k < 2 ? flow : 0, bp = V.P(X + 1.1, -1.1, .85); K.cyl(sc, { c: [X + 1.1, -1.1, .55], r: .06, h: .55, color: PAL.cream });
      sc.add(`<circle cx="${f1(bp[0])}" cy="${f1(bp[1])}" r="${f1(19 * V.px)}" fill="${on > .05 ? mix(PAL.shade, PAL.saffron, on) : PAL.shade}" stroke="${rgba(PAL.cream, .8)}" stroke-width="${f1(2.4 * V.px)}"${on > .05 ? ' filter="url(#glow2)"' : ''}/>`, 0, 'top');
      if (t > tC) for (let n = 0; n < 6; n++) { let f = ((t - tC) * .45 + n / 6) % 1; if (k === 2) f = Math.min(f, .3 - n * .012); const p = along(ps, f); K.packet(sc, [p[0], p[1], .06], [p[0], p[1], .06], 1, { color: PAL.saffron, r: 6 }); }
      if (k === 2 && t > tC + .5) cross(sc, V.P(X - .7, .55, 1.05), PAL.ember, pin01(t, tC + .5, .25), 20);
      hud(sc, V.P(X, 1.1, 0), OBJ[k], { color: k === 2 ? PAL.violet : k === 1 ? PAL.coral : PAL.cream, dy: 52 });
    });
    if (t > tS + .2) hud(sc, [V.W / 2, V.H - 34], 'SALTY WATER CONDUCTS', { color: PAL.sky, alpha: pin01(t, tS + .2, .3) });
  } };
}

// CARD 3  UNDER THE GLASS: the glass lifts off; invisible wires shimmer; 10 rows slide in, then 6 columns; the 60 crossings blink; glass settles
function card3() {
  const w = win('UNDER THE GLASS'), at = w.at, end = w.end, tG = W(6, 'glass'), tI = W(6, 'invisible'), tR = W(6, 'rows'), tC = W(6, 'columns'), tP = W(7, 'graph');
  const keys = [{ t: at, pts: [...PHP(0, 1.1), [0, 0, 1.9]], zoom: .95 }, { t: tR - .3, pts: [...PHP(0, .92), [0, 0, 1.7]], zoom: 1 }];
  return { tag: 'UNDER THE GLASS', at, end, seed: 13, keys, stills: [tG + .7, tI + .4, tR + .6, tC + .6, tP + .3], draw(sc, t) {
    const V = sc.V, lift = io(t, tG, .7) * (1 - io(t, tP + .45, .6)), sh = t > tI && t < tR ? .25 + .2 * Math.sin((t - tI) * 9) : 0;
    phoneWorld(sc, t, { lift, grid: t > tR ? 1 : sh, rowsK: j => t > tR ? ease.p3out(prog(t, tR + j * .07, tR + j * .07 + .4)) : 1, colsK: i => t < tR ? 1 : t > tC ? ease.p3out(prog(t, tC + i * .08, tC + i * .08 + .4)) : 0,
      blink: c => t > tP ? bell(t, tP + (c.i + c.j) * .045, .35) : 0 });
    if (t > tR + .2 && t < tC + .2) hud(sc, V.P(1.6, -2.25, ZG), 'ROWS', { color: PAL.sky, dx: 60, dy: -30, alpha: pin01(t, tR + .2, .25) });
    if (t > tC + .2) hud(sc, V.P(-1.25, 2.6, ZG), 'COLUMNS', { color: PAL.violet, dy: 50, alpha: pin01(t, tC + .2, .25) });
    if (t > tG + .3 && t < tR) hud(sc, V.P(PH.x, 0, ZT + 1.6 * lift), 'GLASS', { color: PAL.cream, dx: -70, dy: -24, alpha: pin01(t, tG + .3, .25) });
  } };
}

// CARD 4  CHARGE + CHECK: a saffron scan bar charges each row's crossings (pucks rise), a mint bar checks them, then both flicker 100+ times a second
function card4() {
  const w = win('CHARGE + CHECK'), at = w.at, end = w.end, tH = W(8, 'hundreds'), tCh = W(8, 'charges'), tK = W(8, 'checks'), tHu = W(8, 'hundred');
  const keys = [{ t: at, pts: [...PHP(0, .95), [0, 0, 1.2]], zoom: 1 }, { t: tCh - .2, pts: PHP(0, .82), zoom: 1 }];
  const barY = (t, t0, d = 1.1) => lerp(-2.6, 2.6, prog(t, t0, t0 + d));
  return { tag: 'CHARGE + CHECK', at, end, seed: 14, keys, stills: [tH + .4, tCh + .6, tK + .5, tHu + .5], draw(sc, t) {
    const V = sc.V, fast = t > tHu - .1, fy = fast ? lerp(-2.6, 2.6, ((t - tHu) * 3.2) % 1) : null;
    phoneWorld(sc, t, { grid: 1, blink: c => t > tH && t < tCh ? bell(t, tH + c.j * .05, .4) : 0,
      puck: c => { const charged = t > tCh && barY(t, tCh) > c.y; const chk = t > tK && barY(t, tK) > c.y && barY(t, tK) < c.y + .45; return charged ? { h: .09 * ease.p3out(clampP(t, tCh, c)), col: chk ? PAL.mint : PAL.saffron } : null; } });
    const bar = (y, col, a = 1) => { if (y < -2.55 || y > 2.55) return; K.beam(sc, [-1.55, y, ZG + .25], [1.55, y, ZG + .25], { color: col, alpha: .95 * a, w: 6, layer: 'fx' }); };
    if (!fast) { if (t > tCh && t < tCh + 1.2) bar(barY(t, tCh), PAL.saffron); if (t > tK && t < tK + 1.2) bar(barY(t, tK), PAL.mint); }
    else { bar(fy, PAL.saffron); bar(fy - 1.6 < -2.6 ? fy + 3.6 : fy - 1.6, PAL.mint, .9); }
    if (t > tH) hud(sc, [V.W / 2, V.H - 34], t > tHu ? `${Math.round(120 * ease.p3out(prog(t, tHu, tHu + .9)))} x / SEC` : '60 HERE · 100s REAL', { color: t > tHu ? PAL.mint : PAL.saffron, alpha: pin01(t, tH, .3) });
  } };
}
const clampP = (t, t0, c) => prog(t, t0 + (c.y + 2.6) / 5.2 * 1.1, t0 + (c.y + 2.6) / 5.2 * 1.1 + .25);

// CARD 5  THE DIP: the finger lands; charge dots fly from the 4 nearest crossings into it; those pucks shrink coral; rings = dip; finger lifts, crosshair
function card5() {
  const w = win('THE DIP'), at = w.at, end = w.end, tF = W(9, 'finger'), tS = W(10, 'steals'), tD = W(10, 'dip'), tY = W(10, "that's"), FX = 0, FY = 0, N4 = near(FX, FY, 4);
  const keys = [{ t: at, pts: [...PHP(0, .9), [0, 0, 1.4]], zoom: 1 }, { t: tS - .2, pts: [[-1.2, -1.2, 0], [1.2, 1.2, 0], [-1.2, 1.2, 0], [1.2, -1.2, 0], [0, 0, 1.2]], zoom: .95 }];
  const isN = c => N4.some(n => n.i === c.i && n.j === c.j);
  return { tag: 'THE DIP', at, end, seed: 15, keys, stills: [tF + .5, tS + .8, tD + .4, tY + .5], draw(sc, t) {
    const V = sc.V, dip = io(t, tS + .2, 1.2), fz = ZT + .03 + 3.8 * (1 - io(t, tF - .25, .5)) + 4 * io(t, tY, .55);
    phoneWorld(sc, t, { grid: 1, puck: c => isN(c) ? { h: .09 * (1 - .6 * dip), col: mix(PAL.saffron, PAL.coral, dip) } : full() });
    if (t > tS && t < tY + .3) for (const c of N4) for (let n = 0; n < 2; n++) { const k = ((t - tS) * 1.3 + n * .5) % 1; K.packet(sc, [c.x, c.y, ZG + .18], [FX, FY, ZT + .9], k, { color: PAL.saffron, r: 5.5 }); }
    finger(sc, Object.assign([FX, FY], { z: fz }));
    if (t > tD) { for (const c of N4) K.rings(sc, { p: [c.x, c.y, ZG], n: 2, r: .38, r0: .08, color: PAL.coral, phase: (t - tD) * 1.2, alpha: pin01(t, tD, .2), w: 3, layer: 'fx' }); hud(sc, V.P(.75, .25, ZG), 'DIP', { color: PAL.coral, dx: 70, alpha: pin01(t, tD, .25) }); }
    if (t > tY + .25) { crosshair(sc, [FX, FY, ZG], PAL.mint, pin01(t, tY + .25, .25)); hud(sc, V.P(FX, FY, ZG), 'TOUCH', { color: PAL.mint, dy: 80, alpha: pin01(t, tY + .35, .25) }); }
  } };
}

// CARD 6  THE MIDDLE: the contact patch covers 4 crossings; dip bars sized by overlap; lines pull to one weighted point BETWEEN the wires
function card6() {
  const w = win('THE MIDDLE'), at = w.at, end = w.end, tB = W(11, 'bigger'), tC = W(12, 'covers'), tP = W(12, 'picks'), PC = [.1, .14], N4 = near(PC[0], PC[1], 4);
  const wt = N4.map(c => Math.max(.12, 1 - Math.hypot(c.x - PC[0], c.y - PC[1]) / .62)), sw = wt.reduce((a, b) => a + b), M = [N4.reduce((a, c, k) => a + c.x * wt[k], 0) / sw, N4.reduce((a, c, k) => a + c.y * wt[k], 0) / sw];
  const keys = [{ t: at, pts: [[-1.3, -1.3, 0], [1.3, 1.3, 0], [-1.3, 1.3, 0], [1.3, -1.3, 0], [0, 0, 1]], zoom: 1 }, { t: tC - .2, pts: [[-.8, -.8, 0], [.9, .9, 0], [-.8, .9, 0], [.9, -.8, 0], [0, 0, 1]], zoom: .9 }];
  return { tag: 'THE MIDDLE', at, end, seed: 16, keys, stills: [tB + .4, tC + .6, tP + .25, tP + .7], draw(sc, t) {
    const V = sc.V, cov = io(t, tC, .5), pk = io(t, tP, .35), pa = pin01(t, tB - .1, .35);
    phoneWorld(sc, t, { grid: 1, puck: c => { const k = N4.findIndex(n => n.i === c.i && n.j === c.j); return k < 0 ? full() : { h: .09 * (1 - .6 * cov * wt[k]), col: mix(PAL.saffron, PAL.coral, cov) }; } });
    if (pa > 0) { const e = Array.from({ length: 40 }, (_, i) => V.P(PC[0] + .5 * Math.cos(i / 40 * 6.283), PC[1] + .42 * Math.sin(i / 40 * 6.283), ZT + .07)); sc.add(`<path d="${poly(e)}" fill="${rgba(PEACH, .5 * pa)}" stroke="${rgba(PEACH, .95 * pa)}" stroke-width="${f1(3 * V.px)}"/>`, 40, 'air'); }
    if (cov > 0) N4.forEach((c, k) => { const h = .9 * wt[k] * cov; K.box(sc, { x: c.x - .06, y: c.y - .06, z: ZG, w: .12, d: .12, h, color: PAL.coral, layer: 'air', depth: 100 + V.dep(c.x, c.y, 0) }); });
    if (pk > 0) { N4.forEach((c, k) => K.beam(sc, [c.x, c.y, ZG + .9 * wt[k]], [lerp(c.x, M[0], pk), lerp(c.y, M[1], pk), lerp(ZG + .9 * wt[k], ZG, pk)], { color: PAL.mint, alpha: .95, w: 5, layer: 'fx' })); }
    if (pk >= 1) { crosshair(sc, [M[0], M[1], ZG], PAL.mint, pin01(t, tP + .35, .2)); hud(sc, V.P(M[0], M[1], ZG), 'MIDDLE', { color: PAL.mint, dy: 84, alpha: pin01(t, tP + .4, .25) }); }
    if (cov > 0 && pk < 1) hud(sc, [V.W / 2, V.H - 34], 'COVERS 4 CROSSINGS', { color: PAL.coral, alpha: cov * (1 - pk) });
  } };
}

// CARD 7  NO PRESS: light tap and a hard squash give the SAME dip (meter); then the finger fills with water and the charge flows into it
function card7() {
  const w = win('NO PRESS'), at = w.at, end = w.end, tN = W(14, 'not'), tA = W(14, 'all'), tW = W(14, 'water'), N4 = near(0, 0, 4);
  const keys = [{ t: at, pts: [[-1.6, -1.6, 0], [1.6, 1.6, 0], [-1.6, 1.6, 0], [1.6, -1.6, 0], [0, 0, 1.6]], zoom: .95 }];
  return { tag: 'NO PRESS', at, end, seed: 17, keys, stills: [tN + .2, tA + .35, tW + .4], draw(sc, t) {
    const V = sc.V, touch = t > tN - .05, hard = io(t, tA - .1, .25) * (1 - io(t, tW - .2, .3)), z = touch ? ZT + .03 : ZT + 1.5, dip = touch ? 1 : 0;
    phoneWorld(sc, t, { grid: 1, puck: c => N4.some(n => n.i === c.i && n.j === c.j) ? { h: .09 * (1 - .6 * dip), col: dip ? PAL.coral : PAL.saffron } : full() });
    if (t > tW) for (const c of N4) { const k = ((t - tW) * 1.4) % 1; K.packet(sc, [c.x, c.y, ZG + .1], [0, 0, ZT + .8], k, { color: PAL.saffron, r: 5.5 }); }
    finger(sc, Object.assign([0, 0], { z, squash: 1 + .5 * hard, water: t > tW ? 2.2 * io(t, tW, .6) : 0, t }));
    const mx = V.W - 92, my0 = 120, mh = 250; sc.add(`<rect x="${mx - 22}" y="${my0}" width="44" height="${mh}" rx="10" fill="${rgba(PAL.ink, .9)}" stroke="${rgba(PAL.cream, .7)}" stroke-width="2"/><rect x="${mx - 14}" y="${f1(my0 + mh - 8 - (mh - 16) * .62 * dip)}" width="28" height="${f1((mh - 16) * .62 * dip)}" rx="6" fill="${PAL.coral}"/>`, 0, 'hud');
    hud(sc, [mx, my0 + mh + 34], 'DIP', { color: PAL.coral, align: 'c' });
    if (t > tA) hud(sc, [V.W / 2 - 60, V.H - 34], 'PRESS: IGNORED', { color: PAL.ember, alpha: pin01(t, tA, .25) * (1 - prog(t, tW - .2, tW)) });
    if (t > tW) hud(sc, [V.W / 2 - 60, V.H - 34], 'IT FEELS WATER', { color: PAL.sky, alpha: pin01(t, tW, .25) });
  } };
}

// CARD 8  WOOL = NOBODY: the glove lands; charge dots rise, hit the wool and bounce back (ember sparks); pucks stay full; the glove fades to a ghost
function card8() {
  const w = win('WOOL = NOBODY'), at = w.at, end = w.end, tG = W(15, 'gloves'), tD = W(16, "doesn't"), tN = W(16, 'glove'), N4 = near(0, 0, 4);
  const keys = [{ t: at, pts: [...PHP(0, .7), [0, 0, 1.8]], zoom: .95 }, { t: tD - .2, pts: [[-1.4, -1.4, 0], [1.4, 1.4, 0], [-1.4, 1.4, 0], [1.4, -1.4, 0], [0, 0, 1.5]], zoom: .95 }];
  return { tag: 'WOOL = NOBODY', at, end, seed: 18, keys, stills: [tG + .5, tD + .6, tD + 1.3, tN + .5], draw(sc, t) {
    const V = sc.V, gz = ZT + .03 + 3.6 * (1 - io(t, tG - .1, .45)), ghost = io(t, tN, .5);
    phoneWorld(sc, t, { grid: 1, puck: full });
    if (t > tD && t < tN + .6) for (const c of N4) for (let n = 0; n < 2; n++) { const k = ((t - tD) * 1.2 + n * .5) % 1, up = k < .5 ? k * 2 : 2 - k * 2; K.packet(sc, [c.x, c.y, ZG + .18], [lerp(c.x, 0, .6), lerp(c.y, 0, .6), ZT + .3], up, { color: PAL.saffron, r: 5.5 });
      if (Math.abs(k - .5) < .08) { const p = V.P(lerp(c.x, 0, .6), lerp(c.y, 0, .6), ZT + .3); sc.add(`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(9 * V.px)}" fill="${PAL.ember}" filter="url(#glow)"/>`, 0, 'fx'); } }
    if (ghost < 1) finger(sc, Object.assign([0, 0], { z: gz, glove: true, alpha: 1 - ghost }));
    if (ghost > 0) finger(sc, Object.assign([0, 0], { z: gz, ghost: true, alpha: ghost }));
    if (t > tD + .5 && t < tN) hud(sc, [V.W / 2, V.H - 34], 'NO DIP', { color: PAL.ember, alpha: pin01(t, tD + .5, .25) });
    if (t > tN + .2) hud(sc, [V.W / 2, V.H - 34], 'NOBODY THERE', { color: PAL.violet, alpha: pin01(t, tN + .2, .25) });
  } };
}

// CARD 9  WINTER: snow on the island; the hot dog taps twice, ripples, message bubbles pop on the screen; "SOUTH KOREA · 2010"
function card9() {
  const w = win('WINTER'), at = w.at, end = w.end, tH = W(17, 'hot'), tK = W(18, 'korea');
  const keys = [{ t: at, pts: [...PHP(0, 1.1), [0, 0, 2.2]], zoom: .95 }];
  const tap = t => Math.min(io(t, tH - .25, .25) * (1 - io(t, tH + .1, .2)) + io(t, tH + .35, .2) * (1 - io(t, tH + .6, .2)), 1);
  return { tag: 'WINTER', at, end, seed: 19, keys, stills: [tH + .2, tH + .9, tK + .4], draw(sc, t) {
    const V = sc.V;
    phoneWorld(sc, t, { lit: pin01(t, tH + .05, .3) * .8, snow: t * .9 });
    if (t > tH - .4) hotdog(sc, Object.assign([.6, .9], { z: ZT + .02 + 1.4 * (1 - tap(t)) + 2 * (1 - io(t, tH - .45, .25)) }));
    ripple(sc, [.6, .9, ZT + .06], t, tH + .05); ripple(sc, [.6, .9, ZT + .06], t, tH + .55);
    if (t > tH + .2) hud(sc, V.P(-.6, -1.6, ZT), 'hi', { color: PAL.sky, alpha: pin01(t, tH + .2, .2) });
    if (t > tH + .7) hud(sc, V.P(-.2, -.6, ZT), 'it works', { color: PAL.mint, alpha: pin01(t, tH + .7, .2) });
    if (t > tK) hud(sc, [V.W / 2, V.H - 34], 'SOUTH KOREA · 2010', { color: PAL.cream, alpha: pin01(t, tK, .3) });
  } };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// the layout switch re-frames the scene, so a card enters/leaves ON a shot cut when one is close
const cuts = (E.shots || []).map(x => x.t0).filter(x => x > 0);
const snap = (t, lo, hi) => { const c = cuts.filter(x => x >= t - lo && x <= t + hi).sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0]; return c ?? t; };
export const CARDS = [card1(), card2(), card3(), card4(), card5(), card6(), card7(), card8(), card9()].map(c => ({ ...c, at: snap(c.at, .35, .05), end: snap(c.end, .4, .1) })).map(c => ({ ...c, stills: c.stills.filter(x => x > c.at + .3 && x < c.end - .35) }));
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
