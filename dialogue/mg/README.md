# DIALOGUE MG: runtime-first motion-graphics library

Primitives plus an authoring API (PLAN §12). Producer code composes primitives per episode; style (STYLE-GUIDE §2/§6/§8: ink panel, paper line, Geist/Geist Mono, one accent, no bounce) lives inside the primitives. HTML/SVG, every frame a pure function of `t` (no clock, no random).

## Engine interface
```js
import { createMG } from './mg/index.js';
const mg = createMG({ root, ratio: '9x16' /* or '16x9' */, palette: {accent:'#F3BF63'}, base, geo });
mg.beat({at: 12.4, dur: 7, layout: 'auto', tag: 'United States', src: 'Natural Earth', rules: false}, b => { ... });   // one card (src = footer source line, rules:false drops header/footer rules)
await mg.build();            // fonts, geo, images, icons; call again after adding beats
mg.seek(t);                  // every frame; sync, idempotent
mg.activeLayout(t)           // 'stack' | 'split' | 'full' (3D only)   mg.layoutInfo(t) -> {name, u, rects}
mg.layoutRects('stack')      // card + caption rects, same numbers the engine should use
mg.captions([{text,s,e}])    // global caption track (also b.caption inside a beat)
mg.lint()                    // <=12 words/card, text inside card + safe areas, captions 2-6 words
```
Look: layered card (hairline inner frame, corner ticks, header/footer rules, faint ruled grid that drifts, grain, drop shadow, mono `FIG. nn` / source / live `T+` timecode). 16:9: the MG sits on a dotted back canvas (own slate colour + dot grid, drifts slowly) between the two strips. 9:16: no canvas; the card floats over the scene and its backdrop is blurred (`backdrop-filter`). `mg.backdrop` says which one (`'dots'|'blur'`).

Layouts: `auto` (stack 9:16 / split 16:9), `stack`, `split`, `takeover` (MG fills the frame), `none` (captions only). Back-to-back beats in one layout hand the panel off (no exit/enter between). Panel enters/exits from the top (stack) or bottom (split); override with `enter`/`exit`: `'top|bottom|left|right'`.

## Builder `b` (card-local px, 1080-wide type scale)
- Time: elements without `at` auto-stagger (100 ms) from a cursor: `b.at(t)`, `b.wait(s)`, `b.take()`. Every element takes `{at, dur, until, enter:'fade-up'|'wipe'|'fade'|'scale'|'none'}`.
- Layout: `b.box`, `b.rect()`, `b.rows([w..]|n, {box,gap})`, `b.cols(...)`, `b.col(i, span)` (12-col).
- Text: `title sub body label (s, {box|x,y,w,h, size, color, align, valign, hl})`, `number(to, {from, unit, size, countDur, dec})`.
- Line art (stroke draw-on): `path line arrow(from,to) connector(a,b,{kind:'elbow'|'curve'}) underline bracket divider`.
- Shapes: `dot ring block bar progress dotGrid({total,lit,label,note}).compareWith({...})`.
- Detail layer (micro-labels, not counted in the 12-word limit): `meta(str,{x,y,w,align,keep})`, `legend([{kind:'dot|ring|line|box',label}])`, `ticks({x,y,w|h,n,major,labels,dir,side})`, `leader(from,to,label)`, `chip(str,{x,y})` (chip is counted).
- Charts (from shapes): `bars({data:[{label,value,hl}]}) lineChart({data}) timeline({events:[{at,text,hl}]})`.
- Geo: `m = b.map({from:'US', lat0:38, view:{c,h}})` then `m.zoom({c,h},{at,dur})`, `m.pin('San Francisco',{label:'San Francisco · 1937'})`, `m.route(a,b)`, `m.region(id)`, `m.zoom(id|{c,h},{at,dur})`, `m.pan`. Regions: ISO codes of the shipped Americas subset (US, CA, MX...); the map adds lat/lon edge labels, centre coordinates and a scale bar. Add your own regions via `createMG({geo:{countries, admin1:[...]}})`.
- Media: `photo(src,{duotone:'accent'|'paper'|false, kenBurns})`, `icon('map-pin',{x,y,size})` (Lucide, `vendor/lucide`).
- Colours are palette keys only: `ink paper muted accent accent2`.
- Motion helpers exported from `index.js`: `ease` (p3out, p2io, p2in, expoOut, linear), `prog`, `stagger`, `drift`, `pair`.

## Examples / render
`examples/index.js`: map+pin (US to San Francisco), dot-grid compare, number count (Golden Gate), timeline, photo duotone (CC0), free-form (icons/rings/arrows only); all international, 7 s each with 2.5 s+ holds. Credits in `examples/CREDITS.md`.
```
node runtime/jobq.js --kind render -- node dialogue/mg/render.mjs stills        # stills, both ratios -> examples/out/
node runtime/jobq.js --kind render -- node dialogue/mg/render.mjs video 9x16    # 42 s chain at real pacing (also 16x9); `all` does stills + both chains
```
`preview.html` + `page.js` show MG over a stand-in scene (spike1 hero render) (`window.load(name)`, `window.frame(t)`).
