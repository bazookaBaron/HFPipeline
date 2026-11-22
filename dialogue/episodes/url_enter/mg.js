// url_enter MG: eight iso cards (STORYBOARD.md) built from mg/isokit. Cards 1-7 share ONE world (three small floating islands: YOU = a flat browser window,
// DNS = a phone book, SERVER = a street of houses; the camera moves between them); card 8 is its own world (the page + six ad islands). Every card is a pure
// function of global episode time t. Word times come from shots.json at load time (W(line, word)). Engine contract (engine/mg-adapter.js): default export
// (mg, {ratio}) adds mg.beat()s; 9:16 uses 'float'. Text rule: every label is >= 28 px at 1080 width (hud size 34 * px .85 = 28.9 px).
import { PAL, mix, rgba, tones, f1, pt, poly, line, rng, createScene } from '../../mg/isokit/core.js';
import * as K from '../../mg/isokit/prims.js';
import { background } from '../../mg/isokit/stage.js';
import { ease, prog } from '../../mg/isokit/motion.js';
import { camRig, viewAt } from '../../mg/isokit/camera.js';

const E = await (await fetch(new URL('./shots.json', import.meta.url))).json();
const BE = await (await fetch(new URL('./mg.beats.json', import.meta.url))).json();
const win = n => { const c = BE.cues.find(x => x.name === n); if (!c) throw new Error('url_enter mg: no beat ' + n); return c; };
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const W = (line, word, nth = 0) => { const c = E.words.filter(w => w.line === line && norm(w.w) === norm(word)); if (!c[nth]) throw new Error(`url_enter mg: no word "${word}" #${nth} in line ${line}`); return c[nth].s; };
const pin01 = (t, a, d = .5) => ease.p3out(prog(t, a, a + d));
const io = (t, a, d) => ease.p2io(prog(t, a, a + d));
const bell = (t, a, d) => Math.sin(Math.PI * prog(t, a, a + d));
const hud = (sc, a, text, o = {}) => K.hud(sc, a, text, { size: 34, ...o });          // 34 * .85 = 28.9 px
const lerp = (a, b, k) => a + (b - a) * k;
const lerpv = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const KEY = mix(mix(PAL.saffron, PAL.violet, .5), PAL.coral, 1 / 3);   // the agreed colour (commutative mix of public + both secrets)

// ============================================================================================================================
// THE NET WORLD: YOU (left front), DNS (back centre), SERVER (right front); roads between the three
const IS = 4.6, CE = { you: [-4.4, 4.4], dns: [-4.0, -4.0], srv: [4.4, -4.4] };
const isPts = c => [[c[0] - IS / 2, c[1] - IS / 2, 0], [c[0] + IS / 2, c[1] - IS / 2, 0], [c[0] + IS / 2, c[1] + IS / 2, 0], [c[0] - IS / 2, c[1] + IS / 2, 0]];
const isl = (sc, c, seed, avoid) => K.island(sc, { x: c[0] - IS / 2, y: c[1] - IS / 2, w: IS, d: IS, r: .8, th: 1.1, seed, tufts: 12, avoid });
// the browser window lying flat on YOU
const WW = 3.4, WD = 2.5, WX0 = CE.you[0] - WW / 2, WY0 = CE.you[1] - WD / 2, WZ = .14;
const pg = (u, v, z = WZ + .012) => [WX0 + u * WW, WY0 + v * WD, z];
const WIN_PTS = [[WX0, WY0, 0], [WX0 + WW, WY0, 0], [WX0 + WW, WY0 + WD, 0], [WX0, WY0 + WD, 0]];
const PGE = { head: [.05, .17, .95, .29], img: [.05, .36, .5, .88], t1: [.56, .38, .95, .44], t2: [.56, .49, .95, .55], t3: [.56, .6, .82, .66], btn: [.56, .74, .84, .88] };
const rectPts = (r, z) => [pg(r[0], r[1], z), pg(r[2], r[1], z), pg(r[2], r[3], z), pg(r[0], r[3], z)];
// the houses on the SERVER island: four along y; #2 (0-based) is the server
const HX = CE.srv[0] - .9, HY = i => CE.srv[1] - 1.7 + i * 1.15, HH = [.8, .95, 1.15, .85], HP = ['31', '32', '34', '35'];
const SRV_TOP = [HX + .375, HY(2) + .375, HH[2]];
const addr = { you: [CE.you[0], CE.you[1], .55], dns: [CE.dns[0], CE.dns[1], .8], srv: [HX + .375, HY(2) + .375, .7] };

