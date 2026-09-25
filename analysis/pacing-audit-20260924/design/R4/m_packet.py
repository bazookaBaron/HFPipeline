from m_frames import frames
import numpy as np
def boxsum(m,k):
    c=np.pad(m.astype(int),((1,0),(1,0))).cumsum(0).cumsum(1)
    return c[k:,k:]-c[:-k,k:]-c[k:,:-k]+c[:-k,:-k]
def track(t0,t1,kind="blue",region=(204,360,700,860),k=11):
    x0,y0,x1,y1=region; out=[]
    for t,f in frames(t0,t1,(x0,y0,x1-x0,y1-y0)):
        if kind=='blue': m=(f[...,2]-f[...,0]>70)&(f[...,2]>140)
        elif kind=='purple': m=(f[...,2]-f[...,1]>40)&(f[...,0]-f[...,1]>15)
        else: m=(f[...,1]-f[...,0]>40)&(f[...,1]-f[...,2]>5)
        s=boxsum(m,k); core=s>=k*k*0.8
        ys,xs=np.nonzero(core)
        if len(ys)==0: out.append((t,None)); continue
        # cluster by simple labeling on grid of 30px
        pts=np.stack([xs,ys],1); clusters=[]
        for p in pts:
            for c in clusters:
                if abs(c[0][0]-p[0])<30 and abs(c[0][1]-p[1])<30: c.append(p); break
            else: clusters.append([p])
        cs=[(x0+np.mean([q[0] for q in c])+k/2, y0+np.mean([q[1] for q in c])+k/2, len(c)) for c in clusters if len(c)>5]
        out.append((t,cs))
    return out
