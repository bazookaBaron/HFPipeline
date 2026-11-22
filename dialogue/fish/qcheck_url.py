"""Per-line pitch/pace check of take_url batches: median f0 per line vs speaker (Leo should be higher than Walter)."""
import json, re, sys, numpy as np, librosa
from pathlib import Path
D=Path(__file__).parent; S=D.parent/"episodes"/"url_enter"/"script.md"
L=[]
for l in S.read_text(encoding="utf8").split("#end")[0].splitlines():
    m=re.match(r"(LEO|WALTER) \(([^)]*)\) \[[^\]]*\]: (.*)",l)
    if m: L.append((m[1],m[3]))
nl=lambda x:re.sub(r'[^a-z]','',x.lower())
def lseg(w,i,t):
    n=len(nl(t)); j=i; acc=''
    while j<len(w) and len(acc)<n-1: acc+=nl(w[j][2]); j+=1
    return w[i:j]
B={"A":range(0,6),"B":range(6,12),"C":range(12,20)}
for k in (sys.argv[1:] or "ABC"):
    w=json.load(open(D/"take_url"/f"{k}.json")); y,sr=librosa.load(D/"take_url"/f"{k}.mp3",sr=16000); i=0
    idx=B[k] if k in B else [int(k[1:])-1]
    for n in idx:
        sp,t=L[n]; ws=lseg(w,i,t); i+=len(ws); c=len(ws)
        a,b=ws[0][0],ws[-1][1]+0.25; f0,_,_=librosa.pyin(y[int(a*sr):int(b*sr)],fmin=60,fmax=450,sr=sr); f=f0[~np.isnan(f0)]
        st=12*np.log2(f/np.median(f)) if len(f) else np.array([0])
        print(f"L{n+1:2d} {sp:6s} f0={np.median(f) if len(f) else 0:5.0f} range={np.percentile(st,95)-np.percentile(st,5):4.1f}st wpm={c/(b-a)*60:4.0f} {a:5.2f}-{b:5.2f} | {' '.join(x[2] for x in ws)}")
