# Miniature lessons: mistakes from China v3, Trump v3, Nvidia v4, Trump v4 and China v4 (read before every film)

Each mistake below cost a re-render or a user complaint. Each has a rule, plus the gate or tool that now enforces it. If a rule has no gate yet, a person checks it before render. Never loosen a gate to get a film through.

## Script
1. **The script sounded AI-written, and viewers didn't know the people named.**
   - Use plain layman English (memory script-plain-layman). Name people by role. Name only widely known people, and say who they are the first time.
   - Cut these patterns: "Same X. Same Y." stacks, rule-of-three lists, dramatic one-word lines, "here's the thing", "not X, it's Y", fake suspense.
2. **The "chapters" were 35–95 s fragments, the cold open was 40 s, and chapters ended on flat facts.**
   - Use 5–7 chapters of 75–110 s, a cold open of 20 s or less with one question, and a re-hook at the end of every chapter.
   - Use the script_v4 format (`#hook`, `#chapter n | Title | set:`, `{loop}`/`{payoff}`, `{dry}`, `#part`, `#payoff`). See SCRIPT-REVIEW-2026-11-15.md.
3. **Claims went beyond the fact block, so the fact check failed on all three films.**
   - A fact-check agent compares every claim with the header's fact block before voicing. Unverified reports stay attributed ("one report claims").
4. **One film's header was replaced by another film's fact block**, because two writers shared a scratch file.
   - Each writer uses its own scratch path, named after the film.
   - Before voicing, diff the script_v4 header against the film's original script.md header.
5. **I wrote the spoken end line myself, and it was "AI slop".**
   - Every spoken line, including CTAs, patches and inserts, comes from the script-writer agent, which gives three options (memory no-self-written-lines).
   - The end line is plain and short, and asks for like and subscribe.
6. **TTS would have read the inline tags aloud.** `voice.py` now strips `{...}` before TTS. When you add a new tag type, check the TTS text.

## Voice
7. **The ASR heard "Nvidia's" as "vidyas" (pronunciation flag).** Reroll that line once (`voice.py <film> reroll N`). If it fails twice, have the writer rephrase it.
8. **lines.json had 79 lines but the plan had 78 after a line was added.** Whenever lines change, regenerate the plan. `render.mjs lines` rewrites lines.json. The shots stale check doesn't watch mg2d/, so re-run shots after any MG change.

## Sound
9. **There were too many cues, odd ones, and cues that didn't match the set.** Cues were picked from narration words, and a density gate forced filler.
   - Play one ambience bed per set type (`archetypeOf`).
   - Add world cues only for visible props, poses or vehicles, at least 10 s apart.
   - Gates: bedMatch, cueMatch, maxDensity, wordClear.
   - Never fill a gap with a cue.
10. **Loudness was slightly over target (−13.6 LUFS / −0.7 dBTP).**
    - Target −14 LUFS integrated and a −1 dBTP peak.
    - Check the mix log after `mix.py`. Re-run with lower gain if it's outside ±0.5 LU or the peak is above −1.

## Camera and picture
11. **The camera was abrupt**: shots held still, then hopped in about 1 s with no easing. **Then it became too gentle** (median 0.46°/s).
    - Use one smootherstep move per line (`roomRunKeys`), live dissolves of 1.0–1.2 s, and CAM_CAP per scale. Aim for about 2–4°/s.
    - Run `node keycheck.mjs <film>` before render.
12. **One-frame pops appeared at the start of live dissolves.** The fix is half-frame tolerance in the dissolve start. Spot-check the first frame of each dissolve on the contact sheet.
13. **The red focus turned white just before scene changes (flicker).** Focus was keyed by time and cleared while the dissolve still showed the old shot.
    - Focus is now per shot (`focusOfKey`, FW/FWO tables), enforced by the `focusHold` gate.
14. **MG text overflowed its papers.** Cards were measured at 1x, and the caption was scaled up to 1.5x.
    - `ui.fitText` wraps the text, then shrinks it, then adds an ellipsis. The `text-overflow` gate enforces it.
    - Any new kind must draw its text with fitText.
15. **Known weak spots to avoid next time:**
    - a small chapter title board;
    - figures too small in wide rooms;
    - a sparse TV studio and port shed;
    - a waffle chart showing a faded "0.0%" counter.
    Check these on the contact sheet.

