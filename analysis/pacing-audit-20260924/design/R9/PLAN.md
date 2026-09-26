# Plan: R9 "media dossier" style + runtime media fetching with credits

Date: 2026-09-26. Status: **plan only**; nothing below is built yet.

- Source: `R9/AUDIT.md` (igexport-Ddb-aswiHnN, 169.0 s, the Anduril company explainer).
- It continues `PLAN_R6-R8.md`. P1–P2 of that plan are largely built: `media` window + root trims + media gate, vloombox library + promo, transitions, `chapterTabs`, headline light/recolour, caption skins, music bed. This plan builds on them.

---

## 1. What R9 adds, in one table

| | R9 | Closest thing we have |
|---|---|---|
| Style | **DH-dossier**: black grid plate, one 960×743 panel on top, a **B-roll dock** bottom-left (540×304), presenter bottom-right (396×548), caption chip below | DH (mascot left, single column), DH-media (R8) |
| Signature | **Real media on screen 66 % of the time**, from ≈34 rasters: dock stills/videos, photo grid, portraits, product tiles, tree leaves, nested feed video, logos | `media` window (one per scaffold), vloombox library |
| Attribution | **Every photo/video carries an on-frame source + licence line** (strip line or top-right chip) | none |
| Fallback | **Vector silhouettes / person placeholders** where no licensable photo exists | none |
| Chrome | chapter label + 9-segment progress + running `T+` timecode; per-sentence eyebrow (19/min) | DH HUD, `chapterTabs` |
| Motion | image fills 4 f fade + rise; all swaps 1-f cuts; presenter slides in from the right (467 ms power3.out) and hides on 3 climax headlines | reveal, hard cuts, presenter enter/hide |
| Pace | 170 wpm; ≥41 beats/min; layout median 3.97 s | cadence bands per profile |
| Audio | −14.1 LUFS; **D-fifth drone bed** ≈8–10 dB under the voice; no SFX; footage muted | music bed `ambient`, SFX (make them optional per style) |

**Rights:**
- R9's presenter is a copyrighted cartoon character; its footage/photos are third-party.
- We copy mechanics only.
- Every raster in our videos comes through the resolver (§3) with a licence record.

---

## 2. Architecture decisions

1. **Media is resolved before render, never during.**
   - The pipeline gains one step: `storyboardGen` → **`resolveMedia`** → `compile` → render.
   - The render reads only `video-engine/assets/media/cache/…` and library files.
   - CI renders with the network off.
2. **The storyboard carries intents, the manifest carries assets.**
   - The LLM writes `media: {intent, entity?, kind, slot}`.
   - The resolver writes `media-manifest.json` (slot → sha, credit, crop) beside the storyboard.
   - The compiler joins the two.
   - Re-renders reuse the manifest (like the saved promo pick in 0b862ac).
3. **Credits are data, not copy.**
   - Every image-bearing module gets a `credit` string from the manifest.
   - The LLM never writes credit text, and it never writes a dock strip title for an asset without a vision-confirmed description.
4. **The dock is a lane, not a module in a scaffold.**
   - `storyboard.dock` is a cut list anchored to words.
   - The compiler turns it into one persistent window: image holds in the stage, video trims in the root media layer via the existing `media.js` path.
   - It extends the per-scaffold `collectRuns` logic with lane runs.
5. **Fallbacks are first-class.** Any media slot can resolve to `{fallback: "silhouette"|"placeholder"|"drop"}`, and every module that takes an asset renders its fallback state (R9 does this itself: `SILHOUETTE` tiles, person placeholders).

---

## 3. Phases (each ends with renders, gates and a side-by-side against R9)

### P1: Media resolver (offline-first; no UI yet)

New `orchestrator/lib/media/`:

