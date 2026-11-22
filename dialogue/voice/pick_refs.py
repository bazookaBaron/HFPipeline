"""whisper venv: verify Parler candidates (WER<=5%, duration 10-15 s), pick one per option -> refs/, write provenance.json"""
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import *

log = json.load(open(CAND / "parler_log.json"))
REFS.mkdir(exist_ok=True)
prov = {}
for c in CHARS:
    for o in OPTS:
        best = None
        for name, m in sorted(log.items()):
            if m["char"] != c or m["opt"] != o:
                continue
            x, sr = read_wav(CAND / name)
            dur = len(x) / sr
            hyp = transcribe(CAND / name)
            w = wer(m["text"], hyp)
            score = (w > 0.05) * 10 + abs(dur - 12.5) / 5 + (not 10 <= dur <= 15) * 2 + w
            print(c, o, name, f"dur={dur:.1f} wer={w:.3f}", flush=True)
            if best is None or score < best[0]:
                best = (score, name, m, dur, w, hyp)
        _, name, m, dur, w, hyp = best
        shutil.copy(CAND / name, REFS / f"{c}_{o}.wav")
        prov[f"{c}_{o}"] = {**m, "file": f"refs/{c}_{o}.wav", "duration_s": round(dur, 2), "wer": round(w, 3),
                            "whisper": hyp, "model": "parler-tts-mini-v1.1", "named_speaker": None}
json.dump(prov, open(CAST / "provenance.json", "w"), indent=1)
print("wrote provenance.json")
