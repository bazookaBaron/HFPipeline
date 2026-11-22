# DIALOGUE pipeline: plan v4 (2026-11-09)

The look, colour, type, acting, camera, motion graphics and anti-slop rules are in
**STYLE-GUIDE.md**. This file covers assets, the pipeline, the build order and the cost.

Each episode is one deep conversation between two low-poly characters, sitting in a reused
night set. The camera follows the speaker. Medium-paced "field notebook" motion graphics
carry the facts. The sound is soft: voice, room tone and quiet music. One build gives 9:16
and 16:9.

---

## 1. Assets you downloaded (checked 2026-11-09, extracted to `.vendor-assets/dialogue/raw/`)

| Pack | Licence | Verdict | Why |
|---|---|---|---|
| **Ultimate Modular Men** (Adventurer, Beach, Casual_2, Casual_Hoodie, Farmer, King, Punk, Spacesuit, Suit, Swat, Worker) | CC0 | **KEEP: main cast** | Faceted low-poly adults with real proportions. Separate head/body/legs/feet on one skeleton, finger bones, eyes and eyebrows as separate parts, a Humanoid Rig version. King's head gives an old man with white hair and beard. |
| **Ultimate Nature** (birch/common/pine/willow trees, rocks, moss rocks, TreeStump, WoodLog, bushes, grass, flowers) | CC0 | **KEEP: sets** | Same faceted look as the cast. Stumps and logs become seats, and rocks plus logs become the fire pit. |
| **Universal Animation Library** (Standard) | CC0 | **KEEP: animation only** | It has `Sitting_Idle_Loop`, `Sitting_Talking_Loop`, `Sitting_Enter/Exit` and `Idle_Talking_Loop`. Its UE-mannequin skeleton needs a one-time retarget onto the Modular rig (a bone-name map in three.js). |
| Ultimate Animated Character Pack (chibi, black faces) | CC0 | drop | The style is too game-like for deep conversation and doesn't match the adults. |
| Universal Base Characters (Standard) | CC0 | drop | The free tier has only the 2 Superhero bodies, in a different style. Its Hair_Beard is a spare if needed. |

These 3 packs are all from one artist and one look. Poly Haven is **removed**: its
realistic props clashed with this style.

## 2. Still needed (you download; all Quaternius, CC0, free)

| Pack | For | URL |
|---|---|---|
| Ultimate Modular Women | `meera` (same rig and style as the men) | https://quaternius.com/packs/ultimatemodularwomen.html |
| Survival Pack (53 models, list not published) | campfire props, maybe a tent, pot, lantern | https://quaternius.com/packs/survival.html |
| Ultimate Buildings Pack (76 modular buildings) | the distant city below the hill, windows lit by the engine | https://quaternius.com/packs/ultimatetexturedbuildings.html |

If the Survival pack has no campfire or bench, those pieces are arranged from Nature
rocks and logs (placement only, nothing modelled). Flames are a light-and-particle effect.

**Sound, for later:** room tone (fire, crickets, wind, city hum) from Freesound with the
CC0 filter (needs your login), and 6–8 soft free music beds. I'll give exact links in
phase 4.

## 3. Sets (minimal: 2)

**`campfire`** (dadu + rohan)
- clearing ringed by PineTree_1–5 and CommonTree_1–5 (instanced, 3 depth rings)
- the fire pit is a ring of Rock_1–7 with WoodLogs inside
- seats: TreeStump_Moss for dadu, WoodLog for rohan
- Bush, Grass and Flowers scattered by seeded placement
- night sky dome with stars, and a moon rim light
- key light: the fire (flicker)

**`hilltop`** (arjun + meera, or any pair)
- grass hill edge built from Rock and Grass
- a single CommonTree for shape
- bench from Survival or Furniture, or a WoodLog seat as fallback
- below: a city grid of Ultimate Buildings blocks at 300–900 m, windows as emissive
  points that switch on and off rarely
- dusk-to-night sky gradient dome

Each set stores, once:
- seat anchors in metres
- camera rigs for both ratios
- the light setup
- the palette (STYLE-GUIDE §2)

## 4. Motion graphics template kit (built once)

