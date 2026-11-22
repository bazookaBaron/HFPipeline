# ytrec storyboard (9:16, iso MG, voice at 1.3x)

Topic: how YouTube picks the next video. Look: the approved colourful iso kit (mg/isokit) on the deep-indigo field. Iso is used where depth helps (the library of millions of videos,
the three-station loop, the viewer's phone); the bar boards (counts, scores, click vs watch) are flat bars drawn in the same palette because bars read better flat on a phone.
Colour: sky = watch time / signal packets, mint = picked / kept / "good", violet = replays / candidates, coral = skips / bad, saffron = the winner / shiny, ember = only "broken" (left early).
Times are global episode seconds (mg.js looks the words up in shots.json at run time). Sound-off test: every card has to show the mechanism moving, not a label.

Card layout (9:16 `float`): card x 54, y 154, 972 x 560. Heads clear (episodes/ytrec/headcheck.js). Every text >= 28 px (hud 34 x .85; own text 30 px). No card longer than ~8 s.
Cards enter and leave on the nearest shot cut. Under cards only MS/CU rigs (no wide2, high34, profile2, tent_wide, low_fire).

| # | Card | On screen | What moves (sound-off read) |
|---|---|---|---|
| 1 | SIGNALS | L4-L5, 7.13-14.03 | A viewer's phone (play triangle on its screen) on a small island at the left; a board of four empty bars at the right: WATCH TIME (clock icon), REPLAY (loop arrow), SKIP (skip glyph), LIKE (heart). "How long you watch": a sky packet flies phone -> board and the WATCH TIME bar fills. "What you replay": violet packet, the REPLAY bar jumps twice. "What you skip": coral packet, the SKIP bar ticks up fast. "It counts my skips?": the SKIP row blinks, then the LIKE row fills. |
| 2 | PICK | L6-L7, 14.03-20.75 | A big island covered in ~190 small colourful video tiles (the library of millions) and a small tray island at the right. "Picks": a lens ring sweeps over the library; 24 tiles light up mint, rise, and fly in an arc to the tray where they land as a neat grid. Chips: A FEW HUNDRED over the tray, MILLIONS over the library, and a JOB 1 · PICK header. "Hundreds out of millions": the tray tiles bounce and the library dims. |
| 3 | RANK | L8, 22.55-29.11 | Five video thumbnails in a list, each with an empty score bar; a small phone island at the right. "A second job scores each one": the bars fill to different lengths, one after another. Header HOW LONG WILL YOU WATCH? "The best score goes first": the rows slide into order (longest bar on top), the top row gets a saffron frame and a TOP PICK chip, and a packet flies to the phone, whose screen takes on that thumbnail's colour. |
| 4 | CLICK VS WATCH | L9-L10, 29.11-36.41 | Two videos, a SHINY one (saffron, sparkles) and a PLAIN one (violet), each with two bars: CLICKS (sky) and WATCHED (mint). "Click is cheap": a cursor taps and the shiny CLICKS bar races to full while the plain one barely moves. "Watch time is the prize": the WATCHED bars fill (shiny tiny, plain long), a trophy lands on the plain row with a saffron frame, a coral X lands on the shiny one, chip WATCH TIME WINS. |
| 5 | LEFT EARLY | L11-L12, 36.41-41.59 | A shiny-title video tile with a progress bar that plays a little; a SCORE gauge at the right full of mint. "A liar of a title": a BIG PROMISE sticker pops on the tile. "If you leave after a few seconds": the playhead stops near the start, an ember arrow shows the viewer leaving, chip LEFT EARLY / A FEW SECONDS. "It learns": a packet runs from the progress bar to the gauge and the gauge falls, coral arrow down, chip SCORE DROPS. |
| 6 | THE LOOP | L13-L14, 41.59-48.25 | Three islands in a triangle: WATCH (phone), LEARN (tally towers), PICK (stack of videos). A glowing packet runs round the triangle (once slowly while "what I watch next feeds the next round", then station by station on the words "watch, learn, pick again"); each station lights on its word; on "a loop" the whole triangle glows and chip LOOP appears. |
| - | (no card) | L1-L3, L15-L16 + tail | The hook, the cat-video joke and Walter's dry button are on faces. |

Coverage: watch signals (watch time, replays, skips, likes) (1), candidates picked out of millions (2), ranker scoring = expected watch time, best first = top pick served (3),
watch time beats clicks (4), leaving early lowers the score (5), the viewer's reaction feeds the next round = loop (6).
