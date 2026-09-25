# R5 (DdIM0QoiZre) — design & motion audit (Palantir explainer, DARK theme, chaptered)

**Source facts (measured, ffprobe):** 720×1280 H.264 High, yuv420p, 30/1 fps, 165.01 s, video 302 kb/s, audio HE-AAC 54 kb/s.
**Scale rule:** all px values below were measured on the native 720×1280 frames and are reported **at 1080×1920 (×1.5)** unless tagged `@720`. **Scale factor 1.5** (the source is not 1080×1920). 1 frame = 33.3 ms. Hex values carry H.264 4:2:0 compression noise of **±3 per channel** (±5 on thin strokes and on chroma of small saturated glyphs). Sub-2 px @720 strokes are reported as 1.5×(measured), e.g. a 1 px line @720 = 1.5 px @1080.
Evidence (scratch) in this folder: `m_*.png` crops, `*_strip_*.jpg` 30 fps strips, `measure*.py` pixel scripts.


**Method.** Pixel values come from PIL scripts run on the 34 `ref_frames/R5_*.png` (native 720×1280) and on raw 30 fps frames decoded with ffmpeg (`fg.py`). Scripts: `m1.py` and `m_hud.py` (grid, HUD), `m_cap.py` and `capscan.py` (captions over all 4947 frames), `m_box.py`, `m_acc.py`, `m_comp.py` and `mlib.py` (modules and accents), `ev1–ev15.py` (motion, per frame). Zoom crops with pixel rulers: `m_z_*.png`. Montages: `m_montage_0..5.png`. A "background plate" (the per-pixel minimum over all 34 frames) is in `m_bgplate_min.png` and `m_bgplate_boost.png`.

**Timing caveat (measured):** the Whisper word times in `evidence/*.asr.json` run about **0.25–0.30 s early** against the audible onset. RMS-envelope checks: "People" is at 1.80 in the ASR vs 2.12 audible; "Imagine" 21.74 vs ~22.02; "Palantir" 12.40 vs ~12.5. So a visual beat logged "+0.1–0.35 s after the ASR word" actually lands **on the spoken word or ≤70 ms before it**. Caption chunk swaps land 50–70 ms *before* the audible word. All "anchor" figures below are ASR-relative unless marked "audible". Only 3 spot checks were made, so treat the bias as ±0.05 s.

---
## A. Frame architecture & layout

