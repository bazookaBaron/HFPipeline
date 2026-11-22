# "Half a second" (campfire, Leo + Walter, ~55 s final, voice at 1.3x)

Premise: Leo pressed Enter on a web address and the page was there before he lifted his finger. Walter, his grandfather, walks him through what the computer does in that half second, in plain words (the classic interview question). Both stay seated by the fire the whole time. The laptop, the phone book, the handshake and the page exist only in words and in the MG.
Payload: (1) the computer does not know where the name lives, so it asks DNS, a phone book: name in, number (an address) out; (2) it opens a connection with a three-message handshake (hello, hello back, okay go); (3) it agrees a secret code in the open (TLS), the padlock means it worked; (4) only then it asks for the page, one request line; (5) back comes plain text, the page's skeleton (HTML), which lists pictures, styles and scripts; the browser fetches each one and paints the page; (6) every other site (the ads) needs its own phone-book lookup, handshake and code first.
Human question: "Why is it instant, and why is it also slow?" Turn: the page was only the skeleton, the work is all before and after the request. Landing: the page arrived, the ads are still shaking hands.
Running line: "half a second" (L1, L17, L18 by implication, L20).

LEO (curious) [CU]: Grandpa, I press Enter and the page is there in half a second. What happened?
WALTER (amused) [MS]: First, the computer asks where that name lives. It has no idea.
LEO (curious) [OTS]: Asks who?
WALTER (warm) [MS]: A phone book for the internet. Name in, number out. It's called DNS.
LEO (thinking) [OTS]: What kind of number?
WALTER (matter-of-fact) [MS]: An address, like a street. Now it knows which machine to call.
LEO (curious) [OTS]: So it starts talking?
WALTER (firm, light) [MS]: First, a handshake. Hello. Hello back. Okay, go. Three tiny messages.
LEO (surprised) [OTS]: Hello? To a computer?
WALTER (amused) [MS]: Computers are polite.
LEO (curious) [OTS]: And the little padlock?
WALTER (warm) [2S]: Then they agree on a secret code, out in the open. The padlock means it worked.
LEO (shocked) [CU]: Wait. I haven't even asked for the page yet?
WALTER (matter-of-fact) [MS]: Now you ask. One line: give me this page. Back comes the skeleton, called HTML.
LEO (confused) [OTS]: Just a skeleton?
WALTER (pleased) [MS]: It lists pictures, styles, scripts. The browser fetches each one, then paints the page.
LEO (grinning) [OTS]: All of that in half a second?
WALTER (amused) [MS]: Usually less.
LEO (grinning) [CU]: Then why does my news site take five seconds?
WALTER (dry, flat) [CU]: The page arrived in half a second. The ads are still shaking hands.

#end

Delivery notes (voice): normal conversational pace (the track is sped up 1.3x after, pitch kept). Leo: curious, surprised, playful; L13 is the turn ("Wait."), a grin on L17/L19. Walter: warm, smiling in the voice, falls to a low finish; only the last line is dry and flat, after a beat.
Seated: no actions at all. Nobody opens a laptop or types; the address bar, the phone book, the handshake, the padlock and the page are words + MG only.

<!-- Sources (plain terms)
- DNS maps a name to an IP address; a recursive resolver asks root -> TLD -> authoritative servers and caches the answer for its TTL: RFC 1034 / RFC 1035; Cloudflare Learning Center "What is DNS?". Result is an IPv4 (four numbers, e.g. 93.184.216.34) or IPv6 address: RFC 791 / RFC 8200.
- TCP opens a connection with a three-way handshake, SYN, SYN-ACK, ACK: RFC 9293 (obsoletes RFC 793) section 3.5.
- TLS 1.3 agrees shared keys with an (EC)DHE key exchange sent in the clear, after which everything is encrypted; the server proves its identity with a certificate; browsers show the padlock when the certificate checks out: RFC 8446; MDN "Transport Layer Security".
- Browser sends an HTTP request (method + path + headers, e.g. GET /) and the server answers with a status and HTML text: RFC 9110; MDN "An overview of HTTP".
- The browser parses the HTML, finds sub-resources (images, CSS, JS) and fetches them, then builds the DOM and CSSOM and paints: MDN "How browsers work" / "Populating the page"; web.dev "Critical rendering path".
- Third-party hosts (ads, trackers) each need their own DNS lookup, TCP connection and TLS handshake before a single byte of their content: web.dev "Establish network connections early"; HTTP Archive Web Almanac (Third Parties).
- "Half a second" is Leo's perception, not a claim: a warm connection with cached DNS is much faster, a cold one on mobile can be slower.
-->
