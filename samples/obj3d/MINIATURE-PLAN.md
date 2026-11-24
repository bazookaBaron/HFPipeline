# Miniature format: motion graphics + quality-lock plan (2026-11-13)

Status: plan only. The reference film is `samples/obj3d/out/coast2.mp4`, which the user liked: a white miniature
world, red as the single focus colour, one continuous cable-riding camera, all objects coded.

## 1. Rules (apply to everything, world and MG)
- **Look:** one world. MG is built *inside* the miniature, never as flat overlays:
  - same white matte material, sun and shadows;
  - same tilt-shift; red is used only for the current focus.
- **No real images and no AI images.** Everything is code-built geometry plus crisp canvas-rendered text.
- **Pace:** dense, not slow.
  - A new element lands every 0.5–1.2 s.
  - The camera never stops for more than 1.5 s, except on a planned "hold" before a payoff.
  - Easing comes from the motion-doctrine skill: vector law, continuity of direction across cuts, no idle wobble.
- **Mix:** MG is ~35% of runtime. For 9 minutes that's ~3 min 10 s, spread as 25–40 MG beats of 4–9 s, interleaved with
  world shots. There are never 2 MG beats in a row longer than 15 s combined.
- **No close-ups** of mannequins: they stay at 25% of frame height or less. MG objects (cards, digits) may fill the frame.
- **MG must show the mechanism**, never a label-only card. This is the dialogue lesson: a row of labelled boxes is a fail.

## 2. MG vocabulary: parametric components whose content comes from the script
Each component is a code module that takes JSON content. Each film writes only the JSON plus an occasional custom beat.

| Component | What it looks like in the miniature | Motion |
|---|---|---|
| **Link-analysis / string board** | A white board standing in the world. Cards are rounded white tiles with canvas text and simple icon glyphs, held by pins. Strings are grey; the key link is red. | Cards drop in with a short settle and the strings pull taut one after another. The camera slides card to card while the focus band moves with it. Ends on a pull-back showing the whole web. |
| **Timeline** | A long white plinth with year notches. Events are blocks or pillars that rise from it, and the key event is red. Each pillar carries a small diorama object made with kit.js (ship, tower, phone). | A tracking dolly along the plinth. Pillars rise in sync with the camera, the year counter flips (split-flap digits), and the move speeds up toward "today". |
| **Map** | A relief map built from public-domain data (Natural Earth 110m, about 1 MB, download needs OK): land is raised white slabs, sea is lower and pale. | Red routes draw as arcs or tubes with travelling light pulses, the same shader as the cable. Pins pop, highlighted countries extrude up, and the camera pushes across the map with a slow orbit. Distance counters run along the routes. |
| **Physical data** | Bars are extruded white blocks, red for the highlight. Pies are cylinder sectors. Lines are a red tube over a white grid floor. Big numbers are extruded digits. | Bars grow with overshoot, digits count up, and the camera cranes along the chart. |
| **Flow / mechanism diagram** | Process blocks are small white buildings or devices joined by tubes, with packets as small cubes. | Packets travel, gates open, the camera follows the packet (it "rides the packet", like the cable). |
| **Scale comparison** | Objects lined up on a white floor: a cable beside a garden hose beside a person. | A dolly along the line, then a "dolly-zoom" (zoom while moving) for the reveal. |
| **Counters / stats** | Large extruded numerals standing in the world, with shadows. | Flip or roll counting; the camera flies past the digits. |

**Escape hatch:** about 1 in 5 beats may need a custom mechanism (e.g. "how light bounces in a fibre"). Those are coded
per film from the same primitives and the same materials.

## 3. Camera motion set (world + MG)
- **Moves available:**
  - ride-the-path (cable, route, string or timeline acts as the carrier);
  - orbit;
  - crane up and down;
  - top-down slide;
  - push-through: the camera passes through a gap such as a digit or an arch;
  - dolly-zoom;
  - whip-pan with a few frames of motion blur (sub-frame blend, only on whips);
  - rack focus by moving the tilt-shift band;
  - hold-then-push before a payoff.
