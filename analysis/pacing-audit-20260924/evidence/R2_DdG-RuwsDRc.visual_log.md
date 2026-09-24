# R2_DdG-RuwsDRc — visual log (blue-green deployment, 145.6 s, 1080x1920, 30 fps)

Method: I read all 49 contact sheets (8 fps, 0.00–145.50 s) in order, then rendered 30 fps strips for 20 windows
(0.20, 1.55, 4.00, 29.30, 32.80, 56.80, 58.00, 58.60, 60.60, 70.00, 71.30, 103.30, 104.60, 104.70, 109.20, 129.80, 138.80, 140.35, 25.40, 63.80 s).
Timestamps from the sheets are ±63 ms (one 8 fps tile). Timestamps measured on strips are ±17 ms.
Anchor codes: **A** = the thing shown is the thing said, within about 0.3 s. **L** = semantic match, but it leads or lags the word by 0.3–1.5 s. **F** = free-running or structural, with no word match.

---

## 1. BEAT LOG (entire video)

**Caption style (logged once, not per chunk).** Captions are a single line centred at about 74–80 % of frame height (y ≈ 1420–1540 px), about 30–60 % of frame width. The text is heavy sans (Inter-like bold), white on a near-black box. The box has a thin light (white/grey) 1–2 px border and a hard blue offset drop-shadow at bottom-right (seen at 25.40–25.73 strip).
- **Highlight:** one word at a time turns bright blue (`#5aa0ff`-ish) in sync with speech (e.g. "You've" blue at 25.567, "just" next). The other words are white or light grey.
- **Chunk size:** 2–5 words per chunk. Examples: "How do companies deploy", "a new version of", "works.", "them.".
- **Chunk rate:** a new chunk comes every ~0.6–1.5 s.
- **Chunk swap:** the old chunk dims for 1 frame (25.500), and the new chunk appears at about 30 % opacity (25.533), then reaches full opacity at 25.567. That makes a ~67 ms crossfade, with no slide, no scale and no bounce.
- **Sentence ends:** a single-word chunk stays until the next sentence ("works." 1.375–1.62, "normally." 25.0–25.45).

Mascot (continuous, not logged per beat): a cartoon scientist character holding a sticker-covered laptop sits at the left edge.
- **Mouth:** it flaps almost constantly while narration runs.
- **Blinks:** it blinks about 20 times, in 133 ms close/open pairs (e.g. 2.117, 7.00, 12.0, 14.4, 19.4, 36.6, 39.0, 68.5, 93.1, 98.1, 100.5, 130.1).
- **Position:** it is on screen during 1.7–57.3, 66.0–75.5, 83.9–101.7 and 113.9–131.3.

