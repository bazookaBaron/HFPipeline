"""
Optional background music bed for v3 videos -- synthesized here (numpy only, seeded, deterministic),
so it is rights-clean: no downloaded loops, samples or presets.

  python music_bed.py <preset> <seconds> out.wav [--seed n]      # audition a bed on its own

Presets (soft modern tech-explainer beds, 48 kHz stereo, mono-compatible):
  lofi     90 bpm  Fmaj7-Em7-Dm7-Cmaj7, warm detuned pad, muted pluck arp, soft kick + swung hat, tape wow
  ambient  84 bpm  Cmaj9-Am9-Fmaj9-G6sus (2 bars each), wide slow pad, sparse bell pluck, no drums
  pulse    96 bpm  Am7-Fmaj7-Cmaj7-G6, soft four-on-the-floor, 8th arp, deeper sidechain pump

render(preset, n_samples, seed) returns an (n, 2) float array at RMS ~ -20 dBFS with a 1.5 s fade-in and a
musical ending (drums and arp stop, the tonic chord rings and fades over the last 2 s). The high end is
rolled off above ~7 kHz and the 1.5-4 kHz voice band is carved by ~3 dB so the narration sits on top.
"""
import math
import sys
import wave

import numpy as np

SR = 48000
TAB_N = 16384  # power of two (index wrap by mask)

PRESETS = {
    "lofi": {
        "bpm": 90, "bars_per_chord": 1, "swing": 0.58,
        "prog": [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
        "bass": [41, 40, 38, 36], "tonic": 3,
        "pad": {"fc": 1500, "bright": 1.7, "saw": 0.55, "detune": (-9, 0, 8), "attack": 0.7, "release": 1.3, "level": 1.0},
        "wow_cents": 5.0,
        "bass_pattern": [(0, 1.4), (2.5, 1.2)], "bass_level": 0.33,
        "arp": {"steps": 8, "order": [0, 2, 1, 3, 2, 1, 3, 2], "density": 0.62, "tau": 0.16, "oct": 12, "level": 0.36},
        "kick": [0, 2.5], "kick_level": 0.45, "hat": [0.5, 1.5, 2.5, 3.5], "hat_level": 0.11,
        "pump": 0.32, "pump_beats": [0, 1, 2, 3], "reverb": 0.22,
    },
    "ambient": {
        "bpm": 84, "bars_per_chord": 2, "swing": 0.5,
        "prog": [[48, 55, 59, 62, 64], [45, 52, 55, 59, 60], [53, 57, 60, 64, 67], [50, 55, 57, 62, 64]],
        "bass": [36, 33, 41, 43], "tonic": 0,
        "pad": {"fc": 1250, "bright": 1.6, "saw": 0.45, "detune": (-11, -3, 4, 10), "attack": 1.6, "release": 2.2, "level": 1.0},
        "wow_cents": 2.0,
        "bass_pattern": [(0, 7.8)], "bass_level": 0.28,
        "arp": {"steps": 4, "order": [3, 1, 2, 0], "density": 0.45, "tau": 0.45, "oct": 12, "level": 0.28},
        "kick": [], "kick_level": 0.0, "hat": [], "hat_level": 0.0,
        "pump": 0.10, "pump_beats": [0, 2], "reverb": 0.34,
    },
    "pulse": {
        "bpm": 96, "bars_per_chord": 1, "swing": 0.5,
        "prog": [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 60, 64], [55, 59, 62, 64]],
        "bass": [45, 41, 36, 43], "tonic": 0,
        "pad": {"fc": 1700, "bright": 1.8, "saw": 0.6, "detune": (-8, 0, 7), "attack": 0.45, "release": 1.0, "level": 1.0},
        "wow_cents": 0.0,
        "bass_pattern": [(0.5, 0.4), (1.5, 0.4), (2.5, 0.4), (3.5, 0.4)], "bass_level": 0.3,
        "arp": {"steps": 8, "order": [0, 1, 2, 3, 2, 1, 2, 3], "density": 0.8, "tau": 0.12, "oct": 12, "level": 0.34},
        "kick": [0, 1, 2, 3], "kick_level": 0.42, "hat": [0.5, 1.5, 2.5, 3.5], "hat_level": 0.1,
        "pump": 0.45, "pump_beats": [0, 1, 2, 3], "reverb": 0.2,
    },
}


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def pan_gains(p):
    """constant-power pan, p in [-1, 1]; plain gains only (no phase tricks) so the mono sum is safe"""
    a = (p + 1) * math.pi / 4
    return math.cos(a), math.sin(a)


