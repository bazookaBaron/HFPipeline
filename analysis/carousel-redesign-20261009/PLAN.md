# Carousel redesign: hook first, one idea per slide, max 7 slides

Status: IMPLEMENTED 2026-10-09 (v2 slide types, lint, live fetch, 5 modes). See `runtime/CAROUSEL.md`.
Update 2026-10-09: the user wants the carousels to keep the IG poster theme (hue background, dot grid, Anton, paper panel, hard shadow), so §3.4's light "editorial" background is replaced by "one paper panel per slide" inside the poster theme. New modes were added: paper / repos / animation of the week (live data + real images) and "carousel - vloombox" (rated lists, vloombox #1).
Inputs: the current carousel (`out/reels/llm-built/carousel`), 4 reference carousels (`Downloads/C1, C2, C3, C5`; C4 was empty), the renderer (`runtime/carousel.js`, `runtime/CAROUSEL.md`), the skill (`make-video` §5) and the topic queue (`control-panel/data/topics.json`).

---

## 1. What is wrong with the current carousel

Example: "How LLMs like ChatGPT are built" (7 slides, green).

| # | Problem | Evidence in the LLM carousel |
|---|---|---|
| 1 | **The topic has no hook.** "How LLMs are built" is a textbook chapter title. It gives no stakes, no "this affects you" and no open question. The cover line ("never learned to talk, it learned to guess") is clever, but the subtitle "4-step recipe" doesn't promise anything the reader wants. | Topics come straight from the reel queue: "How does X work?" questions (all 30 in `topics.json`). That suits a 60 s video, but it isn't a reason to swipe and save. |
| 2 | **Fragments instead of explanations.** Bullets are telegraphic ("Books, code and websites", "The model copies the style"). They name things without explaining them, so the reader learns nothing. | Slide 3 spends a whole card on one 4-word bullet. Slide 5 never says *why* fine-tuning matters. |
| 3 | **Everything shouts at once (clutter).** Each slide has 3 bordered cards with 6 px black borders, offset shadows, yellow markers, a dotted saturated background, pill kickers and 190 px stat numbers. Every element has the same weight, so nothing reads as the main point. | `carousel.js` CSS: `.card` 6 px border + 10 px shadow, `.h1` 104 px Anton uppercase, a dot grid on every slide. |
| 4 | **Trivia, not insight.** "15T tokens" and "$100M" are numbers without a "so what". The token-ID chunk visual (403 / 22917 / 481) doesn't help anyone understand anything. | Slides 3–4. |
| 5 | **Visuals are repeated or decorative.** The cover and slide 2 show the same "cat sat on the" bars. | Slides 1–2. |
| 6 | **No payoff slide and a weak CTA.** The recap only restates headings, so there's nothing to save. "Follow for more" plus a site plug gives no reason to act. | Slide 7. |
| 7 | **Slide 2 is wasted.** Instagram reportedly re-serves an unswiped carousel starting at slide 2 (this is an industry claim, not official, see Sources). Our slide 2 depends on the cover and carries no hook of its own. | Slide 2 is a "02 / 07" kicker plus a repeat. |

## 2. What the references do (and we don't)

| Ref | Hook mechanism | Slide structure | Why it's easy to read |
|---|---|---|---|
| **C1** "5 GitHub repos that went nuts this week" | Specific number + recency + social proof ("17,000 stars in 7 days") + FOMO; "SAVE FOR LATER" on the cover | Per item: a slide on what it is and why you'd want it, then a slide on how to get it, with a real screenshot and a copy-paste command | One hero image per slide, one headline written as a **benefit sentence** ("Let AI agents work without leaking your keys"), a 40–60 word paragraph |
| **C2** "How Netflix survived its biggest engineering problem" | Famous brand + a crisis + an implied lesson; the subtitle teases a twist ("one database failure changed everything") | **A story arc**: incident → real problem → decision → "they didn't just…" → change → it took years → payoff → lesson | Light background, a short caps headline, 4–6 plain sentences, **one thin-line diagram**, a primary-source quote box |
| **C3** "Technologies you've heard of but never fully understood" | A knowledge gap aimed at the reader's identity ("you've heard of… never understood") | **A fixed template on every slide**: What is it / Why was it created / Where is it used / Why should developers care | The template repeats, so the reader learns the layout once and then just reads |
| **C5** "10 misconceptions every developer should know" | Belief-break: every slide challenges something the reader may believe | Myth headline → **Reality** → small diagram → **Why it matters** | Same template every time, one accent colour, lots of whitespace |

