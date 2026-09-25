from m_mot import *
S=1.5
def P(label,t0,t1,fn):
    print('==',label)
    for t,a in frames(t0,t1): print('%.3f'%t, fn(a))
def cone(a):
    r=a[200:335,:]; mx=r.max(2); mn=r.min(2); m=(mx-mn<20)&(mx>35)&(mx<140); ys,xs=np.where(m)
    return 'cx %.1f n=%d x %.1f-%.1f'%(xs.mean()*S,len(xs),xs.min()*S,xs.max()*S) if len(xs)>50 else 'none n=%d'%len(xs)
P('E10 spotlight cone',138.80,139.35,cone)
def bluetitle(a):
    r=a[300:520,20:220]; m=(r[:,:,2]>150)&(r[:,:,0]<130); g=a[300:520,230:460]; mg=(g[:,:,1]>150)&(g[:,:,0]<130)&(g[:,:,2]<160)
    return 'BLUE px %d peakB %.0f | GREEN px %d peakG %.0f | card fill %s / %s'%(m.sum(), r[:,:,2][m].mean() if m.sum() else 0, mg.sum(), g[:,:,1][mg].mean() if mg.sum() else 0, hx(a[600,100]),hx(a[600,330]))
P('E11 title BLUE/GREEN fade-in',0.0,0.85,bluetitle)
