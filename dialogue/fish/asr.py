import sys,json
from faster_whisper import WhisperModel
m=WhisperModel("small",device="cpu",compute_type="int8")
import numpy as np,subprocess
x=np.frombuffer(subprocess.run(["ffmpeg","-v","error","-i",sys.argv[1],"-ac","1","-ar","16000","-f","f32le","-"],capture_output=True).stdout,dtype="<f4")
seg,_=m.transcribe(x,language="en",word_timestamps=True,vad_filter=False)
out=[]
for s in seg:
    for w in s.words: out.append((round(w.start,2),round(w.end,2),w.word.strip()))
json.dump(out,open(sys.argv[2],"w")); print(" ".join(f"{w[2]}@{w[0]}" for w in out))
