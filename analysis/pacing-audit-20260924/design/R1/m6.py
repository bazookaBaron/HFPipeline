from grab import *
a=grab(39.68); L=a.max(2)
row=L[180]; print("right edge", [ (x,hx(a[180,x])) for x in range(672,684)])
# bounding boxes of bright elements in HUD region y160-200
def bbox(mask):
    ys,xs=np.where(mask); return (xs.min(),ys.min(),xs.max(),ys.max()) if len(xs) else None
sub=L[160:201,40:681]
m=sub>60
cols=np.where(m.any(0))[0]
# split runs with gaps >6
runs=[];s=cols[0];p=cols[0]
for c in cols[1:]:
    if c-p>6: runs.append((s,p)); s=c
    p=c
runs.append((s,p))
for s,e in runs:
    bb=bbox(m[:,s:e+1]); print("x",s+40,e+40,"y",bb[1]+160,bb[3]+160, "h",bb[3]-bb[1]+1)
# pill: find teal-ish fill
for x in range(125,185): pass
print("pill row 180:", [hx(a[180,x]) for x in range(126,182,3)])
print("pill col 150:", [(y,hx(a[y,150])) for y in range(166,196)])