**The common pattern** in all four:
1. The cover makes a **specific promise** to the reader: a number, a named brand, a belief they hold, or a gap in their knowledge.
2. **One idea per slide.** The headline is a full claim or benefit sentence, not a label.
3. The body is **real sentences** (30–60 words) that explain.
4. **One visual per slide**, simple line art or a real screenshot, there to support the text, not decorate it.
5. A "**Why it matters / why you should care**" line, so every slide pays off.
6. A light, quiet background, one accent colour, no boxes inside boxes.
7. A repeating template, so the reader's attention goes to content, not layout.

## 3. The new rules

### 3.1 Topic → carousel reframe (the main fix for the hook)

The reel topic stays the same (no new research), but the carousel **reframes it into one of 5 archetypes**. "How does X work?" never ships as a carousel title.

| Archetype | Use when | Cover formula | Example (from our queue) |
|---|---|---|---|
| **A. Myth → reality** | People hold a wrong belief about it | "You think X. It's actually Y." / "N things you believe about X that are wrong" | "Incognito mode doesn't hide you from websites" |
| **B. The why behind the thing you see** | It explains a daily experience that annoys or confuses people | "Why X happens to you (and it's on purpose)" | "Why websites block you for refreshing too fast" → "That 'Too many requests' error is protecting you, not punishing you" |
| **C. Case study / story** | A famous company made a non-obvious decision | "How [Brand] [did surprising thing]" + twist subtitle | "Netflix breaks its own servers every day, on purpose" |
| **D. Heard of it, never understood it** | A buzzword the audience hears in interviews and jobs | "N [things] you've heard of but can't explain in an interview" | "5 system-design words every interviewer expects you to explain" |
| **E. Consequence / use-it-better** | Understanding it changes how you use a tool | "Why X [does bad thing] (and how to stop it)" | LLM topic → "Why ChatGPT lies with a straight face" |

The audience is vloombox.in, which serves tech job-seekers. So favour **D and E** (career-useful, saveable) and use **C** for variety.

**Hook scorecard.** Write 5 cover candidates and keep the best. It must score at least 4 out of 5:
1. **Specific**: names a thing, a brand, a number or an error message, not "tech" or "AI".
2. **About the reader**: "you / your" or a situation they have been in.
3. **Open loop**: you can't guess the answer from the cover.
4. **Tension**: a belief-break, a surprise, a mistake or a cost.
5. **Payoff promised**: the subtitle says what they'll get ("3 stages, 5 slides", "and how to stop it").

### 3.2 The 7-slide spine (hard cap: 7)

