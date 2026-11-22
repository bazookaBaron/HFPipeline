// autocorrect MG: six iso cards (STORYBOARD.md) built from mg/isokit. Every card is its own small floating world and a pure function of global episode time t.
// Recurring objects: a keyboard strip (G H J K), the coral thumb blob, word chips, and the SCORE BARS (sky = thumb spot, saffron = word before, mint = how common).
// Word times come from shots.json at load time (W(line, word)). Engine contract (engine/mg-adapter.js): default export (mg, {ratio}) adds mg.beat()s; 9:16 uses 'float'.
// Build: cat mg.part.js _footer.js > mg.js
import { PAL, mix, rgba, f1, pt, poly, line, rng, createScene } from '../../mg/isokit/core.js';
import * as K from '../../mg/isokit/prims.js';
import { background } from '../../mg/isokit/stage.js';
import { ease, prog } from '../../mg/isokit/motion.js';
import { camRig, viewAt } from '../../mg/isokit/camera.js';

const E = await (await fetch(new URL('./shots.json', import.meta.url))).json();
const BE = await (await fetch(new URL('./mg.beats.json', import.meta.url))).json();
const win = n => { const c = BE.cues.find(x => x.name === n); if (!c) throw new Error('autocorrect mg: no beat ' + n); return c; };
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
// tolerant word lookup: exact, then prefix either way (ASR spelling: neighbors / neighbours), then an index fallback
export const W = (line, word, nth = 0) => {
  const ws = E.words.filter(w => w.line === line), n = norm(word);
  let c = ws.filter(w => norm(w.w) === n); if (!c.length) c = ws.filter(w => norm(w.w).length >= 3 && n.length >= 3 && (norm(w.w).startsWith(n.slice(0, 3)) || n.startsWith(norm(w.w).slice(0, 3))));
  if (!c[nth]) throw new Error(`autocorrect mg: no word "${word}" #${nth} in line ${line}`); return c[nth].s;
};
const pin01 = (t, a, d = .5) => ease.p3out(prog(t, a, a + d));
const io = (t, a, d) => ease.p2io(prog(t, a, a + d));
const hud = (sc, a, text, o = {}) => K.hud(sc, a, text, { size: 34, ...o });          // 34 * .85 = 28.9 px
const lerp = (a, b, k) => a + (b - a) * k;
const frac = x => x - Math.floor(x);
const corners = (x0, y0, x1, y1, z = 0) => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
const isl = (sc, x0, y0, x1, y1, seed) => K.island(sc, { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: .9, th: 1.1, seed, tufts: 8 });
const txt = (sc, p, str, o = {}) => { const a = sc.V.P(p), fs = (o.size ?? 44) * sc.V.px; sc.add(`<text x="${f1(a[0])}" y="${f1(a[1] + fs * .34)}" text-anchor="middle" font-family="Geist Mono, monospace" font-weight="500" font-size="${f1(fs)}" fill="${o.color || PAL.ink}" opacity="${(o.alpha ?? 1).toFixed(2)}">${str}</text>`, sc.V.dep(p[0], p[1], p[2]) + .05, 'world'); };
const tick = (sc, [x, y], col, a = 1, s = 34) => sc.add(`<path d="M${f1(x - s * .5)},${f1(y)}L${f1(x - s * .12)},${f1(y + s * .4)}L${f1(x + s * .6)},${f1(y - s * .5)}" fill="none" stroke="${rgba(col, a)}" stroke-width="${f1(7 * sc.V.px)}" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>`, 0, 'hud');
const dash = (sc, a, b, col, k = 1, a0 = .9) => { const A = sc.V.P(a), B = sc.V.P(b), e = [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k]; if (k > .02) sc.add(`<path d="M${pt(A)}L${pt(e)}" stroke="${rgba(col, a0)}" stroke-width="${f1(4 * sc.V.px)}" stroke-dasharray="${f1(12 * sc.V.px)} ${f1(9 * sc.V.px)}" stroke-linecap="round" fill="none"/>`, 0, 'air'); };
const SC = .03;                                  // world height per score point
// ---- the keyboard strip: G H J K (pitch 1.7, key 1.45). H = x -1.7, J = x 0 -> the gap between them is at x -0.125
const KEY = { w: 1.45, y: -0.4, x: { G: -3.4, H: -1.7, J: 0, K: 1.7 } };
function keycap(sc, ch, o = {}) {
  const x = KEY.x[ch], h = .35 + (o.dip ? -.12 * o.dip : 0), lit = o.lit ?? 0;
  K.box(sc, { x, y: KEY.y, z: 0, w: KEY.w, d: KEY.w, h, color: mix(mix(PAL.violet, PAL.cream, .6), o.col || PAL.coral, lit * .75) });
  txt(sc, [x + KEY.w / 2, KEY.y + KEY.w / 2, h + .01], ch, { size: 44, color: PAL.ink });
}
const keyC = ch => [KEY.x[ch] + KEY.w / 2, KEY.y + KEY.w / 2];
// the thumb blob: a soft coral patch on the keys at (x, y), height z (in the air = falling, 0.4 = pressed)
function blob(sc, x, y, z, r, a = .7) {
  const V = sc.V, c = V.P(x, y, z), rx = r * V.s;
  sc.add(`<ellipse cx="${f1(c[0])}" cy="${f1(c[1])}" rx="${f1(rx)}" ry="${f1(rx * V.K)}" fill="${rgba(PAL.coral, a * .55)}" stroke="${rgba(PAL.coral, a)}" stroke-width="${f1(5 * V.px)}"/>`, V.dep(x, y, z) + 2, 'fx');
}
// a score stack (sky thumb, saffron before, mint common) at world x; returns the top height
function stack(sc, x, y, s, col0) {
  let z = 0; const parts = [[s.thumb || 0, PAL.sky], [s.before || 0, PAL.saffron], [s.common || 0, PAL.mint]];
  for (const [v, c] of parts) { const h = v * SC; if (h > .02) { K.box(sc, { x, y, z, w: 1.1, d: 1.1, h, color: c }); z += h; } }
  return z;
}
const keysFor = (at, extra = 3.2) => [{ t: at, pts: [...corners(-5.2, -3.0, 5.2, 2.6), [0, 0, extra]], zoom: 1.0 }];

