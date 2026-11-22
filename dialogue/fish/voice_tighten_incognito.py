"""Join the 3 Fish batches (take_incognito/A-C.mp3) into voice_incognito_1x.wav: B has L9/L10 swapped by Fish -> single-speaker re-rolls R9/R10 spliced in;
every silence > MAXGAP capped, 0.55 s between batches, a beat before the dry button (L20)."""
import subprocess, numpy as np, wave
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
def longest_silence(x,a,b):
    """start/end (s) of the longest sub-TH run inside [a,b] s"""
    win=int(.01*SR); s0=int(a*SR); seg=x[s0:int(b*SR)]; n=len(seg)//win
    env=np.sqrt((seg[:n*win].reshape(n,win)**2).mean(1)); sil=env<TH; best=(0,0,0); i=0
    while i<n:
        if sil[i]:
            j=i
            while j<n and sil[j]: j+=1
            if j-i>best[0]: best=(j-i,i,j)
            i=j
        else: i+=1
    return a+best[1]*win/SR, a+best[2]*win/SR
def build(k):
    if k=="A":
        import json
        x=load(D/"take_incognito"/"A.mp3"); r1=trim(load(D/"take_incognito"/"R1.mp3")); w=json.load(open(D/"take_incognito"/"A.json"))
        i=[j for j,q in enumerate(w) if q[2].lower().startswith("nobody")][0] if False else None
        ix=[j for j,q in enumerate(w) if q[2].lower().strip('.,!?')=="browse"][0]
        m=(w[ix][1]+w[ix+1][0])/2; print("A splice after browse",round(m,2))
        return tighten(np.concatenate([r1,g(.25),x[int(m*SR):]]))
    if k=="C":
        c=load(D/"take_incognito"/"C.mp3"); import json; w=json.load(open(D/"take_incognito"/"C.json"))
        ix=[j for j,q in enumerate(w) if q[2].lower().strip('.,!?')=="sister"][-1]   # Hiding...your sister? last = "Your sister doesn't": find the shoe shop line start
        ia=[j for j,q in enumerate(w) if q[2].lower().strip('.,!?')=="all"][-1]
        s=w[ia][1]+0.02; e=w[ia+1][0]-0.02; print("C button gap",round(s,2),round(e,2))
        return np.concatenate([tighten(c[:int(s*SR)]),g(1.35),tighten(c[int(e*SR):])])
    return tighten(load(D/"take_incognito"/f"{k}.mp3"))
parts=[]
for k in "ABC": parts += [trim(build(k)), g(BATCHGAP)]
v=np.concatenate(parts[:-1]); v=v/np.max(np.abs(v))*0.89
with wave.open(str(D/"voice_incognito_1x.wav"),"wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((v*32767).astype("<i2").tobytes())
print("voice_incognito_1x.wav", round(len(v)/SR,2),"s")
