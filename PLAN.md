# HyperFrames Pipeline — Phase 0 Technical Plan

## Video-quality redesign phase (current)

Triggered by reviewing 4 reference videos showing a higher-quality target style (persistent
host mascot, evolving status HUD, bordered/word-highlighted captions, bespoke diagrams, two
visual themes, deeper 8-10-beat narratives). Full phase-wise implementation authorized by the
user; four parallel agents built the new pieces, then a platform-wide rate limit interrupted
work mid-verification. This section is the honest, real-verification status after resuming.

**Done and real-verified** (via `hyperframes check --json` + real `hyperframes snapshot` PNGs,
never check-output alone — see `video-engine/CLAUDE.md` "Linting" and this project's
established discipline of catching bugs check's JSON misses):
- Persistent mascot (`video-engine/assets/mascot/spongebob.svg`, user-supplied) + evolving
  status HUD + bordered/word-emphasized captions, wired in `orchestrator/lib/video/composeHtml.js`.
- 6 new components built by parallel agents: `node-graph-diagram`, `deployment-dashboard`,
  `particle-swarm`, `perspective-3d-road`, `folder-tree`, `chapter-shell`. All added to
  `gallery.html` (62 total components).
- **Real bug found and fixed**: `chapter-shell`'s original design tried to mount an arbitrary
  nested component (`contentComponentType`/`contentProps`) via a `data-composition-src`
  attribute constructed at *runtime* by its own script. `hyperframes check`'s console-error
  scan reported 0 errors for this (nothing throws), but a real `hyperframes snapshot` showed
  the nested slot rendering **blank** — proven via a controlled A/B scratch test: a
  statically-authored (author-time) `data-composition-src` one level deep renders correctly;
  the identical markup constructed by JS after page load does not. Root cause: the
  render/snapshot pipeline's bundler resolves sub-composition sources by **static scan of the
  HTML source**, not by executing the page first, so a JS-constructed reference is invisible
  to it at render time regardless of what the live DOM looks like. Fixed by redesigning
  `chapter-shell` to draw chrome only, at a documented **fixed content-card rect** (top:
  38cqmin, left/right: 6.4cqmin, bottom: 5.4cqmin of a 1080x1920 frame); real content is now a
  plain, statically-authored sibling scene the caller positions to that rect — the same
  flat-sibling-composition pattern every other scene in this codebase already uses. Re-verified
  with a real snapshot: chrome + sibling terminal-session render correctly together, command
  types out, output reveals. The building agent's own header-comment claim of having
  "empirically validated" the nested mount was false — a reminder that a `check` pass without
  a real snapshot is not sufficient proof for anything involving dynamic DOM construction.
- **Two real pre-existing bugs** (unrelated to the redesign, surfaced by this phase's first-ever
  consolidated check of all 62 components) also fixed: `world-map-panel`'s default London/
  Frankfurt map points were close enough (3%/1% apart) that their pill labels visually
  overlapped (`content_overlap` error, confirmed and then fixed via real snapshot showing clean
  separation) — fixed the default coordinates plus added general closeness-based label-flip
  logic for arbitrary caller data. `skeleton-loader` has a minor pre-existing info-level
  `clipped_text` finding (6-8px descender clip on its demo title/subtitle text) — investigated,
  a `lineHeightRatio` override made the checker's reported number worse rather than better, so
  left as-is; it's non-blocking (info, not error) and cosmetic only.
- Full-library validation: all 62 components checked together in 4 realistic-sized batches (16
  components each, matching `scenePlan.js`'s real `MAX_SCENES=16`, not the artificial "62 at
  once" scale which hit an unrelated framework-level concurrency artifact never seen at real
  usage scale) — **0 runtime/layout/contrast/motion errors across all 4 batches**.
- **Real, high-impact bug class found and fixed via an actual end-to-end run** (real Gemini
  script → real F5-TTS/WhisperX voice → real assembled composition → real `hyperframes check`):
  the persistent chrome (mascot, captions, status HUD) and several scene components were each
  built by different parallel agents with no shared awareness of each other, and collided in
  real, Gemini-authored renders in ways no per-component or per-agent isolated test caught:
  - Mascot (was 26% wide) visually covered a third of the frame, overlapping captions and any
    scene content in the lower-left. Shrunk to 15% width.
  - Captions (was `bottom: 9%`) overlapped the mascot, `deployment-dashboard`'s bottom traffic
    readouts, and (even after a first `bottom: 21%` fix, verified only against `check`'s
    default sample points) a `node-graph-diagram` node once a long caption phrase wrapped to 2
    lines — found by forcing `check --at <exact-time>` at the caption's real peak-height
    moment, since default sampling missed it. Fixed with `bottom: 24%`, a smaller 36px font,
    and shorter 3-word (was 4-word) caption phrase grouping, all in `composeHtml.js`.
  - The status HUD bar (opaque, top 76px) rendered directly over `deployment-dashboard`'s own
    "Application Load Balancer" heading. Fixed by giving that component real top padding.
  - `deployment-dashboard`'s label/version text (e.g. Gemini-authored "BLUE (LIVE)") and its
    ALB listener label both clipped: both used a flat guessed percentage of container width as
    their text-fit `maxWidth`, which didn't match the REAL space left after sibling elements
    (a badge, a traffic-split readout) took their share. Fixed by measuring real DOM widths
    (`getBoundingClientRect()`) instead of guessing, matching the pattern this file already
    used elsewhere ("rowInnerWidth").
  - `ide-diff-panel`'s filename tab (e.g. a real long migration filename) rendered at ~77px and
    overflowed the canvas entirely. Root cause: `HFTextFit.fitOrTruncate`'s wrap-simulation
    (`countWrappedLines`) only detects overflow at a WHITESPACE boundary — a filename/path has
    none, so it's one unbreakable "word" and the shrink loop never triggers. This is the exact
    same bug class `deployment-dashboard.html` had already found and fixed for its own
    single-token fields (labels, versions, ids) with a measure-and-truncate-directly helper
    (`fitNoWrapToken`, bypassing `fitFontToBox`'s wrap simulation entirely) — mirrored into
    `ide-diff-panel.html` rather than reinvented. **This is a latent gap in the shared
    `text-fit.js` library** (`fitOrTruncate` alone is unsafe for any single-token content:
    filenames, ids, hostnames, hashes, versions) that has now bitten two independent
    components; worth elevating `fitNoWrapToken` into the shared lib rather than leaving it
    duplicated, but not yet done here.
  - `node-graph-diagram`'s "branch" layout fanned its child nodes out at `yPct: 74` (26% from
    the bottom), landing inside the caption's zone. Moved to `yPct: 65`.
  All six re-verified via forced-timestamp `check --at` and a `--samples 80 --at-transitions`
  thorough sweep (which is what actually caught several of these — default `--samples 9`
  missed them) against the real generated composition: **0 errors across lint/runtime/
  layout/motion/contrast.** This is a strong signal that "check passes at default sampling"
  is not sufficient for any component sharing a canvas with time-varying chrome; a thorough
  sweep should be standard practice for any new persistent-chrome-touching change.
- Script-depth redesign (`scripting-pipeline/src/arcScenePlanner.ts`, `orchestrator/lib/video/scenePlan.js`):
  7-stage narrative arc, 10-16 scenes (up from 3-6), 90s floor / 120s default length. Unit-tested
  (49/49 passing) **and real-Gemini-validated**: a live run (topic "How blue-green deployment
  prevents downtime", 120s target) converged on the *first* attempt to a real 12-scene script
  covering the full arc (hook → naive restart → why it 502s → 4-scene mechanism using the new
  `deployment-dashboard` component → 3-scene complication including a real DB-migration edge
  case using the new `node-graph-diagram` component → an expand-contract refinement → a recap
  that closes with a theater-curtain metaphor sharing real vocabulary with the mechanism scenes).
  Output at `scripting-pipeline/output/system-design-1789787488312.json`. This also confirms
  Gemini naturally selects the two new Phase 3/4 components when topically appropriate.
- **Full end-to-end real render, clean, after all fixes above**: topic "How blue-green
  deployment prevents downtime", real Gemini script (12 scenes) → real per-scene F5-TTS +
  WhisperX narration → real assembled composition (mascot + HUD + captions + `deployment-
  dashboard` used 3x + `node-graph-diagram`) → `hyperframes check` **0 errors** → real render.
  Output: `orchestrator/output/blue-green-deployment-final.mp4`, 3m11s, 9.6MB, rendered in
  7m28s. This is the first fully clean run of the redesigned pipeline since the video-quality
  redesign phase began — every bug found and fixed above was found BECAUSE of this real
  end-to-end attempt (not by isolated component checks), which is the whole reason it was
  worth doing before calling this phase done.

**Not yet done** (honest gaps, not silently skipped):
- Theme system (dark-dashboard vs. light-editorial) is not wired into the orchestrator —
  `chapter-shell` exists and works standalone, but nothing in `generate-video.js`/`composeHtml.js`
  yet decides when to use it or places a sibling content scene against its fixed rect.
- Phase 8 comparison render (side-by-side against an actual reference video, not just a clean
  render) not started.
- Phase 0 ground-truth hand-authored fixture not built (deprioritized in favor of the above).
- `fitNoWrapToken` (the measure-and-truncate-directly text-fit helper) is duplicated in
  `deployment-dashboard.html` and `ide-diff-panel.html` rather than shared via `lib/text-fit.js`
  — worth elevating given it's now fixed the same real bug class twice.
- This session's bug-hunt was real but not exhaustive: only the specific components a real
  Gemini script actually chose (12 of 62) were battle-tested against real long-string content
  and the persistent chrome. The other ~50 components passed generic-sample-data checks but
  have not been individually verified against arbitrarily long/short real Gemini text the way
  `deployment-dashboard`, `ide-diff-panel`, `node-graph-diagram`, and `world-map-panel` were.
  A different topic could plausibly surface similar latent single-token-text-fit or
  chrome-collision bugs in a not-yet-exercised component.

## Status (updated)

**The pipeline is now genuinely functional end-to-end for both generation pipelines.** A real
`GEMINI_API_KEY` is live at `scripting-pipeline/.env` (model `gemini-3.6-flash`). A topic typed
into the control panel now produces a real rendered video or carousel with real voice-cloned
narration — not fixtures, not stubs. Phases 7 (publish) and 8 (validation/cutover) are what's
left, both gated on real external credentials only you can provide.

| Phase | State | Where |
|---|---|---|
| 0 — Research & setup | Done | This file; all 26 HyperFrames skills installed |
| 1 — Engine skeleton | Done | `video-engine/` — real rendered proof, `phase1-proof.mp4` |
| 2 — Component library | Done (56/56 planned components + gallery) | `video-engine/compositions/components/`, see its `PHASE2-REPORT.md` |
| 3 — Scripting pipeline | Done, real Gemini calls proven | `scripting-pipeline/`, see its `PHASE3-REPORT.md` |
| 4 — Voice pipeline | Done, real end-to-end test passed | `voice-pipeline/`, see its `PHASE4-REPORT.md` |
| 5 — Carousel pipeline | Done, real end-to-end test passed | `carousel-engine/`, see its `PHASE5-REPORT.md` |
| 6 — Control panel UI | Done, real render+SSE proven; publish/OAuth honestly stubbed | `control-panel/`, see its `PHASE6-REPORT.md` |
| **Integration layer** | **Done** — topic → real video/carousel, proven end to end | `orchestrator/generate-video.js`, `orchestrator/generate-carousel.js` |
| 7 — Publish integration | Not started | Needs YouTube + Instagram API credentials |
| 8 — Validation & cutover | Not started | Needs Phase 7 first |

**Real, verified capabilities as of this update:**
- `orchestrator/generate-video.js`: topic → real Gemini script (picks from the real 23
  components) → real per-scene F5-TTS+WhisperX narration → narration-anchor timestamps
  resolved into real component timing props → assembled composition → real
  `hyperframes check` (0 errors) + `render`. Proven twice for real: a direct CLI run (topic
  "how a CDN cache works", 52.4s MP4, audio/video duration matched to within 0.03s) and
  through the control panel's real SSE-streamed job (topic "what a hash table collision is",
  38.97s MP4).
- `orchestrator/generate-carousel.js`: topic → real Gemini carousel content (8 slides, real
  reject-and-repair loop caught and fixed a genuine field-length violation) → real
  carousel-engine render. Proven for real (topic "3 signs your database needs an index"),
  output slides visually inspected — clean, no overflow, no placeholder content.
- Both control-panel run buttons now trigger the real orchestrators instead of fixed demo
  content, streaming real logs via SSE.

**Two real bugs found and fixed while proving this**, worth knowing about:
1. Gemini's `responseSchema` structured-output mode, when given a large flat schema
   (~25 optional properties per array item, to cover all 10 carousel slide kinds), made
   `gemini-3.6-flash` satisfice at a 1-item array every time regardless of prompt wording
   asking for 6-10 — confirmed by direct A/B test (identical prompt, schema on vs. off).
   Fixed by dropping `responseSchema` for the carousel generator and relying on
   `responseMimeType: "application/json"` + strong prompt instructions + the existing zod
   validation as the real safety net. Also confirmed `minItems`/`maxItems` on a Gemini
   schema causes an outright 400 (unsupported). The video pipeline's smaller/simpler schema
   did not hit this failure mode in testing, but it's worth watching if that schema grows.
2. `spawn(..., {shell:true})` on Windows re-tokenizes an argv on whitespace with no escaping
   — silently truncated `--topic "what a hash table collision is"` down to `"what"`. Fixed by
   dropping `shell:true` where not needed (`node`) and manually quoting args where it is
   (`npx`).

**Known gaps to close before this is production-ready:**
- Component library is now complete: 56 components across all 8 categories (Foundation,
  Narrative, Software mockups, Annotation, Background, Architecture, Data/metrics,
  Editing/transitions), all passing a consolidated `hyperframes check` (0 errors, 32/32
  contrast checks) and mostly snapshot-verified. Three real bugs were caught and fixed along
  the way (stale-DOM invisible animation, a wrong-subtree magnifier clone, a contrast
  failure) — see `video-engine/compositions/components/PHASE2-REPORT.md`.
- `scripting-pipeline`'s Gemini prompt now picks from this real 56-component catalog (not
  just the original 23) — the `componentCatalog.ts` reconciliation reads the catalog at
  runtime, so this updated automatically with no further changes needed.
