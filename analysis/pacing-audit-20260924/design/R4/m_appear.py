from m_trans2 import *
BODY=np.array([254,252,248])
def appear(t0,t1,regions,bg=BODY,th=60,tref=None):
    F=frames(t0,t1); B=frames(tref,tref+0.04)[0][1] if tref else F[-1][1]; A=F[0][1]
    res={}
    for name,(x0,y0,x1,y1) in regions.items():
        b=B[y0:y1,x0:x1]; a=A[y0:y1,x0:x1]
        dB=np.abs(b-bg).sum(-1); dA=np.abs(a-bg).sum(-1); m=(dB>th)&(dA<20)
        seq=[]
        for t,f in F:
            c=f[y0:y1,x0:x1]; d=np.abs(c-bg).sum(-1); op=d[m].mean()/dB[m].mean() if m.sum() else np.nan
            seq.append((t,op,vshift(c,b,8) if op>0.15 else np.nan))
        s=next((t for t,o,_ in seq if o>0.04),None); e=next((t for t,o,_ in seq if o>=0.95),None)
        prof=' '.join(f'{o:.2f}/{sh:+.1f}' for t,o,sh in seq if s and t>=s-0.034 and (e is None or t<=e+0.001))
        print(f'{name}: start {s if s is None else round(s,3)} settle {e if e is None else round(e,3)} | {prof}')
        res[name]=seq
    return res
