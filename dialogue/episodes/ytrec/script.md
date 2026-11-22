# "How does YouTube know what I'll watch next?" (campfire, Leo + Walter, ~50 s final, voice at 1.3x)

Premise: Leo's feed served him a video before he knew he wanted it, and it feels like mind reading. Walter, his grandfather, walks him through it in plain words. Both stay seated by the fire the whole time. The phone and the feed exist only in words and in the MG.
Payload: it does not read minds, it counts what you do (watch time, likes, replays, skips); a first job picks a few hundred candidate videos out of millions; a second job (the ranker) scores each one on how long you are likely to watch, highest first; watch time beats clicks, so a title that makes you leave fast loses; what you do next feeds the next round (a loop).
Human question: "Is it reading my mind?" Turn: it is not a guess about you, it is a count of what you did. Landing: the feed guessed right because Leo made it easy (forty cat videos).

LEO (curious) [CU]: Grandpa, YouTube showed me a video before I knew I wanted it.
WALTER (amused) [MS]: Did you want it?
LEO (playful) [OTS]: Obviously. That's the creepy part.
WALTER (warm) [MS]: Nobody read your mind. It counts. How long you watch. What you replay. What you skip.
LEO (surprised) [OTS]: It counts my skips?
WALTER (matter-of-fact) [MS]: Every one. Then it picks a few hundred videos, out of millions, that might suit you.
LEO (thinking) [OTS]: Hundreds out of millions. Then it shows me all of them?
WALTER (firm, light) [MS]: No. A second job scores each one: how long will you watch? The best score goes first.
LEO (curious) [OTS]: Not how likely I am to click?
WALTER (amused) [MS]: Click is cheap. Anyone clicks a shiny title. Watch time is the prize.
LEO (curious) [OTS]: So a liar of a title loses?
WALTER (matter-of-fact) [CU]: If you leave after a few seconds, it learns.
LEO (curious) [OTS]: And what I watch next...
WALTER (warm) [2S]: Feeds the next round. Watch, learn, pick again. A loop.
LEO (grinning) [CU]: So when it guessed right, I basically picked it myself.
WALTER (dry, flat) [CU]: You watched forty cat videos in a row. It was not a hard guess.

#end

Delivery notes (voice): normal conversational pace (the track is sped up 1.3x after, pitch kept). Leo: curious, a playful "Obviously.", surprised at "my skips?", a grin on the last question. Walter: warm, smiling in the voice, falls to a low finish; only the last line is dry and flat, after a beat.
Seated: no actions at all. Nobody holds a phone; the phone, feed and videos are words + MG only.

<!-- Sources (plain terms)
- Covington, Adams, Sargin, "Deep Neural Networks for YouTube Recommendations", RecSys 2016 (Google): a two-stage system, candidate generation narrows "millions" of videos to "hundreds", then a ranking network scores that short list with richer features and the best are shown; the ranking objective is expected watch time rather than click-through rate, because click-through favours clickbait ("watch time" is weighted logistic regression target).
- Same paper: inputs include watch history, search history and demographics-style context; implicit feedback (watches) is used because explicit feedback is sparse.
- YouTube Help / YouTube Official Blog ("On YouTube's recommendation system", 2021): the system looks at what you watch, what you do not watch, time watched, likes, dislikes, "not interested" and survey responses; what you watch feeds back into later recommendations.
- Skips as a signal: YouTube Help ("Manage your recommendations") says choosing not to watch is also a signal; replays: counted as watch time. No exact numbers (video counts, weights) are claimed beyond "a few hundred out of millions" from the 2016 paper's order-of-magnitude description.
- "Forty cat videos" and the "liar of a title" colour are Walter's / Leo's, not claims.
-->
