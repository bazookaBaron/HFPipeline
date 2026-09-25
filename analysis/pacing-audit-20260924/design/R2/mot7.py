from m_mot import *
S=1.5
def P(label,t0,t1,fn):
    print('==',label)
    for t,a in frames(t0,t1): print('%.3f'%t, fn(a))
def cone(a):
    out=[]
    for y in (215,250):
        r=a[y]; mx=r.max(1); mn=r.min(1); m=(mx-mn<25)&(mx>30); xs=np.where(m)[0]
        out.append('y%d: %s'%(y*1.5,('x %.1f-%.1f c %.1f'%(xs.min()*S,xs.max()*S,(xs.min()+xs.max())/2*S)) if len(xs) else 'none'))
    return ' | '.join(out)
P('E10 spotlight cone rows',138.83,139.35,cone)
def users(a):
    r=a[375:412,200:720]; m=(r[:,:,0]>170)&(r[:,:,1]<120); w=r.min(2)>190
    # per user column occupancy
    cols=[]
    for k in range(9):
        x0=int((349.5+78*k)/1.5)-200; seg=m[:,x0:x0+24]; cols.append('R' if seg.sum()>60 else ('p' if seg.sum()>10 else '.'))
    return ''.join(cols)+'  red=%d white=%d'%(m.sum(),w.sum())
P('E13 users-turn-red cascade',32.85,33.55,users)
def cap(a):
    r=a[948:1018,60:660]; w=(r.min(2)>200); b=(r[:,:,2]>200)&(r[:,:,0]<130); g=(r.max(2)>110)&(r.max(2)<180)&(r.max(2)-r.min(2)<40)
    return 'white %d blue %d grey %d  xextent %s'%(w.sum(),b.sum(),g.sum(), (lambda xs: '%.0f-%.0f'%((xs.min()+60)*1.5,(xs.max()+60)*1.5) if len(xs) else '-')(np.where((w|b|g).any(0))[0]))
P('E12 caption chunk swap',25.40,25.70,cap)
