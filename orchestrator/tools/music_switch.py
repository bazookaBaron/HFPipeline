"""
Per-section music bed from a music plan (orchestrator/lib/longform/musicPlan.js), used by
sfx_mix.py --music-plan. numpy/scipy only (no librosa at mix time).

render_plan(plan, n) -> (bed (n, 2) float, level (n,) pause level dB vs speech, depth (n,) duck depth dB,
                         info dict)

Each plan segment [start, end) plays one bed:
  * library track: decoded to 48 kHz stereo, starting on its entry downbeat (index.json "entry"); when the
    segment is longer than the track it loops between the index's phrase-boundary loop points
    (loop.end -> loop.start, both downbeats, 40 ms equal-power join); without loop points the usable
    span loops with a 1.5 s crossfade;
  * procedural (fallback): music_bed.render(preset) rendered past the cut so its own ending never plays.
Every bed is loudness-matched (K-weighted body) so switches do not jump in level, and gets the same gentle
voice-band carve as the procedural beds (-3 dB around 2.6 kHz).

Transition at each boundary B (plan.transitions): over [B - X, B] (X = plan.transitionSeconds, 2.5 s) the
outgoing bed loses its low end in a rising high-pass sweep (30 Hz -> 600 Hz, STFT domain) -- the "bass
drop-out" -- and is cut with an 80 ms fade at B; the incoming bed starts at B on its entry downbeat with a
120 ms fade-in. The whole bed fades in over 0.6 s at 0 and out over the last 2.5 s.

Levels (applied by sfx_mix.py): segment.levelDb = pause level vs speech (K-weighted), segment.duckDb =
extra attenuation under speech; montage segments use levelDb -4, duckDb 0.
"""
import math
import subprocess

import numpy as np

SR = 48000
TARGET_RMS_DB = -20.0
_cache = {}


def decode(path):
    if path not in _cache:
        r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True)
        if r.returncode != 0:
            raise RuntimeError(f"cannot decode {path}: {r.stderr.decode(errors='replace')[-300:]}")
        _cache[path] = np.frombuffer(r.stdout, dtype="<f4").reshape(-1, 2).astype(np.float64)
    return _cache[path]


def eq_carve(x):
    """-3 dB bell around 2.6 kHz (1.6 oct) + sub cleanup below 30 Hz, linear phase (FFT)"""
    n = len(x)
    nfft = 1 << int(math.ceil(math.log2(n + 1)))
    f = np.fft.rfftfreq(nfft, 1 / SR)
    fs = np.maximum(f, 1e-3)
    oc = np.log2(fs / 2600.0) / (1.6 / 2)
    g = 10 ** (-3.0 * np.exp(-0.5 * oc ** 2) / 20)
    g *= 1 / np.sqrt(1 + (30.0 / fs) ** 4)
    return np.fft.irfft(np.fft.rfft(x, nfft, axis=0) * g[:, None], nfft, axis=0)[:n]


def _xfade_join(a, b, nx):
    """a then b with an nx-sample equal-power crossfade"""
    if nx <= 0 or len(a) < nx or len(b) < nx:
        return np.concatenate([a, b])
    t = np.linspace(0, 1, nx)[:, None]
    mid = a[-nx:] * np.cos(0.5 * math.pi * t) + b[:nx] * np.sin(0.5 * math.pi * t)
    return np.concatenate([a[:-nx], mid, b[nx:]])


def track_audio(track, n):
    """n samples of a library track from its entry, looping at its phrase points when needed"""
    x = decode(track["path"])
    usable = track.get("usable") or [0, len(x) / SR]
    entry = float(track.get("entry") or usable[0])
    loop = track.get("loop")
    i0 = int(entry * SR)
    end_all = int(min(len(x), float(usable[1]) * SR))
    if end_all - i0 >= n:
        return x[i0:i0 + n].copy(), 0
    if loop and loop.get("end", 0) - loop.get("start", 0) >= 4:
        ls, le = int(loop["start"] * SR), int(loop["end"] * SR)
        out = x[i0:le]
        nx = int(0.04 * SR)
        loops = 0
        while len(out) < n + nx:
            out = _xfade_join(out, x[ls:le + nx], nx)
            loops += 1
        return out[:n].copy(), loops
    body = x[i0:end_all]
    nx = int(1.5 * SR)
    out = body
    loops = 0
    while len(out) < n:
        out = _xfade_join(out, body, nx)
        loops += 1
    return out[:n].copy(), loops


def procedural_audio(preset, n, seed):
    import music_bed  # same folder, sys.path set by sfx_mix.py

    return music_bed.render(preset, n + int(2.6 * SR), seed)[:n]


