"""Join the 3 Fish batches (take_abr/A-C.mp3) into voice_abr_1x.wav: every silence > MAXGAP capped, 0.55 s between batches, a beat before the dry button (L18)."""
import subprocess, numpy as np, wave, json
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
        if sil[i]: seg=seg[:min(len(seg),int(MAXGAP*SR))]
        out.append(seg); i=j
    return np.concatenate(out)
def trim(x):
    idx=np.where(np.abs(x)>TH)[0]; return x[idx[0]:idx[-1]+1]
g=lambda s:np.zeros(int(s*SR),dtype="<f4")
def build(k):
    c=load(D/"take_abr"/f"{k}.mp3")
    if k=="C":
        w=json.load(open(D/"take_abr"/"C.json")); ix=[j for j,q in enumerate(w) if q[2].lower().strip('.,!?')=="it's"][-1]
        a=int((w[ix][0]-0.35)*SR); b=int((w[ix][0]+0.05)*SR); win=int(.01*SR); seg=c[a:b]; n=len(seg)//win
        env=np.sqrt((seg[:n*win].reshape(n,win)**2).mean(1)); cut=a+int(np.argmin(env))*win+win//2; print("C button cut",round(cut/SR,2),"It's@",w[ix][0])
        return np.concatenate([tighten(c[:cut]),g(1.0),tighten(c[cut:])])
    return tighten(c)
parts=[]
for k in "ABC": parts += [trim(build(k)), g(BATCHGAP)]
v=np.concatenate(parts[:-1]); v=v/np.max(np.abs(v))*0.89
with wave.open(str(D/"voice_abr_1x.wav"),"wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((v*32767).astype("<i2").tobytes())
print("voice_abr_1x.wav", round(len(v)/SR,2),"s")
