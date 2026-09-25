# R6 design & motion audit: "System Design 101" (`R6_DdrHAI1MrFb`)

Source: `C:/Users/debna/Downloads/igexport-DdrHAI1MrFb.mp4`. **Native 720×1280**, H.264 High yuv420p, 30 fps CFR (4665 frames), **155.63 s**, ≈342 kb/s video + HE-AAC 48 kHz stereo 56 kb/s (IG re-encode).
**Loudness (ffmpeg ebur128): I = −14.1 LUFS, LRA = 1.5 LU, TP = −0.8 dBFS.**
All px are measured on native frames and reported ×1.5 in 1080×1920 space (±1.5 px quantisation). Hex values carry ±3/channel IG noise. 1 f = 33.3 ms. Timestamps are seconds in the reference file. Frame access is exact (accurate seek verified pixel-identical against `select=eq(n,969)`).
Whisper: faster-whisper large-v3 (`words.json`, `transcript.txt`), 505 words, 0.00–154.70 s. Word times carry the usual ≈±0.1 s `[ASR?]` bias (SPEC conventions).
Our v3 = the current renderer (`orchestrator/lib/video/v3/*`, `video-engine/compositions/components/lib/stage/*`, `orchestrator/V3.md`), compared from code and the SPEC measurements. No v3 render was made for this audit.

Scripts in this folder:
- `util.py` exact frame reader;
- `diffall.py`, `events.py`, `beats.py` region change maps / beats;
- `track.py`, `wbox.py`, `cropstrip.py`, `strip.py` per-frame trackers and strips;
- `boxes.py`, `geo*.py`, `m_*.py` geometry and colour;
- `capflip.py`, `capan.py` captions;
- `blink.py` mascot;
- `whisp.py` ASR.

Evidence frames: `ev_*.png` (the other scratch is git-ignored).

---

## 1. Style profile: NEW, "LB: light blueprint" (an LC skin running DH grammar)

| Axis | R6 measured | Closest existing | Verdict |
|---|---|---|---|
| Theme | light: bg **#EDF1F3** (flat; #E9EEF0 in the mid band), white cards | LC (#F4F4ED warm) | light like LC, but **cool grey-blue**, not warm ivory |
| Bg texture | **line grid**: 1.5 px minor lines every **40 px** (≈2.5–3.5 luma below bg), major lines every **200 px** (5th line, 6–8 luma, e.g. x = 139.5 / 339 / 540 / 739.5 / 939), aligned to the frame centre x = 540. Static. Visible in every band, including 0–236 and below the caption. | DC's line grid (dark, 60 px) | new texture parameters |
| Top chrome | **segmented header bar** (brand block + chapter + live user counter) + **component tracker chip row** | LC kicker/counter, DH HUD | new (it is a HUD in LC clothing) |
| Per-scene title | none. A **left "note card"** (RULE / PROBLEM / FIX / GOAL / COST) carries the scene's thesis and swaps ≈55× | LC title/subtitle/footnote | new |
| Content grammar | one **persistent, growing architecture diagram** (the "blueprint", V1→V9) is revisited 10× (35 % of runtime). Between visits come 24 short **explainer scenes**, which **push/slide** in and out. | DH carrier (mutate in place) + LC scene rebuild | hybrid |
| Mascot | full-body presenter (a Rick Sanchez-style cartoon, a third-party IP character), feet-anchored at the left, **never hidden**, blink 133 ms every ≈2.9 s, eye-state swaps, no lip-sync. Content slides **over** it during transitions. | LC (never hidden) | LC-like; z-order differs |
| Captions | white "paper" box + **yellow marker highlight** behind the active word | LC paper | new karaoke skin |
| Emphasis | stamp, strike, dim→lit headline, red state tint, counters | DH | DH-like |
| Ambient | packet dots on connectors, counters, dot-grid fills, meter fills; only **37.2 %** of frames have no graphic change | DH | DH-like |
| Pace | 196 wpm, max inter-word gap 0.54 s | LC (195–204) | LC-like |

**Evidence.** Frame architecture: `ev_029.5_blueprint-v1.png`, `ev_header_sequence.png`. Transitions: `ev_strip_084_push-left.png`, `ev_strip_023_swap-up.png`.

**Why it is not LC:**
- the header carries **live story state**: the users counter 0 → 1,000 → 250K → 1M → 5M → 20M → 50M, plus 9 tracker chips lighting on their words (the DH HUD job);
- one scaffold is mutated for 25.4 s (23.3–48.7, V1→V3) and recalled 9 more times (DH carrier grammar);
- scenes change by **motion transitions** (push-left over the mascot, drop-out/rise-in, exit-right/enter-right, tumble-scatter), not LC's 1-frame hard cuts (only 16 of 34 R6 scene changes are 1-frame cuts).

**Why it is not DH:** the light theme, the mascot never hides, there is no full-width reframe (the content column is fixed at x 301.5–1018.5 for all 155 s), and the paper caption skin.

**Recommendation:** add profile **LB** = LC palette family (cool variant) + DH state machinery + a new transition layer + the new chrome (header bar, tracker, note card).

---

## 2. Measured geometry map (1080×1920)

| Band / element | R6 measured | Frames | Our v3 (LC) |
|---|---|---|---|
| Top clear | 0–236: bg + grid only | all | 0–223 |
| **Header bar** | x 44–1038 (w 994) × y 236–291 (h 54–55), r ≈12, white #FFFFFF, soft shadow. **Brand block** x 45–310.5, fill **#111923**, white heavy caps "SYSTEM DESIGN 101" (cap ≈17) + a 4-square grid icon. **Chapter** mono caps, cap 15, #4A4F55, centred at x ≈ 571 in the middle segment (`01 ONE SERVER`). **Counter segment** at the right, divider 1.5 px at x 832.5 (the segment grows left as the number widens: divider 870 at "0", 832 at "1,000"): user icon + number mono bold cap 22.5 **#1F4DBD** (grey #5A6269 when 0) + `USERS` micro caps | 29.5, 0.5 | kicker + counter text, rule y 279 |
| **Tracker chip row** | 9 chips `LB · CACHE · REPLICAS · SHARDS · STORAGE · CDN · QUEUE · REDUNDANCY · OBSERVABILITY`, y 303–340.5 (h ≈37), row x 76.5–1003.5 centred on 540, gap ≈9. Unlit: **dashed** 1.5 px #C5C9CB border, transparent, hollow dot, text #64686C. Lit: white fill, solid 1.5 px border, **purple dot #7643FF**, text #2C3030 | 48.5 | none |
| **Note card** | x 60–285 (w 225) × y 384–535.5 (h 151.5), white, 1.5 px border #A9ADB3-ish, r ≈12, **left accent bar 6 px**: grey #5A6068 (RULE), red (PROBLEM), purple (FIX), blue (GOAL), red (COST). Eyebrow: icon + tracked caps cap 15 in the accent colour (`RULE`, `PROBLEM`, `FIX`, `GOAL`, `COST`). Body: Inter-like 600, cap ≈18, #111, ≤3 lines (≈30 chars) | all | none (LC title/footnote) |
| Content column | **x 301.5–1018.5 (w 717)**. Cards top at **y 402**; the blueprint top at 373.5. Bottom **1329–1339.5**. 2-col split 301.5–649.5 / 670.5–1020 (gap 21). Stack gaps 18–33 (median ≈21) | 14.5, 51.5, 98.5, 111.5 | x 320–1010 (690), y 549–1265 |
| Blueprint canvas | x 301.5–1018.5 × y 373.5–1339.5 (717×966); title bar h 42 (373.5–415.5), hairline #DEE0E0; inner 24 px grid (#F6F8F8 on #FFFFFF) | 29.5, 88.5 | none |
| Mascot | x 0–228 (laptop cut by the frame edge) × y 543–1363.5 (h ≈820 = 42.7 % H), feet line 1363.5; gutter to content 73.5 | all | SpongeBob, LC 66–276 × 612–1343 |
| Caption box | y **1425–1524** (h 99; centre 1474.5 = **76.8 % H**), centred on x 540, width hugs the text (e.g. 261–819) | 19.5, 29.5 | LC 1452–1545 |
| Bottom | 1540–1920: bg + grid, nothing drawn | all | 1692+ |

---

## 3. Scene-by-scene timeline

"BP" = blueprint canvas; "Vn" = its version chip. Word times are Whisper starts; `+x` is the visual lag after the word.

