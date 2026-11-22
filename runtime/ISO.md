# ISO mode (isometric worlds + data-centre parts)

Poster-monochrome isometric scenes drawn on ONE canvas by a pure function of the timeline clock. Files: `runtime/iso/iso-kit.js` (kit),
`runtime/iso/worlds.js` (city/parking generators + traffic sim), `runtime/vendor/hairline/hl-geom.js` (MIT iso maths, `HLG`),
gates `runtime/iso/subjectcheck.js`, `runtime/iso/seektest.js`. Demo comps + `tools/make.sh`: `analysis/sketch-iso-modes-20261010/build-iso/`.

## Set up a comp (copy the demo `tools/page.html.tpl` + `city.js`)
- Page loads, in order: `gsap.min.js theme.js hl-geom.js iso-kit.js [worlds.js] puppet.js`. Head `<style>` holds ONLY @font-face + `#root` size.
  All kit CSS (`.iso-bg` dot grid, `.iso-layer`, `.iso-chip`) is injected by `ISO.init` (HyperFrames compile drops extra style blocks).
- DOM in `#root`: `<div class="iso-bg">`, `<div id="iso" class="iso-layer" style="z-index:3;width:Wpx;height:Hpx" data-board ...>`, `<div id="labels" style="position:absolute;inset:0;z-index:6">`, puppet `#pz` (z 90).
- Scene: `Theme.apply(THEME); const tl = ISO.timeline(); ISO.init(tl, {host:#iso, labels:#labels, W, H, dur}); build world/parts; ISO.cam({...}); verbs; tl.seek(0); ISO.redraw(); return tl;`
- Every tween goes through ISO verbs (state objects + explicit from values). Never read wall time / Math.random. Do not put two camera tweens on the same property at overlapping times (GSAP renders overlaps in seek-direction order; the focus weight is already overlap-safe).

## World API (`WORLDS`, needs worlds.js)
- `WORLDS.city(seed,{blocksX,blocksY,cars,buses,dur,heroBlock,park,far})` / `WORLDS.parking(seed,{dur,cars,buses,heroAt,leaveAt})` -> `{G,sim,hero|lot,...}`; `sim.sample(id,t)`, `sim.occ(t)`, `sim.events`.
- Subjects: `WORLDS.subjectStatic(st)` (tier large), `WORLDS.subjectCar(sim,id)` (small), `ISO.subjects.bay` (parking, small), `ISO.partSubject(part)` (large).
- New world = a generator that calls `ISO.addStatic({fp:[x0,y0,x1,y1], draw(V,out,st,t)->hull, dyn?, shadow?})`, `ISO.addGround(fn(V,out))`, sets `ISO.world.movers=(t)=>[{id,x,y,hd,paint(V,out,m)}]`, `ISO.world.lightFn(node,axis,t)->"g"|"r"`. Draw with `ISO.solid(V,out,ring,z0,z1,{top,L,R,sil,crc,extra,lip,cr})`, `ISO.box/circ/rot` rings, `ISO.windows`.

