"""Campfire sketch audio: voice.wav + synthesized soothing bed (pad + soft plucks) + campfire ambience + sparse foley.
No stinger before the last line; the fire fades out after it. Writes campfire_faceid_1p3x.wav / .mp3"""
import json, numpy as np, subprocess
from pathlib import Path
from scipy.io import wavfile
from scipy.signal import fftconvolve, butter, sosfilt
D=Path(__file__).parent; SFX=D.parent/"sfx"; SR=48000
rng=np.random.default_rng(7)
def rd(p):
    sr,x=wavfile.read(p); x=x.astype(np.float32)/32768
    assert sr==SR,(p,sr)
    return x if x.ndim==2 else np.stack([x,x],1)
def lp(x,f,o=2): return sosfilt(butter(o,f,"low",fs=SR,output="sos"),x,axis=0)
def hp(x,f,o=2): return sosfilt(butter(o,f,"high",fs=SR,output="sos"),x,axis=0)
v=rd(D/"voice_faceid.wav")[:,0]; TAIL=4.0
N=len(v)+int(TAIL*SR); T=N/SR
voice=np.zeros(N,np.float32); voice[:len(v)]=v
# ---- music: Am - F - C - G, 66 bpm
bpm=66; beat=60/bpm; bar=4*beat
chords=[(57,[0,7,12,15]),(53,[0,7,12,16]),(48,[0,7,12,16]),(55,[0,7,12,16])]  # root midi + intervals (pad voicing)
arp=[(57,[0,3,7,12]),(53,[0,4,7,12]),(48,[0,4,7,12]),(55,[0,4,7,11])]
f=lambda m:440*2**((m-69)/12)
t=np.arange(N)/SR
pad=np.zeros(N,np.float32)
nb=int(np.ceil(T/bar))+1
for b in range(nb):
    root,iv=chords[b%4]; s0=int(b*bar*SR)
    if s0>=N: break
    ln=int((bar+1.6)*SR)
    tt=np.arange(ln)/SR; env=np.minimum(tt/1.4,1)*np.clip((bar+1.6-tt)/1.6,0,1)
    for k,i in enumerate(iv):
        fr=f(root+i-12*(k==0)+12*(k>0))
        for dt in (-0.9,0,0.9):
            w=np.sin(2*np.pi*(fr+dt*0.3)*tt)+0.25*np.sin(2*np.pi*2*fr*tt)+0.08*np.sin(2*np.pi*3*fr*tt)
            seg=(w*env*0.05).astype(np.float32); e=min(N,s0+ln); pad[s0:e]+=seg[:e-s0]
pad=lp(pad,1800)
def pluck(fr,dur=2.2):
    n=int(dur*SR); p=int(SR/fr); buf=rng.uniform(-1,1,p); buf=lp(buf,4000,1)
    out=np.zeros(n,np.float32)
    for i in range(n):
        out[i]=buf[i%p]; buf[i%p]=0.5*(buf[i%p]+buf[(i+1)%p])*0.9965
    return out*np.exp(-np.arange(n)/SR/1.4)
pl=np.zeros(N,np.float32); step=beat/2
for b in range(0):
    root,iv=arp[b%4]
    for j in range(8):
        if rng.random()<0.25: continue
        m=root+12+iv[[0,1,2,3,2,1,3,2][j]]
        s0=int((b*bar+j*step)*SR+rng.integers(0,400))
        if s0>=N: break
        pk=pluck(f(m),1.8)*(0.10 if j%2==0 else 0.065); e=min(N,s0+len(pk)); pl[s0:e]+=pk[:e-s0]
# cheap reverb
ir=(rng.standard_normal(int(2.2*SR))*np.exp(-np.arange(int(2.2*SR))/SR/0.7)).astype(np.float32); ir=lp(ir,3500,1)
rv=fftconvolve(pl,ir)[:N]*0.012
music=pad+pl+rv
mfade=np.clip(t/3,0,1)*np.clip((T-t)/3.5,0,1)
music=music*mfade
# duck: -5 dB while voice speaks
env=np.sqrt(np.convolve(voice**2,np.ones(int(0.12*SR))/int(0.12*SR),"same"))
duck=1-0.44*np.clip(env/0.05,0,1); duck=np.convolve(duck,np.ones(int(0.25*SR))/int(0.25*SR),"same")
music=music*duck
mus=np.stack([music,np.roll(music,int(0.011*SR))],1)
# ---- ambience: crackle bed, fire fades out over the last line
def loop(x,n):
    r=int(np.ceil(n/len(x)))+1; y=np.tile(x,(r,1))[:n]; return y
fire=loop(rd(SFX/"amb/campfire/campfire_close.wav"),N)
cri=loop(rd(SFX/"amb/forest/forest_crickets.wav"),N)
tail0=len(v)/SR-3.0
fireenv=np.where(t<tail0,1,np.clip(1-(t-tail0)/(T-tail0)*0.88,0.12,1))
fireenv=np.minimum(fireenv,np.clip(t/2,0,1)+0.0)
amb=fire*(0.55*fireenv)[:,None]+cri*(0.25*np.clip(t/3,0,1)*np.clip((T-t)/2,0,1))[:,None]
# ---- foley
fol=np.zeros((N,2),np.float32)
def put(path,at,g):
    x=rd(SFX/path); s=int(at*SR); e=min(N,s+len(x)); 
    if s<N: fol[s:e]+=x[:e-s]*g
words=json.load(open(D/"words_faceid.json"))
tm={}
for ws,we,w in words: tm.setdefault(w.strip(".,?!'").lower(),[]).append((ws,we))
put("foley/fire_ember_pop_01.wav",3.0,0.35)       # "dying"
put("foley/fire_ember_pop_02.wav",14.0,0.3)
#put("foley/cloth_rustle_01.wav",tm["okay"][0][0]-0.3,0.4)          # Leo shifts ("Okay.")
put("foley/fire_ember_pop_03.wav",30.0,0.35)
#put("foley/fire_log_shift_02.wav",tm["pocket"][-1][1]+0.4,0.8)  # after "pocket"
put("foley/fire_ember_pop_01.wav",44.0,0.3)
put("foley/fire_ember_pop_02.wav",len(v)/SR+0.9,0.4)         # last ember after "out."
put("amb/birds/birds_owl_02.wav",len(v)/SR+1.8,0.5)          # owl AFTER the final line
# ---- mix + master
bed=mus*1.0+amb*1.0+fol
out=np.stack([voice,voice],1)*1.0+bed*0.0
vv=np.stack([voice,voice],1)
# gentle voice presence: tiny reverb-free EQ
vv=hp(vv,70,2)
mix=vv*1.0+mus*0.20+amb*0.45+fol*0.8
pk=np.abs(mix).max(); mix=mix/pk*0.89
wavfile.write(D/"campfire_faceid_1p3x.wav",SR,(mix*32767).astype("<i2"))
wavfile.write(D/"campfire_faceid_1p3x_stems_music.wav",SR,(np.clip(mus*0.20/pk*0.89,-1,1)*32767).astype("<i2"))
subprocess.run(["ffmpeg","-y","-v","error","-i",str(D/"campfire_faceid_1p3x.wav"),"-b:a","192k",str(D/"campfire_faceid_1p3x.mp3")],check=True)
r=subprocess.run(["ffmpeg","-hide_banner","-i",str(D/"campfire_faceid_1p3x.wav"),"-af","ebur128","-f","null","-"],capture_output=True,text=True).stderr
print("len",round(T,1),"s |",[l for l in r.splitlines() if "I:" in l][-1].strip())
