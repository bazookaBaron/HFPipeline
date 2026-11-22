# DIALOGUE style guide (v1, 2026-11-09)

The show's look in one line: **a faceted low-poly world at night, lit by one warm
light, with calm "field notebook" motion graphics written in the same light.**

Everything here is a rule. The judge checks frames against this file, not against "looks
nice".

---

## 1. World look

- **Geometry:** faceted low-poly only, flat-shaded triangles you can see. The Quaternius
  Modular Men/Women cast and the Ultimate Nature props share this look. Smooth or realistic
  meshes (Poly Haven) are **banned** from sets because they break the style.
- **Shading:** flat normals, a 3-step toon ramp (shadow / mid / lit), and no specular
  except a soft rim. Materials are plain colours from the set palette, with no texture
  noise.
- **Light:** one motivated key per set (the fire, or the city glow), one cool fill or rim
  (moon or sky) and nothing else. Faces must read: the speaker's face always gets key
  light.
- **Atmosphere:** depth fog toward the set's sky colour, so the background falls off into
  3–4 value layers (fg / mid / bg / sky). Clear silhouettes beat detail.
- **Life (never a frozen frame):**
  - fire flicker (light intensity and colour, seeded noise)
  - embers rising slowly, at most 20 on screen
  - smoke drift
  - grass and leaves swaying, slow and low-amplitude
  - city windows switching on and off rarely
  - stars twinkling, subtle
  - everyone breathing
- **Post:** gentle bloom on light sources only, light film grain (2–3 %), a soft vignette,
  and depth of field only on medium shots. No chromatic aberration, no lens flares and no
  light leaks.

## 2. Colour

One master palette per set. The MG palette is derived from the set's palette, so a
graphic looks lit by the same scene.

**`campfire`** (warm, intimate)

| Role | Hex |
|---|---|
| sky / deepest bg | `#0E1621` |
| far trees | `#16242F` |
| mid ground | `#22343A` |
| fire key | `#F2A03D` |
| ember accent | `#D65F2A` |
| moon rim | `#8FA9BF` |
| warm highlight on skin | `#F6C98B` |

**`hilltop`** (cool, reflective)

| Role | Hex |
|---|---|
| sky top | `#111833` |
| sky horizon | `#2B2F55` |
| hill silhouette | `#1A2030` |
| city sodium lights | `#F3BF63` |
| city cool lights | `#86C6D8` |
| bench / skin key | `#E9B98A` |

**MG palette** (shared, accent swapped per set)

| Role | Hex |
|---|---|
| panel ink | `#121820` at 92 % |
| paper line / text | `#EFE6D4` |
| muted text and lines | `#8E9AA6` |
| accent | `#F2A03D` (campfire) or `#F3BF63` (hilltop) |
| second accent (data contrast only) | `#86C6D8` |

**Rules:**
- One accent per frame.
- No pure white (`#FFF`) and no pure black.
- No rainbow charts: data uses accent, paper line and muted only.
- No gradients on MG panels except the one soft vignette inside the panel.

## 3. Cast

All characters come from Quaternius **Ultimate Modular Men / Women** (CC0). Head, body,
legs and feet are separate meshes on one shared skeleton, so outfits are mixed, not built.

| id | Head | Body / legs / feet | Recolour |
|---|---|---|---|
| `dadu` | King_Head (white hair + beard; crown material hidden) | Farmer or Casual body | shawl-brown and cream; slight hunch |
| `rohan` | Casual_Hoodie head | Casual_Hoodie | hoodie re-tinted to deep teal |
| `arjun` | Suit head | Suit body, sleeves look | charcoal; tie removed or loosened |
| `meera` | from the Modular Women pack (to download) | blazer or casual top | muted rust |