The pace is one new beat every 6–10 s, with MG on screen about 60–70 % of the time. All
templates follow STYLE-GUIDE §6.

| Tag | Shows | Data the script gives |
|---|---|---|
| `map` | country/state/city outline, pin, zoom, route line, two-place compare | `place=`, `to=`, `zoom=`, `label=` |
| `number` | count-up with unit and context line | `value=`, `unit=`, `context=` |
| `timeline` | 2–6 dated points drawn left to right | `points=[year:label,...]` |
| `compare` | then/now or A vs B columns | `left=`, `right=` |
| `bars` | 2–6 bars growing, one accent bar | `items=[label:value,...]`, `focus=` |
| `list` | 2–4 points revealed | `items=` |
| `quote` | one line in Geist with an underline draw | `text=`, `by=` |
| `photo` | duotone archival photo with Ken Burns and caption | `query=` or `file=`, `caption=` |
| `diagram` | 3–5 nodes with arrows (cause → effect) | `nodes=`, `links=` |
| `icons` | 2–5 paper-line icons that build up (Lucide/Tabler) | `icons=`, `labels=` |
| `scale` | size or amount comparison (dots, squares) | `a=`, `b=`, `unit=` |
| `chapter` | title card at `#part` breaks | `title=`, `n=` |

- **Maps:** Natural Earth (public domain) admin-0/1 shapes, plus OSM-derived city points.
  Each map is rendered as paper-line SVG.
- **Photos:** a fetcher pulls from Wikimedia Commons / Openverse using only
  PD/CC0/CC-BY images, logs the licence and credit, and duotones them to ink + accent.
  No AI images.
- When an episode needs a new kind of graphic, it gets added as a new template once. It
  is never drawn just for that one episode.

## 5. Runtime (three.js inside HyperFrames)

- **Deterministic.** Every frame is a function of t: `AnimationMixer.setTime(t)`, seeded
  noise for fire, embers and wind, and no `Math.random`. This reuses the HyperFrames +
  three.js bootstrap and `render.mjs` from `vangogh/engine`.
- **Rendering.**
  - Toon ramp material (3 steps) and flat normals.
  - One key light (fire or city) with soft shadows, plus a moon or sky rim.
  - Height fog for the depth layers.
  - Post (pmndrs/postprocessing, MIT): bloom on emissive only, film grain, vignette, and
    DOF only on MS shots.
- **Characters.**
  - Assembled from modular parts at load, with colours from STYLE-GUIDE §3.
  - Sitting loops from the Universal Animation Library, retargeted.
  - A procedural layer for look-at, nods, lean and breath.
  - Eyes and eyebrows moved for blinks, brows and gaze.
- **Multi-camera.** One scene renders to several render targets: the main camera, plus
  the A and B strip cameras for the 16:9 `split` layout. The MG is HTML/SVG on top in the
  same HyperFrames timeline.

## 6. Episode flow (trigger: `DIALOGUE: <topic>, <set>, <length>`)

Each episode runs in a new chat. The orchestrator only sends a start message and a finish
message.

1. **Producer agent** (fresh context) writes:
   - `script.md` with speaker lines, emotion tags and inline MG cues
   - `#part` marks for shorts
   - `facts.json` with sources for every MG number or claim
2. **Script check (local).** The MG density gate (one beat every 6–10 s), the
   no-verbatim-repeat check and the 12-word card limit run here.
3. **Voice (0 tokens, detached):** CosyVoice 3, one take per turn, then words.json and
   `words.ready`.
4. **Compile (0 tokens).** Cuts come from speaker turns, gestures from emotion tags and
   stressed words, MG timing from the cue positions, then the HyperFrames comp for both
   ratios.
5. **Media (0 tokens):** maps rendered, photos fetched and duotoned, licences logged.
6. **Sound (0 tokens):** room tone, music bed by mood with auto-ducking, and the mix.
7. **Gates (local, 0 tokens):**
   - palette histogram
   - safe areas
   - frozen-frame detector
   - the speaker in key light and in frame
   - MG on-screen ratio
   - text overflow
   - seat and ground contact
