// wifi_crowd MG: eight iso cards (STORYBOARD.md) built from mg/isokit. Cards 2-5 share ONE world (the room: a router on an island, a ring of phones, the shared channel);
// card 1 = router + phone + the lane between, card 6 = an airtime ribbon, card 7 = a street of routers on three channels, card 8 = fast band + cable.
// Every card is a pure function of global episode time t. Word times come from shots.json (W(line, word)). Engine contract (engine/mg-adapter.js): default export
// (mg, {ratio}) adds mg.beat()s; 9:16 uses 'float'. Text rule: every label >= 28 px at 1080 width (hud size 34 * px .85 = 28.9 px). Ember = "broken" only.
import { PAL, mix, rgba, f1, rng, createScene } from '../../mg/isokit/core.js';
import * as K from '../../mg/isokit/prims.js';
import { background } from '../../mg/isokit/stage.js';
import { ease, prog } from '../../mg/isokit/motion.js';
import { camRig, viewAt } from '../../mg/isokit/camera.js';

const E = await (await fetch(new URL('./shots.json', import.meta.url))).json();
const BE = await (await fetch(new URL('./mg.beats.json', import.meta.url))).json();
const win = n => { const c = BE.cues.find(x => x.name === n); if (!c) throw new Error('wifi_crowd mg: no beat ' + n); return c; };
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const W = (line, word, nth = 0) => { const c = E.words.filter(w => w.line === line && norm(w.w) === norm(word)); if (!c[nth]) throw new Error(`wifi_crowd mg: no word "${word}" #${nth} in line ${line}`); return c[nth].s; };
const pin01 = (t, a, d = .5) => ease.p3out(prog(t, a, a + d));
const io = (t, a, d) => ease.p2io(prog(t, a, a + d));
const bell = (t, a, d) => Math.sin(Math.PI * prog(t, a, a + d));
const hud = (sc, a, text, o = {}) => K.hud(sc, a, text, { size: 34, ...o });          // 34 * .85 = 28.9 px
const lerp = (a, b, k) => a + (b - a) * k;
const TAU = Math.PI * 2;
const frame = (...ps) => ps.flat(1);
const isle = (sc, x, y, w, d, seed, o = {}) => K.island(sc, { x, y, w, d, r: .8, th: 1.1, seed, tufts: o.tufts ?? 10, avoid: o.avoid });
const sqPts = (x, y, w, d) => [[x, y, 0], [x + w, y, 0], [x + w, y + d, 0], [x, y + d, 0]];
const tickG = (sc, [x, y], col, a = 1, s = 34) => sc.add(`<path d="M${f1(x - s * .5)},${f1(y)}L${f1(x - s * .12)},${f1(y + s * .4)}L${f1(x + s * .6)},${f1(y - s * .5)}" fill="none" stroke="${rgba(col, a)}" stroke-width="${f1(7 * sc.V.px)}" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>`, 0, 'hud');
function bars(sc, a, k, col, s = 1) {   // phone-signal bars in screen space; k = number of filled bars 0..4
  const x = a[0], y = a[1], bw = 11 * s * sc.V.px, gap = 6 * s * sc.V.px; let o = '';
  for (let i = 0; i < 4; i++) { const h = (10 + i * 10) * s * sc.V.px, on = i < k; o += `<rect x="${f1(x + i * (bw + gap))}" y="${f1(y - h)}" width="${f1(bw)}" height="${f1(h)}" rx="2" fill="${on ? col : rgba(PAL.cream, .22)}"/>`; }
  sc.add(o, 0, 'hud');
}
// ---------------------------------------------------------------------------------------------------------------------------------
// THE ROOM: island, router in the middle (wifi glyph), the shared channel (dashed floor ring), phones on a ring
const RR = 3.0, NPH = 8;
const phPos = (i, n = NPH, R = RR, a0 = .39) => [Math.cos(a0 + i / n * TAU) * R, Math.sin(a0 + i / n * TAU) * R];
const ROOM_PTS = frame(sqPts(-5, -5, 10, 10));
const STC = { idle: mix(PAL.violet, PAL.ink, .4), talk: PAL.sky, listen: mix(PAL.violet, PAL.sky, .35), wait: mix(PAL.saffron, PAL.ink, .35), ok: PAL.mint, crash: PAL.ember };
// o: st(i) state, chan colour of the channel ring, chanA, pulse (router rings), crowd (0..1 count of small dots), pk[] packets [{i,k,col}]
function room(sc, t, o = {}) {
  const V = sc.V; isle(sc, -5, -5, 10, 10, 71, { tufts: 6, avoid: (x, y) => Math.hypot(x, y) < 4.4 });
  K.groundCircle(sc, { c: [0, 0, .02], r: RR + 1.25, color: o.chan || PAL.sky, fillA: o.chanA ?? .07, dash: `${f1(10 * V.px)} ${f1(8 * V.px)}`, w: 3.4 });
  K.box(sc, { x: -.5, y: -.5, z: 0, w: 1, d: 1, h: .5, color: PAL.cream }); K.box(sc, { x: -.3, y: -.3, z: .5, w: .6, d: .6, h: .22, color: PAL.violet });
  K.wifi(sc, { p: [0, 0, 1.55], size: .85, color: o.pulse ? PAL.sky : mix(PAL.sky, PAL.cream, .3) });
  if (o.pulse) K.rings(sc, { p: [0, 0, .06], n: 3, r: RR + 1.0, r0: .5, color: o.pulseCol || PAL.sky, phase: (t * .55) % 1, alpha: o.pulse, w: 3 });
  const n = o.n ?? NPH, R = RR;
  if (o.crowd > 0) { const rg = rng(5), cnt = Math.round(70 * o.crowd); for (let i = 0; i < cnt; i++) { const a = rg() * TAU, r = 1.6 + Math.sqrt(rg()) * 3.0; if (Math.abs(r - R) < .55) continue; const c = (o.dotCol ? o.dotCol(i, t) : null) || STC.idle; K.box(sc, { x: Math.cos(a) * r - .1, y: Math.sin(a) * r - .1, z: 0, w: .2, d: .2, h: .38, color: c }); } }
  for (let i = 0; i < n; i++) { const [x, y] = phPos(i, n, R), st = o.st ? o.st(i) : 'idle', c = STC[st] || STC.idle; if (st === 'talk' || st === 'ok') K.groundCircle(sc, { c: [x, y, .03], r: .62, color: c, fillA: .25, w: 3 }); K.phone(sc, { p: [x, y, .02], scale: .72, color: c }); }
  for (const p of o.pk || []) { const [x, y] = phPos(p.i, n, R); if (p.k > 0 && p.k < 1) K.packet(sc, [x, y, .75], [0, 0, 1.25], p.k, { color: p.col || PAL.sky, r: 8, tail: .12 }); }
}
const roomChip = (sc, i, text, col, dy = -78) => { const [x, y] = phPos(i); hud(sc, [x, y, 1.0], text, { color: col, dy }); };

// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 1  BARS VS BUSY: bars fill (router is loud), then the lane to the phone jams while the bars stay full
const LA = [-4.6, 0], LB = [4.6, 0];
function card1() {
  const w = win('BARS VS BUSY'), at = w.at, end = w.end, tLoud = W(2, 'loud'), tNot = W(2, 'not'), tBusy = W(2, 'busy');
  const pts = frame(sqPts(-6.9, -2.3, 4.6, 4.6), sqPts(2.3, -2.3, 4.6, 4.6)), pj = frame([[LA[0], -2.2, 0], [LB[0] + 2, 2.2, 0], [0, 0, 1.2]]);
  const keys = [{ t: at, pts, zoom: 1.0 }, { t: tNot - .35, pts: pj, zoom: 1.12, dur: .8 }];
  const NP = 7;
  return { tag: 'BARS VS BUSY', at, end, seed: 31, keys, stills: [tLoud + .6, tNot + .5, tBusy + .45], draw(sc, t) {
    const V = sc.V; isle(sc, -6.9, -2.3, 4.6, 4.6, 41, { tufts: 6 }); isle(sc, 2.3, -2.3, 4.6, 4.6, 42, { tufts: 6 });
    K.road(sc, [LA[0], 0], [LB[0], 0], .9, { fill: PAL.road });
    K.box(sc, { x: LA[0] - .5, y: -.5, z: 0, w: 1, d: 1, h: .5, color: PAL.cream }); K.box(sc, { x: LA[0] - .3, y: -.3, z: .5, w: .6, d: .6, h: .22, color: PAL.violet });
    K.wifi(sc, { p: [LA[0], 0, 1.65], size: .95, color: PAL.sky });
    K.rings(sc, { p: [LA[0], 0, .06], n: 3, r: 2.0, r0: .5, color: PAL.sky, phase: (t * .5) % 1, alpha: pin01(t, at + .2, .4), w: 3 });
    K.phone(sc, { p: [LB[0], 0, .02], scale: 1.15, color: PAL.violet });
    const kb = Math.round(4 * pin01(t, tLoud - .2, .7)), pa = V.P(LB[0] + 1.3, 0, 1.4); bars(sc, [pa[0] - 24 * V.px, pa[1] - 8], kb, PAL.mint, 1.2);
    if (t > tLoud - .1) hud(sc, [LB[0], 0, 1.7], 'FULL BARS', { color: PAL.mint, dy: -46, alpha: pin01(t, tLoud, .3) });
    const tf = Math.min(t, tNot - .2), jam = io(t, tNot - .2, .9);
    for (let i = 0; i < NP; i++) { const free = ((tf * .42 + i / NP) % 1), jm = .1 + i * .075 + (i % 2) * .012, k = lerp(free, jm, jam), col = jam > .5 ? PAL.ember : PAL.sky; K.packet(sc, [LA[0] + .6, (i % 3 - 1) * .22, .3], [LB[0] - .8, (i % 3 - 1) * .22, .3], k, { color: col, r: 7, tail: jam > .5 ? .03 : .1 }); }
    if (t > tNot) hud(sc, [0, 0, .5], 'LANE FULL', { color: PAL.ember, dy: 62, alpha: pin01(t, tNot, .3) });
    if (t > tBusy - .1) hud(sc, [LB[0], 0, 1.7], '0 KB/S', { color: PAL.ember, dy: -2, alpha: pin01(t, tBusy - .1, .3) });
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 2  ONE SPEAKER: one room, one channel; a single phone is on air, the turn hops; then 200 phones fill the room, still one talks
function card2() {
  const w = win('ONE SPEAKER'), at = w.at, end = w.end, tRoom = W(4, 'room'), tSp = W(4, 'speaker'), tOnly = W(4, 'only'), tTime = W(4, 'time'), tH = W(5, 'hundred');
  const keys = [{ t: at, pts: ROOM_PTS, zoom: 1.0 }, { t: tH - .3, pts: ROOM_PTS, zoom: .9, dur: .8 }];
  const hop = t => t < tOnly ? 0 : Math.floor((t - tOnly) / .85) % NPH;
  return { tag: 'ONE SPEAKER', at, end, seed: 32, keys, stills: [tRoom + .5, tSp + .5, tTime - .2, tH + .6], draw(sc, t) {
    const V = sc.V, ta = t > tSp - .05, who = hop(t), crowd = pin01(t, tH - .1, .9);
    const st = i => ta && i === who ? 'talk' : 'idle';
    room(sc, t, { st, chan: PAL.sky, chanA: .07 + .12 * bell(t, tRoom, .8), crowd, pk: ta ? [{ i: who, k: ((t * 1.7) % 1), col: PAL.sky }, { i: who, k: ((t * 1.7 + .5) % 1), col: PAL.sky }] : [] });
    if (t > tRoom) { const a = phPos(0, NPH, RR + 1.35); hud(sc, [a[0] + .3, a[1], 0], 'ONE CHANNEL', { color: PAL.sky, dy: 34, alpha: pin01(t, tRoom, .3) * (1 - pin01(t, tSp + .8, .3)) }); }
    if (ta) roomChip(sc, who, 'ON AIR', PAL.sky);
    if (t > tOnly) hud(sc, [V.W / 2, V.H - 40], t > tH ? '200 PHONES · 1 TALKS' : '1 AT A TIME', { color: PAL.cream, alpha: pin01(t, tOnly, .3) });
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 3  TAKING TURNS: listen first -> quiet -> talk; then two start together
function card3() {
  const w = win('TAKING TURNS'), at = w.at, end = w.end, tTurn = W(6, 'turns'), tLis = W(6, 'listens'), tQ = W(6, 'quiet'), tTk = W(6, 'talks'), tTwo = W(7, 'two'), crash = W(8, 'crash');
  const keys = [{ t: at, pts: ROOM_PTS, zoom: 1.0 }];
  const tL = crash - 1.45;
  return { tag: 'TAKING TURNS', at, end, seed: 33, keys, stills: [tTurn + .3, tLis + .4, tQ + .25, tTk + .5, tL + 1.05], draw(sc, t) {
    const A = 0, B = 3, C = 6;   // A talks first, then B; two-together = B and C
    const aOn = t < tQ + .1, bOn = t >= tTk - .1 && t < tTwo - .15, two = t >= tL;
    const st = i => (i === A && aOn) || (i === B && (bOn || two)) || (i === C && two) ? 'talk' : (t > tLis - .1 && i === 4 ? 'listen' : 'idle');
    const quiet = t >= tQ && t < tTk;
    const pk = []; if (aOn && t > at + .2) pk.push({ i: A, k: (t * 1.7) % 1 }, { i: A, k: (t * 1.7 + .5) % 1 }); if (bOn) pk.push({ i: B, k: (t * 1.7) % 1 }, { i: B, k: (t * 1.7 + .5) % 1 });
    if (two) { const k = Math.min(.97, (t - tL) / (crash - tL)); pk.push({ i: B, k, col: PAL.saffron }, { i: C, k, col: PAL.saffron }); }
    room(sc, t, { st, chan: aOn || bOn ? PAL.saffron : (quiet ? PAL.mint : PAL.sky), chanA: aOn || bOn ? .16 : (quiet ? .18 : .07), pk });
    if (t > tLis && t < tQ + .2) { const [x, y] = phPos(4); K.rings(sc, { p: [x, y, .06], n: 2, r: 1.5, r0: .3, color: PAL.sky, phase: (t * .9) % 1, alpha: .9, w: 3 }); hud(sc, [x, y, 1.0], 'LISTEN', { color: PAL.sky, dy: -78, alpha: pin01(t, tLis, .25) }); }
    if (t > tTurn && t < tLis - .1) roomChip(sc, A, 'MY TURN', PAL.sky);
    if (quiet) hud(sc, [0, 0, 1.7], 'QUIET', { color: PAL.mint, dy: -70, alpha: pin01(t, tQ, .25) });
    if (t > tTk && t < tTwo - .1) roomChip(sc, B, 'TALKS', PAL.sky);
    if (two) hud(sc, [0, 0, 1.7], 'AT ONCE', { color: PAL.saffron, dy: -70, alpha: pin01(t, tTwo, .3) });
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 4  CRASH: the two packets hit; both back off a random time (different -> both get through; same -> crash forever)
function card4() {
  const w = win('CRASH'), at = w.at, end = w.end, crash = W(8, 'crash'), tL = crash - 1.45, tStop = W(8, 'stop'), tRnd = W(8, 'random'), tSame = W(10, 'same'), tFor = W(10, 'forever');
  const keys = [{ t: at, pts: ROOM_PTS, zoom: 1.0 }];
  const A = 3, B = 6, DEC = .4, WA = 3, WB = 7, tA = tRnd + WA * DEC, tB = tRnd + WB * DEC;   // phone A sends first (wait 3), phone B later (wait 7)
  const CY = .95, T0 = tSame + .15, crashT = n => T0 + n * CY + CY - .08;   // second phase: equal waits -> a crash every CY s
  return { tag: 'CRASH', at, end, seed: 34, keys, stills: [crash + .35, tRnd + .9, tA + .5, tB + .5, crashT(1) + .1, tFor + .3], draw(sc, t) {
    const V = sc.V, pk = [], st = {}; let chan = PAL.saffron, chanA = .16;
    const cnt = (t0, v) => Math.max(0, v - Math.floor((t - t0) / DEC));
    if (t < crash) { const k = Math.min(.97, (t - tL) / (crash - tL)); pk.push({ i: A, k, col: PAL.saffron }, { i: B, k, col: PAL.saffron }); st[A] = st[B] = 'talk'; }
    else if (t < tSame - .05) {
      if (t < tRnd - .25) { st[A] = st[B] = 'crash'; chan = PAL.ember; chanA = .24; }
      if (t >= crash && t < crash + .6) { const k = 1 - (t - crash) / .6; pk.push({ i: A, k, col: PAL.ember }, { i: B, k, col: PAL.ember }); }
      if (t >= tRnd - .25 && t < tA) { st[A] = 'wait'; st[B] = 'wait'; chan = PAL.sky; chanA = .07; }
      if (t >= tA && t < tB) { st[A] = 'ok'; st[B] = 'wait'; pk.push({ i: A, k: ((t - tA) * 1.2) % 1, col: PAL.mint }, { i: A, k: ((t - tA) * 1.2 + .5) % 1, col: PAL.mint }); chan = PAL.mint; chanA = .16; }
      if (t >= tB) { st[A] = 'idle'; st[B] = 'ok'; pk.push({ i: B, k: ((t - tB) * 1.2) % 1, col: PAL.mint }, { i: B, k: ((t - tB) * 1.2 + .5) % 1, col: PAL.mint }); chan = PAL.mint; chanA = .16; }
    } else {
      const n = Math.max(0, Math.floor((t - T0) / CY)), ph = (t - T0) - n * CY;   // cycle: wait (0..0.7), both send, crash at the end
      if (t < T0) { st[A] = st[B] = 'idle'; } else if (ph < .7) { st[A] = st[B] = 'wait'; chan = PAL.sky; chanA = .07; } else { const k = (ph - .7) / (CY - .7); st[A] = st[B] = k > .8 ? 'crash' : 'talk'; pk.push({ i: A, k: Math.min(.97, k * 1.2), col: PAL.saffron }, { i: B, k: Math.min(.97, k * 1.2), col: PAL.saffron }); chan = k > .8 ? PAL.ember : PAL.saffron; chanA = k > .8 ? .24 : .16; }
    }
    room(sc, t, { st: i => st[i] || 'idle', chan, chanA, pk });
    const burst = (tc, d = .6) => { if (t < tc || t > tc + d) return; const k = (t - tc) / d, c = V.P(0, 0, 1.2); let s = ''; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + .3, r1 = (14 + 60 * k) * V.px, r0 = (6 + 30 * k) * V.px; s += `<path d="M${f1(c[0] + Math.cos(a) * r0)},${f1(c[1] + Math.sin(a) * r0)}L${f1(c[0] + Math.cos(a) * r1)},${f1(c[1] + Math.sin(a) * r1)}" stroke="${rgba(PAL.ember, 1 - k)}" stroke-width="${f1(5 * V.px)}" stroke-linecap="round" filter="url(#glow)"/>`; } sc.add(s, 0, 'fx'); };
    burst(crash); if (t >= T0) for (let n = 0; n < 6; n++) burst(crashT(n), .45);
    if (t >= crash && t < tStop + .3) hud(sc, [0, 0, 1.7], 'CRASH', { color: PAL.ember, dy: -72, alpha: pin01(t, crash, .2) });
    if (t >= tStop && t < tSame - .05) {   // random waits: a chip over each phone with a counting number
      if (t >= tRnd - .25 && t < tA + .3) hud(sc, [...phPos(A), 1.0], t < tA ? `WAIT ${cnt(tRnd, WA)}` : 'GO', { color: t < tA ? PAL.saffron : PAL.mint, dy: -78 });
      if (t >= tRnd - .25 && t < tB + .3) hud(sc, [...phPos(B), 1.0], t < tB ? `WAIT ${cnt(tRnd, WB)}` : 'GO', { color: t < tB ? PAL.violet : PAL.mint, textColor: t < tB ? PAL.cream : PAL.mint, dy: -78 });
      if (t >= tA && t < tA + 1) tickG(sc, V.P(...phPos(A), 1.9), PAL.mint, 1 - prog(t, tA + .6, tA + 1), 38);
      if (t >= tB && t < tB + 1) tickG(sc, V.P(...phPos(B), 1.9), PAL.mint, 1 - prog(t, tB + .6, tB + 1), 38);
    }
    if (t >= tSame - .05) {
      const n = Math.max(0, Math.floor((t - T0) / CY)), ph = (t - T0) - n * CY, left = Math.max(0, 5 - Math.floor(ph / .14));
      if (t < T0) for (const i of [A, B]) hud(sc, [...phPos(i), 1.0], 'WAIT 5', { color: PAL.saffron, dy: -78 });
      else if (ph < .7) for (const i of [A, B]) hud(sc, [...phPos(i), 1.0], `WAIT ${left}`, { color: PAL.saffron, dy: -78 });
      const c = n + (ph > .9 ? 1 : 0);
      if (t >= tFor) hud(sc, [V.W / 2, V.H - 40], 'CRASH AGAIN  ∞', { color: PAL.ember });
      else if (c >= 1) hud(sc, [V.W / 2, V.H - 40], `CRASH AGAIN  x${c}`, { color: PAL.ember });
    }
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 5  THE CROWD: more phones -> the airtime strip fills with crashes and waiting; the data share (one turn) collapses
function card5() {
  const w = win('THE CROWD'), at = w.at, end = w.end, tMore = W(11, 'more'), tCr = W(11, 'crashes'), tWt = W(12, 'waiting'), tTh = W(12, 'thinner');
  const keys = [{ t: at, pts: ROOM_PTS, zoom: .86 }];
  const NC = 28, cellOf = (j, c) => { const r = rng(j * 977 + 13)(); const d = .78 - .66 * c, cr = .04 + .5 * c; return r < d ? 'data' : (r < d + cr ? 'crash' : 'wait'); };
  return { tag: 'THE CROWD', at, end, seed: 35, keys, stills: [tMore + .3, tCr + .5, tWt + .6, tTh + .35], draw(sc, t) {
    const V = sc.V, c = io(t, tMore - .1, 2.4), dotCol = (i, tt) => { const f = Math.floor(tt * 3 + i * .37) % 11; return f < Math.round(c * 5) ? PAL.ember : STC.idle; };
    room(sc, t, { st: () => 'idle', chan: mix(PAL.sky, PAL.ember, c), chanA: .08 + .14 * c, crowd: .15 + .85 * c, dotCol, pulse: .5 * c, pulseCol: PAL.ember });
    const sx0 = 80, sw = V.W - 160, cw = sw / NC, y = V.H - 60, scroll = (t * 4) % 1, base = Math.floor(t * 4); let s = '';
    for (let j = 0; j < NC + 1; j++) { const kind = cellOf(base + j, c), col = kind === 'data' ? PAL.mint : kind === 'crash' ? PAL.ember : mix(PAL.violet, PAL.ink, .4), x = sx0 + (j - scroll) * cw; if (x < sx0 - 1 || x + cw > sx0 + sw + 1) continue; s += `<rect x="${f1(x + 2)}" y="${f1(y - 22)}" width="${f1(cw - 4)}" height="${f1(44)}" rx="5" fill="${col}"/>`; }
    sc.add(s, 0, 'hud'); const share = Math.round((.78 - .66 * c) * 100);
    hud(sc, [V.W / 2, y - 60], t > tTh - .1 ? `ONE TURN IN ${Math.round(8 + 192 * c)}` : `AIRTIME: DATA ${share}%`, { color: t > tTh - .1 ? PAL.coral : PAL.mint });
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 6  SLOW PHONE: the airtime ribbon scrolls through "ON AIR NOW"; the slow phone's message is one long block, everyone queues behind it
function card6() {
  const w = win('SLOW PHONE'), at = w.at, end = w.end, tSl = W(14, 'slow'), tLg = W(14, 'longer'), tWt = W(14, 'waits');
  const keys = [{ t: at, pts: frame([[-7.2, -3.2, 0], [7.2, 2.6, 0], [0, 0, 1.6]]), zoom: 1.0 }];
  const SP = 2.2, NOW = -2.4, DUR = 3.0, XL = -7.2, XR = 7.2;
  const seq = []; { let s = 0; for (const [k, d] of [['F', .5], ['F', .5], ['F', .5], ['S', DUR], ['F', .5], ['F', .5], ['F', .5], ['F', .5], ['F', .5], ['F', .5]]) { seq.push({ k, s, d }); s += d; } }
  const FC = [PAL.sky, PAL.violet, PAL.saffron, PAL.sky, PAL.violet, PAL.saffron, PAL.sky, PAL.violet, PAL.saffron];
  return { tag: 'SLOW PHONE', at, end, seed: 36, keys, stills: [at + 1.0, tLg + .5, tWt + .45], draw(sc, t) {
    K.slab(sc, { x: XL - .2, y: -1.0, w: XR - XL + .4, d: 2.0, z: 0, h: .12, r: .2, color: mix(PAL.violet, PAL.ink, .45) });
    const tS = t - (tSl - .3) + seq[3].s;   // ribbon clock: the slow block's front edge reaches NOW a bit before "slow"
    seq.forEach((b, i) => {
      const xs = (b.s - tS) * SP + NOW, xe = xs + b.d * SP; if (xe < XL || xs > XR) return;
      const a = Math.max(xs, XL), e = Math.min(xe, XR), slow = b.k === 'S';
      K.slab(sc, { x: a + .04, y: -.8, w: Math.max(.05, e - a - .08), d: 1.6, z: .12, h: slow ? .55 : .4, r: .12, color: slow ? PAL.ember : FC[i % FC.length] });
    });
    K.beam(sc, [NOW, -1.5, .14], [NOW, 1.5, .14], { color: PAL.mint, alpha: .95, w: 4 });
    hud(sc, [NOW, 1.2, .2], 'ON AIR NOW', { color: PAL.mint, dy: 50 });
    const sb = seq[3], sxs = (sb.s - tS) * SP + NOW, sxe = sxs + sb.d * SP;
    if (sxe > XL + 1 && sxs < XR - 1) { const mid = (Math.max(sxs, XL) + Math.min(sxe, XR)) / 2; hud(sc, [mid, 0, .9], 'SLOW PHONE', { color: PAL.ember, dy: -74, alpha: pin01(t, tSl - .2, .3) }); }
    if (t > tWt - .1) hud(sc, [4.0, 0, .7], 'EVERYONE WAITS', { color: PAL.coral, dy: 78, alpha: pin01(t, tWt - .1, .3) });
    for (let i = 0; i < 3; i++) K.phone(sc, { p: [3.6 + i * 1.2, -2.2, 0], scale: .7, color: t > tLg ? STC.wait : FC[i] });
    if (t > tLg) hud(sc, [4.8, -2.2, 1.0], 'WAITING', { color: PAL.saffron, dy: -62, alpha: pin01(t, tLg, .3) });
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 7  THE STREET: six houses, six routers, three channels (CH 1 / 6 / 11) -> the rings overlap in the same rooms
const CH = [{ x: -4.4, col: PAL.coral, n: 'CH 1' }, { x: 0, col: PAL.sky, n: 'CH 6' }, { x: 4.4, col: PAL.saffron, n: 'CH 11' }];
function card7() {
  const w = win('THE STREET'), at = w.at, end = w.end, tNb = W(15, "neighbor's"), tSame = W(16, 'same'), tThree = W(16, 'three'), tCl = W(16, 'clear'), tStr = W(16, 'street'), tSh = W(16, 'shares');
  const keys = [{ t: at, pts: frame([[-7.6, -4.4, 0], [7.6, 4.4, 0], [0, 0, 2.2]]), zoom: 1.0 }];
  const HS = [[-4.4, -2.7], [0, -2.7], [4.4, -2.7], [-4.4, 2.7], [0, 2.7], [4.4, 2.7]];   // house centres; channel = column
  return { tag: 'THE STREET', at, end, seed: 37, keys, stills: [tNb + .5, tSame + .5, tThree + .5, tCl + .6, tSh + .5], draw(sc, t) {
    const V = sc.V; isle(sc, -7.6, -4.6, 15.2, 9.2, 81, { tufts: 6, avoid: (x, y) => Math.abs(y) < 5 });
    K.road(sc, [-7.2, 0], [7.2, 0], 1.1, { fill: PAL.road });
    const own = 4;   // house 4 (front middle) is "my" router
    HS.forEach(([x, y], i) => { const col = [mix(PAL.coral, PAL.ink, .25), mix(PAL.saffron, PAL.ink, .3), mix(PAL.sky, PAL.violet, .4)][i % 3]; K.building(sc, { x: x - .6, y: y - .6, w: 1.2, d: 1.2, h: 1.1 + (i % 2) * .4, color: col, seed: 10 + i, litP: .5 }); });
    const showR = i => i === own ? 1 : pin01(t, tNb + (i % 5) * .08, .3);
    HS.forEach(([x, y], i) => { if (showR(i) > .05) K.wifi(sc, { p: [x, y, 1.1 + (i % 2) * .4 + .55], size: .6, color: i === own ? PAL.mint : PAL.sky }); });
    const busy = pin01(t, tStr - .1, .5);
    CH.forEach((c, j) => { const a = pin01(t, tThree + j * .28, .4); if (a > .02) K.groundCircle(sc, { c: [c.x, 0, .03], r: 3.1, color: busy > .3 ? mix(c.col, PAL.ember, .35 * busy) : c.col, fillA: (.08 + .12 * busy) * a, w: 3.4 * a }); });
    CH.forEach((c, j) => { const a = pin01(t, tThree + j * .28, .4); if (a > .5) hud(sc, [c.x, 0, .4], c.n, { color: c.col, alpha: a }); });
    HS.forEach(([x, y], i) => { const col = CH[i % 3].col; if (t > tSame - .1 && showR(i) > .5) K.rings(sc, { p: [x, y, .06], n: 3, r: 3.0, r0: .6, color: col, phase: (t * .5 + i * .17) % 1, alpha: .85 * pin01(t, tSame, .5), w: 3 }); else if (showR(i) > .5 || i === own) K.rings(sc, { p: [x, y, .06], n: 2, r: 2.2, r0: .6, color: i === own ? PAL.mint : PAL.sky, phase: (t * .5 + i * .17) % 1, alpha: .7 * showR(i), w: 3 }); });
    if (t > at + .1 && t < tNb) hud(sc, [HS[own][0], HS[own][1], 2.4], 'MY ROUTER', { color: PAL.mint, dy: 20 });
    if (t >= tNb && t < tSame - .1) hud(sc, [V.W / 2, V.H - 40], 'EVERY HOUSE HAS ONE', { color: PAL.cream, alpha: pin01(t, tNb, .3) });
    if (t >= tSame && t < tThree - .2) hud(sc, [V.W / 2, V.H - 40], 'SAME ROOM', { color: PAL.saffron, alpha: pin01(t, tSame, .3) });
    if (t >= tThree) hud(sc, [V.W / 2, V.H - 40], t > tStr - .1 ? 'THE STREET SHARES THEM' : 'OLD BAND: 3 CLEAR CHANNELS', { color: t > tStr - .1 ? PAL.coral : PAL.cream });
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 8  THE FIX: fast band = many new lanes; cable = a private lane into its own room
function card8() {
  const w = win('THE FIX'), at = w.at, end = w.end, tFast = W(18, 'fast'), tCab = W(18, 'cable'), tOwn = W(18, 'own');
  const keys = [{ t: at, pts: frame(sqPts(-7.4, -2.5, 5, 5), sqPts(1.8, -2.5, 5.2, 5)), zoom: 1.0 }];
  const R = [-4.9, 0], P = [4.4, 0];
  return { tag: 'THE FIX', at, end, seed: 38, keys, stills: [tFast + .55, tCab + .4, tOwn + .5], draw(sc, t) {
    isle(sc, -7.4, -2.5, 5, 5, 91, { tufts: 6 }); isle(sc, 1.8, -2.5, 5.2, 5, 92, { tufts: 6 });
    K.box(sc, { x: R[0] - .5, y: -.5, z: 0, w: 1, d: 1, h: .5, color: PAL.cream }); K.box(sc, { x: R[0] - .3, y: -.3, z: .5, w: .6, d: .6, h: .22, color: PAL.violet }); K.wifi(sc, { p: [R[0], 0, 1.6], size: .85, color: PAL.sky });
    const nl = Math.round(6 * pin01(t, tFast, .9));   // fast band: six new thin lanes, each with a quick packet
    for (let j = 0; j < nl; j++) { const y = -2.0 + j * .8, a = [R[0] + .8, y * .5, .5], b = [-1.6, y, .3]; K.beam(sc, a, b, { color: PAL.sky, alpha: .7, w: 2.6 }); K.packet(sc, a, b, ((t * .9 + j * .31) % 1), { color: PAL.sky, r: 6, tail: .12 }); }
    if (t > tFast) hud(sc, [-3.0, 0, 2.4], 'FAST BAND: MORE LANES', { color: PAL.sky, dy: -20, alpha: pin01(t, tFast, .3) * (1 - pin01(t, tCab + .2, .3)) });
    const kc = io(t, tCab - .1, .8);
    if (kc > .01) { const p = [P[0] - 1.0, 0, .6], a = [R[0] + .6, .6, .4]; K.cable(sc, a, [a[0] + (p[0] - a[0]) * kc, a[1] + (p[1] - a[1]) * kc, a[2] + (p[2] - a[2]) * kc], { color: PAL.mint, w: 7, sag: .35 }); }
    K.slab(sc, { x: P[0] - .9, y: -.55, w: 1.8, d: 1.1, z: 0, h: .32, r: .1, color: mix(PAL.violet, PAL.ink, .2) }); K.slab(sc, { x: P[0] - .7, y: -.4, w: 1.4, d: .8, z: .32, h: .08, r: .05, color: PAL.cream });
    if (kc > .9) for (let i = 0; i < 3; i++) K.packet(sc, [R[0] + .6, .6, .4], [P[0] - 1.0, 0, .6], ((t * .8 + i / 3) % 1), { color: PAL.mint, r: 7, tail: .1 });
    const ko = pin01(t, tOwn - .2, .6); if (ko > .02) K.groundCircle(sc, { c: [P[0], 0, .03], r: 2.1 * ko, color: PAL.mint, fillA: .12, w: 3.4 });
    if (t > tCab) hud(sc, [P[0], 0, 1.1], t > tOwn - .2 ? 'OWN ROOM' : 'CABLE', { color: PAL.mint, dy: -60, alpha: pin01(t, tCab, .3) });
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// the layout switch re-frames the scene, so a card enters/leaves ON a shot cut when one is close
const cuts = (E.shots || []).map(x => x.t0).filter(x => x > 0);
const snap = (t, lo, hi) => { const c = cuts.filter(x => x >= t - lo && x <= t + hi).sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0]; return c ?? t; };
export const CARDS = [card1(), card2(), card3(), card4(), card5(), card6(), card7(), card8()].map(c => ({ ...c, at: snap(c.at, .35, .05), end: snap(c.end, .4, .1) })).map(c => ({ ...c, stills: c.stills.filter(x => x > c.at + .3 && x < c.end - .35) }));
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
