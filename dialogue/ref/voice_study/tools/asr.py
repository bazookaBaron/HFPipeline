import json, sys
import numpy as np, wave
from faster_whisper import WhisperModel
m = WhisperModel("small.en", device="cpu", compute_type="int8")
for v in sys.argv[1:]:
    w_ = wave.open(f"{v}.16k.wav"); x = np.frombuffer(w_.readframes(w_.getnframes()), np.int16).astype(np.float32) / 32768
    segs, _ = m.transcribe(x, language="en", beam_size=5, temperature=0, word_timestamps=True,
                           vad_filter=False, condition_on_previous_text=True)
    out = []
    for s in segs:
        out.append({"start": s.start, "end": s.end, "text": s.text.strip(),
                    "words": [{"w": w.word, "s": w.start, "e": w.end, "p": w.probability} for w in s.words]})
        print(f"{s.start:6.2f}-{s.end:6.2f} {s.text}", flush=True)
    json.dump(out, open(f"{v}.asr.json", "w"), indent=1)
