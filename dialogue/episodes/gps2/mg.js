// gps2 MG: four iso cards (STORYBOARD.md) built from mg/isokit primitives. Each card = ONE continuous iso world, a camera rig that moves
// between subjects (isokit/camera.js, 0.6 s eased + drift), and a draw(sc, t) that is a pure function of global episode time t.
// Word times come from shots.json at load time (W(line, word)), so the beats sit on the spoken words.
// Engine contract (engine/mg-adapter.js): default export (mg, {ratio}) adds mg.beat()s; 9:16 cards use the 'float' layout (shorter card).
import { PAL, mix, rgba, add3, sub3, mul3, len3, f1, pt, poly, createScene } from '../../mg/isokit/core.js';
import * as K from '../../mg/isokit/prims.js';
import { background } from '../../mg/isokit/stage.js';
import { ease, prog, orbitAngle } from '../../mg/isokit/motion.js';
import { camRig, viewAt } from '../../mg/isokit/camera.js';

const E = await (await fetch(new URL('./shots.json', import.meta.url)).then(r => r.ok ? r : fetch(new URL('../gps/shots.json', import.meta.url)))).json();   // words only (same voice track as gps)
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const W = (line, word, nth = 0) => { const c = E.words.filter(w => w.line === line && norm(w.w) === norm(word)); if (!c[nth]) throw new Error(`gps2 mg: no word "${word}" #${nth} in line ${line}`); return c[nth].s; };
const endOf = line => Math.max(...E.words.filter(w => w.line === line).map(w => w.e));
const pin01 = (t, a, d = .5) => ease.p3out(prog(t, a, a + d));
const io = (t, a, d) => ease.p2io(prog(t, a, a + d));
const fmt = n => Math.round(n).toLocaleString('en-US');
const SAT = [PAL.saffron, PAL.sky, PAL.violet, PAL.cream];
// local drawing helpers (composition-level; alpha-aware versions of groundCircle / pulseSphere)
const gCircle = (sc, c, r, col, a, o = {}) => { if (a <= .01 || r <= 0) return; const V = sc.V, p = V.P(c), rx = r * V.s, ry = rx * V.K;
  const g = `<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${rgba(col, (o.fillA ?? 0) * a)}" stroke="${rgba(PAL.shade, .45 * a)}" stroke-width="${f1(6 * V.px)}"/><ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(rx)}" ry="${f1(ry)}" fill="none" stroke="${rgba(col, a)}" stroke-width="${f1((o.w ?? 3) * V.px)}"${o.glow === false ? '' : ' filter="url(#glow)"'}${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`;
  sc.add(o.clip ? `<g clip-path="url(#${o.clip})">${g}</g>` : g, o.depth ?? 0, o.layer || 'floor'); };
const sphere = (sc, c, r, col, a, i = 0) => { if (a <= .01 || r <= .02) return; K.pulseSphere(sc, { c, r, color: col, fillA: .045 * a, rimA: .8 * a, eqA: .2 * a, w: 2.2, echo: [[.8, .14 * a]], depth: i }); };
const circX = (c1, r1, c2, r2, near = [0, 0]) => { const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy); if (d > r1 + r2 || d < Math.abs(r1 - r2) || !d) return null;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a)), mx = c1[0] + a * dx / d, my = c1[1] + a * dy / d; const P1 = [mx + h * dy / d, my - h * dx / d], P2 = [mx - h * dy / d, my + h * dx / d];
  return Math.hypot(P1[0] - near[0], P1[1] - near[1]) < Math.hypot(P2[0] - near[0], P2[1] - near[1]) ? P1 : P2; };
const clockStr = t => { const s = 5 + Math.max(0, t); return `12:00:${String(Math.floor(s)).padStart(2, '0')}.${String(Math.floor((s % 1) * 1000)).padStart(3, '0')}`; };

