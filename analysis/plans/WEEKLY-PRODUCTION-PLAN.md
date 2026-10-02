# Weekly production plan: 2 long-form (8 min) + 4 reels + 3 carousels, on Claude Pro

Status: PLAN. Written 2026-10-02.

## 1. Measured budget (from the plan meter, not guessed)

- **This week so far:** reference study, v1, 3 character builds, v2 and the endcard together used **14% of the weekly limit**.
- **The 5-hour window is the real constraint:** finishing v2 used 93% of one window, while the weekly meter moved only about 1%. So a full 5-hour window is roughly **5–7% of a week**, and a week holds about **15–18 full windows**.

| Item | Est. windows | Est. % of week | Notes |
|---|---|---|---|
| Reel (45–50 s), lean | 0.5–0.8 | 3–5% | after the component library and a fresh session |
| Long-form, 8 min | 2–3 | 12–18% | slower motion (about 1 event/s against 3 for reels), images and maps reused |
| Carousel (8–10 slides) | 0.2–0.3 | 1–2% | repurposed from a reel or long-form script, so no new research |
| Fixes and re-renders buffer | 1–2 | 8–10% | |
| **Week: 2 LF + 4 reels + 3 carousels** | **≈ 8–10** | **≈ 50–65%** | **Feasible**, with headroom |

**One-time setup (this week):** about 3–4 windows (≈ 20–25%). This week is therefore setup plus a reduced schedule; the full schedule starts next week.

**Money (not tokens):**
- fal: about $0.5–1 per long-form (photoreal stills) and about $0.03 per carousel cover.
- Voice: local F5, $0.
- Music: free library.
- No Gemini for research or scripts.

## 2. One-time builds (Sonnet subagents; Opus only to review)

| # | Build | Purpose |
|---|---|---|
| S1 | **Component library** `runtime/components/`, poster style, motion built in | Chat window, browser frame plus capture, receipt, step rail, stat counter, sticker, doodles, card stack, ranking list, checklist, code card, quote card, timeline, comparison, image frame (with credit), video wall. Each comes in a 9:16 and a 16:9 layout. Cuts a reel file from 63 KB to about 10–15 KB. |
| S2 | **Maps in poster style** | Port the Natural Earth (India-POV) map module to flat fills, black outlines and hard shadow offsets. Animated: routes with travelling dots, country lift, pulsing city rings, choropleth fills. |
| S3 | **Long-form 16:9 frame** | Centre stage, the character bottom-left or bottom-right at a smaller scale, chapter cards, a lower-third style for captions (or no burned captions; upload an SRT instead), and a calmer motion profile: holds of 1.5–3 s allowed, while the content keeps micro-motion. |
| S4 | **Image pipeline reuse** | The existing licensed-media resolver (Commons/Wikidata/NASA/Openverse, licence-checked, credited) plus fal photoreal fallback, shown inside poster frames (outline plus hard shadow). Image vetting needs a decision: Gemini-lite vision costs cents, or Claude vision costs tokens (see §5). |
| S5 | **Carousel generator** | 1080x1350 slides as HTML, then PNGs via a headless screenshot. Same theme and character; cover, 6–8 content slides and a CTA slide (follow plus vloombox). |
| S6 | **Project skill** `.claude/skills/make-video/SKILL.md` | Step-by-step workflow, rules (token discipline, fast motion, no overlap, endcard on reels, theme rotation) and commands. Fresh sessions load it instead of this long history. |
| S7 | **Batch audio tools** | `runtime/voice.py`, `mix.py` and `measure.py` as generic CLIs (no per-reel copies). |

## 3. Per-item workflow (one fresh session per item)

**Reel (≈ 0.5–0.8 window):**
1. Research, 3–6 searches (Opus).
2. Script, 160–170 words (Opus).
3. Voice (local).
4. Brief, about 1 page (Opus).
5. Sonnet builder: library components plus choreography, snapshot check, ONE full render, metrics, mix.
6. I review one contact sheet.
7. Endcard is appended automatically.

**Long-form, 8 min (≈ 2–3 windows):**
1. Research, 15–20 searches. Write facts.json, cached.
2. Script, about 1,150 words, 5–6 chapters, relaxed delivery. Voice at about 145–150 wpm.
3. Brief per chapter.
4. Sonnet chapter builders, 2–3 in parallel. Each renders its own chapter once.
5. Stitch, music changes per chapter (existing musicPlan), master to −14 LUFS.
6. Thumbnails (existing v2 thumbnailer, restyled to poster).
7. Description with chapters and credits.

**Carousel (≈ 0.2–0.3 window):** the slide copy comes from an existing script, a Sonnet builder makes the slides, then a PNG export.

**Suggested week (spreading 5-hour windows):**

| Day | Work |
|---|---|
| Mon | LF #1 (2 windows) |
| Tue | Reel + carousel |
| Wed | Reel |
| Thu | LF #2 (2 windows) |
| Fri | Reel + carousel |
| Sat | Reel + carousel |
| Sun | Buffer |

## 4. Token rules (enforced in the skill)

- A fresh session for every item. Never continue in a long chat (this session is about 490k tokens of context, and every message re-reads it).
- Opus does only research, script, brief and the final review. Sonnet does all building, checks and renders.
- Never re-watch references; read REFERENCE-STUDY.md sections on demand.
- Components over hand-written markup. No full-file re-reads; targeted edits only.
- Use snapshot checks before ONE full render; at most 1 fix render.
- Look at one contact sheet per item. Logs are tail-only.
- Research cached per topic; carousels reuse scripts.

## 5. Decisions needed from the user

1. **Image vetting for long-form:** Gemini-lite vision (~$0.05 per video, no Claude tokens), or Claude vision (no $, but tokens).
2. **Long-form captions:** burned-in captions (lower third) or an uploaded SRT only.
3. **Carousel sources:** reuse that week's reel/LF topics (cheapest), or separate topics (adds research).
4. **Upbeat electronic music:** download 3–5 tracks to music-lib, since the current library has none.
