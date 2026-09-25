# Reference-video analysis checklist (what must be known to generate this kind of video)

Every item must be answered per reference video (R1–R5) with measured values (px at 1080×1920, hex colours,
ms, easing) and cited timestamps/frames, then compared against our current v2 output
(`orchestrator/output/v2-bluegreen-2.mp4`). "Not assessable" is allowed only when the frames truly can't show it.

## A. Frame architecture & layout
1. **Safe zones**: clear top/bottom/side margins (px), where content may and may not go.
2. **Grid/columns**: column structure (e.g. character column + content column), gutters, alignment axes.
3. **Content bounding box per scaffold**: position, size, % of frame filled, vertical centre of mass.
4. **Scaffold layout templates**: the recurring arrangements (title-top + diagram + footnote, card row + detail slot, split screen, big-number screen, table view …) with exact geometry.
5. **Visual hierarchy**: what is read first/second/third; size ratios between headline, body, labels.
6. **Spacing rhythm**: gaps between cards/rows/sections, internal padding, consistency.

## B. Persistent chrome
7. **HUD/status bar**: anatomy (label, pill, metrics), size, position, typography, how and when its values change.
8. **Chapter/progress/step indicators, breadcrumbs, page counters, footers, section labels**: anatomy, position, update behaviour.
9. **Character (mascot)**: size, position, poses/states, blink/mouth cadence, scale punches, entrances/exits, when hidden, overlap rules with content.
10. **Captions**: box/pill style, font, size, position, words per chunk, karaoke colours, swap timing, gap behaviour.

## C. Visual design system
11. **Palette** per theme (hex): background, surfaces (1–3 levels), borders, text tiers (primary/secondary/muted), accents, semantic state colours (ok/warn/error/info/idle), and how many hues appear simultaneously.
12. **Typography**: families by role (display/headline, UI sans, mono data, serif hero), size scale in px, weights, case, letter-spacing, line-height; how much text per frame.
13. **Card/panel anatomy**: fill, border width/colour, radius, shadow/glow, header/window chrome (traffic lights, URL bars, tabs), internal padding, row structure, dividers.
14. **Pills/badges/chips/tags**: shapes, sizes, fills vs outlines, dot indicators.
15. **Iconography & imagery**: icon style (line/filled), stroke weight, size, containers (tiles), logos, illustrations, photos, maps, avatars.
16. **Lines/connectors/arrows**: stroke weights, dash patterns, elbows vs curves, arrowheads, ghost/inactive vs active styling, edge labels.
17. **Charts/numbers/tables**: chart types, gridlines, axis labels, big-number styling, table row styling.
18. **Data realism**: IDs, URLs, versions, ports, metrics, logs, code; specificity and consistency with narration.
19. **Background treatment**: flat/gradient/grid/dots/vignette/noise; does it ever change or move.

## D. Module catalog (component library)
20. **Every distinct graphic module** across the video: anatomy, variants, what data it carries, how it is re-used and re-skinned, how modules combine within one frame.

## E. Motion system
21. **Entrance recipes** per element class: animated properties, travel distance (px), duration (ms), easing curve, stagger interval, what enters together vs sequentially.
22. **State-change recipes**: recolour, badge/status flip, counter/number change, text swap, check/tick, strike, fill/progress, highlight.
23. **Emphasis recipes**: highlight ring, pulse, stamp, flash, scale punch, glow — duration and amplitude.
24. **Exit and scene-transition recipes**: hard cut, crossfade, push, zoom reframe, element-by-element exit; what persists across the transition; how the next scaffold builds (order, timing).
25. **Process/ambient motion**: packets, traffic, typing, cursors, progress bars, loops — speed, period, spacing, when it stops.
26. **Camera**: zooms/pushes/pans/reframes, duration, easing.
27. **Choreography**: build order inside a scaffold, overlapping staggers, front-loading vs spread, what moves during holds.

## F. Timing & narration sync
28. **Beat density**: gap distribution, longest holds, scaffold lifetime, build time vs hold time.
29. **Word anchoring**: which words trigger which beat types; lead/lag vs the word; free-running beats.
30. **Sentence-type → visual treatment rules**: enumeration → per-item pops; number → counter/big number; negation → strike; cause/effect → connector/packet; state → recolour; etc.

## G. Narrative / storyboard
31. **Structure**: hook (first 3 s), acts, escalation, resolution, ending (last 5 s).
32. **Scaffold selection and transitions**: when a scaffold is kept and mutated vs replaced; how many scaffolds per minute; callbacks to earlier scaffolds.
33. **Entity continuity**: names, colours, positions held across scaffolds.

## H. Audio
34. **Voice**: timbre, pitch, pace, pauses, emphasis.
35. **Music bed / SFX / mix**: presence, density, which visual events carry sound, loudness (measured on the mp4s: −14.1…−14.2 LUFS, LRA 1.0–1.4, peak ≈ −1).

## I. Production
36. **Export**: resolution, fps, compression; determinism and render cost of reproducing it.

## Output of the analysis
- Per video: a filled checklist with measurements + frame references (`design/<KEY>/`).
- Cross-video: the shared **design system spec** (tokens), **layout templates**, **module catalog**, **motion spec**,
  and **storyboard rules**, each marked "shared by all 5" or "style-specific (which videos)".
- **Gap matrix**: every checklist item, reference value vs our v2 value, and the exact change needed (tuning vs new
  module vs new capability) — the implementation backlog.
