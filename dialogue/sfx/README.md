# DIALOGUE SFX + ambience library

Sound for the DIALOGUE format: two people talking quietly in low-poly night sets, with soft motion graphics.
Everything here sits **under the dialogue**. Beds are quiet, foley is sparse, and UI sounds are short.

## Layout

| path | what | level |
|---|---|---|
| `amb/<kind>/*.wav` | ambience beds (real recordings from Openverse, CC0 / CC BY), seamless loops of 30–45 s, stereo | about −30 LUFS integrated |
| `amb/birds/*.wav` | sparse night birds (owl hoots), one-shots | peak −6 dBFS |
| `foley/*.wav` | real one-shots (fire pops and log shifts, cloth, mug on wood, steps, paper, pencil), mono, trimmed | peak −6 dBFS |
| `ui/*.wav` | MG / UI sounds rendered in code from the Earshot bank (pops, slide, tick, whoosh, ding, pin), mono | peak −6 dBFS |
| `index.json` | semantic id → file, duration, LUFS, peak, licence, plus the per-set bed recipes (`sets`) | |
| `credits.json` / `CREDITS.md` | source, creator, licence and Earshot verdicts for every file | |
| `tools/` | the scripts that built the library (search, download, vet, build) | |

All files are 48 kHz, 16-bit WAV.

## Semantic ids

- `amb.<what>[.alt]`: a bed, for example `amb.campfire.close`, `amb.forest.crickets`, `amb.wind.pines`, `amb.lake.lapping`, `amb.city.distant` or `amb.breeze.night`. `.alt` is a second take that gives variety across scenes.
- `amb.birds.owl.NN`, `foley.<thing>.<action>.NN`: one-shot variants. Pick a variant by `NN` and rotate it, so that two neighbouring cues never use the same file.
- `ui.<role>.<flavour>`: MG sounds, for example `ui.pop.soft`, `ui.card.slide`, `ui.line.tick`, `ui.whoosh.soft`, `ui.ding.number` or `ui.pin.drop`.

Look up a sound by id in `index.json` → `sounds[id].file`. That path is relative to `dialogue/sfx/`. Never hard-code file names.

## How a scene picks its beds

`index.json → sets` holds one recipe per set: `campfire_forest`, `hilltop_city`, `pine_ridge` and `lake_shore`.

```json
"campfire_forest": {
  "beds":      [["amb.campfire.close", 0], ["amb.forest.crickets", -6], ["amb.wind.pines", -12]],
  "wide_beds": [["amb.campfire.distant", 0], ...],
  "sparse":    [["amb.birds.owl", -14, 25, 60]],
  "foley":     ["foley.fire.ember_pop", "foley.fire.log_shift", "foley.cloth.rustle", "foley.mug.set_wood"]
}
```

1. **Beds.** Each `[id, dB]` is a looped layer. The gain is in dB relative to the file, which is already normalised to −30 LUFS. Layer 0 is the set's signature sound and the others add air. Use `wide_beds` instead of `beds` for wide or establishing shots where the fire is far from the camera. Loop each layer for the whole scene. Start each layer at a random offset so that the loop points never line up, and give it a 1–2 s fade in and out at the scene edges. Crossfade beds over about 1.5 s on a set change. Do not cut them.
2. **Sit the bed under the voice.** The summed bed should land about 18–22 dB below the dialogue's speech loudness. While someone speaks, duck it a further 2–3 dB with slow attack and release, about 300 ms / 800 ms. In pauses and silences the bed comes up and carries the scene, so never mute it.
3. **Sparse layer.** `[id_prefix, dB, min_gap_s, max_gap_s]` places a random `amb.birds.owl.NN` variant every *min–max* seconds. Pan it ±0.3–0.6 and keep it out of the 1 s around a line's key word. Skip it entirely in tense or emotional beats.
4. **Foley.** Use only the ids listed for the set, and only where the picture shows the action: a character shifts, sets a mug down or walks up. Fire pops can also fall at random every 8–20 s on campfire sets, at −10 to −16 dB. Foley sits about 10–14 dB below the voice.
5. **UI.** These go on MG beats only: a number lands (`ui.ding.number`), a card slides in (`ui.card.slide`), a line draws (`ui.line.draw` / `ui.line.tick`), a pin drops on a map (`ui.pin.drop`) or a label pops (`ui.pop.*`). Use about 2–6 per minute, place them 1–2 frames after the visual, keep them centred or within ±0.25 pan, and sit them 6–10 dB below the voice. Cuts and transitions are silent. Nothing plays on the final line.