// ============================================================================================================================
// CARD 1  THE SIGNAL (L2-L4): globe, satellites orbit + broadcast the time, phone hears it late
function card1() {
  const at = W(2, 'satellites') - .1, end = endOf(5) + .1, g = { c: [0, 0, 0], R: 3, rot: 25 }, r = 5.0;
  const planes = [[55, 60], [55, 120], [55, 180], [55, 90]], ph = [1.57 - .6, .3 - .6, 2.36 - .6, 5.2 - .6], spd = .22;
  const sp = (i, t) => K.orbitPos(g.c, r, planes[i][0], planes[i][1], orbitAngle(t - at, ph[i], spd));
  const base = K.globePoint(g, 46, 2), top = add3(base, [0, 0, 1.25]);
  const tUp = W(2, 'twenty'), tSay = W(2, 'say'), tOver = W(4, 'over'), tYour = W(4, 'your'), tHear = W(4, 'hears'), tLate = W(4, 'late');
  // the satellite that talks to the phone in the push-in: the front one nearest the phone at that moment
  const hi = [0, 1, 2, 3].map(i => [i, len3(sub3(sp(i, tHear + .4), base))]).sort((a, b) => a[1] - b[1])[0][0];
  const keys = [{ t: at, pts: [[0, 0, 0, 5.4]] }, { t: tYour - .1, pts: [[...base, 1.4], [...top, 1.0], [...sp(hi, tHear + .4), 1.0], [...sp(hi, tLate + .8), 1.0]], zoom: .9 }];
  return { tag: 'THE SIGNAL', at, end, seed: 3, keys, stills: [tUp + .9, tSay + .5, tHear + .3, tLate + .4], draw(sc, t) {
    K.globe(sc, g);
    for (let i = 0; i < 4; i++) {
      const k = pin01(t, at + .25 + i * .12, .45), p = sp(i, t), col = SAT[i]; if (k <= 0) continue;
      K.orbitArc(sc, { c: g.c, r, inc: planes[i][0], node: planes[i][1], th: orbitAngle(t - at, ph[i], spd), span: 2.0, color: col, a: k });
      K.satellite(sc, { p, color: col, scale: 1.0 * k });
      const front = sc.V.dep(p) > sc.V.dep(g.c) - .5;
      if (t > tSay - .1 && front) { K.rings(sc, { p, n: 2, r: .95, r0: .2, color: col, phase: (t * .9 + i * .3) % 1, alpha: .9 * pin01(t, tSay - .1, .4), w: 2 });
        K.hud(sc, sc.V.P(p), clockStr(t - tSay), { size: 13, color: col, dy: -44 * (1 + .1 * i), alpha: pin01(t, tSay + i * .1, .35) }); }
      if (t > tOver && front && i !== hi) K.beam(sc, p, top, { color: col, alpha: .45 * pin01(t, tOver, .5), w: 1.8, dash: '3 9', pk: (t * .7 + i * .3) % 1 });
    }
    // altitude: dashed ruler from the surface under satellite 2 up to it, counter 0 -> 20,200 km
    { const kU = io(t, tUp, .9), p = sp(2, t), foot = add3(g.c, mul3(sub3(p, g.c), g.R / len3(sub3(p, g.c)))), fade = 1 - prog(t, tYour - .4, tYour);
      if (kU > 0 && fade > 0) K.dim(sc, foot, p, { k: kU, color: PAL.sky, dash: '5 6', label: `${fmt(20200 * kU)} KM UP`, size: 17, ldx: 70, labelA: fade, layer: 'fx' }); }
    K.rings(sc, { p: base, n: 3, r: .9, r0: .2, color: PAL.cream, phase: t * .5, alpha: .7, w: 2 });
    K.phone(sc, { p: base, color: PAL.coral, scale: 1.25 + .25 * io(t, tYour - .1, .6), shadow: false, depth: 1e4, layer: 'fx' });
    // the phone hears one tick: packet down the beam, lands on "late"
    if (t > tHear - .1) { const p = sp(hi, t), k = prog(t, tHear, tLate);
      K.beam(sc, p, top, { color: SAT[hi], alpha: .85, w: 2.4 }); if (k < 1) K.packet(sc, p, top, k, { color: SAT[hi] });
      K.hud(sc, sc.V.P(p), `SENT ${clockStr(tHear - tSay)}`, { size: 20, color: SAT[hi], dy: -50, alpha: pin01(t, tHear - .1, .3) });
      if (k >= 1) { K.rings(sc, { p: top, n: 2, r: .7, r0: .1, color: PAL.coral, phase: (t - tLate) * 1.2, alpha: 1 - prog(t, tLate + 1.2, tLate + 1.8) });
        K.hud(sc, sc.V.P(top), 'HEARD +0.067 S LATE', { size: 24, color: PAL.coral, dy: -66, alpha: pin01(t, tLate, .3) }); } }
    else K.tag(sc, top, "LEO'S PHONE", { color: PAL.coral, dx: -120, dy: -40 });
    K.cloud(sc, { x: 4, y: -5, z: 1.2, size: .9 }); K.cloud(sc, { x: -4.8, y: 3, z: -1.4, size: .7, opacity: .85 });
  } };
}

