import numpy as np
from collections import deque
def label(mask):
    H,W=mask.shape; lab=np.zeros(mask.shape,np.int32); n=0; comps=[]
    ys,xs=np.nonzero(mask)
    for y0,x0 in zip(ys,xs):
        if lab[y0,x0]: continue
        n+=1; q=deque([(y0,x0)]); lab[y0,x0]=n; pts=[]
        while q:
            y,x=q.popleft(); pts.append((y,x))
            for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
                yy,xx=y+dy,x+dx
                if 0<=yy<H and 0<=xx<W and mask[yy,xx] and not lab[yy,xx]:
                    lab[yy,xx]=n; q.append((yy,xx))
        comps.append(np.array(pts))
    return lab,comps
