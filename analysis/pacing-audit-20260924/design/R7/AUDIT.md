# R7 design & motion audit: "What is Jev?" (`R7_Ddm_kFQodJE`)

## 1. Header

| | |
|---|---|
| Source | `C:\Users\debna\Downloads\igexport-Ddm_kFQodJE.mp4` |
| Format | **native 720×1280**, H.264 High yuv420p, 30 fps CFR (3923 frames), ≈286 kb/s video + HE-AAC 48 kHz stereo ≈57 kb/s (IG re-encode) |
| Duration | 130.88 s (speech 0.00–130.14) |
| Loudness (ffmpeg `ebur128=peak=true`) | **I −14.1 LUFS · LRA 1.5 LU · TP −1.3 dBFS** (`loud.txt`) |
| Speech | 443 Whisper words (large-v3, `R7.asr.json`) |

Conventions (same as R2):
- Every px is measured on native frames and reported ×1.5 in **1080×1920 space** (±1.5 px quantisation).
- Hex values carry ±3/channel IG noise.
- 1 f = 33.3 ms. Times are seconds in the reference file.
- Frame times come from accurate `-ss` decode (`util.py`), ±1 f.

Method:
- Scene detect `select='gt(scene,0.08)'` (37 hits, `scenes.txt`) plus a full 30 fps sweep of per-region pixel deltas (`sweep.py`: header / content / mascot / caption).
- 1 fps contact sheets (`sc/sheet_*.png`) and per-frame strips (`strip.py`).
- Edge trackers (`edge.py`, `ink.py`), a mascot colour tracker (`m_masc2.py`), a caption tracker (`capscan.py`).
- Whisper word anchoring and 50 ms RMS.

Evidence frames kept (named `ev_*`):
- `ev_host_decision-sheet_45.50.png`
- `ev_collage_02.50.png`
- `ev_media-video_doom_59.50.png`
- `ev_pink-band_57.50.png`
- `ev_probabilities_52.00.png`
- `ev_tabs-terminal_80.50.png`
- `ev_llm-highlighter_38.50.png`
- `ev_stamp_111.50.png`
- `ev_finale_128.50.png`
- strips: `ev_strip_scan-probs`, `ev_strip_tokenfly`, `ev_strip_stamp`, `ev_strip_doom-cut`, `ev_strip_pushout`.

Our v3 baseline for comparison: `orchestrator/V3.md`, `orchestrator/lib/video/v3/catalog.js`, `composeStage.js` caption skins, `video-engine/compositions/components/lib/stage/*`.

---

## 2. Style profile: NEW profile, "LB — light brutalist product explainer"

R7 is **not** DH, LC or DC. It borrows from two of them and adds a visual language none of R1–R5 has.

| Trait | R7 measured | Nearest profile | Match? |
|---|---|---|---|
| Theme | light: bg **#F1F1EA** flat, 3 px dots **#E1E1DA**, pitch **40 px** (26.67 native), full frame, no mask | LC (#F4F4ED, 38 px dots) | close to LC, but darker and warmer; the pitch differs |
| Frame device | **viewfinder crop marks**: four L-brackets, 16.5 px arms, 1.5 px #A0A099, at x 25.5 / 1053, y 169.5 / 1366.5 | none | NEW |
| Top chrome | **brand HUD bar**: black brand block (`● Jev`), a white section-title cell, and a right `DECISIONS 0006` cell with a magenta ticking counter. Hard offset shadow. | DH HUD (a story-state bar) + LC kicker/counter | hybrid. Its geometry and skin are new. |
| Chapters | header title swaps in 1 f: WHAT IS JEV? → THE PROBLEM → ONE SUPPORT TICKET → SYSTEM ONE → USE CASES → WHY IT MATTERS → NOT A REPLACEMENT → REMEMBER THIS (8 chapters) | DC chapter label | behaves like DC, looks like DH |
| Sub-step tabs | `1 · TICKETS / 2 · TOOLS / 3 · SAFETY / 4 · SEARCH` chip row under the header in the USE CASES chapter | DH stepper M16 / X7 | NEW skin (done / active / future states) |
| Cards | **neo-brutalist window cards**: 1.5 px near-black border, **radius 0**, black **39 px title bar** with a mono label, a square glyph and a 3-line grip, body #FDFDFD, **hard offset shadow +7.5/+7.5 px #CCCAC4 with no blur** | LC windows (r 16, soft shadow); DH panels (dark) | NEW skin |
| Entity colour | Jev = black bar + magenta #981878 / #CC60AC. **LLM = blue title bar #2044B0**. Cost/danger = red #D04444 / #B03030. Highlighter = yellow #FCE484. Success = green. | §2.3 role rule | yes, the rule holds (hue = role) |
| Mascot | full-body cartoon presenter at the left, x 0–225, y 562.5–1363.5 (h 801 = 41.7 % H). Hidden for full-width scaffolds (≈26 % of runtime). Slides in/out. Talks with a puppet mouth and gaze. **Finale re-entry at 1.29× scale.** | DH (R1/R2 mascot column, hides for full width) | DH-like behaviour. **The character is Rick Sanchez (Adult Swim IP): rights-blocked.** |
| Captions | white rounded chip, **no border**, soft shadow. The active word sits on a **yellow highlighter box #FDE587**. 1-frame word hops; 3-frame scale pop on chunk swap. | LC "paper" | NEW skin ("highlighter") |
| Scene grammar | a **hard cut + 25 px rise-settle** for new scaffolds (≈LC), but a mutate-in-place host lives for 16.9 s (the decision sheet), plus push-out exits and full-width media moments | LC cuts + DH host | hybrid |
| Emphasis | headline keyword recolour (grey→magenta), stamp slam, % slam, row focus tint, counter punch. No glow, no camera. | LC none / DH slam | between them |
| Embedded media | **real screen recordings / screenshots inside window cards** (browser-use flight booking 1.53–3.2 s, Doom gameplay 59.47–60.97 s), a press-headline screenshot, a news page, a Jev.Cost table on a **pink full-bleed band** | none (R5 photo cards are stills) | NEW |
| Pace | 204 wpm | LC 195–204 | LC |

**Verdict.** R7 is a new, fourth profile: **LB, light brutalist**. It is a light LC-like plate with DH-like persistent story-state chrome (counter, chapter title, tabs). It also brings:
- hard-shadow window cards;
- a highlighter caption;
- product and screen-recording media;
- form/decision UI as the main host.

It could be built as an LC sub-skin (`LC-c`) that shares the light plate and the scene-cut engine. But the header, cards, caption and media are all new modules, so "new profile" is the honest label.

---

## 3. Scene-by-scene timeline

Word times are Whisper starts (`R7.asr.json`). "+N" = visual onset minus word start, in ms. Scaffold boundaries are hard cuts unless the table says otherwise.
- L-M = mascot column layout (content x 319.5–1020).
- L-F = full width (mascot hidden, content x 60–1038).

