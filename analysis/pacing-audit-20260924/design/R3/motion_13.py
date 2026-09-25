from mot import *
def pm(f): r,g,b=f[...,0],f[...,1],f[...,2]; return (b-g>45)&(r-g>15)
def gm(f): r,g,b=f[...,0],f[...,1],f[...,2]; return (g-r>40)&(g-b>5)
def am(f): r,g,b=f[...,0],f[...,1],f[...,2]; return (r-b>70)&(g-b>25)&(r-g>25)&(r<180)
F=frames(109.30,110.40,280,486,340,196)
for name,fn in [('purple',pm),('green',gm),('amber',am)]:
    c=[int(fn(f).sum()) for f in F]; rr=[ (int(np.where(fn(f).any(1))[0].max()) if fn(f).any() else -1) for f in F]
    print(name,'count',c); print('   lowest row',rr)
# disk blocks
F=frames(66.5,66.9,430,850,210,26); show('disk blocks alpha',66.5,[f'{a:.2f}' for a,s in track(F,rng=2)])
F=frames(66.5,66.9,430,850,210,26); print('per-block alpha frame 66.633', [round(float(np.abs(F[4][:,i*26:i*26+20]-BG).sum()/np.abs(F[-1][:,i*26:i*26+20]-BG).sum()),2) for i in range(8)])
# hard cut: title region and counter region at 36.90/36.933
F=frames(36.83,37.0,40,140,640,120)
print('cut header/title frame diffs',[round(float(np.abs(F[i]-F[i-1]).mean()),2) for i in range(1,len(F))])
