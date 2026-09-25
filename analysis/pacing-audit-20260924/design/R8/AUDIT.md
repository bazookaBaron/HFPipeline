# R8 design & motion audit: how NPC AI works, with embedded gameplay video (`R8_DdkX8f9st3x`)

**Source.** `C:/Users/debna/Downloads/igexport-DdkX8f9st3x.mp4`.
- Video: native **720×1280**, H.264, 30 fps CFR, **175.000 s**, 5250 frames, ≈438 kb/s.
- Audio: AAC 48 kHz stereo, 58 kb/s (IG re-encode).

**Loudness** (ffmpeg `ebur128`, `loud.txt`): **I −14.1 LUFS**, **LRA 1.5 LU** (low −14.9, high −13.4), **TP −0.9 dBFS**.

**Conventions.**
- Pixel values are measured on native frames and reported **×1.5 in 1080×1920 space** (±1.5 px quantisation).
- Hex values carry about ±3 per channel of IG compression noise.
- 1 f = 33.3 ms. Times are seconds in the reference file.
- Frame *n* in `f30/` is t = (n−1)/30.
- Word times come from faster-whisper `small` (`words.json`, 636 words). Per SPEC §conventions, Whisper starts run ≈0.04–0.26 s early against the audible onset, so every lead/lag here carries about ±0.15 s.

**Our v3.** The "Our v3" column is read from `orchestrator/lib/video/v3/catalog.js`, `lib/stage/*.js` and SPEC §1/§4. Nothing was re-rendered for this audit.

**Scripts and raw outputs (this folder).**
- `rect.py` / `chrome.py`: window and media geometry.
- `dense.py` → `dense_media.txt`: per-frame media rect plus the red-dot tracker.
- `sig.py` → `sig.txt`: per-frame footage signature, MAE, cuts, duplicates and black frames.
- `beats.py` → `beats.txt` / `events.json`: frame-change detector.
- `chrome_events.json`: label / tab / state-pill change times.
- `mascot.npy`: mascot extent per frame.
- `whisper_words.py` → `transcript.txt`, `words.json`.

Scratch frames are git-ignored. Named evidence frames are `ev_<t>.png`.

---

## 0. Measured geometry map (1080×1920)

| Band / element | R8 (measured) | Frames | R2 (DH reference) |
|---|---|---|---|
| Top dead zone | 0–235 pure #000000. The top-region diff is 0 on every one of the 5249 frame pairs. | all | 0–235 |
| HUD bar | x 60–1020 × y 235.5–306 (960×70.5), fill #090d11, border 1.5 px #15191d, r≈9. Visible from 13.77 s to the end. | 20.0 | **identical** (60–1020 × 235.5–304.5, #090d11/#15191d) |
| Section label | one caps line, cap-top y 346.5, cap 25.5 (≈35 px font), centred on the **content-column centre** (x 641 with the mascot, 540 full width). Hook size: cap 30 at y 366. | 20.0, 100.0, 130.0 | cap 33 at y 342, centred on 540 |
| Chapter tabs | 4 tabs, y 400.5–456 (h 55.5). With mascot: x 268–1020, each ≈182 wide, gap ≈10. Full width: x 60–1020, each ≈236 wide. | 20.0, 80.0, 167.0 | none (R2 had a 4-tab stepper only in S13) |
| Content slot | y ≈495–1332 (with mascot: x 264/268–1020). Full width: x 60–1020, y 499.5–1300.5. | 20.0, 124.0 | 334–1300 |
| **Media window (mascot layout)** | outer x 267–1020 × y 499.5–963 (753×463.5). Header 499.5–540 (h 40.5). **Media 750×423 (16:9)** at x 268.5–1018.5, y 540–963. | 8.0, 13.0, 100.0, 173.0 | none |
| **Media window (hook / full width)** | outer x 60–1020 (960 w). Header h 45. **Media 957×540 (16:9)**. Top 639 (0–2.27 s, under the title) or 499.5 (2.30–7.17 s, 117.73–118.57 s). | 1.0, 4.0, 118.0 | none |
| **Media thumbnail** | (a) the full-width window scaled **0.40** about its top-right corner: x ≈636–1020 × 499.5–≈741. (b) a separate small window: x 639–1020 × 499.5–741, header ≈33, media ≈378×208. | 120.0, 130.0 | none |
| Mascot | x 19.5–243 × y 537–1323 (224×786), identical in every mascot frame | 20.0 | **identical** (19.5–243 × 537–1321) |
| Caption box | x centred on 540, y 1423.5–1528.5 (h 105), box centre y 1476 (76.9 % H) | 8.0, 15.8, 45.0, 160.0 | y 1416–1531.5 |
| Bottom dead zone | 1530–1920 pure black | all | 1540–1920 |
| Background | #000000 + static dot grid, dots #060805, **54 px pitch** (x 349.5, 403.5, 457.5 …; y 673.5, 727.5, 781.5 …) | 20.0 | identical 54-px grid |

---

## 1. Style profile: **DH** (dark-HUD-persistent), a new "DH-game" variant, not a new profile

Evidence that this is the same template family as R2:
- **HUD rect and colours match R2 to the pixel.** R8 is 60–1020 × 235.5–306, #090d11 / #15191d; R2 is 60–1020 × 235.5–304.5.
- **Mascot bbox matches R2.** 19.5–243 × 537–1323 vs 537–1321.
- **Same background.** Black void with a 54-px static dot grid.
- **Mascot entrance recipe matches R2's E1.** Slide from off-left plus opacity ramp, right edge Δ 36, 32, 24, 19, 13, 12, 8, 4, 4 px/f over 11–12 f (367–400 ms), ease-out. Measured at 7.23–7.60, 91.10–91.47 and 140.87–141.23.
- **Full-width reframe matches R2's E9.** The mascot is hard-cut out, then the scaffold FLIPs to x 60–1020 with the right edge anchored in 467 ms ease-in-out (75.27–75.77).
- The content layer hard-cuts, while chrome, caption, mascot and background persist.

What is new relative to R2 / SPEC DH (the variant knobs):
1. The **embedded media window** (§2).
2. A **4-tab chapter bar**, SENSE / DECIDE / NAVIGATE / ANIMATE, coloured per chapter and reused as a recap.
3. **The label changes every sentence** (64 swaps, 22/min). R2's label changed per section.
4. A **caption skin** closer to DC "quiet chip":
   - rounded box, r≈9, fill #070c10, 1.5 px border #15181a, no hard shadow;
   - medium-weight sans (not 800);
   - karaoke: active word **cyan #5fe4e6**, spoken white #f0f4f6, upcoming grey #9a9eaa.
5. **HUD schema:**
   - `DEBUG VIEW` badge in teal;
   - `NPC guard_07` (mono);
   - `STATE ● PATROL` pill, recoloured per state;
   - `TICK 00600`: a counter equal to the frame number (tick = round(t×30); 00600 @ 20.0, 03000 @ 100.0, 05160 @ 172.0). It runs continuously, which matches "thirty times a second".
6. **Continuous ambient motion** (vision-cone sweeps, tick counter, route draws, typewriters). Only **25 %** of frames are identical in the content area; R2 had ≈50 %.
7. **Dim→lit headlines.** The headline is pre-shown at ≈22 % luminance and lights word by word in 2–3 f.

