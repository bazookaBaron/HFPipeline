from PIL import Image
import numpy as np
im=np.array(Image.open('f_1.41.png').convert('RGB')).astype(float)
reg=im[1040:1280,:,:]
L=reg.mean(2)
col=L.mean(0); row=L.mean(1)
cm=[i for i in range(1,719) if col[i]<col[i-1] and col[i]<col[i+1] and col[i]<np.median(col)-0.3]
rm=[i+1040 for i in range(1,239) if row[i]<row[i-1] and row[i]<row[i+1] and row[i]<np.median(row)-0.3]
print('col minima',cm); print('diff',np.diff(cm))
print('row minima',rm); print('diff',np.diff(rm))
# darkest dot pixel
y,x=np.unravel_index(np.argmin(L),L.shape); print('darkest',x,y+1040,reg[y,x],L.min(), 'bg',np.median(L))
# dot size: around darkest
print(L[max(0,y-3):y+4, x-3:x+4].round(0))