// ============================================================================================================================
// CARD 2+3  HOW FAR -> FOUR BALLS -> WHY FOUR (L6-L10): one island world, delay x c = distance, spheres grow and meet, cheap clock
function card2() {
  const at = W(6, 'enough') - .1, end = endOf(10) + .25, I = { x: -4.5, y: -3.5, w: 9, d: 7, r: 1, th: 1.2 }, PH = [0, 0, 0], TOP = [0, 0, 1.25];
  const S = [[-2.6, -1.7, 3.5], [1.9, -2.8, 3.9], [3.1, .5, 4.3], [-2.0, 2.7, 3.5]], R = S.map(s => len3(sub3(s, PH)));
  const tLate = W(6, 'late'), tSpeed = W(6, 'speed'), tDist = W(6, 'distance'), tThis = W(7, 'this'), tBall = W(8, 'ball'), tFour = W(8, 'four'), tBalls = W(8, 'balls'),
    tCross = W(8, 'cross'), tYou = W(8, 'thats'), tThree = W(9, 'three'), tClock = W(10, 'clock'), tFix = W(10, 'fourth');
  const all = S.map((s, i) => [...s, R[i] * .98]);
  const keys = [{ t: at, pts: [[0, 0, 0, .9], [...S[0], .9], [-1.2, -.6, 1.6, 1.5]], zoom: .95 }, { t: tThis - .3, pts: [[...S[0], R[0]], [0, 0, 0, .6]] },
    { t: tFour - .05, pts: all }, { t: tYou - .05, pts: [[0, 0, 0, 1.8], [0, 0, 1.9, 1]] }, { t: tThree - .1, pts: all }, { t: tClock - .05, pts: [[-.4, .2, 0, 2.3], [0, 0, 1.4, 1]] }, { t: tFix + .1, pts: all }];
  const err = t => 1.5 * io(t, tClock, .8) * (1 - io(t, tFix + .2, .9));
  const tagOf = t => t < tBall - .1 ? 'HOW FAR' : t < tThree - .1 ? 'FOUR BALLS' : 'WHY FOUR';
  return { tag: tagOf, at, end, seed: 5, keys, stills: [tLate + .7, tDist + .5, tThis + .7, tBalls + 1.1, tYou + .5, tClock + .9, tFix + 1.2], draw(sc, t) {
    K.island(sc, { ...I, seed: 9, tufts: 18, avoid: (x, y) => Math.hypot(x, y) < 1.4 }); const clip = K.islandClip(sc, I);
    for (const [x, y, k, h] of [[-3.6, -2.6, 'cone', 1.3], [-3.0, -2.9, 'round', 1], [3.7, 2.7, 'cone', 1.1], [3.2, 2.9, 'cone', .8], [-3.8, 2.2, 'round', 1.1], [3.8, -2.6, 'cone', 1.2], [-1.2, 2.9, 'round', .8], [1.6, -2.9, 'cone', .9]])
      K.tree(sc, { x, y, kind: k, h, color: k === 'round' ? '#2FBF8A' : '#26A985' });
    K.shadow(sc, 0, 0, 0, .55, .35); K.phone(sc, { p: PH, color: PAL.coral, scale: 1.1, shadow: false, layer: 'top', depth: 50 });
    const e = err(t), a4 = t < tThree ? 1 : t < tFix ? 1 - .85 * io(t, tThree, .5) : .15 + .85 * io(t, tFix, .5), roll = 1 - io(t, tFour - .2, .5);
    for (let i = 0; i < 4; i++) {
      const pop = i === 0 ? pin01(t, at + .3, .45) : pin01(t, tFour + (i - 1) * .15, .45); if (pop <= 0) continue; const s = S[i], col = SAT[i], a = i === 3 ? a4 : 1;
      const g0 = i === 0 ? tThis - .25 : tBalls + (i - 1) * .12, gr = io(t, g0, 1.1), Rr = (R[i] + (i < 3 ? e : 0)) * gr;
      sphere(sc, s, Rr, col, a, i);
      if (gr >= 1) { const rg = Math.sqrt(Math.max(0, Rr * Rr - s[2] * s[2])), ca = i === 0 ? pin01(t, tBall - .1, .5) : pin01(t, tCross - .1, .5); gCircle(sc, [s[0], s[1], 0], rg, col, ca * a, { clip, depth: i }); }
      K.satellite(sc, { p: s, color: col, scale: 1.1 * pop, layer: 'top', depth: i, emit: true });
    }
    // HOW FAR: one tick falls from satellite 1, stopwatch at the phone, x c, ruler = distance
    if (roll > 0) {
      const k = prog(t, tLate, tLate + 1.1); if (t > tLate - .1) K.beam(sc, S[0], TOP, { color: SAT[0], alpha: .5 * roll, w: 1.8, dash: '3 8' }); if (k > 0 && k < 1) K.packet(sc, S[0], TOP, k, { color: SAT[0] });
      const pP = sc.V.P(PH);
      K.hud(sc, pP, `${(0.067 * k).toFixed(3)} S`, { size: 30, color: k >= 1 ? PAL.saffron : PAL.cream, dx: 150, dy: 6, alpha: pin01(t, at + .4, .4) * roll });
      K.hud(sc, pP, '× 300,000 KM/S', { size: 22, color: PAL.cream, dx: 150, dy: 52, alpha: pin01(t, tSpeed, .35) * roll });
      const kd = io(t, tDist, .6); if (kd > 0) K.dim(sc, [S[0][0] + .5, S[0][1] + .5, S[0][2]], [.5, .5, 0], { k: kd, color: PAL.saffron, label: '= 20,200 KM', size: 24, ldx: -120, labelA: kd * roll, layer: 'fx' });
    }
    // ball of possible places: dots run round sphere 1's outline
    if (t > tBall - .1 && t < tCross + .5) { const V = sc.V, c = V.P(S[0]), rs = R[0] * V.s, n = 16, a = pin01(t, tBall - .1, .3) * (1 - prog(t, tCross, tCross + .5)); let o = '';
      for (let j = 0; j < n; j++) { const vis = pin01(t, tBall + j * .04, .2), an = j / n * Math.PI * 2 + (t - tBall) * .25; o += `<circle cx="${f1(c[0] + rs * Math.cos(an))}" cy="${f1(c[1] + rs * Math.sin(an))}" r="${f1(5 * V.px * vis)}" fill="${rgba(PAL.cream, .95 * a)}"/>`; } sc.add(o, 0, 'fx'); }
    // crossing point pulses, then the pin drops ("That's you")
    if (t > tCross && e < .05) K.rings(sc, { p: [0, 0, .02], n: 3, r: .9, r0: .1, color: PAL.cream, phase: (t - tCross) * .9, alpha: pin01(t, tCross, .3), w: 2.4 });
    const pinA = t < tClock ? 1 : t < tFix ? 1 - io(t, tClock, .4) : io(t, tFix + .9, .4);
    if (t > tYou && pinA > .01) { const k = pin01(t, tYou, .45); sc.add(`<g opacity="${pinA.toFixed(3)}">`, 59.5, 'top'); K.pin(sc, { p: [0, 0, 1.75 + 3 * (1 - k)], color: PAL.coral, size: .34, streak: k < 1 ? 1 : 0, layer: 'top', depth: 60 }); sc.add('</g>', 60.5, 'top');
      K.hud(sc, sc.V.P([0, 0, 1.3]), 'YOU', { size: 22, color: PAL.coral, dx: 120, dy: 30, alpha: pin01(t, tYou + .3, .3) * pinA }); }
    // cheap clock: the three circles miss each other -> ember triangle of doubt; the 4th sphere shrinks them back to one point
    if (e > .02) { const C = [0, 1, 2].map(i => { const Rr = R[i] + e; return [[S[i][0], S[i][1]], Math.sqrt(Rr * Rr - S[i][2] * S[i][2])]; }); const X = [[0, 1], [1, 2], [0, 2]].map(([a, b]) => circX(C[a][0], C[a][1], C[b][0], C[b][1]));
      if (X.every(Boolean)) { const V = sc.V, P3 = X.map(q => V.P(q[0], q[1], .01)); sc.add(`<path d="${poly(P3)}" fill="${rgba(PAL.ember, .45)}" stroke="${PAL.ember}" stroke-width="${f1(3 * V.px)}" stroke-linejoin="round"/>` + P3.map(q => `<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1(6 * V.px)}" fill="${PAL.ember}"/>`).join(''), 45, 'top'); } }
    if (t > tClock - .1) { const fixed = t > tFix + .9; K.hud(sc, sc.V.P(PH), fixed ? 'PHONE CLOCK FIXED' : 'PHONE CLOCK +0.001 S', { size: 22, color: fixed ? PAL.mint : PAL.ember, dx: -10, dy: 62, alpha: pin01(t, tClock - .1, .3) }); }
    K.cloud(sc, { x: 5.6, y: -6, z: 2.2, size: .8 }); K.cloud(sc, { x: -6.5, y: 3.5, z: 1.2, size: .65, opacity: .85 });
  } };
}

