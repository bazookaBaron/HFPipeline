// faceid MG: seven iso cards (STORYBOARD.md) built from mg/isokit. The subject is a FACE RELIEF: a plate of columns whose heights follow a face, seen from above
// in iso, so "depth" is literally hills and valleys. A phone on a small island fires the dots. Every card is a pure function of global episode time t.
// Word times come from shots.json (W(line, word)). Engine contract (engine/mg-adapter.js): default export (mg, {ratio}) adds mg.beat()s; 9:16 uses 'float'.
// Text rule: every label >= 28 px at 1080 width (hud size 34 * px .85 = 28.9 px).
// Colour: sky = infrared dots / the scan, mint = match / yours, saffron = the stored copy, coral = a stranger / mismatch, violet = valleys, ember = only "broken".
import { PAL, mix, rgba, f1, rng, createScene } from '../../mg/isokit/core.js';
import * as K from '../../mg/isokit/prims.js';
import { background } from '../../mg/isokit/stage.js';
import { ease, prog } from '../../mg/isokit/motion.js';
import { camRig, viewAt } from '../../mg/isokit/camera.js';

const E = await (await fetch(new URL('./shots.json', import.meta.url))).json();
const BE = await (await fetch(new URL('./mg.beats.json', import.meta.url))).json();
const win = n => { const c = BE.cues.find(x => x.name === n); if (!c) throw new Error('faceid mg: no beat ' + n); return c; };
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const W = (line, word, nth = 0) => { const c = E.words.filter(w => w.line === line && norm(w.w) === norm(word)); if (!c[nth]) throw new Error(`faceid mg: no word "${word}" #${nth} in line ${line}`); return c[nth].s; };
const pin01 = (t, a, d = .5) => ease.p3out(prog(t, a, a + d));
const io = (t, a, d) => ease.p2io(prog(t, a, a + d));
const hud = (sc, a, text, o = {}) => K.hud(sc, a, text, { size: 34, ...o });          // 34 * .85 = 28.9 px
const lerp = (a, b, k) => a + (b - a) * k;
const P2 = (sc, a) => (a.length === 3 ? sc.V.P(a) : a);
function eye(sc, a, k = 1, o = {}) {   // a watching eye (coral iris)
  if (k <= .01) return; const V = sc.V, p = P2(sc, a), s = k * (o.s ?? 1) * V.px * 1.1, w = 38 * s, h = 22 * s * (o.open ?? 1), x = p[0], y = p[1], ix = x + (o.look ?? 0) * w * .3;
  const d = `M${f1(x - w)},${f1(y)}Q${f1(x)},${f1(y - h * 1.8)} ${f1(x + w)},${f1(y)}Q${f1(x)},${f1(y + h * 1.8)} ${f1(x - w)},${f1(y)}Z`;
  sc.add(`<path d="${d}" fill="${PAL.cream}" stroke="${PAL.ink}" stroke-width="${f1(3 * s)}" stroke-linejoin="round"/><circle cx="${f1(ix)}" cy="${f1(y)}" r="${f1(h * .95)}" fill="${o.color || PAL.coral}"/><circle cx="${f1(ix)}" cy="${f1(y)}" r="${f1(h * .45)}" fill="${PAL.ink}"/><circle cx="${f1(ix - h * .3)}" cy="${f1(y - h * .3)}" r="${f1(h * .17)}" fill="${PAL.cream}"/>`, 0, 'hud');
}function tick(sc, a, k, col = PAL.mint, s = 34) { if (k <= .01) return; const V = sc.V, p = P2(sc, a); sc.add(`<path d="M${f1(p[0] - s * .5)},${f1(p[1])}L${f1(p[0] - s * .12)},${f1(p[1] + s * .4)}L${f1(p[0] + s * .6)},${f1(p[1] - s * .5)}" fill="none" stroke="${rgba(col, k)}" stroke-width="${f1(7 * V.px)}" stroke-linecap="round" stroke-linejoin="round"/>`, 0, 'hud'); }
function cross(sc, a, k, col = PAL.ember, s = 30) { if (k <= .01) return; const V = sc.V, p = P2(sc, a); sc.add(`<path d="M${f1(p[0] - s)},${f1(p[1] - s)}L${f1(p[0] + s)},${f1(p[1] + s)}M${f1(p[0] + s)},${f1(p[1] - s)}L${f1(p[0] - s)},${f1(p[1] + s)}" fill="none" stroke="${rgba(col, k)}" stroke-width="${f1(8 * V.px)}" stroke-linecap="round"/>`, 0, 'hud'); }// ---- glyphs (screen space) ------------------------------------------------------------------------------------------------------
function lock(sc, a, k = 1, open = 0, col = PAL.mint) {   // padlock; open 0..1 lifts the shackle
  if (k <= .01) return; const p = P2(sc, a), s = k * sc.V.px * 1.5, lift = open * 16;
  sc.add(`<g transform="translate(${f1(p[0])},${f1(p[1])}) scale(${f1(s)})"><path d="M-14,-6V${f1(-20 - lift)}a14,14 0 0 1 28,0V${f1(-6 - lift * .2 - (open > .5 ? 12 : 0))}" fill="none" stroke="${PAL.cream}" stroke-width="6" stroke-linecap="round"/><rect x="-22" y="-8" width="44" height="34" rx="7" fill="${col}" stroke="${PAL.ink}" stroke-width="3"/><circle cx="0" cy="8" r="5" fill="${PAL.ink}"/></g>`, 0, 'hud');
}
// ---- the face -------------------------------------------------------------------------------------------------------------------
const G = (u, v, cu, cv, su, sv, a) => a * Math.exp(-((u - cu) ** 2 / (2 * su * su) + (v - cv) ** 2 / (2 * sv * sv)));
// u right, v up, both -1..1. Returns height in "map units" 0..~1 (0 = floor / outside the head). Variants: me, stranger, twin, mask, flat.
function face(u, v, kind = 'me') {
  if (kind === 'flat') return 0;
  const wd = kind === 'stranger' ? .9 : .82, e = (u / wd) ** 2 + (v / .96) ** 2; if (e > 1) return 0;
  let h = .22 + .26 * Math.sqrt(1 - e);
  if (kind === 'stranger') {
    h += G(u, v, 0, -.02, .1, .36, .62) + G(u, v, 0, -.4, .17, .08, .22) + G(u, v, -.5, -.36, .2, .2, .14) + G(u, v, .5, -.36, .2, .2, .14) + G(u, v, 0, .44, .55, .07, .05)
      - G(u, v, -.34, .2, .1, .08, .3) - G(u, v, .34, .2, .1, .08, .3) + G(u, v, 0, -.84, .13, .12, .3);
  } else {
    h += G(u, v, 0, -.05, .09, .28, .55) + G(u, v, 0, -.30, .14, .07, .25) + G(u, v, -.42, -.22, .17, .17, .18) + G(u, v, .42, -.22, .17, .17, .18) + G(u, v, 0, .42, .55, .07, .12)
      - G(u, v, -.33, .25, .12, .07, .22) - G(u, v, .33, .25, .12, .07, .22) + G(u, v, 0, -.78, .2, .1, .2) - G(u, v, 0, -.55, .2, .04, .1);
  }
  h = Math.max(.1, h);
  if (kind === 'twin' && Math.abs(u - .55) < .08 && Math.abs(v + .5) < .07) h += .16;   // one column differs
  if (kind === 'mask') {   // smooth shell: about right, a few patches off, eye holes empty
    h = .22 + (h - .22) * .86 + G(u, v, -.45, -.5, .14, .12, .16) - G(u, v, .5, -.3, .13, .12, .1) + G(u, v, 0, .1, .1, .1, .1);
    if (((u + .33) / .1) ** 2 + ((v - .25) / .09) ** 2 < 1 || ((u - .33) / .1) ** 2 + ((v - .25) / .09) ** 2 < 1) return .02;
  }
  return Math.max(.08, h);
}
const HMAX = .95;
const HEAT = [[0, mix(PAL.violet, PAL.ink, .15)], [.3, PAL.sky], [.55, PAL.mint], [.78, PAL.saffron], [1, PAL.coral]];
function heat(hn) { hn = Math.min(1, Math.max(0, hn)); for (let i = 1; i < HEAT.length; i++) if (hn <= HEAT[i][0]) return mix(HEAT[i - 1][1], HEAT[i][1], (hn - HEAT[i - 1][0]) / (HEAT[i][0] - HEAT[i - 1][0])); return HEAT[HEAT.length - 1][1]; }
const loc = (c0, u, v, a) => [c0[0] + (u - v) * a, c0[1] + (-u - v) * a];   // cell units (centre origin) -> world xy; v is up on screen
const PLATE = (c0, N, M, a, hs = 1.5, z0 = 0) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([su, sv]) => { const q = loc(c0, su * N / 2, sv * M / 2, a); return [[q[0], q[1], z0], [q[0], q[1], z0 + hs * HMAX + .2]]; });
// a relief plate. o: {c0, N, M, a, kind, hs, z0, k2 (0..1 heat blend), cream, alpha, hi:(i,j,u,v,h)=>colour|null, dots:{k (bend 0..1), a:(i,j)=>0..1, col}, slab, edge}
function relief(sc, o) {
  const V = sc.V, { c0, N, M, a } = o, hs = o.hs ?? 1.5, z0 = o.z0 ?? 0, s = V.s, w = 2 * a * s * Math.SQRT1_2, tt = w * V.K, hz = h => h * s * V.ZF, k2 = o.k2 ?? 1, al = o.alpha ?? 1;
  if (al <= .01) return null; const pC = V.P(c0[0], c0[1], z0), Wd = N * w, Hh = M * tt, th = .42 * s * V.ZF * (a / .16 > .6 ? 1 : .6), pad = w * .5;
  let out = `<g opacity="${al.toFixed(3)}">`;
  if (o.slab !== false) {
    out += `<rect x="${f1(pC[0] - Wd / 2 - pad)}" y="${f1(pC[1] - Hh / 2 - pad + th)}" width="${f1(Wd + 2 * pad)}" height="${f1(Hh + 2 * pad)}" rx="${f1(w * 1.1)}" fill="${PAL.tealDeep}"/>`;
    out += `<rect x="${f1(pC[0] - Wd / 2 - pad)}" y="${f1(pC[1] - Hh / 2 - pad)}" width="${f1(Wd + 2 * pad)}" height="${f1(Hh + 2 * pad)}" rx="${f1(w * 1.1)}" fill="${o.slabCol || PAL.teal}" stroke="${rgba(o.edge || PAL.cream, o.edge ? .95 : .35)}" stroke-width="${f1((o.edge ? 3.2 : 1.5) * V.px)}"/>`;
  }
  const cells = [];
  for (let j = M - 1; j >= 0; j--) for (let i = 0; i < N; i++) {
    const u = i - (N - 1) / 2, v = j - (M - 1) / 2, uu = u / (N / 2), vv = v / (M / 2), h = face(uu, vv, o.kind || 'me') * hs; const q = loc(c0, u, v, a), p = V.P(q[0], q[1], z0); cells.push({ i, j, uu, vv, h, p });
    if (h <= 0) continue; const hn = h / hs / HMAX, hv = o.hi ? o.hi(i, j, uu, vv, h) : null;
    let c = hv || mix(mix(PAL.cream, PAL.violet, .12), heat(hn), k2); if (o.cream && !hv) c = mix(c, PAL.cream, o.cream);
    const topY = p[1] - hz(h), x0 = p[0] - w / 2;
    out += `<rect x="${f1(x0)}" y="${f1(topY + tt / 2)}" width="${f1(w + .6)}" height="${f1(hz(h) + .6)}" fill="${mix(c, PAL.ink, .4)}"/><rect x="${f1(x0)}" y="${f1(topY - tt / 2)}" width="${f1(w + .6)}" height="${f1(tt + .6)}" fill="${mix(c, PAL.cream, .1)}"/>`;
  }
  out += '</g>'; sc.add(out, o.depth ?? 0, o.layer || 'world');
  if (o.dots) {   // the infrared dot grid: flat on the plate (k = 0) or bent by the height under each dot (k = 1)
    const D = o.dots, kk = D.k ?? 0; let d = '', tr = '';
    for (const c of cells) { const da = D.a ? D.a(c.i, c.j) : 1; if (da <= .02) continue; const surf = [c.p[0] + c.h * s * .55, c.p[1] - hz(c.h)], flat = [c.p[0], c.p[1] - hz(c.h) * (D.lift ?? 0)];
      const x = flat[0] + (surf[0] - flat[0]) * kk, y = flat[1] + (surf[1] - flat[1]) * kk;
      if (kk > .02 && c.h > 0 && kk < .999) tr += `M${f1(flat[0])},${f1(flat[1])}L${f1(x)},${f1(y)}`;
      d += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1((D.r ?? 3.3) * V.px * (.4 + .6 * da))}" fill="${D.col || PAL.cream}" opacity="${da.toFixed(2)}"/>`; }
    sc.add(`${tr ? `<path d="${tr}" stroke="${rgba(PAL.sky, .55)}" stroke-width="${f1(1.4 * V.px)}" fill="none"/>` : ''}<g filter="url(#glow)">${d}</g>`, (o.depth ?? 0) + 1, 'fx');
  }
  const fpos = (uu, vv) => { const h = face(uu, vv, o.kind || 'me') * hs, q = loc(c0, uu * N / 2, vv * M / 2, a), p = V.P(q[0], q[1], z0); return [p[0], p[1] - hz(h)]; };
  return { fpos, pC, Wd, Hh, w, tt, top: pC[1] - Hh / 2 - pad, bot: pC[1] + Hh / 2 + pad + th, left: pC[0] - Wd / 2 - pad, right: pC[0] + Wd / 2 + pad };
}
const ringAt = (sc, p, r, k, col = PAL.sky) => { if (k <= .01) return; const V = sc.V, rr = r * V.px * (.6 + .4 * k); sc.add(`<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(rr * 1.35)}" ry="${f1(rr)}" fill="none" stroke="${rgba(col, Math.min(1, k * 1.4))}" stroke-width="${f1(4 * V.px)}" filter="url(#glow)"/>`, 0, 'hud'); };
const phoneIsland = (sc, u, seed = 90) => { K.island(sc, { x: u - 1.3, y: -u - 1.3, w: 2.6, d: 2.6, r: .7, th: 1.0, seed, tufts: 3 }); K.phone(sc, { p: [u, -u, .02], scale: 1.8, color: PAL.violet }); };
const UPH = -1.5, UPL = 1.6;   // phone island, relief plate centre (world u along the screen horizontal)
const N1 = 19, M1 = 21, A1 = .16, C1 = [UPL, -UPL];
const FIT1 = [[UPH - 1.5, -UPH + 1.5, 2.4], [UPH + 1.5, -UPH - 1.5, -1.6], ...PLATE(C1, N1, M1, A1)];
const phoneTop = (sc, z = 2.1) => sc.V.P(UPH, -UPH, z);
function lampCone(sc, t, tOn, geom) {   // light cone from the phone to the plate
  const V = sc.V, k = pin01(t, tOn, .5); if (k <= .01) return; const lamp = phoneTop(sc, 1.55), a = [geom.left + 4, geom.top + 6], b = [geom.left + 4, geom.bot - 40];
  sc.add(`<path d="M${f1(lamp[0])},${f1(lamp[1])}L${f1(a[0])},${f1(a[1])}L${f1(b[0])},${f1(b[1])}Z" fill="${rgba(PAL.sky, .1 * k)}" stroke="${rgba(PAL.sky, .5 * k)}" stroke-width="${f1(2 * V.px)}" stroke-dasharray="${f1(10 * V.px)} ${f1(8 * V.px)}" filter="url(#glow)"/>`, 0, 'fx');
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 1  THE DOTS: the phone fires a regular grid of invisible infrared dots at the face; counter runs to 30,000+
function card1() {
  const w = win('THE DOTS'), at = w.at, end = w.end, tTh = W(4, 'thirty'), tIn = W(4, 'invisible'), tDo = W(4, 'dots'), tFa = W(4, 'face'), tPh = W(5, 'photo');
  const keys = [{ t: at, pts: FIT1, zoom: 1.0 }];
  return { tag: 'THE DOTS', at, end, seed: 41, keys, stills: [tTh + .3, tIn + .4, tDo + .5, tFa + .3, tPh + .4], draw(sc, t) {
    const V = sc.V; phoneIsland(sc, UPH); const st = tTh - .15;
    const f = prog(t, st, tDo + .55), pour = (i, j) => ease.p2io(prog(f * 1.7 - (i / N1) * .7, 0, .3));
    const g = relief(sc, { c0: C1, N: N1, M: M1, a: A1, kind: 'me', k2: 0, cream: .2, dots: { k: 0, a: (i, j) => pour(i, j) * (.75 + .25 * Math.sin(t * 9 + i * 1.7 + j * 2.3)), col: PAL.sky, r: 3.4 } });
    lampCone(sc, t, st, g);
    const n = t < st ? 0 : Math.round(30000 * io(t, st, tFa - st + .1));
    if (t > st) hud(sc, [g.pC[0], g.top - 22], (n >= 30000 ? '30,000+' : n.toLocaleString('en-US')) + ' DOTS', { color: PAL.sky, alpha: pin01(t, st, .3) });
    const pt = V.P(UPH, -UPH, 0);
    if (t > tIn) hud(sc, [pt[0], pt[1] + 74 * V.px], 'INFRARED', { color: PAL.violet, textColor: PAL.cream, alpha: pin01(t, tIn, .3) });
    if (t > tIn + .25) hud(sc, [pt[0], pt[1] + 120 * V.px], 'INVISIBLE', { color: PAL.violet, textColor: PAL.cream, alpha: pin01(t, tIn + .25, .3) });
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 2  THE BEND: the camera watches the dots slide sideways by the height under them; the heights become a coloured depth map
function card2() {
  const w = win('THE BEND'), at = w.at, end = w.end, tCa = W(6, 'camera'), tBe = W(6, 'bend'), tNo = W(6, 'nose'), tCh = W(6, 'cheeks'), tCn = W(6, 'chin'), tMp = W(7, 'map'), tFc = W(7, 'face');
  const keys = [{ t: at, pts: FIT1, zoom: 1.0 }];
  return { tag: 'THE BEND', at, end, seed: 42, keys, stills: [tCa + .5, tBe + .6, tNo + .4, tCh + .5, tCn + .4, tMp + .5, tFc + .4], draw(sc, t) {
    const V = sc.V; phoneIsland(sc, UPH); const kb = io(t, tBe - .1, 1.5), km = io(t, tMp - .1, 1.0);
    const g = relief(sc, { c0: C1, N: N1, M: M1, a: A1, kind: 'me', k2: km, cream: .2 * (1 - km), dots: { k: kb, a: () => (1 - km * .85), col: PAL.sky, r: 3.4 } });
    const pt = V.P(UPH, -UPH, 0), ek = pin01(t, tCa, .4); eye(sc, [pt[0], pt[1] - 150 * V.px], ek, { color: PAL.sky, s: 1.0, look: 1 });
    if (t > tCa) hud(sc, [pt[0], pt[1] + 74 * V.px], 'CAMERA', { color: PAL.sky, alpha: pin01(t, tCa, .3) });
    const F = (uu, vv, tt, lab, dx, dy) => { const lt = prog(t, tt - .05, tt + .9); if (lt <= 0 || lt >= 1) return; const k = Math.sin(lt * Math.PI), p = g.fpos(uu, vv); ringAt(sc, p, 40, Math.min(1, k * 1.6)); hud(sc, [p[0] + dx * V.px, p[1] + dy * V.px], lab, { color: PAL.saffron, alpha: Math.min(1, k * 2) }); };
    F(0, -.12, tNo, 'NOSE', 0, -66); F(-.42, -.22, tCh, 'CHEEKS', -90, -20); F(0, -.78, tCn, 'CHIN', 0, 62);
    if (t > tMp) hud(sc, [g.pC[0], g.top - 22], 'DEPTH MAP', { color: PAL.mint, alpha: pin01(t, tMp, .3) });
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 3  THE MAP: hills and valleys; the phone stores the map once; each unlock a new scan is checked against it
function card3() {
  const w = win('THE MAP'), at = w.at, end = w.end, tDe = W(8, 'depth'), tHi = W(8, 'hills'), tVa = W(8, 'valleys'), tSt = W(8, 'stored'), tOn = W(8, 'once'), tCk = W(8, 'checks'), tUn = W(8, 'unlock');
  const keys = [{ t: at, pts: FIT1, zoom: 1.0 }];
  const SW = 1.1;   // one scan sweep
  return { tag: 'THE MAP', at, end, seed: 43, keys, stills: [tDe + .5, tHi + .4, tVa + .4, tSt + .5, tOn + .5, tCk + .8, tUn + .4], draw(sc, t) {
    const V = sc.V; phoneIsland(sc, UPH); const pt = V.P(UPH, -UPH, 0);
    const kst = io(t, tSt + .05, 1.0);   // the map shrinks into the phone
    const g = relief(sc, { c0: C1, N: N1, M: M1, a: A1, kind: 'me', k2: 1, alpha: 1 - .72 * kst });
    if (t > tDe) { const k = pin01(t, tDe, .4), x = g.right + 34 * V.px, y0 = g.top + 12, y1 = g.bot - 40, n = 28; let s = `<g opacity="${k.toFixed(2)}">`; for (let i = 0; i < n; i++) s += `<rect x="${f1(x - 12 * V.px)}" y="${f1(y0 + (y1 - y0) * i / n)}" width="${f1(24 * V.px)}" height="${f1((y1 - y0) / n + 1)}" fill="${heat(1 - i / (n - 1))}"/>`; sc.add(s + '</g>', 0, 'hud');
      hud(sc, [x - 12 * V.px, y0 - 10], 'HIGH', { color: PAL.coral, alpha: k, align: 'r' }); hud(sc, [x - 12 * V.px, y1 + 20], 'LOW', { color: PAL.violet, textColor: PAL.cream, alpha: k, align: 'r' }); }
    const R = (tt, uu, vv, lab, col, dx, dy) => { const lt = prog(t, tt - .05, tt + 1.1); if (lt <= 0 || lt >= 1) return; const k = Math.sin(lt * Math.PI), p = g.fpos(uu, vv); ringAt(sc, p, 36, Math.min(1, k * 1.6), col); hud(sc, [p[0] + dx * V.px, p[1] + dy * V.px], lab, { color: col, textColor: PAL.cream, alpha: Math.min(1, k * 2) }); };
    R(tHi, 0, -.12, 'HILL', PAL.coral, 0, -64); R(tVa, -.33, .25, 'VALLEY', PAL.violet, -70, -58);
    // stored copy: a mini map flies from the plate onto the phone and rests above it
    const ms = Math.max(0, kst), mc = [lerp(UPL, UPH, ms), -lerp(UPL, UPH, ms)], mz = Math.sin(ms * Math.PI) * 1.6 + ms * 2.9, ma = lerp(A1, .05, ms);
    if (t > tSt - .02) { relief(sc, { c0: mc, N: N1, M: M1, a: ma, kind: 'me', k2: 1, z0: mz, hs: 1.5, edge: PAL.saffron, slab: ms > .55, depth: 50, layer: 'air' });
      if (t > tSt + .9) hud(sc, [pt[0], pt[1] + 74 * V.px], 'STORED', { color: PAL.saffron, alpha: pin01(t, tSt + .9, .3) }); }
    // each unlock: a fresh scan bar sweeps the plate, then MATCH
    const nS = 3, ts0 = tCk - .05;
    for (let r = 0; r < nS; r++) { const a0 = ts0 + r * (SW + .1), kk = prog(t, a0, a0 + SW); if (kk <= 0 || kk >= 1) continue; const x = lerp(g.left, g.right, kk);
      sc.add(`<rect x="${f1(x - 6 * V.px)}" y="${f1(g.top)}" width="${f1(12 * V.px)}" height="${f1(g.bot - g.top - 30 * V.px)}" fill="${rgba(PAL.sky, .55)}" filter="url(#glow)"/>`, 0, 'fx'); }
    if (t > ts0 + SW) { tick(sc, [g.right - 40 * V.px, g.top + 30], pin01(t, ts0 + SW, .25), PAL.mint, 40); hud(sc, [g.pC[0], g.top - 22], 'MATCH', { color: PAL.mint, alpha: pin01(t, ts0 + SW, .25) }); }
    if (t > tUn - .1 && t > ts0 + SW) hud(sc, [g.pC[0], g.bot + 28], 'EVERY UNLOCK', { color: PAL.sky, alpha: pin01(t, tUn - .1, .3) });
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 4  NO DEPTH: a flat photo in front of the dots: they stay in a straight grid, the map is flat, nothing to match
function card4() {
  const w = win('NO DEPTH'), at = w.at, end = w.end, tPh = W(9, 'photo'), tWk = W(9, 'work'), tFl = W(10, 'flat'), tHi = W(10, 'hills'), tMp = W(10, 'map');
  const keys = [{ t: at, pts: FIT1, zoom: 1.0 }];
  return { tag: 'NO DEPTH', at, end, seed: 44, keys, stills: [tPh + .5, tWk + .3, tFl + .45, tHi + .3, tMp + .5], draw(sc, t) {
    const V = sc.V; phoneIsland(sc, UPH); const pt = V.P(UPH, -UPH, 0);
    const kp = pin01(t, at + .15, .5), kf = io(t, tFl - .1, .7);
    const g = relief(sc, { c0: C1, N: N1, M: M1, a: A1, kind: 'flat', k2: 1, hi: () => mix(PAL.cream, PAL.violet, kf * .85), dots: { k: 0, a: (i, j) => pin01(t, at + .6 + (i / N1) * .5, .2), col: PAL.sky, r: 3.2 } });
    if (kp > .01 && kf < .99) {   // the printed photo on the plate: a portrait card with a flat drawn face
      const cx = g.pC[0], cy = g.pC[1], pw = g.Wd * .62, ph = g.Hh * .78; let s = `<g opacity="${((1 - kf) * kp).toFixed(3)}" transform="translate(0,${f1((1 - kp) * -30)})"><rect x="${f1(cx - pw / 2)}" y="${f1(cy - ph / 2)}" width="${f1(pw)}" height="${f1(ph)}" rx="${f1(10 * V.px)}" fill="${PAL.cream}" stroke="${PAL.ink}" stroke-width="${f1(3 * V.px)}"/>`;
      const fc = [cx, cy - ph * .02], rx = pw * .27, ry = ph * .38; s += `<ellipse cx="${f1(fc[0])}" cy="${f1(fc[1])}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${mix(PAL.saffron, PAL.cream, .4)}" stroke="${PAL.ink}" stroke-width="${f1(2.5 * V.px)}"/><circle cx="${f1(fc[0] - rx * .4)}" cy="${f1(fc[1] - ry * .18)}" r="${f1(rx * .1)}" fill="${PAL.ink}"/><circle cx="${f1(fc[0] + rx * .4)}" cy="${f1(fc[1] - ry * .18)}" r="${f1(rx * .1)}" fill="${PAL.ink}"/><path d="M${f1(fc[0])},${f1(fc[1] - ry * .1)}l${f1(-rx * .08)},${f1(ry * .3)}h${f1(rx * .16)}" fill="none" stroke="${PAL.ink}" stroke-width="${f1(2.5 * V.px)}"/><path d="M${f1(fc[0] - rx * .38)},${f1(fc[1] + ry * .5)}q${f1(rx * .38)},${f1(ry * .22)} ${f1(rx * .76)},0" fill="none" stroke="${PAL.coral}" stroke-width="${f1(3.5 * V.px)}" stroke-linecap="round"/></g>`; sc.add(s, 5, 'top'); }
    if (t > tPh) hud(sc, [g.pC[0], g.top - 22], t > tFl ? 'FLAT MAP' : 'PHOTO', { color: t > tFl ? PAL.violet : PAL.sky, textColor: PAL.cream, alpha: pin01(t, tPh, .3) });
    relief(sc, { c0: [UPH, -UPH], N: N1, M: M1, a: .05, kind: 'me', k2: 1, z0: 2.9, hs: 1.65, edge: PAL.saffron, depth: 50, layer: 'air' });   // the stored map at the phone
    hud(sc, [pt[0], pt[1] + 74 * V.px], 'STORED', { color: PAL.saffron, alpha: 1 });
    if (t > tHi) { const gh = pin01(t, tHi - .05, .4); for (const [uu, vv, r] of [[0, -.1, 50], [-.4, -.2, 34], [.4, -.2, 34]]) { const p = g.fpos(uu, vv); sc.add(`<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(r * 1.35 * V.px)}" ry="${f1(r * V.px)}" fill="none" stroke="${rgba(PAL.saffron, .85 * gh)}" stroke-width="${f1(3.4 * V.px)}" stroke-dasharray="${f1(8 * V.px)} ${f1(7 * V.px)}"/>`, 0, 'hud'); } }
    if (t > tMp) { const kc = pin01(t, tMp, .3); cross(sc, [g.pC[0], g.pC[1]], kc, PAL.ember, 50); hud(sc, [g.pC[0], g.bot + 28], 'NO MAP', { color: PAL.ember, textColor: PAL.cream, alpha: kc }); }
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 5  THE MASK: a mask map is almost right but off in places; then the eyes check - the mask has none, a real face looks at the phone
function card5() {
  const w = win('THE MASK'), at = w.at, end = w.end, tMk = W(11, 'mask'), tGo = W(12, 'good'), tHd = W(12, 'hard'), tAn = W(12, 'and'), tEy = W(12, 'eyes'), tOp = W(12, 'open'), tLk = W(12, 'looking');
  const keys = [{ t: at, pts: FIT1, zoom: 1.0 }];
  const ref = (i, j) => { const uu = (i - (N1 - 1) / 2) / (N1 / 2), vv = (j - (M1 - 1) / 2) / (M1 / 2); return Math.abs(face(uu, vv, 'mask') - face(uu, vv, 'me')) > .09; };
  return { tag: 'THE MASK', at, end, seed: 45, keys, stills: [tMk + .4, tGo + .4, tHd + .4, tAn + .4, tEy + .5, tOp + .4, tLk + .6], draw(sc, t) {
    const V = sc.V; phoneIsland(sc, UPH); const kReal = io(t, tEy + .05, .8), real = kReal > .5;
    const kMap = io(t, tGo - .1, .8), kd = pin01(t, tHd, .5), pulse = .55 + .45 * Math.sin((t - tHd) * 9);
    const g = relief(sc, { c0: C1, N: N1, M: M1, a: A1, kind: real ? 'me' : 'mask', k2: real ? 1 : kMap, cream: real ? 0 : (1 - kMap) * .35, hi: (i, j) => (!real && kd > .01 && ref(i, j) && pulse > .35 ? PAL.coral : null), dots: { k: 1, a: () => Math.max(0, pin01(t, tMk + .3, .5) * (1 - kMap)), col: PAL.sky } });
    hud(sc, [g.pC[0], g.top - 22], real ? 'REAL FACE' : 'MASK', { color: real ? PAL.mint : PAL.coral, textColor: PAL.cream, alpha: pin01(t, at + .1, .3) });
    if (t > tHd && !real && t < tEy) hud(sc, [g.pC[0], g.bot + 28], 'HARD TO MAKE', { color: PAL.coral, alpha: pin01(t, tHd, .3) });
    const ek = pin01(t, tEy - .05, .4);
    for (const sx of [-1, 1]) { const p = g.fpos(sx * .33, .25); if (!real) cross(sc, p, ek, PAL.ember, 22); else eye(sc, p, kReal, { color: PAL.sky, s: .72, look: -1 }); }
    if (t > tEy && !real) hud(sc, [g.pC[0], g.bot + 28], 'NO EYES', { color: PAL.ember, textColor: PAL.cream, alpha: pin01(t, tEy, .3) });
    if (real) { hud(sc, [g.pC[0], g.bot + 28], t > tLk ? 'EYES OPEN · LOOKING' : 'EYES OPEN', { color: PAL.mint, alpha: pin01(t, tEy + .3, .3) });
      const kl = pin01(t, tLk - .1, .6), pL = g.fpos(-.33, .25), pT = phoneTop(sc, 1.2); if (kl > .01) sc.add(`<path d="M${f1(pL[0])},${f1(pL[1])}L${f1(lerp(pL[0], pT[0], kl))},${f1(lerp(pL[1], pT[1], kl))}" stroke="${rgba(PAL.sky, .9)}" stroke-width="${f1(3.4 * V.px)}" stroke-dasharray="${f1(10 * V.px)} ${f1(8 * V.px)}" filter="url(#glow)"/>`, 0, 'fx');
      if (t > tLk + .45) tick(sc, [pT[0], pT[1] - 40 * V.px], pin01(t, tLk + .45, .25), PAL.mint, 40); }
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 6  STRANGERS: my face matches my stored map; a stranger's map differs (coral columns); one in a million gets in
const SQ = 17;
function card6() {
  const w = win('STRANGERS'), at = w.at, end = w.end, tTw = W(13, 'twin'), tSm = W(13, 'same'), tMp = W(13, 'map'), tSt = W(14, 'strangers'), tOn = W(14, 'one'), tMi = W(14, 'million');
  const L = -1.95, R = 1.95, NN = 15, MM = 17, AA = .15;
  const keys = [{ t: at, pts: [...PLATE([L, -L], NN, MM, AA), ...PLATE([R, -R], NN, MM, AA)], zoom: 1.0 }];
  const diff = (i, j) => { const uu = (i - (NN - 1) / 2) / (NN / 2), vv = (j - (MM - 1) / 2) / (MM / 2); return Math.abs(face(uu, vv, 'stranger') - face(uu, vv, 'me')) > .08; };
  return { tag: 'STRANGERS', at, end, seed: 46, keys, stills: [tTw + .4, tSm + .3, tMp + .3, tSt + .6, tOn + .3, tMi + .5], draw(sc, t) {
    const V = sc.V, kStr = io(t, tSt - .05, .9), kGrid = io(t, tOn - .25, .6), plates = 1 - kGrid, strange = kStr > .5;
    const gL = relief(sc, { c0: [L, -L], N: NN, M: MM, a: AA, kind: 'me', k2: 1, edge: PAL.saffron, alpha: plates });
    const gR = relief(sc, { c0: [R, -R], N: NN, M: MM, a: AA, kind: strange ? 'stranger' : 'me', k2: 1, edge: strange ? PAL.coral : PAL.sky, alpha: plates, hi: strange ? (i, j) => (diff(i, j) ? PAL.coral : null) : null });
    if (gL && gR) {
      hud(sc, [gL.pC[0], gL.top - 22], 'STORED', { color: PAL.saffron, alpha: plates }); hud(sc, [gR.pC[0], gR.top - 22], strange ? 'STRANGER' : 'YOU NOW', { color: strange ? PAL.coral : PAL.sky, alpha: plates });
      const mid = [lerp(gL.right, gR.left, .5), gL.pC[1]];
      if (!strange && t > tSm) { tick(sc, mid, pin01(t, tSm, .3) * plates, PAL.mint, 38); hud(sc, [lerp(gL.pC[0], gR.pC[0], .5), gL.pC[1] + 64 * V.px], 'MATCH', { color: PAL.mint, alpha: pin01(t, tSm, .3) * plates }); }
      if (strange) { cross(sc, mid, pin01(t, tSt + .5, .3) * plates, PAL.ember, 30); hud(sc, [lerp(gL.pC[0], gR.pC[0], .5), gL.pC[1] + 64 * V.px], 'NO MATCH', { color: PAL.ember, textColor: PAL.cream, alpha: pin01(t, tSt + .5, .3) * plates }); } }
    if (kGrid > .01) {   // a million people: 1,000 squares of 1,000 each; one lights
      const cols = 50, rows = 20, gw = cols * SQ * V.px, gh = rows * SQ * V.px, x0 = V.W / 2 - gw / 2, y0 = 150 * V.px + 20, sq = (SQ - 4) * V.px, lit = pin01(t, tMi - .15, .35); let s = `<g opacity="${kGrid.toFixed(3)}">`;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const idx = r * cols + c, on = r === 5 && c === 31, a0 = prog(t, tOn - .15 + (idx / (rows * cols)) * .9, tOn + .1 + (idx / (rows * cols)) * .9);
        if (a0 <= .01) continue; const sx = x0 + c * SQ * V.px, sy = y0 + r * SQ * V.px; s += `<rect x="${f1(sx)}" y="${f1(sy)}" width="${f1(sq)}" height="${f1(sq)}" rx="${f1(3 * V.px)}" fill="${on && lit > .05 ? PAL.saffron : rgba(PAL.sky, .34 * a0)}"/>`; }
      sc.add(s + '</g>', 0, 'hud'); if (lit > .02) ringAt(sc, [x0 + 31 * SQ * V.px + sq / 2, y0 + 5 * SQ * V.px + sq / 2], 36 + 16 * Math.sin(t * 8), lit, PAL.saffron);
      hud(sc, [V.W / 2, y0 + gh + 38], t > tMi - .15 ? '1 IN 1,000,000' : 'EACH SQUARE = 1,000 PEOPLE', { color: t > tMi - .15 ? PAL.saffron : PAL.sky, alpha: kGrid }); }
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 7  TWINS: two almost identical maps, one column differs: the comparison passes and the lock opens
function card7() {
  const w = win('TWINS'), at = w.at, end = w.end, tTw = W(15, 'twins'), tId = W(16, 'identical'), tFo = W(16, 'fool'), tAp = W(16, 'apple');
  const L = -1.95, R = 1.95, NN = 15, MM = 17, AA = .15;
  const keys = [{ t: at, pts: [...PLATE([L, -L], NN, MM, AA), ...PLATE([R, -R], NN, MM, AA)], zoom: 1.0 }];
  const mism = (i, j) => { const uu = (i - (NN - 1) / 2) / (NN / 2), vv = (j - (MM - 1) / 2) / (MM / 2); return Math.abs(face(uu, vv, 'twin') - face(uu, vv, 'me')) > .08; };
  return { tag: 'TWINS', at, end, seed: 47, keys, stills: [tTw + .3, tId + .5, tFo + .5, tAp + .3], draw(sc, t) {
    const V = sc.V, kT = pin01(t, at + .1, .4), kDiff = pin01(t, tId + .4, .3);
    const gL = relief(sc, { c0: [L, -L], N: NN, M: MM, a: AA, kind: 'me', k2: 1, edge: PAL.saffron, alpha: 1 });
    const gR = relief(sc, { c0: [R, -R], N: NN, M: MM, a: AA, kind: 'twin', k2: 1, edge: PAL.sky, alpha: Math.max(.02, kT), hi: (i, j) => (kDiff > .02 && mism(i, j) ? PAL.coral : null) });
    hud(sc, [gL.pC[0], gL.top - 22], 'YOU', { color: PAL.saffron, alpha: 1 }); hud(sc, [gR.pC[0], gR.top - 22], 'TWIN', { color: PAL.sky, alpha: kT });
    const mid = [lerp(gL.right, gR.left, .5), gL.pC[1]];
    if (t > tId + .5 && t < tFo - .1) { tick(sc, [mid[0], mid[1] - 10 * V.px], pin01(t, tId + .5, .25), PAL.mint, 36); hud(sc, [mid[0], gL.pC[1] + 64 * V.px], 'SAME MAP', { color: PAL.sky, alpha: pin01(t, tId + .5, .3) }); }
    if (t > tFo - .1) { lock(sc, [mid[0], mid[1] + 14 * V.px], pin01(t, tFo - .1, .3), io(t, tFo + .05, .35), PAL.ember); hud(sc, [mid[0], gL.pC[1] + 64 * V.px], 'CAN FOOL IT', { color: PAL.ember, textColor: PAL.cream, alpha: pin01(t, tFo, .3) }); }
    if (t > tAp) hud(sc, [V.W / 2, gL.top - 70], 'APPLE ADMITS IT', { color: PAL.saffron, alpha: pin01(t, tAp, .3) });
  } };
}
// the layout switch re-frames the scene, so a card enters/leaves ON a shot cut when one is close
const cuts = (E.shots || []).map(x => x.t0).filter(x => x > 0);
const snap = (t, lo, hi) => { const c = cuts.filter(x => x >= t - lo && x <= t + hi).sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0]; return c ?? t; };
export const CARDS = [card1(), card2(), card3(), card4(), card5(), card6(), card7()].map(c => ({ ...c, at: snap(c.at, .35, .05), end: snap(c.end, .4, .1) })).map(c => ({ ...c, stills: c.stills.filter(x => x > c.at + .3 && x < c.end - .35) }));
const NS = 'http://www.w3.org/2000/svg';
const tagHtml = fs => `position:absolute;left:${fs * 1.7}px;top:${fs * 1.4}px;display:flex;align-items:center;gap:${fs * .7}px;font:500 ${fs}px/1 'Geist Mono',monospace;letter-spacing:.14em;color:${rgba(PAL.cream, .92)};z-index:20;padding:${fs * .35}px ${fs * .6}px;margin:-${fs * .35}px 0 0 -${fs * .6}px;border-radius:${fs * .5}px;background:${PAL.bg0};box-shadow:0 0 0 1.5px ${rgba(PAL.cream, .16)}`;
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
