# beat detector: union of (panel>0.6), (hud>1.5), (card>5 onset only), ignoring GOP frames (t%5==0) and frames inside playing footage in the panel (hero 0-5.5)
import json, numpy as np
rows=json.load(open('sig.json')); N=len(rows)
g=lambda k: np.array([r[k] for r in rows])
pd,hd,cd=g('panel_d'),g('hud_d'),g('card_d')
gop=np.array([ (i%150)==0 for i in range(N)])
hit=((pd>0.6)|(hd>1.5)|(cd>5))&~gop
hit[:int(5.5*30)] = hit[:int(5.5*30)] & (pd[:int(5.5*30)]>4)   # hero footage masks small beats
# card video playback: only count onsets (first frame after >=10 quiet frames on card)
ev=[]; last=-99
for i in np.where(hit)[0]:
    if i-last>6: ev.append(i)   # merge within 200 ms
    last=i
t=np.array(ev)/30; gaps=np.diff(np.r_[0,t,N/30])
print('beats',len(t),'per min',round(len(t)/(N/30)*60,1),'gap median',round(np.median(gaps),2),'p90',round(np.percentile(gaps,90),2),'max',round(gaps.max(),2),'at',round(np.r_[0,t][gaps.argmax()],2))
top=np.argsort(gaps)[::-1][:6]; print('longest holds:',[(round(np.r_[0,t][k],2),round(gaps[k],2)) for k in top])
open('beats.txt','w').write(' '.join(f'{x:.2f}' for x in t))
# scene cuts (big layout changes)
sc=[]; last=-99
for i in np.where(((pd>5)|(hd>1.5))&~gop)[0]:
    if i-last>6: sc.append(i/30)
    last=i
sd=np.diff(np.r_[0,sc,N/30])
print('scenes',len(sc)+1,'median',round(np.median(sd),2),'max',round(sd.max(),2), [round(x,2) for x in sc])
