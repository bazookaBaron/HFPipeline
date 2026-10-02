# Runtime Reels: Reference Study (3 IG reels, 720x1280, 30 fps)

Purpose: future authors of bespoke HyperFrames/GSAP reels read this **instead of** re-watching the references.
All three reels come from **one creator and one design system**: same cartoon presenter, same caption grammar, same SFX kit, all mastered to **-14.1 LUFS** with LRA 1.1–1.3 LU (heavily compressed).

| ID | File | Dur | Topic | Theme(s) |
|---|---|---|---|---|
| A | igexport-Dd6LueuoU0I.mp4 | 31.5 s | "GPT Sol 6.1 can hack Higgsfield credits" (promo) | cream paper → dark neon → white "lime+magenta" (3 theme swaps) |
| B | igexport-Dd4LrTSsx0i.mp4 | 46.0 s | "4 Claude Code plugins before vibe coding" (listicle) | cream paper only, **zero hard cuts** |
| C | igexport-Dd1zthnR9dk.mp4 | 52.1 s | "UGC with an AI creator via Claude Code + Higgsfield API" (story → promo) | cream paper → dark neon → white lime/magenta → dark → white |

Contact sheets (6 fps, 6x5, timestamps burned in): `sheets/reelA-Dd6LueuoU0I_00-05s.jpg`, `sheets/reelB-Dd4LrTSsx0i_05-10s.jpg`, `sheets/reelC-Dd1zthnR9dk_15-20s.jpg`.
Raw measurements (per-second JSON, transcripts) live only in the session scratchpad and were not kept. Every number this doc needs is copied below.

---

## 1. Measured numbers

| Metric | A | B | C | Method |
|---|---|---|---|---|
| Words/s (speech span) | 3.68 | 3.53 | 3.73 | Gemini transcript |
| Syllables/s | 4.6 | 5.1 | 4.75 | heuristic count |
| Mean sentence length (words) | 11.6 (max 21) | 20.0 (max 35, list sentences) | 12.1 (max 27) | |
| Hard cuts, ffmpeg-style scene > 0.35 | 3 (5.0, 16.1, 21.5 s) | **0** | 4 (33.5, 37.9, 47.6 s) | RGB mean abs diff/255 |
| Scene > 0.2 | 4 (+2.7 s halftone) | 0 | 4 | |
| Frames with **any** motion (>0.2% px changed) | 98.4% | 99.1% | 98.5% | 180x320 gray, diff > 12 |
| Longest fully static run | 3 frames (0.10 s) | 3 frames | 5 frames (0.17 s) | |
| Content zone (22–62% height) moving | 85.5% of frames, max hold 0.97 s | 84.4%, max hold 0.57 s | 89.4%, max hold 0.40 s | |
| Caption zone (top 22%) moving | 65% (mean hold 0.12 s, max 0.6 s) | 49% (max 2.4 s) | 51% (max 1.4 s) | |
| Presenter zone moving | 98% | 98% | 94% | the character never freezes |
| Moving blobs per frame, median / p90 | 6 / 12 | 4 / 8 | 5 / 11 (peaks 30–40 in photo-grid moments) | connected components of diff mask |
| Mean frame-diff energy (0–255) | 4.55 | 2.78 | 3.96 | per-second range 0.5–13.6 |
| Strong percussive onsets/s (SFX + music hits) | 1.2 | 0.9 | 1.5 | HPSS percussive stem, delta 0.3 |
| High-band transient onsets/s (upper bound, includes sibilants) | 2.0 | 2.2 | 1.7 | |
| Music tempo (est.) | ~112 BPM | ~136 BPM | ~99 BPM | librosa |
| Loudness | -14.1 LUFS, LRA 1.3 | -14.1, 1.1 | -14.1, 1.3 | ebur128 |

**What these say:** there is essentially **never a still frame**. Something in the content zone moves in ~86% of frames, and the content never holds longer than about **1 s**. Hard cuts are rare (0–4 per video). They are reserved for **theme/world swaps**. All other changes happen **inside one continuous canvas**.

---

## 2. Per-video script anatomy

