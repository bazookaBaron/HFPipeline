from m_frames import frames
from m_util import hx
import numpy as np
def colmask(kind):
    if kind=='blue': return lambda p:(p[...,2]-p[...,0]>70)&(p[...,2]>140)
    if kind=='purple': return lambda p:(p[...,2]-p[...,1]>40)&(p[...,0]-p[...,1]>15)
    if kind=='green': return lambda p:(p[...,1]-p[...,0]>40)&(p[...,1]-p[...,2]>5)
def polyline(pts):
    out=[]
    for (x0,y0),(x1,y1) in zip(pts,pts[1:]):
        n=max(abs(x1-x0),abs(y1-y0))
        for i in range(n): out.append((round(x0+(x1-x0)*i/n),round(y0+(y1-y0)*i/n)))
    out.append(pts[-1]); return out
def reveal(t0,t1,pts,kind='blue',w=1):
    P=polyline(pts); m=colmask(kind); F=frames(t0,t1); res=[]
    for t,f in F:
        ok=[]
        for x,y in P:
            patch=f[y-w:y+w+1,x-w:x+w+1]; ok.append(m(patch).any())
        ok=np.array(ok)
        # leading contiguous revealed length from start
        L=len(ok) if ok.all() else int(np.argmin(ok))
        res.append((t,L,ok.sum(),len(ok)))
    return res
def reveal2(t0,t1,pts,w=1,tfinal=None):
    P=polyline(pts); F=frames(t0,t1); G=F[0][1].astype(float); Fi=(frames(tfinal,tfinal+0.04)[0][1] if tfinal else F[-1][1]).astype(float)
    res=[]
    for t,f in F:
        ok=[]
        for x,y in P:
            best=None
            # use darkest (most saturated) px in small patch across line width
            pf=f[y-w:y+w+1,x-w:x+w+1].reshape(-1,3).astype(float); pg=G[y-w:y+w+1,x-w:x+w+1].reshape(-1,3); pF=Fi[y-w:y+w+1,x-w:x+w+1].reshape(-1,3)
            i=np.argmin(pF.sum(1)); c=pf[i]; dg=np.abs(c-pg[i]).sum(); dF=np.abs(c-pF[i]).sum()
            ok.append(dF<dg)
        ok=np.array(ok); L=len(ok) if ok.all() else int(np.argmin(ok)); res.append((t,L,ok.sum(),len(ok)))
    return res
def show(name,r):
    prev=0; out=[]
    for t,L,s,n in r:
        if L!=prev: out.append(f'{t:.3f}:{L}(+{L-prev})')
        prev=L
    print(name,'len',r[0][3],' '.join(out))
