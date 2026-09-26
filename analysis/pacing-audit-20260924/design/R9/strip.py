# strip.py t0 t1 x0 y0 x1 y1 out [scale]  -> native-res crops of every frame in [t0,t1], tiled
import sys, subprocess, numpy as np
from PIL import Image, ImageDraw
V=r"C:/Users/debna/Downloads/igexport-Ddb-aswiHnN.mp4"
t0,t1=float(sys.argv[1]),float(sys.argv[2]); x0,y0,x1,y1=map(int,sys.argv[3:7]); out=sys.argv[7]; sc=float(sys.argv[8]) if len(sys.argv)>8 else 1
n=int(round((t1-t0)*30))+1
b=subprocess.run(['ffmpeg','-v','error','-ss',f'{t0-0.001:.3f}','-i',V,'-frames:v',str(n),'-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
fr=np.frombuffer(b,np.uint8).reshape(-1,1280,720,3)
w,h=int((x1-x0)*sc),int((y1-y0)*sc); C=min(6,len(fr)); Rn=(len(fr)+C-1)//C
sh=Image.new('RGB',(C*w,Rn*(h+14)),'white'); d=ImageDraw.Draw(sh)
for i,f in enumerate(fr):
    im=Image.fromarray(f[y0:y1,x0:x1]).resize((w,h)); x=(i%C)*w; y=(i//C)*(h+14)
    sh.paste(im,(x,y+14)); d.text((x+2,y+1),f"{t0+i/30:.3f}",fill='black')
sh.save(out); print(len(fr))
