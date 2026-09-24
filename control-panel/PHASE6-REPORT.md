# Phase 6 Report — Control Panel

Local browser control panel at `control-panel/`, built to match the old repo's bar: plain
HTML/JS (`public/`) served by a small Node server (`server.js`, core `http` module only, zero
npm dependencies) with a JSON-file-backed run history. No frontend framework, no database.

Run it with:

```bash
cd control-panel
node server.js          # binds 127.0.0.1:4600 (override with PORT env var)
```

Then open `http://127.0.0.1:4600/`.

## What's real

### 1. CS-explainer render → video-engine (the required real end-to-end path)

`lib/renderEngine.js` shells out to the **actual** `video-engine` project's pinned CLI:

```
npx --yes hyperframes@0.8.46 render --output <path> --quality draft --variables-file <path>
```

run with `cwd` = `video-engine/`, i.e. exactly the Phase 1 hardcoded composition
(`video-engine/index.html`), not a copy or a mock. stdout/stderr are piped line-by-line into
`lib/jobs.js`'s job-state object and pushed to the browser live over Server-Sent Events
(`GET /api/runs/:id/stream`). Nothing about the render or the log stream is simulated.

**Confirmed with a real run** (see "End-to-end test" below): a genuine `hyperframes` render
process ran, produced a 420,505-byte MP4 at
`control-panel/data/renders/cs-efa907c61dede3d4.mp4`, and its real log lines (compiler output,
`[Render:trace]` phase events, frame-capture progress bars, the final
`100% Render complete` / file-size / timing summary) streamed into the browser DOM live via
`EventSource`, confirmed by both `curl -N` against the SSE endpoint and by driving the actual
page in a browser and reading the live-updated DOM.

The CS-explainer form's fields (topic, length, accent color, brand handle, TTS speed,
captions/SFX toggles) are written to a `--variables-file` JSON passed to the render. **They
currently have no visible effect on the output** — `video-engine/index.html` (Phase 1) doesn't
yet declare any `data-composition-variables`, so HyperFrames accepts the file but nothing reads
it. This is intentional forward-compatibility, not a bug: once video-engine's composition
declares matching variables (Phase 2/3 work), the same code path picks them up unchanged.

### 2. Carousel render → carousel-engine (real, discovered opportunistically)

`lib/carouselEngine.js` checks **at request time** (not just at server start) whether
`carousel-engine/render.js` and `carousel-engine/node_modules/` exist, mirroring the brief's
own instruction for the voice-clone trim utility ("check for it, don't wait if it's not there
yet"). At the start of this session carousel-engine had no `render.js` (confirmed directly —
only `package.json`, `lib/`, empty `content/`). By the time this control panel was tested,
the parallel Phase-5 agent had finished it, and the dynamic check picked it up for real: a run
shelled out to `node render.js content/sample-carousel.json <outDir>` and produced 10 real PNG
slides via carousel-engine's actual Puppeteer renderer (confirmed on disk — see test log below).
If carousel-engine ever regresses to a non-runnable state (e.g. mid-refactor), the same code
path falls back to an honest `"stubbed"` job status instead of faking an image — this path is
implemented and would trigger automatically, it just didn't fire during this session's final
test because carousel-engine happened to be ready.

### 3. Everything else that is genuinely real

- **Run history**: `data/runs.json`, atomic-write JSON array, no database. Survives server
  restarts (in-memory job state does not — see below).
- **Live log streaming**: real Server-Sent Events (`text/event-stream`), not polling — the
  brief's "SSE polling a job-state object" is implemented as push-based SSE over an in-memory
  job-state object (`lib/jobs.js`), which also replays the log backlog to a browser tab that
  connects (or reconnects) after a job already produced output.
- **Result preview**: real `<video>` playback (with HTTP Range support for seeking) for
  CS-explainer runs, and a real image gallery for carousel runs.
- **Review-and-publish panel**: title/caption/hashtags are genuinely editable and persisted to
  `data/runs.json` via `POST /api/runs/:id/review`.
- **YouTube reconnect flow shape**: the full click → redirect → consent page → callback →
  "reconnected" round trip is real HTTP (302 redirects, a server-rendered consent page, a form
  POST, token persisted to `data/oauth/youtube.json`). Only the Google-side token exchange is
  stubbed (see below).
- **Voice upload**: real file upload, real storage, real `ffprobe` duration measurement.

## What's stubbed (explicit list)

