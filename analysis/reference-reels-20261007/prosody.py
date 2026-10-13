"""Delivery analysis of narrated audio: transcript with pauses/emphasis + pitch/energy shape per sentence.

C:/Repos/tts-venv/Scripts/python.exe prosody.py <out_dir> <name=audio> [<name=audio> ...]
Writes <out_dir>/<name>.md (annotated transcript) and <out_dir>/<name>.json (metrics); prints a one-line summary each.
Annotated transcript: [0.42] = pause in seconds, WORD in caps = emphasised (pitch or loudness well above the
sentence average), ↗ / ↘ / → after a sentence = its final pitch movement.
"""
import json, os, sys
import numpy as np, librosa
import torch
os.add_dll_directory(os.path.join(os.path.dirname(torch.__file__), "lib"))
from faster_whisper import WhisperModel

out = sys.argv[1]; os.makedirs(out, exist_ok=True)
asr = WhisperModel("large-v3", device="cuda", compute_type="int8_float16")
HOP = 160  # 10 ms at 16 kHz


def st(f, ref):  # Hz -> semitones relative to ref
    return 12 * np.log2(f / ref)


for arg in sys.argv[2:]:
    name, path = arg.split("=", 1)
    y, sr = librosa.load(path, sr=16000, mono=True)
    segs, _ = asr.transcribe(y, language="en", word_timestamps=True, beam_size=5, condition_on_previous_text=True)
    words = [{"w": w.word.strip(), "s": w.start, "e": w.end} for s in segs for w in s.words]
    f0, vf, _ = librosa.pyin(y, fmin=65, fmax=420, sr=sr, frame_length=1024, hop_length=HOP)
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=HOP)[0]
    db = 20 * np.log10(rms + 1e-6)
    ref = np.nanmedian(f0[vf]) if np.any(vf) else 120.0
    for w in words:
        a, b = int(w["s"] * 100), max(int(w["s"] * 100) + 1, int(w["e"] * 100))
        p = f0[a:b][vf[a:b]] if b <= len(f0) else np.array([])
        w["f0"] = float(np.median(st(p, ref))) if len(p) >= 3 else None
        w["db"] = float(np.max(db[a:b])) if b <= len(db) and b > a else -60.0
        w["dur"] = round(w["e"] - w["s"], 3)
    # sentences = split at . ? ! (Whisper punctuation)
    sents, cur = [], []
    for w in words:
        cur.append(w)
        if w["w"].endswith((".", "?", "!")):
            sents.append(cur); cur = []
    if cur:
        sents.append(cur)
    # speech-gap noise floor (music/bed check)
    gaps = [(words[i]["e"], words[i + 1]["s"]) for i in range(len(words) - 1) if words[i + 1]["s"] - words[i]["e"] > 0.25]
    gap_db = [np.median(db[int(a * 100) + 3:int(b * 100) - 3]) for a, b in gaps if int(b * 100) - int(a * 100) > 8]
    speech_db = np.median([w["db"] for w in words])
    lines, S = [], []
    for k, s in enumerate(sents):
        fv = [w["f0"] for w in s if w["f0"] is not None]
        mean_db = np.mean([w["db"] for w in s]); mean_f = np.mean(fv) if fv else 0
        emph = [w for w in s if (w["f0"] is not None and w["f0"] - mean_f > 2.0) or w["db"] - mean_db > 4.0]
        start = np.mean([w["f0"] for w in s[:2] if w["f0"] is not None] or [0])
        endw = [w["f0"] for w in s[-2:] if w["f0"] is not None]
        end = endw[-1] if endw else 0
        peak_i = int(np.argmax([w["f0"] if w["f0"] is not None else -99 for w in s]))
        fall = end - (np.mean(fv) if fv else 0)
        tail = "↘" if fall < -1.5 else ("↗" if fall > 1.5 else "→")
        dur = s[-1]["e"] - s[0]["s"]
        pause_after = (sents[k + 1][0]["s"] - s[-1]["e"]) if k + 1 < len(sents) else 0
        txt = []
        for i, w in enumerate(s):
            t = w["w"].upper() if w in emph else w["w"]
            if i and w["s"] - s[i - 1]["e"] > 0.12:
                txt.append(f"[{w['s'] - s[i - 1]['e']:.2f}]")
            txt.append(t)
        lines.append(f"{s[0]['s']:6.1f}s  {' '.join(txt)} {tail}   ({len(s)}w {len(s) / max(dur, .01):.1f}w/s, "
                     f"start {start:+.1f} peak@{peak_i + 1}/{len(s)} end {end:+.1f} st, range {np.ptp(fv) if fv else 0:.1f} st) [{pause_after:.2f}]")
        S.append({"n": len(s), "wps": len(s) / max(dur, .01), "start": start, "end": end, "fall": fall,
                  "range": float(np.ptp(fv)) if fv else 0, "peak_pos": (peak_i + 0.5) / len(s), "pause_after": pause_after,
                  "emph": len(emph), "q": s[-1]["w"].endswith("?")})
    inpause = [words[i + 1]["s"] - words[i]["e"] for i in range(len(words) - 1)
               if not words[i]["w"].endswith((".", "?", "!")) and words[i + 1]["s"] - words[i]["e"] > 0.12]
    fv_all = np.array([w["f0"] for w in words if w["f0"] is not None])
    M = {"name": name, "dur": round(len(y) / sr, 1), "words": len(words), "sentences": len(sents),
         "wps": round(len(words) / (words[-1]["e"] - words[0]["s"]), 2),
         "words_per_sentence": round(len(words) / len(sents), 1),
         "pitch_range_st_p10_p90": round(float(np.percentile(fv_all, 90) - np.percentile(fv_all, 10)), 1),
         "median_f0_hz": round(float(ref), 1),
         "word_pitch_sd_st": round(float(np.std(fv_all)), 2),
         "loudness_sd_db": round(float(np.std([w["db"] for w in words])), 2),
         "sentence_pause_mean": round(float(np.mean([x["pause_after"] for x in S[:-1]])) if len(S) > 1 else 0, 2),
         "inner_pauses_per_sentence": round(len(inpause) / len(sents), 2),
         "inner_pause_mean": round(float(np.mean(inpause)), 2) if inpause else 0,
         "falling_end_pct": round(100 * np.mean([x["fall"] < -1.5 for x in S if not x["q"]]), 0),
         "rising_end_pct": round(100 * np.mean([x["fall"] > 1.5 for x in S]), 0),
         "sentence_start_st": round(float(np.mean([x["start"] for x in S])), 2),
         "sentence_end_st": round(float(np.mean([x["end"] for x in S])), 2),
         "emph_per_sentence": round(float(np.mean([x["emph"] for x in S])), 2),
         "peak_position": round(float(np.mean([x["peak_pos"] for x in S])), 2),
         "questions": int(sum(x["q"] for x in S)),
         "music_bed_db_below_speech": round(float(speech_db - np.median(gap_db)), 1) if gap_db else None}
    open(f"{out}/{name}.md", "w", encoding="utf8").write(f"# {name}\n\n```\n" + json.dumps(M, indent=1) + "\n```\n\n" + "\n".join(lines) + "\n")
    json.dump({"metrics": M, "sentences": S, "words": words}, open(f"{out}/{name}.json", "w"))
    print(json.dumps(M))
