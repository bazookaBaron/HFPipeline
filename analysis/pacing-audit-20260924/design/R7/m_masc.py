import numpy as np
T=np.load('thumbs10.npy').astype(int)  # 10fps, 320x180
print(T.shape)
bg=241
m=np.abs(T[:,90:228,0:40]-bg)>25   # mascot column y 360-912 native, x0-160
cnt=m.sum((1,2))
pres=cnt>400
# transitions
prev=None
for i,p in enumerate(pres):
    if p!=prev: print(f"{i/10:6.1f} {'ON ' if p else 'off'} cnt={cnt[i]}")
    prev=p
# bbox of mascot at several times
for t in [5,45,80,120,127,129]:
    i=t*10; yy,xx=np.where(m[i]); print(t, 'bbox x',xx.min()*4,xx.max()*4,'y',(yy.min()+90)*4,(yy.max()+90)*4)
