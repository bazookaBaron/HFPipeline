# Local publishing setup (experimental)

The control panel separates **Prepare** (metadata + cover) from **Publish** (external write). Both require a completed run. Publishing is disabled when the server is bound to a non-loopback address. There are no automatic background posts.

If the UI shows `instagram: not found` or `youtube: not found` when preparing, the browser has loaded new static files from an older still-running server. Restart the control-panel process after its active jobs are safe to interrupt. The older "YouTube connected" badge was a simulated token, not authorization for a real channel; the new server ignores that stub token.

## YouTube

1. Create a Google OAuth client for a local web application, enable YouTube Data API v3, and allow `http://127.0.0.1:4600/api/oauth/youtube/callback` as a redirect URI.
2. Set `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` in the environment that launches `node control-panel/server.js`. Optionally set `YOUTUBE_REDIRECT_URI` to match the registered callback.
3. In the control panel, choose **Connect / Reconnect YouTube** and consent to `youtube.upload`.
4. Prepare a completed video, review its title/description/tags, then click **Upload privately to YouTube**. The returned video URL is saved in the package record. The generated cover is not sent as a custom thumbnail.

The app deliberately sets `privacyStatus: private`. A public release needs a separate user decision and, for some Google API projects, an audit. The local OAuth token file is ignored by Git but is still sensitive; protect the Windows account and do not share `control-panel/data/oauth/`.

## Instagram (unofficial Reel uploader)

The npm `instagram-private-api` package was evaluated and removed: its published release is old and its dependency audit reported critical vulnerabilities. Reels now use `instagrapi==3.0.14` from an isolated root `.venv`; carousel uploads retain the existing Puppeteer desktop path. Install the Reel dependency with `.venv\Scripts\python.exe -m pip install instagrapi==3.0.14` after creating the virtual environment. This is an unofficial private API and can break or trigger account challenges.

1. Click **Connect Instagram browser** and sign in inside the window that opens. The app never asks for or stores your Instagram password directly. The browser profile is stored under ignored `control-panel/data/oauth/instagram-browser/` and contains sensitive cookies.
2. A read-only Reel preflight reuses that browser session locally, verifies the intended account through the private API, and saves private session settings under ignored `control-panel/data/oauth/instagram-private/`. The browser session may be rejected; if so, do not retry in a loop—use a separate local sign-in or the browser fallback.
3. Prepare a completed reel, review caption and tags, then click **Publish to Instagram** only when ready for one real public post. The adapter extracts an unedited frame from the MP4 as the cover payload required by Instagram; it does not send the generated graphic thumbnail. It submits a regular Reel and verifies the returned media type, author and permalink before marking it complete.

Both unofficial methods can change without notice. A failed/uncertain upload is recorded as `share-unknown` and cannot be retried automatically: check the account first to prevent duplicate posts. A live account test is required before treating this as unattended publishing. If Instagram requires interactive challenges, the operator must resolve them.

## Verification state

Local tests cover input validation, file selection, YouTube upload request shape, and generated cover dimensions. Normal headless Chrome startup was verified outside the tool sandbox without disabling Chrome's own sandbox. These checks do **not** prove Google authorization, thumbnail acceptance, Instagram login, Instagram Reel classification, or a successful public post. Do not describe either integration as end-to-end verified until controlled account tests pass.
