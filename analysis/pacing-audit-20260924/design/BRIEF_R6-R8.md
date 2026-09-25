# Audit brief: new reference reels R6-R8 (2026-09-25)

The user added three reels that "introduce new sections". Audit each the same way R1-R5 were audited, and focus on what
our v3 renderer CANNOT do yet.

| Id | File | Length |
|---|---|---|
| R6 | `C:\Users\debna\Downloads\igexport-DdrHAI1MrFb.mp4` | 155.6 s, 720x1280 @ 30 fps |
| R7 | `C:\Users\debna\Downloads\igexport-Ddm_kFQodJE.mp4` | 130.9 s, 720x1280 @ 30 fps |
| R8 | `C:\Users\debna\Downloads\igexport-DdkX8f9st3x.mp4` | 175.1 s, 720x1280 @ 30 fps. **Contains a real video (and possibly images) rendered INSIDE the reel.** Reverse-engineer exactly how. |

## Rules (same as R1-R5)
- **Measure, never guess.** Everything comes from real frames (ffmpeg extraction, pixel scans with Python/PIL/numpy) and cites timestamps. Report px ×1.5 in 1080x1920 space (native is 720x1280), hex colours, ms and frames (1 f = 33.3 ms), and easing inferred from per-frame deltas.
- **Method:**
  - scene-change detection (`ffmpeg select='gt(scene,0.08)'`, plus a dense 10 fps sweep);
  - contact sheets;
  - per-frame deltas across every transition;
  - row/column scans for geometry;
  - Whisper words (`C:\Repos\tts-venv\Scripts\python.exe` has whisperx / faster-whisper) for word ↔ visual anchoring;
  - ffmpeg `ebur128` for loudness.
- Work in `analysis/pacing-audit-20260924/design/R<n>/`. Keep scratch images there, and add a `.gitignore` for scratch frames except a few named evidence frames.
- Read first:
  - `analysis/pacing-audit-20260924/ANALYSIS_CHECKLIST.md` (the 36 items: answer all of them);
  - `analysis/pacing-audit-20260924/design/R2/AUDIT.md` (format and depth to match);
  - `analysis/pacing-audit-20260924/design/SPEC.md` (the consolidated spec for R1-R5, profiles DH/LC/DC).
- Our current renderer (compare against it, don't edit it):
  - card catalog `orchestrator/lib/video/v3/catalog.js`: label, micro, headline, hero, pill, banner, stat, panel, table, nodes, kpis, code, compare, bars, steps, chips, stamp, timeline, layers, tree, note, letters, slot, chart, browser, console, connector;
  - chrome: DH HUD, LC header/title/footnote/display, DC chapter/stage/serif hero, endcard;
  - modules in `video-engine/compositions/components/lib/stage/*.js`; templates in `orchestrator/lib/video/v3/templates-*.js`;
  - operator guide `orchestrator/V3.md`.
- **Do not modify any pipeline code.** Analysis only. Do not download anything, and do not copy reference-owned assets into the repo (evidence frames in the audit folder are fine).

## Deliverable per reel: `design/R<n>/AUDIT.md`
1. Header: source, format, duration, and loudness (I / LRA / TP).
2. **Style profile.** Does it match DH / LC / DC or is it a NEW profile? Give the evidence.
3. **Scene-by-scene timeline**: t0-t1, sentence(s) spoken, layout template, modules on screen, events (word-anchored with the word), and transition out.
4. The 36 checklist items (A-G) with measured values, in the R2 table format ("Reference | Our v3 | Gap | Fix").
5. **NEW COMPONENTS / SECTIONS** (the most important part). For every visual section or component not covered by our catalog, give:
   - anatomy with exact geometry, colours and type;
   - the data it carries and its variants;
   - every motion (enter / state / exit), with durations and easing;
   - how it is anchored to narration;
   - a proposed module name, a props schema, and the ops it needs.
6. Pacing numbers:
   - beats/min;
   - scene life (median / max);
   - longest hold;
   - wpm;
   - word-to-visual lead/lag.
7. A prioritised gap list for this reel.

### R8 only: the embedded media component, in its own section
- Where the media sits: frame, device mockup or card; exact rect; radius, border and shadow; any mask or crop.
- How it is scaled (cover or contain, and the zoom), and whether it moves (Ken Burns, pan, zoom punch).
- Playback: does it play in real time? At what speed? Does it loop? Is its own audio audible, or ducked under the voice? When does it start and stop relative to the narration?
- Overlays on top of it: captions, labels, pointers, highlight boxes, blur, dim.
- How it enters and exits, and what the surrounding frame is doing meanwhile.
- Whether stills (images or screenshots) are used the same way.
- Then a concrete **HyperFrames implementation recipe** for our stage:
  - a `<video>` clip, muted, with separate audio if needed, seek-safe, `data-start` / `data-media-start`;
  - an `<img>` for stills;
  - module name, props, ops, and how the frame and rect would be expressed in a storyboard.
- Evidence frames: before, during and after.

End your final message with a 10-line summary: profile, new components (names), and the top 5 gaps.
