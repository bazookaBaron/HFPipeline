from mot import *
import re
jobs=[('S01 app/ child card',0.07,0.50,222,540,440,140),
('S01 auth/ child card',0.55,1.00,222,690,440,140),
('S02 working-tree card',2.03,2.45,222,600,440,200),
('S07 auth/ stacked card (2nd)',19.53,19.95,222,560,440,140),
('S12 billing/ stacked card',40.93,41.35,222,540,440,140),
('S10 green strip',33.56,33.95,228,495,430,75),
('S03 annotation',5.68,6.05,210,835,420,40),
('S06 terminal window (cut)',14.37,14.75,198,350,470,230),
('S19 alert box',73.97,74.35,200,735,470,100),
('S14 chip 1',50.07,50.40,236,520,132,66),
('S14 chip 6',50.70,51.05,518,595,132,66),
('S04 tree row 1',7.17,7.45,240,436,200,26),
('S22 green hotfix',84.33,84.65,215,700,460,120),
('S16 bar card 1 (cut)',59.73,60.10,218,380,452,145),
]
for name,t0,t1,x,y,w,h in jobs:
    F=frames(t0,t1,x,y,w,h); r=track(F,rng=35)
    show(name,t0,[f'{a:.2f},{s}' for a,s in r])
