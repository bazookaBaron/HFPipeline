# DIALOGUE: how scripts and voices are made (v2, 2026-11-10: OmniVoice and the voice-study rules)

The user's note: "the scripts in our pipeline were always written poorly, and the same goes
for the voice."

**Why the old scripts were weak.** They were written as narration: an explainer voice
listing facts, a rule-of-three cadence, "It's not X, it's Y", and a moral at the end. A
conversation is drama, not narration. A line works when it shows what a person wants and
hides what they feel.

---

## 1. The premise card (before any line is written)

| Field | Question it answers |
|---|---|
| Human question | What does a real viewer secretly worry about here? ("Am I falling behind?") |
| Who wants what | What does each character want from THIS conversation? They must differ. |
| The payload | The one true thing (a fact, place or idea) the viewer leaves with. It is sourced, and the MG carries any numbers. |
| The turn | The moment the conversation flips: a reveal, a reframe or a confession. |
| The landing | A quiet last line that says the payload without stating it. No moral. |
| The open thread | (Series only) What the viewer wants to know next. |

## 2. Character voice sheets (fixed for life; every writer reads them)

**dadu** (grandfather, about 70)
- Talks in short, concrete sentences.
- Answers questions with a memory or a question of his own. He remembers smells, prices
  and names.
- Teases lovingly.
- Never lectures, never says "in my time" or "beta, listen", and never uses a proverb
  unless it's being mocked.
- Pace is slow, with silences.

**rohan** (grandson, about 20)
- Quick, deflects with jokes, uses half-sentences, interrupts.
- His feelings leak through sarcasm.
- Says "wait-" and "okay but".
- Never uses slang-for-slang's-sake or meme speak, and never gives speeches.

**arjun** (office friend, 30s)
- Dry and understated. Corporate words, used ironically.
- Hides worry behind numbers.
- Never shouts and never explains a joke.

**meera** (office friend, 30s)
- Sharp, warm and direct. Asks the question nobody asked.
- Funny when she says the true thing.
- Never preachy, and never a "girlboss" cliché.

**Blind test:** strip the names off 10 random lines. A reader must guess the speaker of 8
or more. If they can't, the lines get rewritten.

## 3. Structure

**Short (45–75 s, 110–160 words):**
1. **Hook (0–3 s):** in the middle of a moment, with a contradiction or an odd specific.
   "Forty-two applications." Never a greeting and never "Did you know".
2. **Push (3–25 s):** each turn raises a small stake or reveals something.
3. **Turn (25–45 s):** the reveal or reframe.
4. **Landing (last 5–8 s):** a quiet line, then a beat of silence. For series parts, a
   cliffhanger question on the end card.

**Long-form (8 min):**
- 5–7 movements, each with its own mini-turn every 60–90 s.
- A callback to the opening in the last minute.
- `#part` breaks fall on cliffhangers so they cut into shorts.

## 3b. SEATED-STAGE RULE (2026-11-10, user): the script never asks an actor to DO anything

The two characters sit for the whole video (campfire: seated by the fire; hilltop: seated on stones). The picture
never shows anyone get up, walk, fetch, point at a far thing, handle props or leave.

**Script rules**
- No stage directions that need an action: no "he stands", "she hands him", "he throws a log", "he walks off",
  "she pulls out her phone", "he points at the city". Nothing in the script may require a character to move
  their body from the seat.
- Events happen in WORDS, not on screen: the log, the phone, the server and the walk are told or remembered,
  never shown. (In "Kevin": the sticks, the lake and the fire's fate are all spoken; the only thing on screen is
  two people talking beside a fire.)
- The only allowed physical acts are seated micro-acts that the rig already has: nod, head tilt, shrug, lean in /
  lean back, look at the fire, look at the other person, small hand gesture while talking, hands on knees, rubbing
  the hands, a slow breath out.
- The MG (cards, numbers, map pins) carries anything that would otherwise need a prop or an action.

**Picture must match the script, line by line** (the shot list is derived from the script, not invented later)
- **Camera:** every line gets a framing chosen by what it does. Panic or a punchline = close-up (CU) on the face
  that says it; the calm reply = medium shot on the other character, or a hold on the listener's reaction;
  a shared realisation = the two-shot or the wide. A fast ping-pong run alternates over-the-shoulder / CU, held
  1-2 s; a long calm line holds or pushes in slowly. No framing change without a reason in the line.
- **Expression:** the face layer follows the written beat tag of the line (worried, deadpan, deflated,
  excited ...): brows, eyelids, mouth shape and the eyes' direction all come from the tag, and the listener reacts
  on the other character's line, not frozen.
- **Hand gesture:** each line may carry one seated gesture that matches its meaning (counting a number on the
  fingers, an open palm for "dry", a small shrug for "okay.", a hand held toward the fire). None can be a
  prop action. The gesture lands on the stressed word.
