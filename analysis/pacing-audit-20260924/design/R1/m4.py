from grab import *
a=grab(153.7)
print("between-dot bg (avg 10x10 patches centred between dots):")
for gy in range(40,1280,80):
    print("%4d"%gy," ".join(hx(a[gy-4:gy+4,gx-4:gx+4].reshape(-1,3).mean(0))[1:] for gx in range(40,720,80)))
