from grab import *
a=grab(39.68); L=a.sum(2)
reg=L[0:150,:]
ys,xs=np.where(reg>=9)
print("bright px in top band:",len(ys))
from collections import Counter
print("x mod counts",Counter(xs).most_common(20))
print("y counts",Counter(ys).most_common(20))
for y,x in list(zip(ys,xs))[:15]: print(y,x,hx(a[y,x]))
# region bottom 1060-1280
reg=L[1060:1280,:]; ys,xs=np.where(reg>=9); print("bottom", Counter(ys+1060).most_common(10), Counter(xs).most_common(10))
# enhanced crop image
im=Image.fromarray(np.clip(a[0:400,0:400]*12,0,255).astype('uint8')).resize((800,800),Image.NEAREST); im.save("enh_topleft.png")
