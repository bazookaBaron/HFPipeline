# Poster thumbnail renderer
`node runtime/thumbnail.js spec.json [outDir]` (outDir defaults to the spec's folder). No AI: the poster theme, `puppet.js`, `maps.js`, Anton and real licensed photos.
Per entry it writes `<name>.png` (2x render, lanczos down to 1280x720 / 1080x1920), `<name>-mobile.png` (336x188 / 202x360), `credits.txt` and one `sheet.jpg` (all variants + mobile).
It prints checks: text >= 150 px (yt), nothing key in the bottom-right 120 px (yt), everything inside the 1080x1350 middle crop (cover). Rules: `.claude/skills/thumbnail/SKILL.md`.

Spec = array of entries (or `{variants:[...]}`); coordinates are canvas px, `at` = top-left (stickers: centre).
```json
{ "name":"thumb-A", "size":"yt|cover", "theme":"tomato",
  "text":{ "lines":["EVERYONE WANTS","INDIA"], "mark":"INDIA", "at":[30,26], "sizes":[150,200], "dx":[0,10] },
  "character":{ "pose":"point_left", "face":{"brows":"raised","eyes":"wide","mouth":"o","look":"left"}, "side":"right|left", "scale":1, "shirt":"#hex" },
  "subject":{ "map":{ "view":"IND", "focus":"IND", "center":[x,y], "scale":0.9, "dx":0, "dy":0,
                      "arrows":[{"label":"USA","at":[x,y]}] },
              "number":{ "value":"55%", "label":"...", "at":[x,y] },
              "photos":[{ "file":"../images/x.jpg", "name":"XI", "credit":"...", "at":[x,y], "w":170, "h":190 }] },
  "cue":{ "type":"arrow|circle|x", "target":[x,y], "color":"#hex", "rx":200, "ry":230 },
  "stickers":[{ "text":"?", "at":[x,y], "size":240, "shape":"circle", "w":230, "fill":"marker|paper|ink|alert", "tilt":6 }] }
```
- `character` is the bust puppet (poses: `shocked point_left thinking shrug oops ...`, see the puppet README); `face` overrides brows/eyes/mouth/look. `side:"left"` mirrors it.
- `map.center` puts the focus country's centroid at that pixel; `scale` zooms about it. Arrows start at a chip (`at`, or a place name in `from`) and end at the focus country.
- `subject.photo` (single) works like `photos`. Photo files resolve relative to the spec file.
- Keep: <= 4 visual groups, one marker word, `--alert` only for the cue.
