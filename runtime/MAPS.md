# Poster maps (runtime/maps.js)

Flat editorial map in the poster palette: paper land, ink coast (4-5 px) + thin borders (2.8 px), HARD `--shadow`
offset under the landmass, water = `--bg` with the dot grid, Anton caps on outlined paper chips, graticule at 15 %.
Strokes and shadows stay constant in screen px at every zoom. India-POV borders (Natural Earth 10m `_ind`).

## Setup
```html
<script src="gsap.min.js"></script><script src="geo.js"></script><script src="maps.js"></script>
<!-- theme CSS vars on :root (runtime/theme.js); Anton @font-face -->
<div id="map"></div>
<script>const M = Maps.mount("map", { tl, view:"world", layout:"16x9" /* or 9x16 */, x:0,y:0,w:1920,h:1080 });</script>
```
Copy `runtime/geo/geo.js` (~933 KB, built by `node runtime/maps_build.js`; geo.json is the same data) next to the page.
Mount opts: `tl` (paused timeline, required), `view`, `pad`, `land:"paper"|"pale"`, `water:"bg"|"deep"`,
`frame:true` (6 px ink card + shadow), `graticule:false`, `drawBorders:true` (start borders undrawn), `theme` overrides.

## Views (mount `view`, `M.zoom` target)
`"world"`, a region name (`south-asia asia east-asia southeast-asia middle-east europe africa north-america south-america oceania indian-ocean`),
ISO3 `"IND"` or `["IND","PAK"]`, `[lonMin,latMin,lonMax,latMax]` / `{lon:[a,b],lat:[c,d]}`. Places = city name (`Maps.CITIES`), ISO3, or `[lon,lat]`.

