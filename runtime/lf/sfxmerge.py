# Run inside a long-form project dir (needs words.json, chapters.json, chNN/ comps). Merges per-chapter SFX cues into sfx.json for mix.py.
import json, subprocess
W=json.load(open('words.json')); C=json.load(open('chapters.json')); F=[c['first_line'] for c in C]+[10**9]; out=[]
for i in range(len(C)):
    f=min(w['s'] for w in W if F[i]<=w['line']<F[i+1]); pv=[w['e'] for w in W if w['line']<F[i]]; s=max(0,f-(min(3.0,f-max(pv)-0.27) if pv else 0.25))  # same LEAD as build.js
    subprocess.run(['node',__import__('os').path.join(__import__('os').path.dirname(__file__),'..','sfxdump.js'),f'ch{i:02d}',f'_sfx{i:02d}.json'],check=True,capture_output=True)
    cues=json.load(open(f'_sfx{i:02d}.json')); out+= [dict(c,t=round(c['t']+s,3)) for c in cues]; print(i,len(cues))
json.dump(sorted(out,key=lambda c:c['t']),open('sfx.json','w')); print('total',len(out))
