# "Full bars, nothing loads" (campfire, Leo + Walter, ~55 s final, voice at 1.3x)

Premise: Leo is still annoyed that the wedding Wi-Fi was dead although his phone showed full bars. Walter, his grandfather, explains in plain words why a crowd kills wifi. Both stay seated by the fire the whole time. The phones, the router and the wedding exist only in words and in the MG.
Payload: (1) bars show how strong the router's signal is, not how busy the channel is; (2) wifi is one shared channel, one device talks at a time; (3) each device listens first and talks only when it is quiet; (4) two talking at once = collision, both stop and retry after a random wait (random so they don't collide forever); (5) more devices = more waiting and more collisions; (6) one slow, far or old device needs more airtime for the same data and holds everyone up; (7) neighbours' routers share the same channels (the old 2.4 GHz band has only three clear ones); (8) fix: the fast band or a cable (its own lane).
Human question: "Why is it bad when my signal is full?" Turn: it was never about signal, it was about taking turns. Landing: the slow phone at the wedding was Walter's.
Running line: "turns" (L6, L12), "everyone waits" (L14).

LEO (curious) [CU]: Grandpa, the wedding Wi-Fi was awful. Full bars, nothing loaded.
WALTER (amused) [MS]: Bars show how loud the router is. Not how busy.
LEO (curious) [OTS]: Busy with what?
WALTER (warm) [MS]: Wi-Fi is one room, one speaker. Only one device talks at a time.
LEO (surprised) [OTS]: One? There were two hundred phones.
WALTER (matter-of-fact) [MS]: They take turns. Each listens first. If it's quiet, it talks.
LEO (thinking) [OTS]: And if two talk together?
WALTER (firm, light) [MS]: Crash. Both stop, wait a random moment, try again.
LEO (curious) [OTS]: Why random?
WALTER (warm) [2S]: Same wait, same crash. Forever.
LEO (confused) [OTS]: So more phones, more crashes?
WALTER (matter-of-fact) [MS]: More crashes, more waiting. Everyone's turn gets thinner.
LEO (shocked) [CU]: Wait. So one old phone slows everyone?
WALTER (pleased) [MS]: A slow phone needs longer to say the same thing. Everyone waits for it.
LEO (curious) [OTS]: And the neighbor's Wi-Fi?
WALTER (amused) [MS]: Same room. The old band has three clear channels. The street shares them.
LEO (curious) [OTS]: How do I fix it?
WALTER (warm) [MS]: The fast band, or a cable. A cable gets its own room.
LEO (grinning) [CU]: So who was the slow phone at the wedding?
WALTER (dry, flat) [CU]: Mine. Thirty minutes to send one photo of the cake.

#end

Delivery notes (voice): normal conversational pace (the track is sped up 1.3x after, pitch kept). Leo: curious, surprised, playful; L13 is the turn ("Wait."), a grin on L19. Walter: warm, smiling in the voice, falls to a low finish; only the last line is dry and flat, after a beat.
Seated: no actions at all. Nobody holds a phone; the router, the phones, the crash and the cable are words + MG only.

<!-- Sources (plain terms)
- Signal bars on a phone reflect received signal strength (RSSI) from the access point, not channel load or throughput: Apple / Android support docs on wifi status; Cisco "Wireless signal strength vs quality".
- 802.11 shares one radio channel; stations use CSMA/CA (carrier sense: listen before talk) and, when a collision or lost ack happens, a random binary-exponential backoff before retrying: IEEE 802.11-2020 clause 10.23 (DCF); Wikipedia "CSMA/CA".
- Random backoff exists so stations that collided do not collide again on the same slot: same sources.
- One slow station occupies the channel for longer per frame and drags the throughput of all stations toward its own rate ("performance anomaly"): Heusse et al., "Performance anomaly of 802.11b", IEEE INFOCOM 2003.
- 2.4 GHz band: only three non-overlapping 20 MHz channels (1, 6, 11) in most regions, shared with neighbouring networks; 5 GHz has many more (and shorter range): IEEE 802.11 channel plans; Wikipedia "List of WLAN channels".
- Wired Ethernet (switched, full duplex) gives each device its own link instead of a shared medium: IEEE 802.3.
- Two hundred phones and a thirty-minute cake photo are Leo's and Walter's colour, not claims.
-->
