# Motion graphics atlas — five references against the current HFPipleine render

This is an **inventory and comparison**, not an implementation plan. Source of timing and motion observations: the complete [R1](evidence/R1_DdEedoQM6j3.visual_log.md), [R2](evidence/R2_DdG-RuwsDRc.visual_log.md), [R3](evidence/R3_DdSc-I9IqNC.visual_log.md), [R4](evidence/R4_DdT5wzdsQWV.visual_log.md), [R5](evidence/R5_DdIM0QoiZre.visual_log.md), and [OURS](evidence/OURS.visual_log.md) beat and scaffold logs; synthesis in [MOTION_PACING_PLAN.md](../../MOTION_PACING_PLAN.md). The rows below account for **52 + 18 + 32 + 33 + 33 = 168 logged scaffold states**. A state is a sustained layout in the visual logs, not necessarily a unique graphic type. R2's S15b is included in its 18 layouts; R5's 33 scaffolds additionally contain 63 sub-states. Full beat-by-beat timings remain in the linked logs.

I cross-checked selected source frames: [R1 40.000 s](../reference-audit-20260919/ref1/dense/000320_f001200_040000.000ms.jpg) (four metric tiles, blank sparkline, changing counter), [R2 60.000 s](../reference-audit-20260919/ref2/dense/000480_f001800_060000.000ms.jpg) (users → router → two deployment cards), [R3 93.000 s](../reference-audit-20260919/ref3/dense/000744_f002790_093000.000ms.jpg) (two of three terminal cards present), [R4 109.000 s](../reference-audit-20260919/ref4/dense/000872_f003270_109000.000ms.jpg) (first four multipart cells in a fixed window), and [R5 43.000 s](../reference-audit-20260919/ref5/dense/000344_f001290_043000.000ms.jpg) (five source cards above entity nodes and a lower detail panel). These are spot checks, not an independent frame-by-frame re-audit. Durations and transition claims below come from the full visual logs and their 30 fps strips.

## How to read the tables

The `HF` column names the **nearest existing component shape**, keyed to real files and declared props below. It is not a claim that one component reproduces the reference. A `+` means a composite of components. `—` means no close single component identified. The `Ours` column uses the observed-render keys below; `U` means the reference graphic or behavior was **unobserved in our 70.2 s render**, even if a component exists in the library. Shared chrome/captions are described after the five inventories. Times are seconds of each reference, not our render.

### Component key: real registry props, with important limits

Each link targets the actual composition source; the named props are declared in its sibling `registry-item.json`. The names are intentionally selective but exact. The render in the OURS log exercises only a small subset of this library.