- **accent/handle/captions/sfx are now real** (previously accepted-but-inert): handled at the
  composition-root level in `orchestrator/lib/video/composeHtml.js` rather than inside any
  individual component — accent overrides the `--hf-brand` CSS variable every component
  already reads with a fallback, so it cascades to all 56 with zero per-component changes;
  handle renders a persistent corner watermark; captions groups the real aggregated per-scene
  WhisperX word timings into phrases and displays them word-synced (HyperFrames' documented
  inline-composition + `data-timeline-role="captions"` pattern); sfx places a real synthesized
  whoosh (`video-engine/assets/sfx/whoosh.wav`, generated once via ffmpeg) at each scene
  boundary. Proven end-to-end with a real render: extracted real frames showing the custom
  accent color, watermark, and captions all present, and confirmed real non-silent audio
  energy at both SFX boundary timestamps.
- The carousel's `dsSnapshot` template under-fills its frame when cell count is low (dead
  vertical space) — a layout proportion issue in Phase 5's own template, not a blocker, not
  yet fixed.
- `control-panel/`'s YouTube/Instagram publish endpoints and the OAuth token exchange are
  stubbed (return `501`, UI says "not yet wired") — needs real OAuth app credentials.

Original Phase 0 plan below, unchanged as a historical record of the reasoning.