// ============================================================================================================================
// CARD 4+5  ONE MICROSECOND -> ATOMIC CLOCKS -> SKIP EINSTEIN (L12-L14): track island, light runs 300 m in 1 µs, clocks drift, pin drifts
function card4() {
  const at = W(12, 'millionth') - .15, end = W(15, 'and'), I = { x: -7.2, y: -1.7, w: 14.4, d: 3.4, r: .8, th: 1.0 };
  const SAT0 = [1.2, -1.2, 7.2], AC = [3.0, -1.2, 7.4], PHN = [-3.6, .5, 0], GC = [-3.6, -.6, 2.6];
  const tM = W(12, 'millionth'), tMet = endOf(12) && W(12, 'metres'), tSo = W(12, 'so'), tAtom = W(12, 'atomic'), tEin = W(12, 'einstein'), t38 = W(12, 'thirtyeight'),
    tE13 = W(13, 'einstein'), tSkip = W(14, 'skip'), tDrift = W(14, 'drift');
  const keys = [{ t: at, pts: [[-7, 0, 0], [7, 0, 0], [0, 0, 1.5], [0, -1.7, -1]] }, { t: tSo - .05, pts: [[...SAT0, 1.4], [...AC, 1.1], [1.5, -1.2, 5.6]], zoom: .95 },
    { t: tEin - .1, pts: [[...SAT0, 1.2], [...AC, 1.0], [...GC, 1.0], [...PHN, .8]], zoom: .97 }, { t: tDrift - .15, pts: [[...PHN, .9], [PHN[0] + 7, PHN[1], 0, .6], [...GC, 1.7], [...AC, 1.3], [2, 0, 1.4, .6]], zoom: .95 }];
  const corr = t => t < tSkip ? 1 : 1 - io(t, tSkip, .3);
  // satellite clock lead (rad): saw-tooth (Einstein snaps it back) while corrected; runs away after "skip"
  const lead = t => { const ph = Math.max(0, t - tEin) % 1.3, saw = .45 * Math.min(1, ph / 1.0) * (ph < 1.0 ? 1 : 1 - (ph - 1.0) / .3); return t < tEin ? 0 : t < tSkip ? saw : .45 + (t - tSkip) * .9; };
  const tagOf = t => t < tSo - .1 ? 'ONE MICROSECOND' : t < tSkip - .1 ? 'ATOMIC CLOCKS' : 'SKIP EINSTEIN';
  return { tag: tagOf, at, end, seed: 7, keys, stills: [tM + .55, tMet + .4, tAtom + .5, t38 + .7, tE13 + .4, tDrift + 1.0], draw(sc, t) {
    K.island(sc, { ...I, seed: 6, tufts: 22, avoid: (x, y) => Math.abs(y) < .9 });
    K.road(sc, [-6.6, 0], [6.6, 0], 1.1);
    for (const [x, y, k, h] of [[-5.8, 1.25, 'cone', 1.0], [-1.6, 1.3, 'round', .8], [2.4, 1.25, 'cone', 1.1], [5.6, 1.3, 'round', .9], [-4.6, -1.3, 'round', .8], [4.4, -1.3, 'cone', 1.0]]) K.tree(sc, { x, y, kind: k, h });
    for (const [x, y, w, d, h, c] of [[-.6, 1.05, .9, .5, .9, PAL.saffron], [.6, -1.45, .8, .5, .7, PAL.violet], [3.6, 1.05, .8, .5, 1.1, PAL.coral]]) K.building(sc, { x, y, w, d, h, color: c, roof: 'unit', litP: .5 });
    // 1 µs: light streaks the whole track while the ruler + counter run
    const kL = prog(t, tM, tMet + .1), fadeA = 1 - prog(t, tSo - .2, tSo + .3);
    if (fadeA > 0) { const A = [-6.4, 0, .25], B = [6.4, 0, .25]; if (kL > 0 && kL < 1) K.packet(sc, A, B, kL, { color: PAL.sky, tail: .25, r: 8 });
      K.dim(sc, [-6.4, 1.0, 0], [6.4, 1.0, 0], { k: Math.max(.001, kL), color: PAL.cream, label: `${fmt(300 * kL)} M`, size: 26, ldy: 30, labelA: fadeA, layer: 'fx' });
      K.hud(sc, [sc.V.W / 2, 34], kL >= 1 ? '1 µS = 0.000001 S' : `${(kL * 1e-6).toFixed(7)} S`, { size: 26, color: PAL.sky, dy: 40, alpha: pin01(t, at + .3, .3) * fadeA }); }
    // satellite + its atomic clock; ground clock + phone; Einstein's correction
    const base = (t - at) * 1.6, ld = lead(t), broken = t > tSkip;
    K.satellite(sc, { p: SAT0, color: PAL.sky, scale: 1.25, layer: 'air' });
    const acA = pin01(t, tAtom - .2, .5); if (acA > 0) { K.clock(sc, { c: AC, r: .9 * acA, color: broken ? PAL.ember : PAL.sky, hour: 10.2 / 12 * 6.283, min: base + ld, ghost: t > tEin ? [[base, .4]] : [] }); K.cable(sc, [SAT0[0] + .4, SAT0[1], SAT0[2]], [AC[0] - .5, AC[1], AC[2] - .3], { sag: .15, w: 4, color: PAL.cream });
      K.tag(sc, [AC[0], AC[1], AC[2] + 1.0], 'ATOMIC CLOCK', { color: PAL.sky, size: 15, dx: 60, dy: -24 }); }
    const gcA = pin01(t, tEin - .1, .5); if (gcA > 0) { K.clock(sc, { c: GC, r: .8 * gcA, color: PAL.saffron, hour: 10.2 / 12 * 6.283, min: base }); K.tag(sc, [GC[0], GC[1], GC[2] + .9], 'GROUND', { color: PAL.saffron, size: 14, dx: -70, dy: -20 }); }
    K.phone(sc, { p: PHN, color: PAL.coral, scale: .85 });
    if (t > tEin && t < tSkip) { const ph = (t - tEin) % 1.3; if (ph > 1.0) K.arrow(sc, [AC[0] + 1.2, AC[1], AC[2] + .9], [AC[0] + 1.2, AC[1], AC[2] - .4], { color: PAL.mint, w: 2.6 }); }
    const k38 = io(t, t38, .8); if (k38 > 0) K.hud(sc, sc.V.P([(AC[0] + GC[0]) / 2, -1, 5.2]), broken ? 'NO CORRECTION' : `+${fmt(38 * k38)} µS / DAY`, { size: 25, color: broken ? PAL.ember : PAL.saffron, alpha: k38 * (1 - .0 * corr(t)) });
    if (t > tE13 - .1 && t < tSkip + .4) { const a = pin01(t, tE13 - .1, .4) * (1 - prog(t, tSkip, tSkip + .4)); K.beam(sc, [AC[0] - .3, AC[1], AC[2] - .9], [PHN[0], PHN[1], 1.1], { color: PAL.sky, alpha: .6 * a, w: 2, dash: '4 8', pk: ((t - tE13) * .8) % 1 }); }
    // skip him -> the fix drifts away down the track (ember: broken), 0 -> 10 km / day
    if (t > tDrift - .1) { const k = io(t, tDrift, 1.1), px = PHN[0] + 6.6 * k; K.dim(sc, [PHN[0], PHN[1] + .9, 0], [px, PHN[1] + .9, 0], { k: 1, color: PAL.ember, label: `${(10 * k).toFixed(1)} KM / DAY`, size: 26, ldy: 34, layer: 'fx' });
      K.pin(sc, { p: [px, PHN[1], 1.6], color: PAL.ember, size: .3, ground: 0, layer: 'top' }); }
    else if (t > tE13) K.pin(sc, { p: [PHN[0], PHN[1], 1.6], color: PAL.coral, size: .3, ground: 0, layer: 'top' });
    K.cloud(sc, { x: -6, y: -3, z: 4.5, size: .8 }); K.cloud(sc, { x: 6, y: -4, z: 3.5, size: .6, opacity: .85 });
  } };
}