**Verdict.** Build this as **DH + a `media` module + a `chapterTabs` chrome option + the caption skin "chip-cyan" + a HUD schema variant**. No new profile is needed.

---

## 2. The embedded media component (top priority)

### 2.1 Inventory: every media appearance (frame-exact, from `dense_media.txt` + `sig.txt`)

| # | t0 – t1 (s) | Window variant / rect (1080 space) | Header text · dot | Footage behaviour | Narration it illustrates |
|---|---|---|---|---|---|
| M1 | 0.000 – 2.267 | full width under the title; outer 60–1020 × 639–1224, media 957×540 at y 684 | `PLAYER VIEW · LIVE` · red | 1× live, **montage of 3 trims** (cuts 0.800, 1.600) | "How do NPCs in video games actually work?" |
| M2 | 2.300 – 7.167 | full width, outer 60–1020 × 499.5–1084.5 | LIVE · red | 1× live, trims cut at **4.967** ("reloads") and **6.567** ("shooting") | "…spots you, runs behind cover, reloads, flanks you…" |
| M3 | 7.200 – 12.033 | mascot layout, media 750×423 at (268.5,540) | LIVE · red | 1×, new trim at 8.933 (black frame) and cut at 9.167 | "it can feel like it is actually thinking… not ChatGPT" |
| M4 | 12.067 – 15.633 | same rect | **`PLAYER VIEW · PAUSED` · amber #d9aa46** | **freeze-frame.** The per-frame MAE is exactly 0.0 from 13.0 to 15.5, apart from overlay updates. | "It is following a carefully designed decision system." |
| M5 | 97.600 – 117.700 | mascot layout (same rect) | LIVE · red | 1×, 6 trims (black-frame starts at 101.667, 103.667, 105.9, 110.233, 113.333; cuts at 97.667, 103.93, 107.37, 116.967) | aiming / reaction / miss / "not the smartest" / "feels intelligent" |
| M6 | 117.733 – 118.567 | full width (mascot hard-cut out), outer 60–1020 × 499.5–1084.5 | `PLAYER VIEW · OPEN WORLD` · red | near-static low-contrast night-city clip (MAE <0.3/f) | "And then there are large open world games." |
| M7 | 118.567 – 119.0 → 121.767 | **shrinks to a 0.40× thumbnail** anchored top-right (x 636–1020 × 499.5–741) while a city grid fades in below | same (text now tiny) | slow clip, stepped at 10 fps after ≈120.3 | "Imagine a city with thousands of NPCs." |
| M8 | 121.800 – 140.800 | separate thumbnail window 639–1020 × 499.5–741 beside a FRAME BUDGET / LOD / RECORD panel | `PLAYER VIEW` · red | several trims (black-frame starts at 125.933, 127.867, 133.067; cuts at 124.833, 130.9, 134.2, 138.3). **133.1–138.3 steps at 10 fps**: every 3rd frame changes, per-frame Δ pattern 6.6/0.3/0.2. | levels of simulation: near / far / "reduced to simple data" |
| M9 | 171.933 – 175.000 | mascot layout (same rect as M3) | LIVE · **amber** | 1×, **replay of M5's 110.267–113.3 trim**, frame-locked at offset +61.700 s (MAE 0.6–0.9) | "…extremely good at creating the illusion that it is." |

Total on screen: **≈61.5 s of 175 s (35 %)**. The media sits under **9 distinct window states** and **~25 trims**.

### 2.2 Where it sits: frame, rect, radius, border, shadow, mask

It is an app-window card (no device mockup), measured at 8.0 / 100.0 / 173.0 s:
- **Outer:** x 267–1020, y 499.5–963 (753×463.5), right-aligned to the HUD's right edge (1020).
- **Border:** 1.5 px, #262a2f–#3e3d42 (≈#2a2d33).
- **Radius** ≈9 px (6 native), measured from the corner row profile: first lit column 184 → 182 → 181 → 180 → 179 over 5 rows.
- **Header bar:** h 40.5, fill #11181e.
  - Label: `PLAYER VIEW · LIVE`, mono tracked caps ≈12 px, #c9cdd3.
  - Right: a 9–10.5 px status dot at (998.5, 521.2), 13 px in from the right edge.
  - Dot colours: red **#c53363** for LIVE; **amber #d9aa46–#dfaf48** for PAUSED (M4) and for the M9 SEARCH state.
- **No shadow, no glow.** The pixel just outside the border is #000202.
- **Mask:** the media is clipped by the window radius. The bottom corners are rounded on the footage itself (row 641 starts at x 183 vs 178 higher up), so the window uses `overflow:hidden` + `border-radius`.
- **No inner padding.** Footage starts on the row right after the header (y 540) and runs to the border.

### 2.3 Scaling: cover vs contain, zoom, motion

- **Every media rect is exactly 16:9:** 750×423 (1.773), 957×540 (1.772), thumbnail ≈378×208. The source gameplay is 16:9, so cover = contain and nothing is letterboxed. Footage reaches all four edges on every frame.
- **No Ken Burns, pan or zoom punch.**
  - Trims reused across rects of different size match frame for frame after normalising to 96×54. M1↔M5 MAE 1.8–2.0; M5↔M9 MAE **0.6–0.9**; A↔B 1.0–1.2.
  - A zoom or pan on either use would break this match.
- **The window itself moves only in three ways:**
  1. **Hard cut to a new rect.** 2.300 (full width moves up 139.5 px), 7.200 (to the mascot layout), 117.733 (to full width).
  2. **A shrink-to-thumbnail FLIP** at 118.567 → 119.0 (§2.6).
  3. Nothing during holds (no idle wobble).

### 2.4 Playback: speed, loop, audio, start/stop vs narration

- **Speed 1.0×.**
  - No duplicated or blended frames inside live trims: M1/M2/M3/M5/M9 have 0–3 dups per segment against 146–603 frames.
  - Motion reads as natural.
  - A trim reused in a later scene advances frame for frame at a **constant offset** (+61.700 s M5→M9; +5.367 / +4.767 / +4.233 s M1↔M2↔M3). So every use plays at the same rate, with `data-media-start` = the trim's in-point.
- **Exceptions (deliberate):**
  - **Freeze-frame** (M4, 12.067–15.633): exact 0.0 MAE, header switches to `PAUSED`, dot goes amber. It is a paused game, not a still image.
  - **Stepped 10 fps** (M8, 133.1–138.3; also M7 from ≈120.3): a new frame every 3 frames (Δ ≈6.5), with Δ ≈0.2 on the held frames. It starts on "NPCs far **away** might be reduced to simple data" (133.18) and ends on "When you get close again" (138.32), so choppiness is used as a *meaning* (low-LOD simulation).
  - **Very slow drift** (M6/M7, parts of M8): per-frame Δ ≈0.3–1.0 but 5–13 over 1–2 s. These are slow-moving source shots, not a zoom (§2.3).
