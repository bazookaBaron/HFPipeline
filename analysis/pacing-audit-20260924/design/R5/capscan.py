import subprocess, numpy as np, json
V="C:/Users/debna/Downloads/igexport-DdIM0QoiZre.mp4"
p=subprocess.run(["ffmpeg","-v","error","-i",V,"-vf","crop=720:76:0:960,format=gray","-f","rawvideo","-"],capture_output=True,check=True)
a=np.frombuffer(p.stdout,np.uint8).reshape(-1,76,720).astype(int)
act=(a>225).sum((1,2)); txt=(a>100).sum((1,2))
# text x-extent per frame
ext=[]
for f in a:
    xs=np.where((f>100).any(0))[0]; ext.append((xs.min(),xs.max()) if len(xs) else None)
blank=[i for i in range(len(a)) if txt[i]<20]
# chunk boundaries = blank runs
runs=[];s=None
for i in range(len(a)):
    if txt[i]<20:
        if s is None: s=i
    elif s is not None: runs.append((s,i-1)); s=None
chunks=[]; prev_end=-1
for (s,e) in runs+[(len(a),len(a))]:
    if s-prev_end>1: chunks.append((prev_end+1,s-1))
    prev_end=e
durs=[(e-b+1)/30 for b,e in chunks]
print('frames',len(a),'blank runs',len(runs),'blank run lengths',np.bincount([e-s+1 for s,e in runs])[:10].tolist())
print('chunks',len(chunks),'per min',round(len(chunks)/(len(a)/30)*60,1),'dur s median',np.median(durs).round(3),'p10',np.percentile(durs,10).round(3),'p90',np.percentile(durs,90).round(3),'max',max(durs))
w=[(ext[b+3][1]-ext[b+3][0]) if ext[b+3] else 0 for b,e in chunks if e-b>4]
print('chunk text width px@720 median',np.median(w),'min',min(w),'max',max(w))
# longest blank (gap) runs where caption absent >2 frames
print('long blanks (>3f):',[(round(s/30,2),e-s+1) for s,e in runs if e-s+1>3][:20])
json.dump({'chunks':[(b/30,e/30) for b,e in chunks]},open('capscan.json','w'))
