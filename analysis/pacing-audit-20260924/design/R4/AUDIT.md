# R4 design audit — `R4_DdT5wzdsQWV` (file-upload system explainer, LIGHT theme)

Source: `C:/Users/debna/Downloads/igexport-DdT5wzdsQWV.mp4`. **Measured source container: 720x1280, H.264 High yuv420p, 30/1 fps, video 253 kb/s, HE-AAC 55 kb/s, 169.79 s.**
The reel is NOT native 1080x1920: every pixel value below was measured on 720x1280 decoded frames and
**multiplied by 1.5** to give the requested 1080x1920 value (quoted as `1080-px`; raw 720 value in brackets where useful).
Measurement error: ±1 raw px => ±1.5 px at 1080. Colours are decoded yuv420p (4:2:0 chroma + 253 kb/s ⇒ ±3-5 per channel on flats, worse on thin strokes).
Times: 30 fps, 1 frame = 33.3 ms. Scratch: frames `f_*.png`, `cm_*.png`, strips `R4_DdT5wzdsQWV_strip_*.jpg`, measurement scripts `m_*.py` in this folder.

## A. Frame architecture & layout

All frames sampled (37 `f_*.png`, 0-169 s) share the same fixed skeleton — every band below is **identical to ±1 raw px across all 37 frames** (band scan over rows, `m_util.py`).

### 1. Safe zones (1080-px, measured on f_049.50 and confirmed on all 37 frames)
| zone | y (1080-px) | % H | x (1080-px) | notes |
|---|---|---|---|---|
| top clear (bg + dot grid only) | 0-223 | 0-11.6% | — | nothing ever drawn here |
| header row (kicker + stepper) | 224-260 | 11.7-13.5% | 70-1010 | |
| title (1 line / 2 lines) | cap-top 301 → baseline 353 / 2nd baseline 429 | 15.7-18.4% / -22.3% | 70-~1000 | |
| subtitle slot (fixed y, not reflowed) | 471-497 | 24.5-25.9% | 75-… | same y whether title is 1 or 2 lines |
| content region | 549-1265 (max envelope 366-843 raw) | 28.6-65.9% | 320-1010 (shadows/tiles overhang to 1044) | |
| mascot | 612-1343 | 31.9-69.9% | 66-276 | fixed, never moves |
| footnote (dash + line) | dash 1299-1304, text 1326-1350 | 67.7-70.3% | 320-… | |
| caption pill | 1452-1551 (centre 1498) | 75.6-80.8% (centre 78.0%) | hug-width, centred on x=540 | |
| footer rule | 1650-1652 | 85.9% | 70-1008 | |
| footer text | 1672-1691 | 87.1-88.1% | 70-… | |
| bottom clear | 1692-1920 | 88.1-100% (228 px) | — | nothing drawn |
Side margins: **70 px left and right** (47 raw each, symmetric). Machine margins (225 top / 232 bottom) agree.

### 2. Grid / columns
- Two-column body: **mascot column x 66-276 (211 px, 19.5% W)**, **gutter 44 px**, **content column x 320-1010 (690 px, 63.9% W)**. Content right edge = right margin (70 px).
- Full-width rows (header, title, subtitle, footer) run 70-1010 and ignore the mascot column. Caption is centred on the **frame** axis x=540, not on the content column (content centre = 665).
- Content column internal axes (4-node diagram, f_049.50): node columns x 320-594 and 716-1004 (node 274-288 px wide, 122 px gap); node rows y 570-784 and 1031-1239 (row gap ~247 px). Window-internal left inset = 28 px (text at x 348 in a window at x 320).
- Footnote left-aligns to the content column (x 320), not the margin.

### 3. Content bounding box per scaffold (1080-px, from band scan)
| scaffold (t) | content bbox (x0-x1, y0-y1) | % frame area | vertical centre |
|---|---|---|---|
| single window (1.5) | 320-1010, 560-1182 | 20.7% | 871 (45.4%) |
| 2 stacked windows (10.0) | 320-1010, 560-1220 | 22.0% | 890 (46.4%) |
| 3-node diagram (14.8) | 320-1007, 570-1239 | 22.2% | 904 (47.1%) |
| key/value window (19.8, 40.9) | 320-1010, 549-1272 | 24.1% | 910 (47.4%) |
| display text + icons (33.5) | 324-1007, 564-1152 | 19.4% | 858 (44.7%) |
| 4-node diagram (49.5 …) | 320-1007, 570-1254 | 22.7% | 912 (47.5%) |
| display text + 4 red rows (65.5) | 320-1010, 564-1200 | 21.2% | 882 (45.9%) |
| chunk grid (114.0) | 320-1010, 549-1262 | 23.7% | 905 (47.1%) |
| CDN tree (144.0) | 320-1010, 555-1197 | 21.4% | 876 (45.6%) |
| end pills + logos (169.0) | 320-1010, 549-1089 | 18.0% | 819 (42.7%) |
Content always **top-anchored at y≈549-570** and grows downward; centre of mass 43-48% of H. Content never exceeds 24% of frame area — lots of air.

### 4. Scaffold layout templates (1080-px geometry)
Every template = fixed chrome (header, title, subtitle, mascot, footnote, caption, footer) + one content slot 690×~700 at (320, 549).
| id | template | geometry | used at (s) |
|---|---|---|---|
| T1 | **Single window card** | window 690 w (x 320-1010) × 620-720 h, top y 549-560; body inset 28 px | 0-4, 15-29, 37-45, 69-87, 100-121 (18 scaffolds) |
| T2 | **Two stacked windows + vertical connector** | top win 320-1010 × y 560-920; bottom win y 1050-1218; connector x 665 | 4.1-11.4, 34.1-37.2 |
| T3 | **4-node 2×2 diagram** | nodes 274-288 w × 214 h (top row y 570-784, bottom 1031-1239); cols x 320 / 716; orthogonal connectors in the 247-px row gap and 122-px col gap | 45-50, 66-69, 87-100, 121-137, 145-162 (11 scaffolds) |
| T4 | **3-node diagram** | 2 small nodes top (as T3) + 1 wide node bottom-right (x 380-1007, y 1005-1239) | 11.4-15.1, 50.7-60.3 (variant with display "5 GB" in bottom-left slot) |
| T5 | **Display text + stack** | display word(s) cap 75-78 px at y 564 (content top); then 3 staggered MP4 tiles or 4 full-width red rows (row h 97 px, pitch 126 px) | 29.1-34.1, 60.3-66.7 |
| T6 | **Tree (1 origin → 3 leaves)** | origin window x 535-833, y 555-757 (centred on content axis x≈684); 3 leaf windows ~189 w at x 320 / 570 / 820, y 905-1068 (62-px gaps); bus connector y≈832; note box full width y 1130-1197 | 137.6-145.5 |
| T7 | **End card: 2 statement boxes + logo equation** | 2 content-width boxes 690×125 at y 549-674 and 704-827 (30-px gap); logos ~100-110 px square at x 396-497 and 828-938, "+" between, y 888-999; grey tagline y 1060-1089 centred | 162.7-169.7 |

### 5. Visual hierarchy (cap heights, 1080-px)
| tier | element | cap height | ≈font size | ratio to body |
|---|---|---|---|---|
| 0 | display word/number ("Big bytes.", "5 GB", "20 GB", "API load ↑") | 75-78 | ~105 px | 3.6× |
| 1 | scaffold title | 52.5 | ~72 px | 2.5× |
| 2 | caption text | ascender 37.5 | ~50 px | — (separate band) |
| 3 | node/window heading ("My files", "Upload API") | 24 | ~33 px | 1.14× |
| 3b | check-row text ("Authenticated?") | 21 | ~29 px | 1.0× |
| 4 | subtitle, body, outline-box text | 19.5-21 | ~27-29 px | 1.0× (body) |
| 5 | chip text ("Access control") | 16.5 | ~23 px bold | 0.8× |
| 6 | kicker (mono, caps), edge labels, chrome labels | 15-16.5 | ~21-23 px | 0.75× |
| 7 | footer (mono caps, tracked) | 18 (x-h) | ~21 px | 0.72× |
Read order: title → display word (when present) → node headings/active connector (colour) → caption.

