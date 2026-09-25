from mot import *
def show(name,t0,vals): print(name); print('  '+' | '.join(f'{t0+i/30:.3f}:{v}' for i,v in enumerate(vals)))
# E1 S11 cut + repo card (x220-666,y351-440 per S15 layout?) use full diagram band
F=frames(36.80,37.80,220,340,450,110); show('E1 repo card S11 progress',36.80,[round(p,2) for p in progress(F)])
show('E1 repo card top-ink y',36.80,[e[0] if e else None for e in extent(F,1,thr=100)])
F=frames(36.80,37.80,185,380,12,480); show('E2 trunk extent y (rel 380)',36.80,extent(F,1,thr=100))
F=frames(36.80,38.00,220,500,450,120); show('E3 card2 (auth) progress',36.80,[round(p,2) for p in progress(F)])
show('E3 card2 top ink',36.80,[e[0] if e else None for e in extent(F,1,thr=30)])
