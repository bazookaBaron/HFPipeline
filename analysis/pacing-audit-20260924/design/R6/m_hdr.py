from PIL import Image; import numpy as np
from util import hx
from collections import Counter
a=np.asarray(Image.open("fr/fr_029.500.png").convert("RGB")).astype(int)
L=a.mean(2)
def edges_row(y,x0,x1,d=18):
    r=L[y,x0:x1]; g=np.abs(np.diff(r)); return [(x0+i+1, int(r[i]), int(r[i+1])) for i in np.where(g>d)[0]]
def edges_col(x,y0,y1,d=18):
    r=L[y0:y1,x]; g=np.abs(np.diff(r)); return [(y0+i+1, int(r[i]), int(r[i+1])) for i in np.where(g>d)[0]]
print("hdr row y=160", edges_row(160,0,720,6))
print("hdr col x=100", edges_col(100,140,240,6))
print("hdr col x=400", edges_col(400,140,240,6))
print("dark fill", Counter(map(tuple,a[165:190,60:70].reshape(-1,3))).most_common(2))
print("white fill", Counter(map(tuple,a[165:190,250:300].reshape(-1,3))).most_common(2))
# chips
print("chip row y=214", edges_row(214,40,690,8)[:12])
print("chip col x=75", edges_col(75,195,240,5))
# note card
print("note col x=100", edges_col(100,240,380,6))
print("note row y=300", edges_row(300,20,210,6))
print("note left bar colour", [hx(a[300,x]) for x in range(38,48)])
# blueprint
print("bp col x=660", edges_col(660,230,920,6))
print("bp row y=560", edges_row(560,180,720,6))
print("caption col x=360", edges_col(360,930,1040,6))
print("caption row y=985", edges_row(985,50,700,20)[:3], edges_row(985,50,700,20)[-3:])
