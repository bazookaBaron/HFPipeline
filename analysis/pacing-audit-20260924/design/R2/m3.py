from m_util import *
import glob
S=1.5
def cap(p, y0=880, y1=1080):
    a=load(p); r=a[y0:y1]
    lum=r.mean(2)
    white=(r.min(2)>200)            # white/near white
    blue=(r[:,:,2]>200)&(r[:,:,0]<140)
    # border: rows with long white runs
    rows=[y for y in range(r.shape[0]) if white[y].sum()>150]
    cols=[x for x in range(r.shape[1]) if white[:,x].sum()>40]
    bb=bbox(r, white); bl=bbox(r, blue)
    return rows, cols, bb, bl, a, y0
for p in ['../ref_frames/R2_018.26_topology-carrier.png','fr_025.567.png','fr_013.500.png','fr_067.500.png','fr_143.900.png','fr_145.200.png','fr_105.900.png']:
    rows,cols,bb,bl,a,y0=cap(p)
    print(p, 'hlines(native y)',[y+y0 for y in rows],'vlines x',cols[:4],cols[-4:],'white bb',[v*S for v in (bb[0],bb[1]+y0,bb[2],bb[3]+y0)],'blue bb',bl and [v*S for v in (bl[0],bl[1]+y0,bl[2],bl[3]+y0)])