| Slide | Role | Rule |
|---|---|---|
| 1 Cover | **Hook** | ≤ 10-word title + ≤ 12-word subtitle that promises the payoff. One visual or none. "Save this" or "swipe" cue. |
| 2 | **Second hook / the core idea** | Must make sense on its own (this is the slide re-served to people who didn't swipe). States the single insight that the rest of the carousel unpacks. |
| 3–5 | **3 value slides** | One claim each. Template: headline (claim) → 2–3 sentence explanation → 1 visual → **"Why it matters:"** line. |
| 6 | **Payoff / save slide** | The takeaway people screenshot: a checklist, a decision rule, from→to, or a cheat sheet. Things they can *do*. |
| 7 | **CTA** | One action, with a reason: "Save this for your next ___" and "Follow: one tech concept a day, explained simply" + vloombox. Never ask for likes. |

**The spine test:** read only the 7 headlines in a row. They should tell the whole story. If they don't, rewrite the headlines before touching the layout.

(Note: aggregate data, Socialinsider on about 3M posts, shows the highest engagement at 8–10 slides. We cap at 7 for completion, as decided, and keep every slide essential. Re-test in 4–6 weeks with Instagram per-slide insights.)

### 3.3 Copy limits (enforced by a lint gate)

- Headline: ≤ 12 words, sentence case, a full claim. At most **1** highlight.
- Body: **25–50 words**, real sentences, no bare fragments. At most 3 bullets, each a full clause.
- "Why it matters" line: ≤ 18 words on every value slide.
- Any number needs a `source` and a "so what" in the same slide.
- Jargon is explained the first time it appears (e.g. "token = a chunk of a word").
- No visual is repeated across slides. No decorative visuals (anything that doesn't answer the headline gets cut).

### 3.4 Visual system ("editorial" layout replaces the neo-brutalist cards)

- **Background:** a light paper tint of the reel's theme hue (e.g. `#F6F4EE` with a 4 % hue wash). No dot grid. Optional faint grid on the cover only.
- **One accent colour** (the theme hue, darkened for contrast) for highlights, "Why it matters" labels and diagram strokes. Ink `#141414`.
- **Type:** headline 72–84 px heavy sans in **sentence case** (Anton uppercase is kept only for a cover number/word). Body 38–42 px regular/medium, line-height 1.35. Label 26 px mono.
- **Layout:** kicker row (`03 / 07 · Stage 2`) → headline → body → visual → why-line. No bordered cards around text. At most **one** framed panel per slide (the diagram), with a 2 px stroke and no offset shadow.
- **Visuals:** thin-line diagrams in the style of C2/C5: flow, from→to, bars, rank, Q/A, myth-vs-reality split, quote box (a primary source excerpt), and real screenshots where relevant.
- **Whitespace:** at least 35 % of the slide is empty. The exporter measures it (§4).
- **Phone check:** the sheet is reviewed at 360 px width, and the body must still be readable.

## 4. Implementation plan

| Step | Change | Files | Size |
|---|---|---|---|
| 1 | Add a `layout:"editorial"` renderer: new CSS tokens and slide types `cover`, `idea` (slide 2), `point` (kicker, title, body, visual, why, source), `takeaway` (rules / from→to / checklist), `cta`. Keep the current layout as `legacy` so old carousels re-render unchanged. | `runtime/carousel.js` | medium (~150 lines) |
| 2 | Restyle the visuals as thin-line art. Add `compare` (myth/reality, from/to), `quote` (source excerpt) and `shot` (a screenshot image). Drop `chunks` from the defaults. | `runtime/carousel.js` | small–medium |
| 3 | **Lint gate** `runtime/carousel_lint.js` (runs inside the export): ≤ 7 slides; headline word count and highlight count; body 25–50 words; a why-line on every `point`; a source when a digit appears; slide 2 has no "see previous" dependence (it has its own title + body); no duplicate visual JSON; whitespace ≥ 35 % (pixel scan of the PNG); body px ≥ 36. Exit 1 on failure. | new + `carousel_export.js` | small |
| 4 | **Skill §5 rewrite** (make-video): (a) pick an archetype and reframe the topic; (b) write 5 hooks, score them, keep 1; (c) write the 7-headline spine and pass the spine test; (d) write the copy within the limits; (e) render, lint, look at the sheet at phone size. Same window budget (≤ 0.3). | `.claude/skills/make-video/SKILL.md`, `runtime/CAROUSEL.md` | small |
| 5 | Optional: add a `carouselAngle` field next to each topic in the control panel, so the reframe is visible and editable before production. | `control-panel/lib/topics.js`, UI | small |
| 6 | Pilot: rebuild the LLM carousel (§5) and one more (archetype C or D), compare the sheets side by side with the old ones, then roll out. | — | 1 session |

## 5. Worked example: the LLM carousel, rewritten (archetype E)

Same research, new angle: instead of "how LLMs are built", explain **the one thing users actually run into**: confident wrong answers. The build stages become the explanation.

| # | Kicker | Headline | Body / visual | Why it matters |
|---|---|---|---|---|
| 1 | — | **Why ChatGPT lies with a straight face** | Sub: "It's not a bug. It's how it was built: 3 stages, 5 slides." Visual: a chat bubble giving a confident wrong answer. Cue: "Save this →" | — |
| 2 | THE CORE IDEA | **It was never trained to be right. Only to guess the next word.** | "Every reply is built one word at a time. At each step it scores every possible next word and picks a likely one." Visual: bars "The capital of Australia is ___": Canberra / Sydney / Melbourne (marked illustrative). | To the model, a likely-sounding word and a true word look the same. |
| 3 | 03 / 07 · STAGE 1 | **It read ~15 trillion tokens and guessed every next word** | "Hide a word, guess it, adjust, repeat, trillions of times. The result writes fluently about anything, even topics it barely saw." Visual: flow Read → Hide → Guess → Adjust ↺. Source: Meta, Llama 3. | Fluency comes first. Accuracy is a side effect. |
| 4 | 04 / 07 · STAGE 2 | **Then it copied thousands of answers written by people** | "Trainers write ideal replies. The model learns the *shape* of a helpful answer: direct, structured, confident." Visual: Q → A pair. | It learned to sound sure, whether or not it is. |
| 5 | 05 / 07 · STAGE 3 | **Then people ranked its replies, and "I'm not sure" lost** | "Raters and benchmarks reward an answer over a shrug, so guessing pays more than admitting doubt." Visual: rank 1 Confident + correct, 2 Confident + wrong, 3 "I don't know". Source: OpenAI, "Why language models hallucinate" (2025). | Training pushes it to bluff. |
| 6 | USE IT BETTER | **4 habits that catch the bluff** | Checklist: 1) Paste the source text and ask it to answer *from that*. 2) Ask "Which parts are you least sure about?" 3) Verify names, numbers, dates and citations, always. 4) Ask for the source, then open it. | (the save slide) |
| 7 | — | **Save this for your next ChatGPT answer** | "Follow: one tech concept a day, explained simply." vloombox.in: daily tech jobs and referrals. | — |

