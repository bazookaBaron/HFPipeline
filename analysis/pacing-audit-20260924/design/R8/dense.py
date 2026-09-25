import sys,numpy as np
from PIL import Image
from rect import edges
rngs=[(0,17),(96,127),(127,143),(168,175)]
out=open('dense_media.txt','w')
for a0,a1 in rngs:
  for n in range(int(a0*30)+1,min(int(a1*30)+1,5250)+1):
    a=np.asarray(Image.open('f30/%05d.jpg'%n).convert('RGB')).astype(int)
    l=(a[...,0]*299+a[...,1]*587+a[...,2]*114)//1000
    x0,y0,x1,y1=edges(l,170,715,150,930,6)
    cs=l[y0:y1+1,:].std(0)>6; xl=x0
    while xl>0 and cs[xl-1]: xl-=1
    red=(a[...,0]>190)&(a[...,1]<90)&(a[...,2]>50)&(a[...,2]<150); red[930:]=False
    ys,xs=np.nonzero(red[:, :])
    # red dot = rightmost red cluster in x>=500 with tiny extent
    dot='-'
    if len(xs):
        sel=xs>=480
        if sel.any():
            X=xs[sel];Y=ys[sel]; mx=X.max(); m=(X>mx-9)
            if m.sum()<80 and (Y[m].max()-Y[m].min())<10: dot='%.1f,%.1f'%(X[m].mean()*1.5,Y[m].mean()*1.5)
    out.write('%d %.3f media %.1f %.1f %.1f %.1f dot %s\n'%(n,(n-1)/30,xl*1.5,y0*1.5,(x1+1)*1.5,(y1+1)*1.5,dot))
