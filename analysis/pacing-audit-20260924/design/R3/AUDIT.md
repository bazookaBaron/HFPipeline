# R3 (DdSc-I9IqNC) — design & motion audit (git worktrees, LIGHT theme)

**Source reality:** file is 720x1280 @30 fps, h264 yuv420p, video ≈208 kbps, AAC ≈53 kbps, 134.53 s, 4036 frames.
All pixel values were measured on 720p frames with PIL and **scaled ×1.5 to 1080x1920** (the value we should build at).
Where the raw 720p value matters it is given in brackets, e.g. `27 px [18]`. Colours are sampled from decoded frames
(208 kbps h264 → ±3 per channel noise on flats; thin strokes are chroma-blurred, so their hexes are the darkest/most
saturated core pixel, marked "core"). ms at 30 fps = 33.3 ms/frame.
Scratch files: `design/R3/f_*.png` (full-res frames), `design/R3/*strip*.jpg` (30 fps strips), `zoom_*.png`, `measure_*.py`.

**Corrections to the evidence log (verified on frames):** (1) S27 commit hashes read `a41c7e2 / b7e802a / d63f911` (log had 07a931/d69ff1). (2) Agent cursors in S25 do **not** wander continuously: each glides once (~0.65 s) onto the same token and all three are static from 98.0 s. (3) Line draws are **ease-in-out**, not linear (S03 main line, S31 arrow). (4) Mascot mouth has **no measurable visemes**. (5) Caption is a rounded **rectangle** (r≈10 px), not a pill. (6) Folder cards enter on a **diagonal** (from up-left), not a vertical fade.

## 0. Global frame spec (LIGHT theme) — px @1080x1920

| zone | x | y (top→bottom) | notes / evidence |
|---|---|---|---|
| empty top | – | 0–230 (12%) | nothing ever drawn |
| header label `GIT / WORKTREES` | 73 → | cap 231–252 | mono caps, tracked; f_1.41 bbox 49,154–197,168 [720] |
| scene counter `NN — 32` | ← 1004 (right-aligned) | cap 234–249 | mono; steps on every cut (1 frame) |
| hairline rule | 72–1007 | 279 (1.5 px) | #c9c9c2 core + #e5e5de AA row |
| title | 75 → (max 954 seen) | cap-top 320, baseline 369 | 1 line always; hard-swap at cut |
| subtitle | 75 → | cap 465–485 | mono caps, one line |
| optional mono aside (`❯ git switch main`, S09) | 330 | ~543 | 22 px mono grey |
| diagram column | **330–999** (cards, w 670) / **300–999** (windows, w 699) | 527 → ≤1340 | right margin 81 px; left edge of cards 330 |
| annotation (divider + line) | divider 324–995; text x 326 | divider 1221–1270; text cap 15 px below +35 | ends most scenes |
| mascot | 75–236 (w 161 = 14.9%) | 780–1340 (h 560 = 29.2%) | f_1.41/35.90/97.50/111.20 identical bbox |
| caption box | centred x=540, w auto 160–860 (median 551) | 1420–1510 (h 90); centre 1465 = 76.3% | 4036-frame track: centre x 358–361 [720] |
| empty bottom | – | 1510–1920 (21%) | nothing ever drawn |

Safe-area rule R3 obeys: all motion lives in y 527–1510; x 75–1007 (≈7% side margins). Mascot column 75–236, gutter 94 px, content column 330–999.

## 1. Checklist A–I (measured) with our-v2 comparison

Fix class: **T** tuning (token/param change) · **M** new module · **C** new capability (engine/runtime) · **A** asset.

### A. Frame architecture & layout
| # | R3 measured | our v2 | gap | fix |
|---|---|---|---|---|
| 1 Safe zones | Top 0–230 empty (12%), bottom 1510–1920 empty (21%); side margins 72–75 px L, 73–81 px R. All change inside y 527–1510 (row-change profile bands 2–10 only). | HUD at 214, content 484–1343, caption to 1542; ~380 px empty at bottom | Similar vertical budget. R3 keeps top 230 px fully empty and uses 231–485 for header + title + subtitle instead of a HUD bar | T |
| 2 Grid/columns | 2 columns: mascot 75–236, gutter 94, content 330–999 (windows extend left to 300). Header/title/subtitle share left axis x≈73–75 and span to 1007. Caption centred on x=540, independent of the columns. | mascot 17–274, content 327–1010 | Our mascot column is 257 px wide (vs 161); content start matches (327 vs 330) | T |
| 3 Content bbox per scaffold | T-scaffold (S30): 285–999 × 527–1340 (≈62% W × 42% H). Stacked (S24): 330–999 × 550–1287. Window+card (S06): 300–999 × 536–1150. Vertical 2-card (S31): 330–999 × 536–1205. Diagram centre of mass y≈900–960 (47–50%), level with the mascot torso (mascot centre y 1060). | 327–1010 × 484–1343 | Similar box, but ours is one dense panel; R3 uses 2–4 separate modules with air between them | T |
| 4 Layout templates | 6 templates: T repo + bracket + stacked folder cards (6 scenes), V vertical 2-card + connector (2), W window (terminal / VS Code / Claude Code, 9), S stacked cards/strips (10), G git/merge graph (2), O object-chip grid (1). Geometry in §3. | one "two env cards + top bar" scaffold | We have 1 template; R3 cycles 6 | M |
| 5 Hierarchy | 1) title 70 px bold (cap 49), 2) module names 27–31 px bold, 3) caption 52 px extra-bold (read continuously), 4) mono meta 22–24 px grey, 5) header/subtitle 22–27 px mono grey. Title : card-name : meta ≈ 2.6 : 1 : 0.85. Red accent only on the one thing that matters in the scene (repo card, current caption word, closing annotation). | caption 60 px dominates; card headers ~40 px; big numbers 64 px | No per-scene headline; our caption outranks everything | M+T |
| 6 Spacing rhythm | Folder-card pitch 210 (159 tall + 51 gap) in T/S. Card→strip gap 51. S24 terminal pitch 260 (45 gap). Annotation divider 50–60 px under the last module; text cap 35 px under the divider. Card padding 30 L / 32 top / 29 R; window body padding 30. Consistent to ±3 px across S01/S05/S11/S30. | rows ~170 px apart inside the panel | Adopt the 51 px module gap and 30 px padding tokens | T |