| Key | Component and actual props relevant to this comparison |
|---|---|
| `BW` | [browser-window](../../video-engine/compositions/components/browser-window/browser-window.html): `url`, `heading`, `row_count`, `accent`, `type_at`, `type_duration`, `content_at`, `duration`. A browser shell, not arbitrary checkout contents. |
| `NG` | [node-graph-diagram](../../video-engine/compositions/components/node-graph-diagram/node-graph-diagram.html): `nodes`, `edges`, `layout` (`row`/`branch`), `pulses`, `accent`, `reveal_at`, `edge_stagger`, `duration`. `pulses` entries have `{edgeIndex, at}` in source; node and edge reveals otherwise use a fixed stagger. |
| `RD` | [perspective-3d-road](../../video-engine/compositions/components/perspective-3d-road/perspective-3d-road.html): `blockRows`, `blocksPerRow`, `pulseOn`, `title`, `accent`, `reveal_at`, `title_at`, `duration`. A perspective road/block shape; no declared car traffic, skyline, gate, or selected-request props. |
| `PD` | [deployment-dashboard](../../video-engine/compositions/components/deployment-dashboard/deployment-dashboard.html): `leftLabel`, `rightLabel`, `leftVersion`, `rightVersion`, `leftLive`, `rightLive`, `leftInstances`, `rightInstances`, `leftTrafficPct`, `rightTrafficPct`, `showErrorChart`, `errorRatePct`, `errorChartTrend`, `showUsersFunnel`, `listenerLabel`, `reveal_at`, `switch_at`, `duration`. Closest to R2's carrier, but props describe a resolved state and one switch time, not a 125 s persistent carrier. |
| `SP` | [sparkline-metric](../../video-engine/compositions/components/sparkline-metric/sparkline-metric.html): `label`, `value`, `decimals`, `suffix`, `points`, `accent`, `reveal_at`, `draw_duration`, `duration`. |
| `KP` | [kpi-cluster](../../video-engine/compositions/components/kpi-cluster/kpi-cluster.html): `kpis`, `title`, `title_reveal_at`, `reveal_at`, `card_stagger`, `count_duration`, `duration`. |
| `GM` | [gauge-meter](../../video-engine/compositions/components/gauge-meter/gauge-meter.html): `label`, `min_value`, `max_value`, `target_value`, `unit`, `accent`, `reveal_at`, `sweep_duration`, `duration`. |
| `HM` | [heatmap-matrix](../../video-engine/compositions/components/heatmap-matrix/heatmap-matrix.html): `label`, `rows`, `cols`, `cells`, `accent`, `reveal_at`, `cell_stagger`, `duration`. |
| `QB` | [queue-backpressure](../../video-engine/compositions/components/queue-backpressure/queue-backpressure.html): `capacity`, `queue_label`, `start_at`, `item_interval`, `duration`. |
| `PS` | [particle-swarm](../../video-engine/compositions/components/particle-swarm/particle-swarm.html): `label`, `count`, `dotCount`, `seed`, `accent`, `reveal_at`, `count_at`, `duration`. No declared spiral or geography. |
| `WM` | [world-map-panel](../../video-engine/compositions/components/world-map-panel/world-map-panel.html): `title`, `points`, `reveal_at`, `point_stagger`, `duration`. |
| `TM` | [terminal-session](../../video-engine/compositions/components/terminal-session/terminal-session.html): `title`, `prompt`, `command`, `output_lines`, `type_at`, `output_at`, `line_stagger`, `accent`, `duration`. |
| `ID` | [ide-diff-panel](../../video-engine/compositions/components/ide-diff-panel/ide-diff-panel.html): `filename`, `lines`, `accent`, `reveal_at`, `line_stagger`, `duration`. |
| `FT` | [folder-tree](../../video-engine/compositions/components/folder-tree/folder-tree.html): `folders`, `accent`, `reveal_at`, `item_stagger`, `duration`. |
| `ST` | [step-list-card](../../video-engine/compositions/components/step-list-card/step-list-card.html): `title`, `steps`, `reveal_at`, `step_stagger`, `duration`. |
| `CL` | [checklist-progress](../../video-engine/compositions/components/checklist-progress/checklist-progress.html): `title`, `items`, `reveal_at`, `first_check_at`, `check_stagger`, `duration`. |
| `TL` | [timeline-milestones](../../video-engine/compositions/components/timeline-milestones/timeline-milestones.html): `title`, `milestones`, `accent`, `reveal_at`, `milestone_stagger`, `duration`. |
| `FN` | [fan-out-fan-in](../../video-engine/compositions/components/fan-out-fan-in/fan-out-fan-in.html): `worker_count`, `source_label`, `worker_label`, `sink_label`, `accent`, `fanout_at`, `fanin_at`, `duration`. |
| `BB` | [balance-beam](../../video-engine/compositions/components/balance-beam/balance-beam.html): `left_label`, `right_label`, `left_weight`, `right_weight`, `reveal_at`, `tilt_at`, `duration`. |
| `CS` | [client-server-exchange](../../video-engine/compositions/components/client-server-exchange/client-server-exchange.html): `client_label`, `server_label`, `request_label`, `response_label`, `accent`, `request_at`, `response_at`, `duration`. Two parties, not R4's four-node network. |
| `EP` | [etl-pipeline](../../video-engine/compositions/components/etl-pipeline/etl-pipeline.html): `extract_label`, `transform_label`, `load_label`, `data_label`, `accent`, `start_at`, `stage_duration`, `duration`. |
| `CT` | [content-panel](../../video-engine/compositions/components/content-panel/content-panel.html): `title`, `items`, `accent`, `reveal_at`, `item_stagger`, `duration`. Generic rows; no table-cell or schema operations. |
| `BS` | [big-stat-callout](../../video-engine/compositions/components/big-stat-callout/big-stat-callout.html): `context`, `value`, `caption`, `accent`, `context_at`, `reveal_at`, `caption_at`, `duration`. |
| `EH` | [eyebrow-headline-block](../../video-engine/compositions/components/eyebrow-headline-block/eyebrow-headline-block.html): `eyebrow`, `headline`, `accent`, `reveal_at`, `duration`. |
| `KH` | [keyword-highlighter](../../video-engine/compositions/components/keyword-highlighter/keyword-highlighter.html): `text`, `keywords`, `style`, `reveal_at`, `highlight_at`, `highlight_stagger`, `duration`. |
| `SN` | [segmented-tab-nav](../../video-engine/compositions/components/segmented-tab-nav/segmented-tab-nav.html): `tabs`, `contents`, `accent`, `start_at`, `switch_interval`, `duration`. |
| `FS` | [focus-spotlight](../../video-engine/compositions/components/focus-spotlight/focus-spotlight.html): `shape`, `x_pct`, `y_pct`, `size_pct`, `caption`, `show_caption`, `spotlight_at`, `caption_at`, `accent`, `duration`. A timed fixed-location spotlight; no declared blue-to-green travel path. |
| `CP` | [camera-push-transition](../../video-engine/compositions/components/camera-push-transition/camera-push-transition.html): `before_title`, `before_subtitle`, `after_title`, `after_subtitle`, `accent`, `push_at`, `duration`. Its declared content is a before/after title transition, not a camera transform over an arbitrary assembled diagram. |
| `PP` | [progress-split-bar](../../video-engine/compositions/components/progress-split-bar/progress-split-bar.html): `title`, `segments`, `reveal_at`, `grow_duration`, `duration`. |
| `SS` | [status-pill](../../video-engine/compositions/components/status-pill/status-pill.html): `text`, `state`, `show_dot`, `pulse`, `x_pct`, `y_pct`, `reveal_at`, `duration`. A pill, not a persistent status model. |
| `MP` | [media-frame](../../video-engine/compositions/components/media-frame/media-frame.html): `label`, `media_type`, `caption`, `show_caption`, `reveal_at`, `caption_at`, `accent`, `duration`. No actual reference photograph is bundled by this mapping. |
| `SQ` | [scanline-reveal](../../video-engine/compositions/components/scanline-reveal/scanline-reveal.html): `before_title`, `before_subtitle`, `after_title`, `after_subtitle`, `direction`, `accent`, `sweep_at`, `sweep_duration`, `duration`. |
| `TA` | [takeaway-banner](../../video-engine/compositions/components/takeaway-banner/takeaway-banner.html): `text`, `accent`, `bar_at`, `reveal_at`, `duration`. |

### Observed-render comparison key

| Key | Exactly what OURS shows |
|---|---|
| `O-T` | 0.67–6.73 title/body card; body only at 5.50; another dim title 55.23–57.97; wipe/title 57.97–62.60; takeaway only at 65.63. No staged panel mutations through a sustained scaffold. |
| `O-K` | 6.90–13.13 paragraph; keywords reveal by marker wipe at 9.83–10.33, with blank slots before then. |
| `O-P` | 13.77 problem card, 18.63 solution card; problem holds 4.73 s before second card. |
| `O-N` | 21.67–22.50 three linked-list nodes and edges build, then pixel-identical through 27.43. |
| `O-S` | 27.43–34.30 five-step line; labels are present by 27.73, steps switch every 500 ms at 30.50–32.50, then hold. |
| `O-B` | 35.20 context, 35.97 O(N), 40.75 footnote; 36.10–40.75 frozen. |
| `O-D` | 43.30–44.40 dot swarm, 47.23 counter card, 47.27–48.27 count to 100,000; near-hold in between. |
| `O-G` | 50.43–51.30 gauge fills to 100%, then pixel-identical to 55.13. |
| `O-X` | 57.97–58.37 light-bar title wipe; titles overlap 58.10–58.23. |
| `U` | Closest reference graphic/mechanic **not observed** in this render. Do not infer absence from the library. |