| # | t (s) | type | what changed | region (% of frame height) | est. motion (ms) | narration at that moment | anchor |
|---|---|---|---|---|---|---|---|
| 1 | 0.23 | appear | BLUE label + blue card tint fade in (left env card) | 25-40 | 133 | blue@0.16 | A (anchored) |
| 2 | 0.63 | appear | GREEN label + green tint (right env card) | 25-40 | 100 | -green@0.40 | A (anchored) |
| 3 | 1.10 | recolor | DEPLOYMENT label brightens | 45 | 150 | deployment@0.62 | L (semantic, offset 0.3-1.5s) |
| 4 | 1.68 | cut | HARD CUT to browser-mockup scaffold (product grid) | 18-60 | 0 | How do@1.62 | A (anchored) |
| 5 | 1.72 | move | mascot slides in from left + fades up | 28-72 (x0-25%) | 170 | How do companies@1.62-1.90 | A (anchored) |
| 6 | 1.75 | appear | 'THE PROBLEM' label | 17 | 100 | companies@1.90 | F (free-running) |
| 7 | 2.37 | appear | orange 'Deploying v2.0.0' pill above browser | 20 | 130 | deploy@2.24 | A (anchored) |
| 8 | 3.63 | disappear | browser content slow fade to dark | 22-45 | 840 | taking@3.76 | A (anchored) |
| 9 | 4.30 | appear | red '503 Service Unavailable' crossfades in, bg snaps black at 4.50 | 28-38 | 200 | offline@4.58 | A (anchored) |
| 10 | 5.25 | swap | scaffold swap: HUD bar (shop.example.com / PROD / v1.4.2 / 0.4% errors) + shrunken browser + Env A/B cards | 13-60 | 130 | One common answer@5.18 | A (anchored) |
| 11 | 5.38 | appear | title 'BLUE-GREEN DEPLOYMENT / ONE COMMON ANSWER' | 17-20 | 130 | common answer@5.34 | A (anchored) |
| 12 | 5.88 | appear | purple router pill 'listener :443 forward' | 38 | 130 | is@5.90 | F (free-running) |
| 13 | 7.00 | mascot | mascot blink (one of ~20 blinks; mouth flaps continuously) | 30-36 | 100 | simple@7.74 | F (free-running) |
| 14 | 8.25 | swap | browser/title out; users row + router + single PRODUCTION card | 28-60 | 0 | Instead of having one@8.14 | A (anchored) |
| 15 | 9.13 | move | PRODUCTION card slides left, ghost 2nd card ('IDENTICAL') fades in | 45-60 | 250 | production environment@9.02 | A (anchored) |
| 16 | 10.00 | recolor | 2nd card brightens to full | 45-60 | 250 | keep two@10.16-10.36 | A (anchored) |
| 17 | 10.88 | text | card headers swap to BLUE / GREEN | 45 | 0 | Let's call them@10.74 | L (semantic, offset 0.3-1.5s) |
| 18 | 11.50 | recolor | BLUE card tints blue | 45-60 | 125 | blue@11.36 | A (anchored) |
| 19 | 11.88 | recolor | GREEN card tints green | 45-60 | 125 | green@11.74 | A (anchored) |
| 20 | 12.50 | text | users dim; router gains 'blue-tg 100% green-tg 0%' | 28-38 | 130 | Right now@12.26 | F (free-running) |
| 21 | 12.88 | appear | connector router->blue + LIVE tag on blue card | 40-47 | 130 | blue is live@12.96-13.34 | A (anchored) |
| 22 | 13.00 | text | HUD pill PROD->BLUE | 13 | 100 | blue@12.96 | A (anchored) |
| 23 | 13.63 | recolor | users row re-brightens | 28-31 | 150 | All your users@13.76-14.10 | A (anchored) |
| 24 | 14.00 | flow | dotted flow line users->router starts pulsing | 30-38 | loop | hitting blue@14.58 | L (semantic, offset 0.3-1.5s) |
| 25 | 15.38 | recolor | GREEN card rows dim (idle pulse) | 45-60 | 250 | Green exists@15.22 | A (anchored) |
| 26 | 17.00 | appear | '0%' pill on dashed connector to green | 42 | 130 | traffic@16.98 | A (anchored) |
| 27 | 18.38 | swap | users row replaced by browser window slotting into top slot | 22-37 | 130 | Now imagine@18.36 | A (anchored) |
| 28 | 18.50 | appear | 'A REAL EXAMPLE' label | 17 | 100 | Now imagine@18.58 | A (anchored) |
| 29 | 18.63 | swap | browser skeleton -> product grid | 22-37 | 130 | e-commerce app@19.52 | L (semantic, offset 0.3-1.5s) |
| 30 | 20.38 | disappear | label removed | 17 | 0 | Version 1@20.26 | F (free-running) |
| 31 | 21.00 | appear | yellow 'v1.4.2' row highlight on blue card | 55 | 130 | live on blue@20.98-21.42 | A (anchored) |
| 32 | 22.38 | appear | product tile 1 outline highlight | 25-32 | 130 | browse@22.44 | A (anchored) |
| 33 | 23.25 | appear | product tile 2 outline highlight | 25-32 | 130 | add items@23.30 | A (anchored) |
| 34 | 24.25 | swap | browser content swaps to order summary + PAY button | 22-37 | 250 | cart@23.98 / check out@24.46 | A (anchored) |
| 35 | 26.13 | appear | 'app v2.0.0' pill top-right | 28 | 130 | version 2@26.16 | A (anchored) |
| 36 | 27.25 | swap | browser blanks -> new checkout w/ orange EXPRESS ONE-CLICK bar (27.38) | 22-37 | 250 | adds a new checkout@27.20-27.60 | A (anchored) |
| 37 | 28.63 | appear | orange 'THE RISKY WAY' label | 17 | 100 | risky@28.58 | A (anchored) |
| 38 | 29.47 | move | v2 pill travels down through browser + router into BLUE card | 27-50 (x55-85%) | 730 | deploy version 2@29.58-30.16 | A (anchored) |
| 39 | 30.13 | text | blue card rows flicker to v2 | 45-60 | 250 | directly on top@30.40 | A (anchored) |
| 40 | 31.25 | text | blue card header v1.4.2 -> v2.0.0 (yellow) | 45 | 100 | of blue@31.38 | A (anchored) |
| 41 | 31.75 | swap | browser removed; users row returns | 28-31 | 0 | If checkout breaks@31.66 | A (anchored) |
| 42 | 32.00 | appear | red '500 POST /checkout' banner | 18-22 | 130 | breaks@32.24 | A (anchored) |
| 43 | 32.93 | recolor | users turn red one by one (random order, 9 users) | 28-31 | 530 | every customer@32.70-32.84 | A (anchored) |
| 44 | 33.50 | counter | HUD error % ticks up, red (0.4%->21.7%) | 13 | 250 | sees it immediately@33.26-33.64 | A (anchored) |
| 45 | 34.25 | swap | reset: banner out, users white, blue back to v1, v2 pill reappears top-right | 13-60 | 130 | So instead@34.22 | A (anchored) |
| 46 | 35.13 | move | v2 pill travels into GREEN card | 27-50 | 650 | deploy version 2 to green@34.90-35.88 | A (anchored) |
| 47 | 36.38 | text | green header v2.0.0 + rows update; users->router flow | 45-60 | 130 | Blue keeps serving@36.28 | L (semantic, offset 0.3-1.5s) |
| 48 | 38.25 | appear | 'v2.0.0 DEPLOYED' yellow line on green card | 58 | 130 | Green gets the new release@38.10 | A (anchored) |
| 49 | 39.63 | swap | users row out; 'TEST IT PRIVATELY' label | 17-31 | 130 | Now you test green@39.50 | A (anchored) |
| 50 | 39.75 | appear | test console window (POST /login, /cart, /payments, INSERT orders, GET /health) | 22-37 | 130 | test@39.92 | A (anchored) |
| 51 | 40.63 | draw | yellow curved bypass line console->green | 35-47 (right edge) | 250 | privately@40.38 | A (anchored) |
| 52 | 40.88 | appear | 'BYPASSES THE LOAD BALANCER' micro-label | 20 | 100 | privately@40.38 | L (semantic, offset 0.3-1.5s) |
| 53 | 41.38 | appear | POST /login check + 200 | 23 | 100 | log in@41.54 | A (anchored) |
| 54 | 42.25 | disappear | label hides | 17 | 0 | Can they@42.20 | F (free-running) |
| 55 | 43.00 | appear | POST /cart check + 200 | 24 | 100 | add products@42.78 | A (anchored) |
| 56 | 44.38 | appear | '200 OK' badge pops at console right | 27 | 100 | checkout page call@44.16-44.72 | A (anchored) |
| 57 | 44.63 | appear | POST /payments check | 25 | 100 | payment API@45.06 | L (semantic, offset 0.3-1.5s) |
| 58 | 46.25 | appear | INSERT orders check + green rows 'HEALTHY' | 26 + 45-60 | 130 | order@46.44 | A (anchored) |
| 59 | 48.25 | appear | 'green-tg 3/3 healthy' badge + GET /health check | 18 | 130 | health checks@48.16 | A (anchored) |
| 60 | 50.38 | appear | orange 'TESTS FAILED' pill | 18 | 100 | broken@49.80 / no problem@50.24 | L (semantic, offset 0.3-1.5s) |
| 61 | 50.63 | recolor | green card dims | 45-60 | 250 | no problem@50.36 | L (semantic, offset 0.3-1.5s) |
| 62 | 51.13 | recolor | blue card border highlight | 45-60 | 250 | Your customers@50.92-51.14 | L (semantic, offset 0.3-1.5s) |
| 63 | 52.63 | swap | reset: TESTS FAILED out, checklist resets, green re-brightens | 18-60 | 130 | You fix green@52.78 | A (anchored) |
| 64 | 53.75 | appear | checklist re-runs row by row (~150ms stagger) | 22-37 | 630 | try again@53.86 | A (anchored) |
| 65 | 54.50 | swap | console out, users row back; green header READY 3/3 | 28-60 | 130 | Now let's say@54.56 | A (anchored) |
| 66 | 56.38 | appear | 'THE IMPORTANT MOMENT' label | 17 | 130 | important@56.62 | A (anchored) |
| 67 | 56.87 | recolor | whole diagram dims | 28-60 | 130 | moment@56.94 | A (anchored) |
| 68 | 57.27 | move | mascot exits left (ease-in) | 28-72 | 170 | Instead@57.26 | A (anchored) |
| 69 | 57.50 | cut | HARD CUT reframe: zoomed-in router + full-width cards, no mascot | 35-60 | 0 | Instead of deploying@57.26 | A (anchored) |
| 70 | 57.73 | appear | 'deploy again' option row | 22 | 100 | deploying@57.94 | A (anchored) |
| 71 | 58.10 | draw | strike-through line draws across 'deploy again' | 22 | 120 | again@58.20 | A (anchored) |
| 72 | 58.77 | appear | 'SWITCH THE / TRAFFIC' headline, 2 lines staggered 133ms, rise+fade | 17-25 | 230 | switch the traffic@58.72-59.12 | A (anchored) |
| 73 | 59.63 | swap | headline out; 12-user row returns full width | 25 | 130 | The load balancer@59.60 | A (anchored) |
| 74 | 60.77 | counter | lever swings + counters blue 100->0 / green 0->100 | 30-55 | 500 | stops sending users to@60.46-61.28 | A (anchored) |
| 75 | 62.13 | recolor | blue card dims | 45-60 | 130 | starts sending@62.18 | A (anchored) |
| 76 | 62.90 | move | LIVE tag moves blue->green | 45 | 130 | green@63.00 | A (anchored) |
| 77 | 63.93 | appear | '0.00s DOWNTIME' stat box | 18 | 100 | instantly@63.86 | A (anchored) |
| 78 | 64.30 | text | HUD pill backspace+retype BLUE v1.4.2 -> GREEN v2.0.1 | 13 | 300 | green becomes production@64.54 | A (anchored) |
| 79 | 66.00 | swap | scaffold swap: zoom out, mascot back, error-rate chart panel top | 17-60 | 125 | Now imagine@65.94 | A (anchored) |
| 80 | 66.13 | appear | 'FIVE MINUTES LATER' label | 17 | 100 | five minutes later@66.76 | L (semantic, offset 0.3-1.5s) |
| 81 | 67.25 | counter | clock pill '+00:0x' ticks; chart line crawls right | 20 | loop | later@67.22 | A (anchored) |
| 82 | 68.38 | recolor | chart tail turns orange | 22-28 | 250 | bad@68.66 | A (anchored) |
| 83 | 69.25 | swap | label -> 'was 0.4%' stat box | 17-20 | 130 | Checkout errors@69.30 | A (anchored) |
| 84 | 69.97 | draw | red error line shoots up (linear) | 22-30 | 550 | jumped@70.14 | A (anchored) |
| 85 | 71.47 | appear | big red '18%' slams in (scale ~1.3->1.0) + HUD error red | 17-20 | 130 | 18%@71.28 | A (anchored) |
| 86 | 72.13 | swap | chart -> red 'ROLLBACK?' pill + dim 'build v1.4.2' / 'deploy v1.4.2' rows | 17-25 | 130 | That's serious@71.94 | L (semantic, offset 0.3-1.5s) |
| 87 | 73.00 | recolor | build row brightens | 22 | 100 | rebuild@73.50 | L (semantic, offset 0.3-1.5s) |
| 88 | 73.25 | draw | red strike across build row | 22 | 130 | need to rebuild@73.26-73.50 | A (anchored) |
| 89 | 74.63 | recolor | deploy row brightens | 25 | 100 | redeploy@74.88 | A (anchored) |
| 90 | 74.80 | draw | red strike across deploy row | 25 | 130 | redeploy@74.88 | A (anchored) |
| 91 | 75.60 | cut | HARD CUT reframe: mascot gone, cards full width, chart top | 17-60 | 0 | Blue is still@75.60 | A (anchored) |
| 92 | 76.25 | recolor | green card dims | 45-60 | 130 | sitting there@76.04-76.30 | A (anchored) |
| 93 | 76.50 | appear | blue rows get healthy dots | 47-55 | 100 | sitting there@76.30 | A (anchored) |
| 94 | 77.13 | appear | 'LAST KNOWN GOOD v1.4.2' line on blue | 58 | 130 | previous working release@76.70-77.32 | A (anchored) |
| 95 | 78.25 | move | chart dims, router enlarges | 22-40 | 130 | switch@78.24 | A (anchored) |
| 96 | 78.75 | counter | lever + counters back to blue (7/93 -> 100/0) | 30-55 | 400 | traffic back@78.60-78.86 | A (anchored) |
| 97 | 79.13 | appear | 'SWITCH IT BACK' headline | 17-22 | 130 | Green to blue@79.34 | A (anchored) |
| 98 | 80.25 | swap | headline out; chart back | 17-30 | 130 | Customers@80.28 | A (anchored) |
| 99 | 80.50 | draw | chart line draws back down | 22-30 | 400 | back on@80.80 | A (anchored) |
| 100 | 80.63 | counter | HUD GREEN->BLUE, error 18%->1.9%->0.7% | 13 | 300 | Customers are back@80.28-80.98 | A (anchored) |
| 101 | 82.13 | swap | chart out; 'ONE ROUTING CHANGE' panel | 17-22 | 130 | That's the power@81.98 | L (semantic, offset 0.3-1.5s) |
| 102 | 83.88 | swap | scaffold swap: mascot slides back, compact router+cards pushed up, purple 'THE HARD PART' | 17-45 | 125 | But now we hit@83.78 | A (anchored) |
| 103 | 84.50 | appear | purple 'orders' DB table panel | 50-65 | 250 | database@85.02 | L (semantic, offset 0.3-1.5s) |
| 104 | 85.13 | draw | purple connectors cards->DB | 47-50 | 130 | database@85.02 | A (anchored) |
| 105 | 85.88 | disappear | label hides | 17 | 0 | Imagine@85.74 | F (free-running) |
| 106 | 87.38 | recolor | total_price row highlight | 60 | 100 | column@87.48 | A (anchored) |
| 107 | 88.50 | appear | SQL panel 'ALTER TABLE orders RENAME total_price TO order_total' | 17-22 | 130 | used to be called total price@88.26-89.08 | A (anchored) |
| 108 | 90.25 | text | DB cell text swap total_price -> order_total | 60 | 130 | order total@90.22 | A (anchored) |
| 109 | 91.25 | disappear | SQL panel out | 17-22 | 0 | Green understands@91.04 | A (anchored) |
| 110 | 92.38 | appear | amber pill 'expects total_price' above blue | 18 | 100 | column, but blue doesn't@92.28-93.22 | A (anchored) |
| 111 | 93.75 | swap | instant switch back: router blue 100%, LIVE->blue, HUD->BLUE (no tween) | 13-50 | 0 | So if you switch back@93.70-94.36 | A (anchored) |
| 112 | 95.25 | appear | purple pill 'SCHEMA STAYS ON THE NEW NAME' | 18 | 100 | changing the database@95.16-95.72 | A (anchored) |
| 113 | 96.38 | recolor | blue card row statuses turn red | 47-55 | 100 | blue may crash@96.28-96.68 | A (anchored) |
| 114 | 97.63 | appear | red error log 'column total_price does not exist' | 17-22 | 130 | expects@97.82 | A (anchored) |
| 115 | 99.25 | appear | error out; DB gains both columns (row insert) | 55-65 | 400 | This is why@99.26 | L (semantic, offset 0.3-1.5s) |
| 116 | 100.25 | appear | 'BACKWARD COMPATIBLE' purple title panel | 17-22 | 130 | backward compatible@100.82 | L (semantic, offset 0.3-1.5s) |
| 117 | 101.63 | move | mascot fades/slides out, cards removed | 28-72 | 250 | A common pattern@101.84 | A (anchored) |
| 118 | 101.88 | cut | scaffold swap: dim 'EXPAND AND CONTRACT' headline, 4-step tab bar, DB below | 17-65 | 125 | A common pattern here@101.84 | A (anchored) |
| 119 | 103.43 | recolor | 'EXPAND' dim -> bright purple | 22-26 | 100 | expand@103.12 | L (semantic, offset 0.3-1.5s) |
| 120 | 103.63 | recolor | 'AND CONTRACT' dim -> bright purple | 26-30 | 100 | contract@103.78 | A (anchored) |
| 121 | 104.80 | swap | headline out; ADD tab active; DB jumps up; SQL panel line 1 'ALTER TABLE orders' | 20-62 | 0 | First you add@104.62 | A (anchored) |
| 122 | 105.07 | type | typewriter line 2 'ADD COLUMN order_total numeric(10,2);' ~53 chars/s | 58-62 | 570 | add the new schema@105.24-105.62 | A (anchored) |
| 123 | 105.77 | appear | order_total row fades into pre-reserved slot | 58 | 100 | new schema@105.48-105.62 | A (anchored) |
| 124 | 107.25 | swap | RUN BOTH tab active; code 'total = row.order_total ?? row.total_price' typed | 20-62 | 300 | Then you deploy code@107.22 | A (anchored) |
| 125 | 108.50 | recolor | total_price row re-brightens (both lit) | 55-58 | 130 | both@108.74 | A (anchored) |
| 126 | 109.25 | appear | MIGRATE tab + 'ROWS MIGRATED 0' counter box + UPDATE SQL | 18 + 60 | 100 | migrate@109.54 | A (anchored) |
| 127 | 109.53 | counter | rows-migrated counter 0 -> 128,540 (ease-out) | 18 | 1400 | migrate the data@109.54-110.04 | A (anchored) |
| 128 | 111.25 | swap | counter out; REMOVE tab active | 18-20 | 0 | And only once@110.84 | L (semantic, offset 0.3-1.5s) |
| 129 | 111.63 | appear | '+7 DAYS LATER' pill | 17 | 100 | stable@111.80 | A (anchored) |
| 130 | 112.38 | appear | SQL 'ALTER TABLE orders DROP COLUMN total_price;' | 58-62 | 130 | remove@112.46 | A (anchored) |
| 131 | 113.13 | disappear | total_price row collapses out of DB | 55-60 | 130 | old schema@112.90-113.02 | A (anchored) |
| 132 | 113.88 | swap | scaffold swap: zoom out, users/router/cards back, mascot slides in, 'ANOTHER OPTION' | 17-60 | 250 | Now there's another option@113.80 | A (anchored) |
| 133 | 115.25 | appear | % step ticks (5/25/50/100) under router | 40 | 100 | Instead of switching@115.10 | L (semantic, offset 0.3-1.5s) |
| 134 | 116.38 | counter | lever demo: all traffic to green then snaps back | 30-55 | 1250 | switching all of your traffic to green@115.64-116.88 | A (anchored) |
| 135 | 117.75 | appear | amber 'ALL AT ONCE' pill -> text swaps at 118.0 | 16 | 100 | immediately@117.10 / first@118.14 | A (anchored) |
| 136 | 118.75 | counter | counters blue 100->95 / green 0->5 | 30-55 | 400 | small percentage@118.88-119.08 | A (anchored) |
| 137 | 120.00 | appear | error-rate chart panel (flat) | 18-30 | 130 | Watch the error rates@120.48-121.34 | L (semantic, offset 0.3-1.5s) |
| 138 | 120.13 | draw | flat chart line crawls right | 22-28 | 1400 | Watch the error rates@120.48 | A (anchored) |
| 139 | 122.25 | counter | counters -> 75/25 | 30-55 | 250 | 25%@122.06 | A (anchored) |
| 140 | 123.50 | counter | counters -> 50/50 | 30-55 | 250 | 50%@123.32 | A (anchored) |
| 141 | 124.25 | counter | counters -> 0/100 | 30-55 | 250 | everything@124.12 | A (anchored) |
| 142 | 124.63 | text | HUD -> GREEN v2.0.1 | 13 | 300 | everything@124.12 | L (semantic, offset 0.3-1.5s) |
| 143 | 125.00 | appear | 'CANARY ROLLOUT' label | 17 | 100 | canary rollout@125.50 | L (semantic, offset 0.3-1.5s) |
| 144 | 126.38 | appear | 'BLUE-GREEN' pill beside label | 17 | 100 | teams often combine@126.50-127.00 | A (anchored) |
| 145 | 127.38 | text | label -> 'TEAMS USE BOTH' | 17 | 100 | these ideas@127.62 | A (anchored) |
| 146 | 128.38 | swap | reset users/router/cards, HUD->BLUE, 'PICTURE IT LIKE THIS' | 13-60 | 250 | So the easiest way@128.24 | A (anchored) |
| 147 | 129.90 | camera | camera push: users/router fade, cards scale up + recentre (mascot occludes blue card) | 30-60 | 430 | blue-green deployment@129.74-130.22 | A (anchored) |
| 148 | 131.27 | move | mascot exits left | 28-72 | 170 | Blue@131.36 | A (anchored) |
| 149 | 131.50 | appear | spotlight cone + 'THE STAGE' label; green card dims | 17-35 | 130 | Blue is the stage@131.36-131.96 | A (anchored) |
| 150 | 132.25 | appear | audience (user) row below cards | 55-58 | 130 | audience@133.18 | L (semantic, offset 0.3-1.5s) |
| 151 | 133.75 | text | label -> 'BEHIND THE CURTAIN' | 17 | 130 | Green is@133.68 (curtain@135.42) | L (semantic, offset 0.3-1.5s) |
| 152 | 134.38 | appear | 'IDENTICAL' pill between cards | 30 | 100 | identical@134.28 | A (anchored) |
| 153 | 137.50 | text | label -> 'MOVE THE SPOTLIGHT' | 17 | 130 | Once green is ready@137.40 | L (semantic, offset 0.3-1.5s) |
| 154 | 137.88 | appear | green 'READY 3/3 HEALTHY' row | 40 | 100 | ready@138.12 | A (anchored) |
| 155 | 138.87 | move | spotlight slides blue->green + % counters | 20-55 | 270 | move the spotlight@138.68-139.00 | A (anchored) |
| 156 | 140.13 | text | label -> 'STRAIGHT BACK' | 17 | 100 | something breaks@139.94-140.18 | L (semantic, offset 0.3-1.5s) |
| 157 | 140.48 | recolor | green card flashes red (hard on/off) | 30-45 | 100 | breaks@140.18 | A (anchored) |
| 158 | 141.00 | move | spotlight slides back to blue + counters | 20-55 | 250 | move it straight back@140.94-141.44 | A (anchored) |
| 159 | 142.13 | cut | stage/audience removed, cards jump up, 'ONE TRAFFIC SWITCH' micro-label | 30-60 | 0 | Two environments@141.94 | A (anchored) |
| 160 | 143.00 | appear | 'ONE LIVE' big blue headline | 20-25 | 130 | One live@142.90 | A (anchored) |
| 161 | 143.63 | appear | 'ONE READY' big green headline | 25-30 | 130 | one ready@143.44 | A (anchored) |
| 162 | 144.38 | draw | switch line under cards draws outward | 60 | 250 | traffic switch@144.16-144.48 | A (anchored) |
| 163 | 145.38 | disappear | fade to black | full | 200 | them@145.00 | F (free-running) |

