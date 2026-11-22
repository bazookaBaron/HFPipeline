---
name: longform-writer
description: Write the narration script for a 16–18 min long-form video — cold open in medias res, 7–9 chapters, a re-hook every 60–90 s, deadpan and dark sarcasm that punches up, and `#part` breaks that cut the film into a PART 1…N Shorts series, each part ending on a cliffhanger. Use before voice in the long-form flow, or when the user asks for a long-form script or says one drags.
---

# longform-writer: 16–18 min scripts that hold attention

Voice rules = `reel-writer` §2 devices (labels, contrast triplets, parallel/question runs, inner voice, comma lists, terms defined on the spot) and §3 punctuation-for-breath (numbers as words, no symbols/quotes/parentheses, commas where a breath goes). Read reel-writer §2–3 once; this file adds only what long-form needs. Still standing: 15-year-old language, every claim true and sourced, **never ask for likes/subs/comments**.

Output: `out/longform/<slug>/script.txt` (one beat per line, 1–3 sentences), `takeaway.txt`, `sources.md`.

## 1. Length and shape
- **2,600–2,950 words** (~2.75 w/s incl. pauses = 16–18 min; recalibrated from the pilot's `words.json`). Average sentence ≤ 12 words.
- In order:
  0. Two marker lines at the top: `#protagonist <name | role>` and `#thread <object | alias>` (§1b).
  1. **Cold open (≤ 20 s, ~50 words)** in medias res: drop us into the most absurd or dramatic moment, mid-action, no context, no title. End on an open question. The cold open is a promise: the payoff line that returns to it carries `{payoff:hook}`.
  2. **Promise (1–3 lines)**: what we'll find out and why it matters. "By the end, you'll know who paid for it. Spoiler, it wasn't the people who signed."
  3. **7–9 chapters of 100–150 s** (275–410 words). Each opens with a spoken signpost or label ("Let's start with the money." / "Part three. The audit."). Chapters and parts are independent: a part break usually sits on a chapter's closing question (§4).
  4. **Payoff** that closes the cold open: return to that exact moment, now explained.
  5. **Two-beat ending + one forward claim** (reel-writer §2.8). No CTA.

## 1b. Story spine
- **Protagonist**: one everyperson or role carried through the film (Priya, a Rotterdam shoe importer; the ship's captain). Meet them in the cold open or chapter 1 and come back to them every chapter: the big systems land on that person. They get the last concrete beat before the ending. Never a real private person; a real public figure only with sourced facts.
- **Follow one object**: one thing we track end to end (a container of trainers, a barrel of crude, a single payment). Every chapter moves it one step. The checker WARNs on a chapter with neither the protagonist nor the thread (aliases with `|`: `#thread container | box`).
- **Counterpoint beat per chapter** (credibility): give the other side its best real argument in one or two lines, sourced, then the fact that decides it. "To be fair, the shipping lines say the detour was about safety. The detour also tripled their profit." Never a strawman. The checker WARNs on chapters without one (To be fair / Critics say / The company says / Others argue …).
- **Series bits** (recurring across every video; **proposed 2026-10-18, user to confirm the wording**):
  - Signature line, once per video at the turn into the payoff: "So who actually paid? Let's check the receipt."
  - Recurring visual joke: an APPROVED rubber stamp slams onto the most absurd official decision of the film, once per video (`{viz:gag approved-stamp}`).
  - Ending format: two-beat ending → one forward claim → "Receipts are in the description." (the sources; still no CTA).

## 1c. Numbers made human
Every big number (thousands and up, first mention) gets **a comparison line** in the same or the next line **plus** a `{viz:compare <number> = <thing>}` hint for the storyboard. The checker FAILs on a big number missing either one.
- "Egypt lost about seven billion dollars in a year. That's about two thirds of everything the canal earned the year before. {viz:compare 7 billion dollars = 2/3 of the 10.25 billion canal year}"
- "The Ever Given is four hundred metres long. Stand it on end, and it's taller than the Eiffel Tower. {viz:compare 400 m ship = Eiffel Tower 330 m}"
- One familiar thing per comparison (a stadium, a city's population, a year of wages, a phone price). **The comparison is a claim too**: do the arithmetic and put it in `facts.json` with its source. Example: sixty-two billion dollars is about four and a half Ford-class aircraft carriers (about thirteen billion each), not three.
- Max one number per sentence. Don't stack three number sentences in a row: put a picture between them.

## 2. Re-hooks every 60–90 s
Viewers leave at the seams. At most 90 s of speech (~245 words) between two re-hooks; chapter and part starts count. Rotate the five:
- **Open loop**: "Hold on to that number. It comes back." / "We'll get to the yacht in a minute."
- **Reversal**: "And that was the good decision." / "Turns out, the plan worked. That was the problem."
- **Stakes jump**: "It gets worse. The loan was secured against the island."
- **Direct question**: "So who signs a contract for a runway that doesn't exist?"
- **Callback**: "Remember the cheese sandwich? This is where it becomes evidence."
`scriptcheck` spots them by `?`, a line opening with But / Except / Then / Worse, and phrases: hold on to, remember, keep that in mind, come back to, we'll get to, in a minute, here's the thing/catch/twist/problem, turns out, it gets worse, that was the good, plot twist, spoiler, and then, what could possibly go wrong, the real problem/reason/story. Use them for real, not as filler.

**Promise and payoff (FAILs if unpaid)**: every promise must be kept, or the viewer feels cheated and leaves.
- Tag the promise line `{loop:<key>}` and the line that keeps it `{payoff:<key>}` (later in the film). Required for every open-loop phrase (hold on to, keep that in mind, we'll get to, come back to, in a minute, by the end, more on that later) and for the cold open (`{payoff:hook}`).
- A question right before `#/hook`, `# Chapter` or `#part` must be answered later: the checker accepts a later statement that shares two content words with it, otherwise tag it `{loop:}` … `{payoff:}`.

**Drop-off predictor** (WARN over 20 s, FAIL over 35 s at 2.75 w/s): an abstract stretch with no concrete image (no thing, place, name, number, quote or `{viz:}`); a stretch with no new idea (the same words again); three or more numbers in one sentence (FAIL) or number sentences in a row (WARN at 3, FAIL at 4); any sentence over 25 words (FAIL); and every `#part` break needs a cliffhanger (§4).

## 3. Sarcasm and dark sarcasm
Dry, factual, deadpan. The facts are the joke; the narrator just refuses to be surprised.
- **Devices**: deadpan understatement ("The bridge was, technically, a suggestion."), ironic praise ("A bold strategy. Bold in the way a lit match is bold near petrol."), mock-official tone ("After careful review, the board concluded that the money was gone."), the "what could possibly go wrong" setup followed by the flat reveal.
- **Punch UP**: institutions, plans, executives, greed, bureaucracy, hubris, absurd rules. **Never** mock victims, deaths in tragedies, ethnic/religious/national groups, gender, sexuality, disability or poverty. Dark = the indifference of the powerful, not the suffering of anyone. When people died, the narrator goes plain and respectful; the sarcasm targets the decision-makers, after the fact is stated straight.
- **Density**: ~1 sarcastic beat per 45–60 s (≈ 17–22 per video), at most **one darker beat per chapter**. Tag each with `{dry}` at the end of the line: it is stripped and that line is voiced with lower Chatterbox exaggeration (deadpan).
- **Every joke is factually true.** If the irony needs an exaggeration to land, cut it.

## 4. Shorts series: `#part` breaks
The whole film is also posted as **consecutive PART 1…N Shorts** (16:9 film centred in 9:16, cut by `runtime/shorts/shorts.js`; `runtime/shorts/README-shorts.md`). There are no separate clips: you mark where the film splits.
- A `#part [short title]` line every **60–170 s** of speech (~165–465 words; the checker adds 2.8 s per chapter pause). Part 1 starts at line 1, the last part ends at the last line. A 17-min film ≈ 7–10 parts.
- **Cliffhanger before every break**: the last sentence before `#part` is an open question, a teased reveal, raised stakes or a reversal coming ("But that's not what happened next.", "So who signs a contract for a runway that doesn't exist?"). Never mid-thought, never after a plain fact. A chapter's closing question is the natural spot: hook line → `#part` → `# Chapter …`.
- **1-line recap at every part start** (parts 2…N): the first line re-grounds a cold viewer and still reads naturally in the film ("So who sells the tools of war?", "Remember the bakery in Egypt.", "By now the money is gone."). Name the subject; don't open on a bare pronoun.
- **The last part points to the full video** through the Shorts overlay ("Full video on the channel"), never in the narration (still no CTA).
- Retired: `#clip` … `#/clip` blocks. Convert old scripts by deleting them and adding `#part` lines; the checker only WARNs on them.

## 5. Markers and tags (never spoken, never captioned)
Comment lines: `#protagonist …` · `#thread …` · `#hook` (before line 1) … `#/hook` · `# Chapter <name>` (adds a breathing pause before its first line) · `#part [title]` (Shorts break, §4).
Line tags (`{name}` / `{name:arg}`, anywhere in the line; stripped by `saytext.split_tags`):
- `{dry}`: sarcastic line, own chunk, deadpan (lower Chatterbox exaggeration).
- **Pace direction** (sparingly, at most about one every 30 s): `{slow}` / `{fast}` (that line time-stretched ×0.88 / ×1.12, pitch kept), `{pause}` or `{pause:1.2}` (silence: before the line if the tag opens it, else after it), `{stress:word}` (a breath before that word plus a slightly more expressive take; the word must be in the line). Use `{slow}` on the key fact, `{pause}` before a reveal, `{fast}` on a throwaway list.
- `{loop:key}` / `{payoff:key}` (promise tracker, §2) · `{viz:compare …}` / `{viz:gag …}` (storyboard hints, §1b–1c).
`words.json` `line` indexes spoken lines only, so marker times come straight from it.

**Pronunciation**: brand, place and person names go in `runtime/lexicon.json` (the voice step reads it): a respelling (`"BookMyShow": "Book My Show"`), or the name mapped to itself once you have heard the voice say it right. The checker WARNs with the list of names the lexicon doesn't know yet. Check those in the voice gate's misheard words, and add respellings only for the ones it gets wrong. After the final render, `node runtime/shorts/shorts.js <dir>` cuts the parts (`python runtime/lf/clips.py <dir>` dumps just their times to `clips.json`).

## 6. Worked example (excerpt)
```
#protagonist a ticket buyer | guests
#thread ticket | wristband
#hook
It is April twenty seventeen, on a beach in the Bahamas, and guests who paid thousands of dollars are fighting over disaster relief tents.
Dinner is a cheese sandwich in a foam box.
How did a luxury festival end up here?
#/hook
By the end, you'll know exactly how. And who kept selling tickets after they knew. {loop:who-knew}
# Chapter 1: The pitch
Let's start with the pitch.
Fyre Festival sold itself with one video. Supermodels, a private island, turquoise water.
The island was once owned by Pablo Escobar, the ad said. A real selling point, apparently. {dry}
Here's the catch. The island's owner had a contract that said, do not mention Pablo Escobar.
So the first thing the festival did was break the contract with the people who owned the venue.
What could possibly go wrong?
#part The private island
# Chapter 2: The island
So the festival broke its first contract with a promo video.
```

## 7. Checks before voice (all mandatory, in this order)
1. `python runtime/scriptcheck.py <dir> --profile longform --allow "<terms>"` must PASS: 2,600–2,950 words, `#protagonist` + `#thread`, `#hook` cold open ≤ 20 s, 7–9 chapters each with a signpost/label, no re-hook gap > 90 s, every promise paid, no drop-off FAIL, every big number made human, `#part` breaks with every part 60–170 s and a cliffhanger before each break, no punching-down terms. WARNs: chapter length, chapters without `{dry}`, a counterpoint or the spine, names missing from the lexicon, a part not opening on a recap line, leftover `#clip` blocks, sarcasm density.
2. **Fact-check agent** (independent: `model: "sonnet"`, fresh context, it never saw the research notes). It gets ONLY `script.txt` + `sources.md` + `facts.json`. Every factual claim, number, date, name, quote and comparison gets a row: claim → source URL → `supported` / `not in source` / `contradicted` / `needs a second source`. It writes `factcheck.md`. Fix or cut every row that isn't `supported` (jokes included), then re-run it until it's clean. A big number needs a primary or a reputable secondary source.
3. **Sensitivity agent** (`model: "sonnet"`, fresh context, script only), for any topic with tragedies, deaths, wars, conflicts, disasters, layoffs or real people. It flags: sarcasm landing on victims, the dead, a group, nationality, religion or disability; deaths treated as a punchline or a statistic without a person; one-sided framing of a live conflict (each side's claim attributed, contested facts marked as contested); real people (claims about them sourced, no implied crimes without a conviction or a court finding, said plainly as allegations otherwise; no private individuals named). It writes `sensitivity.md` with line numbers and a fix for each. Every flag gets fixed or explicitly answered in that file.
4. Explain-back (one `model: "haiku"` agent, script only): the point in one sentence; lines where it got bored (re-hook there); any joke that reads as mocking the wrong people (rewrite it).
- Next, after voice: **storyboard first** (make-video §6s). Every sentence gets a designed shot (`understand` + one visible `action` that literally shows the words), approved by the user before anything is animated. Write lines that can be shown: concrete subjects and verbs make better shots than abstractions.