| File | Role |
|---|---|
| `resolve.js` | entry: `resolveMedia(storyboard, {topic, cacheDir, providers, gemini}) -> manifest`; library → cache → providers; writes `media-manifest.json`, `credits.txt` |
| `queries.js` | Gemini JSON-mode: intent → `{queries[3-5], route[], negatives[], wikidataQuery?, entityClass?, rubric}`; cached by hash; temperature 0 |
| `providers/wikidata.js` | `wbsearchentities` → QID → `wbgetentities` claims P18 (image) / P154 (logo) |
| `providers/commons.js` | Commons Action API `generator=search&gsrnamespace=6&prop=imageinfo&iiprop=url\|size\|mime\|extmetadata&iiurlwidth=…`; parses `LicenseShortName` / `LicenseUrl` / `Artist` / `AttributionRequired`; also video (webm/ogv). Descriptive User-Agent with contact |
| `providers/openverse.js` | `api.openverse.org/v1/images/` with `license_type=commercial,modification` (**verify** base URL, auth and limits) |
| `providers/pexels.js` | photos `/v1/search`, videos `/videos/search`; `Authorization` header; key from `orchestrator/.env` `PEXELS_API_KEY` (never logged; same loader pattern as `geminiCarousel.js`) |
| `providers/pixabay.js` | `/api/` and `/api/videos/`, `safesearch=true`; 24 h response cache (**verify** terms) |
| `providers/nasa.js` | `images-api.nasa.gov/search` + `/asset/<id>` |
| `providers/unsplash.js` | behind a flag; only after the hotlink/download-tracking terms are verified for video use |
| `providers/dvids.js` | behind a flag; **verify** API and terms first |
| `providers/logos.js` | `simple-icons` npm (bundled, offline) → Wikidata P154 → text wordmark |
| `license.js` | normalise the licence string → `{id, allowed, requiresAttribution, sa, nc, nd}`; the gate table from AUDIT §7.7 |
| `vision.js` | Gemini multimodal batch check (6–8 thumbs/call) → `{matches, depicts, textOrWatermark, otherBrandLogos, identifiablePeople, nsfwOrGore, aiGenerated, focalBox}` |
| `process.js` | ffmpeg: focal cover crop, resize 2×, WebP/JPEG; video trim + scale + `-an -crf 20 -r 30 -g 30`, poster; cropdetect; pHash |
| `cache.js` | content-addressed store `video-engine/assets/media/cache/<aa>/<sha>.<ext>` + sidecar JSON (AUDIT §7.9); `raw/`; negative cache; LRU |
| `credits.js` | short on-frame credit + full TASL credits for the description |

Also:
- `orchestrator/tools/resolve-media.js`: CLI `node tools/resolve-media.js <storyboard.json> [--dry] [--offline]` (`--offline` = cache/library only).
- `orchestrator/tools/media-purge.js`: removes a sha and lists the manifests that used it.
- `.gitignore`: add `video-engine/assets/media/cache/`.
- Wiring: `generate-video-v3.js` calls `resolveMedia` after the storyboard is accepted and before `compileStoryboard`. Failure policy: fallback visuals, never an aborted render.

**Tests.** No network in tests: recorded JSON fixtures per provider under `orchestrator/lib/media/__fixtures__/`.

| Test | Covers |
|---|---|
| `license.test.js` | every row of AUDIT §7.7, incl. `CC BY-NC-SA 2.0` reject, `Public domain` / `PD-USGov-Military-Army` allow, GFDL-only reject |
| `commons.test.js` | extmetadata parsing incl. HTML `Artist` |
| `resolve.test.js` | routing, fallback chain, negative cache, determinism (the same fixtures give a byte-identical manifest) |
| `process.test.js` | the crop keeps `focalBox`; video output has no audio stream, 30 fps, GOP 30 |

**Proof.**
- Resolve media for 5 topics (a company, a person, a space topic, a generic dev concept, a place).
- Contact sheet of the picks + rejects with reasons.
- A human spot-check of licences against the landing pages (first time only).

### P2: Credit chrome + media skins + gates

`lib/stage/modules-media.js` extends `media`:
- `skin: "viewfinder"`: no header, bottom `strip`, outside corner `brackets`, `source` pill top-left, **credit chip** top-right, overlays `trackBox` / `targets` / `callout`.
- `skin: "dock"`: 540×304.5 card; still variant = strip title + credit line; live variant = LIVE pill + credit chip + strip title.
- Ops `strip {title}` (1 f) and `swap {asset}` (1 f).
- Corner brackets dim on stills, light on video.

