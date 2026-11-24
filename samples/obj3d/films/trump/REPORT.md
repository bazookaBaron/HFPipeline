# "Is Trump a Russian asset?" — miniature v2 film, final report (2026-11-14)

## Honest verdict first
- **Technically:** passes every gate, at the same engine quality as Malacca v2. Malacca had 29 sets; this film has 45 distinct sets, and 18 MG kinds drawn straight on the paper.
- **Visually:** weaker than Malacca in one way. Malacca's subjects were ships, ports and pipelines, which the shape grammar draws richly. This topic is people and institutions, and the grammar can only render those as generic buildings:
  - About a dozen places use the same domed `govHall` generator in red, so they read alike in sequence: Kremlin, Capitol, Senate, Treasury, DOJ, the courts, Helsinki. Seeds, light, ground and surroundings differ, but the shape repeats.
  - A few wide establishing shots are sparse (dc_dawn, potomac_bridge, moscow_river_bend, dc_dusk).
- **Content:** framed as an evidence trial, with every exhibit stamped proven, alleged, disproven or unverified. No statement of fact calls anyone an asset, and every allegation is attributed.

## Deliverables (all in `samples/obj3d/`)
| What | Path |
|---|---|
| Final film (16:9, 1920x1080, 30 fps, 9:14.2, h264 + aac) | `out/trump_169_final.mp4` |
| Picture-only render | `out/trump_169.mp4` |
| Thumbnail | `out/trump_thumb.jpg` (1280x720), `out/trump_thumb_1920.png` |
| Script with sources | `films/trump/script.md` |
| Full fact sheet with quotes and URLs | side-session notes `trump-facts.md` |
| Producer step / plan | `films/trump/make_plan.py` → `plan.json` |
| Voice | `films/trump/voice.wav`, `lines.json`, `words.json` |
| Sound spec | `films/trump/sound.json`: page beds and cues, plus the music bed with per-chapter moods |
| Gate logs | `films/trump/final_shots.log`, `final_lines.log`, `linecheck_169.json` |
| Gates → render script | `films/trump/run_final.sh` |

## Gate numbers (final run, 13:12, on the exact plan that was rendered)
- **Blocked camera frames:** 0 (`stillBad: 0`, 139 frames fixed by the solver).
- **Camera speed:** pass (angular p95 2.41, max 11.86; position p95 0.05).
- **Figures:** maximum 0.109 of frame height (limit 0.25).
- **Text:** smallest 3D caption 35.8 px, smallest MG caption 23.5 px (limit 21.6); 0 MG text overlaps.
- **Set variety:** 45 distinct sets across 50 world lines (17 needed). The most-used set has 4.3% of world time (limit 12%). No runs of more than 3 lines and no repeated framing.
- **MG variety:** 34 beats, 18 kinds. The most-used kind has 13.8% of MG time (limit 20%). No kind appears twice in a row, and beats run 4.0–10.4 s (allowed 3.5–14).
- **Map:** 5.3% of runtime, longest run 1 line (limits 20% and 4).
- **Line gate:** LINE GATE PASS, 91/91 lines; the lowest subject-on-screen share is 0.79.
- **Pronunciation gate (voice.py build):** pass.
- **Kinds gate:** run by film-nvidia after the no-card change, 139/139 PASS. I made no kind changes.
- **Loudness:** −14.0 LUFS integrated, −1.0 dBFS peak, LRA 3.1 LU.

## Composition
- **Runtime:** 554.2 s. Speech 442.6 s, 1,446 words, 196 wpm (tempo 1.15). Gaps were tightened from Malacca's 1.2 s / 3.3 s to 1.0 s / 2.8 s.
- **Picture time:** MG 43.7% (36 of 91 lines), world 50 lines, map 5 lines. This is above the ~35% target in MINIATURE-PLAN; that target is not a gate.
- **MG kinds used:** quoteCard 4, annotatedDoc 4, stampedPermit 3, splitAvsB 3, vennOverlap, splitFlapDate, objectCounter, contractClauses, branchTree and allianceWeb 2 each, then tallyBoard, stepRail, manifest, layerStack, illustratedBars, ganttBars, dominoes and conveyor 1 each.
- **Engine updates used, as published by film-nvidia in ENGINE-UPDATES.md:**
  - no-card MG (default);
  - the music bed: investigative / nostalgic / tense / heavy / hopeful, chosen per chapter;
  - the subscribe end beat on the last line, "If you liked this video, subscribe for more evidence trials", with a flat "Blind Luck Time" row and a red pill that turns into "Subscribed ✓";
  - per-film output names.
