# qr storyboard (9:16, colourful iso kit, "The goat ate the QR code")

Look: the approved colourful iso kit (mg/isokit) on the deep-indigo field: mint islands, coral / saffron / sky / violet
accents, glow ONLY on emitters (scan beam, pulses, the "light" module, rebuilt squares flashing in). Ember = damage
(the bite, oil, scratch, missing letters). Mint = fixed / read OK.
Iso only where it helps: the camp sign, the factory belt and the "logo in the middle" sign are iso worlds; the bit-row,
the zigzag and the finder cards are the QR grid itself, lying flat on a mint island seen in iso (one world, camera moves),
so it still reads as the same object everywhere.
Times are global seconds of the 1.3x track (words from shots.json; mg.js looks the words up at run time with W(line, word)).
Sound-off test: every card has to show the mechanism moving, not a label. No label-only beats, no templates.js, no grey cubes.

**The QR itself (one asset for all cards):** a real 25x25 (version 2) module grid, generated in mg.js from a fixed bit
pattern (deterministic, seeded) with the three 7x7 finder "eyes" in the top-left, top-right and bottom-left, the small
5x5 alignment square near bottom-right, timing dots between the eyes, and a quiet-zone border. Dark modules = deep
indigo/ink, light = cream. It is a picture of a QR, it doesn't need to decode (no scannable link; nothing real is
encoded). The bite is always on the right edge, middle-ish, missing all three eyes (true to the facts note).

Card layout (9:16 `float`): x 54, y 154, 972 x 560, bottom at y 714; caption row centred y 786; heads clear (headcheck.js:
head-top + face of both actors never above card bottom + 40 px). Cards enter/leave on the nearest shot cut (<= 0.35 s).
Text: every tag/label/counter >= 28 px at 1080 wide (phone-readable), at most ~3 words per tag. Max ~8 s per card.

| # | Card (tag) | On screen | Enter / out | What moves (sound-off read) |
|---|---|---|---|---|
| 1 | THE BITE | L1 | 0.55 -> 4.75 | Iso: a wooden camp sign on a post on a mint island (pine tree, little tent behind), the QR on its face. "goat" 0.64: a goat-shaped bite (scalloped curve, ember edge) chomps out of the QR's right edge, 3 quick crunch steps, a few loose modules tumble to the grass. "QR code" 2.24: a phone (iso, standing in front of the sign, no hand) raises a scan cone (glow) across the code. "still works" 3.08: cone turns mint, the phone screen flips to a tiny MAP with a pin dropping, tag "MAP OPENED" (mint). "How?" 3.94: camera eases in on the bite, hold. |
| - | (no card) | L2-L3 | - | Walter "built for goats" on his face; Leo's "Built for goats?" reaction. |
| 2 | BUILT FOR DIRT | L4 | 9.41 -> 16.45 | Iso factory island: a conveyor belt (rollers turning) carries 3 car-part crates (gear on top, saffron), each with a QR label. "factories" 9.92: belt starts, crates slide. "Japan, 1994" 11.4/11.9: a calendar tile flips to "1994" (counter 1990 -> 1994) on the factory wall. "Oily" 13.28: an oil splat (dark violet blob, ember rim) lands on the next crate's label; "scratched" 13.96: two ember scratch strokes rake across it. "labels" 14.2: the crate passes under a scanner arch: beam sweeps, arch light goes mint + tick, tag "STILL READS". "Close enough" 15.46: a cartoon goat silhouette tile pops beside the crate (the joke), camera drifts. |
| - | (no card) | L5 | - | Leo "It's just squares." |
| 3 | SQUARE = BIT | L6 | 18.95 -> 25.87 | The QR lies flat on a mint island (iso). "tiny square" 19.3: camera pushes into the top row; 8 modules lift up out of the grid (stagger) and stand in a row, big. "yes or a no" 20.6/21.3: each lifted module flips, dark tiles show a big "1", light tiles a "0" (glyphs >= 40 px). "Dark is one" 22.16: the dark tiles pulse; "light is zero" 23.38: the light tiles pulse. "Eight make a letter" 24.78: a bracket sweeps under the 8 tiles, they fold together into one big letter tile "m" (the first letter of "map"), counter "8 SQUARES = 1 LETTER". |
| 4 | THE ZIGZAG | L7-L8 | 25.87 -> 31.69 | Same world, camera pulls back to the whole code. "map link" 26.4: a small link chip "map.camp/…" hovers above the island; letters m, a, p drop one by one INTO the grid as lit 8-module blocks (saffron). "zigzag" 28.84: a glowing reading head starts at the bottom-right corner and snakes up a 2-module-wide column, then down the next, then up (the real placement order), lighting the modules it passes, a trail line behind it. "bottom right corner" 30.28: a pulse ring at the start corner, tag "START". |
| 5 | THREE EYES | L9-L10 | 31.69 -> 39.55 | Same code. "three big squares" 32.08: the three 7x7 finder eyes lift a little and glow coral, numbered 1 2 3. "here I am" 34.8: each eye sends out a ring pulse (glow). "Sideways" 35.92: the whole code turns 90 deg on the island, a phone viewfinder bracket (sky) snaps onto the 3 eyes and locks (tick). "upside down" 36.66: code turns to 180 deg, viewfinder re-locks on the eyes. "finds them" 38.46: lock flashes mint, tag "FOUND". |
| 6 | WHICH WAY UP | L11-L12 | 39.55 -> 45.13 | Same code, tilted at an odd angle (~135 deg). "four corners" 41.02: four corner markers appear; three sit on eyes (coral), the fourth (bottom-right of the code) is an empty dashed ring (violet). "empty corner" 42.3: the empty ring pulses. "which way is up" 43.88: a big arrow grows from the empty corner through the centre toward the opposite eye; the code rotates along it until it is upright, arrow ends as "UP" chip at the top. |
| - | (no card) | L13 | - | Leo CU, panic: "Those letters are gone!" (the face carries it). |
| 7 | SPARE SQUARES | L14 | 48.29 -> 55.49 | Back to the bitten code from card 1, flat on the island. "spare squares" 49.28: across the WHOLE grid ~1 in 4 modules get a small mint dot (the spare / extra-math squares are spread everywhere, not in a corner). "Extra math, spread across the grid" 50.84-52.38: thin mint threads link dotted modules all over the grid to the bite edge (a net). "Lose a bite" 53.26: the bite's hole outlines in ember, the missing modules show as empty sockets. "rebuilds it" 54.6: threads pulse, the missing modules pop back in one by one (glow flash, then settle to ink/cream), the ember outline closes, tick. |
| 8 | UP TO 30% | L15-L16 | 55.49 -> 60.33 | Same grid. "How big a bite?" 55.64: a coral bite shape starts to grow on the grid while a meter on the right fills 0 -> 30 % (counter, large). "thirty percent" 57.02: the meter hits 30 %, the bite stops, flashes, and the modules rebuild instantly (mint flash) - tag "STILL READS". "logo in the middle" 59.52: a round tile with a small campfire icon (flame, saffron) drops into the centre and covers modules; a scan sweep passes, tick, mint. |
| - | (no card) | L17-L18 + tail | - | Punchline on faces (Leo grin CU, Walter dry; wide tail). |

Coverage: survives damage (1, 2), factory origin 1994 (2), square = bit / 8 = letter (3), link written in squares + zigzag from
bottom-right (4), finder eyes at any angle (5), empty corner = orientation (6), spare math squares spread over the grid rebuild
the bite (7), up to 30 % + logos (8), punchline on faces (no card).
