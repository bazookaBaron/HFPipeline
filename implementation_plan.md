# Codex audio/QA workstream plan

Source of scope: `analysis/pacing-audit-20260924/CODEX_WORKSTREAM_PROMPT.md` in the main checkout. Work only on `codex/audio-qa`; no edits to Claude-owned files.

## Priority and ownership

1. C1: add persistent Python voice worker and Node service, backward-compatible timing, trimmed silence, tests and benchmarks.
2. C3: add measured two-pass audio mastering, tests and before/after report.
3. C4: add calibrated diagnostic pacing gate and calibration report.
4. C2: generate voice A/B artifacts and metrics without picking a winner.
5. C6: fix the five assigned components and verify with HyperFrames checks/snapshots.
6. C5: extract measured design tokens and add an openly licensed icon subset with provenance.

## Exact file scope

- [NEW/MODIFY] `voice-pipeline/**` for worker and trim tests.
- [NEW] `orchestrator/lib/video/voiceService.js`, `audioMaster.js` and dedicated tests.
- [NEW] `orchestrator/tools/pacing-gate/**`.
- [NEW] `analysis/voice-ab/**`, `analysis/pacing-audit-20260924/design/**`, `analysis/pacing-audit-20260924/CODEX_REPORT.md`.
- [NEW] `video-engine/assets/icons/**`, `video-engine/compositions/components/lib/icons.js`, `tokens-v2.css`.
- [MODIFY] only the component directories `sparkline-metric`, `gauge-meter`, `etl-pipeline`, `folder-tree`, `skeleton-loader`.

## Verification

Record per-task exact commands and results. Keep all GPU-intensive operations sequential. Preserve v1 behavior and seek-safe timelines. Run Node/Python tests, HyperFrames check and snapshots for component fixes, audio measurements, calibration across all five references and the current output, and inspect all generated A/B paths. Commit small focused changes and report hashes; no push, merge, rebase or edits to the main checkout.