def fft_filter(x, mag_fn):
    """zero-phase filter by a magnitude response (function of Hz); x is (n,) or (n, c)"""
    n = x.shape[0]
    nfft = 1 << int(math.ceil(math.log2(n + SR // 2)))
    f = np.fft.rfftfreq(nfft, 1 / SR)
    h = mag_fn(f)
    X = np.fft.rfft(x, nfft, axis=0)
    X *= h[:, None] if x.ndim == 2 else h
    return np.fft.irfft(X, nfft, axis=0)[:n]


def lp(f, fc, order=2):
    return 1 / np.sqrt(1 + (f / fc) ** (2 * order))


def hp(f, fc, order=2):
    r = (np.maximum(f, 1e-6) / fc) ** (2 * order)
    return np.sqrt(r / (1 + r))


def bell_db(f, f0, db, octaves):
    return 10 ** (db * np.exp(-0.5 * (np.log2(np.maximum(f, 1) / f0) / (octaves / 2)) ** 2) / 20)


_tabs = {}


def wavetable(midi, fc, saw):
    """band-limited single cycle: saw/sine blend through a soft 4th-order low-pass at fc"""
    key = (midi, round(fc), saw)
    if key not in _tabs:
        f0 = mtof(midi)
        kmax = max(1, int(min(48, 7500 / f0)))
        k = np.arange(1, kmax + 1)
        a = saw / k + (1 - saw) * (k == 1)
        a = a / np.sqrt(1 + (k * f0 / fc) ** 4)
        ph = 2 * math.pi * np.arange(TAB_N) / TAB_N
        tab = (a[:, None] * np.sin(k[:, None] * ph[None, :])).sum(0)
        _tabs[key] = tab / np.max(np.abs(tab))
    return _tabs[key]


def osc_index(f_inst, phase0, sr=SR):
    """table indices for an instantaneous-frequency array (TAB_N is large, so nearest lookup is clean)"""
    ph = np.cumsum(f_inst * (TAB_N / sr)) + phase0 * TAB_N
    return ph.astype(np.int64) & (TAB_N - 1)


def raised(t, dur):
    return 0.5 - 0.5 * np.cos(math.pi * np.clip(t / max(dur, 1e-4), 0, 1))


def add(buf, start, y):
    """add a mono (m,) or stereo (m, 2) event into buf at sample start (clipped to the buffer)"""
    if start >= len(buf):
        return
    if start < 0:
        y = y[-start:]
        start = 0
    m = min(len(y), len(buf) - start)
    if y.ndim == 1:
        buf[start:start + m] += y[:m, None]
    else:
        buf[start:start + m] += y[:m]


PAD_SR = SR // 2  # pads are band-limited to ~7.5 kHz: render at half rate, upsample once (FFT, exact)


def pad_chord(buf, t0, dur, notes, P, r, wow_fn):
    """buf is at PAD_SR"""
    pd = P["pad"]
    rel = pd["release"]
    n = int((dur + rel) * PAD_SR)
    t = np.arange(n) / PAD_SR
    env = raised(t, pd["attack"]) * (1 - 0.12 * np.clip(t / max(dur, 0.1), 0, 1))
    env = np.where(t > dur, env * (0.5 + 0.5 * np.cos(math.pi * np.clip((t - dur) / rel, 0, 1))), env)
    # filter swell: brightness opens with the attack, then settles darker
    w = np.clip(t / (pd["attack"] * 1.5), 0, 1) * (1 - 0.45 * np.clip(t / (dur + rel), 0, 1))
    wow = wow_fn(t0 + t)
    nv = len(pd["detune"])
    pans = np.linspace(-0.5, 0.5, nv) if nv > 1 else [0.0]
    y = np.zeros((n, 2))
    for ni, m in enumerate(notes):
        dark = wavetable(m, pd["fc"], pd["saw"])
        diff = wavetable(m, pd["fc"] * pd["bright"], pd["saw"]) - dark
        for vi, cents in enumerate(pd["detune"]):
            rate = 0.18 + 0.35 * r.random()
            lfo = 3.5 * np.sin(2 * math.pi * rate * (t0 + t) + r.random() * 6.283)
            f = mtof(m) * (1 + (cents + lfo + wow) * (math.log(2) / 1200))  # cents are tiny: linear is exact enough
            idx = osc_index(f, r.random(), PAD_SR)
            s = dark[idx] + w * diff[idx]
            gl, gr = pan_gains(pans[vi] * (1 if ni % 2 == 0 else -1))
            y[:, 0] += s * gl
            y[:, 1] += s * gr
    y *= (env * pd["level"] / (len(notes) * nv) ** 0.5 * 0.9)[:, None]
    add(buf, int(t0 * PAD_SR), y)


def upsample2(x, n):
    """(m, 2) at SR/2 -> (n, 2) at SR by spectral zero-padding"""
    M = 1 << int(math.ceil(math.log2(x.shape[0])))  # power-of-two FFT (fades hide the circular edge)
    X = np.fft.rfft(x, M, axis=0)
    Y = np.zeros((M + 1, 2), dtype=complex)
    Y[: len(X)] = X
    return np.fft.irfft(Y, 2 * M, axis=0)[:n] * 2


def bass_note(buf, t0, dur, midi, level):
    n = int((dur + 0.25) * SR)
    t = np.arange(n) / SR
    f = mtof(midi)
    env = raised(t, 0.025) * np.exp(-t / 1.6)
    env = np.where(t > dur, env * np.exp(-(t - dur) / 0.07), env)
    y = (np.sin(2 * math.pi * f * t) + 0.22 * np.sin(4 * math.pi * f * t) + 0.06 * np.sin(6 * math.pi * f * t)) * env
    add(buf, int(t0 * SR), y * level)


def pluck(f, tau, vel):
    n = int(tau * 6 * SR)
    t = np.arange(n) / SR
    a = raised(t, 0.004)
    y = np.sin(2 * math.pi * f * t) * np.exp(-t / tau)
    y += 0.30 * np.sin(4 * math.pi * f * t) * np.exp(-t / (tau * 0.45))
    y += 0.10 * np.sin(6 * math.pi * f * t) * np.exp(-t / (tau * 0.25))
    return y * a * vel


def kick():
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 47 + 68 * np.exp(-t / 0.032)
    y = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2) * raised(t, 0.003)
    return np.tanh(1.4 * y) / math.tanh(1.4)


def hat(r):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    y = fft_filter(r.standard_normal(n), lambda f: hp(f, 5200, 2) * lp(f, 9000, 3))
    return y * np.exp(-t / 0.018) * raised(t, 0.001) / (np.max(np.abs(y)) or 1)


def reverb(send, r, seconds=2.4, decay=0.5):
    """convolution with a seeded, decorrelated L/R noise tail (dark, smooth) -- equal energy both sides"""
    m = int(seconds * SR)
    t = np.arange(m) / SR
    ir = r.standard_normal((m, 2)) * np.exp(-t / decay)[:, None] * raised(t, 0.012)[:, None]
    ir = fft_filter(ir, lambda f: lp(f, 4200, 2) * hp(f, 180, 1))
    ir[: int(0.02 * SR)] = 0  # pre-delay
    ir /= np.sqrt((ir ** 2).sum(0, keepdims=True))
    n = len(send)
    nfft = 1 << int(math.ceil(math.log2(n + m)))
    S = np.fft.rfft(send, nfft)
    out = np.stack([np.fft.irfft(S * np.fft.rfft(ir[:, c], nfft), nfft)[:n] for c in range(2)], axis=1)
    return out


def render(preset, n, seed=7):
    if preset not in PRESETS:
        raise ValueError(f"unknown music preset {preset!r} (have {', '.join(PRESETS)})")
    P = PRESETS[preset]
    r = np.random.default_rng(5000 + seed)
    T = n / SR
    beat = 60 / P["bpm"]
    bar = 4 * beat
    clen = P["bars_per_chord"] * bar
    # the ending: drums/arp stop and the tonic chord rings from the last beat before T - 2.6 s
    hold = max(0.0, math.floor(max(0.0, T - 2.6) / beat) * beat)
    wow_c = P["wow_cents"]
    wow_fn = (lambda tt: wow_c * np.sin(2 * math.pi * 0.42 * tt) + 0.4 * wow_c * np.sin(2 * math.pi * 1.3 * tt + 1.0)) if wow_c else (lambda tt: 0.0)

    pad = np.zeros((n // 2 + 1, 2))
    bass = np.zeros((n, 2))
    arp = np.zeros((n, 2))
    drums = np.zeros((n, 2))
    pump = np.ones(n)

    ci = 0
    t0 = 0.0
    chords = []
    while t0 < hold - 0.05:
        chords.append((t0, min(clen, hold - t0), ci % len(P["prog"])))
        t0 += clen
        ci += 1
    chords.append((hold, T - hold + 0.2, P["tonic"]))
    for (c0, cdur, k) in chords:
        pad_chord(pad, c0, cdur, P["prog"][k], P, r, wow_fn)
        final = c0 >= hold
        for (bt, bl) in P["bass_pattern"]:
            tb = c0 + bt * beat
            while tb < c0 + cdur - 1e-6 and (final or tb < hold):
                bass_note(bass, tb, min(bl * beat, c0 + cdur - tb) if not final else max(bl * beat, T - tb), P["bass"][k], P["bass_level"])
                if final:
                    break
                tb += bar
        if final:
            continue
        a = P["arp"]
        step = bar / a["steps"]
        notes = P["prog"][k]
        s = 0
        ts = c0
        while ts < c0 + cdur - 1e-6 and ts < hold:
            if r.random() < a["density"]:
                m = notes[a["order"][s % len(a["order"])] % len(notes)] + a["oct"]
                sw = (P["swing"] - 0.5) * 2 * step if (s % 2 == 1 and a["steps"] >= 8) else 0.0
                y = pluck(mtof(m), a["tau"], 0.7 + 0.3 * r.random()) * a["level"]
                gl, gr = pan_gains(0.28 if s % 2 else -0.28)
                add(arp, int((ts + sw) * SR), np.stack([y * gl, y * gr], axis=1))
            s += 1
            ts += step

    # drums + sidechain pump, per bar until the ending
    K = kick()
    hats = [hat(r) for _ in range(4)]
    pump_len = int(0.42 * SR)
    pt = np.arange(pump_len) / SR
    duck = P["pump"] * np.minimum(1, pt / 0.006) * np.exp(-pt / 0.14)
    b0 = 0.0
    hi = 0
    while b0 < hold - 1e-6:
        for kb in P["kick"]:
            tk = b0 + kb * beat
            if tk < hold:
                add(drums, int(tk * SR), K * P["kick_level"])
        for pb in P["pump_beats"]:
            tk = b0 + pb * beat
            if tk < hold:
                i = int(tk * SR)
                seg = pump[i:i + pump_len]
                seg *= 1 - duck[: len(seg)]
        for hb in P["hat"]:
            th = b0 + hb * beat + ((P["swing"] - 0.5) * beat if P["swing"] > 0.5 else 0)
            if th < hold:
                add(drums, int(th * SR), hats[hi % 4] * P["hat_level"] * (0.65 + 0.35 * r.random()))
                hi += 1
        b0 += bar

    pad = upsample2(pad, n)
    tonal = (pad + bass + arp) * pump[:, None]
    wet = reverb(tonal[:, 0] * 0.5 + tonal[:, 1] * 0.5, r)
    mix = tonal + drums + P["reverb"] * wet * 1.2
    # tone: sub cleanup, smooth top (nothing hissy above ~7 kHz), gentle voice-band carve
    mix = fft_filter(mix, lambda f: hp(f, 38, 2) * lp(f, 7000, 2) * bell_db(f, 2600, -3.0, 1.6) * bell_db(f, 220, -1.5, 1.2))
    rms = math.sqrt(float(np.mean(mix[int(min(2.0, T / 3) * SR): max(int(min(2.0, T / 3) * SR) + 1, int(hold * SR))] ** 2)) or 1e-9)
    mix *= 10 ** (-20 / 20) / rms
    t = np.arange(n) / SR
    fade = raised(t, 1.5) * np.where(t > T - 2.0, np.cos(0.5 * math.pi * np.clip((t - (T - 2.0)) / 2.0, 0, 1)) ** 2, 1.0)
    return mix * fade[:, None]


def mono_loss_db(x):
    """loudness drop of the mono fold-down vs the stereo mean (0 = perfectly mono-safe)"""
    st = np.mean(x ** 2)
    mo = np.mean(((x[:, 0] + x[:, 1]) / 2) ** 2)
    return 10 * math.log10(max(mo, 1e-12) / max(st, 1e-12))


def write_wav(p, x):
    x = np.clip(x, -1, 1)
    with wave.open(str(p), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())


if __name__ == "__main__":
    preset, secs, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    seed = int(sys.argv[sys.argv.index("--seed") + 1]) if "--seed" in sys.argv else 7
    y = render(preset, int(secs * SR), seed)
    write_wav(out, y)
    print({"preset": preset, "seconds": secs, "peak": round(float(np.max(np.abs(y))), 3), "monoLossDb": round(mono_loss_db(y), 2)})
