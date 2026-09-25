from m_mot import *
S=1.5
def track(t0,t1,label):
    print('==',label)
    prev=None
    for t,a in frames(t0,t1):
        r=a[350:890,0:205]; b=bb(r.max(2)>40)
        if b: 
            # hair tip: topmost bright pixel x ; right edge of body
            print('%.3f'%t,'x %.1f-%.1f y %.1f-%.1f n=%d lum=%.1f'%(b[0]*S,b[2]*S,(b[1]+350)*S,(b[3]+350)*S,b[4],r.mean()))
        else: print('%.3f none'%t)
track(1.62,2.1,'E1 mascot slide-in')
track(57.15,57.52,'E2 mascot exit')
track(65.93,66.2,'E2b mascot re-entry 66.0')
track(101.55,101.95,'E2c mascot exit 101.6')
