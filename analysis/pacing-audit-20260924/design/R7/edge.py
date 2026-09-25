import sys; from util import *; import numpy as np
# track top y of dark bar (lum<60) along column band x0-x1 within y range; also left x of dark at row
t0,dur,x0,x1,y0,y1=float(sys.argv[1]),float(sys.argv[2]),*map(int,sys.argv[3:7])
ts,a=frames(t0,dur)
for t,f in zip(ts,a):
    g=f[y0:y1,x0:x1].mean(2); rows=np.where((g<70).mean(1)>0.5)[0]
    top=rows.min()+y0 if len(rows) else None; 
    # left/right of dark bar at that row
    if top is not None:
        rr=np.where(f[top+3,:].mean(1)<70)[0]; lr=(rr.min(),rr.max(),top+3) if len(rr) else None
    else: lr=None
    print(f"{t:8.3f} top={top} lr={lr} lum={g.mean():.1f}")
