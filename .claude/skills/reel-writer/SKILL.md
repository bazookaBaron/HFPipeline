---
name: reel-writer
description: Write the narration script for a reel (≤ 1.5 min) in the style of the user's 5 reference explainer reels — title opener, a scene with a person, spoken signposts, labelled steps, contrast triplets, question runs, a two-beat ending, 3–5 deadpan `{dry}` sarcasm beats that punch up — written for the voice as much as for the reader. Use before voice in make-video §4 and §6b, or when the user asks for a reel script or says a script is off.
---

# reel-writer: scripts in the reference-reel style

**Source of truth (user, 2026-10-07): "make it according to theirs only, script type and everything."**
The target is the 5 reference reels the user shared: annotated transcripts in `analysis/reference-reels-20261007/ref1.md … ref5.md`,
patterns + delivery numbers in `FINDINGS.md` there. Read 1–2 of the ref transcripts before writing (they are short).
Earlier rules (≤ 25 s, ≤ 6-word hook, "never a question", one metaphor, interview template) are retired.
Still standing: 15-year-old language, never ask for likes/saves/follows, every claim true and sourced.

Output: `out/reels/<slug>/script.txt` (one line per beat, 1–3 sentences each), `takeaway.txt` (one sentence).

## 1. Length and pace
- **Max 1.5 min total** incl. the ~5.5 s endcard → voice body ≤ 84 s. Refs speak 3.2–3.6 words/s → **200–270 words**, 18–30 lines.
- Average sentence 6–10 words. Mix: 1–2-word labels ("Step 1. Data."), 5–8-word punches, and at most 2 longer list sentences (15–25 words, comma lists).

## 2. Structure (every ref follows this; keep the order)
1. **Title opener (≤ 2 s)**: "<Topic> explained." / "How <X> works." / "What is <X>?" — plain, like the refs.
2. **Tension within 3 s**: a second line that makes it matter — a question to the viewer ("Are you still uploading code to production by hand?"), a twist ("And why is everyone suddenly talking about it?"), or a myth to break ("People talk about the model as if it does everything. It doesn't.").
3. **A scene with a person** (name or role): "This is Lina. She's about to send a photo to her brother." / "Imagine five developers working on the same app." / "Imagine a customer writes, I was charged twice."
4. **Signpost**: "Let's walk through it." / "Let's break that down." / "Let's start with CI."
5. **Labelled steps**, each opening with a spoken label line, then 1–3 short sentences: "Step 1. Data." / "Layer 7. Application." / "Now comes CD." / "Now, the first key concept. Tokens."
6. Inside the steps use the ref devices:
   - **Contrast triplet**: "It doesn't write essays. It doesn't write code. It's built to make decisions."
   - **Parallel run**: "It cannot open your files. It cannot search the repository. It cannot run commands."
   - **Question run** (the checks people actually do): "Does it compile? Do the tests pass? Did somebody break the build?"
   - **Inner voice / quote**: "The app says, I need to send this photo." "The model might decide, I need to inspect these files first."
   - **Comma list of concrete things**: "books, webpages, code, articles, forums".
   - **Real term, defined on the spot**: "smaller pieces called tokens", "Engineers call this the OSI model."
7. **Recap in one line** (the save moment, shown as a cheat sheet on screen): "So CI means integrate often and automatically verify nothing broke."
8. **Two-beat ending + one forward claim**: "LLMs generate. Jev decides." → "And if this works at scale, AI stops being something we only talk to…"

## 3. Writing FOR the voice (punctuation = delivery)
The voice model turns punctuation into intonation. The refs end most sentences LEVEL (only 13–30 % fall) and breathe inside sentences.
- Use **commas** where a breath belongs (lists, "Before the photo leaves, it gets prepared."). Every list item gets a comma.
- Labels as their own short sentences: "Step 1." / "Data." (spoken level, with a beat after).
- Contrast words carry the stress — put them early and alone: "It isn't." "Jev skips that." Write the contrast so the stressed word is obvious.
- Real questions get "?"; rhetorical setups do too ("Which tool should I call?").
- Spoken numbers as words except step/layer labels ("Step 1." is fine); acronyms written normally (the engine spells them; tricky ones go in `runtime/lexicon.json`). No symbols or parentheses; quoted speech goes after a comma without quote marks ("The app says, I need…").
- Never ask for likes/saves/follows. Earn the save with the recap line, the share with one surprising true fact.
- If the voice gate mis-hears a word at the END of a phrase, move it mid-phrase rather than respelling it (Chatterbox, 2026-10-08: phrase-final "ban" → "band" in 6/6 takes and every spelling; "the ban on your account" is clean). Plural "-ns" endings ("bans") read as "-nds" to Whisper even when fine for humans: OK in a title that is also on screen.