| # | t0–t1 | Spoken (abridged) | Template | Modules on screen | Events (word-anchored) | Out |
|---|---|---|---|---|---|---|
| 1 | 0.00–1.93 | "System Design 101." | T-hook | BP **V9 (final state)** at mid-canvas scale + display title `SYSTEM DESIGN` / `101` (purple) | mascot slides in 0.10–0.53 (433 ms ease-out); BP nodes build 0.13–1.30 | **hard cut** 1.933 |
| 2 | 1.93–9.73 | "People hear words like load balancer, cache, queue, database replica, CDN, sharding… giant collection of random infrastructure terms." | T-cloud | eyebrow `PEOPLE HEAR…` (mono caps), **jargon cloud**: tilted logo chips (LOAD BALANCER, CACHE, QUEUE, DATABASE REPLICA, CDN, SHARDING, big; KAFKA, KUBERNETES, DOCKER… small) | big chips drop in on their words: load@2.78 → 2.83 (+0.05), cache@3.56 → 3.63, CDN@5.14 → 5.30. At "giant collection"@6.33–6.8 about 20 small chips flood in. Note `PROBLEM · Sounds like random jargon` at 8.33 | the cloud flies out right while the new stack **cuts in** at 9.733 |
| 3 | 9.73–16.00 | "But system design is really just this. You start with a product requirement… reliably… number of users gets huge." | T-stack3 | 3 **step cards** (714×210, 714×210, 735×303) joined by ↓ arrows: `1 START WITH / A PRODUCT REQUIREMENT / "Users post photos, like, and message."`, `2 MAKE IT WORK / RELIABLY`, `3 WHEN USERS GET / HUGE / 1 USERS` | note `RULE · It's really just three things` 10.27; card lit per step (11.70 requirement@11.82, 13.60 reliably@13.54); **count 1 → 100,000,000** 14.40–15.60 on "number"@14.34 (+0.06), 1.2 s power2.out; resets to grey "1" at 15.70 | cards **push left over the mascot**, staggered, 16.00–16.23 |
| 4 | 16.00–17.90 | "Let's build the mental model from scratch." | BP | empty BP (V0) + red pill `BLANK PAGE` | BP slides in from the right 16.17–16.50 (≥480 px, power3.out); note `RULE · Build it from scratch` 16.30 | BP exits right + fades 17.67–17.87 |
| 5 | 17.90–23.30 | "Imagine a simple social app. A user opens it, loads their feed, likes a post, uploads a photo, sends a message." | T-phone+list | **phone mockup** 330×675 at (330,421.5) (app `circle`) + **request list** 327×454 (`GET /home, GET /feed, POST /likes, POST /photos, POST /messages`, dashed rows) | phone rises from below 17.90–18.30 (13 f, power3.out); chapter `01 ONE SERVER` 17.53; feed loads on "feed"@20.48 (+≈0); each request row lights (blue fill) on its verb: loads@19.98, likes@21.10, uploads@21.56, sends@22.34 (all within +0.1); note `GOAL · A simple social app` 18.10, `RULE · Every tap is a request` 20.57 | phone **drops out** while BP **rises in**, 23.30–23.63 |
| 6 | 23.30–48.70 | "At first you run everything on one server … one machine. For a thousand users that's completely fine. Then traffic grows. One server can't handle everything. So you scale horizontally … That's the load balancer. It receives traffic and distributes requests across the healthy servers. But all those servers hit the same database … bottleneck. So you reduce unnecessary reads … cache like Redis." | BP V1→V3 | USERS pill (5 real photo avatars + "+", `phones · browsers`), `ONE MACHINE` box (BACKEND / DATABASE rows with ×1 badges), `1,000 USERS` pill, `CPU 12% · FINE` green pill; then red `ONE MACHINE` + `TIMEOUTS`, `CPU 100%`; `SCALE OUT` 4 servers; LB node + `THE FRONT DOOR`; `ROUND ROBIN`; `FAILED HEALTH CHECK`; DB `BOTTLENECK`; CACHE node + `SERVED FROM MEMORY` | header counter **0 → 1,000** 27.87–28.40 on "thousand"@27.70 (+0.17); **1,000 → 250K** 29.77–31.00 on "traffic grows"; note swaps 24.57 / 31.13 / 32.73 / 36.57 / 38.10 / 40.03 / 43.37 / 47.30; the machine box turns red ≈31.1; servers ×4 at 33.5; LB node + tracker `LB` lights 38.10 on "load"@38.08 (+0.02); packets flow LB→servers from 39.0; red ✕ server + `FAILED HEALTH CHECK` 41.20 on "healthy"@41.18; counter → **1M** 42.27–43.23; chapter `02 SCALE OUT` 32.10; `03 THE DATABASE` 45.20; DB red + `BOTTLENECK` 44.x; CACHE node + tracker `CACHE` 47.30 on "cache"@47.22 (+0.08); BP auto-refits smaller as nodes are added | the new card slides in from the right **over** the BP, which slides left under it, 48.67–48.93 |
| 7 | 48.70–53.87 | "If the same profile gets requested 10,000 times, serve it from memory instead of querying the database every time." | T-profile+dots+2up | **profile card** 717×246 (photo avatar, `maya.k`, `GET /profile/maya` pill, counter `N REQUESTS`); **dot grid** 5×20 (`EACH DOT = 100 REQUESTS`); 2 dashed **compare cards** 349.5×441 `CACHE / Redis · in memory / 9,999 HITS / ~0.3 ms each` and `DATABASE / query on disk / 1 QUERY / ~15 ms` | dots fill 49.60–50.60 (≈1.0 s, near-linear raster) on "requested"@49.56; counter to 10,000; first dot turns **orange** 51.30 (the one DB query), then the other 99 recolour **purple** 51.60–52.40 on "from memory"@51.28 / "instead"@51.68; the CACHE card lights (solid border, purple numbers) | **hard cut** 53.867 |
| 8 | 53.87–62.00 | "Reads keep growing. So you add read replicas. The primary handles writes, replicas handle reads. Eventually even one database cluster isn't enough." | BP V4 | + 2 REPLICA nodes beside DATABASE, dashed amber links, `WRITES` / `READS` tags | BP slides in from the right 53.90–54.10 (7 f, power3.out, Δx 144, 88.5, 51, 24, 9, 3); counter → 5M 54.33–55.00; tracker `REPLICAS` 56.00; `WRITES` pill 57.47 on "writes"@57.24 (+0.23); counter → 20M 59.23–60.03; replicas + DB tint red 60.73 ("isn't enough") | BP exits; the table enters 61.87–62.07 |
| 9 | 62.00–65.93 | "So you partition the data. Users in one range go to one database. Others go elsewhere." | T-table+2up | **users table** 717×432 (`USERS · 20M ROWS`; NAME pill / ID / JOINED; 10 rows Ana…Zoe) + 2 dashed **shard cards** (`SHARD 1 users A–M`, `SHARD 2 users N–Z`) | **scissor cut line** (purple, with a ✂ glyph) drawn between Maya and Noah on "partition"@62.02; rows A–M fly into shard 1 on "one"@63.40, N–Z into shard 2 on "others"@64.80 | BP rises in from below 65.93–66.13 |
| 10 | 65.93–67.27 | "That's sharding." | BP V5 | shard groups (dashed purple, `SHARD 1 · USERS A–M`, `SHARD 2 · USERS N–Z`) | tracker `SHARDS` 66.33 on "sharding"@66.22 (+0.11) | BP exits right, 67.0–67.23 |
| 11 | 67.27–71.07 | "Now files. You don't want profile pictures and videos inside your relational database." | T-files | `USER ROW 1 KB` tile, **photo** (real B/W portrait) `PHOTO 4 MB`, **video thumbnail** (sunset, ▶) `VIDEO 480 MB`; **DB fill card** `RELATIONAL DATABASE` with size `12 GB → 210 GB → 3.8 TB` | chapter `04 FILES` 66.97; the stack rises in 67.27; photo on "pictures"@68.54, video on "videos"@69.14; DB bar fills red bands `VIDEOS` / `PHOTOS` + size counter; red banner `⊘ BLOBS DON'T BELONG HERE` 70.50 on "database"@70.26 | **hard cut** 71.067 |
| 12 | 71.07–74.00 | "Put them in object storage like S3 or R2." | BP V6 | STORAGE node (S3 + Cloudflare logos), tags `AMAZON S3`, `CLOUDFLARE R2`, `DB KEEPS: S3://AVATARS/MAYA.JPG` | tracker `STORAGE` 71.53 on "storage"@71.68 (−0.15) | **hard cut** 74.00 |
| 13 | 74.00–77.70 | "Then use a CDN to cache those files closer to users around the world." | T-map+bars | **dot-matrix world map** 717×426 (`WHERE THE PHOTOS ARE SERVED FROM`; origin ■ `ORIGIN · VIRGINIA`; ≈15 purple edge rings; `TOKYO`) + **latency bar card** 717×468 (`ONE PHOTO, FROM TOKYO`: `TO THE ORIGIN IN VIRGINIA 180 ms` red bar; `TO THE EDGE IN TOKYO 12 ms` purple; footer `CloudFront · Cloudflare: hundreds of edge cities`) | tracker `CDN` 74.57; arcs from the origin, then edge rings pop across the map; the red bar fills, then the 12 ms stub | **hard cut** 77.70 |
| 14 | 77.70–84.10 | "Now someone uploads a video. Should the user wait while the backend processes thumbnails, notifications, analytics and transcoding?" | T-phone+list | phone `New post` (video still + caption, `trip.mp4 480 MB`, progress bar, `Processing… 8.9 s` timer) + **job list** (`THEN THE BACKEND MUST…`: THUMBNAILS 1.2 s, NOTIFICATIONS 0.8 s, ANALYTICS 0.6 s, TRANSCODING 11.6 s; footer `USER WAITS 14.2 S`) | chapter `05 SLOW WORK` 77.70; counter → 50M 77.30–77.70; jobs turn red one by one: thumbnails@81.08 → 81.30 (+0.22), notifications@81.74 → 81.93 (+0.19), analytics@82.42 → 82.50 (+0.08), transcoding@83.06 → 83.13 (+0.07); the timer runs; `USER WAITS 14.2 S` goes solid red 83.7 | **push-left over the mascot** 84.07–84.23 |
| 15 | 84.27–84.77 | "No." | T-display | red display word **`No.`** (cap ≈80, #AE2435) centred in the column | hard cut in (+0.55 after "No."@83.72 because of the exit) | cut |
| 16 | 84.77–92.50 | "So you introduce a queue. The request finishes quickly. And background workers process the slow jobs. Next problem: what happens when one service crashes?" | BP V7→V8 | QUEUE node (`jobs wait here`), WORKERS node (`slow jobs`), `THUMBNAILS · TRANSCODE` tag, `200 OK · 120 MS` green pill | tracker `QUEUE` 85.37 on "queue"@85.30 (+0.07); `200 OK` 86.73 on "quickly"@86.60; WORKERS 87.63 on "process"@87.70; chapter `06 FAILURE` 89.87; one server red ✕ + `CRASHED` 91.87 on "crashes"@91.64 | **hard cut** 92.50 |
| 17 | 92.50–95.13 | "One database goes down. One region disappears." | T-map+status | map `FOUR REGIONS, ONE APP` (4 green region boxes: us-west-2, us-east-1, eu-central-1, ap-northeast-1) + **status panel** `STATUS · US-EAST-1` (DATABASE primary / SERVERS ×4 / REGION Virginia with right chips) | DATABASE → `DOWN` (red row) 93.47 on "down"@93.28 (+0.19); SERVERS `UNREACHABLE`, REGION `OFFLINE`; us-east-1 box red ✕ 94.10 on "region"@93.98 | **hard cut** 95.13 |
| 18 | 95.13–96.80 | "This is where redundancy matters." | BP | BP with `REDUNDANCY` (duplicated nodes) | tracker `REDUNDANCY` 95.60 on "redundancy"@95.58 (+0.02) | **hard cut** 96.80 |
| 19 | 96.80–100.40 | "Multiple servers, replicated data, health checks, retries, failover." | T-list5 | 5 **feature rows** 714–726×165 (icon tile + title + mono sub + a right mini-visual: 3 server glyphs one red; DB→2 DBs; `200 200 ×` chips; `× → ok`; `P → R = P`); ghost (dashed, grey) until lit | rows light per word: servers@96.96 (row 1 lit at the cut), replicated@97.56 → 97.60, health@98.44 → 98.50, retries@99.00 → 99.07, failover@99.50 → 99.60 | **hard cut** 100.40 |
| 20 | 100.40–102.27 | "The system should expect parts to break." | T-display+3 | 3-line headline `EXPECT / PARTS TO / BREAK.` (cap 81, pitch 111, x 307.5) + 3 **server tiles** 216×244.5 | headline **cuts in grey** #5A6269 at 100.43, snaps to ink #141920 with `BREAK.` red #AE2435 at 101.07–101.10 on "parts"@101.16; server 2 turns red on "break"@101.72 | **hard cut** 102.27 |
| 21 | 102.27–106.17 | "The goal isn't nothing ever fails. It's failure in one part doesn't destroy everything." | T-2strip+grid | `✕ THE GOAL ISN'T / NOTHING EVER FAILS` (717×156), `✓ IT'S / FAILURE STAYS CONTAINED` (717×156), **compartment grid** 717×537 (`THE APP, AS SEALED COMPARTMENTS`, `12 / 12 UP`, 4×3 green cells) | **strike** 103.47–103.77 on "fails"@103.30 (+0.17); strip 2 lights on "failure"@103.92; the PHOTOS cell goes red, counter `11 / 12 UP`, on "one part"@104.44 | **hard cut** 106.17 |
| 22 | 106.17–107.60 | "Now add observability." | BP V9 | BP + observability node | chapter `07 OBSERVABILITY` 106.17; tracker `OBSERVABILITY` 106.80 on "observability"@106.62 (+0.18) | **hard cut** 107.60 |
| 23 | 107.60–116.57 | "Logs tell you what happened. Metrics… Tracing tells you how one request moved across services. Without those, debugging a distributed system is a nightmare." | T-3panel | **LOGS** (5 timestamped mono lines, ERROR row pink), **METRICS** (p99 latency line chart, spike marker `p99 840 ms`), **TRACES** (waterfall: load balancer 4 ms, api server 150 ms, cache 2 ms, database 38 ms, storage·S3 88 ms red, queue 3 ms). 717×297 each, tool logos top-right (Elastic, Splunk, Prometheus, Grafana, Jaeger…) | panels light per noun: Logs@107.58, Metrics@108.88 → 108.97, Tracing@110.72 → 110.90; the ERROR row highlights; the metric line draws with its spike; trace bars grow sequentially 111.5–113.1 on "moved across"; on "without those"@113.56 the panel contents are replaced by red **`?`** marks | **hard cut** 116.57 |
| 24 | 116.57–118.27 | "And here's where beginners make a mistake." | T-display | ⚠ icon + `THE BEGINNER / MISTAKE` (grey → `MISTAKE` red) | chapter `08 THE MISTAKE` 116.57; `MISTAKE` → red 117.57 on "mistake"@117.68 | cut |
| 25 | 118.27–121.33 | "They think system design means adding as much infrastructure as possible." | T-logogrid | `COMPONENTS` label + red counter + **logo tile grid** (6 columns of 105×105 tiles, pitch ≈120) | tiles pop in at an accelerating stagger, counter 6 → 36 → 42 (118.3–121.2) | **hard cut** 121.33 |
| 26 | 121.33–124.97 | "Microservices, Kafka, Kubernetes, 10 databases. That's not good system design." | T-2x2 | 4 **tech cards** 346.5×436.5 (graph illustration / Kafka logo / Kubernetes logo / 10 DB glyphs), ghost → lit | lit per word: Microservices@121.42 (at the cut), Kafka@122.10 → 122.13, Kubernetes@122.56 → 122.70, databases@123.60 → 123.57; on "not"@124.58 the 4 cards **tumble** (rotate + fall away down-left, over the mascot) 124.60–124.83 | tumble |
| 27 | 124.97–125.97 | "…good system design." | T-stamp | **stamp** `NOT GOOD / SYSTEM DESIGN` (rotated ≈ −5°, red #891E2F text, red border ≈3 px (visual)) + `🔗 ☸ 🐘 ×10 …for an app with a thousand users?` | stamp slam 124.97–125.13; note `RULE · Complexity is not a goal` | cut |
| 28 | 125.97–127.90 | "Every component adds complexity." | T-list+meter | 9 rows 496.5×79.5 (pitch 96: OBSERVABILITY … LOAD BALANCER, each `+1` red) + **vertical complexity meter** (`COMPLEXITY`, gradient amber → red, `×9` red) | rows stack bottom-up at a 133 ms stagger 126.03–127.07; meter fill 1236 → 537 (699 px) 126.0–127.27, accelerating | **hard cut** 127.90 |
| 29 | 127.90–131.90 | "A cache can go stale. A queue can deliver twice. Replicas can lag." | T-3cost | 3 **cost cards** 717×293 (logo + name + red caps consequence + a right mini-visual: `CACHE [photo] ≠ [photo] DATABASE`; `Welcome email` ×2 + `SENT ×2`; `PRIMARY · 42 LIKES → REPLICA · 41 LIKES · 2 S BEHIND`), ghost → lit | lit per sentence: cache@128.02, queue@129.42 → 129.50, replicas@130.64 → 130.70 | **hard cut** 131.90 |
| 30 | 131.90–135.67 | "Sharding makes queries harder. Microservices introduce network failures." | T-2cost | 2 cost cards (`SHARDING / QUERIES GET HARDER` with `TOP POSTS, ALL USERS → [A–M] [N–Z] → MERGE`; `MICROSERVICES / NETWORK FAILURES` with `feed → ✕ → likes · 504 TIMEOUT`) | card 2 lights on "Microservices"@133.62 | **hard cut** 135.67 |
| 31 | 135.67–138.53 | "So you only add complexity when it solves a real bottleneck." | T-display+2 | 6-line headline `ONLY ADD / COMPLEXITY / WHEN IT / SOLVES A / REAL / BOTTLENECK.` + `✕ because it's popular` (pink) / `✓ because something broke` (green) | chapter `09 THE METHOD` 135.67; `REAL BOTTLENECK.` grey → red on "real"@137.58 → 137.67 (+0.09) | **hard cut** 138.53 |
| 32 | 138.53–145.10 | "That's the core of system design. Start simple. Find the bottleneck. Introduce the smallest component… Repeat as the system grows." | T-cycle | title `THE CORE OF SYSTEM DESIGN` + **4-step cycle** (2×2 cards 327×313.5, → ↓ ← ↑ arrows: 1 START SIMPLE, 2 FIND THE BOTTLENECK, 3 SMALLEST FIX, 4 REPEAT) + **lap tracker** `LAPS IN THIS VIDEO 1…9` (717×106.5) | steps light: Start@139.86 → 139.97, Find@140.62 → 140.70, Introduce@141.82 → 141.90, Repeat@143.82 → 143.90; the 9 lap chips fill purple on "grows"@144.66 | **hard cut** 145.10 |
| 33 | 145.10–153.67 | "So when you hear load balancer, cache, queue, CDN, replicas, shard. Don't memorize them as random technologies. Ask one question: what problem appeared that forced us to add this component?" | T-matcher | label `? WHEN YOU HEAR…` → `DON'T MEMORIZE THE NAMES` → `WHAT PROBLEM FORCED US TO ADD THIS?`; right column of 6 component chips 327×109.5 (pitch 132) + left column of `? WHY WAS IT ADDED?` ghosts that fill with red problem cards + → arrows | chips light per word: load@145.66, cache@146.32 → 146.47, queue@146.72 → 146.77, CDN@146.96 → 147.10, replicas@147.48 → 147.50, shard@147.90 → 147.97; ghosts appear 148.53 on "memorize"@148.68; label swaps 150.87 on "question"@150.74; problem cards fill top-down 151.67–153.3 (4 of 6 filled at 152.5) | **hard cut** 153.67 |
| 34 | 153.67–155.63 | "That's system design 101." | T-hook (callback) | BP V9 + `SYSTEM DESIGN / 101` (the hook frame, bookend) | — | end (no fade measured; last frame at 155.60) |

---

## 4. Checklist (items 1–36)

### A. Frame architecture & layout

| # | Reference R6 (measured) | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 1 Safe zones | Nothing drawn above y 236 or below 1524 (the caption). Side margins: header 44 / 42, content right edge 1018.5 (61.5 margin). Mascot bleeds off the left edge (x 0). The grid bg fills the whole frame, including the clear bands. | LC: top 223, bottom 1692 (footer); DH 235/1540. | Bands are close to DH (236/1524); the texture continues into the clear bands. | tuning (LB profile band values) |
| 2 Grid / columns | Mascot column 0–228; the **note card** sits in the mascot column above the head (60–285 × 384–535.5); content column **301.5–1018.5 (717)**, fixed for 155 s; 2-col split 348 + 21 + 349.5. Centre axis 540 for header, chips and caption. | LC content 320–1010 (690), no left-column widget. | Column 17 px wider and 18 px further left; new note slot. | tuning + new chrome (note card) |
| 3 Content bbox | Cards y 402–1330 (BP 373.5–1339.5) = 48 % of H; x 301.5–1018.5 → ≈32 % of frame area when full; centre of mass ≈ y 866 (45 %). The column is almost always **filled to the bottom** (1308–1339 in 20 of 24 measured scenes). | LC: top-anchored at 549, content ≤1265, often short. | The ref fills 402–1330; ours starts 147 px lower. | tuning (LB `top 402, bottom 1330`) |
| 4 Layout templates | 12 templates (§6.1): T-hook, T-cloud, T-stack3, BP, T-phone+list, T-profile+dots+2up, T-table+2up, T-files, T-map+bars / T-map+status, T-list5 / T-list+meter, T-display(+N), T-2x2, T-3panel / T-3cost, T-cycle, T-matcher, T-logogrid, T-stamp. | 5 templates (opener, stack, sub, scene, hero). | Most R6 templates are **stack** arrangements of new modules. The BP host and the phone split are new. | new modules + 2 new templates (BP host, device split) |
| 5 Hierarchy | 1) caption (cap 40.5) and the yellow marker; 2) scene display type (headline cap 81, big numbers cap 64.5, "No." cap ≈80); 3) card titles (cap 36, heavy grotesk caps); 4) node labels / list titles (cap 19.5–24); 5) note body (cap 18); 6) eyebrows and mono data (cap 12–15). Ratio caption : card title : node : eyebrow ≈ 40 : 36 : 20 : 12. | LC title 72/800, subtitle 29, card text 18–27. | Card titles are 2× our body; there is no title band; the note card replaces the subtitle. | tuning (type scale) |
| 6 Spacing | Stack gap median 21 (18–33); 2-col gap 21; list pitch 96 (h 79.5, gap 16.5), 132 (h 109.5), 188 (h 165); card padding ≈24 (text x 324 in a 301.5 card, eyebrow cap-top +28); header internal: brand block 265 w; chip gap ≈9. | LC gap 30. | Tighter (21). | tuning |

