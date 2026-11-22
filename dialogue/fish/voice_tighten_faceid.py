"""Join the 3 Fish batches (take_faceid/A-C.mp3) into voice_faceid_1x.wav: B has L9/L10 swapped by Fish -> single-speaker re-rolls R9/R10 spliced in;
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
    import json
    if k=="C":
        c=load(D/"take_faceid"/"C.mp3"); w=json.load(open(D/"take_faceid"/"C.json"))
        ix=[j for j,q in enumerate(w) if q[2].lower().strip('.,!?')=="hypothetically"][-1]
        s=w[ix-1][1]+0.02; e=w[ix][0]-0.04; print("C button gap",round(s,2),round(e,2))
        return np.concatenate([tighten(c[:int(s*SR)]),g(1.35),tighten(c[int(e*SR):])])
    if k=="A":   # L2 and L4 came out in Leo's voice -> single-speaker Walter re-rolls R2, R4 spliced in
        x=load(D/"take_faceid"/"A.mp3"); w=json.load(open(D/"take_faceid"/"A.json")); r2=trim(load(D/"take_faceid"/"R2.mp3")); r4=trim(load(D/"take_faceid"/"R4.mp3"))
        nrm=lambda q:q[2].lower().strip('.,!?')
        i_you=[j for j,q in enumerate(w) if nrm(q)=="you"][0]; i_hyp=[j for j,q in enumerate(w) if nrm(q)=="hypothetically"][0]; i_it=[j for j,q in enumerate(w) if nrm(q)=="it"][0]; i_dots=[j for j,q in enumerate(w) if nrm(q)=="face"][0]+1
        m=lambda j:int((w[j-1][1]+w[j][0])/2*SR)
        l3=x[m(i_hyp):m(i_it)]   # L3 "Hypothetically." (Leo) incl. its own pauses
        rest=x[m(i_dots):]       # L5 onwards
        return tighten(np.concatenate([x[:m(i_you)],r2,g(.3),l3,g(.15),r4,g(.3),rest]))
    return tighten(load(D/"take_faceid"/f"{k}.mp3"))
parts=[]
for k in "ABC": parts += [trim(build(k)), g(BATCHGAP)]
v=np.concatenate(parts[:-1]); v=v/np.max(np.abs(v))*0.89
with wave.open(str(D/"voice_faceid_1x.wav"),"wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((v*32767).astype("<i2").tobytes())
print("voice_faceid_1x.wav", round(len(v)/SR,2),"s")
