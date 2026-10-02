# Poster component library (runtime/components.js + components.css)

Flat poster look from theme vars only (`--bg --deep --pale --paper --ink --shadow --marker --alert`): paper cards, 6 px ink outline, 10 px hard shadow, no blur.
Read this file only; never read components.js.

## Setup
Load in the composition (scripts in `<head>` are fine, but the choreography script MUST be inline AFTER the DOM, because the bundler hoists external scripts):
```html
<script src="gsap.min.js"></script><script src="theme.js"></script><script src="verbs.js"></script><script src="components.js"></script>
<link rel="stylesheet" href="components.css">   <!-- needs fonts/ (Inter 500/700/800/900, anton, JetBrainsMono-Bold) next to the html -->
<div id="root" ...><div id="cam"><div id="fx"></div></div></div>   <!-- components mount into #cam (else #root) -->
<script>window.__timelines = window.__timelines || {}; /* then choreography, tl = gsap.timeline({paused:true}); V.use(tl) */</script>
```
Theme: `:root{...}` vars from `Theme.css(T)` (see theme.js). Copy runtime/{theme,verbs,components}.js + components.css + fonts next to the html.

## Core API
- `const el = C.mount(kind, id, props, {x,y,w,h, layout:'9x16'|'16x9', host})` - creates the DOM, hidden until landed. `el.parts` = named sub-parts (DOM), `el.p` = performers.
  Omitted x/y/w/h default to the content zone (centred, sensible size). Zones `C.Z`: 9x16 = x70 y600 w940 h650 (reel, under captions); 16x9 = x160 y140 w1600 h800 (1920x1080, centre-stage, font scale 1.35).
- `C.land(el|id, tl, t, how?, opts?)` - entrance via verbs (`drop|rise|whip|pop|slam|fade|none|draw`, each kind has a default) then the kind's built-in landing detail (rows print, pins pop). Returns t+0.3.
- `C.leave(el|id, tl, t, {to:'left|up|down|shrink', d})` - exit.
- Performers: `el.p.fn(tl,t,...)` or `C.<alias>.fn(tl,t,...)` (targets the LAST mounted of that kind; pass `{on:'id'}` as the last arg to pick another). They return their end time. Every component also has `pulse(tl,t)`.
- Markup in text props: `*word*` gets a marker highlight (quote, caption, timeline events); `C.sweep(tl,t,rootEl)` sweeps all marks. `C.rich(str)` returns the html.
- `C.iconSvg(name)` returns an svg string (`C.icon` is the iconTile performer proxy); `C.ICONS` lists: book code globe gpu database user dollar lock search check cross star clock rocket chart play bolt.
- All DOM is created at authoring time; every tween is on the paused timeline. Add enough room: components do not auto-scroll (chat <= ~5 bubbles per 560 px, code <= ~11 lines).
- Layout lint: the zone keeps content out of captions/character. Mark intentional overlap with `data-layout-allow-overlap` (stack does it already).
- Sizes in 9x16: keep stacked things inside y600-1250; put 2 small components side by side by giving explicit x/w.

## Components (kind, aliases) - signature, performers, example
Props are `{...}`; `box` = `{x,y,w,h,layout}`.

### Windows
- **chatWindow** (`chat`): `{title}`. Performers: `ask(tl,t,text,{type,d})` user bubble (yellow); `reply(tl,t,text,{think,d})` typing dots then typed answer. Default landing: drop.
  `C.mount('chat','c1',{title:'ChatGPT'},{}); C.land('c1',tl,t); C.chat.ask(tl,t+.3,'Why?'); C.chat.reply(tl,t+.8,'Because...')`
- **browserFrame** (`browser`): `{src, aspect(h/w of the capture, default .66), url}`. No src = fake page skeleton. Performers: `scrollTo(tl,t,fy0to1,{d})`; `zoomTo(tl,t,{x,y,w,h fractions of page},{d,pad,max})`; `reset(tl,t)`; `mark(tl,t,{x,y,w,h},{d})` marker sweep that follows zoom/scroll.
  `C.browser.zoomTo(tl,t,{x:.1,y:.4,w:.6,h:.1}); C.browser.mark(tl,t+.5,{x:.1,y:.4,w:.6,h:.06})`
- **codeCard** (`code`): `{title, lines:[...]}` (lines starting `#` or `//` are grey). Performers: `type(tl,t,{from,to,cps})` types lines in order; `hl(tl,t,i,{off})` marker bar behind line i.
  `C.code.type(tl,t+.3,{cps:60}); C.code.hl(tl,t+1.2,3)`
- **terminal** (`term`): `{title}`. Performer: `run(tl,t,cmd,[outputLines],{cps,wait})` (output lines starting `ok`/`done`/check are yellow).
  `C.term.run(tl,t,'npm run build',['compiling...','ok built in 3s'])`

### Numbers and flows
- **receipt**: `{title, rows:[[k,v],...], cur:'$', dec:2, totalLabel}`. Landing prints the rows. Performers: `total(tl,t,from,to,{d})` odometer; `add(tl,t,k,v)` print one more row.
  `C.receipt.total(tl,t+.6,0,112.7)`
- **statCounter** (`stat`): `{label, from, to, prefix, suffix, dec, sub}`. Performer: `count(tl,t,to,{from,d})`.
  `C.mount('stat','s',{label:'tokens',to:15e6,suffix:'T'}); C.stat.count(tl,t+.3)`