// ============================================================================================================================
// CARD 6  IN THE CITY (L15-L16): beams blocked by facades, a doubt ring; maps + wifi names pull the fix onto the phone
function card6() {
  const at = W(15, 'and'), end = endOf(16) + .35, I = { x: -5.5, y: -4, w: 11, d: 8, r: 1.1, th: 1.2 }, PHN = [-.9, .55, 0];
  const tBetw = W(15, 'between'), tMaps = W(16, 'maps'), tWifi = W(16, 'wifi'), tFill = W(16, 'fill');
  const B = [
    [-4.7, -3.4, 1.3, 1.3, 2.6, PAL.violet, 'unit'], [-3.1, -3.4, 1.4, 1.2, 4.0, PAL.sky, 'antenna'], [-4.7, -1.7, 1.3, 1.4, 1.6, PAL.saffron, 'tank'], [-2.9, -1.5, 1.3, 1.3, 3.6, PAL.coral, 'unit'],
    [.0, -3.4, 1.5, 1.4, 2.4, PAL.cream, 'tank'], [1.9, -3.5, 1.3, 1.3, 4.8, PAL.coral, 'antenna'], [3.6, -3.3, 1.3, 1.2, 3.0, PAL.violet, 'unit'], [.1, -1.5, 1.4, 1.2, 3.4, PAL.saffron, 'unit'], [2.1, -1.6, 1.4, 1.3, 2.8, PAL.sky, 'tank'],
    [-4.7, 1.5, 1.3, 1.3, 2.0, PAL.saffron, 'tank'], [.1, 1.5, 1.6, 1.3, 3.2, PAL.violet, 'unit'], [2.4, 1.6, 1.3, 1.3, 2.6, PAL.coral, 'unit'], [-2.9, 1.6, 1.2, 1.2, 2.2, PAL.sky, 'unit']];
  const SATS = [[-6, -5, 11], [3, -6, 12], [-9, 2, 7]], TOPP = [PHN[0], PHN[1], .9];
  // first building a satellite->phone line hits (sampled), or null if the line is clear
  const hit = s => { for (let k = .5; k < 1; k += .004) { const q = add3(s, mul3(sub3(TOPP, s), k)); for (const b of B) if (q[0] > b[0] && q[0] < b[0] + b[2] && q[1] > b[1] && q[1] < b[1] + b[3] && q[2] < b[4]) return q; } return null; };
  const H = SATS.map(hit);
  const keys = [{ t: at, pts: [[-5.5, -4, -.6], [5.5, -4, -.6], [-5.5, 4, -.6], [5.5, 4, -.6], [-3.1, -3.4, 4.6], [1.9, -3.5, 5.4]], zoom: 1.06 },
    { t: tBetw - .1, pts: [[...PHN, 1.4], [-2.9, -1.5, 3.6], [.1, 1.5, 3.2], [-1.5, -.5, 0, 1.4]], zoom: .95 }, { t: tMaps - .1, pts: [[-5.5, -4, -.6], [5.5, -4, -.6], [-5.5, 4, -.6], [5.5, 4, -.6], [1.9, -3.5, 6.4]], zoom: 1.1 }];
  const WF = [[1, PAL.sky, 'LIBRARY'], [7, PAL.saffron, 'CAFE_FREE'], [11, PAL.mint, 'HOME-5G']];
  return { tag: 'IN THE CITY', at, end, seed: 8, keys, stills: [tBetw + .6, tWifi + .4, tFill + .5], draw(sc, t) {
    K.island(sc, { ...I, seed: 4, tufts: 10, avoid: (x, y) => Math.abs(y - .55) < 1 || Math.abs(x + .9) < 1 || (y < 0 && x > -4.6) });
    const mA = pin01(t, tMaps - .05, .4);
    K.road(sc, [-5.2, .55], [5.2, .55], 1.15); K.road(sc, [-.9, -3.7], [-.9, 3.7], 1.15);
    if (mA > 0) { const V = sc.V, ed = (a, b) => `<path d="M${pt(V.P(a[0], a[1], .01))}L${pt(V.P(b[0], b[1], .01))}" stroke="${rgba(PAL.sky, .95 * mA)}" stroke-width="${f1(2.6 * V.px)}" stroke-linecap="round"/>`;
      sc.add([[[-5.2, -.03], [5.2, -.03]], [[-5.2, 1.13], [5.2, 1.13]], [[-1.48, -3.7], [-1.48, 3.7]], [[-.32, -3.7], [-.32, 3.7]]].map(([a, b]) => ed(a, b)).join(''), -.5, 'floor'); }
    const tops = B.map(([x, y, w, d, h, color, roof]) => K.building(sc, { x, y, w, d, h, color, roof, litP: .5 }).top);
    for (const [x, y, k, h] of [[-2.0, 2.9, 'cone', 1.1], [4.4, 2.0, 'round', .9], [1.0, 3.3, 'round', .7], [3.6, 3.3, 'cone', .9]]) K.tree(sc, { x, y, kind: k, h });
    // satellite beams from above the card: two die on facades (ember tick = broken), one reaches the phone
    const bA = pin01(t, at + .3, .4) * (1 - prog(t, tWifi + .4, tWifi + .9));
    if (bA > 0) SATS.forEach((s, i) => { const h = H[i], b = h || TOPP, col = SAT[i]; K.beam(sc, s, b, { color: col, alpha: .8 * bA, w: 2.2, pk: ((t - at) * .9 + i * .3) % 1 });
      if (h) { const p = sc.V.P(h), k = 9 * sc.V.px; sc.add(`<path d="M${f1(p[0] - k)},${f1(p[1] - k)}L${f1(p[0] + k)},${f1(p[1] + k)}M${f1(p[0] + k)},${f1(p[1] - k)}L${f1(p[0] - k)},${f1(p[1] + k)}" stroke="${rgba(PAL.ember, bA)}" stroke-width="${f1(3.2 * sc.V.px)}" stroke-linecap="round"/>`, 0, 'hud'); } });
    // wifi names
    WF.forEach(([bi, col, name], j) => { const a = pin01(t, tWifi + j * .12, .35); if (a <= 0) return; const p = add3(tops[bi], [0, 0, .05]);
      K.rings(sc, { p, n: 3, r: 1.7, r0: .3, color: col, phase: t * .55 + j * .3, w: 2.4, alpha: a }); K.wifi(sc, { p: add3(p, [0, 0, .6]), color: col, size: .5 });
      K.hud(sc, sc.V.P(add3(p, [0, 0, 1.3])), name, { size: 14, color: col, dy: -14, alpha: a }); if (t > tWifi + .3) K.beam(sc, add3(p, [0, 0, .3]), TOPP, { color: col, alpha: .45 * a, w: 1.6, dash: '3 7' }); });
    // the fix: big doubt ring -> shrinks onto the phone -> pin
    const rr = 2.3 - 1.95 * io(t, tFill, .7); gCircle(sc, PHN, rr, PAL.coral, pin01(t, at + .4, .4), { dash: '7 7', fillA: .12, w: 2.6, glow: false, layer: 'fx', depth: 3 });
    K.phone(sc, { p: PHN, color: PAL.coral, scale: .8, layer: 'fx', depth: 4 });
    if (t > tFill + .5) { const k = pin01(t, tFill + .5, .4); K.pin(sc, { p: [PHN[0], PHN[1], 1.3 + 2 * (1 - k)], color: PAL.coral, size: .3, streak: k < 1 ? 1 : 0 }); K.hud(sc, sc.V.P([PHN[0], PHN[1], .9]), 'FOUND', { size: 18, color: PAL.coral, dx: -120, dy: 40, alpha: k }); }
    else if (t < tMaps) K.tag(sc, [PHN[0], PHN[1], .9], '?', { color: PAL.cream, size: 18, dx: -80, dy: 40 });
    K.cloud(sc, { x: 5.4, y: -6.5, z: 3.2, size: .85 }); K.cloud(sc, { x: -7, y: 4, z: 1.5, size: .65, opacity: .85 });
  } };
}

