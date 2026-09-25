from m_util import *
import sys
S=1.5
def lines(p,y0,y1,x0=0,x1=720,thr=110,minrow=2):
    a=load(p); r=a[y0:y1,x0:x1]; m=r.max(2)>thr
    rows=m.sum(1)>=minrow; out=[]; y=0
    while y<len(rows):
        if rows[y]:
            s=y
            while y<len(rows) and rows[y]: y+=1
            sub=m[s:y]; xs=np.where(sub.any(0))[0]; px=r[s:y][sub]
            out.append(((xs.min()+x0)*S,(xs.max()+x0+1)*S,(s+y0)*S,(y+y0)*S,(y-s)*S,hx(np.median(px,0)),int(sub.sum())))
        y+=1
    return out
if __name__=='__main__':
    p=sys.argv[1]; y0,y1=int(sys.argv[2]),int(sys.argv[3]); x0=int(sys.argv[4]) if len(sys.argv)>4 else 0; thr=int(sys.argv[5]) if len(sys.argv)>5 else 110
    for l in lines(p,y0,y1,x0,720,thr): print(p, 'x %.1f-%.1f y %.1f-%.1f h %.1f ink %s n=%d'%l)
