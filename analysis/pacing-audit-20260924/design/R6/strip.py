import sys
from util import *
from PIL import Image, ImageDraw
t0,t1,out=float(sys.argv[1]),float(sys.argv[2]),sys.argv[3]
sc=int(sys.argv[4]) if len(sys.argv)>4 else 4
fr=list(frames(t0,t1,scale=sc))
w,h=720//sc,1280//sc; cols=min(len(fr),10); rows=(len(fr)+cols-1)//cols
sh=Image.new("RGB",(cols*w,rows*(h+12)),"#222"); d=ImageDraw.Draw(sh)
for i,(t,a) in enumerate(fr):
    x,y=(i%cols)*w,(i//cols)*(h+12); sh.paste(Image.fromarray(a),(x,y+12)); d.text((x+2,y),f"{t:.3f}",fill="yellow")
sh.save(out)
