import glob,numpy as np
from PIL import Image
fs=sorted(glob.glob("fr/m10/*.png")); prev=None; start=0
out=[]
for i,f in enumerate(fs):
    a=np.asarray(Image.open(f).convert("RGB")).astype(int)
    band=a[10:700,0:140].max(2)>60; rows=np.where(band.sum(1)>3)[0]
    h=(rows.max()-rows.min()+1) if len(rows) and rows.max()>600 else 0
    st= 0 if h<300 else round(h/520,2)
    if prev is None or abs(st-prev)>0.03:
        out.append((i/10,st,h)); prev=st
for t,s,h in out: print(f"{t:6.1f}s scale {s} (h{h})")
