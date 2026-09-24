# R1_DdEedoQM6j3: visual log ("How a DDoS attack works", 176.87 s, 9:16, 30 fps)

Method: I read all 59 contact sheets (8 fps, 0.000–176.875 s) in order and rendered 30 fps strips for 19 windows (listed in §3.5). Narration comes from the Whisper word timings. Sync codes: **anchored** means the thing shown is the thing being said, within ~0.3 s. **leads**/**lags** means the semantic match is right but the offset is 0.3–0.9 s. **free-running** means secondary motion with no word target.

## 0. Caption style (logged once)
- **Position:** centred horizontally, box centre at ~80% of frame height (strip frames: y≈387/480). It never moves.
- **Box:** near-black fill, 2 px cyan (#5EE) border, hard cyan offset shadow at bottom-right, square-ish corners (radius ≈2 px).
- **Font:** bold grotesk sans (Inter-like), white. The active word is recoloured cyan, karaoke-style, one word at a time.
- **Chunk size:** 1–5 words, typically 3–4 ("How a DDoS attack", "works.", "You open your favorite", "website, you refresh,"). Chunks change every ~0.5–1.3 s. A single-word chunk ("works.", "flows.", "hold.", "server.") appears on sentence tails.
- **Chunk swap:** the new chunk shows dim for 1 frame, then is at full opacity by the next frame (≈33–67 ms). There is no slide or scale (e.g. 0.125→0.167, 39.833→39.9 strip f4–f6).
- **Blank gaps:** the caption briefly disappears between sentences (e.g. 7.60–7.63, 83.0, 120.53–120.70 strip f1–f5).

## 1. Beat log (entire video)

| t (s) | what changed | region | motion dur | narration at that moment | sync |
|---|---|---|---|---|---|
| 0.10 | mascot slides in from left edge; HUD bar (ORIGIN pill OK, 1,000 req/s, 38 ms) fades in | mascot L 0-17%w; HUD top | 170ms | How | anchored |
| 0.17 | caption box fades in "How a DDoS attack" | caption | 67ms | How | anchored |
| 0.33 | title "HOW A DDOS ATTACK WORKS" fades in | top ~20% | 130ms | DDoS | anchored |
| 0.60 | browser window (shop.example.com, 6 product cards) fades in | right 22-60% | 130ms | attack | anchored |
| 1.38 | first card-row loading block turns cyan | browser | 67ms | works | free-running |
| 1.50 | cyan underlines on all cards (page loaded) | browser | 130ms | works | free-running |
| 1.75 | title removed; green "200 OK 38 ms" pill under browser | top / browser | 67ms | You open | free-running |
| 2.63 | page content dims | browser | 130ms | website | anchored |
| 2.75 | page blanks to spinner (refresh) | browser | 67ms | refresh (3.04) | anchored |
| 4.63 | HUD latency ticks 38 -> 637 -> 954 -> 2012 ms, turns amber | HUD right | ~600ms | again, still nothing | anchored |
| 5.63 | page restored; HUD pill flips amber DEGRADED; red "HACKED?" label on card | browser + HUD | 130ms | It hasn't necessarily been | anchored |
| 6.50 | strikethrough draws across HACKED? | browser center | 250ms | hacked | anchored |
| 7.10 | CAMERA MOVE: browser shrinks to top-right corner while red-car highway + skyline reveal | whole frame | 270ms | might just be stuck | anchored |
| 8.13 | one car highlighted cyan with "GET /" tag | road center | 130ms | giant traffic jam | free-running |
| 9.13 | HUD pill flips amber -> red OFFLINE | HUD | 1 frame | That's | free-running |
| 9.20 | HARD CUT: highway dims, mascot enlarges ~1.3x (no tween) | full | 0ms | That's a DDoS | anchored |
| 9.30 | "A DDOS ATTACK" big title fades in right | right 30-45% | 67ms | DDoS | anchored |
| 9.77 | red underline draws R->L under ATTACK | right | 130ms | attack | anchored |
| 10.50 | cut back to highway, mascot normal size | full | 0ms | Send | anchored |
| 11.88 | cyan "YOU" tag beside highlighted car | road | 67ms | real users | anchored |
| 12.75 | red horizontal barrier line across road | road | 130ms | no longer get through | anchored |
| 13.38 | cars + skyline fade out, empty road outline | road | 130ms | Think | anchored |
| 13.63 | title "THINK OF IT AS A TRAFFIC JAM" fades in | top | 130ms | Think of it | anchored |
| 14.13 | light band sweeps up from bottom of road | road bottom | 250ms | traffic jam | free-running |
| 14.75 | road emptied; HUD resets green 1,000 req/s; title gone | road / HUD | 130ms | Picture | free-running |
| 15.38 | dotted city skyline + "ORIGIN SHOP.EXAMPLE.COM" fade in at road end | road top | 250ms | site as a highway | anchored |
| 16.25 | "ONE GATE" tag at road end | road top-right | 67ms | one city | anchored |
| 16.63 | cyan cars fade in by rows and start flowing up the road (continuous to 22.3) | road | 250ms+ | city. On a normal day | anchored |
| 18.38 | new car enters at bottom (flow continues) | road bottom | - | flows | anchored |
| 18.88 | one car tagged "GET /" highlighted | road center | 67ms | Real users arrive | anchored |
| 19.63 | GATE LOG panel fades in right | right | 130ms | requests get processed | anchored |
| 20.00 | gate-log rows tick in (x4 over ~1s) | right | ~1000ms | processed | anchored |
| 22.38 | gate log removed | right | 67ms | Now imagine | free-running |
| 23.13 | red cars flood in from bottom, row by row | road | ~400ms | millions of fake cars | anchored |
| 23.90 | ON-RAMP counter panel fades in, counts 8,211 -> 400,000 veh/s | right | 1150ms | flooding | anchored |
| 25.30 | HUD latency ticks up amber | HUD | ~300ms | all at once | free-running |
| 25.75 | counter panel removed; HUD pill flips amber DEGRADED | right + HUD | 1 frame | The road clogs | anchored |
| 27.38 | amber gate line + "GATE BACKED UP" tag at city edge | road top | 130ms | exits jam | anchored |
| 28.00 | cut to closer framing; cyan "your" car at bottom center | full | 0ms | your actual | anchored (leads word 0.3-0.9 s) |
| 28.00 | slow camera push-in on road (scale ~1.0 -> ~1.25) | full | ~1250ms | actual users are stuck | anchored |
| 29.38 | cyan selection box draws around your car | road lower | 130ms | stuck behind | anchored |
| 30.13 | "YOUR REQUEST" latency counter 1,905 -> 5,996 ms | right | ~500ms | all of it | anchored |
| 30.75 | box + counter removed; pull back to wide road | full | 67ms | That's the outage | anchored |
| 31.17 | error browser "This site can't be reached" fades/scales in | top-right | 130ms | outage | anchored |
| 31.88 | HUD pill flips amber -> red OFFLINE, "0 served" | HUD | 67ms | because | free-running |
| 32.88 | request panel (GET / HTTP/1.1 headers) fades in | right | 130ms | single request | anchored (leads word 0.3-0.9 s) |
| 33.88 | cut: browser/panel gone, wide red highway + skyline | full | 0ms | because the road | anchored |
| 34.63 | red barrier at city gate + "BLOCKED" tag | road top | 130ms | blocked | anchored |
| 35.50 | scene clears (mascot + HUD stay) | full | 67ms | So what | anchored |
| 35.63 | title "WHAT IT LOOKS LIKE TECHNICALLY" fades in | top | 130ms | what does | anchored |
| 35.88 | 4 metric tiles (NETWORK/CPU/CONNECTIONS/QUEUE) fade in dim | right | 250ms | look like | free-running |
| 37.13 | REQUESTS/SECOND panel appears, tiles populate, HUD green | right | 67ms | Your site handles | anchored |
| 37.25 | sparkline draws left -> right | right top | 400ms | handles | anchored |
| 37.50 | counter 0 -> 482 -> 875 -> 992 -> 1,000 req/s | right | 500ms | thousand | anchored |
| 38.25 | mini progress bars in tiles fill | right | 250ms | requests | free-running |
| 39.13 | green HEALTHY pill pops | right | 67ms | just fine | anchored |
| 39.83 | HARD CUT: mascot enlarges, all values cyan -> amber, HUD SATURATED, sparkline cleared (1 frame) | full | 0ms | Now it's | anchored |
| 40.25 | counter accelerates 1,000 -> 1,000,000 (exponential), tile % and queue tick | right | 2150ms | ten thousand ... a million | anchored |
| 41.00 | chart line redraws red, curving up exponentially | right top | 1400ms | hundred thousand | anchored |
| 42.43 | "5,000,000 req/s" huge red text (2-frame fade) as panel fades out | right 40-55% | 67ms | then five million | anchored |
| 43.50 | cut: mascot gone; "THE MACHINE FILLS UP" + NETWORK / PROCESSOR tiles | full | 0ms | Your network | anchored |
| 43.83 | NETWORK 0 -> 100% + UPLINK bar fills red | right | 630ms | fills up | anchored |
| 44.50 | "200 Gb/s arriving" red subtext | mid | 67ms | fills up | free-running |
| 44.88 | PROCESSOR 37 -> 100% fills | right | 1000ms | processor saturates | anchored |
| 46.25 | cut: CONNECTIONS 60-cell grid + QUEUE DEPTH card | full | 67ms | pile up | anchored |
| 46.38 | grid cells fill red, counter 23 -> 60/60 | left | 600ms | pile up | anchored |
| 47.00 | queue counter 0 -> 48,000 + amber bar | right | 900ms | queues fill | anchored |
| 48.13 | cut: mascot back, ACCESS LOG label, HUD red | full | 0ms | and legitimate | anchored |
| 48.63 | cyan user icon pops | center-left | 67ms | legitimate users | anchored |
| 49.13 | 6 red log rows (503/504) stagger in, 100 ms apart | right | 570ms | start getting errors | anchored |
| 49.90 | 7th row "504 GET / GATEWAY TIMEOUT" highlighted cyan | right | 100ms | timeouts | anchored (leads word 0.3-0.9 s) |
| 50.88 | cut: empty road outline | full | 0ms | So where | anchored |
| 51.25 | title "WHERE DOES IT COME FROM?" | top | 130ms | where does | anchored |
| 51.88 | 3 dashed vertical lines grow upward | lower mid | 250ms | traffic come from | anchored |
| 52.13 | purple "[D]DoS" mark fades in | mid | 130ms | That's the distributed | anchored (leads word 0.3-0.9 s) |
| 52.88 | "DISTRIBUTED" subtitle under D | mid | 130ms | distributed | anchored |
| 53.75 | cut: "ONE COMPUTER" + ATTACKER laptop card | top-mid | 130ms | Instead of one computer | anchored |
| 54.38 | dotted line draws down from attacker | mid | 250ms | attacking | free-running |
| 54.50 | "SERVING AT ORIGIN 1 source 40 req/s" card + "NOT ENOUGH" tag | mid | 130ms | attacking you | free-running |
| 54.88 | attacker icon turns red, big red X | top-mid | 250ms | attacking you | anchored |
| 55.50 | cut: blank + DEVICES counter "1" | bottom-right | 0ms | traffic comes from | anchored |
| 56.13 | purple dots scatter in; counter 80,844 -> 1,240,000 | right half | 2100ms | thousands or even millions | anchored |
| 57.00 | dots self-organize into a rotating spiral (continuous) | right half | 1500ms+ | devices | free-running |
| 58.38 | purple frame draws around swarm + "BOTNET" title | right / top | 130ms | something called a botnet | anchored (leads word 0.3-0.9 s) |
| 59.88 | cut: 3 dim device cards + "MALWARE INFECTS" | top | 130ms | Malware | anchored |
| 60.38 | LAPTOP card lights purple | right | 67ms | infects computers | anchored (leads word 0.3-0.9 s) |
| 61.00 | ROUTER card lights | right | 67ms | routers | anchored |
| 61.63 | IP CAMERA card lights | right | 67ms | cameras | anchored |
| 62.25 | cut: "ALL AROUND THE WORLD" + world map fades in | full | 250ms | other internet-connected | anchored (leads word 0.3-0.9 s) |
| 62.88 | COMPROMISED DEVICES counter 0 -> 1,240,000 + purple dots populate map | map | 1400ms | devices all around the world | anchored |
| 64.63 | cut: mascot back, map dims to background | full | 0ms | Their owners | anchored |
| 65.13 | ROUTER card pops center | mid | 67ms | owners may have | free-running |
| 65.50 | status card "ONLINE / no alerts" fades in | mid-right | 130ms | absolutely no idea | anchored (leads word 0.3-0.9 s) |
| 66.38 | dashed line draws above router | mid | 250ms | idea | free-running |
| 66.88 | cut: "COMMAND & CONTROL" terminal "botnet@c2 ~ $" | top-right | 0ms | The attacker controls | anchored |
| 68.00 | swarm spiral fades in under terminal | right | 250ms | all of them | anchored |
| 68.75 | typewriter "attack --target shop.example.com --now" | terminal | 900ms | sends a single command | anchored |
| 69.73 | lavender shockwave ring expands from swarm center | right | 300ms | Everyone | anchored |
| 70.03 | swarm dots brighten / enlarge | right | 100ms | hit this website now | anchored |
| 71.38 | cut: IP CAMERA card + ORIGIN LOAD 0.00% card | center | 130ms | One infected camera | anchored |
| 71.75 | dotted line draws camera -> load card | center | 250ms | camera | free-running |
| 73.25 | cut: camera card gone; purple particles scatter in; load 0.02% | right | 600ms | A hundred thousand | anchored |
| 74.03 | "100,000 DEVICES" purple display text pops (2-frame fade) | right 25-45% | 67ms | devices | anchored |
| 74.25 | particles form spiral | right | ~800ms | working together | free-running |
| 74.88 | load counter 793% -> 2,000% of capacity, turns red | right | 750ms | very different story | free-running |
| 76.63 | cut: blank; "NOT EVERY ATTACK IS THE SAME" label | mid-right | 130ms | not every attack | anchored |
| 76.88 | 3 tabs (BANDWIDTH / CONNECTIONS / APPLICATION LAYER) stagger in | top | 250ms | every attack | anchored |
| 77.38 | road outline fades in | center | 250ms | targets | anchored |
| 78.75 | cut: road gone; tab 1 BANDWIDTH turns amber | top | 67ms | First | anchored |
| 79.25 | "BANDWIDTH / FILLING THE PIPE ITSELF" amber heading | right | 130ms | bandwidth | anchored |
| 80.25 | cut: HUD green; "UPLINK TO ORIGIN" empty pipe panel | right | 130ms | server has a pipe | anchored |
| 80.88 | "10 Gb/s" capacity bracket under pipe | right | 67ms | carry | free-running |
| 81.00 | pipe fills cyan to ~20% | right | 130ms | carry | free-running |
| 82.50 | pipe fills to ~65% | right | 500ms | ten gigabits per second | anchored |
| 83.43 | pipe swaps (1 frame) to smaller red overflowing pipe; HUD SATURATED | right | 0ms | attacker sends | anchored |
| 83.83 | "200 Gb/s" huge red text (2-frame fade) | right top | 67ms | two hundred | anchored (leads word 0.3-0.9 s) |
| 84.13 | dark-red overflow box beside pipe | right | 130ms | two hundred | anchored |
| 85.00 | cut: close red highway | full | 0ms | That's forcing | anchored |
| 86.88 | stats panel (LANES 6, CAPACITY 1,000/s, ARRIVING 200,000/s) slides in | right | 130ms | road | anchored |
| 88.25 | cut / pull-back: mascot gone, skyline visible, packed road | full | 0ms | The jam happens | anchored |
| 89.38 | amber gate line + "THE JAM IS HERE" tag at city edge | road top | 130ms | before the traffic | anchored |
| 91.00 | cut: mascot back, tab 2 CONNECTIONS amber | top | 67ms | Second | anchored |
| 91.63 | "CONNECTIONS / HOLDING EVERY SLOT OPEN" heading | right | 130ms | connection attacks | anchored |
| 92.75 | cut: 10x10 slot grid, HUD green | right | 130ms | A server | anchored |
| 93.25 | "MAX 100 CONCURRENT" label | right top | 67ms | can only hold | anchored |
| 94.00 | cyan cells pop scattered (1 -> 18) | grid | 400ms | active connections | anchored |
| 95.13 | OPEN / FREE legend | grid bottom | 67ms | open at once | free-running |
| 95.63 | HUD red; red "18/100" counter; cyan YOU icon at grid edge | grid + HUD | 67ms | Fill them | anchored |
| 96.25 | red cells flood grid, counter 18 -> 100 | grid | 650ms | all up / legitimate | anchored |
| 98.00 | "NO SLOT" red tag by user icon | left of grid | 67ms | nowhere left to connect | anchored |
| 98.75 | cut: grid gone; tab 3 APPLICATION LAYER amber | top | 67ms | Third | anchored |
| 99.25 | "APPLICATION LAYER / ASKING FOR THE EXPENSIVE THING" | right | 130ms | application layer | anchored |
| 99.63 | route list card | right | 130ms | attacks | free-running |
| 100.88 | cut: LEGITIMATE vs MALICIOUS request cards | top | 250ms | These look much more normal | anchored |
| 101.38 | DIFFERENCE row | mid | 130ms | normal | anchored |
| 102.88 | legit card crossfades to lightning "RANDOM PACKETS" | top-left | 130ms | flooding the network | anchored |
| 103.25 | red strike line across RANDOM PACKETS | top-left | 67ms | random packets | anchored |
| 103.75 | card restores to legitimate request | top-left | 130ms | the attacker | free-running |
| 104.00 | red "PATH EXPENSIVE" tag in difference row | mid-right | 67ms | attacker | anchored |
| 104.75 | cut: ROUTE / COST / RATE table, rows stagger ~125 ms; HUD SATURATED | top | 380ms | repeatedly requests | anchored |
| 106.38 | /search rate grows into red pill "40,000/s" | table right | 250ms | expensive parts | anchored |
| 106.88 | red tag "40,000 req/s to /search" | below table | 130ms | your application | anchored |
| 107.63 | cut: COMPUTATION 0 ms + COST OF ONE REQUEST tiles | bottom | 0ms | Maybe a single request | anchored |
| 108.25 | red "1 REQUEST" pill | top | 130ms | single request | anchored |
| 109.03 | 6 amber curves fan out to DB icons (each ~150 ms draw, stagger ~100 ms) | mid | 600ms | triggers several database queries | anchored |
| 110.50 | COMPUTATION counter 0 -> 620 ms + amber bar | bottom-left | 630ms | heavy computation | anchored |
| 111.25 | typewriter "1 req -> 6 queries -> 908 ms CPU" | bottom-right | 500ms | computation | free-running |
| 111.88 | cut: seesaw beam | top | 0ms | It costs | anchored |
| 112.13 | ATTACKER "182 bytes" card | left | 250ms | the attacker | anchored |
| 112.40 | beam tilts (continuous) | top | 1400ms | almost nothing to send | anchored |
| 113.88 | YOUR SERVER "908 ms CPU" card brightens red; beam tips other way | right | 750ms | costs your server | anchored |
| 114.50 | "NOTHING" grey | mid | 67ms | a lot | anchored (leads word 0.3-0.9 s) |
| 114.63 | "VS A LOT" red | mid | 67ms | a lot | anchored |
| 115.88 | cut: blank, mascot | full | 0ms | So how | anchored |
| 116.13 | title "SO HOW DO COMPANIES SURVIVE?" | top | 130ms | how do companies | anchored |
| 116.38 | road outline, then skyline at 116.63 | center | 400ms | survive | anchored |
| 117.38 | title removed | top | 67ms | The first rule | free-running |
| 118.00 | RULE 1 card "Don't let all that traffic reach one server" | top-mid | 130ms | simple | anchored |
| 118.63 | red cars fade onto road | road | 250ms | that traffic | anchored |
| 119.75 | red outline around origin + "1 ORIGIN" tag | top | 130ms | server | anchored |
| 120.63 | cut to empty (~70 ms gap), then "IN FRONT OF YOUR APPLICATION" title | top | 100ms | Services like | anchored |
| 120.88 | 3 empty logo slots | top | 130ms | Services | free-running |
| 121.25 | Cloudflare logo tile pops | top-left | 67ms | Cloudflare | anchored |
| 121.75 | world map fades in | mid | 250ms | Cloudflare | free-running |
| 122.13 | cyan PoP dots appear on map | mid | 250ms | AWS | free-running |
| 122.25 | AWS Shield logo tile | top-mid | 130ms | AWS Shield | anchored |
| 123.50 | purple CDN globe tile | top-right | 130ms | and the large | anchored (leads word 0.3-0.9 s) |
| 123.75 | more PoP dots light | map | 500ms | content delivery | anchored |
| 124.63 | outline box draws around 3 logos | top | 130ms | networks | anchored |
| 125.25 | cut: layered diagram ORIGIN / EDGE 300+ POPS / INTERNET | full | 130ms | put massive | anchored |
| 125.38 | origin "10 Gb/s" card | top | 130ms | massive | anchored |
| 126.00 | 12 edge PoP boxes stagger in L -> R | mid | 500ms | distributed infrastructure | anchored |
| 126.63 | connecting lines edge -> origin | mid | 250ms | in front of | anchored |
| 127.00 | "EDGE 280 Tb/s ORIGIN 10 Gb/s" bar | mid | 130ms | your application | anchored |
| 128.13 | cut: highway with red cars, HUD green | full | 0ms | Traffic reaches them | anchored |
| 128.63 | cyan EDGE barrier grows across road | road top | 130ms | first | anchored |
| 129.63 | EDGE ABSORBED chart spike draws | right | 400ms | absorb the huge spikes | anchored |
| 130.63 | green "UNDER 1% LOAD" tag | right | 67ms | filter | free-running |
| 131.13 | zoom to road; front cars recolor cyan, red cars removed progressively | road | 1400ms | filter out the suspicious | anchored |
| 132.38 | EDGE DECISIONS counter "dropped" 1.95M -> 4.998M | right | 900ms | forward only | anchored |
| 133.63 | "forwarded" counter 0 -> 1,000; HUD FILTERING | right + HUD | 400ms | legitimate ones to you | anchored |
| 134.25 | cut: "RATE LIMITING" + limiter icon (red light) | right | 130ms | You can also use | anchored (leads word 0.3-0.9 s) |
| 135.25 | limiter flips red -> cyan, "ONE AT A TIME" | right | 67ms | limiting | anchored |
| 135.75 | cut: SOURCE / RATE / ACTION table, 5 rows stagger | right | 250ms | If one source | anchored |
| 136.25 | row 203.0.113.44 rate ticks 100 -> 9,480/s, row amber "throttled" | table | 900ms | starts behaving abnormally | anchored |
| 137.13 | "LIMIT 100/s" tag | table right | 67ms | abnormally | free-running |
| 137.25 | rate drops 9,480 -> 100/s | table | 400ms | slow it down | anchored (leads word 0.3-0.9 s) |
| 138.63 | row turns red, 0/s "blocked" | table | 130ms | block it | anchored |
| 139.88 | cut: "BLOCKING IPS ISN'T ENOUGH" | top | 130ms | But blocking | anchored |
| 140.00 | red IP pills pop one by one (~17) | mid | 900ms | IP addresses | anchored |
| 141.13 | BLOCKLIST counter 17 -> 41 | left | 500ms | alone isn't enough | anchored |
| 141.88 | cut: DISTINCT SOURCE ADDRESSES grid + counter 0 | full | 0ms | A botnet | anchored |
| 142.13 | red grid rows fill; counter 248,361 -> 1,240,000 | mid | 1600ms | thousands of different | anchored |
| 143.63 | tiny "BLOCKLIST: 41" tag | bottom-right | 67ms | addresses | anchored |
| 144.63 | cut: blank; "COMBINATIONS OF SIGNALS" title | top | 130ms | defenses look at | anchored |
| 145.13 | 6 signal rows stagger in | mid | 400ms | combinations of signals | anchored |
| 145.75 | BOT SCORE bar row | mid-bottom | 130ms | signals | free-running |
| 147.25 | title removed, list re-lays with values | full | 67ms | request patterns | anchored |
| 147.63 | row 1 amber, bot score ~8% | list | 130ms | patterns | anchored (lags 0.3-0.6 s) |
| 148.38 | row 2 amber, bot score ~33% | list | 130ms | IP reputation | anchored (lags 0.3-0.6 s) |
| 149.13 | row 3 amber, bot score ~50% | list | 130ms | browser behavior | anchored |
| 150.00 | row 4 amber, bot score ~60% | list | 130ms | geography | anchored |
| 150.88 | row 5 amber, bot score ~80% | list | 130ms | protocol | anchored (lags 0.3-0.6 s) |
| 151.88 | bot-score row removed; HUMAN? row turns red | list | 130ms | whether the traffic | anchored |
| 152.33 | "BOT" red stamp slams in (scale ~1.25 -> 0.9 -> 1.0, tilted) | below list | 230ms | looks human | anchored (leads word 0.3-0.9 s) |
| 153.00 | cyan "HUMAN" pill bottom-left | bottom-left | 67ms | at all | anchored |
| 153.63 | cut: blank + mascot | full | 0ms | And here's | anchored |
| 153.88 | "AND HERE'S THE HARDEST PART" title | right | 130ms | hardest part | anchored |
| 154.88 | cut: 2 empty chart panels | right | 67ms | Sometimes legitimate | anchored |
| 155.38 | top S-curve draws L -> R | right top | 500ms | legitimate traffic | anchored |
| 156.13 | bottom S-curve draws | right bottom | 400ms | looks exactly like | anchored |
| 156.75 | top curve recolors red + "ATTACK" tag | right top | 130ms | an attack | anchored |
| 157.63 | cut: ticket browser "00:03 Get tickets" + empty road; HUD SATURATED | full | 0ms | Tickets | anchored |
| 157.88 | countdown 00:03 -> 00:00 | top | 500ms | huge concert | free-running |
| 159.50 | cyan cars fill road | road | 250ms | millions of real people | anchored |
| 160.75 | REAL DEMAND chart slides in, spike draws | right | 400ms | arrive within seconds | anchored |
| 161.88 | cut: browser gone; "NAIVE RULE IF req/s > 100,000 -> BLOCK" card | top-right | 67ms | So you can't just | anchored |
| 163.00 | cars wiped off road | road | 300ms | block traffic | anchored (lags 0.3-0.6 s) |
| 163.63 | red strike through rule + cyan "REAL CUSTOMERS" tag | top-right | 130ms | there's a lot of it | anchored |
| 164.25 | cut: mascot gone; close mixed cyan/red car flow (continuous) | full | 0ms | You have to separate | anchored |
| 165.50 | some cars turn amber (uncertain) | road | 130ms | demand from | free-running |
| 165.63 | SORTING ERRORS panel (6 real dropped, 4 attackers admitted) | top-left | 130ms | malicious | anchored |
| 166.25 | DECISIONS 5,000,000/s BUDGET 2 ms CONFIDENCE 87% bar | bottom | 130ms | while the system | anchored (leads word 0.3-0.9 s) |
| 168.25 | cut: blank + mascot | full | 0ms | That's what makes | anchored |
| 168.50 | "THAT'S WHY IT'S HARD" title | right | 130ms | makes DDoS | anchored |
| 169.13 | CONFIDENCE pill; value jitters 83/87/84/91/88/85 | right | 750ms | defense so difficult | anchored |
| 170.00 | cut: blank | full | 0ms | A DDoS attacker | anchored |
| 170.38 | red lock "HACKED?" pill | top | 130ms | attacker doesn't | anchored (leads word 0.3-0.9 s) |
| 171.13 | HACKED? dims; "ORIGIN INTACT NOT COMPROMISED" skyline | mid | 250ms | necessarily break into | anchored |
| 171.38 | cyan "WALLS UNBROKEN DATA CLOSED" pill | mid | 130ms | break into | anchored |
| 172.88 | cut: road + skyline, HUD FILTERING | full | 0ms | They create | anchored |
| 173.63 | red cars fill road | road | 250ms | massive traffic jam | anchored |
| 174.38 | red barrier at city gate, HUD red OFFLINE | road top + HUD | 130ms | in front of it | anchored |
| 175.00 | mascot enlarges (cut) + cyan user car appears | full | 0ms | until your real users | anchored |
| 175.75 | "THEY BLOCK THE ROAD" big text fades in | right | 130ms | can't get through | anchored |
| 176.25 | fade to black | full | 500ms | through | anchored |

Total: **236 logged beats (235 unique timestamps)**. Anchoring: 180 anchored, 16 leads, 4 lags, 36 free-running.

## 2. Scene / scaffold structure

The persistent chrome (the HUD bar at top and the mascot on the left, when present) survives every scene change. Everything in the content zone is swapped. I count **52 scaffold states**, which are about **20 distinct scaffold types**. The "perspective highway + car chips + dotted city skyline" world recurs in 15 of them.

| # | time range (s) | scaffold | beats inside | transition IN |
|---|---|---|---|---|
| 1 | 0.00–7.10 | Browser page (shop.example.com) | 12 | fade-in from black: mascot slides in over ~170 ms, elements fade in 67–130 ms |
| 2 | 7.10–9.20 | Highway (red cars) + mini browser top-right | 2 | **camera morph**: browser scales down into the corner while the road reveals, 270 ms (7.10–7.37) |
| 3 | 9.20–10.50 | Title card "A DDOS ATTACK" over dimmed highway, mascot enlarged | 3 | hard cut (1 frame), mascot scale-punch |
| 4 | 10.50–13.35 | Highway + YOU car + barrier | 3 | hard cut back |
| 5 | 13.35–14.85 | Empty road + "THINK OF IT AS A TRAFFIC JAM" | 3 | 130 ms fade-out of cars |
| 6 | 14.85–27.95 | Highway world: skyline, cyan flow, gate log, red flood, counter, clog | 14 | in-place rebuild (fade-ins) |
| 7 | 28.00–30.75 | Highway close-up on your car | 4 | cut to closer framing + 1.25 s push-in |
| 8 | 30.75–33.85 | Highway + error browser + request panel | 4 | pull-back, 67 ms |
| 9 | 33.85–35.50 | Wide highway, blocked gate | 2 | hard cut |
| 10 | 35.50–39.80 | Metrics dashboard (healthy) | 7 | clear-to-empty, then staggered fades |
| 11 | 39.83–43.45 | Same dashboard, saturated state | 3 | hard 1-frame state flip (colour + mascot scale) |
| 12 | 43.50–46.20 | "THE MACHINE FILLS UP" bars | 3 | hard cut (mascot removed) |
| 13 | 46.25–48.10 | Connections grid + queue depth | 3 | cut + 67 ms fade-in (strip 46.15 f2→f4) |
| 14 | 48.13–50.85 | Access log | 3 | cut |
| 15 | 50.88–53.70 | Road outline + DDoS mark | 4 | cut |
| 16 | 53.75–55.45 | One-computer attacker | 4 | cut |
| 17 | 55.50–59.85 | Device swarm → botnet spiral | 4 | cut |
| 18 | 59.88–62.20 | Malware infects: 3 device cards | 4 | cut |
| 19 | 62.25–64.60 | World map + compromised counter | 2 | cut + 250 ms map fade |
| 20 | 64.63–66.85 | Router status over dimmed map | 4 | cut (mascot returns) |
| 21 | 66.88–71.35 | Command & control terminal + swarm | 5 | cut |
| 22 | 71.38–73.20 | One camera → origin load | 2 | cut |
| 23 | 73.25–76.60 | 100,000 DEVICES swarm + load % | 4 | cut |
| 24 | 76.63–78.70 | Attack-type tabs + road | 3 | cut |
| 25 | 78.75–80.20 | BANDWIDTH heading | 2 | cut |
| 26 | 80.25–84.95 | Uplink pipe → 200 Gb/s | 7 | cut |
| 27 | 85.00–88.20 | Close red highway + stats panel | 2 | cut |
| 28 | 88.25–90.95 | Wide jam at city gate (no mascot) | 2 | cut / pull-back |
| 29 | 91.00–92.70 | CONNECTIONS heading | 2 | cut |
| 30 | 92.75–98.70 | 100-slot grid | 7 | cut |
| 31 | 98.75–100.85 | APPLICATION LAYER heading + routes | 3 | cut |
| 32 | 100.88–104.70 | Legit vs malicious request cards | 5 | cut |
| 33 | 104.75–107.55 | Route cost table | 3 | cut |
| 34 | 107.63–111.85 | 1 request → 6 DB fan + computation | 5 | cut |
| 35 | 111.88–115.85 | Seesaw + "NOTHING VS A LOT" | 6 | cut |
| 36 | 115.88–120.60 | Survive? road + rule 1 | 6 | cut |
| 37 | 120.63–125.20 | "In front of your application": logos + map | 9 | cut-to-empty (~70 ms), then staggered fades (strip 120.5) |
| 38 | 125.25–128.10 | Origin / edge / internet layers | 5 | cut |
| 39 | 128.13–131.10 | Highway + EDGE barrier + absorb chart | 4 | cut |
| 40 | 131.13–134.20 | Highway filtering + decisions counter | 3 | zoom to road |
| 41 | 134.25–135.70 | Rate-limiter icon | 2 | cut |
| 42 | 135.75–139.85 | Source-rate table | 5 | cut |
| 43 | 139.88–141.85 | Blocked-IP pills + blocklist | 3 | cut |
| 44 | 141.88–144.60 | Distinct-source grid 1.24 M | 3 | cut |
| 45 | 144.63–153.60 | Signals list + bot score + BOT stamp | 13 | cut |
| 46 | 153.63–154.85 | "HARDEST PART" title | 2 | cut |
| 47 | 154.88–157.60 | Two S-curve charts | 4 | cut |
| 48 | 157.63–161.85 | Ticket browser + cyan road + demand chart | 4 | cut |
| 49 | 161.88–164.20 | Naive rule + road | 3 | cut |
| 50 | 164.25–168.20 | Mixed sorting road + errors + decisions | 4 | cut (mascot removed) |
| 51 | 168.25–170.00 | "THAT'S WHY IT'S HARD" + confidence | 3 | cut |
| 52 | 170.00–176.87 | HACKED? / intact origin, then final highway + "THEY BLOCK THE ROAD" | 10 | cut; ends with a 500 ms fade to black |

- **Mean scaffold lifetime:** 176.9 / 52 = **3.4 s** (median ≈ 2.8 s). The longest are #6 (13.1 s, a single world that keeps being mutated) and #45 (9.0 s).
- **Beats per scaffold:** ~4.5.
- **Transition grammar:** ≈90% are *hard cut to the persistent chrome*. The old content vanishes in 1 frame and the new content fades in over 67–130 ms, usually staggered. There is **no slide, whip, wipe, or crossfade between scaffolds**. The only continuous camera transitions are 7.10 (morph/zoom-out), 28.0 (push-in), and 131.1 (zoom to road).

## 3. Ten-point analysis

### (1) Beat timestamps
See §1: 236 beats.

### (2) Gap distribution (between my 235 unique beat times)
- **Gaps:** min 70 ms, **median 630 ms**, mean 753 ms, max 2,380 ms.
- **Histogram:** <200 ms: 17 · 200–400: 38 · 400–700: 67 · 700–1000: 48 · 1–2 s: 62 · 2–3 s: 2 · >3 s: 0.
- **Bursts:**
  - 0.10–0.60: 4 beats in 0.5 s.
  - 9.13–9.77: 4 beats.
  - 48.13–49.90: 4 beats.
  - 60.38–62.25: device cards 0.6 s apart.
  - 120.63–122.25: 6 beats in 1.6 s.
  - 147.25–152.33: signal rows every ~0.8 s.
- **Longest holds, and what is on screen during them:**
  - **20.00→22.38 (2.38 s):** not static. Cyan cars flow continuously up the road and gate-log rows keep appending.
  - **166.25→168.25 (2.0 s):** mixed red/cyan cars keep flowing through the sorting road.
  - **2.75→4.63 (1.88 s):** blank browser with a rotating spinner. This is the only near-static hold, and it is a deliberate "nothing happens" joke.
  - **85.00→86.88 (1.88 s):** close red highway, static.
  - **74.88→76.63, 96.25→98.0, 62.88→64.63, 16.63→18.38 (1.75 s each):** each is filled by a running counter (load %, slot fill, device counter) or by car flow.
- **Takeaway:** there is effectively **no frame without motion for more than ~1.9 s**. Holds are carried by counters, flows, and rotating swarms.

### (3) Rates
- **Beats:** 235 / 2.948 min = **79.7 beats/min** (machine: 93.3).
- **Scaffold changes (content cuts):** 51 / 2.948 = **~17 cuts/min**, one every ~3.4 s. The machine reports 0 cuts because the HUD, background, and mascot never change, so its full-frame cut detector never fires.

### (4) Narration-to-visual sync
- **Word-anchored within ~0.3 s:** 180/236 = **76%**.
- **Semantically anchored but offset:** 20 more (16 lead by 0.3–0.9 s, 4 lag by 0.3–0.6 s). Total semantic anchoring is **85%**.
- **Free-running:** 36/236 = **15%**. These are secondary follow-ons: loaded underlines, HUD latency ticks, spirals forming, legends, and "tail" tags.
- **Leads are deliberate:** big reveals often appear ~0.3 s *before* their keyword.
  - "200 Gb/s" at 83.83 vs "two hundred" at 84.08.
  - "5,000,000" at 42.43 vs "five" at 42.66.
  - "BOT" stamp at 152.33 vs "human" at 152.80.
- **Per sentence:** 60 sentences, **3.9 beats per sentence** (4.6 in the machine count). Short sentences get 1–2 beats ("That's the outage." gets 30.75 + 31.17). Enumerations get one beat per item:
  - 59.82–61.70 (computers/routers/cameras)
  - 121.30–124.66 (Cloudflare/AWS/CDN)
  - 147.0–151.1 (six signals)

### (5) Motion quality (measured frame-by-frame on 30 fps strips)

| beat | strip frames | duration | curve observed |
|---|---|---|---|
| Mascot intro slide from left (0.067–0.233) | f2 partial at left edge → f7 settled | ~170 ms | ease-out (largest step first), no overshoot |
| Caption / title fade-in (0.167, 0.333–0.467) | caption f5 dim → f6 full; title f10 dim → f14 full | 33 ms caption; 130 ms title | opacity-only, linear-ish |
| Browser window in (0.600–0.733) | f18 faint → f22 full | 130 ms | opacity + slight scale, ease-out |
| Camera morph browser→corner (7.10–7.37) | 7.0 strip f3 → f11 | 270 ms | ease-in-out; browser ~1.0 → ~0.25 scale, road cross-reveals; tiny drift until f13 |
| Mascot scale punch + dim (9.20) | 9.1 strip f2 → f3 | **0 ms (1-frame cut)** | no tween; same at 39.83 (39.7 strip f3 → f4) |
| "A DDOS ATTACK" title (9.30) | f6 grey → f7 full | 67 ms | opacity only, no scale |
| Underline draw (9.77) | f20 starts R→L; full by ~9.875 on sheet | ~130 ms | linear wipe |
| ON-RAMP counter 8,211 → 400,000 (23.97–25.1) | 23.8 strip f5–f35 | ~1,150 ms | **clean ease-out**: per-frame increments 34k, 33k, 31k … 3k, 2k, 1k; the digits change every frame |
| Slow push-in on your car (28.0–29.25) | 28.0 strip f0–f35 | ~1,250 ms | ease-in (almost imperceptible until f24, then visible scale-up to ~1.25) |
| Error browser in (31.17–31.30) | f5 faint → f8 settled | ~130 ms | fade + small scale-up, ease-out |
| 1,000 → 1,000,000 counter (40.25–42.40) | sheets 40.25–42.375 | ~2,150 ms | **ease-in / exponential**: 1,008, 1,085, 1,297, 2,079, 4,003 … 615k, 838k; final ticks 902k → 971k → 1.0M (42.33–42.40) |
| "5,000,000 req/s" slam (42.43) | f4 30% → f5 full; panel fades f5–f9 | 67 ms text, 170 ms panel fade-out | crossfade, no scale, no shake |
| NETWORK 0 → 100% bar (43.83–44.43) | 43.8 strip f1–f19 | 630 ms | ease-out (power2-like): +6, +13, +12, +10, +10, +8, +7, +7, +5 … +1 |
| Scene swap to connections grid (46.25) | 46.15 strip f2 old → f3 new at ~60% → f4 full | 1 frame out, ~67 ms in | hard cut + micro fade-in |
| Access-log rows (49.13–49.63) | 49.0 strip f4, f7, f10, f13, f16, f19 | stagger **100 ms**; each row ~67–100 ms | fade + ~10 px slide from the right, ease-out |
| Shockwave ring (69.73–70.03) | 69.6 strip f4 → f13 | 300 ms | near-linear expansion off-frame while fading; the swarm brightens f13–f15 (~100 ms) |
| "100,000 DEVICES" pop (74.03) | f4 ~60% opacity, ~5 px right → f5 settled | 33–67 ms | micro slide + fade, effectively a hard pop |
| "200 Gb/s" pop (83.83) | 83.2 strip f19 dim → f20 full | 67 ms | same micro fade; the pipe swap at f7 (83.43) is a 1-frame cut |
| DB fan lines (109.03–109.63) | 109.0 strip f1–f19 | each line ~130–170 ms, stagger ~100 ms, total 600 ms | stroke-draw from the request pill outward; DB icons fade in as each line lands |
| **BOT stamp (152.33–152.57)** | 152.3 strip f1–f8 | ~230 ms | **scale-down slam with spring**. Measured width 125 → 107 → 97 → 95 → 99 → 103 → 105 → 106 px, i.e. ~1.2× → **undershoot to ~0.9×** → settle at 1.0. Slight tilt. This is the only overshoot I saw. |
| S-curve chart draw (155.38–155.93) | sheet 155.375 → 155.875; strip f16–f18 | ~500 ms | linear left→right stroke draw |
| Scene swap to empty + staggered build (120.60–120.87) | 120.5 strip f3 old → f5 empty → f7 title → f9–f11 cards | old out 1–2 frames; gap ~70 ms; each element ~67 ms, stagger ~70–100 ms | hard cut + cascaded micro-fades |

**Summary:**
- Discrete element entrances are **67–170 ms**, opacity-dominant, and ease-out.
- Scene swaps are **1-frame cuts**.
- Counters and bars run **0.5–2.2 s** with **ease-out**. The one exception is the escalation counter at 40.25, which uses ease-in to sell exponential growth.
- Overshoot/spring appears exactly once (BOT stamp).
- There are no bounces and no motion blur.
- The machine's peak_pos median of 0 (ease-out-like) and settle median of 133 ms agree with these measurements.

### (6) Camera-level effects
- **7.10–7.37:** zoom-out/morph. The browser shrinks to a corner as the highway world is revealed (270 ms).
- **28.00–29.25:** slow push-in (~1.25 s, ease-in, ≈1.25× scale).
- **30.75:** pull-back to wide (~67 ms).
- **88.25:** pull-back cut; the skyline comes into view.
- **131.13:** zoom to the road (cut + recolour).
- **Mascot "punch" (the character is rescaled ~1.3×, the background is not):** 9.20 and 39.83 are 1-frame cuts; at 175.00 the mascot is shown larger for the final beat.
- **Not observed anywhere:** no shake, no parallax layers, no DOF/blur, no rotation, no whip pans.
- **Mascot micro-motion:** an eye blink (7.0 strip f1–f3, eyes closed ~70 ms) and mouth-shape changes across frames (lip-flap). This is the only idle motion.

### (7) Colour
- **Background:** near-black (#050807-ish) with a subtle dark-teal radial glow behind the content and a faint dot grid (visible in strips 31.0 and 23.8). It is effectively flat and dark, not animated.
- **Palette (semantic, not per-item):**
  - cyan/teal: legit / OK / you / caption accent
  - crimson red: attack / error / offline
  - amber: degraded / saturated / attack-type headings
  - violet/purple: botnet / devices / the "D" of DDoS
  - brand colours appear only for logos at 121–124 (Cloudflare orange, AWS red)
- **Hues visible at the same time:**
  - 24.0: cyan + red = 2
  - 42.6: cyan caption + red + amber HUD = 3
  - 83.9: cyan + amber tab + red = 3
  - 123.75: cyan dots/caption + orange + red + purple = 4, the maximum
  - 150.0: amber + cyan = 2
  - 152.5: amber + red + cyan = 3
  - Machine hue stats agree: 1 hue on 54% of frames, 2 on 41%, 3 on 5%.
- **Accent rule:** simultaneous items share **one state accent**. All six signal rows are amber; all attacker cars are red; all IP pills are red. Items get distinct colours only when they differ semantically (legit cyan vs attack red) or are brands.
- **Scene state is also driven through the HUD pill:** OK cyan → DEGRADED amber → OFFLINE red → FILTERING cyan (5.63, 9.13, 25.75, 31.88, 37.13, 39.83, 95.63, 133.63, 174.38).

### (8) Iconography / graphic style
- **Linework:** flat, thin strokes (~1–2 px at 1080 w); dark cards (#0d1214-ish) with 1 px slightly lighter borders; corner radius ~4–6 px on cards; fully rounded pills for status tags.
- **Glow:** almost none, only a soft glow on the red/cyan barrier lines and the cyan cars.
- **Type:** monospace for all data (counters, logs, HUD, terminal); heavy grotesk display type for big statements (A DDOS ATTACK, 5,000,000 req/s, 100,000 DEVICES, NOTHING VS A LOT, THEY BLOCK THE ROAD); tiny tracked uppercase labels (ORIGIN, ACCESS LOG, QUEUE DEPTH).
- **Recurring motifs:**
  - Cartoon scientist mascot (left, holding a sticker-covered laptop).
  - HUD status bar (ORIGIN pill + req/s + ms).
  - Browser window chrome with red/amber/green dots (0.6, 31.17, 157.63).
  - Perspective highway of rounded car chips with a dotted city skyline (15 scaffolds).
  - Numbered attack-type tab strip (76.9–100.8).
  - Terminal panel (66.88).
  - World map with dot markers (62.25, 121.75).
  - Big red display number as the punchline (42.43, 83.83, 74.03).

### (9) Sound
Not assessable visually. The following visible events look like SFX hits: the shockwave ring (69.73), BOT stamp slam (152.33), typewriter text (68.75, 111.25), escalating counters (40.25, 56.13, 142.13), 5,000,000 slam (42.43), and 200 Gb/s pop (83.83). The machine found only 23% of beats on prominent audio transients (chance: 24%), so there is **no evidence that visuals are cut to SFX or music**. They follow the words.

### (10) Layout / safe zones (measured on 480-px-tall strip frames)
- **HUD bar:** ~y 17–19%.
- **Content zone:** ~y 20–72%. Big display text sits at ~y 25–55% on the right half.
- **Caption:** ~y 77–83%.
- **Clear margins:** ~16% at the top and ~17% at the bottom. The machine measured content starting at 13% from the top and ending 19.5% from the bottom.
- **Mascot:** x 0–20%, y ~30–72% (≈42% of frame height). In the enlarged state (9.2, 39.8–43.4, 175.0) it spans y ~24–72% (≈48%). It is **absent** during dense diagram scenes: 43.5–48.1, 62.25–64.6, 88.25–91.0, ~100.9–115.9, 120.6–128.1, 135.75–153.6, 164.25–168.2. Content then uses the full width.
- **When the mascot is present,** content lives in the right ~78% of the frame.

## 4. What makes this feel fast (observed mechanisms only)

1. **Every noun gets a visual event on its word.** 76% of beats land within 0.3 s of the word they depict, and lists get one beat per item:
   - computers / routers / cameras at 60.38, 61.00, 61.63
   - Cloudflare / AWS / CDN at 121.25, 122.25, 123.50
   - signals at 147.63 … 150.88
2. **Cheap 1-frame scene cuts on a persistent chrome, about every 3.4 s.** The swaps at 43.50, 46.25, and 120.63 have no transition animation; new elements fade in over 67–130 ms. There are about 17 content cuts per minute, but no visual "jump" because the HUD, background, and mascot never change.
3. **Holds are filled with running numbers.** Counters run continuously through the gaps between beats:
   - 23.90 (8k → 400k)
   - 40.25 (1k → 1M, exponential)
   - 56.13 (→ 1.24M)
   - 62.88 (→ 1.24M)
   - 96.25 (18 → 100)
   - 110.50 (0 → 620 ms)
   - 132.38 (→ 4.998M dropped)
   - 142.13 (→ 1.24M)
4. **Continuous ambient systems.** Flowing car traffic (16.63–22.3, 164.25–168.2) and a rotating botnet spiral (57.0–59.8, 68.0–71.3, 74.25–76.6) keep the frame alive with no discrete beats.
5. **State flips via global colour and the HUD pill.** The whole screen flips cyan → amber → red in 1 frame (39.83; HUD at 9.13, 25.75, 31.88, 95.63, 174.38). One change reads as "everything got worse" in one frame.
6. **Punchline slams.** Huge red or purple display numbers arrive in 2 frames, ~0.2–0.3 s *before* the spoken number: "5,000,000 req/s" at 42.43, "200 Gb/s" at 83.83, "100,000 DEVICES" at 74.03, and the "BOT" spring stamp at 152.33.
7. **Mascot scale punch on hard cuts.** At 9.20 and 39.83 the character jumps ~1.3× in one frame at the moment of escalation ("That's a DDoS attack", "Now it's ten thousand").
8. **Fast staggered builds.** Rows, tabs, and pills cascade in at a 70–125 ms stagger:
   - log rows at 49.13 (100 ms stagger)
   - route table at 104.75 (~125 ms)
   - DB fan lines at 109.03 (100 ms)
   - edge PoPs at 126.00
   - IP pills at 140.00
   - scene build at 120.63

## 5. Visual count vs machine beat list
- **Totals:** machine 275 beats vs my 235 unique timestamps (**−40, −15%**).
- **Matching within ±0.2 s:** 213/275 machine beats (77%) match a visual beat of mine; 192/235 of my beats (82%) match a machine beat.
- **Extra machine beats** are mostly frame-level sub-steps of one visual event, such as successive car rows during a flood or counter ticks. Examples: 140.33/140.50/140.63/140.80/140.93 are one "IP pills pop" beat, and 25.33/25.50/25.63/25.90 are the counter tail.
- **Machine holds I refute:**
  - **136.03–139.87 (3,833 ms):** the rate counter ticks 100 → 9,480 (136.25–137.1), the LIMIT tag appears (137.13), the rate drops (137.25), and the row goes red (138.63). The changes are small-area, below its threshold.
  - **19.47–22.27:** car flow + gate-log rows.
  - **144.67–147.23:** signal rows stagger in at 145.13 and the bot-score row at 145.75.
- **Machine hold I confirm:** 2.27–4.70 (only the spinner rotates until the HUD tick at 4.63).
- **Cuts:** machine 0 vs visual ~51 content cuts.
