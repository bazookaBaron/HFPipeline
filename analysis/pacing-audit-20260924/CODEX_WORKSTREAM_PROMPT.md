# Codex workstream (30%) — audio, voice service, pacing gate, design tokens, icons, component fixes

You are one of two agents working on HFPipleine in parallel. The other agent (Claude) owns the v2
storyboard/timeline contract, composition, and pilot components. You own the workstreams below, which are
independent of that work. **Work only in your worktree and only in the files you own.**

## Where to work
- Worktree: `C:\Repos\HFPipleine-codex`, branch `codex/audio-qa` (branched from baseline commit `7a17391`).
  The main checkout `C:\Repos\HFPipleine` (branch `v2/contract`) belongs to Claude — never edit it.
- `node_modules` is not checked in; run `npm ci` / `npm install` inside `orchestrator/` (and others) in your worktree if you need them.
- Python for TTS/alignment: `C:\Repos\tts-venv\Scripts\python.exe` (F5-TTS, WhisperX, faster-whisper, librosa, torch+CUDA).
  If CTranslate2 can't find cublas, add `<venv>\Lib\site-packages\torch\lib` to the DLL path (see `analysis/pacing-audit-20260924/tools/asr.py`).
  System `python` has numpy + PIL; `ffmpeg` is on PATH.
- One GPU is shared with Claude's work. Don't start the control-panel server. Keep GPU jobs sequential, and don't leave long-lived GPU processes running when idle.
- Commit small, focused commits on `codex/audio-qa` with clear messages. Don't merge into or rebase other branches; Claude merges your branch. Never push.

## Read first
- `MOTION_PACING_PLAN.md`, `analysis/pacing-audit-20260924/{PREIMPLEMENTATION_DECISION,ARCHITECTURE_REVIEW,AUDIO_ASSETS_FEASIBILITY,MOTION_GRAPHICS_ATLAS}.md`
- `analysis/pacing-audit-20260924/evidence/*.visual_log.md` (ground-truth beat logs), `tools/*.py` (existing measurement scripts)
- The repo's HyperFrames skills under `agent/skills/` (entry point `hyperframes`, plus `hyperframes-core`, `hyperframes-animation`, `hyperframes-cli`) before touching any component.

## File ownership
**Yours (create or edit):**
- `voice-pipeline/**`
- new `orchestrator/lib/video/voiceService.js`, new `orchestrator/lib/video/audioMaster.js` (plus their tests)
- new `orchestrator/tools/pacing-gate/**`
- new `video-engine/assets/icons/**`, new `video-engine/compositions/components/lib/icons.js`, new `video-engine/compositions/components/lib/tokens-v2.css`
- components `sparkline-metric`, `gauge-meter`, `etl-pipeline`, `folder-tree`, `skeleton-loader` (their own dirs only)
- new docs under `analysis/pacing-audit-20260924/design/` and `analysis/voice-ab/`

**Not yours; do not edit:** `scripting-pipeline/**`, `orchestrator/generate-video.js`, the existing
`orchestrator/lib/video/*.js` (including `voiceSynth.js` and `speedUp.js`, which must keep working for v1), `control-panel/**`,
`video-engine/index.html`, every other component, and existing files in `components/lib/`.
If you need a change there, write it as a proposal in your final report.

## Task C1 — Persistent voice service and silence handling (highest priority)
Measured problem: each scene spawns a new `synthesize.py` process that reloads F5-TTS and WhisperX. File mtimes of
job `cs-b9d30fa7964c0cf0` give about 39 s per scene and 6.5 min for 10 scenes. F5 output also starts with 0.60–1.66 s of silence
(`video-engine/assets/generated/cs-b9d30fa7964c0cf0/scene-*.timing.json`).
1. Add a long-lived worker, e.g. `voice-pipeline/tts_worker.py`: load the models once and talk JSON-lines over stdin/stdout
   (logs go to stderr). Requests: `synthesize` {genText, outAudio, outTiming, speed, refAudio?, refText?, trim: bool}; `shutdown`.
