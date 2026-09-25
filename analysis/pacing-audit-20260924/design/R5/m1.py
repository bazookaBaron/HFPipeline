from PIL import Image
import numpy as np, sys
im=np.array(Image.open('../ref_frames/R5_044.78_entity-network.png').convert('RGB')).astype(int)
H,W,_=im.shape
def hx(p): return '#%02x%02x%02x'%tuple(p)
# background: median of corner regions
for name,(y0,y1,x0,x1) in {'topleft':(0,100,0,100),'bottom':(1150,1280,0,720),'mid-right':(800,900,400,700)}.items():
    r=im[y0:y1,x0:x1].reshape(-1,3); print(name,'median',hx(np.median(r,0).astype(int)),'min',hx(r.min(0)),'max',hx(r.max(0)))
# grid lines: column profile of luma in bottom band y 1100-1250
L=im.mean(2)
prof=L[1100:1250].mean(0)
peaks=[x for x in range(1,W-1) if prof[x]>prof[x-1] and prof[x]>=prof[x+1] and prof[x]>np.median(prof)+0.8]
print('grid col peaks',peaks, 'median',np.median(prof))
rowp=L[:, 600:700].mean(1)
rp=[y for y in range(1,H-1) if rowp[y]>rowp[y-1] and rowp[y]>=rowp[y+1] and rowp[y]>np.median(rowp)+0.8]
print('grid row peaks',rp[:60])
