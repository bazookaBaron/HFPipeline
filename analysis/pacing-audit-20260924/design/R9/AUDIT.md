# R9 design & motion audit: "What exactly is Anduril?", a media-heavy company explainer (`R9_Ddb-aswiHnN`)

**Source.** `C:/Users/debna/Downloads/igexport-Ddb-aswiHnN.mp4`. The same file is `V4` in `analysis/script-audit-20260926/`, which has a script-only analysis.
- Video: native **720×1280**, H.264, 30 fps CFR, **169.02 s**, 5067 frames, ≈418 kb/s.
- Audio: AAC 48 kHz stereo.

**Loudness** (`ebur128`, `loud.txt`): **I −14.1 LUFS**, **LRA 1.5 LU** (−14.9 / −13.4), **TP −1.0 dBFS**.

**Conventions.** These match R8.
- Pixels are measured on native frames and reported **×1.5 in 1080×1920 space** (±1.5 px).
- Hex values carry ±3/channel of IG noise.
- 1 f = 33.3 ms. Times are seconds in the reference file.
- Word times come from the existing local faster-whisper `small` CPU/int8 ASR (`asr.json` = `script-audit-20260926/V4.asr.json`, 477 words; flattened in `words.txt`). It was reused because `faster_whisper` is not installed in the system Python today. No new ASR was run and nothing was uploaded.
- ASR mis-hears the brand: "Enduroil" = Anduril, "WID" = "It", "Par Malukki" = Palmer Luckey. Treat ASR starts as ±0.15 s (SPEC convention).
- **IG GOP artefact:** every 5.000 s (frame multiple of 150) a key-frame re-quantisation produces a 0.3–1.2 MAE blip in every region. The detectors below exclude those frames. Do not read them as events.

**Scripts and raw outputs** (this folder). Scratch PNG/NPY/WAV are git-ignored.
- `sig.py` → `sig.json`: per-frame region mean and MAE for HUD / panel / media card / card caption / mascot / caption / all.
- `small.npy`: 1/8-scale grey frames, used for eyebrow swaps and onsets.
- `ev.py`: clusters the change events per region.
- `beats.py` → `beats.txt`: beat and scene pacing.
- `bbox.py`: per-frame bbox of the lit pixels (entrance curves).
- `prof.py`: colour runs along a line (edges, fills).
- `strip.py` / `crops.py`: frame strips and crop grids (`_st_*.png`, `_cards.png`, `_panels.png`, `_mascot.png`, zooms `_z_*.png`).
- `sheets.py` → `sheets/s00–s11.png`: 2 fps contact sheets. `f2/` holds the 2 fps frames; `sc/` holds the one frame that passed ffmpeg `select='gt(scene,0.25)'`, at 5.600.
- Evidence frames: `ev_<t>.png`.

**Scene-change note.** ffmpeg's scene score crosses 0.25 **once** (5.600, the only full-frame re-layout). Everything else is an incremental change inside a persistent chrome, so a scene detector is useless on this template. The region-MAE detectors are the source of truth.

**Our pipeline** is read from `orchestrator/lib/video/v3/{catalog,media,promo,composeStage}.js`, `lib/stage/modules-*.js` and PLAN_R6-R8. Nothing was re-rendered.

---

## 0. Measured geometry map (1080×1920)

| Band / element | R9 (measured) | Evidence |
|---|---|---|
| Top dead zone | 0 – ≈195: background only | all |
| HUD row | Left: chapter label, mono caps, cap 12 (font ≈17), #909196, at x 60, cap-top y 205.5. Centre-right: **9-segment chapter progress**, x 585–840, 3 px tall, active #4a678f, idle #15191f. Right: **running timecode** `T+ 00:00:17.5`, mono ≈17 px, #909196, right edge 1020, equal to the reel time in 0.1 s steps. Hairline rule under the row at y 237, #15161b, x 60–1020. | `ev_8.500`, `ev_79.500` |
| Content panel ("stage") | x 60–1020 × y 267–1010.5 (**960×743.5**). 1.5 px border #121316–#1d1e23, square corners (r≈0). Eyebrow inside at (72, 289.5): mono caps, cap 12, #9a9ca2, **changes per sentence (54 swaps)**. | `ev_17.500`, `ev_55.000` |
| **Media dock** (bottom-left card) | outer x 60–600 × y 1057.5–1362 (540×304.5). Media + opaque caption strip. **Viewfinder corner brackets** sit 4.5–6 px *outside* the card. | `ev_8.500`, `ev_79.500` |
| Presenter | right-bottom, bbox x 660–1060 × y 789–1336 (396×548), plus a floor shadow ellipse ≈y 1350–1377. Overlaps the panel's bottom-right by ≈220 px, so the presenter sits **in front of** the panel. | `ev_8.500` |
| Caption chip | centred on 540, y ≈1444–1547 (h ≈102), text centre ≈1495 (77.9 % H), width hugs the text | `ev_8.500` |
| Bottom dead zone | 1550–1920 background only | all |
| Background | #07080b with a static line grid, lines #101114, **60 px pitch** | `ev_8.500` |
| Full-width layouts | hook (0–5.6): hero media 60–1020; mascot-out beats (51.77–54.10, 105.77–108.17, 165.97–end): panel only, headline under it at y ≈1100–1260 | `ev_3.000`, `ev_168.500` |

---

## 1. Style profile: a **new DH variant, "DH-dossier"** (dark HUD + panel + B-roll dock + right presenter)

Shared with DH (R2/R8):
- black plate with a static grid;
- persistent top chrome;
- per-sentence eyebrow cadence (R8 changed its label every sentence; R9 changes 54×, ≈19/min);
- dim→lit headlines;
- rounded dark caption chip with 2–4 word chunks;
- mascot always present except on climax headlines;
- hard cuts between layouts.

What makes it a variant rather than a new profile (the knobs):
1. **Two parallel visual lanes.**
   - The top **panel** carries the explanation (diagram, chart, grid, map) and changes per clause.
   - The bottom-left **media dock** carries evidence B-roll: real photos or real footage, each with a caption and a source credit. The dock has **its own cut list**: it swaps on sentence boundaries that do not line up with the panel's layout changes, and it is absent in ≈40 % of the reel.
