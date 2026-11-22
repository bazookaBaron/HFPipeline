# Voice casting report

Parler-TTS Mini v1.1 designs (text description + fixed seed) -> CosyVoice 3 instruct2 auditions.
Cosine = CosyVoice campplus.onnx speaker embedding. Cross-character threshold: >0.75 flagged.

## Options

| option | description | ref seed | ref dur | ref WER | audition WER (clean takes) | f0 median Hz | pitch std (st) | gen s/line |
|---|---|---|---|---|---|---|---|---|
| dadu_A | An elderly Indian man with a deep, warm, slightly gravelly voice, speaking slowly and gently, calm and kind, Indian English accent. | 1100 | 11.58 s | 0.04 | 0.00, 0.00 | 167 | 7.53 | nan |
| dadu_B | An old Indian man with a low, rough, raspy voice, speaking very slowly with a soft, tender, fatherly tone, Indian English accent. | 1111 | 11.71 s | 0.0 | 0.00, 0.00 | 133 | 4.72 | nan |
| dadu_C | An elderly Indian man with a mid-low, mellow, slightly breathy voice, speaking slowly and a little wistfully, warm and quiet, Indian English accent. | 1120 | 10.89 s | 0.0 | 0.00, 0.00 | 181 | 6.07 | nan |
| rohan_A | A young Indian man in his early twenties with a light, bright voice, speaking quickly and casually, slightly animated, Indian English accent. | 1200 | 13.29 s | 0.0 | 0.00, 0.00 | 192 | 7.99 | nan |
| rohan_B | A young Indian man with a mid-pitched, relaxed, slightly nasal voice, speaking fast in a casual, playful way, Indian English accent. | 1210 | 13.4 s | 0.0 | 0.09!, 0.00 | 219 | 6.54 | nan |
| rohan_C | A young Indian man with a higher-pitched, energetic, clear voice, speaking at a fast pace with a teasing, lively tone, Indian English accent. | 1220 | 15.52 s | 0.0 | 0.09!, 0.00 | 274 | 7.17 | nan |
| arjun_A | An Indian man in his early thirties with a mid-low, even, dry voice, speaking at a moderate pace in a flat, understated, calm tone, Indian English accent. | 1301 | 10.81 s | 0.0 | 0.00, 0.08! | 176 | 6.10 | 12.8 |
| arjun_B | An Indian man in his thirties with a low, smooth, slightly husky voice, speaking steadily and quietly, dry and unhurried, Indian English accent. | 1311 | 10.61 s | 0.0 | 0.00, 0.08! | 178 | 5.46 | 11.5 |
| arjun_C | An Indian man in his thirties with a mid-pitched, crisp, clear voice, speaking at a measured pace in a controlled, deadpan, professional tone, Indian English accent. | 1320 | 11.47 s | 0.0 | 0.00, 0.08! | 198 | 6.08 | 14.9 |
| meera_A | An Indian woman in her early thirties with a clear, warm, confident voice, speaking at a moderate-fast pace, sharp and direct, Indian English accent. | 1400 | 12.86 s | 0.029 | 0.00, 0.00 | 162 | 8.78 | 10.9 |
| meera_B | An Indian woman in her thirties with a low, rich, smooth voice, speaking at a steady pace, warm and assured, Indian English accent. | 1411 | 13.91 s | 0.057 | 0.00, 0.00 | 175 | 6.20 | 12.0 |
| meera_C | An Indian woman in her thirties with a bright, crisp, slightly higher voice, speaking quickly and expressively, friendly and clear, Indian English accent. | 1420 | 13.12 s | 0.029 | 0.00, 0.00 | 186 | 6.89 | 11.8 |

## Distinctness: Reference clips (Parler)

- within-character option pairs: mean 0.42, max 0.60
- cross-character pairs: mean 0.43, max 0.63
- most similar cross-character pairs:
  - dadu_B / meera_A: 0.63
  - dadu_A / arjun_C: 0.61
  - dadu_C / rohan_B: 0.61
  - dadu_A / rohan_B: 0.59
  - dadu_C / arjun_C: 0.57

## Distinctness: Audition renders (CosyVoice instruct2)

- within-character option pairs: mean 0.36, max 0.59
- cross-character pairs: mean 0.38, max 0.67
- most similar cross-character pairs:
  - dadu_A / arjun_C: 0.67
  - dadu_C / arjun_C: 0.63
  - arjun_B / meera_C: 0.59
  - dadu_C / rohan_B: 0.56
  - dadu_C / arjun_B: 0.51

