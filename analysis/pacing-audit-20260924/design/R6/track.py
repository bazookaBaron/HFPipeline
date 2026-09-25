import sys, numpy as np
from util import *
t0,t1=float(sys.argv[1]),float(sys.argv[2])
x0,y0,x1,y1=[int(v) for v in (sys.argv[3].split(",") if len(sys.argv)>3 else "195,240,720,935".split(","))]
mode=sys.argv[4] if len(sys.argv)>4 else "nonbg"
bg=np.array([237,241,243])
prev=None
for t,a in frames(t0,t1):
    s=a[y0:y1,x0:x1].astype(int)
    if mode=="nonbg": m=np.abs(s-bg).sum(2)>40
    elif mode=="dark": m=s.mean(2)<90
    elif mode=="red": m=(s[:,:,0]>150)&(s[:,:,1]<90)&(s[:,:,2]<100)
    elif mode=="blue": m=(s[:,:,2]>170)&(s[:,:,0]<120)
    elif mode=="purple": m=(s[:,:,2]>150)&(s[:,:,0]>70)&(s[:,:,1]<90)
    ys,xs=np.where(m)
    if len(xs)<20: print(f"{t:.3f} none"); continue
    bb=((xs.min()+x0)*1.5,(ys.min()+y0)*1.5,(xs.max()+x0+1)*1.5,(ys.max()+y0+1)*1.5)
    ink=m.sum()
    print(f"{t:.3f} x {bb[0]:.1f}-{bb[2]:.1f} y {bb[1]:.1f}-{bb[3]:.1f} w {bb[2]-bb[0]:.1f} h {bb[3]-bb[1]:.1f} ink {ink} lum {s.mean():.1f}")