### B. Persistent chrome

| # | Reference R6 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 7 HUD / status bar | **Header bar** (see §2). Fields: brand (static), chapter `NN NAME` (10 chapters 00–09, 1-frame swap: 11.07, 17.53, 32.10, 45.20, 66.97, 77.70, 89.87, 106.17, 116.57, 135.67), **users counter** with count-up tweens: 0→1→606→1,000 (27.87–28.40, 17 f), 22K→192K→250K (29.77–31.00, 36 f), 377K→1M (42.27–43.23, 29 f), 1.9M→5M (54.33–55.00, 20 f), 8.4M→20M (59.23–60.03), →50M (77.30–77.70). Number turns blue once > 0. The counter segment's left divider moves as the number widens (870 → 832.5). **Tracker chips** (see §2) light on the component's word: LB 38.10, CACHE 47.30, REPLICAS 56.00, SHARDS 66.33, STORAGE 71.53, CDN 74.57, QUEUE 85.37, REDUNDANCY 95.60, OBSERVABILITY 106.80 (each 7–9 f: dashed → solid white + purple dot, small pop). Lifetime: 0–155.6 (always). | DH HUD (host/env/version/metric, flip/tick/retype); LC header kicker + counter. | New skin, chapter field, **progressive component tracker**, compact-number count-up (K/M) with an auto-width segment. | new chrome module `lbHeader` (+ `tracker`) |
| 8 Chapter / step indicators | Chapter in the header (above). **Note card** = per-beat thesis label, ≈55 swaps (median every 2.6 s) with kinds RULE/PROBLEM/FIX/GOAL/COST; swap = 1-f text swap + a 1.02 scale pulse over 6 f (24.567–24.767); the accent bar and eyebrow recolour with the kind. BP version chip `V1…V9`. Lap tracker (scene 32). | LC counter; DC chapter + progress. | Note card, BP version chip. | new chrome (`noteCard`) |
| 9 Mascot | Full-body cartoon presenter holding a laptop, x 0–228 × y 543–1363.5 (≈820 tall, 42.7 % H), identical position all video. **Entrance** 0.10–0.53: right edge Δ 45, 36, 28.5, 24, 18, 13.5, 9, 7.5, 4.5, 3, 1.5, 1.5 → 433 ms **power2/3.out** from off-left. Never exits. **Blink** 4 f (133 ms), 50 detected, median interval **2.90 s**, 7 double-blinks 0.3 s apart. **Eye states**: normal, pupils aside/up (37.4, 100.6), wide pupils (125.1 stamp). **No lip-sync** (mouth region 0 changed px 25.3–27.0 while speaking). **Z-order: content passes over the mascot** in push-left and tumble exits (84.13, 16.1, 124.8). The character is third-party IP: do not copy it. | SpongeBob placeholder; LC never hides, blink 200 ms. | Blink cadence 2.9 s vs ours; eye-state swaps; content-over-mascot z during transitions. | asset (own character) + tuning (blink 133 ms / 2.9 s) + z-order option |
| 10 Captions | White box #FFFFFF, 1.5 px hairline #DBDDDD, radius ≈12, soft drop shadow (#D3D4D7 below the box for ≈22 px → ≈`0 8 24 rgba(0,0,0,.10)`); y 1425–1524, pad-x ≈39; Inter-like 700–800, cap **40.5** (≈56 px font). **Karaoke = 3 states**: spoken #41454E, upcoming #65676D, **active #0B0400 on a yellow marker #FEE587** (rounded ≈4.5 px, h 70.5 = y 1440–1510.5, pad ≈3 px around the word ink). Active flip = **hard 1 f** jump (no slide). **163 chunks**, 3–4 words (median 3; mode 4), life median **0.93 s** (p10 0.53, p90 1.30). Chunk swap: 40 of them have exactly **1 blank frame**; the new chunk pops scale 0.987 → 1.017 → 1.0 over 3 f (2.833–2.900). Flip lag vs Whisper start: median **+0.04 s** (IQR −0.05…+0.10, n = 481). | LC paper (ivory, 1.5 px grey border, soft shadow), 50–52 px, active = primary text colour. | Marker highlight vs coloured text; white fill; 56 px; the swap pop. | tuning (caption skin `marker`) |

