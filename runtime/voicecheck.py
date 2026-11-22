"""Intelligibility check for a voiced reel: transcribe every line with Whisper large-v3 and score it against the script.

C:/Repos/tts-venv/Scripts/python.exe runtime/voicecheck.py <reelDir> [--final]
Default scores the raw per-line TTS takes (vo/cache, before tempo change). --final scores the assembled vo/voice.wav,
cut per line with words.json (what the viewer actually hears). Prints WER per line + what Whisper heard; exit 1 if any
line has WER > 0.15 (= the viewer probably can't make it out).
"""
import hashlib, json, os, re, sys
import numpy as np, soundfile as sf

d = os.path.abspath(sys.argv[1]); final = "--final" in sys.argv
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from asrscore import norm, wer  # noqa: E402
from saytext import split_tags  # noqa: E402
# spoken lines only (same as voice.py): `#` marker lines skipped, `{tags}` stripped
lines = [split_tags(l.strip())[0] for l in open(f"{d}/script.txt", encoding="utf8").read().split("\n")
         if l.strip() and not l.strip().startswith("#")]



import torch  # ctranslate2 needs cuBLAS/cuDNN; torch ships them
os.add_dll_directory(os.path.join(os.path.dirname(torch.__file__), "lib"))
from faster_whisper import WhisperModel
m = WhisperModel("large-v3", device="cuda", compute_type="int8_float16")


def asr(audio, sr):
    if sr != 16000:
        import librosa
        audio = librosa.resample(audio.astype(np.float32), orig_sr=sr, target_sr=16000)
    segs, _ = m.transcribe(audio.astype(np.float32), language="en", beam_size=5, condition_on_previous_text=False,
                           initial_prompt=None, vad_filter=False)
    return " ".join(s.text.strip() for s in segs)


clips = []
if final:
    x, sr = sf.read(f"{d}/vo/voice.wav"); x = x if x.ndim == 1 else x.mean(1)
    W = json.load(open(f"{d}/words.json"))
    for i in range(len(lines)):
        w = [t for t in W if t["line"] == i]
        clips.append((x[int(max(0, w[0]["s"] - 0.1) * sr):int((w[-1]["e"] + 0.15) * sr)], sr))
else:
    for l in lines:
        h = hashlib.sha1(l.encode()).hexdigest()[:16]
        x, sr = sf.read(f"{d}/vo/cache/{h}.wav"); clips.append((x if x.ndim == 1 else x.mean(1), sr))

bad, tot = 0, 0.0
for i, (l, (a, sr)) in enumerate(zip(lines, clips)):
    heard = asr(a, sr); e = wer(l, heard); tot += e
    flag = "BAD " if e > 0.15 else "ok  "
    bad += e > 0.15
    print(f"{flag}{i:2d} wer {e:.2f} | {l}\n        heard: {heard}")
print(f"{'final' if final else 'raw'}: mean WER {tot / len(lines):.3f}, {bad}/{len(lines)} lines unclear")
sys.exit(1 if bad else 0)
