# Doc2D audio layer

`python runtime/mix.py <projectDir> --profile doc [--cues sfx.json] [--moods a,b,c]` mixes a Doc2D long-form or reel.
It layers:
- the dry voice-over;
- a **place ambience bed** per scene;
- **action SFX** synced to what's on screen (most of them emitted automatically by the generators);
- **stingers / risers / sonic logo** on structure;
- **music** under everything from a per-chapter **mood map**, with track changes snapped to downbeats and ducked under the voice;
- true **silence beats**.

It masters to **-14 LUFS / -1.5 dBTP** and runs a **QA gate**. The default `--profile reel` path of `mix.py` is untouched.

All SFX and ambiences are synthesised in numpy/scipy (no downloaded audio). Music comes from the CC-BY music lib (`LICENSES.md`).

| file | role |
|---|---|
| `dsp.py` | filters, coloured noise, STFT shaping, stereo reverb, loopify, BS.1770 loudness |
| `ambience.py` | 13 seamless 24 s stereo place loops (+ aliases), built once into `cache/` (`python runtime/audio/ambience.py` pre-builds) |
| `sfx.py` | soft paper-world SFX + the registry: it merges `foley`-style plug-in modules (`GEN/TRIM/ROOM/ALIGN`) |
| `events.py` | conflict / disaster events for runtime/doc/fx: explosion, debris, drone, missile, siren, fire, boom_far, alarm, crumble |
| `vehicles.py` | engines (pass/idle/arrive/depart for 9 vehicle types), horns, car door, brakes, reverse beep, container, chain, crane, splash, rail clack |
| `creatures.py` | birds, gulls, crows, dog, cow, rooster, hooves; crowd applause/cheer/murmur/gasp/laugh/boo/chant; footsteps on 8 surfaces; flag, rope, door |
| `stingers.py` | hit, hit_soft, reveal, riser (ends on its cue), logo (the sonic signature) |
| `docmix.py` | the `--profile doc` mixer: structure cues, music plan, levels, master |
| `qa.py` | mix QA gate (also a CLI for any mix) |
| `autocue.js` | browser hook layer. build.js loads it after the generators and before the scene src, so generators push their own cues |

## Cue format (`window.__sfx` -> `<project>/sfx.json`)
Times are seconds of composition time. `make.js` dumps each chapter with `sfxdump.js` and shifts `t`/`t0`/`t1` by the chapter start.

### 1. One-shot / action SFX: `{t, kind, gain?, dur?, ...params}`
`gain` is dB on top of the kind's default level. Extra keys are passed to the generator.

| group | kind | params |
|---|---|---|
| paper world | `paper` `pencil` `type`(dur) `page` `chalk` `whoosh_soft` `camera_shutter` `cash` `stamp_soft` `ui_tick` | `dur` |
| people | `steps` | `surface` concrete/wood/gravel/metal/carpet/tile/grass/sand, `rate` steps/s (1.9 walk, 3.2 run), `dur`, `people` |
| | `door` | `action` open/close |
| crowd | `applause` `cheer` `murmur` `gasp` `laugh` `boo` `chant` | `dur`, `size` small/medium/large, `chant`: `phrase` 0-2 |
| animals | `bird` `gull` `crow` `dog` `cow` `rooster` `hooves` | `dur`; `hooves`: `gait` walk/trot/canter |
| vehicles | `engine` | `veh` car/truck/bus/ship/train/plane/heli/forklift/motorbike, `motion` pass/idle/arrive/depart, `dur`, `dir` ±1 |
| | `horn` | `veh` car/truck/ship/train |
| | `door_car` `brakes` `reverse_beep` `container` `chain` `crane` `splash` `rail_clack` | `dur` |
| rigging | `flag` `rope` | `dur` |
| events (runtime/doc/fx) | `explosion` | `size` small/medium/large: crack, thump, rolling body, crackle tail, slap-back |
| | `debris` `drone` `missile` `siren` `alarm` `crumble` | `dur`; `debris`: `water` true/false (splashes); drone/missile pass with doppler + pan |
| | `fire` | `dur`, `size` medium/large: roar + crackles + snaps |
| | `boom_far` | distant rumble only (fx.js already delays it 1.2–3 s after the flash) |
| environment (fx/env.js, `envfx.py`) | `thunder` | `near` true: crack and roll; false: low rumble only (delayed by fx.js) |
| | `wind` | `dur`, `strength` soft/medium/strong (a whistling howl at strong). Not the same as the `amb: "wind"` bed |
| | `lights_on` `power_cut` `water_rush` `quake` `hiss` | `dur`: relay clicks + rising hum / clunk + spin-down to silence / rising flood / rumble, rattle, glass settling / steam on fire |
| industry (`industryfx.py`) | `line_stop` | `dur`: e-stop clunk, motors / conveyor / servos winding down, then the klaxon over a stilled hall |
| | `klaxon` `mine_blast` | `klaxon` `dur`: pulsing line alarm horn; `mine_blast`: open-pit production blast seen from the rim (thud, rumble, rock slump) |
| structure | `hit` (big reveal), `hit_soft` (chapter / step accent), `reveal` (shimmer into bell), `logo` (sonic signature, ~1.6 s) | |
| | `riser` | `dur`. **`t` is where it ends**: the cut into a cliffhanger / `#part` ending |
| | `silence_hit` | **the reveal tag**: `dur` (0.8) of near-silence starting at `t`, then a `hit` as it ends |

