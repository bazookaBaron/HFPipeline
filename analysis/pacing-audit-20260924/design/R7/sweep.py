import subprocess, numpy as np, json
from util import V,W,H
p=subprocess.Popen(['ffmpeg','-v','error','-i',V,'-f','rawvideo','-pix_fmt','gray','-'],stdout=subprocess.PIPE)
R={'hdr':(150,200,0,720),'cont':(200,910,165,720),'masc':(360,915,0,165),'cap':(930,1030,0,720),'full':(0,1280,0,720)}
prev=None; out=[]; i=0; thumbs=[]
while True:
    b=p.stdout.read(W*H)
    if len(b)<W*H: break
    f=np.frombuffer(b,np.uint8).reshape(H,W).astype(np.int16)
    if i%3==0: thumbs.append(f[::4,::4].astype(np.uint8))
    if prev is not None:
        d=np.abs(f-prev)
        row={'i':i}
        for k,(y0,y1,x0,x1) in R.items():
            dd=d[y0:y1,x0:x1]; row[k]=int((dd>24).sum())
        out.append(row)
    prev=f; i+=1
json.dump(out,open('sweep.json','w')); np.save('thumbs10.npy',np.array(thumbs)); print(i)
