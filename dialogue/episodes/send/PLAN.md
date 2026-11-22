# Send episode: picture plan ("What happens when I hit send?", 2026-11-10, made without approval stops on the user's instruction)

Inputs: `script.md`, audio `dialogue/fish/campfire_send_1p5x.wav` (44.45 s = voice 40.45 s + 4 s tail), voice `dialogue/fish/voice_send.wav` (1.5x, atempo, pitch kept), word times `dialogue/fish/words_send.json` (ASR times; text from the script: "99 %" = "Ninety-nine percent,"; "as" re-timed to 21.80 by the energy map after the line-9 splice, ASR had glued it to "swimming").
Voice: Fish drama-3, Leo = Stickzy, Walter = Slax, 3 batches (`fish/take_send/A-C.mp3`); lines 3 and 9 came out whispered and were re-rolled once each as single lines (`R3.mp3`, `R9.mp3`, spliced by `fish/splice_send.py`).
**Deliverable: 9:16 only** (`out/send_9x16.mp4`, 1080x1920). Cast: A = `dadu` = **Walter** (screen-left), B = `rohan` = **Leo** (screen-right). Set: `campfire`. Seated-stage rule: no actor root ever moves; nobody holds a phone.
Pacing: voice is 1.5x. Single-sentence lines are not cut mid-line; Walter's two longer lines (L4, L6) are split at their pauses by a Leo reaction cut-in. Close-ups: 3 (L9 shock, L17 grin, L18 button).
The table below is mirrored as data in `plan.mjs` (read by `dialogue/compiler/compile.mjs send`).

## Shot list (seconds; cut ~150 ms before the new speaker's first word)
| # | Line | Shot | Rig, move | Face | Gesture (on word) | Listener |
|---|---|---|---|---|---|---|
| 1 | L1 Leo curious | 0.00-2.51 | ots_B push 3% | curious | lean in; head tilt "Maya" 0.76 | - |
| 2 | L2 Walter warm | 2.51-4.51 | seat_A push | warm | open palm "tower" 3.84 | - |
| 3 | L3 Leo surprised | 4.51-5.67 | ots_B hold | surprised | head pulls back "Through" 4.66; palm up "air" 5.00 | - |
| 4 | L4a Walter amused | 5.67-6.69 | seat_A hold | amused | nod "Radio" 5.82 | - |
| 5 | L4b reaction cut-in | 6.69-9.05 | seat_B hold | Leo curious | shoulder bounce "shouts" (Walter, off) | Leo slow nod "listens" 8.14 |
| 6 | L5 Leo curious | 9.05-10.45 | ots_B hold | curious | lean in | - |
| 7 | L6a Walter firm-light | 10.45-11.91 | seat_A push | firm-light | head shake "Not" 10.60; open palm "cables" 11.38 | - |
| 8 | L6b reaction cut-in | 11.91-14.03 | seat_B hold | Leo curious -> surprised | - | brows up "sea" 13.52 |
| 9 | L7 Leo confused | 14.03-17.01 | ots_B hold | confused (one brow up) | head back "sea" 14.50; hand to chest "thought" 15.36 | - |
| 10 | L8 Walter firm-light | 17.01-19.99 | seat_A hold | firm-light | palm down "Mostly" 17.16; nod "continents" 19.34 | - |
| 11 | L9 Leo shocked **CU** | 19.99-21.65 | mcu_B push 4% | surprised | hands lift off knees "swimming" 20.86 | - |
| 12 | L10 Walter amused | 21.65-24.05 | seat_A hold | amused | nod "As" 21.80; palm up "glass" 22.74 | - |
| 13 | L11 Leo curious | 24.05-25.49 | ots_B hold | curious | lean in | - |
| 14 | L12 Walter warm 2S | 25.49-30.07 | wide2 push 4% | warm | open palm "computers" 26.14; nod "photos" 27.48; finger flick toward Leo "pass" 29.24 | Leo curious -> impressed "photos" -> thinking "pass" |
| 15 | L13 Leo thinking | 30.07-31.77 | ots_B push | thinking (eyes to fire) | palm up "note" 30.68 | - |
| 16 | L14 Walter pleased | 31.77-34.27 | seat_A hold | amused | nod "Exactly" 31.92; two-hand open "hand" 32.64 | - |
| 17 | L15 Leo curious | 34.27-36.05 | ots_B hold | curious | lean in; head tilt "minute" 35.60 | - |
| 18 | L16 Walter firm-light | 36.05-37.29 | seat_A hold | firm-light | head shake "Less" 36.20; palm down "second" 36.70 | - |
| 19 | L17 Leo grinning **CU** | 37.29-39.49 | mcu_B push 4% | grin, grows at "hour" 38.54 | two-hand open "hour" | - |
| 20 | L18 Walter dry **CU** | 39.49-41.60 | mcu_A deadpan hold | dry (one brow up, side smile) | none | - |
| 21 | tail (no voice) | 41.60-44.45 | wide2 slow push | Leo grin, looks at the fire, deflates; Walter amused | - | - |