2. Add `orchestrator/lib/video/voiceService.js` exposing `createVoiceService({log}) → {synthesize(opts), close()}`.
   `synthesize` resolves to the same shape `voiceSynth.synthesizeScene` returns today
   (`{audioPath, timingPath, wordCount, durationSeconds}`), plus `{leadTrimSeconds, tailTrimSeconds, words:[{i, w, s, e}]}`.
   `i` is a stable 0-based word index into genText's whitespace tokens.
   Keep the existing timing-JSON format backward compatible. Only add fields.
3. Silence trim (when `trim:true`): cut the audio to `max(0, firstWord.s − 0.06)` … `lastWord.e + 0.10` with 5 ms fades.
   Shift every word timestamp by exactly the lead cut and set `durationSeconds` to the trimmed length. Never cut inside a word.
4. Support multi-sentence `genText` in one call (chunk synthesis), and return per-word sentence indices.
   Benchmark 1 sentence, 3 sentences and ~8 sentences: wall time (cold and warm), real-time factor, alignment sanity
   (words monotonic, no zero-length or missing timings), and any artifacts you can detect (clipping, repeated or skipped words
   via an ASR round-trip with faster-whisper: word error rate vs genText).
5. Unit tests where feasible (Node `node:test` for voiceService framing and error paths; Python for trim math).
Deliverable: the numbers in `analysis/voice-ab/BENCHMARK.md`.

## Task C2 — Voice A/B files for the user's listening decision
Using the worker, render the same 3 real narration passages (take scenes 1, 4 and 8 text from
`video-engine/assets/generated/cs-b9d30fa7964c0cf0/scene-*.timing.json`) at F5 `speed` 1.0 / 1.2 / 1.4 / 1.6. Then run each
through the post-speed that brings delivered speech to ~200 wpm (cap 2.0), trimmed as in C1.
Save to `analysis/voice-ab/` (gitignored WAVs are fine; record paths) with a table: F5 speed, post speed, final wpm,
ASR word error rate, lead/tail silence, median inter-sentence gap (reference median ≈ 200 ms, p90 ≈ 320 ms; ours today
≈ 420/720 ms), and F0 median. **Don't pick the winner.** The user will listen and choose. Flag any pronunciation problems
you detect for technical terms (e.g. "O(1)", "O(N)", "HashDoS").

## Task C3 — Audio mastering module
Add `orchestrator/lib/video/audioMaster.js`: `masterVideo({inputPath, outputPath, speed, log}) → {code, stats}`.
It applies the video/audio speed (same filter semantics as `speedUp.js`; speed 1 = no-op) plus two-pass `loudnorm` to the
**measured reference target: −14 LUFS integrated, LRA ≤ 1.5 LU, true peak −1 dBTP** (CORRECTED 2026-09-25: measured with
`ebur128=peak=true` directly on the delivered mp4s, all 5 references are −14.1…−14.2 LUFS, LRA 1.0–1.4, peak −0.5…−1.1;
ours: v1 cs-b9d30fa7964c0cf0.mp4 −16.0 LUFS / LRA 2.9 / peak −3.1, v2-bluegreen-2.mp4 −17.1 / 2.1 / −3.2. The earlier
−17 figure came from resampled mono WAV extracts and is wrong). Measure on the final mp4, same method. Then re-measure with `ebur128` and return the stats. Also return the
percentage of 20 ms windows below −60 dBFS (references 0.1–0.2 %, ours 16.7 %) as a report metric, not something to hide.
Don't raise the whole mix to mask gaps; gaps are fixed upstream by C1's trim. Test it on the existing
`control-panel/data/renders/cs-b9d30fa7964c0cf0.mp4` (copy it; never overwrite it) and record the before/after stats.

## Task C4 — Pacing gate (calibrated detector)
Port `analysis/pacing-audit-20260924/tools/{frames,beats}.py` to `orchestrator/tools/pacing-gate/pacing_gate.py`
(CLI: `--video`, `--exclude-rect x,y,w,h` (repeatable, in fractions of frame), `--json out.json`). Fix the two known flaws:
- **Cuts:** the colour-histogram test never fires when chrome persists (it reported 0 cuts; the visual logs count 5–62).
  Detect a cut as ≥ 25 % of *non-excluded* cells changing within ≤ 2 frames. Validate against R3's 31 logged cuts and R2's 5.
