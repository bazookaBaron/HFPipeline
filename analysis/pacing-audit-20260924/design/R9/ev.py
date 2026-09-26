import json, numpy as np, sys
rows=json.load(open('sig.json')); N=len(rows)
def clusters(key,thr,gap=3):
    d=np.array([r[key] for r in rows]); idx=np.where(d>thr)[0]; out=[]
    for i in idx:
        if out and i-out[-1][1]<=gap: out[-1][1]=i; out[-1][2]=max(out[-1][2],d[i])
        else: out.append([i,i,d[i]])
    return out
for key,thr in [(sys.argv[1],float(sys.argv[2]))]:
    cl=clusters(key,thr)
    print(key,len(cl))
    print(' '.join(f"{a/30:.2f}-{b/30:.2f}({m:.1f})" for a,b,m in cl))
