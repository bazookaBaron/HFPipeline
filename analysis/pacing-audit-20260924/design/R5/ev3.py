from fg import *
xs=[466,489,512,534]
for T in (12.35,52.45):
  print('== E3 HUD chapter change near',T)
  prev=None
  for t,a in frames(T,T+0.4):
    L=a.mean(2); lab=np.where(L[130:152,30:450].max(0)>60)[0]
    d='' if prev is None else f'frameDiff {np.abs(a-prev).mean():.2f}'
    content=np.abs(a[180:560,40:680]-prev[180:560,40:680]).mean() if prev is not None else 0
    print(f'{t:.3f}', ' '.join(hx(a[139,x])[1:] for x in (xs if T<20 else [557,580,603])), 'label x', (lab.min()+30,lab.max()+30) if len(lab) else '-', 'labelPeak',int(L[130:152,30:450].max()), d, f'contentDiff {content:.2f}')
    prev=a
