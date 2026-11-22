// cold_battery MG: six iso cards (STORYBOARD.md) built from mg/isokit. Every card is its own small floating world and a pure function of global episode time t.
// One recurring object: the battery cell (violet electrode, liquid trough, mint electrode); the liquid is sky when warm and amber ("honey") when cold.
// Word times come from shots.json at load time (W(line, word)). Engine contract (engine/mg-adapter.js): default export (mg, {ratio}) adds mg.beat()s; 9:16 uses 'float'.
// Text rule: every label is >= 28 px at 1080 width (hud size 34 * px .85 = 28.9 px).
import { PAL, mix, rgba, f1, pt, poly, line, rng, createScene } from '../../mg/isokit/core.js';
import * as K from '../../mg/isokit/prims.js';
import { background } from '../../mg/isokit/stage.js';
import { ease, prog } from '../../mg/isokit/motion.js';
import { camRig, viewAt } from '../../mg/isokit/camera.js';

const E = await (await fetch(new URL('./shots.json', import.meta.url))).json();
const BE = await (await fetch(new URL('./mg.beats.json', import.meta.url))).json();
const win = n => { const c = BE.cues.find(x => x.name === n); if (!c) throw new Error('cold_battery mg: no beat ' + n); return c; };
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const W = (line, word, nth = 0) => { const c = E.words.filter(w => w.line === line && norm(w.w) === norm(word)); if (!c[nth]) throw new Error(`cold_battery mg: no word "${word}" #${nth} in line ${line}`); return c[nth].s; };
const pin01 = (t, a, d = .5) => ease.p3out(prog(t, a, a + d));
const io = (t, a, d) => ease.p2io(prog(t, a, a + d));
const bell = (t, a, d) => Math.sin(Math.PI * prog(t, a, a + d));
const hud = (sc, a, text, o = {}) => K.hud(sc, a, text, { size: 34, ...o });          // 34 * .85 = 28.9 px
const lerp = (a, b, k) => a + (b - a) * k;
const frac = x => x - Math.floor(x);
const corners = (x0, y0, x1, y1, z = 0) => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
const isl = (sc, x0, y0, x1, y1, seed, avoid) => K.island(sc, { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: .9, th: 1.1, seed, tufts: 8, avoid });
const SKY = mix(PAL.sky, PAL.tealDeep, .2), AMBER = mix(PAL.saffron, PAL.soil, .42);   // the liquid: thin (warm) / honey (cold)
const txt = (sc, p, str, o = {}) => { const a = sc.V.P(p), fs = (o.size ?? 44) * sc.V.px; sc.add(`<text x="${f1(a[0])}" y="${f1(a[1] + fs * .34)}" text-anchor="middle" font-family="Geist Mono, monospace" font-weight="500" font-size="${f1(fs)}" fill="${o.color || PAL.ink}" opacity="${(o.alpha ?? 1).toFixed(2)}">${str}</text>`, sc.V.dep(p[0], p[1], p[2]) + .05, 'world'); };
const tick = (sc, [x, y], col, a = 1, s = 34) => sc.add(`<path d="M${f1(x - s * .5)},${f1(y)}L${f1(x - s * .12)},${f1(y + s * .4)}L${f1(x + s * .6)},${f1(y - s * .5)}" fill="none" stroke="${rgba(col, a)}" stroke-width="${f1(7 * sc.V.px)}" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>`, 0, 'hud');
// a lithium ion: cream ball with a violet rim and a tiny highlight
function ion(sc, x, y, z, o = {}) {
  const V = sc.V, a = o.alpha ?? 1, k = o.k ?? 1; if (a < .03 || k < .03) return; const p = V.P(x, y, z), r = .21 * V.s * k;
  sc.add(`<g opacity="${a.toFixed(2)}"><ellipse cx="${f1(p[0] + r * .3)}" cy="${f1(p[1] + r * 1.15)}" rx="${f1(r * .9)}" ry="${f1(r * .38)}" fill="${rgba(PAL.shade, .35)}"/><circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(r)}" fill="${o.color || PAL.cream}" stroke="${PAL.violet}" stroke-width="${f1(2.2 * V.px)}"/><circle cx="${f1(p[0] - r * .3)}" cy="${f1(p[1] - r * .3)}" r="${f1(r * .26)}" fill="#fff" opacity=".8"/></g>`, V.dep(x, y, z) + .02, 'world');
}
// integral of a speed function (cycles/s) from t0 to t, midpoint steps of 0.05 s (a pure function of t)
const integ = (t, t0, v) => { let s = 0; for (let a = t0; a < t; a += .05) s += v(Math.min(t, a + .025)) * Math.min(.05, t - a); return s; };
// ---- the battery cell -------------------------------------------------------------------------------------------------------------
// g: {xA left-electrode x, ew electrode width, xB right-electrode x, y0, d}; o: {level 0..1, col liquid colour, ph (train phase), show(i) 0..1 (pop-in), N}
const GEO = { xA: -5.8, ew: 1.2, xB: 2.4, y0: -1.9, d: 3.5 };
function cell(sc, t, g, o = {}) {
  const N = o.N ?? 12, z0 = o.z0 ?? 0, EH = 1.3, lv = o.level ?? 1, xT0 = g.xA + g.ew, xT1 = g.xB;
  K.box(sc, { x: g.xA, y: g.y0, z: z0, w: g.ew, d: g.d, h: EH, color: PAL.violet });
  K.box(sc, { x: g.xB, y: g.y0, z: z0, w: g.ew, d: g.d, h: EH, color: PAL.mint });
  K.slab(sc, { x: xT0, y: g.y0, z: z0, w: xT1 - xT0, d: g.d, h: .12, r: .15, color: mix(PAL.violet, PAL.ink, .45) });
  const lh = .42 * lv; if (lv > .02) K.slab(sc, { x: xT0 + .08, y: g.y0 + .08, z: z0 + .12, w: xT1 - xT0 - .16, d: g.d - .16, h: lh, r: .12, color: o.col || SKY, opacity: .94 });
  const zL = z0 + .12 + lh + .22, zE = z0 + EH + .24, sm = x => { const a = prog(x, xT0 - .5, xT0), b = prog(x, xT1, xT1 + .5); return Math.min(1, a * (1 - b)); };
  for (let i = 0; i < N; i++) {
    const shown = o.show ? o.show(i) : 1; if (shown < .02) continue;
    const lane = g.y0 + .5 + (i % 4) * (g.d - 1) / 3, raw = (o.ph ?? 0) - i * (o.gap ?? .075), moving = raw >= 0;
    const u = moving ? frac(raw) : 0, x = lerp(g.xA + g.ew / 2, g.xB + g.ew / 2, u), z = lerp(zE, zL, sm(x)) + (moving ? .1 * Math.sin(raw * 22 + i * 1.7) * sm(x) : 0);
    const fade = moving ? Math.min(1, (1 - u) / .06) * (o.steady ? 1 : Math.min(1, u / .03 + (raw > 1 ? 1 : 0))) : 1;
    ion(sc, moving ? x : g.xA + g.ew / 2 + ((i % 3) - 1) * .26, lane, moving ? z : zE, { k: shown, alpha: fade * (o.alpha ?? 1) });
  }
}
// a phone seen from the front: screen lit 0..1 (mint, glows: it is an emitter), optional text on the screen
function phoneP(sc, x, y, lit, o = {}) {
  const V = sc.V, w = o.w ?? 1.0, h = o.h ?? 1.7, B = { x: x - w / 2, y: y - .09, z: o.z ?? 0, w, d: .18, h, color: o.color || PAL.violet }, z0 = B.z;
  K.box(sc, B); const q = K.faceQuad(V, B, 'left', .07, .14, w - .07, h - .12);
  sc.add(`<path d="${poly(q)}" fill="${mix(PAL.ink, PAL.mint, .85 * lit)}"/>` + (lit > .05 ? `<path d="${poly(q)}" fill="${rgba(PAL.mint, .35 * lit)}" filter="url(#glow)"/>` : ''), V.dep(x, y, z0 + h / 2) + .03, 'world');
  if (o.text && lit > .3) txt(sc, [x, y + .1, z0 + h * .5], o.text, { size: o.ts ?? 34, color: PAL.ink, alpha: lit });
}
const wire = (sc, a, b, col = PAL.sky, sag = .25) => K.cable(sc, a, b, { color: col, w: 4, sag });
// snow crosses falling onto the island (deterministic)
function snow(sc, t, t0, a = 1) {
  const R = rng(77), V = sc.V; for (let i = 0; i < 26; i++) { const x = -6 + R() * 12, y = -2.6 + R() * 5, d0 = R() * 3, sp = .8 + R() * .7, zz = 4.2 - ((t - t0 + d0) * sp) % 4.3, r = (.09 + R() * .06) * V.s; if (t < t0 || zz < 0) continue;
    const p = V.P(x, y, zz); sc.add(`<path d="M${f1(p[0] - r)},${f1(p[1])}L${f1(p[0] + r)},${f1(p[1])}M${f1(p[0])},${f1(p[1] - r)}L${f1(p[0])},${f1(p[1] + r)}M${f1(p[0] - r * .7)},${f1(p[1] - r * .7)}L${f1(p[0] + r * .7)},${f1(p[1] + r * .7)}M${f1(p[0] - r * .7)},${f1(p[1] + r * .7)}L${f1(p[0] + r * .7)},${f1(p[1] - r * .7)}" stroke="${rgba(PAL.cream, a * .9)}" stroke-width="${f1(2 * V.px)}" stroke-linecap="round"/>`, 5000, 'air'); }
}
// thermometer: tube + mercury; k 0..1 = temperature (coral when hot, sky when cold)
function thermo(sc, x, y, k) {
  K.box(sc, { x: x - .22, y: y - .22, z: 0, w: .44, d: .44, h: 2.6, color: mix(PAL.cream, PAL.violet, .35) });
  K.box(sc, { x: x - .1, y: y - .1, z: .02, w: .2, d: .2, h: .3 + 2.0 * k, color: mix(PAL.sky, PAL.coral, k), rim: false });
  K.box(sc, { x: x - .36, y: y - .36, z: 0, w: .72, d: .72, h: .3, color: mix(PAL.sky, PAL.coral, k) });
}
// ten-cell charge gauge: n lit cells (mint), pulse 0..1 brightens
function gauge(sc, x0, y, lit, pulse = 0, z = 0) {
  for (let i = 0; i < 10; i++) { const on = i < lit; K.box(sc, { x: x0 + i * .75, y, z, w: .66, d: 1.8, h: on ? .95 : .55, color: on ? mix(PAL.mint, PAL.cream, .25 + pulse * .45) : mix(PAL.violet, PAL.ink, .35) }); }
}
const keysFor = (at, extra = 1.9) => [{ t: at, pts: [...corners(-6.6, -2.8, 6.9, 2.8), [0, 0, extra]], zoom: 1.04 }];

