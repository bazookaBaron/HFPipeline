# Cross-video design & motion SPEC + gap matrix (R1–R5 → our v2)

Date: 2026-09-25. Consolidates `design/R1…R5/AUDIT.md` against `ANALYSIS_CHECKLIST.md` (items 1–36), with context from
`MOTION_GRAPHICS_ATLAS.md`, `PREIMPLEMENTATION_DECISION.md` and `ARCHITECTURE_REVIEW.md`. This file becomes the implementation
backlog for the v2 generator.

**Conventions.**
- All px are @1080×1920. Every reference is a 720×1280 @30 fps IG re-encode, and the audits report native px ×1.5 (±1.5 px quantisation).
- Hex values carry ±3/channel noise on flats and more on strokes ≤2 native px.
- 1 frame (f) = 33.3 ms.
- Every number carries its source ref(s) in brackets, e.g. `[R1,R2]`.
- **`[ASR?]`** marks a timing lead/lag measured against Whisper word times. **Verified 2026-09-25** (energy onset after ≥120 ms pauses vs Whisper word start, 62–77 onsets per ref): audible onset is LATER than the Whisper start by median R1 +75 ms, R2 +100, R3 +145, R4 +260, R5 +35 ms (IQR ≈ ±100 ms). The bias is per-video, not a constant 0.25–0.30 s, and the energy onset is itself biased late by soft consonants. So every `[ASR?]` lead/lag carries ≈ ±0.15 s (R4 up to 0.26 s); the robust conclusion is 'visual lands on the audible word, within ~±100 ms'. Script: scratchpad asrchk/chk.py. Our own timings come from TTS alignment, so this affects reference measurement only.
- GSAP ease mapping used below: `power1` = quad (p2), `power2` = cubic (p3), `power3` = quart (p4). Audits that report "out p2.5" have no exact GSAP twin; they are mapped to `power2.out` and flagged.
- **Our v2 baseline:**
  - One host scene per video (`deployment-dashboard`) running seek-safe GSAP timelines with typed word-anchored events.
  - Captions: 3-word chunks, box top 77%, 60 px w800, fill #07090c, 3 px light border, 8 px hard accent shadow, karaoke white/accent/grey.
  - Mascot: a static SVG SpongeBob at left 1.5%, top 49%, width 24%.
  - HUD: top 214, h 64. Background: dark gradient. Theme: dark only.
  - Library: 64 legacy components, mostly placeholder quality. No cuts within a host. Fonts are not bundled.

---

## 1. Style profiles

### 1.1 Shared by all five (build once, profile-independent)