Faces: existing presets only. Gestures: existing seated set (open palm, palm up/down, two-hand open, hands lift, hand to chest, flick, nod, slow nod, head shake, tilt, head back, lean in, shoulder bounce, brows up, deflate).
Finger fix (user, this episode): Walter's long stick fingers came from the retarget, not the mesh: the modular rig's `<Finger>1` bone is the METACARPAL (wrist -> knuckle, 12.4 cm, inside the palm) while the mannequin's `<finger>_01` is the proximal phalanx, so the clip and the gesture curl bent each palm strand on its own. Fixed in `engine/core/lib.js` BONE_MAP (`_01/_02/_03` -> `2/3/4`, `1` stays at rest = rigid palm) and `engine/core/world.js` (gesture curl on the phalanges `2-4`). Both actors share this skeleton, so Leo gets the same fix.

## MG: one persistent iso "message world" (9:16 stack card, y 6-44 %; scene below)
Same rules as cloud: ONE world, fixed iso angle, camera pans/dollies 0.5-0.7 s eased then 1-2 % drift; solid flat boxes; dashed ghost = "not real"; mono-caps tags pinned to world points; one verb per beat; our palette (ink, paper, muted, accent #F2A03D, accent2 #86C6D8), ember #D65F2A not used (nothing breaks); no glow, no logos, text only. World left to right: Leo's phone -> tower -> cable under the street (cross-section) -> cable on the sea floor -> the company building (the cloud episode's building, a nod) -> Maya's phone. The message is one paper slab that travels the route.
| Cue | Time | Camera | Beats |
|---|---|---|---|
| 1 PHONE TO TOWER | 2.60-9.00 | close on the phone, pull back to phone + tower | "First" 2.66 phone rises, tag PHONE; "tower" 3.56 tower rises, tag TOWER; "Radio" 5.82 rings from the phone, tag RADIO WAVES; "shouts" 7.18 message jumps to the tower head; "listens" 8.14 head lit |
| 2 UNDER STREET AND SEA | 11.00-16.60 | pan along the street cut, then the sea cut, tilt up | "cables" 11.38 message drops into the street cable; "street" 12.40 runs to the coast, tag UNDER THE STREET; "sea" 13.52 sea-floor cable, tag UNDER THE SEA; "satellites" 16.04 dashed ghost satellite, tag SATELLITE? |
| 3 BETWEEN CONTINENTS | 16.60-24.10 (hand-off from 2) | pull back over both coasts, push in on the sea cable | "Mostly" ghost fades; "99" 18.20 tag 99 % BETWEEN CONTINENTS; "light" 21.98 light pulses run along the cable, tag LIGHT IN GLASS |
| 4 COMPANY COMPUTERS | 25.60-30.20 | dolly to the building, pan to Maya's phone | "computers" 26.14 racks rise, message lands on a rack, tag COMPANY COMPUTERS; "photos" 27.48 tag SAME AS YOUR PHOTOS; "Maya's phone" 28.76 phone rises, tag; "pass" 29.24 message flies to it, check |
| 5 HOW LONG | 31.90-37.40 | pull back to the whole route | "hand to hand" 32.64 each hop lights in turn; "minute" 35.60 tag 1 MINUTE? (muted); "Less" 36.20 message zips phone to phone, timer 0.0 -> 0.2 S, tag UNDER A SECOND, check |
MG cards stay >= 1.5 s, <= 12 words per card. The 0.2 s timer is an illustrative typical figure (London fibre ~0.04-0.1 s one way + server time; texts normally land in a fraction of a second); the spoken claim is "less than a second".

## Captions
Script text, 2-6 word phrases, word times mapped by order. Geist SemiBold cream, soft shadow, no box. 9:16: bottom third when no MG; under the card when it is up; never over a face; safe areas (top 8 %, bottom 18 %).

## Gates (all before the full render; never loosen)
shot list = this table; contact + penetration; seated; face per line; cut timing vs words_send.json; captions + mg.lint; iso subjects inside the card; blown white < 2 % of pixels with luma >= 250 on every sheet still and every sampled final frame.
Render only via `node runtime/jobq.js --kind render -- ...`; mux with `campfire_send_1p5x.wav`, trim to audio length.