### 2. Ambience region: `{t, t0, t1, amb, gain?}` (always set `t = t0`; merges shift `t`)
`amb`: `room city port wind rain crowd office factory trading market sea night server cleanroom airport mine separation magnet assembly harbour`.
(cleanroom = fab laminar-flow air + wafer carriers; airport = apron with idling jets and a taxi pass; mine = open pit, haul trucks, a distant blast;
separation = pumps, bubbling tanks, hum; magnet = press thunks + hydraulics + furnace; assembly = welding robots, nut-runners, line index;
harbour = fishing harbour with puttering boats, gulls, ropes, quay talk.)
Aliases: street→city, harbour/harbor→port, bazaar→market, ocean→sea, datacenter→server, newsroom→office, exchange→trading, warehouse→factory, storm→rain, desert→wind, village→night, hall→room, fab/lab→cleanroom, apron/runway/airfield→airport, quarry/pit→mine,
chemical/refining/smelter→separation, sintering→magnet, carplant→assembly, fishing/marina→harbour.
Regions crossfade over 1.5 s (equal power) centred on their edges.

### 3. Music marker: `{t, music: "mood"|"pad_in"|"pad_out"|"swell", mood?, gain?}`
- `mood` (`tension investigative calm dread hopeful playful triumphant trailer upbeat`) starts a new track.
  - The change is snapped to the outgoing track's phrase start (±3 s) or downbeat (±2 s).
  - The new track enters on its own first downbeat, and the old one fades over 1.2 s.
- `pad_out` / `pad_in` take the music out and back in (3.5 s / 3 s fades), e.g. for a cold, music-less stretch.
- `swell` lifts it by `gain` dB (default 5) in a 4 s bump.

### 4. Silence beat: `{t, silence: dur}`
Ambience, SFX and music drop to -45 dB in 80 ms (ending at `t`), hold for `dur`, then recover over 0.4 s. The voice is untouched.

From the shot list: `+ sfx <time> silence_hit dur=0.8`, `+ sfx <time> hit`, `+ silence <time> 0.8`, `+ music <time> swell`.

## Payoff rule (user rule, 2026-10-19)
No section-change / transition stinger in the run-in to the video's final payoff:
- from 12 s before the **final line** (the last spoken line below 99; 99 is a spoken endcard) to that line's end, docmix drops
  `hit`, `hit_soft`, `reveal`, `whoosh_soft` and `logo` cues;
- it also drops any `riser` whose build overlaps that window, so the riser that would feed the payoff goes too;
- a `silence_hit` there keeps its silence and loses its hit, and the endcard logo after the final line stays.

It logs what it dropped. `--no-payoff-rule` turns it off.

