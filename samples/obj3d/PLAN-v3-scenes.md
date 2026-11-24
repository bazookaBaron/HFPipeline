# Miniature v3 plan: scenes with people, not buildings (proposal, 2026-11-14)

Status: proposal, nothing built. User decisions 2026-11-14: figures are posed but never animated (camera-only motion stays); figure cap 0.35 in room scenes; dollhouse cut-away approved; SFX sourced from Openverse (CC0/CC BY) and vetted by Earshot through the existing `dialogue/sfx/tools` pipeline. It is based on frame-by-frame reviews of the Nvidia, Trump and China films and an engine audit. The evidence is in `out/review/{nvidia,trump,china}/`: contact sheets, full-resolution frames and measurements.

## 1. What is wrong (measured)

| | Nvidia | Trump | China |
|---|---|---|---|
| World lines that are "one red building" | 45 of 51 | ~43 of 50 | 34 of 55 |
| Same domed `govHall` used as the focus | 18 lines | 21 lines (22% of runtime) | 11 lines |
| Interior shots | 0 | 0 | 0 |
| Seated, walking or acting figures | 0 | 0 | 0 |
| Lines that needed a human, room or action scene | ~30 | ~25 | ~22 |
| 2D MG share | 30% | 41.5% | 40.4% |
| SFX cues that come from something on screen | 0 (all UI) | 0 (all UI) | 0 (all UI) |
| Stretches over 6 s with no cue | 29 | 27 | 7 (longest 22 s) |
| Chapter breaks | 3.3 s near-silent holes | 2.8 s holes | 2.6 s holes |

Root causes (in the code, not in the films):
1. **Everything outdoors.** The world is outdoor terrain at 1 unit ≈ 20 m, and all 12 ground kinds are outdoors. There is no room, wall cut-away or furniture. A mannequin is about one storey tall, so a person can never be the subject.
2. **Figures are rigid statues.** Each is one merged mesh with 4 standing poses. `GEN.people` gives random headings, so figures never face each other or a table. Nothing moves.
3. **The camera aims at one object, and its distance is clamped to at least 14 units.** It always frames from far out.
4. **The variety gate counts place ids, not looks.** So 18 domed halls pass as 18 different sets.
5. **SFX library and routing.** The library has 53 sounds, made for a campfire dialogue show (owls, fire, gravel steps). Cues fire only on MG events. Beds are picked from the ground kind, so lake lapping plays under Washington and pine wind under Senate hearings.
6. **MG problems:**
   - each beat has only one part, leaving empty paper;
   - some beats open on an empty frame;
   - the camera crops headers;
   - icons sit over labels;
   - meaningless values appear ("0 UNITS", "= 1 errors");
   - layouts repeat (podium quote ×4, paper documents ×4–5);
   - every beat is a hard cut from the 3D world to beige paper.

## 2. Target look: "dollhouse documentary"
The same white matte miniature world with one red focus, tilt-shift and soft contact shadows, plus three new scales:

| Scale | What it is | Used for | Share of world time |
|---|---|---|---|
| **Room** (1 unit = 1 m) | A dollhouse cut-away: floor plus 2 walls, the walls toward the camera removed. Windows with light shafts, doors, partitions. A second room can sit beside it, cut like a stage. | Boardroom, hearing room, courtroom, hotel suite, diner booth, newsroom, office floor, trading floor, lab, factory line, mill floor, troll-farm desks, control room | **≥ 35%** |
| **Street / plaza** (1 unit = 2–5 m) | Pavements, crowds, vehicles, building fronts as walls | Rally, press scrum, market aisle, protest, airport gate, courthouse steps, a walk-out with boxes | ~25% |
| **Place / landscape** (today's scale) | Coasts, cities, ports, fabs, mountains | Geography, scale, logistics | ≤ 40% |

People rules:
- The red focus can be a person or a pair.
- Recurring characters are built as mannequins with a fixed silhouette per person (build, a hat or hair-block shape, a coat colour tone, one prop), so viewers can follow "Jensen" and "Alice" with no faces.
- People are posed mid-action and frozen like a diorama: seated, mid-stride, pointing, shaking hands, on the phone, typing, carrying boxes, applauding, a raised hand, a raised gavel. Nothing animates; the camera reveals the scene.
- The camera stays slow and smooth (coast2 caps kept). Pace comes from the camera revealing new details (a 2–3 stop path through the room), light changes and MG callouts.

## 3. Engine work (all generated at runtime, nothing prebuilt)
| # | Build | Where | Effort |
|---|---|---|---|
| A | **Room grammar:** shell, cut-away walls, windows, doors, partitions, multi-room, and an exterior→interior "cross-section" transition (the camera pushes into the building's cut face) | new `sets/rooms.js`; `interior` ground kind in `composer.js`; scale-aware camera clamp and framings in `film.html` `shotFor` (eye-level, high corner, top-down plan, along-the-table, doorway) | 2–3 days |
| B | **Furniture and prop grammar:** tables (long, round, booth), chairs, desks with screens, podium with microphones, judge's bench, witness box, jury box, bed, sofa, counters and stalls, workbenches, assembly line, spinning frames, server racks, flags, phones, laptops, papers, boxes, passports, cameras | new `sets/furniture.js` | 1.5 days |
| C | **Posable mannequin (static):** a procedural skeleton (hip, knee, shoulder, elbow, neck) posed once at build time, with no animation: seated, mid-stride, running pose, pointing, handshake pair, phone, typing, carrying, applauding, gavel, speaking, embrace. Character silhouettes per person. | rewrite `kit.js` `person`; new `poses.js` | 1.5 days |
| D | **Group staging solver:** around a table, audience facing a speaker, facing pair, queue, crowd (Poisson fill with a heading field), press scrum, procession, rally, a bench row. Headings follow sightlines. | new `sets/groups.js` | 1.5 days |
| F | **Scene archetypes as rules** (a room plus furniture plus a group form plus an action script, all seeded): boardroom, hearing, courtroom, press conference, hotel room, diner, newsroom, office, lab, factory line, market, rally, airport, trading floor, parliament, control room, plus generic ones. **Landmark variety:** onion domes or a walled kremlin, a columned courthouse, a brutalist ministry, a hotel tower, a glass HQ. | new `sets/archetypes.js`; `grammar3d.js` | 2 days |
| G | **Group or person as focus,** with red on the key figure; framing based on the group's bounding box | `composer.js` framings, `film.html` | 1 day |
| H | **World-event SFX:** each scene's content emits cues as the camera reveals it (footsteps, chair, door, gavel, stamp, typing, phone, shutter, crowd, applause, engine, train, horn, machinery). Beds are chosen by scene type (room tone, office, crowd, traffic, harbour, factory). Chapter breaks get a music swell and a whoosh into the next section. | `film.html` sound export; `audio/mix.py`; new needs in `dialogue/sfx/tools/needs.json` → Openverse search/download → Earshot vet → build (a new miniature section of the library, CC BY credits in CREDITS.md) | 1 day + ~1 day sourcing |
| I | **MG upgrade:** at least 2–3 parts per beat (beats layer kinds); no empty opening frame (content lands within 0.4 s); safe-area crop gate during camera travel; icon-over-label gate; meaningful-value gate (no 0 or "= 1 errors"); person icons for people; a world→paper bridge (the paper slides in as a tabletop or wall poster inside the room, or a match-cut from a red object) | `mg2d/core.js` stage, `kindgate.mjs`, `film.html` | 2 days |
| J | **New gates** (no render until they pass): world time in **room or street scenes ≥ 50%**; any one structure generator ≤ 8% of world time; a perceptual-hash check (two non-adjacent shots ≥ 0.9 similar fail); every "person did X" line shows people (a producer tag checked by the line gate); ≥ 1 world SFX per world line; no gap over 4 s without a cue; MG ≤ 35% of runtime | `film.html` gates, `render.mjs` | 1 day |

Total: about 12–13 builder-days. That is about 2–3 days of wall time with 4 builders in parallel (A+B, C+D+G, F, H+I+J), followed by 2 review rounds on moving test clips of 6 archetype scenes before any film is re-cut.

## 4. Producer changes
- The planner tags each line as **person / room / street / place / data**. It picks a room or street scene for any line where someone meets, says, sues, signs, flees, works or decides. MG is for numbers and mechanisms only.
- Each scene gets a short action script ("Kress stands, walks to the podium; flashes; she reads"), and the engine schedules it against the voice.

## 5. Re-cut order
The voice is kept, so no new TTS is needed. Order: Nvidia (most human story) → Trump → China. Each gets new plans, gates, 1 contact-sheet round and a render (about 30–40 min each, one at a time through jobq).

## 6. Decisions (answered 2026-11-14)
1. No figure animation: poses only, camera-only motion.
2. Figure cap 0.35 in room scenes (no close-ups, no faces).
3. Dollhouse cut-away approved.
4. SFX from Openverse + Earshot via `dialogue/sfx/tools`.