## R1 — DDoS: 52 states, roughly 20 graphic families

Persistent near-black canvas, thin top origin/status HUD, left mascot when the layout allows it, caption box low in frame. Most content changes are one-frame cuts inside that persistent frame; incoming items fade in 67–130 ms. Cyan is normal/real, red attack/error, amber degradation, purple botnet. The road world reappears across 15 states. `Road` below denotes that repeated family, not an existing HFPipleine road with all its behaviors.

| # / time | Graphic family and observed state mechanics (arrive → mutate → leave/continuity) | HF | Ours |
|---|---|---|---|
| 1 · 0–7.10 | Browser product grid fades in; loading rows light, refresh blanks page, latency/status flips, “HACKED?” gets struck; browser shrinks into next road. | BW+SS | U |
| 2 · 7.10–9.20 | Red-car perspective road and skyline reveal under shrunken browser; one car gets `GET /`; HUD goes offline. | RD+BW | U |
| 3 · 9.20–10.50 | Road dims on hard cut, mascot punches larger; “A DDOS ATTACK” fades and red underline draws; cut returns to road. | EH+RD | O-T (title only) |
| 4 · 10.50–13.35 | Road with selected cyan “YOU” car; red barrier draws across lane; cars/skyline fade out. | RD+NG | U |
| 5 · 13.35–14.85 | Empty road outline, traffic-jam headline and light sweep; HUD resets for normal-state rebuild. | RD+EH | U |
| 6 · 14.85–27.95 | Road/skyline/gate persist: cyan cars flow, log rows tick, red cars flood, on-ramp counter runs 8,211→400,000, gate turns amber. | RD+KP+CT | O-N (nodes build, then freeze) |
| 7 · 28–30.75 | Cut closer to one cyan car, 1.25 s push-in, selection rectangle and request-latency counter, then pull back. | RD+BS+CP | U |
| 8 · 30.75–33.85 | Road receives failed-browser card and HTTP request panel; HUD flips offline; cards vanish on cut. | RD+BW+CT | U |
| 9 · 33.85–35.50 | Wide red road and skyline; blocked gate/barrier called out, then content clears. | RD+SS | U |
| 10 · 35.50–39.80 | Healthy metrics: four dim tiles populate, sparkline draws, 1,000 req/s counts, bars fill, HEALTHY pill pops. | KP+SP+SS | O-G (one gauge, no dashboard) |
| 11 · 39.83–43.45 | Same metric layout flips cyan→amber in one frame; mascot punches; requests accelerate to 1M, chart redraws red, 5M display replaces panel. | KP+SP+BS | O-G (no state swap) |
| 12 · 43.50–46.20 | “Machine fills up” paired network/processor cards; red bars fill 0/37→100% on words, mascot removed. | GM+KP | O-G (single sweep) |
| 13 · 46.25–48.10 | 60-cell connection grid fills red; queue counter/bar grows separately; cut. | HM+QB | U |
| 14 · 48.13–50.85 | Access log: cyan user icon then red 503/504 rows stagger; timeout row singled out. | CT+ST | U |
| 15 · 50.88–53.70 | Empty road/dashed verticals plus purple `[D]DoS` and `DISTRIBUTED` typographic breakdown. | RD+EH | O-T (headline only) |
| 16 · 53.75–55.45 | Attacker laptop card connects to low-load origin; attacker reddens and X negates single-source claim. | NG+CT | U |
| 17 · 55.50–59.85 | Purple dots and device counter appear, reorganize into continuously rotating botnet spiral; outline/title enclose it. | PS+BS | O-D (swarm/count, no spiral) |
| 18 · 59.88–62.20 | Three dim device cards light individually on “computers/routers/cameras”; cut after sequence. | CT | O-S (fixed-clock five steps) |
| 19 · 62.25–64.60 | World map fades; purple points populate alongside compromised-device count. | WM+PS | U |
| 20 · 64.63–66.85 | Map dims but persists as backdrop; router and “online/no alerts” card pop, dashed link draws. | WM+NG+SS | U |
| 21 · 66.88–71.35 | C2 terminal types command over returning swarm; shockwave expands and dots brighten. | TM+PS | O-D (dots only) |
| 22 · 71.38–73.20 | One IP-camera card links to origin-load card; small baseline load. | NG+GM | O-N (different topology) |
| 23 · 73.25–76.60 | Camera replaced by 100k-device swarm; dots spiral and load rises 793→2,000% red. | PS+GM+BS | O-D (counter ends, no load transition) |
| 24 · 76.63–78.70 | Three attack-type tabs arrive, road outline below; next state selects first tab. | SN+RD | O-S (stepper, different content) |
| 25 · 78.75–80.20 | BANDWIDTH tab amber; category headline takes content slot. | SN+EH | O-T (no tab continuity) |
| 26 · 80.25–84.95 | Uplink pipe has capacity bracket, cyan fill, then 1-frame red overflow state and huge “200 Gb/s”. | PP+BS | O-G (single fill, no overflow swap) |
| 27 · 85–88.20 | Close red road holds; capacity/arrival stats panel slides in beside it. | RD+KP | U |
| 28 · 88.25–90.95 | Pull back to packed road and city gate; mascot absent, amber “jam here” marker. | RD+SS | U |
| 29 · 91–92.70 | CONNECTIONS tab lights; category headline replaces pipe/road. | SN+EH | O-T (no tab continuity) |
| 30 · 92.75–98.70 | 100-slot grid: scattered cyan occupancy, then red flood 18→100, “NO SLOT” by stranded user. | HM+BS | U |
| 31 · 98.75–100.85 | APPLICATION LAYER tab and route list set up third attack mode. | SN+CT | O-S (stepper only) |
| 32 · 100.88–104.70 | Legit/malicious request cards compare; one card swaps to packets, gets crossed out, returns; “PATH EXPENSIVE” tag. | CT+KH | O-P (pair, no internal swaps) |
| 33 · 104.75–107.55 | Route/cost/rate table rows stagger; `/search` rate grows into red 40,000/s callout. | CT+BS | U |
| 34 · 107.63–111.85 | One-request pill fans six curves to DB icons, computation counter/bar fills, mini explanation types. | FN+KP+TM | O-N (edges only) |
| 35 · 111.88–115.85 | Seesaw loads attacker bytes against server CPU cost, tilts, then “NOTHING VS A LOT” text lands. | BB+BS | U |
| 36 · 115.88–120.60 | Survival heading → road and skyline → rule card; red cars return, origin outlined. | RD+CT | U |
| 37 · 120.63–125.20 | Cloudflare/AWS/CDN tiles arrive individually; map PoPs light; box groups logos. Brand-specific assets are not implied by HF key. | CT+WM | U |
| 38 · 125.25–128.10 | Origin/edge/internet stack: 12 PoP boxes stagger, links converge, 280 Tb/s vs 10 Gb/s bar. | NG+PP | U |
| 39 · 128.13–131.10 | Road and red cars return; cyan EDGE barrier grows, absorption chart spikes, origin-load pill stays green. | RD+SP+SS | U |
| 40 · 131.13–134.20 | Zoomed road filters red cars into cyan; dropped and forwarded counters run separately. | RD+KP | U |
| 41 · 134.25–135.70 | Rate-limiter icon/title; red light flips cyan with “one at a time”. | SS+EH | U |
| 42 · 135.75–139.85 | Source/rate/action table: rows stagger, one rate ticks 100→9,480→100→0; row moves amber→red. | CT+KP | U |
| 43 · 139.88–141.85 | Blocked-IP pills pop one by one; blocklist counter rises 17→41. | SS+KP | U |
| 44 · 141.88–144.60 | Distinct-source address matrix fills red by row while total climbs to 1.24M; blocklist stays tiny. | HM+KP | U |
| 45 · 144.63–153.60 | Six signal rows build; values/recolors raise bot-score bar; HUMAN? turns red, tilted BOT stamp lands, HUMAN pill remains. | CT+PP+SS | O-S (progressive steps, no scored row state) |
| 46 · 153.63–154.85 | “HARDEST PART” brief large-title separator; cut to two charts. | EH | O-T |
| 47 · 154.88–157.60 | Two S-curves draw sequentially; upper curve recolors red with attack tag. | SP+SP | U |
| 48 · 157.63–161.85 | Ticket browser countdown, cyan road demand, real-demand chart spike; visuals accumulate until cut. | BW+RD+SP | U |
| 49 · 161.88–164.20 | Naive rule card above road; cars disappear, rule gets struck, real-customer tag exposes false positive. | CT+KH+RD | O-K (marker highlight, not rule reversal) |
| 50 · 164.25–168.20 | Mixed cyan/red traffic continues; uncertain cars amber, sorting-error panel and decision budget appear. | RD+KP | U |
| 51 · 168.25–170 | Difficulty title plus confidence pill; confidence number jitters through several values. | EH+SS | O-T (no live value) |
| 52 · 170–176.87 | “HACKED?” negated by intact origin; road/gate and user car return; final “THEY BLOCK THE ROAD” headline, 500 ms fade black. | RD+SS+EH | O-T (static takeaway) |

