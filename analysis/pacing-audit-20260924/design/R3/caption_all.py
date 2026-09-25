from mot import *
import json
res=[]
for t0 in range(0,135,15):
    F=frames(t0,min(t0+15,134.53),0,930,720,96)
    for i,f in enumerate(F):
        d=np.abs(f-BG).sum(2); box=np.where((d>20)[20:60].mean(0)>0.6)[0]
        # also box vertical extent
        rows_=np.where((d>20)[:,300:420].mean(1)>0.6)[0]
        res.append((round(t0+i/30,3), int(box.min()) if len(box) else -1, int(box.max()) if len(box) else -1, int(rows_.min())+930 if len(rows_) else -1, int(rows_.max())+930 if len(rows_) else -1))
json.dump(res,open('caption_boxes.json','w'))
# swaps
sw=[r for i,r in enumerate(res) if i>0 and (abs(r[1]-res[i-1][1])>3 or abs(r[2]-res[i-1][2])>3)]
print('frames',len(res),'changes',len(sw))
ws=[r[2]-r[1] for r in res if r[1]>=0]; import statistics as st
print('box width px@720 min/med/max',min(ws),st.median(ws),max(ws))
tops=[r[3] for r in res if r[3]>0]; bots=[r[4] for r in res if r[4]>0]
print('top med',st.median(tops),'bottom med',st.median(bots), 'top set',sorted(set(tops))[:10])
print('left min',min(r[1] for r in res if r[1]>=0),'right max',max(r[2] for r in res))