| Property | Value | Refs |
|---|---|---|
| Delivery | 720×1280, 30 fps CFR, H.264 yuv420p, ≈208–326 kb/s. We render 1080×1920 and let the platform downscale. | R1–R5 |
| Loudness | −14.1…−14.2 LUFS integrated, LRA 1.0–1.4, TP −0.5…−1.1 dBTP | R1–R5 (verified) |
| Top clear band | nothing drawn above y 203–235 (10.6–12.3%) | R1,R2 235 · R3 230 · R4 223 · R5 203 |
| Bottom clear band | nothing below the caption: 1510–1548 → 1920 (19.4–21%). R4 is the only exception, with a footer at 1650–1691. | R1–R5 |
| Caption position | centred on x=540 (frame axis, not the content column), **one line**, width hugs the text, box centre at 76.3–78.0% H | R1 76.8 · R2 76.8 · R3 76.3 · R4 78.0 · R5 77.9 |
| Caption chunks | 2–5 words (mostly 3–4), median chunk life ≈0.93–1.03 s | R1,R2,R3 (4),R4 (3),R5 (3.5) |
| Caption karaoke | one active word at a time, hard 1-frame word colour flip (R5 ramps 2–3 f) | R1–R5 |
| Mascot | 2-D cartoon presenter in a **left column**. It never overlaps panels (R5's bbox overlaps the panel column by 22 px, but the silhouette does not). | R1–R5 |
| Background | flat fill + a **static** grid texture (dots, or lines in R5). Never moves, never changes between scenes. No noise and no vignette beyond a mask. | R1–R5 |
| Scene change | the content layer **hard-cuts in 1 frame**; chrome, background, caption and mascot persist | R1 (≈90% of 52), R2, R3 (31/31), R4 (32/32), R5 (62/62) |
| No arrowheads | direction comes from draw order / motion / packets | R1–R5 |
| Cards | flat: no gradients, no glows on panels (R1's only glows are the barrier and car chips) | R1–R5 |
| Type roles | a heavy grotesk ≈800 for captions; **mono for all data/IDs/paths/code**; tracked caps for labels | R1–R5 |
| Colour = role/domain | a hue never changes meaning within a video and never encodes list index | R1,R2,R3,R4,R5 |
| Data realism | concrete, internally consistent IDs/numbers re-used across scaffolds | R1–R5 |
| No idle wobble on graphics | holds move only through semantic processes (flows/packets/counters/typing) or the mascot | R1–R5 |
| Voice | single narrator, 176–221 wpm, pauses ≤0.78 s | R1–R5 |
| Beat-locked SFX | not detected (transient/beat coincidence ≈ chance). R1 at most sparse. | R1–R5 |

### 1.2 Minimal profile set

| Profile | Refs | One-line grammar |
|---|---|---|
| **DH: dark-HUD-persistent** | R1, R2 | Black void + dot grid. A status HUD works as a story state machine. A persistent carrier or world scaffold is mutated in place, with a swappable top slot. The mascot exits for full-width reframes. Counters, strikes, slams, and occasional camera moves. |
| **LC: light-scene-cut** | R3 (LC-a "editorial"), R4 (LC-b "diagram") | Warm off-white + dot grid. Kicker/counter header plus a per-scene title and subtitle. Every scene is **rebuilt from empty** after a hard cut (append-only state). Static mascot with a blink. No emphasis FX, no camera. |
| **DC: dark-chaptered** | R5 | Near-black + 60 px line grid. Chapter label + 10-segment progress. A fixed **stage frame + info panel**. Sub-states hard-swap under persistent chrome. Word-anchored dim→lit lighting, serif hero words, mascot glances. No UI ambient motion. |

### 1.3 Knobs that differ (profile config schema)

| Knob | DH (R1,R2) | LC (R3,R4) | DC (R5) |
|---|---|---|---|
| theme | dark, bg #000000 | light, bg #F3F3EC/#F4F4ED | dark, bg #090A0D |
| bg texture | 3 px dots, pitch 60 [R1] / 54 [R2], elliptical mask | 3 px dots, pitch 32 [R3] / 38 [R4], no mask | 1.5 px lines, 60 px grid, fades below ≈88% H |
| top chrome | status HUD bar 960×70 [R1,R2] | kicker + counter/stepper + hairline [R3,R4]; footer brand + counter [R4] | chapter label + 10-seg progress + hairline |
| per-scene title | centred caps section label, cap 33 [R1,R2] | title 70–72 px + subtitle [R3,R4] + footnote/annotation [R3,R4] | stage subheader, cap 15 (changes every sub-state) |
| content structure | carrier/world persists; top slot swaps; full-width reframe | full rebuild per scene | stage module persists; panel + subheader re-skin per sub-state |
| scene/sub-state cadence | scaffold every 3.4 s [R1]; layout life mean 8.1 s [R2] | cut every 4.2 s [R3] / median 5.0 s [R4] | sub-state mean 2.6 s, scaffold median 3.3 s |
| state grammar | mutate in place: flips, counters, recolour, strike | **append-only** [R3]; redraw a connector on a fresh copy [R4] | dim→lit lighting, strike, typed text |
| emphasis FX | mascot punch, stamp, ring, slam, dim-others, flash | none | ring pulse, stamp, hero serif, glance |
| ambient | car flow, swarm, flow dots, chart crawl, counters | typing, cursor glide [R3]; packet loops, bar loops [R4] | none in the UI |
| camera | 3 moves [R1], 1 FLIP push [R2] | none | none (one 667 ms carousel push) |
| counters | yes (≈20× [R1]) | no | no (numbers → cell highlight) |
| mascot | 220–224×781–783, hides 30–34%, slide in/out, mouth/eye animated, punch [R1] | 161×560 [R3] / 211×732 [R4], never hidden, blink (+sway [R4]) | 447×594, glances on hero beats, blink 3.2 s, hidden on photo cards |
| caption skin | "sticker": 3 px white border + hard accent offset shadow | "paper": ivory rounded rect, 1.5 px grey border, soft shadow | "quiet chip": #090D11, 1.5 px dim border, soft shadow, white/grey 2-state |
| music bed | present: gaps −21 dBFS vs speech −18.4 [R1]; floor never drops [R2] | present, gaps −20…−26 dBFS [R3]; **none above −38.5 dBFS** [R4] | present, 12–14 dB under VO, 33–112 Hz |
| pace | 212 [R1] / 221 [R2] wpm | 204 [R3] / 195 [R4] wpm | 176 wpm |

**Pick for pilot 1: DH (R2 row values), because it is the same topic as our v2 test.**

---

## 2. Design tokens

### 2.1 Dark palettes (DH, DC)

| Role | R1 | R2 | R5 | **DH canonical** | **DC canonical** |
|---|---|---|---|---|---|
| bg | #000000 (+ teal glow #000A0B peak at (540,660), gone by y≈1350) | #000000 | #090A0D | #000000; glow optional [R1] | #090A0D |
| bg texture | dots 3 px, #040404 → **#262626** peak (y 510–750) → 0 by y 1590, mask centre ≈(540,600) | dots 3 px **#080808–#101010**, ellipse x 26–1053 × y 350–1377 | lines 1.5 px #0B0C0F→#131418 (+2…+8 luma) | 3 px dots, #101010 peak, R2 ellipse (see §11 Q7) | 1.5 px lines #131418 max |
| surface-1 (panel/HUD) | #090D11 | #090D11 | #10141A (panel body) | **#090D11** [R1,R2] | #10141A |
| surface-2 (header band/tile/track) | #0E141A–#10161E (tracks) | — | #151B23 | #10161E | #151B23 |
| border panel | #1F2527 | #15191D | #21252B (panel), #252B35 (row), #1F2023 (stage) | #1F2527 | #21252B |
| border HUD / caption | #15191D | #15191D | #15191C (caption) | #15191D | #15191C |
| text primary | #F5FAFF | #F1F5FD | #FFFFFF / #FBFEFF | #F5FAFF | #FFFFFF |
| text secondary | #BFC5CB | #C9D0D6 | #A9AEB6 | #BFC5CB | #A9AEB6 |
| text muted / label | #85898F | #8B9098 / #7E848B | #90959C (keys), #737A84 (micro) | #85898F | #90959C / #737A84 |
| text disabled / unlit | #363C40 | dim = 40–48% of lit | #2A2C2F (≈30% accent) | #363C40 | #2A2C2F |
| accent: ok / you / primary | cyan #50DBF2 (#5DDFF5 digits) | blue #4B9AFB (entity BLUE) | teal #8FD0E6 (text #B3E8F7) | cyan #50DBF2 [R1] or entity colour [R2] | teal #8FD0E6 |
| accent: error / attack | red #FB3A5B | red #FF375C / #F83C64 | — (no red state system) | #FB3A5B | — |
| accent: warn / uncertain / chapter | amber #FAB73E | amber #FCBA48 | amber #EEC684–#F2CF99 (AI/question) | #FAB73E | #EEC684 |
| accent: secondary domain | purple #A77BFB (botnet) | purple #894BFF / #C282FC (LB/DB) | pink #C88696 (Gotham entities) | #A77BFB | #C88696 |
| accent: compute / entity 2 | — | green #2AD56C (entity GREEN), orange #F57201 (instances) | — | from entity registry | — |
| tint fills (≈20–25% on black) | cyan #0A3A49, amber #3A2500, red #3F0B14, purple #090123 | blue #091931, green #032815, purple #201336, amber #3B2600 | teal #0A2632, amber #281F12, row tint #2A2014 | R1 set + R2 entity set | R5 set |
| tint borders | cyan #517C8A, amber #513B17, red #893C45, purple #635A81 | blue #29456D, green #225D40 | teal #254850–#2F5C6C, amber #BF9D7C, pink #513539 | R1/R2 | R5 |
| hues at once | 1 accent in ≈60% of frames, max 3 | 2–5 (median 4 in the carrier), ≈85% of the frame is black | 0 hues in 88% of frames, max 2 | ≤3 simultaneous [R1] | ≤2; one lit accent at a time |

### 2.2 Light palette (LC)

| Role | R3 | R4 | **LC canonical** |
|---|---|---|---|
| bg | #F3F3EC | #F4F4ED | #F4F4ED (both within ±3 noise) |
| bg dots | 3 px #E6E6DE, pitch **32** | 3 px #E7E7E0, pitch **38**, origin (19,19) | 3 px #E7E7E0, pitch 38 [R4]; 32 for LC-a [R3] |
| surface card | #FEFCF8 | #FEFCF8 | **#FEFCF8** [R3,R4] |
| surface chrome (title bar) | #E9EBE4 (+ #EBE7DB CC header, #EBF0EA status bar) | #E6EDE9 | #E6EDE9 |
| border card/window | #B7B7B0 (window), #D2D2CB (caption) | #BCC3C2–#C6CBC7, caption #C5C7C2 | #BCC3C2 1.5 px |
| divider | #D8D8D1 (annotation), #C9C9C2 (header rule) | #E5E3DF (table), #B9BEBD (title bar) | #E5E3DF rows, #C9C9C2 rules |
| ink-1 (title) | #161D22 | #18252D | #17232B |
| ink-2 (meta/body) | #5F605D (mono meta) | #474C4D (body), #22272A (heading) | #474C4D |
| ink-muted | #6E6E67 | #626667 | #626667 |
| accent primary | **red #D14726** stroke / #D54729 fill (repo, danger, takeaway) | **blue #1766DA** (bytes/data path) | per sub-variant: R3 red, R4 blue |
| entity / role hues | main blue #3361B0 · auth purple #714FAF · billing green #157D5F · dashboard amber #855412 | purple #6D4EA5 (metadata) · green #187A5B (control/success) · brick #B14B30 (cost/failure) · navy #142733 (stepper) | registry: blue, purple, green, amber, red/brick |
| tints (chip/pill fills) | #EFF2F7 blue · #F3F1F4 purple · #EDF4EC green · #F7F1E7 amber | #E5EEF9 blue · #EAE6F2 purple · #DDF2E7 green · #FAE4DA brick | R4 set |
| ghost (inactive connector) | — | blue #D0D6DC · purple #D7D4D8 · #CDD2DD | R4 set |
| state ok / danger | ok #E3EDE4 / #244E3A; danger #FAE7E3, border #B23A3F, text #762B32 | success #DDF1E3 / #2E644F; failed #FAE4DA | R3 set |
| saturated area | 0.4% of frame (median) | 1–3 hues (47% of frames 1 hue) | ≤3 hues, low area |

### 2.3 Entity/domain colour rule (all profiles)

1. The storyboard declares an **entity→role map** once per video. The validator rejects a role-hue swap across hosts [R1,R2,R3,R4,R5].
2. The hue encodes **role or domain, never list position**. All 5 R5 entity nodes share one pink [R5]. Our step list with five colours for five steps violates this (atlas).
3. Semantic meanings seen:
   - ok/you/legit = cyan [R1]
   - attack/error = red [R1,R2]
   - warn/uncertain/active chapter = amber [R1,R2]
   - distributed/secondary system = purple [R1,R2]
   - platform/connected = teal [R5]
   - AI/question = amber [R5]
   - bytes = blue, metadata = purple, control/success = green, cost/failure = brick [R4]
   - one hue per repo entity [R3]
4. OK is **not** green in R1: its "HEALTHY" pill is teal #62CDDE on #0A3A49. R5 has no green/red state system at all.
5. Fills use the role hue at ≈20–25% on the bg (dark) [R1] or a pale tint (light) [R4]. Borders use a stronger tint. Dim/unlit uses ≈30% [R5] or 40–48% [R2].
6. Invariants belong to the host logic, e.g. exactly one LIVE card [R2] (our v2 shows both LIVE at 16.5 s).

### 2.4 Typography (px = font size @1080, derived from the measured cap height)

| Role | R1 | R2 | R3 | R4 | R5 | **Canonical** (profile) |
|---|---|---|---|---|---|---|
| Caption | ≈66, w800 (cap 48) | ≈62, w800 (cap 45) | 52, w800 (cap 37) | ≈50, w800 | ≈54, w600–700 (x-h 30, cap 40) | DH 62 [R2]; LC 52 [R3] / 50 [R4]; DC 54 w650 |
| Section label / scene title | ≈46, w700 caps, centred, cap 33 | ≈45 caps, cap 33, centred | 70/700 sentence, left x 75, 1 line | ≈72/800 sentence, left x 70, 1–2 lines, leading 76.5 | subheader cap 15, w500–600, caps, tracking 0.2 em | DH 45–46 caps; LC 72/800; DC cap 15 |
| Display / hero | caps grotesk cap 96–135 (≈130–185 px), right-aligned x 1020, leading ≈1.05 | caps cap 78–96, 2 lines, pitch 123–147, −3% tracking, centred | condensed caps 56/800, −0.04 em (1 use) | ≈105/800, −0.03 em, left x 324 | **condensed serif** caps, cap 72–112, width ≤917 | DH grotesk cap 78–135; LC 105/800; DC serif cap 72–112 |
| Module / section head | cap 45–54 (≈62–75) | panel title cap 28.5; cap ≈45 wide | 31/700 caps; mono name 27/700 | node heading 33/700 | card title cap 12–15, 700 caps | DH 40; LC 31–33/700; DC cap 15/700 |
| Big number | mono cap 69 (≈95 px) | cap 30–40.5 counters; footer cap 22.5 | none | display only | none (serif years) | DH mono ≈95; LC/DC none |
| Value / data | mono 36–50 values; rows ≈24 | mono glyph box 16.5 (x-h ≈11) | mono 22–27 (meta 24, path 22, code 22, pitch 43.5) | mono 24–26; body 27–29 | mono cap 14–18 | mono 24 (all) |
| Label / micro | caps cap 12–15 (≈17–20), tracked 0.15–0.25 em, #85898F | tracked caps 9–16.5, +10–15% | header mono 22 caps +0.06 em | kicker mono ≈22–23 caps +0.08 em; footer +0.15 em | mono cap 9–10.5 caps, wide | 18–22 tracked caps |
| HUD metric | mono cap 16 (≈22) #BFC5CB | mono #C9D0D6; ERRORS caps 10.5 | — | — | — | mono 22 |
| Pill text | caps cap ≈13 | caps 12 | mono 19/700 | bold ≈23 | bold caps cap 19 (teal pill) | 19–23 |
| **Families** | grotesk (Inter-like) + mono (JetBrains-Mono-like) | same | display: Space-Grotesk-like; caption: Inter-like; mono: JetBrains-Mono-like | geometric grotesk 800 + Inter-like + IBM-Plex-Mono-like | Inter-like + IBM-Plex-Mono-like + condensed serif (Instrument-Serif-like) | **Bundle 4 families:** Inter (UI/caption), Space Grotesk (LC display), JetBrains Mono (mono, all), Instrument Serif (DC hero). Faces are visual IDs, not proven. |

Hierarchy ratios by cap height:
- display : big number : value : label ≈ **8 : 5.7 : 2.2 : 1** [R1]
- caption : label : card header : data ≈ 45 : 33 : 15 : 11 [R2]
- title : card-name : meta ≈ 2.6 : 1 : 0.85 [R3]
- display 3.6× body, title 2.5× [R4]
- hero : caption : subheader : micro ≈ 6.5 : 2.7 : 1 : 0.65 [R5]

Ours: the caption is the largest text, with no display or title tier (≈3.3 : 1).

On-graphic words per frame (excluding the caption): 12–20, max ≈60 [R1] · 30–60 tiny UI tokens [R2] · title + subtitle + 2–4 modules ≤6 words [R3] · 25–45 [R4] · 30–35 [R5].

### 2.5 Spacing grid

| Token | Values | Canonical |
|---|---|---|
| base grid | 60 px [R1 dot pitch, R5 grid]; 54 [R2 dots = row pitch]; 32 [R3]; 38 [R4] | DH 60 layout / 54 rows; DC 60; LC 38 |
| side margin | 60 [R1,R2,R5]; 72–75 L / 73–81 R [R3]; 70 [R4] | dark 60; light 70 |
| dense row pitch | log 61.5 (54 + 7.5) [R1]; card rows 54 [R2]; table 60 [R1,R4]; table 56, panel rows 73.5, stack 66 [R5]; checks 78 [R4]; checklist 55, code 43.5, tree 47 [R3] | table 60, list 54–62, checklist 55–78 |
| module gap | 18–19 [R1]; 19.5–20 [R2]; 51 [R3]; 30 [R4]; 4–6 card row, 20 dashed boxes [R5] | dark 19; light 30–51 |
| card inner padding | label inset 17–18 [R1]; 22.5 [R2]; 30 L / 32 top [R3]; 28 [R4]; accent card 30, stage inset 12 [R5] | dark 18–22; light 28–30 |
| caption padding-x | 40.5 [R1]; 39 [R2]; 30 [R3]; 33–35 [R4]; 36 [R5] | DH 39; LC 30–34; DC 36 |
| chips | pill h 33 [R1]; tag h 27 [R1]; data chip h 39 pitch 75 [R1]; chip h 40–43, gap 13 [R4]; branch pill h 44 [R3]; teal pill h 60 [R5] | h 33 (dark), 40–44 (light) |

Ours: row pitch 168 [R1,R2] / 250 [R5 measurement], i.e. 3× too loose.

### 2.6 Radii, borders, shadows

| Token | Dark refs | Light refs | Canonical |
|---|---|---|---|
| panel radius | 6 [R1]; HUD 9, env card 12 [R2]; panel 6, tile 9, stage 0 [R5] | card/window 16 [R3,R4]; chip 9, note box 9 [R4]; pill ≈6 [R3] | dark 6 (tile 9); light 16 (chip/box 9) |
| border width | **1.5 px** everywhere [R1,R2,R5] | 1.5 px [R3,R4]; repo card 3 px red [R3] | 1.5 px |
| caption border | 3 px solid white, r 0 [R1,R2]; 1.5 px #15191C, r 9 [R5] | 1.5 px, r 10 [R3] / r 12 [R4] | per skin (§4.4) |
| shadow | **none** on panels [R1,R2,R5]; caption hard offset +7.5/+7.5 0 blur [R1] / ≈8 px [R2] in the accent; R5 caption soft 4–6 px #07080B | card `0 6 24 rgba(20,20,10,.07)`, window `0 14 48 rgba(20,20,10,.10)`, repo `0 10 8 rgba(209,71,38,.10)` [R3]; card ≈9 px down, 6 blur #E3E8E2 [R4]; MP4 tile hard 6 px #B8CCE8 [R4] | dark none; light R3 card shadow |
| glow | barrier + car chips only, ≈3–6 px bloom [R1]; none [R2,R5] | none | none (except the world-scene barrier) |
| dashed | connector 3 px, dash 15 / gap 10.5 [R1]; idle link 1.5 px [R2]; placeholder 9 on / 6 off, ring 18/12 [R5] | drop zone 6/4 [R4]; dotted "versions" row [R3] | 15/10.5 (connector), 9/6 (slot) |

### 2.7 Background plate params

| Profile | fill | texture | mask | motion |
|---|---|---|---|---|
| DH | #000000 [R1,R2] | 3 px dots; pitch 54 [R2] (60 [R1]); peak #101010 [R2] (#262626 [R1]) | ellipse x 26–1053 × y 350–1377 [R2]; R1 fades to 0 above y≈30 and below y≈1590 | static |
| LC | #F4F4ED [R4] (#F3F3EC [R3]) | 3 px dots #E7E7E0, pitch 38 [R4] (32 [R3]) | none (corners identical) | static |
| DC | #090A0D [R5] | 1.5 px lines, 60 px, +2…+8 luma, x = 60k, y ≈ 28.5+60k | invisible below ≈88% H | static |

Ours: a #0D131B→#090D0F gradient with an olive corner wash (#161900) and a lighter slab behind the cards. That is "dashboard in fog", where the references read as "UI on void" [R1,R2].

---

## 3. Frame layout

### 3.1 Vertical bands (exact geometry)

| Band | DH (R1 / R2) | LC-a R3 | LC-b R4 | DC R5 |
|---|---|---|---|---|
| top clear | 0–235 / 0–235 | 0–230 | 0–223 | 0–203 |
| chrome row | HUD 235.5–305 [R1,R2] | header cap 231–252, rule y 279 | kicker + stepper 224–260 | label cap-top 204, progress y 207–211, hairline 237 |
| title band | title ink 382–416 + divider 424–427 [R1] / label cap-top 342 [R2] | title cap-top 320, baseline 369; subtitle cap 465–485 | title cap-top 301 (baseline 353 / 2nd 429); subtitle 471–497 | stage frame 267–840; subheader cap-top 288 |
| content | 382–1320 [R1] / 334–1302 [R2] | 527–1340 | slot 549–1265 | stage 267–840 + panel 891–1127 |
| annotation / footnote | — | divider 1221–1270, text +35 | dash 1299–1304, text 1326–1350 | — |
| mascot feet | 1320 / 1321 | 1340 | 1343 | 1377 (floor shadow) |
| caption box | **1416–1532 / 1416–1531.5** | 1420–1510 (h 90) | 1452–1545 (h 94.5; 1551 incl. shadow) | 1444.5–1548 (h 103.5) |
| footer | — | — | rule y 1650, text 1672–1691 | — |
| bottom clear | 1540–1920 | 1510–1920 | 1692–1920 | 1548–1920 |

### 3.2 Columns

| Mode | DH | LC | DC |
|---|---|---|---|
| mascot column | x 21–240 [R1] / 19.5–243 [R2] | x 75–236 [R3] / 66–276 [R4] | x 0–447 (ear cropped at x 0) |
| gutter | 90 [R1] / 87 [R2] | 94 [R3] / 44 [R4] | none (panel overlaps the bbox by 22) |
| content column (mascot on) | **x 330–1020 (690)** [R1,R2] | x 330–999 (670) [R3]; 320–1010 (690) [R4]; windows from 300 [R3] | stage x 60–1020 (full width, above the mascot); panel x 469–1020 (551) |
| full-width (mascot off) | x 60–1020 (960) [R1,R2] | n/a (never hidden) | photo card 60–1020 |
| alignment axes | display/numbers **right-align at x 1017–1020** [R1]; titles centre on x 540 [R1,R2] | titles left at x 70–75; footnote left at x 320 [R4]; caption on x 540 | all frame edges on the 60 px grid |
| canonical | mascot 20–243; content 330–1020; full 60–1020 | mascot 66–276 [R4]; content 330–1010 | stage 60–1020 × 267–840; panel 469–1020 × 891–1127 |

Content fill:
- 25% of frame area (median, range 9–40%) with the ink centroid at 45% H [R1]
- 36% of area, centre of mass y 770 [R2]
- 20–24%, top-anchored at y 549, centre of mass 43–48% [R4]
- stage 26.5% [R5]
- ours: one monolithic card at ≈33–40%

**Rule:** 2–5 separate modules with bg gaps, not one tall card [R1,R3,R4,R5].

### 3.3 Layout templates (union, deduped)

| ID | Template | Geometry @1080 | Refs (source template IDs) |
|---|---|---|---|
| **L1** | Mascot + content-column stack | content x 330–1020; first panel top ≈521–560; stack gap 18–19 [R1] / 30–51 [light]; optional title | R1 T1, R3 S/W, R4 T1/T2 |
| **L2** | Carrier + swappable top slot | label cap-top 342; **slot 330–1020 × 334–760**; router pill 330–1020 × 780–844; lever band 844–950; 2 cards 330–664.5 / 684–1015.5 × 949.5–1300 (333×350, gap 19.5) | R2 T1 (≈125 s); compact variant R2 T3 (banner 336–457, router 469.5–534, cards 546–802, DB 835.5–1300) |
| **L3** | Full-width reframe (mascot hidden) | x 60–1020 from the HUD down to ≈1303; 2-line headline 357–558; cards 61.5–1018.5 × 950–1303 | R1 T5/T6/T9, R2 T2/T4 |
| **L4** | Display/hero word | R1: right-aligned x 1020, ink y ≈725–1030, content behind dimmed to ≈35%. R2: centred headline 357–600. R4: word at (324,564) + stack below. R5: serif at x 78, cap-top ≈500–650 + mono kicker +40 | R1 T3, R2 S9/S11/S17, R3 S07, R4 T5, R5 T3 |
| **L5** | Title + centred object | object centred on x≈700 (R1 limiter 462–886) or x 540 (R5 ring r170 at (540,588), letter tiles 3×306) | R1 T4, R5 T7 |
| **L6** | Tab/stepper strip + content | tabs x 60–1020 × y 423–489, 3×311, gap 10 [R1]; 4×231×84, gap 12, y 556–640 [R2] | R1 T7, R2 T4 |
| **L7** | Two-column compare | 2 panels 465 + 30 gap, then a diff row [R1]; 471×438 at x 60–531 / 549–1020, y 330–768 [R5]; stage cards 63–529.5 / 549–1015.5 × 654–1045.5 [R2] | R1 T8, R2 T5, R5 T8 |
| **L8** | Parent + bracket/tree | repo card 330–999 × 611–735 (2 children, pitch 225) or 527–650 (3 children, pitch 210); trunk x 285 [R3]. Tree: origin 535–833 × 555–757, leaves 189×163 at x 320/570/820, y 905, bus y 832 [R4] | R3 T, R4 T6 |
| **L9** | Vertical 2-card + connector / window + detail | card A 330–999 × 536–768, connector x 665 (768→962), card B 962–1203 [R3]. Window 300–999 × 536–854, detail at +110 [R3]. Stacked windows 320–1010 × 560–920 + 1050–1218, connector x 665 [R4] | R3 V/W, R4 T2 |
| **L10** | 2×2 / 3-node diagram | nodes 274–288 × 214 at (320,570), (716,570), (320,1031), (716,1031); col gap 122, row gap 247 [R4] | R4 T3/T4 (11 scaffolds), R3 G, R5 T1 |
| **L11** | Stage + anchor row + sub-module + panel | card row y 331–482 (5 × 186×135, gaps 4–6, tilt ±0.5–1.5°); sub-module y 500–820; panel 469–1020 × 891–1127 | R5 T2 (≈38% of runtime) |
| **L12** | World scene | full-width world behind the mascot (road top y 620 x 426–653, base y 1179 x 108–971); callouts on the world; optional panel top-right x ≈690–1020 × 400–560 | R1 T2 (15 scaffolds) |
| **L13** | Grid / matrix | x 60–1020 × 382–1254 [R1]; chip grid 3×2 198×96 [R3]; chunk grid 4×3 111×99, pitch 141/128 [R4]; cell grid split [R5] | R1 T6, R3 O, R4 chunk, R5 M12 |
| **L14** | Stack / list | question bar h ≈85 + rows h 57, pitch 66, x 260–1020 [R5]; 4 cost rows 97 h, pitch 126 [R4]; strike bars 879×132 at y 429/600 [R5] | R4 T5, R5 T6 |
| **L15** | Table | table 84–978 × 370–558 + kicker at y ≈690 + panel [R5]; k/v table 60 px rows in a 690 window [R4] | R5 T9, R4 T1 |
| **L16** | Photo card (mascot hidden) | photo 60–1020 × 372–1035, credit strip 1005–1023, 3-row table 1095–1244 | R5 T4 |
| **L17** | End card / thesis | 2 boxes 690×125 at y 549/704, logos ≈105 at y 888–999, tagline 1060 [R4]; 2-line headline + cards [R2 S17]; final serif line [R5] | R2 T6, R4 T7, R5 end |
| **L18** | Breath (mascot + title only) | 1–2 beats | R1 T10 |

Ours has one template (dashboard, content 327–1010 × 330–1340).

---

## 4. Persistent chrome specs

### 4.1 Status HUD (DH) [R1,R2]

| Part | R1 | R2 | **Canonical** |
|---|---|---|---|
| box | x 60–1020, y 235.5–305 (960×70), fill #090D11, border 1.5 #15191D, r ≈6 | x 60–1020, y 235.5–304.5 (960×69), fill #090D11, border #15191D, r ≈9 | 960×70 at (60,235), #090D11, 1.5 px #15191D, r 6 (§11 Q9) |
| left | label "ORIGIN": caps, tracking ≈0.3 em, cap 15, #F8FCFF, x 84–170 | host `shop.example.com`, mono #C9D0D6 | label (caps) or host (mono) |
| pill | capsule h 33 at x 192; width follows the label (OK 76 … SATURATED 159); fill = accent at 25% (#0A3A49 / #402A03 / #3F0B14), text accent, 1.5 px rim, 6 px leading dot | env pill: dot + caps 12, text #6393D2, fill #0B1A36, 1.5 px blue border | state-enum pill, h 33 |
| extra field | — | version `v1.4.2` mono #8D939A | optional |
| right | mono cap 16 #BFC5CB, right-aligned at x≈995, 2 fields joined by " · " (`1,000 req/s · 38 ms`) | `0.4%` mono bold #F1F5FD + `ERRORS` caps 10.5 #7E848B | 2 mono metrics |
| updates | ≈16 pill flips in 177 s, each a **1-frame swap**; latency ticks through intermediate values (38→637→954→2012 ms, ≈600 ms) | PROD→BLUE at 13.00; **backspace 1 char/f + retype 2 chars/f** (300 ms) with the pill recolouring in 1 f; error % recolours red + value jump (0.4→30.8%) | storyboard-driven `hud_state` events: `flip` (1 f), `tick` (≈600 ms), `retype` (300 ms) |
| lifetime | 0.1–176.3 s | 5.25–129.9 s (absent on the title and stage/outro) | host-scoped; hideable |
| divider | 3 px hairline at y 424–427, gradient #1B2125→#050505, only when a title is shown | — | optional |

Ours: x 44–1036, y 214–278, fill #06070E, "LIVE • OK" static, no metrics.

### 4.2 Header, title block, counter, footnote, footer (LC) [R3,R4]

| Part | R3 | R4 | **Canonical** |
|---|---|---|---|
| kicker (left) | `GIT / WORKTREES`, mono caps ≈22, +0.06 em, #61615A, x 73, cap 231–252 | `SYSTEM DESIGN / FILE SERVICES`, mono caps ≈23, +0.08 em, #3A4446, x 70, cap-top 230 | mono caps 22, x 70, cap-top 230 |
| right | counter `NN — 32` right-aligned to 1004, same style, **steps in 1 f on every cut** | stepper: 3 circles Ø37 at x 898/945/991, y 241; active fill #142733 + white digit; inactive 1.5 px #9FA4A3 outline; hard switch; one active at a time | knob: `counter` (default) or `stepper` (act/version chapters) |
| rule | 1.5 px #C9C9C2 at y 279, x 72–1007 | — (footer rule instead) | y 279 |
| title | x 75, cap-top 320, 70/700, 1 line ≤880, #161D22, hard-swap at the cut | x 70, cap-top 301, ≈72/800, 1–2 lines, leading 76.5, fade + rise 10 px over 233 ms | 72/800, cap-top 301, ≤2 lines |
| subtitle | x 75, cap 465–485, mono 27 caps #63645D | x 75, y 471–497 (fixed, not reflowed), 29/400 #474C4D | fixed y 471 |
| footnote / annotation | divider 324–995 × 1.5 px #D8D8D1, then text 31/500 in accent/entity colour at +35 px (12 of 32 scenes, always the last beat) | blue dash 64.5×4.5 #206AC2 at (320,1299) + bold 27 #151B1E at y 1326; every scaffold; hard swap on the cut | R4 on every scene; R3 variant as the "takeaway" last beat |
| footer | — | rule y 1650 x 70–1008 + `BRAND   /   NN` mono ≈21, +0.15 em, #6E706F | optional (needs our brand/handle) |

Existing base: `chapter-shell` (`breadcrumb`, `currentStep`, `totalSteps`, `headline`, `subtitle`) → rebuild.

### 4.3 Chapter label + progress + stage subheader (DC) [R5]

| Part | Spec |
|---|---|
| chapter label | x 60, cap-top 204, cap 15, sans caps, tracking ≈0.2 em, #9FA3A8–#AAAEB2 |
| progress | 10 segments, each 26×3, pitch 34, x 687–1019, y 207–211. Past #3C424A, **current #91D2E8**, future #2A2E34. Past segments do NOT stay lit. |
| hairline | 1.5 px #191A1D at y 237, x 60–1020 |
| update | 1-frame hard swap of label + segment on the same frame as the content swap (12.517, 52.583) |
| stage frame | 1.5 px #1F2023 square box, 960×573 at (60,267) |
| subheader | (72,288), cap 15, #AAAEB4, caps; changes on every sub-state (62×); works as a breadcrumb |
| chapters | 10 in 165 s (mean 16.5 s) |

### 4.4 Captions (per-profile skin)

| Property | DH "sticker" (R1 / R2) | LC "paper" (R3 / R4) | DC "quiet chip" (R5) |
|---|---|---|---|
| box y | 1416–1532 / 1416–1531.5 | 1420–1510 / 1452–1545 | 1444.5–1548 |
| height | 117 / 116 | 90 / 94.5 | 103.5 |
| fill | #080C11 / #07080B | #FEFCF8 | #090D11 |
| border | 3 px #F3FFFF, r 0 | 1.5 px #D2D2CB, r ≈10 / #C5C7C2, r 12 | 1.5 px #15191C–#18191C, r ≈9 |
| shadow | hard +7.5/+7.5, 0 blur, #3FE1FF (accent) / ≈8 px #4497FF | soft `0 6 24 rgba(0,0,0,.07)` / ≈7.5 px down, blurred #DDE3E9 | soft 4–6 px #07080B |
| font | ≈66 / ≈62 px, w800 | 52 / 50 px, w800 | ≈54 px, w600–700 |
| pad-x | 40.5 / 39 | 30 / 33–35 | 36 |
| karaoke | spoken #ECF2FC / #EBF1F9 · active **#48DBEE / #549BF4** · upcoming #97A0AF / #8F99A9 | spoken #171C1E / #13232D · active **#B03F2F / #1D5EBD** · upcoming #585C54 / #425058 | **2-state**: active #FBFEFF, all others #B0B4B9 |
| swap | new chunk dim 1 f, then full, with a +2–3% scale overshoot (133 ms) / 2-frame crossfade (67 ms), box width jumps | hard 1 f [R3] / exit 1 f (scale 0.87 + fade) → 1 blank f → scale 0.985 → 1.015 → 1 over 3 f [R4] | old chunk all-grey 1 f → **exactly 1 blank f** → new chunk grey → active ramps to white over 2–3 f |
| gaps | box dims to ≈60%, then gone 2–5 f between sentences [R1]; ours blanks 3.50–3.73 s [R2 note] | never disappears [R3] | never absent except that 1 f |
| word-flip lag | +190 ms median (+50…+320) vs Whisper `[ASR?]` | +70 ms median (−90…+150) `[ASR?]` / +70 ms (−60…+280) `[ASR?]` | chunk swap 50–70 ms **before** the audible word (corrected) |
| **Canonical** | R2 geometry, 62 px, shadow = profile accent, 2-f crossfade | R4 geometry (centre 78.0%), 50–52 px, active = profile primary | R5 as measured |

Ours: y 1421–1534 (h 114, centre 77.0%), #07090C, 3 px light border, 8 px hard shadow #64A4FB, 60 px w800 (ink cap ≈43), hard 1-f swap. That is ≈DH parity. It needs 62 px, shadow #4497FF, and the 2-f crossfade [R2].

### 4.5 Mascot

| Property | R1 | R2 | R3 | R4 | R5 | **Canonical** |
|---|---|---|---|---|---|---|
| bbox | 220×781, x 21–240, top 541, feet 1320 (41% H) | 224×783, x 19.5–243, y 537–1321 (40.8% H) | 161×560, x 75–236, y 780–1340 (29% H) | 211×732, x 66–276, y 612–1343 (38% H) | 447×594, x 0–447, y 783–1377 (31% H, 41% W), floor shadow #313333 ≈258×20 | DH 222×782 at (20,539); LC 211×732 at (66,612); DC 447×594 at (0,783) |
| anchor | feet-anchored | same | fixed | pivot at the feet | floor shadow | **feet line y 1320–1377** |
| mouth / face | eyes + mouth change every 1–3 f (talking layer) | mouth flaps continuously with speech | always open, no visemes | static grin, no lip-sync | no lip-sync | P1: mouth flap on voiced spans (DH only) |
| blink | (part of the face animation) | ≈20 blinks, 133 ms each | 200 ms (6 f) every 4.65 s median (IQR 3.9–5.15); 2 long closes of 400/500 ms | 200 ms (6 f), interval 3.5–5.7 s (mean 5.02), hard sprite swap, free-running | 100–133 ms (3–4 f) on a ≈3.2 s loop, occasional double 0.24 s apart | 133–200 ms, every 3.2–5.0 s by profile |
| gaze | pupils move | — | look-up state ≈27% of frames (pupil −4 px @720) | — | **head-glance** 21–27 px sideways and back, 433 ms ease-in-out, on hero/key-noun beats (11×) | DC glance-on-beat; LC look-up state |
| idle sway | — | none (h 780–783 constant) | none | 3.6 s period, ≈1.7 px p-p at the head, pivot at the feet | — | LC-b only |
| scale punch | ×1.19 on section-title cards; ×1.267 slam (1 f to ×1.19, then 300 ms ease-out); ×1.175 at escalation/finale (1 f snap); returns are 1-f snaps | none | none | none | none | DH-R1 variant only |
| entrance | slide from off-left, **367 ms (11 f) ease-out quad** in E1 (§9 of the same audit says 13 f = 433 ms, 225 px) | slide ≈243 px, **367 ms**, ease-out ≈cubic, brightness ramps | none | none | slide 495 px, **500 ms easeOutCubic** | DH 367 ms `power2.out`; DC 500 ms `power2.out` |
| exit | 1-f cut together with the swap to full width | slide off-left **ease-in, 233–333 ms**; re-entries are hard cuts | none | none | 1-f cut on photo cards | DH-R2: ease-in 233–333 ms |
| hidden | ≈54 s = 30% (full-width scaffolds) | ≈34% (full-width reframes, stage/outro) | never | never | 21.93–23.77, 55.87–57.30 (photo cards) | hide ⇔ layout mode `full` |
| overlap | panels start at x 330; worlds pass behind it | never, except at 130.0 (in front of the blue card) | 94 px gutter | 44 px gutter | stage bottom runs behind the head; hero serif may overlap the head | z: mascot > content; caption > all |

Ours: 257×349–374 at x 17–274, y 940–1314 (18–19.5% H), frozen, always on, SpongeBob (rights unknown), too small and too low.
**Asset requirement:** an original, rights-clean character with sprites for open, blink, look-up/glance-left, glance-right, and (P1) 2–3 mouth shapes. Do not copy the reference characters [PREIMPL].

---

## 5. Module catalog (union of 5 audits, deduped)

P0 = frequent across refs × high visual impact, or needed for the DH pilot (R2 topic). HF = nearest existing component (`MOTION_GRAPHICS_ATLAS` keys); "rebuild" means re-skin it to tokens and add ops, "new" means no close shape.

### 5.1 Containers

| ID | Module | Anatomy / sizes | Variants / states | Data | Refs (uses) | HF | P |
|---|---|---|---|---|---|---|---|
| C1 | **Panel (dark)** | fill #090D11 [R1,R2] / #10141A [R5], 1.5 px border, r 6; tracked label at inset (17,17) [R1] or a 34.5 px header band #151B23 [R5]; optional right mono meta | plain / header band / chart panel with 1/3 hairlines #13171B [R1] | label + content | R1 ≈15× spec cards, R2 surfaces, R5 panel (≈40 sub-states) | CT (rebuild) | **P0** |
| C2 | **Window card** | title bar 48 [R4] / 65 [R3] with 3 dots (Ø10.5 grey #8F989D, pitch 19 [R4]; Ø15 coloured #EC695A / #EABB50 / #6EB78B [R3]; ≈9 px [R2]; #FF645A / #F9C745 / #4DC561 [R1]); mono path label; body inset 28–30; r 16 (light) / 6 (dark) | full 690 / node 274–288×214 / leaf 189×163 / origin 298×202 [R4]; terminal 699×318, VS Code 699×488 [R3]; browser URL pill [R1,R2] | "place" label + body | R4 all 33 scaffolds, R3 9 scenes, R1 4×, R2 S2–S7 | BW, TM, ID (rebuild) | **P0** |
| C3 | **Entity card** | env card 333×350, whole-card tint (#091931 / #032815), header row 55 (caps accent + LIVE chip), sub-row mono + version chip, 3 rows at 54 pitch (28 px orange tile, mono ID, dot, status caps), status line, footer `100%` cap 22.5 + `OF TRAFFIC` [R2]; folder card 670×159, r 16, icon 51×40, mono-bold 27 name, pill right, meta row [R3]; repo card 670×126, 3 px red [R3] | lit / dimmed 40–48% / red-flash / rows HEALTHY-IDLE-DRAINING-UNHEALTHY [R2]; 4 entity skins [R3] | entity, version, instances, health, % | R2 every scaffold but 2; R3 folder 14/32, repo 8 | PD (rebuild), FT | **P0** |
| C4 | **Stage frame** | 960×573 at (60,267), 1.5 px #1F2023, r 0, subheader inside | — | sub-state title | R5 63 sub-states | new | **P0 (DC)** |
| C5 | **Info panel** | 551×236 at (469,891), header band 34.5, rows pitch 73.5, key left / value right | k/v · paragraph · steps "1 READ / 2 JOIN / 3 FLAG" · order rows · image+caption · logo+paragraph · decision | secondary facts | R5 ≈70% of sub-states | CT (rebuild) | **P0 (DC)** |
| C6 | **Statement / alert card** | 690×117, eyebrow 9 px + title cap 28.5 [R2]; 690×125, r 16, ≈44 px coloured text [R4]; 900×190–285 accent fill + 1.5 px accent border + mono micro label [R5]; 680×124 danger box, `!` prefix [R3]; status/spec card [R1] | red error / purple rule / white / amber question / teal decision / dashed placeholder | one claim/incident | R1 ≈15, R2 3, R3 2, R4 end, R5 3 | TA, BS (rebuild) | **P0** |
| C7 | **Note / state strip** | 630×80, r 8, `✓ text` mono 25/700, ok/danger [R3]; outline note 67.5 h, r 9, 27 px, neutral / brick-text warning [R4]; grey in-card note 24–27 px [R4] | ok / danger / caps banner | caveat / state | R3 6, R4 ≈12 + 6 | new | P1 |
| C8 | **Stat tile / stat box** | tile 334×129 (label, value cap 26, 10 px capsule bar at y+88) [R1]; 420×104 / 361×102 (eyebrow + value cap 30–40 + sub-caption) [R2] | healthy ↔ saturated | one metric | R1 dashboard, R2 3 | KP, BS (rebuild) | P1 |
| C9 | **Placeholder slot (dashed)** | 1.5 px dashed 9 on / 6 off, r 9 [R5]; drop zone 6/4 [R4] | empty → filled (4 f) | "something goes here" | R5 5+, R4 1 | new | P1 |
| C10 | **Photo / evidence / portrait card** | 960×663 photo + mono credit + 3-row table [R5]; polaroid 150×110, red pin, tilt ±3–6° [R5]; founders 120×110 | — | place / evidence | R5 3 + 6 + 3 | MP (rebuild) | P2 (rights) |

### 5.2 Data viz

| ID | Module | Anatomy | Variants | Refs | HF | P |
|---|---|---|---|---|---|---|
| D1 | **Counter** | mono number + tracked unit suffix (cap 18 [R1]) in any panel | ease-out count-up · ease-in exponential · jitter (83/87/84/91/88/85) [R1] · lever-coupled % [R2] | R1 ≈20×, R2 (128,540; %) — **not** R3/R4/R5 | KP, BS (rebuild) | **P0 (DH)** |
| D2 | **Table** | no outer box; tracked header row; 60 px pitch; 1.5 px hairlines; right-aligned numbers; a whole row recolours [R1]. DB panel purple #201336, 44 px rows, OLD/NEW tags [R2]. k/v 60 px rows, mono purple key / right value [R4]. Mono table, lowercase header, 56 pitch, amber row tint + 3 px cell outline [R5] | row insert into a reserved slot, row collapse, cell swap, dim row, strike | R1 2, R2 2, R4 5, R5 2 | CT (no cells) → **new** | **P0** |
| D3 | **Row list / log / checklist** | rows 690×54, pitch 61.5, r 6, tint fill + stronger border, mono code/path [R1]; console checklist, 44 pitch, check-box + mono endpoint + 200/502 [R2]; checklist panel `01`–`04` pitch 55 [R3]; check rows Ø36 green disc + 29/600, pitch 78 [R4]; numbered row list pitch ≈45, ranked list with tints [R5] | highlighted row, full-width grow in 3 f [R1] | R1 3, R2 1, R3 1, R4 2, R5 3 | CL, ST (rebuild) | **P0** |
| D4 | **Line chart** | panel + 3 px stroke, hairline grid, tracked label + window tag [R1]; ≈690×290, 3 gridlines with 9 px axis labels, white→red after a dashed event marker, end dot [R2] | flat / exponential / S-curve / spike; crawl / surge / draw back | R1 5, R2 3 | SP (rebuild) | P1 |
| D5 | **Progress / fill bar** | tile bar h 10; pipe h 60 gradient #8A1A2E→#FF3B5C [R1]; 6 px entity bars [R3]; 637×27 / mini 220×14, track #DAE0E4 [R4]; timeline line 3 px + end-dot [R5] | fill / loop / overflow | R1, R3, R4, R5 | PP, GM (rebuild) | P1 |
| D6 | **Cell / chip grid** | cells 48, gap 15, r 4; empty = border, filled = red #4A000D / #8A3949 [R1]; IP chips h 39 [R1]; object chips 198×96 [R3]; disk blocks 8×32 [R3]; chunk tiles 111×99, pitch 141/128 [R4]; 5 blocks of 8×8 cells [R5] | fill cascade · failed / recovered · split · merge-collapse | R1 4, R3 2, R4 2, R5 2 | HM (rebuild) | P1 |
| D7 | **Timeline** | hairline axis, mono year ticks, 3 px #72C5DE progress, amber end-dot Ø12, serif year | tick / progress | R5 2 | TL (rebuild) | P2 |
| D8 | **Compare bar / seesaw** | bar card 670×207, bar 609×33 [R3]; seesaw beam + pivot + 2 cards [R1] | — | R3 1, R1 1 | BB | P2 |

### 5.3 Diagrams & connectors

| ID | Module | Anatomy | Variants | Refs | HF | P |
|---|---|---|---|---|---|---|
| G1 | **Connector family** | straight dashed 3 px, 15/10.5 [R1]; hairline Béziers, dashed idle link + `0%` pill, purple elbows [R2]; bracket (5 px trunk + 4.5 px stubs), 5–6 px S-curves, Ø12 end dot [R3]; **orthogonal 4.5 px active drawn over a 3 px ghost**, 21 px labels that break the line [R4]; 3 px cubic S-curve with horizontal tangents and a 9 px gap to the tile, mono edge-label chips, dim 30% [R5]. **No arrowheads** [all] | style knob: `dashed` / `bezier` / `orthogonal` / `bracket`; state: ghost → active; label | all 5 | NG edges (rebuild as a primitive) | **P0** |
| G2 | **Node / icon tile** | 105² tile #151B23, r 9, 39 px line icon (3 px stroke), mono label below [R5]; diagram node heading 33 + sub 24 + chip/bar/logo [R4]; icon card 217×237, 60 px glyph [R1]; instance tile 28 px, router tile 39 px [R2] | dim (≈30%) → lit | R5, R4 11 scaffolds, R1 3, R2 | NG nodes (rebuild) | **P0** |
| G3 | **Packet / travelling token** | doc tile 39×46, role colour, 3 white lines [R4]; pill token `app v2.0.0` [R2]; 78² teal icon tile [R5] | loop + park [R4]; one-shot [R2,R5]; file→packet morph [R4] | R4 every drawn edge, R2 2, R5 1 | NG pulses, CS (rebuild) | **P0** |
| G4 | **Users row + fan-out** | 9 (pitch 78) / 12 (pitch 81) person glyphs 36×40 #DFE3E9 + `USERS` 9 px caps + Béziers into a dotted 5-dot stem | white / dim / red cascade | R2 S3–S16 | new | **P0 (DH pilot)** |
| G5 | **Router pill + traffic lever** | 690×64 pill: purple tile + `listener :443` + `forward` chip + `blue-tg N%` / `green-tg N%`; 2-row 630×88.5 variant; knob Ø≈15 in a halo Ø≈45 on a stand; solid line to live, dashed + `0%` pill to idle | knob travel 490 px | R2 ≈125 s | PD (rebuild) | **P0 (DH pilot)** |
| G6 | Fan / tree / bus | red pill → 6 amber 1.5 px curves → 6 DB glyphs [R1]; origin + 3 leaves + bus [R4]; layer converging lines [R1] | stroke stagger | R1 2, R4 1 | FN (rebuild) | P1 |
| G7 | Layer stack | 3 tiers + 12 outline boxes [R1]; question bar + 5 rows h 57 [R5] | drop-in layer | R1 1, R5 2 | new | P2 |
| G8 | Git / merge graph | rings Ø36 5 px, 6 px lines, S-curve branch, mono hashes | — | R3 2 | NG | P2 |
| G9 | Spotlight stage / access ring | cone trapezoid 129→217 w + floor shadow + audience [R2]; disc r130 + dashed ring r170 + role chips [R5] | slide 500 / 200 ms | R2 1, R5 1 | FS (rebuild) | P2 |
| G10 | Worlds: highway + car chips + barrier; particle swarm; world map | road trapezoid, 5 lanes, skyline; chips 81×51 → 20 px; barrier 7.5 px + bloom; ≈400 dots in a spiral; dotted continents 960×330 | flow / flood / filter; rotate / shockwave | R1 15 + 3 + 3 scaffolds | RD, PS, WM (rebuild) | P2 |

### 5.4 Text / hero

| ID | Module | Anatomy | Refs | HF | P |
|---|---|---|---|---|---|
| X1 | **Scene title block** | DH centred caps label cap 33 (+ divider) [R1,R2]; LC title + subtitle [R3,R4]; DC stage subheader [R5] | all 5 | EH, chapter-shell (rebuild) | **P0** |
| X2 | **Display / hero** | right-aligned 2-line caps slam, accent or white, content beneath dims to ≈35% [R1]; centred 2-line headline, 100 ms line stagger [R2]; hero number slam `18%` cap 96 [R2]; display word/number 105/800 [R4]; condensed shout [R3]; serif hero + mono kicker, every ≈20–25 s [R5] | R1 7, R2 5, R3 1, R4 4, R5 7+ | BS, EH (rebuild) | **P0** |
| X3 | **Annotation / footnote** | §4.2 | R3 12/32, R4 33/33 | TA (rebuild) | **P0 (LC)** |
| X4 | **Pill / chip / tag** | status pill h 33 tint + dot [R1]; callout tag h 27–33 attached to an object (≈25×) [R1]; floating annotation pill (≥10) [R2]; branch pill h 44, r 6 [R3]; chip h 40–43, r 9, no border [R4]; teal pill h 60, quote chips h 36 [R5] | all 5 | SS (rebuild) | **P0** |
| X5 | **Strike / underline** (op + primitive) | 3 px red strike L→R [R1]; 4.5 px red underline R→L [R1]; amber/red 1.5–3 px strike [R2]; 3 px #DCE2EA strike on bars/tables/pills [R5]; **never in R3/R4** | R1 3+1, R2 4, R5 5 | KH (no strike) → new | **P0 (DH, DC)** |
| X6 | Stamp | 420×114, 3 px red border, −3° [R1]; stamp list 549×126, dashed → solid [R5] | R1 1, R5 1 | new | P2 |
| X7 | Tab strip / stepper | 3 tabs 311×66, active amber #3B2A02 / #4C3922 / #E9B75C, inactive #060C0E [R1]; 4 tabs 231×84, active purple #2A1A48 [R2] | R1 35 s, R2 1 | SN, ST (rebuild) | P1 |
| X8 | Code / SQL / JSON block | #07080B panel, eyebrow `STEP 1 · EXPAND` + 2 mono lines, typed [R2]; mono 26, 40 pitch + leading chip [R4]; VS Code body 22, pitch 43.5 [R3] | R2 2, R3 4, R4 4 | ID, TM (rebuild) | P1 |
| X9 | Letter tiles / acronym | 3 amber tiles 306×135, serif letter [R5]; D-box + DoS + DISTRIBUTED [R1] | R5 1, R1 1 | new | P2 |
| X10 | Logo tiles / lockup | 117 px tiles [R1]; logo equation ≈105 [R4]; wordmark ≈40 cap [R5] | R1, R4, R5 | new (trademark review) | P2 |

### 5.5 UI mockups

| ID | Module | Anatomy | Refs | HF | P |
|---|---|---|---|---|---|
| U1 | Browser window | C2 + URL pill; body = 2×3 product grid / summary + PAY / 503 / countdown; mini corner variant (scale 0.256) | R1 4, R2 3 | BW (rebuild) | P1 |
| U2 | Terminal | C2 + prompt (`❯` red [R3], purple `botnet@c2 ~ %` [R1]) + mono command + block cursor 8×26 | R1 1, R3 5 | TM (rebuild) | P1 |
| U3 | Test console / checklist window | C2 + amber `STAFF ONLY · NOT IN DNS` chip + D3 rows | R2 1 | CL+BW | P1 |
| U4 | Compare cards (two-column) | LEGIT / MALICIOUS mono headers + diff row [R1]; serif title + photos + bullets + pill [R5] | R1 1, R5 1 | new | P1 |
| U5 | IDE window | tab row 66, line numbers, status bar 58 | R3 4 | ID (rebuild) | P2 |
| U6 | Agent (Claude Code) window | header 39, pixel icon, prompt band, tool lines, 6 px progress | R3 3 | new | P2 |
| U7 | File tile / file tree / file pill | MP4 tile 126×150, hard shadow [R4]; tree rows pitch 47 with box glyphs [R3] | R3 1, R4 5 | FT (rebuild) | P2 |

### 5.6 Process / ambient

| ID | Process | Spec | Refs | P |
|---|---|---|---|---|
| A1 | **Packet loop** | linear 337–468 px/s, sharp elbows without slowing, period 1.27–1.6 s, loops = floor(remaining/period) then park at the end; one per connector; passes under labels | R4 | **P0** |
| A2 | Typing | 18 cps + 66 ms at spaces [R3]; ≈24 cps [R1]; ≈60 cps (2 chars/f) [R2]; 73 cps or word-locked [R5] | R1, R2, R3, R5 | P1 |
| A3 | Flow dots / car flow | dotted users→router pulses loop [R2]; perspective-scaled lane flow [R1] | R1, R2 | P1 |
| A4 | Chart crawl / bar loop | crawl 1.4 s linear [R2]; node mini-bar fill+reset with the packet loop [R4] | R2, R4 | P2 |
| A5 | Cursor glide | ≈150 px, 650 ms `sine.inOut`, 0.5 s stagger, then static | R3 | P2 |
| A6 | Swarm rotation / shockwave | continuous spiral; ring 66→840 px, 370 ms | R1 | P2 |
| A7 | Grid split / merge | split 467 ms expo-out [R5]; collapse 730 ms [R4] | R4, R5 | P2 |

Total observed distinct modules: 33 [R1], 21 [R2], 22 [R3], 27 [R4], 30 [R5]. Ours ≈5–6.

---

## 6. Motion spec (canonical recipes)

| Recipe | Props | Distance | Duration | Ease (GSAP) | Stagger | Per-ref variance |
|---|---|---|---|---|---|---|
| `cut` (scene / slot / sub-state) | content layer swap | — | **1 f** | step | — | all 5. R2 top-slot: old out in 1 f, then **1–4 blank frames**, new fades in [R2 E14]. The atlas claims R4 uses a ≈150 ms crossfade, but the R4 audit measured a hard cut (§11 Q5). |
| `enter.fade` (pop) | opacity | 0 | **133 ms** | `power2.out` | — | 66–133 [R5]; 100–133 [R2]; 133–200 out p2.5 [R1]; display pop 33–67 step [R1] |
| `enter.rise` (DH) | opacity + y | +4.5 px (labels/rows) [R2]; list rows +9 px **from the right** [R1] | 133 ms (rows 167 [R1]) | `power2.out` (R1 "out p2.5") | 50–100 ms fixed [R1] | — |
| `enter.headline` (DH) | opacity + y, grey→white | +19.5–24 px per line | 133 ms per line | `power2.out` | **100 ms** between lines | R2 E5; exit = down 9 px + fade over 67 ms |
| `enter.riseFade` (LC) | opacity + y | **+22 px** [R3]; +10 px (title, group) [R4] | **233 ms** [R3, R4 title]; group 300 ms `sine.inOut` [R4] | `power2.out` | group together (+33–67 ms after the title) [R4] | first visible frame α≈0.18–0.27 [R3] |
| `enter.diagSettle` (LC-a) | opacity + x,y | (−25, −37) → 0 | 333 ms | `power3.out` | — | folder cards only [R3] |
| `enter.pop` (LC-b) | opacity + y | +14 px | 133 ms opacity; 200–267 ms position | `back.out(1.4)` (≈1 px / ≤7% overshoot) | 239 ms grid, 225 px trio | R4 only; **R1/R3/R5 have no overshoot** |
| `enter.row` | opacity + y | +6…9 px | 133 ms | `sine.inOut` | table 400 ms / check rows on sentence onsets / cost rows 1,100 ms [R4]; code 233 / tree 250 [R3] | — |
| `enter.drop` (DC) | opacity + y | **−50 px → 0** | 220 ms | `power2.out` (easeOutCubic) | — | R5 E7 |
| `enter.slam` | DH-R1: opacity pop 1–2 f, panel beneath fades out over 233 ms; DH-R2: scale **1.15 → 1.0** + fade | — | 33–67 ms / 133 ms | step / `power2.out`, no rebound | lines together | R1 E8, R2 E6 |
| `enter.hero` (DC) | opacity + letter-spacing | tracking −2.4% | 133 ms | `power2.out` | kicker +0.5–1.5 s later | R5 E12 |
| `enter.title` (DH) | opacity | 0 | 233 ms [R1] / 100–130 ms [R2] | `power1.out` | — | removal 1 f |
| `state.flip` | text/fill/pill | — | **1 f** | step | all together | all 5 (chrome text, pills, subheader) |
| `state.recolor` / `light` | colour (dim ≈30% → 100%) | — | **133–167 ms** | `none` (linear) | word-spaced | 200 ms `power1.out` [R1]; 3–4 f [R2]; 167 ms linear RGB [R4]; 100–167 [R5] |
| `state.dimOthers` | opacity of non-targets → ≈45% | — | 133 ms | `power2.out` | — | R2 main emphasis device (5+ uses) |
| `state.severity` (global) | all accents cyan→amber/red + HUD pill + mascot punch | — | 1 f | step | — | R1 39.83 |
| `state.flash` | fill → #4F2F2B on/off | — | 100 ms (3 f) | step | — | R2 once |
| `state.retype` | backspace + type | — | 1 char/f delete, 2 chars/f type (300 ms) | steps | — | R2 E16 (HUD) |
| `count` | numeric text | — | 500–1,400 ms (escalation 2,150) | `power2.out` (count-up) / `power2.in` (exponential) / jitter | — | R1, R2 only |
| `draw.connector` | stroke-dashoffset | path length | **300–433 ms**, nearly length-independent | R4 `power1.out` (quad-out; its own token table says `power2.out`) · R3/R5 `sine.inOut` · R1 dashed ≈250 ms | fan curves 100 ms [R1]; merges 167/267 [R3]; R5 all at once | R3 ≈0.75 ms/px for 142–576 px |
| `draw.stub` | bracket stubs, then trunk | 45 px | 100 ms, then trunk 300 ms | none / `sine.inOut` | — | R3 E13 |
| `draw.strike` | line length L→R | text width (654 px [R2], 833 px [R5]) | **167 ms** [R2] / 280 ms [R5] / 67–250 ms [R1] | ≈linear [R1,R2] / `power2.out` [R5] | — | struck item then dims [R1] |
| `draw.underline` | line length | — | 130 ms R→L [R1]; 200 ms [R5] | `power1.out` | — | — |
| `draw.chart` | line tip x | panel width 690 | 533 ms [R1]; surge 633 ms [R2]; crawl 1.4 s linear [R2] | `power2.in` (R1 "in p2.5") | 600 ms between charts [R1] | — |
| `fill.bar` | width | to value | 667 ms `power2.out` [R1]; 1.0–1.1 s `sine.inOut` [R3]; linear 600 px/s after a 0.43 s hold [R4]; 400 ms `power2.inOut` + 100 ms end-dot [R5] | per ref | +67 ms [R1]; 333–400 ms [R3] | — |
| `travel.packet` | position along path | path | linear, 337–468 px/s | `none` | spawn at ≈90% of the draw | R4 |
| `travel.token` | x,y | 540–560 px | 433 ms [R5] / 733 ms [R2] | `power2.inOut` | — | the token passes behind the window, and the target rows flicker on arrival [R2] |
| `travel.lever` | knob x + % counters in lock-step | 490 px | 600 ms (counters 500) | `power2.inOut` | — | R2 E4 |
| `travel.spotlight` | cone x | 490 px | 500 ms forward / 200 ms back | `power2.inOut` | — | R2 |
| `morph.fileToPacket` | y + scale 1→0.5 | 270 px | 1.0 s | `sine.inOut` | — | R4 |
| `emph.ring` | radius + opacity | r 64→217 [R5]; 66→840 [R1] | 233 ms [R5]; 370 ms [R1] | `power2.out` / ≈linear | — | R5 2×, R1 1× |
| `emph.stamp` | scale + tilt | 1.2→1.0 and 3°→0 [R5]; 1.01→0.91→1.0 at −3° [R1] | 133 ms [R5]; 200 ms [R1] | `power2.out` / 1-cycle spring | text recolour +3 f [R5] | the only spring in all 5 [R1] |
| `emph.highlight` | tint row / outline box / cell outline | — | 100–130 ms; cell outline 2 f | `power2.out` | — | R1, R2 (tiles), R5 (amber 3 px) |
| `camera.push` / FLIP | scale + translate on the world/content layer only | ×1.24 [R1] / ×1.41 FLIP to full width [R2] / ×0.256 morph [R1] | 733 ms after a 600 ms hold / 433 ms / 467 ms | `power1.inOut` / `power2.inOut` / `power2.inOut` | — | DH only; chrome and mascot are never affected |
| `carousel.push` | row x | ≈1,050 px | exit 8 f `power2.in` + fade; enter 12 f `power2.out`; 667 ms total, 2 f overlap | — | — | R5 E6 |
| `mascot.enter` / `exit` / `punch` / `blink` / `glance` / `sway` | see §4.5 | — | 367–500 / 233–333 / 1 f (+300) / 100–200 / 433 / 3.6 s period | `power2.out` / `power2.in` / step (+`power1.out`) / step / `sine.inOut` / sine | — | — |
| `caption.swap` | per skin §4.4 | — | 33–133 ms | — | — | — |
| `end` | dim content to ≈60% over 367 ms `power1.out`, then cut to black [R1]; fade to black 200 ms [R2]; none [R3,R4]; hold on the hero line [R5] | — | — | — | — | — |

**Never used by any ref:** blur, 3-D, shake, idle wobble on UI, bounce/elastic (except R4's ≈1 px back-out and R1's single stamp spring).
**Ours now:** 22 of 26 motion runs last 1–3 f. No counters, draws, cascades >3 items, camera or mascot motion. Moving-frame share is 14%, against 31% [R1]. 80% of frames are pixel-identical, against ≈50% [R2].

---

## 7. Timing & storyboard rules

### 7.1 Density & cadence (diagnostics, not hard gates [PREIMPL])

| Metric | R1 | R2 | R3 | R4 | R5 | Ours v2 |
|---|---|---|---|---|---|---|
| beats/min | 93.3 machine / 79.7 visual log | 67 hand / 72.9 machine | 69.6 | 50.9 | 73.5 | 81–88 raw (mostly knob / % / row flips) |
| gap median | 517 ms | 870 ms (machine 600) | 600 ms (bimodal) | 680 ms | 633 ms | — |
| max gap / hold | 3.83 s (every hold >1.5 s has motion) | 3.12 s | 4.0 s | 8.3 s (with a live packet loop) | **2.73 s (0 gaps >3 s)** | 3.83 s (frozen) |
| scaffold / scene change | 52 states, one per 3.4 s (17/min) | 17 layouts, mean life 8.1 s; ≈7 layout changes/min; 2.1 hard cuts/min; carrier ≈125 s | 31 cuts, one per 4.2 s (13.8/min), life 1.53–6.63 s | 32 cuts, median 5.0 s (11.3/min), life 1.93–11.03 s | 33 scaffolds (12/min, median 3.3 s); **63 sub-states, 22.6 swaps/min, mean 2.6 s** | 1 host / 17.7 s (≈3.4/min) |
| beats per scaffold | ≈4.5 | ≈2.3 per sentence | build 1–3 s, then hold ≈1.6 s | median 3; build 53% of runtime | build ≈0–0.2 s at the swap | — |
| moving-frame share | 31% | ≈50% identical frames | holds static except caption/blink | ≥1 live loop in every hold | only the mascot moves in holds | 14% moving, 80% identical |

**Per-profile targets** (acceptance bands, with a calibrated detector):
- **DH:** new scaffold or major mutation every 3.4–8.1 s; max semantic hold ≤3.8 s unless a process runs.
- **LC:** scene median 4.2–5.0 s; holds ≤4 s, or ≤8.3 s with a live loop.
- **DC:** sub-state mean 2.6 s; no gap >3 s.

### 7.2 Word anchoring `[ASR?]` (all numbers below are Whisper-relative unless marked)

| Beat type | Rule | Refs |
|---|---|---|
| scene / scaffold cut | on the **first word of a sentence**: 0–0.45 s after onset [R3]; +0.29 s median [R4]; R1 on the sentence start; R5 on discourse markers ("But", "So", "Imagine", "Then there are") | R1, R3, R4, R5 `[ASR?]` |
| enumeration | **one item per spoken item word**; leads 460/310/130 ms [R1]; checklist rows 41.38–48.25 [R2]; per item word [R3]; check rows on sentence onsets −0.19…+0.05 [R4]; one lit node per noun [R5] | all `[ASR?]` |
| display slam / hero | leads ≈0.25 s [R1]; +220 ms [R2]; +137 ms ASR ≈ on the audible word [R5] | `[ASR?]` |
| connector draw | on the flow keyword −0.10…+0.16 s [R4]; +390 ms [R5] | `[ASR?]` |
| stamp / verdict | leads 430 ms [R1]; +277 ms ASR [R5] | `[ASR?]` |
| section label / panel | leads the noun by 0.4–1.5 s [R2]; free beats lead 0.4–2.6 s and **never lag >0.3 s** [R3] | `[ASR?]` |
| kicker / secondary | free-running, 0.5–1.5 s after the primary | R5 |
| share word-anchored | 76% within ±0.3 s, 15% free [R1]; 78.5% / 16.6% / 4.9% [R2]; 48% / 52% leading [R3]; 56% word / 15% sentence / 28% free [R5] | — |
| **Canonical default (pending the offset check)** | Primary beats land **0 to −250 ms before the audible word**; section labels lead −0.4…−1.5 s; never lag >+0.3 s audible. Our current "small fixed lead" needs a per-type lead table. | synthesis |

**Fixed timers vs word-anchored:**
- Use a timer for non-spoken sets: chips 52 ms, rows 87 ms, cells 600 ms / 60 [R1]; random-order cascade 54 ms [R2]; chips 133, code 233, tree 250 [R3]; table 400, grid 239, cost 1,100, trio ≈650 [R4]; evidence 250–270, icons 375 [R5].
- Word-anchor spoken enumerations [all].
- Timer lists are **front-loaded**: the table finishes 1.2 s before the voice [R4]; 60–70% of elements arrive in the first 600 ms [R1].

### 7.3 Build order (choreography)

| Profile | Order |
|---|---|
| DH | title (if any) → container/world 130–250 ms → items L→R / top→bottom at 50–100 ms → numbers start counting → tag/verdict 0.5–1.5 s later on its word [R1]; label → slot module → keyword pops; long tweens only for value changes [R2] |
| LC | cut frame: chrome swap + title starts → +33–67 ms content group → first discrete beat +0.17–0.7 s → timer lists → connector draw → packet (spawns before the draw ends) → loops through the hold [R4]; parent → children → connectors → annotation last [R3] |
| DC | swap frame builds subheader + primary module → one lit event per key noun → mono kicker +0.5–1.5 s; ≤2 simultaneous tweens [R5] |

### 7.4 Sentence type → treatment

| Sentence type | DH (R1, R2) | LC (R3, R4) | DC (R5) |
|---|---|---|---|
| hook / chapter question | blank + title slot (+ mascot ×1.19) [R1] | title + full-answer diagram in 1.5 s [R3]; title + card + tile pops at 0.53 s [R4] | "?" box + ring pulse [R5] |
| definition / name | display slam + mascot punch + underline [R1] | module-title card [R3] | serif hero + kicker |
| enumeration | one pop/light per item word [R1,R2] | one card per item word [R3]; table rows on a 400 ms timer / check rows on sentences [R4] | one dim→lit per noun |
| number / magnitude | counter (ease-out) or display slam [R1]; hero slam / counter [R2] | display number (blue) [R4]; **no counters** [R3,R4] | mono cell highlight, **never a counter** |
| escalation | ease-in counter + global recolour + punch [R1] | stepper "Version N" + brick display [R4] | new chapter |
| negation / "instead of" | **strike** [R1,R2] | red annotation `≠` [R3]; brick-text warning box [R4]; **never strike** | strike, or a NOT THIS / THIS sub-state pair |
| cause → effect / flow | cars flow, connector draw, fan curves [R1]; token travel, cascade [R2] | connector draw + packet loop [R4]; V 2-card + connector [R3] | Bézier links draw / drop lines / token travel |
| state | HUD flip + recolour [R1]; recolour / dim / LIVE move [R2] | **append a new strip/alert** (never recolour) [R3] | dim→lit |
| comparison | side-by-side + seesaw [R1] | bar card [R3] | two-column compare |
| command / code | terminal typing [R1]; SQL typewriter [R2] | terminal typing 18 cps [R3]; code block [R4] | typed prompt, word-locked |
| time jump | label + stat/clock (`+7 DAYS LATER`) [R2] | — | timeline tick + serif year |
| place / "imagine a…" | world scaffold [R1] | — | full-width photo card, mascot hidden |
| split / scattered | — | chunk grid [R4] | grid split into 5 |
| combine / result | — | collapse morph → result card [R4] | nodes snap into a linked row |
| metaphor / analogy | persistent world re-used across chapters [R1]; stage scaffold [R2] | — | — |
| verdict / thesis | stamp / tag [R1]; 2-line headline [R2] | red annotation [R3]; statement boxes + logo equation [R4] | serif hero line |

### 7.5 Hook, ending, callbacks, continuity

- **Hook (0–3 s):**
  - [R1] the mascot slides in at 0.067 s, the title shows at 0.33, 4 beats land in 0.5 s, and the first joke comes by 3.5 s.
  - [R2] a title card with word tints, a hard cut at 1.68, then THE PROBLEM.
  - [R3] the full answer diagram by 1.5 s.
  - [R4] tile pops at 0.53 s.
  - [R5] the mascot at 0.2, the logo at 0.6, a node map drawn by 0.9.
  - **Rule:** real content on frame 0–1 and ≥3 beats in the first 1 s (ours: the dashboard is already built, but there is no hook scaffold).
- **Ending (last 5 s):**
  - Bookend callback to the opening world + slam, then dim/cut [R1].
  - 2-line summary headline + 200 ms fade [R2].
  - Terminal + red takeaway, no outro [R3].
  - Thesis statement boxes + logos [R4].
  - Links snap + serif hero line hold [R5].
  - **No CTA or logo end-card in any ref.**
- **Keep vs replace:** keep and mutate while the same entity set is discussed (carrier ≈125 s [R2]; highway mutated 14× [R1]; anchor row 28.8 s [R5]). Replace when the *question/domain* changes [R1,R2,R5]. LC always rebuilds a fresh copy [R3,R4].
- **Callbacks:** R1's highway returns 6×; R2's users row returns 5× and its chart 2×; R3's T template is used 6×; R4's 4-node diagram 11×; R5's card row returns 3×.
- **Entity continuity:**
  - Positions are fixed per entity: BLUE always left and GREEN right [R2]; the 4 nodes at fixed slots [R4]; folder order auth→billing→dashboard [R3]; the origin at the top of the road [R1].
  - IDs recur: `shop.example.com`, 1,240,000 3× [R1]; instance IDs across 17 scaffolds [R2]; `u42/f_1042` [R4]; SO-88214 [R5].
  - The storyboard must demand **3–6 specific, consistent numbers per scaffold** [R1].

---

## 8. Audio spec

| Item | R1 | R2 | R3 | R4 | R5 | Ours v2 | **Target** |
|---|---|---|---|---|---|---|---|
| integrated LUFS | −14.2 | −14.2 | −14.1 | −14.1 | −14.1 | −17.1 | **−14.1 ±0.3** |
| LRA (LU) | 1.4 | 1.2 | 1.0 | 1.3 | 1.4 | 2.1 | ≤1.4 |
| true peak (dBTP) | −0.5 | −0.7 | −1.1 | −1.1 | −1.0 | −3.2 | ≤ −1.0 |
| floor in pauses | gaps avg −21 dBFS (min −29) vs speech median −18.4; never below −41 | gaps median −19.8 vs speech −18.1; p5 −35.3 | gaps −20…−26 | **−38.5 dBFS** in a gap vs speech −15…−18 | gaps −28.6 / −30.6 vs speech −16.6 | p5 −59.1; 16.7% of 20 ms windows < −60 dBFS (refs 0.1–0.2%) | no true silence; <1% of windows < −60 |
| music bed | present (≈ −8…−10 dB under the VO, as suggested by R1) | continuous bed **or** heavy compression (not separable) | present, source unknown | **none detected** (a very low bed cannot be excluded) | low sub/pad at 33–112 Hz, **12–14 dB under the VO** | none (no music clip) | DH/DC: bed 10–14 dB under the VO; LC: optional (R3 yes, R4 no) |
| SFX | at most sparse: +18 dB >4 kHz burst at the BOT stamp, +7 dB at the pipe swap; none on slams/cuts | 13% of transients near beats (≈chance) | 0.251 vs 0.225 chance | 23.4% vs 24% chance | 19.9% vs 18% chance | 25 placements (9 boundary whooshes + 16 animation cues) | **not measurable**: cap at a sparse set (stamps/verdicts only) pending a listening pass |
| speech rate | 212 wpm | 221 wpm | 204 wpm | 194.9 wpm | 175.7 wpm | not measured | 176–221 by profile (DH ≈215, LC ≈200, DC ≈176) |
| pauses | pause >150 ms median 220, max 600; sentence gap median 190 (p90 350) | word gaps median 0.18, 9 gaps >0.3, max 0.48; sentence 0.18 | inter-sentence 0.1–0.35 (16 >0.25) | 0.1–0.6 | median 0.24, p90 0.42, max 0.78; sentence 0.20 | blank caption 3.50–3.73 suggests ≥230 ms | sentence gap ≈0.18–0.20 s, max ≤0.6–0.8 s |
| F0 (screening only) | n/a | median 219 Hz | median 213 Hz | n/a | n/a | ≈134.5 Hz [PREIMPL, unreliable] | not a gate; needs listening |

---

## 9. Gap matrix

Class: **T** tuning · **M** new module · **C** new capability · **A** asset. Effort: S ≤1 day, M 2–5 days, L >1 week. Priority: P0 / P1 / P2.

| # | Item | Reference canonical | Our v2 | Change needed | Class | Effort | P |
|---|---|---|---|---|---|---|---|
| 1 | Safe zones | top clear to 203–235; chrome row; content ≤1320 (DH) / ≤1343 (LC) / stage ≤840 (DC); caption band; bottom 19–21% clear; side 60 (dark) / 70 (light) [R1–R5] | HUD 214; content to 1380; side 44 | profile band constants; content bottom ≤1320 | T | S | P0 |
| 2 | Grid / columns | mascot col + 87–94 gutter + content 330–1020 [R1,R2,R3]; full-width 60–1020 when the mascot hides [R1,R2]; stage + panel [R5]; right-align axis 1020 [R1] | fixed 327–1010, mascot 17–274, no full-width mode | column constants + `layoutMode: column / full / stage` | T+C | M | P0 |
| 3 | Content bbox | 2–5 modules, 20–36% area, centroid 40–48% H [R1,R2,R4,R5] | one card, 33–40% area | storyboard density rules + module mix | T+M | M | P0 |
| 4 | Layout templates | 18 unioned templates (§3.3) | 1 | L1, L2, L3, L4, L9, L10 first; the rest by pilot need | M+C | L | P0 |
| 5 | Hierarchy | display : number : value : label ≈ 8 : 5.7 : 2.2 : 1 [R1]; hero : caption ≈ 2.4 [R5]; title 2.5× body [R4] | caption dominates; ≈3.3 : 1 | add display/title tiers; labels 17–22 tracked | T+M | S | P0 |
| 6 | Spacing rhythm | rows 54–62 (dark) / 55–78 (light); gaps 19 / 30–51 | 168–250 px row pitch | spacing tokens (§2.5) | T | S | P0 |
| 7 | HUD / status bar | DH: 960×70 at (60,235), #090D11, state pill + mono metrics, 1-f flips, retype [R1,R2]; LC/DC: no bar | static "LIVE • OK" at 214 | restyle + `hud_state` event track (flip/tick/retype) + per-profile chrome swap | T+C | M | P0 |
| 8 | Chapter / step / counter | title slot + tab strip [R1]; section labels + stepper [R2]; scene counter [R3]; stepper + footer counter + footnote [R4]; chapter label + 10-seg progress + subheader [R5] | none | 3 chrome modules (§4.2, §4.3) + title slot | M | M | P0 |
| 9 | Mascot | 222×782 feet at 1320 (DH) / 211×732 (LC) / 447×594 (DC); blink 3.2–5 s; slide-in 367–500 ms; hide in full-width; glance [R5]; punch [R1] | frozen SpongeBob 257×374 at y 940, always on | **rights-clean character asset** + behaviour runtime (§4.5) | A+C+T | L | P0 |
| 10 | Captions | 3 skins (§4.4) | ≈DH skin, 60 px, shadow #64A4FB, 1-f swap, blank gaps | DH: 62 px, #4497FF, 2-f crossfade, no blank; add LC + DC skins | T | S | P0 |
| 11 | Palette | §2.1–2.2; hue = role/domain; ≤2–3 hues | gradient bg, #151E2A cards, blue/green = entity only | theme token sets (dark DH/DC, light LC) + entity-role registry | T | M | P0 |
| 12 | Typography | 4 families; display/hero tier; mono for all numbers; tracked labels | Inter-ish + mono; sans numbers; fonts not bundled | bundle fonts; type scale tokens | T+A | M | P0 |
| 13 | Card / panel anatomy | dark r 6, 1.5 px, no shadow/top bar [R1,R2,R5]; light r 16 + soft shadow + window chrome [R3,R4] | r 16, 3 px coloured top bar, loose padding | C1/C2/C3 skins | T+M | M | P0 |
| 14 | Pills / chips | h 33 tint + dot [R1]; h 40–44 tint, no border [R3,R4]; few + dashed [R5]; stamp | outline LIVE/OK pills | X4 variants; X6 stamp (P2) | T+M | S | P0 |
| 15 | Icons / imagery | solid glyphs [R1,R2]; 3 px line icons in 105 tiles [R5]; line folder/file [R3]; logos [R1,R4,R5]; photos [R5] | dots only | icon set (user, instance, router, db, server, file, folder, branch, lock, chart, person, doc) + provenance | A | M | P0 (icons) / P2 (logos, photos) |
| 16 | Connectors | G1 family, draw-on, ghost → active, labels, no arrowheads | slider track only | connector primitive + `draw` op + edge labels | C | L | P0 |
| 17 | Charts / numbers / tables | counters + line charts [R1,R2]; tables [R1,R2,R4,R5]; grids; timeline; no counters in R3/R4/R5 | % text counters only | D1 (restyle, mono), D2 new, D4/D6 P1 | M | L | P0 (D1, D2) |
| 18 | Data realism | 3–6 consistent specific numbers per scaffold; IDs recur across hosts | good IDs, few numbers | storyboard prompt + cross-host ID validator | T (prompt) | S | P1 |
| 19 | Background | flat + static dot/line grid (§2.7) | gradient + olive wash + slab | background plate per profile | T | S | P0 |
| 20 | Module catalog | 21–33 modules per ref (§5) | ≈5–6 at production quality | P0 set (§5), then P1 | M | L | P0 |
| 21 | Entrances | §6: fade 133 / rise 4.5–24 / riseFade 22–233 / drop −50–220; staggers | 1–3 f pops; ≤3-item stagger | named preset library per profile | T+C | M | P0 |
| 22 | State changes | flip 1 f, recolour/light 133–167, dimOthers, retype, strike, counter, row insert/collapse, append-only (LC) | text/colour swap, knob, % | op library: `light`, `dimOthers`, `retype`, `severity`, `flash`, `rowInsert`, `rowCollapse`, `append` | C | L | P0 |
| 23 | Emphasis | DH: punch, stamp, ring, slam, flash; LC: none; DC: ring, stamp, glance, hero | outline ring highlight, glow dots | per-profile emphasis whitelist; remove glows | T+C | M | P1 |
| 24 | Exits / transitions | 1-f cut, chrome persists; R2 slot gap 1–4 blank f; mascot exit; carousel push [R5] | no cuts within the host | **host / slot / sub-state swap engine** (§10 Phase 1) | C | L | P0 |
| 25 | Ambient / process | DH flows/counters, 31% moving; LC-b packet loops with park rule; LC-a typing; DC none | 14% moving, holds frozen | A1 packet loop (finite, seek-safe), A2 typing, A3 flow; forbid UI loops in DC | C | M | P0 (A1) / P1 |
| 26 | Camera | DH only: push ×1.24 733 ms; FLIP ×1.41 433 ms; morph 467 ms [R1,R2]; none in R3–R5 | none | world/content-layer camera + FLIP reframe | C | M | P2 |
| 27 | Choreography | §7.3 build orders; front-loaded 60–70% in 600 ms | simple | build-order planner in the generator (parent → children → links → annotation → kicker) | C | M | P1 |
| 28 | Beat density | §7.1 per-profile bands | 1 host / 17.7 s; 80% identical frames | storyboard cadence rules + calibrated detector (diagnostic) | C | M | P0 |
| 29 | Word anchoring | §7.2 lead table `[ASR?]` | small fixed lead | per-beat-type lead offsets + cut-on-sentence-onset; verify the ASR offset first | T | S | P0 (after Q1) |
| 30 | Sentence → treatment | §7.4 per-profile rule table | partial (state → recolour) | generator rules + validator | C | M | P1 |
| 31 | Structure | hook: content on frame 0 + ≥3 beats in 1 s; acts/chapters; bookend ending; no CTA | single state arc | storyboard rules | C | M | P1 |
| 32 | Scaffold selection | keep/mutate vs replace; callbacks; 7–22 changes/min by profile | 1 scaffold | host-reuse + callback rules in the storyboard | C | M | P0 |
| 33 | Entity continuity | colour = role/domain; fixed slots; IDs recur; single-LIVE invariant | colours consistent; **both cards LIVE at 16.5 s** | entity registry + invariant checks | T | S | P0 |
| 34 | Voice | 176–221 wpm; sentence gaps ≈0.18–0.20 s; max pause 0.6–0.8 s | not measured | measure delivered wpm/pauses; trim silence with an aligned shift [PREIMPL] | T | M | P1 |
| 35 | Music / SFX / mix | −14.1 LUFS, LRA ≤1.4, TP ≤ −1; bed 10–14 dB under (DH/DC); no silence | −17.1 / 2.1 / −3.2; silent gaps; 25 SFX, no bed | loudnorm + limiter; licensed bed; SFX policy | T+A | S (loudness) / M (bed) | P1 |
| 36 | Export | 1080×1920 30 fps (refs are 720p re-encodes) | 1080×1920 30 fps 323 kb/s | none | ✓ | — | — |
| 37 | Style-profile system | 3 profiles × knobs (§1.3) | dark only, hard-coded | `styleProfile` config consumed by chrome/tokens/motion/storyboard | C | M | P0 |
| 38 | Font bundling | 4 families rendered deterministically | not bundled | ship font files + `@font-face` + a render check | A | S | P0 |
| 39 | Light theme | full LC token set (§2.2) | none | token set + light skins for every P0 module | T+M | M | P0 (after DH) |
| 40 | ASR offset calibration | DONE: Whisper starts early by +35…+260 ms median, per video (see note at top) | ours come from TTS alignment | set anchor lead ≈ 0 ± 100 ms around audible onset; verify our TTS word times against energy onset once in the pacing gate | T | S | P1 |
| 41 | Finite / seek-safe loops | loops end at the cut; park rule [R4] | past `repeat:-1` failures [ARCH] | loop helper: finite count derived from the host lifetime | C | S | P0 |
| 42 | Asset provenance | no copying of reference mascots / logos / photos / music [PREIMPL] | SpongeBob, unlicensed cues | provenance ledger per asset | A | S | P0 |

---

## 10. Implementation backlog (ordered phases)

Measurement method for acceptance:
- Render the pilot at 1080×1920 and run the audits' scripts (band scans, ink bboxes, per-frame diff, ebur128) on our MP4.
- Tolerances: ±3 px geometry, ±3/channel colour, ±1 f timing unless stated.
- The first pilot is DH on the blue-green topic (compare with R2 frames `design/R2/sbs*.png`).

### Phase 1: Host / slot / sub-state swap engine + style profiles + theme tokens (rows 24, 32, 37, 11, 19, 12, 38, 41; with 28)

- **Build:**
  - Multiple hosts per timeline. A host has named **slots** (R2 top slot), **sub-states** (R5 panel + subheader re-skin) and a `replace` mode (R3/R4 full rebuild).
  - Hard 1-f cut; optional R2 slot gap of 1–4 blank frames; chrome at the root.
  - Seek-safe state materialisation at every host mount.
  - `styleProfile` {DH, LC, DC} carrying tokens, bg plate, caption skin, chrome type, mascot rules, motion preset set, emphasis whitelist.
  - Bundled fonts. Finite-loop helper.
- **Acceptance:**
  1. A cut is a 1-frame content-diff spike, with neighbouring frames' mean diff ≤0.1/255 in the content zone (R5 E18 method). The chrome/HUD/mascot/caption regions are pixel-identical (±1 luma) across the cut, except for intended chrome updates (R3 E22).
  2. The first element of the new scene is visible on the cut frame or the next one (α ≥0.09, R3 E4). No empty content frame after any mount.
  3. 20 random-seek frames match the linear-play frames (bit-identical, or ≤0.5/255 mean diff).
  4. Corner/bg pixels: DH #000000 ±3; DC #090A0D ±3; LC #F4F4ED ±3.
  5. Dot pitch: DH 54 ±1 [R2]; LC 38 ±1 [R4]; DC grid lines at x = 60k ±1. Dot positions are identical at 4 timestamps (static).
  6. Surfaces: DH panel #090D11 ±3, border 1.5 px.
  7. `hyperframes check` passes with no font fallback. Glyph metrics match the bundled faces.
  8. Pilot cadence (60-s DH script): median host/slot/major-mutation life 3.4–8.1 s, 0 frozen holds >3.8 s without a process. The detector is diagnostic only.

### Phase 2: Chrome + captions (rows 1, 2, 7, 8, 10, 33)

- **Build:**
  - DH HUD with `hud_state` events (flip / tick / retype).
  - LC header (kicker + counter / stepper + rule), title + subtitle, footnote, optional footer.
  - DC chapter label + 10-seg progress + stage frame + subheader.
  - 3 caption skins. `layoutMode` column / full / stage. Single-LIVE invariant.
- **Acceptance:**
  1. DH HUD box x 60–1020 × y 235–305 (±2), fill #090D11, border #15191D 1.5 px, pill h 33 ±2. A pill flip completes in exactly 1 f. A retype runs 1 char/f delete and 2 chars/f type, with the pill recolouring in 1 f (R2 E16).
  2. DH caption y 1416–1532 (±3), centre x 540 ±2, font cap 45 ±2 (≈62 px), border 3 px, hard shadow +7.5…8 px with 0 blur in the profile accent, 2-f crossfade swap, and **no blank frames** inside a sentence.
  3. LC caption y 1452–1545 [R4] (or 1420–1510 [R3]), r 12, border 1.5 px #C5C7C2, 3-state karaoke hexes per §4.4.
  4. DC caption y 1444–1548, exactly 1 blank frame per chunk swap, 2-state #FBFEFF / #B0B4B9.
  5. LC header: kicker cap-top 230 ±3 at x 70; rule y 279; title cap-top 301 ±3; subtitle at y 471 fixed; counter increments on the cut frame only.
  6. DC progress: segments 26×3, pitch 34, x 687–1019; exactly one cyan segment; label and segment swap on the same frame as the content swap.
  7. `layoutMode: full` places content at x 60–1020 ±2 and hides the mascot in the same frame (R1) or after an exit tween (R2).
  8. The validator rejects any state with 2 LIVE cards.

### Phase 3: Mascot (row 9, 42)

- **Build:** a commissioned or owned character (provenance recorded), sprites open / blink / look-up / glance-L / glance-R (mouth ×2–3 in P1), and a runtime for enter / exit / hide / punch / blink / glance / sway.
- **Acceptance:**
  1. DH bbox 222×782 ±4 with feet at y 1320 ±3. LC bbox 211×732 at (66,612) ±3. DC 447×594 at (0,783) ±3.
  2. Entrance slide completes in 11 f (DH) / 15 f (DC) with monotonically decreasing per-frame Δ (ease-out) and no overshoot.
  3. DH exit is ease-in over 7–10 f. Hidden ⇔ `layoutMode: full`.
  4. Blink: closed for 4–6 f, interval 3.2 ±0.3 s (DC) / 4.6–5.0 s median (LC), free-running and deterministic under seek.
  5. DC glance 21–27 px over 13 f, fired only on beats tagged hero/key-noun.
  6. The mascot never overlaps a panel's bbox (DH/LC).

### Phase 4: P0 modules + op library (rows 3, 4, 5, 6, 13, 14, 15-icons, 16, 17, 20, 21, 22, 25-A1)

- **Build:**
  - Modules: C1 panel, C2 window card, C3 entity card (R2 env card first), C6 statement card, G1 connector family, G2 node tile, G3 packet/token + A1 loop, G4 users row, G5 router + lever, D1 counter (mono), D2 table, D3 row list, X1 title block, X2 display/hero, X3 annotation, X4 pills/tags, X5 strike/underline.
  - Ops: `draw`, `light`, `dimOthers`, `strike`, `count`, `retype`, `rowInsert`, `travel`, `loopPacket`.
  - Motion presets per §6. Icon set.
- **Acceptance:**
  1. Env card 333×350 ±3, rows at 54 px pitch, whole-card tint #091931 / #032815 ±3 (R2 sbs1).
  2. Router pill 690×64 at y 780.
  3. Lever travel 490 px in 18 f, ease-in-out with peak velocity at 50–60% of the duration (R2 E4). Counters run in lock-step, 500–600 ms.
  4. Connector draw 9–13 f regardless of length. An orthogonal active stroke 4.5 px over a 3 px ghost; the label breaks the line (R4). No arrowheads.
  5. Packet speed 337–468 px/s constant, loop period ≤1.6 s. It parks when fewer than 1 period remains before the cut.
  6. Strike 167–280 ms L→R.
  7. Counter 0→N in 500–1,400 ms ease-out, with digits changing on every frame.
  8. Table rows at a 60 px pitch with 1.5 px hairlines.
  9. Display slam scale 1.15→1.0 in 4 f, no rebound (R2 E6).
  10. `light` dim ≈30% → 100% in 3–5 f (R5 E4).
  11. Moving-frame share on the DH pilot ≥25% (R1 31%). Identical-frame share ≤55% (R2 ≈50%).

### Phase 5: Storyboard / timing rules (rows 18, 27, 28, 29, 30, 31, 32, 40)

- **Build:**
  - ASR-vs-audible calibration (row 40) first.
  - Per-beat-type lead table (§7.2), cut on sentence onset, build-order planner, sentence-type → op rules per profile, hook/ending rules, callbacks, 3–6 consistent numbers per scaffold.
- **Acceptance:**
  1. The ASR bias is measured on ≥20 words across refs and ours, and the correction is applied.
  2. ≥75% of primary beats land within −250…+100 ms of the audible word (R1 76%, R2 78.5%). No beat lags >+300 ms audible.
  3. Cuts fall 0–450 ms after the sentence onset (R3/R4).
  4. Frame 0 has content, with ≥3 beats in the first 1.0 s.
  5. Negation sentences map to strike (DH/DC) or annotation (LC) in 100% of cases.
  6. Every scaffold carries ≥3 concrete values that recur where the entity recurs.

### Phase 6: Audio (rows 34, 35)

- **Acceptance:**
  1. Integrated −14.1 ±0.3 LUFS, LRA ≤1.4, TP ≤ −1.0 dBTP.
  2. <1% of 20 ms windows below −60 dBFS.
  3. Bed (DH/DC) sits 10–14 dB under the VO in gaps.
  4. Delivered pace within the profile band (176–221 wpm), sentence gaps median 0.18–0.24 s, max ≤0.8 s.
  5. SFX limited to the verdict/stamp class until a listening pass decides otherwise.

### Phase 7: LC profile port + P1 modules

- **Build:**
  - Light skins for all P0 modules.
  - Modules: C7, C8, C9, D4 line chart, D5 bar, D6 grid, G6 fan/tree, X7 tabs/stepper, X8 code block, U1 browser, U2 terminal, U3 console, U4 compare.
  - Processes: A2 typing, A3 flow.
  - Motion: `riseFade`, `diagSettle`, `pop` presets. Emphasis whitelist. Append-only mode.
- **Acceptance:**
  1. A LC pilot (procedural topic) matches the R4 band geometry ±3.
  2. Scene median 4.2–5.0 s. Each scene rebuilds from empty, with α ≥0.09 on the cut frame.
  3. `riseFade` is 22 px over 7 f with α 0.18–0.27 on the first visible frame (R3 E1).
  4. Typing at 18 cps (R3 E17). Line chart draw 16 f ease-in (R1 E11).

### Phase 8: DC profile port + P2 modules + camera

- **Build:**
  - DC stage/panel templates (L11, L5, L14, L15, L16) and the serif hero.
  - Modules: timeline, letter tiles, access ring, carousel push, photo card (licensed photos only).
  - DH extras: worlds (highway, swarm, map), camera push/FLIP, stamp, ring.
- **Acceptance:**
  1. Sub-state mean 2.6 ±0.5 s with no gap >3 s.
  2. Carousel push takes 20 f with an ease-in exit and ease-out entry (R5 E6).
  3. Camera push ×1.24 over 22 f `power1.inOut` on the world layer only, with chrome pixel-identical (R1 E4). FLIP ×1.41 over 13 f (R2 E9).

---

## 11. Conflicts & open questions

### 11.1 Measured conflicts (both values shown, with the pick)

| # | Topic | Values | Pick & reason |
|---|---|---|---|
| Q1 | **ASR timing offset** | R5: Whisper runs 0.25–0.30 s early (3 checks). R1/R2/R3/R4 report leads and lags against the same kind of ASR | Every lead/lag is `[ASR?]`. If confirmed, the refs converge on "visual on or ≤250 ms before the audible word". Phase 5 is blocked on this. |
| Q2 | R1 mascot entrance | E1: 11 f = 367 ms, ≥204 px, ease-out quad. §9 of the same audit: 13 f = 433 ms, 225 px travel | 367 ms. It matches R2 (367 ms) and E1 is the fitted measurement. |
| Q3 | Number treatment | counters ≈20× [R1] and several [R2]; **no counters** [R3,R4,R5]; R5 uses a cell highlight | profile-scoped: counters only in DH. |
| Q4 | Negation treatment | strike [R1,R2,R5]; never strike, red annotation instead [R3]; brick warning box [R4] | profile-scoped (DH/DC strike, LC annotation). |
| Q5 | R4 transition | atlas: ≈150 ms crossfade; R4 audit: hard cut out + 233/300 ms fade-rise in (frame-measured at 4 cuts) | hard cut (frame-level evidence). |
| Q6 | Caption size / skin | 66 [R1] vs 62 [R2] (DH); 52 [R3] vs 50 [R4]; box y 1420–1510 [R3] vs 1452–1545 [R4]; active word = accent [R1–R4] vs white 2-state [R5] | DH 62 (R2 topic match); LC R4 geometry (full chrome incl. footnote); DC as measured. |
| Q7 | DH dot grid | pitch 60, peak #262626 [R1] vs pitch 54, peak #101010 [R2] | R2 (topic match, and pitch = row pitch 54). A human should pick if one DH look is wanted. |
| Q8 | LC dot pitch / accent | 32 px, red accent [R3] vs 38 px, blue accent [R4] | LC-b (R4) default; LC-a as a variant. |
| Q9 | HUD radius | ≈6 [R1] vs ≈9 [R2] | 6 (it matches the panel r 6 system). Low stakes. |
| Q10 | Title-slot y (DH) | ink y 382–416 [R1] vs cap-top 342 [R2] | 342 (R2), because the R2 top slot starts at 334. |
| Q11 | R4 connector ease | "quad-out, per-frame speed falls linearly" (measured) vs token table `power2.out` | `power1.out` (the measured profile). |
| Q12 | Mascot mouth | animated eyes/mouth [R1]; mouth flap [R2]; none [R3,R4,R5] | blink + glance at P0; mouth flap P1 for DH only. |
| Q13 | Music bed | present [R1,R3,R5]; ambiguous [R2]; absent [R4] | a bed for DH/DC; optional for LC. Source and licence need a human decision. |
| Q14 | Mascot overlap | never overlaps panels [R1–R4] vs overlaps the stage bottom and hero text [R5] | profile-scoped. |

### 11.2 Not assessable in the audits

- Exact font faces (visual IDs only) [R1–R5].
- Voice timbre and emphasis [R1–R5].
- SFX presence and genre, and bed instrumentation [R1–R5].
- Master resolution before the IG re-encode [R1–R5].
- Our own word-level anchoring lag (no v2 ASR in evidence) [R2].
- Our entrance timings per element [R4,R5].

### 11.3 Decisions needed from a human

1. **Profile order:** DH first (R2 topic), then LC, then DC? Or does one profile become the house style?
2. **Mascot:** commission an original character. Do we use one character across all profiles (the proportions differ: 222×782 vs 447×594) or one per profile? Is a mouth flap required?
3. **Music bed:** source and licence. Level 10–14 dB under the VO.
4. **SFX policy:** keep our 25 cues, cut to sparse verdict hits, or remove until a listening pass.
5. **Brand chrome:** the footer brand + handle text (R4 style) and the HUD host label. Is our `@example` handle a real default?
6. **Logos / photos** (R1 Cloudflare/AWS, R4 Postgres/S3/Drive, R5 photos): allowed with licensed sources, or replaced by generic glyphs?
7. **Acceptance gates:** confirm that the cadence and beat bands are **diagnostic, not hard fail gates** (per PREIMPLEMENTATION_DECISION), except for the frame-exact chrome and geometry checks.
8. **Legacy catalog:** retire the 64 legacy components once the P0 set exists, or keep them behind v1 until the pilots pass?

---

## 12. Decisions (user, 2026-09-25)
- First profile to parity: **DH dark-HUD-persistent (R1/R2)**; LC and DC follow on the same system.
- Mascot: **blink + glance + slide in/out + scale punch, no lip-sync** (SpongeBob placeholder art, pose variants as needed).
- Music bed: **none for now**; voice-only master at −14 LUFS.
- QA: reference bands are **hard gates with bounded auto-repair**, not diagnostics.
