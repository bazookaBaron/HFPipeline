from m_util import *
a=load('ours_09.00.png')
def col(x,y0,y1,step=1,thr=14):
    v=a[y0:y1,x]; out=[]
    for i in range(1,len(v)):
        if np.abs(v[i]-v[i-1]).sum()>thr: out.append((y0+i,hx(v[i-1]),hx(v[i])))
    return out
def row(y,x0,x1,thr=14):
    v=a[y,x0:x1]; out=[]
    for i in range(1,len(v)):
        if np.abs(v[i]-v[i-1]).sum()>thr: out.append((x0+i,hx(v[i-1]),hx(v[i])))
    return out
print('col540', col(540,150,1420)[:60])
print('row245', row(245,20,1060)[:12], row(245,20,1060)[-6:])
print('row800', row(800,280,1060))
print('col400', col(400,480,560))
print('bg', [hx(a[y,x]) for y,x in [(60,540),(160,540),(1700,540),(1880,540),(960,300),(960,1060),(400,200)]])
