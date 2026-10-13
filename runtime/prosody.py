"""Delivery (prosody) metrics + a score against the user's reference reels.

Library: analyze(y16k, asr_words) -> metrics dict; score(metrics) -> (penalty, reasons). Lower penalty = closer to refs.
CLI:     C:/Repos/tts-venv/Scripts/python.exe runtime/prosody.py <audio> [<audio> ...]   (transcribes with Whisper)
Reference band = analysis/reference-reels-20261007/FINDINGS.md (5 explainer reels the user picked as the target):
  sentence ends falling 13–30 %, sentence starts ≈ level (−1…+1 st), pitch range p10–p90 4–8 st,
  0.15–0.5 breaths inside each sentence, loudness SD 1.4–2.2 dB. Ours before the fix: 58 %, +4.4 st, 13.4 st, 0.07, 1.2 dB.
"""
import numpy as np

HOP = 160  # 10 ms at 16 kHz
BAND = {  # metric: (low, high) — from the 5 reference reels (ref4 outliers excluded where it skews)
    "falling_end_pct": (0, 35), "start_st": (-1.5, 1.5), "range_st": (4.0, 8.0),
    "inner_pauses": (0.12, 0.6), "loud_sd": (1.35, 2.4),
}
WEIGHT = {"falling_end_pct": 1 / 15, "start_st": 1 / 1.5, "range_st": 1 / 2.0, "inner_pauses": 1 / 0.1, "loud_sd": 1 / 0.3}


def st(f, ref):
    return 12 * np.log2(f / ref)


def analyze(y, words, sr=16000):
    """y: mono float audio at 16 kHz; words: [{w,s,e}] (Whisper word timestamps). Returns metrics."""
    import librosa
    f0, vf, _ = librosa.pyin(y, fmin=65, fmax=420, sr=sr, frame_length=1024, hop_length=HOP)
    db = 20 * np.log10(librosa.feature.rms(y=y, frame_length=1024, hop_length=HOP)[0] + 1e-6)
    ref = np.nanmedian(f0[vf]) if np.any(vf) else 120.0
    for w in words:
        a = int(w["s"] * 100); b = max(a + 1, int(w["e"] * 100))
        p = f0[a:b][vf[a:b]] if b <= len(f0) else np.array([])
        w["f0"] = float(np.median(st(p, ref))) if len(p) >= 3 else None
        w["db"] = float(np.max(db[a:b])) if a < b <= len(db) else -60.0
    sents, cur = [], []
    for w in words:
        cur.append(w)
        if w["w"].rstrip('"').endswith((".", "?", "!")):
            sents.append(cur); cur = []
    if cur:
        sents.append(cur)
    S = []
    for s in sents:
        fv = [w["f0"] for w in s if w["f0"] is not None]
        if not fv:
            continue
        start = np.mean([w["f0"] for w in s[:2] if w["f0"] is not None] or [0])
        endv = [w["f0"] for w in s[-2:] if w["f0"] is not None]
        S.append({"start": start, "fall": (endv[-1] if endv else 0) - np.mean(fv), "q": s[-1]["w"].endswith("?")})
    inner = [1 for i in range(len(words) - 1)
             if not words[i]["w"].endswith((".", "?", "!")) and words[i + 1]["s"] - words[i]["e"] > 0.12]
    fv_all = np.array([w["f0"] for w in words if w["f0"] is not None] or [0.0])
    stated = [x for x in S if not x["q"]] or S or [{"fall": 0}]
    return {
        "falling_end_pct": 100 * float(np.mean([x["fall"] < -1.5 for x in stated])),
        "start_st": float(np.mean([x["start"] for x in S])) if S else 0.0,
        "range_st": float(np.percentile(fv_all, 90) - np.percentile(fv_all, 10)),
        "inner_pauses": len(inner) / max(1, len(sents)),
        "loud_sd": float(np.std([w["db"] for w in words])) if words else 0.0,
        "wps": len(words) / max(0.1, words[-1]["e"] - words[0]["s"]) if words else 0.0,
        "sentences": len(sents),
    }


def score(m):
    """Penalty = weighted distance outside the reference band (0 = inside on every metric)."""
    pen, why = 0.0, []
    for k, (lo, hi) in BAND.items():
        v = m[k]
        d = lo - v if v < lo else (v - hi if v > hi else 0.0)
        if d > 0:
            pen += d * WEIGHT[k]; why.append(f"{k} {v:.2f} (want {lo}–{hi})")
    return pen, why


if __name__ == "__main__":
    import os, sys, librosa, torch
    os.add_dll_directory(os.path.join(os.path.dirname(torch.__file__), "lib"))
    from faster_whisper import WhisperModel
    asr = WhisperModel("large-v3", device="cuda", compute_type="int8_float16")
    for p in sys.argv[1:]:
        y, _ = librosa.load(p, sr=16000, mono=True)
        segs, _ = asr.transcribe(y, language="en", word_timestamps=True, beam_size=5, condition_on_previous_text=False)
        W = [{"w": w.word.strip(), "s": w.start, "e": w.end} for s in segs for w in s.words]
        m = analyze(y, W); pen, why = score(m)
        print(f"{os.path.basename(p)}: penalty {pen:.2f} | " + " ".join(f"{k}={v:.2f}" for k, v in m.items()) + (" | " + "; ".join(why) if why else ""))