| # | t0–t1 (s) | Spoken | Template | Modules on screen | Events (word-anchored) | Out |
|---|---|---|---|---|---|---|
| S1 | 0.00–1.53 | "What is Jev?" | L-F title | header (WHAT IS JEV?, 0000); big "What is" (cap ≈49 native band) + magenta **"Jev?"**; decision-sheet preview card (situation + 3 radio rows) | caption in at 0.167; counter tick 0000→0003 at 0.567 (value swap + punch, 233 ms) | hard cut 1.533 |
| S2 | 1.53–3.20 | "And why is everyone suddenly talking about it?" | L-F collage | 4 overlapping media window cards: press headline screenshot, **browser-use screen recording (plays)**, typesafe.ai news, github awesome-jev | cards pop at 1.533 / 1.833 / 2.133 (**300 ms stagger, free-running**; −67 / −107 / −187 vs everyone/suddenly/talking); each slides 33–34.5 px sideways into place in 6–7 f ease-out | hard cut 3.20 (1 blank f) |
| S3 | 3.20–7.70 | "Jev is a new AI model that does something very different from ChatGPT, Claude, or Gemini." | L-M | mascot slides in (3.27–3.63); Jev product card (title bar `Jev 1.0 · by TypeSafe AI`, magenta wordmark "Jev" cap ≈87, "a new kind of AI model", `made by TypeSafe AI` logo); `New · Sept 2026` pill; eyebrow `VERY DIFFERENT FROM`; 3 dashed logo tiles OpenAI / Claude / Gemini | card rise-settle 3.333 (Jev +93); logos dim→lit 4 f each at 5.767 (ChatGPT −33), 6.567 (Claude +27), 7.067 (Gemini +67) | hard cut 7.70 |
| S4 | 7.70–9.87 | "It doesn't write essays. It doesn't write code." | L-M | two document cards `essay.txt`, `code.py` | "No essays" red label 8.40 (essays +260); red X strokes draw 8.47–8.67 while blue text lines write in under them; "No code" repeats at ≈9.4 | cut 9.867 (It's +47) |
| S5 | 9.87–11.20 | "It's built to make decisions." | L-M | headline "Built to make / decisions." (right-aligned, 2 lines) + decision sheet | counter 0003→0006 at 10.667–10.867 (decisions@10.52 +147) | cut 11.20 (+20) |
| S6 | 11.20–14.73 | "That sounds simple, but it solves a really important problem in AI software." | L-M | headline "A really **important** problem"; `AI software` card = 2×7 grid of question rows with ◯◯ radio pairs; right-aligned "…in AI software." | keyword recolour grey→magenta on "important"; row radios flicker; kicker at "software" | cut 14.733 (Think +33) |
| S7 | 14.73–18.33 | "Think about an AI agent. Before it does anything, it has to make tiny choices." | L-M | `AI agent` task card: TASK "Sort out Maya's double charge", 3 numbered steps, ▶ `ready`/`waiting…` row; right-aligned "An AI agent." → "Tiny choices first." | card rise-settle 14.733 (25.5 px, 7 f); display line swaps on "agent" / "tiny choices" | cut 18.333 (Which +33) |
| S8 | 18.33–21.77 | "Which tool should I call? Should I retry this? Is this request risky?" | L-M | `the agent's tiny choices` form (3 questions, radio options) + `AI agent` card "⏸ Waiting for answers…"; headline "Who answers these?" | the question row tints pale magenta on each question (18.3 / 19.4 / 20.5); headline grey→ink on "risky" | cut 21.767 (Today +87) |
| S9 | 21.77–26.40 | "Today, developers send all of those tiny decisions to a giant language model. That's wasteful." | L-M | 3 small question chips → black **"Giant language model" tile** (OpenAI / Claude / Gemini logo row, dark 1.5 px-grid texture) + a row of red `$` coins | chips fly into the tile (≈22.6–23.0); **6 coins at 133 ms stagger**, 23.067–23.733, each dropping 30 px (those@23.04 → free cascade) | cut 26.40 (Imagine +40) |
| S10 | 26.40–34.93 | "Imagine a customer writes, I was charged twice and I need this fixed right now. Plus, your software only needs three things. Which department? How urgent? Should it be escalated?" | L-M | `Support inbox · 1 new` card (Maya avatar, red `Charged twice!` tag, the message typing in); `your_app` form (TEAM / URGENT? / ESCALATE? dashed fields + `Waiting for answers…` check row) | message types word-locked 27.9–29.6; `your_app` drops in ≈29.9 (Plus); field "?" marks + magenta frame per question: 32.5 (department), 33.3 (urgent), 34.2 (escalated) | inbox exits; LLM window drops in |
| S11 | 34.93–39.73 | "A normal LLM writes a paragraph. Then your code has to parse it back into structured data." | L-M | **blue** `LLM · writing…` window (OpenAI/Claude/Gemini logo row) streaming a paragraph; `your_app` | window drops in 34.93 (+150 vs "A"); **streaming text** 35.2–36.7; window grows up to y 402 at 36.77 (Then +150); **amber highlighter marks** sweep over "billing issue" 37.57 (parse +130), "fairly urgent" 38.17, "may be worth escalating" 38.57; fields fill with uncertain red values `billing?` / `fairly?` / `maybe??` | **push-out left** 39.70–40.03 (ease-in, 333 ms); headline pops |
| S12 | 39.73–47.20 | "Jev skips that. You give it the situation and define the possible answers. Department billing. Technical, sales, urgent, yes or no, frustration, low, medium, high." | L-M (host) | headline "Jev skips that." → numbered legend `1 the situation` / `2 the possible answers`; **Jev decision sheet** (situation band + 3 question rows) + `your_app`; magenta eyebrow `YOU LIST THE POSSIBLE ANSWERS` | headline +230 vs skips; sheet pops 40.067; legend items on situation@40.74 / answers@42.08; eyebrow 42.733 (Department +33); **row focus tint** #F9EDF5 1 f on: dept 43.233, urgent 45.000, frustration 46.167; each option pulses on its word | mutate in place |
| S12b | 47.20–56.60 | "Jev returns the decisions directly with probabilities attached. Billing 94%. Urgent 88%. Frustration, high. No prose. Just an answer your software can use immediately." | same host | eyebrows `JEV ANSWERS EVERY QUESTION AT ONCE` → `…AND HOW SURE IT IS` → `NO PROSE. JUST ANSWERS.` | **scan line** 47.53–47.67 (returns +70) fills radios billing / yes / high; counter 0006→0009 47.6; **% slam** 94 % 49.067 (probabilities +87), 88 % 49.167, 91 % 49.300; probability bars fill magenta; **row outline** box on the billing (50.1), urgent (51.3) and frustration (52.6) rows; **token fly** billing / yes / high chips from the sheet into `your_app` 55.0–55.63 (answer +60); fields settle; status row → green `Billing team · urgent · human notified` 56.1 (immediately +140) | mascot exits 56.40–56.50; hard cut 56.600 |
| S13 | 56.60–59.47 | "TypeSafe, the company behind it, calls this a system one model." | L-F | TypeSafe AI logo lockup (y ≈405–550) + **pink full-bleed band** #EF8A9E-ish, y 591–1338 with a dot texture + press-headline window (`typesafe.ai`) | band + logo at the cut (TypeSafe +300); window pops 57.300 with a 33 px rise (10 f); highlight box on "System One Model" + a caption line "'System one': fast, gut-level thinking (from the book *Thinking, Fast and Slow*)" ≈58.6 (system +140) | hard cut 59.467 |
| S14 | 59.47–60.97 | "Fast, intuitive decision making…" | L-F media | **Doom gameplay video window** `typesafe.ai · Jev plays Doom` (plays) + overlay `Jev · live judgments` terminal (green bars) | cut on Fast (+107); overlay slides in 13.5 px / 3 f; "Fast." 59.467, "Intuitive." 59.767 (intuitive +87) stacked left | hard cut 60.967 |
| S15 | 60.97–63.60 | "…instead of a huge generative model for every small judgment." | L-F | headline "A huge model… / for every tiny question?" (line 2 grey→magenta); black `Giant language model` tile; small `one small judgment` card (`RETRY? ◯yes ◯no`) + eyebrow | headline leads "huge" by 373; small card at "small judgment" ≈62.6 | cut 63.60 (Use +180) |
| S16 | 63.60–66.10 | "Use a model built for choosing between known options…" | L-F | headline "Built for **choosing**." + decision sheet (refund / bug / question / spam; how urgent; needs a human) | "choosing" grey→magenta 64.700 (+100), 1–2 f; counter 0009→0012 65.7 | cut 66.10 (people −20) |
| S17 | 66.10–68.00 | "…and people are already finding use cases." | L-F | headline "People are already building with it"; up to 12 project cards (3 columns: "Plays Tetris", "Skips YouTube sponsors", …); pink pill `155 projects in the first week · github.com/cobanov/awesome-jev` | cards pop in a scattered cascade 66.1–67.4 | cut 68.00 (Support +80) |
| S18 | 68.00–71.53 | "Support ticket routing. Which team? How urgent does a human need to review it?" | L-M + tabs | tab row appears (1 active); headline "Support ticket routing"; decision sheet ("The app keeps logging me out."); `BUILT WITH JEV github.com/elie222/inbox-zero` repo card; `result` card → green "Sent to the tech team" | mascot slides in 68.07–68.37; radios on team (69.3) / urgent (69.8) / human (70.4); counter 0012→0015 71.1; result card ≈71.2 | cut 71.533 (+33) |
| S19 | 71.53–77.77 | "AI agent routing. Your agent has web search, a calculator, a coding model, a database. Jev picks which tool comes next." | L-M + tabs (2) | sheet "Find me flights to Tokyo under $500."; **2×2 tool tiles** (Web search / Calculator / Coding model / Database, icon + label); repo card `JevRouter` | tab 2 active at the cut; **tiles dim→lit** 73.300 (web +140), 74.033 (calculator +193), 74.667 (coding +147), 75.367 (database +87); on "picks": radio "search" + tile gets a magenta outline ≈76.6; counter 0015→0016 76.5 | cut 77.767 (Coding −33) |
| S20 | 77.77–83.30 | "Coding agent guardrails. The agent proposes a shell command. Jev decides allow, ask a human, or block." | L-M + tabs (3) | **dark terminal** `coding agent · terminal` ("The agent wants to run:", `$` + block cursor, then `rm -rf ~/projects` + comment "= delete every project on this computer"); `Jev · safety check` sheet (allow / ask a human / block); repo card `jev-guard` | cursor blinks 8 f on / 7 f off; **typing 80.20–80.50, ≈1.7 chars/f** (shell +20); options pulse on allow / ask / block; "ask a human" selected ≈82.3; counter 0016→0017 82.9 | cut 83.30 (An +100) |
| S21 | 83.30–89.60 | "An RAG. You retrieve 10 documents. Jev scores which ones are actually relevant before you send them to the expensive LLM." | L-M + tabs (4) | `question` card "Why was I charged twice?"; **2×5 document grid** (empty dashed slots → named docs: refund-pol, shipping, billing-FAQ, careers, press-kit, pricing, api-docs, holidays, privacy, team-offsite); black `Expensive LLM` tile | docs fill in a cascade 84.4–85.1 (retrieve / 10 documents); **score rings** appear at each doc corner 85.9–86.1 (scores +150); relevant ones fill magenta and get a pink wash ≈87.1 (relevant +180); 7 irrelevant docs removed; `jev-reranker` repo card; `$$$` red tag on the LLM tile 88.5 | cut 89.60 (Less +140) |
| S22 | 89.60–91.53 | "Less context. Less cost." | L-M + tabs | "Less context." display (right, cap ≈40.5); `PAGES SENT TO THE LLM` icon row (10 page glyphs, 3 magenta); `COST` red bar 336–1000.5 × 1068–1114.5 | page icons dim at the cut; "Less cost." display 90.4; **cost bar shrinks 100 %→30 %, 9 f ease-in-out**, 90.733 (cost −110) | cut 91.533 (That's +153) |
| S23 | 91.53–95.30 | "That's why developers care. AI apps are full of tiny judgment calls." | L-M | headline "That's why developers care."; `any AI app` card = 2×7 question grid; "Full of tiny / judgment calls." display | grid rows get outlined in a cascade 93.0–94.9 | cut 95.30 (Send +180) |
| S24 | 95.30–99.07 | "Send everyone through a frontier model and latency and cost stack up everywhere." | L-M | question grid (compact) + black `Frontier model` tile + 2 columns `WAITING` (clock icons) / `COST` ($ icons) | questions route into the tile ≈96.0; **icon stacks grow** 97.87–98.6, ≈100 ms stagger (stack +−70) | mascot exits 98.83–98.97 (ease-in); cut 99.067 |
| S25 | 99.07–100.90 | "Jev is designed to be faster and cheaper." | L-F | magenta `JEV` / blue `AN LLM` tag pair; `typesafe.ai · same 27 questions, same order` split window (Jev side fills with JSON lines fast; LLM side types slowly); "Faster.   Cheaper." display + `TYPESAFE'S OWN TEST · THEIR NUMBERS` | Jev column fills ≈99.5–100.4; "Faster." grey→magenta 100.3 (faster +380) | cut 100.90 (−40); mascot back in 100.97 |
| S26 | 100.90–104.00 | "TypeSafe reports response times in the hundreds of milliseconds." | L-M | headline "Hundreds of milliseconds"; `response time · TypeSafe's own numbers` **race bar chart** (rows JEV / A BIG LLM, 0 s…10 s axis); "About / one blink." display | LLM bar crawls **linearly 7 px/f** from ≈101.40 (reports 0) to ≥103.47; Jev bar is a short magenta bar at 101.93 + label `a few hundred ms` 102.27; "About one blink." grey→magenta ≈103.1 (milliseconds) | cut 104.00 (And +140) |
| S27 | 104.00–107.70 | "And since it doesn't generate long text, there's no traditional output token bill." | L-M | blue `a chatbot's bill · you pay per word it writes` window (reply lines each with a red `$`); **pink-band screenshot card** `typesafe.ai · Jev.Cost` (per-model price table); caption `Jev: input costs a little · output is free` | reply lines + `$` type in 104.1–105.4; caption 106.0; the Jev row gets a highlight ≈107.1 (bill) | cut 107.70 (Now +60) |
| S28 | 107.70–109.47 | "Now Jev is still extremely new." | L-M | pink-band news screenshot `typesafe.ai · news` (Sept 20 "NO MORE WAITLIST", Sept 15 "announces System One models"); "One week old." display | header → NOT A REPLACEMENT at the cut | cut 109.467 (This +107) |
| S29 | 109.47–111.93 | "This isn't ChatGPT and Claude are obsolete." | L-M | OpenAI/ChatGPT + Claude tiles (dim → lit); "Not obsolete." display (grey) | ChatGPT tile lit ≈110.0 (ChatGPT +140); Claude ≈110.8; **OBSOLETE stamp slam** 111.20 (obsolete +80); **black strike** across the stamp 111.467–111.567; "Not obsolete." grey→ink 111.53 | cut 111.933 (They +213) |
| S30 | 111.93–120.60 | "They solve a different problem. Claude and GPT are for when you need something generated. Jev is for when your software already knows the possible answers and just needs intelligence to choose." | L-M | headline "A different problem."; blue `Claude · writing Maya's reply` window (streams "Hi Maya, I'm so sorry…") + micro `GENERATE: CLAUDE, GPT`; `Jev · decision sheet` ("REFUND THE DOUBLE CHARGE? ◯yes ◯no ◯ask a human") + micro `CHOOSE: JEV` | reply streams 112.0–115.4; `GENERATE` micro turns magenta ≈115.4 (generated +240); `CHOOSE: JEV` magenta ≈116.2 (Jev +180); options pulse on possible@118.08; "yes" selected ≈120.3 (choose +120) | mascot exits 120.43–120.53; cut 120.60 (The +40) |
| S31 | 120.60–125.10 | "The easiest way to remember it, LLMs generate. Jev decides, and if this works at scale," | L-F | 2-part summary: "LLMs **generate.**" (blue keyword) over a blue `LLM · writing…` window; "Jev **decides.**" (magenta keyword) over a decision sheet | LLM window streams; "generate" grey→blue ≈122.6 (+200); "decides" grey→magenta 123.3; radios fill 123.3–123.6; counter 0028→0031 123.4 | cut 125.10 (AI +40) |
| S32 | 125.10–125.53 | "AI stops being something…" | L-F | `chat` window: user bubble "Can you help me with my bill?", grey reply bubble | — | cut 125.53 |
| S33 | 125.53–130.88 | "…we only talk to and becomes tiny decision engines hidden everywhere inside software." | L-F → L-M (finale) | chat window shrinks into the top-left; **3×2 app grid** (Email · Important?, YouTube · Sponsor read?, Smart home · Lights on?, Spreadsheets · Paid late?, Games · Best move?, Websites · Clutter?), each a small window card with a radio | grid cascade 125.53–126.5; **mascot re-enters at 1.29×** 127.30–127.63 (becomes −20); radios light one per word, counter +1 each (127.83, 128.53, 128.93, 129.27, 129.67 ≈ tiny / decision / engines / hidden / everywhere +200…+270); **counter count-up 0037 → 1,000,000** 129.93–130.60 (software@129.74 +190) | video ends on the hold (no fade, no endcard) |

Header chapter swaps (1 f, measured in the header crop):
- 14.733 (Think +33)
- 26.400 (Imagine +40)
- 56.567 (TypeSafe +267)
- 68.000 (Support +80)
- 91.533 (That's +153)
- 107.700 (Now +60)
- 120.600 (The +40)

Counter ticks (value swap + punch): 0.57, 10.67, 47.60, 65.70, 71.07, 76.50, 82.80, 85.93, 120.27, 123.40, 127.80, 128.53, 128.93, 129.27, 129.67, then the 129.93 count-up.

---

## 4. Checklist items 1–36 (Reference R7 | Our v3 | Gap | Fix)

Our v3 means the current renderer. The nearest profile is **LC**:
- plate #F4F4ED with 38 px dots;
- "paper" caption skin;
- kicker + counter header;
- SpongeBob placeholder mascot;
- cards from `catalog.js`.

### A. Frame architecture & layout

| # | Reference R7 (measured) | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 1 Safe zones | Top 0–169.5 empty (8.8 %; only bg dots). Crop marks at y 169.5 and 1366.5 frame the stage. Header 235.5–292.5. Content never passes y ≈1368 (mascot feet 1363.5, pink band 1338). Caption 1425–1522.5. Bottom 1530–1920 empty (20.3 %). Side: header x 40.5–1039.5 (**40.5 margin**); full-width content x 60–1038; the mascot is the only thing touching x 0 (laptop cropped at the edge). | LC: top clear 0–223, header row 224–260; content 549–1265; caption 1452–1545; side margin 70. | Ours starts content ≈250 px lower and uses a 70 px margin. R7 is taller and wider (content 300–1368). | tuning (LB band table) |
| 2 Grid / columns | Mascot on: mascot col x 0–225, gutter ≈95, **content col x 319.5–1020 (700 wide)**. Mascot off: x 60–1038 (978). Header grid: brand 40.5–145.5 · title 145.5–823.5 · counter 823.5–1039.5. Right-aligned display lines end at x ≈1018. Headlines centre on the content column (L-M) or x 540 (L-F). | LC content 330–1010 (680); mascot never hidden. | No mascot-off full-width mode in LC. Column widths differ (+20 px). | new capability (LC/LB layout mode `full`) + tuning |
| 3 Content bbox | L-M host (45.5): eyebrow cap-top 385; sheet 319.5–1020 × 430.5–889.5; `your_app` 319.5–1020 × 930–1314 → content y 385–1320, **x 319.5–1020 = 34 % of frame area**; centre of mass y ≈850 (44 %). L-F media (59.5): video window 60–924 × 387–1089 + overlay 505.5–1045.5 × 1000.5–1347. Pink band 0–1080 × 591–1338 (full-bleed). | LC slot 549–1265, 20–24 % area. | Ours is lower and smaller. R7 fills ≈35–45 % and lets media go full width or full bleed. | tuning + new capability (full-bleed band) |
| 4 Layout templates | 8 templates (§5.9): T1 mascot + stacked windows; T2 host sheet + target form; T3 headline + object; T4 full-width media window + overlay; T5 pink band showcase; T6 collage of overlapping media cards; T7 grid of small window cards (2×2, 2×5, 3×2, 3×4); T8 two-part summary (keyword headline over window, ×2). | LC `scene` template + opener/stack/hero. | T4–T7 have no equivalent; T2 partially (panel + slot). | new templates |
| 5 Hierarchy | Read order: (1) caption (cap 40.5, ≈56 px, heaviest text); (2) headline / display line (cap ≈40.5, w700, tight tracking; the keyword in magenta/blue); (3) window title bar (mono, glyph 18); (4) form labels (radio labels x-h ≈16 → ≈24 px sans); (5) mono micro caps (header title cap 15, eyebrows cap 16.5 magenta, DECISIONS cap 12). Hero wordmark "Jev" cap ≈87. Ratios by cap: caption : headline : title-bar : label : micro ≈ 40 : 40 : 18 : 16 : 15 (≈2.7 : 2.7 : 1.2 : 1.1 : 1). | LC title 72/800, display 105, caption 50. | R7 headlines are **caption-sized** (not 72–105). Hierarchy comes from colour (keyword recolour) and position, not size. | tuning (LB type scale) |
| 6 Spacing rhythm | Stack gap between windows 40.5 px (sheet bottom 889.5 → form 930). Header → eyebrow ≈92. Eyebrow → card ≈30. Card inner padding 22.5 (x 319.5 → text 345). Sheet rows ≈104 px pitch (70 native). Form rows 78 px pitch. Tile grids: gap ≈15–18 px. Tab chips h 39, gap ≈12. Dot grid 40 px. | LC module gap 30–51, padding 28–30. | Similar order of magnitude; R7 is tighter. | tuning |

### B. Persistent chrome

| # | Reference R7 (measured) | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 7 HUD / status bar | **Brand HUD** x 40.5–1039.5, y 235.5–292.5 (h 57), 3 px #161611 border, fill #FDFDFD, radius 0, hard shadow **+4.5/+4.5 px #C4C4BD** (no blur). Cells: brand block 40.5–145.5 fill **#1B1D1D** with a magenta dot (#CF5BB6, Ø ≈15) + white bold "Jev" · title cell (mono caps, tracked ≈0.15 em, cap 15, #1B1D1D, centred) · right cell `DECISIONS` (mono caps cap 12, grey #6E6E6A) + **4-digit counter** (condensed mono, digit h 21, magenta #9A5585, zero-padded `0006`). **Updates**: title hard-swaps with the chapter (8 values); counter ticks by +3/+1 on decision beats (15 ticks) with a **1-f value swap + scale punch** (digit h 14→16→18→18→18→16→14 native, ≈1.29×, 7 f = 233 ms, right-anchored); finale **count-up 37 → 1,000,000** (§6 E14), the counter cell widening leftwards (digits x 960→882). Lifetime 0–130.88 (always). | LC header: kicker + counter `NN — 32` stepping 1 f; DH HUD (dark); no brand block, no punch, no count-up in the header. | Skin, brand block, the counter semantics (a running tally of decisions, not a scene index) and the punch/count-up are missing. | new module (LB header) + ops `tick`, `countUp` |
| 8 Chapter / step indicators | (a) Header title = chapter (8). (b) **Tab chips** (USE CASES only, 68.0–91.5): 4 chips centred x ≈187.5–892.5, y 306–345 (h 39), mono caps cap 13.5 tracked. States: **done** = 1.5 px magenta border, magenta dot, magenta text; **active** = 1.5 px black border, white fill, black text, magenta dot; **future** = grey #C8C8C0 border, hollow dot, grey text. Switch = 1 f at the scene cut (71.533, 77.767, 83.3). (c) Magenta mono **eyebrows** above the host (`YOU LIST THE POSSIBLE ANSWERS`, `JEV ANSWERS EVERY QUESTION AT ONCE`, `…AND HOW SURE IT IS`, `NO PROSE. JUST ANSWERS.`), cap 16.5, tracked ≈0.2 em, #981878, swapped in 1 f on the beat word. (d) Right-aligned micro captions under windows (`GENERATE: CLAUDE, GPT`, `CHOOSE: JEV`, `TYPESAFE'S OWN TEST · THEIR NUMBERS`), grey → magenta on the word. | `steps` module (tabs, one active); LC counter; `micro` eyebrow. | Tab chip skin with 3 states; eyebrow recolour; micro captions attached to a window. | tuning (`steps` skin `chips3`) + new op `activate` keeps done state |
| 9 Mascot | Full-body 2-D cartoon presenter (Rick Sanchez, holding a sticker laptop), bbox x 0–225 (hair right edge 222), y 562.5–1363.5 (h 801 = **41.7 % H**), feet at 1363.5, laptop cropped by the frame edge. **Present** 3.30–56.50, 68.10–98.97, 100.97–120.53, 127.30–end (≈74 %); hidden for full-width scaffolds. **Enter**: slides from off-left, hair right edge 37→63→85→101→113→121→129→133→135→137 native (Δ 39, 33, 24, 18, 12, 12, 6, 3, 3 px) → **11 f = 367 ms ease-out (≈cubic)** (3.30, 68.10, 100.97). **Exit**: slide left, Δ 18, 24, 39, 51, 55 px → **5–6 f ≈200 ms ease-in** (56.40, 98.83, 120.43). **Finale**: re-enters at **1.29× scale** (top 325.5, feet 1360.5, feet-anchored), 127.30–127.63 (10 f ease-out). **Face**: puppet mouth + eye states (≥12 distinct: open/closed mouth shapes, pupils up, blink); face changes on 13–16 % of frames, hold runs median 9 f (p25 4, p75 19); head micro-pose ±1–2 native px held 0.5–2 s (not periodic). Never overlaps content. | SpongeBob placeholder, static open + blink, LC never hides. | Presenter must be original (rights). Needs talk states, hide/show slides, finale scale. | asset (original character with mouth / gaze sprites) + new capability (mascot `enter` / `exit` / `scale` ops, lip-flap on voiced spans) |
| 10 Captions | **"Highlighter chip"** skin. Box: fill **#FFFFFF**, **no border**, radius ≈10.5, soft shadow (≈0 6 18 rgba(40,40,20,.15): #D8D8D1 at +4.5…9 px fading by +27); y **1425–1522.5** (h 97.5, centre 76.8 % H), centred on x 540, width hugs the text (pad-x ≈34.5). Text: heavy sans (Inter-like, ≈700–800), **cap 40.5 → ≈56 px**, single line. Karaoke: spoken **#42474E**, upcoming **#66686F**, active word **near-black #0E0600 on a yellow box #FDE587** (h 69, y 1440–1509, radius ≈4.5, pad ≈7.5 each side). The box hops word to word in **1 f**; lag vs Whisper word start **median +7 ms (IQR −63…+80)** over 443 words. **Chunk swap** (133 swaps, median life 0.97 s, p10 0.57, p90 1.30): new chunk scales **0.95 → 1.007 → 1.0 over 3 f** (100 ms), no fade, no blank frame. Words/chunk median **4** (dist 1:11, 2:15, 3:29, 4:46, 5:25). Caption never disappears after 0.167 s. | LC "paper": #FEFCF8, 1.5 px border, r 12, 50 px w800, active = blue text, 3 words, pop .985→1.015→1. | Highlighter box behind the active word; no border; 56 px; 4 words; 0.95 start scale. | new caption skin `LB` (tuning of the existing skin engine + a highlight-box layer) |

### C. Visual design system

#### 11. Palette

| Role | R7 hex | Where | Our LC |
|---|---|---|---|
| Background | **#F1F1EA** flat | corners, all frames | #F4F4ED |
| Bg dots | **#E1E1DA** (±), 3 px, pitch **40**, full frame, static | 45.5 y 1595… | #E7E7E0, 38 px |
| Crop marks | #A0A099, 1.5 px L-brackets | 4 corners of the stage | none |
| Ink / title bars / brand block | **#1B1D1D** (#1C1E1E) | header, window bars | #17232B text |
| Borders | #121212–#161611, 1.5 px (header 3 px) | all windows | #BCC3C2 1.5 px |
| Card body | **#FDFDFD** | windows | #FEFCF8 |
| Card sub-band | #F7F5F1 (situation band), divider #CBC9C7 | sheet | — |
| Hard shadow | **#CCCAC4** (windows, +7.5 px), #C4C4BD (header, +4.5 px) | all | soft shadows |
| Brand magenta (wordmark, keyword, eyebrow, counter) | **#981878** (text), #9A5585 (counter digits) | 0.7, 65.5 | none |
| Magenta UI (radio fill, dot, bars, outline) | **#CC60AC** / #CF5BB6; tint #F9EDF5 (row focus); pale #FCA8EC | 52.0, 45.5 | none |
| LLM / generator blue | **#2044B0** title bar, #2D5BD0 bar chart, #1D3FA8 keyword | 38.5, 101.5, 123.5 | #1766DA accent |
| Highlighter yellow | **#FDE587 / #FCE484** (caption), amber #F8A400 (text highlighter in the LLM window) | caption, 38.5 | none |
| Danger / cost | **#D04444** (cost bar, `$`), stamp #AC3231–#B03030 | 90.5, 111.5 | brick #B14B30 |
| Success | green fill ≈#DFF2E2 + green check (status row, result card) | 56.2, 71.3 | #DDF1E3 |
| Pink band | #EF8A9E-ish with a fine dot texture (≈#F29AAE dots) | 57.5, 105.5, 108.5 | none |
| Text: primary / secondary / muted | #1B1D1D / #42474E / #6E6E6A (mono micro), grey display #8A8A86 before recolour | — | #17232B / #474C4D / #626667 |
| Hues at once | median 2 (black + magenta); 3 in LLM scenes (blue) and cost scenes (red); media adds full colour | — | ≤3 |

#### Items 12–19

| # | Reference R7 (measured) | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 12 Typography | Heavy grotesk (Inter-like 700–800, tight −0.02…−0.03 em) for captions (cap 40.5) and headlines / display (cap ≈40.5; "What is" ≈73 cap; hero "Jev" wordmark cap ≈87). **Mono** (JetBrains/IBM-Plex-like) for window title bars (glyph 18), header title (cap 15), eyebrows (cap 16.5, tracked ≈0.2 em), DECISIONS, tabs, form labels (`DEPARTMENT`, `URGENT?`, cap ≈12, tracked), terminal. Sans ≈24 px for form options. The counter uses a **condensed dot-matrix-like mono**. The press screenshot shows a condensed grotesk (third-party page, not UI). Case: sentence case for headlines/captions, ALL CAPS mono for chrome. Text per frame: caption (4 words) + 1 headline + 20–45 UI tokens. | Inter + JetBrains Mono bundled; LC title 72/800. | Headline size tier ≈56 (not 72–105); the counter face. | tuning + font (condensed mono for the counter) |
| 13 Card anatomy | **Window card**: 1.5 px #121212 border, r 0, hard shadow +7.5/+7.5 #CCCAC4; **title bar 39 px** (#1C1E1E, or **#2044B0 for LLMs**), left 12 px hollow square glyph + mono label `Jev · decision sheet (example)`, right 3-line grip (≈27×7.5); body #FDFDFD, padding 22.5. Variants: decision sheet, form (`your_app`), inbox message, LLM writer, terminal (body #1C1E1E, mono #E6E6E6, magenta `$`), chat, repo card (GitHub glyph + `BUILT WITH JEV` micro + mono path + grey description), result card (green), media window (video/screenshot body, no padding), tiny app card (≈220×195), document tile (≈90×120, dashed placeholder variant), black **model tile** (≈280×360, #1B1D1D with a faint grid, logo chips row, 2-line white label). | LC windows r 16 soft shadow; DH panels. | All window skins are new (hard shadow, r 0, black/blue bar, grip). | new skin (LB theme on `panel` / window chrome) |
| 14 Pills / badges | Tab chips (§8); `New · Sept 2026` red-outline pill; red `Charged twice!` tag; `$$$` red tag; magenta **tokens** (h ≈27, white text, the fly-to-field chips); `JEV` magenta / `AN LLM` blue label tags (h ≈27, square); `155 projects…` pink outline pill; radio **option chips** (◯ + label). Flat, square or tiny-radius, 1.5 px outlines. | `pill` (dark DH skin), `chips`. | New flat-brutalist pill skin + token chips. | tuning + new op (token fly) |
| 15 Iconography | Line icons, ≈2 px stroke, 24–30 px (search, calculator, `</>`, database, mail, YouTube, home, grid, Tetris block, browser window, clock, `$`, page); vendor logos (OpenAI wordmark, Claude asterisk #D97757-ish, Gemini star, TypeSafe logo, GitHub); avatar disc `M` (Maya, magenta). **Real product imagery**: screenshots and recordings. | lucide-like icon set (`ICONS`). | Vendor logos need trademark review; media support. | asset (logos) + new module (media) |
| 16 Connectors | Almost none. Direction is carried by **motion** (token fly, chips flying into the model tile, scan line) and by vertical stacking (source window above target form). No arrowheads, no lines. | connector family. | None needed. | none |
| 17 Charts / numbers / tables | **Race bar chart** (`response time`): 2 rows (JEV / A BIG LLM), axis 0 s … 10 s with 11 ticks, mono 9 px labels; the Jev bar is short magenta + label, the LLM bar blue and grows linearly. **Cost bar**: single red bar 664.5×46.5 under a `COST` micro label, shrinks. **Probability bars**: 6 px track #E0E0E0 under each sheet row, filling magenta to p. **% numbers**: mono-ish magenta, digit h 33, right-aligned x ≈994. **Counters**: header. **Price table** only as a screenshot. | `bars` (fill), `kpis` (count), `chart` (line). | Race (linear time) bar; inline probability bars; % slam. | new module `race` + sheet ops |
| 18 Data realism | Consistent fake-but-plausible data carried across scenes: Maya, "I was charged twice and I need this fixed right now.", TEAM / URGENT? / ESCALATE?, billing 94 % / urgent 88 % / frustration high 91 %, "Find me flights to Tokyo under $500.", `rm -rf ~/projects`, 10 named docs, github repos (`elie222/inbox-zero`, `leepokai/jev-guard`, `hotchpotch/jev-reranker`, `cobanov/awesome-jev`), `155 projects in the first week`, Sept 15 / Sept 20 2026 news. The DECISIONS counter is a running tally of decisions shown (3 per 3-question sheet). | Storyboard data per scaffold. | The tally counter as a story device. | storyboard rule |
| 19 Background | Flat #F1F1EA + static 40 px dot grid + static crop marks. Never moves. Exceptions: the **pink band** (full-width 591–1338, its own denser dot texture) in S13, S27, S28; the black model tiles carry a faint grid. | LC plate. | Pink band plate variant. | tuning + new module (band) |

---

## D / 5. NEW COMPONENTS / SECTIONS (not covered by `catalog.js`)

Anything that is a re-skin of an existing card is flagged "(re-skin)". Rects are @1080.

### 5.1 `lbHeader`: brand HUD with a decision counter (chrome)
- **Anatomy**: x 40.5–1039.5 × y 235.5–292.5, 3 px #161611 border, fill #FDFDFD, hard shadow +4.5/+4.5 #C4C4BD. Cells:
  - brand block 40.5–145.5, #1B1D1D, magenta dot + white bold 27 px brand name;
  - title cell, centred mono caps cap 15, tracked 0.15 em;
  - counter cell 823.5–1039.5: `DECISIONS` mono caps cap 12 #6E6E6A + a zero-padded 4-digit magenta counter, digit h 21, right edge x 1015.5.
- **Data**: `brand`, `title` (chapter), `label` (`DECISIONS`), `value` (int), `pad` (4).
- **Motion**:
  - title: hard swap, 1 f, on the chapter cut;
  - value `tick`: 1-f swap + punch 1.0→1.14→1.29→1.29→1.29→1.14→1.0, 7 f, right-anchored (`power2.out` up, snap down);
  - `countUp`: expo.out, e.g. 37 → 1,000,000 in 20 f (the remaining fraction halves every ≈2.3 f), thousands separators, the cell grows leftward.
- **Anchoring**: tick on the frame the decision lands (a scan / radio fill); title on the chapter's first word (+33…+153 ms, one +267).
- **Props**: `{brand, brandDot:'#CF5BB6', title, counter:{label, value, pad:4, tone:'magenta'}}`.
- **Ops**: `title{text}`, `tick{by|to}`, `countUp{to, dur, ease:'expo.out'}`.

### 5.2 `tabChips`: 3-state step chips (re-skin of `steps`)
- **Anatomy**: row y 306–345, chips h 39, gap ≈12, centred on 540. Each chip: dot + `N · LABEL` mono caps cap 13.5.
- **States**:
  - done: magenta border, dot and text;
  - active: black border, white fill;
  - future: grey #C8C8C0 border, hollow dot, grey text.
- **Motion**: all state changes in 1 f, on the scaffold cut. The row appears with the chapter and persists across its scaffolds.
- **Props**: `{items:[string], active:int}`.
- **Ops**: `activate{step}` (earlier steps become done).

### 5.3 `decisionSheet`: the host module (NEW, the heart of the video)
- **Anatomy** (45.5 s): window card 319.5–1020 × 430.5–889.5.
  - Title bar 39 px `Jev · decision sheet (example)`.
  - SITUATION band (#F7F5F1, mono micro label + quoted sentence ≈21 px), divider #CBC9C7.
  - 1–3 question rows at ≈104 px pitch. Each row has:
    - a mono caps label (`DEPARTMENT`, `URGENT?`, `FRUSTRATION`);
    - 2–4 radio options (◯ Ø ≈27 + ≈24 px sans label);
    - a 6 px probability track #E0E0E0 across the row (x 345–994);
    - an optional right-aligned % (magenta, digit h 33).
- **Variants**:
  - compact, no situation (S8, S31 bottom, S30);
  - question grid (S6, S23: 2 columns × 7 rows of `Question? ◯◯` chips, 1.5 px borders);
  - tiny app card (S33: icon + app name + one question + one radio);
  - single-question judge card (S15, S20).
- **Motion**:
  - enter: cut + rise-settle 25.5 px, 7–9 f ease-out (E1);
  - **row focus**: tint #F9EDF5 on in 1 f at the question word, off with a 6 f fade (E9);
  - option pulse on each option word (ring 3–4 f);
  - **scan fill**: a magenta 1.5 px line sweeps down the rows in 5 f (ease-in, 291 px) and each radio fills as the line passes, the radio fill popping (ring Ø +20 % 2 f) (E10);
  - **% slam** 1.36→1.18→1.09→1.0 over 4 f, right-anchored, 100–133 ms stagger (E11);
  - probability bar fill (with the %);
  - **row outline** (1.5 px magenta box around the row, 1 f) on the answer word;
  - selection outline on a tile/option (S19);
  - exit: cut or push-out (E6).
- **Anchoring**:
  - focus tint on the question word (+33…+190);
  - option pulse on the option word;
  - scan on the verb ("returns" +70);
  - % on "probabilities" (+87), then free 100 ms stagger;
  - outline on each spoken value ("Billing 94 %").
- **Props**: `{title, situation?, questions:[{label, options:[string], answer?, p?}], showBars?:bool, compact?:bool}`.
- **Ops**: `focus{q}`, `pulse{q,opt}`, `scan{dur?}` (fills all answers), `pick{q,opt}`, `prob{q, p}` (slam + bar), `outline{q}`, `unfocus{q}`.

### 5.4 `targetForm` + `tokenFly`: structured output landing in "your app"
- **Anatomy**: window `your_app` 319.5–1020 × 930–1314.
  - Rows at 78 px pitch: mono caps label left (`TEAM`, `URGENT?`, `ESCALATE?`), dashed-outline field right (x 655.5–994.5, h ≈57, 1.5 px dash #B5B5A8 ≈6/4).
  - Footer status row: dashed box with a grey check + "Waiting for answers…".
- **States**:
  - empty;
  - `?` placeholder in a magenta frame (asked);
  - **uncertain** value in red with `?` (`billing?`, `fairly?`, `maybe??`, the LLM path);
  - filled (grey flash 1 f → white field, ink text);
  - status success (green fill + check, "Billing team · urgent · human notified").
- **Token fly** (E12): magenta chips (h ≈27) lift off the picked options and fly ≈525 px diagonally into the fields, ≈10 f each, ease-in-out, 133 ms stagger. The field flashes grey on landing and settles in 2–3 f.
- **Anchoring**: fly starts on "answer" (+60). Status success lands on "immediately" (+140).
- **Props**: `{title:'your_app', fields:[{label, value?}], status?}`.
- **Ops**: `ask{field}`, `fill{field, text, tone?:'uncertain'}`, `fly{fromEntity, field, text}`, `status{text, tone:'ok'}`.

### 5.5 `writerWindow`: streaming LLM text + highlighter (NEW)
- **Anatomy**:
  - window with a **blue #2044B0** title bar `LLM · writing…` or `Claude · writing Maya's reply`;
  - logo row (OpenAI wordmark, Claude asterisk, Gemini star);
  - body sans ≈24 px on ruled lines (39 px pitch, faint blue rules);
  - the last line fades to grey (a streaming tail).
  - Width 700 (L-M) or 960 (L-F). Height grows with the text (S11: 34.93 at y 591–?, re-laid to top 402 at 36.77).
- **Motion**:
  - drop-in rise 18 px, 5 f (34.93);
  - **stream**: ink grows linearly (≈+400 native px of glyph ink per 100 ms, ≈6 lines in 1.5 s, i.e. faster than speech; S11 35.2–36.7, S30 112.0–115.4);
  - **highlighter**: amber #F8A400 marks sweep L→R over phrases (≈4–6 f each: 37.57, 38.17, 38.57);
  - extraction into `targetForm` fields as uncertain values.
- **Anchoring**: stream starts on the "LLM / Claude" noun; highlights on "parse / structured / data".
- **Props**: `{title, vendor:'llm'|'claude', text, rate?:cps, tone:'blue'}`.
- **Ops**: `stream{from?, to?, cps}`, `mark{phrase}`, `extract{phrase, field}`.

### 5.6 `mediaWindow`: embedded screen recording or screenshot (NEW; also the R8 topic)
- **Where**: a window card (C2 anatomy §13) whose body is the media, with **no padding**:
  - **Doom** (S14): window x 60–922.5 × 387–1089; title bar 387–427.5 `typesafe.ai · Jev plays Doom`; video rect x 61.5–921 × 429–1087.5 (≈860×659, 1.305:1, i.e. a 4:3 source filled with ≈2 % crop: **cover**); hard shadow +7.5 #CCCAC4; 1.5 px border; radius 0.
  - **Collage** (S2): 4 media cards of different sizes overlapping (press 60–663 × 393–705, browser-use 438–1017 × 561–≈900, news 69–433.5 × 820.5–1156, github 400.5–1017 × 906–1327).
  - **Pink band** (S13/S27/S28): a screenshot window sits on the band (press 63–1017 × 630–1101).
- **Scaling**: cover, static. No Ken Burns, no pan, no zoom punch (edges constant ±0 px over 1.5 s).
- **Playback**: Doom plays in **real time** from the cut: a new source frame on 2 of every 3 output frames → a ≈20 fps source played at 1×, 59.467–60.967 (1.5 s), cut, no loop visible. The browser-use recording also plays (the map → dark results view changes at ≈2.03 s).
- **Audio**: no game audio is identifiable. RMS in the window is −21.9 dBFS vs −19.8 in the 3 s before. Only speech plus the bed are audible → treated as **muted**.
- **Overlays**:
  - `Jev · live judgments` terminal window (505.5–1045.5 × 1000.5–1347) overlapping the video's bottom-right, with animated green probability bars (its own motion). It slides in 13.5 px in 3 f ease-out.
  - Display words "Fast." / "Intuitive." (cap ≈40.5, ink) stacked at the bottom left.
  - A 1.5 px highlight box drawn over the press headline (S13, ≈58.6).
- **Enter / exit**: the media scaffold hard-cuts in (the mascot is already gone; full width). Collage cards pop with a 33 px side-slide, 6–7 f ease-out, 300 ms stagger. Exit = hard cut.
- **Stills**: screenshots (press headline, news, Jev.Cost table, github) use the same window, static, no motion.
- **Module**: `mediaWindow`. Props: `{title, src, kind:'video'|'image', fit:'cover'|'contain', rect:[x,y,w,h], mediaStart?:s, rate?:1, loop?:false, muted:true, band?:'pink'}`. Ops: `play`, `pause`, `highlight{rect}`, `overlay{module}`.
- **HyperFrames**: `<video class="clip" muted playsinline data-start data-media-start>` inside the window body (object-fit: cover), seek-safe via framework-owned media; `<img>` for stills. The storyboard rect in 1080-space `[60,387,862.5,702]`.

### 5.7 `pinkBand`: full-bleed showcase band (NEW plate)
- **Anatomy**: x 0–1080 × y 591–1338 (h 747), fill pink (#EF8A9E ±; a denser dot texture), sitting behind a media window. The brand lockup (TypeSafe logo + wordmark, cap ≈75) sits above the band on the plain bg (S13). Variant (S27/S28): a smaller pink card behind one screenshot (≈460×260).
- **Motion**: appears with the cut (0 f); the window pops onto it 33 px / 10 f ease-out 700 ms later.
- **Use**: "press / product proof" moments (company, news, pricing).
- **Props**: `{tone:'pink', y0, y1}`.
- **Ops**: none.

### 5.8 Smaller new pieces

| Module | Anatomy | Motion | Anchor | Props / ops |
|---|---|---|---|---|
| `keywordHeadline` (re-skin of `headline`) | 1–2 lines, cap ≈40.5, w700, −0.03 em, centred on the column; grey #8A8A86 until its keyword; keyword recolours to magenta #981878 / blue | keyword grey→colour in 1–2 f (64.700) | keyword word +100…+240 | `{lines, keyword, tone}` · `recolour` |
| `displayLine` (right-aligned kicker) | 1–2 lines cap 40.5, right edge x ≈1018, at the bottom of the stack ("…in AI software.", "Less cost.", "About one blink.", "Not obsolete.") | pop with rise; grey → ink/magenta recolour | its phrase | `{text, tone}` · `recolour` |
| `modelTile` | black #1B1D1D tile ≈280×360 with a faint grid, a logo chip row (OpenAI / Claude / Gemini white chips), a 2-line white label ("Giant language model", "Expensive LLM", "Frontier model"), optional red `$$$` tag | chips fly in; coins/icons cascade under it (133 ms / 100 ms stagger); `$$$` tag pops | "giant / expensive / frontier" | `{label, logos:[...]}` · `absorb{from}`, `tag{text}` |
| `coinRow` / `iconStack` | red `$` coins Ø ≈30 in a row; clock / `$` icon columns | cascade 133 ms stagger, 30 px drop, `power2.out` | free-running after the noun | `{icon, n, dir}` · `cascade` |
| `terminal` (re-skin of `code`) | dark window #1C1E1E, grey prompt text, **magenta `$`**, 12×27 white block cursor, comment line `= delete every project…` | cursor blink 8 f on / 7 f off; typing **≈1.7 chars/f (51 cps), linear**; comment pops after | "shell command" +20 | `code` + ops `blink`, `type{cps:51}` |
| `docGrid` (RAG) | 2×5 grid of document tiles (≈90×120; dashed empty slots first), a mono name strip, a score ring Ø ≈18 at the top-right corner of each | fill cascade (≈70 ms stagger); rings pop; relevant ones fill magenta + pink wash, others removed | retrieve / scores / relevant | `{docs:[{name, relevant, score}]}` · `fill`, `score`, `select` |
| `toolTiles` | 2×2 tiles ≈230×165 (icon + label 24 px), dim #B0B0AA text → lit ink | dim→lit 4 f; the picked tile gets a magenta outline | each tool noun +87…+193 | `{tiles:[{icon,label}]}` · `light{i}`, `pick{i}` |
| `raceBars` | 2 rows, axis 0–10 s with mono ticks, magenta short bar + label, blue bar | the LLM bar grows **linearly 7 px/f** (real time); the Jev bar pops at its value | "reports / times" | `{rows:[{label, tone, seconds}], axisMax}` · `race` |
| `costBar` | single red bar 664.5×46.5 + `COST` micro | shrink 100→30 %, 9 f ease-in-out | "cost" (−110) | `bars` + op `shrink{to}` |
| `stamp` (re-skin + op) | red #AC3231 double-rule stamp, mono condensed caps, rotated ≈−8°, ≈530×207 | **slam ≈2.5× → 1.0 over 6 f** (accelerating), then a **black strike** L→R over 4 f (negation) | "obsolete" +80, then "isn't" semantics | `stamp` + op `strike` |
| `repoCard` | small window: GitHub glyph, `BUILT WITH JEV` micro, mono repo path, grey description | pops at the scene end | "people are building" beats | `{repo, desc}` |
| `chatWindow` | user bubble right (#E8EEF8, blue text), grey reply bubble left | message pop; shrink to the corner (FLIP ≈400 ms) at 125.53 | "talk to" | `{messages}` · `shrink` |
| `appGrid` | 3×2 tiny window cards ≈220×195: title bar + icon + app name + question + radio | radios light one per word (+200…+270), each ticking the header counter | enumeration words | `{apps:[{icon,name,q}]}` · `light{i}` |
| `projectCards` | 3-column grid of ≈210×72 small windows ("Plays Tetris" …) + pink `155 projects` pill | scattered pop cascade over ≈1.3 s | "people are building" | `{items}` |
| `docStrike` | document tile with blue text lines + red X strokes + red label "No essays" | label pops, X draws (2 strokes, ≈3 f each), text lines write under it | negation "doesn't" | `{kind, label}` · `x` |

### 5.9 Layout templates (exact geometry, 1080 px)

| ID | Template | Used (s) | Boxes |
|---|---|---|---|
| T1 | Mascot + stacked windows | 3.3–56.5, 68–99, 101–120.5 | mascot 0–225 × 562.5–1363.5; eyebrow cap-top ≈385; window A 319.5–1020 × 430.5–889.5; gap 40.5; window B 319.5–1020 × 930–1314 |
| T2 | Host sheet → target form | 26.4–56.6 | as T1: source (inbox / LLM / sheet) on top, `your_app` below, same x |
| T3 | Headline + object | 9.9, 11.2, 18.3, 60.97, 63.6, 91.5, 101, 111.9 | headline cap-top ≈390–405, centred on the column; object below; displayLine right-aligned at the bottom (≈1020–1110) |
| T4 | Full-width media + overlay | 59.47–60.97 | window 60–922.5 × 387–1089; overlay 505.5–1045.5 × 1000.5–1347; display words at x 60, y ≈1110–1200 |
| T5 | Brand lockup + pink band | 56.6–59.47 | logo 159–921 × 405–550; band 0–1080 × 591–1338; window 63–1017 × 630–1101 |
| T6 | Collage | 1.53–3.2 | 4 overlapping media windows, see §5.6 |
| T7 | Grid of small cards | 66.1 (3×4), 73 (2×2), 84 (2×5), 125.5 (3×2) | gaps 15–18; grid inside x 319.5–1020 (L-M) or 60–1038 (L-F) |
| T8 | Two-part summary | 120.6–125.1 | "LLMs generate." cap-top ≈405 + writer window 60–1020 × ≈460–735; "Jev decides." ≈960 + sheet ≈1020–1370 |

---

## E. Motion system

### Measured events

Displacements are @1080 px per frame (Δ).

| # | Event (time) | Property | Travel | Duration | Per-frame profile | Easing |
|---|---|---|---|---|---|---|
| E1 | Scaffold cut + rise-settle (14.733; 3.333; 57.300) | window top y | **25.5 px** up (33 px at 57.3) | 7–9 f (233–300 ms) | Δ 7.5, 6, 4.5, 3, 1.5, 1.5, 0, 1.5 (native 5, 4, 3, 2, 1, 1) | ease-out (`power2.out`/`power3.out`); **opacity 1 from frame 1** (title bar #1C1E1E already on the first frame), no fade |
| E2 | Side slide-in of collage cards (1.533, 1.833) | card right/left edge | 33–34.5 px horizontal | 6–7 f | Δ 12, 7.5, 6, 4.5, 1.5, 1.5 | ease-out; 300 ms stagger |
| E3 | Mascot enter (3.30, 68.10, 100.97) | hair right edge | ≈205 px from off-left | 11 f = 367 ms | Δ 39, 33, 24, 18, 12, 12, 6, 3, 3 | ease-out ≈cubic |
| E4 | Mascot exit (98.83) | same | ≈200 px | 5–6 f | Δ 18, 24, 39, 51, 55 | ease-in |
| E5 | Finale mascot (127.30–127.63) | bbox | slides in at 1.29× scale | 10 f | ramp like E3 | ease-out |
| E6 | **Push-out left** of the LLM + form windows (39.70–40.03) | window right edge | ≥1012 px (fully off-left) | 10 f = 333 ms | Δ 6, 18, 30, 45, 72, 102, 144, 189, 252 | strong ease-in (`power3.in`); the headline pops during it; the next host pops 40.067 (1 f gap) |
| E7 | Counter tick (0.567, 47.60…) | digit height | 1.0→1.29→1.0 | 7 f = 233 ms | h 14, 16, 18, 18, 18, 16, 14 native | up ease-out, hold 3 f, down 2 f |
| E8 | Caption chunk swap | box width | 0.95→1.007→1.0 | 3 f | e.g. 533, 560, 563, 556 native | overshoot pop, no fade |
| E9 | Row focus (43.233) | row fill | #FDFDFD→#F9EDF5 | on 1 f, off 6 f | fade-out 43.767–43.967 | step on / linear off |
| E10 | Scan fill (47.533–47.667) | scan-line y | 291 px down | 5 f | Δ 39, 60, 84, 108 | ease-in; radios fill as the line passes |
| E11 | % slam (49.067 / 49.167 / 49.300) | digit height | 1.36→1.0 | 4 f | h 30, 26, 24, 22 native | ease-out, right-anchored, no rebound; 100/133 ms stagger |
| E12 | Token fly (55.00–55.63) | chip centroid | ≈525 px diagonal down-right | ≈10 f per chip | slow-fast-slow | ease-in-out; ≈133 ms stagger; field flashes grey 1 f on landing |
| E13 | Keyword recolour (64.700) | ink colour | grey→magenta | 1–2 f | — | step |
| E14 | Count-up (129.93–130.60) | value | 37 → 1,000,000 | ≈20 f = 667 ms | 31,950 · 314,547 · 535,984 · 703,715 · 825,198 · 907,895 · 959,264 · 986,762 · 997,852 · 999,990 · 1,000,000 (every 2 f) | `expo.out` (the remaining fraction ≈×0.55 per 2 f) |
| E15 | Stamp slam (111.20–111.37) | stamp area | ≈2.5×→1.0 (red pixel area 27k→7k, clipped by the frame) | 6 f | area 27096, 27050, 26571, 24034, 18570, 7036 | accelerating shrink (ease-in), lands with no rebound |
| E16 | Strike across the stamp (111.467–111.567) | line right end | L→R ≈470 px | 4 f | Δ ≈220, 114, 135 | ≈linear |
| E17 | Cost bar shrink (90.733–91.000) | bar right edge | 1000.5→534 (−70 %) | 9 f | Δ 9, 27, 58.5, 109.5, 130.5, 76.5, 36, 15, 4.5 | ease-in-out (`power2.inOut`) |
| E18 | Race bar (≈101.40–103.47+) | LLM bar right edge | +7 px/f | ≥62 f | constant Δ 7 | **linear** (real time) |
| E19 | Terminal typing (80.20–80.50) | ink | 17 chars | 10 f | ≈1.7 chars/f | linear stepped; cursor blink 8 f on / 7 f off before typing |
| E20 | Tile dim→lit (73.30, 74.03, 74.67, 75.37) | tile pixels | dim→lit | 4 f + a 2nd change 5–7 f later | — | fade 133 ms |
| E21 | Coin cascade (23.067–23.733) | coin count | 6 coins, each dropping 30 px | 133 ms stagger | — | ease-out drop |
| E22 | Doom overlay slide (59.467–59.533) | overlay right edge | 13.5 px | 3 f | Δ 13.5, 0 | ease-out |
| E23 | Scaffold cut (all 20+ cuts) | content layer | — | **0 f** | the header title swaps the same frame on chapter cuts | hard cut; caption, header, crop marks and mascot persist |

### Items 21–27

| # | Reference R7 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 21 Entrance recipes | **Default = pop + drift**: the element is fully opaque on frame 1, offset 25–34 px (up or sideways toward its resting place), settling in 6–10 f ease-out (E1, E2). Headlines/display lines pop the same way. Tokens/coins/icons cascade at 100–133 ms. The mascot slides from off-left (E3). No fades, no scale-ins except slams (E11, E15). | `reveal` = fade + 4.5 px rise. | Ours fades; R7 pops opaque with a longer 25 px drift. | tuning (profile entrance recipe `popDrift`) |
| 22 State changes | row focus tint (E9); radio fill with scan (E10); % slam + bar fill (E11); keyword recolour (E13); field fill + grey flash; status → green; tile dim→lit (E20); counter tick (E7); tab state (1 f); strike (E16); cost shrink (E17); streaming text; highlighter marks. | `text`, `tone`, `count`, `dim`, `strike`, `slam`, `highlight`, `fill`, `activate`. | Missing: focus tint, scan fill, token fly, stream, marker highlight, race, tick punch. | new ops (§5) |
| 23 Emphasis | keyword recolour (≈12×); % slam; stamp slam; counter punch; row outline; option pulse. No glow, no shake, no camera. | slam 1.15, highlight ring, flash. | Recolour-as-emphasis and the 1.29 punch. | tuning + ops |
| 24 Exits / transitions | Hard cut 0 f (≈25 cuts); push-out left (E6, once); mascot ease-in exits (E4); chat window FLIP shrink (125.53). End: hold, no fade. Persist across cuts: header, crop marks, caption, mascot (unless full width). | LC hard cut + rebuild. | Push-out exit; FLIP shrink. | new op `pushOut{dir}` |
| 25 Process / ambient | streaming text (2×); terminal cursor blink; typing; live video (Doom, browser-use); the Doom overlay's animated bars; race bar crawl; mascot talk/gaze. | typing, packet loops. | Video and stream. | new module (media) + op `stream` |
| 26 Camera | none (no zoom, pan or shake). | none. | — | none |
| 27 Choreography | Build order per scaffold: cut (header title, if a chapter) → object pops (+0) → eyebrow/headline → per-word state changes (focus → pulse → pick) → display line → counter tick at the resolution. Motion is front-loaded; holds carry the stream/typing/video or mascot talk. | Similar build order. | — | storyboard rule |

---

## F. Timing & narration sync

| # | Reference R7 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 28 Beat density | Machine beats (content-region change windows, merged <0.2 s, Doom playback counted once): **137 in 130.9 s = 62.8 /min**. Gap median 0.80 s, p10 0.33, p90 1.73. **Longest gap 3.43 s** (111.93–115.37, Claude reply streaming: ambient motion only). Longest fully static content hold **2.67 s** (112.7–115.37). 33 layout states → **15.1 /min**; scene life **median 3.53 s**, mean 3.97, **max 16.87 s** (decision-sheet host 39.73–56.60, mutated in place). | LC gates: 45–95 beats/min, max visual gap 4.5 s. | Within the bands. | none |
| 29 Word anchoring | 57 hand anchors (visual onset − Whisper word start; list in §3): **median +80 ms, IQR +27…+140, range −373…+380**. 89 % within ±200 ms. Cuts land +20…+180 (median +60). Leads: collage cards (−67…−187, free stagger), cost bar −110, "A huge model" headline −373 (the theme lands before the noun). Lags > 200: headline "Jev skips that" +230, "Faster" +380, `GENERATE` micro +240, radios in the finale +200…+270. Caption word hop median +7 ms. | compiler anchors with per-profile lag. | Similar; keep +60…+150 for pops, 0 for captions. | tuning |
| 30 Sentence → treatment | question → row focus tint; enumeration of options → per-option pulse; "returns / answers" → scan fill + counter tick; number → % slam; negation ("doesn't", "isn't … obsolete") → X strokes / stamp + strike; comparison → race bar or keyword recolour pair; "cost" → red bar shrink / `$` cascade; "LLM writes" → streaming writer; "parse" → highlighter + uncertain fields; proof / company / news → pink-band screenshot; demo → video window; enumeration of apps/tools → tile/grid light-ups; "stack up" → icon stacks; summary → two-part keyword headline. | DH/LC rule set. | New rules for form/decision content. | storyboard rules |

## G. Narrative / storyboard

| # | Reference R7 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 31 Structure | **Hook** 0–3.2: title question "What is Jev?" + a proof collage of real media (press, recording, news, repo). **Act 1**: what it is / isn't (3.2–14.7). **Act 2**: the problem (tiny agent choices → giant model, wasteful; 14.7–26.4). **Act 3**: a worked example with one ticket, LLM path vs Jev path, in one mutated host (26.4–56.6). **Act 4**: company claim + video proof (56.6–66.1). **Act 5**: 4 use cases as tabs (66.1–91.5). **Act 6**: why it matters, speed/cost with numbers (91.5–107.7). **Caveat**: new, not a replacement (107.7–120.6). **Recap**: "LLMs generate / Jev decides" (120.6–125.1). **Ending** (last 5 s): app grid lights up + mascot 1.29× + the counter spinning to 1,000,000, hold, no fade. | opener + scaffolds + endcard. | Proof-media hook, recap pair, counter crescendo. | storyboard + modules |
| 32 Scaffold selection | Keep and mutate while the same example runs (sheet host 16.9 s; `your_app` persists 29.9–56.6 under 3 different sources). Replace on a new sub-topic with a hard cut. Callbacks: the decision sheet returns 6× (S1, S5, S12, S16, S18–20, S30–31); the black model tile 4×; `your_app` values return in the finale via the counter. | LC rebuild per scene. | The persistent target form under changing sources. | new capability (a slot that persists across a source swap) |
| 33 Entity continuity | Jev = black bar + magenta; LLM = blue bar + vendor logos; cost = red; Maya's ticket text is identical in 5 scaffolds; the counter only increases. | registry rule. | — | none |

## H. Audio

| # | Reference R7 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 34 Voice | Single male narrator; 443 words in 130.14 s = **204 wpm**. Inter-word gaps >0.25 s: only 17, median 0.28 s, **max 0.46 s**. Whisper hears "Claude" as "Clod" 2× and "no prose" as "no pros" (fast delivery). | ~212 wpm, 0.2 s gaps. | ≈OK. | none |
| 35 Music / SFX / mix | **I −14.1 LUFS, LRA 1.5, TP −1.3**. 50 ms RMS p5 −37.2, p50 −18.3, p95 −14.1 dBFS; 0 % of windows below −60; pauses median −21.3 dBFS vs words −19.9 → a **continuous bed** (music or room tone; stems not separable). High-band onsets fall within 50 ms of visual beats for 44 % of beats vs a 34 % chance rate → weak evidence of sparse SFX; not assessable by ear. Doom video audio is not audible (muted). | −14 LUFS master, SFX on every change, **no music** (user decision), ~7 % of windows below −60. | Bed vs none (a user decision stands); our SFX density is probably higher than R7's. | keep; consider a light bed only if the user reverses the decision |

## I. Production

| # | Reference R7 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 36 Export | 720×1280, 30 fps, H.264 High ≈286 kb/s + HE-AAC 57 kb/s. Flat UI, deterministic, except the **embedded video clips** (the render needs frame-accurate media seeking) and the raster logos/screenshots. | 1080×1920 30 fps, HF render, gates. | Media clips need seek-safe `<video>` handling plus the asset sourcing/rights pipeline. | new capability (media clips in stage) |

---

## 6. Pacing numbers

| Metric | R7 |
|---|---|
| Beats / min | **62.8** (137 machine beats; ambient video counted once) |
| Layout states / min | 15.1 (33 states) |
| Scene life | **median 3.53 s**, mean 3.97 s, **max 16.87 s** (decision-sheet host, mutated) |
| Longest hold | 3.43 s between beats (111.93–115.37, streaming only); longest pixel-static content 2.67 s (112.7–115.37) |
| wpm | **204** (443 words / 130.14 s) |
| Word → visual | median **+80 ms** (57 anchors, IQR +27…+140; 89 % within ±200 ms; leads to −373 ms for theme headlines); caption word hop +7 ms |
| Captions | 133 chunks, median life 0.97 s, 4 words/chunk |
| Counter ticks | 15 + 1 count-up |

---

## 7. Prioritised gap list (R7 → our v3)

| Rank | Gap | Reference (measured) | Ours | Fix class |
|---|---|---|---|---|
| 1 | **Embedded media** (video and screenshot inside a window card, collage, pink band) | Doom video 860×659 cover, real-time playback, muted, overlay window; 4-card media collage with 300 ms stagger; screenshots on a pink band | no `<video>`/`<img>` module (only the mascot img) | new module `mediaWindow` + `pinkBand` + asset intake (rights) |
| 2 | **Decision-sheet host + target form + token fly** | radio questions, focus tint, scan fill, % slam + prob bars, row outline, 3 chips flying 525 px into `your_app`, status → green | `panel`/`slot` approximations only | new modules `decisionSheet`, `targetForm`, op `fly` |
| 3 | **LB profile chrome and plate** | #F1F1EA + 40 px dots, crop-mark viewfinder, brand HUD with a ticking/punching counter + chapter title, 3-state tab chips, hard-shadow r 0 window cards with black/blue bars | LC plate, kicker + counter, soft r 16 windows | new profile `LB` (theme tokens + `lbHeader` + window skin + `tabChips`) |
| 4 | **Highlighter caption skin** | white chip, no border, 56 px, yellow #FDE587 box behind the active word (1 f hops, +7 ms), 0.95→1.007→1.0 pop, 4 words | LC paper, active word as blue text, 3 words | new caption skin (box layer) |
| 5 | **Generation-vs-decision storytelling ops** | streaming writer (blue) + highlighter marks + uncertain fields; terminal typing 51 cps + cursor blink; stamp slam 2.5×→1 + strike; race bar (linear) and cost-bar shrink; keyword recolour headlines; push-out exit | partial (`code` typing, `stamp`, `bars`, `headline`) | new ops (`stream`, `mark`, `race`, `shrink`, `recolour`, `pushOut`) + re-skins |
| 6 | Mascot behaviour | full-body presenter 225×801 at (0,562.5), slides (367 ms in / 200 ms out), puppet mouth + gaze, finale 1.29× | SpongeBob placeholder, static | asset (original character; **do not copy Rick**) + ops |
| 7 | Entrance recipe | opaque pop + 25–34 px drift, 7–10 f ease-out | fade + 4.5 px rise | tuning |
| 8 | Counter as a story device | a running decision tally, +3 per answered sheet, count-up crescendo at the end | LC scene counter | storyboard rule + `countUp` |
| 9 | Grid-of-cards templates | 2×2 tools, 2×5 docs with score rings, 3×2 app cards, 3×4 project cards | `chips` grid (cells) | new modules (`toolTiles`, `docGrid`, `appGrid`) |
| 10 | Vendor logos / brand lockups | OpenAI, Claude, Gemini, TypeSafe, GitHub glyphs | lucide icons | asset review (trademark) |

Rights note: the presenter is a copyrighted TV character, and the media (Doom footage, third-party screenshots and logos) belong to their owners. Copy the **mechanics**, not the assets.
