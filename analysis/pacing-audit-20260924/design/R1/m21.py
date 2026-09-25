from grab import *
a=grab(84.83)
m=(np.abs(a[290:360,:]-a[292,5]).sum(2)>25)
rows=np.where(m.sum(1)>50)[0]; print("tab rows",rows.min()+290,rows.max()+290)
y=(rows.min()+rows.max())//2+290
r=a[y]; segs=[]
L=r.sum(1); edge=[x for x in range(1,720) if abs(L[x]-L[x-1])>40]
print("edges at y",y,edge)
print("active fill",hx(a[y,100]),"inactive fill",hx(a[y,300]),hx(a[y,600]))
print("active text",topcol(a,20,y-8,240,y+8,0.03),"inactive text",topcol(a,250,y-8,460,y+8,0.03))
