from m_util import *
a=load('../ref_frames/R2_018.26_topology-carrier.png')
S=1.5
print('corners',[hx(a[y,x]) for y,x in [(5,5),(5,715),(1275,5),(1275,715),(640,700)]])
# background histogram in empty area rows 1100-1270
bg=a[1100:1270].reshape(-1,3); u,c=np.unique(bg,axis=0,return_counts=True); o=np.argsort(-c)[:6]; print('bg top', [(hx(u[i]),c[i]) for i in o])
bg=a[220:340,200:700].reshape(-1,3); u,c=np.unique(bg,axis=0,return_counts=True); o=np.argsort(-c)[:8]; print('bg mid top', [(hx(u[i]),c[i]) for i in o])
for y in [181,541,653,720,840,985]:
    print('ROW',y,[(s*S,e*S,h) for s,e,h in runs(a[y],10) if e-s>=1][:40])
for x in [60,330,450,568,655]:
    print('COL',x,[(s*S,e*S,h) for s,e,h in runs(a[:,x],10) if e-s>=1][:40])