---

Status: Phase 0 (research & setup) complete. This is the plan to review before Phase 1
(engine integration skeleton) starts. Nothing beyond Phase 0 setup has been implemented.

## 0. Correction from the original brief

The original setup prompt assumed HyperFrames might be Remotion/React-based. It is not.
**HyperFrames: write plain HTML, render video.** No JSX, no bundler, no build step.

- A composition is an HTML file. Clips (`<video>`, `<img>`, `<audio>`, nested
  `<div data-composition-id>`) carry `data-start` / `data-duration` / `data-track-index`.
  The framework owns mounting, unmounting, and media playback from those attributes alone.
- Every composition (root or nested) registers exactly **one paused GSAP timeline** on
  `window.__timelines["<composition-id>"]`. Scripts only do visual creativity (opacity,
  transform, canvas, SVG) — never play/pause/seek media or toggle visibility; the framework
  does that from `data-*` attributes and will conflict with scripts that duplicate it.
- Compositions nest via `data-composition-src`; the framework auto-nests sub-timelines into
  the parent based on `data-start`. Relative timing works by referencing another clip's
  `id` (`data-start="intro + 2"`), so a chain of scenes reflows automatically if one scene's
  duration changes — this maps directly onto our narration-driven, variable-length scenes.
- **Determinism is enforced**: no `Date.now()`, no unseeded `Math.random()`, no render-time
  network fetches. Everything (audio files, word timestamps, generated content) must be
  pre-baked to disk before a composition renders. This is a hard constraint on our pipeline
  design (see §5).
