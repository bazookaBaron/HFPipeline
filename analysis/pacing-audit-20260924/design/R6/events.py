import json
D=json.load(open("diffs.json"))
def runs(key,thr,gap=2):
    ev=[];cur=None
    for r in D:
        if r[key]>thr:
            if cur and r["t"]-cur["t1"]<=gap/30+1e-6: cur["t1"]=r["t"]; cur["pk"]=max(cur["pk"],r[key]); cur["sum"]+=r[key]
            else:
                cur={"t0":r["t"],"t1":r["t"],"pk":r[key],"sum":r[key]}; ev.append(cur)
    return ev
import sys
for key,thr in [("content",0.15),("note",0.5),("header",0.3),("chips",0.3)]:
    ev=runs(key,thr)
    print(key,len(ev))
    if key=="content":
        for e in ev: print(f"  {e['t0']:.3f}-{e['t1']:.3f} d={int(round((e['t1']-e['t0'])*30))+1}f pk={e['pk']:.1f} sum={e['sum']:.1f}")
    else:
        print("  "," ".join(f"{e['t0']:.2f}({e['pk']:.0f})" for e in ev))
