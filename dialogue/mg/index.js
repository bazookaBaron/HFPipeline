// DIALOGUE MG: runtime-first motion-graphics library. HTML/SVG over the scene, every frame a pure function of t.
// createMG({root, ratio:'9x16'|'16x9', palette, fonts, base, geo}) -> {beat, beats, build, seek, activeLayout, layoutInfo, captions, lint, destroy}
import { clamp01, prog, ease, lerp, drift, hexA, mixHex, fmtNum, stagger, pair } from './motion.js';
import { makeMap, loadGeo, PLACES } from './geo.js';
import { createIsoWorld } from './iso.js';
export { ease, prog, clamp01, lerp, stagger, drift, pair, createIsoWorld };
const NS = 'http://www.w3.org/2000/svg';
export const PALETTE = { ink: '#121820', paper: '#EFE6D4', muted: '#8E9AA6', accent: '#F2A03D', accent2: '#86C6D8', sky: '#0E1621', canvas: '#1A2631', dot: '#587187' };
const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 .94  0 0 0 0 .9  0 0 0 0 .83  0 0 0 .9 0'/></filter><rect width='220' height='220' filter='url(%23n)'/></svg>")`;
const svgEl = (tag, at = {}) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
const div = (cls, st) => { const e = document.createElement('div'); if (cls) e.className = cls; if (st) Object.assign(e.style, st); return e; };
const nwords = s => String(s).split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;

// frame layouts (PLAN 10e / STYLE-GUIDE 9). card = MG panel rect, cap = caption centre y + size + max width
export function layoutRects(W, H, name) {
  const P = H > W;
  const T = P ? {
    stack: { card: { x: 54, y: Math.round(H * .08), w: W - 108, h: Math.round(H * .36) }, cap: { y: H * .47, size: 60, w: W - 140 } },
    full: { card: null, cap: { y: H * .26, size: 64, w: W - 140 } },
    takeover: { card: { x: 54, y: Math.round(H * .08), w: W - 108, h: Math.round(H * .62) }, cap: { y: H * .75, size: 60, w: W - 140 } },
    // float (2026-11-11, iso cards): shorter card over a full-frame scene whose actors are framed into the lower rect y 840..H (engine epRect 'float')
    float: { card: { x: 54, y: 154, w: W - 108, h: 560 }, cap: { y: 786, size: 56, w: W - 140 } },
  } : {
    split: { card: { x: Math.round(W * .22) + 52, y: Math.round(H * .085), w: W - 2 * Math.round(W * .22) - 104, h: Math.round(H * .64) }, cap: { y: H * .84, size: 58, w: W - 2 * Math.round(W * .22) - 120 } },
    full: { card: null, cap: { y: H * .8, size: 60, w: 1500 } },
    takeover: { card: { x: 96, y: 60, w: W - 192, h: Math.round(H * .74) }, cap: { y: H * .9, size: 60, w: 1500 } },
  };
  T.none = T.full; return T[name] || T.full;
}

