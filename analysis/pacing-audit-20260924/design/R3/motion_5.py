from mot import *
F=frames(7.17,7.50,236,436,220,26); show('tree row1 horiz',7.17,[f'{a:.2f},{s}' for a,s in track(F,rng=40,axis=1)])
F=frames(7.17,7.50,236,436,220,26); show('tree row1 ink cols',7.17,[ (e,c) for e,c in zip(extent(F,0,thr=60,ref=np.array([254,252,248])),inkcount(F,thr=60,ref=np.array([254,252,248])))])
F=frames(5.70,6.00,210,838,420,34); show('ann S03 vertical',5.70,[f'{a:.2f},{s}' for a,s in track(F,rng=20)]); show('ann x',5.70,[f'{a:.2f},{s}' for a,s in track(F,rng=40,axis=1)])
# inside billing card: sub-elements
F=frames(40.93,41.40,236,560,60,50); show('billing folder icon',40.93,[f'{a:.2f},{s}' for a,s in track(F)])
F=frames(40.93,41.40,480,560,175,50); show('billing pill',40.93,[f'{a:.2f},{s}' for a,s in track(F)])
F=frames(40.93,41.40,218,530,8,160); show('billing card left border column',40.93,[f'{a:.2f},{s}' for a,s in track(F)])
