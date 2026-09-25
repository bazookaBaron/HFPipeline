import json, statistics as st
C=json.load(open("capflip.json")); S=json.load(open("words.json"))
W=[w for s in S for w in s["words"]]
# flips: frames where highlight x-range changes materially
flips=[];prev=None
for t,x0,x1,n,b0,b1 in C:
    key=(x0//4,x1//4) if n>50 else None
    if prev is not None and key!=prev and key is not None: flips.append((t,x0,x1,b0,b1))
    prev=key
print("flips",len(flips),"words",len(W))
# chunk swaps: box extents change
sw=[];pb=None
for t,x0,x1,n,b0,b1 in C:
    k=(b0//3,b1//3)
    if pb is not None and k!=pb: sw.append(t)
    pb=k
# merge swaps within 0.1
m=[];
for t in sw:
    if not m or t-m[-1]>0.12: m.append(t)
print("chunk swaps",len(m))
life=[b-a for a,b in zip(m,m[1:])]; print("chunk life median %.2f"%st.median(life))
# lag: for each flip, nearest word start before/after
lags=[]
for t,*_ in flips:
    d=min((t-w["s"] for w in W), key=abs)
    if abs(d)<0.4: lags.append(d)
lags.sort(); print("flip - whisper start: n %d median %+.3f p25 %+.3f p75 %+.3f"%(len(lags),st.median(lags),lags[len(lags)//4],lags[3*len(lags)//4]))
# blank caption frames
blank=[t for t,x0,x1,n,b0,b1 in C if b0<0]
print("frames with no caption box:",len(blank), blank[:20])
# words per chunk: count whisper words inside each chunk life
wc=[]
for a,b in zip(m,m[1:]):
    wc.append(sum(1 for w in W if a-0.05<=w["s"]<b-0.05))
print("words/chunk median",st.median(wc),"dist",{k:wc.count(k) for k in sorted(set(wc))})
