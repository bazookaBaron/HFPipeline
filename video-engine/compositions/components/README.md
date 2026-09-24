# Component library — the multi-instance pattern

This is the pattern every component in this library follows, resolved by installing and
reading real items from HyperFrames' own ~220-item hosted registry (see
`_registry-reference/browser-device-stage.html` and `_registry-reference/chat-thread.html`,
pulled live via `npx hyperframes add`), cross-checked against `hyperframes-core`'s
`sub-compositions.md` / `variables-and-media.md` and `hyperframes-registry`'s
`contributing.md` / `component-quality-bar.md`. Read this section before building or
modifying anything below.

## The question

`hyperframes-core`'s own docs show a composition's template hardcoding a literal
`data-composition-id` string inside the file. A project needs `browserWindow` three times —
three different URLs, three different reveal timings — sometimes on different scenes,
sometimes (a comparison layout) on screen at once. If the id is hardcoded once per file, how
do three instances not collide?

## The resolved pattern: fixed id + variables, not fixed id + forked files

**Never parameterize the composition id.** Every real registry item that supports reuse
(`browser-device-stage`, `chat-thread`, and every component in this library) keeps **one
fixed, literal `data-composition-id` / `window.__timelines[id]` key**, hardcoded in the file,
exactly as `hyperframes-core` shows. `browser-device-stage.html`'s own header comment says it
plainly: _"registers one paused timeline under the **LITERAL** 'browser-device-stage' key."_

**Every per-instance difference is a declared variable, not a file fork.** The file declares
`data-composition-variables` on its root `<html>` (id, type, label, default — every field has
a real default, never `undefined`). The HOST wires the SAME file as many times as needed —
sequentially, at different `data-start` times — and gives each host `<div
data-composition-src="...">` its own `data-variable-values='{...}'` JSON blob. This is
`sub-compositions.md`'s own documented mechanism: _"The host can render the same
sub-composition multiple times with different `data-variable-values` to produce per-instance
variations."_ It is not a workaround — it is the intended, tooling-supported path (Studio's
variable editing UI and `--strict-variables` both assume it).

```html
<!-- index.html — the SAME browser-window.html, three sequential scenes,
     never three forked files, never three different composition ids -->
<div
  data-composition-id="browser-window"
  data-composition-src="compositions/components/browser-window/browser-window.html"
  data-variable-values='{"url": "https://shop.example.com/cart", "heading": "Your cart", "type_at": 0.3, "content_at": 2.1, "duration": 5}'
  data-start="0" data-duration="5" data-width="1080" data-height="1920" data-track-index="1"
></div>
<div
  data-composition-id="browser-window"
  data-composition-src="compositions/components/browser-window/browser-window.html"
  data-variable-values='{"url": "https://shop.example.com/checkout", "heading": "Checkout", "type_at": 0.3, "content_at": 2.4, "duration": 6}'
  data-start="5" data-duration="6" data-width="1080" data-height="1920" data-track-index="1"
></div>
```

Proven end-to-end: `compositions/components/browser-window/` and `content-panel/` are wired
into this project's real `index.html` as two sequential scenes and both `npm run check` and
`npm run render` pass (see `renders/proof-two-scenes.mp4`, `PHASE2-REPORT.md`).

### The one real limit: never mount the same id twice, overlapping in time

`window.__timelines[id]` is a single global slot. Two host slots referencing the SAME
composition-id with **overlapping** `[data-start, data-start+data-duration)` windows would
both fetch, clone, and register against that one key — a real, unresolved collision, unlike
the sequential case which the framework and its own registry explicitly support. **Sequential
reuse (the overwhelming majority of this catalog's use cases — one mockup on screen per
narration beat) is the supported, proven path.** If a scene genuinely needs two-or-more
instances of one visual **on screen at the same time** (e.g. a side-by-side comparison), do
NOT mount the same sub-composition file twice concurrently. Instead:

- Author it as ONE sub-composition that internally stamps N repeated blocks from an array
  prop, each mounted DOM node getting a unique generated id but all driven by the ONE shared
  timeline — this is exactly how `chat-thread.html` builds its own message list internally
  (`items.map(...)`, one `tl`, N generated `<div>`s), and how `content-panel.html` in this
  library builds its bulleted list. This is also how you'd build e.g. a
  "two-browser-windows-side-by-side" comparison component: NOT two instances of
  `browser-window`, but one new component (`comparisonSplit` or similar) whose own script
  stamps two independent browser-chrome DOM subtrees from a `panels` list prop.
- Or, for a true copy-pasted effect snippet with no timeline/duration of its own (HyperFrames'
  other registry shape, "components" in the strict `contributing.md` sense — CSS-only
  overlays, grain, shimmer), paste the markup multiple times directly into the host's own
  script and timeline, prefixing every id per the paste (`hyperframes-registry`'s own
  contributing guide: _"ALL element IDs must use this prefix to avoid collisions"_). This
  library's items are the timeline-bearing kind (see next section), so this escape hatch is
  documented for completeness, not used here.

## What kind of registry item these are

`hyperframes-registry/contributing.md` describes two types — a **block** (own dimensions,
duration, full standalone composition) and a **component** (a snippet, no timeline, no
dimensions, pasted in). In practice HyperFrames' own newer catalog items blur this: both
`browser-device-stage` and `chat-thread` are typed `"hyperframes:component"` in their
`registry-item.json` yet are full sub-compositions with their own `data-composition-id`,
`data-composition-duration`, and `window.__timelines[id]` registration —
`hyperframes-registry/component-quality-bar.md`'s own mount-harness rule confirms this is the
live convention: _"If the file... contains a `data-composition-id`, it is a sub-composition:
mount it with `data-composition-src`... If it does not, it is a snippet: paste it inline."_

Every item in this library is the **sub-composition kind** (matches the mount-harness rule's
first branch): its own fixed id, its own timeline, mounted via `data-composition-src`. Their
`registry-item.json` uses the component template shape from
`hyperframes-registry/references/templates.md` (`type: "hyperframes:component"`, no top-level
`dimensions`/`duration` fields at the manifest level — those live inside the `.html` file's
own `data-composition-duration` / variable schema instead, matching the real registry's
practice).

## File layout per component

```
compositions/components/<name>/
  <name>.html          the sub-composition itself (see Recipe below)
  registry-item.json   metadata (name, type, title, description, tags, variables, files)
  demo.html            standalone, isolated preview harness (see below)
```

This mirrors `hyperframes-registry/contributing.md`'s own contribution scaffold
(`registry/{blocks,components}/{name}/{name}.html` + `registry-item.json`), rooted at this
project's `compositions/components/` per the Phase 2 brief instead of the upstream repo — so
any of these worth sharing upstream later needs only a directory move, not a rewrite.

`_registry-reference/` holds the two real hosted items pulled down for this research
(`browser-device-stage.html`, `chat-thread.html`) — read-only reference material, not part of
this project's own catalog. Keep it as evidence the pattern above is grounded in something
real, not invented.

## Shared library contract

Three files, `compositions/components/lib/`:

- **`text-fit.js`** — `HFTextFit`. Real canvas-`measureText` shrink-then-truncate. Ports the
  three functions PLAN.md names from the old pipeline: `fitFontToBox`, `truncateToWidth`,
  `countWrappedLines`, plus a convenience `fitOrTruncate(el, text, opts)` that does both steps
  and mutates the element. **Every text field in every component goes through this — never a
  character-count heuristic** (`text.length > 40 ? shrink : normal`). Character count lies:
  "iiiiiiiiii" and "WWWWWWWWWW" are the same length, wildly different widths.
- **`props.js`** — `HFProps`. `resolve(vars, schema)` coerces every declared variable against
  its OWN default, independently, through one shared policy (`string`/`number`/`boolean`/
  `color`/`enum`/`list` coercion). This is the enforcement mechanism for the "never a silent
  mix of authored + dropped fields" rule: there is no code path in a compliant component that
  reads a raw variable directly (`vars.title`) — everything goes through `HFProps.resolve`,
  so a malformed or missing field always falls back to ITS OWN default, uniformly, the same
  way every time, never partially. Also ships `HFProps.rebuild(container, buildFn)` — clears
  a container's children before rebuilding, so multi-item/multi-phase content never
  accumulates stale nodes across a re-seek or a variable change.
