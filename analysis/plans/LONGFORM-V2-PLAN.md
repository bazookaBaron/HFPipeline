# Long-form v2: script craft, montage, scene music, variety, photoreal, glowing maps, thumbnails, cost

Status: PLAN v2 (awaiting go-ahead). Updated 2026-09-27 after user feedback:
- The reference is for montage + script/narration craft only. Our visuals stay; maps get our own aesthetic upgrade.
- Music must be free. No paid generation.

## 0. How the reference is written and narrated (0:00–4:00, transcribed)

The transcript is in the session scratchpad (`ref-putin/transcript.txt`). The first 4 minutes are all set-up; the actual topic (Russia/Arctic) is only revealed at 2:06. The structure, beat by beat:

| Time | Beat | Technique |
|---|---|---|
| 0:00 | "Climate change. That word is everywhere at the moment." | **Chorus hook.** The host names the buzzword, then 3–4 other voices repeat it (anchor, speaker, a president). This gives social proof in 30 s. |
| 0:25 | An authority quote held for 8 s ("...a serious threat to global security") | **Anchor quote.** One big authoritative line closes the montage. |
| 0:34 | "while most people think it's only about X, what they don't realize is..." + 300 M people by 2050 | **Myth, then reveal.** A number is localised to the audience (India). |
| 0:47–1:25 | Delhi heat, then Himalayas (2× faster, ⅔ gone by 2100), then Europe (62,700 dead in 2022), then Iran ("evacuate Tehran") | **World tour of stakes.** One place and one hard number per 8–12 s, escalating. |
| 1:38 | "This is the reason why presidents... are signing pacts" | **Consensus beat.** Everyone agrees it's a disaster... |
| 2:06 | "**But the irony is**... Russia seems happy... climate change could make Russia a superpower again." | **Irony pivot.** The counter-intuitive thesis, the real hook of the video. |
| 2:17 | "65% of Russia sits on permafrost... not built on rock, guys; it is built on ice." | **Stat, then plain-words definition, then a vivid restatement.** |
| 2:41 | "every building, every road, every railway line, every gas pipeline... like a nail into wood. But as it thaws, the wood turns to mud." | **Rhythmic list (anaphora) plus an everyday metaphor** that is then extended. |
| 2:53 | Norilsk: 60% of buildings cracking | **Concrete case study** to prove the abstraction. |
| 3:00 | "So, the question is... How could it...? What is hiding...? How will it change...? And most importantly, how will it benefit [you]?" | **Question stack**: 3–4 open loops ending on "what's in it for the viewer". This is the promise of the video. |
| 3:13 | Sponsor | Not applicable to us. We end the hook straight into chapter 1. |

**Voice and wording rules we will adopt:**
- Short sentences (often 5–12 words) and fragments ("Climate change."). One idea per sentence.
- Direct address: "people", "guys", "look at this", "here's the irony", "so the question is". This is conversational, not a lecture.
- Every claim is carried by a number, a place and a time ("by 2050", "summer of 2022", "since 2000"). No vague adjectives.
- Every hard concept gets:
  1. a one-line plain definition;
  2. a physical, everyday metaphor (the nail and the wood);
  3. a real example (Norilsk).
- Pivot words drive the structure: "But", "And while most people think...", "The irony is", "So the question is". There is a turn about every 30–40 s.
- Authority voices are used as evidence. We have no clips, so we use a **quote card** read by our narrator ("As Obama put it: '...'") with a source line.
- Pace is about 4.0–4.6 syllables/s, which our long-form band (4.2–5.4) already covers.
- The thesis comes late in the reference (2:06). For our 8–12 min format we hit the irony pivot by **0:45–1:00**, with the question stack right after.

## 1. Script pipeline upgrades (from §0)

1. **The outline gets a fixed hook skeleton:**
   - chorus (the buzzword or a common belief);
   - an anchor quote;
   - "most people think / what they don't realise";
   - a 3-stop stakes tour (3 places, 3 numbers);
   - the irony pivot (the thesis);
   - a stat, definition and metaphor;
   - a case study;
   - a question stack of 3–4 questions, the last one about the viewer.

   These are required fields in `outline.json`. Research is asked for the matching facts: a common belief, a counter-intuitive fact, 3 geo stakes and one quotable authority line with its source.
