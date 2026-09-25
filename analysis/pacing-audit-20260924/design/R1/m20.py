from grab import *
def vscan(t,x,y0,y1,thr=14,name=""):
    a=grab(t); col=a[y0:y1,x]; bg=np.median(col,0)
    # print transitions of luminance
    L=col.sum(1); edges=[]
    prev=None
    segs=[];cur=None
    for i,v in enumerate(L):
        c=hx(col[i])
        if cur is None or abs(v-cur[2])>thr: 
            if cur: segs.append(cur)
            cur=[y0+i,y0+i,v,c]
        else: cur[1]=y0+i
    segs.append(cur)
    print(name,t,"x=",x); print("   "," ".join(f"{s[0]}-{s[1]}:{s[3][1:]}" for s in segs if True))
def hscan(t,y,x0,x1,thr=14,name=""):
    a=grab(t); row=a[y,x0:x1]; L=row.sum(1); segs=[];cur=None
    for i,v in enumerate(L):
        if cur is None or abs(v-cur[2])>thr:
            if cur: segs.append(cur)
            cur=[x0+i,x0+i,v,hx(row[i])]
        else: cur[1]=x0+i
    segs.append(cur); print(name,t,"y=",y); print("   "," ".join(f"{s[0]}-{s[1]}:{s[3][1:]}" for s in segs))
vscan(50.73,650,330,760,name="accesslog")
hscan(50.73,380,190,700,name="accesslog-row")
vscan(141.73,40+5,250,720,name="ippills")
hscan(141.73,305,30,700,name="ippills-row")
vscan(98.58,560,330,900,name="slotgrid")
hscan(98.58,500,300,700,name="slotgrid-row")
vscan(153.48,650,350,860,name="signals")
vscan(62.08,300,300,620,name="devcards")
hscan(62.08,450,200,700,name="devcards-row")
