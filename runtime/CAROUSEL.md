# Carousel generator

`node runtime/carousel.js slides.json [outDir]` renders `outDir/index.html` (static, 1080x1350 `.slide` sections, poster theme).
`node runtime/carousel_export.js outDir [--sheet]` writes `slide-N.png` (1080x1350, rendered at 2x then lanczos-downscaled) and `sheet.jpg`,
and prints checks: headline >= 64 px, body >= 34 px, no overflow. Aim for 6-7 slides, no character, one idea per slide.

## slides.json
```json
{ "topic": "...", "theme": "green", "brand": "vloombox.in", "slides": [ ... ] }
```
`theme`: id from `runtime/theme.js` (use the reel's hue); omitted = `Theme.next(slug)`. Text supports `[[marker highlight]]` and `**bold**`.

| slide | fields |
|---|---|
| cover (`type:"cover"`) | `kicker`, `title`, `sub`, `art` (a visual), `swipe` (default "swipe →") |
| content (no type) | `kicker` (default "02 / 07"), `title`, `visuals: [visual...]`, `bullets: [str]` (2-4), `note` (dark callout), `source` (required when a number is shown), `bulletsFirst` |
| recap (`type:"recap"`) | `title`, `items: [str]` (checklist), `cta` (default "Follow for more"), `site` (default "vloombox.in — daily tech jobs, referrals & more") |

## visuals
- `{type:"stat", value:"15T+", label, small?}`
- `{type:"bars", sentence?:"The cat sat on the ___", rows:[{label, pct, value?}], caption?}`
- `{type:"chunks", parts:[..], ids:[..], arrow?, caption?}` (words to token IDs)
- `{type:"flow", nodes:[..], hot?:index, loop?:"repeat ..."}` (3-4 short nodes)
- `{type:"qa", pairs:[[question, answer]], caption?}`
- `{type:"rank", items:[..], caption?}` (medals 1-3)

Budget: a content slide holds about 2 visuals + 1-2 bullets, or 1 visual + 2-3 bullets + a note. The exporter flags overflow.