2. **Chapters** follow a mini version: an open question, then a story/example, then numbers with a metaphor, then a "but" turn, then a cliffhanger question answered in the next chapter.
3. **Style gates** (deterministic, so no extra LLM cost):
   - median sentence length ≤ 12 words, and fewer than 5% of sentences over 20 words;
   - at least 1 direct-address phrase per ~40 s;
   - at least 1 pivot word per ~40 s;
   - every chapter has one or more metaphors and a concrete case (tagged by the script call);
   - each hook element present;
   - FK ≤ 8 (a sentence splitter fixes this before any LLM repair).
4. **Quotes**: only verbatim quotes with a non-UGC source from research. They are read by our narrator and shown on a quote card.
5. **Counter-view research**: a counter-view query per topic keeps conclusions balanced. This closes the open Kingfisher note.
6. **Tags from the same pro call** (no extra calls):
   - each section gets a **mood** (for music) and **energy**;
   - each sentence gets a **visual hint** (`geo`/`number`/`trend`/`compare`/`quote`/`person`/`event`/`concept`/`joke`) for the variety planner.
7. **"Montage lines"**: the script call also returns 5–7 hook-worthy lines and one anchor line for the montage.

## 2. Cold-open montage (technique from the reference, all our own assets)

- **Length and shape.** 25–35 s, 20–30 shots:
  1. 3–5 chorus lines (short narrator lines on bold kinetic text slams);
  2. 8–12 shots cut on the beat (~0.6 s each at 90–100 BPM);
  3. an anchor quote card held 5–8 s.
- **Shots come only from what we already have:**
  - zoom crops of rendered chapter scenes (maps, bigNumbers, charts);
  - licensed photos and footage from the resolver;
  - fal photoreal hero shots;
  - one flash burst.

  **No other channel's clips or screenshots**: the reference's own montage relies on news footage it doesn't own, and we will not do that.
- **Audio**
  - A high-energy track from the free library (§5), with cuts snapped to its detected beat grid.
  - Whoosh on cuts and an impact on the anchor.
  - Music sits −4 dB under the voice here, then drops out under the bass for 1–2 s into chapter 1. There is no title card.
- **Build.** A new `montage` stage between `render` and `stitch`, with its own gate: cut density, no blank frames, loudness.
- **SFX.** Impacts, risers and sub-drops are synthesised locally (numpy/ffmpeg, like the current ambient bed) or taken from the free libraries in §5. They cost $0.

## 3. No empty frames (why it happened, and the fix)

**Cause.**
- The storyboard asked for a photo of judge Griesa before we knew one existed.
- 2 Commons photos had usable licences and both failed the image check. Person slots are never AI-generated (no faked real people), so the slot stayed empty.
- The renderer drew a grey placeholder, and no gate treats a placeholder as a failure.
- The same slot was used in two scenes.

**Fix.**
1. **Resolver ladder:**
   1. the exact person;
   2. a related institution or place photo (e.g. the courthouse);
   3. a generic photoreal fal scene with nobody identifiable in it;
   4. a designed name card (monogram, name, role, year).
2. **Media gate before render.** Any slot without a real asset triggers a scene-level storyboard rewrite to graphics-only. Only that scene is re-planned, on a cheap tier.
3. **Render gate.** Any visible `data-placeholder` fails the chapter, and a blank-frame check samples every scene. Failing chapters are rebuilt before the final stitch.

## 4. Photoreal images through fal.ai (replaces Gemini illustrations)

- `lib/media/fal.js` uses `FAL_KEY` from `scripting-pipeline/.env` (gitignored), with a cache keyed on prompt hash.
- **Models:** FLUX.1 dev or Seedream 4 (~$0.03) for scenes, and FLUX schnell (~$0.003) for montage filler.
- **Prompts:** photographic language; negative prompts for text, logos, cartoon and illustration; a lite vision vet on each result.
- **Rules:**
  - Never generate an identifiable real person, a real logo, or a specific real event shown as documentary.
  - Every generated image carries a small "AI-generated image" credit.
  - `metadata.json` sets `alteredContent: true` so the YouTube synthetic-content box gets ticked.
