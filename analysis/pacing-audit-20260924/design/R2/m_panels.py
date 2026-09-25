from m_util import *
import sys
S=1.5
def seg(v,minlen,gap=2):
    out=[];i=0;n=len(v)
    while i<n:
        if v[i]:
            s=i;g=0
            while i<n and (v[i] or g<gap):
                g=0 if v[i] else g+1; i+=1
            e=i-g
            if e-s>=minlen: out.append((s,e))
        else: i+=1
    return out
def xycut(m,y0,y1,x0,x1,depth,out,minlen=6):
    sub=m[y0:y1,x0:x1]
    if depth%2==0: rs=seg(sub.sum(1)>2,minlen)
    else: rs=seg(sub.sum(0)>2,minlen)
    if len(rs)==1 and depth>0 and rs[0]==(0,(y1-y0) if depth%2==0 else (x1-x0)) or depth>=4:
        out.append((y0,y1,x0,x1));return
    if not rs: return
    for s,e in rs:
        if depth%2==0: xycut(m,y0+s,y0+e,x0,x1,depth+1,out)
        else: xycut(m,y0,y1,x0+s,x0+e,depth+1,out)
def panels(p,thr=5,xmin=0,ymin=100,ymax=900):
    a=load(p); m=a.max(2)>thr; m[:,:xmin]=False; m[:ymin]=False; m[ymax:]=False
    # kill isolated grid dots: require 3x3 neighbourhood
    k=m[1:-1,1:-1]&m[:-2,1:-1]&m[2:,1:-1]&m[1:-1,:-2]&m[1:-1,2:]; m2=np.zeros_like(m); m2[1:-1,1:-1]=k
    out=[]; xycut(m2,0,1280,0,720,0,out); res=[]
    for y0,y1,x0,x1 in out:
        sub=m2[y0:y1,x0:x1]; ys=np.where(sub.any(1))[0]; xs=np.where(sub.any(0))[0]
        y0,y1,x0,x1=y0+ys.min(),y0+ys.max()+1,x0+xs.min(),x0+xs.max()+1
        if (y1-y0)*(x1-x0)<400: continue
        r=a[y0:y1,x0:x1].reshape(-1,3); u,c=np.unique(r,axis=0,return_counts=True)
        res.append((x0*S,x1*S,y0*S,y1*S,(x1-x0)*S,(y1-y0)*S,hx(u[c.argmax()]),c.max()/len(r)))
    return res
if __name__=='__main__':
    xmin=int(sys.argv[1])
    for f in sys.argv[2:]:
        for o in panels(f,xmin=xmin): print(f,'x %.1f-%.1f y %.1f-%.1f  w %.1f h %.1f  modal %s (%.0f%%)'%(o[:7]+(o[7]*100,)))
        print()
