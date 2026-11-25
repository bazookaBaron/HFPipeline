"""ffmpeg/ffprobe wrappers used by the gates."""
from __future__ import annotations
import json
import re
import subprocess
from pathlib import Path


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path: Path) -> dict:
    r = _run(["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-of", "json", str(path)])
    if r.returncode:
        raise RuntimeError(f"ffprobe cannot read {path}: {r.stderr.strip()[-300:]}")
    streams = json.loads(r.stdout).get("streams", [])
    v = next((s for s in streams if s["codec_type"] == "video"), None)
    out = {"has_audio": any(s["codec_type"] == "audio" for s in streams), "frames": 0, "fps": 0.0, "width": 0, "height": 0}
    if v:
        n, d = (v["r_frame_rate"].split("/") + ["1"])[:2]
        out.update(frames=int(v.get("nb_read_frames") or v.get("nb_frames") or 0), fps=float(n) / float(d or 1), width=v["width"], height=v["height"])
    return out


def wav16k(src: Path, dst: Path) -> None:
    r = _run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vn", "-ar", "16000", "-ac", "1", str(dst)])
    if r.returncode:
        raise RuntimeError(f"ffmpeg could not extract audio: {r.stderr.strip()[-300:]}")


def frames(src: Path, out_dir: Path, fps: float = 2.0) -> list[Path]:
    r = _run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", f"fps={fps}", str(out_dir / "f%03d.png")])
    if r.returncode:
        raise RuntimeError(f"ffmpeg could not extract frames: {r.stderr.strip()[-300:]}")
    return sorted(out_dir.glob("f*.png"))


def max_scene_score(src: Path) -> float:
    r = _run(["ffmpeg", "-v", "error", "-i", str(src), "-an", "-vf", "select='gte(scene,0)',metadata=print:key=lavfi.scene_score:file=-", "-f", "null", "-"])
    vals = [float(x) for x in re.findall(r"lavfi\.scene_score=([0-9.]+)", r.stdout)]
    return max(vals, default=0.0)


def longest_freeze(src: Path, min_seconds: float = 0.7) -> float:
    r = _run(["ffmpeg", "-nostats", "-i", str(src), "-an", "-vf", f"freezedetect=n=-50dB:d={min_seconds}", "-f", "null", "-"])
    durs = [float(x) for x in re.findall(r"freeze_duration: ([0-9.]+)", r.stderr)]
    starts = re.findall(r"freeze_start: ([0-9.]+)", r.stderr)
    if len(starts) > len(durs):          # a freeze that runs to the end of the file
        total = _run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(src)]).stdout.strip()
        durs.append(float(total) - float(starts[-1]))
    return max(durs, default=0.0)


def loudness(src: Path) -> dict | None:
    """Integrated LUFS and sample peak dBFS, or None when the audio cannot be measured."""
    r = _run(["ffmpeg", "-nostats", "-i", str(src), "-vn", "-af", "ebur128=peak=sample", "-f", "null", "-"])
    summary = r.stderr.rsplit("Summary:", 1)[-1]
    i = re.search(r"\bI:\s+(-?[0-9.]+|-inf)\s+LUFS", summary)
    p = re.search(r"Peak:\s+(-?[0-9.]+|-inf)\s+dBFS", summary)
    if not i or not p or "inf" in i.group(1):
        return None
    return {"lufs": float(i.group(1)), "peak_db": float("-inf") if "inf" in p.group(1) else float(p.group(1))}
