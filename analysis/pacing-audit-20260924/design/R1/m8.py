from grab import *
a=grab(39.68)
for y in [960, 1024]:
  print("y",y," ".join(f"{x}:{hx(a[y,x])[1:]}" for x in list(range(114,130))+list(range(594,612))))
# text rows: white text pixels inside box
box=a[948:1018,126:600]; L=box.min(2)
m=L>180
ys=np.where(m.any(1))[0]; print("white text rows", ys.min()+948, ys.max()+948)
cy=a[948:1018,126:600]; cm=(cy[:,:,2]>200)&(cy[:,:,0]<140)
ys=np.where(cm.any(1))[0]; xs=np.where(cm.any(0))[0]; print("cyan word rows", ys.min()+948, ys.max()+948, "x", xs.min()+126, xs.max()+126)
print("cyan word colour", topcol(a,486,960,580,1000,0.3))
print("white colour", topcol(a,150,960,470,1000,0.2))
