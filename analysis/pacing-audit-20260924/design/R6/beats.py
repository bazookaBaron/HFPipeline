import json, statistics as st
D=json.load(open("diffs.json"))
def onsets(keys,thr,merge=0.2):
    on=[];last=-9;active=False
    for r in D:
        ch=any(r[k]>thr for k in keys)
        if ch and not active and r["t"]-last>merge: on.append(r["t"])
        if ch: last=r["t"]
        active=ch
    return on
for thr in (0.15,0.3):
    on=onsets(["content","note","header","chips"],thr)
    g=[b-a for a,b in zip(on,on[1:])]
    print(f"thr {thr}: {len(on)} onsets = {len(on)/155.6*60:.1f}/min; gap median {st.median(g):.2f} p10 {sorted(g)[len(g)//10]:.2f} p90 {sorted(g)[9*len(g)//10]:.2f} max {max(g):.2f} at {on[g.index(max(g))]:.2f}")
# holds: longest spans with no change at all in content+note+header (any pixel >0.05)
still=[];s=None
for r in D:
    ch=any(r[k]>0.05 for k in ["content","note","header","chips"])
    if not ch and s is None: s=r["t"]
    if ch and s is not None: still.append((r["t"]-s,s)); s=None
still.sort(reverse=True); print("longest fully-still spans:",[(round(d,2),round(t,2)) for d,t in still[:8]])
n_ident=sum(1 for r in D if all(r[k]<=0.05 for k in ["content","note","header","chips"]))
print("frames with no graphic change: %d / %d = %.1f%%"%(n_ident,len(D),100*n_ident/len(D)))
json.dump(onsets(["content","note","header","chips"],0.15),open("onsets.json","w"))
