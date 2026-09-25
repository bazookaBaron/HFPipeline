from m13 import *
def m2(a):
    band=a[210:900,0:140].max(2)>60
    rows=np.where(band.sum(1)>3)[0]
    top=rows.min()+210; bot=rows.max()+210
    # shoes: left x of mascot at row bot-10
    r=a[bot-12,0:260].max(1)>60; xs=np.where(r)[0]
    return top,bot,bot-top+1,(xs.min(),xs.max()) if len(xs) else None
for tag,t0 in [("p9",9.0),("p10",10.35),("p39",39.7),("p175",174.85),("p0",0.0),("p43",43.3),("p48",48.0)]:
    fs=frames(0,0,tag)
    out=[]
    for i,f in enumerate(fs):
        try: out.append(f"{t0+i/30:.3f}:{m2(f)}")
        except Exception as e: out.append(f"{t0+i/30:.3f}:none")
    print(tag); print("\n".join(out))
