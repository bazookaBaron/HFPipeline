# "Hello became jello" (campfire, Leo + Walter, ~55 s final, voice at 1.3x)

Premise: Leo typed "hello" to his teacher and the phone sent "jello". Walter, his grandfather, explains in plain words how autocorrect picks a word (the classic interview question: how does a keyboard rank candidate words). Both stay seated by the fire the whole time. The phone, the keyboard and the words exist only in words and in the MG.
Payload: (1) a thumb is a blob, not a point: it lands between two keys (H and J), so the phone has to guess; (2) clue one is where the thumb landed; (3) clue two is the words just before (it had just seen "pudding"); (4) it scores every word it knows on thumb spot, the word before and how common the word is, and the top score wins, in a blink; (5) it learns you: a word you keep goes into your own list, and an undone fix teaches it it was wrong; (6) common words beat rare ones, so a friend's rare name keeps losing.
Human question: "Is my phone dumb, or is it doing something on purpose?" Turn: it was never reading, it was guessing from clues. Landing: the rare name loses to the common word, nothing personal.
Running line: "guess" (L4 "It guessed. It always guesses.", L18 by implication).

LEO (curious) [CU]: Grandpa, I typed "hello" to my teacher. My phone sent "jello."
WALTER (amused) [MS]: Your thumb landed between two keys. H and J are neighbors.
LEO (confused) [OTS]: So it just picked one?
WALTER (matter-of-fact) [MS]: It guessed. It always guesses.
LEO (curious) [OTS]: Guesses how?
WALTER (warm) [MS]: First clue: where your thumb landed. That much it knows.
LEO (thinking) [OTS]: What's the other clue?
WALTER (matter-of-fact) [MS]: The words before it. You'd just typed "pudding."
LEO (thinking, sheepish) [OTS]: Okay. That's fair.
WALTER (pleased) [MS]: Then it scores every word it knows. Thumb spot, word before, how common. Top score wins.
LEO (surprised) [CU]: Every word? How many?
WALTER (matter-of-fact) [MS]: Thousands. In a blink.
LEO (curious) [OTS]: So how does it know me?
WALTER (warm) [2S]: You teach it. A word you keep goes in your own list.
LEO (thinking) [OTS]: And if I undo a fix?
WALTER (firm, light) [MS]: Then it learns it was wrong. Do that enough, and it stops.
LEO (grinning) [CU]: So why does it still turn Moe into "more"?
WALTER (dry, flat) [MS]: Everyone types "more." Almost nobody types Moe. Nothing personal.

#end

Delivery notes (voice): normal conversational pace (the track is sped up 1.3x after, pitch kept). Leo: curious, confused, a sheepish "Okay. That's fair.", surprised at "Every word?", a grin on the last question. Walter: warm, smiling in the voice, falls to a low finish; only the last line is dry and flat, after a beat.
Seated: no actions at all. Nobody holds or types on a phone; the keyboard, the thumb, the words and the lists are words + MG only.

<!-- Sources (plain terms)
- A touchscreen reports a touch as an area (a contact patch), not a point; the keyboard decodes it with a touch (spatial) model, i.e. the likelihood of each key given where the finger landed; neighbouring keys such as H and J overlap: Google AI Blog "The Machine Intelligence Behind Gboard" (2017); Kristensson & Zhai, "SHARK2" / Goodman et al., "Language Modeling for Soft Keyboards" (2002).
- Autocorrect combines the touch model with a language model (the probability of a word given the previous words) and a word-frequency dictionary; candidates are ranked by the combined score: Goodman et al. 2002; Google AI Blog 2017; Apple, iOS 17 "autocorrect uses an on-device transformer language model", Apple Newsroom (WWDC23, June 2023).
- A dictionary/lexicon of tens of thousands to hundreds of thousands of words is scored in milliseconds (script says "thousands"): Google AI Blog 2017; Apple Developer docs "UITextChecker".
- The keyboard learns your words: words you type and keep (names, slang) are added to a personal on-device dictionary; reverting a correction teaches the keyboard that it was unwanted: Apple Support "Use predictive text on iPhone"; Google "Gboard: personal dictionary and learned words"; Google AI Blog "Federated Learning" (2017/2018).
- Common words win over rare ones because the language model's word prior is their frequency: Goodman et al. 2002; Jurafsky & Martin, "Speech and Language Processing", ch. 3.
- "Moe" to "more" is an illustration (a rare name vs a very common word and one letter ("r") added next to "e" on the keyboard; frequency priors); individual keyboards differ.
-->
