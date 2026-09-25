import sys
from util import *
from PIL import Image, ImageDraw
t0,t1=float(sys.argv[1]),float(sys.argv[2]); x0,y0,x1,y1=[int(v) for v in sys.argv[3].split(",")]; out=sys.argv[4]
fr=list(frames(t0,t1)); w,h=x1-x0,y1-y0; cols=min(len(fr),8); rows=(len(fr)+cols-1)//cols
sh=Image.new("RGB",(cols*w,rows*(h+14)),"white"); d=ImageDraw.Draw(sh)
for i,(t,a) in enumerate(fr):
    x,y=(i%cols)*w,(i//cols)*(h+14); sh.paste(Image.fromarray(a).crop((x0,y0,x1,y1)),(x,y+14)); d.text((x+2,y+1),"%.3f"%t,fill="red")
sh.save(out)
