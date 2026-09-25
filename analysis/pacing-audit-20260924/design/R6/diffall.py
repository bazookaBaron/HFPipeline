from util import *
import numpy as np, json
# regions in native 720x1280 coords -> in half scale
R={"header":(145,200,25,695),"chips":(200,232,45,675),"note":(255,360,38,192),"content":(245,900,195,700),"caption":(940,1030,60,660),"mascot":(365,915,0,160)}
prev=None; out=[]
for t,a in frames(0,156,gray=True,scale=2):
    a=a.astype(np.int16)
    if prev is not None:
        row={"t":round(t,3)}
        for k,(y0,y1,x0,x1) in R.items():
            d=np.abs(a[y0//2:y1//2,x0//2:x1//2]-prev[y0//2:y1//2,x0//2:x1//2])
            row[k]=round(float((d>12).mean()*100),3)
        out.append(row)
    prev=a
json.dump(out,open("diffs.json","w"))
print(len(out))
