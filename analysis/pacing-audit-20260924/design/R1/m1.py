from grab import *
a=grab(39.68)
H,W,_=a.shape; print(W,H)
# background samples
for (x,y) in [(5,5),(700,20),(360,1200),(10,1270),(200,300),(700,900)]:
    print("px",x,y,hx(a[y,x]))
# luminance of row / find dot grid: scan row y=100 for bright pixels
L=a.sum(2)
for y in range(0,160):
    r=L[y]; 
    if r.max()>60: print("row",y,"max",r.max(),"cols>",list(np.where(r>r.max()*0.7)[0][:30]))
