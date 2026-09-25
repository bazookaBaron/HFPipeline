import glob,numpy as np
from PIL import Image
fs=sorted(glob.glob("fr/m10/*.png"))
def face(i): a=np.asarray(Image.open(fs[i]).convert("L")).astype(int); return a[170:300,40:140]
for (t0,t1) in [(17.0,30.0),(48.2,62.0),(65,76),(153.7,164),(128.2,135)]:
    d=[]
    for i in range(int(t0*10),int(t1*10)):
        d.append(np.abs(face(i+1)-face(i)).mean())
    d=np.array(d); ch=np.where(d>1.0)[0]
    print(f"{t0}-{t1}: mean diff {d.mean():.2f}, max {d.max():.2f}, frames>1.0: {len(ch)} at {[round(t0+c/10,1) for c in ch[:25]]}")
