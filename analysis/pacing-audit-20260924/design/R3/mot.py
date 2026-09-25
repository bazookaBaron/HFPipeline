import subprocess, numpy as np, sys
V="C:/Users/debna/Downloads/igexport-DdSc-I9IqNC.mp4"
def frames(t0,t1,x,y,w,h):
    w-=w%2; h-=h%2; x-=x%2; y-=y%2
    cmd=["ffmpeg","-v","error","-ss",f"{t0}","-i",V,"-t",f"{t1-t0}","-vf",f"crop={w}:{h}:{x}:{y}","-f","rawvideo","-pix_fmt","rgb24","-"]
    b=subprocess.run(cmd,capture_output=True).stdout
    n=len(b)//(w*h*3); return np.frombuffer(b[:n*w*h*3],np.uint8).reshape(n,h,w,3).astype(int)
BG=np.array([243,243,236])
def progress(F,ref_first=True):
    a=F[0]; z=F[-1]; den=np.abs(z-a).sum()
    return [np.abs(f-a).sum()/den for f in F]
def extent(F,axis,thr=80,ref=BG):
    out=[]
    for f in F:
        m=np.abs(f-ref).sum(2)>thr
        idx=np.where(m.any(axis=axis))[0]
        out.append((idx.min(),idx.max()) if len(idx) else None)
    return out
def inkcount(F,thr=80,ref=BG): return [int((np.abs(f-ref).sum(2)>thr).sum()) for f in F]
def cent(F,ref=BG,thr=20):
    out=[]
    last=np.abs(F[-1]-ref).sum(2); tot=last.sum()
    for f in F:
        d=np.abs(f-ref).sum(2); d=np.where(d>thr,d,0); s=d.sum()
        if s==0: out.append((0,None,None)); continue
        ys,xs=np.indices(d.shape); out.append((round(s/tot,2),round((d*ys).sum()/s,1),round((d*xs).sum()/s,1)))
    return out
def show(name,t0,vals): print(name); print('  '+' | '.join(f'{t0+i/30:.3f}:{v}' for i,v in enumerate(vals)))
def track(F,ref=BG,rng=30,axis=0):
    """alpha (least squares scale vs final) and shift(px, + = frame content is lower/right than final) via NCC"""
    Z=(F[-1]-ref).sum(2).astype(float); out=[]
    for f in F:
        D=(f-ref).sum(2).astype(float)
        if np.abs(D).sum()<1e-6: out.append((0.0,None)); continue
        best=(-2,0)
        for s in range(-rng,rng+1):
            A=np.roll(Z,s,axis=axis)
            c=(A*D).sum()/np.sqrt((A*A).sum()*(D*D).sum()+1e-9)
            if c>best[0]: best=(c,s)
        A=np.roll(Z,best[1],axis=axis); a=(A*D).sum()/((A*A).sum()+1e-9)
        out.append((round(a,2),best[1]))
    return out
def track2(F,ref=BG,r=30):
    Z=(F[-1]-ref).sum(2).astype(float); out=[]
    for f in F:
        D=(f-ref).sum(2).astype(float)
        if np.abs(D).sum()<1e-6: out.append((0.0,None,None)); continue
        best=(-2,0,0)
        for sy in range(-r,r+1):
            A0=np.roll(Z,sy,axis=0)
            for sx in range(-r,r+1,1):
                A=np.roll(A0,sx,axis=1)
                c=(A*D).sum()/np.sqrt((A*A).sum()*(D*D).sum()+1e-9)
                if c>best[0]: best=(c,sy,sx)
        A=np.roll(np.roll(Z,best[1],0),best[2],1); a=(A*D).sum()/((A*A).sum()+1e-9)
        out.append((round(a,2),best[1],best[2]))
    return out
