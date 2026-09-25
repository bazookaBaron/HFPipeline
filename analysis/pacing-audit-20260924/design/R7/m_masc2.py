import subprocess,numpy as np,json
from util import V
w,h=240,600
p=subprocess.Popen(['ffmpeg','-v','error','-i',V,'-vf','crop=240:600:0:330','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
res=[];prev=None;i=0
while True:
    b=p.stdout.read(w*h*3)
    if len(b)<w*h*3:break
    f=np.frombuffer(b,np.uint8).reshape(h,w,3).astype(int)
    r,g,bb=f[...,0],f[...,1],f[...,2]
    hair=(bb>200)&(r<200)&(r>140)&(g>195)&(bb-r>35)
    ys,xs=np.where(hair)
    # dark (hoodie/outline) pixels
    dark=(f.sum(2)<200)
    dy,dx=np.where(dark)
    face=None
    rec={'i':i,'hair':int(hair.sum()),'dark':int(dark.sum())}
    if hair.sum()>50: rec.update(hx0=int(xs.min()),hx1=int(xs.max()),hy0=int(ys.min())+330,hy1=int(ys.max())+330)
    if dark.sum()>200: rec.update(dx0=int(dx.min()),dx1=int(dx.max()),dy0=int(dy.min())+330,dy1=int(dy.max())+330)
    # face region change (mouth/eyes) at approx y 430-520 native, x 50-140
    fr=f[100:200,40:150]
    rec['fd']=int((np.abs(fr-prev).sum(2)>60).sum()) if prev is not None else 0
    prev=fr; res.append(rec); i+=1
json.dump(res,open('masc.json','w')); print(i)
