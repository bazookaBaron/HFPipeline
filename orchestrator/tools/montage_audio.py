"""
Cold-open montage audio (lib/longform/montage.js, long-form v2 plan section 2).

    python montage_audio.py plan.json out.wav [--sfx-dir video-engine/assets/sfx]
        -> stdout: one JSON line of stats

48 kHz stereo float mix of:
  * the trailer bed: the plan's library track from its chosen phrase start (plan.music.start, so the cut
    grid = the track's beats), or -- when the library has no trailer -- a seeded procedural trailer at the
    plan's BPM (sub-bass pulse on every beat, kick + low boom on downbeats, dark drone, 8th-note ticks in the
    beat run); deterministic for a given seed;
  * the narrator lines at their plan times;
  * SFX on the cuts: whoosh (video-engine/assets/sfx/whoosh.wav, its peak aligned to the cut), synthesised
    impacts / hits (sine sweep boom + noise transient) and a noise riser into the anchor.
Levels (K-weighted, relative to the voice): bed -4 dB under the voice where lines are spoken, -1 dB in the
beat run (no voice there), then the BASS DROP: from plan.dropAt the bed loses its low end (rising high-pass,
music_switch.bass_dropout) and fades to silence at the end, so the cut into the cold-open chapter lands dry.
The caller normalises the result (montage.js: cold-open chapter loudness + 1 LU) and the master stage takes
the whole video to -14 LUFS.
"""
import json
import math
import os
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import music_switch as MS  # noqa: E402

SR = MS.SR


def db(x):
    return 10 ** (x / 20.0)


def place(dst, clip, at):
    a = int(round(at * SR))
    if a < 0:
        clip = clip[-a:]
        a = 0
    b = min(len(dst), a + len(clip))
    if b > a:
        dst[a:b] += clip[: b - a]


def stereo(m):
    return np.stack([m, m], axis=1)


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


# ------------------------------------------------------------------ synthesised sfx

def impact(rng, big=True):
    """low boom (sweep 95 -> 36 Hz) + short noise transient + body thud"""
    dur = 1.6 if big else 0.55
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 36 + (95 - 36) * np.exp(-t / 0.09)
    ph = 2 * math.pi * np.cumsum(f) / SR
    boom = np.sin(ph) * env_exp(n, 0.45 if big else 0.16)
    nz = rng.standard_normal(n) * env_exp(n, 0.018)
    # one-pole low-pass on the noise (darker transient)
    y = np.zeros(n)
    acc = 0.0
    k = 0.18
    for i in range(min(n, int(0.12 * SR))):
        acc += k * (nz[i] - acc)
        y[i] = acc
    thud = np.sin(2 * math.pi * 140 * t) * env_exp(n, 0.035)
    m = 1.0 * boom + 0.9 * y + 0.35 * thud
    m[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return stereo(m / (np.max(np.abs(m)) + 1e-9))


def riser(rng, seconds):
    """band-limited noise whose centre and level rise, ending dead on the anchor cut"""
    n = max(int(seconds * SR), 1)
    x = rng.standard_normal(n + 4096)
    nfft = 1 << int(math.ceil(math.log2(len(x))))
    X = np.fft.rfft(x, nfft)
    f = np.fft.rfftfreq(nfft, 1 / SR)
    # static band 300 Hz - 9 kHz; the "rise" is the level ramp plus a growing high-shelf mix
    X *= (f > 300) * (f < 9000)
    y = np.fft.irfft(X, nfft)[:n]
    hi = np.diff(y, prepend=0) * 3.0
    p = np.linspace(0, 1, n)
    m = (y * (1 - p) + hi * p) * (p ** 2.2)
    m[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))
    return stereo(m / (np.max(np.abs(m)) + 1e-9))


def whoosh(sfx_dir, rng):
    p = os.path.join(sfx_dir or "", "whoosh.wav")
    if sfx_dir and os.path.exists(p):
        x = MS.decode(p)
        return x / (np.max(np.abs(x)) + 1e-9)
    n = int(0.35 * SR)
    nz = rng.standard_normal(n)
    e = np.sin(math.pi * np.linspace(0, 1, n)) ** 2
    return stereo(nz * e * 0.5)


def peak_offset(x):
    e = np.abs(x).mean(axis=1)
    k = int(0.01 * SR)
    if len(e) > k:
        e = np.convolve(e, np.ones(k) / k, mode="same")
    return int(np.argmax(e))


# ------------------------------------------------------------------ procedural trailer bed