## R2 — blue/green deployment: 18 layouts on one long-lived carrier

Near-black frame, stable semantic blue/green environments, purple router/DB, orange servers, red errors, amber version emphasis. From roughly 5.9–131 s, router plus BLUE/GREEN cards are the lower carrier; the upper slot swaps among users, browser, console, chart, SQL, and headlines. Layouts below follow the visual log's S1–S17 plus S15b. Entrances are usually 100–133 ms; hard cuts/reframes are exceptions noted in rows. Components `PD` and `BW` approximate separate pieces; neither declares this carrier/slot continuity.

| State / time | Graphic family and observed mechanics | HF | Ours |
|---|---|---|---|
| S1 · 0–1.68 | Blue and green environment cards tint in separately; DEPLOYMENT label brightens; hard cut. | PD+EH | U |
| S2 · 1.68–5.25 | Browser product grid, orange deploy pill, page darkens then red 503 replaces it on black snap. Mascot slides in. | BW+SS | U |
| S3 · 5.25–8.25 | HUD, shrunken browser, Env A/B and router assemble in place; top slot becomes users. | PD+BW | U |
| S4 · 8.25–18.38 | Production card duplicates to BLUE/GREEN; each tint lands on spoken name; router shows 100/0, LIVE routes blue, dotted user flow pulses. | PD | U |
| S5 · 18.38–31.75 | Browser occupies top slot; product→checkout→new checkout swaps; v2 pill physically travels through router into BLUE, rows/version update. | PD+BW | U |
| S6 · 31.75–39.63 | Users return; 500 banner and nine users redden, error % ticks; reset then v2 pill travels into GREEN and ready rows light. | PD+KP | U |
| S7 · 39.63–54.50 | Test console takes top slot; bypass line to green, checks/200 rows arrive individually; FAILED dims green, then checklist reruns. | PD+TM+CL | U |
| S8 · 54.50–57.50 | Green ready under unchanged carrier; “important moment” label; full diagram dims and mascot exits for reframe. | PD+EH | U |
| S9 · 57.50–66 | Hard zoomed reframe, cards fill width; “deploy again” struck, “switch traffic” headline, lever moves 100/0→0/100, LIVE tag shifts; downtime stat. | PD+KH+BS | U |
| S10 · 66–75.60 | Zoom out; mascot/chart upper slot. Clock ticks, line turns orange then red; 18% lands; rollback build/deploy options get crossed out. | PD+SP+KH | U |
| S11 · 75.60–83.88 | Hard zoomed reframe; known-good BLUE card relights; lever returns traffic and chart/error line falls; one-routing-change panel. | PD+SP | U |
| S12 · 83.88–101.75 | Carrier compacts upward; purple orders DB/SQL panel below; field rename breaks old BLUE after instant rollback; both columns added as compatibility fix. | PD+CT+TM | U |
| S13 · 101.75–113.88 | Expand/contract four-tab bar replaces carrier; DB/table and SQL typewriter advance ADD→RUN BOTH→MIGRATE→REMOVE; row counter and collapse. | SN+CT+TM | O-S (stepper only; no table edits) |
| S14 · 113.88–128.38 | Router/cards/users return; canary ticks 5/25/50/100, traffic counters rise in stages over flat chart, final HUD flips GREEN. | PD+SP | U |
| S15 · 128.38–129.90 | Topology resets to blue and “picture it like this” label, preparing stage metaphor. | PD+EH | U |
| S15b · 129.90–131.50 | 430 ms camera push enlarges and recenters two cards while users/router fade; mascot then exits. | PD+CP | U |
| S16 · 131.50–142.13 | Stage spotlight/audience reuses blue/green cards; cone shifts blue→green then back, counters follow, error flashes red. | PD+FS+SS | U |
| S17 · 142.13–145.60 | Hard jump: cards reposition, “ONE LIVE / ONE READY” type and underline form final two-state graphic; fade black. | PD+EH | O-T (headline only) |

