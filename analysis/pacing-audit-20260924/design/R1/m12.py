from grab import *
for t in [9.1,9.2,9.5,39.8,39.9,40.5,43.4,153.7,175.5,176.5]:
    a=grab(t).astype(int)
    r,g,b=a[...,0],a[...,1],a[...,2]
    hair=(b>180)&(g>170)&(r>120)&(r<215)&(b-r>25)  # light blue hair
    hair[:, 250:]=False; hair[:150]=False
    ys,xs=np.where(hair)
    shoe=(a.max(2)>200)&(np.abs(r-b)<20); shoe[:800]=False; shoe[:, 250:]=False; shoe[900:]=False
    sy,sx=np.where(shoe)
    if len(ys)==0: print(t,"no hair"); continue
    print(f"t={t:6.2f} hair top y{ys.min()} x{xs.min()}-{xs.max()} | shoe-white bottom y{sy.max() if len(sy) else None} x{sx.min() if len(sx) else None}-{sx.max() if len(sx) else None}")
