from grab import *
for t,name in [(39.68,"OK"),(6.98,"DEGRADED"),(13.23,"OFFLINE"),(43.33,"SATURATED"),(134.08,"FILTERING/ED"),(139.73,"FILTERED")]:
    a=grab(t)
    reg=a[165:197,125:260]
    # pill = pixels differing from HUD fill #090d11
    d=np.abs(reg-np.array([9,13,17])).sum(2)>18
    ys,xs=np.where(d)
    x0,x1=xs.min()+125,xs.max()+125; y0,y1=ys.min()+165,ys.max()+165
    fill=hx(np.median(a[y0+3:y1-3,x0+14:x1-6].reshape(-1,3),0))
    text=topcol(a,x0+10,y0+4,x1-4,y1-4,0.06)
    brd=hx(a[y0,(x0+x1)//2])
    print(f"{name:12s} t={t} pill x{x0}-{x1} (w{x1-x0+1}) y{y0}-{y1} (h{y1-y0+1}) fill {fill} text/dot {text} topedge {brd}")
    # right metrics text colour & extent
    r=a[170:195,380:670]; m=r.max(2)>90; xs=np.where(m.any(0))[0]
    print("   right text x",xs.min()+380,xs.max()+380,"col",topcol(a,380,172,670,192,0.03))
print("ORIGIN label col", topcol(grab(39.68),56,176,114,186,0.15))
