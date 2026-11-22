// compress MG: nine iso cards (STORYBOARD.md) built from mg/isokit. Every card is its own small floating world and a pure function of global episode time t.
// Word times come from shots.json at load time (W(line, word)). Engine contract (engine/mg-adapter.js): default export (mg, {ratio}) adds mg.beat()s; 9:16 uses 'float'.
// Text rule: every label is >= 28 px at 1080 width (hud size 34 * px .85 = 28.9 px).
import { PAL, mix, rgba, f1, pt, poly, line, rng, createScene } from '../../mg/isokit/core.js';
import * as K from '../../mg/isokit/prims.js';
import { background } from '../../mg/isokit/stage.js';
import { ease, prog } from '../../mg/isokit/motion.js';
import { camRig, viewAt } from '../../mg/isokit/camera.js';

const E = await (await fetch(new URL('./shots.json', import.meta.url))).json();
const BE = await (await fetch(new URL('./mg.beats.json', import.meta.url))).json();
const win = n => { const c = BE.cues.find(x => x.name === n); if (!c) throw new Error('compress mg: no beat ' + n); return c; };
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const W = (line, word, nth = 0) => { const c = E.words.filter(w => w.line === line && norm(w.w) === norm(word)); if (!c[nth]) throw new Error(`compress mg: no word "${word}" #${nth} in line ${line}`); return c[nth].s; };
const pin01 = (t, a, d = .5) => ease.p3out(prog(t, a, a + d));
const io = (t, a, d) => ease.p2io(prog(t, a, a + d));
const bell = (t, a, d) => Math.sin(Math.PI * prog(t, a, a + d));
const hud = (sc, a, text, o = {}) => K.hud(sc, a, text, { size: 34, ...o });          // 34 * .85 = 28.9 px
const lerp = (a, b, k) => a + (b - a) * k;
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const PATS = [PAL.coral, PAL.saffron, PAL.sky];                     // the three stripes of a "data" block
const MUD = mix(PAL.soil, PAL.saffron, .3);
const isl = (sc, x0, y0, x1, y1, seed, avoid) => K.island(sc, { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: .9, th: 1.1, seed, tufts: 10, avoid });
const corners = (x0, y0, x1, y1, z = 0) => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
// upright text pinned to a world point (sorted with the world so it sits on the box top)
const txt = (sc, p, str, o = {}) => { const a = sc.V.P(p), fs = (o.size ?? 44) * sc.V.px; sc.add(`<text x="${f1(a[0])}" y="${f1(a[1] + fs * .34)}" text-anchor="middle" font-family="Geist Mono, monospace" font-weight="500" font-size="${f1(fs)}" fill="${o.color || PAL.ink}" opacity="${(o.alpha ?? 1).toFixed(2)}">${str}</text>`, sc.V.dep(p) + .08, o.layer || 'world'); };
const dashFoot = (sc, x, y, w, d, a = .6, z = .02) => sc.add(`<path d="${poly([[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]].map(q => sc.V.P(q)))}" fill="none" stroke="${rgba(PAL.cream, a)}" stroke-width="${f1(2.6 * sc.V.px)}" stroke-dasharray="${f1(9 * sc.V.px)} ${f1(7 * sc.V.px)}" stroke-linejoin="round"/>`, -.5, 'floor');
const tick = (sc, [x, y], col, a = 1, s = 34) => sc.add(`<path d="M${f1(x - s * .5)},${f1(y)}L${f1(x - s * .12)},${f1(y + s * .4)}L${f1(x + s * .6)},${f1(y - s * .5)}" fill="none" stroke="${rgba(col, a)}" stroke-width="${f1(7 * sc.V.px)}" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>`, 0, 'hud');
function eyeGlyph(sc, a, alpha = 1) {
  const [x, y] = a, w = 34 * sc.V.px, h = 17 * sc.V.px;
  sc.add(`<g opacity="${alpha.toFixed(2)}"><path d="M${f1(x - w)},${f1(y)}Q${f1(x)},${f1(y - h * 2)} ${f1(x + w)},${f1(y)}Q${f1(x)},${f1(y + h * 2)} ${f1(x - w)},${f1(y)}Z" fill="${PAL.cream}" stroke="${PAL.ink}" stroke-width="${f1(2 * sc.V.px)}"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(h * .85)}" fill="${PAL.violet}"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(h * .4)}" fill="${PAL.ink}"/></g>`, 0, 'hud');
}
// a striped "data" block (three coloured stripes on its +y face); pulse 0..1 lights the stripes towards cream and the top towards mint
function blk(sc, x, y, z, o = {}) {
  const V = sc.V, s = { x, y, z, w: o.w ?? .8, d: o.d ?? .8, h: o.h ?? .55 }, p = o.pulse ?? 0; if ((o.alpha ?? 1) < .02) return;
  s.color = o.color || mix(mix(PAL.violet, PAL.ink, .15), PAL.mint, p * .55); s.opacity = o.alpha;
  s.extra = [0, 1, 2].map(i => { const v0 = s.h * (.14 + i * .27), q = K.faceQuad(V, s, 'left', s.w * .08, v0, s.w * .92, v0 + s.h * .17); return `<path d="${poly(q)}" fill="${mix(PATS[i], PAL.cream, p * .8)}"/>`; }).join('');
  K.box(sc, s);
}
// a cream tile with upright text on top; k = pop scale 0..1
function tile(sc, cx, cy, z, label, o = {}) {
  const k = o.k ?? 1; if (k <= .02) return; const w = 1.3 * k, h = .35 * k, col = o.color || PAL.cream, lit = o.lit ?? 0;
  K.box(sc, { x: cx - w / 2, y: cy - w / 2, z, w, d: w, h, color: mix(col, PAL.mint, lit * .7), opacity: o.alpha });
  if (k > .55) txt(sc, [cx, cy, z + h], label, { size: 46 * k, color: PAL.ink, alpha: o.alpha ?? 1 });
}
// ---- pictures (sky, sun, hill): vector scene drawn flat on a slab. mode 'color' | 'gray'; dmg 0..1 adds mud blocks and shrinks the sun --------
function picture(sc, x, y, z, w, d, o = {}) {
  const V = sc.V, g = o.mode === 'gray', dmg = o.dmg ?? 0, pg = (u, v) => V.P(x + u * w, y + v * d, z + .16), R = rng(o.seed ?? 5);
  const C = g ? { sky: '#D5D5E6', gr: '#6B6B86', hill: '#9A9AB6', sun: '#FFFFFF' } : { sky: PAL.sky, gr: PAL.tealDeep, hill: PAL.mint, sun: PAL.saffron };
  if (!o.noBase) K.slab(sc, { x, y, z, w, d, h: .14, r: .12, color: g ? '#3A3A58' : PAL.cream, depth: o.depth });
  const q = pts => poly(pts.map(p => pg(...p))); let s = `<path d="${q([[.03, .04], [.97, .04], [.97, .64], [.03, .64]])}" fill="${C.sky}"/><path d="${q([[.03, .64], [.97, .64], [.97, .96], [.03, .96]])}" fill="${C.gr}"/>`;
  s += `<path d="${q([[.03, .96], [.03, .68], [.22, .5], [.42, .64], [.64, .42], [.88, .6], [.97, .52], [.97, .96]])}" fill="${C.hill}"/>`;
  const sc0 = pg(.74, .22), rr = .1 * V.s * (1 - .55 * dmg) * (g ? 1 : 1); s += `<ellipse cx="${f1(sc0[0])}" cy="${f1(sc0[1])}" rx="${f1(rr * 1.7)}" ry="${f1(rr * 1.7 * V.K)}" fill="${C.sun}"/>`;
  if (g) for (let i = 0; i < 9; i++) { const v = .08 + i * .065; s += `<path d="${line([pg(.05, v), pg(.95, v)])}" stroke="${rgba(PAL.cream, .5)}" stroke-width="${f1(1.5 * V.px)}"/>`; }
  const nm = Math.round(dmg * 26); for (let i = 0; i < nm; i++) { const u = .04 + R() * .84, v = .05 + R() * .84, sz = .06 + R() * .07; s += `<path d="${q([[u, v], [u + sz, v], [u + sz, v + sz * w / d], [u, v + sz * w / d]])}" fill="${rgba(MUD, .55 + R() * .3)}"/>`; }
  if (dmg > .05) s += `<path d="${q([[.03, .04], [.97, .04], [.97, .96], [.03, .96]])}" fill="${rgba(PAL.violet, .16 * dmg)}"/>`;
  sc.add(s, o.depth ?? V.dep(x + w / 2, y + d / 2, z + .16) + .02, 'world');
}

