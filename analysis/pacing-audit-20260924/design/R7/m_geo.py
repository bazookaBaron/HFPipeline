from util import *; from PIL import Image
import numpy as np
a=np.array(Image.open('fr_045.500.png')).astype(int)
g=a.mean(2)
print('bg corner', hexc(a[5,5]), hexc(a[1275,715]), hexc(a[640,700]))
# modal bg
v,c=np.unique(a[1100:1270,200:700].reshape(-1,3),axis=0,return_counts=True); o=np.argsort(-c)[:5]; print('modal bottom',[ (hexc(v[i]),c[i]) for i in o])
# dot grid: row profile in empty area x 170-210 y 200-280
col=g[:, 690]; 
# find dark dots along a row in empty region y 1050-1270
reg=g[1040:1275,150:700]
ys=np.where(reg.min(1)<reg.mean()-6)[0]+1040; print('dot rows',ys[:40])
xs=np.where(g[ys[0],150:700]<g[ys[0],150:700].mean()-6)[0]+150 if len(ys) else []; print('dot cols',xs[:40])
# header bar: scan column x=300 for dark rows y 140-210
for x in [30,60,100,300,560,600,690,693,695]:
    col=g[140:215,x]; print('x',x,'dark rows',np.where(col<120)[0][:6]+140, np.where(col<120)[0][-6:]+140)
for y in [160,176,190]:
    row=g[y,:]; d=np.where(row<120)[0]; print('y',y,'dark x first/last',d[:6],d[-8:])
