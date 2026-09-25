from mot import *
def edges(F,ref=BG):
    out=[]
    for f in F:
        d=np.abs(f-ref).sum(2).astype(float)
        if d.max()<20: out.append(None); continue
        col=d.mean(0); row=d.mean(1)
        # card fill differs from bg by ~ (254-243)*... use fill mask
        m=d>8
        cols=np.where(m.mean(0)>0.5)[0]; rows=np.where(m.mean(1)>0.5)[0]
        out.append((cols.min() if len(cols) else None, cols.max() if len(cols) else None, rows.min() if len(rows) else None, rows.max() if len(rows) else None))
    return out
for name,t0,t1,x,y,w,h in [('S12 billing card edges (L,R,T,B) abs@720',40.93,41.33,180,500,510,200),('S01 app card',0.10,0.50,180,520,510,180),('S02 WT card',2.10,2.45,180,590,510,210),('S10 green strip',33.60,33.95,200,470,480,120)]:
    F=frames(t0,t1,x,y,w,h); e=edges(F)
    show(name,t0,[None if v is None else tuple(None if q is None else int(q)+(x if i<2 else y) for i,q in enumerate(v)) for v in e])
