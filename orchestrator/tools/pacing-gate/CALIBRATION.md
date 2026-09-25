# Pacing gate calibration, 2026-09-24

The CLI is diagnostic. Its beat is a burst of changed pixels in a 4×16 cell grid,
not a human judgment that a new idea appeared. `--exclude-rect` removes caption,
mascot and other continuously moving regions from the pixel measurements. A cut
requires at least 25% of remaining cells to change within two frames. The same
geometry is used for the frozen hold and empty-content proxies. Output is JSON;
there is no pass/fail threshold. R2's carrier scaffold legitimately persists
about 125 seconds.

## Ground truth and actual gate measurements

The visual targets below come from `analysis/pacing-audit-20260924/evidence/*.visual_log.md`
in the main checkout. The gate ran on all five original MP4s at
`C:\Users\debna\Downloads\igexport-*.mp4` and on the supplied pipeline output.
The exact per-video JSON outputs (`r1.json` … `r5.json`, `ours.json`) are beside
this report. Masks were chosen from the logged caption/mascot regions and are
recorded in each JSON file. The visual counts describe semantic/editorial
events; the gate counts pixel-change bursts. They are not identical concepts.

| Video | Visual beats | Gate beats (error) | Visual median gap ms | Gate median (error ms) | Visual cuts | Gate cuts (error) |
|---|---:|---:|---:|---:|---:|---:|
| R1 | 235 | 430 (+195, +83%) | 630 | 367 (−263) | ~51 content cuts | 34 (not like-for-like) |
| R2 | 163 | 135 (−28, −17%) | 870 | 833 (−37) | 5 hard cuts | 13 (+8) |
| R3 | 156 | 144 (−12, −8%) | 600 | 667 (+67) | 31 hard cuts | 13 (−18) |
| R4 | 144 | 160 (+16, +11%) | 690 | 867 (+177) | 0 hard cuts | 18 (+18) |
| R5 | 202 | 460 (+258, +128%) | 633 | 333 (−300) | 0 true cuts | 35 (+35) |

R1's visual-log overview says 236 beats while its detailed reconciliation says
235 unique timestamps; this table uses 235. R1's 51 changes include content
scaffold cuts, some fades, so they are broader than the CLI's hard-cut definition.
R4's 8.33-second visual semantic gap contains non-semantic movement; it is not a
pixel-static hold. The large R1/R5 beat overcounts and R2/R4/R5 cut false
positives mean this detector is **not calibrated for an automatic quality gate**.

## Current render

Command (run with the NumPy-equipped TTS environment; the saved `ours.json`
used caption and mascot exclusion rectangles recorded in its JSON):

```powershell
C:\Repos\tts-venv\Scripts\python.exe C:\Repos\HFPipleine-codex\orchestrator\tools\pacing-gate\pacing_gate.py --video C:\Repos\HFPipleine\control-panel\data\renders\cs-b9d30fa7964c0cf0.mp4 --exclude-rect 0,0.6875,1,0.125 --exclude-rect 0,0.68,0.3,0.32
```

| Metric | Visual log | Gate | Error |
|---|---:|---:|---:|
| Beats | 37 | 41 | +4 (+11%) |
| Median gap | 1230 ms | 833 ms | −397 ms |
| Max semantic gap | not directly comparable | 5.47 s machine event gap | unscored |
| Time in gaps >2 s | 74% | saved JSON contains detector proxy | not a semantic comparison |
| Hard cuts | 9 | 8 | −1 |
| Empty-content frames | ~13.5% | 19.70% low-occupancy proxy | +6.2 pp; mask-sensitive |
| Max pixel-static hold | no visual target | see saved JSON | unscored |
| Digital silence, 20 ms windows below −60 dBFS | no visual target | 13.25% | unscored |
| Integrated loudness | no visual target | −16.0 LUFS | unscored |

The gate is relatively close on this one render but not consistently so across
references. Its 25%-cell cut rule misses sparse hard cuts and flags fades or
large in-place updates. Its modal-color occupancy proxy depends strongly on
mask geometry and does not classify the meaning of a visible element. The
field named `max_semantic_hold_s` in the current JSON is actually the longest
gap between machine onsets; it cannot establish a semantic hold. Use the JSON
as triage data and retain manual visual review for release decisions.

## Exclusion guidance

Rectangles are fractions of the **source frame**. Supply them per composition:
caption typically `0,0.74,1,0.08`, then a tightly fitted mascot rectangle
(its location and presence vary). The current-render run used one broad caption
mask `0,0.75,1,0.12`. This suppresses the caption but also removes nearby
diagram pixels, so counts change with mask choice. R2's mascot can occupy
roughly x=0–0.25/y=0.28–0.72; R3's is roughly x=0.05–0.22/y=0.40–0.72.
These are starting coordinates from the logs, not validated detector masks.
