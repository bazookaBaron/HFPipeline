# autocorrect storyboard (9:16, colourful iso kit, "Hello became jello", voice at 1.3x)

Look: the approved iso kit (mg/isokit) on the deep-indigo field: mint islands, coral / saffron / sky / violet accents, glow only on emitters (rings, ticks, the lit result).
Colour code: coral = the thumb / the wrong fix, sky = clue 1 (where the thumb landed), saffron = clue 2 (the words before), mint = how common / the winner / kept, violet = your own list, cream = text.
Each card is its own small floating world (island) and SHOWS the mechanism with the sound off. Times are global seconds of the 1.3x track (mg.js looks words up at run time with W(line, word)).
Card layout (9:16 `float`): x 54, y 154, 972 x 560; heads clear (headcheck.js). Tags/labels >= 28 px at 1080 wide, <= 3 words. Max ~9 s per card. Under a card only MS/CU rigs. No label-only beats.

| # | Card (tag) | Line(s) | Window | What moves (sound-off read) |
|---|---|---|---|---|
| 1 | BETWEEN TWO KEYS | L1-L2 | 0.4 -> 7.1 | A keyboard strip G H J K and a typed field behind it reading "hello". "hello" 0.9: a big coral thumb patch falls onto the gap between H and J; both keys sink and tint coral; rings. "jello" 2.8: the field now reads "jello" (saffron, rings). "between" 4.3: two rulers draw: THUMB (wide) vs ONE KEY (narrow): the patch is wider than a key. "neighbors" 6.6: a hud "H? J?" over the two keys. |
| 2 | CLUE 1: WHERE | L5-L6 | 10.4 -> 14.6 | Same keys, thumb patch still on the gap. Two candidate chips float over their keys ("hello" over H, "jello" over J). "thumb" 12.5: dashed sky lines draw from the patch centre to H and to J. "knows" 14.1: two equal sky bars rise under the chips; hud "TIE". |
| 3 | CLUE 2: WORDS BEFORE | L7-L9 | 14.7 -> 20.1 | A sentence strip at the back: [ ... ] -> [ ___ ]. The sky tie bars stand for hello / jello. "pudding" 18.0: the word "pudding" lights in the strip; a dashed saffron link arcs from it to the jello bar, which grows a saffron layer on top (+ word before); a mint tick lands as Leo says "That's fair". |
| 4 | SCORES EVERY WORD | L10-L11 | 20.2 -> 27.0 | Four word stacks (jolly / hello / jello / hells). "scores" 20.4: sky layers rise; "word before" 23.5: saffron layers (big only on jello); "common" 24.7: mint layers (hello tall, jello small). "Top score wins" 26.0: jello is tallest, flashes mint with a ring and a tick. A belt of word blocks slides behind. |
| 5 | THOUSANDS, IN A BLINK | L12 | 28.3 -> 30.4 | Three belts of colourful word blocks run, faster at "In a blink" 29.6; a counter spins up to 4,800+ WORDS; a small stopwatch ticks a fraction of a turn. |
| 6 | YOUR OWN LIST | L13-L14 | 31.6 -> 35.3 | A violet notebook "MY WORDS". "keep" 33.4: word chips (Moe, Priya, bhel) fly in from the right one by one and land as rows, each getting a mint tick. |
| 7 | UNDO A FIX | L15-L16 | 35.4 -> 41.0 | The notebook stays at left. At right a tall coral bar "more" (the fix). "undo" 35.7: a curved saffron undo arrow. "wrong" 37.6: the bar shrinks in five steps (tag WRONG) to a stub; "stops" 40.0: tag STOPS in mint. |
| 8 | COMMON WINS | L17-L18 | 41.4 -> 50.4 | A see-saw: left pan coral "more" blocks, right pan one violet "Moe" block. "Everyone types more" 45.1: the left heap builds block by block and the pan sinks. "Almost nobody types Moe" 47.1: one small violet block drops on the right pan, which rises. "Nothing personal" 49.1: tag NOTHING PERSONAL; the card stays as is when the line ends (no stinger). |

Coverage: touch blob between keys (1), touch-model clue (2), language-model clue (3), scoring + winner (4), scale (5), personal dictionary (6), learning from undo (7), frequency prior (8).
