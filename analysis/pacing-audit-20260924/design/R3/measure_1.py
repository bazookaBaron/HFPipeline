from PIL import Image
import numpy as np
im=np.array(Image.open('f_1.41.png').convert('RGB')).astype(int)
H,W,_=im.shape
def hx(p): return '#%02x%02x%02x'%tuple(int(v) for v in p)
print('size',W,H)
for (x,y) in [(5,5),(700,5),(5,1270),(700,1270),(360,1150),(360,60)]:
    print('bg',x,y,hx(im[y,x]))
# dot grid: scan region y 1050-1280 x 0-720 luminance
reg=im[1040:1280,:,:].mean(2)
med=np.median(reg)
print('bg median lum',med)
ys,xs=np.where(reg<med-4)
print('dark px count',len(ys))
# column histogram
colh=np.bincount(xs,minlength=W); rowh=np.bincount(ys,minlength=240)
print('cols with dots',[i for i,v in enumerate(colh) if v>3][:60])
print('rows with dots',[i+1040 for i,v in enumerate(rowh) if v>3][:60])