### A: Higgsfield credit hack (31.5 s)
- **Hook (0–4.9 s):** "Did you know that GPT's new model Soul 6.1 can hack Higgsfield in one message?" On screen at 0.0 s: a tweet-card ("GPT-6.1 Sol is live") stacked over a dark ChatGPT UI card, the presenter waving bottom-right, and the caption typing per word. By 0.33 s a red "BREAKING" tag pops; by 1.33 s a red "NEW" stamp slams in. At 2.7 s a halftone-dot dissolve swaps to the dark theme, and a "HACKED" stamp slams with an RGB glitch (3.2 s).
- **Beats:** hook/claim (0–5) → "Here's how" plus a 4-step list card (5–6) → steps 1–4 as a live UI walkthrough with a "STEP n" tag (6–12.3) → result: a credits meter rolls 0→2,000 (12.3–17.6) → value: a grid of AI video thumbnails, "$0 SPENT" receipt (17.6–22.8) → upsell: subscribe button click, "+50% BONUS" (22.8–26.5) → urgency: a calendar flips 24→30 Sept (26.5–28.3) → CTA (28.3–31).
- **Jargon handling:** none explained. The UI is the explanation, shown as the actual click path.
- **Humour:** "hack" framing, "$0 SPENT" stamp, the presenter's exaggerated gestures.
- **CTA:** "comment SOUL and I'll send you the link and the exact command." It is visualised as an IG comment list, a typed "SOL" comment, a DM reply bubble and a "COMMENT SOL" sticker.
- **Tone:** British male, fast, upbeat promo (salesy but "insider tip").

### B: Four Claude Code plugins (46.0 s)
- **Hook (0–4.2 s):** "Don't start vibe coding with Claude Code until you've installed these four plugins." On screen: a **power strip labelled "CLAUDE CODE 0/4"** whips in tilted (0.0 s) and settles, the presenter rises from the bottom (0.17 s), the header counter reads "PLUGINS 0/4", and the 4 sockets glow in sequence on "four" (3.0–3.3 s).
- **Beats:** 4 parallel items, each lasting about 7–8 s: a plug drops in on a cable → the socket lights, counter n/4 → the plugin card drops in on the cable (stat counter rolling, e.g. 21,343→116,617 installs) → 2–4 capability sub-beats, each a UI change inside the card → exit by unplug/cable pull-up. Close: all 4 cables with labels → CTA.
- **One persistent metaphor** (power strip + cables) carries the whole video. The card is always physically "plugged" to the strip.
- **Jargon handling:** a capability list is shown as UI (tool rows `execute_sql`, `apply_migration`; a deploy pipeline build→deploy→live; 19 agent nodes fanning out of one dot; a browser with DevTools). One analogy: "gives Claude **eyes**", shown as a giant eye icon, then "blindfolded", shown as a blindfold sweeping across the browser card.
- **Humour:** the blindfold gag, "crew of 19 agents" shown as a literal fan of 19 red robot heads.
- **CTA:** "comment 'coding' and I'll send you the links", shown as a comment list, a "coding" pill, and a DM with all 4 links.
- **Tone:** energetic explainer, list cadence.

### C: UGC with an AI creator (52.1 s)
- **Hook (0–6.3 s):** "Your vibe coded app is never getting users, because you're scared of showing your face on social media. And it can be fixed with one prompt that I'll give you at the end." On screen: a phone "my-app" card drops (0.17 s) and a "users 0" analytics card counts to 0 with a red ring (1.3–2.5 s). Then the **presenter pops large and centre inside a camera viewfinder with REC**, hand over his mouth and a red glow (2.8–4.7 s), and a Claude prompt card follows (4.8 s). There is an **open loop**: "one prompt I'll give you at the end".
- **Beats:** pain (0–6) → old way: the "2026" card flips to "2025", search "ugc creators", creator photo cards, "$250" tags (6–12.9) → cost: 40-photo grid, "$10,000" receipt (12.9–15.9) → insight "volume": the grid fills to ~70 tiles, zooms through to "same app, same face, 40 different first lines", 39 greyed/1 highlighted at "2.7K views" (16–23) → solution: clocks 11:48→5:58 "all forty in one night" (23–25) → dark theme: Higgsfield dashboard, API key, Claude Code terminal typing, hooks written, model calls, an AI-creator grid (25–33.3) → rule: "ONE RULE" sticker, ✓ demos / ✗ fake review (33.5–37.9) → promo: a $20M cashback counter with glitch (37.9–47.5) → CTA: "Comment KEY" (47.6–52).
- **Jargon handling:** numbers turned into props: "$250" price tags, a "$10,000 total" receipt, a counter "users 0", a ticking cashback pool, "$1 → $1 back" coin flow.
- **Humour:** the scared presenter covering his mouth, "so you don't get sued", "basically a glitch" (the screen literally glitches).
- **Tone:** same voice, more narrative ("A year ago…", "So I made…").

