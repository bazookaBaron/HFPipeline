# contact sheets from f2/ (2 fps): 6x5 tiles per sheet, each tile labelled with t
from PIL import Image, ImageDraw
import glob, os
fs=sorted(glob.glob('f2/*.png')); W,H=180,320; C,Rw=10,3
os.makedirs('sheets',exist_ok=True)
per=C*Rw
for k in range(0,len(fs),per):
    sh=Image.new('RGB',(C*W,Rw*(H+14)),'white'); d=ImageDraw.Draw(sh)
    for i,f in enumerate(fs[k:k+per]):
        n=int(os.path.basename(f)[:4]); t=(n-1)/2
        im=Image.open(f).resize((W,H)); x=(i%C)*W; y=(i//C)*(H+14)
        sh.paste(im,(x,y+14)); d.text((x+3,y+1),f"{t:.1f}",fill='black')
    sh.save(f'sheets/s{k//per:02d}.png')
print(len(fs))