## What the mixer adds by itself (`--structure auto`, default)
It reads `script.txt`, `chapters.json` and `words.json` in the project. A hand cue of the same kind within 4 s wins.
- **Sonic logo** before every chapter opener (ending just before its first word), and on the endcard after the last word (`--no-endcard-logo` to skip).
- **Riser** into every `#part` break, ending 0.25 s after the part's last word. This is where shorts.js cuts.
- **Mood map**, one mood per chapter:
  1. `--moods tension,investigative,...`, else
  2. `<project>/moods.json` (`["tension", ...]` or `{"chapters": [...]}`), else
  3. a default documentary arc that opens on tension and ends on hopeful.
- `music_plan.json` records every segment's track, mood, snap offset and **downbeat grid in film time**, so cuts can be snapped to the music.
- `credits.txt` lists every CC-BY track used.
- Bed dips: `hit` -5 dB for 1.6 s, `logo` -4 dB, and a riser's end dips the bed 8 dB so the cut lands clean.

## Auto cues from the generators (`autocue.js`)
These need no call in scene code. Opt out with `window.AUTOCUE = false` (before load), or `DOC.autocue(false)` in src.

| generator | emits |
|---|---|
| `actor.walk/run` (incl. `perform` walkers, `marchStep`) | `steps` over the walk window. Rate comes from `CAST.GAIT[gait].stepT`; surface from `DOC.surface`, else from the place ambience |
| `actor.verb` | signDocument/takeNotes→`pencil`, slidePaper/handOver→`paper`, type→`type`, hoistFlag→`rope`, lock/openGate→`chain`, phoneCall→`ui_tick` |
| `actor.do` | applaud→`applause`, type→`type`, write→`pencil`, cheer→`cheer`, flagWave→`flag` |
| `CROWD.*` | `beats` applause/ovation→`applause`, cheer→`cheer`, protest→`chant`, raise→`murmur`; `chants[]`→`chant`; march/stream/queue/board/disperse/picket→multi-walker `steps`; a rally/assembly without beats gets a soft `murmur`. Size comes from the head count |
| `VEH.drive` | `engine` (veh from kind/gen class; motion from the options: stop→arrive, startAt→depart, speed 0→idle, profile takeoff/land), `door`/`door_car` from `doors`, `chain` from `ramp`. `convoy`/`shuttle` give one group cue; `traffic` is left to the street bed |
| `RECIPE.scene` / `SETS.mount` | the place id picks the bed. It upgrades compile's `room`/`wind` fallback, or adds a bed when there is none. Place details: gulls + a far ship horn at ports, gulls at sea, a distant car horn in the city, a dog at night, birds at markets (one per kind per 12 s) |
| `DOC.chapterTag` | `logo` |

Coalescing at `DOC.finish()`:
- overlapping footsteps merge into one multi-walker cue;
- same-kind cues closer than 1.2 s merge;
- a hand cue of the same kind within 1.5 s wins;
- one-shots are capped at about 1 per 1.5 s.

## Levels (relative to the voice's integrated loudness)
| layer | default | flag |
|---|---|---|
| ambience | -30 LU, ducked a further 3 dB under speech | `--amb-db` |
| SFX (loudest 400 ms) | -12 LU plus per-kind `TRIM` (paper world -1..-6, stingers +2..+6) | `--soft-db` |
| music | -20 LU in gaps, sidechain-ducked 8 dB under speech (60 ms / 500 ms) | `--pad-db` |

Master: gain-stage, 4x-oversampled limiter at -2 dBFS, then two-pass **linear** loudnorm, so silence beats and gaps are not pumped back up.
Outputs: `mix.wav`, stems `amb.wav` `sfx.wav` `pad.wav`, `music_plan.json`, `credits.txt`, `qa.json`.

## QA gate (`qa.py`, run automatically; `--no-qa-gate` reports without failing)
It **fails** the mix when any of these happen:
- integrated loudness is off target by more than 0.7 LU;
- true peak is above -1.0 dBTP;
- any clipped sample;
- the voice is less than **12 dB over the bed** (ambience + music) in more than 5 % of 400 ms speech windows;
- an SFX sits within 4 dB of the voice for more than 1 s of speech;
- a silence beat isn't at least 40 dB under the voice.

Any finished mix: `python runtime/audio/qa.py mix.wav [--voice vo/voice.wav --bed amb.wav,pad.wav --sfx sfx.wav]`.

Demos: `out/doc2d-sound-demo/` (before/after). `out/doc2d-audio-lib/` holds renders of every kind.
