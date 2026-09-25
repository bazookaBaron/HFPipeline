from m_mot import *
S=1.5
def show(label,t0,t1,fn):
    print('==',label); prev=None
    for t,a in frames(t0,t1):
        v=fn(a)
        if isinstance(v,tuple) and v and isinstance(v[0],(int,float,np.floating,np.integer)) and prev is not None and isinstance(prev,tuple) and prev:
            d=v[0]-prev[0]; print('%.3f'%t, ' '.join('%.1f'%x for x in v),' d0=%.1f'%d)
        else: print('%.3f'%t, v if not isinstance(v,tuple) else ' '.join('%.1f'%x for x in v))
        prev=v
def knob(a):
    r=a[565:592,150:620]; m=r.min(2)>225; ys,xs=np.where(m)
    return ((xs.mean()+150)*S,len(xs)) if len(xs)>3 else 'none'
show('E4 lever knob x (1080px)',60.60,61.45,knob)
def strike(a):
    r=a[281:290,120:600]; m=(r[:,:,0]>190)&(r[:,:,1]>110)&(r[:,:,1]<200)&(r[:,:,2]<140); xs=np.where(m.any(0))[0]
    return ((xs.max()+120)*S,(xs.min()+120)*S,len(xs)*S) if len(xs) else 'none'
show('E7 strike draw (right end x, left x, covered px)',58.0,58.30,strike)
def headline(a):
    out=[]
    for y0,y1 in [(236,292),(318,374)]:
        r=a[y0:y1,120:600]; m=r.max(2)>60; ys,xs=np.where(m)
        out+= [ (ys.min()+y0)*S if len(ys) else -1, r.max(2)[m].mean() if len(ys) else 0, len(ys)]
    return tuple(out)
show('E5 headline lines (top y, mean ink lum, n) x2',58.70,59.05,headline)
