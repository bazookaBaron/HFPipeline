"""Read-only summary of local ASR word timing; no media or cloud access."""
import json
from pathlib import Path
from statistics import median

HERE = Path(__file__).resolve().parent
R4 = HERE.parent / "pacing-audit-20260924" / "evidence" / "R4_DdT5wzdsQWV.asr.json"


def load_segments(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    return data["segments"] if isinstance(data, dict) else data


for name, path in [("V1", HERE / "V1.asr.json"), ("V2/R4", R4),
                   ("V3", HERE / "V3.asr.json"), ("V4", HERE / "V4.asr.json"),
                   ("V5", HERE / "V5.asr.json")]:
    if not path.is_file():
        print(f"{name}: pending")
        continue
    segments = load_segments(path)
    words = [w for s in segments for w in (s.get("words") or [])]
    get_start = lambda w: w.get("start", w.get("s"))
    get_end = lambda w: w.get("end", w.get("e"))
    ordered = sorted(words, key=get_start)
    duration = get_end(ordered[-1]) - get_start(ordered[0]) if ordered else 0
    gaps = [get_start(b) - get_end(a) for a, b in zip(ordered, ordered[1:])]
    segment_gaps = [b["start"] - a["end"] for a, b in zip(segments, segments[1:])]
    print(f"{name}: {len(ordered)} words / {duration:.1f}s spoken span = {60*len(ordered)/duration:.0f} gross WPM; "
          f"{len(segments)} ASR segments; median inter-segment pause {median(segment_gaps):.2f}s; "
          f"word gaps >0.5s {sum(g > 0.5 for g in gaps)}")
