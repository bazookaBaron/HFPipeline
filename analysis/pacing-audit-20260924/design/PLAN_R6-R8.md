# Plan: new sections from reference reels R6-R8 (media inside the reel, transitions, new styles)

Date: 2026-09-25. Status: **plan only**; nothing below is built yet.

Sources (all measured from frames, audio and Whisper words; evidence frames sit in each folder):
- `R6/AUDIT.md`: igexport-DdrHAI1MrFb, 155.6 s. System-design story, light blueprint style.
- `R7/AUDIT.md`: igexport-Ddm_kFQodJE, 130.9 s. AI product explainer, light brutalist style, with real footage inside cards.
- `R8/AUDIT.md`: igexport-DdkX8f9st3x, 175.1 s. Game-AI explainer, same dark template as R2, with **a gameplay video window on screen for 35% of the runtime**.

---

## 1. What the three reels add, in one table

| | R6 | R7 | R8 |
|---|---|---|---|
| Style | **NEW "BP", light blueprint**. Cool #EDF1F3 plate with a 40/200 px line grid; DH-style live state in LC clothing | **NEW "BR", light brutalist**. #F1F1EA plate with 40 px dots, viewfinder crop marks, hard-shadow window cards with square corners | **DH variant "DH-media"**. Pixel-identical to R2 (HUD, mascot box, dot grid, motion) |
| Signature section | `blueprint`: one architecture diagram that grows V1→V9, revisited 10× (35% of runtime) | `decisionSheet` → `targetForm` with a **token fly**; `writerWindow` streaming LLM text | **`media` window**: real video, 16:9, muted, 1×, about 25 trims cut on clause boundaries |
| Chrome | segmented header with a live users count-up (0 → 50M); 9-chip component `tracker`; left `noteCard` (about 55 swaps) | brand header with a ticking `DECISIONS` counter (spins to 1,000,000); 8 chapter titles; 3-state `tabChips` | `chapterTabs` (4 tabs, also a recap); label changes **every sentence** (22/min); debug HUD with a free-running `TICK` |
| Transitions | **18 of 34 scene changes are motion**: push-left over the mascot, drop/rise, slide-in, cover, tumble | cut + 25 px rise-settle, push-out exits, collage stagger | hard cuts; one shrink-to-thumbnail FLIP (433 ms) |
| Media | still images only: avatars, photos, video stills with a ▶ disc, brand logos | **real screen recordings** (Doom, browser agent) + screenshots, press/news cards on a pink band, 4-card collage | **real gameplay video**, freeze-frame (PAUSED), stepped 10 fps variant, vector overlays on the footage |
| Captions | white paper chip + **yellow marker box** behind the active word | same highlighter skin, 56 px, 4 words, 0.95→1.0 pop | rounded dark chip, medium weight, **cyan** active word |
| Pace | 196 wpm; 52 beats/min; scene median 3.67 s | 204 wpm; 63 beats/min; scene median 3.53 s | 218 wpm; ≥42 beats/min (ambient motion hides beats); label median 2.65 s |
| Audio | −14.1 LUFS, LRA 1.5, bed-like floor, SFX on about ⅓ of transitions | −14.1 LUFS, continuous bed, sparse SFX | −14.1 LUFS, no dead silence, footage muted |
| Mascot | third-party cartoon (Rick Sanchez style), never hidden, content passes over it | the same character, slides in and out, finale at 1.29× | copyrighted character, R2 behaviour |

**Rights:** all three presenters and all footage in these reels belong to others. We copy **mechanics and measurements only**, never the assets.

---

## 2. How the reel-inside-the-reel works (R8 + R7), and how we'll do it

Measured facts:
- The media sits in an **app-style window card**: a 40.5 px header (`PLAYER VIEW · LIVE`), status dot (red = live, amber = paused), 1.5 px border, about 9 px radius, clipped corners, no padding, no shadow in DH. R7 uses a hard +7.5 px offset shadow with square corners.
- Rects (1080 space):
  - DH next to the mascot: media 750×423 at (267, 540).
  - DH full width: media 957×540.
  - thumbnail: 0.40× anchored top-right.
  - R7 full width: 860×659, cover-cropped by about 2%.
- **Scaling:** cover, and the rect is chosen to match the source's aspect, so nothing is cropped more than 2%. **No Ken Burns, no pan, no zoom.**
- **Playback:** real time at 1×. The source's own fps shows (a 20 fps source repeats frames). Two deliberate exceptions, both pre-rendered: a freeze-frame (header PAUSED) and a stepped 10 fps look.
- **Audio:** the footage is muted in all three reels; the voice carries everything.
- **Editing:**
  - a scene is made of short trims (median about 2 s);
  - each new trim starts **≈100-110 ms before** the clause / action verb it illustrates;
  - trims repeat in lockstep when reused;
  - window in and out are 1-frame hard cuts;
  - one FLIP shrink-to-thumbnail move (433 ms, power2.inOut, origin top-right).