## Real images (evidence cards)
16. **Too few real images**: 13 cards on 14 of 79 lines. **People and documents that were mentioned weren't shown.** Rule from 2026-11-15:
    - Show a licensed photo card on the first mention of every widely known person, and again when they come back after a long gap.
    - Do the same for every named company HQ or building, document (filing, rule, letter, court record), product, place or event, where a licensed image exists.
    - Each such mention gets a card, or a line in `photos_missing.txt` saying why not (no licensed image found, or video frame only).
    - This is a coverage rule, not a quota. Never use an unlicensed or off-topic image to fill a slot.
    - A rough guide from the puppet pipeline: 25–40 cards in a 9-minute film.
    - Gate: the producer writes `films/<film>/entities.json` (`[{"name","kind":"person|org|place|document|product|event","lines":[n...],"aliases"?:[...]}]`); `node photocheck.mjs <film>` (from samples/obj3d) fails when a first mention has no card on that line or the next/previous one and no `Name: reason` line in `photos_missing.txt`, and prints cards, cards/min and uncovered entities.
    - `render.mjs shots` runs the same check and adds `photoCoverage` to the v3 gate fails once entities.json exists (no entities.json = warning only, for older films); a photos.json entry without `contentCheck: "ok — ..."` fails both photocheck and shots (`photoContent`) for every film. Backfilled 2026-11-15: nvidia_v4's 13 photos (buildings, portraits, products, documents) were viewed and marked ok.
17. **Image sources** (this network):
    - commons.wikimedia.org is blocked, so read licences through the en.wikipedia API (`prop=imageinfo&iiprop=extmetadata`) and download from upload.wikimedia.org.
    - US federal government works are public domain: whitehouse.gov official portraits, congress.gov member photos, DoD/DVIDS, govinfo.gov documents.
    - federalregister.gov has a bot wall, so use govinfo.gov.
    - Skip YouTube or TV frames: they aren't licensed photos.
    - **Policy since 2026-11-15 (user decision):** news and copyrighted photos are allowed, with a credit on every card and in the YT description ("images belong to their owners").
      - Prefer this order: licensed or public domain, then official press kits and newsroom images, then the person's or org's own posts, then news photos.
      - Record `"licence": "copyrighted, credited (fair-use commentary)"` in photos.json, plus the source page URL.
      - Keep cards small, greyscale and cropped (commentary use).
      - Avoid Getty Images where a different photo of the same thing exists, because Getty enforces most aggressively.
      - Still banned: AI images of real people.
    - **Content filter (user, 2026-11-15). Never use:**
      - gore or blood, dead or mutilated bodies, killings or executions, torture, or a person being shot or stabbed;
      - any image of child abuse or children in distress;
      - sexual content.
    - **Allowed:** accident scenes (crashed cars, damaged buildings, wreckage) with no visible injured or dead people.
    - Every photo must be opened and looked at before use. photos.json gets `"contentCheck": "ok — <what it shows>"`, and photocheck fails any card without it.
    - When in doubt, leave it out and use a building, document or place photo instead.
18. **Cards are greyscale with a red pushpin and a credit line on the card** (`photo_cards.js`).
    - Record every card in `photos.json` and `credits.txt`, and put the credits in the video description.
    - The photo gate blocks a card that has no credit or that covers the red subject.
    - When a document is unreadable at card size, retype it word for word (say so in photos.json); never paraphrase.

## End card and delivery
19. **The end line asked for a like, but the end card had only a Subscribe pill.**
    - The end card has Like and Subscribe pills (flat, bottom-centre; memory channel-endcard-style), each pressed on its spoken word.
    - Built into film.html (2026-11-15): the Like pill appears only when the endcard line has a word starting "like"; it presses on that word and fills to "Liked".
    - **End card v2 (2026-11-15)**: a white paper tag card at bottom centre (photo-card language: ink hairline, soft shadow, red pushpin), channel mark + name | Like | Subscribe, one eased slide-up, no glow/gradient/bounce/scrim. Presses land on the real word times (words.json); Subscribe turns into a red-ink "SUBSCRIBED" stamp. Alternative design B (`?endstyle=rule`, paper footer band + red rule) was rejected: it reads as a web footer and hides the foreground. Review stills: out/review/endcard_v2/.
    - **Two channels, every film ships twice**: out/<film>_169_final_partition.mp4 (Partition Lines) and out/<film>_169_final_powder.mp4 (Powder Keg). Only the last line (channel-named, from the script writer) and the end card name + mark differ (`film.html?channel=partition|powder`; mark drawn in code: split square / keg with fuse).
    - **How to run (producers)**: put the writer's lines in films/<film>/channels.json `{"partition": {"name": "Partition Lines", "line": "NARR (...): ..."}, "powder": {...}}`, then AFTER the main render (out/<film>_169.mp4) run from the repo root: `python samples/obj3d/variants.py <film>`. Stages (each through jobq; resume with `--from <stage>`, one stage with `--only`): voice (`voice.py <film> alt <ch>`, Fish, film's own model/tempo; name must be heard as separate words by large-v3, else reroll once with `--reroll`, then the writer's fallback form) -> prep (variants/<ch>/ lines, words, voice.wav with the last line swapped, beds, sound.json) -> gate (render.mjs shots with ?channel) -> render (only the tail: env FROM = 1 s before the last keyframe that is >= 1.5 s before the final shot) -> splice (PSNR check of the overlap vs the main render, head stream-copied, tail encoded with the same x264 settings, concat) -> mix (mix.py --voice/--lines/--beds/--sound, -14 LUFS / -1 dBTP) -> check. Reports: films/<film>/variants/<ch>/splice_check.json and check.json; splice stills + voice-join waveforms in out/review/variants/<film>/.
    - render.mjs: `FROM` / `TO` env (seconds) render a time range to out/<name>_from<frame>.mp4; `channel=` in QS suffixes every output with _<channel>. Default behaviour unchanged.