- **Loop / reuse:** no trim ever loops within a window. Trims are **reused across scenes** (§2.1: M1/M2/M3 share trims; M9 replays M5's flashlight trim; M8 131.4–133.0 = 138.3–139.9).
- **Own audio: not audible.** Inter-word gaps inside media spans (n=20) measure median −25.8 dBFS, p10 −33.4. Outside media spans (n=48) they measure −27.8 / −34.1. The >4 kHz share is the same (−26.2 vs −25.1 dB). The 50-ms floor p5 is −35.8 (0–15.6 s) vs −35.4 (20–95 s). The footage is therefore **muted**, and the voice (word RMS median −17.9 dBFS) carries the mix alone.
- **Start/stop vs narration.** Each trim change lands at a sentence or clause boundary: new trims lead the sentence onset by a median of **≈−110 ms** (range −230…+140 ms).
  - Examples: 8.933 vs "but"@9.04 (−107); 101.667 vs "Accuracy"@101.70 (−33); 103.667 vs "Reaction"@103.76 (−93); 105.9 vs "The"@106.00 (−100); 110.233 vs "Good"@110.34 (−107); 125.933 vs "So"@126.16 (−227); 133.067 vs "NPCs"@133.18 (−113); 171.933 vs "The"@171.82 (+113).
  - Inside the hook, cuts land on the **verb they show**: 4.967 = "reloads"@5.06 (−93); 6.567 = "shooting"@6.44 (+127).
- **Render artefact (do not copy):** 13 of 17 trim starts show **one black media frame** (media mean ≈1 while chrome and overlays are already drawn): 2.300, 8.933, 12.067, 101.667, 103.667, 105.900, 110.233, 113.333, 117.733, 125.933, 127.867, 133.067, 171.933.
  - In `ev_171.933.png` the vision-cone and SEARCH overlay sit on a black media area. The overlays are separate DOM layers, and the reference renderer showed the video element one frame before its first decoded frame.
  - HyperFrames pre-extracts frames, so this should not happen for us. The layout audit / snapshot must still check "media mean > 3 on its first frame".

### 2.5 Overlays on top of the media

All overlays are flat vector UI in the stage palette. None dims, blurs or vignettes the footage; footage luminance is unchanged when an overlay appears.

| Overlay | Where / when | Anatomy (1080) | Motion |
|---|---|---|---|
| **Entity bracket + state pill** | M4 12.1–15.6, M9 171.93–175 | cyan (M4) / amber (M9) 1.5 px rectangle around the NPC (≈30×45) with a mono `guard_07` tag above; pill `● PATROL » CHASE` (M4: red text + dot on dark fill) or `● SEARCH` (M9: amber) | appears with the scene cut (present on the black first frame) |
| **Vision cone** | M4, M9 | translucent wedge from the NPC, cyan #3ec6c8 fill ≈25 % + 1.5 px edge (M4), amber (M9) | static in M4 (freeze); in M9 it stays fixed in screen space while the footage plays (it does not track) |
| **Aim reticle** | M5 97.6–110.2 | red dashed circle Ø≈150 + crosshair + caption `ENEMY AIM · SPREAD` (red tracked caps ≈12 px) | shrinks with difficulty (visual log: 60 % → 85 % hit chance at 102.8 when HARD lights) |
| **Reaction bar** | M5 103.67–105.9 | dark pill inside the media bottom (x ≈290–1000 × y ≈905–935): `PLAYER SEEN` caps + track + amber fill + mono `+0.12 s` | fill grows as the delay counter ticks (+0.00 → +0.12 s → +0.60 s in the dials panel) |
| **Forced-miss tracers** | M5 105.9–110.2 | amber dashed lines from the enemy to ring end-points labelled `FORCED MISS` (×2) + a red `HIT` ring; `ACCURACY 100%` stat box top-right in the media | tracers draw in on "miss some shots" (107.10) |
| Source HUD glyph | M5, M9 | a small game-UI icon bottom-right (≈45×30) | part of the source footage, not an overlay |

**Captions** never sit on the media; they stay in the caption band. **Headlines** sit *below* the window, never on it: `FEELS / INTELLIGENT` (lit 115.00) and `THE ILLUSION` (lit 173.83). **Companion panels** attach below or beside it:
- the SPOTTED/COVER/RELOAD/FLANK/FIRE event chips + `engine log · npc.state`;
- the `THINKING?` panel;
- `GAME SYSTEMS · THE DESIGNER'S DIALS`;
- `FOUR LAYERS, EVERY TICK`;
- the goal cards;
- FRAME BUDGET / LEVELS OF SIMULATION / NPC_4821 RECORD.

### 2.6 Enter / exit, and what the frame does meanwhile

| Event | Frames | What happens |
|---|---|---|
| First appearance 0.000 | frame 1 | Window already on screen with footage playing under the 2-line title (`HOW DO NPCs` white, `ACTUALLY WORK?` dim → lit). No entrance tween. |
| Re-layout 2.300 | 1 f hard cut | Title removed. Window jumps up 139.5 px (outer top 639 → 499.5), **new trim with one black frame**. Chips row + engine log appear under it. Label `EVERY ENEMY…` fades in over 2.367–2.433 (3 f). |
| Mascot enters 7.200 | 1 f hard cut + 367 ms mascot slide | Window hard-cuts to the mascot-layout rect (750×423). Mascot slides and fades in from off-left over 7.233–7.60. The chips row reflows under the narrower window. The `THINKING?` panel appears below. |
| Freeze 12.067 | 1 f | One black frame, then the paused frame + amber dot + `PAUSED`. The cone/bracket overlay is present from the first frame. The HUD fades in 13.767–14.0 (7 f, ease-out) on "decision system". |
| Exit 15.667 | 1 f hard cut | Replaced by the floor-plan map + sensors panel. SENSE tab lights. No exit tween. |
| Enter 97.600 | 1 f hard cut | Replaces the nav-graph scaffold. Window + DIALS panel appear in the same frame. First footage frame is immediate (no black frame here). A trim cut follows 2 f later (97.667). Label fades in 97.667–97.733. ANIMATE tab lights on the cut. HUD STATE → ATTACK. |
| Trim swaps inside M5 | 1 f each | Window, header and dot persist. Only the media content changes (5 of them with one black frame). Companion panels mutate on words. |
| Exit to full width 117.733 | 1 f hard cut | Mascot, headline and panels removed. Window re-laid full width (960). Header text → `OPEN WORLD`. |
| **Shrink to thumbnail 118.567 → 119.0** | 13 f ≈ 433 ms | Window scales about its **top-right corner**: top fixed at 499.5, right at 1020–1023. Width 960 → 958.5 → 952.5 → 937.5 → 909 → 865.5 → 798 → 702 → (598.5) → 517.5 → 459 → 420 → 397.5 → 387. Per-frame Δw: 1.5, 6, 15, 28.5, 43.5, 67.5, 93, ≈103, ≈81, 58.5, 39, 22.5, 10.5. That is a **symmetric ease-in-out** (≈power2.inOut) ending at scale **0.403**. The city grid below fades in 118.70–118.87, and during the move the grid shows through the window (the window is at <100 % opacity mid-move). |
| Thumbnail swap 121.800 | 1 f hard cut | The scaled thumbnail is replaced by a proper small window (normal-size header `PLAYER VIEW`, 381×241.5) beside a FRAME BUDGET panel. |
| Exit 140.833 | 1 f hard cut | Thumbnail + LOD grid removed. Mascot slides in 140.87–141.23. |
| Enter 171.933 | 1 f hard cut | Returns in the mascot-layout rect (same as M3/M5). Overlay first, one black media frame, footage from 171.967. `THE ILLUSION` dim below, lit at 173.83 on "illusion". Ends at the last frame (175.0) without an exit. |

Across the whole reel, **media always enters and exits on a hard cut**. The only tweened media motion is the FLIP shrink at 118.57. Chrome (HUD, tabs, caption, dot grid) persists across every media cut.

### 2.7 Stills (images / screenshots)

- **No raster stills, photos or screenshots are used anywhere.** Every "picture" is a video trim.
- The only still-like state is the **freeze-frame** (M4). It is presented as the paused game (`PAUSED` header, amber dot) with vector overlays drawn on it.
- The near-static open-world clips (M6/M7) are still video (slow drift, §2.4).
- **A still image should therefore use the same window.** Use header text `PLAYER VIEW · PAUSED` (or a custom caption) and the amber dot, and add no Ken Burns (the reference never moves media inside its rect).

### 2.8 HyperFrames implementation recipe (stage module `media`)

**Rules that apply** (HyperFrames 0.8.46 `docs data-attributes`, `hyperframes-core/references/variables-and-media.md`):
- Timing and trim: `data-start`, `data-duration`, `data-media-start` (trim in-point, seconds).
- Gain: `data-volume` (0 = silence).
- `<video>` must be **muted + playsinline** and carry an **`id`**.
- Audio, if ever wanted, is a **separate `<audio id>`** on the same file.
- Composition code never calls play/seek.
- No `crossorigin`.
- **Never nest a timed `<video>` inside a plain element that also has `data-start`** (`video_nested_in_timed_element`). The scene wrapper that carries `data-start` must therefore not contain a `<video data-start>`: time the video only, or put the whole scene in a sub-composition, where nesting is allowed.
- Do not tween the timed media element's dimensions. Animate a non-timed wrapper (`.hf-media-frame`).
- **HyperFrames 0.8.46 has no playback-rate attribute**, so stepped and freeze effects must be pre-baked (see *Pre-baked media variants* below).

**DOM** (inside a stage scene; 1080-space px):
```html
<!-- window chrome is a plain, UNTIMED element; visibility is driven by the scene/slot timeline -->
<div class="hf-media-frame" id="m5-frame"
     style="position:absolute; left:267px; top:499.5px; width:753px; height:463.5px;
            border:1.5px solid #2a2d33; border-radius:9px; overflow:hidden; background:#000;">
  <div class="hf-media-head" style="height:39px; background:#11181e; display:flex; align-items:center;
       padding:0 13px; font:500 12px/1 'JetBrains Mono'; letter-spacing:.18em; color:#c9cdd3;">
    PLAYER VIEW · <span data-bind="state">LIVE</span>
    <i class="dot" style="margin-left:auto; width:9px; height:9px; border-radius:50%; background:#c53363"></i>
  </div>
  <!-- the timed media element: ONLY timed thing in this subtree; data-start is scene-local -->
  <video id="m5-trim3" src="assets/media/aim.mp4" muted playsinline
         data-start="8.30" data-duration="2.24" data-media-start="31.40" data-volume="0"
         style="position:absolute; left:0; top:40.5px; width:100%; height:calc(100% - 40.5px); object-fit:cover;"></video>
  <!-- overlays: absolutely positioned SVG/HTML in media-local % coordinates, above the video -->
  <svg class="hf-media-ov" viewBox="0 0 100 56.25" style="position:absolute; left:0; top:40.5px; width:100%;"> … </svg>
</div>
```

**Trim switching.** Place several sibling `<video>` elements, each with its own `data-start` / `data-duration` / `data-media-start`, back to back. The visibility window is half-open, so `b.start = a.start + a.duration` gives no gap and no double frame. The header, dot and overlays live on the untimed frame and persist across trims, exactly as in M5.

**Stills.** Use a sibling `<img id=… class="clip" data-start data-duration src=… style="object-fit:cover">` (an `<img>` needs `data-duration`). Set header `PAUSED`, dot `#d9aa46`, no transform.

**Freeze-frame** (M4). Render the trim's last frame to a PNG at build time (`ffmpeg -ss <in> -frames:v 1`). Use it as an `<img>` after a short `<video>`, or as the whole clip.

**Pre-baked media variants** (the variant file becomes the `src`):
- **Stepped 10 fps (LOD):** `ffmpeg -vf fps=10,fps=30` on the trim.
- **Rate ≠ 1:** `setpts=PTS/r`.

**Audio.** The reference is muted: omit `<audio>`, `data-volume="0"`. If a future style wants game sound under the voice, add `<audio id="m5-sfx" src="same.mp4" data-start data-media-start data-volume="0.12">` and duck it with a `volume` tween on the main timeline, around −18 dB under speech.

**Motion.**
- Entrance and exit are **none**: the frame appears and disappears with the scene hard cut, and the first media frame must be decoded on that cut.
- Shrink-to-thumbnail: GSAP on the **frame wrapper**, `{scale:0.403, transformOrigin:"100% 0%", duration:0.433, ease:"power2.inOut"}`, plus `opacity 1 → 0.85 → 1` mid-move. Then hard-swap to the proper thumbnail window at the next scene cut.
- Relayout between layouts is a hard cut, or the generic FLIP op with the right edge anchored (467 ms power2.inOut, as for the map at 75.27).

**Module name / props:**
```ts
media: {
  src: string,                 // local asset (never fetched at render)
  kind?: "video" | "image",    // default video
  in?: number,                 // data-media-start (s) of the first trim
  trims?: [{ src?, in: number, dur: number, at?: string /* word anchor */, variant?: "live"|"paused"|"stepped10" }],
  rect?: "stage" | "full" | "thumb" | [x, y, w, h],   // 1080-space; default "stage" (267,499.5,753,463.5)
  head?: string,               // "PLAYER VIEW · LIVE"
  dot?: "red"|"amber"|"green"|"none",
  overlays?: [ {type:"bracket", box:[x,y,w,h], tag?:string, tone?},
               {type:"cone", from:[x,y], dir:deg, spread:deg, len:number, tone?},
               {type:"pill", at:[x,y], text, tone?},
               {type:"reticle", at:[x,y], r:number, label?:string},
               {type:"tracer", from:[x,y], to:[x,y], label?:string, tone?},
               {type:"bar", label, value:0-1, display?:string},
               {type:"stat", corner:"tr"|"tl", eyebrow, value} ],   // coordinates in media-local % (0-100 × 0-56.25)
  audio?: { volume: number }   // omit = muted (reference)
}
```

**Ops** (word-triggered, in addition to GENERIC reveal / remove / dim):

| Op | Effect | Timing |
|---|---|---|
| `mediaCut {trim}` | switch to the next trim | 1 f, lead the word by ≈100 ms |
| `pause` | swap to the freeze PNG; head `PAUSED`; dot amber | 1 f |
| `resume` | — | — |
| `head {text}` / `dot {tone}` | 1-f swaps | 1 f |
| `overlayIn {i}` | overlay fade + 4.5 px rise | 100–133 ms |
| `overlayTone {i, tone}` | recolour an overlay | — |
| `tracer {i}` | draw | 167 ms linear |
| `bar {i, to}` | fill | 400 ms power2.out |
| `shrink {to:"thumb"}` | the FLIP above | 433 ms |
| `relayout {rect}` | hard cut, or FLIP 467 ms | — |

**Storyboard expression** (one scene):
```json
{ "template": "stage-media", "slots": {
    "label": "AIMING AND REACTIONS ARE DIALS TOO",
    "tabs":  { "active": "ANIMATE" },
    "media": { "src": "media/aim.mp4", "rect": "stage", "head": "PLAYER VIEW · LIVE", "dot": "red",
               "trims": [ {"in": 12.0, "dur": 4.07},
                          {"in": 31.4, "dur": 2.0, "at": "Accuracy"},
                          {"in": 40.1, "dur": 2.23, "at": "Reaction"} ],
               "overlays": [ {"type": "reticle", "at": [50, 25], "r": 10, "label": "ENEMY AIM · SPREAD"} ] },
    "below": { "module": "panel", "props": { "title": "GAME SYSTEMS · THE DESIGNER'S DIALS", "tone": "red" } } },
  "events": [ {"word": "difficulty", "op": "rowStatus", "row": 0, "status": "HARD"},
              {"word": "miss", "op": "tracer", "i": 1} ] }
```

`"rect": "stage"` resolves to the measured rect (267, 499.5, 753×463.5; media 750×423). `"full"` resolves to (60, 499.5, 960×585; media 957×540). `"thumb"` resolves to (639, 499.5, 381×241.5).

**Gates to add to the layout audit:**
- media AR within 1 % of the source AR (cover never crops more than 2 %);
- the first frame of every trim is non-black;
- no timed `<video>` has a timed ancestor;
- media assets are local and license-cleared.

---

## 3. Scene-by-scene timeline

Layout cuts are all **1-frame hard cuts** unless noted. "Label" = the per-sentence section label. Tabs: SENSE = teal, DECIDE = purple, NAVIGATE = green, ANIMATE = white.

| t0–t1 | Spoken | Layout / modules | Events (word-anchored, Whisper start → visual) | Out |
|---|---|---|---|---|
| 0.00–2.30 | "How do NPCs in video games actually work?" | Hook: 2-line title (`HOW DO NPCs` white, `ACTUALLY WORK?` dim → lit) + full-width media M1 | trim cuts 0.800, 1.600 | cut |
| 2.30–7.20 | "Because when an enemy spots you, runs behind cover, reloads, flanks you, and then starts shooting again," | M2 full width + **event-chip row** + engine log; label EVERY ENEMY YOU HAVE EVER MET | chips light: SPOTTED 3.300 (spots@3.16, +140 ms), COVER 4.500 (cover@4.38, +120), RELOAD 4.967 (reloads@5.06, −93), FLANK 5.533 (flanks@5.64, −107), FIRE 6.567 (shooting@6.44, +127); trims cut on RELOAD and FIRE; the log line types `→ STATE` | cut |
| 7.20–8.93 | "it can feel like it is actually thinking," | mascot enters; M3 + chips + `THINKING?` panel | mascot slide 7.23–7.60; `THINKING?` fades in ≈7.6 | cut |
| 8.93–12.07 | "but most of the time it isn't using AI like ChatGPT." | same; panel → `AI?` → `ChatGPT` chip + red X + 3 mono lines | red X stamp lands between 11.0 and 11.5 (2 fps sheet; "GPT"@11.14) | cut |
| 12.07–15.67 | "It is following a carefully designed decision system. Let's break that down." | M4 PAUSED + overlays + 4 layer tiles SENSE/DECIDE/NAVIGATE/ANIMATE (`FOUR LAYERS, EVERY TICK`) | HUD fades in 13.77–14.0; label A DECISION SYSTEM 14.27; tiles light in sequence ≈14.5–15.3 | cut |
| 15.67–26.00 | "First, the NPC needs to know… Is there cover nearby? The game constantly updates these signals." | floor-plan map (ROOM A–D, `YOU`, guard_07 + vision cone) + `SENSORS · GUARD_07` table (see_player / hear / distance / health / cover_nearby, 30 Hz); SENSE tab | labels 18.13 / 20.30 / 24.07; sensor rows update on each question (`gunshot · 12 m · faint`, distances tick, `1 nearby`); cone sweeps (ambient) | cut |
| 26.00–30.80 | "Now the NPC needs to decide… finite state machine." | FSM ghost + mini-map + STATE LOG; DECIDE tab; headline `FINITE STATE / MACHINE` dim at 28.00 | FINITE lit 29.633 (+53 ms), MACHINE 30.333–30.43 (+190…290) | cut |
| 30.80–47.27 | "Imagine an enemy has a few states… Switch to search. That is already enough…" | FSM pentagon (PATROL/CHASE/ATTACK/HIDE/SEARCH) + STATE LOG + mini-map | states light on each word; HUD STATE flips 35.87 / 37.53 / 40.00 / 42.00 / 43.87 (+20…+107 ms); transitions draw as arrows; log rows append | cut |
| 47.27–52.23 | "But as games get more complex… behavior trees." | FSM grows to 9 states + mesh of edges ("messy"); headline `BEHAVIOR / TREE` | edges multiply; headline lit ≈51 | cut |
| 52.23–69.73 | "Think of a behavior tree like a flowchart… patrol. The game designer builds the logic…" | BT flowchart panel (conditions → actions) + TICK panel + mini-map | condition rows highlight top → bottom on each question; YES/NO chips; action pill; tick counter panel; cone / route on the map | cut |
| 69.73–75.27 | "Now we have another problem… through walls." | map (full size) + `NAVIGATION · GUARD_07` panel; NAVIGATE tab | straight red line + X "blocked · 2 walls" on "walls" | cut, then FLIP |
| 75.27–91.03 | "So the game creates a navigation map… calculates a route…" | mascot out; map FLIPs to full width (75.33–75.77, 467 ms); `NAV MESH` headline in the label slot, dim → lit 78.03 | navmesh triangles wipe in; blocked hatch; stairs link; doorway arrow; A* frontier expands (`cells expanded` counter); route draws | cut |
| 91.03–97.60 | "So if an enemy wants to reach you… invisible navigation graph." | mascot back; map + `A HUMAN SEES` / `THE NPC SEES` cards; then the graph-only view | card compare; graph nodes + route | cut |
| 97.60–117.73 | aiming → "…fair and entertaining." | **M5** + DIALS panel (ACCURACY EASY/NORMAL/HARD + hit chance, REACTION TIME bar, MISS RULES); then goal cards; then `FEELS INTELLIGENT` headline | HARD lights on "difficulty"; delay bar fills; tracers; X on "smartest"; `FEELS INTELLIGENT` lit 115.00 (+100 ms); `✓ FAIR` / `✓ ENTERTAINING` chips | cut |
| 117.73–121.80 | "And then there are large open world games. Imagine a city…" | M6 full width → **M7 shrink** + city grid of blocks + `YOU` | grid dots populate (`NPCs` counter 247 → 2,400) | cut |
| 121.80–140.83 | "You cannot run complex decision logic… full character is simulated." | **M8** + FRAME BUDGET bars (TREES / CPU / FRAME RATE / CHECKS) → LEVELS OF SIMULATION (LOD 0/1/2 rows) → NPC_4821 RECORD; LOD rings on the grid | CPU 14 % → overload red; LOD rows light; stepped-10 fps footage on "far away"; record fields type in | cut |
| 140.83–159.87 | "And modern games can add more advanced techniques…" | 3 tool tiles (UTILITY / MACHINE LEARNING / GENERATIVE AI) + detail panel | utility bars fill (ATTACK .72 …) + score formula; NN diagram; generated-dialogue typewriter; old-systems tiles + counters; `PREDICTABLE / FAST / EASY TO CONTROL` rows | cut |
| 159.87–169.87 | recap "So the easiest way to think about an NPC is this…" | 4 layer tiles + floor-plan map | tiles light cumulatively 162.60 / 164.13 / 165.80 / 168.13 (tabs mirror them); cone → decision → route → animate | cut |
| 169.87–171.93 | "The NPC is not really thinking like a person." | `THINKING?` panel over the map | red X on "not"/"thinking" | cut |
| 171.93–175.00 | "The game is just extremely good at creating the illusion that it is." | **M9** + `THE ILLUSION` headline | lit 173.83 (+10…80 ms); ends on the last frame (no fade) | end |

---

## 4. Checklist items (A–I)

### A. Frame architecture

| # | Reference R8 (measured) | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 1 Safe zones | Top 0–235 and bottom 1530–1920 never drawn; side margins 60 px; mascot col 19.5–243 | DH bands per SPEC §3.1 (same numbers) | none | — |
| 2 Grid / columns | Mascot on: content col 267/268–1020 (≈753). Off: 60–1020 (960). Label/headline centred on the **content-column** centre (x 641 / 540). Tabs split the column into 4 equal tabs, gap ≈10. | DH content col + full-width mode exist | label centring axis must follow the column | tuning |
| 3 Content bbox | Mascot layout: label 346.5 → content bottom ≈1332 (51 % of H). Media window 267–1020 × 499.5–963. Full width: 499.5–1300.5. | similar DH bands | — | — |
| 4 Templates | T-hook (title + full-width media), T-media-below (window + panel below), T-map-panel (map + table), T-fsm (graph + mini-map + log), T-bt (flowchart + tick + mini-map), T-full-map, T-grid-thumb (grid + media thumbnail + side panel), T-tiles-detail (3 tool tiles + panel), T-headline-under-media | slot templates exist (`templates-*.js`) but none carries media | T-hook-media, T-media-below, T-grid-thumb missing | new templates |
| 5 Hierarchy | caption (cap ≈42, font ≈56–58 medium) ≈ headline tier (cap 76.5–78 ≈105 px heavy) > label (cap 25.5 ≈35 px) > tab text (19.5 incl. icon) ≈ HUD text > panel data (mono ≈11–15) | DH type scale | the label is smaller than R2's (25.5 vs 33) | tuning per profile variant |
| 6 Spacing | HUD → label 40.5; label → tabs 28.5; tabs → content 39–43.5; window → panel ≈20 | DH spacing | tabs band missing | new chrome |

### B. Persistent chrome

| # | Reference R8 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 7 HUD | Same box as R2. Fields: `DEBUG VIEW` teal badge (dark-teal fill, 1.5 px teal rim, tracked caps; hue read visually from `_hud.png`, not measured) · `NPC` micro + `guard_07` mono (swaps to `npc_4821` 135.5–140.8) · `STATE` micro + pill (`● PATROL` grey, `● CHASE`/`ATTACK`/`MOVE` red, `● SEARCH` amber, `● HIDE` blue, `● COVER`). **22 state flips**, word-anchored +20…+107 ms. `TICK` counter = frame number, 30/s. Fades in 13.77–14.0 (7 f); absent in the hook. | DH HUD with host/env/version/errors fields; flip/tick/retype | field schema is hard-coded; no free-running tick | new capability: HUD schema from storyboard + `tick` free-run |
| 8 Chapter indicators | **(a) Label** per sentence: 64 swaps; out 1 f, in fade 3 f (e.g. 2.367–2.433); median lead −87 ms vs Whisper start. **(b) Chapter tabs** SENSE/DECIDE/NAVIGATE/ANIMATE, 55.5 tall, active fills: teal #082f2e / #73c7c8, purple #201235 / #ad85d0, green #063116 / #70cd88, white #10171d / #edf4fa; inactive ≈#060606 with grey text. The active tab changes at 15.67 / 26.40 / 71.53 / 97.60. The **recap lights them cumulatively** (162.60, 164.13, 165.80, 168.13). Hidden in the hook and on full-width scaffolds. | `steps` module (in content, not chrome); label module | no persistent chapter bar, no cumulative recap | new chrome `chapterTabs` |
| 9 Mascot | Rick-like cartoon presenter with a sticker laptop, same bbox as R2. Present 7.2–75.27, 91.1–117.73, 140.83–175 (≈74 %). Enter: slide + fade 367–400 ms ease-out. Exit: **hard cut** (75.267, 117.733). Mouth flaps; eyes blink (not measured). **Asset rights: a copyrighted TV character — do not reproduce.** | DH mascot with enter/exit | same mechanics | asset: own character |
| 10 Captions | Rounded chip r≈9, fill #070c10, border 1.5 px #15181a, **no hard shadow**; h 105 (1423.5–1528.5), pad-x ≈38. Medium-weight grotesk, cap ≈42 (font ≈56–58). Karaoke white #f0f4f6 / **cyan #5fe4e6** active / grey #9a9eaa upcoming. Chunks 2–5 words. Swap = 2–3 f crossfade, sometimes one empty frame (16.833). | DH "sticker": 3 px white border + hard shadow, 800 weight | skin differs | tuning: caption skin `chip-cyan` |

### C. Visual design system

**11. Palette (measured).**

| Role | Hex |
|---|---|
| Background | #000000; dots #060805 |
| Surface | #090d11 (HUD / panels); window header #11181e |
| Border | #15191d / #262a2f |
| Text | #f0f4f6 / #cdd5d9 primary; #9a9eaa muted |
| Teal (sense / active caption) | #5fe4e6 / #3ec6c8; fill #082f2e |
| Purple (decide / headline accent) | #ad85d0 text, #a05cf0-ish headline; fill #201235 |
| Green (navigate / navmesh) | #70cd88 / #2ad56c-ish mesh lines; fill #063116 |
| Red (live / attack / danger) | #c53363 dot, #350712 chip fill |
| Amber (reload / search / paused) | #d9aa46; fill #392b04 |
| Blue (cover / hide) | #0b1c36 fill |

Hues on screen at once: 2–4, on a frame that is ≈85 % black.

| # | Reference R8 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 12 Typography | Heavy condensed-ish grotesk caps for headline (cap 76.5–78) and label (cap 25.5). Medium sans for captions. **Mono** for HUD values, window header, logs, records, formulas. Tracked micro caps for tabs, chips, eyebrows. | DH type roles | caption weight / skin; label size | tuning |
| 13 Panels | Flat #090d11 panels, 1.5 px border, r≈9, header row with an icon + tracked caps eyebrow in the chapter colour (e.g. `GAME SYSTEMS · THE DESIGNER'S DIALS` red). **App window** (§2.2). | `panel`, `browser`, `console` | media window missing | new module `media` |
| 14 Pills / chips | Event chips 161×57 (5 in a row, gap ≈12), two lines: tracked label + mono `t=3.28s`. Idle = dashed outline; lit = tinted fill + coloured text. HUD state pill with dot. `✓ FAIR` / `✓ ENTERTAINING` tags. Overlay pills on media. | `pill`, `chips` (grid) | timed event-chip row missing | new module `eventChips` |
| 15 Imagery | **Real gameplay video** (≈35 % of runtime); line icons (eye, brain, route, runner, gear); mascot. No photos or stills. | icon set; no media | video / image support missing | new capability |
| 16 Connectors | FSM arrows (curved, with arrowheads, *unlike* R1–R5); BT elbows; route polyline (green); dashed tracers; blocked red line + X | `connector`, `nodes` | arrowheads, route draw on a map | tuning / new op |
| 17 Charts / tables | Sensor table (key / value / status), utility bars + formula, FRAME BUDGET bars, LOD table, dials rows | `table`, `bars`, `panel` | mostly covered | tuning |
| 18 Data realism | `guard_07`, `npc_4821`, `block 31`, `civ.bt`, tick = frame, `hit chance 60 % / 85 %`, `+0.12 s`, `2,400 NPCs`, `first 2 shots miss · then 85 %`. Chip timestamps equal the actual reel times. | storyboard-driven | — | generator rule: timestamps from alignment |
| 19 Background | Flat black + static 54-px dot grid; never moves | same | — | — |

### D. Module catalog (item 20)

Stage modules seen:

| Module | Status |
|---|---|
| HUD, label, headline (dim→lit), caption, mascot | chrome / have |
| Chapter tabs | **new** |
| Media window | **new** |
| Event-chip row + engine log | **new** |
| THINKING / ChatGPT verdict panel | panel + stamp |
| Layer tiles (4, numbered, icon + name + sub) | ≈`letters` / `steps` variant |
| Floor-plan map with rooms, NPC, `YOU`, vision cone, route | **new `floorplan`** |
| Sensors table | `table` |
| FSM graph | `nodes` with arrows |
| State log | `panel` |
| BT flowchart | `tree` variant |
| Tick panel | `stat` |
| Navmesh / A* frontier | **new ops on `floorplan`** |
| City grid with dot population + LOD rings | **new `crowdgrid`** |
| Frame-budget bars | `bars` |
| LOD table | `table` |
| Record card | `code` / `panel` |
| Tool tiles + detail panel | `compare` / `panel` |
| Dials panel (segmented EASY / NORMAL / HARD selector + bar + text rows) | **new `dials`** |

### E. Motion system

| # | Reference R8 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 21 Entrances | Labels fade in 3 f, 100 ms. Panels: hard cut with the scene. Chips flash to grey-white (#4e4e42) then settle to their tint in 4 f (133 ms). Headlines pre-shown dim (lum ≈22 %) then lit in 2–3 f. Mascot slide 367 ms ease-out. HUD fade 233 ms. | reveal (4.5 px rise), slam, headline | "dim → lit" headline and chip flash-settle | new op `light` on headline, `flash-settle` |
| 22 State changes | HUD pill 1-f flips; tab relight 1 f; chip lit; sensor values tick; bars fill; condition rows highlight; typewriter logs; counters (NPCs 247 → 2,400) | generic ops | mostly covered | — |
| 23 Emphasis | red X stamp (ChatGPT, smartest, thinking); headline light-up; no glow, no shake | stamp, slam | — | — |
| 24 Exits / transitions | All scene changes are 1-f hard cuts, including media. Full-width FLIP 467 ms (75.33–75.77, Δw 1.5, 3, 7.5, 12, 19.5, 30, 36, 36, 25.5, 18, 12, 7.5, 1.5 → ease-in-out, right edge anchored). Media shrink-to-thumb 433 ms ease-in-out, origin top-right. | hard cuts + FLIP | media shrink | new op |
| 25 Ambient | Vision cone sweeps (continuous); TICK +1/frame; A* frontier; typewriters; dot population; **footage itself**; stepped 10 fps footage. Content-area frames identical: 25 %. | loops (flow dots, typing) | cone sweep, tick | new ambient ops |
| 26 Camera | None besides the FLIPs | FLIP | — | — |
| 27 Choreography | label (≈−90 ms) → scene cut → per-clause mutations (sensor rows, state lights, chips), media trims on clause boundaries, headline lights on the key word | per-word ops | media trims as beats | generator rule |

### F. Timing

| # | Reference R8 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 28 Beat density | Detector (content region minus media, with an ambient baseline): **123 beats = 42/min**, gap median 1.30 s, p90 2.73, max 4.40 (149.0, GenAI typewriter). This is a **lower bound**: ambient motion masks small mutations. Label swaps 64 (22/min), tab changes 23, state flips 22, media trim changes 25. | generator targets | — | — |
| 29 Word anchoring | Label −87 ms median lead (sentence onset). State pill +20…+107. Chips −107…+140. Headline light +10…+290 (median ≈+80). Media trims median −110 (range −230…+140). | anchors exist | add `lead` for media | tuning |
| 30 Sentence → treatment | enumeration → chips / rows light per item; "is not X" → red X stamp; term definition → dim→lit headline (FSM, BEHAVIOR TREE, NAV MESH, FEELS INTELLIGENT, THE ILLUSION); **concrete gameplay claim → media trim**; abstraction → freeze + overlay; "far away / reduced" → stepped footage; recap → cumulative chapter tabs | rules for R1–R5 | media rules | generator rule |

### G. Narrative

| # | Reference R8 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 31 Structure | Hook 0–15.7 on real footage (question title → the behaviour montage → "not ChatGPT" → freeze → "decision system"). Four chapters mirror the tabs (SENSE 15.7–26.4, DECIDE 26.4–71.5, NAVIGATE 71.5–97.6, ANIMATE/game systems 97.6–140.8). Extensions 140.8–159.9; recap 159.9–169.9; close on the footage + `THE ILLUSION` (last frame, no fade). | hook / outro rules | footage hook + footage close | storyboard |
| 32 Scaffold reuse | Floor-plan map persists and returns (15.7, 26 mini, 52 mini, 69.7, 75 full, 91, 159.9 recap). Media window returns 3× in the same rect. | host / slot | — | — |
| 33 Entity continuity | guard_07 / YOU / ROOM A–D positions constant; chapter colours constant (teal / purple / green / white); red = danger/live, amber = search/paused | — | — | — |

### H. Audio

| # | Reference R8 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 34 Voice | Single male narrator, 636 words in 175 s = **218 wpm**; 31 gaps >0.3 s, max 0.58 s | cloned voice ≈ target | — | — |
| 35 Mix | −14.1 LUFS, LRA 1.5, TP −0.9. Floor p5 −34.8 dBFS (no dead silence), speech p50 −18.5. **Footage audio muted** (§2.4). Beat SFX not detected by gap analysis. | −14 LUFS target, synthesized SFX | our SFX are an addition, not a reference trait | keep SFX sparse |

### I. Production

| # | Reference R8 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 36 Export | 720×1280 30 fps H.264 ≈438 kb/s (higher than R2's 250 because of the footage). One black frame at 13 trim starts (render artefact). | 1080×1920 HF render | media adds decode cost; pre-extracted frames avoid black starts | render gate |

---

## 5. New components / sections

### N1. `media` (embedded video / still window)
§2 covers it in full: anatomy §2.2, data and variants §2.1 / §2.4, motion §2.6, anchoring §2.4, props / ops §2.8.

### N2. `eventChips` (timed event-chip row + engine log)
- **Anatomy** (2.30–7.17, `ev_005.000.png`, 1080 space):
  - Row of 5 chips at y ≈1119–1184. Each chip is ≈182 wide × 65, gap ≈12, r≈6, directly under the media window (≈35 px gap).
  - Each chip: tracked caps label ≈12 px + mono `t=4.48s` ≈10 px.
  - Idle: dashed 1.5 px #2a2f33 outline on black, grey text.
  - Lit: fill red #350712 / blue #0b1c36 / amber #392b04, text in the hue.
  - Below: mono micro `engine log · npc.state` (#8a8f96) and a mono line `… -> TAKE_COVER -> RELOAD` (#e6e9ec) that appends the new state per chip.
- **Data:** `[{label, tone, t}]`, where `t` is the actual reel time of the word (the chip text equals its light time ±20 ms).
- **Motion:** light = 1-f flash to #4e4e42 (grey-white) → settle to the tint over 4 f (133 ms, ease-out). The log line appends the state 1 f later.
- **Anchoring:** −107…+140 ms around the verb.
- **Ops:** `light {i}`, `log {text}`.

### N3. `chapterTabs` (persistent chapter bar, chrome)
- **Anatomy:** 4 equal tabs in the content column at y 400.5–456 (h 55.5), gap ≈10, r≈6. Each tab has a line icon + tracked caps ≈13 px.
- **Colours:** see item 8.
- **Variants:** single-active (chapters) / cumulative (recap).
- **Motion:** 1-f relight.
- **Anchoring:** chapter start (−113…+80 ms); recap lights on each layer's noun.
- **Props:** `{items:[{text, icon, tone}], active, mode:"single"|"cumulative"}`.
- **Ops:** `activate {i}`, `light {i}`.

### N4. `floorplan` (top-down map)
- **Anatomy:**
  - A 750×570 (stage) or 960×720 (full) panel with 4 rooms (#2c3a44 walls ≈9 px, room labels tracked caps) and furniture squares.
  - The NPC: cyan ring Ø≈30 + label `guard_07`.
  - Player: white ring `YOU`.
  - Vision cone: translucent teal wedge + dashed hearing circle.
- **Ops:**
  - `cone {dir, spread}` (sweep ambient);
  - `route {points, tone}` (draw, ease-out);
  - `blocked {from, to}` (red line + X);
  - `navmesh` (triangle wipe);
  - `frontier {n}` (A* cells expanding, with counter);
  - `hatch {rooms}` (blocked);
  - `link {from, to}` (stairs);
  - `focus {room}`.
- **Anchoring:** per noun ("walls", "walkable", "blocked", "stairs", "doorway", "route").

### N5. `dials` (designer's dials panel)
Rows of icon + tracked caps key + a segmented selector (`EASY / NORMAL / HARD`, lit segment red) or a bar (amber fill) + a right mono value (`hit chance 85%`, `+0.60 s`, `first 2 shots miss · then 85%`).
- **Ops:** `select {row, seg}`, `fill {row, to, display}`, `text {row, text}`.

### N6. `crowdgrid` (city block grid + NPC dot population + LOD rings)
An 8×5 block grid, dots populating with a counter (`247 NPCs` → `2,400 NPCs`), dashed LOD rings (`LOD 0` / `LOD 1`) around `YOU`.
- **Ops:** `populate {to}`, `rings`, `tint {lod}`.

### N7. Headline "dim → lit"
An existing `headline` with a new op `light {line|word}`.
- Pre-shown at ≈22 % luminance (#353535-ish on black).
- Lit to white / purple in 2–3 f (67–100 ms) on the word.
- Examples: 29.633 (FINITE), 30.43 (MACHINE), 115.0, 173.83.

---

## 6. Pacing numbers

| Metric | Value |
|---|---|
| Beats/min | ≥42 (detector lower bound, 123 beats). Chrome alone: 64 label + 23 tab + 22 state events. |
| Layout scaffolds | ≈30 hard-cut layouts / 175 s ≈ 10/min (list in §3 + `chrome_events.json`). Per-sentence label life: median **2.65 s**, max 4.90 s. |
| Longest hold | 4.40 s (149.0, the typewriter keeps moving). Next: 4.33 (105.9), 4.30 (30.8), 4.07 (97.6). |
| wpm | 218 (636 words / 175 s) |
| Word → visual | label −87 ms · state +20…+107 · chips −107…+140 · headline +10…+290 · media trim −110 median (all ±0.15 s ASR) |
| Media share | 61.5 s on screen (35 %), 9 window states, ~25 trims, median trim ≈2.0 s (M5 cut list) |

## 7. Prioritised gap list (R8)

1. **P0 `media` module.** `<video>` window with trims, freeze / stepped variants, overlays, stage / full / thumb rects, muted, first-frame-decoded gate. No media support exists in v3.
2. **P0 media storyboard rules.** Concrete-behaviour sentences → trim; cut on clause boundaries with a ≈−100 ms lead; hook and close on footage; asset library + licence field.
3. **P1 `chapterTabs` chrome** (single + cumulative recap) and **per-sentence label** cadence.
4. **P1 `floorplan` module** (cone / route / navmesh / frontier / blocked ops). It carries ≈45 % of the runtime.
5. **P1 `eventChips` + `dials` modules**, and **headline dim → lit** op.
6. P2 caption skin `chip-cyan` (rounded dark chip, medium weight, cyan active); HUD schema variant with a free-running `TICK`.
7. P2 ambient: cone sweep, tick counter; media shrink-to-thumb FLIP; `crowdgrid`.
8. Asset: our own presenter. R8's mascot is a copyrighted character, and R8's footage is third-party gameplay: do not reuse either.

## Evidence frames (this folder)

| Topic | Frames |
|---|---|
| Hook | `ev_000.500` |
| Re-layout + black first frame | `ev_002.267` / `ev_002.300` / `ev_002.333` |
| Chips | `ev_005.000` |
| Mascot layout | `ev_007.167` / `ev_007.200` / `ev_007.300` |
| Freeze | `ev_012.033` / `ev_012.067` / `ev_012.100` / `ev_013.500` |
| Floor-plan scaffold | `ev_020.000` |
| Full-width FLIP | `ev_075.500` |
| Media enter | `ev_097.567` / `ev_097.600` |
| Overlays | `ev_104.800`, `ev_108.500` |
| Exit to full width | `ev_117.700` / `ev_117.733` / `ev_117.767` |
| Shrink | `ev_118.567` / `ev_118.700` / `ev_118.800` / `ev_119.000` |
| Thumbnail | `ev_130.000` |
| Stepped playback | `ev_133.500` |
| Close | `ev_171.900` / `ev_171.933` / `ev_171.967` / `ev_174.800` |