def procedural_trailer(n, bpm, seed, run):
    rng = np.random.default_rng(seed)
    t = np.arange(n) / SR
    beat = 60.0 / bpm
    out = np.zeros(n)
    # dark drone: stacked detuned saws around D1/A1, low-passed by averaging
    drone = np.zeros(n)
    for f0, g in ((36.7, 1.0), (55.0, 0.6), (73.4, 0.35), (110.0, 0.12)):
        for det in (-0.3, 0.3):
            ph = rng.uniform(0, 1)
            drone += g * (2 * (((f0 + det) * t + ph) % 1.0) - 1)
    k = 64
    drone = np.convolve(drone, np.ones(k) / k, mode="same")
    swell = 0.6 + 0.4 * np.sin(2 * math.pi * t / (beat * 8)) ** 2
    out += 0.16 * drone * swell
    # sub pulse on every beat, boom on downbeats
    nb = int(n / (beat * SR)) + 1
    pulse_n = int(0.45 * SR)
    tp = np.arange(pulse_n) / SR
    sub = np.sin(2 * math.pi * 42 * tp) * np.exp(-tp / 0.16)
    kick_f = 40 + 90 * np.exp(-tp / 0.03)
    kick = np.sin(2 * math.pi * np.cumsum(kick_f) / SR) * np.exp(-tp / 0.12)
    for b in range(nb):
        a = int(b * beat * SR)
        e = min(n, a + pulse_n)
        if e <= a:
            break
        out[a:e] += 0.55 * sub[: e - a]
        if b % 4 == 0:
            out[a:e] += 0.9 * kick[: e - a]
    # 8th-note ticks inside the beat run
    tick_n = int(0.03 * SR)
    tick = rng.standard_normal(tick_n) * np.exp(-np.arange(tick_n) / (0.006 * SR))
    tick = np.diff(tick, prepend=0)
    if run:
        r0, r1 = run
        tt = r0
        while tt < r1:
            a = int(tt * SR)
            e = min(n, a + tick_n)
            out[a:e] += 0.18 * tick[: e - a]
            tt += beat / 2
    return stereo(out / (np.max(np.abs(out)) + 1e-9))


# ------------------------------------------------------------------ main

def read_voice(path):
    x = MS.decode(path)  # 48 kHz stereo float
    return x


def write_wav(path, x):
    y = np.clip(x, -1, 1)
    pcm = (y * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    plan_path, out = sys.argv[1], sys.argv[2]
    sfx_dir = sys.argv[sys.argv.index("--sfx-dir") + 1] if "--sfx-dir" in sys.argv else None
    plan = json.load(open(plan_path, encoding="utf-8"))
    D = float(plan["duration"])
    n = int(round(D * SR))
    music = plan.get("music") or {"source": "procedural", "bpm": 96, "seed": 7}
    seed = int(music.get("seed", 7))
    rng = np.random.default_rng(seed)
    sec = plan.get("sections", {})
    run = sec.get("run")

    # voice
    voice = np.zeros((n, 2))
    clips = []
    for v in plan.get("voice", []):
        c = read_voice(v["file"])
        clips.append(c)
        place(voice, c, float(v["at"]))
    lv = MS.k_rms_db(np.concatenate(clips)) if clips else -24.0
    vpeak = float(np.max(np.abs(voice))) if clips else 0.5

    # bed
    if music.get("source") == "library" and music.get("path"):
        x = MS.decode(music["path"])
        i0 = int(float(music.get("start", 0)) * SR)
        bed = x[i0:i0 + n].copy()
        if len(bed) < n:
            bed = np.concatenate([bed, np.zeros((n - len(bed), 2))])
    else:
        bed = procedural_trailer(n, float(music.get("bpm", 96)), seed, run)
    body = bed[: max(1, int((plan.get("dropAt") or D) * SR))]
    lb = MS.k_rms_db(body)
    # level curve: -4 dB under the voice, -1 dB in the run (no voice), smoothed 150 ms
    lvl = np.full(n, -4.0)
    if run:
        a, b = int(run[0] * SR), int(run[1] * SR)
        lvl[a:b] = -1.0
    lvl = MS.smooth(lvl, int(0.15 * SR))
    g = db(lv - lb + lvl)
    bed = bed * g[:, None]
    # bass drop: high-pass sweep from dropAt to the end, then fade to silence
    drop_at = float(plan.get("dropAt") or (D - 1.3))
    drop_n = n - int(drop_at * SR)
    if drop_n > SR // 5:
        MS.bass_dropout(bed, drop_n / SR, f0=30.0, f1=900.0)
        tail = np.cos(0.5 * math.pi * np.linspace(0, 1, drop_n)) ** 1.5
        bed[-drop_n:] *= tail[:, None]

    # sfx: level relative to the voice (K RMS over the event's own body)
    fx = np.zeros((n, 2))
    wh = whoosh(sfx_dir, rng)
    wh_peak = peak_offset(wh)
    big = impact(rng, True)
    small = impact(rng, False)

    def level(clip, rel_db, extra=0.0):
        e = MS.k_rms_db(np.concatenate([clip, np.zeros((max(0, SR // 2 - len(clip)), 2))]))
        return clip * db(lv + rel_db + extra - e)

    counts = {}
    for s in plan.get("sfx", []):
        kind, t, gdb = s["kind"], float(s["t"]), float(s.get("gainDb", -6))
        counts[kind] = counts.get(kind, 0) + 1
        if t >= D:
            continue
        if kind == "whoosh":
            place(fx, level(wh, gdb), t - wh_peak / SR)
        elif kind == "impact":
            place(fx, big * vpeak * db(gdb - 1.0), t - 0.002)
        elif kind == "hit":
            place(fx, small * vpeak * db(gdb), t - 0.002)
        elif kind == "riser":
            until = float(s.get("until", t + 1.0))
            rz = riser(rng, max(0.2, until - t))
            place(fx, level(rz, gdb), t)
    mix = voice + bed + fx
    peak = float(np.max(np.abs(mix)) + 1e-12)
    if peak > 0.97:
        mix *= 0.97 / peak
    write_wav(out, mix)
    print(json.dumps({"duration": round(D, 3), "voiceKdb": round(lv, 2), "bedKdb": round(lb, 2), "bedGainDb": round(lv - lb - 4, 2), "music": music.get("source"), "sfx": counts, "peak": round(peak, 3), "dropAt": drop_at}))


if __name__ == "__main__":
    main()
