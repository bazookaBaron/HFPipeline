# Miniature voice + sound (same method as dialogue)

**Voice:** Fish Audio REST, model `s2.1-pro` (single speaker; `drama-3` is only for multi-speaker dialogue), Stickzy reference (`55046bd7…`, the same one dialogue uses for Leo).
- The key comes from `.vendor-assets/.env` (`FISH_API_KEY`) and is never printed.
- Tempo comes from the script header (`tempo:`). Suez uses 1.15x: s2.1-pro speaks faster than drama-3, and 1.15x gives about 186 wpm.
- Each line is trimmed, and gaps inside it are capped at 0.85 s.
- Each line is placed at its picture anchor.
- faster-whisper (small) gives the word times.

**Sound:**
- **Library:** the dialogue SFX library (`dialogue/sfx/index.json` ids).
- **Levels:**
  - beds about 20 dB under the voice, with a 2.5 dB slow duck while speaking;
  - UI cues 6–10 dB under the voice, 2 frames after the visual;
  - nothing on the final line;
  - master at −14 LUFS and −1 dBTP.

## Per film
1. Write `films/<film>/script.md`:
   - a header with `tempo: 1.3` and `length: <s>`;
   - lines in the form `NARR (emotion) @<s>: text`, ending with `#end`.
2. Write `films/<film>/sound.json`:
   - `video`;
   - `beds` as `[id, dB, t0, t1]`. Overlap two beds to crossfade.
   - `cues` as `[t, id, dB, pan]`, on MG events only (a line draws, a pin drops, a number lands, a card slides).
3. Run:
   ```bash
   python audio/voice.py <film> tts
   ```
   ```bash
   python audio/voice.py <film> build
   ```
   ```bash
   python audio/mix.py <film>
   ```
   - `build` prints overruns, where a line could not start at its anchor. Above about 1 s, shorten the line or move the beat.
   - Redo one line with `python audio/voice.py <film> reroll N`.
4. Output: `out/<film>_final.mp4`.

Run with plain `python`, not `-I`: numpy, scipy and faster-whisper are in the user site-packages.

## Library gaps
There are no desert-wind, ship-horn, harbour or engine sounds yet. Suez uses `amb.wind.pines` for wind and `amb.lake.lapping` for water. Fill these gaps through the dialogue `sfx/tools` flow (Openverse CC0/CC BY plus Earshot vetting), and ask before downloading.

## Narration must match the picture (rule since 2026-11-13)
**Root cause of the Suez v1 mismatch:**
- The picture was built first, from a beat sheet.
- The narration was written afterwards, from a text summary of 12 s blocks ("queue ride, excavator at the bow…"), and was anchored by guess.
- Nothing linked a line to what the camera was showing. The picture later changed (cards dropped, beats re-ordered) without the script being checked again.

**The lock:**
1. Every line declares `[shows: subject]`. Subjects are registered in the page with `subjects.js` (`SUBJ("excavator", EXC)`).
   - Name the specific thing the line mentions, e.g. `card:oil`, not `board`.
2. `node render.mjs lines <page> <film>` checks each line. **No mix or render until it prints `LINE GATE PASS`.**
   - The line's subject must be readable on screen (in frame, big enough, not hidden behind anything) for at least 60% of its spoken time.
   - On a fail, it prints when the subject *is* on screen, so you can re-anchor or rewrite the line.
   - It also writes one still per line (`out/<film>_lineNN.jpg`) for a visual review.
3. `voice.py build` stops when a long script word is missing from that take's transcript (mispronunciation, e.g. "kilometres" was read as "commanders"). Respell it or re-roll the take.
4. Sound cue times are exported by the page (`window.__cues`, from the same constants that drive the animation), with `"cues": "page"` in sound.json. Never hand-time them.
5. Better still for new films: write and voice the script first, then build the camera beats to the line times from `lines.json`.
