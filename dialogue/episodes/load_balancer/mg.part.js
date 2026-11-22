// load_balancer MG: eight iso cards (STORYBOARD.md) built from mg/isokit. Every card is its own small floating world and a pure function of global episode time t.
// Recurring objects: the PHONE (violet), the HOST = load balancer (saffron man-block with a cream head), SERVERS (sky racks with three lights), packets (visitors).
// Word times come from shots.json at load time (W(line, word)). Engine contract: default export (mg, {ratio}) adds mg.beat()s; 9:16 uses 'float'.
// Build: cat mg.part.js _footer.js > mg.js
import { PAL, mix, rgba, f1, pt, poly, line, rng, createScene } from '../../mg/isokit/core.js';
import * as K from '../../mg/isokit/prims.js';
import { background } from '../../mg/isokit/stage.js';
import { ease, prog } from '../../mg/isokit/motion.js';
import { camRig, viewAt } from '../../mg/isokit/camera.js';

const E = await (await fetch(new URL('./shots.json', import.meta.url))).json();
const BE = await (await fetch(new URL('./mg.beats.json', import.meta.url))).json();
const win = n => { const c = BE.cues.find(x => x.name === n); if (!c) throw new Error('load_balancer mg: no beat ' + n); return c; };
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const W = (line, word, nth = 0) => {
  const ws = E.words.filter(w => w.line === line), n = norm(word);
  let c = ws.filter(w => norm(w.w) === n); if (!c.length) c = ws.filter(w => norm(w.w).length >= 3 && n.length >= 3 && (norm(w.w).startsWith(n.slice(0, 3)) || n.startsWith(norm(w.w).slice(0, 3))));
  if (!c[nth]) throw new Error(`load_balancer mg: no word "${word}" #${nth} in line ${line}`); return c[nth].s;
};
const pin01 = (t, a, d = .5) => ease.p3out(prog(t, a, a + d));
const io = (t, a, d) => ease.p2io(prog(t, a, a + d));
const hud = (sc, a, text, o = {}) => K.hud(sc, a, text, { size: 34, ...o });
const lerp = (a, b, k) => a + (b - a) * k;
const frac = x => x - Math.floor(x);
const corners = (x0, y0, x1, y1, z = 0) => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
const isl = (sc, x0, y0, x1, y1, seed) => K.island(sc, { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: .9, th: 1.1, seed, tufts: 8 });
const txt = (sc, p, str, o = {}) => { const a = sc.V.P(p), fs = (o.size ?? 44) * sc.V.px; sc.add(`<text x="${f1(a[0])}" y="${f1(a[1] + fs * .34)}" text-anchor="middle" font-family="Geist Mono, monospace" font-weight="500" font-size="${f1(fs)}" fill="${o.color || PAL.ink}" opacity="${(o.alpha ?? 1).toFixed(2)}">${str}</text>`, sc.V.dep(p[0], p[1], p[2]) + .05, 'world'); };
const tick = (sc, [x, y], col, a = 1, s = 34) => sc.add(`<path d="M${f1(x - s * .5)},${f1(y)}L${f1(x - s * .12)},${f1(y + s * .4)}L${f1(x + s * .6)},${f1(y - s * .5)}" fill="none" stroke="${rgba(col, a)}" stroke-width="${f1(7 * sc.V.px)}" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>`, 0, 'hud');
const cross = (sc, [x, y], col, a = 1, s = 30) => sc.add(`<path d="M${f1(x - s)},${f1(y - s)}L${f1(x + s)},${f1(y + s)}M${f1(x + s)},${f1(y - s)}L${f1(x - s)},${f1(y + s)}" fill="none" stroke="${rgba(col, a)}" stroke-width="${f1(8 * sc.V.px)}" stroke-linecap="round" filter="url(#glow)"/>`, 0, 'hud');
// flat road line between two ground points (z .02)
const road = (sc, a, b, col, a0 = .55, dashed = true, k = 1) => { const V = sc.V, A = V.P(a[0], a[1], .03), B = V.P(b[0], b[1], .03), e = [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k]; sc.add(`<path d="M${pt(A)}L${pt(e)}" stroke="${rgba(col, a0)}" stroke-width="${f1(7 * V.px)}" stroke-linecap="round" fill="none"${dashed ? ` stroke-dasharray="${f1(14 * V.px)} ${f1(10 * V.px)}"` : ''}/>`, 0, 'floor'); };
// ---- objects -------------------------------------------------------------------------------------------------------------
// server rack: three lights = how busy (n lit, mint -> coral as it fills); dead = ember, no lights
function server(sc, x, y, o = {}) {
  const w = o.w ?? 1.3, h = o.h ?? 1.7, dead = o.dead ?? 0, B = { x: x - w / 2, y: y - w / 2, z: 0, w, d: w, h, color: mix(mix(PAL.sky, PAL.violet, .25), PAL.ember, dead * .8) };
  K.box(sc, B); const lit = o.load ?? 0;
  for (let i = 0; i < 3; i++) { const on = !dead && lit > i / 3 + .05, q = K.faceQuad(sc.V, B, 'left', .18, h - .5 - i * .42, w - .18, h - .22 - i * .42); sc.add(`<path d="${poly(q)}" fill="${on ? (lit > .75 ? PAL.coral : PAL.mint) : mix(PAL.ink, PAL.violet, .3)}"${on ? ' filter="url(#glow)"' : ''}/>`, sc.V.dep(x, y, h) + .05, 'world'); }
  if (dead > .3) cross(sc, sc.V.P(x, y, h + .9), PAL.ember, dead);
}
// the host: a saffron body, cream head, a pointing arm that turns toward (px,py)
function host(sc, x, y, o = {}) {
  const a = o.a ?? 1; K.box(sc, { x: x - .55, y: y - .55, z: 0, w: 1.1, d: 1.1, h: 2.0, color: mix(PAL.saffron, PAL.ink, o.dim ?? 0), opacity: a });
  K.box(sc, { x: x - .4, y: y - .4, z: 2.0, w: .8, d: .8, h: .8, color: mix(PAL.cream, PAL.ink, o.dim ?? 0), opacity: a });
  if (o.point) { const p = o.point; K.arrow(sc, [x, y, 1.5], [x + p[0] * 1.25, y + p[1] * 1.25, 1.5], { color: PAL.coral, w: 5, alpha: a }); }
}
function phoneP(sc, x, y, lit, o = {}) {
  const V = sc.V, w = o.w ?? 1.0, h = o.h ?? 1.7, B = { x: x - w / 2, y: y - .09, z: o.z ?? 0, w, d: .18, h, color: PAL.violet }; K.box(sc, B);
  const q = K.faceQuad(V, B, 'left', .07, .14, w - .07, h - .12); sc.add(`<path d="${poly(q)}" fill="${mix(PAL.ink, PAL.mint, .85 * lit)}"/>` + (lit > .05 ? `<path d="${poly(q)}" fill="${rgba(PAL.mint, .35 * lit)}" filter="url(#glow)"/>` : ''), V.dep(x, y, h / 2) + .03, 'world');
}
const dotP = (sc, x, y, z, col, a = 1, r = .13) => { const V = sc.V, p = V.P(x, y, z); sc.add(`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(r * V.s)}" fill="${rgba(col, a)}"/>`, V.dep(x, y, z) + 1, 'fx'); };
const keysFor = (at, extra = 3.2) => [{ t: at, pts: [...corners(-6.4, -3.2, 5.6, 3.0), [0, 0, extra]], zoom: 1.0 }];
const SY = [-2.6, -.2, 2.2];     // server rows (y) at x = 3.0
const SX = 3.0, HX = -2.2, PX = -5.6;

