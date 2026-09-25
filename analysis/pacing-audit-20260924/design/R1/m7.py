from grab import *
a=grab(39.68)
# caption region y 930-1040
for y in range(935,1035,1):
    print(y, hx(a[y,120]),hx(a[y,125]),hx(a[y,360]), hx(a[y,603]),hx(a[y,606]))
