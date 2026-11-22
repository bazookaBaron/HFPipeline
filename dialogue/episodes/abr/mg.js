// abr MG: eight cards (STORYBOARD.md) built from the isokit palette. The subject is one little picture (sun, hills, house) drawn at three qualities
// (BLURRY 5x4 blocks, OK 10x8 blocks, SHARP vector), moved around a server -> pipe -> TV player stage. Every card is a pure function of global episode time t.
// Word times come from shots.json (W(line, word)). Engine contract (engine/mg-adapter.js): default export (mg, {ratio}) adds mg.beat()s; 9:16 uses 'float'.
// Text rule: every label >= 28 px at 1080 width (hud size 34 * px .85 = 28.9 px; own text 30 px+).
// Colour: sky = data / wifi, mint = ok / saved / on time, saffron = chosen / cushion, coral = late sharp piece, violet = slow, ember = only "broken" (the freeze).
import { PAL, mix, rgba, f1, createScene } from '../../mg/isokit/core.js';
import * as K from '../../mg/isokit/prims.js';
import { background } from '../../mg/isokit/stage.js';
import { ease, prog } from '../../mg/isokit/motion.js';
import { camRig, viewAt } from '../../mg/isokit/camera.js';

const E = await (await fetch(new URL('./shots.json', import.meta.url))).json();
const BE = await (await fetch(new URL('./mg.beats.json', import.meta.url))).json();
const win = n => { const c = BE.cues.find(x => x.name === n); if (!c) throw new Error('abr mg: no beat ' + n); return c; };
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const W = (line, word, nth = 0) => { const c = E.words.filter(w => w.line === line && norm(w.w) === norm(word)); if (!c[nth]) throw new Error(`abr mg: no word "${word}" #${nth} in line ${line}`); return c[nth].s; };
const pin = (t, a, d = .4) => ease.p3out(prog(t, a, a + d));
const io = (t, a, d) => ease.p2io(prog(t, a, a + d));
const lerp = (a, b, k) => a + (b - a) * k;
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const CREAM = PAL.cream, INK = PAL.ink;
const A = (sc, s) => { if (s) sc.add(s, 0, 'hud'); };                       // everything is added in draw order on one layer
const chip = (sc, x, y, text, col, alpha = 1, o = {}) => { if (alpha <= .01) return; const dark = [PAL.violet, PAL.ember, PAL.coral].includes(col); K.hud(sc, [x, y], text, { size: 34, color: col, textColor: dark ? CREAM : col, alpha, ...o }); };
const text = (x, y, s, size, col, o = {}) => `<text x="${f1(x)}" y="${f1(y)}" text-anchor="${o.anchor || 'middle'}" font-family="Geist Mono, monospace" font-weight="700" font-size="${size}" fill="${col}"${o.op != null ? ` opacity="${o.op.toFixed(2)}"` : ''}>${s}</text>`;
// ---- glyphs --------------------------------------------------------------------------------------------------------------------
const tickS = (x, y, k, col = PAL.mint, s = 34) => k <= .01 ? '' : `<path d="M${f1(x - s * .5)},${f1(y)}L${f1(x - s * .12)},${f1(y + s * .4)}L${f1(x + s * .6)},${f1(y - s * .5)}" fill="none" stroke="${rgba(col, k)}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
const crossS = (x, y, k, col = PAL.ember, s = 30) => k <= .01 ? '' : `<path d="M${f1(x - s)},${f1(y - s)}L${f1(x + s)},${f1(y + s)}M${f1(x + s)},${f1(y - s)}L${f1(x - s)},${f1(y + s)}" fill="none" stroke="${rgba(col, k)}" stroke-width="9" stroke-linecap="round"/>`;
const badge = (x, y, n, col = PAL.saffron, k = 1) => k <= .01 ? '' : `<g opacity="${k.toFixed(2)}"><circle cx="${f1(x)}" cy="${f1(y)}" r="22" fill="${col}" stroke="${INK}" stroke-width="3"/>${text(x, y + 10, n, 30, INK)}</g>`;
function arrowS(x1, y1, x2, y2, col, k = 1, w = 7, dash = false) {
  if (k <= .01) return ''; const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, ex = x1 + dx * k, ey = y1 + dy * k, h = 18;
  return `<path d="M${f1(x1)},${f1(y1)}L${f1(ex)},${f1(ey)}" stroke="${rgba(col, .95)}" stroke-width="${w}" stroke-linecap="round" fill="none"${dash ? ' stroke-dasharray="14 10"' : ''}/>` + (k > .97 ? `<path d="M${f1(ex)},${f1(ey)}L${f1(ex - ux * h + uy * h * .6)},${f1(ey - uy * h - ux * h * .6)}L${f1(ex - ux * h - uy * h * .6)},${f1(ey - uy * h + ux * h * .6)}Z" fill="${col}"/>` : '');
}
function spinner(x, y, r, t, col = PAL.coral, k = 1) {
  if (k <= .01) return ''; const a0 = (t * 7) % (Math.PI * 2), a1 = a0 + 4.2, p = a => `${f1(x + r * Math.cos(a))},${f1(y + r * Math.sin(a))}`;
  return `<g opacity="${k.toFixed(2)}"><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="none" stroke="${rgba(CREAM, .25)}" stroke-width="${f1(r * .22)}"/><path d="M${p(a0)}A${f1(r)},${f1(r)} 0 1 1 ${p(a1)}" fill="none" stroke="${col}" stroke-width="${f1(r * .22)}" stroke-linecap="round"/></g>`;
}
function wifiSym(x, y, s, bars, col = PAL.sky) {   // dot + 3 arcs; bars 0..3 (fractional) = how many arcs are lit
  let o = `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s * .09)}" fill="${col}"/>`;
  for (let i = 1; i <= 3; i++) { const r = s * (.28 + i * .25), a = .72, lit = cl(bars - i + 1), c = lit > .5 ? col : rgba(CREAM, .22);
    o += `<path d="M${f1(x - r * Math.sin(a))},${f1(y - r * Math.cos(a))}A${f1(r)},${f1(r)} 0 0 1 ${f1(x + r * Math.sin(a))},${f1(y - r * Math.cos(a))}" fill="none" stroke="${c}" stroke-width="${f1(s * .11)}" stroke-linecap="round" opacity="${(.35 + .65 * lit).toFixed(2)}"/>`; }
  return `<g filter="url(#glow)">${o}</g>`;
}
// ---- the picture (the movie frame): sun, two hills, a house; sampled for the blocky levels, drawn as vectors for SHARP -----------------------
const hill1 = u => .67 + .07 * Math.sin(u * 6.2 + .6), hill2 = u => .84 + .045 * Math.sin(u * 4.1 + 2.2);
function sceneCol(u, v) {
  if (v > hill2(u)) return PAL.teal;
  if (u > .14 && u < .40 && v > .55 && v < .78) return (u > .20 && u < .27 && v > .60 && v < .68) ? CREAM : (u > .31 && u < .36 && v > .66) ? INK : PAL.coral;
  if (v < .56 && Math.abs(u - .27) < .15 && v > .40 + (.16 / .15) * Math.abs(u - .27)) return PAL.violet;
  if (v > hill1(u)) return PAL.mint;
  if (Math.hypot((u - .74) * 1.333, v - .27) < .14) return PAL.saffron;
  return mix(PAL.sky, CREAM, cl(v / .72));
}
// one tile, centred at (x,y), size w x h. lvl 0 BLURRY, 1 OK, 2 SHARP. o: {alpha, rot, ring, dim, fill (0..1 download progress), shadow}
function pic(x, y, w, h, lvl, o = {}) {
  const al = o.alpha ?? 1; if (al <= .01) return ''; const x0 = -w / 2, y0 = -h / 2; let g = '';
  if (o.shadow !== false) g += `<rect x="${f1(x0 + 5)}" y="${f1(y0 + 8)}" width="${f1(w)}" height="${f1(h)}" rx="6" fill="${rgba(PAL.shade, .55)}"/>`;
  if (o.ring) g += `<rect x="${f1(x0 - 7)}" y="${f1(y0 - 7)}" width="${f1(w + 14)}" height="${f1(h + 14)}" rx="10" fill="none" stroke="${o.ring}" stroke-width="6"/>`;
  if (lvl >= 2) {
    g += `<defs><linearGradient id="pgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${PAL.sky}"/><stop offset=".72" stop-color="${CREAM}"/></linearGradient></defs><rect x="${f1(x0)}" y="${f1(y0)}" width="${f1(w)}" height="${f1(h)}" fill="url(#pgr)"/>`;
    const X = u => f1(x0 + u * w), Y = v => f1(y0 + v * h), hp = f => { let d = `M${X(0)},${Y(1)}`; for (let u = 0; u <= 1.001; u += .05) d += `L${X(u)},${Y(f(u))}`; return d + `L${X(1)},${Y(1)}Z`; };
    g += `<circle cx="${X(.74)}" cy="${Y(.27)}" r="${f1(.14 * h)}" fill="${PAL.saffron}"/><path d="${hp(hill1)}" fill="${PAL.mint}"/>`
      + `<rect x="${X(.14)}" y="${Y(.55)}" width="${f1(.26 * w)}" height="${f1(.23 * h)}" fill="${PAL.coral}"/><path d="M${X(.12)},${Y(.56)}L${X(.27)},${Y(.40)}L${X(.42)},${Y(.56)}Z" fill="${PAL.violet}"/>`
      + `<rect x="${X(.20)}" y="${Y(.60)}" width="${f1(.07 * w)}" height="${f1(.08 * h)}" fill="${CREAM}"/><rect x="${X(.31)}" y="${Y(.66)}" width="${f1(.05 * w)}" height="${f1(.12 * h)}" fill="${INK}"/><path d="${hp(hill2)}" fill="${PAL.teal}"/>`;
  } else {
    const nx = lvl === 0 ? 5 : 10, ny = lvl === 0 ? 4 : 8, cw = w / nx, ch = h / ny;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) g += `<rect x="${f1(x0 + i * cw)}" y="${f1(y0 + j * ch)}" width="${f1(cw + .7)}" height="${f1(ch + .7)}" fill="${sceneCol((i + .5) / nx, (j + .5) / ny)}"/>`;
  }
  if (o.dim) g += `<rect x="${f1(x0)}" y="${f1(y0)}" width="${f1(w)}" height="${f1(h)}" fill="${rgba(INK, o.dim)}"/>`;
  if (o.fill != null && o.fill < 1) g += `<rect x="${f1(x0)}" y="${f1(y0)}" width="${f1(w)}" height="${f1(h)}" fill="${rgba(INK, .78)}"/><rect x="${f1(x0)}" y="${f1(y0 + h * .42)}" width="${f1(w * cl(o.fill))}" height="${f1(h * .16)}" fill="${PAL.sky}"/><rect x="${f1(x0)}" y="${f1(y0 + h * .42)}" width="${f1(w)}" height="${f1(h * .16)}" fill="none" stroke="${rgba(CREAM, .7)}" stroke-width="3"/>`;
  g += `<rect x="${f1(x0)}" y="${f1(y0)}" width="${f1(w)}" height="${f1(h)}" fill="none" stroke="${INK}" stroke-width="4"/>`;
  return `<g opacity="${al.toFixed(3)}" transform="translate(${f1(x)},${f1(y)}) rotate(${f1(o.rot ?? 0)})">${g}</g>`;
}
const emptySlot = (x, y, w, h, col = CREAM, a = .5) => `<rect x="${f1(x - w / 2)}" y="${f1(y - h / 2)}" width="${f1(w)}" height="${f1(h)}" rx="6" fill="${rgba(INK, .5)}" stroke="${rgba(col, a)}" stroke-width="3.5" stroke-dasharray="11 8"/>`;
// ---- stage props -----------------------------------------------------------------------------------------------------------------
function server(x, y, a = 1) {
  let s = `<g opacity="${a.toFixed(2)}">`;
  for (let i = 0; i < 3; i++) { const yy = y - 66 + i * 46; s += `<rect x="${x - 58}" y="${yy + 8}" width="116" height="40" rx="10" fill="${PAL.tealDeep}"/><rect x="${x - 58}" y="${yy}" width="116" height="40" rx="10" fill="${PAL.teal}" stroke="${rgba(CREAM, .4)}" stroke-width="2.5"/><circle cx="${x - 38}" cy="${yy + 20}" r="6" fill="${PAL.mint}"/><circle cx="${x - 20}" cy="${yy + 20}" r="6" fill="${PAL.sky}"/><rect x="${x + 4}" y="${yy + 14}" width="44" height="12" rx="6" fill="${rgba(INK, .55)}"/>`; }
  return s + '</g>';
}
function tv(x, y, w, h, a = 1) {   // frame only; draw the picture on top at (x, y, w, h)
  return `<g opacity="${a.toFixed(2)}"><rect x="${f1(x - 26)}" y="${f1(y + h / 2 + 6)}" width="52" height="18" rx="5" fill="${PAL.panel}"/><rect x="${f1(x - 44)}" y="${f1(y + h / 2 + 18)}" width="88" height="10" rx="5" fill="${PAL.panel}"/><rect x="${f1(x - w / 2 - 11)}" y="${f1(y - h / 2 - 11)}" width="${f1(w + 22)}" height="${f1(h + 22)}" rx="14" fill="${PAL.panel}" stroke="${rgba(CREAM, .5)}" stroke-width="3"/></g>`;
}
function pipe(x1, x2, y, h, t, speed, col = PAL.sky, a = 1) {
  let s = `<g opacity="${a.toFixed(2)}"><rect x="${f1(x1)}" y="${f1(y - h / 2)}" width="${f1(x2 - x1)}" height="${f1(h)}" rx="${f1(h / 2)}" fill="${rgba(INK, .85)}" stroke="${rgba(col, .75)}" stroke-width="3.5"/>`;
  const sp = 46, off = (t * speed) % sp; let d = ''; for (let x = x1 + 20 + off; x < x2 - 14; x += sp) d += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.min(6, h * .22))}" fill="${col}"/>`;
  return s + `<g filter="url(#glow)">${d}</g></g>`;
}
function gauge(x, y, r, k) {   // k 0 SLOW .. 1 FAST
  const P = p => [x + r * Math.cos(Math.PI * (1 - p)), y - r * Math.sin(Math.PI * (1 - p))], band = (a, b, c) => `<path d="M${P(a).map(f1).join(',')}A${r},${r} 0 0 1 ${P(b).map(f1).join(',')}" fill="none" stroke="${c}" stroke-width="20"/>`;
  const ang = Math.PI * (1 - k), tx = x + (r - 10) * Math.cos(ang), ty = y - (r - 10) * Math.sin(ang);
  return band(0, .34, PAL.violet) + band(.34, .67, PAL.sky) + band(.67, 1, PAL.mint) + `<path d="M${f1(x)},${f1(y)}L${f1(tx)},${f1(ty)}" stroke="${CREAM}" stroke-width="8" stroke-linecap="round"/><circle cx="${f1(x)}" cy="${f1(y)}" r="13" fill="${CREAM}" stroke="${INK}" stroke-width="4"/>`;
}
function stopwatch(x, y, r, k) {
  const a = -Math.PI / 2 + k * Math.PI * 2;
  return `<rect x="${f1(x - 8)}" y="${f1(y - r - 14)}" width="16" height="10" rx="3" fill="${CREAM}"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" fill="${rgba(INK, .85)}" stroke="${CREAM}" stroke-width="5"/><path d="M${f1(x)},${f1(y)}L${f1(x + (r - 8) * Math.cos(a))},${f1(y + (r - 8) * Math.sin(a))}" stroke="${PAL.saffron}" stroke-width="6" stroke-linecap="round"/><circle cx="${f1(x)}" cy="${f1(y)}" r="5" fill="${CREAM}"/>`;
}
function pillow(x, y, w, h, k = 1) {
  if (k <= .01) return ''; const hw = w / 2 * k, hh = h / 2 * k, p = 12;
  return `<g><path d="M${f1(x - hw + p)},${f1(y - hh)}Q${f1(x)},${f1(y - hh + p)} ${f1(x + hw - p)},${f1(y - hh)}Q${f1(x + hw)},${f1(y)} ${f1(x + hw - p)},${f1(y + hh)}Q${f1(x)},${f1(y + hh - p)} ${f1(x - hw + p)},${f1(y + hh)}Q${f1(x - hw)},${f1(y)} ${f1(x - hw + p)},${f1(y - hh)}Z" fill="${PAL.saffron}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`
    + `<path d="M${f1(x - hw * .55)},${f1(y)}L${f1(x + hw * .55)},${f1(y)}M${f1(x)},${f1(y - hh * .5)}L${f1(x)},${f1(y + hh * .5)}" stroke="${rgba(INK, .45)}" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round"/></g>`;
}
// a track of N cells (video timeline). cell i state by caller: 'played' | 'saved' | 'empty'. returns {svg, cx(i)}
function track(x0, y, cw, ch, N, state, o = {}) {
  let s = ''; for (let i = 0; i < N; i++) { const st = state(i), cx = x0 + (i + .5) * cw;
    if (st === 'saved') s += pic(cx, y, cw - 8, ch, o.lvl?.(i) ?? 1, { shadow: false, ring: o.ring ?? PAL.mint });
    else if (st === 'played') s += pic(cx, y, cw - 8, ch, 1, { shadow: false, dim: .62 });
    else s += emptySlot(cx, y, cw - 8, ch, CREAM, .45); }
  return s;
}
const playhead = (x, y, h, col = CREAM) => `<path d="M${f1(x)},${f1(y - h / 2 - 6)}L${f1(x)},${f1(y + h / 2 + 6)}" stroke="${col}" stroke-width="6" stroke-linecap="round"/><path d="M${f1(x - 15)},${f1(y - h / 2 - 22)}L${f1(x + 15)},${f1(y - h / 2 - 22)}L${f1(x)},${f1(y - h / 2 - 4)}Z" fill="${col}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
const KEYS = [{ t: 0, pts: [[0, 0, 0, 3]], zoom: 1 }];   // the scene is drawn in screen space; the camera key only fixes the view box
const SH = [{ x: 100, y: 330 }, { x: 860, y: 330 }];     // server, TV centres for the stage cards
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 1  PIECES: one film strip is cut into pieces, the pieces tumble into a pile and line up as numbered pieces
function card1() {
  const w = win('PIECES'), at = w.at, end = w.end, tOne = W(2, 'one'), tPile = W(2, 'pile'), tLit = W(2, 'little'), tPcs = W(2, 'pieces'), tP3 = W(3, 'pieces'), tMv = W(3, 'movie');
  const N = 6, tw = 142, th = 106, PILE = [[-82, -24, -9], [40, -52, 6], [-26, 20, -3], [88, 14, 11], [-104, 46, 8], [14, -6, -14]];
  return { tag: 'PIECES', at, end, seed: 51, keys: KEYS, stills: [tOne + .3, tPile + .15, tLit + .35, tPcs + .5, tP3 + .3, tMv + .3], draw(sc, t) {
    const k1 = io(t, tPile - .1, .5), k2 = io(t, tP3 - .15, .6), kin = pin(t, at + .05, .5);
    if (k1 < .5) { const a = (1 - k1 * 2) * kin; let s = `<g opacity="${a.toFixed(2)}"><rect x="48" y="${250 - 78}" width="876" height="156" rx="10" fill="${INK}" stroke="${rgba(CREAM, .5)}" stroke-width="3"/>`;
      for (let i = 0; i < 22; i++) { const hx = 66 + i * 40; s += `<rect x="${hx}" y="${250 - 71}" width="16" height="11" rx="3" fill="${rgba(CREAM, .7)}"/><rect x="${hx}" y="${250 + 60}" width="16" height="11" rx="3" fill="${rgba(CREAM, .7)}"/>`; } A(sc, s + '</g>'); }
    const cutA = pin(t, tPile - .3, .15) * (1 - cl(k1 * 3));
    if (cutA > .02) { let s = ''; for (let i = 1; i < N; i++) s += `<path d="M${f1(486 + (i - 3) * tw)},${250 - 92}L${f1(486 + (i - 3) * tw)},${250 + 92}" stroke="${rgba(PAL.coral, cutA)}" stroke-width="6" stroke-dasharray="12 9" stroke-linecap="round"/>`; A(sc, s); }
    for (let i = 0; i < N; i++) {
      const rib = [486 + (i - 2.5) * tw, 250], pile = [486 + PILE[i][0], 290 + PILE[i][1]], grid = [281 + (i % 3) * 205, i < 3 ? 205 : 355];
      const px = lerp(lerp(rib[0], pile[0], k1), grid[0], k2), py = lerp(lerp(rib[1], pile[1], k1), grid[1], k2), rot = lerp(PILE[i][2], 0, k2) * k1, wv = lerp(tw - lerp(2, 0, k1) * 4, 190, k2), hv = lerp(th, 126, k2);
      A(sc, pic(px, py, wv, hv, 2, { alpha: kin, rot, shadow: k1 > .1 }));
      A(sc, badge(px - wv / 2 + 4, py - hv / 2 + 4, i + 1, PAL.saffron, k2));
    }
    if (t > tOne) chip(sc, 486, 400, 'ONE MOVIE', PAL.sky, pin(t, tOne, .3) * (1 - io(t, tPile - .1, .3)));
    if (t > tLit) chip(sc, 486, 500, 'LITTLE PIECES', PAL.saffron, pin(t, tLit, .3) * (1 - io(t, tP3 + .1, .35)));
    if (t > tP3 + .25) chip(sc, 486, 500, 'PIECES OF A MOVIE', PAL.mint, pin(t, tP3 + .25, .3));
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 2  QUALITIES: every piece is stored in three qualities; the blurry row is small, the sharp row is big
function card2() {
  const w = win('QUALITIES'), at = w.at, end = w.end, tFew = W(4, 'few'), tSec = W(4, 'seconds'), tAnd = W(4, 'and'), tSto = W(4, 'stored'), tQua = W(4, 'qualities'), tSm = W(4, 'small'), tBg = W(4, 'big'), tSh = W(4, 'sharp');
  const CX = [350, 520, 690, 860], CY = [170, 295, 420], TW = 150, TH = 100, BAR = [210, 120, 48];
  return { tag: 'QUALITIES', at, end, seed: 52, keys: KEYS, stills: [tFew + .3, tSec + .35, tSto + .45, tQua + .3, tSm + .5, tBg + .45, tSh + .5], draw(sc, t) {
    const hiB = t >= tSm - .05 && t < tBg - .05 ? 1 : 0, hiS = t >= tBg - .05 ? 1 : 0;
    for (let i = 0; i < 4; i++) {
      const k0 = pin(t, at + .05 + i * .12, .4), drop = io(t, tSto + i * .12, .55), ring0 = hiS ? PAL.saffron : null;
      A(sc, pic(CX[i], CY[0], TW, TH, 2, { alpha: k0, ring: ring0 }));
      A(sc, badge(CX[i], 92, i + 1, PAL.saffron, k0));
      if (t > tSto) {
        A(sc, pic(CX[i], lerp(CY[0], CY[1], drop), TW, TH, drop > .45 ? 1 : 2, { alpha: drop }));
        A(sc, pic(CX[i], lerp(CY[0], CY[2], drop), TW, TH, drop > .6 ? 0 : 2, { alpha: drop, ring: hiB ? PAL.saffron : null }));
      }
    }
    if (t > tFew - .1 && t < tAnd) { const a = pin(t, tFew - .1, .3) * (1 - io(t, tAnd - .15, .3)); A(sc, `<g opacity="${a.toFixed(2)}"><path d="M${CX[0] - TW / 2},238L${CX[0] - TW / 2},250L${CX[0] + TW / 2},250L${CX[0] + TW / 2},238" fill="none" stroke="${PAL.sky}" stroke-width="6" stroke-linejoin="round"/></g>`); chip(sc, CX[0] + 60, 292, 'A FEW SECONDS', PAL.sky, a); }
    if (t > tQua - .2) { chip(sc, 140, CY[1] - 38, 'QUALITIES', PAL.violet, pin(t, tQua - .2, .3)); }
    if (t > tQua) for (let r = 0; r < 3; r++) { const a = pin(t, tQua + .15 + r * .12, .3), bw = BAR[r] * a, col = [PAL.coral, PAL.saffron, PAL.mint][r]; A(sc, `<g opacity="${a.toFixed(2)}"><rect x="34" y="${CY[r] + 16}" width="${f1(BAR[0] + 8)}" height="22" rx="8" fill="${rgba(INK, .6)}" stroke="${rgba(CREAM, .5)}" stroke-width="2.5"/><rect x="38" y="${CY[r] + 20}" width="${f1(bw)}" height="14" rx="5" fill="${col}"/></g>`); }
    if (t > tSm) chip(sc, 112, CY[2] - 36, 'SMALL', PAL.mint, pin(t, tSm, .3));
    if (t > tBg) chip(sc, 90, CY[0] - 36, 'BIG', PAL.coral, pin(t, tBg, .3));
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// the stage shared by cards 3 and 4: server -> pipe -> TV
const PX1 = 176, PX2 = 764, PY = 345;
function stage(sc, t, o) {
  A(sc, server(SH[0].x, SH[0].y, o.a ?? 1)); A(sc, pipe(PX1, PX2, PY, o.pipeH ?? 38, t, o.flow ?? 140, PAL.sky, o.a ?? 1)); A(sc, tv(SH[1].x, SH[1].y, 180, 124, o.a ?? 1));
  A(sc, pic(SH[1].x, SH[1].y, 180, 124, o.tvLvl ?? 2, { shadow: false, alpha: o.a ?? 1 }));
  chip(sc, SH[0].x, 440, 'SERVER', PAL.teal, o.a ?? 1, { textColor: CREAM }); chip(sc, SH[1].x, 440, 'PLAYER', PAL.violet, o.a ?? 1);
}
// CARD 3  THE PICK: the player times the last piece to arrive, a gauge reads the speed, the rack picks the quality
function card3() {
  const w = win('THE PICK'), at = w.at, end = w.end, tDec = W(5, 'decides'), tPlr = W(6, 'player'), tBef = W(6, 'before'), tChk = W(6, 'checks'), tFast = W(6, 'fast'), tLast = W(6, 'last'), tArr = W(6, 'arrived');
  const T0 = tChk - .1, T1 = tArr + .1, RK = [[690, 160, 84, 58], [780, 160, 84, 58], [870, 160, 84, 58]];
  return { tag: 'THE PICK', at, end, seed: 53, keys: KEYS, stills: [tDec + .3, tPlr + .35, tBef + .45, tChk + .35, tFast + .35, tLast + .35, tArr + .2], draw(sc, t) {
    const kin = pin(t, at + .05, .5), kt = cl((t - T0) / (T1 - T0)), arr = t > T1 - .05;
    stage(sc, t, { a: kin, tvLvl: 2 });
    A(sc, `<g opacity="${kin.toFixed(2)}">${gauge(486, 225, 95, t < T0 ? .5 : lerp(.12, .88, ease.p2io(kt)))}</g>`);
    chip(sc, 486, 82, 'SPEED', PAL.sky, pin(t, tChk - .2, .3)); chip(sc, 396, 268, 'SLOW', PAL.violet, kin); chip(sc, 576, 268, 'FAST', PAL.mint, kin);
    if (t > tDec - .1 && t < tBef) A(sc, text(SH[1].x, 255, '?', 96, PAL.saffron, { op: pin(t, tDec - .1, .3) * (1 - pin(t, tBef - .3, .3)) * (.8 + .2 * Math.sin(t * 9)) }));
    if (t > tPlr) A(sc, `<ellipse cx="${SH[1].x}" cy="${SH[1].y}" rx="${f1(112 + 10 * Math.sin((t - tPlr) * 8))}" ry="86" fill="none" stroke="${rgba(PAL.saffron, .9 * (1 - io(t, tBef + .4, .4)))}" stroke-width="5"/>`);
    if (t > tBef) { const a = pin(t, tBef, .35); chip(sc, 780, 96, 'NEXT PIECE', PAL.saffron, a);
      RK.forEach(([rx, ry, rw, rh], i) => { const sel = arr && i === 2; A(sc, pic(rx, ry, rw, rh, i, { alpha: a * (arr && !sel ? .45 : 1), ring: sel ? PAL.mint : null })); }); if (arr) A(sc, tickS(870, 214, pin(t, T1, .25), PAL.mint, 28)); }
    if (t > T0 && t < T1 + .02) { const x = lerp(PX1 + 30, PX2 - 30, kt); A(sc, pic(x, PY, 96, 66, 1, { shadow: false })); A(sc, `<g opacity="${pin(t, T0, .2).toFixed(2)}">${stopwatch(486, 425, 32, kt)}</g>`); }
    if (arr) { chip(sc, 486, 500, 'FAST: SHARP NEXT', PAL.mint, pin(t, T1, .3)); }
  } };
}
// CARD 4  SLOW WIFI: wifi loses bars, the pipe thins, the needle drops; the player asks for the SMALL piece, which slips through and lands on time
function card4() {
  const w = win('SLOW WIFI'), at = w.at, end = w.end, tWf = W(7, 'wifi'), tSl = W(7, 'slow'), tAsk = W(8, 'asks'), tSm = W(8, 'small'), tLs = W(8, 'less'), tCar = W(8, 'carry'), tSo = W(8, 'so'), tArr = W(8, 'arrives'), tTi = W(8, 'time');
  const SHELF = [[100, 108, 110, 76, 2], [100, 180, 78, 54, 1], [100, 232, 58, 40, 0]];
  const L0 = tLs + .05, L1 = tArr + .1;
  return { tag: 'SLOW WIFI', at, end, seed: 54, keys: KEYS, stills: [tWf + .3, tSl + .35, tAsk + .35, tSm + .3, tLs + .45, tCar + .3, tArr + .15, tTi + .3], draw(sc, t) {
    const ks = io(t, tSl - .1, .7), bars = lerp(3, 1, ks), kin = pin(t, at + .05, .5), kl = cl((t - L0) / (L1 - L0)), got = t > L1;
    stage(sc, t, { a: kin, pipeH: lerp(38, 16, ks), flow: lerp(140, 45, ks), tvLvl: got ? 0 : 2 });
    A(sc, `<g opacity="${kin.toFixed(2)}">${gauge(330, 205, 82, lerp(.88, .1, ks))}</g>`); chip(sc, 255, 250, 'SLOW', PAL.violet, kin); chip(sc, 405, 250, 'FAST', PAL.mint, kin);
    A(sc, `<g opacity="${kin.toFixed(2)}">${wifiSym(640, 235, 130, bars)}</g>`); if (t > tSl) chip(sc, 640, 96, 'SLOW WIFI', PAL.violet, pin(t, tSl, .3));
    if (t > tAsk - .1) { const ka = pin(t, tAsk - .1, .5); A(sc, arrowS(750, 300, 190, 300, PAL.saffron, ka, 7, true)); chip(sc, 470, 300, 'ASK: SMALL', PAL.saffron, ka * (1 - io(t, tLs, .3))); }
    SHELF.forEach(([sx, sy, sw, sh, lv], i) => { const picked = i === 2 && t >= tSm - .05, a = kin * (picked ? 1 : t >= tSm - .05 ? .4 : 1);
      if (i === 2 && t > L0) return; A(sc, pic(sx, sy, sw, sh, lv, { alpha: a, ring: picked ? PAL.saffron : null })); if (i === 0 && t >= tSm - .05) A(sc, crossS(sx, sy, pin(t, tSm, .3), PAL.ember, 30)); });
    if (t > L0 && !got) { const a = Math.min(1, kl / .15), x = kl < .15 ? lerp(100, 196, a) : lerp(196, PX2 - 30, ease.p2io((kl - .15) / .85)), y = kl < .15 ? lerp(232, PY, a) : PY; A(sc, pic(x, y, 58, 40, 0, { shadow: false })); }
    if (t > tCar) chip(sc, 486, 500, 'LESS TO CARRY', PAL.sky, pin(t, tCar, .3) * (1 - pin(t, tArr + .3, .3) ));
    if (got) { A(sc, tickS(SH[1].x, 262, pin(t, L1, .25), PAL.mint, 30)); chip(sc, 486, 500, 'ARRIVES ON TIME', PAL.mint, pin(t, L1 + .1, .3)); }
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 5  THE RACE: waiting for the sharp piece freezes the picture (spinner); taking the blurry one keeps playing
function card5() {
  const w = win('THE RACE'), at = w.at, end = w.end, tWt = W(9, 'wait'), tShp = W(9, 'sharp'), tFr = W(10, 'freezes'), tBl = W(10, 'blur'), tFo = W(10, 'forgive'), tSp = W(10, 'spinning'), tNv = W(10, 'never');
  const X0 = 275, CW = 132, Y1 = 225, Y2 = 450, TX = 130, SLOT = X0 + 2.5 * CW;
  const lane = (sc, y, st) => { for (let i = 0; i < 5; i++) { const cx = X0 + (i + .5) * CW;
      if (st.cell && i > 2) A(sc, st.cell(i, cx)); else if (i < 2) A(sc, pic(cx, y, CW - 8, 76, 2, { shadow: false, dim: i === 0 ? .55 : 0 }));
      else if (i === 2) { if (st.slot) A(sc, st.slot(cx)); } else A(sc, emptySlot(cx, y, CW - 8, 76, CREAM, .4)); } };
  return { tag: 'THE RACE', at, end, seed: 55, keys: KEYS, stills: [tWt + .35, tShp + .35, tFr + .1, tFr + .55, tBl + .45, tFo + .45, tSp + .4, tNv + .25], draw(sc, t) {
    const kin = pin(t, at + .05, .5), k2 = pin(t, tBl - .2, .4), frozen = t > tFr, big = io(t, tSp, .6);
    // lane 1: wait for the sharp piece
    chip(sc, 28, 112, 'WAIT FOR SHARP', PAL.coral, kin, { align: 'l' });
    const ph1 = lerp(340, SLOT - CW / 2 + 6, io(t, tWt - .1, tFr - tWt + .1)), fill1 = .12 + .5 * cl((t - tWt) / 6.5);
    lane(sc, Y1, { slot: cx => emptySlot(cx, Y1, CW - 8, 76, PAL.coral, .8) + pic(cx, Y1, CW - 8, 76, 2, { shadow: false, fill: fill1 }) });
    A(sc, playhead(frozen ? ph1 + Math.sin(t * 40) * 1.5 : ph1, Y1, 76));
    A(sc, tv(TX, Y1, 190, 130, kin)); A(sc, pic(TX, Y1, 190, 130, 2, { shadow: false, dim: frozen ? .6 : 0 }));
    if (frozen) { const sk = pin(t, tFr, .25) * (1 + .5 * big); A(sc, spinner(TX, Y1, 40 * (1 + .45 * big), t, PAL.coral, sk)); if (t > tNv - .2) A(sc, crossS(TX, Y1, pin(t, tSp + .3, .3), PAL.ember, 56)); chip(sc, 790, Y1, 'FROZEN', PAL.ember, pin(t, tFr + .2, .3)); }
    // lane 2: take the blur
    if (k2 > .01) {
      chip(sc, 275, 345, 'TAKE THE BLUR', PAL.mint, k2 * (1 - .5 * big), { align: 'l' });
      const kf = io(t, tBl, .55), px2 = lerp(340, 880, cl((t - (tBl + .1)) / 3.2)), inCell3 = px2 > SLOT - CW / 2 && px2 < SLOT + CW / 2;
      lane(sc, Y2, { slot: cx => emptySlot(cx, Y2, CW - 8, 76, PAL.mint, .8 * (1 - kf)) + pic(cx, Y2, CW - 8, 76, 0, { shadow: false, alpha: kf }), cell: (i, cx) => { const a = pin(t, tBl + .9 + (i - 3) * .35, .3); return a < .05 ? emptySlot(cx, Y2, CW - 8, 76, CREAM, .4) : pic(cx, Y2, CW - 8, 76, 0, { shadow: false, alpha: a }); } });
      A(sc, playhead(px2, Y2, 76)); A(sc, tv(TX, Y2, 190, 130, k2)); A(sc, pic(TX, Y2, 190, 130, t > tBl + .55 ? 0 : 2, { shadow: false }));
      if (t > tFo - .2) chip(sc, 700, 515, 'KEEPS PLAYING', PAL.mint, pin(t, tFo - .2, .3));
      if (big > .01) A(sc, `<rect x="20" y="300" width="932" height="240" fill="${rgba(PAL.bg0, .55 * big)}"/>`); }
  } };
}
// ---------------------------------------------------------------------------------------------------------------------------------
// CARD 6  CUSHION: the player downloads ahead of where you watch; the saved stretch is the cushion
function card6() {
  const w = win('CUSHION'), at = w.at, end = w.end, tCu = W(12, 'cushion'), tSe = W(12, 'seconds'), tDo = W(12, 'downloaded'), tAh = W(12, 'ahead'), tWa = W(12, 'watching');
  const N = 10, X0 = 66, CW = 84, Y = 300, CH = 76;
  return { tag: 'CUSHION', at, end, seed: 56, keys: KEYS, stills: [tCu + .35, tSe + .35, tDo + .4, tAh + .3, tWa + .1, tWa + .6], draw(sc, t) {
    const kin = pin(t, at + .05, .5), p = 1.1 + .22 * (t - at), front = 3.6 + 4.6 * io(t, tDo - .1, 1.6) + .0, f = Math.floor(front + 1e-6);
    const st = i => i < Math.floor(p) ? 'played' : i <= f ? 'saved' : 'empty';
    A(sc, track(X0, Y, CW, CH, N, st, { lvl: i => (i % 3 === 1 ? 0 : i % 3 === 2 ? 1 : 2) })); A(sc, playhead(X0 + p * CW, Y, CH));
    const xa = X0 + (Math.floor(p) + 1) * CW + 2, xb = X0 + (f + 1) * CW - 2;
    if (t > tCu - .05) { const a = pin(t, tCu - .05, .35); A(sc, `<g opacity="${a.toFixed(2)}"><path d="M${f1(xa)},${Y - CH / 2 - 26}L${f1(xa)},${Y - CH / 2 - 42}L${f1(xb)},${Y - CH / 2 - 42}L${f1(xb)},${Y - CH / 2 - 26}" fill="none" stroke="${PAL.saffron}" stroke-width="6" stroke-linejoin="round"/></g>`);
      A(sc, pillow((xa + xb) / 2, 178, 80 + (xb - xa) * .5, 62, a)); chip(sc, 486, 98, 'CUSHION', PAL.saffron, a); }
    if (t > tSe) chip(sc, 486, 408, 'SECONDS AHEAD', PAL.mint, pin(t, tSe, .3));
    if (t > tDo) { const a = pin(t, tDo, .3); A(sc, arrowS(X0 + (f + 1) * CW + 10, Y + CH / 2 + 38, X0 + (f + 1) * CW + 70, Y + CH / 2 + 38, PAL.sky, a, 8)); chip(sc, 740, 490, 'DOWNLOADING', PAL.sky, a); }
    if (t > tWa - .05) chip(sc, 210, 490, 'WATCHING', PAL.cream, pin(t, tWa - .05, .3), { textColor: CREAM });
  } };
}
// CARD 7  FAT OR THIN: a fat cushion risks the big sharp piece, a thin one plays safe with the small blurry piece
function card7() {
  const w = win('FAT OR THIN'), at = w.at, end = w.end, tFat = W(14, 'fat'), tRisk = W(14, 'risks'), tThin = W(14, 'thin'), tSafe = W(14, 'safe'), tBig = W(14, 'big'), tPlays = W(14, 'plays');
  const N = 10, X0 = 30, CW = 44, Y1 = 180, Y2 = 415, TXC = 770;
  return { tag: 'FAT OR THIN', at, end, seed: 57, keys: KEYS, stills: [tFat + .3, tRisk + .35, tBig + .4, tThin + .3, tPlays + .25, tSafe + .3], draw(sc, t) {
    const kin = pin(t, at + .05, .5), k1 = pin(t, tRisk - .1, .45), k2 = pin(t, tThin - .15, .4), k2b = pin(t, tPlays - .1, .45);
    chip(sc, 28, 98, 'FAT CUSHION', PAL.mint, pin(t, tFat - .1, .3), { align: 'l' });
    A(sc, track(X0, Y1, CW, 64, N, i => i < 1 ? 'played' : i <= 8 ? 'saved' : 'empty', { lvl: () => 0 })); A(sc, playhead(X0 + 1.4 * CW, Y1, 64));
    A(sc, pillow(X0 + 5 * CW, Y1 + 76, 220, 46, pin(t, tFat + .2, .4)));
    A(sc, arrowS(500, Y1, 600, Y1, PAL.saffron, k1, 9)); A(sc, pic(TXC, Y1, 240, 148, 2, { alpha: k1 })); chip(sc, TXC, 292, 'RISK IT', PAL.saffron, k1);
    if (k2 > .01) { chip(sc, 28, 333, 'THIN CUSHION', PAL.violet, k2, { align: 'l' });
      A(sc, track(X0, Y2, CW, 64, N, i => i < 6 ? 'played' : i <= 7 ? 'saved' : 'empty', { lvl: () => 0 })); A(sc, playhead(X0 + 6.5 * CW, Y2, 64));
      A(sc, pillow(X0 + 7 * CW, Y2 + 76, 70, 36, k2));
      A(sc, arrowS(500, Y2, 600, Y2, PAL.saffron, k2b, 9)); A(sc, pic(TXC, Y2, 240, 148, 0, { alpha: k2b })); chip(sc, TXC, 520, 'PLAY SAFE', PAL.mint, k2b); }
   
  } };
}
// CARD 8  BACK TO SHARP: the wifi speed dips and recovers; the quality of the pieces follows it, piece by piece
function card8() {
  const w = win('BACK TO SHARP'), at = w.at, end = w.end, tBk = W(15, 'back'), tSh = W(15, 'sharp'), tPc = W(16, 'piece'), tPc2 = W(16, 'piece', 1), tNb = W(16, 'nobody');
  const LV = [2, 0, 0, 1, 2, 2, 2], TT = [at + .15, at + .35, at + .55, tBk - .05, tSh, tPc, tPc2], CX = i => 68 + 129 * i, X0 = 50, X1 = 922, YB = 250, AMP = 130;
  const spd = u => cl(.86 - .72 * Math.exp(-Math.pow((u - .30) / .13, 2)) + (u > .5 ? 0 : 0));
  const upos = t => { for (let i = 0; i < 7; i++) if (t < TT[i]) return i === 0 ? 0 : lerp((i - .5) / 7, (i + .5) / 7, cl((t - TT[i - 1]) / (TT[i] - TT[i - 1]))); return Math.min(1, (6.5 + cl((t - TT[6]) / 1.2) * .5) / 7); };
  return { tag: 'BACK TO SHARP', at, end, seed: 58, keys: KEYS, stills: [at + .9, tBk + .25, tSh + .15, tPc + .3, tPc2 + .35, tNb + .4], draw(sc, t) {
    const kin = pin(t, at + .05, .5), u = upos(t), px = X0 + (X1 - X0) * u; let line = '', area = `M${X0},${YB}`;
    for (let i = 0; i <= 80; i++) { const uu = i / 80; if (uu > u) break; line += `${i ? 'L' : 'M'}${f1(X0 + (X1 - X0) * uu)},${f1(YB - AMP * spd(uu))}`; area += `L${f1(X0 + (X1 - X0) * uu)},${f1(YB - AMP * spd(uu))}`; }
    A(sc, `<g opacity="${kin.toFixed(2)}"><path d="M${X0},${YB}L${X1},${YB}" stroke="${rgba(CREAM, .4)}" stroke-width="4"/><path d="M${X0},${YB - AMP - 10}L${X0},${YB}" stroke="${rgba(CREAM, .4)}" stroke-width="4"/>`
      + `<path d="${area}L${f1(px)},${YB}Z" fill="${rgba(PAL.sky, .22)}"/><path d="${line}" fill="none" stroke="${PAL.sky}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${f1(px)}" cy="${f1(YB - AMP * spd(u))}" r="11" fill="${CREAM}" stroke="${PAL.sky}" stroke-width="5"/></g>`);
    chip(sc, 40, 98, 'WIFI SPEED', PAL.sky, kin, { align: 'l' });
    if (t > tBk) chip(sc, 640, 92, 'WIFI BACK', PAL.mint, pin(t, tBk, .3) * (1 - io(t, tPc, .3)));
    for (let i = 0; i < 7; i++) { const a = pin(t, TT[i], .3), newest = t >= TT[i] && (i === 6 || t < TT[i + 1]); A(sc, pic(CX(i), 400, 118, 82, LV[i], { alpha: a, ring: newest && t > tSh - .1 ? PAL.mint : null })); }
    if (t > tSh) chip(sc, 486, 500, t > tPc ? 'PIECE BY PIECE' : 'SHARP AGAIN', t > tPc ? PAL.saffron : PAL.mint, pin(t, t > tPc ? tPc : tSh, .3));
  } };
}
// the layout switch re-frames the scene, so a card enters/leaves ON a shot cut when one is close
const cuts = (E.shots || []).map(x => x.t0).filter(x => x > 0);
const snap = (t, lo, hi) => { const c = cuts.filter(x => x >= t - lo && x <= t + hi).sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0]; return c ?? t; };
export const CARDS = [card1(), card2(), card3(), card4(), card5(), card6(), card7(), card8()].map(c => ({ ...c, at: snap(c.at, .35, .05), end: snap(c.end, .4, .1) })).map(c => ({ ...c, stills: c.stills.filter(x => x > c.at + .3 && x < c.end - .3) }));
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