- **Close-ups:** use them for the 2-4 emotional turns (the panic, the number reveal, the final callback); the
  rest stays medium so the CU feels earned.
- The writer therefore tags EVERY line with `(beat)`, `[cam: CU|MS|2S|OTS|WIDE]` and `[gesture: ...]`, and the
  script check fails any line whose direction requires a standing/walking/handling action.

## 4. Line craft rules (the script check tests these)

1. **Subtext.** Characters don't name their feelings. ("I'm scared" becomes "Forty-two.")
2. **Specificity.** Names, prices, years, smells, objects. One concrete detail beats three
   adjectives.
3. **Every line does a job:** reveal character, move the story, or raise a stake. Any line
   that only gives information gets cut or turned into a memory.
4. **Facts arrive as story.** A memory, an argument or a bet, never "Studies show". The MG
   shows the number while the character says what it felt like.
5. **Turn length varies.** Mostly 3–14 words, sometimes one word, at most one longer
   "story" turn per minute (25–40 words).
6. **Real talk.** Interruptions (a trailing `-`: the line is cut mid-word and the next
   speaker starts at 0 ms, with no overlap), trailing off (`...`) and pauses (`pause=`).
   Laughs and sighs are rare: neither reference clip has any. Expression comes from
   pitch, speed and silence (§6).
7. **Humour comes from character,** never from jokes pasted in.
8. **No AI cadence:** no rule-of-three lists, no rhetorical sermons, no "And that's when
   I realised", no moral in the last line. "Not X, Y" contrast lines: at most one per
   script, and only as the payload line, split by a pause ("Not the app. The people.").
   Never as a recurring rhythm.
9. **No "as you know" exposition.** Characters never tell each other what both already
   know.
10. **Read aloud.** Every line must be sayable in one breath by that character.

### 4b. Two-person patterns (from the voice study, 2026-11-10: `ref/voice_study/FINDINGS.md`)

1. **Open on a name plus the worry.** "Walter, is he okay?" No greeting. The other
   character answers within 3 s with a two-beat line.
2. **A listener proxy.** One character asks, echoes, objects, gets it wrong and sums up.
   They never explain. Proxy lines are 15 words or fewer, each a question, an
   echo-question, a wrong conclusion or a reaction.
3. **Numbers are punchlines.** Set up a wrong number, then correct it in one word
   ("Forty thousand?" / "Forty.").
4. **The proxy triggers every step.** Each new idea follows a "why?", an objection or a
   wrong move from the proxy, never a self-started lecture.
5. **A running line.** One line comes back 3–4 times with rising stakes, then returns as
   the closing button.
6. **The ending** is a dry puncture from the calm character (a callback or a roast). Any
   sign-off comes after it. No moral.
7. **Facts in three steps:** one plain number, the proxy restates it in their own words,
   then an analogy. This is allowed alongside §4.4, which still requires facts to arrive
   as story.
8. **Turn length depends on the format.**
   - **Sketch:** both characters speak 1–7-word lines, ping-pong.
   - **Explainer:** the proxy speaks about 7 words a turn; the mentor about 30, built
     from 4–9-word sentences.
   - §4.5's 25–40-word story turn limit applies to the sketch only.

## 5. Writing process (tokens go here: this is the product)

1. **Research** (producer, fresh Opus): sources for the payload go into `facts.json`.
2. **Premise card + beat sheet**, about 10 beats for a short.
3. **Draft** by Opus, with the voice sheets and rules open.
4. **Three independent critics** (fresh Sonnet each, each sees only the script):
   - **Table read:** marks the dull spots, lines nobody would say, and the hook strength
     (1–10).
   - **Voice blind test:** guesses the speaker per line (§2).
   - **Fact and logic:** every claim against `facts.json`, plus timeline plausibility.
5. **Rewrite** by Opus, addressing every mark.
6. **Script check (local):** word count against target length, the AI-cadence regex list,
   turn-length spread and MG density.
7. **The user reads the script before the voice is made.** It is the cheapest point to
   change anything.

**Cost:** about 0.3–0.6 % weekly for a short, and about 1–1.5 % for an 8 min script. That
is the biggest single cost per episode, and that's intended.

## 6. Voice: a cast, not a narrator

