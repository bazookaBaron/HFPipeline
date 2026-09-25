from fg import *
print('== E8 strikethrough AN AI COMPANY (rows 326-336)')
for t,a in frames(143.9,144.35):
    L=a[326:337,40:700].mean(2); col=L.max(0); xs=np.where(col>200)[0]
    print(f'{t:.3f} line x {xs.min()+40 if len(xs) else "-"}-{xs.max()+40 if len(xs) else "-"} len {len(xs)} rows {np.where(L.max(1)>200)[0]+326 if len(xs) else ""}')
print('== E8b strikethrough 2 GOVT (search rows 380-400)')
for t,a in frames(145.8,146.25):
    L=a[370:410,40:700].mean(2); rr=np.where((L>200).sum(1)>30)[0]
    if len(rr)==0: print(f'{t:.3f} -'); continue
    y=rr[0]; xs=np.where(L[y]>200)[0]
    print(f'{t:.3f} row {y+370} x {xs.min()+40}-{xs.max()+40}')
