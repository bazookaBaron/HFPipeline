# C5 raster-derived design tokens (reference evidence, not source CSS)

Seven settled frames from R1–R5 were inspected at their **native 720 × 1280** encoded resolution. The earlier request's “px at 1080 width” is a 1.5× proportional conversion, not a claim that the supplied files contain 1080 pixels. Run `C:\Repos\tts-venv\Scripts\python.exe analysis\pacing-audit-20260924\design\measure_tokens.py` to reproduce the sampled RGB medians (7 × 7 patches) and 8-level color census. Video compression, antialiasing and unknown fonts prevent recovery of exact design-file hexes, CSS font sizes or corner radii. Values marked “proposal” below are design decisions, not measurements.

## Per-frame palette evidence

| Frame | Measured sample or dominant quantized color | Interpretation |
| --- | --- | --- |
| [R1 39.68 s](ref_frames/R1_039.68_metrics-dashboard.png) | `(700,1100)` `#000000`; HUD/card `(350,180)/(350,575)` both `#090d11`; cyan census `#58e0f8` | Black stage, blue-tinted near-black instrumentation surface, bright cyan data stroke. |
| [R2 60.00 s](ref_frames/R2_060.00_router.png) | outer `#000000`; HUD `#090d11`; blue card `(120,800)` `#0a1a31`; green card `(580,800)` `#032915`; blue text census `#5898f0` | The blue/green panels are materially different fills, not one generic dark card. Orange instance icons are visible but too antialiased to infer one exact source hex; ROI clusters near `#e87000`. |
| [R3 93.00 s](ref_frames/R3_093.00_terminal.png) | paper `(700,1100)` `#f3f3ec`; terminal card `(450,390)` `#e9e8db`; command row `(350,450)` `#eceae2`; heading ink visually near dark slate | Warm off-white editorial canvas, cream terminal chrome, subtle cooler/darker type. A single sampled pixel cannot establish the text foreground token. |
| [R4 149.00 s](ref_frames/R4_149.00_final-architecture-settled.png) | paper `(700,1200)` `#f4f4ed`; window header `(300,395)` `#e0e6e8`; API chip `(560,478)` `#cceedf`; accent clusters around `#2860b8` (blue), `#7050a8` (purple), `#188060` (green) | Light diagram with restrained multicolor *semantic* routes, not a rainbow background. Point `(300,470)` falls on content and is **not** a window-fill measurement. Product marks visible in the original are excluded from our assets. |
| [R5 43.00 s](ref_frames/R5_043.00_node-source.png) | outer `(700,1100)` `#090a0d`; object panel `(500,650)` `#12161e`; [R5 15.55 s](ref_frames/R5_015.55_serif-hero.png) same outer `#090a0d` | Very dark navy-black, finer grid and cool charcoal panels. Peach chromatic census belongs to the character illustration, not an interface accent. |

The neutral ink in R3/R4 is approximately `#26313a` by visual inspection of antialiased glyphs, and R5's light display type is approximately `#f2f2f0`; neither is an exact original token. The proposed CSS below deliberately uses this approximate ink/light pair and must be checked on rendered output.

## Geometry and typography observed in the encoded frames

