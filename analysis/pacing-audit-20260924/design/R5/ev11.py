from fg import *
def teal(a): return (a[...,2]>120)&(a[...,2]-a[...,0]>40)
print('== E11 timeline progress line (teal in y300-330)')
for t,a in frames(113.55,114.2):
    m=teal(a[300:330,40:700]); xs=np.where(m.sum(0)>=1)[0]
    am=((a[300:330,40:700,0]>180)&(a[300:330,40:700,0]-a[300:330,40:700,2]>60)).sum()
    print(f'{t:.3f} teal x {xs.min()+40 if len(xs) else "-"}-{xs.max()+40 if len(xs) else "-"} amberDot {am}')
print('== E12 serif ONE PROBLEM fade+tracking (text px L>150 in y325-405)')
for t,a in frames(15.25,15.5):
    L=a[325:405,40:680].mean(2); m=L>150; xs=np.where(m.any(0))[0]
    print(f'{t:.3f} x {xs.min()+40 if len(xs) else "-"}-{xs.max()+40 if len(xs) else "-"} w {xs.max()-xs.min()+1 if len(xs) else 0} peakL {L.max():.0f} meanTextL {L[L>40].mean() if (L>40).any() else 0:.1f} n {m.sum()}')
