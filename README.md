# HFPipeline

Two automated video-making pipelines built on [HyperFrames](https://hyperframes.heygen.com) (HTML + GSAP/three.js compositions rendered headless to MP4):

| Pipeline | Format | Look |
|---|---|---|
| **Puppet** (`runtime/`, `video-engine/`) | 9:16 reels, 16:9 long-form (≈8 min), PART 1…N Shorts cut from a long-form | Monochrome poster style: a rigged flat-vector presenter puppet, paper cards with hard shadows, poster maps, iso worlds, diagram boards |
| **Dialogue** (`dialogue/`) | One 9:16 + 16:9 episode from a single build | Two low-poly 3D characters talking at night in a reused set; "field notebook" motion graphics carry the facts |

Both turn **a topic → researched script → voice → bespoke composition → one render**. There is no fixed template: each video is authored per topic using a shared kit.

## How the Puppet pipeline works

1. **Script** – written by the `reel-writer` (≤1.5 min reels) or `longform-writer` (16–18 min, chapters + `#part` breaks) skills; gated by `runtime/scriptcheck.py`.
2. **Voice** – `runtime/voice.py` runs a local TTS model (Chatterbox) with a reference voice, prosody-scored takes, and writes `vo/voice.wav` + word timings `words.json`. Checked by `voicecheck.py` / `prosody.py` / `asrscore.py`.
3. **Brief + composition** – a per-topic HyperFrames composition is hand-authored from the kit:
   - `puppet.js` – rigged presenter (poses, talking, blinks, look, face)
   - `components.js/css` – 23 reusable poster components (9:16 and 16:9)
   - `verbs.js` – motion verbs (drop, rise, whip, slam, draw, odometer, captions, `V.sfx` cues …)
   - `theme.js` – 8 hues, rotated per video
   - `maps.js` + `geo/`, `iso/`, `board/` – poster maps, isometric worlds, vector diagram boards
   - `images.js` – licensed photo cards for long-form
4. **Render** – every heavy step (render, snapshot, voice, ffmpeg) goes through `runtime/jobq.js`, a one-slot, RAM-aware machine-wide queue so the PC never overloads.
5. **Finish** – `runtime/lf/finish.sh` (zero-LLM): SFX merge → music/voice mix (`mix.py`, `audio/`) → stitch chapters → outro → pad → 720p copy. `runtime/shorts/shorts.js` cuts a long-form into a Shorts series; `thumbnail.js` makes the thumbnail.

Orchestration instructions for the AI agent live in `.claude/skills/make-video`, `reel-writer`, `longform-writer`, `thumbnail`.

## How the Dialogue pipeline works

Details: [`dialogue/PLAN.md`](dialogue/PLAN.md), [`dialogue/STYLE-GUIDE.md`](dialogue/STYLE-GUIDE.md), [`dialogue/SCRIPT-VOICE.md`](dialogue/SCRIPT-VOICE.md).

1. **Script** – a two-person conversation (bar: `dialogue/samples/campfire_guard.md`), written with the SCRIPT-VOICE method.
2. **Voice** – `dialogue/fish` / `dialogue/voice`: per-speaker TTS (Fish Audio), generic `voice_ep.py` / `mix_ep.py`, pitch-swap check, room tone + soft music.
3. **Compile** – `dialogue/compiler/` (`autoplan.mjs`, `compile.mjs`, gates) turns script + word timings into a shot plan: camera follows the speaker, acting beats, motion-graphic cutaways.
4. **Engine** – `dialogue/engine/` is a three.js world: faceted low-poly cast (`cast/`), sets (`sets/`: campfire, hilltop city, lake shore, pine ridge), toon shading, fire/embers/fog life effects, face layer.
5. **Motion graphics** – `dialogue/mg/` renders notebook-style infographic/iso cutaways (`templates.js`, `isokit/`).
6. **Render** – `dialogue/engine/render.mjs` drives headless Chrome (puppeteer-core) per frame, queued through `runtime/jobq.js`; `dialogue/thumbs/make_thumb.mjs` makes the thumbnail; `dialogue/sfx/` holds the SFX library tooling.

## Layout

```
runtime/        puppet kit, voice/mix/audio tools, job queue, lf/ + shorts/ finishers
video-engine/   HyperFrames project + puppet assets/compositions
voice-pipeline/ shared voice tooling
dialogue/       dialogue pipeline (engine, compiler, mg, voice, sfx, thumbs, episodes)
.claude/skills  agent skills (also mirrored in .agents/skills)
```

## Setup notes

- Node 20+, Python 3.11+, ffmpeg on PATH; `npm install` at the repo root (provides `puppeteer-core` for dialogue renders), `npm install` in `video-engine/` for HyperFrames.
- This repo holds the **recipe only** (code, scripts, docs, skills). Generated media, assets and vendored libraries (three.js, gsap, lucide icons, fonts, puppet SVG art, relief tiles) are git-ignored; fetch/restore them locally (`npm install`, see `dialogue/PLAN.md`, `runtime/MAPS.md`).
- Licensed 3D asset packs (Quaternius, CC0) are **not** committed; place them in `.vendor-assets/dialogue/raw/` as described in `dialogue/PLAN.md`.
- TTS models, voice references and API keys (`.env`) are local-only and git-ignored, as are rendered media (`out/`, `*.mp4`, `*.wav`).
- **Per-run cleanup:** when a run finishes (`lf/finish.sh`, `shorts.js`, dialogue `epvideo`) `runtime/cleanup_run.js` deletes every generated asset except the final video(s), thumbnail and small text sources. Set `KEEP_ASSETS=1` to keep intermediates (e.g. before re-finishing a run).
- Always run heavy jobs via `node runtime/jobq.js` (status: `node runtime/jobq.js status`).
