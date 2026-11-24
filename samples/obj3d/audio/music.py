"""MINIATURE music bed: one continuous, soft ambient bed under the whole film, made the way the dialogue pipeline makes its
music (dialogue/fish/mix*.py procedural pad engine + dialogue/STYLE-GUIDE.md section 7): pads and a drone (90-180 Hz), soft
mallet notes (400-900 Hz), a quiet high sine shimmer and a sub bass, with a carved 0.8-2.5 kHz dip so the narrator sits on top.
No downloaded files: the bed is synthesised from the film's own chapter moods (0 tokens, nothing licensed, nothing to credit).

Picking (like dialogue): the mood of each chapter comes from the script's emotion tags (auto) or from sound.json:
    "music": {"moods": "auto" | ["investigative", "tense", ...one per #ch chapter], "under": 18, "lift": 3}
Moods: investigative, tense, heavy, warm, hopeful, nostalgic. The chord changes on bar lines; moods crossfade over 3 s at a chapter.
Ducking (like dialogue): the bed rides `under` dB below the voice while it speaks and lifts `lift` dB in pauses (no hard
sidechain, ~0.35 s attack / 0.9 s release). It is never silent until the final fade.
Used by audio/mix.py (opt-in: a "music" key in sound.json); `python -I music.py <film>` writes films/<film>/music_preview.wav.
"""
import re
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve, filtfilt

SR = 48000
mid = lambda m: 440 * 2 ** ((m - 69) / 12)
# mood -> bpm, chord loop (root midi, chord intervals), mallet notes per bar, brightness (pad low-pass Hz)
MOODS = {
    "investigative": (72, [(52, [0, 7, 12, 15]), (48, [0, 7, 12, 16]), (45, [0, 7, 12, 15]), (47, [0, 7, 10, 15])], 3.0, 1700),   # Em C Am Bsus
    "tense":         (66, [(50, [0, 7, 12, 15]), (46, [0, 7, 12, 16]), (50, [0, 7, 13, 15]), (45, [0, 7, 12, 16])], 1.6, 1300),   # Dm Bb Dm(b9) A
    "heavy":         (60, [(48, [0, 7, 12, 15]), (44, [0, 7, 12, 16]), (51, [0, 7, 12, 16]), (46, [0, 7, 12, 16])], 1.2, 1100),   # Cm Ab Eb Bb
    "warm":          (76, [(48, [0, 7, 12, 16]), (45, [0, 7, 12, 15]), (53, [0, 7, 12, 16]), (55, [0, 7, 12, 16])], 3.5, 2000),   # C Am F G
    "hopeful":       (80, [(53, [0, 7, 12, 16]), (48, [0, 7, 12, 16]), (50, [0, 7, 12, 15]), (46, [0, 7, 12, 16])], 4.0, 2200),   # F C Dm Bb
    "nostalgic":     (66, [(57, [0, 7, 12, 15]), (53, [0, 7, 12, 16]), (48, [0, 7, 12, 16]), (55, [0, 7, 12, 16])], 2.4, 1800),   # Am F C G (dialogue)
}
TAGS = [("heavy", r"dark|grim|heavy|low\b"), ("tense", r"tense|serious|urgent|alarm"), ("hopeful", r"hope|build|bright|uplift"),
        ("nostalgic", r"quiet|final|reflect|soft"), ("warm", r"light|amused|warm|playful"), ("investigative", r"explain|curious|matter|dry|story|count")]


def movavg(x, n):
    """centred moving average via cumulative sum (np.convolve is O(N*n): minutes at film length)"""
    n = max(1, int(n)); c = np.cumsum(np.concatenate([[0.0], x.astype(np.float64)])); h = n // 2
    i0 = np.clip(np.arange(len(x)) - h, 0, len(x)); i1 = np.clip(np.arange(len(x)) - h + n, 0, len(x))
    return ((c[i1] - c[i0]) / np.maximum(1, i1 - i0)).astype(np.float32)


def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], "band", fs=SR, output="sos"), x)


