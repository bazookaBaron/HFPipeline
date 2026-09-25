from grab import *
a=grab(39.68)
# vertical profile at x=360 from y=140 to 300
for y in range(150,215): print(y, hx(a[y,360]), hx(a[y,45]), hx(a[y,41]),hx(a[y,40]))