// ============================================================================================================================
// CARD 1  INSIDE THE BATTERY: liquid fills the trough, cream lithium ions pop in on the violet side, swim across to the mint side, the phone lights
function card1() {
  const w = win('INSIDE THE BATTERY'), at = w.at, end = w.end, tL = W(4, 'liquid'), tLi = W(4, 'lithium'), tS = W(4, 'swim'), tP = W(4, 'power'), G = GEO;
  const tag = t => t < tL ? 'INSIDE A BATTERY' : t < tLi ? 'LIQUID' : t < tP ? 'LITHIUM SWIMS' : 'POWER';
  return { tag, at, end, seed: 41, keys: keysFor(at), stills: [tL + .8, tLi + .9, tS + 1.5, tP + .6], draw(sc, t) {
    const V = sc.V; isl(sc, -7.0, -3.2, 7.0, 3.0, 41);
    const ph = t < tS ? 0 : integ(t, tS, u => .5 * ease.p2io(prog(u, tS, tS + .8))), lit = pin01(t, tP - .15, .45);
    cell(sc, t, G, { level: io(t, tL, .9), show: i => pin01(t, tLi + i * .08, .25), ph, N: 12 });
    wire(sc, [G.xB + G.ew / 2, 0, 1.3], [5.5, -.1, 1.0], PAL.sky, .3);
    phoneP(sc, 5.9, -.1, lit, { h: 1.9, w: 1.1 });
    if (lit > .05) K.rings(sc, { p: [5.9, .1, 2.2], n: 2, r: 1.8, r0: .5, color: PAL.mint, phase: t * .8, alpha: lit * .85, w: 3 });
    hud(sc, V.P(-1.2, .3, 1.1), 'LIQUID', { color: PAL.sky, alpha: pin01(t, tL + .2, .3) * (1 - prog(t, tLi - .1, tLi + .2)) });
    hud(sc, V.P(-3.0, .1, 1.9), 'LITHIUM', { color: PAL.cream, alpha: pin01(t, tLi, .3) * (1 - prog(t, tS + .6, tS + 1.0)) });
    hud(sc, V.P(5.9, .1, 3.5), 'POWER', { color: PAL.mint, alpha: pin01(t, tP, .3) });
  } };
}
// ============================================================================================================================
// CARD 2  FREEZE: snow, the mercury drops, the liquid darkens from sky to amber honey, the ions slow down to a crawl
function card2() {
  const w = win('FREEZE'), at = w.at, end = w.end, tF = W(6, 'freeze'), tTu = W(6, 'turns'), tTh = W(6, 'thick'), tHo = W(6, 'honey'), G = GEO;
  const tag = t => t < tTh ? 'FREEZE IT' : t < tHo ? 'THICK' : 'LIKE HONEY';
  return { tag, at, end, seed: 42, keys: keysFor(at), stills: [tF + .8, tTu + .5, tTh + .3, tHo + .2], draw(sc, t) {
    const V = sc.V; isl(sc, -7.0, -3.2, 7.0, 3.0, 42);
    const p = io(t, tTu - .2, 1.5), ph = 1.5 + integ(t, at, u => lerp(.5, .06, io(u, tF, 2.0))), cold = io(t, tF, 1.4);
    cell(sc, t, G, { level: 1, col: mix(SKY, AMBER, p), ph, N: 12, steady: true });
    // a slow honey thread hangs from the trough's front edge
    const hang = pin01(t, tTh - .4, 1.4); if (hang > .02) { const a = V.P(-1.4, 1.58, .5), b = V.P(-1.4, 1.7, .5 - 1.6 * hang * .9); sc.add(`<path d="M${pt(a)}L${pt(b)}" stroke="${AMBER}" stroke-width="${f1(8 * V.px)}" stroke-linecap="round"/><circle cx="${f1(b[0])}" cy="${f1(b[1])}" r="${f1(9 * V.px)}" fill="${mix(AMBER, PAL.saffron, .25)}"/>`, 3000, 'world'); }
    wire(sc, [G.xB + G.ew / 2, 0, 1.3], [5.1, -.1, 1.0], PAL.sky, .3);
    phoneP(sc, 5.5, -.1, 0, { h: 1.9, w: 1.1 });
    thermo(sc, 6.2, 2.1, .95 - .9 * cold);
    snow(sc, t, tF, pin01(t, tF, .4));
    hud(sc, V.P(6.2, 2.1, 3.5), 'FREEZE', { color: PAL.sky, alpha: pin01(t, tF + .1, .3) * (1 - prog(t, tTh - .2, tTh + .1)) });
    hud(sc, V.P(-1.2, .2, 1.4), 'THICK', { color: PAL.saffron, alpha: pin01(t, tTh, .3) * (1 - prog(t, tHo - .1, tHo + .2)) });
    hud(sc, V.P(-1.2, .2, 1.4), 'HONEY', { color: PAL.saffron, alpha: pin01(t, tHo, .3) });
  } };
}
// ============================================================================================================================
// CARD 3  TOO SLOW: the amber cell, ions crawling; the phone wants power now (tall coral NEED bar) but only a few ions arrive (short mint bar); the clock runs out
function card3() {
  const w = win('TOO SLOW'), at = w.at, end = w.end, tSl = W(8, 'slowly'), tW = W(8, 'wants'), tN = W(8, 'now'), tG = W(8, 'get'), tT = W(8, 'time'), G = GEO;
  const tag = t => t < tW ? 'SLOW SWIMMERS' : t < tT ? 'THE PHONE WANTS POWER' : 'NOT IN TIME';
  return { tag, at, end, seed: 43, keys: keysFor(at, 2.4), stills: [tSl + .5, tW + .9, tN + 1.0, tT + .3], draw(sc, t) {
    const V = sc.V; isl(sc, -7.0, -3.2, 7.0, 3.0, 43);
    const ph = 1.5 + integ(t, at, () => .07), need = io(t, tW, .9), got = .12 + .38 * io(t, tW + .6, tT - tW), lit = pin01(t, tW, .3) * .85;
    cell(sc, t, G, { level: 1, col: AMBER, ph, N: 12, steady: true });
    K.box(sc, { x: 4.0, y: -.7, z: 0, w: .55, d: .55, h: .05 + 2.6 * need, color: PAL.coral });
    K.box(sc, { x: 4.8, y: -.7, z: 0, w: .55, d: .55, h: .05 + got * 2.6 / 1.0 * .55, color: PAL.mint });
    wire(sc, [G.xB + G.ew / 2, 0, 1.3], [5.9, -.1, 1.0], PAL.sky, .3);
    phoneP(sc, 6.3, -.1, lit, { h: 1.9, w: 1.1 });
    for (let k = 0; k < 3; k++) { const a = pin01(t, tW + k * .12, .2) * (1 - prog(t, tT + .3, tT + .7)), s = frac3(t * 1.6 + k / 3); if (a > .02) K.arrow(sc, [5.6 - s * .2, 1.0, 1.2 + k * .55], [4.8 - s * .2, 1.0, 1.2 + k * .55], { color: PAL.coral, alpha: a, w: 3 }); }
    if (t > tW + .3) { const k = pin01(t, tW + .3, .4), ang = 2 * Math.PI * prog(t, tW + .4, tT + .2); K.clock(sc, { c: [-1.4, 1.8, 3.0], r: .9 * k, min: ang, hour: ang / 12, color: PAL.coral }); }
    hud(sc, V.P(-1.6, .3, 1.5), 'SLOW', { color: PAL.saffron, alpha: pin01(t, tSl, .3) * (1 - prog(t, tW - .1, tW + .2)) });
    hud(sc, V.P(4.3, -.4, 3.3), 'NEED', { color: PAL.coral, alpha: pin01(t, tW + .6, .3) });
    hud(sc, V.P(5.1, -.4, 1.2), 'GOT', { color: PAL.mint, alpha: pin01(t, tW + 1.0, .3), dy: -4 });
    hud(sc, V.P(-1.4, .4, 4.7), 'TOO LATE', { color: PAL.coral, alpha: pin01(t, tT - .05, .3) });
  } };
}
const frac3 = x => x - Math.floor(x);
// ============================================================================================================================
// CARD 4  STUCK: ten charge cells, three still lit; "where did it go" -> nowhere, it is still there; amber honey flows over the gauge and the ions around it stop moving
function card4() {
  const w = win('STUCK'), at = w.at, end = w.end, tWh = W(9, 'where'), tNo = W(10, 'nowhere'), tSt = W(10, 'stuck'), tHo = W(10, 'honey');
  const tag = t => t < tNo ? 'WHERE DID IT GO' : t < tSt ? 'STILL HERE' : 'STUCK IN THE HONEY';
  return { tag, at, end, seed: 44, keys: keysFor(at, 1.8), stills: [tWh + .5, tNo + .6, tSt + .4, tHo + .35], draw(sc, t) {
    const V = sc.V; isl(sc, -7.0, -3.2, 7.0, 3.0, 44);
    const pulse = bell(t, tNo, 1.0) + .4 * bell(t, tNo + 1.1, .9);
    gauge(sc, -5.4, -.9, 3, Math.min(1, pulse));
    phoneP(sc, 5.4, -.1, 0, { h: 1.9, w: 1.1 });
    const hon = io(t, tSt - .35, 1.3); if (hon > .02) K.slab(sc, { x: -5.8, y: -1.3, z: 0, w: 8.2, d: 2.6, h: .15 + .85 * hon, r: .5, color: AMBER, opacity: .62 * Math.min(1, hon * 2) });
    const frz = 1 - prog(t, tSt, tSt + .6); const R = rng(9);
    for (let i = 0; i < 9; i++) { const bx = -5.2 + i * .85, by = (i % 2 ? 1.3 : -1.3), j = (.3 * Math.sin(t * 3 + i * 1.9)) * frz; ion(sc, bx + j, by + j * .4, 1.3 + .3 * (i % 3) * .3, { alpha: .95 }); R(); }
    const q = pin01(t, tWh, .3) * (1 - prog(t, tNo, tNo + .25)); if (q > .02) txt(sc, [-4.0, -.9, 2.0], '?', { size: 96, color: PAL.coral, alpha: q });
    hud(sc, V.P(-1.2, -.9, 1.9), '30% ?', { color: PAL.coral, alpha: pin01(t, tWh, .3) * (1 - prog(t, tNo, tNo + .25)) });
    hud(sc, V.P(-1.2, -.9, 1.9), 'STILL HERE', { color: PAL.mint, alpha: pin01(t, tNo, .3) * (1 - prog(t, tSt - .05, tSt + .25)) });
    hud(sc, V.P(-1.2, -.9, 1.9), 'STUCK', { color: PAL.saffron, alpha: pin01(t, tSt, .3) });
  } };
}
// ============================================================================================================================
// CARD 5  VOLTAGE SAGS: weak push vs the warm push, the voltage bar drops below the shut-off line, the phone goes dark: shut off to stay safe
function card5() {
  const w = win('VOLTAGE SAGS'), at = w.at, end = w.end, tPu = W(12, 'push'), tVo = W(12, 'voltage'), tSg = W(12, 'sags'), tUn = W(12, 'under'), tSh = W(12, 'shuts'), tSf = W(12, 'safe');
  const G = { xA: -6.4, ew: 1.0, xB: -1.4, y0: -1.9, d: 3.5 };
  const tag = t => t < tVo ? 'WEAK PUSH' : t < tUn ? 'VOLTAGE SAGS' : t < tSh ? 'UNDER THE LINE' : 'SHUT OFF, SAFE';
  return { tag, at, end, seed: 45, keys: keysFor(at, 2.6), stills: [tPu + .7, tSg + .45, tUn + 1.0, tSh + .4, tSf + .35], draw(sc, t) {
    const V = sc.V; isl(sc, -7.2, -3.2, 7.0, 3.0, 45);
    const ph = 1.5 + integ(t, at, () => .07);
    cell(sc, t, G, { level: 1, col: AMBER, ph, N: 10, steady: true });
    const a1 = pin01(t, tPu - .1, .3) * (1 - prog(t, tSg, tSg + .3));
    if (a1 > .02) { K.arrow(sc, [-.2, -.5, 1.0], [.9, -.5, 1.0], { color: PAL.saffron, alpha: a1, w: 4 }); K.arrow(sc, [-.2, .8, 1.0], [2.0, .8, 1.0], { color: PAL.sky, alpha: a1 * .7, w: 3, dash: '10 8' }); }
    // tall voltage gauge: tube + bar + dashed shut-off line
    K.box(sc, { x: 2.5, y: -.6, z: 0, w: 1.2, d: 1.2, h: 3.4, color: mix(PAL.violet, PAL.ink, .35), opacity: .6 });
    const H = t < tSg ? 3.1 * pin01(t, tVo - .3, .35) : lerp(3.1, .8, io(t, tSg, .8)), bad = prog(t, tSg + .15, tSg + .75);
    if (H > .02) K.box(sc, { x: 2.65, y: -.45, z: .03, w: .9, d: .9, h: H, color: mix(PAL.mint, PAL.coral, bad) });
    const ln = pin01(t, tUn, .5); if (ln > .02) { const a = V.P(2.2, .65, 1.8), b = V.P(4.0, .65, 1.8); sc.add(`<path d="M${pt(a)}L${pt(b)}" stroke="${rgba(PAL.cream, ln)}" stroke-width="${f1(6 * V.px)}" stroke-dasharray="${f1(12 * V.px)} ${f1(8 * V.px)}" stroke-linecap="round"/>`, 4000, 'air'); }
    const on = 1 - io(t, tSh, .25), pl = t < tVo ? 0 : on;
    wire(sc, [3.1, 0, 3.4], [5.3, -.1, 1.2], PAL.sky, .35);
    phoneP(sc, 5.7, -.1, t < tPu ? .85 : on * .85, { h: 1.9, w: 1.1 });
    hud(sc, V.P(.6, .1, 2.5), 'WEAK PUSH', { color: PAL.saffron, alpha: pin01(t, tPu, .3) * (1 - prog(t, tSg - .1, tSg + .2)) });
    hud(sc, V.P(3.05, 0, 3.7), 'SAGS', { color: PAL.coral, alpha: pin01(t, tSg, .25) * (1 - prog(t, tUn - .1, tUn + .2)) });
    hud(sc, V.P(3.05, 0, 3.7), 'SHUT-OFF LINE', { color: PAL.cream, alpha: pin01(t, tUn + .1, .3) * (1 - prog(t, tSh - .1, tSh + .2)) });
    hud(sc, V.P(5.7, 0, 3.6), 'OFF', { color: PAL.coral, alpha: pin01(t, tSh, .25) * (1 - prog(t, tSf, tSf + .2)) });
    const sf = pin01(t, tSf, .3); if (sf > .02) { const c = V.P(5.7, .1, 1.1); tick(sc, c, PAL.mint, sf, 56); hud(sc, V.P(5.7, 0, 3.6), 'SAFE', { color: PAL.mint, alpha: sf }); }
    void pl;
  } };
}
// ============================================================================================================================
// CARD 6  WARM IT UP: a dark phone seen through: amber cell + three lit charge cells; heat waves rise, the liquid thins to sky, ions flow, the phone lights up
function card6() {
  const w = win('WARM IT UP'), at = w.at, end = w.end, tTy = W(13, 'thirty'), tWm = W(14, 'warm'), tThn = W(14, 'thins'), tCm = W(14, 'comes'), tBk = W(14, 'back');
  const G = { xA: -5.6, ew: .9, xB: 2.6, y0: -.3, d: 2.6 };
  const tag = t => t < tWm ? 'PHONE OFF, 30% INSIDE' : t < tThn ? 'WARM IT UP' : t < tCm ? 'THE HONEY THINS' : '30% IS BACK';
  return { tag, at, end, seed: 46, keys: keysFor(at, 2.0), stills: [tTy + .5, tWm + .9, tThn + .7, tBk + .35], draw(sc, t) {
    const V = sc.V; isl(sc, -7.0, -3.4, 7.0, 3.0, 46);
    const p = io(t, tThn - .15, 1.0), lit = pin01(t, tCm + .1, .5), warm = io(t, tWm, 2.0);
    K.slab(sc, { x: -6.4, y: -2.9, z: 0, w: 11.8, d: 5.8, h: .3, r: .6, color: mix(PAL.violet, PAL.ink, .55) });
    if (lit > .03) sc.add(`<path d="${poly([[-6.3, -2.8, .3], [5.3, -2.8, .3], [5.3, 2.8, .3], [-6.3, 2.8, .3]].map(q => V.P(q)))}" fill="${rgba(PAL.mint, .22 * lit)}" stroke="${rgba(PAL.mint, .9 * lit)}" stroke-width="${f1(5 * V.px)}" stroke-linejoin="round" filter="url(#glow)"/>`, 1500, 'world');
    const ph = 1.5 + integ(t, at, u => lerp(.05, .5, io(u, tThn - .15, 1.0)));
    cell(sc, t, G, { level: 1, col: mix(AMBER, SKY, p), ph, N: 12, steady: true, z0: .3 });
    gauge(sc, -5.6, -2.5, 3, bell(t, tTy, 1.0), .3);
    thermo(sc, 6.2, 1.6, .05 + .85 * warm);
    // heat waves rise under the cell
    if (t > tWm) for (let k = 0; k < 4; k++) { const a = pin01(t, tWm + k * .1, .4) * (1 - prog(t, tCm, tCm + .6)), x0 = -3.6 + k * 2.6; if (a < .02) continue; const pts = Array.from({ length: 12 }, (_, s) => V.P(x0 + .22 * Math.sin(s * .9 - t * 5 + k), 1.0 + .3 * k, 1.2 + s * .2 + frac3(t * .6 + k * .25) * .6));
      sc.add(`<path d="M${pts.map(pt).join('L')}" fill="none" stroke="${rgba(k % 2 ? PAL.coral : PAL.saffron, .7 * a)}" stroke-width="${f1(5 * V.px)}" stroke-linecap="round" stroke-linejoin="round"/>`, 4200, 'air'); }
    if (lit > .05) K.rings(sc, { p: [-.5, 0, 1.2], n: 2, r: 3.2, r0: .8, color: PAL.mint, phase: t * .7, alpha: lit * .8, w: 3 });
    hud(sc, V.P(-1.6, -1.8, 1.9), '30% INSIDE', { color: PAL.mint, alpha: pin01(t, tTy, .3) * (1 - prog(t, tWm + .3, tWm + .6)) });
    hud(sc, V.P(6.2, 1.6, 3.5), 'WARM', { color: PAL.coral, alpha: pin01(t, tWm + .1, .3) * (1 - prog(t, tThn + .3, tThn + .6)) });
    hud(sc, V.P(-1.5, .9, 2.0), 'THIN', { color: PAL.sky, alpha: pin01(t, tThn, .3) * (1 - prog(t, tCm + .3, tCm + .6)) });
    hud(sc, V.P(-1.6, -1.8, 1.9), '30% BACK', { color: PAL.mint, alpha: pin01(t, tCm + .3, .3) });
  } };
}

