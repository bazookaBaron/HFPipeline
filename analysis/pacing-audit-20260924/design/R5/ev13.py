from fg import *
print('== E13 FIELD REPORTS source tile lighting (card1 x48-165 y224-316)')
for t,a in frames(24.25,24.6):
    r=a[226:316,50:165]; L=r.mean(2)
    print(f'{t:.3f} meanL {L.mean():.1f} photoZone(y226-270) {a[226:270,50:165].mean():.1f} title peak {a[295:310,55:160].mean(2).max():.0f} borderL {a[270,48].mean():.0f}')
print('== E14 FOUNDRY bar grow (teal fill #0a2632 px in y350-432)')
for t,a in frames(64.95,65.5):
    r=a[350:432,40:700]; m=(np.abs(r[...,0]-10)<8)&(np.abs(r[...,1]-38)<10)&(np.abs(r[...,2]-50)<10)
    xs=np.where(m.sum(0)>5)[0]; ys=np.where(m.sum(1)>5)[0]
    txt=(r.mean(2)>150).sum()
    print(f'{t:.3f} bar x {xs.min()+40 if len(xs) else "-"}-{xs.max()+40 if len(xs) else "-"} y {ys.min()+350 if len(ys) else "-"}-{ys.max()+350 if len(ys) else "-"} textpx {txt}')