## 3b. Sarcasm (all reels, make-video §4)
Same voice as the long-form (`longform-writer` §3), cut down to a reel: dry, factual, deadpan. The facts are the joke; the narrator just refuses to be surprised. Every rule above still stands: title opener, scene with a person, signposts, labelled steps, contrast triplets, question runs, two-beat ending, never ask for likes.
- **Punch UP only**: institutions, companies, executives, bureaucracy, hubris, absurd rules, greed. **Never** mock victims, deaths, ethnic/religious/national groups, gender, sexuality, disability or poverty. Dark means the indifference of the powerful, not the suffering of anyone.
- **Where people were harmed** (layoffs, disasters, deaths): state the fact plainly and respectfully first. Aim the sarcasm at the decision-makers, after the fact.
- **Density**: about 1 `{dry}` beat per 15–20 s, so **3–5 per reel** (the checker WARNs below 2 or above 6). **At most 1 darker beat per reel.** Never in the title opener, and never on a step label.
- **Shape**: a short deadpan line *after* the fact, usually its own sentence of 3–8 words, ending level. Tag the line with `{dry}` at the end. The tag is stripped from captions, and that line is voiced as its own chunk with lower Chatterbox exaggeration (deadpan delivery).
- **Every joke is factually true.** If the irony needs an exaggeration to land, cut it.

Examples in the reel register:
```
Meta called it the year of efficiency. Efficient for the share price, anyway. {dry}
Alphabet spent sixty-two billion dollars buying back its own shares. Shares never ask for severance. {dry}
The safety review took three years. The launch took one afternoon. {dry}
The committee met to discuss the delay. The meeting was delayed. {dry}
```
(The last two show the shape only: write them from real, sourced facts.)

## 3c. Story, numbers, promises, delivery (shared with `longform-writer` §1b–§5)
- **Keep the person**: the scene's person (§2.3) comes back at least once after the steps and gets the last concrete beat ("Priya's badge still doesn't work. Her old team's AI budget does."). If the topic has a natural object, follow it end to end (one payment, one parcel).
- **Contested topic → one counterpoint line**, sourced, then the deciding fact ("To be fair, Meta says it hired too fast in the pandemic. Its staff had nearly doubled since twenty nineteen." then the deciding fact, every clause sourced).
- **Numbers made human**: at most 2–3 big numbers per reel. Each one's first mention gets a comparison line (same or next line) plus `{viz:compare <number> = <thing>}` for the storyboard. Don't put three number sentences in a row. The comparison is a fact too, so check its arithmetic. The checker WARNs on reels and FAILs on long-form.
- **Promises**: anything you tease ("hold on to that", "by the end") is tagged `{loop:key}` and paid with `{payoff:key}` later; the checker FAILs unpaid ones.
- **Drop-off**: no 20 s stretch without a concrete thing, place, name, number or quote, and no 20 s without a new idea.
- **Pace direction** (sparingly, about one tag per 20–30 s): `{slow}`, `{fast}`, `{pause}` / `{pause:0.8}` (before the line if the tag opens it, else after), `{stress:word}`. All of them are stripped from captions.
- **Pronunciation**: new brand, place and person names go in `runtime/lexicon.json` (`"BookMyShow": "Book My Show"`, or the name mapped to itself once it sounds right). The checker WARNs with the list it doesn't know.

## 4. Checks before voice (all mandatory, in this order)
- `python runtime/scriptcheck.py <dir> --profile ref --allow "<terms>"` must PASS (200–270 words, title opener, a signpost, ≥ 2 step labels, avg sentence ≤ 10 words, ≤ 2 sentences over 15, no punching-down terms, every promise paid, no drop-off FAIL; tags are stripped before counting, and it WARNs outside 2–6 `{dry}` beats, on big numbers without a comparison + `{viz:compare}`, and on names missing from the lexicon).
- **Fact-check agent** (independent: `model: "sonnet"`, fresh context, only `script.txt` + `facts.json`/sources): one row per claim, number, date, name, quote and comparison → source → `supported` / `not in source` / `contradicted`. Fix or cut every row that isn't `supported`, jokes included. Output `factcheck.md`.
- **Sensitivity agent** (`model: "sonnet"`, fresh context, script only) whenever the reel touches layoffs, deaths, disasters, conflicts or real people. It checks four things: is any sarcasm aimed at victims or groups; is each side's claim attributed in a conflict; are claims about real people sourced, with allegations said as allegations; is any private individual named. Fix every flag, or answer it in `sensitivity.md`.
- Explain-back: one `model: "haiku"` agent reads ONLY script.txt as a curious 16-year-old: (1) the point in one sentence, (2) confusing words/lines, (3) would they keep watching past line 2. Fix flagged lines; the point must match `takeaway.txt`.
- Then voice (make-video §4.3): the voice gate scores clarity AND delivery against the refs.