### 6. Spacing rhythm (1080-px)
- Header→title cap: 41 px; title baseline→subtitle cap: 118 px (1-line) / 42 px (2-line); subtitle→content top: 52-73 px.
- Content bottom→footnote dash: ≥45 px; footnote text→caption pill top: 102 px; caption bottom→footer rule: 99 px.
- Window: title bar 48 px (incl. 1.5-px divider); body inset 28 px left/right, 27-35 px top.
- Table rows: **pitch 60 px**, 1.5-px divider #E5E3DF; check rows: **pitch 78 px**; red cost rows: pitch 126 px (97-px box + 29 gap); chunk grid: **141 px column pitch / 128 px row pitch, 30-px gaps**; MP4 tile trio: 225-px x-pitch, 45-px y-step (diagonal).
- Very consistent: every repeated list uses one fixed pitch within a scaffold.

## B. Persistent chrome

### 7. HUD / status bar
**R4 has no HUD bar.** The persistent top chrome is a *kicker row*: left `SYSTEM DESIGN / FILE SERVICES` (mono, caps, x 70, cap-top 230, cap 16.5 px ≈ 23 px font, letter-spacing ≈ +0.08 em, ink ≈ #3A4446 [AA-measured #535A5B]) and right a **3-step stepper** (see 8). Values never change except the stepper. Band y 224-260.

### 8. Chapter / progress / step indicators, footers
| element | anatomy (1080-px) | update behaviour (measured) |
|---|---|---|
| Stepper (top-right) | 3 circles Ø 37 px, centres x 898 / 945 / 991 (pitch 46.5), y 241; inactive = 1.5-px outline #9FA4A3 on bg + grey mono digit (#5D6169); active = solid fill #142733 (navy) + white digit | **hard switch on the scaffold-cut frame** (dot1 at 11.367, dot2 at 34.067, dot3 at 66.683; 0 frames of tween). Only ONE dot active at a time (previous dot returns to outline). Stays set across the following scaffolds until the next "Version N". |
| Footer rule | 1.5-3 px line #CCD2D4, x 70-1008, y 1650 | static |
| Footer text | `RICK'S BACKEND LAB   /   NN`, mono caps, ≈ 21 px, tracking ≈ +0.15 em, ink #6E706F (AA) ; counter at x 405 | counter = scaffold index 01-33, **hard switch** on the cut frame |
| Footnote (per scaffold) | blue dash 64.5 × 4.5 px #206AC2 at (320, 1299) + one bold line ≈ 27 px #151B1E at y 1326 ("Follow one file. Improve its route.", "The API still relays the whole file.") | **hard swap** on cut frame (0→100% in 1 frame, measured 4.13, 11.37, 45.47) |
| Subtitle | regular ≈ 29 px #474C4D at (75, 471) | hard swap on cut frame |

### 9. Mascot
| property | measured |
|---|---|
| asset | full-body cartoon (Rick-style) with laptop; flat cel art, dark outline |
| bbox | x 66-276, y 612-1343 (211 × 732 px; 19.5% W, 38.1% H) — **identical bbox in all 37 frames and in every frame 5.0-9.0 s** |
| poses | 1 pose for the entire 169.7 s (no pose swaps, no gestures) |
| blink | **34 blinks, each exactly 6 frames (200 ms) closed, hard sprite swap** (no tween). Onsets 1.3, 5.7, 9.2, 14.6 … 166.8 s; interval min 3.5 s, median 5.3 s, mean 5.02 s, max 5.7 s (free-running timer, not narration) |
| mouth | static open grin; mouth-region luminance std 0.35 over 5090 frames ⇒ **no lip-sync** |
| idle motion | **sub-pixel sway, period 3.6 s**: head dx −0.30…+0.86 raw (≈ 1.7 px p-p at 1080), dy ≤ 0.2 raw; torso dy 0…+0.25 raw (≈ 0.4 px) phase-lagged ~1 s; feet 0.00 ⇒ pivot at feet (rotation ≈ 0.16° p-p). Imperceptible individually but keeps the sprite "alive" |
| scale punches / entrances / exits | none (present from frame 0 to end, never hidden) |
| overlap rule | never overlaps content: mascot right edge 276 < content left 320 (44-px gutter); mascot bottom 1343 sits between footnote and caption |

### 10. Captions
| property | measured (1080-px) |
|---|---|
| box | ivory pill **#FEFCF8** fill, **1.5-px border #C5C7C2**, radius 12 px, soft bottom shadow ≈ 7.5 px deep #DDE3E9 (no x-offset, blurred) |
| geometry | y 1452-1545 (height 94.5), centre y 1498 (78.0%); width hugs text (e.g. 531 px "upload service like", 679 px "binary data much better."); centred on x 540; padding 33-35 px horizontal, 25 px top |
| font | heavy grotesk (≈ weight 800), ascender 37.5 px ⇒ ≈ 50 px font; word gap 19.5 px; tight tracking |
| colours | **3-state karaoke**: spoken = #13232D (near-black), **active = #1D5EBD blue**, upcoming = #425058 (slate) |
| words / chunk | 2-4 (mostly 3); swaps measured at 1.000, 2.100, 3.433, 4.133, 4.967, 5.767, 6.600, 7.733, 8.667, 9.867, 10.767, 11.35 s ⇒ chunk life 0.83-1.33 s (median 0.93) |
| swap mechanics | exit 1 frame (pill shrinks to ≈ 87% width + fades) → **1 empty frame** → enter: pill at 98.5% width, 101.5% next frame, 100% by +3 frames (≈ 100 ms scale-pop with ~1.5% overshoot). Total gap 67 ms |
| highlight timing | hard 1-frame switch; lag vs ASR word onset −0.06…+0.28 s (median ≈ +0.07 s) |
| first appearance | 0.233 s |

## C. Visual design system

### 11. Palette (LIGHT theme — measured hex; AA = anti-aliased stroke sample, true ink is darker/more saturated)
| token | hex | where measured |
|---|---|---|
| `bg` | **#F4F4ED** (flat, identical in all corners and all 37 frames) | corners f_049.50, f_001.50, f_160.00 |
| `bg-dot` | #E7E7E0 dots, 3 px, **38-px square pitch**, first dot at (19,19); static | rows/cols 12, 37.5, 63 … raw |
| `surface-1` (window body, caption pill, note boxes) | **#FEFCF8** (ivory) | f_049.50 y 470 |
| `surface-2` (window title bar) | **#E6EDE9** | f_049.50 x 300 y 381-411 raw |
| `border` (cards, pill, outline boxes) | #BCC3C2 – #C6CBC7 (1.5 px) | |
| `divider` | title-bar #B9BEBD; table rows #E5E3DF; check rows #DFE1DC | |
| `shadow` (card) | #E3E8E2, ~9 px downward, ~6 px blur, no x offset | y 524-531 raw under windows |
| `ink-1` title | #18252D (≈ #17232B) | |
| `ink-2` node heading / check text | #22272A / #313F44 | |
| `ink-3` body / subtitle | #474C4D | |
| `ink-4` muted (demo.mp4, notes) | #626667 – #656663 | |
| `ink-mono-chrome` | #6E7476 (chrome labels), traffic dots #8F989D | |
| `blue` (bytes / data path, primary accent) | **#1766DA** display, #1662D5 connector, #1666DC tiles, caption-active #1D5EBD | |
| `blue-tint` / lines | #E5EEF9 (chip), #E6EEF8 (chunk fill), #5F85A3 (chunk border), ghost #D0D6DC, bar track #DAE0E4 | |
| `purple` (metadata / keys / permissions) | **#6D4EA5** connector, packet #6F51B0, mono keys ≈ #594A73 (AA), tint #EAE6F2, ghost #D7D4D8 | |
| `green` (control plane / success) | **#187A5B** connector, check disc #12805C, chip tint **#DDF2E7**, chip text ≈ #17503A, success chunk #DDF1E3 / #2E644F | |
| `red/brick` (cost / failure) | **#B14B30** display, bar #B64A2E, failed-chunk fill #FAE4DA, outline-box text ≈ #8E3B26 | |
| `navy` (stepper active) | #142733 | |
| `mp4` tile | #1666DC fill, #134DAC 3-px inner rim, hard offset shadow #B8CCE8 | |

Hues at once: 1-3 (machine: median 2, max 3; 47% of frames 1 hue, 50% 2 hues, 3% 3 hues). One accent per semantic role; never rainbow.

### 12. Typography
| role | family (visual ID; exact face not assessable at 253 kb/s) | size (1080-px, from cap/asc heights) | weight | case / tracking | colour |
|---|---|---|---|---|---|
| display word/number | heavy geometric grotesk (same as title; straight-tailed "y") | cap 75-78 ⇒ ~105 px | 800 | sentence, ≈ −0.03 em | blue / brick |
| title | same | cap 52.5 ⇒ ~72 px; 2-line leading 76.5 px (1.06) | 800 | sentence, ≈ −0.02 em | #18252D |
| caption | same | ~50 px | 800 | sentence | 3-state |
| node heading | Inter-like sans | cap 24 ⇒ ~33 px | 700 | | #22272A |
| check / list row | Inter-like | cap 21 ⇒ ~29 px | 600 | | #313F44 |
| subtitle / body / box text | Inter-like | cap 19.5-21 ⇒ ~27-29 px | 400 | | #474C4D |
| chip | Inter-like | cap 16.5 ⇒ ~23 px | 700 | sentence or CAPS | role-dark |
| kicker, footer | mono (IBM-Plex-Mono-like) | cap 16.5 ⇒ ~22 px | 400-500 | CAPS, +0.08…+0.15 em | #3A4446 / #6E706F |
| chrome label (window title) | mono | cap 15 ⇒ ~21 px | 400 | lower, path-like | #6E7476 |
| table keys / values, code, JSON, URLs | mono | x+asc 19.5 ⇒ ~24-26 px | 400 | | keys purple, values #333635 |

Text per frame: title (2-5 words) + subtitle (4-7) + 3-12 short labels + footnote (5-7) + caption (3) ⇒ ≈ 25-45 words visible.

### 13. Card / panel anatomy — "window card"
| part | measured (1080-px) |
|---|---|
| outer | radius **16 px**; 1.5-px border #BCC3C2; fill #FEFCF8; soft shadow 9 px down #E3E8E2 |
| title bar | **48 px tall** incl. 1.5-px divider #B9BEBD; fill #E6EDE9; 3 traffic dots **Ø 10.5 px, pitch 19 px, #8F989D, first at x+18**; mono label at x+84, ≈ 21 px |
| body | inset 28 px L/R; headings 33 px bold; muted sub-line 24 px |
| sizes | full-content 690 w; diagram node 274-288 × 214; leaf node 189 × 163; tree origin 298 × 202 |
| variants | plain (Upload a file + dashed drop zone), key/value table (60-px rows), code/SQL/JSON (mono lines ~40-px pitch), checklist (78-px rows), chip-header ticket, stacked pair, bucket card (logo tile + name + chip), progress card, chunk-grid card |
| inner outline box ("note" / "warning") | radius 9 px, 1.5-px border #CACCC7, same fill as card, height 67.5 px, text 27 px; red variant = brick text only (border stays grey) |

### 14. Pills / badges / chips / tags
| type | measured |
|---|---|
| chip (Access control, HTTPS, POST /uploads, PRE-SIGNED URL, Block public access: ON, Cached ✓, Complete ✓, metadata, file bytes) | **height 40-43 px, radius 9 px**, tinted fill (mint #DDF2E7 / lilac #EAE6F2 / pale blue #E5EEF9), **no border**, bold ≈ 23 px text in dark role colour; padding ≈ 15 px; gap between chips 13 px |
| check disc | Ø 36 px solid #12805C + white tick |
| stepper circle | Ø 37 px (see 8) |
| statement box (end card) | 690 × 125, radius 16, 1.5-px grey border, heavy ~44-px coloured text (green "API = who + what", blue "S3 = the bytes") |
| caption pill | see 10 |

No dot-indicator pills, no outline-only pills; the only capsule-like shape is the caption (radius 12 on 94 h ⇒ rounded rect).

### 15. Iconography & imagery
- **Product logos (filled, full colour)**: Google Drive tri-colour (~90 px), Postgres elephant (~66 px in node, ~100 px end card), AWS S3 green tile with bucket glyph (~66 px node, 110 px end card).
- **MP4 file tile**: 126 × 150 px, radius ≈ 10 px, #1666DC, white ▶ + "MP4" + "demo.mp4", 3-px darker rim, **hard 6-px offset shadow #B8CCE8** (down-right) — the only hard-offset shadow in the video.
- **Packet glyph**: 39 × 46 px portrait doc tile, radius ≈ 5 px, role-colour fill, 3 white lines (19.5 / 19.5 / 12 px long, 3 px thick, 9-px pitch, left inset 9 px).
- Check disc, "↑" inside display text, "→" inside text. No line icons, photos, maps or avatars besides the mascot.

### 16. Lines / connectors / arrows
| property | measured |
|---|---|
| geometry | **orthogonal polylines, sharp 90° corners**, no curves, **no arrowheads** |
| active stroke | ≈ 3 raw ⇒ **4.5 px** solid, role colour (blue #1662D5, purple #6D4EA5, green #187A5B) |
| ghost (inactive) stroke | **3 px**, pale tint of the role colour (blue #D0D6DC, purple #D7D4D8, grey-blue #CDD2DD); drawn from the scaffold's first frame, active stroke is later drawn **over** it |
| edge labels | bold ≈ 21 px sans, dark #252927 ("bytes", "POST", "URL", "done", "file ID", "GET URL") or role-coloured ("metadata", "check permissions", "status = ready", "PUT · file bytes", "HEAD / completion check ✓"); placed at segment midpoint / elbow; the stroke **breaks around** a label that sits on the line (47.97 s strip) |
| endpoints | lines butt into card edges; no ports, no dots |

### 17. Charts / numbers / tables
- No charts or axes. Big numbers are display text ("5 GB", "20 GB", cap 78 px, blue).
- **Progress bar**: 637 × 27 px (x 346-983, 20 GB scene), fully rounded, track #DAE0E4, fill #1466DA; node mini-bar 220 × 14 px.
- **Cost rows**: 690 × 97 px outline box, brick text 27 px + brick bar 650 × 13 px along the bottom (appears at full width, no fill tween).
- **Key/value table**: 60-px row pitch, key left (mono purple), value right-aligned (mono dark), 1.5-px dividers #E5E3DF.
- **Chunk grid**: 4 × 3 tiles 111 × 99 px, column pitch 141, row pitch 128, radius 9, fill #E6EEF8, 1.5-px border #5F85A3, mono 2-digit blue label.

### 18. Data realism
Concrete and internally consistent: `demo.mp4`, `52428800 bytes` (= 50 MiB, matches the "50 MiB" rows), `video/mp4`, `owner_id 42` / `user_id = 42`, `f_1042`, object key `u42/f_1042` reused across 6+ scaffolds, `uploads-bucket`, `expiresIn 300 seconds`, `https://…s3.amazonaws.com/u42/f_1042?X-Amz-Expires=300&X-Amz-Signature=…`, `api.example.com`, a full `SELECT … WHERE owner_id = 42 ORDER BY created_at DESC;`, `INSERT INTO files (name, file_bytes) VALUES (…)`, `CompleteMultipartUpload`, `created_at 2026-09-15T…`, `archive.mov`, `notes.pdf 240 KiB`. Every ID recurs identically when the entity reappears.

### 19. Background
Flat #F4F4ED + static 3-px dot grid #E7E7E0 at 38-px pitch. No gradient, vignette or noise; never animates; never changes between scaffolds.

## D. Module catalog (item 20)

All sizes 1080-px. "Reuse" = scaffolds (by start time) in which the module appears.

| id | module | anatomy / size | variants | data carried | reuse |
|---|---|---|---|---|---|
| M1 | **Kicker + stepper header** | mono caps kicker (x 70, y 230) + 3 stepper circles Ø 37 (x 898/945/991, y 241) | stepper state 0-3 | series/topic, current version | persistent |
| M2 | **Title + subtitle block** | title 72 px/800 at y 301 (1-2 lines, leading 76.5) + subtitle 29 px/400 at fixed y 471 | 1-line / 2-line | scaffold headline + one-line gloss | every scaffold (33) |
| M3 | **Footnote** | blue dash 64.5 × 4.5 #206AC2 at (320,1299) + bold 27 px line at y 1326 | — | one takeaway sentence | every scaffold |
| M4 | **Footer** | 1.5-3-px rule y 1650 (x 70-1008) + mono caps brand + "/ NN" counter | — | brand, scaffold index | persistent |
| M5 | **Caption pill** | ivory rounded rect h 94.5, r 12, 1.5-px border, soft shadow; 50-px/800 text, 3-state colours | width hugs 2-4 words | narration | persistent |
| M6 | **Mascot** | 211 × 732 sprite at (66,612) | open / blink sprites | — | persistent |
| M7 | **Window card** (base) | r 16, border 1.5 #BCC3C2, 48-px title bar #E6EDE9 with 3 dots + mono path label, body #FEFCF8, soft 9-px shadow | full (690 w) / node (274-288 × 214) / leaf (189 × 163) / origin (298 × 202) | the "place" (Browser, api.example.com, PostgreSQL, AWS · S3, Origin, EU/US/APAC edge) via the mono label | all 33 scaffolds |
| M8 | **Diagram node** = M7 small + heading 33 px + muted sub-line 24 px + optional chip / mini progress bar / logo tile 66 px | My files (bar), Upload API (chip "Access control"), Metadata (elephant, "file_id · owner · key"), Amazon S3 (S3 tile, "u42/f_1042") | entity name, role, key ID | 45.5, 50.7, 66.7, 87-100, 121-137, 145-162 (11 scaffolds, identical positions) |
| M9 | **Orthogonal connector** | 3-px ghost (pale role tint) + 4.5-px active overlay drawn with dash-offset; sharp elbows; optional label 21 px bold (dark or role colour) that breaks the line | blue / purple / green; straight / 1-elbow / 2-elbow / bus-tree | which flow (bytes, metadata, control) | every diagram scaffold; redrawn fresh each reuse |
| M10 | **Packet** | 39 × 46 doc tile, role colour, 3 white lines | blue / purple / green | "a request / object is moving" | on every drawn connector |
| M11 | **Chip** | h 40-43, r 9, tinted fill, no border, bold 23 px | mint / lilac / pale-blue; with ✓ | status, protocol, property | ~14 scaffolds |
| M12 | **Key/value table** | 60-px rows: mono purple key left, mono value right, 1.5-px divider #E5E3DF | 4-row (metadata), 9-row (files table), 3-row (S3 object, ticket) | field → value | 17.1, 37.2, 42.6, 78.7, 82.4 |
| M13 | **Checklist rows** | Ø 36 green disc + 29 px/600 text, 78-px pitch, dividers | 2-row (Validate), 4-row (Check before signing) | conditions | 15.1, 72.4 |
| M14 | **Code / JSON / SQL block** | mono 26 px, 40-px line pitch, no background change, optional leading chip (HTTPS, POST /uploads) or logo+heading | SQL insert, SQL select + result rows, JSON body, Cookie header | literal payload | 15.1, 20.0, 26.2, 69.3 |
| M15 | **Outline note box** | 67.5 h, r 9, 1.5-px grey border, 27-px text | neutral (Browser → API → storage, Small JSON request, Cache hit → nearest edge → user, Retry part 07 → …, Upload parts in parallel…) / brick-text warning (Large bytes grow the database, Connection interrupted, Then 5 GB out to S3, More storage I/O …) | a one-line claim | ~12 scaffolds |
| M16 | **In-card grey note** | 24-27 px #626667 plain text below a box | — | caveat ("The video stays in the browser.", "Whole-file retry throws away progress.") | ~6 scaffolds |
| M17 | **Display word / number** | cap 75-78 (~105 px/800), blue or brick, left-aligned at content x 324, y 564 | "Big bytes.", "5 GB", "API load ↑", "20 GB" (inside a card) | the tension number/word | 29.1, 50.7, 60.3, 100.7 |
| M18 | **MP4 file tile** | 126 × 150, #1666DC, ▶ + MP4 + filename, hard 6-px offset shadow | single / diagonal trio (225-px x-pitch, 45-px y-step) / shrinks into packet | "the file" | 0.5, 4.6, 19.6, 29.6-30.9, 43.2 |
| M19 | **Progress bar** | full 637 × 27 / mini 220 × 14, rounded, track #DAE0E4, fill blue | static / filling / looping | % uploaded | 11.4, 45.5+, 100.7 |
| M20 | **Cost row** | M15 box 97 h + brick bar 650 × 13 inside bottom | ×4 stacked, 126 pitch | cost dimension | 60.3 |
| M21 | **Chunk grid** | 4 × 3 tiles 111 × 99, r 9, pale blue, mono number; header "One file. Independent parts." + "50 MiB per part · example" | normal / failed (brick) / recovered (green) / collapsing | part numbers, failure | 107.5, 115.1 |
| M22 | **Result card** | small centred card (~250 × 280) with S3 tile, "One object", green chip "Complete ✓" | — | outcome | 119.6 (morph target) |
| M23 | **Fan-out tree** | origin card + 3 leaf cards + bus connector (1 trunk, 3 drops), green "Cached ✓" chips in leaves | — | CDN topology | 137.6 |
| M24 | **Statement box** | 690 × 125, r 16, grey border, ~44-px coloured heavy text "X = Y" | green / blue | the thesis | 162.7 |
| M25 | **Logo equation** | logo + "+" + logo, ~100-110 px, centred row | — | the two systems | 164.7 |
| M26 | **Signed-URL text** | 2 lines of mono 21 px, purple-ish, under the table | — | literal URL | 78.7, 82.4 |
| M27 | **Drop zone** | dashed rect inside card: 1.5-px #BDBDB8, **6-px dash / 4-px gap**, r 9, label "Drop file here" | — | UI affordance | 4.1 |

**Combination rules observed**: one M7 family per scaffold (either one full card, a 2-stack, or a node diagram); at most one display word; at most one M15 box + one M16 note below the main module; chips live only inside cards; packets only on connectors; M17 display text replaces the card (T5) rather than sitting beside it, except the "5 GB" variant which sits in the empty 4th node slot.

## E. Motion system (items 21-27) — measured frame-by-frame

Method: `m_trans2.py` / `m_appear.py` decode every frame (720×1280) and, per element region, compute opacity = mean|px−bg| on the element's final-ink mask ÷ final value, and vertical offset by sub-pixel row cross-correlation against the settled frame (raw px; ×1.5 for 1080). `m_path.py` measures connector reveal length along the polyline; `m_packet.py` tracks packet centroids. Strips `R4_DdT5wzdsQWV_strip_047.930.jpg`, `_138.300.jpg`, `_119.500.jpg` in this folder.

### 21. Entrance recipes (per element class)
| class | event(s) measured | opacity per frame (first visible → settled) | travel (1080-px) | duration | easing | stagger |
|---|---|---|---|---|---|---|
| **Scaffold title** | 4.13, 11.37, 45.47, 137.63 | 0.18 · 0.35 · 0.53 · 0.75 · 0.87 · 0.93 · 1.00 | rise **~10 px** (dy 7.8 → 6.0 → 4.1 → 2.0 → 1.1 → 1.1 → 0) | **233 ms** (7 f) | opacity ~linear, position ease-out (quad) | starts on the cut frame |
| **Scaffold content group** (all cards/nodes/connector ghosts together) | same 4 cuts; per-node regions at 45.47 & 137.63 | 0.07 · 0.14 · 0.22 · 0.36 · 0.64 · 0.88 · 0.93 · 0.98 | rise **~10 px** (6.7 raw at 24%) | **300 ms** (9 f) | ease-in-out opacity, ease-out position | **+33-67 ms after title**; nodes within ≤ 1 frame of each other (no per-node stagger) |
| subtitle, footnote, stepper, footer counter | same cuts | 0 → 1.00 in **1 frame** | none | 0 ms | hard swap | on cut frame |
| **Table row** (metadata record) | 37.967 … 41.167 (9 rows) | 0.13 · 0.27 · 0.71 · 1.00 | rise **~6 px**, ≤ 1-px overshoot | **133 ms** (4 f) | ease-in-out (S) | **exactly 400 ms** (12 f) |
| **Check row** | 72.567, 73.967, 75.467, 76.767, note 77.5 | 0.05 · 0.27 · 0.55 · 0.93 · 1.0 | rise **~9 px**, ~1-px overshoot held 2-3 f | 133-167 ms | ease-out + tiny back | 1.30-1.50 s (sentence-anchored) |
| **Cost row** (box + bar together) | 61.033, 62.133, 63.233, 64.333 | 0.08 · 0.33 · 0.63 · 0.97 | rise **~8 px** | 133 ms | ease-out | **exactly 1.100 s** |
| **Chunk tile pop** | 108.167 … 110.800 (12) | 0.14 · 0.29 · 0.61 · 0.99 | rise **≥ 10 px (≈ 14)** (dy 9.8 → 5.2 → 1.9 → 0 → −1.0 → −1.0 → 0) | 133 ms opacity; position settles 267 ms | **back-out** (≈ 7% overshoot) | 233-267 ms (mean **239 ms**) |
| **MP4 tile / logo pop** | 30.233, 164.733 (both logos + "+") | 0.27 · 0.59 · 0.83 · 0.99 | rise **~14 px** (dy 10.6 → 5.9 → 2.5 → 0.3 → −0.8 → 0) | 133 ms (+100 ms settle) | ease-out with ~1-px back | trio 29.567 / 30.233 / 30.867 (≈ 650 ms, word-free) |
| **Outline box / strip / tagline** | 31.70, 167.23 | 0.17 · 0.32 · 0.76 · 0.96 | ~8 px | 133 ms | ease-out | — |
| **Connector draw** | 6.667 (128 px), 13.367 (428 px), 46.967 (586 px), 47.963 (245 px, label gap), 138.367 (CDN branch) | reveal lengths per frame at 13.367: +27 · 46 · 40 · 34 · 30 · 26 · 22 · 18 · 14 · 10 · 8 · 6 · 4 raw | path length | **300-433 ms** (9-13 f), nearly length-independent | **quad-out** (per-frame speed falls linearly) | CDN branches 138.37 / 139.10 / 139.25 |
| **Packet spawn** | 13.667, 48.263, 93.167, 154.6 | full opacity on first frame (no fade), at path start | — | 0 ms | hard appear | spawns 0-100 ms before the draw finishes |
| **Caption chunk** | 1.033, 2.133, 4.167 … | width 98.5% → 101.5% → 100% | scale pop | 100 ms (3 f) | back-out (~1.5%) | after 1 empty frame |
| **Result card** (merge target) | 120.10-120.23 | 4 frames | slight scale-up | 133 ms | ease-out | after chunks collapse |

### 22. State-change recipes
| change | event | measured |
|---|---|---|
| ghost → active connector | 6.667 (upload→backend), all draws | active 4.5-px stroke **drawn over** the 3-px ghost by dash-offset reveal (not a colour tween); 300-433 ms quad-out |
| failed part appears | chunk 07 at 117.167-117.333 | 5-frame fade-in directly in brick state (fill #FAE4DA, border brick, digits dark brick) + ~3-px dip-and-return nudge |
| red → green recolour | chunk 07, 117.700-117.867 | **5-6 frames (167 ms), linear RGB lerp** (mid-frame fill #EEEAE1, border #63594E — muddy grey midpoint) → fill #DDF1E3, border #2E644F, digits #06311A |
| progress fill | 20 GB bar, 101.200-102.233 | stub 12 raw at scene entry, hold 0.43 s, then **linear 20 px/frame (600 px/s)** for 31 frames to 97% (≈ "99%"), hard stop, no ease |
| node mini-bar | My-files bar, every diagram scaffold | continuous slow fill that resets with the packet loop (e.g. 93.5-94.6: +1-1.5 raw / 2 f) |
| stepper / counter / footnote / subtitle | every cut | hard 1-frame swap |
| caption word highlight | every word | hard 1-frame swap; lag vs ASR onset −0.06…+0.28 s (median ≈ +0.07) |
| text swaps inside a card | — | not observed: cards are never edited in place; a new scaffold is cut in instead |
| strike / tick animation | — | not observed (ticks are static inside discs that pop in) |

### 23. Emphasis recipes
No highlight rings, pulses, glows, stamps, flashes or scale punches anywhere (all 57 sheets + every strip). The only emphasis devices are (a) **colour** (brick for cost/failure, green for success), (b) **display-size type** (M17), (c) the **failed-chunk nudge** (≈ 3 px dip-and-return over 5 frames, 117.2 s), (d) the ~1-px back-out overshoot on pops.

### 24. Exit and scene-transition recipes
| measured at | behaviour |
|---|---|
| 4.130 → 4.163 (and 11.37, 45.47, 137.63) | **outgoing scaffold content: hard cut** (presence 1.00 → 0.00 in one frame). No crossfade, no push, no zoom. |
| same | incoming: subtitle/footnote/stepper/counter hard-swap; title fades+rises 233 ms; content group fades+rises 300 ms starting 1-2 frames later |
| persistent across every cut | bg + dot grid, kicker, stepper (until changed), mascot, caption (continues mid-chunk), footer rule/brand |
| element exits | none, except the in-scaffold **chunk merge** (119.567-120.30 s): rows collapse toward the grid centre top row first (row stagger ≈ 200 ms, tiles within a row ≈ 1 frame apart), tiles scale ~1 → 0.5 and fade while drifting toward the grid centre (distance strip-estimated, ~60-120 px); result card fades/scales in over the last 4 frames. Total ≈ 730 ms. |
| file → packet morph | 6.633-7.60: MP4 tile translates 270 px down the connector while shrinking to 50% width, **sine-in-out** (per-frame dy 3 → 21 → 3 px), ≈ 1.0 s |

### 25. Process / ambient motion
| loop | measured |
|---|---|
| **packet travel** | constant speed (linear), sharp 90° turns at elbows with no slow-down; PUT path (748 px @1080) at **15.6 px/frame = 468 px/s**, period **1.600 s** (spawns at 154.600, 156.200, 157.800, 159.400, 161.000); API→Postgres (428 px) at 11.3 px/frame = 337 px/s, 1.27 s |
| loop rule | teleport back to start 1 frame after arrival; **loops only while a full cycle still fits before the next cut, then parks at the destination** (93.17 → 2 loops → parked 96.37-97.63; 13.67 → 1 trip → parked 14.93-15.13; 154.6 → 5 loops to 162.6) |
| one packet per connector | yes; multiple connectors run their own packets concurrently (up to 3 at 48-50 s) |
| packet vs label | packet passes **under** on-line labels (occluded, 155.37-155.73) |
| node progress bars | slow fill + reset in sync with the scaffold (45.6-50.6, 51.0-60.3) |
| mascot | blink every 3.5-5.7 s (200 ms), 3.6-s sub-pixel sway |
| stop condition | all ambient loops stop only at the cut |

### 26. Camera
**None.** All chrome bands are pixel-identical in 37 frames spanning 0-169 s (header 149-173 raw, footer 1115-1127 raw, mascot bbox 44/408-184/895 raw); no zoom, pan, shake, parallax, blur or depth-of-field. Scale change is achieved only with display-size type (M17).

### 27. Choreography (build order inside a scaffold)
1. Cut frame: chrome text swaps, title starts (0 ms).
2. +33-67 ms: whole content group fades/rises as one (done by ~330 ms).
3. +170-700 ms: first discrete beat (row / pop / draw), usually tied to the next content word (e.g. 45.47 cut → 45.70 bar; 11.37 cut → 12.0 bar; 107.53 → 108.17 chunk 01).
4. Lists run on a fixed timer (400 ms rows, 239 ms chunks, 1.1 s cost rows) — **front-loaded**: the 9-row table is complete at 41.27 while narration finishes the list at 42.46.
5. Connector draw → packet spawns before the draw ends → loops through the hold.
6. Holds (up to 8.3 s at 154.4-162.7) always have ≥ 1 live loop (packet / bar / blink); nothing else moves.

### Motion spec table (drop-in values for the generator, 30 fps)
| token | value |
|---|---|
| `cut.out` | 0 ms (hard) |
| `cut.title.in` | opacity 0→1 233 ms linear; y +10 px → 0, `power2.out` |
| `cut.content.in` | delay 50 ms; opacity 0→1 300 ms `sine.inOut`; y +10 px → 0 `power2.out`; whole group together |
| `cut.chrome` (subtitle, footnote, stepper, counter) | 0 ms swap |
| `pop.default` | opacity 0→1 133 ms; y +14 px → 0 over 200 ms `back.out(1.4)` (≈ 1 px overshoot) |
| `row.enter` | opacity 133 ms `sine.inOut`; y +6…9 px → 0 |
| `stagger.table` | 400 ms · `stagger.grid` 240 ms · `stagger.costRows` 1100 ms · checklists: sentence onset −0.2 s |
| `edge.draw` | dash-offset reveal over ghost; 300 ms (≤ 250 px) … 430 ms (≥ 400 px); `power2.out` |
| `packet` | spawn at 90% of draw; linear; speed 340-470 px/s (≈ 1.3-1.6 s per trip); loop period 1.6 s; loops = floor(remaining / period); then park at end |
| `recolor.status` | 167 ms linear RGB |
| `progress.fill` | linear 600 px/s, start 0.4 s after scaffold entry, stop at target |
| `morph.fileToPacket` | 1.0 s `sine.inOut`, scale 1 → 0.5 |
| `merge.collapse` | 730 ms total, row stagger 200 ms, tiles scale → 0.5 + fade, target card 133 ms fade/scale in |
| `caption.swap` | out 1 f (scale 0.87 + fade), gap 1 f, in 3 f scale 0.985 → 1.015 → 1 |
| `caption.highlight` | hard swap at word onset +70 ms |
| `mascot.blink` | 200 ms closed, interval 3.5-5.7 s (mean 5.0) |
| `mascot.sway` | 3.6 s period, ±1 px at head, pivot at feet |

## F. Timing & narration sync

### 28. Beat density
| metric | value | source |
|---|---|---|
| scaffold cuts | **32** (33 scaffolds) at 4.167, 11.367, 15.167, 17.100, 19.967, 26.200, 29.067, 34.067, 37.233, 42.667, 45.467, 50.667, 60.333, 66.667, 69.267, 72.400, 78.733, 82.433, 87.067, 90.433, 92.767, 97.633, 100.733, 107.533, 115.133, 121.300, 127.100, 134.200, 137.667, 145.533, 151.700, 162.733 | frame-exact footer-counter change (`cuts.npy`) |
| scaffold lifetime | min 1.93, p25 3.17, **median 5.00**, mean 5.14, max 11.03 s ⇒ **11.3 cuts/min** | |
| discrete beats | 144 (**50.9/min**), gap median 0.68 s, p90 2.67 s, max 8.3 s | visual log, re-checked against strips |
| beats per scaffold | median 3, max 15 (chunk grid) | |
| build vs hold | build (cut → last discrete beat + 0.3 s) median 2.80 s; hold median 2.07 s; **53% of runtime is build** | |
| holds | every hold > 1 s contains a live loop (packet / bar / blink) | 25 |

### 29. Word anchoring
| beat type | rule measured |
|---|---|
| scaffold cut | lands **+0.29 s (median) after the sentence onset** (≈ on the first content word); 19/32 within ±0.3 s, 31/32 within 0.6 s; one mid-sentence cut (17.10 on "metadata"@16.98, +0.12 s) |
| connector draw | on the flow's keyword, −0.10…+0.16 s (13.367 "user"@13.46; 46.967 "query"@47.08; 47.963 "S3"@47.80; 138.367 "files"@138.48; 131.5 "downloads"@131.78) |
| progress fill | on the size word ("huge"@101.16 → fill 101.20) |
| check rows | sentence onsets of each question, −0.19…+0.05 s (rows 2-4); row 1 leads its sentence by 0.63 s |
| table rows, chunk pops, cost rows, MP4 trio | **free-running timers** (400 / 239 / 1100 / ~650 ms) started ~0.2-0.6 s after the cut; lists are shown **ahead** of the voice (table finishes 1.2 s before the last item is spoken) |
| failed-part / recolour / merge | on "Not the entire"@117.08 (+0.09), "file"@117.82 (−0.12), "combines"@118.98 (+0.59) |
| caption highlight | word onset +0.07 s median |
| blink, sway, packet loops | free-running |

### 30. Sentence type → visual treatment
| sentence type | treatment (example) |
|---|---|
| new step / version ("So version 2.") | cut + stepper dot N + new title "Version N" (34.07) |
| process / flow ("The client uploads directly to S3") | reuse the 4-node diagram, draw only the named connector, run its packet (92.77) |
| enumeration of fields | key/value table rows on a 400-ms timer (37.97-41.17) |
| enumeration of checks (questions) | checklist rows on sentence onsets (72.57-76.77) |
| enumeration of costs ("More bandwidth. More memory…") | brick display word + 4 cost rows at 1.1 s (60.33-64.33) |
| magnitude / number ("a 5GB video", "20GB") | display number in blue (50.67, 100.73) |
| negative / warning ("bad idea", "fails at 99%") | brick-text outline box (22.33, 103.10) |
| explanation / caveat | grey in-card note (24.0, 104.93) |
| code/literal ("store the file inside Postgres") | SQL / JSON block in a window (20.0, 69.27) |
| cause → effect / transfer | connector draw + looping packet |
| split / parallel ("split into chunks") | 12-tile grid on 239-ms timer (108.17) |
| failure + retry | one tile brick → green recolour (117.2 / 117.7) |
| combine / result | collapse morph into result card (119.57) |
| thesis / summary | statement boxes + logo equation (162.73) |
No strike-through, no counters/tickers.

## G. Narrative / storyboard

### 31. Structure
| part | time | content |
|---|---|---|
| hook (0-3 s) | 0.00-4.17 | title "Build a file upload service" + Google Drive card + MP4 tile pops at 0.53 s; footnote sets the device "Follow one file. Improve its route." |
| naive design | 4.17-11.37 | "Looks simple." two stacked windows, file slides into the backend |
| Act 1 — Version 1 (all in Postgres) | 11.37-34.07 | 6 scaffolds: diagram, validate, metadata, SQL insert, SQL select, "Big bytes." (problem) |
| Act 2 — Version 2 (split metadata / S3) | 34.07-66.67 | 6 scaffolds, escalates to "One bottleneck remains" → "5 GB" → brick "API load ↑" |
| Act 3 — Version 3 (pre-signed direct upload) | 66.67-100.73 | 9 scaffolds: ask → checks → ticket ×2 → numbered flow 1-2-3 → verify |
| Act 4 — large files (multipart) | 100.73-121.30 | 3 scaffolds: "20 GB. 99% uploaded." → chunk grid → failed part → merged object |
| Act 5 — downloads + CDN | 121.30-145.53 | 4 scaffolds: reverse flow ×3, CDN tree |
| resolution | 145.53-162.73 | final architecture drawn twice (connectors re-drawn on each claim) |
| ending (last 5 s) | 162.73-169.67 | statement boxes "API = who + what" / "S3 = the bytes" + Postgres + S3 logos + grey tagline "A scalable file service, by design." No CTA, no outro card, mascot unchanged. |

### 32. Scaffold selection & transitions
- 33 scaffolds in 169.7 s (11.7/min). **Never mutated across a cut**: even the 4-node diagram reused 11 times is cut to a fresh copy and only the relevant connector is (re)drawn.
- Consecutive scaffolds about the same object reuse the same template and IDs (78.73 / 82.43 ticket; 107.53 / 115.13 chunk grid rebuilt from zero).
- Callbacks: "Version N" stepper; `u42/f_1042` and `demo.mp4` recur from 17 s to 137 s; final architecture (145.5, 151.7) is the same 4-node layout introduced at 45.5.
- Numbered sub-steps in titles ("1. Request → authorize", "2. Return the signed URL", "3. Browser → S3").

### 33. Entity continuity
Positions fixed per entity in every diagram: My files top-left (320,570), Upload API top-right (716,570), Metadata/Postgres bottom-left (320,1031), Amazon S3 bottom-right (716,1031). Colour roles fixed for the whole video (blue = bytes, purple = metadata/permissions, green = control/success, brick = cost/failure). The MP4 tile is always blue, filename always `demo.mp4` (except `archive.mov` for the 20 GB case).

## H. Audio

### 34. Voice
Single narrator (voice timbre not characterised); **194.9 wpm** over 155.3 s of speech (551 words, 63 sentences, median 8 words/sentence); inter-sentence pauses 0.1-0.6 s (e.g. 25.62→26.24); emphasis not assessable beyond pacing. Timbre/pitch not measured (would need pitch tracking) — not assessable in this pass.

### 35. Music / SFX / mix (measured with ffmpeg `ebur128`, `astats`)
| metric | value |
|---|---|
| integrated loudness | **−14.1 LUFS** |
| LRA | 1.3 LU |
| true peak | −1.1 dBTP |
| stream | HE-AAC 55 kb/s, 48 kHz stereo |
| pause floor | 60.00-60.12 s gap: **−38.5 dBFS RMS** (peak −29 dB) vs speech ≈ −15…−18 dBFS RMS ⇒ **no continuous music bed audible above ≈ −38 dBFS** (a very low bed cannot be excluded) |
| SFX | beat→transient coincidence 23.4% vs 24% chance ⇒ no SFX synced to visuals |

## I. Production

### 36. Export
720×1280, 30 fps CFR, H.264 High yuv420p, **253 kb/s video** (visible banding on the dot grid and colour smear on 1-px strokes), 169.79 s. All motion is deterministic and seek-safe (linear packets with fixed periods, fixed timers, fixed eases, no physics/particles), no video footage, no 3D ⇒ cheap to reproduce with an HTML/SVG renderer at 1080×1920 (the reference is a downscaled export; render at 1080 and let the platform downscale).

## Layout templates (deliverable 3)
Exact geometry is in **A.4 (T1-T7)**; fixed chrome coordinates in **A.1**. Summary for implementation (1080×1920):
```
chrome:  kicker y224-260 | title cap-top 301 (72px/800, lead 76.5) | subtitle y471 | CONTENT SLOT x320-1010 y549-1265
         mascot x66-276 y612-1343 | footnote dash (320,1299) text y1326 | caption centre (540,1498) h94.5
         footer rule y1650 x70-1008 | footer text y1672 | side margins 70 | top/bottom clear 224 / 228
T3 4-node: nodes 280x214 @ (320,570) (716,570) (320,1031) (716,1031); col gap 122, row gap 247
T1 card:  690 x 620-720 @ (320,549-560);  T2 stack: 690x358 @ y560 + 690x168 @ y1050, connector x665
T5 display: word cap 75-78 @ (324,564) + stack below (rows pitch 126 / tiles pitch 225,+45)
T6 tree:  origin 298x202 @ (535,555); leaves 189x163 @ x 320/570/820, y 905; note y1130-1197
T7 end:   boxes 690x125 @ y549, y704; logos ~105 @ y888-999 (x 396-497, 828-938); tagline y1060
```

## Light theme spec for our generator (we have none today)
```css
:root[data-theme="light-lab"] {
  --bg:#F4F4ED; --bg-dot:#E7E7E0; --bg-dot-size:3px; --bg-dot-pitch:38px; --bg-dot-offset:19px;
  --surface-1:#FEFCF8; --surface-2:#E6EDE9;             /* card body / title bar */
  --border:#C0C6C4; --border-w:1.5px; --divider:#E5E3DF; --titlebar-divider:#B9BEBD;
  --shadow-card:0 9px 6px -3px rgba(40,70,60,.10);     /* ≈ #E3E8E2 band under cards, no x-offset */
  --radius-card:16px; --radius-chip:9px; --radius-box:9px; --radius-caption:12px;
  --ink-1:#17232B; --ink-2:#22272A; --ink-3:#474C4D; --ink-4:#626667; --ink-mono:#6E7476; --traffic-dot:#8F989D;
  --blue:#1766DA;  --blue-tint:#E5EEF9;  --blue-ghost:#D0D6DC; --blue-line:#5F85A3; --track:#DAE0E4;
  --purple:#6D4EA5; --purple-tint:#EAE6F2; --purple-ghost:#D7D4D8; --purple-ink:#5B4690;
  --green:#187A5B; --green-disc:#12805C; --green-tint:#DDF2E7; --green-ink:#17503A;
  --brick:#B14B30; --brick-tint:#FAE4DA; --brick-ink:#8E3B26;
  --navy:#142733;
  --edge-w:4.5px; --edge-ghost-w:3px; --titlebar-h:48px; --traffic-dot:10.5px; --traffic-pitch:19px;
  --caption-bg:#FEFCF8; --caption-border:#C5C7C2; --caption-shadow:0 7px 4px -3px #DDE3E9;
  --caption-past:#13232D; --caption-active:#1D5EBD; --caption-future:#425058;
}
```
Fonts: heavy geometric grotesk 800 for display/title/caption (tracking −0.02…−0.03 em), Inter-like 400-700 for body, IBM-Plex-Mono-like for kicker/footer/chrome/keys. Exact faces not assessable from the 253 kb/s source.

## Gap matrix vs our v2 (`v2-bluegreen-2.mp4`, 17.7 s, 1080×1920, dark)
Our values measured on `design/OURS_V2/v2bg2_*.png` and a per-frame change scan of the render (content events 25 in 17.7 s, mascot 5 blips, caption ~75 one-frame swaps). Fix class: **T** tuning, **M** new module, **C** new capability, **A** asset.

| # | item | R4 (reference) | our v2 | gap | fix |
|---|---|---|---|---|---|
| 1 | safe zones | top 224 / bottom 228 / sides 70 clear | HUD at 214, content to ~1380, caption to 1534, sides 44 | similar top; our bottom 20% empty but caption higher | T |
| 2 | grid | mascot col 66-276, 44 gutter, content col 320-1010 | mascot bottom-left 16-276 × 940-1310, content col 280-1056 | ours overlaps mascot zone vertically; content col 110 px wider | T |
| 3 | content bbox | 20-24% area, top-anchored at y 549, CoM 43-48% | ~40% area (dashboard 330-1340) | ours much denser/larger | T |
| 4 | templates | 7 templates (T1-T7), 33 scaffolds | 1 template (dashboard), 1 scaffold | missing multi-template + scaffold sequencing | C |
| 5 | hierarchy | title 72 / display 105 / heading 33 / body 28 / label 22 | no title; 60-px caption is the largest text; 48-px % numbers | missing title and display tiers | M |
| 6 | spacing | fixed pitches (60 table, 78 checks, 141/128 grid) | rows ~168 px apart (loose) | tighten list pitch | T |
| 7 | HUD | none; kicker + stepper | 64-px HUD bar "LIVE • OK" | replace HUD with kicker row in this style | T |
| 8 | step/counter/footer | stepper 3 dots, footer brand + NN counter, footnote dash | none | missing progress chrome | M |
| 9 | mascot | 211×732 full body, never moves, blink 200 ms every 3.5-5.7 s, 3.6-s sway | SpongeBob 260 px wide, bottom-left, occasional blips | add blink timer + micro-sway; move to mid-left column | T/A |
| 10 | captions | ivory pill, 1.5 border, soft shadow, 50 px/800, 3-state karaoke, centre 78%, 1-f gap + scale pop | #07090C box, 3-px light border, 8-px hard blue offset shadow, 60 px, top 74% | need light variant; add past/active/future colours + pop-in | T |
| 11 | palette | light #F4F4ED, ivory cards, 4 role hues, ≤3 at once | dark #0D131B gradient, blue+green | **no light theme** | M (theme) |
| 12 | typography | 3 families (grotesk 800, Inter, mono), 7-tier scale | mono + sans, 3 tiers | add display/title tiers | T |
| 13 | cards | window chrome (48-px title bar, traffic dots, mono path), r 16, soft shadow | flat dark panels r ~16, coloured top rule | add window-card module | M |
| 14 | chips | tinted, borderless, 40-43 h, r 9 | tinted "LIVE/IDLE" chips ~40 h | close; restyle for light | T |
| 15 | icons/imagery | real product logos, MP4 tile, packet doc glyph | status dots only | need logo set + file/packet glyphs | A |
| 16 | connectors | orthogonal 4.5-px role-coloured, 3-px ghost, labels, no arrowheads | none (slider track only) | **missing connector system** | C |
| 17 | numbers/tables | display numbers, key/value tables, progress bar, chunk grid | % big numbers, instance rows | add table/grid/bar modules | M |
| 18 | data realism | consistent IDs across scaffolds (u42/f_1042, 52428800) | realistic (i-0a3f8c21, :443) | parity | — |
| 19 | background | flat + static 38-px dot grid | dark radial gradient | add dot-grid bg for light theme | T |
| 20 | module catalog | 27 modules | ~6 (HUD, slider, target-group card, instance row, big %, caption) | ~20 modules missing | M |
| 21 | entrances | 133-ms pops, +10-14 px rise, back-out ≈ 1 px; title 233 ms; group 300 ms | not measured per element; content events mostly 1-3 frames | adopt pop/row/title tokens | T |
| 22 | state changes | dash-offset draw over ghost, 167-ms linear recolour, linear progress | status text/colour swaps (IDLE→HEALTHY→ERROR) | add draw + lerp recolour | T/C |
| 23 | emphasis | none besides colour + display type | outline highlight on active card (5.4 s) | ok / remove glow-like outline in light theme | T |
| 24 | transitions | hard cut out + 233/300-ms fade-rise in; chrome hard swap | no scaffold transitions (single scaffold) | need cut-in recipe | C |
| 25 | ambient | looping linear packets 340-470 px/s, 1.6-s period, park rule; bar fills; blink | none (holds are static) | **missing ambient loops** | C |
| 26 | camera | none | none | parity | — |
| 27 | choreography | title → group (+50 ms) → first beat 0.2-0.7 s → timer lists → draw → packet | dashboard fully visible, mutations only | add build order | C |
| 28 | beat density | 11.3 cuts/min, 50.9 beats/min, scaffold median 5.0 s | 0 cuts, ~85 content events/min but low-area | need scaffold cadence | C |
| 29 | word anchoring | cuts +0.29 s after sentence onset; draws on keyword ±0.16 s; lists on timers | mutations anchored to words (our contract) | parity for anchors; add timer lists | T |
| 30 | sentence→visual | 14 mapped treatments (30) | state/recolour only | add enumeration/number/negation/flow mappings | C |
| 31 | structure | hook card 0-4 s, 5 acts with "Version N", thesis end card | single-state story | storyboard-level | C |
| 32 | scaffold selection | new copy per cut, same layout reused 11×, only one connector redrawn | one scaffold mutated | cut-and-redraw policy | C |
| 33 | entity continuity | fixed node positions + fixed colour roles | fixed (blue/green) | parity | — |
| 34 | voice | 195 wpm, 0.1-0.6-s pauses | TTS (not re-measured here) | — | — |
| 35 | mix | −14.1 LUFS, LRA 1.3, TP −1.1, no bed/SFX detected | not re-measured here | check −14 LUFS target | T |
| 36 | export | 720×1280 30 fps 253 kb/s (downscaled IG export) | 1080×1920 30 fps 323 kb/s | ours higher-res; fine | — |

## Top 15 gaps vs our v2 (ranked by visual impact)
| rank | gap | why it matters (R4 evidence) | fix class |
|---|---|---|---|
| 1 | **No light theme** | R4 is entirely #F4F4ED / ivory cards / dark ink; our whole palette is dark | new module (theme tokens above) |
| 2 | **No scaffold sequencing (1 scaffold vs 33, 11.3 cuts/min)** | the single biggest pacing driver; median scaffold life 5.0 s | new capability |
| 3 | **No connector system (orthogonal ghost + drawn active edge + labels)** | 22 draws; every diagram scaffold is built around them | new capability |
| 4 | **No packets / ambient loops** | every hold (up to 8.3 s) stays alive via linear packets, 1.6-s period, park rule | new capability |
| 5 | **No title / subtitle / display-type tiers** | 72-px headline changes every cut; 105-px display words at tension points | new module |
| 6 | **No window-card module** (title bar, traffic dots, mono path label) | the base container of all 33 scaffolds | new module |
| 7 | **Cut-in transition recipe** (hard out; title 233 ms + group 300 ms fade-rise 10 px; chrome hard swap) | defines the look of every scene change | tuning + capability |
| 8 | **Caption restyle for light theme** (ivory pill, 1.5-px border, soft shadow, 50 px, 3-state karaoke, scale-pop swap) | persistent, always on screen | tuning |
| 9 | **4-node diagram template reused with per-claim redraw** | 11 scaffolds reuse it; freshness comes from redrawing only the named edge | new capability |
| 10 | **Timer-driven list modules** (table 400 ms, checklist, cost rows 1.1 s, chunk grid 239 ms) | 48 of 144 beats | new modules |
| 11 | **Persistent chrome: kicker + stepper + footnote + footer counter** (replace HUD bar) | frames every scene; stepper marks acts | new module / tuning |
| 12 | **Product logos + MP4/packet glyph assets** | real Postgres/S3/Drive logos anchor recognition | asset |
| 13 | **Layout density & mascot column** (content 20-24% of frame, top-anchored at y 549; mascot mid-left 66-276 × 612-1343 with 44-px gutter) | R4 reads calm/airy; ours fills ~40% | tuning |
| 14 | **Mascot life: 200-ms blink every ~5 s + 3.6-s micro-sway** | only motion on the left third during holds | tuning (+ blink sprite asset) |
| 15 | **Dot-grid background + soft card shadows** (38-px pitch, 3-px #E7E7E0 dots; 9-px soft drop) | texture that keeps the flat light bg from looking empty | tuning |
