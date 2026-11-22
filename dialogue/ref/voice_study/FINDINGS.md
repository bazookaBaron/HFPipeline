# Voice and script study of refs A ("is the server okay", 48 s) and B ("what's valuable now", 150 s), 2026-11-10

Data: `*.transcript.txt`, `*.turns.csv/json`, `speaker_stats.json`, `tools/`. Audio only. Both clips have music under the voice and are heavily compressed, and are probably TTS themselves.

## Format
- **A (sketch):** 20 turns, 86 words, a 48/52 word share. Lines are 1–7 words, ping-pong.
- **B (explainer):** 24 turns, 403 words.
  - The proxy (user) speaks about 7 words per turn; the mentor about 30.
  - Mentor turns are stacks of 4–9-word sentences with about 560 ms between them.
- **Cast:** opposite genders, 8–16 semitones apart. The AI is the dry or calm one; the human is the emotional one.

## Script patterns (both refs)
1. **Opening:** the AI is addressed by name, followed by the viewer's worry or an absurd framing. There is no greeting. The answer comes within 3 s as a two-beat line.
2. **Listener proxy:** asks, echoes, objects, gets it wrong and sums up. It never explains. Every proxy line is a question, an echo-question, a wrong conclusion or a reaction, at 15 words or fewer.
3. **Numbers as punchlines:** a wrong number, then a one-word correction ("12 views", "12 million"; "40,000?", "40.").
4. **Step triggers:** each lesson step is triggered by the proxy (a "why?", an objection or a wrong move).
5. **Running line:** one line repeats 3–4 times with rising stakes, then returns as the callback button.
6. **Ending:** a deadpan puncture line from the calm character (a roast or callback). Any sign-off comes after it. No moral.
7. **Contrast pairs:** a two-beat "not X / Y" contrast is used as the payload line, split by a pause.
8. **Facts:** one plain number, then the proxy rephrases it, then an analogy.

## Voice patterns
- **Pitch carries the expression, not loudness.**
  - The emotional character jumps 8–15 st up on incredulous or excited lines.
  - The deadpan character stays within 2–5 st per line and drops low on bad news, going bright only once.
  - The mentor starts a line high and falls to a low finish.
  - Questions end high.
- **Speed contrast:** the panicky character runs at 250–430 wpm; disbelief is stretched to about 97 wpm. The calm character stays steady at 160–190 wpm.
- **Stress:** one stress word per line.
- **Gaps between turns:**
  - Sketch: median about 630 ms, with 900–1500 ms around punchlines.
  - Explainer: median about 400 ms.
  - Latch (0–200 ms) for snappy echoes. An interruption is a hard cut mid-word at 0 ms.
- **Inside a turn:** about 500–600 ms between sentences, about 1 s after an aphorism or a teasing "Almost.". At most one emotion shift per turn, at a sentence boundary, carried by a 450–1000 ms pause.
- **No laughs, sighs or whispers** are audible in either ref.

## OmniVoice levers (no emotion instruct)
- **Instruct:** voice design only (gender, age, pitch level, whisper, accent). Combining it with a clone is untested.
- **Inline non-verbal tags:**
  - `[laughter]`, `[sigh]`
  - `[surprise-ah|oh|wa|yo]`
  - `[question-ah|oh|ei|yi|en]`
  - `[confirmation-en]`
  - `[dissatisfaction-hnn]`
- **Timing:** `speed` and `duration` can be set per line.
- **Per-emotion reference clips:** untested.
- **Direction method:** direct each line by its pitch target and contour, speed, stress word and pauses. Then pick the best of N takes by measured f0 contour and rate.
