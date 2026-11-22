# World sets: research + plan (2026-11-12)

Goal: higher-quality, VARIED sets per script (cities, people, vehicles, weather,
jungles, deserts) with no per-video world building, same token cost as dialogue,
free, commercial YouTube OK, on this laptop (RTX 4050 6 GB, 16 GB RAM, 108 GB free).

Nothing below is tested yet. "unverified" = secondary source only.

## 1. What exists (ranked for our requirement)

| Route | Variety | People/cars | Weather | Free + YouTube OK | Runs here | Verdict |
|---|---|---|---|---|---|---|
| **UE5 + free Epic worlds** (Project Titan 8x8 km open world, City Sample, Electric Dreams jungle, Megascans, MetaHumans, Game Animation Sample) | Highest: city, jungle, open-world biomes | Yes (MetaHumans, City Sample crowds/traffic) | Yes | Yes: rendered linear video is royalty-free under Epic content licence; Megascans reported free again from 2026-11-05 (unverified) | **Below spec**: City Sample asks 8 GB VRAM / 64 GB RAM; disk tight | Only option that is "a world with everything". Hardware is the blocker. |
| **AI 2.5D sets**: Z-Image Turbo (Apache, ~4.5 GB GGUF) → MoGe-2 depth (MIT) → layered depth mesh in three.js | Unlimited, a new set from every script | Our characters composited with real depth occlusion | Painted into the image + three.js rain/fog | Yes (licences above, recheck exact checkpoints) | Yes, ~30-60 s per image | Fits machine + tokens. Camera limited to push-in, ±8° orbit, pan. Painted set vs low-poly cast may clash. |
| CARLA 0.9.16 | Cities only (≈12 towns) | Yes (stiff) | Yes, full API | MIT code, CC-BY assets | Low-quality mode on 6 GB | Fallback for city/traffic, no nature. |
| Google Earth Studio | Whole real planet | No | No | Yes with visible Google attribution, not promo | Yes (cloud) | Establishing aerials of real places only. |
| Kit assembler (CC0 Quaternius/KayKit/Kenney + biome grammars) | Medium | Yes | Yes | Yes | Yes | Rejected direction (still low-poly, grammar overfit risk). Keep as fallback. |

Ruled out:
- **HY-World 1/2, Voyager, WorldPlay (Tencent licence family):** outputs may not be displayed outside the licensed territory, which excludes the EU, UK and South Korea. A public YouTube video breaks that.
- **Apple SHARP and Depth Pro:** research-only weights.
- **NVIDIA Lyra 2:** internal R&D licence.
- **Marble:** paid.
- **Cesium + Google 3D Tiles:** only promotional clips of 30 s or less.
- **Video world models (Wan, Matrix-Game):** set drift, no true occlusion, not deterministic.
- **Roblox, Blender.**

## 2. Recommendation

Two candidates, decided by a measured test, not by opinion:

- **A. UE5 "world library"** (best quality, matches the ask). The LLM never builds anything. It picks
  from a one-time **location atlas**: named camera spots across the free levels (Titan biomes,
  City Sample streets, Electric Dreams jungle). Per scene the spec is about 60 tokens:
  `{level, spot, time, weather, cast:[metahuman ids], action clips, camera move}`.
  A Python script turns that into a Sequencer shot, and Movie Render Queue renders it.
  Variety comes from many spots × time × weather, not from building.
- **B. AI 2.5D sets** (runs here for sure, unlimited variety, smaller camera moves).

## 3. Plan

**Phase 0: two cheap tests, in parallel (needs your OK for downloads)**
- **T1, UE5 hardware probe.** Install UE 5.x (~40-60 GB) plus Project Titan only.
  - Open Titan at Medium scalability and record peak VRAM, RAM and shader-compile time.
  - Render one 5 s MRQ camera move at 1080p and time it.
  - **Pass:** no out-of-memory crash, and a render of 5 min or less per 5 s.
  - If it fails, UE5 is out on this laptop. A paid cloud GPU would be your call.
- **T2, 2.5D spike.** Take one existing dialogue scene: Z-Image set, MoGe-2 depth, three.js layered mesh,
  a Quaternius character on the ground plane, a push-in and a small orbit.
  - Score it against the dialogue baseline (≥8/10).

**Phase 1: build the winner once**
- **If A wins:**
  - Location atlas (spots with tags: biome, mood, time-ok, crowd-ok).
  - Python shot builder (spec → Sequencer → MRQ).
  - Character + animation map (MetaHumans + Game Animation Sample).
  - Weather/time presets.
  - Hook render jobs into jobq.
- **If B wins:**
  - Set generator (prompt suffix + palette LUT, a style LoRA later).
  - Depth-layer + inpaint step.
  - Splat/mesh loader in dialogue/engine.
  - Toon/LUT pass so characters sit in the set.

**Phase 2: one full episode end to end**, measuring tokens and time against dialogue.

## 4. Risks
- **UE5:** 16 GB RAM and 6 GB VRAM are officially below spec. 108 GB of disk fits only the engine plus 1-2 levels.
  Photoreal MetaHumans change the channel look (not our colourful style).
  The Fab Standard licence clause for entities earning over $100k a year is unverified.
- **2.5D:** limited camera travel (long journeys become several sets joined by cuts or dissolves), painted vs
  low-poly style clash, and AI-image slop risk.
- **Both:** re-check every licence on the exact checkpoint or listing before use.

## Sources (key)
- Project Titan: https://www.unrealengine.com/en-US/news/the-project-titan-sample-game-is-now-available-explore-this-huge-open-world
- Epic content licence (rendered linear media): https://www.unrealengine.com/eula/content
- City Sample specs: https://dev.epicgames.com/documentation/unreal-engine/city-sample-project-unreal-engine-demonstration
- MRQ command line: https://dev.epicgames.com/documentation/unreal-engine/using-command-line-rendering-with-move-render-queue-in-unreal-engine
- Megascans free (2026-11): https://www.cgchannel.com/?p=179945
- MetaHuman licence: https://www.metahuman.com/license
- CARLA: https://carla.readthedocs.io/en/0.9.16/start_quickstart/
- Earth Studio attribution: https://earth.google.com/studio/docs/attribution/
- Google 3D Tiles policies: https://developers.google.com/maps/documentation/tile/policies
- HY-World 2.0 licence: https://raw.githubusercontent.com/Tencent-Hunyuan/HY-World-2.0/main/License.txt
- SHARP model licence: https://raw.githubusercontent.com/apple/ml-sharp/main/LICENSE_MODEL
- MoGe: https://github.com/microsoft/moge
- Z-Image Turbo GGUF: https://huggingface.co/jayn7/Z-Image-Turbo-GGUF
- Spark splats: https://github.com/sparkjsdev/spark
