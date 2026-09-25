from faster_whisper import WhisperModel
import json
m=WhisperModel("large-v3",device="cpu",compute_type="int8")
segs,_=m.transcribe("audio16k.wav",word_timestamps=True,language="en")
out=[]
for s in segs:
    out.append({"start":s.start,"end":s.end,"text":s.text,"words":[{"w":w.word,"s":w.start,"e":w.end} for w in s.words]})
json.dump(out,open("words.json","w"),indent=1)
print("done")