// the layout switch re-frames the scene, so a card enters/leaves ON a shot cut when one is close (else the switch reads as a second jump cut)
const cuts = (E.shots || []).map(x => x.t0).filter(x => x > 0);
const snap = (t, lo, hi) => { const c = cuts.filter(x => x >= t - lo && x <= t + hi).sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0]; return c ?? t; };
export const CARDS = [card1(), card2(), card4(), card6()].map(c => ({ ...c, at: snap(c.at, .35, .05), end: snap(c.end, .4, .1) }));
const NS = 'http://www.w3.org/2000/svg';
const tagHtml = fs => `position:absolute;left:${fs * 1.7}px;top:${fs * 1.4}px;display:flex;align-items:center;gap:${fs * .7}px;font:500 ${fs}px/1 'Geist Mono',monospace;letter-spacing:.14em;color:${rgba(PAL.cream, .75)}`;
// mount one isokit world into an mg beat: approved card look (rounded, indigo, no notebook chrome), SVG world re-rendered per frame
function mount(b, c, k) {   // k: card index, suffixes every SVG id (gradients/filters/clips must be unique across the cards in one page)
  const cardEl = b.media.closest('.mg-card'), content = b.media.parentNode, cw = b.W, ch = b.H;
  Object.assign(cardEl.style, { borderRadius: '22px', border: 'none', background: PAL.bg0, boxShadow: `0 30px 70px rgba(8,6,24,.6),0 0 0 1.5px ${rgba(PAL.cream, .16)}`, backdropFilter: 'none', webkitBackdropFilter: 'none' });
  for (const sel of ['.mg-rule', '.mg-grain']) cardEl.querySelectorAll(sel).forEach(e => (e.style.display = 'none'));
  content.querySelectorAll(':scope > .mg-vig, :scope > svg.mg-lines, :scope > .mg-meta, :scope > .mg-tag').forEach(e => (e.style.display = 'none'));
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', cw); svg.setAttribute('height', ch); svg.setAttribute('viewBox', `0 0 ${cw} ${ch}`); svg.style.cssText = 'position:absolute;left:0;top:0'; b.media.appendChild(svg);
  const tag = document.createElement('div'); tag.style.cssText = tagHtml(16); const sq = document.createElement('i'); sq.style.cssText = `display:block;width:8px;height:8px;background:${PAL.saffron};border-radius:2px`; const tx = document.createElement('span'); tag.append(sq, tx); content.appendChild(tag);
  const box = { x: 26, y: 54, w: cw - 52, h: ch - 54 - 22 }, rig = camRig({ W: cw, H: ch, box, keys: c.keys }), bg = background(cw, ch, c.seed);
  let last = -1;
  b.items.push({ upd: lt => { const t = c.at + lt; if (Math.abs(t - last) < 1e-4) return; last = t; const sc = createScene(viewAt(rig, t)); c.draw(sc, t); svg.innerHTML = (bg + sc.svg()).replace(/(id="|url\(#)([\w-]+)/g, `$1$2_${k}`); tx.textContent = typeof c.tag === 'function' ? c.tag(t) : c.tag; } });
}
export default function addCues(mg, { ratio } = {}) {
  const lay = ratio === '16x9' ? 'split' : 'float';
  for (const c of CARDS) mg.beat({ at: c.at, dur: c.end - c.at, layout: lay, side: 'top', exit: 'top' }, b => mount(b, c, CARDS.indexOf(c)));
}
