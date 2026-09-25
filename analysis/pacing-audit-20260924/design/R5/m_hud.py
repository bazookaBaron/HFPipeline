from PIL import Image; import numpy as np, sys
f=sys.argv[1]
im=np.array(Image.open(f).convert('RGB')).astype(int); L=im.mean(2)
h=lambda p:'#%02x%02x%02x'%tuple(int(v) for v in p)
# find progress bar row: y 125-165, x 440-700
reg=L[120:170,440:700]
ys=np.where(reg.max(1)>30)[0]+120; print('bar rows (L>30)',ys.min() if len(ys) else None, ys.max() if len(ys) else None)
for y in sorted(set(ys)):
    row=L[y,440:700]; on=np.where(row>30)[0]+440
    # segments
    segs=[];s=on[0];p=on[0]
    for x in on[1:]:
        if x!=p+1: segs.append((s,p)); s=x
        p=x
    segs.append((s,p)); print(y,segs)
    for a,b in segs: print('   ',a,b,h(im[y,(a+b)//2]))
# label text extents
reg=L[120:170,30:300]; ys=np.where(reg.max(1)>60)[0]+120; xs=np.where(reg.max(0)>60)[0]+30
print('label y',ys.min(),ys.max(),'x',xs.min(),xs.max(),'brightest',h(im[120:170,30:300].reshape(-1,3)[np.argmax(L[120:170,30:300])]))
# thin divider line under HUD?
for y in range(150,185): 
   r=L[y,40:680]; 
   if r.mean()>13: print('line y',y,round(r.mean(),1),h(np.median(im[y,40:680],0)))