8. **One look:** one contact sheet for 3D and one for MG, then render both ratios through
   jobq. Shorts are cut at `#part`.

## 7. Build order (plan first, then pictures, then pipeline)

| Phase | Work | Gate before moving on | Est. weekly % |
|---|---|---|---|
| 0 | Asset audit render: turnaround sheet of the 4 assembled characters plus the nature props under the toon shader. Retarget test of `Sitting_Talking_Loop`. | You approve the cast look | 1–1.5 % |
| 1 | **Hero frames** (STYLE-GUIDE §9): 3 stills plus one 8 s moving test (campfire, dadu speaking, one map MG, 9:16 + 16:9) | You approve the look and MG style | 2–3 % |
| 2 | Sets finished (campfire, hilltop), camera rigs, life layers | Contact sheet | 2 % |
| 3 | Acting layer, dialogue compiler, layouts, gates | 30 s test passes the gates | 3–4 % |
| 4 | MG kit (12 templates), map renderer, photo fetcher, sound mix | MG sheet vs style guide | 4–5 % |
| 5 | Pilot: one 60 s short, end to end, cost measured | You approve it | 1–2 % |
| | **One-time total** | | **~13–18 %** |

Nothing goes past phase 1 until you approve the hero frames. That is the anti-slop
checkpoint.

## 8. Cost per episode (estimate, to be measured on the pilot)

| Item | Weekly % |
|---|---|
| 45–75 s short | 0.5–1 % |
| 8 min long-form, both ratios, medium-paced MG | **2–3 %** |
| Short cut from a long-form | ~0.1 % |

- **Where the tokens go:** almost all to the producer: research, script, MG cues and
  facts. Everything after that is local code.
- **What would raise it:** fix rounds, new sets, new templates (0.5–1 % each, once), or
  drawing bespoke MG per episode (not allowed).
- **Wall time** (not measured yet): voice about 10–20 min for 8 min. Render is the unknown
  (WebGL + post, 2 ratios); it gets measured in phase 1.

## 9. Risks

- **Faces are minimal** (eyes and brows only, no mouth). Emotion rests on body, camera and
  MG. The phase 1 moving test shows whether it lands.
- **Retarget quality** of the Universal Animation Library sitting loops onto the Modular
  rig is not tested. Fallback: the Modular pack's own clips plus procedural sitting.
- **King head crown** may be welded into the hair mesh. If hiding its material leaves a
  hole, use the Universal Base Characters Hair_Beard on another head.
- **The city** from the Ultimate Buildings pack may need a darker re-tint to sit at night
  distance.
- **Render time** for 8 min × 2 ratios is unknown until phase 1.

---

## 10. Phase 1 plan: campfire v2 + close camera (2026-11-09, after the user's phase-0 notes)

The user's notes on phase 0:
- they float and aren't sitting on the log
- more tree and environment density, planned properly because the set is built once
- camera much closer, like the reference reel
- both layouts as in the sketch
- fiery ashes in the air

### 10a. What I measured in the reference reel (`200 applications…mp4`, 9:16, 80 s, frames every 2 s)
- **Shot mix:**
  - about 55 % medium close-up (MCU) of the speaker: head and chest fill about 60 % of the
    frame height, a three-quarter view, eyes at about 35 % from the top, camera a little
    below eye level, background soft and blurred
  - about 35 % over-the-shoulder (OTS): the listener's back or shoulder large and dark in
    the near corner, the speaker mid-frame
  - about 10 % wide or establishing, only at the open and at resets
- **Cuts:** on speaker change, with shots of 2–6 s. Inside a shot the camera barely moves
  (a slow push or drift).
- **9:16 MG layout:** a dark data card in the top ~45 %, and the OTS two-shot in the bottom
  ~55 %, so both faces stay visible. This matches the user's sketch.
- **Captions:** one short phrase at a time (2–6 words), in a cream serif, centred around
  25 % from the top. Below the MG card when it's showing.
- **Set density:** every frame has foreground, midground and background layers, and
  practical lights (fairy lights, a lamp, a window glowing with city lights). No empty
  floor anywhere in frame.
- **Ending:** a black card with a question and "Follow for Part N".

