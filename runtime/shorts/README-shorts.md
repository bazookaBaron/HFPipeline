# Long-form → Shorts series (`shorts.js`)

Every Doc2D long-form is also posted as a **PART 1…N YouTube Shorts series**. The 16:9 film is not re-authored:
each part is the finished `final.mp4`, cut at the script's part breaks, scaled to 1080 wide and centred in a
1080x1920 canvas, with a big **PART n** header, the series title and part dots on top, and a quiet
"Part n+1 → / Full video on the channel" line below. In the last 1.5 s a **PART n+1 →** pill (on the last part, a
**Full video on the channel** pill) fades in over the footer.

## 1. Script: `#part` breaks

```
So the bill always arrives. The only question is who opens the envelope, and when.
#part The price spike
# Chapter 3: The price spike
So what happens to a loaf of bread when tanks roll?
```

- `#part [title]` is an unspoken marker line, like `# Chapter` (voice.py, autodirect and compile all skip `#` lines,
  so spoken-line numbering in `words.json`, `chapters.json` and the shot list is unchanged).
- Parts are **60–170 s** (Shorts max 3:00) and cover the whole film in order.
- The last sentence before every `#part` must be a **curiosity hook**: open question, teased reveal, stakes raised,
  reversal coming. Never mid-thought.
- Every part after the first opens on a **1-line recap/bridge** ("So…", "Remember…", "By now…") that also works in
  the full film. The "full video" pointer is in the overlay, never in the narration.
- Check: `python runtime/scriptcheck.py <dir> --profile longform` (FAILs on missing markers, a part outside
  60–170 s, or a break without a hook line; WARNs on a part that doesn't open with a recap). `longform-parts` is an
  alias. `#part` is the only Shorts marker: retired `#clip … #/clip` blocks get a WARN to convert them, never a FAIL.
- `python runtime/lf/clips.py <dir>` dumps just the part times to `clips.json` (no video work).

## 2. Cut + compose

```
node runtime/shorts/shorts.js <projectDir> [--layout paper|gradient|blur] [--parts 1-3] [--grabs] [--grabs-only]
     [--title "Series title"] [--video final.mp4] [--script script.txt] [--shots auto|none|<file>]
     [--offset 0] [--out shorts] [--crf 19] [--force]
```

or as the last step of the film: `node runtime/doc/make.js <dir> --shorts [paper|gradient|blur]`.

- **Times:** `#part` → spoken-line index → `words.json`. The cut lands after the hook line's last word: on a shot
  boundary inside the pause if there is one (from `shots.txt` when `final.mp4` is newer than it; otherwise ffmpeg
  scene detection over the pause), else 0.15–0.7 s after the word. The next part starts at that cut, or 0.45 s before
  its first word if the pause is longer (a chapter pause isn't spent on silence). The last part ends 1.2 s after the
  last word (the end card/outro is not included). `--offset` shifts word times if the film has a lead-in.
- **Audio:** 60 ms fade-in (parts 2+), 350 ms fade-out, two-pass `loudnorm` to −14 LUFS / −1.5 dBTP per part.
- **Layers:** one HTML template per layout → PNG via headless Chrome (`CHROME` env var overrides the path), cached
  in `shorts/_layers/` (only re-shot when the HTML changes); ffmpeg overlays them. ~1 s of render per 1–2 s of film.
- **Layouts:** `paper` (default: cream paper grain, navy/coral type, shadowed frame), `gradient` (navy→teal with a
  plum glow, cream/saffron type), `blur` (the frame itself, blurred, darkened and enlarged behind the film).
  `--grabs` writes `layout-<name>.jpg` + `layout-<name>-tease.jpg` for the first selected part, for all three.
- A part over 179 s stops the run (fix the markers, or `--force`).

## 3. Output (`<project>/shorts/`)

- `part-NN.mp4` — 1080x1920, 30 fps, H.264 CRF 19, AAC 192k, faststart.
- `parts.json` / `parts.md` — per part: times, snap type (`shot` / `scene` / `word`), suggested title
  (`<Series>: <part title> (Part n/N)`; the part title comes from `#part <title>`, else the chapter), a description
  suggestion (recap line + "Part n+1 is next" + "Full video on the channel" + #shorts) and the hook line.

The user posts. Nothing here uploads.
