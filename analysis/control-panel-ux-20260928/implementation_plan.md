# Control-panel job, topic, and publishing plan

Status: implementation in progress; local checks passed but live publishing gates remain open. The existing root `implementation_plan.md` belongs to a separate workstream and is intentionally untouched.

## User-facing outcome

1. Every run-history row has **Preview**, **Open folder**, and (when a valid finished asset exists) **Publish to YouTube** / **Publish to Instagram** actions. Failed jobs expose logs/retry, never Publish.
2. Every short-form topic row has independent **Make reel** and **Make carousel** buttons. Clicking the row itself does not launch anything. Each format has its own status and may be rerun without restarting the other.
3. The topic calendar and run history visibly refresh while the page is open, and recover correctly after a page/server restart.
4. A deliberate Publish click prepares platform-specific title, description/caption, tags, and a thumbnail/cover, validates the package, then posts through the connected account. The result URL, generated metadata, thumbnail path, account, and failure history are persisted. No automatic post on render completion.

## Current facts and defects

- `control-panel/public/app.js` `renderTopics` binds the entire row to `runTopic`, whose `POST /api/topics/:id/run` launches both pipelines. There is no per-format control.
- `loadTopics`/`loadHistory` run at page startup and selected completion events; there is no background refresh of every row. `control-panel/server.js` reconciles a topic only when `/api/topics` is fetched.
- `control-panel/lib/jobs.js` stores live status only in memory. `control-panel/lib/store.js` persists run records, but active work can appear stale after restart. `runSummary` prefers live status when available.
- `control-panel/public/app.js` already has `showOutputFolder`; `control-panel/server.js` already has a renders-root-scoped `/api/open-folder`. History rows do not expose it.
- `control-panel/lib/publish.js` always throws 501. `control-panel/lib/oauthYoutube.js` is a simulated OAuth flow. There is no actual Instagram connection or upload.
- `orchestrator/lib/longform/thumbnail.js` already creates long-form thumbnail variants. Short reels need their own 9:16 cover and YouTube-compatible thumbnail treatment; carousel's first slide can be used as an Instagram cover only after validation.

## Slice A — truthful, continuously updated jobs

**[MODIFY]** `control-panel/server.js`, `control-panel/lib/jobs.js`, `control-panel/lib/store.js`, `control-panel/public/app.js`, `control-panel/public/index.html`, `control-panel/public/styles.css`.

- Expose authoritative persisted per-run status, stage, timestamps, and last heartbeat. Keep SSE for low-latency logs; poll `/api/runs` and `/api/topics` every 5–10 seconds and on window focus/visibility return. Back off when hidden/offline and mark last-updated time.
- On server startup reconcile nonterminal persisted runs: restore a verifiably live tracked child or mark it `interrupted`/actionable; do not silently display `running` forever or relaunch it. Add an explicit recover/retry action later, not an automatic duplicate job.
- Topic status is derived from its reel and carousel runs independently: e.g. reel succeeded / carousel failed. Keep `rendered`, `approved`, and `published` separate. Avoid resetting a successful asset when the other fails.
- Emit structured stages from the run path instead of inferring progress only from console prose; show queue position, script, voice, render, QA, completed/failed.

**Gate:** start one reel and one carousel, navigate away/reopen, disconnect SSE, restart server during a test job, and verify no stale `running` or `queued` badges; compare UI with persisted records and output existence.

## Slice B — separate topic actions and simpler ideas

**[MODIFY]** `control-panel/server.js`, `control-panel/lib/topics.js`, `control-panel/public/app.js`, `control-panel/public/index.html`, `control-panel/public/styles.css`, `orchestrator/generate-topics.js`, `orchestrator/tests/generate-topics.test.js`.

- `POST /api/topics/:id/run` accepts an explicit `pipeline: "cs-explainer" | "carousel"` and creates only that job. Reject unknown/duplicate active format requests; permit an explicit rerun of a finished/failed format and retain prior run history.
- Replace whole-row click-to-run with buttons and independent statuses/previews. Keep the row navigable for details only. Video and carousel results get direct links.
- Prompt topic generation for beginner-friendly, one-concept viewer titles; preserve a separate technical angle/brief for the storyboard so simpler wording does not reduce accuracy. Add validation/examples and edit/regenerate-one controls. Preserve completed calendar entries and their run associations when refreshing pending topics.

**Gate:** each button starts exactly one job; a second click while queued/running creates no duplicate; a reel failure does not mark the carousel failed; 30 generated titles pass a human-readable jargon review and still have usable technical briefs.

## Slice C — completed-job actions and package preparation

**[MODIFY]** `control-panel/public/app.js`, `control-panel/public/index.html`, `control-panel/public/styles.css`, `control-panel/server.js`, `control-panel/lib/store.js`.

**[NEW]** `control-panel/lib/publishPackage.js` plus tests; short-reel cover/thumbnail generator under `orchestrator/lib/video/` plus tests if the long-form renderer is unsuitable.

