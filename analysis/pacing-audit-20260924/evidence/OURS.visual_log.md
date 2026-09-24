# OURS — frame-by-frame visual log (cs-b9d30fa7964c0cf0.mp4, 1080x1920, 70.2 s, 1.8x sped-up)

Method: read all 24 contact sheets (0.00–70.2 s @ 8 fps), 23 strips at 30 fps (every frame), 1 full-res frame (24.5 s) for layout measurement, numeric checks on `OURS.frames.npz` (per-cell change) and a dedicated mascot-crop diff over all 2107 frames.
All durations = measured on screen; "auth" = implied authored GSAP duration (x1.8).

## Caption style (logged once)
- Box: dark fill, 2 px blue outline, rounded; y 1378–1458 px (71.8–75.9 % of height), x 65–1014 (88 % width). Measured on the 24.5 s full-res frame.
- Text: bold sans, cap height ~35 px (font ~40 px ≈ 2.1 % of frame height). White, with ONE keyword per chunk in blue (e.g. "**hash table's** O(1)" 1.0 s, "collision. In an" 6.4 s, "user IDs produce" 15.4 s). Highlight is static per chunk. It is not a karaoke/per-word sweep.
- Chunking: 2–4 words per chunk (e.g. "Why does your" / "hash table's O(1)" / "instant lookup suddenly" / "crawl at O(N)"). Chunks hold ~0.6–1.6 s. Rough estimate: 60–70 chunks across the video.
- Change behaviour (strip 1.80–2.27): old chunk fades out 1.90→1.97 (~67–100 ms, auth ~120–180), then 100–130 ms with **no box at all** (2.00–2.10), then the new chunk fades in 2.10→2.17 (~67 ms, auth ~120). There is no slide or scale. The box itself blinks off between chunks. Longer blank caption gaps: 26.25, 31.25–31.5, 48.9–49.1, 57.63–58.0, 62.73–63.1, 68.0–68.75 (~0.75 s).

## 1. BEAT LOG (caption chunk changes excluded; see style above)