function lockGlyph(sc, a, k, col, s = 1) {   // padlock in screen space; k 0 = open (shackle lifted, one side free), 1 = closed
  const [x, y] = a, w = 30 * s * sc.V.px, h = 22 * s * sc.V.px, lift = (1 - k) * 9 * s * sc.V.px;
  const sh = `M${f1(x - w * .32)},${f1(y - h * .1)}V${f1(y - h * .75 - lift)}A${f1(w * .32)},${f1(w * .32)} 0 0 1 ${f1(x + w * .32)},${f1(y - h * .75 - lift)}V${f1(y - h * .1 - (1 - k) * h * .35)}`;
  sc.add(`<path d="${sh}" fill="none" stroke="${PAL.cream}" stroke-width="${f1(5 * s * sc.V.px)}" stroke-linecap="round"/><rect x="${f1(x - w / 2)}" y="${f1(y - h * .1)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(5 * s * sc.V.px)}" fill="${col}"${k > .5 ? ' filter="url(#glow)"' : ''}/><circle cx="${f1(x)}" cy="${f1(y + h * .38)}" r="${f1(3.2 * s * sc.V.px)}" fill="${PAL.ink}"/>`, 0, 'hud');
}
function eyeGlyph(sc, a, alpha = 1) {
  const [x, y] = a, w = 34 * sc.V.px, h = 17 * sc.V.px;
  sc.add(`<g opacity="${alpha.toFixed(2)}"><path d="M${f1(x - w)},${f1(y)}Q${f1(x)},${f1(y - h * 2)} ${f1(x + w)},${f1(y)}Q${f1(x)},${f1(y + h * 2)} ${f1(x - w)},${f1(y)}Z" fill="${PAL.cream}" stroke="${PAL.ink}" stroke-width="${f1(2 * sc.V.px)}"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(h * .85)}" fill="${PAL.violet}"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(h * .4)}" fill="${PAL.ink}"/></g>`, 0, 'hud');
}
const tick = (sc, [x, y], col, a = 1, s = 34) => sc.add(`<path d="M${f1(x - s * .5)},${f1(y)}L${f1(x - s * .12)},${f1(y + s * .4)}L${f1(x + s * .6)},${f1(y - s * .5)}" fill="none" stroke="${rgba(col, a)}" stroke-width="${f1(7 * sc.V.px)}" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>`, 0, 'hud');
function msg(sc, a, b, k, label, col) {   // a packet (with its label) flying a -> b at fraction k
  if (k <= 0 || k >= 1) return; K.packet(sc, a, b, k, { color: col, r: 9, tail: .1 });
  if (label) hud(sc, lerpv(a, b, k), label, { color: col, dy: -46 });
}
const ripple = (sc, p, t, t0, col = PAL.sky, n = 3, R = 1.5) => { if (t < t0 || t > t0 + 1.6) return; K.rings(sc, { p, n, r: R, r0: .2, color: col, phase: (t - t0) * .8, alpha: 1 - prog(t, t0 + 1.1, t0 + 1.6), w: 3.2, layer: 'fx' }); };

