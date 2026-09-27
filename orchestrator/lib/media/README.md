# Media resolver (LF plan §5, phase P4)

Turns storyboard media **intents** into local, licence-checked, credited files. This is the only
networked media step. Renders read only the files named in the manifest.

## API
```js
const { resolveMedia } = require("./lib/media/resolve");
const { createGemini } = require("./lib/media/gemini"); // or inject your own {json(prompt,{images}), image(prompt), imageModel}
const { manifest, report } = await resolveMedia(intents, {
  gemini: createGemini(),   // null = keyword queries, no vision vetting, no illustrations
  outDir: "out/ch1",        // writes media-manifest.json, credits.txt, media-report.json
  cacheDir,                 // default video-engine/assets/media/cache (git-ignored)
  offline: false,           // true = cached API responses/downloads only (no HTTP)
  concurrency: 3, log: console.log,
});
```
CLI: `node orchestrator/resolve-media.js --intents intents.json --out dir [--offline] [--no-vision]`.

## Intent (input)
`{slot, kind: photo|portrait|logo|video|map|illustration, intent, entity?, mood?, era?, minWidth?, size?, allowIllustration?, allowCard?}`
- `era` defaults to "present day" in the vision check.
- `size`: `full` (default for photo/video/illustration; 1920x1080 cover, min 1280 px), `card` (min 800 px), `portrait`, `logo`, `map`.
- A full-bleed slot that finds nothing at full size is retried at card size (`allowCard: false` turns this off).

## Manifest (output, `media-manifest.json`)
```json
{"version": "media-manifest.v1", "slots": {"<slot>": {
  "status": "ok|illustration|fallback", "kind": "image|video", "source": "commons|openverse|nasa|illustration",
  "sha": "…", "file": "assets/media/cache/ab/abc….jpg", "size": "full|card|…",
  "credit": "Photo: Jane Doe / Wikimedia Commons · CC BY-SA 4.0", "creditFull": "…TASL line…",
  "licence": "CC BY-SA 4.0", "licenceUrl": "…", "focal": [x, y, w, h], "width": 1920, "height": 1280,
  "pageUrl": "…", "depicts": "…"}}}
```
- `file` is relative to `video-engine/`.
- `focal` is given as fractions of the image.
- `status: "fallback"` carries `reason` and no file: the module renders its no-image state.
- Draw `credit` on frame whenever the media is visible, and put the `credits.txt` lines in the description.

### Video slots (kind `video`, `lib/media/video.js`)
```json
{"status": "ok", "kind": "video", "file": "assets/media/cache/ab/<sha>.mp4", "poster": "…/<sha>.poster.jpg",
 "lastFrame": "…/<sha>.last.jpg", "clipDur": 6.0, "fps": 30, "width": 1920, "height": 1080, "trimIn": 14, "trimOut": 20,
 "credit": "Video: Jane Doe / Wikimedia Commons · CC BY 3.0", "creditFull": "…", "licence": "…", "focal": [x, y, w, h], "size": "full|card"}
```
- **Sources:** Commons video (`filetype:video`, `prop=videoinfo`; the 1080p/720p WebM transcode is used, not the original), then NASA Image and Video Library videos when relevant (`nasa: true` or the query plan says so; `~large.mp4`, then `~medium.mp4`). Openverse has no video endpoint (`/v1/video/` is 404; audio only), so it is skipped.
- **Selection:** licence gate as for images; source >= 3 s and >= 480 lines (720+ for full-bleed, else `size: "card"`); the poster is vetted first for relevance only, then up to 3 candidates per stage become clips.
- **Clip:** long sources are never downloaded whole: 6 frames are grabbed remotely (range requests), the best one anchors a 30 s stream-copied excerpt (200 MB cap); sources <= 45 s are copied whole. The window (`intent.duration`, 4-12 s, default 6) has no hard cut inside (ffmpeg scene score > 0.3), no black or fading frame, and the most motion. 3 frames of it are vetted (on intent, no burned-in subtitles/captions/title cards, no channel bug or watermark); a failing window makes way for the next best.
- **Output:** H.264 High, yuv420p, 30 fps, no audio, CRF 20, `+faststart`, 1080 lines (or 720 from a 480p source; no upscale > 1.5x; aspect kept), plus poster (first frame) and last-frame JPEGs. Sidecar: source, pageUrl, fileUrl, rendition, author, licence, credit, creditFull, width, height, duration/clipDur, trimIn/trimOut (source time; approximate to the keyframe for excerpts), fps, focal, poster, lastFrame, fetchedAt.
- **Fallback:** no acceptable clip -> the still pipeline for the same intent: `{status: "ok", kind: "image", fallbackFrom: "video", …}` (credited "Photo: …").
- **Renderer:** `compile.js` copies `clipDur`/`lastFrame` into the slot props, and the manifest's `kind` wins over the storyboard's (a fallen-back still renders as an image). The root media layer plays the clip once and holds `lastFrame` for the rest of the run; `checkMedia` needs a non-black first frame.

## Chain and gates
- **Chain:** Wikidata claims (P18, P154 for logos, P41, P242), then the entity's Commons category, then Commons search, then Openverse, then NASA (only when relevant), then AI illustration (kind `illustration` or `allowIllustration`), then fallback.
- **Licences allowed:** PD, CC0, CC BY, CC BY-SA, GODL-India.
- **Licences rejected:** NC, ND, GFDL-only, "No known copyright restrictions", unknown.
- **Quality:** no upscale above 1.5x, aspect limits, and no dHash near-duplicates within one manifest.
- **Vision:** Gemini vets up to 6 candidates per stage. It rejects a candidate that is off-intent, from the wrong era, shows the subject only incidentally, has a watermark or heavy text (any text for illustrations), is graphic, or is a screenshot.
- **Politeness:** User-Agent `HFPipeline-media/0.1 (debopriyo.debnath1999@gmail.com)`, at most 5 requests/s, Openverse spaced 3.2 s apart and capped at 60 per run, backoff on 429/5xx, and API responses cached for 24 h.

Tests: `node --test orchestrator/lib/media/*.test.js` (offline, recorded fixtures; video tests generate their clip with ffmpeg lavfi).
Contact sheet: `python orchestrator/lib/media/contact_sheet.py <outDir>` (video tiles: poster + 2 mid frames + duration/trim).