- **Faces: a cartoon face layer** (user-approved 2026-11-09, an exception to the old
  no-faces-drawn-by-code rule, for this pipeline only). Expression is the USP.
  - **Mouth:** flat, faceted polygon shapes (5–10 vertices each, matching the low-poly look),
    applied as a decal on the face that follows the head bone, in a dark mouth tone with a
    lighter inner shape. The set:
    - visemes: `rest`, `small`, `A` (open), `O` (round), `E` (wide), `MBP` (closed press)
    - expressions: `smile`, `smile_open`, `laugh`, `frown`, `flat`
  - **Lip-sync:** words.json is turned into phonemes, then the viseme for the speaker only,
    at about 10–12 Hz, smoothed. The open amount follows the voice envelope.
  - **Eyelids:** skin-coloured lid polygons over the eye geometry. Upper lids handle blink,
    sleepy, sad and suspicious; lower lids push up for smile and squint.
  - **Brows:** the existing brow geometry is rotated and moved: inner-up = sad/worried,
    inner-down = firm/angry, both up = surprised, one up = doubt.
  - **Emotion presets** (each a blend of mouth + lids + brows + head):
    `neutral`, `warm`, `amused`, `laugh`, `sad`, `worried`, `surprised`, `thinking`, `firm`,
    `tender`. They blend over 0.25–0.5 s, with the brows leading by about 80 ms.
  - **Listener expressions** react to the speaker's line (for example, rohan `worried` while
    dadu is `heavy`).
  - **dadu:** the mouth sits under the moustache; the beard's lower part moves a little with
    jaw opening.
  - Blinks are seeded every 2.5–5 s and forced on big expression changes.
- **Colour per character is fixed for life.** Same character, same colours, every
  episode, so viewers recognise them.


> **Seated-stage rule (2026-11-10):** nobody stands, walks or handles props. Camera, hand gesture, close-ups and expression are derived from each script line's `(beat)` `[cam]` `[gesture]` tags. Full rule: `SCRIPT-VOICE.md` section 3b.

## 4. Acting grammar (body-led)

| Emotion tag | Speaker | Listener |
|---|---|---|
| `reflective` | eyes to the fire or the city, slow head turn, hands still | looks at the speaker, slow nod |
| `warm` | leans back, open palms, small head tilt | smiles with the body: shoulders drop, nods |
| `curious` | leans in, head forward | leans in, eyebrows up |
| `heavy` | looks down, shoulders forward, long breath | looks away, stillness, one slow look back |
| `amused` | small shoulder bounce, head back | the same, smaller |
| `firm` | upright, one hand gesture on the key word | eyebrows down, sits up |

- Gestures land on the stressed word (from words.json), never on a random beat.
- There are at most 2 gestures per line; the rest is breathing and looking.
- Base loops: `Sitting_Idle_Loop` and `Sitting_Talking_Loop` (Universal Animation
  Library, CC0), plus a procedural layer on top (look-at, nods, lean, breath).

## 5. Camera grammar

- **Shots per set:**
  - `wide2` (establishing two-shot)
  - `ms_A`, `ms_B`: medium, waist up
  - `ots_A`, `ots_B`: over the shoulder
  - `insert`: the fire, the city, hands, a cup
- **Cutting:**
  - cut on speaker change
  - minimum shot 2.5 s, typical 4–8 s
  - a reaction cut-in if a line runs past 7 s
- **Movement:** every shot moves: a slow push-in (2–4 % scale per 5 s), a drift or a small
  arc. Ease is sine.inOut. No whips, no shakes, no zoom snaps.
- **Close is the default** (user, 2026-11-09, from the reference reel). About 55 % of
  shots are MCU (head + chest fill about 60 % of frame height), about 35 % OTS and about
  10 % wide. Exact rigs are in PLAN.md §10d. No extreme close-ups.
- **Eyeline:** A is always screen-left and B screen-right, in both ratios (180° rule).

## 6. Motion graphics: the "field notebook" system

**Concept:** the MG is the story the speaker is telling, sketched on a dark notebook page
in lamplight. It never repeats the words verbatim. It adds the fact, the place, the number
or the picture.

**Panel:**
- an ink panel (`#121820` at 92 %) with a 1.5 px paper-line border and 10 px radius
- a faint paper grain inside
- a small label tag in the top-left: chapter or topic, small caps, muted

**Typography** (Google Fonts, OFL):

| Use | Font |
|---|---|
| headlines and quotes | **Geist** Medium (simple clean sans; user, 2026-11-09: no serif) |
| labels and body | **Geist** Regular, with tracked caps for tags |
| numbers and dates | **Geist Mono** Medium, tabular |

The type scale at 1080 px wide is 64 / 40 / 28 / 20. There are at most 12 words on any MG
card.

**Line art:**
- maps, arrows, diagrams and underlines are single-weight paper lines (2 px at 1080p)
- they draw on with stroke-dashoffset
- arrowheads are open chevrons
- accent fills only on the one thing that matters

**Motion:**