// ============================================================================================================================
// CARD 1  BETWEEN TWO KEYS: the thumb falls onto the keyboard and covers H and J at once; the field types "jello"
function card1() {
  const w = win('BETWEEN TWO KEYS'), at = w.at, end = w.end, tH = W(1, 'hello'), tJ = W(1, 'jello'), tTh = W(2, 'thumb'), tBe = W(2, 'between'), tN = W(2, 'neighbors');
  const tag = t => t < tTh ? 'HELLO TO JELLO' : t < tN ? 'ONE THUMB, TWO KEYS' : 'H AND J TOUCH';
  return { tag, at, end, seed: 71, keys: keysFor(at), stills: [tH + .6, tJ + .3, tBe + .5, tN + .5], draw(sc, t) {
    const V = sc.V; isl(sc, -5.6, -3.4, 5.4, 2.8, 71);
    const fall = io(t, tH - .35, .55), pressed = fall > .98, both = pin01(t, tH + .1, .3);
    for (const ch of ['G', 'H', 'J', 'K']) keycap(sc, ch, { lit: (ch === 'H' || ch === 'J') ? both : 0, dip: (ch === 'H' || ch === 'J') ? both : 0, col: PAL.coral });
    // the typed field behind the keys
    K.slab(sc, { x: -3.6, y: -2.9, z: 0, w: 7.6, d: 1.5, h: .3, r: .3, color: mix(PAL.violet, PAL.ink, .5) });
    const typed = t < tJ ? 'hello' : 'jello';
    txt(sc, [.2, -2.15, .32], typed, { size: 52, color: t < tJ ? PAL.cream : PAL.saffron });
    if (t >= tJ) K.rings(sc, { p: [.2, -2.15, .4], n: 2, r: 1.6, r0: .5, color: PAL.saffron, phase: (t - tJ) * 1.2, alpha: .85 * (1 - prog(t, tJ + 1.0, tJ + 1.6)), w: 3 });
    blob(sc, -.125, KEY.y + .72, lerp(3.4, .42, fall), 1.12, .3 + .7 * fall);
    if (pressed) K.rings(sc, { p: [-.125, KEY.y + .72, .45], n: 2, r: 2.0, r0: .6, color: PAL.coral, phase: (t - tH) * .9, alpha: .7 * (1 - prog(t, tH + 1.2, tH + 1.8)), w: 3 });
    // 2nd half: the thumb is wider than one key
    const k2 = pin01(t, tBe - .1, .5);
    if (k2 > .02) { K.dim(sc, [-.125 - 1.12, KEY.y + 2.2, .5], [-.125 + 1.12, KEY.y + 2.2, .5], { color: PAL.coral, k: k2, label: 'THUMB', size: 34 }); K.dim(sc, [-1.7, KEY.y + 2.9, .5], [-.25, KEY.y + 2.9, .5], { color: PAL.cream, k: k2, label: 'ONE KEY', size: 34, ldy: 4, ldx: -90 }); }
    hud(sc, V.P(-.125, KEY.y - 1.4, 1.4), 'H? J?', { color: PAL.saffron, alpha: pin01(t, tBe + .1, .3) });
  } };
}
// ============================================================================================================================
// CARD 2  CLUE 1, WHERE: two candidate words over their keys, dashed distances from the touch, equal thumb bars
function card2() {
  const w = win('CLUE 1'), at = w.at, end = w.end, tG = W(5, 'guesses'), tF = W(6, 'first'), tWh = W(6, 'thumb'), tKn = W(6, 'knows');
  const tag = t => t < tF ? 'GUESSES HOW' : 'CLUE 1: WHERE';
  return { tag, at, end, seed: 72, keys: keysFor(at, 3.8), stills: [tG + .4, tF + .6, tWh + 1.0, tKn + .3], draw(sc, t) {
    const V = sc.V; isl(sc, -5.6, -3.4, 5.4, 2.8, 72);
    for (const ch of ['G', 'H', 'J', 'K']) keycap(sc, ch, { lit: (ch === 'H' || ch === 'J') ? .5 : 0 });
    blob(sc, -.125, KEY.y + .72, .42, 1.12, .9);
    const cH = keyC('H'), cJ = keyC('J'), d = pin01(t, tWh - .1, .7), bars = pin01(t, tKn - .6, .6);
    dash(sc, [-.125, KEY.y + .72, .6], [cH[0], cH[1], .6], PAL.sky, d); dash(sc, [-.125, KEY.y + .72, .6], [cJ[0], cJ[1], .6], PAL.sky, d);
    // the two candidates float over their keys, each with a thumb-fit bar
    for (const [nm, ch, x] of [['hello', 'H', -2.0], ['jello', 'J', 1.7]]) {
      const h = 48 * bars; K.box(sc, { x: x - .55, y: -2.9, z: 0, w: 1.1, d: 1.1, h: .05 + h * SC, color: PAL.sky });
      hud(sc, V.P(x, -2.35, .05 + h * SC + .9), nm, { color: PAL.cream, alpha: pin01(t, tG + .2, .3) });
    }
    if (bars > .5) hud(sc, V.P(-.15, -2.35, 3.0), 'TIE', { color: PAL.saffron, alpha: pin01(t, tKn - .1, .3) });
    hud(sc, V.P(-.125, 1.6, 1.0), 'WHERE IT LANDED', { color: PAL.sky, alpha: pin01(t, tF + .2, .3) });
  } };
}
// ============================================================================================================================
// CARD 3  CLUE 2, THE WORDS BEFORE: "pudding" sits before the slot; a saffron link feeds JELLO's bar
function card3() {
  const w = win('CLUE 2'), at = w.at, end = w.end, tO = W(7, 'other'), tB = W(8, 'before'), tP = W(8, 'pudding'), tF = W(9, 'fair');
  const tag = t => t < tB ? 'WHAT IS THE OTHER CLUE' : t < tP ? 'CLUE 2: WORDS BEFORE' : 'PUDDING PULLS JELLO';
  return { tag, at, end, seed: 73, keys: keysFor(at, 4.0), stills: [tO + .5, tB + .6, tP + .5, tF + .6], draw(sc, t) {
    const V = sc.V; isl(sc, -5.6, -3.4, 5.4, 2.8, 73);
    const grow = io(t, tP + .1, .9), pop = pin01(t, tP - .15, .4);
    // the sentence so far: [pudding] -> [ _ ]
    K.slab(sc, { x: -4.8, y: -3.0, z: 0, w: 4.2, d: 1.3, h: .4, r: .3, color: mix(PAL.violet, PAL.cream, .3) });
    txt(sc, [-2.7, -2.35, .42], 'pudding', { size: 44, color: PAL.ink, alpha: pop });
    K.slab(sc, { x: -.2, y: -3.0, z: 0, w: 2.1, d: 1.3, h: .4, r: .3, color: mix(PAL.violet, PAL.ink, .4) });
    txt(sc, [.85, -2.35, .42], '___', { size: 44, color: PAL.cream });
    K.arrow(sc, [-.55, -2.35, .6], [-.25, -2.35, .6], { color: PAL.saffron, w: 4, alpha: pop });
    // bars: thumb tie (sky) + the word-before boost (saffron) on jello only
    const bx = [[-2.2, 'hello', 0], [1.9, 'jello', 45]];
    for (const [x, nm, bf] of bx) { const top = stack(sc, x, 0.9, { thumb: 48, before: bf * grow }); hud(sc, V.P(x + .55, 1.45, top + .9), nm, { color: nm === 'jello' ? PAL.saffron : PAL.cream, alpha: pin01(t, tO + .2, .3) }); }
    // the link from "pudding" to the jello bar
    if (pop > .05) { const a = V.P(-2.7, -2.3, .8), b = V.P(1.9, .2, 2.3 * (.5 + .5 * grow) + .5); sc.add(`<path d="M${pt(a)}Q${f1((a[0] + b[0]) / 2)},${f1(Math.min(a[1], b[1]) - 60 * V.px)} ${pt(b)}" fill="none" stroke="${rgba(PAL.saffron, .9 * pop)}" stroke-width="${f1(5 * V.px)}" stroke-linecap="round" stroke-dasharray="${f1(14 * V.px)} ${f1(9 * V.px)}"/>`, 0, 'air'); }
    if (grow > .5) tick(sc, V.P(1.9, 1.2, 3.8 + 0.01).map((v, i) => v + (i ? 0 : 0)), PAL.mint, pin01(t, tF - .3, .3));
    hud(sc, V.P(-.3, 2.0, 1.2), '+ WORD BEFORE', { color: PAL.saffron, alpha: pin01(t, tP + .4, .3) });
  } };
}
// ============================================================================================================================
// CARD 4  SCORES EVERY WORD: a belt of thousands of word chips; each gets three bars; the top score wins in a blink
function card4() {
  const w = win('SCORES'), at = w.at, end = w.end, tS = W(10, 'scores'), tEv = W(10, 'every'), tCo = W(10, 'common'), tTop = W(10, 'top');
  const tag = t => t < tCo ? 'SCORES EVERY WORD' : 'TOP SCORE WINS';
  return { tag, at, end, seed: 74, keys: keysFor(at, 4.4), stills: [tS + .4, tCo + .3, tTop + .7, tTop + 1.2], draw(sc, t) {
    const V = sc.V; isl(sc, -6.0, -3.4, 6.0, 2.8, 74);
    // a belt of word blocks sliding left to right behind the scoreboard
    const R = rng(11), belt = pin01(t, tS - .2, .4);
    K.slab(sc, { x: -5.6, y: -3.0, z: 0, w: 11.2, d: 1.1, h: .15, r: .3, color: mix(PAL.violet, PAL.ink, .5) });
    for (let i = 0; i < 14; i++) { const x = -5.4 + ((i * .82 + t * 2.6) % 11.4), sh = (.5 + R() * .5), cl = [PAL.coral, PAL.sky, PAL.saffron, PAL.violet, PAL.mint][i % 5]; if (x < -5.3 || x > 5.4) continue; K.box(sc, { x, y: -2.85, z: .15, w: .6 * sh + .3, d: .8, h: .35, color: mix(cl, PAL.cream, .2), opacity: belt }); }
    // the scoreboard: three words, three layers each
    const th = pin01(t, tS + .1, .6), bf = pin01(t, tS + .6, .6), cm = pin01(t, tCo - .15, .6), win2 = pin01(t, tTop + .35, .4);
    const rows = [[-3.6, 'jolly', 30, 4, 6], [-1.2, 'hello', 50, 4, 40], [1.2, 'jello', 50, 45, 8], [3.6, 'hells', 20, 4, 18]];
    for (const [x, nm, a, b, c] of rows) { const jl = nm === 'jello'; const top = stack(sc, x - .55, 0.1, { thumb: a * th, before: b * bf, common: c * cm }); hud(sc, V.P(x, .8, top + .9 + (jl ? win2 * .4 : 0)), nm, { color: jl && win2 > .5 ? PAL.mint : PAL.cream, alpha: pin01(t, tS, .3) }); }
    // legend
    const lg = pin01(t, tCo - .1, .3); hud(sc, V.P(-4.6, 2.2, 0.6), 'THUMB', { color: PAL.sky, alpha: th, size: 30 }); hud(sc, V.P(-1.6, 2.2, 0.6), 'BEFORE', { color: PAL.saffron, alpha: bf, size: 30 }); hud(sc, V.P(1.5, 2.2, 0.6), 'COMMON', { color: PAL.mint, alpha: lg, size: 30 });
    if (win2 > .1) { K.rings(sc, { p: [1.2, .1, 4.4], n: 2, r: 1.4, r0: .3, color: PAL.mint, phase: t * .9, alpha: win2 * .9, w: 3 }); tick(sc, V.P(1.2, .6, 5.5), PAL.mint, win2); }
  } };
}
// ============================================================================================================================
// CARD 5  THOUSANDS, IN A BLINK: the belts of word blocks speed up, a counter spins, a stopwatch reads under a blink
function card5() {
  const w = win('THOUSANDS'), at = w.at, end = w.end, tT = W(12, 'thousands'), tIn = W(12, 'in'), tBl = W(12, 'blink');
  const tag = t => t < tIn ? 'THOUSANDS' : 'IN A BLINK';
  return { tag, at, end, seed: 79, keys: keysFor(at, 3.4), stills: [tT + .3, tIn + .2, tBl + .3, tBl + .8], draw(sc, t) {
    const V = sc.V; isl(sc, -6.0, -3.4, 6.0, 2.8, 79);
    const R = rng(21), sp = lerp(3.2, 7.5, io(t, tIn - .3, 1.0));
    for (let r = 0; r < 3; r++) {
      K.slab(sc, { x: -5.6, y: -3.0 + r * 1.55, z: 0, w: 11.2, d: 1.0, h: .12, r: .3, color: mix(PAL.violet, PAL.ink, .5) });
      for (let i = 0; i < 12; i++) { const x = -5.4 + ((i * .95 + t * sp * (r % 2 ? -1 : 1) + r * 3.1) % 11.4 + 11.4) % 11.4, sh = .4 + R() * .5, cl = [PAL.coral, PAL.sky, PAL.saffron, PAL.violet, PAL.mint][(i + r) % 5]; if (x < -5.3 || x > 5.4) continue; K.box(sc, { x, y: -2.9 + r * 1.55, z: .12, w: .7 * sh + .3, d: .8, h: .35, color: mix(cl, PAL.cream, .2) }); }
    }
    const ctr = Math.floor(lerp(0, 4800, prog(t, tT - .1, tBl + .3)));
    hud(sc, V.P(-2.6, 2.0, .6), ctr.toLocaleString('en-US') + '+ WORDS', { color: PAL.cream, alpha: pin01(t, tT - .1, .3) });
    const ck = pin01(t, tIn, .4); if (ck > .02) { const a = prog(t, tIn, tBl + .6); K.clock(sc, { c: [3.6, 1.2, 1.7], r: 1.0 * ck, min: a * 2 * Math.PI * .08, hour: 0, color: PAL.mint }); hud(sc, V.P(3.6, 1.2, 3.7), 'BLINK', { color: PAL.mint, alpha: ck }); }
  } };
}
// ============================================================================================================================
// CARD 6  YOUR OWN LIST: kept words fly into a violet notebook and get a tick
function card6() {
  const w = win('YOUR LIST'), at = w.at, end = w.end, tKn = W(13, 'know'), tTe = W(14, 'teach'), tKe = W(14, 'keep'), tLi = W(14, 'list');
  const tag = t => t < tTe ? 'KNOWS ME?' : t < tKe ? 'YOU TEACH IT' : 'YOUR OWN LIST';
  const rows = [['Moe', tKe - .1], ['Priya', tKe + .5], ['bhel', tLi - .2]];
  return { tag, at, end, seed: 75, keys: keysFor(at, 3.6), stills: [tTe + .5, tKe + .6, tLi - .3, tLi + .6], draw(sc, t) {
    const V = sc.V; isl(sc, -6.0, -3.4, 6.0, 2.8, 75);
    notebook(sc, t, rows, pin01(t, tTe, .3));
    rows.forEach(([nm], i) => { const ta = rows[i][1], k = io(t, ta - .55, .6); if (k > .01 && k < .98) hud(sc, V.P(lerp(4.8, -3.0, k), -0.5 + i * 1.1, 1.6), nm, { color: PAL.violet, size: 30 }); });
    hud(sc, V.P(3.6, 0, 2.2), 'I KEEP IT', { color: PAL.mint, alpha: pin01(t, tKe, .3), size: 30 });
  } };
}
function notebook(sc, t, rows, a) {
  const V = sc.V; K.slab(sc, { x: -5.6, y: -2.9, z: 0, w: 5.0, d: 5.2, h: .45, r: .4, color: PAL.violet });
  K.slab(sc, { x: -5.3, y: -2.6, z: .45, w: 4.4, d: 4.6, h: .08, r: .3, color: mix(PAL.cream, PAL.violet, .12) });
  hud(sc, V.P(-3.1, -2.2, 1.3), 'MY WORDS', { color: PAL.violet, alpha: a, size: 30 });
  rows.forEach(([nm, ta], i) => { const k = pin01(t, ta, .5); if (k < .02) return; txt(sc, [-3.5, -0.5 + i * 1.1, .6], nm, { size: 44, color: PAL.ink, alpha: k }); if (t > ta + .6) tick(sc, V.P(-1.5, -0.5 + i * 1.1, .6), PAL.mint, pin01(t, ta + .6, .3), 26); });
}
// ============================================================================================================================
// CARD 7  UNDO A FIX: the notebook stays; an undone suggestion ("more") loses confidence step by step until it stops
function card7() {
  const w = win('UNDO'), at = w.at, end = w.end, tUn = W(15, 'undo'), tTh = W(16, 'then'), tWr = W(16, 'wrong'), tEn = W(16, 'enough'), tSt = W(16, 'stops');
  const tag = t => t < tTh ? 'UNDO A FIX' : t < tEn ? 'IT LEARNS IT WAS WRONG' : 'DO IT ENOUGH';
  return { tag, at, end, seed: 77, keys: keysFor(at, 3.6), stills: [tUn + .4, tWr + .4, tEn + .5, tSt + .5], draw(sc, t) {
    const V = sc.V; isl(sc, -6.0, -3.4, 6.0, 2.8, 77);
    notebook(sc, t, [['Moe', -9], ['Priya', -9], ['bhel', -9]], 1);
    const show = pin01(t, tUn - .5, .4), shrink = io(t, tWr - .2, tSt - tWr + .8), steps = Math.floor(shrink * 5) / 5, hgt = 3.4 * (1 - .9 * steps);
    K.box(sc, { x: 2.2, y: -.5, z: 0, w: 1.3, d: 1.3, h: .05 + hgt * show, color: PAL.coral });
    hud(sc, V.P(2.85, .2, .05 + hgt * show + .9), 'more', { color: PAL.coral, alpha: show });
    const ua = pin01(t, tUn, .35) * (1 - prog(t, tWr + .5, tWr + .9));
    if (ua > .03) { const a = V.P(4.9, .4, 2.5), b = V.P(3.9, .4, 1.2); sc.add(`<path d="M${pt(a)}Q${f1(a[0] + 70 * V.px)},${f1((a[1] + b[1]) / 2)} ${pt(b)}" fill="none" stroke="${rgba(PAL.saffron, ua)}" stroke-width="${f1(6 * V.px)}" stroke-linecap="round"/><path d="M${f1(b[0] - 14 * V.px)},${f1(b[1] - 10 * V.px)}L${pt(b)}L${f1(b[0] + 6 * V.px)},${f1(b[1] - 18 * V.px)}" fill="none" stroke="${rgba(PAL.saffron, ua)}" stroke-width="${f1(6 * V.px)}" stroke-linecap="round" stroke-linejoin="round"/>`, 0, 'hud'); hud(sc, V.P(4.9, .4, 3.2), 'UNDO', { color: PAL.saffron, alpha: ua }); }
    if (t > tWr + .1) hud(sc, V.P(2.85, -1.7, 1.2), 'WRONG', { color: PAL.coral, alpha: pin01(t, tWr + .1, .3) * (1 - prog(t, tSt, tSt + .4)) });
    if (t > tSt) hud(sc, V.P(2.85, -1.7, 1.2), 'STOPS', { color: PAL.mint, alpha: pin01(t, tSt, .3) });
  } };
}
// ============================================================================================================================
// CARD 8  COMMON WINS: a heap of "more" blocks outweighs one "Moe" block on a see-saw
function card8() {
  const w = win('COMMON WINS'), at = w.at, end = w.end, tMo = W(17, 'turn'), tEv = W(18, 'everyone'), tAl = W(18, 'almost'), tNo = W(18, 'nothing'), tPe = W(18, 'personal');
  const tag = t => t < tEv ? 'MOE BECOMES MORE' : t < tAl ? 'EVERYONE TYPES MORE' : 'ALMOST NOBODY TYPES MOE';
  return { tag, at, end, seed: 76, keys: keysFor(at, 4.6), stills: [tMo + .3, tEv + .8, tAl + .8, tPe + .4], draw(sc, t) {
    const V = sc.V; isl(sc, -6.0, -3.4, 6.0, 2.8, 76);
    const tilt = io(t, tEv + .2, 1.6), lz = lerp(2.2, .5, tilt), rz = lerp(2.2, 3.4, tilt);
    // pillars + pans
    K.box(sc, { x: -.4, y: -.4, z: 0, w: .8, d: .8, h: 2.8, color: mix(PAL.violet, PAL.cream, .3) });
    K.slab(sc, { x: -5.4, y: -1.2, z: lz - .3, w: 4.2, d: 2.4, h: .3, r: .4, color: PAL.coral });
    K.slab(sc, { x: 1.2, y: -1.2, z: rz - .3, w: 4.2, d: 2.4, h: .3, r: .4, color: PAL.violet });
    K.cable(sc, [-.0, 0, 2.9], [-3.3, 0, lz], { color: PAL.cream, w: 3, sag: .1 }); K.cable(sc, [0, 0, 2.9], [3.3, 0, rz], { color: PAL.cream, w: 3, sag: .1 });
    // the heap of "more" blocks (grows with "everyone"), one "Moe" block (appears at "almost nobody")
    const nHeap = Math.floor(lerp(0, 18, prog(t, tEv, tEv + 1.4)));
    for (let i = 0; i < nHeap; i++) { const c = i % 6, r2 = Math.floor(i / 6) % 3, l = Math.floor(i / 18); K.box(sc, { x: -5.0 + c * .62, y: -.9 + r2 * .75, z: lz + l * .4, w: .52, d: .62, h: .38, color: mix(PAL.coral, PAL.cream, .25 + (i % 3) * .1) }); }
    const mo = pin01(t, tAl + .3, .4); if (mo > .02) K.box(sc, { x: 2.8, y: -.3, z: rz + lerp(3, 0, mo), w: .62, d: .62, h: .4, color: PAL.violet });
    hud(sc, V.P(-3.2, 0, lz + 2.2), 'more', { color: PAL.coral, alpha: pin01(t, tEv, .3) });
    hud(sc, V.P(3.1, 0, rz + 1.9), 'Moe', { color: PAL.violet, alpha: mo });
    if (t > tNo) hud(sc, V.P(0, 1.9, 0.8), 'NOTHING PERSONAL', { color: PAL.cream, alpha: pin01(t, tNo, .3), size: 30 });
  } };
}
