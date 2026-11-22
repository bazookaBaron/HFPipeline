# "Where do my photos go?" (campfire, Leo + Walter, 45 s final, 150 words, voice at 1.5x)

Premise: Leo is a young viewer-proxy who asks plain questions. Walter is his grandfather, warm and a little amused, who explains in plain words with one picture. Both stay seated by the fire the whole time.
Payload: "the cloud" is just a building of computers that belong to a company; your photos live there, with spare copies.
Facts (checked in plain terms): cloud storage = servers in data centres run by companies (Google, Apple, Amazon, Microsoft); files are usually stored as more than one copy on different machines; data centres run many fans and use a lot of electricity for cooling.

LEO (curious) [CU]: Grandpa, where do my photos go when I upload them?
WALTER (warm) [MS]: [mg: flow PHONE > TOWER > CABLE > DATA CENTRE > FRIEND step=.8]To a building full of computers.
LEO (surprised) [CU]: A building? I thought they went to the cloud.
WALTER (amused) [MS]: The cloud is a building.
LEO (confused) [CU]: Not a real cloud?
WALTER (friendly) [MS]: No. Just a huge room of computers, with a lot of fans to keep them cool.
LEO (curious) [CU]: Whose computers?
WALTER (matter-of-fact) [MS]: A company's. [mg: tags GOOGLE, APPLE, AMAZON]Google, Apple, Amazon. You just rent a little space.
LEO (a bit shocked) [CU]: So my photos live in someone else's computer?
WALTER (reassuring) [2S]: Yes. And they keep spare copies. If one computer breaks, your photos are still safe.
LEO (impressed) [CU]: Like a spare key?
WALTER (pleased) [MS]: Exactly like a spare key.
LEO (thinking) [CU]: So that's why I can open them on any phone.
WALTER (warm) [MS]: Right. Your phone doesn't keep the photo. It just shows it to you.
LEO (grinning) [CU]: So the cloud is just... someone else's computer.
WALTER (proud) [MS]: Now you've got it.
LEO (worried, funny) [CU]: Does the building know I took forty selfies?
WALTER (dry, smiling) [MS]: [mg: counter 40 41 PHOTOS]Forty-one.

#end

Delivery notes (voice): both speak at a normal conversational pace. Leo is curious, then surprised, then playful. Walter is warm and friendly, smiling in the voice, with natural ups and downs. He is not sad and not flat. Only the last line is a little dry.
Seated: no actions at all; everything is said, nothing is done. Gestures (seated only): Walter's open palm on "a huge room", two fingers on "spare copies".

## PACING (user decision, 2026-11-10): the voice runs at 1.5x
- Final audio: `dialogue/fish/campfire_cloud_1p5x.wav` / `.mp3` = the voice time-stretched 1.5x (ffmpeg atempo, pitch preserved), 45.4 s with a 4 s tail. The ambience, pad and foley are mixed after the stretch at their normal speed.
- Voice track: `voice6.wav`; word times: `words6.json`. The unstretched 66 s version (`campfire_cloud.*`, `voice5.wav`, `words5.json`) is kept only for reference.
- Everything in the picture is timed to the 1.5x track: cuts, gestures, captions, MG. A line that is short on screen needs a quick beat, so expression changes are snappy and holds are 0.8-1.5 s.
- All future episodes: write the lines so they still read clearly at 1.5x (short sentences, one idea per line). One pass only per episode: render the voice once, no re-rolls.
