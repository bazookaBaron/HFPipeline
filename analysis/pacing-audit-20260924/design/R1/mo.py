from m13 import frames
from grab import *
import sys
def ink_bbox(a,box,thr):
    x0,y0,x1,y1=box; m=a[y0:y1,x0:x1].max(2)>thr
    rows=np.where(m.sum(1)>=2)[0]; cols=np.where(m.sum(0)>=2)[0]
    if len(rows)==0: return None
    return (cols.min()+x0,rows.min()+y0,cols.max()+x0,rows.max()+y0,int(m.sum()))
def run(t0,t1,tag,box,thr=60,extra=None):
    fs=frames(t0,t1,tag); print(f"== {tag} {t0}-{t1} box{box} thr{thr}")
    for i,a in enumerate(fs):
        bb=ink_bbox(a,box,thr); mx=a[box[1]:box[3],box[0]:box[2]].max()
        e=extra(a) if extra else ""
        print(f"  {t0+i/30:8.3f} f{i:02d} bbox={bb} maxlum={mx} {e}")