### 10b. Seating, a hard fix
- Seat height is measured, not estimated. The skinned mesh is posed in the sit pose and
  its bounding box computed with the bones applied (GPU-matching). The pelvis is then
  placed so the underside of the thighs lies on the seat top within 1 cm, and the feet
  sit on the terrain within 1 cm.
- rohan's log lies across his facing direction (perpendicular), and he sits on top of its
  centre. dadu sits on the stump's flat top (the bark spike is excluded by measuring the
  top face).
- **Contact gate:** in every rendered frame, gaps between thigh and seat and between foot
  and ground are 1.5 cm or less, and nothing pokes through. It fails loudly otherwise.

### 10c. Campfire set v2: dense, planned once (metres; fire at the origin)
- **Ground:** a faceted low-poly terrain (gently noise-displaced), not a flat plane.
  Vertex colours: packed dirt within 3 m of the fire, mixed grass from 3–8 m, dark forest
  floor beyond. A soft, warm light pool from the fire's real falloff (no decal ellipse).
- **Clearing (0–6 m):**
  - fire pit of Rock_1–7 with the Bonfire + Bonfire_Fire inside
  - seats about 1.7 m from the fire
  - a firewood stack (WoodLog ×4) beside dadu
  - Pot on two rocks at the fire's edge
  - Axe leaning on the stump
  - Backpack and WaterBottle near rohan
  - Tent 4.5 m behind and to the left, glowing faintly
  - Grass_Short and Flowers clumps at the clearing edge
- **Ring 1 (6–11 m):**
  - 16–20 trees (PineTree, CommonTree, BirchTree, Willow), scale 0.85–1.3, seeded
    rotations
  - Bush_1–2 and BushBerries
  - Plant_1–5 ferns
  - Rock_Moss
  - a fallen WoodLog_Moss
  - TreeStump
- **Ring 2 (11–22 m):** 35–45 trees, more pines, denser undergrowth, fog starts.
- **Ring 3 (22–50 m):** 70+ trees as silhouettes in heavy fog, giving a layered treeline.
- **Sky:** a clear opening above the clearing shows stars (seeded twinkle) and a moon disc
  behind rohan for the rim. Canopy edges frame the opening.
- **Camera-aware dressing:** every camera rig (10d) is checked so its frame has foreground,
  mid and background layers. Foreground framing comes from out-of-focus grass, a branch
  or a rock corner.
- **Fire life:**
  - flame mesh scale and light flicker (seeded noise, 2–6 Hz)
  - **embers:** 80–140 particles rising with curl-noise drift, in orange `#F2A03D` →
    ember `#D65F2A` → dark. Sizes 2–6 px, with lifetime fade, additive blending and
    bloom. A small spark burst every 6–12 s.
  - thin smoke wisps with very low alpha, drifting with the wind
- **Wind:** grass, bushes and branch tips sway (vertex shader, low amplitude).

### 10d. Camera rigs (from the reference, for both ratios)

| Rig | Framing | Lens (full-frame equivalent) | DOF |
|---|---|---|---|
| `mcu_A`, `mcu_B` | speaker head + chest, 3/4 toward camera; camera beside the listener, 10–20 cm below eye level | 40–50 mm | on, background bokeh with fire glow |
| `ots_A`, `ots_B` | listener's shoulder and back of head dark in the near corner (20–30 % of frame), speaker mid-frame facing camera | 35 mm | foreground soft |
| `wide2` | establishing: both seated, fire centre, tent and trees around | 28 mm | none; used at the open and at `#part` only |
| `insert_fire` | close on flames and embers, for MG breathers | 50 mm | on |

- **Move inside a shot:** push 3–5 % over the shot, or a 2–4 cm drift, eased with
  sine.inOut. Cuts happen on speaker change; shots last 2–6 s.

### 10e. Layouts (user's sketch + reference)
- **9:16 `stack`** (when MG is on screen):
  - MG card at y 6–44 %
  - captions at about 47 %
  - the scene at y 50–100 %, showing `ots_<speaker>` so both people stay in view
