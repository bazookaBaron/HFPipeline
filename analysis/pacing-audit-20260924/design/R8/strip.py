import sys
from PIL import Image,ImageDraw
t0=float(sys.argv[1]); n=int(sys.argv[2]); out=sys.argv[3]; step=int(sys.argv[4]) if len(sys.argv)>4 else 1
box=(0,100,720,960); sc=0.33
ims=[]
for i in range(n):
    f=int(round(t0*30))+1+i*step
    im=Image.open('f30/%05d.jpg'%f).crop(box); im=im.resize((int(im.width*sc),int(im.height*sc)))
    d=ImageDraw.Draw(im); d.text((3,3),'%.3f'%((f-1)/30),fill=(255,255,0)); ims.append(im)
cols=min(n,8); rows=(n+cols-1)//cols
W,H=ims[0].size; S=Image.new('RGB',(W*cols,H*rows))
for i,im in enumerate(ims): S.paste(im,((i%cols)*W,(i//cols)*H))
S.save(out)
