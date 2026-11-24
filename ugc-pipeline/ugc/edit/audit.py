"""Check a finished reel against the spec. Returns a list of problems; empty means it passes."""
from __future__ import annotations
import json
import re
import shutil
import tempfile
from fractions import Fraction
from pathlib import Path

from . import media, render
from .errors import EditError, OverlayError

MIN_SHOW = 0.35
MAX_CARD = 3.2


def _faststart(path: Path) -> bool:
    seen = []
    with path.open("rb") as f:
        while len(seen) < 8:
            h = f.read(8)
            if len(h) < 8:
                break
            size, kind = int.from_bytes(h[:4], "big"), h[4:8].decode("latin1")
            seen.append(kind)
            if kind in ("moov", "mdat"):
                break
            if size == 1:
                size = int.from_bytes(f.read(8), "big") - 8
            if size < 8:
                break
            f.seek(size - 8, 1)
    return "moov" in seen and ("mdat" not in seen or seen.index("moov") < seen.index("mdat"))


def _raw_gray(args: list[str], what: str) -> bytes:
    import subprocess
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-v", "error", *args, "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True)
    if r.returncode or not r.stdout:
        raise EditError(f"{what}: {r.stderr.decode(errors='replace')[-300:]}")
    return r.stdout


def _planes(png: Path) -> tuple[bytes, bytes]:
    alpha = _raw_gray(["-i", str(png), "-vf", "alphaextract"], "reading overlay alpha")
    luma = _raw_gray(["-i", str(png), "-vf", "format=rgb24"], "reading overlay colour")
    return alpha, luma


def _frame_crop(path: Path, t: float, x: int, y: int, w: int, h: int) -> bytes:
    return _raw_gray(["-ss", f"{t:.3f}", "-i", str(path), "-frames:v", "1", "-vf", f"crop={w}:{h}:{x}:{y}"], f"reading frame at {t:.2f}s")


def _text_visible(frame: bytes, alpha: bytes, luma: bytes, need_pill: bool) -> bool:
    """Light text pixels of the overlay must be light in the frame; for the label, its dark backing must be dark too."""
    if len(frame) != len(alpha):
        return False
    text = [i for i, (a, l) in enumerate(zip(alpha, luma)) if a >= 250 and l >= 180]
    if len(text) < 40:
        return False
    share = sum(1 for i in text if frame[i] >= 150) / len(text)
    if share < (0.85 if need_pill else 0.7):
        return False
    if need_pill:
        pill = [frame[i] for i, (a, l) in enumerate(zip(alpha, luma)) if 120 <= a <= 235 and l < 60]
        if len(pill) < 200:
            return False
        mp, mt = sum(pill) / len(pill), sum(frame[i] for i in text) / len(text)
        return mp <= 115 and mt - mp >= 70
    return True


