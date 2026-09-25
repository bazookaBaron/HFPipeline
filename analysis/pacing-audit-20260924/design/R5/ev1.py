from fg import *
def skin(a):  # mascot skin: r>200,g>170,b 120-200
    return (a[...,0]>200)&(a[...,1]>160)&(a[...,2]>110)&(a[...,2]<210)&(a[...,0]-a[...,2]>30)
print('== E1 mascot slide-in (skin bbox in y 500-930)')
prev=None
for t,a in frames(0.1,0.75):
    m=skin(a[500:930,:400]); xs=np.where(m.any(0))[0]; ys=np.where(m.any(1))[0]
    if len(xs): 
        x1=xs.max(); cx=np.where(m)[1].mean()
        print(f'{t:.3f} skin x {xs.min()}-{x1} y {ys.min()+500}-{ys.max()+500} cx {cx:.1f} dx {"" if prev is None else round(cx-prev,1)} n {m.sum()}'); prev=cx
    else: print(f'{t:.3f} none')
