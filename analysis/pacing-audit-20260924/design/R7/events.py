import json,numpy as np
s=json.load(open('sweep.json'))
for k in ['hdr','cont','masc','cap']:
    a=np.array([r[k] for r in s]); print(k,'pcts',np.percentile(a,[50,75,90,95,99]).astype(int), 'zero%',round((a==0).mean()*100,1))
def windows(k,th,gap=2):
    a=np.array([r[k] for r in s]); idx=np.where(a>th)[0]
    ws=[]; 
    for j in idx:
        if ws and j-ws[-1][1]<=gap: ws[-1][1]=j; ws[-1][2]+=a[j]; ws[-1][3]=max(ws[-1][3],a[j])
        else: ws.append([j,j,a[j],a[j]])
    return ws
ws=windows('cont',300)
print(len(ws),'content windows')
for w in ws:
    i0=s[w[0]]['i']; i1=s[w[1]]['i']
    print(f"{(i0)/30:7.3f}-{(i1)/30:7.3f} {i1-i0+1:3d}f sum={w[2]:8d} max={w[3]:6d}")
