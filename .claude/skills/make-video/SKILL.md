---
name: make-video
description: Make one item for the weekly content plan — a reel (9:16), a carousel (1080x1350 slides, max 7) or an 8 min puppet long-form (16:9) — authored per topic with the runtime kit. Use when the user gives a topic and says reel / carousel / long-form / "make a video", or says "carousel - paper", "carousel - repos", "carousel - animation" or "carousel - vloombox".
---

# make-video: runtime-authored reels, carousels and long-form

Every video is authored for its topic: research → script → voice → brief → bespoke HyperFrames composition → one render.
There is no template pipeline and no Gemini script or research (`orchestrator/`, `control-panel/` are the retired pipeline — do not use them).
Project root: `C:\Repos\HFPipleine`. Work dir per item: `out/reels/<slug>/` or `out/longform/<slug>/`.

## 0. Token rules (most important — the user is on a token-limited plan, the usage window is the limit)

- One fresh session per item. Do not read old chat history; this file + the docs it names are the whole context.
- Opus (you) does: research, script, brief, final review. A **Sonnet** subagent (`model: "sonnet"`) does building, checks, render, metrics, mix.
- Read docs on demand, only the sections you need. Never print big files; never re-read a whole file you just edited; tail logs.
- `npx --yes hyperframes@0.8.46 snapshot` for checks; ONE full render; at most one fix render.
- Look at ONE contact sheet per item (6–9 frames). Never watch whole videos frame by frame.
- Use library components/maps/puppet instead of hand-writing their markup. Bespoke per-topic visuals are still expected (see §3).
- Long renders/voice runs: `run_in_background: true`.


