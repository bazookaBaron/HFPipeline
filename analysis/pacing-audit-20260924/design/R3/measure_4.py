from mlib import *
im=load('f_1.41.png')
def scanx(y,x0,x1):
    prev=None
    for x in range(x0,x1):
        c=hx(im[y,x])
        if c!=prev: print(f'  x{x}:{c}',end='')
        prev=c
    print()
def scany(x,y0,y1):
    prev=None
    for y in range(y0,y1):
        c=hx(im[y,x])
        if c!=prev: print(f'  y{y}:{c}',end='')
        prev=c
    print()
print('repo card row y=450 left edge'); scanx(450,180,235)
print('repo card right edge'); scanx(450,655,680)
print('repo card vertical x=450'); scany(450,400,420); scany(450,480,510)
print('app card y=610 left'); scanx(610,180,235); scanx(610,655,680)
print('app card x=450 top/bottom'); scany(450,550,565); scany(450,655,680)
print('card interior', hx(im[640,600]), hx(im[470,560]))
print('corner repo TL'); 
for y in range(405,418): print(''.join('#' if np.abs(im[y,x]-im[450,300]).sum()>60 else '.' for x in range(218,232)))