- **Order of preference:** licensed real media, then fal, then graphics-only.

## 5. Music: free library and per-scene switching ($0)

**Sources, all free for monetised YouTube:**

| Source | Licence | Notes |
|---|---|---|
| **YouTube Audio Library** (YT Studio → Audio Library) | Free, monetisation-safe; some tracks need a credit line | Safest: no Content ID claims on YouTube. Filter by mood/genre and download. |
| **Pixabay Music** | Pixabay Content License: commercial use OK, no credit required | Occasional Content ID claims from artists who also register tracks. Keep a licence note per track to dispute any claim. |
| **Kevin MacLeod / incompetech** | CC BY 4.0 (credit required) | Huge cinematic/tension catalogue. The credit goes in the description automatically. |

**Setup.**
- Downloads are manual, by you, once. Automated scraping of these sites breaks their terms.
- I'll hand you a shopping list of about 40 tracks with the search terms per mood:
  - tension / investigative, about 8;
  - dread / collapse, about 5;
  - hopeful / resolution, about 5;
  - playful (joke beats), about 4;
  - calm explainer, about 8;
  - trailer / montage (95–125 BPM, heavy low end), about 6;
  - plus about 10 SFX (impacts, risers, whooshes, sub-drops).
- You drop them in `video-engine/assets/music-lib/<mood>/` with the licence file or page URL.

**Pipeline.**
- `tools/music_index.py` analyses each track locally: BPM, beat grid, energy, loudness, and the loop/cut points.
- It writes `music-lib/index.json` with source, licence and credit text. The mood comes from the folder.
- This needs `pip install librosa` (a ~30 MB Python package). I'll ask before installing; otherwise a numpy/ffmpeg onset detector does the job.
- **`musicPlan`**:
  - picks one track per section from the script's mood tags and switches every ~40–60 s, only at section or scene boundaries;
  - each transition is a 2–3 s bass drop-out on the old track, with the new one entering on a cut;
  - no track repeats within a video, and tracks rotate across videos.
- **Mix:** 10 dB under narration, −4 dB in the montage, swells on chapter cards, then −14 LUFS as now.
- **Credits:** licence and credit lines are added automatically to `description.md` and `credits.txt`.
- The procedural ambient bed remains the offline fallback.

**Optional (not required).** If you ever want custom tracks, ACE-Step on fal costs ~$0.0002 per second, so 40 two-minute tracks come to ~$1 total. It is off by default.

## 6. Visual variety

1. **Visual beat sheet** (cheap stage between `script` and `storyboards`). It uses the sentence hints from §1 to assign each scene a visual type, with hard rules:
   - a map when a scene is about a place or movement, at most ~1 per 60 s;
   - no template twice in a row, and no module over ~15% of the video;
   - a graphic every 60–90 s;
   - media 30–40%, graphics 30–40%, maps 10–20%, quote/headline cards ~10%.

   The storyboard then fills content for its assigned type. The prompt is shorter, which also cuts cost.
2. **New modules** (seek-safe GSAP, white background):

   | Module | What it is |
   |---|---|
   | `quoteCard` | Typeset quote with marker highlight and source |
   | `timeline` | Years with event pins and a playhead |
   | `flowDiagram` | Money-flow arrows (who pays whom) |
   | `pictogramGrid` | 1 icon = N units |
   | `barRace` | Rankings re-ordering over years |
   | `splitScreen` | Two photos with a divider |
   | `photoStack` | 2–3 photo cards around a centre element |
   | `documentStamp` | "DEFAULT" slamming onto a paper texture |
   | `flashBurst` | At most 1 per 2 min |
   | `routeMap` | See §7 |

3. **Variety gate** (deterministic): module share, no back-to-back repeats, spacing.

## 7. Maps: our own aesthetic upgrade (white background)

Our own design, not copied from the reference:

- **Border draw-on.** Borders draw on with stroke-dashoffset. Each border has a two-layer glow: a sharp 1.5 px core line plus a blurred 10–14 px halo in the accent colour at ~35%, via SVG `feGaussianBlur`.
- **Focus country.**
  - Lifts off the map with a soft shadow and a slight scale-up (1.0 → 1.03).
  - Filled with a gentle gradient, with its edge glowing brighter as it is highlighted.
  - Neighbours fade to light grey.
- **Routes and flows.** Gradient arcs with a glowing comet head and a fading trail. Pulsing double rings on cities and ports, and labels on thin leader lines that type on.
- **Data.** Choropleth fills animate country by country with a soft glow on the highest values. Counters sit on a frosted card near the country.
- **Camera.** A slow push-in and pan between focus regions (world, then region, then country), with a faint graticule and a subtle paper/dot texture so the white never looks flat.
- **Palette.** Our existing channel palette plus one glow accent per video. Borders keep India-POV (ne_10m_admin_0_countries_ind).

## 8. Thumbnails v2 (from your 5 examples)

**Pattern in the examples:**
- a cinematic, darker, high-contrast photo scene;
- one huge face cut out right or centre, with rim light;
- a 1–3 word headline in a heavy condensed font, one word in red or yellow;
- a small subtitle strip;
- a story prop (coin, chess king, map, flag).

**Composer:**
1. **Background.** fal photoreal scene for the topic, 3 variants at ~$0.03 each.
2. **Face.**
   - A licensed real photo of the main person from Commons (heads of state often have PD or CC BY photos, e.g. kremlin.ru is CC BY 4.0).
   - Background removed with fal BiRefNet (~$0.001, no local model download), then graded with rim light and shadow.
   - Never an AI-generated face of a real person. With no person, a prop is the hero instead.
3. **Headline.** 3 options at 2–4 words from the lite tier, with one power word coloured. A heavy condensed font with an outline.
4. **QA.**
   - Legible at 168×94 px.
   - Face and text don't overlap.
   - Contrast ≥ 4.5.
   - A lite vision score picks the best of the 3.

## 9. Cost (quality kept)

| Item | Now | After |
|---|---|---|
| Storyboards | ~50% of spend; whole-chapter repair loops | The beat sheet decides layouts, and code fixes overflow, overlap and figure mismatches before any LLM retry. Repairs re-send only the failing scene. The static catalog prompt goes first so Gemini implicit caching applies. **−60–70%** |
| Images | Gemini image $0.067 each, many retries | fal ~$0.03 (schnell $0.003), cached. **−55–90%** |
| Research/outline/script | Standard/pro | Same models. Batch API (−50%) when prepared a day ahead. Grounding stays inside the free 5,000/month. |
| Vision vetting | Lite, up to 46 calls | Metadata filters first, at most 3 per slot. |
| Music and SFX | $0 procedural | **$0**: free library, analysed locally |
| Thumbnails | Gemini image | ~$0.10 fal plus a lite scorer |

- **12-min video:** ~$6–9 now, ~$2.5–4 after.
- **Month** (17 long-form plus 30 shorts): ~$90–110 now, a target of ~$50–70. There is no one-time music cost.
- A `--budget-usd` guard stops a run and reports instead of silently re-spending.

## 10. Execution (parallel workstreams after go-ahead)

| WS | Scope | Depends on |
|---|---|---|
| A | No empty frames (ladder, media gate, render gate, name card) | – |
| B | fal provider (images, BiRefNet), photoreal prompts | – |
| C | Beat sheet, variety gate, new modules, glowing maps | – |
| F | Script craft: hook skeleton, style gates, quotes, tags, montage lines | – |
| D | Music library index and `musicPlan` (needs your downloaded tracks) | you: the shopping list |
| G | Thumbnails v2 | B |
| H | Cost: auto-fix, scene-level repair, caching order, Batch API, budget guard | C |
| E | Montage stage | C, D, F |

A, B, C and F run first in parallel. D starts as soon as the tracks are in the folder; until then it builds against the procedural bed. G and H follow, then E. A new 3-min proof is run only after your go-ahead. It is judged on:
- zero placeholders;
- 1 or more glowing maps;
- 8 or more distinct modules;
- 3 or more music changes;
- the montage;
- the hook skeleton being present;
- 3 thumbnails;
- the cost report.
