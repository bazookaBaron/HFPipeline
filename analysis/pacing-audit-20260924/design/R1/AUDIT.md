# R1 (DdEedoQM6j3) — "How a DDoS attack works" — visual design & motion audit

Status: COMPLETE (items 1–36, module catalog, templates, motion spec, gap matrix, Top-15).

**Measurement basis.** The source file is **720×1280 H.264 High, 30 fps, 326 kb/s video / HE-AAC 56 kb/s, 176.98 s** (ffprobe). It is *not* 1080×1920. All pixel values below were measured at native 720×1280 with PIL and are reported **×1.5 = px at 1080×1920** (native in brackets where it matters). ±1.5 px (1 native px) is the measurement floor; colours are read from the H.264 4:2:0 decode, so thin coloured strokes (≤2 native px) desaturate, and hexes of thin lines are ±~10/channel. 1 frame = 33.3 ms.

**Scale factor: all px = native ×1.5 (720→1080); hexes carry H.264 noise ≈±3/channel on flat areas, more on thin strokes.** Scratch files: `design/R1/*.png|jpg|txt|py` (measure scripts `m_*.py`, strips `R1_DdEedoQM6j3_strip_*.jpg`).

## A. Frame architecture & layout

Coordinates: `@1080 px (native 720 px)`. Frame = 1080×1920.

