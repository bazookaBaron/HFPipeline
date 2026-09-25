import sys,numpy as np
from PIL import Image
a=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(int)
mode=sys.argv[2]; k=int(sys.argv[3]); lo=int(sys.argv[4]); hi=int(sys.argv[5])
line=a[:,k] if mode=='col' else a[k,:]
prev=None
for i in range(lo,hi):
    c=tuple(line[i])
    if prev is None or max(abs(c[j]-prev[j]) for j in range(3))>5:
        print(i, i*1.5, '#%02x%02x%02x'%c)
    prev=c