---

## 3. Shot-by-shot, first 10 s

### A (0–10 s)
| t (s) | Event |
|---|---|
| 0.00 | Cream paper bg with dot texture; tweet card plus dark ChatGPT card already in, slightly tilted; presenter waving bottom-right; caption "Did" |
| 0.17–0.67 | Caption +1 word every ~0.17–0.3 s; "BREAKING" red tag pops on the tweet card (0.33) |
| 0.83 | Accent words "GPT's new" in italic serif orange-red (incoming word appears light/blurred, then resolves) |
| 1.17 | Tweet card glitch-shakes (RGB split) |
| 1.33 | "NEW" round red stamp slams in, oversized → settles (~5 f) |
| 1.83 | Caption clears; new line "Sol" in accent; presenter changes pose (both hands) |
| 2.17 | Red hand-drawn circle draws around the "GPT-6.1 Sol" pill; peach sticky note "one message → free credits" pops in with a scribble arrow |
| 2.67–3.0 | **Transition:** halftone dot matrix grows over the frame → black with dot grid (~10 f) |
| 3.17 | Dark theme with lime glow; "can **hack**" (lime accent); Higgsfield card glitches in |
| 3.20–3.37 | "HACKED" pink neon stamp slams from ~1.3× to 1.0 with RGB glitch (6 f) |
| 3.3 | Persistent "HIGGSFIELD CREDITS 0" widget slides in above the presenter (stays for the rest of the video) |
| 4.17 | Pill "@higgsfield /reset-credits" rises in; HACKED card shrinks up |
| 4.33 | Lime "1 MESSAGE" tilted label pops with a glow burst |
| 4.83 | Content collapses to a horizontal line (squash-out, ~3 f) |
| 5.00 | **Hard cut** via grey blur wipe → white theme, lime top-left / magenta bottom-right gradient blobs, crosshair grid |
| 5.17–5.5 | "4 SIMPLE STEPS" list: rows stagger in from the left with blur (~2 f apart) |
| 5.83 | List morphs into the ChatGPT window ("STEP 1" tag); "Open **ChatGPT**" |
| 6.5–7.0 | Cursor moves and clicks; dropdown opens |
| 7.17 | Step tag 1→2 with sparkle burst; plugin menu; Higgsfield row highlighted (lime outline) |
| 8.17 | Pill click: lime ring pulse |
| 8.33–8.83 | Step 3: model dropdown morphs in (blur) |
| 9.17–9.5 | "GPT-6.1 Sol" selected → check badge, expanding ring ripple |
| 9.67–9.83 | Window whips left out of frame (motion blur) |

### B (0–10 s)
| t | Event |
|---|---|
| 0.00 | Power strip "CLAUDE CODE 0/4" enters from the right, rotated ~-15°, motion-blurred; presenter's hat rises from the bottom |
| 0.17 | Strip lands with a smear/dust trail; presenter fully up (scale-in from the bottom) |
| 0.33 | Strip outline flash (selection rectangle) |
| 0.5–1.5 | Caption per word; "vibe coding" italic orange; presenter waves |
| 1.67 | Caption clears → "until"; strip micro-tilt |
| 2.83–3.33 | "four plugins." in accent; the 4 sockets light up red one by one, ~3 f apart |
| 3.5–3.67 | Camera pulls back: the strip shrinks and drops to the lower third, the presenter shrinks to small |
| 3.83 | Cable whips in from top-right |
| 4.0–4.83 | Plug swings on its cable like a pendulum (rotation decays), then descends |
| 5.33 | Plug seats: red flash ring, counter 0/4→1/4 |
| 5.5–5.83 | White card drops along the cable from the top (motion blur, ~8 f); red scanline wipe reveals the Supabase logo |
| 5.83–6.33 | Install counter odometer-rolls 21,343→60,674→92,568→107,568 |
| 6.5 | Card content morphs to a header row plus an empty cylinder outline |
| 7.0–7.33 | "database" accent; DB stack fills/assembles (3 discs stacking) |
| 7.67–8.0 | Tool rows (execute_sql…) branch out on connector lines (staggered) |
| 8.17–9.67 | Each spoken verb highlights its row (bold + red DB pulse); one row at a time |

