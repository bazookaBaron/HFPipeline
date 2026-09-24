# Motion & Pacing Overhaul — Frame-by-Frame Evidence + Phase Plan (2026-09-24)

Scope: 5 reference reels (the target) vs. our render `control-panel/data/renders/cs-b9d30fa7964c0cf0.mp4`
("How hash collisions degrade O(1) lookup times to O(N)", 10 scenes, 1.8x sped up).
**This document is a plan only. Nothing in the pipeline has been changed.**

Evidence (all traceable): `analysis/pacing-audit-20260924/`
- `evidence/<KEY>.visual_log.md` — the literal beat log per video, built by reading **every** 8 fps contact
  sheet (24 frames / 3 s per sheet; 45–59 sheets per reference, 24 for ours) plus 16–29 full-30fps frame
  strips per video to measure real motion durations/easing. 2,430 lines of logs in total.
- `evidence/<KEY>.stats_excl.json`, `<KEY>.beats_excl.tsv` — machine pass over **every frame at 30 fps**
  (4×16 cell change grid, caption band excluded), audio onset analysis, hue census, row-occupancy profiles.
- `evidence/<KEY>.transcript.txt` / `.asr.json` — Whisper large-v3 word-level transcripts (local GPU, tts-venv).
- `tools/` — the scripts (`frames.py`, `beats.py`, `audio.py`, `strip.py`, `sheets.py`, `asr.py`), reusable as a regression gate (Phase 0).

Keys: R1 = DdEedoQM6j3 (DDoS, dark, 176.9 s) · R2 = DdG-RuwsDRc (blue-green, dark, 145.6 s) · R3 = DdSc-I9IqNC
(git worktrees, light, 134.5 s) · R4 = DdT5wzdsQWV (file upload, light, 169.7 s) · R5 = DdIM0QoiZre (Palantir
ontology, dark, 164.9 s, never analysed before) · OURS = cs-b9d30fa7964c0cf0 (70.2 s after 1.8x; 126.3 s authored).

