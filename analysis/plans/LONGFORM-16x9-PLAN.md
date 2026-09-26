# Plan: 16:9 long-form finance deep-dives ("LF")

Status: approved to build, 2026-09-26. This supersedes `FINANCE-16x9-PLAN.md` where they differ.
The earlier plan stays the background for data and number discipline.

## 0. Brief (from the user)

- **Format:** YouTube 16:9, 8–12 min, with a bigger script split into chapters.
- **Topics:** deep-research business, economics and geo-finance stories. Examples:
  - "Amul's business model"
  - "Why Kingfisher went bankrupt"
  - "Europe's financial burden"
  - "How Pakistan fell into a debt trap"
  - "How to research commodities before investing"
- **Look:** the same design language as the 9:16 shorts, always on a white/paper background. Adds real images and video, plus motion graphics.
- **Media scope:** images and video appear **only** in 16:9 long-form. The 9:16 tech shorts keep motion graphics only; the promo media window is already off by default.
- **Tone:**
  - very engaging and comedic;
  - explained through examples;
  - very simple, easy-to-understand language;
  - a relaxed narration feel, with the same flow of animation.
- **Presenter:** none in 16:9.
- **Media sources:** no stock libraries (Pexels/Pixabay are excluded by the user). Scraping Google Images is not used, for copyright and terms-of-service reasons.
- **Music:** the soft synthesized bed is on by default.

## 1. Architecture (new pieces in bold)

```
topic
 -> **research.js**    Gemini + Google Search grounding -> dossier.json (facts with sources, numbers, entities, timeline, data asks)
 -> **outline.js**     chapters (6-8) + cold open + recap, each with its beats, examples, jokes, numbers (from the dossier only)
 -> **script**         per chapter: sentences (relaxed, simple, comedic, example-led); number gate against the dossier
 -> **storyboardLF.js** per chapter: storyboard.v3 at frame 1920x1080, profile "LF", catalog incl. media + chart + map cards;
                      media slots carry INTENTS (never URLs); validate + compile on synthetic timing + layout audit (16:9)
 -> **resolveMedia**   intents -> local files + credits (Wikidata/Commons/Openverse -> vision check -> AI illustration -> graphic fallback)
 -> **data**           chart series (World Bank API; dossier numbers) frozen per video
 -> voice (F5 narrator clone) per chapter, relaxed pace
 -> compile + compose per chapter (existing v3 path, frame-aware) -> render chapters (parallel 2) -> **stitch**
 -> audio: voice + SFX (lower density) + music bed (on) -> master -14 LUFS
 -> gates (LF bands, credits visible, number gate, chapter rules)
 -> **package**: video.mp4, captions.srt, description.md (chapters, sources, image credits, disclaimer), credits.txt, metadata.json
```

Everything that touches the network happens **before** compose. Renders read only local files, which keeps them deterministic and seek-safe. Each video freezes `dossier.json`, `media-manifest.json` and `data.json` beside its storyboards, so a re-render is identical.

## 2. Frame abstraction (foundation, P1)

- `spec.frame = {w, h}` (default `{1080, 1920}`) travels through storyboard -> compile -> composeStage -> stage runtime -> layout audit -> gates. Every literal 1080/1920 becomes frame-aware:
  - composeStage.js
  - stage.html / root composition sizes (`data-width` / `data-height`, `data-resolution`)
  - core.js / modules that hardcode 1080/1920 (`st-content` layer size in modules-dh.js, etc.)
  - layout_audit.js harness viewport
  - v3_gates.py frame probes and geometry checks
- **Regression:** a 9:16 fixture render must be pixel-identical before and after (frame diff = 0 on sampled frames).
- Captions: `captions` stays available, but long-form defaults to **off** and exports an SRT. A later decision may enable a keyword caption style.

## 3. LF profile: design (P2)

