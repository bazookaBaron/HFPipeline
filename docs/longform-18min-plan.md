# Long-form 18 min @ 6–8% weekly budget — FULL PLAN v2 (nothing implemented)

Locked decisions (user): procedural 3D only (no AI stills), low-poly style like the train-crossing reference, camera fully inside
the world (no visible diorama base/sides), cinematic camera moves city -> character from a new angle, highlight characters while
narrating, premade cards on scene, no puppet, script quality NOT compromised, goal = many quality videos/day for fast monetization.
Targets are targets, not promises; Phase 0 measures reality.

## 1. Hardware verdict (i5-13420H, 16 GB RAM, RTX 4050 6 GB, ~56 GB free disk)
- **GPU works for this.** An earlier spike in this repo (`analysis/sketch-iso-modes-20261010`) already logged headless Chrome using
  GPU ANGLE (`--use-angle=d3d11`) on this machine: bake 10.7 s GPU vs 14.9 s SwiftShader. Low-poly flat-shaded 1080p is light for an RTX 4050.
- **Constraints to design around:** 6 GB VRAM -> instanced meshes, small/no textures, no 4K; 16 GB RAM -> render one chapter at a time,
  cap workers; 56 GB disk -> bake cache needs a size cap + cleanup (18 min @1080p frames are large; keep MP4/ProRes-lite, not PNG sequences);
  laptop thermals -> plugged in, expect clock throttling on multi-hour renders.
- **Unknown (Phase 0 must measure):** whether HyperFrames' own frame-capture Chrome uses the GPU for WebGL. Design avoids depending on it (see §2).

## 2. Architecture: bake 3D shots, composite overlays
Live 3D inside the HyperFrames capture would make every render slow and every fix expensive. Instead:

1. **World layer (Three.js, offline bake, GPU):** `runtime/world/bake.js` renders each 3D shot from its params to a clip
   (`shots/<hash>.mp4`) **plus `anchors.json`** (per-frame screen position of every named target: person#1, landmark, ship…).
   Cache key = hash(params) -> identical shots are reused across chapters/videos (cost 0 the second time).
2. **Overlay layer (HyperFrames/GSAP, existing kit):** the baked clip is a video layer; cards, chips, labels, lower-thirds, maps, charts,
   stat counters, real photos, captions sit on top and **pin to `anchors.json`** (card follows the highlighted person/landmark).
3. **Audio:** unchanged (voice.py -> words.json; sfx/music via finish.sh).
4. **Manifest drives both layers.** Claude never writes camera math, timings or GSAP.

Deterministic + seek-safe: bake is a pure function of params; overlays use existing seek-safe GSAP timeline.

## 3. Shot model (what one manifest beat can say)
```json
{"l":42, "world":"nyc-midtown", "time":"dusk", "weather":"clear",
 "cam":[{"to":"skyline","angle":"high-wide","dur":3},{"to":"person#1","angle":"low-side","dur":3,"ease":"glide"}],
 "focus":{"on":"person#1","fx":"spot+dim"},
 "cards":[{"kind":"lowerThird","text":"Manhattan, 1.6M people","pin":"person#1","on":"Manhattan"},
          {"kind":"stat","v":"8.3M","label":"New Yorkers","on":"eight"}]}
```
- `on:"word"` -> compiler resolves to time via `words.json` (existing `LF.at`). No manual timing.
- `cam` = waypoint list of **named targets x angle presets**; rig does spline path, easing, look-at blend, collision-free height clamps.
- **No visible edges:** oversized ground plane, haze/fog tinted to scene palette, skyline/terrain ring beyond the playable area, camera
  bounds clamp, mild tilt-shift/DOF. A `edgeguard` check samples frames and fails if background-void color appears.
- **Focus/highlight:** spotlight + dim others, rim outline, ground ring, slow-mo ramp, optional zoom; card pinned to anchor.
- **Presets:** angles `high-wide, aerial-orbit, flyover, dolly-in/out, street-level, low-side, over-shoulder, top-down, crane-up`;
  times `dawn, day, golden, dusk, night`; weather `clear, haze, rain, snow, fog`; mood palettes (calm/tense/triumphant).

## 4. Style bible (written BEFORE any asset; every asset must pass it)
Flat-shaded low-poly, chunky readable shapes, warm limited palette per mood (3–5 hues + accent), soft directional light + soft shadows,
AO-lite, subtle bloom on lit windows, motion blur on fast vehicles, consistent human proportions, no textures except shared gradient atlas.
Deliverable: `STYLE.md` + palette JSON + reference renders. One art direction = recognisably "our channel".

## 5. Asset library (build once, priority order = user order, humans pulled forward)
| # | Pack | Contents | Params |
|---|---|---|---|
| 1 | Core | manifest schema, compiler, lint, camera rig, lighting presets, edgeguard, bake+cache, anchors | — |
| 2 | **Humans (early)** | low-poly characters, walk/idle/point/talk/sit cycles, skin/hair/outfit variants incl. regional dress, instanced crowds, highlight FX | region, outfit, age, action |
| 3 | City packs | procedural block/skyscraper/street grid, traffic, lights; styles: new-york, chinese, indian, filipino, gulf, japanese, european, african | style, density, height profile |
| 4 | Landmarks (top 10–15) | Empire State, Statue of Liberty, Burj Khalifa, Taj Mahal, Eiffel, Great Wall, Big Ben, Colosseum, Pyramids, Petronas, Marina Bay… | id, scale |
| 5 | Terrain | mountains (ranges, snow), river/delta, ocean/coast, desert, forest, farmland | biome, season |
| 6 | Transport | train, car/bus/truck, ship (container/tanker/cruise), port/cranes, airport/plane, helicopter | route spline, speed |
| 7 | Animals | birds (flocks), fish, cattle, horses, camels, elephants… | species, herd size |
Each asset ships with: params in `MANIFEST.md`, a 10 s test bake, perf number, named camera targets.

## 6. Cards and overlays (premade, no per-video code)
Reuse existing poster components (lowerThird, statCounter, quoteCard, timeline, ranking, comparison, barChart/lineChart, imageFrame,
chip, stamp, map inset via `maps.js`) + new: **callout pinned to anchor** (line + tag), **name tag**, **fact card**, **mini-map inset**,
**route overlay on map**, **photo polaroid pop** (real photos still come from `images.js`). Cards animate in/out with `verbs.js`; all
styled in the style bible. Each card kind = props schema in `MANIFEST.md`.

## 7. Making 18 min fluent, not boring
- Structure (~3,250 words at 1.25x): hook 0:00–0:45 (spectacle shot + question) -> ~16 chapters of ~60 s. Chapter template:
  **orient (map/world wide) -> character moment (camera glides to person, focus+card) -> evidence (photo/stat) -> data/chart -> payoff**.
- Avg shot 4–7 s; every shot has camera motion OR overlay event; one "wow" camera move per chapter.
- Seams: exit vector of shot N = entry vector of N+1 (existing `motion-doctrine` Seam Gate), carrier elements across cuts.
- **pacelint (zero tokens):** fail on shot >9 s without change, same world/preset 3x in a row, 12 s with no overlay event, chapter without
  data/map beat, repeated card kind back-to-back, avg shot length out of range.
- Variety comes from combinations: world x style x time x angle x focus x cards => hundreds of distinct shots from the library.

## 8. Pipeline per video (18 min)
1. Producer (Opus): 8–10 searches -> `facts.json`; `script.txt` (+chapters), `slots.json` (photos). Script quality untouched.
2. `voice.py --cb-tempo 1.25` (detached). Test 60 s sample first: voicecheck/prosody thresholds were calibrated 1.0–1.15; chapter-pause gate >=2.6 s. Fallback 1.15–1.2.
3. `images.js` (scripted, unchanged).
4. **autodirect.js (scripted):** drafts `manifest.json` from script+slots+media: place->world/map, person->human shot, photo->photo shot, number->stat card, chapter start->chapterCard; picks angle/time from rhythm rules.
5. **Director (one Sonnet agent):** reads `MANIFEST.md` (~2 KB) + draft; overrides ~<=40% of beats in 2–3 passes; adds focus/cards on key lines.
6. Compile + gates (strays/measure/seektest/pacelint/edgeguard).
7. **Bake worlds (GPU, background, cached)** then render chapters in parallel/background.
8. QA: one sampled low-res contact sheet (~every 6th beat) + lint report; fix only flagged beats; max 2 loops.
9. `finish.sh` (make `PAD` duration-aware, not 482). Thumbnail: 3 variants from small spec JSON (can use a baked 3D hero frame).

## 9. Token budget per video (TARGET, % of weekly; to be validated)
| Stage | Target |
|---|---|
| Producer: research + script + slots | 2.0–2.5 |
| Director overrides on autodirect draft | 1.5–2.0 |
| QA + capped fixes | 0.8–1.2 |
| Reads/overhead (schema, scripts, status) | 0.5–0.8 |
| Thumbnail + metadata | 0.2–0.4 |
| **Total** | **~5–7** |
Levers if over budget: tighter autodirect rules, fewer overrides, cap QA to 1 loop, shorter schema, reuse cached shots, fewer searches.
Honest expectation: videos 1–5 ~9–11% (immature library, heavy overrides) -> ~7–8% by video 6–10 -> 6% only if script/research stays lean.
**Phase 0 measurement (read-only tally of past transcripts by stage) replaces these guesses with real splits.**

## 10. One-time build cost (estimate, spread across weeks; use subagents + background renders)
Rough: Phase 1–2 ~3–5% of a week each, packs 3–6 ~3–6% each, i.e. ~30–50% of one week's budget total across 2–3 weeks. Not counted in the per-video 6–8%.
Reduce by: building from the style bible with param-driven generators, not per-asset hand modelling; subagent per pack with a tight brief; reuse existing iso-kit parts/traffic sim logic.

## 11. Phases and exit criteria
| Phase | Work | Exit criteria |
|---|---|---|
| 0a | Token measurement (read-only) | Stage split known; budget table updated |
| 0b | **Spike**: 10 s NYC block, human walking, wide->person glide, focus+card pinned, no visible edges; GPU bake | Looks like reference; >= ~8 fps bake (acceptable) ; anchors.json correct; edgeguard passes; HF composite works; 1.25x voice sample OK |
| 1 | STYLE.md, manifest schema + `MANIFEST.md`, compiler, autodirect, pacelint, camera rig, bake+cache | Hand-written 60 s manifest renders end-to-end |
| 2 | Humans pack | 6+ variants, 5 actions, crowd, focus FX |
| 3 | City packs (NY, Chinese, Indian, Filipino first) | 4 styles x 5 times x 6 angles render clean |
| 4 | Terrain (mountain/river/ocean) | Same matrix |
| 5 | Transport (train/car, ship/port, airport/plane) | Moves along splines, camera can follow |
| 6 | Landmarks (10–15), animals | Recognisable at a glance |
| 7 | **Pilot 18-min video** | Weekly % measured; retention/pacing review; render wall-clock; total <= ~8% target or gap analysis |
| 8 | Tune + cleanup (slim make-video long-form path, remove 19 MB duplicate skills, prune skill list) | Per-video cost trending to 6–8% |

## 12. Risks and fallbacks
- Bake too slow -> lower res preview for QA, 24 fps, shorter shots, more cache reuse; worst case 2.5D parallax layers.
- Landmarks not recognisable -> fewer, higher-quality landmarks; use real photo cards for the rest.
- 1.25x voice artefacts -> 1.15–1.2x; recover time via tighter script.
- Style drift across packs -> style bible + palette JSON + review renders per pack.
- Weekly cap unknown / script cost dominates -> tell us in Phase 0 and rebalance (e.g. lighter research, not lighter script).
- Disk/RAM limits -> cache cap, per-chapter rendering, move finished videos off disk.
- Visual repetition over many daily videos -> bigger style/landmark/angle matrix, per-video seed for crowds/traffic/palette shifts.

## 13. Decisions still needed
1. Go on Phase 0 (measurement + spike)? 2. Priority city styles/landmarks for first 10 videos' topics? 3. Frame rate/res (1080p30 assumed)? 4. Accept pilot target of ~8% and 6% as stretch?

---
# v2.1 — QUALITY BAR UPDATE (user feedback: "quality needs to be improved by far")
The 2D SVG mock (docs/theme) is only a layout/theme stand-in; it is NOT the target look. Target = references supplied by user:
Blender-style low-poly city (varied facades, rooftop detail, parking lots, lanes, trees, water, soft shadows, AO), faceted low-poly
humans (varied outfits/ethnicity/age, faceless-stylized), low-poly vehicles/aircraft/clouds.

## Changes
1. **Assets: hybrid, not hand-coded boxes.** Use free CC0 low-poly packs as glTF (verify licence per pack in Phase 0): Kenney (city, car, nature, watercraft),
   Quaternius (animated characters, vehicles, animals, nature, streets) + our own procedural generators for facades/roofs/street layout.
   Procedural building generator: setbacks, window-grid atlas, roof props (AC units, water tanks, helipads), colour-variety, style packs per region.
2. **Cinematic render stack (Three.js, GPU):** directional sun + hemisphere/IBL, soft shadow maps, GTAO/SSAO, selective bloom on lit windows,
   ACES tone-map + grade LUT per mood, tilt-shift/DOF, motion blur on fast vehicles, volumetric-style haze, light film grain. Water shader (stylised).
3. **Characters:** CC0 rigged characters + our own recolour/outfit/skin/hair variants and regional clothing swaps; walk/idle/point/talk clips; crowds instanced.
4. **Look-dev gate BEFORE any library work (replaces the old spike):** one 1080p city-block scene (ref image 4 as the target) + 1 person + vehicles,
   lit and graded; user approves side-by-side vs references. Also render the SAME scene in Blender EEVEE as a quality/speed comparison.
   Decision rule: Three.js unless Blender is clearly better AND <= ~2 s/frame is not required... measured speed decides (18 min of 3D at 2 s/frame = ~10+ h: too slow for daily output).
5. **Per-pack quality gate:** every pack (humans, cities, terrain, transport, landmarks) must pass a reference-vs-render review before the next pack starts.
6. **Revised one-time cost estimate: ~50-80% of one week**, spread over 3-4 weeks (more look-dev/art iteration, less hand-modelling thanks to free assets).
   Per-video target unchanged (6-8% stretch; ~8% realistic after warm-up).
