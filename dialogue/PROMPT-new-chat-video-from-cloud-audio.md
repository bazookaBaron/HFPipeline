# Prompt for a new chat: build the VIDEO for the "Where do my photos go?" episode

Paste everything below the line into a fresh Claude Code session in `C:\Repos\HFPipleine`.
(The earlier prompt for writing a new script and voice is superseded: `PROMPT-new-chat-tech-explainer-1min.md` is kept only for future episodes.)

---

You are working in C:\Repos\HFPipleine (branch v3/world-pipeline) on the **DIALOGUE** pipeline: two low-poly 3D characters
(three.js, rendered through HyperFrames / the dialogue engine) sitting and talking by a campfire, with small "field notebook" motion graphics.

**The script and the audio are FINAL. Do not change, re-write, re-voice or re-time them.** Your job is the picture.

## Fixed inputs
**Pacing: the voice runs at 1.5x, so lines are quick. Cuts, gestures, captions and MG are timed to the 1.5x track; hold shots 0.8-1.5 s, use snappy expression changes, and keep MG cards on screen at least 1.5 s. One pass only: do not ask for a re-voice.**

- Script (with per-line `(beat)` and `[cam]` tags): `dialogue/episodes/cloud/script.md`
- Final mixed audio: `dialogue/fish/campfire_cloud_1p5x.wav` (and `.mp3`), **45.4 s: the voice is time-stretched 1.5x (user decision)**, plus a quiet pad, campfire ambience and foley.
- Voice-only track (for lip-sync and timing): `dialogue/fish/voice6.wav` (the 1.5x voice), with word timings in `dialogue/fish/words6.json` (`[start, end, word]`; the ASR heard "A company's" as "Accompanies", so use the script text for captions, not the ASR text, and use the ASR only for times).
- Cast: **Leo** = the younger one (the engine still calls him `rohan`, Casual_Hoodie); **Walter** = the grandfather, the advice-giver (still `dadu`: King head + Farmer body). Set: **campfire** only. Ratios: 16:9 first, then 9:16 (same build).
- Voices (already rendered, for reference): Leo = Stickzy, Walter = Adrian (Fish Audio).

## Read first, in this order (keep your main thread lean; do not paste file dumps back to me)
1. `dialogue/PLAN.md` (v4, sections 3-7), `dialogue/STYLE-GUIDE.md` (**the seated-stage rule box before section 4**, sections 4-5 acting + camera, section 6 MG, section 9 layouts)
2. `dialogue/SCRIPT-VOICE.md` **section 3b** (seated-stage rule: the picture must match the script, line by line)
3. `dialogue/engine/notes.md` (what exists: `render.mjs` jobs `still|hero|gate|video|bench`, rigs `wide2 mcu_A mcu_B ots_A ots_B insert seat_A seat_B`, face layer, MG adapter) and the approved baseline `dialogue/spike1/out/` (the look the user approved: hero_wide_16x9, hero_mcu)
4. `dialogue/ref/voice_study/FINDINGS.md` (how the reference shows two people talking)

## Honest state of the pipeline (verify before relying on it)
Phases 0-2 are done (cast, campfire set, rigs, face layer, deterministic renders). **Not built yet:** the dialogue compiler (script + word timings -> shots, acting, visemes), the MG template kit, the final mix hook and the pilot run (PLAN section 7 phases 3-5). If something here is missing, say so; do not fake it.

## What to do (plan first, then build; I approve the plan before you spend big tokens or render)
1. **Plan (short, in chat, no code yet):** the shot list for all 18 lines, derived ONLY from the script's tags and the audio timings: for each line the rig (CU = `mcu_A/B`, MS = `seat_A/B`, 2S/WIDE = `wide2`, OTS = `ots_A/B`), the camera move (hold or slow push-in; no change without a reason in the line), the facial expression from the `(beat)` tag (worried, surprised, amused, confused, grinning, proud, dry-smiling), one seated hand gesture per line that matches its meaning, and the listener's reaction on the other character's line. Use 2-4 close-ups total (the shock at "someone else's computer?", the realisation "so the cloud is just... someone else's computer", and the last joke "Forty-one."). Time every cut to the word timings (cut on the first word of the new speaker or 100-200 ms before it).
2. **Seated-stage rule (binding):** nobody stands, walks, fetches, points at something far, hands over an object or leaves. Only seated micro-acts: nod, head tilt, shrug, lean in/back, look at the fire or at the other, small hand gestures while talking. Anything "happening" in the story (the building, the fans, the spare key) is shown by the MG only.
3. **MG (3-4 cues, templates only, no AI images, no photos of real people):** e.g. a simple label card "the cloud = a building of computers" at the first answer, a tiny "room of computers + fans" diagram at "with a lot of fans", a "photo -> copy 1, copy 2, copy 3" diagram at "spare copies", and a number card "40 -> 41" on the last line. Keep it calm: a beat every 6-10 s, 9:16 = card on top of the scene, 16:9 = MG in the centre area per STYLE-GUIDE section 9. Put the cues in a `mg.json` next to the script; do not edit the script.
4. **Build** the missing compiler pieces (script tags + `words6.json` -> `shots.json` -> engine frames), with a contact-sheet gate **before** any full render: one still per line pair (CU/MS/2S), checked against the baseline look in `spike1/out/`. Mouth shapes must follow the voice (visemes from the word timings). Captions: script text, word-timed, bottom third (9:16) / lower strip (16:9).
5. **Gates before rendering the full video:** contact + penetration gate (no floating or sinking, hands on knees or near the fire, no legs through the log), face/expression gate per line, cut-timing gate against `words6.json`, and the seated gate (a scripted check that no actor's root moves).
6. **Render** 16:9, then 9:16, only through `node runtime/jobq.js --kind render -- ...`. Mux with `dialogue/fish/campfire_cloud_1p5x.wav` (do not re-mix; trim video to the audio length). Deliver `dialogue/episodes/cloud/out/cloud_16x9.mp4` and `cloud_9x16.mp4` plus a 10-line honest verdict (which lines look right, which do not, render time, tokens used).

## Rules that always apply
- Be honest; never loosen a gate to pass; say at once when a job waits on the queue or RAM.
- Heavy jobs only through `node runtime/jobq.js`; never run whole-drive searches; Ollama off, no Blender, no VibeVoice, no AI images in the MG.
- Never print API keys (Fish key is in `.vendor-assets/.env`, gitignored). No more voice generation is needed for this task.
- Ask before any destructive or outward-facing action. Keep summaries short.

THUMBNAIL (required deliverable): also make the thumbnail in the same format as the video (9:16 -> 1080x1920, 16:9 -> 1920x1080) per dialogue/THUMBNAIL.md, and name its path and hook in the report.