A missing id means the library has a gap (see `credits.json → gaps`). Recipes drop missing ids automatically, so a scene still works with the remaining layers.

## World section (miniature films, added 2026-11-14)

A second section serves the miniature documentaries (`samples/obj3d`): office, court, hearing, newsroom, trading, factory,
mill, diner, hotel, street, plaza, rally, airport, harbour, station and rain beds (`amb.room.*`, `amb.crowd.*`, `amb.work.*`,
`amb.street.*`, `amb.travel.*`, `amb.weather.*`) and world one-shots `world.<thing>.<action>.NN` (gavel, stamp, typing,
phone, shutter, applause, cheer, gasp, door, chair, paper, briefcase, steps, car/truck/train/jet/helicopter passes, ship horn,
cash register, machine clunk, press, keys, cup, glass, flash, siren, typewriter, telegraph, loom). Its needs carry
`"section": "world"` in `tools/needs.json`. Nothing in the dialogue section was changed or removed.

- Build it with `<earshot python> -I tools/build.py --section world`. That builds only the world needs and **merges** them into
  `index.json` / `credits.json` / `CREDITS.md`; every other id, file, set recipe and credit is kept, and the UI bank is not
  re-rendered.
- One-shot needs may set `"variants"` (up to 4 here, at most 2 per source file) and `"len_s"` (pass-bys, sirens, applause:
  the vetted moment is widened around its centre so the whole event is kept, with a 0.3 s fade-out).
- Scene routing (which beds and one-shots a miniature scene uses) lives in `samples/obj3d/audio/sfxmap.json`, not in `sets`.

### Human-voice gate for crowd needs

Needs marked `"crowd": true` (courtroom, hearing, newsroom, trading, diner, plaza, rally, airport and station beds;
applause, cheer and gasp one-shots) are crowds by definition, so Earshot's "people talking in the background" reading is high
for every good candidate and the normal gate would reject all of them. For these needs the gate asks whether a listener can
**make out words**, not whether people are present:

1. `python tools/speech_gate.py tools/needs.json _work` (plain python: faster-whisper) transcribes each vetted bed section
   and one-shot moment with whisper small (any language, no VAD, no text conditioning). A word counts as intelligible when
   its probability is at least 0.6 and its segment's no-speech probability is below 0.6. Results go to `_work/speech.json`.
2. `build.py` rejects a crowd bed with 4 or more intelligible words in its kept section, and a crowd one-shot with 2 or more.
   Singing is still rejected through Earshot ("singing vocals" z >= 2.5). A candidate the speech gate has not seen is
   rejected (fail closed). The readings are stored per file in `credits.json → human_voice_gate`.

Every non-crowd world need keeps the original gate unchanged.

## Licences

Every Openverse file is CC0 or CC BY. No NC or ND files are included. **CC BY files must be credited.** Paste the lines under *Attribution lines* in `CREDITS.md` into the video description of every video that uses them. Earshot bank renders are our own code-made output (the Earshot code is under the MIT licence).

## Rebuilding / extending

The tools live in `tools/`, and the Earshot venv is `.vendor/earshot/.venv`. Set `EARSHOT_HOME=HF_HOME=.vendor/hf-earshot` and `EARSHOT_THREADS=3`, and run heavy steps through `runtime/jobq.js`.

1. Add a need to `tools/needs.json`: queries, minimum and maximum duration, exclude words, an Earshot brief and realistic confusions. Phrase the brief like the Earshot vocabulary, for example "a crackling fire" or "crickets at night".
2. Search: `python -I tools/ov_search.py tools/needs.json _work/candidates.json <need>`. This uses the anonymous Openverse API: page_size ≤ 20, about 1 request every 6 s, and it backs off on 429.
3. Download: `python -I tools/ov_download.py _work/candidates.json _work --per 6 <need>`. Files go to `_work/dl` and are decoded to FLAC in `_work/wav`.
4. Vet: `<earshot python> -I tools/vet.py tools/needs.json _work <need>`. This runs rank, find, match and realness.
5. Build: `<earshot python> -I tools/build.py`. It applies the fixed selection rule, then the human-voice gate, then processing. It writes the library, `index.json` and the credits.

**Selection rule:** a candidate passes when its Earshot match is `strong` or `plausible` (z ≥ 2.5) on the kept section and its realness verdict is `real or pro-produced`. The highest z wins, and a CC0 file wins over a CC BY one when it is within 0.5 z. Any section or moment where a human-voice query ("a man speaking", "people talking in the background", ...) reads z ≥ 2.5 is rejected. `_work/` is scratch: delete it freely, because everything kept is in the library and the credits.