### C (0–10 s)
| t | Event |
|---|---|
| 0.00 | Empty cream bg; caption "Your" |
| 0.17 | Phone "my-app" card drops from the top, tilted, ghosted/motion-blurred; presenter rises at the same time (blurred) |
| 0.5 | Phone settles, "vibe-coded" sticker; presenter waving |
| 1.17–1.5 | Analytics card ("users") slides in right with blur |
| 1.67–2.33 | Number scrambles → "0", red circle drawn round it, red "users," accent |
| 2.67 | Cards swipe out; presenter scales toward the camera |
| 2.83 | **Presenter big, centred**, framed by camera viewfinder brackets, red radial glow |
| 3.0–4.5 | "REC 00:00" chip; presenter covers his mouth (pose swap); "face" accent; "Post now" red pill pops at 4.0 |
| 4.67 | Viewfinder brackets spread out/exit; presenter shrinks |
| 4.83 | Claude chat card rises; blurred prompt text |
| 5.0–6.0 | Presenter big again (mid-frame) pointing up; "one prompt" accent |
| 6.17–6.5 | Send button press (ring) → "unlocks at the end" red lock pill; audio-message player row appears |
| 7.5 | Card exits; presenter pose change |
| 7.67 | "2026" calendar card drops (5 f), last digit flips to "2025" (7.73–7.8, odometer) |
| 8.33 | Card shrinks into a search bar "ugc", which types "ugc creators for my app" (8.5–9.2) |
| 9.5–9.83 | Search result cards fan out (3D tilt, stagger ~2 f): creator photo cards |

---

## 4. Coarse log for the rest (what is on screen while it is said)

**A 10–31.5 s:** a Cmd+V keycap press; the command pill scales in with a lime glow and a "COPY THIS" tag; corner brackets lock on (10–12) → send click ripple; the window turns to a "working" state, a toast "RESET YOUR BALANCE", button click ripples (12–14) → confetti pixels, "YOUR USAGE IS 100% RESET", "IT WORKED" sticker (14–14.7) → the credits widget zooms to centre, glitches, odometer 0→1,290→1,866 (15–16) → **cut to dark**, "2,000" big neon digits with a radar ring and pixel debris, a "RESET FOR FREE" sticker, a hand-drawn circle (16–17.5) → a pixel burst into a tilted 3D wall of ~20 video thumbnails with parallax (17.6–20) → Seedance/Kling logo chips → a receipt card prints in, total struck through, "$0.00", "$0 SPENT" stamp (20.5–21.3) → **blur cut to white**; Subscribe card, cursor click, "Subscribed ✓" morph, the card collapses into a coin (21.7–23.8) → "2,000" lime block, a "BONUS" pink block drops onto it, "UP TO +50% MORE CREDITS" tilted labels (24–26) → calendar 24→25→…→30 flipping in 3D, "30" lime with a hand-drawn ellipse, "ENDS SEP 30 23:59 UTC" tag (26.2–28) → IG comments sheet, "SOL" typed and highlighted, DM bubble, "COMMENT SOL" sticker bottom-left (28.2–31.5).

**B 10–46 s:** rows keep highlighting; "security advisors" → the dashboard card flips to a dark one and a red ✕ wipes across it ("without ever opening the dashboard") (10–14) → the plug is pulled up, a new cable comes in (14–15) → Vercel: a dark card drops, odometer 19,883→227,666, a terminal types "deploy my app", the pipeline build→deploy→live animates with a travelling dot, URL row, "preview"/"production" pills (15–21) → oh-my-claudecode: GitHub-style card, a pixel robot, 19 red agent heads fan out on lines from one point, a "/team" pill, the fan regroups into 4 quadrants plan/build/verify/fix with a dot travelling the loop (21.5–29.6) → Chrome DevTools MCP: browser card, an eye icon, console errors row turns red, network rows, screenshots, performance; the eye gets blindfolded (29.6–42) → zoom out to all 4 cables with label chips (42–43.3) → the comment sheet drops on the cables; "coding" pill; DM with 4 links (43.3–46).

