from PIL import Image
import numpy as np
def load(f): return np.array(Image.open(f).convert('RGB')).astype(int)
def hx(p): return '#%02x%02x%02x'%tuple(int(v) for v in p)
BG=np.array([243,243,236])
def bbox(im,x0,y0,x1,y1,thr=40,ref=BG):
    r=im[y0:y1,x0:x1]; d=np.abs(r-ref).sum(2); ys,xs=np.where(d>thr)
    if len(ys)==0: return None
    return (x0+xs.min(),y0+ys.min(),x0+xs.max(),y0+ys.max())
def ink(im,x0,y0,x1,y1,ref=BG):
    r=im[y0:y1,x0:x1].reshape(-1,3); d=np.abs(r-ref).sum(1); i=np.argmax(d); return hx(r[i])
def rows(im,x0,x1,y0,y1,thr=40,ref=BG):
    r=im[y0:y1,x0:x1]; d=(np.abs(r-ref).sum(2)>thr).sum(1)
    out=[];start=None
    for i,v in enumerate(d):
        if v>0 and start is None: start=i
        if v==0 and start is not None: out.append((y0+start,y0+i-1)); start=None
    if start is not None: out.append((y0+start,y1-1))
    return out
def cols(im,x0,x1,y0,y1,thr=40,ref=BG):
    r=im[y0:y1,x0:x1]; d=(np.abs(r-ref).sum(2)>thr).sum(0)
    out=[];start=None
    for i,v in enumerate(d):
        if v>0 and start is None: start=i
        if v==0 and start is not None: out.append((x0+start,x0+i-1)); start=None
    if start is not None: out.append((x0+start,x1-1))
    return out