Spine test (headlines only): *Why ChatGPT lies → it only guesses the next word → stage 1 guessing → stage 2 copying confidence → stage 3 rewarding the bluff → 4 habits to catch it → save.* It reads as a complete story.

Facts to re-verify from the reel's `research.md` before shipping: Llama 3's 15T tokens (Meta blog), and the OpenAI Sept 2025 hallucination paper (claim: evaluations reward guessing over abstaining).

## 6. Success measures (check after 4–6 posts)

- Save rate ≥ 2 % of reach, and shares tracked (Instagram Insights).
- Swipe-through: the share of viewers reaching slide 7, from per-slide insights. Target ≥ 40 %.
- Comparison: average for the old style vs the new style over the same 2-week posting slots.

## Sources
- [Socialinsider: Instagram Carousel Study (PDF)](https://www.socialinsider.io/data-geeks/Instagram-Carousel-Study.pdf): engagement by slide count; swipe prompts help
- [Search Engine Journal: Instagram carousels](https://www.searchenginejournal.com/instagram-carousels/): engagement dips after 3 slides, recovers at 8+
- [TrueFuture Media: Carousel strategy 2026](https://www.truefuturemedia.com/articles/instagram-carousel-strategy-2026) and [Viraly: carousels that get saved](https://viraly.io/blog/how-to-make-instagram-carousels): the claim that unswiped carousels are re-served from slide 2; saves and sends weighted heavily (industry claims, not official)