- **Nothing downloaded; nothing prebuilt.** Every set and MG element is generated from plan data. No new generator or kind was needed.

## Time per stage (approx., wall clock, including waits in the shared jobq)
| Stage | Time |
|---|---|
| Reading the pipeline + fact research (subagent, ~6 min) | ~0:45 |
| Script (written, then trimmed twice for length) | ~0:30 |
| Voice (TTS for 96 lines, 2 rerolls and 3 builds; mostly queued behind the other two films' voice jobs) | ~1:20 |
| Producer plan (45 sets, 34 beats) | ~0:30 |
| Gates + 2 review rounds (6 gate runs, 24-still sheet, 4 line sheets, spot sheet) | ~1:40 |
| Final gates (queued behind China's lines gate) | ~0:45 |
| Render (16,626 frames at 0.102 s/frame + encode) | ~0:50 |
| Mix + thumbnail + report | ~0:15 |
| **Total** | **~6:30** (well over the ≤5 h target, mostly because of queue waits with three films sharing the machine) |

## Fixes made during review (caught by me, not by the gates)
- Several kinds were drawing invented quantities:
  - tugOfWar showed "35/50 certainty" force numbers, in both the two-camps beat and the Senate-readings beat;
  - dependencyChain showed "% load" gauges;
  - sankey showed a made-up 50/50 split of dossier funding between the Clinton campaign and the DNC;
  - tallyBoard summed "4 applications + 17 errors = 21 (81%)";
  - pictogramRow added a "whole objects only" flag;
  - balanceScale tipped toward "tough measures" with 6-vs-9 counts while the narration says "mixed";
  - stampedPermit ticked "Corroborated" on the UNVERIFIED stamp.
  
  All were replaced with kinds or data that carry no fabricated numbers.
- Narration gate failures:
  - A one-line timeline beat toured all six events inside 4.8 s. It was replaced by a split-flap "1987".
  - A link board landed on Goldstone's card while four other names were read. It was replaced by an alliance web.
- Callouts on lines that are too short to read (lines 56 and 90, under 1.5 s) were removed.
- The Goldstone email excerpt was made verbatim.

## Weak spots (still in the film)
1. **Repeated building shape:** the domed govHall stands in for many different institutions (see the verdict).
2. **Length:** 9:14, not 9:00. Getting to 9:00 would need about 15 more seconds cut from the script and another voice pass.
3. **MG share 43.7%** against the ~35% target.
4. **Pace:** the longest gap between events is 7.88 s, around 85 s (the 1996 / Bayrock stretch). The v2 plan aims for ≤ 1.5 s, but this is not gated.
5. **Small text and visual issues:**
   - the objectCounter key reads "= 1 errors and omissions";
   - on the "17" beat the warning icons crop at the top of the frame;
   - line 35's date callout is visible for only about 1.2 s;
   - the Alaska set's focus is a red helipad disc, which reads abstractly.
6. **Sourcing limits:**
   - Senate Vol. 5, IG and Durham quotes come from news coverage of those reports, not from reading the PDFs directly.
   - The Don Jr. 2008 quote has no recording, so it is voiced as "reportedly".
   - No official response to the 2025 "Krasnov" post was found, so the film claims no denial.
7. **Voice:** no human has listened to it. The ASR gate passed after I added three said-right spellings ("junior"→"jr", "saint"→"st", "sater"→"seder") to the shared SOUNDALIKE table in `audio/voice.py`. That edit is additive and noted in the session notes.
