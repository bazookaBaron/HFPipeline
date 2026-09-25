import subprocess,numpy as np,json
from util import V
h=110
p=subprocess.Popen(['ffmpeg','-v','error','-i',V,'-vf','crop=720:110:0:930','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
out=[];i=0
while True:
    b=p.stdout.read(720*h*3)
    if len(b)<720*h*3:break
    f=np.frombuffer(b,np.uint8).reshape(h,720,3).astype(int)
    row=f[55]  # y 985 native
    white=np.where((row.min(1)>250))[0]
    yl=(f[...,0]>235)&(f[...,1]>205)&(f[...,2]<175)&(f[...,2]>100)
    ys,xs=np.where(yl)
    # box vertical extent at center column of box
    rec={'i':i}
    if len(white)>20:
        rec['bx0']=int(white.min()); rec['bx1']=int(white.max())
        c=(white.min()+white.max())//2; col=f[:,c].min(1); wy=np.where(col>248)[0]
        rec['by0']=int(wy.min())+930; rec['by1']=int(wy.max())+930
    if yl.sum()>100: rec.update(yx0=int(xs.min()),yx1=int(xs.max()),yy0=int(ys.min())+930,yy1=int(ys.max())+930,yn=int(yl.sum()))
    # text ink: dark pixels
    dk=f.sum(2)<250; rec['dark']=int(dk.sum())
    gr=(np.abs(f[...,0]-f[...,2])<12)&(f.sum(2)>250)&(f.sum(2)<400); rec['grey']=int(gr.sum())
    out.append(rec); i+=1
json.dump(out,open('cap.json','w')); print(i)