**C 10–52 s:** creator cards get price tags (10–12) → a 40-photo grid assembles tile by tile, "40 videos" counter (12.5–14) → a "$10,000" receipt (14.5–16) → the grid regrows to ~70 tiles, then a **zoom-through** into the grid (18.3) → full-bleed 9:16 creator clips with speech-bubble hooks (18.3–21) → the grid greys out, 1 tile glows "2.7K views" (21–23) → clock cards 11:48→12:58→5:58 with a laptop (23.5–25) → dot-matrix transition to dark; Higgsfield dashboard, cursor clicks "Create API key", key reveal, terminal `export HIGGSFIELD_API_KEY`, prompt typed, "Write(hooks.json)" lines stream, model chips Seedance/Kling, an AI-creator grid with the same face (25–33.3) → **hard cut** white: "ONE RULE" black tilted sticker, phone video with a ✓ "DEMOS THE APP" lime tag, a fake review card with a red ✕ "NEVER A FAKE CUSTOMER" (33.5–37.8) → **glitch cut** dark: cashback page, odometer counters $8.9M…$27M, "$20M" with a hand-drawn circle, "100% CASHBACK" marquee strip scrolling, $1→coin→$1 flow, countdown 3d 10h 22m, "ENDS SEP 30" tag (37.9–47.5) → **glitch cut** white: the presenter centred large, the comment sheet rises, "KEY" comments flood in, DM card, final "Higgsfield API / COMMENT KEY" sticker (47.6–52).

---

## 5. Motion census (shared grammar)

| Dimension | Observation |
|---|---|
| Distinct visual events/s | **~2.5–3.5 non-caption events/s** (enter, exit, morph, counter tick, highlight, cursor click, sticker). Plus **~3.6 caption word reveals/s**, so the total is **~6–7 events/s** |
| Static hold | Content never holds more than ~1.0 s (median ~0.1 s). Even "holds" carry a micro-event: a row highlight, counter tick, cursor drift, pulse ring |
| Simultaneous movers | Typically 3–6: caption word + presenter + main card internals + 1 secondary (tag/sticker/cursor). Peaks of 20–40 in grid/burst moments |
| Camera | No constant Ken-Burns drift. Camera moves are **events**: pull-back to re-stage (B 3.5 s), push to centre an object (A credits widget 15 s), **zoom-through** into a grid (C 18.3 s), whip-out of a card (A 9.8 s). Fake 3D tilt on card entrances and on thumbnail walls |
| Transitions between ideas | (1) **In-place morph**: card A becomes card B (list→window, search bar→results, card→coin), 4–8 f. (2) **Drop/whip** in with motion blur, 4–8 f. (3) **Theme swap** (hard cut dressed as an FX): halftone-dot dissolve ~10 f, RGB/pixel glitch 3–6 f, grey blur wipe ~4 f, squash-to-line 3 f. Theme swaps happen 0–4×/video at section changes |
| Easing | Snappy: entrances 4–8 frames (0.13–0.27 s), expo/power4.out with small back overshoot (~5–10%); slams start oversized (1.3–1.4×) and settle in ~6 f; drops carry directional motion blur and a slight rotate that straightens on landing; plug-on-cable has pendulum damping. Exits are faster (2–4 f), mostly blur + slide or scale-to-0 |
| Text animation | Per-word caption reveal **synced to the voice** (word appears at speech onset): the new word fades from a light-grey/blurred state to ink in ~3 f. Accent words get a colour (and font in light themes). The caption block **clears and restarts** at phrase boundaries (every 1.5–3 s) instead of scrolling. In-card text: typing (terminal, search, prompt), odometer/scramble numbers, strike-throughs, hand-drawn circles/ellipses drawn on (~6 f) |
| Captions style/position | Top-left block, left x = 88 px (12% margin), top ≈ y 160–180, max width ≈ 545 px, 1–3 lines, ~52–56 px font (line pitch ~62 px ≈ 4.8% of H), dark ink on light / white on dark. No pill/box behind. It is the **only** text the viewer reads as "captions" |
| Header chrome | Tiny mono row at y ≈ 90: left "// 05 — reset" (section index + slug), right a **live state counter** ("PLUGINS 2/4", "CREDITS LIMIT/2,000", "SPENT $10,000", "COMMENTS 1,284") that updates with the story |
| Palette | Light: bg `#F4F2EE`/`#F6F4EE` cream with fine dot-grid texture; ink `#141414`; accent orange-red `#EA4B2A`–`#FF481A`. White theme: `#F5F5F7` bg, radial blobs lime `#D9ED24` top-left + magenta `#FC2F6A` bottom-right, faint grid + crosshair marks. Dark: `#131215` bg, lime `#D3E71A` glow accent, magenta/pink `#FE2763` for alerts/stamps |
| Typography | Caption: geometric/grotesk sans, medium–bold (Space Grotesk / Inter Tight feel). Light-theme accent: **italic serif** (Instrument Serif-like) in orange. Lime/magenta themes: accent = same sans, bold, coloured. Mono (JetBrains/Space Mono-like) for chrome, terminals, tags. Stickers: heavy condensed italic caps ("HACKED", "ONE RULE", "$0 SPENT") |
| Backgrounds | Never flat: dot-grid/halftone paper, gradient blobs, neon glows, faint grid lines, halftone drop-shadows under cards |
| Illustration style | Recreated **flat UI mockups** (ChatGPT, Claude, Vercel, terminal, browser + DevTools, IG comments, receipts, calendars, dashboards) built in vector/HTML with slight 3D tilt and soft shadows; flat physical props (power strip, plug, cables, coin, keycap); stickers/tags; hand-drawn scribbles (circles, arrows); pixel debris/confetti; real photos only for "people" content (UGC creator thumbnails, AI video stills) |
| Presenter/mascot | The same 2D cartoon man (beanie with a red badge, round glasses, beard, tan blazer). Default: bottom-right, ~40% of the width, cropped at the chest, ~25–30% of H. **Always moving**: pose swaps every 1–2 s (wave, point up, point at content, thumbs-up, shrug, hand over mouth, both arms), entrance rise from the bottom, scale changes (small 20% ↔ big centred 70% for emotional beats), occasional ghost/onion-skin frames. Acts as a pointer to the content |
| Sound | Continuous upbeat electronic bed (~100–136 BPM) under the voice; the voice is dominant and the master is limited flat (LRA ≈ 1.2 LU, so ducking is effectively constant: the bed sits ~15–20 dB under the voice). SFX: whoosh on drops/swaps, pop on stickers, click on cursor/button, tick on counters, glitch burst on theme swaps; ≈ **1–1.5 audible SFX/s**, ~1 per visual event of note |