**Two measurement caveats, stated up front:**
- The machine detector **cannot see cuts** in this style: header/mascot/background persist, so only 30–45 % of pixels
  change at a cut and the colour-histogram test never fires (it reported 0 cuts for all 6; visually there are 5–62).
  It also counts mascot blinks as beats (26 % of R4's machine beats). **All beat/cut numbers below are the
  visual counts**; machine counts are given only as a cross-check (they agree within ±15–25 % once blinks are removed).
- **SFX density could not be measured.** Validated against our own 25 known SFX cue times, the transient detector
  finds only ~9 of them above p99 (speech masks whooshes/soft clicks). So no SFX-per-beat number for the references
  is claimed anywhere in this doc. See "Not confident about".

---

## 1. Per-reference findings (summaries — full tables in the visual logs)

### R1 — DDoS (dark) · the densest
- **236 beats / 177 s = 79.7 beats/min.** Gap min 70 / **median 630** / max 2,380 ms; 122 of 234 gaps < 700 ms; none > 3 s.
- ~**51 one-frame content cuts** (~17/min) inside a frame whose status bar, background and mascot never change; 52 scaffold
  states, **mean lifetime 3.4 s**, ~4.5 beats each. The perspective-highway scaffold recurs 15 times, re-skinned.
- Narration sync: **76 % of beats within 0.3 s of the word they depict** (85 % if 0.3–0.9 s is included); 3.9 beats/sentence.
  Every enumerated noun gets its own pop: computers/routers/cameras 60.38/61.00/61.63; Cloudflare/AWS/CDN 121.25/122.25/123.50.
- Holds are never static: car traffic flows 16.6–22.3 and 164.3–168.2; counters run 8k→400k (23.90), 1k→1M (40.25), →4.998M dropped (132.38).
  The machine's "3.8 s hold" at 136.03–139.87 is refuted: a counter ticks 100→9,480 (136.25–137.1) and a row recolours at 138.63.
- Motion: entrances 67–170 ms, fade-led ease-out (browser 130 ms, "A DDOS ATTACK" 67 ms, mascot slide 170 ms). Bar 0→100 % in 630 ms with a
  clean ease-out profile. **One overshoot in the whole video** (BOT stamp 152.33, ~1.2→0.9→1.0 over 230 ms).
- Camera: zoom-out 270 ms ease-in-out at 7.10, slow 1.25 s push-in ≈1.25x at 28.0–29.25. The mascot **scale-punches ~1.3x in one frame** at escalations (9.20, 39.83). No shake, no parallax.
- Colour follows *state*, not item: cyan = OK, red = attack, amber = degraded, purple = botnet; usually 2 hues, peak 4 (123.75). Whole-screen state flip in 1 frame at 39.83.

### R2 — Blue-green deployment (dark) · same topic family as our earlier renders
- **163 beats / 145.6 s = 67/min.** Gap p25 500 / **median 870** / p75 1,250 / max 3,120 ms. Holds ≥2 s = only 6.4 % of runtime.
- **One persistent scaffold for ~125 s** (router pill + BLUE/GREEN cards, 5.9–131 s); only the slot above swaps: users 8.25 → browser 18.38 → console 39.63 → chart 66.00 → SQL 88.50.
  18 layouts total, mean lifetime 8.1 s; only **5 hard cuts** (1.68, 57.50, 75.60, 104.80, 142.13) + fast re-layouts = 7 layout changes/min.
- **78.5 % of beats land within 0.3 s of their word** — the word lights up as it's said: "blue"@11.36 → card blue 11.50; "green"@11.74 → 11.88; "18%"@71.28 → slams in 71.47.
- Counters make holds busy: traffic lever with % counters at 60.77, 78.75, 116.38, 122.25, 123.50, 124.25, 138.87 (500 ms symmetric ease-in-out, per-frame deltas 1,1,2,3,5,8,10,15,16,13,10,6,4,3,2,1).
- Entrances 100–133 ms ease-out (BLUE label 0.233→0.367); caption chunk swap 67 ms; strike-through 120 ms; version pill travel 730 ms ease-in-out (29.47→30.20); SQL typewriter ~53 char/s linear. **No overshoot on any strip.**
- Camera: one 430 ms ease-in-out push (129.90) and hard-cut zoom reframes (57.50, 75.60). Alarm moments are deliberately un-animated (503 black snap 4.500, 100 ms red flash 140.483).
- Colour: flat near-black; 2–5 hues, each with **one fixed meaning for the entire video** (blue/green = envs, orange = servers, purple = LB/DB, red = errors, amber = versions).

### R3 — Git worktrees (light)
- **156 beats / 134.5 s = 69.6/min**, median gap 600 ms, max 4,020 ms; bimodal (60 gaps < 400 ms bursts vs 63 > 1 s holds).
- **31 hard cuts = 13.8/min, every one 0–0.45 s after a sentence start** (10.10 vs "Normally"@10.10; 111.37 vs "Merge"@111.36).
  32 scaffolds numbered on screen "01 — 32", mean lifetime **4.2 s** (1.53–6.63), 3–9 beats each; only ~6 layout templates.
- **Front-loaded build**: each scaffold is fully built in 1–3 s then holds ~1.6 s (9 beats in 3 s at 91.40–94.40). New scene's first card starts fading **on the very next frame** after the cut (1.500→1.533, 7.000→7.033).
- 48 % word-anchored; free beats always *lead* their word by 0.4–2.6 s, never lag (> 0.3 s); 2.7 beats/sentence.
- Holds still move: caption active word advances every ~0.29 s, mascot mouth changes every 1–2 frames, typing ~15 char/s (15.30–16.27), agent cursors every frame (96.0–99.9).
- Entrances 133–200 ms ease-out, ≤1 % drift, no scale, no overshoot; line draws 270–400 ms linear/ease-in-out; **nothing ever exits** (elements accumulate until the cut). **Zero camera motion.**
- Colour: each branch keeps one colour for the whole video (main blue, auth purple, billing green, dashboard amber); up to 5 hues on small elements.

### R4 — File upload service (light)
- **144 beats / 169.7 s = 50.9/min** (the slowest reference), median gap 690 ms. 33 scaffolds, mean **5.14 s**.
- **Only one transition type**: ~150 ms opacity crossfade with 2–6 px rise, 27 of 33 within 0.3 s of the scene keyword (15.13 vs "validate"@15.28; 92.77 vs "client uploads"@92.82). 0 hard cuts.
- Same 4-node diagram reused ~10 times; each reuse redraws the connector **on the word** (ghost line recolours in ~300 ms, 13.367→13.667; 138.367→138.667).
- Lists run on a fixed clock, not words: chunk grid pops every 250 ms (108.13–110.83), table rows every ~375 ms leading narration by 0.6–1.4 s.
- **Ambient process motion never stops**: packets travel every connector on a ~1.6 s loop; mascot blinks (200 ms sprite swap every 4.4–5.5 s). Its longest *beat* hold (8.33 s, 154.4–162.7) is visually alive because of those loops.
- Big display type replaces diagrams at tension points ("Big bytes." 29.1, "5 GB" 50.7, "20 GB" 100.7). Entrances 100–167 ms, no overshoot/scale. No camera.

### R5 — Palantir ontology (dark, new)
- **202 beats / 164.9 s = 73.5/min**, median gap 633 ms, **max 2,734 ms** (no gap > 3 s); holds ≥ 2 s = 11 % of runtime.
- **62 one-frame content swaps (22.6/min)**, 0 transitions/crossfades; 10 chapters (10-segment top progress bar) → 33 scaffolds (mean 5.0, median 3.3 s) → 63 sub-states (~2.6 s each).
- 56 % word-anchored (typically 0.1–0.35 s *after* word onset), 4.6 beats/sentence. One event per spoken item: nodes light 42.00/42.25/42.75/43.125/43.75 for "people, places, events, documents, vehicles".
- Hold-fillers: small monospace labels land 0.5–1.5 s after each main beat (32.25, 63.5, 87.0, 121.75, 159.2) — keeps every hold < 2.73 s. Negation is animated (strikethroughs 31.125, 123.875; "NOT THIS / THIS" 94.97/97.23).
- Motion: 66–170 ms ease-out entrances; one "stamp" (≈130 % + 3° → 100 % in 167 ms, 4.917); strikethrough 267 ms; row push 570 ms. No overshoot, **no camera, no Ken Burns** on photos.

### Combined reference profile (the actual target)
| Metric (visual count) | R1 | R2 | R3 | R4 | R5 | **Target band** |
|---|---|---|---|---|---|---|
| Beats / min | 79.7 | 67.0 | 69.6 | 50.9 | 73.5 | **50–80 (median 69.6)** |
| Median beat gap (ms) | 630 | 870 | 600 | 690 | 633 | **600–870 (median 633)** |
| Max beat gap (ms) | 2,380 | 3,120 | 4,020 | 8,330* | 2,734 | **≤ ~3 s** (*R4's is filled by ambient loops) |
| Beats per word (beats ÷ ASR words) | 0.38 | 0.30 | 0.34 | 0.26 | 0.42 | **≈ 1 beat per 2.4–3.8 words** |
| Beats / sentence | 3.9 | 2.26 | 2.7 | 2.3 | 4.6 | 2.3–4.6 |
| Scaffold changes / min | ~17 | 7.0 | 13.8 | 11.3 | 12 (22.6 swaps) | **7–17** |
| Mean scaffold lifetime (s) | 3.4 | 8.1 | 4.2 | 5.1 | 5.0 | **3.4–8.1 (typ. 4–5)** |
| Word-anchored beats | 76 % | 78.5 % | 48 % | 46.5 % | 56 % | **~50–80 %; the rest lead their word, never lag** |
| Entrance duration / ease | 67–170 ms eo | 100–133 ms eo | 133–200 ms eo | 100–167 ms eo | 66–170 ms eo | **~70–200 ms ease-out, 2–6 px travel, no overshoot** |
| Scene transition | 1-frame cut | 5 cuts + reframes | 1-frame cut | 150 ms crossfade | 1-frame swap | **cut or ≤150 ms fade; new content on the next frame** |
| Camera moves | 2 + mascot punch | 1 push + reframes | none | none | none | **optional; 3 of 5 have none** |
| Ambient "process" motion in holds | cars, swarm, counters | counters, lever | typing, cursors, mouth | packets loop, blink | labels, blink | **always something semantically alive** |
| Hues on screen | 2 (peak 4) | 2–5 | up to 5, small | 1–3 | 0–2 | **2–3, semantic, fixed per entity** |
| Speech rate (ASR wpm) | 212 | 221 | 204 | 195 | 175 | **175–220 native** |
| Pauses ≥ 350 ms, total | 2.5 s | 1.4 s | 1.1 s | 2.0 s | 3.3 s | **near-continuous speech** |
| Clear top / bottom (of 1920) | ~255 / ~375 px | 13 % / 20 % | ~230 / ~435 px | 11 % / 11 % | 10.5 % / ~20 % | **top ≈ 200–250 px, bottom ≈ 375–400 px** |
| Mascot | left, y≈28–72 %, ~25 % width | left x0–25 %, y28–72 % | left, mouth moves | x3–27 %, y31–72 %, blinks | left y41–71 %, blinks | **big, left-middle, blinks/talks** |

---

## 2. Our video — findings (same method; `evidence/OURS.visual_log.md`)
- **37 beats / 70.2 s = 31.6/min** even *after* the 1.8x speed-up (≈17.6/min on the authored 126 s timeline). Median gap **1,230 ms**, mean 1,890 ms; **gaps > 2 s cover 74 % of the runtime** (refs 6–25 %).
- 10 scenes → 9 one-frame hard cuts + 1 wipe (8.5/min) — **the cut itself is fine; what follows it isn't**:
  **~9.5 s (13.5 %) of the video shows only HUD + caption + mascot**: 62.60–65.63 (3.03 s, just an underline), 48.77–50.43, 20.0–21.67, 42.0–43.3, 34.3–35.2, 13.13–13.77.
- **Frozen holds after each build**, several pixel-identical: 22.50–27.43 (4.93 s, linked list), 13.90–18.63, 36.10–40.75 (O(N)), 58.37–62.60, 51.30–55.13.
- **Beats fire early, then idle**: list nodes at 21.67 vs "linked list" spoken 25.86; O(N) at 35.97 vs spoken 41.50; "fixed array" highlight 10.13 vs spoken 12.52.
  Only ~42 % of entrances land on their word; 7 of 18 sentences get no in-scene beat at all; 2.1 beats/sentence; **0.16 beats/word (refs 0.26–0.42)**.
- Fixed-clock stepper ignores words: advances every 500 ms (30.5–32.5) then sits until 34.3.
- Motion: entrances 133–200 ms measured (= **240–360 ms authored**) opacity fades with a few px travel, no overshoot; edge draw 333 ms; counter 1.0 s strong ease-out; gauge 0.87 s. **Entrance speed on screen is already in the reference band — only because of the 1.8x.**
- No camera, no ambient motion; mascot frozen from 0.43 s to the end; background never moves.
- Colour: median 2 saturated hues (machine census) — **not less colourful than the references** (R3/R5 are near-monochrome: median 0).
- Layout: HUD at the very top (0–76 px, inside the platform's username bar zone); mascot at bottom 3 % (inside the platform caption/like-bar zone); content bunched at 31–50 % of height, 45–60 % of a typical frame empty.
- Audio: 12 pauses ≥ 350 ms totalling 5.1 s even after speed-up, dropping to **digital silence (−94 dB p10)** at each scene start; references never drop below ≈ −40 dB between words.
- Bugs seen: empty card placeholder 0.00–0.63; paragraph with blank holes where highlighted words go 6.9–10.1; stray 1-px dots 20.0–21.67; linked list spanning x 5–1075 of 1080; tiny stepper labels 27.4–34.3; gauge needle over "100%" 50.4–55.1; grey "disabled-looking" title 55.2–58.0; title overlap during wipe 58.10–58.23; caption box vanishes between chunks (2.00–2.10, 48.9–49.1); caption text ≈ 2 % of frame height; HUD handle still "@example"; mascot is SpongeBob (IP risk for autonomous publishing).

---

## 3. Quantified gap table
| Metric | Reference (range / median) | Ours | Delta | Evidence |
|---|---|---|---|---|
| Beats / min | 50.9–79.7 / 69.6 | 31.6 (17.6 authored) | **−55 %** (−75 % authored) | R1–R5 & OURS logs, §1/§2 |
| Median beat gap | 600–870 / 633 ms | 1,230 ms | **~2x longer** | same |
| Max hold | 2.4–4.0 s (R4 8.3 s but ambient-filled) | 4.93 s frozen, several pixel-identical | holds are dead, not just long | OURS 22.50–27.43; R5 max 2,734 |
| Time in gaps > 2 s | 6.4–25 % | 74 % | **3–11x** | R2 6.4 %, R5 11 %, OURS 74 % |
| Beats per word | 0.26–0.42 / 0.34 | 0.16 | **~2x fewer** | beats ÷ ASR words |
| Beats / sentence | 2.3–4.6 / 2.7 | 2.1 (7 of 18 sentences = 0) | fewer, and uneven | OURS log |
| Word-anchored | 46.5–78.5 % (rest lead, never lag) | ~42 %, often 2.4–5.5 s early | anchoring broken | OURS 21.67 vs 25.86, 35.97 vs 41.50 |
| Scaffold lifetime | 3.4–8.1 s (typ. 4–5) | 6.4–7.7 s final / 11.5–13.8 s authored | ~1.5–3x longer | runs.json scene table |
| Scaffolds per 2.5 min | 18–52 (typ. 32–33) | ~21 at our 70 s rate, but only 10 per video | video is 10 scenes total | §1 |
| Empty-content frames | ≈0 (next frame after a cut already has content) | 13.5 % | new failure class | R3 1.500→1.533; OURS 62.60–65.63 |
| Entrance duration | 67–200 ms ease-out, no overshoot | 133–200 ms on screen (240–360 ms authored) | **no gap on screen**; gap appears if speed-up is removed | strips |
| Camera effects | 0–3 per video | 0 | minor (3 of 5 refs have none) | §1 |
| Ambient process motion | always present | none; mascot frozen | total gap | R4 packets, R1 cars, R3 typing |
| Simultaneous hues | 0–5, median ~1–2, semantic per entity | 2 median, per component | **no deficit**; semantics differ | hue census |
| Speech rate (native) | 175–220 wpm | ~105–115 wpm raw → 192 after 1.8x | raw TTS ~2x slow | ASR + timing.json |
| Pauses ≥ 350 ms | 1.1–3.3 s per video | 5.1 s in 70 s, digital silence | dead air per scene | audio analysis |
| Top / bottom clear | ≈200–250 / ≈375–400 px | HUD at 0 px; mascot at bottom 3 % | chrome sits in platform-UI zones | row profiles |
| SFX per beat | **not measurable** | 25 cues / 37 beats (by construction) | unknown | detector validation |

---

## 4. Root-cause map (gap → exact code → mechanism)

1. **Too few scaffolds / scenes too long** → `orchestrator/lib/video/scenePlan.js:149` `idealSceneLen = 10`, `:98-99` `MIN_SCENES = 10` / `MAX_SCENES = 16` (from `ARC_STAGES` min/max, `:39-96`); `:148` `Math.max(90, …)` floor.
   `scripting-pipeline/src/promptBuilder.ts:92` ("90-150 seconds across 10-16 scenes"), `:96` ("spend 2-3 scenes going one step deeper").
   The references run **32–52 scaffolds** per 2.2–3 min with 3.4–5 s lifetimes; the plan caps us at 16 and targets 9–10 s each.
2. **Scene length is raw TTS length, and the TTS is ~2x slow** → `generate-video.js:198-216` (`duration = synth.durationSeconds`, back-to-back); `promptBuilder.ts:117` asks Gemini for "~150 words per minute", but F5-TTS (`voice-pipeline/synthesize.py:228-234`, `speed` default 1.0, `:308`) actually delivers ~105–115 wpm. So every scene is ~40 % longer than planned (the 90 s plan became 126 s), and `speedUp.js:29` (`setpts=PTS/1.8` + `atempo=1.8`) is doing the job the TTS should do.
3. **Dead air + empty frames at every scene start** → F5 output begins with 0.60–1.66 s of silence (per `scene-N.timing.json`), nothing trims it; components start at opacity 0 and reveal at `reveal_at`, which `narrationSync.js:53` caps at `min(30 % of duration, 3 s)` — i.e. up to 3 s authored (1.67 s on screen) of HUD+caption-only frame after every cut. The references put content on the next frame after the cut.
4. **Only 1–3 timed beats per scene** → components expose few `*_at` props (kpi-cluster: `title_reveal_at`, `reveal_at`; big-stat-callout: 3; node-graph-diagram: `reveal_at` + `edge_stagger`), and `narrationSync.js:66` resolves only top-level keys ending in `_at`. Everything else inside a component is `reveal_at + i*stagger` on a fixed clock. That is exactly why nodes appear at 21.67 but "linked list" is said at 25.86, and why 7 of 18 sentences get no beat.
   The references anchor one beat per spoken noun (R1 60.38/61.00/61.63; R5 42.00–43.75) — there is no way to express "item 3 appears on word X" in our contract today.
5. **Frozen holds** → every component ends its motion by ~`reveal_at + 1–2 s` then pads with `tl.set({}, {}, duration)` (e.g. `kpi-cluster` ends ≤ 4.7 s of a ~12 s scene; `big-stat-callout` idle 3.55→11.71 in scene 6); orchestrator adds no motion (root timeline empty, `composeHtml.js:744-746`), mascot animates once (`composeHtml.js:211-216`) under the "ban on idle wobble" comment (`:171-175`). The references' holds are filled by **semantic process motion** (traffic, packets, counters, typing, cursor, blink) — not wobble.
6. **Every scene is a different component** → `promptBuilder.ts:120` "Vary componentType choices across scenes". The references do the opposite: R2 keeps one scaffold 125 s, R4 reuses one diagram ~10x, R1 reuses the highway 15x — continuity is what lets beats be small and frequent. We also have no way for a scene to *continue* the previous scene's state (every component re-enters from empty).
7. **Captions** → `composeHtml.js:41` `CAPTION_WORDS_PER_GROUP = 3` is right; but whole phrase renders at once (no active-word highlight), 36 px Inter (`:121-139`, ≈2 % of height), box fades out between phrases (`:84-91,161-162`). References advance an active word every ~0.29 s (R3) and keep the pill up.
8. **Chrome in platform-UI zones** → HUD 76 px bar at y=0 (`composeHtml.js:392-484`); mascot `left 3 %, bottom 3 %, width 15 %` (`:196-206`). SAFE_RECT (`:554`, 210–1460) is already reference-correct for *content*; the chrome outside it is not.
9. **SFX cap** → `composeHtml.js:286` `MAX_SFX_CUES_PER_SCENE = 6`, `:289` `MIN_SFX_CUE_GAP = 0.18`. With 10 scenes it's harmless; with 3x beats per scene it would clip. Reference SFX density is unknown (see §7), so this is a "don't block" change, not a "match the reference" change.
10. **Autonomy gaps** (for the "one button → video" goal) → control panel works end-to-end (`server.js:260-293` → `renderEngine.js:78-103`), but: `renderEngine.js` has its own `lengthSeconds || 60` vs. server `|| 45`, never passes `--speed/--theme/--mascot`; there's no scheduler; `publish.js:11-26` is a 501 stub; there is no automated *pacing* QA gate — `hyperframes check` catches layout/contrast errors but would pass a video that is 74 % frozen.

**Things the evidence says are NOT the problem (do not build these first):**
- Easing/overshoot: references use 70–200 ms plain ease-out, overshoot appears once in ~900 logged beats. Our library's `power2.out` default is correct; no need for bounce/spring.
- Colour: we are not less colourful than the references; do not do another colour-rotation pass. (The real difference is *entity-stable* semantic colour across scenes — low priority, Phase 7.)
- Camera system: 3 of 5 references have zero camera motion. Worth a cheap orchestrator-level "punch" later, not a priority.
- Transitions: references cut in one frame. Our cuts are fine; the empty 1–3 s *after* them is the bug.
- Raising the 1.8x speed-up: it's compensating for slow TTS and silence; raising it would compress the already-short entrances below the reference band.

---

## 5. Architecture verdict — **no new project; a v2 "beat contract" inside this repo**

The substrate matches the target: the references are flat 2D HTML-style motion graphics (fades, line draws,
counters, one-frame cuts, rarely a camera move) — everything is expressible as seek-safe GSAP on
HyperFrames. F5-TTS + WhisperX already give word-level timing, Gemini + zod validation + repair loop already
works, and the control panel already goes topic → mp4 unattended. None of that needs to be thrown away.

What *is* architecturally wrong is the **content contract**: "one scene = one component = 1–3 timed props,
length = one TTS clip". The references are built as "one scaffold receives a beat on (almost) every
noun, and scaffolds persist/re-skin across sentences". That needs three contract changes, which is a
significant refactor but not a rewrite:
1. **Beat granularity** — scenes of 1–2 sentences (~3.5–5 s), 25–40 per video.
2. **Per-item word anchors** — `props.<list>[i].at` resolved from narration, not `reveal_at + i*stagger`.
3. **Scaffold continuity** — a scene can `continue` the previous scene's component state instead of re-entering.

Recommendation: build it as `--contract v2` alongside v1 (same repo, same components, additive props with
v1 defaults), so every phase is shippable and v1 renders keep working. A from-scratch project would have
to rebuild 64 components, the TTS/alignment stack, the validation loop and the control panel to arrive at
the same place.

---

## 6. Phase plan (ordered by leverage ÷ risk; each phase independently verifiable)

**Verification standard for every phase** (in addition to the unit tests in `scripting-pipeline`):
(a) `hyperframes check` on the real generated composition → 0 errors in lint/runtime/layout/motion/contrast;
(b) `hyperframes snapshot` at the specific timestamps named in the phase (plus `--at-transitions`);
(c) a real end-to-end render of the same topic (hash collisions) and (d) the Phase-0 pacing gate run on
that mp4, compared to the reference band in §1. "Done" = all four pass; any number that fails is reported, not hidden.

### Phase 0 — Pacing gate (tooling only, zero pipeline risk)
- Move `analysis/pacing-audit-20260924/tools/{frames,beats}.py` into `orchestrator/tools/pacing-gate/`, fix the two known detector flaws found in this audit:
  exclude the mascot's rectangle and the caption band (both known from composeHtml constants), and replace the histogram cut test with a "≥ 25 % of non-chrome cells change in ≤ 2 frames" test.
- Calibrate on R1–R5: the gate must reproduce the visual counts within ±15 % (it currently over-counts blinks, misses cuts).
- Output per render: beats/min, median/max gap, % time in gaps > 2 s, % empty-content frames, digital-silence seconds, beats/word.
- Targets (from §1): beats/min ≥ 50, median gap ≤ 900 ms, no frozen hold > 3 s, gaps > 2 s ≤ 25 %, empty-content ≤ 1 %, beats/word ≥ 0.25.
- Verify: run on OURS → must reproduce §2 numbers (31.6/min ±15 %, 74 % > 2 s). *New tool, not a pipeline change.*

### Phase 1 — Kill dead air and empty frames (tuning; motivates: OURS 62.60–65.63, 48.77–50.43, 20.0–21.67; −94 dB silences)
- `voice-pipeline/synthesize.py`: after WhisperX alignment, trim leading silence to `first_word.start − 0.05 s` and trailing to `last_word.end + 0.08 s`, shift word timings accordingly (the timing JSON stays authoritative).
- `narrationSync.js`: with speech now starting at ~0.05 s, the first visual must be on screen at scene t≈0: default the first `*reveal_at` (and `title_reveal_at`) to 0 when unanchored, and lower the ceiling from `min(30 %, 3 s)` to `min(15 %, 0.6 s)` — references show content on the frame after the cut (R3 1.500→1.533).
- Bridge caption gaps (`composeHtml.js:84-91`): hold the previous phrase until the next starts when the gap < 0.6 s, so the box never blinks out.
- Verify: gate → digital-silence seconds ≈ 0, empty-content frames ≤ 1 %; snapshot at each scene's t = 0.1 s shows real content.
- Expected effect: removes ~7 % of runtime of dead air and all 9.5 s of empty frames; does not by itself fix density.

### Phase 2 — Real speech rate; retire most of the 1.8x (tuning + one listening decision; motivates: refs 175–220 wpm native vs ours ~110 raw)
- `voiceSynth.js`/`synthesize.py --speed`: A/B F5-TTS at speed 1.3 / 1.5 / 1.7 on 3 real scene texts, **listened to by you** (quality at high F5 speed is not something I can verify frame-by-frame).
- Pick the highest intelligible speed, then set `speedUp.js` default so that TTS-speed × post-speed ≈ 1.8 (e.g. 1.5 × 1.2); pass `--speed` explicitly from `control-panel/lib/renderEngine.js` (today it never does) and align its `lengthSeconds` default with `server.js`.
- Because the post speed-up shrinks, animation durations would lengthen on screen (today's 133–200 ms on-screen = 240–360 ms authored). Add one shared constant, e.g. `HF_MOTION_SCALE` in `video-engine/compositions/components/lib/` consumed by each component's tween durations, so on-screen entrance stays 70–200 ms. That touches all 64 components mechanically — do it with a codemod + one consolidated check pass (Round 4's process), not 64 hand edits.
- Fix `promptBuilder.ts:117` "~150 words per minute" to the measured delivered wpm, and `DEFAULT_VALIDATION_CONFIG.wordsPerMinute` (`types.ts:110`) to match, so Gemini's scene lengths stop overshooting by 40 %.
- Verify: gate → wpm 175–220; entrance durations measured on a strip 70–200 ms; check + snapshot.

### Phase 3 — Beat-granular scenes (the biggest single lever; motivates: refs 32–52 scaffolds, 3.4–5 s lifetime vs our 10 × 7 s)
- `scenePlan.js`: `idealSceneLen` 10 → ~4.5 s of *final* video; scale `ARC_STAGES` min/max ~3x (e.g. mechanism 9–18, complication 6–9), giving ~25–40 scenes for 120–150 s. Remove/relax the `Math.max(90, …)` floor so `--length-seconds 45` means 45.
- `promptBuilder.ts:92/96`: rewrite the structure guidance to "one scene = one or two short sentences (8–15 words), 3–5 s"; target sentence length 7–9 words (refs' median; ours is 12).
- **Voice step consequence (real architectural decision, flagged):** 3x more scenes = 3x more sequential F5 calls (today 10 scenes took ~12m47s end-to-end). Recommended: synthesize the whole narration in 2–4 chunks, WhisperX-align once, and cut scene boundaries at sentence word timings — faster and gives continuous prosody (refs have 1–3 s of total pauses). Needs a listening check (Phase 2's A/B covers this).
- Verify: gate → scaffold changes 7–17/min, lifetime 3–6 s, median gap improvement; check + snapshot at every transition; Gemini validation still converges (log attempts).

### Phase 4 — Per-item narration anchors: "one pop per spoken noun" (NEW contract primitive; motivates: R1 60.38/61.00/61.63, R5 42.00–43.75, R2 11.36→11.50; ours 21.67 vs 25.86)
- `narrationSync.js`: resolve anchor paths of the form `props.<listKey>[<i>].at` in addition to `props.<key>_at`; keep the existing defence (only `…_at` or an array element's `at` field may be written; never a content prop — the Round 2.1 corruption bug).
- `scripting-pipeline/src/validation.ts` `checkAnchors`: accept `[i].at` only when the component's `registry-item.json` declares that list as item-timeable (new field e.g. `"itemTiming": ["items", "nodes", "cards"]`) and `i` is in range.
- Components: list-bearing ones read `item.at` if present, else fall back to `reveal_at + i*stagger` (v1-compatible). Start with the ones Gemini picks most: `checklist-progress`, `kpi-cluster`, `node-graph-diagram` (nodes and edges), `step-list-card`, `timeline-milestones`, `request-lifecycle`, `folder-tree`, `keyword-highlighter`.
- `promptBuilder.ts`: require an anchor for every enumerated item and every term the scene visualizes; soft target ≥ 1 anchor per ~3.5 words (refs 0.26–0.42 beats/word), enforced as a warning first, then as a validation rule once convergence is measured.
- Verify: unit tests for the new path grammar (incl. "content prop still rejected"); check + snapshot at 3 anchored item times per scene; gate → beats/word ≥ 0.25, word-anchored ≥ 50 %.

### Phase 5 — Live holds: semantic process motion (NEW shared primitive; motivates: R4 packets 1.6 s loop, R1 cars/counters, R3 typing/cursor, R2 lever counters; ours pixel-identical 22.6–27.4, 51.4–55.1)
- New helper in `components/lib/` (e.g. `liveLoop(tl, from, until, period, buildOneCycle)`) that adds a **finite** number of cycles computed from remaining scene time — the codified form of the `repeat:-1` fix, deterministic, all on the root `tl`.
- Use it where motion is meaningful, not decorative: packet flow on every drawn edge (node-graph-diagram, client-server-exchange, pub-sub-broadcast, etl-pipeline, load-balancer-cluster), live counters/metrics ticking in dashboards (deployment-dashboard, kpi-cluster, gauge-meter), cursor/typing (terminal-session, ide-diff-panel already has blink).
- Mascot: deterministic blink schedule (e.g. every 4.4–5.5 s, 200 ms, as in R4) plus an optional mouth flap driven by the per-scene word timings (R3); one-frame 1.3x scale punch on HUD state changes (R1 9.20, 39.83). Update the "ban on idle wobble" doctrine comment (`composeHtml.js:171-175`) to "semantic process motion allowed; decorative bob/breathe still banned" — this matches every reference.
- Verify: `grep "repeat:\s*-1"` returns nothing; check (motion section) 0 errors; snapshot two frames 0.5 s apart inside a former frozen hold must differ; gate → no frozen hold > 3 s.

### Phase 6 — Scaffold continuity (NEW contract primitive; motivates: R2 one scaffold 5.9–131 s, R4 same diagram ×10, R1 highway ×15; ours: new component every scene per `promptBuilder.ts:120`)
- Add a generic `enter: "fresh" | "continue"` variable to components (default `fresh`). In `continue`, elements that existed at the end of the previous scene start at their end state at t = 0 and only the *new/changed* items animate.
- `composeHtml.js`/`generate-video.js`: set `enter:"continue"` automatically when consecutive scenes share `componentType` and a script-level `scaffoldId`; Gemini schema (`types.ts`, `wireSchema.ts`) gains optional `scaffoldId`.
- `promptBuilder.ts:120`: replace "Vary componentType" with "keep one scaffold across consecutive sentences about the same system, changing its state; switch scaffold when the topic moves on" (refs switch every 1–2 sentences at most ~17/min).
- Verify: snapshot last frame of scene N and first frame of scene N+1 → identical except the new beat; check at transitions; gate → scaffold lifetime back in 3.4–8 s band after Phase 3 made scenes short.

### Phase 7 — Captions, chrome placement, colour semantics (tuning + one design decision from you)
- Captions (`composeHtml.js:121-162`): active-word highlight via `tl.set` per word timing (R3/R4/R5 all do it), size up from 36 px, persistent pill.
- Chrome: move the HUD down into the safe band (~200 px) and the mascot to left-middle (refs: x 0–27 %, y 28–72 %), bigger. **Needs your call**: a left-middle mascot takes ~25 % of width from content — refs accept that (R1, R4) or temporarily remove it for full-width moments (R2 57.27). Also the SpongeBob asset should be replaced with an original character before any autonomous publishing.
- Entity colour map: script-level `{entity: accent-n}` so "blue env" or "attacker" keep one colour across all scenes (R2, R3). Respect the existing semantic-colour exemptions.
- Raise `MAX_SFX_CUES_PER_SCENE` / derive cues from Phase-4 item anchors so SFX follow the new beats (pending your verdict on reference SFX density).
- Verify: check (contrast!) + snapshots at a caption swap, a HUD state change, and one mascot frame; gate unaffected.

### Phase 8 — Full autonomy ("click a topic → finished video")
- Auto QA loop in `generate-video.js`: after render, run the Phase-0 gate; if below targets, regenerate the script once with the failing numbers fed back (same reject-and-repair pattern as validation.ts), else fail the job visibly.
- Control panel: a scheduler (daily N topics from the pending list), a single "Generate" button per topic that passes all flags, and a real `publish.js` (currently 501) — publishing needs your platform credentials and explicit approval; I won't build posting until you confirm the target platform.
- Verify: 3 unattended runs on 3 different topic categories; all pass check + gate; you review the 3 videos.

**New primitives vs. tuning, explicitly:**
- **NEW:** pacing gate (P0), per-item anchor path grammar + registry `itemTiming` (P4), `liveLoop` helper (P5), `enter:"continue"` + `scaffoldId` (P6), whole-narration synthesis + sentence splitting (P3, voice step), motion-scale constant (P2), auto-QA regeneration loop (P8).
- **Tuning:** silence trim, reveal cap, caption bridging (P1); TTS/post speed, wpm constants (P2); scenePlan/prompt numbers (P3); caption/chrome/SFX constants (P7).

---

## 7. Not confident about (needs a real render or your ears)
1. **SFX density in the references** — the detector demonstrably misses most of our own known SFX, so I have no reference SFX-per-beat number. Please listen to 20–30 s of R2 or R4 and tell me: pop/click on every element? only on cuts? none?
2. **Music bed** — the references never fall below ≈ −40 dB between words and the gap spectrum is tonal (flatness 0.002–0.007 vs ours 0.029), consistent with a quiet music bed *or* room tone. Unverified; your ears decide. We currently have no music at all.
3. **F5-TTS quality above speed ~1.3** — must be listened to (Phase 2).
4. **Whether Gemini converges** with 25–40 scenes and dense per-item anchors on the first 3 attempts — only a real run shows it (Phase 3/4 log attempt counts).
5. **Render time** — 3x scenes and more tweens will lengthen `hyperframes render` and TTS; the whole-narration synthesis is expected to offset the TTS part, but render time is untested.
6. **Machine detector calibration** — Phase 0 claims ±15 % after fixes; until that's proven on R1–R5 the gate numbers are indicative, and the visual logs remain the source of truth.
7. **Our render is one topic** — the frozen-hold pattern is structural (code-derived, §4), but the specific bugs (gauge needle over text, blank paragraph holes) are topic/component-specific; a second render on another topic would confirm which are systemic.
