import sys,numpy as np
from PIL import Image
a=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(int); l=a.max(2)
th=int(sys.argv[2]); x0=int(sys.argv[3]) if len(sys.argv)>3 else 0
m=l[:,x0:]>th
rows=m.any(1); y=0
while y<1280:
    if rows[y]:
        s=y
        while y<1280 and rows[y]: y+=1
        xs=np.nonzero(m[s:y].any(0))[0]
        print('y %.1f-%.1f (h %.1f)  x %.1f-%.1f'%(s*1.5,y*1.5,(y-s)*1.5,(x0+xs.min())*1.5,(x0+xs.max()+1)*1.5))
    y+=1