---

## 6. Cross-video synthesis

### Common grammar
1. **One world per section, not one card per sentence.** A persistent anchor stays on screen (B's power strip, A/C's credits/counter widget, the presenter, the header counter), and new content attaches to it.
2. **Word-synced caption at the top, visuals do the explaining** in the middle band, presenter in the bottom-right.
3. **Every spoken noun gets a visual verb** inside ~0.2 s: a number rolls, a row lights, a sticker slams, a circle gets drawn, a cursor clicks.
4. **Cards morph into the next card** instead of exit→enter. Hard cuts only for theme/world swaps, always dressed with an FX (halftone, glitch, blur).
5. **Stateful storytelling:** counters (0/4 → 4/4, 0 → 2,000 credits, $0 SPENT, 3d 10h 22m) visibly change as the narrative progresses.
6. **Promo endings:** "Comment WORD and I'll send you X", visualised as a comment sheet, the typed word, a DM reply and a "COMMENT WORD" sticker.

### Quantitative targets for authored reels
| Target | Value |
|---|---|
| Speech rate | 3.5–3.8 words/s (~4.6–5.1 syll/s); sentences ~12 words (lists up to 20+) |
| Non-caption visual events | **≥ 2.5/s** (aim for 3); a caption word reveal for every spoken word on top |
| Max static hold (content zone) | **≤ 1.0 s**, typical ≤ 0.3 s; never a fully frozen frame (≤ 0.17 s) |
| Simultaneous movers | 3–6 typical; ≥ 1 burst moment per 10 s with 15+ elements |
| Hard cuts | 0–1 per 10 s, only at section/theme changes, dressed with an FX of 3–10 f |
| Entrance duration | 4–8 frames; exit 2–4 frames; slams 6 frames from 1.3×→1.0 |
| Presenter pose change | every 1–2 s; a scale/position change at least every ~10 s |
| SFX | ~1–1.5/s, tied to visual events; bed continuous; master −14 LUFS |
| Hook | Claim plus visual payoff inside 3 s; first theme/FX hit by ~3 s |
| CTA | last 3–5 s, comment-keyword mechanic visualised |

