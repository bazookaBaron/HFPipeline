from PIL import Image
import numpy as np
def load(p): return np.asarray(Image.open(p).convert('RGB')).astype(int)
def hx(c): return '#%02x%02x%02x'%tuple(int(v) for v in c)
def runs(line, thr=12):
    # segment a 1D array of RGB into runs where colour changes > thr
    out=[];s=0
    for i in range(1,len(line)):
        if np.abs(line[i]-line[i-1]).sum()>thr: out.append((s,i-1,hx(line[s:i].mean(0)) if i>s else hx(line[s]))); s=i
    out.append((s,len(line)-1,hx(line[s:].mean(0))));return out
def bbox(a, mask):
    ys,xs=np.where(mask)
    return (xs.min(),ys.min(),xs.max(),ys.max()) if len(xs) else None
