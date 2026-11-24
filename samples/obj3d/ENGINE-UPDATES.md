# Engine updates for the 9-min films (2026-11-14, owner: the Nvidia film session)

These are shared engine changes. The Trump and China film sessions pick them up as described here and do not edit these files.
Questions or bugs: leave a note in the shared session-notes folder.

## 1. MG drawn straight on the paper (no card behind it): on by default

**What changed**
- `mg2d/core.js`:
  - `STYLE.cards` defaults to `false`.
  - New `ui.base(g, w, h, o)` draws a kind's full-size base panel only in the legacy card look.
  - New `ui.panel(...)` covers row and side panels. Without cards it draws a faint ink underline instead.
  - The stage ground is a plain paper texture (`P.ground` #f2ede2, no dot grid).
- All 68 kinds:
  - Kinds that called `ui.card(g, 0, 0, w, h, …)` now call `ui.base(...)`.
  - Row panels in routeRace, seasonBand and tugOfWar use `ui.panel`.
  - Object cards that stand for real things stay: link-board index cards, org-chart and supply-tree nodes, the source note, document sheets.

**How a film opts in:** nothing to do; this is the default. To get the old Malacca card look, set `"mgCards": true` on plan.json, or `"cards": true` on one MG beat. `kinds.html?cards=1` shows the old look in the harness.

**Gate:** `node mg2d/kindgate.mjs` (legibility ≥ 21.6 px, no text overlaps). Result: see the end of this file.

## 2. Soft music bed (dialogue method): opt-in

**What changed**
- New module `audio/music.py`. It is the same procedural method as `dialogue/fish/mix*.py` and dialogue/STYLE-GUIDE.md §7:
  - pads and a drone (90–180 Hz), soft mallets (400–900 Hz), a quiet shimmer and a sub bass;
  - a carved 0.8–2.5 kHz dip so the voice sits on top.
- No downloaded music, nothing to licence or credit.
- One mood per `#ch` chapter. The mood is picked automatically from the script's emotion tags or set by hand. Moods: investigative, tense, heavy, warm, hopeful, nostalgic. Chapters crossfade over 3 s.
- Ducking: the bed sits `under` dB below the speaking voice (default 18) and lifts in pauses longer than 0.6 s (default `lift` 3). The lift is smoothed, with no pumping. Fade-in is 3 s and the final fade-out is 4 s.
- Measured on Malacca's voice: −18.0 dB under the voice while speaking, +1.5 dB in pauses.
- `audio/mix.py` adds the bed when sound.json has a `music` key.

**How a film opts in:** add to `films/<film>/sound.json`:
```json
"music": {"moods": "auto", "under": 18, "lift": 3}
```
`moods` can also be a list, one entry per chapter, for example `["tense","investigative",...]`. To preview the moods without a video, run `python audio/music.py <film>`, which writes `films/<film>/music_preview.wav` (voice + bed). Run it with plain `python`, not `-I`.

## 3. Subscribe end beat: opt-in per line

**What changed**
- In `film.html`, a plan line with `"endcard": true` keeps its normal picture (a set or the map) and gets a flat bottom-centre row:
  - a die-face channel mark;
  - the channel name, "Blind Luck Time" by default; override it with `plan.endcard.name`;
  - a solid red "Subscribe" pill. It is pressed on the spoken word "subscribe…" and becomes a grey "Subscribed ✓".
- The style follows memory `channel-endcard-style`: flat, sentence case, solid fills, no glow, gradients, bounce or sparkles.
- The scene stays undimmed apart from a light paper band at the bottom. It fades out with the film.
- The line's subject becomes `end:card`, so the line gate passes it while the row is on screen.

**How a film opts in:**
1. In the script, make the last line the subscribe line, for example `NARR (warm): If you liked this video, subscribe for the next one.`
2. In plan.json, give that line `"endcard": true` next to its set, for example `{"set": "x", "subject": "set", "endcard": true}`.

The mixer skips cues on the final line on purpose (no stinger before the ending), so the press is silent.

## 4. Output names per film (render.mjs): automatic

**What changed:** `render.mjs` used to name every output after the page, `out/film_169.mp4`, so parallel films overwrote each other. Outputs are now named after `film=<id>` in QS:
- `out/<film>_169.mp4`
- `out/frames_<film>_169/`
- shot stills `out/<film>_169_sNN.jpg`
- `out/time_<film>_169.json`

**What a film must do:** point `sound.json` at `"video": "out/<film>.mp4"`. mix.py adds `_169` itself.

## 4b. Cues for 16:9 films (render.mjs lines): automatic
`render.mjs lines` used to write `films/<film>/cues.json` only for 9:16, so a 16:9-only film mixed with stale or empty cues. For film.html it is now written for 16:9 too. Re-run the lines gate before mixing.

## 4c. orgChart stake tags fade in with their pop
The stake tags used to pop in by scale only, so the MG legibility gate caught them at tiny size mid-pop. They now fade in with the pop. kindgate orgChart re-run (see results).

## 4d. objectCounter keeps decimals; voice.py treats ordinals as number words
- **objectCounter** used to round every value to an integer: 4.8 showed as "5", and Malacca's 9.6 showed as "10". It now shows the value with its own decimals.
- **voice.py build** no longer flags ordinal words (eighth … thirtieth) as mispronounced. The ASR writes them as digits ("8th").

## 5. New generators (additive, no behaviour change for existing films)

- `sets/grammar3d.js`:
  - `datacenter`: long hall, rooftop chiller fans that spin, gensets, substation;
  - `campus`: triangular tech headquarters with a pattern roof and a ring of trees;
  - `fab`: chip fab with clean-room block, stacks, gas tanks and an office link;
  - `cargoJet`: parked freighter.
  - Use them as `{"what": "datacenter", ...}` in set specs.
- `mg2d/shapes.js`:
  - `SH.gpuCard` (fans spin with `t`) and `SH.serverRack` (blinking LEDs);
  - icon words `gpu`, `graphics`, `server`, `rack`, `datacenter`, `ai`, usable as `what` / `object` in any kind.

## Gate results
- kindgate after the no-card change: **68 kinds, 139 cases, 139 PASS**: min caption ≥ 21.6 px, 0 text overlaps, 0 page errors (out/kg/report.json, 2026-11-14 ~10:05). Spot stills reviewed (groupedBars, slopeChart): legible on the bare paper.
- music.py on Malacca's voice: −18.0 dB under the speaking voice, about +1.5 dB in pauses, 2 min to build 9 min.
