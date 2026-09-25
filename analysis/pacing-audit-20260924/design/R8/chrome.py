import sys,numpy as np
from PIL import Image
def meas(n,xm,ya,yb):
    a=np.asarray(Image.open('f30/%05d.jpg'%n).convert('RGB')).astype(int); l=a.sum(2)//3
    col=l[:,xm]
    top=next(y for y in range(ya,yb) if col[y]>18)
    # header fill = rows top+3..: find first row after top+6 where colour departs from header modal by >12 on several cols
    hdr=a[top+3,xm-40:xm+40].mean(0)
    mt=None
    for y in range(top+6,top+60):
        row=a[y,xm-150:xm+150]; 
        if np.abs(row-hdr).max(1).mean()>14: mt=y;break
    bot=next(y for y in range(yb,top,-1) if col[y]>12)
    yh=top+ (mt-top)//2 if mt else top+8
    row=l[yh+ (mt-top)//3 if mt else yh]
    row=l[top+2]
    lx=next(x for x in range(0,xm) if l[top+10,x]>11)
    rx=next(x for x in range(719,xm,-1) if l[top+10,x]>11)
    # red/amber dot: saturated pixels in header band near right
    band=a[top:mt if mt else top+26, rx-30:rx]
    sat=(band.max(2)-band.min(2))>90
    ys,xs=np.nonzero(sat); dot='-'
    if len(xs): 
        c=band[ys,xs].mean(0).astype(int); dot='(%.1f,%.1f) #%02x%02x%02x d=%.1f'%((rx-30+xs.mean())*1.5,(top+ys.mean())*1.5,*c,(xs.max()-xs.min()+1)*1.5)
    hc=a[top+3,xm-20:xm+20].mean(0).astype(int); bc=a[top,xm-20:xm+20].mean(0).astype(int)
    f=lambda v:v*1.5
    print('t=%.3f outer x %.1f-%.1f y %.1f-%.1f (w %.1f h %.1f) header %.1f-%.1f (h %.1f) media %.1f-%.1f (h %.1f, w/h %.3f) hdr #%02x%02x%02x border #%02x%02x%02x dot %s'%((n-1)/30,f(lx),f(rx+1),f(top),f(bot+1),f(rx+1-lx),f(bot+1-top),f(top),f(mt) if mt else -1,f(mt-top) if mt else -1,f(mt) if mt else -1,f(bot+1),f(bot+1-mt) if mt else -1,(rx-1-lx)/(bot+1-mt) if mt else 0,*hc,*bc,dot))
for arg in sys.argv[1:]:
    n,xm,ya,yb=map(int,arg.split(','))
    meas(n,xm,ya,yb)
