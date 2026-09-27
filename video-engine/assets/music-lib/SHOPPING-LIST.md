# Music shopping list (~40 tracks + ~10 SFX, all free)

Put each download in `video-engine/assets/music-lib/<mood>/` and add a licence note right away
(see [README.md](README.md): a `<file>.license.json` sidecar or a row in `LICENSES.md`). Then run
`python orchestrator/tools/music_index.py`. A track without a licence note is never used.

**General rules**
- Prefer tracks that are **2–4 minutes long** and have a **steady body**: no long silent intro, no big
  fade-outs in the middle, no vocals. The pipeline loops at phrase boundaries, so long builds are fine
  but a 20 s ambient intro wastes the section.
- Aim for **different keys and tempos within a mood**: the video switches tracks every ~40–60 s, so
  variety matters more than having the perfect track.
- **Target per mood** is given as BPM / energy (1 = barely there, 5 = driving). The indexer measures
  these; `"energy": N` in the note overrides it if you disagree.
- Order of preference for YouTube safety: **YouTube Audio Library → incompetech → Pixabay**
  (Pixabay tracks occasionally get Content ID claims; the licence note with the page URL lets you
  dispute them).

## Where and how to search

**YouTube Audio Library**: YouTube Studio → *Audio library* (left menu) → *Music* tab. Use the filter
bar: **Genre**, **Mood**, **Duration** (set ≥ 2:00), and **License type → "Attribution not required"**
(this saves you the credit line; tracks marked "Attribution required" are fine too but copy their
credit text exactly). Click the download arrow. Source = `YouTube Audio Library`, url = leave empty or
paste the track title, license = `YouTube Audio Library`.

**Pixabay Music**: pixabay.com/music → search box, then the left filters **Genre**, **Mood**,
**Duration** (> 2 min). Download (free account). Source = `Pixabay`, url = the track page URL,
license = `Pixabay Content License`, credit optional (e.g. `Music: "Title" by Artist (Pixabay)`).

**incompetech (Kevin MacLeod)**: incompetech.com → *Royalty Free Music* → *Full list* or the genre /
"feel" search. License = `CC BY 4.0`; the credit is **required**. Paste exactly (fill the title):

```
"<Title>" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/
```

(As one line in the `credit` field is fine.) The named incompetech tracks below are well-known catalogue
titles; if one isn't there any more, use the search terms instead.

---

## 1. tension / investigative: 8 tracks → `tension/` (5) and `investigative/` (3)

The workhorse: most body chapters. Pulsing, unresolved, not horror. 85–110 BPM, energy 3–4.

| # | Source | What to get |
|---|---|---|
| 1 | YouTube AL | Genre **Cinematic**, Mood **Dark** → pick 2 with a steady pulse (ticking synths, low strings) |
| 2 | YouTube AL | Genre **Ambient** or **Electronic**, Mood **Dramatic** → 1 with a sequenced bass line |
| 3 | incompetech | **"Hitman"** (tension) |
| 4 | incompetech | **"Volatile Reaction"** (tension, high energy) |
| 5 | Pixabay | search `suspense documentary`, Mood *Suspenseful* → 1 |
| 6 | incompetech | **"Investigations"** → `investigative/` |
| 7 | incompetech | **"Deliberate Thought"** → `investigative/` |
| 8 | Pixabay | search `investigation background pulse` or `true crime documentary` → `investigative/` |

## 2. dread / collapse: 5 tracks → `dread/`

For the crash, the default, the bankruptcy moment. Slow, heavy, drones and low piano. 60–85 BPM
(or beatless), energy 2–3.

| # | Source | What to get |
|---|---|---|
| 1 | YouTube AL | Genre **Cinematic**, Mood **Sad** or **Dark**, slowest you can find → 2 |
| 2 | incompetech | **"Darkest Child"** |
| 3 | incompetech | **"Long Note Four"** (drone) |
| 4 | Pixabay | search `dark drone cinematic` or `dramatic tension piano`, Mood *Sad* → 1 |

## 3. hopeful / resolution: 5 tracks → `hopeful/`

Recaps and "what happens next". Warm piano/strings, gentle pulse, no big anthem. 70–100 BPM, energy 2–3.

