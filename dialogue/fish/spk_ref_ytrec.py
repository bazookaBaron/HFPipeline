"""Speaker check against approved episodes: centroids of Leo/Walter built from the final voices of earlier episodes (their lines come from shots.json), then each ytrec line (final 1.3x voice) classified."""
import json, re, sys, numpy as np, librosa, warnings; warnings.filterwarnings("ignore")
from pathlib import Path
D=Path(__file__).parent; EP=D.parent/"episodes"
def feat(y,sr):
    M=librosa.feature.mfcc(y=y,sr=sr,n_mfcc=20); e=librosa.feature.rms(y=y)[0]; v=M[:,e[:M.shape[1]]>np.median(e)]
    f0,vf,_=librosa.pyin(y,fmin=70,fmax=350,sr=sr); f=f0[vf&~np.isnan(f0)]
    return np.concatenate([v[1:].mean(1),v[1:].std(1)]), (np.median(f) if len(f) else np.nan)
X={"A":[],"B":[]}; F0={"A":[],"B":[]}
for name,vf in [("incognito","voice_incognito.wav"),("wifi_crowd","voice_wifi.wav"),("url_enter","voice_url.wav"),("qr","voice_qr.wav"),("touch","voice_touch.wav")]:
    try: E=json.load(open(EP/name/"shots.json")); y,sr=librosa.load(D/vf,sr=16000)
    except Exception as ex: print("skip",name,ex); continue
    for l in E["lines"]:
        seg=y[int(l["s"]*sr):int(l["e"]*sr)]
        if len(seg)<sr*.6: continue
        f,p=feat(seg,sr); X[l["sp"]].append(f); F0[l["sp"]].append(p)
print("ref lines",{k:len(v) for k,v in X.items()},"f0 median",{k:round(float(np.nanmedian(v)),1) for k,v in F0.items()})
allx=np.array(X["A"]+X["B"]); mu,sd=allx.mean(0),allx.std(0)+1e-6; z=lambda a:(a-mu)/sd
cen={k:np.mean([z(f) for f in v],0) for k,v in X.items()}
# ytrec
S=(EP/"ytrec"/"script.md").read_text(encoding="utf8").split("#end")[0].splitlines()
L=[(m[1],m[2]) for m in (re.match(r"(LEO|WALTER) \([^)]*\) \[[^\]]*\]: (.*)",l) and re.match(r"(LEO|WALTER) \([^)]*\) \[[^\]]*\]: (.*)",l) for l in S) if m] if False else []
for l in S:
    m=re.match(r"(LEO|WALTER) \([^)]*\) \[[^\]]*\]: (.*)",l)
    if m: L.append((m[1],m[2]))
w=json.load(open(D/"words_ytrec.json")); y,sr=librosa.load(D/"voice_ytrec.wav",sr=16000)
nl=lambda x:re.sub(r'[^a-z]','',x.lower().replace("40","forty").replace(",000","thousand"))
i=0; bad=0
for n,(sp,t) in enumerate(L):
    tgt=len(nl(t)); acc=''; j=i
    while j<len(w) and len(acc)<tgt-1: acc+=nl(w[j][2]); j+=1
    ws=w[i:j]; i=j; seg=y[int(ws[0][0]*sr):int((ws[-1][1]+.1)*sr)]; f,p=feat(seg,sr); zf=z(f)
    cs={k:float(zf@c/np.linalg.norm(zf)/np.linalg.norm(c)) for k,c in cen.items()}; best="LEO" if cs["B"]>cs["A"] else "WALTER"
    ok=best==sp; bad+=not ok
    print(f"L{n+1:2d} {sp:6s} leoSim={cs['B']:+.2f} walSim={cs['A']:+.2f} f0={p:6.1f} {'OK' if ok else '<<< SWAP?'}")
print("mismatches",bad)