| # | Item | R1 measured | Evidence | Our v2 | Gap / fix class |
|---|---|---|---|---|---|
| 1 | Safe zones | **Top 0–235 px empty** (pure #000; the dot grid fades to 0 above y≈30). **HUD 235–305**. **Content zone y 382–1320** (title top 382, lowest content = mascot feet 1320). **Caption 1416–1532.** **Bottom 1540–1920 (20%) always empty**: nothing sits below the caption shadow in any of the 40 ref frames. **Side margin 60 px** (HUD, tabs and full-width panels span x 60–1020). Only swarm/particle fields and the world map bleed to x 1078. | m5/m6/m19; 40 ref frames | Content spans 330–1380 and the caption 1421–1534, with the bottom 20% also empty. Side margin ≈44 (HUD x 44–1036). | Tuning: HUD top 235 with a 60 px margin; content ≤1320 |
| 2 | Grid / columns | **Two columns when the mascot is visible.** The mascot column is x 21–240 (feet-anchored, #9), then a 90 px gutter, then the **content column x 330–1020 (690 wide)**. Panels left-align at x=330. **Every display number or headline right-aligns at x=1017–1020**, the HUD's right edge. Perspective worlds (road, map) span the full width *behind* the mascot (road base x 108–971). **One column when the mascot is hidden** (30% of runtime): x 60–1020 (960 wide). Titles centre on x=540. | m19 bboxes; display right edges 677–680 native | Mascot x 17–274, content x 327–1010. The right edge is not an alignment axis. | Tuning (column constants) + **new capability: mascot hide → 1-column layout** |
| 3 | Content bbox / fill | Median bbox **25% of frame area** (range 9–40%). Ink centroid sits at **40–49% of height** (median 45%, y≈860). Mascot frames are typically x 252–1018 × y 486–1178. No-mascot frames are x 60–1018 × y 424–1254 (29–40%). | m19 (40 frames) | One ALB panel, x 327–1010 × y 330–1340, ≈33% of frame, centroid ≈45% | Ours is one monolithic card; R1 is 2–5 smaller modules with black gaps → new modules |
| 4 | Templates | See **§Layout templates** (T1–T10) | — | 2 (ALB + 2 cards; title) | new modules |
| 5 | Hierarchy | Read order: 1st the display number/headline (cap 96–135 px, accent, right-aligned) or the perspective world; 2nd the panel value (cap 26–69 px, mono, accent); 3rd the labels (cap 12–15 px, grey #85898F, tracked caps). The caption (cap 48 px) is a parallel track. **Cap ratio display : big number : value : label ≈ 8 : 5.7 : 2.2 : 1** (96 : 69 : 26 : 12). | §12 | 100% value cap ≈60 px, labels ≈18 px (≈3.3 : 1); no display tier | Tuning: add a display tier (≥96 px cap) and 12 px labels |
| 6 | Spacing rhythm | **The 60 px grid (native 40 = dot pitch) governs.** Route-table hairlines every 60 px. Tile gaps 19 px horizontal / 18 px vertical. Access-log rows 54 px tall + 7.5 gap (pitch 61.5). Signal rows 70 + 13.5 (pitch 84). Slot grid cells 48 + 15 gap (pitch 63). IP pills 39 tall, pitch 75. Device cards 217 wide with a 21 gap. Panel label inset 18 px from the panel edge. Caption padding 40.5 px. | m20 scans | 3 instance rows spread over 670 px (≈168 px pitch) | Tuning: dense rows 54–70 px, gaps 7–14 px |

## B. Persistent chrome

### 7. HUD / status bar
| property | R1 | Our v2 | gap |
|---|---|---|---|
| box | x 60–1020 (**960×70 px**), **top 235.5**, bottom 305 | x 44–1036, top 214, h 64 | tuning |
| fill / border / radius | **#090D11**; border 1.5 px (1 native) **#15191D**; **radius ≈6 px** | fill #06070E; border nearly invisible; r≈8 | tuning |
| left label | "ORIGIN": caps, tracking ≈0.3 em, cap 15 px, **#F8FCFF**, x 84–170 | "LIVE", ≈24 px cap, no tracking | tuning |
| status pill | Capsule, **h 33 px**, starts at x 192. Width follows the label: OK 76, FILTERING 120, OFFLINE 124, FILTERED 135, DEGRADED 151, SATURATED 159. **Fill = accent at ≈25% on black: OK/FILTER* #0A3A49 (text #66D2E5), DEGRADED/SATURATED #402A03 (text #DCAF6C), OFFLINE #3F0B14 (text #C84960)**, with a 1.5 px lighter-tint rim and a leading 6 px dot. | "• OK" outline pill, blue | tuning + state enum |
| right metrics | Mono, cap 16 px, **#BFC5CB**, right-aligned at x≈995. Two fields joined by a mid-dot: `1,000 req/s · 38 ms`, `0 served · timeout`, `5,000,000 in · rising`, `overrun · rising`, `40,000 in · 908 ms`, `1,000 req/s · 42 ms`. | **absent** | **new field** |
| behaviour | On screen 0.1–176.3 s. **≈16 pill flips** follow the story: OK → DEGRADED 5.63 → OFFLINE 9.13 → OK 14.75 → DEGRADED 25.75 → OFFLINE 31.88 → OK 37.13 → SATURATED 39.83 → OFFLINE 48.1 … FILTERING 133.63 → FILTERED → SATURATED 157.63 → OFFLINE 174.38. **Each flip is a 1-frame swap.** Latency ticks through intermediate values (38 → 637 → 954 → 2012 ms, ≈600 ms, at 4.63). | Static "OK" | **new capability: HUD state machine driven by the storyboard** |
| divider | 3 px (2 native) hairline at **y 424–427**, full width, gradient #1B2125 at centre → #050505 at edges; sits under titles | none | tuning |

### 8. Chapter / progress indicators
- **Attack-type tab strip** (76.88–111.85 s): x 60–1020, **y 423–489 (66 px)**, 3 equal tabs ≈311 px wide with 10 px gaps. Labels `1 · BANDWIDTH`, `2 · CONNECTIONS`, `3 · APPLICATION LAYER` in tracked caps, cap ≈12 px. **Active: fill #3B2A02, border #4C3922, text #E9B75C. Inactive: fill #060C0E, border #1C2224, text #363C40.** The active tab advances by a 1-frame recolour (78.75 / 91.00 / 98.75); the strip enters with a 250 ms L→R stagger (76.88).
- **Title slot = chapter head**: centred caps sans, cap 33 px, #F7FCFF, ink y 382–416 (sits just above the divider). **12 uses** (0.33, 13.63, 35.63, 43.5, 51.25, 59.9, 62.25, 116.13, 120.63, 139.88, 144.63, 153.88). Many are removed after 1–2 s while the scaffold stays.
- No counters, breadcrumbs or footers. The HUD pill works as a global "health" indicator.
- Our v2: none. **Fix: new module (tab strip) + title slot in every template.**

### 9. Character (mascot)
| property | R1 | Our v2 |
|---|---|---|
| asset | 2D cartoon scientist in a hoodie holding a laptop (a Rick-Sanchez-like design; rights unknown, do not copy). **Animated: eye/pupil direction and mouth shape change every 1–3 frames.** Face-crop mean-abs diff is 2.3 per 100 ms and >1.0 on ≈90% of samples (strip 17.0–18.0 s). Functionally it is a talking-character video layer. | frozen sticker (SpongeBob) |
| size | **bbox 220×781 px**, x 21–240, **top 541, feet 1320** (28.2–68.8% of height). **Height 41% of frame.** | 257×349 px, x 17–274, y 942–1291 (**18% of height**) |
| scale states | **1.00** default. **≈1.19** on section-title cards (0.33–1.7, 35.6–37.1, 116.2–117.4). **1.267** on the "A DDOS ATTACK" slam (9.20–10.53). **1.175** at escalation (39.83–43.45) and in the finale (175.02–176.3). **Feet-anchored** (bottom holds at 878–880 native); x shifts +28 native. | none |
| scale tween | 9.20: 1 frame to 1.19, then **ease-out to 1.267 over 9 frames / 300 ms**. Heights 617, 622, 632, 640, 646, 650, 653, 656, 656, 658 (Δ 5, 10, 8, 6, 4, 3, 3, 0, 2). **39.83 and 175.02 are pure 1-frame snaps.** Returns to 1.0 are 1-frame snaps (10.55, 37.1). | none |
| entrance | 0.067–0.50: **slide in from off-left**. Right-shoe x per frame 17, 47, 73, 92, 108, 121, 131, 139, 144, 148, 153 native (Δ 30, 26, 19, 16, 13, 10, 8, 5, 4, 5). **Ease-out (expo-like), 225 px travel, 13 frames = 433 ms**, no fade, no overshoot. | none |
| hidden | 43.5–48.1, 62.3–64.6, 88.2–91.0, 100.9–115.8, 120.7–128.1, 135.7–153.6, 164.2–168.2 → **≈54 s = 30% of runtime**. Always removed by a 1-frame cut together with a swap into a full-width scaffold (tables, request cards, seesaw, map, source grid). | always visible |
| overlap | Panels never overlap it (they start at x 330). Worlds (road, skyline, swarm, map) pass behind it. Z-order: mascot > content, caption > all. | ok |

Fix: **asset** (animated talking character) + **new capability** (scale states, hide per scaffold, slide-in intro) + tuning (41% height, feet at 68.8%).

### 10. Captions
| property | R1 | Our v2 | gap |
|---|---|---|---|
| box | **fixed y 1416–1532 (h 117)**, centre **76.8%**, centred x=540 (±1 px); width hugs text **291–801 px** (max 74% of width); **always one line** | y 1421–1534 (h 114), centre 77.0%; width 683 at 12.2 s | ≈match |
| fill | **#080C11** | #07090C | match |
| border | **3 px (2 native) solid #F3FFFF, radius 0** | 3 px light | match |
| shadow | **hard offset +7.5/+7.5 px (5 native), 0 blur, #3FE1FF** (theme accent) | 8 px accent | match |
| font | Heavy grotesk (Inter-like, ≈800, tight). **Cap 48 px → font ≈66 px.** Inset 40.5 px left/right. | 60 px / 800, ink cap ≈43 px | **tuning: 66 px** |
| karaoke | **spoken #ECF2FC–#F4FAFF / active #48DBEE (1 word) / upcoming #97A0AF** (verified 52.0 s: "that" white, "traffic" cyan, "come from?" grey) | same 3-state | match |
| chunk | 1–5 words (mostly 3–4), swaps every 0.5–1.3 s; a 1-word chunk on sentence tails | similar | ok |
| swap | new chunk dim for 1 frame, full on the next (33–67 ms); no slide or scale | — | ok |
| gaps | between sentences the box dims (120.48: border lum <200, ≈60% opacity), then it is gone for 2–5 frames (7.60, 83.0, 120.53–120.70) | not measured | minor |

## C. Visual design system

### 11. Palette (dark theme): measured hexes
| token | hex (measured) | where measured | Our v2 |
|---|---|---|---|
| bg | **#000000** pure black. A faint teal radial glow peaks at **#000A0B** around (540, 660) and falls to #000000 by y≈1350 and at the side edges. | m4 between-dot sampling 153.7 s | #0D131B → #090D0F diagonal gradient plus a warm/olive corner wash (#161900 at x20 y1000). **Visibly lighter and muddier.** |
| bg dot grid | 3×3 px dots (2×2 native), **pitch 60 px**, origin (29, 29). Colour ramps **#040404 at the top → #262626–#282828 at y≈510–750 → 0 below y≈1590**, and is dimmer at the side edges: an elliptical mask centred ≈(540, 600). | m3 | none |
| surface-1 (panel) | **#090D11** | HUD, dashboard tiles, chart panel | #151E2A (card), much lighter/bluer |
| surface-0 (inset/track) | #0E141A–#10161E (bar tracks), #060C0E (inactive tab) | 39.68 bar track | — |
| border | **#1F2527** (1 native = 1.5 px), HUD #15191D | tile edges | #282C34 ≈ ok |
| text-primary | **#F5FAFF** (titles #F7FCFF, HUD label #F8FCFF) | 52.0 title | #FFFFFF |
| text-secondary | **#BFC5CB** (HUD metrics), #CACFD4 | HUD | — |
| text-muted/label | **#85898F / #898F96** (panel labels), #949DA2 (units) | 39.68 | ≈#8A93A0 ok |
| text-disabled | #363C40 (inactive tab) | 84.83 | — |
| **cyan (ok / primary / "you")** | **#50DBF2** (solid areas), #5DDFF5 on big digits; caption shadow #3FE1FF; bar fill #45DFFA | 39.68 | blue #4F88F4 is used as the primary accent |
| **red (attack / error)** | **#FB3A5B** (≈#FF3B5C at large sizes) | 42.8, 84.5, 106.9 | #F06060-ish ERROR |
| **amber (warn / degraded / active tab)** | **#FAB73E** at large sizes (#E9B75C on mid text, #E9AC37 on thin curves) | 80.08 BANDWIDTH | none |
| **purple (botnet / distributed)** | **#A77BFB** (≈#A97BFF) | 76.48, 59.73 | none |
| green (healthy/200) | #31C445 appears only in the browser traffic-light dots and "200 OK". **"HEALTHY" is actually teal #62CDDE on #0A3A49**: R1 uses cyan, not green, for OK. | 1.9, 39.68 | green #35C486 = GREEN deployment colour |
| tinted fills (accent ≈20–25% on black) | cyan **#0A3A49**/#0C3B42, amber **#3A2500**/#3B2A02, red **#3F0B14**/#4A000D/#160308 (log rows), purple #090123 (lit device card) | pills, rows, cells | ours: #1B2E2A-type tints ok |
| tinted borders | cyan #517C8A, amber #513B17, red #893C45–#8A3949, purple #635A81 | m20 | — |

**Simultaneous hues**: 1 accent + neutrals in ≈60% of frames. **Max 3 accents at once** (cyan + red + amber at 1.9, 153.48, 165.6). Accents are *semantic*: cyan = legit/you/ok, red = attack/error, amber = warning/uncertain/chapter, purple = botnet. A hue never changes meaning.

### 12. Typography
| role | family (visual ID) | size (cap → est. font px @1080) | weight / case / tracking | colour |
|---|---|---|---|---|
| caption | heavy neo-grotesk (Inter-like) | cap 48 → **≈66 px** | 800, sentence case, tight (≈-0.01 em) | white/cyan/grey |
| display (slam) | same grotesk | cap **96 px** ("A DDOS ATTACK"), 105 ("THE ROAD"), 126–135 (digits "5,000,000", "100,000") → **≈130–185 px** | 700–800, CAPS, tight. **Right-aligned at x 1020**, 2 lines, leading ≈1.05 (line pitch 150 px for cap 96) | white or the semantic accent |
| display 2nd line | — | "req/s" cap 132 incl. descender; "DEVICES" cap 72 | — | same accent |
| section head | grotesk | cap 54 px (BANDWIDTH), 45 (RATE LIMITING, THAT'S WHY IT'S HARD) → ≈62–75 px | 700 caps | accent or white |
| title (chapter head) | grotesk | cap **33–34 px → ≈46 px** | 700 caps, tracking ≈0.02 em, centred | #F7FCFF |
| big number | **mono** (JetBrains-Mono-like: dotted zero, slab 1) | cap **69 px → ≈95 px** ("1,000") | 500–600 | accent |
| value | mono | cap 26 px (tile %), 30 ("620 ms"), 36 ("100 / 100") → 36–50 px | 500 | accent |
| row/data text | mono | x-height ≈14, cap ≈18 px → **≈24 px** (log rows, table rows, terminal, IPs) | 400–500 | #E6EAF0 body, accent for codes |
| HUD metric | mono | cap 16 → ≈22 px | 400 | #BFC5CB |
| label | sans (or mono) caps, **tracked ≈0.15–0.25 em** | cap **12–15 px → ≈17–20 px** | 500–600 | #85898F |
| unit suffix | mono caps tracked | cap 18 px ("REQ / S") | 500 | #949DA2 |

- **Three families**: a heavy grotesk (caption/display/titles), a mono (all numbers, data, code, HUD metrics) and tracked-caps labels. **Every number in R1 is monospace** except display slams.
- **Text per frame**: median ≈12–20 words of on-graphic text (excluding the caption). Maximum ≈60 (request-compare cards at 104.58, signal list).
- Our v2: Inter-like sans + mono for IDs. Missing: the display tier (cap ≥96), tracked 12 px labels, and mono for big numbers (our "100%" is sans). **Tuning + font asset (mono for numerals).**

### 13. Card / panel anatomy
- **Standard panel**: fill #090D11, 1.5 px border #1F2527, **radius ≈6 px** (4 native), no shadow, **no glow**. Header = a tracked-caps label at inset (17, 17) px, cap 12–15 px, #85898F. An optional right-aligned meta in mono (e.g. "5M"). Chart panels have 2 px hairline gridlines #13171B at 1/3 intervals.
- **Metric tile** (dashboard): 334×129 px, gaps 19 (h) / 18 (v). Label (y+17), value cap 26 (y+47), progress bar at y+88: track h≈10 px #10161E, fill capsule in accent, radius = h/2.
- **Row card** (access log, signals): full-row rounded rects, h 54 (log) / 70 (signals), **fill = accent tint (#160308 red, #3A2500 amber, #0C3B42 cyan for the highlighted row), border = stronger tint (#2C1B22, #513B17, #517C8A)**, text mono. Status code in accent, path in #E6EAF0.
- **Window chrome** (browser at 0.6 and 157.6; terminal at 66.9): a browser has 3 traffic-light dots (#FF645A / #F9C745 / #4DC561), a URL pill `https://shop.example.com` in mono, and a reload glyph. The terminal title is the tracked label "COMMAND & CONTROL"; the prompt `botnet@c2 ~ %` is in purple; the block cursor is purple.
- **Device/icon card**: 217×237 px, 1.5 px purple-tint border #635A81 (lit) or grey (dim), icon ≈60 px line-filled glyph centred, label caps below + a mono sub-label ("payload").
- **No drop shadows or glows on panels anywhere.** Glow appears only on red barrier lines and car chips (≈4–6 px soft bloom).
- Ours: #151E2A cards with a 3 px coloured top bar, r≈16, big padding. **Tuning: darker fill, r 6, no top bar, 17 px label inset.**

### 14. Pills / badges / chips
- **Status pill** (HUD, "HEALTHY", "UNDER 1% LOAD", "REAL CUSTOMERS", "HUMAN"): capsule, h 33 px, tinted fill + 1.5 px tint border, tracked caps text cap ≈13 px in accent, optional 6 px leading dot.
- **Tag** ("GET /", "YOU", "NOT ENOUGH", "BLOCKED", "GATE BACKED UP", "1 ORIGIN", "LIMIT 100/s"): smaller capsule/rounded rect, h ≈27 px, tint fill; attached to a world object as a callout.
- **Data chip** (IP pills 141.73): rounded rect r≈4, **h 39 px**, pitch 75 px vertical / ≈375 px horizontal (4 columns), fill #261617–#350D14, border #3D131A, mono red text.
- **Stamp** ("BOT" 152.33): outlined red rect **420×114 px**, ≈3 px border, **rotated −3.0° (measured)**, text cap ≈30 px, the only rotated element in the video.
- Ours: outline "LIVE/IDLE/ERROR" pills ≈ ok. **Tuning** only (the stamp is a new module).

### 15. Iconography & imagery
- Icons: **filled/solid-line glyphs in one accent** (laptop, router, IP camera, DB cylinders, limiter "traffic light", lock, user), ≈45–60 px, inside a square card or bare. No multi-colour icons except three **brand logo tiles** (Cloudflare orange cloud on white, AWS Shield red, CDN purple globe) at 125.08, **117×117 px** rounded tiles (Cloudflare tile x 152–267, y 638–753).
- Illustrations: **wireframe perspective highway** (see #16) with **car chips** (rounded rects, bottom row 81×51 px, perspective-scaled to ≈20 px at the horizon, fill #390B13 + top highlight stripe #B13245 + 1.5 px red border with a soft glow; cyan variant for legit), **bar-chart skyline** (outlined rectangles, 1.5 px #2A3036 stroke, red base line), a **dotted world map** (country outlines in #1F2527, dots in accent), and **particle swarms** (≈400 purple 3–4 px dots in a rotating spiral).
- No photos. The only raster art is the mascot and the brand logos.
- Ours: none of these. **New modules: highway world, car chips, skyline, world map, particle swarm, icon set (asset).**

### 16. Lines / connectors / arrows
- **Dashed connector**: 3 px stroke (2 native), **dash 15 px / gap 10.5 px**, colour = accent at ≈45% (#504A77 purple), straight vertical runs (52.0, 54.38, 66.38, 71.75). Draws by growing along its length over 250 ms.
- **Curve fan** (109.03): 6 cubic curves, 1.5 px amber #E9AC37, from one source pill to 6 DB icons. Each draws in ≈130–170 ms, stagger ≈100 ms.
- **Barrier line**: 7.5 px core (5 native, #FB335A→#FF3A61) + ≈3 px bloom each side (measured at 13.23 s, x=360) across the road (12.75, 34.63); amber variant (27.38, 89.38); cyan "EDGE" variant (128.63).
- **Strike**: 3 px red line drawn L→R across text in 67–250 ms (HACKED? 6.5, RANDOM PACKETS 103.25, naive rule 163.63).
- **Underline**: 4.5 px red, draws R→L in 130 ms (9.77).
- Edge-to-origin lines (126.63): thin 1.5 px cyan straight lines converging on one box. **No arrowheads anywhere** (direction comes from motion). No elbows.
- Ours: slider line + dots only. **New capability: stroke-draw connectors (dashed/curved) + strike + underline.**

### 17. Charts / numbers / tables
- **Sparkline/line chart**: 3 px stroke (#6CE9FB cyan or red), no fill, no axes, hairline gridlines #13171B, tracked label top-left and a mono window tag top-right ("5M"). Variants: noisy flat (healthy), exponential curve, S-curve (155.38), spike (129.63, 160.75).
- **Big-number counter**: mono, accent, cap 69 px + a tracked unit suffix. Always animated (see §E22).
- **Progress bars**: capsule, track #10161E, fill accent; h ≈10 px (tiles), ≈60 px (uplink pipe, gradient #8A1A2E→#FF3B5C).
- **Tables**: no outer box; header row tracked caps 12 px #85898F; rows 60 px pitch separated by 1.5 px hairlines #1F2527; mono 24 px; numeric columns right-aligned; state columns recolour the entire row with a tinted fill (amber throttled, red blocked).
- **Cell grids**: 10×10 slots (48 px cells, 15 px gap, r≈4) and 60-cell / 16×N source grids. Empty = border only; filled = red tint #4A000D + border #8A3949; cyan = legit.
- Ours: percentages only. **New modules: line chart, counter, table, cell grid.**

### 18. Data realism
Consistent fictional domain **shop.example.com** carried through the whole video (browser URL, skyline label "ORIGIN · SHOP.EXAMPLE.COM", terminal `attack --target shop.example.com --now`). RFC-5737 documentation IPs (198.51.100.x, 192.0.2.x, 203.0.113.x). Real-looking HTTP: `GET /product/42 HTTP/1.1`, `Host:`, `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121`, status codes 503/504 `GATEWAY TIMEOUT`. Specific numbers that stay consistent: 1,000 req/s baseline, 38 ms → 42 ms latency, 10 Gb/s uplink vs 200 Gb/s attack, 1,240,000 devices / 214 countries, 40,000 req/s to /search, 908 ms CPU, 182 bytes, 6 queries, 280 Tb/s edge, 300+ PoPs, "FIRMWARE 2019.4", "LAST SEEN 0s AGO". **Numbers re-appear across scaffolds** (1,240,000 at 56, 62.9 and 142; 908 ms at 111 and 113.9).
Ours: i-0a3f8c21 IDs, v2.0.4, listener :443. Similar quality but fewer numbers per scaffold. **Storyboard tuning (the LLM prompt must demand 3–6 specific consistent numbers).**

### 19. Background
Pure black + a 60 px dot grid with an elliptical luminance mask + a faint teal centre glow (#000A0B). **Static for all 176 s**: dot positions are identical at 0.9 / 39.68 / 120.62 / 153.7 (m3). No noise, no vignette beyond the mask. A 1.5 px divider hairline appears when a title/tab strip is present.
Ours: blue-grey gradient + olive corner wash, no grid. **Tuning (bg shader) — high visual impact for low cost.**

## D. Module catalog (item 20)

Measured at native and reported @1080. "Reuse" = the times the module appears. Every module is built from the same tokens (§C): surface #090D11, 1.5 px border #1F2527, r 6, tracked 12–15 px labels, mono data, one semantic accent.

| # | module | anatomy (measured) | variants / states | data carried | reuse |
|---|---|---|---|---|---|
| M1 | **HUD bar** | 960×70 at (60, 235); label + status pill + right mono metrics | pill: OK / DEGRADED / OFFLINE / SATURATED / FILTERING / FILTERED | service state, rate, latency | whole video (≈16 flips) |
| M2 | **Caption box** | §10 | 3-tone karaoke | narration | whole video |
| M3 | **Mascot** | 220×781 animated cartoon, feet at y 1320 | scale 1.0 / 1.19 / 1.175 / 1.267; hidden | — | 70% of runtime |
| M4 | **Title slot** | centred caps, cap 33 px, y 382–416, + a 3 px divider at y 424 | white; accent (BOTNET purple, cap 42) | chapter question/claim | 12× |
| M5 | **Display slam** | 2-line caps/digits, cap 96–135 px, right-aligned at x 1020, top ≈y 725 | white ("A DDOS ATTACK", "THEY BLOCK THE ROAD"), red ("5,000,000 req/s", "200 Gb/s", "VS A LOT"), purple ("100,000 DEVICES"), grey ("NOTHING") | the one number/claim of the beat | 7× (9.3, 42.43, 74.03, 83.83, 114.5, 175.75; "NOTHING VS A LOT") |
| M6 | **Perspective highway world** | trapezoid road: top edge y 620 (x 426–653), base y 1179 (x 108–971); 5 lanes; dashed lane lines 1.5 px #2A3036; fill gradient #080C10 → #1C2026; horizon **bar-chart skyline** (outlined bars, 1.5 px #2A3036) + label "ORIGIN · SHOP.EXAMPLE.COM" (tracked, cap 12, #85898F) | empty; cyan flow; red flood; mixed/sorting (cyan/red/amber); close-up (push-in) crop; wide | traffic, congestion, filtering | **15 scaffolds** (7.1–35.5, 50.9, 77.4, 85–91, 116–120, 128–134, 157–168, 172–176) |
| M7 | **Car chip** | rounded rect, base row 81×51 px (54×34 native), r≈9; fill #390B13, top highlight stripe #B13245, 1.5 px border #FF3B5C with ≈3 px bloom; perspective-scaled to ≈20 px wide at the horizon; 5 per row | red (attack), cyan (legit, "YOU"), amber (uncertain) | one request | inside M6 |
| M8 | **Barrier line** | 7.5 px core (5 native) #FB335A→#FF3A61 + 3 px bloom, spans the road width, often with a tag | red (blocked), amber ("GATE BACKED UP"/"THE JAM IS HERE"), cyan ("EDGE") | a choke point | 7× |
| M9 | **Callout tag** | capsule h≈27–33 px, tinted fill, tracked caps 12–13 px, sits beside a world object | cyan "GET /", "YOU", "HEALTHY"; red "BLOCKED", "NOT ENOUGH", "NO SLOT", "ATTACK"; amber | a label on an object | ≈25× |
| M10 | **Browser window** | panel r 6 with a 3-dot chrome (#FF645A/#F9C745/#4DC561) + mono URL pill + reload glyph; body = 2×3 product-card grid with cyan underline bars | loaded / dimmed / spinner / "This site can't be reached" / ticket countdown `00:03 → 00:00` + cyan "Get tickets" button; mini (scale 0.256, top-right) | the user's view of the site | 4× (0.6, 31.17, 157.63) |
| M11 | **Metric dashboard** | chart panel 690×155 (sparkline 3 px) + big mono number cap 69 + unit + 2×2 tiles 334×129 (label / value cap 26 / 10 px capsule bar) + status pill | healthy cyan ↔ saturated amber (1-frame global recolour) | req/s, CPU, net, conns, queue | 35.9–43.4 |
| M12 | **Resource bars** | 2 tiles (NETWORK / PROCESSOR) + a full-width UPLINK pipe (h ≈60 px, gradient #8A1A2E→#FF3B5C) + red sub-caption mono "200 Gb/s arriving" | fill 0→100% | utilisation | 43.5, 80.25 (pipe variant + dashed-red overflow box) |
| M13 | **Cell grid** | square cells 48 px, gap 15, r≈4; empty = 1.5 px border only; filled = red #4A000D + border #8A3949; counter "60 / 60", "100 / 100" mono red above/below | 60-cell, 100-slot (10×10), 16×N source grid (1.24 M) | capacity slots | 46.25, 92.75, 141.88 |
| M14 | **Row list / log** | rows 690×54 px, pitch 61.5, r 6, red-tint fill #160308 + border #2C1B22; mono `503  GET /cart` (code in red, path in #E6EAF0); a highlighted row in cyan tint #0C3B42 / border #517C8A | access log (7 rows), signals list (rows 70 px, amber tint #3A2500, the last row red), route list | logs, signals | 48.1, 99.6, 144.6 |
| M15 | **Data table** | no outer box; tracked header row; 60 px row pitch; 1.5 px hairlines #1F2527; right-aligned numeric columns; the whole row recolours on a state change (amber "throttled", red "blocked"); inline pill growth ("40,000/s" red capsule) | ROUTE/COST/RATE, SOURCE/RATE/ACTION | per-row metrics | 104.75, 135.75 |
| M16 | **Icon card** | 217×237 px, 1.5 px border (#635A81 lit / grey dim), ≈60 px solid glyph, caps label + mono sub-label | dim → lit (purple) | device type | 59.9, 65.1, 71.4 |
| M17 | **Status/spec card** | panel with tracked label ("STATUS", "ARRIVING AT ORIGIN", "ORIGIN LOAD", "COMPUTATION", "COST OF ONE REQUEST", "EDGE DECISIONS", "SORTING ERRORS", "NAIVE RULE", "RULE 1") + 1–3 mono value lines, optional red strike | many | key/value facts | ≈15× |
| M18 | **Terminal** | panel with the tracked title "COMMAND & CONTROL", purple prompt `botnet@c2 ~ %`, white mono command, purple block cursor; typewriter | — | a command | 66.9 |
| M19 | **Particle swarm** | ≈400 purple #A77BFB dots 3–4.5 px arranged in a rotating 2-arm spiral, ≈690×520 px, bleeds off the right edge; optional purple frame (1.5 px) + "BOTNET" title + SOURCES counter | scatter → spiral → brighten; shockwave ring (elliptical 1.5 px lavender, expands linearly ≈1,500 px/s) | device count | 56.1, 68.0, 73.3 |
| M20 | **World map** | dotted/outlined continents #1F2527 in a 960×330 panel; accent dots (purple compromised, cyan PoPs) | dimmed-as-background variant | geography | 62.25, 64.6, 121.75 |
| M21 | **Line chart** | panel + 3 px stroke, hairline grid, window tag; ease-in stroke draw | noisy flat, exponential, S-curve, spike | trend | 37.25, 41.0, 129.6, 155.4, 160.75 |
| M22 | **Counter** | mono number + tracked unit, in any panel or standalone | ease-out count-up; ease-in (exponential) escalation; jitter (confidence 83/87/84/91/88/85) | any quantity | ≈20× |
| M23 | **Tab strip** | §8 | active amber | chapter | 76.9–111.9 |
| M24 | **Compare cards** | 2 side-by-side panels (LEGITIMATE / MALICIOUS) with mono HTTP headers, + a DIFFERENCE row of 4 key/value cells, the last in red | crossfade to a "RANDOM PACKETS" lightning card + strike | request diff | 100.9 |
| M25 | **Fan diagram** | a red "1 REQUEST" pill → 6 amber 1.5 px cubic curves → 6 DB glyphs with mono ms labels | stroke-draw stagger | fan-out | 107.6 |
| M26 | **Seesaw** | 1.5 px beam with a pivot square, tilting continuously; 2 cards (ATTACKER "182 bytes", YOUR SERVER "908 ms CPU" red) | tilt left/right | asymmetry | 111.9 |
| M27 | **Layer diagram** | 3 labelled tiers (ORIGIN / EDGE 300+ POPS / INTERNET) with 12 cyan outline boxes, converging 1.5 px lines, and a summary bar "EDGE 280 Tb/s · ORIGIN 10 Gb/s" | stagger L→R | architecture | 125.25 |
| M28 | **Logo tiles** | 3 panels, each with a tracked label + a 117 px square brand tile (Cloudflare, AWS Shield, CDN globe); an outline box draws around the group | pop per brand word | vendors | 120.9 |
| M29 | **IP chip grid** | 4 columns × 4 rows of red data chips h 39, stagger 52 ms + BLOCKLIST counter card | — | blocked IPs | 139.9 |
| M30 | **Stamp** | red outlined rect 420×114 px, 3 px border, tilt −3°, caps "BOT" | slam | verdict | 152.33 |
| M31 | **Limiter icon** | vertical 3-light glyph (dark cells, one lit), "ONE AT A TIME" label | red → cyan | rate limiting | 134.25 |
| M32 | **DDoS mark** | "D" in a purple outlined box + "DoS" + purple "DISTRIBUTED" + 3 dashed purple verticals | — | acronym breakdown | 52.13 |
| M33 | **Lock pill / intact card** | red lock "HACKED?" pill; skyline with "ORIGIN INTACT / NOT COMPROMISED"; cyan pill "WALLS UNBROKEN · DATA CLOSED" | dim/strike | negation | 170.4 |

**Combination rules observed**: ≤1 world (M6/M19/M20) per frame as the back layer; ≤2 panels over a world, placed in the right column or top-right corner; a display slam (M5) replaces panels rather than overlapping them (except over a dimmed world/swarm); tags (M9) attach to world objects; M1/M2/M3 are always on top.

**Our v2 has M1 (reduced), M2, M3 (frozen), and 3 bespoke modules (ALB slider, target-group card, instance row).** R1 uses 33 distinct modules in 177 s (≈11 per minute of new visual vocabulary).

## Layout templates (item 4) — exact geometry @1080

| id | template | geometry | used at |
|---|---|---|---|
| T1 | **Mascot + right panel stack** | mascot 21–240; panels x 330–1020, first panel top ≈521–540, stack gap 18–19; optional title y 382 | 0.6 browser, 35.9 dashboard, 48.1 log, 55.3 source chain, 65 router, 92.75 slots, 153.9 charts |
| T2 | **Mascot + world** (road/swarm) | world full-width behind (road top y 620, base y 1179); callouts on the world; optional panel top-right (x ≈690–1020, y ≈400–560) | 7.1–35.5, 57–60, 68–76, 116–120, 128–134, 157–163 |
| T3 | **Mascot + display slam** | display right-aligned at x 1020, 2 lines, ink y ≈725–1030; the world or panel behind is dimmed to ≈35% | 9.3, 42.43, 74.0, 83.8, 175.75 |
| T4 | **Mascot + title + centred object** | title y 382 centred; object in the right column centred on x≈700 (e.g. limiter 462–886) | 134.25, 168.5 |
| T5 | **Full-width title + 2 tiles + wide bar** (no mascot) | x 60–1020; tiles 2 × 465 wide; bar full width | 43.5, 104.75 |
| T6 | **Full-width grid/map** (no mascot) | x 60–1020, y 382–1254 | 62.25, 120.6, 141.9 |
| T7 | **Tab strip + right content** | tabs y 423–489 full width; heading right column y ≈600–730 | 76.9–111.9 |
| T8 | **Two-column compare** (no mascot) | 2 panels 465 wide + 30 gap, then a full-width diff row | 100.9, 111.9 (seesaw) |
| T9 | **Full-width world + bottom stat strip** (no mascot) | world full-width; stat strip panel x 60–1020, **y 1142–1236 (94 px)**, one mono amber line centred; an error panel top-left (x 60–≈530) | 164.25–168.2 |
| T10 | **Blank + mascot + title** (breath) | only mascot + title; 1–2 beats | 115.9, 153.6, 168.25 |

## E. Motion system (items 21–27)

Method: native 30 fps frames extracted with ffmpeg (`fr/<tag>/`). The tracked property is measured per frame (bbox edge, width, p99.5 luminance, pixel count). The curve is fitted by `fit.py` against ease-in/out/in-out power 1–5 (RMSE on the normalised series; "linear rmse" is given for contrast). Distances are px @1080 (native ×1.5).

### Measured events (17)
| # | event (t) | property | per-frame series (native) | travel | duration | easing (fit) | notes |
|---|---|---|---|---|---|---|---|
| 1 | Mascot intro (0.067–0.40) | x (right-shoe edge) | 17, 47, 73, 92, 108, 121, 131, 139, 144, 148, 153 → Δ 30, 26, 19, 16, 13, 10, 8, 5, 4, 5 | ≥204 px (from off-left) | 11 f = 367 ms | **ease-out quad** (rmse .027 vs linear .187) | no fade, no overshoot |
| 2 | Mascot punch (9.20) | height (feet-anchored scale) | 520 → **617** (1 frame), then 622, 632, 640, 646, 650, 653, 656, 656, 658 | ×1.19 snap, then to ×1.267 | 1 f + 9 f = 333 ms | snap + **ease-out quad** (rmse .032) | returns in 1 frame at 10.55. 39.83 and 175.02: pure 1-frame snaps to ×1.175 |
| 3 | Browser→corner camera morph (7.03–7.47) | width of the browser content, top y | width 356, 355, 352, 346, 333, 313, 282, 236, 182, 145, 121, 106, 97, 93, 91; top 462 → 271 | scale 1 → **0.256**, up 287 px; right edge fixed (x 858) | 14 f = 467 ms | **ease-in-out cubic** (rmse .020 vs .131) | the road + cars reveal under it during f4–f9 (red-px count 39 → 4939) |
| 4 | Push-in on "your car" (28.63–29.37) | car width / top y | w 74 → 92; top 675 → 599 (Δ ≤8/frame, peak mid) | scale **1 → 1.24**, up 114 px | 22 f ≈ 733 ms | **ease-in-out quad** (rmse .065) | starts 600 ms *after* the 28.00 cut: cut → hold → push |
| 5 | Access-log rows (49.17–49.90) | row text left x, row p99 lum | x 241 → 238 → 236 → 235; lum 78, 136, 197, 211, 222, 227 | 9 px slide from the right | 5 f = 167 ms per row | **ease-out ~p2.5** (rmse .036) | **stagger: onsets f8, 10, 12/13, 15, 18, 21 → 67–100 ms (mean 87 ms)**; 7th (highlight) row at f29–31 grows full-width in 3 frames |
| 6 | NETWORK bar fill (43.83–44.50) | bar right edge | 67, 104, 139, 169, 195, 219, 241, 259, 275, 289, 300, 309, 317, 323, 329, 331, 333, 335, 336, 337 | 428 px | 20 f = 667 ms | **ease-out p2.5** (rmse .020 vs .228) | the UPLINK bar starts **+2 f (67 ms)** later: 17 f, ease-out p2.5 (rmse .016) |
| 7 | Title fade-in "WHERE DOES…" (51.17–51.40) | p99.5 lum | 17, 82, 129, 174, 207, 240, 252, 255 | opacity 0→1 | 7 f = 233 ms | **ease-out quad** (rmse .013) | title only; the scaffold stays |
| 8 | Display pops "200 Gb/s" (83.73), "5,000,000" (42.43) | p99.5 lum | 136 → 255 (1 f); 5M: 221 → 250 → 255 | opacity | **1–2 f (33–67 ms)** | step | hard pop, no scale; the panel beneath fades out 243, 203, 156, 123, 89, 70, 61, 41 = **7 f / 233 ms ease-out p1.5** |
| 9 | BOT stamp slam (152.37–152.53) | stamp width (final 280 native = 420 px) | 283, 259, 255, 263, 273, 279, 279, 280 | scale 1.01 → **0.91 (squash)** → 1.00 | 6 f = 200 ms | spring (undershoot 9%, 1 cycle) | constant tilt −3.0°. The only spring in the video |
| 10 | Shockwave ring (69.73–70.10) | ring diameter | 44, 148, 244, 332, 412, 488, ~560+ (off the swarm) | 66 → 840+ px | ≈11 f ≈ 370 ms | ≈linear with slight decel (Δ 104 → 72) | elliptical (h:v ≈1.45), 1.5 px lavender, fades as it grows; swarm dots brighten f10–f14 |
| 11 | S-curve chart draw (155.37–155.90) | line tip x | Δ/frame 2, 2, 4, 4, 6, 9, 10, 13, 16, 20, 22, 16, 18, 20, 38, 47 | full panel 690 px | 16 f = 533 ms | **ease-in p2.5** (rmse .028) | 2nd chart starts 155.97 (**stagger 600 ms**) |
| 12 | Device cards light (60.30 / 60.97 / 61.57) | card blue mean | 14.4 → 18.1, 20.1, 22.3, 23.5, 25.0, 26.0 | recolour dim → purple | 6 f = 200 ms each | ease-out ~quad | **stagger 667 / 600 ms, set by words**; leads "computers/routers/cameras" by 460 / 310 / 130 ms |
| 13 | IP chips cascade (140.02; 140.35–140.92) | chip red mean | onset frames 15, 16, 18, 20, 21, 23, 24, 26, 28, 29, 31, 32, 34, 35, 37; each 0.3 → 28 → 70 → 76 | opacity | 2 f per chip | step-ish | **row-major stagger 52 ms (1.57 f)**, 15 chips in 733 ms |
| 14 | HUD/state flip (9.20, 39.83) | pill fill, big-number colour | #3A2700 → #410911 (1 f); #053C47 → #462800 and #69DFF3 → #EFBA59 (1 f) | recolour | **1 f** | step | 39.83 recolours *every* value on screen + snaps the mascot scale in the same frame |
| 15 | Scaffold hard cut (46.23) | content-zone mean lum | 16.69 → 4.00 (1 f) | — | 1 f | step | the new content then fades in 67 ms (2 f) |
| 16 | Caption chunk swap (9.20, 10.57, 11.60, 12.57) | box ink width | blank 1 f → 479 → 492 → 485 (9.23–9.30); 466 → 475 → 472 → 468 (10.60–10.70) | scale ≈+2–3% overshoot | 1 f out + 3 f in = 133 ms | pop with a small overshoot; border < full opacity for 2 f | karaoke word switch lags the whisper word start by +50…+320 ms (median ≈+190 ms, n=12, 9.2–13.3 s) |
| 17 | Ending (176.27–176.83) | content mean lum | 31.0 → 28.9 → 25.1 → 21.5 → 20.0 → 18.6 → 18.3 | dim to ≈60% | 11 f = 367 ms, ease-out | ease-out p1.5 | then a **hard cut to black at 176.833** |

Counters (from the visual log's 30 fps strip reads, not re-measured here). ON-RAMP 8,211 → 400,000: ≈1,150 ms, **ease-out**, the digits change every frame. The escalation 1,000 → 1,000,000 (40.25–42.40) is **ease-in/exponential** over 2,150 ms. 0 → 1,000 req/s: 500 ms ease-out. Device counter 80,844 → 1,240,000: 2,100 ms. Confidence jitter: 6 values over 750 ms.

### 21. Entrance recipes
- **Panels / cards / rows**: opacity 0→1 over **133–200 ms ease-out (p2–2.5)** plus an optional **9 px** slide (from the right for list rows). No scale. Siblings stagger **50–100 ms** (chips 52, log rows 87, tabs ≈83, PoP boxes ≈40).
- **Titles**: opacity-only, **233 ms ease-out quad**.
- **Display slams / big numbers**: **1–2 frame hard pop**; the preceding panel fades out underneath over 233 ms.
- **Strokes (charts, connectors, strikes, underlines)**: length reveal. Charts **533 ms ease-in**; dashed connectors ≈250 ms; strike/underline 67–250 ms; fan curves 130–170 ms each with a 100 ms stagger.
- **Bars**: **667 ms ease-out p2.5**; a second bar lags by 67 ms.
- **Mascot**: slide from off-left, 367 ms ease-out quad.
- **Worlds**: crossfade-in over 130–250 ms (cars fade in row by row, ≈400 ms).

### 22. State-change recipes
| change | recipe | measured |
|---|---|---|
| status pill flip | 1-frame fill + text swap | 9.20, 39.83 |
| global severity recolour | every accent value on screen swaps cyan→amber/red in 1 frame, together with the HUD pill and a mascot scale snap | 39.83 |
| card light-up | dim grey → accent over 200 ms ease-out | 60.30 |
| row state (table) | the whole row fill tints amber → red, 130 ms; the value counts down (9,480 → 100/s in 400 ms) | 136.25–138.63 |
| counter | ease-out count-up (0.5–1.2 s), ease-in for "exponential", jitter for "uncertain" | §counters |
| text/strike | a 3 px red strike draws L→R in 67–250 ms; the struck item then dims | 6.5, 103.25, 163.63 |
| cell fill | cells flip red progressively (60 cells in 600 ms; 82 cells in 650 ms) | 46.38, 96.25 |
| recolour of world objects | cars recolour cyan/amber in place, 130 ms | 131.13, 165.5 |

### 23. Emphasis recipes
- **Mascot scale punch** ×1.175–1.267 (snap, or snap + 300 ms ease-out), 4 uses.
- **Stamp squash** (1.01 → 0.91 → 1.0 in 200 ms, −3° tilt), once.
- **Shockwave ring** + dot brighten (370 ms), once.
- **Highlight row / selection box**: a cyan tint row or a cyan outline box drawn around an object in 100–130 ms (49.9, 29.38).
- **Glow**: only on the red barrier and car chips (static bloom, not pulsing).
- **No pulsing, breathing or idle wobble** on any graphic. The only idle motion is the mascot's face animation.

### 24. Exit & scene transitions
- **≈90% of the 52 scaffold changes are 1-frame hard cuts** of the content layer (46.23 measured: lum 16.7 → 4.0 in 1 f). HUD, background, caption and (usually) the mascot persist. The new scaffold then builds with staggered 67–233 ms fades.
- **Element exits**: panels fade out over 233 ms when a display slam replaces them (42.43); titles are removed in 1 frame (1.75, 14.75, 117.38).
- **Continuous camera transitions**: only 3 (7.03 morph, 28.63 push, 131.1 zoom-to-road), plus the 30.75 pull-back cut.
- **Caption between sentences**: dims, then is blank for 1–5 frames.
- **End**: 367 ms dim to 60%, then a cut to black.
- Ours: scaffold swaps are crossfade/rebuilds (not re-measured here); **our chrome is persistent too.** Gap: our scaffolds are *replaced* 2× in 17.7 s; R1 averages one per 3.4 s. Fix: storyboard density (tuning) + hard-cut transition primitive.

### 25. Process / ambient motion
- **Car flow**: cyan cars move continuously up the road (16.63–22.3, 164.25–168.2). Per-car speed is perspective-scaled; each lane has its own phase; the flow never stops during holds.
- **Swarm rotation**: the spiral rotates continuously (57.0–60, 68–71, 74.25–76.6).
- **Typing**: `attack --target shop.example.com --now` in ≈900 ms (≈24 chars/s). The cursor block stays lit.
- **Counters as hold-fillers**: every hold >1.5 s has a running counter, flow or rotation (visual log §2).
- **Motion density (measured, content zone excl. caption, diff >0.15 on 180×320 gray)**: **R1 31% of frames have motion, longest still 2.6 s, 31 stills >1 s in 177 s (10.5/min). Ours: 14% of frames have motion, longest still 2.57 s, 5 stills >1 s in 17.7 s (17/min).** Ours is still twice as often (per minute) and has half the moving-frame share.

### 26. Camera
3 camera moves in 177 s, all on the highway world: morph/zoom-out **467 ms ease-in-out cubic** (scale 1 → 0.256 for the browser); push-in **733 ms ease-in-out quad ×1.24** after a 600 ms hold; zoom-to-road at 131.1 (cut + recolour). The mascot is never affected by the camera. Ours: none. **New capability: world-layer camera (scale/translate) independent of chrome.**

### 27. Choreography
- **Build order** inside a scaffold: title (if any) → container/world (130–250 ms) → items L→R / top→bottom (50–100 ms stagger) → numbers start counting → tag/verdict last (typically 0.5–1.5 s later, on its word).
- **Front-loaded**: 60–70% of a scaffold's elements arrive within the first 600 ms; the remaining beats are *mutations* (recolour, counter, strike, highlight), not new elements.
- **Holds keep moving** (#25).
- **Word-driven staggers for enumerations** (device cards 600–667 ms apart, tracking the words); **fixed staggers (50–100 ms) for non-verbal sets** (chips, rows, cells).

### Motion spec table (element class → recipe)
| class | props | distance | duration | easing | stagger | trigger |
|---|---|---|---|---|---|---|
| panel/card | opacity | 0 | 133–200 ms | out p2.5 | 67–100 ms | word −130…−460 ms |
| list row | opacity + x | +9 px from the right | 167 ms | out p2.5 | 87 ms | first word, then fixed |
| chip/pill/cell | opacity | 0 | 67 ms | step | 52 ms | fixed cascade |
| title | opacity | 0 | 233 ms | out quad | — | word |
| display slam | opacity | 0 | 33–67 ms | step | lines together | 0.2–0.3 s before the word |
| bar fill | width | to value | 567–667 ms | out p2.5 | 67 ms | word |
| counter | value | — | 500–2,150 ms | out (or in for exponential) | — | word |
| line chart | stroke length | panel width | 533 ms | in p2.5 | 600 ms between charts | word |
| connector/strike/underline | stroke length | — | 67–250 ms | linear-ish | 100 ms | word |
| state flip | colour | — | 33 ms (1 f) | step | all together | word |
| card recolour | colour | — | 200 ms | out quad | word-spaced | word |
| stamp | scale | 1.01 → 0.91 → 1.0 | 200 ms | spring 1 cycle | — | 0.3–0.5 s before the word |
| ring | scale + opacity | 66 → 840 px | 370 ms | ≈linear | — | word |
| mascot intro | x | ≥204 px | 367 ms | out quad | — | t=0.067 |
| mascot punch | scale (feet anchor) | ×1.175–1.267 | 1 f (+300 ms out quad) | step (+out) | — | slam/title word |
| camera morph | scale + translate | ×0.256, 287 px | 467 ms | in-out cubic | — | word |
| camera push | scale | ×1.24 | 733 ms | in-out quad | after a 600 ms hold | — |
| scaffold swap | cut | — | 1 f | step | — | sentence start |
| caption chunk | opacity + scale | +2–3% | 1 f blank + 3 f | pop | — | chunk start |

Our v2 (measured on `v2-bluegreen-2.mp4`, same diff method; note `evidence/OURS.visual_log.md` describes an older render): 26 motion runs in 17.7 s, and **22 of 26 last 1–3 frames (33–100 ms)**. The only longer ones are the 0.03 s intro (12 f), 14.3 s (7 f) and a 15.7 s slider travel (15 f). Entrances are therefore *shorter* than R1's 133–233 ms fades, and nothing counts, draws or cascades; no stroke draws, no counters on screen, no camera, no mascot motion, no staggers >3 items. **Tuning is mostly done. The gap is capabilities: counters, stroke-draw, cascade staggers, world camera, state flip.**

## F. Timing & narration sync

### 28. Beat density
- Machine (`stats_excl.json`): **275 beats, 93.3/min**. Gap median **517 ms** (p25 233, p75 867, p90 1,390, max 3,833). Gap histogram: <200 ms 60 · 200–400 50 · 400–700 66 · 0.7–1 s 45 · 1–2 s 45 · 2–3 s 7 · 3–5 s 1. Beats per 10 s window 11–19 (never below 11). Settle median 133 ms. peak_pos median 0 (ease-out).
- Visual log: 236 beats (79.7/min), 52 scaffold states, **mean scaffold lifetime 3.4 s** (median ≈2.8; the longest are the 13.1 s highway world and the 9.0 s signals list). ≈4.5 beats per scaffold.
- **Build vs hold**: 43% of runtime sits in holds >1 s and 11.6% in holds >2 s, but every hold >1.5 s carries continuous motion (flow, counter, rotation, typing). Measured moving-frame share: **31%** (ours 14%).
- Ours v2: 26 motion runs in 17.7 s (88/min, similar), but only 2 scaffolds in 17.7 s and 14% moving frames. **Gap: mutations per scaffold and hold-fillers, not beat count.**

### 29. Word anchoring
- 76% of beats land within ±0.3 s of their word; +9% are offset 0.3–0.9 s; 15% free-running (visual log §3.4).
- **Measured lead** on enumerations: device cards light **460 / 310 / 130 ms before** "computers / routers / cameras"; IP chips start 140 ms before "IP". Display slams lead by ≈0.25 s ("200 Gb/s" 83.73 vs "two hundred" 84.08; "5,000,000" 42.43 vs "five" 42.66). The BOT stamp (152.37) leads "human" (152.80) by 430 ms.
- **Caption karaoke lags whisper word starts by a median ≈+190 ms** (+50…+320, n=12). Graphics therefore run ≈0.3–0.6 s ahead of the caption highlight: the picture arrives, then the word lights.
- Scaffold cuts happen on the **first word of a sentence** (46.23 "pile", 120.6 "Services", 153.63 "And here's").
- Ours: storyboard anchors on words with a fixed small lead. **Tuning: default lead −250 ms for slams, −130…−460 for enumerations; cut on sentence start.**

### 30. Sentence type → treatment rules (observed)
| sentence type | treatment | examples |
|---|---|---|
| hook question / chapter question | blank + title slot (+ mascot ×1.19) | 0.33, 35.63, 51.25, 116.13 |
| definition / name reveal | display slam + mascot punch + underline | 9.30 "A DDOS ATTACK" |
| enumeration (3–6 items) | one pop/light per item, word-spaced | 60.3 devices, 121.25 logos, 147.6 signals |
| number / magnitude | counter (ease-out) or display slam for the headline number | 23.9, 37.5, 42.43, 83.83 |
| escalation ("then 10k, 100k, a million") | ease-in counter + a global recolour to amber/red + mascot punch | 39.83–42.4 |
| negation / "not X" | red strike through X, or X dims + a cyan counter-pill | 6.5 HACKED?, 163.6 naive rule, 171.1 |
| cause → effect / flow | cars flowing, connectors drawing, fan curves | 16.6, 109.0 |
| state ("the server is overwhelmed") | HUD pill flip + recolour | 9.13, 25.75, 31.88 |
| comparison / asymmetry | two cards side by side + a seesaw + "NOTHING VS A LOT" | 100.9, 111.9 |
| analogy | persistent world (highway) re-used across chapters | 15 scaffolds |
| verdict | stamp / tag | 152.33 BOT, 98.0 NO SLOT |
| rule / advice | rule card + strike when refuted | 118.0, 161.9 |

## G. Narrative / storyboard

### 31. Structure
- **Hook (0–3 s)**: title "HOW A DDOS ATTACK WORKS" at 0.33 over a browser, mascot slides in 0.067–0.40, 4 beats in 0.5 s, first joke ("refresh… nothing") by 3.5 s.
- **Acts**: (1) symptom → reframe as a traffic jam (0–35 s); (2) technical mechanics: dashboard, resources, logs (35–51); (3) where it comes from: botnet, malware, C2 (51–76); (4) three attack types, chaptered by tabs (76–112); (5) defenses: edge, rate limiting, signals (116–153); (6) why it's hard: false positives (153–170); (7) resolution: "not hacked, blocked" callback (170–177).
- **Escalation**: severity is carried by the HUD (OK → DEGRADED → OFFLINE) and by number magnitudes (1,000 → 5,000,000; 10 Gb/s → 200 Gb/s; 1 → 1,240,000 devices).
- **Ending (last 5 s)**: callback to the opening "HACKED?", then the highway flooded red + barrier + HUD OFFLINE + mascot punch + display slam "THEY BLOCK THE ROAD" → dim → cut to black. **The last 5 s re-use the first world (bookend).**

### 32. Scaffold selection & transitions
- **≈17 scaffold changes/min** (one per 3.4 s). Kept-and-mutated when the sentence continues the same system (highway 14.85–27.95 mutated 14×; dashboard healthy → saturated by a 1-frame recolour). Replaced when the *question* changes.
- **Callbacks**: the highway world returns 6 times across chapters (7.1, 50.9, 85, 116, 128, 157, 172); HACKED? returns at 170.4; 1,240,000 appears 3×; 908 ms 2×.
- Ours: 2 scaffolds per 17.7 s ≈ 6.8/min. **Storyboard tuning: target a new scaffold or major mutation every 3–4 s, plus a world scaffold that is re-used as a recurring metaphor.**

### 33. Entity continuity
- **Colour = role for the whole video**: cyan = you/legit/OK, red = attacker/error, amber = warning/uncertain/active chapter, purple = botnet/distributed. Never swapped.
- **Names**: shop.example.com, ORIGIN (HUD label = skyline label = layer-diagram tier), YOU/"your car" (always a cyan chip, always bottom-centre of the road).
- **Positions**: the origin/city always sits at the top of the road (y ≈620 px); users come from the bottom; the mascot is always on the left.
- Ours: blue/green are deployment names, not roles; OK. **Rule to adopt: a storyboard-level entity→colour map validated across scaffolds.**

## H. Audio

### 34. Voice
Single male-sounding narrator (timbre not objectively measurable here), **212 wpm** (624 words / 176.5 s). Very short pauses: the median pause >150 ms is **220 ms**, the max 600 ms; the inter-sentence gap median is **190 ms** (p90 350 ms). No breaths are audible in the RMS trace (5th-percentile 50 ms RMS = −33 dBFS). Emphasis is carried by pitch, not pause (not assessable numerically without pitch tracking).
Ours: not measured here (no ASR for v2). **Check that our TTS runs ≥200 wpm with ≤250 ms sentence gaps.**

### 35. Music / SFX / mix
- **Integrated −14.2 LUFS, LRA 1.4 LU, true peak −0.5 dBTP** (ffmpeg ebur128 on R1). Ours: **−17.1 LUFS, LRA 2.1, TP −3.2** → ours is 3 dB quieter.
- **A music/ambient bed is present**: RMS inside 22 word gaps >250 ms averages **−21 dBFS** (min −29, max −16) vs a speech median of −18.4. The track never falls below −41 dBFS (1st percentile). Gap spectrum: 22% <200 Hz, 46% 200–2 kHz, 33% >2 kHz (bed + reverb tails).
- **SFX**: not reliably assessable from the mix. There is a +18 dB >4 kHz burst at the BOT stamp (152.33) and +7 dB at the pipe swap (83.43), consistent with hit SFX, but the slam at 9.2, the hard cuts at 46.23/120.6 and the 5M pop show no transient. Conclusion: SFX are at most sparse.
- Fix: **tuning** (loudness target −14 LUFS, TP −1) + bed level ≈−8 to −10 dB under the voice.

## I. Production

### 36. Export
Source (Instagram re-encode): **720×1280, 30 fps CFR, H.264 High yuv420p ≈326 kb/s, HE-AAC ≈56 kb/s, 176.98 s**. Original master resolution unknown (every edge is crisp at 720, with no upscale artefacts; likely authored at 1080×1920 or 720×1280 and platform-compressed). Everything is flat vector UI + one animated character + particles: **deterministic and cheap to render** (no blur, no 3D, no video footage except the mascot layer). Ours: 1080×1920 30 fps H.264 High ≈323 kb/s + AAC-LC 127 kb/s. Match; nothing to change except the audio loudness.

## Gap matrix (all 36 items): R1 vs our v2

Fix class: **T** tuning · **M** new module · **C** new capability · **A** asset · **S** storyboard/LLM prompt · ✓ match.

| # | item | R1 | our v2 | fix |
|---|---|---|---|---|
| 1 | safe zones | HUD top 235, content 382–1320, caption 1416–1532, bottom 20% empty, margin 60 | HUD 214, content to 1380, margin 44 | T |
| 2 | columns | mascot 21–240 / content 330–1020, right-align axis 1020; 1-col when the mascot is hidden | fixed 2-col | T + C |
| 3 | content bbox | 25% of area, centroid 45%, 2–5 modules | one 33% card | S + M |
| 4 | templates | 10 (T1–T10) | 2 | M |
| 5 | hierarchy | cap ratio 8 : 5.7 : 2.2 : 1 | ≈3.3 : 1, no display tier | T |
| 6 | spacing | 60 px grid, rows 54–70 with 7–14 gaps | 168 px row pitch | T |
| 7 | HUD | 960×70 @235, #090D11, pill state machine + metrics | static LIVE/OK, no metrics | T + C |
| 8 | chapters | tab strip + title slot + divider | none | M |
| 9 | mascot | animated talking character, 41% height, scale states, hidden 30% | frozen sticker, 18% height | A + C + T |
| 10 | captions | 117 h, 66 px font, 3 px white border, 7.5 px cyan hard shadow, 3-tone | same recipe, 60 px | T (✓ mostly) |
| 11 | palette | #000 + dot grid; surface #090D11; semantic cyan/red/amber/purple | blue-grey gradient, #151E2A cards, blue/green | T |
| 12 | typography | grotesk display cap 96–135, mono for all numbers, 12 px tracked labels | no display tier, sans numbers | T + A (mono) |
| 13 | panels | r 6, 1.5 px #1F2527, no top bar, no shadow | r 16, coloured top bar | T |
| 14 | pills/chips | capsule 33 px, tint fill; data chips; stamp | outline pills | T + M (stamp) |
| 15 | icons/imagery | solid glyphs, logos, highway, map, swarm | 2 glyphs, no illustrations | A + M |
| 16 | connectors | dashed 3 px, curves 1.5 px, barriers, strike, underline, draw-on | none | C |
| 17 | charts/tables | line chart, counters, tables, cell grids | % text only | M |
| 18 | data realism | consistent domain, RFC IPs, repeated numbers | good IDs, few numbers | S |
| 19 | background | pure black + masked 60 px dot grid, static | gradient + olive wash | T |
| 20 | module catalog | 33 modules | ≈6 | M |
| 21 | entrances | 133–233 ms out p2–2.5, 9 px slide, 52–100 ms staggers | 33–100 ms pops, ≤3-item stagger | T + C |
| 22 | state changes | 1-frame flips, global recolour, counters, strikes, cell fills | status text swap | C |
| 23 | emphasis | mascot punch, stamp squash, ring, highlight row | none | C |
| 24 | transitions | 1-frame content cut + staggered rebuild, 3 camera moves | rebuild | T |
| 25 | ambient | car flow, swarm rotation, typing, counters in every hold; 31% moving frames | 14% moving frames | C |
| 26 | camera | morph 467 ms in-out cubic, push ×1.24 733 ms | none | C |
| 27 | choreography | container → items → numbers → verdict; front-loaded | simple | S + T |
| 28 | beat density | 93 beats/min, scaffold every 3.4 s | 88/min, scaffold every ≈9 s | S |
| 29 | anchoring | graphics lead words by 130–460 ms; caption lags ≈190 ms | small fixed lead | T |
| 30 | sentence rules | 12 rules (§30) | partial | S |
| 31 | structure | hook < 0.5 s, 7 acts, bookend | short-form, n/a | S |
| 32 | scaffolds | 17 changes/min, re-used world metaphor | 6.8/min | S + M |
| 33 | continuity | colour = role for the whole video | colour = entity name | S |
| 34 | voice | 212 wpm, 190 ms sentence gaps | not measured | T (TTS check) |
| 35 | mix | **−14.2 LUFS**, LRA 1.4, TP −0.5, bed at ≈−21 dBFS in pauses | −17.1 LUFS, TP −3.2 | T |
| 36 | export | 720p IG re-encode, 30 fps | 1080p 30 fps | ✓ |

## Top 15 gaps vs our v2 (ranked by visual impact)

| rank | gap | R1 target (measured) | fix class | effort note |
|---|---|---|---|---|
| 1 | **Frozen sticker mascot vs animated talking character** | eyes/mouth change every 1–3 f; 220×781 px, feet at y 1320 (41% of height); slide-in 367 ms ease-out; scale states ×1.175/×1.19/×1.267 anchored at the feet; hidden 30% of the time | A + C | biggest "cheap" tell. Needs a lip-sync/eye sprite set or a video layer; rights-clean original character |
| 2 | **One monolithic card per scaffold vs 2–5 dense modules + a re-used world** | 33 modules; highway world in 15 scaffolds; content 25% of the area in modules with black gaps | M + S | build M6/M7 highway, M11 dashboard, M14 row list, M15 table, M13 cell grid first |
| 3 | **No display tier** | right-aligned 2-line slams at x 1020, cap 96–135 px, accent colour, 1–2 frame pop, 0.25 s before the word | M + T | cheap, very high impact |
| 4 | **Background & surfaces** | pure #000 + a 60 px dot grid (dots #262626 peak, elliptical mask) + #000A0B centre glow; panels #090D11, border #1F2527, r 6 | T | ours reads grey/muddy; 1-day fix |
| 5 | **Holds don't move** | 31% moving frames; every >1.5 s hold carries a counter, flow or rotation | C | counters + car-flow/particle loops |
| 6 | **No counters / number animation** | mono counters with ease-out 0.5–1.2 s, ease-in for escalation, jitter for uncertainty | C + M | also switch every number to mono |
| 7 | **HUD is decorative, not a state machine** | 16 pill flips (OK/DEGRADED/OFFLINE/SATURATED/FILTERING), right metrics `1,000 req/s · 38 ms`, 1-frame flips, synced to the story | C + T | storyboard emits hud_state per beat |
| 8 | **Scaffold cadence** | new scaffold/major mutation every 3.4 s (17/min), hard 1-frame cut + staggered rebuild | S + T | LLM prompt + validator rule |
| 9 | **No stroke-draw primitives** | line charts 533 ms ease-in; dashed connectors 250 ms; strikes/underlines 67–250 ms; fan curves 130–170 ms, stagger 100 ms | C | enables negation/cause-effect rules |
| 10 | **Global severity recolour** | 1 frame: all accents cyan→amber/red + HUD pill + mascot punch (39.83) | C | theme-token swap at runtime |
| 11 | **Cascade staggers** | chips 52 ms, rows 87 ms (+9 px slide, 167 ms out p2.5), cells 600 ms for 60 | C + T | generic stagger on list modules |
| 12 | **Semantic palette** | cyan = you/ok, red = attack, amber = warn/chapter, purple = distributed; tints at ≈25% for fills | T + S | an entity→role colour map in the storyboard |
| 13 | **Typography scale** | caption 66 px; title cap 33 centred at y 382; labels cap 12 tracked 0.15–0.25 em #85898F; values/numbers in mono | T + A | add a JetBrains-Mono-like face |
| 14 | **World camera** | morph ×0.256 467 ms in-out cubic; push ×1.24 733 ms in-out quad after a 600 ms hold | C | only on world layers; chrome fixed |
| 15 | **Loudness / bed** | −14.2 LUFS, TP −0.5, LRA 1.4; bed ≈−21 dBFS in pauses | T | ours −17.1 LUFS, TP −3.2 |

Already at or near parity: caption box recipe (#10: position 76.8% vs 77.0%, 3 px border, hard accent shadow, 3-tone karaoke), export format (#36), beat count per minute (#28 raw count), chrome persistence across cuts.
