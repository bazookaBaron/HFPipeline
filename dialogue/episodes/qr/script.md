# "The goat ate the QR code" (campfire, Leo + Walter, ~55 s final, voice at 1.3x)

Premise: a goat took a bite out of the QR code on the camp sign, and Leo's phone still opened the map. Walter, his grandfather, walks him through it in plain words. Both stay seated by the fire the whole time. The sign, the goat and the phone exist only in words and in the MG.
Payload: every little square is a bit (dark 1, light 0, eight make a letter), read in a zigzag from the bottom-right; three big corner squares let the phone find the code at any angle, and the empty fourth corner says which way is up; the code carries spare "math" squares (Reed-Solomon) so up to 30 % can be lost and rebuilt. It was made in 1994 for dirty, scratched car-part labels.
Human question: "How can a broken thing still work?" Turn: the damage was planned for. Landing: the goat still has room to eat.
Running line: the goat (L1, L2, L13, L17, L18).

LEO (curious) [CU]: Grandpa, the goat took a bite out of the camp sign's QR code. It still works. How?
WALTER (amused) [MS]: Of course it does. It was built for goats.
LEO (surprised) [OTS]: Built for goats?
WALTER (matter-of-fact) [MS]: For car factories. Japan, 1994. Oily, scratched labels. Close enough.
LEO (curious) [OTS]: Okay, but what is it? It's just squares.
WALTER (warm) [MS]: Each tiny square is a yes or a no. Dark is one, light is zero. Eight make a letter.
LEO (thinking) [OTS]: So the map link is written in squares.
WALTER (pleased) [MS]: In a zigzag, starting from the bottom right corner.
LEO (curious) [OTS]: And the three big squares in the corners?
WALTER (firm, light) [MS]: Those say, "here I am." Sideways or upside down, the phone still finds them.
LEO (confused) [OTS]: Why three? There are four corners.
WALTER (amused) [2S]: The empty corner is how it knows which way is up.
LEO (shocked) [CU]: But the goat ate squares. Those letters are gone!
WALTER (matter-of-fact) [MS]: So the code carries spare squares. Extra math, spread across the grid. Lose a bite, the math rebuilds it.
LEO (curious) [OTS]: How big a bite?
WALTER (firm, light) [MS]: Up to thirty percent. That's why some codes have a logo in the middle.
LEO (grinning) [CU]: So the goat could have eaten more?
WALTER (dry, flat) [CU]: Plenty. Please don't tell the goat.

#end

Delivery notes (voice): normal conversational pace (the track is sped up 1.3x after, pitch kept). Leo: curious, surprised, playful, a grin on the last question; L13 is the panic peak. Walter: warm, smiling in the voice, falls to a low finish; only the last line is dry and flat.
Seated: no actions at all. Nobody takes out a phone; the sign, the goat, the phone and the squares are words + MG only.

<!-- Sources (plain terms)
- Invented 1994 by Denso Wave (Masahiro Hara's team, Denso / Toyota group) to track automotive parts (kanban labels) faster than barcodes; designed to read even when dirty or damaged: Denso Wave, "History of QR Code" (qrcode.com/en/history/) and "QR Code features" (qrcode.com/en/about/).
- Modules: a dark module is binary 1, a light module is 0; in byte mode each character is 8 bits: ISO/IEC 18004:2015 §7.4 (data encoding) and §7.9 (module placement).
- Data codewords are placed from the bottom-right corner upward in 2-module-wide columns, zigzagging up and down across the symbol: ISO/IEC 18004 §7.7.3 "Symbol character placement".
- Three finder patterns (7x7 "eyes") in three corners give position, size and rotation; reading works at any angle (360°); the corner without a finder fixes orientation: ISO/IEC 18004 §6.3.3; Denso Wave "QR Code features" (360° reading).
- Error correction is Reed-Solomon; level H restores about 30 % of codewords (L 7 %, M 15 %, Q 25 %, H 30 %): Denso Wave "Error correction feature"; ISO/IEC 18004 §7.5. Logos in the middle work because the covered modules are rebuilt by this error correction (same Denso Wave page).
- Caveat kept out of the dialogue: the bite must miss the three finder patterns.
-->
