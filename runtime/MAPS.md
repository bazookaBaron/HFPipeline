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
Copy `runtime/geo/geo.js` (570 KB, built by `node runtime/maps_build.js`; geo.json is the same data) next to the page.
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
