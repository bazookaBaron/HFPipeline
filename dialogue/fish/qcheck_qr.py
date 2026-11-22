"""Per-line pitch/pace check of take_qr batches: median f0 per line vs speaker (Leo should be higher than Walter)."""
import json, re, sys, numpy as np, librosa
from pathlib import Path
D=Path(__file__).parent; S=D.parent/"episodes"/"qr"/"script.md"
L=[]
for l in S.read_text(encoding="utf8").split("#end")[0].splitlines():
    m=re.match(r"(LEO|WALTER) \(([^)]*)\) \[[^\]]*\]: (.*)",l)
    if m: L.append((m[1],m[3].replace("thirty percent","30%")))
B={"A":range(0,6),"B":range(6,12),"C":range(12,18)}
for k in (sys.argv[1:] or "ABC"):
    w=json.load(open(D/"take_qr"/f"{k}.json")); y,sr=librosa.load(D/"take_qr"/f"{k}.mp3",sr=16000); i=0
    idx=B[k] if k in B else [int(k[1:])-1]
    for n in idx:
        sp,t=L[n]; c=len(t.split()); ws=w[i:i+c]; i+=c
        a,b=ws[0][0],ws[-1][1]+0.25; f0,_,_=librosa.pyin(y[int(a*sr):int(b*sr)],fmin=60,fmax=450,sr=sr); f=f0[~np.isnan(f0)]
        st=12*np.log2(f/np.median(f)) if len(f) else np.array([0])
        print(f"L{n+1:2d} {sp:6s} f0={np.median(f) if len(f) else 0:5.0f} range={np.percentile(st,95)-np.percentile(st,5):4.1f}st wpm={c/(b-a)*60:4.0f} {a:5.2f}-{b:5.2f} | {' '.join(x[2] for x in ws)}")