- **Canvas and grid:** 1920x1080 at 30 fps. The background is a paper white close to LC (`#F7F6F1` plate, subtle dotted grid at 3% like R6/R7). It is always light.
- **Typography:** Inter / Inter Tight for heads, JetBrains Mono for micro labels and data. Sizes are scaled from the shorts to 1080p landscape:
  - headline 64–84;
  - body 28–34;
  - micro labels 16–18;
  - credit 15 (the minimum readable at 1080p; contrast ≥ 4.5:1).
- **Grid:** 12 columns, 96 px margins, 24 px gutter. Title-safe insets are 96 px left/right and 54 px top/bottom.
- **YouTube safe areas:**
  - no critical text in the bottom 90 px, where the progress bar sits;
  - in the last 20 s, the right 45% and bottom 30% stay clear for the end screen.
- **Chrome** (like BR/BP, adapted):
  - top-left: chapter kicker "CH 3 · THE DEBT SPIRAL";
  - top-right: thin chapter progress (segments = chapters);
  - bottom-left: credit line, shown only when media is on screen.
- **Motion:** the same grammar as the shorts, with the same recipes:
  - fade 133 ms, rise 12 px, settle, draw, highlight, strike, count-up;
  - the R6 transitions between scenes;
  - a slower cadence (section 6).

  New media motion:
  - slow push-in on stills (scale 1.00 -> 1.06 over the hold, linear), with the direction chosen per image from its focal box;
  - parallax on cut-outs (optional, later);
  - photo "drop-in" card with a 3 px paper border and soft shadow;
  - image highlight boxes and callout arrows drawn on the photo (R8-style);
  - the existing shrink/FLIP.
- **No presenter.** The mascot is disabled for frame 16:9.

### Templates (templates-lf.js), all on the 12-column grid
| Template | Layout |
|---|---|
| `lfCold` | cold-open hook: full-bleed photo (or AI illustration) + kinetic headline + kicker |
| `lfSplit` | photo card 7 cols + text/number/chart stack 5 cols (mirrorable) |
| `lfFull` | full-bleed photo/video with lower-third title + credit |
| `lfChart` | one chart 10–12 cols + title + source line |
| `lfNumber` | a big figure (₹9,000 cr / 38%) + context line + small spark/compare |
| `lfCompare` | 2–3 columns (then vs now, company vs company), each optionally with a photo |
| `lfTimeline` | horizontal era timeline with photo thumbnails and word-anchored ticks |
| `lfMap` | country/world map with highlighted regions, pins and arrows (flows of money/goods) |
| `lfHeadline` | a rebuilt news headline card (publisher, date, headline text, typeset by us, never a screenshot) with the key phrase highlighted |
| `lfChapter` | chapter card: number, title, one-line promise, section progress |
| `lfJoke` | comedic beat: AI illustration / meme-like layout (our own art only) + punchline caption |
| `lfRecap` | 3–5 takeaways, checked off one by one |
| `lfEnd` | end screen: subscribe CTA + next-video slots (end-screen-safe zone) |

### New modules (modules-lf.js / modules-chart.js / modules-map.js), all seek-safe
- `photo` (extends `media` kind image):
  - props: fit, focal box, push-in, border, `credit`;
  - ops: highlight box, arrow, zoomTo (focal box), dim, shrink.
- `photoGrid` (2–4 images), `portraitCard` (photo + name + role + years), `logoChip` / `logoRow`.
- `headlineCard` (publisher, date, headline, highlight phrase).
- `lineChart` / `barChart` / `stackBar`:
  - draw on words;
  - annotate a point;
  - axis in plain units ("₹ crore", "% of GDP");
  - the source line is mandatory.
- `bigNumber` (count-up, unit, context), `compareCols`, `eraTimeline` (image ticks).
- `worldMap` / `countryMap`: SVG from Natural Earth (public domain), with highlight, pin, arrow and choropleth ops.
- `chapterCard`, `recapList`, `endScreen`.

## 4. Research and script (P3)

