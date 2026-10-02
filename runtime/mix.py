"""mix.py <dir> --music <file|auto> [--sfx-rate 1.5] [--music-db -19] [--sfx-db -6] [--energy 3-5 --bpm 100-130]
Reads <dir>/sfx.json (from sfxdump.js) + <dir>/vo/voice.wav. Synthesised SFX kit, cue thinning to ~sfx-rate/s
(priority-based), music bed (faded) and a -14 LUFS master -> <dir>/mix.wav, <dir>/sfx.wav, <dir>/credits.txt.
--music auto: picks a licensed track from video-engine/assets/music-lib/index.json by energy/bpm (deterministic per dir name)."""
import argparse, json, os, subprocess, hashlib
import numpy as np, soundfile as sf
from scipy.signal import lfilter
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LIB = f"{ROOT}/video-engine/assets/music-lib"
ap = argparse.ArgumentParser(); ap.add_argument("dir"); ap.add_argument("--music", default="auto")
ap.add_argument("--sfx-rate", type=float, default=1.5); ap.add_argument("--music-db", type=float, default=-19)
ap.add_argument("--sfx-db", type=float, default=-6); ap.add_argument("--lufs", type=float, default=-14)
ap.add_argument("--bpm", default="100-130"); ap.add_argument("--energy", default="3-5"); ap.add_argument("--mood", default="")
ap.add_argument("--out", default="mix.wav")
a = ap.parse_args(); D = os.path.abspath(a.dir)
SR = 48000; rng = np.random.default_rng(3)
def env(n, at=0.002, r=0.08): t = np.arange(n) / SR; return np.minimum(1, t / at) * np.exp(-t / r)
def noise(n): return rng.standard_normal(n)
def hp(x, k=0.97): y = np.copy(x); y[1:] = x[1:] - k * x[:-1]; return y
def lp(x, k=0.9): return lfilter([1 - k], [1, -k], x)
def sweep(n, f0, f1): return np.sin(2 * np.pi * np.cumsum(np.linspace(f0, f1, n)) / SR)
S = {}
n = int(.32 * SR); S['whoosh'] = lp(noise(n), 0.8) * np.sin(np.linspace(0, np.pi, n)) ** 2 * 0.9
n = int(.16 * SR); S['swish'] = hp(noise(n)) * np.sin(np.linspace(0, np.pi, n)) ** 3 * 0.35
n = int(.12 * SR); S['pop'] = sweep(n, 900, 300) * env(n, 0.001, 0.03) * 0.8
n = int(.05 * SR); S['click'] = hp(noise(n)) * env(n, 0.0005, 0.006) * 0.7
n = int(.04 * SR); S['tick'] = np.sin(2 * np.pi * 2600 * np.arange(n) / SR) * env(n, 0.0005, 0.008) * 0.35
n = int(.03 * SR); S['key'] = hp(noise(n)) * env(n, 0.0005, 0.004) * 0.3
n = int(.35 * SR); S['slam'] = sweep(n, 140, 45) * env(n, 0.001, 0.09) + hp(noise(n)) * env(n, 0.0005, 0.02) * 0.5
n = int(.2 * SR); S['scribble'] = hp(noise(n), 0.8) * (0.5 + 0.5 * np.sin(2 * np.pi * 28 * np.arange(n) / SR)) * np.sin(np.linspace(0, np.pi, n)) * 0.18
n = int(.22 * SR); g = np.round(noise(n) * 4) / 4; S['glitch'] = g * (np.arange(n) // 400 % 2) * env(n, 0.001, 0.12) * 0.5
n = int(.6 * SR); S['burst'] = sum(np.sin(2 * np.pi * f * np.arange(n) / SR) * env(n, 0.001, 0.1 + 0.05 * i) for i, f in enumerate([1800, 2400, 3100, 4000])) * 0.15
S = {k: np.clip(v, -1, 1).astype(np.float32) for k, v in S.items()}
PRI = {'slam': 0, 'glitch': 0, 'burst': 0, 'whoosh': 1, 'pop': 1, 'click': 1, 'swish': 2, 'scribble': 2, 'tick': 3, 'key': 3}
cues = sorted(json.load(open(f"{D}/sfx.json")), key=lambda c: c['t'])
voice, _ = sf.read(f"{D}/vo/voice.wav"); voice = voice if voice.ndim == 1 else voice.mean(1)
dur = len(voice) / SR + 1.0; N = int(dur * SR)
kept = []
for c in cues:
    p = PRI.get(c['k'], 3)
    if kept and c['t'] - kept[-1]['t'] < (0.12 if p <= 1 else 0.3):
        if p < PRI.get(kept[-1]['k'], 3): kept[-1] = c
        continue
    kept.append(c)
while len(kept) / dur > a.sfx_rate and len(kept) > 1:
    worst = max(PRI.get(c['k'], 3) for c in kept)
    cand = [i for i, c in enumerate(kept) if PRI.get(c['k'], 3) == worst]
    gap = lambda i: min(abs(kept[i]['t'] - kept[j]['t']) for j in (i - 1, i + 1) if 0 <= j < len(kept))
    kept.pop(min(cand, key=gap))
fx = np.zeros(N)
for c in kept:
    s = S.get(c['k']); i = int(c['t'] * SR)
    if s is not None and i < N: fx[i:i + len(s)] += s[:max(0, N - i)]
sf.write(f"{D}/sfx.wav", fx.astype(np.float32), SR)
print(len(cues), '->', len(kept), 'cues', round(len(kept) / dur, 2), '/s')
lib = json.load(open(f"{LIB}/index.json")); music = None; start = 0; credit = ""
if a.music == "auto":
    lo, hi = map(float, a.bpm.split("-")); elo, ehi = map(int, a.energy.split("-"))
    tr = [t for t in lib["tracks"] if t.get("kind") == "music" and t.get("licensed") and t.get("bpm")]
    def score(t):
        b = t["bpm"]; bd = 0 if lo <= b <= hi else min(abs(b - lo), abs(b - hi))
        ed = 0 if elo <= (t.get("energy") or 0) <= ehi else 1
        md = 0 if (not a.mood or t["mood"] == a.mood) else 1
        up = 0 if t["mood"] == "upbeat" else 0.5
        return (bd / 10 + ed * 2 + md * 3 + up, hashlib.md5((os.path.basename(D) + t["id"]).encode()).hexdigest())
    best = sorted(tr, key=score)[0]; music = f"{LIB}/{best['file']}"; start = best.get("entry") or 0; credit = best["credit"]
    print("music auto ->", best["id"], best["bpm"], "bpm energy", best.get("energy"))
else:
    music = a.music; rel = os.path.relpath(os.path.abspath(music), LIB).replace("\\", "/")
    t = next((t for t in lib["tracks"] if t["file"] == rel), None)
    if t: start = t.get("entry") or 0; credit = t.get("credit", "")
fc = (f'[2:a]volume={a.music_db}dB,afade=t=in:d=0.3,afade=t=out:st={dur-1.2}:d=1.2[m];[1:a]volume={a.sfx_db}dB[s];'
      f'[0:a][s][m]amix=inputs=3:normalize=0:duration=longest,loudnorm=I={a.lufs}:TP=-1.5:LRA=4,aresample=48000[a]')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', f'{D}/vo/voice.wav', '-i', f'{D}/sfx.wav', '-stream_loop', '-1', '-ss', str(start), '-t', str(dur), '-i', music,
                '-filter_complex', fc, '-map', '[a]', '-t', str(dur), '-c:a', 'pcm_s16le', f'{D}/{a.out}'], check=True)
if credit: open(f"{D}/credits.txt", "w", encoding="utf8").write("Music: " + credit + "\n")
print("wrote", f"{D}/{a.out}", "credits:", credit[:80])
