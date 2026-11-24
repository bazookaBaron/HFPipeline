# Prompt: 9-minute 16:9 miniature film, "The Malacca Dilemma"

Paste everything below the line into a new chat started in C:\Repos\HFPipleine.

---

MINI 16:9 FILM: build a 9-minute, 16:9 (1920x1080, 30 fps) white-miniature film, end to end, with voice and sound.

**Run fully autonomously.** I'm away. Don't ask me anything and don't stop for approvals. Make the sensible call, note it in the final report, and finish.
- If a gate fails, fix the cause and re-run. Never loosen the gate.
- If something truly blocks (an API error, a missing key), work around it where you can. Report it at once in a short message, then continue with everything else.

**Run fully autonomously.** I'm away. Don't ask me anything and don't stop for approvals. Make the sensible call, note it in the final report, and finish.
- If a gate fails, fix the cause and re-run. Never loosen the gate.
- If something truly blocks (an API error, a missing key), work around it where you can. Report it at once in a short message, then continue with everything else.

**Topic:** "The 2.8 km of water China is afraid of": the Strait of Malacca and China's "Malacca Dilemma".
- **Hook:** one narrow strait carries a huge share of world trade and most of China's imported oil. Whoever can close it holds a kill switch on the world's second-largest economy.
- **Story arc (7–9 chapters, each with a re-hook):**
  1. Cold open: the tanker queue at the narrowest point.
  2. Why ships have to go this way (the map).
  3. What flows through (oil, chips, food).
  4. The phrase "Malacca Dilemma" (Hu Jintao, 2003) and why Beijing worries.
  5. Who could close it (navies, piracy, accidents), with Suez 2021 as proof that one ship can do it.
  6. China's escape routes:
     - pipelines through Myanmar;
     - the Gwadar port and the China–Pakistan corridor;
     - the Kra canal idea in Thailand;
     - the Arctic route.
  7. Why none of them is enough yet.
  8. What happens on the day it closes.
  9. Ending: two beats with a dry button line.
- **Facts:** research and verify every number before writing. Write each source into the script header and put "approx." on estimates. Never invent figures. Check at least these:
  - the narrowest width;
  - ships per year;
  - share of world trade;
  - share of China's oil imports;
  - the year and speaker of "Malacca Dilemma";
  - the pipeline capacities.
- **Tone:** dry, curious, a little dark, and it punches up. No sides taken. Never ask for likes.

## Read first (the rules; follow them exactly)
1. Memory: [[miniature-format]], [[narration-matches-picture]], [[miniature-2d-mg]], [[machine-load-jobq]], [[honesty-no-shortcuts]], [[build-token-budget]].
2. `samples/obj3d/MINIATURE-PLAN.md`. Note that the memory overrides its section 1: MG is now 2D element MG, not 3D in-world MG.
3. `samples/obj3d/audio/README.md` covers voice, sound and the narration-picture gate.
4. The reference implementation:
   - `samples/obj3d/suez.html`: 3D world, camera solver, gates, `?ar=16x9`, the MG2D compositor, the subjects registry;
   - `samples/obj3d/mg2d/board.js` + `art.js`: runtime 2D link board;
   - `samples/obj3d/render.mjs`: modes `still`, `shots`, `video`, `lines`, and `QS=ar=16x9`.
   Reuse and extend; don't fork the look.

## Format rules (non-negotiable)
- **Look:**
  - one white matte miniature world, built per film at runtime and all coded from primitives (kit.js: add exports only);
  - red only on the current focus;
  - tilt-shift, soft sun and shadows;
  - no assets, no AI images, no real photos.
