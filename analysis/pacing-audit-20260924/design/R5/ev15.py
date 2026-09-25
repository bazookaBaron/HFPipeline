from fg import *
def cap(a):
    L=a[960:1036].mean(2)
    row=L[37]  # y=997 mid-box
    # box edges: border pixels brighter than fill in row 975
    r2=a[975].mean(1); edges=np.where(r2>19)[0]
    act=(L>225).sum(); ina=((L>150)&(L<200)).sum()
    txt=np.where((L>100).any(0))[0]
    return f'box x {edges.min() if len(edges) else "-"}-{edges.max() if len(edges) else "-"} text x {txt.min() if len(txt) else "-"}-{txt.max() if len(txt) else "-"} activePx {act} inactivePx {ina} peak {L.max():.0f}'
for T0,T1 in ((1.85,2.25),(2.1,2.35),(21.8,22.05)):
    print('== caption',T0,T1)
    for t,a in frames(T0,T1): print(f'{t:.3f}',cap(a))
