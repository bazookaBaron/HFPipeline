import subprocess, numpy as np
V="C:/Users/debna/Downloads/igexport-DdT5wzdsQWV.mp4"
def frames(t0,t1,crop=None):
    """return list of (t, HxWx3 int array) at native 720x1280 for every frame in [t0,t1)"""
    vf=[]; 
    if crop: x,y,w,h=crop; vf=["-vf",f"crop={w}:{h}:{x}:{y}"]
    n=int(round((t1-t0)*30))
    out=subprocess.run(["ffmpeg","-v","error","-ss",f"{t0}","-i",V,"-frames:v",str(n)]+vf+["-f","rawvideo","-pix_fmt","rgb24","-"],capture_output=True).stdout
    W,H=(crop[2],crop[3]) if crop else (720,1280)
    arr=np.frombuffer(out,np.uint8).reshape(-1,H,W,3).astype(int)
    return [(t0+i/30,arr[i]) for i in range(len(arr))]
