from m_util import *
S=1.5
def tb(p,x0,y0,x1,y1,thr=90,name=''):
    a=load(p); r=a[y0:y1,x0:x1]; bgc=np.median(r.reshape(-1,3),0)
    m=np.abs(r-bgc).sum(2)>thr
    bb=bbox(r,m)
    if bb is None: print(name,'none');return
    px=r[m]; lum=px.sum(1); top=px[lum>=np.percentile(lum,70)]
    print(f"{name:22s} x {(bb[0]+x0)*S:7.1f}-{(bb[2]+x0+1)*S:7.1f} y {(bb[1]+y0)*S:7.1f}-{(bb[3]+y0+1)*S:7.1f}  w {(bb[2]-bb[0]+1)*S:6.1f} h {(bb[3]-bb[1]+1)*S:5.1f}  ink {hx(np.median(top,0))} bg {hx(bgc)}")