2. **Presenter on the right**, bigger than DH's (396×548 vs 224×786 in R2/R8), enters by sliding in from the right, and hard-cuts out on the three headline climaxes.
3. **HUD = chapter label + segmented chapter progress + running timecode.** It has no badges or state pill. 9 chapters = 9 segments.
4. **Credits on every raster**: each photo and video has on-frame source attribution (§2.9).
5. **Squarer, flatter surfaces.** The panel has square corners. Cards are r≈3–4 with a 1–1.5 px border, no shadow, and a navy tint when lit (#0b1c2d fill, #1a3a63 border).

**Rights.** The presenter is a recognisable copyrighted cartoon character, and the reel's footage/photos are third-party (mostly US-government public domain, plus CC BY portraits). **Copy mechanics and measurements only, never assets.** Our presenter is the original robot (commit 78f9c19).

---

## 2. Image / video components (top priority)

Media coverage:
- ≥1 photo or video is on screen for **≈111 s of 169 s (66 %)**.
- The dock alone runs ≈88 s (51 stills-seconds + 37 video-seconds).
- The hook hero window runs 5.6 s.
- Distinct rasters: **≈34** (hero clip, 11 dock video trims, 10 dock stills, 4 grid photos, 2 portraits, 1 product tile, 4 tree photos, 1 nested feed clip), plus **≈10 logo marks** and **4 vector silhouettes** that stand in where no photo exists.

### 2.1 Inventory by component type

| # | Component | Where / when | Media | Credit shown |
|---|---|---|---|---|
| C1 | **Hero footage window** (viewfinder skin) | hook 0.00–5.60, full width | 1 continuous video clip (1×, no trims), with HUD overlays on the footage | chip top-right `US DOD · PUBLIC DOMAIN` |
| C2 | **Media dock: still card** | 10 holds: 7.97–14.00, 22.33–31.13, 33.87–41.53, 48.33–51.77, 54.10–57.20, 76.97–78.57 (spec variant, C8), 108.17–113.47, 127.97–133.33, 133.33–139.27, 162.20–165.97 | photo, cover-cropped, **static** (per-frame MAE 0.00: no Ken Burns) | 2nd strip line, e.g. `US ARMY PHOTO · PUBLIC DOMAIN`, `LIVE-FIRE TEST · US AIR FORCE PHOTO`, `AL UDEID · US AIR FORCE PHOTO` |
| C3 | **Media dock: live video card** | 57.20–69.07 (4 trims), 72.57–76.97, 78.57–80.80, 86.10–95.70 (2 trims), 99.87–105.77 (2 trims), 120.60–123.67 | real footage, 1× (0 duplicated frames), muted | chip top-right `US DOD · PUBLIC DOMAIN`, plus `● LIVE` pill top-left; the strip line ends with the unit and year (`USMC 2021`, `US ARMY 2026`) |
| C4 | **Photo grid 2×2 with placeholders** | 14.00–19.37 | 4 photos fill named dashed slots on their nouns | per-cell sub-line `~ $80M EACH · USAF PHOTO` |
| C5 | **Portrait card + bio block** | 34.60–41.53 | 3:4 portrait with a name strip | bio line `PHOTO CC BY 2.0 · COLLISION 2019` |
| C6 | **People row** (founders) | 39.93–41.53 | 5 cards: 2 photos + **3 silhouette placeholders** (no free photo) | `PHOTO CC BY 2.0 · TECHCRUNCH` on the photo card |
| C7 | **Image tiles with silhouette fallback** | 48.50–51.77 | GHOST-X photo tile + MISSILE vector silhouette tile (tag `SILHOUETTE`); both struck/dimmed on "not one drone or one missile" | none on the tile; the silhouette is labelled as such |
| C8 | **Spec card** (image + spec list) | 76.97–78.57 (dock slot); 22.33–27.30 GHOST-X spec (no image, panel) | photo left + 5 key/value rows right | strip `IDEX 2025 · CC BY 4.0` |
| C9 | **Hardware tree with photo leaves** | 72.57–87.77 | root bar `LATTICE` + 6 leaves; dashed placeholders fill with photos (GHOST-X, ROADRUNNER, FURY, SENTRY) or silhouettes (BARRACUDA, DIVE-LD) on each product name | no per-leaf credit; the dock carries the credited version of the same subject |
| C10 | **Nested live feed tile** | 113.47–117.93 | a small video window (with its own `● LIVE` + credit chip) inside a 6-tile "feeds" grid; the other tiles are vector (radar sweep, waveform, coordinates) | chip `US DOD · PUBLIC DOMAIN` |
| C11 | **Logo chips / logo cards / wordmark lockups** | chips 2.5–7.77 (Palantir, SpaceX, OpenAI, Anduril); Oculus VR / Facebook 37.9–41.5; logo cards 145.1–156.47; Anduril lockup 5.77–14, 145–156, 168.13–end | white monochrome wordmarks on dark chips/cards, never recoloured; lit card = navy tint | none (nominative) |
| C12 | **Topographic map plate** | 51.77–72.57, 87.77–105.77, 108–113, 162–169 | vector contour map (drawn, not a photo) as the panel background, with icon nodes, links, vision cones, rings | n/a |
| – | Not used anywhere | full-bleed B-roll, Ken Burns, split screen, PiP over the presenter, cut-outs, masks / text knock-outs, screenshots of articles | – | – |

### 2.2 C2/C3 media dock: anatomy (1080 space)

| Part | Still card (`ev_8.500`) | Live card (`ev_79.500`) |
|---|---|---|
| Outer | x 60–600 × 1057.5–1362 (540×304.5); 1.5 px border #26272c; r≈0–1.5 (square) | same rect |
| Media | x 61.5–598.5 × 1057.5–1318 (**537×261, 2.06:1**), cover-cropped from 16:9 / 3:2 sources (≈13 % vertical crop of a 16:9) | x 61.5–598.5 × 1056–1330 (537×274, 1.96:1) |
| Caption strip | y 1318–1360.5 (h ≈42), **opaque** #141518–#1b1c1f. Two lines of mono caps, tracked ≈0.18 em. **Title**: cap ≈9–10 (font ≈13), #c8c9cc. **Credit**: cap ≈7.5 (font ≈11), **#6d6e72** | y 1330–1360 (h ≈30), one line, **title only** (font ≈13, #b8b9ba), e.g. `YFQ-44A FURY · TAXI · USAF` |
| Credit | 2nd strip line, bottom-left, x 72 | **chip top-right**: x ≈417–589 × 1062–1089 (h ≈27), fill ≈#1d1c19 at ~80 % over the footage, r≈3, mono caps font ≈11, #c4b49b-ish (it takes the footage tint through the fill) |
| Status | – | `● LIVE` pill top-left x 66–123 × 1062–1089: dot #a0bce6 (pale blue, not red), text #adcaef |
| Corner brackets | 4 L-marks, arm ≈18, 1.5 px, **#292a2d (dim)**, 4.5–6 px outside the card | same geometry, **light grey #c8c8c8** (brighter = "live") |
| Shadow / glow | none | none |

**Entrance.**
- First appearance only (7.967 → 8.233, 8 f ≈ 267 ms): opacity 0 → 1 + rise ≈10 px (top 1068 → 1058). Luma deltas 17, 11, 9.6, 5.5, 4.7, 1.5, 0.8, 0.5 → **power2/3.out**.
- **Every later swap is a 1-frame hard cut**, both still → still and still ↔ video (e.g. 57.167 → 57.200 in `_st_vid_in.png`). There is no crossfade.

**Exit.** 1-f hard cut: to a vector panel in the dock slot (14.00, 31.13, 41.53, 69.07, 80.80, 95.70, 113.47, 123.67, 139.27) or to nothing on mascot-out climaxes (51.77, 105.77, 165.97).

**Caption swap without an image swap:** 27.30 (`10TH MOUNTAIN DIVISION` → `FIELDED WITH THE ARMY`, strip-only change on "Faster").

**Cut anchoring.** Dock swaps land on sentence onsets, median **≈−80 ms** (range −180…+190, n=24).
- Examples: 14.00 vs "Traditional"@14.18 (−180); 33.87 vs "The"@33.94 (−70); 48.33 vs "But"@48.34 (−10); 57.20 vs "Radars"@57.24 (−40); 61.60 vs "normally"@61.36 (+240, mid-sentence clause); 65.87 vs "It"@65.96 (−90); 67.60 vs "combines"@67.60 (0); 72.57 vs "Now"@72.38 (+190); 76.97 vs "Roadrunner"@77.10 (−130); 78.57 vs "Fury"@78.58 (−10); 86.10 vs "surveillance"@86.20 (−100); 99.87 vs "Not"@99.82 (+50); 108.17 vs "This"@108.24 (−70); 120.60 vs "So"@120.72 (−120); 127.97 vs "The"@128.06 (−90); 162.20 vs "It"@162.34 (−140).
- In the hardware list (76–87), dock swaps follow **each product name**, so the dock illustrates the noun the panel just added.

**Video trims inside one dock run** (C3). The strip text changes with each trim, and each trim starts on a clause:
- 57.20 `A REAL SENSOR MAST · SENTRY · USMC 2021`
- 61.60 `SENTRY · MOBILE TOWER · USMC 2021`
- 65.87 `LATTICE · FIELD OPERATIONS CENTRE · USMC 2021`
- 67.60 `LATTICE · REAL SCREEN · USMC 2021`

Playback:
- Per-trim median MAE is 0.25–7.7, with 0–5 % duplicate frames → real time, 1×.
- Some trims repeat every 4th frame (78.57, 87.77, 120.6), i.e. a 24 fps source shown at 30 fps with no interpolation.
- Motion starts on the first frame of each trim. **No black or held first frames**: the card mean at every swap jumps straight to the new level (checked at 21 swaps).
- There is **no freeze or stepped variant** (R8 had both).

**Mismatch to avoid:** 105.47 shows a drone in the sky under the caption `GHOST-X · GROUND CONTROL` (the strip was not updated). Our generator must write the strip from the asset's own metadata.

### 2.3 C1 hero footage window (hook)

- **Rect:** media x 60–1020 × 292.5–805.5 (960×513, **1.87:1**); caption strip 805.5–837 (h 31.5, #232c33, mono caps font ≈13, #c0c8cf) `YFQ-44A · AIM-120 LIVE FIRE · MOJAVE`. **No header bar** (unlike our `media` DH skin).
- **Corner brackets** outside the rect (x 54 / 1026), arm ≈18, #717579.
- **Overlays on the footage.** All are static in screen space, except that the target brackets sit around the jet the camera tracks:
  - source pill top-left `● LATTICE · AIR PICTURE`: x 69–213 × 300–321, fill #18222c ≈85 %, r≈3, text/dot #a5bee6, mono caps ≈11;
  - **credit chip top-right** `US DOD · PUBLIC DOMAIN`: x 832–1016 × 300–321, same style, text #a4bace;
  - **track box** (3 mono lines: `TRK 0417 · YFQ-44A` / `FRIENDLY · 412 KT` / `AIM-120 · RELEASE`): ≈333–556 × 448–514, dark translucent fill, fades in 0.20–0.27;
  - **target brackets** (4 L-marks ≈30 px) around the aircraft;
  - **callout pill** bottom-left `WEAPON RELEASE · AIM-120`: fill #0d2238, r≈4, text #a7c1dc, appears ≈2.4.
- **Motion:**
  - the window is present from frame 1 (no entrance);
  - the title under it fades in per line with a scale 1.044 → 1.0 over 4 f (0.163–0.297: bbox width 918 → 879);
  - exit is a **1-frame hard cut** at 5.600 (the only scene-score > 0.25 frame).
- **Footage:** one continuous clip (panel MAE median 1.1 throughout, no cut spikes), 1×, muted.

### 2.4 C4 photo grid 2×2

- **Rect** (inside the panel): cells x 60–457.5 and 477–876 (397.5 wide, gutter ≈19.5); rows y 316.5–541.5 and 547.5–772.5 (225 tall, gutter ≈6).
- Each cell has a photo (≈397×180, ≈2.2:1 cover crop) and a 2-line strip:
  - title `FIGHTER JETS · F-35A`: mono caps ≈13, #c4c7cc;
  - sub `~ $80M EACH · USAF PHOTO`: ≈11, #6b6d72.
  - The credit is merged into the sub-line.
- **Idle:** dashed 1.5 px outline with a grey caps placeholder word (`FIGHTER JETS`, `MISSILES`, `RADARS`, `SHIPS`).
- **Fill on the noun:** opacity 0 → 1 + rise ≈6–8 px, **4 f (133 ms)**, ease-out.
  - 15.70 "fighter"@15.68 (+20)
  - 16.50 "missiles"@16.44 (+60)
  - 17.00 "radars"@16.98 (+20)
  - 17.47 "ships"@17.52 (−50)
- **Group beat** 18.10 ("huge"@18.02): the whole grid dims to ≈45 %, a 1.5 px bracket frame wraps it, and a tag `HUGE WEAPON SYSTEMS` (navy chip) drops under it.
- **Exit:** hard cut 19.37.

### 2.5 C5/C6 portrait card, people row

- **Portrait:** frame x 78–282 × 468–738 (≈204×270, **3:4**), photo cover-cropped to the face (the head is kept in the upper third). Name strip inside the bottom of the photo: `PALMER LUCKEY` / `FOUNDER · 2017`, mono ≈11–12. Corner brackets as on the dock.
- **Bio block** to its right at x 307:
  - name in heavy grotesk caps (cap ≈27, font ≈38, white);
  - blue mono meta line `FOUNDER · ANDURIL INDUSTRIES · 2017` (#6f9fd8-ish);
  - grey `COSTA MESA, CALIFORNIA`;
  - **credit** `PHOTO CC BY 2.0 · COLLISION 2019` at **cap 9 (font ≈12), #616266**: the smallest text in the reel.
- **Entrance:** 34.60 → 34.73 (4 f) fade + rise on "founded"@34.50 (+100).
- **People row** (39.93, "along with several co-founders"):
  - 4 more cards (≈160×266 each, gap ≈13) to the right of the portrait;
  - 1 real photo (`TRAE STEPHENS`, credit `PHOTO CC BY 2.0 · TECHCRUNCH`);
  - 3 **placeholder cards** with a line-icon person silhouette on #0d1117 and the name/role, shown where no licensable photo exists;
  - entrance 4 f each, near-simultaneous.
- **Timeline** above: 2012–2025, 14 ticks, markers at 2017 then 2012 / 2014 / 2017 (blue).

### 2.6 C7/C9 image tiles, silhouette fallback, strike

- **Tile** (48.33–51.77): ≈300×300 (x 120–420 and 459–759, y 372–670).
  - Image top ≈300×237; label strip with bold white `GHOST-X` + mono grey `ONE DRONE`.
  - Lit border 1.5 px #2d5a8a-ish.
- **Silhouette tile:** a flat light-blue (#8fc2fb) vector side-view of the object on #0d1117, tag `SILHOUETTE` top-right in 9 px mono.
- **Strike:** at "not one drone or one missile" (50.16–51.26) both tiles dim to ≈40 % and a 1.5 px line crosses them (the generic `strike` look); then `THE SOFTWARE UNDERNEATH` types under them (51.3).
- **Tree leaves** (C9): 220×200 cards, image 219×140, strip title (bold) + mono sub (`AUTONOMOUS UAS`, `VTOL INTERCEPTOR`, `FIGHTER-STYLE AIRCRAFT`). Placeholders are dashed with a centred grey caps name. Fill = 4 f fade:
  - 76.20 "Ghost"@76.32 (−120)
  - 77.00 "Roadrunner"@77.10 (−100)
  - 78.60 "Fury"@78.58 (+20)
  - Barracuda ≈80.9, Dive-LD ≈83.8, Sentry ≈86.2
- **Connector bus** from the `LATTICE` root bar (x 99–981, h ≈66, navy lit) to the leaves: 1.5 px #3b5f8a elbows.

### 2.7 C10 nested live feed tile

A 6-tile feed grid (113.47–117.93): tiles ≈165×90 at 3 columns. Tile 1 `CAMERA FEEDS` holds a **mini video window** (≈165×75) with its own `● LIVE` pill and credit chip at ≈7 px font. The others are vector feeds (radar sweep, radio waveform, coordinate list, aircraft, drones). Tiles fill on each spoken noun (113.46 / 114.32 / 114.84 / 115.86 / 116.58 / 117.28). **This nested footage is legible only as "real video", not as content**, a texture use of media.

### 2.8 C11 logos

- **Hook chips:** 4 dashed slots 60–1020 (4 × ≈222×132, gap 22). They fill: Anduril first (≈2.5, navy lit chip with `DEFENSE` sub), then Palantir (≈3.4), SpaceX (≈4.3), OpenAI (≈4.9). Each fill is a 3–4 f fade.
- At 5.60 the row moves down to "MENTIONED ALONGSIDE" at a smaller scale (hard cut).
- **Wordmark lockup:** logo symbol + `ANDURIL` wordmark, height ≈96 (cap ≈64). Fade 3 f (5.767–5.833), with tag chips `HARDWARE · SOFTWARE · AI · AUTONOMY` below.
- **Logo cards** (145.10–156.47): 3 × ≈290×350; logo in the header, a grey mono descriptor, then a big caps word lighting in (`DATA` 150.43, `HARDWARE` 153.37, `DEFENSE` 155.83); the active card gets a navy tint.
- Logos are never recoloured, cropped or animated beyond fade. Source/credit is not shown (nominative use).

### 2.9 Source / credit labels (the attribution system; measured)

| Placement | Text pattern | Size (1080) | Colour | Where used |
|---|---|---|---|---|
| **Chip, top-right inside the media** | `US DOD · PUBLIC DOMAIN` | h 21–27; mono caps font ≈11, tracking ≈0.2 em; pad-x ≈9 | fill #17222a / #1d1c19 at ≈80–85 % alpha, r≈3; text #a4bace (the tint depends on the footage) | every **video** (hero, dock live cards, nested feed) |
| **2nd line of the caption strip** | `<UNIT/EVENT> · <SOURCE> PHOTO` or `<SOURCE> PHOTO · PUBLIC DOMAIN`; CC: `IDEX 2025 · CC BY 4.0` | cap ≈7.5 (font ≈11) | #6d6e72 on #16181b (contrast ≈3.4:1) | every **dock still**, grid cells, spec card |
| **Bio line beside the photo** | `PHOTO CC BY 2.0 · COLLISION 2019` | cap 9 (font ≈12) | #616266 on #07080b | portraits, people row |
| None | – | – | – | logos, silhouettes (labelled `SILHOUETTE`), vector maps |

Observations:
- The credits carry **licence + provenance** (US DOD / US Army / USAF / US Navy / USMC, public domain; CC BY 2.0 / 4.0 with event or outlet).
- **Author names are absent even for CC BY items.** CC BY requires attribution to the creator "in any reasonable manner", so the reel's CC credits look incomplete. *Our spec must include the author* (§7.8).
- Credit text is readable but small: 11 px at 1080 ≈ 3.7 px on a 390-pt-wide phone. Keep credits ≥13 px (§7.8).
- The title line carries **subject · place · unit · year** (`GHOST-X · LAUNCH · HOHENFELS · US ARMY 2025`), which doubles as a factual caption. That metadata comes from the source record, not from the script.

---

## 3. Scene table (shot list)

Layout changes are 1-f hard cuts unless noted. "Dock" = the bottom-left media card lane.

| t0–t1 | Narration (ASR, brand fixed) | Panel (top) | Dock | Other events |
|---|---|---|---|---|
| 0.00–5.60 | "What exactly is Anduril? People keep mentioning it alongside Palantir, SpaceX and OpenAI." | **Hook, no mascot:** C1 hero video + 2-line title `WHAT EXACTLY / IS ANDURIL?` (white, heavy grotesk, cap ≈90, pitch 136.5) + 4 logo slots | – | title L1 0.17, L2 ≈1.0; overlays 0.20; chips fill 2.5 / 3.4 / 4.3 / 4.9 |
| 5.60–7.77 | "But Anduril is doing something very different." | Anduril lockup + 4 tag chips; logo row demoted to "MENTIONED ALONGSIDE" | – | mascot slides in from the right 5.63–6.07 (below); pill `DOING SOMETHING VERY DIFFERENT` ≈7.3 |
| 7.77–14.00 | "It is a defense technology company trying to rebuild military hardware around software, AI and autonomy." | ch.2 REBUILDING DEFENSE; eyebrow → `DEFENSE TECHNOLOGY`; at 10.00 a **4-layer stack** AUTONOMY/AI/SOFTWARE/HARDWARE, rows light hardware 10.8 → software 11.6 → AI 12.4 → autonomy 13.1 | **still** `GHOST-X · REDSTONE ARSENAL` (first entrance 7.97–8.23) | tag `+ DEFENSE TECHNOLOGY COMPANY` 8.43 |
| 14.00–19.37 | "Traditional defense companies build fighter jets, missiles, radars, ships and other huge weapons systems." | **C4 2×2 photo grid** fills per noun; group + `HUGE WEAPON SYSTEMS` 18.10 | panel `PROGRAMME CLOCK · YEARS / SOMETIMES DECADES` + bar | – |
| 19.37–22.33 | "And those programs can take years, sometimes decades." | counter `0 → 20+ YEARS` + bar fill; `DECADES` headline slam 21.4 | programme table | – |
| 22.33–27.30 | "Anduril's idea is what if defense hardware was built like modern technology products." | question headline `WHAT IF DEFENSE HARDWARE WAS / BUILT LIKE A TECH PRODUCT?` dim → lit per phrase; product spec card GHOST-X v4.2 (≈25.0) | **still** `GHOST-X · 10TH MOUNTAIN DIVISION` | – |
| 27.30–31.13 | "Faster development, more software, more autonomy, more iteration," | 4 benefit rows light: bar `MONTHS, NOT YEARS`; `160,000 → 240,000 LINES` counter; `1 OPERATOR : 10 SYSTEMS`; `v1.3` | same still, **strip swap** → `FIELDED WITH THE ARMY` | – |
| 31.13–33.87 | "and cheaper systems produced at much larger scale." | `1 PLATFORM` tile vs icon grid counting `+0 → +100` | panel CHEAPER / MORE / FASTER | – |
| 33.87–41.53 | "The company was founded in 2017 by Palmer Luckey, the guy who founded Oculus before Facebook acquired it, along with several co-founders." | ch.3 THE COMPANY; timeline 2012–2025 → **C5 portrait** 34.6 + bio 36.0 → `OCULUS VR` / `FACEBOOK` logo chips + arrow `ACQUIRED` 37.9–38.9 → **C6 people row** 39.93 | **still** `GHOST-X IN FLIGHT · ROMANIA` | – |
| 41.53–48.33 | "In 2025 it reached a valuation of more than $30 billion, making it one of the most valuable private defense technology companies." | column chart `VALUATION · PRIVATE ROUNDS, AS REPORTED`, 5 columns grow, the last bright blue #3fa3ff `$30.5B` | big counter `$0.7B → $30B+` (heavy, cap ≈40) | note line 45.97 |
| 48.33–51.77 | "But the most important part of Anduril is not one drone or one missile," | **C7 tiles** photo + silhouette (48.5 / 48.7), struck ≈51 | **still** `YFQ-44A ON THE FLIGHTLINE` | – |
| 51.77–54.10 | "it is the software underneath, called Lattice." | ch.4 LATTICE; **mascot and dock out**; topo map plate; `THE SOFTWARE UNDERNEATH` 52.2 → `LATTICE` slam 53.47 (fade + scale ≈1.1 → 1, 3 f) | – | – |
| 54.10–57.20 | "Think of Lattice as an operating system for military hardware." | 3-layer stack OPERATORS / **LATTICE** (lit, `THE OPERATING SYSTEM`) / HARDWARE on the topo plate | **still** `LATTICE · A REAL SCREEN` (`ABMS ONRAMP 2 · US AIR FORCE PHOTO`) | mascot back (hard cut) |
| 57.20–64.40 | "Radars, cameras, drones, ground vehicles, underwater vehicles and other sensors normally come from different manufacturers and operate separately." | topo map: separate sensor nodes pop in per noun (57.2 / 57.8 / 58.3 / 58.9 / 59.9 / 61.0) | **video** trims 57.20 / 61.60 | – |
| 64.40–72.57 | "Lattice connects them. It takes data from thousands of sensors, combines it into one picture, identifies objects or threats and helps operators decide what happens next." | links draw 64.4; counter `6 → 692` sensors 65.9; `ONE PICTURE` frame 67.6–68.4; contact ring + brackets + `UNKNOWN · CONTACT 001` 69.1; threat red diamond 70.1 | **video** trims 65.87 / 67.60; at 69.07 → decision panel OBSERVE / INTERCEPT / ALERT, rows light 70.5–71.7 | – |
| 72.57–87.77 | "Now connect that software to autonomous hardware. Anduril builds Ghost drones, Roadrunner, … Barracuda, … Dive and Copperhead, and surveillance systems like Sentry." | ch.5 THE HARDWARE; **C9 tree**: LATTICE root + 6 placeholders fill per product | video GHOST-X LAUNCH 72.57 → **C8 spec card** ROADRUNNER 76.97 → video FURY TAXI 78.57 → panel BARRACUDA variants 80.8 → panel DIVE-LD / COPPERHEAD 83.7 → video SENTRY 86.10 | – |
| 87.77–99.87 | "So imagine autonomous drones monitoring an area. One sensor detects something, Lattice identifies and tracks it, then shares that with other systems. A human operator supervises how they respond. That is the core vision." | ch.6 MISSION AUTONOMY; topo map + 4 drones with **sweeping vision cones** (ambient, continuous); detect ring 90.5, track brackets 92.1, share lines 94.0 | video `GHOST-X · IN FLIGHT · FORT POLK` 87.77 → 95.70 panel `APPROVE RESPONSE` (button fills blue ≈96.5–97.5) | `THE CORE VISION` tag 98.4 |
| 99.87–105.77 | "Not one person controlling one drone, but one person supervising many autonomous systems working together." | `1 : 1` person ↔ drone → fan-out to 12 system icons, ratio counter `1:1 → 1:12` (102.0–104.5) | video `GROUND CONTROL` 99.87, trim 105.47 | – |
| 105.77–108.17 | "Anduril calls this mission autonomy." | **mascot and dock out**; `ANDURIL CALLS THIS` / `MISSION AUTONOMY` slam 106.9–107.07 | – | – |
| 108.17–110.27 | "This is why AI matters so much." | ch.7 WHY AI; **layer stack recalled** (AI row lit) | **still** `COMBINED AIR OPERATIONS CENTER` | mascot back |
| 110.27–113.47 | "A battlefield produces enormous amounts of data at once." | topo map + rate counter `0.0 → 2.4 GB/S` | same still | – |
| 113.47–117.93 | "Camera feeds, radar, radio signals, locations, aircraft, drones." | **C10 6 feed tiles** per noun (camera tile = nested live video) | panel `STREAMS 1 → 6 · 2.4 GB/S` | – |
| 117.93–120.60 | "No human can process all of that in real time." | feeds converge on a `ONE HUMAN` node, capacity bar overloads | panel | – |
| 120.60–127.97 | "So AI turns raw sensor data into answers. What is this object? Where is it going? Is it a threat? Which system can respond?" | raw → `AI` → `ANSWERS` pipeline; 4 question rows light 123.6 / 124.7 / 125.6 (**red row `HOSTILE`**) / 126.5 | video `GHOST-X · MISSION PLANNING` 120.60 → 123.67 threat-diamond panel | – |
| 127.97–130.87 | "The other key part of Anduril's strategy is manufacturing." | ch.8 MANUFACTURING; layer stack + `MANUFACTURING` row added | **still** `YFQ-44A · MOJAVE DESERT` | – |
| 130.87–139.27 | "Anduril argues that modern wars may require huge numbers of relatively affordable autonomous systems, not a tiny number of incredibly expensive platforms." | `1 PLATFORM · $ BILLIONS` vs icon grid `+0 → +80`, tag `~ $ THOUSANDS EACH`; platform struck 136.1 | **still** `GHOST-X · ONE OF MANY` 133.33 | – |
| 139.27–145.10 | "So it is investing in Arsenal, software-driven factories built to produce autonomous defence systems at much larger scale." | `SO IT IS INVESTING IN` / `ARSENAL` (heavy, cap ≈70) + 3 factory lines with moving units, counter `3 → 985` | spec table | – |
| 145.10–156.47 | "So the easiest way to think about Anduril is this. Palantir helps…data. SpaceX transformed how space hardware is built. Anduril is trying to do something similar for defence." | ch.9 THE NETWORK; left headline `THE EASIEST WAY / TO THINK ABOUT` + Anduril lockup; **C11 logo cards** light in turn | – | – |
| 156.47–162.20 | "Build the hardware, build the AI, build the software connecting everything, then manufacture it at scale." | 4-column recap (HARDWARE / AI / SOFTWARE / MANUFACTURE); list rows light 156.9 / 157.9 / 158.5 / 160.7; connector bus 159.4 | list | – |
| 162.20–165.97 | "It is turning military hardware from slow, manually operated machines" | topo map, isolated manual nodes | **still** `ONE PLATFORM · ONE CREW` (Arleigh Burke, US Navy photo) | – |
| 165.97–169.02 | "into a network of software-defined autonomous systems." | **mascot and dock out**; the network draws (166.8–167.8); `A NETWORK OF SOFTWARE-DEFINED / AUTONOMOUS SYSTEMS` + lockup 168.13 | – | ends on the last frame, no fade, **no CTA/endcard** |

---

## 4. Checklist (A–I, condensed to what differs from R8)

### A. Frame architecture
- **Two-lane layout** (panel 960×743.5 on top; dock 540×304.5 bottom-left; presenter bottom-right in front of the panel corner). Our DH puts the mascot left and a single content column.
- **Gap:** new template family (§5).
- **Hierarchy** (cap heights, 1080):

  | Element | Cap |
  |---|---|
  | hook title | 90 |
  | climax headlines | 55–70 |
  | wordmark | 64 |
  | caption | ≈40 (font ≈55, medium/semibold sans) |
  | card titles (bold grotesk) | 13–27 |
  | eyebrow / HUD | 12 (mono) |
  | strip title | 9–10 |
  | credit | 7.5–9 |

### B. Chrome
- **HUD:** chapter label + 9-segment progress + `T+` timecode. Hard-cut chapter swaps: 7.77, 33.87, 51.77, 72.57, 87.77, 108.17, 127.97, 145.10.
- **Eyebrow:** 54 swaps, 1 f (≈19/min).
- **Presenter:** see below.
- **Captions:**
  - dark chip #060a0e, 1.5 px edge #151619, r≈9 (6 native);
  - white active/spoken #f0f4f8, grey upcoming #b1b5bb (no accent colour);
  - chunks of 2–4 words;
  - the chunk swap fades ≈3 f.

**Presenter detail.**
- **Enter:** slide from off-right, 14 f (5.634–6.067 ≈ 467 ms). Per-frame Δx (native) 51, 43, 38, 30, 25, 21, 15, 12, 8, 6, 3, 2, 1 → **power3.out**.
- **Artefact:** one full-pose frame at 5.600 before the slide. Do not copy.
- **Exits:** hard cuts at 51.77, 105.77 and 165.97, back by hard cut at 54.10 and 108.17.
- **Idle:** pose/expression swaps (gaze, lids) ≈11× (10.0, 14.0, 61.6, 64.4, 67.6, 80.8, 94.0, 98.4, 102.0, 120.6, 162.2), usually on a layout cut; one short nod 155.8–156.4.
- **No lip-sync.**
- **Present 92 % of the runtime.**

### C. Visual system (palette)

| Role | Hex |
|---|---|
| Background / grid | #07080b / #101114 |
| Panel border | #121316–#1d1e23 |
| Surface | #0d1117 |
| Lit card fill / border | #0b1c2d / #1a3a63 |
| Accent blue (bars, active segment) | #3fa3ff; #4a678f |
| Light-blue text / silhouettes | #8fc2fb–#96c6f6 |
| Text | #f3f4f7; muted #909196; strip #c8c9cc; credit #6d6e72 |
| Threat red | row fill ≈#3a1414 / #5a1f1b, text red |
| Amber target brackets (map) | #d9aa46-ish |

- Hues on screen at once: 1–2 plus the footage. The palette is deliberately desaturated so the real photos carry the colour.
- **Type:** heavy squarish grotesk caps (headlines, card titles), mono tracked caps (HUD, eyebrows, strips, credits, data), medium sans (captions).

### D. Modules seen
Panel layer stack, photo grid, portrait / people row, timeline, column chart, big counter, icon grid counter, image tiles + silhouettes, spec card, hardware tree, topo ops map (nodes, links, cones, rings, target brackets), feed tiles, decision panel, question rows, pipeline, ratio fan-out, factory lines, logo chips / cards / lockups, dim→lit question headline, dock media card.

### E. Motion
- Image fills: 4 f fade + 6–10 px rise, ease-out.
- First dock entrance: 8 f.
- All swaps: 1 f.
- Headline slams: 3 f fade + ≈1.1 → 1.0.
- Counters: ease-out 0.8–1.5 s.
- Vision cones: sweep continuously (ambient).
- Presenter: slide 467 ms power3.out.
- **No transition motion between layouts:** all hard cuts (unlike R6).

### F. Timing

| Metric | Value |
|---|---|
| Beats (`beats.py`, panel > 0.6 ∪ HUD > 1.5 ∪ card > 5; GOP frames removed; merge 200 ms) | **116 = 41/min** (lower bound; small text beats < 0.6 MAE are missed) |
| Gap between beats | median 1.10 s, p90 2.95 s |
| Layouts | 32, median **3.97 s**, max 15.4 s (72.57–87.77, the hardware tree, which mutates every ≈1.2 s) |
| Longest true hold | ≈4.4 s (57.2–61.6, with footage playing and nodes popping) |
| Chapters | 9 |

### G. Narrative
- Company dossier: hook question + comparison logos → what it is → the old way (grid) → the idea → founders + valuation → core product (Lattice) → hardware catalogue → a concrete scenario → why AI → manufacturing → analogy recap (Palantir / SpaceX / Anduril) → thesis line.
- **Media carries proof**: every concrete claim about a real thing gets a real photo or clip; every abstract claim gets a vector diagram.

### H. Audio
- **Voice:** single male narrator, 477 words / 168.4 s = **170 wpm**; 49 gaps > 0.3 s, max 0.76 s.
- **Music bed: yes.**
  - Gap RMS median −24.9 dBFS vs speech 50 ms p50 −17.5 (so the bed sits ≈7–10 dB under the voice).
  - 80–250 Hz carries ≈19 % of gap energy.
  - Every long gap shows stable peaks at **≈73 / 110 / 147 Hz** (D2 / A2 / D3, a sustained **D fifth drone pad**).
  - A weak ≈122 BPM low-band periodicity (autocorr 0.16, *low confidence*).
  - No dead silence: 50 ms RMS p5 −30.4, and only 2 of 3378 windows are < −50 dBFS.
- **SFX: none detected.** 4–12 kHz energy at the 29 layout cuts is *below* random-time energy (median 15.6 vs 25.8 dB); cuts fall in speech pauses.
- **Footage audio:** muted (the gap floor is the same pad inside and outside media spans).

### I. Production
- 720×1280, 418 kb/s, 5 s GOP.
- No black first frames on media swaps. R8 had 13; R9 has 0 (21 swaps checked in `sig.json`; `_st_vid_in.png`).

---

## 5. What is new vs our pipeline

What we already have (v3 on `v2/contract`):
- `media` window (`modules-media.js`: header + dot, image or video, poster, `highlight`, `shrink`), with root-level timed trims (`media.js` `buildMediaLayer`, `composeStage.js` `buildMediaLayer`), a hard media gate (`checkMedia`: file exists, first frame non-black, aspect ≤ 2 %) and the vloombox recorded-footage library + `promo.js`;
- BP `imageSlot` (circle / rounded image + ring + ▶);
- BP `logoGrid` (icons, not logos);
- `headline` dim → lit / recolour;
- `chapterTabs`;
- `layers`, `tree`, `timeline`, `bars`, `kpis`, `chips`, `nodes`, `panel`, `stamp`, `hero` + generic `count` / `strike` / `dim`;
- the scene transition layer;
- the original robot presenter;
- caption skins `marker` / `chipCyan`;
- the optional synthesized music bed (ambient) and SFX.

| R9 component | Status | Our module → change |
|---|---|---|
| C1 hero footage window (no header, strip, corner brackets, credit chip, source pill, track box, target brackets, callout) | **extend** | `media` + `skin: "viewfinder"` (header off, `strip`, outside `brackets`), `credit` / `source` chips, overlays `trackBox`, `targets`, `callout` |
| C2/C3 **media dock** (persistent B-roll lane with its own cut list, still / live skins, strip with title + credit, LIVE pill) | **new lane + extend** | `media` + `skin: "dock"`. The real novelty is structural: a **dock track** of `{t, asset, title}` cuts that runs in parallel to the scaffolds (today a `media` module lives inside one scaffold's modules). Implement as `storyboard.dock: [{at: {sentence, text}, asset, title?, credit (auto)}]`, compiled to one persistent window with image holds and root-layer video trims |
| C4 photo grid 2×2 with placeholder words, per-noun fill, group bracket + tag | **new** `photoGrid` | – |
| C5 portrait + bio block with credit; C6 people row with silhouette placeholders | **new** `portraitCard`, `peopleRow` | `imageSlot` is circular BP styling; reuse its `<img>` code |
| C7 image tiles with silhouette fallback + strike | **new** `imageTiles` | generic `strike` / `dim` already exist |
| C8 spec card (image + key/value rows) | **new** `specCard` | small; could be `panel` + image header |
| C9 tree with image leaves (6 leaves, 2 rows, dashed placeholders) | **extend** `tree` | leaf `src` / `silhouette`, `cols`, `placeholder`; op `branch` already reveals a leaf |
| C10 feed tiles with one nested live video | **new** `feedTiles` | the nested video goes through the root media layer (a small wrapper rect) |
| C11 logo chips / logo cards / wordmark lockup | **new** `logoChips`, `logoCards`, `lockup` | needs a logo resolver (§7.3); BP `logoGrid` stays icons |
| C12 topo ops map (contours, nodes, links, cones sweeping, detect ring, target brackets, threat diamond) | **new host** `opsMap` | overlaps R8's planned `floorplan`; build one map host with both backgrounds (`plate: topo|floor|none`) |
| Column chart (valuation) | **new small** `columns` | `bars` is horizontal |
| Big counter `$0.7B → $30B+` | have | `hero` + `count` |
| Icon grid count `+0 → +100` | have ≈ | `chips` fill + `count`, or BP `logoGrid.flood` |
| Layer stack recalled across chapters | have + C3 | `layers` + `recall` (PLAN_R6-R8 §C3) |
| Timeline 2012–2025, multi-marker | extend | `timeline` (ticks > 6, `mark {tick, tone}`) |
| Question / thesis headline dim → lit | have | `headline dim:true` + `light` |
| HUD: chapter label + segmented progress + `T+` timecode | **new chrome** `hudDossier` | fields `chapter`, `segments`, `timecode` (free-running = frame time) |
| Per-sentence eyebrow | have | `micro` / label cadence |
| Right-side presenter, slide in from the right, hides on climaxes | extend | presenter `side: "right"`, enter `slideInRight` (467 ms power3.out), `hide` op (exists for the promo) |
| Caption dark chip, white / grey karaoke | have ≈ | `chipCyan` with `active: white` |
| D-drone music bed ≈−8…−10 dB under the voice | have | music bed `ambient`. R9 supports enabling it for this style |
| **Source / credit label** on every raster | **new cross-cutting** | `credit` prop on every image-bearing module, **filled by the resolver, never by the LLM** (§7.8) |
| **Runtime media fetching** | **new subsystem** | §7 |

### 5.1 Catalog sketches (same style as `catalog.js`)

```js
// ---- extensions to media ----
media: {
  use: "window with REAL footage or a photo; skins: dh (header bar), viewfinder (hook hero: strip + corner brackets + chips), dock (B-roll card bottom-left with title strip + credit)",
  props: "{kind: video|image, asset (resolver id) | src, skin?: dh|viewfinder|dock, strip?: {title (<= 44 chars, caps)} (credit line is filled from the asset record), live?: true (video: LIVE pill), source?: string (top-left pill, e.g. 'LATTICE · AIR PICTURE'), brackets?: true, trims?: [{in, at?: {text}}], focus?: [x%, y%]}",
  ops: { highlight: "...", head: "...", strip: "{title} 1-f strip swap (same image)", overlayIn: "{i} trackBox / targets / callout fade 3 f",
         swap: "{asset, title?} 1-f hard swap to another asset (dock only)", shrink: "..." },
},
// ---- new ----
photoGrid: { use: "2x2 (or 3x2) grid of named dashed slots that fill with real photos on their nouns, then group under a tag", props: "{cells: [{label (caps placeholder), asset, title, sub? (e.g. '~ $80M EACH')}] (4-6), cols?: 2}", ops: { fill: "{i} photo fades in (4 f, 8 px rise)", group: "{text} all cells dim to 45% + bracket frame + tag chip" }, entities: "c<N>" },
portraitCard: { use: "3:4 portrait of a real named person + bio block (name, role line, place); credit line auto", props: "{asset, name, role (mono), place?, marks?: timeline years}", ops: {} },
peopleRow: { use: "row of 3-6 person cards; cards without a licensable photo show a silhouette placeholder", props: "{people: [{name, role, asset?}] (<= 6)}", ops: { reveal: "{i}" }, entities: "p<N>" },
imageTiles: { use: "2-3 square tiles, each a photo OR a labelled vector silhouette (when no photo exists), with title + sub", props: "{tiles: [{asset? | silhouette: icon, title, sub?}] (2-3)}", ops: { fill: "{i}" }, entities: "t<N>" },
specCard: { use: "one product: photo left + 4-6 key/value spec rows right; credit in the strip", props: "{asset, title, sub?, rows: [{k, v}] (<= 6)}", ops: { rowIn: "{row}" } },
feedTiles: { use: "3x2 'sensor feeds' tiles filled per spoken noun; tile kinds: video (nested live footage), radar, wave, coords, icon", props: "{tiles: [{kind, label, asset? (video)}] (4-6)}", ops: { fill: "{i}" } },
logoChips: { use: "row of 3-5 dashed slots that fill with company wordmarks (monochrome white, never recoloured) on their names", props: "{items: [{brand (resolver key), sub?}], lit? (index)}", ops: { fill: "{i}", light: "{i}", demote: "{} row shrinks under a 'MENTIONED ALONGSIDE' eyebrow" } },
logoCards: { use: "2-4 tall cards headed by a company wordmark; a grey descriptor + a big caps word light per clause (analogies / comparisons)", props: "{cards: [{brand, desc, word}] (2-4)}", ops: { light: "{i}" } },
lockup: { use: "brand symbol + wordmark lockup, optional tag chips below", props: "{brand, tags?: [string] (<= 4), size?: 64}", ops: {} },
columns: { use: "vertical column chart, 3-7 columns, last one accent-blue; values count while growing", props: "{title, items: [{label, value, display}], accent?: last}", ops: { grow: "{i?}" } },
opsMap: { use: "HOST: tactical map (topo contour plate) with icon nodes, links, drones with sweeping vision cones, detection rings, target brackets", props: "{plate?: topo|floor|none, nodes: [{id, icon, label, x, y, hidden?}], cones?: [{node, dir, spread}]}", ops: { nodeIn: "{node}", link: "{from, to}", ring: "{node, text?}", target: "{node, tone?: amber|red}", counter: "{text}", sweep: "{on}" } },
// chrome (compiler-injected)
hudDossier: { chrome: true, use: "chapter label + N-segment chapter progress + running T+ timecode", props: "(compiler: chapters from scaffold.chapter)", ops: { chapter: "{n, title}" } },
```

Storyboard expression for the dock (a parallel lane, not a module inside a scaffold):
```json
"dock": [
  {"at": {"sentence": "s3", "text": "It"},       "media": {"intent": "Ghost-X drone on the ground with a soldier", "entity": "Anduril Ghost", "kind": "image"}, "title": "GHOST-X · FIELD TEST"},
  {"at": {"sentence": "s4", "text": "Traditional"}, "off": true},
  {"at": {"sentence": "s12", "text": "Radars"},  "media": {"intent": "sensor mast on a truck", "kind": "video"}, "title": "SENSOR MAST"}
]
```
The resolver replaces `media` with `{asset: "<sha>", credit: "..."}`. The compiler builds one persistent dock window. Image holds are `<img>` swaps in the stage; video holds are root-layer trims (the existing `media.js` path). It hides the dock while the presenter is hidden, and leads every swap by 80–100 ms.

---

## 6. Pacing numbers (summary)

| Metric | Value |
|---|---|
| Beats/min | ≥41 (116 beats) |
| Layouts | 32; median 3.97 s |
| Eyebrow swaps | 54 (19/min) |
| Chapters | 9 |
| Dock swaps | 24 (+1 strip-only), median lead −80 ms |
| Image fills in panels | 4 f, anchored −120…+150 ms (median ≈0) |
| wpm | 170 (slower than R8's 218) |
| Longest hold | ≈4.4 s (footage playing) |
| Media share | ≥1 real photo/video on screen 66 % of the runtime |

---

## 7. Runtime media fetching plan (topic-relevant images/video, credited)

Goal: from a storyboard, fetch a topic-relevant image or clip for each media slot (dock, grid cell, portrait, tile, hero), credit it on frame, and render **only from local files**.

### 7.1 Principles
1. **Fetch before render, never during.** A `resolve-media` step runs after the storyboard is written and before `compile.js` / render. It writes local files + a manifest. The composition references only `assets/media/cache/...` paths.
   - **Gate:** the compiled HTML contains no `http(s)://` media URL, and `hyperframes check` passes offline.
   - Re-renders reuse the frozen manifest (as `promo.js` saves its pick beside the storyboard).
2. **Every asset has a licence record, or it is not used.** The licence gate reads the sidecar, not the LLM.
3. **The credit text is generated from the record**, never written by the LLM (R9's 105.47 mismatch shows why).
4. **Graceful degradation:** a media slot that fails resolution falls back to a vector stand-in (silhouette / icon tile / placeholder card, as R9 itself does) or is dropped. The scene stays valid and the render still runs.
5. **No YouTube, no web-image scraping (Google/Bing), no news-agency photos (Getty/AP/Reuters), no stills from films/TV/games**, even when "available".

### 7.2 Where this plugs in
- `orchestrator/generate-video-v3.js` → after `storyboardGen` → **`lib/media/resolve.js`** (new) → `compile.js`.
- Library-first order: (1) our own library (`assets/media/vloombox`, user uploads), (2) the cache (the same query or entity already resolved), (3) providers.

### 7.3 Sources (evaluated)

| Source | Best for | Licence model | API (as far as I am confident) | Attribution rules | Verdict |
|---|---|---|---|---|---|
| **Wikimedia Commons** (+ **Wikidata**) | named entities: people, companies' products, places, buildings, historical items, military/government media (many PD US-gov files), some video (WebM/Ogg) | per file: PD, CC0, CC BY, CC BY-SA, GFDL, … | MediaWiki Action API `https://commons.wikimedia.org/w/api.php`. Search: `action=query&generator=search&gsrsearch=<q>&gsrnamespace=6&prop=imageinfo&iiprop=url\|size\|mime\|extmetadata&iiurlwidth=1920&format=json`. `extmetadata` gives `LicenseShortName`, `LicenseUrl`, `Artist` (HTML), `Credit`, `AttributionRequired`, `UsageTerms`, `ImageDescription`, `DateTimeOriginal`. Entity → file: Wikidata `action=wbsearchentities` (name → QID), then `wbgetentities` claims **P18** (image) / **P154** (logo image). No key. Send a descriptive **User-Agent with contact info** (Wikimedia policy); keep request rates polite and serial. | TASL: title, author (`Artist`, strip HTML), source (file page URL), licence + link; note modifications | **Primary for entities.** High trust in licence metadata, but `Artist` is sometimes messy HTML ("verify" parsing on real samples) |
| **Openverse** (WordPress Foundation) | CC/PD images aggregated from Flickr, Commons, museums; also audio | per item CC / PD | `https://api.openverse.org/v1/images/?q=<q>&license_type=commercial,modification&page_size=20` (also `license=by,by-sa,cc0,pdm`). Results carry `url`, `creator`, `license`, `license_version`, `license_url`, `foreign_landing_url`, `provider`, `source`, `width`, `height` and a ready `attribution` string. Anonymous access is rate-limited; register OAuth client credentials for higher limits (**verify** current endpoint and limits; the base moved from `api.openverse.engineering` to `api.openverse.org`) | use its `attribution` field, cross-checked against the landing page | **Secondary for generic CC imagery.** Always re-check the licence on `foreign_landing_url` for high-stakes items (aggregator metadata can lag) |
| **Pexels** | generic B-roll photos **and videos** (people at work, cities, tech, nature) | Pexels License: free, commercial use and modification allowed, attribution not required; do not sell unaltered copies, no endorsement implied, no identifiable people shown in a bad light | `GET https://api.pexels.com/v1/search?query=<q>&orientation=landscape&size=large&per_page=15`, videos `GET https://api.pexels.com/videos/search?query=<q>`; header `Authorization: <API_KEY>` (free key). Photo: `photographer`, `photographer_url`, `url`, `src.{original,large2x,large,…}`, `alt`. Video: `video_files[{quality,width,height,link,file_type}]`, `user.name`, `image` (poster). Default limit ≈200 req/h, 20k/month (**verify**) | API guidelines ask for a visible link back to Pexels and photographer credit where possible → we always credit `Pexels / <photographer>` | **Primary for generic video.** Best free stock video with an API |
| **Pixabay** | generic photos, illustrations, **videos** | Pixabay Content License: free commercial use, no attribution required; restrictions on sale and on misuse of identifiable people / brands | `GET https://pixabay.com/api/?key=<KEY>&q=<q>&image_type=photo&orientation=horizontal&safesearch=true&min_width=1920&per_page=20`; videos `GET https://pixabay.com/api/videos/?key=<KEY>&q=<q>` (`videos.{large,medium,small,tiny}.{url,width,height,size}`). Rate limit ≈100 req/60 s; responses must be **cached (24 h)**; **no permanent hotlinking**: download to our server (fits our freeze model) (**verify** the exact wording) | show the source when displaying results; we credit `Pixabay / <user>` | **Secondary generic.** Quality is more variable; watch for AI-generated uploads (flag `ai` in the vision check) |
| **Unsplash** | high-quality generic photos (no video) | Unsplash License: free, no attribution required | `GET https://api.unsplash.com/search/photos?query=<q>&orientation=landscape&content_filter=high`, header `Authorization: Client-ID <ACCESS_KEY>`. API guidelines: **hotlink** the returned `urls.*` in apps, **trigger `links.download_location`** when a photo is used, and credit "Photo by <name> on Unsplash" with UTM links. Demo tier ≈50 req/h until production approval (**verify**) | credit required by the API terms | **Tertiary.** The hotlink rule is written for apps; baking into a video = download + tracking ping. **Verify with Unsplash terms before enabling.** |
| **NASA Image and Video Library** | space, aviation, Earth, science | NASA media is generally not copyrighted (US gov). Do not imply endorsement; the NASA insignia/logo is restricted; some items are third-party (check `photographer` / `secondary_creator` / description) | `GET https://images-api.nasa.gov/search?q=<q>&media_type=image,video`; files `GET https://images-api.nasa.gov/asset/<nasa_id>`; metadata `…/metadata/<nasa_id>`. No key | `NASA / <center or photographer>` | **Domain source** (space / aviation topics) |
| **DVIDS** (US DoD media hub, the likely origin of R9's `US ARMY PHOTO · PUBLIC DOMAIN` footage) | military / defense / government | mostly US-gov public domain; individual items can carry restrictions; no endorsement implied; identifiable service members: editorial context only | has a public API with an API key (**verify** endpoints, parameters, terms; I am not confident of the exact paths) | `<Branch> photo / <photographer> · Public domain (DVIDS)` | **Domain source**, behind verification |
| **Simple Icons** (npm `simple-icons`) | brand logos as monochrome SVG (slug + brand hex) | the icon data package is CC0; **trademarks remain the owners'** (nominative use only; some brands' guidelines forbid alterations) | offline: bundled npm package, **no runtime fetch** | none on frame (nominative), recorded in the manifest | **Primary for logos** (monochrome white matches R9) |
| Wikimedia Commons logos (Wikidata P154) | full-colour or wordmark logos missing from Simple Icons | often `PD-textlogo` or trademarked; non-free logos live on en.wikipedia, not Commons | as above | record the licence; nominative use only | fallback for logos |
| Company press kits / newsroom | product photos (e.g. Anduril press images) | press terms vary (usually editorial use, credit the company) | **manual whitelist only**, no scraping | `Courtesy of <Company>` | opt-in per domain, human-approved once |
| Flickr API, Smithsonian Open Access, Library of Congress | CC / CC0 / PD archives | per item | keys required; **verify** | per item | later |
| YouTube, Google/Bing Images, Getty/AP/Reuters, social media | – | – | – | – | **forbidden** |

**Routing by slot type**, decided by the query generator:

| Slot type | Order |
|---|---|
| named person | Wikidata P18 → Commons → Openverse (CC BY / BY-SA only) → silhouette placeholder |
| named product / org / place | Wikidata → Commons → domain source (NASA / DVIDS) → press-kit whitelist → vector silhouette |
| logo | Simple Icons → Wikidata P154 → text wordmark (plain type, no logo) |
| generic concept / B-roll video | Pexels video → Pixabay video → Commons video → still image with the dock `still` skin |
| generic still | Pexels → Unsplash (if enabled) → Pixabay → Openverse |

### 7.4 Query generation from the storyboard (Gemini)

The storyboard generator emits **intents, not URLs**:
```json
"media": {"slot": "dock", "kind": "video|image", "intent": "a small autonomous helicopter drone taking off from a field",
          "entity": {"name": "Anduril Ghost", "type": "product"}?, "mustShow": ["drone"], "avoid": ["weapons firing", "people's faces"],
          "aspect": "dock|grid|portrait|tile|hero", "at": {"sentence": "s14", "text": "Ghost"}}
```
A second Gemini call (`lib/media/queries.js`, JSON mode, temperature 0) turns each intent into:
- 3–5 provider queries: short noun phrases in English, with synonyms, no stop words;
- the provider route;
- negative keywords;
- for entities, a Wikidata search string and the expected entity class (so "Anduril" does not match the sword Andúril or Tolkien fan art);
- a one-line **vision rubric** ("shows a small helicopter-type drone outdoors; no text overlays").

The prompt includes the scene sentence and the topic. The output is cached by `sha256(intent+entity+kind)`.

### 7.5 Ranking and validation

1. **Hard filters (metadata):**
   - licence allowed (§7.7);
   - resolution: image long side ≥ 1.5× the target rect px (dock 540 → ≥ 810 px wide; hero 960 → ≥ 1440); video ≥ 1280×720;
   - aspect croppable (§7.6);
   - duration ≥ trim need + 1 s;
   - file size ≤ 200 MB before transcode;
   - the provider's safe-search flag on (`safesearch=true`, `content_filter=high`, Openverse `mature` off).
2. **Cheap image checks:**
   - no letterbox/pillarbox (ffmpeg `cropdetect` on 3 frames);
   - not mostly black / blown;
   - perceptual hash not already used in this video or the last N videos (freshness).
3. **Gemini vision check** (batched: 6–8 thumbnails at 512 px per call, plus the rubric):
   ```json
   {"matches": 0-1, "depicts": "...", "textOrWatermark": bool, "otherBrandLogos": bool, "identifiablePeople": n, "nsfwOrGore": bool, "aiGenerated": "likely|unlikely", "focalBox": [x,y,w,h]}
   ```
   - Reject `matches < 0.6`, watermark, gore, likely AI (for real-entity slots).
   - For **video**, check 3 frames (10 / 50 / 90 %) and pick the best 2–5 s window with scene detection (the §2.2 step 5 of PLAN_R6-R8).
4. **Score** = 0.5 × relevance + 0.2 × resolution headroom + 0.15 × licence preference (PD/CC0 > BY > BY-SA) + 0.15 × provider trust.
   - Keep the top 3 as runner-ups for auto-repair.
   - Record why rejects failed.

### 7.6 Crop / aspect rules for our windows

| Target | Rect (1080) | Aspect | Allowed source | Crop rule |
|---|---|---|---|---|
| dock (R9) | media 537×261 (still), 537×274 (video) | ≈2.0:1 | ≥ 16:9 landscape | cover crop around the Gemini `focalBox`; max 15 % loss per axis for stills; **video: keep 16:9 and show a 537×302 media area** (widen the dock to 16:9 rather than crop a moving frame) |
| DH `media` stage / full | 750×423 / 957×540 | 16:9 | 16:9 video; stills 3:2–16:9 | existing gate: video crop ≤ 2 %; stills ≤ 15 % |
| grid cell | ≈397×180 | ≈2.2:1 | landscape | focal crop, ≤ 25 % (thumbnails tolerate more) |
| portrait | 204×270 | 3:4 | any with a face | face box in the upper 45 %, the head never cut (Gemini focal box / face) |
| tile / tree leaf | 300×237, 219×140 | ≈1.3–1.6 | any | object centred, ≤ 25 % |
| portrait-orientation video (9:16 stock) | – | – | – | reject for landscape windows (no blurred-sides fill: R9 never does that) |

Processing (`lib/media/process.js`, deterministic ffmpeg; the output hash is stable for the same input and params):
- **Images:** crop → resize to 2× the rect (retina headroom for the 1080 render) → WebP q85 (or JPEG q88); optional mild grade to the profile (−15 % saturation) recorded as a modification.
- **Video:** trim to the selected window + 0.5 s padding → scale / crop → `libx264 -crf 20 -pix_fmt yuv420p -r 30 -g 30 -an -movflags +faststart`.
  - Audio is always stripped: R8 and R9 both mute footage.
  - The GOP of 30 keeps seeks cheap.
- **Posters:** first frame → `.poster.jpg` (the existing `media` poster path, so the body is never black).

### 7.7 Licensing gate (hard, before compile)

| Licence | Decision | Why |
|---|---|---|
| PD (US gov: NASA / DoD / DVIDS marked PD), PDM, CC0 | **allow** | – |
| CC BY 2.0 / 3.0 / 4.0 | **allow** + mandatory on-frame credit with the author + a description credit with the licence link + "cropped / graded" modification note | – |
| CC BY-SA | **allow as fallback only**, flag `sa: true`, and do not apply creative edits beyond crop / resize / grade | whether SA terms extend to the whole video is a legal judgement: **verify with counsel / policy before relying on it**. Prefer PD / CC0 / BY alternatives |
| CC BY-NC / BY-NC-SA / BY-NC-ND | **reject** | our channel promotes vloombox.in (commercial) |
| CC BY-ND | **reject** | we always crop, grade and overlay (adaptation) |
| GFDL-only | **reject** | requires the full licence text; impractical in a video |
| Pexels / Pixabay / Unsplash licences | **allow** with their restrictions recorded (no endorsement, no identifiable-person misuse); credit anyway | – |
| "Fair use" / non-free / unknown / missing | **reject** | – |
| Logos (Simple Icons / PD-textlogo / trademark) | **allow nominatively**: unaltered, monochrome as supplied, only when the brand is discussed, never implying endorsement | – |

Real people:
- only CC/PD portraits of public figures in their public role;
- no private individuals as the subject (the vision check counts identifiable people; stock "people at work" is fine under the stock licences);
- never AI-generated depictions of real people or events.

### 7.8 Credit label spec (on frame, plus the description)

- **Always visible while the asset is visible.** It is part of the window chrome, so it lives and dies with the image.
- **Stills (dock, grid, spec):**
  - second strip line, bottom-left, 12 px in from the media edge;
  - mono caps, **font 13 px at 1080** (cap ≈9.5), tracking 0.14 em;
  - colour #8a8c92 on the #141518 strip (≥ 4.5:1; R9's #6d6e72 is ≈3.4:1, too faint);
  - max 1 line, truncated in the middle with "…" before the licence, never dropping the licence.
- **Video:** chip top-right inside the media, 12 px inset, h 27, pad-x 10, fill `rgba(10,12,16,.78)`, r 3, same type (13 px, #c9cdd3).
- **Portrait / people:** a bio line under the role, 13 px, #8a8c92.
- **Format** (short, on frame): `<SOURCE> · <AUTHOR> · <LICENCE>`.

  | Source | Credit |
  |---|---|
  | Commons | `WIKIMEDIA COMMONS · JANE DOE · CC BY-SA 4.0` |
  | US gov | `U.S. ARMY PHOTO · SGT. J. DOE · PUBLIC DOMAIN` (the author when known) |
  | Pexels | `PEXELS · JOHN SMITH` |
  | NASA | `NASA / JPL-CALTECH` |
  | Openverse / Flickr item | `FLICKR · <CREATOR> · CC BY 2.0` |

- **Full credits** go to `credits.txt` beside the video and are appended to the upload description: title, author, source URL, licence name + URL, and "cropped and colour-graded" (CC BY 4.0 asks for an indication of changes).
- **Gate `credit-visible`:** for every frame where a media asset is visible, a non-empty credit element is visible over it, and the rendered text height is ≥ 9 px cap. Check it with the layout-audit probe on sampled frames.

### 7.9 Cache and sidecar

- Path: `video-engine/assets/media/cache/<sha256[0:2]>/<sha256>.<ext>` (content-addressed; the same file across videos is stored once) + `<sha256>.json` sidecar:
  ```json
  {"sha256": "…", "kind": "image|video", "source": "wikimedia|openverse|pexels|pixabay|unsplash|nasa|dvids|simpleicons|library",
   "id": "provider id", "url": "file URL fetched", "pageUrl": "landing page", "title": "…", "author": "…", "authorUrl": "…",
   "license": "CC BY-SA 4.0", "licenseUrl": "…", "attributionRequired": true, "credit": "WIKIMEDIA COMMONS · … · CC BY-SA 4.0",
   "modifications": ["crop", "scale", "grade:-15sat", "trim:12.4-18.9", "audio:stripped"], "w": 1620, "h": 788, "duration": 6.5,
   "query": "…", "intent": "…", "entity": "Q…", "scores": {"relevance": 0.84, "resolution": 1.6}, "vision": {"depicts": "…", "aiGenerated": "unlikely"},
   "phash": "…", "fetchedAt": "2026-09-26T…Z", "resolverVersion": 1}
  ```
- **Raw originals** are kept in `…/cache/raw/` (git-ignored) so a changed crop never refetches.
- **Per video:** `media-manifest.json` beside the storyboard, mapping each slot → sha + credit. It is frozen once and reused on re-render.
- **Negative cache** (`cache/_misses.json`): query → "no acceptable result" with a TTL of 7 days, so failed searches do not hammer APIs.
- **Git:** `cache/` is git-ignored (large, third-party). The manifests are small and committed with the storyboard.
- **Takedown:** `node tools/media-purge.js <sha>` removes an asset, and the manifests list every video that used it.

### 7.10 Determinism and seek-safety

- The resolver is the only networked step. Its output (manifest + files) fully determines the render.
- Render inputs are local: `<img src="assets/media/cache/…">` and root-layer `<video>` trims with `data-media-start` (the existing HyperFrames rules). No composition code fetches, plays or seeks.
- Images are decoded before the timeline registers (`img.decode()`, as in the finance plan §4.4).
- A render with the network disabled must match a networked render frame for frame (CI gate).

### 7.11 Failure modes and responses

| Failure | Response |
|---|---|
| provider down / rate-limited (HTTP 429/5xx) | exponential backoff (max 3), then the next provider; the cache hit rate is logged |
| no result above threshold | broaden the query (drop qualifiers) → next provider → **fallback visual** (silhouette icon tile, placeholder person card, or drop the dock hold: the dock hides and the panel stays) |
| wrong entity (namesake, fan art, other company) | Wikidata class check + vision rubric; reject when `depicts` does not mention the entity class |
| licence ambiguous / metadata missing | reject (never guess) |
| watermark / burned-in text / other brand logos | vision flag → reject |
| AI-generated stock presented as real | vision `aiGenerated: likely` → reject for real-entity slots; allowed only for concept slots, marked `ai: true` |
| video: black first frame, letterbox, vertical, too short, shaky / blurred | `checkMedia` (exists) + cropdetect + duration check + vision sharpness → next candidate |
| the caption disagrees with the picture (R9 105.47) | the strip title is derived from the asset's own metadata + intent; the vision check confirms it |
| duplicate across scenes / videos | pHash check → next candidate |
| sensitive content (real conflict imagery, casualties, identifiable minors) | vision flag → reject; topic-level policy for war/defence topics: prefer equipment / test footage over combat |
| asset later removed at the source / takedown | the manifest keeps provenance; purge tool + re-resolve |
| disk growth | cache LRU by last-used date (keep assets referenced by committed manifests) |

---

## 8. Prioritised gap list (R9)

1. **P0 media resolver** (§7): providers (Commons + Wikidata, Pexels video, Openverse, NASA, Simple Icons), vision check, licence gate, cache + sidecar, credits file, no-network render gate.
2. **P0 credit chrome:** a `credit` on every raster module, filled from the record; `credit-visible` gate.
3. **P1 media dock lane:** `storyboard.dock` cut list, `media` skins `dock` / `viewfinder`, strip swap, LIVE pill, corner brackets, and a DH-dossier template (panel top, dock bottom-left, presenter right).
4. **P1 image cards:** `photoGrid`, `portraitCard`, `peopleRow`, `imageTiles` (silhouette fallback), `specCard`, `tree` image leaves, `logoChips` / `logoCards` / `lockup`.
5. **P2 `opsMap` host** (merged with R8's `floorplan`), `columns`, `feedTiles` (nested video), `timeline` > 6 ticks, `hudDossier` chrome, presenter right side with slide-in.
6. **P2 generator rules:** concrete named thing → media slot with intent + entity; generic claim → vector; dock swap per sentence, −80…−100 ms lead; hide the dock and presenter on climax headlines; at most 1 real-person portrait per chapter; always a fallback visual.
7. Asset rights: never reuse R9's presenter (copyrighted cartoon) or its footage files; re-fetch from the original PD/CC sources through the resolver if the same subjects are needed.

## Evidence frames (this folder, git-ignored PNGs)

| Topic | Frames |
|---|---|
| Hook hero + overlays + credit chip | `ev_3.000`, `_z_hero_top`, `_z_hero_bot`, `_st_open` |
| Layout cut + presenter slide-in | `_st_hero_out` |
| Dock still (strip + credit line) | `ev_8.500`, `_z_still_bot`, `_st_cardin` (first entrance) |
| Dock live video (LIVE + credit chip) | `ev_79.500`, `_z_live_top`, `_z_live_bot`, `_st_vid_in` (1-f swap) |
| All dock holds | `_cards.png` |
| Photo grid | `ev_17.500`, `_st_grid_in` |
| Portrait / people row | `ev_36.500`, `ev_41.000` |
| Tiles + silhouette | `ev_49.500` |
| Topo map + layer stack | `ev_55.000` |
| Panel catalogue (24 moments) | `_panels.png` |
| Logo cards | `ev_147.500`, `ev_152.500` |
| Close | `ev_168.500` |
| Presenter pose swaps | `_mascot.png` |