- History row has an **Open folder** button using the existing scoped endpoint: MP4 -> parent directory with file selected if supported; carousel -> its image directory. Never accept arbitrary client paths. Preview stays a separate action.
- Generate platform-specific metadata from the actual produced script/storyboard and rendered asset, not only the short topic string. Validate title/description/tag lengths, obvious placeholders, facts, asset presence and rights. Persist a versioned package so a retry does not regenerate inconsistent metadata.
- Before any upload, generate and validate thumbnail/cover. For YouTube, use a compatible landscape thumbnail or an approved vertical Shorts fallback, depending on the channel's actual presentation. For Instagram Reel, prepare a vertical cover/cover frame; for carousel, validate first-slide cover. Avoid unsupported assumptions about API cover behavior.
- UI displays thumbnail and generated metadata within the publishing state. A single explicit user Publish action begins preparation and posting; no post starts just because rendering completed. On missing account/rights/asset, stop with a concrete error, not fake success.

**Gate:** local deterministic package tests and visual inspection of generated covers for reel, carousel, and long-form; verify history folder links and paths; verify nothing uploads with disconnected accounts.

## Slice D — real platform adapters

Update (2026-09-28): The user explicitly chose an **unofficial Instagram route only**, superseding the Meta API portion below. The guarded implementation now uses the existing Puppeteer desktop browser rather than the audited-vulnerable `instagram-private-api` package. Keep the live-account verification gate; do not interpret local request-shape tests as proof of a successful Instagram Reel or carousel. YouTube remains on its supported OAuth/upload API and defaults to private.

Update (2026-09-29): The user approved a local `instagrapi` prototype using the already-saved `@vloombox` browser session. Add a private-API Reel adapter alongside the browser path, not a blind replacement. First perform a read-only account preflight, then upload the specific 1080×1920 Kubernetes MP4 once as a regular Reel without a custom cover. Persist an unknown outcome before network upload, verify the returned media is a Reel on the intended account, and never auto-retry an ambiguous result. If Instagram rejects browser-session reuse, stop and request a separate local sign-in; do not print cookies or passwords. The existing browser path remains a fallback until the new adapter is live-verified.

Result (2026-09-29): Preflight authenticated @vloombox. `instagrapi` returned Reel `Dd19I9AsByq`; the public Reel page independently showed @vloombox, the reviewed caption and hashtags, and a 720×1280 stream displayed at portrait ratio. A captured playback frame showed full-height content, not the prior square crop. Package state is `complete` with its permalink. Future unattended reliability and account-challenge handling remain unproven.

**[MODIFY]** `control-panel/lib/publish.js`, `control-panel/lib/oauthYoutube.js`, `control-panel/server.js`, `control-panel/public/app.js`, `control-panel/public/index.html`.

**[NEW]** a real Instagram account connector, credential storage boundary, YouTube/Instagram publishing adapters, idempotency/publish-record tests.

- Replace simulated YouTube OAuth with the real server-side authorization-code flow and securely stored refresh credentials. Identify/display target channel before Publish. Implement resumable video upload, metadata, and `thumbnails.set` after the video ID exists; verify processing/post status and save URL. A partial success (video uploaded, thumbnail failed) must retain video ID and retry only the thumbnail.
- Connect an eligible Instagram professional account. Implement the supported media-container -> processing-status -> publish flow for Reels and carousels. Solve access to local assets by a scoped temporary media URL or a supported upload method; do not expose the full renders directory publicly. Save container/media IDs and final URL.
- Add idempotency per `(runId, platform, account, assetVersion)`; reconcile unknown outcomes before retrying to avoid duplicate public posts. Store `preparing`, `uploading`, `processing`, `published`, `partial`, `failed`, timestamp, account and remote IDs. Publishing is an external write and should be explicitly initiated from a completed job.
- Never mark `published` from an HTTP request alone: verify remote ID/state. Keep local package and failed response for diagnosis without logging tokens.

**Gate:** sandbox/private-account test for each platform; force token expiry, network loss, thumbnail upload failure, and duplicate clicks; confirm one remote post at most and correct history URL/status. Public-account release only after the user connects the intended accounts and approves a test post.

## Dependencies and user decisions

- Real posting is blocked until the intended YouTube channel and Instagram professional account, OAuth/app credentials, scopes/review status and asset rights are available. Current `publish.js` and OAuth UI cannot do it.
- Need product choice for the precise public-post behavior: immediate public post after one Publish click, or metadata/thumbnail preview with a second confirmation. The wording of this request leans toward one-click posting, but a confirmation is safer for irreversible external publication.
- YouTube upload and custom-thumbnail endpoints: https://developers.google.com/youtube/v3/docs/videos/insert and https://developers.google.com/youtube/v3/docs/thumbnails/set . Meta-operated Instagram API collection: https://www.postman.com/meta/instagram/folder/y6xustx/reels-publishing . Recheck live platform constraints when implementing.

## Out of scope

- No automatic publishing on render completion, bulk posting, scheduling, or copying reference-owned images/music/characters.
- No changes to the active video rendering model in these UI/publishing slices.