### B. Persistent chrome
| # | R3 measured | our v2 | gap | fix |
|---|---|---|---|---|
| 7 HUD | No box. Left `GIT / WORKTREES`, mono caps ≈22 px, tracking ≈+0.06 em, #61615a. Right `NN — 32` counter, same style, #64645d. 1.5 px rule #c9c9c2 at y 279 across 72–1007. Counter changes on the cut frame (header region diff 18.5 on exactly one frame, 36.933). Never animates. | dark bar 38–1047 × 200–289 with LIVE + OK pill | Replace the bar with breadcrumb + counter + hairline (light) | M |
| 8 Step indicators | The counter is the step indicator (01→32, one per scene). Title (70 px) + subtitle (27 px mono caps) act as the per-scene label; both hard-swap on the cut frame. No progress bar, no footer. | none | Missing per-scene title/subtitle and counter | M |
| 9 Mascot | Rick-style full-body cartoon with laptop, x 75–236, y 780–1340 (29% H), facing camera. Pixel-identical position on every frame (0 px shift in 30-frame tracking). States: eyes open (≈72%), eyes look-up (pupil −4 px @720, ≈27% of frames), blink = eyes-closed drawing for **200 ms (6 f)** every **4.65 s** median (IQR 3.9–5.15 s; 31 blinks; two long closes of 400/500 ms at 73.87 and 100.47). Mouth always open, no measurable visemes (dark-red mouth px 46–66 p10–p90; frame diff below codec noise). No scale punches, entrances, exits; never hidden; never overlaps content (94 px gutter). | SpongeBob x 17–274, y 942–1304, w 24% | Ours is 60% wider and sits lower (centre 1123 vs 1060). Blink cadence is worth adopting; R3 has no mouth flaps at all | T (+A for a light-theme mascot) |
| 10 Captions | Rounded rect (r≈10), fill #fefcf8, 1.5 px border #d2d2cb, soft shadow 0 6 24 rgba(0,0,0,.07), h 90, auto width 160–860, padding-x 30, centred x 540, y 1420–1510. Text ≈52 px, weight 800, Inter-like, 1 line only. Karaoke: spoken #171c1e, current #b03f2f, upcoming #585c54. 129 chunks: words/chunk median 4 (3–5 words = 75%); duration median 1.03 s (IQR 0.78–1.23). Chunk onset = first-word onset (median 0 ms, IQR −67…+60). Word flip median ≈+70 ms after the ASR onset (range −90…+150). Swap takes 1 frame (≤33 ms), no motion. Box never disappears in pauses. | top 77%, 60 px w800, #07090c fill, 3 px light border, 8 px hard offset accent shadow | Needs a light skin, a soft shadow instead of the hard one, 52 px text and 3 colour states; always on | T |

