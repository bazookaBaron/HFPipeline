"""ffmpeg and ffprobe helpers: running, probing, and the small measurements the edit uses."""
from __future__ import annotations
import json
import re
import subprocess
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path

from .errors import EditError


def run(cmd: list[str], what: str) -> subprocess.CompletedProcess:
    r = subprocess.run(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL)
    if r.returncode:
        raise EditError(f"{what} failed (exit {r.returncode}): {r.stderr.strip()[-600:]}")
    return r


def ff(args: list[str], what: str) -> subprocess.CompletedProcess:
    return run(["ffmpeg", "-hide_banner", "-nostdin", "-nostats", "-y", *args], what)


@dataclass(frozen=True)
class Media:
    w: int
    h: int
    seconds: float       # shortest of the video and audio streams
    fps: float
    has_audio: bool


def probe(path: Path) -> Media:
    r = run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)], f"probing {path}")
    d = json.loads(r.stdout)
    v = next((s for s in d["streams"] if s["codec_type"] == "video"), None)
    if v is None:
        raise EditError(f"{path} has no video stream")
    a = next((s for s in d["streams"] if s["codec_type"] == "audio"), None)
    durs = [float(s["duration"]) for s in (v, a) if s and s.get("duration") not in (None, "N/A")]
    dur = min(durs) if durs else float(d["format"].get("duration") or 0)
    rate = v.get("avg_frame_rate") or "0/1"
    fps = float(Fraction(rate)) if rate not in ("0/0", "") else 0.0
    return Media(int(v["width"]), int(v["height"]), dur, fps, a is not None)


def _num(s: str) -> float | None:
    return None if s in ("-inf", "inf") else float(s)


def loudness(path: Path, ss: float | None = None, t: float | None = None, pre: str = "") -> tuple[float | None, float | None]:
    """(integrated LUFS, true peak dBTP) of a file or a window of it."""
    args = (["-ss", f"{ss:.3f}"] if ss is not None else []) + (["-t", f"{t:.3f}"] if t is not None else [])
    r = ff([*args, "-i", str(path), "-vn", "-af", f"{pre}ebur128=peak=true:framelog=quiet", "-f", "null", "-"], "loudness measurement")
    i = re.search(r"Integrated loudness:\s+I:\s+(-?[\d.]+|-inf)\s+LUFS", r.stderr)
    p = re.search(r"True peak:\s+Peak:\s+(-?[\d.]+|-inf)\s+dBFS", r.stderr)
    return (_num(i.group(1)) if i else None), (_num(p.group(1)) if p else None)


def mean_db(path: Path, ss: float, t: float) -> float | None:
    r = ff(["-ss", f"{ss:.3f}", "-t", f"{t:.3f}", "-i", str(path), "-vn", "-af", "highpass=f=75,volumedetect", "-f", "null", "-"], "level measurement")
    m = re.search(r"mean_volume:\s+(-?[\d.]+|-inf)\s+dB", r.stderr)
    return _num(m.group(1)) if m else None


def colour(path: Path, ss: float, t: float) -> tuple[float, float, float]:
    """Mean Y, U, V of the central part of the picture (where the face is), sampled 3 times a second."""
    r = ff(["-ss", f"{ss:.3f}", "-t", f"{t:.3f}", "-i", str(path), "-an", "-vf",
            "fps=3,crop=iw*0.6:ih*0.5:iw*0.2:ih*0.15,scale=96:-2,signalstats,metadata=mode=print:file=-", "-f", "null", "-"], "colour measurement")
    vals = {k: [float(x) for x in re.findall(rf"lavfi\.signalstats\.{k}AVG=([\d.]+)", r.stdout)] for k in "YUV"}
    if not vals["Y"]:
        raise EditError(f"could not measure the picture of {path}")
    return tuple(sum(v) / len(v) for v in (vals["Y"], vals["U"], vals["V"]))  # type: ignore[return-value]
