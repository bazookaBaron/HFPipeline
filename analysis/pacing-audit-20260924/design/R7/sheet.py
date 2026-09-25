import sys,glob
from PIL import Image, ImageDraw
files=sorted(glob.glob('f1/f_*.png'))
cols,rows=8,2; tw,th=240,427
for si in range(0,len(files),cols*rows):
    sh=Image.new('RGB',(cols*tw,rows*(th+18)),(40,0,0))
    d=ImageDraw.Draw(sh)
    for k,f in enumerate(files[si:si+cols*rows]):
        t=int(f[-7:-4])-1+0.0  # fps=1 frame n at t=n-1+0.5? ffmpeg fps filter: frame n ~ t=n-1 (rounded)
        im=Image.open(f).resize((tw,th))
        x=(k%cols)*tw; y=(k//cols)*(th+18)
        sh.paste(im,(x,y+18)); d.text((x+4,y+3),f"{t:.0f}s",fill=(255,255,0))
    sh.save(f'sc/sheet_{si//(cols*rows):02d}.png')
print(len(files))
