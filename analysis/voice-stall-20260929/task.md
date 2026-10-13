# Recovery checklist

- [x] Confirm live run/process identity and stop only its worker; keep evidence.
- [x] Isolate the voice failure to startup, synthesis, or alignment.
- [x] Add bounded worker lifetime and actionable progress/failure.
- [x] Test timeout, cleanup, normal response, and real one-sentence synthesis.
- [x] Rerun saved storyboard without Gemini calls and perform real HyperFrames check/snapshots. Check failed, so no render was attempted or claimed.
- [x] Document architecture and measured outcome, including the separate visual blockers.
