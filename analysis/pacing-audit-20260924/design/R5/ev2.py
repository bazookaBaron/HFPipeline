from fg import *
import math
print('== E2 POLITICAL stamp: box mask (L 17-40) in y 585-700')
for t,a in frames(4.85,5.25):
    L=a.mean(2); r=L[585:700,280:720]; m=(r>16)&(r<45)
    cols=np.where(m.sum(0)>20)[0]
    if len(cols)==0: print(f'{t:.3f} none'); continue
    x0,x1=cols.min()+280,cols.max()+280
    def topy(x):
        c=m[:,x-280]; ys=np.where(c)[0]; return ys.min()+585 if len(ys) else None
    def boty(x):
        c=m[:,x-280]; ys=np.where(c)[0]; return ys.max()+585 if len(ys) else None
    yl,yr=topy(x0+15),topy(x1-15); bl=boty(x0+15)
    ang=math.degrees(math.atan2(yl-yr,(x1-x0-30))) if yl and yr else None
    txt=L[600:680,330:700]; tp=np.percentile(txt,99.8)
    print(f'{t:.3f} box x {x0}-{x1} w {x1-x0+1} topL {yl} topR {yr} botL {bl} h {bl-yl if bl and yl else None} tilt {ang:.2f}deg textpeakL {tp:.0f} fillL {np.median(r[m]):.1f}')
