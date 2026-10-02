# Runtime-authored videos: plan

Status: PLAN, awaiting the user's go-ahead. Written 2026-10-01.

**Decision.** The template/UI pipeline (control panel, Gemini storyboards) is retired for production. Every reel and long-form video is authored in a Claude session from the user's topic: research, script, motion and edit. No Gemini for research or writing.

Reference study: `analysis/runtime-reels/REFERENCE-STUDY.md`. It is the single source of truth for the target grammar, so the reference reels are never re-watched.

## 1. Quality bar (from the study; measured, not guessed)

| Metric | Target | Our template pipeline today |
|---|---|---|
| Frames with motion | ≥ 98% | cards enter, then hold for seconds |
| Longest static hold (content) | ≤ 1.0 s, typically 0.1–0.3 s | 2–6 s |
| Visual events, excluding captions | 2.5–3.5 per s | about 0.5–1 per s |
| Elements moving at once | median 4–6, bursts of 15–40 about every 10 s | 1–2 |
| Entrance / exit | 4–8 frames / 2–4 frames | 11 / 7–10 frames |
| Speech | 3.5–3.8 words/s (4.6–5.1 syllables/s) | ok (pace solver) |
| SFX | 1–1.5 per s over a 100–136 BPM bed | sparse |
| Hard cuts | 0–4 per video, only at theme swaps, dressed with a 3–10 frame effect | template scene cuts |
| Captions | word-by-word, top-left, blur-to-ink in 3 frames, 1–2 accent words per line | pill at the bottom |

**Grammar:**
- One visual change per spoken key word.
- Cards morph into the next card.
- A persistent prop changes state as the story moves.
- Section changes are theme swaps.
- The presenter changes pose every 1–2 s and points at the active element.
- No overlapping elements.

We copy the grammar, not the creator's character, branding or assets.

## 2. Why this can't be templates, and why it still must not cost a fortune

Each reel's visuals come from its own script, so the layout and choreography are written per video. Writing raw GSAP and CSS for 150+ events per reel would burn tens of thousands of output tokens per video. The fix is to separate:

- **Motion verbs (reusable code, written once).** How something moves: `slam`, `whipIn`, `dropTilt`, `morphTo`, `countRoll`, `highlightSweep`, `drawCircle`, `cursorClick`, `typeOn`, `stickerPop`, `burst`, `themeSwap(halftone|glitch|blurWipe|squash)`, `cameraDrift`, the caption engine, `presenterPose`, and `sfx`.
- **The look kit (reusable).** Dot-grid and gradient-blob backgrounds, halftone shadows, the card and app-screen chrome, the header counter, the accent palette and type scale.
- **The authored part (per video).** What is on screen and when. This is written as a compact shot script, about one line per event, which a small compiler turns into the HyperFrames HTML and GSAP timeline.

So each video is fully bespoke in content and choreography (no fixed scene templates), while the expensive boilerplate is never rewritten.

Example of the shot script, about 1 line per event:

```
@3.20  card#db  dropTilt from=top  html="<db-stack rows=3>"   sfx=whoosh
@3.55  word "database"  accent
@3.62  #db .row2  highlightSweep color=accent                  sfx=tick
@3.90  cam  push 1.06 over=1.2
@4.10  #db  morphTo #tools   html="<tool-list items='execute_sql,apply_migration'>"
```

## 3. Per-video workflow (one Claude session, user gives the topic)

| Step | What happens | Model and tokens (reel, ~45 s) |
|---|---|---|
| 1. Research | WebSearch/WebFetch: 3–6 searches for a reel, about 15–25 for long-form. Write `facts.json` with sources; numbers only from sources. | main model, ~10–15k |
| 2. Script | Written in the reference voice (hook in 3 s, ~12-word sentences, analogy and example, "comment WORD" ending), with the word budget for the target length | main model, ~3–5k |
| 3. Voice | Local cloned F5-TTS (free), word timings from our aligner | 0 LLM tokens |
| 4. Shot script | Events placed on the word timings, using the verbs and look kit; new SVG/HTML props only when needed | main model, ~12–20k |
| 5. Compile and render | Compiler, then HyperFrames render with SFX auto-placed from the events, the music bed and a −14 LUFS master | 0 |
| 6. Automatic QA | Motion-density gate (frame-diff: no static content run over 1.0 s), overlap/occlusion check (hyperframes check), caption sync, loudness | 0 |
| 7. Look once | One small contact sheet (about 30 frames); fix only the flagged events; re-render only the changed scene segment | ~5–8k |
| **Total** | | **≈ 35–50k tokens per reel** |

