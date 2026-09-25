from mot import *
for name,t0,t1,x,y,w,h in [('S12 billing card 2D',40.93,41.33,200,520,480,170),('S01 repo card 2D',0.0,0.30,200,380,480,130),('S02 WT card 2D',2.10,2.45,200,590,480,200)]:
    F=frames(t0,t1,x,y,w,h)[:, ::2, ::2]; show(name+' (alpha,dy,dx) px@720 = x2',t0,track2(F,r=16))
