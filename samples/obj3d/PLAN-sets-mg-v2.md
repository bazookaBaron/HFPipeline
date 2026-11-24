# Miniature v2 plan: 10x sets + a 60+ kind MG vocabulary, all generated at runtime (proposal, rev 2, 2026-11-14)

Status: proposal only, nothing built. Pilot = re-cut the Malacca film with its existing voice.
Rev 2 follows the user's notes:
- the vocabulary must have 60+ kinds, at production quality;
- there is no fixed kind count: variety follows the script and the duration;
- the pace is fast, but the camera holds long enough to show every detail;
- nothing is prebuilt: everything is generated at runtime.

## 1. What went wrong in the Malacca film (measured)

| Layer | What the film had | Why |
|---|---|---|
| 3D sets | 3 zones. **30 of 37 world lines sit in the strait set**. Myanmar got 4 lines and Gwadar 1. | Each zone was hand-coded for the film, so I planned only 3 and wrote `[shows:]` to fit them. |
| Shots | "narrows" on 8 lines, "patrol" on 6, "tanker" on 5. | A few fixed framings per subject. No gate measures repetition. |
| 2D MG | **All 28 MG lines are link-board cards**, plus 7 timeline lines. | `mg2d` has 2 layouts. `art.js` is a fixed drawing library, so every beat became "card on a string". |
| Map | 24 lines on one map, mostly from one angle. | One map recipe. |

Root cause: **few hand-made places, 2 layouts and a fixed drawing library, with no variety gate.** The film was fitted to the tools instead of the script.

## 2. What we learn from puppet and Blockworld (research)
- **Puppet** has about 36 component kinds, about 22 map moves, and iso and board modes. A producer storyboard picks a visual per line and layers 3–6 elements per moment. Its variety rule is prose only, with no gate.
- **Blockworld** has a typed registry of 33 MG kinds set per shot in `shots.json` (word-anchored `at`/`until`). It also has real variety gates: an event gap ≤ 3 s, a layer change every 20–40 s, a camera position held ≤ 4 s.
- We take the breadth of the first and the typed mechanics and gates of the second. Neither is copied, and the puppet pipeline stays untouched.

## 3. Principle: generators, never presets ("nothing prebuilt")
- What is not allowed:
  - no prebuilt scenes, templates or set presets ("harbour()");
  - no fixed illustrations;
  - no asset files.
- What the engine is: **grammars and solvers**.
  - A **kind** is a rule for turning the script's data into a layout and a motion plan, solved at load time. Example: "bottleneck" = N items flowing toward a width W, where the item, its count, the width and the scale all come from the beat's data.
  - **Things are drawn from a shape grammar.** A ship comes from hull length, beam, superstructure blocks, cargo kind and a seed. A building comes from footprint, floors, roof kind and a seed. A barrel, a crane or a pipe follow the same idea. So no two films (or two beats) produce the same picture.
  - The current `art.js` drawings and the `kit.js` fixed shapes are retired into that grammar. Existing films keep working on the old files until they are re-cut.
- **The producer step** (Opus, per script) writes only data:
  - `films/<id>/sets.json`: places as compositions;
  - `films/<id>/mg.json`: one kind per MG beat, with its data and word anchors.
- The engine solves everything else at runtime:
  - set layout, object placement, camera framings;
  - MG layout, element shapes, timing to the voice, sound cues.

## 4. Sets: about 10x (one place per 1–3 lines)
- **A set is a composition, not a preset.** It is built from four parts:
  - ground (terrain profile, coast, water, relief from a seeded heightfield);
  - structures (shape-grammar buildings, quays, towers, pipes, roads, rails, bridges);
  - movers (shape-grammar ships, vehicles, trains, aircraft, mannequins in place);
  - atmosphere (weather, time-of-day light, fog, sea state).
- **The producer plans a place per line before writing `[shows:]`.** About 25–40 sets for 9 min, scaled with the script; there is no quota.
- **Camera framings are solved per set** from its subjects: wide establishing, low lateral, top-down, push-through, orbit, rack focus. Repeats are avoided across the film.
- **Pace:**
  - something new lands about every 1 s: a ship enters, a crane moves, a label pops, light changes;
  - the camera itself stays within the existing speed caps and holds each detail long enough to read;
  - dense means more happening, not a faster camera.

## 5. MG vocabulary: 60+ kinds, production quality
Every kind is a runtime generator in the paper/miniature style. Text is small captions only, never headline type.