### C. Visual design system

#### 11. Palette

| Role | R6 measured | Where | Our v3 LC |
|---|---|---|---|
| bg | #EDF1F3 (mid band #E9EEF0) | 29.5 | #F4F4ED |
| grid minor / major | ≈#EAEEF0 1.5 px every 40 px; major (5th) ≈#E3E8EA every 200 px | 29.5 | dots #E7E7E0 / 38 px |
| surface card | #FFFFFF | all | #FEFCF8 |
| card border | #DBDFE1 / #D4D5D8, 1.5 px; ghost = dashed #C5C9CB | 111.5, 48.5 | #BCC3C2 |
| card shadow | soft, ≈20 px below at #DDE1E5 on #EDF1F3 (≈6 % black) | 111.5 | soft |
| brand block | #111923 | header | — |
| ink-1 (titles) | #090A0E / #141920 | 14.5, 101.5 | #17232B |
| ink-2 (body / mono) | #565758 quote, #767676 log text, #626262 eyebrows | 14.5, 111.5 | #474C4D |
| muted / ghost text | #5A6269 (dim headline), #64686C (unlit chip) | 101.5, 48.5 | #626667 |
| **accent purple** (brand, "added component", fix) | #7643FF dot, #7E4CFF bar, #4C2891 value text | 48.5, 76.5 | purple #6D4EA5 (entity) |
| **number blue** | #1F4DBD (counters), #27418B / #E3EBF9 (pill), #2C6DEB (trace bar) | 14.5, 29.5 | blue #1766DA |
| **red / problem** | text #AE2435 / #891E2F, stroke/bar #E8474E / #E2464B / #DF4849, badge #AF2231, tint #FBE6E6, border #F6DBE0 | 101.5, 76.5, 93.5 | brick #B14B30 |
| **green / ok** | tint #E0F3E6 / #E2F2E8, text #2B644E / #196549 | 29.5, 93.5, 137.5 | #DDF2E7 / #2E644F |
| amber | orange dot (first query), amber replica links, meter bottom | 51.5, 57.8, 127.5 | #F7F1E7 |
| **marker yellow** | #FEE587 | captions | none |
| hues at once | 1–3 on white cards (purple always; + red or green on problem/fix beats). The real photos add full colour in 8 scenes. | — | ≤3 |

#### Items 12–19

