# crops.py out x0 y0 x1 y1 scale t1 t2 ... : grid of crops at given times (native coords)
import sys, subprocess, numpy as np
from PIL import Image, ImageDraw
V=r"C:/Users/debna/Downloads/igexport-Ddb-aswiHnN.mp4"
out=sys.argv[1]; x0,y0,x1,y1=map(int,sys.argv[2:6]); sc=float(sys.argv[6]); ts=[float(t) for t in sys.argv[7:]]
w,h=int((x1-x0)*sc),int((y1-y0)*sc); C=min(4,len(ts)); Rn=(len(ts)+C-1)//C
sh=Image.new('RGB',(C*w,Rn*(h+14)),'white'); d=ImageDraw.Draw(sh)
for i,t in enumerate(ts):
    b=subprocess.run(['ffmpeg','-v','error','-ss',f'{t:.3f}','-i',V,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
    f=np.frombuffer(b,np.uint8).reshape(1280,720,3)
    im=Image.fromarray(f[y0:y1,x0:x1]).resize((w,h)); x=(i%C)*w; y=(i//C)*(h+14)
    sh.paste(im,(x,y+14)); d.text((x+2,y+1),f"{t:.2f}",fill='black')
sh.save(out)
