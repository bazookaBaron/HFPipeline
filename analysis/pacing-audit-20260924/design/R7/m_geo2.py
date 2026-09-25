from util import *; from PIL import Image
import numpy as np
a=np.array(Image.open('fr_045.500.png')).astype(int); g=a.mean(2)
print('dot px', hexc(a[1063,159]),hexc(a[1064,160]),hexc(a[1090,186]), 'min dot', g[1055:1075,150:170].min())
print('hdr shadow rows at x300', [ (y,hexc(a[y,300])) for y in range(192,202)])
print('hdr shadow cols at y176', [ (x,hexc(a[176,x])) for x in range(688,700)])
print('brand fill', hexc(a[165,50]), 'dot', hexc(a[176,45]), 'mid fill', hexc(a[165,200]), 'right fill',hexc(a[165,600]))
# crop marks
for (y0,y1,x0,x1) in [(105,125,10,40),(105,125,680,712),(895,915,10,40),(895,915,680,712)]:
    r=g[y0:y1,x0:x1]; yy,xx=np.where(r<150); print('mark',x0+xx.min(),x0+xx.max(),y0+yy.min(),y0+yy.max(), hexc(a[y0+yy[0],x0+xx[0]]))
# caption box: scan column 360 for 930-1030
col=a[925:1035,360]; print('cap col', [(925+i,hexc(c)) for i,c in enumerate(col) if i%3==0])
row=a[1000,:]; 
nb=np.where(np.abs(row.astype(int)-np.array([241,241,234])).sum(1)>6)[0]; print('cap row1000 non-bg x', nb[:5], nb[-5:])
