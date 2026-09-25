from mlib import *
for f in ['f_1.41.png','f_35.90.png','f_97.50.png','f_111.20.png']:
    im=load(f)
    print(f,'mascot', bbox(im,20,400,185,1000,thr=60))
im=load('f_1.41.png')
def scanx(y,x0,x1):
    print(' '.join(f'{x}:{hx(im[y,x])}' for x in range(x0,x1)))
def scany(x,y0,y1):
    print(' '.join(f'{y}:{hx(im[y,x])}' for y in range(y0,y1)))
print('cap left'); scanx(975,150,162)
print('cap right'); scanx(975,560,572)
print('cap top'); scany(360,942,954)
print('cap bottom'); scany(360,998,1016)
print('cap corner')
for y in range(945,960): print(''.join('#' if np.abs(im[y,x]-np.array([243,243,236])).sum()>25 else '.' for x in range(152,168)))