| t (s) | what changed | region (% height) | measured dur (auth x1.8) | narration at that moment | anchored? |
|---|---|---|---|---|---|
| 0.00 | Empty dark card already on screen with no content (placeholder) | 30–58 % | — | "Why@0.00" | n/a |
| 0.13–0.43 | Mascot (SpongeBob sticker) pops in: opacity + slight scale-up | 85–96 %, bottom-left | 300 ms (540), ease-out | "Why does" | free |
| 0.67–0.80 | Title "Hash Collision" fades in; blue underline grows 0.73→0.80. First caption appears 0.67 | 33 % | 133 ms (240) fade; underline 67 ms (120) | "your hash@0.88" | ~anchored (topic word 0.2 s later) |
| 0.80–5.50 | **HOLD**: card holds only the title. Lower 2/3 of card is empty | — | 4.7 s | whole hook sentence + "The culprit" | — |
| 5.50–5.63 | Body text "When two distinct keys produce the exact same array index…" fades in (opacity only) | 36–42 % | 133 ms (240), ease-out | "culprit@5.46" | anchored |
| 6.73 | Hard cut OUT: card vanishes in 1 frame (6.70→6.73). There is no exit animation | — | 1 frame | "collision.@6.20" ends | sentence boundary |
| 6.73–6.90 | Empty frame | — | 167 ms (300) | "In@6.86" | — |
| 6.90–7.10 | Paragraph "In an ideal world… passes through a ____ that … in a ____ ." fades in. Keyword slots are blank | 41–49 % | 200 ms (360) | "In@6.86 an ideal" | anchored |
| 9.83–10.07 | Green marker wipe L→R reveals "hash function" | 44 % | 233 ms (420), linear | "hash@9.72 function@9.90" | anchored |
| 10.13–10.33 | Purple marker wipe reveals "fixed array" | 47 % | 200 ms (360), linear | "that generates@10.56" (said "fixed array" at 12.52) | **free, 2.4 s early** |
| 10.33–13.13 | HOLD, pixel-identical (change 0.00000) | — | 2.8 s | "clean integer index in a fixed array" | — |
| 13.13 | Hard cut OUT. HUD pill switches OK (green) → DEGRADED (red) in 1 frame | 0–4 % + content | 1 frame | "So@13.30" | sentence boundary |
| 13.13–13.77 | Empty frame (HUD, mascot, caption only) | — | 633 ms (1.14 s) | "So what happens" | — |
| 13.77–13.90 | Red PROBLEM card ("Two distinct keys hash to the exact same bucket index") fades in with a few-px slide | 36–42 % | 133 ms (240), ease-out | "happens@13.88" | sentence-level only (content matches 14.5–17.2) |
| 13.90–18.63 | HOLD | — | 4.73 s | "two totally different user IDs … modulo remainder?" | — |
| 18.63–18.80 | Green SOLUTION card fades in and rises ~2 px. The problem card dims slightly | 44–50 % | 167 ms (300) | "Both@18.22 keys collide@18.80" | anchored (+0.4 s) |
| 19.97 | Hard cut OUT. HUD DEGRADED → DEPLOYING (amber) | — | 1 frame | "bucket.@19.60" ends | sentence boundary |
| 20.00–21.67 | Near-empty frame: only 2 stray 1-px dots (future edge anchors) | 42 % | 1.67 s (3.0 s) | "How do standard implementations" | — |
| 21.67–22.10 | 3 nodes stagger in (fade + small x-slide): Bucket #4 at 21.67, user_42 at 21.83, user_99 at 21.97. Stagger 150–167 ms | 37–50 % | 133 ms each (240); stagger 160 (290) | "implementations@21.28 handle@21.94" | **free** ("linked list" is said at 25.86, 4 s later) |
| 22.17–22.50 | Edges draw L→R, plus "head"/"next" pills | 43–46 % | 333 ms (600) | "this overflow@22.80" | free |
| 22.50–27.43 | HOLD, pixel-identical | — | **4.93 s** | "Runtimes store colliding elements inside a linked list attached…" | — |
| 27.43 | Hard cut OUT (diagram gone in 1 frame) | — | 1 frame | "Now,@27.62" | sentence boundary |
| 27.43–27.73 | 5-step stepper labels + unlit dots stagger in (dim grey) | 44–47 % | 300 ms (540) total | "Now@27.62" | sentence-level |
| 27.73–30.50 | HOLD: stepper sits unlit | — | 2.77 s | "what does look up look like under the hood?" | — |
| 30.50 | Step 1 "Hash Key": dot turns green (1-frame switch), step title fades in 30.50→30.60, progress line starts | 42–47 % | dot 1 frame; title 100 ms (180) | "retrieve@30.42" | sentence-level ("hash" said 31.48) |
| 31.00 | Step 2 "Locate Bucket" (purple). Line grows 31.03→~31.30 | same | title 100 ms (180); line ~270 ms (480) | "the@31.00 hash" | free |
| 31.50 | Step 3 "Traverse Node 1" (orange) | same | same | "table@31.64" | free |
| 32.00 | Step 4 "Traverse Node 2" (red) | same | same | "walk@32.04" | coincidental |
| 32.50 | Step 5 "Match Key" (blue). Line reaches the end | same | same | "every@32.30 single@32.92" | free |
| (cadence) | Steps fire on a metronomic 500 ms grid (auth 900 ms), independent of words | | | | |
| 34.30 | Hard cut OUT | — | 1 frame | "sequentially.@33.74" ends | sentence boundary |
| 34.30–35.20 | Empty frame | — | 900 ms (1.6 s) | "When N" | — |
| 35.20–35.30 | Small grey subtitle "When all N keys pile into a single bucket" fades in | 31 % | 100 ms (180) | "N@35.16 items" | anchored |
| 35.97–36.10 | Big blue "O(N)" fades in (opacity, maybe a slight scale) | 34–39 % | 133 ms (240) | "exact same@36.14" | **free** ("O(N)" said 41.50) |
| 36.10–40.75 | HOLD | — | 4.65 s | "finding your target requires N key comparisons. Your constant lookup" | — |
| 40.75–40.87 | Small white line "constant time lookups degrade into linear array scans" fades in | 41 % | 133 ms (240) | "degraded@40.88" | anchored |
| 41.97 | Hard cut OUT. HUD → DEGRADED | — | 1 frame | "But@42.00" | sentence boundary |
| 42.00–43.30 | Empty frame | — | 1.3 s (2.35 s) | "But what happens when an" | — |
| 43.30–44.40 | Green particle swarm spawns (dots appear and spread into a blob) | 25–65 % | 1.1 s (2.0 s), ramp-in | "attacker@43.14 intentionally crafts" | anchored |
| 44.40–47.23 | Near-hold: faint twinkle only (12 frames with change >0.05 %) | — | 2.8 s | "thousands of distinct POST keys that all" | — |
| 47.23–47.30 | "COLLIDING KEYS" counter card fades in under the swarm | 60–64 % | 67–100 ms (120–180) | "compute@47.12" | anchored |
| 47.27–48.27 | Counter rolls 0 → 100,000: 51,866 at 47.50, 88,421 at 47.80, 99,999 at 48.27 | 62 % | 1.0 s (1.8 s), strong ease-out (expo-like) | "to identical hash codes" | anchored |
| 48.77 | Hard cut OUT (caption fades 48.80→48.87, then no caption until 49.10) | — | 1 frame | "This@48.68" | sentence boundary |
| 48.77–50.43 | Empty frame | — | **1.67 s (3.0 s)** | "This exploit, known as HashDOS," | — |
| 50.43–51.30 | Gauge fades in and fills 0→100 % with needle sweep: 51.9 % at 50.67, 88 % at 50.93, 100 % at 51.30 | 55–65 % | 870 ms (1.57 s), ease-out (power2/3) | "pegs@50.26 server CPU@50.76" | anchored |
| 51.30–55.13 | HOLD, pixel-identical at 100 % | — | 3.83 s | "cores at 100% capacity, just parsing a single malicious HTTP request body." | — |
| 55.13 | Hard cut OUT. HUD → DEPLOYING | — | 1 frame | "How@55.24" | sentence boundary |
| 55.23–55.30 | Grey, low-contrast "Linked List Chaining / Sequential scan with O(N)…" fades in | 40–46 % | ~100 ms (180) | "How@55.24 do modern runtimes" | sentence-level (content mismatched) |
| 55.30–57.97 | HOLD | — | 2.67 s | "fix this vulnerability?" | — |
| 57.97–58.37 | Vertical light-bar wipe L→R reveals "Red-Black Tree Conversion". Old and new titles overlap for 58.10–58.23 | 25–60 % | 400 ms (720), ~linear | "8@58.02 transforms@58.16" | anchored |
| 58.37–62.60 | HOLD, pixel-identical | — | 4.23 s | "bucket lists into balanced red-black trees once chained depth hits eight elements." | — |
| 62.60 | Hard cut: title and body vanish, blue underline stays. HUD → STABLE (green) | — | 1 frame | "Think@62.64" | sentence boundary |
| 62.60–65.63 | **Near-empty**: only a 60 px blue underline at 33 % | — | **3.03 s (5.45 s)** | "Think of a hash table as a mailroom with slot boxes." | — |
| 65.63–65.80 | Takeaway headline "Uniform key distribution and tree fallbacks keep your O(1) hash tables fast." fades in (large bold, 5 lines) | 34–46 % | 167 ms (300) | "Stuffing@65.26 all mail@65.82" | **free** (content is said at 68.38) |
| 65.80–65.93 | Underline thickens then settles (pulse) | 33 % | 133 ms (240) | "mail in" | free |
| 65.93–70.20 | HOLD to end | — | 4.3 s | "one box forces a manual search. Uniform hashing keeps lookups instant." | — |

