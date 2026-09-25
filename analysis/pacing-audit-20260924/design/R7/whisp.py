import os, torch; os.add_dll_directory(os.path.join(os.path.dirname(torch.__file__), "lib")); os.environ["PATH"] = os.path.join(os.path.dirname(torch.__file__), "lib") + os.pathsep + os.environ["PATH"]
import json
from faster_whisper import WhisperModel
p = r"C:\Users\debna\Downloads\igexport-Ddm_kFQodJE.mp4"
try:
    m = WhisperModel("large-v3", device="cuda", compute_type="float16")
except Exception as e:
    print("cuda fail", e); m = WhisperModel("large-v3", device="cpu", compute_type="int8")
segs, info = m.transcribe(p, word_timestamps=True, language="en", vad_filter=False)
out = []
for s in segs:
    out.append({"start": s.start, "end": s.end, "text": s.text.strip(),
                "words": [{"w": w.word.strip(), "s": round(w.start,3), "e": round(w.end,3)} for w in (s.words or [])]})
json.dump(out, open("R7.asr.json", "w"), indent=1)
print(len(out), "segments")
