import subprocess, numpy as np
V="C:/Users/debna/Downloads/igexport-DdIM0QoiZre.mp4"
def frames(t0,t1):
    """return list of (t, HxWx3 int array) for every frame with pts in [t0,t1) using accurate seek"""
    n=int(round((t1-t0)*30))
    # seek slightly before, decode accurately
    p=subprocess.run(["ffmpeg","-v","error","-ss",f"{t0:.4f}","-i",V,"-frames:v",str(n),"-f","rawvideo","-pix_fmt","rgb24","-"],capture_output=True,check=True)
    a=np.frombuffer(p.stdout,np.uint8).reshape(-1,1280,720,3).astype(int)
    return [(t0+i/30,a[i]) for i in range(len(a))]
def hx(p): return '#%02x%02x%02x'%tuple(int(round(v)) for v in p)
