import json,sys
from faster_whisper import WhisperModel
m=WhisperModel("small",device="cpu",compute_type="int8")
segs,info=m.transcribe(sys.argv[1],word_timestamps=True,language="en",vad_filter=False)
out=[]
for s in segs:
    for w in s.words: out.append({"w":w.word.strip(),"s":round(w.start,3),"e":round(w.end,3)})
    print(f"[{s.start:7.2f}-{s.end:7.2f}] {s.text}",flush=True)
json.dump(out,open("words.json","w"),indent=0)
