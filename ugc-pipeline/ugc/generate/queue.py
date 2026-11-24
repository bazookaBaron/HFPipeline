"""One take per clip first, then retry rounds for failures only. Resumable by Take.key; the GPU never waits for a judge."""
from __future__ import annotations
import hashlib
import json
import statistics
import subprocess
from collections import deque
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import asdict, replace
from pathlib import Path
from typing import Callable

from ugc.contract import Check, Clip, Project, Take, Tier, write_atomic
from ugc.generate import graph as G
from ugc.generate.comfy import ComfyError

MAX_INFRA_IN_A_ROW = 3


class InfraStop(RuntimeError):
    """Raised after state is saved when the machine, not the clips, is the problem."""


def _name(e: BaseException) -> str:
    return type(e).__name__


def sha(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def take_key(clip: Clip, tier: Tier, cfg: dict, prompt: str, sheet_sha: str, voice_sha: str, seed: int) -> str:
    g = G.build(replace(clip, seed=seed), tier, cfg, prompt, "sheet:" + sheet_sha, "voice:" + voice_sha)
    blob = json.dumps({"graph": g, "sheet": sheet_sha, "voice": voice_sha, "tier": asdict(tier), "seed": seed}, sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()[:32]


def valid_video(path: Path) -> bool:
    """A take is usable only if it has a video stream, an audio stream (the speech) and some length."""
    if not Path(path).exists():
        return False
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type:format=duration", "-of", "json", str(path)],
                       capture_output=True, text=True)
    if p.returncode:
        return False
    d = json.loads(p.stdout or "{}")
    kinds = {s.get("codec_type") for s in d.get("streams", [])}
    return {"video", "audio"} <= kinds and float(d.get("format", {}).get("duration") or 0) > 0.5


def all_clips(project: Project) -> list[Clip]:
    return [c for r in project.reels() for c in r.clips]


def record_take(project: Project, t: Take) -> None:
    """Append, replacing any older row for the same clip and take number (a regenerated take)."""
    rows = project.takes()
    if any(r.clip == t.clip and r.take == t.take for r in rows):
        rows = [r for r in rows if not (r.clip == t.clip and r.take == t.take)] + [t]
        write_atomic(project.p("takes.jsonl"), "".join(json.dumps(asdict(r), ensure_ascii=False) + "\n" for r in rows))
    else:
        project.add_take(t)


def _inflight(project: Project) -> dict:
    f = project.path / "inflight.json"
    try:
        return json.loads(f.read_text(encoding="utf8")) if f.exists() else {}
    except ValueError:
        return {}


def _set_inflight(project: Project, key: str, pid: str | None) -> None:
    d = _inflight(project)
    if pid is None:
        d.pop(key, None)
    else:
        d[key] = pid
    write_atomic(project.p("inflight.json"), json.dumps(d))


def make_prompts(project: Project, cfg: dict, clips: list[Clip], render: Callable | None) -> dict[str, str]:
    if render is None:
        from ugc.script.prompt import render      # builder 3; imported late so this package stands alone
    brief = project.brief()
    return {c.id: render(c, brief, cfg) for c in clips}


def _failed_gates(chk: Check) -> int:
    return sum(1 for g in chk.gates.values() if isinstance(g, dict) and not g.get("pass", True))


def run(project: Project, cfg: dict, tier: Tier, comfy, judge: Callable[[Clip, Take], Check], tick: Callable[[], None],
        clips: list | None = None, log: Callable[[str], None] = print, render: Callable | None = None,
        depth: int = 2, judge_workers: int = 2) -> dict:
    by_id = {c.id: c for c in all_clips(project)}
    todo_clips = [by_id[c] if isinstance(c, str) else c for c in clips] if clips else list(by_id.values())
    prompts = make_prompts(project, cfg, todo_clips, render)
    sheet, voice = project.p("cast", "sheet.png"), project.p("voice", "ref.wav")
    sheet_sha, voice_sha = sha(sheet), sha(voice)
    max_takes = cfg["takes"]["max_per_clip"]
    gen: list[Take] = []
    secs: list[float] = []
    passed: dict[str, int] = {}
    last: dict[str, Check] = {}
    errors: dict[str, str] = {}
    permanent: set[str] = set()
    unjudged: set[str] = set()
    state = {"infra": 0, "uploaded": None, "checked": False}
    pool = ThreadPoolExecutor(max_workers=judge_workers, thread_name_prefix="judge")
    futures: dict[Future, Take] = {}
    stop: BaseException | None = None
    abort: str | None = None

    def start_judge(clip: Clip, t: Take) -> None:
        futures[pool.submit(judge, clip, t)] = t

    def collect(block: bool) -> None:
        for f in list(futures):
            if not (block or f.done()):
                continue
            t = futures.pop(f)
            try:
                chk = f.result()
            except Exception as e:      # a judge crash must not lose the take; it is judged again on the next run
                log(f"{t.clip} t{t.take}: judge failed ({_name(e)}: {e}); will be judged again on the next run")
                unjudged.add(t.clip)        # not a bad take: do not spend GPU on a retry
                continue
            project.save_check(chk)
            last[t.clip] = chk
            if chk.passed:
                passed[t.clip] = t.take
            bad = [k for k, g in chk.gates.items() if isinstance(g, dict) and not g.get("pass", True)]
            log(f"{t.clip} t{t.take}: {'PASS' if chk.passed else 'fail ' + ','.join(bad)} score {chk.score:.2f}")

    def accept(c: Clip, k: int, seed: int, key: str, seconds: float) -> None:
        t = Take(c.id, k, tier.id, seed, f"takes/{c.id}_t{k}.mp4", seconds, key)
        record_take(project, t)
        _set_inflight(project, key, None)
        gen.append(t)
        secs.append(seconds)
        errors.pop(c.id, None)
        log(f"{c.id} t{k}: {seconds:.0f} s on GPU, average {statistics.fmean(secs):.0f} s over {len(secs)} takes")
        start_judge(c, t)
        collect(False)

    def existing(c: Clip, n: int, key: str) -> Take | None:
        for t in project.takes():
            if t.clip == c.id and t.take == n and t.key == key and valid_video(project.path / t.file):
                return t
        return None

    def inputs() -> tuple[str, str]:
        if state["uploaded"] is None:
            state["uploaded"] = (comfy.upload(sheet), comfy.upload(voice))
        return state["uploaded"]

    def submit(c: Clip, n: int, seed: int, key: str):
        sname, vname = inputs()
        g = G.build(replace(c, seed=seed), tier, cfg, prompts[c.id], sname, vname)
        if not state["checked"]:
            state["checked"] = True
            miss = comfy.missing(g) if hasattr(comfy, "missing") else []
            if miss:
                raise InfraStop("The ComfyUI server lacks: " + "; ".join(miss) + ". Fix the machine setup before generating.")
        out = project.p("takes", f"{c.id}_t{n}.mp4")
        out.with_suffix(".mp4.part").unlink(missing_ok=True)
        if hasattr(comfy, "submit"):
            job = comfy.submit(g)
            _set_inflight(project, key, job.prompt_id)
            return ("async", job, out)
        return ("sync", g, out)

    def finish(h, out: Path) -> float:
        kind, obj, _ = h
        return comfy.wait(obj, out) if kind == "async" else comfy.run(obj, out)

    try:
        order = list(todo_clips)
        for n in range(1, max_takes + 1):
            pending = [c for c in order if c.id not in passed and c.id not in permanent and c.id not in unjudged]
            if not pending or stop or abort:
                break
            jobs: deque = deque()
            for c in pending:
                seed = G.take_seed(c.seed, n)
                key = take_key(c, tier, cfg, prompts[c.id], sheet_sha, voice_sha, seed)
                t = existing(c, n, key)
                if t is None and key in _inflight(project) and hasattr(comfy, "recover"):
                    out = project.path / "takes" / f"{c.id}_t{n}.mp4"
                    try:
                        got = comfy.recover(_inflight(project)[key], out)
                    except ComfyError as e:
                        got = None
                        log(f"{c.id} t{n}: could not recover earlier job yet ({e}); submitting again")
                    if got is not None and valid_video(out):
                        log(f"{c.id} t{n}: recovered finished take from the server")
                        accept(c, n, seed, key, got)
                        continue
                    _set_inflight(project, key, None)
                if t is None:
                    jobs.append((c, n, seed, key))
                    continue
                chk = project.check(c.id, n)
                if chk is None:
                    start_judge(c, t)
                else:
                    last[c.id] = chk
                    if chk.passed:
                        passed[c.id] = n
                log(f"{c.id} t{n}: already done, skipped")
            flight: deque = deque()

            def fill() -> None:
                nonlocal stop
                while jobs and len(flight) < depth and stop is None and abort is None:
                    c, k, seed, key = jobs[0]
                    try:
                        tick()
                    except Exception as e:
                        stop = e
                        return
                    jobs.popleft()
                    (project.path / "checks" / f"{c.id}_t{k}.json").unlink(missing_ok=True)
                    try:
                        flight.append((c, k, seed, key, submit(c, k, seed, key), None))
                    except ComfyError as e:
                        flight.append((c, k, seed, key, None, e))

            fill()
            while flight:
                if stop is not None and _name(stop) == "Interrupted":
                    for x in flight:
                        if x[4] is not None and x[4][0] == "async" and hasattr(comfy, "cancel"):
                            comfy.cancel(x[4][1])
                    flight.clear()
                    break
                if stop is not None and len(flight) > 1:      # budget gone: the running job finishes, nothing behind it runs
                    while len(flight) > 1:
                        x = flight.pop()
                        if x[4] is not None and x[4][0] == "async" and hasattr(comfy, "cancel"):
                            comfy.cancel(x[4][1])
                        _set_inflight(project, x[3], None)
                c, k, seed, key, h, err = flight[0]
                seconds = 0.0
                if h is not None and err is None:
                    try:
                        seconds = finish(h, project.path / "takes" / f"{c.id}_t{k}.mp4")
                    except ComfyError as e:
                        err, seconds = e, 0.0
                flight.popleft()
                fill()
                if err is None:
                    out = project.path / "takes" / f"{c.id}_t{k}.mp4"
                    if not valid_video(out):
                        err = ComfyError(f"{out.name} has no video and audio streams")
                if err is not None:
                    if not err.infra:
                        _set_inflight(project, key, None)
                    errors[c.id] = str(err)
                    state["infra"] = state["infra"] + 1 if err.infra else 0
                    permanent.update([c.id] if err.permanent else [])
                    where = f" on tier {tier.id} ({tier.width}x{tier.height}, {tier.steps} steps)"
                    if err.oom:
                        log(f"{c.id} t{k}: OUT OF GPU MEMORY{where}: {err}")
                    else:
                        log(f"{c.id} t{k}: FAILED ({'infrastructure' if err.infra else 'execution'}): {err}")
                    if state["infra"] >= MAX_INFRA_IN_A_ROW:
                        abort = (f"Out of GPU memory on tier {tier.id}{where}. " if err.oom else "") + \
                                f"Stopped after {MAX_INFRA_IN_A_ROW} infrastructure failures in a row (last: {err}). " \
                                + ("Choose a smaller tier or a GPU with more VRAM." if err.oom else
                                   "Check the machine and tunnel, then run again; finished takes are kept.")
                        for x in flight:
                            if x[4] is not None and hasattr(comfy, "cancel") and x[4][0] == "async":
                                comfy.cancel(x[4][1])
                        flight.clear()
                        break
                    continue
                state["infra"] = 0
                accept(c, k, seed, key, seconds)
            if stop is not None and _name(stop) == "Interrupted":
                break
            collect(True)
            failed = [c for c in pending if c.id not in passed and c.id not in permanent and c.id not in unjudged]
            order = sorted(failed, key=lambda c: (_failed_gates(last[c.id]) if c.id in last else 99, -(last[c.id].score if c.id in last else 0)))
            if stop is not None:
                break
    finally:
        interrupted = stop is not None and _name(stop) == "Interrupted"
        pool.shutdown(wait=True, cancel_futures=interrupted)
        collect(False)
        for f in list(futures):
            futures.pop(f)
    if abort:
        raise InfraStop(abort)
    if stop is not None:
        log(f"Stopped: {_name(stop)}: {stop}. {len(gen)} takes saved; run again to resume.")
        raise stop
    failed_ids = [c.id for c in todo_clips if c.id not in passed and c.id not in unjudged]
    return {"tier": tier.id, "takes": [asdict(t) for t in gen], "passed": passed, "failed": failed_ids, "unjudged": sorted(unjudged), "errors": errors,
            "seconds": statistics.fmean(secs) if secs else 0.0}