### 4.1 research.js: Gemini with Google Search grounding
Verified 2026-09-26: `tools:[{google_search:{}}]` on `gemini-3.6-flash` returns grounded text + `groundingMetadata` (search queries + source chunks).

1. **Plan** (JSON): 8–12 research questions covering business model, history, turning points, numbers, people, current state, and counter-views.
2. **Research:** one grounded call per question, returning answer text + sources.
3. **Distil:** a JSON-mode call over the grounded answers produces `dossier.json`:
   ```
   { topic, angle, summary,
     facts: [{id, claim, value?, unit?, year?, sources:[{title, url}], confidence}],
     timeline: [{year, event, factIds}],
     entities: [{name, kind: person|company|place|org|product|concept, wikidata?}],
     dataAsks: [{metric, country?, years, worldBankIndicator?}],   // e.g. PAK external debt % GNI
     numbersPolicy: "only facts[].value may be spoken or shown" }
   ```
4. **Caching:** saved beside the output and cached by topic hash. A re-render reuses it.

### 4.2 outline.js
- Cold open (30–45 s): the most surprising fact/tension + promise.
- 6–8 chapters, each with:
  - a question;
  - 1 worked example (a relatable, Indian-context everyday analogy: a chai stall, a family budget, EMI on a phone);
  - a comedic beat;
  - the key facts it uses;
  - the visuals it wants.
- Recap and a closing line (the fixed long-form ending is appended separately).
- Target: 8–12 min at the LF pace, which is about 1,250–1,900 words.

### 4.3 Chapter script rules (prompt + deterministic checks)
- **Simple language:**
  - grade ~7 readability (Flesch-Kincaid ≤ 8 per chapter, checked);
  - sentences ≤ 22 words;
  - any jargon term is followed by a plain explanation in the same or next sentence (checked: a glossary in the dossier).
- **Examples:** every chapter has ≥ 1 concrete example or analogy; abstract claims are followed by "for example/imagine/think of" within 2 sentences (prompted; soft check).
- **Comedy:**
  - light, self-aware asides;
  - absurd-but-true comparisons computed from dossier numbers;
  - a running callback joke across chapters;
  - never mocks real private individuals, tragedy or ethnicity/religion;
  - satire of public institutions and decisions is fine;
  - every 60–90 s has one light beat (prompted).
- **Numbers:** every spoken number must map to `facts[].value` (a number gate with unit/rounding tolerance). Numbers are spelled out for TTS; digits stay on screen.
- **Neutral and fair** on geopolitics (Pakistan, Europe); caveats on contested figures ("by one estimate").
- No investment advice; commodities topics carry an education framing and a "not financial advice" line in the description + a small end card.
- The narration guide from the shorts (`narrativeGuide.js`) applies where it fits: named angle, causal middle, callback ending.

## 5. Media resolver (P4): no stock, no Google scraping

`orchestrator/lib/media/`, run once per video after the storyboards:

- **Input:** media intents from storyboards, e.g.
  `{slot, kind: photo|portrait|logo|video|map|illustration, entity?, intent: "Kingfisher Airbus A320 on the tarmac", mood?, era?}`.
- **Query building:**
  1. Entity-first: Wikidata search -> QID -> P18 image, P154 logo, P41 flag, P242 locator map, P2716 collage, and the Commons category.
  2. Gemini writes 3–5 concrete Commons queries per intent: nouns + place + era, no abstractions.

  Measured on 20 sample queries for the user's example topics: 19/20 returned ≥ 1 openly licensed Commons image ≥ 1280 px.
- **Providers, in order:**
  1. Wikidata/Commons (entity image, then category, then search).
  2. Openverse (CC-licensed index of Flickr/museums/etc.; `license_type=commercial,modification`; **verify** base URL/rate limits).
  3. NASA / public-domain government media (space, earth, US gov). Also public-domain government press photos where the licence is explicit.
  4. Commons video (webm/ogv) for real footage where it exists. Honest caveat: real footage for finance topics is sparse without stock. Motion therefore comes mainly from animating stills + graphics.
  5. **AI illustration** (Gemini image model, as used for the robot presenter):
     - for concepts, analogies and comedic beats;
     - never for real people or real news events, and never presented as a photo;
     - credited "Illustration: AI-generated".
  6. Graphic fallback: the module renders its no-image state (icon/silhouette/typeset card), or the template swaps to a graphic-only variant.
