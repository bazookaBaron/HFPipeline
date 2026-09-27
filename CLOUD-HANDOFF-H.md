# Handoff: workstream H (cost)

Branch `cloud/lf-cost`, based on `v2/contract` @ `a8a34b4`. Plan: `analysis/plans/LONGFORM-V2-PLAN.md` §9.

## What changed

### 1. Storyboard auto-fixes before any LLM repair
New file: `lib/longform/storyboardFix.js`, called from `generateChapterStoryboard`.

After every model answer, code tries these fixes first:
- **Text length:**
  - abbreviate, drop filler words, or cut at a word boundary to the on-screen word limits, keeping `highlight` a phrase of the text;
  - drop `sub` paragraphs;
  - cut map labels to 14 characters;
  - layout-audit overflow: shrink an lfText title (`size`, 2 lines) or cut the text by the measured px.
- **Overlap:**
  - rebalance satellites across the rails; drop the lower-third headline when a title is already there;
  - turn back-to-back push transitions into a hard cut;
  - nudge overlays that collide in the layout audit;
  - maps: remove duplicate pins, enforce the pin and arrow caps and one zoomTo per scene, and re-anchor events that land less than 1.4 s after a zoom;
  - give a highlight a `hold` that ends before a later zoom.
- **Cadence:** when beats per minute are too high, drop dim/undim/tone events in the densest spots. When they are too low, or there are long holds, add emphasis beats in the widest gaps.
- **Variety:**
  - move a scaffold that starts ≤2 sentences off its planned start onto that start;
  - swap the hero to the planned type when the content fits (barChart ↔ lineChart over years, countryMap ↔ worldMap).
- **Numbers:** parse string figures; scale huge raw values (to billion, or crore when the prefix is ₹); round long decimals; compact long digit runs in labels.
- **Misc:** drop unused media intents; change count `op` to `enter`; add a text highlight phrase; highlight an unannotated photo.

Fixes are kept only when re-validation improves. If all fixes together make it worse, each fixer is tried on its own.

### 2. Scene-level repair
New file: `lib/longform/sceneRepair.js`.

- Each remaining problem is mapped to its scaffold(s). If all problems are local and cover at most half the scaffolds, the model gets:
  - the static prompt;
  - the section narration;
  - the neighbouring scene ids;
  - the failing scaffolds, their events and media;
  - facts, series or quotes only when those scenes show them.
- The answer is spliced back in; all other scaffolds stay byte-identical.
- Structural problems (narration, chapter card, plan coverage, media share, beats/min, scene life, render-gate failures) and scene answers that are unusable or worse go to the whole-chapter repair.
- `lfMeta` now records `calls` (e.g. `first,scene`) and `autoFixes`.

### 3. Prompt caching order and ledger
- The storyboard, scene repair and script prompts were already static-first. Now also:
  - the vision prompt: rules and schema first, the slot's own wants last, then the images;
  - the cold-open editor: locked tokens moved after the static rules;
  - beats: already static-first.
- `lib/ai/models.js` records these in each ledger row:
  - `cachedIn` (from `usageMetadata.cachedContentTokenCount`), `batch`, and `run` / `video` / `stage`;
  - a `$` cost per row, using `PRICES`, cached input at 10 % (`GEMINI_CACHED_PRICE_FACTOR`) and batch at 50 %.
- `tools/gemini-usage.js`:
  - shows the cached share and `~$` per task;
  - takes `--video / --run / --stage` filters.

### 4. Thinking defaults
Defined in `THINKING_DEFAULTS`, now in `lib/ai/models.js`; `lib/longform/gemini.js` re-exports them.
- **low:** `script.repair`, `longform.storyboard.repair` / `.scene`, `longform.sceneRewrite`, `longform.edit`, `longform.outline.repair`, `longform.beats`, `media.queries`. `longform.script` stays low.
- **model default:** `longform.outline`, `longform.script.cold`.
- Override with `GEMINI_THINKING_<TASK>`.
- `lib/media/gemini.js` now sends the knob too, and falls back if a model rejects it.
- Outline repairs are now their own task, `longform.outline.repair`.

### 5. `--batch`
New file: `lib/ai/batch.js`.

- Research (`research.plan` / `grounded` / `distil`), `longform.outline`, `longform.script` and first-pass `longform.storyboard` go through `models/<m>:batchGenerateContent`:
  - calls made within 2 s of each other are coalesced into one job per model;
  - polling backs off from 15 s to 60 s.
- Resume state lives in `<out>/batch/{jobs,results}`. A killed run polls its pending job again instead of resubmitting, and finished answers come from disk.
- A failed job falls back to an interactive call. Repairs never go to the batch. `LF_BATCH_TASKS` overrides the task list.
- Under `--batch`, all script sections and all first-pass storyboards are issued in parallel so they share one job.

### 6. `--budget-usd N`
New file: `lib/longform/budget.js`.

- **Default budget:** $0.50 per minute (about $6 for 12 min), minimum $1.50.
  - Overrides: `LF_BUDGET_USD`, `LF_BUDGET_USD_PER_MIN`; `off` disables the stop.
- **Spend tracking:** read incrementally from the ledger, counting this video's rows (keyed by `--out`) across invocations. `LF_BUDGET_SCOPE=run` counts only this invocation.
- **At ≥80 %:**
  - repair tasks drop one tier;
  - storyboards allow at most 2 more attempts;
  - script repairs stop after round 1, and the cold-open editor, beat-sheet hint call, media-gate model rewrite and render-gate regeneration rounds are skipped.