### Why these feel "very motiony" compared with a static-card template
- Template: a card enters, then **holds 2–4 s** until the next card. Reference: the card enters, then **its internals keep performing**: rows highlight per spoken verb, counters roll, cursor clicks, stickers land on it, then it **morphs** into the next card.
- Each event is **driven by a specific word** (timestamped), not by the scene start.
- **Directional energy**: drops from the top, whips, pendulum plugs, motion blur and tilt, so things arrive with momentum and settle.
- **Layering**: caption, presenter, main card and secondary tag all animate on independent clocks, so some layer is always moving.
- **Persistent props and state** make it feel like one continuous machine rather than slides.
- **Texture and glow** (dot grids, halftone shadows, neon bloom, debris particles) add perceived motion and richness even in small moves.

### Per-scene GSAP authoring checklist
1. List every content word in the scene's transcript span with its timestamp. Assign **one visual verb per 0.3–0.4 s** (counter, highlight, sticker, circle, cursor, morph, type).
2. Caption: per-word reveal at word start (`opacity .25→1`, `filter blur(4px)→0`, `y 6→0`, 0.1 s); accent 1–2 key words per line (italic serif orange on cream, bold lime/magenta on white/dark); clear the block at phrase ends.
3. Entrance: 4–8 f, `power4.out`/`back.out(1.4)`, from offscreen or from above with `rotation ±8–15°` → 0 and a motion-blur proxy (blur or skew). Slams: `scale 1.35→1` in 6 f plus a 2–3 f RGB split.
4. Never let the content zone sit still more than 1 s; add a micro-event (row pulse, number tick, cursor nudge, ring ripple, glow breathe tied to a word).
5. Morph the outgoing card into the incoming one (shared position/size, crossfade internals) rather than exit+enter, unless it is a section break.
6. Section break = theme swap plus FX transition (halftone grid 10 f, pixel glitch 4 f, blur wipe 4 f, squash-to-line 3 f) plus a whoosh/glitch SFX.
7. Keep 1 persistent anchor (prop/counter widget/header counter) and update its state on screen.
8. Presenter: swap pose on emphasis words, point at the active element, one "big centre" moment per emotional beat.
9. One "burst" per ~10 s: grid fill, confetti/pixel debris, fan-out of N nodes, thumbnail wall.
10. Layer SFX: whoosh (drop/swap), pop (sticker/tag), click (cursor/button), tick (counter), glitch (theme swap): ≈1–1.5/s.
11. Textured bg (dot grid or gradient blobs plus a crosshair grid), halftone shadows under cards, mono header chrome with section index and a live counter.

---

## 7. Assets needed and how they appear to be made

| Element | Seen in | Likely production | Runtime approach |
|---|---|---|---|
| Presenter character (many poses) | all | 2D vector cartoon, pose library (PNG/SVG cutouts, swapped and tweened) | pre-made pose sprite set (wave, point-up, point-side, thumbs-up, shrug, mouth-cover, arms-open) |
| Product logos (ChatGPT, Higgsfield, Supabase, Vercel, Chrome, Seedance, Kling, Claude) | all | vector logos | SVG logo fetch (simple-icons etc.) |
| App UI mockups (chat window, terminal, browser + DevTools, dashboards, IG comments/DM, search bar, receipt, calendar, pricing cards) | all | **rebuilt in vector/HTML**, not screen recordings (crisp, simplified, brand-coloured) | HTML/CSS components inside the composition |
| Physical props (power strip, plug, cable, keycap, coin, clock, phone frame, eye, blindfold) | B, A, C | flat vector illustration | inline SVG |
| Stickers/stamps/tags ("HACKED", "NEW", "BREAKING", "ONE RULE", "$0 SPENT", "COMMENT SOL") | all | vector text with skew and glow | HTML text plus CSS |
| Hand-drawn circles, arrows, scribbles | A, C | SVG paths drawn on | SVG stroke-dashoffset |
| People photos (UGC creators, AI-generated creator, video thumbnail wall) | A, C | real/AI stills and video frames | AI-generated stills or fal images; never real identifiable faces |
| Pixel debris, halftone dot transitions, glitch slices | A, C | procedural | canvas/CSS generated |
| Agent robot icons (19 heads), DB cylinder, pipeline nodes | B | flat vector icons | inline SVG |
| Music bed and SFX kit | all | library electronic track; UI SFX pack | free music lib plus SFX set |
