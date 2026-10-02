---
name: make-video
description: Make one item for the weekly content plan — a reel (9:16), its carousel (1080x1350 slides) or an 8-min long-form (16:9) — authored per topic in the poster-monochrome style with the runtime kit. Use when the user gives a topic and says reel / carousel / long-form / "make a video".
---

# make-video: runtime-authored reels, carousels and long-form

Every video is authored for its topic: research → script → voice → brief → bespoke HyperFrames composition → one render.
There is no template pipeline and no Gemini script or research (`orchestrator/`, `control-panel/` are the retired pipeline — do not use them).
Project root: `C:\Repos\HFPipleine`. Work dir per item: `out/reels/<slug>/` or `out/longform/<slug>/`.

## 0. Token rules (most important — the user is on Claude Pro, the 5-hour window is the limit)

- One fresh session per item. Do not read old chat history; this file + the docs it names are the whole context.
- Opus (you) does: research, script, brief, final review. A **Sonnet** subagent (`model: "sonnet"`) does building, checks, render, metrics, mix.
- Read docs on demand, only the sections you need. Never print big files; never re-read a whole file you just edited; tail logs.
- `npx --yes hyperframes@0.8.46 snapshot` for checks; ONE full render; at most one fix render.
- Look at ONE contact sheet per item (6–9 frames). Never watch whole videos frame by frame.
- Use library components/maps/puppet instead of hand-writing their markup. Bespoke per-topic visuals are still expected (see §3).
- Long renders/voice runs: `run_in_background: true`.

## 1. Kit (read the doc, not the source)

| What | File | Doc |
|---|---|---|
| Theme (8 hues, rotated per video) | `runtime/theme.js` → `node -e "console.log(JSON.stringify(require('./runtime/theme').next('<slug>')))"` | header comment |
| Motion verbs | `runtime/verbs.js` (drop rise whip pop slam out pulse shake hl draw odo scramble type ring click burst cam glitch halftone captions, `V.sfx`) | source header |
| Components (23, 9:16 + 16:9) | `runtime/components.js` + `components.css` | `runtime/COMPONENTS.md` |
| Puppet (bust + full body) | `runtime/puppet.js` | `video-engine/assets/mascot/puppet/README.md` |
| Poster maps | `runtime/maps.js`, `runtime/geo/geo.js` | `runtime/MAPS.md` |
| Reel endcard (vloombox) | `runtime/endcard.js`, `runtime/append_endcard.py` | — |
| Carousel | `runtime/carousel.js`, `carousel_export.js` | `runtime/CAROUSEL.md` |
| Photoreal images (long-form) | `node runtime/images.js <dir> <slots.json>` → `media.json` | header comment |
| Voice (local F5 "narrator" clone) | `python runtime/voice.py <dir> [--speed --gap]` → `vo/voice.wav`, `words.json` | — |
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

## 4. REEL (45–55 s) — target ≤ 0.8 of a 5-hour window

