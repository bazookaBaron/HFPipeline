"""Measure seconds per take for each tier, best first, until the pilot budget stops us. Saved after every take."""
from __future__ import annotations
import json
import statistics
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import asdict, replace
from typing import Callable

from ugc.contract import Check, Clip, Project, Take, write_atomic
from ugc.generate import graph as G
from ugc.generate.comfy import ComfyError
from ugc.generate.queue import InfraStop, all_clips, make_prompts, sha, take_key, valid_video


def run(project: Project, cfg: dict, comfy, judge: Callable[[Clip, Take], Check], tick: Callable[[], None],
        render: Callable | None = None, log: Callable[[str], None] = print, clips: list | None = None) -> dict[str, float]:
    pool_clips = [c for c in all_clips(project) if c.id in clips] if clips else all_clips(project)
    # two different clips; the first take of a tier pays model loading and is left out of its median
    picks = pool_clips[:2]
    if not picks:
        raise ValueError("pilot needs at least one clip in reels.jsonl")
    prompts = make_prompts(project, cfg, picks, render)
    sheet, voice = project.p("cast", "sheet.png"), project.p("voice", "ref.wav")
    sheet_sha, voice_sha = sha(sheet), sha(voice)
    path = project.path / "pilot.json"
    data: dict = json.loads(path.read_text(encoding="utf8")) if path.exists() else {}
    names: list = []
    futures: dict[Future, tuple[str, dict]] = {}
    pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="pilot-judge")

    def save() -> None:
        for d in data.values():
            ts = d["takes"]
            warm = [t["seconds"] for t in ts[1:]]
            if warm:
                d["seconds"] = statistics.median(warm)
            else:
                d.pop("seconds", None)      # unmeasured must never read as free
            d["passed"] = sum(1 for t in ts if t.get("passed"))
        write_atomic(path, json.dumps(data, indent=1))

    def collect(block: bool) -> None:
        for f in list(futures):
            if not (block or f.done()):
                continue
            _, row = futures.pop(f)
            try:
                chk = f.result()
                row["passed"], row["score"] = bool(chk.passed), chk.score
                row["failed_gates"] = [k for k, g in chk.gates.items() if isinstance(g, dict) and not g.get("pass", True)]
            except Exception as e:
                row["passed"], row["judge_error"] = False, f"{type(e).__name__}: {e}"
        save()

    def done_row(tid: str, key: str) -> dict | None:
        return next((r for r in data.get(tid, {}).get("takes", []) if r["key"] == key and valid_video(project.path / r["file"])), None)

    try:
        for tier in cfg["tiers"]:
            d = data.setdefault(tier.id, {"takes": [], "passed": 0})
            for c in picks:
                seed = G.take_seed(c.seed, 1)
                key = take_key(c, tier, cfg, prompts[c.id], sheet_sha, voice_sha, seed)
                if done_row(tier.id, key):
                    log(f"pilot {tier.id} {c.id}: already measured, skipped")
                    continue
                tick()
                if not names:
                    names.extend([comfy.upload(sheet), comfy.upload(voice)])
                    probe = G.build(replace(c, seed=seed), tier, cfg, prompts[c.id], *names)
                    miss = comfy.missing(probe) if hasattr(comfy, "missing") else []
                    if miss:
                        raise InfraStop("The ComfyUI server lacks: " + "; ".join(miss) + ". Fix the machine setup first.")
                rel = f"pilot/{tier.id}_{c.id}.mp4"
                g = G.build(replace(c, seed=seed), tier, cfg, prompts[c.id], *names)
                try:
                    seconds = comfy.run(g, project.p("pilot", f"{tier.id}_{c.id}.mp4"))
                except ComfyError as e:
                    log(f"pilot {tier.id} {c.id}: FAILED: {e}")
                    d["takes"] = [r for r in d["takes"] if r["clip"] != c.id]
                    d.setdefault("errors", []).append({"clip": c.id, "error": str(e), "oom": e.oom})
                    save()
                    if e.infra:
                        raise InfraStop(f"Pilot stopped on tier {tier.id}: {e}") from e
                    continue
                row = asdict(Take(c.id, 1, tier.id, seed, rel, seconds, key))
                d["takes"] = [r for r in d["takes"] if r["clip"] != c.id] + [row]
                save()
                log(f"pilot {tier.id} {c.id}: {seconds:.0f} s" + (" (cold, includes model loading)" if len(d["takes"]) == 1 else ""))
                futures[pool.submit(judge, c, Take(**row))] = (tier.id, row)
                collect(False)
    except Exception as e:
        if type(e).__name__ != "BudgetStop":
            raise
        log(f"Pilot stopped by the budget ({e}); keeping what was measured.")
    finally:
        pool.shutdown(wait=True)
        collect(False)
    return {tid: d["seconds"] for tid, d in data.items() if "seconds" in d}
