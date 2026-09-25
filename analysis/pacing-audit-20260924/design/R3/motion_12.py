from mot import *
def onset(F,t0,thr=0.5):
    a=[x[0] for x in track(F,rng=4)]
    for i,v in enumerate(a):
        if v>=thr: return round(t0+i/30,3)
    return None
# chips onsets (6 chips) grid: cols x 236-368, 378-508, 518-650; rows y 522-586, 597-660
ch=[]
for (x,y) in [(236,522),(378,522),(518,522),(236,597),(378,597),(518,597)]:
    F=frames(49.95,51.2,x,y,132,64); ch.append(onset(F,49.95))
print('chip 50% onsets',ch, 'stagger',np.diff(ch).round(3))
# tree rows S04 rows y 438,469,501,533,564 height 24
tr=[]
for y in (436,468,500,532,562):
    F=frames(7.05,8.6,240,y,200,24); tr.append(onset(F,7.05))
print('tree row onsets',tr,np.diff(tr).round(3))
# vscode code rows S18 68.6-70
cr=[]
for y in (480,510,538,568):
    F=frames(68.9,70.2,244,y,330,20); cr.append(onset(F,68.9))
print('code line onsets S18',cr,np.diff(cr).round(3))
# checklist S20 rows y ~625,662,699,736
cl=[]
for y in (624,660,698,734):
    F=frames(76.2,78.6,238,y,260,24); cl.append(onset(F,76.2))
print('checklist onsets',cl,np.diff(cl).round(3))
# S24 terminals
tm=[]
for y in (366,540,714):
    F=frames(91.3,94.8,222,y,446,30); tm.append(onset(F,91.3))
print('S24 terminal header onsets',tm,np.diff(tm).round(3))
