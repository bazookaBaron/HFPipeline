import numpy as np
def fit(vals, name=""):
    v=np.array(vals,float); v=(v-v[0])/(v[-1]-v[0]); n=len(v)-1; t=np.arange(n+1)/n
    best=[]
    for kind in ["out","in","inout"]:
        for p in [1,1.5,2,2.5,3,4,5]:
            if kind=="out": f=1-(1-t)**p
            elif kind=="in": f=t**p
            else: f=np.where(t<.5,(2*t)**p/2,1-(2-2*t)**p/2)
            best.append((np.sqrt(((f-v)**2).mean()),kind,p))
    best.sort(); e,k,p=best[0]
    print(f"{name}: frames={n} ({n*33.3:.0f} ms) best=ease-{k} power{p} rmse={e:.3f}; linear rmse={np.sqrt(((t-v)**2).mean()):.3f}; deltas={np.round(np.diff(np.array(vals,float)),1).tolist()}")
if __name__=="__main__":
    fit([52,67,104,139,169,195,219,241,259,275,289,300,309,317,323,329,331,333,335,336,337],"NETWORK bar")
    fit([241,301,362,413,457,497,529,559,583,603,619,631,641,649,653,657,659,660],"UPLINK bar")
    fit([-136+17,17,47,73,92,108,121,131,139,144,148,153],"mascot slide (shoe x)")
    fit([617,622,632,640,646,650,653,656,656,658],"mascot punch settle (h)")
    fit([78,136,197,211,222,227],"log row opacity")
