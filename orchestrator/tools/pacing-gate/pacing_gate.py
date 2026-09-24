"""Diagnostic visual pacing measurements (numpy, ffmpeg, ffprobe required)."""

import argparse
import json
import math
import re
import subprocess
import sys
from collections import deque
from pathlib import Path

import numpy as np

W, H, GC, GR = 144, 256, 4, 16
GAP_BINS = [0, 200, 400, 700, 1000, 2000, 3000, 5000, float("inf")]
GAP_LABELS = ["<200", "200-400", "400-700", "700-1000", "1-2s", "2-3s", "3-5s", ">5s"]


def rect_arg(value):
    try:
        rect = tuple(map(float, value.split(",")))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("expected x,y,w,h fractions") from exc
    if len(rect) != 4 or not all(map(math.isfinite, rect)):
        raise argparse.ArgumentTypeError("expected four finite fractions")
    x, y, w, h = rect
    if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > 1 or y + h > 1:
        raise argparse.ArgumentTypeError("rectangle must fit within the frame")
    return rect


def inclusion(rects):
    mask = np.ones((H, W), bool)
    for x, y, w, h in rects:
        mask[math.floor(y*H):math.ceil((y+h)*H), math.floor(x*W):math.ceil((x+w)*W)] = False
    if not mask.any():
        raise ValueError("exclusions cover the full frame")
    return mask