- Render path: headless Chrome (Puppeteer) seeks the timeline frame-by-frame, FFmpeg encodes,
  `@hyperframes/producer` mixes audio. Also supports AWS Lambda / GCP Cloud Run / HeyGen cloud
  for distributed rendering later if local render time becomes a bottleneck.

Comparison the README draws itself: Remotion bets on React components; HyperFrames bets on
plain HTML both humans and agents can write directly. Both use headless Chrome + FFmpeg
under the hood.

## 1. Step 1 setup — what's done and verified

- Cloned `heygen-com/hyperframes` to `hyperframes/` in this repo for reference (see §2 for
  why this should probably not be the final integration shape).
- Installed all 26 Claude Code skills (20 published + 6 internal repo-only ones) via
  `npx skills add heygen-com/hyperframes --all`, confirmed live in `.claude/skills/` and
  picked up by this session. These **replace** the generic Remotion-oriented skills for this
  project — HyperFrames ships its own motion doctrine (`motion-doctrine`, `cut-the-curve`,
  `seam-craft`, `oversized-cursor`), animation reference (`hyperframes-animation`), and
  creative/beat-planning guidance (`hyperframes-creative`), all HyperFrames-native
  (seek-safe, single-timeline, deterministic) rather than generic motion-graphics advice.