Type spec: AUDIT §7.8 (credit 13 px mono caps, #8a8c92 on #141518 or a 78 % dark chip; ≥ 4.5:1 contrast).

`media.js` / `composeStage.js`:
- the root media layer accepts several simultaneous wrappers (hero + nested feed tile + dock);
- the credit chip for video sits **in the stage above the root video layer** (z-order: stage background → media layer → stage overlays/credits → captions; the split already exists for highlights).

New gates in `orchestrator/tools/layout_audit.js` / the compile checks:

| Gate | Rule |
|---|---|
| `credit-visible` | every sampled frame with a visible media asset shows a non-empty credit element inside or adjacent to it, rendered cap ≥ 9 px |
| `licence` | every asset in the manifest has `allowed: true`; NC/ND/unknown fail the build |
| `no-network` | the compiled HTML has no `http(s)://` in `src`/`href` of media; the render runs with the network disabled |
| `media-first-frame` | exists (`checkMedia`); extended to dock and nested wrappers |
| `crop` | stills ≤ 15 % loss per axis (grid/tiles ≤ 25 %); video ≤ 2 % (existing) |
| `resolution` | source px ≥ 1.25 × rect px at 1080 |

**Proof.** A fixture storyboard (`fixtures/r9-media-gallery.json`) with each skin, still + video, rendered and frame-measured against AUDIT §2.2 / §2.3 (±3 px, ±1 f).

### P3: Image cards

New `lib/stage/modules-img.js` (all seek-safe; `img.decode()` before timeline registration; fallback states):

| Module | Notes |
|---|---|
| `photoGrid` | dashed named slots, `fill {i}` (4 f fade + 8 px rise), `group {text}` |
| `portraitCard` | 3:4 portrait, head in the upper 45 %, bio block, credit line |
| `peopleRow` | 3–6 cards; the placeholder silhouette when `asset` resolves to a fallback |
| `imageTiles` | photo **or** vector silhouette (icon set) + `SILHOUETTE` tag; generic `strike` / `dim` |
| `specCard` | image + key/value rows, credit in the strip |
| `logoChips` / `logoCards` / `lockup` | monochrome white marks from `providers/logos.js`, never recoloured; `fill`, `light`, `demote` |

Changes to existing modules:
- `tree` gains `leaf.asset` / `leaf.silhouette`, `cols`, dashed placeholders.
- `timeline` allows 14 ticks + `mark {tick, tone}`.

Also:
- `catalog.js` entries (AUDIT §5.1 sketches) with `only` unset (usable in DH/DC/LC; skins per profile via tokens).
- Heights in the catalog so templates can stack them.
- Carousel static final states for each (`modules-carousel.js`).

**Proof.** A card gallery fixture, clean in the layout audit, with every card in both the resolved and the fallback state.

### P4: DH-dossier template, chrome, map host

`templates-dh.js`: a `dossier` template.
- Panel 60–1020 × 267–1010.5; dock 60–600 × 1057.5–1362; presenter right 660–1060 × 789–1336 (in front of the panel corner); caption y 1444–1547.
- A `climax` variant: presenter + dock hidden, headline under the panel.

Presenter (`core.js`):
- `side: "right"`, enter `slideInRight` (from off-right, 467 ms power3.out, R9 5.63–6.07);
- `hide` / `show` hard cuts (the promo hide already exists).

`hudDossier` chrome:
- chapter label (mono 17 px, #909196);
- N-segment progress (x 585–840, 3 px, active #4a678f);
- `T+ HH:MM:SS.t` timecode = composition time, drawn from the timeline so it stays seek-safe;
- 1-f chapter swaps.

`opsMap` host (merged with R8's planned `floorplan`):
- plates `topo` (procedural contour SVG from a seeded noise field, deterministic per video) / `floor` / `none`;
- ops `nodeIn`, `link`, `ring`, `target`, `sweep` (vision-cone ambient), `counter`.

Also:
- `columns` (vertical chart) and `feedTiles` (one tile may hold a nested video → root layer).
- Eyebrow per sentence: reuse `micro`; the template exposes `slots.eyebrow` with a 1-f swap.
- A style profile entry `DH-dossier` (tokens: plate #07080b, grid #101114 60 px, panel border #1d1e23, lit #0b1c2d / #1a3a63, accent #3fa3ff) and the caption skin `chipDark` (white active, grey #b1b5bb upcoming).

**Proof.** A hand-written storyboard re-creating R9's first 60 s structure on a *different* topic (e.g. "What exactly is Hugging Face?"). Side-by-side geometry and timing against R9 (±1.5 px / ±1 f on the listed rects and curves).

### P5: Generator (storyboardGen.js) and validation

Grammar / prompt additions for the dossier style:
- **Media rule:** a sentence naming a concrete real thing (a product, person, place, organisation, event) → a media slot with `intent` + `entity`. Abstract mechanisms → vector modules. At most ≈60 % of sentences get media, and a 1-sentence media gap is fine (R9's dock is absent ≈40 % of the time).
- **Dock cut list:** one hold per sentence (or per listed noun in an enumeration), anchor = the first word, `lead 0.08–0.10 s`. The strip title comes from the vision `depicts` + the entity (the LLM may propose ≤ 44 chars, but the resolver overrides it when the vision check disagrees).
- **Climax rule:** 2–3 headline climaxes per video hide the presenter + dock (R9: brand/product name, the named concept, the thesis).
- **People:** a portrait only for public figures named in the script, at most 1 per chapter, fallback placeholder.
- **Logos:** only for brands named in the sentence; a comparison → `logoCards`.
- **No media intents for:** casualties/combat, minors, private individuals, medical imagery. Topic-level safety: defence topics prefer equipment/test footage.

Validation:
- every media slot has `intent`, `kind` and a word anchor that exists;
- dock holds do not overlap climax scaffolds;
- intent length 6–20 words;
- every enumeration with images has ≤ 6 items;
- the cadence band (below).

**Cadence band** (from AUDIT §6):

| Profile | beats/min | layout median | longest hold | wpm |
|---|---|---|---|---|
| DH-dossier | 38–55 | 3–5 s | ≤ 4.5 s | 165–200 |

Other generator work:
- the `chooseProfile` gain `DH-dossier` for company / product / person / place topics (named-entity-heavy);
- a worked example fixture (`fixtures/sb-dossier-example.json`);
- media intents written to the storyboard; the manifest is joined in `compile.js`.

### P6: UI + operations

Control panel:
- style list gains "Dossier";
- a **Media** tab per video: the resolved grid with credits, licence badges and the runner-ups; an operator can swap to a runner-up or upload their own (upload = `library` source with a licence field);
- a toggle "fetch media from the internet" (off = library + fallbacks only).

Also:
- `credits.txt` is appended to the upload description by the existing publish step (or copied to the clipboard in the UI when publishing is manual).
- Keys: `PEXELS_API_KEY`, `PIXABAY_API_KEY`, optional `OPENVERSE_CLIENT_ID/SECRET`, `UNSPLASH_ACCESS_KEY`, `DVIDS_API_KEY` in `orchestrator/.env`, loaded like the Gemini key, never logged.
- Monitoring: per-run resolver stats (hits / misses / fallbacks / rejects by reason) in `runMetrics`.

**Proof.** 5 topics end to end from the button, with no human step, every gate green, credits correct against the landing pages (spot-checked).

---

## 4. Files to add / change (summary)

| Area | Add | Change |
|---|---|---|
| Resolver | `orchestrator/lib/media/{resolve,queries,license,vision,process,cache,credits}.js`, `providers/*.js`, `__fixtures__/`, tests | `orchestrator/generate-video-v3.js` (call before compile), `.gitignore` |
| Tools | `orchestrator/tools/resolve-media.js`, `media-purge.js` | `tools/layout_audit.js` (credit-visible, crop, resolution probes) |
| Compiler | – | `v3/compile.js` (join the manifest, dock lane), `v3/media.js` (lane runs, multiple wrappers, nested tiles), `v3/composeStage.js` (credit chips above the root media), `v3/catalog.js` (new modules), `v3/templates-dh.js` (`dossier`, `climax`), `v3/storyboardGen.js` (grammar, rules, validation, profile) |
| Stage | `lib/stage/modules-img.js` | `modules-media.js` (skins, strip, swap, brackets, chips), `core.js` (presenter right, slideInRight, hudDossier), `modules-dh*.js` (`tree` image leaves, `timeline` marks), `modules-carousel.js` (static states) |
| UI | media tab, style option, fetch toggle | control-panel style list |
| Fixtures | `r9-media-gallery.json`, `sb-dossier-example.json` | – |

---

## 5. Risks

- **Licence metadata errors** at aggregators. Mitigations: the Commons landing page is authoritative, cross-check Openverse items with a landing-page fetch, and never guess.
- **CC BY-SA scope** in a video is a legal judgement. It is used as a fallback only, and needs a policy decision (§6).
- **Relevance drift** (namesakes, fan art, AI stock). Mitigations: Wikidata class check + vision rubric + `aiGenerated` flag.
- **Sensitive subjects** (defence, conflict). Mitigations: a topic-level policy and the vision gore/violence flag; prefer test/equipment media.
- **API terms change** (rate limits, attribution wording). Mitigations: providers are pluggable and each carries a `termsCheckedAt` date in its config; the items marked **verify** block enabling that provider.
- **Repo bloat.** The cache is git-ignored and content-addressed with an LRU; only manifests are committed.

## 6. Decisions needed from you

1. Providers to enable first: **Commons + Wikidata, Pexels (video), NASA, Simple Icons** (recommended), then Openverse / Pixabay. Do you want Unsplash and DVIDS (after the terms check)?
2. **CC BY-SA:** allow as a fallback (crop/grade only, credited) or reject outright?
3. **Real-person portraits** (public figures, CC/PD only): allowed?
4. **Brand logos** (monochrome, unaltered, nominative): allowed on cards and chips?
5. **Defence/conflict topics:** allowed at all? If yes, equipment/test media only?
6. Credit wording: on-frame short form `SOURCE · AUTHOR · LICENCE` + full credits in the description. Is that OK for the channel look?
7. R9's audio has a drone bed and no SFX. For the dossier style, should the music bed default to `ambient` on and SFX default to off?
