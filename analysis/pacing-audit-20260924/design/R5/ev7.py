from fg import *
def amber(a): return (a[...,0]>90)&(a[...,0]-a[...,2]>35)&(a[...,1]-a[...,2]>15)
def run(name,t0,t1,y0,y1,x0,x1):
    print('==',name)
    for t,a in frames(t0,t1):
        m=amber(a[y0:y1,x0:x1]); ys=np.where(m.any(1))[0]; xs=np.where(m.any(0))[0]
        core=a[y0:y1,x0:x1][m]
        print(f'{t:.3f} n={m.sum()} y {ys.min()+y0 if len(ys) else "-"}-{ys.max()+y0 if len(ys) else "-"} x {xs.min()+x0 if len(xs) else "-"}-{xs.max()+x0 if len(xs) else "-"} core {hx(core[core.mean(1)>=np.percentile(core.mean(1),90)].mean(0)) if len(core) else "-"}')
run('E7 LANGUAGE MODEL chip drop',112.45,112.75,150,420,200,560)

