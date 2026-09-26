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

## Chain and gates
- **Chain:** Wikidata claims (P18, P154 for logos, P41, P242), then the entity's Commons category, then Commons search, then Openverse, then NASA (only when relevant), then AI illustration (kind `illustration` or `allowIllustration`), then fallback.
- **Licences allowed:** PD, CC0, CC BY, CC BY-SA, GODL-India.
- **Licences rejected:** NC, ND, GFDL-only, "No known copyright restrictions", unknown.
- **Quality:** no upscale above 1.5x, aspect limits, and no dHash near-duplicates within one manifest.
- **Vision:** Gemini vets up to 6 candidates per stage. It rejects a candidate that is off-intent, from the wrong era, shows the subject only incidentally, has a watermark or heavy text (any text for illustrations), is graphic, or is a screenshot.
- **Politeness:** User-Agent `HFPipeline-media/0.1 (debopriyo.debnath1999@gmail.com)`, at most 5 requests/s, Openverse spaced 3.2 s apart and capped at 60 per run, backoff on 429/5xx, and API responses cached for 24 h.

Tests: `node --test orchestrator/lib/media/*.test.js` (offline, recorded fixtures).
Contact sheet: `python orchestrator/lib/media/contact_sheet.py <outDir>`.