// o: page = {wire (0..1 outline draw), img, css, js (0..1 fills), paper (0..1 cream), sweep (0..1 bar or null)}, bar: label text for the address bar pill, barCol,
//    barA, q: '?' bubble alpha
function drawWindow(sc, t, o = {}) {
  const V = sc.V, P = q => V.P(q[0], q[1], q[2]), pgo = o.page || {}, sw = V.px;
  K.shadow(sc, WX0 + WW / 2 + .2, WY0 + WD / 2 + .25, 0, 2.3, .28);
  K.slab(sc, { x: WX0, y: WY0, w: WW, d: WD, z: 0, h: WZ, r: .22, color: mix(PAL.violet, PAL.ink, .3) });
  let s = `<path d="${poly(rectPts([.02, .02, .98, .11]).map(P))}" fill="${mix(PAL.sky, PAL.ink, .6)}" stroke="${rgba(PAL.cream, .8)}" stroke-width="${f1(1.6 * sw)}"/>`;
  const paper = pgo.paper ?? 0; s += `<path d="${poly(rectPts([.02, .13, .98, .98]).map(P))}" fill="${mix(mix(PAL.ink, PAL.cream, .1), PAL.cream, paper)}" stroke="${rgba(PAL.cream, .5)}" stroke-width="${f1(1.4 * sw)}"/>`;
  const fillA = (id, k, col) => { if (k > .01) s += `<path d="${poly(rectPts(PGE[id]).map(P))}" fill="${col}" opacity="${Math.min(1, k).toFixed(2)}"/>`; };
  fillA('img', pgo.img ?? 0, mix(PAL.sky, PAL.cream, .25));
  if ((pgo.img ?? 0) > .01) {
    const c = P(pg(.38, .5)), a = pgo.img;
    s += `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(.2 * V.s * .9)}" fill="${PAL.saffron}" opacity="${a.toFixed(2)}"/>`;
    s += `<path d="${poly([pg(.05, .88), pg(.2, .6), pg(.31, .78), pg(.42, .64), pg(.5, .8), pg(.5, .88)].map(P))}" fill="${PAL.mint}" opacity="${a.toFixed(2)}"/>`;
  }
  fillA('head', pgo.css ?? 0, PAL.violet); for (const id of ['t1', 't2', 't3']) fillA(id, pgo.css ?? 0, mix(PAL.violet, PAL.ink, .35));
  fillA('btn', pgo.js ?? 0, PAL.coral);
  const wr = pgo.wire ?? 0;
  if (wr > 0) Object.keys(PGE).forEach((id, i) => { const p = Math.min(1, Math.max(0, wr * 6.4 - i)); if (p > 0) s += `<path d="${poly(rectPts(PGE[id]).map(P))}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${(1 - p).toFixed(3)}" fill="none" stroke="${rgba(PAL.cream, .95)}" stroke-width="${f1(2.8 * sw)}" stroke-linejoin="round"/>`; });
  sc.add(s, V.dep(WX0 + WW / 2, WY0 + WD / 2, WZ) + .05, 'world');
  if (pgo.sweep != null && pgo.sweep > 0 && pgo.sweep < 1) K.beam(sc, pg(pgo.sweep, .02, WZ + .08), pg(pgo.sweep, .98, WZ + .08), { color: PAL.cream, alpha: .95, w: 7, layer: 'fx' });
  if (o.bar) hud(sc, [...pg(.5, .06, WZ + .1)], o.bar, { color: o.barCol || PAL.coral, dy: -42, alpha: o.barA ?? 1 });
  if (o.q) hud(sc, [...pg(1.0, .5, WZ + .1)], '?', { color: PAL.coral, dx: 36, dy: -8 * Math.sin(t * 7), alpha: o.q });
  if (o.lock != null) lockGlyph(sc, V.P(...pg(.5, .75, WZ + .5)), o.lock, PAL.mint, 1.35);
}
function drawBook(sc, t, o = {}) {   // the phone book on a pedestal: open pages with name (violet) / number (sky) bars; o.rows(i) 0..1, o.hit 0..1 on row 2, o.woke 0..1 glow
  const V = sc.V, [cx, cy] = CE.dns, P = q => V.P(q[0], q[1], q[2]), zp = .46;
  K.shadow(sc, cx + .2, cy + .25, 0, 1.9, .28);
  K.slab(sc, { x: cx - 1.55, y: cy - 1.1, w: 3.1, d: 2.2, z: 0, h: .34, r: .2, color: mix(PAL.violet, PAL.ink, .2) });
  K.slab(sc, { x: cx - 1.4, y: cy - .95, w: 1.37, d: 1.9, z: .34, h: .12, r: .08, color: PAL.cream });
  K.slab(sc, { x: cx + .03, y: cy - .95, w: 1.37, d: 1.9, z: .34, h: .12, r: .08, color: PAL.cream });
  let s = ''; const R = 5, bw = (a, b, c0, c1, z) => poly([[a, c0, z], [b, c0, z], [b, c1, z], [a, c1, z]].map(P));
  for (let i = 0; i < R; i++) {
    const k = o.rows ? o.rows(i) : 1; if (k <= .01) continue; const y0 = cy - .78 + i * .36, hit = i === 2 ? (o.hit ?? 0) : 0;
    if (hit > .01) s += `<path d="${bw(cx - 1.34, cx + 1.34, y0 - .06, y0 + .24, zp)}" fill="${rgba(PAL.mint, .75 * hit)}" filter="url(#glow)"/>`;
    s += `<path d="${bw(cx - 1.28, cx - 1.28 + .78 * k, y0, y0 + .15, zp + .005)}" fill="${PAL.violet}"/><path d="${bw(cx + .13, cx + .13 + 1.0 * k, y0, y0 + .15, zp + .005)}" fill="${PAL.sky}"/>`;
  }
  s += `<path d="${line([P([cx + .03, cy - .95, zp]), P([cx + .03, cy + .95, zp])])}" stroke="${rgba(PAL.ink, .5)}" stroke-width="${f1(2 * V.px)}"/>`;
  sc.add(s, V.dep(cx, cy, zp) + .1, 'world');
  const rib = P([cx + 1.2, cy + .95, zp]); sc.add(`<path d="M${pt(rib)}l0,${f1(30 * V.px)}l${f1(8 * V.px)},${f1(-6 * V.px)}l${f1(8 * V.px)},${f1(6 * V.px)}l0,${f1(-30 * V.px)}Z" fill="${PAL.coral}"/>`  , V.dep(cx, cy, zp) + .2, 'world');
  if ((o.woke ?? 0) > .02) K.rings(sc, { p: [cx, cy, zp], n: 2, r: 2.2, r0: .6, color: PAL.sky, phase: t * .7, alpha: o.woke, w: 3, layer: 'fx' });
}
function drawStreet(sc, t, o = {}) {   // four houses; the third is the server (rack lights, antenna); plates o.plates (0..1), o.srvOn (0..1)
  const V = sc.V, cols = [mix(PAL.coral, PAL.ink, .25), mix(PAL.saffron, PAL.ink, .3), mix(PAL.sky, PAL.violet, .4), mix(PAL.violet, PAL.ink, .25)];
  K.road(sc, [HX - .7, CE.srv[1] - 2.2], [HX - .7, CE.srv[1] + 2.2], .5, { fill: PAL.road });
  for (let i = 0; i < 4; i++) {
    K.building(sc, { x: HX, y: HY(i), w: .75, d: .75, h: HH[i], color: cols[i], seed: 4 + i, litP: i === 2 ? .15 : .4, roof: i === 2 ? 'antenna' : (i === 1 ? 'tank' : undefined) });
    const pk = (o.plates ?? 0) * (i === 2 ? 0 : 1); if (pk > .01) hud(sc, [HX + .375, HY(i) + .375, HH[i] + .1], HP[i], { color: PAL.cream, dy: -34, alpha: pk });
  }
  const B = { x: HX, y: HY(2), z: 0, w: .75, d: .75, h: HH[2] }, on = o.srvOn ?? 0;
  for (let k = 0; k < 3; k++) { const p = K.facePt(V, B, 'left', .2 + k * .17, .3 + k * .22); sc.add(`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(5.5 * V.px)}" fill="${on > .05 ? PAL.mint : PAL.shade}"${on > .05 ? ' filter="url(#glow)"' : ''}/>`, V.dep(HX + .375, HY(2) + .75, HH[2]) + .02, 'world'); }
  if (o.plate) hud(sc, [HX + .375, HY(2) + .375, HH[2] + .3], '93.184.216.34', { color: PAL.sky, dy: -52, alpha: o.plate });
}
function netWorld(sc, t, o = {}) {
  isl(sc, CE.dns, 21, (x, y) => Math.abs(x - CE.dns[0]) < 1.8 && Math.abs(y - CE.dns[1]) < 1.4);
  isl(sc, CE.you, 22, (x, y) => Math.abs(x - CE.you[0]) < 2 && Math.abs(y - CE.you[1]) < 1.6);
  isl(sc, CE.srv, 23, (x, y) => x < CE.srv[0] + 0.1);
  K.road(sc, CE.you, CE.dns, .55, { fill: PAL.road }); K.road(sc, CE.you, CE.srv, .55, { fill: PAL.road }); K.road(sc, CE.dns, CE.srv, .55, { fill: PAL.road });
  if (o.live) { const V = sc.V; sc.add(`<path d="${line([V.P(CE.you[0], CE.you[1], .01), V.P(CE.srv[0], CE.srv[1], .01)])}" stroke="${rgba(PAL.mint, .9 * o.live)}" stroke-width="${f1(5 * V.px)}" stroke-linecap="round"/>`, -1, 'floor'); }
  for (const [x, y, k, h] of [[CE.you[0] - 1.9, CE.you[1] - 1.7, 'cone', 1.4], [CE.you[0] + 1.7, CE.you[1] + 1.9, 'round', 1.0], [CE.dns[0] - 1.8, CE.dns[1] - 1.8, 'cone', 1.3], [CE.dns[0] + 1.8, CE.dns[1] + 1.7, 'round', .9], [CE.srv[0] + 1.8, CE.srv[1] + 1.6, 'cone', 1.4], [CE.srv[0] + 1.5, CE.srv[1] - 1.9, 'round', 1.0]]) K.tree(sc, { x, y, kind: k, h });
  drawWindow(sc, t, o.win || {}); drawBook(sc, t, o.book || {}); drawStreet(sc, t, o.street || {});
}
const frame = (...ps) => ps.flat(1);
const FR_YD = frame(isPts(CE.you), isPts(CE.dns)), FR_YS = frame(WIN_PTS, [[HX - .6, CE.srv[1] - 2.3, 0], [HX + 1.4, CE.srv[1] + 2.3, 0], [CE.srv[0] + 2.3, CE.srv[1], 0]]);