def auto_moods(script_text):
    """one mood per #ch chapter from the emotion tags of its NARR lines (most frequent mapped tag wins)"""
    out, cur = [], None
    for l in script_text.split("#end")[0].splitlines():
        s = l.strip()
        if s.startswith("#ch"):
            if cur is not None: out.append(cur)
            cur = {}
            continue
        m = re.match(r"NARR \(([^)]*)\)", s)
        if m and cur is not None:
            for mood, rx in TAGS:
                if re.search(rx, m[1]): cur[mood] = cur.get(mood, 0) + (1 if mood == "investigative" else 2.5); break   # emotional tags are rarer and stronger than neutral ones
    if cur is not None: out.append(cur)
    return [max(c, key=c.get) if c else "investigative" for c in out]


def render_mood(mood, n, seed):
    """one mood's bed, n samples, unit-ish level"""
    bpm, chords, dens, bright = MOODS[mood]; rng = np.random.default_rng(seed)
    bar = 4 * 60 / bpm; T = n / SR; nb = int(np.ceil(T / bar)) + 1
    pad = np.zeros(n, np.float32); sub = np.zeros(n, np.float32); mal = np.zeros(n, np.float32); shim = np.zeros(n, np.float32)
    for b in range(nb):
        root, iv = chords[b % len(chords)]; s0 = int(b * bar * SR)
        if s0 >= n: break
        ln = int((bar + 1.8) * SR); tt = np.arange(ln) / SR
        env = np.minimum(tt / 1.5, 1) * np.clip((bar + 1.8 - tt) / 1.8, 0, 1); e = min(n, s0 + ln); k = e - s0
        for j, i in enumerate(iv):                       # pad voicing in 90-360 Hz
            fr = mid(root + i - 12 * (j == 0))
            while fr < 90: fr *= 2
            for dt in (-0.8, 0, 0.8):
                w = np.sin(2 * np.pi * (fr + dt * 0.35) * tt) + 0.22 * np.sin(2 * np.pi * 2 * fr * tt + 0.3)
                pad[s0:e] += (w * env * 0.045)[:k]
        fr = mid(root)                                   # sub bass: root folded to 40-80 Hz
        while fr > 80: fr /= 2
        sub[s0:e] += (np.sin(2 * np.pi * fr * tt) * env * 0.09)[:k]
        sh = mid(root + iv[-1] + 36)                     # shimmer: top chord tone, 3 octaves up, slow tremolo
        while sh > 3600: sh /= 2
        shim[s0:e] += (np.sin(2 * np.pi * sh * tt) * env * (0.5 + 0.5 * np.sin(2 * np.pi * 0.23 * tt)) * 0.004)[:k]
        steps = 8; pnote = dens / steps                  # mallets: chord tones in 400-900 Hz, sparse
        for st in range(steps):
            if rng.random() > pnote: continue
            m = root + rng.choice(iv)
            fr = mid(m)
            while fr < 400: fr *= 2
            while fr > 900: fr /= 2
            a = int((b * bar + st * bar / steps) * SR + rng.integers(0, 300))
            L = int(2.4 * SR); u = np.arange(L) / SR
            note = (np.sin(2 * np.pi * fr * u) + 0.18 * np.sin(2 * np.pi * 2.76 * fr * u) * np.exp(-u / 0.12)) * np.minimum(u / 0.006, 1) * np.exp(-u / 0.9)
            ee = min(n, a + L)
            if a < n: mal[a:ee] += (note * rng.uniform(0.05, 0.08))[:ee - a]
    pad = lp(pad, bright)
    ir = (rng.standard_normal(int(2.4 * SR)) * np.exp(-np.arange(int(2.4 * SR)) / SR / 0.8)).astype(np.float32); ir = lp(ir, 3200, 1)
    mal = mal + fftconvolve(mal, ir)[:n] * 0.018
    x = pad + lp(sub, 120) + mal + shim
    x = hp(x, 32)
    x = x - 0.5 * bp(x, 800, 2500)                       # carved 0.8-2.5 kHz dip (about -6 dB) for the voice
    return x.astype(np.float32)


