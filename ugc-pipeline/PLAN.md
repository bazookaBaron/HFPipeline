# UGC pipeline: lean plan, 30 reels for under $10

Written 2026-11-24. New and separate from `HFPipeline`. Nothing has been rented or run on a GPU. GPU offers change hourly.
**Status:** built and tested on fake servers (187 tests). See README.md for use. This file is the original plan; where they differ, README.md and config.toml win.
Target: 30 reels x 40 s, 9:16, one batch a month, **hard cap $9.50** including the pilot.

## Purpose: confirmed

Owner, 2026-11-24: experimenting, non-commercial, **no training of any model** on the outputs. That fits H3 licence V.3. If it ever changes to training
another model, stop using H3 outputs for it. Quality comes first inside the cap: at the interruptible rate the tutorial's full 1.5 MP setting projects to
about $8 all-in, so the planner tries tiers from best to cheapest (`config.toml`).

Still applies: no excluded countries, no fake reviews, a clear AI label on anything public.

## Which machine

"Highest compute" and "cheapest" were checked together, by cost per unit of work (Vast's own performance score), permitted countries only.

| Offer on 2026-11-24 | Rate | Score | $ per 1,000 score-hours |
|---|---|---|---|
| **1x RTX 5090D, Japan, 64 GB RAM, 933 Mbps** | **$0.522/h** | **197** | **2.65** |
| Same machine, interruptible (minimum bid) | $0.307/h | 197 | 1.56 |
| 1x RTX PRO 5000, China, 256 GB RAM | $0.514/h | 189 | 2.73 |
| 1x RTX 4090, China | $0.476/h | 126 | 3.78 |
| 2x RTX 4090, China | $0.942/h | 123 each | 3.82 |
| 4x RTX 3090, Canada | $0.694/h | 41 each | 4.28 |
| 1x A100 PCIE, China | $0.369/h | 56 | 6.53 |
| 1x L40S, Taiwan | $0.735/h | 94 | 7.86 |

The strongest single GPU listed is also the cheapest per unit of work. No H100, H200, B200 or RTX PRO 6000 was listed in a permitted country.
A bigger multi-GPU box finishes sooner but costs the same or more per reel. The score is generic, not an H3 benchmark.
Interruptible A100s looked cheaper ($1.50) but the same card scored anywhere from 46 to 95, so do not rely on it.

## Lean recipe

| Choice | Setting | Why |
|---|---|---|
| Size | 0.7 MP, 640x1152, upscaled to 1080x1920 on the Mac | The video says 0.7 MP is up to 2x faster than 1.5 MP |
| Steps | 10, turbo LoRA | The video's setting |
| Clip | 243 frames (10.1 s) | H3 frame rule |
| Per reel | 3 AI clips + about 10 s of real footage (screen recording or b-roll) | 25% fewer GPU minutes |
| Takes | 1 each, then retry **only failures**, at most 3 | Beats a fixed 2 takes |
| References | One character sheet, one voice clip | A second image can triple the time |
| Everything else | Scripts, voice, checks, captions, edit, upscale on the Mac | No GPU cost |

## Budget (RTX 5090D, on-demand)

Fixed: pilot session $1.26 (1 h work, 24 min setup, download). Main session: 24 min setup and 45 GB download, about $0.74.

| Plan | Takes | At 205 s a take | At 274 s a take | At 411 s a take |
|---|---|---|---|---|
| **Recommended: 3 clips, about 1.6 takes** | 144 | **$6.28** | **$7.72** | $10.58 |
| 4 clips, about 1.6 takes | 192 | $7.71 | $9.63 | $13.44 |
| 4 clips, 2 takes | 240 | $9.13 | $11.53 | $16.30 |
| Recommended, interruptible, +20% lost work | 144 | $4.93 | $5.95 | $7.97 |

All-in, pilot included. 205 s is the video's best case for 0.7 MP, 274 s assumes 1.5x faster than 1.5 MP, 411 s means no speed-up at all.
Running time for the recommended plan: about 9 to 11 hours.

**Break-even:** at 144 takes the plan stays under $9.50 while a take costs at most **359 s**. The pilot measures this before the batch starts.

## Guards that keep it under $10

1. Pilot first, as its own short session: 8 to 10 takes. No batch unless the measured rate projects to $9.50 or less and you approve the clips.
2. If it projects higher, step down in order: 4 steps, 0.5 MP, interruptible, fewer takes. Never raise the cap automatically.
3. The launcher refuses offers above a set price, in excluded countries, under 60 GB RAM, or below 98% uptime unless you accept it. **The 5090D shows 97.2%.**
4. Destroy the machine on: queue empty, 10 minutes idle, spend at cap, or lost contact. A second check on the Mac confirms it is gone.
5. Takes copy to the Mac as they finish; every job has a key, so a lost machine never repeats finished work.
6. A preloaded account balance of $10 is the last backstop.

## Who builds it

Opus orchestrates: writes the shared formats, reviews each part, runs the full test. Sonnet builds, one owner per folder.

| Builder | Folder | Delivers | Tested against |
|---|---|---|---|
| 1 | `compute/` | Vast search, launch, spend cap, destroy | Fake Vast API |
| 2 | `generate/` | H3 Ref2VA workflow, queue, resume, retries | Fake ComfyUI |
| 3 | `script/` + `checks/` | 30-reel planner, prompts, speech, face and loudness checks | Local clips |
| 4 | `edit/` | Captions, cutaways, AI label, upscale, 9:16 export | Local clips |

Key: `ugc-pipeline/.env` (git-ignored), variable `VAST_API_KEY`, filled in by the owner. Renting always asks first, showing price and maximum spend.

## Risks

- One video is the only timing source. No one has published H3 timings on a 5090D.
- The strongest offer is a single machine; if it goes, the RTX PRO 5000 is next (China; confirm model downloads work from there).
- At 0.7 MP, faces in wide shots are soft. Keep shots close.
- A 10 h batch repeats any mistake 30 times. The pilot must cover every prompt template.