- Verified the shared TTS/alignment environment end-to-end with a **real** run (not a mock):
  F5-TTS voice-cloned synthesis (6.7s on the RTX 4050 Laptop GPU) → WhisperX forced alignment
  → correct word-level timestamps. `C:\Repos\tts-venv\Scripts\python.exe <script>` is the
  right invocation pattern (the `.exe` console-script wrappers are confirmed broken, as
  flagged in the original brief). GPU + cached HF weights both confirmed working from this
  machine/repo.

## 2. Integration pattern decision (needs your sign-off)

The README's own recommended usage is **npm package + CLI**, not a submodule or forked
template:

```bash
npx hyperframes init my-video
cd my-video
npx hyperframes preview
npx hyperframes render
```

Requirements: Node 22+ (have it, v22.14.0), FFmpeg. Composition projects consume
`hyperframes` (CLI) and `@hyperframes/*` packages as ordinary npm dependencies; there's also
`npx hyperframes add <block>` to pull individual registry items into a project (a
shadcn/ui-style "catalog as package manager" pattern) and `@hyperframes/sdk` if we ever want
to manipulate compositions programmatically instead of hand-authoring HTML.

**Recommendation**: don't keep the full `heygen-com/hyperframes` monorepo clone as part of
this repo's runtime dependency. It's ~240MB+ with Git LFS golden-regression video baselines,
and it's not how the project is meant to be consumed. Options:
- (a) Delete `hyperframes/` now that Step 1 research is extracted, and scaffold the real
  project fresh with `npx hyperframes init`.
- (b) Keep it as a gitignored `vendor/hyperframes-src/` reference-only checkout (not part of
  the shipped project) for occasional source-diving beyond what the skills/docs cover.

I haven't deleted anything — this is your call since it's 240MB of clone effort. Say which
you'd prefer (or I'll default to (a) — cleaner — if you don't have a preference).

## 3. Component library → HyperFrames primitives mapping

HyperFrames ships a registry (`registry/blocks` — 180 installable sub-composition scenes,
`registry/components` — ~220 installable effects/snippets), searchable via
`npx hyperframes catalog --query "..."` with zero setup. It's **not** a 1:1 match for our
58-component CS-explainer catalog or the 10-slide carousel catalog, but several registry
items are close analogues worth installing and adapting rather than building from scratch:

| Our component (examples) | Closest existing registry item | Verdict |
|---|---|---|
| `browserWindow` | `components/browser-device-stage` (template-slot content injection, `swap_at` var for narration-timed screen swaps) | Adapt |
| `terminalSession` | `components/terminal-simulator` | Adapt |
| `codeEditor`, `ideDiffPanel` | `registry/blocks/code-terminal-run`, 13 `code-snippet-*` IDE-theme blocks | Adapt |
| `notificationStack` | `components/notification-stack` | Adapt |
| `settingControl`, `formStepper`, `checklistProgress` | `components/settings-toggle-flow`, `onboarding-stepper-flow`, `signup-flow` | Adapt |
| `kpiCluster`, `sparklineMetric`, `progressDonut` etc. | `blocks/mk-progress-stat`, `mk-specs-list`, `mk-line-graph`, `data-chart` | Adapt |
| `takeawayBanner`, `calloutLabel` | `components/spotlight-card`, `vox-annotate` (single-cue circle+connector-to-label beat) | Adapt |
| everything else (architecture diagrams, myth/fact cards, balance-beam, etc.) | nothing close | Build fresh, as project-local registry items |

**Pattern to follow for every new component** (ours or adapted): each registry item is a
self-contained primitive with `registry-item.json` metadata, a `README.md`, a standalone
`demo.html` harness, and the component's own `.html`. We build our catalog the same way —
as project-local registry-shaped items — so `hyperframes-registry`'s tooling
(search/install/wire) and `hyperframes lint`/`check` work on them, and so any of ours worth
sharing can later be contributed upstream via the same skill's PR workflow.

**Hard-won lessons from the old repo carry over directly and map onto concrete HyperFrames
rules**:
- Text-fit protection → still our job; HyperFrames doesn't measure text for us. Port
  `textFit.ts` as a shared script included by every component.
- No hardcoded placeholder fallback → still an authoring discipline, enforced by our own
  Gemini reject-and-repair loop (§6), not something the engine checks.
- Multi-step content must clear/rebuild, not accumulate → maps directly onto HyperFrames'
  mount/unmount-by-`data-start`/`data-duration` model; if we drive multi-step reveals within
  one composition's timeline instead of one clip per step, we're responsible for explicitly
  animating old content out before the next step's `data-start`, exactly like the framework's
  own "transitions are separate from mount/unmount" rule warns.
- Color/frame-fill lessons stay pure component-design discipline — HyperFrames doesn't
  constrain either.
- Note: `motion-doctrine` (load-first skill) independently enforces a stronger version of
  the "give small scenes real motion, avoid dead frame" principle — its "ban on idle wobble"
  and Seam Gate build-checks are worth treating as the authoritative version of that lesson
  going forward.

**Gap**: there is no aggregated gallery/storybook view. Each registry item ships its own
isolated `demo.html`, but nothing stitches them into one browsable catalog UI locally (the
only aggregated view is the hosted `hyperframes.heygen.com/catalog` marketing site). Phase 2's
exit criteria needs a small **local gallery page we build ourselves** — realistically a thin
static page that iframes each component's `demo.html` with a picker sidebar. Not hard, just
not provided.

## 4. Carousel pipeline → static-image render path

Carousels are static images, not video, so they don't use the timeline/GSAP model the same
way. Two options, to decide before Phase 5:
- (a) Each slide is a minimal 1-frame HyperFrames composition (e.g. `data-duration="0.1"`)
  and we grab a still via `hyperframes snapshot` (already built for "capture key frames as
  PNG for visual verification" — repurposable as our render path).
- (b) Skip HyperFrames' timeline machinery entirely for carousels and render slides via
  Puppeteer directly against plain HTML/CSS (no `data-*` attributes needed since there's no
  timing to manage). Simpler, avoids fighting a video-first API for an image deliverable.

Leaning toward (b) — recommend confirming in Phase 5 planning rather than now, since it
doesn't block Phase 1-4 work.

The shared pieces called out in the original brief (`NumberBadge`, real text-fit via
`fitFontToBox`/`truncateToWidth`/`countWrappedLines`, brand-color rotation table) are
render-path-agnostic and port unchanged either way.

## 5. Narration timing bridge (the actual "thin layer" to build)

HyperFrames has **no generic runtime "attach component to word N, auto-time it" API**. What
it has:
- `npx hyperframes transcribe` — produces the same word-level shape we already get from
  WhisperX: `[{ "id": "w0", "text": "Hello", "start": 0.0, "end": 0.5 }, ...]`. We don't need
  this command since our own F5-TTS+WhisperX environment (confirmed working, §1) already
  produces this shape — but it confirms our data contract matches what HyperFrames-native
  tooling expects.
- Components like `browser-device-stage` (`swap_at`) and `vox-annotate` (`draw_at`) show the
  established pattern: a component exposes one or more **timestamp variables**, and the
  *authoring layer* (us) computes those seconds from the word array and stamps them as
  `data-start` / a `cues="0.4,0.8,1.6"`-style variable when instantiating the component.
- The internal `changelog-video` skill's own doctrine — "chips land on their VO words",
  "ticks land on each item's VO word" — is exactly this pattern, hand-computed per project by
  reading the transcript, not a shipped engine feature.

**What we build**: a small preprocessing script that takes our WhisperX word array + the
Gemini-authored script's word-anchor references (already part of our reject-and-repair
validation, §6) and emits the concrete `data-start`/`data-duration`/`cues` values for each
scene's components, before any HTML is written. This is genuinely thin — the seek-safe timing
engine and the UI-card primitives it drives both already exist; we're writing the glue that
converts "reveal this card when the narrator says X" into the seconds HyperFrames expects.

