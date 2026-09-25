from util import *; from PIL import Image
import numpy as np
a=np.array(Image.open('fr_045.500.png')).astype(int); g=a.mean(2)
for (y0,y1,x0,x1) in [(100,130,5,45),(100,130,675,715),(890,925,5,45),(890,925,675,715)]:
    r=g[y0:y1,x0:x1]; yy,xx=np.where(r<200); print('mark x',x0+xx.min(),x0+xx.max(),'y',y0+yy.min(),y0+yy.max(), 'min',hexc(a[y0:y1,x0:x1].reshape(-1,3)[r.argmin()]))
col=a[925:1035,360]; print('cap col', [(925+i,hexc(c)) for i,c in enumerate(col) if i%2==0])
for y in [960,985,1005]:
    row=a[y,:]; nb=np.where(np.abs(row-np.array([241,241,234])).sum(1)>9)[0]; print('cap row',y,'non-bg x', nb[:4], nb[-4:])
print('cap fill',hexc(a[975,135]),hexc(a[1000,590]))
# yellow highlight
yl=np.where((a[:,:,2]<170)&(a[:,:,0]>230)&(a[:,:,1]>200)); print('yellow bbox',yl[1].min(),yl[1].max(),yl[0].min(),yl[0].max()); 
v,c=np.unique(a[yl].reshape(-1,3),axis=0,return_counts=True); print('yellow modal',[hexc(v[i]) for i in np.argsort(-c)[:3]])
