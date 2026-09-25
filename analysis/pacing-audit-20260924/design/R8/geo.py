import sys,numpy as np
from PIL import Image
def load(p): return np.asarray(Image.open(p).convert('RGB')).astype(int)
def lum(a): return (a[...,0]*299+a[...,1]*587+a[...,2]*114)//1000
def runs(v,th):
    on=v>th; out=[];s=None
    for i,x in enumerate(on):
        if x and s is None:s=i
        if not x and s is not None: out.append((s,i-1)); s=None
    if s is not None: out.append((s,len(v)-1))
    return out
if __name__=='__main__':
    a=load(sys.argv[1]); L=lum(a)
    x=int(sys.argv[2]); y=int(sys.argv[3])
    print('col x=%d'%x, [(r0*1.5,r1*1.5) for r0,r1 in runs(L[:,x],int(sys.argv[4]))])
    print('row y=%d'%y, [(r0*1.5,r1*1.5) for r0,r1 in runs(L[y,:],int(sys.argv[4]))])
    for yy in range(0,1280,4):
        pass