def k_rms_db(x):
    """RMS (dB) after a crude K-weighting (38 Hz high-pass + high shelf) -- level matching between beds"""
    if len(x) < SR // 2:
        return -120.0
    n = len(x)
    nfft = 1 << int(math.ceil(math.log2(n + 1)))
    f = np.maximum(np.fft.rfftfreq(nfft, 1 / SR), 1e-3)
    hpf = f ** 2 / np.sqrt((f ** 2 - 38.0 ** 2) ** 2 + (f * 38.0 / 0.5) ** 2)
    shelf = 10 ** (4.0 / (1 + (1500.0 / f) ** 2) / 20)
    y = np.fft.irfft(np.fft.rfft(x.mean(axis=1), nfft) * hpf * shelf, nfft)[:n]
    return 10 * math.log10(float(np.mean(y ** 2)) + 1e-12)


def bass_dropout(x, seconds, f0=30.0, f1=600.0):
    """rising high-pass sweep over the last `seconds` of x (in place), STFT domain"""
    from scipy.signal import istft, stft

    n = int(seconds * SR)
    if n <= SR // 10 or len(x) < n:
        return x
    pre = int(0.1 * SR)  # a little context before the sweep so the STFT edge does not click
    seg = x[-(n + pre):]
    nper = 2048
    f, t, Z = stft(seg.T, fs=SR, nperseg=nper, noverlap=nper * 3 // 4, boundary="even", padded=True)
    p = np.clip((t - pre / SR) / seconds, 0, 1)
    fc = f0 * (f1 / f0) ** (p ** 1.5)
    fs = np.maximum(f, 1e-3)[:, None]
    g = 1 / np.sqrt(1 + (fc[None, :] / fs) ** 8)  # 4th-order-like HP per frame
    _, y = istft(Z * g[None, :, :], fs=SR, nperseg=nper, noverlap=nper * 3 // 4, boundary=True)
    y = y.T[: len(seg)]
    # blend in over the pre-roll so the processed and dry signals meet without a step
    w = np.clip(np.arange(len(seg)) / max(1, pre), 0, 1)[:, None]
    x[-(n + pre):] = seg * (1 - w) + y * w
    return x


def smooth(x, k):
    """centred moving average of length k (edge-padded), O(n)"""
    if k < 2 or len(x) < 2:
        return x
    p = np.pad(x, (k // 2, k - k // 2), mode="edge")
    c = np.cumsum(p, dtype=np.float64)
    return (c[k:] - c[:-k])[: len(x)] / k


def render_plan(plan, n):
    segs = plan["segments"]
    X = float(plan.get("transitionSeconds", 2.5))
    bed = np.zeros((n, 2))
    level = np.zeros(n)
    depth = np.zeros(n)
    info = []
    tail = int(0.08 * SR)
    fin = int(0.12 * SR)
    for k, s in enumerate(segs):
        a = int(round(s["start"] * SR))
        b = min(n, int(round(s["end"] * SR)))
        if b <= a:
            continue
        last = k == len(segs) - 1
        m = (b - a) + (0 if last else tail)
        if s.get("source") == "library" and s.get("track"):
            y, loops = track_audio(s["track"], m)
        else:
            y, loops = procedural_audio(s.get("preset", "ambient"), m, int(s.get("seed", 7))), 0
        y = eq_carve(y)
        skip = int(min(1.0, (b - a) / SR / 4) * SR)
        body = y[skip: max(skip + 1, b - a)]
        g = 10 ** ((TARGET_RMS_DB - k_rms_db(body)) / 20)
        y = y * g
        # entry: 0.12 s fade-in on the cut (0.6 s at the very start of the video)
        nf = int(0.6 * SR) if k == 0 else fin
        y[:nf] *= np.sin(0.5 * math.pi * np.linspace(0, 1, nf))[:, None] ** 2
        if not last:
            core = y[: b - a]
            bass_dropout(core, min(X, (b - a) / SR * 0.5))
            y[: b - a] = core
            y[b - a:] *= np.cos(0.5 * math.pi * np.linspace(0, 1, len(y) - (b - a)))[:, None]
        seg_out = bed[a:a + len(y)]
        seg_out += y[: len(seg_out)]
        level[a:b] = s.get("levelDb", -12.0)
        depth[a:b] = s.get("duckDb", -10.0)
        info.append({"i": k, "start": s["start"], "end": s["end"], "source": s.get("source"), "id": (s.get("track") or {}).get("id") or s.get("preset"), "loops": loops, "gainDb": round(20 * math.log10(g + 1e-12), 1)})
    if len(segs) and n > 0:
        level[int(round(segs[-1]["end"] * SR)):] = segs[-1].get("levelDb", -12.0)
        depth[int(round(segs[-1]["end"] * SR)):] = segs[-1].get("duckDb", -10.0)
    # smooth the per-segment level steps (the bed itself switches at the cut; levels glide over 0.3 s)
    level, depth = smooth(level, int(0.3 * SR)), smooth(depth, int(0.3 * SR))
    t = np.arange(n) / SR
    T = n / SR
    fade = np.where(t > T - 2.5, np.cos(0.5 * math.pi * np.clip((t - (T - 2.5)) / 2.5, 0, 1)) ** 2, 1.0)
    bed *= fade[:, None]
    return bed, level, depth, {"segments": info, "transitions": plan.get("transitions", [])}
