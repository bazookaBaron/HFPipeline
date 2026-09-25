from fg import *
def pink(a): return (a[...,0]>120)&(a[...,0]-a[...,1]>40)&(a[...,2]-a[...,1]>0)
print('== E5 pink link draw 44.15-44.75: pink px count in link corridors (tiles masked)')
prev=0
for t,a in frames(44.15,44.8):
    m=pink(a[330:540,60:680]).copy()
    for (x0,y0,x1,y1) in [(85,336,155,406),(182,410,252,480),(432,333,502,403),(512,450,582,520),(592,394,662,464)]:
        m[max(0,y0-330-2):y1-330+2, max(0,x0-60-2):x1-60+2]=False
    n=m.sum(); cols=np.where(m.any(0))[0]
    print(f'{t:.3f} n={n} d={n-prev} xspan={cols.min()+60 if len(cols) else "-"}-{cols.max()+60 if len(cols) else "-"}'); prev=n