- **At ≥100 %:** every Gemini call is refused (`{budget, fatal}`). The media stage traps the stop before writing the manifest. The run exits with **code 5** and prints a resume command. All finished artefacts stay on disk.
- **On every exit:** `final/cost.json` is written (per stage and per task: $, calls, tokens, cached share, batch calls) and a per-stage table is printed.

### 7. Vision vetting (`lib/media/vision.js`)
- Before any call: a size and aspect check (`qualityProblems`), and a title filter that rejects photo/portrait candidates titled logo / flag / map / chart / … unless the intent asks for one.
- At most **3 vision calls per slot and media kind**. The cap is per kind so that a video slot's fallback to a still has its own budget; without this, the existing video→still test broke.
- Past the cap, that stage fails closed and the resolver ladder takes over. `LF_VISION_PER_SLOT` overrides the cap.

## Tests
Run from `orchestrator/`:
```
node --test $(find . -name "*.test.js" -not -path "./node_modules/*")
```
Result: **223 pass, 0 fail, 12 skipped**. The skips are the pre-existing ones that need `output/lf/kingfisher`, which is not in the repo.

New test files:
- `lib/longform/storyboardFix.test.js` (19 tests), built on the LF pilot chapter (`fixtures/v3/lf-pilot.json`):
  - each fixer class;
  - problem → scaffold mapping;
  - splice isolation;
  - the scene prompt contents and size;
  - the repair loop (fixable = no extra call; local = one scene call; structural or unusable = whole chapter);
  - budget fatal and tight caps.
- `lib/longform/cost.test.js` (11 tests):
  - ledger parsing and pricing (torn lines, cached, batch, fal, image);
  - `recordUsage` context;
  - thinking defaults;
  - budget defaults, guard levels, incremental reads, `cost.json`;
  - the batch client (coalescing, backoff, disk resume, pending-job resume, failure fallback, repairs kept interactive, the budget refusing before any request);
  - vision prompt order, pre-filters and the per-slot cap.

Every network call is a fake `fetch` or fake Gemini client; no API key is used. The tests redirect the ledger to a temp file (`models.setLedger`).

The environment needed `ffmpeg` (apt) and `numpy` (pip) to run the existing media/music tests. That is not a code change.

## Needs a real paid run to verify
- **Actual savings:** compare `final/cost.json` from a new 3-min proof with the old one (63 storyboard calls, 807K in, 379K out). Check storyboard call count, `calls` / `autoFixes` in each storyboard's `lfMeta`, and `cachedShare`.
- **Implicit caching:** whether `cachedContentTokenCount` is actually non-zero for storyboard and scene calls. The static prefix must be at least the model's minimum and identical byte for byte. Vision prompts are probably below the minimum.
- **Batch API response envelope:** `inlinedResponses` is parsed defensively from several shapes. Still to confirm:
  - `google_search` grounding works inside batch requests;
  - `thinkingConfig` is accepted there;
  - the real turnaround time.
- **Thinking levels on the lite model:** `thinkingLevel: "low"` on `gemini-3.5-flash-lite` for queries and beats. The client falls back if the model rejects it, but the quality impact is unmeasured.
- **Quality:** scene repairs vs whole-chapter repairs (visual check), and whether any auto-fix text cut reads badly (the terminal log lists every fix).
- **Budget in practice:** that the 80 % tier drop and the 100 % stop behave well mid-storyboards. Parallel sections finish their in-flight call and then stop.
- **Pricing table:** `PRICES` in `lib/ai/models.js` should be checked against the current price sheet, including the cached-input factor.

## Merge-risk files
- `orchestrator/make-longform.js`: ~35 small, self-contained edits:
  - the `BG` require;
  - `--batch` / `--budget-usd` parsing;
  - `BG.stage` in `emit()` and before the beat sheet;
  - `BG.start` after `out`;
  - `batch` passed to `loadGeminiRest` / `liveGenerate`;
  - script concurrency and storyboard parallelism under `--batch`;
  - `err.budget` in the media trap;
  - a `BG.optional()` gate on render repairs;
  - `BG.finish` plus exit code 5 in `main().then/catch`;
  - header docs.
- `orchestrator/lib/longform/storyboardLF.js`:
  - `generateChapterStoryboard` rewritten;
  - `liveGenerate` picks a task per call kind;
  - `fillHolds(sb, opts)` gained options (the default is unchanged);
  - `validateChapter` returns the raw `layout` findings;
  - `isFatal` knows `err.budget`;
  - the media-gate model rewrite is skipped when tight;
  - new exports `planLines` and `GEN_TASK`.
- `orchestrator/lib/ai/models.js`: new tasks, pricing, ledger fields, cost mode. `thinkingConfigFor` / `THINKING_DEFAULTS` moved here; `lib/longform/gemini.js` still exports them.
- Small edits in `lib/longform/{gemini,script,outline,beatSheet}.js` and `lib/media/{gemini,vision}.js`.

Not touched: `lib/media/resolve.js`, `lib/media/ladder.js`, `lib/longform/montage*`, `video-engine/.../stage/core.js`, `modules-lf*.js`, `tools/v3_gates.py`, `compile.js`.