export function createMG({ root, ratio = '9x16', palette = {}, fonts, base, geo } = {}) {
  const [W, H] = Array.isArray(ratio) ? ratio : ratio === '16x9' ? [1920, 1080] : [1080, 1920];
  const portrait = H > W; const C = { ...PALETTE, ...palette }; const baseURL = base || new URL('.', import.meta.url).href;
  const autoLayout = portrait ? 'stack' : 'split';
  const host = div('mg-root', { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px', pointerEvents: 'none', overflow: 'hidden' }); root.appendChild(host);
  const css = document.createElement('style');
  css.textContent = `
  ${fonts === false ? '' : `@font-face{font-family:'Geist';font-weight:100 900;src:url(${new URL('fonts/Geist-400.woff2', baseURL)}) format('woff2')}@font-face{font-family:'Geist Mono';font-weight:100 900;src:url(${new URL('fonts/GeistMono-500.woff2', baseURL)}) format('woff2')}`}
  .mg-root *{box-sizing:border-box}
  .mg-card{position:absolute;border:1px solid ${hexA(C.paper, .5)};border-radius:12px;overflow:hidden;opacity:0;display:none;will-change:transform;box-shadow:0 34px 80px ${hexA(C.ink, .55)},0 6px 18px ${hexA(C.ink, .5)},inset 0 1px 0 ${hexA(C.paper, .08)}}
  .mg-card>*{position:absolute;inset:0}.mg-grain{opacity:.08;background-image:${GRAIN}}.mg-vig{background:radial-gradient(ellipse at center,${hexA(C.ink, 0)} 55%,${hexA(C.ink, .3)} 100%)}
  .mg-rule{background-image:linear-gradient(${hexA(C.paper, .05)} 1px,transparent 1px),linear-gradient(90deg,${hexA(C.paper, .05)} 1px,transparent 1px),linear-gradient(${hexA(C.paper, .035)} 1px,transparent 1px),linear-gradient(90deg,${hexA(C.paper, .035)} 1px,transparent 1px);background-size:180px 180px,180px 180px,36px 36px,36px 36px}
  .mg-meta{position:absolute;inset:auto;font:500 14px/1 'Geist Mono',monospace;letter-spacing:.08em;color:${C.muted};white-space:nowrap;will-change:opacity}.mg-meta b{color:${C.accent};font-weight:500}
  .mg-canvas{position:absolute;opacity:0;background-color:${C.canvas}}
  .mg-card .mg-lines{width:100%;height:100%;overflow:visible}
  .mg-tag{position:absolute;inset:auto;left:44px;top:30px;font:500 18px/1 'Geist',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:${C.muted}}
  .mg-t{position:absolute;display:flex;color:${C.paper};font-family:'Geist',sans-serif;will-change:opacity,transform}
  .mg-t>span.in{display:block;width:100%}
  .mg-title{font-weight:500;font-size:64px;line-height:1.08;letter-spacing:-.012em}.mg-sub{font-weight:500;font-size:40px;line-height:1.15}.mg-body{font-weight:400;font-size:28px;line-height:1.3}
  .mg-label{font-weight:400;font-size:20px;line-height:1.2;letter-spacing:.16em;text-transform:uppercase;color:${C.muted}}
  .mg-num{font-family:'Geist Mono',monospace;font-weight:500;font-variant-numeric:tabular-nums;line-height:1}.mg-num .u{font-size:.4em;color:${C.muted};margin-left:.18em}
  .mg-t b{font-weight:inherit;color:${C.accent}}
  .mg-map{position:absolute}.mg-pin{position:absolute;width:0;height:0}.mg-pin i{position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;box-sizing:border-box}
  .mg-pin .dot{background:${C.accent}}.mg-pin .ring{border:1.5px solid ${C.paper}}
  .mg-pinlabel{position:absolute;white-space:nowrap;background:${C.ink};border:1.5px solid ${C.paper};border-radius:10px;padding:9px 16px 10px;font:500 30px/1 'Geist',sans-serif;color:${C.paper};box-shadow:0 10px 24px ${hexA(C.ink, .5)}}
  .mg-pinlabel span{font:500 26px/1 'Geist Mono',monospace}
  .mg-lead{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:${C.accent}}
  .mg-photo{position:absolute;overflow:hidden}.mg-photo img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;transform-origin:50% 50%}
  .mg-cap{position:absolute;left:0;text-align:center;font:600 60px/1.12 'Geist',sans-serif;letter-spacing:-.012em;color:${C.paper};text-shadow:0 2px 14px ${hexA(C.ink, .95)},0 0 3px ${hexA(C.ink, .75)};opacity:0}`;
  document.head.appendChild(css);
  // duotone filters (ink -> accent / paper) as SVG feComponentTransfer tables, all values interpolate palette colours
  const hx = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const duoSvg = svgEl('svg', { width: 0, height: 0, style: 'position:absolute' }); const mkDuo = (id, stops) => { const f = svgEl('filter', { id: 'mgduo-' + id, 'color-interpolation-filters': 'sRGB' }); f.appendChild(svgEl('feColorMatrix', { type: 'matrix', values: '.3 .59 .11 0 0 .3 .59 .11 0 0 .3 .59 .11 0 0 0 0 0 1 0' })); const ct = svgEl('feComponentTransfer'); ['R', 'G', 'B'].forEach((ch, i) => ct.appendChild(svgEl('feFunc' + ch, { type: 'table', tableValues: stops.map(s => hx(s)[i].toFixed(3)).join(' ') }))); f.appendChild(ct); duoSvg.appendChild(f); };
  mkDuo('accent', [C.ink, mixHex(C.ink, C.accent, .55), C.accent, mixHex(C.accent, C.paper, .75)]); mkDuo('paper', [C.ink, mixHex(C.ink, C.paper, .4), C.paper]); host.appendChild(duoSvg);
  const capEl = div('mg-cap'); host.appendChild(capEl);
  // 16:9 back canvas: its own slate colour with a dot grid, framing the centre MG between the two character strips
  const canvas = div('mg-canvas', { top: '0', height: H + 'px', borderLeft: `1px solid ${hexA(C.dot, .6)}`, borderRight: `1px solid ${hexA(C.dot, .6)}`, backgroundImage: `radial-gradient(circle, ${hexA(C.dot, .62)} 1.7px, transparent 2.3px), radial-gradient(circle, ${C.dot} 3px, transparent 3.7px), radial-gradient(ellipse at center, ${hexA(C.ink, 0)} 45%, ${hexA(C.ink, .4)} 100%)`, backgroundSize: '32px 32px, 160px 160px, 100% 100%' }); if (!portrait) host.insertBefore(canvas, host.firstChild);

  const pending = [], beats = []; let reg = null, built = false, capPhrases = [];
  const resolveLayout = l => (!l || l === 'auto' ? autoLayout : l);
  const col = k => (C[k] || (/^#/.test(k) || /^rgba?\(/.test(k) ? k : C.paper));

  // ---- beat builder ---------------------------------------------------------------------
  function buildBeat(bt, waits) {
    const lay = bt.layout, LR = layoutRects(W, H, lay), CR = LR.card || { x: 54, y: Math.round(H * .08), w: W - 108, h: Math.round(H * .36) }; // card-less beats (layout 'none') still run so b.caption works
    const cw = CR.w, ch = CR.h;
    const card = div('mg-card', { left: CR.x + 'px', top: CR.y + 'px', width: cw + 'px', height: ch + 'px', background: hexA(C.ink, portrait ? .74 : .95) });
    if (portrait) card.style.backdropFilter = card.style.webkitBackdropFilter = 'blur(18px) saturate(1.08)'; // scene behind the floating card is slightly blurred
    const rule = div('mg-rule'), grain = div('mg-grain'), media = div('mg-media'), vig = div('mg-vig'), chrome = svgEl('svg', { class: 'mg-lines' }), lines = svgEl('svg', { class: 'mg-lines' }), text = div('mg-text'), content = div('mg-content');
    content.style.cssText = 'position:absolute;inset:0'; media.style.cssText = 'position:absolute;inset:0;overflow:hidden'; for (const sv of [chrome, lines]) sv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible'; text.style.cssText = 'position:absolute;inset:0';
    card.append(rule, grain, content); content.append(media, vig, chrome, lines, text);
    if (bt.tag) { const tg = div('mg-tag'); tg.textContent = bt.tag; tg.style.cssText += ';display:flex;align-items:center;gap:12px'; const sq = div('', { width: '8px', height: '8px', background: C.accent }); tg.prepend(sq); content.appendChild(tg); bt.tagEl = tg; }
    host.appendChild(card); bt.card = card; bt.content = content; bt.rule = rule;
    const items = []; let cursor = bt.noEnter ? .2 : .6; let nW = 0;
    const b = { W: cw, H: ch, C, reg, items, media, lines, text, ratio: portrait ? '9x16' : '16x9', layout: lay, box: { x: 44, y: 86, w: cw - 88, h: ch - 86 - 62 },
      take: (step = .1) => { const a = cursor; cursor += step; return a; }, at: t => { cursor = t; return b; }, wait: s => { cursor += s; return b; }, now: () => cursor,
      words: s => { nW += nwords(s); }, col, wordsCount: () => nW };
    b.iso = o => createIsoWorld(b, o);   // iso world primitive (iso.js)
    b.rect = (o = {}) => ({ x: o.x ?? o.box?.x ?? b.box.x, y: o.y ?? o.box?.y ?? b.box.y, w: o.w ?? o.box?.w ?? b.box.w, h: o.h ?? o.box?.h ?? b.box.h });
    // layout helpers: rows / cols / 12-col grid -> rects
    const split = (spec, total, gap) => { const wts = typeof spec === 'number' ? Array(spec).fill(1) : spec; const sum = wts.reduce((a, c) => a + c, 0), free = total - gap * (wts.length - 1); let p = 0; return wts.map(w => { const s = p; p += w / sum * free + gap; return [s, w / sum * free]; }); };
    b.rows = (spec, o = {}) => { const r = b.rect(o); return split(spec, r.h, o.gap ?? 16).map(([s, l]) => ({ x: r.x, y: r.y + s, w: r.w, h: l })); };
    b.cols = (spec, o = {}) => { const r = b.rect(o); return split(spec, r.w, o.gap ?? 24).map(([s, l]) => ({ x: r.x + s, y: r.y, w: l, h: r.h })); };
    b.col = (i, span = 1, o = {}) => { const r = b.rect(o), g = 24, cwid = (r.w - 11 * g) / 12; return { x: r.x + i * (cwid + g), y: r.y, w: span * cwid + (span - 1) * g, h: r.h }; };
    const T = (o, step = .1) => o.at ?? b.take(step);
    // reveal progress: p (enter 0..1), q (exit 0..1)
    const rv = (o, at, t, dur = .7, ez = ease.p3out) => ({ p: ez(prog(t, at, at + (o.dur ?? dur))), q: o.until != null ? ease.p2in(prog(t, o.until, o.until + (o.exitDur ?? .4))) : 0 });
    const applyH = (el, { p, q }, enter = 'fade-up') => { let op = 1, tf = '', clip = 'none'; if (enter === 'wipe') { clip = `inset(0 ${(1 - p) * 100}% 0 0)`; op = p > 0 ? 1 : 0; } else if (enter === 'fade') op = p; else if (enter === 'scale') { op = p; tf = `scale(${.92 + .08 * p})`; } else if (enter === 'none') op = p > 0 ? 1 : 0; else { op = p; tf = `translateY(${((1 - p) * 18).toFixed(2)}px)`; }
      op *= 1 - q; if (q) tf += ` translateY(${(-q * 10).toFixed(2)}px)`; el.style.opacity = op.toFixed(3); el.style.transform = tf || 'none'; el.style.clipPath = clip; };
    const place = (el, r) => Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    // ---- text -----------------------------------------------------------------------------
    const mkText = (kind, str, o = {}) => { const r = b.rect(o), at = T(o); const el = div('mg-t mg-' + kind); place(el, r); el.style.justifyContent = o.align === 'center' ? 'center' : o.align === 'right' ? 'flex-end' : 'flex-start'; el.style.alignItems = o.valign === 'center' ? 'center' : o.valign === 'bottom' ? 'flex-end' : 'flex-start'; el.style.textAlign = o.align || 'left';
      if (o.size) el.style.fontSize = o.size + 'px'; if (o.color) el.style.color = col(o.color); if (o.weight) el.style.fontWeight = o.weight;
      const sp = document.createElement('span'); sp.className = 'in'; if (o.hl && str.includes(o.hl)) { const [a, c] = str.split(o.hl); sp.append(a); const bb = document.createElement('b'); bb.textContent = o.hl; sp.append(bb, c); } else sp.textContent = str; el.appendChild(sp); text.appendChild(el); if (!o.meta) b.words(str); el.dataset.safe = o.meta ? '' : '1';
      const hd = { el, at }; items.push({ upd: t => applyH(el, rv(o, at, t), o.enter || 'fade-up') }); return hd; };
    b.title = (s, o) => mkText('title', s, o); b.sub = (s, o) => mkText('sub', s, o); b.body = (s, o) => mkText('body', s, o); b.label = (s, o) => mkText('label', s, o);
    b.number = (to, o = {}) => { const r = b.rect(o), at = T(o), from = o.from ?? 0, dur = o.countDur ?? 1.3, dec = o.dec ?? 0; const el = div('mg-t mg-num'); place(el, r); el.style.fontSize = (o.size ?? 120) + 'px'; el.style.alignItems = o.valign === 'center' ? 'center' : 'flex-start'; el.style.justifyContent = o.align === 'center' ? 'center' : o.align === 'right' ? 'flex-end' : 'flex-start'; if (o.color) el.style.color = col(o.color);
      const sp = document.createElement('span'); sp.style.whiteSpace = 'nowrap'; const nv = document.createElement('span'), u = document.createElement('span'); u.className = 'u'; u.textContent = o.unit || ''; sp.append(o.prefix || '', nv, u); if (o.suffix) sp.append(o.suffix); el.appendChild(sp); text.appendChild(el); b.words(String(to) + ' ' + (o.unit || '') + ' ' + (o.suffix || '')); el.dataset.safe = '1';
      items.push({ upd: t => { const c = ease.p3out(prog(t, at + .1, at + .1 + dur)); nv.textContent = fmtNum(lerp(from, to, c), dec); applyH(el, rv(o, at, t, .5), 'fade'); } }); return { el, at }; };
    // ---- line art (SVG, stroke draw-on) --------------------------------------------------------
    const mkPath = (d, o = {}) => { const at = T(o, .08), dur = o.drawDur ?? o.dur ?? 1; const p = svgEl('path', { d, fill: 'none', stroke: col(o.color || 'paper'), 'stroke-width': o.width ?? 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1 }); p.style.strokeDasharray = '1 1'; const base = o.opacity ?? 1; (o.layer || lines).appendChild(p);
      items.push({ upd: t => { const pr = ease.p2io(prog(t, at, at + dur)), q = o.until != null ? ease.p2in(prog(t, o.until, o.until + .4)) : 0; p.style.strokeDashoffset = String(1 - pr); p.style.display = pr <= 0 || q >= 1 ? 'none' : ''; p.style.opacity = base * (1 - q); } }); return { el: p, at, dur }; };
    b.path = (d, o) => mkPath(d, o); b.line = (x1, y1, x2, y2, o) => mkPath(`M${x1},${y1}L${x2},${y2}`, o);
    b.underline = (o = {}) => { const r = b.rect(o); const y = o.y ?? r.y + r.h; return mkPath(`M${r.x},${y}Q${r.x + r.w / 2},${y + 2} ${r.x + r.w},${y - 1}`, { color: 'accent', width: 3, ...o }); };
    b.bracket = (o = {}) => { const r = b.rect(o), d = o.depth ?? 22, rad = 10, side = o.side || 'right'; const s = side === 'right' ? 1 : -1, x0 = side === 'right' ? r.x : r.x + r.w, x1 = x0 + s * d; return mkPath(`M${x0},${r.y}H${x1 - s * rad}Q${x1},${r.y} ${x1},${r.y + rad}V${r.y + r.h - rad}Q${x1},${r.y + r.h} ${x1 - s * rad},${r.y + r.h}H${x0}`, o); };
    const anchor = (a, to) => { if (a.w == null) return a; const cx = a.x + a.w / 2, cy = a.y + a.h / 2, tx = to.w == null ? to.x : to.x + to.w / 2, ty = to.w == null ? to.y : to.y + to.h / 2, dx = tx - cx, dy = ty - cy, pad = 8; return Math.abs(dx) * a.h > Math.abs(dy) * a.w ? { x: cx + Math.sign(dx) * (a.w / 2 + pad), y: cy } : { x: cx, y: cy + Math.sign(dy) * (a.h / 2 + pad) }; };
    b.arrow = (from, to, o = {}) => { const A = anchor(from, to), B = anchor(to, from), at = T(o, .08), dur = o.drawDur ?? .8; const ln = mkPath(`M${A.x},${A.y}L${B.x},${B.y}`, { ...o, at, drawDur: dur }); const ang = Math.atan2(B.y - A.y, B.x - A.x), L = 18, sp = .5; // open chevron head, drawn once the line has arrived
      const hd = mkPath(`M${B.x - L * Math.cos(ang - sp)},${B.y - L * Math.sin(ang - sp)}L${B.x},${B.y}L${B.x - L * Math.cos(ang + sp)},${B.y - L * Math.sin(ang + sp)}`, { ...o, at: at + dur * .8, drawDur: .25 }); return ln; };
    b.connector = (from, to, o = {}) => { const A = anchor(from, to), B = anchor(to, from), at = T(o, .08), dur = o.drawDur ?? 1; const horiz = Math.abs(B.x - A.x) >= Math.abs(B.y - A.y); const d = o.kind === 'curve' ? (horiz ? `M${A.x},${A.y}C${(A.x + B.x) / 2},${A.y} ${(A.x + B.x) / 2},${B.y} ${B.x},${B.y}` : `M${A.x},${A.y}C${A.x},${(A.y + B.y) / 2} ${B.x},${(A.y + B.y) / 2} ${B.x},${B.y}`) : (horiz ? `M${A.x},${A.y}H${(A.x + B.x) / 2}V${B.y}H${B.x}` : `M${A.x},${A.y}V${(A.y + B.y) / 2}H${B.x}V${B.y}`);
      const h = mkPath(d, { ...o, at, drawDur: dur }); if (o.arrow !== false) { const ang = horiz ? (B.x >= (A.x + B.x) / 2 ? 0 : Math.PI) : (B.y >= A.y ? Math.PI / 2 : -Math.PI / 2), L = 18, sp = .5; mkPath(`M${B.x - L * Math.cos(ang - sp)},${B.y - L * Math.sin(ang - sp)}L${B.x},${B.y}L${B.x - L * Math.cos(ang + sp)},${B.y - L * Math.sin(ang + sp)}`, { ...o, at: at + dur * .8, drawDur: .25 }); } return h; };
    b.divider = (o = {}) => { const r = b.rect(o); return o.dir === 'v' || (o.dir == null && r.h > r.w) ? b.line(r.x, r.y, r.x, r.y + r.h, { color: 'muted', width: 1.5, ...o }) : b.line(r.x, r.y, r.x + r.w, r.y, { color: 'muted', width: 1.5, ...o }); };
    // ---- shapes --------------------------------------------------------------------------------
    const shape = (el, o, grow) => { const at = T(o, .08); lines.appendChild(el); items.push({ upd: t => { const { p, q } = rv(o, at, t, .6); el.style.opacity = (grow ? 1 : p) * (1 - q); if (grow) grow(p); else el.style.display = p <= 0 ? 'none' : ''; } }); return { el, at }; };
    b.dot = (o = {}) => shape(svgEl('circle', { cx: o.x, cy: o.y, r: o.r ?? 9, fill: col(o.color || 'accent') }), o);
    b.ring = (o = {}) => shape(svgEl('circle', { cx: o.x, cy: o.y, r: o.r ?? 28, fill: o.fill ? col(o.fill) : 'none', 'fill-opacity': o.fillOpacity ?? 1, stroke: col(o.color || 'paper'), 'stroke-width': o.width ?? 2 }), o);
    b.block = (o = {}) => { const r = b.rect(o); return shape(svgEl('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: o.radius ?? 6, fill: o.fill ? col(o.fill) : 'none', 'fill-opacity': o.fillOpacity ?? 1, stroke: o.stroke === false ? 'none' : col(o.color || 'paper'), 'stroke-width': o.width ?? 2 }), o); };
    b.bar = (o = {}) => { const r = b.rect(o), el = svgEl('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: o.radius ?? 4, fill: col(o.fill || 'accent'), 'fill-opacity': o.fillOpacity ?? 1 }); const dir = o.grow || 'x'; return shape(el, o, p => { const e = ease.p3out(p); if (dir === 'x') el.setAttribute('width', Math.max(0, r.w * e)); else { el.setAttribute('height', Math.max(0, r.h * e)); el.setAttribute('y', r.y + r.h * (1 - e)); } }); };
    b.progress = (o = {}) => { const r = b.rect(o), v = o.value ?? .5; b.block({ ...o, ...r, h: r.h, stroke: true, color: 'paper', width: 1.5, radius: r.h / 2 }); return b.bar({ ...o, x: r.x + 3, y: r.y + 3, w: (r.w - 6) * v, h: r.h - 6, radius: (r.h - 6) / 2, at: (o.at ?? cursor) + .2 }); };
    // dot-grid (the reference reel's 3/100 grid); .compareWith() adds a second grid in the same box
    b.dotGrid = (o = {}) => { const g = { o, rest: [] }; b.defer(() => { const grids = [o, ...g.rest]; const R = b.rect(o), n = grids.length, gap = n > 1 ? 56 : 0, wEach = (R.w - gap * (n - 1)) / n;
      grids.forEach((G, gi) => { const total = G.total ?? 100, cols = G.cols ?? 10, rows = Math.ceil(total / cols), top = 44, bottom = 100; const availH = R.h - top - bottom; const cell = Math.min(wEach / cols, availH / rows), r = cell * .33; const gw = cell * cols, gx = R.x + gi * (wEach + gap) + (wEach - gw) / 2, gy = R.y + top; const at = G.at ?? (gi * .35 + (o.at ?? .6)); const litCol = G.color ? col(G.color) : (n > 1 && gi === n - 1 ? C.accent : C.paper);
        if (G.label) mkText('sub', G.label, { x: R.x + gi * (wEach + gap), y: R.y, w: wEach, h: 40, align: 'center', size: 30, at });
        const dots = []; for (let i = 0; i < total; i++) { const cx = gx + (i % cols + .5) * cell, cy = gy + (Math.floor(i / cols) + .5) * cell; const base = svgEl('circle', { cx, cy, r, fill: C.muted, 'fill-opacity': .3 }), on = svgEl('circle', { cx, cy, r: r * 1.12, fill: litCol }); lines.append(base, on); dots.push({ base, on, i }); }
        const lit = G.lit ?? 0, step = lit > 12 ? .035 : .12, la = at + .7; // lit dots light up in order after the grid fades in
        items.push({ upd: t => { for (const d of dots) { const bp = ease.p3out(prog(t, at + (Math.floor(d.i / cols) * .03), at + .35 + Math.floor(d.i / cols) * .03)); d.base.style.opacity = bp; const lp = d.i < lit ? ease.p3out(prog(t, la + d.i * step, la + d.i * step + .25)) : 0; d.on.style.opacity = lp; d.on.setAttribute('r', (r * (.6 + .52 * lp)).toFixed(2)); } } });
        const numY = gy + rows * cell + 8; const nel = div('mg-t mg-num'); place(nel, { x: gx, y: numY, w: gw, h: 90 }); nel.style.fontSize = '72px'; nel.style.justifyContent = 'center'; nel.style.alignItems = 'center'; const sp = document.createElement('span'), nv = document.createElement('span'), u = document.createElement('span'); u.className = 'u'; u.textContent = '/ ' + total; sp.append(nv, u); nel.appendChild(sp); text.appendChild(nel); nel.dataset.safe = '1'; if (gi === n - 1 && n > 1) nv.style.color = C.accent; b.words(`${lit} ${total}`);
        items.push({ upd: t => { const k = lit ? Math.min(lit, Math.max(0, Math.floor((t - la) / step) + 1)) : 0; nv.textContent = k; applyH(nel, rv({}, at + .3, t, .5), 'fade'); } });
        if (gi === n - 1 && G.note) mkText('body', G.note, { x: R.x, y: R.y + R.h - 40, w: R.w, h: 36, align: 'center', size: 24, color: 'muted', at: at + 1, enter: 'fade' }); });
      if (n > 1) b.line(R.x + R.w / 2, R.y + 44, R.x + R.w / 2, R.y + R.h - 20, { color: 'muted', width: 1.5, opacity: .6, at: .5 }); });
      g.compareWith = x => { g.rest.push(x); return g; }; return g; };
    // ---- charts built from the shapes above -------------------------------------------------------
    b.bars = (o = {}) => { const R = b.rect(o), D = o.data, n = D.length, max = o.max ?? Math.max(...D.map(d => d.value)), gap = o.gap ?? 36, bw = Math.min(o.barW ?? 160, (R.w - gap * (n - 1)) / n), total = bw * n + gap * (n - 1), x0 = R.x + (R.w - total) / 2, top = 50, lab = 46, ah = R.h - top - lab, base = R.y + top + ah;
      b.line(R.x, base, R.x + R.w, base, { color: 'muted', width: 1.5, at: o.at ?? b.take(.1) });
      D.forEach((d, i) => { const at = (o.at ?? cursor) + .3 + i * .1, bh = Math.max(2, ah * d.value / max), x = x0 + i * (bw + gap); const el = svgEl('rect', { x, y: base - bh, width: bw, height: bh, rx: 4, fill: d.hl ? C.accent : C.muted, 'fill-opacity': d.hl ? 1 : .35, stroke: d.hl ? 'none' : C.paper, 'stroke-width': 1.5 }); lines.appendChild(el);
        items.push({ upd: t => { const e = ease.p3out(prog(t, at, at + .8)); el.setAttribute('y', base - bh * e); el.setAttribute('height', Math.max(0, bh * e)); el.style.opacity = e > 0 ? 1 : 0; } });
        mkText('label', d.label, { x: x - gap / 2, y: base + 12, w: bw + gap, h: 30, align: 'center', size: 20, at: at + .3, enter: 'fade' });
        const vel = div('mg-t mg-num'); place(vel, { x, y: base - bh - 46, w: bw, h: 40 }); vel.style.fontSize = '34px'; vel.style.justifyContent = 'center'; vel.style.color = d.hl ? C.accent : C.paper; const vs = document.createElement('span'); vel.appendChild(vs); text.appendChild(vel); vel.dataset.safe = '1'; b.words(String(d.value));
        items.push({ upd: t => { const e = ease.p3out(prog(t, at, at + .8)); vs.textContent = (o.fmt || (v => fmtNum(v, o.dec ?? 0)))(d.value * e); vel.style.top = (base - bh * e - 46) + 'px'; vel.style.opacity = e > .05 ? 1 : 0; } }); }); return {}; };
    b.lineChart = (o = {}) => { const R = b.rect(o), D = o.data, mn = o.min ?? Math.min(...D), mx = o.max ?? Math.max(...D), pad = 30, X = i => R.x + pad + (R.w - 2 * pad) * i / (D.length - 1), Y = v => R.y + pad + (R.h - 2 * pad - 30) * (1 - (v - mn) / (mx - mn || 1)); const at = o.at ?? b.take(.2), dur = o.drawDur ?? 1.4;
      b.line(R.x, R.y + R.h - 30, R.x + R.w, R.y + R.h - 30, { color: 'muted', width: 1.5, at });
      const d = D.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(''); const h = mkPath(d, { color: 'paper', width: 3, at: at + .3, drawDur: dur }); const hi = o.hl ?? D.length - 1; const dot = svgEl('circle', { cx: X(hi), cy: Y(D[hi]), r: 10, fill: C.accent }); lines.appendChild(dot); const dat = at + .3 + dur * (hi / (D.length - 1));
      items.push({ upd: t => { dot.style.opacity = ease.p3out(prog(t, dat, dat + .3)); } }); if (o.xLabels) { mkText('label', o.xLabels[0], { x: R.x, y: R.y + R.h - 22, w: 200, h: 24, at: at + .3, enter: 'fade' }); mkText('label', o.xLabels[1], { x: R.x + R.w - 200, y: R.y + R.h - 22, w: 200, h: 24, align: 'right', at: at + .3, enter: 'fade' }); } return h; };
    // timeline: events [{at (year), text, hl}]; scale 'time' = proportional (decade ticks, axis from decade to decade), default = evenly spaced
    b.timeline = (o = {}) => { const R = b.rect(o), E = o.events, ys = E.map(e => e.at), time = o.scale === 'time', d0 = time ? Math.floor(Math.min(...ys) / 10) * 10 : Math.min(...ys), d1 = time ? Math.ceil(Math.max(...ys) / 10) * 10 : Math.max(...ys),
        tw = Math.min(300, R.w / E.length), pad = o.pad ?? tw / 2 + 24, ay = R.y + R.h / 2, X = (v, i) => R.x + pad + (R.w - 2 * pad) * (time ? (v - d0) / (d1 - d0 || 1) : E.length > 1 ? i / (E.length - 1) : .5), at = o.at ?? b.take(.2), dur = o.drawDur ?? 1.6;
      b.line(R.x, ay, R.x + R.w, ay, { color: 'paper', width: 2, at, drawDur: dur });
      if (time) { const n = (d1 - d0) / 5; b.ticks({ x: X(d0), y: ay, w: X(d1) - X(d0), n, major: 2, len: 12, side: 'up', color: 'muted', at: at + .1, drawDur: dur, labels: i => String(d0 + i * 5) }); }
      E.forEach((e, i) => { const x = X(e.at, i), up = i % 2 === 0, ea = at + dur * ((x - R.x) / R.w) + .1, w = tw; b.line(x, ay, x, ay + (up ? -44 : 44), { color: e.hl ? 'accent' : 'paper', width: 2, at: ea, drawDur: .35 });
        const dot = svgEl('circle', { cx: x, cy: ay, r: e.hl ? 11 : 8, fill: col(e.hl ? 'accent' : 'paper') }); lines.appendChild(dot); items.push({ upd: t => { dot.style.opacity = ease.p3out(prog(t, ea - .1, ea + .2)); dot.setAttribute('r', ((e.hl ? 11 : 8) * (1 + .5 * (1 - ease.p3out(prog(t, ea - .1, ea + .5))))).toFixed(2)); } });
        mkText('num', String(e.year ?? e.at), { x: x - w / 2, y: up ? ay - 130 : ay + 58, w, h: 46, align: 'center', size: 38, color: e.hl ? 'accent' : 'paper', at: ea + .2 }); mkText('body', e.text, { x: x - w / 2, y: up ? ay - 82 : ay + 106, w, h: 40, align: 'center', size: 28, color: 'paper', at: ea + .3 }); }); return { X: v => X(v, 0), ay, d0, d1 }; };
    // ---- media --------------------------------------------------------------------------------
    b.photo = (src, o = {}) => { const r = b.rect({ x: 0, y: 0, w: cw, h: ch, ...o }), at = T(o, .1); const el = div('mg-photo'); place(el, r); if (o.radius) el.style.borderRadius = o.radius + 'px'; const img = new Image(); img.src = new URL(src, o.base || baseURL).href; img.style.objectPosition = o.pos || '50% 50%'; if (o.duotone !== false) img.style.filter = `url(#mgduo-${o.duotone || 'accent'})`; el.appendChild(img); const dm = div('', { position: 'absolute', inset: '0', background: hexA(C.ink, o.dim ?? .4) }); el.appendChild(dm); media.appendChild(el); waits.push(img.decode().catch(() => {}));
      const kb = { s: [1.04, 1.12], dx: [0, -18], dy: [0, -8], ...(o.kenBurns || {}) }, dur = o.kbDur ?? Math.max(bt.dur, 4); items.push({ upd: t => { const k = ease.linear(t / dur), { p, q } = rv(o, at, t, .9); img.style.transform = `translate(${lerp(kb.dx[0], kb.dx[1], k)}px,${lerp(kb.dy[0], kb.dy[1], k)}px) scale(${lerp(kb.s[0], kb.s[1], k)})`; el.style.opacity = p * (1 - q); } }); return { el, img }; };
    b.icon = (name, o = {}) => { const size = o.size ?? 64, r = o.box ? b.rect(o) : { x: (o.x ?? 0), y: (o.y ?? 0), w: size, h: size }, at = T(o, .1); const s = svgEl('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: col(o.color || 'paper'), 'stroke-width': o.width ?? 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }); s.style.cssText = `position:absolute;left:${o.box ? r.x + (r.w - size) / 2 : r.x}px;top:${o.box ? r.y + (r.h - size) / 2 : r.y}px;overflow:visible`; lines.parentNode.insertBefore(s, text); const shapes = [];
      waits.push(fetch(new URL(`vendor/lucide/${name}.svg`, baseURL)).then(x => x.text()).then(tx => { const d = new DOMParser().parseFromString(tx, 'image/svg+xml'); for (const c of [...d.documentElement.children]) { const n = document.importNode(c, true); n.setAttribute('pathLength', 1); n.style.strokeDasharray = '1 1'; s.appendChild(n); shapes.push(n); } }));
      items.push({ upd: t => { const p = ease.p2io(prog(t, at, at + (o.drawDur ?? .9))), q = o.until != null ? ease.p2in(prog(t, o.until, o.until + .4)) : 0; for (const n of shapes) { n.style.strokeDashoffset = String(1 - p); } s.style.opacity = p > 0 ? 1 - q : 0; } }); return { el: s, at }; };
    b.map = o => makeMap(b, o);
    // ---- detail layer: mono metadata, legends, tick axes, leaders, chips (micro-labels are not counted as card words) ----
    const mono = (el, o) => { Object.assign(el.style, { left: o.x + 'px', top: o.y + 'px' }); if (o.w) el.style.width = o.w + 'px'; if (o.align === 'right') el.style.textAlign = 'right'; if (o.align === 'center') el.style.textAlign = 'center'; if (o.size) el.style.fontSize = o.size + 'px'; if (o.color) el.style.color = col(o.color); };
    b.meta = (str, o = {}) => { const at = T(o, .06); const el = div('mg-meta'); const tx = o.bg ? document.createElement('span') : el; if (o.bg) { Object.assign(tx.style, { background: hexA(C.ink, .7), padding: '3px 7px', margin: '0 -7px', borderRadius: '3px' }); el.appendChild(tx); } const U = x => (o.keep ? x : x.toUpperCase()); tx.textContent = U(str); mono(el, o); (o.parent || text).appendChild(el); const live = o.live; items.push({ upd: t => { if (live) tx.textContent = live(t).toUpperCase(); const p = ease.p3out(prog(t, at, at + .5)); el.style.opacity = (p * (o.alpha ?? 1)).toFixed(3); } }); return { el, at }; };
    b.legend = (list, o = {}) => { const at = T(o, .06), row = div('mg-meta', { left: o.x + 'px', top: o.y + 'px', display: 'flex', gap: '26px', alignItems: 'center' });
      const kids = list.map(it => { const k = div('', { display: 'flex', alignItems: 'center', gap: '9px' }); const c = col(it.color || (it.kind === 'line' ? 'paper' : 'accent')); const sw = div('', it.kind === 'line' ? { width: '20px', height: '2px', background: c } : it.kind === 'ring' ? { width: '11px', height: '11px', borderRadius: '50%', border: `1.5px solid ${c}` } : it.kind === 'box' ? { width: '11px', height: '11px', background: hexA(c, .35), border: `1px solid ${c}` } : { width: '10px', height: '10px', borderRadius: '50%', background: c }); const tx = document.createElement('span'); tx.textContent = it.label; k.append(sw, tx); row.appendChild(k); return k; });
      text.appendChild(row); items.push({ upd: t => { kids.forEach((k, i) => { k.style.opacity = ease.p3out(prog(t, at + i * .12, at + i * .12 + .5)); }); } }); return { el: row, at }; };
    // tick axis: n intervals, every `major`-th tick is long + labelled (labels: array or fn(i))
    b.ticks = (o = {}) => { const at = T(o, .08), n = o.n ?? 10, maj = o.major ?? 5, vert = o.dir === 'v', len = o.len ?? 12, L = vert ? o.h : o.w, dd = o.drawDur ?? 1.1; const px = i => (vert ? o.y : o.x) + L * i / n;
      let d = vert ? `M${o.x},${o.y}V${o.y + L}` : `M${o.x},${o.y}H${o.x + L}`;
      for (let i = 0; i <= n; i++) { const m = i % maj === 0, l = m ? len : len * .5, p = px(i); d += vert ? `M${o.x},${p}h${o.side === 'left' ? -l : l}` : `M${p},${o.y}v${o.side === 'up' ? -l : l}`; }
      mkPath(d, { color: o.color || 'muted', width: 1.2, at, drawDur: dd, opacity: o.opacity ?? .9 });
      if (o.labels) for (let i = 0; i <= n; i += maj) { const lab = typeof o.labels === 'function' ? o.labels(i) : o.labels[i / maj]; if (lab == null) continue; const p = px(i), la = at + .3 + (i / n) * dd;
        b.meta(String(lab), vert ? { keep: true, x: o.x + (o.side === 'left' ? -len - 70 : len + 8), y: p - 7, w: 60, align: o.side === 'left' ? 'right' : 'left', at: la } : { keep: true, x: p - 40, y: o.y + (o.side === 'up' ? -len - 20 : len + 8), w: 80, align: 'center', at: la }); } return {}; };
    // annotation: dot at `from`, hairline to `to`, mono label at the end
    b.leader = (from, to, label, o = {}) => { const at = T(o, .08); b.dot({ x: from.x, y: from.y, r: 5, color: o.color || 'accent', at }); mkPath(`M${from.x},${from.y}L${to.x},${to.y}`, { color: o.color || 'paper', width: 1.2, at: at + .1, drawDur: .6 }); const right = to.x >= from.x; b.meta(label, { x: right ? to.x + 10 : to.x - 210, y: to.y - 7, w: 200, align: right ? 'left' : 'right', at: at + .6, color: o.textColor || 'paper' }); return {}; };
    b.chip = (str, o = {}) => { const at = T(o, .1), el = div('mg-t'); el.style.cssText += `;left:${o.x}px;top:${o.y}px;padding:7px 16px 8px;background:${hexA(C.ink, .96)};border:1.5px solid ${col(o.color || 'accent')};border-radius:999px;font:500 ${o.size ?? 22}px/1 'Geist Mono',monospace;color:${col(o.color || 'accent')};white-space:nowrap`; el.textContent = str; text.appendChild(el); b.words(str); el.dataset.safe = '1'; items.push({ upd: t => applyH(el, rv(o, at, t, .6), 'scale') }); return { el, at }; };
    // ---- card chrome: hairline frame, corner ticks, header/footer rules, mono metadata ----------------
    { const F = 12, e0 = bt.noEnter ? .05 : .15; const cp = (d, at, dur, c, w, op) => mkPath(d, { layer: chrome, at, drawDur: dur, color: c, width: w, opacity: op });
      cp(`M${F + 6},${F}H${cw - F - 6}Q${cw - F},${F} ${cw - F},${F + 6}V${ch - F - 6}Q${cw - F},${ch - F} ${cw - F - 6},${ch - F}H${F + 6}Q${F},${ch - F} ${F},${ch - F - 6}V${F + 6}Q${F},${F} ${F + 6},${F}`, e0, 1.2, 'muted', 1, .5);
      const K = 16; [[F, F, 1, 1], [cw - F, F, -1, 1], [F, ch - F, 1, -1], [cw - F, ch - F, -1, -1]].forEach(([x, y, sx, sy], i) => cp(`M${x + sx * K},${y}H${x}V${y + sy * K}`, e0 + .2 + i * .08, .5, 'paper', 1.6, .9));
      cp(`M${cw / 2 - 12},${F}h24M${cw / 2},${F}v7M${cw / 2 - 12},${ch - F}h24M${cw / 2},${ch - F}v-7`, e0 + .5, .5, 'paper', 1, .5);
      if (bt.spec.rules !== false) { cp(`M44,64H${cw - 44}`, e0 + .3, .9, 'muted', 1, .45); cp(`M44,${ch - 50}H${cw - 44}`, e0 + .45, .9, 'muted', 1, .45); }
      b.meta(`FIG. ${String(bt.idx + 1).padStart(2, '0')}`, { x: cw - 244, y: 32, w: 200, align: 'right', at: e0 + .5, parent: content, bg: true });
      if (bt.spec.src) b.meta(`SRC · ${bt.spec.src}`, { x: 44, y: ch - 36, w: cw / 2, at: e0 + .7, parent: content, bg: true });
      b.meta('', { x: cw - 244, y: ch - 36, w: 200, align: 'right', at: e0 + .7, parent: content, bg: true, live: t => { const q = Math.max(0, t); return `T+${String(Math.floor(q / 60)).padStart(2, '0')}:${(q % 60).toFixed(1).padStart(4, '0')}`; } }); }
    // captions inside a beat are routed to the global caption track (absolute time = beat.at + t)
    b.caption = (s, o = {}) => { const a = o.at ?? .3; capPhrases.push({ text: s, s: bt.at + a, e: bt.at + a + (o.dur ?? Math.min(bt.dur - a, 2.4)) }); };
    const defers = []; b.defer = f => defers.push(f);
    bt.b = b; bt.fn(b); for (const f of defers) f();
    bt.words = nW; bt.items = items; if (!LR.card) { card.remove(); bt.card = null; }
    bt.upd = t => { for (const it of items) it.upd(t); };
  }

  // ---- public API -------------------------------------------------------------------------------
  const api = {
    W, H, C, ratio: portrait ? '9x16' : '16x9', PLACES,
    // mg.beat({at,dur,layout,tag,enter,exit}, b => ...)  one card
    beat(spec, fn) { const bt = { at: spec.at ?? 0, dur: spec.dur ?? 6, layout: resolveLayout(spec.layout === 'full' ? 'none' : spec.layout), tag: spec.tag, side: spec.enter ?? spec.side, exitSide: spec.exit ?? spec.side, fn, spec }; pending.push(bt); built = false; return bt; },
    get beats() { return beats; },
    // builds DOM for every pending beat (loads fonts, geo data, images, icons). await this before seek().
    async build() {
      if (fonts !== false) await Promise.all(['400 40px Geist', '500 40px Geist', '600 40px Geist', '500 40px "Geist Mono"'].map(f => document.fonts.load(f)));
      if (geo !== false && !reg) reg = await loadGeo(baseURL, geo);
      const all = [...beats, ...pending].sort((a, c) => a.at - c.at); all.forEach((x, i) => { x.idx = i; }); // chain: back-to-back beats in the same layout hand the panel off (no exit/enter between them)
      for (let i = 0; i < all.length; i++) { const p = all[i - 1], c = all[i]; if (p && p.card !== null && c.layout === p.layout && c.layout !== 'none' && c.layout !== 'full' && c.at - (p.at + p.dur) < .08) { p.noExit = true; c.noEnter = true; } }
      const waits = []; for (const bt of pending) buildBeat(bt, waits); beats.push(...pending); pending.length = 0; beats.sort((a, c) => a.at - c.at); await Promise.all(waits); await document.fonts.ready; built = true; return api;
    },
    activeLayout(t) { const bt = beats.find(x => t >= x.at && t < x.at + x.dur && x.card !== null); return bt ? (bt.layout === 'none' ? 'full' : bt.layout) : 'full'; },
    // layout + how far the layout switch has progressed (1.0 s in, 0.4 s out) so the engine can slide the scene in step
    layoutInfo(t) { const bt = beats.find(x => t >= x.at && t < x.at + x.dur && x.card); if (!bt) return { name: 'full', u: 0, rects: layoutRects(W, H, 'full') }; const inn = bt.noEnter ? 1 : ease.p3io(prog(t, bt.at, bt.at + 1)), out = bt.noExit ? 0 : ease.p2in(prog(t, bt.at + bt.dur - .4, bt.at + bt.dur)); return { name: bt.layout, u: inn * (1 - out), rects: layoutRects(W, H, bt.layout) }; },
    layoutRects: name => layoutRects(W, H, resolveLayout(name)),
    captions(phrases) { capPhrases = capPhrases.concat(phrases.map(p => ({ text: p.text, s: p.s, e: p.e }))); },
    seek(t) {
      if (pending.length) throw new Error('mg.seek: call `await mg.build()` after adding beats');
      const sideOf = (bt, k) => { const s = k === 'in' ? bt.side : bt.exitSide; if (s) return s; return bt.layout === 'stack' ? 'top' : bt.layout === 'split' ? 'bottom' : 'bottom'; };
      for (const bt of beats) { const c = bt.card; if (!c) continue; const lt = t - bt.at, vis = lt >= 0 && lt <= bt.dur; c.style.display = vis ? 'block' : 'none'; if (!vis) continue; { const px = (-lt * 3).toFixed(1), py = (-lt * 1.6).toFixed(1); bt.rule.style.backgroundPosition = `${px}px ${py}px, ${px}px ${py}px, ${px}px ${py}px, ${px}px ${py}px`; } const R = layoutRects(W, H, bt.layout).card;
        const ein = bt.noEnter ? 1 : ease.expoOut(prog(lt, 0, 1)), eout = bt.noExit ? 0 : ease.p2in(prog(lt, bt.dur - .4, bt.dur)); const dist = s => (s === 'top' ? [0, -(R.y + R.h + 20)] : s === 'bottom' ? [0, H - R.y + 20] : s === 'left' ? [-(R.x + R.w + 20), 0] : [W - R.x + 20, 0]);
        const di = dist(sideOf(bt, 'in')), dout = dist(sideOf(bt, 'out')); const x = di[0] * (1 - ein) + dout[0] * eout, y = di[1] * (1 - ein) + dout[1] * eout; c.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${drift(lt, .012, 4).toFixed(5)})`; c.style.opacity = Math.min(1, ein * 1.6) * (bt.noExit ? 1 : 1 - eout * .3);
        bt.content.style.opacity = bt.noExit ? 1 - ease.p2in(prog(lt, bt.dur - .3, bt.dur)) : 1; bt.upd(lt); }
      if (!portrait) { const info = api.layoutInfo(t), sw = Math.round(W * .22), full = info.name === 'takeover'; if (info.name === 'split' || full) { canvas.style.left = (full ? 0 : sw) + 'px'; canvas.style.width = (full ? W : W - 2 * sw) + 'px'; canvas.style.opacity = info.u.toFixed(3); const px = (t * 4).toFixed(1), py = (t * 2).toFixed(1); canvas.style.backgroundPosition = `${px}px ${py}px, ${(+px + 16)}px ${(+py + 16)}px, 0 0`; } else canvas.style.opacity = 0; }
      // captions: one phrase at a time, 120 ms fade in, 100 ms fade out, placed by the active layout
      const ph = capPhrases.find(q => t >= q.s && t <= q.e), L = layoutRects(W, H, api.activeLayout(t)).cap || layoutRects(W, H, 'full').cap;
      capEl.style.top = L.y + 'px'; capEl.style.fontSize = L.size + 'px'; capEl.style.width = W + 'px'; capEl.style.padding = `0 ${(W - L.w) / 2}px`; capEl.style.transform = 'translateY(-50%)'; if (!ph) { capEl.style.opacity = 0; return; } capEl.textContent = ph.text; capEl.style.opacity = Math.min(1, (t - ph.s) / .12, (ph.e - t) / .1);
    },
    // style/safety self-check: <=12 words per card, text inside card + safe areas (measured in the DOM at mid-beat)
    lint() { const issues = []; for (const bt of beats) { if (!bt.card) continue; if (bt.words > 12) issues.push(`beat@${bt.at}: ${bt.words} words (max 12)`);
        api.seek(bt.at + Math.min(bt.dur - .5, Math.max(2.5, bt.dur * .75))); const cr = bt.card.getBoundingClientRect(), hr = host.getBoundingClientRect(); const s = hr.width / W; const sa = portrait ? [H * .08, H * .82] : [0, H];
        for (const el of bt.card.querySelectorAll('[data-safe="1"]')) { if (el.style.opacity === '0') continue; const rg = document.createRange(); rg.selectNodeContents(el); const r = rg.getBoundingClientRect(); if (r.left < cr.left - 1 || r.right > cr.right + 1 || r.top < cr.top - 1 || r.bottom > cr.bottom + 1) issues.push(`beat@${bt.at}: text "${el.textContent.slice(0, 20)}" outside card`); if (el.scrollWidth > el.clientWidth + 6 || el.scrollHeight > el.clientHeight + 24) issues.push(`beat@${bt.at}: text "${el.textContent.slice(0, 20)}" overflows its box`); const top = (r.top - hr.top) / s, bot = (r.bottom - hr.top) / s; if (top < sa[0] || bot > sa[1]) issues.push(`beat@${bt.at}: text "${el.textContent.slice(0, 20)}" outside safe area`); } }
      for (const p of capPhrases) { const n = nwords(p.text); if (n > 6 || n < 1) issues.push(`caption "${p.text}": ${n} words (2-6)`); } return issues; },
    destroy() { host.remove(); css.remove(); },
    backdrop: portrait ? 'blur' : 'dots',
  };
  return api;
}
