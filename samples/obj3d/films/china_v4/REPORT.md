# China v4: report (2026-11-15)

From the producer's hand-back, plus my own check of the end cards, thumbnail and loudness.

## Files (samples/obj3d/out)
| File | Length | Loudness |
|---|---|---|
| china_v4_169_final.mp4 | 510.1 s | -13.96 LUFS / -1.34 dBTP |
| china_v4_169_final_partition.mp4 | 510.9 s | -13.9 / -1.3 |
| china_v4_169_final_powder.mp4 | 511.8 s | -13.9 / -1.6 |

- Thumbnail: china_v4_thumb.jpg ("200M COPY PHONES, 2010" / "THE COPY SHOP" / "NOW FORD LICENSES ITS TECH"), made by make_thumb.py from the frame at 486.6 s. Channel-neutral.
- credits.txt lists the 43 cards shown (use it for the YT description); credits_all.txt lists all 48.

## Script and voice
- Header lines 1-47 match films/china/script.md apart from the title line. No spoken line was changed.
- Fish s2.1-pro: 10,204 bytes, plus 954 for rerolls. 1,577 words at 220 wpm.
- Lines still flagged by ASR after a reroll, built with --force: L7 "Huaqiangbei", L75 "traitor" (heard as "trader"), L82 "ladder" (heard as "latter"). They likely sound right, but nobody has checked them by ear.
- Powder Keg end line uses the script writer's fallback form: "...It's called Powder Keg." It passed the large-v3 name check.

## Photos
- 48 sourced (46 licensed or public domain, 2 documents retyped word for word). 43 cards on screen, about 5.1 a minute. Every one has a contentCheck, and none reuses an nvidia_v4 file.
- 7 entities have no card (listed in photos_missing.txt): the Austrian court, Fujian Jinhua, the IP Commission report cover, DeepSeek, Anthropic, Ford's Marshall battery plant, and the Merchandise Marks Act 1887. The producer held off on credited news photos because its brief covered licensed images only.
- Ford's card sits on L86, because at L4 it covered the focus. The CR400 card is one line early.

## Plan and engine
- 87 lines on 53 new sets, with no reuse. Room and street scenes take 85% of world time. 14 world sound cues, no filler.
- Engine additions:
  - sets/furniture.js: a "phones" goods option for market stalls.
  - film.html: an optional `callout2` / `callout2T` second callout.
  - audio/mix.py: a `MIX_TP` env setting (default -1; run at -2.0, because the AAC encode overshoots).

## Gates (none loosened)
- These all pass:
  - the v3 shots gates (speed and keys, variety, mgCheck and text fit, roomShare, eventGap, the sound gates, focusHold, photos);
  - photocheck;
  - the lines gate (87/87);
  - keycheck.
- kindgate: 28 of 29 cases pass. The one fail is the shared dominoes example, not this film.
- The two channel splices have an overlap PSNR of 47 or more.

## Weak spots
1. MG is only about 15% of runtime, against about 35% before. Number beats failed the kind-fill and event-gap gates, so they became world shots with callout labels: the IP estimate, BYD vs Tesla and the $590 bn day are shown as labels, not charts.
2. Train exteriors (L42/44/48/50) are sparse.
3. The cars in the showroom, plant and EV hall look blocky.
4. The chapter 1 title board is partly hidden by a tree and lamp.
5. Some street figures are small (L13, L82).
6. The wide exteriors of Michigan and Shanghai show the red focus on mostly empty ground.
7. The "about 150,000" figure on L60 is not in the fact block (it came that way from the fact-checked script).

## Time
Started 13:20, finished 19:15, so about 6 h. Roughly 2 h 15 min of that was queue waits behind the Trump voice and render.