Mascot: after 0.43 s the bottom-left crop diff is below threshold for every remaining frame. It is a 100 % static sticker for 69.8 s, with no blink, bob or reaction. I suspected the mascot was missing in the 62.75 s sheet tile; the 8 fps frame and the 30 fps strip both show it present, so that is refuted.
HUD: "@example" + status pill; pill hard-switches at 13.13, 19.97/20.0, 41.97, 55.17, 62.60 (1-frame colour/text swaps).

## 2. SCENE STRUCTURE (1 component per scene; every scene boundary lands on a sentence start ±0.5 s)

| # | range (s) | component (looks like) | beats inside | static after last beat → exit | transition out |
|---|---|---|---|---|---|
| 1 | 0.00–6.73 | TitleCard (heading + underline + body) | mascot pop, title fade, body fade 5.50 | 1.1 s (plus 4.7 s internal hold 0.8–5.5) | hard cut + 167 ms empty |
| 2 | 6.90–13.13 | Paragraph with marker highlights | fade-in, 2 marker wipes | **2.8 s** (plus 2.73 s hold 7.1–9.83) | hard cut + 633 ms empty |
| 3 | 13.77–19.97 | Problem/Solution callout cards | 2 card fades | 1.17 s (plus 4.73 s hold 13.9–18.63) | hard cut + 1.67 s near-empty |
| 4 | 21.67–27.43 | Linked-list node diagram | 3 staggered nodes + edges | **4.93 s** | hard cut, stepper builds immediately |
| 5 | 27.43–34.30 | Horizontal stepper / process timeline | label stagger, 5 step activations at 500 ms | ~1.5 s (plus 2.77 s unlit hold) | hard cut + 900 ms empty |
| 6 | 35.20–41.97 | Big-number / stat (O(N)) | subtitle, O(N), footnote | 1.1 s (plus 4.65 s hold 36.1–40.75) | hard cut + 1.33 s empty |
| 7 | 43.30–48.77 | Particle swarm + counter | spawn 1.1 s, counter card, roll-up 1.0 s | 0.5 s (plus 2.8 s near-hold) | hard cut + 1.67 s empty |
| 8 | 50.43–55.13 | Gauge (CPU load) | fade + sweep 0.87 s | **3.83 s** | hard cut + 100 ms |
| 9 | 55.23–57.97 | TitleCard, dim "before" state | fade | 2.67 s | **light-bar wipe 400 ms (720)**, the only designed transition |
| 10 | 57.97–62.60 | TitleCard "Red-Black Tree Conversion" | wipe reveal | **4.23 s** | hard cut; underline survives |
| 11 | 62.60–70.20 | Takeaway headline | 3.03 s empty, headline fade, underline pulse | **4.3 s to end** | end |

