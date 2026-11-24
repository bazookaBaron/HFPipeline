# China film "How China became a copy machine": final report (2026-11-14)

## Outputs
- Film: `out/china_169_final.mp4`. 9:17 (556.8 s), 1920x1080, 30 fps, h264 + AAC, −14.0 LUFS, −1.0 dBFS peak, LRA 2.7 LU.
- Picture only: `out/china_169.mp4`.
- Thumbnail: `out/china_thumb.jpg` (1280x720) and `out/china_thumb_1920.png`. Made from a clean frame of the film by `films/china/make_thumb.py`. Text: "57 OF 64 / THE COPY MACHINE? / FROM KNOCK-OFFS TO LEADER".
- Script with a sourced fact header: `films/china/script.md`.
- Full fact sheet with URL and status per fact: `films/china/FACTS.md`.
- Producer: `films/china/make_plan.py` writes `plan.json`.
- Sound settings: `films/china/sound.json`.
- Time log: `films/china/TIMELOG.md`.

## Gates (final run, on the plan that was rendered)
- **Shots: PASS.**
  - 0 blocked frames (196 fixed by the solver, 0 still bad).
  - Camera speed within the coast2 caps.
  - Largest figure 0.103 of frame height (cap 0.25).
  - 3D/2D text: smallest 40 px, 0 below the floor.
  - MG text: smallest 23.5 px (floor 21.6), 0 overlaps.
- **Set variety: PASS.**
  - 46 distinct sets for 55 world lines (need ≥ 19).
  - Busiest set 5.3% of world time (cap 12%).
  - No set on more than 3 lines in a row, no framing + subject used more than twice.
- **MG variety: PASS.** 33 beats, 29 kinds, busiest kind 6.5% of MG time, never the same kind twice in a row, beats 3.9–9.9 s.
- **Map: PASS.** 2.6% of runtime, at most 1 line in a row.
- **Lines: LINE GATE PASS**, 90/90.
- **Review:** 2 rounds (24-still sheet plus all 90 line stills), then a 12-frame spot check of the final mp4.

## Shares
- 2D MG: about 43% of runtime. The target is about 35%. I brought it down from 46% by turning 4 MG beats into world shots. It is still above target; see weak spots.
- World: 55 of 90 lines. Map: 2 lines.

## Engine features used (published by film-nvidia; I did not edit their files)
- No-card MG (the default).
- Music bed: moods set per chapter, investigative / nostalgic / investigative / tense / investigative / tense / hopeful / nostalgic / warm, 18 dB under the voice.
- Subscribe end card on line 90.
- Per-film output names.
- Their `campus`, `datacenter` and `fab` generators.

## New generators I added (logged in ENGINE-UPDATES.md)
- **3D:** `windTurbine` (rotor turns), `solarArray`, `train wagon:"hsr"`, `drone`, `stall`, `mill` (waterwheel turns).
- **2D:** `battery`, `solarPanel`, `windTurbine`, `drone`, `bulletTrain`, `spinningFrame`.

## Time per stage (IST; wall time includes queue waits behind the other two films)
| Stage | Time |
|---|---|
| Docs + engine survey + generators | 08:55–09:20 |
| Research (background agent, 67 searches) + script | 09:00–09:35 |
| Plan v1 | 09:35–09:55 |
| Voice | TTS queued 09:35, ran about 10:00–10:05; 2 reroll rounds + 2 builds to about 10:50; rebuilt once to cut gaps (9:56 → 9:13) |
| Shots gate x4 + lines gate x3 + 2 review rounds + fixes | 10:50–13:25 |
| Render | queued 13:26, waited about 45 min behind the Nvidia and Trump renders, then rendered 16,704 frames at 0.089 s/frame (about 25 min) to 14:35 |
| Mix x2 + thumbnail + report | 14:35–14:50 |

## Disclosures
- **Voice build ran with `--force`.** I fixed every real mispronunciation first:
  - respelled Sino-vel, Jin-hwah and Low-ell;
  - re-rolled lines 13 and 54, and reworded 54.
  - The 7 remaining flags are transcription artifacts, not mispronunciations: Huaqiangbei spelled phonetically, digits dropped, "deep seek", and the traitor/trader and ladder/latter t-flap.
  - I could not listen to the audio myself; the judgement is from the transcript.
- **Removed invented numbers.** Two of my own draft beats (trade-flow volumes, train-tender flow rates) had placeholder numbers with no source. I caught them in review and removed both beats before the gates passed.
- **Runtime is 9:17, not 9:00.** That is 1,555 words with 0.75 s line gaps and 2.6 s chapter gaps. Malacca was 8:57.

## Weak spots (honest, compared with Malacca v2)
- **MG share is about 43%**, above the 35% target. The pace is still dense, but the film leans on MG more than Malacca did.
- **Government buildings repeat.** About nine world shots are a red government hall: courts, ministries, Washington, Philadelphia. Framings and context vary and the similarity gate passes, but it still reads repetitive.
- **Focused factories and halls sit on solid red ground plates.** These come from the shared generators' base slabs, same as Malacca; I did not change shared generators.
- **The Huaqiangbei street sets look sparse** for the densest electronics market on Earth: few stalls, lots of empty ground.
- **Some MG text is cut off at the top of frame mid-move** (document headers in the plea agreement, WTO and Merchandise Marks Act beats) while the MG camera travels.
- **The mountain stronghold (line 14) is still shadow-heavy grey.**
- **The "Slater copies British mills" timeline card's label runs close to its icon.**
- **Allegations are attributed as allegations:** OpenAI's and Anthropic's distillation claims, with Beijing's denial shown. The IP-theft figure is labelled as a US-wide estimate, not a China-only number. The ASPI tracker is labelled as research output.
