# v3 build brief: rooms, posed people, landmarks, world SFX, MG fixes (shared by all builders)

Read first: `PLAN-v3-scenes.md` (the plan, with the user's decisions) and the evidence in `out/review/{nvidia,trump,china}/` (contact sheets showing today's problem: every world shot is one red building).
Memory, in `C:\Users\debna\.claude\projects\C--Repos-HFPipleine\memory\`: `miniature-format.md`, `miniature-v2-direction.md`, `honesty-no-shortcuts.md`, `machine-load-jobq.md`.

## Hard rules
- **Uncommitted repo.** Never commit, stash, switch branch or revert other people's files. Edit only the files your brief owns.
- **Nothing prebuilt.** No asset files and no fixed scenes. Everything comes from seeded grammars and solvers at runtime: same spec + seed gives the same result, a different seed gives a visibly different one.
- **Look:**
  - white matte miniature with soft contact shadows; materials come from the Builder keys w/g/d/s/l/k (see `sets/grammar3d.js`);
  - red only on the focus (applied through the existing FOCUSMAP / setFocus mechanism);
  - faceless mannequins;
  - must hold up at 1920x1080 under tilt-shift. Dense with believable detail, aesthetic, never "AI slop" (no random clutter, no floating or intersecting parts).
- **No figure animation.** Figures are posed once at build time and frozen like a diorama. Only the camera moves. Figure cap in room scenes is 0.35 of frame height; no close-ups and no faces.
- **Heavy jobs go through jobq:** `node runtime/jobq.js --kind snap|render|ff|voice --prio 1 ...` from the repo root `C:\Repos\HFPipleine`. Look at how `samples/obj3d/render.mjs` and `preview.mjs` are invoked. RAM is tight (about 1–2 GB free); jobq auto-proceeds after its wait. Never run two renders at once.
- **Verify by looking.** Make 1920x1080 test stills of your work (several seeds) and Read the images. Fix what looks wrong before reporting. Report honestly: what works, what is weak, and the still paths.
- **Syntax check:** after editing inline modules in html, run `bash checkpage.sh <file>`. Beware `//` comments swallowing code on one-line statements; this happened 3 times before.

## Contracts between builders (keep these exact)
- `sets/poses.js` (builder B): `export function posedPerson(M, o) -> THREE.Group`.
  - Height is 1 unit when standing, origin at the feet, facing +x (same convention as `kit.js person`).
  - Options: `o = { pose, build 0.8..1.5, hat:"none"|"cap"|"hard"|"peak", hair:"none"|"short"|"bun"|"long", coat:bool, tie:bool, skirt:bool, prop:null|"phone"|"papers"|"box"|"briefcase"|"gavel"|"mic"|"cup"|"laptop"|"sign", seed }`.
  - Poses: `stand, stand_hips, stand_arms_crossed, phone, point, speak (hand gesture), raise_hand, applaud, salute, walk (mid-stride), run (mid-stride), carry (box held), sit, sit_type (hands on desk), sit_lean (elbow on table), sit_listen, handshake_L, handshake_R, embrace_L, embrace_R, kneel, bow, look_down`.
  - Returned `userData`: `{ seatH }` for seated poses (hip height, so a chair seat height can be matched) and `{ hand: Vector3 }` (prop hand position).
- `sets/furniture.js` (builder A): `export const FURN = { table, chair, desk, ... }`. Each has the form `FURN[what](E, p) -> item`, the same item shape as `grammar3d.js` GEN (`{ g, r, len, wid, dom:"any", pad }`), plus `anchors: [{ type:"seat"|"stand"|"podium"|"bench"|"screen", x, y, z, h }]`. Room-scale units: **1 unit = 1 m**.
- `sets/groups.js` (builder B): `export function stage(form, opts, rnd) -> [{ x, z, h, pose, o }]`. It is a placement list for figures.
  - Forms: `table` (uses seat anchors), `audience` (rows facing a point), `pair` (facing), `podium` (a speaker plus a press scrum), `queue`, `crowd` (Poisson fill with headings toward an attractor), `procession`, `huddle`, `bench_row`, `workers` (one figure per workstation anchor).
  - Headings follow sightlines: seated figures face the table centre, an audience faces the speaker.
- `sets/rooms.js` (builder A): `export function buildRoom(spec, ctx)`. It returns **the same object as `buildSet`** in `sets/composer.js`: `{ group, subjects, proxies, framings, update, setFocus, light, info, field, items, focus }`. That lets `film.html` use it in place of a set; read `buildSet` and how `film.html` consumes it.
  - Spec: `{ id, scale:"room", room:{ w, d, h, walls:"cutaway2"|"cutaway1"|"open", floor:"wood"|"tile"|"carpet"|"concrete", windows, doors, partitions, rooms:[...] }, place:[{ what, ...furniture/props }], groups:[{ form, n, at, ... }], people:[{ id, pose, at, char }], focus:{ id }, light:{ time, shafts } }`.
  - Framings must be room-aware: eye-level, high corner, top-down plan, along-the-table, doorway, over-the-shoulder, and a 2–3 stop camera path that reveals details. They have to respect the camera speed caps used in `film.html`.
  - The focus can be a figure, a pair, a group or a furniture piece.
  - **street scale** (`scale:"street"`, 1 unit ≈ 2.5 m) is also built in rooms.js. It has a ground plaza or street, building facades as walls, kerbs, lamps, crowds and vehicles. It covers rallies, courthouse steps, a press scrum, a market aisle and an airport gate.
- **Characters:** `spec.cast = { jensen: { build:1.05, hair:"short", coat:true, prop:null, mark:"..."} }` gives a fixed silhouette per recurring person (no faces). A people entry with `char:"jensen"` uses it.
- **SFX** (builder C): a library section `dialogue/sfx/` with ids `world.*` / `amb.room.*` etc. plus `audio/sfxmap.json`, which maps archetype, prop and vehicle words to beds and one-shots. `audio/mix.py` accepts cue type `"world"`. In wave 2, `film.html` will emit world cues from what the camera reveals.