| # | Source | What to get |
|---|---|---|
| 1 | YouTube AL | Genre **Cinematic** or **Ambient**, Mood **Inspirational** → 2 (skip ones with a big drum climax) |
| 2 | incompetech | **"Inspired"** |
| 3 | Pixabay | search `hopeful piano documentary` → 1 |
| 4 | Pixabay | search `uplifting ambient corporate` (calm ones only) → 1 |

## 4. playful: 4 tracks → `playful/`

For joke beats and light chapters. Pizzicato, marimba, quirky. 95–125 BPM, energy 2–3. Nothing silly-cartoon.

| # | Source | What to get |
|---|---|---|
| 1 | YouTube AL | Genre **Children's** is too much; use Genre **Pop** or **Jazz & Blues**, Mood **Funny** / **Happy** → 2 |
| 2 | incompetech | **"Sneaky Snitch"** (sneaky pizzicato) |
| 3 | incompetech | **"Fluffing a Duck"** or **"Monkeys Spinning Monkeys"** (use sparingly: very recognisable) |

## 5. calm explainer: 8 tracks → `calm/`

Neutral beds for data-heavy stretches: soft lo-fi / minimal electronic / light piano. 70–100 BPM,
energy 1–3. These carry the most minutes, so get variety.

| # | Source | What to get |
|---|---|---|
| 1 | YouTube AL | Genre **Ambient**, Mood **Calm** → 2 |
| 2 | YouTube AL | Genre **Hip Hop & Rap**, Mood **Calm** (lo-fi beats without vocals) → 2 |
| 3 | incompetech | **"Wallpaper"** |
| 4 | incompetech | **"Airport Lounge"** |
| 5 | Pixabay | search `lofi documentary background` → 1 |
| 6 | Pixabay | search `minimal technology background` or `soft corporate ambient` → 1 |

## 6. trailer / montage: 6 tracks → `trailer/`

For the 25–35 s cold-open montage: cuts snap to the beat grid. **95–125 BPM, heavy low end (kick,
sub, braams), clear 4/4, strong hits.** Energy 4–5. The indexer marks `montageOk` when the tempo and low end
qualify.

| # | Source | What to get |
|---|---|---|
| 1 | YouTube AL | Genre **Cinematic**, Mood **Angry** or **Dramatic**, look for "trailer" / "epic" in titles → 2 |
| 2 | YouTube AL | Genre **Electronic**, Mood **Dramatic**, 100–125 BPM with a hard kick → 1 |
| 3 | incompetech | **"Impact Prelude"** or **"Clash Defiant"** |
| 4 | Pixabay | search `epic trailer percussion` or `cinematic hybrid trailer`, Mood *Epic* → 1 |
| 5 | Pixabay | search `documentary trailer hip hop beat` (no vocals) → 1 |

(Optional `triumphant/`: 1–2 tracks for a comeback ending. YouTube AL Genre **Cinematic**, Mood
**Bright** / **Inspirational** with drums; incompetech **"Heroic Age"**.)

## 7. SFX: ~10 files → `sfx/` (subfolders `impacts/`, `risers/`, `whooshes/`, `sub-drops/`)

Short, clean, no tails longer than ~3 s.

| # | Source | What to get |
|---|---|---|
| 1–3 | Pixabay *Sound Effects* (pixabay.com/sound-effects) | search `cinematic impact` / `boom hit` → 3 → `sfx/impacts/` |
| 4–5 | Pixabay SFX | search `riser` / `tension riser` (2–6 s) → 2 → `sfx/risers/` |
| 6–8 | Pixabay SFX | search `whoosh transition` → 3 short ones → `sfx/whooshes/` |
| 9–10 | Pixabay SFX | search `sub drop` / `bass drop cinematic` → 2 → `sfx/sub-drops/` |

YouTube Studio's Audio library also has a **Sound effects** tab (Category *Impacts*, *Transitions*)
if you want them from there instead.

---

## Licence note checklist (per track)

- [ ] File in the right mood folder
- [ ] `<file>.license.json` (or a `LICENSES.md` row) with `title`, `artist`, `source`, `url`, `license`
- [ ] `credit` pasted exactly as the site gives it (required for incompetech / "Attribution required")
- [ ] Optional `"energy": 1–5` if the track's feel differs from its tempo
- [ ] `python orchestrator/tools/music_index.py` → check the summary: `unlicensed` should be 0
