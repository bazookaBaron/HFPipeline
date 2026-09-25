from m_mot import *
S=1.5
def amber(a):
    r=a[235:1000]; return (r[:,:,0]>170)&(r[:,:,1]>135)&(r[:,:,1]<215)&(r[:,:,2]<120)&(r[:,:,0]-r[:,:,2]>80)
def run(t0,t1,label):
    F=frames(t0,t1); M=[amber(a) for _,a in F]
    static=np.logical_and.reduce(M[:3]) & np.logical_and.reduce(M[-3:])
    print('==',label); prev=None
    for (t,a),m in zip(F,M):
        m=m&~static; ys,xs=np.where(m)
        if len(xs)>15:
            cx,cy=xs.mean()*S,(ys.mean()+235)*S
            d='' if prev is None else 'dx %6.1f dy %6.1f |d| %5.1f'%(cx-prev[0],cy-prev[1],((cx-prev[0])**2+(cy-prev[1])**2)**.5)
            print('%.3f cx %6.1f cy %6.1f n=%4d %s'%(t,cx,cy,len(xs),d)); prev=(cx,cy)
        else: print('%.3f none/occluded (n=%d)'%(t,len(xs)))
run(29.35,30.45,'E3 chip -> BLUE')
run(35.0,36.0,'E3b chip -> GREEN')
