// ytrec MG: six cards (STORYBOARD.md) built from mg/isokit. Iso where depth helps (library of millions of videos, viewer phone, the loop of three stations);
// the bar boards are flat bars in the same palette. Every card is a pure function of global episode time t.
// Word times come from shots.json (W(line, word)). Engine contract (engine/mg-adapter.js): default export (mg, {ratio}) adds mg.beat()s; 9:16 uses 'float'.
// Text rule: every label >= 28 px at 1080 width (hud size 34 * px .85 = 28.9 px; own text 30 px).
// Colour: sky = watch time / signal packets, mint = picked / kept, violet = replays / candidates, coral = skips / bad, saffron = winner / shiny, ember = only "broken".
import { PAL, mix, rgba, f1, rng, poly, createScene } from '../../mg/isokit/core.js';
import * as K from '../../mg/isokit/prims.js';
import { background } from '../../mg/isokit/stage.js';
import { ease, prog } from '../../mg/isokit/motion.js';
import { camRig, viewAt } from '../../mg/isokit/camera.js';

const E = await (await fetch(new URL('./shots.json', import.meta.url))).json();
const BE = await (await fetch(new URL('./mg.beats.json', import.meta.url))).json();
const win = n => { const c = BE.cues.find(x => x.name === n); if (!c) throw new Error('ytrec mg: no beat ' + n); return c; };
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const W = (line, word, nth = 0) => { const c = E.words.filter(w => w.line === line && norm(w.w) === norm(word)); if (!c[nth]) throw new Error(`ytrec mg: no word "${word}" #${nth} in line ${line}`); return c[nth].s; };
const pin01 = (t, a, d = .5) => ease.p3out(prog(t, a, a + d));
const io = (t, a, d) => ease.p2io(prog(t, a, a + d));
const hud = (sc, a, text, o = {}) => K.hud(sc, a, text, { size: 34, ...o });          // 34 * .85 = 28.9 px
const lerp = (a, b, k) => a + (b - a) * k;
const G = (u, v, z = 0) => [u - v, -u - v, z];   // screen-horizontal u, screen-vertical v (up) -> world xyz
const FONT = "Geist Mono, monospace";