- **Overlays:** flat vector graphics drawn on the footage (bracket + state pill, vision cone, reticle, tracers, reaction bar, stat box), plus a highlight box over a screenshot headline in R7. The footage is never dimmed or blurred.
- **Stills:** the same window with an `<img>`: screenshots, photos, a ▶ disc on a still to signal "video" without playing it (R6), avatars in rings, logos on chips.
- **Defect in R8 not to copy:** 13 of 17 trim starts show one black frame. Our gate blocks this.

### 2.1 Stage module `media` (video + image)
- **DOM:**
  - an **untimed** window frame (header, dot, overlays) holding sibling timed `<video id muted playsinline data-start data-duration data-media-start data-volume="0">` trims, back to back;
  - `<img class="clip" data-start data-duration>` for stills;
  - `object-fit: cover`, with the rect aspect snapped to the source.
- **HyperFrames rules** (0.8.46):
  - never nest a timed `<video>` in a timed element, so the stage must host media **outside** the timed scaffold wrapper;
  - the frame's visibility is driven by the stage timeline, and only its wrapper is ever tweened;
  - there is no playback-rate attribute, so freeze, stepped and speed variants are **pre-baked with ffmpeg** (`-frames:v 1` PNG; `fps=10,fps=30`; `setpts`);
  - composition code never calls play or seek.
- **Architecture change this forces:**
  - the stage sub-composition builds its DOM at runtime from the spec, and the framework must see the `<video>` elements with their timing attributes;
  - so `composeStage.js` must **emit media elements into the root composition** (as siblings of the stage clip, positioned by the compiled rect and time), while the stage module draws only the untimed window chrome and overlays in a transparent hole;
  - z-order: stage background → media layer → stage content/overlays → captions. The stage background is therefore split from the stage content layer (two stage instances, or the media inserted between two stacked stage layers).
  - This is the one real architectural change in the whole plan; build it and prove it first.
- **Props:**
  - `src`, `kind: video|image`, `rect: stage|full|thumb|[x,y,w,h]`;
  - `head`, `dot`;
  - `trims: [{in, dur, at?, variant?: live|paused|stepped10}]`;
  - `overlays: [{type: bracket|cone|pill|reticle|tracer|bar|stat|highlight, ...}]` in media-local % coordinates;
  - `skin: dh|brutal|paper`.
- **Ops:** `mediaCut {trim}`, `pause`, `resume`, `head {text}`, `dot {tone}`, `overlayIn {i}`, `overlayTone`, `tracer {i}`, `bar {i,to}`, `highlight {rect}`, `shrink {to:"thumb"}` (FLIP 433 ms), `relayout {rect}` (FLIP 467 ms).
- **Variants:** `mediaWindow` collage (R7: 2-4 windows, 300 ms stagger, 33 px side-slide), `pinkBand` plate behind a screenshot, `phone` device mockup (R6), `imageSlot` (circle/rounded, ring, ▶ disc), `logoRow`.

### 2.2 Where the footage and images come from (the new asset class)

| Source | What for | Rights |
|---|---|---|
| **Our own screen recordings** (Puppeteer / `hyperframes capture` of a live URL: scroll, click, type) | product demos, websites, dashboards, **vloombox.in itself** (14,000+ live tech jobs, 500 companies) | ours, fully safe. The first pilot uses this |
| **Recordings we render ourselves** (HyperFrames compositions, terminals, code runs, browser flows) | "what happens when you run X" | ours |
| **User uploads** (control-panel media library: clip + tags + licence field) | your own footage and screenshots | yours; the upload records the licence |
| **Stock video/images with licence APIs** (Pexels / Pixabay video + photo; Unsplash photos) | generic B-roll, places, objects | free licences; attribution recorded in the manifest (same pipeline as `FINANCE-16x9-PLAN.md` §4) |
| **Logos** (simple-icons / Wikimedia SVG) | tech-brand chips (Redis, Kafka, S3…) | nominative use only, unaltered |
| Game or TV footage like R7/R8 | – | **not allowed** unless licensed |

**Media resolve pipeline** (automatic, shared with the finance plan):
1. The storyboard declares a `media` slot with its intent.
2. The resolver picks from the library or a recording script, or searches stock.
3. Candidates are vetted:
   - Gemini vision relevance;
   - no watermark;
   - no black first frame;
   - aspect within 2% of the rect, or a cover crop that keeps the focal box.