- **Content mix:** 3D world animation, plus 2D element MG (illustrated infographics on a big 2D canvas with its own travelling camera), plus the 3D map animation. MG is about 35% of runtime.
  - **Never typographic MG:** no headline or kinetic-text cards. Text is small captions on elements only.
  - Link boards come from `mg2d/board.js`: cards scattered far apart, and the camera rides the strings.
  - Build a **2D timeline module** (`mg2d/timeline.js`) in the same style and data-driven way: a long strip the camera dollies along, with illustrated elements per event. It replaces the 3D bar timeline, which the user disliked.
  - Use **callouts** on 3D objects through MG2D `overlay` beats: a ring marker plus a leader line plus a small paper label, anchored to the object's projected position every frame.
- **Camera:**
  - camera only, no character motion;
  - mannequins ≤ 25% of frame height, never close-ups;
  - every frame passes the occlusion solver (0 blocked frames);
  - camera speed within the coast2 caps (`camStats`);
  - medium pace: each shot shows its element clearly before moving on;
  - dense means new elements landing, not a fast camera.
- **Props:** no unexplained objects. Every non-scenery object is introduced by narration or a callout. Transition props exist only inside their transition window. The "6" numeral mistake must never repeat.
- **Everything is dynamic at runtime from data:** MG layouts, camera legs and sound cues (`window.__cues`) are solved when the page loads. Nothing is hand-timed.

## Order of work (script first; the picture follows the voice)
1. **Script:**
   - write `samples/obj3d/films/malacca/script.md` with header lines `tempo: 1.15` and `length: <s>`;
   - format: `NARR (emotion) @t [shows: subject]: text`;
   - about 1,250–1,400 words for about 9 min, with a re-hook every 60–90 s.
   Don't wait for approval: self-check the script, then save the chapter list and full script in the final report.
   - **Self-check:** facts sourced, re-hooks present, every line has a `[shows:]` subject the picture can show.
2. **Voice:**
   - `python samples/obj3d/audio/voice.py malacca tts`, then `build` (Fish s2.1-pro, Stickzy voice);
   - fix every pronunciation stop by respelling or `reroll`;
   - the line times in `lines.json` drive the picture.
3. **Picture:**
   - build `samples/obj3d/malacca.html` (+ `malacca-*.js`) from suez.html's engine: world zones for the strait, the Singapore port, a tanker queue, a naval patrol, the Myanmar pipeline landfall and Gwadar;
   - add map beats, 2D boards, the 2D timeline and callouts;
   - camera beats are placed to the voiced line times;
   - register a subject (`SUBJ`, or `{virtual}` for 2D elements) for every `[shows:]` name.
4. **Gates (no full render until all pass, and never loosen a gate):**
   - `node render.mjs shots malacca` with `QS=ar=16x9`: 0 blocked frames, figures ≤ 0.25, text cap ≥ 0.02·H, camStats pass, board gate pass;
   - `node render.mjs lines malacca malacca` with `QS=ar=16x9` must print LINE GATE PASS;
   - review at least 2 rounds of 24-still contact sheets yourself (cropping, haze, red only on focus, nothing unexplained), and fix what you find.
5. **Render, sound and thumbnail:**
   - render through jobq: `QS=ar=16x9 VW=1920 VH=1080 node runtime/jobq.js --kind render --prio 1 -- "node samples/obj3d/render.mjs video malacca 30"`;
   - mix: `python samples/obj3d/audio/mix.py malacca 169`. sound.json has beds per zone and `"cues": "page"`.
     - Use only the existing `dialogue/sfx` library, with the closest substitutes. Don't download anything.
     - List the library gaps (sea, harbour, ship horn) in the report;
   - make a 1280x720 thumbnail in the same look: monochrome miniature, one red subject, a number hook.

## Budget and reporting
- **Cost control:** check usage before heavy phases. Use Sonnet subagents for builders. One render at a time via jobq, never render and voice at the same time.
- **Time targets:** about 30–40 min of render for 16,200 frames, plus the build. Track time per stage.
- **Final report, honest and short:**
  - paths (mp4, thumbnail, sheets);
  - gate numbers;
  - MG share;
  - time per stage;
  - weak spots compared with the Suez reference.
- Nothing is committed unless I ask.
