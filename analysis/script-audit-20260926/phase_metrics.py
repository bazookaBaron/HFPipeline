"""Count ASR words by manually assigned narrative phase boundaries."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
R4 = ROOT.parent / "pacing-audit-20260924" / "evidence" / "R4_DdT5wzdsQWV.asr.json"
PHASES = {
    "V1": [(0, 9, "question/misconception"), (9, 18, "definition/anchor"),
           (18, 36, "task + missing abilities"), (36, 69, "tool loop"),
           (69, 96, "context constraint"), (96, 107, "permissions"),
           (107, 119, "orchestration"), (119, 143, "recap/metaphor")],
    "V2": [(0, 11, "setup/naive flow"), (11, 34, "version 1/failure"),
           (34, 51, "version 2/storage split"), (51, 67, "new bandwidth problem"),
           (67, 100, "version 3/direct upload"), (100, 121, "multipart refinement"),
           (121, 145, "download extension"), (145, 170, "recap/principle")],
    "V3": [(0, 12, "topic/thesis"), (12, 30, "pronoun example"),
           (30, 48, "self-attention"), (48, 64, "multiple heads"),
           (64, 78, "position"), (78, 100, "layers"),
           (100, 123, "training"), (123, 145, "parallelism/scale"),
           (145, 163, "recap")],
    "V4": [(0, 8, "question/contrast"), (8, 22, "industry status quo"),
           (22, 48, "new strategy/context"), (48, 75, "software core"),
           (75, 108, "hardware/application"), (108, 128, "AI role"),
           (128, 145, "manufacturing"), (145, 169, "comparative recap")],
    "V5": [(0, 10, "hook/naive fix"), (10, 24, "counterexamples"),
           (24, 46, "idempotency key"), (46, 58, "processor extension"),
           (58, 103, "atomic server state"), (103, 136, "webhook edge case"),
           (136, 160, "flow recap/contrast")],
}

for key, phases in PHASES.items():
    src = R4 if key == "V2" else ROOT / f"{key}.asr.json"
    data = json.loads(src.read_text(encoding="utf-8"))
    segments = data["segments"] if isinstance(data, dict) else data
    words = [w for s in segments for w in (s.get("words") or [])]
    print(key)
    for lo, hi, label in phases:
        count = sum(lo <= w.get("start", w.get("s")) < hi for w in words)
        print(f"  {lo:>3}-{hi:<3}s {count:>3} words  {label}")