4. The chosen asset is frozen to `video-engine/assets/media/<sha>.mp4|webp` with a manifest (source, licence, attribution).
5. **Scene detection + Gemini vision tag each segment** of a clip ("clicks Apply", "list scrolls", "graph spikes").
6. The compiler assigns trims to clauses: each trim starts `word.start − 0.10 s` and never ends mid-word, and the gates enforce it.

---

## 3. Everything else that's needed (grouped capabilities)

### C2. Scene transition layer (R6 18/34, R7 push-out)
Scaffold-level `transition: {out, in}`. All measured:

| Kind | Movement | Timing |
|---|---|---|
| `push-left` | out to x −800 over the mascot, cards staggered 50 ms, then 1 blank frame | 200 ms power3.in |
| `drop-rise` | out drops over ≈7 f; in rises from +700 px | in 333 ms power3.out |
| `slide-in-right` | from +480-600 px | 233-333 ms expo.out |
| `exit-right` | out slides right with a fade | power2.in, 6-7 f |
| `cover` | new card slides over the old one, which drifts left | ≈8 f |
| `tumble` | each card rotates ±10-20° and falls | 7 f, ease-in |
| `cut` | hard cut (today's only kind) | 1 f |

Needs a **z-order switch** so content passes over the mascot and caption during the move. Seek-safe: each is one tween per module at the boundary time.

### C3. Persistent hosts, revisited across scenes
`blueprint` (R6) and `decisionSheet` (R7) keep their accumulated state across **non-adjacent** scaffolds. The storyboard needs a `recall: "<hostId>"` scaffold that restores the host with all events applied so far.

The core already builds modules once and applies events in time order, so state persists naturally. What's new:
- visibility runs for the same id across gaps (already supported by `collectRuns`);
- a `refit` op for when the graph outgrows its rect.

### C4. Chrome

| Module | From | What it does |
|---|---|---|
| `chapterTabs` | R8 | 4 tabs, single or cumulative recap; `activate`, `light` |
| `lbHeader` | R6/R7 | brand block + chapter cell + live counter; count-up power2.out 1.2 s, tick-punch, spin-to-final |
| `tracker` | R6 | component chips lit on their words |
| `noteCard` | R6 | RULE / PROBLEM / FIX / GOAL / COST, about 21 swaps/min |
| `tabChips` | R7 | done / active / future |
| `cropMarks` | R7 | viewfinder L-brackets |
| HUD schema variant | R8 | `DEBUG VIEW` badge, entity, state pill, free-running `TICK` = frame number |

Also the **per-sentence label** cadence (R8: 22/min).

### C5. Caption skins
- `marker`: white chip, 56 px, yellow #FDE587 box behind the active word, 1-f word hops, 0.95→1.0 pop, 4 words (R6/R7).
- `chip-cyan`: rounded dark chip, r 9, medium weight, active #5fe4e6, spoken white, upcoming grey (R8).

### C6. New ops on existing cards
- `headline.light` (dim 22% → lit in 2-3 f, per word);
- `headline.recolour` (keyword grey → accent);
- `stamp` v2 (1.30→1.0 in 167 ms, or 2.5× slam in 6 f) + black `strike` 4 f;
- `stream` (LLM text, about 6 lines / 1.5 s) + `mark` (highlighter sweep 4-6 f);
- `race` (linear real-time bar), `shrink` (cost bar 9 f), `countUp` (1.2 s power2.out);
- `pushOut`, `fly` (token chips fly ≈525 px, 10 f, 133 ms stagger into form fields);
- `flip` (relayout / shrink-to-thumb);
- `blink` + `type{cps:51}` for the terminal cursor.

### C7. New cards (priority by reuse)
- **P1:**
  - `media` / `mediaWindow` / `imageSlot`;
  - `decisionSheet` + `targetForm`;
  - `writerWindow`;
  - `blueprint`;
  - `featureRows` / `costCards` / `techCards` (ghost → lit family);
  - `eventChips`;
  - `dials`.
- **P2:**
  - `phone`, `jargonCloud`, `reqList` / `jobList`;
  - `hitCounter` + `dotGrid` + `vsCards`;
  - `splitTable`, `sizeBar`, `latencyBars`;
  - `toolTiles`, `docGrid`, `appGrid`, `raceBars`;
  - `modelTile`, `chatWindow`, `repoCard`, `logoGrid`;
  - `displayLine`, `pinkBand`.
- **P3:**
  - `floorplan`: game-specific, but its ops (route, blocked, frontier) generalise to "map / pathfinding";
  - `crowdgrid`, `worldMap`, `obsTriptych`, `strikeStrips`, `cycle`, `matcher`, `costMeter`, `docStrike`, `projectCards`.

Each card gets the same treatment as today:
- catalog entry (props / ops / heights);
- layout-audit coverage;
- a fixture;
- carousel support (the static final state) for free.

### C8. Profiles, generator, gates
- **New profiles:**
  - `BP` (theme tokens + `profile-bp.js` chrome + `templates-bp.js`, a fixed column 301.5-1018.5 × 402-1330, mascot never hidden);
  - `BR` (`profile-br.js`, hard-shadow window skin, crop marks, pink band, `templates-br.js` T1-T8 from R7 §5.9);
  - `DH` gains the media templates `stage-media` / `full-media` / `thumb`.
- **Generator** (`storyboardGen.js`):
  - 5-way `chooseProfile`;
  - a grammar + worked example fixture per new profile;
  - media rules: concrete behaviour sentence → trim, cut ≈100 ms early, open and close on footage;
  - validation for media slots (asset exists, trims fit, rect aspect).
- **Cadence bands per profile**, from the audits:

  | Profile | beats/min | scene median | longest hold | wpm |
  |---|---|---|---|---|
  | BP | 45-65 | 2.5-5 s | ≤ 3.8 s | 185-205 |
  | BR | 55-75 | 2.5-5 s | ≤ 3.6 s | 195-215 |
  | DH-media | ≥ 40 | – | ≤ 4.5 s | 205-225 |

  Chrome events count as beats.
- **New gates:**
  - media: first frame not black, aspect within 2%, timed-nesting check, local and licence-cleared;
  - trim-to-word lead within −0.2…0 s;
  - transition z-order: content never left over the caption after the move ends.
- **SFX:** the new profiles cue SFX on transitions and slams only (≈⅓ of changes, per R6/R7), not on every row tick.
- **Captions:** per-profile skin (`marker` for BP/BR, `chip-cyan` for DH-media).

---

## 4. Phased roadmap (each phase ends with real renders + gates + a side-by-side against the reel)

| Phase | Build | Proof |
|---|---|---|
| **P1: media foundation** | root-level media layer in `composeStage.js` (split stage background/content); `media` module (video + image, trims, freeze/stepped pre-bake, overlays, `shrink` FLIP); asset manifest + library folder; **screen-recording tool** (Puppeteer: scroll, click and type scripts on a URL → mp4); media gates | a DH video on "How vloombox.in finds 14,000 fresh tech jobs a day", with our own recording of vloombox.in inside the window: trims on clauses, overlays, pause, shrink-to-thumb; all gates green |
| **P2: motion + chrome upgrades (shared)** | scene transition layer + z-order switch; `headline.light` / `recolour`; `chapterTabs`; per-sentence labels; `chip-cyan` and `marker` caption skins; `stamp` v2 + strike; `countUp` | DH-media pilot with tabs and dim→lit headlines; transition gallery fixture (every kind, frame-measured against R6 deltas) |
| **P3: BR profile** | plate, crop marks, `lbHeader` (counter), `tabChips`, brutal window skin; `decisionSheet`, `targetForm` + `fly`, `writerWindow` (`stream` / `mark`), `mediaWindow` collage + `pinkBand`, `raceBars`, `toolTiles`, `docGrid`, `appGrid`, `terminal` blink | BR pilot from a topic (e.g. "Why LLM apps need structured output"), gates in the BR bands |
| **P4: BP profile** | line-grid plate, `lbHeader` users counter, `tracker`, `noteCard`, `blueprint` host (add / alert / crash / annotate / packet / version / refit, recall across scenes), ghost → lit family, `phone`, `imageSlot` avatars/logos | BP pilot "How a startup scales to 50M users" with a 10-visit blueprint |
| **P5: long-tail cards** | P2/P3 cards from C7; carousel support for all new cards (media stills in slides) | card gallery fixture, layout-audit clean; one carousel per profile |
| **P6: generator + UI** | 5-way style choice, grammars/examples, media slot resolution (library → recording → stock), cadence bands, control-panel **media library** (upload, tag, licence) and style list | 5 topics end to end from the button with no human step, every gate green |
| **P7: presenter** | an original full-body presenter (mouth/gaze/blink states, slide, finale scale) to replace SpongeBob | – |

---

## 5. Decisions needed from you
1. **Footage sources:** OK to start with our own screen recordings (vloombox.in and other public sites we record) + your uploads, and add stock APIs (Pexels/Pixabay keys) later?
2. **New styles in Auto:** enable BP and BR in the automatic style choice once built, or keep them manual?
3. **Music bed:** R6/R7/R8 all have a continuous floor (no silence). The shorts decision was "no bed". Keep it, or add a quiet licensed/generated bed now that SFX exist?
4. **Brand logos** on cards (Redis, Kafka, OpenAI…): allowed as unaltered nominative chips, or icons only?
5. **Presenter:** schedule P7 now or keep SpongeBob until later.