### C. Visual design system
| # | R3 measured | our v2 | gap | fix |
|---|---|---|---|---|
| 11 Palette | See §2 token table. Bg #f3f3ec flat (corner lum 241.7 constant). Surfaces: card #fefcf8, repo card #f8faf5, window titlebar #e9ebe4, CC header #ebe7db, prompt band #eeede2, status bar #ebf0ea. Ink #161d22, meta #5f605d, muted #6e6e67. Accent red #d14726 (strokes), #d54729 (fills), caption red #b03f2f. Entity hues: main blue #3361b0, auth purple #714faf, billing green #157d5f, dashboard amber #855412. States: ok strip #e3ede4 / #244e3a, danger #fae7e3 / #762b32. 3–5 hues on screen at once, but saturated pixels are only 0.4% of the frame (median). | dark #08090c–#0c1218, saturated blue/green | No light theme; our saturated area is far larger | T (theme tokens) |
| 12 Typography | Title: bold geometric grotesk with a u-shaped `y` (Space Grotesk-like), 70 px/700, cap 49, tracking ≈−0.02 em, #161d22. Caption: 52 px/800 neo-grotesk (Inter-like). Mono (JetBrains Mono-like: x-height 0.55, advance 0.6 em): card names 27 px bold, meta 24 px, terminal command 27 px, paths/output 22 px, code 22 px (line pitch 43.5), pills 19 px bold, header 22 px tracked caps, subtitle 27 px caps. Annotation: title family ≈31 px medium, coloured. Display shout (S07): condensed grotesk ≈56 px/800, tracking ≈−0.04 em, caps. Text per frame: title 2–5 words + subtitle 2–7 words + 2–4 modules of ≤6 words + a 4-word caption. | Inter-ish sans + mono; 60 px caption | Needs a 3-family stack (display grotesk, UI sans, mono) and a per-scene title | T+A (fonts) |
| 13 Card anatomy | Folder card 670×159, r 16, 1.5 px entity-tinted border, fill #fefcf8, shadow 0 6 24 rgba(0,0,0,.07). Row 1: outline folder icon 51×40 (3 px stroke, entity colour) at x+30, name mono-bold 27 px at x+102, pill right-aligned 29 px inset. Row 2: meta mono 24 px grey at x+102. Repo card 670×126, 3 px red border, red-tinted tight shadow (0 10 8 rgba(209,71,38,.10)), git diamond 69 px, `ONE REPOSITORY` 31 px bold caps red, `app/.git` mono 23 px, III bars on the right. Windows: see §3 (traffic lights, 65 px title bar, 58 px status bar). No glows, no gradients. | dark cards r≈16 with a 4 px coloured top border | New light card skin plus folder-card, repo-card and window modules | M |
| 14 Pills | Branch pill: h 44, r≈6 (squarish), entity-tint fill (#eff2f7 / #f3f1f4 / #edf4ec / #f7f1e7), no border, branch glyph 18×22 + mono bold 19 px in the entity colour; width 103 (`main`) to 250 (`feature/dashboard`). Status-bar pill uses the same style. Dots appear only in the CC header (8 px #c06951) and as tool bullets `●` (8 px). | outlined "• OK", filled "LIVE" | Different shape language (squarish tint chips) | T |
| 15 Icons/imagery | Line icons with ≈3 px stroke @1080: folder, file, branch glyph. Filled: git diamond (red), III bars, object-chip diamond (14 px), pixel-art Claude Code mascot (39×24, #c76143), pixel cursors with pixel-icon labels. The only raster is the mascot. No photos, maps or logos besides the git mark. | no icons in the v2 frames | Needs an icon set (folder, file, branch, git, pixel agent) | A |
| 16 Connectors | Bracket: 5 px vertical trunk at x 285 with 4.5 px horizontal stubs into each card's left edge at row-1 height; right-angle joints; red #c24a31. Straight connector (V): 5–6 px, drawn top→bottom, ending in a Ø≈12 px dot on the target card edge. Git lines 6 px; commits are hollow rings Ø36 with 5 px stroke. Branch/merge curves: cubic S-curves 5–6 px in the entity colour, ending in a dot on the target. Object links: 5 px slight S-curves from chip to mini-card (purple/green). No dashes except the S31 dotted "versions" row (dot–dash–dot, purple). No arrowheads (← → only appear as text glyphs). | thin 1 px slider line | New connector primitives (bracket, S-curve, end dot) | M |
| 17 Charts/numbers | Only two quasi-charts: comparison bars (S16: 609 vs 134 px, 33 px tall, #d64628) and a disk-usage block meter (8 × 32 px squares, #86510b). S27 has 6 px progress bars in entity colours. No gridlines, axes, big numbers or tables. | 64 px big % numbers, traffic slider | R3 avoids big numbers entirely | – (style choice) |
| 18 Data realism | High and consistent: paths `~/projects/app`, `../auth`, `app/.git/worktrees/auth`; real commands (`git worktree add ../auth feature/auth`, `git worktree remove ../auth`, `git branch -d feature/auth`); object hashes `a1/2f c5/7e 4b/19 e6/04 82/cc f0/36`; commits `a41c7e2 b7e802a d63f911`; code `export async function signIn(user) {…}`; conflict markers `<<<<<<< feature/auth` / `timeout = 30;`. Entities (auth/billing/dashboard and their branch names) stay identical across all 32 scenes and match the narration. | instance IDs `i-0a3f8c21`, versions v2.0.4 | Comparable; keep | – |
| 19 Background | Flat #f3f3ec plus a static dot lattice: pitch 32 px (21.3 @720), dot ≈3 px, core #eaeae3 (Δ≈9 from bg; every third dot falls below the codec threshold). Never moves or changes; no vignette (all four corners #f3f3ec). | dark radial vignette gradient | Needs flat light bg + dot grid | T |

### D. Module catalog
| # | R3 measured | our v2 | gap | fix |
|---|---|---|---|---|
| 20 Modules | 22 distinct modules (full anatomy in §3): header, title/subtitle, annotation line, caption, mascot, repo card, folder card (4 entity skins), bracket, V-connector, file-tree card, file pill, git graph, merge graph, terminal window, VS Code window, Claude Code window (full / compact), state strip (ok/danger), alert/resolve box, checklist panel, object-chip grid + mini folder card, comparison bar card, disk-block meter, conflict diff card, display shout, agent cursors, "3 sessions" card. Reuse: folder card appears in 14 of 32 scenes (S01,05,06,07,09,10,11,12,13,17,21,26,28,30), repo card in 8 (+ S14 objects variant); every module keeps the same skin per entity for the whole video. | ≈5 modules (HUD, env card, instance row, big %, slider) | Library is 4× smaller and dark-only | M |

### E. Motion system (all measured frame-by-frame; details in §4)
| # | R3 measured | our v2 | gap | fix |
|---|---|---|---|---|
| 21 Entrances | Two recipes. **Rise-fade** (repo card, V cards, windows, strips, alerts, chips, bar cards, annotation, display shout): opacity 0→1 + y +22 px→0, **233 ms (7 f), power2.out**; the first visible frame already shows α 0.18–0.27 and +16–18 px. **Diagonal settle** (folder cards only): opacity + translate (−25, −37)→0, **333 ms (10 f), power3.out**; first visible frame is (−18, −27) at α 0.1–0.14. No scale, no blur, no overshoot (18 tracked events; residual ≤1 px @720 = codec noise). Tree rows and code lines are opacity-only, 200 ms, slightly ease-in (α .06 .12 .22 .34 .60 .86 .99; S04 row 1, 7.237–7.437), dx 0. | fade/slide (not measured here) | Adopt the two recipes as named presets | T |
| 22 State changes | Additive only: nothing already on screen recolours, flips or morphs. "State change" is shown by adding a new module (green ✓ strip, red alert, "Editable now" meta, a new pill on a new card). Typing (18 char/s) and progress bars (1.0–1.1 s ease-in-out) are the only in-place changes. Caption word colour flips in 1 frame. | in-place badge flips, counters, slider | R3's grammar is add, never mutate. Keep our mutations for other styles; add an "append-only" scene mode | C |
| 23 Emphasis | None. No pulse, ring, glow, stamp, scale punch or flash in 4036 frames. Emphasis is carried by colour (red) and by the closing annotation line. | scale punch / highlight (spec) | Disable emphasis in this style | T |
| 24 Exits/transitions | 31 hard cuts, all single-frame (only frame 36.933 differs in the 36.83–37.00 header window). No element exits before the cut. Header, mascot and caption persist; title, subtitle, counter and diagram swap. The new scene's first element starts on the cut frame (repo card α 0.09 at the cut frame, 0.33 one frame later). | in-scene mutation, few cuts | Needs hard-cut scene replacement where the first build starts on the cut frame | C |
| 25 Process/ambient | Typing: 18 char/s (26 chars in 1.43 s), 1–2 frames per char plus up to 4-frame pauses at spaces; red block cursor 8×26. Progress bars: 596 px in 1.0–1.1 s, ease-in-out, staggered 333–400 ms. Cursors: 3 cursors, staggered 0.5 s, each glides ≈150 px in ≈0.65 s (ease-in-out) onto the same token, then stops. No loops, packets or idle wobble. Holds are static apart from the caption and blinks. | packets/traffic (spec) | Add typing and cursor-glide processes | M |
| 26 Camera | None: header, title and mascot are pixel-locked on every frame. No zoom, push, pan or shake. | reframes available | Disable for this style | T |
| 27 Choreography | Build order: parent/top → children top-to-bottom → connector → annotation last. Example S11: cut 36.933, repo card 36.93–37.17, stubs 37.13–37.20, trunk 37.20–37.47, app/ 37.23–37.53, auth/ 37.57–37.73 (all overlapping). Staggers: chips 133 ms, code lines 233 ms, tree rows 233–300 ms, checklist 570–600 ms (paced by words), S24 terminals 1.1–1.2 s (paced by words), merge curves 167/267 ms. Front-loaded: a scene reaches its complete state in 1–3 s, then holds a median ~1.6 s (max 4.0 s at S30). | – | Needs a build-order planner (parent → children → links → annotation) | C |

### F. Timing & narration sync
| # | R3 measured | our v2 | gap | fix |
|---|---|---|---|---|
| 28 Beat density | 156 diagram beats (69.6/min), 31 cuts (13.8/min, one every 4.20 s). Gaps: median 600 ms, bimodal (100–400 ms bursts inside builds; 1–2 s holds before cuts). Scene life 1.53–6.63 s (mean 4.20). Build ≈1–3 s, then hold ≈1.6 s. | 17.7 s clip, 1 scene | Scene cadence 4.2 s | C |
| 29 Word anchoring | 48% of beats sit within 0.3 s of their word (enumerations, commands, merges); 52% are free-running and **lead** their word by 0.4–2.6 s; none lag by more than 0.3 s. Cuts land 0–0.45 s after a sentence onset (31/31). Captions: chunk swap on the first word's onset (±65 ms); word colour +70 ms. | word-anchored | Allow leads (pre-roll up to −0.7 s) and never lag | T |
| 30 Sentence → treatment | enumeration → one card/terminal per item on the item word (billing 40.98→41.00, dashboard 43.10→43.13); command → typing in a terminal; "two parts / X and Y" → V 2-card + connector; state → green ✓ strip; problem → pink alert box / red strip; question → condensed caps shout; comparison → bar card; "mental model" → V-card + arrow; takeaway → red annotation under a divider (12 scenes). Negation is never a strike-through; it becomes a red annotation (`Lighter ≠ zero disk cost`). | – | Add these rules to the storyboard generator | C |

### G. Narrative / storyboard
| # | R3 measured | our v2 | gap | fix |
|---|---|---|---|---|
| 31 Structure | Hook 0–3.4 s: title card + the full answer diagram (repo → 2 folders) in 1.5 s, then "Two parts" at 1.53. Act 1 concepts (S02–S05), Act 2 problem (S06–S08), solution (S09–S13), mechanism (S14–S17), use case (S18–S22), agents escalation (S23–S27), caveats (S28–S29), recap (S30–S31), clean-up/CTA-less ending (S32, last 5 s = terminal `git worktree remove` + red takeaway `One repo. Many places to work.`). No outro card or logo. | – | Needs a multi-scene storyboard | C |
| 32 Scaffold reuse | Every scene rebuilds from empty, even with the same scaffold type (T used 6×: S01, S05, S11, S13, S26, S30 as callbacks). 32 scenes in 134.5 s = 14.3 scenes/min. Nothing is mutated across a cut. | one scaffold, mutated | Rebuild-per-scene mode | C |
| 33 Entity continuity | main = blue #3361b0, auth = purple #714faf, billing = green #157d5f, dashboard = amber #855412, repo/danger = red. Folder order is always auth → billing → dashboard, top → bottom. The same names and paths appear in every scene. | blue/green consistent | Keep; add an entity→colour registry beyond 2 entities | T |

### H. Audio
| # | R3 measured | our v2 | gap | fix |
|---|---|---|---|---|
| 34 Voice | 457 words, 204 wpm over 123 s of speech; F0 median 213 Hz (p10 174, p90 258); 57 sentences, median 7 words; inter-sentence pauses 0.1–0.35 s (only 16 pauses > 0.25 s, 5.1 s in total). Timbre and emphasis not assessable without listening. | TTS voice | Pace target 200+ wpm | T |
| 35 Music/SFX/mix | Integrated −14.1 LUFS, LRA 1.0 LU, true peak −1.1 dBFS (ebur128 on the file). A continuous bed stays under the voice: inter-word gaps read −20 to −26 dBFS RMS; only one stretch drops below −45 dB. Whether that bed is music or noise, and whether SFX play on typing, is not assessable (no listening; transients near beats 0.251 vs chance 0.225, i.e. no sync). | −17 LUFS spec | +3 LU louder; add a low bed | T |

### I. Production
| # | R3 measured | our v2 | gap | fix |
|---|---|---|---|---|
| 36 Export | 720×1280, 30 fps CFR, h264 yuv420p, video ≈208 kbps, AAC 48 kHz stereo ≈53 kbps, 134.53 s (Instagram re-encode; visible ringing on 1 px lines). Fully deterministic vector/text graphics plus one static raster mascot with 3 eye states, so it is cheap to reproduce in HTML/GSAP: ≈22 modules, no video layers, no blur/glow. | 1080×1920, 30 fps, 323 kbps | Ours already exceeds the source resolution | – |

## 2. Light-theme token spec (build this; values measured on R3 and scaled to 1080)

Hexes are from decoded 208 kbps frames. "fill" = median of a flat area (±3 per channel). "stroke" = median of the most saturated 10% of a ≥4 px element. Thin text is AA/chroma-washed, so text tokens take the darkest 2–5% core, and the design value is given where the measured core is clearly lightened.

| token | value | measured on |
|---|---|---|
| `bg` | #f3f3ec | all corners, all frames (lum 241.7) |
| `bg.dot` | #e6e6de dot, 3 px, 32 px lattice (measured core #eaeae3) | f_1.41 y 1040–1280 |
| `surface.card` | #fefcf8 | folder card, caption, window body |
| `surface.repo` | #f8faf5 | repo card interior |
| `surface.chrome` | #e9ebe4 (window title bar), #ebe7db (Claude Code header), #eeede2 (prompt band), #ebf0ea (VS Code status bar) | f_18.88, f_109.00, r_73.25 |
| `border.neutral` | #b7b7b0 (window, 1.5 px), #d2d2cb (caption), #c9c9c2 (header rule), #d8d8d1 (annotation divider), #eceae6 (VS Code inner dividers, 2–3 px) | edge scans |
| `shadow.soft` | 0 6px 24px rgba(20,20,10,.07): Δ −8 lum at the edge, fading over 30 px below and 15 px at the sides | folder card, caption |
| `shadow.window` | 0 14px 48px rgba(20,20,10,.10): Δ −13 lum, 60 px falloff | terminal S06 |
| `shadow.repo` | 0 10px 8px rgba(209,71,38,.10) (tight, red-tinted #f2e8df band 12 px tall) | repo card S01 |
| `ink.primary` | #161d22 (title), #171c1e (caption spoken), #0a0d0c (card names) | cores |
| `ink.secondary` | #5f605d (mono meta), #61615a (header/subtitle) | cores |
| `ink.muted` | #6e6e67 (paths), #707069 (hash labels), #585c54 (caption upcoming) | cores |
| `accent.red` | stroke #d14726, fill #d54729 / #de4b35, text #b03f2f (caption) / #c0503e (annotation, prompt ❯) | bars, logo, lines |
| `entity.main` | #3361b0 (icon/stroke), pill bg #eff2f7, pill text #3f5c83, border #b7bfd5 | S01 app/ |
| `entity.auth` | #714faf stroke, #6757a2 icon, pill bg #f3f1f4, text #63587c, border #c5bed0 | S01/S30 |
| `entity.billing` | #157d5f stroke, #337863 icon, pill bg #edf4ec, text #56907d, border #b7c7bd | S30 |
| `entity.dashboard` | #855412 stroke, #7a5623 icon, pill bg #f7f1e7, text #94774a, border #c8bca6 | S30 |
| `state.ok` | bg #e3ede4, text #244e3a, terminal output #3f6f5c | S10, S06 |
| `state.danger` | bg #fae7e3, border #b23a3f (1.5 px; core #874041), text #762b32 | S19, S29 |
| `diff.ours / theirs` | #e7e3f0 + text #544274 / #e0eee4 + text #396151 | S29 |
| `traffic` | #ec695a, #eabb50, #6eb78b (Ø15) | S06 |
| `code.text` | #5f677a (slate), line numbers #80827d | S18 |
| `pixel.agent` | #c76143 | S23/S24 |

Type scale @1080 (from cap/x-height and mono advance): display-title 70/700 (cap 49); caption 52/800 (cap 37); shout 56/800 condensed; module-title sans 31/700 (`ONE REPOSITORY`, cap 22); annotation 31/500; CC hero 48/500; mono-name 27/700; mono-cmd 27/400 (advance 16.4); mono-meta 24/400 (advance 14.5); mono-path/output/code 22/400; subtitle mono 27 caps; header mono 22 caps +0.06 em; pill mono 19/700; status mono 18. Line pitch: code 43.5, tree 47, checklist 55.

## 3. Module catalog + layout templates (px @1080)

### 3a. Modules
| module | anatomy (px @1080) | colours | variants / data | reuse |
|---|---|---|---|---|
| **Header** | label at x 73 (cap 231–252) · counter right-aligned to 1004 · 1.5 px rule y 279, x 72–1007 | #61615a / #64645d / #c9c9c2 | label = topic path `GIT / WORKTREES`; counter `NN — TOTAL`, zero-padded | every frame |
| **Title + subtitle** | title x 75, cap 320–369, 70/700, one line ≤ 880 px; subtitle x 75, cap 465–485, mono 27 caps | #161d22 / #63645d | title = 2–5-word claim ending in "."; subtitle = mono caps gloss (`ONE REPO. MULTIPLE REAL FOLDERS.`, `FROM app/ ON main → A SIBLING FOLDER`) | every scene, hard-swapped |
| **Annotation line** | divider 324–995 × 1.5 px, then text 31/500 cap +35 px below | divider #d8d8d1; text in accent/entity colour | red = takeaway/warning, purple = auth fact, blue = main fact, green = resolution | 12 scenes (last beat) |
| **Caption** | see item 10 | – | 3-state karaoke | always |
| **Mascot** | 161×560 raster at (75, 780) | – | eyes open / look-up / closed | always |
| **Repo card** | 670×126, r 16, 3 px red border; git diamond 69 px at x+30; title `ONE REPOSITORY` 31/700 caps red at x+124; `app/.git` mono 23 grey below; III bars (3 × 13.5×44, gap 8, r 3) right, inset 30 | #d54729 fills, border ≈#c9472e | S14 variant: `app/.git/objects` (red mono bold) + 2-line right gloss `ONE shared object database` | 8 scenes |
| **Folder card** | 670×159, r 16, 1.5 px entity border; folder outline icon 51×40 at x+30, y+36; name mono 27/700 at x+102; pill right (inset 29, top +32, h 44); meta mono 24 at x+102, y+105 | entity tokens | name = folder, pill = branch, meta = `src/ · package.json` / `node_modules/ · dist/` / `Editable now` / `Combined, reviewed changes`; S21 adds a `Claude Code` row | 14 scenes |
| **Bracket** | trunk 5 px at x 285, from the repo card's row-1 y down to the last child's row-1 y; stubs 4.5 px from trunk to card left edge (45 px long) | #c24a31 | 2–3 children | all T scenes |
| **V-connector** | 5–6 px vertical at card centre x 665 from card A bottom to card B top; Ø12 end dot on B | red | – | S02, S31 |
| **File-tree card** | 670×420 card; header `app/` sans 30/700; rows mono 24 with box-drawing glyphs `├─ │ └─`, pitch 47; folder names bold | ink #393f41, glyph #50504d | – | S04 |
| **File pill (large)** | 585×100 (x 360–945), r 10, 1.5 px blue border #6f7fa8, fill #eaeef2, file icon 39×56 blue, name mono 27 | blue | – | S04 |
| **Git graph** | inside the column: nodes hollow rings Ø36, 5 px stroke, fill = card; main line 6 px red at y 1005 through nodes x 416/566/735/905; branch = cubic S up 150 px to a purple line at y 855 with 2 purple nodes; mono 20 hashes under nodes; pills above/below | red / purple | – | S03 |
| **Merge graph** | card 670×178 holding 3 branch pills; 3 cubic curves 5–6 px (entity colours) from pill bottoms to one dot at (665, 1017) on the `app/ main` folder card | entity | – | S28 |
| **Terminal (zsh)** | 699×318, r 16, 1.5 px #b7b7b0 border, window shadow; title bar 65 px #e9ebe4 with a 1.5 px divider; traffic lights Ø15 at centres x 333/358/383; title `Terminal — zsh` sans 22 #545851 at x 408; `⌘` right at 954–971; body padding 30: path mono 22 grey → prompt `❯` red + command mono 27 → output mono 22 green; red block cursor 8×26 | see tokens | height grows with lines (318 in S06; 348 in S09 with a wrapped command) | 5 scenes |
| **VS Code window** | 699×488; same title bar (`auth.ts — Visual Studio Code`); tab row 66 px (file icon + `auth.ts` mono 25); 2–3 px dividers; code area with line numbers at x 322, code at x 370, 22 px, pitch 43.5; status bar 58 px #ebf0ea with a branch pill left and `UTF-8  TypeScript  ✓` mono 18 right | slate code | cursors overlay variant (S25) | 4 scenes |
| **Claude Code window** | full: header strip 39 px #ebe7db (dot + `Terminal`, path right); hero row pixel icon 90×55 + `Claude Code` 48/500 + `Let's build.` mono red; path/branch lines; prompt band between 1.5 px rules; `✱ Working…` red; `esc to interrupt` 18 mono. Compact (S24/S27): 670×216, header `● Claude Code` + `../auth` right; row pixel icon + branch mono bold entity + `SESSION AUTH` caps right; prompt band #eeede2 h 53 (`❯ Build authentication`); tool line `● Edit(src/auth.ts)` / `● Bash(npm test) · PASS` green-grey; optional 6 px progress bar at the bottom in the entity colour | – | 3-up stack at pitch 260 | 3 scenes |
| **Sessions card** | 670×157: 3 pixel icons (39×24, gap 30) + `3 sessions` sans 30/600; meta `auth/ · billing/ · dashboard/` | – | – | S23 |
| **State strip** | 630×80 (x 350–980), r 8, no border; `✓ text` mono 25/700 | ok tokens (danger: red border variant 1.5 px) | ok / danger / caps banner (`ANOTHER TASK ARRIVES`, `FEATURE UNTOUCHED`) | 6 scenes |
| **Alert / resolve box** | 680×124 (S19) or 670×148 (S29), r 10, 1.5 px danger border; mono 25/700, 1–2 lines, `!` prefix | danger | – | S19, S29 |
| **Checklist panel** | 670×418 card; rows `01`–`04` red mono bold + mono 25 text, pitch 55, top pad 48 | red numbers | step lists | S20 |
| **Object-chip grid** | 3×2 chips 198×96, gaps 15; r 8; 1.5 px #a17e6d border; fill #fef8ee; red diamond 20 px + hash mono 20 | red | object IDs | S14 |
| **Mini folder card** | 284×185, r 16, icon 66×48 + name sans 30/700 | entity | – | S14 |
| **Comparison bar card** | 670×207: title sans 30/600; bar 609×33 r 3 #d64628 (or 134 px + ` + working files`); caption mono 21 grey | red | value → bar width | S16 |
| **Disk-block meter** | label `DISK USAGE ↑` mono caps 20 #917f58 at x 330; 8 squares 32×32, pitch 39, r 3, #86510b at x 650–955 | amber | count = magnitude | S17 |
| **Conflict diff card** | 670×453; title sans 30/700 `config.ts — merge conflict`; full-width bands h 50 (ours purple, theirs green) with mono 23 lines; `=======` row neutral | diff tokens | – | S29 |
| **Display shout** | condensed caps 56/800, tracking −0.04 em, at x 330 | ink | questions | S07 |
| **Agent cursors** | pixel arrow cursors ≈27×33 in entity colours + pixel-agent label tag 20×12 | entity | 3 | S25 |
| **Swap strip** | 670×128 card with `main ⇄ feature/auth` pills | – | – | S08 |

### 3b. Layout templates (outer boxes, px @1080; y = top–bottom)
| template | scenes | geometry |
|---|---|---|
| **T** repo + bracket + stack | S01, 05, 11, 13, 26, 30 | repo card 330–999 × 611–735 (2 children) or 527–650 (3 children); children pitch 225 (2 children: 836–993, 1061–1218) or 210 (3 children: 761–917, 971–1127, 1181–1337); trunk x 285 from repo row-1 y to last child row-1 y; stubs to x 330 |
| **V** 2-card + connector | S02, S31 | card A 330–999 × 536–768; connector x 665, 768→962 (≈194 px); card B 962–1203; divider 1270; annotation 1316 |
| **W** window + detail | S06, 09, 18–20, 22, 23, 25, 32 | window 300–999 × 536–854 (terminal) or 551–1038 (VS Code); detail card / strip / alert 330–999 starting ≈ window bottom + 110 (S06 992–1149; S19 alert 311–990 × 1121–1244); divider 1221; annotation 1254 |
| **S** stacked | S07, 08, 10, 12, 15–17, 21, 24, 27, 29 | modules 330–999 starting 551; folder card → strip → folder card → strip at 551–708 / 761–840 / 911–1068 / 1130–1209; triple terminals 551–767 / 810–1028 / 1071–1287 (+ `✓ committed` mono line 19 px below each in S27) |
| **G** graph | S03, S28 | S03: repo card 527–650, graph 780–1070, divider 1235, annotation 1269. S28: pill card 551–729, curves 729–1017, target card 1022–1179 |
| **O** object grid | S14 | variant repo card 536–699; chip rows 785–879 / 896–990, cols 354–552 / 567–762 / 777–975; links to mini cards 330–614 and 710–999 × 1110–1295 |
| **File tree** | S04 | tree card 330–999 × 555–975; file pill 360–945 × 1040–1140; divider 1221; annotation 1265 |

## 4. Motion spec (measured per 30 fps frame; px @1080 unless marked [720])

Method: `mot.py` pipes raw frames through ffmpeg; `track()` / `track2()` fit α (least-squares scale against the settled frame) and shift (NCC). Draws are measured by colour-mask run extents. Strips `R3_DdSc-I9IqNC_strip_036.850.jpg` (S11 build), `…_040.930.jpg` (folder card), `…_010.000.jpg` (mascot) are the visual cross-checks.

### 4a. Measured events
| # | event (t) | per-frame data (first visible → settled) | derived recipe |
|---|---|---|---|
| E1 | S01 repo card (0.033–0.233) | α .24 .46 .63 .80 .88 .94 1; dy [720] +11 +7 +5 +3 +1 0 | rise-fade: y +22→0, 233 ms, power2.out (fits α to ±.03) |
| E2 | S02 working-tree card (2.13–2.43) | α .18 .38 .56 .69 .80 .85 .90 .93 .99; top edge [720] 622→618→616→614→611→610 | rise-fade, 233–300 ms |
| E3 | S06 terminal after cut (14.437–14.737) | α .20 .47 .60 .74 .89 .92 → 1; dy +11 +8 +5 +3 +2 +1 0 | rise-fade (windows use the same recipe) |
| E4 | S11 repo card on the cut frame (36.933–37.167) | α .09(cut) .33 .54 .69 .78 .91 .96 1; dy +13 +10 +7 +4 +3 +1 +1 0 | rise-fade starting on the cut frame |
| E5 | S12 billing folder card (40.963–41.297) | L-edge [720] 208 211 214 216 217 218 219 219 220; T-edge 531 536 540 544 546 547 548 548 549; α .14 .33 .44 .68 .70 .74 .81 .88 1 | diagonal settle: (−25,−37)→0, 333 ms, power3.out |
| E6 | S01 app/ child card (0.167–0.467) | T-edge [720] 534 540 546 548 550 553 554 555 556; L 206→218 | diagonal settle (same as E5) |
| E7 | S07 "AT THE SAME TIME?" (20.633–20.867) | α .25 .50 .64 .79 .89 .98 1; dy +11 +8 +5 +3 +2 +1 0 | rise-fade, no scale, no overshoot |
| E8 | S10 green ✓ strip (33.66–33.86) | α .27 .51 .71 .81 .97 1; dy +11 +8 +5 +3 +2 +1 0 | rise-fade |
| E9 | S14 object chips ×6 (50.137–51.033) | 50%-α onsets 50.250 50.383 50.483 50.617 50.750 50.883 (Δ 133 100 134 133 133 ms); each chip α .18→1 in 7–10 f, dy +12→0 | rise-fade, 133 ms stagger (row-major) |
| E10 | S04 tree rows ×5 (7.24–8.45) | onsets 7.350 7.583 7.850 8.150 8.383 (Δ 233–300); row 1 α .06 .12 .22 .34 .60 .86 .99, dx 0 | opacity-only 200 ms, slight ease-in; 250 ms stagger |
| E11 | S02 DB→WT connector (2.333–2.700) | head y [720] 521 525 527 533 541 551 563 575 585 593 599 → join 615 | stroke draw, top→bottom, 400 ms, ease-in-out (sine) |
| E12 | S03 main git line (3.913–4.28) | head x [720] 299 315 339 369 409 456 483 531 557 575 587 597 | stroke draw left→right through pre-placed rings, ≈380 ms, ease-in-out (the log's "linear" is wrong) |
| E13 | S11 bracket (37.117–37.467) | stubs appear 37.117–37.133 (drawn card→trunk in ≈3 f); trunk head y [720] 401 427 464 511 572 641 697 741 774 | stubs 100 ms, then trunk 300 ms ease-in-out, 576 px long |
| E14 | S31 arrow (124.533–124.867) | head y [720] 515 519 523 531 541 553 569 587 603 615 623 | 400 ms ease-in-out (the log's "270 ms accelerating" is only the first half) |
| E15 | S28 merge curves (109.433–110.23) | purple head rows 5 11 21 33 51 71 90 109 129 147 163 175 183 (433 ms); green starts 109.600 (500 ms); amber 109.87 (≈370 ms) | 3 overlapping S-curve draws, stagger 167/267 ms, ease-in-out |
| E16 | S27 progress bars (106.467–107.43) | purple right edge [720] 247 249 255 261 268 277 287 299 315 331 351 373 397 425 455 483 507 529 549 567 583 595 605 615 623 629 633 637 639 641 | width 0→596 px, 1.0 s, ease-in-out (bell velocity); green starts +333 ms |
| E17 | S06 typing (14.733–16.167) | ink right edge advances 10.9 px [720] per char, 1–2 frames per char with 3–4-frame pauses | 26 chars / 1.43 s = 18 cps; output line fades in 100 ms at +200 ms |
| E18 | S17 disk blocks (66.60–66.80) | α .08 .26 .48 .67 .87 .96 .99; all 8 blocks within ±.01 at every frame | group fade 200 ms, no stagger, no grow |
| E19 | S25 cursors (96.1–98.0) | purple (566,612)→(487,559) [720] over 96.4–97.0; green (586,597)→(493,560) 96.8–97.6; amber (602,580)→(498,558) 97.3–98.0; all static after 98.0 | glide-to-target, ≈650 ms each, 0.5 s stagger, ease-in-out |
| E20 | caption chunk swap (11.500→11.533) | box 206–513 [720] appears in 1 frame; 26 one-frame intermediate states in the whole video | hard swap (≤1 f blend) |
| E21 | caption word flips (10.10–13.87) | Normally +0, one +120, repository +60, means +90, one 0, working −90, tree −90, you're −50, on +100, main +70, and +90, want +150 … ms | 1-frame colour flip; median +70 ms lag |
| E22 | S11 hard cut (36.933) | header/title window mean diff: 0.00, 0.01, **18.51**, 0.00, 0.00 | 1-frame cut; nothing eases out |
| E23 | mascot blink (e.g. 35.8) | eye-white px 277–291 → <120 for 6 frames | 200 ms swap to the closed-eyes drawing, every 4.65 s |

### 4b. Motion presets to implement
| preset | properties | dist | dur | ease | stagger | used for |
|---|---|---|---|---|---|---|
| `riseFade` | opacity 0→1, y | +22 px → 0 | 233 ms (7 f) | power2.out | – | cards, windows, strips, alerts, chips, annotation, shout |
| `diagSettle` | opacity, x, y | (−25, −37) → 0 | 333 ms (10 f) | power3.out | – | folder cards (children) |
| `fadeRow` | opacity | 0 | 200 ms | power1.in | 133 ms (chips) / 233 ms (code) / 250 ms (tree rows) | list rows |
| `drawStroke` | stroke-dashoffset | length | 300–500 ms (≈0.75 ms/px, 142–576 px) | sine.inOut | 167–267 ms (merge) | connectors, trunk, graph lines, arrows |
| `drawStub` | stroke-dashoffset (card→trunk) | 45 px | 100 ms | linear | together | bracket stubs, before the trunk |
| `growBar` | width / scaleX from left | 0→100% | 1000–1100 ms | sine.inOut | 333–400 ms | progress bars |
| `groupFade` | opacity | 0 | 200 ms | linear | 0 | block meters |
| `type` | text reveal | – | 55 ms/char (18 cps), +66 ms at spaces | steps | – | terminals, prompts |
| `glide` | x, y | ≈150 px | 650 ms | sine.inOut | 500 ms | agent cursors |
| `cut` | – | – | 1 frame | – | – | every scene change; first `riseFade` starts on the cut frame |
| `karaoke` | colour | – | 1 frame | step | per word, +70 ms | caption |
| `blink` | sprite swap | – | 200 ms | step | every 4.65 s ±0.6 | mascot |

Never used: scale, overshoot/back/elastic, blur, glow, camera moves, exits, idle wobble.

## 5. Top 15 gaps vs our v2 (ranked by visual impact)
| rank | gap | R3 target | our v2 now | fix class |
|---|---|---|---|---|
| 1 | No light theme | bg #f3f3ec + 32 px dot grid, white cards, near-black ink, one red accent, 4 entity hues at low area (0.4% saturated px) | dark #08090c vignette, large saturated fills | T (full token set §2) |
| 2 | No per-scene headline block | header breadcrumb + counter + hairline, 70 px bold title, 27 px mono caps subtitle, all hard-swapped per scene | LIVE/OK HUD bar only | M |
| 3 | Scene cadence | 32 scenes in 134 s (hard cut every 4.2 s on sentence onsets), each rebuilt from empty | one mutated scaffold | C (multi-scene rebuild + cut on sentence) |
| 4 | Module library | 22 light modules (§3a): repo/folder cards, bracket, windows (zsh / VS Code / Claude Code), strips, alert, chips, diff, bars | ~5 dark dashboard modules | M |
| 5 | Caption skin | light box #fefcf8, 1.5 px #d2d2cb border, soft shadow, r 10, 52/800, 3-state karaoke (#171c1e / #b03f2f / #585c54), 4-word chunks | dark box, 3 px border, 8 px hard accent shadow, 60 px | T |
| 6 | Mascot scale and placement | 161×560 at (75, 780), 14.9% W; static, blink 200 ms / 4.65 s, gaze-up state | 257×362 at (17, 942), 24% W | T + A (light-compatible character) |
| 7 | Window chrome modules | macOS terminal / VS Code / Claude Code with traffic lights, 65 px title bars, status bar, typing at 18 cps | none | M |
| 8 | Entrance grammar | `riseFade` 22 px / 233 ms / power2.out; `diagSettle` for folder cards; no scale/overshoot | spec'd fades/slides, not matched | T |
| 9 | Connector primitives | right-angle bracket (5 px trunk + stubs), S-curve merges, end dots, draw 300–500 ms sine.inOut, parent→child | 1 px slider rail | M |
| 10 | Build choreography | parent → children → connectors → annotation; overlapping staggers 100–270 ms; complete in 1–3 s, then hold ~1.6 s | – | C (build-order planner) |
| 11 | Annotation takeaway line | divider + 31 px coloured sentence closing 12 of 32 scenes | none | M |
| 12 | Column geometry | content column 330–999 (670 wide), 51 px module gaps, 30 px inner padding; modules float free (no enclosing panel) | one panel 327–1010 × 484–1343 | T |
| 13 | Typography stack | display grotesk (Space Grotesk-like) + Inter-like caption + JetBrains-Mono-like data; mono carries every name, path, meta line and code line | sans + mono | A (fonts) + T |
| 14 | Visual lead on narration | free beats lead their word by 0.4–2.6 s and never lag >0.3 s; enumerations land on the item word | word-anchored | T (allow negative offsets) |
| 15 | Append-only state language | state = new ✓ strip / alert / card (never an in-place recolour), no emphasis FX | in-place badge flips, big % counters | C (scene mode flag) |


---
Note on scratch scripts: `mot.py` now forces even crop sizes/offsets. Before that fix, odd-height crops (S10 strip, S16 card, first caption pass) came back misaligned. Those three were re-run and only the re-run values appear above.
