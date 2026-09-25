import sys,glob
from PIL import Image,ImageDraw
# args: start_s end_s step_s cols out
s,e,st,cols,out=float(sys.argv[1]),float(sys.argv[2]),float(sys.argv[3]),int(sys.argv[4]),sys.argv[5]
ts=[];t=s
while t<=e+1e-6: ts.append(t); t+=st
W,H=180,320
rows=(len(ts)+cols-1)//cols
sh=Image.new("RGB",(cols*W,rows*(H+14)),"#333")
d=ImageDraw.Draw(sh)
for i,t in enumerate(ts):
    idx=int(round(t*10))+1
    try: im=Image.open(f"dense/d_{idx:05d}.jpg").resize((W,H))
    except: continue
    x,y=(i%cols)*W,(i//cols)*(H+14)
    sh.paste(im,(x,y+14)); d.text((x+2,y+1),f"{t:.1f}",fill="yellow")
sh.save(out,quality=85)