def _samples(frames: int, fps: int, end_start: int | None) -> list[float]:
    """Times of the first frame, the last two, seven spread through the reel and one inside the end card."""
    idx = {0, frames - 1, frames - 2} | {frames * k // 8 for k in range(1, 8)}
    if end_start is not None:
        idx.add(end_start + (frames - end_start) // 2)
    return [max(i / fps - 0.005, 0.0) for i in sorted(idx)]       # ffmpeg -ss lands on the first frame at or after t


def final(path: Path, cfg: dict, manifest: Path | None = None) -> list[str]:
    path = Path(path)
    rc = cfg["reel"]
    W, H, FPS, secs = rc["width"], rc["height"], rc["fps"], float(rc["seconds"])
    out: list[str] = []
    if not path.is_file():
        return [f"file missing: {path}"]
    try:
        d = json.loads(media.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)], "probing the reel").stdout)
    except EditError as e:
        return [f"unreadable file: {e}"]
    v = next((s for s in d["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in d["streams"] if s["codec_type"] == "audio"), None)
    if v is None:
        return ["no video stream"]
    if (v["width"], v["height"]) != (W, H):
        out.append(f"size is {v['width']}x{v['height']}, want {W}x{H}")
    for k in ("r_frame_rate", "avg_frame_rate"):
        if Fraction(v[k]) != FPS:
            out.append(f"fps is {v[k]} ({k}), want {FPS}")
    if v["codec_name"] != "h264" or v.get("profile") != "High" or v["pix_fmt"] != "yuv420p":
        out.append(f"video is {v['codec_name']} {v.get('profile')} {v['pix_fmt']}, want h264 High yuv420p")
    vd = float(v.get("duration") or d["format"]["duration"])
    if abs(vd - secs) > 1 / FPS + 1e-3:
        out.append(f"duration is {vd:.3f} s, want {secs:g} s (+/- one frame)")
    nb = v.get("nb_frames")
    if nb and abs(int(nb) - round(secs * FPS)) > 1:
        out.append(f"{nb} frames, want {round(secs * FPS)}")
    if not _faststart(path):
        out.append("moov atom is after the media data (not faststart)")
    if a is None:
        out.append("no audio stream")
    else:
        if a["codec_name"] != "aac" or int(a["sample_rate"]) != 48000:
            out.append(f"audio is {a['codec_name']} {a['sample_rate']} Hz, want aac 48000 Hz")
        ad = float(a.get("duration") or 0)
        if ad and abs(ad - secs) > 0.1:
            out.append(f"audio is {ad:.2f} s, want {secs:g} s")

    r = media.ff(["-i", str(path), "-vf", "blackdetect=d=0.3:pix_th=0.08,freezedetect=n=-60dB:d=1.0", "-af",
                  "ebur128=peak=true:framelog=quiet,silencedetect=n=-75dB:d=0.3", "-f", "null", "-"], "scanning the reel")
    for m in re.finditer(r"black_start:([\d.]+) black_end:([\d.]+)", r.stderr):
        out.append(f"black picture from {m.group(1)} s to {m.group(2)} s")
    for m in re.finditer(r"freeze_start:\s*([\d.]+)", r.stderr):
        out.append(f"frozen picture from {m.group(1)} s")
    for m in re.finditer(r"silence_start:\s*(-?[\d.]+)", r.stderr):
        out.append(f"digital silence from {m.group(1)} s; audio should sit on room tone")
    if a is not None:
        i = re.search(r"Integrated loudness:\s+I:\s+(-?[\d.]+|-inf)\s+LUFS", r.stderr)
        p = re.search(r"True peak:\s+Peak:\s+(-?[\d.]+|-inf)\s+dBFS", r.stderr)
        lufs = float(i.group(1)) if i and i.group(1) != "-inf" else None
        tp = float(p.group(1)) if p and p.group(1) != "-inf" else None
        target = float(rc["loudness_lufs"])
        if lufs is None or abs(lufs - target) > 1.0:
            out.append(f"loudness is {lufs} LUFS, want {target:g} +/- 1")
        if tp is not None and tp > -1.0:
            out.append(f"true peak is {tp} dBTP, must be <= -1")

    frames = round(secs * FPS)
    mf = Path(manifest) if manifest else path.with_name(path.stem + ".edit.json")
    man = json.loads(mf.read_text(encoding="utf8")) if mf.is_file() else None

    tmpd = Path(tempfile.mkdtemp(prefix="ugc-audit-"))
    try:
        spec = render.label_spec(cfg)
        g = render.geometry(cfg)
        try:
            lpng = render.overlays([spec], tmpd)[spec]
            alpha, luma = _planes(lpng)
        except (OverlayError, EditError) as e:
            out.append(f"label cannot be checked: {e}")
        else:
            end_start = man["end_card"]["start"] if man else None
            bad = []
            try:
                for t in _samples(frames, FPS, end_start):
                    if not _text_visible(_frame_crop(path, t, g.label_x, g.label_y, spec.w, spec.h), alpha, luma, True):
                        bad.append(f"{t:.2f}")
            except EditError as e:
                out.append(f"AI label cannot be checked on this file: {e}")
            if bad:
                out.append(f"AI label not visible at {', '.join(bad)} s")
        if man is None:
            out.append(f"label/caption layout cannot be verified: no manifest {mf.name}")
        else:
            x0, y0, x1, y1 = g.safe
            states = man.get("caption_states", [])
            for s in states:
                bx = s["box"]
                if bx[0] < x0 - 1 or bx[2] > x1 + 1 or bx[1] < y0 - 1 or bx[3] > y1 + 1:
                    out.append(f"caption '{s['text']}' at {s['start']:.2f} s is outside the safe area (box {bx})")
                    break
            for c in man.get("captions", []):
                if c["end"] - c["start"] < MIN_SHOW - 1 / FPS:
                    out.append(f"caption '{c['text']}' at {c['start']:.2f} s is shown only {c['end'] - c['start']:.2f} s")
                if not 1 <= c["n_words"] <= 4:
                    out.append(f"caption '{c['text']}' has {c['n_words']} words")
            fps_tol = 1.5 / FPS
            for c in man.get("cards", []):
                if c["end"] - c["start"] > MAX_CARD:
                    out.append(f"text card after clip {c['after']} is on screen {c['end'] - c['start']:.1f} s (max {MAX_CARD:g})")
            shown = [(c["start"], c["end"]) for c in man.get("cards", [])] + [(man["end_card"]["start"] / FPS, secs)]
            for s in states:
                if any(s["start"] < b - fps_tol and s["end"] > a + fps_tol for a, b in shown):
                    out.append(f"caption '{s['text']}' at {s['start']:.2f} s is shown over a card")
                    break
            pick = [states[k] for k in sorted({0, len(states) // 3, 2 * len(states) // 3, len(states) - 1})] if states else []
            for s in pick:
                try:
                    al, lu = _planes(Path(s["png"]))
                    t = (s["start"] + s["end"]) / 2
                    if not _text_visible(_frame_crop(path, t, 0, g.cap_y, g.w, g.cap_h), al, lu, False):
                        out.append(f"caption '{s['text']}' is not visible at {t:.2f} s")
                except EditError as e:
                    out.append(f"caption check failed: {e}")
    finally:
        shutil.rmtree(tmpd, ignore_errors=True)
    return out
