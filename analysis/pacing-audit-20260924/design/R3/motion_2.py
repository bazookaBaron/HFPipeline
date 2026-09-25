from mot import *
# S11 app card region after cut
F=frames(37.10,37.75,222,530,440,150); show('app card (alpha, cy, cx) rel y530',37.10,cent(F))
F=frames(37.40,38.05,222,670,440,150); show('auth card rel y670',37.40,cent(F))
F=frames(36.93,37.30,222,340,440,110); show('repo card rel y340',36.93,cent(F))
F=frames(36.93,37.60,185,380,40,480)
show('bracket ink rows (min,max) & count',36.93,[ (e, c) for e,c in zip(extent(F,1,thr=100),inkcount(F,thr=100))])
