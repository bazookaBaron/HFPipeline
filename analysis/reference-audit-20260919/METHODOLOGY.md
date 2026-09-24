# Reference audit — evidence contract

Scope: five supplied reference MP4s and `cs-b9d30fa7964c0cf0.mp4`. Resumed 2026-09-24 after workers encountered an account usage limit on the original attempt. Deliverable is an analysis and implementation plan; production code is not changed by this audit. The decision includes whether a new project/architecture is warranted for fully autonomous topic-button generation.

## Measurement layers

1. Decode all native frames and retain presentation timestamps. Automated measurements are **not** proof that a model visually inspected every native frame.
2. Visually review dense, chronological 8 fps contact sheets through the entire duration of each source. Maintain a coverage ledger of sheets actually opened. Revisit ambiguous/short events using native-frame strips and larger images.
3. Log semantic content events separately from caption updates, HUD changes, continuous motion, decorative repeats, and scene replacement. Pixel differences, timeline calls, and cut detector peaks are not interchangeable with perceptual beats.
4. A continuous movement is one event with a start and a settle/end, not a new independent beat on every displaced frame. Simultaneous independently identifiable changes may have the same timestamp. Report grouped onset gaps as well as event counts so simultaneous changes do not produce a misleading zero-millisecond median.
5. At 8 fps an onset bracket is normally 125 ms wide. Native-frame inspection narrows it to one source frame (e.g. approximately 33.3 ms at 30 fps). Millisecond labels describe timestamps, not millisecond visual resolution. Do not print exact start times or durations beyond observed precision.
6. Count actual abrupt scene replacements separately from fades, in-scene changes, and detector candidates. Keep detector scores and threshold provenance.
7. Obtain real word-level ASR or verified cached alignment. ASR timestamps and sentence segmentation have uncertainty. Temporal proximity to a word does not establish intentional synchronization. Report the matching rule and unmatched events.
8. Hue counts need an explicit operational definition (saturation/value/area thresholds and hue families). Compression colors, antialiasing, mesh gradients, and semantic accents must not be conflated. Give full-canvas and content-only results where possible, with illustrative observed frames.
9. Sound transients are candidates, not confirmed sound effects: speech consonants and music can trigger them. An SFX-to-beat ratio requires listening/classification or separable source-track evidence. Report unavailable rather than invent a number.
10. Distinguish content bounds, persistent chrome, captions, and genuinely empty screen margins. A content inset does not prove a platform-safe zone.

## Motion confidence

Raster footage can support measured trajectories, durations, visible overshoot, and descriptive acceleration/deceleration. It cannot uniquely identify the original authored easing function. Exact easing names are code facts only for inspected source, not recovered reference facts. Overshoot percentages require a specified subject, baseline, final size/position, and frame evidence.

## Report provenance

Each visual assertion cites source ID and observed timestamp(s), with a contact sheet or extracted-frame path. Aggregates cite the complete underlying event/measurement table and sample count; an isolated illustrative timestamp cannot substantiate a whole-video median. Unresolved fields stay null/unavailable. Previously documented fixes are history, not newly discovered defects. Current source code and an older rendered MP4 may differ; output provenance must be checked before claiming causation.

## Source IDs

| ID | Input |
|---|---|
| ref1 | `C:/Users/debna/Downloads/igexport-DdEedoQM6j3.mp4` |
| ref2 | `C:/Users/debna/Downloads/igexport-DdG-RuwsDRc.mp4` |
| ref3 | `C:/Users/debna/Downloads/igexport-DdSc-I9IqNC.mp4` |
| ref4 | `C:/Users/debna/Downloads/igexport-DdT5wzdsQWV.mp4` |
| ref5 | `C:/Users/debna/Downloads/igexport-DdIM0QoiZre.mp4` |
| ours | `C:/Repos/HFPipleine/control-panel/data/renders/cs-b9d30fa7964c0cf0.mp4` |