### Orchestration (measured: LF ≈ 11–12% of the week, reel+carousel ≈ 3–4%)
- ALWAYS a new chat per video (a long chat adds ~4–5% of the week per video). Main chat = thin orchestrator (≈5–8 turns per video, short replies, no polling). Prefer a fresh session per video.
- Long-form: ONE Opus **producer** agent (research → script ~1,290 words → facts/slots/images → detached voice → STORYBOARD with 2-builder split → thumbnail → description) → wait for `words.ready` with ZERO agents running (voice is local) → THEN spawn **2** Sonnet builders (own build-x.js, never touch each other's files) → `bash runtime/lf/finish.sh out/longform/<slug> <theme>` (zero-LLM: sfx, mix, stitch, outro, pad to ≥ 8:00, 720p).
- Brief agents with paths, not pasted content; reports ≤ 8 lines. One contact-sheet look per item. Small fixes inline (sed); only changed voice lines re-synthesise.

### Heavy jobs go through the queue (the PC froze at 0 GB free RAM with ~87 render Chromes)
Every render, snapshot, bake, voice synthesis and ffmpeg finish pass runs through `runtime/jobq.js`: 1 slot machine-wide, it starts only with ≥ 3 GB free RAM, in priority order, at below-normal CPU priority.
- `runtime/shorts/shorts.js` queues itself when run from the CLI (`runtime/shorts/heavy.js`). Nested steps inside a slot run directly, so there's no deadlock.
- Renders use 2 workers (`HF_WORKERS`; it was 6).
- Priority: `JOBQ_PRIO=1` when the user is waiting on that output, 5 by default, 9 for demos.
- Status: `node runtime/jobq.js status`. `JOBQ=0` bypasses the queue, for debugging only.
- Never launch renders in parallel by hand, from sessions or with `&`: queue them.
- The ledger's wall times include the time spent waiting in the queue.

## 1. Kit (read the doc, not the source)

| What | File | Doc |
|---|---|---|
| Theme (8 hues, rotated per video) | `runtime/theme.js` → `node -e "console.log(JSON.stringify(require('./runtime/theme').next('<slug>')))"` | header comment |
| Motion verbs | `runtime/verbs.js` (drop rise whip pop slam out pulse shake hl draw odo scramble type ring click burst cam glitch halftone captions, `V.sfx`) | source header |
| Components (23, 9:16 + 16:9) | `runtime/components.js` + `components.css` | `runtime/COMPONENTS.md` |
| Puppet (bust + full body) | `runtime/puppet.js` | `video-engine/assets/mascot/puppet/README.md` |
| Poster maps | `runtime/maps.js`, `runtime/geo/geo.js` | `runtime/MAPS.md` |
| Iso worlds (city, parking, data-centre parts; dense, traffic) | `runtime/iso/iso-kit.js`, `worlds.js` | `runtime/ISO.md` |
| Diagram board (vector draw-on, loops/causal) | `runtime/board/board-kit.js` | `runtime/BOARD.md` |
| Reel endcard (vloombox) | `runtime/endcard.js`, `runtime/append_endcard.py` | — |
| Carousel | `runtime/carousel.js`, `carousel_export.js`, `carousel_lint.js`, `carousel_fetch.js`, `pdf_figs.py`, `assets/vloombox/facts.json` | `runtime/CAROUSEL.md` |
| Photoreal images (long-form) | `node runtime/images.js <dir> <slots.json>` → `media.json` | header comment |
| Voice (local Chatterbox `cb`, `narrator-explainer` ref) | `python runtime/voice.py <dir> [--gap --cb-tempo]` → `vo/voice.wav`, `words.json` | — |
| SFX cue dump / mix / metrics | `node runtime/sfxdump.js <dir>`; `python runtime/mix.py <dir> --music auto`; `python runtime/measure.py <mp4>` | `--help` |
| Reference grammar | `analysis/runtime-reels/REFERENCE-STUDY.md` (read only the section you need) | — |
| Best example reel | `out/reels/llm-built/` (reel.html, BRIEF.md, build.js) | — |

## 2. Style rules (all formats)

- Monochrome poster: one hue per video from `Theme.next(slug)`; dot-grid bg on every section (bg / deep / pale of the same hue).
- Paper `--paper` cards, 6 px `--ink` outlines, HARD offset shadow in `--shadow` (no blur). Accent words on `--marker`. `--alert` ONLY for ✕ and stamps.
- Character = the rigged poster puppet (curly hair, cobalt shade side, red/blue wedge nose, red-orange crewneck). Original character — never the poster's exact guy.
- Seek-safe: one paused timeline `window.__timelines["main"]`; no Math.random/Date/rAF/CSS animations; finite repeats; `immediateRender:false` on fromTo that reveal; elements hidden until their entrance.
- No overlap: content never covers captions or the character. `check` must reach 0 errors.

## 3. Bespoke visuals per script

The library is a vocabulary, not a menu. For every beat, ask "what is the visual metaphor for THIS sentence?"
Use a component when it fits; otherwise author a custom element for the topic (e.g. v2's "the cat sat on the ___" probability bars, token splitter, GPU wall).
Layer 3–6 things per moment (main visual + sticker/doodle + character reaction + camera + captions). If a custom piece is clearly reusable, add it to `components.js` + `COMPONENTS.md` at the end.

## 3b. Mode mix (every reel and long-form uses all three)

- **kit**: hook, numbers, quotes, photos, maps, endcard.
- **iso**: anything physical or system-like (city, parking, fab, data centre, logistics). Make it a dense world, not a lone box.
- **board**: anything abstract or causal (loops, comparisons, "how it decides").

How blocks work:
- A block is ONE persistent scene. LF blocks run 30–90 s (2–4 per video); reel blocks run 10–25 s (1–2 per reel).
- Nothing auto-exits inside a block. Old parts dim and the camera travels; it ends on a pull-back.
- Pass the block windows as `LF.puppet(...,{quiet:[[t0,t1]]})`, so there's no auto-gesture there.
- The puppet points at the focused subject and presents on the pull-back.
- In builder `common-*.js`, the line-boundary auto-exit wrappers must skip block windows.

Brief/STORYBOARD:
- Block header: `## BLOCK b2 · iso|board · 0:42–1:58 · world: city(7)`.
- Rows: `line → subject → build step → camera → chip → sfx`.

HARD rules:
- The narrated **subject** is focused (`ISO.focus` / `B.focus`) for every line that names it: fully visible, marker-highlighted, occluders x-rayed. `subjectcheck.js` must pass.
- Theme tokens only.
- Iso renders need `--workers 4 --no-browser-gpu`.
- Builders read ISO.md / BOARD.md only, never the kit source.

## 4. REEL (≤ 1.5 min incl. endcard) — target ≤ 0.8 of a 5-hour window

1. **Research** (Opus): 3–6 web searches. Save `research.md` (facts + source URLs). No Gemini.
2. **Script** (Opus): follow the `reel-writer` skill (reference-reel structure, 200–270 words, 3–5 deadpan `{dry}` sarcasm beats that punch up (reel-writer §3b) → `python runtime/scriptcheck.py <dir> --allow ...` PASS → Haiku explain-back PASS). No endcard text (it is appended).
3. **Voice** (user-approved "D", 2026-10-08): `python runtime/voice.py out/reels/<slug> --gap 0.18` — `{dry}` lines are voiced as their own chunk with lower exaggeration (deadpan); defaults = Chatterbox (`chatterbox-venv`), voice `narrator-explainer` (same narrator, explainer-style reference), paragraph chunks, 2 takes each picked by `voice_pick.py` (Whisper clarity + `prosody.py` delivery vs the 5 reference reels), assembly tempo 1.15 (≈ 3.3 w/s). Run it in the background (~1 min of voice per 10 s of audio on the 4050). Then `python runtime/append_endcard.py out/reels/<slug>` (ALWAYS for reels).
   **Voice gate:** `C:/Repos/tts-venv/Scripts/python.exe runtime/voicecheck.py <dir> --final` → 0 unclear (title-line "vs/versus" mismatches are scoring noise) and `C:/Repos/tts-venv/Scripts/python.exe runtime/prosody.py <dir>/vo/voice-body.wav` → penalty ≤ ~2 (refs 0; old voice 6.75). Unclear word: add a `runtime/lexicon.json` entry or rephrase; only that chunk re-synthesises.
4. **Brief** (Opus, ~1 page, `BRIEF.md`): theme id, beat table (line → time range → main visual → secondary → character pose → sfx), which real-site captures are needed (public pages: headless Chrome capture; logged-in apps: rebuild in HTML).
5. **Build** (Sonnet subagent, give it this file's §0–§3 + BRIEF.md path + `out/reels/llm-built/` as example): reel.html using components/puppet(bust)/verbs/captions + `Endcard.build`; grammar (15 % calmer than before, matching the slower voice): 2.1–3.0 events/s, entrances 5–9 frames, exits 3–5 frames, content holds ≤ 1.2 s, the end recap / cheat-sheet held readable ≥ 2 s, captions word-synced. No fake "floater" motion to game metrics. check → snapshot → ONE render → `measure.py` (honest numbers) → sfxdump → `mix.py --music auto` → mux → contact sheet.
   **Hard gates (builder must pass BEFORE the full render, not just report):**
   - Size: content zone y 330–1180 (puppet box lower-right and caption band excluded). Main visual 860–960 px wide; numbers 90–160 px; body text ≥ 34 px. Component defaults are catalogue-sized — always pass big w/h.
   - Frame 0 is the hook: at t=0.0 the hook is already on screen as big text (≥ 90 px) next to the main visual — no build-up from an empty frame. Check the t=0 snapshot.
   - Never empty: something in the content zone from t=0.15 s and on every line, including the last one.
   - Pre-render motion check: render a low-res draft (or snapshots every 0.5 s) and run `measure.py`. Need moving ≥ 78%, content ≥ 68%, no still > 1.0 s (exception: the end cheat-sheet recap may hold still up to 2.5 s so it can be read and saved). Fix the listed still gaps with real sub-beats (3–4 per line, keyed to words), then render.
   - Stray gate: `node runtime/strays.js <compDir>` must print "no strays" (it finds small parked dots/blocks visible before their entrance, e.g. burst bits). Never create an element visible and animate it later — create hidden, reveal at its time. Intentional tiny decorations get `data-deco`.
   - No idle wobble/bobbing or tickers just to pass the motion gate: fill gaps with real story beats.
   - Look at your own final contact sheet before reporting.
6. **Review** (Opus): one contact sheet + metrics. Fix once if needed.
7. Cover: run the `thumbnail` skill (1080x1920 cover, no AI). Deliver: mp4 path, cover, description with music credit from `credits.txt` (CC BY), hashtags.

## 5. CAROUSEL (max 7 slides, IG @vloombox, poster theme) — ≤ 0.3 window

Read `runtime/CAROUSEL.md` first (modes, spines, schema, rules). Work dir `out/carousels/<date>-<slug>/`.
Pick the mode from what the user typed:

| Trigger | Mode | Research |
|---|---|---|
| "carousel" + a topic (or the reel's topic) | **explainer**: reframe the topic into an archetype (myth→reality, the why behind it, case study, heard-of-but-can't-explain, why-it-does-X-and-how-to-stop-it). Never ship "How does X work?" as the title | reuse the reel's `research.md` |
| "carousel - paper" | **paper of the week**: #1 paper this week | `carousel_fetch.js papers` → pick → `paper <id> <dir>` (real figures + page 1) |
| "carousel - repos" | **repos of the week**: 4 trending repos | `carousel_fetch.js trending` → `repo <name> <dir>` each |
| "carousel - animation" | **animation repos**: 4 new/trending motion repos | `search --topic animation` + `trending --grep animation,motion,gsap,three,shader` |
| "carousel - vloombox" | **rated list** (jobs, referrals, …): you pick the topic (e.g. "Where to find tech jobs before 500 people apply") | `runtime/assets/vloombox/facts.json` only |

1. Hook first: write 5 cover titles, score them (specific · about the reader · open loop · tension · payoff promised), keep one with ≥ 4/5.
2. Spine test: write the 7 headlines alone; they must tell the whole story.
3. Write `slides.json` (v2 types), `node runtime/carousel.js <dir>/slides.json <dir>` (lint runs; fix every ERROR) → `node runtime/carousel_export.js <dir> --sheet` (fix ISSUES) → look at `sheet.jpg` once.
4. Real images only (paper figures, repo README/screens, site screenshots), each with a credit. Look at every crop before using it. Never AI-generate a stand-in.
5. vloombox rule: on job / referral carousels vloombox is rated #1 (lint enforces it), using only verified claims from `facts.json`; competitor pros/cons stay factual and fair; the pick keeps its small "we built it" tag. On DSA / LLD / interview carousels, don't rate vloombox as a practice site (it isn't one); it appears as the next step ("ready to apply? fresh roles on vloombox.in") and in the end slide.
6. Deliver: PNGs + caption (hook line, 2–3 lines of value, links: paper/repo URLs, "save this", hashtags). Never ask for likes.

## 6. LONG-FORM (8 min, 16:9) — 2–3 windows; split across sessions per chapter if needed

Rules: NO opening montage, NO captions, FULL-BODY puppet animated throughout (walk, step, lean, point at screen, present, jump, sit, mouth, hands — never parked), slower narration (`--speed 1.0 --gap 0.35`, ~145–150 wpm) but motion equally dense (something moves every second; holds ≤ 2–3 s with micro-motion).
Images: photoreal ONLY via `runtime/images.js` (licensed real photo first; fal photoreal generic scenes as fallback; grain filter when `grain:true`; never illustrations; never AI-generate real people, logos or real events). Credit every licensed photo in the description. Maps via `runtime/maps.js` — make them the hero shots.

1. Research (Opus): 15–20 searches → `facts.json` (claim, number, source URL). Cached; never redo.
2. Script (Opus): **~1,290 words for 8:00** (Chatterbox at --cb-tempo 1.0 ≈ 2.85 w/s; get the length right first time, re-voicing wastes a window). Write it with the `reel-writer` rules (clarity, spoken rhythm, an example per point, no asking for likes) scaled to long-form, and run `scriptcheck.py --profile ref`, 5–7 chapters, conversational, an example in every point. `script.txt` one line per beat; mark chapters with `# Chapter title` lines (strip before voice).
3. Voice (2026-10-09, Chatterbox = the approved reel voice, calmer tempo for LF): `python runtime/voice.py <dir> --cb-tempo 1.0 --gap 0.35 --chapters chapters.json --pause 2.8` (≈ 2.85 w/s; 1,290 words + pauses ≈ 8:05). Run detached (Start-Process) — it exceeds the Bash time limit. Voice gate as for reels (voicecheck + prosody). **Chapter-pause gate:** in `words.json` the silence before every chapter's first word must be ≥ 2.6 s — check it before spawning builders (bermuda shipped with 0.75 s gaps and the cards flashed by). No reel endcard.
   **Chapter hooks:** each chapter's FIRST script line is a short teaser question or hook about that chapter ("But what happens when the storm actually hits?", "So how do you drink water from a rock?"), never a flat statement. Builders place `LF.chapterCard(tl,n,title,null,after,{firstWord})` in that pause: the card is MANDATORY for every chapter (not cold open), uses the kit defaults (starts 2.3 s before the first word, holds ≥ 2.6 s, ≈ 3.5 s on screen; slam, fast type-on, slow 1.0→1.03 scale only). Never hand-roll a chapter title.
4. Brief per chapter: beat table + image slots (`slots.json`) + map moves + puppet blocking (where he walks/stands relative to the visual).
5. `node runtime/images.js <dir> slots.json` once for all chapters.
6. Sonnet chapter builders, **2** in parallel (each re-reads the docs, so fewer agents = fewer tokens). Reuse `runtime/lf/` (lf-kit.js, build.js template — edit its CH map, gate.py, stitch.py, sfxmerge.py); never rebuild the kit. Gates: strays.js + measure on a draft render (not 0.5 s snapshots); for chapters with iso/board blocks also `node runtime/iso/seektest.js` + `node runtime/iso/subjectcheck.js`. **Photos must never sit under another board; occlusion is a build failure** (`strays.js` flags `OCCLUDED t=… #id` and exits 1; `LF.photo`/`LF.badge` default to z 50, above stage boards — keep any board z below it). Render each chapter once.
7. `python runtime/lf/sfxmerge.py` → `mix.py --music auto --sfx-rate 0.8 --music-db -21 --mood <...>` → `python runtime/lf/stitch.py` → append the outro: `node runtime/lf_outro.js <theme> outro.mp4` + concat (like/subscribe, no end-screen cards yet).
8. Thumbnail via the `thumbnail` skill (3 variants, no AI, pick by mobile squint test) and description (chapters with timestamps, sources, image + music credits).
9. Shorts series: `node runtime/shorts/shorts.js <dir>` → `shorts/part-NN.mp4` (1080x1920, film centred, PART n header, 'PART n+1 →' teaser, −14 LUFS) + `shorts/parts.md`. The script marks the part breaks (longform-writer §4).

## 7. Never

- Commit `.env`, `out/`, audio, `control-panel/data`. Print API keys (`scripting-pipeline/.env`).
- Scrape Google Images; use Pexels/Pixabay stock visuals.
- Publish or upload anything — the user posts.
- Download files other than CC-BY music from incompetech (approved) without asking.
