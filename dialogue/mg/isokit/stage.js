// ISOKIT stage: background (deep indigo soft gradient + stars) and the two layouts
//   16x9 'full' : the iso world fills the 1920x1080 frame
//   9x16 'card' : the world sits in the top card (stack rect 54,154,972x691) over the scene; the scene stays visible below
// frame = { tag, fit: ratio -> [[x,y,z,r]...], draw: (sc, t, ratio) -> void, zoom?: {16x9, 9x16} }
import { PAL, rgba, f1, rng, fitView, createScene } from './core.js';

export const LAYOUTS = { '16x9': { W: 1920, H: 1080, card: null }, '9x16': { W: 1080, H: 1920, card: { x: 54, y: 154, w: 972, h: 560 } } };   // 2026-11-11: 9:16 card shorter (was h 691) so the actors' heads stay clear below it (engine layout 'float')

export function background(W, H, seed = 11) {
  const R = rng(seed); let s = `<defs><radialGradient id="bgg" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="${PAL.bg2}"/><stop offset=".55" stop-color="${PAL.bg1}"/><stop offset="1" stop-color="${PAL.bg0}"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#bgg)"/>`;
  const n = Math.round(W * H / 9000);
  for (let i = 0; i < n; i++) { const x = R() * W, y = R() * H, r = .6 + R() * 1.5, a = .15 + R() * .45; s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${rgba(i % 7 ? PAL.cream : PAL.sky, a)}"/>`; }
  for (let i = 0; i < Math.round(n / 40); i++) { const x = R() * W, y = R() * H, k = 4 + R() * 4; s += `<path d="M${f1(x - k)},${f1(y)}L${f1(x + k)},${f1(y)}M${f1(x)},${f1(y - k)}L${f1(x)},${f1(y + k)}" stroke="${rgba(PAL.cream, .45)}" stroke-width="1.2" stroke-linecap="round"/>`; }
  return s;
}
// returns the inner SVG markup of the world for a W x H viewport (box = area the subject must fit in)
export function worldSvg(frame, W, H, ratio, t, box) {
  const V = fitView({ W, H, pts: frame.fit(ratio), box, zoom: frame.zoom?.[ratio] ?? 1 }); const sc = createScene(V); frame.draw(sc, t, ratio);
  return background(W, H, frame.seed ?? 11) + sc.svg();
}
const head = (fontBase) => `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:'Geist Mono';font-weight:100 900;src:url(${fontBase}GeistMono-500.woff2) format('woff2')}html,body{margin:0;overflow:hidden;background:#0E1621}</style>`;
const tagHtml = (txt, fs) => `<div style="position:absolute;left:${fs * 1.7}px;top:${fs * 1.5}px;display:flex;align-items:center;gap:${fs * .7}px;font:500 ${fs}px/1 'Geist Mono',monospace;letter-spacing:.14em;color:${rgba(PAL.cream, .72)}"><i style="display:block;width:${fs * .5}px;height:${fs * .5}px;background:${PAL.saffron};border-radius:2px"></i>${txt}</div>`;
export function pageHtml(frame, ratio, t, o = {}) {
  const L = LAYOUTS[ratio], fontBase = o.fontBase || '/mg/fonts/';
  if (!L.card) {
    const { W, H } = L, box = { x: 160, y: 110, w: W - 320, h: H - 200 };
    return head(fontBase) + `<body style="width:${W}px;height:${H}px;position:relative"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0">${worldSvg(frame, W, H, ratio, t, box)}</svg>${frame.tag ? tagHtml(frame.tag, 18) : ''}</body>`;
  }
  const { W, H, card: C } = L, box = { x: 36, y: 64, w: C.w - 72, h: C.h - 64 - 34 };
  return head(fontBase) + `<body style="width:${W}px;height:${H}px;position:relative;background:#0E1621 url(${o.backdrop || '/mg/examples/backdrop/hero_wide_9x16.png'}) center/cover no-repeat">`
    + `<div style="position:absolute;left:${C.x}px;top:${C.y}px;width:${C.w}px;height:${C.h}px;border-radius:22px;overflow:hidden;box-shadow:0 30px 70px rgba(8,6,24,.6),0 0 0 1.5px ${rgba(PAL.cream, .16)}">`
    + `<svg width="${C.w}" height="${C.h}" viewBox="0 0 ${C.w} ${C.h}" style="position:absolute;left:0;top:0">${worldSvg(frame, C.w, C.h, ratio, t, box)}</svg>${frame.tag ? tagHtml(frame.tag, 16) : ''}</div></body>`;
}
