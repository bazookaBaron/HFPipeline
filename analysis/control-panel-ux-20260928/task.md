# Implementation checklist

- [ ] Slice A: reconcile persisted run statuses, refresh live job/topic views, verify restart/refresh behavior.
- [ ] Slice B: independent reel/carousel topic actions, simpler topic prompt, preserve run history, verify duplicate guards.
- [ ] Slice C: history folder actions, publish package and thumbnail/cover preparation, verify assets and disconnected-account behavior.
- [ ] Slice D: real YouTube/Instagram adapters after credentials/account authorization and platform tests are available.
- [x] 2026-09-29 instagrapi Reel slice: installed isolated `instagrapi==3.0.14`, passed read-only @vloombox preflight, uploaded the Kubernetes video once, verified media type/account/caption/hashtags/9:16 playback, and saved https://www.instagram.com/reel/Dd19I9AsByq/. Browser carousel path remains separate. This proves one controlled upload, not unattended reliability across future jobs.
- [ ] Update architecture notes and record exact tests, remaining limitations, and user decisions.

2026-09-28 checkpoint: Slice D code is locally wired, but the gate is **not** passed. YouTube OAuth/upload/thumbnail request-shape tests and Instagram media-selection tests pass; no live account upload was attempted. User chose an unofficial Instagram route, so the Meta API plan was superseded by a guarded Puppeteer desktop-browser adapter. The evaluated `instagram-private-api` npm release was removed after a failing security audit. Current control-panel process has queued jobs and was not restarted; the new routes/UI are not active yet. See `control-panel/PUBLISHING-SETUP.md`.

Follow-up: reproduced HTTP 404 from the still-running pre-change server for `POST /api/runs/cs-bebac581922f2011/prepare/instagram`; direct preparation of that same run succeeds for Instagram and YouTube. The old UI's YouTube "connected" badge is a stub token. New UI reports this accurately. User clarified the required split is **unofficial Instagram browser + official YouTube OAuth**, and requested real posting of the Kubernetes reel to both; this has **not** happened. Restart approval and real account authorization are pending.
