"""whisper venv: pick the best take per line from `dlg_voice.py render` output and mix one dialogue wav.
usage: dialogue_mix.py <render_out_dir> <out.wav>
Pick: Whisper word check (reject wrong/missing words), then pitch variance. Gaps: default 350 ms; pause=X replaces the
gap before that line; a line ending in '-' (interrupted) overlaps the next line by 150 ms."""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from common import *

d, out = sys.argv[1], sys.argv[2]
man = json.load(open(f"{d}/manifest.json"))
lines, items = man["lines"], man["items"]
chosen = []
for i, ln in enumerate(lines):
    cands = [t for t in items if t["line"] == i and os.path.exists(t["out"])]
    for t in cands:
        x, sr = read_wav(t["out"])
        t["wer"] = wer(ln["text"], transcribe(t["out"]))
        f0 = pitch_track(x, sr)
        t["pstd"] = float(np.std(12 * np.log2(f0 / np.median(f0)))) if len(f0) > 20 else 0.0
    ok = [t for t in cands if t["wer"] == 0] or [min(cands, key=lambda t: t["wer"])]
    best = max(ok, key=lambda t: t["pstd"])
    chosen.append(best)
    print(f"line {i} {ln['char']} [{ln['tags']}] seed {best['seed']} wer {best['wer']:.2f} audio {best['audio_s']}s", flush=True)

SR = 24000
GAP, OVER = 0.35, 0.15
tracks, t_cursor = [], 0.0
for i, (ln, best) in enumerate(zip(lines, chosen)):
    x, sr = read_wav(best["out"])
    x = resample(x, sr, SR)
    if i > 0:
        if lines[i - 1].get("interrupted"):
            t_cursor -= OVER
        else:
            t_cursor += ln["pause"] if ln["pause"] is not None else GAP
    tracks.append((t_cursor, x))
    t_cursor += len(x) / SR
total = int((t_cursor + 0.5) * SR)
mix = np.zeros(max(total, SR), np.float32)
for t0, x in tracks:
    s = max(0, int(t0 * SR))
    mix[s:s + len(x)] += x[:len(mix) - s]
peak = np.abs(mix).max()
if peak > 0.95:
    mix *= 0.95 / peak
write_wav(out, mix, SR)
json.dump([{"line": i, "char": l["char"], "start": round(t, 2), "seed": c["seed"], "wer": c["wer"], "gen_s": c.get("gen_s")}
           for i, (l, (t, _), c) in enumerate(zip(lines, tracks, chosen))], open(out + ".timing.json", "w"), indent=1)
print(f"mixed {len(lines)} lines, {len(mix) / SR:.1f}s -> {out}")