Transitions: 9 of 10 scene changes are a 1-frame removal of all content, followed by 0.1–3.0 s of empty or near-empty frame, then an opacity fade-in. There is no cross-dissolve, push, match-cut or carried element (the only exception is the underline kept at 62.6). The machine `cuts=0` is wrong in spirit. These are real cuts, but the background is identical on both sides, so the colour-histogram detector does not fire.

## 3. The 10-point analysis

**(1) Log**: see §1. Visual count: 37 non-caption beats (plus about 60–70 caption chunk swaps).

**(2) Gap distribution** (37 beats, gap to next): median 1.23 s, mean 1.89 s, p25 0.50, p75 3.03.
Buckets: <0.2 s: 5, 0.2–0.4: 2, 0.4–0.7: 7, 0.7–1: 2, 1–2: 8, 2–3: 2, 3–5: 10, >5: 1. Gaps longer than 2 s cover **74 %** of the runtime.
Longest holds, with what is on screen:
- 22.50–27.43 (4.93 s): static 3-node linked list, edge-to-edge.
- 0.80–5.50 (4.7 s): card with the "Hash Collision" heading only; the rest of the card is empty.
- 13.90–18.63 (4.73 s): a single red PROBLEM card at 36–42 %.
- 36.10–40.75 (4.65 s): O(N) plus a tiny subtitle.
- 65.93–70.20 (4.3 s): takeaway text.
- 58.37–62.60 (4.23 s): Red-Black Tree title card.
- 51.30–55.13 (3.83 s): gauge frozen at 100 %.
- 62.60–65.63 (3.03 s): nothing but a 60 px underline.