def bed(N, voice, sections, under=18.0, lift=3.0, fade_in=3.0, fade_out=4.0):
    """N samples; voice = mono float voice track (same N); sections = [(t0, t1, mood)]. Returns stereo (N,2) at the right level
    relative to the voice: `under` dB below the voice's speaking RMS while it speaks, +lift dB in pauses."""
    x = np.zeros(N, np.float32); XF = 3.0
    for i, (t0, t1, mood) in enumerate(sections):
        a = max(0, int((t0 - XF / 2) * SR)); b = min(N, int((t1 + XF / 2) * SR))
        if b <= a: continue
        y = render_mood(mood, b - a, 101 + i); tt = np.arange(b - a) / SR
        env = np.ones(b - a, np.float32)
        if i: env *= np.clip(tt / XF, 0, 1)
        if i < len(sections) - 1: env *= np.clip(((b - a) / SR - tt) / XF, 0, 1)
        x[a:b] += y * env
    t = np.arange(N) / SR
    x *= np.clip(t / fade_in, 0, 1) * np.clip((N / SR - t) / fade_out, 0, 1)
    # level: bed RMS = voice speaking RMS - under dB
    e = np.sqrt(movavg(voice ** 2, 0.05 * SR)); speaking = e > 0.02
    vr = np.sqrt(np.mean(voice[speaking] ** 2)) if speaking.any() else 0.1
    br = np.sqrt(np.mean(x[int(fade_in * SR):max(int(fade_in * SR) + 1, N - int(fade_out * SR))] ** 2)) or 1e-6
    x *= vr * 10 ** (-under / 20) / br
    # ride: base level while speaking, +lift in pauses; smooth attack/release (no hard sidechain)
    # a pause must last > 0.6 s to lift (no pumping between words)
    sp = movavg(speaking.astype(np.float32), 0.6 * SR) > 0.02
    g = np.where(sp, 1.0, 10 ** (lift / 20)).astype(np.float32)
    # smooth both ways with a one-pole (~0.5 s) -> gentle ride, no pumping (vectorised; a per-sample loop is too slow at 9 min)
    a1 = np.exp(-1 / (0.5 * SR)); sm = filtfilt([1 - a1], [1, -a1], g, padlen=0).astype(np.float32)
    x *= sm
    return np.stack([x, np.roll(x, int(0.011 * SR))], 1)   # 11 ms Haas width, as in dialogue


def sections_for(lines, script_text, film_T, moods="auto"):
    """chapter sections from lines.json + the script's #ch markers"""
    starts, n, chnext = [], 0, False
    for l in script_text.split("#end")[0].splitlines():
        s = l.strip()
        if s.startswith("#ch"): chnext = True; continue
        if re.match(r"NARR \(", s):
            n += 1
            if chnext: starts.append(n); chnext = False
    if not starts: starts = [1]
    ms = auto_moods(script_text) if moods == "auto" else list(moods)
    by = {l["n"]: l for l in lines}
    t0s = [0.0] + [by[k]["start"] - 1.5 for k in starts[1:] if k in by]
    return [(t0s[i], t0s[i + 1] if i + 1 < len(t0s) else film_T, ms[min(i, len(ms) - 1)] if ms else "investigative") for i in range(len(t0s))]


if __name__ == "__main__":
    import sys, json
    from pathlib import Path
    from scipy.io import wavfile
    F = Path(__file__).resolve().parents[1] / "films" / sys.argv[1]
    sr, v = wavfile.read(F / "voice.wav"); v = v.astype(np.float32) / 32768; v = v if v.ndim == 1 else v[:, 0]
    secs = sections_for(json.load(open(F / "lines.json")), (F / "script.md").read_text(encoding="utf8"), len(v) / SR)
    print(secs)
    m = bed(len(v), v, secs)
    out = np.stack([v, v], 1) + m; out /= np.abs(out).max() / 0.89
    wavfile.write(F / "music_preview.wav", SR, (out * 32767).astype("<i2"))
