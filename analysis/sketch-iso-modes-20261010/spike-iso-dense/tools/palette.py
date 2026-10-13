# python -I tools/palette.py img.png [x1]  -> share of world pixels (x < x1, puppet column excluded) near a teal theme token
import sys
from PIL import Image
T={"bg":"1FA3A0","deep":"126B69","pale":"C6ECEA","shadow":"1C3F7A","marker":"F6DA1C","alert":"E8553E","ink":"111111","paper":"FBF7EE"}
P={k:tuple(int(v[i:i+2],16) for i in (0,2,4)) for k,v in T.items()}
bg=P["bg"]; P["dot"]=tuple(round(c*(1-.13)) for c in bg)  # rgba(0,0,0,.13) over bg
im=Image.open(sys.argv[1]).convert("RGB"); x1=int(sys.argv[2]) if len(sys.argv)>2 else im.width
px=im.crop((0,0,x1,im.height)).getdata(); n=len(px); hit={k:0 for k in P}; off=0
for c in px:
    k,d=min(((k,sum((a-b)**2 for a,b in zip(c,v))) for k,v in P.items()),key=lambda z:z[1])
    if d<=12**2*3: hit[k]+=1
    else: off+=1
print(sys.argv[1], "on-palette %.2f%%"%(100*(n-off)/n), "off (AA edges etc) %.2f%%"%(100*off/n), {k:round(100*v/n,1) for k,v in hit.items() if v})