## R3 — git worktrees: 32 numbered content cuts, six main templates

Off-white background; header/scene index, left mascot and captions persist. Every numbered scene starts on a sentence onset with a one-frame content cut, its first card fading on the next frame. Cards and connectors **accumulate without exit motion** until the next cut. Main/branch colors stay blue/purple/green/amber. `T` repository bracket, `V` two-card vertical, `W` terminal/editor window, `S` stacked cards, `G` graph, and `O` object chips are the log's type tags; S04 is a file tree. The reference's window styling and red bracket grammar are graphic design details, not promised by HF mappings.

| Scene / time | Type; observed build or state mechanics | HF | Ours |
|---|---|---|---|
| 01 · 0–1.53 | T: repository card → app card → red bracket stubs/trunk → auth card. | FT+NG | O-N (three nodes, no repo bracket) |
| 02 · 1.53–3.40 | V: Git DB then working-tree card; vertical connector draws 2.30–2.70. | NG | O-N (horizontal list) |
| 03 · 3.40–7.03 | G: six commit nodes appear, main line draws, branch curve and label follow. | NG | O-N (simple chain) |
| 04 · 7.03–10.10 | File tree: five path rows stagger, one file pill then annotation. | FT | U |
| 05 · 10.10–14.40 | T: repository/bracket/app rebuild from empty, then next-task callout. | FT+NG | O-N (no rebuild across scenes) |
| 06 · 14.40–19 | W terminal: `git switch` types, green output; app card changes branch label. | TM+FT | U |
| 07 · 19–22.60 | S: main and auth cards arrive, then “at same time?” display type. | CT+BS | O-P (two cards, different relation) |
| 08 · 22.60–25.90 | S: branch-switch pill strip, full-clone card, red correction annotation. | CT+SS | U |
| 09 · 25.90–32.50 | W terminal: long worktree command types over ~1.6 s; output, auth card, connector annotation. | TM+FT | U |
| 10 · 32.50–36.93 | S: app card, green checked strip plus auth card, then second check. | CT+CL | O-P (two cards only) |
| 11 · 36.93–39.67 | T: repository, bracket, app, auth rebuild quickly then hold. | FT+NG | O-N (no repeated template) |
| 12 · 39.67–45.60 | S: auth, billing, dashboard folder cards accumulate in branch colors. | FT+CT | O-N (three nodes, different content) |
| 13 · 45.60–49.80 | T: shared repo bracket with three branch folder cards, each added separately. | FT+NG | O-N (nodes, no shared bracket) |
| 14 · 49.80–54.75 | O: shared `.git/objects` card; six hash chips stagger; auth/billing cards connect to chips. | NG+CT | U |
| 15 · 54.75–59.77 | S: shared data card, local metadata card, HEAD/index rows and annotation. | CT+FT | U |
| 16 · 59.77–63.27 | S bars: three full clones vs linked worktrees; bar lengths are visible but fade in rather than grow. | CT+PP | U |
| 17 · 63.27–68.60 | S: three dependency cards; disk blocks recolor together, usage label appears. | CT+HM | U |
| 18 · 68.60–73.37 | W VS Code: code lines stagger; feature-progress and interruption callouts. | ID | U |
| 19 · 73.37–75.80 | W VS Code: four lines retype while red production alert pops. | ID+SS | U |
| 20 · 75.80–79.75 | W terminal + checklist: `git stash` types; numbered stash/switch/fix/restore items add. | TM+CL | O-S (fixed-clock process only) |
| 21 · 79.75–84.03 | S: untouched feature and hotfix folder cards, green status strip and explanatory annotation. | FT+CT | O-P (two cards) |
| 22 · 84.03–86.27 | W VS Code: hotfix complete status, previous code lines restore. | ID+SS | U |
| 23 · 86.27–91.40 | W Claude Code terminal: prompt types, working indicator, then three-session card. | TM+CT | U |
| 24 · 91.40–95.30 | S / three terminal cards: each agent's command and edit line appear in a rapid nine-beat build. | TM+CT | O-S (five steps, no parallel terminals) |
| 25 · 95.30–100.10 | W VS Code: code and three colored agent cursors; cursors move every frame through hold, conflict callout. | ID | U |
| 26 · 100.10–106.13 | T: repository/bracket with three agent-specific worktree cards; one card per beat. | FT+NG | O-N (nodes only) |
| 27 · 106.13–109.13 | S / three terminals: tests and colored progress bars, then pass/commit rows stagger. | TM+CL | O-S (steps, no concurrent progress) |
| 28 · 109.13–111.37 | G merge: three colored branch curves draw into one dot, then combined main card. | NG | O-N (simple edges) |
| 29 · 111.37–116.27 | S diff: conflict marker lines and two competing values reveal row by row, red resolution note. | ID+CT | U |
| 30 · 116.27–122.90 | T: repository/bracket and three editable folder cards rebuild; longest 4.02 s end hold. | FT+NG | O-N (4.93 s frozen hold at 22.50) |
| 31 · 122.90–129.27 | V: branches card → downward arrow → worktrees card; one-repo/many-dirs annotation. | NG+CT | O-N (different topology) |
| 32 · 129.27–134.53 | W terminal: removal command types; output then optional branch deletion card and final annotation. | TM+CT | U |

