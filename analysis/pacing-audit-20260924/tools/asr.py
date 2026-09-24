import os, torch; os.add_dll_directory(os.path.join(os.path.dirname(torch.__file__), "lib")); os.environ["PATH"] = os.path.join(os.path.dirname(torch.__file__), "lib") + os.pathsep + os.environ["PATH"]
import json, sys
from faster_whisper import WhisperModel
vids = {
 "R1_DdEedoQM6j3": r"C:\Users\debna\Downloads\igexport-DdEedoQM6j3.mp4",
 "R2_DdG-RuwsDRc": r"C:\Users\debna\Downloads\igexport-DdG-RuwsDRc.mp4",
 "R3_DdSc-I9IqNC": r"C:\Users\debna\Downloads\igexport-DdSc-I9IqNC.mp4",
 "R4_DdT5wzdsQWV": r"C:\Users\debna\Downloads\igexport-DdT5wzdsQWV.mp4",
 "R5_DdIM0QoiZre": r"C:\Users\debna\Downloads\igexport-DdIM0QoiZre.mp4",
 "OURS_cs-b9d30fa7964c0cf0": r"C:\Repos\HFPipleine\control-panel\data\renders\cs-b9d30fa7964c0cf0.mp4",
}
m = WhisperModel("large-v3", device="cuda", compute_type="float16")
for k, p in vids.items():
    segs, info = m.transcribe(p, word_timestamps=True, language="en", vad_filter=False)
    out = []
    for s in segs:
        out.append({"start": s.start, "end": s.end, "text": s.text.strip(),
                    "words": [{"w": w.word.strip(), "s": round(w.start,3), "e": round(w.end,3)} for w in (s.words or [])]})
    json.dump(out, open(f"{k}.asr.json", "w"), indent=1)
    print(k, len(out), "segments", flush=True)
