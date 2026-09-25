from mot import *
def redmask(f): r,g,b=f[...,0],f[...,1],f[...,2]; return (r-g>60)&(r-b>60)
def runs(m,off):
    rr=np.where(m.any(1))[0]; 
    if len(rr)==0: return []
    out=[];s=rr[0];p=rr[0]
    for v in rr[1:]:
        if v!=p+1: out.append((s+off,p+off)); s=v
        p=v
    out.append((s+off,p+off)); return out
F=frames(2.30,2.75,425,480,40,150)
for i,f in enumerate(F): print('S02',f'{2.30+i/30:.3f}',runs(redmask(f),480))
F=frames(124.50,124.90,430,500,30,160)
for i,f in enumerate(F): print('S31',f'{124.50+i/30:.3f}',runs(redmask(f),500))
F=frames(37.10,37.50,186,380,10,480)
for i,f in enumerate(F): print('S11trunk',f'{37.10+i/30:.3f}',runs(redmask(f),380))
F=frames(3.88,4.28,250,660,380,20)
def cruns(m,off):
    cc=np.where(m.any(0))[0]
    if len(cc)==0: return []
    out=[];s=cc[0];p=cc[0]
    for v in cc[1:]:
        if v!=p+1: out.append((s+off,p+off)); s=v
        p=v
    out.append((s+off,p+off)); return out
for i,f in enumerate(F): print('S03main',f'{3.88+i/30:.3f}',cruns(redmask(f[4:16]),250))