- **9:16 `full`** (no MG): `mcu_<speaker>` or `ots`, with the caption at about 26 %.
- **16:9 `split`:**
  - MG centre card, 56 % wide
  - left strip = `mcu_A`, right strip = `mcu_B`, each 22 % wide, live
  - the listener's strip dimmed 15 %
  - caption under the MG card
- **16:9 `full`:** `wide2` / `mcu` / `ots`, caption at the lower third (about 78 %).

### 10f. Captions (new, from the reference)
- Phrases of 2–6 words, cut from words.json at natural breaks.
- Geist SemiBold, cream `#EFE6D4`, with a soft dark shadow (no box).
- They fade in over 120 ms and fade out over 100 ms. No karaoke and no per-word pop.
- Never over a face, and inside safe areas.

### 10g. Phase 1 deliverables (campfire only; hilltop in phase 2)
1. `hero_wide_16x9.png`, `hero_wide_9x16.png`: the establishing shot.
2. `hero_mcu_dadu_9x16.png`: full layout, with a caption.
3. `hero_stack_9x16.png`: map MG card (India → Kolkata pin, paper-line style) on top, with
   `ots_dadu` below (rohan's back in the foreground) and a caption.
4. `hero_split_16x9.png`: map MG centre, with the mcu strips left and right.
5. `test_8s_9x16.mp4` and `test_8s_16x9.mp4`: dadu talks with a gesture on the stressed
   word, rohan listens (a nod and blinks), embers, a slow push, one cut to `mcu_dadu`, the
   map card drawing on, and caption phrases. **Silent** (no voice yet; timing comes from a
   dummy words.json).
6. `contact_gate.txt`: seat and foot gaps for every frame.

**Cost estimate:** 2–3 % of the week. One builder plus my review.

---

## 11. Phase 2 plan: 3 more sets + the full cast (2026-11-09)

The user's brief: "cinematic, hill view, pine trees, starry skies, deep talk". The approved
campfire look (spike1, round 3) is the bar. All sets reuse the same engine, cast, face
layer and gates.

### 11a. Engine refactor (do first)
- Move spike1 into `dialogue/engine/`:
  - `world` core (renderer, toon look, post, gates, acting, face layer, camera rigs, layouts)
  - `sets/<id>.js` as pure data plus small set-specific effects
  - `cast/` as it is now
- One command renders any set and rig in either ratio.
- MG stays a separate layer behind a fixed interface (§12c). The sets builder never edits
  MG code.

### 11b. The four sets (campfire already exists)

| id | Pair | Picture | Key life |
|---|---|---|---|
| `campfire` | dadu + rohan | **done** (spike1) | fire, embers, smoke |
| `hilltop_city` | arjun + meera | a bench at the grassy edge of a hill at night. Below and far away (300–900 m), a city grid of Ultimate Buildings with warm and cool window lights, a road with slow car light streaks, a few pines framing the edge, starry sky, a thin moon | window flicker (rare), car light streaks, wind in the grass, stars twinkling |
| `pine_ridge` | any pair | a rocky ridge among tall pines. The pair sit on a boulder or a fallen log at the edge, looking over a deep valley with layered pine ridges in fog. A **Milky Way** band across the sky. Cool and lonely | drifting fog layers, a slow star field, a shooting star at most once a minute, wind in the pines |
| `lake_shore` | any pair | a pebble shore of a still mountain lake. The pair sit on an upturned log by a moored **Raft**, with pines on both banks and a far ridge. The moon and stars reflect in the water | water shader (gentle ripples, broken moon reflection), fireflies near the reeds (≤ 12), a light mist on the water |

- **Assets:** Quaternius only (Nature, Survival: Raft and WoodLog; Buildings). Water,
  fog, stars, the Milky Way and light streaks are effects, which are allowed.
- **Per set:** palette (STYLE-GUIDE §2 style; one warm accent per set), seat anchors, rigs
  (`wide2`, `mcu_A/B`, `ots_A/B`, plus one set insert: city, valley, or moon on the water),
  fg/mid/bg dressing per rig, and life layers.
- **Same gates:** contact, penetration, and speaker face lit and in frame.

### 11c. Cast completion
- arjun and meera get the same face layer, seat fit and acting as dadu/rohan. They sit on
  the hilltop bench, the bench being Rock + WoodLog or a Survival prop (no new assets).
- Any pair can sit in any set. Seat fitting is per character, per seat.

### 11d. Deliverables (phase 2)
- Per new set: `hero_wide_16x9`, `hero_wide_9x16`, `hero_mcu_<A>_9x16`, `hero_ots_16x9`.
- One `cast_lineup.png`: all 4 characters × 3 expressions in the hilltop light.
- Contact and penetration gate logs.
- Render-time note.

---

## 12. Motion graphics: a runtime-first system (user, 2026-11-09)

The user's note: "don't overfit on motion graphics; we mostly might need to make MG at
runtime". So we do **not** build a rigid 12-template kit. We build a small,
well-made **primitives library plus an authoring API**. Each episode's MG is then written
at runtime as short code that composes primitives. The style rules (STYLE-GUIDE §6, with
the Geist fonts) live inside the primitives, so whatever gets written still looks
on-brand.

### 12a. Primitives (built once, in `dialogue/mg/`)
- **Frame:** the ink panel with border and radius, the label tag, and safe-area aware
  layout boxes for every layout (9:16 stack/full, 16:9 split/full).
- **Text:** title, label, caption, number (Geist / Geist Mono), with reveal styles
  `fade-up`, `wipe` and `count`.
- **Line art:** stroke-draw paths, arrows (open chevron), underline, bracket, connector.
- **Shapes:** dot, ring, bar, block, dot-grid (like the reference reel's "3 / 100" grid),
  progress, divider.
- **Geo:** a map projection from Natural Earth admin-0/admin-1 (already downloaded), with
  outline draw, region fill, pin plus label, route arc, and a zoom/pan camera.
- **Media:** a photo frame with duotone to the palette and Ken Burns (licensed images
  only), plus icons (Lucide, ISC, as paper-line).
- **Charts:** bars, line, compare columns, timeline axis. All are built from the shapes
  above, not separate templates.
- **Motion:** easing presets (STYLE-GUIDE §6 durations), stagger, a hold-drift helper and
  enter/exit pairs following the vector law. **Everything is a pure function of t**
  (seek-safe); no wall clock and no random.

### 12b. Authoring API (what runtime code looks like)
```js
mg.beat({at: 12.4, dur: 6, layout: 'auto'}, (b) => {
  const m = b.map({focus: 'IN-WB', from: 'IN'});
  m.pin('Kolkata', {label: 'Kolkata · 1947', at: 1.2});
  b.caption('This road was a field.', {at: 0.3});
});
mg.beat({at: 19, dur: 5}, (b) => b.dotGrid({total: 100, lit: 3, label: 'apply alone'}).compareWith({lit: 40, label: 'with a referral'}));
```
- A beat is one card. `layout: 'auto'` picks stack/split/full by ratio.
- The producer writes these beats per episode, a few lines each. New visual ideas get
  written as new compositions at runtime; only a pattern that keeps coming back gets
  promoted into a primitive.

### 12c. Interface with the 3D engine
- `dialogue/mg/index.js` exports `createMG({root, ratio, palette, fonts})` and returns
  `{ beats, seek(t), activeLayout(t) }`.
- `activeLayout(t)` tells the engine when to switch the scene to stack/split and back.
- The engine calls `seek(t)` every frame.

### 12d. Deliverables
- `dialogue/mg/` library plus `README.md` (API, about 1 page).
- `mg/examples/`: 6 short example beats rendered as stills and one 12 s clip per ratio:
  - map zoom + pin
  - dot-grid compare
  - number count + context
  - timeline
  - photo duotone (a CC0 or Wikimedia PD image)
  - a free-form composition written at runtime to prove the API isn't template-locked
- A style check against STYLE-GUIDE §6/§8: palette only, Geist only, no bounce, safe
  areas.

### 12e. Cost estimate
- Phase 2 sets: about 3–4 % weekly.
- MG library: about 2–3 %.
- Per episode: MG authoring adds about 10–20k output tokens to the producer, roughly 0.2 %
  for 8 min.
