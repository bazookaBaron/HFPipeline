from fg import *
print('== E6 card row push-slide: per-frame horizontal shift (xcorr of column profile y230-320)')
fr=frames(53.4,54.2); prev=None
for t,a in fr:
    p=a[228:322,:,:].mean(2).mean(0); p=p-p.mean()
    if prev is not None:
        best=max(range(-80,81),key=lambda s: np.dot(p[max(0,s):720+min(0,s)], prev[max(0,-s):720-max(0,s)]) / (720-abs(s)))
        diff=np.abs(p-prev).mean()
        # extent of non-bg in band
    else: best=0; diff=0
    band=a[228:322].mean(2); cols=np.where((band>16).sum(0)>10)[0]
    print(f'{t:.3f} shift {best:+d}px diff {diff:.2f} content x {cols.min() if len(cols) else "-"}-{cols.max() if len(cols) else "-"}')
    prev=p