// ============================================================================================================================
// CARD 1  TEN TO TWO: a folder of ten striped blocks goes through the press; two blocks come out, eight leave dashed footprints that fill with the SAME stripes
const BX = i => -5.1 + (i % 5) * 1.05, BY = i => -1.3 + Math.floor(i / 5) * 1.3, KEPT = [4, 9], PAD = [[3.4, -1.3], [3.4, 0]];
function card1() {
  const w = win('TEN TO TWO'), at = w.at, end = w.end, tZ = W(1, 'zipped') + .7, tE = W(1, 'eight'), tN = W(2, 'nowhere'), tR = W(2, 'repeating');
  const keys = [{ t: at, pts: [...corners(-5.4, -2.4, 5.9, 2.2), [0, 0, 1.9]], zoom: .9 }];
  return { tag: 'TEN TO TWO', at, end, seed: 31, keys, stills: [tZ + .3, tE + .6, tN + .8, tR + 1.0], draw(sc, t) {
    const V = sc.V, tp = tZ + .35;   // press time
    isl(sc, -6.6, -3.2, 6.4, 3.0, 21, (x, y) => Math.abs(y) < 2.1 && x > -5.6);
    K.slab(sc, { x: 2.6, y: -2.0, w: 3.2, d: 3.3, z: 0, h: .12, r: .3, color: mix(PAL.violet, PAL.ink, .3) });
    // the press: two pillars and a bar that drops while the blocks pass
    const bar = 1.35 - .55 * bell(t, tp - .1, 1.1);
    K.box(sc, { x: .1, y: -2.3, z: 0, w: .4, d: .4, h: 1.7, color: PAL.violet }); K.box(sc, { x: .1, y: 1.6, z: 0, w: .4, d: .4, h: 1.7, color: PAL.violet });
    K.box(sc, { x: .1, y: -2.3, z: bar, w: .4, d: 4.3, h: .32, color: mix(PAL.violet, PAL.cream, .2) });
    const pulseAt = i => bell(t, tR + i * .11, .55);
    for (let i = 0; i < 10; i++) {
      const kept = KEPT.indexOf(i), x0 = BX(i), y0 = BY(i);
      if (kept >= 0) {
        const e = io(t, tZ + .1, 1.5), p = lerp3([x0, y0, 0], [PAD[kept][0], PAD[kept][1], .12], e);
        blk(sc, p[0], p[1], p[2], { pulse: pulseAt(i) });
      } else {
        const a = 1 - prog(t, tZ + .1, tZ + .7);
        if (a > .02) blk(sc, x0, y0, 0, { alpha: a, pulse: pulseAt(i) });
        else {
          dashFoot(sc, x0, y0, .8, .8, .55);
          const f = pin01(t, tN, .6); if (f > .02) sc.add([0, 1, 2].map(j => { const v = .12 + j * .27; return `<path d="${poly([[x0 + .06, y0 + .8 * v, .03], [x0 + .74, y0 + .8 * v, .03], [x0 + .74, y0 + .8 * (v + .17), .03], [x0 + .06, y0 + .8 * (v + .17), .03]].map(q => V.P(q)))}" fill="${mix(PATS[j], PAL.cream, pulseAt(i) * .8)}" opacity="${f.toFixed(2)}"/>`; }).join(''), -.4, 'floor');
        }
      }
    }
    if (t < tZ + .6) hud(sc, V.P(-3.0, -.7, 1.3), '10 GB', { color: PAL.saffron, alpha: 1 - prog(t, tZ + .1, tZ + .5) });
    if (t > tZ + 1.0) hud(sc, V.P(4.0, -.7, 1.3), '2 GB', { color: PAL.mint, alpha: pin01(t, tZ + 1.0, .3) });
    if (t > tE && t < tN + .3) hud(sc, V.P(-3.0, -.7, .6), '8 GB ?', { color: PAL.coral, alpha: pin01(t, tE, .3) * (1 - prog(t, tN, tN + .3)) });
    if (t > tR) hud(sc, V.P(-3.0, -.7, .6), 'SAME STRIPES', { color: PAL.mint, alpha: pin01(t, tR, .3) });
  } };
}
// ============================================================================================================================
// CARD 2  WRITE IT ONCE: six "la" tiles pop in with the spoken la's, a chip "la x6" slides in, the tiles fold into it, two bars compare 12 letters with 5
const TX = i => -5.4 + i * 1.7, TY = -2.3;
function card2() {
  const w = win('WRITE IT ONCE'), at = w.at, end = w.end, las = [0, 1, 2, 3, 4].map(i => W(4, 'la', i)), T = [las[0], (las[0] + las[1]) / 2, las[1], las[2], las[3], las[4]], tW = W(4, 'write'), tF = W(4, 'times'), tS = W(5, 'same');
  const keys = [{ t: at, pts: [...corners(-5.5, -2.4, 4.7, 1.9), [0, 0, 1.8]], zoom: .9 }];
  return { tag: 'WRITE IT ONCE', at, end, seed: 32, keys, stills: [T[2] + .5, T[5] + .6, tW + .9, tF + .5, tS + 1.2], draw(sc, t) {
    const V = sc.V; isl(sc, -6.9, -3.4, 5.1, 3.2, 22);
    const chipK = io(t, tW, .7), chipX = lerp(-9, -1.9, chipK), CY = .5, pops = ease.p3out(prog(t, tF + .9, tF + 1.2));   // chip slides in from the left, pulses when full
    for (let i = 0; i < 6; i++) {
      const ap = pin01(t, T[i], .22), fold = io(t, tF + i * .12, .55), bars = t > tS - .2; if (bars && fold >= 1) continue;
      const p = lerp3([TX(i) + .65, TY + .65, 0], [chipX + 1.65, CY + .65, .7], fold);
      tile(sc, p[0], p[1], p[2], 'la', { k: ap * (1 - .55 * fold), lit: bell(t, T[i], .6) * .5 });
    }
    if (t > tW) {   // the chip: saffron slab with "la x6"
      const full = prog(t, tF + .1, tF + 1.2), x = chipX, y = CY;
      K.box(sc, { x, y, z: 0, w: 3.3, d: 1.3, h: .55 + .08 * Math.sin(Math.PI * pops), color: mix(PAL.saffron, PAL.coral, .15) });
      txt(sc, [x + 1.65, y + .65, .6 + .08 * Math.sin(Math.PI * pops)], 'la x6', { size: 52, color: PAL.ink });
      if (full > .02 && full < 1) K.rings(sc, { p: [x + 1.65, y + .65, .6], n: 2, r: 2.0, r0: .6, color: PAL.saffron, phase: t * .9, alpha: Math.sin(Math.PI * full), w: 3 });
    }
    if (t > T[5] + .2 && t < tS) hud(sc, V.P(-.5, TY + .65, 1.4), '12 LETTERS', { color: PAL.coral, alpha: pin01(t, T[5] + .2, .3) * (1 - prog(t, tF + .2, tF + .8)) });
    if (t > tS - .2) {   // two bars: 12 cells (coral) vs 5 cells (mint)
      for (let r = 0; r < 2; r++) { const n = r ? 5 : 12, col = r ? PAL.mint : PAL.coral, y = TY + r * 1.15;
        for (let i = 0; i < n; i++) { const g = ease.p3out(prog(t, tS - .1 + i * .06 + r * .15, tS + .25 + i * .06 + r * .15)); K.box(sc, { x: -5.4 + i * .66, y, z: 0, w: .56, d: .56, h: .34 * g, color: col }); } }
      hud(sc, V.P(3.3, TY + .3, 1.2), '12 -> 5', { color: PAL.mint, alpha: pin01(t, tS + .6, .3) });
    }
  } };
}
// ============================================================================================================================
// CARD 3  UNZIP: the chip opens, the six tiles fly back out onto their ghosts, each locks with a tick: exactly the same
function card3() {
  const w = win('UNZIP'), at = w.at, end = w.end, tU = W(6, 'unzip'), tL = W(6, 'la'), tB = W(6, 'back');
  const keys = [{ t: at, pts: [...corners(-5.5, -2.4, 4.7, 1.9), [0, 0, 2.2]], zoom: .9 }];
  return { tag: 'UNZIP', at, end, seed: 33, keys, stills: [tU + .4, tU + 1.0, tL + .5, tB + .4], draw(sc, t) {
    const V = sc.V; isl(sc, -6.9, -3.4, 5.1, 3.2, 23);
    const open = io(t, tU, .35), CX = -1.9 + 1.65, CY = .5 + .65;
    for (let i = 0; i < 6; i++) dashFoot(sc, TX(i) + .1, TY + .1, 1.1, 1.1, .45);
    K.box(sc, { x: -1.9, y: .5, z: 0, w: 3.3, d: 1.3, h: .55, color: mix(PAL.saffron, PAL.coral, .15) });
    K.box(sc, { x: -1.9 - .05, y: .5 - .05, z: .55 + open * .55, w: 3.4, d: 1.4, h: .14, color: mix(PAL.saffron, PAL.cream, .3), opacity: 1 - open * .55 });   // the lid pops
    txt(sc, [CX, CY, .62], 'la x6', { size: 52, color: PAL.ink, alpha: 1 - open });
    for (let i = 0; i < 6; i++) {
      const e = io(t, tU + .25 + i * .13, .75), arc = Math.sin(Math.PI * e) * 1.7, p = lerp3([CX, CY, .5], [TX(i) + .65, TY + .65, 0], e);
      if (e > .01) tile(sc, p[0], p[1], p[2] + arc, 'la', { k: Math.min(1, e * 4), lit: bell(t, tL + i * .05, .5) * .4 });
      const tk = pin01(t, tL + .1 + i * .1, .25); if (tk > .02 && e >= 1) tick(sc, V.P(TX(i) + .65, TY + .65, .9), PAL.mint, tk, 30);
    }
    if (t > tB) hud(sc, V.P(-.9, TY + .65, 1.9), 'EXACT SAME', { color: PAL.mint, alpha: pin01(t, tB, .3) });
  } };
}
// ============================================================================================================================
// CARD 4  THROW IT AWAY: tiny detail specks shimmer over a picture, lift off into a bin, the file bar shrinks, the picture looks the same
function card4() {
  const w = win('THROW IT AWAY'), at = w.at, end = w.end, tS = W(8, 'sneakier'), tT = W(8, 'throw'), tA = W(8, 'away'), BIN = [4.0, 0.4, .1];
  const keys = [{ t: at, pts: [...corners(-4.6, -3.2, 5.0, 1.8), [0, 0, 2.4]], zoom: .9 }];
  const R = rng(9), SP = Array.from({ length: 30 }, () => [R(), R(), R()]);
  return { tag: 'THROW IT AWAY', at, end, seed: 34, keys, stills: [at + .7, tS + .6, tT + .6, tA + .5], draw(sc, t) {
    const V = sc.V; isl(sc, -6.4, -3.6, 6.4, 2.6, 24, (x, y) => x > 2.4 && x < 5.6 && y > -.9 && y < 1.7);
    const PX = -4.4, PY = -1.4, PW = 4.6, PD = 3.1; picture(sc, PX, PY, 0, PW, PD, { seed: 3 });
    // the bin
    K.box(sc, { x: 3.2, y: -.4, z: 0, w: 1.6, d: 1.6, h: 1.2, color: mix(PAL.violet, PAL.ink, .25) });
    const lid = io(t, tA, .5); K.box(sc, { x: 3.1, y: -.5, z: 1.2 + (1 - lid) * .9, w: 1.8, d: 1.8, h: .16, color: mix(PAL.violet, PAL.cream, .25) });
    // the file bar: ten cells; six of them go away with the specks
    for (let i = 0; i < 10; i++) { const gone = i >= 4 ? io(t, tT + .1 + (i - 4) * .09, .4) : 0; K.box(sc, { x: -4.4 + i * .62, y: -3.1, z: 0, w: .52, d: .52, h: .4 * (1 - gone), color: i < 4 ? PAL.mint : PAL.coral }); }
    // specks over the picture
    for (let i = 0; i < SP.length; i++) {
      const [a, b, c] = SP[i], e = io(t, tT + a * .6, 1.1), p0 = [PX + .25 + a * (PW - .5), PY + .25 + b * (PD - .5), .5], p = [lerp(p0[0], BIN[0] + .8, e), lerp(p0[1], BIN[1] + .8, e), lerp(p0[2], 1.4, e) + Math.sin(Math.PI * e) * 2.3];
      if (e >= 1) continue; const glow = pin01(t, tS, .4) * (.4 + .35 * Math.sin(t * 6 + c * 9)), q = V.P(p), col = [PAL.coral, PAL.saffron, PAL.sky, PAL.violet][i % 4];
      sc.add(`<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1((3.4 + c * 2.4) * V.px)}" fill="${rgba(col, e > 0 ? .95 : .35 + glow)}"/>`, V.dep(p) + .05, 'air');
    }
    if (t > tA) hud(sc, V.P(4.0, .4, 2.3), 'SMALLER FILE', { color: PAL.mint, alpha: pin01(t, tA, .3) });
  } };
}
// ============================================================================================================================
// CARD 5  BRIGHT VS COLOR: the picture splits into a crisp grey brightness layer and a colour layer; the colour is blurred (2x2 cells) and the layers drop back: looks the same
const CELL = [[.9, .8], [.62, .74], [.42, .7]];
function sceneCol(u, v) {   // colour of the scene at (u,v) in 0..1: sky / sun / hill / ground
  if (Math.hypot(u - .74, (v - .22) * .75) < .1) return PAL.saffron;
  const hl = v > .64 - Math.max(0, .22 * Math.sin(u * 6.2 + 1)) - (u > .5 ? .06 : 0);
  return v > .64 ? (hl && v > .66 ? PAL.mint : PAL.tealDeep) : (v > .5 && hl ? PAL.mint : PAL.sky);
}
function card5() {
  const w = win('BRIGHT VS COLOR'), at = w.at, end = w.end, tE = W(10, 'eyes'), tB = W(10, 'brightness'), tSh = W(10, 'sharply'), tC = W(10, 'color'), tK = W(10, 'keeps'), tBl = W(10, 'blurs'), tR = W(10, 'color', 1);
  const keys = [{ t: at, pts: [...corners(-5.0, -4.0, 4.6, 4.0), [0, 0, 2.5]], zoom: .9 }];
  const NX = 8, NY = 5;
  return { tag: 'BRIGHT VS COLOR', at, end, seed: 35, keys, stills: [tE + .6, tB + .9, tC + .5, tK + .4, tBl + .9, tR + .35], draw(sc, t) {
    const V = sc.V; isl(sc, -8.3, -3.6, 7.2, 3.8, 25);
    const split = io(t, tB, .7) * (1 - io(t, tR - .2, .6)), PW = 3.8, PD = 2.6, cx = 0, cy = 0, sh = split * 2.5;
    eyeGlyph(sc, V.P(-4.6, -.4, 1.0), pin01(t, at + .2, .4));
    if (split < .02) picture(sc, cx - PW / 2, cy - PD / 2, 0, PW, PD, { seed: 3 });
    else {
      // colour layer (right): cells; fine until "blurs", then 2x2 blocks
      const lx = cx - PW / 2 + sh, ly = cy - PD / 2 - sh, bl = pin01(t, tBl, .5);
      K.slab(sc, { x: lx, y: ly, z: 0, w: PW, d: PD, h: .14, r: .12, color: PAL.cream });
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const u0 = i / NX, v0 = j / NY, du = PW / NX, dv = PD / NY, fine = sceneCol(u0 + .5 / NX, v0 + .5 / NY), coarse = sceneCol((Math.floor(i / 2) * 2 + 1) / NX, (Math.floor(j / 2) * 2 + 1) / NY);
        const col = mix(fine, coarse, bl); sc.add(`<path d="${poly([[lx + i * du + .03, ly + j * dv + .03, .16], [lx + (i + 1) * du - .03, ly + j * dv + .03, .16], [lx + (i + 1) * du - .03, ly + (j + 1) * dv - .03, .16], [lx + i * du + .03, ly + (j + 1) * dv - .03, .16]].map(q => V.P(q)))}" fill="${col}"/>`, V.dep(lx + PW / 2, ly + PD / 2, .16) + .02, 'world');
      }
      if (bl > .02) for (let j = 0; j < NY; j += 2) for (let i = 0; i < NX; i += 2) { const du = PW / NX, dv = PD / NY, cw = Math.min(2, NX - i) * du, ch = Math.min(2, NY - j) * dv;
        sc.add(`<path d="${poly([[lx + i * du, ly + j * dv, .17], [lx + i * du + cw, ly + j * dv, .17], [lx + i * du + cw, ly + j * dv + ch, .17], [lx + i * du, ly + j * dv + ch, .17]].map(q => V.P(q)))}" fill="none" stroke="${rgba(PAL.cream, .75 * bl)}" stroke-width="${f1(2.2 * V.px)}"/>`, V.dep(lx + PW / 2, ly + PD / 2, .17) + .03, 'world'); }
      // grey layer (left, lifted)
      picture(sc, cx - PW / 2 - sh, cy - PD / 2 + sh, 1.1 * split, PW, PD, { mode: 'gray', seed: 4 });
      if (t > tK) tick(sc, V.P(cx - PW / 2 - sh + PW / 2, cy - PD / 2 + sh + PD / 2, 2.0), PAL.mint, pin01(t, tK, .3) * (1 - 0), 44);
    }
    if (t > tSh && t < tC) hud(sc, V.P(-2.6 - 0.2, 3.2, 1.0), 'SHARP', { color: PAL.cream, alpha: pin01(t, tSh, .25) });
    if (t > tC && t < tBl) hud(sc, V.P(3.2, -3.0, 1.0), 'COLOR', { color: PAL.sky, alpha: pin01(t, tC, .25) });
    if (t > tK && t < tR - .3) hud(sc, V.P(-2.6, 3.2, 1.0), 'KEEP', { color: PAL.mint, alpha: pin01(t, tK, .25) });
    if (t > tBl && t < tR - .3) hud(sc, V.P(3.2, -3.0, 1.0), 'BLUR', { color: PAL.coral, alpha: pin01(t, tBl, .25) });
    if (t > tR + .2) hud(sc, [V.W / 2, V.H - 40], 'LOOKS THE SAME', { color: PAL.mint, alpha: pin01(t, tR + .2, .2) });
  } };
}
// ============================================================================================================================
// CARD 6  HIDDEN SOUNDS: a loud bar throws a dome over its quiet neighbours; they dim to ghosts, then are deleted
const BAR_H = [.9, 1.0, .8, .6, .55, 3.2, .55, .6, .8, 1.0, .9, .7], BXx = i => -5.5 + i * .95, HID = [3, 4, 6, 7];
function card6() {
  const w = win('HIDDEN SOUNDS'), at = w.at, end = w.end, tD = W(12, 'drum'), tH = W(12, 'hides'), tN = W(12, 'never'), tM = W(12, 'deletes');
  const keys = [{ t: at, pts: [...corners(-5.7, -.9, 5.6, .9), [0, 0, 4.2]], zoom: .9 }];
  return { tag: 'HIDDEN SOUNDS', at, end, seed: 36, keys, stills: [tD + .5, tH + 1.0, tN + .4, tM + .45, tM + 1.1], draw(sc, t) {
    const V = sc.V; isl(sc, -6.9, -3.0, 5.8, 3.0, 26, (x, y) => Math.abs(y) < 1.2);
    const xd = BXx(5) + .3, dome = io(t, tH - .1, 1.3), curve = x => 3.9 * Math.exp(-(((x - xd) / 1.55) ** 2)) * dome;
    for (let i = 0; i < 12; i++) {
      const x = BXx(i), hid = HID.includes(i), appear = i === 5 ? ease.expoOut(prog(t, tD - .2, tD + .35)) : pin01(t, at + .1 + i * .05, .35), dim = hid ? io(t, tH + .5, .9) : 0, del = hid ? io(t, tM, .8 + (i % 3) * .1) : 0;
      const h = BAR_H[i] * appear * (1 - del), col = i === 5 ? PAL.coral : PAL.sky;
      if (h > .03) K.box(sc, { x, y: -.3, z: 0, w: .6, d: .6, h, color: mix(col, PAL.ink, dim * .45), opacity: 1 - dim * .6 });
      if (hid && dim > .05) dashFoot(sc, x, -.3, .6, .6, .5 * dim);
    }
    if (dome > .01) {
      const xs = Array.from({ length: 41 }, (_, k) => -5.8 + k * .3), top = xs.map(x => V.P(x, .6, curve(x))), base = xs.map(x => V.P(x, .6, 0)).reverse();
      sc.add(`<path d="${poly([...top, ...base])}" fill="${rgba(PAL.violet, .3)}" stroke="none"/><path d="${line(top)}" fill="none" stroke="${rgba(PAL.violet, .95)}" stroke-width="${f1(3 * V.px)}" stroke-linecap="round" stroke-dasharray="${f1(9 * V.px)} ${f1(6 * V.px)}"/>`, V.dep(0, .6, 1.5) + .1, 'air');
    }
    const pr = pin01(t, tD, .2) * (1 - prog(t, tD + 1.2, tD + 1.7)); if (pr > .02) K.rings(sc, { p: [xd, 0, 3.4 * pin01(t, tD, .4)], n: 3, r: 1.7, r0: .2, color: PAL.coral, phase: (t - tD) * .9, alpha: pr, w: 3 });
    if (t > tN && t < tM) hud(sc, V.P(BXx(5) + .3, .6, 2.2), 'HIDDEN', { color: PAL.violet, alpha: pin01(t, tN, .3) * (1 - prog(t, tM - .1, tM + .2)) });
    if (t > tM) hud(sc, V.P(BXx(5) + .3, .6, 2.2), 'DELETED', { color: PAL.saffron, alpha: pin01(t, tM, .3) });
  } };
}
// ============================================================================================================================
// CARD 7  TEN TIMES: a stack of ten song slabs vs one slab with the same waveform
function wave(sc, x, y, z, w, d, a, col) {
  const V = sc.V, pts = Array.from({ length: 28 }, (_, k) => { const u = k / 27, amp = .28 * Math.sin(u * 19) * (.5 + .5 * Math.sin(u * 5 + 1)) * (1 + .4 * a); return V.P(x + u * w, y + d / 2 + amp * d, z); });
  sc.add(`<path d="${line(pts)}" fill="none" stroke="${rgba(col, .95)}" stroke-width="${f1(3.2 * V.px)}" stroke-linejoin="round" stroke-linecap="round"/>`, V.dep(x + w / 2, y + d / 2, z) + .05, 'world');
}
function card7() {
  const w = win('TEN TIMES'), at = w.at, end = w.end, tT = W(14, 'ten'), tN = W(14, 'notice');
  const keys = [{ t: at, pts: [...corners(-4.8, -1.3, 4.7, 1.3), [0, 0, 4.0]], zoom: .9 }];
  return { tag: 'TEN TIMES', at, end, seed: 37, keys, stills: [at + .6, tT + .7, tN + .45], draw(sc, t) {
    const V = sc.V; isl(sc, -6.2, -3.0, 5.8, 3.0, 27, (x, y) => true);
    const SW = 2.6, SD = 1.9;
    for (let i = 0; i < 10; i++) { const a = pin01(t, at + .05 + i * .04, .3); if (a > .02) K.box(sc, { x: -4.6, y: -.9, z: i * .36, w: SW, d: SD, h: .3 * a, color: i % 2 ? PAL.sky : mix(PAL.sky, PAL.violet, .35) }); }
    wave(sc, -4.6, -.9, 3.62, SW, SD, 0, PAL.cream);
    const e = io(t, tT, .7); if (e > .01) { K.packet(sc, [-1.7, 0, 1.6], [1.4, 0, 1.6], Math.min(.98, e), { color: PAL.saffron, r: 8, tail: .2 }); K.box(sc, { x: 1.9, y: -.9, z: 0, w: SW, d: SD, h: .3 * e, color: PAL.sky }); wave(sc, 1.9, -.9, .31 * e, SW, SD, 0, PAL.cream); }
    if (t > tT + .2) hud(sc, V.P(3.1, 0, 1.4), '10x SMALLER', { color: PAL.saffron, alpha: pin01(t, tT + .2, .3), dy: -40 });
    if (t > tN) { const p = bell(t, tN, 1.2); K.rings(sc, { p: [-3.3, 0, 3.7], n: 2, r: 1.4, r0: .3, color: PAL.mint, phase: t, alpha: p, w: 3 }); K.rings(sc, { p: [3.2, 0, .35], n: 2, r: 1.4, r0: .3, color: PAL.mint, phase: t, alpha: p, w: 3 }); hud(sc, [V.W / 2, V.H - 40], 'SOUNDS THE SAME', { color: PAL.mint, alpha: pin01(t, tN, .25) }); }
  } };
}
// ============================================================================================================================
// CARD 8  COPY OF A COPY: five pictures in a chain, each save adds mud blocks and shrinks the sun
const CX8 = [-6.0, -3.5, -1.0, 1.5, 4.0];
function card8() {
  const w = win('COPY OF A COPY'), at = w.at, end = w.end, tC = W(16, 'close'), tS = W(16, 'save'), tA1 = W(16, 'again', 0), tA2 = W(16, 'again', 1), tP = W(16, 'photocopy', 0);
  const T = [at + .1, tS + .2, tA1 + .15, tA2 + .15, tP + .1], keys = [{ t: at, pts: [...corners(-6.3, -1.8, 6.4, .5), [0, 0, 1.6]], zoom: .9 }];
  return { tag: 'COPY OF A COPY', at, end, seed: 38, keys, stills: [tC + .6, tS + .7, tA2 + .6, tP + 1.0], draw(sc, t) {
    const V = sc.V; isl(sc, -7.3, -2.4, 6.9, 2.2, 28, (x, y) => true);
    for (let i = 0; i < 5; i++) {
      const a = pin01(t, T[i], .45); if (i > 0) { const k = prog(t, T[i] - .55, T[i] - .05); if (k > 0 && k < 1) K.packet(sc, [CX8[i - 1] + 1.05, -.6, .6], [CX8[i] + 1.05, -.6, .6], k, { color: PAL.saffron, r: 8, tail: .25 }); }
      if (a < .02) continue; const dm = [0, .22, .5, .76, 1][i];
      picture(sc, CX8[i], -1.5, 0, 2.1, 1.7, { dmg: dm * a, seed: 7 + i });
    }
    if (t > tC) hud(sc, V.P(CX8[0] + 1.05, -.6, .6), 'CLOSE ENOUGH', { color: PAL.mint, dy: 100, alpha: pin01(t, tC, .3) * (1 - prog(t, tS + .2, tS + .6)) });
    if (t > tP + .8) hud(sc, V.P(CX8[4] + 1.05, -.6, .6), 'COPY OF A COPY', { color: PAL.coral, dy: 100, alpha: pin01(t, tP + .8, .3), dx: -60 });
  } };
}
// ============================================================================================================================
// CARD 9  ZIP THE ZIP: a chain of crates through presses (2.0 -> 2.0 -> 2.1 GB, never 1 byte); then a packed suitcase that does not shrink under a heavy block
const CR = [-5.4, -3.0, -.6];
function card9() {
  const w = win('ZIP THE ZIP'), at = w.at, end = w.end, tZ = W(17, 'zip'), tW = W(17, 'whole'), tB = W(17, 'byte'), tTry = W(18, 'try'), tP = W(18, 'packed'), tSit = W(18, 'sit');
  const keys = [{ t: at, pts: [...corners(-5.8, -2.0, 2.6, 2.0), [0, 0, 2.6]], zoom: .9 }, { t: tTry + .75, pts: [...corners(5.8, -2.0, 10.8, 1.8), [8.5, 0, 4.4]], zoom: .9, dur: 1.0 }];
  return { tag: 'ZIP THE ZIP', at, end, seed: 39, keys, stills: [at + .6, tZ + .5, tB + .5, tTry + .45, tP + .5, tSit + .4], draw(sc, t) {
    const V = sc.V; isl(sc, -7.4, -2.8, 3.8, 2.8, 29, (x, y) => true); isl(sc, 4.8, -2.6, 12.2, 3.0, 30, (x, y) => x > 6.8 && x < 10.4 && Math.abs(y) < 1.6);
    const sizes = ['2.0 GB', '2.0 GB', t > tTry + .5 ? '2.2 GB' : '2.1 GB'], big = [1.2, 1.2, 1.2 + .22 * pin01(t, tW + .6, .5) + .22 * io(t, tTry + .3, .45)], gap = [tZ, tW];
    const crate = (i, a) => { const hh = big[i], x = CR[i], p = V.P(x + .7, 0, hh + .05);
      K.box(sc, { x, y: -.7, z: 0, w: 1.4, d: 1.4, h: hh, color: mix(i === 2 ? PAL.coral : PAL.saffron, PAL.ink, .15), opacity: a });
      const s = { x, y: -.7, z: 0, w: 1.4, d: 1.4, h: hh }; sc.add(K.faceQuad(V, s, 'left', .15, hh * .45, 1.25, hh * .62).length ? `<path d="${poly(K.faceQuad(V, s, 'left', .1, hh * .4, 1.3, hh * .55))}" fill="${PAL.cream}" opacity="${(.9 * a).toFixed(2)}"/>` : '', V.dep(x + .7, .7, hh / 2) + .04, 'world');
      hud(sc, V.P(x + .7, 0, hh + .2), sizes[i], { color: i === 2 ? PAL.coral : PAL.saffron, alpha: a }); };
    const show1 = t < tTry + 1.4;
    if (show1) {
    crate(0, 1);
    for (let i = 1; i < 3; i++) {
      const a = pin01(t, gap[i - 1] + .75, .3), px = CR[i - 1] + 1.2, k = prog(t, gap[i - 1] + .05, gap[i - 1] + .75);
      const dip = 1.45 - .55 * bell(t, gap[i - 1] + .25, .7) - (i === 2 ? .5 * bell(t, tTry + .1, .7) * 0 : 0);   // the press between crates i-1 and i
      K.box(sc, { x: px + .55, y: -1.6, z: 0, w: .3, d: .3, h: 1.7, color: PAL.violet }); K.box(sc, { x: px + .55, y: 1.3, z: 0, w: .3, d: .3, h: 1.7, color: PAL.violet });
      K.box(sc, { x: px + .55, y: -1.6, z: dip, w: .3, d: 3.2, h: .3, color: mix(PAL.violet, PAL.cream, .2) });
      if (k > 0 && k < 1) K.packet(sc, [CR[i - 1] + 1.4, 0, .7], [CR[i] + .2, 0, .7], k, { color: PAL.saffron, r: 8, tail: .2 });
      if (a > .02) crate(i, a);
    }
    if (t > tTry && t < tTry + 1.4) { const px = CR[1] + 1.2; K.rings(sc, { p: [CR[2] + .7, 0, 1.3], n: 2, r: 1.6, r0: .5, color: PAL.coral, phase: t * 1.2, alpha: bell(t, tTry, 1.4), w: 3 }); }
    // the dashed tiny crate "1 BYTE" that the chain never reaches
    if (t > tB - .3) { dashFoot(sc, 1.8, -.25, .5, .5, .9, .02); hud(sc, V.P(2.05, 0, .55), '1 BYTE ?', { color: PAL.cream, alpha: pin01(t, tB - .3, .3) * .95, dy: -40 }); }
    }
    // the suitcase island
    if (t > tTry + .6) {
      const a = pin01(t, tP - .05, .35), sx = 7.2, sy = -.9, drop = io(t, tSit - 1.0, .85), wz = lerp(4.4, 1.38, drop);
      K.box(sc, { x: sx, y: sy, z: 0, w: 2.8, d: 1.8, h: 1.35 * a, color: mix(PAL.coral, PAL.violet, .35) });
      const s = { x: sx, y: sy, z: 0, w: 2.8, d: 1.8, h: 1.35 * a };
      sc.add([0, 1, 2].map(i => `<path d="${poly(K.faceQuad(V, s, 'left', .2 + i * .85, .35, .9 + i * .85, .95))}" fill="${[PAL.saffron, PAL.sky, PAL.mint][i]}" opacity="${(.9 * a).toFixed(2)}"/>`).join('') + `<path d="${line([V.P(sx + .9, sy + .9, 1.35 * a), V.P(sx + .9, sy + .9, 1.9 * a), V.P(sx + 1.9, sy + .9, 1.9 * a), V.P(sx + 1.9, sy + .9, 1.35 * a)])}" fill="none" stroke="${PAL.cream}" stroke-width="${f1(5 * V.px)}" stroke-linecap="round"/>`, V.dep(sx + 1.4, sy + .9, .7) + .04, 'world');
      if (t > tSit - 1.1) K.box(sc, { x: sx + .3, y: sy + .2, z: wz, w: 2.2, d: 1.4, h: 1.0, color: mix(PAL.violet, PAL.ink, .2) });
      if (t > tSit - .05) hud(sc, V.P(sx + 1.4, sy + .9, 3.0), 'SAME SIZE', { color: PAL.mint, alpha: pin01(t, tSit - .05, .25) });
    }
  } };
}

// the layout switch re-frames the scene, so a card enters/leaves ON a shot cut when one is close
const cuts = (E.shots || []).map(x => x.t0).filter(x => x > 0);
const snap = (t, lo, hi) => { const c = cuts.filter(x => x >= t - lo && x <= t + hi).sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0]; return c ?? t; };
export const CARDS = [card1(), card2(), card3(), card4(), card5(), card6(), card7(), card8(), card9()].map(c => ({ ...c, at: snap(c.at, .35, .05), end: snap(c.end, .4, .1) })).map(c => ({ ...c, stills: c.stills.filter(x => x > c.at + .3 && x < c.end - .35) }));
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
