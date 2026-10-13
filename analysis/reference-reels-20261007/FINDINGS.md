# Reference reels vs our narrator: what's different (2026-10-07)

Inputs: 5 reference reels from the user (`ReelAudio-2028/98086/22193/75019/91444.mp3`, 2:09–2:57 each) and our new-engine EKS vs ECS voice.
Method: `prosody.py`. Whisper large-v3 word timestamps + pYIN pitch + loudness per word. `refN.md` = annotated transcripts
(`[0.22]` = pause, CAPS = emphasised word, ↘ ↗ → = how the sentence ends). Pitch is in semitones (st) relative to the speaker's own median.

## Delivery (numbers)

| metric | refs (range) | ours | what it means |
|---|---|---|---|
| words / s overall | 3.2–3.6 | 3.2 | Pace is NOT the problem; refs are as fast or faster |
| sentence ENDS falling | 13–30 % | **58 %** | refs mostly end level (→), "carrying on"; ours drops like a full stop every line |
| sentence START pitch | −0.8…+1.2 st (ref4 −5) | **+4.4 st** (single lines +8…+11) | ours restarts high on every sentence: "reset and drop" read-aloud sing-song |
| pitch range p10–p90 | 4.4–7.3 st (ref4 10) | **13.4 st** | ours swings wildly and randomly |
| loudness variation (SD) | 1.4–2.2 dB | **1.2 dB** | refs punch key words; ours is flat in volume, swingy in pitch |
| pauses INSIDE a sentence | 0.15–0.5 per sentence | **0.07** | refs breathe at commas and list items (0.15–0.45 s); ours runs through |
| emphasised words | 0.6–1.8 per sentence, on the contrast word | 1.6, on random words ("BOTH DO", "THEY RUN YOUR APP'S") | F5 doesn't know which word matters |
| gap between sentences | ~0.2 s | 0.21 s | fine |

Root causes in our generator:
1. **Every script line is synthesised on its own**, so each line is a separate "utterance": high start, full falling cadence. The refs sound like one continuous person talking.
2. **The voice clone copies the reference clip's delivery.** Our 9 s reference is calm documentary storytelling ("Doctors claimed it could cure everything…"), the wrong register for explainers.
3. **Take selection only checks the words** (Whisper WER), never the delivery.
4. **Script punctuation**: we end almost every thought with a full stop; the refs lean on commas, lists, questions and fragments, which is what produces level endings and mid-sentence breaths.

## Script (patterns in all 5)

1. **Title opener, then tension inside 3 s.** "OSI model explained." → "This is Lina. She's about to send a photo…"; "What is Jev? And why is everyone suddenly talking about it?"; "CICD explained, are you still uploading code to production by hand…"
2. **A tiny story or scene with a person** (Lina and her cat photo, five developers, a customer who was "charged twice").
3. **Signposting with spoken labels**: "Let's walk through it." "Let's break that down." "Step 1. Data." "Layer 7. Application." "Now comes CD." "Now, the first key concept. Tokens."
4. **Contrast and parallel triplets**: "It doesn't write essays. It doesn't write code. It's built to make decisions." "It cannot open… It cannot search… It cannot run…"
5. **Rhetorical question runs**: "Does it compile? Do the tests pass? Did somebody break the build?"
6. **Inner voice / quotes**: "The app says, I need to send this photo." "The model might decide, I need to inspect these files first."
7. **Comma lists of concrete things**: "books, webpages, code, articles, forums".
8. **Real terms used confidently, defined on the spot**: "smaller pieces called tokens", "Engineers call this the OSI model."
9. **Sentence length mix**: 1–2-word labels, 5–8-word punches, a 15–25-word list sentence; average 6–10 words.
10. **Ending**: a two-beat memorable line ("LLMs generate. Jev decides.") + one forward-looking big claim.
11. **Length**: 430–570 words, 2:10–3:00. Much longer than our < 1 min reels.
