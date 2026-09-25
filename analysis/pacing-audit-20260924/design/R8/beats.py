import numpy as np
from PIL import Image
media=[(0,2.267,(41,456,679,815)),(2.3,7.167,(41,363,679,722)),(7.2,15.633,(180,361,678,641)),(97.6,117.7,(180,361,678,641)),(117.733,118.7,(41,364,679,722)),(118.833,121.767,(426,339,681,492)),(121.8,140.8,(427,357,679,493)),(171.933,175,(180,361,678,641))]
prev=None; out=open('beats.txt','w')
for n in range(1,5251):
    t=(n-1)/30
    a=np.asarray(Image.open('f30/%05d.jpg'%n).convert('L')).astype(np.int16)
    m=np.ones_like(a,bool); m[940:]=False   # exclude captions (native y>=940)
    for t0,t1,(x0,y0,x1,y1) in media:
        if t0-0.001<=t<=t1+0.001: m[y0:y1,x0:x1]=False
    if prev is not None:
        d=(np.abs(a-prev)>18)&m
        cap=np.abs(a[940:1110]-prev[940:1110])>18
        # regions: top chrome y<150 native(225), mascot x<175, content
        top=d[:150].sum(); masc=d[150:940,:175].sum(); cont=d[150:940,175:].sum()
        out.write('%d %.3f all %d top %d mascot %d content %d cap %d\n'%(n,t,d.sum(),top,masc,cont,cap.sum()))
    prev=a