## R4 — file upload service: 33 crossfaded scaffolds

Warm off-white background, fixed “SYSTEM DESIGN / FILE SERVICES” header and three-dot version stepper, left mascot, footnote rule and caption. Every scaffold change is approximately **150 ms opacity crossfade with 2–6 px rise**; the content enters while prior content dissolves. A packet travels on active connectors in an approximately 1.6 s loop; this ambient process motion is not counted as a new discrete beat. The four-node My files / API / Metadata / S3 diagram is reused in states 12, 15, 20–23, 27–29, 31–32. Each copy crossfades in and redraws the relevant connector; it is a recognizable repeated template, not a continuous DOM object. Blue means bytes, purple metadata, green permission/URL, red bottleneck or failure.

| # / time | Graphic family and observed mechanics | HF | Ours |
|---|---|---|---|
| 1 · 0–4.13 | Single Google Drive-style window; MP4 icon appears after frame/header fade. | BW+MP | U |
| 2 · 4.13–11.37 | Two stacked upload/backend windows; connector changes grey→blue, MP4 slides along it and shrinks to packet. | CS+BW | U |
| 3 · 11.37–15.13 | Version 1: browser/API/Postgres graph, upload bar fills, bytes packet starts; elbow line recolors/draws to DB. | NG+PP | O-N (nodes/edges, no packet loop) |
| 4 · 15.13–17.13 | POST `/uploads` request window; verification rows fade/rise, authenticated-user box. | BW+CL | U |
| 5 · 17.13–20 | Metadata key/value window: name, size, type, owner rows arrive ~0.4 s apart; MP4 icon pops. | CT+BW | U |
| 6 · 20–26.25 | SQL `file_bytes BYTEA` window, INSERT text, red cost warning, grey operational note accumulate. | TM+CT | U |
| 7 · 26.25–29.10 | SELECT query then two result rows; hard content remains until next crossfade. | TM+CT | U |
| 8 · 29.10–34.10 | Big blue “Big bytes.” replaces window; three MP4 icons pop separately, red cost strip. | BS+CT | O-B (big stat only) |
| 9 · 34.10–37.23 | Version 2: Postgres and S3 windows stacked; purple `object_key` link draws and key packet loops. | NG+CS | O-N (edge no loop) |
| 10 · 37.23–42.63 | Metadata table window: nine named rows land roughly 375 ms apart; pending→ready status. | CT | U |
| 11 · 42.63–45.47 | S3 bucket window, block-public-access chip and file icon fading into bucket. | BW+SS | U |
| 12 · 45.47–50.67 | Four-node diagram: upload progress, then purple metadata elbow, then blue S3 elbow; packets loop on lines. | NG+PP | O-N (one edge draw then freeze) |
| 13 · 50.67–60.33 | Three-node bottleneck diagram and “5 GB”; browser→API and API→S3 connectors draw, red outbound warning. | NG+BS | O-N (static after build) |
| 14 · 60.33–66.67 | Red “API load ↑” display, four cost rows and full-width bars arrive about a second apart. | BS+CT | O-B (single number) |
| 15 · 66.67–69.27 | Version 3: four-node template redraws green POST, purple metadata, blue PUT links; packets animate. | NG | O-N (simple chain) |
| 16 · 69.27–72.40 | JSON request window and “small JSON” box; grey note says video stays in browser. | TM+CT | U |
| 17 · 72.40–78.73 | Checklist window with four permission/type/quota rows, each a spoken beat; final quota note. | CL | O-S (steps on clock) |
| 18 · 78.73–82.43 | Pre-signed URL ticket window: bucket, key, expiry, signed URL rows sequential. | CT+BW | U |
| 19 · 82.43–87.07 | Same ticket structure re-enters, “scoped/time-limited” chip and four rows rebuild. | CT+SS | U |
| 20 · 87.07–90.43 | Four-node diagram: permission-check elbow API→Metadata draws; packets follow. | NG | O-N (no reused diagram) |
| 21 · 90.43–92.77 | Fresh four-node diagram: green URL connector API→browser draws and carries packet. | NG | O-N (edge draw, no state reuse) |
| 22 · 92.77–97.63 | Fresh diagram: long blue direct browser→S3 PUT path already drawn; packet motion continues during hold. | NG | O-N (frozen hold) |
| 23 · 97.63–100.73 | Fresh diagram: green completion/HEAD then purple `status=ready` connector and packet. | NG | O-N (no multi-route mutation) |
| 24 · 100.73–107.53 | “20 GB / 99%” window: bar fills ~1.9 s then interruption and whole-file retry warning. | BS+PP | O-G (one fill, no interruption) |
| 25 · 107.53–115.10 | S3 multipart window: 4×3 numbered chunk cells pop every ~250 ms, final parallel/ETag note. | HM+CT | O-S (five fixed-clock steps) |
| 26 · 115.10–121.30 | Chunk grid rebuilt; part 07 goes red→green on retry, then 12 cells collapse into one S3 object card. | HM+CT | U |
| 27 · 121.30–127.10 | Four-node download diagram: file-ID and read-permission links draw; packets loop. | NG | O-N (no diagram replay) |
| 28 · 127.10–134.20 | Same diagram re-enters: GET URL link, then blue S3→browser path and packet. | NG | O-N (no route swap) |
| 29 · 134.20–137.63 | Same diagram re-enters with only direct blue bytes path, removing API from payload route. | NG | O-N (no simplification state) |
| 30 · 137.63–145.53 | S3 origin branches to EU/US/APAC edge cache windows; branches draw one by one with packets. | FN+NG | U |
| 31 · 145.53–151.73 | Final four-node architecture replay: green POST, purple metadata and blue PUT redraw on words. | NG | O-N (one chain) |
| 32 · 151.73–162.73 | Same diagram again; links reset/redraw, then long hold stays alive via packets and mascot blinks. | NG | O-N (pixel-identical 4.93 s hold) |
| 33 · 162.73–169.67 | Closing “API = who + what / S3 = bytes” pills, Postgres/S3 icons, final note. | SS+TA | O-T (single takeaway) |

