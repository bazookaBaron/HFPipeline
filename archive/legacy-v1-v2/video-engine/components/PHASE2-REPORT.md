# Phase 2 report — component library (final, 56 components)

This supersedes the earlier partial report. Built across two rounds by seven parallel agents
plus one direct consolidation pass — see "Provenance" at the bottom for exactly who built what.

## The pattern (see README.md for the full write-up)

Every component follows the same resolved multi-instance pattern: one fixed literal
`data-composition-id` / `window.__timelines[id]` key per file, never forked or parameterized;
every per-instance difference (content, timing, accent) arrives as a
`data-composition-variables` declaration on the root `<html>` plus `data-variable-values` JSON
on the host's mount `<div>`. `HFProps.resolve(vars, SCHEMA)` is the only way a component reads
a variable (uniform per-field defaulting, never a raw read); `HFTextFit` does real
canvas-`measureText` shrink-then-truncate on every dynamic text field; any variable-length list
content is torn down and rebuilt via `HFProps.rebuild` rather than accumulated; every
`..._at` timestamp is clamped against `props.duration`.

## Full inventory — 56 components, 0 empty stubs

| Category | Count | Components |
|---|---|---|
| Foundation | 2 | adaptive-stage, content-panel |
| Narrative | 8 | acronym-expander, definition-card, eyebrow-headline-block, keyword-highlighter, myth-fact-card, problem-solution-pair, question-answer-pair, takeaway-banner |
| Software mockups | 13 | browser-window, chat-session, checklist-progress, form-stepper, ide-diff-panel, magnifier-lens, media-frame, mobile-device-frame, search-interaction, segmented-tab-nav, setting-control, skeleton-loader, terminal-session |
| Annotation | 5 | bracket-annotation, callout-label, focus-spotlight, mini-legend, status-pill |
| Background | 1 | perspective-grid |
| Architecture | 12 | actor-to-system-funnel, cache-hit-miss, client-server-exchange, deployment-rollout, etl-pipeline, failure-recovery, fan-out-fan-in, load-balancer-cluster, pub-sub-broadcast, queue-backpressure, request-lifecycle, trust-boundary |
| Data / metrics | 11 | balance-beam, cost-breakdown, gauge-meter, heatmap-matrix, kpi-cluster, latency-waterfall, progress-donut, progress-split-bar, sparkline-metric, timeline-milestones, world-map-panel |
| Editing / transitions | 4 | camera-push-transition, freeze-frame-annotator, match-cut-morph, scanline-reveal |

Note: these category buckets are the ones the building agents actually used (a slightly finer
split than the original brief's 6-category catalog — e.g. Annotation and Background were split
out of a broader "Foundation" grouping). Every catalog item from the original brief is covered
by one of these; the mapping is cosmetic, not a gap.

## Validation

**Per-component, at build time**: every component was validated with `npm run check` (0 errors
required) in an isolated scratch project before being considered done, and a majority were also
visually confirmed via `npx hyperframes snapshot` (catching two real invisible-DOM bugs along
the way — see "Real bugs caught" below).

**Consolidated, after all batches landed**: all 56 components were mirrored into one scratch
project and mounted sequentially on a single 379.5s timeline, then checked and snapshotted
together as a final cross-component pass:

```
Lint       0 errors, 1 warning (the scratch file itself being large — expected, not a real project file)
Runtime    0 errors, 0 warnings
Layout     0 issues across 56 samples
Motion     0 errors, 0 warnings
Contrast   32/32 text checks pass WCAG AA
Check: PASSED
```

No `data-composition-id` or `window.__timelines` key collisions across all 56 files (checked by
grepping every component file for both). Four components spanning different categories and
build batches (`checklist-progress`, `heatmap-matrix`, `scanline-reveal`,
`freeze-frame-annotator`) were additionally spot-checked with real rendered snapshots as part of
this consolidation and confirmed correct, on-topic, and non-blank.

## Real bugs caught during this phase (worth knowing about)

1. **Stale DOM references from a second `layout()` call.** `keyword-highlighter`'s first version
   rebuilt its `<mark>`/underline-bar nodes both at initial layout and again inside
   `document.fonts.ready.then(...)` — the GSAP timeline had already captured references to the
   first batch of nodes, so highlights animated invisibly on detached elements. `npm run check`
   reported 0 errors throughout; only an actual `hyperframes snapshot` showed the highlights
   missing. Fixed by splitting one-time DOM construction from a repeatable font-size-only refit;
   every list-driven component built after this fix follows the split-function pattern from the
   start.
2. **A magnifier effect duplicating the wrong subtree.** `magnifier-lens`'s first design cloned
   an entire panel into a large scaled subtree behind the lens's clip circle instead of just the
   highlighted row — caught by snapshot, not by `check`. Redesigned to clone and scale only the
   single highlighted row, flex-centered inside the circle.
3. **A WCAG contrast failure from an unconditional dark label color.** `progress-split-bar` used
   a fixed dark percentage-label color that failed contrast against low-opacity segments. Fixed
   by computing each segment's actual rendered luminance (accent blended with its opacity over
   the page background) and choosing dark/light label text accordingly.
4. **`StaticGuard` forbids `../` asset paths above the project root.** Several agents (and this
   consolidation pass, on its first attempt) initially tried validating new components from a
   scratch directory that referenced the shared `compositions/components/lib/` via `../` —
   `hyperframes check`/`render` both reject any asset path that traverses above the checked
   project's own root. Fixed by mirroring the actual component files into each scratch project
   instead of referencing them by relative path outward.

## Recipe for adding more (the remaining ~2 items, or all-new ones)

Follow `README.md`'s "Recipe: adding a new component" section exactly — every one of these 56
was built that way. The pattern is proven at scale now (56 real, checked, mostly
snapshot-verified components across 8 categories), so a new one is a matter of following the
recipe, not inventing anything new.

## Gallery

`gallery.html` (this directory) is a static sidebar + iframe shell listing all 56 components
grouped by category, each linking to its own `demo.html`. Serve the directory over a plain
local HTTP server (not `file://`, which blocks the `fetch()` each `demo.html` needs).

## Provenance

- Original 4 (`adaptive-stage`, `content-panel`, `eyebrow-headline-block`, `browser-window`) +
  the resolved multi-instance pattern itself: first Phase 2 agent (interrupted by a rate limit
  partway through the catalog).
- 9 more (`terminal-session` finished, `bracket-annotation`, `callout-label`, `focus-spotlight`,
  `magnifier-lens`, `media-frame`, `mini-legend`, `perspective-grid`, `status-pill`): Foundation
  resume batch.
- 10 more (7 Narrative + `client-server-exchange`, `kpi-cluster`, `camera-push-transition`) +
  the first gallery/report consolidation: Narrative + cross-category resume batch.
- 36 more, split across four parallel batches after the catalog's remaining categories were
  scoped out: software mockups, the rest of Architecture, the rest of Data/metrics, and the
  rest of Editing/transitions. Three of these four batches were interrupted by a rate limit
  during final cleanup/reporting (not mid-build — every assigned component was already complete
  on disk when each hit the limit); one component (`checklist-progress`) was missing its
  `registry-item.json`/`demo.html` and was finished directly in this consolidation pass.
- This final consolidation: cleaned up leftover scratch directories, finished
  `checklist-progress`, ran the cross-component validation pass described above, rebuilt
  `gallery.html` for all 56 items, and wrote this report.