| Role | Evidence | Native 720-wide measurement/observation | 1080-wide proportional equivalent |
| --- | --- | --- | --- |
| Frame side safety | [R2 60 s](ref_frames/R2_060.00_router.png), [R3 93 s](ref_frames/R3_093.00_terminal.png), [R4 149 s](ref_frames/R4_149.00_final-architecture-settled.png), [R5 15.55 s](ref_frames/R5_015.55_serif-hero.png) | Main rails/content start near x40–50; right rail near x670–680. | About 60–75 px inset; this is a frame observation, not a universal rule. |
| Persistent HUD | [R2 60 s](ref_frames/R2_060.00_router.png) | x40–680, y157–204; thin outline, approximately 47 px height. Monospace hostname/version and small tracked status. | x60–1020, y236–306, ~71 px height. |
| Paired status cards | [R2 60 s](ref_frames/R2_060.00_router.png) | x40–354 and x367–680; y633–866; 13 px gap; visible hairline outlines and small radius. | Each ~470 px wide ×350 px tall; gap ~20 px. |
| Light card group | [R3 93 s](ref_frames/R3_093.00_terminal.png) | Two terminal cards x220–665, each ~145 px tall, with ~30 px inter-card air. Mascot column roughly x48–170. | Cards ~668 px wide; mascot column ~183 px wide. |
| Diagram and character | [R4 149 s](ref_frames/R4_149.00_final-architecture-settled.png) | Mascot occupies about x46–183, y405–893; diagram cards x213–669, y381–832. Text and routes do not run behind mascot. | Mascot ~206 px wide, separated diagram zone ~684 px wide. |
| Serif hero | [R5 15.55 s](ref_frames/R5_015.55_serif-hero.png) | “ONE PROBLEM” glyphs occupy roughly x49–503, y334–398 (~64 px cap/glyph height). | ~96 px *raster glyph height*; font-size cannot be deduced exactly. |
| Sans display | [R3 93 s](ref_frames/R3_093.00_terminal.png), [R4 149 s](ref_frames/R4_149.00_final-architecture-settled.png) | Bold headline glyphs ~36–42 px tall, left-aligned at x48. | ~54–63 px raster glyph height, not CSS font-size. |
| Technical labels | [R2 60 s](ref_frames/R2_060.00_router.png), [R3 93 s](ref_frames/R3_093.00_terminal.png), [R4 149 s](ref_frames/R4_149.00_final-architecture-settled.png) | Monospace data rows and tracked all-caps labels are deliberately smaller (~11–17 px apparent glyph height); hierarchy comes from contrast and spacing. | ~17–26 px apparent glyph height. |
| Caption pill | [R2 60 s](ref_frames/R2_060.00_router.png), [R4 149 s](ref_frames/R4_149.00_final-architecture-settled.png), [R5 15.55 s](ref_frames/R5_015.55_serif-hero.png) | Content-sized, horizontally centered at around y945–1032, not full-frame width. R2 uses dark fill with white border/blue offset keyline; R3/R4 use white/light fill and subtle shadow; R5 uses translucent dark fill. Active word is blue while inactive words are light gray/white or charcoal. | Baseline around y1418–1548; style varies by theme. The pill is not one immutable global component. |
| Footer / progress | [R4 149 s](ref_frames/R4_149.00_final-architecture-settled.png), [R5 15.55 s](ref_frames/R5_015.55_serif-hero.png) | R4 has footer rule near y1100, page counter upper right; R5 has thin segmented progress upper right around y139. | Rule y~1650 and progress y~209, if proportionally scaled. |

Border thickness appears about 1 native px on most cards, sometimes 2 on emphasis; radius appears about 8–13 native px. Internal card padding appears 12–20 native px; section gaps range 13–30 native px. These are **visual estimates from pixels**, with no exact source-vector access. The proposed file `video-engine/compositions/components/lib/tokens-v2.css` encodes scalable starting values and is intentionally not imported. No font family is identified with confidence from the raster; match roles (heavy grotesk, technical mono, editorial serif) using licensed fonts at integration time.

## Implementation guardrails

- Treat dark R1/R2/R5 and warm-light R3/R4 as distinct profiles; the semantic layout, UI density, mascot position, and caption treatment vary by story moment. One generic card/grid would erase that difference.
- Retain meaning-bearing micro-details (hostname, status, route label, step counter, terminal row) but generate them from the script/scene model, never from random placeholder data.
- The extracted frames are analysis evidence only. Do not ship reference mascots, marks, diagrams, screenshots, or logos. Rebuild generic technical forms with original assets and licensed icons.
- At 30 fps, one frame is 33.33 ms; “millisecond-level” timestamp notes do not imply recoverable motion between decoded frames. Motion timing belongs in beat logs and test renders, not inferred from a single still.
