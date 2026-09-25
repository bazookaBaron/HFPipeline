import sys, numpy as np
from util import *
from scipy import ndimage
t0,t1=float(sys.argv[1]),float(sys.argv[2]); x0,y0,x1,y1=[int(v) for v in sys.argv[3].split(",")]
thr=int(sys.argv[4]) if len(sys.argv)>4 else 250
for t,a in frames(t0,t1):
    s=a[y0:y1,x0:x1]; m=s.min(2)>=thr
    lab,n=ndimage.label(m)
    if n==0: print("%.3f none"%t); continue
    sizes=ndimage.sum(m,lab,range(1,n+1)); k=int(np.argmax(sizes))+1
    ys,xs=np.where(lab==k)
    print("%.3f x %.1f-%.1f y %.1f-%.1f w %.1f h %.1f area %d"%(t,(xs.min()+x0)*1.5,(xs.max()+x0+1)*1.5,(ys.min()+y0)*1.5,(ys.max()+y0+1)*1.5,(xs.max()-xs.min()+1)*1.5,(ys.max()-ys.min()+1)*1.5,sizes[k-1]))
