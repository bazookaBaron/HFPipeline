"""
SFX synth + mixer for v3 videos (no downloaded assets: every sound is synthesized, deterministic).

  python sfx_mix.py cues.json narration.wav out.wav [--stem sfx_only.wav]

cues.json: {"cues": [{"t": sec, "kind": "tick|blip|pop|whoosh|swish|keys|roll|strike|chime", "dur"?: sec,
            "var"?: int, "gain"?: dB offset}]}
narration.wav: any rate/channels (converted by ffmpeg to 48 kHz stereo s16 first).
Levels are relative to the narration's speech peak (99.5th percentile |x|), so SFX sit under the voice
before mastering, whatever the TTS level is.
"""
import json
import math
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

SR = 48000
PENTA = [0, 2, 4, 7, 9, 12, 14]  # pentatonic steps for pitched variants (always consonant)

# peak level of each kind relative to the speech peak (dB)
LEVEL = {"tick": -15, "blip": -17, "pop": -11, "whoosh": -13, "swish": -17, "keys": -21, "roll": -19, "strike": -15, "chime": -14}


def rng(seed):
    return np.random.default_rng(1000 + seed)


def env_exp(n, tau_s, attack_s=0.002):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack_s, 1e-4), 0, 1)
    return a * np.exp(-t / tau_s)


def one_pole_lp(x, fc):
    """time-varying one-pole low-pass; fc scalar or array (Hz)"""
    fc = np.broadcast_to(np.asarray(fc, dtype=float), x.shape)
    a = np.exp(-2 * math.pi * fc / SR)
    y = np.empty_like(x)
    s = 0.0
    for i in range(len(x)):
        s = (1 - a[i]) * x[i] + a[i] * s
        y[i] = s
    return y


def band(x, lo, hi):
    return one_pole_lp(x, hi) - one_pole_lp(x, lo)


def tick(v):
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    f = 2200 * 2 ** (PENTA[v % len(PENTA)] / 12 / 2)
    body = np.sin(2 * math.pi * f * t) * env_exp(n, 0.007, 0.0006)
    body += 0.35 * np.sin(2 * math.pi * 2 * f * t) * env_exp(n, 0.004, 0.0006)
    click = band(rng(v).standard_normal(n), 2500, 9000) * env_exp(n, 0.0015, 0.0002)
    return body + 0.6 * click


def blip(v):
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    f = 1046.5 * 2 ** (PENTA[v % len(PENTA)] / 12)  # C6 pentatonic, glassy
    y = np.sin(2 * math.pi * f * t) * env_exp(n, 0.055, 0.003)
    y += 0.18 * np.sin(2 * math.pi * 2 * f * t) * env_exp(n, 0.03, 0.003)
    return y


def pop(v):
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    f = 180 + 260 * np.exp(-t / 0.018)
    ph = 2 * math.pi * np.cumsum(f) / SR
    y = np.sin(ph) * env_exp(n, 0.045, 0.001)
    y += 0.3 * band(rng(v).standard_normal(n), 1500, 7000) * env_exp(n, 0.004, 0.0003)
    return y


def whoosh(v, dur=0.42, lo=350, hi=3200):
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    fc = lo * (hi / lo) ** np.sin(math.pi * np.clip(p, 0, 1) * 0.5)  # sweep up
    x = rng(v).standard_normal(n)
    y = one_pole_lp(x, fc) - one_pole_lp(x, fc * 0.35)
    shape = np.sin(math.pi * np.clip(p, 0, 1)) ** 1.6 * (1 - 0.35 * p)
    return y * shape


def keys(v, dur):
    n = int(dur * SR) + int(0.03 * SR)
    y = np.zeros(n)
    r = rng(v)
    step = 0.052
    k = 0
    tt = 0.0
    while tt < dur:
        m = int(0.012 * SR)
        c = band(r.standard_normal(m), 1800, 7500) * env_exp(m, 0.0018, 0.0002) * (0.75 + 0.25 * r.random())
        i = int(tt * SR)
        y[i:i + m] += c[: len(y[i:i + m])]
        k += 1
        tt += step * (0.8 + 0.4 * r.random())
    return y