| Endpoint / feature | Behavior | Why |
|---|---|---|
| `POST /api/runs/:id/publish/youtube` | Returns **HTTP 501** with `{"error": "Publishing to YouTube is not implemented yet (Phase 7). This endpoint is a clearly-marked stub -- no video/image was uploaded anywhere."}` | Real publish integration is Phase 7 per the brief. |
| `POST /api/runs/:id/publish/instagram` | Returns **HTTP 501**, same shape, Instagram-specific message. | Same. |
| `lib/oauthYoutube.js` → `exchangeCodeForToken()` | Fabricates a fake token (`stub_access_...`, 5-minute TTL) instead of calling Google's OAuth token endpoint. Everything around it (state validation, redirect, consent page, storage, status/expiry display) is real. | Real Google OAuth requires real client credentials (Phase 7). The function is isolated so dropping in a real implementation needs no redesign. |
| `GET /oauth/youtube/consent` | Server-rendered placeholder page, explicitly labeled `PLACEHOLDER SCREEN` in a yellow banner, simulating Google's consent screen. | No real Google OAuth app/client ID exists yet. |
| `POST /api/oauth/youtube/expire` | Test-only helper that force-expires the stub token so the "reconnect required" UI path can be demonstrated without waiting on a real token's lifetime. Clearly named and documented as a test utility, not part of the real flow. | Makes the reconnect-required path observable/demoable on demand. |
| Voice-clone auto-trim (`lib/voiceUpload.js`) | Upload is accepted, stored, and its duration is probed and shown, but **no trimming happens**. The UI reports `trimStatus: "not_yet_wired"` and the exact reason. | Checked `voice-pipeline/` directly: it has an internal `trim_reference_clip()` helper inside `synthesize.py`, but that only runs as a side effect of a full F5-TTS + WhisperX synthesis call (loads the model onto the GPU) — there is no standalone trim-only entrypoint to call for a lightweight "trim this upload" action. Per the brief's fallback instruction, this is stubbed rather than silently invoking a heavy, unrelated pipeline (or reimplementing trim logic that wasn't asked for). `hasStandaloneTrimUtility()` re-checks at call time (looking for `trim.py`/`trim_cli.py`/`trim_reference.py`) so it will wire itself up automatically if voice-pipeline adds one later. |
| Carousel render (conditionally) | Falls back to a `"stubbed"` job status with an honest log message if `carousel-engine/render.js` or its `node_modules/` are missing at call time. | carousel-engine is a parallel Phase 5 project; this path exists for whenever it's mid-refactor or not yet started, even though it happened to be ready by the time of final testing. |

No endpoint anywhere fakes success or returns a plausible-looking result for something that
didn't happen — every stub either does nothing and says so, or returns a non-2xx status with an
explicit "not implemented yet" message.

## End-to-end test: real render, real streamed logs

Performed twice — once via `curl` against the raw API, once by actually clicking the "Run
render (real)" button in a live browser session and reading the DOM as it updated.

**curl test** (after fixing a real bug found by this exact test — see below):

```
$ curl -s -X POST http://127.0.0.1:4600/api/runs -H "Content-Type: application/json" \
    -d '{"pipeline":"cs-explainer","config":{"topic":"How hash maps work", ...}}'
{ "id": "cs-efa907c61dede3d4", ..., "streamUrl": "/api/runs/cs-efa907c61dede3d4/stream" }

$ curl -s -N http://127.0.0.1:4600/api/runs/cs-efa907c61dede3d4/stream
event: log
data: {"line":"$ npx --yes hyperframes@0.8.46 render --output ... --variables-file ..."}
event: log
data: {"line":"◆  Rendering video-engine → C:\\Repos\\HFPipleine\\control-panel\\data\\renders\\cs-efa907c61dede3d4.mp4"}
...
event: log
data: {"stream":"stderr","line":"[INFO] [Render] Pipeline started {\"renderJobId\":\"fe6a0cb1-...\", ...}"}
...
event: log
data: {"line":"  █████████████████████████  100%  Render complete"}
event: log
data: {"line":"   410.6 KB · 11.5s video · rendered in 21.1s"}
event: log
data: {"line":"Render exited 0. Output: C:\\Repos\\HFPipleine\\control-panel\\data\\renders\\cs-efa907c61dede3d4.mp4 (420505 bytes)"}
event: status
data: {"status":"succeeded","result":{"type":"video","path":"...","bytes":420505,"mediaUrl":"/media/cs-efa907c61dede3d4.mp4"}}
```

