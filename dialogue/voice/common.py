"""Shared helpers (stdlib + numpy only) for the dialogue voice scripts."""
import re
import wave
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CAST, REFS, CAND = ROOT / "casting", ROOT / "refs", ROOT / "casting" / "_cand"
VENV_WHISPER = "C:/Repos/HFPipleine/.venvs/whisper/Scripts/python.exe"
VENV_PARLER = "C:/Repos/HFPipleine/.venvs/parler/Scripts/python.exe"
VENV_COSY = "C:/Repos/HFPipleine/.vendor/engines/CosyVoice/.venv/Scripts/python.exe"
CHARS = ["dadu", "rohan", "arjun", "meera"]
OPTS = ["A", "B", "C"]


def read_wav(p):
    with wave.open(str(p), "rb") as w:
        sr, n, ch, sw = w.getframerate(), w.getnframes(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(n)
    assert sw == 2, "int16 only"
    x = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        x = x.reshape(-1, ch).mean(1)
    return x, sr


def write_wav(p, x, sr):
    x = np.clip(np.asarray(x, dtype=np.float32), -1, 1)
    with wave.open(str(p), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((x * 32767).astype("<i2").tobytes())


def resample(x, a, b):
    if a == b:
        return x
    n = int(round(len(x) * b / a))
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def pitch_track(x, sr, fmin=70, fmax=400):
    """Crude autocorrelation f0 per 40 ms frame (voiced only). Returns array of Hz."""
    fl, hop = int(sr * 0.04), int(sr * 0.01)
    lo, hi = int(sr / fmax), int(sr / fmin)
    out = []
    for i in range(0, len(x) - fl - hi, hop):
        f = x[i:i + fl + hi]
        if np.sqrt(np.mean(f[:fl] ** 2)) < 0.01:
            continue
        f0 = f[:fl] - f[:fl].mean()
        ac = np.correlate(f, f0, "valid")[lo:hi]
        if len(ac) == 0:
            continue
        k = int(np.argmax(ac))
        if ac[k] / (np.dot(f0, f0) + 1e-9) > 0.5:
            out.append(sr / (lo + k))
    return np.array(out)


_ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def _words(n):
    if n < 20:
        return _ONES[n]
    if n < 100:
        return _TENS[n // 10] + (" " + _ONES[n % 10] if n % 10 else "")
    if 1000 <= n < 2100 and n % 100:
        return _words(n // 100) + " " + (("oh " if n % 100 < 10 else "") + _words(n % 100))
    if n < 1000:
        return _ONES[n // 100] + " hundred" + (" " + _words(n % 100) if n % 100 else "")
    return str(n)


def _norm(s):
    s = re.sub(r"\d+", lambda m: _words(int(m.group())), s)
    return re.sub(r"[^a-z0-9' ]", " ", s.lower().replace("-", " ")).split()


def wer(ref, hyp):
    r, h = _norm(ref), _norm(hyp)
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev, d[j] = d[j], cur
    return d[len(h)] / max(1, len(r))


_wm = None


def transcribe(path):
    global _wm
    from faster_whisper import WhisperModel
    if _wm is None:
        _wm = WhisperModel("small.en", device="cpu", compute_type="int8")
    x, sr = read_wav(path)  # pass audio array: this av build rejects metadata_errors
    segs, _ = _wm.transcribe(resample(x, sr, 16000), language="en", beam_size=1, temperature=0)
    return " ".join(s.text.strip() for s in segs)
