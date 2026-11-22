"""Intelligible-speech gate for CROWD needs (needs.json "crowd": true), run before build.py.
Crowd beds and crowd one-shots (courtroom murmur, rally, applause, gasp ...) naturally read high on Earshot's
"people talking in the background" query, so the generic human-voice gate would reject every one of them. For these needs the
question is not "are there people?" but "can a listener make out words?". faster-whisper (small, int8, any language,
no VAD, no text conditioning) transcribes each vetted bed section / one-shot moment; a word counts as intelligible when its
probability >= WORD_P and its segment's no_speech_prob < 0.6. build.py rejects a crowd bed section with >= BED_MAX such
words, and a crowd one-shot with >= SHOT_MAX (README "Human-voice gate"). Singing is still checked by Earshot in build.py.
Writes <work>/speech.json: {need: {candidate: {"section"|"moment key": {"words": n, "text": "..."}}}}.
Run with plain python (faster-whisper lives in the user site-packages):
  python dialogue/sfx/tools/speech_gate.py <needs.json> <work dir>"""
import json, os, subprocess, sys
import numpy as np

WORD_P = 0.6
BED_MAX, SHOT_MAX = 4, 2
needs = json.load(open(sys.argv[1], encoding="utf-8"))
W = sys.argv[2]
vet = json.load(open(os.path.join(W, "vet.json")))
sp = os.path.join(W, "speech.json")
out = json.load(open(sp)) if os.path.exists(sp) else {}
from faster_whisper import WhisperModel  # noqa: E402
M = WhisperModel("small", device="cpu", compute_type="int8")


def pcm16k(path, s0, s1):
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-ss", f"{s0:.3f}", "-t", f"{max(0.3, s1 - s0):.3f}", "-i", path,
                          "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True, check=True, timeout=300).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def words(path, s0, s1):
    x = pcm16k(path, s0, s1)
    segs, _ = M.transcribe(x, word_timestamps=True, vad_filter=False, condition_on_previous_text=False, beam_size=1)
    n, txt = 0, []
    for s in segs:
        if s.no_speech_prob >= 0.6: continue
        for w in s.words or []:
            if w.probability >= WORD_P: n += 1; txt.append(w.word.strip())
    return n, " ".join(txt)[:200]


def window(n, mo):
    """the same extended window build.py cuts for a one-shot"""
    L = n.get("len_s", 0)
    s0, s1 = mo["start"], mo["end"]
    if L and s1 - s0 < L:
        c = (s0 + s1) / 2; s0, s1 = max(0.0, c - L / 2), c + L / 2
    return s0, s1


for nid, n in needs.items():
    if not n.get("crowd") or nid not in vet: continue
    rec = out.setdefault(nid, {})
    for cid, fr in vet[nid]["files"].items():
        f = next((os.path.join(W, "wav", nid, cid + e) for e in (".flac", ".wav") if os.path.exists(os.path.join(W, "wav", nid, cid + e))), None)
        if not f: continue
        r = rec.setdefault(cid, {})
        if n["kind"] == "amb" and "section" in fr:
            if "section" not in r:
                k, t = words(f, *fr["section"]); r["section"] = {"words": k, "text": t, "max": BED_MAX, "pass": k < BED_MAX}
                print(nid, cid[:10], "bed words", k, t[:60], flush=True)
        else:
            for mo in fr.get("moments", []):
                key = f"{mo['start']:.3f}"
                if key in r: continue
                k, t = words(f, *window(n, mo)); r[key] = {"words": k, "text": t, "max": SHOT_MAX, "pass": k < SHOT_MAX}
                print(nid, cid[:10], key, "words", k, t[:60], flush=True)
        json.dump(out, open(sp, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
json.dump(out, open(sp, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("speech gate done")