## R5 — Palantir ontology: 33 scaffolds with 63 sub-states

Dark grid, 10-segment chapter HUD, lower-left mascot and caption persist. Changes between scaffolds and most sub-states are **one-frame content swaps**; the five agency/manufacturer source tiles survive many changes underneath them. Individual object nodes light on spoken nouns; small monospace labels often arrive 0.5–1.5 s after a primary beat. Photos are static cards without a Ken Burns move. Teal usually marks linked/active structure, amber the AIP/decision emphasis, pink entity links. The row descriptions name representative sub-state changes; [R5's full beat log](evidence/R5_DdIM0QoiZre.visual_log.md) contains all 202 beat times. `MP` is only the nearest media-frame shape; actual photos, logos and branded character are separate assets with rights unknown.

| # / time | Graphic family and observed mechanics | HF | Ours |
|---|---|---|---|
| 1 · 0–2 | Five-system node map and logo; curves draw, logo metadata labels land after mascot entrance. | NG+CT | O-N (three nodes, no logo layer) |
| 2 · 2–11.38 | Dimmed map holds while five “what people say” chips stack; swap to three stamped adjectives, collapse to pill row, question box pulses. | CT+SS+EH | O-T (no serial swaps) |
| 3 · 11.38–12.50 | “One organisation / start here” card clears previous chips and question box. | EH+CT | O-T |
| 4 · 12.50–14.75 | Chapter 2 timeline, facts and three founder photos; one photo highlights, 2003 marker arrives. | TL+MP | U |
| 5 · 14.75–16.25 | Paragraph → big serif “ONE PROBLEM” → monospace sublabel in empty content box. | EH+CT | O-T (body arrives late, no 3-beat ladder) |
| 6 · 16.25–21.93 | Data grid fills diagonally, then splits into five offset system blocks and labels. | HM+CT | U |
| 7 · 21.93–23.77 | Full-width Pentagon photo replaces grid; mascot temporarily absent. | MP | U |
| 8 · 23.77–52.57 | Persistent five-source row through 12 lower-box sub-states: tiles light individually, DB icons, negated “lack of data,” detective-wall photo/string cards, then person/place/event/document/vehicle nodes and analyst investigation links. | CT+NG+MP | O-N (small graph, no persistent source row) |
| 9 · 52.57–55.87 | Agency→manufacturer comparison: top five-card row pushes left/right over 570 ms; teal same-problem pill. | CT+SS | U |
| 10 · 55.87–57.25 | Full-width factory photo and highlighted “one per function” value; mascot absent. | MP | U |
| 11 · 57.25–72.97 | Persistent manufacturer five-card row; photos/data rows → separate DB cylinders → FOUNDRY bar → connected badges → object/action rows, with hard lower-box swaps. | CT+NG+EP | U |
| 12 · 72.97–78.37 | Foundry/Gotham two-column comparison; columns light one at a time; common model label and government pill. | CT+SS | O-P (two cards, no sequential semantic columns) |
| 13 · 78.37–81.62 | Ontology question box pulses, clears; serif title and explanatory sublabel replace it. | EH+CT | O-T (title transition only) |
| 14 · 81.62–87.53 | Raw rows arrow to meaning box, then database table/cell 847 singled out and “a number” label. | CT+NG | U |
| 15 · 87.53–94.97 | FACTORY A object card brightens, then object graph links it to products, orders and shipments one edge at a time. | NG+CT | O-N (three-node static chain after build) |
| 16 · 94.97–97.23 | “NOT THIS” raw table; strike line across it with “people do not think in tables.” | CT+KH | O-K (highlight, not negation) |
| 17 · 97.23–100.50 | Full objects/relationships graph replaces table; explanatory mono tag lands late. | NG | O-N (different graph) |
| 18 · 100.50–103.77 | Palantir/customer cards, engineer icon travels with trail; cards shrink into top strip before “FDE” title. | CS+EH | U |
| 19 · 103.77–107.13 | Static engineer photo card and WHERE/WITH/ON table; rows highlight individually. | MP+CT | U |
| 20 · 107.13–111.77 | Customer operations chips connect; workflow steps light; question types on with late-delivery panel. | NG+ST+TM | O-S (steps only) |
| 21 · 111.77–113.37 | AIP base bar; amber LANGUAGE MODEL chip drops on top, label follows. | PP+SS | U |
| 22 · 113.37–116.37 | 2003→2023 timeline draws; dashed slot fills with AIP box. | TL | O-S (stepper but no dated timeline) |
| 23 · 116.37–118.27 | A/I/P three tiles light in order, with label panel. | CT | O-S (sequential steps) |
| 24 · 118.27–119.63 | Model-answers versus company-asks two-card comparison and cursor panel. | CT+TM | O-P (two cards, no cursor) |
| 25 · 119.63–122.30 | Isolated LANGUAGE MODEL chip; four dangling unplugged stubs drop, late “nothing plugged in” label. | NG+SS | U |
| 26 · 122.30–128.50 | “NOT THIS” prompt pill struck; hard swap to “THIS” amber prompt box; actual question types over three speech-matched chunks and sources table. | KH+TM+CT | O-K (marker wipe, no replacement/typing) |
| 27 · 128.50–130.62 | “WHY?” and “WHAT SHOULD WE DO?” boxes arrive separately, label beneath. | CT | O-P (two cards, different mechanic) |
| 28 · 130.62–136.87 | Question bar and four-layer stack; amber AIP layer drops on top, mono labels extend the hold. | CT+EP | U |
| 29 · 136.87–138.47 | Ranked Plant A/D/C answer rows light amber, amber, teal sequentially. | CT | O-S (steps with arbitrary palette) |
| 30 · 138.47–141.27 | THE DATA circle gains dashed access ring and role chips; analyst lights, everyone-else label follows. | NG+SS | U |
| 31 · 141.27–143.17 | Chapter 10 manufacturer source row, four-step teal pipeline, logo and sublabel. | EP+CT | U |
| 32 · 143.17–147.10 | Two “what it is not” bars; each gets a separate 267 ms strike-through. | CT+KH | O-K (highlight, no strike) |
| 33 · 147.10–164.90 | Manufacturer row persists across recap swaps: data grid splits, pipeline lights, stack layers light, decision card, grid/nodes return, teal links draw and snap into one row under final serif title. | HM+EP+NG+EH | O-T (static final title) |

## Repeated signatures, closest matches, and gaps

| Signature primitive seen in references | Where it repeats | Closest HF surface | What the OURS render establishes |
|---|---|---|---|
| Persistent chrome around replaceable content | All five; R3 32 cuts, R5 62 swaps | `chapter-shell` exists with `breadcrumb`, `currentStep`, `totalSteps`, `headline`, `subtitle`, `reveal_at`, `content_at`, `duration` [source](../../video-engine/compositions/components/chapter-shell/chapter-shell.html); the current render's outer chrome is assembled separately by `composeHtml.js`. | HUD/mascot persist, but 13.13–13.77, 20–21.67, 42–43.30 and 62.60–65.63 are empty/near-empty content spans. |
| One scaffold with changing upper/lower slot | R2 router/cards ~5.9–131; R5 five-tile rows ~23.77–52.57 and 57.25–72.97; R4 repeated diagram | `PD`, `NG`, `CT` are shapes, with scene-scoped timing props. | No retained content scaffold across scenes; `O-N` builds then disappears at 27.43. R4 explicitly redraws a fresh diagram each crossfade, so its continuity is visual/template continuity. |
| Word-by-word object lighting and edge redraw | R1 device cards/attack modes, R3 folders, R4 routes, R5 sources/entities | `NG` nodes/edges, `CL` items, `CT` items; most expose a reveal start plus a stagger. | `O-S` steps run at fixed 500 ms; `O-N` nodes precede “linked list” by ~4.2 s per plan; no per-item spoken-word anchor observed. |
| Live semantic process motion | R1 cars/counters, R2 traffic lever/chart, R3 typing/cursors, R4 packet loops, R5 delayed labels | `RD` has `pulseOn`; `NG` declares timed `pulses`; `TM` types; `SP` draws. | `O-N` 22.50–27.43 and `O-G` 51.30–55.13 are pixel-identical; mascot stays frozen after 0.43. |
| State-semantic color held across a story | R1 cyan/red/amber/purple; R2 blue/green/purple; R3 branch colors; R4 route colors; R5 teal/amber | Components expose individual `accent`, `statusColor` in `NG.nodes`, and some state props; no single cross-scene entity palette prop was identified. | Our median hue count is already comparable; `O-S` uses five colors for five ordered steps, while reference color usually identifies a stable actor or route. |
| Negation/correction in place | R1 HACKED?, request/rule, R2 deploy/rollback, R5 raw table/prompts/two business claims | `KH` supports highlighting, `SS` status; no dedicated declared strike-through prop found among keyed components. | `O-K` highlights terms at 9.83/10.13; strike-through reversal unobserved. |
| Tables and window interiors that mutate by cell/row | R1 source rates, R2 SQL schema, R3 editor/terminal, R4 metadata/tickets, R5 DB/object rows | `CT`, `TM`, `ID`, `BW` are approximate; `CT` only declares `items` and `item_stagger`. | No table, schema, cursor or mutable window interior appears in OURS. |
| Reference-specific imagery/character | R3/R4 illustrated mascot, R5 still photos and character, R1/R2 same illustrated presenter | `MP` approximates a framed media object. | OURS has a frozen SpongeBob sticker. Originality and usage rights of reference assets are unknown; this atlas does not recommend copying them. |

### Shared motion and caption layer

R1/R2/R3/R5 chiefly use one-frame content swaps or hard cuts; R4 uses a ~150 ms crossfade. Arrivals across references are usually a short opacity rise/fade (roughly 66–200 ms), line draws and counters get their own timing, and most graphics have no exit animation beyond the enclosing swap. R3 explicitly keeps each newly built element until its cut. R2 is the exception for deliberate mascot exits, routing lever travel and one camera push. R1 has a road zoom/push; R3/R4/R5 have no camera movement. The reference caption pills highlight the active word; their detailed text/chunk timings are in the visual logs. OURS has 133–200 ms onscreen entrances after 1.8× speed-up, so entrance duration alone is not its graphics deficit. It lacks the many in-scaffold mutations and live holds shown above.

No production component, pipeline file, or reference asset was modified for this atlas.