## Per-line picks

- arjun_A line 0 [flat] seed 4000 wer 0.0 (1 rejected) dur 5.0s gen ?s: "Per my last email, we have 11 days of runway. I'm sure it's fine."
- arjun_A line 1 [worried] seed 4010 wer 0.077 (2 rejected) dur 6.2s gen 12.78s: "94% of the budget is gone. I'd call that front loaded."
- arjun_B line 0 [flat] seed 4000 wer 0.0 (2 rejected) dur 5.0s gen 10.59s: "Per my last email, we have 11 days of runway. I'm sure it's fine."
- arjun_B line 1 [worried] seed 4010 wer 0.077 (2 rejected) dur 6.2s gen 12.39s: "94% of the budget is gone. I'd call that front-loaded."
- arjun_C line 0 [flat] seed 4000 wer 0.0 (2 rejected) dur 5.0s gen 12.22s: "Per my last email, we have 11 days of runway. I'm sure it's fine."
- arjun_C line 1 [worried] seed 4010 wer 0.077 (2 rejected) dur 6.2s gen 17.65s: "94% of the budget is gone. I'd call that front loaded."
- dadu_A line 0 [warm] seed 4002 wer 0.0 (0 rejected) dur 10.0s gen ?s: "1971 The jute mill by the river was hiring a clerk. Shirt. Tie. A chair with wheels."
- dadu_A line 1 [warm] seed 4011 wer 0.0 (0 rejected) dur 6.1s gen ?s: "Keep showing up, and this time, learn the guard's name."
- dadu_B line 0 [warm] seed 4000 wer 0.0 (0 rejected) dur 9.3s gen ?s: "1971. The jute mill by the river was hiring a clerk. Shirt. Tie. A chair with wheels."
- dadu_B line 1 [warm] seed 4010 wer 0.0 (0 rejected) dur 5.0s gen ?s: "Keep showing up, and this time, learn the guard's name."
- dadu_C line 0 [warm] seed 4000 wer 0.0 (0 rejected) dur 9.3s gen ?s: "1971 The jute mill by the river was hiring a clerk. Shirt, tie, a chair with wheels."
- dadu_C line 1 [warm] seed 4010 wer 0.0 (0 rejected) dur 5.0s gen ?s: "Keep showing up and this time learn the guard's name."
- meera_A line 0 [curious] seed 4000 wer 0.0 (0 rejected) dur 3.2s gen 10.9s: "Okay, who actually asked him if he wants the promotion?"
- meera_A line 1 [amused] seed 4010 wer 0.0 (0 rejected) dur 3.4s gen 11.0s: "You've checked your phone four times. Just text her."
- meera_B line 0 [curious] seed 4000 wer 0.0 (0 rejected) dur 3.2s gen 11.38s: "Okay, who actually asked him if he wants the promotion?"
- meera_B line 1 [amused] seed 4011 wer 0.0 (0 rejected) dur 4.0s gen 12.58s: "You've checked your phone four times. Just text her."
- meera_C line 0 [curious] seed 4000 wer 0.0 (0 rejected) dur 3.2s gen 10.47s: "Okay, who actually asked him if he wants the promotion?"
- meera_C line 1 [amused] seed 4011 wer 0.0 (0 rejected) dur 4.0s gen 13.21s: "You've checked your phone four times. Just text her."
- rohan_A line 0 [flat] seed 4001 wer 0.0 (2 rejected) dur 4.4s gen ?s: "42 applications, 42, we'll keep your CV on file."
- rohan_A line 1 [laugh] seed 4011 wer 0.0 (0 rejected) dur 1.8s gen ?s: "You became the guard."
- rohan_B line 0 [flat] seed 4000 wer 0.091 (2 rejected) dur 4.0s gen ?s: "42 applications. 42 will keep your CV on file."
- rohan_B line 1 [laugh] seed 4010 wer 0.0 (0 rejected) dur 1.6s gen ?s: "You became the guard?"
- rohan_C line 0 [flat] seed 4000 wer 0.091 (2 rejected) dur 4.0s gen ?s: "42 applications. 42 will keep your CV on file."
- rohan_C line 1 [laugh] seed 4010 wer 0.0 (1 rejected) dur 1.6s gen ?s: "You became the guard?"

FLAGGED: none