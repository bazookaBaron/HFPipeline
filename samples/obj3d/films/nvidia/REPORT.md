# Nvidia film: final report (2026-11-14)

## Deliverables
- **Video:** `out/nvidia_169_final.mp4`. 16:9, 1920x1080, 30 fps, h264 + AAC, 539.7 s (9:00).
- **Silent render:** `out/nvidia_169.mp4`. 16,191 frames at 0.082 s/frame.
- **Mix:** `films/nvidia/mix_169.wav`.
- **Thumbnail:** `out/nvidia_thumb.jpg` (1280x720) and `out/nvidia_thumb_1920.png`. Made by `films/nvidia/make_thumb.py` from a frame of the film.
- **Sources:**
  - `films/nvidia/script.md` (sourced header);
  - `make_plan.py` → `plan.json`;
  - `sound.json`;
  - `run_final.sh`, which runs the gates and renders only if they pass.
- **Full fact sheet with URLs:** in the shared session notes, `nvidia-facts.md`.

## Gates (final plan, all PASS; the render ran only after this pass)
- **Kinds:** `node mg2d/kindgate.mjs`: 68 kinds, 139/139 cases pass after the no-card change; orgChart re-run 2/2.
- **Shots:**
  - 0 blocked frames.
  - Camera speed p95 2.46 deg/s (cap 52.25), max 7.9 (cap 62.7). Position p95 within cap.
  - Largest figure 0.095 of frame height (cap 0.25).
  - 3D text min 30.9 px. MG text min 23.5 px (floor 21.6), 0 overlaps.
- **Variety:**
  - 45 distinct places for 52 world lines; the most-used place takes 4.6% of world time (cap 12%); no runs and no framing repeats.
  - 30 MG beats across 23 kinds. The most-used kind takes 12% of MG time (cap 20%). No kind twice in a row. Beat runs are 5.1–11.7 s.
  - Map: 3.4% of runtime, longest run 1 line.
- **Lines:** LINE GATE PASS on 87/87 lines (each line's subject readable for at least 60% of the time it is spoken).
- **Mix:** −14.0 LUFS integrated, −1.0 dBTP peak, LRA 3.7.
  - The music bed sits about 18 dB under the speaking voice. Moods by chapter: tense, investigative ×6, tense, nostalgic.
  - 176 cues and 111 ambience segments come from the page. No missing SFX ids.
  - No cue on the final line.
- **Review:** 3 rounds of contact sheets (24 shot stills, then all 87 line stills, then the changed lines) and a 24-frame check of the final mp4. About 15 shots and MG beats were fixed along the way:
  - unreadable subjects;
  - overflowing labels;
  - a float display bug (6.1499…);
  - a misleading countdown;
  - a cropped split-flap card.

## Shares
- MG share **39.4%** of runtime. The target is ~35%, so this is a little MG-heavy; the share is not gated.
- 3D world about 57%, map 3.4%.

## Chapters (start time)
1. cold open: 1.2 s
2. how Nvidia got here: 40.6 s
3. why chips to China matter: 119.9 s
4. Alice Huang and Megaspeed: 196.3 s
5. five days: 272.1 s
6. the fallout: 366.6 s
7. proven versus alleged: 435.5 s
8. what happens next: 483.0 s
9. ending + subscribe: 517.5 s

## Facts handling
The research corrected the brief in four places. All are reflected in the script:
- **Chip claim:** "Reuters reported she used the relationship to get restricted chips to China" is **not** a Reuters claim. The ≈$7.5 bn claim comes from The Information and is unverified; the film says exactly that.
- **Stock:** it fell about 13% only **intraday** and **closed −4.3%**. The film says both.
- **FBI:** a probe rests only on Trump's remark; the FBI has not confirmed it. The film says so.
- **Spy claim:** the MSS recruitment comes from a memo reported by the NYT (and the FT). It is contested (CNN sources, DOJ "no conclusion", Beijing denies), and the film presents it as alleged, not proven.

On naming, the executive in the NYT affair report is **not named**, because nobody involved has confirmed it. Mannequins only; no faces or likenesses.

Variety, Reuters.com, AP and the NYT/WSJ/FT/The Information could not be read directly (paywalls or blocked fetches). Their claims were taken from syndicated copies and from other outlets quoting them.

## Time per stage (wall clock, about 08:52–13:40, ≈4 h 50 min including the shared engine work)
| Stage | Time | Notes |
|---|---|---|
| Shared engine upgrades | 08:55–09:55 (+ fixes until 12:10) | no-card MG, music bed, end card, per-film output names, new generators, kind and counter fixes |
| Research (background agent) | 08:59–09:10 | in parallel with the engine work |
| Script | 09:10–09:30 (+ 7 lines at ~10:30) | |
| Voice | TTS ~09:35–10:15, builds until 10:47 | mostly waiting in the jobq voice lane behind two other films |
| Plan + gates + review rounds | 09:35–12:53 | 7 gate runs; snapshot-lane waits were long |
| Render | 12:53–13:24 | 31 min |
| Mix + thumbnail + report | 13:25–13:40 | |

## Weak spots (honest)
- **Repetitive government buildings:** the same domed hall generator stands in for about 12 institutions: Capitol, Commerce, DOJ, the White House, the Senate, the House, Beijing's ministry, Singapore's court and others. The gates count them as distinct places, and framings, light and surroundings differ, but on screen they look alike. A courthouse, ministry and parliament vocabulary would fix it.
- **Sparse world shots:** several are one red building on pale, fairly empty terrain. They are less rich than Malacca's maritime scenes. The campus sets (12 states of Santa Clara) vary in light and layout but share one hero building.
- **MG share at 39%** is above the ~35% target.
- **Voice pace:** 206 wpm at tempo 1.15 is fast. I measured the audio (levels, ASR) but cannot listen to it.
- **Music moods** are mostly "investigative": 2 tense chapters, a nostalgic ending.
- **Fast-moving story:** the facts are 1–2 days old. Earnings on 17 Nov and Congress testimony could date the film quickly.
- **Engine bug found:** `objectCounter` rounded every value to an integer. **Malacca's shipped film shows 9.6 bn as "10" and 1.2 bn barrels as "1".** It is fixed in the engine, but Malacca was not re-rendered.
- **Machine load:** at one point my render and another film's snapshot gate ran together with about 0.1 GB of free RAM. jobq allowed it because they use different lanes. No stall happened.

## What changed in the shared engine
See `samples/obj3d/ENGINE-UPDATES.md`.
