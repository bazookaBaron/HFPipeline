import json,re,sys,numpy as np,librosa
from pathlib import Path
D=Path(__file__).parent; S=D.parent/"episodes"/"incognito"/"script.md"
L=[]
for l in S.read_text(encoding="utf8").split("#end")[0].splitlines():
    m=re.match(r"(LEO|WALTER) \(([^)]*)\) \[[^\]]*\]: (.*)",l)
    if m: L.append((m[1],m[3]))
nl=lambda x:re.sub(r'[^a-z0-9]','',x.lower().replace('200','twohundred').replace('30','thirty'))
B={"A":range(0,6),"B":range(6,12),"C":range(12,18)}
for k in sys.argv[1:]:
    w=json.load(open(D/"take_incognito"/f"{k}.json")); y,sr=librosa.load(D/"take_incognito"/f"{k}.mp3",sr=16000); i=0
    for n in (B[k] if k in B else [int(k[1:])-1]):
        tgt=len(re.sub(r'[^a-z]','',L[n][1].lower().replace('wifi','wifi')));acc='';j=i
        while j<len(w) and len(acc)<tgt-1: acc+=re.sub(r'[^a-z]','',w[j][2].lower()); j+=1
        ws=w[i:j]; i=j
        seg=y[int(ws[0][0]*sr):int((ws[-1][1]+.1)*sr)]
        f0,vf,_=librosa.pyin(seg,fmin=70,fmax=400,sr=sr); f=f0[vf&~np.isnan(f0)]
        print(f"L{n+1:2d} {L[n][0]:6s} f0={np.median(f) if len(f) else 0:6.1f} dur={ws[-1][1]-ws[0][0]:.1f}")
