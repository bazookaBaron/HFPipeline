from mot import *
def cm(m,off,axis=0):
    cc=np.where(m.any(axis))[0]; return (int(cc.min())+off,int(cc.max())+off,int(m.sum())) if len(cc) else None
# progress bars S27: purple bar y~495-505 x 240-646
def satm(f,t=60): return (f.max(2)-f.min(2))>t
F=frames(106.30,107.50,238,494,412,12)
show('S27 purple bar x extent',106.30,[cm(satm(f),238) for f in F])
F=frames(106.70,107.80,238,669,412,12)
show('S27 green bar',106.70,[cm(satm(f,50),238) for f in F])
# typing S06: cmd text x extent in row y 460-482
F=frames(14.70,16.50,240,460,300,24)
show('S06 cmd ink x-extent (dark text)',14.70,[cm(np.abs(f-np.array([254,252,248])).sum(2)>150,240) for f in F])
