# load_balancer storyboard (9:16, colourful iso kit, "A million people, one door", voice at 1.3x)

Look: the approved iso kit (mg/isokit) on the deep-indigo field: mint islands, coral / saffron / sky / violet accents, glow only on emitters (packets, pings, rings, ticks). Ember = "broken" only.
Cast of objects (same on every card): PHONE (violet, lit mint when it works), HOST = the load balancer (saffron man-block with a cream head; a coral arm points at the target), SERVERS (sky racks with three lights = how busy: mint, coral when full), visitors/packets (cream dots, glowing).
Layout of the recurring world: phone at the left, host in the middle, a column of three servers at the right, flat dashed roads between them.
Each card SHOWS the mechanism with the sound off. Times are global seconds of the 1.3x track (mg.js looks words up at run time with W(line, word)).
Card layout (9:16 `float`): x 54, y 154, 972 x 560; heads clear (headcheck.js). Tags/labels >= 28 px at 1080 wide, <= 3 words. Cards <= ~7 s. Under a card only MS/CU rigs. No label-only beats.

| # | Card (tag) | Line(s) | Window | What moves (sound-off read) |
|---|---|---|---|---|
| 1 | A MILLION AT ONCE | L1-L2 | 0.4 -> 6.0 | One server on an island. "million" 0.6: a crowd of dots streams in from the left (hud "1 000 000"); the crowd keeps growing, the server's three lights fill to red. "would" 4.5 / "instantly" 5.1: the server cracks (ember colour, a cross, rings), the crowd keeps coming. Tag: ONE COMPUTER / DEAD. |
| 2 | HUNDREDS | L3-L4 | 6.3 -> 10.4 | A wall of 6 x 3 identical servers pops in one by one ("Hundreds" 7.6), each gets the same saffron page strip on top ("running the same copy" 9.0). hud "100s of SERVERS", "SAME SITE". |
| 3 | ONE DOOR | L5-L6 | 10.5 -> 17.1 | The phone at left, three servers at right, a host between them. "knocks" 11.3: a saffron packet runs from the phone to the host (one road only); "man" 13.5 / "host" 15.5: hud HOST over the host, MANY SERVERS over the column; dashed roads fan from the host to each server. |
| 4 | HE POINTS | L7-L8 | 18.0 -> 22.0 | Visitors wait at the phone. "points" 18.2: the host's coral arm turns to server 1 and a packet flies host -> 1; "one" 19.4: to 2 ("two" 20.5: to 3); "Round and round" 21.1: it goes again 1, 2, 3 (server lights fill evenly). Numbers 1 2 3 beside the servers. |
| 5 | THE EMPTIEST TABLE | L9-L10 | 22.1 -> 26.5 | Server 2's lights fill to red (hud SLOW, "slow" 23.0). "next guest" 23.9: the host's arm skips it and points at server 3 (hud EMPTIEST, "emptiest" 24.8), a cream packet flies there; "keeps count" 26.1: hud COUNT over the host. |
| 6 | A BROKEN TABLE | L11-L12 | 26.7 -> 33.0 | Sky ping packets leave the host to each server every 1.4 s and come back as mint ticks ("checks" 28.3). Server 2 breaks at "breaks" 27.4 (ember colour, cross, hud BROKEN): its ping gets no tick, its road goes ember and faint ("no guests" 30.6). Guests keep flowing to servers 1 and 3; the phone stays lit and hud ALL FINE ("Nobody notices" 32.3). |
| 7 | TWO HOSTS | L13-L14 | 33.3 -> 39.0 | Two host blocks at the left of the servers. "break" 35.9: the first host dims and gets a cross (hud HOST in ember); "Good catch" 36.6: a second host appears beside it (hud HOST 2); "two" 38.1: the phone's road swaps to host 2 and the packets run there. |
| 8 | THE PUBLIC LIST | L15-L16 | 39.5 -> 44.3 | The two hosts; a violet LIST slab above them with two mint arrows down to them ("points" 40.5, "list" 42.2, hud PUBLIC "public" 43.7). |
| 9 | ALL THE WAY UP | L17-L18 | 44.4 -> 50.4 | The same stack; at "checks" 45.0 another slab appears above the list, then another, alternating HOSTS / LIST, each with a mint arrow down; "?" at the top. "hosts all the way up" 48.1-49.3: the last slab lands. The card stays as it is when the line ends (no stinger). |

Coverage: why one machine fails (1), horizontal scaling (2), single entry point (3), round robin (4), least-busy / least-connections (5), health checks + failover (6), redundant balancers (7), the public list / DNS (8), infinite regress joke (9).
