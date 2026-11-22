"""Timbre check: per-line mean MFCC (2-20) + delta-free; cosine to Leo/Walter centroids built leave-one-out from all other lines."""
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
B={"A":range(0,6),"B":range(6,12),"C":range(12,20)}; F={}
takes=sys.argv[1:] or ["A","B","C"]
for k in takes:
    w=json.load(open(D/"take_url"/f"{k}.json")); y,sr=librosa.load(D/"take_url"/f"{k}.mp3",sr=16000); i=0
    for n in (B[k] if k in B else [int(k[1:])-1]):
        ws=lseg(w,i,L[n][1]); i+=len(ws)
        seg=y[int(ws[0][0]*sr):int((ws[-1][1]+.2)*sr)]; M=librosa.feature.mfcc(y=seg,sr=sr,n_mfcc=20)
        e=librosa.feature.rms(y=seg)[0]; v=M[:, e[:M.shape[1]]>np.median(e)]
        F[n]=np.concatenate([v[1:].mean(1),v[1:].std(1)])
X=np.array(list(F.values())); mu,sd=X.mean(0),X.std(0)+1e-6
for n in F:
    z=lambda j:(F[j]-mu)/sd
    cl={s:np.mean([z(j) for j in F if j!=n and L[j][0]==s],0) for s in ("LEO","WALTER")}
    cos={s:float(np.dot(z(n),c)/np.linalg.norm(z(n))/np.linalg.norm(c)) for s,c in cl.items()}
    best=max(cos,key=cos.get); print(f"L{n+1:2d} {L[n][0]:6s} leo={cos['LEO']:+.2f} wal={cos['WALTER']:+.2f} {'OK' if best==L[n][0] else '<<< SWAP?'}")