def cells(changed, mask):
    shape = (GR, H//GR, GC, W//GC)
    numerator = (changed & mask).reshape(shape).sum((1, 3))
    denominator = mask.reshape(shape).sum((1, 3))
    return np.divide(numerator, denominator, out=np.zeros((GR, GC)), where=denominator > 0).ravel()


def probe(path):
    raw = subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-of", "json", str(path)])
    streams = json.loads(raw)["streams"]
    video = next((s for s in streams if s["codec_type"] == "video"), None)
    if video is None:
        raise ValueError("no video stream")
    numerator, denominator = map(int, video.get("avg_frame_rate", "0/1").split("/"))
    if not numerator or not denominator:
        raise ValueError("unknown frame rate")
    return numerator / denominator, any(s["codec_type"] == "audio" for s in streams)


def decode(path, mask):
    command = ["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"scale={W}:{H}:flags=area", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    prev = deque(maxlen=2)
    activity, cut_score, occupancy, frozen = [], [], [], []
    valid_cells = cells(mask, mask) > 0
    frame_size = W * H * 3
    while True:
        data = process.stdout.read(frame_size)
        if not data:
            break
        if len(data) != frame_size:
            process.kill()
            raise RuntimeError("incomplete decoded frame")
        rgb = np.frombuffer(data, np.uint8).reshape(H, W, 3)
        grey = (rgb[..., 0].astype(np.float32)*.299 + rgb[..., 1]*.587 + rgb[..., 2]*.114).astype(np.uint8)
        if prev:
            delta = np.abs(grey.astype(np.int16) - prev[-1].astype(np.int16))
            one = cells(delta > 12, mask)
            two = cells(np.abs(grey.astype(np.int16) - prev[0].astype(np.int16)) > 12, mask)
            # A spatial replacement can be seen through persistent chrome.
            changed_cells = (np.maximum(one, two) >= .12) & valid_cells
            activity.append(one)
            cut_score.append(float(changed_cells.sum() / valid_cells.sum()))
            frozen.append(not np.any((delta > 2) & mask))
        else:
            activity.append(np.zeros(GC * GR))
            cut_score.append(0.0)
            frozen.append(True)
        pixels = rgb[mask].astype(np.int16)
        coarse = (pixels // 16).astype(np.int32)
        hist = np.bincount(coarse[:, 0]*256 + coarse[:, 1]*16 + coarse[:, 2], minlength=4096)
        background = np.array(np.unravel_index(hist.argmax(), (16, 16, 16))) * 16 + 8
        occupancy.append(float(np.mean(np.max(np.abs(pixels-background), axis=1) > 28)))
        prev.append(grey)
    process.stdout.close()
    error = process.stderr.read().decode(errors="replace")
    if process.wait():
        raise RuntimeError(f"ffmpeg decode failed: {error[-500:]}")
    if not activity:
        raise ValueError("video contains no frames")
    return np.asarray(activity), np.asarray(cut_score), np.asarray(occupancy), np.asarray(frozen)


def events(activity, scores, fps):
    n = len(activity)
    cuts = []
    for i in range(2, n):
        if scores[i] >= .25 and (not cuts or i - cuts[-1] > 3):
            cuts.append(i)
    onsets = [i for i in range(3, n) if np.any((activity[i] >= .03) & (activity[i-3:i].max(0) < .008))]
    joined = []
    for i, is_cut in sorted([(i, False) for i in onsets] + [(i, True) for i in cuts]):
        if joined and i - joined[-1][0] <= 3:
            joined[-1] = (joined[-1][0], joined[-1][1] or is_cut)
        else:
            joined.append((i, is_cut))
    return joined, cuts


def dist(values):
    if not len(values):
        return {}
    q = np.percentile(values, [10, 25, 50, 75, 90])
    return dict(zip(("min", "p10", "p25", "median", "p75", "p90", "max", "mean"),
                    [round(float(v), 1) for v in (np.min(values), *q, np.max(values), np.mean(values))]))


def max_run(flags, fps):
    best = current = 0
    for flag in flags:
        current = current + 1 if flag else 0
        best = max(best, current)
    return round(best / fps, 3)


def audio(path, has_audio):
    if not has_audio:
        return {"digital_silence_pct": None, "integrated_lufs": None}
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"])
    samples = np.frombuffer(raw, dtype="<f4")
    windows = samples[:len(samples)//320*320].reshape(-1, 320).astype(np.float64)
    rms = np.sqrt(np.mean(windows**2, axis=1)) if len(windows) else np.array([])
    silence = round(float(np.mean(rms < .001)*100), 2) if len(rms) else None
    result = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"ffmpeg ebur128 failed: {result.stderr[-500:]}")
    matches = re.findall(r"Summary:.*?I:\s*([-+\w.]+) LUFS", result.stderr, re.S)
    loudness = float(matches[-1]) if matches and matches[-1] not in ("-inf", "inf") else None
    return {"digital_silence_pct": silence, "integrated_lufs": loudness}


def analyze(path, rects):
    fps, has_audio = probe(path)
    activity, scores, occupancy, frozen = decode(path, inclusion(rects))
    beats, cuts = events(activity, scores, fps)
    duration = len(activity) / fps
    times = np.asarray([i / fps for i, _ in beats])
    gaps = np.diff(times) * 1000
    gap_hist = np.histogram(gaps, GAP_BINS)[0].tolist() if len(gaps) else [0] * len(GAP_LABELS)
    report = {
        "video": str(path), "duration_s": round(duration, 3), "fps": round(fps, 3), "frames": len(activity),
        "exclude_rects": [list(r) for r in rects],
        "beats": len(beats), "beats_per_min": round(len(beats)/duration*60, 2),
        "gap_ms": dist(gaps), "gap_hist_ms": dict(zip(GAP_LABELS, gap_hist)),
        "time_in_gaps_over_2s_pct": round(float(gaps[gaps > 2000].sum()/1000/duration*100), 2),
        "max_semantic_hold_s": round(float(gaps.max()/1000), 3) if len(gaps) else None,
        "max_frozen_hold_s": max_run(frozen, fps),
        "empty_content_frames_pct": round(float(np.mean(occupancy < .012)*100), 2),
        "cuts": len(cuts), "cuts_per_min": round(len(cuts)/duration*60, 2),
        "cut_times_s": [round(i/fps, 3) for i in cuts],
        "beat_times_s": [round(i/fps, 3) for i, _ in beats],
        "thresholds": {"onset_cell_fraction": .03, "quiet_cell_fraction": .008,
                       "cut_changed_cells_fraction": .25, "cut_cell_pixel_fraction": .12,
                       "empty_foreground_fraction": .012},
    }
    report.update(audio(path, has_audio))
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True, type=Path)
    parser.add_argument("--exclude-rect", action="append", default=[], type=rect_arg, metavar="x,y,w,h")
    parser.add_argument("--json", type=Path, metavar="OUT.json")
    args = parser.parse_args(argv)
    try:
        if not args.video.is_file():
            raise ValueError(f"video not found: {args.video}")
        result = analyze(args.video, args.exclude_rect)
        output = json.dumps(result, indent=2)
        if args.json:
            args.json.write_text(output + "\n", encoding="utf-8")
        print(output)
        return 0
    except (ValueError, RuntimeError, OSError, subprocess.CalledProcessError) as exc:
        print(f"pacing_gate: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
