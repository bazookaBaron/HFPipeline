# abr storyboard (9:16, iso-kit colours, voice at 1.3x)

Topic: how Netflix / YouTube stream without buffering (adaptive bitrate: HLS / MPEG-DASH). Hook: "Why does it go blurry, then sharp again?"
Look: the approved colourful isokit palette (deep indigo field, mint/teal plates, coral / saffron / sky / violet, glow only on emitters: the wifi bars and the flow dots).
The subject is ONE little picture (sun, hills, a house) drawn at three qualities: BLURRY (5x4 blocks), OK (10x8 blocks), SHARP (clean vector). Every tile is large (>= 142 px wide on the 1080 frame) so it reads on a phone.
Iso is used only for the chunky plates / server stack / TV; the mechanism is drawn flat on purpose (tiles must be readable).
Colour: sky = the data / wifi, mint = ok / saved video / on time, saffron = the chosen one / the cushion, coral = the sharp tile being late, violet = slow, ember = only "broken" (the freeze).
Times are global episode seconds (words from shots.json; mg.js looks the words up at run time).
Sound-off test: every card has to show the mechanism moving, not a label.

Card layout (9:16 `float`): card x 54, y 154, 972 x 560. Heads clear (episodes/abr/headcheck.js). Every text >= 28 px (hud 34 x .85). No card longer than ~7.5 s.
Cards enter and leave on the nearest shot cut. Under cards only MS/CU rigs (no wide2, high34, profile2, tent_wide, low_fire).

| # | Card | On screen | What moves (sound-off read) |
|---|---|---|---|
| 1 | PIECES | L2-L3, 3.3-8.4 | A film strip (six sharp pictures with sprocket holes) lies across the card: "ONE MOVIE". Coral dashed cut lines flash between the pictures, the strip falls apart into a tumbled pile (chip LITTLE PIECES), then the pieces line up in a 3 x 2 grid with numbers 1-6. |
| 2 | QUALITIES | L4, 8.6-16.1 | A row of four numbered sharp pieces. A time bar under the first one (chip A FEW SECONDS). Each piece drops two copies below it that turn OK and BLURRY: a 3-row ladder. File-size bars at the left: a short bar for the blurry row (chip SMALL), a long bar for the sharp row (chip BIG). |
| 3 | THE PICK | L5-L6, 16.3-22.9 | Server stack (left) -> thin pipe -> TV player (right). A "?" over the player. A rack of the three qualities appears (NEXT PIECE). The last piece travels down the pipe while a stopwatch runs and a speed gauge needle swings from SLOW up to FAST; on arrival the sharp tile in the rack lights up (FAST: SHARP NEXT). |
| 4 | SLOW WIFI | L7-L8, 23.1-29.7 | Same stage. The wifi symbol loses two bars, the pipe narrows to a thin tube, the needle falls to SLOW. A request arrow runs from the player back to the server shelf (big sharp, ok, small blurry): the small blurry piece lifts out (saffron ring), slides through the thin pipe and lands on the TV (mint tick, ON TIME); the big one stays behind with an ember cross (LESS TO CARRY). |
| 5 | THE RACE | L9-L10, 29.8-36.8 | Two lanes. Lane 1 (WAIT FOR SHARP): TV + a film track; the playhead creeps toward the next empty slot while the sharp piece fills it slowly (progress bar inside the slot); the playhead gets there first: the TV greys out under a spinning circle (FROZEN). Lane 2 (TAKE THE BLUR): the slot is filled at once by a small blurry piece, the playhead rolls over it and the TV keeps playing a blurry picture (KEEPS PLAYING). At "a spinning circle, never" lane 1's spinner swells with an ember cross, lane 2 stays calm. |
| 6 | CUSHION | L12, 38.2-42.7 | A track of ten pieces: played ones greyed, a playhead, then saved pieces in mint, then empty dashed slots. A saffron cushion (pillow) sits on the saved stretch with a bracket (chip CUSHION). "Downloaded ahead": new pieces pop in at the right end faster than the playhead moves, the cushion grows fat (chips DOWNLOADING, WATCHING). |
| 7 | FAT OR THIN | L13-L14, 42.8-49.6 | Row 1: a track with a fat mint cushion -> arrow -> a big SHARP tile (chip RISK IT). Row 2: a track where the playhead is almost at the download front (thin cushion) -> arrow -> a small BLURRY tile (chip PLAY SAFE). |
| 8 | BACK TO SHARP | L15-L16, 49.8-55.3 | A wifi speed curve (sky) that dips and recovers, with a cursor sweeping it; under it a row of seven pieces appears one by one at the cursor: sharp, blurry, blurry, ok, sharp, sharp, sharp (chips WIFI BACK, SHARP AGAIN, PIECE BY PIECE). |
| - | (no card) | L1, L11, L17-L18 + tail | The hook, "So it just guesses?", Leo's grin and Walter's dry button are on faces (mcu_B grin, mcu_A button held to the end, wide tail). |

Coverage: movie = pieces of a few seconds (1), stored in several qualities (2), player picks per piece from how fast the last one arrived (3), slow wifi = small piece (4), waiting for sharp freezes the picture (5), the buffer is a cushion of video saved ahead (6), fat cushion = risk the big piece, thin = play safe (7), speed returns = sharp again, piece by piece (8).