// ============================================================================================================================
// CARD 1  ONE COMPUTER: a crowd of visitors streams at one server; its lights fill to red and it breaks
function card1() {
  const w = win('A MILLION'), at = w.at, end = w.end, tM = W(1, 'million'), tD = W(1, 'die'), tWo = W(2, 'would'), tIn = W(2, 'instantly');
  const tag = t => t < tD ? 'A MILLION AT ONCE' : t < tIn ? 'ONE COMPUTER' : 'DEAD';
  return { tag, at, end, seed: 81, keys: keysFor(at), stills: [tM + .3, tD + .2, tWo + .3, tIn + .5], draw(sc, t) {
    const V = sc.V; isl(sc, -6.4, -3.4, 5.4, 3.0, 81);
    const R = rng(5), n = Math.floor(lerp(8, 70, prog(t, tM - .2, tIn))), load = prog(t, tM, tIn), dead = pin01(t, tIn, .3);
    server(sc, 2.4, 0, { load, dead, h: 2.2, w: 1.7 });
    for (let i = 0; i < n; i++) { const y0 = -3 + R() * 6, x0 = -6 + R() * 1.4, ph = frac(t * (.5 + R() * .4) + R()), a = 1 - dead * .8; if (t < tM - .3) continue; const x = lerp(x0, 1.4, ph), y = lerp(y0, 0, ph), z = .15 + 1.0 * Math.sin(ph * Math.PI); dotP(sc, x, y, z, i % 3 ? PAL.cream : PAL.sky, a); }
    if (dead > .1) K.rings(sc, { p: [2.4, 0, 2.6], n: 2, r: 2.2, r0: .5, color: PAL.ember, phase: t * .8, alpha: dead * .8, w: 3 });
    hud(sc, V.P(-3.8, 0, 2.0), '1 000 000', { color: PAL.cream, alpha: pin01(t, tM, .3) });
    hud(sc, V.P(2.4, 0, 4.6), 'ONE SERVER', { color: dead > .5 ? PAL.ember : PAL.sky, alpha: pin01(t, tD, .3) });
  } };
}
// ============================================================================================================================
// CARD 2  HUNDREDS OF COPIES: a wall of identical servers pops in, each with the same page on its screen
function card2() {
  const w = win('HUNDREDS'), at = w.at, end = w.end, tNo = W(3, 'not'), tH = W(4, 'hundreds'), tAll = W(4, 'running'), tCo = W(4, 'copy');
  const tag = t => t < tH ? 'NOT ONE COMPUTER' : t < tCo ? 'HUNDREDS' : 'SAME COPY OF THE SITE';
  return { tag, at, end, seed: 82, keys: [{ t: at, pts: [...corners(-5.6, -3.4, 5.6, 3.0), [0, 0, 3.2]], zoom: 1.0 }], stills: [tNo + .4, tH + .5, tAll + .5, tCo + .5], draw(sc, t) {
    const V = sc.V; isl(sc, -6.0, -3.6, 6.0, 3.2, 82);
    const cols = 6, rows = 3;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, k = pin01(t, tH - .2 + i * .045, .3), page = pin01(t, tAll - .1 + i * .02, .4); if (k < .02) continue;
      const x = -4.4 + c * 1.75, y = -2.4 + r * 2.1, h = 1.5 * k; server(sc, x, y, { w: 1.2, h, load: 0 });
      if (page > .05) K.box(sc, { x: x - .4, y: y - .1, z: h, w: .8, d: .2, h: .22, color: PAL.saffron, opacity: page });
    }
    hud(sc, V.P(0, 3.1, 0.6), '100s of SERVERS', { color: PAL.sky, alpha: pin01(t, tH, .3) });
    const page = pin01(t, tCo - .1, .4); hud(sc, V.P(4.6, 3.1, 0.6), 'SAME SITE', { color: PAL.saffron, alpha: page, align: 'c' });
  } };
}
// ============================================================================================================================
// CARD 3  ONE DOOR: the phone knocks once; a host stands in front of all the servers
function card3() {
  const w = win('ONE DOOR'), at = w.at, end = w.end, tOn = W(5, 'one'), tKn = W(5, 'knocks'), tMan = W(6, 'man'), tHost = W(6, 'host');
  const tag = t => t < tMan ? 'ONE DOOR' : 'THE HOST';
  return { tag, at, end, seed: 83, keys: keysFor(at), stills: [tKn + .3, tKn + 1.0, tMan + .6, tHost + .9], draw(sc, t) {
    const V = sc.V; isl(sc, -6.4, -3.4, 5.6, 3.0, 83);
    for (const y of SY) { server(sc, SX, y, { load: .15 }); road(sc, [HX + .8, 0], [SX - .9, y], PAL.sky, .35); }
    phoneP(sc, PX, 0, pin01(t, tOn, .3) * .9);
    const kn = prog(t, tKn - .2, tKn + .9); const hp = pin01(t, tMan - .1, .5);
    road(sc, [PX + .6, 0], [HX - .8, 0], PAL.saffron, .6);
    if (kn > 0 && kn < 1) K.packet(sc, [PX + .6, 0, .5], [HX - .8, 0, .5], kn, { color: PAL.saffron });
    host(sc, HX, 0, { a: 1 });
    hud(sc, V.P(PX, 0, 3.2), 'ONE DOOR', { color: PAL.saffron, alpha: pin01(t, tOn, .3) * (1 - hp) });
    hud(sc, V.P(HX, 0, 4.5), 'HOST', { color: PAL.saffron, alpha: hp });
    hud(sc, V.P(SX, -.2, 4.0), 'MANY SERVERS', { color: PAL.sky, alpha: hp, size: 30 });
  } };
}
// ============================================================================================================================
// CARD 4  HE POINTS: visitors arrive one by one; the host turns and sends each to the next server in turn
function card4() {
  const w = win('POINTS'), at = w.at, end = w.end, tPo = W(8, 'points'), t1 = W(8, 'one'), t2 = W(8, 'two'), tRo = W(8, 'round');
  const tag = t => t < t2 ? 'HE POINTS' : t < tRo ? 'TURN BY TURN' : 'ROUND AND ROUND';
  const send = [tPo + .1, t1 + .15, t2 + .2, tRo + .15, tRo + .8, tRo + 1.4];       // when each visitor leaves the host (s1 s2 s3 s1 s2 s3)
  return { tag, at, end, seed: 84, keys: keysFor(at), stills: [tPo + .3, t1 + .5, t2 + .5, tRo + 1.0], draw(sc, t) {
    const V = sc.V; isl(sc, -6.4, -3.4, 5.6, 3.0, 84);
    let cur = 1, hit = [0, 0, 0];
    send.forEach((ts, i) => { const k = (t - ts) / .7; if (t >= ts - .12) cur = i % 3; if (k > 1) hit[i % 3] = Math.min(1, hit[i % 3] + .34); });
    const dir = [SX - HX, SY[cur] - 0]; const L = Math.hypot(...dir);
    for (let s = 0; s < 3; s++) { server(sc, SX, SY[s], { load: Math.min(1, hit[s]) }); road(sc, [HX + .8, 0], [SX - .9, SY[s]], PAL.sky, s === cur ? .8 : .3); }
    host(sc, HX, 0, { point: t > tPo - .3 ? [dir[0] / L, dir[1] / L] : null });
    phoneP(sc, PX, 0, .8); road(sc, [PX + .6, 0], [HX - .8, 0], PAL.saffron, .5);
    // visitors queue at the phone and fly through the host to their server
    send.forEach((ts, i) => { const k = (t - ts) / .7; if (k < 0 || k > 1) return; const s = i % 3; K.packet(sc, [HX + .8, 0, .6], [SX - .9, SY[s], .6], k, { color: [PAL.coral, PAL.mint, PAL.violet][s], tail: .22 }); });
    for (let q = 0; q < 3; q++) { const nxt = send.filter(ts => ts > t).length; if (q < Math.min(3, nxt)) dotP(sc, PX + 1.0 + q * .45, 0, .3, PAL.cream, 1, .14); }
    ['1', '2', '3'].forEach((n, s) => hud(sc, V.P(SX + 1.0, SY[s], 1.3), n, { color: [PAL.coral, PAL.mint, PAL.violet][s], size: 30, alpha: pin01(t, tPo, .3) }));
  } };
}
// ============================================================================================================================
// CARD 5  THE EMPTIEST TABLE: server 2 is slow and full; the next visitor skips it for the emptiest one
function card5() {
  const w = win('EMPTIEST'), at = w.at, end = w.end, tSl = W(9, 'slow'), tNx = W(10, 'next'), tEm = W(10, 'emptiest'), tCt = W(10, 'count');
  const tag = t => t < tNx ? 'ONE IS SLOW' : t < tCt ? 'EMPTIEST FIRST' : 'HE KEEPS COUNT';
  return { tag, at, end, seed: 85, keys: keysFor(at), stills: [tSl + .5, tNx + .4, tEm + .6, tCt + .6], draw(sc, t) {
    const V = sc.V; isl(sc, -6.4, -3.4, 5.6, 3.0, 85);
    const fill = io(t, tSl - .2, .8), loads = [.35, .35 + .6 * fill, .1];
    for (let s = 0; s < 3; s++) { server(sc, SX, SY[s], { load: loads[s] }); road(sc, [HX + .8, 0], [SX - .9, SY[s]], PAL.sky, .3); }
    const pick = prog(t, tEm - .1, tEm + .8), tgt = 2, dir = [SX - HX, SY[tgt]], L = Math.hypot(...dir);
    host(sc, HX, 0, { point: t > tNx - .2 ? [dir[0] / L, dir[1] / L] : null });
    if (pick > 0 && pick < 1) K.packet(sc, [HX + .8, 0, .6], [SX - .9, SY[tgt], .6], pick, { color: PAL.cream, tail: .22 });
    // tally on the host
    hud(sc, V.P(HX, 0, 4.5), 'COUNT', { color: PAL.saffron, alpha: pin01(t, tCt - .15, .3) });
    hud(sc, V.P(SX + 1.1, SY[1], 2.2), 'SLOW', { color: PAL.coral, alpha: pin01(t, tSl + .1, .3) * (1 - prog(t, tEm + .8, tEm + 1.2)) });
    hud(sc, V.P(SX + 1.1, SY[2], 1.6), 'EMPTIEST', { color: PAL.mint, alpha: pin01(t, tEm, .3) });
    phoneP(sc, PX, 0, .8); road(sc, [PX + .6, 0], [HX - .8, 0], PAL.saffron, .5);
  } };
}
// ============================================================================================================================
// CARD 6  A BROKEN ONE: the host pings every server every few seconds; one stops answering, its road is cut, nobody notices
function card6() {
  const w = win('BROKEN'), at = w.at, end = w.end, tBr = W(11, 'break'), tCh = W(12, 'checks'), tFew = W(12, 'seconds'), tNo = W(12, 'guests'), tNot = W(12, 'notices');
  const tag = t => t < tCh ? 'A TABLE BREAKS' : t < tNo ? 'CHECKS EVERY FEW SECONDS' : 'NOBODY NOTICES';
  return { tag, at, end, seed: 86, keys: keysFor(at), stills: [tBr + .4, tCh + .5, tNo + .4, tNot + .6], draw(sc, t) {
    const V = sc.V; isl(sc, -6.4, -3.4, 5.6, 3.0, 86);
    const dead = pin01(t, tBr + .1, .35), cut = pin01(t, tNo - .3, .4);
    for (let s = 0; s < 3; s++) {
      const isD = s === 1; server(sc, SX, SY[s], { load: .3, dead: isD ? dead : 0 }); road(sc, [HX + .8, 0], [SX - .9, SY[s]], isD && cut > .5 ? PAL.ember : PAL.sky, isD && cut > .5 ? .15 : .4);
      // ping: a sky pulse leaves the host towards each server every 1.4 s once he "checks"
      const per = 1.4, ph = frac((t - tCh) / per); if (t > tCh - .2) { const k = ph * 1.6; if (k < 1) K.packet(sc, [HX + .8, 0, .9], [SX - .9, SY[s], .9], k, { color: PAL.sky, tail: .15, r: 5 }); else if (!(isD && dead > .5)) tick(sc, V.P(SX + .1, SY[s], 2.2), PAL.mint, Math.max(0, 1 - (k - 1) * 2.5), 22); }
    }
    host(sc, HX, 0, {}); phoneP(sc, PX, 0, .9); road(sc, [PX + .6, 0], [HX - .8, 0], PAL.saffron, .5);
    // guests keep flowing to the two healthy ones
    for (let i = 0; i < 4; i++) { const s = i % 2 ? 2 : 0, k = frac(t * .6 + i * .25); if (t > tNo - .3 || t < tBr) K.packet(sc, [HX + .8, 0, .6], [SX - .9, SY[s], .6], k, { color: PAL.cream, tail: .2, r: 5 }); }
    hud(sc, V.P(HX, 0, 4.5), 'CHECK', { color: PAL.sky, alpha: pin01(t, tCh, .3) });
    hud(sc, V.P(SX + 1.2, SY[1], 2.4), 'BROKEN', { color: PAL.ember, alpha: dead });
    hud(sc, V.P(PX, 0, 3.0), 'ALL FINE', { color: PAL.mint, alpha: pin01(t, tNot - .1, .3) });
  } };
}
// ============================================================================================================================
// CARD 7  THE HOST CAN'T BREAK: he cracks; a second host stands next to him and takes over
function card7() {
  const w = win('TWO HOSTS'), at = w.at, end = w.end, tW = W(13, 'wait'), tBr = W(13, 'break'), tGc = W(14, 'catch'), tTw = W(14, 'two');
  const tag = t => t < tGc ? 'THE HOST CAN\'T BREAK' : 'TWO HOSTS';
  return { tag, at, end, seed: 87, keys: keysFor(at, 5.2), stills: [tW + .4, tBr + .4, tGc + .5, tTw + .7], draw(sc, t) {
    const V = sc.V; isl(sc, -6.4, -3.4, 5.6, 3.0, 87);
    const crack = pin01(t, tBr - .15, .4) * (1 - pin01(t, tTw + .5, .5) * .0), second = pin01(t, tGc, .5), take = io(t, tTw + .1, .8);
    for (const y of SY) { server(sc, SX, y, { load: .3 }); road(sc, [HX + .8, -1.0], [SX - .9, y], PAL.sky, .3); road(sc, [HX + .8, 1.0], [SX - .9, y], PAL.sky, .3); }
    // host A (cracked, dim) and host B (appears)
    host(sc, HX, -1.1, { dim: crack * .55 }); if (crack > .5) cross(sc, V.P(HX, -1.1, 3.6), PAL.ember, crack);
    if (second > .02) host(sc, HX, 1.4, { a: second });
    phoneP(sc, PX, 0, .9); road(sc, [PX + .6, 0], [HX - .8, -1.1], PAL.saffron, lerp(.6, .12, take)); road(sc, [PX + .6, 0], [HX - .8, 1.4], PAL.saffron, .6 * take);
    for (let i = 0; i < 3; i++) { const k = frac(t * .6 + i / 3); const y = take > .5 ? 1.4 : -1.1; if (t > tW) K.packet(sc, [PX + .6, 0, .6], [HX - .8, y, .6], k, { color: PAL.cream, tail: .2, r: 5 }); }
    hud(sc, V.P(HX, -1.1, 4.4), 'HOST', { color: crack > .5 ? PAL.ember : PAL.saffron, alpha: pin01(t, tW, .3) });
    hud(sc, V.P(HX, 1.4, 4.4), 'HOST 2', { color: PAL.mint, alpha: second });
  } };
}
// ============================================================================================================================
// CARD 8/9  WHO POINTS TO THE HOSTS: a public list points to the two hosts; then the question climbs: lists above lists, hosts all the way up
function ladder(mode) {
  const nm = mode === 8 ? 'PUBLIC LIST' : 'ALL THE WAY UP', w = win(nm), at = w.at, end = w.end, tWh = W(15, 'points'), tLi = W(16, 'list'), tPu = W(16, 'public'), tCh = W(17, 'checks'), tUp = W(18, 'up'), tHo = W(18, 'hosts');
  const tag = t => mode === 8 ? (t < tLi ? 'WHO POINTS TO THE HOSTS' : 'A PUBLIC LIST') : (t < tHo ? 'AND WHO CHECKS THAT?' : 'HOSTS ALL THE WAY UP');
  return { tag, at, end, seed: 88 + mode, keys: [{ t: at, pts: [...corners(-5.4, -3.2, 5.4, 3.0), [0, 0, mode === 8 ? 5.2 : 8.2]], zoom: 1.0 }], stills: mode === 8 ? [tWh + .4, tLi + .3, tPu + .4, tPu + 1.0] : [tCh + .5, tHo - .4, tHo + .5, tUp + .4], draw(sc, t) {
    const V = sc.V; isl(sc, -5.8, -3.4, 5.8, 3.0, 88);
    const hostsK = mode === 8 ? pin01(t, at, .5) : 1, list = mode === 8 ? pin01(t, tWh - .1, .5) : 1;
    host(sc, -1.8, 1.4, { a: hostsK }); host(sc, 1.8, 1.4, { a: hostsK });
    const z1 = 3.6; K.slab(sc, { x: -2.2, y: -.6, z: z1, w: 4.4, d: 1.4, h: .3, r: .3, color: PAL.violet, opacity: list });
    txt(sc, [0, .1, z1 + .32], 'LIST', { size: 40, color: PAL.cream, alpha: list });
    if (list > .3) { K.arrow(sc, [-1.2, .5, z1], [-1.8, 1.4, 2.9], { color: PAL.mint, w: 4, alpha: list }); K.arrow(sc, [1.2, .5, z1], [1.8, 1.4, 2.9], { color: PAL.mint, w: 4, alpha: list }); }
    if (mode === 9) {
      for (let i = 0; i < 3; i++) { const k = pin01(t, tCh + .1 + i * .8, .4); if (k < .02) continue; const z = z1 + 1.7 + i * 1.7, host2 = i % 2 === 0;
        K.slab(sc, { x: -1.7, y: -.3, z, w: 3.4, d: 1.1, h: .3, r: .25, color: host2 ? PAL.saffron : PAL.violet, opacity: k }); txt(sc, [0, .25, z + .32], host2 ? 'HOSTS' : 'LIST', { size: 44, color: PAL.ink, alpha: k });
        K.arrow(sc, [0, .3, z], [0, .3, z - 1.1], { color: PAL.mint, w: 4, alpha: k }); }
      hud(sc, V.P(0, .3, z1 + 1.7 + 3 * 1.7 + .5), '?', { color: PAL.coral, alpha: pin01(t, tCh + 1.8, .3) });
    } else hud(sc, V.P(4.4, 1.4, z1 + .4), 'PUBLIC', { color: PAL.violet, alpha: list * pin01(t, tPu, .3), size: 30 });
    hud(sc, V.P(0, 2.3, .6), 'HOSTS', { color: PAL.saffron, alpha: hostsK, size: 30 });
  } };
}
const card8 = () => ladder(8), card9 = () => ladder(9);