| # | Reference R6 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 12 Typography | **Display / titles**: heavy geometric grotesk (Space-Grotesk-like, ≈700; face not verified), ALL CAPS: headline cap 81 (line pitch 111), "No." ≈80, card titles cap 36, node labels cap 19.5, list titles cap ≈24, the hook `101` purple ≈cap 90. **Mono** (JetBrains-Mono-like, dotted zero): chapter (cap 15), counters (cap 22.5 header; **64.5** big number), subs (`NGINX · ELB`, `your code`), logs, requests, eyebrows (tracked caps cap 12–15). **Inter-like** for captions (cap 40.5), note body (cap 18), quotes and body lines. Text per frame: 1 note + ≤6 card titles + mono subs + caption; ≈40–80 tokens on the BP frames. | Inter + JetBrains Mono + Playfair; LC titles 72/800. | Display face differs (geometric grotesk vs Inter 800); a big mono counter tier is missing. | tuning (bundle a Space-Grotesk-class face for LB display; mono big-number style) |
| 13 Card anatomy | **White card**: 1.5 px border, r ≈12, soft shadow, padding ≈24. Header row = icon (≈27 px, line icon or brand logo) + caps title; optional right slot (logos, badge, mini-visual). **Ghost card** = dashed border, grey text, no shadow → **lit** = solid + ink + shadow (used in 7 scenes). **State tint**: pink fill #FBE6E6 + red border (bad), green #E0F3E6 (ok). **Window chrome**: none (no traffic lights). **Device**: phone frame 330×675, black bezel ≈12 px, r ≈48, notch pill, status bar `9:41`. | Panel / window chrome (traffic dots), tinted fills. | Ghost → lit state, the device frame, logo slots. | new ops (`ghost` / `lit`) + a new module (phone) |
| 14 Pills / badges | Annotation pills on the BP (lavender #EFEAFB fill + purple mono caps: `THE FRONT DOOR`, `SERVED FROM MEMORY`, `ROUND ROBIN`, `SCALE OUT`), a green status pill (`CPU 12% · FINE`, `200 OK · 120 MS`), red pills (`TIMEOUTS`, `CPU 100%`, `BOTTLENECK`, `BLANK PAGE`, `FAILED HEALTH CHECK`), a blue value pill (`1,000 USERS`), `×1` purple count badges, status chips (`DOWN` solid red, `HEALTHY` green tint, `UNREACHABLE`, `OFFLINE`), tracker chips (dashed / lit), `+1` red, `SENT ×2`. All mono caps, r ≈8–10, with an optional leading icon. | pill (tone, dot). | Leading icons, dashed variant. | tuning (pill icon + dashed) |
| 15 Iconography & imagery | **Line icons** (Lucide-like, 1.5–2 px stroke): server, database (elephant), users, shield, file, bell, chart, film, globe, cloud, ⚠, ✂, ✓, ✕. **Real brand logos** (Redis, Kafka, Kubernetes, Docker, Prometheus, Grafana, NGINX, S3, Cloudflare, RabbitMQ, MongoDB, DynamoDB, Lambda, Route 53, Elastic, Splunk, Jaeger…) in coloured rounded tiles. **Real photographs**: 5 user avatars (circular, ≈40 px, cover-cropped, 1.5 px white ring), `maya.k` avatar (≈120 px circle), a B/W portrait (`PHOTO 4 MB`, r ≈12), a sunset surf still (`VIDEO 480 MB` with a ▶ disc overlay; the phone feed). **All stills are static** (phone thumbnail region 79.0–83.5: 4 changed frames of 135, only its own entrance; avatars 28–31: 1 of 90). Dot-matrix world map. | Lucide-like icon set (30 names); **no image support** (no `<img>` anywhere in `lib/stage`). | Brand logos, photos and avatars. | new capability (image slot: `<img>` cover-crop + mask + ring) + asset pipeline (licensed logos / stock photos) |
| 16 Connectors | BP: grey #9AA0A6-ish 1.5 px orthogonal **bus/elbow** connectors (a horizontal bus under the LB fanning to 4 servers); dashed amber (primary → replica), dashed purple group outlines; arrows only in the cycle (grey chevrons) and between list columns (→). **Packets**: purple/blue dots Ø ≈15 travelling on edges (39–48 s, 57–60 s). | `nodes` edges (curve/elbow/straight, solid/dashed) + packets. | Bus fan-out routing, group outlines, auto-layout. | tuning of `nodes` + new host (BP) |
| 17 Charts / numbers / tables | Big mono counter (1 → 100,000,000 in 1.2 s, power2.out); header compact counter; **dot grid 5×20**; horizontal **latency bars** (red 180 ms vs purple 12 ms); **DB size bar** (stacked red bands); p99 **line chart** with a spike marker; **trace waterfall** (6 rows, offset bars); **users table** (10 rows, name pill / ID / year) with a split line; **vertical meter** (gradient fill); compartment grid 4×3 with `12 / 12 UP`. | kpis, bars, chart (flat + surge), table (≤6 rows), chips grid. | Waterfall, dot grid, vertical meter, split table, the size bar. | new modules |
| 18 Data realism | `GET /profile/maya`, `u_1040…u_1103`, `13:37:02.206 ERROR POST /photos 500 · s3 timeout 3000 ms`, `p99 840 ms`, `NGINX · ELB`, `Redis · memory`, `S3 · R2`, `s3://avatars/maya.jpg`, `us-east-1`, `trip.mp4 480 MB`, `14.2 S`. Numbers match the narration (10,000, 180 vs 12 ms, 1,000 users, 20M rows). The persona `maya` recurs (profile, logs, table, S3 path). | Storyboard data, realistic. | Persona continuity across scenes. | storyboard rule |
| 19 Background | Flat #EDF1F3 + static 40/200 px line grid, whole frame, never moves. BP canvas has its own 24 px grid. | LC dots 38 px. | New texture. | tuning (LB bg) |

### D. Module catalog (item 20)

| ID | Module | Anatomy (measured) | Variants / states | Data | Reuse | Ours |
|---|---|---|---|---|---|---|
| N1 | **Header bar** | §2 | chapter swap; counter tween; icon colour | brand, chapter, users | always | missing (`lbHeader`) |
| N2 | **Component tracker** | 9 chips, §2 | ghost → lit (pop 7–9 f) | component set | always | missing |
| N3 | **Note card** | 225×151.5 at (60,384) | RULE / PROBLEM / FIX / GOAL / COST | beat thesis | ≈55 swaps | missing |
| N4 | **Blueprint host** | 717×966 canvas + title bar + version chip | V0…V9; node add / recolour / annotate / packets; auto-fit | the architecture | 10 visits, 54 s | partial (`nodes`, ≤6 nodes, fixed) |
| N5 | **Jargon cloud** | ≈26 tilted chips (−6…+4°), 2 sizes (big h ≈102 w/ 57 px icon tile; small h ≈51) | drop-in per word; flood; fly-out | a term list | 1 | missing |
| N6 | **Step stack** | 3 cards + ↓ arrows | per-step lit; embedded counter | a process | 1 | partial (`steps` tabs) |
| N7 | **Phone mockup** | 330×675 device | blank / feed / post-upload with progress + timer | app UI | 3 | missing |
| N8 | **Request / job list** | 327×454 or 333×673 panel, dashed rows | row light (blue / red), right value, total row | endpoints / jobs | 2 | partial (`panel` rows) |
| N9 | **Profile hit card** | 717×246: avatar + handle + route pill + right counter | counter | a hot key | 1 | missing (image) |
| N10 | **Dot grid** | 5×20 dots 22.5 px, pitch 34.5 | fill, recolour sweep, first-dot accent | N requests | 1 | partial (`chips` grid) |
| N11 | **Compare cards (dashed → lit)** | 2 × 349.5×441 | loser dim / winner lit | cache vs db | 2 | partial (`compare`) |
| N12 | **Split table** | 717×432 table + scissor line + 2 shard bins | rows fly to bins | rows | 1 | partial (`table`) |
| N13 | **Size bar / DB fill** | 723×642 card, stacked bands, size counter, banner | band fill, banner | storage mix | 1 | missing |
| N14 | **Dot-matrix world map** | 717×426, dotted continents | origin, edge rings, arcs, region boxes ✓/✕ | geography | 2 | missing |
| N15 | **Latency bars** | 717×468, 2 labelled bars + value | fill | ms compare | 1 | partial (`bars`) |
| N16 | **Status panel** | 717×468, 3 rows + right status chips | row → DOWN (red tint) | health | 1 | partial (`panel`) |
| N17 | **Feature rows (ghost → lit)** | 5 × 717×165 + right mini-visual | per-word lit | a list | 1 (+ 145 s variant) | partial (`panel`) |
| N18 | **Display headline (dim → lit)** | 3–6 lines, cap 81, left-aligned at x 307.5 | grey → ink, key word red | a thesis | 4 | partial (`headline`: no dim → lit, centred) |
| N19 | **Strike strip pair** | 2 × 717×156 (`✕ isn't` / `✓ it's`) | strike draw 333 ms | a correction | 1 | partial (strike op) |
| N20 | **Compartment grid** | 4×3 cells, `N / 12 UP` | cell → red | isolation | 1 | partial (`chips`) |
| N21 | **Obs triptych** | logs / metrics / traces 717×297 each | per-panel lit, ERROR row, spike, waterfall grow, `?` blackout | observability | 1 | partial (`code`, `chart`) |
| N22 | **Logo grid + counter** | 6-col tiles 105 px, red counter | accelerating pop-in | "too many" | 1 | missing |
| N23 | **Tech cards 2×2** | 346.5×436.5 | ghost → lit, tumble exit | named techs | 1 | missing |
| N24 | **Stamp** | ≈535×165 rotated ≈ −5° | slam 1.30 → 1.0 | verdict | 1 | partial (`stamp`) |
| N25 | **Cost list + meter** | 9 rows + vertical meter 58×≈750 | stack-up + fill | accumulation | 1 | missing |
| N26 | **Cost cards** | 717×293, red consequence + mini-visual | ghost → lit | trade-offs | 2 | partial (`banner`) |
| N27 | **Cycle 2×2** | 4 cards 327×313.5 + arrows + lap tracker | step lit, laps fill | a loop | 1 | missing |
| N28 | **Matcher** | 6 right chips + 6 left ghosts + → | chip lit, ghost → problem card | problem ↔ fix | 1 | missing |
| N29 | **Display word** | "No." cap ≈80 red | cut in | an interjection | 1 | partial (`hero`) |
| N30 | **Caption (marker)** | §B10 | — | narration | 100 % | tuning |

**How modules combine:** one frame = header (N1) + tracker (N2) + note (N3) + mascot + **one content stack** in x 301.5–1018.5 (1–3 modules, or BP) + caption. Only the stack changes identity; chrome state accumulates.

---

### E. Motion system

#### Measured events

| # | Event (time) | Property | Travel | Duration | Per-frame profile | Easing | Notes |
|---|---|---|---|---|---|---|---|
| E1 | Mascot enter (0.10–0.53) | right edge | 0 → 220.5 | 13 f = 433 ms | Δ 45, 36, 28.5, 24, 18, 13.5, 9, 7.5, 4.5, 3, 1.5, 1.5 | power2/3.out | from off-left |
| E2 | Jargon chip drop-in (2.833–3.133) | chip white box | w 427.5 → 361.5 → 369 (scale **1.16 → 0.98 → 1.0**); centre (651,438) → (516,474) | 10 f = 333 ms | w Δ −27, −18, −13.5, −4.5, −3, +1.5, +4.5, +4.5, +3 | back.out (undershoot then settle) | lands tilted ≈ −2°; on its word +0.05 |
| E3 | Push-left exit (84.067–84.233) | content right edge | 1000.5 → 207 (≈−800, passes over the mascot) | 6 f = 200 ms | Δ −3, −22.5, −60, −115.5, −190.5, −285 | **power3.in** | 1 blank content frame, then a hard cut in |
| E3b | Stack push-left, staggered (16.000–16.233) | 3 step cards | off-left | ≈7 f each | card 1 leads, cards 2–3 follow 1–2 f later | ease-in | same recipe, stagger ≈50 ms |
| E4 | Slide-in from right (16.200–16.533) | `BLANK PAGE` pill x | ≥1075 → 591 (≥480) | ≥10 f ≈ 333 ms | Δ −105, −84, −61.5, −48, −31.5, −21, −12, −9, −6 | power3.out | the BP host enter |
| E4b | Slide-in from right (53.900–54.100) | LB icon x | 961.5 → 642 (+ unseen) | 7 f = 233 ms | Δ −144, −88.5, −51, −24, −9, −3 | expo/power4.out | after a 1-frame hard-cut blank (53.867) |
| E5 | Rise-in from below (17.900–18.300) | phone top y | ≥867 → 421.5 | 13 f = 433 ms | Δ −84, −67.5, −54, −43.5, −33, −27, −18, −13.5, −9, −6, −4.5, −1.5 | power3.out | — |
| E6 | Swap: drop-out + rise-in (23.300–23.667) | phone top / BP top | phone 466.5 → >1680 (↓); BP ≈1100 → 373.5 (↑) | out ≈7 f; in ≈10 f, overlapping | phone Δ +45, +75, …; BP Δ −75, −52.5, −31.5, −19.5, −10.5, −4.5, −1.5 (tail) | out power2.in / in power3.out | both move at once; the incoming layer is above the caption during travel |
| E6b | Rise-in (65.933–66.133) | LB icon y | 805.5 → ≈390 | ≈7 f | Δ −162, −109.5, … | power3.out | — |
| E7 | Cover slide (48.667–48.933) | new card over the BP | from right; the BP slides left beneath | ≈8 f | — | ease-out | "stacked push" |
| E8 | Exit right (17.67–17.87, 67.00–67.23) | card | → right + fade | 6–7 f | ink 153k → 20k | ease-in | — |
| E9 | Tumble exit (124.600–124.833) | 4 cards | rotate ≈ ±10–20°, fall down-left over the mascot | 7 f | — | ease-in | on "not"@124.58 |
| E10 | Stamp slam (124.967–125.133) | ink bbox | w 579 → 511.5 → 474 → 454.5 → 447 → 445.5 (scale **1.30 → 1.0**) | 5 f = 167 ms | scale 1.30, 1.15, 1.07, 1.02, 1.00 | power2.out, no overshoot (±1 % wobble after) | full opacity on frame 1 |
| E11 | Counter 1 → 100,000,000 (14.40–15.60) | value | — | 36 f = 1.2 s | fraction 0.24, 0.44, 0.60, 0.72, 0.82, 0.89, 0.94, 0.97, 0.99 at +0.1 s steps | **power2.out** (cubic) | grey → blue recolour at the start; snaps back to "1" at 15.70 |
| E12 | Header counter (27.87–28.40 etc.) | value | 0 → 1,000 | 17 f | — | ease-out | 250K 36 f; 1M 29 f; 5M 20 f |
| E13 | Strike draw (103.467–103.767) | right end x | 327 → 883.5 (556), 6–7.5 px thick #E8474E | 10 f = 333 ms | Δ 9, 30, 64.5, 106.5, 141, 102, 60, 28.5, 7.5, 1.5 | **power2.inOut** | slower than R2's 167 ms |
| E14 | Headline dim → lit (100.433 cut; 101.067–101.100 lit) | ink colour | #5A6269 → #141920; `BREAK.` → #AE2435 | 1–2 f | — | step | 136.07 / 137.67 same recipe |
| E15 | Dot fill (49.60–50.60) | lit dots | 0 → 100 | 1.0 s | ≈linear raster, row-major | linear | recolour sweep 51.60–52.40 (0.8 s) |
| E16 | List stack-up + meter (126.03–127.27) | rows / fill top | 9 rows; fill 1236 → 537 (699 px) | rows 133 ms stagger; fill 37 f | fill Δ 0, 6, 3, 6, 6, 9, 7.5, 10.5, 9, 9, 15, 18, … 39 | fill **ease-in** | bottom-up |
| E17 | Note swap (24.567–24.767) | card bbox | text 1-f swap; scale ≈1.02 pulse | 6 f | +1.5 px/side at 24.633, settles 24.767 | ease-out | ≈55× |
| E18 | Caption swap (2.800–2.900) | box w | blank 1 f, then 457 → 471 → 463 | 3 f | scale 0.987 → 1.017 → 1.0 | back.out | 40 of 163 swaps have the blank frame |
| E19 | Tracker chip light (e.g. 66.33–66.57) | chip | dashed → solid + dot | 7–9 f | — | ease-out pop | on its word, median +0.07 |
| E20 | Blink | eyes | closed 4 f | 133 ms | — | step | every ≈2.9 s |

#### Items 21–27

| # | Reference R6 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 21 Entrances | Scenes: **slide-in from the right** (233–333 ms, power3/expo.out, ≥480 px), **rise-in from below** (333–433 ms, power3.out, ≥450 px), or a 1-f hard cut. Elements: drop-in with back.out (chips, E2), ghost → lit (≈4 f), per-word row light (1–2 f), stack-up at a 133 ms stagger (E16), pops (tracker, note). | fade / rise 4.5 px / settle / slam (100–233 ms). | **No scene slide / rise, no back.out drop-in, no ghost → lit.** | new capability (scene transition layer) + recipes |
| 22 State changes | Recolour to red tint / red text (machine, DB, jobs, rows); ghost → lit; counters (header compact, big mono, `N / 12`, `×9`); dot recolour sweep; bar / meter fills; version chip V+1; tracker light; text blackout to `?`; the table split (rows move to bins). | tone, count, strike, dim, rowTone, fill. | Ghost → lit, compact counters, sweeps, row-to-bin moves. | new ops |
| 23 Emphasis | Stamp slam 1.30 → 1.0 (E10); strike 333 ms; dim → lit headline + red key word; marker highlight; red glow ring on a failing node (32.3: 1.5 px red border + ≈6 px pink outer ring); no shake, no flash. | slam 1.15, highlight ring (blue), flash, stamp. | Stamp amplitude 1.30; red ring variant; dim → lit headline. | tuning |
| 24 Exits / transitions | 34 scenes: **16 hard cuts** (1.933, 53.867, 71.067, 74.000, 77.700, 92.500, 95.133, 96.800, 100.400, 102.267, 106.167, 107.600, 116.567, 127.900, 131.900, 135.667, 145.100, 153.667); **push-left over the mascot** (16.00 staggered, 84.07); **drop-out + rise-in swap** (23.30); **exit-right + enter** (17.67, 67.00); **cover slide** (48.67); **tumble** (124.60); **fly-out while the new stack cuts in** (9.73). Persists: header, tracker, note (content swaps), mascot, caption. | Hard-cut relayout only (+ mascot slide). | Transition vocabulary (5 motion kinds). | new capability (`transition: push-left / drop-rise / exit-right / cover / tumble / cut`) |
| 25 Process / ambient | Packets on BP edges (≈15 px dots, continuous loops 39–48, 57–60, 86–89 s); counters; timers (`Processing… 8.9 s`); spinner; dot fills; metric line draw. 62.8 % of frames change somewhere; the longest fully still span is **1.70 s** (142.2). | Packets, counters exist in `nodes` / `kpis`. | OK-ish; the timer and spinner are missing. | minor module work |
| 26 Camera | **BP auto-fit**: the diagram rescales and recentres as nodes are added (V1 ONE MACHINE box 450 wide → V9 whole graph in 717×966) at version changes; no pans or zoom punches on other scenes. | none. | Fit-to-content zoom tween on the BP host. | new capability (BP `refit` tween) |
| 27 Choreography | A scene enters complete but **ghosted**; each spoken item lights its part within +0.03…+0.22 s; notes and the header lead or coincide with the sentence start; the tracker lights on the component noun. Long tweens are reserved for **quantities** (counters 0.6–1.2 s, fills 1.0–1.3 s, strike 333 ms). | Per-element beat scheduling exists (events). | Ghost-first build grammar. | storyboard rule + ops |

### F. Timing & narration sync

| # | Reference R6 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 28 Beat density | Machine onsets (content + note + header + tracker, change > 0.3 %, 150 ms merge): **135 → 52.1 / min** (thr 0.15: 48.6 / min). Onset gap median 0.90 s, p10 0.50, p90 2.07, max 3.73. The caption is not counted. Only 37.2 % of frames are graphically still; the longest fully still span is 1.70 s. **34 scenes = 13.1 / min**, scene life median **3.67 s**, mean 4.58, max **25.4 s** (BP 23.3–48.7). Note card ≈55 swaps (21 / min). | Gates: beats/min, longest hold, scene life. | Within the DH/LC bands. The ref's long BP stretches are carried by in-place mutations. | tuning (LB gate values) |
| 29 Word anchoring | Lag of visual onset after the Whisper word start (36 hand-matched beats): **median +0.08 s**, p10 +0.02, p90 +0.20. Tracker chips +0.07 (−0.15…+0.18); enumerations +0.07 (+0.03…+0.19); scene cuts +0.11 after the sentence's first word (+0.02…+0.28). Caption word flips +0.04 median. `[ASR?]` ±0.1 s. | Anchors on TTS word times. | Same pattern: land on the audible word. | none |
| 30 Sentence → treatment | enumeration → per-item light in a pre-built ghost list (jobs, rows, 2×2, matcher); number → counter (header compact / big mono / request counter); scale-up claim → header counter + BP growth; "X isn't Y, it's Z" → strike strip pair; thesis → dim → lit display headline + ✕ / ✓ rows; negative verdict → tumble + stamp; component introduced → BP node + annotation pill + tracker chip + note FIX; problem → red tint + note PROBLEM; question → `?` blackout; recap → callback to the hook frame. | 9 rule types (SPEC 7.4). | Tracker / note / BP-growth coupling; ghost lists; the `?` blackout. | storyboard rules |

### G. Narrative / storyboard

| # | Reference R6 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 31 Structure | Hook 0–1.93: the **finished** architecture + title (the answer first). Problem 1.93–9.73 (jargon cloud). Frame 9.73–16 (3 things). Build 16–92 (9 components, each "problem → fix → tracker lit", users 0 → 50M). Failure 92–116. Anti-pattern 116–135.7 (mistake, stamp, costs). Method 135.7–145 (thesis, cycle, laps = 9 = the components). Close 145–153.7 (name → problem matcher). **Ending**: a callback to the hook frame (153.67), no fade. | LC opener / closer; fixed endcard appended. | Hook = the final-state artefact; bookend callback. | storyboard rule |
| 32 Scaffold selection | The BP host is revisited after every explainer (10 visits); an explainer is used when the concept needs a zoom-in (a request, a key, rows, files, geography, jobs). ≈13 scenes / min; ≈8 full visits / min on the BP during the build act. | Scenes rebuilt; `nodes` limited to 6 nodes. | Revisit-and-grow host. | new capability |
| 33 Entity continuity | Component names, icons and colours are identical across BP, tracker, cost list, cycle and matcher (e.g. CACHE = red Redis logo everywhere; purple = "added component"). The persona `maya` recurs; the users avatars recur; the header counter never goes back. | Entity registry (colour rule). | Icon/logo continuity + persona reuse. | storyboard rule |

### H. Audio

| # | Reference R6 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 34 Voice | Single narrator (timbre not measured); **196 wpm** (505 words / 154.7 s); Whisper inter-word gaps median 0.00, p90 0.18, **max 0.54 s**, 14 gaps > 0.3 s. Emphasis by short sentences ("No.", "Shard."). | ≈212 wpm target, 0.2 s sentence gaps. | Slightly slower pace. | tuning (LB 196 wpm) |
| 35 Music / SFX / mix | **−14.1 LUFS, LRA 1.5, TP −0.8**. 50 ms RMS p5 −36.9, p50 −18.8, p95 −14.1 dBFS; only 0.1 % of windows below −60; inter-sentence gaps median **−22.6 dBFS** → a continuous bed or heavy compression (stems not separable). Transition SFX: 10 of 28 scene changes carry a > p90 high-band (> 2 kHz) transient within −50…+120 ms (chance 10 %) → **some** whoosh / pop on transitions, not on every beat. | −14 LUFS master, no bed, synthesized SFX on every visual change (≈19 LU under the voice). | Ours has silent gaps (≈7 % < −60); ours cues SFX on every change vs the ref's ≈⅓ of transitions. | tuning (SFX only on scene transitions / slams for LB) |

### I. Production

| # | Reference R6 | Our v3 | Gap | Fix |
|---|---|---|---|---|
| 36 Export | 720×1280 30 fps H.264 High 342 kb/s + HE-AAC 56 kb/s (IG re-encode). Flat vector UI + **static raster photos/logos**; deterministic (no blur, particles or video). | 1080×1920 30 fps, deterministic HF stage. | Photos/logos need an asset pipeline; render cost is unchanged. | asset pipeline |

---

## 5. NEW COMPONENTS / SECTIONS (not in our catalog)

Geometry is in 1080 space. The ops follow the `catalog.js` conventions (`op {args}`).

### 5.1 `lbHeader`: segmented header + live counter (chrome)
- **Anatomy.** Bar 994×55 at (44,236), white, r 12, 1.5 px #DBDFE1, soft shadow.
  - Brand block 265.5 w, #111923, 4-square icon + white heavy caps cap 17.
  - Chapter segment: mono caps cap 15 #4A4F55, text `NN TITLE`, centred.
  - Counter segment: 1.5 px divider; user icon (#1F4DBD, or grey when 0); number mono bold cap 22.5 #1F4DBD; `USERS` micro caps cap ≈10 #7E848B, right-aligned to x ≈1020. The segment width follows the number.
- **Data.** `brand`, `chapter{n,title}`, `metric{value, unit, label, format: compact}`.
- **Motion.**
  - `chapter` swaps in 1 f.
  - Counter `tick {to, dur}` ease-out over 0.57–1.2 s, formatted 0, 1, 606, 1,000, 22K, 192K, 250K, 1M, 1.9M, 5M, 8.4M, 20M, 50M (thousands separators under 10 K, then K/M with 1 decimal under 10).
  - Colour grey → blue on the first nonzero value.
- **Anchoring.** Chapter on the sentence start (≤+0.2 s). Counter on the number word ("thousand" +0.17, "traffic grows").
- **Props.** `{brand, icon, chapter:{n,title}, metric:{value:0, label:"USERS", icon:"users"}}`.
- **Ops.** `chapter {n,title}`, `tick {to, dur?}`.

### 5.2 `tracker`: component chip row (chrome)
- **Anatomy.** N chips (≤9) in one centred row, y 303–340.5, gap ≈9.
  - Chip: h 37.5, r 9, mono caps cap ≈10.5, 7.5 px dot.
  - Ghost: 1.5 px dashed #C5C9CB, text #64686C, hollow dot.
  - Lit: white fill, solid #DBDFE1 border, dot #7643FF, text #2C3030.
- **Motion.** `light {chip}`: 7–9 f pop (scale ≈1.05 → 1, border dashed → solid, dot fill). Chips only accumulate; nothing un-lights.
- **Anchoring.** On the component noun, median +0.07 s.
- **Props.** `{items:[string]}`.
- **Ops.** `light {chip}`.

### 5.3 `noteCard`: left-column thesis card (chrome)
- **Anatomy.** 225×151.5 at (60,384), white, 1.5 px border, r 12, 6 px left bar in the kind colour.
  - Eyebrow: icon + caps cap 15 in the kind colour.
  - Body: Inter 600 cap 18 #111, ≤3 lines, ≤32 chars.
  - Kinds: `rule` (grey #5A6068, ✂-ruler icon), `problem` (red, ⚠), `fix` (purple, wrench), `goal` (blue, target), `cost` (red, scales).
- **Motion.** `note {kind, text}`: 1-f content swap + scale pulse 1.0 → 1.02 → 1.0 over 6 f (ease-out). About every 2.6 s.
- **Anchoring.** Sentence start or its key clause (−0.2…+0.3 s).
- **Props.** `{kind, text}`.
- **Ops.** `note {kind, text}`.

### 5.4 `blueprint`: persistent growing architecture host (the signature section)
- **Anatomy.**
  - Canvas 717×966 at (301.5,373.5), white, r 12, border + shadow.
  - Title bar h 42: ✂-ruler icon + mono caps `BLUEPRINT · SOCIAL APP` #6B7075, and a **version chip** `Vn` (lavender fill #EFEAFB, purple text) right-aligned.
  - Interior grid 24 px.
  - **Nodes** (white tile, 1.5 px border, r 10, soft shadow): icon tile 36 px (brand logo or line icon) + caps label cap 19.5 + mono sub cap ≈10.5.
  - Special nodes:
    - `users` pill: 5 photo avatars + "+" + `USERS / phones · browsers`;
    - `machine` box with rows (BACKEND / DATABASE + `×1` badges);
    - `group`: dashed purple r 12 outline + a label chip (`SHARD 1 · USERS A–M`).
  - **Edges**: 1.5 px grey orthogonal routing with **bus** fan-outs; dashed amber (replication) and dashed purple (groups).
  - **Annotations**: pills anchored to a node or edge (lavender, green, red).
- **Data.** A graph that only grows: users → LB → servers ×N → cache → db (+ replicas, shards) → storage, CDN, queue, workers, observability. Each version adds 1 component.
- **States.**
  - node `normal`;
  - `alert` (pink fill #FBE6E6, red 1.5 px border, 6 px pink outer ring, red caps label);
  - `crashed` (red ✕ over the node);
  - `lit` (purple outline);
  - `ghost` (dashed).
- **Motion.**
  - Host enter by slide-right (233–333 ms, power3/expo.out) or rise (333 ms), or a hard cut. Exit right, drop, or cover.
  - `add` node: pop scale 0.9 → 1 + fade over ≈4 f, connectors draw.
  - **`refit`**: the whole graph rescales/recentres to fit the canvas when the version grows (V1 box 450 w → V9 full graph).
  - `packet` loops (dots Ø15 on edges, continuous while the host is idle).
  - `alert` / `crash` in 1–2 f.
  - Annotation pop.
  - Version chip `Vn` swaps in 1 f.
- **Anchoring.** Node add on its noun (+0.02…+0.1), alert on the problem word ("bottleneck", "crashes" +0.2), annotation on the explanatory clause.
- **Props.**
  - `{title, version, nodes:[{id, kind: users|node|machine|group, icon|logo, label, sub, tone?, hidden?}], edges:[{from,to,style: solid|dashed|replica, route: bus|elbow}], layout: "auto" | [{id,x,y}], fit: "auto"}`.
- **Ops.**
  - `add {node|nodes}`, `connect {from,to}`, `alert {node}`, `crash {node}`, `clear {node}`, `annotate {at, text, tone, icon}`, `unannotate`, `packet {path, loops, tone}`, `version {n}`, `refit {dur?}`.
- The host must persist across scenes (the same instance is recalled with its accumulated state, like the DH carrier).

### 5.5 `sceneTransition`: motion transitions between content stacks (capability)
- **Kinds (measured).**
  - `push-left`: outgoing stack power3.in 200 ms to x −800, **over the mascot**, ≈50 ms stagger per card, then 1 blank f.
  - `drop-rise`: outgoing power2.in down ≈7 f; incoming power3.out up ≈333 ms from +700 px; overlapping; the incoming layer is above the caption.
  - `exit-right`: power2.in + fade 6–7 f; the next enters.
  - `slide-in-right`: power3/expo.out 233–333 ms from +480…+600 px.
  - `cover`: the new card slides from the right over the old one, which drifts left underneath (≈8 f).
  - `tumble`: each card rotates ±10–20° and falls down-left, 7 f, ease-in.
  - `cut`: 1 f.
- **Props.** Scaffold-level `transition: {out, in}`.
- **Ops.** None (scaffold boundary). It needs a z-order switch so content can pass over the mascot and caption during the transition.

### 5.6 `jargonCloud`
- **Anatomy.** Eyebrow `? PEOPLE HEAR…` (mono caps cap 15 at (33,295)).
  - Big chips: h ≈102, logo tile 57, heavy caps cap 28, tilt −4…+3°.
  - Small chips: h ≈51, logo 27, caps cap 16.
  - 20–26 chips over x 330–1080 (they may bleed off the right edge), overlapping allowed.
- **Motion.**
  - `drop {chip}`: 333 ms back.out, from scale 1.16 at offset (+135,−46) (E2).
  - `flood`: remaining chips at a ≈33 ms stagger.
  - `scatter`: fly out right, 5 f.
- **Anchoring.** Each term on its word (+0.05).
- **Props.** `{eyebrow, big:[{label, logo}], small:[{label, logo}]}`.
- **Ops.** `drop {chip}`, `flood`, `scatter`.

### 5.7 `phone`: device mockup with app states
- **Anatomy.** 330×675 (x 330–660 at y 421.5, or column-left 342–648 × 432–1083), black bezel ≈12 px, r ≈48, notch pill, status bar `9:41`. App header (`circle` + ♡ ✈) and a bottom tab bar (5 icons).
- **Screens.**
  - `blank`.
  - `feed`: avatar + name, photo, action row, caption, next post.
  - `post`: `New post` / `Share`, photo/video still with ▶ and a `0:42` duration, caption, file row `trip.mp4 480 MB`, progress bar #2D6BE0, a `Processing… 8.9 s` spinner + live timer.
- **Motion.** Rise-in 433 ms power3.out. Screen content swaps (feed loads on "feed"). The timer counts up in real time.
- **Props.** `{screen, app, items, image, file, timer}`.
- **Ops.** `screen {name}`, `timer {from,to}`, `progress {to}`.
- **Needs** the image slot (§5.19).

### 5.8 `reqList` / `jobList`: dashed rows that light per item
- **Anatomy.** Panel 327–333 wide beside the phone.
  - Eyebrow (`⇅ REQUESTS` blue / `THEN THE BACKEND MUST…` grey).
  - Rows h ≈61–80, dashed 1.5 px border r 9. Mono verb + path, or icon + caps label + right value `1.2 s`.
  - Optional total row `USER WAITS 14.2 S`.
- **States.** Ghost (dashed), lit-blue (#E3EBF9 fill, blue border), alert (pink fill, red border, red text), total-alert (solid red #AF2231, white text).
- **Motion.** Per-row 1–2 f recolour on its word (+0.07…+0.22).
- **Ops.** `rowLit {row, tone}`.
- **Props.** `{eyebrow, rows:[{verb?, path?|label, icon?, value?}], total?}`.

### 5.9 `hitCounter` + `dotGrid` + `vsCards` (the cache lesson, scene 7)
- **Profile card** 717×246: avatar photo Ø120, handle heavy cap 28, route pill (blue mono), big counter mono cap ≈42 blue + `REQUESTS`.
- **Dot grid**: 5 rows × 20 cols, dot 22.5 r 4.5, pitch 34.5, x 316.5–994.5 × 700.5–858; eyebrow `EACH DOT = 100 REQUESTS`.
  - Motion: `fill` raster 1.0 s linear; `mark {i, tone:amber}`; `sweep {tone:purple, dur:0.8}`.
- **Vs cards**: 2 × 349.5×441, dashed until lit. Logo + name + mono sub; value mono cap 64.5; label caps; footer mono `~0.3 ms each`.
  - Motion: winner lit (solid border, purple value), loser stays grey.
- **Props.** `{profile:{avatar,handle,route}, count, perDot, cards:[{title,sub,value,label,foot,logo}]}`.
- **Ops.** `count`, `fill`, `mark`, `sweep`, `lit {card}`.

### 5.10 `splitTable`
- **Anatomy.** Table card 717×432: header `USERS · 20M ROWS`, 3 columns (NAME as a pill with a letter badge, ID mono, JOINED), 10 rows pitch ≈42. Two dashed bins 349.5×360 below (`SHARD 1 users A–M` / `SHARD 2 users N–Z`).
- **Motion.** `cut {after}`: purple 1.5 px line with ✂ drawn across (≈200 ms). `move {rows, bin}`: row pills fly into the bin (stagger).
- **Ops.** `cut`, `move`.

### 5.11 `sizeBar` (files lesson)
- **Anatomy.** Item row: `USER ROW 1 KB` icon tile, photo still 198×168 r 12 `PHOTO 4 MB`, video still 330×168 with a ▶ disc `VIDEO 480 MB` (red sizes). DB card 723×642: title + mono sub, size right (`12 GB → 210 GB → 3.8 TB`), a vertical capacity well where coloured bands stack (green rows at the bottom, red `PHOTOS`, `VIDEOS` bands with icons), and a red banner `⊘ BLOBS DON'T BELONG HERE`.
- **Motion.** Items appear per noun; bands grow up with the size counter; banner slam.
- **Ops.** `item {i}`, `band {name, to}`, `size {to}`, `banner`.

### 5.12 `worldMap` (dot-matrix)
- **Anatomy.** Card 717×426, eyebrow (`WHERE THE PHOTOS ARE SERVED FROM` / `FOUR REGIONS, ONE APP`), a dotted continents raster (≈7 px pitch, grey #A9AEB3 dots).
- **Markers.** Origin ■ with a mono label; purple rings Ø ≈24 (edges); region boxes 60×45 green tint with a dot + mono label (`us-east-1`), red ✕ state.
- **Motion.** Arcs draw from the origin; rings pop in a stagger; region → red ✕ in 1–2 f on its word.
- **Props.** `{title, origin?, points:[{lat,lon,label?,kind:edge|region}]}`.
- **Ops.** `pop {points}`, `arc {from,to}`, `fail {region}`.

### 5.13 `latencyBars`
- **Anatomy.** Card 717×468: eyebrow with icon, per bar a caps label cap 24 + a track #F6F6F6 h ≈30 r 15 + fill (red #E2464B / purple #7E4CFF) + a mono value cap 28 in the fill's dark shade; footer divider + mono note.
- **Motion.** Bars fill on their clause (ease-out ≈0.6 s).
- *Extension of `bars`*: add `valueRight`, `caption`, `footer`, per-bar tone.

### 5.14 `featureRows` / `costCards` / `techCards`: the **ghost → lit** list family
- **Anatomy.**
  - featureRows: 717×165, icon tile 72 (lavender), title cap 28, mono sub, right mini-visual.
  - costCards: 717×293, logo + name, red consequence cap 36, right mini-visual.
  - techCards 2×2: 346.5×436.5, illustration/logo, title cap 32, mono sub.
- **States.** Ghost (dashed #C5C9CB border, grey text, faded visual, no shadow) → lit (solid border, ink, shadow, visual in colour).
- **Motion.** Lit in 2–4 f on its word. Exits: cut or `tumble`.
- **Ops.** `lit {i}`, `tumble`.

### 5.15 `displayHeadline` (dim → lit, left-aligned)
- **Anatomy.** 3–6 lines, heavy grotesk caps cap 81, pitch 111, left edge x 307.5 in the content column.
- **Motion.** Cut in at dim #5A6269, then `lit` (1–2 f) to #141920 with key words in red #AE2435 (or kept grey and later red). Optional companions below: ✕ / ✓ rows (pink/green tint strips 717×≈100, Inter 600 cap 22) or tiles.
- **Anchoring.** Lit on the first key word (−0.1…+0.1).
- **Ops.** `lit {words?}`, `tone {word, tone}`.
- *Extends `headline`* with `align:left`, `state:dim`, per-word tone.

### 5.16 `strikeStrips`
- **Anatomy.** Two 717×156 strips: eyebrow `✕ THE GOAL ISN'T` (red) / `✓ IT'S` (green) + caps cap 36.
- **Motion.** `strike`: 6–7.5 px #E8474E line, 333 ms power2.inOut, 556 px, drawn along the lower half of the caps.
- **Ops.** `strike`, `lit {strip}`.

### 5.17 `obsTriptych`
- **Anatomy.** Three 717×297 panels, each: icon + heavy caps title cap 24 + tool logos at the right.
  - LOGS: 5 mono lines (`time LEVEL msg`, level colours green / amber / red, ERROR row pink).
  - METRICS: blue line chart with 3 gridlines + a red spike marker `p99 840 ms` + mono axis caption.
  - TRACES: waterfall, 6 labelled rows with offset bars (blue; the slow span red), right mono durations.
- **Motion.** Panel lit per noun; the line draws; waterfall bars grow in sequence (≈1.6 s); `blackout`: contents replaced by red `?` (cap ≈40) per panel.
- **Ops.** `lit {panel}`, `draw`, `grow`, `blackout`.

### 5.18 `logoGrid` + counter, `costMeter`, `cycle`, `matcher`, `stamp` v2
- **logoGrid**: tiles 105×105 r 12 (white, logo 40), 6 columns, pitch ≈120; red counter top-right (cap ≈30). Accelerating pop-in (stagger shrinking to ≈1 f); counter follows.
  - Ops: `flood {to, dur}`.
- **costMeter**: 9 rows 496.5×79.5 pitch 96 (icon + caps + red `+1`), stacking **bottom-up** at a 133 ms stagger. Vertical meter 58 wide × (y 440–1236) r 29, gradient amber #F0A020 (bottom) → red #B8202F (top), fill ease-in in step with the rows; `×N` counter below.
  - Ops: `stack`, `fill`.
- **cycle**: title caps cap 36; 4 cards 327×313.5 (number badge, purple #5B32D6, white digit; caps cap 32; mono sub; icon top-right), grey chevron arrows (→ ↓ ← ↑); card 4 ghosted; lap tracker 717×106.5 with 9 dashed chips that fill purple.
  - Ops: `lit {step}`, `laps {to}`.
- **matcher**: right column 6 component chips 327×109.5 pitch 132 (logo + caps); left column ghosts `⚠ WHY WAS IT ADDED?` → red problem cards (pink tint, red border, red text cap 20); → arrows. Title swaps in place.
  - Ops: `lit {chip}`, `ghosts`, `answer {i, text}`, `title {text}`.
- **stamp v2**: 3 px red border, rotation ≈ −5°, heavy caps 2 lines (cap ≈40) #891E2F, slam **1.30 → 1.0 in 167 ms** power2.out (ours 1.15 / 100 ms). Pairs with a sub-line of logos + `×10` + Inter 600 caption.

### 5.19 Image slot (capability used by 5.4, 5.7, 5.9, 5.11, 5.18)
- **Where it appears.** Avatars (circular Ø ≈40 with a 1.5 px white ring, overlapped −8 px; Ø120 profile) and stills (r 12 cards; a phone feed image cover-cropped to the screen width).
- **Behaviour.** All static (verified), with an optional ▶ disc overlay (#000 at ≈45 %, white triangle) to signal a video without playing it.
- **Implementation.** `<img>` with `object-fit: cover` inside a rounded/circular mask. The asset comes from a licensed stock/brand pack via `media-use`. Seek-safe because it is static.
- **Props.** `{src, shape: circle|rounded, ring?, play?}`.

---

## 6. Pacing numbers

| Metric | R6 | Note |
|---|---|---|
| Beats / min | **52.1** (machine onsets > 0.3 %; 48.6 at > 0.15 %) | caption excluded; continuous packet/counter motion merges some beats, so this is a lower bound |
| Scenes / min | 13.1 (34 scenes) | 16 hard cuts, 18 motion transitions |
| Scene life | median **3.67 s**, mean 4.58, max **25.4 s** (BP 23.3–48.7) | the BP is 35 % of runtime over 10 visits |
| Note swaps | ≈55 (median 2.6 s) | — |
| Longest hold | no content onset for 3.73 s (29.77 →; packets run); **longest fully still span 1.70 s** (142.2) | 37.2 % of frames have no graphic change |
| Caption chunks | 163, 3–4 words, life median 0.93 s | — |
| wpm | **196** (505 words / 154.7 s) | max inter-word gap 0.54 s |
| Word → visual lag | median **+0.08 s** (p10 +0.02, p90 +0.20), n = 36; caption flips +0.04 | `[ASR?]` ±0.1 s |

---

## 7. Prioritised gap list (R6 → our v3)

1. **Scene transition layer** (§5.5).
   - Push-left over the mascot, drop-out/rise-in swap, slide-in-right, exit-right, cover, tumble, each with its measured duration/easing.
   - A z-order switch so content can pass over the mascot and caption.
   - Today every scaffold change is a hard cut; 18 of 34 R6 scene changes are motion transitions.
2. **Persistent growing blueprint host** (§5.4).
   - Graph with add / alert / crash / annotate / packet / version / **refit** ops.
   - Recalled across scenes with its accumulated state, holding up to ≈20 nodes, bus routing and groups.
   - Our `nodes` card is limited to 2–6 nodes and a fixed layout.
3. **LB profile chrome.**
   - `lbHeader` (chapter + compact animated users counter).
   - `tracker` component chips.
   - `noteCard` (RULE / PROBLEM / FIX / GOAL / COST, ≈21 swaps/min).
   - Cool light theme #EDF1F3 + 40/200 px line grid.
   - Marker-highlight caption skin (#FEE587, 56 px, 1-blank-frame swap + 3-f pop).
4. **Image slot + asset pipeline** (§5.19): avatars, photos, video stills with a ▶ overlay, and brand logos (Redis, Kafka, Kubernetes, S3, Cloudflare…). There is no `<img>` support in `lib/stage` today. This also unblocks R8.
5. **Ghost → lit list family and new explainer modules.**
   - featureRows / costCards / techCards / matcher / cycle.
   - phone, jargonCloud, dotGrid + vsCards, splitTable, sizeBar, worldMap, latencyBars, obsTriptych, logoGrid, costMeter.
   - displayHeadline dim → lit, strikeStrips (333 ms inOut), stamp v2 (1.30 → 1.0 / 167 ms).
6. Storyboard rules.
   - Hook = the final-state artefact + a callback at the end.
   - Every new component couples BP node + tracker chip + FIX note.
   - Enumerations are pre-built as ghosts and lit per word.
   - The persona recurs.
7. Tuning.
   - Content column 301.5–1018.5 × 402–1330, stack gap 21.
   - Display face (geometric grotesk).
   - 196 wpm.
   - SFX only on transitions/slams.
   - Blink 133 ms / 2.9 s.
   - Big counters power2.out 1.2 s.
