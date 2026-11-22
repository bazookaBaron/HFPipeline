# "It works with a hot dog" (campfire, Leo + Walter, ~55 s final, voice at 1.3x)

Premise: Leo's phone ignores his gloves but answered a hot dog, and he cannot let it go. Walter, his grandfather, walks him through touchscreens in plain words. Both stay seated by the fire the whole time. The phone, the gloves and the hot dog exist only in words and in the MG.
Payload: under the glass is an invisible grid of rows and columns; the phone puts a tiny charge on every crossing and checks it over a hundred times a second; a finger (salty water, conductive) steals a little charge from the crossings under it and the phone finds the dip; a finger covers a few crossings, the phone takes the middle; it never feels pressure; wool doesn't conduct, so a glove is invisible; a hot dog is salty water too.
Human question: "Does my phone feel me?" Turn: it doesn't feel the press at all, it feels the water in you. Landing: the hot dog stylus has a short life.
Running line: the hot dog (L1, L2, L3, L4, L17, L20 by implication).

LEO (curious) [CU]: Grandpa, my screen ignores my gloves. But it works with a hot dog.
WALTER (amused) [MS]: Because the hot dog is more like you than the glove is.
LEO (surprised) [OTS]: I'm a hot dog?
WALTER (matter-of-fact) [MS]: Mostly salty water. So is a hot dog. Salty water carries electricity.
LEO (curious) [OTS]: The screen is electric?
WALTER (warm) [MS]: Under the glass, invisible wires. Rows one way, columns the other.
LEO (thinking) [OTS]: Like graph paper.
WALTER (pleased) [MS]: Hundreds of crossings. The phone charges each one and checks it, over a hundred times a second.
LEO (curious) [OTS]: And my finger?
WALTER (firm, light) [MS]: It steals a little charge from the crossings under it. The phone sees the dip. That's you.
LEO (confused) [OTS]: But my finger's bigger than one crossing.
WALTER (warm) [2S]: So it covers a few, and the phone picks the middle.
LEO (shocked) [CU]: Wait. So it never feels me pressing?
WALTER (matter-of-fact) [MS]: Not at all. It feels the water in you.
LEO (curious) [OTS]: And my gloves?
WALTER (firm, light) [MS]: Wool doesn't carry charge. To the phone, a glove is nobody.
LEO (grinning) [CU]: So in winter, I text with a hot dog.
WALTER (amused) [MS]: People in Korea did, one cold winter.
LEO (grinning) [OTS]: Genius.
WALTER (dry, flat) [CU]: Until lunch.

#end

Delivery notes (voice): normal conversational pace (the track is sped up 1.3x after, pitch kept). Leo: curious, surprised, playful; L13 is the turn ("Wait."), a grin on L17/L19. Walter: warm, smiling in the voice, falls to a low finish; only the last line is dry and flat, after a beat.
Seated: no actions at all. Nobody takes out a phone or a hot dog; the phone, the grid, the finger, the gloves and the hot dog are words + MG only.

<!-- Sources (plain terms)
- Phones use projected-capacitive (mutual-capacitance) touch: transparent ITO electrodes in rows (drive) and columns (sense) under the cover glass; the controller drives each row and measures the coupling at every row/column crossing: Microchip AN "Mutual capacitance touch sensing" (AN3046 / mTouch docs); Texas Instruments "Capacitive touch sensing" (SLAA576); Walker, "Fundamentals of Projected-Capacitive Touch Technology", SID Display Week short course 2014.
- A typical phone panel has a few hundred crossings (about 15 x 30 electrodes at ~4-5 mm pitch): Walker 2014.
- Touch sampling ("report") rate is 120-240 Hz on current phones (60 Hz minimum on older ones): manufacturer spec sheets (e.g. Samsung Galaxy S-series 240 Hz, iPhone 120 Hz touch sampling).
- A conductive, grounded finger diverts part of the field between a row and a column, so the measured coupling at nearby crossings drops; the controller finds the dip and computes the centroid across several crossings, which gives a position finer than the electrode pitch: Walker 2014; TI SLAA576.
- The human body is ~60 % water with dissolved salts (electrolytes), so it conducts: USGS "The Water in You"; standard physiology.
- Capacitive screens do not sense pressure (the separate 3D Touch pressure layer on 2015-2018 iPhones is a different sensor; caveat kept out of the dialogue): Apple 3D Touch docs; Walker 2014.
- Ordinary wool/cotton gloves insulate the finger, so no coupling change; touchscreen gloves sew in conductive thread: Walker 2014; glove makers' product notes.
- A moist, salty sausage conducts like a finger. Winter 2010: press reports of people in South Korea using snack sausages as iPhone styluses in the cold: NBC Bay Area "Sausage Stylus a Meaty Must-Have" (2010), citing Korean reports. The reported ~40 % sales jump is secondhand, so it is NOT in the dialogue.
-->
