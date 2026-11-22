# DIALOGUE spike0 (phase 0 look test), 2026-11-09
Re-run: `node dialogue/spike0/render.mjs` (all jobs, ~20 s; or `... cast_sheet` etc.). Headless Chrome (software GL) + localhost server, deterministic, no downloads.
Files: lib.js (assemble/toon/light/retarget/face), jobs.js (sheets), render.mjs, index.html, cast/{dadu,rohan,arjun,meera}.json (parts + colour overrides), cast/bonemap_ual_to_modular.json, out/*.png.
Uses runtime/vendor/three (r181 + jsm). It lacks jsm/curves, so render.mjs serves a NURBSCurve stub for FBXLoader (unused by these meshes).

## Works
- Assembly: head/body/legs/feet are separate SkinnedMeshes; all men + women share identical bone names and inverse binds (diff 0), so King head binds onto the Farmer skeleton directly.
- Toon: MeshToonMaterial + 3-step ramp, flat shading (set via `mat.flatShading=true`, ctor rejects it), fire key (flicker seeded) + moon rim + dim sky fill + linear fog; selective bloom on `Fire` materials only.
- Retarget UAL -> modular: Sitting_Idle_Loop and Sitting_Talking_Loop baked to clips at 30 fps for all 4 (swing+twist per bone, world space). Usable, looks natural.
- Eyes and brows are separate primitives (own meshes). Blink (eye Y x0.1 about its centre) and brow raise (+16 mm) both work (out/face_test.png).
- Crown: Gold primitive is separable; hiding it leaves no hole (hair is under it).

## Problems / traps
- glTF node transforms are NOT the bind pose (asymmetric); must call skeleton.pose() before reading rest. Each SkinnedMesh has its own Skeleton: update all, not one.
- UpperLeg.*, Foot.* are children of Root, not Hips: they need position tracks (done) or legs stay standing. PT.* are knee pole targets (ignored).
- CPU skin queries (getVertexPosition) disagreed with GPU: seat/feet heights are taken from bones (sole = Foot y - 0.023, seat top = Hips y - 0.11).
- King has NO brow primitive: brows are 58 triangles carved out of Hair_White by a box (x<=0.075, y 1.69-1.73, z>=0.125). Women: eyes = `Brown`, brows = `Hair_Brown`.
- Arjun: Pistol node hidden (Suit pack ships it), Tie primitive hidden but a dark tie-like shape remains (lapel in Suit material).
- Scale: men 1.82-1.89 m, meera 1.84 m, but nature props native cm: pine 2.7 m, common tree 2.5 m, stump 0.62 m high (spike), log 2.67 x 0.63, rock 0.9 m, tent 14 x 10 x 25 m raw. Props are renormalised (trees x3.3). Stump/log are scaled ~0.84-1.07 to the measured seat height.
- Palette: Quaternius base colours are very dark (greens 16270f); lit trees/props are muddy olive vs the palette. Skin lit by the key tends to saturated orange. Not tuned.
- Not done: embers, smoke, grain, vignette, DOF, sway, breathing, gaze, dadu hunch, search for crown-less hair-only look.
