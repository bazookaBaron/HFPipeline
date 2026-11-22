"""Join the 4 Fish batches (take_qr/A-C.mp3) into voice_qr_1x.wav: decode, cap every silence > MAXGAP, 0.55 s between batches."""
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
def splice_A():  # A with L2 (swapped voice, 6.44-9.27) replaced by the single-speaker re-roll R2
    a=load(D/"take_qr"/"A.mp3"); r=load(D/"take_qr"/"R2.mp3"); idx=np.where(np.abs(r)>TH)[0]; r=r[idx[0]:idx[-1]+1]
    c0,c1=int(6.12*SR),int(9.55*SR); g=np.zeros(int(0.45*SR),dtype="<f4")
    return np.concatenate([a[:c0],g,r,g,a[c1:]])
for k in "ABC":
    x=tighten(splice_A() if k=="A" else load(D/"take_qr"/f"{k}.mp3"))
    # trim edges
    idx=np.where(np.abs(x)>TH)[0]; x=x[idx[0]:idx[-1]+1]
    parts += [x, np.zeros(int(BATCHGAP*SR),dtype="<f4")]
v=np.concatenate(parts[:-1]); v=v/np.max(np.abs(v))*0.89
with wave.open(str(D/"voice_qr_1x.wav"),"wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((v*32767).astype("<i2").tobytes())
print("voice_qr_1x.wav", round(len(v)/SR,2),"s")
