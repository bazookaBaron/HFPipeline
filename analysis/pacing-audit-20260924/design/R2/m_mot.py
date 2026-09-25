import subprocess, numpy as np
from m_util import hx
V='C:/Users/debna/Downloads/igexport-DdG-RuwsDRc.mp4'
def frames(t0,t1,src=V,W=720,H=1280):
    n=int(round((t1-t0)*30))
    out=subprocess.run(['ffmpeg','-v','error','-ss',f'{t0}','-i',src,'-frames:v',str(n),'-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
    arr=np.frombuffer(out,np.uint8).reshape(-1,H,W,3).astype(int)
    return [(t0+i/30,arr[i]) for i in range(len(arr))]
def bb(m):
    ys,xs=np.where(m)
    return (xs.min(),ys.min(),xs.max(),ys.max(),len(xs)) if len(xs) else None
