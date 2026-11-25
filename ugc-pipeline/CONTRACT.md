# Build contract

Orchestrator (Opus) owns: `CONTRACT.md`, `config.toml`, `ugc/contract.py`, `ugc/cli.py`, `ugc/__main__.py`, `PLAN.md`, `README.md`, `tests/test_e2e.py`.
Each builder edits ONLY its own folder and test file. Need a contract change? Report it; do not edit.

Rules for all: Python 3.11+ standard library only (run with `uv run --no-project --python 3.12 python`), ffmpeg/ffprobe on PATH, macOS arm64 host.
Import shared types from `ugc.contract`. No network in tests. Never read `.env`, never print a key, never rent or call a paid API.
No broad `except: pass`. Errors say what to do. Small files, few comments, no speculative options. Type hints.
Tests: `unittest`, in `tests/test_<part>.py`, pass on their own via `uv run --no-project --python 3.12 python -m unittest tests.test_<part>` from `ugc-pipeline/`.

## Public functions (exact signatures; the CLI calls these)

### 1. compute (`ugc/compute/`, `tests/test_compute.py`)
- `api.Vast(key: str, base: str = "https://console.vast.ai")`: `search(cfg, interruptible) -> list[Offer]`, `create(offer, cfg, onstart, bid=None) -> int`, `get(id) -> Instance | None`, `destroy(id)`, `list_mine() -> list[Instance]`, `balance() -> float`
- `pick.choose(offers, cfg) -> list[Offer]`: filtered by every rule in config, ranked by dollars per unit of performance. A reason string for each rejection via `pick.rejections(offers, cfg)`.
- `budget.project(seconds_per_take, n_clips, dph, cfg, spent=0.0, interruptible=False) -> Projection(hours, usd, fits)`
- `budget.best_tier(measured: dict[str, float], n_clips, dph, cfg, spent, interruptible) -> Tier | None`
- `ledger.Ledger(path)`: append-only money log; `open(instance_id, dph, storage_usd)`, `close(instance_id)`, `spent(now) -> float` (counts still-open machines), `open_ids()`
- `session.Session(vast, project, cfg, confirm, clock=time)`: context manager. Enter: cap check, `confirm(text)` must return True, create, wait until running and ComfyUI answers through an SSH tunnel, expose `.url`. Exit (any path, including exceptions and Ctrl-C): destroy, verify gone, log. `.tick()` raises `BudgetStop` when the cap (or `pilot_usd` for a pilot) would be passed.
- `session.reap(vast, project, confirm) -> list[int]`: destroy machines in the ledger that are still alive. Never touch instances not in our ledger.
- `cloud/setup.sh` text via `onstart.script(cfg) -> str` (≤ 4048 characters, or the documented gzip+base64 form): installs pinned ComfyUI, downloads the model files with resume and size checks, starts ComfyUI on 127.0.0.1 only, and **self-destructs the machine after idle or a hard wall-clock limit** as a dead-man switch if the Mac disappears.

### 2. generate (`ugc/generate/`, `workflows/`, `tests/test_generate.py`)
- `graph.build(clip, tier, cfg, prompt, sheet_name, voice_name) -> dict`: ComfyUI API-format graph
- `comfy.Comfy(url)`: `upload(path) -> str`, `run(graph, out: Path) -> float` (seconds), `missing(graph) -> list[str]`
- `queue.run(project, cfg, tier, comfy, judge, tick, clips=None, log=print) -> dict`: one take per clip, `judge(clip, take) -> Check`, retry only failures up to `takes.max_per_clip` with a new seed; resumable by `Take.key`; calls `tick()` before every job; a failing clip never stops the others; `BudgetStop` stops cleanly with everything saved.
- `pilot.run(project, cfg, comfy, judge, tick) -> dict[str, float]`: measured seconds per tier, saved to `pilot.json`.

### 3. script and checks (`ugc/script/`, `ugc/checks/`, `tests/test_script.py`, `tests/test_checks.py`)
- `planner.validate(reels, brief, cfg) -> list[str]`: every problem, e.g. words per clip 18-24, unknown claim ids, first-person product experience, missing CTA, duplicate hooks, unsafe text
- `planner.template(brief, cfg, n=30) -> str`: the instruction text an LLM follows to write reels.jsonl; `planner.parse(text, cfg) -> list[Reel]`
- `prompt.render(clip, brief, cfg) -> str`: H3 full-reference prompt
- `gates.judge(project, cfg, clip, take) -> Check`: file, speech (macOS on-device SpeechTranscriber via Swift), face (Vision via Swift), cut, freeze, loudness gates
- `gates.select(project) -> dict`: best passing take per clip, writes selects.json

### 4. edit (`ugc/edit/`, `tests/test_edit.py`)
- `assemble.reel(project, cfg, reel, words=None) -> Path`: final/<reel>.mp4, 1080x1920, 30 fps, loudness to target, captions, AI label on every frame, end card with CTA, B-roll cutaways with the voice continuing underneath
- `captions.chunks(words) -> list[Caption]`; `render.overlays(specs, out_dir) -> dict`: transparent PNGs from HTML with headless Chrome (ffmpeg here has no drawtext or subtitles filter)
- `audit.final(path, cfg) -> list[str]`: size, fps, duration, loudness, label visible, no black frames
