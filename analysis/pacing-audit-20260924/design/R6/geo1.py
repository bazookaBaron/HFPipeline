from PIL import Image; import numpy as np
from util import hx
a=np.asarray(Image.open("fr/fr_029.500.png").convert("RGB")).astype(int)
L=a.mean(2)
# background & grid: scan row y=60 (top empty band) and column x=700
row=a[60]; col=a[:,712]
from collections import Counter
print("bg modal", Counter(map(tuple,a[40:120,300:420].reshape(-1,3))).most_common(3))
# grid lines: columns in top band darker than modal
m=L[20:140].mean(0); base=np.median(m)
print("col dips", [x for x in range(720) if m[x]<base-2][:60], "base", base)
m2=L[:,700:716].mean(1); b2=np.median(m2[1000:1280])
print("row dips", [y for y in range(1280) if m2[y]<b2-2 and (y<240 or y>1030)])
print("dip colour", hx(a[60, [x for x in range(720) if m[x]<base-2][0]]))