| Family | Kinds (68) |
|---|---|
| **Numbers (12)** | object counter (number built of objects); odometer; illustrated bars (stacked objects as bars); grouped bars; line chart with an annotated event; area / stream chart; donut / share ring; waffle / unit grid; pictogram row; gauge / meter; thermometer scale; range / error band ("2/3 to 4/5") |
| **Comparison (10)** | A vs B split; scale line-up; size-of circles; before/after wipe; ranking swap; slope chart; dumbbell / gap chart; tally board; balance scale; Venn / overlap |
| **Process and mechanism (12)** | particle flow through pipes; bottleneck / funnel; step rail; conveyor; cause→effect dominoes; feedback loop; branching tree; Sankey flow; valve / switch; cutaway cross-section; exploded view; layered stack |
| **Space and geography (10)** | flat paper map with routes; route race (two routes, distance counters); inset locator; choropleth paper map; flow-arrow trade map; pin chain; distance ruler across a place; elevation profile (mountain pass); zoom-through (globe → region → port); weather / ice-season band |
| **Time (8)** | timeline strip (have); calendar countdown; clock / day dial; Gantt bars; era bands; day/night cycle; split-flap date; "day N" ticker |
| **Relations and power (8)** | link board (have); org / control chart; chokepoint control ring (who sits where); alliance web; dependency chain; supply-chain tree; tug-of-war; hub-and-spoke |
| **Documents and evidence (8)** | annotated document (highlight + margin notes); receipt / cost breakdown; ledger / invoice; stamped permit; ship manifest; contract clauses; small quote card (podium, no face); data-source footnote card |

- **Layering:** a beat can combine 2–4 kinds on one canvas, for example a flat map + distance ruler + object counter. The producer picks kinds by meaning, beat by beat. The count per film follows the script, with no quota.
- **Production quality, as rules and checks:**
  - shared style tokens: palette, ink weights, paper grain, two-tone fills, soft contact shadows, one red focus;
  - 3 depth layers with parallax;
  - eased motion with overshoot only where it fits, plus secondary motion such as settling and drips;
  - every element enters and exits on purpose, nothing pops or vanishes;
  - each kind is reviewed as a moving clip at 1920x1080 before it enters the vocabulary.

## 6. Gates (no render until they pass; existing gates unchanged)
- **Set variety** (scaled by script, not a fixed number):
  - distinct sets ≥ lines / 3;
  - no set over 12% of world time;
  - ≤ 3 lines in a row in one set;
  - the same framing + subject used at most twice.
- **Shot similarity:** a perceptual hash of one still per line; two non-adjacent lines looking ≥ 0.9 alike fail.
- **MG variety:**
  - no kind over 20% of MG time;
  - never the same kind twice in a row;
  - ≥ 2 elements landing per MG beat;
  - an MG beat lasts 4–12 s.
- **Pace:**
  - a new element lands every ≤ 1.5 s;
  - no static frame over 2 s, except planned holds before a payoff;
  - camera speed stays within the coast2 caps (already enforced).
- **Map:** ≤ 4 lines in a row on the 3D map; the 3D map takes ≤ 20% of runtime.
- **Generated-only check:** the page loads no image, model or audio-asset files, and no fixed scene or drawing code (grep plus a network log).

## 7. Default pipeline changes
- **`MINIATURE-PLAN.md`:**
  - flow: script → producer (`sets.json` + `mg.json`) → picture → gates → render;
  - the targets in §4–6;
  - the "generators, never presets" rule;
  - the voice defaults from Malacca: `gap: 1.2`, `chgap: 3.3`, the sound-alike table.
- **Script writer:** gets the kind families and the set grammar, so lines are written to be shown in varied places and ways.
- **Memory:** `miniature-v2-direction` (saved). `miniature-format` and `miniature-2d-mg` will point to it after the build.

## 8. Order, time and cost
1. **Engine, one-time.** Opus does the grammar core, the producer schema, the gates and the review. Sonnet builders, at most 4 at once, then work in parallel:
   - (a) shape grammar for objects + set composer;
   - (b) MG kinds: numbers + comparison;
   - (c) MG kinds: process + time;
   - (d) MG kinds: space + relations + documents.

   Each builder delivers moving test clips; I review them for 2 rounds against the style tokens. Estimate: 6–9 h of wall time. It is token-heavy, so I check usage before each wave.
2. **Pilot:** re-plan Malacca on the existing voice; gates; 2 rounds of contact sheets plus clips; render about 40 min.
3. **Report before/after:**
   - sets: 3 → ~30;
   - MG: 2 kinds → whatever the script needs from 68;
   - worst repeat: 8 lines → ≤ 3;
   - generated-only check: pass.
