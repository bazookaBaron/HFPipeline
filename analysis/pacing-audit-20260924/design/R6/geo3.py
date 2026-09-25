from PIL import Image; import numpy as np, sys
from util import hx
f=sys.argv[1]
a=np.asarray(Image.open(f).convert("RGB")).astype(int)
bg=np.array([237,241,243])
def scan_col(x,y0=0,y1=1280,thr=10):
    d=np.abs(a[y0:y1,x]-bg).sum(1)>thr
    segs=[];s=None
    for i,v in enumerate(d):
        if v and s is None: s=i
        if not v and s is not None: segs.append((y0+s,y0+i-1)); s=None
    if s is not None: segs.append((y0+s,y1-1))
    return [(p,q) for p,q in segs if q-p>=2]
def scan_row(y,x0=0,x1=720,thr=10):
    d=np.abs(a[y,x0:x1]-bg).sum(1)>thr
    segs=[];s=None
    for i,v in enumerate(d):
        if v and s is None: s=i
        if not v and s is not None: segs.append((x0+s,x0+i-1)); s=None
    if s is not None: segs.append((x0+s,x1-1))
    return [(p,q) for p,q in segs if q-p>=2]
for spec in sys.argv[2:]:
    k,v=spec[0],int(spec[1:])
    segs=scan_col(v) if k=="x" else scan_row(v)
    print(spec, [(round(p*1.5,1),round(q*1.5+1.5,1)) for p,q in segs])