// ---- flat (screen space) glyphs; x,y are card pixels --------------------------------------------------------------------------------
const gadd = (sc, svg, depth = 3) => sc.add(svg, depth, 'hud');
function txt(sc, x, y, s, o = {}) { gadd(sc, `<text x="${f1(x)}" y="${f1(y)}" font-family="${FONT}" font-weight="${o.w ?? 600}" font-size="${o.size ?? 30}" text-anchor="${o.a ?? 'start'}" letter-spacing="1" fill="${o.col ?? PAL.cream}" opacity="${(o.alpha ?? 1).toFixed(3)}">${s}</text>`, o.depth ?? 6); }
function track(sc, x, y, w, h, k, col, o = {}) {   // bar with an empty track and a fill of fraction k
  const r = h / 2, fw = Math.max(0, Math.min(1, k)) * w; let s = `<g opacity="${(o.alpha ?? 1).toFixed(3)}"><rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(r)}" fill="${rgba(PAL.ink, .8)}" stroke="${rgba(PAL.cream, .26)}" stroke-width="1.6"/>`;
  if (fw > 2) s += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(Math.max(fw, h))}" height="${f1(h)}" rx="${f1(r)}" fill="${col}"/><rect x="${f1(x + 3)}" y="${f1(y + 2.5)}" width="${f1(Math.max(fw, h) - 6)}" height="${f1(h * .35)}" rx="${f1(r * .6)}" fill="${rgba(PAL.cream, .3)}"/>`;
  gadd(sc, s + '</g>', o.depth ?? 2);
}
function thumb(sc, x, y, w, h, col, o = {}) {   // a video thumbnail with a play triangle; x,y top-left
  const cx = x + w / 2, cy = y + h / 2, ts = h * .27, edge = o.edge ?? rgba(PAL.cream, .5);
  let s = `<g opacity="${(o.alpha ?? 1).toFixed(3)}"><rect x="${f1(x)}" y="${f1(y + 5)}" width="${f1(w)}" height="${f1(h)}" rx="10" fill="${mix(col, PAL.ink, .6)}"/>`
    + `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="10" fill="${mix(col, PAL.ink, .12)}" stroke="${edge}" stroke-width="${o.ew ?? 2}"/>`
    + `<rect x="${f1(x + 5)}" y="${f1(y + 5)}" width="${f1(w - 10)}" height="${f1(h * .42)}" rx="7" fill="${rgba(PAL.cream, .16)}"/>`
    + `<path d="M${f1(cx - ts * .6)},${f1(cy - ts)}L${f1(cx - ts * .6)},${f1(cy + ts)}L${f1(cx + ts * 1.05)},${f1(cy)}Z" fill="${PAL.cream}"/>`;
  gadd(sc, s + '</g>', o.depth ?? 3);
}
const G_clock = (x, y, r, col) => `<g transform="translate(${f1(x)},${f1(y)})"><circle r="${r}" fill="${rgba(PAL.ink, .6)}" stroke="${col}" stroke-width="4"/><path d="M0,${-r * .62}V0L${r * .45},${r * .3}" fill="none" stroke="${PAL.cream}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>`;
const G_heart = (x, y, s, col) => `<g transform="translate(${f1(x)},${f1(y)}) scale(${s})"><path d="M0,12C-22,-2 -12,-22 0,-9C12,-22 22,-2 0,12Z" fill="${col}" stroke="${PAL.ink}" stroke-width="2"/></g>`;
const G_replay = (x, y, r, col) => `<g transform="translate(${f1(x)},${f1(y)})"><path d="M${-r * .1},${-r}A${r},${r} 0 1 1 ${-r * .86},${-r * .5}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round"/><path d="M${-r * .1},${-r * 1.45}L${r * .35},${-r}L${-r * .1},${-r * .55}Z" fill="${col}"/></g>`;
const G_skip = (x, y, s, col) => `<g transform="translate(${f1(x)},${f1(y)}) scale(${s})"><path d="M-14,-11L0,0L-14,11ZM0,-11L14,0L0,11Z" fill="${col}"/><path d="M18,-11V11" stroke="${col}" stroke-width="5" stroke-linecap="round"/></g>`;
const G_trophy = (x, y, s) => `<g transform="translate(${f1(x)},${f1(y)}) scale(${s})"><path d="M-16,-20H16V-4C16,10 -16,10 -16,-4Z" fill="${PAL.saffron}" stroke="${PAL.ink}" stroke-width="2.5"/><path d="M-16,-15H-26C-26,-2 -20,2 -14,2M16,-15H26C26,-2 20,2 14,2" fill="none" stroke="${PAL.saffron}" stroke-width="4"/><rect x="-4" y="8" width="8" height="12" fill="${PAL.saffron}"/><rect x="-14" y="19" width="28" height="7" rx="3" fill="${mix(PAL.saffron, PAL.ink, .25)}" stroke="${PAL.ink}" stroke-width="2"/></g>`;
const G_cursor = (x, y, s, col = PAL.cream) => `<g transform="translate(${f1(x)},${f1(y)}) scale(${s})"><path d="M0,0V26L7,20L12,31L17,29L12,18H21Z" fill="${col}" stroke="${PAL.ink}" stroke-width="2.4" stroke-linejoin="round"/></g>`;
const G_cross = (x, y, s, col = PAL.coral, a = 1) => `<path d="M${f1(x - s)},${f1(y - s)}L${f1(x + s)},${f1(y + s)}M${f1(x + s)},${f1(y - s)}L${f1(x - s)},${f1(y + s)}" fill="none" stroke="${rgba(col, a)}" stroke-width="9" stroke-linecap="round"/>`;
function spark(sc, x, y, s, a = 1, col = PAL.cream) { if (a <= .01) return; gadd(sc, `<path d="M${f1(x)},${f1(y - s)}L${f1(x + s * .22)},${f1(y - s * .22)}L${f1(x + s)},${f1(y)}L${f1(x + s * .22)},${f1(y + s * .22)}L${f1(x)},${f1(y + s)}L${f1(x - s * .22)},${f1(y + s * .22)}L${f1(x - s)},${f1(y)}L${f1(x - s * .22)},${f1(y - s * .22)}Z" fill="${rgba(col, a)}"/>`, 7); }
function dot(sc, a, b, k, col = PAL.sky) {   // a glowing signal packet in screen space (an emitter: glow allowed)
  if (k <= .01 || k >= .99) return; const px = sc.V.px, x = lerp(a[0], b[0], k), y = lerp(a[1], b[1], k), k0 = Math.max(0, k - .14), tx = lerp(a[0], b[0], k0), ty = lerp(a[1], b[1], k0);
  gadd(sc, `<path d="M${f1(tx)},${f1(ty)}L${f1(x)},${f1(y)}" stroke="${rgba(col, .75)}" stroke-width="${f1(6 * px)}" stroke-linecap="round" filter="url(#glow)"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(8 * px)}" fill="${mix(col, PAL.cream, .55)}" filter="url(#glow2)"/>`, 9);
}
// viewer's phone: thin upright slab whose screen shows a video (play triangle). scr = screen colour
function vphone(sc, p, k = 1.8, scr = PAL.ink, a = 1) {
  const V = sc.V, [x, y, z] = p, w = .62 * k, d = .13 * k, h = 1.12 * k, B = { x: x - w / 2, y: y - d / 2, z, w, d, h, color: PAL.violet };
  let o = K.shadowSvg(V, x + .1 * k, y + .2 * k, z, .5 * k, .3) + K.boxSvg(V, B);
  o += `<path d="${poly(K.faceQuad(V, B, 'left', .05 * k, .1 * k, w - .05 * k, h - .08 * k))}" fill="${scr}"/>`;
  const q = (u, v) => K.facePt(V, B, 'left', u, v), cu = w / 2, cv = h * .52;
  o += `<path d="${poly([q(cu - .12 * k, cv - .17 * k), q(cu - .12 * k, cv + .17 * k), q(cu + .2 * k, cv)])}" fill="${PAL.cream}"/>`;
  o += `<path d="${poly([q(.1 * k, .2 * k), q(.1 * k + (w - .2 * k) * .35, .2 * k), q(.1 * k + (w - .2 * k) * .35, .26 * k), q(.1 * k, .26 * k)])}" fill="${PAL.coral}"/>`;   // tiny progress bar
  sc.add(`<g opacity="${a.toFixed(3)}">${o}</g>`, V.dep(x, y, z + h / 2));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 1  SIGNALS: the phone sends what you do (watch time, replays, skips, likes) to a board of bars that fill
function card1() {
  const w = win('SIGNALS'), at = w.at, end = w.end, tC = W(4, 'counts'), tW = W(4, 'watch'), tR = W(4, 'replay'), tS = W(4, 'skip'), tL = W(5, 'counts'), tSk = W(5, 'skips');
  const keys = [{ t: at, pts: [[-1.5, -1.5, 2.6], [1.5, 1.5, -1.6], [-1.5, 1.5, 0], [1.5, -1.5, 0]], zoom: 1.0 }];
  const rows = [{ lab: 'WATCH TIME', col: PAL.sky, t: tW, ic: 'clock', k: t => .92 * io(t, tW + .15, 1.5) },
    { lab: 'REPLAY', col: PAL.violet, t: tR, ic: 'replay', k: t => .36 * io(t, tR + .15, .4) + .34 * io(t, tR + .75, .4) },
    { lab: 'SKIP', col: PAL.coral, t: tS, ic: 'skip', k: t => .3 * io(t, tS + .15, .3) + .28 * io(t, tS + .5, .3) + .12 * io(t, tSk + .1, .4) },
    { lab: 'LIKE', col: PAL.mint, t: tL, ic: 'heart', k: t => .74 * io(t, tL + .15, .7) }];
  return { tag: 'SIGNALS', at, end, seed: 31, keys, box: { x: 26, y: 100, w: 340, h: 420 }, stills: [tC + .3, tW + .9, tR + .9, tS + .7, tL + .6], draw(sc, t) {
    const V = sc.V; K.island(sc, { x: -1.3, y: -1.3, w: 2.6, d: 2.6, r: .7, th: 1.0, seed: 90, tufts: 3 }); vphone(sc, [0, 0, .02], 1.8);
    const ph = V.P(0, 0, 1.7), x0 = 462, bw = 470;
    rows.forEach((r, i) => {
      const yc = 196 + i * 98, on = pin01(t, r.t - .05, .3), al = .38 + .62 * on, blink = i === 2 && t > tSk && t < tSk + .9 ? .5 + .5 * Math.sin((t - tSk) * 16) : 0;
      const ix = 408, ic = r.ic === 'clock' ? G_clock(ix, yc - 6, 21, r.col) : r.ic === 'heart' ? G_heart(ix, yc - 6, 1.15, r.col) : r.ic === 'replay' ? G_replay(ix, yc - 2, 16, r.col) : G_skip(ix, yc - 6, 1.1, r.col);
      gadd(sc, `<g opacity="${al.toFixed(3)}">${ic}</g>`, 4); txt(sc, x0, yc - 14, r.lab, { col: r.col, alpha: al });
      if (blink > 0) gadd(sc, `<rect x="${x0 - 8}" y="${yc - 42}" width="${bw + 16}" height="86" rx="14" fill="none" stroke="${rgba(PAL.coral, blink)}" stroke-width="4"/>`, 1);
      track(sc, x0, yc + 4, bw, 26, r.k(t), r.col, { alpha: al });
      dot(sc, [ph[0], ph[1]], [x0 + 14, yc + 17], prog(t, r.t - .2, r.t + .45), r.col);
    });
    hud(sc, [(V.W + 340) / 2 + 20, 112], t > tC ? 'WHAT IT COUNTS' : 'WHAT YOU DO', { color: PAL.saffron, alpha: pin01(t, at + .15, .3) });
  } };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 2  PICK: millions of videos (a field of tiles) -> a lens picks a few hundred -> they fly to a tray
const NI = 16, NJ = 12, LC = G(-1.75, 0), TC = G(3.6, 0), SP = .3, NSEL = 24, TCOL = 6, TROW = 4;
function card2() {
  const w = win('CANDIDATES'), at = w.at, end = w.end, tPk = W(6, 'picks'), tHu = W(6, 'hundred'), tMi = W(6, 'millions'), tH7 = W(7, 'hundreds'), tM7 = W(7, 'millions');
  const isl = [LC[0] - 2.7, LC[1] - 2.1, 5.4, 4.2], tray = [TC[0] - 1.5, TC[1] - 1.2, 3, 2.4];
  const pts = [[isl[0], isl[1], 1], [isl[0] + isl[2], isl[1] + isl[3], 0], [isl[0], isl[1] + isl[3], 0], [isl[0] + isl[2], isl[1], 0], [tray[0], tray[1], 1], [tray[0] + tray[2], tray[1] + tray[3], 0], [tray[0], tray[1] + tray[3], 0], [tray[0] + tray[2], tray[1], 0]];
  const keys = [{ t: at, pts, zoom: 1.0 }], R = rng(11), PALT = [PAL.sky, PAL.violet, PAL.coral, PAL.saffron, mix(PAL.cream, PAL.violet, .35)];
  const tiles = []; for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) tiles.push({ i, j, x: LC[0] + (i - (NI - 1) / 2) * SP, y: LC[1] + (j - (NJ - 1) / 2) * SP, c: mix(PALT[Math.floor(R() * PALT.length)], PAL.ink, .38), sel: -1 });
  const pick = tiles.map((t, ix) => ix).sort(() => R() - .5).slice(0, NSEL).map(ix => tiles[ix]).sort((a, b) => (a.x - a.y) - (b.x - b.y)); pick.forEach((t, k) => (t.sel = k));
  const slot = k => [TC[0] + ((k % TCOL) - (TCOL - 1) / 2) * .36 - ((Math.floor(k / TCOL)) - (TROW - 1) / 2) * 0, TC[1] + (Math.floor(k / TCOL) - (TROW - 1) / 2) * .36];
  return { tag: 'PICK', at, end, seed: 32, keys, stills: [tPk + .7, tHu + .3, tMi + .6, tH7 + .5], draw(sc, t) {
    const V = sc.V; K.island(sc, { x: isl[0], y: isl[1], w: isl[2], d: isl[3], r: .9, th: 1.0, seed: 5, tufts: 0 }); K.island(sc, { x: tray[0], y: tray[1], w: tray[2], d: tray[3], r: .7, th: .9, seed: 6, tufts: 0 });
    const dim = io(t, tM7 - .1, .5) * .55, tw = .24;
    for (const q of tiles) {   // library tiles; picked ones light, rise, and leave
      let z = 0, col = q.c, vis = 1;
      if (q.sel >= 0) { const f = q.sel / NSEL, lit = io(t, tPk + .1 + f * 1.1, .35), fl = io(t, tHu - .15 + f * .9, .75); col = mix(q.c, PAL.mint, lit); z = .22 * lit; if (fl > 0) vis = 0; }
      if (!vis) continue; K.box(sc, { x: q.x - tw / 2, y: q.y - tw / 2, z, w: tw, d: tw, h: .07, color: mix(col, PAL.ink, dim), rim: false, depth: V.dep(q.x, q.y, z) });
    }
    for (const q of pick) {   // the flight to the tray
      const f = q.sel / NSEL, e = io(t, tHu - .15 + f * .9, .75); if (e <= 0) continue; const s = slot(q.sel), bounce = t > tH7 && t < tH7 + .7 ? .16 * Math.sin((t - tH7) / .7 * Math.PI) * (1 - f * .4) : 0;
      const x = lerp(q.x, s[0], e), y = lerp(q.y, s[1], e), z = lerp(.22, 0, e) + 1.8 * Math.sin(Math.PI * e) * (e < 1 ? 1 : 0) + (e >= 1 ? bounce : 0);
      K.box(sc, { x: x - tw / 2, y: y - tw / 2, z, w: tw, d: tw, h: .1, color: PAL.mint, rim: true, depth: V.dep(x, y, z) + 3 });
    }
    // lens: a ring sweeping across the library while it picks
    const kl = prog(t, tPk - .1, tPk + 1.6); if (kl > 0 && kl < 1) { const u = lerp(-3.6, 0.2, kl), c = G(u, 0, .35), p = V.P(c), rr = 70 * V.px; gadd(sc, `<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(rr * 1.35)}" ry="${f1(rr)}" fill="${rgba(PAL.sky, .1)}" stroke="${rgba(PAL.sky, .9)}" stroke-width="${f1(4 * V.px)}" filter="url(#glow)"/>`, 5); }
    const lib = V.P(LC[0], LC[1], .1), tr = V.P(TC[0], TC[1], 1.1);
    hud(sc, [lib[0], lib[1] - 4 * 0 - 150 * V.px], 'MILLIONS', { color: PAL.violet, textColor: PAL.cream, alpha: pin01(t, tMi, .3) });
    hud(sc, [tr[0], tr[1] - 70 * V.px], 'A FEW HUNDRED', { color: PAL.mint, alpha: pin01(t, tHu, .3) });
    hud(sc, [V.W - 160, 116], 'JOB 1 · PICK', { color: PAL.saffron, alpha: pin01(t, tPk - .1, .3) });
  } };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 3  RANK: a second job scores each candidate by expected watch time; the best score goes first and is served to the phone
const SC = [.42, .92, .28, .68, .55], VC = [PAL.sky, PAL.violet, PAL.coral, PAL.saffron, PAL.mint];
function card3() {
  const w = win('RANKER'), at = w.at, end = w.end, tJob = W(8, 'job'), tSc = W(8, 'scores'), tHow = W(8, 'how'), tBe = W(8, 'best'), tFi = W(8, 'first');
  const order = SC.map((s, i) => i).sort((a, b) => SC[b] - SC[a]), rank = i => order.indexOf(i);
  const keys = [{ t: at, pts: [[-1.5, -1.5, 2.6], [1.5, 1.5, -1.6], [-1.5, 1.5, 0], [1.5, -1.5, 0]], zoom: 1.0 }];
  return { tag: 'RANK', at, end, seed: 33, keys, box: { x: 700, y: 170, w: 240, h: 330 }, stills: [tSc + .9, tHow + .5, tBe + .45, tBe + .95], draw(sc, t) {
    const V = sc.V, kSort = io(t, tBe - .05, 1.0), win0 = rank(1) === 0 ? 1 : 0, kFly = prog(t, tFi + .05, tFi + .7), topI = order[0];
    K.island(sc, { x: -1.3, y: -1.3, w: 2.6, d: 2.6, r: .7, th: 1.0, seed: 91, tufts: 3 }); vphone(sc, [0, 0, .02], 1.8, kFly >= .99 ? mix(VC[topI], PAL.ink, .15) : PAL.ink);
    for (let i = 0; i < 5; i++) {
      const rk = lerp(i, rank(i), kSort), yc = 196 + rk * 66, top = rank(i) === 0 && kSort > .95, a = .35 + .65 * pin01(t, at + .1 + i * .06, .3);
      thumb(sc, 44, yc - 26, 92, 52, VC[i], { alpha: a, edge: top ? PAL.saffron : rgba(PAL.cream, .5), ew: top ? 4 : 2 });
      track(sc, 156, yc - 14, 400, 28, SC[i] * io(t, tSc + i * .14, .8), VC[i], { alpha: a });
      if (top) { gadd(sc, `<rect x="36" y="${yc - 34}" width="530" height="68" rx="14" fill="none" stroke="${PAL.saffron}" stroke-width="4"/>`, 1); hud(sc, [606, yc], 'TOP PICK', { color: PAL.saffron, align: 'l', alpha: pin01(t, tFi - .2, .3) }); }
    }
    hud(sc, [330, 126], t > tHow - .05 ? 'HOW LONG WILL YOU WATCH?' : 'JOB 2 · SCORE', { color: PAL.sky, alpha: pin01(t, tJob - .1, .3) });
    const ph = V.P(0, 0, 1.7); dot(sc, [590, 196], [ph[0] - 30, ph[1]], kFly, PAL.saffron);
  } };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 4  CLICK VS WATCH: a shiny video wins the clicks, a plain one wins the watch time; watch time is what the ranker rewards
function card4() {
  const w = win('CLICK VS WATCH'), at = w.at, end = w.end, tCl = W(9, 'click'), tClk = W(10, 'click'), tChe = W(10, 'cheap'), tSh = W(10, 'shiny'), tWa = W(10, 'watch'), tPr = W(10, 'prize');
  const keys = [{ t: at, pts: [[-1, -1, 1], [1, 1, 0]], zoom: 1 }];
  const rowsY = [262, 430], rows = [{ lab: 'SHINY', col: PAL.saffron, cl: .97, wa: .1 }, { lab: 'PLAIN', col: PAL.violet, cl: .2, wa: .88 }];
  return { tag: 'CLICK VS WATCH', at, end, seed: 34, keys, stills: [tCl + .5, tChe + .5, tSh + .5, tWa + .8, tPr + .35], draw(sc, t) {
    const V = sc.V, kWin = pin01(t, tPr, .45), x0 = 232, bw = 690;
    gadd(sc, `<rect x="${x0}" y="132" width="26" height="26" rx="6" fill="${PAL.sky}"/>`, 3); txt(sc, x0 + 40, 154, 'CLICKS', { col: PAL.sky });
    gadd(sc, `<rect x="${x0 + 250}" y="132" width="26" height="26" rx="6" fill="${PAL.mint}"/>`, 3); txt(sc, x0 + 290, 154, 'WATCHED', { col: PAL.mint });
    rows.forEach((r, i) => {
      const yc = rowsY[i], a = (.35 + .65 * pin01(t, at + .1 + i * .1, .3)) * (i === 0 ? 1 - .55 * kWin : 1), win1 = i === 1 && kWin > .01;
      const kc = i === 0 ? r.cl * io(t, tCl - .15, 2.4) : r.cl * io(t, tCl - .15, 1.2), kw = r.wa * io(t, tWa, 1.0);
      thumb(sc, 40, yc - 52, 152, 88, r.col, { alpha: a, edge: win1 ? PAL.saffron : rgba(PAL.cream, .5), ew: win1 ? 5 : 2 });
      txt(sc, 116, yc + 76, r.lab, { a: 'middle', col: r.col, alpha: a, size: 30 });
      track(sc, x0, yc - 40, bw, 30, kc, PAL.sky, { alpha: a }); track(sc, x0, yc + 4, bw, 30, kw, PAL.mint, { alpha: a });
      if (i === 0) {   // sparkles on the shiny thumb + a tapping cursor at the end of its CLICKS bar
        for (let s = 0; s < 3; s++) spark(sc, [60, 170, 100][s] + 6, yc - 40 + [12, 56, 30][s], [14, 11, 9][s], a * (.55 + .45 * Math.sin(t * 7 + s * 2)));
        const tap = t > tCl && t < tSh + .6 ? Math.abs(Math.sin((t - tCl) * 9)) : 0, cx = x0 + bw * Math.min(kc, .97) + 24; if (t > tCl - .1 && t < tSh + .9) gadd(sc, G_cursor(cx, yc - 20 + tap * 8, 1.3 - tap * .15), 8);
        if (kWin > .2) gadd(sc, G_cross(x0 + bw / 2, yc - 3, 34, PAL.coral, kWin), 8); }
      if (i === 1 && kWin > .01) gadd(sc, `<g opacity="${kWin.toFixed(3)}">${G_trophy(x0 + bw + 8, yc - 20, 1.25)}</g>`, 8);
    });
    hud(sc, [V.W / 2, 512], 'WATCH TIME WINS', { color: PAL.saffron, alpha: pin01(t, tPr + .15, .3) });
  } };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 5  LEFT EARLY: a shiny title promises a lot, the viewer leaves after a few seconds, the video's score falls
function card5() {
  const w = win('LEFT EARLY'), at = w.at, end = w.end, tLi = W(11, 'liar'), tLe = W(12, 'leave'), tSe = W(12, 'seconds'), tLn = W(12, 'learns');
  const keys = [{ t: at, pts: [[-1, -1, 1], [1, 1, 0]], zoom: 1 }];
  return { tag: 'LEFT EARLY', at, end, seed: 35, keys, stills: [tLi + .5, tLe + .55, tSe + .4, tLn + .3], draw(sc, t) {
    const V = sc.V, kIn = pin01(t, at + .1, .4), kL = io(t, tLe - .05, .35), kF = io(t, tLn, .8), g = .9 - .75 * kF;
    thumb(sc, 50, 160, 350, 190, PAL.saffron, { alpha: kIn }); txt(sc, 225, 262, 'SHINY TITLE!', { a: 'middle', col: PAL.ink, size: 34, w: 800, alpha: kIn });
    for (let s = 0; s < 4; s++) spark(sc, [86, 360, 330, 120][s], 188 + [4, 10, 150, 150][s], [15, 12, 12, 9][s], kIn * (.5 + .5 * Math.sin(t * 6 + s * 1.7)));
    const ph = t < tLe ? .02 + .1 * prog(t, at + .3, tLe) : .12; track(sc, 50, 384, 350, 22, ph, PAL.sky, { alpha: kIn });
    gadd(sc, `<circle cx="${f1(50 + 350 * ph)}" cy="395" r="${f1(15 * V.px)}" fill="${PAL.cream}" stroke="${PAL.ink}" stroke-width="3"/>`, 4);
    hud(sc, [225, 124], 'BIG PROMISE', { color: PAL.saffron, alpha: pin01(t, tLi - .05, .3) });
    if (kL > .01) {   // the viewer leaves: ember exit arrow
      gadd(sc, `<g opacity="${kL.toFixed(3)}" transform="translate(${f1(lerp(250, 330, kL))},455)"><path d="M-48,0H34M12,-22L40,0L12,22" fill="none" stroke="${PAL.ember}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></g>`, 5);
      hud(sc, [225, 515], t > tSe ? 'A FEW SECONDS' : 'LEFT EARLY', { color: PAL.ember, textColor: PAL.cream, alpha: kL }); }
    // score gauge
    txt(sc, 760, 146, 'SCORE', { a: 'middle', col: PAL.mint });
    const gx = 700, gy = 170, gw = 120, gh = 300; gadd(sc, `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="20" fill="${rgba(PAL.ink, .8)}" stroke="${rgba(PAL.cream, .26)}" stroke-width="1.6"/>`, 2);
    gadd(sc, `<rect x="${gx}" y="${f1(gy + gh * (1 - g))}" width="${gw}" height="${f1(gh * g)}" rx="20" fill="${mix(PAL.mint, PAL.coral, kF)}"/><rect x="${gx + 8}" y="${f1(gy + gh * (1 - g) + 6)}" width="${gw - 16}" height="14" rx="7" fill="${rgba(PAL.cream, .3)}"/>`, 3);
    dot(sc, [ph * 350 + 50, 395], [gx - 10, gy + gh / 2], prog(t, tLn - .3, tLn + .55), PAL.sky);
    if (kF > .05) { gadd(sc, `<g opacity="${Math.min(1, kF * 2).toFixed(3)}"><path d="M${gx - 56},${gy + 70}V${gy + 170}M${gx - 80},${gy + 140}L${gx - 56},${gy + 176}L${gx - 32},${gy + 140}" fill="none" stroke="${PAL.coral}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></g>`, 5); hud(sc, [760, 515], 'SCORE DROPS', { color: PAL.coral, alpha: pin01(t, tLn + .1, .3) }); }
  } };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 6  THE LOOP: watch -> learn -> pick -> (what you watch next) -> learn again
const ST = [G(-3.3, -.7), G(0, 1.55), G(3.3, -.7)], SN = ['WATCH', 'LEARN', 'PICK'], SCOL = [PAL.sky, PAL.mint, PAL.saffron];
function card6() {
  const w = win('THE LOOP'), at = w.at, end = w.end, t1 = W(13, 'watch'), tFe = W(14, 'feeds'), tRo = W(14, 'round'), tW = W(14, 'watch'), tLe = W(14, 'learn'), tPi = W(14, 'pick'), tLp = W(14, 'loop');
  const pts = ST.flatMap(c => [[c[0] - 1.4, c[1] - 1.4, 2.4], [c[0] + 1.4, c[1] + 1.4, -1.2], [c[0] - 1.4, c[1] + 1.4, 0], [c[0] + 1.4, c[1] - 1.4, 0]]);
  const keys = [{ t: at, pts, zoom: 1.0 }], T0 = [t1, tFe, tRo, tW, tLe, tPi, tLp + .1];   // packet legs: 1->2, 2->3, 3->1 (slow lap), then 1->2 on "watch,learn", 2->3 on "pick", 3->1 on "again"
  const edge = (a, b) => [[a[0], a[1], 1.1], [b[0], b[1], 1.1]];
  function where(t) {   // packet position along the triangle: returns [edge index, k]
    const legs = [[0, T0[0], T0[1]], [1, T0[1], T0[2]], [2, T0[2], T0[3]], [0, T0[3], T0[4]], [1, T0[4], T0[5]], [2, T0[5], T0[6]]];
    for (const [e, a, b] of legs) if (t >= a && t < b) return [e, prog(t, a, b)]; return [-1, 0];
  }
  return { tag: 'THE LOOP', at, end, seed: 36, keys, stills: [t1 + .5, tRo + .1, tW + .45, tLe + .45, tPi + .45, tLp + .5], draw(sc, t) {
    const V = sc.V, lit = i => (t >= [tW, tLe, tPi][i] - .05 ? 1 : 0) * (t < tLp ? 1 : 1), kLoop = pin01(t, tLp, .5), [ce, ck] = where(t), act = [t >= tW && t < tLe ? 0 : -1, t >= tLe && t < tPi ? 1 : -1, t >= tPi && t < tLp ? 2 : -1];
    ST.forEach((c, i) => K.island(sc, { x: c[0] - 1.2, y: c[1] - 1.2, w: 2.4, d: 2.4, r: .7, th: .9, seed: 70 + i, tufts: 3 }));
    // edges + packet
    for (let e = 0; e < 3; e++) { const a = ST[e], b = ST[(e + 1) % 3], on = ce === e ? .95 : .3 + .6 * kLoop; K.beam(sc, edge(a, b)[0], edge(a, b)[1], { color: kLoop > .05 ? PAL.saffron : PAL.sky, alpha: on, w: 3.2, dash: '12 9' }); }
    if (ce >= 0) { const a = ST[ce], b = ST[(ce + 1) % 3]; K.packet(sc, [a[0], a[1], 1.1], [b[0], b[1], 1.1], ck, { color: SCOL[ce], r: 9 }); }
    const pulse = i => (act[i] === i ? 1 + .06 * Math.sin(t * 14) : 1);
    vphone(sc, [ST[0][0], ST[0][1], .02], 1.5 * pulse(0));
    [[.55, sc.V.px], [.9, 0], [.7, 0]].forEach((_, j) => { const h = (.5 + [.9, .5, .8][j] * (act[1] === 1 ? .5 + .5 * Math.sin(t * 8 + j * 2) : .7)) * 1; K.box(sc, { x: ST[1][0] - .7 + j * .52, y: ST[1][1] - .3, z: .02, w: .38, d: .6, h, color: [PAL.sky, PAL.mint, PAL.coral][j], depth: V.dep(ST[1][0] + j, ST[1][1], 0) }); });
    [PAL.violet, PAL.sky, PAL.saffron].forEach((c, j) => K.box(sc, { x: ST[2][0] - .75, y: ST[2][1] - .55, z: .02 + j * .34, w: 1.5, d: 1.1, h: .26, color: j === 2 && act[2] === 2 ? PAL.saffron : mix(c, PAL.ink, j === 2 ? 0 : .25), depth: V.dep(ST[2][0], ST[2][1], j) }));
    ST.forEach((c, i) => { const p = V.P(c[0], c[1], 0); hud(sc, [p[0], i === 1 ? p[1] - 150 * V.px : p[1] + 120 * V.px], SN[i], { color: SCOL[i], alpha: i === 0 ? 1 : pin01(t, at + .2 + i * .2, .3), textColor: act[i] === i ? PAL.cream : undefined }); });
    if (kLoop > .01) { const p = V.P(0, -.7, 0); hud(sc, [p[0], p[1] + 20 * V.px], 'LOOP', { color: PAL.saffron, alpha: kLoop, size: 46 }); }
  } };
}

// the layout switch re-frames the scene, so a card enters/leaves ON a shot cut when one is close
const cuts = (E.shots || []).map(x => x.t0).filter(x => x > 0);
const snap = (t, lo, hi) => { const c = cuts.filter(x => x >= t - lo && x <= t + hi).sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0]; return c ?? t; };
export const CARDS = [card1(), card2(), card3(), card4(), card5(), card6()].map(c => ({ ...c, at: snap(c.at, .35, .05), end: snap(c.end, .4, .1) })).map(c => ({ ...c, stills: c.stills.filter(x => x > c.at + .3 && x < c.end - .35) }));
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
