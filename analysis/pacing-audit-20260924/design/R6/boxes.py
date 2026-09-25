from PIL import Image; import numpy as np, sys
from scipy import ndimage
f=sys.argv[1]; thr=int(sys.argv[2]) if len(sys.argv)>2 else 250
a=np.asarray(Image.open(f).convert("RGB")).astype(int)
m=(a.min(2)>=thr)
lab,n=ndimage.label(m)
objs=ndimage.find_objects(lab)
res=[]
for i,s in enumerate(objs):
    h=s[0].stop-s[0].start; w=s[1].stop-s[1].start
    area=(lab[s]==i+1).sum()
    if area>1500: res.append((s[1].start*1.5,s[0].start*1.5,s[1].stop*1.5,s[0].stop*1.5,w*1.5,h*1.5,area))
for r in sorted(res,key=lambda r:(r[1],r[0])): print("x %.1f-%.1f y %.1f-%.1f (w %.1f h %.1f) area %d"%(r[0],r[2],r[1],r[3],r[4],r[5],r[6]))
