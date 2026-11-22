# DIALOGUE thumbnails — required deliverable of every episode

Every episode ships with a thumbnail **in the same aspect ratio the video was asked for**:
9:16 episode -> 1080x1920 `<slug>_thumb_9x16.png`; 16:9 long-form -> 1920x1080 `<slug>_thumb_16x9.png`.
No episode is "done" without it, and the report must name the file and the hook text.

## Spec (9:16, as built by `thumbs/make_thumb.mjs`)
- Background: the episode's own frame, blurred and darkened (indigo). Hero: the best MG card from the final mp4 (zoomed to hide the card's own label), rounded, soft shadow.
- ONE hook, max 5 words, 2-3 lines, Geist 850, cream with the last/key line in saffron `#FFB84D` (the only accent colour). Auto-fits to 940 px wide; never below 120 px.
- ONE small tag pill (topic, e.g. "ZIP · MP3 · JPEG"), >= 44 px. Max 2 text elements in total. No logos, no faces, no clutter.
- Safe zones: nothing in the top 14 % (y < 270) or bottom 22 % (y > 1498), 60 px side margins (platform UI covers these).
- Hook rules: a question or a surprising claim taken from the script's own hook ("WHERE DID 8 GB GO?", "WORKS WITH A HOT DOG"); no clickbait the video does not pay off; readable at phone-thumbnail size.
- Pick the card that shows the mechanism with the most colour (look at `out/mg_sheet_9x16.png` or probe frames), not a caption frame. Check the crop shows no leftover label slivers.
- No AI images, no photos of real people.

## Commands
1. Add the episode to `dialogue/thumbs/hooks.json`: `{"<slug>": {"hook": ["LINE 1","LINE 2"], "accent": <line index>, "tag": "TOPIC", "cardT": <seconds of the best card>}}`.
2. Probe candidate frames (optional): `node dialogue/thumbs/make_thumb.mjs <slug> --probe 8,16,24`; frames land in `dialogue/thumbs/work/`.
3. Build: `node dialogue/thumbs/make_thumb.mjs <slug>` -> `dialogue/episodes/<slug>/out/<slug>_thumb_9x16.png`. View it; iterate until clean.
4. 16:9 long-form: extend `make_thumb.mjs` with a 1920x1080 layout (hero card right, hook left) in the same palette; do not reuse the 9:16 file.

## Upload and attach (Voholabs Social MCP)
- Upload the PNG with `createUploadLinkTool` + `curl -A voholabs-upload/1.0 -F file=@...`; keep the returned `id` and `path`. (Files >~100 MB are refused by the host: re-encode a delivery copy.)
- At scheduling time (`integrationSchedulePostTool`): Instagram = attachment `{path: <video>, thumbnail: <png path>}`; YouTube = setting `thumbnail: {id, path}` (custom thumbnails need a verified channel); TikTok has no custom image: pass `thumbnailTimestamp` (ms of the card frame) on the video attachment.
- `editPostTool` can set the YouTube `thumbnail` setting but cannot change an attachment's thumbnail: to add an Instagram/TikTok cover to an already-scheduled post, create the replacement post first, then delete the old one (same date and channel).
- Verify with `postsList` that every post is still `QUEUE` at the right time and carries its thumbnail.
