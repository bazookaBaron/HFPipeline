# url_enter storyboard (9:16, colourful iso kit, "Half a second")

Look: the approved colourful iso kit (mg/isokit) on the deep-indigo field: mint islands, coral / saffron / sky / violet accents, glow ONLY on
emitters (packets in flight, the lit lock, the painted page, pulse rings). Ember = "not done / waiting" is never used for a good state.
Colour code: coral = the name / the question, sky = the address (DNS), saffron = the request + the public colour, violet = your secret / styles,
mint = done / agreed / the server's answer, cream = text and paper.

**One world for cards 1-7:** a triangle of three small floating islands seen in iso, the camera moves between them.
LEFT = YOU: a flat browser window lying on the grass (address bar on top, page area below: blank -> wireframe -> painted) + a laptop-less, seated-friendly
scene (no person, no hand). BACK-CENTRE = DNS: a big phone book on a pedestal (rows: a violet name bar + a sky number bar per row).
RIGHT = THE SERVER: a short street of four small houses; the third one is the server (rack lights). Roads link the islands (flat decals).
Card 8 (ADS) is its own small world: the finished page in the middle, six little ad-server islands around it.
Times are global seconds of the 1.3x track (mg.js looks words up at run time with W(line, word)). Sound-off test: every card shows the mechanism moving.
No label-only beats, no templates.js, no grey cubes.

Card layout (9:16 `float`): x 54, y 154, 972 x 560; heads clear (headcheck.js: head-top of both actors never above card bottom + 40 px). Cards enter/leave on the
nearest shot cut. Text: every tag/label >= 28 px at 1080 wide (hud size 34 x .85), at most ~3 words per tag. Max ~8 s per card. Under a card only MS/CU rigs.

| # | Card (tag) | Line(s) | Window | What moves (sound-off read) |
|---|---|---|---|---|
| 1 | ASK A NAME | L2-L3 | ~3.9 -> 9.3 | Camera on YOU + DNS. The browser window is blank, its address bar reads "news.site". "asks" 4.9: a coral packet "news.site?" leaves the window, flies over the road to the phone book on the back island. "no idea" 7.1: a "?" bubble pulses over the window (it cannot go anywhere: no route yet). The packet lands on the book, which wakes (rows glow). |
| 2 | PHONE BOOK | L4 | ~9.3 -> 14.5 | Camera pushes onto the book. "phone book" 9.6: its rows fan in one by one (violet name bar + sky number bar each). "Name in" 11.2: the coral chip "news.site" slides in from the left and lands on one row, the row lights mint. "number out" 11.9: a sky chip "93.184.216.34" lifts off that row and flies back to the browser. "DNS" 13.5: the tag "DNS" pops over the book. |
| 3 | THE ADDRESS | L5-L6 | ~14.5 -> 20.0 | Camera pans right along the road. The sky chip lands on the address bar ("93.184.216.34"). "address" 16.0: the camera is on the SERVER island, a street of four small houses; a plate with the number rises over the third house. "like a street" 16.7: house plates 31 / 32 / 34 / 35 flick on in a row. "which machine to call" 18.7: a dashed route draws from the browser to the third house and it pulses (rings); the rack lights come on. |
| - | (no card) | L7 | - | Leo "So it starts talking?" |
| 4 | HANDSHAKE | L8 | ~21.3 -> 27.5 | Camera on YOU + SERVER (the road between). "Hello" 23.0: a coral packet "HELLO" runs browser -> server. "hello back" 23.7: a mint packet "HELLO" runs server -> browser. "Okay, go" 24.6: a saffron packet "OK, GO" runs browser -> server and the road turns solid mint (a live connection). "Three tiny messages" 26.0: the tag "3 MESSAGES" with three dots lit. |
| - | (no card) | L9-L10 | - | "Hello? To a computer?" / "Computers are polite." on faces. |
| 5 | SECRET CODE | L11-L12 | ~31.1 -> 38.1 | Same pair. "agree" 33.1: a public saffron colour puck rises in the middle of the road, tag "PUBLIC". "secret" 33.7: a violet puck on YOU and a coral puck on the SERVER rise, each under a small cap (hidden). "out in the open" 34.4: each side mixes its secret into the public colour; the two MIXED pucks fly across the road past each other in plain sight (an eye on the middle watches: it sees the mixes, cannot un-mix them). 35.5: each side adds its own secret to the mix it received: both end on the SAME colour (tag "SAME KEY"). "padlock" 35.9: a padlock closes (shackle drops) on the browser window and the road dots turn into scrambled blocks. |
| - | (no card) | L13 | - | Leo CU, the turn: "Wait. I haven't even asked for the page yet?" |
| 6 | ASK FOR THE PAGE | L14 | ~40.2 -> 46.2 | "Now you ask" 40.3: a saffron envelope "GET /" runs from the browser to the server (the rack lights blink). "Back comes" 43.9: a mint packet "HTML" returns and lands on the window. "skeleton" 44.6: the window draws a dashed WIREFRAME (header bar, picture box, three text lines, a button box) stroke by stroke. "HTML" 45.4: tag "HTML = SKELETON". |
| - | (no card) | L15 | - | Leo "Just a skeleton?" |
| 7 | FETCH + PAINT | L16 | ~47.9 -> 54.0 | The wireframe window. "pictures" 48.5: a coral packet "IMG" comes in and fills the picture box (sun + hill). "styles" 49.3: a violet packet "CSS" paints the header and the text lines. "scripts" 50.0: a saffron packet "JS" lands on the button box, which pops and pulses. "fetches each one" 51.2-52.4: three more small packets shuttle between the server and the window. "paints" 52.8: a bright sweep bar crosses the window, revealing the finished page; tag "PAINTED". |
| - | (no card) | L17-L18 | - | "All of that in half a second?" / "Usually less." |
| 8 | THE ADS | L19-L20 | ~57.1 -> 64.8 | The finished page in the middle (tick, "0.5 s"), six small ad islands around it (billboards). "five seconds" 58.8: a timer counts from 0.5 s up to 5.0 s while every ad island runs its own little loop: HELLO packet out, HELLO back, OK GO, each with an open padlock (not yet locked). "page arrived in half a second" 60.6: the tick lights on the page and the tag "PAGE 0.5 s" pops. "ads" 62.9: the ad islands keep exchanging HELLO packets; "shaking hands" 63.6: the ads' packets ping-pong faster with a little hand-shake wobble (two arrows meeting), padlocks still open. Ends with the ads still going when the line ends (no stinger). |

Coverage: DNS lookup (1-2), the address (3), TCP handshake (4), TLS key + padlock (5), request + HTML skeleton (6), fetch sub-resources + paint (7), third-party ads each needing the whole dance (8).