def roll(v, dur):
    n = int(dur * SR) + int(0.06 * SR)
    y = np.zeros(n)
    count = max(4, int(dur / 0.06))
    for j in range(count):
        p = j / max(1, count - 1)
        tt = dur * (1 - (1 - p) ** 1.8)  # accelerating then settling
        s = tick(v + j) * (0.55 + 0.45 * p)
        i = int(tt * SR)
        seg = y[i:i + len(s)]
        seg += s[: len(seg)]
    return y


def strike(v):
    s = whoosh(v, 0.2, 900, 5000) * 0.8
    n = len(s)
    t = np.arange(n) / SR
    s += 0.6 * np.sin(2 * math.pi * 110 * t) * env_exp(n, 0.05, 0.002)
    return s


def chime(v):
    n = int(1.1 * SR)
    t = np.arange(n) / SR
    base = 1046.5 * 2 ** (PENTA[v % 3] / 12)
    y = np.zeros(n)
    for mult, g, tau in ((1, 1, 0.45), (1.5, 0.55, 0.35), (2.0, 0.25, 0.25), (3.01, 0.08, 0.12)):
        y += g * np.sin(2 * math.pi * base * mult * t) * env_exp(n, tau, 0.004)
    return y


def synth(c):
    k, v = c["kind"], int(c.get("var", 0))
    if k == "tick":
        return tick(v)
    if k == "blip":
        return blip(v)
    if k == "pop":
        return pop(v)
    if k == "whoosh":
        return whoosh(v)
    if k == "swish":
        return whoosh(v, 0.22, 900, 5200)
    if k == "keys":
        return keys(v, max(0.08, min(1.4, c.get("dur", 0.4))))
    if k == "roll":
        return roll(v, max(0.2, min(1.2, c.get("dur", 0.6))))
    if k == "strike":
        return strike(v)
    if k == "chime":
        return chime(v)
    raise ValueError("unknown sfx kind " + k)


def read_wav(p):
    with wave.open(str(p), "rb") as w:
        assert w.getsampwidth() == 2 and w.getnchannels() == 2 and w.getframerate() == SR
        d = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768
    return d.reshape(-1, 2)


def write_wav(p, x):
    x = np.clip(x, -1, 1)
    with wave.open(str(p), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())


def main():
    cues_p, narr_p, out_p = sys.argv[1:4]
    stem_p = sys.argv[sys.argv.index("--stem") + 1] if "--stem" in sys.argv else None
    cues = json.loads(Path(cues_p).read_text(encoding="utf-8"))["cues"]
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / "n.wav"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", narr_p, "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le", str(tmp)], check=True)
        voice = read_wav(tmp)
    speech_peak = np.percentile(np.abs(voice[:, 0]), 99.5) or 0.3
    fx = np.zeros_like(voice)
    cache = {}
    for i, c in enumerate(cues):
        key = json.dumps({k: c.get(k) for k in ("kind", "var", "dur")}, sort_keys=True)
        if key not in cache:
            s = synth(c)
            cache[key] = s / (np.max(np.abs(s)) or 1)
        s = cache[key]
        g = speech_peak * 10 ** ((LEVEL[c["kind"]] + c.get("gain", 0)) / 20)
        pan = ((i * 37) % 9 - 4) / 4 * 0.22  # deterministic gentle spread, +-0.22
        start = int(round(c["t"] * SR))
        if start >= len(fx):
            continue
        if start < 0:
            s = s[-start:]
            start = 0
        seg = fx[start:start + len(s)]
        seg[:, 0] += s[: len(seg)] * g * math.sqrt(0.5 - pan / 2) * math.sqrt(2)
        seg[:, 1] += s[: len(seg)] * g * math.sqrt(0.5 + pan / 2) * math.sqrt(2)
    write_wav(out_p, voice + fx)
    if stem_p:
        write_wav(stem_p, fx)
    print(json.dumps({"cues": len(cues), "speechPeak": round(float(speech_peak), 4), "fxPeak": round(float(np.max(np.abs(fx))), 4)}))


if __name__ == "__main__":
    main()
