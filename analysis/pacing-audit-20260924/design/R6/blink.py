import subprocess, numpy as np, json, statistics as st
from util import V
cmd=["ffmpeg","-v","quiet","-i",V,"-vf","crop=80:60:50:420","-f","rawvideo","-pix_fmt","rgb24","-"]
p=subprocess.Popen(cmd,stdout=subprocess.PIPE); out=[]
while True:
    b=p.stdout.read(80*60*3)
    if len(b)<80*60*3: break
    a=np.frombuffer(b,np.uint8).reshape(60,80,3).astype(int)
    out.append(int(((a.min(2)>235)).sum()))
v=np.array(out); med=np.median(v); print("median white",med)
closed=v<med*0.35
ev=[];i=0
while i<len(v):
    if closed[i]:
        j=i
        while j<len(v) and closed[j]: j+=1
        ev.append((i/30,j-i)); i=j
    else: i+=1
ev=[e for e in ev if e[0]>0.5]
print("blinks",len(ev)); print([(round(t,2),n) for t,n in ev])
iv=[b[0]-a[0] for a,b in zip(ev,ev[1:])]; print("interval median %.2f min %.2f max %.2f"%(st.median(iv),min(iv),max(iv)))