- **Checks on every frame:** the existing subject-aware system (swing first, then lift, iteratively smoothed).
- **Limit:** blocked frames 0, except at most 2 frames inside a transition.
- **Moves are written as intents** ("ride string from card A to card D, low, left side"), not coordinates. The system solves
  the positions, so camera specs stay at about 20–40 tokens per beat.

## 4. Chapter transitions (1.5–2.5 s, one style per film, chosen in the plan)
1. **Diorama swap:** the camera pulls back until the current set is a block on a white table, the block slides out, the
   next block slides in, and the camera dives in.
2. **Chapter numeral fly-through:** a giant extruded chapter number stands in the world and the camera flies through
   its counter, the gap inside the digit.
3. **Tile flip:** the floor tiles flip in a wave, revealing the next set underneath.
4. **Board pin:** the world shrinks onto a card on the string board, which then becomes the next chapter's card.

## 5. Architecture: low tokens, same quality in a new chat
Stays in `samples/obj3d` until the user says "pipeline".

```
miniature/ (later)
  RUNBOOK.md          step-by-step for any chat ("MINI: <topic>")
  STYLE-GUIDE.md      palette, materials, lights, tilt-shift, sizes, red rule, pacing numbers
  engine/
    kit.js            people, cars, ships (+ trees, boats, planes, props as needed)
    world.js          terrain/diorama slab, water, roads, city blocks, fx (birds, pulses, waves)
    camera.js         intents -> keyframes -> per-frame checks (swing/lift, iterative smooth)
    mg/*.js           board, timeline, map, chart, flow, compare, counter, transitions
    film.js           reads film.json: zones + beats -> one timeline, renderAt(t)
    render.mjs        deterministic frames -> ffmpeg (HyperFrames adapter later, for voice/captions)
    gates.mjs         automatic checks (below)
  golden/             coast2 reference stills + metrics, for regression
  films/<id>/film.json, set.js (the only per-film code), out/
```

**Per-film work (what the LLM writes):**
1. The script.
2. `film.json`: zones, beat list, MG content as JSON, camera intents.
3. `set.js`: the custom set, since the world is built per script.
4. 2–3 review rounds on 12–24 still sheets.

The engine and MG modules are written once and reused. They are vocabulary, not scenery, so they don't overfit.

**Quality lock: automatic checks, no render until all pass**
- Blocked camera frames = 0 (transitions ≤ 2).
- Mannequins ≤ 25% of frame height.
- Red only on focus: a pixel hue scan per beat flags red outside the focus mask.
- Density: some element animates at least every 1.2 s, and a stillness detector flags more than 2 s of a near-static frame.
- Text legibility: every text element ≥ 38 px cap height at 1080 wide.
- MG share between 30% and 40% of runtime; no beat shorter than 3 s or longer than 12 s.
- Mechanism check: each MG beat has a `shows:` field saying what process it depicts. A beat that is only labels fails.
- **Golden regression:** before each film, render the golden stills and compare (SSIM). If the engine changed the look,
  stop and report.

**New-chat behaviour:** a memory entry plus the RUNBOOK make any chat follow the same steps. The RUNBOOK has a "don't"
list taken from this session: hand-placed coordinates, AI meshes for people, flat overlays, close-ups, label-only cards.

## 6. Time and tokens (9 min, 9:16 or 16:9)
| Stage | Estimate |
|---|---|
| Set + MG content build (code + JSON) | tokens: about one set (like the coast) plus about 2–4k for film.json |
| Camera solve + checks | 1–3 min |
| Render (~16,200 frames at 0.11–0.15 s; MG text canvases add a little) | 30–40 min |
| Encode + gates | 5 min |
| **Total machine time** | **~40–50 min** |

The one-time engine build (camera.js, mg/*.js, film.js, gates) is the expensive part. It is a one-off cost, not per film.

## 7. Next step proposal
Build a **60 s, 9:16 test** on the same topic. It reuses the coast world and adds:
- 1 string board: "who owns the cables": companies → routes → countries;
- 1 timeline: 1858 first transatlantic cable → today's fibre;
- 1 map: routes across the oceans (needs the Natural Earth download, about 1 MB, public domain);
- 1 chapter transition.

That gives about 35% MG, all automatic checks running, and a review sheet before the render.