**Total visual beats counted: 163** (caption chunk changes excluded; mascot blinks/mouth counted once as #13).
Beat-type mix:
- appear 58
- swap (slot/content replacement) 24
- recolor 21
- text-change 13
- move 11
- counter 11
- line-draw 9
- disappear 7
- hard cut/reframe 5
- typewriter 1
- camera push 1
- flow loop 1

---

## 2. SCENE / SCAFFOLD STRUCTURE

| scaffold | range (s) | life (s) | beats inside | transition in |
|---|---|---|---|---|
| S1 Title env cards 'HOW IT WORKS' | 0.00-1.68 | 1.7 | 3 | video start |
| S2 THE PROBLEM: mascot + browser mockup | 1.68-5.25 | 3.6 | 6 | hard cut (0 frames) + mascot slide-in 170ms |
| S3 ONE COMMON ANSWER: HUD + browser + Env A/B | 5.25-8.25 | 3.0 | 4 | in-place re-layout, ~130ms fade |
| S4 Topology: users row / router / BLUE+GREEN cards (+mascot) | 8.25-18.38 | 10.1 | 13 | top-slot swap, ~130ms |
| S5 A REAL EXAMPLE / RISKY WAY: browser in top slot | 18.38-31.75 | 13.4 | 14 | top-slot swap (users->browser), ~130ms |
| S6 Failure + deploy-to-green (users row in top slot) | 31.75-39.63 | 7.9 | 8 | top-slot swap, hard |
| S7 TEST IT PRIVATELY: test console in top slot | 39.63-54.50 | 14.9 | 16 | top-slot swap, ~130ms |
| S8 Green ready / THE IMPORTANT MOMENT | 54.50-57.50 | 3.0 | 4 | top-slot swap, ~130ms |
| S9 Zoomed router+cards, no mascot (switch traffic) | 57.50-66.00 | 8.5 | 10 | mascot exit 170ms + HARD CUT reframe (zoom-in) |
| S10 FIVE MINUTES LATER: mascot + chart/rollback panel | 66.00-75.60 | 9.6 | 12 | re-layout within <=125ms (zoom-out, mascot back) |
| S11 Zoomed, no mascot: blue still sitting / switch back | 75.60-83.88 | 8.3 | 11 | HARD CUT reframe (zoom-in) |
| S12 THE HARD PART: compact router+cards + purple DB table | 83.88-101.75 | 17.9 | 16 | re-layout <=125ms + mascot slide-in |
| S13 EXPAND AND CONTRACT: tab stepper + DB + SQL panel | 101.75-113.88 | 12.1 | 14 | mascot exit 250ms + hard swap |
| S14 ANOTHER OPTION / canary: topology + chart | 113.88-128.38 | 14.5 | 14 | zoom-out re-layout ~250ms, mascot slide-in |
| S15 PICTURE IT LIKE THIS: topology reset | 128.38-129.90 | 1.5 | 1 | in-place reset ~250ms |
| S15b camera push to cards | 129.90-131.50 | 1.6 | 2 | camera push 430ms ease-in-out |
| S16 THE STAGE metaphor: spotlight cone + cards + audience | 131.50-142.13 | 10.6 | 10 | mascot exit 170ms + spotlight fade-in 130ms |
| S17 Outro: ONE LIVE / ONE READY | 142.13-145.60 | 3.5 | 5 | hard jump (0 frames) |

**Structural observation (important).** From 5.9 s to 131 s one **carrier element stays on screen: the purple router pill plus the BLUE/GREEN environment cards.** It sits in the lower-middle band (about 38–60 % of height). Almost every "scaffold change" is a swap of the **top slot** above the router (about 18–37 % height). That slot rotates through:
- the users row
- the browser mockup
- the test console
- the error chart
- the rollback rows
- the SQL panel
- the headline text

The carrier itself changes in only three ways:
- **Re-framing:** zoom-in hard cuts at 57.50 and 75.60, zoom-outs at 66.00, 83.88 and 113.88, and a camera push at 129.90.
- **Compaction:** it gets compressed upward when the DB table is added (83.88).
- **Replacement:** it is replaced at 101.88 (expand/contract stepper) and at 131.50 (the stage metaphor still reuses the same two cards).

Counts:
- Distinct layouts: 18 (17 plus the push sub-state).
- Mean scaffold lifetime: 8.1 s (median 8.4 s).
- The carrier's lifetime is ~125 s of 145.6 s.

**Transitions actually seen:**
- **Hard cuts (0 frames), 5:** 1.68 (strip: 1.650 old, 1.683 new, full opacity, no fade), 57.50 (strip: 57.467 old framing, 57.500 zoomed framing), 75.60, 104.80 (DB jumps up in 1 frame), 142.13.
- **≤125 ms re-layouts** (whole layout changes between two 8 fps tiles): 8.25, 31.75, 66.00, 83.88, 101.88.
- **~130 ms top-slot swaps:** fade, no slide.
- **Mascot slide-ins:** 170 ms, from the left (1.72).
- **Mascot slide-out exits:** 170 ms (57.27, 131.27), or a fade-slide of about 250 ms (101.63).
- **Camera push:** one, at 129.90–130.33 (430 ms).
- No crossfades longer than 250 ms, no whip-pans, no slide-transitions of whole scenes.

---

## 3. THE 10-POINT ANALYSIS

### (1) Beat timestamps
The table in §1 has 163 beats, 0.23–145.38 s.

### (2) Gap distribution (ms, between consecutive beats)
min 30 / p10 250 / p25 500 / **median 870** / p75 1250 / p90 1520 / max 3120 / mean 896 ms
Histogram: <200: 11, 200-400: 25, 400-700: 27, 700-1000: 30, 1-2s: 65, 2-3s: 3, >=3s: 1.

- **Time in holds:** 66 % of the runtime sits in gaps ≥1 s, and 6.4 % in gaps ≥2 s. The video is mostly **1–2 s holds punctuated by 2–3-beat bursts.**
- **Bursts** (≥3 beats within ~0.6 s):
  - 0.23/0.63/1.10 (title build)
  - 1.68/1.72/1.75 (cut + mascot + label)
  - 5.25/5.38 (scaffold + title)
  - 12.50/12.88/13.00 (live wiring + HUD)
  - 18.38/18.50/18.63
  - 39.63/39.75
  - 56.87/57.27/57.50/57.73 (dim → mascot exit → cut → option row)
  - 58.10/58.77
  - 62.13/62.90
  - 63.93/64.30
  - 73.00/73.25
  - 74.63/74.80
  - 80.25/80.50/80.63
  - 101.63/101.88
  - 103.43/103.63
  - 104.80/105.07
  - 109.25/109.53
  - 131.27/131.50
  - 143.00/143.63
- **Longest holds** (what is on screen):
  - **134.38 → 137.50 (3.12 s):** stage metaphor. The spotlight cone is over BLUE, the GREEN card is dimmed, the audience row is at the bottom, and the "BEHIND THE CURTAIN" label and "IDENTICAL" pill are visible. Nothing moves except captions; there is no mascot. Narration: "stage behind the curtain, where you prepare the next version."
  - **48.25 → 50.38 (2.13 s):** the test console is fully checked, with the "green-tg 3/3 healthy" badge. Static apart from the dotted bypass line.
  - **120.13 → 122.25 (2.12 s):** not a true hold. The flat error-rate line keeps crawling right for 1.4 s (continuous micro-motion).
  - **46.25 → 48.25 (2.0 s):** the console with 4/5 checks done.
  - **54.50 → 56.38, 24.25 → 26.13, 36.38 → 38.25 (~1.9 s each):** topology or browser at rest. During these the mascot mouth and dotted user→router flow keep moving.
  - Machine list reported 12 holds of 2.2–3.7 s. Several of them (15.73, 22.00, 32.03, 39.73, 88.53) contain visible beats I logged: 17.00 "0%" pill, 22.38/23.25 tile highlights, 32.93 red cascade, 40.63 bypass line, 90.25 cell text swap. These are small-area changes the detector merged or missed.

### (3) Rates
- **Beats/min: 67.2** (163 beats / 145.6 s). Machine: 72.9, but 42 of its 177 beats are the mascot-face band (row 5 only), i.e. blinks and mouth. Without them the machine has 135 content beats = 55.6/min.
- **Cuts/min:**
  - True hard cuts: 5, or 2.1/min.
  - Counting all full-layout changes (hard cuts + ≤125 ms re-layouts + camera push): 17, or 7.0/min.
  - The machine reports 0 cuts. Its detector misses these because the frame is ~85 % black and the carrier cards persist across every "cut".

### (4) Narration ↔ visual sync
- **Anchored:** 128/163 = **78.5 %** of beats anchored (A, ≤0.3 s).
- **Lead/lag:** 27 = 16.6 % are semantic but offset 0.3–1.5 s (L).
  - Mostly **leads**: the section label or panel appears 0.4–1.5 s before its keyword. Examples: DB panel 84.50 vs "database"@85.02; "CANARY ROLLOUT" 125.00 vs @125.50; audience row 132.25 vs "audience"@133.18; "BEHIND THE CURTAIN" 133.75 vs "curtain"@135.42.
  - A few **lags**: EXPAND colour flip 103.43 vs "expand"@103.12; "TESTS FAILED" 50.38 vs "broken"@49.80.
- **Free-running:** 8 = 4.9 % (F). These are mostly label hides and the mascot.
- **Beats per spoken sentence:** 163 / 72 sentences = **2.26** (the machine's median is 2.0). Typical pattern: sentence onset → slot swap or label; keyword → pill/recolor/counter.
- **Machine cross-check:** its "beat on word onset ±80 ms = 0.52 vs chance 0.555" does not contradict this. Anchoring here is to the **semantic keyword within ~0.3 s**, and beats land **either side of word onsets**, not onset-locked at ±80 ms. Visual evidence of the tight matches:
  - "blue"@11.36 → blue tint 11.50
  - "switch"@58.72 → headline 58.77
  - "stops sending"@60.46–61.28 → counter 60.77–61.27, which starts and ends inside the phrase
  - "move the spotlight"@138.68 → slide 138.87

### (5) Motion quality (30 fps strips; frame counts at 33.3 ms)
| beat | start → settle | duration | curve seen |
|---|---|---|---|
| BLUE label fade-in (0.20 strip) | f1 0.233 faint → f5 0.367 full | 133 ms | fast ease-out (≈40 %→75 %→95 % over f2–f4); **no scale, no overshoot** |
| GREEN label (same strip) | 0.633 → 0.733 | 100 ms | ease-out opacity + tint, no overshoot |
| Scaffold cut S1→S2 (1.55 strip) | 1.650 old / 1.683 new | 0 ms | **hard cut**, new layout at full opacity, caption box empty for 1 frame |
| Mascot slide-in (1.55 strip) | 1.717 edge → 1.817 in place, brightness settles 1.883 | 100 ms move + 170 ms total | ease-out (most travel in first 2 frames), no overshoot |
| Browser → 503 (4.00 strip) | content fade 4.00→4.47; "503" 4.30→4.47; bg snaps black 4.500 | 470 ms fade + 1-frame snap | near-linear dim, then **hard step** |
| v2 pill travel (29.30 strip) | leaves 29.467, settles ≈30.20 (passes behind browser at 29.53–29.57) | ≈730 ms | **ease-in-out** with long ease-out tail: per-frame dy ≈10,13,14,15,15,11,12,9,8,6,4,4,3,3,1 px (crop scale) |
| Users-turn-red cascade (32.80 strip) | first user 32.933 → last 33.467 | 530 ms total; each user white→pink→red in ~67 ms | **random-order stagger** ~60 ms, no scale pop |
| Diagram dim + mascot exit + reframe (56.80 strip) | dim 56.867→57.0; mascot 57.267→57.40 off-left; reframe 57.500 | 130 / 170 / 0 ms | dim ease-out; mascot exit **ease-in** (accelerating, ≈10→30→30 px/frame); reframe **hard cut**; router pill fades in 57.60→57.70 (~100 ms) |
| Strike-through draw (58.00 strip) | 58.100 → 58.200 | 100–130 ms | left→right line draw, ease-out (40 %→85 %→100 %) |
| "SWITCH THE / TRAFFIC" headline (58.60 strip) | line 1 58.767→58.867; line 2 58.900→58.967; old row slides down/out 58.733→58.833 | 100 ms per line, 133 ms stagger | rise + fade, ease-out, grey→white; **no overshoot** |
| Traffic lever + % counter (60.60 strip) | 60.767 (99/1) → 61.267 (0/100) | **500 ms** | **symmetric ease-in-out**: per-frame % deltas 1,1,2,3,5,8,10,15,16,13,10,6,4,3,2,1; connector lever pivots in lock-step |
| Error line draw up (70.00 strip) | 69.97 → 70.50, plateau to 70.67 | 530 ms | **linear** draw (constant x-advance/frame) |
| "18 %" slam (71.30 strip) | 71.467 (≈35 %, ~1.3x) → 71.533 (~full, ~1.05x) → 71.567 settled | 100–130 ms | **scale-down slam** + fade, ease-out, no rebound |
| "EXPAND" colour flip (103.30 strip) | 103.433 → 103.533 | 100 ms | dim violet→bright violet, ease-out |
| SQL typewriter (104.70 strip) | line 1 instant at 104.800; line 2 105.067 → 105.633 | 570 ms (~30 chars, ≈53 chars/s, ~2 chars/frame) | **linear** typing; the new DB row fades into a slot **reserved since 104.80** at 105.767 |
| Rows-migrated counter (109.20 strip) | box pops 109.267 ("0" held 230 ms), ticking 109.533 → ≈110.9 (128,540) | ≈1.4 s | **ease-out**: per-frame increments 8674, 8263, 7862 … 3044, 2802 … 1564 (monotone decreasing) |
| Camera push (129.80 strip) | 129.90 → ≈130.33 | 430 ms | **ease-in-out** scale-up + recentre; users/router fade out 129.9–130.07; slight brightness dip mid-move; mascot stays in front (occludes blue card) |
| Spotlight slide (138.80 strip) | counters 138.867 (81/19) → 139.133 (0/100); cone 139.00 → 139.233 | counters 267 ms, cone ≈230 ms, cone lags ≈100 ms | counters ease-out-ish (19,25,20,14,10,7,3,2); cone ease-in-out |
| Red "breaks" flash (140.35 strip) | 140.483 on → 140.583 off | 100 ms | **hard on/off**, no tween either way |
| HUD retype (63.80 strip) | "0.00s DOWNTIME" box 63.933 → 64.00; HUD "v1.4.2" backspaces 64.30→64.43, pill blue→green at 64.433, types "v2.0." by 64.567 | 70 ms / ~300 ms | box ease-out fade; HUD is a **backspace-and-retype** text effect |
| Caption chunk swap (25.40 strip) | 25.500 old dims → 25.567 new full | 67 ms | 2-frame crossfade, no motion |

**Summary.**
- **Durations:**
  - Element entrances: **100–133 ms**, ease-out opacity (sometimes with a small rise or scale-down). Median est. motion across all logged beats is 130 ms.
  - Line draws: 100–550 ms (strike 120 ms, error line 530 ms linear).
  - Value animations (counters, levers, travelling tokens): **270–1400 ms**, and they are the only long tweens. Levers are ease-in-out 500 ms; the big counter is ease-out 1.4 s.
- **Easing, no overshoot:** **No overshoot or bounce was observed on any strip.** The machine's 11 % "rebound" flags (e.g. 12.90, 25.07, 27.17, 35.10) coincide with mascot/label changes during motion, not visible springs.
- **Easing, peak position:** machine peak_pos median 0 (motion front-loaded) agrees with the ease-out entrances.
- **Settle time:** machine settle median 100 ms agrees.

### (6) Camera-level effects
- **Camera push:** one at 129.90–130.33 (430 ms, ease-in-out). The cards scale up about 1.4x and re-centre, while the users row and router fade out.
- **Zoom-in reframes as hard cuts:** 57.50 and 75.60. The router and cards jump from ~60 % to ~100 % frame width, with no tween.
- **Zoom-out re-layouts:** 66.00, 83.88 and 113.88, each ≤125 ms (within one 8 fps tile).
- **Layering:** the mascot is layered in front of the cards during the push (130.0–131.2), which reads as depth. There is no other parallax.
- **Not seen:** no shake, no DOF/blur, no pans, no rotating or 3D camera, and no continuous drift. Between beats the frame is locked static; only the mascot's mouth and the dotted flow lines move.

### (7) Colour
- **Background:** flat near-black (corner luminance 0; mean frame luminance ~12/255). There is a very faint radial lift behind the diagram (visible in 129.80 strip). No gradient animation, no texture.
- **Hues visible simultaneously at representative moments:**
  - 0.75 s: 2 (blue, green)
  - 12.9 s: 4 (blue card, green card, orange instance squares, purple router)
  - 32.5 s: 5 (+ red 500 banner/users)
  - 50.5 s: 5 (+ amber "TESTS FAILED")
  - 71.5 s: 5 (red chart + 18 %, blue, green, orange, purple)
  - 88.5 s: 4 (purple DB dominant, blue, green, orange)
  - 131.9 s: 3 (blue, dim green, orange)
  - 143.8 s: 2–3 (blue "ONE LIVE", green "ONE READY", orange squares)
- **Machine check:** its median of 2 hues per frame comes from saturated pixels being only ~2.2 % of the frame. The colours are small accents on a black field.
- **Colour semantics are strict and consistent (distinct colour per role, not one shared accent):**
  - blue = blue env / live / caption highlight
  - green = green env / new version
  - orange = compute instances
  - purple = load balancer and database / "expand and contract" section
  - red = errors (503, 500, 18 %, strike-throughs on rollback rows, red flash)
  - amber/yellow = version pills, "deploying", warnings, "LAST KNOWN GOOD"
- **Section labels:** white, except "THE RISKY WAY" (orange), "THE HARD PART" (purple) and "ROLLBACK" (red).

### (8) Iconography / graphic style
- **Overall look:** flat UI-mockup style, with no glow except the soft spotlight cone (131.5+).
- **Panels:** dark rounded rectangles, corner radius ~8–12 px at 1080 w, with a 1 px lighter or tinted border (blue border on BLUE card, green on GREEN, purple on DB).
- **Text:** mono font for technical text (IDs `i-0a3f8c21`, SQL, URLs). The sans is heavy (grotesk) for headlines ("SWITCH THE TRAFFIC", "EXPAND AND CONTRACT", "ONE LIVE / ONE READY") and tiny letter-spaced caps for section labels ("THE PROBLEM", "A REAL EXAMPLE", "TEST IT PRIVATELY" …).
- **Icons:**
  - Users are small filled white person glyphs.
  - Instance rows have small filled orange square icons.
  - The router is a filled purple rounded-square icon.
  - Checkmarks are thin line circles.
  - Line work (connectors, fan-out lines from users, strike-throughs, bypass curve) is 1–2 px thin. Dotted or dashed means "potential" traffic.
- **Recurring motifs:**
  - (a) **HUD bar** at the top (≈13–15 % height): `shop.example.com · [BLUE|GREEN] · version · error %`. It is present 5.25–131 s and updates live (PROD→BLUE 13.0, →GREEN 64.4, →BLUE 80.6, 93.75, 128.4).
  - (b) **Browser window chrome:** traffic-light dots and a URL bar (1.7–31.7, 39.7–54.4 test console).
  - (c) **Router pill + two env cards** as the carrier.
  - (d) **Mascot** on the left.
  - (e) **Tiny caps section label** above the top slot.
  - (f) **Single-word pill badges:** "LIVE", "IDENTICAL", "+7 DAYS LATER", "TESTS FAILED", "ALL AT ONCE".

### (9) Sound
Not assessable visually. Visible cues that would suggest SFX:
- hard cuts/reframes (1.68, 57.50, 75.60, 142.13)
- the "18 %" slam (71.47)
- the red flash (140.48)
- strike-throughs (58.10, 73.25, 74.80)
- checkmark ticks (41.38, 43.00, 44.63, 46.25, 48.25, 53.75+)
- counter tick runs (60.77, 109.53)
- the typewriter (105.07)

The machine found only 13 % of prominent audio transients near a visual beat, which suggests SFX are not tightly beat-locked. That cannot be confirmed visually.

### (10) Layout / safe zones (1080x1920)
- **Content band:**
  - Top clear margin: **0–13 %** (0–255 px) is empty black throughout.
  - HUD bar: 13–15 %.
  - Section label: 16–18 %.
  - Top slot (browser / console / chart / SQL / headline): 18–37 %.
  - Router pill: ~37–40 %.
  - Env cards: ~44–60 %; the DB table sits at 50–65 % when present.
  - Bottom of content: ≈72 %.
- **Captions:** 74–80 %.
- **Bottom clear margin:** **~80–100 %** (≈375 px) is empty. Machine row-content profile: rows 0–1 and 13–15 empty.
- **Mascot:**
  - Left edge, x ≈ 0–25 % of width, y ≈ 28–72 % of height (≈44 % of frame height, ≈850 px tall), full body, facing right.
  - When present, the diagram occupies x ≈ 30–97 %. When absent (57.5–66, 75.6–83.9, 101.9–113.9, 131.3+), the diagram widens to x ≈ 1–99 %.

---

## 4. What makes this feel fast (observed mechanisms only)

1. **Short entrances, long holds.**
   - Every element entrance is 100–133 ms ease-out (0.233→0.367 BLUE label; 58.767→58.867 headline; 71.467→71.567 "18 %"; 103.433→103.533 EXPAND), and caption chunks swap in 67 ms (25.50–25.567).
   - Motion finishes almost instantly, so the frame snaps from state to state.
2. **Keyword-locked micro-beats (~2.3 per sentence, 78 % within 0.3 s of the word).** The noun being said lights up at the moment it is said:
   - "blue"@11.36 → tint 11.50
   - "green"@11.74 → tint 11.88
   - "log in"@41.54 → ✓ 41.38
   - "18%"@71.28 → slam 71.47
   - "identical"@134.28 → pill 134.38
3. **A persistent carrier with a swapping top slot.** The router + two cards stay put from 5.9 s to 131 s while the top slot swaps (users 8.25 → browser 18.38 → users 31.75 → console 39.63 → users 54.50 → chart 66.00 → rollback rows 72.13 → SQL 88.50). The eye never re-orients, so every change reads as "new information", not "new scene".
4. **Live counters and levers instead of static states.**
   - The traffic lever with % counters runs 500 ms ease-in-out (60.77, 78.75, 116.38, 122.25, 123.50, 124.25, 138.87, 141.00).
   - The rows-migrated counter runs 1.4 s ease-out (109.53).
   - The HUD error % counter changes at 33.50 and 80.63.
   - The HUD retype is at 64.30.
   - Numbers moving make holds feel busy.
5. **Hard-cut zoom reframes with no tween.** 57.50 and 75.60 jump the diagram to full width in one frame, each preceded by a 170 ms mascot exit (57.27) or with none at all (75.60). 1.68 and 142.13 are also 0-frame cuts.
6. **Travelling tokens and draws that show causality.**
   - The v2 pill physically travels into the target card (29.47–30.20 into BLUE, 35.13–35.8 into GREEN, ~700 ms ease-in-out).
   - Lines draw: the strike-through at 58.10, the bypass curve at 40.63, the red error line at 69.97 (530 ms linear), the rollback strikes at 73.25 and 74.80.
7. **Staggered multi-element reactions.**
   - The users-go-red cascade runs 32.933–33.467 in random order, ~60 ms apart.
   - The checklist re-runs row by row from 53.75 (~150 ms stagger).
   - The two headline lines are staggered by 133 ms (58.767 / 58.900; 143.00 / 143.63).
8. **State flips with no tween at all, used for alarm moments.** The 503 background snaps black (4.500), the red flash is on/off at 140.483/140.583, the switch-back at 93.75 is instant, and the DB jumps up at 104.80.
