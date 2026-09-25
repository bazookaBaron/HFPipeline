import numpy as np
from PIL import Image
segs=[('A',0.000,2.267,(41,456,679,815)),('B',2.300,7.167,(41,363,679,722)),('C',7.200,15.633,(180,361,678,641)),
('E',97.6,117.7,(180,361,678,641)),('F',117.733,118.7,(41,364,679,722)),('G',118.833,121.767,(426,339,681,492)),
('H',121.8,140.8,(427,357,679,493)),('I',171.933,174.967,(180,361,678,641))]
out=open('sig.txt','w'); S={}
for name,t0,t1,box in segs:
    prev=None
    for n in range(int(round(t0*30))+1,int(round(t1*30))+2):
        im=Image.open('f30/%05d.jpg'%n).convert('L').crop(box).resize((96,54),Image.BILINEAR)
        v=np.asarray(im).astype(float); S[n]=v
        mae=np.abs(v-prev).mean() if prev is not None else -1
        out.write('%s %d %.3f mae %.2f mean %.1f\n'%(name,n,(n-1)/30,mae,v.mean()))
        prev=v
np.save('sigs.npy',{k:v for k,v in S.items()},allow_pickle=True)