20. **No thumbnail was made for Nvidia v4.** A film isn't done until all of these exist:
    - `out/<film>_thumb.jpg` (1280x720), made by `films/<film>/make_thumb.py`: a film frame, monochrome with the one red subject, a number hook and a label tag, no faces;
    - `credits.txt`;
    - the final mp4;
    - REPORT.md.
    - `audio/mix.py` prints a WARNING after the final mux when `out/<film>_thumb.jpg` is missing.
21. **Report honestly**: list the weak spots and what you skipped, and never oversell.

## From Trump v4 and China v4 (2026-11-15). The user approved both films as the quality bar.
22. **Trump came out at 12:05 instead of 8–9 min.** The script was 2,013 words, and nobody counted before voicing.
    - Before voicing, count the spoken words (strip the headers, tags and `NARR (...)` prefixes).
    - Target **1,450–1,650 words for 8–9 min**: the measured rate with gaps is 165–185 words per minute.
    - If the script is over, send it back to the script writer to cut lines. Don't voice it and hope.
23. **The Powder Keg end line failed the name check.** Fish runs "Powder Keg" together, so large-v3 hears "Powderkeg" when the name sits mid-sentence ("subscribe to Powder Keg.").
    - Ask the writer for an end line where the name **ends its own short sentence**. Approved forms:
      - Trump: "…Like the video, and subscribe. This channel is called Powder Keg."
      - China: "…Like the video, and subscribe to the channel to see how they end. It's called Powder Keg."
    - The writer writes the line for each film (never copy these word for word). Put it in channels.json from the start.
    - "Partition Lines" passes mid-sentence.
24. **`voice.py alt` reused a cached take after the line had changed.** The check then ran on old audio. Fixed: the take is re-voiced whenever the text differs from `take/alt_<ch>.txt`.
25. **The mp4 true peak came out above −1 dBTP on all three films** (−0.3 to −0.7). The AAC encode overshoots the loudnorm target.
    - `mix.py` now defaults to `MIX_TP=-2`, which lands the mp4 at about −1.3. variants.py's mix uses the same default.
    - Still read `check.json` or run ebur128 on every final mp4. If the peak is still above −1, re-mux the audio through `alimiter=limit=0.804` with AAC 192k and the video stream-copied.
26. **The MG share fell to 15% in China** (was about 35%). Number beats failed kind-fill or the 4 s event gap on long lines, and the producer turned them into labels.
    - Write number lines short (at most about 6 s) so one MG beat can carry them.
    - Split long number lines into two beats, or give the beat a two-stage reveal.
    - Never loosen the gate. If MG ends up under 25%, list it as a weak spot.
27. **Credited news photos were not used in China, so 7 entities had no card.** The producer's brief said "licensed only".
    - **The user's standing consent (2026-11-15):** "we can use any photo … copyrighted and unlicensed also, just give credits". Write this into every producer brief so the photo step uses item 17's full preference order.
    - The content filter (item 17) still applies, and no Getty where an alternative exists.
28. **Subagents can't write REPORT.md** (the harness blocks report files from subagents). The producer returns the report as text, and the main thread writes `films/<film>/REPORT.md`.
29. **Remaining ASR flags after one reroll are built with `--force` only when they are near-homophones** ("traitor"/"trader", "ladder"/"latter", place names). List those lines in the report so the user can listen.
30. **Time estimates slipped by 1.5 h.** Variants, voice and snap jobs queue behind renders, since there is one render at a time and no voice job during a render.
    - Measured stage times:
      - setup and TTS: 15 min;
      - photos: about 1 h, in parallel;
      - plan plus about 8 shots runs: about 2 h;
      - render at about 0.155 s/frame: about 50 min for 8.5 min of film, 1 h 10 min for 12 min;
      - mix and thumbnail: about 15 min;
      - one channel variant: about 12–15 min.
    - With two films in flight, add the other film's render to every estimate.
31. **Quality bar = Trump v4 and China v4.** Match or beat what they had:
    - 4.5–5 photo cards per minute;
    - in-world chapter titles;
    - 85% room and street time;
    - set-driven sound;
    - end card v2 with the spoken like + subscribe;
    - a thumbnail with a number hook;
    - every gate green.
    - Their weak spots, which the next film must avoid:
      - sparse exteriors (trains, Capitol, villa);
      - tiny street figures;
      - blocky cars;
      - MG text cut with "…";
      - title boards hidden by trees;
      - no courtroom ambience bed.