// the layout switch re-frames the scene, so a card enters/leaves ON a shot cut when one is close
const cuts = (E.shots || []).map(x => x.t0).filter(x => x > 0);
const snap = (t, lo, hi) => { const c = cuts.filter(x => x >= t - lo && x <= t + hi).sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0]; return c ?? t; };
export const CARDS = [card1(), card2(), card3(), card4(), card5(), card6()].map(c => ({ ...c, at: snap(c.at, .35, .05), end: snap(c.end, .4, .1) })).map(c => ({ ...c, stills: c.stills.filter(x => x > c.at + .3 && x < c.end - .35) }));
const NS = 'http://www.w3.org/2000/svg';
const tagHtml = fs => `position:absolute;left:${fs * 1.7}px;top:${fs * 1.4}px;display:flex;align-items:center;gap:${fs * .7}px;font:500 ${fs}px/1 'Geist Mono',monospace;letter-spacing:.14em;color:${rgba(PAL.cream, .92)};z-index:20;padding:${fs * .35}px ${fs * .6}px;margin:-${fs * .35}px 0 0 -${fs * .6}px;border-radius:${fs * .5}px;background:${PAL.bg0};box-shadow:0 0 0 1.5px ${rgba(PAL.cream, .16)}`; // tag above the world on an opaque pill
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
