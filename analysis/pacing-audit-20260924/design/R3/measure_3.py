from mlib import *
im=load('f_1.41.png')
print('header text rows', rows(im,40,700,140,200,thr=60))
print('header left bbox', bbox(im,40,145,300,180,thr=60), ink(im,40,145,300,180))
print('header right bbox', bbox(im,500,145,700,180,thr=60), ink(im,500,145,700,180))
# rule
for y in range(180,195):
    r=im[y,40:700]; d=np.abs(r-BG).sum(1)
    if (d>15).sum()>300: xs=np.where(d>15)[0]; print('rule y',y,'x',40+xs.min(),40+xs.max(),hx(np.median(r[d>15],0)), 'n',(d>15).sum())
print('title rows', rows(im,40,700,200,270,thr=100), bbox(im,40,200,700,270,thr=100), ink(im,40,200,700,270))
# cap height: 'G' of Git at x~50
print('G bbox', bbox(im,45,205,80,265,thr=150))
print('k (ascender) ', bbox(im,40,200,700,270,thr=150))
print('subtitle', bbox(im,40,300,600,335,thr=60), ink(im,40,300,600,335))
print('S bbox', bbox(im,48,305,62,330,thr=60))
