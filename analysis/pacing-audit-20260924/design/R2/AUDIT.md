# R2 design & motion audit — blue-green deployment (`R2_DdG-RuwsDRc`)

Source: `C:/Users/debna/Downloads/igexport-DdG-RuwsDRc.mp4` — **native 720×1280**, H.264 High, 30 fps, 145.73 s, ~250 kb/s video (IG re-encode).
All pixel values below are **measured on native 720×1280 frames and reported ×1.5 in 1080×1920 space** (**scale factor ×1.5**; every value has ±1.5 px quantisation; lines ≤1 native px are reported as 1.5 px). Hex values carry IG compression noise of about ±3 per channel (more on 1-px features); thin-feature colours are the brightest stable pixels.
Time: 30 fps → 1 frame = 33.3 ms. Timestamps are seconds in the reference file.
Our v2: `orchestrator/output/v2-bluegreen-2.mp4` (1080×1920, 30 fps, 17.7 s) measured natively.
Scratch/measurement files: this folder (`fr_*.png` full frames, `m_*.py` measurement scripts, `*.txt` raw outputs).



Our v2 reference points: 1080×1920 native, 30 fps, 17.7 s, frames `ours_*.png` (0.2–17.5 s) + `design/OURS_V2/v2bg2_*.png`.

## 0. Measured geometry map (1080×1920 px)

| Band / element | Reference R2 (measured) | Frames | Our v2 (measured) |
|---|---|---|---|
| Top dead zone | 0–235 (12.3 %) pure #000000, nothing ever drawn | all | 0–214, gradient mesh bg |
| HUD bar | x 60–1020 (w 960) × y 235.5–304.5 (h 69); fill #090d11; 1.5 px border #15191d; radius ≈9 | 18.26 | x 43–1037 × y 214–278 (h 64); fill #06070a; border #1e1f22 |
| Section-label / title band | cap-top y 342 (17.8 %), cap 33 px, centred x=540 | 6.5, 67.5, 129.0 | none |
| Top slot (swappable) | y ≈334–760 (users row 571–648; banners 334–451; console/chart 466/480–760; browser 501–1200 in S2) | 32.6, 41.6, 71.78 | none (single scaffold) |
| Router pill | x 330–1020 × y 780–844 (h 64), fill #090d11, radius ≈9 | 18.26 | no pill container; label+slider band y 336–460 |
| Lever / connector band | y 844–950 (knob Ø≈15 + halo ring, pivot stand ~45 w) | 18.26 | slider track y 447, knob Ø≈24 |
| Env cards (mascot layout) | BLUE x 330–664.5, GREEN x 684–1015.5 (w ≈333, gap 19.5), y 949.5–1300 (h 350) | 18.26 | x 327–656 / 680–1009 (w 329, gap 24), y 506–1340 (h 834) |
| Env cards (full-width reframe) | x 61.5–1018.5 (two cards, gap ≈20) | 59.2, 64.1 | n/a |
| Content bottom | y 1302 (67.8 %) | all carrier frames | y 1340 (69.8 %) + slab to 1380 |
| Caption box | y 1416–1531.5 (73.75–79.8 %), centred x=540, shadow to 1539 | 5 frames | y 1421–1534 |
| Bottom dead zone | 1540–1920 (19.8 %) pure black | all | 1545–1920, gradient haze |
| Mascot | x 19.5–243 (w 224 = 20.7 %), y 537–1321 (h 783 = 40.8 %) — identical in every mascot frame | 2.8…129.0 | x 16–278 (w 259), y 940–1314 (h 374 = 19.5 %) |
| Content column | with mascot x 330–1020 (w 690, 63.9 %); without mascot x 60–1020 (w 960, 88.9 %) | 32.6 vs 59.2 | x 327–1009 always |

Method notes: edges from per-row/per-column pixel scans (`m1.py`, `m2.py`), text/icon boxes from ink masks (`m_tb.py`, `m_lines.py`), panels from an XY-cut segmenter (`m_panels.py`), colours from modal/97th-percentile pixels (`m6.py`). IG compression smears 1-px lines; line widths ≤1 native px are reported as 1.5 px.

---

## A. Frame architecture & layout

| # | Reference R2 (measured) | Our v2 | Gap | Fix |
|---|---|---|---|---|
| 1 Safe zones | Top 0–235 empty (12.3 %); bottom 1540–1920 empty (19.8 %); side margin 60 px (5.6 %) for every panel incl. HUD (x 60/1020). Mascot is the only thing left of x=60 (x 19.5). Nothing ever enters y<235 or y>1540. | Top 214, side 43 (HUD) / 327 (cards); bottom empty but painted with warm gradient haze. | HUD 17 px too wide each side, 21 px too high; bg not black. | tuning |
| 2 Grid / columns | 2 columns when mascot on: mascot col x 19.5–243, gutter 87, content col 330–1020 (690). Mascot off: single content col 60–1020 (960). Inside content col: 2 equal cards (≈333 each, gap 19.5), all panels share left edge x=330 (or 60) and right edge 1020. Centre axis x=540 used for titles/headlines/captions. | Content col 327–1009 fixed; mascot col 16–278; no full-width mode. | Missing full-width (mascot-off) layout mode; right edge 1009 vs 1020. | new capability (layout mode switch) |
| 3 Content bbox per scaffold | Carrier (S4–S8, S14): HUD 235–305 + slot 334–760 + router 780–844 + cards 949–1300 → content y 235–1302 = 55.6 % of height; x 330–1020 → 36 % of frame area; vertical centre of mass ≈ y 770 (40 %). Zoom reframe (S9/S11): x 60–1020, y 235–1303. Stage (S16): cards x 61.5–1018.5 y 654–1045, audience row ≈1110, cone 507–645. Outro (S17): headline 361–600, cards 618–1111. | Content y 214–1380, x 327–1009; cards alone fill 506–1340 (43 % of height). Centre of mass ≈ y 860. | Ours stretches cards vertically to fill (834 px tall with rows 168 px apart); ref keeps cards compact (350 px, rows 54 px apart) and uses the freed 330–760 band for the swapping top slot. | tuning + new capability (top slot) |
| 4 Layout templates | 6 recurring templates (§ Layout templates): T1 carrier+top-slot, T2 carrier full-width reframe + headline, T3 compact carrier + DB panel, T4 stepper+table+SQL, T5 stage metaphor, T6 title/outro big-type. Plus T0 browser mockup (S2). | 1 template (dashboard) for all 17.7 s. | 5 templates missing. | new modules |
| 5 Hierarchy | Read order: (1) caption (cap 45 px, white on black box, only big text most of the time); (2) section label / headline (cap 33 px, or 78–96 px for headline moments); (3) accent numbers (100 % cap 22.5; router 100 % 16.5 in blue); (4) card headers (cap 15, tracked caps, accent colour); (5) mono data (≈11 px x-height, grey). Size ratios: caption:label:card-header:data ≈ 45:33:15:11 → UI data is **1/4 of caption height**. Headline moments jump to 78–96 px cap (1.7–2.1× caption). | Caption cap ≈45; card header cap 18; data 18 (mono); big % 41 cap; HUD LIVE 28. | Our UI text is 1.2–1.8× larger and uniform; no headline tier; no section-label tier. Big % is 1.8× ref. | tuning (type scale) + new module (headline/label) |
| 6 Spacing rhythm | Vertical gaps: HUD→label 38; slot→router 20–30; router→cards 105 (lever band); card rows pitch 54; card internal padding 22.5 (x 330→352.5 text start), header height 55 (divider at 1005); caption box pad-x 39, text-to-border ≈ 36 top. Card gap 19.5; users pitch 78 (9 users) / 81 (12 users). Dot-grid pitch 54 = card row pitch (consistent 54-px module). | Row pitch 168; card padding ≈25; gap 24; router→cards 46. | Rows 3.1× too far apart; no 54-px rhythm. | tuning |

## B. Persistent chrome

