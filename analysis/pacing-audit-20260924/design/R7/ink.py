import sys; from util import *; import numpy as np
# per-frame ink bbox (non-bg) in region + diff
t0,dur,x0,y0,x1,y1=float(sys.argv[1]),float(sys.argv[2]),*map(int,sys.argv[3:7])
th=int(sys.argv[7]) if len(sys.argv)>7 else 60
ts,a=frames(t0,dur); prev=None
for t,f in zip(ts,a):
    r=f[y0:y1,x0:x1].astype(int); m=np.abs(r-np.array([241,241,234])).sum(2)>th
    ys,xs=np.where(m); dd=int((np.abs(r-prev).sum(2)>60).sum()) if prev is not None else 0; prev=r
    bb=(xs.min()+x0,xs.max()+x0,ys.min()+y0,ys.max()+y0) if len(xs) else None
    print(f"{t:8.3f} ink={m.sum():6d} diff={dd:6d} bbox={bb} lum={r.mean():.1f}")
