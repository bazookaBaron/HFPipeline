# Codex workstream report — 2026-09-25

Scope: `CODEX_WORKSTREAM_PROMPT.md` C1–C6. All implementation is in isolated worktree `C:\Repos\HFPipleine-codex`, branch `codex/audio-qa`; Claude's `C:\Repos\HFPipleine` checkout was read-only. Nothing was pushed or merged. This is an implementation handoff, **not** proof that button-click generation now yields reference-equivalent videos. See `system_architecture.md` for wiring and release caveats.

## Completed work and measured outcomes

| Task | Files / result | Commit | Acceptance status |
| --- | --- | --- | --- |
| C1 persistent voice | `voice-pipeline/tts_worker.py`, `orchestrator/lib/video/voiceService.js`; one resident F5/WhisperX worker, JSON-lines, stderr-only logs, errors, word-indexed backward-compatible timing, exact lead shift and 5 ms fades | `e5142f0` | Unit tests 6 Python + 2 Node pass; real synth and real Node→Python call passed. Cold 1-sentence call 212.57 s; warm 3/8-sentence calls 17.24/37.95 s. Internal sentence gaps still too long; not wired to production. |
| C2 voice A/B | `analysis/voice-ab/BENCHMARK.md`, 12 local `*-post.wav` choices (scene 1/4/8 × F5 1.0/1.2/1.4/1.6) and metrics JSON | `e5142f0` | Rendered at ~200 WPM final, no winner selected. ASR has technical-term uncertainty (`O(1)`, `O(N)`, `HashDoS`); user listening required. WAVs are gitignored but present in this worktree, so preserve/copy them before deleting it. |
| C3 mastering | `orchestrator/lib/video/audioMaster.js`; two-pass loudnorm after compressor, matching video/audio speed and delivered-MP4 measurement | `66858cf`, corrected `0cc5bfc` | Source MP4 −16.0 LUFS / 2.9 LRA / −3.1 dBTP / 13.25% quiet. Corrected speed-1 output −14.0 / 1.5 / −1.6 / 9.20%. Five tests pass. Earlier −17 LUFS output files are obsolete. Mastering does not eliminate narrative pauses. |
| C4 pacing diagnostics | `orchestrator/tools/pacing-gate/pacing_gate.py`, tests, six JSON results and `CALIBRATION.md` | `db01af8` | Four unit tests pass. Compared with visual beat/cut logs for R1–R5 and current output; error is large and inconsistent (R1 beats +83%, R5 +128%, R3 cuts −18, R5 cuts +35). **Not safe as a hard automatic QA gate.** |
| C5 design and icons | `design/DESIGN_TOKENS.md`, seven measured native 720×1280 frames and sampling script; proposed unwired `tokens-v2.css`; 30 local Lucide SVGs, license, manifest, generated `icons.js` | `5d2e211` | All 30 SVGs parse as XML; icon JS and generator pass `node --check`. CSS values distinguish measured raster samples from estimates/proposals. No reference logos or mascot art copied. |
| C6 component fixes | `sparkline-metric`, `gauge-meter`, `etl-pipeline`, `folder-tree`, `skeleton-loader` | `5b3ddf3` | Pinned `hyperframes@0.8.46 check --json` in isolated scratch project: 0 lint/runtime/layout/motion/contrast errors; 10 snapshots inspected at entrance/settled moments. ETL uses self-contained inline SVG technical symbols; it does **not yet import** the newly packaged Lucide helper, to keep the v1 subcomposition standalone. |

The five references were read from `C:\Users\debna\Downloads\igexport-*.mp4` and the pipeline render from `C:\Repos\HFPipleine\control-panel\data\renders\cs-b9d30fa7964c0cf0.mp4`. Saved C4 JSON records each exact filename and mask. A prior claim that the MP4 files were inaccessible was incorrect; they were present and measured.

## Commands actually run / verification

```powershell
node --test orchestrator/lib/video/voiceService.test.js orchestrator/lib/video/audioMaster.test.js orchestrator/lib/video/audioMaster.integration.test.js
C:\Repos\tts-venv\Scripts\python.exe -B -m unittest -v test_tts_worker.py                         # from voice-pipeline
C:\Repos\tts-venv\Scripts\python.exe -B -m unittest discover -s orchestrator\tools\pacing-gate -p test_*.py -v
C:\Repos\tts-venv\Scripts\python.exe analysis\pacing-audit-20260924\design\measure_tokens.py
node --check video-engine\compositions\components\lib\icons.js
node --check video-engine\assets\icons\generate-subset.cjs
node -e "const {masterVideo}=require('./orchestrator/lib/video/audioMaster'); masterVideo({inputPath:'analysis/pacing-audit-20260924/design/audio-master-benchmark/source-copy.mp4',outputPath:'analysis/pacing-audit-20260924/design/audio-master-benchmark/mastered-speed1-v3.mp4',speed:1}).then(x=>console.log(JSON.stringify(x)))"
```

Latest suites: 7/7 Node tests, 6/6 worker Python tests, 4/4 pacing Python tests pass. Audio direct run returned `{integratedLufs:-14,loudnessRangeLu:1.5,truePeakDbtp:-1.6,silenceBelowMinus60Pct:9.2049}`. Separate C1 real-worker integration and A/B commands, C4 six video commands, and C6 HyperFrames check/snapshot paths and detailed measurements are recorded in the task-specific reports. The component scratch project is under `C:\Users\debna\AppData\Local\Temp\hf-c6-5d1bc8c46a524a80813ad4136cfa9b1d\c6-project`. Its ten snapshots were viewed in contact sheets. Do not interpret absence of a checked-in reference render as a visual equivalence pass.

## Required integration and remaining decisions (Claude-owned files)

1. In `orchestrator/generate-video.js`, create one `createVoiceService({log})` per job, use its `synthesize` result for all scenes/chunks, consume **trimmed shifted** timing for captions, and close in `finally`. Keep v1 `voiceSynth` as a feature-flag fallback. The worker currently serializes calls; do not parallelize requests to one GPU model. Handle worker crash explicitly.
2. Use `masterVideo({inputPath:draftPath,outputPath:finalPath,speed,log})` as the final speed/mastering stage. Distinct paths are required; do not overwrite the original. Record returned MP4 stats and reject outputs that fail loudness/peak criteria, but allow for codec variability and test more than one content type.
3. Choose the voice profile only after listening to all 12 `*-post.wav` files, with technical pronunciation and internal sentence pauses reviewed. The persistent worker reduces model reload overhead but does not by itself solve cadence or the remaining 9.20% quiet windows in the mastered old render.
4. Do not activate C4's numeric beat/cut thresholds as a gate. Improve detector calibration against manually annotated cuts, differentiate semantic holds from ambient motion, and validate mask geometry. Until then use it for triage plus visual QA.
5. Decide whether to load the local icon helper and proposed tokens in the v2 composition/host. `video-engine/index.html`, the composition contract, the control panel, scripting pipeline, and all Claude-owned files were intentionally not modified. Recheck every component after those integrations, using the project-pinned CLI version `0.8.46` (a later `0.8.72` was available but not introduced here).
6. Run an end-to-end button-click generation through the merged v2 pipeline, measure the delivered MP4 and inspect its frame-level pacing, audio and assets against the reference logs. This has **not** been done on this branch, so the user's final autonomy and “exactly this kind” goal remains unverified.

No automatic architecture-rewrite decision follows from these isolated modules. The existing system can plausibly be evolved, but that claim requires a merged end-to-end pilot and quality review; a new project from scratch is not justified by this workstream alone.
