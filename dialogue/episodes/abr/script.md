# "Why does my movie go blurry, then sharp again?" (campfire, Leo + Walter, ~55 s final, voice at 1.3x)

Premise: Leo's movie goes blurry for a moment and then sharp again, and he takes it as the app being broken. Walter, his grandfather, walks him through adaptive bitrate streaming in plain words. Both stay seated by the fire the whole time. The movie, the player and the wifi exist only in words and in the MG.
Payload: a streamed video is cut into pieces a few seconds long; every piece is stored in several qualities (small and blurry ... big and sharp); the player picks the quality of the NEXT piece from how fast the last one arrived and from how much video it already has saved ahead (the buffer); a slow connection means the small piece, so it arrives before the picture would freeze; a full buffer lets it risk the big piece, a thin one makes it play safe; when the speed comes back, the next pieces are sharp again.
Human question: "Is my app broken?" Turn: the blur is a choice, made for you, so the picture never freezes. Landing: the blur is the player protecting a patience that was never great.
No running gag from earlier episodes is reused.

LEO (curious) [CU]: Grandpa, why does my movie go blurry, then sharp again?
WALTER (amused) [MS]: Because it isn't one movie. It's a pile of little pieces.
LEO (surprised) [OTS]: Pieces of a movie?
WALTER (warm) [MS]: A few seconds each. And every piece is stored in several qualities. Small and blurry. Big and sharp.
LEO (thinking) [OTS]: So who decides which one I get?
WALTER (matter-of-fact) [MS]: Your player. Before each piece, it checks how fast the last one arrived.
LEO (curious) [OTS]: And if the wifi is slow?
WALTER (firm, light) [MS]: It asks for the small piece. Less to carry, so it arrives on time.
LEO (curious) [OTS]: Why not wait for the sharp one?
WALTER (amused) [MS]: Then the picture freezes. A blur you forgive. A spinning circle, never.
LEO (curious) [OTS]: So it just guesses?
WALTER (matter-of-fact) [CU]: It keeps a cushion. Seconds of movie, downloaded ahead of what you're watching.
LEO (thinking) [OTS]: And a fat cushion means sharp?
WALTER (warm) [2S]: Fat cushion, it risks the big piece. Thin cushion, it plays safe.
LEO (curious) [OTS]: Then the wifi comes back, and it's sharp again.
WALTER (matter-of-fact) [MS]: Piece by piece. Nobody has to tell you.
LEO (grinning) [CU]: So the blur is it looking after me?
WALTER (dry, flat) [CU]: It's looking after your patience. Which was never great.

#end

Delivery notes (voice): normal conversational pace (the track is sped up 1.3x after, pitch kept). Leo: curious, surprised at "Pieces of a movie?", a grin on the last question. Walter: warm, smiling in the voice, falls to a low finish; only the last line is dry and flat, after a beat.
Seated: no actions at all. Nobody holds a phone or a remote; the movie, pieces, wifi and cushion are words + MG only.

<!-- Sources (plain terms)
- Apple, "HTTP Live Streaming (HLS) Authoring Specification for Apple Devices" and RFC 8216 (HTTP Live Streaming): the video is split into short media segments; a master playlist lists several variant streams (the same content at different bitrates/resolutions); the client chooses a variant and may switch to another at segment boundaries as network conditions change. Apple's authoring spec recommends a segment length of about 6 seconds (script says only "a few seconds").
- MPEG-DASH (ISO/IEC 23009-1): the same model, with a manifest (MPD) listing "representations" at different bitrates, each cut into segments of a few seconds; the client's adaptation logic picks a representation per segment.
- Adaptation uses measured throughput (how fast the last segment downloaded) and the playback buffer level: Huang, Johari, McKeown, Trunnell, Watson, "A Buffer-Based Approach to Rate Adaptation: Evidence from a Large Video Streaming Service", ACM SIGCOMM 2014 (done on Netflix's service): with a nearly empty buffer pick the lowest rate to avoid a rebuffer (freeze), with a full buffer allow higher rates. dash.js documents the same two families (throughput rule, BOLA buffer rule). Netflix Tech Blog describes the same idea ("adaptive streaming", multiple encodes per title).
- Rebuffering (the spinning circle) happens when the buffer runs empty. No exact piece lengths, bitrates or buffer sizes are claimed: those differ per service.
- "A blur you forgive, a spinning circle never" and "your patience was never great" are Walter's colour, not claims.
-->
