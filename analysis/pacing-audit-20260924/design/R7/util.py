import subprocess, numpy as np
V=r"C:\Users\debna\Downloads\igexport-Ddm_kFQodJE.mp4"
W,H=720,1280
def frames(t0,dur,gray=False):
    """decode frames from t0 for dur seconds, returns (times, array[N,H,W,3])"""
    pf='gray' if gray else 'rgb24'
    cmd=['ffmpeg','-v','error','-ss',f'{max(0,t0-1):.3f}','-i',V,'-ss',f'{t0-max(0,t0-1):.3f}','-t',f'{dur:.3f}','-f','rawvideo','-pix_fmt',pf,'-']
    b=subprocess.run(cmd,capture_output=True).stdout
    c=1 if gray else 3
    a=np.frombuffer(b,np.uint8)
    n=len(a)//(W*H*c)
    a=a[:n*W*H*c].reshape(n,H,W) if gray else a[:n*W*H*c].reshape(n,H,W,3)
    # frame index -> time: assume first frame at round(t0*30)/30
    f0=round(t0*30)
    return [ (f0+i)/30 for i in range(n)], a
def frame(t):
    ts,a=frames(t,1/30+0.001); return a[0]
def hexc(c): return '#%02X%02X%02X'%tuple(int(x) for x in c)
