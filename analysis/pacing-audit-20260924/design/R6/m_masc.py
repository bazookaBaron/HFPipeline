from PIL import Image; import numpy as np, glob
bg=np.array([237,241,243])
for f in ["fr/fr_029.500.png","fr/fr_070.500.png","fr/fr_104.500.png","fr/fr_125.500.png","fr/fr_001.500.png","fr/fr_155.000.png"]:
    a=np.asarray(Image.open(f).convert("RGB")).astype(int)
    sub=a[362:940,0:196]
    m=np.abs(sub-bg).sum(2)>60
    ys,xs=np.where(m)
    print(f, "x %.1f-%.1f y %.1f-%.1f"%(xs.min()*1.5,(xs.max()+1)*1.5,(ys.min()+362)*1.5,(ys.max()+363)*1.5))
