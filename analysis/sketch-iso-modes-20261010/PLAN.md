# Plan: "Sketch" (p5.brush) + "Iso" (hairline) animation modes

Date: 2026-10-10 · Scope: reels (1080x1920) + long-form (1920x1080) · Theme: poster-monochrome

## 0. Why

Today every spoken line becomes its own 3–6 s clip that clears:
- builder helpers auto-exit at each line boundary (`out/longform/tsmc/src/common-a.js:4-21`);
- the puppet gestures every 2.4 s from a 12-item rotation (`runtime/lf/lf-kit.js:177`);
- entrances are almost all pop/slam/drop/whip at 0.2 s (`lf-kit.js:50-57`);
- no world or camera moves exist, apart from `V.cam` and map zooms.

The two new modes add the opposite grammar: **one persistent drawing that grows over 15–90 s**. The narration adds to it, the camera travels across it, and nothing is thrown away.

| Mode | Source | Look | Best for |
|---|---|---|---|
| `sketch` | p5.brush 2.2.3 (MIT), standalone WebGL2 build | Pencil, marker and charcoal line work, hatching, watercolor accent wash | Concepts, causal chains, whiteboard explanations, annotated maps/timelines, "how X works" |
| `iso` | hairline 0.5.0 (MIT), `HL` kernel only | Isometric hairline engineering drawings | Systems, layers/stacks, exploded views, servers, request flow, supply chains, buildings |

## 1. What the repos actually give us (and what they don't)

### p5.brush
- **What fits:**
  - The standalone build needs no p5 and has a deterministic Mulberry32 seed: `brush.seed(n)` and `noiseSeed(n)`.
  - Brushes: `HB`, `2B`, `pen`, `rotring`, `marker`, `charcoal`, `cpencil`.
  - Drawing: `spline` (with pressure), `circle(x,y,r,irregularity)`, `hatch`, `mass`, `wash`, watercolor `fill` + `fillBleed`.
  - Primitives return their geometry (`Polygon`/`Plot`).
- **Gaps:**
  - **No progress parameter.** A stroke always draws whole. A truncated stroke gets a different taper, so per-frame partial drawing looks wrong.
  - Output is **always opaque**, so we must draw on the paper colour.
  - Spectral colour mixing darkens the accent where it overlaps ink.
  - Heavy fills take seconds per frame under CPU GL.
- **Conclusion:** use it as a **raster ink engine**. Bake each element once, then animate the reveal with GSAP-driven masks along the element's own path. This is seek-safe, cheap to render, and looks exactly like being drawn.

### hairline
- **What fits:**
  - The `HL` kernel (`skills/hairline-create/kernel.js`) has pure geometry: `Cam(az,k,S)`, `proj`, `rrect`, `rings`, `prism`, `fillet`, `hull`, `solid`, `put`.
  - Painter's-order SVG, `non-scaling-stroke`, and a palette made entirely of CSS variables.
  - No WebGL.
- **Gaps:**
  - The 33 npm figures are **pointer toys**: `requestAnimationFrame`, springs, and only ~4–12 s of interest each.
  - No timeline, no assembly animations, no text, a fixed 5:4 viewBox, and camera motion only in `turntable`.
- **Conclusion:** **don't use the npm figures.** Vendor the kernel's pure geometry and write our own state → SVG renderer driven by GSAP tweens.
  - When GSAP seeks, the state is set, then the scene redraws. That makes it seek-safe without hairline's replay clock.
  - Assembly, extrusion, explode and orbit become ordinary tweens.

## 2. Theme lock (both modes must obey). HARD RULE, user 2026-10-10

Both new modes must look like the rest of our videos, not like p5.brush or hairline's own demos. Mirror the existing kit (`runtime/theme.js`, `lf-kit.js` css):

- **Background:**
  - The video hue's `--bg` / `--deep` / `--pale`, with the dot grid (`radial-gradient` 2px dots / 40px). Never white or "plain paper", never the library default.
  - Iso full-bleed = hue bg + dot grid.
  - Sketch = a paper card (`--paper` fill, 6px ink border, radius 26, `10px 10px 0 var(--shadow)` hard shadow) on that bg.
- **Iso solids:**
  - Faces are `--paper` (top), `--pale` (left side), `--bg` (right side), giving flat poster shading, no gradients.
  - Silhouette is ink #111 at ~5px; inner creases are ink at ~2.5px.
  - Each solid casts a hard offset shadow polygon in `--shadow`, matching the card shadows.
  - Highlight part = `--marker` top face. Failure = `--alert`.
  - Hairline's thin grey look is **not** used: our stroke weight is thick, like the 6px outlines.
