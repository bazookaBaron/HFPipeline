from fg import *
def amber(a): return (a[...,0]>150)&(a[...,0]-a[...,2]>50)
print('== E10 typewriter question (amber text px, y330-420)')
prev=0
for t,a in frames(109.05,110.2):
    m=amber(a[330:420,60:680]); n=m.sum(); ys,xs=np.where(m)
    last = f'rightmost x on last line {xs[ys>=ys.max()-20].max()+60}' if n else ''
    print(f'{t:.3f} n={n} d={n-prev} lines_y {ys.min()+330 if n else "-"}-{ys.max()+330 if n else "-"} {last}'); prev=n
