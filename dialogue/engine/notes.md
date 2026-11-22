# DIALOGUE engine (phase 2), 2026-11-09
Run any set/rig/ratio/time: `node runtime/jobq.js --kind render -- node dialogue/engine/render.mjs <job> ...`
Jobs: `still <set> <rig> <ratio> [t] [u] [pair|-] [out]` | `hero <set> [pair]` | `gate <set> [pair]` | `video <set> <ratio> [sec] [pair]` | `bench <set>` | `lineup` | `eval <set> "<js>"`. Rigs: wide2 mcu_A mcu_B ots_A ots_B insert seat_A seat_B. Env `GL=sw` software GL, `PRE="<js>"` runs in the page before a still.
Serves engine/ + three + raw assets + spike1 (legacy MG only) on localhost; headless Chrome D3D11; deterministic.
## Layout
- `core/world.js` (refactor of spike1 world.js): `buildWorld({set, pair})`; actors A (screen-left) / B (right); seat fit (per-actor stump/log = spike1 code, or `shared` seat = one plank/log along x warped to each sitter's thigh height), contact + penetration gates, acting (speaker/listener blocks), camera rigs, fg dressing, post (bloom, bokeh, grain). `core/fx.js` = spike1 campfire embers/smoke/sky verbatim. `core/fx2.js` = new effects (sky2 + Milky Way, shooting star, LOD terrain, mist, water, ridge strips, car streaks, windows, fireflies, elevation profile). `core/{lib,facelayer,facecfg}.js` = spike1 copies (face layer used by every actor).
- `sets/<id>.js` = data (terrain fn, fog, lights, seats, rigs, fg) + `build(ctx)` (set order and RNG order kept). `cast/`, `data/words.json` (neutral dummy words), `fonts/`.
- MG hook: `mg-adapter.js` only. If `dialogue/mg/index.js` exists it calls `createMG({root, ratio, palette, fonts})` and `seek(t, rect)` / `activeLayout(t)`; otherwise spike1 mg.js (map card + captions, unedited) is used. Captions come from the adapter either way.
## Parity
campfire hero_wide_16x9, hero_wide_9x16 and mcu are bit-identical to spike1 (ffmpeg PSNR = inf) before the dummy words were made neutral (the mcu caption text differs now, nothing else).
## Sets built
- `hilltop_city` (Ben + Nora): reworked to dialogue/ref/hilltop_ref_valley_city.png. Ridge-edge log, view out and down: ~9500 terraced house lights (points on contour rows, clusters, forest gaps), 2 roads with car streaks, valley mist, far faceted snow range (moonlit shading, haze at base, no moon disc), small bonfire as the warm source, cool moon rim from behind, embers + 6 fireflies subtle. Pair face the view, torsos turned 43 deg toward each other (procedural torso twist), heads to each other.
- `pine_ridge`, `lake_shore`: files kept, NOT finished (scope cut by the user). pine_ridge 9x16 wide shows a flat blue wall (an instanced layer covers the lower frame, not found); lake log fit failed (pen 0.25 m) and water reflection point sits on land. Do not use as is.
## Honest weaknesses (hilltop)
- Lights are points, not houses: no lit windows/roofs on the near slope. Snow range is a single faceted mesh, reads slightly flat/white. Foreground shelf is a dark grass field.
- OTS background is trees/rocks, not the view. Shared-seat fit: see gate log.
## Render time (GPU d3d11, queue waits excluded)
see out/hilltop_city/render_time.json and out/campfire/render_time.json (bench: s/frame, page load). jobq waits were 10-20 min per job (voice + MG ahead).
## Files still using old cast ids (dadu rohan arjun meera)
engine/cast/*.json, core/facecfg.js, core/lib.js (CAST_IDS), sets/*.js pair defaults, render.mjs DISP map, lineup.js DISP map, spike1/*.
