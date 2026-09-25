from mot import *
import json, statistics as st
out=[]
for t0 in range(0,135,20):
    F=frames(t0,min(t0+20,134.53),90,560,48,60)
    for i,f in enumerate(F):
        eye=f[5:30]; mouth=f[36:56]
        white=int(((eye.min(2))>225).sum())
        L=mouth.sum(2); mo=int(((mouth[...,0]>90)&(mouth[...,0]<170)&(mouth[...,1]<80)).sum())
        dk=np.where((eye.sum(2)<150))
        py=float(dk[0].mean()) if len(dk[0]) else -1
        out.append((round(t0+i/30,3),white,mo,round(py,1)))
json.dump(out,open('mascot_track.json','w'))
w=[o[1] for o in out]; print('white q',st.quantiles(w,n=10))
m=[o[2] for o in out]; print('mouth q',st.quantiles(m,n=10))
