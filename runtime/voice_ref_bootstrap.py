"""Make an explainer-style reference clip for the SAME narrator voice (no new recording needed).

C:/Repos/tts-venv/Scripts/python.exe runtime/voice_ref_bootstrap.py [--takes 16] [--rounds 2]
F5 copies both the speaker AND the delivery of its reference clip. Our original clip is calm documentary storytelling,
so every line came out "high start, falling full stop". This script has the narrator read an explainer passage written
in the style of the user's reference reels, many times, scores each take (Whisper WER + runtime/prosody.py distance to
the reference band) and keeps the best as voice-pipeline/voices/narrator-explainer/. Round 2 uses the round-1 winner
as the reference, pulling the delivery further toward the target while the timbre stays the narrator's.
"""
import argparse, json, os, shutil, sys, tempfile
import numpy as np, soundfile as sf, librosa

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
VP = os.path.join(ROOT, "voice-pipeline"); sys.path[:0] = [VP, HERE]
ap = argparse.ArgumentParser(); ap.add_argument("--takes", type=int, default=16); ap.add_argument("--rounds", type=int, default=2)
a = ap.parse_args()

PASSAGE = ("Let's break that down. It doesn't write essays, it doesn't write code, it's built to make decisions. "
           "Step one, data. You collect books, websites, and code, and then you clean all of it.")
SRC = os.path.join(VP, "voices", "narrator"); DST = os.path.join(VP, "voices", "narrator-explainer")
prof = json.load(open(os.path.join(SRC, "profile.json")))

import torch
os.add_dll_directory(os.path.join(os.path.dirname(torch.__file__), "lib"))
from contextlib import redirect_stdout
from tts_worker import VoiceWorker
from faster_whisper import WhisperModel
from asrscore import wer
import prosody

W = VoiceWorker()
with redirect_stdout(sys.stderr):
    W._load()
asr = WhisperModel("large-v3", device="cuda", compute_type="int8_float16")
tmp = tempfile.mkdtemp(prefix="vref_")


def padded(path, secs=0.5):
    x, sr = sf.read(path); x = x if x.ndim == 1 else x.mean(1)
    out = os.path.join(tmp, f"pad_{os.path.basename(path)}"); sf.write(out, np.concatenate([x, np.zeros(int(secs * sr))]), sr)
    return out


ref_wav, ref_text = os.path.join(SRC, prof["reference_audio"]), prof["reference_text"]
log = []; overall = None
for r in range(a.rounds):
    best = None
    for k in range(a.takes):
        out = os.path.join(tmp, f"r{r}_t{k}.wav")
        with redirect_stdout(sys.stderr):
            W.f5.infer(ref_file=padded(ref_wav), ref_text=ref_text, gen_text=PASSAGE, file_wave=out,
                       speed=1.0, nfe_step=32, seed=4242 + 101 * k + 7 * r, remove_silence=False)
        y, _ = librosa.load(out, sr=16000, mono=True)
        segs, _ = asr.transcribe(y, language="en", word_timestamps=True, beam_size=5); segs = list(segs)
        words = [{"w": w.word.strip(), "s": w.start, "e": w.end} for s in segs for w in s.words]
        heard = " ".join(s.text.strip() for s in segs)
        e = wer(PASSAGE, heard); m = prosody.analyze(y, words); pen, why = prosody.score(m)
        total = pen + 20 * e  # intelligibility first
        log.append({"round": r, "take": k, "wer": round(e, 3), "penalty": round(pen, 2), "total": round(total, 2),
                    **{k2: round(v, 2) for k2, v in m.items()}})
        print(f"r{r} t{k:2d} wer {e:.2f} pen {pen:.2f} total {total:.2f} | " + "; ".join(why), flush=True)
        if best is None or total < best[0]:
            best = (total, out, m)
    ref_wav, ref_text = best[1], PASSAGE
    if overall is None or best[0] < overall[0]:
        overall = best
    print(f"round {r} winner: total {best[0]:.2f} {best[2]}", flush=True)

os.makedirs(DST, exist_ok=True)
best = overall  # keep the best take of ALL rounds (later rounds can drift worse)
x, sr = sf.read(best[1]); x = x if x.ndim == 1 else x.mean(1)
sf.write(os.path.join(DST, "reference.wav"), x, sr)
np_prof = {"name": "narrator-explainer", "derived_from": "narrator (same consented voice, re-styled by voice_ref_bootstrap.py)",
           "reference_audio": "reference.wav", "reference_text": PASSAGE, "duration_seconds": round(len(x) / sr, 2),
           "selection": {k: (round(v, 3) if isinstance(v, float) else v) for k, v in best[2].items()}}
json.dump(np_prof, open(os.path.join(DST, "profile.json"), "w"), indent=1)
json.dump(log, open(os.path.join(DST, "bootstrap-log.json"), "w"), indent=1)
print("wrote", DST)