| # | Item | R5 measured (px @1080×1920) | Evidence | Our v2 | Gap | Fix class |
|---|---|---|---|---|---|---|
| 1 | **Safe zones** | Top 0–203 (10.6%) is empty background; the first ink is the HUD label cap-top at y=204. Sides: every module sits inside **x 60–1020** (60 px = 5.6% gutters, snapped to the 60 px grid). Bottom: nothing below the caption box bottom y=1548 (80.6%); **y 1548–1920 (19.4%) is always empty**. Caption band is 1444–1548. The mascot is the only element that breaks the left gutter (x=0). | `m_hud.py`, `m_cap.py`, ruler zooms; all 34 frames | HUD at 214; content 300–1380; caption 1420–1540; left mascot at 1.5% | Close. Our HUD sits 10 px lower and our content runs down to 72% H. R5's content never goes below 58.7% (panel bottom 1127) except the mascot. | tuning |
| 2 | **Grid / columns** | Two zones. **(i) Top "stage" frame**, full width x 60–1020. **(ii) Lower band, split in two:** a mascot column x 0–447 (41% W) and an info-panel column **x 469–1020** (551 px). No gutter: the panel's left edge (469) overlaps the mascot's bounding box by about 22 px, but not its silhouette. All frame edges snap to the background grid: grid pitch 60 px, vertical lines at x=60k, horizontal lines at y≈28.5+60k (frame left 60, right 1020, top 267). | ruler zooms; grid `m1.py` | Mascot col 0–290; one content card 330–1010 | We have no stage/lower-band split and no panel column. | new capability (layout template) |
| 3 | **Content bbox per scaffold** | **Stage frame: x 60–1020, y 267–840** (960×573, 26.5% of frame area, the same in all 34 sampled frames; bottom border at y 839–840). Frame centre y=553 (28.8% H). **Info panel: x 469–1020, y 891–1127** (551×236); present in about 70% of sub-states. **Mascot: x 0–447, y 783–1377** (centre-of-mass ~x 225, y 1080). **Photo-card variant** (21.93 s and 55.87 s): the photo is **x 60–1020, y 372–1035** (960×663, overflowing the stage-frame bottom). A mono credit strip sits inside the photo bottom (y≈1005–1023). A 3-row key/value table follows at y 1095–1244. The mascot and the info panel are hidden. Vertical centre of mass of all non-caption ink ≈ 42% H. | `m_box.py`, content-frame scan | Card 330–1010 × 300–1380 (≈40% of area), centre y≈840 (44%) | R5 packs the diagram into a short, wide top band plus a small detail panel. Ours is one tall card. | new capability |
| 4 | **Layout templates** | See §3 Layout templates (T1–T8). | | 1 template (dual deployment dashboard) for the whole 17.7 s | We have 1 template; R5 uses ≥8. | new capability |
| 5 | **Visual hierarchy** | Read order: **(1)** the serif hero word (cap 72–112 px, white #ffffff) or the lit accent element, **(2)** the caption (x-height 30 px, cap ≈40 px, active word #fbfeff), **(3)** the stage subheader (sans caps, cap 15 px, #aaaeb4), **(4)** panel rows (mono caps, cap 14–15 px, #90959c / #a9aeb6), **(5)** micro labels (mono caps, cap 9–10.5 px, #737a84–#78797c). Size ratios by cap height: hero : caption : subheader : micro ≈ **6.5 : 2.7 : 1 : 0.65**. Only one accent-lit thing is fully saturated at a time. | `textbox()` measurements | Caption 60 px w800 dominates. No serif hero. Labels ≈ 18–22 px bold | We have no hero tier. Our caption is ~1.5× louder than R5's relative to the UI. | tuning + new module (hero serif) |
| 6 | **Spacing rhythm** | Stage inner inset 12 px (subheader at x=72, cap-top y=288 → 21 px below the frame top). 5-card row: cards 186×135, **gaps 4–6 px**, y-jitter ±7 px, tilt ±0.5–1.5°. Panel: header band 34.5 px, row pitch **73.5 px**, row dividers 1.5 px. Layer stack: row h 57, gap 10 (pitch 66). Table: row pitch 56 (`dim_factory` at 87.41). Dashed Q boxes: h 120, gap 20. Everything above lands on multiples of about 6 px. | ruler zooms `m_z_*` | Our instance rows have a 250 px pitch, i.e. very loose | R5 is ~3× denser. | tuning |

---
## B. Persistent chrome

| # | Item | R5 measured (px @1080) | Evidence | Our v2 | Gap | Fix class |
|---|---|---|---|---|---|---|
| 7 | **HUD / status bar** | There is no bar container: text and segments sit directly on the grid. **Chapter label:** x 60, cap-top y 204, cap height **15 px**, sans, ALL CAPS, tracking ≈0.2 em (e.g. "GOTHAM" is 90 px wide), colour **#9fa3a8–#aaaeb2**. **Divider:** 1.5 px hairline **#191a1d** at y=237, x 60–1020. **No metrics, pill or status dot.** Values change only at chapter boundaries, as a 1-frame hard swap (see #8). | `m_hud.py`, `ev3.py` | Dark rounded bar (#06070a fill) y 214–278 (h 64), "LIVE" + "● OK" pill | Our HUD is a filled pill bar with state. R5's is a borderless label + progress + hairline, about 3× lighter visually. | tuning (restyle) + new module (chapter HUD) |
| 8 | **Chapter / progress indicator** | A **10-segment dashed progress bar**, right-aligned: **x 687–1019**, y 207–211 (3 px thick). Each segment is **~26 px wide with ~8 px gaps (pitch 34 px)**. Colours: **past #3c424a · current #91d2e8 (cyan) · future #2a2e34**. Only the current segment is cyan; past segments stay mid-grey (they do not stay lit). Chapter starts (from the HUD): 0, 12.52, 21.93, 33.53, 52.58, 65.90, 78.37, 100.50, 111.77, 141.27 s. The label text changes in the same frame. **Update = hard 1-frame swap**, the same frame as the content swap (12.517: segment 1 #93d2ea→#414249 and segment 2 #2b2c33→#93d2ea in one frame; 52.583 likewise). No tween, no flash. The stage subheader (sans caps, x 72, cap-top y 288, cap 15 px, #aaaeb4) works as a **sub-chapter breadcrumb**: it changes on every sub-state (62 times). | `m_hud.py` over 34 frames; `ev3.py` at 12.35–12.75 and 52.45–52.85 | none | We are missing both chapter progress and the per-sub-state subheader. | new module |
| 9 | **Mascot** | **Asset:** a cel-shaded cartoon (bald kid, glasses, black suit, holding a tablet) with a black outline, flat colours and an elliptical floor shadow (**#313333**, ≈258×20 px, bottom y 1377). **Box: x 0–447, y 783–1377** (41% W × 31% H); head top y 789; the ear is cropped by the left frame edge. **Entrance** (0.200–0.667 s): slides in from the left, travel **495 px**, **15 frames = 500 ms**, per-frame right-edge positions @720: 30,81,124,162,193,219,241,257,270,280,287,291,293,295. This is an exact fit to **easeOutCubic** (model error ≤5 px @720). No overshoot, no opacity change. **Idle:** blink on a **~3.2 s loop** (3.20, 6.40, 9.63, 12.80, 16.03, 19.30 …), **3–4 closed frames (100–133 ms)**, 45 blinks in 164 s (16.4/min), with occasional doubles about 0.24 s apart. **Head-glance:** 11 events. The face shifts **21–27 px** sideways and back over **13 frames (433 ms)**, symmetric ease-in-out, eyes looking toward the content. 9 glances go left and 2 go right (11.67, 53.50). They **coincide with serif hero-word and key-noun beats**: 15.33 ONE PROBLEM, 33.03 CONNECTS, 34.47 GOTHAM, 65.33 FOUNDRY, 80.83 ONTOLOGY, 102.93 FDE; the right glance at 53.50 matches the card-row push. **No lip-sync, no gestures, no scale punches, no pose swaps.** **Hidden** (hard cut, 1 frame) during the full-width photo cards: 21.93–23.77 and 55.87–57.30. **Overlap:** the stage-frame bottom (y 840) runs behind the head, and hero serif text may overlap the head (33.28, 163.78). | `ev1.py`, blink scan (eye-white pixels, 4926 frames), head-glance scan (skin centroid) | SpongeBob, left 1.5%, top 49%, width 24% (≈260 px) | R5's mascot is **1.7× larger**, sits higher (40.8% vs 49%) and is flush-left. It has **semantic head-glances** on hero beats plus a fixed blink loop. We have no glance/blink sync (verify our idle), and our entrance recipe is unknown. | tuning (size/pos) + new capability (glance-on-beat) + asset (glance frames) |
| 10 | **Captions** | **Box:** centred on x=540, width hugs the text (**padding 36 px L/R**), **h 103.5 px (y 1444.5–1548)**, radius **≈9 px**, fill **#090d11** (only about 4 levels above the #090a0d background), **1.5 px border #15191c–#18191c**, and a soft 4–6 px drop shadow below (**#07080b**). **Type:** sans (Inter-like), **weight ≈600–700**, sentence case, **x-height 30 px, cap/ascender ≈40 px, font-size ≈54 px**, baseline y=1515. **Karaoke:** one active word **#fbfeff** (core luma 232–240); all other words, before and after, are **#b0b4b9** (core luma 176–184, ≈72% of active). **Chunks** (scanned over all 4947 frames): **137 chunks, 49.8/min, ≈3.5 words/chunk** (481 words), duration median **1.00 s** (p10 0.53, p90 1.97, max 3.5 s). Text width median 501 px, max 723 px (67% W), always one line. **Swap:** old chunk drops to all-grey for 1 frame → **exactly 1 blank frame** (136 of 137 swaps) → new chunk enters grey → active word ramps to white over 2–3 frames (≈70–100 ms). **Never absent** except that 1 frame. Chunk swaps land 50–70 ms **before** the audible word (see timing caveat). | `m_cap.py`, `capscan.py`, `ev15.py`, `m_caption_sheet.png` | Box top ~77%, **60 px weight 800**, #07090c fill, **3 px light border, 8 px hard offset accent shadow**, blue active word | Ours is a loud "sticker" (hard offset shadow, thick border, accent-coloured active word). R5's is a **quiet dark chip, 1.5 px dim border, soft shadow, white-on-grey karaoke**, 10% smaller type and lighter weight. Box position is equivalent (≈77–78%). | tuning |

---
## C. Visual design system

### 11. Palette (dark theme): measured hex values (medians of flat areas; "core" = top-decile pixels of strokes/text)

| Role | Hex | Where measured |
|---|---|---|
| Background | **#090a0d** | every corner, all frames (luma 9.9 ± 0.2 for the whole video) |
| Grid line | **#0b0c0f → #131418** (+2 to +8 luma) | 60 px pitch; strongest across mid-frame, fades out below y≈1700 (min-plate `m_bgplate_boost.png`) |
| Surface 0 (stage frame) | transparent + **1.5 px #1f2023** border (top edge #252629) | stage frame x 60–1020 y 267–840 |
| Surface 1 (panel body) | **#10141a** | info panel 44.78 |
| Surface 2 (panel header, tiles, rows, bars) | **#151b23** | panel header band, node tiles, stack rows, strike bars |
| Caption chip | **#090d11** + border #15191c | caption box |
| Borders | panel **#21252b**; row **#252b35**; divider **#25292f / #1a1e24**; frame #1f2023 | runs profiles |
| Text primary | **#ffffff / #fbfeff** | hero serif, card titles, active caption word |
| Text secondary | **#a9aeb6 / #aaaeb4** | panel values, subheader, HUD label (#9fa3a8) |
| Text tertiary | **#90959c** | panel keys |
| Text muted | **#737a84 / #78797c** | panel header, node labels, mono tags #64686c |
| Caption inactive | **#b0b4b9** | karaoke non-active words |
| Text dim/unlit | **#2a2c2f** | unlit node labels (41.85 s) |
| **Teal** (connected / platform / solution) | stroke **#8fd0e6** (HUD seg #91d2e8, ring #84c3d6, progress #72c5de, connectors #7cc1cf); text **#b3e8f7**; deep fill **#0a2632–#0c2530**; border **#254850–#2f5c6c** | 1.88, 55.75, 65.68, 113.62, 141.15, 143.05 |
| **Amber** (AI / question / decision / emphasis) | text **#eec684–#f2cf99**, glyph **#e5c182**; border **#bf9d7c / #b79c7e / #c9a67a**; fill **#281f12**; row tint **#2a2014**; cell outline **#d5a86a** | 87.41, 111.65, 112.3, 128.38, 130.50, 136.75 |
| **Pink** (Gotham entities) | lit icon **#c88696**, dim icon **#433139**; lit border **#513539**, dim #1b181c; links **#b7727b**; red string **#be5867–#ec5e71** | 41.85–42.45, 44.78, 38.38 |
| Status "neutral" chip | fill #1a1d23, dashed grey border, text #6b6f75 | "EVERYONE ELSE" 141.15 |

- **No green/red semantic state system.** "BEHIND" is amber, "ON TIME" is grey, "ACTIVE/IDLE" are plain mono text.
- **Hues on screen at once:** 0–1 in most frames (machine: 0 saturated hues in 88% of frames). At most 2 (teal + amber at 113–156 s, teal + pink at 44–52 s). **A hue marks a domain** (teal = the platform, pink = the Gotham world, amber = AI/question). It never marks a list item: all 5 entity nodes are the same pink.
- **Our v2 (measured at v2bg2_5.4):** blue #558af9 / #4f87fd, green #40c48c, healthy #83ebb6, caption active #76a6f8 with a #6da3fb offset shadow, a red ERROR chip, a navy gradient bg, and **2–3 saturated hues on screen at once**. Gap: tuning (palette tokens) + a rule change (hue = domain, not state).

### 12. Typography

| Role | Family (visual ID, not provable) | Size @1080 | Weight / case / tracking | Colour |
|---|---|---|---|---|
| Hero word | condensed high-contrast serif (Instrument-Serif-like) | cap **72–112 px**, set to fill ≤ the stage width (ONE PROBLEM cap 97, FDE 112, NONE OF IT CONNECTS 85 over 917 px, ONE OPERATING PICTURE 72 over 864 px, AIP 70, FOUNDRY-in-bar 61, "2003" 49, column titles 28) | regular, ALL CAPS, tight | #ffffff |
| Caption | geometric/grotesk sans (Inter-like) | x-height 30, cap ≈40, font ≈54 px | ≈600–700, sentence case | #fbfeff / #b0b4b9 |
| Big statement text (Q boxes, prompt, question) | same sans | cap 33 ("WHY?"); prompt/question ≈26 px font, line pitch 51 | 600, sentence or caps | white / amber #f2cf99 |
| Card / row title | same sans | cap 12–15 | 700, ALL CAPS | white / #8fa3b3 unlit |
| Stage subheader and HUD label | same sans | cap 15 | 500–600, ALL CAPS, tracking ≈0.2 em (8.9 px/char @720) | #aaaeb4 / #9fa3a8 |
| Kicker line (under heroes) | monospace (IBM-Plex-Mono-like) | cap 15, advance ≈15 px/char | 400, ALL CAPS, wide (≈0.1 em extra) | #87888b–#8e9094 |
| Panel rows / table cells | mono | cap 14–18 | 400, caps; table header lowercase | #90959c keys / #a9aeb6 values |
| Micro tags (HUMINT, PERSON, panel header) | mono | cap 9–10.5 | 400, caps, wide | #64686c–#78797c |

- **Words on screen** (excluding the caption): ≈30–35 (counted at 44.78 and 128.38).
- **Line-height:** prompt 51 px on ≈26 px type (1.95×, loose); panel rows 73.5 px pitch.
- **Our v2:** one sans (Inter-like) at weights 700–800 plus mono IDs; no serif and no wide-tracked mono kickers. Gap: new asset (serif + mono font) + tuning.

### 13. Card / panel anatomy

| Module | Fill | Border | Radius | Shadow | Chrome | Padding / rows |
|---|---|---|---|---|---|---|
| Stage frame | none | 1.5 px #1f2023 | 0 (square) | none | subheader text inside top-left | inset 12 px |
| Info panel | #10141a | 1.5 px #21252b | ≈6 px | none | **header band** 34.5 px, #151b23, mono micro title, 1.5 px divider #25292f | rows at a 73.5 px pitch, key left / value right, 1.5 px dividers #1a1e24 |
| Source/system card (5-row) | photo top ≈55% + #1a1d22 label band, or plain #15181e | 1.5 px #2b2f36 | ≈6 px | none visible | mono tag + bold caps title + grey status dot (≈7 px) | 186×135, tilt ±0.5–1.5°, y-jitter ±7 |
| Node tile | #151b23 (lit #131c21) | 1.5 px (dim #1b181c → lit accent-dim, e.g. #513539 / #2f5c6c) | ≈9 px | none | centred line icon ≈39 px | 105×105, mono label 14 px below |
| Accent card (prompt / question / decision) | amber #281f12 or teal #0a2632 | 1.5 px amber #bf9d7c or teal #28505c | ≈6 px | none | mono micro label top-left (e.g. "ASKED IN AIP") | 30 px inner pad |
| Placeholder / "slot" | same fill | **dashed** 1.5 px (dash ≈9 on / 6 off) | 9 px | none | — | used for "?", WHY?, SOMETHING NEW, THE CUSTOMER, dim list rows |
| Evidence card | photo, polaroid white frame | — | 0 | soft shadow | **red pin dot** top-centre; tilt ±3–6° | ≈150×110 |

- No window chrome anywhere (no traffic lights, URL bars or tabs).
- No glows and no gradients on cards.
- **Our v2:** 2 tall cards (#151e2a), 2–3 px coloured top bar and outline, radius ≈16, instance rows 250 px apart. Gap: tuning (radius 16→6, borders 1.5 px dim, density).

### 14. Pills / badges / chips
- **Teal pill** "THE SAME PROBLEM", "GOVERNMENT & DEFENSE": h 60, fully rounded, fill #0b2634, 1.5 px #254850 border, bold sans caps cap 19 px, #b3e8f7 (55.75).
- **Stamp row** "POLITICAL" (5.3): 549×126 box, #151b23 fill, 1.5 px border, bold caps cap ≈22, white. Unstamped rows are dashed outlines with grey text.
- **Quote chips** "the spy company": small rounded pills (h ≈36), 1.5 px grey border, sans 20 px, stacked vertically.
- **Role chips** ANALYST (lit teal box) and EVERYONE ELSE (dashed grey box).
- **Status words** inside rows (BEHIND amber, ON TIME grey, "3 ORDERS" amber mono).
- **Dots:** a grey status dot on source cards (≈7 px); an amber end-dot on the timeline (≈12 px).
- **No filled status pills with dots**, like our "● OK".
- **Our v2:** LIVE/IDLE/ERROR pills plus the "● OK" pill. Gap: tuning (fewer, quieter chips).

### 15. Iconography and imagery
- **Icons:** outline/line icons with **stroke ≈3 px @1080** (2 px @720) and rounded caps, **≈39 px glyph** in a 105 px tile. Examples: person, pin, alert-diamond, document, car, phone, DB-cylinder, factory, box, truck, customer. The colour is the domain accent: dim ≈30% opacity (#433139) → lit 100% (#c88696).
- **Logo:** the Palantir wordmark, white, ≈40 px cap (1.88, 143.05).
- **Photos (≈25 distinct):** desaturated and cool; no Ken Burns (pixel diff ≤0.25/255 across a 3 s hold). Uses: satellite and map thumbnails, document scans, a Pentagon aerial, factory/warehouse/port, founders' headshots (cream-matted cards), an FDE photo.
- **Mascot:** a cel cartoon (see #9).
- **No emoji, no 3D, no illustrations** other than the mascot.
- **Our v2:** status dots only, no icon tiles, no photos. Gap: new module (icon tile) + asset (icon set, photo sourcing with a desaturate grade).

### 16. Lines / connectors
- **Entity/system links:** solid **cubic Bézier S-curves** with horizontal end tangents. They attach to tile side-centres with a ≈9 px gap. Stroke **≈3 px** (2 @720): teal #7cc1cf (1.88, 94.85) or pink #b7727b (44.78).
- **Drop lines** card→bar: straight verticals, 1.5 px teal.
- **Red string** (38–40 s): straight red #d35f6d lines between pinned cards.
- **Dashed:** the FDE travel line (Palantir→Customer, 1.5 px teal) and the access ring (3 px #84c3d6, dash ≈18 on / 12 off, r≈170 px around a 130 px-radius filled disc #0c2530 with a #2f5c6c rim).
- **Edge labels** (DEPENDS ON, SHIPS FROM, PRODUCES): mono caps cap ≈12 in a dark chip with a 1.5 px border, sitting on the line.
- **No arrowheads** in any sampled frame. Direction is carried by draw order and the travelling icon.
- **Ghost/inactive:** accent at ≈30%, e.g. dim teal DB links at 11.26 (#34474f).
- **Our v2:** one straight slider track (ALB weight line). Gap: new capability (Bézier link draw between tiles, with edge labels).

### 17. Charts / numbers / tables
- **No bar, line or pie charts.**
- **Data grid:** 5 blocks of ≈8×8 square cells (#5b6475-ish) that split apart on "scattered" (19.7, 149.4).
- **Timeline:** a hairline axis with mono year ticks (2003 · 2008 · 2013 · 2018 · 2023). The progress line is 3 px #72c5de with an amber end-dot (113–116 s). The 2003 variant has a serif year (cap 49) and a tick with a teal dot (14.63).
- **Table** (`TABLE dim_factory`): mono throughout, a lowercase snake_case header row with a hairline under it, rows at a 56 px pitch. The highlighted row gets an amber tint fill #2a2014 plus an **amber 3 px cell outline** (radius ≈4) on the key cell "847" (87.41). The "NOT THIS" table gets a white strike line (97.1).
- **Big numbers:** only serif years (2003, 2023) and mono IDs. No counters.
- **Ranked list** (138.35): 3 rows, amber-tinted for at-risk items, teal-tinted for OK.
- **Our v2:** big "100% / 0%" counters (bold sans ≈80 px, coloured). Gap: R5 avoids big coloured numbers, so this is **a style difference, not a missing capability**. A table and timeline would be new modules.

### 18. Data realism
IDs and values are concrete and reused consistently:
- **Entity data:** `SUBJECT 4471`, phone `+1 415 *** 0451`, coordinates `40.71N 74.01W`, `SAME CELL SITE, SAME HOUR`.
- **Tables and keys:** table `dim_factory` with `factory_id 4471/847/5518`, `site_cd`, `line_type`, `cc US/DE/NL`, `status ACTIVE/IDLE`; departmental keys `DEPT A person_id / DEPT B subj_ref / DEPT C entity_no`; sources `SYS 01–05`.
- **Operational data:** orders `SO-88214 / SO-88215 / SO-88217` (reused as the final decision "MOVE SO-88214 FROM PLANT A TO PLANT C"), plant names `PLANT A/C/D` reused across the table, ranked list and decision, `LINE 3 DOWN 18 MIN/SHIFT`, categories `HUMINT/IMINT/GEO/SIGINT/SYSTEMS`, systems `MES/ERP/TMS/LEDGER/WMS`.
- **Consistency with the narration:** "847" is spoken and highlighted; every ID recurs.
- **Our v2:** realistic IDs (i-0a3f8c21, v2.0.4, blue-tg, :443). Equivalent. Gap: none (keep); add cross-scaffold ID reuse.

### 19. Background treatment
- A flat **#090a0d** with a **static 60 px square grid** (1.5 px lines, +2 to +8 luma). The grid is aligned so the stage-frame edges fall on grid lines.
- The grid fades out toward the bottom (invisible below ≈88% H) and is slightly weaker at the very top.
- **No gradient, vignette, noise or motion.** Corner luma is constant for 165 s.
- **Our v2:** a navy→black radial gradient (#0e141c / #151e2a / #0e1816) with no grid. Gap: tuning (flat bg plus a grid plate).

---
## D. Module catalog (item 20)
Sizes are @1080. "Uses" counts the scaffolds or sub-states in which a module was seen (beat log in `evidence/…visual_log.md` §1–2, checked on the 34 ref frames). Colours are the tokens from §C.

| ID | Module | Anatomy | Size / geometry | Variants / states | Data carried | Uses and reuse |
|---|---|---|---|---|---|---|
| M1 | **Chapter HUD** | caps label + 10-seg dashed progress + hairline | label x60 y204 cap 15; segments 26×3, pitch 34, x 687–1019, y 207; hairline y237 | past #3c424a / current #91d2e8 / future #2a2e34 | chapter name, index/10 | always on; 10 chapters |
| M2 | **Stage frame + subheader** | 1.5 px #1f2023 square frame; sans-caps subheader top-left | 960×573 at (60,267); subheader (72,288) cap 15 | none (always the same box) | sub-state title ("AN ANALYST STARTS WITH ONE PERSON") | 63 sub-states |
| M3 | **Info panel** | #10141a body, 34.5 px #151b23 header band with a mono micro-title, rows | 551×236 at (469,891); row pitch 73.5 | key/value rows (44.78) · paragraph (16.13, 122.18) · workflow steps "1 READ / 2 JOIN / 3 FLAG" (111.65) · order rows with amber/teal tint (72.85) · image + caption (map 49.88) · logo+paragraph (143.05) · decision (156.88) | secondary facts for the current sub-state | ≈40 sub-states; **re-skinned per sub-state, same frame** |
| M4 | **Caption chip** | dark chip, 1.5 px border, soft shadow, karaoke | h 103.5, pad 36, centre y 1496 | active #fbfeff / other #b0b4b9 | 1–6 words | always |
| M5 | **Mascot** | cel cartoon + floor shadow | 447×594 at (0,783) | idle, blink (3.2 s loop), head-glance ±21–27 px, hidden | — | always, except photo cards |
| M6 | **Icon node tile** | 105² tile #151b23, r 9, 1.5 px border, 39 px line icon, mono label below (+ optional white value line "SUBJECT 4471") | 105×105; label cap 10.5, gap 14 | dim (≈30% accent) → lit (100% accent + tinted fill); teal (DB, objects), pink (entities), neutral grey | entity type + instance value | 1.88, 11.26 (dim), 40.97–52.1, 68.1, 90.5–100.5, 160–164 |
| M7 | **Bézier link** | 3 px cubic S-curve, horizontal tangents, ≈9 px gap to tile | — | teal / pink / dim 30%; dashed (FDE); optional mono edge-label chip | relationship (DEPENDS ON, SHIPS FROM) | node maps, object graph, final "one row" |
| M8 | **Source/system card row** | 5 tilted cards: photo top + dark band with mono tag + bold caps title + status dot | each 186×135; row x 67–1014, y 331–482; gaps 4–6; tilt ±0.5–1.5°; y-jitter ±7 | empty (not yet lit) → lit (photo fades in); agency set ↔ manufacturer set (push-slide); lit teal underline strip (143–164) | 5 sources/systems with category codes | **persistent anchor** 23.77–52.57, 57.25–72.97, 141.27–164.9 (≈62 s total, 38% of runtime) |
| M9 | **Hero serif + mono kicker** | condensed serif caps word + mono caps line ≈40 px below | cap 72–112, width ≤ 917 | alone; inside a bar (FOUNDRY); over a timeline ("2003"); with a mini logo | the sentence's key noun | 7 uses (ONE PROBLEM, NONE OF IT CONNECTS, GOTHAM, THE ONTOLOGY, FDE, AIP, ONE OPERATING PICTURE) + FOUNDRY bar |
| M10 | **Photo card** | stage-width photo, 1.5 px frame, mono credit strip in the photo bottom, 3-row key/value table below | 960×663 at (60,372); table 1095–1244 | Pentagon, factory, FDE (FDE sits inside the stage frame with a WHERE/WITH/ON table) | place/scene + 3 facts | 3 uses; mascot hidden for 2 of them |
| M11 | **Pinned evidence card + red string** | polaroid-framed photo, red pin dot, tilt ±3–6°, mono caption | ≈150×110 each (6 cards) | — | "evidence" items | 35.6–40.9 |
| M12 | **Data-cell grid** | 5 blocks of ≈8×8 grey cells | whole row x 60–1020, blocks ≈170 px | whole → diagonal-wave fill → split into 5 with ±y offsets and tilt | "enormous / scattered data" | 16.25–21.93, 147.1–151 |
| M13 | **Accent statement card** | #281f12 amber or #0a2632 teal fill, 1.5 px accent border, r 6, mono micro label + sans statement | 900×190–285 at x 90–990 | solid · **dashed placeholder** (WHY? / WHAT SHOULD WE DO) · typed text | question / prompt / decision | 109–111, 122–131, 156.6 |
| M14 | **Stamp list** | 3 stacked rows; the stamped row gets a solid box, the rest stay dashed | 549×126 rows at x 471–1020 | dashed → stamped (scale 1.2→1, tilt 3°→0) | 3 adjectives | 4.4–7.9 |
| M15 | **Quote chips** | small outlined rounded chips, stacked | h ≈36 | pop in one by one | "what people say" quotes | 2.0–4.4 |
| M16 | **Teal pill** | rounded full, teal fill/border/text | h 60 | — | a verdict/category ("THE SAME PROBLEM") | 55.1, 77.1 |
| M17 | **Platform bar + drop lines** | full-width teal bar with serif text; vertical 1.5 px teal drops from the cards above | 903×111 at (88,533) | grey placeholder → teal (recolour 130 ms); moves up at 65.9 | platform name (FOUNDRY) | 64–72.97, 111.8 (base bar) |
| M18 | **Layer stack** | question bar + 5 rows (h 57, pitch 66); the top row is amber | rows x 260–1020 | a layer drops on top | architecture layers + right-aligned mono role | 130.6–136.9, 153.4 |
| M19 | **Strike bar** | #151b23 bar with bold caps text; a 3 px #dce2ea strike draws across | 879×132 | normal → struck | a misconception | 143.2–147.1 (also strike on a table/pill/label at 31.1, 96.8, 123.9) |
| M20 | **Mono data table** | panel, `TABLE name` micro title, lowercase header, mono rows at a 56 pitch | 894×188 at (84,370) | row tint + cell outline highlight; strike | raw DB rows | 84.2–87.5, 94.97–97.2 |
| M21 | **Timeline** | hairline axis + mono year ticks; teal progress line 3 px; amber end-dot; serif year / AIP box above | full stage width | founding (2003 tick) · progress 2003→2023 + dashed slot filled by an amber box | dates | 12.5–14.75, 113.4–116.4 |
| M22 | **Letter tiles** | 3 amber tiles: serif letter + sans caps word | 306×135 each, gap 9 | dim → lit one per word | acronym expansion | 116.4–118.3 |
| M23 | **Access ring** | teal disc r130 + dashed ring r170 + side role chips | centred (540,588) | chip lit teal vs dashed grey | who can see the data | 138.5–141.3 |
| M24 | **Numbered pipeline tiles** | 4 teal tiles "01–04" (serif numeral, bold caps title, mono sub) inside a panel | 4 × ≈103×84 @720 → ≈155×126 | lit sequentially / all lit | the business in 4 steps | 141.3, 151.2–157.7 |
| M25 | **Ranked answer list** | panel with 3 rows: name + mono reason + right value, amber/teal tints | 894×350 | row lights amber/teal | an AI answer with reasons | 136.9–138.5 |
| M26 | **Two-column compare** | 2 cards: serif title, mono sub, 3-photo strip, bullet list, teal pill | 471×438 each | column dim → lit | FOUNDRY vs GOTHAM | 72.97–78.4 |
| M27 | **Logo lockup** | Palantir wordmark + mono sub-lines | wordmark ≈40 cap | intro / outro | brand | 0.6, 142.1 |
| M28 | **Portrait cards** | 3 founder photos with name + mono role | ≈120×110 each in a panel | first card tinted | people | 12.5–14.75 |
| M29 | **Travelling token** | a teal icon tile moves along a dashed line between two cards | 78² tile; travel 540 px | — | "an engineer is deployed" | 101.3 |
| M30 | **Row list with status** (SOURCE LEDGER) | panel, numbered rows 01–05, right mono category + "ISOLATED" | row pitch ≈45 | — | 5 sources | 23.8–33.5 |

**How modules combine:** there is always **M1+M2+M4+M5** chrome. On top of that comes **one primary module in the stage frame** (M6/7, M8+sub-module, M9, M12, M13, M18–M26) plus **one M3 panel** (≈70% of sub-states), about 3 modules per frame. The same M3 frame is re-skinned under the same stage module to advance the story (for example, the analyst chain 44.9→46.9→48.6→50.1 swaps only the panel and the subheader, and lights one more node).

---
## Layout templates (item 4), geometry @1080

| T | Name | Geometry | Examples |
|---|---|---|---|
| T0 | **Chrome (all templates)** | HUD label (60,204) · progress 687–1019×207 · hairline y237 · stage frame 60–1020 × 267–840 · subheader (72,288) · mascot 0–447 × 783–1377 · caption chip centred x540, y 1444–1548 · empty band 1548–1920 | every frame |
| T1 | **Node map + panel** | 4–7 icon tiles (105²) scattered in the stage y ≈ 480–800, Bézier links; M3 panel 469–1020 × 891–1127 | 1.88, 44.78, 94.85 (graph in a sub-panel 84–978 × 580–740) |
| T2 | **Anchor card row + sub-state** | M8 row y 331–482; below it one sub-module y 500–820 (node graph / grid / bar / icon row / drop lines); M3 panel on the right | 28.38, 44.78, 49.88, 65.68, 72.85, 150.88, 156.88 |
| T3 | **Hero word** | subheader; serif word at x 78, cap-top ≈500–650, cap 72–112, width ≤917; mono kicker ≈40 px below; optional paragraph panel (sans 24 px, 4 lines) at 469–1020 × 930–1100 | 16.13, 33.28 (sits under the card row), 103.65, 80.9 |
| T4 | **Photo card** | photo 60–1020 × 372–1035; credit strip; 3-row table 1095–1244; no mascot/panel | 23.65, 55.87 |
| T5 | **Statement card(s)** | 1–2 accent cards x 90–990: single h ≈285 (y 429–710) or two dashed h 120 (429–548, 572–689); mono kicker right-aligned below; M3 panel | 111.65, 128.38, 130.50 |
| T6 | **Stack / list** | question bar (h ≈85) + rows h 57 pitch 66 at x 260–1020; or 2 strike bars 879×132 at y 429 / 600; or ranked list 894×350 | 136.75, 138.35, 146.98 |
| T7 | **Centred diagram** | a central object at x 540 (ring r170, chip 351×126, AIP box, letter tiles 3×306) + side chips or axis | 113.25, 116.25, 118.15, 122.18, 141.15 |
| T8 | **Two columns** | cards 60–531 and 549–1020, y 330–768 (or 2 small cards 90–450 / 630–990 at y ≈330–450 with a travelling token) | 78.25, 100.5–102.6 |
| T9 | **Table** | M20 at 84–978 × 370–558 + mono kicker at y ≈690; M3 panel | 87.41, 97.11 |

**Our v2:** one template, "two tall service cards + slider header + HUD bar", with the content card spanning 330–1010 × 300–1380. We have none of T1–T9.

---
## E. Motion system (items 21–27)

### Motion spec table: 18 events measured frame by frame (30 fps, raw decode via `fg.py`; px @1080 = 1.5 × @720)

| # | Event (t, s) | Script | Property | Per-frame series (@720 unless noted) | Duration | Easing (from deltas) | Anchor (ASR → audible ≈ −0.28 s) |
|---|---|---|---|---|---|---|---|
| E1 | Mascot slide-in 0.200→0.667 | `ev1.py` | x (right edge) | 30,81,124,162,193,219,241,257,270,280,287,291,293,295 (Δ 51,43,38,31,26,22,16,13,10,7,4,2,2) | **15 f = 500 ms** | **easeOutCubic** (fit ≤5 px), no overshoot | free (video start) |
| E2 | Stamp "POLITICAL" 4.917→5.050 | `ev2.py` + strip | scale / tilt / fill α / text colour | right-edge overshoot 38+,24,8,2,0 px → scale ≈1.21→1.13→1.04→1.01→1; tilt ≈2.9°→1.35°→0.6°→0; fill L 17.7→22.7→24.7; text L 166→173→194→209→224→239→251 | scale 4 f (133 ms); text grey→white 5 f (5.017–5.150) | ease-out, no overshoot; the text recolour lags 3 f | "political" 4.64 → +277 ms (ASR) |
| E3 | Chapter HUD change 12.517 / 52.583 | `ev3.py` | segment colour, label | #93d2ea↔#414249 in 1 frame; label swap in the same frame | **1 f** | hard | "Palantir" 12.40 (+117) / 52.62 (−37) |
| E4 | Node light PERSON 41.95→42.083 | `ev4.py` | icon/border/fill/label colour | icon #433139→#694652→#865a68→#a97181→#b87c8c→#c88696; border #1b181c→#513539; fill #0c1014→#131c21; label #2a2c2f→#6c6e71 | **4–5 f (133–167 ms)**; PLACE 3 f (100 ms) | near-linear opacity ramp 30%→100%, no scale | "people" 41.66 +290; "places" 42.12 +163 |
| E5 | Pink links draw 44.250→44.550 | `ev5.py` | stroke length (px drawn) | Δ 27,56,104,176,182,184,146,96,38,6 (all links at once) | **9–10 f (300–330 ms)** | **ease-in-out** (sine/cubic) | "together" 43.86 +390 |
| E6 | Card-row push-slide 53.467→54.133 | `ev6.py` + strip | x of row | exit Δ −2,−7,−15,−25,−38,… (accelerating, fading); enter x 547,413,307,227,165,125,93,72,61,53→45 (Δ 134,106,80,62,40,32,21,11,8) | exit ≈8 f; entry ≈12 f (400 ms); total **20 f (667 ms)**, overlap ≈2 f | exit **ease-in + fade**, entry **ease-out (cubic)**; travel ≈1050 px | "businesses" 53.86 → the push starts −390 ms (on "realized") |
| E7 | LANGUAGE MODEL chip drop 112.333→112.55 | `ev7.py` | y top, opacity | y 251,262,271,277,280,283,284 (Δ 11,9,6,3,3,1); colour #8f7e62→#dec290 | **6–7 f (≈220 ms)**; travel **50 px** | easeOutCubic + fade-in, no overshoot | "AI" 112.16 +170 |
| E8 | Strikethrough 144.000→144.267 | `ev8.py` | line length | 53,230,360,446,500,531,547,553,555,556 px (10,41,65,80,90,96,98,100%) | **8–9 f (≈280 ms)**; line x 123–956 @1080, 3 px, #dce2ea | **easeOutCubic** L→R | "AI" 143.78 +220 |
| E9 | Engineer token travel 101.267→101.70 | `ev9.py` | x | left edge 154,156,162,175,202,249,324,406,458,488,504,511,513,514 (Δ 2,6,13,27,47,75,82,52,30,16,7,2,1) | **13 f (433 ms)**, travel **540 px** | **ease-in-out (cubic)**, symmetric; peak speed 82 px/f @720 | "deployed" 101.38: starts −110, peak on the word |
| E10 | Typewriter question 109.183→110.050 | `ev10.py` | glyph count | +2.4 chars/frame steady; line 1 x 110→295 in 10 f, line 2 101→426 in 17 f | **27 f (900 ms)** for 66 chars (**73 chars/s**) | linear; no caret seen | "real problems" 109.38 −200 |
| E11 | Timeline progress 113.617→114.017 + dot 114.083→114.15 | `ev11.py` | line end x | 89,105,136,184,253,349,449,523,575,607,628,637,639 (Δ 16,31,48,69,96,100,74,52,32,21,9,2) | **12 f (400 ms)**, travel 839 px; end-dot fade 3 f (100 ms) after the line | **ease-in-out (cubic)**; dot sequential | "2023" 113.48 +137 |
| E12 | Serif "ONE PROBLEM" 15.317→15.45 | `ev11.py` | opacity, width (tracking) | text L mean 85→149→183→195→199; width 462→455→452→451 (−2.4%) | **4 f (133 ms)** | ease-out fade + **tracking-in 2.4%** | "problem" 15.18 +137 |
| E13 | Source tile lighting FIELD REPORTS 24.45→24.68 | `ev13.py` | tile opacity (photo+band+title) | meanL 11→45→72→91→107→116→119→122→124 | 5 f to 90%, **7 f (233 ms)** to settle | **ease-out (expo-ish)** | "field reports" 24.02–24.30 +150 |
| E14 | FOUNDRY bar recolour 65.08→65.18, serif text 65.35→65.42 | `ev13.py` | fill colour | centre #17181b→#0f1c22→#0e1f29→#0b222d→#0b2531 (full width at once) | bar **4 f (130 ms)**; text **3 f (100 ms)**, 170 ms after the bar | linear-ish recolour; **no width grow** (the placeholder bar already exists) | "Foundry" 65.02 +60 |
| E15 | Caption chunk swap 1.983→2.15; 21.867→22.033 | `ev15.py` | text luma | old chunk all-grey (1 f) → **blank (1 f)** → new chunk grey (1 f) → active word L 185→254 over 2–3 f | ≈5 f total | step + fast ramp | new chunk ≈50–70 ms before the audible word |
| E16 | "?" ring pulse 10.90→11.13 | strip `…010.800.jpg` | ring radius, opacity | r ≈64,100,136,165,190,207,217 px @1080 (Δ 36,36,29,25,17,10); α ≈0.35→0 | **7 f (233 ms)** | ease-out expand + fade-out; 1.5 px grey ring | "does" 10.62 +280 |
| E17 | Grid split into 5 blocks 19.717→20.183 | diff scan + strip | block x/y offsets | frame diff 11.8,13.4,12.9,11.7,10.8,9.7,8.6,7.6,6.2,5.9,3.7,2.8,1.6,1.6,0.5 | 80% by ≈6 f (200 ms); settle **14 f (467 ms)** | **ease-out (exponential)**; blocks gain ±y offset + tilt | "scattered" 19.62 +95 |
| E18 | Hard swaps 7.867, 12.517, 52.583, 128.533, 163.167 | diff scans | content diff | a single-frame spike (5.8, 8.0, 5.8, 8.7, 3.8), neighbours ≤0.1 | **1 f** | hard cut (128.533 is followed by a 4 f, 130 ms box fade; 163.167 by an underline draw 163.23–163.40 (6 f) and a serif fade 163.43–163.57 (5 f)) | sentence onset |

### 21. Entrance recipes
**Element pop.** Opacity 0→1 in **2–4 frames (66–133 ms)**, ease-out. There is no scale or position change for labels, kickers, panel rows or logos.

**Drop-in** (chips and layers). Translate-Y **−50 px → 0** with a fade over **6–7 f (≈220 ms)**, easeOutCubic (E7; the AIP layer at 132.18 is the same recipe).

**Stamp.** Scale **1.2→1.0** with a tilt of **~3°→0** and fill alpha ≈0.7→1 over **4 f**. The label then recolours grey→white over the next 5 f (E2).

**Hero serif.** Fade in 4 f while **tracking tightens ~2.4%** (E12).

**Tile lighting** (E13). The tile fades in to ≈90% in 5 f, then settles by 7 f.

**Stroke draws:**
- Links: 9–10 f, ease-in-out, all at once (E5).
- Strike: 8–9 f, easeOutCubic (E8).
- Progress line: 12 f, ease-in-out (E11).
- Red strings: 3–4 f each, staggered ≈350 ms (visual log).

**Staggers.** One item per spoken word (0.25–1.0 s apart, word-driven, not a fixed stagger). A fixed stagger appears only on non-spoken sequences: evidence cards 250–270 ms apart (36.35, 36.62, 36.85); object icons ≈375 ms apart (68.375–69.625).

**Mascot.** Once, 500 ms easeOutCubic from −495 px.

**No overshoot or spring anywhere** (checked E1, E2, E6, E7, E8, E9, E11).

**Our v2:** caption pops plus state flips; entrance recipe spec not measured here. Gap: tuning, i.e. adopt the 4 recipes above as named presets.

### 22. State-change recipes
- **Dim→lit** (the core R5 device). An element exists at ≈30% accent (icon #433139, border #1b181c, label #2a2c2f) and ramps to 100% in **100–167 ms**. No scale. Examples: E4, the A/I/P tiles, FOUNDRY/GOTHAM columns, workflow steps.
- **Recolour placeholder→accent.** A grey bar turns teal in 130 ms (E14).
- **Text swap:** hard, 1 f (subheader, panel values, HUD label).
- **Strike** (E8).
- **Highlight row:** an amber tint row plus a 3 px amber cell outline (87.41; the outline lands at 86.75 in 2 f).
- **Typed text:** linear at 73 chars/s (E10). The prompt at 125.4–128.1 types **word-locked to speech**.
- **Dashed slot→filled box:** the amber AIP box fills the dashed "SOMETHING NEW" slot in 4 f (115.5).
- **No counters/number tweens, no check ticks, no progress bars** other than the timeline.

**Our v2:** colour/state flips on instance rows (HEALTHY/ERROR) plus % counters. Gap: new capability, i.e. a **dim→lit per-entity lighting state machine** tied to word anchors.

### 23. Emphasis recipes
- **Ring pulse:** a thin circle expands r 64→217 px while fading out, 233 ms (E16). Used 2× ("?" at 10.9 and 79.9).
- **Stamp** (E2).
- **Amber cell outline** (86.75).
- **Serif hero word** (7× in 165 s, about every 20–25 s).
- **Mascot head-glance** toward the content, 433 ms, 21–27 px, on hero beats (#9).
- **Not used:** flash, glow, shake, scale punch, zoom punch.

**Our v2:** scale punches / offset-shadow caption. Gap: tuning, i.e. replace punches with ring pulse + glance.

### 24. Exit and scene-transition recipes
**Every scaffold/sub-state change is a 1-frame hard swap** (E18, 62 swaps, 22.6/min). No crossfades, pushes or zoom reframes between scaffolds, with two exceptions:
- the card-row carousel push (E6, 667 ms, inside a scaffold);
- 100–130 ms fades on a few boxes after the swap (128.53).

**What persists:** HUD, grid, stage frame, mascot, caption chip, and the M8 anchor row for up to 28.8 s.

**Rebuild order after a swap:** the new subheader and primary module come in on frame 0. The panel and secondary labels follow at +0.3–1.5 s (kickers) and the word-anchored lights at each noun. Elements never exit individually, except the stamp list collapsing to a pill row (7.88, hard) and cleared leftovers fading 150 ms (11.75).

**Our v2:** a single scaffold, no transitions in 17.7 s. Gap: new capability (sub-state machine with hard swaps under persistent chrome).

### 25. Process / ambient motion
**None in the UI.** There are no packets, loops, cursors, blinking dots or progress bars. Static holds are truly static: the photo diff is ≤0.25/255 over 3 s, and the grid is constant.

The only ambient motion is the mascot:
- blink every ≈3.2 s, lasting 100–133 ms;
- 11 head-glances.

**Our v2:** idle wobble? (not measured). Gap: tuning. Remove any UI idle loops, keep the mascot blink loop.

### 26. Camera
**None.** No zoom, push, pan, parallax or Ken Burns (visual-log pixel diffs plus corner-luma constancy). The whole video is a fixed 2-D canvas.

**Our v2:** none. Gap: none (matches).

### 27. Choreography
Build is **front-loaded on the swap frame**. Then there is **one event per spoken key noun**, roughly 0 to −70 ms against audible onset (+0.1–0.35 s vs ASR). Then **one secondary mono kicker 0.5–1.5 s later**, so no gap exceeds 2.73 s.

During holds only the mascot moves. Overlap is rare (max 2 simultaneous tweens, e.g. E14 bar + text). Enumerations light **one item per word**: the 5 entities at 42.00/42.28/42.75/43.13/43.75 and the 5 sources at 24.45/25.63/26.13/27.13/27.88.

**Our v2:** state beats on sentences, one scaffold. Gap: new capability (noun-level anchoring + kicker filler).

---
## F. Timing and narration sync (items 28–30)

| # | Item | R5 measured | Evidence | Our v2 | Gap | Fix class |
|---|---|---|---|---|---|---|
| 28 | **Beat density** | **202 visual beats / 164.9 s = 73.5/min**. Machine count 206 (75.0/min); the extra ≈40 mascot blinks are excluded. **Beat gaps:** median **633 ms**, p10 250, p25 450, p75 1033, p90 1575, **max 2.73 s**, **0 gaps > 3 s**. Gaps > 1 s cover 50% of runtime and > 2 s cover 11%. **Structure:** 10 chapters (mean 16.5 s), **33 scaffolds** (12/min; life median 3.3 s, mean 5.0, range 1.1–28.8 s), **63 sub-states** (62 hard swaps = 22.6/min, mean 2.6 s). Build is ≈0–0.2 s at the swap; the rest of the sub-state is word-lit additions. Density falls toward the outro (beats per 10 s: 17,14,10,17,14,11,18,10,11,9,13,12,11,11,11,8,5). | `evidence/R5…visual_log.md` §1–3, `stats_excl.json`; hard swaps re-verified at 5 times (E18) | 1 scaffold for 17.7 s; state beats only | R5 would have used ≈3–4 scaffolds and ≈6–7 sub-states in 17.7 s. | new capability |
| 29 | **Word anchoring** | **56% of beats are word-anchored**, 15% land on a sentence onset, 28% run free (kickers, fixed staggers). Against ASR the lag is +0.1 to +0.35 s. **Against audible onset it is ≈0 to −70 ms** (the ASR runs 0.25–0.30 s early, verified on 3 words). Triggers: key nouns (entity names, sources, products), verbs of action ("scattered", "connects", "deployed", "builds"), negated nouns (strike), acronyms (per-letter lights). Structural swaps sit on sentence-initial discourse markers ("But", "So", "Imagine", "Then there are", "And then"). Kickers run free, 0.5–1.5 s after the primary beat. Two early outliers: LOCATION/EVENT nodes light 0.8 s and 1.2 s *before* their words (48.75, 50.60). | beat log; E4, E7, E8, E9, E11–E17 anchors; audio envelopes | captions word-synced; state beats sentence-level | Missing the noun-level anchoring, the discourse-marker swap rule, and free-running kicker filler. | new capability |
| 30 | **Sentence type → treatment** | **Enumeration** → one dim→lit item per noun (5 sources, 5 entities, A/I/P, 3 adjectives stamped). **Contrast/negation** ("not X", "instead of") → strike line on X, or the "NOT THIS" / "THIS" sub-state pair (94.97/97.23, 122.30/125.27). **Key concept / name** → serif hero word + mono kicker. **Place/scene** ("Imagine an intelligence agency / a manufacturer") → full-width photo card, mascot hidden. **Scattered/disconnected** → the grid splits into 5 blocks. **Connects/links** → Bézier links draw, or drop lines + a teal bar. **Deploy/move** → a token travels between cards. **Chain of steps** ("person → phone → location → event") → one node lit per clause, with the panel re-skinned per clause. **Question** → amber typed card, word-locked typing. **Arrival on top** → a drop-in chip/layer. **Date** → a timeline tick / progress line + serif year. **Numbers** → a mono cell highlight (847), **never a counter**. **State of access** → dashed ring + lit/dim role chips. | beat log; ref frames | numbers→counters; state→colour flips | Our number→counter rule contradicts R5 (R5 uses highlights). We are missing the strike, hero, photo, split, travel and typing treatments. | new modules + rules |

---
## G. Narrative / storyboard (items 31–33)

| # | Item | R5 measured | Our v2 | Gap | Fix class |
|---|---|---|---|---|---|
| 31 | **Structure** | **Hook 0–3 s:** the mascot slides in (500 ms), the Palantir logo pops at 0.60 on "Palantir", a teal 5-system node map draws (0.63–0.90). The question is posed in the caption, and the "?" box and ring pulse arrive by 10.9 s. **Acts** (the HUD chapters): hook/misconceptions → problem (2003, one problem, scattered data) → intelligence-agency example → Gotham (detective wall → entity graph → analyst chain) → same problem for business → Foundry → Ontology (847 table → object graph) → FDEs → AIP (model alone vs on the stack, access controls) → the business (not X, not Y → recap on the same 5-card row). **Escalation:** each chapter reuses the previous chapter's artefacts (the card row, the SO-882xx orders, PLANT A/C/D). **Ending (last 5 s):** the 160.03 swap to scattered teal nodes → links draw progressively (161.4, 500 ms) → nodes snap into one linked row (163.18) → underline draw → serif **"ONE OPERATING PICTURE"** (163.45). The final frame holds on the hero line (no CTA, no logo end-card). | hook = dashboard already built; ends on a state | We have no chaptered arc and no hero resolution line. | storyboard rules (new capability) |
| 32 | **Scaffold selection and transitions** | A scaffold is **kept and mutated** while the sentence subject stays the same set of entities (the agency row for 28.8 s across 12 sub-states). It is **replaced** at chapter boundaries and when the domain changes. 12 scaffolds/min. **Callbacks:** the 5-card row returns 3×; the "scattered" grid split at 19.7 and again at 149.4; the "?" box at 8.9 and 78.4 ("THE WORD ?"); the logo at 0.6 and 142.1; the node map at 0.6 and the final 160–163. | one scaffold | We are missing the keep/mutate vs replace logic and callbacks. | new capability |
| 33 | **Entity continuity** | Five sources keep their **order, positions and category tags** across the whole row lifetime. Pink = the Gotham entities throughout. Teal = platform/connected throughout. Amber = AI/question throughout. Manufacturer systems (FACTORY DATA, ORDERS, SHIPPING, PAYMENTS, INVENTORY) keep their slots at 57–73 s and 141–165 s. IDs recur (4471, SO-88214, PLANT A). | blue/green entity colours are consistent | OK within our single scaffold, but **we have no colour = domain rule** across scaffolds. | tuning |

---
## H. Audio (items 34–35)

| # | Item | R5 measured | Our v2 | Gap | Fix class |
|---|---|---|---|---|---|
| 34 | **Voice** | **Pace 175.7 wpm** (481 words / 164.2 s of speech span). **Pauses:** 53 pauses > 0.15 s, median **0.24 s**, p90 0.42, **max 0.78 s** (14.8 s of pause in total, 9%). Sentence gaps median 0.20 s. 58 ASR segments, about 8.3 words per sentence. Single voice, no speaker changes. **Timbre/pitch/emphasis: not assessable** from the measurements run here (no pitch tracking was done; it would need a listening pass or an F0 extractor). | TTS narration (not re-measured) | Compare our wpm and pause distribution; the target is ≈175 wpm with ≤0.8 s pauses. | tuning (TTS rate/pauses) |
| 35 | **Music bed / SFX / mix** | **Integrated −14.1 LUFS, LRA 1.4 LU, true peak −1.0 dBTP** (ffmpeg ebur128 on the mp4; 48 kHz stereo HE-AAC 54 kb/s). **A continuous bed is present:** inter-word gaps never drop to silence. They measure **−28.6 / −30.6 dBFS RMS** against speech **−16.6 dBFS**, so the bed sits **≈12–14 dB under the voice**. Its energy is concentrated at **33–112 Hz** (spectral flatness 0.40–0.66), i.e. a low sub/pad bed. **SFX:** not detected. Machine check: 19.9% of visual beats land on audio transients against 18% by chance, so **no beat-locked SFX**. Genre/instrumentation not assessable without listening. | **−17.1 LUFS, LRA 2.1, TP −3.2** (measured the same way on v2-bluegreen-2.mp4) | We are **3 LU quieter** than the reference. Bed presence and level are unverified in ours. | tuning (loudness target −14, bed at −12…−14 dB under VO) |

---
## I. Production (item 36)

| R5 measured | Our v2 | Gap |
|---|---|---|
| **720×1280**, 30/1 fps CFR, H.264 High (level 31, B-frames), yuv420p, **video 302 kb/s**, total 363 kb/s, 165.01 s. This is an Instagram re-encode; the original master resolution is **not assessable**. The heavy compression puts **±3 per channel** noise on flat fills and softens 1 px strokes. **Determinism:** fully reproducible. Every element is flat vector UI plus static photos plus one 2-D mascot rig with discrete idle clips, and there is no camera, particle or physics motion. **Render cost:** low (2-D DOM/SVG, 202 tweens in 165 s, the longest 667 ms). | 1080×1920, 30 fps, H.264, 323 kb/s video, 17.7 s | We render at a higher resolution than the reference ships at (fine). The bitrate is similar. No gap. |

---
## Gap matrix (all 36 items, condensed)

| # | R5 reference value | Our v2 | Fix class |
|---|---|---|---|
| 1 Safe zones | top 10.6% empty; x 60–1020; bottom 19.4% empty | HUD 214; content to 72% H | tuning |
| 2 Grid/columns | stage band + mascot col 0–447 + panel col 469–1020, 60 px grid-snapped | mascot + 1 card | new capability (layout) |
| 3 Content bbox | stage 960×573 @ y267; panel 551×236 @ y891 | card 680×1080 | new capability |
| 4 Templates | ≥9 (T1–T9) | 1 | new capability |
| 5 Hierarchy | hero serif 72–112 cap > caption 40 cap > 15 px labels | caption dominant, no hero | new module + tuning |
| 6 Spacing | panel rows 73.5, stack pitch 66, card gaps 4–6 | rows 250 apart | tuning |
| 7 HUD | borderless label + hairline, no pill | filled bar + LIVE/OK pill | tuning |
| 8 Chapter progress | 10 segs, past #3c424a / current #91d2e8 / future #2a2e34, hard swap; per-sub-state subheader | none | new module |
| 9 Mascot | 41% W, top 40.8%, flush-left; 500 ms easeOutCubic entrance; 3.2 s blink; head-glance on hero beats; hidden on photo cards | 24% W, top 49% | tuning + new capability + asset |
| 10 Captions | quiet #090d11 chip, 1.5 px border, soft shadow, 54 px ≈600–700 wt, white/#b0b4b9 karaoke, 3.5 words, 1-frame blank between chunks | 60 px w800, 3 px border, 8 px hard accent shadow, blue active | tuning |
| 11 Palette | #090a0d + 3 domain accents (teal/amber/pink), 0–1 hue per frame | blue/green/red, 2–3 hues, gradient bg | tuning (tokens + rule) |
| 12 Typography | serif hero + sans + wide mono | sans + mono | asset (fonts) + tuning |
| 13 Cards | r 6, 1.5 px dim borders, header bands, no glow | r 16, coloured top bars/outlines | tuning |
| 14 Pills | few; teal pill, dashed slots, stamps | many status pills | tuning |
| 15 Icons/imagery | 3 px line icons in 105 px tiles; ≈25 desaturated photos | dots only | new module + asset |
| 16 Connectors | 3 px Bézier links, edge labels, dashed variants, no arrowheads | slider track | new capability |
| 17 Charts/tables | mono tables + cell highlight, timeline, cell grid; no counters | % counters | new modules |
| 18 Data realism | concrete IDs reused across scaffolds | concrete IDs | none (add reuse) |
| 19 Background | flat + static 60 px grid, fades at the bottom | radial navy gradient | tuning + asset |
| 20 Modules | 30 cataloged (M1–M30) | ≈5 | new modules |
| 21 Entrances | fade 66–133 ms; drop 50 px/220 ms; stamp; tracking-in; no overshoot | — | tuning (presets) |
| 22 State change | dim→lit 100–167 ms per entity; recolour; strike; type | colour flips | new capability |
| 23 Emphasis | ring pulse 233 ms; stamp; glance; hero word | punches / offset shadow | tuning |
| 24 Transitions | 1-frame hard swaps under persistent chrome; 1 carousel push 667 ms | none | new capability |
| 25 Ambient | none in the UI; mascot blink only | ? | tuning |
| 26 Camera | none | none | — |
| 27 Choreography | swap-frame build → per-noun lights → kicker at +0.5–1.5 s | sentence-level | new capability |
| 28 Density | 73.5 beats/min, 22.6 swaps/min, max gap 2.73 s | 1 scaffold / 17.7 s | new capability |
| 29 Anchoring | 56% word-anchored, ≈0 to −70 ms vs audible | sentence | new capability |
| 30 Sentence→treatment | 12 rules (§F) | counters/flips | rules + modules |
| 31 Structure | chaptered, hero-line ending | single state arc | storyboard rules |
| 32 Scaffold logic | keep/mutate vs replace, 12/min, callbacks | none | new capability |
| 33 Continuity | colour = domain; fixed slots | partial | tuning |
| 34 Voice | 175.7 wpm, pauses ≤0.78 s | not measured | tuning |
| 35 Mix | −14.1 LUFS, LRA 1.4, TP −1.0, bed −12…−14 dB under VO | −17.1 LUFS, LRA 2.1, TP −3.2 | tuning |
| 36 Export | 720×1280 30 fps 302 kb/s (IG re-encode) | 1080×1920 30 fps | none |

---
## Top 15 gaps vs our v2 (ranked by visual impact)

1. **Sub-state engine: hard 1-frame swaps under persistent chrome** (22.6 swaps/min, 12 scaffolds/min). Ours holds one scaffold for 17.7 s. *New capability.*
2. **Stage/panel layout** (stage 60–1020 × 267–840 plus an info panel 469–1020 × 891–1127) and templates T1–T9 to replace the single tall dashboard card. *New capability.*
3. **Dim→lit per-entity lighting**, word-anchored (≈30%→100% accent in 100–167 ms, one item per spoken noun, ≈0 to −70 ms vs audible onset). *New capability.*
4. **Serif hero-word module** (condensed serif, cap 72–112 px, width-fitted, 133 ms fade + 2.4% tracking-in, mono kicker below), about every 20–25 s. *New module + font asset.*
5. **Caption restyle:** a quiet #090d11 chip with a 1.5 px #15191c border and soft shadow, 54 px ≈600–700 weight, white #fbfeff on grey #b0b4b9 karaoke, 1 blank frame between chunks. Drop the 3 px border, 8 px hard accent shadow and blue active word. *Tuning.*
6. **Palette discipline:** #090a0d flat bg plus a static 60 px grid; hue = domain (teal/amber/pink); 0–1 saturated hue per frame. We have a gradient bg and 2–3 hues. *Tuning + grid asset.*
7. **Chapter HUD:** borderless caps label, 10-segment progress (past #3c424a / current #91d2e8 / future #2a2e34), hairline at y 237, and a per-sub-state stage subheader. This replaces our LIVE/OK pill bar. *New module.*
8. **Mascot scale/placement:** 447×594 flush-left at y 783 (41% W, 1.7× ours). Add semantic head-glances on hero beats (433 ms, 21–27 px) and the 3.2 s blink loop; hide the mascot on full-bleed photo cards. *Tuning + new capability + asset.*
9. **Icon node tiles + Bézier links** (105² tiles, 39 px line icons, 3 px cubic S-curves drawn in 300 ms ease-in-out, mono edge labels). *New modules.*
10. **Persistent 5-card anchor row** (186×135 tilted photo cards, mono tags) that stays up to 28.8 s while sub-states swap below it, plus the 667 ms carousel push to re-skin it. *New module.*
11. **Negation/contrast treatments:** a 3 px strike drawn in 280 ms easeOutCubic, and NOT THIS / THIS sub-state pairs. *New module + storyboard rule.*
12. **Info-panel module family** (header band plus key/value rows at a 73.5 px pitch; variants: paragraph, steps, map, order rows, decision), re-skinned per clause. *New module.*
13. **Motion presets:** fade 66–133 ms, drop-in 50 px/220 ms easeOutCubic, stamp 1.2→1 + 3° in 133 ms, ring pulse 233 ms. No overshoot and no UI idle loops. Remove any scale punches. *Tuning.*
14. **Data modules without counters:** mono table with a tinted row and amber cell outline, timeline progress (400 ms ease-in-out + end-dot), data-cell grid split (467 ms expo-out), typewriter at 73 chars/s word-locked. Replace our coloured big % counters with these where the sentence is about data. *New modules.*
15. **Loudness and bed:** match −14.1 LUFS / TP −1.0 (ours −17.1 / −3.2) with a low bed ≈12–14 dB under the VO; also photo-card scene establishing (full-width desaturated photo, mascot hidden) for "Imagine a …" sentences. *Tuning + asset.*
