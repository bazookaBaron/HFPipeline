from grab import *
import sys
for t in [0.9, 39.68, 120.62, 153.7]:
    a=grab(t); L=a.max(2)
    print("t",t)
    for gy in range(19,1280,80):
        row=[]
        for gx in range(19,720,40):
            row.append("%2d"%L[gy:gy+2,gx:gx+2].max())
        print("%4d"%gy," ".join(row))
