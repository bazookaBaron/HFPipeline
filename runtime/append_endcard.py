"""Append the channel endcard (vloombox) to a hand-authored reel: python append_endcard.py <reelDir> [speed]
Reads <reelDir>/vo/voice.wav + words.json, writes vo/voice.wav (body kept as vo/voice-body.wav) and
words.json (endcard words get line=99; 'vloom box dot in' becomes one caption word 'vloombox.in')."""
import json,os,sys,subprocess,numpy as np,soundfile as sf
d=sys.argv[1]; SPEED=float(sys.argv[2]) if len(sys.argv)>2 else 1.12; GAP=0.35
E=os.path.join(os.path.dirname(__file__),"assets","endcard")
body=os.path.join(d,"vo","voice-body.wav")
if not os.path.exists(body): os.replace(os.path.join(d,"vo","voice.wav"),body); json.dump(json.load(open(os.path.join(d,"words.json"))),open(os.path.join(d,"words-body.json"),"w"))
W=[w for w in json.load(open(os.path.join(d,"words-body.json")))]
fast=os.path.join(E,f"fast-{SPEED}.wav")
if not os.path.exists(fast): subprocess.run(["ffmpeg","-y","-v","error","-i",os.path.join(E,"raw.wav"),"-af",f"atempo={SPEED}","-ar","48000",fast],check=True)
ew=json.load(open(os.path.join(E,"raw.json"))); s0=max(0,ew[0]["start"]-0.04)
a,sr=sf.read(body); a=a if a.ndim==1 else a.mean(1)
t0=W[-1]["e"]+GAP; a=a[:int((W[-1]["e"]+0.05)*sr)]
e,_=sf.read(fast); e=e if e.ndim==1 else e.mean(1); e=e[int(s0/SPEED*sr):]
out=np.concatenate([a,np.zeros(int((t0-len(a)/sr)*sr)),e,np.zeros(int(0.6*sr))])
sf.write(os.path.join(d,"vo","voice.wav"),out,sr)
words=[];i=0
while i<len(ew):
    x=ew[i]; s=t0+(x["start"]-s0)/SPEED; en=t0+(x["end"]-s0)/SPEED
    if x["word"].lower()=="vloom" and i+3<len(ew):
        en=t0+(ew[i+3]["end"]-s0)/SPEED; words.append({"w":"vloombox.in","s":s,"e":en,"line":99}); i+=4; continue
    words.append({"w":x["word"],"s":s,"e":en,"line":99}); i+=1
json.dump(W+words,open(os.path.join(d,"words.json"),"w"))
print("endcard",round(t0,2),"->",round(words[-1]["e"],2),"total",round(len(out)/sr,2))
