# Prompt for a new chat: 1-minute DIALOGUE video that explains a tech topic

Paste everything below the line into a fresh Claude Code session in `C:\Repos\HFPipleine`.

---

You are working in C:\Repos\HFPipleine (branch v3/world-pipeline) on the **DIALOGUE** pipeline: two low-poly 3D characters
sitting and talking in a night set, with "field notebook" motion graphics. Make a **60-second episode that explains
one tech topic**. TOPIC: `<<< the user will fill in, or pick one yourself that a beginner has wondered about: e.g. "what is an API", "why is my app slow", "what is a cache", "what is the cloud", "what is a token in AI" >>>`

## Read first, in order (keep the main thread lean; do not paste file dumps back to me)
1. `dialogue/SCRIPT-VOICE.md` (script + voice rules, **section 3b the Seated-Stage Rule is mandatory**, section 4 craft rules)
2. `dialogue/ref/voice_study/FINDINGS.md` (how the two reference videos script and speak)
3. `dialogue/ref/voice_study/A.transcript.txt` and `B.transcript.txt` (A = the "Claude, is the server okay" sketch, B = "what's valuable now" explainer, the topic-teaching one: copy B's structure)
4. `dialogue/samples/campfire_guard.md` (the quality bar the user approved) and `dialogue/fish/` (the Kevin sketch: working script, mix and analysis code)
5. `dialogue/STYLE-GUIDE.md` sections 4-5 (acting + camera)

## The script (write this first; I read it before any voice is made)
- Length: **150-170 words, about 22-28 turns, 55-65 s** at 160 wpm. A small number of long turns is allowed for the advisor only (like ref B).
- Two characters, **always seated for the whole video**:
  - **Leo (young)**: the viewer's proxy. Panicky / curious / a bit wrong. Speaks 1-15 words per turn. Never explains. Every Leo line is a question, an echo-question, a wrong conclusion or a reaction.
  - **Walter (the advisor, older, deadpan)**: the explainer. Calm, dry, 4-9 word sentences, one plain number, then one analogy, then a deadpan button line.
- Follow the reference patterns: no greeting; the opening line is the viewer's worry or an absurd framing, answered inside 3 s with a two-beat line; **a wrong number then a one-word correction** ("12 views" / "12 million"; "forty?" / "dry."); step triggers come from Leo's "why?" or a wrong move; a **running line** repeats 3-4 times with rising stakes and returns as the callback ending; ends on a deadpan puncture line, no moral, no "so remember".
- Facts: every number/claim is real and sourced in a comment under the script. One plain number, Leo rephrases it, Walter gives an analogy that is concrete (a taco truck, a library, a bakery queue), never "imagine a world".
- **Seated-Stage Rule (user, binding):** the script must never contain an action an actor has to perform with their body or props. Nobody stands, walks, fetches, points at a far thing, hands over an object, takes out a phone or leaves. Things that "happen" are told in words or shown by MG. Allowed: nod, head tilt, shrug, lean in / back, look at the fire/stones or at the other person, a small hand gesture while talking.
- Tag every line with `(beat)` `[cam: CU|MS|2S|OTS|WIDE]` `[gesture: ...]`. Camera framing, hand gesture, close-ups and facial expression all come from these tags and must match what the line says (panic or punchline = CU on the speaker; calm reply = MS or a hold on the listener's reaction; shared realisation = two-shot). Use 2-4 close-ups total, so they feel earned.
- Add 3-5 MG cue lines `[[mg: ...]]` (number card, simple diagram, label) built from templates only, **no AI images**.
- Run the 10 craft rules and the blind test (strip names from 10 lines; a reader must guess the speaker of 8+). Critique with 3 critics, then rewrite. Show me the script and wait for my OK before any voice credit is spent.

## Voice (after I approve the script)
- Use the **Fish Audio MCP** (`mcp__claude_ai_Fish__text_to_speech`, model `drama-3`, multi-speaker with `<|speaker:N|>` tags, max 500 bytes per call, so batch 4-5 turns per call; call `dry_run=true` first and tell me the cost).
- Voices for the campfire set: **Leo = Stickzy** (`55046bd7267d4a618380d1e8f93a056a`), **Walter = Slax** (`c5f56a6cc2ec4fa8920cb4c5889a3fb7`). (Hilltop set: Jasphina `e9b134e4c0b547a3894793be502314f1` + Slax.) Adrian (`bf322df2096a46f18c579d0baa36f41d`) is a spare.
- Direct each line with bracket tags (`[worried, fast]`, `[deadpan, flat, low]`, `[pause]`). The advisor stays flat (pitch range 2-5 semitones per line, steady 160-190 wpm); Leo carries the emotion (jumps 8-15 semitones on incredulous lines, 250-430 wpm when panicking, stretched when stunned).
- Reuse `dialogue/fish/voice_tighten.py` (cap gaps at 0.85 s; reference gaps are 0.4-0.9 s, 0.9-1.5 s around punchlines), `asr.py` (word check), `analyze.py` (per-turn pitch/speed + Earshot, run through `node runtime/jobq.js --kind light`, absolute Windows paths, `EARSHOT_HOME=HF_HOME=C:/Repos/HFPipleine/.vendor/hf-earshot`). Earshot's tone labels are unreliable: judge by pitch, speed and gaps. Re-roll only the weak lines (about 150-300 credits per batch).

## Sound
- Music: a soft pad only, **no melody**, about 14 dB under the previous Kevin v1 (final mix about -17 to -18 LUFS with the voice on top). Campfire/forest ambience and sparse foley from `dialogue/sfx/` (ember pops, log shift, cloth rustle, owl); **no stinger or SFX right before the final line**; the fire fades after it.

## Deliverables
1. `dialogue/episodes/<slug>/script.md` (tagged script + sources + 3 critic notes)
2. After my approval: `voice.wav`, `mix.mp3`, `analysis.json` + a 10-line honest verdict vs the reference (which lines match, which don't).
3. Do **not** build or render video in this task; audio and script only.

## Rules that always apply
- Be honest in the verdict; never loosen a check to pass; say at once when a job is waiting on the queue or credits.
- Heavy jobs only through `node runtime/jobq.js`. Never run whole-drive searches. Ollama off, no Blender, no VibeVoice.
- Never print API keys. The Fish key is in `.vendor-assets/.env` (gitignored) and may have little credit; prefer the MCP.
- Ask before any destructive or outward-facing action. Keep summaries short.

THUMBNAIL (required deliverable): also make the thumbnail in the same format as the video (9:16 -> 1080x1920, 16:9 -> 1920x1080) per dialogue/THUMBNAIL.md, and name its path and hook in the report.