- **`tokens.css`** — shared design tokens, names matched to HyperFrames' own hosted registry
  convention (`--brand`, `--accent`, `--accent-2`, `--fg`, `--bg`, `--surface`, `--border`,
  `--muted`, verified against the two reference files) plus this project's own
  `--hf-*`-prefixed set. See "Color discipline" below.
- **`demo-runtime.js`** — `HFDemoRuntime`. Used only by `demo.html` files (see below), never
  by a real project or by the components themselves.

**Load-order contract:** a `<script src>` INSIDE a sub-composition's own `<template>` is safe
only for an absolute URL (e.g. the GSAP CDN script every component redundantly includes,
matching real registry convention). It is NOT safe for a local relative path: once the
runtime clones a template's contents into the host document, a relative `src` resolves
against the HOST's location, not the original file's folder — correct in one mount context,
wrong in another. So `text-fit.js` and `props.js` are never `<script src>`'d from inside a
component's own template. Instead, exactly like GSAP is assumed already global, every HOST
that mounts one of these components loads the two shared libs itself, before the mount:

- The real project's `index.html` loads them in its own `<head>`, relative to itself:
  `compositions/components/lib/text-fit.js`, `.../props.js` (see this project's `index.html`).
- Each component's own `demo.html` loads them relative to itself: `../lib/text-fit.js`.
- `gallery.html` loads them once for the whole gallery shell.

Every component's inline script defensively checks `window.HFTextFit`/`window.HFProps` exist
and logs a clear error naming the missing host contract if not — never silently no-ops.

## Color discipline (hard rule)

`--hf-brand` (aliased to HyperFrames' own `--brand`) is the ONE fixed accent for chrome:
borders, focus rings, carets, primary progress fills, active-state indicators. It is wired by
default in every component. `--hf-accent` / `--hf-accent-2` / `--hf-accent-3` / `--hf-accent-4`
exist ONLY to distinguish **content items** within one scene (three KPI cards, a multi-series
chart, N bullet points someone wants individually colored) and are **opt-in per instance**
via an `accent` enum variable, defaulting to `"brand"`. A component must look complete and
coherent if a caller never touches `accent` at all. Traffic-light window dots and other real
product chrome (`browser-window`'s red/yellow/green) are exempt — they depict a real product,
not a color choice (matches `component-quality-bar.md`'s N2 exemption).

## Text-fit, defaults, and clear/rebuild — the three hard rules, concretely

1. **Text-fit.** Any field whose length isn't fixed by the caller (headings, labels, list
   items, URLs) is measured with `HFTextFit` against the ACTUAL pixel box it renders into
   (via `getBoundingClientRect`/`clientWidth`, not an assumed constant), shrunk toward a
   declared `minSize`, then truncated with an ellipsis if it still doesn't fit. See
   `browser-window.html`'s heading or `content-panel.html`'s title/items for the pattern.
2. **Defaults, uniformly.** `SCHEMA` declares every variable's type/default/bounds.
   `HFProps.resolve(vars, SCHEMA)` is the ONLY way a component reads `vars`. No field is ever
   read raw. A caller who sends `{url: "..."}' and nothing else gets a fully-formed instance —
   every other field at ITS OWN default — never a broken hybrid of one real field and four
   blank ones.
3. **Clear and rebuild.** Any component with a variable-length list (rows, items, steps,
   messages) tears its container down and rebuilds it from `props` on every mount
   (`HFProps.rebuild`), so a re-seek, a variable change, or Studio's live-edit loop never
   leaves an old step's DOM node sitting next to a new one.

## Frame-filling (hard rule)

A component with few content items (2 KPI cards instead of 5, a 2-item bullet list) scales
its own type size / spacing UP as item count goes DOWN (`content-panel.html`'s
`count <= 2 ? largerFont : ...` branch is the concrete pattern), and its outer container
always sizes to `100%`/`inset:0` of the frame it's given. Never author a fixed small pixel box
centered in a much larger canvas — the outer wrapper fills the frame; internal rhythm adapts
to content density.

## Recipe: adding a new component

Follow this exactly; it is what `browser-window` and `content-panel` already do.

1. **Scaffold the folder.** `compositions/components/<name>/{<name>.html, registry-item.json, demo.html}`.
2. **Port visual design + prop shape from the old catalog**, never its old scene-graph API.
   Decide the prop schema first: every piece of per-instance content or timing becomes one
   `data-composition-variables` entry (content: `string`/`number`/`enum`/`list`; timing:
   `number` seconds, named `..._at` for a reveal timestamp so the future narration-timing
   bridge — PLAN.md §5 — has an obvious seam to stamp real word-derived seconds into).
   Always include a `duration` number variable (default matching a sensible standalone demo
   length) and read it via `props.duration`, never `root.dataset.duration` from static markup
   — that keeps per-instance re-timing (a different `data-duration` on a different host clip)
   actually working, which `_registry-reference/browser-device-stage.html` gets subtly wrong.
3. **Copy `browser-window.html`'s skeleton**: full `<!doctype html><html
   data-composition-id="..." data-composition-duration="N"
   data-composition-variables='[...]'><head></head><body><template>...` shape (this is what
   makes `data-composition-variables` actually work — a bare top-level `<template>` with no
   `<html>` ancestor, which Phase 1's original `browser-window.html` used, has nowhere to
   declare variables; this is the concrete "fix if needed" from the Phase 2 brief).
   - `<style>` and `<script>` live INSIDE the `<template>` — the assembler drops everything
     outside it for a templated file (`hyperframes-core/references/sub-compositions.md`
     Pitfall 1).
   - `#root` is `position:absolute; inset:0; container-type:size;` — never hardcoded pixel
     dimensions — and every internal size uses `cqmin`/`cqw`/`cqh` off it, so the same file
     renders correctly at any host `data-width`/`data-height`.
   - Root container fills the frame (`width/height:100%` on the outermost visual wrapper).
4. **Read props once, near the top of the script**: `HFProps.resolve(window.__hyperframes.getVariables(), SCHEMA)`.
   Resolve the `accent` enum to a CSS custom property on `#root` (`--<prefix>-accent`) rather
   than branching per-call.
5. **Build/measure/rebuild, then animate.** Do DOM construction and `HFTextFit` calls BEFORE
   building the GSAP timeline (`content-panel.html`'s order). Wrap any list-driven markup in
   `HFProps.rebuild`. Re-run layout inside `document.fonts.ready.then(...)` too (font metrics
   shift canvas measurements).
6. **Build one `gsap.timeline({paused:true})`, clamp every timestamp against `props.duration`**
   (`Math.min(props.x_at, Math.max(0, duration - epsilon))`) so an aggressive caller-supplied
   timestamp can never push a tween past the instance's own visible window, then register it
   under the file's one fixed literal id: `window.__timelines["<name>"] = tl`.
7. **`registry-item.json`**: copy `content-panel/registry-item.json`, change `name`,
   `title`, `description`, `tags`, `category`, the `files` path, and the `variables` list
   (mirror the JS `SCHEMA`, one entry per key).
8. **`demo.html`**: copy `content-panel/demo.html`, change the two `src`/`compositionId`
   strings and the `variables` object to something that exercises an interesting instance
   (not just the bare defaults — pick values that prove text-fit or frame-filling kick in,
   the way the browser-window demo picks a long URL and the content-panel demo picks 2 items).
9. **Validate.** `cd video-engine && npm run check` — 0 errors before moving on. If the
   component isn't wired into `index.html` yet, temporarily wire it (a throwaway `data-start`)
   to get it into the checked render graph, or trust `demo.html` + a manual look for
   isolated visual sign-off; either way, actually look at a snapshot
   (`npx hyperframes snapshot --at "<a few times across its duration>"`) before calling it
   done — `check` passing is not a visual gate (`component-quality-bar.md`'s own warning:
   "check... passes compositions that render nothing").
10. **Add it to `gallery.html`'s sidebar list** (one array entry: name, category, path to its
    `demo.html`).

## Status

See `PHASE2-REPORT.md` for exactly which of the ~58-item catalog are built to this pattern,
which are stubbed as a recipe-only TODO, and the render proofs.
