from mot import *
F=frames(95.8,100.0,240,500,420,120)
def cen(m): 
    ys,xs=np.where(m); return (int(xs.mean())+240,int(ys.mean())+500) if len(xs)>6 else None
res=[]
for i,f in enumerate(F):
    r,g,b=f[...,0],f[...,1],f[...,2]
    pur=(b-g>50)&(r-g>20)&(b>120); grn=(g-r>40)&(g-b>10); amb=(r-b>80)&(g-b>30)&(r-g>30)&(r<170)
    res.append((round(95.8+i/30,3),cen(pur),cen(grn),cen(amb)))
for r in res[::3]: print(r)
import math
for k,name in [(1,'purple'),(2,'green'),(3,'amber')]:
    sp=[math.dist(res[i][k],res[i-1][k]) for i in range(1,len(res)) if res[i][k] and res[i-1][k]]
    if sp: print(name,'px/frame@720 median',np.median(sp).round(2),'p90',np.percentile(sp,90).round(2),'frames moving',sum(1 for s in sp if s>0.5),'/',len(sp))
