from m_util import *
S=1.5
for p,(x0,x1) in [('fr_000.750.png',(0,720)),('fr_025.567.png',(0,720)),('../ref_frames/R2_018.26_topology-carrier.png',(0,720)),('fr_145.200.png',(0,720))]:
    a=load(p)
    # locate border
    white=a.min(2)>200
    vl=[x for x in range(720) if white[944:1022,x].sum()>60]
    L,R=vl[0],vl[-1]
    inner=a[948:1018, L+3:R-2]
    txt=inner.max(2)>120
    ys=np.where(txt.any(1))[0]; xs=np.where(txt.any(0))[0]
    fill=inner[~txt].reshape(-1,3); u,c=np.unique(fill,axis=0,return_counts=True)
    wt=inner[(inner.min(2)>225)]; bt=inner[(inner[:,:,2]>220)&(inner[:,:,0]<130)]
    print(p,'box x',L*S,R*S,'text rows',(ys.min()+948)*S,(ys.max()+948)*S,'text x',(xs.min()+L+3)*S,(xs.max()+L+3)*S,
      'pad L',(xs.min()+3)*S,'pad R',(R-2-(xs.max()+L+3))*S,'fill',hx(u[c.argmax()]),'white',hx(np.median(wt,0)) if len(wt) else None,'blue',hx(np.median(bt,0)) if len(bt) else None)
    # border colour & shadow colour
    print('  border px', hx(a[944,(L+R)//2]),hx(a[945,(L+R)//2]),hx(a[980,L]),hx(a[980,L+1]),' shadow below', [hx(a[y,(L+R)//2]) for y in range(1020,1030)], 'right', [hx(a[990,x]) for x in range(R-1,R+9)])
    # per-row text profile for cap height
    prof=[(y+948, int(txt[y].sum())) for y in range(txt.shape[0])]
    print('  rowprof',[p for p in prof if p[1]>0][:3], [p for p in prof if p[1]>0][-3:])
