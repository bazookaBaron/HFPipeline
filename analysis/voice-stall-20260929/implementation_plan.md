# Voice stall recovery and future bounds

Approved by user on 2026-09-29: stop the stalled AI-image run, retain its files, fix the voice path, and rerun without another Gemini storyboard generation.

## Evidence and scope

- Run `cs-0a9d0b20adb2b7a1` completed `script` after 237.665 s, then produced no WAV, timing JSON, or progress after 18:37:52 local time. The Python worker started at that time and consumed CPU for hours; the exact internal import/inference step is not yet proven.
- The in-memory `voiceService` request has no timeout. A silent worker therefore leaves `generate-video-v3.js` awaiting the first sentence forever and the control panel incorrectly showing an indefinitely running job.
- Preserve the original storyboard, metrics, log, and run record. Do not restart the control-panel server or disturb other jobs.

## Changes

- [MODIFY] `orchestrator/lib/video/voiceService.js`: bound worker startup/first response and each request; on timeout close/terminate the worker and reject pending requests with an actionable error. Avoid silently skipping speech or leaving orphaned descendants. Surface worker stderr and timeouts without secrets.
- [MODIFY] `orchestrator/generate-video-v3.js`: log start/completion of each sentence; ensure voice failures close the service and metrics show a failed voice stage. Keep saved storyboard replay supported.
- [MODIFY] `orchestrator/make-video.js`: allow an explicit saved storyboard for a no-Gemini rerun; preserve normal checks, render, mastering, and gates. Do not overwrite the failed run's evidence.
- [MODIFY] `orchestrator/lib/video/voiceService.test.js`: exercise a nonresponding worker, timeout, cleanup, and a succeeding local mock worker. Keep real TTS tests separate.
- [NEW] `analysis/voice-stall-20260929/recovery_notes.md`: exact stop target, isolated voice probe results, verification, output, and remaining limits.
- [MODIFY] `system_architecture.md`: document the bounded worker contract and storyboard-reuse recovery path.

## Gates

1. Record current run/process identity, confirm it is the only active job, and stop only its voice worker. Verify the control panel marks the run failed and evidence remains.
2. Reproduce with an isolated, one-sentence voice request; measure startup and record whether CUDA, F5 load, synthesis, or WhisperX alignment is the slow step. Do not start another full job before this passes.
3. Run the worker unit tests, syntax checks, and a real one-sentence synthesis. Verify timeout fails within a bounded interval when the worker is deliberately nonresponsive.
4. Rerun the saved storyboard to a new output path with no Gemini script call. Require real HyperFrames check, render, output probe, and final gates. Report any failure rather than calling it done.

No software can guarantee every future TTS succeeds. The guarantee targeted here is that an unresponsive worker becomes a bounded, visible failure rather than an indefinitely running job.