Long-form (8–12 min) uses the same flow. Each chapter's shot script is written by a cheaper subagent (Sonnet) from the chapter text plus the verb/kit reference, while the main model does research, script and final review. Expect ≈ 250–400k tokens per 12-min video.

**Honest budget note.** On a Claude Pro weekly limit, a daily reel is realistic. Four hand-authored 12-min videos a week are probably not, on top of everything else. Options:
- 1–2 long-form videos a week;
- a higher plan;
- shorter long-form (6–8 min);
- long-form chapters reusing more of the kit.

The token log below will tell us the real numbers after the first videos.

## 4. Token-optimization rules for every future session (to be encoded in a project skill)

1. Never re-watch references; read `REFERENCE-STUDY.md` (and only the relevant section).
2. Never rewrite motion code; use the verbs. Add a new verb only when no verb fits, and add it to the library.
3. The shot script is terse: no comments, no prose, one line per event.
4. Load images sparingly:
   - one contact sheet per render (≤ 30 thumbnails);
   - full frames only for a flagged event.
5. Re-render only the changed scene segment (chunked render plus stitch).
6. Logs are quiet: tools print one summary line, with details in files.
7. Use subagents only for parallel long-form chapters (Sonnet for mechanical work); never spawn for small steps.
8. Research results are cached per topic (`research/<slug>/facts.json`), so retries never re-search.
9. Every video writes `tokens.json` (rough per-step estimate), so the budget keeps getting tuned.

## 5. Build plan (one-time, before the first production reel)

| # | Build | Notes |
|---|---|---|
| B1 | **Verb library**: `motion/verbs.js`, seek-safe GSAP | Covers every motion the study lists, with timing defaults from the study (4–8 frame entrances, 2–4 frame exits, tilt-and-straighten, 1.35→1.0 slam with RGB split) |
| B2 | **Caption engine** | Word-by-word, blur-to-ink in 3 frames, accent words, phrase clearing, top-left layout |
| B3 | **Look kit**: backgrounds, card/app-screen chrome, halftone, stickers, header counter, palette and type | Our own look (white or cream plus dark theme swaps) |
| B4 | **Presenter pose set** from our "guy" | Idle, point-left/right/up, both hands, surprised, thinking, big-centre, plus blink, mouth flap and arm. The pose changes every 1–2 s and is driven by events. |
| B5 | **Shot-script compiler**: script, word timings and HyperFrames composition | With the theme-swap transitions and camera drift built in |
| B6 | **SFX and music kit** | Free/procedural pops, whooshes, clicks, slams, typing and dings, plus beds from the free music library (YouTube Audio Library/Pixabay Music, user-downloaded). The mixer auto-places SFX from the event verbs at 1–1.5 per s. |
| B7 | **QA gates** | Motion density (no static run over 1 s), overlap/occlusion, caption sync, loudness, then a contact sheet |
| B8 | **Project skill** `.claude/skills/make-video/SKILL.md` | The step-by-step workflow, the rules in §4 and the commands. It loads only when invoked, so it costs nothing otherwise. |
| B9 | **Calibration** | Hand-author one 30–45 s pilot reel on a topic the user picks. Compare its motion-density numbers with the references, tune the verbs, and record the real token cost. |

- **Reuse:** the voice worker and aligner, the HyperFrames renderer, the audio master, the music library indexer, the Natural Earth maps, and the fal image helper (fal only for photoreal stills in long-form).
- **Retired:** the template catalog, Gemini storyboards and the control-panel flow. The code stays in git but isn't used.

Estimated one-time build: one focused session (B1–B8 by background agents), then B9 with the user.