## Kit API (t = absolute timeline seconds)
- Camera: `ISO.cam({az,k,S,fx,fy,fz,sx,sy})` home (world point fx,fy,fz lands on screen sx,sy; fit the world into the safe box, S = zoom). `ISO.camTo(t,{S,fx,..},{d,ease})`, `ISO.orbit(t,az,{d})`, `ISO.home(t,{d,az?})`, `ISO.zoomTo(partOrPoint,t,{S,sx,sy,d})`.
- Focus: `ISO.subjects[id]=provider; ISO.focus(id,t0,t1,{ramp:1.2}); ISO.label(null,"TEXT",t,{out,dy:-26,fill:"marker",sub:id})`.
- Labels: `ISO.label(at|null,text|fn(t),t,{out,dx,dy,fill,sub,part})` DOM `.iso-chip` + canvas leader pin. `ISO.safe={x0,y0,x1,y1}` clamps chips (keep them left of the puppet).
- Parts (data-centre / diagram objects, drawn above the world): `ISO.floor({x,y,w,d,h})`, `ISO.block`, `ISO.tower`, `ISO.cyl`, `ISO.rack({units})`, `ISO.stack({n,lh,tops})`, `ISO.chip({parent,pins})`, `ISO.link({pts,w,fill})`; all `{x,y,w,d,h,z,r,top,on}`.
- Part verbs: `ISO.show/hide(p,t)`, `ISO.rise(p,t,{from,d,stagger})`, `ISO.extrude(p,t,{d})`, `ISO.explode(stack,t,gap,{d})`, `ISO.drawLink(l,t,{d})`, `ISO.flow(l,t,dur,{n,dir,laps})`, `ISO.hi(p,t,"marker"|"alert"|null)` (one at a time).
- Hooks: `ISO.winLit=(t,phase)=>bool` (lit windows), `ISO.hiFn=(id,t)=>bool`, `ISO.qdt` (window/lamp state step, 0.25 s), `ISO.noXray`, `ISO.minFrac`, `ISO.stats`.

## Focus / subject rule (HARD, PLAN s12)
Whatever the narration names must be clearly visible for its whole narrated window. One `ISO.focus` per narrated subject (cover EVERY beat; one beat = one subject; leave 1.2 s ramps, windows may overlap).
- `ISO.focusSafe={x0,y0,x1,y1}` = where the subject lands; keep it outside the puppet zone (LF: x1<=1480, reel: y1<=1320). Subject bbox fully on screen.
- Min bbox share of the frame by tier (LF/reel): large (buildings, servers) 6%/8%; small (cars, bays) 1.5%/2%. Small subjects keep the surrounding context visible (never zoomed to a wireframe).
- The subject alone gets the `--marker` highlight, chip and leader pin. Anything in front is x-rayed: statics/cars drawn as a thin ink outer silhouette only (no fill, no inner lines).
- The world is never clipped at the puppet: it runs behind it; the camera framing does the work.

## Theme rule (HARD, PLAN s2)
Colours only from the theme tokens `paper pale deep bg shadow marker alert ink` (+ `dot`). Never a hex. Hue bg + dot grid, ink outlines, hard `--shadow` offsets, flat faces
(top paper, left pale, right deep/bg, no gradients). `--alert` only for failure/red signal lamps; `--marker` only for the focused subject / one `hi` part.

## Gates (run before render; all exit 1 on failure)
1. `node runtime/iso/seektest.js <compDir>`  seek determinism (ascending, shuffled, backwards seeks pixel-equal; tolerance = raster noise).
2. `node runtime/iso/subjectcheck.js <compDir>`  every focus beat, every 0.25 s: on-screen, tier min size, outside puppet zone, >=85% unoccluded. (`--noxray` shows what the camera alone would give.)
3. `cd <compDir> && npx --yes hyperframes@0.8.46 check`  0 errors.   4. `node runtime/strays.js <compDir>`  clean.
5. Look at 3 frames per comp (`seektest.js <compDir> --shots 3,12,22`) for: theme, density, subject readable with context, clean x-ray, car/building occlusion, no clip edge.

## Render
`cd <compDir> && npx --yes hyperframes@0.8.46 render --workers 4 --no-browser-gpu -o out.mp4`. Always `--workers 4`. ALWAYS `--no-browser-gpu` for ISO comps: with the browser GPU the
canvas read-back makes capture ~2.2x slower (measured 8.2 -> 3.8 s per video-s on the city intro). `--experimental-fast-capture` fails self-verification here: do not use.
Puppet forearm `off_pivot_rotation` warning is pre-existing: ignore.
Speed model: wide shots at rest azimuth = raster base + sprites (cheap); zoom above `ISO.raster` (default 1.15 x home S) or mid-orbit = vector (crisp, few statics). Orbits re-project every frame (100-190 ms), so keep them short (<= 6 s) and few.
Gotchas: statics are sorted per azimuth by footprint separation (keep footprints axis-aligned, non-overlapping); the sim runs once at load (fixed step), frames only read it.
