# Plan: 16:9 finance explainer videos on the v3 engine (images + motion)

Status: plan only (2026-09-25). Nothing here is built yet. Numbers marked **[measure]** must come
from a reference audit (step 0) before they become gates. That is the same rule the v3 shorts followed.

## 0. What carries over unchanged, and what doesn't

| Keep as is (proven on the 9:16 shorts) | Why it transfers |
|---|---|
| Stage renderer: scaffolds -> modules at rects -> word-anchored events (`core.js`) | Resolution-agnostic. Modules lay out relative to their rect |
| Seek-safe GSAP rules, measured motion recipes (fade 133 ms, rise, settle, slam, draw) | Motion grammar is the brand. Re-measured, not replaced |
| Gemini storyboard generator with real-compiler validation + repair loop | Same contract, new catalog/grammar |
| Voice: F5-TTS worker with the cloned `narrator` profile, WhisperX word timings, atempo before render | Same, at a slower wpm |
| SFX synth + cue map (`sfx.js`, `sfx_mix.py`) | Same, lower density |
| Mastering to -14 LUFS / TP <= -1 (YouTube's normalization target) | Same |
| Hard gates + layout audit (`v3_gates.py`, `layout_audit.js`) with auto-repair | Extended (section 7) |
| Control panel one-click -> `make-video.js` | New format switch |

What is new: **landscape frame**, **long-form structure (8-15 min, chapters)**, **a real-image
asset class (fetch -> vet -> license -> crop/grade -> render)**, **data-driven finance charts**,
**fact/number verification**, and **a YouTube publishing package**.

---

## 1. Step 0: reference audit (before any code)

The same method as the R1-R5 shorts (`analysis/pacing-audit-20260924/design/R*/AUDIT.md`), on 3-5 finance
reference videos **you pick** (e.g. channels in the "Economics Explained / Patrick Boyle / How Money
Works / Wendover-style" space; the choice sets the look).

Measure per reference (existing `watch` tooling + ffmpeg + frame crops at 1920x1080):
- Pacing: beats/min, shot length distribution, longest hold, scene life. Hook (0-30 s) is measured separately. **[measure]**
- Voice: wpm (finance long-form is usually ~150-175, against 212 for our shorts), pauses at chapter breaks. **[measure]**
- Visual mix: % of time on photo/B-roll, motion graphics, charts, text cards and the presenter. **[measure]**
- Image treatment: full-bleed vs framed, grade (desaturated, duotone, film grain), Ken Burns speed (px/s, scale %/s), cut vs dissolve. **[measure]**
- Chart grammar: types used, draw-on durations, annotation style, number formats ($1.2T, 4.5%, bps). **[measure]**
- Typography: families, sizes at 1080p, lower-third geometry, caption presence (long-form usually has none burned in; it uses YouTube CC). **[measure]**
- Audio: LUFS, music bed level under voice (in dB), SFX density. **[measure]**
- YouTube chrome: end-screen zone use (last 5-20 s), chapter count/length, thumbnail style.

Output: `analysis/finance-audit/SPEC.md` and a new profile, e.g. **FN** (or FN-light / FN-dark if the refs split like DH/LC/DC).

## 2. Frame and format: 9:16 -> 16:9

Code that assumes 1080x1920 today (measured by grep): `composeStage.js` (10 places), `v3_gates.py` (5), `modules-dh.js` (4),
`layout_audit.js` (4), `stage.html` (3), `core.js`/`modules-dh2.js`/`templates-dh.js` (1 each). The rest is rect-relative.

Changes:
1. **`spec.frame = {w:1920, h:1080}`** travels storyboard -> compile -> stage -> audit -> gates. Default 1080x1920 keeps the shorts identical (regression check: DH render diff = 0, as before).
2. `composeStage.js`: `data-resolution="landscape"`, root/stage sizes from `frame`. Captions become optional (off by default for long-form; export SRT instead).
3. `stage.html`: width/height come from a variable, not the literal 1080/1920.
4. **Safe areas** (new constants, enforced by the layout audit):
   - title-safe 96 px left/right, 54 px top/bottom;
   - YouTube progress-bar zone: bottom 10% during playback UI, so no critical text there;
   - end-screen zone: in the last 20 s, the right 45% and bottom 30% stay free.
5. Mascot: optional in finance (decide after the audit). If kept, bottom-left 16:9 slot [48, 640, 300, 440].
6. Profiles: new `profile-fn.js` (palette tokens, background, chrome: chapter header + progress + source line) and `templates-fn.js`.

### 16:9 templates (`templates-fn.js`), all on a 12-column grid (1920 wide, 96 margins, 24 gutter)
- `fullImage`: full-bleed photo, Ken Burns, lower-third title/kicker.
- `split`: image 7 cols + card/chart 5 cols (or mirrored).
- `chartHero`: one chart at 10-12 cols, title + source line.
- `numberHero`: a big figure ($4.2T / 38%) + context line + small spark chart.
- `compare`: 2-3 columns (company vs company, then vs now).
- `timeline`: horizontal era timeline with image thumbnails.
- `mapScene`: world or country map with pins / choropleth.
- `quote`: a pull quote with portrait and attribution.
- `newsCard`: a rebuilt headline card (publisher name, date, headline text). It is not a screenshot (section 4.5).
- `chapterCard`: chapter number + title + background image (the DC chaptered grammar carries over).
- `stack` / `hero` / `opener`: the existing generic templates, re-gridded.

## 3. Long-form structure (8-15 min)

A single 45 s storyboard does not scale to 12 minutes (Gemini output limits, validation cost, render memory).

1. **Outline pass** (Gemini): topic -> thesis, 5-9 chapters (title, goal, key facts needed, 60-120 s each), and a hook.
2. **Research pass** per chapter: collect facts + numbers **with sources** (section 5); unsourced numbers are dropped.
3. **Chapter storyboard pass**: each chapter is its own storyboard.v3 (same validator/repair loop, FN grammar),
   with `chapterIndex`, carry-over entities (recurring company logos, the running chart) and asset slots.
4. **Stitch**: the chapter timelines are concatenated. Compile runs per chapter, and the render per chapter runs in parallel, then an ffmpeg concat (stream copy)
   joins the chapters. Mastering happens once on the joined file. Chapter boundaries get a `chapterCard` + transition.
5. **Caching**: voice per sentence (already), assets per query hash, renders per chapter hash, so a fix to chapter 4 re-renders only chapter 4.
6. Storyboard schema additions: `format: "long16x9"`, `chapters[]`, `assets[]` (slots), `sources[]`, per-number `ref`.

## 4. The new asset class: images

### 4.1 Asset kinds and where each comes from

| Kind | Primary sources | Licence handling |
|---|---|---|
| Stock photo (places, objects, generic people, industries) | Pexels API, Unsplash API, Pixabay API | Pexels and Pixabay: free, no attribution required. Unsplash: API guidelines require attribution + download-endpoint ping |
| Real places / buildings / historical events | Wikimedia Commons API | Per-file licence (PD / CC0 / CC BY / CC BY-SA). Store author + licence and credit them |
| Public figures (CEOs, central bankers, politicians) | Wikimedia Commons only (CC/PD portraits) | Credit required. Never agency photos (Getty/Reuters/AP) |
| Company logos | Wikimedia (SVG), simple-icons, Brandfetch API | Nominative/editorial use only, never altered; store source |
| Product images | Wikimedia, press kits (manual whitelist) | Same as logos |
| Maps | Natural Earth (PD) + our own SVG renderer | Public domain |
| Charts / data | **Never fetched as images**: rendered by us from data (section 5) | Data source credited on screen |
| Conceptual illustrations ("inflation eating savings") | Gemini/Imagen image generation | Allowed only for concepts, **never** to depict real people/events; flagged `ai:true` |
| Icons | existing `lib/icons.js` + Lucide/Tabler (MIT) | Already bundled style |
| Textures / backgrounds | generated (noise, gradients, paper) | Ours |

`media-use` (installed skill) already resolves images/icons/logos into frozen local files with a ledger. Evaluate it first and
wrap it rather than rebuilding, if its providers and licence records meet section 4.3.

### 4.2 Resolve pipeline (per asset slot, no human step)
1. **Slot** in the storyboard: `{id, kind, intent: "Federal Reserve building exterior", mood, must:[...], avoid:[...], aspect: "16:9"|"4:5"|"1:1", focal?: "face"|"center", minPx: 1920}`.
2. **Query expansion** (Gemini): 3-5 search queries per slot, plus negative terms.
3. **Search** the providers for the slot's kind (parallel, rate-limited, cached by query hash). Keep 10-20 candidates.
4. **Automatic vetting** (hard filters, then a score):
   - resolution >= slot need (no more than 1.5x upscale), aspect croppable without cutting the focal region;
   - no watermark / baked-in text (Gemini vision yes/no + OCR text-area ratio);
   - relevance: Gemini vision scores image vs intent (0-1) and flags wrong country/era/brand;
   - brand safety: no NSFW, no violence, no competitor logos where irrelevant, no recognisable private individuals;
   - duplicates: a perceptual hash (pHash) must not match any asset already in this video (and the last N videos, for channel freshness);
   - style fit: luminance/colour distance to the profile palette after grading.
5. **Pick** the top score; record the runner-ups for auto-repair (if a later gate rejects the pick, the next candidate is used without re-searching).
6. **Download + freeze**: to `video-engine/assets/fetched/<sha256>.<ext>` (content-addressed); the render never touches the network.
7. **Process** (deterministic, cached):
   - smart crop to the slot aspect around the focal box (face detection / Gemini bbox; heads never cut);
   - grade to the profile look (e.g. desaturate 30%, duotone toward palette shadows, grain) for a consistent channel look;
   - optional cut-out (background removal via `hyperframes remove-background` / rembg) for `cutout` modules;
   - resize to exact render size (+10% for Ken Burns headroom), encode webp/jpg q85.

### 4.3 Asset manifest (one JSON per video, the licence gate reads it)
```json
{ "id": "fed-building", "kind": "photo", "slot": "ch2.s4", "source": "wikimedia", "pageUrl": "...", "fileUrl": "...",
  "license": "CC BY-SA 4.0", "author": "...", "attribution": "Photo: X / Wikimedia Commons, CC BY-SA 4.0",
  "sha256": "...", "local": "assets/fetched/ab12....webp", "w": 2400, "h": 1350, "focal": [1180, 420, 380, 460],
  "phash": "...", "scores": {"relevance": 0.86, "watermark": 0, "style": 0.71}, "ai": false, "fetchedAt": "2026-..." }
```
The description credits are generated from this file automatically.

### 4.4 Image render modules (new, in `lib/stage/modules-img.js`, all seek-safe)
- `photo`: full-bleed or framed image. **Ken Burns** is a single tween over the scaffold life (scale 1.00 -> 1.06, drift toward the focal point); rates come from **[measure]**.
- `photoCard`: framed image + caption + source line (R-style card shadow per profile).
- `cutout`: bg-removed subject slides/rises in over a coloured plate.
- `collage`: 2-4 images, word-anchored stagger in, then one gets highlighted (others dim).
- `portrait`: circular/rounded portrait + name/title lower-third.
- `logoRow` / `logoVs`: logos on neutral chips (never recoloured), then "vs" and compare ops.
- `newsCard`: HTML-rebuilt headline (publisher name + date + headline text we paraphrase or quote briefly), with no copied layouts/screenshots.
- `imageMask`: big text knocked out of a photo (hero word).
- `mapScene`: SVG map with `pin`, `fill`, `arc` ops (trade flows, country comparisons).
- Ops: `kenBurns`, `focus` (zoom to a region of the image), `reveal` (wipe), `dim`, `highlightRegion` (box/circle over a detail), `swap` (crossfade to the next image).
- **Loading determinism**: all images are local; the stage waits on `img.decode()` before registering the timeline; `hyperframes check` must pass with no network.

### 4.5 Copyright rules (hard, encoded in the vetting + gates)
- No screenshots of news sites, no agency/editorial photos, no stills from other YouTube videos or films.
- Logos: unaltered, used only when the company is discussed.
- Real people: only CC/PD portraits with attribution. AI images never depict real people or real events as real.
- Every fetched asset has a licence record, or the video fails the licence gate.

## 5. Finance data and charts (the core visual for this niche)

### 5.1 Data sources (all fetched at research time and frozen with the video)
- Macro: FRED API (rates, CPI, GDP, M2, unemployment), World Bank, IMF, BLS, ECB.
- Markets: a market-data API with licence to display (Alpha Vantage / Polygon / Twelve Data; yfinance is unofficial, so treat it as a risk).
- Companies: SEC EDGAR XBRL (revenue, income, cash flow, shares), plus investor-relations PDFs (manual whitelist).
- Every series is stored as `data/<video>/<seriesId>.json` with {source, url, retrievedAt, units, frequency}.

### 5.2 Number discipline
- The script may only speak numbers that exist in the frozen data or in a cited source. The validator checks every numeral/word-number in the narration against `sources[]` (with rounding tolerance).
- On-screen numbers come from the same data objects, so voice and screen cannot disagree.
- Formatting rules: $1.2T / 4.5% / 25 bps / YoY. A pronunciation lexicon for the voice ("S&P 500", "bps" -> "basis points", tickers -> company names, "10-K").

### 5.3 Chart modules (`modules-chart.js`), each with word-anchored ops
- `lineChart`: `drawTo(date)`, `markPoint`, `annotate(text, at)`, `band(recession shading)`, `compareSeries`.
- `candles` (OHLC) with `drawTo`, `highlightRange`.
- `barCompare` / `barRace` (ranking over years, seek-safe keyframes per year).
- `stackedArea` (composition over time), `donut` (allocation) with `explode(slice)`.
- `waterfall` (revenue -> profit), `yieldCurve` (invert animation), `growthCurve` (compound interest calculator with `setRate`, `setYears`).
- `tickerTape` / `kpis` (existing, re-skinned), `counter` (existing count op, if the audit shows finance refs count up).
- Draw-on durations/eases from **[measure]**; the axis and label fit use `HFTextFit`, and the layout audit covers them.

## 6. Motion for 16:9

- Keep the measured recipes (fade/rise/settle/slam/draw/strike) as the default grammar; re-measure against the finance refs and add profile overrides like `PROFILE_RECIPES.LC`.
- **Camera layer** (new, common in documentary finance): a slow push-in/pan on the whole stage per scaffold, plus a "zoom into chart region" op. Built with the `hyperframes-keyframes` rules (seek-safe, one tween per scaffold).
- Transitions: hard cuts inside chapters (like the refs); a chapter-card transition between chapters; image `swap` crossfades only when the audit shows them.
- Cadence: long-form beats/min will be lower than the shorts (hook denser). The bands come from **[measure]**, not from the 9:16 values.

## 7. Gates (hard, with auto-repair where possible)

Existing (re-banded for FN): beats/min, longest hold, scene life, wpm, LUFS / LRA / TP, frame geometry, layout audit, renderer build errors.

New:
| Gate | Rule | Repair |
|---|---|---|
| Licence | every asset has licence + attribution (or `ours`) | swap to the runner-up candidate |
| Resolution | no asset upscaled > 1.5x at render size | runner-up / re-search |
| Watermark / text-in-image | vision check = 0 | runner-up |
| Duplicate | no pHash repeats within the video; none from the last N videos | runner-up |
| Face crop | a detected face never cut by the frame or crop | re-crop |
| Numbers | every spoken/on-screen number matches `sources[]` | regenerate the sentence |
| Disclaimer | "not financial advice" card + description line present | insert |
| Safe areas | nothing critical in the progress-bar zone; end-screen zone clear for the last 20 s | re-layout |
| Image on-screen time | each image >= 1.5 s and <= **[measure]** | re-cadence |
| Chapter timing | chapters within 45-150 s; YouTube chapter rules (first at 0:00, >= 3 chapters, each >= 10 s) | re-split |

## 8. Audio for long-form
- Voice: cloned `narrator` (now the default), ~160 wpm **[measure]**, chapter pauses 0.6-0.9 s **[measure]**.
- Music bed: recommended for long-form (12 minutes of voice + SFX only tires the ear). The source must be licence-safe: YouTube Audio Library tracks (manually vetted list) or generated music; duck -18 dB under voice, and swell at chapter cards. **Your decision** (the shorts decision was "no bed").
- SFX: the same synthesized library, with lower density (no tick on every row); add `camera` whoosh-lite and chart-draw swish.

## 9. Output package
- `video.mp4` 1920x1080 30 fps (4K optional later; render time x4).
- `captions.srt` from WhisperX words (uploaded, not burned in).
- `description.md`: summary, **chapter timestamps** (from the stitched timeline), sources, image credits (from the manifest), disclaimer.
- `thumbnail.png`: via the `video-thumbnail` skill (16:9), 2-3 variants.
- `metadata.json`: title options, tags, category. No auto-publish unless you ask for it.

## 10. Control panel
- Format: `Short 9:16` / `Long 16:9`. Length 8-15 min. Profile (FN variants). Toggles: music bed, AI illustrations allowed, mascot.
- A progress view per chapter (research -> storyboard -> voice -> assets -> render), since a long run takes a while.
- Optional "review assets" page (swap an image before render). The default stays fully automatic.

## 11. Performance estimate (to verify)
- Today: 45 s short in ~6 min end to end on this machine. Render dominates and scales ~linearly with seconds x pixels.
- 12 min at 1920x1080 (same pixel count as 1080x1920): ~16x the short, so ~60-90 min serial; **chapter-parallel render** (2-4 workers, RAM permitting) and per-chapter caching bring re-runs down to minutes.
- Asset resolve: ~40-80 images x (search + vision vetting) ~ 5-10 min with parallelism and caching. Gemini vision cost is per candidate, so cap it at 6 vetted candidates per slot.

## 12. Phased roadmap (each phase ends with a real render + gates, as for v3)

1. **P0: Audit** (you pick 3-5 refs), then `finance-audit/SPEC.md`, FN profile numbers, decisions list.
2. **P1: Frame abstraction**: `spec.frame`, 16:9 compose/stage/audit/gates; the shorts stay pixel-identical (diff 0).
3. **P2: FN profile + 16:9 templates** with existing cards (no images yet); a 60 s landscape pilot.
4. **P3: Chart modules + data layer** (FRED/EDGAR), plus the number-discipline validator; a pilot on "Why the yield curve inverted".
5. **P4: Asset pipeline**: resolve -> vet -> manifest -> process; image modules; licence/duplicate/watermark gates.
6. **P5: Long-form orchestration**: outline -> research -> chapter storyboards -> parallel render -> stitch; chapter cards; music bed decision.
7. **P6: Package + control panel**: SRT, description with chapters/credits, thumbnail, format switch.
8. **P7: Hardening**: 5 topics end to end with no human step, all gates green, and timing/cost report.

## 13. Decisions needed from you
1. Reference channels/videos for the finance look (3-5).
2. Music bed for long-form: yes/no, and the source (YouTube Audio Library list vs generated).
3. AI-generated illustrations: allowed for concepts? (never real people/events).
4. Mascot in 16:9 finance: keep / drop / replace.
5. Paid APIs: a market-data provider with a display licence (budget), and Brandfetch for logos.
6. Target length (8, 10, 12 or 15 min) and upload cadence (it sets the caching and runtime priorities).

## 14. Risks
- **Copyright/brand**: the biggest risk with fetched images; mitigated by source whitelist, licence gate, no screenshots.
- **Accuracy/compliance**: finance errors damage the channel. Mitigated by the number gate, frozen sources and the disclaimer.
- **Data API terms**: unofficial scrapers (yfinance) can break or violate terms, so prefer licensed APIs.
- **Runtime**: long renders; mitigated by chapter-parallel render and caching.
- **Model drift**: Gemini output variance is higher over 12 minutes than over 45 s; chapter-level validation + repair contains it.