- **Four distinct voices,** one per character, fixed for life. Never cloned from a real
  person without consent.
  - **Voice design** (researched 2026-11-09): Parler-TTS Mini v1.1 (Apache-2.0) generates
    each voice from a text description plus a seed, never from its named speakers.
    Kokoro-82M presets are an option once its voice licence is checked. Each character
    gets a 10–15 s neutral reference clip, the prompt and seed are recorded, and a
    speaker-embedding check proves the four voices are distinct. The user picks each one
    in a blind test.
  - **Engine (user's choice, 2026-11-10): OmniVoice** (k2-fsa, 0.6B; the user knows its
    weights are CC-BY-NC). CosyVoice 3 is the tied fallback. Clone references and the
    per-voice speed and guidance settings are in `voice/clone_bakeoff/voice_defaults.json`.
    `clone.py --voice <name>` applies them.
  - **Per-line acting:** OmniVoice has no emotion instruction (its `instruct` sets only
    gender, age, pitch, whisper and accent). Direct each line with:
    - `speed` for that line: rushed or panicked 1.15–1.35, disbelief stretched 0.75–0.85,
      calm 0.95–1.0;
    - inline tags, sparingly: `[surprise-oh]`, `[question-ah]`, `[confirmation-en]`,
      `[dissatisfaction-hnn]`, `[sigh]`, `[laughter]`;
    - punctuation and pauses;
    - **best of N takes, chosen by measurement:** each line carries a target pitch
      contour and speed, and the take that matches best is kept.
  - **Pitch drives the expression, not loudness** (both reference clips):
    - The emotional character jumps 8–15 semitones up on disbelief or excitement.
    - The deadpan character stays within 2–5 semitones and drops low on bad news.
    - The mentor starts each line high and falls to a low finish.
    - Questions end high.
    - One stress word per line.
  - **Emotional peaks and laughs (A/B only):**
    - IndexTTS2 has the strongest emotion control, but its bilibili licence must be read
      before monetized use.
    - Dia (Apache-2.0) handles laughs and sighs.
    - Chatterbox (MIT) is unmaintained.
    - Higgs Audio is out (non-commercial licence).
  - **Pick the best take** (0 tokens), from 4–6 seeds per line:
    1. Whisper word-check gate (5 % or fewer wrong words).
    2. Then a combined z-score of UTMOS naturalness, emotion2vec's score for the target
       emotion, and pitch variance.
    3. Reject takes that are flat, clipped, or the wrong length.
  - **Before the series:** an 8-line blind take test (CosyVoice instruct vs IndexTTS2) for
    the user to judge.
- **Per-line direction:** the emotion tag (§7) becomes a direction: target pitch contour,
  speed, stress word, inline tag and pauses (above). It is not a text instruction to
  the TTS.
- **Pace per character:** dadu about 120–140 wpm, rohan 160–185, arjun 150–165, meera
  160–175.
- **Takes:** 3–4 per line, auto-picked locally with zero tokens:
  - Whisper word-check: a wrong or missing word means reject.
  - Emotion classifier match to the tag.
  - Naturalness (MOS) predictor.
  - Pitch variance within the character's range.
- **Timing** (measured in the reference clips). The gaps between turns depend on the
  format:
  - **Sketch:** a median of about 630 ms, and 900–1500 ms around a punchline.
  - **Explainer:** a median of about 400 ms.
  - **Latch:** 0–200 ms for snappy echoes.
  - **Interruption:** cut the line mid-word; the next speaker starts at 0 ms.
  - **A thoughtful reply:** 700–1200 ms.

  Inside a turn:
  - leave about 500–600 ms between sentences;
  - leave about 1 s after an aphorism or a teasing one-word answer ("Almost.");
  - allow at most one emotion shift per turn, at a sentence boundary, carried by a
    450–1000 ms pause.

  Silence is the main timing tool.
- **Non-verbals** only where they earn it (the references have none): `[sigh]` on
  `heavy`, `[laughter]` on `laugh`, at most one or two per short.
- **Same acoustic space** for both voices. Campfire is dry, with faint early reflections
  and room tone under everything. Each voice is EQ'd for warmth; no robotic de-essing.
- **The user approves the 4 voices once** (a blind A/B of 2–3 options each). After that
  they never change.

## 7. Emotion tags: voice and face (2026-11-09)

The user asked for deep-talk registers: sad, hesitant, tired and emotional. Each tag
drives a voice direction (pitch contour, speed and pauses for OmniVoice, §6; the
CosyVoice EMOTION text in `voice/dlg_voice.py` is the fallback only) and a face preset
(STYLE-GUIDE §3):

| Tag | Voice | Face preset |
|---|---|---|
| warm / amused / laugh / surprised / firm / worried / tender / thinking | as defined | same name |
| annoyed | clipped | firm |
| curious | rising | surprised (at half strength) |
| flat | deadpan | neutral |
| heavy | weary sigh | sad |
| **sad** | quiet, slow, holding back | sad |
| **hesitant** | small pauses, unsure starts | worried, gaze down |
| **tired** | drained, slow, soft exhale | sad (at half strength), lids half closed |
| **emotional** | unsteady, near tears | tender + sad brows |
| **reflective** | soft, remembering | thinking, gaze away into the fire or the view |
| **vulnerable** | fragile, admitting | tender, gaze down then up |
