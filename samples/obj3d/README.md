# samples/obj3d: miniature film pipeline

Three.js page `film.html`, driven by `films/<film>/plan.json` + `lines.json`, for the channels Powder Keg and Partition Lines.
Runbook (authoritative): `CHANNEL-PIPELINE.md`. Engine rules: `MINIATURE-PLAN.md`, `MINIATURE-LESSONS.md`, `ENGINE-UPDATES.md`.

## Trigger a film

From the repo root:

```bash
node samples/obj3d/make_film.mjs <powder|partition> <film-id> --dry-run   # status + every command, runs and writes nothing
node samples/obj3d/make_film.mjs <powder|partition> <film-id>             # run what is ready, stop at what waits
```

`<film-id>` is `<topic>_v1` (for example `suez_v1`). The same command is safe to rerun: stages whose outputs are present and newer than their inputs print `DONE` and are skipped.

Stages, in runbook order: `prereq > factsheet > script > voice > photos > plan > gates > render > mix > variants > thumbnail > report`.

| stage | who | what it does / checks | output |
|---|---|---|---|
| prereq | script | tools (node, python, ffmpeg), chrome-headless-shell, puppeteer-core, vendored three, channel + niche block, engine files | - |
| factsheet | research agent | prints the brief | `films/<f>/factsheet.md` |
| script | script-writer agent | prints the brief; checks 1,450-1,650 spoken words, `#end`, header | `films/<f>/script.md` |
| voice | script (jobq voice) | `audio/voice.py <f> tts` then `build` | `voice.wav`, `lines.json`, `words.json` |
| photos | photo agent | prints the brief | `photos.json`, `entities.json`, `photos_missing.txt` |
| plan | producer agent, then script | runs `films/<f>/make_plan_v4.py` | `plan.json`, `sound.json` |
| gates | script (jobq snap) | `keycheck.mjs`, `render.mjs shots` (all v3 gates + photo coverage), `render.mjs lines`, `photocheck.mjs`, `mg2d/kindgate.mjs` for the kinds the plan uses, contact sheets | `out/<f>_169_gates.json`, `linecheck_169.json`, `out/<f>_169_sheet*.jpg` |
| render | script (jobq render) | `render.mjs video film 30`, refuses a failing or stale gate record | `out/<f>_169.mp4` |
| mix | script (jobq ff) | `audio/mix.py <f> 169`, then ebur128 (-14 +-0.5 LUFS, <= -1 dBTP) | `out/<f>_169_final.mp4` |
| variants | script-writer agent writes the end line, then script | one channel only: `variants.py <f> --ch <channel>` | `out/<f>_169_final_<channel>.mp4` |
| thumbnail | producer + script | `films/<f>/make_thumb.py <still>` (`--still <path>`; default `out/<f>_169_s12.jpg`) | `out/<f>_thumb.jpg` |
| report | main thread | prints what REPORT.md, the upload description and the Shorts need | `films/<f>/REPORT.md` |

Options: `--from/--to/--only <stage>`, `--redo <stage,..>`, `--still <path>`, `--no-jobq`, `--list`, `--help`.
Exit code: 0 everything done (or dry run), 1 a command failed, 2 usage, 3 walk finished with stages waiting.
Agent stages are never run by the script: it prints the brief; give it to the agent, then rerun. Every spoken line (including the end line) comes from the script-writer agent.
Time to quote: 5-6 h per film end to end.

## Files

| file | role |
|---|---|
| `make_film.mjs` | the trigger above |
| `channels.json` | channel registry (name, mark, tagline, voice, end-line rules), checked against `runtime/topics/niches.json`. The per-film end line lives in `films/<f>/channels.json` (shape in `_meta.perFilmFile`) |
| `render.mjs` | driver: `shots`, `lines`, `still`, `sheet`, `keys`, `video`, `bench`. `node samples/obj3d/render.mjs --help` |
| `keycheck.mjs` | pre-render camera key-list check (`?keys=1` mode of film.html) |
| `mg2d/kindgate.mjs` | MG kind legibility gate (>= 21.6 px captions, no text overlaps) -> `out/kg/` |
| `photocheck.mjs` | photo coverage gate (needs `entities.json`) |
| `variants.py` | channel end line + card without re-rendering the whole film |
| `audio/` | `voice.py`, `mix.py`, `music.py` |

Run any heavy job through the queue, one render at a time: `node runtime/jobq.js --kind snap|render|ff|voice --prio 1 -- "<cmd>"`.
render.mjs env: `QS="ar=16x9&film=<f>[&channel=<c>]"`, `VW`, `VH`, `FROM`/`TO` (seconds), `GL=sw` (software GL), `CHROME=<path to chrome-headless-shell>`.

## Needs on disk (not in git)

- `samples/obj3d/data/ne_110m_admin_0_countries.geojson` for any plan with a `map` (Natural Earth 110m, public domain; the download needs the user's OK). `render.mjs` serves `/data/` from `samples/obj3d/data`, `runtime/geo`, `.vendor-assets/geo`, `.vendor-assets/data`.
- `.vendor-assets/.env` with the voice key (never printed).
- `runtime/vendor/three` has no `jsm/math/SimplexNoise.js`; `render.mjs` serves a small shim at `/post/SimplexNoise.js` (the importmap in film.html points there; used only for the GTAO noise texture).