- **Licence gate:**
  - allow Public domain, CC0, CC BY;
  - allow **CC BY-SA** (most Commons photos) with full credit and only crop/scale/grade edits (**decision D1**);
  - reject NC, ND, GFDL-only, unknown, and anything with watermarks.
- **Quality and relevance gate:**
  - size ≥ 1280 px on the long edge for full-bleed, ≥ 800 for cards;
  - no upscale > 1.5x;
  - aspect fit;
  - pHash duplicates rejected within a video;
  - a Gemini vision check with a pass/fail rubric per intent. It checks: does it show the intent, does it have a watermark or heavy text, is it graphic/violent, is it a screenshot of a news site, and where is the focal box. Up to 6 candidates are vetted per slot.
- **Cache:**
  - `video-engine/assets/media/cache/<sha[0:2]>/<sha>.<ext>`;
  - sidecar `<sha>.json` holding source, page url, file url, author, licence, licence url, credit string, fetchedAt, and edits;
  - per-video `media-manifest.json` (slot -> sha, credit, focal box, crop);
  - `credits.txt` for the description.
- **Credit label** (drawn by the stage from the manifest, never by the LLM): `Photo: Author / Wikimedia Commons · CC BY-SA 4.0`, 15 px mono, bottom-left 96/1036, shown while that media is on screen. A gate checks a credit is visible whenever a fetched image is.
- **Politeness:** a descriptive User-Agent with contact, ≤ 5 req/s, exponential backoff, and cached API responses (24 h).

## 6. Pace, audio, cadence (P5)

- **Voice:** the F5 `narrator` clone, relaxed.

  Target 4.9 syl/s against the shorts' 5.84 (typical documentary delivery is ~150–165 wpm). Gaps:
  - sentence gap 0.35 s;
  - paragraph gap 0.6 s;
  - chapter gap 0.9 s.

  These are tunable in `pace.js` (profile-aware), and will be recalibrated if the user supplies long-form references.
- **Music bed:** on (the lofi/ambient preset), ducked under the voice, swelling +3 dB on chapter cards.
- **SFX:** the same library at lower density: whoosh on scene transitions, soft pop on photo drops, tick on count-ups. No tick on every row.
- **Mix rule (user, 2026-09-26): a dense blend of motion graphics AND media. It is never a slideshow.** Every scene is a motion-graphics layout.
  - Photos and clips appear inside it as one layer: a card in a split, a thumbnail on a timeline, a backdrop behind a big number, a map with pins. Each one gets animated annotations: highlight boxes, arrows, labels, count-ups, callouts.
  - Even `lfFull` carries animated graphics over the photo: a lower third, a callout, a number or a highlight.
  - Graphic-only scenes (charts, numbers, compare, recap) sit between media scenes.
  - Target share of runtime: graphics present **100%**; real media visible about 50–65%; no media-only frame without an animated element within 1.5 s.
- **Cadence bands** (LF, provisional until a reference is measured):
  - a visual change every ≤ 5 s;
  - scene life median 6–10 s;
  - beats/min 18–35;
  - each photo on screen ≥ 2.5 s;
  - a chapter card at each chapter start;
  - ≥ 40% of runtime showing a real photo/illustration;
  - ≥ 25% showing a chart/map/number graphic.

## 7. Long-form orchestration (P6)

- `make-longform.js --topic "..." [--minutes 10] [--out dir]`:
  1. research
  2. outline
  3. chapter scripts
  4. storyboards (per chapter, parallel 3)
  5. resolve media + data
  6. voice (per chapter, one worker)
  7. compile / compose per chapter
  8. render chapters (parallel 2)
  9. stitch (ffmpeg concat, same codec)
  10. audio mix/master over the full timeline
  11. gates
  12. package
