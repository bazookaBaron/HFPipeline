from m_mot import *
S=1.5
def P(label,t0,t1,fn):
    print('==',label)
    for t,a in frames(t0,t1): print('%.3f'%t, fn(a))
def near(r,c,tol=7): return (np.abs(r-np.array(c)).max(2)<=tol)
def push(a):
    r=a[150:1000,:]; m=near(r,(9,25,49),6); 
    # use column/row projections to get card box robustly
    cols=np.where(m.sum(0)>40)[0]; rows=np.where(m.sum(1)>40)[0]
    g=near(r,(3,40,21),6); gc=np.where(g.sum(0)>40)[0]; gr=np.where(g.sum(1)>40)[0]
    u=a[360:430,200:720].max(2)>150
    return 'BLUE x %.1f-%.1f y %.1f-%.1f w %.1f | GREEN x %.1f-%.1f y %.1f-%.1f w %.1f | users/router ink %d'%(cols.min()*S,cols.max()*S,(rows.min()+150)*S,(rows.max()+150)*S,(cols.max()-cols.min())*S,gc.min()*S,gc.max()*S,(gr.min()+150)*S,(gr.max()+150)*S,(gc.max()-gc.min())*S,u.sum()) if len(cols) and len(gc) else 'n/a'
P('E9 camera push',129.83,130.50,push)
