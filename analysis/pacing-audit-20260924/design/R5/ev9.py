from fg import *
def teal(a): return (a[...,2]>120)&(a[...,2]-a[...,0]>35)&(a[...,1]>100)
print('== E9 engineer icon travel (teal blobs y 230-330)')
prev=None
for t,a in frames(101.2,101.8):
    m=teal(a[395:475,40:700]); ys,xs=np.where(m)
    if len(xs)==0: print(f'{t:.3f} -'); continue
    # icon = biggest cluster: use x histogram peak window of 60px
    hist=np.bincount(xs,minlength=660); cs=np.convolve(hist,np.ones(50),'same'); c=np.argmax(cs)
    sel=(xs>c-30)&(xs<c+30); cx=xs[sel].mean()+40
    print(f'{t:.3f} icon cx {cx:.1f} dx {"" if prev is None else round(cx-prev,1)} n {sel.sum()} teal x-span {xs.min()+40}-{xs.max()+40}'); prev=cx