- **Sketch strokes:**
  - Ink #111 (`pen` / `2B` / `marker`), weight comparable to the 6px kit outlines.
  - Fills/washes only in `--pale` / `--bg` / `--marker`.
  - Highlights (underline, ring) in `--marker`; ✕ in `--alert`.
  - No other colours, ever.
- **Type:**
  - Labels are our DOM chips/cards (Anton + Inter, ink border, hard shadow), placed via projected anchors. Never library text, never brushed text.
- **Puppet:** same rig, same colours, on screen in every block.
- **Enforcement:**
  - Colours come only from the `Theme` object at runtime.
  - `boardcheck.js` samples rendered frames and fails if any pixel cluster falls outside the theme palette (± AA tolerance).

(The table below details the token mapping. Where it says paper bg / hairline grey, the rule above overrides it.)

| Token | Sketch | Iso |
|---|---|---|
| Paper `#FBF7EE` | `brush.clear('#FBF7EE')`; baked PNG is opaque paper | `--hairline-plate:#FBF7EE` (plates mask what's behind them) |
| Ink `#111111` | `HB`/`pen` outlines, `2H` hatch | `--hairline-edge:#111111` |
| Mid / dim | ink at 55% opacity for secondary lines | `--hairline-mid:#4a4a4a`, `--hairline-lo:#cfc8b8` |
| Accent = video hue `bg` (from `Theme.next`) | `marker` / `mass("pastel")` / `wash(hue,60)`; **only one accent element live at a time** | `--hairline-hi:<hue.bg>`; one `hi` solid at a time (hairline's own rule matches ours) |
| `--marker` / `--alert` | Underline/circle highlights use marker; ✕ uses alert, same as now | Pulses/flow dots use hue; failures use alert |
| Type | Labels stay in DOM (Anton/Inter), never brushed text | Labels in DOM via projected anchors |
| Stroke weight | `scaleBrushes(2.6)` for 1080p, `wiggle(0.6)` | `--hairline-stroke: 2.6` (LF) / `3.2` (reel) |
| Background | Dot grid stays under DOM; sketch board is a paper card **or** full-bleed paper (pick per scene) | Same |

- `runtime/theme.js` gains `Theme.sketch(hue)` and `Theme.iso(hue)`. They return the brush config and the CSS-variable block, so builders never pick colours by hand.
- A lint rejects any hex in sketch/iso scene files that isn't from the theme.

## 3. Architecture

```
runtime/vendor/p5brush/     brush.esm.js + LICENSE (pinned 2.2.3)
runtime/vendor/hairline/    kernel.js (geometry subset) + LICENSE (pinned 0.5.0)

runtime/sketch/
  bake.js        puppeteer-core: scene spec → per-element PNG layers + paths.json
  sketch-kit.js  in-composition: mounts layers, builds SVG reveal masks, GSAP verbs
  SKETCH.md      builder doc (short; the only thing builders read)

runtime/iso/
  iso-kit.js     state→SVG renderer on HL geometry + GSAP verbs + DOM label anchoring
  parts.js       our library of iso parts (see §5)
  ISO.md         builder doc

runtime/scene/
  board.js       persistent "world" + camera (pan/zoom/orbit), shared by both modes
```

### 3a. Sketch pipeline (bake once, then reveal)
1. The builder writes a **scene spec** (JSON-ish JS): a list of elements, each with `id`, `kind` (line/spline/arrow/rect/circle/hatch/wash/underline/ring/icon-path), geometry in board units, brush, colour token, `seed`.
2. `node runtime/sketch/bake.js scene.js` launches headless Chrome with GPU ANGLE (SwiftShader as fallback). For each element:
   1. `brush.clear(paper)`, then `brush.seed(base+i)`, then draw, then `render()`.
   2. Export a PNG, and turn paper into transparent with a colour-key → alpha pass. This works around the opaque compositor.
   3. Also emit the element's **reveal path**: the polyline from the returned Plot/Polygon, or the hatch-wipe vector or radial-bloom centre.
   - The bake is cached by hash of (spec, seed, lib version), so re-renders are free.
3. `sketch-kit.js` places each PNG on a large **board** (e.g. 4000×2400 for LF) as an `<image>` inside SVG. It masks it with:
   - **stroke reveal:** `<path stroke-width=brushW*2.2 stroke-dasharray>` that GSAP animates `stroke-dashoffset` along. The line gets drawn in pen order, with natural ease and pressure.
   - **hatch reveal:** a rect wipe perpendicular to the hatch angle, slightly ragged.
   - **wash reveal:** a radial bloom mask with feTurbulence edge, the watercolor "soak".
   - **erase/redraw:** a reverse dash for "crossing out" and corrections.
4. Verbs (all return GSAP tweens anchored with `LF.at(words, line, "word")`):
   `S.draw(id, dur)`, `S.hatch(id)`, `S.wash(id)`, `S.underline(id)`, `S.ring(id)`, `S.arrow(from,to)`, `S.cross(id)`, `S.label(id, text)` (DOM type-on), `S.hand(on)` (optional pencil-tip cursor riding the dash head, which gives a strong "being drawn" feel).

### 3b. Iso pipeline (live SVG, GSAP-driven state)
- The scene is a list of **parts** with state: `{x,y,z, w,d,h, lift, explode, hi, open, rot}`.
- One `iso.redraw()` reprojects everything with `HL.Cam(az,k,S)` and re-paints back-to-front. It is hooked to the timeline via a zero-length `onUpdate` on a proxy tween, so a seek gives an exact frame.
- Built-in motion = plain tweens on state:
  - `I.rise(part)`: drop in from z+400, with a small settle.
  - `I.extrude(part)`: h 0→h, so the "building grows".
  - `I.explode(group, gap)`: layers separate along z.
  - `I.stack(parts)`: sequential lid-on-lid.
  - `I.flow(path, dots)`: dots travel on dashed links, the hairline `relay` look but timed.
  - `I.hi(part)`: the accent swap (the only colour change).
  - `I.orbit(az0→az1)` and `I.zoomTo(part)`: real camera moves. The camera is just `Cam` params on the timeline.
  - `I.label(part, text, side)`: a DOM callout pinned to `proj(anchor)`, with a leader line drawn hairline-style.
- 16:9 vs 9:16: compute `S` and the fit from the frame, not the 400×320 viewBox. For reels, use a taller `k` (more top-down) so stacks read vertically.

### 3c. Persistent board + camera (the "long single animation" core)
- `board.js` owns one world per **scene block**, typically 20–90 s in LF and 8–20 s in reels. It exposes `cam.to(region, dur)`, `cam.follow(id)`, `cam.pull()` (reveal the whole board at the end), and the iso orbit.
- Elements are **never auto-exited**. Instead:
  - **dim:** the old parts go to `lo`/ink 35%, so attention moves on but context stays.
  - **cross/erase:** for corrections.
  - **pan away:** the camera leaves the old area.
- The end of a block = a pull-back to the full drawing, then a hard cut or a page turn into the next block.
- Motion budget comes from the drawing itself: there is always a stroke being drawn or the camera drifting. That satisfies `measure.py` moving-% without filler gestures (EMGAPS/PUPGAPS stay off inside these blocks).

## 4. How it fits a video

| Format | Usage rule (proposal) |
|---|---|
| Long-form (8 min) | Every video is a mix of all three: 2–4 sketch/iso blocks per video, each 30–90 s. They cover the "mechanism" chapters, while hook, stats and photo-real story beats stay on the current kit. The full-body puppet stands beside the board and `pointScreen`s at the camera target (an existing API). |
| Reel (≤1.5 min) | Every reel is a mix: a kit hook, then 1–2 blocks of 10–25 s as the explanation core, then the kit/endcard close. The puppet is present, in the lower zone pointing up at the board. Frame 0 still obeys the hook rule: never an empty page. Reel pacing (2–3 events/s) is met by stroke-heavy reveals, and every word anchor adds a stroke. |
| Carousel "animation" mode | Optional, later: use the final baked board / iso still as a slide visual. |
| Thumbnail | Optional illustrated variant built from a baked sketch layer, with no AI. This fits the existing no-AI poster rule. |

Choosing a mode per topic (producer, in STORYBOARD.md):
- **iso:** anything physical or architectural, e.g. chips/fabs, data centres, networks, layers, pipelines, cities, logistics.
- **sketch:** anything abstract or causal, e.g. economics loops, how an algorithm decides, history cause → effect, comparisons, maths intuition.
- **kit (current):** hooks, numbers, quotes, real photos, maps.

## 5. Starter part libraries (theme-locked, reusable)

- **Sketch:**
  - Shapes and connectors: box, pill, circle-node, cloud, cylinder (DB), arrow (straight/curved/loop), bracket, flow-loop (cycle of 3–5 nodes), axis + hand-drawn curve.
  - People and objects: stick-person, coin, document, gear, lightbulb, chain.
  - Highlights: underline, ring, ✕, check.
  - Each is a param fn that returns elements plus reveal paths.
- **Iso:**
  - Infrastructure: slab, tower, server-rack, chip/die, wafer, layer-stack, phone-teardown, building, factory (saw-tooth roof), warehouse, container, truck.
  - Connections and data: link (dashed), pipe, conveyor, bar (3D bar chart from data!), coin-stack, globe-ring.
  - Ported or adapted from hairline's `exploded`/`cabinet`/`stack`/`relay`/`slow` geometry, but timeline-driven.
- Target: ~15 parts each in phase 2. Then grow the library whenever a topic needs a new part, and add it back to the library, not to the topic folder.

## 6. Pipeline changes

1. **SKILL.md (make-video):**
   - Add a "Modes" table to §4 (reel) and §6 (LF) with the selection rules.
   - Builders for a sketch/iso block read **only** `SKETCH.md`/`ISO.md`. That keeps it token-lean, in line with the playbook.
2. **STORYBOARD/BRIEF beat table:**
   - New block header `## BLOCK b2 · iso · 0:42–1:58 · board: fab-floor`.
   - Rows: `line → build step → camera → label → sfx`.
3. **Builders:** a new `common-scene.js`. It replaces `common-a.js` auto-exit for block windows. Outside blocks nothing changes.
4. **SFX:** new cues `pencil`, `marker`, `chalk-tap`, `paper-turn`, `iso-thunk`, `whoosh-soft`.
   - Sketch reveals emit **continuous** pencil cues for the stroke duration, as `{t,k,dur}`.
   - `mix.py` gets a looping-texture synth for `dur` cues.
5. **build.js / lf-kit:**
   - Inline the `sketch-kit`/`iso-kit` only when a chapter uses them.
   - Run `bake.js` as a pre-step in `finish.sh` and the reel build, with the cache.

## 7. Quality gates

- **Gate changes:**
  - `strays.js`: board layers carry `data-board`. Exempt them from the occlusion probe (masked images would false-flag), but keep stray checks on DOM labels.
  - `measure.py` / `gate.py`: per-block profile `--profile board`. Moving % counts drawing and camera moves. Max still is ≤1.5 s inside a block, except the final pull-back hold of ≤2.0 s.
- **New `boardcheck.js` gate:**
  1. Every element is revealed before its block ends (no orphan baked layers).
  2. No two accent elements are live at once.
  3. Labels don't overlap strokes, using projected bbox vs the layer alpha bbox.
  4. Theme-hex lint.
  5. Reveal speed ≤ X px/s, so strokes never "pop".
- Plus the existing HyperFrames `check` (0 overlaps) and the no-stray-dots rule.

## 8. Phases

| Phase | Deliverable | Exit test |
|---|---|---|
| **0. Spikes** | (a) p5.brush standalone baking in our Chrome: GPU vs SwiftShader timing for a 30-element 1080p board. (b) Confirm the HyperFrames 0.8.46 render path is happy with large SVG masks + `<image>`. (c) Iso proxy-tween redraw under seek. | Bake <60 s/board; seek to random t gives identical frames on 2 runs; render fps not worse than current LF ×1.5 |
| **1. Sketch kit** | vendor, `bake.js` + cache, `sketch-kit.js` verbs, 15 sketch parts, `SKETCH.md` | 45 s demo board in theme, gates green |
| **2. Iso kit** | vendor kernel, `iso-kit.js`, 15 iso parts, labels, orbit, `ISO.md` | 45 s demo: data-centre build-up + request flow |
| **3. Board + camera** | `board.js`, dim/cross/pull-back, `common-scene.js`, SFX `dur` cues | One 90 s LF block with zero auto-exits; measure.py `board` profile passes |
| **4. Pipeline** | SKILL.md modes, storyboard format, gates (`boardcheck.js`, strays exemption), finish.sh bake step | Producer → builders → finish with no manual steps |
| **5. Pilot** | 1 reel (iso) + 1 LF with 2 blocks (1 sketch, 1 iso); compare retention vs recent uploads | Your review; then default-on rules |

- Phases 1 and 2 are independent, so they can run as two parallel builders after phase 0.
- Phase 0 is the only real unknown: WebGL in the capture Chrome, and render cost.

## 9. Risks

- **Headless WebGL2 is slow or unavailable:** this only affects the bake step, never the frame render, and it's cached. The fallback is SwiftShader (slower, still offline).
- **Accent darkening from spectral mixing:** draw accent elements in their own bake layer, never over ink in the same pass.
- **Long blocks get boring:** require a camera or "new idea" change every ≤8 s inside a block, and a dim or reveal every ≤3 s in reels.
- **Token cost:** builders only see the docs + parts API. Parts live in the library, not re-authored per topic.
- **Licence:** both MIT. Keep the LICENSE files in `runtime/vendor/*`.

## 10. Decisions (locked 2026-10-10)

1. **Every video mixes all three:** current kit + sketch + iso, all in the poster-monochrome theme. No video is single-mode. The producer assigns a mode per block in STORYBOARD.md, at authoring time, from the topic.
   - Default LF mix: kit for the hook, stats, photos and maps; 1–2 sketch blocks; 1–2 iso blocks.
   - Default reel mix: kit hook → one sketch or iso core block (both if the topic fits) → kit/endcard close.
   - Transitions between modes are camera moves on the shared board where possible, e.g. the iso world shrinks into a sketch frame, or a kit card lands on the drawing. They are not hard resets.
2. **The puppet is on screen in sketch/iso blocks, in reels and long-form alike.** It's the channel mascot.
   - LF: full-body, beside the board, `pointScreen` at the camera target.
   - Reels: the board takes the upper ~70%, and the puppet stands in the lower zone pointing up. The puppet layer is exempt from the board occlusion probe.
   - Auto-gesture rotation is off inside blocks. Gestures are tied to build steps (point at the new part, `present` on pull-back).
3. **Background:** full-bleed paper for iso; a paper card on the dot grid for sketch.
4. **Pencil-tip cursor:** on for sketch only.
5. **Pilot topics:** none fixed. The mode split is decided at runtime from the topic the user shares (iso for physical/system beats, sketch for abstract/causal beats, kit for hook/data/photos).

## 11. Phase 0 results (2026-10-10). PASS, both modes

| | Sketch (p5.brush) | Iso (hairline geom) |
|---|---|---|
| Theme | On-theme. Exception: camera zoom ≥1.3 hides the hue bg (f_33), so zoom must be capped | On-theme. 98% of world pixels sit on theme tokens |
| Prep | Bake of 30 elements: 10.7 s GPU, 14.9 s SwiftShader, cached | none |
| Render | 6.9 s per video-second (≈1.4–1.8× LF baseline) | 4.1 s/s with `--workers 4` (≈1.06× baseline) |
| Determinism | 10/10 identical (forward seek, the renderer's order) | 14/14 identical in any seek order |
| Gates | check 0 errors, strays clean | check 0 errors, strays clean |

Seek hook for iso needs all three layers: timeline onUpdate + render patch + reactive state, because HyperFrames proxies `gsap.timeline()`.

### Phase 1 punch list
- **Board / camera:**
  - Cap zoom so the card edge and hue bg are always visible.
  - Puppet keep-out zone of about 340 px.
  - Reel camera fill: world at ≥70% height, not 55%.
- **Sketch:**
  - Bake only each element's bbox readback; add GL mode to the cache key.
  - Stronger washes (gain, or use `--bg`).
  - Pre-drawn frame 0 for reels.
  - Better doodle parts: coin, tag and person look generic.
  - A marker-tip cursor for washes.
- **Iso:**
  - Place labels against projected solid outlines, not just other labels.
  - Route links around solids, or raise them as pipes.
  - Painter's sort for large footprints.
  - Bigger detail parts when zoomed.
  - Always render with `--workers N`.
- **Gates:**
  - `data-board` exemption in `strays.js` occlusion.
  - `tools/palette.py` becomes `boardcheck.js`.
- **Known debt:** puppet forearm `off_pivot_rotation` warning.

Spike code: `spike-sketch/`, `spike-iso/`. Both render `comp/out.mp4`; the iso spike also has `comp-reel/out.mp4`.

## 12. Subject-visibility rule. HARD RULE, user 2026-10-10

Whatever the narration talks about (the subject: a car, a bay, a building, a server) must be clearly visible from the camera for the whole time it is narrated.

- **Subject per beat:** each beat in the storyboard declares a `subject` part id.
- **Camera auto-frame:** `I.focus(subject, t)` frames the subject. Its whole bbox must be on-screen, inside the safe area (outside the puppet zone, not under chips), at a minimum size of ~6% of the frame (LF) or ~8% (reel).
- **Occluders:** any solid in front of the subject is x-rayed (faded, or drawn outline-only) during the focus window, then restored.
- **Highlight:** the subject gets the `--marker` highlight; the rest of the world dims slightly.
- **Gate:** `subjectcheck.js` runs at each focus window, sampling every 0.25 s. It requires 100% of the subject on-screen, the size threshold met, ≥85% of the subject unoccluded (elementsFromPoint sampling), and no overlap with the puppet zone. A failure fails the build.
- **Also applies to:** the vector diagram board (subject = the node or arrow being narrated) and kit beats.

## 13. Dense-world spike results (2026-10-10). PASS, with fixes needed

- **What exists:** `spike-iso-dense/` with `city(seed)` (508 statics) and `parking(seed)` (321 statics, 48 bays). A seeded traffic sim gives cars lanes, signals, spacing, parking and reversing. `WK.focus` x-rays occluders.
- **Gates:**
  - Determinism 14/14 on all three comps.
  - `check` 0 errors.
  - `strays.js` clean.
  - `subjectcheck` 56/56, 81/81 and 56/56. Without x-ray, the hidden car is 0% visible, so the gate works.
- **Render:**
  - City 12.5 s/s, lot 8.6 s/s, city reel 11.2 s/s. That is 2–3× the simple iso spike.
  - A 60 s city block takes about 10–12 min to render.
- **Fix list:**
  1. Statics on one canvas per camera azimuth: the main speed lever.
  2. Small subjects (cars, bays) must not be zoomed ~20× (`city-31.5`, `lot-12` lose all context). Use a size-tiered minimum (car ≥1.5–2% of frame) plus marker highlight, chip and pin. Keep context visible.
  3. X-ray draws every inner line of the occluders, which reads as wireframe clutter. Draw silhouette-only ghosts.
  4. The world is hard-clipped at the puppet zone (vertical cut at x≈1560). Let the world run behind the puppet instead; the camera framing keeps the subject clear of it.
  5. Traffic-light red uses `--alert`. Acceptable; small.
  6. Never-catch-at-check bug: HyperFrames compile drops extra `<style>` blocks, so kit CSS must live in JS. The rendered-frame review must be part of the gates.
- **Next worlds, cheap with the same generator pattern:** highway, port, factory, airport.

## 14. Build step 1 done (2026-10-10): runtime iso kit

- **Files:**
  - `runtime/iso/{iso-kit,worlds,subjectcheck,seektest}.js`
  - `runtime/ISO.md` (49 lines)
  - `runtime/vendor/hairline/`
  - Demos in `build-iso/`
- **Render:** city 4.3 s/s, parking 3.8 s/s. Requires `--workers 4 --no-browser-gpu`.
- **Gates:** all pass. Determinism 14/14; subjectcheck 52/52 and 62/62, failing correctly with `--noxray`; `check`, strays.
- **Fixes:** all five §13 fixes are in.
- **Open issues:**
  - Parking `leaveAt` events don't fire.
  - Keep orbits short (100–190 ms/frame).
  - Tall-tower x-ray ghost lines are a style call.
- **Next:** step 2. Diagram board (vector), kit tweaks inside blocks, make-video skill and storyboard wiring.

## 15. Build step 2 done (2026-10-10)

- **Diagram board:** `runtime/board/board-kit.js` and `runtime/BOARD.md`. Gates pass on LF and reel: seek 14/14, subject 72/72, `check` 0, strays clean. Render 2.5 s/s.
- **Parking:** the leaver fix is in.
- **Wiring:** `LF.puppet {quiet}` added; make-video SKILL §3b mode mix wired.
- **Polish to do in the pilot:**
  - Dimmed node text shows a paper box behind it (`comp-lf-12.0`).
  - The LF board is sparse and calm (zoom only 1.1–1.2×). Use bigger nodes and more parts per board.
  - The camera pan half-clips parts at the card edge (the coin).
  - `B.cross` / `B.check` untested.
  - The final re-render after the last CSS edit was not run.
