from grab import *
import glob,re
for f in sorted(glob.glob("../ref_frames/R1_*.png")):
    t=float(re.search(r"R1_(\d+\.\d+)",f).group(1)); name=f.split("_",2)[-1][:-4]
    a=np.asarray(Image.open(f).convert("RGB")).astype(int)
    m=a[215:935].max(2)>48
    band=a[560:880,0:60].max(2)>60; masc=band.sum()>300
    if masc: m[:, :168]=False
    rows=np.where(m.sum(1)>=3)[0]; cols=np.where(m.sum(0)>=3)[0]
    if len(rows)==0: print(t,name,"empty"); continue
    x0,x1,y0,y1=cols.min(),cols.max(),rows.min()+215,rows.max()+215
    w=m.sum(1); cy=(np.arange(len(w))*w).sum()/w.sum()+215
    print(f"{t:7.2f} {name:26s} M={'Y' if masc else 'N'} x{x0}-{x1} y{y0}-{y1} | @1080 x{x0*1.5:.0f}-{x1*1.5:.0f} y{y0*1.5:.0f}-{y1*1.5:.0f} | bbox%={(x1-x0)*(y1-y0)/(720*1280)*100:.0f} | inkCy={cy*1.5:.0f}px ({cy/12.8:.0f}%)")
