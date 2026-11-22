# autoplan / review notes

Files: `compiler/autoplan.mjs`, `compiler/review.mjs`, test episode `episodes/_autotest/` (cloud script copy). No existing file was edited.

## Run
```
node dialogue/compiler/autoplan.mjs <ep> [--ratio 9x16|16x9] [--plan-md]
node dialogue/compiler/review.mjs <ep> [--run]       # --run queues epgate + sheet through runtime/jobq.js
```
Inputs per episode: `script.md` (`SPEAKER (emotion) [CU|MS|2S]: text [mg: CUE | word=verb ; word#2=verb]`), word times json, optional `episode.json`
`{words, audio, duration, set, pair, who, alias, lead, tail}` (defaults = the cloud values: fish/words6.json, campfire, dadu/rohan, first speaker = B).
Optional `mg.beats.json` `{cues:[{name, line?, at?, end?, beats:[{word, line?, t?, verb}]}]}`. MG timings only are passed through (`mg.auto.json` + `mgWindows` in shots.json).
`--plan-md` writes PLAN.md (copy of PLAN.auto.md) only if none exists, because gates.mjs reads `PLAN.md`.

## Proposals for existing files (NOT applied)
1. gates.mjs section (c), tail check: hard-codes `Walter amused + Leo worried + eyes to the fire`. Any episode whose ending is not a deflating punchline fails gate c on the tail row.
   Proposal: read the expected tail faces from the PLAN row text (or from shots.json) instead of constants.
2. gates.mjs section (0): `mcu_A` rows are forced to expect `hold` (regex skips the row). autoplan therefore never pushes mcu_A. Fine, but mcu_A could not push even if wanted.
3. gates.mjs (c) face parser only knows the cloud preset names; a new emotion name in PLAN would show as "cannot parse". autoplan only emits the names in the gate's MAP (`neutral/firm-light`, `surprised-light + smile`, ...).
4. compile.mjs CFG is keyed by episode name (`cloud`); a second episode must add its own entry. autoplan avoids this with episode.json. If compile.mjs should read episode.json too, that is a 3-line change.
5. render.mjs `sheet` renders every tile (22 mids + CU peaks) into one 6-column sheet. review.mjs re-tiles the `mid` tiles per chapter with ffmpeg. A `sheet <ep> <t0> <t1>` argument would avoid rendering tiles nobody looks at.
