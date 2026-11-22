// incognito MG: seven iso cards (STORYBOARD.md) built from mg/isokit. The world is a diagonal chain of small floating islands (phone -> router -> provider tower -> website),
// so it reads left to right on a phone. Every card is a pure function of global episode time t. Word times come from shots.json (W(line, word)).
// Engine contract (engine/mg-adapter.js): default export (mg, {ratio}) adds mg.beat()s; 9:16 uses 'float'. Text rule: every label >= 28 px at 1080 width (hud size 34 * px .85 = 28.9 px).
// Colour: coral = a watcher / the record, mint = hidden / safe, sky = the data, saffron = the postman / names, ember = broken / blocked only.
import { PAL, mix, rgba, f1, rng, createScene } from '../../mg/isokit/core.js';
import * as K from '../../mg/isokit/prims.js';
import { background } from '../../mg/isokit/stage.js';
import { ease, prog } from '../../mg/isokit/motion.js';
import { camRig, viewAt } from '../../mg/isokit/camera.js';

const E = await (await fetch(new URL('./shots.json', import.meta.url))).json();
const BE = await (await fetch(new URL('./mg.beats.json', import.meta.url))).json();
const win = n => { const c = BE.cues.find(x => x.name === n); if (!c) throw new Error('incognito mg: no beat ' + n); return c; };
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const W = (line, word, nth = 0) => { const c = E.words.filter(w => w.line === line && norm(w.w) === norm(word)); if (!c[nth]) throw new Error(`incognito mg: no word "${word}" #${nth} in line ${line}`); return c[nth].s; };
const pin01 = (t, a, d = .5) => ease.p3out(prog(t, a, a + d));
const io = (t, a, d) => ease.p2io(prog(t, a, a + d));
const hud = (sc, a, text, o = {}) => K.hud(sc, a, text, { size: 34, ...o });          // 34 * .85 = 28.9 px
const lerp = (a, b, k) => a + (b - a) * k;
const frame = (...ps) => ps.flat(1);
const isl = (sc, u, seed, o = {}) => K.island(sc, { x: u - 1.55, y: -u - 1.55, w: 3.1, d: 3.1, r: .7, th: 1.0, seed, tufts: o.tufts ?? 4, avoid: o.avoid });
const A = (u, z = 0) => [u, -u, z];                       // a point above the island centred at u (the chain runs along the screen's horizontal)
const UP = -5.1, UR = -1.7, UT = 1.7, US = 5.1;           // phone, router, provider tower, website
const ISLE_PTS = us => us.flatMap(u => [[u - 1.6, -u - 1.6, 0], [u + 1.6, -u + 1.6, 0], [u + 1.6, -u - 1.6, 0], [u - 1.6, -u + 1.6, 0]]);
// ---- glyphs (screen space, pop k = 0..1) -------------------------------------------------------------------------------------------
const P2 = (sc, a) => (a.length === 3 ? sc.V.P(a) : a);
function eye(sc, a, k = 1, o = {}) {   // a watching eye (coral iris)
  if (k <= .01) return; const V = sc.V, p = P2(sc, a), s = k * (o.s ?? 1) * V.px * 1.1, w = 38 * s, h = 22 * s * (o.open ?? 1), x = p[0], y = p[1], ix = x + (o.look ?? 0) * w * .3;
  const d = `M${f1(x - w)},${f1(y)}Q${f1(x)},${f1(y - h * 1.8)} ${f1(x + w)},${f1(y)}Q${f1(x)},${f1(y + h * 1.8)} ${f1(x - w)},${f1(y)}Z`;
  sc.add(`<path d="${d}" fill="${PAL.cream}" stroke="${PAL.ink}" stroke-width="${f1(3 * s)}" stroke-linejoin="round"/><circle cx="${f1(ix)}" cy="${f1(y)}" r="${f1(h * .95)}" fill="${o.color || PAL.coral}"/><circle cx="${f1(ix)}" cy="${f1(y)}" r="${f1(h * .45)}" fill="${PAL.ink}"/><circle cx="${f1(ix - h * .3)}" cy="${f1(y - h * .3)}" r="${f1(h * .17)}" fill="${PAL.cream}"/>`, 0, 'hud');
}
function spy(sc, a, k = 1, o = {}) {   // the incognito icon: a hat and glasses
  if (k <= .01) return; const V = sc.V, p = P2(sc, a), s = k * (o.s ?? 1) * V.px * 1.25;
  sc.add(`<g transform="translate(${f1(p[0])},${f1(p[1])}) scale(${f1(s)})"><path d="M-22,-8L-17,-38Q0,-46 17,-38L22,-8Z" fill="${PAL.violet}"/><rect x="-21" y="-17" width="42" height="7" fill="${PAL.saffron}"/><ellipse cx="0" cy="-8" rx="36" ry="7" fill="${mix(PAL.violet, PAL.ink, .45)}"/><circle cx="-12" cy="13" r="10" fill="${PAL.ink}" stroke="${PAL.cream}" stroke-width="3.2"/><circle cx="12" cy="13" r="10" fill="${PAL.ink}" stroke="${PAL.cream}" stroke-width="3.2"/><path d="M-2,12Q0,9 2,12" stroke="${PAL.cream}" stroke-width="3" fill="none"/></g>`, 0, 'hud');
}
function cap(sc, a, k = 1) {   // postman cap
  if (k <= .01) return; const V = sc.V, p = P2(sc, a), s = k * V.px * 1.25;
  sc.add(`<g transform="translate(${f1(p[0])},${f1(p[1])}) scale(${f1(s)})"><path d="M-24,0Q-22,-26 0,-28Q22,-26 24,0Z" fill="${PAL.saffron}"/><path d="M-24,0L40,0Q40,7 30,7L-24,7Z" fill="${mix(PAL.saffron, PAL.ink, .4)}"/><circle cx="0" cy="-14" r="5" fill="${PAL.cream}"/></g>`, 0, 'hud');
}
function tick(sc, a, k, col = PAL.mint, s = 34) { if (k <= .01) return; const V = sc.V, p = P2(sc, a); sc.add(`<path d="M${f1(p[0] - s * .5)},${f1(p[1])}L${f1(p[0] - s * .12)},${f1(p[1] + s * .4)}L${f1(p[0] + s * .6)},${f1(p[1] - s * .5)}" fill="none" stroke="${rgba(col, k)}" stroke-width="${f1(7 * V.px)}" stroke-linecap="round" stroke-linejoin="round"/>`, 0, 'hud'); }
function cross(sc, a, k, col = PAL.ember, s = 30) { if (k <= .01) return; const V = sc.V, p = P2(sc, a); sc.add(`<path d="M${f1(p[0] - s)},${f1(p[1] - s)}L${f1(p[0] + s)},${f1(p[1] + s)}M${f1(p[0] + s)},${f1(p[1] - s)}L${f1(p[0] - s)},${f1(p[1] + s)}" fill="none" stroke="${rgba(col, k)}" stroke-width="${f1(8 * V.px)}" stroke-linecap="round"/>`, 0, 'hud'); }
// a panel with a title and rows, screen space, bottom-centre anchored at a (world point or screen point). rows: [{text, col, a, hl, hat}]
function board(sc, a, title, rows, o = {}) {
  const V = sc.V, p = P2(sc, a), fs = 34 * V.px, rh = fs * 1.75, cap_ = o.cap ?? rows.length, chars = Math.max(title.length, ...rows.map(r => r.text.length)), w = chars * fs * .62 + fs * 2.2 + (o.hat ? fs * 1.2 : 0), h = (cap_ + 1) * rh + fs * .45;
  const x0 = Math.min(V.W - w - 10, Math.max(10, p[0] - w / 2)), y0 = Math.max(86, p[1] - h), al = o.alpha ?? 1, tc = o.color || PAL.coral; if (al <= .01) return null;
  let s = `<g opacity="${al.toFixed(3)}"><rect x="${f1(x0)}" y="${f1(y0)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(10 * V.px)}" fill="${rgba(PAL.ink, .93)}" stroke="${rgba(tc, .9)}" stroke-width="${f1(2 * V.px)}"/>`;
  s += `<text x="${f1(x0 + w / 2)}" y="${f1(y0 + rh * .72)}" text-anchor="middle" font-family="Geist Mono, monospace" font-weight="500" font-size="${f1(fs)}" letter-spacing="${f1(fs * .04)}" fill="${tc}">${title}</text><path d="M${f1(x0 + fs * .5)},${f1(y0 + rh)}L${f1(x0 + w - fs * .5)},${f1(y0 + rh)}" stroke="${rgba(tc, .5)}" stroke-width="${f1(1.4 * V.px)}"/>`;
  rows.forEach((r, i) => { const ra = r.a ?? 1; if (ra <= .01) return; const y = y0 + rh * (i + 1) + fs * .22, col = r.col || PAL.cream;
    s += `<g opacity="${ra.toFixed(3)}">`; if (r.hl) s += `<rect x="${f1(x0 + fs * .3)}" y="${f1(y + 2)}" width="${f1(w - fs * .6)}" height="${f1(rh - 4)}" rx="${f1(5 * V.px)}" fill="${rgba(r.hl, .2)}" stroke="${rgba(r.hl, .95)}" stroke-width="${f1(2 * V.px)}"/>`;
    s += `<text x="${f1(x0 + fs * (o.hat ? 2 : .9))}" y="${f1(y + rh * .68)}" font-family="Geist Mono, monospace" font-weight="500" font-size="${f1(fs)}" letter-spacing="${f1(fs * .04)}" fill="${col}">${r.text}</text>`;
    if (r.hat) s += `<g transform="translate(${f1(x0 + fs * 1.0)},${f1(y + rh * .6)}) scale(${f1(V.px * .62)})"><path d="M-22,-8L-17,-38Q0,-46 17,-38L22,-8Z" fill="${PAL.violet}"/><ellipse cx="0" cy="-8" rx="36" ry="7" fill="${mix(PAL.violet, PAL.ink, .45)}"/><circle cx="-11" cy="12" r="9" fill="${PAL.ink}" stroke="${PAL.cream}" stroke-width="3"/><circle cx="11" cy="12" r="9" fill="${PAL.ink}" stroke="${PAL.cream}" stroke-width="3"/></g>`;
    s += '</g>'; });
  sc.add(s + '</g>', 0, 'hud'); return { x0, y0, w, h, rh };
}
// ---- world pieces --------------------------------------------------------------------------------------------------------------------
const phoneAt = (sc, u, k = 1.7) => K.phone(sc, { p: [u, -u, .02], scale: k, color: PAL.violet });
const routerAt = (sc, u, col = PAL.sky) => { K.box(sc, { x: u - .65, y: -u - .65, z: 0, w: 1.3, d: 1.3, h: .55, color: PAL.cream }); K.box(sc, { x: u - .4, y: -u - .4, z: .55, w: .8, d: .8, h: .25, color: PAL.violet }); K.wifi(sc, { p: [u, -u, 1.95], size: .9, color: col }); };
const towerAt = (sc, u) => K.tower(sc, { p: [u, -u, 0], h: 3.3, color: PAL.cream });
const siteAt = (sc, u, col = mix(PAL.coral, PAL.ink, .25), seed = 7) => K.building(sc, { x: u - .95, y: -u - .95, w: 1.9, d: 1.9, h: 2.1, color: col, seed, litP: .55, roof: 'antenna' });
const seg = (u0, u1) => [A(u0 + .95, .7), A(u1 - .95, .7)];
const beamBetween = (sc, u0, u1, col = PAL.sky, al = .35) => { const [a, b] = seg(u0, u1); K.beam(sc, a, b, { color: col, alpha: al, w: 2.2, dash: `${f1(10 * sc.V.px)} ${f1(9 * sc.V.px)}` }); };
const CH = [UP, UR, UT, US];
const siteEye = (sc, k, u = US) => { const p = sc.V.P(A(u, 1.5)); eye(sc, [p[0] + 92 * sc.V.px, p[1] - 22 * sc.V.px], k, { look: -1 }); };
function route(sc, t, o = {}) {
  CH.forEach((u, i) => isl(sc, u, 61 + i)); [[UP, UR], [UR, UT], [UT, US]].forEach(([a, b]) => beamBetween(sc, a, b));
  phoneAt(sc, UP); routerAt(sc, UR); towerAt(sc, UT); siteAt(sc, US);
}
function flow(sc, t, t0, o = {}) {   // packets along phone -> router -> tower -> site (or a sub-chain)
  if (t < t0) return; const n = o.n ?? 4, sp = o.speed ?? .2, col = o.col || PAL.sky, ch = o.chain || CH, nseg = ch.length - 1;
  for (let i = 0; i < n; i++) { const u = (((t - t0) * sp + i / n) % 1) * nseg, sg = Math.min(nseg - 1, Math.floor(u)), k = u - sg, [a, b] = seg(ch[sg], ch[sg + 1]); K.packet(sc, a, b, k, { color: col, r: 6, tail: .2 }); }
}
// ---------------------------------------------------------------------------------------------------------------------------------
const ROUTE_PTS = frame(ISLE_PTS(CH), [A(UT, 5.0), A(UR, 3.4), A(US, 4.4)]);
const L = -2.9, R = 2.9, PAIR_PTS = frame(ISLE_PTS([L, R]), [A(L, 6.2), A(R, 6.2)]);
const pair = (sc, o = {}) => { isl(sc, L, 71); isl(sc, R, 72); beamBetween(sc, L, R, o.beamCol || PAL.sky, o.beamA ?? .35); };
const hatChip = (sc, t, a0, u = L, z = 2.5) => { const k = pin01(t, a0, .45); spy(sc, A(u, z), k); };
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 1  THE ROUTE: the phone is cloaked (only its own memory), but the request still runs phone -> router -> provider -> website and three eyes open on the way
function card1() {
  const w = win('THE ROUTE'), at = w.at, end = w.end, tN = W(2, 'nobody'), tP = W(2, 'phone'), tE = W(2, 'everybody'), tS = W(2, 'sees'), tWho = W(3, 'who');
  const keys = [{ t: at, pts: ROUTE_PTS, zoom: 1.0 }];
  return { tag: 'THE ROUTE', at, end, seed: 41, keys, stills: [tP + .55, tE + .5, tS + .55, tWho + .55], draw(sc, t) {
    const V = sc.V; route(sc, t);
    const kh = pin01(t, tN - .05, .5);
    if (kh > .02) { K.groundCircle(sc, { c: [UP, -UP, .03], r: 1.75 * kh, color: PAL.mint, fillA: .16, w: 3.4, dash: `${f1(9 * V.px)} ${f1(8 * V.px)}` }); spy(sc, A(UP, 2.65), kh); }
    if (t > tP - .05) hud(sc, A(UP, 0), 'HIDDEN HERE', { color: PAL.mint, dy: 70, alpha: pin01(t, tP - .05, .3) });
    flow(sc, t, tE - .35);
    eye(sc, A(UR, 3.0), pin01(t, tE + .05, .35)); eye(sc, A(UT, 4.55), pin01(t, tE + .4, .35)); eye(sc, A(US, 3.7), pin01(t, tE + .75, .35));
    if (t > tS) { hud(sc, A(UR, 0), 'ROUTER', { color: PAL.sky, dy: 66, alpha: pin01(t, tS + .1, .3) }); hud(sc, A(UT, 0), 'PROVIDER', { color: PAL.sky, dy: 66, alpha: pin01(t, tS + .3, .3) }); hud(sc, A(US, 0), 'WEBSITE', { color: PAL.sky, dy: 66, alpha: pin01(t, tS + .5, .3) }); }
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 2  THE WEBSITE: a hatted visitor and a plain one both arrive with an internet address; the site logs both the same way
function card2() {
  const w = win('THE WEBSITE'), at = w.at, end = w.end, tW = W(4, 'website'), tG = W(4, 'gets'), tA = W(4, 'address'), tL = W(4, 'like'), tV = W(4, 'visitor');
  const keys = [{ t: at, pts: ROUTE_PTS, zoom: 1.0 }, { t: tW - .3, pts: frame(ISLE_PTS([UT, US]), [A(US, 6.3), A(UT, 4.6)]), zoom: 1.0, dur: .8 }];
  const t1 = tG + .15, t2 = tL + .1, D = .85;   // visitor 1 (hat) and visitor 2 leave the tower; arrive D later
  return { tag: 'THE WEBSITE', at, end, seed: 42, keys, stills: [tW + .5, tA - .25, tA + .6, tV + .5], draw(sc, t) {
    const V = sc.V; CH.forEach((u, i) => isl(sc, u, 61 + i)); beamBetween(sc, UR, UT); beamBetween(sc, UT, US); phoneAt(sc, UP); routerAt(sc, UR); towerAt(sc, UT); siteAt(sc, US);
    flow(sc, t, at, { chain: [UP, UR, UT], n: 3, speed: .25 });
    const [a, b] = seg(UT, US), vis = (t0, text, hat) => { const k = prog(t, t0, t0 + D); if (k <= 0 || k >= 1) return; K.packet(sc, a, b, k, { color: hat ? PAL.violet : PAL.sky, r: 8, tail: .25 }); const p = V.P(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + .55); hud(sc, p, text, { color: hat ? PAL.violet : PAL.sky, textColor: PAL.cream, dy: -62 }); if (hat) spy(sc, [p[0], p[1] - 124], 1, { s: .8 }); };
    vis(t1, '203.0.113.7', true); vis(t2, '198.51.100.4', false);
    const r1 = prog(t, t1 + D, t1 + D + .3), r2 = prog(t, t2 + D, t2 + D + .3), se = pin01(t, tW + .1, .4);
    siteEye(sc, Math.max(se, 0), US);
    board(sc, A(US, 4.0), 'VISITOR LOG', [{ text: '203.0.113.7', hat: true, a: r1 }, { text: '198.51.100.4', a: r2 }], { cap: 2, hat: true, alpha: pin01(t, tG - .1, .4) });
    if (t > tV) hud(sc, A(US, 0), 'SAME TO IT', { color: PAL.coral, dy: 66, alpha: pin01(t, tV, .3) });
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 3  THE POSTMAN: every request is an envelope; router and provider carry it, the provider reads the address on the outside; the inside stays sealed
function card3() {
  const w = win('THE POSTMAN'), at = w.at, end = w.end, tR = W(5, 'router'), tReq = W(6, 'request'), tRt = W(6, 'router'), tPr = W(6, 'provider'), tPm = W(6, 'postman'), tRd = W(6, 'reads'), tAd = W(6, 'address'), tEn = W(6, 'envelope');
  const keys = [{ t: at, pts: ROUTE_PTS, zoom: 1.0 }, { t: tPm - .3, pts: frame(ISLE_PTS([UR, UT]), [A(UT, 5.2), A(UR, 3.4)]), zoom: 1.0, dur: .8 }];
  const tEnv = tRd - .25;
  return { tag: 'THE POSTMAN', at, end, seed: 43, keys, stills: [tR + .45, tPr + .35, tPm + .55, tRd + .8, tEn - .1], draw(sc, t) {
    const V = sc.V; route(sc, t);
    if (t > tR - .05) { K.rings(sc, { p: [UR, -UR, .06], n: 3, r: 1.9, r0: .5, color: PAL.sky, phase: (t * .5) % 1, alpha: pin01(t, tR, .3), w: 3 }); hud(sc, A(UR, 0), 'ROUTER', { color: PAL.sky, dy: 66, alpha: pin01(t, tR, .3) }); }
    flow(sc, t, tReq - .2, { col: PAL.saffron, n: 4, speed: .24 });
    eye(sc, A(UR, 3.0), pin01(t, tRt, .35)); eye(sc, A(UT, 4.6 + (t > tPm ? .0 : 0)), pin01(t, tPr, .35));
    if (t > tPr) hud(sc, A(UT, 0), t > tPm - .1 ? 'POSTMAN' : 'PROVIDER', { color: t > tPm - .1 ? PAL.saffron : PAL.sky, dy: 66, alpha: pin01(t, tPr, .3) });
    cap(sc, A(UT, 3.6), pin01(t, tPm, .35));
    const ke = pin01(t, tEnv, .4);
    if (ke > .01) {   // the envelope, big: address outside (seen), inside sealed
      const W_ = V.W, H_ = V.H, cx = W_ / 2, cy = H_ / 2 + 36, ew = 540 * ke, eh = 300 * ke, fs = 34 * V.px, x0 = cx - ew / 2, y0 = cy - eh / 2;
      sc.add(`<rect x="0" y="0" width="${W_}" height="${H_}" fill="${rgba(PAL.ink, .72 * ke)}"/>`, 0, 'hud');
      let s = `<g opacity="${Math.min(1, ke * 1.5)}"><rect x="${f1(x0)}" y="${f1(y0)}" width="${f1(ew)}" height="${f1(eh)}" rx="14" fill="${PAL.cream}" stroke="${PAL.ink}" stroke-width="4"/>`;
      s += `<path d="M${f1(x0 + 6)},${f1(y0 + 8)}L${f1(cx)},${f1(y0 + eh * .46)}L${f1(x0 + ew - 6)},${f1(y0 + 8)}" fill="none" stroke="${mix(PAL.cream, PAL.ink, .35)}" stroke-width="4" stroke-linejoin="round"/>`;
      const ad = prog(t, tAd - .1, tEn + .1), ay = y0 + eh * .62, tw = 'TO: SHOES.EXAMPLE'.length * fs * .62;
      s += `<text x="${f1(cx)}" y="${f1(ay)}" text-anchor="middle" font-family="Geist Mono, monospace" font-weight="600" font-size="${f1(fs)}" fill="${PAL.ink}">TO: SHOES.EXAMPLE</text>`;
      s += `<path d="M${f1(cx - tw / 2)},${f1(ay + 12)}L${f1(cx - tw / 2 + tw * ad)},${f1(ay + 12)}" stroke="${PAL.coral}" stroke-width="${f1(7 * V.px)}" stroke-linecap="round"/>`;
      const sk = pin01(t, tAd + .55, .35); if (sk > .01) { s += `<g opacity="${sk}"><rect x="${f1(cx - ew * .42)}" y="${f1(y0 + eh * .76)}" width="${f1(ew * .84)}" height="${f1(fs * 1.5)}" rx="8" fill="${PAL.violet}"/><text x="${f1(cx + fs * .5)}" y="${f1(y0 + eh * .76 + fs * 1.05)}" text-anchor="middle" font-family="Geist Mono, monospace" font-weight="600" font-size="${f1(fs)}" fill="${PAL.cream}">INSIDE: SEALED</text><rect x="${f1(cx - ew * .42 + fs * .7)}" y="${f1(y0 + eh * .76 + fs * .62)}" width="${f1(fs * .72)}" height="${f1(fs * .56)}" rx="4" fill="${PAL.cream}"/><path d="M${f1(cx - ew * .42 + fs * .86)},${f1(y0 + eh * .76 + fs * .62)}v${f1(-fs * .2)}a${f1(fs * .2)},${f1(fs * .2)} 0 0 1 ${f1(fs * .4)},0v${f1(fs * .2)}" fill="none" stroke="${PAL.cream}" stroke-width="4"/></g>`; }
      sc.add(s + '</g>', 0, 'hud'); eye(sc, [cx - ew * .36, y0 - 26], ke, { s: 1.2, look: 1 }); hud(sc, [cx + ew * .18, y0 - 26], 'SEEN', { color: PAL.coral, alpha: pin01(t, tAd, .3) });
    }
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 4  FORGETS: during the visit the phone keeps a history and the site writes its own log line; closing the window wipes ONLY the phone's list
const HIST = ['SHOES.EXAMPLE', 'MAPS.EXAMPLE', 'NEWS.EXAMPLE'];
function card4() {
  const w = win('FORGETS'), at = w.at, end = w.end, tH = W(8, 'history'), tC = W(8, 'close'), tWn = W(8, 'window'), tPh = W(8, 'phone'), tF = W(8, 'forgets'), tV = W(8, 'visit'), tHide = W(7, 'hide');
  const keys = [{ t: at, pts: PAIR_PTS, zoom: 1.0 }];
  const T = [at + .45, at + 1.1, at + 1.75], D = .7, CL = tC + .25;
  return { tag: 'FORGETS', at, end, seed: 44, keys, stills: [T[2] + .8, tH + .6, CL + .45, tF + .5, tV + .6], draw(sc, t) {
    const V = sc.V; pair(sc); phoneAt(sc, L); siteAt(sc, R); const hi = pin01(t, tH - .05, .2) * (1 - pin01(t, CL - .05, .2));
    HIST.forEach((_, i) => { const k = prog(t, T[i], T[i] + D); if (k > 0 && k < 1) { const [a, b] = seg(L, R); K.packet(sc, a, b, k, { color: PAL.sky, r: 7, tail: .25 }); } });
    const wk = 1 - io(t, CL, .5), wa = pin01(t, at + .1, .4);   // the browser window: opens, then closes on "window"
    const rowsPh = HIST.map((h, i) => ({ text: h, a: pin01(t, T[i], .3) * (t < CL + .1 ? 1 : 0), hl: hi > .5 ? PAL.cream : null }));
    if (wk > .02 && wa > .02) { const p = V.P(A(L, 2.9)); board(sc, [p[0], p[1] - (1 - wk) * 20], 'INCOGNITO', rowsPh, { cap: 3, hat: false, alpha: wa * wk, color: PAL.violet }); spy(sc, [p[0] - 130 * V.px, p[1] - 3 * 56 * V.px - 40 * V.px + 0], wa * wk, { s: .55 }); }
    const rowsSite = HIST.map((h, i) => ({ text: h, a: pin01(t, T[i] + D, .3), hl: t > tF ? PAL.coral : null }));
    board(sc, A(R, 4.0), 'WEBSITE LOG', rowsSite, { cap: 3, alpha: pin01(t, T[0] + D - .1, .3) });
    siteEye(sc, pin01(t, T[0] + D, .35), R);
    if (t > tF) { hud(sc, A(L, 0), 'FORGOT IT', { color: PAL.mint, dy: 70, alpha: pin01(t, tF, .3) }); tick(sc, A(L, 2.2), pin01(t, tF + .1, .3)); }
    if (t > tV + .1) hud(sc, A(R, 0), 'STILL THERE', { color: PAL.coral, dy: 66, alpha: pin01(t, tV + .1, .3) });
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 5  THE TABLE: the phone side gets wiped clean (plates swept off); the website's log keeps every line; the "waiter" eye is open
function card5() {
  const w = win('THE TABLE'), at = w.at, end = w.end, tAll = W(9, 'all'), tWip = W(10, 'wiping'), tTab = W(10, 'table'), tMeal = W(10, 'meal'), tHap = W(10, 'happened'), tWai = W(10, 'waiter'), tSaw = W(10, 'saw');
  const keys = [{ t: at, pts: PAIR_PTS, zoom: 1.0 }];
  const PLX = [-.55, 0, .55];   // plate offsets along the table (x - y direction -> screen horizontal)
  return { tag: 'THE TABLE', at, end, seed: 45, keys, stills: [tAll + .3, tWip + .45, tTab + .75, tMeal + .5, tSaw + .2], draw(sc, t) {
    const V = sc.V; pair(sc, { beamA: .2 }); siteAt(sc, R);
    // table on the phone island: three plates (what was visited) and the phone leaning on it
    K.slab(sc, { x: L - 1.0, y: -L - .55, z: 0, w: 2.0, d: 1.1, h: .62, r: .1, color: mix(PAL.violet, PAL.ink, .15) });
    const tw = io(t, tWip - .05, .75), cx = lerp(L - 1.0 - .3, L + 1.0 + .3, tw);
    [[0, PAL.saffron], [1, PAL.coral], [2, PAL.mint]].forEach(([i, c]) => { const px = L - .62 + i * .58; if (cx < px + .22 || tw <= 0) { K.box(sc, { x: px - .22, y: -L - .22, z: .62, w: .44, d: .44, h: .07, color: PAL.cream }); K.box(sc, { x: px - .12, y: -L - .12, z: .69, w: .24, d: .24, h: .16, color: c }); } });
    if (tw > 0 && tw < 1) K.box(sc, { x: cx - .12, y: -L - .6, z: .62, w: .24, d: 1.2, h: .14, color: PAL.sky });
    K.phone(sc, { p: [L + .55, -L - 1.1, .02], scale: 1.4, color: PAL.violet });
    const rows = HIST.map((h, i) => ({ text: h, a: 1, hl: t > tMeal ? mix(PAL.coral, PAL.cream, .1) : null })), pulse = t > tMeal && t < tSaw + .6 ? .5 + .5 * Math.sin((t - tMeal) * 7) : 0;
    board(sc, A(R, 4.0), 'WEBSITE LOG', rows.map(r => ({ ...r, hl: r.hl && pulse > .5 ? r.hl : null })), { cap: 3 });
    const se = pin01(t, tWai, .35); siteEye(sc, se, R);
    hud(sc, A(L, 0), t > tWip + .8 ? 'WIPED CLEAN' : 'PHONE: EMPTY', { color: PAL.mint, dy: 70, alpha: pin01(t, at + .1, .3) });
    if (t > tSaw) hud(sc, A(R, 0), 'SAW IT', { color: PAL.coral, dy: 66, alpha: pin01(t, tSaw, .3) });
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 6  LOGGED IN: the visits on the site's log are anonymous; the login sends a name badge; the site files every visit under that name
function card6() {
  const w = win('LOGGED IN'), at = w.at, end = w.end, tTo = W(12, 'told'), tNm = W(12, 'name'), tFl = W(12, 'file'), tUn = W(12, 'under'), tYo = W(12, 'you');
  const keys = [{ t: at, pts: PAIR_PTS, zoom: 1.0 }];
  const D = .6;
  return { tag: 'LOGGED IN', at, end, seed: 46, keys, stills: [at + .35, tTo + .45, tNm + .45, tFl + .55, tYo + .3], draw(sc, t) {
    const V = sc.V; pair(sc, { beamCol: PAL.saffron, beamA: .4 }); phoneAt(sc, L); siteAt(sc, R); spy(sc, A(L, 2.55), pin01(t, at, .3), { s: .8 });
    // login panel over the phone: NAME field with LEO typed in
    const p = V.P(A(L, 3.2)), fs = 34 * V.px, pw = 300 * V.px * 1.2, ph = 130 * V.px * 1.2, ty = Math.min(3, Math.floor(prog(t, at + .05, at + .35) * 4));
    sc.add(`<g><rect x="${f1(p[0] - pw / 2)}" y="${f1(p[1] - ph)}" width="${f1(pw)}" height="${f1(ph)}" rx="${f1(10 * V.px)}" fill="${rgba(PAL.ink, .93)}" stroke="${rgba(PAL.saffron, .95)}" stroke-width="${f1(2 * V.px)}"/><text x="${f1(p[0] - pw / 2 + fs * .7)}" y="${f1(p[1] - ph + fs * 1.25)}" font-family="Geist Mono, monospace" font-weight="500" font-size="${f1(fs)}" fill="${PAL.saffron}">LOG IN</text><rect x="${f1(p[0] - pw / 2 + fs * .6)}" y="${f1(p[1] - ph + fs * 1.65)}" width="${f1(pw - fs * 1.2)}" height="${f1(fs * 1.35)}" rx="6" fill="${rgba(PAL.cream, .12)}" stroke="${rgba(PAL.cream, .7)}" stroke-width="2"/><text x="${f1(p[0] - pw / 2 + fs * 1.0)}" y="${f1(p[1] - ph + fs * 2.65)}" font-family="Geist Mono, monospace" font-weight="600" font-size="${f1(fs)}" fill="${PAL.cream}">${'LEO'.slice(0, ty)}</text></g>`, 0, 'hud');
    const k = prog(t, tTo, tTo + D), [a, b] = seg(L, R);
    if (k > 0 && k < 1) { K.packet(sc, a, b, k, { color: PAL.saffron, r: 9, tail: .25 }); const q = V.P(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + .5); hud(sc, q, 'LEO', { color: PAL.saffron, dy: -62 }); }
    const named = t > tFl + .05, kf = pin01(t, tFl + .05, .45);
    const rows = [0, 1, 2].map(i => ({ text: named ? `VISIT ${i + 1} · LEO` : `VISIT ${i + 1} · ??`, col: named ? mix(PAL.coral, PAL.cream, .3) : mix(PAL.violet, PAL.cream, .45), hl: named ? PAL.saffron : null }));
    board(sc, A(R, 4.0), named ? 'FILE: LEO' : 'WEBSITE LOG', rows, { cap: 3, color: named ? PAL.saffron : PAL.coral });
    siteEye(sc, pin01(t, tTo + D, .35), R);
    if (t > tNm) hud(sc, A(R, 0), named ? 'KNOWS YOU' : 'GOT A NAME', { color: named ? PAL.coral : PAL.saffron, dy: 66, alpha: pin01(t, tNm, .3) });
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 7  THE NETWORK: school and work run their own router with an eye and a log; the hat's cloak ring fizzles before it reaches them
function card7() {
  const w = win('THE NETWORK'), at = w.at, end = w.end, tSc = W(13, 'school'), tWk = W(13, 'work'), tWh = W(14, 'whoever'), tNw = W(14, 'network'), tLg = W(14, 'log'), tIn = W(14, 'incognito'), tTc = W(14, 'touch');
  const keys = [{ t: at, pts: frame(ISLE_PTS([UP + 1.5, UT + 2.2]), [A(UT + 1.3, 6.3)]), zoom: 1.0 }];
  const LU = -3.8, NU = 1.9;   // phone island, network island (two buildings + router)
  return { tag: 'THE NETWORK', at, end, seed: 47, keys, stills: [tSc + .45, tNw + .5, tLg + .6, tIn + .6, tTc + .3], draw(sc, t) {
    const V = sc.V; isl(sc, LU, 81); K.island(sc, { x: NU - 2.6, y: -NU - 2.2, w: 5.2, d: 4.4, r: .7, th: 1.0, seed: 82, tufts: 4 }); beamBetween(sc, LU, NU - 1.1, PAL.sky, .35);
    phoneAt(sc, LU); spy(sc, A(LU, 2.65), 1, { s: .85 });
    K.building(sc, { x: NU - 2.0, y: -NU - 1.55, w: 1.5, d: 1.5, h: 2.3, color: mix(PAL.sky, PAL.violet, .35), seed: 11, litP: .55, roof: 'tank' });
    K.building(sc, { x: NU + .5, y: -NU - 1.55, w: 1.5, d: 1.5, h: 1.9, color: mix(PAL.saffron, PAL.ink, .3), seed: 12, litP: .55, roof: 'unit' });
    routerAt(sc, NU - .15, PAL.sky);
    const [a, b] = [A(LU + .95, .7), A(NU - 1.2, .7)]; for (let i = 0; i < 3; i++) K.packet(sc, a, b, ((t - at) * .3 + i / 3) % 1, { color: PAL.sky, r: 6, tail: .2 });
    if (t > tSc) hud(sc, A(NU - 1.25, 0), 'SCHOOL', { color: PAL.sky, dy: 66, alpha: pin01(t, tSc, .3) });
    if (t > tWk) hud(sc, A(NU + 1.25, 0), 'WORK', { color: PAL.saffron, dy: 66, alpha: pin01(t, tWk, .3) });
    if (t > tWh) K.groundCircle(sc, { c: [NU, -NU - .4, .04], r: 2.45 * pin01(t, tWh, .5), color: PAL.coral, fillA: .08, w: 3, dash: `${f1(10 * V.px)} ${f1(8 * V.px)}` });
    siteEye(sc, pin01(t, tNw - .1, .35), NU + 1.2);
    const rows = HIST.map((h, i) => ({ text: h, a: pin01(t, tLg + .1 + i * .18, .25) }));
    board(sc, A(NU - .9, 4.3), 'NETWORK LOG', rows, { cap: 3, alpha: pin01(t, tNw, .35) });
    if (t > tIn) { const ph = ((t - tIn) * .8) % 1, r = .6 + ph * 3.4; K.rings(sc, { p: [LU, -LU, .06], n: 1, r: r, r0: r - .01, color: PAL.violet, phase: 0, alpha: 1 - Math.pow(ph, 1.4), w: 3.2 });
      const kc = pin01(t, tTc - .1, .3); cross(sc, A(NU - 1.9, 1.6), kc); hud(sc, A(NU - 1.9, 0), 'NO EFFECT', { color: PAL.ember, dy: 124, alpha: kc }); }
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
