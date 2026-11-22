"""send episode: replace two whispered Leo lines (L3 "Through the air?", L9 "So my text goes swimming?") in voice_send_1x.wav
with the single-line re-rolls take_send/R3.mp3, R9.mp3. Boundaries from the first ASR pass (words_send.json, 1.5x times x1.5),
the right edge snapped to the next speech onset by energy. Keeps voice_send_1x_orig.wav."""
import subprocess, numpy as np, wave, shutil
from pathlib import Path
D=Path(__file__).parent; SR=48000; TH=10**(-38/20)
src=D/"voice_send_1x_orig.wav"
if not src.exists(): shutil.copy(D/"voice_send_1x.wav", src)
def load(p): return np.frombuffer(subprocess.run(["ffmpeg","-v","error","-i",str(p),"-ac","1","-ar",str(SR),"-f","f32le","-"],capture_output=True,check=True).stdout,dtype="<f4").copy()
v=load(src)
def env(x): win=int(.01*SR); n=len(x)//win; return np.sqrt((x[:n*win].reshape(n,win)**2).mean(1))
def onset_after(t0,t1):  # first speech onset after the last silence in [t0,t1]
    e=env(v[int(t0*SR):int(t1*SR)]); s=np.where(e<TH)[0]
    if not len(s): return t1
    k=s[-1]; return t0+(k+1)*.01
def trim(x): i=np.where(np.abs(x)>TH)[0]; return x[i[0]:i[-1]+1]
def rms(x): return np.sqrt(np.mean(x[np.abs(x)>TH*3]**2))
out=[]; cur=0.0
for (lend, rwin, take, g1, g2) in [(4.16*1.5, (5.4*1.5, 5.8*1.5+.02), "R3", .62, .55), (19.72*1.5, (21.3*1.5, 21.48*1.5+.75), "R9", .6, .45)]:
    r=onset_after(*rwin); x=trim(load(D/"take_send"/f"{take}.mp3"))
    ref=v[int((lend-1.5)*SR):int(lend*SR)]; x=x*(rms(ref)/rms(x))
    out+=[v[int(cur*SR):int((lend+.05)*SR)], np.zeros(int(g1*SR),"<f4"), x, np.zeros(int(g2*SR),"<f4")]; cur=r-.03
    print(take, f"left {lend:.2f} right onset {r:.2f} new {len(x)/SR:.2f}s")
out.append(v[int(cur*SR):]); y=np.concatenate(out); y=y/np.max(np.abs(y))*.89
with wave.open(str(D/"voice_send_1x.wav"),"wb") as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((y*32767).astype("<i2").tobytes())
print("voice_send_1x.wav", round(len(y)/SR,2), "s")
