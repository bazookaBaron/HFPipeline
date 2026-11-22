# wifi_crowd storyboard (9:16, iso MG, voice at 1.3x)

Look: approved colourful iso kit (mg/isokit), deep-indigo field, mint islands, coral/saffron/sky/violet; glow only on emitters (wifi, rings, packets); ember only for "broken" (crash, jam, slow hog).
Card 54,154 972x560 (`float`). Cards enter/leave on the nearest shot cut. Every label >= 28 px (hud 34 x .85). Under a card only MS/CU rigs (episode.json avoidUnderCards).
Times = global episode seconds; mg.js looks the words up in shots.json. Sound-off test: each card shows the mechanism moving.

| # | Tag | Lines / window | What moves (sound-off read) |
|---|---|---|---|
| 1 | BARS VS BUSY | L2-L3, 3.9-8.4 | Router island left (wifi rings), phone right; a lane (road) between. "Loud": 4 signal bars fill mint, FULL BARS. "Not busy": the camera drops onto the lane; the free-flowing packets slow, bunch up and turn ember, LANE FULL; the phone shows 0 KB/S while the bars stay full. |
| 2 | ONE SPEAKER | L4-L5, 8.4-16.2 | The room: island, router in the middle, a ring of 8 phones, a dashed channel ring (ONE CHANNEL). "One speaker": one phone lights, ON AIR, packets to the router. "Only one at a time": ON AIR hops from phone to phone, never two. "Two hundred": the camera pulls out, ~70 small phones fill the room, 200 PHONES - 1 TALKS. |
| 3 | TAKING TURNS | L6-L7, 16.2-22.1 | Same room. "Take turns": MY TURN hands from a phone to the next. "Listens first": an idle phone sends small listening rings, LISTEN, while the channel is saffron (busy). "Quiet": the sender stops, the channel turns mint, QUIET; the listener starts to talk. "Two talk together": two phones launch at once, AT ONCE, packets run toward the router. |
| 4 | CRASH | L8-L10, 22.1-29.6 | "Crash": the two packets hit at the router, an ember burst, CRASH, both bounce back. "Random moment": each phone gets a counter chip (WAIT 3, WAIT 7) counting down; the shorter wait goes first and gets through (mint tick), then the other. "Same wait": both get WAIT 5, count down together, crash again and again: CRASH AGAIN x1, x2, x3 ... infinity. |
| 5 | THE CROWD | L11-L12, 29.6-35.2 | Same room, the dots multiply from 8 to ~70 and flash ember. A scrolling airtime strip (28 cells) at the bottom: mint = data, ember = crash, dark = waiting; the mint share falls (DATA 78% -> ...), then ONE TURN IN 200. |
| - | (no card) | L13 | Leo CU, shocked: "Wait. So one old phone slows everyone?" |
| 6 | SLOW PHONE | L14, 38.2-43.0 | An airtime ribbon scrolls through ON AIR NOW. Short blocks (fast phones) pass quickly; the SLOW PHONE block is 6x longer (ember) and sits on the marker while three fast phones queue (WAITING, EVERYONE WAITS). |
| 7 | THE STREET | L15-L16, 43.0-51.0 | A street of six houses, one router (mint) then every house lights its router, rings overlap (SAME ROOM). Three channel discs light one by one (CH 1, CH 6, CH 11); all six routers pour rings into the same three discs, which go busy: THE STREET SHARES THEM. |
| - | (no card) | L17 | Leo ots, short question. |
| 8 | THE FIX | L18, 51.0-55.1 | "Fast band": six new thin lanes with quick packets sprout from the router. "Cable": a mint cable grows to a private island, packets flow in it, a mint ring appears around the end: OWN ROOM. |
| - | (no card) | L19-L20 | Faces: Leo grin CU, Walter dry CU on "Mine." |

Coverage: bars != busy (1), one shared channel (2), listen first + turns (3), collision + random backoff (4), more devices = more waiting (5), slow device hogs airtime (6), neighbours share channels (7), fast band / cable (8).
