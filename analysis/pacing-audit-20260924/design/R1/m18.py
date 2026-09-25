from grab import *
import sys
C={"red":lambda r,g,b:(r>170)&(g<110)&(b<140),"amber":lambda r,g,b:(r>190)&(g>120)&(g<210)&(b<100),
   "purple":lambda r,g,b:(b>170)&(r>100)&(g<150)&(r<220),"cyan":lambda r,g,b:(g>170)&(b>190)&(r<150),
   "green":lambda r,g,b:(g>160)&(r<150)&(b<150),"white":lambda r,g,b:(r>225)&(g>225)&(b>225)}
def scan(t,y0=215,y1=935):
    a=grab(t); r,g,b=[a[y0:y1,:,i] for i in range(3)]
    out=[]
    for k,f in C.items():
        m=f(r,g,b)
        if m.sum()<30: continue
        ys,xs=np.where(m)
        px=a[y0:y1][m]; s=px.sum(1); top=px[np.argsort(s)[-max(1,len(s)//4):]]
        out.append(f"{k}:{m.sum()}px bbox x{xs.min()}-{xs.max()} y{ys.min()+y0}-{ys.max()+y0} col {hx(np.median(top,0))} (median all {hx(np.median(px,0))})")
    print(f"t={t}"); [print("  ",o) for o in out]
for t in sys.argv[1:]: scan(float(t))
