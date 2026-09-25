from mot import *
F=frames(10.00,14.10,100,935,520,85)
prev=None
for i,f in enumerate(F):
    t=10.0+i/30
    d=np.abs(f-BG).sum(2)
    box=np.where((d>20).mean(0)>0.4)[0]
    bx=(int(box.min())+100,int(box.max())+100) if len(box) else None
    r,g,b=f[...,0],f[...,1],f[...,2]
    red=(r-g>70)&(r-b>70)
    grey=(np.abs(r-g)<12)&(r>70)&(r<120)&(np.abs(g-b)<14)
    rx=(int(np.where(red.any(0))[0].min())+100,int(np.where(red.any(0))[0].max())+100) if red.any() else None
    gx=int(grey.sum())
    s=(bx,rx,gx)
    if s!=prev: print(f'{t:.3f} box{bx} red{rx} greypx{gx}')
    prev=s
