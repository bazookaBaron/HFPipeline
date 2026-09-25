# Five-reference script and tech-topic workstream

Approved 2026-09-26. Scope is narration/script and 30-day topic generation only; no visual analysis, storyboard templates, render/voice/caption code, or branded endcard changes. Preserve every pre-existing working-tree edit, especially Claude's ongoing v3 files.

1. Verify all five media files. `DdT5wzdsQWV (1)` is byte-identical to the previously analyzed `DdT5wzdsQWV`; reuse that transcript. Transcribe the other four **locally**, with sentence/word timestamps, and mark uncertain technical terms rather than inventing corrections.
2. Write per-video phase maps and a cross-reference narrative fingerprint: hook, tension, explanatory pivots, depth progression, payoff, takeaway; timing, word density, pause and transition evidence. Separate common signals from one-off choices. No frame or visual checks.
3. Trace active v3 generation and current topic calendar. Preserve the separately appended promo/endcard. Modify only script generation and topics, with minimal changes to currently dirty v3 files; do not revert or rewrite Claude's edits.
4. Encode evidence-backed writing guidance and checks without forcing every topic into a rigid arc. Align the 30-day topic prompt with actual video length, concrete teachable mechanisms, relevance, variety and non-duplication. Preserve JSON/API contracts.
5. Run targeted tests and an offline comparison on representative prompts/fixtures; do not make speculative claims about virality or a rendered-video parity pass.

Expected files: [NEW] this analysis folder (ASR, phase maps, report), possibly new script-quality helper/tests under `orchestrator/lib/video/v3/`; [MODIFY] only relevant prompt/validation lines in `orchestrator/lib/video/v3/storyboardGen.js` if a safe non-overlapping edit is possible, `orchestrator/generate-topics.js`, and their tests. No other pipeline files.
