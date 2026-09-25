from PIL import Image; import numpy as np, glob
bg=np.array([237,241,243])
res=[]
fs=sorted(glob.glob("dense/d_*.jpg"))
for i,f in enumerate(fs):
    a=np.asarray(Image.open(f).convert("RGB")).astype(int)
    head=a[365:520,0:196]; m=np.abs(head-bg).sum(2)>60
    ys,xs=np.where(m)
    feet=a[840:915,0:196]; mf=np.abs(feet-bg).sum(2)>60; fy,fx=np.where(mf)
    # eyes: white-ish pixels in head region y 420-470
    res.append((i/10, xs.mean() if len(xs) else -1, ys.min()+365 if len(ys) else -1, fx.mean() if len(fx) else -1, m.sum()))
np.save("masc.npy",np.array(res))
r=np.array(res)
print("head cx: min %.1f max %.1f"%(r[:,1].min(),r[:,1].max()))
# print changes in head cx > 3 px
prev=None
for t,cx,top,fcx,n in res:
    if prev is not None and abs(cx-prev)>2.5: print("t %.1f headcx %.1f->%.1f top %d feetcx %.1f"%(t,prev,cx,top,fcx))
    prev=cx
