"""voice.py <dir> [--speed 1.12] [--gap 0.10] [--lead 0.12]
Synthesise <dir>/script.txt (one line per scene) with the narrator clone, assemble at atempo=speed,
write <dir>/vo/voice.wav (48k) + <dir>/words.json [{w,s,e,line}]. Per-line cache (vo/cache/<sha1>.*)
keyed by text, so only changed lines are re-synthesised. Reels: --speed 1.12 --gap 0.10; long-form: --speed 1.0 --gap 0.35."""
import argparse, hashlib, json, subprocess, sys, os
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser(); ap.add_argument("dir")
ap.add_argument("--speed", type=float, default=1.12); ap.add_argument("--gap", type=float, default=0.10)
ap.add_argument("--lead", type=float, default=0.12); ap.add_argument("--tail", type=float, default=0.5)
a = ap.parse_args(); D = os.path.abspath(a.dir); SPEED = a.speed
lines = [l.strip() for l in open(f"{D}/script.txt", encoding="utf8").read().split("\n") if l.strip()]
cd = f"{D}/vo/cache"; os.makedirs(cd, exist_ok=True)
H = [hashlib.sha1(l.encode()).hexdigest()[:16] for l in lines]
jobs = [{"text": l, "wav": f"{cd}/{h}.wav", "json": f"{cd}/{h}.json"} for l, h in zip(lines, H)
        if not (os.path.exists(f"{cd}/{h}.wav") and os.path.exists(f"{cd}/{h}.json"))]
seen = set(); jobs = [j for j in jobs if not (j["wav"] in seen or seen.add(j["wav"]))]
print(f"{len(lines)} lines, {len(jobs)} to synthesise")
if jobs:
    jf = f"{D}/vo/_jobs.json"; json.dump(jobs, open(jf, "w"))
    subprocess.run(["node", f"{HERE}/voice_synth.js", jf], check=True)
out = []; words = []; sr = None
for i, h in enumerate(H):
    x, sr = sf.read(f"{cd}/{h}.wav"); x = x if x.ndim == 1 else x.mean(1)
    w = json.load(open(f"{cd}/{h}.json"))
    s0 = max(0, w[0]["start"] - 0.04); e0 = min(len(x) / sr, w[-1]["end"] + 0.08)
    out.append(np.zeros(int((a.gap if i else a.lead) * SPEED * sr)))
    base = sum(len(z) for z in out) / sr
    for t in w: words.append({"w": t["word"], "s": (base + t["start"] - s0) / SPEED, "e": (base + t["end"] - s0) / SPEED, "line": i})
    out.append(x[int(s0 * sr):int(e0 * sr)])
out.append(np.zeros(int(a.tail * sr)))
sf.write(f"{D}/vo/raw.wav", np.concatenate(out), sr)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", f"{D}/vo/raw.wav", "-af", f"atempo={SPEED}", "-ar", "48000", f"{D}/vo/voice.wav"], check=True)
json.dump(words, open(f"{D}/words.json", "w"))
d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"{D}/vo/voice.wav"]))
print(f"voice.wav {d:.2f}s, {len(words)} words, {len(words)/(words[-1]['e']-words[0]['s']):.2f} w/s")