// ---- cards -------------------------------------------------------------------------------------------------------------------
// CARD 1  ASK A NAME: the blank window sends "news.site?" to the phone book; the window shows "?" (no route yet)
function card1() {
  const w = win('ASK A NAME'), at = w.at, end = w.end, tA = W(2, 'asks'), tI = W(2, 'idea');
  const keys = [{ t: at, pts: FR_YD, zoom: .98 }];
  return { tag: 'ASK A NAME', at, end, seed: 31, keys, stills: [tA + .5, tI + .2, tI + 1.4], draw(sc, t) {
    const arr = prog(t, tA + .15, tA + 1.6), woke = pin01(t, tA + 1.5, .5);
    netWorld(sc, t, { win: { bar: 'news.site', q: pin01(t, tI - .3, .3) * (1 - prog(t, tA + 1.5, tA + 1.9) * 0 ) }, book: { rows: i => 1, woke } });
    msg(sc, addr.you, addr.dns, arr, 'news.site?', PAL.coral);
  } };
}
// CARD 2  PHONE BOOK: rows fan in; the name chip lands on a row (mint), the number chip lifts off and flies back to the window
function card2() {
  const w = win('PHONE BOOK'), at = w.at, end = w.end, tP = W(4, 'phone'), tN = W(4, 'name'), tNo = W(4, 'number'), tD = W(4, 'dns');
  const keys = [{ t: at, pts: frame(isPts(CE.dns), [[CE.dns[0] - 1, CE.dns[1] + 4, 0]]), zoom: .92 }];
  const BK = [CE.dns[0] + .6, CE.dns[1] - .05, 1.0];
  return { tag: 'PHONE BOOK', at, end, seed: 32, keys, stills: [tP + 1.0, tN + .5, tNo + .5, tD + .4], draw(sc, t) {
    const V = sc.V, hit = pin01(t, tN + .6, .3) * (1 - 0);
    netWorld(sc, t, { win: { bar: 'news.site' }, book: { rows: i => ease.p3out(prog(t, tP + i * .12, tP + i * .12 + .35)), hit, woke: .5 } });
    if (t < tN + .7) msg(sc, addr.you, [CE.dns[0] - .6, CE.dns[1] + .35, 1.0], prog(t, tN - .1, tN + .65), 'news.site', PAL.coral);
    msg(sc, [CE.dns[0] + .6, CE.dns[1] + .35, 1.0], addr.you, prog(t, tNo + .1, tNo + 1.4), '93.184.216.34', PAL.sky);
    if (t > tD) hud(sc, [CE.dns[0], CE.dns[1], 1.7], 'DNS', { color: PAL.sky, dy: -20, alpha: pin01(t, tD, .25) });
  } };
}
// CARD 3  THE ADDRESS: the number lands on the address bar; the camera crosses to a street; house plates flick on; the route draws to the server house
function card3() {
  const w = win('THE ADDRESS'), at = w.at, end = w.end, tAd = W(6, 'address'), tSt = W(6, 'street'), tM = W(6, 'machine'), tK = W(6, 'knows');
  const keys = [{ t: at, pts: frame(WIN_PTS, [[CE.dns[0] + 2.2, CE.dns[1] + 2.2, 0]]), zoom: .92 }, { t: tAd - .35, pts: isPts(CE.srv), zoom: .95 }];
  return { tag: 'THE ADDRESS', at, end, seed: 33, keys, stills: [at + 1.0, tAd + .6, tSt + .5, tM + .7, tK + .9], draw(sc, t) {
    const V = sc.V, route = prog(t, tK - .35, tK + .75);
    netWorld(sc, t, { win: { bar: t > at + .35 ? '93.184.216.34' : 'news.site', barCol: t > at + .35 ? PAL.sky : PAL.coral }, book: { rows: () => 1, woke: .0 },
      street: { plates: pin01(t, tSt, .4), plate: pin01(t, tAd, .35), srvOn: pin01(t, tM, .4) } });
    msg(sc, addr.dns, addr.you, prog(t, at - .15, at + .5), '', PAL.sky);
    if (route > 0) { const A = V.P(addr.you), B = V.P(addr.srv); const p = [lerp(A[0], B[0], route), lerp(A[1], B[1], route)];
      sc.add(`<path d="M${pt(A)}L${pt(p)}" stroke="${rgba(PAL.sky, .95)}" stroke-width="${f1(4.5 * V.px)}" stroke-dasharray="${f1(11 * V.px)} ${f1(9 * V.px)}" stroke-linecap="round" filter="url(#glow)"/>`, 0, 'fx'); }
    ripple(sc, [addr.srv[0], addr.srv[1], 0.05], t, tM + .5, PAL.sky, 2, 1.2);
  } };
}
// CARD 4  HANDSHAKE: HELLO -> HELLO back -> OK, GO; the road turns solid mint; "3 MESSAGES"
function card4() {
  const w = win('HANDSHAKE'), at = w.at, end = w.end, t1 = W(8, 'hello', 0), t2 = W(8, 'hello', 1), t3 = W(8, 'okay'), tT = W(8, 'three');
  const keys = [{ t: at, pts: FR_YS, zoom: .98 }];
  const A = [addr.you[0] + 1.0, addr.you[1] - 1.0, .9], B = [addr.srv[0] - .5, addr.srv[1] + .7, .9];
  return { tag: 'HANDSHAKE', at, end, seed: 34, keys, stills: [t1 + .3, t2 + .3, t3 + .35, tT + .6], draw(sc, t) {
    const V = sc.V;
    netWorld(sc, t, { win: { bar: '93.184.216.34', barCol: PAL.sky }, book: { rows: () => 1 }, street: { srvOn: 1 }, live: pin01(t, t3 + .55, .4) });
    msg(sc, A, B, prog(t, t1 - .05, t1 + .7), 'HELLO', PAL.coral); msg(sc, B, A, prog(t, t2 - .05, t2 + .7), 'HELLO', PAL.mint); msg(sc, A, B, prog(t, t3 - .05, t3 + .7), 'OK, GO', PAL.saffron);
    if (t > t1) hud(sc, [V.W * .5, V.H - 34], 'HELLO', { color: PAL.coral, align: 'c', alpha: 0 });
    if (t > tT) { hud(sc, [V.W / 2, V.H - 34], '3 MESSAGES  ' + '● '.repeat(3).trim(), { color: PAL.mint, alpha: pin01(t, tT, .3) }); }
  } };
}
// CARD 5  SECRET CODE: public colour in the open; two secrets; mixes cross the road (an eye watches); each adds its own secret -> the SAME colour; padlock closes
function card5() {
  const w = win('SECRET CODE'), at = w.at, end = w.end, tAg = W(12, 'agree'), tSe = W(12, 'secret'), tOp = W(12, 'out'), tPl = W(12, 'padlock'), tWk = W(12, 'worked');
  const keys = [{ t: at, pts: FR_YS, zoom: .98 }];
  const PUB = [0, 0, .0], SY = [CE.you[0], CE.you[1] + 1.9, 0], SS = [CE.srv[0] + 1.2, CE.srv[1], 0], PC = PAL.saffron, YC = PAL.violet, SC = PAL.coral;
  const mixY = mix(PC, YC, .5), mixS = mix(PC, SC, .5), tX = tOp + .05, tM = tX + .85, tF = tM + .1;
  const puck = (sc, p, h, col, a = 1) => { if (h > .01) sc.add(`<g filter="url(#glow)" opacity="${a.toFixed(2)}">${K.cylSvg(sc.V, { c: [p[0], p[1], p[2] + h], r: .3, h, color: col, lit: .45, dark: .2 })}</g>`, sc.V.dep(p[0], p[1], p[2]) + .5, 'world'); };
  return { tag: 'SECRET CODE', at, end, seed: 35, keys, stills: [tAg + .5, tSe + .5, tX + .5, tM + .1, tPl + .8], draw(sc, t) {
    const V = sc.V, hP = .45 * pin01(t, tAg, .4), hY = .45 * pin01(t, tSe, .4), hS = .45 * pin01(t, tSe + .15, .4), fly = prog(t, tX, tM), fin = pin01(t, tF, .5);
    netWorld(sc, t, { win: { bar: '93.184.216.34', barCol: PAL.sky, lock: t > tPl ? ease.p3out(prog(t, tPl, tPl + .5)) : null }, book: { rows: () => 1 }, street: { srvOn: 1 }, live: 1 });
    puck(sc, PUB, hP, PC, 1 - prog(t, tX, tX + .3)); if (t > tAg + .1 && t < tX + .3) hud(sc, [...PUB.slice(0, 2), .9], 'PUBLIC', { color: PC, dy: -34, alpha: pin01(t, tAg + .1, .25) * (1 - prog(t, tX, tX + .3)) });
    const hy = hY * (1 - prog(t, tF, tF + .01) * 0), cap = (p, a) => { if (a > .02) sc.add(`<path d="${poly([[p[0] - .36, p[1] - .36, .5], [p[0] + .36, p[1] - .36, .5], [p[0] + .36, p[1] + .36, .5], [p[0] - .36, p[1] + .36, .5]].map(q => V.P(q)))}" fill="${rgba(PAL.ink, .5 * a)}"/>`, V.dep(p[0], p[1], .5) + .6, 'air'); };
    puck(sc, SY, hy, YC); puck(sc, SS, hS, SC); if (t > tSe) { hud(sc, [SY[0], SY[1], .9], 'SECRET', { color: YC, dy: 38, alpha: pin01(t, tSe + .2, .25) * (1 - fin) }); hud(sc, [SS[0], SS[1], .9], 'SECRET', { color: SC, dy: 38, alpha: pin01(t, tSe + .2, .25) * (1 - fin) }); }
    if (t > tX && t < tM + .25) { const k = io(t, tX, tM - tX);   // the mixes cross in the open
      const pa = lerpv([SY[0], SY[1], .85], [SS[0], SS[1], .85], k), pb = lerpv([SS[0], SS[1], .85], [SY[0], SY[1], .85], k);
      for (const [p, c] of [[pa, mixY], [pb, mixS]]) sc.add(`<g filter="url(#glow)">${K.cylSvg(V, { c: [p[0], p[1], p[2]], r: .26, h: .26, color: c, lit: .45, dark: .2 })}</g>`, V.dep(p[0], p[1], p[2]) + 1, 'air');
      eyeGlyph(sc, V.P(0, 0, 1.9), pin01(t, tX, .25)); hud(sc, [0, 0, 1.0], 'IN THE OPEN', { color: PAL.cream, dy: 62, alpha: pin01(t, tX + .1, .25) }); }
    if (fin > .01) { puck(sc, [SY[0] + 1.1, SY[1] - .2, 0], .45 * fin, KEY); puck(sc, [SS[0] - 1.1, SS[1] + .2, 0], .45 * fin, KEY); hud(sc, [0, 0, 1.0], 'SAME KEY', { color: KEY, dy: -20, alpha: fin }); }
    cap(SY, 1 - fin); cap(SS, 1 - fin);
    if (t > tWk) { ripple(sc, [...pg(.5, .5, WZ + .1)], t, tWk - .2, PAL.mint, 2, 1.4); }
  } };
}
// CARD 6  ASK FOR THE PAGE: GET / goes out, HTML comes back, the window draws the skeleton
function card6() {
  const w = win('ASK FOR THE PAGE'), at = w.at, end = w.end, tN = W(14, 'now'), tG = W(14, 'give'), tB = W(14, 'back'), tS = W(14, 'skeleton'), tH = W(14, 'html');
  const keys = [{ t: at, pts: FR_YS, zoom: .98 }, { t: tB + .2, pts: frame(WIN_PTS, [[addr.you[0] + 2.6, addr.you[1] - 2.6, 0]]), zoom: .95, dur: .8 }];
  const A = [addr.you[0] + 1.0, addr.you[1] - 1.0, .9], B = [addr.srv[0] - .5, addr.srv[1] + .7, .9];
  return { tag: 'ASK FOR THE PAGE', at, end, seed: 36, keys, stills: [tN + .8, tB + .6, tS + .8, tH + .5], draw(sc, t) {
    const V = sc.V, wire = prog(t, tS, tS + 1.3), blink = t > tN + .5 && t < tB ? .5 + .5 * Math.sin((t - tN) * 12) : 1;
    netWorld(sc, t, { win: { bar: '93.184.216.34', barCol: PAL.sky, lock: 1, page: { wire } }, book: { rows: () => 1 }, street: { srvOn: blink }, live: 1 });
    msg(sc, A, B, prog(t, tN + .05, tN + 1.1), 'GET /', PAL.saffron); msg(sc, B, A, prog(t, tB, tB + .8), 'HTML', PAL.mint);
    if (t > tH) hud(sc, [V.W / 2, V.H - 34], 'HTML = THE SKELETON', { color: PAL.cream, alpha: pin01(t, tH, .3) });
  } };
}
// CARD 7  FETCH + PAINT: IMG / CSS / JS packets fill the wireframe, more shuttle in, a bright sweep paints the page
function card7() {
  const w = win('FETCH + PAINT'), at = w.at, end = w.end, tP = W(16, 'pictures'), tS = W(16, 'styles'), tJ = W(16, 'scripts'), tF = W(16, 'fetches'), tPa = W(16, 'paints');
  const SRC = [addr.you[0] + 3.0, addr.you[1] - 3.0, 1.4];
  const keys = [{ t: at, pts: frame(WIN_PTS, [[SRC[0], SRC[1], 0]]), zoom: .96 }];
  const tgt = id => { const r = PGE[id]; return [...pg((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, WZ + .3)]; };
  return { tag: 'FETCH + PAINT', at, end, seed: 37, keys, stills: [tP + .55, tS + .5, tJ + .5, tF + 1.0, tPa + .45], draw(sc, t) {
    const V = sc.V, img = pin01(t, tP + .5, .3), css = pin01(t, tS + .5, .3), js = pin01(t, tJ + .5, .3), sw = prog(t, tPa, tPa + .85);
    netWorld(sc, t, { win: { bar: '93.184.216.34', barCol: PAL.sky, lock: 1, page: { wire: 1, img, css, js, paper: io(t, tPa + .3, .6), sweep: sw } }, book: { rows: () => 1 }, street: { srvOn: 1 }, live: 1 });
    hud(sc, [SRC[0], SRC[1], SRC[2]], 'SERVER', { color: PAL.mint, dy: -40, alpha: .9 });
    msg(sc, SRC, tgt('img'), prog(t, tP - .05, tP + .6), 'IMG', PAL.coral); msg(sc, SRC, tgt('head'), prog(t, tS - .05, tS + .6), 'CSS', PAL.violet); msg(sc, SRC, tgt('btn'), prog(t, tJ - .05, tJ + .6), 'JS', PAL.saffron);
    if (t > tF && t < tPa) for (let n = 0; n < 3; n++) { const ph = ((t - tF) * 1.5 + n / 3) % 1, tg = [tgt('t1'), tgt('t3'), tgt('img')][n]; K.packet(sc, SRC, tg, ph, { color: [PAL.violet, PAL.saffron, PAL.coral][n], r: 7, tail: .1 }); }
    if ((js ?? 0) > .5 && t < tPa + .3) ripple(sc, tgt('btn').slice(0, 2).concat(WZ + .06), t, tJ + .55, PAL.coral, 2, .7);
    if (t > tPa + .6) hud(sc, [V.W / 2, V.H - 34], 'PAINTED', { color: PAL.mint, alpha: pin01(t, tPa + .6, .3) });
  } };
}
// ============================================================================================================================
// CARD 8  THE ADS: the finished page in the middle, six ad islands, each running its own handshake; a timer runs to 5 s; "PAGE 0.5 s"
const uv = (u, v) => { const a = u / .7071, b = v / .3889; return [(a + b) / 2, (b - a) / 2]; };
const ADS = [[-7.4, .5], [7.4, .5], [-4.4, -3.3], [4.4, -3.3], [-4.0, 3.3], [4.0, 3.3]].map(([u, v]) => uv(u, v));
function card8() {
  const w = win('THE ADS'), at = w.at, end = w.end, tF = W(19, 'five'), tPg = W(20, 'page'), tAd = W(20, 'ads'), tSh = W(20, 'shaking');
  const keys = [{ t: at, pts: frame(isPts([0, 0]), ADS.map(c => [[c[0] - 1.2, c[1] - 1.2, 0], [c[0] + 1.2, c[1] + 1.2, 0], [c[0] - 1.2, c[1] + 1.2, 0], [c[0] + 1.2, c[1] - 1.2, 0]]).flat()), zoom: 1 }];
  const COL = [PAL.coral, PAL.saffron, PAL.sky, PAL.violet, PAL.mint, PAL.coral];
  return { tag: 'THE ADS', at, end, seed: 38, keys, stills: [at + .9, tF + .3, tPg + .7, tAd + .5, tSh + .5], draw(sc, t) {
    const V = sc.V, R = rng(3);
    K.island(sc, { x: -2.3, y: -2.3, w: 4.6, d: 4.6, r: .8, th: 1.1, seed: 41, tufts: 8, avoid: (x, y) => Math.abs(x) < 1.8 && Math.abs(y) < 1.4 });
    ADS.forEach((c, i) => K.road(sc, [0, 0], c, .32, { fill: PAL.road }));
    ADS.forEach((c, i) => {
      K.island(sc, { x: c[0] - 1.2, y: c[1] - 1.2, w: 2.4, d: 2.4, r: .5, th: .8, seed: 50 + i, tufts: 3 });
      K.box(sc, { x: c[0] - .08, y: c[1] - .08, z: 0, w: .16, d: .16, h: .9, color: PAL.cream });
      K.box(sc, { x: c[0] - .55, y: c[1] - .12, z: .9, w: 1.1, d: .14, h: .7, color: COL[i] });
      const st = V.P(c[0] - .55, c[1] + .02, 1.3); sc.add(`<path d="M${pt(V.P(c[0] - .5, c[1] + .03, 1.0))}l${f1(.32 * V.s)},${f1(-.12 * V.s * .4)}M${pt(V.P(c[0] - .5, c[1] + .03, 1.3))}l${f1(.32 * V.s)},${f1(-.12 * V.s * .4)}" stroke="${rgba(PAL.cream, .8)}" stroke-width="${f1(3 * V.px)}" stroke-linecap="round"/>`, V.dep(c[0], c[1], 1.6), 'air');
      lockGlyph(sc, V.P(c[0], c[1], 2.2), 0, COL[i], 1.0);
      const sp = t > tAd - .1 ? 1.6 : 1.0, per = 2.1 / sp, T = (t - at + i * .42) % per, ph = T / per;   // each ad's own HELLO / HELLO back / OK, GO loop (faster after "ads")
      const a = [0, 0, .5], b = [c[0], c[1], 1.5];
      if (ph < .3) K.packet(sc, a, b, ph / .3, { color: PAL.coral, r: 7, tail: .1 }); else if (ph < .6) K.packet(sc, b, a, (ph - .3) / .3, { color: PAL.mint, r: 7, tail: .1 }); else if (ph < .9) K.packet(sc, a, b, (ph - .6) / .3, { color: PAL.saffron, r: 7, tail: .1 });
    });
    // the finished page in the middle
    K.shadow(sc, .2, .25, 0, 1.7, .28); K.slab(sc, { x: -1.5, y: -1.0, w: 3.0, d: 2.0, z: 0, h: .14, r: .2, color: mix(PAL.violet, PAL.ink, .3), depth: 0 });
    const pp = (u, v, z = .16) => V.P(-1.5 + u * 3.0, -1.0 + v * 2.0, z); let s = `<path d="${poly([pp(.04, .06), pp(.96, .06), pp(.96, .96), pp(.04, .96)])}" fill="${PAL.cream}"/>`;
    s += `<path d="${poly([pp(.06, .1), pp(.94, .1), pp(.94, .26), pp(.06, .26)])}" fill="${PAL.violet}"/><path d="${poly([pp(.06, .36), pp(.5, .36), pp(.5, .88), pp(.06, .88)])}" fill="${mix(PAL.sky, PAL.cream, .25)}"/>`;
    s += `<path d="${poly([pp(.06, .88), pp(.2, .62), pp(.3, .78), pp(.4, .66), pp(.5, .8), pp(.5, .88)])}" fill="${PAL.mint}"/><path d="${poly([pp(.56, .4), pp(.94, .4), pp(.94, .46), pp(.56, .46)])}" fill="${mix(PAL.violet, PAL.ink, .35)}"/><path d="${poly([pp(.56, .54), pp(.94, .54), pp(.94, .6), pp(.56, .6)])}" fill="${mix(PAL.violet, PAL.ink, .35)}"/><path d="${poly([pp(.56, .72), pp(.84, .72), pp(.84, .88), pp(.56, .88)])}" fill="${PAL.coral}"/>`;
    sc.add(s, V.dep(0, 0, .15) + .01, 'floor');
    const tm = 0.5 + 4.5 * io(t, tF - 1.0, 1.95); const timer = t < tF - 1.0 ? '0.5 s' : (tm >= 4.995 ? '5.0 s' : tm.toFixed(1) + ' s');
    hud(sc, [V.W / 2, 118], 'TIMER  ' + timer, { color: t > tF + .8 ? PAL.coral : PAL.saffron, alpha: pin01(t, at + .3, .3) });
    if (t > tPg) { tick(sc, V.P(0, 0, 1.1), PAL.mint, pin01(t, tPg + .5, .3), 44); hud(sc, V.P(0, 0, .5), 'PAGE 0.5 s', { color: PAL.mint, dy: 82, alpha: pin01(t, tPg, .3) }); }
    if (t > tSh - .4) hud(sc, [V.W / 2, V.H - 34], 'EACH AD: ITS OWN HANDSHAKE', { color: PAL.cream, alpha: pin01(t, tSh - .4, .3) });
  } };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// the layout switch re-frames the scene, so a card enters/leaves ON a shot cut when one is close
const cuts = (E.shots || []).map(x => x.t0).filter(x => x > 0);
const snap = (t, lo, hi) => { const c = cuts.filter(x => x >= t - lo && x <= t + hi).sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0]; return c ?? t; };
export const CARDS = [card1(), card2(), card3(), card4(), card5(), card6(), card7(), card8()].map(c => ({ ...c, at: snap(c.at, .35, .05), end: snap(c.end, .4, .1) })).map(c => ({ ...c, stills: c.stills.filter(x => x > c.at + .3 && x < c.end - .35) }));
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
