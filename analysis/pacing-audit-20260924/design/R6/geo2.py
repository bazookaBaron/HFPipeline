from PIL import Image; import numpy as np
from util import hx
a=np.asarray(Image.open("fr/fr_029.500.png").convert("RGB")).astype(int)
L=a.mean(2)
m=L[20:140].mean(0); base=np.median(m)
print("cols:", [(x,round(base-m[x],1)) for x in range(720) if m[x]<base-0.8])
m2=L[1100:1270,:].mean(1); b2=np.median(m2)
print("rows:", [(y+1100,round(b2-m2[y],1)) for y in range(len(m2)) if m2[y]<b2-0.8])
# vertical gradient of bg
for y in (5,100,300,600,900,1100,1270): print(y, hx(np.median(a[y-3:y+3,690:715].reshape(-1,3),0)))
