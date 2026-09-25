import sys; from util import *; from PIL import Image, ImageDraw; import numpy as np
# usage: strip.py name t0 dur x0 y0 x1 y1 [step] [scale]
name,t0,dur,x0,y0,x1,y1=sys.argv[1],float(sys.argv[2]),float(sys.argv[3]),*map(int,sys.argv[4:8])
step=int(sys.argv[8]) if len(sys.argv)>8 else 1; sc=float(sys.argv[9]) if len(sys.argv)>9 else 0.5
ts,a=frames(t0,dur)
ts=ts[::step]; a=a[::step]
w=int((x1-x0)*sc); h=int((y1-y0)*sc); cols=min(len(a),10); rows=(len(a)+cols-1)//cols
img=Image.new('RGB',(cols*w,rows*(h+14)),(60,0,0)); d=ImageDraw.Draw(img)
for k,(t,f) in enumerate(zip(ts,a)):
    x=(k%cols)*w; y=(k//cols)*(h+14)
    img.paste(Image.fromarray(f[y0:y1,x0:x1]).resize((w,h)),(x,y+14)); d.text((x+2,y+1),f"{t:.3f}",fill=(255,255,0))
img.save(f'sc/st_{name}.png'); print(img.size)
