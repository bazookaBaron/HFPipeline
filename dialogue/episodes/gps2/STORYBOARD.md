# gps2 storyboard (9:16, iso MG, same script + voice as gps)

Look: the approved colourful iso kit (mg/isokit) on the deep-indigo field. Fixed iso angle, one continuous
world per card, the camera moves between subjects (0.6 s eased, slow drift after). Glow only on emitters
(satellite dots, pulses, beams, wifi). Ember only for "broken" (cheap clock error, no correction, blocked signal).
Times are global episode seconds (1.5x track, words from shots.json; mg.js looks the words up at run time).
Sound-off test: every card below has to show the mechanism moving, not a label.

Card layout (9:16 `float`): card x 54, y 154, 972 x 560 (was 691 tall), bottom at y 714. The scene renders full
frame but framed so the actors sit in the lower rect y 860-1920 (extended frustum); the card floats over the
sky/trees above them. Caption row centred at y 786. Check: head-top + face of both actors projected per shot,
never above card bottom + 40 px, captions never on a face (episodes/gps2/headcheck.js).
Cards enter/leave on the nearest shot cut (<= 0.35 s) so the re-frame is not a second jump cut.

| # | Card (tag) | On screen | Enter on word | Out | What moves (sound-off read) |
|---|---|---|---|---|---|
| 1 | THE SIGNAL | L2-L5 | "Satellites" 2.32 (cut 2.17) | 10.31 (chains into 2) | Globe; four satellites pop in and orbit, each with a short comet-trail arc (not 4 full rings, so it stays clear). "Twenty thousand km up": a dashed altitude line climbs from the surface to one satellite while a counter runs 0 -> 20,200 KM. "Only say the time": each satellite sends out glowing rings and carries a ticking clock chip (12:00:00.0xx). "Your phone hears it": the camera pushes to Leo's phone on the globe (big now); one packet runs down the beam. "Late": it lands; phone chip shows HEARD +0.067 S LATE, held under Leo's "Late by how much?". |
| 2 | HOW FAR | L6-L7 | "Enough" 10.46 (cut 10.31) | (continues as card 3) | Island with the phone, one satellite above it, framed as a two-shot. "Late": a packet leaves the satellite and falls down the beam; a stopwatch at the phone counts 0.000 -> 0.067 s as it travels. "Speed of light": x 300,000 km/s appears. "Distance": a ruler with end ticks draws from satellite to phone, = 20,200 KM. "This far": a sphere grows out of the satellite until its shell touches the phone; the camera eases out to hold it. |
| 3 | FOUR BALLS | L8-L10 | (same world) | 24.67 | "Ball of possible places": the shell's ground circle lights, dots run round it (every point is a possible you). "Four satellites": camera pulls back, three more satellites pop in. "Four balls": three more spheres grow out of their satellites and meet at the phone. "Cross in one spot": ground circles draw, the crossing pulses. "That's you": camera pushes in, the pin drops on the phone. "Three would cross": camera back out, sphere 4 goes faint. "Clock is cheap": an ember phone-clock chip (+0.001 s); the three spheres all inflate by the same error, their circles miss each other and an ember triangle of doubt opens. "The fourth one fixes it": sphere 4 comes back, all spheres shrink together until the triangle closes to one point; chip turns mint (CLOCK FIXED). |
| - | (no card) | L11 | - | - | Leo CU, shocked: the face carries "in the ocean?". |
| 4 | ONE MICROSECOND | L12 | "millionth" 27.88 (cut 27.57) | (continues) | Long track island. A light packet streaks along the track while a 1 µs timer runs; a ruler draws under it, counter 0 -> 300 M. "Atomic clocks": camera moves up to a satellite; an atomic clock rides beside it, ticking. "Einstein corrects them": a ground clock appears below; the satellite clock's hand creeps ahead (ghost hand shows where they agreed), a correction nudge snaps it back, again and again. "38 µs a day": counter +38 µs / DAY. |
| 5 | SKIP HIM | L13-L14 | (same world) | ~37.7 | L13: time beam from satellite clock to the phone on the track. "Skip him": correction stops; the satellite clock runs away (ember), the readout turns NO CORRECTION. "Drift ten km a day": camera slides down the track; the pin slides away from the phone, an ember ruler stretches with a counter 0 -> 10 KM / DAY. |
| 6 | IN THE CITY | L15-L16 | card swaps at 37.74 ("And in the city") | 40.89 | City island, framed close (the city fills the card). "Between buildings": camera into the street canyon; satellite beams come down, two stop dead on tall facades (ember tick), one gets through; a big dashed doubt ring sits round the phone. "Maps": the streets light up as a map. "Wifi names": three rooftops send wifi rings with small name tags. "Fill the gaps": the doubt ring shrinks onto the phone and the pin drops. |
| - | (no card) | L17-L18 + tail | - | - | Punchline on faces (Leo grin CU, Walter dry CU, wide tail). |

Coverage: satellites broadcast time (1), phone hears late (1), delay x c = distance (2), spheres grow and meet ->
pin (3), why four / cheap clock (3), µs = 300 m + atomic clocks + relativity +38 µs/day (4), skip it -> 10 km/day
drift (5), city maps + wifi (6), end (no card).