- **Mascot and caption exclusion:** blinks produced 26 % of R4's machine beats. Exclude the mascot and caption rectangles.
Calibrate on all 5 references against the visual logs' beat tables: report per-video machine vs. visual beat count, median gap,
max semantic hold, and cut count, and the error of each. Also run it on `cs-b9d30fa7964c0cf0.mp4` (visual log: 37 beats,
median gap 1,230 ms, gaps > 2 s cover 74 %, 9 hard cuts, ~13.5 % empty-content frames). Metrics to output: beats/min,
gap distribution, max frozen hold (pixel-static non-excluded region), % empty-content frames, cuts/min, digital-silence %
(from audio), integrated LUFS. Document detector error in `orchestrator/tools/pacing-gate/CALIBRATION.md`.
It is a diagnostic, not an absolute pass/fail: R2 legitimately holds one scaffold ~125 s.

## Task C5 — Design tokens spec + licensed icon set
1. Finish the design-token extraction the earlier audit started (R1 frames exist in `analysis/pacing-audit-20260924/design/ref_frames/`;
   extract settled full-res frames for R2–R5 the same way: `ffmpeg -ss T -i VIDEO -frames:v 1`, with scaffold times from the visual logs).
   Measure with PIL (don't guess): palette hex per theme (dark R1/R2/R5, light R3/R4) for background, card fill, border, text
   primary/secondary, and each accent; type roles and sizes in px at 1080 width (monospace data, tracked-caps labels, heavy
   grotesk display, serif hero in R5); border width, radius, padding, gaps; caption pill spec (size, box, active-word
   treatment); chrome (HUD/progress/breadcrumb/footer page counter); character column geometry.
   Output `analysis/pacing-audit-20260924/design/DESIGN_TOKENS.md` with a frame reference per value.
   Also output a proposed, unwired `components/lib/tokens-v2.css` of CSS custom properties that uses cqmin-relative sizes, not px.
2. Add an open-licence icon subset (Lucide ISC or Tabler MIT; get it via npm or the official release) to `video-engine/assets/icons/`.
   Cover the technical concepts the references depict: server, database, browser, laptop, phone, router, cloud, lock, shield, key,
   file, folder, git branch, terminal, user(s), queue, cache, globe, cpu, alert, check, x, clock, bolt, package, network, etc.
   Include the LICENSE file and a `manifest.json` (name → file, source, version, licence). Add `components/lib/icons.js` as a
   small inline-SVG helper. **Don't copy any reference logo or brand mark.** Real product logos need separate rights and
   are out of scope.

## Task C6 — Fix five broken components (not in Claude's pilot set)
From a fresh render of all 64 components (`C:\Users\debna\AppData\Local\Temp\claude\C--Repos-HFPipleine\a6078e0f-2662-4c52-840b-42a8babe7a1d\scratchpad\gallery\stills\`):
- `sparkline-metric`: the line renders as broken dashed segments.
- `gauge-meter`: the needle covers the value text.
- `etl-pipeline`: the "events.json" chip overlaps the Load box, and icon slots are empty grey squares (use C5 icons).
- `folder-tree`: the folder name is truncated by its badge ("payments-servic").
- `skeleton-loader`: the name and title text are clipped top and bottom.
Rules: timelines are paused and seek-driven; every tween goes on the registered root `tl` at an explicit position; no
`repeat:-1`; no `Date.now`/`Math.random`; size with cqmin; keep v1 prop defaults and semantics. Verify each fix with a real
`npx hyperframes check` (0 errors) and `npx hyperframes snapshot` at entrance and settled times. Use a scratch copy of
`video-engine` for the check composition, and never edit `video-engine/index.html`.

## Reporting
Finish with `analysis/pacing-audit-20260924/CODEX_REPORT.md`. Cover what was done per task, exact commands run, measured
results, test results, commit hashes, anything that failed or was skipped, and any proposals that touch files you don't own
(e.g. how `generate-video.js` should call `voiceService`/`audioMaster`). Don't claim anything you didn't run.
Order of priority if time runs short: C1 → C3 → C4 → C2 → C6 → C5.
