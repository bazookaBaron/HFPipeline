# Phase 5 Report — Carousel Engine (static-image render path)

## 1. Render-path decision: Puppeteer-direct (confirms PLAN.md §4 option (b))

PLAN.md §4 posed two options and leaned toward (b) without committing. Having now built
and load-tested both the templates and the render path, I'm confirming (b), not just
defaulting to it:

- **A carousel slide has no timeline.** HyperFrames' whole value proposition is a paused
  GSAP timeline per composition, seekable frame-by-frame, driven by `data-start`/
  `data-duration` on clips. A carousel slide is a single static frame with no narration to
  sync to and no duration to seek across. Wrapping each slide in a `data-duration="0.1"`
  composition just to call `hyperframes snapshot` on it would mean authoring against an API
  whose entire surface area (timeline registration, clip mount/unmount, relative timing
  chains) is irrelevant to the deliverable — paying the complexity tax of the video engine
  for a problem that isn't a video problem.
- **No shared runtime coupling needed.** The carousel pipeline doesn't need anything
  HyperFrames' render path provides beyond "load HTML in headless Chrome and screenshot it,"
  which is a few lines of Puppeteer. Adding the `hyperframes` CLI/package as a dependency
  here would mean every carousel render pulls in and depends on machinery (timeline seeking,
  FFmpeg muxing, `@hyperframes/producer` audio mixing) that a PNG-only deliverable never
  touches.
- **What *does* carry over unchanged**, exactly as §4 predicted: `NumberBadge`, real
  text-fit (`fitFontToBox`/`truncateToWidth`/`countWrappedLines`), and the brand-color
  rotation table are all render-path-agnostic. They're plain HTML/CSS/canvas concerns, so
  building them Puppeteer-first cost nothing we'd have to redo if a later phase ever wanted
  a HyperFrames-snapshot path instead.

Net: `carousel-engine/` is a self-contained Node + Puppeteer tool with zero dependency on
`hyperframes`/`@hyperframes/*` packages. `npm install` in this directory pulls only
`puppeteer`.

## 2. Slide kinds built

All 10 requested kinds, each a module under `carousel-engine/templates/`:
`cover`, `content`, `diagram`, `screenshot`, `cta`, `compare`, `hub`, `ranked`, `stat`,
`dsSnapshot`. Registry: `templates/index.js`.

Shared pieces (all required, all built in from the start rather than retrofitted):
- `lib/text-fit.js` — `fitFontToBox`, `truncateToWidth`, `countWrappedLines`, plus an
  `autoFit(document)` entry point. Runs **in-browser** (embedded into every rendered page),
  not estimated in Node, because real text-fit needs the real font metrics for the real
  characters via canvas `measureText` — the whole point is to not guess from character
  count. Every slide kind's fields carry `data-fit` + `data-fit-max/min/lines` attributes;
  `layout.js` embeds `text-fit.js` once per page and calls `TextFit.autoFit()` after
  `document.fonts.ready`, before `render.js` takes the screenshot.
- `lib/number-badge.js` — the `NumberBadge` component: a numbered, colored chip. Used in
  `compare` (column headers), `hub` (spoke labels), and `ranked` (row numbers) so multi-item
  slides read as "item N of M" with real numbering and a color rotation, not a flat
  monochrome list.
- `lib/colors.js` — two explicitly separate palettes: `BRAND_ACCENT` (one fixed indigo,
  used only for chrome: wordmark, page-position dots, kickers, CTA buttons) and `ROTATION`
  (8 mutually-distinct colors, deliberately excluding `BRAND_ACCENT`, used only to
  distinguish parallel items — compare columns, hub spokes, ranked rows). These are kept
  apart on purpose per the brief; conflating "brand color" and "item N's color" was the
  original bug this table exists to avoid.
- `lib/html.js` — `escapeHtml`/`escapeHtmlMultiline`, used by every template before
  interpolating real content into markup (real copy has `&`, quotes, code angle-brackets —
  lorem ipsum never exercises this path, which is part of why "prove it with real content"
  mattered here).
- `lib/layout.js` — the shared page shell: fixed 1080×1350 canvas, base typography/reset,
  and the cross-slide chrome (wordmark + page dots).

## 3. Resolution: 1080×1350 (portrait, 4:5)

Used as given in the brief — this is Instagram's current recommended carousel size (4:5
portrait maximizes vertical space in the feed vs. the older 1:1 square). `PAGE_WIDTH`/
`PAGE_HEIGHT` are defined once in `lib/layout.js`; Puppeteer's viewport is set to that exact
size with `deviceScaleFactor: 1` and each screenshot is clipped to `{0,0,1080,1350}`, so
every output PNG is exactly on-spec, not a scaled/cropped approximation.

## 4. Real end-to-end render test

**Topic**: "3 Ways to Cut API Latency in Half" (real technical content — CDN edge caching,
connection pooling, database indexing — not lorem ipsum). Full payload:
`carousel-engine/content/sample-carousel.json`.

