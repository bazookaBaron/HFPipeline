# prof.py img axis(x|y) fixed a0 a1 : print pixel hex along a line, collapsing runs of similar colour
import sys, numpy as np
from PIL import Image
f=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(int)
ax,fixed,a0,a1=sys.argv[2],int(sys.argv[3]),int(sys.argv[4]),int(sys.argv[5])
prev=None; start=a0; out=[]
for a in range(a0,a1+1):
    p=f[fixed,a] if ax=='x' else f[a,fixed]
    if prev is None or np.abs(p-prev).max()>10:
        out.append(f"{a}:#{p[0]:02x}{p[1]:02x}{p[2]:02x}")
        prev=p
print(' '.join(out))