## 6. Scripting pipeline (Gemini) — mostly unaffected by engine choice

The zod-schema + reject-and-repair pattern from the original brief carries over unchanged:
schema validation via Gemini's `responseSchema`, then structural checks (pacing budgets,
narration-anchor-is-literal-substring, variety, placeholder-content detection), reject with
specific failure reasons and retry bounded times. The one HyperFrames-specific addition: the
schema's output now needs to name, per scene, **which registry/project component to
instantiate and its timestamp variables** (not a generic "operation" object like the old
Remotion pipeline) — a small, mechanical change to the response schema's shape, not a
redesign of the validation approach.

## 7. Voice pipeline — unaffected, already verified

F5-TTS (voice-clone, ≤12s reference) + WhisperX (forced alignment) via
`C:\Repos\tts-venv\Scripts\python.exe`, invoked directly (not the broken `.exe` wrappers).
Confirmed working end-to-end in §1. Determinism rule (§0) means synthesis + alignment must
run as a pre-render step that writes audio + timestamp JSON to disk — never at composition
render time — which is exactly how our pipeline was already going to work.

Note: HyperFrames also ships its own local `hyperframes tts` (Kokoro-82M, no voice cloning)
and `hyperframes transcribe` (whisper.cpp). We're intentionally not using either — F5-TTS
voice cloning and WhisperX forced-alignment-against-known-text are both meaningfully
different capabilities the built-in tools don't cover — but it's worth knowing they exist in
case a fallback or a quick scratch test is ever useful.

## 8. Control panel UI — mostly unaffected

Still a plain local HTML/JS control panel per the original brief. The pipeline-runner backend
now shells out to `hyperframes render` / `hyperframes preview` / `hyperframes catalog`
instead of a Remotion render call — a swap at the integration-point level, not a UI redesign.
Live log streaming, run history, review-before-publish, YouTube reconnect flow, and the
voice-clone reference-upload panel (trim to ≤12s) all carry over as originally scoped.

## 9. Revised phase roadmap

| Phase | Change from original plan |
|---|---|
| 0 — Research & setup | **Done** (this document is the deliverable). |
| 1 — Engine integration skeleton | Scaffold via `npx hyperframes init`, one hardcoded composition, one component, hand-built `data-start` timing file (no Gemini/TTS) — proves the timeline/mount model, not just "HyperFrames renders something." |
| 2 — Component library port | Build project-local registry-shaped items (§3) + the local gallery page (the one real gap to fill). |
| 3 — Scripting pipeline | Same as original, schema output shape adjusted per §6. |
| 4 — Voice pipeline | Unchanged — already de-risked in Phase 0. |
| 5 — Carousel pipeline | Decide (a) vs (b) render path from §4 before starting. |
| 6-8 | Unchanged from original brief. |

## 10. Open decisions before Phase 1 starts

1. Keep, gitignore-vendor, or delete the full `hyperframes/` source clone? (§2)
2. Carousel render path: HyperFrames snapshot-of-a-composition vs. plain Puppeteer? (§4) —
   doesn't block Phase 1, but flagging now.
3. Any of our 58 components close enough to an existing registry item (§3 table) that we
   should install-and-adapt via `hyperframes add` rather than building fresh? Recommend
   doing this opportunistically in Phase 2 rather than deciding all 58 up front.
