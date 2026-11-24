# Brief for MG kind builders (miniature v2). Read fully before coding.

Goal: a vocabulary of runtime-GENERATED motion-graphics "kinds" for a white-miniature documentary film (paper + ink + ONE red focus).
The film's producer writes data per MG beat (mg.json): { parts: [{ kind, data }], at: {"part:focusId": seconds} }. The stage (mg2d/core.js makeStage)
lays parts on one big paper canvas and flies a camera through their focus points, timed to the narration.

READ FIRST: mg2d/core.js (tokens P/F/W_INK, ui helpers, ease/seg, rng, stage + kind contract in the header), mg2d/shapes.js header and
`SH` generators (≈62 generated illustrations + SH.icon(g,r,{what})), mg2d/kinds/objectCounter.js (the EXEMPLAR: copy its structure and quality bar),
kinds.html (harness), out/shapes_p1_169_t0.jpg .. p8 (what SH draws).

HARD RULES (user's):
1. NOTHING PREBUILT: no images, no stored drawings, no fixed path data, no assets. Draw only with SH generators + ui helpers + geometry computed from data.
   Every layout is solved from the data at runtime (counts, scales, positions, spacing), with seeded variation from K.rng.
2. NEVER TYPOGRAPHIC: no headline / kinetic-text cards. Text = small captions/labels ON elements (ui.caption, ui.tag, axis labels) and data numerals.
3. DENSE WITH DETAIL, AESTHETIC, NOT AI SLOP. Each kind has at least 3 layers: (a) the main illustrated subject(s) built from SH, (b) an annotation layer
   (ticks, rulers, leader lines, scale keys, small labels, dimension marks), (c) context/secondary motion (ground line, frame, soft shadows, particles,
   settling, small moving parts). Consistent stroke weights, aligned grids, generous but even margins, believable proportions. Palette ONLY from P
   (warm paper, inks, greys, water/sand tints) + P.red for the ONE focus element. No gradients except subtle paper ones. No random decoration.
4. FAST PACE, CALM CAMERA: inside each focus, sub-elements keep landing about every 0.4-0.8 s for ~1.5-2.5 s after at[id] (bars grow, items drop,
   labels pop, arrows draw), then gentle secondary motion. The camera is handled by the stage; your focus boxes must frame each idea so it reads at
   zoom = min(0.78*W/f.w, 0.66*H/f.h): keep focus boxes ~900-1600 wide, ~500-900 high, and caption font sizes >= F.small (28) so on-screen cap >= 21.6 px.
5. Generic, not overfit: every kind must work for ANY topic. `example` = an array of >= 2 cases from DIFFERENT topics (e.g. shipping, energy, health,
   elections, sport, tech). Data fields are documented in the file header. Graceful with 2..12 items, long labels (wrap/shrink), missing optional fields.
6. API: export default { name, family, doc, example: [...], build(data, K) -> { w, h, focus:[{id,x,y,w,h}], draw(g, t, at, K) } }.
   draw must be a pure function of t (seekable in any order), never blank before the first at[], and must not mutate shared state.
7. Register each kind in YOUR family file(s) only (mg2d/kinds/_<family>.js). One file per kind: mg2d/kinds/<kindName>.js. Do not edit core.js/shapes.js
   (if you need a helper, write it inside your kind file; if SH lacks a thing, compose it from SH parts + ui).

TEST + SELF-REVIEW (mandatory):
- Stills: TAG=<kind> node mg2d/render2d.mjs still kinds 1,3,5,8 "ar=16x9&kind=<kind>" (cases: add &case=1). ONE render at a time.
- Moving clip for at least every 4th kind: TAG=<kind> node mg2d/render2d.mjs video kinds 30 "ar=16x9&kind=<kind>"; inspect frames.
- Layering test: kinds.html?kinds=a,b (two of yours on one canvas).
- Read every still. Ask: would a senior motion designer at a top explainer studio ship this? Is it dense enough? Anything cropped, overlapping,
  misaligned, empty, crude, off-palette, or more than one red? Fix. At least 2 full review rounds; a 3rd on your weakest 5.
- Report (<= 300 words): kinds built (name + 1-line), data fields per kind (short), still paths, honest weakest list.