| # | Reference R2 (measured) | Our v2 | Gap | Fix |
|---|---|---|---|---|
| 7 HUD bar | **Anatomy** (18.26): left→right `shop.example.com` (mono, ink #c9d0d6, glyph box h 19.5 incl. descender ≈ x-height 11) · env pill (dot + `BLUE` tracked caps 12 px, text #6393d2, pill fill #0b1a36 + blue 1.5 px border, pill w ≈60 text/≈85 box) · `v1.4.2` (mono, #8d939a) · … right-aligned `0.4%` (mono bold, #f1f5fd, h 16.5) + `ERRORS` (tracked caps 10.5, #7e848b). Box x 60–1020, y 235.5–304.5, fill #090d11, border #15191d, r≈9. **Lifetime** 5.25–129.9 s (absent in S1/S2 title+problem and in S15b–S17 stage/outro). **Updates**: pill text PROD→BLUE 13.00; **backspace-and-retype** 64.35–64.65 (version text right edge 465→361.5 in 5 frames = 1 char/frame deleting, then 361.5→477 in 5 frames ≈2 chars/frame typing; pill recolours blue→green in 1 frame at 64.517); error % recolours red + value jump (0.4 %→30.8 % at 33.8; 17.8 %/18.0 % at 71.8–77.5; back 80.63); instant flips 93.75, 128.4. | Box x 43–1037, y 214–278, fill #06070a; content only `LIVE` + `• OK` pill (cap ≈18, pill text blue). Never changes in 17.7 s. | Missing host / env / version / error-rate fields and all live-update behaviours (retype, recolour, value tick). | tuning (geometry) + new capability (HUD fields bound to story state, retype/tick effects) |
| 8 Chapter / step indicators | (a) **Section label**: single line, heavy sans caps, cap 33 px, white #e8eaed (orange for THE RISKY WAY, purple THE HARD PART, red ROLLBACK), centred on x=540, cap-top y≈342; 11 distinct labels (THE PROBLEM, A REAL EXAMPLE, THE RISKY WAY, TEST IT PRIVATELY, THE IMPORTANT MOMENT, FIVE MINUTES LATER, THE HARD PART, ANOTHER OPTION, CANARY ROLLOUT, PICTURE IT LIKE THIS, THE STAGE/BEHIND THE CURTAIN/MOVE THE SPOTLIGHT/STRAIGHT BACK); fades in 100–130 ms, removed with no tween. (b) **Micro-label/eyebrow**: tracked caps 9–16.5 px grey #72767a–#898a8e (`HOW IT WORKS`, `ONE COMMON ANSWER`, panel eyebrows `CHECKOUT`, `THE RULE`, `DOWNTIME`, `ROWS MIGRATED`, `ROLLBACK`). (c) **Stepper tabs** S13 only: 4 tabs `1 ADD / 2 RUN BOTH / 3 MIGRATE / 4 REMOVE`, tab row y 556–640 (each tab ≈231×84, gap ≈12, x 60–1020), active tab filled purple #8a4dfc-ish, inactive #090d11. No progress bar, page counter or footer. | None. | Missing label tier and stepper. | new module (section label + eyebrow), reuse existing stepper (O-S) restyled |
| 9 Mascot | Full-body illustrated presenter holding a laptop, facing right; bbox x 19.5–243, y 537–1321 (224×783, 40.8 % of height) — **identical in every on-screen frame** (no bob, no scale punch; h 780–783). Mouth flaps continuously with speech; ~20 blinks, 133 ms each. **Entrance** (1.72): slides from off-left, right edge 106.5→243 in 11 frames (≈367 ms), per-frame Δ 31.5, 25.5, 19.5, 19.5, 12, 10.5, 7.5, 4.5, 1.5, 4.5 px → ease-out (≈easeOutCubic), brightness ramps with it. **Exit** (57.18, 101.58, 131.27): ease-in slide left, per-frame Δ 13.5, 16.5, 19.5, 27, 34.5, 42 (57.2) / 4.5, 9, 12, 16.5, 21, 28.5, 37.5, 48 (101.6) → 7–10 frames (233–333 ms). **Re-entries** 66.00, 83.88, 113.88 are **hard cuts** (66.0: absent at 65.963, full at 65.997). Present 1.7–57.3, 66.0–75.5, 83.9–101.7, 113.9–131.3 (≈66 % of runtime); hidden whenever the diagram goes full width. Never overlaps content except during the 130.0 push (in front of the blue card = depth cue). | SpongeBob sticker, x 16–278, y 940–1314 (259×374, 19.5 % of height), bottom-aligned with cards; same bbox at 9.0 and 16.5 s (frozen). Always on screen. | Ours is half the height, sits low (starts at 49 % vs 28 %), no mouth/blink, never exits, so content never gets full width. Asset rights of both characters unknown. | asset (full-body presenter with mouth/blink states) + new capability (mascot exit/enter tied to layout mode) + tuning (top 537, h 783) |
| 10 Captions | Box: fill #07080b, border 3 px #ffffff, hard offset shadow ≈8 px right+down in #4497ff (no blur), no radius; y 1416–1531.5 (h ≈116 outer), centred x=540, width = text + 39 px pad each side (e.g. 267–811.5 for 'going there yet.'). Text: heavy grotesk (Inter-like, ≈800), cap height 45 px, x-height 34.5 (→ font-size ≈62 px), word gap 21 px, single line, sentence case. **Karaoke**: spoken words #ebf1f9, active word #549bf4, upcoming words #8f99a9 (grey, not white). Chunk 2–5 words; swap = old chunk dims 1 frame (25.500), new at ~30 % (25.533), full at 25.567 → **67 ms crossfade**, box resizes instantly, no slide/scale. | Box y 1421–1534 (h 113), fill #040508, 3 px white border, 8 px shadow #64a4fb (lighter), cap ≈45; active word blue, upcoming grey. Swap = **hard 1-frame** replace (0.700→0.733), and occasional empty gaps (3.500–3.733 s blank). | Very close. Shadow hue lighter (#64a4fb vs #4497ff); swap lacks the 2-frame dim/fade; ours blanks between sentences. | tuning |


## C. Visual design system

### 11. Palette (measured hex; modal fill / 97th-percentile accent)

| Role | Reference R2 | Where measured | Our v2 |
|---|---|---|---|
| Background | **#000000** flat (corners, 0–235 and 1540–1920 are exactly 0,0,0) | all frames | #090d11 base + coloured mesh gradient (#0d131b top-left, #11110e / #0b1513 bottom haze, #151e2a centre) |
| Bg texture | dot grid, 3 px dots #080808–#101010, **54 px pitch**, visible only inside an ellipse x 26–1053 × y 350–1377 (radial fade), identical positions in every frame (static) | 18.26, 59.2, 6.5, 132.8 | none |
| Surface-1 (HUD, router, panels, console, chart, stat boxes) | #090d11 | HUD, router, 32.6 banner | #06070a HUD; component slab ≈#0f1318 behind cards |
| Surface border | #15191d (1.5 px) | HUD edges | #1e1f22 HUD / #282c34 cards |
| BLUE env surface / border | **#091931** / #29456d–#2d3f5b | card, 18.26 | slate ≈#171c27 / grey + 3 px blue top bar |
| GREEN env surface / border | **#032815** / #225d40–#3b5446 | card, 18.26 | slate-green / grey + 3 px green top bar |
| DB / purple surface | #201336 panel; active tab ≈#2a1a48 | 86.0, 105.9 | none |
| Red-flash surface | #4f2f2b (green card during the 140.48 flash) | 140.5 | error row chip rgba(255,110,110,.12) |
| Dimmed element | ≈40–48 % of the lit value (green fill #032915→#01140d, text #c1cbb4→#565b52; blue #091931→#030c16) | 132.8, 140.5, 57.1 | not used |
| Text primary | #f1f5fd / #ebeef5 (numbers, headlines) | HUD 0.4 %, headline | #f4f5f7 |
| Text secondary | #c9d0d6 (host), #b8c8df (instance IDs on blue) | 18.26 | #f4f5f7 (IDs are white) |
| Text muted | #8b9098 / #8d939a / #7e848b / #72767a (eyebrows) | 18.26, 64.1 | #9aa1ad |
| Blue accent | #4b9afb / #479aff (big type), #68a1e9 (card header), #549bf4 (caption active word), #6393d2 (pill text) | 143.9, 18.26 | ≈#4d86f9, #5287b7 header, #4a87f0 big % |
| Green accent | #2ad56c (big type), #4ec57c (card header) | 143.9, 18.26 | #71f5a7 accent / #7de1aa healthy |
| Orange (compute) | #f57201 instance tiles | 18.26 | none (instances use green/grey dots) |
| Purple (LB, DB, schema) | #894bff router tile; #c282fc titles; #c480fe counters | 18.26, 100.6, 109.8 | none |
| Red (errors) | #ff375c ("18%"), #f83c64 (500 banner), #ed3456 (users) | 71.78, 32.6, 33.8 | #ff6e6e |
| Amber (versions, warnings) | #fcba48 text / #3b2600 pill fill ("Deploy v2.0.0", ALL AT ONCE, strike line, bypass curve); #b6a65a (IDLE · REGISTERED) | 2.8, 118.2, 58.3 | #ffb84d (not seen in frames) |
| Hues on screen at once | 2–5 (median 4 in the carrier: blue, green, orange, purple; + red/amber at alarm moments); hues are tiny accents on a frame that is ~85 % black | visual log §7 | 2 (blue, green) + red at 12.0 |

### Items 12–19

| # | Reference R2 (measured) | Our v2 | Gap | Fix |
|---|---|---|---|---|
| 12 Typography | **Heavy grotesk** (Inter-like, ~800) for: captions (cap 45 ≈ 62 px font); section labels (cap 33 ≈ 45 px, caps); headlines (cap 78 ≈ 107 px "SWITCH THE / TRAFFIC", line pitch 123; cap 93 "ONE LIVE / ONE READY", pitch 147; cap 96 "18%"); panel titles (cap 28.5 "500 POST /checkout", "BACKWARD COMPATIBLE"; ≈45 "ONE ROUTING CHANGE"); big numbers (cap 30 "0.00s", cap 40.5 "62,030"). Headline tracking is tight: "SWITCH THE" = 583 px for 10 glyphs at cap 78 (≈0.75 cap per glyph, about −3 % tracking). **Mono** (JetBrains-Mono-like; face not verified) for all data: host/URL, IDs, SQL, paths, target groups, versions; glyph box 16.5 (x-height ≈11). **Micro caps**, tracked +10–15 %, 9–16.5 px for eyebrows, HEALTHY/IDLE, OF TRAFFIC, ERRORS. Case: ALL CAPS for labels, headlines and status; lower-case mono for data; sentence case for captions. Text per frame: caption of 2–5 words + ≤1 label + roughly 30–60 tiny UI tokens. | Inter; card header cap 18 (800); mono rows 18; big % cap 41; HUD 28; slider labels 11 caps. No headline or label tier. | UI text 1.2–1.8× too large; no display tiers (label 33 / headline 78–96); no mono SQL or log text. | tuning + new module (headline, label) |
| 13 Card/panel anatomy | **Env card** 333×350, r≈12, 1.5 px tinted border, tinted fill. Header row 55 px: tracked accent caps `BLUE` (cap 15) + right `LIVE` chip (text 31.5×9, dark pill with light border), hairline divider. Sub-row: `blue-tg` mono grey + version chip (blue text, blue border, text ≈60×13.5). 3 instance rows at 54 px pitch: orange 28 px tile icon, mono ID 16.5, white 10.5 px status dot, right-aligned `HEALTHY`/`IDLE` (12 px tracked caps). Optional status line (amber `IDLE · REGISTERED`, `READY · 3/3 HEALTHY`, `LAST KNOWN GOOD · v1.4.2`, `v2.0.0 DEPLOYED`). Footer `100%` (cap 22.5) + `OF TRAFFIC` (10.5 caps). Padding 22.5 px. No shadow, no glow. **Surface panel** (#090d11, 1.5 px #15191d, r≈9): router pill, banners, stat boxes (DOWNTIME 420×104; ROWS MIGRATED 361×102; each = 9 px eyebrow + value + 9 px sub-caption). **Window chrome**: browser/console = 3 traffic-light dots (≈9 px, red/amber/green) + dark URL field (11 px mono) + reload glyph; the console adds an amber `STAFF ONLY · NOT IN DNS` chip. | Card 329×834, r≈14, 1 px grey border, slate fill with 3 px accent top bar. Header `BLUE v2.0.4 LIVE`. 3 instance rows as separate rounded chips at 168 px pitch; big % footer. No window chrome, no stat boxes. | Card proportions (ours 2.4× taller); tint system (ref fills the whole card with the env hue, ours uses a top bar); no orange instance icons, status line or version chip; footer scale. | tuning (card) + new modules (window chrome, stat box, banner) |
| 14 Pills/badges | (a) **Env pill**: dot + caps, tinted fill + 1.5 px border (HUD). (b) **Status chip**: `LIVE` light text in a dark pill with light border; `—` square chip for "none". (c) **Version chip**: mono text in an env-colour border. (d) **Amber tag**: `Deploy v2.0.0`, fill #3b2600, text #dcae5e, full radius, h ≈33. (e) **Floating pills**: `0%` on the connector (≈43×36 box, grey mono), `IDENTICAL`, `+7 DAYS LATER` (purple), `ALL AT ONCE` (amber, later struck), `TESTS FAILED` (amber), `IN ALARM · 18.0%` (red fill), `200 OK`. (f) Micro-labels `OLD`/`NEW` (DB). All flat: no gradients, no glow. | LIVE/IDLE/ERROR chips (tinted fill, no border); `• OK` HUD pill. | ≥8 pill variants missing; ours have no borders. | tuning + new module (floating annotation pill) |
| 15 Iconography | Filled glyphs only; the one line icon is the check-box. User = filled person 36×40, white #dfe3e9. Instance = orange rounded tile (28 px) with a white stack glyph. Router = purple rounded tile (≈39 px) with a white share-graph glyph. DB = magenta tile. Chart = pink tile. Cube glyph on version chips. Check = 1.5 px outlined rounded square + tick. Illustrated mascot (flat vector, black outline). No logos, photos or maps. | Dots only; no icons; raster cartoon sticker. | Icon set missing (user, instance, router, db, chart, check). | asset (icon set) |
| 16 Connectors | All hairlines, 1–1.5 px. User fan-out: 9–12 grey Béziers converging into a dotted 5-dot vertical stem under USERS. Router → LIVE card: solid vertical "lever" (white stand + knob Ø≈15 inside a halo ring Ø≈45). Router → idle card: **dashed** 1.5 px line with a floating `0%` pill. Console → green: amber **curved bypass** line (dashed, 1.5 px). Cards → DB: purple elbow connectors. Strike-throughs: 1.5–3 px amber/red. No arrowheads anywhere. | Straight slider track (1 px gradient) + knob Ø 24; no connectors. | Fan-out, lever, dashed idle link, bypass curve and DB links all missing. | new module (connector layer) |
| 17 Charts/numbers/tables | **Line-chart panel** (≈690×290): pink icon + `5xx ERROR RATE` caps + `20% max` on the right; 3 hairline gridlines (0/10/20 %) with 9 px grey axis labels; flat white series that turns red after a dashed vertical event marker; end dot. **Big numbers**: `18%` red cap 96; `0.00s`, `62,030`/`128,540` counters; `100%`/`0%` card footers. **Table**: DB panel (x 61.5–1021.5 × 688–1063 in S13); header row (magenta tile + `orders` + right `Amazon RDS · PostgreSQL 15`); 6 rows at ≈44 pitch; 2 columns (bold white name / grey mono type); `OLD`/`NEW` tags; dimmed row for the deprecated column. **Checklist**: console rows at ≈44 pitch with `200`/`502` on the right. | Big % counters only. | Chart, table, checklist and stat counters missing. | new modules |
| 18 Data realism | Consistent fake-but-real data: `shop.example.com`, `https://green.shop.example.com`, `listener :443`, `blue-tg`/`green-tg`, instance IDs `i-0a3f8c21 i-07b41de9 i-0c92f5a4` / `i-0d18ba77 i-0e63c40b i-0f27ae55`, versions `v1.4.2 → v2.0.0/v2.0.1`, errors `0.4% → 18%`, `POST /checkout 500`, SQL `ALTER TABLE orders RENAME total_price TO order_total`, `numeric(10,2)`, `Amazon RDS · PostgreSQL 15`, `128,540 orders`, `+7 DAYS LATER`. Every number matches the narration ("18%", "five minutes later"). IDs stay constant across all 17 scaffolds. | `i-0a3f8c21`… IDs, `v2.0.4/v2.1.0`, `listener :443 forward`, `blue-tg 90%`. | The one module is similarly realistic; host, error %, SQL and endpoints are missing. | tuning (storyboard data) |
| 19 Background | Flat black + static radial-masked dot grid (see palette). Never changes or moves; no vignette, noise or glow, except the spotlight cone in S16 (grey trapezoid #43474a→#2f3335 fading downward, 129→217 px wide, y 507–645). | Coloured mesh gradient with a warm lower haze + a visible lighter slab behind the cards (x ≈280–1056, y ≈300–1380). | Ours reads as "dashboard in fog"; ref reads as "UI on void". | tuning |


## D. Module catalog (item 20)

Geometry is 1080-space, measured at the cited time. "Reuse" counts scaffolds (S#, from the visual log) in which the module appears.

| ID | Module | Anatomy (measured) | Variants / states | Data carried | Reuse | Ours |
|---|---|---|---|---|---|---|
| M1 | **HUD bar** | 960×69 at (60,235.5), #090d11, r≈9; host mono · env pill · version · spacer · error % + ERRORS | env pill PROD/BLUE/GREEN; error % white/red; version retype | host, active env, version, error rate | S3–S15 (5.25–129.9) | partial (LIVE/OK only) |
| M2 | **Section label** | 1 line of caps, cap 33, white or semantic colour, centred at x 540, cap-top y≈342 | white / orange / purple / red; text swap in place (133.75, 137.5, 140.13) | chapter name | 14 labels | missing |
| M3 | **Big headline** | 1–2 lines of caps, cap 78–96, line pitch 123–147, centred; tight tracking | white (SWITCH THE TRAFFIC, SWITCH IT BACK); purple, dim→bright per line (EXPAND / AND CONTRACT); blue+green line pair (ONE LIVE / ONE READY); red number (18%) | key phrase / number | S9, S11, S13, S17, S10 | missing |
| M4 | **Users row** | 9 (w/ mascot, pitch 78) or 12 (full width, pitch 81) filled person glyphs 36×40 + `USERS` 9 px caps + fan-out Béziers + dotted stem | white / dim / red (per-user cascade) / "The audience" caption variant (S16) | traffic source, who is affected | S3–S8, S9, S14, S15, S16 | missing |
| M5 | **Router pill** (load balancer) | 690×64 (w/ mascot) or 630×88.5 (zoomed, 2 rows); purple tile + `listener :443` + `forward` chip + `blue-tg N%` + `green-tg N%`; optional `APPLICATION LOAD BALANCER` micro-label | 1-row / 2-row; % counters animate; compact centred 780-wide (S12/S13) | routing weights | S3–S15 (≈125 s) | partial (label + slider, no pill) |
| M6 | **Traffic lever** | knob Ø≈15 in halo ring Ø≈45 on a white stand above the LIVE card; solid line to the live side; dashed line + `0%` pill to the idle side; % tick marks 5/25/50/100 (S14) | position blue↔green (490 px travel), tween 600 ms | active target | S4–S15 | partial (slider) |
| M7 | **Env card** | 333×350 (or ≈470×390 zoomed/stage) — see item 13 | lit / dimmed 40–48 % / red-flash; LIVE chip moves; version text flip; rows HEALTHY/IDLE/DRAINING/UNHEALTHY (red); status line variants | env, version, instances, health, traffic % | every scaffold except S2/S13 | yes (restyle) |
| M8 | **Browser window** | window chrome + URL field `https://shop.example.com`; body = product grid (2×3 skeleton tiles), order summary + PAY, new checkout + orange EXPRESS ONE-CLICK bar, 503 page | skeleton / grid / summary / 503 / highlight outline on tiles | the user-facing app | S2, S3, S5 | missing |
| M9 | **Test console** | window chrome with `https://green.shop.example.com` + amber `STAFF ONLY · NOT IN DNS`; 5 checklist rows at 44 px pitch (check-box + mono endpoint + right status 200/502) | rows appear one by one; re-run cascade ≈150 ms; `200 OK` floating badge | private tests | S7 | missing |
| M10 | **Alert banner** | surface panel 690×117: 9 px eyebrow (`CHECKOUT`) + red title cap 28.5 (`500 POST /checkout`) + 9 px sub-caption | red error / purple rule (`BACKWARD COMPATIBLE`) / white (`ONE ROUTING CHANGE` 960 wide) / error log (`column "total_price" does not exist`) | incident / rule | S6, S11, S12 | missing |
| M11 | **Stat box** | 420×104 or 361×102 surface panel: eyebrow + value (cap 30–40) + sub-caption | `0.00s DOWNTIME`, `was 0.4%`, `ROWS MIGRATED 128,540` (ease-out counter), clock `+00:0x` | one metric | S9, S10, S13 | missing |
| M12 | **Line chart panel** | ≈690×290; see item 17 | flat crawl; orange tail; red surge (ease-in draw); draw back down; dimmed | error-rate time series | S10, S11, S14 | missing |
| M13 | **Option rows with strike** | surface rows (≈630×88) with cube icon + mono text + right `NOT THIS` micro caps; strike line draws L→R | `deploy again` (amber strike); `build v1.4.2` / `deploy v1.4.2` (red strike) + red `IN ALARM · 18.0%` pill | rejected alternatives | S9, S10 | missing |
| M14 | **DB table panel** | purple surface #201336, 960×375 (S13) or 690×≈500 (S12); header + 6 rows at 44 px pitch; OLD/NEW tags | cell text swap; row highlight; row insert into a reserved slot; row collapse; dim row | schema | S12, S13 | missing |
| M15 | **SQL / code panel** | #07080b panel 960 wide, eyebrow `STEP 1 · EXPAND` purple 9 px caps + 2 mono lines | line 1 instant, line 2 typewriter ≈2 chars/frame | the command being run | S12, S13 | missing |
| M16 | **Stepper tabs** | 4 tabs ≈231×84, gap 12, number + caps label; active = purple fill #2a1a48 + purple text | ADD / RUN BOTH / MIGRATE / REMOVE | process step | S13 | partial (O-S stepper exists) |
| M17 | **Floating annotation pill** | small pill near its subject (`0%`, `IDENTICAL`, `+7 DAYS LATER`, `ALL AT ONCE`, `TESTS FAILED`, `app v2.0.0` travelling token) | amber / purple / red / grey; can travel (v2 token 733 ms) or be struck | a single fact | ≥10 uses | missing |
| M18 | **Spotlight stage** | grey trapezoid cone (top 129 w → bottom 217 w, y 507–645) above the lit card; ellipse floor shadow below the cards; audience row | on blue / on green; slide 500 ms ease-in-out (forward) or 200 ms (back) | metaphor: live = on stage | S16 | missing |
| M19 | **Title env cards** | two 470×700 tall cards at (60,396) and (550.5,396), fills tint from #090d11 to #0e1932 / #081830 with huge `BLUE`/`GREEN` (cap ≈84) + skeleton lines + `ENVIRONMENT` eyebrows; `HOW IT WORKS` above, `DEPLOYMENT` tracked below | tint-in per word | title | S1 | missing |
| M20 | **Mascot** | full-body presenter 224×783 at (19.5,537) | talk / blink; slide-in / slide-out; hidden | presence | ≈66 % of runtime | asset mismatch |
| M21 | **Caption box** | see item 10 | — | narration | 100 % | yes |

**How modules combine.** One frame = HUD (M1) + label (M2) + top-slot module (one of M4/M8/M9/M10/M11/M12/M13/M15/M3) + router (M5) + lever (M6) + two cards (M7) + mascot (M20) + caption (M21). The top slot is the only region that changes identity. The carrier (M5+M6+M7) mutates in place.

## Layout templates (item 4, exact geometry, 1080×1920)

| ID | Template | Used (s) | Boxes (x0–x1 × y0–y1) |
|---|---|---|---|
| T0 | **Problem browser** (mascot + browser) | 1.68–5.25 | mascot 19.5–243 × 537–1321; label cap 367–400 centred on 540 (x 384–693); amber tag 708–852 × 453–488; browser 330–1020 × 501–≈1200 |
| T1 | **Carrier + top slot** (mascot on) | 5.25–57.5, 66–75.6, 113.9–129.9 | HUD 60–1020 × 235–305; label cap-top 342; slot 330–1020 × 334–760 (users 349.5–1000.5 × 571–648; banner 334–451; console 480–760; chart 466–760); router 330–1020 × 780–844; lever 844–950; cards 330–664.5 / 684–1015.5 × 949.5–1300 |
| T2 | **Full-width reframe** (mascot off) | 57.5–66, 75.6–83.9 | HUD 60–1020; headline 249–832 × 357–558 (2 lines) or option rows 225–855 × 609–720; users 94.5–985.5 × 573–612; router 60–1020 (2-row pill, ≈630 wide at x 225–855 at 59.2); cards 61.5–1018.5 × ≈950–1303 |
| T3 | **Compact carrier + DB** | 83.9–101.7 | HUD; banner 330–1020 × 336–457; router 330–1020 × 469.5–534; cards 330–1020 × 546–≈802 (h ≈256, header divider 601); DB 330–1020 × 835.5–1300 (header divider 877) |
| T4 | **Stepper + table + SQL** (mascot off) | 101.9–113.9 | HUD; headline (EXPAND AND CONTRACT) 171–772 × 481–600 → removed; stat box 660–1021 × 337–439; router 150–930 × 471–534; tabs 60–1020 × 556–640; DB 61.5–1021.5 × 688–1063; DB bottom 1060; SQL panel 60–1020 × 1095–1215 |
| T5 | **Stage metaphor** | 129.9–142.1 | label cap-top ≈387 centred; cone 186–403 × 507–645 (over blue) / 699–870 at y 570 (over green); cards 63–529.5 / 549–1015.5 × 654–1045.5; floor shadow ≈1060; audience row ≈1110 + caption "The audience" |
| T6 | **Big-type title / outro** | 0–1.68, 142.1–145.6 | S1: two tall cards 60–529.5 / 550.5–1020 × 396–1096.5 (470×700, gap 21) with `HOW IT WORKS` 418–655 × 334–351 and `DEPLOYMENT` 88–700 × 420–430 (tracked); S17: `ONE LIVE` 292.5–792 × 361.5–454.5 blue, `ONE READY` 223.5–864 × 508.5–600 green, cards 61.5–1020 × 618–1111, switch line under cards |


## E. Motion system

### Measured events (full-res native frames, every 30 fps frame; scripts `mot1.py`–`mot7.py`)

Displacements are in 1080-space px per frame (Δ). "f" = frames at 33.3 ms. Duplicate frames appear inside tweens (for example 29.55 = 29.583, 58.133 = 58.167). They look like dropped frames in the IG re-encode and show up as Δ=0 blips.

| # | Event (time) | Property measured | Travel | Duration | Per-frame profile | Easing inferred | Stagger / notes |
|---|---|---|---|---|---|---|---|
| E1 | Mascot slide-in (1.687→2.053) | bbox right edge | 106.5→243 visible (≈243 px from off-screen) | 11 f = 367 ms | Δ 31.5, 25.5, 19.5, 19.5, 12, 10.5, 7.5, 4.5, 1.5, 4.5 | ease-out (≈cubic-out); pixel count ramps too (6.9k→34.5k), so there is also an opacity ramp | first frame after the hard cut at 1.683 |
| E2 | Mascot exit (57.183→57.417) | right edge | 225→0 (exits) | 7 f = 233 ms | Δ 13.5, 16.5, 19.5, 27, 34.5, 42 | ease-in (accelerating) | followed by the hard reframe cut at 57.500 (83 ms later) |
| E2c | Mascot exit (101.58→101.88) | right edge | 235.5→0 | 10 f = 333 ms | Δ 4.5, 9, 12, 16.5, 21, 28.5, 37.5, 48 | ease-in (quad/cubic-in) | layout swap at 101.917 |
| E2b | Mascot re-entry (66.0) | bbox | — | **0 f** | absent 65.963 → full 65.997 | hard cut | enters with the re-layout; no slide |
| E3 | `app v2.0.0` token travels into BLUE card (29.467→≈30.20) | chip centroid (noisy: occlusion + compression) | ≈(555,430)→(≈490,≈990): ≈560 px down, ≈−70 px x | ≈22 f ≈ 733 ms | mid-travel Δy 40–55 px/f (29.62–29.85); tail 9.8, 7.3, 8.3, 5.7 | ease-in-out with a long ease-out tail | passes **behind** the browser at 29.53–29.57 (z-order under the window); card rows flicker to v2 at 30.13; same recipe into GREEN 35.13–35.8 |
| E4 | Traffic lever blue→green (60.733→61.333) | knob x | 294→784.5 = **490 px** | 18 f = 600 ms | Δ 1.1, 2.2, 5.4, 9.6, 15.9, 25.4, 37.3, 51.9, 70.7, 81.8, 62.9, 45.7, 32.0, 21.3, 13.3, 7.7, 3.7, 1.7, 0.7 | symmetric ease-in-out (peak at 55 % of duration; ≈easeInOutCubic) | router `blue-tg/green-tg` % counters run in lock-step (visual log: 99/1→0/100 over 500 ms) |
| E5 | Headline "SWITCH THE / TRAFFIC" (58.70→59.0) | line cap-top y + ink luminance | line 1: 376.5→357 (**rise 19.5**); line 2: 507→483 (**rise 24**) | line 1 4 f (133 ms), line 2 4 f | line 1 Δy −10.5, −6, −1.5, −1.5, lum 122→171→204→218→225; line 2 Δy −13.5, −7.5, −3, lum 73→148→186→210 | ease-out rise + fade, no overshoot | **stagger 100 ms** (58.800 / 58.900); previous row exits 58.70–58.733 by moving **down 9 px + fade** (2 f), then 1 blank frame (58.767) |
| E6 | "18%" slam (71.503→71.603) | red-ink bbox | w 241.5→213 (1.13×→1.0), h 103.5→88.5 (1.17×→1.0) | 4 f = 133 ms | scale 1.15, 1.09, 1.02, 1.00; red channel 176→233→238→241 (≈70 %→100 % opacity) | scale-down "slam" + fade-in, ease-out, **no rebound** | HUD error % turns red on the same beat |
| E7 | Strike-through on "deploy again" (58.067→58.233) | line right end | x 210→864 = **654 px** | 5 f = 167 ms | Δ 58.5, 166.5, 0 (dup frame), 415.5, 13.5 | ≈linear to ease-out (dup frame distorts) | amber #fcba48 line, 1.5–3 px, drawn L→R across the whole row |
| E8 | Error-rate line surge (69.917→70.550) | red series right end | x 760→1003.5 = 243 px | 19 f = 633 ms | Δ 1.5, 4.5, 3, 6, 4.5, 6, 6, 9, 9, 10.5, 12, 13.5, 13.5, 16.5, 15, 21, 21, 22.5, 27, 21 | **ease-in (accelerating)**, stops dead at the end (the visual log's "linear" is wrong) | plateau to 70.67; big "18%" lands 0.95 s later |
| E9 | Camera push onto cards (129.897→130.33) | card bbox (green card: right edge fixed at 1015.5) | card w 331→466.5 (**1.41×**), top y 955→654 (**−301 px**), left 333→63 | 13 f = 433 ms | width Δ 3, 6, 7.5, 16.5, 15, 27, 22.5, 15, 10.5, 6, 1.5, 1.5; top Δ −6, −12, −18, −33, −39, −58.5, −49.5, −33, −27, −9, −12 | ease-in-out | users/router **cut out in 1 frame** at 129.93 (ink 2522→146→0). Right edge is anchored, so this is a layout FLIP to full width + scale, not a true camera zoom. The mascot stays in front, occluding the blue card |
| E10 | Spotlight blue→green (138.867→139.367) | cone centre x at y 570 | 294→784.5 = **490.5 px** | 15 f = 500 ms | Δ 1.5, 1.5, 6, 12, 21.8, 36.8, 54.8, 80.2, 96.8, 69.8, 47.2, 30, 17.2, 9, 4.5, 1.5 | symmetric ease-in-out | % counters lead the cone by ≈100 ms (visual log) |
| E10b | Spotlight back green→blue (141.067→141.267) | same | 490.5 px | **6 f = 200 ms** | Δ −4.5, −28.5, −103.5, −217.5, −103.5, −28.5, −4.5 | ease-in-out, 2.5× faster than E10 | "move it straight back" is animated as a snap |
| E11 | Title card tint + word (0.233→0.500; text 0.300→0.367) | card fill hex; blue-ink peak | fill #090d11→#0e1932; text B 181→236→239 | tint 8 f (267 ms); text 3 f (100 ms) | tint Δ even ≈ linear-to-ease-out; text 75 %→98 %→100 % | ease-out | GREEN: text 0.700→0.767 (3 f), **stagger 400 ms**, locked to the words "blue"@0.16 / "green"@0.40 (+140/+300 ms lag) |
| E12 | Caption chunk swap (25.467→25.567) | white/blue/grey ink counts | — | 3 f | old full → 25.500 dim (grey only) → 25.533 faint (new width) → 25.567 full | 2-frame crossfade, box width jumps instantly | — |
| E13 | Users turn red (32.983→33.417) | per-user red occupancy | 9 icons | 434 ms total | order 3, 7, 2, 6, 1, 5, 9, 4, 8 at 32.983, 33.050, 33.083, 33.150, 33.217, 33.250, 33.317, 33.35, 33.417 | each flip ≤2 f; **random-order stagger** mean 54 ms (1.6 f) | no scale pop |
| E14 | Top-slot swap users→console (39.567→39.833) | slot ink + mean luminance | console top 489→496.5 (drops **7.5 px**) | old off in 1 f at 39.600; **4 blank frames**; new fades 39.733→39.833+ | ink 0→39→188→301… | cut-out → gap → fade + slight drop-in | label `TEST IT PRIVATELY` lands in the same window |
| E15 | Checklist row `POST /login` (41.347→41.447) | row ink, top y | top 550.5→546 (rise 4.5) | 4 f = 133 ms | ink 10→41→46→77→83 | ease-out fade + 4.5 px rise | rows 1–5 follow the words (41.38, 43.00, 44.63, 46.25, 48.25) |
| E16 | HUD version backspace + retype (64.350→64.650) | text right edge; pill hue | 465→361.5 (−103.5) then →477 (+115.5) | 5 f delete + 5 f type = 300 ms (+1 f hold) | delete Δ −13.5, −34.5, −21, −21, −13.5 (≈1 char/f); type Δ +24, +21, +33, +25.5, +12 (≈2 chars/f) | linear stepped (typewriter) | pill recolours blue→green in **1 frame** at 64.517 (between delete and type) |
| E17 | Full-width reframe (57.467→57.500) | content x-extent | 330–1023 → 60–1018.5 | **0 f** | — | hard cut | router pill then fades in 57.60→57.70 (≈100 ms) |

### Items 21–27

| # | Reference R2 (measured) | Our v2 (measured) | Gap | Fix |
|---|---|---|---|---|
| 21 Entrance recipes | **Default** (labels, pills, rows, panels): opacity 0→1 in 3–4 f (100–133 ms), ease-out, with a small **rise of 4.5–24 px** (E5, E15); no scale; no overshoot. **Headlines**: per line, rise 19.5–24 px + fade over 4 f, 100 ms stagger (E5). **Numbers that matter**: scale 1.15→1.0 + fade in 4 f (E6). **Top-slot modules**: previous content cut, 1–4 blank frames, new module fades in 3–4 f with a 7.5 px settle (E14). **Mascot**: 367 ms ease-out slide from off-left (E1). **Title words**: text 100 ms, surface tint 267 ms (E11). | Entrances are 133–200 ms opacity fades (atlas); the only in-scaffold entrance we have is the whole dashboard at 0.033–0.4 (400 ms window). | Durations are close. Our 24 change windows in 17.7 s (1.36/s, measured by frame diff over y 150–1400) are a similar rate to the ref's 1.12 beats/s, but ours are almost all knob moves, % text and row-status flips inside one module: **no new elements enter after 0.4 s**. Ours also has no rise, slam or headline stagger. | tuning (recipe presets) + new capability (per-element beat scheduling) |
| 22 State-change recipes | **Recolour/tint**: 3–4 f fade (BLUE card tint 11.50, dim to 40–48 % in 4 f at 56.87). **Status flip**: instant or 1 f (HUD pill 64.517; LIVE tag move 62.90 in ≈130 ms). **Counters**: lever-coupled % tween 500–600 ms ease-in-out (E4); big counter 0→128,540 over ≈1.4 s ease-out (per-frame increments falling 8674→1564, visual log). **Text swap**: backspace + retype 300 ms (E16), or instant cell swap (90.25). **Check/tick**: row fade + rise (E15). **Strike**: L→R draw 167 ms (E7). **Row insert**: into a pre-reserved slot, 100 ms fade (105.77). **Row collapse**: 130 ms (113.13). **Cascade recolour**: random-order, ≈54 ms stagger (E13). **Alarm flash**: hard on/off, 3 f (140.483→140.583, fill #4f2f2b). | Instance-row ERROR recolour (12.0); knob moves (9.0–9.37, 57 px, 12 f ease-in-out; 12.5–12.87 back; 15.67–16.2, 583 px, 17 f ease-in-out); % counters change. Measured 423/530 frames pixel-identical. | Ours has 3 kinds of state change; the ref has 11. No dim state, strike, retype, cascade, flash, row insert or collapse. | new capability (state-change op library) |
| 23 Emphasis recipes | Scale slam 1.15→1.0 / 133 ms (E6, once); red flash 100 ms hard on/off (140.48, once); spotlight cone; **dimming everything else** to ≈45 % (56.87, 50.63, 62.13, 76.25, 131.5) is the main emphasis device; outline highlight on product tiles (22.38, 23.25; 130 ms). No glow, no pulse rings, no shake. | Card outline highlight (ours 1.0: blue 2 px ring around the BLUE card); green glow dots. | Ours lacks dim-others and slam; uses glows that the ref never uses. | tuning + new op (dim-others) |
| 24 Exits / transitions | **Hard cuts** (0 f): 1.683, 57.500, 75.60, 104.80, 142.13; mascot re-entries. **Top-slot swaps**: old out in 1 f, 1–4 blank frames, new fades in (E14). **Headline exit**: slide down 9 px + fade, 2 f (58.70). **Mascot exits**: ease-in slides, 233–333 ms (E2). **Layout FLIP**: 433 ms ease-in-out (E9). **End**: fade to black 200 ms (145.38). What persists: HUD, router, cards, caption, mascot (unless going full width). The next scaffold builds as label (≈+0–130 ms) → slot module → keyword pops. | Single scaffold; no transitions (caption only). End: black at 17.5. | Transition system absent. | new capability (scaffold/slot manager) |
| 25 Process / ambient | Dotted users→router flow pulses (loop from 14.0); chart line crawls right (120.13–121.5, ≈1.4 s); clock pill `+00:0x` ticks (67.25); typewriter SQL ≈2 chars/f (105.07–105.63); mascot mouth + blinks. Between beats the frame is otherwise locked (≈50 % of frames identical in 20–30 s). | Mascot static; no loops. 80 % of frames identical (423/530). | No ambient motion at all. | new capability (loops: flow dots, chart crawl, typing) |
| 26 Camera | One push (E9, 433 ms ease-in-out, 1.41×, implemented as a layout FLIP). Zoom-in reframes at 57.50 and 75.60 are **hard cuts**, as are the zoom-outs at 66.0, 83.88 and 113.88 (≤1 f). No pans, shake, blur or 3D. | None. | Missing reframe cut + push. | new capability (layout-mode switch with optional FLIP tween) |
| 27 Choreography | Build order inside a scaffold: label → slot module → per-keyword pops (≈2.3 beats per sentence), 78.5 % within 0.3 s of the keyword. Motion is front-loaded (entrances finish in ≤133 ms); long tweens are reserved for **value changes** (lever 600 ms, counters, token travel 733 ms, spotlight 500 ms). Overlaps: counters lead the cone by 100 ms; the HUD retype follows the lever by ≈3 s (on "production"); cascades are random-order. During holds only micro-motion runs (flow dots, mouth). | Components animate inside one scene: 24 change windows (0.03–0.4 build, 1.0 highlight, 3.1–5.5 row flips, 9.0/12.5/15.7 lever moves, 12.0 error). Our rate is similar (1.36/s) but the variety is not: 3 beat types vs 12, no scaffold changes vs 17. | Rate OK, variety and structure missing. | new capability |

## Motion spec (element class → recipe)

| Element class | Enter | State change | Exit | Easing / duration | Evidence |
|---|---|---|---|---|---|
| Label / eyebrow / micro-text | opacity 0→1 + rise 4–8 px | text swap in place (1 f) | cut (0 f) | ease-out, 100–133 ms | E15, visual log #6, #28 |
| Headline line | opacity 0→1 + rise 20–24 px, grey→white | dim→bright recolour 100 ms (EXPAND) | slide down 9 px + fade, 67 ms | ease-out 133 ms per line, 100 ms stagger | E5 |
| Hero number | scale 1.15→1.0 + fade | — | cut | ease-out 133 ms, no rebound | E6 |
| Panel in top slot | fade + 7.5 px settle, after 1–4 blank frames | rows inside cascade (≈150 ms) | cut 1 f | 100–133 ms | E14 |
| Pill / chip | fade 100 ms | colour flip 1 f; can be struck | cut | ease-out | #26, #60, E16 |
| Travelling token | — | path travel ≈560–600 px | absorbed into the target (target rows flicker) | ease-in-out 700–733 ms | E3 |
| Lever / % counters | — | knob travel 490 px + counters in lock-step | — | ease-in-out 600 ms (500 ms counters) | E4 |
| Spotlight | fade 130 ms | slide 490 px | cut | ease-in-out 500 ms forward / 200 ms back | E10, E10b |
| Line draw (strike) | L→R draw | — | — | ≈linear/ease-out, 167 ms | E7 |
| Chart series | crawl (linear) / surge (ease-in) | recolour tail white→orange→red | draw back down 400 ms | 530–1400 ms | E8 |
| Counter (big) | box fade 100 ms, value holds 230 ms | 0→N | cut | ease-out 1.4 s | visual log #127 |
| Env card | tint fade 267 ms | dim to 45 % (133 ms); LIVE chip move 130 ms; red flash 100 ms hard | — | ease-out | E11, 56.87, 140.48 |
| Users | row fade | random cascade recolour, ≈54 ms stagger | cut | 1–2 f per icon | E13 |
| Mascot | slide from off-left 243 px | talk / blink | slide off-left, ease-in | out 367 ms / in 233–333 ms | E1, E2 |
| Layout mode | hard cut (0 f), or FLIP 433 ms | — | — | ease-in-out | E9, E17 |
| Caption chunk | 2-frame crossfade | active word recolour per word | — | 67 ms | E12 |
| HUD value | — | backspace 1 char/f + retype 2 chars/f; pill recolour 1 f | — | 300 ms | E16 |


## F. Timing & narration sync

| # | Reference R2 (measured) | Our v2 (measured) | Gap | Fix |
|---|---|---|---|---|
| 28 Beat density | 163 hand-logged beats in 145.6 s = **67/min** (1.12/s). Gaps: median 870 ms, p10 250, p90 1520, max 3120 (134.38→137.50 stage hold). 66 % of runtime sits in 1–2 s holds; 17 layout states, mean life 8.1 s (median 8.4 s). Build vs hold: entrances finish in ≤133 ms, so >90 % of every scaffold's life is hold punctuated by keyword pops. Carrier lives ≈125 s. Machine detector (rows 11–12 excluded): 72.9/min, median gap 600 ms. | 24 frame-diff change windows in 17.7 s (81/min raw). Only **1 layout state** for 17.7 s; 80 % of frames pixel-identical (423/530) vs ≈50 % in the ref (150/300 identical in 20–30 s). | Raw rate is similar; structure is not: ours never changes scaffold or top slot, and the ref's 17 scaffolds in 145 s ≈ 2.1 per 17.7 s. | new capability (top-slot scheduling) |
| 29 Word anchoring | 78.5 % of beats land within 0.3 s of their keyword (A), 16.6 % lead/lag by 0.3–1.5 s (L, mostly **leads**: labels and panels 0.4–1.5 s before the noun), 4.9 % free-running. Measured examples: BLUE text 0.300 vs "blue"@0.16 (+140 ms); lever start 60.733 vs "stops sending"@60.46 (+270 ms, ends 61.333 inside the phrase); headline 58.800 vs "switch"@58.72 (+80 ms); spotlight 138.867 vs "move the spotlight"@138.68 (+190 ms); 18 % slam 71.503 vs "18%"@71.28 (+220 ms). Typical visual lag behind word onset is **+80…+270 ms**. | Knob moves 9.0 / 12.5 / 15.67 and error flip 12.0; ours has no word-level ASR in evidence, so per-word lag was **not assessable** for v2. Visually, 9.0 lands on "shifts ten percent" (caption at 9.0). | Lag not measured for ours; the ref pattern to copy is +80…270 ms after onset for pops and ≈0.5 s leads for section labels. | tuning (anchor offsets) |
| 30 Sentence → treatment | enumeration → per-item pops (checklist rows 41.38–48.25; users cascade); number → hero number slam (18 %) or counter (128,540; % lever); negation/"instead of" → **strike-through** ("deploy again" 58.10; rebuild/redeploy 73.25/74.80; ALL AT ONCE 118.0); cause/effect → travelling token (v2 into card), connector draw (bypass line), cascade (users red); state → recolour/dim/LIVE move; time jump → label + stat/clock (FIVE MINUTES LATER, +7 DAYS LATER); definition/rule → banner panel (BACKWARD COMPATIBLE); metaphor → dedicated scaffold (stage); summary → big 2-line headline (ONE LIVE / ONE READY). | enumeration/cause/negation all map to a lever move or a row recolour. | 7 of 9 rule types missing. | new capability (sentence-type → op rules in storyboard generator) |

## G. Narrative / storyboard

| # | Reference R2 | Our v2 | Gap | Fix |
|---|---|---|---|---|
| 31 Structure | Hook 0–5.25: title card (BLUE/GREEN tint on the words) → hard cut 1.68 → "THE PROBLEM" browser → 503 on black (4.5). Act 1 concept (5.25–18.4); Act 2 worked example + risky way + safe way + tests (18.4–57.5); climax switch (57.5–66); Act 3 failure/rollback (66–83.9); complication: DB schema (83.9–113.9); variant: canary (113.9–128.4); metaphor recap (128.4–142.1); ending 142.1–145.6: two-line summary headline + switch line + 200 ms fade to black. | 17.7 s single explanation of shift / error / rollback inside one dashboard; ends in a hard black frame at 17.5. | No hook scaffold, no problem-first framing, no recap/outro scaffold. | storyboard (new module + generator rules) |
| 32 Scaffold selection | Keep and mutate while the same actors are discussed (carrier ≈125 s); replace only the top slot for new evidence; reframe full-width (mascot exits) for climaxes (57.5, 75.6); new scaffold only for a new domain (DB 83.9, stepper 101.9, stage 131.5). ≈7 full-layout changes/min, 2.1 hard cuts/min. Callbacks: users row returns 5×; chart returns (80.25, 120.0); HUD state echoes every switch. | 1 scaffold. | No slot/scaffold manager. | new capability |
| 33 Entity continuity | BLUE always left, GREEN always right, same IDs/versions, same colours (blue #091931/#4b9afb, green #032815/#2ad56c, orange compute, purple LB/DB) across all 17 scaffolds including the stage and outro. LIVE chip is exclusive (one card at a time). | Left/right and colours held. **State bug**: at 16.5 both cards show `LIVE` while BLUE is at 0 % (`ours_16.50.png`). | Enforce a single-LIVE invariant. | tuning (component logic) |

## H. Audio

| # | Reference R2 (measured) | Our v2 (measured) | Gap | Fix |
|---|---|---|---|---|
| 34 Voice | Single narrator, F0 median **219 Hz** (p10 131, p90 267; autocorrelation on 860 voiced 40 ms frames). 535 words in 145.3 s = **221 wpm** (3.68 words/s); inter-word gaps median 0.18 s, only 9 gaps >0.3 s, max 0.48 s (no long pauses); sentence-end gap median 0.18 s. Emphasis by pitch rise on keywords; timbre/character not assessable beyond this. | Voice timbre not compared (not in scope of these measurements). Blank caption 3.50–3.73 suggests a ≥230 ms pause. | Match pace ≈220 wpm and cap pauses at ≈0.5 s. | tuning (TTS rate / pause trimming) |
| 35 Music / SFX / mix | Integrated **−14.2 LUFS** (ffmpeg ebur128), LRA **1.2 LU**, true peak **−0.7 dBFS**. Audio floor never drops: 50 ms-frame RMS p5 −35.3 dBFS, p50 −18.7, p95 −14.1; mid-sentence gaps (n=38) median −19.8 dBFS vs speech −18.1, so a continuous bed or heavy compression is present (stems not separable, so bed-vs-voice level is **not assessable** exactly). SFX locking to visual beats not assessable visually (the machine found only 13 % of transients near beats). | **−17.1 LUFS**, LRA 2.1, TP −3.2 dBFS; RMS p5 −59.1 (true silences), p50 −23.6, p95 −15.3. | Ours is 2.9 LU quieter, has dead-silent gaps and a wider range. | tuning (loudness target −14, bed under voice, limiter to −1 dBTP) |

## I. Production

| # | Reference R2 | Our v2 | Gap | Fix |
|---|---|---|---|---|
| 36 Export | Delivered as 720×1280, 30 fps, H.264 High yuv420p, ≈250 kb/s video + HE-AAC 58 kb/s (IG re-encode; the original master was probably 1080×1920; this is not assessable). Some duplicated frames inside tweens (29.55/29.583, 58.133/58.167) consistent with re-encode drops. Style is flat vector UI on black: fully deterministic and cheap to render (no blur, glow, particles or video layers; the only raster is the mascot). | 1080×1920, 30 fps, H.264 ≈323 kb/s, AAC 127 kb/s, 17.7 s. | Parity is fine; render at 1080×1920 and keep flat vector styling so HF renders stay deterministic. | none |


## Side-by-side: reference R2 vs our v2 at comparable story moments

Composites (left = ref ×1.5 upscaled, right = ours): `sbs1_live-blue.png`, `sbs2_switch.png`, `sbs3_failure.png`, `sbs4_partial-vs-downtime.png`.

### S-1 "Blue is live, all users hit blue": ref 13.50 vs ours 3.00 (`sbs1_live-blue.png`)
| Element | Reference | Ours |
|---|---|---|
| Background | pure black + faint 54 px dot grid | blue-grey mesh gradient + lighter slab behind the cards + warm haze at the bottom |
| HUD | `shop.example.com · ●BLUE · v1.4.2 … 0.4% ERRORS`, y 235–305, x 60–1020 | `LIVE ●OK` only, y 214–278, x 43–1037 |
| Top slot | users row (9 glyphs) + fan-out curves + dotted stem to the router | nothing: the space is taken by the stretched cards |
| Router | purple-icon pill 690×64 `listener :443 [forward] blue-tg 100% green-tg 0%` | uncontained text `APPLICATION LOAD BALANCER / listener :443 forward / blue-tg 100% green-tg 0%` + slider |
| Routing graphic | lever (knob in halo, white stand) onto BLUE, dashed line to GREEN with `0%` pill | 2-dot slider track, knob Ø24 at the left |
| Cards | 333×350, whole card tinted (#091931 / #032815), tinted border, 3 rows at 54 px pitch, orange instance tiles, version chip, `IDLE · REGISTERED` line, footer `100% OF TRAFFIC` cap 22.5 left-aligned | 329×834 slate cards with 3 px top bar, rows at 168 px pitch as chips, green/grey dots, centred footer `100%` cap 41 |
| Status words | `HEALTHY` white micro caps / `IDLE` grey | `HEALTHY` green bold / `IDLE` grey, 1.5× larger |
| Mascot | full-body presenter 224×783 at y 537 | SpongeBob 259×374 at y 940, overlapping the card column gutter |
| Caption | 'live. All your users' — same box system | 'one to green,' — same system; shadow a lighter blue |

### S-2 "Switch traffic to green": ref 61.48 vs ours 16.50 (`sbs2_switch.png`)
| Element | Reference | Ours |
|---|---|---|
| Layout | **full-width reframe**: mascot gone, 12 users (pitch 81), router pill 2-row with `APPLICATION LOAD BALANCER`, cards 61.5–1018.5 | unchanged layout from t=0; mascot still on |
| Lever | knob travelled 490 px in 600 ms ease-in-out onto GREEN; stand re-parented to green | knob travelled 583 px in 17 f ease-in-out (15.67–16.2); comparable |
| BLUE card | rows `DRAINING` in amber with amber dots; `0% OF TRAFFIC`; LIVE chip removed | rows still `HEALTHY`; `LIVE` chip **still shown** (bug); `0%` |
| GREEN card | `v2.0.1` chip, `READY · 3/3 HEALTHY` amber-green line, `100%` | `v2.1.1`, LIVE chip, `100%` |
| Headline moment | preceded by "SWITCH THE / TRAFFIC" headline (58.8) + struck "deploy again" row (58.1) | none |
| HUD | stays BLUE until the retype at 64.35 ("green becomes production") | no change |

### S-3 "Something breaks → move straight back": ref 140.50 vs ours 12.00 (`sbs3_failure.png`)
| Element | Reference | Ours |
|---|---|---|
| Scaffold | stage metaphor: `STRAIGHT BACK` label, grey spotlight cone over GREEN, floor shadow, 11-person audience row + `The audience` caption; no HUD | same dashboard |
| Failure signal | **whole GREEN card flashes red** (#4f2f2b fill, 100 ms hard on/off); BLUE dimmed to ≈45 % | one row chip turns red `ERROR`, header chip `ERROR`; nothing dims |
| Traffic | spotlight snaps back in 200 ms (E10b) | knob moves 90/10 → 100/0 at 12.5–12.87 (12 f) |
| Mascot | absent (exited 131.27) | present |

### S-4 "Partial / instant switch result": ref 64.10 vs ours 9.00 (`sbs4_partial-vs-downtime.png`)
| Element | Reference | Ours |
|---|---|---|
| Stat | `DOWNTIME 0.00s / NO DEPLOY, NO RESTART` stat box 420×104 in the top slot | none |
| Users | 12-user row, full width | none |
| Routing | green 100 %, BLUE rows `IDLE` grey, GREEN `LIVE` | knob just starting its 10 % move (caption 'shifts ten percent' already on screen: ours lags the word) |
| Density of info | ≈60 UI tokens + 1 stat | ≈25 UI tokens |

---

## Top 15 gaps vs our v2 (ranked by visual impact)

| Rank | Gap | Reference (measured) | Ours | Fix class |
|---|---|---|---|---|
| 1 | **No top slot / scaffold rotation**: one frozen layout for the whole video | carrier + a swapping 690×(117–426) top slot; 17 layout states in 145 s (≈7 layout changes/min) | 1 layout for 17.7 s | new capability (slot manager + storyboard ops) |
| 2 | **Background** | flat #000000 + static 54 px dot grid in an ellipse | mesh gradient, haze, visible slab | tuning |
| 3 | **Card proportions and density** | 333×350 cards, rows at 54 px pitch, full-card tint | 329×834, rows at 168 px, top-bar tint | tuning |
| 4 | **Mascot** | full-body 224×783 at (19.5,537), talks/blinks, exits for full-width moments | 259×374 sticker at y 940, frozen, always on | asset + new capability |
| 5 | **No full-width reframe mode** | content col 60–1020 when the mascot is off; hard-cut reframes at 57.5/75.6, FLIP push 433 ms | fixed 327–1009 | new capability |
| 6 | **Missing display type tiers** | section label cap 33; headlines cap 78–96, 2-line, 100 ms stagger, rise 20–24 px; hero-number slam 1.15→1.0 | none | new module |
| 7 | **UI type scale too large** | data ≈11 x-height mono, headers cap 15, footer cap 22.5 | 18 / 18 / 41 | tuning |
| 8 | **HUD is empty and static** | host · env pill · version · error %; retype, recolour, value jumps | `LIVE ●OK`, static | tuning + new capability |
| 9 | **Users row + connectors** | 9–12 users, fan-out Béziers, dotted stem, lever with halo, dashed idle link + `0%` pill | slider track only | new module |
| 10 | **Palette semantics** | orange compute tiles, purple LB/DB, amber versions and warnings, red alarm; 4–5 hues | blue/green only (+red once) | tuning + asset (icons) |
| 11 | **State-change op library** | dim-others (≈45 %), strike-through, cascade recolour, red flash, backspace-retype, row insert/collapse, token travel | row recolour, knob, % | new capability |
| 12 | **Evidence modules** | browser mockup, test console, error chart, stat boxes, alert banner, DB table, SQL typewriter, stepper | none | new modules |
| 13 | **Negation / time / number rules** | "instead of" → strike; "18%" → slam; "five minutes later" → label + clock | not mapped | new capability (generator rules) |
| 14 | **Loudness / bed** | −14.2 LUFS, LRA 1.2, TP −0.7, never silent (p5 −35 dBFS) | −17.1 LUFS, LRA 2.1, silent gaps (p5 −59) | tuning |
| 15 | **LIVE-state invariant + caption polish** | exactly one LIVE card; caption shadow #4497ff, 2-frame crossfade swap, no blank gaps | both cards LIVE at 16.5; shadow #64a4fb; 1-frame swap; blank 3.50–3.73 | tuning |