- Every stage writes its artefact and is **resumable**: a rerun skips finished stages and chapters (keyed by content hash).
- Chapters are separate compositions. The chapter kicker/progress chrome knows the global chapter index. Captions/SRT use global times.
- **Failure policy:** a chapter that fails its gates is regenerated alone, twice at most, before the run fails with a report.

## 8. Gates (LF)

The existing gates (LUFS −14 ±0.4, TP ≤ −1, LRA, frame geometry adapted to 16:9, layout audit at 1920x1080) plus:

| Gate | Rule |
|---|---|
| numbers | every spoken/on-screen number maps to a dossier fact (tolerance for rounding) |
| credits | every fetched asset has licence + credit; the credit label is visible while it is on screen |
| licence | only the allowed licences above |
| media quality | no upscale > 1.5x; no duplicate pHash; each photo ≥ 2.5 s |
| cadence | the LF bands in section 6 |
| chapters | YouTube chapter rules: first at 0:00, ≥ 3 chapters, each ≥ 10 s (ours 60–120 s) |
| readability | FK grade ≤ 8 per chapter; sentence length ≤ 22 words |
| safe areas | nothing critical in the bottom 90 px; end-screen zone clear in the last 20 s |
| pace | syl/s within the LF band |

## 9. Output package
`<out>/video.mp4` (1920x1080 30 fps), `captions.srt` (upload, not burned), `description.md` (hook paragraph, chapter timestamps, sources from the dossier, image credits, disclaimer), `credits.txt`, `metadata.json` (3 title options, tags). A thumbnail is a later phase (the video-thumbnail skill). No auto-upload.

## 10. Control panel
A format switch `Short 9:16 | Long 16:9`. Long adds:
- length (8–12 min);
- a music bed toggle (default on);
- a per-stage progress view: research -> outline -> script -> storyboards -> media -> voice -> render -> package.

The calendar gets a long-form topic generator in the user's style (deep-research business/economy stories).

## 11. Phases and ownership
| Phase | Scope | Parallel? |
|---|---|---|
| P1 | frame abstraction (9:16 pixel-identical) | first |
| P2 | LF profile, templates, modules (image, chart, map, headline, number, timeline, chapter, recap, end) | after P1 |
| P3 | research + outline + chapter script generator + number/readability checks | parallel with P1 |
| P4 | media resolver (Wikidata/Commons/Openverse/NASA, vision check, AI illustration, cache, manifest, credits) | parallel with P1 |
| P5 | LF pace + audio (music on, chapter swell) + LF gates | after P1 |
| P6 | storyboardLF generator + make-longform orchestration + stitch + package | after P2–P5 |
| P7 | control panel + a pilot ("Why Kingfisher went bankrupt"), then 2 more topics, all gates green | last |

## 12. Decisions (defaults used unless the user says otherwise)
- **D1** CC BY-SA allowed, with credit and only crop/scale/grade edits. (Most Commons photos are BY-SA; rejecting them would bring back the old low hit rate.)
- **D2** AI illustrations allowed for concepts/jokes only, labelled; never realistic real people or events.
- **D3** Real public figures' photos (e.g. company founders) from PD/CC sources: allowed, factual context only.
- **D4** Brand logos: allowed unaltered on cards (nominative use).
- **D5** The long-form ending is "Subscribe for more deep dives" + end-screen slots. Whether to promote vloombox.in on the finance channel is the user's call (default: off).
- **D6** Maps: bundle Natural Earth 1:50m admin-0 (public domain, ~1–3 MB GeoJSON). Downloading it needs the user's OK (standing rule). Until then, maps use Commons locator SVGs.
- **D7** Burned-in captions off (SRT uploaded instead). A keyword-caption style can be enabled later.