Pixel-identical holds (change = 0.00000 in npz): 7.2–9.8, 10.4–13.1, 22.6–27.4, 51.4–55.1, 58.4–62.6, 62.9–65.6.
Empty or near-empty frames total about 9.5 s (13.5 %): 6.73–6.9, 13.13–13.77, 20.0–21.67, 34.3–35.2, 42.0–43.3, 48.77–50.43, 55.13–55.23, 62.6–65.63.

**(3) Rates**: 31.6 non-caption beats/min. Machine: 34.2/min (40 beats). Scene changes: 10 in 70.2 s = **8.5/min** (9 hard cuts + 1 wipe). Scene length is 2.7–7.6 s, mean ~6.4 s.

**(4) Narration sync**: of 26 content-entrance beats, about **11 are word-anchored (42 %)**: 5.50, 6.90, 9.83, 18.63, 35.20, 40.75, 43.30, 47.23, 47.27, 50.43, 57.97. Another 5 are sentence-level only (13.77, 27.43, 30.50, 55.23, 0.67). About 10 are free-running (10.13, 21.67–22.50 ×2, 31.0–32.5 ×4, 35.97, 65.63, 65.80).
All 10 scene boundaries are sentence-anchored (±0.5 s): the scheduler clearly works at sentence granularity, not word granularity.
Beats per sentence: 18 sentences, 37 beats → 2.1 (machine 2.2). Seven sentences get **0** in-scene beats: 0.0–4.76 after 0.8, 13.3 (content), 20.46, 23.80–27.20, 27.62, 51–54.9 tail, 62.64, 65.26.
Machine word-onset hit rate 0.60 vs 0.525 chance, which means barely better than chance.

**(5) Motion durations and easing (30 fps strips)**:

| beat | start→settle | measured | auth x1.8 | curve |
|---|---|---|---|---|
| mascot pop | 0.133→0.433 | 300 ms | 540 | fade + scale-up, ease-out, no overshoot |
| title fade | 0.667→0.800 | 133 | 240 | opacity, ease-out |
| body text fade | 5.500→5.633 | 133 | 240 | opacity only |
| scene exit (all) | e.g. 6.700→6.733, 13.100→13.133, 19.967→20.000, 27.400→27.433, 34.267→34.300, 48.733→48.767, 62.567→62.600 | 1 frame | — | hard cut, no exit tween |
| paragraph in | 6.900→7.100 | 200 | 360 | opacity, ease-out |
| marker wipe | 9.833→10.067 | 233 | 420 | linear L→R clip |
| problem card | 13.767→13.900 | 133 | 240 | opacity + ~few-px slide, ease-out |
| solution card | 18.633→18.800 | 167 | 300 | opacity + ~2 px rise |
| node stagger | 21.667→22.100 (3 × 133, 160 gap) | 433 total | 780 | opacity + small x-slide |
| edge draw | 22.167→22.500 | 333 | 600 | stroke draw, ~linear |
| stepper labels | 27.433→27.733 | 300 | 540 | stagger fade |
| step activation | dot 30.467→30.500; title 30.500→30.600 | 1 frame / 100 | — / 180 | hard switch + fade |
| O(N) | 35.967→36.100 | 133 | 240 | opacity (possibly a tiny scale) |
| particle spawn | 43.300→44.400 | 1100 | 1980 | progressive spawn |
| counter roll | 47.267→48.267 | 1000 | 1800 | strong ease-out (~50 % at 23 % of time) |
| gauge sweep | 50.467→51.300 | 833–870 | 1500–1570 | ease-out (52 % at 24 % of time); machine "rebound" at 50.8 is the tail, not overshoot |
| light-bar wipe | 57.967→58.367 | 400 | 720 | ~linear sweep |
| takeaway fade | 65.633→65.800 | 167 | 300 | opacity |
| caption swap | out 1.900→1.967, gap to 2.100, in 2.100→2.167 | 67–100 / 133 / 67 | 120–180 / 240 / 120 | opacity only |

