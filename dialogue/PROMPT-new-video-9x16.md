DIALOGUE: new 9:16 episode, ~1 min, topic: <TOPIC>. Run end to end without stopping for approvals; report at the end.

Repo c:\Repos\HFPipleine\dialogue. Copy the latest episode's structure: episodes/gps2/ (script.md, episode.json, gestures.mjs, STORYBOARD.md, mg.js, headcheck.js, run.sh/batch.sh). Read memory notes dialogue-* first.

1. Script: campfire, Leo (B, curious kid, speaks first) asks; Walter (A, grandpa) explains in plain words; 16-22 short turns, ~160 words; facts sourced in a comment; ends on a dry, funny button from Walter. Format and bar: SCRIPT-VOICE.md and episodes/gps2/script.md.
2. Voice: Fish API key from .vendor-assets/.env (never print it; NOT the MCP connector). Leo = Stickzy, Walter = Adrian. One pass, re-roll at most 2 broken lines, check pitch per line for swapped speakers. Mix like fish/mix_gps.py, but speed the voice to 1.3x (not 1.5x).
3. Shots: compiler/autoplan.mjs, then a gestures override for key words. All camera-variety rules apply (gate f). While an MG card is on screen, use only MS/CU rigs: no wide2, high34, profile2, tent_wide or low_fire under a card.
4. MG: colourful iso kit dialogue/mg/isokit (approved look: indigo, mint islands, coral/saffron/sky/violet, glow only on emitters). Write STORYBOARD.md first: each card SHOWS the mechanism with the sound off. No label-only cards; no templates.js or grey cubes. Use iso only where it helps. Card 54,154 972x560, heads clear (headcheck). Tags and labels must be readable on a phone (>= 28 px). Cards no longer than ~8 s.
5. Thumbnail (REQUIRED, see dialogue/THUMBNAIL.md): add the episode to dialogue/thumbs/hooks.json and run node dialogue/thumbs/make_thumb.mjs <slug> -> episodes/<slug>/out/<slug>_thumb_9x16.png (9:16, one hook, safe zones); view it and iterate until clean.
6. Review, token-lean: review.mjs --run, the MG sheet and ~12 frames of the final mp4. Fix, then re-render if needed.

Rules: heavy jobs only via node runtime/jobq.js --kind render (never lower the RAM floor). No Blender, Ollama, VibeVoice, AI images, photos of real people, downloads, or whole-drive searches. Seated stage (nobody stands or handles props; devices only in the MG). Never loosen a gate. No commits.
Output: episodes/<slug>/out/<slug>_9x16.mp4 AND episodes/<slug>/out/<slug>_thumb_9x16.png. Report: video path, thumbnail path + hook text, script, script, an 8-line honest verdict (what to listen to first), gates, Fish credits, render and wall time.
