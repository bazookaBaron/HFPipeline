from mot import *
RED=np.array([200,70,45])
def redmask(f): 
    r,g,b=f[...,0],f[...,1],f[...,2]; return (r-g>60)&(r-b>60)
def sat(f,thr=50): return (f.max(2)-f.min(2))>thr
# S02 connector DB->WT: region between cards x 430-460, y 500-620?
F=frames(2.20,2.80,425,480,40,150)
show('S02 connector red rows (min,max,count)',2.20,[ (lambda m:(int(np.where(m.any(1))[0].min())+480,int(np.where(m.any(1))[0].max())+480,int(m.sum())) if m.any() else None)(redmask(f)) for f in F])
F=frames(3.85,4.30,250,650,380,40)
show('S03 main line red x extent',3.85,[ (lambda m:(int(np.where(m.any(0))[0].min())+250,int(np.where(m.any(0))[0].max())+250,int(m.sum())) if m.any() else None)(redmask(f)) for f in F])
F=frames(4.50,4.90,380,560,240,100)
def purp(f): r,g,b=f[...,0],f[...,1],f[...,2]; return (b-g>50)&(r-g>20)
show('S03 branch curve purple (xmax,count)',4.50,[ (lambda m:(int(np.where(m.any(0))[0].max())+380,int(m.sum())) if m.any() else None)(purp(f)) for f in F])
F=frames(37.05,37.50,186,380,10,480)
show('S11 trunk red rows (min,max,count)',37.05,[ (lambda m:(int(np.where(m.any(1))[0].min())+380,int(np.where(m.any(1))[0].max())+380,int(m.sum())) if m.any() else None)(redmask(f)) for f in F])
F=frames(37.00,37.30,192,380,30,480)
show('S11 stubs red cols (min,max,count)',37.00,[ (lambda m:(int(np.where(m.any(0))[0].min())+192,int(np.where(m.any(0))[0].max())+192,int(m.sum())) if m.any() else None)(redmask(f)) for f in F])
F=frames(124.45,124.95,430,500,30,160)
show('S31 arrow red rows',124.45,[ (lambda m:(int(np.where(m.any(1))[0].min())+500,int(np.where(m.any(1))[0].max())+500,int(m.sum())) if m.any() else None)(redmask(f)) for f in F])
