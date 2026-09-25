from grab import *
a=grab(52.0)
# title
reg=a[235:300,100:620]; m=reg.min(2)>150
ys=np.where(m.any(1))[0]; xs=np.where(m.any(0))[0]
print("title y",ys.min()+235,ys.max()+235,"x",xs.min()+100,xs.max()+100,"col",topcol(a,140,255,580,280,0.1))
# divider line: scan rows 280-292 at several x
for y in range(279,292): print("div",y," ".join(hx(a[y,x])[1:] for x in [5,40,100,200,360,520,620,680,715]))
# grey future word colour
print("grey word", topcol(a,352,965,580,1000,0.08))
print("white word", topcol(a,130,965,210,1000,0.1))
# road edges: along rows, find edge line pixels (bright-ish on dark)
for y in [415,500,600,700,785]:
    r=a[y,:,:].max(1); idx=[x for x in range(720) if r[x]>40 and x>150]
    print("road row",y,idx[:6],idx[-6:])
print("road fill", hx(a[600,360]),hx(a[700,300]), hx(a[450,360]))
# dashed purple lines colour
print("purple dash", topcol(a,240,680,255,860,0.2))
