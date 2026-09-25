import subprocess, numpy as np
V="C:/Users/debna/Downloads/igexport-DdrHAI1MrFb.mp4"
W,H=720,1280
def frames(t0,t1,gray=False,scale=1):
    """yield (t, array) for every frame n in [round(t0*30), round(t1*30)] (accurate seek, verified vs select=eq(n))."""
    w,h=W//scale,H//scale
    pf="gray" if gray else "rgb24"; ch=1 if gray else 3
    n0=int(round(t0*30)); n1=int(round(t1*30))
    cmd=["ffmpeg","-v","quiet","-ss",f"{n0/30:.4f}","-i",V,"-frames:v",str(n1-n0+1),"-vf",f"scale={w}:{h}","-f","rawvideo","-pix_fmt",pf,"-"]
    p=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
    sz=w*h*ch; n=n0
    try:
        while n<=n1:
            b=p.stdout.read(sz)
            if len(b)<sz: break
            a=np.frombuffer(b,np.uint8).reshape(h,w,ch) if ch>1 else np.frombuffer(b,np.uint8).reshape(h,w)
            yield n/30, a; n+=1
    finally:
        p.kill()
def grab(t):
    for tt,a in frames(t,t): return a
def hx(c): return "#%02x%02x%02x"%tuple(int(v) for v in c[:3])
