import sys; from util import *; import numpy as np
def runs(mask):
    r=[];s=None
    for i,v in enumerate(mask):
        if v and s is None: s=i
        if not v and s is not None: r.append((s,i-1)); s=None
    if s is not None: r.append((s,len(mask)-1))
    return r
def panels(f):
    g=f.astype(int).sum(2)
    dark=g<150
    out=[]
    # title bars: rows where a dark run >=80 px; group consecutive rows with same run
    bars={}
    for y in range(200,915):
        for x0,x1 in runs(dark[y]):
            if x1-x0>=80:
                key=(x0//3,x1//3)
                bars.setdefault(key,[]).append(y)
    res=[]
    for (a,b),ys in bars.items():
        ys=sorted(ys)
        # split into contiguous groups
        grp=[[ys[0]]]
        for y in ys[1:]:
            if y-grp[-1][-1]<=1: grp[-1].append(y)
            else: grp.append([y])
        for gy in grp:
            res.append((gy[0],gy[-1],a*3,b*3))
    res.sort()
    return res
for t in sys.argv[1:]:
    f=frame(float(t)); r=panels(f)
    print(t, [(y0,y1,x0,x1) for y0,y1,x0,x1 in r if y1-y0>=1][:30])
