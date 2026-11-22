import numpy as np, librosa
from pathlib import Path
exec(open(Path(__file__).parent/"pitch_compress.py").read().split("for k,L")[0])
F={};SP={}
for k,L in S.items():
    y,sr=librosa.load(D/f"{k}.mp3",sr=16000)
    for i,(n,sp,a) in enumerate(L):
        b=L[i+1][2] if i+1<len(L) else len(y)/sr; seg=y[int(a*sr):int(b*sr)]
        M=librosa.feature.mfcc(y=seg,sr=sr,n_mfcc=20); e=librosa.feature.rms(y=seg)[0]; v=M[:,e[:M.shape[1]]>np.median(e)]
        F[n]=np.concatenate([v[1:].mean(1),v[1:].std(1)]); SP[n]=sp
X=np.array(list(F.values())); mu,sd=X.mean(0),X.std(0)+1e-6
z=lambda j:(F[j]-mu)/sd
for n in F:
    cl={s:np.mean([z(j) for j in F if j!=n and SP[j]==s],0) for s in ("LEO","WAL")}
    c={s:float(np.dot(z(n),v)/np.linalg.norm(z(n))/np.linalg.norm(v)) for s,v in cl.items()}
    print(f"L{n:2d} {SP[n]} leo={c['LEO']:+.2f} wal={c['WAL']:+.2f} {'OK' if max(c,key=c.get)==SP[n] else '<<< SWAP?'}")
