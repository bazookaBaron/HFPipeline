from PIL import Image
import numpy as np
def load(p): return np.asarray(Image.open(p).convert('RGB')).astype(int)
def hx(c): return '#%02X%02X%02X'%tuple(int(v) for v in c)
def diffmask(a,bg,th=18): return np.abs(a-np.array(bg)).sum(-1)>th
def ink(a,x0,y0,x1,y1,frac=0.25):
    r=a[y0:y1,x0:x1].reshape(-1,3); s=r.sum(1); o=np.argsort(s)[:max(1,int(len(s)*frac))]
    return hx(np.median(r[o],0))
def sat_ink(a,x0,y0,x1,y1,frac=0.25):
    r=a[y0:y1,x0:x1].reshape(-1,3); s=r.max(1)-r.min(1); o=np.argsort(-s)[:max(1,int(len(s)*frac))]
    return hx(np.median(r[o],0))
