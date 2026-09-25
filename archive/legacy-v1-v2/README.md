# Retired: v1 / v2 video flows (archived 2026-09-25)

Replaced by the v3 reference-parity pipeline (`orchestrator/make-video.js` -> `generate-video-v3.js`,
renderer `video-engine/compositions/components/stage` + `lib/stage/*`, spec
`analysis/pacing-audit-20260924/design/SPEC.md`).

Kept here (not deleted) so history and ideas stay recoverable:
- `orchestrator/generate-video.js` (v1: per-scene components, post speed-up) and `generate-video-v2.js`
  (v2: one host component + event track), plus their compose/scene-plan/script/speed-up modules.
- `video-engine/components/*`: the 68 legacy sub-compositions (old motion styles), incl. Codex's C6 fixes.
- `video-engine/index.html`: the old demo root.

Nothing in the active pipeline imports these files.