## Performances (all take time t in seconds; seek-safe, finite repeats; chainable)
- `M.drawBorders(t, dur)` borders stroke on.
- `M.zoom(view, t, dur, {pad, ease})` camera push (chains from the previous zoom's target).
- `M.focus(iso, t, {color, dur, label:true|text|false, dim:true, dx, dy})` lift 1.04 + growing shadow, fill `--marker`, neighbours dim.
- `M.pin(place, t, {label, side:"r|l|t|b", size, color})` drop + squash bounce, chip pops.
- `M.route(from, to, t, {dur, loops, per, bend, fromLabel:"" to skip, rings})` dotted arc draws on, arrowhead, travelling dot, double-ring endpoints.
- `M.tradeFlow(hub, [places], t, {gap, loops, per, labels})` several arcs with looping dots.
- `M.choropleth({ISO:v}, t, {stagger, unit, title, fmt, legendX, legendY, off:{ISO:[dx,dy]}, ramp:[5 colours]})` fills in value order, value chips, legend chip.
- `M.count(place, n, t, {label, prefix, suffix, dx, dy, tilt})` yellow stat sticker with counting number, stem to the country.
- `M.label(place, t, {text, dx, dy, size})`, `M.clear(t, dur)` fade overlays/focus/arcs, `M.chip(parent, text)` helper.

## Example
```js
M.drawBorders(0.1, 1.3); M.zoom("south-asia", 1.5, 1.5);
M.focus("IND", 3.0); M.count("IND", 1428, 3.7, { label:"million people", suffix:"M", dx:330, dy:-150 });
M.clear(4.9); M.pin("mumbai", 5.0, { side:"l" });
M.zoom({lon:[34,112],lat:[-8,38]}, 5.6, 1.3); M.route("mumbai","dubai", 7.0, { fromLabel:"" });
M.tradeFlow("mumbai", ["singapore","nairobi","jeddah"], 8.6);
```
Demo: `out/maps-demo/build.js` -> wide.html (1920x1080, 12 s) + index.html (9:16). Keep one composition per project when running `check`.

## Notes
- Fade/clear only affects elements created before the `clear` call. Timeline length includes finite ring/dot repeats: size `data-duration` accordingly.
- Chip width is estimated from the text length (Anton ~0.5 em/char); long labels may need `size`.
- Hard-coded checks: add `data-layout-allow-overflow` is set on the map host automatically.

# Doc2D additions (opt-in; reels never touch these)

## Atlas skin — `Maps.mount(host, { tl, skin:"atlas", ... })`
Implies `calm`. Palette `Maps.ATLAS_T` (cream paper land, navy ink, sea gradient `bg`→`sea2`), overridable with `theme`.
- **Terrain:** Natural Earth SR_50M shaded relief (public domain), reprojected to the map projection by
  `python runtime/maps_relief.py SR_50M.tif` → `runtime/geo/relief/` (`lo.webp` world + 47 ~1024px tiles, 2.7 MB) and the
  manifest `relief.js` (`window.MAPS_RELIEF`). Tiles are warm-umber "shadow" WebPs (alpha = shadow depth), so plain
  compositing over paper equals a multiply blend. LOD by zoom; only tiles in view are displayed. Opts: `relief` (opacity, default 0.42, `false` = off), `reliefPath` (default `"relief/"`).
- **Paper grain:** `paper.jpg` (512px tile) multiplied over the whole map. Opts: `grain` (opacity 0.55, `false` = off), `grainPath`.
- **Coasts:** soft blurred drop shadow under land, thin coast line, plus a faint offset second print line; borders at 45% ink.
- **Labels:** `M.label` in atlas draws tracked lettering (no chip; pass `chip:true` for the old chip).
- Page needs: `<script src="relief.js">` before `maps.js`, and `relief/*.webp` + `paper.jpg` next to the page.
  `runtime/doc/build.js` does not copy these yet — see `out/doc2d-maps-demo/build.sh` for the extra copy + script tag.

## New verbs (work in any skin; all seek-safe, re-drawn with the camera)
- `M.place(where, t, {text, kind:"country|sea|city|region", size, color, dx, dy, rotate, track, out})` — wide-tracked caps with a
  paper halo, tracking settles in; seas = italic Plex; city adds a dot; `"\n"` splits lines; `out` = fade-out time.
- `M.pencil(kind, spec, t, {color, width, dur, hold, seed, rough, cursor})` — line draws on by itself (dash-offset draw, light
  displacement roughening) led by a soft glowing tip: bright core + blurred halo + short fading dot trail in the line colour,
  visible only while the line is drawing. `cursor:"pencil"` restores the old pencil glyph (opt-in), `cursor:"none"` = no tip. Kinds: `"circle"` (place; `r`, `ry`, `tilt`), `"underline"` (place; `w`, `y`, `double`),
  `"write"` (place; `text`, `size` — single-stroke hand lettering `Maps.HAND`: 0-9 A-Z - . , / : ' + ! ( ) % $ ?),
  `"arrow"` (`[from, to]`; `bend`, `head`, `shorten`), `"path"` (`[places]`). `dx/dy` shift in screen px.
- `M.front(route, t, {color, dur, hold, area:[ISO], reach, width, chevron, label, labelAt})` — band grows along the route with
  chevrons marching forward and a lead arrowhead; the `area` countries fill (tint + hatch) behind the front via a brush mask
  of width `reach` (projected units; auto from the area bbox). A route of ISO codes uses those countries as the area.
- `M.mover(from, to, t, {glyph:"ship|plane|truck", color, dur, via:[places], path:"great|smooth|arc", size, trail, fadeOut, ease})`
  — glyph rides a great circle (plane default) or Catmull-Rom through `via` (ship/truck), auto-rotated to the tangent, dotted wake.
- `M.trade(route, t, {color, width, dur, hold, speed, path})` — route draws on, then dashes travel along it for `hold` s.
- `M.stat(where, n, t, {label, prefix, suffix, decimals, dx, dy, color, size})` — paper card with accent bar, counting number,
  leader line to the place (calm counterpart of `M.count`).
- Helpers: `Maps.unproject(x, y)` → `[lon, lat]`, `M.anchor(x, y)`, `M.hooks` (functions `(vx, vy, s, w, h)` called on every draw).
- Places everywhere: city name, ISO3, or `[lon, lat]`.

## Globe — `runtime/doc/globe.js` (+ `runtime/geo/globe-geo.js`, 490 KB, built by `node runtime/geo/globe_build.js`)
Orthographic globe on a canvas, no d3: same NE 10m India-POV source and ISO keys as geo.js. Drawn as a pure function of state.
```js
const G = Globe.mount(host, { tl, lon:-18, lat:12, r:400, theme });
G.to({ lon:54, lat:25, r:470 }, t, dur, { ease });   // rotation + log-zoom, chains from the last target; G.spin(t, dur, degPerSec)
G.highlight("IRN", t, { color, amount });  G.arc(from, to, t, { color, dur, lift });  G.pin(place, t, { label });  G.clear(t, d);
G.handoff(M, view, t, { dur:2.6, fade:0.7 }); // fly to M.fit(view) centre at matched scale (anisotropic settle to the
                                              // flat projection), then cross-fade globe -> map host. Mount M with the same view.
```
Atmosphere glow, lit-from-upper-left shading, rim light, faint graticule; coast halo + per-country fills.

## Demo
`bash out/doc2d-maps-demo/build.sh` (wraps `runtime/doc/build.js` with `out/doc2d-maps-demo/demo-src.js`, then adds globe/relief
assets) → `out/doc2d-maps-demo/comp`; ~26 s: globe → Gulf → handoff → atlas map → pencil circle + "33 KM" → ships + trade
dashes → chevron front over Iran → 20 % stat. Draft: `out/doc2d-maps-demo/doc2d-maps-demo-draft.mp4`.

## Paper-cut skin — `Maps.mount(host, { tl, skin:"paper", ... })` (Doc2D default look; implies atlas + calm)
The static world is **baked once** (`python runtime/maps_paper.py SR_50M.tif` → `runtime/geo/relief/{pl_*,ps_*,p_lo_*}.webp`,
`shimmer.webp`, and `window.MAPS_PAPER` appended to `relief.js`; 5.2 MB, shipped by `runtime/doc/build.js` with the relief folder).
The comp only moves images; no live filters on the world.
- **Land:** one cut-paper sheet per country (slight per-sheet tint), seams, lit top-left / shaded bottom-right cut edge, NE SR_50M
  relief, fibre grain, and the sheet's soft offset shadow on the sea (tile alpha).
- **Sea:** depth-tone bands as stacked paper sheets (shallow → deep, each with a soft shadow from the sheet above and a lit edge),
  a painted low-frequency tonal drift, and a live **shimmer** (two glint tiles drifting against each other; `shimmer: 0..1 | false`).
- **Never static:** a continuous slow camera **drift** (`drift: [t0, t1] | false`, `driftMove: {x, y, z}` px / zoom; or `M.drift(t0, t1, d)`),
  layered on any `M.zoom`. **Parallax:** the sea sheet moves at 0.5× the drift, routes at 1.12×, labels/tags at 1.35×.
- **Labels:** `M.label` → `M.tag`. Labels and tags fade out as their box nears the safe-area edge (seek-safe; `safe: {l,r,t,b}` to
  override, `edgeFade:false` per label), so zooms never crop text. Sea lettering is navy on every band.
- `M.tag(where, t, {text, dx, dy, size, accent, out, rotate})` — paper tag (cream card, accent strip, stacked soft shadow) on a
  leader line that draws from a dot on the land layer to the tag on the label layer.
- `Maps.WATERWAYS` + place keys: `hormuz`, `bab-el-mandeb`, `malacca`, `suez`, `panama`, `bosphorus`, `dardanelles`, `gibraltar`,
  `dover`, `english channel`, `taiwan`, `palk`, `kiel`, `sunda`, `lombok`, `magellan`, `good hope`, `korea strait`, `bering`,
  `mozambique channel` — a tag on one names itself ("STRAIT OF HORMUZ").
- **Routes:** `M.pencil("path"|"arrow")` keeps the glowing tip (longer soft trail) and then a dash **flow** runs along the finished
  line for `flow` s (default 6 in paper; 0 = off). `M.trade` also draws with the glowing tip. Roughening is off in paper (`rough:true` to enable).
- Borders are baked into the land sheets; `drawBorders:true` / `borders:true` turns the live border layer back on.
- **Globe** (`runtime/doc/globe.js`): paper look by default when `MAPS_PAPER` is loaded (`skin:"plain"` = old flat globe): sea = the
  baked band texture mapped per pixel (half res, data-URI texture), land = tinted cut-paper sheets with offset shadow, lit edge and
  grain (`paper.jpg` pattern); globe arcs draw with the same glowing tip + trail. `G.handoff` cross-fades only once the globe has landed.
- Demo: `bash out/doc2d-maps-demo/build-paper.sh` → `out/doc2d-maps-demo/doc/{maps169,maps916}` (globe → handoff → route → border →
  zoom to Hormuz, 16 s), gated with `node runtime/doc/qa.js`.

## Upgrades: street dive, data layers, two-routes race (skin paper)
- **Globe → country → city → street, and back.**
  - `G.handoff(M, view, t)` flies the globe into the map (existing); `M.zoom(cityView, t, d)` continues down.
  - `M.streets(city, t, {km, seed, arterials, rings, patches})` — a procedural paper street plan (urban tint, arterials, ring roads,
    local grids; illustrative, not real streets) clipped to the land, fading in below ~120 km view widths. It also switches on the
    **deep layer**: nearby coasts re-drawn as Chaikin-smoothed vector paper sheets (shadow, grain, lit edge) over crisp vector sea
    bands, so city scale is sharp although the baked tiles are country scale.
  - `M.tilt(t, d, {to:1, deg:38, scale:1.95})` leans the whole paper plane back in CSS 3D; a paper sky rises, overlays fade, and the
    far edge dissolves into haze with the horizon at ~33% of the frame — the framing of a world-kit exterior **establish** cam,
    so `DOC.cut(mapShot, worldShot, t, {type:"dissolve"})` into `SETS.mount(s, placeId, {cam:"establish"})` reads as one move.
  - Reverse: a map shot that starts tilted (`M.tilt(t0, 0.05, {to:1})`), lies flat (`M.tilt(t, d, {to:0})`), zooms out, then
    `G.handback(M, view, t, {fade, dur, to:{lon, lat, r}})` cross-fades into a matched globe that pulls back out. `G.match(M, view)`.
- **Data layers** (calm entrances, all keep moving with the drift; label boxes edge-fade like tags):
  - `M.choro({ISO: v}, t, {ramp, stagger, title, unit, fmt, opacity, legend, out})` — country sheets re-inked (multiply, so relief +
    grain show through) in value order; paper legend card bottom-left inside the safe area.
  - `M.symbols({place: v}, t, {color, max, rmax, unit, fmt, stagger, labels, out})` — proportional paper discs (area ∝ value) with a
    stacked shadow; value printed inside when r ≥ 44 px; they breathe ±2%.
  - `M.heat([[lon, lat, w]], t, {km, levels, ramp, res, stagger, opacity, out})` — density field painted once at mount into stacked
    paper contour sheets (lit edge + shadow per level), levels lay down in turn, slow breathing.
  - `M.flow(from, to, t, {value, max, wmax, color, dur, hold, bend, speed, label, out})` — tapered flow ribbon whose width grows to
    its volume, glowing tip while drawing, dashes streaming along it; optional paper tag at the midpoint.
- **Race:** `M.race(routeA, routeB, t, {dur, days:[a, b], names, colors, glyph, size, hold, out})` — both routes draw at once with a
  ship on each tip at the same speed (the longer one arrives later), paper day-counter cards in the top corners tick to their totals
  and show ARRIVED.
- More place keys: `rotterdam`, `port said`, `cape town`, `los angeles`, `shenzhen`, `busan`, `antwerp`, `hamburg`, `piraeus`, `kochi`, `chittagong`.
- Demo: `bash out/doc2d-maps-demo/build-upgrades.sh` → `out/doc2d-maps-demo/doc/upgrades` (6 shots, 51.5 s) → `upgrades.mp4`.

## Map kits — `runtime/doc/mapkits.js` (storyboard-JSON driven, paper-cut, never static)
`MAPKITS.play(s, spec, t0, t1, { tl, at })` fills a DOC shot `s` from one JSON spec. Times in a spec are seconds from `t0`
(numbers) or spoken words (strings, resolved by `at(word, default, dur)` — storyboard-core's `AT`). Every kit runs a slow linear
camera/drift for the whole shot, edge-fades labels at the safe area, and keeps all text ≥ 24 px. Works in 16:9 and 9:16 (`DOC.vert`).
- **`tabletop`** — planning-room map game: a paper map sheet tilted on a wood table under a lamp, desk props (ruler, pencil, cup),
  an index-card title; paper tankers/ships/tokens slide along lanes.
  `{kit:"tabletop", view, title, titleAt, tilt:16, props:true, camera:{s1,x1,y1},
    tokens:[{glyph:"tanker|ship|token|truck|plane", from, to, via, at, dur, color, size, ease, label, dx, dy}],
    marks:[{kind:"circle|arrow|path|underline", spec, at, color, r, flow}], tags:[{where, at, text, dx, dy, color, out}]}`
- **`zoom`** — infinite paper zoom through nested artworks (inside → out; `reverse:true` zooms in):
  `{kit:"zoom", at, dur, ease, reverse, levels:[{art:"coin", text, sub, ratio, caption}, {art:"tanker", name, ratio, caption},
    {art:"map", center:[lon,lat], span:deg, ratio, caption}, {art:"globe", spin, caption}]}`. `ratio` = how many times larger the next
  level is. Each level paints a small version of its child at its centre; the child is feathered in on top; a map level keeps
  covering the frame (it is a whole world) until the globe is near its own scale, then cross-fades. One caption card per level,
  never two at once.
- **`tracker`** — drawn ship-tracker screen (bezel monitor on a paper wall): dark AIS map, blips moving along lanes (already
  mid-lane at the cut), radar sweep, scanlines, a ticking UTC clock, stats that count up, alert cards that pop in and stack
  (newest on top) with a ring on the map.
  `{kit:"tracker", view, title, lanes:[[[lon,lat],...]], ships, lap, clock, clockRate, stats:[{label, from, to, at, dur, unit}],
    alerts:[{at, text, where, level:"warn|alert"}]}`
- **`timeline`** — paper map + paper timeline strip with a playhead (eases to each event's year, creeps between) and a big year card.
  `{kit:"timeline", view, from, to, tick, at, events:[{year, at, do:"tag|route|border|pin|fill|zoom", where, text, pts, iso, view,
    color, dx, dy, flow, out}]}`
- Storyboard hook (owner of storyboard-core.js): in a `kind:"map"` shot, `if (sh.mapkit) return MAPKITS.play(s, sh.mapkit, t0, t1,
  { tl, at: (w, d, dur) => AT(sh, w, d, dur) })`. `build.js` must ship `runtime/doc/mapkits.js` with a `<script>` after `globe.js`
  (see `out/doc2d-maps-demo/build-kits.sh`).
- New glyphs for `M.mover`: `tanker`, `token`, `blip` (or pass a function `(g, color) => …`); `M.mover(..., {q0})` starts part-way.
- Showcase: `out/doc2d-maps-demo/map-kits.json` (4 shots, 41.5 s) → `build-kits.sh` → `map-kits.mp4`.

## Air freight + export controls (ASML pieces)
- `M.air(from, to, t, {color, width, dur, flow, plane:true, planeColor, size, label, dx, dy, out})` — a great-circle leg draws with
  the glowing tip while a plane glyph rides it, then dashes flow along it; an optional destination tag.
- `M.restrict(isos, t, {color, hatch, opacity, label, where, dx, dy, out})` — export-control / sanctions layer: the countries are greyed
  out (a grey sheet, multiplied so relief still reads, plus a diagonal hatch and a dark edge), with an optional stamp tag.
- Place keys: `veldhoven`, `eindhoven`, `hsinchu`, `taipei`, `pyeongtaek`, `icheon`, `hwaseong`, `chandler`, `phoenix`, `hillsboro`,
  `san jose`, `schiphol`, `dresden`.
- World views: keep the centre latitude ≤ ~16° at full width (e.g. `{lon:[-126,132], lat:[-24,56]}`). The baked tiles stop at 84°N.
- Example: `out/doc2d-maps-demo/asml-src.js` (globe → Veldhoven street dive; four air legs; China greyed).

## Supply-chain strip + rare-earth places
- `M.chain(steps, t, {title, color, stagger, x, y, w, out})` — screen-space strip of paper cards joined by arrows (bottom of the
  safe area). Each card's bar fills to `share` and its number counts up. `steps: [{name:"Mining", share:70, note:"China's share"}, ...]`.
- Place keys: `bayan obo`, `baotou`, `mountain pass`, `las vegas`, `mount weld`, `kalgoorlie`, `fremantle`, `kuantan`, `gebeng`, `ningbo`, `ganzhou`.
- Regional zooms: keep the view ≥ ~9° wide (s ≥ ~0.4). Tighter regional views upscale the relief tiles more than ~8× and look smeared;
  street scale (`M.streets`, below ~0.26) switches to the sharp deep layer instead.
- Disputed places: label both names with "(disputed)", e.g. `M.tag([123.55, 25.75], t, {text:"Senkaku / Diaoyu Islands (disputed)"})`.
- Example: `out/doc2d-maps-demo/ree-src.js` (Bayan Obo dive, Mountain Pass, East China Sea 2010, supply chain, Lynas, export controls).
- `M.fan(from, [to...], t, {value, max, wmax, color, stagger, dur, bend, label, out})` — one layer of flows from one source to many
  destinations; call it again with a bigger value and a hotter colour for escalating layers (mined → refined → magnets).
- `M.hold(where, t, {text:"Held", color, dx, dy, out})` — "held" marker on a lane: a pause-octagon paper badge that breathes, plus a tag.
- `M.lightup(places, t, {color, badge:"CN", stagger, label, out})` — abstract "lights up everywhere": a soft glow per place plus a stamped badge.
- More place keys: `chicago`, `ford chicago`, `osaka`, `yokohama`, `dalian`, `tianjin`, `qingdao`.