1. **Research** (Opus): 3–6 web searches. Save `research.md` (facts + source URLs). No Gemini.
2. **Script** (Opus): 150–170 words, `script.txt` one line per scene (8–11 lines). Hook in line 1 (≤ 8 words), concrete numbers, a twist, payoff line. No endcard text (it is appended).
3. **Voice**: `python runtime/voice.py out/reels/<slug> --speed 1.12 --gap 0.10`, then `python runtime/append_endcard.py out/reels/<slug>` (ALWAYS for reels).
4. **Brief** (Opus, ~1 page, `BRIEF.md`): theme id, beat table (line → time range → main visual → secondary → character pose → sfx), which real-site captures are needed (public pages: headless Chrome capture; logged-in apps: rebuild in HTML).
5. **Build** (Sonnet subagent, give it this file's §0–§3 + BRIEF.md path + `out/reels/llm-built/` as example): reel.html using components/puppet(bust)/verbs/captions + `Endcard.build`; grammar: 2.5–3.5 events/s, entrances 4–8 frames, exits 2–4 frames, content holds ≤ 1.0 s, captions word-synced. No fake "floater" motion to game metrics. check → snapshot → ONE render → `measure.py` (honest numbers) → sfxdump → `mix.py --music auto` → mux → contact sheet.
   **Hard gates (builder must pass BEFORE the full render, not just report):**
   - Size: content zone y 330–1180 (puppet box lower-right and caption band excluded). Main visual 860–960 px wide; numbers 90–160 px; body text ≥ 34 px. Component defaults are catalogue-sized — always pass big w/h.
   - Never empty: something in the content zone from t=0.15 s and on every line, including the last one.
   - Pre-render motion check: render a low-res draft (or snapshots every 0.5 s) and run `measure.py`. Need moving ≥ 78%, content ≥ 68%, no still > 1.0 s. Fix the listed still gaps with real sub-beats (3–4 per line, keyed to words), then render.
   - Stray gate: `node runtime/strays.js <compDir>` must print "no strays" (it finds small parked dots/blocks visible before their entrance, e.g. burst bits). Never create an element visible and animate it later — create hidden, reveal at its time. Intentional tiny decorations get `data-deco`.
   - No idle wobble/bobbing or tickers just to pass the motion gate: fill gaps with real story beats.
   - Look at your own final contact sheet before reporting.
6. **Review** (Opus): one contact sheet + metrics. Fix once if needed.
7. Deliver: mp4 path, description with music credit from `credits.txt` (CC BY), hashtags.

## 5. CAROUSEL (6–7 slides, same topic as the reel, posted the day before) — ≤ 0.3 window

Reuse the reel's `research.md` (no new research). No character. Highly informative static slides: cover (hook), 4–5 dense content slides (numbers, comparisons, steps, mini charts), CTA slide (follow + vloombox.in).
Same theme hue as the reel. Write `carousel/slides.json` per `runtime/CAROUSEL.md` → `node runtime/carousel.js` → `node runtime/carousel_export.js <dir> --sheet`. Fix any text-size/overflow warnings. Deliver PNGs + caption text.

## 6. LONG-FORM (8 min, 16:9) — 2–3 windows; split across sessions per chapter if needed

Rules: NO opening montage, NO captions, FULL-BODY puppet animated throughout (walk, step, lean, point at screen, present, jump, sit, mouth, hands — never parked), slower narration (`--speed 1.0 --gap 0.35`, ~145–150 wpm) but motion equally dense (something moves every second; holds ≤ 2–3 s with micro-motion).
Images: photoreal ONLY via `runtime/images.js` (licensed real photo first; fal photoreal generic scenes as fallback; grain filter when `grain:true`; never illustrations; never AI-generate real people, logos or real events). Credit every licensed photo in the description. Maps via `runtime/maps.js` — make them the hero shots.

1. Research (Opus): 15–20 searches → `facts.json` (claim, number, source URL). Cached; never redo.
2. Script (Opus): ~1,150 words, 5–6 chapters, conversational. `script.txt` one line per beat; mark chapters with `# Chapter title` lines (strip before voice).
3. Voice: `voice.py --speed 1.0 --gap 0.35`. No endcard.
4. Brief per chapter: beat table + image slots (`slots.json`) + map moves + puppet blocking (where he walks/stands relative to the visual).
5. `node runtime/images.js <dir> slots.json` once for all chapters.
6. Sonnet chapter builders, 2–3 in parallel, one `chNN.html` each, render each chapter once.
7. Stitch chapters (ffmpeg concat), `mix.py --music auto --mood <...>` (music changes per chapter), master −14 LUFS.
8. Thumbnail (poster style, character + one bold claim + one photo) and description (chapters with timestamps, sources, image + music credits).

## 7. Never

- Commit `.env`, `out/`, audio, `control-panel/data`. Print API keys (`scripting-pipeline/.env`).
- Scrape Google Images; use Pexels/Pixabay stock visuals.
- Publish or upload anything — the user posts.
- Download files other than CC-BY music from incompetech (approved) without asking.