Verified on disk: `control-panel/data/renders/cs-efa907c61dede3d4.mp4`, 420,505 bytes.
Verified served correctly: `GET /media/cs-efa907c61dede3d4.mp4` → `200`, `Content-Type: video/mp4`.

**Browser test**: navigated to `http://127.0.0.1:4600/`, clicked "Run render (real)" on the
CS-explainer form, and polled the live DOM. The log console filled with real lines in real
time — `[Compiler] Fetched 11 font face(s) for "Inter" from Google Fonts`, `[BrowserManager]
Browser launched (HeadlessChrome/152.0.7977.30, ...)`, frame-capture progress — ending in
`status: succeeded` and the `<video>` element's `src` set to
`http://127.0.0.1:4600/media/cs-d04de83765cb445f.mp4`, confirmed non-hidden and playable.

Also exercised end-to-end in the same browser session: the carousel pipeline (real
carousel-engine render producing 10 PNG slides, shown in a live gallery), the review/publish
panel (edited caption/title/hashtags, saved, then hit both publish stubs and saw the 501
messages verbatim in the UI), the YouTube reconnect flow (click → redirected to the stub
consent page → clicked "Authorize (stub)" → redirected back → status changed to "Connected
(stub)"), the force-expire test control (status flipped to "reconnect needed"), and a voice
reference upload (used `video-engine/assets/narration.wav` as a stand-in clip; got back
`durationSeconds: 10.624`, `trimStatus: "not_yet_wired"` with the explanation above).

### A real bug this test caught and fixed

The first render attempt failed with exit code 1: `✗ Invalid JSON in --variables / Expected
property name or '}' in JSON at position 1`. Root cause: `renderEngine.js` originally passed
`--variables '<json>'` inline through `child_process.spawn(..., { shell: true })`, which is
required on Windows to resolve `npx.cmd`, but `cmd.exe`'s argument requoting mangled the JSON
string's embedded quotes. Fixed by writing the variables to a temp JSON file
(`<jobId>.variables.json` in `data/renders/`) and passing `--variables-file <path>` instead —
a plain path has no quoting hazard. Confirmed fixed by a second real run (the one quoted
above), which completed successfully.

A second, unrelated observation from that same first run: the render's own pre-flight lint
reported `missing_or_empty_sub_composition` for `compositions/browser-window.html` (it existed
moments earlier, then disappeared — the parallel video-engine agent was mid-refactor,
confirmed by re-listing `video-engine/compositions/`, which now contains a `components/`
subdirectory instead). This is not a control-panel bug: HyperFrames' render CLI treats it as a
non-fatal lint warning ("Continuing render despite lint issues") and it did not stop either
render. Flagged here for visibility since another agent may still be restructuring
`video-engine/compositions/` after this report is read.

## Directory layout

```
control-panel/
  server.js              # http server + routing, no framework
  lib/
    store.js              # data/runs.json-backed run history
    jobs.js                # in-memory job-state object + SSE fan-out
    renderEngine.js         # REAL: shells out to video-engine's hyperframes render
    carouselEngine.js       # REAL (when carousel-engine is ready) / honest stub otherwise
    oauthYoutube.js          # YouTube reconnect flow shape; token exchange stubbed
    publish.js                # YouTube/Instagram publish -- both return 501
    voiceUpload.js             # upload handling; trim stubbed (see table above)
    util.js                     # atomic JSON writes, safe-id checks, path guards
  public/
    index.html, app.js, styles.css   # plain HTML/JS/CSS, no build step
  data/
    runs.json              # run history (JSON array)
    renders/                # rendered MP4s / carousel PNG sets + their variables.json
    uploads/                 # voice reference uploads
    oauth/youtube.json        # stub OAuth token state
```

## Known limitations / follow-ups (not required for Phase 6, noted for honesty)

- In-memory job state (`lib/jobs.js`) does not survive a server restart mid-run; a run in
  progress when the server restarts will show as stuck in the last-persisted history status.
  The run-history JSON itself is fine — only a live SSE stream/log backlog is lost. This
  mirrors a real limitation the old repo's `ui.py` had to work around (`_mark_orphaned_jobs_interrupted`); a similar reconciliation pass would be a reasonable Phase 7 addition here.
- No auth/CSRF protection beyond binding to `127.0.0.1` — acceptable for a local single-operator
  tool, same posture as the old repo's control panel.
- `data/renders/*.variables.json` files are left on disk after each render (useful for
  debugging what was actually passed to HyperFrames); not cleaned up automatically.
