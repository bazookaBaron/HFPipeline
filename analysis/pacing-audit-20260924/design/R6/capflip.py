import subprocess, numpy as np, json
from util import V
w,h=720,100
cmd=["ffmpeg","-v","quiet","-i",V,"-vf","crop=720:100:0:935","-f","rawvideo","-pix_fmt","rgb24","-"]
p=subprocess.Popen(cmd,stdout=subprocess.PIPE)
out=[];n=0
while True:
    b=p.stdout.read(w*h*3)
    if len(b)<w*h*3: break
    a=np.frombuffer(b,np.uint8).reshape(h,w,3).astype(int)
    y=(a[:,:,0]>230)&(a[:,:,1]>195)&(a[:,:,2]<175)
    xs=np.where(y.any(0))[0]
    wbox=np.where((a[40:60].min(2)>=248).any(0))[0]
    out.append((n/30, int(xs.min()) if len(xs) else -1, int(xs.max()) if len(xs) else -1, int(y.sum()), int(wbox.min()) if len(wbox) else -1, int(wbox.max()) if len(wbox) else -1))
    n+=1
json.dump(out,open("capflip.json","w")); print(n)