No overshoot, bounce, spring, elastic or anticipation appears anywhere in the video. Every entrance is opacity-led; spatial travel is ≤ a few px. Machine peak_pos median 0.1 agrees: the motion is ease-out.

**(6) Camera**: **absent**. There are no zoom punches, shake, parallax, pans or push-ins in any sheet. The background is pixel-static across all holds (npz change 0.00000; corner luminance 19.2 ±0.2 all video). Nothing moves in the background layer.

**(7) Color**: the background is near-black (#0b0d10-ish) with very dim, blurred, static bokeh blobs (blue top-left, red top-right, amber/green lower). Accent hues are used per item, not as one uniform accent:
- blue: captions keyword, underlines, O(N), gauge, Match Key
- green: "hash function" marker, SOLUTION, particles, counter
- purple: "fixed array", Locate Bucket
- red: PROBLEM, Traverse Node 2
- amber/orange: Traverse Node 1, DEPLOYING pill

Simultaneous hues are typically 2 (machine: 76 % of frames = 2 hues; max 4 at the stepper 32.5–34.3). Saturated pixels median 1.8 % of the frame, so the frame reads mostly grey-on-black.

**(8) Iconography**: flat dark-UI cards (rounded rectangles, 1 px borders, Inter-like bold sans), pill badges, and 2 glyph icons only (red "!" circle, green check). Data widgets: stepper dots, gauge, counter, dot swarm. There are no concept illustrations: no mailbox for the mailroom metaphor at 62.6–67.8, no attacker, no Java/tree drawing for "red-black trees" (58–62.6, title text only). The one illustrative element is the static SpongeBob sticker.

**(9) Sound**: not assessable visually. There are no on-screen audio cues (no waveform, no beat-flash, no hit-frames). Machine audio data: prominent transients near a beat 6.6 %; beat-to-transient 0.2 vs 0.21 chance.

**(10) Layout / safe zone** (full-res 24.5 s frame + sheets):
- HUD bar: 0–75 px (0–3.9 %), "@example" handle + status pill.
- Main content: almost always in a narrow band at **31–50 %** of height. Title card 30–58 %, diagram 37.5–49.5 %, stepper 42–47 %, O(N) 31–41 %, takeaway 33–46 %. The particle/counter (25–64 %) and gauge (55–65 %) are the exceptions.
- Empty space: about 4–30 % (top) and about 50–72 % (between content and caption) are empty in nearly every scene. That is roughly 45–60 % of the frame empty at typical moments, and 90 %+ during the empty gaps.
- Caption: 71.8–75.9 %.
- Mascot: x 33–192, y 1630–1848 (84.9–96.3 %), about 160×220 px (15 % width, 11 % height), bottom-left, static.
- Bottom 72 px (96.3–100 %) are clear.
- The diagram at 21.7–27.4 runs x 5–1075, which leaves **5 px side margins** and breaks the 16 px-style safe gutter.

## 4. Why this feels slow (observed mechanisms)

1. **Long frozen holds after each build**: content lands in ~130 ms, then nothing moves for 4–5 s. Examples: 22.50–27.43 (4.93 s), 13.90–18.63, 36.10–40.75, 58.37–62.60, 51.30–55.13. Pixel-identical by npz at 22.6–27.4, 51.4–55.1 and 58.4–62.6.
2. **Empty frames between scenes (hard cut → void → fade-in)**: 48.77–50.43 (1.67 s), 20.0–21.67 (1.67 s), 42.0–43.3 (1.3 s), 34.3–35.2 (0.9 s), 13.13–13.77 (0.63 s), and the worst at 62.6–65.63 (3.03 s, underline only). Together about 13.5 % of runtime shows nothing but HUD, caption and mascot.
3. **Builds front-loaded, then idle, not distributed over the sentence**: each scene fires its beats within ~1 s of mounting and then waits. Examples: nodes at 21.67–22.5 while "linked list" is spoken at 25.86; O(N) at 35.97 while "OSN" is spoken at 41.50; "fixed array" highlighted at 10.13, spoken at 12.52.
4. **Metronomic, word-blind cadence**: stepper steps at exactly 30.5/31.0/31.5/32.0/32.5 (500 ms grid) regardless of narration. After that, 32.5–34.3 is static.
5. **Sub-perceptual, travel-less motion**: entrances are 100–200 ms opacity fades with ≤ a few px of travel and no overshoot (5.50, 13.77, 18.63, 35.97, 65.63). Exits are 1-frame cuts (6.73, 13.13, 19.97, 27.43, 34.30, 41.97, 48.77, 62.60). Changes register as pops, not motion, so the eye has nothing to follow between them.
6. **No camera layer and no ambient life**: zero zoom, pan or parallax anywhere. The background is pixel-static, and the mascot is frozen from 0.43 s to 70.2 s. Once a hold starts, the entire frame is literally a still image (7.2–9.8, 10.4–13.1, 62.9–65.6).
7. **Small content in a narrow band**: most information sits in the 31–50 % band at small type sizes. Examples: subtitle at 35.2, stepper labels at 27.4–34.3, the footnote at 40.75, and the grey "Linked List Chaining" at 55.2. The frame reads as mostly empty dark space.
8. **Metaphor and closing sentences get no visual**: the mailroom analogy (62.64–67.82) gets 3.03 s of empty frame and then a text-only takeaway. HashDOS (48.7–50.4) gets an empty screen.

### Visual bugs
- 0.00–0.63: an empty card placeholder is on screen before the title.
- 6.90–9.83 / 10.13: the paragraph renders with **blank holes** where "hash function" and "fixed array" go, plus an orphan "." on its own line. The words are invisible until the marker wipes, which is 2.9–3.2 s of broken-looking text.
- 20.0–21.67: two stray 1-px dots on an otherwise empty screen (edge anchors shown before their nodes).
- 21.67–27.43: the linked list spans x 5–1075 of 1080 (5 px margins), so the nodes kiss the frame edges. "head" label sits below the line, "next" above it.
- 27.43–34.30: stepper step labels ("Traverse Node 1" etc.) are tiny and near-illegible at phone size. The steps also sit unlit for 2.77 s.
- 50.43–55.13: the **gauge needle and hub overlap the percentage text** ("100%" is partly occluded for 3.8 s).
- 55.23–57.97: "Linked List Chaining" is rendered in low-contrast grey and looks disabled or broken.
- 58.10–58.23: during the wipe, old and new titles overlap ("Red-Black Tr" over "Linked List Chaining").
- 62.60–65.63: empty scene with only a blue underline (content not mounted for 3 s).
- Captions: the box disappears between chunks (e.g. 2.00–2.10, 48.90–49.10, 68.0–68.75). Caption text is only about 2 % of frame height.
- Mascot never animates after 0.43 s. It is also a copyrighted character (SpongeBob), which is an IP risk. The HUD handle is the placeholder "@example".

### Visual count vs machine beat list (40 beats)
- Machine **missed**:
  - the particle spawn 43.30–44.40 (tiny dots under threshold; the 41.97→47.23 "hold" is actually 1.1 s of motion plus 2.8 s of twinkle)
  - the edge draw 22.17–22.50 (absorbed into the 21.967 settle)
  - the 20.0 stray dots (merged with the cut)
- Machine **split** single visual events into several beats: highlight wipes (9.867/10.0/10.133), node stagger (21.667/21.833/21.967), gauge (50.433/50.567/50.8), wipe (58.0/58.133), final (65.667/65.8/66.067).
- Machine "rebound" flags at 18.567, 47.233, 50.8 and 65.8 are fade tails, the counter/gauge ease-out tail, and the underline pulse. **None is an overshoot.**
- Machine `cuts = 0` understates: there are 9 visual hard cuts (content removed on an unchanged background).
- Machine 0.133 is the mascot (rows 13–15 correct), and 48.300 is the counter reaching 100,000. Both are confirmed.
