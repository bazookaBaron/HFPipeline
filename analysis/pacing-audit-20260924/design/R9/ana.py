import json, numpy as np
rows=json.load(open('sig.json')); N=len(rows)
g=lambda k: np.array([r[k] for r in rows])
cm,cd=g('card_m'),g('card_d'); pd=g('panel_d'); md=g('mascot_d'); mm=g('mascot_m'); hd=g('hud_d')
# card presence/playback per 1s bin
print('t  card_mean  card_d_median  frac_frames_changing(>0.4)  mascot_mean')
for s in range(0,N,30):
    sl=slice(s,s+30)
    print(f"{s/30:5.0f} {cm[sl].mean():6.1f} {np.median(cd[sl]):6.2f} {np.mean(cd[sl]>0.4):4.2f} {mm[sl].mean():6.1f}")
