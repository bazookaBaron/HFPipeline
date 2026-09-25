import numpy as np,glob
from PIL import Image
fs=sorted(glob.glob('f10/*.jpg'))
def g(p): return np.asarray(Image.open(p).convert('L')).astype(np.int16)
def longest(v,th):
    best=(0,-1);s=None
    for i,x in enumerate(list(v)+[0]):
        if x>th and s is None:s=i
        if not x>th and s is not None:
            if i-1-s>best[1]-best[0]:best=(s,i-1)
            s=None
    return best
prev=g(fs[0]);out=open('media_scan.txt','w')
for i,p in enumerate(fs[1:],1):
    cur=g(p); d=np.abs(cur-prev)>14; prev=cur
    # exclude caption band (native y>=950) & mascot col x<150
    d[930:,:]=False
    rows=d.mean(1); r=longest(rows,0.12)
    if r[1]>r[0]+20:
        sub=d[r[0]:r[1]+1]; c=longest(sub.mean(0),0.12)
    else: c=(0,-1)
    out.write('%.1f %.4f %d %d %d %d\n'%(i/10,d.mean(),c[0]*1.5,r[0]*1.5,(c[1]+1)*1.5,(r[1]+1)*1.5))
