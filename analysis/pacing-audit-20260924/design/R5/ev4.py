from fg import *
def sat_core(reg):
    r=reg.reshape(-1,3); l=r.mean(1); top=r[l>=np.percentile(l,97)]; return hx(top.mean(0))
print('== E4 PERSON node lighting 41.85-42.2 (tile x85-154,y336-405)')
for t,a in frames(41.85,42.25):
    tile=a[336:406,85:155]; icon=a[350:392,100:140]
    print(f'{t:.3f} iconCore {sat_core(icon)} border {hx(a[370,85])} {hx(a[337,120])} fill {hx(a[345,95])} label {sat_core(a[412:424,95:145])}')
print('== E4b PLACE node 42.15-42.45 (tile ~x432-501,y333-402)')
for t,a in frames(42.15,42.45):
    icon=a[345:392,445:490]
    print(f'{t:.3f} iconCore {sat_core(icon)} fill {hx(a[340,440])}')
