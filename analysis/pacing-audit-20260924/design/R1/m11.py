from grab import *
for t in [0.05,0.1,0.15,0.2,0.25,0.3,1.0,153.7,168.3,9.5,39.95,175.5]:
    a=grab(t)
    reg=a[300:920,0:330]; m=reg.max(2)>60
    # remove dot grid (isolated) by requiring row count
    ys=np.where(m.sum(1)>2)[0]; xs=np.where(m.sum(0)>2)[0]
    if len(ys)==0: print(t,"none"); continue
    print(f"t={t:6.2f} mascot bbox x{xs.min()}-{xs.max()} (w{xs.max()-xs.min()+1}) y{ys.min()+300}-{ys.max()+300} (h{ys.max()-ys.min()+1})")
