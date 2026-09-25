import subprocess, os, sys, numpy as np
from PIL import Image
V="C:/Users/debna/Downloads/igexport-DdEedoQM6j3.mp4"
def grab(t, src=V, tag="R1"):
    p=f"C:/Repos/HFPipleine/analysis/pacing-audit-20260924/design/R1/fr/{tag}_{t:08.3f}.png"
    if not os.path.exists(p):
        subprocess.run(["ffmpeg","-v","error","-ss",f"{t}","-i",src,"-frames:v","1",p],check=True)
    return np.asarray(Image.open(p).convert("RGB")).astype(int)
def hx(c): return "#%02x%02x%02x"%tuple(int(v) for v in c)
if __name__=="__main__":
    for t in sys.argv[1:]: grab(float(t))
def runs(idx, gap=1):
    idx=list(idx)
    if not idx: return []
    out=[];s=p=idx[0]
    for c in idx[1:]:
        if c-p>gap: out.append((s,p)); s=c
        p=c
    out.append((s,p)); return out
def topcol(a, x0,y0,x1,y1, frac=0.05):
    r=a[y0:y1,x0:x1].reshape(-1,3); s=r.sum(1); k=max(1,int(len(s)*frac))
    return hx(np.median(r[np.argsort(s)[-k:]],0))