- **stepRail** (`rail`): `{steps:[...], dir:'h'|'v'}` (h when box is wider than tall). Performer: `activate(tl,t,i,{d})` travelling dot hops to step i, node fills.
  `C.rail.activate(tl,t,1); C.rail.activate(tl,t+.8,3)`
- **timeline**: `{events:[{y:'2017',t:'*Transformer* paper'}]}`. Landing draws axis + dots + years. Performer: `reach(tl,t,i,{d})` fill grows to event i, pin lights, event card pops.
- **checklist**: `{items:[...]}`. Performer: `tick(tl,t,i,{strike})` check draws, box fills, text struck + dimmed.
- **rankingList** (`ranking`): `{items:[{l,v}]}`. Performer: `rank(tl,t,[idx top-to-bottom],{vals,d})` rows swap places with a bounce.
  `C.ranking.rank(tl,t,[2,1,0])`
- **comparison** (`compare`): `{a,b,rows:[{t,a:bool,b:bool}]}`. Landing shows labels. Performer: `row(tl,t,i)` pops the tick/cross for both columns.

### Charts (poster style: black axes, flat bars, hard shadow)
- **barChart** (`bars`): `{title,data:[{l,v}],max,hi:index,prefix,suffix,dec}`. Performers: `grow(tl,t,{stagger,d})` bars rise + odometer labels; `highlight(tl,t,i)` bar goes marker yellow.
- **lineChart** (`line`): `{title,data:[{l,v}],max,min,prefix,suffix}`. Performers: `draw(tl,t,{d})` line draws, points pop, area fades in; `highlight(tl,t,i)`.

### Media
- **imageFrame** (`image`): `{src, credit, caption('*marked*'), ken:'in'|'out'|null, kenD, grain:false, pos}` photo inside outlined card, credit tag, grain, caption under the card. Ken Burns starts on landing. Performer: `push(tl,t,{d,to,x,y})`.
  `C.mount('image','p',{src:'assets/x.jpg',credit:'Photo: NASA',ken:'in'},{w:700,h:480})`
- **videoWall** (`wall`): `{tiles:[{src?,icon?,badge?,bg?}], cols, rows, tw, th, scale}` tilted 3D grid (rotateX52 rotateZ-28); tiles without src show an icon on a poster colour. Landing pops tiles diagonally. Performers: `drift(tl,t,{d,dist,dx})` per-column parallax; `flash(tl,t,i)` lifts tile i. Video tiles: pass a poster image (no live video).
- **quoteCard** (`quote`): `{text:'... *marked* ...', by, auto}`. Performer: `hl(tl,t,{gap})` sweeps every marker word in order.

### Cards and chips
- **cardStack / fan** (`stack`): `{items:[{t,s,icon,bg}], mode:'stack'|'fan'}`. Performers: `fan(tl,t)`, `gather(tl,t)`, `pick(tl,t,i)` lifts card i, `shuffle(tl,t)` top card to the back.
- **chipRow** (`chips`): `{chips:[...], center}`. Landing pops chips in sequence. Performer: `pick(tl,t,i)` marker fill + pulse.
- **iconTile** (`icon`): `{icon, fill:'paper|marker|pale|ink|alert', size}` (square, size = w). Default landing pop. Performers: `flip(tl,t,iconName)` swaps the icon with a flip.
  `C.mount('icon','i1',{icon:'gpu',fill:'marker'},{x:100,y:700,w:160,h:160})`

### Titles, stickers, doodles
- **numberedBigTitle** (`title`): `{n:'01', title}` giant yellow numeral + outlined title. Landing slams the numeral, rises the title. Performer: `swap(tl,t,n,title)` numeral scrambles to the next section.
- **lowerThird** (`lower`): `{name, role}`; default placement x80 y790 (16:9). Default landing whip from the left. Performer: `ping(tl,t)`.
- **sticker**: `{text, icon, fill, rot}` marker-yellow tag, slams in with a tilt. Performer: `wiggle(tl,t)`.
- **stamp**: `{text, rot}` alert-red double-border stamp. Slams with a camera shake + ring (needs `#cam`, `#fx`).
- **doodle**: `{type:'sparkle|squiggle|arrow|speed|underline|circle', color:'ink|marker|alert|paper', flip, stroke}`; box w/h set its size. Strokes draw on landing (sparkle pops). Performers: `draw(tl,t)`, `twinkle(tl,t)` (sparkle).
  `C.mount('doodle','d',{type:'circle',color:'alert'},{x:300,y:700,w:360,h:220}); C.land('d',tl,t)`

## Typical choreography (keeps cards alive after landing)
```js
C.mount('receipt','r',{rows:[['GPU','$96'],['Disk','$12']]}); C.land('r',tl,2.0);
C.receipt.total(tl,2.8,0,108);                 // performance 0.6 s after landing
mount('doodle','o',{type:'circle',color:'alert'},{x:600,y:900,w:300,h:180}); C.land('o',tl,3.6);
C.leave('r',tl,4.5,{to:'shrink'}); C.leave('o',tl,4.5,{to:'shrink'});
```

## Known limits
- Chat/terminal/code do not scroll; budget lines to the box.
- Video wall tiles are stills. Timeline needs 2-6 events; with >4 the cards alternate low/high.
- Fan spreads wide: give stack boxes the full zone width or it can clip at the canvas edge.
- Demo + contact sheets: out/components-demo/index.html (9:16) and out/components-demo/wide/index.html (16:9; separate project dir because check allows one root composition per dir).