| Move | Duration | Ease |
|---|---|---|
| enter | 0.6–0.9 s | `power3.out` / `expo.out` |
| stagger | 80–120 ms | |
| line draw | 0.8–1.4 s | `power2.inOut` |
| hold (with a slow drift or push of 1–2 %) | at least 2.5 s | |
| exit | 0.4 s | `power2.in`, or hand-off to the next beat |

- **Banned:** bounce, elastic, spin, 3D card flips, typewriter-on-everything, glitch.
- The MG panel slides in or out with the layout change (1.0 s) and follows the motion
  doctrine's vector law: it enters from the side it will leave toward.

**Templates:** see PLAN.md §4.

**Images inside MG:**
- real archival or licensed photos (Wikimedia Commons PD/CC, licence logged), duotoned
  to ink + accent
- or our own 3D renders
- or Natural Earth maps
- or Lucide/Tabler icons (MIT/ISC) drawn in paper line
- **No AI-generated images in MG.** They are the fastest way to look like slop.

## 6b. Captions

Phrases of 2–6 words, Geist SemiBold in cream with a soft shadow, a 120 ms fade, no per-word
pop. Placement per layout is in PLAN.md §10e–f.

## 7. Sound

- **Voice:** CosyVoice 3 via VoiceStudio, one fixed reference voice per character, sitting
  a little dry and close. Dadu is slow and warm; Rohan younger, quicker; Arjun dry; Meera
  bright and sharp.
- **Room tone per set:** campfire = crackle + crickets + light wind; hilltop = wind + far
  city hum + a distant train once a minute. Always on, 18–24 dB under the voice.
- **Music (user, 2026-11-09: "smooth music like the KUZGET reference"):** one continuous,
  smooth ambient bed under the whole episode (the KUZGET reference analysis was deleted
  2026-11-13; these measured numbers are what remains of it):
  - pads and drones (90–180 Hz), soft plucked or mallet notes (400–900 Hz), a high sine
    shimmer and sub bass
  - a carved 0.8–2.5 kHz dip to leave room for the voices
  - it rides 7–9 dB under the voice and lifts 2–3 dB in pauses, with no hard sidechain
  - the chord may change on a cut; there is never silence
  - Procedural engine in `dialogue/fish/mix*.py` (originally from KUZGET `audio/sound.py` v1,
    user-approved, 0 tokens), with dialogue moods: `nostalgic`, `warm`, `heavy`, `hopeful`,
    `tense`. Slower than KUZGET (about 70–90 bpm), so it fits a deep conversation.
  - The mood comes from the script's emotion tags per section. A short lift at the ending.
  - Master at −14 LUFS, true peak −1 dBTP.
- **SFX:** none on cuts. MG gets at most a soft paper/pencil tick on line draws, at
  −30 dB. No whooshes.

## 8. Anti-slop rules (the judge checks every one)

1. No element without a job. Every particle, glow and graphic is motivated by the scene
   or the line.
2. No glow except from real light sources (fire, lanterns, windows).
3. No generic gradients, glassmorphism, neon, lens flares, light leaks or chromatic
   aberration.
4. No AI images. No stock-looking 3D icons. No emoji.
5. No MG that just repeats the spoken sentence. It adds a fact, place, number or picture.
6. No centred-everything layouts. MG follows a 12-column grid with a clear focal point.
7. No default fonts (Inter/Poppins/Montserrat) and no more than 3 font styles per frame.
8. No bouncy or elastic easing, no whoosh SFX, no constant zoom-pulse.
9. No frozen frames over 2 s: something always moves, but slowly.
10. No palette drift. Only hex values from §2, checked by a pixel-histogram gate.
11. Same character, same look, every episode. Seat positions and colours are fixed.
12. Text is always inside safe areas: 9:16 top 8 % and bottom 18 % kept clear for
    platform UI.

## 9. Frame layouts (from the user's sketch)

**9:16 (1080×1920)**
- `stack`: MG panel at y 6–44 %, the 3D scene at y 44–100 %. The 3D camera favours the
  speaker; it starts at the wide two-shot, then moves to the speaker's MS.
- `full`: 3D only.

**16:9 (1920×1080)**
- `full`: wide two-shot.
- `split`: MG centre panel, 56 % width. The left and right strips (22 % each) are live MS
  views of A and B. The listener's strip is dimmed 15 %.

**Hero frames** (approved before any pipeline code):
1. campfire `wide2` in 16:9
2. campfire `stack` 9:16 with a map MG
3. hilltop `split` 16:9 with a number MG
