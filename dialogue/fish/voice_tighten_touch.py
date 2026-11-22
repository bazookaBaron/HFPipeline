"""Join the 4 Fish batches (take_touch/A-C.mp3) into voice_touch_1x.wav: decode, cap every silence > MAXGAP, 0.55 s between batches."""
import subprocess, sys, numpy as np, wave
from pathlib import Path
D = Path(__file__).parent; SR = 48000
MAXGAP, BATCHGAP, TH = 0.85, 0.55, 10 ** (-38 / 20)
def load(p):
    r = subprocess.run(["ffmpeg","-v","error","-i",str(p),"-ac","1","-ar",str(SR),"-f","f32le","-"],capture_output=True,check=True)
    return np.frombuffer(r.stdout, dtype="<f4")
def tighten(x):
    win = int(0.01*SR); n = len(x)//win
    env = np.sqrt((x[:n*win].reshape(n,win)**2).mean(1)); sil = env < TH
    out=[]; i=0
    while i<n:
        j=i
        while j<n and sil[j]==sil[i]: j+=1
        seg=x[i*win:j*win]
        if sil[i]:
            keep=min(len(seg),int(MAXGAP*SR)); seg=seg[:keep]
        out.append(seg); i=j
    return np.concatenate(out)
parts=[]
def clip(x,a=0,b=None):
    x=x[int(a*SR):int(b*SR) if b else None]; idx=np.where(np.abs(x)>TH)[0]; return x[idx[0]:idx[-1]+1]
g=lambda s:np.zeros(int(s*SR),dtype="<f4")
def build(k):
    if k=="B":  # L7 swapped/borderline -> single-speaker re-roll R7
        b=load(D/"take_touch"/"B.mp3"); return tighten(np.concatenate([clip(load(D/"take_touch"/"R7.mp3")),g(.5),b[int(2.05*SR):]]))
    if k=="C":  # L19 swapped -> R19 minus its unscripted laugh; a 1.35 s beat (1.04 s at 1.3x) before the button
        c=load(D/"take_touch"/"C.mp3"); r=clip(load(D/"take_touch"/"R19.mp3"),0.93)
        return np.concatenate([tighten(c[:int(20.2*SR)]),g(.45),r,g(1.35),clip(c,21.25)])
    return tighten(load(D/"take_touch"/f"{k}.mp3"))
for k in "ABC":
    x=build(k); idx=np.where(np.abs(x)>TH)[0]; x=x[idx[0]:idx[-1]+1]
    parts += [x, np.zeros(int(BATCHGAP*SR),dtype="<f4")]
v=np.concatenate(parts[:-1]); v=v/np.max(np.abs(v))*0.89
with wave.open(str(D/"voice_touch_1x.wav"),"wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((v*32767).astype("<i2").tobytes())
print("voice_touch_1x.wav", round(len(v)/SR,2),"s")