**Command**: `node render.js` (defaults to the sample payload and `output/`).

**Result**: all 10 slide kinds rendered successfully to
`C:\Repos\HFPipleine\carousel-engine\output\slide-01-cover.png` through `slide-10-cta.png`.
Verified every PNG is exactly 1080×1350 by reading the IHDR chunk of each file.

| # | File | Kind |
|---|---|---|
| 1 | `output/slide-01-cover.png` | cover |
| 2 | `output/slide-02-content.png` | content |
| 3 | `output/slide-03-stat.png` | stat |
| 4 | `output/slide-04-diagram.png` | diagram |
| 5 | `output/slide-05-compare.png` | compare |
| 6 | `output/slide-06-ranked.png` | ranked |
| 7 | `output/slide-07-hub.png` | hub |
| 8 | `output/slide-08-dsSnapshot.png` | dsSnapshot |
| 9 | `output/slide-09-screenshot.png` | screenshot |
| 10 | `output/slide-10-cta.png` | cta |

### Visual overflow check — done by actually reading the rendered PNGs as images

I inspected every one of the 10 rendered PNGs visually (not just checked render.js exit
code). The first pass surfaced three real bugs, all fixed and re-rendered before calling
this done:

1. **CTA button label truncated** (`slide-10-cta.png`, "Save this post" → "Save this...").
   Root cause: `fitFontToBox` measured the element's box width *once*, before the
   font-size shrink loop started, using whatever font-size the element happened to be at
   pre-fit. For a content-hugging element (a pill button that sizes to its own text) that's
   circular — the "box" you're measuring is itself a function of the font-size you haven't
   set yet. Fix: `lib/text-fit.js` now re-measures the box on every candidate font-size
   inside the loop, and `templates/cta.js` gives the button a genuine `max-width` safety net
   so a pathologically long label still has a real box to truncate into.
2. **Bullet text clipped mid-line** (`slide-02-content.png`, third bullet's second line cut
   off top-to-bottom). Root cause: `fitFontToBox` assumed a flat default line-height ratio
   (1.25) for every field, but templates set real per-field CSS `line-height` (1.4–1.5 for
   readable body copy vs. ~1.1–1.2 for tight display headlines). The height budget the
   algorithm computed didn't match what the browser actually rendered, so a line the
   algorithm thought fit got clipped by the field's own `overflow: hidden`. Fix: the ratio
   is now derived from each element's own computed CSS (`lineHeightPx / fontSizePx`) instead
   of a hardcoded guess, read once before the font-size loop starts.
3. **Caption text overlapping the footer wordmark** (`slide-09-screenshot.png`). Root cause:
   the footer chrome was `position: absolute`, so it reserved no space in normal document
   flow. A template with a `flex: 1` region above it (the screenshot frame, which grows to
   fill available space) had no way to know the footer needed room, so its sibling caption's
   box extended down far enough to visually collide with the absolutely-positioned footer.
   Fix: `lib/layout.js` now wraps every slide's body in a `.slide-body` flex region
   (`flex: 1; min-height: 0; overflow: hidden`) with the footer as a normal, non-absolute
   flow sibling after it — so the footer genuinely reserves its own space and every
   template's `flex: 1` math is bounded correctly, without needing to patch each template
   individually.

After both fixes, all 10 slides were re-rendered and re-inspected: no clipped text, no
overlapping chrome, no truncation flags from `render.js`'s own end-of-run truncation report
(it prints any field the text-fit fallback had to truncate, as a build-time signal — the
final run reported none).

## 5. Notable design choices not spelled out in the brief

- **Fonts**: system font stack (`-apple-system, "Segoe UI", Roboto, Helvetica, Arial,
  sans-serif`) rather than a bundled/web font. Keeps rendering fully offline/deterministic
  (no network fetch at render time, consistent with the determinism discipline PLAN.md §0
  establishes for the video engine, applied here even though carousels aren't on that
  engine) and avoids a font-loading race before `TextFit.autoFit()` runs.
- **`screenshot` kind supports two content shapes**: a real image (`imagePath`, resolved by
  `render.js` to a `file://` URL — never fetched over the network) inside a browser-chrome
  frame, or, when no image is supplied, an HTML/CSS code-mock terminal frame from
  `codeLines`. The sample carousel exercises the code-mock path (real HTTP headers, not
  placeholder text) since sourcing a real bitmap screenshot wasn't necessary to prove the
  render path or the text-fit contract.
- Every template escapes user content through `lib/html.js` before interpolating it — real
  copy in this test topic includes en-dashes, an ampersand-adjacent construct, and quoted
  header values, which would have broken naive string interpolation.

## 6. Scope note

Nothing outside `carousel-engine/` was touched, per the instructions — no changes to
`video-engine/`, `scripting-pipeline/`, `voice-pipeline/`, `control-panel/`, or `PLAN.md`.
